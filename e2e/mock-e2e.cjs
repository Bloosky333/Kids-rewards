// End-to-end UI test against an in-memory mock of the kids_rewards Supabase API (v2).
// The mock mirrors the SQL rules tested in supabase/tests/v2_test.sql.
// Usage: npm run build && npx vite preview --port 4173   (then, in another shell)
//        node e2e/mock-e2e.cjs <screenshot-dir>          (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = process.argv[2] || '.';
const BASE = 'http://localhost:4173';
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

// ---------- dates ----------
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
const addDays = (iso, k) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
const isoDow = (iso) => { const [y, m, d] = iso.split('-').map(Number); const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w === 0 ? 7 : w; };
const SLOT_ORDER = ['morning', 'noon', 'afternoon', 'evening', 'anytime'];
const slotFor = (slot, t) => { if (!t) return slot; const [h, mm] = t.split(':').map(Number); const v = h * 60 + mm; return v < 720 ? 'morning' : v < 840 ? 'noon' : v < 1080 ? 'afternoon' : 'evening'; };

// ---------- mock DB ----------
const db = { categories: [], tasks: [], rewards: [], kids: [], planned: [], completions: [], pin: null, fails: 0, lockedUntil: 0 };
const cat = (kind, name, emoji, color, sort) => { const c = { id: uid(), kind, name, emoji, color, sort_order: sort }; db.categories.push(c); return c; };
const maison = cat('task', 'Maison', '🏠', 'blue', 0), ecole = cat('task', 'École', '🎒', 'yellow', 1);
cat('task', 'Hygiène', '🧼', 'mint', 2);
const ecran = cat('reward', 'Écran', '📺', 'lavender', 0), fri = cat('reward', 'Friandise', '🍭', 'peach', 1);
const task = (name, emoji, points, c, extra = {}) => { const t = { id: uid(), name, emoji, points, category_id: c.id, active: true, description: null, team_points: null, kind: 'bonus', assign_all: true, kid_ids: [], days: null, slot: 'anytime', at_time: null, needs_approval: false, archived_at: null, ...extra }; db.tasks.push(t); return t; };
task('Faire son lit', '🛏️', 2, maison, { kind: 'planned', days: [1, 2, 3, 4, 5, 6, 7], slot: 'morning', at_time: '07:30:00', description: 'Couette bien tirée' });
task('Se brosser les dents', '🦷', 1, maison, { kind: 'planned', days: [1, 2, 3, 4, 5, 6, 7], slot: 'evening' });
task('Mettre la table', '🍽️', 3, maison);
db.rewards.push({ id: uid(), name: '30 min de tablette', emoji: '📱', cost: 10, category_id: ecran.id, active: true });
db.rewards.push({ id: uid(), name: 'Une glace', emoji: '🍦', cost: 15, category_id: fri.id, active: true });

const ok = (data = null) => ({ ok: true, data });
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
function check(pin) {
  if (!db.pin) return 'not_set';
  if (db.lockedUntil > Date.now()) return 'locked';
  if (pin === db.pin) { db.fails = 0; return 'ok'; }
  if (++db.fails >= 5) { db.fails = 0; db.lockedUntil = Date.now() + 60000; return 'locked'; }
  return 'invalid_pin';
}
const authFail = (st) => fail(st, st === 'locked' ? { retry_after: Math.ceil((db.lockedUntil - Date.now()) / 1000) } : {});
const withPin = (fn) => (a) => { const s = check(a.p_pin); return s === 'ok' ? fn(a) : authFail(s); };
const live = (t) => t.active && !t.archived_at;
const activeKids = () => db.kids.filter((k) => k.active).sort((a, b) => a.sort_order - b.sort_order);
const assignedTo = (t, k) => t.assign_all || t.kid_ids.includes(k.id);

function plan(date) {
  const out = new Map();
  for (const k of activeKids()) for (const t of db.tasks)
    if (t.kind === 'planned' && live(t) && t.days.includes(isoDow(date)) && assignedTo(t, k))
      out.set(k.id + t.id, { kid_id: k.id, task_id: t.id, slot: slotFor(t.slot, t.at_time), at_time: t.at_time, one_off: false, planned_item_id: null });
  for (const p of db.planned) {
    const t = db.tasks.find((x) => x.id === p.task_id); const k = db.kids.find((x) => x.id === p.kid_id);
    if (p.date === date && !p.removed && t && live(t) && k && k.active)
      out.set(k.id + t.id, { kid_id: k.id, task_id: t.id, slot: slotFor(p.slot, p.at_time), at_time: p.at_time, one_off: true, planned_item_id: p.id });
  }
  return [...out.values()];
}
function assignedKids(taskId, date) {
  const s = new Set(plan(date).filter((p) => p.task_id === taskId).map((p) => p.kid_id));
  const t = db.tasks.find((x) => x.id === taskId);
  if (t && t.kind === 'bonus' && live(t)) for (const k of activeKids()) if (assignedTo(t, k)) s.add(k.id);
  return [...s];
}
const comp = (taskId, kidId, date) => db.completions.find((c) => c.task_id === taskId && c.kid_id === kidId && c.date === date && c.status !== 'cancelled');
function team(t, date) {
  const a = assignedKids(t.id, date); const done = a.filter((k) => comp(t.id, k, date)).length;
  return { size: a.length, done, applies: t.team_points != null && a.length >= 2 && done >= a.length };
}
function boardItem(t, kid, date, extra) {
  const c = comp(t.id, kid.id, date); const tm = team(t, date);
  return { task_id: t.id, name: t.name, emoji: t.emoji, description: t.description, points: t.points, team_points: t.team_points,
    needs_approval: t.needs_approval, status: c ? c.status : null, approved_by_parent: c ? c.approved_by_parent : false,
    team_applies: tm.applies, team_size: tm.size, team_done: tm.done, earned: tm.applies ? t.team_points : t.points, ...extra };
}
function dayBoard(date) {
  const today = todayISO(); const d = date || today; const p = plan(d);
  return {
    today, date: d, is_today: d === today,
    kids: activeKids().map((k) => {
      const items = p.filter((x) => x.kid_id === k.id).map((x) => boardItem(db.tasks.find((t) => t.id === x.task_id), k, d,
        { slot: x.slot, at_time: x.at_time ? x.at_time.slice(0, 5) : null, one_off: x.one_off }))
        .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || (a.at_time || '99').localeCompare(b.at_time || '99') || a.name.localeCompare(b.name));
      const bonus = db.tasks.filter((t) => t.kind === 'bonus' && live(t) && assignedTo(t, k) && !p.some((x) => x.kid_id === k.id && x.task_id === t.id))
        .map((t) => boardItem(t, k, d, {})).sort((a, b) => a.points - b.points);
      const all = [...items, ...bonus];
      return { id: k.id, name: k.name, emoji: k.emoji, color: k.color, items, bonus, totals: {
        approved: all.filter((i) => i.status === 'approved').reduce((s, i) => s + i.earned, 0),
        pending: all.filter((i) => i.status === 'pending').reduce((s, i) => s + i.earned, 0),
        planned: items.length, done: items.filter((i) => i.status).length } };
    }),
  };
}

const rpc = {
  pin_status: () => ({ is_set: !!db.pin }),
  setup_pin: ({ p_new }) => !/^\d{4}$/.test(p_new) ? fail('invalid_format') : db.pin ? fail('already_set') : ((db.pin = p_new), ok()),
  verify_pin: ({ p_pin }) => { const s = check(p_pin); return s === 'ok' ? ok() : authFail(s); },
  change_pin: withPin(({ p_new }) => { if (!/^\d{4}$/.test(p_new)) return fail('invalid_format'); db.pin = p_new; return ok(); }),
  day_board: ({ p_date }) => dayBoard(p_date),
  pending_count: () => db.completions.filter((c) => c.status === 'pending').length,
  week_plan: ({ p_kid, p_from }) => [0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(p_from, i); return { date: d, items: plan(d).filter((x) => x.kid_id === p_kid).map((x) => { const t = db.tasks.find((y) => y.id === x.task_id); return { task_id: t.id, name: t.name, emoji: t.emoji, slot: x.slot, at_time: x.at_time ? x.at_time.slice(0, 5) : null, one_off: x.one_off, planned_item_id: x.planned_item_id }; }) }; }),
  complete_task: ({ p_kid, p_task }) => {
    const today = todayISO(); const t = db.tasks.find((x) => x.id === p_task && live(x)); const k = db.kids.find((x) => x.id === p_kid && x.active);
    if (!t || !k) return fail('not_found');
    if (!assignedKids(t.id, today).includes(k.id)) return fail('not_planned');
    if (comp(t.id, k.id, today)) return fail('already_done');
    const status = t.needs_approval ? 'pending' : 'approved';
    const old = db.completions.find((c) => c.task_id === t.id && c.kid_id === k.id && c.date === today);
    if (old) Object.assign(old, { status, approved_by_parent: false }); else db.completions.push({ id: uid(), task_id: t.id, kid_id: k.id, date: today, status, approved_by_parent: false, created_at: new Date().toISOString() });
    const tm = team(t, today);
    return ok({ status, team_completed: tm.applies, earned: tm.applies ? t.team_points : t.points });
  },
  uncomplete_task: ({ p_kid, p_task }) => { const c = comp(p_task, p_kid, todayISO()); if (!c) return fail('not_found'); if (c.approved_by_parent) return fail('approved_by_parent'); c.status = 'cancelled'; return ok(); },
  admin_list_kids: withPin(() => ok([...db.kids].sort((a, b) => a.sort_order - b.sort_order))),
  upsert_kid: withPin((a) => {
    if (!a.p_name?.trim() || a.p_name.trim().length > 20 || !a.p_emoji) return fail('invalid_input');
    const row = { name: a.p_name.trim(), emoji: a.p_emoji, color: a.p_color, active: a.p_active ?? true };
    if (a.p_id) { const k = db.kids.find((x) => x.id === a.p_id); Object.assign(k, row); return ok(k); }
    const k = { id: uid(), sort_order: db.kids.length, ...row }; db.kids.push(k); return ok(k);
  }),
  reorder_kids: withPin(({ p_ids }) => { p_ids.forEach((id, i) => { const k = db.kids.find((x) => x.id === id); if (k) k.sort_order = i; }); return ok(); }),
  admin_list_tasks: withPin(() => ok(db.tasks.filter((t) => !t.archived_at).sort((a, b) => a.points - b.points))),
  save_task: withPin((a) => {
    const c = db.categories.find((x) => x.id === a.p_category_id && x.kind === 'task'); if (!c) return fail('invalid_category');
    if (!a.p_name?.trim() || !(a.p_points >= 1 && a.p_points <= 999)) return fail('invalid_input');
    if (a.p_team_points != null && !(a.p_team_points > a.p_points)) return fail('invalid_input');
    if (!a.p_assign_all && !(a.p_kid_ids || []).length) return fail('invalid_input');
    if (a.p_kind === 'planned' && !(a.p_days || []).length) return fail('invalid_input');
    if (a.p_at_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.p_at_time)) return fail('invalid_input');
    const planned = a.p_kind === 'planned';
    const row = { name: a.p_name.trim(), emoji: a.p_emoji, points: a.p_points, category_id: a.p_category_id, active: a.p_active,
      description: a.p_description?.trim() || null, team_points: a.p_team_points ?? null, kind: a.p_kind, assign_all: a.p_assign_all,
      kid_ids: a.p_kid_ids || [], days: planned ? [...new Set(a.p_days)].sort() : null,
      slot: planned ? slotFor(a.p_slot, a.p_at_time) : 'anytime', at_time: planned && a.p_at_time ? a.p_at_time + ':00' : null, needs_approval: a.p_needs_approval };
    if (a.p_id) { const t = db.tasks.find((x) => x.id === a.p_id && !x.archived_at); if (!t) return fail('not_found'); Object.assign(t, row); return ok(t); }
    const t = { id: uid(), archived_at: null, ...row }; db.tasks.push(t); return ok(t);
  }),
  archive_task: withPin(({ p_id }) => { const t = db.tasks.find((x) => x.id === p_id && !x.archived_at); if (!t) return fail('not_found'); t.archived_at = new Date().toISOString(); return ok(); }),
  add_planned_items: withPin((a) => {
    if (!(a.p_kid_ids || []).length || !a.p_date) return fail('invalid_input');
    for (const kid of a.p_kid_ids) {
      const ex = db.planned.find((p) => p.task_id === a.p_task && p.kid_id === kid && p.date === a.p_date);
      const row = { slot: slotFor(a.p_slot, a.p_at_time), at_time: a.p_at_time ? a.p_at_time + ':00' : null, removed: false };
      if (ex) Object.assign(ex, row); else db.planned.push({ id: uid(), task_id: a.p_task, kid_id: kid, date: a.p_date, ...row });
    }
    return ok();
  }),
  remove_planned_item: withPin(({ p_id }) => { const p = db.planned.find((x) => x.id === p_id && !x.removed); if (!p) return fail('not_found'); p.removed = true; return ok(); }),
  list_pending: withPin(() => ok(db.completions.filter((c) => c.status === 'pending').map((c) => {
    const k = db.kids.find((x) => x.id === c.kid_id); const t = db.tasks.find((x) => x.id === c.task_id); const tm = team(t, c.date);
    return { id: c.id, date: c.date, created_at: c.created_at, kid: { id: k.id, name: k.name, emoji: k.emoji, color: k.color },
      task: { id: t.id, name: t.name, emoji: t.emoji, points: t.points, team_points: t.team_points }, team_applies: tm.applies, earned: tm.applies ? t.team_points : t.points };
  }))),
  set_completions_status: withPin(({ p_ids, p_status }) => { let u = 0; for (const c of db.completions) if (p_ids.includes(c.id) && c.status === 'pending') { c.status = p_status; c.approved_by_parent = p_status === 'approved'; u++; } return ok({ updated: u }); }),
  set_completion: withPin(({ p_kid, p_task, p_date, p_done }) => {
    const c = db.completions.find((x) => x.task_id === p_task && x.kid_id === p_kid && x.date === p_date);
    if (p_done) { if (c) Object.assign(c, { status: 'approved', approved_by_parent: true }); else db.completions.push({ id: uid(), task_id: p_task, kid_id: p_kid, date: p_date, status: 'approved', approved_by_parent: true, created_at: new Date().toISOString() }); }
    else if (c) Object.assign(c, { status: 'cancelled', approved_by_parent: false });
    return ok();
  }),
  admin_list_rewards: withPin(() => ok([...db.rewards].sort((a, b) => a.cost - b.cost))),
  upsert_reward: withPin((a) => {
    const row = { name: a.p_name.trim(), emoji: a.p_emoji, cost: a.p_cost, category_id: a.p_category_id, active: a.p_active };
    if (a.p_id) { const r = db.rewards.find((x) => x.id === a.p_id); Object.assign(r, row); return ok(r); }
    const r = { id: uid(), ...row }; db.rewards.push(r); return ok(r);
  }),
  delete_reward: withPin(({ p_id }) => { db.rewards = db.rewards.filter((r) => r.id !== p_id); return ok(); }),
  upsert_category: withPin((a) => {
    const kind = a.p_id ? db.categories.find((c) => c.id === a.p_id).kind : a.p_kind;
    if (db.categories.some((c) => c.kind === kind && c.name === a.p_name.trim() && c.id !== a.p_id)) return fail('duplicate_name');
    if (a.p_id) { const c = db.categories.find((x) => x.id === a.p_id); Object.assign(c, { name: a.p_name.trim(), emoji: a.p_emoji, color: a.p_color }); return ok(c); }
    const c = { id: uid(), kind, name: a.p_name.trim(), emoji: a.p_emoji, color: a.p_color, sort_order: 99 }; db.categories.push(c); return ok(c);
  }),
  reorder_categories: withPin(({ p_kind, p_ids }) => { p_ids.forEach((id, i) => { const c = db.categories.find((x) => x.id === id && x.kind === p_kind); if (c) c.sort_order = i; }); return ok(); }),
  delete_category: withPin(({ p_id }) => {
    const count = db.tasks.filter((t) => t.category_id === p_id && !t.archived_at).length + db.rewards.filter((r) => r.category_id === p_id).length;
    if (count) return fail('category_not_empty', { count });
    db.categories = db.categories.filter((c) => c.id !== p_id); return ok();
  }),
};

let offline = false;
async function route(r) {
  if (offline) return r.abort();
  const req = r.request();
  const url = new URL(req.url());
  const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?(\w+)/);
  let body;
  if (m[1]) {
    const fn = rpc[m[2]]; if (!fn) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'no function ' + m[2] }) });
    body = fn(req.postDataJSON() || {});
  } else if (m[2] === 'kids') body = activeKids();
  else if (m[2] === 'categories') body = db.categories;
  else body = db[m[2]].filter((x) => x.active);
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

const errors = [];
let failShot = null;
const step = async (name, fn) => { try { await fn(); console.log('✅', name); } catch (e) { console.log('❌', name, '\n   ', e.message.split('\n').slice(0, 6).join('\n    ')); errors.push(name); if (failShot) await failShot('fail-' + errors.length).catch(() => {}); } };
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const until = async (fn, msg, ms = 5000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout: ' + msg); await new Promise((r) => setTimeout(r, 50)); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.route('**/rest/v1/**', route);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
  failShot = shot;
  const typePin = async (pin) => { for (const d of pin) await page.locator('.pinpad__key', { hasText: new RegExp(`^${d}$`) }).click(); };
  const col = (name) => page.locator('.kidcol', { has: page.locator('.kidcol__name', { hasText: name }) });
  const chip = (scope, name) => scope.locator('.chip-task', { hasText: name });
  const dialogClosed = () => page.getByRole('dialog').waitFor({ state: 'detached' });
  const pickEmoji = async (search, emoji) => {
    await page.getByRole('button', { name: 'Choisir un emoji' }).click();
    await page.locator('em-emoji-picker').waitFor(); await page.waitForTimeout(500);
    await page.locator('em-emoji-picker').locator('input[type=search]').fill(search); await page.waitForTimeout(300);
    await page.locator('em-emoji-picker').locator(`button[aria-label="${emoji}"]`).first().click();
  };
  const today = todayISO();
  let lea, tom, salon, devoirs;
  // A reload forgets the in-memory PIN (by design): unlock again when the pad shows up.
  const gotoParent = async (p) => {
    await page.goto(BASE + p);
    await page.locator('.pinpad, .parent').first().waitFor();
    if (await page.locator('.pinpad').count()) { await typePin('1234'); await page.locator('.parent').waitFor(); }
  };

  await step('Empty board invites to add kids', async () => {
    await page.goto(BASE + '/');
    await page.getByText('Ajoute tes enfants').waitFor();
  });
  await step('PIN setup, then add two kids in Enfants', async () => {
    await page.getByRole('link', { name: /Ajouter un enfant/ }).click();
    await page.getByText('Choisis ton code parent').waitFor();
    await typePin('1234'); await typePin('1234');
    await page.getByText('🔓 Mode parent').waitFor();
    await page.getByRole('heading', { name: '👧 Enfants' }).waitFor();
    for (const [name, search, emoji] of [['Léa', 'renard', '🦊'], ['Tom', 'tigre', '🐯']]) {
      await page.getByRole('button', { name: /Ajouter un enfant/ }).click();
      await page.getByPlaceholder('Léa').fill(name);
      await pickEmoji(search, emoji);
      if (name === 'Tom') { await page.locator('label.swatch[title=Bleu]').click(); await page.waitForTimeout(200); await shot('02-kid-form'); }
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await dialogClosed();
    }
    lea = db.kids.find((k) => k.name === 'Léa'); tom = db.kids.find((k) => k.name === 'Tom');
    expect(lea && lea.emoji === '🦊' && tom && tom.color === 'blue', JSON.stringify(db.kids));
  });
  await step('Create a planned team mission (every day, 19:00) and an approval mission for Léa only', async () => {
    await page.getByRole('link', { name: /Missions/ }).click();
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByPlaceholder('Faire son lit').fill('Ranger le salon');
    await pickEmoji('canape', '🛋️');
    await page.locator('input[type=time]').fill('19:00');
    await page.getByText("👫 Bonus d'équipe").click();
    expect(await page.getByLabel("Bonus d'équipe").isChecked(), 'team switch on');
    await page.getByLabel("Points d'équipe", { exact: true }).fill('3');
    await page.waitForTimeout(150); await shot('04-task-form');
    await page.getByRole('button', { name: 'Enregistrer' }).click(); await dialogClosed();
    salon = db.tasks.find((t) => t.name === 'Ranger le salon');
    expect(salon && salon.kind === 'planned' && salon.slot === 'evening' && salon.team_points === 3 && salon.days.length === 7, JSON.stringify(salon));

    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByPlaceholder('Faire son lit').fill('Devoirs');
    await pickEmoji('crayon', '✏️');
    await page.getByRole('button', { name: /Léa/ }).click();
    await page.getByRole('button', { name: 'Choisir', exact: true }).click();
    for (const d of ['Samedi', 'Dimanche']) await page.getByRole('button', { name: d }).click(); // remove weekend → custom
    for (const d of ['Samedi', 'Dimanche']) await page.getByRole('button', { name: d }).click(); // add back: every day
    await page.getByRole('button', { name: /Après-midi/ }).click();
    await page.getByLabel('Plus', { exact: true }).click(); await page.getByLabel('Plus', { exact: true }).click();
    await page.getByText('🔐 Un parent doit valider').click();
    expect(await page.getByLabel('Un parent doit valider').isChecked(), 'approval switch on');
    await page.getByRole('button', { name: 'Enregistrer' }).click(); await dialogClosed();
    devoirs = db.tasks.find((t) => t.name === 'Devoirs');
    expect(devoirs && !devoirs.assign_all && devoirs.kid_ids[0] === lea.id && devoirs.needs_approval && devoirs.slot === 'afternoon' && devoirs.points === 3, JSON.stringify(devoirs));
    await page.locator('.row', { hasText: 'Devoirs' }).getByText('🔐 À valider').waitFor();
    await page.locator('.row', { hasText: 'Ranger le salon' }).getByText(/Tous les jours · 🌙 19:00/).waitFor();
    await shot('05-missions-admin');
  });
  await step('Board: one column per kid, slots, assignments', async () => {
    await page.getByRole('button', { name: /Verrouiller/ }).click();
    await col('Léa').waitFor();
    expect(await page.locator('.kidcol').count() === 2, 'two columns');
    expect(await page.locator('.parent-strip').count() === 0, 'locked: no parent strip');
    await chip(col('Léa'), 'Devoirs').waitFor();
    expect(await chip(col('Tom'), 'Devoirs').count() === 0, 'Devoirs only for Léa');
    const titles = await col('Léa').locator('.slotgroup__title').allInnerTexts();
    expect(/matin/i.test(titles[0]) && titles.some((t) => /soir/i.test(t)), titles.join('|'));
    await page.waitForTimeout(700); await shot('06-board');
  });
  await step('Tick with undo, then re-tick', async () => {
    const c = chip(col('Léa'), 'Faire son lit');
    await c.click();
    await until(() => comp(db.tasks[0].id, lea.id, today), 'completion stored');
    await c.locator('.chip-task__undo').waitFor();
    await page.waitForTimeout(250); await shot('07-ticked');
    await c.click();
    await until(() => !comp(db.tasks[0].id, lea.id, today), 'undo cancels');
    await page.waitForTimeout(300);
    await c.click();
    await until(() => comp(db.tasks[0].id, lea.id, today), 're-ticked');
    await c.locator('.chip-task__undo').waitFor({ state: 'detached', timeout: 7000 });
    await c.click();
    await page.getByText('Annuler cette mission ?').waitFor();
    await page.getByRole('button', { name: 'Non' }).or(page.getByRole('button', { name: 'Annuler', exact: true })).first().click();
    await dialogClosed();
    expect(comp(db.tasks[0].id, lea.id, today), 'still done after cancelling the confirm');
  });
  await step('Team bonus applies when both kids finish', async () => {
    await chip(col('Léa'), 'Ranger le salon').click();
    await until(() => comp(salon.id, lea.id, today), 'lea salon');
    await page.waitForTimeout(400);
    await chip(col('Tom'), 'Ranger le salon').click();
    await page.getByText(/Bonus d’équipe/).waitFor();
    await chip(col('Léa'), 'Ranger le salon').locator('.chip-task__pts.is-team', { hasText: '★ 3' }).waitFor();
    await col('Léa').locator('.kidcol__earned', { hasText: '★ 5' }).waitFor(); // 2 (lit) + 3 (team)
  });
  await step('Approval: pending ⏳, badge on lock, validate in À valider', async () => {
    await chip(col('Léa'), 'Devoirs').click();
    await chip(col('Léa'), 'Devoirs').and(page.locator('.is-pending')).waitFor();
    await col('Léa').locator('.kidcol__pending', { hasText: '⏳ 3' }).waitFor();
    await page.locator('.lock-btn__badge', { hasText: '1' }).waitFor();
    await page.locator('.lock-btn').click();
    await page.getByText('Tape le code parent').waitFor(); // locked earlier → code required again
    await typePin('1234');
    await page.getByRole('heading', { name: '✅ À valider' }).waitFor();
    await page.locator('.row', { hasText: 'Devoirs' }).waitFor();
    await shot('08-approvals');
    await page.getByRole('button', { name: /Valider Devoirs pour Léa/ }).click();
    await page.getByText("Rien à valider pour l'instant.").waitFor();
    expect(comp(devoirs.id, lea.id, today).status === 'approved', 'approved');
    await page.getByRole('button', { name: /Verrouiller/ }).click();
    await chip(col('Léa'), 'Devoirs').and(page.locator('.is-done')).waitFor();
    expect(await page.locator('.lock-btn__badge').count() === 0, 'badge gone');
  });
  await step('Kid space: Ma journée, bonus once per day, boutique', async () => {
    await page.locator('.kidcol__avatar').first().click();
    await page.getByRole('heading', { name: /Ma journée/ }).waitFor();
    await page.locator('.kidspace__name', { hasText: 'Léa' }).waitFor();
    await page.waitForTimeout(500); await shot('09-kidspace-day');
    await page.getByRole('link', { name: /Bonus/ }).click();
    const bonus = page.locator('.chip-task', { hasText: 'Mettre la table' });
    await bonus.click();
    await until(() => comp(db.tasks[2].id, lea.id, today), 'bonus done');
    await bonus.and(page.locator('.is-done')).waitFor();
    await page.waitForTimeout(300); await shot('10-kidspace-bonus');
    await page.getByRole('link', { name: /Boutique/ }).click();
    await page.getByText('Une glace').waitFor();
    await page.getByRole('link', { name: 'Retour au tableau de la famille' }).click();
    await col('Tom').waitFor();
  });
  await step('Kid space returns to the board after 2 min idle', async () => {
    await page.clock.install();
    await page.goto(BASE + `/enfant/${tom.id}`);
    await page.locator('.kidspace__name', { hasText: 'Tom' }).waitFor();
    await page.clock.fastForward(2 * 60 * 1000 + 500);
    await col('Léa').waitFor();
    expect(!page.url().includes('/enfant/'), 'back on board');
  });
  await step('Other days: kids cannot tick; navigation arrows', async () => {
    await page.goto(BASE + '/');
    await col('Tom').waitFor();
    await page.getByRole('button', { name: 'Jour suivant' }).click();
    await page.getByText("Tu peux cocher seulement aujourd'hui.", { exact: false }).first().waitFor();
    await chip(col('Tom'), 'Faire son lit').click();
    await page.getByText("Tu peux cocher seulement aujourd'hui 🙂").waitFor();
    expect(!db.completions.some((c) => c.date !== today), 'no completion on another day');
    await page.waitForTimeout(400); await shot('14-other-day');
    await page.getByRole('button', { name: /Revenir à aujourd'hui/i }).click();
    await page.locator('.daynav__badge').waitFor();
  });
  await step('Parent fixes yesterday from the board', async () => {
    await page.locator('.lock-btn').click();
    await page.getByText('Tape le code parent').waitFor().catch(() => {});
    if (await page.getByText('Tape le code parent').count()) await typePin('1234');
    await page.getByRole('link', { name: /Corriger un jour/ }).click();
    await page.locator('.parent-strip').waitFor();
    await page.getByRole('button', { name: 'Jour précédent' }).click();
    await page.waitForTimeout(400); await shot('13-parent-strip');
    await chip(col('Tom'), 'Se brosser les dents').click();
    await until(() => db.completions.some((c) => c.date === addDays(today, -1) && c.kid_id === tom.id && c.status === 'approved' && c.approved_by_parent), 'past fix stored');
  });
  await step('Week plan: add a one-off mission for tomorrow, then remove it', async () => {
    await gotoParent('/parent/missions');
    await page.getByRole('button', { name: /Planning de la semaine/ }).click();
    await page.locator('.week__day').first().waitFor();
    await page.getByRole('button', { name: /Ajouter pour un jour/ }).click();
    await page.locator('#oneoff-form select').selectOption({ label: '🍽️ Mettre la table' });
    await page.getByRole('button', { name: /Midi/ }).last().click();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.getByText('Ajouté au planning ✅').waitFor();
    const p = db.planned.find((x) => x.date === addDays(today, 1));
    expect(p && p.kid_id === lea.id && p.slot === 'noon', JSON.stringify(db.planned));
    await page.locator('.week__item.is-oneoff', { hasText: 'Mettre la table' }).waitFor();
    await page.waitForTimeout(300); await shot('11-weekplan');
    await page.locator('.week__item.is-oneoff').getByRole('button').click();
    await until(() => p.removed, 'one-off removed');
    await page.keyboard.press('Escape');
  });
  await step('Refusing a pending completion lets the kid redo it', async () => {
    await page.goto(BASE + '/');
    await col('Léa').waitFor();
    // make Devoirs pending again: parent approved → kid can't untick; use a new approval task for Tom
    const t = db.tasks.find((x) => x.name === 'Mettre la table'); t.needs_approval = true;
    await page.locator('.kidcol__bonus').last().click();
    await page.locator('.chip-task', { hasText: 'Mettre la table' }).click();
    await until(() => comp(t.id, tom.id, today)?.status === 'pending', 'tom pending');
    await gotoParent('/parent');
    await page.getByRole('button', { name: /Refuser Mettre la table pour Tom/ }).click();
    await until(() => !comp(t.id, tom.id, today), 'refused → cancelled');
  });
  await step('Archive a mission removes it from the board', async () => {
    await gotoParent('/parent/missions');
    await page.getByRole('button', { name: 'Supprimer Se brosser les dents' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await dialogClosed();
    await page.goto(BASE + '/');
    await col('Léa').waitFor();
    await page.locator('.chip-task', { hasText: 'Se brosser les dents' }).first().waitFor({ state: 'detached' });
  });
  await step('Regression: edit a reward, category with items cannot be deleted', async () => {
    await gotoParent('/parent/boutique');
    await page.getByRole('button', { name: 'Modifier Une glace' }).click();
    await page.locator('#reward-form input[type=number]').fill('12');
    await page.getByRole('button', { name: 'Enregistrer' }).click(); await dialogClosed();
    expect(db.rewards.find((r) => r.name === 'Une glace').cost === 12, 'reward cost updated');
    await page.getByRole('link', { name: /Catégories/ }).click();
    await page.getByRole('button', { name: 'Supprimer Maison' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await page.getByText(/contient \d+ élément/).waitFor();
  });
  await step('Regression: change PIN, then wrong PIN lockout', async () => {
    await page.getByRole('link', { name: /Réglages/ }).click();
    await page.getByRole('button', { name: 'Changer le code parent' }).click();
    await typePin('5678'); await page.getByText('Confirme le nouveau code').waitFor(); await typePin('5678');
    await until(() => db.pin === '5678', 'pin changed');
    await page.getByRole('button', { name: /Verrouiller/ }).click();
    await page.locator('.lock-btn').click();
    for (let i = 0; i < 5; i++) { await typePin('0000'); await page.waitForTimeout(150); }
    await page.getByText(/Trop d'essais, attends \d+ s/).waitFor();
    db.lockedUntil = 0; db.pin = '1234';
  });
  await step('Phone layout: kid picker shows one column, no horizontal scroll', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/');
    await page.locator('.kidpicker').waitFor();
    expect(await page.locator('.kidcol:visible').count() === 1, 'one visible column');
    await page.locator('.kidpicker__chip', { hasText: 'Tom' }).click();
    await page.locator('.kidcol:visible .kidcol__name', { hasText: 'Tom' }).waitFor();
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'no horizontal overflow');
    await page.waitForTimeout(500); await shot('12-board-phone');
    await page.setViewportSize({ width: 1180, height: 820 });
  });
  await step('Offline: last board still shown', async () => {
    await page.goto(BASE + '/');
    await col('Léa').waitFor(); await page.waitForTimeout(600);
    offline = true;
    await page.reload();
    await col('Léa').waitFor();
    offline = false;
  });

  await browser.close();
  console.log(errors.length ? `\n${errors.length} problem(s): ${errors.join(', ')}` : '\nALL PASSED');
  process.exit(errors.length ? 1 : 0);
})();
