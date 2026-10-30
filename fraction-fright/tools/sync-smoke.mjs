// Fraction Fright family sync, end to end (SPEC §9), modelled on trail-blazer/tools/sync-smoke.mjs:
//   node fraction-fright/tools/sync-smoke.mjs     (serves the REPO ROOT on :8080 itself if nothing listens there)
// Two Playwright browser contexts, "laptop" (1280×800) and "ipad" (1024×768, touch), on
// /fraction-fright/index.html?mock=1&nosw=1. `route('**/api/family/**')` on both answers from ONE in-memory store in
// this process through the real request handler (car-jump/src/sync/protocol.mjs), so both devices talk to the same
// server; a device goes offline by having its route abort.
// Flow: the laptop creates Mia, plays the Lab and a wave, buys Grape goo, creates a family code → the ipad joins and
// gets the save (<id>.ff: cures, cash, the goo) and the skills (<id>.fracs: the Lab, the throws) → the ipad plays a
// wave offline: it waits, then syncs, and the laptop gets it → both play offline → after the 409 merge no throw, no
// wave and no purchase is lost, and laptop, ipad and server agree → Trail Blazer on the same server and device keeps
// Fraction Fright's sync metadata and never touches its docs. No console errors (the 404 / 409s and aborts are expected).
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handle, memoryStore } from '../../car-jump/src/sync/protocol.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const FF = BASE + '/fraction-fright/index.html?mock=1&nosw=1';
const TB = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'fraction-fright-sync-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/fraction-fright/index.html')).ok; } catch (_) { return false; } };
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
    if (!sessionStorage.getItem('ffSyncSeeded')) { localStorage.clear(); sessionStorage.setItem('ffSyncSeeded', '1'); }
    window.__mockScript = { walkSec: 30, beatSec: 0.2, flightSec: 0.06, calmSec: 0.2 };
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); }, cancel() {}, addEventListener() {} };
  });
  await page.goto(FF, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__fractionFright);
  return { name, ctx, page, errors };
}

const J = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const ls = (page, key) => J(page, (k) => JSON.parse(localStorage.getItem(k)), key);
const ffSync = (page, what) => J(page, (w) => window.__fractionFright.sync[w](), what);
const mem = (page) => J(page, () => { const F = window.__fractionFright; return { cash: F.save.cash, cures: F.save.cures, waves: F.save.waves, goo: F.save.yard.owned.goo.slice(), lab: F.skills.lab.done, wavesLog: F.skills.waves.map((w) => w.at), throws: Object.values(F.skills.records).flat().map((x) => x[0]).sort((a, b) => a - b) }; });

/** one mock wave on Maple Street, every zombie cured dead on */
async function wave(page) {
  await J(page, () => { const a = window.__fractionFright.app; a.save.seen.coach = true; a.setSetting('bonus', false); a.startWave('maple'); });   // no bonus round here: this test is about the sync
  await page.waitForFunction(() => window.__fractionFright.screen === 'wave');
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const s = await J(page, () => { const F = window.__fractionFright; const g = F.game.getState(); return { screen: F.screen, phase: g && g.phase, t: g && g.target && g.target.target }; });
    if (s.screen === 'results') return true;
    if (s.phase === 'wave' && s.t != null) await J(page, (v) => window.__fractionFright.throwAt(v), s.t);
    await page.waitForTimeout(50);
  }
  return false;
}

async function main() {
  const srv = await ensureServer();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const laptop = await device(browser, 'laptop', { viewport: { width: 1280, height: 800 } });
    const ipad = await device(browser, 'ipad', { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 });
    const L = laptop.page, I = ipad.page;

    console.log('\n=== laptop: Mia plays the Lab and a wave, buys Grape goo, creates a family code; the ipad joins ===');
    const miaId = await J(L, () => { const a = window.__fractionFright.app; const p = a.createPlayer('Mia', '#ff3b5c'); a.selectPlayer(p.id || p); a.finishLab(); return a.currentPlayerId; });
    check(await wave(L), 'the laptop played Maple Street wave 1');
    await J(L, () => { const a = window.__fractionFright.app; a.save.cash += 2000; a.persist(); a.go('yard'); });
    await L.click('[data-buy="goo:grape"]');
    const lap1 = await mem(L);
    check(lap1.goo.includes('grape') && lap1.cures === 8, `the laptop: 8 cures, Grape goo bought`);
    const created = await J(L, () => window.__fractionFright.sync.create());
    const code = created.code;
    check(created.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), `the laptop created family ${code}`);
    await ffSync(L, 'syncNow');
    const ff1 = await serverDoc(code, `${miaId}.ff`), fr1 = await serverDoc(code, `${miaId}.fracs`);
    check(ff1 && ff1.data.cures === 8 && ff1.data.yard.owned.goo.includes('grape') && fr1 && fr1.data.lab.done > 0 && Object.keys(fr1.data.records).length >= 1,
      `the server has <id>.ff (cures ${ff1 && ff1.data.cures}, the goo) and <id>.fracs (the Lab, ${fr1 && Object.values(fr1.data.records).flat().length} throws)`);
    const joined = await J(I, (c) => window.__fractionFright.sync.join(c), code);
    check(joined.ok && joined.players.some((p) => p.name === 'Mia'), 'the ipad joined: Mia is in its family');
    await J(I, (id) => window.__fractionFright.app.selectPlayer(id), miaId);
    const ip1 = await mem(I);
    check(ip1.cures === 8 && ip1.goo.includes('grape') && ip1.lab === lap1.lab && JSON.stringify(ip1.throws) === JSON.stringify(lap1.throws), `the ipad has Mia's save and skills (8 cures, the goo, the Lab, ${ip1.throws.length} throws)`);
    check(await J(I, () => document.querySelector('#title-cures-n').textContent) === '8', 'the ipad title shows the Cure Counter at 8');
    await shot(I, '01-ipad-title');
    await J(I, () => window.__fractionFright.pz.open({ tab: 'sync' }));
    await I.waitForTimeout(300);
    for (let k = 0; k < 2 && await J(I, () => !!document.querySelector('.pinpad')); k++) { for (const d of '1234') await I.click(`.pinpad [data-digit="${d}"]`); await I.waitForTimeout(250); }
    await I.waitForSelector('#pz-sync-line:not([hidden])', { timeout: 4000 });
    const line = await J(I, () => document.querySelector('#pz-sync-line').textContent);
    check(line === 'Synced · players and all four games', `Parents: "${line}"`);
    await shot(I, '02-ipad-parents');
    await J(I, () => window.__fractionFright.pz.close());

    console.log('\n=== the ipad plays offline: the wave waits, then syncs ===');
    online.ipad = false;
    const before = (await serverDoc(code, `${miaId}.ff`)).data.cures;
    check(await wave(I), 'the ipad played wave 2 offline');
    await ffSync(I, 'syncNow');
    const st = await J(I, () => window.__fractionFright.sync.status());
    const ipCures = (await mem(I)).cures;
    check(st.offline && st.pending >= 1 && (await serverDoc(code, `${miaId}.ff`)).data.cures === before && ipCures > before, `offline: ${st.pending} change(s) waiting, the server still has ${before} cures, the ipad ${ipCures}`);
    online.ipad = true;
    await ffSync(I, 'syncNow');
    check((await serverDoc(code, `${miaId}.ff`)).data.cures === ipCures, `back online: the server has the ipad's ${ipCures} cures`);
    await ffSync(L, 'pullNow');
    const lap2 = await mem(L);
    check(lap2.cures === ipCures && lap2.wavesLog.length === 2, `the laptop (in memory) got the ipad's wave (${lap2.cures} cures, 2 waves in the skills)`);

    console.log('\n=== both play offline → the 409 merge keeps every throw and wave ===');
    online.laptop = false; online.ipad = false;
    check(await wave(L), 'the laptop played wave 3 offline');
    check(await wave(I), 'the ipad played wave 3 offline too');
    await J(I, () => { const a = window.__fractionFright.app; a.save.cash += 3000; a.persist(); a.go('yard'); });
    await I.click('[data-buy="fence:iron"]');
    const lo = await mem(L), io = await mem(I);
    online.laptop = true; online.ipad = true;
    const n409 = apiLog.filter((r) => r.status === 409).length;
    await ffSync(L, 'syncNow');
    await ffSync(I, 'syncNow');
    await ffSync(L, 'pullNow');
    check(apiLog.filter((r) => r.status === 409).length > n409, 'the second device got a 409 and merged');
    const sF = (await serverDoc(code, `${miaId}.fracs`)).data, sS = (await serverDoc(code, `${miaId}.ff`)).data;
    const waveAts = [...new Set([...lo.wavesLog, ...io.wavesLog])].sort();
    check(JSON.stringify(sF.waves.map((w) => w.at).sort()) === JSON.stringify(waveAts) && waveAts.length === 4, `no wave lost: the server has all ${waveAts.length} (2 shared + 1 per device)`);
    const lastL = lo.throws.at(-1), lastI = io.throws.at(-1);
    const sThrows = Object.values(sF.records).flat().map((x) => x[0]);
    check(sThrows.includes(lastL) && sThrows.includes(lastI), "both devices' latest throws are in the merged records");
    check(sS.yard.owned.goo.includes('grape') && sS.yard.owned.fence.includes('iron'), 'no purchase lost: Grape goo (laptop) and the iron fence (ipad) both owned');
    const lm = await mem(L), im = await mem(I);
    check(JSON.stringify(lm.wavesLog) === JSON.stringify(im.wavesLog) && lm.cures === sS.cures && im.cures === sS.cures && lm.goo.join() === sS.yard.owned.goo.join(),
      `laptop, ipad and server agree (cures ${sS.cures}, ${lm.wavesLog.length} waves, in memory too)`);

    console.log('\n=== Trail Blazer on the same server and the same device ===');
    const metaBefore = (await ls(I, 'spellJump.sync')).keys;
    const ffRev = (await serverDoc(code, `${miaId}.ff`)).rev, frRev = (await serverDoc(code, `${miaId}.fracs`)).rev;
    await I.goto(TB, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__trailBlazer && window.__trailBlazer.sync);
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);
    await I.waitForTimeout(300);
    await J(I, () => { const a = window.__trailBlazer.app; a.save.cash += 75; a.persist(); });
    await J(I, () => window.__trailBlazer.sync.syncNow());
    const tbDoc = await serverDoc(code, `${miaId}.tb`);
    check(tbDoc && tbDoc.data.cash >= 75, `Trail Blazer pushed its own save (cash ${tbDoc && tbDoc.data.cash})`);
    const metaTB = (await ls(I, 'spellJump.sync')).keys;
    check(metaTB[`${miaId}.ff`] && metaTB[`${miaId}.ff`].rev === metaBefore[`${miaId}.ff`].rev && metaTB[`${miaId}.fracs`].rev === metaBefore[`${miaId}.fracs`].rev,
      "Trail Blazer kept Fraction Fright's sync metadata");
    check((await serverDoc(code, `${miaId}.ff`)).rev === ffRev && (await serverDoc(code, `${miaId}.fracs`)).rev === frRev, 'Trail Blazer did not touch the Fraction Fright docs on the server');
    await I.goto(FF, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__fractionFright);
    const n409b = apiLog.filter((r) => r.status === 409).length;
    await J(I, (id) => window.__fractionFright.app.selectPlayer(id), miaId);
    await ffSync(I, 'syncNow');
    check(apiLog.filter((r) => r.status === 409).length === n409b && (await serverDoc(code, `${miaId}.ff`)).rev === ffRev, 'back in Fraction Fright: in step with the server (no conflict, nothing to push)');
    const tbL = await J(L, async () => { await window.__fractionFright.sync.pullNow(); return JSON.parse(localStorage.getItem(`trailBlazer.${window.__fractionFright.app.currentPlayerId}.save`)); });
    check(tbL == null && (await serverDoc(code, `${miaId}.tb`)).rev === tbDoc.rev, "Fraction Fright syncs only its own kinds (and Spell Jump's): Mia's Trail Blazer save waits on the server for Trail Blazer");

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
  console.log('\nALL FRACTION FRIGHT SYNC CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
