# Kids Rewards — Specification

## 1. Purpose

A tablet app that shows kids the **tasks** they can do to earn points and the **rewards** they can buy with those points. Parents configure both lists.

Balances are **out of scope**. Kids are paid in physical fake bills, so the app is a catalog only. It has no kid profiles, completion log or balance.

## 2. Decisions summary

| Topic | Decision |
|---|---|
| Users | Kids (read-only), parents (config, unlocked with a PIN) |
| Kid tracking | None, catalog only |
| Main device | Shared family tablet |
| Stack | React + Vite + TypeScript, installable PWA |
| Backend | Supabase project **Personal** (`wqjylckpqxtmrcdottxn`, eu-central-1, shared with another app): dedicated `kids_rewards` schema, RLS, RPC functions |
| Hosting | Vercel, auto-deploy from GitHub |
| Language | French only |
| Target age | 6–8 (early readers): big emoji, short words |
| Illustrations | One emoji per task, reward and category |
| Points display | Coin icon + number, e.g. `🪙 5` |
| Style | Playful cards: rounded, colorful, pastel, light animations |
| Admin protection | 4-digit PIN, verified **in the database** |
| Parent mode | Locks again automatically after 5 min idle |
| PIN brute force | Server-side: 1-minute lockout after 5 wrong codes |
| First PIN | Set in the app on first use (setup screen) |
| Change PIN | In parent mode: type the new PIN twice |
| Lost PIN | Reset from the Supabase SQL editor (`select kids_rewards.reset_pin();`), then set a new one in the app |
| Inactive items | Hidden from kids by RLS, not by the app |
| Emoji picker | Full picker with French search |
| Categories | Configurable (name, emoji, color, order), separate for tasks and rewards |
| Category delete | Blocked while items still use it |

## 3. Functional scope

### 3.1 Kids' views (read-only, no login)

Navigation is a persistent bottom bar with two large tabs:

- **🎯 Mes missions**: the tasks list
- **🎁 La boutique**: the rewards list

A small 🔒 icon in the top corner opens the parent PIN pad.

#### Mes missions
- Tasks are grouped by **task category**, in the category's `sort_order`.
- Each category has a header with its emoji, name and color band.
- Inside a category, tasks are sorted by points (ascending), then by name.
- Each task card shows:
  - a large emoji (≈64px)
  - the name (short, large rounded font)
  - the points as a big badge, `🪙 5`
  - the frequency tag (small colored pill): `Chaque jour` · `Chaque semaine` · `Quand tu veux` · `Une fois`
- Inactive tasks are not shown.

#### La boutique
- Rewards are grouped by **reward category**, in the category's `sort_order`.
- Inside a category, rewards are sorted by cost (ascending), then by name.
- Each reward card shows a large emoji, the name, and the cost badge `🪙 20`.
- Inactive rewards are not shown.

#### Empty states
- No tasks: "Pas encore de missions ! Demande à papa ou maman 🙂"
- No rewards: "La boutique est vide pour l'instant 🛒"

### 3.2 Parent mode (configuration)

**First-time setup**
- If no PIN exists yet (fresh install, or after a SQL reset), tapping 🔒 opens **"Choisis ton code parent"** instead of the unlock pad.
- Enter 4 digits, then **"Confirme ton code"** and the same 4 digits again. If they don't match: "Les codes ne correspondent pas", and you start over.
- On success, parent mode opens right away.
- The server accepts this only while no PIN exists. Once a PIN is set, `setup_pin` always fails.
- ⚠️ Whoever opens 🔒 first sets the PIN, so do it right after deploying or resetting.

**Unlock**
- Tapping 🔒 opens a full-screen PIN pad (4 digits, big buttons).
- The PIN is checked by the server (`verify_pin` RPC). A wrong PIN shakes the pad and shows "Code incorrect".
- After **5 wrong codes in a row**, the server refuses every PIN check (including writes) for **1 minute**. The pad shows "Trop d'essais, attends 1 minute ⏳" with a countdown. A correct code resets the counter.
- Once unlocked, the PIN stays **in memory only** (never in localStorage) and is sent with every write.
- Parent mode locks again after **5 minutes with no interaction**, on the 🔓 "Verrouiller" button, or on page reload.

**Screens** (tabs inside parent mode)
1. **Missions**: list, create, edit and delete tasks
2. **Boutique**: list, create, edit and delete rewards
3. **Catégories**: two sub-lists (Missions / Boutique) to create, edit, delete and reorder categories
4. **⚙️ Réglages**: change the PIN and read the recovery instructions

**Task form**

| Field | Type | Rules |
|---|---|---|
| Nom | text | required, 1–40 chars |
| Emoji | emoji picker | required, single emoji |
| Points | integer | required, 1–999 |
| Catégorie | select (task categories) | required |
| Fréquence | select | `daily` / `weekly` / `anytime` / `once`, default `anytime` |
| Active | toggle | default on |

**Reward form**

| Field | Type | Rules |
|---|---|---|
| Nom | text | required, 1–40 chars |
| Emoji | emoji picker | required |
| Coût | integer | required, 1–9999 |
| Catégorie | select (reward categories) | required |
| Active | toggle | default on |

> "Active" gives parents a way to hide an item temporarily without losing it. It is the only field beyond those you asked for. Remove it if you don't want it.

**Category form**

| Field | Type | Rules |
|---|---|---|
| Nom | text | required, 1–30 chars, unique per kind |
| Emoji | emoji picker | required |
| Couleur | picker of ~8 preset pastel colors | required |
| Ordre | drag handle / up-down arrows in the list | — |

**Deleting**
- Tasks and rewards: a confirmation dialog, then a hard delete.
- Categories: if any task or reward still uses it, the delete is refused with "Cette catégorie contient N élément(s). Déplace-les d'abord." Otherwise a confirmation, then delete.

**Réglages screen**

*Changer le code parent*
1. A button opens the same big PIN pad: **"Nouveau code"**, 4 digits.
2. Then **"Confirme le nouveau code"**, the same 4 digits again.
3. If they match, the app calls `change_pin(current_pin_in_memory, new_pin)`. The PIN held in memory is replaced and a toast shows "Code modifié ✅". If they don't match: "Les codes ne correspondent pas", back to step 1.
4. Parent mode stays unlocked. The current PIN is not asked for again because the session is already unlocked; the server still checks it, using the PIN held in memory.

*Code oublié ?* (an information card in Réglages, plus a "Code oublié ?" link under the unlock pad)
- Explains in French: "Ouvre Supabase → projet *Personal* → SQL Editor, puis exécute : `select kids_rewards.reset_pin();`. Ensuite, touche 🔒 dans l'app pour choisir un nouveau code."
- A "Copier la commande" button copies the SQL to the clipboard.
- Nothing is reset from the app itself, so kids can't use this path.

## 4. Non-functional requirements

- **Tablet-first**: designed for 768–1280px, portrait and landscape. Still usable on a phone.
- **Touch targets** ≥ 56px. No hover-only interactions.
- **PWA**: manifest, icons and fullscreen display so it can be "added to home screen" as a kiosk-like app. The app shell is cached. The data needs a network connection, but the last fetched lists are kept and shown when offline.
- **Freshness**: the lists are fetched again when the app regains focus. Supabase Realtime is optional and out of scope for v1.
- **Accessibility**: text contrast ≥ 4.5:1 on cards. Emoji get `aria-label`s. Animations respect `prefers-reduced-motion`.
- **Performance**: first load under 2s on the tablet over Wi-Fi.

## 5. Data model (Supabase / Postgres)

All objects live in a dedicated **`kids_rewards`** schema, because the Supabase project is shared with other apps. The schema must be added to **Project Settings → API → Exposed schemas**, and the client is created with `db: { schema: 'kids_rewards' }`. Grant `usage` on the schema to `anon`.

### 5.1 Tables

```sql
create extension if not exists pgcrypto with schema extensions;
create schema if not exists kids_rewards;
set search_path = kids_rewards, extensions;

create type category_kind as enum ('task', 'reward');
create type task_frequency as enum ('daily', 'weekly', 'anytime', 'once');

create table categories (
  id          uuid primary key default gen_random_uuid(),
  kind        category_kind not null,
  name        text not null check (char_length(name) between 1 and 30),
  emoji       text not null,
  color       text not null,              -- preset token, e.g. 'pink', 'mint'
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (kind, name)
);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null,
  points      int  not null check (points between 1 and 999),
  category_id uuid not null references categories(id) on delete restrict,
  frequency   task_frequency not null default 'anytime',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table rewards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null,
  cost        int  not null check (cost between 1 and 9999),
  category_id uuid not null references categories(id) on delete restrict,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Single-row settings table; never readable by clients.
create table app_settings (
  id              boolean primary key default true check (id),
  pin_hash        text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz
);
```

`tasks.category_id` must point to a `kind = 'task'` category, and `rewards.category_id` to a `kind = 'reward'` one. A trigger or the RPCs enforce this.

`on delete restrict` enforces "block deletion" at the database level. The RPC catches the error and returns a friendly message.

### 5.2 Row Level Security

- RLS is **enabled** on all four tables.
- `categories`: a `SELECT` policy for `anon` that allows every row.
- `tasks`, `rewards`: a `SELECT` policy for `anon` with `using (active)`, so inactive items never reach the kids' screens. Parents read everything through `admin_list_*`.
- There are **no** insert, update or delete policies, so all writes from the client are denied.
- `app_settings` has **no policies at all**, so the client cannot read it.

### 5.3 Write API (Postgres functions, `security definer`)

Every admin function takes `p_pin text` as its first argument and calls the internal `_check_pin(p_pin)`. Each function runs with `set search_path = kids_rewards, extensions` and is granted `execute` to `anon`. `_check_pin` itself is **not** granted to `anon`.

**PIN check and lockout.** `_check_pin` does the following:
0. If no `app_settings` row exists, it returns `not_set`.
1. If `locked_until > now()`, it returns `locked`.
2. If `crypt(p_pin, pin_hash) = pin_hash`, it resets `failed_attempts` to 0 and returns `ok`.
3. Otherwise it increments `failed_attempts`. On the 5th failure it sets `locked_until = now() + interval '1 minute'` and resets the counter. It returns `invalid_pin`.

> Implementation note: the failed-attempt counter must be **committed**, so admin functions must not `raise` on a bad PIN, because that would roll the increment back. Every admin RPC instead **returns `jsonb`** shaped like `{ "ok": true, "data": … }` or `{ "ok": false, "error": "invalid_pin" | "locked" | "category_not_empty" | …, "retry_after": 42, "count": 3 }`.

| Function | Purpose |
|---|---|
| `pin_status() → jsonb` | `{ "is_set": bool }`; tells 🔒 whether to show setup or unlock |
| `setup_pin(p_new) → jsonb` | Only when no PIN exists: validates `^[0-9]{4}$` and inserts the hash with `on conflict do nothing`. Returns `already_set` otherwise |
| `verify_pin(p_pin) → jsonb` | Unlock check for the PIN pad; returns `not_set` when no PIN exists |
| `change_pin(p_pin, p_new) → jsonb` | Checks the current PIN (with lockout), validates the new one, stores the new hash and resets the counters |
| `reset_pin() → void` | **SQL editor only** (no grant to `anon`/`authenticated`): deletes the PIN row |
| `admin_list_tasks(p_pin)` / `admin_list_rewards(p_pin)` | Return all items, including inactive ones |
| `upsert_task(p_pin, p_id, p_name, p_emoji, p_points, p_category_id, p_frequency, p_active) → tasks` | Create (when `p_id` is null) or update |
| `delete_task(p_pin, p_id)` | Delete |
| `upsert_reward(p_pin, p_id, p_name, p_emoji, p_cost, p_category_id, p_active) → rewards` | Create or update |
| `delete_reward(p_pin, p_id)` | Delete |
| `upsert_category(p_pin, p_id, p_kind, p_name, p_emoji, p_color) → categories` | Create or update; new categories go to the end of the order |
| `reorder_categories(p_pin, p_kind, p_ids uuid[])` | Set `sort_order` from the array order |
| `delete_category(p_pin, p_id)` | Returns `category_not_empty` with a count if the category is in use |

The client maps the error codes to French messages. If any admin call returns `invalid_pin`, `locked` or `not_set` (for example, the PIN was reset in SQL), parent mode locks again.

### 5.4 Recovering a lost PIN (parents, via the SQL editor)

Recommended: clear the PIN, then set a new one in the app's setup screen.

```sql
select kids_rewards.reset_pin();
```

`reset_pin()` deletes the `app_settings` row, which also clears the lockout. It is **not** granted to `anon` or `authenticated`, so only the SQL editor (`postgres`) can run it.

Alternative: set a PIN directly.

```sql
insert into kids_rewards.app_settings (id, pin_hash)
values (true, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do update
  set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
```

### 5.5 Seed data (optional, for a first run)

- Task categories: 🏠 Maison (blue), 🎒 École (yellow), 🧼 Hygiène (mint), 💛 Gentillesse (pink)
- Reward categories: 📺 Écran (lavender), 🍭 Friandise (peach), 🎡 Sortie (mint), 🧸 Jouet (yellow)
- A few example tasks: 🛏️ Faire son lit (2, daily), 🦷 Se brosser les dents (1, daily), 🍽️ Mettre la table (3, anytime), 📚 Lire 15 minutes (3, daily)
- A few example rewards: 📱 30 min de tablette (10), 🍦 Une glace (15), 🎬 Choisir le film du soir (20), 🎠 Sortie au parc d'attractions (200)

## 6. Front-end architecture

```
src/
  main.tsx, App.tsx          # router + bottom tab bar
  lib/supabase.ts            # client (anon key from env)
  lib/api.ts                 # typed wrappers for selects + RPCs
  lib/types.ts               # generated with `supabase gen types`
  features/kids/MissionsPage.tsx, ShopPage.tsx, ItemCard.tsx, CategorySection.tsx
  features/parent/PinPad.tsx, PinSetup.tsx, SettingsPage.tsx, ParentLayout.tsx, TasksAdmin.tsx, RewardsAdmin.tsx,
                  CategoriesAdmin.tsx, forms/*, EmojiPicker.tsx
  features/parent/useParentSession.ts   # holds PIN in memory + idle timer (5 min)
  styles/                    # design tokens, CSS variables
```

- **Routing**: `/` → Missions, `/boutique` → Boutique, `/parent/*` → parent mode. The parent routes redirect to the PIN pad when locked.
- **Data**: TanStack Query for caching and refetch on focus, persisted to IndexedDB for offline display.
- **Emoji picker**: a full picker with French search, e.g. `emoji-mart` with `@emoji-mart/data` and the `fr` locale, lazy-loaded so only parent mode pays for its size.
- **Env**: `VITE_SUPABASE_URL` (`https://wqjylckpqxtmrcdottxn.supabase.co`) and `VITE_SUPABASE_ANON_KEY` (the project's publishable key), set in Vercel project settings.

## 7. Visual design

- **Font**: a rounded, very legible font such as *Baloo 2* or *Nunito* (Google Fonts). Titles 32–40px, card names 22–26px.
- **Palette**: soft pastel background (cream, `#FFF8EC`). Category colors come from 8 preset pastels (pink, peach, yellow, mint, sky, blue, lavender, grey), each with a darker matching tone for text and borders.
- **Cards**: border radius 24px, a thick colored left border or top band in the category color, a soft shadow, and an emoji at 64px. They scale down slightly when pressed.
- **Point badge**: a gold pill `🪙 12` with bold numbers, the most prominent element after the emoji.
- **Grid**: 2 columns in portrait and 3–4 in landscape on the tablet; 1 column on a phone.
- **Motion**: cards fade or pop in when a list loads. The PIN pad shakes on a wrong code. All motion is disabled under reduced-motion.
- **Parent mode**: same palette but a calmer, denser layout (list rows rather than big cards) and a clear "Mode parent 🔓" banner so it is obvious when editing is unlocked.

## 8. Out of scope (v1)

- Kid profiles, balances, completion history, approvals
- Multiple families or households, user accounts
- Photo uploads
- PIN recovery inside the app (email, recovery codes): recovery goes through the SQL editor only
- Languages other than French
- Realtime sync between devices (data refreshes on focus instead)

## 9. Risks / notes

- **Shared project**: *Personal* already holds another app's tables in `public`, including a `public.app_settings`, so the `kids_rewards` schema avoids name clashes and keeps this app isolated. If the other apps in the project have their own `anon` grants, check that they don't grant broad privileges on all schemas.
- **Anon key is public**: this is expected. Security rests entirely on RLS plus the PIN-checked `security definer` functions. Run `get_advisors` (security) after each migration.
- **Setup race**: after a deploy or a `reset_pin()`, the first person to tap 🔒 chooses the PIN. Set it straight away.
- **4-digit PIN**: the lockout keeps a brute-force attack to at most 5 tries a minute, about 1.4 days to cover every PIN. That is acceptable for this use. Switch to 6 digits if you want more margin.

## 10. Milestones

1. **DB**: `kids_rewards` schema migrations on project *Personal* (tables, RLS, RPCs with lockout, setup, change and reset of the PIN), expose the schema, seed
2. **Kids' views**: Missions + Boutique with the playful design, read-only
3. **Parent mode**: first-PIN setup, PIN pad, idle lock, CRUD for tasks, rewards and categories, Réglages (change PIN, recovery help)
4. **PWA + deploy**: manifest, icons, offline cache, Vercel deployment
5. **Polish**: animations, empty states, test on the real tablet
