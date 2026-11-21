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
| Backend | Supabase (existing project): Postgres, RLS, RPC functions |
| Hosting | Vercel, auto-deploy from GitHub |
| Language | French only |
| Target age | 6–8 (early readers): big emoji, short words |
| Illustrations | One emoji per task, reward and category |
| Points display | Coin icon + number, e.g. `🪙 5` |
| Style | Playful cards: rounded, colorful, pastel, light animations |
| Admin protection | 4-digit PIN, verified **in the database** |
| Parent mode | Locks again automatically after 5 min idle |
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

**Unlock**
- Tapping 🔒 opens a full-screen PIN pad (4 digits, big buttons).
- The PIN is checked by the server (`verify_pin` RPC). A wrong PIN shakes the pad and shows "Code incorrect".
- Once unlocked, the PIN stays **in memory only** (never in localStorage) and is sent with every write.
- Parent mode locks again after **5 minutes with no interaction**, on the 🔓 "Verrouiller" button, or on page reload.

**Screens** (tabs inside parent mode)
1. **Missions**: list, create, edit and delete tasks
2. **Boutique**: list, create, edit and delete rewards
3. **Catégories**: two sub-lists (Missions / Boutique) to create, edit, delete and reorder categories

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

**PIN management**
- There is no in-app PIN change. The initial PIN is set (and later changed) with a SQL snippet in the Supabase SQL editor; see §5.4.

## 4. Non-functional requirements

- **Tablet-first**: designed for 768–1280px, portrait and landscape. Still usable on a phone.
- **Touch targets** ≥ 56px. No hover-only interactions.
- **PWA**: manifest, icons and fullscreen display so it can be "added to home screen" as a kiosk-like app. The app shell is cached. The data needs a network connection, but the last fetched lists are kept and shown when offline.
- **Freshness**: the lists are fetched again when the app regains focus. Supabase Realtime is optional and out of scope for v1.
- **Accessibility**: text contrast ≥ 4.5:1 on cards. Emoji get `aria-label`s. Animations respect `prefers-reduced-motion`.
- **Performance**: first load under 2s on the tablet over Wi-Fi.

## 5. Data model (Supabase / Postgres)

### 5.1 Tables

```sql
create extension if not exists pgcrypto;

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
  id        boolean primary key default true check (id),
  pin_hash  text not null
);
```

`tasks.category_id` must point to a `kind = 'task'` category, and `rewards.category_id` to a `kind = 'reward'` one. A trigger or the RPCs enforce this.

`on delete restrict` enforces "block deletion" at the database level. The RPC catches the error and returns a friendly message.

### 5.2 Row Level Security

- RLS is **enabled** on all four tables.
- `categories`, `tasks`, `rewards`: one `SELECT` policy for `anon` (tasks and rewards filtered to `active = true`, or the kid views filter in the query; see the open questions).
- There are **no** insert, update or delete policies, so all writes from the client are denied.
- `app_settings` has **no policies at all**, so the client cannot read it.

### 5.3 Write API (Postgres functions, `security definer`)

Every write function takes `p_pin text` as its first argument. It calls the internal `_check_pin(p_pin)`, which raises `invalid_pin` when `crypt(p_pin, pin_hash) <> pin_hash`. Each function runs with `set search_path = public` and is granted `execute` to `anon`.

| Function | Purpose |
|---|---|
| `verify_pin(p_pin) → boolean` | Unlock check for the PIN pad |
| `admin_list_tasks(p_pin)` / `admin_list_rewards(p_pin)` | Return all items, including inactive ones |
| `upsert_task(p_pin, p_id, p_name, p_emoji, p_points, p_category_id, p_frequency, p_active) → tasks` | Create (when `p_id` is null) or update |
| `delete_task(p_pin, p_id)` | Delete |
| `upsert_reward(p_pin, p_id, p_name, p_emoji, p_cost, p_category_id, p_active) → rewards` | Create or update |
| `delete_reward(p_pin, p_id)` | Delete |
| `upsert_category(p_pin, p_id, p_kind, p_name, p_emoji, p_color) → categories` | Create or update; new categories go to the end of the order |
| `reorder_categories(p_pin, p_kind, p_ids uuid[])` | Set `sort_order` from the array order |
| `delete_category(p_pin, p_id)` | Raises `category_not_empty` with a count if the category is in use |

The client maps the error codes to French messages.

### 5.4 Setting or changing the PIN (parents, via the SQL editor)

```sql
insert into app_settings (id, pin_hash)
values (true, crypt('1234', gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;
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
  features/parent/PinPad.tsx, ParentLayout.tsx, TasksAdmin.tsx, RewardsAdmin.tsx,
                  CategoriesAdmin.tsx, forms/*, EmojiPicker.tsx
  features/parent/useParentSession.ts   # holds PIN in memory + idle timer (5 min)
  styles/                    # design tokens, CSS variables
```

- **Routing**: `/` → Missions, `/boutique` → Boutique, `/parent/*` → parent mode. The parent routes redirect to the PIN pad when locked.
- **Data**: TanStack Query for caching and refetch on focus, persisted to IndexedDB for offline display.
- **Emoji picker**: a lightweight library (e.g. `emoji-picker-react`) with French labels, or a curated grid of ~120 kid-relevant emoji. See the open questions.
- **Env**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, set in Vercel project settings.

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
- Changing the PIN in the app, wrong-PIN lockout
- Languages other than French
- Realtime sync between devices (data refreshes on focus instead)

## 9. Open questions / risks

1. **PIN brute force**: with no lockout, someone who has the public URL could try all 10,000 PINs against `verify_pin`. Risk is low for a family app with an unlisted URL. A cheap fix is a server-side delay or a counter in `app_settings`. Do you want it, or a longer PIN (6 digits)?
2. **Inactive items for kids**: should RLS hide inactive items from `anon` (stricter), or should the kid views just filter them out (simpler)? Default: RLS hides them, and parents read everything through `admin_list_*`.
3. **Emoji picker**: a full picker library or a curated kid-friendly grid? Default: the full library with French search, which is simple and flexible.
4. **Existing Supabase project**: which project, and is it shared with other apps? If it is, we prefix the tables (e.g. `kr_tasks`) or use a dedicated schema.

## 10. Milestones

1. **DB**: migrations (tables, RLS, RPCs), seed, PIN set
2. **Kids' views**: Missions + Boutique with the playful design, read-only
3. **Parent mode**: PIN pad, idle lock, CRUD for tasks, rewards and categories
4. **PWA + deploy**: manifest, icons, offline cache, Vercel deployment
5. **Polish**: animations, empty states, test on the real tablet
