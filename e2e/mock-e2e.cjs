// End-to-end UI test against an in-memory mock of the kids_rewards Supabase API.
// Usage: npm run build && npx vite preview --port 4173  (then, in another shell)
//        node e2e/mock-e2e.cjs <screenshot-dir>     (needs Playwright + Chromium installed)
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = process.argv[2];
const BASE = 'http://localhost:4173';
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

// ---- mock DB ----
const db = { categories: [], tasks: [], rewards: [], pin: null, fails: 0, lockedUntil: 0 };
const cat = (kind, name, emoji, color, sort) => { const c = { id: uid(), kind, name, emoji, color, sort_order: sort }; db.categories.push(c); return c; };
const maison = cat('task', 'Maison', '🏠', 'blue', 0), ecole = cat('task', 'École', '🎒', 'yellow', 1), hyg = cat('task', 'Hygiène', '🧼', 'mint', 2);
cat('task', 'Gentillesse', '💛', 'pink', 3);
const ecran = cat('reward', 'Écran', '📺', 'lavender', 0), fri = cat('reward', 'Friandise', '🍭', 'peach', 1), sortie = cat('reward', 'Sortie', '🎡', 'mint', 2), jouet = cat('reward', 'Jouet', '🧸', 'yellow', 3);
const task = (name, emoji, points, frequency, c, extra = {}) => db.tasks.push({ id: uid(), name, emoji, points, frequency, category_id: c.id, active: true, description: null, team_points: null, ...extra });
task('Faire son lit', '🛏️', 2, 'daily', maison, { description: 'Couette bien tirée, pyjama rangé', team_points: 3 }); task('Mettre la table', '🍽️', 3, 'anytime', maison);
task('Lire 15 minutes', '📚', 3, 'daily', ecole); task('Se brosser les dents', '🦷', 1, 'daily', hyg);
const rew = (name, emoji, cost, c) => db.rewards.push({ id: uid(), name, emoji, cost, category_id: c.id, active: true });
rew('30 min de tablette', '📱', 10, ecran); rew('Choisir le film du soir', '🎬', 20, ecran); rew('Une glace', '🍦', 15, fri);
rew("Sortie au parc d'attractions", '🎠', 200, sortie); rew('Petit jouet surprise', '🎁', 50, jouet);

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
const FREQ = ['daily', 'weekly', 'anytime', 'once'];
const rpc = {
  pin_status: () => ({ is_set: !!db.pin }),
  setup_pin: ({ p_new }) => !/^\d{4}$/.test(p_new) ? fail('invalid_format') : db.pin ? fail('already_set') : ((db.pin = p_new), ok()),
  verify_pin: ({ p_pin }) => { const s = check(p_pin); return s === 'ok' ? ok() : authFail(s); },
  change_pin: ({ p_pin, p_new }) => { const s = check(p_pin); if (s !== 'ok') return authFail(s); if (!/^\d{4}$/.test(p_new)) return fail('invalid_format'); db.pin = p_new; return ok(); },
  admin_list_tasks: ({ p_pin }) => { const s = check(p_pin); return s === 'ok' ? ok([...db.tasks].sort((a, b) => a.points - b.points)) : authFail(s); },
  admin_list_rewards: ({ p_pin }) => { const s = check(p_pin); return s === 'ok' ? ok([...db.rewards].sort((a, b) => a.cost - b.cost)) : authFail(s); },
  upsert_task: (a) => {
    const s = check(a.p_pin); if (s !== 'ok') return authFail(s);
    const c = db.categories.find((c) => c.id === a.p_category_id && c.kind === 'task'); if (!c) return fail('invalid_category');
    if (!(a.p_points >= 1 && a.p_points <= 999) || !FREQ.includes(a.p_frequency) || !a.p_name?.trim()) return fail('invalid_input');
    if (a.p_team_points != null && !(a.p_team_points > a.p_points)) return fail('invalid_input');
    if (a.p_description != null && a.p_description.length > 120) return fail('invalid_input');
    const row = { name: a.p_name.trim(), emoji: a.p_emoji, points: a.p_points, category_id: a.p_category_id, frequency: a.p_frequency, active: a.p_active, description: a.p_description?.trim() || null, team_points: a.p_team_points ?? null };
    if (a.p_id) { const t = db.tasks.find((t) => t.id === a.p_id); if (!t) return fail('not_found'); Object.assign(t, row); return ok(t); }
    const t = { id: uid(), ...row }; db.tasks.push(t); return ok(t);
  },
  delete_task: ({ p_pin, p_id }) => { const s = check(p_pin); if (s !== 'ok') return authFail(s); const i = db.tasks.findIndex((t) => t.id === p_id); if (i < 0) return fail('not_found'); db.tasks.splice(i, 1); return ok(); },
  upsert_reward: (a) => {
    const s = check(a.p_pin); if (s !== 'ok') return authFail(s);
    const c = db.categories.find((c) => c.id === a.p_category_id && c.kind === 'reward'); if (!c) return fail('invalid_category');
    const row = { name: a.p_name.trim(), emoji: a.p_emoji, cost: a.p_cost, category_id: a.p_category_id, active: a.p_active };
    if (a.p_id) { const r = db.rewards.find((r) => r.id === a.p_id); Object.assign(r, row); return ok(r); }
    const r = { id: uid(), ...row }; db.rewards.push(r); return ok(r);
  },
  delete_reward: ({ p_pin, p_id }) => { const s = check(p_pin); if (s !== 'ok') return authFail(s); db.rewards = db.rewards.filter((r) => r.id !== p_id); return ok(); },
  upsert_category: (a) => {
    const s = check(a.p_pin); if (s !== 'ok') return authFail(s);
    const kind = a.p_id ? db.categories.find((c) => c.id === a.p_id).kind : a.p_kind;
    if (db.categories.some((c) => c.kind === kind && c.name === a.p_name.trim() && c.id !== a.p_id)) return fail('duplicate_name');
    if (a.p_id) { const c = db.categories.find((c) => c.id === a.p_id); Object.assign(c, { name: a.p_name.trim(), emoji: a.p_emoji, color: a.p_color }); return ok(c); }
    const max = Math.max(-1, ...db.categories.filter((c) => c.kind === kind).map((c) => c.sort_order));
    const c = { id: uid(), kind, name: a.p_name.trim(), emoji: a.p_emoji, color: a.p_color, sort_order: max + 1 }; db.categories.push(c); return ok(c);
  },
  reorder_categories: ({ p_pin, p_kind, p_ids }) => { const s = check(p_pin); if (s !== 'ok') return authFail(s); p_ids.forEach((id, i) => { const c = db.categories.find((c) => c.id === id && c.kind === p_kind); if (c) c.sort_order = i; }); return ok(); },
  delete_category: ({ p_pin, p_id }) => {
    const s = check(p_pin); if (s !== 'ok') return authFail(s);
    const count = db.tasks.filter((t) => t.category_id === p_id).length + db.rewards.filter((r) => r.category_id === p_id).length;
    if (count) return fail('category_not_empty', { count });
    db.categories = db.categories.filter((c) => c.id !== p_id); return ok();
  },
};

async function route(r) {
  const req = r.request();
  const url = new URL(req.url());
  const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?(\w+)/);
  if (req.headers()['accept-profile'] && req.headers()['accept-profile'] !== 'kids_rewards') throw new Error('wrong schema');
  let body;
  if (m[1]) {
    const fn = rpc[m[2]]; if (!fn) return r.fulfill({ status: 404, body: '{}' });
    body = fn(req.postDataJSON() || {});
    if (process.env.DBG) console.log('    rpc', m[2], JSON.stringify(req.postDataJSON()).slice(0,120), '->', JSON.stringify(body).slice(0,80));
  } else {
    const rows = db[m[2]];
    body = (m[2] === 'categories' ? rows : rows.filter((x) => x.active)).map((x) => ({ ...x }));
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

const errors = [];
const step = async (name, fn) => { try { await fn(); console.log('✅', name); } catch (e) { console.log('❌', name, '\n   ', e.message.split('\n').slice(0,6).join('\n    ')); errors.push(name); } };
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const until = async (fn, msg, ms = 5000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout: ' + msg); await new Promise((r) => setTimeout(r, 50)); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.route('**/rest/v1/**', route);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('[rpc') && console.log('   console:', m.text()));
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
  const typePin = async (pin) => { for (const d of pin) await page.locator('.pinpad__key', { hasText: new RegExp(`^${d}$`) }).click(); };

  await step('Missions page groups tasks by category', async () => {
    await page.goto(BASE + '/');
    await page.getByText('Faire son lit').waitFor();
    const groups = await page.locator('.group__title').allTextContents();
    expect(groups.join('|') === '🏠Maison|🎒École|🧼Hygiène', 'groups: ' + groups.join('|'));
    expect(await page.getByText('Chaque jour').count() === 3, 'frequency tags');
    await page.waitForTimeout(600); await shot('01-missions');
  });
  await step('Mission card shows description and team badge', async () => {
    const card = page.locator('.card', { hasText: 'Faire son lit' });
    await card.getByText('Couette bien tirée, pyjama rangé').waitFor();
    await card.locator('.team', { hasText: '★ 3' }).waitFor();
    expect(await page.locator('.card', { hasText: 'Mettre la table' }).locator('.team').count() === 0, 'no team badge without team points');
  });
  await step('Boutique sorted by cost in categories', async () => {
    await page.getByRole('link', { name: /La boutique/ }).click();
    await page.getByText('Une glace').waitFor();
    const names = await page.locator('.group').first().locator('.card__name').allTextContents();
    expect(names.join('|') === '30 min de tablette|Choisir le film du soir', names.join('|'));
    await page.waitForTimeout(600); await shot('02-boutique');
  });
  await step('Phone layout', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300); await shot('03-boutique-phone');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(!overflow, 'horizontal overflow on phone');
    await page.setViewportSize({ width: 1024, height: 768 });
  });
  await step('First PIN setup (mismatch then success)', async () => {
    await page.locator('.lock-btn').click();
    await page.getByText('Choisis ton code parent').waitFor();
    await shot('04-setup');
    await typePin('1234'); await page.getByText('Confirme ton code').waitFor();
    await typePin('1111'); await page.getByText('Les codes ne correspondent pas').waitFor();
    await typePin('1234'); await typePin('1234');
    await page.getByText('🔓 Mode parent').waitFor();
    expect(db.pin === '1234', 'pin stored');
  });
  await step('Admin missions list incl. hidden toggle', async () => {
    await page.getByText('Se brosser les dents').waitFor();
    await page.waitForTimeout(700); await shot('05-admin-missions');
    await page.getByLabel('Faire son lit visible').click({ force: true });
    await page.getByText('Masqué', { exact: true }).waitFor();
    expect(db.tasks.find((t) => t.name === 'Faire son lit').active === false, 'inactive');
  });
  await step('Create a mission with emoji picker', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByPlaceholder('Faire son lit').fill('Ranger sa chambre');
    await page.getByRole('button', { name: 'Choisir un emoji' }).click();
    await page.locator('em-emoji-picker').waitFor();
    await page.waitForTimeout(800);
    await shot('06-emoji-picker');
    const search = page.locator('em-emoji-picker').locator('input[type=search]');
    await search.fill('chaussette');
    await page.waitForTimeout(400);
    await page.locator('em-emoji-picker').locator('button[aria-label="🧦"]').first().click();
    await page.getByLabel('Plus').click(); await page.getByLabel('Plus').click();
    await page.locator('label.chip', { hasText: 'Chaque semaine' }).click();
    await shot('07-task-form');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    const t = db.tasks.find((t) => t.name === 'Ranger sa chambre');
    expect(t && t.points === 3 && t.frequency === 'weekly' && t.emoji, JSON.stringify(t));
    console.log('    emoji picked:', t.emoji);
  });
  await step('Create a team mission with description (team must exceed solo points)', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByPlaceholder('Faire son lit').fill('Ranger le salon');
    await page.getByRole('button', { name: 'Choisir un emoji' }).click();
    await page.locator('em-emoji-picker').waitFor(); await page.waitForTimeout(600);
    await page.locator('em-emoji-picker').locator('input[type=search]').fill('canape');
    await page.waitForTimeout(400);
    await page.locator('em-emoji-picker').locator('button[aria-label="🛋️"]').first().click();
    await page.locator('textarea').fill('Coussins en place, jouets dans le bac');
    await page.getByLabel("Bonus d'équipe").check({ force: true });
    await page.getByText('Seul : ★ 1 · Tous ensemble : ★ 2 chacun').waitFor();
    await page.getByLabel("Points d'équipe").fill('1');
    await page.getByText('Doit être plus grand').waitFor();
    expect(await page.getByRole('button', { name: 'Enregistrer' }).isDisabled(), 'save disabled when team <= solo');
    await page.getByLabel("Points d'équipe").fill('2');
    await page.waitForTimeout(200); await shot('07b-team-form');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    const t = db.tasks.find((t) => t.name === 'Ranger le salon');
    expect(t && t.points === 1 && t.team_points === 2 && t.description === 'Coussins en place, jouets dans le bac', JSON.stringify(t));
    await page.locator('.row', { hasText: 'Ranger le salon' }).locator('.team', { hasText: '★ 2' }).waitFor();
    // editing keeps the fields, and turning the bonus off clears it
    await page.getByRole('button', { name: 'Modifier Ranger le salon' }).click();
    expect(await page.locator('textarea').inputValue() === 'Coussins en place, jouets dans le bac', 'description prefilled');
    await page.getByLabel("Bonus d'équipe").uncheck({ force: true });
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await until(() => db.tasks.find((t) => t.name === 'Ranger le salon').team_points === null, 'team cleared');
  });
  await step('Edit then delete a reward', async () => {
    await page.getByRole('link', { name: /Boutique/ }).click();
    await page.getByRole('button', { name: 'Modifier Une glace' }).click();
    await page.locator('#item-form input[type=number]').fill('12');
    console.log('    input value:', await page.locator('#item-form input[type=number]').inputValue());
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    expect(db.rewards.find((r) => r.name === 'Une glace').cost === 12, 'cost updated: ' + JSON.stringify(db.rewards.find((r) => r.name === 'Une glace')) + ' input=' + await page.locator('#item-form input[type=number]').count());
    await page.getByRole('button', { name: 'Supprimer Petit jouet surprise' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await page.getByText('Supprimé 🗑️').waitFor();
    expect(!db.rewards.some((r) => r.name === 'Petit jouet surprise'), 'deleted');
  });
  await step('Categories: reorder, create, block non-empty delete, delete empty', async () => {
    await page.getByRole('link', { name: /Catégories/ }).click();
    await page.getByRole('button', { name: 'Descendre Maison' }).click();
    await page.waitForFunction(() => document.querySelector('.rows .row__name')?.textContent === 'École');
    await page.getByRole('button', { name: /Nouvelle catégorie/ }).click();
    await page.getByPlaceholder('Maison').fill('Jardin');
    await page.getByRole('button', { name: 'Choisir un emoji' }).click();
    await page.locator('em-emoji-picker').waitFor(); await page.waitForTimeout(600);
    await page.locator('em-emoji-picker').locator('input[type=search]').fill('arbre');
    await page.waitForTimeout(400);
    await page.locator('em-emoji-picker').locator('button[aria-label="🌳"]').first().click();
    await page.locator('label.swatch[title=Lavande]').click();
    expect(await page.getByLabel('Lavande').isChecked(), 'lavender selected');
    await shot('08-category-form');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    expect(db.categories.find((c) => c.name === 'Jardin')?.color === 'lavender', 'jardin lavender');
    await page.getByRole('button', { name: 'Supprimer École' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await page.getByText(/contient 1 élément/).waitFor();
    await page.getByRole('button', { name: 'Supprimer Jardin' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await page.getByText('Catégorie supprimée 🗑️').waitFor();
    await shot('09-categories');
  });
  await step('Change PIN in Réglages', async () => {
    await page.getByRole('link', { name: /Réglages/ }).click();
    await page.getByText('select kids_rewards.reset_pin();').waitFor();
    await shot('10-settings');
    await page.getByRole('button', { name: 'Changer le code parent' }).click();
    await typePin('5678'); await page.getByText('Confirme le nouveau code').waitFor();
    await typePin('5678');
    await page.getByText('Code modifié ✅').waitFor();
    expect(db.pin === '5678', 'pin changed');
    // still unlocked, writes use the new pin
    await page.getByRole('link', { name: /Missions/ }).first().click();
    await page.getByLabel('Faire son lit visible').click({ force: true });
    await until(() => db.tasks.find((t) => t.name === 'Faire son lit').active === true, 'write with new pin');
    expect(true, 'write with new pin ' + JSON.stringify(db.tasks.find((t) => t.name === 'Faire son lit')));
  });
  await step('Kids view reflects changes (hidden task gone, new task present)', async () => {
    db.tasks.find((t) => t.name === 'Mettre la table').active = false;
    await page.getByRole('button', { name: /Verrouiller/ }).click();
    await page.getByText('Ranger sa chambre').waitFor();
    expect(await page.getByText('Mettre la table').count() === 0, 'inactive hidden');
    const groups = await page.locator('.group__title').allTextContents();
    expect(groups[0].includes('École'), 'reordered: ' + groups.join('|'));
    await page.waitForTimeout(600); await shot('11-missions-after');
  });
  await step('Unlock: wrong PIN, lockout countdown, recovery help', async () => {
    await page.locator('.lock-btn').click();
    await page.getByText('Tape le code parent').waitFor();
    await typePin('0000'); await page.getByText('Code incorrect').waitFor();
    for (let i = 0; i < 4; i++) { await typePin('0000'); await page.waitForTimeout(150); }
    await page.getByText(/Trop d'essais, attends \d+ s/).waitFor();
    await shot('12-locked');
    await page.getByRole('button', { name: 'Code oublié ?' }).click();
    await page.getByText('Copier la commande').waitFor();
    await shot('13-recovery');
    await page.keyboard.press('Escape');
    db.lockedUntil = 0;
  });
  await step('Idle auto-lock after 5 minutes', async () => {
    await page.reload();
    await page.clock.install();
    await page.getByText('Tape le code parent').waitFor();
    await typePin('5678');
    await page.getByText('🔓 Mode parent').waitFor();
    await page.clock.fastForward(5 * 60 * 1000 + 1000);
    await page.getByText('Mes missions').first().waitFor();
    expect(!page.url().includes('/parent'), 'returned to kids view');
  });
  await step('Auth error while unlocked locks parent mode', async () => {
    await page.reload();
    await page.locator('.lock-btn').click();
    await typePin('5678');
    await page.getByText('🔓 Mode parent').waitFor();
    db.pin = null; // simulate SQL reset_pin()
    await page.getByLabel('Faire son lit visible').click({ force: true });
    await page.getByText(/Mode parent verrouillé/).waitFor();
    expect(!page.url().includes('/parent'), 'locked out');
    await page.locator('.lock-btn').click();
    await page.getByText('Choisis ton code parent').waitFor();
  });
  await step('Offline: cached lists still shown', async () => {
    await page.goto(BASE + '/');
    await page.getByText('Ranger sa chambre').waitFor();
    await page.waitForTimeout(500);
    await ctx.unroute('**/rest/v1/**');
    await ctx.route('**/rest/v1/**', (r) => r.abort());
    await page.reload();
    await page.getByText('Ranger sa chambre').waitFor();
    await page.waitForTimeout(500); await shot('14-offline');
  });

  await browser.close();
  console.log(errors.length ? `\n${errors.length} problem(s): ${errors.join(', ')}` : '\nALL PASSED');
  process.exit(errors.length ? 1 : 0);
})();
