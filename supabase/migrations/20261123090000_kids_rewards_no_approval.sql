-- Parent validation is removed from the app: every tick counts immediately and kids can always un-tick today.
-- (The needs_approval column and the approval functions stay for history but are no longer used.)

update kids_rewards.tasks set needs_approval = false where needs_approval;

update kids_rewards.completions
   set status = 'approved', approved_at = coalesce(approved_at, now())
 where status = 'pending';

-- Same signature as before: a kid can un-tick any of today's completions.
create or replace function kids_rewards.uncomplete_task(p_kid uuid, p_task uuid)
returns jsonb language plpgsql security definer
set search_path = kids_rewards, extensions, pg_temp as $$
declare v_c completions%rowtype;
begin
  select * into v_c from completions
   where task_id = p_task and kid_id = p_kid and date = _today() and status <> 'cancelled';
  if not found then return _fail('not_found'); end if;
  update completions set status = 'cancelled', approved_at = null, approved_by_parent = false where id = v_c.id;
  return _ok();
end $$;
