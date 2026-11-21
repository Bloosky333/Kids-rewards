-- Tasks: optional description + optional team points.
-- team_points = points EACH kid gets when all kids complete the task together
-- (e.g. points = 1 alone, team_points = 2 each together). NULL = no team bonus.

alter table kids_rewards.tasks
  add column description text check (description is null or char_length(description) <= 120),
  add column team_points int check (team_points is null or team_points between 1 and 999);

alter table kids_rewards.tasks
  add constraint tasks_team_points_gt_points check (team_points is null or team_points > points);

-- Replace upsert_task with the extended signature (drop first so PostgREST has no ambiguous overload).
drop function kids_rewards.upsert_task(text, uuid, text, text, int, uuid, text, boolean);

create function kids_rewards.upsert_task(
  p_pin text, p_id uuid, p_name text, p_emoji text, p_points int,
  p_category_id uuid, p_frequency text default 'anytime', p_active boolean default true,
  p_description text default null, p_team_points int default null)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare
  st text := _check_pin(p_pin);
  v tasks%rowtype;
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if st <> 'ok' then return _fail(st); end if;
  begin
    if p_id is null then
      insert into tasks (name, emoji, points, category_id, frequency, active, description, team_points)
      values (btrim(p_name), p_emoji, p_points, p_category_id,
              coalesce(p_frequency, 'anytime')::task_frequency, coalesce(p_active, true),
              v_desc, p_team_points)
      returning * into v;
    else
      update tasks set name = btrim(p_name), emoji = p_emoji, points = p_points,
             category_id = p_category_id,
             frequency = coalesce(p_frequency, 'anytime')::task_frequency,
             active = coalesce(p_active, true),
             description = v_desc,
             team_points = p_team_points
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

revoke execute on function kids_rewards.upsert_task(text, uuid, text, text, int, uuid, text, boolean, text, int)
  from public, anon, authenticated;
grant execute on function kids_rewards.upsert_task(text, uuid, text, text, int, uuid, text, boolean, text, int)
  to anon, authenticated, service_role;

-- Ask PostgREST to pick up the new signature immediately.
notify pgrst, 'reload schema';
