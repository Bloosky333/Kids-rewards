# Kids Rewards v2 — Kids, daily planning & completions

Status: **spec, not implemented**. It extends [`SPEC.md`](SPEC.md) (v1: task/reward catalog, parent PIN, Candy Glass UI).
Inspiration: Skylight Calendar (family day board, per-person chore lists, stars and rewards, celebrations).

## 1. Goals

1. Manage **kids** (profiles).
2. Plan tasks in a **daily schedule per kid**, with recurrence (every day / weekdays / weekend / chosen days) and an optional slot or hour.
3. Let kids **tick tasks as done** on the shared tablet, with no login.
4. Show the **points earned today** per kid, applying the **team bonus** automatically. There is still no balance or spending in the app: payment stays with fake bills.

## 2. Decisions

| Topic | Decision |
|---|---|
| Home screen | **Family day board**: today's date and one column per kid, with tasks grouped by slot |
| Kid "login" | None. Kids tick in their own column. Tapping a kid's avatar opens their space, with no code |
| Kid space tabs | **Ma journée** · **Missions bonus** · **Boutique**, plus a "Retour" button back to the board |
| Kid profile | Name, colour (8 palette tokens), emoji avatar, display order |
| Task types | **Planifiée** (has a schedule) or **Bonus** (no schedule, can be done any day) |
| Recurrence | Days: every day / weekdays (Mon–Fri) / weekend (Sat–Sun) / chosen days. Plus one-off additions for a given date |
| Time | A slot (🌅 Matin · ☀️ Midi · 🌤️ Après-midi · 🌙 Soir · ✨ N'importe quand), and optionally a precise hour (07:30). The hour sets the slot |
| Assignment | One or several kids, or "Tous les enfants" (includes kids added later). All assigned kids share the same schedule |
| Ticking | Tap the card: big check, confetti, "+2 ★". Tapping again within 5 s undoes it |
| Validation | **Per task**: either validated automatically, or "⏳ à valider" until a parent approves it |
| Approvals UI | A badge with the count on 🔒, and an **À valider** tab in parent mode with ✅ / ↩️ per item and "Tout valider" |
| Points | Per kid "★ 5 gagnées · ⏳ 2 en attente" for the day shown. Informative only |
| Team bonus | **Automatic**: if every kid assigned to a task on a given day has completed it, each of them gets `team_points` instead of `points` |
| Bonus missions | At most **once per kid per day** |
| Missed tasks | They just stay unticked. No penalty, no carry-over |
| Day navigation | Today by default. ◀ ▶ arrows to look at other days. Kids can only tick **today**; parents can fix past days |
| Old "Fréquence" field | **Removed**, replaced by the schedule (migration in §6) |

## 3. Screens

### 3.1 Day board (home)

```
┌──────────────────────────────────────────────────────────────┐
│ ◀  Samedi 22 novembre  ▶                     🔒(3)          │
├────────────────────┬────────────────────┬────────────────────┤
│ 🦊 Léa             │ 🐯 Tom             │ …                  │
│ ★ 5 · ⏳ 2  ▓▓▓░ 3/5 │ ★ 2 · ⏳ 0  ▓░░░ 1/4 │                    │
│ 🌅 MATIN  ←now     │ 🌅 MATIN           │                    │
│ [✓ 🛏️ Faire son lit │ [  🛏️ Faire son lit │                    │
│        07:30 ★2]   │        07:30 ★2]   │                    │
│ [⏳ 🦷 Dents  ★1]   │ …                  │                    │
│ ☀️ MIDI            │                    │                    │
│ 🌙 SOIR            │                    │                    │
└────────────────────┴────────────────────┴────────────────────┘
```

- **Columns:** one per active kid, in display order, tinted with the kid's colour. The header shows the avatar, name, today's points (approved and pending), and progress: done / planned, as a bar.
- **Width:** 1–3 kids fit on screen on a tablet in landscape; with more kids the board scrolls horizontally. On a phone, a single kid is shown, with avatar chips to switch.
- **Slots:** shown in order, and empty slots are hidden. The **current slot** is highlighted with a "maintenant" chip, and past slots are slightly dimmed.
- **Task chips:** emoji, name, hour if set, ★ points, and 👫 if the task has a team bonus. Each chip has one of three states: to do, ⏳ pending, or ✓ done.
- **Ticking:** tapping a chip marks it done (today only), with a celebration animation and "+N ★". The chip then shows "Annuler" for 5 s. Tapping a done chip after that asks for confirmation before un-ticking ("Annuler ?"). A chip a parent has already approved can't be un-ticked by a kid.
- **Other days:** they are read-only for kids, and a small banner says "Tu peux cocher seulement aujourd'hui".
- **Avatar:** tapping a kid's avatar opens that kid's space.
- **Footer:** an "En plus aujourd'hui ✨" link per kid, showing how many bonus missions are available, which opens Missions bonus.

### 3.2 Kid space (tap avatar)

A full-screen view in the kid's colour, with a "← Retour au tableau" button and these tabs in the floating dock:

1. **Ma journée:** the same items as the kid's column, but as big Candy Glass cards grouped by slot, with the current slot first.
2. **Missions bonus:** the bonus tasks assigned to this kid. Each one can be ticked once per day; once done today it shows ✓ "Fait aujourd'hui". The team badge shows when it applies.
3. **Boutique:** the existing reward catalog, unchanged.

The kid space returns to the board automatically after 2 minutes without use.

### 3.3 Parent mode: changes

The tabs become: **À valider (n)** · Missions · Enfants · Boutique · Catégories · Réglages.

- **À valider:** pending completions grouped by day, then kid. Each shows emoji, task, kid, time ticked, and the points (with "👫 bonus équipe" when it applies). Actions per item are ✅ Valider and ↩️ Refuser, which deletes the completion so the kid can redo it; "Tout valider" handles them all at once.
- **Enfants:** list, add, edit, delete, reorder, and deactivate. A deactivated kid is hidden from the board but keeps their history. The form has a name (1–20 characters), an emoji avatar picker, colour swatches, and a preview of the column header.
- **Missions:** the task form gets new fields:
  - **Type:** 🗓️ Planifiée / ✨ Bonus (segmented control).
  - **Pour qui:** a "Tous les enfants" chip, or avatar chips to pick several kids.
  - *If Planifiée:*
    - **Jours:** Tous les jours / Semaine (L–V) / Week-end / Choisir, with seven day chips L M M J V S D for "Choisir".
    - **Moment:** the slot chips.
    - **Heure:** optional; when set, the slot follows it.
  - **Validation:** "Un parent doit valider" toggle.
  - Description, points, team bonus, category, emoji and visible stay as they are.
  - The list shows a schedule summary per task, e.g. "🗓️ Semaine · 🌅 07:30 · 🦊🐯".
- **Planning:** a per-kid week overview (Mon–Sun grid of what is planned), opened from the Missions tab with "Voir la semaine". From there you can **add a one-off task for a date** ("Ajouter pour un jour": pick a task, kids, date, slot or hour) and remove one-off items.
- **Fixing past days:** from the board, in parent mode, a parent can tick or un-tick any past day. These completions are approved automatically.

### 3.4 Celebration

- Ticking a task: the chip pops and a ✓ appears, a short confetti burst comes from the chip, and "+2 ★" floats up. Use a lightweight confetti library (`canvas-confetti`, about 6 kB) or CSS particles.
- Finishing all of a kid's planned tasks for the day: a bigger confetti burst and the banner "Bravo Léa, journée terminée ! 🎉" on their column.
- Completing a task as a team: when the last assigned kid ticks it, a "👫 Bonus d'équipe !" toast appears.
- Everything respects `prefers-reduced-motion`; in that case the chip just changes to a static check.

## 4. Rules

- **"Today"** is computed in the household time zone (`app_settings.timezone`, default `Europe/Brussels`) **on the server**, so the tablet's clock can't be used to tick other days.
- **Slot boundaries** (defaults): Matin until 12:00, Midi 12:00–14:00, Après-midi 14:00–18:00, Soir from 18:00. They are used to place timed tasks and to highlight the current slot.
- **What is planned for a kid K on date D:**
  - recurring planned tasks that are active, assigned to K, and whose days include D's weekday;
  - plus one-off items for (K, D);
  - with duplicates of the same task removed.

  Bonus tasks are never "planned".
- **Completion:** at most one per (task, kid, date). Its status is `approved` (tasks without validation, or past days fixed by a parent) or `pending`.
- **Points for a completion:** `team_points` if the task has team points and every kid assigned to that task for that date has a completion (pending or approved) for it; otherwise `points`. This is computed when read, so when the last kid ticks, everyone's points go up.
  - For bonus tasks, "assigned for that date" means all kids assigned to the task.
- **Today's points per kid:** the sum of approved completions, and separately the sum of pending ones.
- **Changing a task's points later:** this changes the display for past days too. That's accepted for v2, since there's no balance.
- **Deleting a task:** it is soft-deleted (`archived_at`), so history stays readable. It disappears from every list.

## 5. Data model (Supabase, `kids_rewards` schema)

```sql
create type slot as enum ('morning', 'noon', 'afternoon', 'evening', 'anytime');
create type task_kind as enum ('planned', 'bonus');
create type completion_status as enum ('pending', 'approved');

create table kids (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  emoji text not null,
  color text not null check (color in ('pink','peach','yellow','mint','sky','blue','lavender','grey')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tasks
  add column kind task_kind not null default 'bonus',
  add column assign_all boolean not null default true,       -- true = every active kid
  add column days smallint[] check (days <@ array[1,2,3,4,5,6,7]::smallint[]), -- ISO weekdays; null for bonus
  add column slot slot not null default 'anytime',
  add column at_time time,                                   -- optional; overrides slot placement
  add column needs_approval boolean not null default false,
  add column archived_at timestamptz;
-- after migrating values (§6):  alter table tasks drop column frequency;

create table task_kids (            -- used when assign_all = false
  task_id uuid references tasks(id) on delete cascade,
  kid_id  uuid references kids(id)  on delete cascade,
  primary key (task_id, kid_id)
);

create table planned_items (        -- one-off additions for a specific date
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  kid_id  uuid not null references kids(id)  on delete cascade,
  date date not null,
  slot slot not null default 'anytime',
  at_time time,
  unique (task_id, kid_id, date)
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  kid_id  uuid not null references kids(id) on delete cascade,
  date date not null,
  status completion_status not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (task_id, kid_id, date)
);

alter table app_settings add column timezone text not null default 'Europe/Brussels';
```

**RLS:** clients get public `SELECT` on `kids` (active ones only) and nothing else directly. Everything else goes through functions.

### Public RPCs (no PIN, the kids' tablet)

| Function | Purpose |
|---|---|
| `day_board(p_date)` | For each active kid: the planned items (task fields, slot, time, completion status, points that apply) and the totals (approved, pending, done/planned). Bonus missions available and done that day. Also returns `is_today` and the server's `today` |
| `complete_task(p_kid, p_task)` | **Today only** (server time zone). The task must be planned today for that kid, or be a bonus task assigned to them. Inserts a completion (`approved` or `pending`). Returns the new board totals and whether the team bonus was triggered |
| `uncomplete_task(p_kid, p_task)` | Today only. Deletes the kid's own completion unless a parent has approved a task that needs approval |
| `pending_count()` | The number of pending completions, for the badge on 🔒 |

### Parent RPCs (PIN, as in v1)

`upsert_kid`, `delete_kid` (refused when the kid has history; deactivate instead), `reorder_kids`, the extended `upsert_task` (kind, assign_all, kid ids, days, slot, at_time, needs_approval), `archive_task`, `add_planned_item`, `delete_planned_item`, `list_pending`, `approve_completion(s)`, `reject_completion`, `set_completion(p_kid, p_task, p_date, p_done)` (fixes past days, always approved), `week_plan(p_kid, p_from)`.

**Abuse note:** anyone with the URL can tick tasks for today. That's acceptable for a family app; tasks that need parent approval protect the ones that matter.

## 6. Migrating existing data

| Old `frequency` | New task |
|---|---|
| `daily` | `kind = planned`, `days = {1..7}`, `slot = anytime` |
| `weekly`, `anytime`, `once` | `kind = bonus` |

All existing tasks get `assign_all = true` and `needs_approval = false`. Parents should check the result once after creating kids. The Missions list will show a one-time banner: "Vérifie le planning de tes missions".

## 7. Out of scope for v2 ("later")

Week view on the board, 🔥 streaks and history charts, night mode and screensaver, family events, Google/Outlook calendar sync, meal plan, shared lists, birthday countdowns, weather, per-kid login codes, points balance and spending in the Boutique, skipping one occurrence of a recurring task, configurable slot hours, offline ticking queue.

## 8. Milestones

1. **DB:** kids, task fields, planned_items, completions, migration of `frequency`, RPCs (public and parent), tests in SQL.
2. **Parent mode:** Enfants tab, the extended task form (type, kids, days, slot, hour, validation), À valider tab and badge, week overview and one-off items.
3. **Day board:** columns, slots, ticking with undo, totals, day navigation, today highlighting.
4. **Kid space:** Ma journée, Missions bonus, Boutique, auto-return.
5. **Celebrations and polish:** confetti, "journée terminée", team bonus toast, reduced-motion, phone layout, end-to-end tests (mock and live).

## 9. Open questions (for later)

- Should rewards in the Boutique eventually be "bought" with real balances? That would require the balance option deferred in §7.
- Should a kid be able to see their siblings' columns? (Yes by default, since it's a family board.)
