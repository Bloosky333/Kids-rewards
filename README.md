# Missions & Boutique 🎯🎁

A tablet-first PWA showing kids the **missions** (tasks) that earn coins and the **boutique** (rewards) they can buy. Parents edit both lists in a PIN-protected parent mode. Balances are tracked with physical fake bills and are out of scope. See [`SPEC.md`](SPEC.md).

- **Stack:** React 18 + Vite + TypeScript, TanStack Query, `vite-plugin-pwa`, emoji-mart (French search via emojibase).
- **Backend:** Supabase project *Personal*, dedicated `kids_rewards` schema. Migrations are in [`supabase/migrations`](supabase/migrations).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
```

`.env` holds the Supabase URL and **publishable** key. Both are public by design: security comes from RLS and the PIN-checked database functions.

## One-time Supabase setup

1. Apply the migrations in `supabase/migrations` (already done on *Personal*).
2. **Project Settings → Data API → Exposed schemas**: add `kids_rewards`. Without it the app shows "Impossible de charger la liste".
3. Open the app, tap 🔒 and choose the parent PIN.

## Parent PIN

| Need | How |
|---|---|
| Set the first PIN | Tap 🔒 → *Choisis ton code parent* (only possible while no PIN exists) |
| Change it | Parent mode → ⚙️ Réglages → *Changer le code parent* |
| Forgot it | Supabase → SQL Editor → `select kids_rewards.reset_pin();`, then tap 🔒 to choose a new one |

After 5 wrong codes, the server refuses PIN checks for 1 minute. Parent mode locks again after 5 minutes of inactivity.

## Deploy (Vercel)

Live at **https://kids-rewards-rho.vercel.app**: Vercel project `kids-rewards`, linked to this GitHub repo. Every push to the production branch (currently `claude/kids-rewards-manager-7n9vzo`) redeploys automatically.

`vercel.json` sets up the Vite build and SPA routing. No environment variables are required (`.env` is committed). To use other values, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the Vercel project.

## Tests

`e2e/mock-e2e.cjs` drives the production build in Chromium against an in-memory mock of the Supabase API, covering 14 scenarios: kids' lists, PIN setup and lockout, CRUD, change PIN, idle lock and offline. See the header of the file for usage.

## Install on the tablet

Open the deployed URL in the tablet browser → *Add to Home screen*. It then opens full-screen, and the last loaded lists stay visible offline.
