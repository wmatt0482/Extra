// The cross-game flow (lab/SPEC.md §7.4), a SKELETON: it drives /lab/ and stand-ins for the games, and says SKIP for every step that needs a game
// stream's work (a game's labBridge.js, a game's labLooks.js, Build Crew's dump truck). The orchestrator finishes it once the games land: each
// `needs(game)` step has a TODO(orchestrator) where the real game is driven instead of the stand-in. From the repo root, static server on the root:
//   python3 -m http.server 8121 --directory .   then   BASE_URL=http://localhost:8121 node lab/tools/e2e-cross.mjs
// Steps (the numbers are §7.4's):
//   1. a fresh profile "Mia" (and "Ben") on a clean origin; /lab/?labtest&player=mia seeds the quests tb-races, tb-facts, tb-win through __lab.setQuests.
//   2. earn in Trail Blazer: the Lab pill shows XP rising, the results strip shows coins and "XP to level 2", the three quest chips tick, the third
//      completion shows "Lab crate!".                                   [stand-in: lab.report from a fake game page; real: /trail-blazer/ on its mock engine]
//   3. the crate opens from the strip; the item is owned.              [real Lab UI]
//   4. __lab.grantCoins(8000); /lab/ -> Build Crew tab -> buy the Dump truck (two taps); the wallet drops by 8,000.   [real Lab UI; looks stood in until bc/labLooks.js lands]
//   5. /build-crew/ as Mia: the dump truck is selectable; Ben (no purchase) does not see it; the three original machines and all ten jobs are open for both.   [SKIP until Build Crew lands]
//   6. back in /lab/: the quests panel shows 3/3; the family board lists Mia and Ben in the picker's order with no ranks.   [real Lab UI]
//   7. two devices on one in-memory sync server: A earns while offline and B buys, then both sync: the wallet and owns converge (nothing lost, nothing charged twice).   [real sync]
//   8. block /lab/ entirely: each of the five games boots, plays one round and shows no Lab UI and no errors beyond the bridge's one warning.   [boot + no Lab UI now; "plays one round" is TODO(orchestrator)]
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
  section('2. Earn in Trail Blazer: the pill, the strip, the chips, "Lab crate!"');
  if (landed('tb')) skip('drive /trail-blazer/ (its mock engine): answer gates, finish and win a race', 'TODO(orchestrator): drive the real game here instead of the stand-in below');
  await page.evaluate(async () => {
    const { lab } = await import('/lab/src/index.js');
    window.__L = lab;
    lab.attach({ game: 'tb', playerId: 'mia', name: 'Mia', color: '#ff3b5c' });
    const host = document.createElement('div'); host.id = 'standin'; host.style.cssText = 'position:fixed;top:70px;right:12px;z-index:9;width:340px;background:#123;padding:8px';
    host.innerHTML = '<div id="standin-hud"></div><div id="standin-results"></div>'; document.body.append(host);
    window.__hud = lab.hud({ mount: document.querySelector('#standin-hud'), compact: true });
    lab.beginRound('tb');
  });
  await sleep(500);
  const xp0 = (await view(page)).level.into;
  await page.evaluate(() => { for (let i = 0; i < 6; i++) __L.report({ game: 'tb', event: 'fact', firstTry: true }); });
  await sleep(400);
  const xp1 = (await view(page)).level.into;
  check('the Lab pill shows XP rising (the bar moves)', xp1 > xp0 && /Lv 1/.test(await page.textContent('#standin-hud .lab-hud-lv')));
  await page.evaluate(() => { __L.report({ game: 'tb', event: 'race' }); __L.report({ game: 'tb', event: 'win' }); window.__res = __L.results({ mount: document.querySelector('#standin-results') }); });
  await sleep(700);
  const line = (await page.textContent('#lab-strip-line')).trim();
  check('the results strip shows coins and "XP to level 2"', /^\+\d+ Lab coins · \d+ XP to level \d+ · 3 of 3 quests$/.test(line) || /Lab coins · \d+ XP to level/.test(line), line);
  check('the three quest chips tick', (await page.locator('#standin-results .lab-qchip.done').count()) === 3);
  check('the third completion shows "Lab crate!"', await page.locator('#lab-strip-crate').count() === 1 && /Lab crate!/.test(await page.textContent('#lab-strip-crate')));
  await page.screenshot({ path: join(SHOTS, 'e2e-2-strip.png') }).catch(() => {});

  // ================= 3. the crate opens =================
  section('3. The crate opens from the strip');
  await page.click('#lab-strip-crate');
  check('the overlay opens on the crate', !!(await until(() => page.$('.lab-overlay .lab-shell[data-view="crate"]'), 4000)));
  await page.click('.lab-overlay #crate-open');
  check('the reveal names the item', !!(await until(() => page.$('.lab-overlay #crate-name'), 4000)));
  const got = await view(page);
  check('the item is granted (lab.owns)', got.owned.length >= 1 && got.crates.waiting === 0);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__hud.destroy(); window.__res.destroy(); document.querySelector('#standin').remove(); });

  // ================= 4. buy the dump truck =================
  section('4. Build Crew tab: the dump truck, two taps, 8,000 coins');
  if (!looksLanded('bc')) await page.evaluate(() => __lab.setLooks('bc', ['bc.veh.dump', 'bc.veh.fork', 'bc.bp.lighthouse', 'bc.bp.windmill', 'bc.bp.castlegate', 'bc.bp.arch']));
  else skip('stand-in looks for Build Crew', 'build-crew/src/meta/labLooks.js exists: the real LOOKS_READY is used');
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
  if (!landed('bc')) skip('open /build-crew/ as Mia and as Ben', 'build-crew/src/meta/labBridge.js has not landed');
  else {
    // TODO(orchestrator): open /build-crew/ in this context as Mia: availableMachines() includes 'dump' (selectable in the tray); switch to Ben:
    // 'dump' is absent; for both, skid steer, excavator and crane are listed per their rewards and all ten jobs are open.
    skip('drive Build Crew', 'TODO(orchestrator)');
  }

  // ================= 6. back in /lab/: quests 3/3 and the board =================
  section('6. Back in the Lab: quests 3/3 and the family board in the picker\'s order');
  await clickTab(page, 'quests');
  check('the quests panel shows all three done', (await page.locator('.lab-quest.done').count()) === 3);
  await clickTab(page, 'family');
  const order = await page.evaluate(() => [...document.querySelectorAll('.lab-person')].map((p) => p.dataset.player));
  check('the board lists Mia then Ben (the picker\'s order)', order.join() === 'mia,ben', order.join());
  const miaXp = (await page.textContent('.lab-person[data-player="mia"] .lab-person-xp')).trim();
  check('the board shows Mia\'s XP and no ranks', /XP$/.test(miaXp) && !/\b(1st|2nd|3rd)\b|rank/i.test(await page.innerText('.lab-board')), miaXp);

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
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|fonts\./.test(m.text())) errs.push(m.text()); });
    await p.addInitScript((fam) => { if (!localStorage.getItem('spellJump.family')) localStorage.setItem('spellJump.family', JSON.stringify(fam)); }, FAMILY);
    await p.goto(`${BASE}/${url}/?nosw=1&mock=1`, { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(1500);
    const lab = await p.evaluate(() => document.querySelectorAll('.lab-root').length);
    check(`${folder}: boots with /lab/ blocked, no Lab UI, no page errors`, errs.length === 0 && lab === 0, errs.slice(0, 2).join(' | '));
    if (landed(g)) skip(`${folder}: play one round with /lab/ blocked`, 'TODO(orchestrator): start a round on the mock engine and assert one bridge warning only');
    await ctx.close();
  }
  check('no console errors on the main device', A.errors.length === 0, A.errors.slice(0, 3).join(' | '));
} finally { await browser.close(); }

console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped`);
if (skipped.length) console.log('SKIPPED (for the orchestrator):\n- ' + skipped.join('\n- '));
if (failed.length) { console.log('FAILED:\n- ' + failed.join('\n- ')); process.exit(1); }
console.log('LAB CROSS-GAME SKELETON PASSED (steps that need the games are SKIP)');
