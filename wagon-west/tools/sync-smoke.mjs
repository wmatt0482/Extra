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
// v1.5: the homestead: two devices build different pieces offline and both stay built; a spend on one device and a bank on the other both survive; a doc
// written by an older build (no farm, no ledger) merges without erasing them; "Reset this journey only" keeps the farm, the ledger and the card sets on both,
// and a fork chosen on one device is kept (the plan rebuilt); sets and decorations are unions.
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
    const miaId = await J(L, () => { const a = window.__wagonWest.app; const p = a.createPlayer('Mia', '#ff3b5c'); a.selectPlayer(p.id || p); window.__wagonWest.facts.xp = 5; return a.currentPlayerId; });      // (v1.5: Mia already has a Trail Blazer ladder: no Pit Crew Check card here)
    await J(L, () => { window.__wagonWest.app.outfitDone({ wagonName: 'Dusty', animal: 'oxen', companions: ['blacksmith', 'scout', 'cook'] }, { fresh: true }); });
    await L.waitForFunction(() => window.__wagonWest.peopleUI.isOpen);     // Independence's Talk row comes first now
    await L.click('#stop-go');
    await L.waitForSelector('#screen-store:not([hidden])');
    await L.click('#store-done');
    await L.waitForFunction(() => window.__wagonWest.card.isOpen);
    await L.click('#tc-go');
    // (v1.4: a trail fact's card or a dust devil may come first: a child taps through them)
    for (let k = 0; k < 150 && !(await J(L, () => window.__wagonWest.markerPanel.state === 'ask')); k++) {
      if (await J(L, () => window.__wagonWest.card.isOpen)) await L.click('#tc-go').catch(() => {});
      else await L.waitForTimeout(100);
    }
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

    console.log('\n=== v1.4: one device catches a sturgeon, the other skips seven stones: both records survive ===');
    online.laptop = false; online.ipad = false;
    await edit(L, (s) => {
      const Jn = s.journey;
      Jn.fishLog = Jn.fishLog || {}; Jn.finds = Jn.finds || {};
      Jn.fishLog['white-sturgeon'] = { n: 1, bestIn: 62, bestLb: 14, firstLeg: 'snake-river', firstSeason: Jn.season };
      Jn.fishBest = { species: 'white-sturgeon', in: 62 };
      Jn.finds.horseshoe = 2;
      Jn.wishes = ['oxen-fly'];
      Jn.dog = Jn.dog || { name: 'Frodo', coat: 'brown', legs: 1, nextBerries: 2, treats: 3, muddy: false };
    });
    await edit(I, (s) => {
      const Jn = s.journey;
      Jn.skips = { best: 7, throws: 3, byRiver: { 'kansas-river': 7 } };
      Jn.finds = Jn.finds || {};
      Jn.finds.pinecone = 1; Jn.finds.horseshoe = 1;
      Jn.wishes = ['apple-pie-rain'];
      Jn.fishLog = Jn.fishLog || {};
      Jn.fishLog['channel-catfish'] = { n: 2, bestIn: 20, bestLb: 5, firstLeg: 'kansas-river', firstSeason: Jn.season };
    });
    online.laptop = true; online.ipad = true;
    await wwSync(L, 'syncNow');
    await wwSync(I, 'syncNow');
    await wwSync(L, 'pullNow');
    await wwSync(I, 'pullNow');
    const f = (await serverDoc(code, `${miaId}.ww`)).data.journey;
    const v14 = (p) => J(p, () => { const Jn = window.__wagonWest.save.journey; return { sturgeon: Jn.fishLog && Jn.fishLog['white-sturgeon'] && Jn.fishLog['white-sturgeon'].bestIn, catfish: Jn.fishLog && Jn.fishLog['channel-catfish'] && Jn.fishLog['channel-catfish'].n, skips: Jn.skips && Jn.skips.best, horseshoe: Jn.finds && Jn.finds.horseshoe, pinecone: Jn.finds && Jn.finds.pinecone, wishes: (Jn.wishes || []).slice().sort(), best: Jn.fishBest && Jn.fishBest.in, dog: Jn.dog && Jn.dog.name }; });
    const lv = await v14(L), iv = await v14(I);
    check(f.fishLog && f.fishLog['white-sturgeon'] && f.fishLog['white-sturgeon'].bestIn === 62 && f.skips && f.skips.best === 7, `the server has both records: the sturgeon (${f.fishLog && f.fishLog['white-sturgeon'] && f.fishLog['white-sturgeon'].bestIn} in) and the seven skips (${f.skips && f.skips.best})`);
    check(f.finds && f.finds.horseshoe === 2 && f.finds.pinecone === 1, `the finds are the union: the bigger count per find (${JSON.stringify(f.finds)})`);
    check(f.fishLog['channel-catfish'] && f.fishLog['channel-catfish'].n === 2 && f.fishBest && f.fishBest.in === 62, 'the fish log merges per species and the personal best is the bigger fish');
    check(Array.isArray(f.wishes) && f.wishes.includes('oxen-fly') && f.wishes.includes('apple-pie-rain') && f.dog && f.dog.name === 'Frodo', `the wishes are the union and the dog is kept (${(f.wishes || []).join(', ')}, ${f.dog && f.dog.name})`);
    check(JSON.stringify(lv) === JSON.stringify(iv) && lv.sturgeon === 62 && lv.skips === 7 && lv.pinecone === 1, `laptop and ipad agree in memory too (${JSON.stringify(lv)})`);

    console.log('\n=== v1.5: the farm, the ledger and the sets across two devices ===');
    // both devices are synced and share a farm "Rose Hill" with a cabin and savings
    const farmOf = (p) => J(p, () => { const s = window.__wagonWest.save; const w = s.farm.sites.willamette; return { name: w && w.name, pieces: w ? { ...w.pieces } : null, sIn: s.farm.savingsIn, sOut: s.farm.savingsOut, gIn: s.farm.goldIn, gOut: s.farm.goldOut, journeys: s.ledger.journeys.map((j) => j.id), year: s.ledger.year, sets: s.setsDone.slice(), decor: s.cosmetics.owned.decor.slice(), forks: s.journey && { ...s.journey.branches }, plan: s.journey && s.journey.plan.length }; });
    await edit(L, (s) => { const JA = window.__wagonWest.JA; JA.foundSite(s.farm, 'willamette', { name: 'Rose Hill', year: 1847 }); s.farm.savingsIn = 100; s.farm.goldIn = 60; s.ledger.year = 1848; s.ledger.journeys.push({ id: 's1847-1', at: 5000, route: 'emigrant', branches: {}, tier: 'rookie', year: 1847, journeyN: 1, end: 'willamette', stars: 30, legs: 20 }); s.ledger.routesDone = ['oregon']; const r = JA.buildPiece(s.farm, 'willamette', 'cabin', s.journey); if (!r.ok) throw new Error('cabin ' + r.why); });
    await wwSync(L, 'syncNow'); await wwSync(I, 'pullNow');
    let fi = await farmOf(I);
    check(fi.name === 'Rose Hill' && fi.pieces && fi.pieces.cabin === 1 && fi.sIn === 100 && fi.journeys.length === 1 && fi.year === 1848, `the ipad got the farm (${fi.name}: ${Object.keys(fi.pieces || {}).join(', ')}), $${fi.sIn} in, the ledger (${fi.journeys.length} journey, year ${fi.year})`);
    online.laptop = false; online.ipad = false;
    // the laptop builds a well (a spend) and finishes a card set; the ipad builds the fence, banks a journey (an earning) and chooses nothing yet
    await edit(L, (s) => { const JA = window.__wagonWest.JA; const r = JA.buildPiece(s.farm, 'willamette', 'well', s.journey); if (!r.ok) throw new Error('well ' + r.why); s.setsDone.push('jumping-off'); s.cosmetics.owned.decor.push('sunflower-cover'); s.cosmetics.equipped.decor = ['sunflower-cover']; });
    await edit(I, (s) => { const JA = window.__wagonWest.JA; const r = JA.buildPiece(s.farm, 'willamette', 'fence', s.journey); if (!r.ok) throw new Error('fence ' + r.why); s.farm.savingsIn += 25; s.farm.goldIn += 15; s.setsDone.push('platte-road'); s.cosmetics.owned.decor.push('pennant-chimney'); });
    const fl0 = await farmOf(L), fi0 = await farmOf(I);
    online.laptop = true; online.ipad = true;
    await wwSync(L, 'syncNow'); await wwSync(I, 'syncNow'); await wwSync(L, 'pullNow'); await wwSync(I, 'pullNow');
    const fs = (await serverDoc(code, `${miaId}.ww`)).data;
    const sp = (fs.farm.sites.willamette || {}).pieces || {};
    check(sp.cabin === 1 && sp.well === 1 && sp.fence === 1, `both devices' pieces stay built on the server: ${Object.keys(sp).join(', ')}`);
    check(fs.farm.savingsIn === Math.max(fl0.sIn, fi0.sIn) && fs.farm.savingsIn === 125 && fs.farm.savingsOut === Math.max(fl0.sOut, fi0.sOut) && fs.farm.goldIn === 75, `a spend on one device and an earning on the other both survive (in $${fs.farm.savingsIn}, out $${fs.farm.savingsOut}, gold in ${fs.farm.goldIn}); a balance is never conjured: in - out = $${fs.farm.savingsIn - fs.farm.savingsOut}`);
    check(['jumping-off', 'platte-road'].every((x) => fs.setsDone.includes(x)) && ['sunflower-cover', 'pennant-chimney'].every((x) => fs.cosmetics.owned.decor.includes(x)), `the card sets and their decorations are unions (${fs.setsDone.join(', ')})`);
    const fl1 = await farmOf(L), fi1 = await farmOf(I);
    check(JSON.stringify(fl1.pieces) === JSON.stringify(fi1.pieces) && fl1.sIn === fi1.sIn && fl1.sOut === fi1.sOut && fl1.journeys.length === 1 && fi1.journeys.length === 1, 'laptop and ipad agree on the farm and the ledger in memory too');
    // an older build's doc (no farm, no ledger, no sets: its normalize drops what it does not know) merges without erasing them
    online.laptop = false; online.ipad = false;
    await edit(L, (s) => { s.letters.push({ at: 9500, leg: 'fort-kearny', season: 's1847', text: 'Dear Miss Carter,\nLaptop wrote this while the ipad ran an older build.' }); });
    await edit(I, (s) => { delete s.farm; delete s.ledger; delete s.setsDone; s.letters.push({ at: 9000, leg: 'fort-kearny', season: 's1847', text: 'Dear Grandma,\nAn older build wrote this.' }); });
    online.laptop = true; online.ipad = true;
    await wwSync(L, 'syncNow'); await wwSync(I, 'syncNow'); await wwSync(L, 'pullNow'); await wwSync(I, 'pullNow');
    const fo = (await serverDoc(code, `${miaId}.ww`)).data;
    check(fo.farm && fo.farm.sites.willamette && fo.farm.sites.willamette.pieces.well === 1 && fo.ledger && fo.ledger.journeys.length === 1 && fo.setsDone.includes('platte-road'), 'a doc written by an older build (no farm / ledger / sets) did not erase them in the merge');
    check((await farmOf(I)).pieces && (await farmOf(I)).pieces.well === 1 && (await farmOf(L)).sIn === 125, 'and both devices still have the farm');
    // a fork chosen on one device is kept; the plan is rebuilt
    online.laptop = false; online.ipad = false;
    await edit(L, (s) => { const w = window.__wagonWest; w.JA.chooseBranch(s.journey, 'fort-hall', 'california'); });
    const pl = await farmOf(L);
    online.laptop = true; online.ipad = true;
    await wwSync(L, 'syncNow'); await wwSync(I, 'syncNow'); await wwSync(L, 'pullNow'); await wwSync(I, 'pullNow');
    const pi = await farmOf(I);
    check(pl.forks && pl.forks['fort-hall'] === 'california' && pi.forks && pi.forks['fort-hall'] === 'california' && pi.plan > 20, `a fork chosen on the laptop is on the ipad too (Fort Hall: ${pi.forks && pi.forks['fort-hall']}, ${pi.plan} legs)`);
    // v1.6 (The Lab): the choice moments taken offline on two devices are a union by id (a choice is resolved once and never lost); a record on the later doc wins a clash
    online.laptop = false; online.ipad = false;
    await edit(L, (s) => { s.journey.choices = { ...(s.journey.choices || {}), 'ash-creek': { opt: 'b', at: 'ash-hollow', leg: 'chimney-rock', cut: 15, credit: 1, soakedLb: 0, fee: 0, guided: false, spirit: 0 } }; });
    await edit(I, (s) => { s.journey.choices = { ...(s.journey.choices || {}), 'ice-guide': { opt: 'a', at: 'ice-slough', leg: 'south-pass', cut: 0, credit: 0, soakedLb: 0, fee: 0, guided: false, spirit: 0 } }; });
    online.laptop = true; online.ipad = true;
    await wwSync(L, 'syncNow'); await wwSync(I, 'syncNow'); await wwSync(L, 'pullNow'); await wwSync(I, 'pullNow');
    const chOf = (p) => J(p, () => { const c = window.__wagonWest.save.journey.choices || {}; return Object.keys(c).sort().map((k) => `${k}:${c[k].opt}`).join(); });
    const chs = (await serverDoc(code, `${miaId}.ww`)).data.journey.choices || {};
    check(Object.keys(chs).sort().join() === 'ash-creek,ice-guide' && chs['ash-creek'].opt === 'b' && chs['ice-guide'].opt === 'a', `the choices taken on both devices are on the server (${Object.keys(chs).sort().join(', ')})`);
    check((await chOf(L)) === 'ash-creek:b,ice-guide:a' && (await chOf(I)) === 'ash-creek:b,ice-guide:a', 'laptop and ipad both have both choices in memory');
    // "Reset this journey only" keeps the farm, the ledger and the sets on both devices
    await J(L, (id) => window.__wagonWest.app.resetJourneyFor(id), miaId);
    await wwSync(L, 'syncNow'); await wwSync(I, 'pullNow');
    const rl = await farmOf(L), ri = await farmOf(I);
    check(rl.pieces && rl.pieces.well === 1 && ri.pieces && ri.pieces.well === 1 && ri.journeys.length === 1 && ri.sets.includes('platte-road'), 'Reset this journey only: the farm, the ledger and the sets are still there on both devices');
    check(ri.forks && Object.keys(ri.forks).length === 0, 'and the ipad took the new journey (the old one was written before the stamp)');

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
