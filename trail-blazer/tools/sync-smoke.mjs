// Trail Blazer family sync, end to end (SPEC v1.6), modelled on car-jump/tools/sync-smoke.mjs:
//   node trail-blazer/tools/sync-smoke.mjs        (serves the REPO ROOT on :8080 itself if nothing listens there)
// Two Playwright browser contexts, "laptop" (1280×800) and "ipad" (1024×768, touch), on
// /trail-blazer/index.html?mock=1&nosw=1. `route('**/api/family/**')` on both answers from ONE in-memory store in this
// process through the real request handler (car-jump/src/sync/protocol.mjs), so both devices talk to the same server;
// a device goes offline by having its route abort.
// Flow: laptop creates Mia and a family code → the ipad joins → the laptop buys the Dune Quad and races (answers
// gates) → the ipad shows the quad (garage) and the facts → the ipad races offline: the cash waits ("Offline …"), then
// syncs and the laptop gets it → both race offline (different facts) → after the 409 merge no fact record is lost and
// laptop, ipad and server agree → Spell Jump on the same server (the ipad, same origin) still syncs its own keys and
// keeps Trail Blazer's sync metadata. No console errors (the protocol's 404 / 409 and offline aborts are expected).
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handle, memoryStore } from '../../car-jump/src/sync/protocol.mjs';
import { handleTts, memoryTtsStore } from '../../car-jump/src/tts/server.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const TB = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
const SJ = BASE + '/spell-jump/index.html?mock=1&nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'trail-blazer-sync-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/trail-blazer/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const srv = spawn('python3', ['-m', 'http.server', '8080'], { cwd: repoRoot, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
let passed = 0;
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else { passed++; console.log('  ✓ ' + msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the shared server ----------
const store = memoryStore();
const online = { laptop: true, ipad: true };
const apiLog = [];
const ttsStore = memoryTtsStore();
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
  await ctx.route('**/api/tts/**', async (route) => {
    const req = route.request();
    if (!online[name]) { await route.abort('internetdisconnected'); return; }
    const u = new URL(req.url());
    const res = await handleTts({ method: req.method(), path: u.pathname, contentType: req.headers()['content-type'], body: req.postData() },
      { store: ttsStore, families: { exists: async (code) => !!(await store.get(`${code}/family`)) }, synthesize: null });
    await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
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
    if (!sessionStorage.getItem('tbSyncSeeded')) { localStorage.clear(); sessionStorage.setItem('tbSyncSeeded', '1'); }
    window.__mockScript = { noCrash: true };
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); },
      cancel() {}, addEventListener() {},
    };
  });
  await page.goto(TB, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__trailBlazer);
  return { name, ctx, page, errors };
}

const J = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const ls = (page, key) => J(page, (k) => JSON.parse(localStorage.getItem(k)), key);
const tbSync = (page, what) => J(page, (w) => window.__trailBlazer.sync[w](), what);
const mem = (page) => J(page, () => { const T = window.__trailBlazer; return { cash: T.app.save.cash, vehicle: T.app.save.vehicle, quad: !!(T.app.save.vehicles.quad && T.app.save.vehicles.quad.owned), facts: T.facts ? Object.keys(T.facts.records).sort() : [] }; });

async function typeAnswer(page, value) {
  for (const ch of String(value)) await page.click(`#gate .np-key[data-key="${ch}"]`);
  await page.click('#gate .np-key[data-key="go"]');
}
// a mock race from the debug handle (no Pit Crew Check card, no coach), every gate answered right
async function race(page, trailId = 'pine-ridge') {
  await J(page, (id) => { const a = window.__trailBlazer.app; a.save.seen.coach = true; a.startRide(id, { skipCheck: true }); }, trailId);
  await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const st = await J(page, () => { const g = window.__trailBlazer.gate; return { results: window.__trailBlazer.screen === 'results', gate: g.open && g.state === 'ask', answer: g.answer, index: g.index }; });
    if (st.results) { await page.waitForTimeout(400); return true; }
    if (st.gate) { await typeAnswer(page, st.answer); await page.waitForFunction((i) => !window.__trailBlazer.gatePanel.isOpen || window.__trailBlazer.gate.index > i, st.index, { timeout: 4000 }); }
    else await page.waitForTimeout(100);
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

    console.log('\n=== laptop: a player and a family code; the ipad joins ===');
    const miaId = await J(L, () => { const a = window.__trailBlazer.app; const p = a.createPlayer('Mia', '#ff3b5c'); a.selectPlayer(p.id || p); return a.currentPlayerId; });
    const created = await J(L, () => window.__trailBlazer.sync.create());
    const code = created.code;
    check(created.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), `the laptop created family ${code}`);
    const joined = await J(I, (c) => window.__trailBlazer.sync.join(c), code);
    check(joined.ok && joined.players.some((p) => p.name === 'Mia'), 'the ipad joined: Mia is in its family');
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);

    console.log('\n=== the laptop buys the Dune Quad and races; the ipad gets both ===');
    await J(L, () => { const a = window.__trailBlazer.app; a.save.cash += 170000; a.persist(); a.go('garage'); });
    await L.click('[data-vehicle="quad"]');
    await L.click('#btn-garage-ride');
    check((await mem(L)).quad, 'the laptop bought the Dune Quad in the garage');
    check(await race(L), 'the laptop raced Pine Ridge (every gate answered)');
    const lap1 = await mem(L);
    check(lap1.facts.length >= 3, `the laptop's facts: ${lap1.facts.join(' ')}`);
    await tbSync(L, 'syncNow');
    const tb1 = await serverDoc(code, `${miaId}.tb`), fx1 = await serverDoc(code, `${miaId}.facts`);
    check(tb1 && tb1.data.vehicles.quad && tb1.data.vehicles.quad.owned && fx1 && Object.keys(fx1.data.records).length === lap1.facts.length,
      `the server has <id>.tb (the quad, cash ${tb1 && tb1.data.cash}) and <id>.facts (${fx1 && Object.keys(fx1.data.records).length} records, stored compact)`);
    await J(I, () => window.__trailBlazer.app.go('title'));
    await tbSync(I, 'pullNow');
    const ip1 = await mem(I);
    check(ip1.quad && ip1.vehicle === 'quad' && ip1.cash === lap1.cash, `the ipad (in memory) owns the quad and drives it, cash ${ip1.cash}`);
    check(JSON.stringify(ip1.facts) === JSON.stringify(lap1.facts), `the ipad has the laptop's facts (${ip1.facts.length})`);
    await J(I, () => window.__trailBlazer.app.go('garage'));
    check(await J(I, () => /Driving/.test(document.querySelector('[data-vehicle="quad"]').textContent)), 'the ipad garage shows the Dune Quad driving');
    await shot(I, '01-ipad-garage-quad');
    await J(I, () => window.__trailBlazer.app.go('title'));
    await J(I, () => window.__trailBlazer.pz.open({ tab: 'sync' }));
    await I.waitForTimeout(300);
    for (let k = 0; k < 2 && await J(I, () => !!document.querySelector('.pinpad')); k++) {   // no PIN yet: choose one (twice)
      for (const dgt of '1234') await I.click(`.pinpad [data-digit="${dgt}"]`);
      await I.waitForTimeout(250);
    }
    await I.waitForSelector('#pz-sync-line:not([hidden])', { timeout: 4000 });
    const line = await J(I, () => document.querySelector('#pz-sync-line').textContent);
    check(line === 'Synced · players, Spell Jump and Trail Blazer progress', `Parents: "${line}"`);
    await shot(I, '02-ipad-parents-synced');
    await J(I, () => window.__trailBlazer.pz.close());

    console.log('\n=== the ipad races offline: the cash waits, then syncs ===');
    online.ipad = false;
    const before = (await serverDoc(code, `${miaId}.tb`)).data.cash;
    check(await race(I, 'pine-ridge'), 'the ipad raced offline');
    await tbSync(I, 'syncNow');
    const st = await J(I, () => window.__trailBlazer.sync.status());
    const ipCash = (await mem(I)).cash;
    check(st.offline && st.pending >= 1 && (await serverDoc(code, `${miaId}.tb`)).data.cash === before && ipCash > before, `offline: ${st.pending} change(s) waiting, the server still has $${before}, the ipad $${ipCash}`);
    online.ipad = true;
    await tbSync(I, 'syncNow');
    check((await serverDoc(code, `${miaId}.tb`)).data.cash === ipCash, `back online: the server has the ipad's $${ipCash}`);
    await tbSync(L, 'pullNow');
    check((await mem(L)).cash === ipCash, `the laptop (in memory) got the ipad's cash ($${ipCash})`);

    console.log('\n=== a device that already had Trail Blazer progress (before 1.6) merges it, never loses it ===');
    // the ipad forgets its Trail Blazer sync bookkeeping (as a 1.5 device in the family had none) and owns a Rock Bawler
    // only it knows about; the next start pulls: the server's quad and the local buggy are both kept, then uploaded
    await J(I, (id) => {
      const a = window.__trailBlazer.app; a.persist = () => {}; a.persistFacts = () => {};   // the page's own pagehide save must not undo this
      const st = JSON.parse(localStorage.getItem('spellJump.sync')); delete st.keys[`${id}.tb`]; delete st.keys[`${id}.facts`]; localStorage.setItem('spellJump.sync', JSON.stringify(st));
      const sv = JSON.parse(localStorage.getItem(`trailBlazer.${id}.save`)); sv.vehicles.buggy = { owned: true, levels: { engine: 4, tires: 0, suspension: 0, boost: 0 } }; localStorage.setItem(`trailBlazer.${id}.save`, JSON.stringify(sv));
    }, miaId);
    await I.reload({ waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__trailBlazer && window.__trailBlazer.sync.status().lastSync > 0, null, { timeout: 8000 });
    await J(I, () => window.__trailBlazer.sync.syncNow());
    const merged = await ls(I, `trailBlazer.${miaId}.save`), srvTb = (await serverDoc(code, `${miaId}.tb`)).data;
    check(merged.vehicles.buggy && merged.vehicles.quad && srvTb.vehicles.buggy && srvTb.vehicles.quad && srvTb.vehicles.buggy.levels.engine === 4,
      'the ipad merged the server\'s Trail Blazer save into its own: the quad and its local Rock Bawler both kept, and uploaded');
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);
    await tbSync(L, 'pullNow');
    check(await J(L, () => !!(window.__trailBlazer.app.save.vehicles.buggy && window.__trailBlazer.app.save.vehicles.buggy.owned)), 'the laptop got the Rock Bawler');

    console.log('\n=== both race offline (different facts) → the 409 merge keeps every fact record ===');
    online.laptop = false; online.ipad = false;
    // each device gets its own new facts: manual sets that do not overlap
    await J(L, () => { const T = window.__trailBlazer; T.facts.sets = { ...T.facts.sets, mode: 'manual', source: 'families', families: ['x6'], division: false, addSub: false, updatedAt: Date.now() }; T.app.persistFacts(); });
    await J(I, () => { const T = window.__trailBlazer; T.facts.sets = { ...T.facts.sets, mode: 'manual', source: 'families', families: ['x9'], division: false, addSub: false, updatedAt: Date.now() - 5000 }; T.app.persistFacts(); });
    check(await race(L, 'pine-ridge'), 'the laptop raced offline (×6 facts)');
    check(await race(I, 'pine-ridge'), 'the ipad raced offline (×9 facts)');
    const lf = await mem(L), inf = await mem(I);
    const union = [...new Set([...lf.facts, ...inf.facts])].sort();
    check(lf.facts.some((f) => !inf.facts.includes(f)) && inf.facts.some((f) => !lf.facts.includes(f)), `different facts on each device (laptop ${lf.facts.length}, ipad ${inf.facts.length})`);
    online.laptop = true; online.ipad = true;
    const n409 = apiLog.filter((r) => r.status === 409).length;
    await tbSync(L, 'syncNow');
    await tbSync(I, 'syncNow');
    await tbSync(L, 'pullNow');
    check(apiLog.filter((r) => r.status === 409).length > n409, 'the second device got a 409 and merged');
    const sf = (await serverDoc(code, `${miaId}.facts`)).data;
    check(JSON.stringify(Object.keys(sf.records).sort()) === JSON.stringify(union), `no fact record lost: the server has all ${union.length} (${union.join(' ')})`);
    const lf2 = await mem(L), if2 = await mem(I);
    check(JSON.stringify(lf2.facts) === JSON.stringify(union) && JSON.stringify(if2.facts) === JSON.stringify(union), 'laptop, ipad and server agree on the fact records (in memory too)');
    const att = (d, f) => (d.records[f] || {}).attempts || 0;
    const lsF = await ls(L, `trailBlazer.${miaId}.facts`), isF = await ls(I, `trailBlazer.${miaId}.facts`);
    check(union.every((f) => att(lsF, f) === att(sf, f) && att(isF, f) === att(sf, f) && att(sf, f) >= 1), 'every record has the same attempts on the laptop, the ipad and the server');
    const sets = (await J(L, () => window.__trailBlazer.facts.sets.families)).join();
    check(sets === 'x6', `the parent's later set wins (the laptop's ×6: ${sets})`);
    const tbL = await ls(L, `trailBlazer.${miaId}.save`), tbS = (await serverDoc(code, `${miaId}.tb`)).data;
    check(tbL.cash === tbS.cash && tbL.vehicles.quad.owned && (await mem(I)).cash === tbS.cash, `the save agrees too (cash $${tbS.cash}, the quad kept)`);

    console.log('\n=== Spell Jump on the same server and the same device ===');
    const metaBefore = (await ls(I, 'spellJump.sync')).keys;
    const tbRev = (await serverDoc(code, `${miaId}.tb`)).rev, fxRev = (await serverDoc(code, `${miaId}.facts`)).rev;
    await I.goto(SJ, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__spellJump && window.__spellJump.sync);
    await J(I, (id) => { const a = window.__spellJump.app; a.selectPlayer(id); }, miaId);
    await I.waitForTimeout(300);
    await J(I, () => { const a = window.__spellJump.app; a.save.cash += 75; a.persist(); });
    await J(I, () => window.__spellJump.sync.syncNow());
    const sjDoc = await serverDoc(code, `${miaId}.save`);
    check(sjDoc && sjDoc.data.cash >= 75, `Spell Jump pushed its own save (cash ${sjDoc && sjDoc.data.cash})`);
    const metaSJ = (await ls(I, 'spellJump.sync')).keys;
    check(metaSJ[`${miaId}.tb`] && metaSJ[`${miaId}.tb`].rev === metaBefore[`${miaId}.tb`].rev && metaSJ[`${miaId}.facts`].rev === metaBefore[`${miaId}.facts`].rev,
      `Spell Jump kept Trail Blazer's sync metadata (tb rev ${metaSJ[`${miaId}.tb`] && metaSJ[`${miaId}.tb`].rev}, facts rev ${metaSJ[`${miaId}.facts`] && metaSJ[`${miaId}.facts`].rev})`);
    check((await serverDoc(code, `${miaId}.tb`)).rev === tbRev && (await serverDoc(code, `${miaId}.facts`)).rev === fxRev, 'Spell Jump did not touch the Trail Blazer docs on the server');
    await I.goto(TB, { waitUntil: 'networkidle' });
    await I.waitForFunction(() => window.__trailBlazer);
    const n409b = apiLog.filter((r) => r.status === 409).length;
    await J(I, (id) => window.__trailBlazer.app.selectPlayer(id), miaId);
    await tbSync(I, 'syncNow');
    check(apiLog.filter((r) => r.status === 409).length === n409b && (await serverDoc(code, `${miaId}.tb`)).rev === tbRev,
      'back in Trail Blazer: in step with the server (no conflict, nothing to push)');
    const sjL = await J(L, async () => { await window.__trailBlazer.sync.pullNow(); return JSON.parse(localStorage.getItem(`spellJump.${window.__trailBlazer.app.currentPlayerId}.save`)); });
    check(sjL && sjL.cash === sjDoc.data.cash, "the laptop's Trail Blazer pulled Mia's Spell Jump save too (same family code)");

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
  console.log('\nALL TRAIL BLAZER SYNC CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
