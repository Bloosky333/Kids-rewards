-- Kids Rewards v2 — functions.
-- Public (no PIN): day_board, week_plan, complete_task, uncomplete_task, pending_count.
-- Parent (PIN):    admin_list_kids, upsert_kid, reorder_kids, save_task, archive_task,
--                  add_planned_items, remove_planned_item, list_pending,
--                  set_completions_status, set_completion.
-- Internal helpers (_today, _slot_for, _plan, _assigned_kids) only read data the board already shows.

-- ======================= helpers =======================

-- "Today" in the household time zone (server side, so the tablet clock can't be used to cheat).
create function kids_rewards._today()
returns date language sql stable security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  select (now() at time zone coalesce((select timezone from app_settings limit 1), 'Europe/Brussels'))::date
$$;

-- A precise hour decides the slot; otherwise the chosen slot is kept.
create function kids_rewards._slot_for(p_slot kids_rewards.slot, p_time time)
returns kids_rewards.slot language sql immutable
set search_path = kids_rewards, pg_temp as $$
  select case
    when p_time is null then p_slot
    when p_time < time '12:00' then 'morning'::slot
    when p_time < time '14:00' then 'noon'::slot
    when p_time < time '18:00' then 'afternoon'::slot
    else 'evening'::slot
  end
$$;

-- Everything planned on p_date, per active kid: recurring planned tasks + one-off items (one-off wins).
create function kids_rewards._plan(p_date date)
returns table (kid_id uuid, task_id uuid, slot kids_rewards.slot, at_time time, one_off boolean, planned_item_id uuid)
language sql stable security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  select distinct on (x.kid_id, x.task_id) x.kid_id, x.task_id, x.slot, x.at_time, x.one_off, x.planned_item_id
  from (
    select k.id as kid_id, t.id as task_id, _slot_for(t.slot, t.at_time) as slot, t.at_time,
           false as one_off, null::uuid as planned_item_id
      from kids k
      join tasks t on t.kind = 'planned' and t.active and t.archived_at is null
                  and extract(isodow from p_date)::smallint = any (t.days)
                  and (t.assign_all or k.id = any (t.kid_ids))
     where k.active
    union all
    select pi.kid_id, pi.task_id, _slot_for(pi.slot, pi.at_time), pi.at_time, true, pi.id
      from planned_items pi
      join kids k  on k.id = pi.kid_id and k.active
      join tasks t on t.id = pi.task_id and t.active and t.archived_at is null
     where pi.date = p_date and not pi.removed
  ) x
  order by x.kid_id, x.task_id, x.one_off desc
$$;

-- Kids who should do p_task on p_date (planned for them, or assigned if it's a bonus task).
create function kids_rewards._assigned_kids(p_task uuid, p_date date)
returns setof uuid language sql stable security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  select p.kid_id from _plan(p_date) p where p.task_id = p_task
  union
  select k.id from kids k
    join tasks t on t.id = p_task and t.kind = 'bonus' and t.active and t.archived_at is null
   where k.active and (t.assign_all or k.id = any (t.kid_ids))
$$;

-- ======================= public: board =======================

create function kids_rewards.day_board(p_date date default null)
returns jsonb language sql stable security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  with d as (select coalesce(p_date, _today()) as day, _today() as today),
  plan as (select p.* from d, _plan(d.day) p),
  bonus as (
    select k.id as kid_id, t.id as task_id
      from kids k
      join tasks t on t.kind = 'bonus' and t.active and t.archived_at is null
                  and (t.assign_all or k.id = any (t.kid_ids))
     where k.active
       and not exists (select 1 from plan p where p.kid_id = k.id and p.task_id = t.id)
  ),
  assigned as (select kid_id, task_id from plan union select kid_id, task_id from bonus),
  comp as (select c.* from completions c, d where c.date = d.day and c.status <> 'cancelled'),
  team as (
    select a.task_id, count(*) as n_assigned, count(c.id) as n_done
      from assigned a
      left join comp c on c.task_id = a.task_id and c.kid_id = a.kid_id
     group by a.task_id
  ),
  items as (
    select x.kid_id, x.task_id, x.kind, x.slot, x.at_time, x.one_off,
           t.name, t.emoji, t.description, t.points, t.team_points, t.needs_approval,
           c.status::text as status, coalesce(c.approved_by_parent, false) as approved_by_parent,
           (t.team_points is not null and tm.n_assigned >= 2 and tm.n_done >= tm.n_assigned) as team_applies,
           tm.n_assigned, tm.n_done
      from (select kid_id, task_id, 'planned'::text as kind, slot, at_time, one_off from plan
            union all
            select kid_id, task_id, 'bonus', 'anytime'::slot, null::time, false from bonus) x
      join tasks t on t.id = x.task_id
      left join comp c on c.task_id = x.task_id and c.kid_id = x.kid_id
      left join team tm on tm.task_id = x.task_id
  ),
  scored as (
    select i.*, case when i.team_applies then i.team_points else i.points end as earned from items i
  )
  select jsonb_build_object(
    'today', d.today,
    'date', d.day,
    'is_today', d.day = d.today,
    'kids', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'name', k.name, 'emoji', k.emoji, 'color', k.color,
               'items', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'task_id', s.task_id, 'name', s.name, 'emoji', s.emoji, 'description', s.description,
                           'points', s.points, 'team_points', s.team_points, 'needs_approval', s.needs_approval,
                           'slot', s.slot, 'at_time', to_char(s.at_time, 'HH24:MI'), 'one_off', s.one_off,
                           'status', s.status, 'approved_by_parent', s.approved_by_parent,
                           'team_applies', s.team_applies, 'team_size', s.n_assigned, 'team_done', s.n_done,
                           'earned', s.earned)
                         order by s.slot, s.at_time nulls last, s.name)
                    from scored s where s.kid_id = k.id and s.kind = 'planned'), '[]'::jsonb),
               'bonus', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'task_id', s.task_id, 'name', s.name, 'emoji', s.emoji, 'description', s.description,
                           'points', s.points, 'team_points', s.team_points, 'needs_approval', s.needs_approval,
                           'status', s.status, 'approved_by_parent', s.approved_by_parent,
                           'team_applies', s.team_applies, 'team_size', s.n_assigned, 'team_done', s.n_done,
                           'earned', s.earned)
                         order by s.points, s.name)
                    from scored s where s.kid_id = k.id and s.kind = 'bonus'), '[]'::jsonb),
               'totals', (
                  select jsonb_build_object(
                    'approved', coalesce(sum(s.earned) filter (where s.status = 'approved'), 0),
                    'pending',  coalesce(sum(s.earned) filter (where s.status = 'pending'), 0),
                    'planned',  count(*) filter (where s.kind = 'planned'),
                    'done',     count(*) filter (where s.kind = 'planned' and s.status is not null))
                    from scored s where s.kid_id = k.id))
             order by k.sort_order, k.name)
        from kids k where k.active), '[]'::jsonb)
  )
  from d
$$;

-- 7 days of planned items for one kid (parent week overview). Read-only, same data as the board.
create function kids_rewards.week_plan(p_kid uuid, p_from date)
returns jsonb language sql stable security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', g.day,
           'items', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'task_id', t.id, 'name', t.name, 'emoji', t.emoji, 'slot', p.slot,
                       'at_time', to_char(p.at_time, 'HH24:MI'), 'one_off', p.one_off,
                       'planned_item_id', p.planned_item_id)
                     order by p.slot, p.at_time nulls last, t.name)
                from _plan(g.day) p join tasks t on t.id = p.task_id
               where p.kid_id = p_kid), '[]'::jsonb))
         order by g.day), '[]'::jsonb)
    from (select (p_from + i)::date as day from generate_series(0, 6) i) g
$$;

-- ======================= public: ticking =======================

create function kids_rewards.complete_task(p_kid uuid, p_task uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare
  v_today date := _today();
  v_task  tasks%rowtype;
  v_rows  int;
  v_n_assigned int;
  v_n_done int;
begin
  select * into v_task from tasks where id = p_task and active and archived_at is null;
  if not found or not exists (select 1 from kids where id = p_kid and active) then
    return _fail('not_found');
  end if;
  if p_kid not in (select _assigned_kids(p_task, v_today)) then
    return _fail('not_planned');
  end if;

  insert into completions (task_id, kid_id, date, status, approved_at)
  values (p_task, p_kid, v_today,
          case when v_task.needs_approval then 'pending'::completion_status else 'approved' end,
          case when v_task.needs_approval then null else now() end)
  on conflict (task_id, kid_id, date) do update
     set status = excluded.status, approved_at = excluded.approved_at,
         approved_by_parent = false, created_at = now()
   where completions.status = 'cancelled';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return _fail('already_done'); end if;

  select count(*), count(c.id) into v_n_assigned, v_n_done
    from _assigned_kids(p_task, v_today) a(kid_id)
    left join completions c on c.task_id = p_task and c.kid_id = a.kid_id and c.date = v_today and c.status <> 'cancelled';

  return _ok(jsonb_build_object(
    'status', case when v_task.needs_approval then 'pending' else 'approved' end,
    'team_completed', v_task.team_points is not null and v_n_assigned >= 2 and v_n_done >= v_n_assigned,
    'earned', case when v_task.team_points is not null and v_n_assigned >= 2 and v_n_done >= v_n_assigned
                   then v_task.team_points else v_task.points end));
end $$;

-- A kid can un-tick today's task unless a parent already approved it.
create function kids_rewards.uncomplete_task(p_kid uuid, p_task uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare v_c completions%rowtype;
begin
  select * into v_c from completions
   where task_id = p_task and kid_id = p_kid and date = _today() and status <> 'cancelled';
  if not found then return _fail('not_found'); end if;
  if v_c.approved_by_parent then return _fail('approved_by_parent'); end if;
  update completions set status = 'cancelled', approved_at = null where id = v_c.id;
  return _ok();
end $$;

create function kids_rewards.pending_count()
returns int language sql stable security definer
set search_path = kids_rewards, extensions, pg_temp as $$
  select count(*)::int from completions c
    join kids k on k.id = c.kid_id and k.active
   where c.status = 'pending'
$$;

-- ======================= parent: kids =======================

create function kids_rewards.admin_list_kids(p_pin text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  return _ok(coalesce((select jsonb_agg(to_jsonb(k) order by k.sort_order, k.name) from kids k), '[]'));
end $$;

create function kids_rewards.upsert_kid(
  p_pin text, p_id uuid, p_name text, p_emoji text, p_color text, p_active boolean default true)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v kids%rowtype;
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    if p_id is null then
      insert into kids (name, emoji, color, active, sort_order)
      values (btrim(p_name), p_emoji, p_color, coalesce(p_active, true),
              coalesce((select max(sort_order) + 1 from kids), 0))
      returning * into v;
    else
      update kids set name = btrim(p_name), emoji = p_emoji, color = p_color, active = coalesce(p_active, true)
       where id = p_id returning * into v;
      if not found then return _fail('not_found'); end if;
    end if;
  exception
    when check_violation or not_null_violation then return _fail('invalid_input');
  end;
  return _ok(to_jsonb(v));
end $$;

create function kids_rewards.reorder_kids(p_pin text, p_ids uuid[])
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  update kids k set sort_order = x.ord - 1
    from unnest(p_ids) with ordinality as x(id, ord) where k.id = x.id;
  return _ok();
end $$;

-- ======================= parent: tasks =======================

create function kids_rewards.save_task(
  p_pin text, p_id uuid, p_name text, p_emoji text, p_points int, p_category_id uuid,
  p_active boolean, p_description text, p_team_points int,
  p_kind text, p_assign_all boolean, p_kid_ids uuid[], p_days smallint[],
  p_slot text, p_at_time text, p_needs_approval boolean)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare
  st text := _check_pin(p_pin);
  v tasks%rowtype;
  v_kind task_kind;
  v_time time;
  v_slot slot;
  v_days smallint[];
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    v_kind := p_kind::task_kind;
    v_time := nullif(p_at_time, '')::time;
    v_slot := _slot_for(coalesce(p_slot, 'anytime')::slot, v_time);
    v_days := case when v_kind = 'planned'
                   then (select array_agg(distinct d order by d) from unnest(p_days) d) end;
    if not coalesce(p_assign_all, true) and coalesce(cardinality(p_kid_ids), 0) = 0 then
      return _fail('invalid_input');
    end if;
    if p_id is null then
      insert into tasks (name, emoji, points, category_id, active, description, team_points,
                         kind, assign_all, kid_ids, days, slot, at_time, needs_approval, frequency)
      values (btrim(p_name), p_emoji, p_points, p_category_id, coalesce(p_active, true), v_desc, p_team_points,
              v_kind, coalesce(p_assign_all, true), coalesce(p_kid_ids, '{}'), v_days,
              case when v_kind = 'planned' then v_slot else 'anytime' end,
              case when v_kind = 'planned' then v_time end,
              coalesce(p_needs_approval, false), 'anytime')
      returning * into v;
    else
      update tasks set name = btrim(p_name), emoji = p_emoji, points = p_points, category_id = p_category_id,
             active = coalesce(p_active, true), description = v_desc, team_points = p_team_points,
             kind = v_kind, assign_all = coalesce(p_assign_all, true), kid_ids = coalesce(p_kid_ids, '{}'),
             days = v_days,
             slot = case when v_kind = 'planned' then v_slot else 'anytime' end,
             at_time = case when v_kind = 'planned' then v_time end,
             needs_approval = coalesce(p_needs_approval, false)
       where id = p_id and archived_at is null returning * into v;
      if not found then return _fail('not_found'); end if;
    end if;
  exception
    when foreign_key_violation then return _fail('invalid_category');
    when check_violation or not_null_violation or invalid_text_representation
         or invalid_datetime_format or datetime_field_overflow
      then return _fail('invalid_input');
  end;
  return _ok(to_jsonb(v));
end $$;

-- Archive: keeps history readable, hides the task everywhere.
create function kids_rewards.archive_task(p_pin text, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  update tasks set archived_at = now() where id = p_id and archived_at is null;
  if not found then return _fail('not_found'); end if;
  return _ok();
end $$;

-- Admin list: hide archived tasks (replaces v1 body, same signature).
create or replace function kids_rewards.admin_list_tasks(p_pin text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  return _ok(coalesce((select jsonb_agg(to_jsonb(t) order by t.points, t.name)
                         from tasks t where t.archived_at is null), '[]'));
end $$;

-- ======================= parent: one-off planning =======================

create function kids_rewards.add_planned_items(
  p_pin text, p_task uuid, p_kid_ids uuid[], p_date date, p_slot text, p_at_time text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v_time time;
begin
  if st <> 'ok' then return _fail(st); end if;
  if coalesce(cardinality(p_kid_ids), 0) = 0 or p_date is null then return _fail('invalid_input'); end if;
  begin
    v_time := nullif(p_at_time, '')::time;
    insert into planned_items (task_id, kid_id, date, slot, at_time)
    select p_task, k, p_date, _slot_for(coalesce(p_slot, 'anytime')::slot, v_time), v_time
      from unnest(p_kid_ids) k
    on conflict (task_id, kid_id, date) do update
       set slot = excluded.slot, at_time = excluded.at_time, removed = false;
  exception
    when foreign_key_violation then return _fail('not_found');
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
      then return _fail('invalid_input');
  end;
  return _ok();
end $$;

create function kids_rewards.remove_planned_item(p_pin text, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  update planned_items set removed = true where id = p_id and not removed;
  if not found then return _fail('not_found'); end if;
  return _ok();
end $$;

-- ======================= parent: approvals & fixes =======================

create function kids_rewards.list_pending(p_pin text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  return _ok(coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'date', c.date, 'created_at', c.created_at,
             'kid', jsonb_build_object('id', k.id, 'name', k.name, 'emoji', k.emoji, 'color', k.color),
             'task', jsonb_build_object('id', t.id, 'name', t.name, 'emoji', t.emoji,
                                        'points', t.points, 'team_points', t.team_points),
             'team_applies', tm.applies,
             'earned', case when tm.applies then t.team_points else t.points end)
           order by c.date desc, k.sort_order, c.created_at)
      from completions c
      join kids k on k.id = c.kid_id and k.active
      join tasks t on t.id = c.task_id
      cross join lateral (
        select t.team_points is not null and count(*) >= 2 and count(c2.id) >= count(*) as applies
          from _assigned_kids(t.id, c.date) a(kid_id)
          left join completions c2 on c2.task_id = t.id and c2.kid_id = a.kid_id
                                  and c2.date = c.date and c2.status <> 'cancelled'
      ) tm
     where c.status = 'pending'), '[]'));
end $$;

-- p_status: 'approved' (validate) or 'cancelled' (refuse → the kid can redo it).
create function kids_rewards.set_completions_status(p_pin text, p_ids uuid[], p_status text)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin); v_n int;
begin
  if st <> 'ok' then return _fail(st); end if;
  if p_status not in ('approved', 'cancelled') then return _fail('invalid_input'); end if;
  update completions
     set status = p_status::completion_status,
         approved_by_parent = (p_status = 'approved'),
         approved_at = case when p_status = 'approved' then now() end
   where id = any (p_ids) and status = 'pending';
  get diagnostics v_n = row_count;
  return _ok(jsonb_build_object('updated', v_n));
end $$;

-- Parent fix for any day (past days included): done → approved by parent; not done → cancelled.
create function kids_rewards.set_completion(p_pin text, p_kid uuid, p_task uuid, p_date date, p_done boolean)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare st text := _check_pin(p_pin);
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    if p_done then
      insert into completions (task_id, kid_id, date, status, approved_by_parent, approved_at)
      values (p_task, p_kid, p_date, 'approved', true, now())
      on conflict (task_id, kid_id, date) do update
         set status = 'approved', approved_by_parent = true, approved_at = now();
    else
      update completions set status = 'cancelled', approved_at = null, approved_by_parent = false
       where task_id = p_task and kid_id = p_kid and date = p_date;
    end if;
  exception when foreign_key_violation then return _fail('not_found');
  end;
  return _ok();
end $$;

-- Explicit grants for the API roles (listed one by one: a schema-wide grant would re-open reset_pin/_check_pin).
-- Parent functions check the PIN themselves.
grant execute on function
  kids_rewards._today(), kids_rewards._slot_for(kids_rewards.slot, time),
  kids_rewards._plan(date), kids_rewards._assigned_kids(uuid, date),
  kids_rewards.day_board(date), kids_rewards.week_plan(uuid, date),
  kids_rewards.complete_task(uuid, uuid), kids_rewards.uncomplete_task(uuid, uuid), kids_rewards.pending_count(),
  kids_rewards.admin_list_kids(text), kids_rewards.upsert_kid(text, uuid, text, text, text, boolean),
  kids_rewards.reorder_kids(text, uuid[]),
  kids_rewards.save_task(text, uuid, text, text, int, uuid, boolean, text, int, text, boolean, uuid[], smallint[], text, text, boolean),
  kids_rewards.archive_task(text, uuid),
  kids_rewards.add_planned_items(text, uuid, uuid[], date, text, text), kids_rewards.remove_planned_item(text, uuid),
  kids_rewards.list_pending(text), kids_rewards.set_completions_status(text, uuid[], text),
  kids_rewards.set_completion(text, uuid, uuid, date, boolean)
to anon, authenticated, service_role;

notify pgrst, 'reload schema';
