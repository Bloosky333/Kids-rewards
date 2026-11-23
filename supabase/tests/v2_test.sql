-- Local test for the v2 functions. Run against a scratch DB after all migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/v2_test.sql
-- Every check raises an exception on failure.
\set QUIET on
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', label; end if;
  raise notice 'ok  %', label;
end $$;

set role anon;
select pg_temp.check((kids_rewards.setup_pin('1234')->>'ok')::boolean, 'setup pin');

-- kids
select set_config('t.lea', kids_rewards.upsert_kid('1234', null, 'Léa', '🦊', 'pink')->'data'->>'id', false);
select set_config('t.tom', kids_rewards.upsert_kid('1234', null, 'Tom', '🐯', 'blue')->'data'->>'id', false);
select pg_temp.check(kids_rewards.upsert_kid('0000', null, 'X', '😀', 'pink')->>'error' = 'invalid_pin', 'kid write needs pin');
select pg_temp.check(kids_rewards.upsert_kid('1234', null, '', '😀', 'pink')->>'error' = 'invalid_input', 'kid name required');
select pg_temp.check((select count(*) from kids_rewards.kids) = 2, 'anon can read active kids');

-- seeded "daily" tasks are planned for both kids today
select pg_temp.check(jsonb_array_length(kids_rewards.day_board()->'kids') = 2, 'board has 2 kids');
select pg_temp.check(jsonb_array_length(kids_rewards.day_board()->'kids'->0->'items') = 3, 'Léa has 3 daily tasks today');
select pg_temp.check(jsonb_array_length(kids_rewards.day_board()->'kids'->0->'bonus') = 2, 'Léa has 2 bonus missions');

-- new planned team task, every day, 1 alone / 3 together
select set_config('t.team', kids_rewards.save_task('1234', null, 'Ranger le salon', '🛋️', 1,
  (select id from kids_rewards.categories where kind = 'task' and name = 'Maison'), true, 'Coussins', 3,
  'planned', true, '{}', '{1,2,3,4,5,6,7}', 'evening', '19:15', false)->'data'->>'id', false);
select pg_temp.check((select slot::text from kids_rewards.tasks where id = current_setting('t.team')::uuid) = 'evening', 'hour 19:15 → evening slot');

select pg_temp.check((kids_rewards.complete_task(current_setting('t.lea')::uuid, current_setting('t.team')::uuid)->'data'->>'earned')::int = 1, 'first kid alone earns 1');
select pg_temp.check(kids_rewards.complete_task(current_setting('t.lea')::uuid, current_setting('t.team')::uuid)->>'error' = 'already_done', 'cannot tick twice');
select pg_temp.check((kids_rewards.complete_task(current_setting('t.tom')::uuid, current_setting('t.team')::uuid)->'data'->>'team_completed')::boolean, 'second kid completes the team');
select pg_temp.check((select (i->>'earned')::int from jsonb_array_elements(kids_rewards.day_board()->'kids'->0->'items') i where i->>'name' = 'Ranger le salon') = 3, 'Léa now earns team points 3');
select pg_temp.check((kids_rewards.day_board()->'kids'->0->'totals'->>'approved')::int = 3, 'Léa approved total = 3');

-- undo / redo
select pg_temp.check((kids_rewards.uncomplete_task(current_setting('t.tom')::uuid, current_setting('t.team')::uuid)->>'ok')::boolean, 'tom unticks');
select pg_temp.check((select (i->>'earned')::int from jsonb_array_elements(kids_rewards.day_board()->'kids'->0->'items') i where i->>'name' = 'Ranger le salon') = 1, 'Léa back to solo points after Tom unticks');
select pg_temp.check((kids_rewards.complete_task(current_setting('t.tom')::uuid, current_setting('t.team')::uuid)->>'ok')::boolean, 'tom re-ticks after cancel');

-- approval flow: task for Léa only, needs approval
select set_config('t.appr', kids_rewards.save_task('1234', null, 'Devoirs', '✏️', 5,
  (select id from kids_rewards.categories where kind = 'task' and name = 'École'), true, null, null,
  'planned', false, array[current_setting('t.lea')::uuid], '{1,2,3,4,5,6,7}', 'afternoon', null, true)->'data'->>'id', false);
select pg_temp.check(kids_rewards.complete_task(current_setting('t.tom')::uuid, current_setting('t.appr')::uuid)->>'error' = 'not_planned', 'not assigned → not_planned');
select pg_temp.check(kids_rewards.complete_task(current_setting('t.lea')::uuid, current_setting('t.appr')::uuid)->'data'->>'status' = 'pending', 'needs approval → pending');
select pg_temp.check(kids_rewards.pending_count() = 1, 'pending count 1');
select pg_temp.check((kids_rewards.day_board()->'kids'->0->'totals'->>'pending')::int = 5, 'Léa pending total 5');
select pg_temp.check(jsonb_array_length(kids_rewards.list_pending('1234')->'data') = 1, 'list_pending has 1');
select pg_temp.check((kids_rewards.set_completions_status('1234',
  array[(kids_rewards.list_pending('1234')->'data'->0->>'id')::uuid], 'approved')->'data'->>'updated')::int = 1, 'approve');
select pg_temp.check((kids_rewards.uncomplete_task(current_setting('t.lea')::uuid, current_setting('t.appr')::uuid)->>'ok')::boolean, 'kid can untick (no parent validation anymore)');
select pg_temp.check(kids_rewards.pending_count() = 0, 'pending count back to 0');

-- bonus: once per day
select set_config('t.bonus', (select id::text from kids_rewards.tasks where name = 'Mettre la table'), false);
select pg_temp.check((kids_rewards.complete_task(current_setting('t.tom')::uuid, current_setting('t.bonus')::uuid)->>'ok')::boolean, 'bonus done');
select pg_temp.check(kids_rewards.complete_task(current_setting('t.tom')::uuid, current_setting('t.bonus')::uuid)->>'error' = 'already_done', 'bonus once per day');

-- weekday logic: weekend-only task
select set_config('t.we', kids_rewards.save_task('1234', null, 'Piscine', '🏊', 2,
  (select id from kids_rewards.categories where kind = 'task' and name = 'Maison'), true, null, null,
  'planned', true, '{}', '{6,7}', 'morning', null, false)->'data'->>'id', false);
select pg_temp.check(exists (select 1 from kids_rewards._plan('2026-11-21') where task_id = current_setting('t.we')::uuid), 'weekend task on Saturday');
select pg_temp.check(not exists (select 1 from kids_rewards._plan('2026-11-23') where task_id = current_setting('t.we')::uuid), 'weekend task not on Monday');

-- one-off planning + week plan
select pg_temp.check((kids_rewards.add_planned_items('1234', current_setting('t.bonus')::uuid,
  array[current_setting('t.lea')::uuid], '2026-11-24', 'noon', null)->>'ok')::boolean, 'add one-off');
select pg_temp.check((select count(*) from jsonb_array_elements(kids_rewards.week_plan(current_setting('t.lea')::uuid, '2026-11-23')) d,
  jsonb_array_elements(d->'items') i where d->>'date' = '2026-11-24' and (i->>'one_off')::boolean) = 1, 'week plan shows one-off');
select pg_temp.check((kids_rewards.remove_planned_item('1234', (select (i->>'planned_item_id')::uuid
  from jsonb_array_elements(kids_rewards.week_plan(current_setting('t.lea')::uuid, '2026-11-23')) d,
       jsonb_array_elements(d->'items') i where (i->>'one_off')::boolean))->>'ok')::boolean, 'remove one-off');
select pg_temp.check(not exists (select 1 from kids_rewards._plan('2026-11-24') where one_off), 'one-off gone');

-- invalid inputs
select pg_temp.check(kids_rewards.save_task('1234', null, 'X', '❌', 1,
  (select id from kids_rewards.categories where kind = 'task' limit 1), true, null, null,
  'planned', false, '{}', '{1}', 'morning', null, false)->>'error' = 'invalid_input', 'specific kids requires at least one');
select pg_temp.check(kids_rewards.save_task('1234', null, 'X', '❌', 1,
  (select id from kids_rewards.categories where kind = 'task' limit 1), true, null, null,
  'planned', true, '{}', '{1}', 'morning', '25:00', false)->>'error' = 'invalid_input', 'bad hour rejected');
select pg_temp.check(kids_rewards.save_task('1234', null, 'X', '❌', 1,
  (select id from kids_rewards.categories where kind = 'task' limit 1), true, null, null,
  'planned', true, '{}', '{}', 'morning', null, false)->>'error' = 'invalid_input', 'planned needs days');

-- parent fix on a past day, archive
select pg_temp.check((kids_rewards.set_completion('1234', current_setting('t.lea')::uuid, current_setting('t.team')::uuid, '2026-11-20', true)->>'ok')::boolean, 'parent fixes past day');
select pg_temp.check((kids_rewards.day_board('2026-11-20')->>'is_today')::boolean = false, 'past board not today');
select pg_temp.check((kids_rewards.archive_task('1234', current_setting('t.we')::uuid)->>'ok')::boolean, 'archive');
select pg_temp.check(not exists (select 1 from kids_rewards._plan('2026-11-21') where task_id = current_setting('t.we')::uuid), 'archived task not planned');
select pg_temp.check(not (kids_rewards.admin_list_tasks('1234')->'data' @> jsonb_build_array(jsonb_build_object('name', 'Piscine'))), 'archived hidden in admin list');

-- privacy: no direct access to completions / planned_items
do $$ begin
  perform 1 from kids_rewards.completions;
  raise exception 'FAILED: anon read completions';
exception when insufficient_privilege then raise notice 'ok  completions not readable by anon';
end $$;
do $$ begin
  insert into kids_rewards.kids (name, emoji, color) values ('hack', '💀', 'pink');
  raise exception 'FAILED: anon insert kid';
exception when insufficient_privilege then raise notice 'ok  kids not writable by anon';
end $$;
reset role;
\echo ALL V2 TESTS PASSED
