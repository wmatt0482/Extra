// Case Files family sync, end to end (SPEC §6), modelled on fraction-fright/tools/sync-smoke.mjs:
//   bash build.sh && (cd dist && python3 -m http.server 8741 &)      then      BASE_URL=http://localhost:8741 node case-files/tools/sync-smoke.mjs
// Two Playwright browser contexts, "laptop" (1280x800) and "ipad" (1024x768, touch), on /case-files/index.html. `route('**/api/family/**')`
// answers both from ONE in-memory store in this process through the real request handler (car-jump/src/sync/protocol.mjs), so both
// devices talk to the same server; a device goes offline by having its route abort.
// Flow: the laptop creates Mia, closes Detective Training and creates a family code → the server has <id>.cf → the ipad joins and gets
// the save (opened, closed, rank) → both close a DIFFERENT case offline and change what they like (the laptop sets rank 5 later,
// the ipad counts more listens on the shared case) → after the 409 merge nothing is lost: both closed cases, the union of opened, the
// per-document maximum of listens, the later rank, the same save on laptop, ipad and server → Trail Blazer on the same server keeps
// Case Files' sync metadata and never touches its docs. No console errors (404 / 409s and aborts are expected).
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handle, memoryStore } from '../../car-jump/src/sync/protocol.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8741';
const CF = BASE + '/case-files/index.html?nosw=1';
const TB = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'case-files-sync-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/case-files/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  execSync('bash build.sh', { cwd: repoRoot, stdio: 'ignore' });
  const srv = spawn('python3', ['-m', 'http.server', new URL(BASE).port || '8741'], { cwd: path.join(repoRoot, 'dist'), stdio: 'ignore' });
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
    if (!sessionStorage.getItem('cfSyncSeeded')) { localStorage.clear(); sessionStorage.setItem('cfSyncSeeded', '1'); }
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
  });
  await page.goto(CF, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__caseFiles);
  return { name, ctx, page, errors };
}

const J = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const ls = (page, key) => J(page, (k) => JSON.parse(localStorage.getItem(k)), key);
const cfSync = (page, what) => J(page, (w) => window.__caseFiles.sync[w](), what);
const mem = (page) => J(page, () => JSON.parse(JSON.stringify(window.__caseFiles.save)));
/** close a case in the save the way the game records it (the whole play-through is in ui-smoke.mjs) */
const closeDirect = (page, id, extra = {}) => J(page, ({ id, extra }) => {
  const a = window.__caseFiles.app, s = a.save;
  s.opened[id] = s.opened[id] || '2026-11-02';
  s.closed[id] = { day: '2026-11-02', at: Date.now(), firstTap: { q1: true }, hints: { q1: 0 }, timelineTries: 0, report: { who: 'Tom Fisk', because: 'the ticket was in the coat pocket', clueId: 'd1s1' }, listens: { d1: 1 }, ...extra };
  a.persist();
}, { id, extra });

async function main() {
  const srv = await ensureServer();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const laptop = await device(browser, 'laptop', { viewport: { width: 1280, height: 800 } });
    const ipad = await device(browser, 'ipad', { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 });
    const L = laptop.page, I = ipad.page;

    console.log('\n=== laptop: Mia closes Training and creates a family code; the ipad joins ===');
    const miaId = await J(L, () => { const a = window.__caseFiles.app; const p = a.createPlayer('Mia', '#ff3b5c'); a.selectPlayer(p.id || p); return a.currentPlayerId; });
    await closeDirect(L, 'training');
    const lap1 = await mem(L);
    check(lap1.opened.training && lap1.opened['erie-01'] && lap1.closed.training, 'the laptop: Training closed, Erie case 1 open');
    const created = await J(L, () => window.__caseFiles.sync.create());
    const code = created.code;
    check(created.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), `the laptop created family ${code}`);
    await cfSync(L, 'syncNow');
    const cf1 = await serverDoc(code, `${miaId}.cf`);
    check(cf1 && cf1.data.closed.training && cf1.data.opened['erie-01'] && cf1.data.v === 1, 'the server has <id>.cf with the closed case and the opened days');
    const joined = await J(I, (c) => window.__caseFiles.sync.join(c), code);
    check(joined.ok && joined.players.some((p) => p.name === 'Mia'), 'the ipad joined: Mia is in its family');
    await J(I, (id) => window.__caseFiles.app.selectPlayer(id), miaId);
    const ip1 = await mem(I);
    check(ip1.closed.training && ip1.closed.training.at === lap1.closed.training.at && ip1.opened['erie-01'], 'the ipad has Mia\'s save: Training closed, Erie case 1 open');
    check((await J(I, () => document.querySelector('.case-card[data-case="training"]').dataset.state)) === 'closed', 'the ipad\'s agency home shows the Training stamp');
    await shot(I, '01-ipad-home');

    console.log('\n=== both play offline and change different things; the 409 merge loses nothing ===');
    online.laptop = false; online.ipad = false;
    await closeDirect(L, 'erie-01', { at: Date.now() + 1000, listens: { d1: 2, d3: 5 } });
    await J(L, () => { const a = window.__caseFiles.app; a.setRankFor(a.currentPlayerId, 5); });
    await J(L, () => { const a = window.__caseFiles.app; a.save.wordsMet.toll = 3; a.persist(); });
    await new Promise((r) => setTimeout(r, 50));
    await J(I, () => { const a = window.__caseFiles.app; a.save.wordsMet.toll = 1; a.save.wordsMet.cubby = 2; a.save.closed.training.listens = { d1: 6 }; a.save.opened['erie-02'] = '2026-11-03'; a.save.rank = 3; a.persist(); });
    const lo = await mem(L), io = await mem(I);
    check(lo.rank === 5 && io.rank === 3, 'offline: the laptop set rank 5, the ipad rank 3 (later)');
    online.laptop = true; online.ipad = true;
    const n409 = apiLog.filter((r) => r.status === 409).length;
    await cfSync(L, 'syncNow');
    await cfSync(I, 'syncNow');
    await cfSync(L, 'pullNow');
    check(apiLog.filter((r) => r.status === 409).length > n409, 'the second device got a 409 and merged');
    const sv = (await serverDoc(code, `${miaId}.cf`)).data;
    check(sv.closed.training && sv.closed['erie-01'], 'no closed case lost: Training and Erie case 1 are both closed on the server');
    check(Object.keys(sv.opened).sort().join() === 'erie-01,erie-02,training', `the union of opened days (${Object.keys(sv.opened).join(', ')})`);
    check(sv.closed.training.at === lap1.closed.training.at && sv.closed.training.listens.d1 === 6, 'the earliest `at` wins the case record, its listens raised to the per-document maximum (6)');
    check(sv.wordsMet.toll === 3 && sv.wordsMet.cubby === 2, 'words met take the per-word maximum');
    check(sv.rank === 3 && (await mem(L)).rank === 3 && (await mem(I)).rank === 3, 'the rank comes from the later change (the ipad: 3) on laptop, ipad and server');
    const lm = await mem(L), im = await mem(I);
    check(JSON.stringify(Object.keys(lm.closed).sort()) === JSON.stringify(Object.keys(im.closed).sort()) && lm.closed.training.listens.d1 === 6 && im.closed['erie-01'].at === lo.closed['erie-01'].at, 'laptop, ipad and server agree on the closed cases');
    check((await J(L, () => document.querySelector('.case-card[data-case="erie-02"]') && document.querySelector('.case-card[data-case="erie-02"]').dataset.state)) !== null, 'the laptop\'s open screens redraw from the merged save');

    console.log('\n=== Trail Blazer on the same server and the same device ===');
    const metaBefore = (await ls(I, 'spellJump.sync')).keys;
    const rev = (await serverDoc(code, `${miaId}.cf`)).rev;
    await I.goto(TB, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__trailBlazer && window.__trailBlazer.sync);
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);
    await I.waitForTimeout(300);
    await J(I, () => { const a = window.__trailBlazer.app; a.save.cash += 75; a.persist(); });
    await J(I, () => window.__trailBlazer.sync.syncNow());
    const metaTB = (await ls(I, 'spellJump.sync')).keys;
    check(metaTB[`${miaId}.cf`] && metaTB[`${miaId}.cf`].rev === metaBefore[`${miaId}.cf`].rev, "Trail Blazer kept Case Files' sync metadata");
    check((await serverDoc(code, `${miaId}.cf`)).rev === rev, 'Trail Blazer did not touch the Case Files doc on the server');
    await I.goto(CF, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__caseFiles);
    const n409b = apiLog.filter((r) => r.status === 409).length;
    await J(I, (id) => window.__caseFiles.app.selectPlayer(id), miaId);
    await cfSync(I, 'syncNow');
    check(apiLog.filter((r) => r.status === 409).length === n409b && (await serverDoc(code, `${miaId}.cf`)).rev === rev, 'back in Case Files: in step with the server (no conflict, nothing to push)');
    check((await J(L, () => window.__caseFiles.sync.pullNow().then(() => localStorage.getItem(`trailBlazer.${window.__caseFiles.app.currentPlayerId}.save`)))) == null, "Case Files syncs only its own kinds (and Spell Jump's): Mia's Trail Blazer save waits on the server for Trail Blazer");

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
  console.log('\nALL CASE FILES SYNC CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
