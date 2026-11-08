// The cross-game flow (lab/SPEC.md §7.4), the acceptance test of the whole feature: one browser, one origin (the repo root on a static server), the
// REAL Lab at /lab/ and the REAL games (Trail Blazer on its mock engine, Build Crew, and all five booted with /lab/ blocked). From the repo root:
//   python3 -m http.server 8130 --directory .   then   BASE_URL=http://localhost:8130 SHOTS=/some/dir node lab/tools/e2e-cross.mjs
// Steps (the numbers are §7.4's):
//   1. a fresh profile "Mia" (and "Ben") on a clean origin; /lab/?labtest&player=mia seeds the quests tb-races, tb-facts, tb-win through __lab.setQuests.
//   2. earn in Trail Blazer: /trail-blazer/ (mock engine), six gates answered and the race won: the Lab pill shows XP rising, the results strip shows
//      coins and "XP to Lab LV 2", the three quest chips tick, the third completion shows "Lab crate!".
//   3. the crate opens from the strip (inside the game); the item is owned.
//   4. __lab.grantCoins(8000); /lab/ -> Build Crew tab -> buy the Dump truck (two taps); the wallet drops by 8,000.
//   5. /build-crew/ as Mia: the dump truck is selectable; Ben (no purchase) does not see it; the original machines and all ten jobs are open for both.
//   6. back in /lab/: the quests panel shows 3/3; the family board lists Mia and Ben in the picker's order with no ranks.
//   7. two devices on one in-memory sync server: A earns while offline and B buys, then both sync: the wallet and owns converge (nothing lost, nothing charged twice).
//   8. block /lab/ entirely: each of the five games boots and shows no Lab UI and no errors beyond the bridge's "[lab] unavailable" warning; Trail Blazer plays a whole race.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, memoryStore } from '../../car-jump/src/sync/protocol.mjs';

const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:8121').replace(/\/$/, '');
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = process.env.SHOTS || join(tmpdir(), 'lab-e2e-shots');
const FAMILY = { v: 1, players: [{ id: 'mia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }, { id: 'ben', name: 'Ben', color: '#3b7dd9', createdAt: 2, updatedAt: 2 }], pinHash: null, options: {}, optionsUpdatedAt: {}, removedPlayers: [] };
// the games, their folder on disk, the URL they are served at
const GAMES = { sj: ['car-jump', 'spell-jump'], tb: ['trail-blazer', 'trail-blazer'], ff: ['fraction-fright', 'fraction-fright'], ww: ['wagon-west', 'wagon-west'], bc: ['build-crew', 'build-crew'] };
const landed = (g) => existsSync(join(ROOT, GAMES[g][0], 'src/meta/labBridge.js'));
const looksLanded = (g) => existsSync(join(ROOT, GAMES[g][0], 'src/meta/labLooks.js'));

let passed = 0; const failed = [], skipped = [];
const check = (name, cond, detail = '') => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed.push(name); console.log('  FAIL ' + name + (detail ? `\n      ${detail}` : '')); } };
const skip = (name, why) => { skipped.push(name); console.log('  SKIP ' + name + ` (${why})`); };
const section = (s) => console.log('\n' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000, step = 100) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step); } }

async function newDevice(browser, name, { sw = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: sw ? 'allow' : 'block' });
  const dev = { name, ctx, page: null, online: true, errors: [] };
  await ctx.route('**/api/family/**', async (route) => {
    if (!dev.online) { await route.abort('internetdisconnected'); return; }
    const req = route.request(), u = new URL(req.url());
    const res = await handle({ method: req.method(), path: u.pathname, contentType: req.headers()['content-type'], body: req.postData() }, SERVER);
    await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
  await ctx.route('**/api/tts/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"key":false}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => dev.errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/.test(m.text())) dev.errors.push(m.text()); });
  await page.addInitScript((fam) => { if (!localStorage.getItem('spellJump.family')) localStorage.setItem('spellJump.family', JSON.stringify(fam)); }, FAMILY);
  dev.page = page;
  return dev;
}
const SERVER = memoryStore();
const view = (page) => page.evaluate(() => __lab.store.view());
const clickTab = async (page, v) => { await page.evaluate((v) => { const sh = document.querySelector('.lab-shell'); if (sh.dataset.view === v) return; if (v === 'home') document.querySelector('#lab-lead').click(); else document.querySelector(`.lab-tab[data-view="${v}"]`).click(); }, v); await page.waitForTimeout(400); };

// ---- Trail Blazer, the real game on its mock engine (the same drivers its own suites use) ----
const TB_URL = `${BASE}/trail-blazer/index.html?mock=1&nosw=1`;
const J = (page, fn, arg) => page.evaluate(fn, arg);
async function openTb(page, playerId = 'mia') {
  await page.goto(TB_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__trailBlazer, null, { timeout: 15000 });
  await J(page, (id) => { const a = window.__trailBlazer.app; a.selectPlayer(id); a.save.seen.coach = true; a.facts.opts.gates = 6; a.persistFacts(); a.persist(); }, playerId);
  await page.waitForFunction(() => window.__trailBlazer.screen === 'title', null, { timeout: 8000 });
}
async function tbAnswer(page, value) {
  for (const ch of String(value)) await page.click(`#gate .np-key[data-key="${ch}"]`);
  await page.click('#gate .np-key[data-key="go"]');
}
// a race on the mock engine, every gate answered right, until the results show; `onGate` runs once on the first gate
// (the mock engine runs the race in real time: with aiTimes [40, 44, 48] the player's own run, the gates' answers and the finish take about 59 s, so a
// 60 s budget was a coin flip on a loaded machine; the loop ends the moment the results show, so a generous budget costs nothing when it passes)
async function tbRaceToResults(page, { timeout = 150000, onFirstGate = null } = {}) {
  const end = Date.now() + timeout; let first = false;
  while (Date.now() < end) {
    const st = await J(page, () => { const T = window.__trailBlazer, g = T.gate; return { results: T.screen === 'results', gate: g.open && g.state === 'ask', answer: g.answer, index: g.index, pit: !document.querySelector('#pit-offer').hidden }; });
    if (st.results) { await sleep(500); return true; }
    if (st.pit) { await page.click('#pit-later'); continue; }
    if (st.gate) {
      if (!first && onFirstGate) { first = true; await onFirstGate(); }
      await tbAnswer(page, st.answer);
      await page.waitForFunction((i) => !window.__trailBlazer.gatePanel.isOpen || window.__trailBlazer.gate.index > i, st.index, { timeout: 4000 }).catch(() => {});
    } else await sleep(100);
  }
  return false;
}

const browser = await chromium.launch();
try {
  // ================= 1. a fresh profile and the seeded quests =================
  section('1. Mia on a clean origin, the three Trail Blazer quests seeded');
  const A = await newDevice(browser, 'A');
  const page = A.page;
  await page.goto(`${BASE}/lab/?labtest&nosw&player=mia`);
  check('Mia\'s Lab opens', !!(await until(() => page.$('.lab-room-cv'), 6000)));
  check('a clean origin: level 1, no coins', (await view(page)).level.level === 1 && (await view(page)).coins === 0);
  const seeded = await page.evaluate(() => __lab.setQuests(['tb-races', 'tb-facts', 'tb-win']));
  check('__lab.setQuests seeds tb-races, tb-facts and tb-win for today', seeded === true && (await view(page)).quests.map((q) => q.id).join() === 'tb-races,tb-facts,tb-win');

  // ================= 2. earn in Trail Blazer =================
  section('2. Earn in Trail Blazer (the real game, its mock engine): the pill, the strip, the chips, "Lab crate!"');
  await openTb(page);
  check('Trail Blazer loads the Lab and shows the Lab chip on its title', !!(await until(() => page.evaluate(() => window.__trailBlazer.lab.ready && !!document.querySelector('.lab-chipx')), 8000)));
  const q0 = await page.evaluate(() => window.__lab.store.view().quests.map((q) => q.id).join());
  check('the seeded quests reach the game (same origin, same save)', q0 === 'tb-races,tb-facts,tb-win', q0);
  let pillXp0 = null, pillTxt0 = '';
  // the mock riders are slow, so the player wins (the quest tb-win needs a first place)
  await page.evaluate(() => { window.__mockScript = { aiTimes: [40, 44, 48] }; window.__trailBlazer.app.startRide('pine-ridge', { skipCheck: true }); });
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride', null, { timeout: 8000 });
  const raced = await tbRaceToResults(page, { onFirstGate: async () => {
    pillTxt0 = ((await page.textContent('#hud-lab')) || '').replace(/\s+/g, ' ').trim();
    pillXp0 = await page.evaluate(() => { const v = window.__lab.store.view(); return v.level.into; });
  } });
  check('the race plays to the results (six gates answered, the race won)', raced === true);
  check('the Lab pill is in the race HUD (level and bar)', /Lv\s*1/i.test(pillTxt0), pillTxt0);
  const xp1 = await page.evaluate(() => window.__lab.store.view().level.into);
  check('XP rose over the race (the pill\'s bar moved)', pillXp0 !== null && xp1 > pillXp0, `${pillXp0} -> ${xp1}`);
  await page.screenshot({ path: join(SHOTS, 'e2e-2-tb-results.png') }).catch(() => {});
  const lineEl = await until(() => page.$('#res-lab #lab-strip-line'), 6000);
  const line = lineEl ? (await lineEl.textContent()).trim() : '';
  check('the results strip shows coins and "XP to Lab LV 2"', /Lab coins/.test(line) && /XP to Lab LV \d+/.test(line), line);
  check('the three quest chips tick', (await page.locator('#res-lab .lab-qchip.done').count()) === 3, `done chips: ${await page.locator('#res-lab .lab-qchip.done').count()}`);
  check('the third completion shows "Lab crate!"', (await page.locator('#res-lab #lab-strip-crate').count()) === 1 && /Lab crate!/.test(await page.textContent('#res-lab #lab-strip-crate')));

  // ================= 3. the crate opens =================
  section('3. The crate opens from the results strip');
  await page.click('#res-lab #lab-strip-crate');
  check('the overlay opens on the crate', !!(await until(() => page.$('.lab-overlay .lab-shell[data-view="crate"]'), 4000)));
  await page.click('.lab-overlay #crate-open');
  check('the reveal names the item', !!(await until(() => page.$('.lab-overlay #crate-name'), 4000)));
  const got = await page.evaluate(() => window.__lab.store.view());
  check('the item is granted (lab.owns)', got.owned.length >= 1 && got.crates.waiting === 0, JSON.stringify({ owned: got.owned, waiting: got.crates.waiting }));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.screenshot({ path: join(SHOTS, 'e2e-3-crate-opened.png') }).catch(() => {});
  // the Lab page must see the same save
  await page.goto(`${BASE}/lab/?labtest&nosw&player=mia`);
  await page.waitForSelector('.lab-room-cv');

  // ================= 4. buy the dump truck =================
  section('4. Build Crew tab: the dump truck, two taps, 8,000 coins');
  if (!looksLanded('bc')) await page.evaluate(() => __lab.setLooks('bc', ['bc.veh.dump', 'bc.veh.fork', 'bc.bp.lighthouse', 'bc.bp.windmill', 'bc.bp.castlegate', 'bc.bp.arch']));
  else console.log("  info  Build Crew's own labLooks.js is used (no stand-in)");
  await page.evaluate(() => __lab.grantCoins(8000));
  const before = (await view(page)).coins;
  await clickTab(page, 'shop');
  await page.click('.lab-seg-btn[data-tab="bc"]'); await page.waitForTimeout(400);
  const hasTruck = await page.locator('[data-item="bc.veh.dump"]').count();
  check('Build Crew\'s shelf lists the dump truck', hasTruck === 1, looksLanded('bc') ? 'bc/labLooks.js does not list bc.veh.dump in LOOKS_READY' : '');
  if (hasTruck) {
    await page.locator('[data-item="bc.veh.dump"] [data-act="buy"]').click(); await page.waitForTimeout(200);
    await page.locator('[data-item="bc.veh.dump"] [data-act="confirm"]').click(); await page.waitForTimeout(500);
    check('the wallet drops by 8,000', (await view(page)).coins === before - 8000, `${before} -> ${(await view(page)).coins}`);
    check('lab.owns("bc.veh.dump")', await page.evaluate(async () => (await import('/lab/src/index.js')).lab.owns('bc.veh.dump')));
  }

  // ================= 5. Build Crew sees it =================
  section('5. /build-crew/: the dump truck for Mia, not for Ben; the original machines and ten jobs open for both');
  {
    // the same origin, so Build Crew reads the Lab save this very page just charged 8,000 coins for
    // Build Crew 0.7 resumes the same builder after a reload in the same tab (sessionStorage 'buildCrew.resume', set on pagehide), so a second
    // goto would skip "Who's building?" and open Mia again. Clear the key at the start of every document so each visit shows the picker.
    await page.addInitScript(() => { try { sessionStorage.removeItem('buildCrew.resume'); } catch (_) {} });
    const machinesOf = async (name) => {
      await page.goto(`${BASE}/build-crew/?test=1&nosw=1`);
      await page.waitForFunction(() => window.__buildCrew, null, { timeout: 60000 });
      await page.locator('[data-profile]').filter({ hasText: name }).first().click();
      await page.waitForFunction(() => window.__buildCrew.state.screen === 'title' && window.__buildCrew.state.playerId, null, { timeout: 15000 });
      await page.waitForFunction(() => window.__lab && document.querySelector('#title-chip-host .lab-chipx'), null, { timeout: 20000 });
      await page.locator('#jobs').click();
      const board = await page.evaluate(() => ({
        jobs: [...document.querySelectorAll('.job-grid:not(.blueprints):not(.vehicles) .job-tile')].map((e) => ({ id: e.dataset.job, disabled: e.disabled })),
        dump: (document.querySelector('[data-vehicle="dump"]') || {}).dataset?.owned,
        fork: (document.querySelector('[data-vehicle="fork"]') || {}).dataset?.owned,
      }));
      await page.screenshot({ path: join(SHOTS, `e2e-5-bc-board-${name}.png`) }).catch(() => {});
      await page.locator('#modal-close').click();
      await page.locator('#sandbox').click();
      await page.waitForFunction(() => window.__buildCrew.state.screen === 'play' || window.__buildCrew.state.machines.length > 0, null, { timeout: 15000 });
      const kinds = await page.evaluate(() => window.__buildCrew.state.machines.map((m) => m.kind));
      const buttons = await page.locator('[data-machine]').evaluateAll((els) => els.map((e) => e.dataset.machine));
      await page.screenshot({ path: join(SHOTS, `e2e-5-bc-sandbox-${name}.png`) }).catch(() => {});
      return { board, kinds, buttons };
    };
    const mia = await machinesOf('Mia');
    check('Build Crew, as Mia: the Dump truck is in the sandbox and selectable', mia.kinds.includes('dump') && mia.buttons.includes('dump'), JSON.stringify(mia));
    check('Build Crew, as Mia: the job board shows the Dump truck as owned and the Forklift (not bought) as locked', mia.board.dump === 'true' && mia.board.fork === 'false', JSON.stringify(mia.board));
    const ben = await machinesOf('Ben');
    check('Build Crew, as Ben (no purchase): no Dump truck in the sandbox, none to select', !ben.kinds.includes('dump') && !ben.buttons.includes('dump'), JSON.stringify(ben));
    check('Build Crew, as Ben: the job board shows the Dump truck as locked', ben.board.dump === 'false', JSON.stringify(ben.board));
    check('the original machines are the same for both (the Lab adds only the Dump truck)', ben.kinds.includes('skid') && mia.kinds.filter((k) => k !== 'dump').join() === ben.kinds.join(), `${mia.kinds} / ${ben.kinds}`);
    // Build Crew grew from ten jobs to twenty (the harbor and hillside sites, 0.6); the page runs in ?test=1 on localhost, which opens every job.
    // The Lab's promise (D14) is that the original ten stay open, so check those by id, and that the board lists every job Build Crew has.
    const { JOB_COUNT } = await import('../../build-crew/src/content.mjs');
    check(`all the jobs are open for both (the original ten included; Build Crew now has ${JOB_COUNT})`, [mia, ben].every((x) => x.board.jobs.length === JOB_COUNT && x.board.jobs.every((j) => !j.disabled) && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((id) => x.board.jobs.some((j) => String(j.id) === String(id)))), JSON.stringify([mia.board.jobs.length, ben.board.jobs.length]));
    await page.goto(`${BASE}/lab/?labtest&nosw&player=mia`);
    await page.waitForSelector('.lab-room-cv');
  }

  // ================= 6. back in /lab/: quests 3/3 and the board =================
  section('6. Back in the Lab: quests 3/3 and the family board in the picker\'s order');
  await clickTab(page, 'quests');
  check('the quests panel shows all three done', (await page.locator('.lab-quest.done').count()) === 3);
  await clickTab(page, 'family');
  const order = await page.evaluate(() => [...document.querySelectorAll('.lab-person')].map((p) => p.dataset.player));
  check('the board lists Mia then Ben (the picker\'s order)', order.join() === 'mia,ben', order.join());
  const miaXp = (await page.textContent('.lab-person[data-player="mia"] .lab-person-xp')).trim();
  check('the board shows Mia\'s XP and no ranks', /XP this week$/.test(miaXp) && !/\b(1st|2nd|3rd)\b|rank/i.test(await page.innerText('.lab-board')), miaXp);

  // ================= 7. two devices, one sync server =================
  section('7. Two devices on one in-memory sync server: offline earnings and a purchase converge');
  {
    const D1 = await newDevice(browser, 'D1'), D2 = await newDevice(browser, 'D2');
    for (const d of [D1, D2]) { await d.page.goto(`${BASE}/lab/?labtest&nosw&player=mia`); await d.page.waitForSelector('.lab-room-cv'); }
    const created = await D1.page.evaluate(() => window.__labSync.create());
    check('device 1 creates a family code', created.ok === true && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(created.code), JSON.stringify(created));
    await D1.page.evaluate(() => __lab.grantCoins(1000));
    await D1.page.evaluate(() => window.__labSync.pushNow());
    const joined = await D2.page.evaluate((code) => window.__labSync.join(code), created.code);
    check('device 2 joins it', joined.ok === true, JSON.stringify(joined));
    await sleep(300);
    check('device 2 sees the 1,000 coins', (await view(D2.page)).coins === 1000, String((await view(D2.page)).coins));
    // D1 goes offline and earns; D2 buys (online) a different item from the same balance; D1 buys offline too
    D1.online = false;
    await D1.page.evaluate(() => { __lab.grantCoins(500); __lab.store.buy('av.hat.sunhat'); });
    await D2.page.evaluate(() => { __lab.store.buy('av.hat.headband'); return window.__labSync.pushNow(); });
    D1.online = true;
    for (let i = 0; i < 2; i++) for (const d of [D1, D2]) await d.page.evaluate(() => window.__labSync.pullNow().then(() => window.__labSync.pushNow()));
    await sleep(300);
    const v1 = await view(D1.page), v2 = await view(D2.page);
    check('both purchases survive on both devices', ['av.hat.sunhat', 'av.hat.headband'].every((id) => v1.owned.includes(id) && v2.owned.includes(id)), JSON.stringify([v1.owned, v2.owned]));
    check('the wallet is the same on both and nothing was lost or charged twice (1,000 + 500 - 300 - 300 = 900)', v1.coins === 900 && v2.coins === 900, `${v1.coins} / ${v2.coins}`);
    check('no console errors on either device', D1.errors.length === 0 && D2.errors.length === 0, [...D1.errors, ...D2.errors].slice(0, 3).join(' | '));
    await D1.ctx.close(); await D2.ctx.close();
  }

  // ================= 8. /lab/ blocked: every game still boots, with no Lab UI =================
  section('8. With /lab/ blocked every game boots and shows no Lab UI');
  for (const [g, [folder, url]] of Object.entries(GAMES)) {
    if (!existsSync(join(ROOT, folder, 'index.html'))) { skip(`${folder} boots`, 'no index.html'); continue; }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    await ctx.route('**/lab/**', (route) => route.abort('blockedbyclient'));
    const p = await ctx.newPage();
    const errs = [], warns = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'warning' && /\[lab\]/.test(m.text())) warns.push(m.text()); else if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|fonts\./.test(m.text())) errs.push(m.text()); });
    await p.addInitScript((fam) => { if (!localStorage.getItem('spellJump.family')) localStorage.setItem('spellJump.family', JSON.stringify(fam)); }, FAMILY);
    await p.goto(`${BASE}/${url}/?nosw=1&mock=1`, { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(1500);
    const lab = await p.evaluate(() => document.querySelectorAll('.lab-root, .lab-overlay, .lab-hud:not(:empty), #lab-strip-line').length);
    check(`${folder}: boots with /lab/ blocked, no Lab UI, no page errors`, errs.length === 0 && lab === 0, errs.slice(0, 2).join(' | '));
    if (g === 'tb') {
      await openTb(p);
      check('trail-blazer: with /lab/ blocked the title has no Lab chip', await p.evaluate(() => !window.__trailBlazer.lab.ready && !document.querySelector('.lab-chipx')));
      await p.evaluate(() => window.__trailBlazer.app.startRide('pine-ridge', { skipCheck: true }));
      await p.waitForFunction(() => window.__trailBlazer.screen === 'ride', null, { timeout: 8000 });
      check('trail-blazer: a whole race plays to the results with /lab/ blocked', (await tbRaceToResults(p)) === true);
      check('trail-blazer: no Lab strip on the results, the race still paid its own cash', await p.evaluate(() => document.querySelector('#res-lab').children.length === 0 && window.__trailBlazer.app.save.cash > 0));
    }
    check(`${folder}: the only console noise is the bridge's "[lab] unavailable" warning (${warns.length} warning, ${errs.length} errors)`, warns.every((w) => /\[lab\] unavailable/.test(w)) && errs.length === 0, [...warns, ...errs].slice(0, 2).join(' | '));
    await ctx.close();
  }
  check('no console errors on the main device', A.errors.length === 0, A.errors.slice(0, 3).join(' | '));
} finally { await browser.close(); }

console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped`);
if (skipped.length) console.log('SKIPPED (for the orchestrator):\n- ' + skipped.join('\n- '));
if (failed.length) { console.log('FAILED:\n- ' + failed.join('\n- ')); process.exit(1); }
console.log(skipped.length ? 'LAB CROSS-GAME FLOW PASSED (with SKIPs listed above)' : 'LAB CROSS-GAME FLOW PASSED');
