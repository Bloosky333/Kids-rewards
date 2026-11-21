-- Kids Rewards: PIN handling and admin API (security definer RPCs).
-- Admin RPCs never RAISE on a bad PIN (that would roll back the failed-attempt
-- counter); they return jsonb {ok:false, error:...} instead.

-- ---------- internal helpers (not callable by clients) ----------

create function kids_rewards._check_pin(p_pin text)
returns text language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare s app_settings%rowtype;
begin
  select * into s from app_settings where id for update;
  if not found then return 'not_set'; end if;
  if s.locked_until is not null and s.locked_until > now() then return 'locked'; end if;

  if p_pin is not null and crypt(p_pin, s.pin_hash) = s.pin_hash then
    update app_settings set failed_attempts = 0, locked_until = null where id;
    return 'ok';
  end if;

  if s.failed_attempts + 1 >= 5 then
    update app_settings set failed_attempts = 0, locked_until = now() + interval '1 minute' where id;
    return 'locked';
  end if;
  update app_settings set failed_attempts = s.failed_attempts + 1, locked_until = null where id;
  return 'invalid_pin';
end $$;

create function kids_rewards._fail(p_error text, p_extra jsonb default '{}')
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare v_until timestamptz;
begin
  if p_error = 'locked' then
    select locked_until into v_until from app_settings where id;
    p_extra := p_extra || jsonb_build_object('retry_after',
      greatest(1, ceil(extract(epoch from (v_until - now()))))::int);
  end if;
  return jsonb_build_object('ok', false, 'error', p_error) || p_extra;
end $$;

create function kids_rewards._ok(p_data jsonb default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('ok', true, 'data', p_data)
$$;

-- ---------- PIN lifecycle ----------

create function kids_rewards.pin_status()
returns jsonb language sql security definer stable
set search_path = kids_rewards, extensions, pg_temp as $$
  select jsonb_build_object('is_set', exists (select 1 from app_settings))
$$;

create function kids_rewards.setup_pin(p_new text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare v_rows int;
begin
  if p_new is null or p_new !~ '^[0-9]{4}$' then return _fail('invalid_format'); end if;
  insert into app_settings (id, pin_hash) values (true, crypt(p_new, gen_salt('bf')))
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return _fail('already_set'); end if;
  return _ok();
end $$;

create function kids_rewards.verify_pin(p_pin text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  return _ok();
end $$;

create function kids_rewards.change_pin(p_pin text, p_new text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  if p_new is null or p_new !~ '^[0-9]{4}$' then return _fail('invalid_format'); end if;
  update app_settings
     set pin_hash = crypt(p_new, gen_salt('bf')), failed_attempts = 0, locked_until = null
   where id;
  return _ok();
end $$;

-- Recovery: run from the Supabase SQL editor only (no client grant).
create function kids_rewards.reset_pin()
returns void language sql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  delete from app_settings;
$$;

-- ---------- admin reads (include inactive items) ----------

create function kids_rewards.admin_list_tasks(p_pin text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  return _ok(coalesce((select jsonb_agg(to_jsonb(t) order by t.points, t.name) from tasks t), '[]'));
end $$;

create function kids_rewards.admin_list_rewards(p_pin text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  return _ok(coalesce((select jsonb_agg(to_jsonb(r) order by r.cost, r.name) from rewards r), '[]'));
end $$;

-- ---------- tasks ----------

create function kids_rewards.upsert_task(
  p_pin text, p_id uuid, p_name text, p_emoji text, p_points int,
  p_category_id uuid, p_frequency text default 'anytime', p_active boolean default true)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v tasks%rowtype;
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    if p_id is null then
      insert into tasks (name, emoji, points, category_id, frequency, active)
      values (btrim(p_name), p_emoji, p_points, p_category_id,
              coalesce(p_frequency, 'anytime')::task_frequency, coalesce(p_active, true))
      returning * into v;
    else
      update tasks set name = btrim(p_name), emoji = p_emoji, points = p_points,
             category_id = p_category_id,
             frequency = coalesce(p_frequency, 'anytime')::task_frequency,
             active = coalesce(p_active, true)
       where id = p_id returning * into v;
      if not found then return _fail('not_found'); end if;
    end if;
  exception
    when foreign_key_violation then return _fail('invalid_category');
    when check_violation or not_null_violation or invalid_text_representation
      then return _fail('invalid_input');
  end;
  return _ok(to_jsonb(v));
end $$;

create function kids_rewards.delete_task(p_pin text, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  delete from tasks where id = p_id;
  if not found then return _fail('not_found'); end if;
  return _ok();
end $$;

-- ---------- rewards ----------

create function kids_rewards.upsert_reward(
  p_pin text, p_id uuid, p_name text, p_emoji text, p_cost int,
  p_category_id uuid, p_active boolean default true)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v rewards%rowtype;
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    if p_id is null then
      insert into rewards (name, emoji, cost, category_id, active)
      values (btrim(p_name), p_emoji, p_cost, p_category_id, coalesce(p_active, true))
      returning * into v;
    else
      update rewards set name = btrim(p_name), emoji = p_emoji, cost = p_cost,
             category_id = p_category_id, active = coalesce(p_active, true)
       where id = p_id returning * into v;
      if not found then return _fail('not_found'); end if;
    end if;
  exception
    when foreign_key_violation then return _fail('invalid_category');
    when check_violation or not_null_violation then return _fail('invalid_input');
  end;
  return _ok(to_jsonb(v));
end $$;

create function kids_rewards.delete_reward(p_pin text, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  delete from rewards where id = p_id;
  if not found then return _fail('not_found'); end if;
  return _ok();
end $$;

-- ---------- categories ----------

-- p_kind is only used on create; a category's kind never changes.
create function kids_rewards.upsert_category(
  p_pin text, p_id uuid, p_kind text, p_name text, p_emoji text, p_color text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v categories%rowtype;
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    if p_id is null then
      insert into categories (kind, name, emoji, color, sort_order)
      values (p_kind::category_kind, btrim(p_name), p_emoji, p_color,
              coalesce((select max(sort_order) + 1 from categories
                         where kind = p_kind::category_kind), 0))
      returning * into v;
    else
      update categories set name = btrim(p_name), emoji = p_emoji, color = p_color
       where id = p_id returning * into v;
      if not found then return _fail('not_found'); end if;
    end if;
  exception
    when unique_violation then return _fail('duplicate_name');
    when check_violation or not_null_violation or invalid_text_representation
      then return _fail('invalid_input');
  end;
  return _ok(to_jsonb(v));
end $$;

create function kids_rewards.reorder_categories(p_pin text, p_kind text, p_ids uuid[])
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    update categories c set sort_order = x.ord - 1
      from unnest(p_ids) with ordinality as x(id, ord)
     where c.id = x.id and c.kind = p_kind::category_kind;
  exception when invalid_text_representation then return _fail('invalid_input');
  end;
  return _ok();
end $$;

create function kids_rewards.delete_category(p_pin text, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v_count int;
begin
  if st <> 'ok' then return _fail(st); end if;
  select (select count(*) from tasks where category_id = p_id)
       + (select count(*) from rewards where category_id = p_id) into v_count;
  if v_count > 0 then
    return _fail('category_not_empty', jsonb_build_object('count', v_count));
  end if;
  delete from categories where id = p_id;
  if not found then return _fail('not_found'); end if;
  return _ok();
end $$;

-- ---------- grants ----------
revoke execute on all functions in schema kids_rewards from public, anon, authenticated;

grant execute on function
  kids_rewards.pin_status(),
  kids_rewards.setup_pin(text),
  kids_rewards.verify_pin(text),
  kids_rewards.change_pin(text, text),
  kids_rewards.admin_list_tasks(text),
  kids_rewards.admin_list_rewards(text),
  kids_rewards.upsert_task(text, uuid, text, text, int, uuid, text, boolean),
  kids_rewards.delete_task(text, uuid),
  kids_rewards.upsert_reward(text, uuid, text, text, int, uuid, boolean),
  kids_rewards.delete_reward(text, uuid),
  kids_rewards.upsert_category(text, uuid, text, text, text, text),
  kids_rewards.reorder_categories(text, text, uuid[]),
  kids_rewards.delete_category(text, uuid)
to anon, authenticated;

grant execute on all functions in schema kids_rewards to service_role;
-- reset_pin(), _check_pin(), _fail(), _ok() stay unreachable from the API.
