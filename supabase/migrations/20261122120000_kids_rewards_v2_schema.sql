-- Kids Rewards v2 — kids, task scheduling, one-off planning, completions.
-- Nothing is ever removed: tasks are archived, completions and one-off items are cancelled/flagged.

create type kids_rewards.slot as enum ('morning', 'noon', 'afternoon', 'evening', 'anytime');
create type kids_rewards.task_kind as enum ('planned', 'bonus');
create type kids_rewards.completion_status as enum ('pending', 'approved', 'cancelled');

-- ---------- kids ----------
create table kids_rewards.kids (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 20),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  color       text not null check (color in ('pink','peach','yellow','mint','sky','blue','lavender','grey')),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- tasks: scheduling ----------
alter table kids_rewards.tasks
  add column kind           kids_rewards.task_kind not null default 'bonus',
  add column assign_all     boolean not null default true,      -- true = every active kid
  add column kid_ids        uuid[]  not null default '{}',      -- used when assign_all = false
  add column days           smallint[],                         -- ISO weekdays 1=Mon..7=Sun; planned only
  add column slot           kids_rewards.slot not null default 'anytime',
  add column at_time        time,                               -- optional precise hour
  add column needs_approval boolean not null default false,
  add column archived_at    timestamptz;

alter table kids_rewards.tasks
  add constraint tasks_days_valid check (days is null or (cardinality(days) between 1 and 7 and days <@ array[1,2,3,4,5,6,7]::smallint[])),
  add constraint tasks_planned_has_days check (kind = 'bonus' or days is not null);

-- The display-only "frequency" becomes a real schedule: daily → planned every day; the rest → bonus.
-- (The frequency column stays for now but is no longer used by the app.)
update kids_rewards.tasks
   set kind = 'planned', days = array[1,2,3,4,5,6,7]::smallint[], slot = 'anytime'
 where frequency = 'daily';

-- ---------- one-off planning for a given date ----------
create table kids_rewards.planned_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references kids_rewards.tasks(id),
  kid_id     uuid not null references kids_rewards.kids(id),
  date       date not null,
  slot       kids_rewards.slot not null default 'anytime',
  at_time    time,
  removed    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (task_id, kid_id, date)
);
create index planned_items_date_idx on kids_rewards.planned_items(date);

-- ---------- completions ----------
create table kids_rewards.completions (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references kids_rewards.tasks(id),
  kid_id             uuid not null references kids_rewards.kids(id),
  date               date not null,
  status             kids_rewards.completion_status not null,
  approved_by_parent boolean not null default false,
  created_at         timestamptz not null default now(),
  approved_at        timestamptz,
  unique (task_id, kid_id, date)
);
create index completions_date_idx on kids_rewards.completions(date);
create index completions_pending_idx on kids_rewards.completions(status) where status = 'pending';

-- ---------- household time zone ----------
alter table kids_rewards.app_settings add column timezone text not null default 'Europe/Brussels';

-- ---------- RLS & grants ----------
alter table kids_rewards.kids          enable row level security;
alter table kids_rewards.planned_items enable row level security;
alter table kids_rewards.completions   enable row level security;

create policy "public read active kids" on kids_rewards.kids
  for select to anon, authenticated using (active);
grant select on kids_rewards.kids to anon, authenticated;
grant all on kids_rewards.kids, kids_rewards.planned_items, kids_rewards.completions to service_role;
-- planned_items / completions: no client grants or policies — read & written only via functions.

-- Archived tasks disappear from the public catalog too.
alter policy "public read active tasks" on kids_rewards.tasks using (active and archived_at is null);
