// Wagon West family sync, end to end (SPEC §12), modelled on fraction-fright/tools/sync-smoke.mjs:
//   BASE_URL=http://localhost:8095 node wagon-west/tools/sync-smoke.mjs   (serves the REPO ROOT itself if nothing listens)
// Two Playwright browser contexts, "laptop" (1280×800) and "ipad" (1024×768, touch), on
// /wagon-west/index.html?mock=1&nosw=1. `route('**/api/family/**')` on both answers from ONE in-memory store in this
// process through the real request handler (car-jump/src/sync/protocol.mjs), so both devices talk to the same
// server; a device goes offline by having its route abort.
// NOTE for integration: the family server only knows the kinds in protocol.mjs PLAYER_KINDS. Until 'ww' is added
// there (and to parseKey's pattern), this test maps <id>.ww onto an unused slot of the in-memory server (the
// 'fracs' slot, which Wagon West does not sync) and says so in its output; once 'ww' is in, it runs straight.
// Flow: the laptop creates Mia, packs the wagon (the journey), plays the first mile marker (a fact in the child's
// Trail Blazer store), creates a family code → the server has <id>.ww and <id>.facts (Trail Blazer's kind, registered
// by Wagon West) → the ipad joins and gets the journey and the facts → the ipad writes a letter offline: it waits, then
// syncs, and the laptop gets it → both play offline → after the 409 merge no letter, no sticker and no token is lost,
// cash and tokens are the max, the trail cards (v1.1, J.cards) the union, and laptop, ipad and server agree → Trail Blazer on the same device keeps Wagon West's
// sync metadata. No console errors (the 404 / 409s and aborts are expected).
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLAYER_KINDS, handle, memoryStore } from '../../car-jump/src/sync/protocol.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const WW = BASE + '/wagon-west/index.html?mock=1&nosw=1';
const TB = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'wagon-west-sync-shots');
mkdirSync(SHOTS, { recursive: true });
const ALIAS = PLAYER_KINDS.includes('ww') ? null : 'fracs';

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/wagon-west/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const srv = spawn('python3', ['-m', 'http.server', new URL(BASE).port || '8080'], { cwd: repoRoot, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
let passed = 0;
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else { passed++; console.log('  ✓ ' + msg); } };

const store = memoryStore();
const online = { laptop: true, ipad: true };
const apiLog = [];
const serverDoc = async (code, key) => { const e = await store.get(`${code}/${ALIAS ? key.replace(/\.ww$/, `.${ALIAS}`) : key}`); return e ? e.value : null; };

/** The real handler, with <id>.ww mapped onto the alias slot while protocol.mjs does not know 'ww' yet. */
async function serve(req) {
  const p = ALIAS ? req.path.replace(/\.ww$/, `.${ALIAS}`) : req.path;
  const res = await handle({ ...req, path: p }, store);
  if (ALIAS && req.method === 'GET' && res.status === 200) {
    const body = JSON.parse(res.body);
    for (const kinds of Object.values(body.players || {})) { kinds.ww = kinds[ALIAS]; delete kinds[ALIAS]; }
    return { ...res, body: JSON.stringify(body) };
  }
  return res;
}

async function device(browser, name, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/api/family/**', async (route) => {
    const req = route.request();
    if (!online[name]) { apiLog.push({ name, method: req.method(), status: 'offline' }); await route.abort('internetdisconnected'); return; }
    const u = new URL(req.url());
    const res = await serve({ method: req.method(), path: u.pathname, contentType: req.headers()['content-type'], body: req.postData() });
    apiLog.push({ name, method: req.method(), path: u.pathname, status: res.status });
    await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
  await ctx.route('**/api/tts/**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, key: false, voices: [], dailyChars: 0 }) }));
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const where = (m.location() && m.location().url) || '';
    if (/fonts\.(googleapis|gstatic)/.test(m.text() + where)) return;
    if (/\/api\/(family|tts)\//.test(where) && /status of (404|409)|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/.test(m.text())) return;
    errors.push(`${name}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('wwSyncSeeded')) { localStorage.clear(); sessionStorage.setItem('wwSyncSeeded', '1'); }
    window.__wwScript = { daySec: 0.1, beat: 0.1 };
    window.__mockScript = { shotMs: 60 };
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); }, cancel() {}, addEventListener() {} };
  });
  await page.goto(WW, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__wagonWest);
  return { name, ctx, page, errors };
}

const J = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const ls = (page, key) => J(page, (k) => JSON.parse(localStorage.getItem(k)), key);
const wwSync = (page, what) => J(page, (w) => window.__wagonWest.sync[w](), what);
const mem = (page) => J(page, () => { const s = window.__wagonWest.save; return { cash: s.journey && s.journey.cash, tokens: s.journey && s.journey.tokens, wagon: s.journey && s.journey.wagonName, legIndex: s.journey && s.journey.legIndex, letters: s.letters.map((l) => l.text), stickers: s.stickers.slice(), crates: s.crates.earned }; });
/** a change made on a device the way the game makes it: on the save in memory, then persisted */
const edit = (page, fn) => J(page, (src) => { const s = window.__wagonWest.save; (0, eval)(`(${src})`)(s); window.__wagonWest.app.persist(); }, fn.toString());

async function main() {
  const srv = await ensureServer();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  if (ALIAS) console.log(`\nNOTE: car-jump/src/sync/protocol.mjs does not list 'ww' in PLAYER_KINDS yet: this run maps <id>.ww onto the '${ALIAS}' slot of the in-memory server. Integration must add 'ww' there.`);
  try {
    const laptop = await device(browser, 'laptop', { viewport: { width: 1280, height: 800 } });
    const ipad = await device(browser, 'ipad', { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 });
    const L = laptop.page, I = ipad.page;

    console.log('\n=== laptop: Mia packs the wagon, plays a mile marker, creates a family code; the ipad joins ===');
    const miaId = await J(L, () => { const a = window.__wagonWest.app; const p = a.createPlayer('Mia', '#ff3b5c'); a.selectPlayer(p.id || p); return a.currentPlayerId; });
    await J(L, () => { window.__wagonWest.app.outfitDone({ wagonName: 'Dusty', animal: 'oxen', companions: ['blacksmith', 'scout', 'cook'] }, { fresh: true }); });
    await L.waitForSelector('#screen-store:not([hidden])');
    await L.click('#store-done');
    await L.waitForFunction(() => window.__wagonWest.card.isOpen);
    await L.click('#tc-go');
    await L.waitForFunction(() => window.__wagonWest.markerPanel.state === 'ask', null, { timeout: 15000 });
    const ans = await J(L, () => window.__wagonWest.markerPanel.answer);
    for (const d of String(ans)) await L.click(`#panel-marker .np-key[data-key="${d}"]`);
    await L.click('#panel-marker .np-key[data-key="go"]');
    await L.waitForFunction(() => window.__wagonWest.markerPanel.state === 'closed');
    await J(L, () => window.__wagonWest.app.go('title'));
    const lap0 = await mem(L);
    const facts0 = await ls(L, `trailBlazer.${miaId}.facts`);
    check(lap0.wagon === 'Dusty' && facts0 && Object.keys(facts0.records || {}).length >= 1, `the laptop: the wagon "Dusty" on the trail and the marker's fact in Mia's Trail Blazer store`);
    await edit(L, (s) => { s.letters.push({ at: 1000, leg: 'fort-kearny', season: 's1847', text: 'Dear Grandma,\nLaptop letter one.' }); s.stickers.push('kansas-river'); });
    const created = await J(L, () => window.__wagonWest.sync.create());
    const code = created.code;
    check(created.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), `the laptop created family ${code}`);
    await wwSync(L, 'syncNow');
    const ww1 = await serverDoc(code, `${miaId}.ww`), fa1 = await serverDoc(code, `${miaId}.facts`);
    check(ww1 && ww1.data.journey && ww1.data.journey.wagonName === 'Dusty' && ww1.data.letters.length === 1, `the server has <id>.ww (the journey, the letter)`);
    check(fa1 && Object.keys(fa1.data.records || {}).length >= 1, 'the server has <id>.facts too: the marker\'s fact synced from Wagon West (Trail Blazer\'s kind, registered here)');
    const joined = await J(I, (c) => window.__wagonWest.sync.join(c), code);
    check(joined.ok && joined.players.some((p) => p.name === 'Mia'), 'the ipad joined: Mia is in its family');
    await J(I, (id) => window.__wagonWest.app.selectPlayer(id), miaId);
    const ip1 = await mem(I);
    check(ip1.wagon === 'Dusty' && ip1.letters.length === 1 && ip1.stickers.includes('kansas-river') && ip1.cash === lap0.cash, `the ipad has Mia's journey (Dusty, $${ip1.cash}), the letter and the sticker`);
    check(!!(await ls(I, `trailBlazer.${miaId}.facts`)), "the ipad has Mia's facts store (the ladder moves the same everywhere)");
    await shot(I, '01-ipad-title');
    await J(I, () => window.__wagonWest.pz.open({ tab: 'sync' }));
    await I.waitForTimeout(300);
    for (let k = 0; k < 2 && await J(I, () => !!document.querySelector('.pinpad')); k++) { for (const d of '1234') await I.click(`.pinpad [data-digit="${d}"]`); await I.waitForTimeout(250); }
    await I.waitForSelector('#pz-sync-line:not([hidden])', { timeout: 4000 });
    const line = await J(I, () => document.querySelector('#pz-sync-line').textContent);
    check(line === 'Synced · players and all four games', `Parents: "${line}"`);
    await shot(I, '02-ipad-parents');
    await J(I, () => window.__wagonWest.pz.close());

    console.log('\n=== the ipad writes a letter offline: it waits, then syncs ===');
    online.ipad = false;
    await edit(I, (s) => { s.letters.push({ at: 2000, leg: 'fort-kearny', season: 's1847', text: 'Dear Uncle Theo,\nIpad letter one.' }); });
    await wwSync(I, 'syncNow');
    const st = await J(I, () => window.__wagonWest.sync.status());
    check(st.offline && st.pending >= 1 && (await serverDoc(code, `${miaId}.ww`)).data.letters.length === 1, `offline: ${st.pending} change(s) waiting, the server still has 1 letter`);
    online.ipad = true;
    await wwSync(I, 'syncNow');
    check((await serverDoc(code, `${miaId}.ww`)).data.letters.length === 2, 'back online: the server has both letters');
    await wwSync(L, 'pullNow');
    check((await mem(L)).letters.length === 2, 'the laptop (in memory) got the ipad\'s letter');

    console.log('\n=== both play offline → the 409 merge keeps every letter, sticker and token ===');
    online.laptop = false; online.ipad = false;
    await edit(L, (s) => { s.letters.push({ at: 3000, leg: 'chimney-rock', season: 's1847', text: 'Dear Grandma,\nLaptop letter two.' }); s.stickers.push('fort-kearny'); s.journey.cash += 50; s.crates.earned += 1; s.crates.queue.push('gold'); s.journey.cards = [...(s.journey.cards || []), 'kansas-river', 'bison']; });
    await edit(I, (s) => { s.letters.push({ at: 3500, leg: 'chimney-rock', season: 's1847', text: 'Dear Miss Carter,\nIpad letter two.' }); s.stickers.push('chimney-rock'); s.journey.tokens += 2; s.journey.cards = [...(s.journey.cards || []), 'pawnee', 'eagle']; });
    const lo = await mem(L), io = await mem(I);
    online.laptop = true; online.ipad = true;
    const n409 = apiLog.filter((r) => r.status === 409).length;
    await wwSync(L, 'syncNow');
    await wwSync(I, 'syncNow');
    await wwSync(L, 'pullNow');
    check(apiLog.filter((r) => r.status === 409).length > n409, 'the second device got a 409 and merged');
    const s = (await serverDoc(code, `${miaId}.ww`)).data;
    check(s.letters.length === 4, `no letter lost: the server has all ${s.letters.length}`);
    check(['kansas-river', 'fort-kearny', 'chimney-rock'].every((x) => s.stickers.includes(x)), `stickers union (${s.stickers.join(', ')})`);
    check(s.journey.cash === Math.max(lo.cash, io.cash) && s.journey.tokens === Math.max(lo.tokens, io.tokens), `the same journey on both: cash max ($${s.journey.cash}), tokens max (${s.journey.tokens})`);
    check(s.crates.earned === lo.crates && s.crates.queue.length === 1, 'the crate earned offline on the laptop is kept');
    check(['kansas-river', 'bison', 'pawnee', 'eagle'].every((id) => (s.journey.cards || []).includes(id)), `trail cards union (v1.1): ${(s.journey.cards || []).join(', ')}`);
    const lc = await J(L, () => window.__wagonWest.save.journey.cards || []), ic = await J(I, () => window.__wagonWest.save.journey.cards || []);
    check(['bison', 'eagle'].every((id) => lc.includes(id) && ic.includes(id)), 'both devices hold every card after the merge');
    const lm = await mem(L), im = await mem(I);
    check(lm.letters.length === 4 && im.letters.length === 4 && lm.cash === s.journey.cash && im.tokens === s.journey.tokens, 'laptop, ipad and server agree (in memory too)');

    console.log('\n=== a reset on one device wins ===');
    await J(L, (id) => window.__wagonWest.app.resetSaveFor(id), miaId);
    await wwSync(L, 'syncNow');
    await wwSync(I, 'pullNow');
    const after = await mem(I);
    check(!after.wagon && after.letters.length === 0, 'Parents → Reset on the laptop resets Mia\'s Wagon West on the ipad too');

    console.log('\n=== Trail Blazer on the same device ===');
    const metaBefore = (await ls(I, 'spellJump.sync')).keys;
    const wwRev = (await serverDoc(code, `${miaId}.ww`)).rev;
    await I.goto(TB, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__trailBlazer && window.__trailBlazer.sync);
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);
    await I.waitForTimeout(300);
    await J(I, () => window.__trailBlazer.sync.syncNow());
    const metaTB = (await ls(I, 'spellJump.sync')).keys;
    check(metaTB[`${miaId}.ww`] && metaTB[`${miaId}.ww`].rev === metaBefore[`${miaId}.ww`].rev, "Trail Blazer kept Wagon West's sync metadata");
    check((await serverDoc(code, `${miaId}.ww`)).rev === wwRev, 'Trail Blazer did not touch the Wagon West doc on the server');

    const errors = [...laptop.errors, ...ipad.errors];
    check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  } finally {
    await browser.close();
    if (srv) srv.kill();
  }
  console.log(`\nscreenshots: ${SHOTS}`);
  console.log(`requests: ${apiLog.length} (${['GET', 'PUT', 'POST'].map((m) => `${m} ${apiLog.filter((r) => r.method === m).length}`).join(', ')}; 409s ${apiLog.filter((r) => r.status === 409).length}; offline ${apiLog.filter((r) => r.status === 'offline').length})`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n- ` + failures.join('\n- ')); process.exit(1); }
  console.log('\nALL WAGON WEST SYNC CHECKS PASSED' + (ALIAS ? ` (with 'ww' mapped onto '${ALIAS}': add 'ww' to protocol.mjs at integration)` : ''));
}

main().catch((e) => { console.error(e); process.exit(1); });
