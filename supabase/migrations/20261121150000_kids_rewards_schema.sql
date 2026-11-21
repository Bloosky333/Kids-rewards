-- Kids Rewards: schema, tables, RLS, grants.
-- Everything lives in the dedicated `kids_rewards` schema (shared Supabase project).

create schema if not exists kids_rewards;

create type kids_rewards.category_kind  as enum ('task', 'reward');
create type kids_rewards.task_frequency as enum ('daily', 'weekly', 'anytime', 'once');

create table kids_rewards.categories (
  id          uuid primary key default gen_random_uuid(),
  kind        kids_rewards.category_kind not null,
  name        text not null check (char_length(name) between 1 and 30),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  color       text not null check (color in ('pink','peach','yellow','mint','sky','blue','lavender','grey')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (kind, name)
);

create table kids_rewards.tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  points      int  not null check (points between 1 and 999),
  category_id uuid not null references kids_rewards.categories(id) on delete restrict,
  frequency   kids_rewards.task_frequency not null default 'anytime',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table kids_rewards.rewards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  cost        int  not null check (cost between 1 and 9999),
  category_id uuid not null references kids_rewards.categories(id) on delete restrict,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_category_id_idx   on kids_rewards.tasks(category_id);
create index rewards_category_id_idx on kids_rewards.rewards(category_id);

-- Single-row settings table; never readable by clients.
create table kids_rewards.app_settings (
  id              boolean primary key default true check (id),
  pin_hash        text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz
);

-- Ensure tasks/rewards point to a category of the matching kind; maintain updated_at.
create function kids_rewards._check_item_category()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_kind kids_rewards.category_kind :=
    case tg_table_name when 'tasks' then 'task'::kids_rewards.category_kind
                       else 'reward'::kids_rewards.category_kind end;
begin
  if not exists (select 1 from kids_rewards.categories c
                 where c.id = new.category_id and c.kind = v_kind) then
    raise exception 'category % is not a % category', new.category_id, v_kind
      using errcode = 'foreign_key_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger tasks_check_category   before insert or update on kids_rewards.tasks
  for each row execute function kids_rewards._check_item_category();
create trigger rewards_check_category before insert or update on kids_rewards.rewards
  for each row execute function kids_rewards._check_item_category();

-- Row Level Security
alter table kids_rewards.categories   enable row level security;
alter table kids_rewards.tasks        enable row level security;
alter table kids_rewards.rewards      enable row level security;
alter table kids_rewards.app_settings enable row level security;

create policy "public read categories" on kids_rewards.categories
  for select to anon, authenticated using (true);
create policy "public read active tasks" on kids_rewards.tasks
  for select to anon, authenticated using (active);
create policy "public read active rewards" on kids_rewards.rewards
  for select to anon, authenticated using (active);
-- app_settings: no policies at all.

-- Grants: read-only for clients; all writes go through PIN-checked functions.
grant usage on schema kids_rewards to anon, authenticated, service_role;
revoke all on all tables in schema kids_rewards from anon, authenticated, public;
grant select on kids_rewards.categories, kids_rewards.tasks, kids_rewards.rewards
  to anon, authenticated;
grant all on all tables in schema kids_rewards to service_role;
