// Squirrel Chase family sync, end to end (SPEC §7), modelled on case-files/tools/sync-smoke.mjs:
//   bash build.sh && (cd dist && python3 -m http.server 8811 &)      then      BASE_URL=http://localhost:8811 node squirrel-chase/tools/sync-smoke.mjs
// Two Playwright browser contexts, "laptop" (1280x800) and "ipad" (1024x768, touch), on /squirrel-chase/index.html (on the fixture content of
// tools/fixtures/). `route('**/api/family/**')` answers both from ONE in-memory store in this process through the real request handler
// (car-jump/src/sync/protocol.mjs), so both devices talk to the same server; a device goes offline by having its route abort.
// Flow: the laptop creates Mia, closes case 1 and creates a family code -> the server has <id>.sq -> the ipad joins and gets the save (opened,
// closed, album) -> both change things offline (the laptop closes case 2, the ipad opens another day and adds a postcard) -> after the 409 merge
// nothing is lost: both closed cases, the union of opened days and of the album, the earliest `at` for a case both closed, the same save on
// laptop, ipad and server -> Trail Blazer on the same server keeps the sq sync metadata and never touches its doc. No console errors.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handle, memoryStore } from '../../car-jump/src/sync/protocol.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8811';
const SQ = BASE + '/squirrel-chase/index.html?nosw=1';
const TB = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'squirrel-chase-sync-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/squirrel-chase/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  execSync('bash build.sh', { cwd: repoRoot, stdio: 'ignore' });
  const srv = spawn('python3', ['-m', 'http.server', new URL(BASE).port || '8811'], { cwd: path.join(repoRoot, 'dist'), stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
let passed = 0;
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else { passed++; console.log('  ✓ ' + msg); } };

const store = memoryStore();
const online = { laptop: true, ipad: true };
const apiLog = [];
const serverDoc = async (code, key) => { const e = await store.get(`${code}/${key}`); return e ? e.value : null; };

async function device(browser, name, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/squirrel-chase/src/content/index.js', (r) => r.fulfill({ status: 200, body: readFileSync(path.join(here, 'fixtures', 'content.js')), contentType: 'text/javascript' }));
  await ctx.route('**/api/family/**', async (route) => {
    const req = route.request();
    if (!online[name]) { apiLog.push({ name, method: req.method(), status: 'offline' }); await route.abort('internetdisconnected'); return; }
    const u = new URL(req.url());
    const res = await handle({ method: req.method(), path: u.pathname, contentType: req.headers()['content-type'], body: req.postData() }, store);
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
    if (!sessionStorage.getItem('sqSyncSeeded')) { localStorage.clear(); sessionStorage.setItem('sqSyncSeeded', '1'); }
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
  });
  await page.goto(SQ, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__squirrelChase);
  return { name, ctx, page, errors };
}

const J = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const ls = (page, key) => J(page, (k) => JSON.parse(localStorage.getItem(k)), key);
const sqSync = (page, what) => J(page, (w) => window.__squirrelChase.sync[w](), what);
const mem = (page) => J(page, () => JSON.parse(JSON.stringify(window.__squirrelChase.save)));
const SEQ = (page) => J(page, async () => (await import('/squirrel-chase/src/logic/caseModel.js')).SEQUENCE);
const stampState = (page, id) => J(page, (id) => { const e = document.querySelector(`.stamp-card[data-case="${id}"]`); return e && e.dataset.state; }, id);
/** close a case in the save the way the game records it (the whole play-through is in ui-smoke.mjs) */
const closeDirect = (page, id, extra = {}, city = 'rochester') => J(page, ({ id, extra, city }) => {
  const a = window.__squirrelChase.app, s = a.save;
  s.opened[id] = s.opened[id] || '2026-11-02';
  s.closed[id] = { day: '2026-11-02', at: Date.now(), words: ['friend', 'island'], hideout: { correct: 2, total: 2 }, ...extra };
  if (!s.album.includes(city)) s.album.push(city);
  a.persist();
}, { id, extra, city });

async function main() {
  const srv = await ensureServer();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const laptop = await device(browser, 'laptop', { viewport: { width: 1280, height: 800 } });
    const ipad = await device(browser, 'ipad', { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 });
    const L = laptop.page, I = ipad.page;
    const [c1, c2] = await SEQ(L);

    console.log('\n=== laptop: Mia closes case 1 and creates a family code; the ipad joins ===');
    const miaId = await J(L, () => { const a = window.__squirrelChase.app; const p = a.createPlayer('Mia', '#ff3b5c'); a.selectPlayer(p.id || p); return a.currentPlayerId; });
    await closeDirect(L, c1, {}, 'rochester');
    const lap1 = await mem(L);
    check(lap1.opened[c1] && lap1.closed[c1] && lap1.album.join() === 'rochester', 'the laptop: case 1 closed, its postcard in the album');
    const created = await J(L, () => window.__squirrelChase.sync.create());
    const code = created.code;
    check(created.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), `the laptop created family ${code}`);
    await sqSync(L, 'syncNow');
    const sq1 = await serverDoc(code, `${miaId}.sq`);
    check(sq1 && sq1.data.closed[c1] && sq1.data.opened[c1] && sq1.data.album.join() === 'rochester' && sq1.data.v === 1, 'the server has <id>.sq with the closed case, the opened days and the album');
    const joined = await J(I, (c) => window.__squirrelChase.sync.join(c), code);
    check(joined.ok && joined.players.some((p) => p.name === 'Mia'), 'the ipad joined: Mia is in its family');
    await J(I, (id) => window.__squirrelChase.app.selectPlayer(id), miaId);
    const ip1 = await mem(I);
    check(ip1.closed[c1] && ip1.closed[c1].at === lap1.closed[c1].at && ip1.album.join() === 'rochester', "the ipad has Mia's save: case 1 closed, the postcard in the album");
    check((await stampState(I, c1)) === 'closed', "the ipad's case board shows the closed case's stamp");
    await shot(I, '01-ipad-home');

    console.log('\n=== both play offline and change different things; the 409 merge loses nothing ===');
    online.laptop = false; online.ipad = false;
    await closeDirect(L, c2, { at: Date.now() + 1000 }, 'buffalo');
    await new Promise((r) => setTimeout(r, 50));
    await J(I, ({ c1 }) => { const a = window.__squirrelChase.app; a.save.opened.extra = '2026-11-03'; a.save.closed[c1] = { ...a.save.closed[c1], at: a.save.closed[c1].at + 5000, words: ['neighbor'] }; if (!a.save.album.includes('syracuse')) a.save.album.push('syracuse'); a.persist(); }, { c1 });
    online.laptop = true; online.ipad = true;
    const n409 = apiLog.filter((r) => r.status === 409).length;
    await sqSync(L, 'syncNow');
    await sqSync(I, 'syncNow');
    await sqSync(L, 'pullNow');
    check(apiLog.filter((r) => r.status === 409).length > n409, 'the second device got a 409 and merged');
    const sv = (await serverDoc(code, `${miaId}.sq`)).data;
    check(sv.closed[c1] && sv.closed[c2], 'no closed case lost: case 1 and case 2 are both closed on the server');
    check(Object.keys(sv.opened).sort().join() === [c1, c2, 'extra'].sort().join(), `the union of opened days (${Object.keys(sv.opened).join(', ')})`);
    check(sv.closed[c1].at === lap1.closed[c1].at && sv.closed[c1].words.join() === 'friend,island', 'a case both devices closed keeps the record with the earliest `at`, whole');
    check(['rochester', 'buffalo', 'syracuse'].every((c) => sv.album.includes(c)) && sv.album.length === 3, `the album is the union of the postcards (${sv.album.join(', ')})`);
    const lm = await mem(L), im = await mem(I);
    check(JSON.stringify(Object.keys(lm.closed).sort()) === JSON.stringify(Object.keys(im.closed).sort()) && lm.album.length === 3 && im.album.length === 3 && im.closed[c1].words.join() === 'friend,island', 'laptop, ipad and server agree on the closed cases and the album');
    await sqSync(L, 'pullNow');
    check((await stampState(L, c2)) === 'closed', "the laptop's open screens redraw from the merged save");

    console.log('\n=== Trail Blazer on the same server and the same device ===');
    const metaBefore = (await ls(I, 'spellJump.sync')).keys;
    const rev = (await serverDoc(code, `${miaId}.sq`)).rev;
    await I.goto(TB, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__trailBlazer && window.__trailBlazer.sync);
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);
    await I.waitForTimeout(300);
    await J(I, () => { const a = window.__trailBlazer.app; a.save.cash += 75; a.persist(); });
    await J(I, () => window.__trailBlazer.sync.syncNow());
    const metaTB = (await ls(I, 'spellJump.sync')).keys;
    check(metaTB[`${miaId}.sq`] && metaTB[`${miaId}.sq`].rev === metaBefore[`${miaId}.sq`].rev, "Trail Blazer kept Squirrel Chase's sync metadata");
    check((await serverDoc(code, `${miaId}.sq`)).rev === rev, 'Trail Blazer did not touch the Squirrel Chase doc on the server');
    await I.goto(SQ, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__squirrelChase);
    const n409b = apiLog.filter((r) => r.status === 409).length;
    await J(I, (id) => window.__squirrelChase.app.selectPlayer(id), miaId);
    await sqSync(I, 'syncNow');
    check(apiLog.filter((r) => r.status === 409).length === n409b && (await serverDoc(code, `${miaId}.sq`)).rev === rev, 'back in Squirrel Chase: in step with the server (no conflict, nothing to push)');

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
  console.log('\nALL SQUIRREL CHASE SYNC CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
