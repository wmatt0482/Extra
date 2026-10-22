// Family sync, end to end, with two devices sharing one "server":
//   cd car-jump && python3 -m http.server 8080 &      (the script starts one itself if needed)
//   SHOTS_DIR=/some/dir node tools/sync-smoke.mjs
// Two Playwright browser contexts, "laptop" (1280×800) and "ipad" (1024×768, touch), both on
// index.html?nosw=1&mock=1 with a fake speechSynthesis. `page.route('**/api/family/**')` on both contexts answers
// from ONE in-memory store in this process through the real request handler (src/sync/protocol.mjs), so the two
// devices talk to the same server; a device "goes offline" by having its route abort.
// Flow: laptop creates Mia, sets the PIN, creates a family code → ipad (no players) opens Parents from the picker
// (the Family code tab opens first), a wrong code says "That code was not found", the right one joins → Mia on the ipad picker, same PIN →
// laptop saves a 6-word list → the ipad has it after one poll (visibilitychange) → ipad plays the Qualifier + a mock
// run and earns cash → the laptop sees the cash after a pull → ipad offline: another run, the cash waits ("Offline,
// will sync…") → back online: pushed, the laptop sees it → laptop adds Leo (ipad gets him) and removes him (ipad
// drops him) → both devices change Mia's words while offline → after sync no word record is lost (merge on 409).
// Asserts no console errors (expected 404 / 409 / offline answers from /api/family are allowed). Screenshots the
// Family sync tab states.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handle, memoryStore } from '../src/sync/protocol.mjs';
import { handleTts, memoryTtsStore } from '../src/tts/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'spell-jump-sync-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const srv = spawn('python3', ['-m', 'http.server', '8080'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 10000, step = 100) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return v; await sleep(step); }
}

// ---------- the shared "server" ----------
const store = memoryStore();
const online = { laptop: true, ipad: true };
const apiLog = [];
const ttsStore = memoryTtsStore();
const ttsLog = [];          // natural voice requests (status only: this server has no Google key)
const serverDoc = async (code, key) => { const e = await store.get(`${code}/${key}`); return e ? e.value : null; };

const fontCache = new Map();
async function routeFonts(ctx) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) fontCache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: fontCache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
}

async function device(browser, name, opts) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', async (route) => {
    const req = route.request();
    if (!online[name]) { apiLog.push({ name, method: req.method(), status: 'offline' }); await route.abort('internetdisconnected'); return; }
    const u = new URL(req.url());
    const res = await handle({ method: req.method(), path: u.pathname, contentType: req.headers()['content-type'], body: req.postData() }, store);
    apiLog.push({ name, method: req.method(), path: u.pathname, status: res.status });
    await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
  // natural voice API (v3.4) through the real handler, as a server without the Google key: devices in a family ask
  // /api/tts/status, get { key: false } and keep the device voice (nothing is prepared)
  await ctx.route('**/api/tts/**', async (route) => {
    const req = route.request();
    if (!online[name]) { await route.abort('internetdisconnected'); return; }
    const u = new URL(req.url());
    const res = await handleTts({ method: req.method(), path: u.pathname, contentType: req.headers()['content-type'], body: req.postData() },
      { store: ttsStore, families: { exists: async (code) => !!(await store.get(`${code}/family`)) }, synthesize: null });
    ttsLog.push({ name, method: req.method(), path: u.pathname, status: res.status });
    await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const where = (m.location() && m.location().url) || '';
    if (/fonts\.(googleapis|gstatic)/.test(m.text() + where)) return;
    // the protocol's own answers (404 unknown code, 409 conflict) and offline aborts are expected, not bugs
    if (/\/api\/(family|tts)\//.test(where) && /status of (404|409)|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/.test(m.text())) return;
    errors.push(`${name}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('syncSeeded')) { localStorage.clear(); sessionStorage.setItem('syncSeeded', '1'); }
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); },
      cancel() {}, addEventListener() {},
    };
  });
  await page.goto(BASE + '/index.html?nosw=1&mock=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  return { name, ctx, page, errors };
}

const visibleSel = (sel) => `${sel}:not([hidden])`;
const J = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const lsJSON = (page, key) => J(page, (k) => JSON.parse(localStorage.getItem(k)), key);
const syncStatus = (page) => J(page, () => window.__spellJump.sync.status());
const pullNow = (page) => J(page, () => window.__spellJump.sync.pullNow());
const familyIds = async (page) => ((await lsJSON(page, 'spellJump.family')) || { players: [] }).players.map((p) => p.name);
const pickerNames = (page) => J(page, () => [...document.querySelectorAll('#player-grid [data-player] .pl-name')].map((e) => e.textContent));

async function typeName(page, name) {
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  await page.keyboard.type(name.toLowerCase(), { delay: 20 });
  await page.keyboard.press('Enter');
  await page.waitForSelector(visibleSel('#screen-title'));
}
async function pinPad(page, digits) {
  for (const d of digits) await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForTimeout(250);
}
async function setPin(page, pin) {
  await page.waitForSelector('#pin-title');
  await pinPad(page, pin);
  await page.waitForFunction(() => document.querySelector('.pin-wrap') && document.querySelector('.pin-wrap').dataset.pinMode === 'confirm');
  await pinPad(page, pin);
  await page.waitForFunction(() => document.querySelector('#pz').dataset.view === 'main');
}
async function syncTab(page) {
  await page.waitForSelector('.pz-tabs [data-tab="sync"]');
  await page.click('.pz-tabs [data-tab="sync"]');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
}
const statusText = (page) => page.textContent('#sync-status');          // Family code tab, when in a family
const lineText = async (page) => (await page.textContent('#pz-sync-line')).trim();   // under the Parent Zone title

// Qualifier with every word right (pays $100 a word)
async function qualifier(page) {
  await page.waitForSelector(visibleSel('#screen-test'));
  await page.click('#tm-go');
  for (;;) {
    await page.waitForFunction(() => {
      const r = document.querySelector('#screen-test');
      return (r.dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled')) || (r.dataset.mode === 'done' && document.querySelector('#tm-go'));
    }, null, { timeout: 12000 });
    if (await J(page, () => document.querySelector('#screen-test').dataset.mode === 'done')) break;
    const w = await J(page, () => window.__spellJump.testScreen.word);
    await page.keyboard.type(w, { delay: 15 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode !== 'ask', null, { timeout: 5000 });
  }
  await page.click('#tm-go');
  await page.waitForSelector(visibleSel('#screen-garage'));
}
// one mock run from the garage: race → canyon → spell the word(s) → drive → results
async function mockRun(page) {
  await page.click('#btn-race');
  await page.waitForSelector(visibleSel('#screen-tracks'));
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 6000 });
  while (await J(page, () => window.__spellJump.spellPanel.isOpen)) {
    const ok = await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen || (window.__spellJump.spellPanel.mode === 'write' && !document.querySelector('#sp-keyboard').classList.contains('is-disabled')), null, { timeout: 12000 }).then(() => true, () => false);
    if (!ok || !(await J(page, () => window.__spellJump.spellPanel.isOpen))) break;
    const w = await J(page, () => window.__spellJump.spellPanel.word);
    await page.keyboard.type(w, { delay: 15 });
    await page.keyboard.press('Enter');
    await page.waitForFunction((word) => !window.__spellJump.spellPanel.isOpen || window.__spellJump.spellPanel.word !== word || window.__spellJump.spellPanel.mode !== 'write', w, { timeout: 6000 });
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(200);
  if (await J(page, () => !document.querySelector('#coach').hidden)) await page.click('#coach');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 25000 });
  await page.waitForTimeout(400);
}

async function main() {
  const srv = await ensureServer();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const laptop = await device(browser, 'laptop', { viewport: { width: 1280, height: 800 } });
  const ipad = await device(browser, 'ipad', { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const L = laptop.page, I = ipad.page;
  const PIN = '2468';

  try {
    console.log('\n=== sync off: nothing goes to the network ===');
    await L.waitForSelector(visibleSel('#screen-players'));
    check(apiLog.length === 0, 'no /api/family requests before a family exists');
    check(await J(L, () => window.__spellJump.app.version) === '3.7.1', 'app version 3.7.1');

    console.log('\n=== laptop: Mia, PIN, Create family code ===');
    await typeName(L, 'Mia');
    const miaId = (await lsJSON(L, 'spellJump.family')).players[0].id;
    await L.click('#btn-parents');
    await setPin(L, PIN);
    check(await J(L, () => document.querySelector('.pz-content').dataset.tab === 'sync' && document.querySelector('.pz-tabs [data-tab]').dataset.tab === 'sync'), 'Parent Zone opens on Family code, the first tab');
    check(await lineText(L) === 'Not synced · tap to set up family sync', `status line: "${await lineText(L)}"`);
    check(/No emails or accounts\. Anyone with the family code can see and change these, so keep it private\./.test(await L.textContent('#sync-privacy')), 'privacy note shown');
    await shot(L, '01-laptop-not-synced');
    await L.click('#sync-create');
    await L.waitForSelector('#sync-code');
    const code = (await L.textContent('#sync-code')).trim();
    check(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(code), `family code ${code} (8 characters, no look-alikes)`);
    check(/^Synced as [A-Z0-9-]+ · last sync just now$/.test((await statusText(L)).trim()), `status: "${(await statusText(L)).trim()}"`);
    check(await lineText(L) === `Family code ${code} · synced just now`, `status line: "${await lineText(L)}"`);
    check(await J(L, () => document.querySelector('.pz-content').firstElementChild.contains(document.querySelector('#sync-code'))), 'the code is the first thing on the tab');
    for (const t of ['words', 'report', 'options']) {
      await L.click(`.pz-tabs [data-tab="${t}"]`);
      check(await lineText(L) === `Family code ${code} · synced just now`, `${t} tab: the status line shows the code`);
    }
    await L.click('#pz-sync-line');
    await L.waitForSelector('#sync-code');
    await shot(L, '02-laptop-created');
    const fam1 = await serverDoc(code, 'family');
    check(fam1 && fam1.rev >= 1 && fam1.data.players.map((p) => p.name).join() === 'Mia' && fam1.data.pinHash, 'server: family doc with Mia and the hashed PIN');
    check(!!(await until(() => serverDoc(code, `${miaId}.save`))) && !!(await serverDoc(code, `${miaId}.words`)), "server: Mia's save and words uploaded");
    await L.click('#pz-close');

    console.log('\n=== ipad: join from the picker ===');
    await I.waitForSelector(visibleSel('#screen-players'));
    check(await J(I, () => document.querySelector('#sync-chip').hidden && !document.querySelector('#btn-parents-picker').closest('[hidden]')), 'ipad picker (no players): a Parents button, no sync chip');
    await I.click('#btn-parents-picker');
    await setPin(I, '1357');
    await I.waitForSelector('#sync-join-input');
    await shot(I, '03-ipad-join-empty');
    await I.fill('#sync-join-input', 'ZZZZ-9999');
    await I.click('#sync-join');
    await I.waitForFunction(() => /not found/.test(document.querySelector('#sync-msg').textContent));
    check((await I.textContent('#sync-msg')).trim() === 'That code was not found', 'unknown code: "That code was not found"');
    await shot(I, '04-ipad-not-found');
    await I.fill('#sync-join-input', code.toLowerCase().replace('-', ' '));
    await I.click('#sync-join');
    await I.waitForSelector('#sync-players');
    check((await I.textContent('#sync-players')).includes('Mia'), 'joined: the merged player list shows Mia');
    check(/^Synced as /.test((await statusText(I)).trim()), `ipad status: "${(await statusText(I)).trim()}"`);
    await shot(I, '05-ipad-joined');
    check((await lsJSON(I, 'spellJump.family')).pinHash === (await lsJSON(L, 'spellJump.family')).pinHash, "ipad adopted the family's parent PIN");
    await I.click('#pz-close');
    await I.waitForSelector('#player-grid [data-player]');
    check((await pickerNames(I)).join() === 'Mia', `ipad picker: ${await pickerNames(I)}`);
    check((await I.textContent('#sync-chip')).trim() === `Synced · ${code}`, `ipad picker chip: "${(await I.textContent('#sync-chip')).trim()}"`);
    await shot(I, '06-ipad-picker-synced');

    console.log('\n=== laptop saves a 6-word list → the ipad has it after one poll ===');
    const SIX = ['enough', 'through', 'neighbor', 'friend', 'because', 'thought'];
    await L.click('#btn-parents');
    await L.click('.pz-tabs [data-tab="words"]');
    await L.waitForSelector('#pz-words');
    await L.fill('#pz-words', SIX.join('\n'));
    await L.click('#pz-save');
    await L.click('#pz-close');
    const listOnServer = await until(async () => { const d = await serverDoc(code, `${miaId}.words`); return d && d.data.lists.find((l) => l.id === d.data.activeId).words.length === 6 && d; }, 8000);
    check(!!listOnServer, `laptop pushed the list (words rev ${listOnServer && listOnServer.rev}) within the 2 s debounce`);
    await J(I, () => document.dispatchEvent(new Event('visibilitychange')));
    const ipadList = await until(async () => { const d = await lsJSON(I, `spellJump.${miaId}.words`); const l = d && d.lists.find((x) => x.id === d.activeId); return l && l.words.length === 6 ? l.words.map((w) => w.word) : null; }, 6000);
    check(ipadList && ipadList.join() === SIX.join(), `ipad has the list after one poll (visibilitychange): ${ipadList}`);

    console.log('\n=== ipad plays (Qualifier + one mock run) → the laptop sees the cash ===');
    await I.click('#player-grid [data-player]');
    await I.waitForSelector(visibleSel('#screen-title'));
    await J(I, async () => { const S = window.__spellJump, P = await import('/src/spelling/profiles.js'); P.setPlayerOption(S.app.family, S.app.currentPlayerId, 'wordsPerRace', 1); S.app.persistFamily(); });
    check(/new words/i.test(await I.textContent('#btn-play')), 'ipad: PLAY announces the new words from the laptop');
    await I.click('#btn-play');
    await qualifier(I);
    await mockRun(I);
    const ipadCash1 = await J(I, () => window.__spellJump.app.save.cash);
    check(ipadCash1 >= 600, `ipad earned $${ipadCash1} (Qualifier $600 + the run)`);
    const pushed1 = await until(async () => { const d = await serverDoc(code, `${miaId}.save`); return d && d.data.cash === ipadCash1; }, 8000);
    check(pushed1, 'ipad pushed the cash');
    await pullNow(L);
    const laptopCash1 = await J(L, () => window.__spellJump.app.save.cash);
    check(laptopCash1 === ipadCash1, `laptop sees $${laptopCash1} after a pull (and in memory, on the title)`);
    check((await L.textContent('#screen-title [data-cash]')).replace(/\D/g, '') === String(ipadCash1), 'laptop title cash display updated');

    console.log('\n=== ipad offline: another run, the cash waits, then syncs ===');
    online.ipad = false;
    await I.click('#res-garage').catch(async () => { await J(I, () => window.__spellJump.app.go('garage')); });
    await I.waitForSelector(visibleSel('#screen-garage'));
    await mockRun(I);
    const ipadCash2 = await J(I, () => window.__spellJump.app.save.cash);
    check(ipadCash2 > ipadCash1, `ipad earned more offline: $${ipadCash1} → $${ipadCash2}`);
    const off = await until(async () => { const s = await syncStatus(I); return s.offline && s.pending > 0 && s; }, 8000);
    check(!!off, `ipad sync is offline with ${off && off.pending} change(s) waiting`);
    check((await serverDoc(code, `${miaId}.save`)).data.cash === ipadCash1, 'server still has the old cash');
    await I.click('#res-garage').catch(() => {});
    await J(I, () => window.__spellJump.app.go('title'));
    await I.click('#btn-parents');
    await I.waitForSelector('#pz-body');
    await syncTab(I);
    check(/^Offline, will sync when back online/.test((await statusText(I)).trim()), `ipad Family sync tab: "${(await statusText(I)).trim()}"`);
    await shot(I, '07-ipad-offline');
    online.ipad = true;
    await J(I, () => window.dispatchEvent(new Event('online')));
    const pushed2 = await until(async () => { const d = await serverDoc(code, `${miaId}.save`); return d && d.data.cash === ipadCash2; }, 8000);
    check(pushed2, 'back online: the waiting cash was pushed');
    await I.waitForFunction(() => /^Synced as /.test(document.querySelector('#sync-status').textContent), null, { timeout: 5000 });
    await shot(I, '08-ipad-back-online');
    await pullNow(L);
    check(await J(L, () => window.__spellJump.app.save.cash) === ipadCash2, `laptop sees $${ipadCash2}`);
    await I.click('#pz-close');

    console.log('\n=== laptop adds Leo, then removes him ===');
    await L.click('#btn-player');
    await L.waitForSelector(visibleSel('#screen-players'));
    check((await L.textContent('#sync-chip')).trim() === `Synced · ${code}`, 'laptop picker chip shows the family code');
    await shot(L, '09-laptop-picker-chip');
    await typeName(L, 'Leo');
    const leoId = (await lsJSON(L, 'spellJump.family')).players.find((p) => p.name === 'Leo').id;
    await until(async () => { const f = await serverDoc(code, 'family'); return f && f.data.players.some((p) => p.id === leoId); }, 8000);
    await I.click('#btn-player');
    await I.waitForSelector(visibleSel('#screen-players'));
    await pullNow(I);
    check((await pickerNames(I)).join() === 'Mia,Leo', `ipad picker after a pull: ${await pickerNames(I)}`);
    await L.click('#btn-parents');
    await L.waitForSelector('.pz-tabs');
    await L.click('.pz-tabs [data-tab="options"]');
    await L.click(`.pz-players [data-player="${leoId}"]`);
    await L.click('#opt-remove');
    await L.click('#opt-remove-yes');
    await L.click('#pz-close').catch(() => {});
    const tomb = await until(async () => { const f = await serverDoc(code, 'family'); return f && f.data.removedPlayers.includes(leoId) && !f.data.players.some((p) => p.id === leoId); }, 8000);
    check(tomb, 'server family doc: Leo tombstoned in removedPlayers');
    await pullNow(I);
    check((await pickerNames(I)).join() === 'Mia', `ipad picker drops Leo: ${await pickerNames(I)}`);
    check(await J(I, (id) => localStorage.getItem(`spellJump.${id}.save`) === null && localStorage.getItem(`spellJump.${id}.words`) === null, leoId), "ipad deleted Leo's local data");
    check(!(await serverDoc(code, 'family')).data.players.some((p) => p.id === leoId) && !!(await serverDoc(code, `${leoId}.save`)), "server keeps Leo's blobs (tombstone, not DELETE) but GET no longer lists him");

    console.log('\n=== both devices change Mia\'s words offline → merge, nothing lost ===');
    // the laptop opens Mia (its current player went with Leo)
    await L.waitForSelector(visibleSel('#screen-players'));
    await L.click(`#player-grid [data-player="${miaId}"]`);
    await L.waitForSelector(visibleSel('#screen-title'));
    await I.click(`#player-grid [data-player="${miaId}"]`);
    await I.waitForSelector(visibleSel('#screen-title'));
    online.laptop = false; online.ipad = false;
    const practice = (page, word, firstTry) => J(page, async ({ word, firstTry }) => {
      const S = window.__spellJump, WS = await import('/src/spelling/wordStore.js');
      WS.recordSpell(S.app.words, word, { firstTry }, Date.now(), null);
      S.app.persistWords();
      return JSON.parse(JSON.stringify(S.app.words.records[word]));
    }, { word, firstTry });
    const before = await lsJSON(L, `spellJump.${miaId}.words`);
    const laptopA = await practice(L, 'because', true);
    const laptopB = await practice(L, 'friend', false);
    await sleep(30);
    const ipadA = await practice(I, 'thought', true);
    const ipadB = await practice(I, 'friend', true);
    // v3.3: both devices change Mia's cosmetics / crates / XP offline too (the save doc conflicts → merged)
    const crates0 = await J(L, () => ({ ...window.__spellJump.app.save.crates }));
    await J(L, () => { const s = window.__spellJump.app.save; s.cosmetics.skins.push('flames'); s.crates.earned += 2; s.xp = 400; window.__spellJump.app.persist(); });
    await J(I, () => { const s = window.__spellJump.app.save; s.cosmetics.stickers.push('star'); s.cosmetics.equipped.beater = { skin: 'stock', sticker: 'star' }; s.crates.earned += 1; s.crates.opened += 1; s.xp = 250; window.__spellJump.app.persist(); });
    await sleep(2600);                                   // both debounced pushes fail offline
    check((await syncStatus(L)).offline && (await syncStatus(I)).offline, 'both devices offline with changes waiting');
    online.ipad = true;
    await J(I, () => window.dispatchEvent(new Event('online')));
    await until(async () => !(await syncStatus(I)).pending, 6000);
    const conflictsBefore = apiLog.filter((r) => r.name === 'laptop' && r.status === 409).length;
    online.laptop = true;
    await J(L, () => window.dispatchEvent(new Event('online')));
    await until(async () => !(await syncStatus(L)).pending && !(await syncStatus(L)).offline, 6000);
    check(apiLog.filter((r) => r.name === 'laptop' && r.status === 409).length > conflictsBefore, 'the laptop hit a 409 and merged');
    await pullNow(I);
    const wl = await lsJSON(L, `spellJump.${miaId}.words`), wi = await lsJSON(I, `spellJump.${miaId}.words`), ws = (await serverDoc(code, `${miaId}.words`)).data;
    const att = (d, w) => d.records[w] && d.records[w].attempts;
    check(att(ws, 'because') === laptopA.attempts && att(ws, 'because') > att(before, 'because') && att(ws, 'thought') === ipadA.attempts && att(ws, 'thought') > att(before, 'thought'),
      `server keeps both devices' words: because ${att(before, 'because')} → ${att(ws, 'because')} (laptop), thought ${att(before, 'thought')} → ${att(ws, 'thought')} (ipad)`);
    check(JSON.stringify(ws.records.friend) === JSON.stringify(ipadB) && ipadB.lastSeen > laptopB.lastSeen && laptopB.firstTry !== ipadB.firstTry,
      `"friend" (changed on both) keeps the later practice: the ipad's (first try ${ipadB.firstTry}), not the laptop's earlier miss (first try ${laptopB.firstTry})`);
    check(Object.keys(before.records).every((w) => ws.records[w]), `no word record lost (${Object.keys(ws.records).length} records)`);
    check(JSON.stringify(wl.records) === JSON.stringify(ws.records) && JSON.stringify(wi.records) === JSON.stringify(ws.records), 'laptop, ipad and server agree on every record');
    check(await J(L, () => window.__spellJump.words.records.thought.attempts) === ipadA.attempts, "the laptop's in-memory words got the ipad's practice");
    const sv = { l: await lsJSON(L, `spellJump.${miaId}.save`), i: await lsJSON(I, `spellJump.${miaId}.save`), s: (await serverDoc(code, `${miaId}.save`)).data };
    const okSave = (x) => x.cosmetics.skins.includes('flames') && x.cosmetics.stickers.includes('star') && x.crates.earned === crates0.earned + 2 && x.crates.opened === crates0.opened + 1 && x.xp === 400;
    check(okSave(sv.l) && okSave(sv.i) && okSave(sv.s), `cosmetics + crates merged across the devices: skins ${sv.s.cosmetics.skins}, stickers ${sv.s.cosmetics.stickers}, crates ${JSON.stringify(sv.s.crates)}, xp ${sv.s.xp} (laptop, ipad and server agree)`);
    check(await J(L, () => window.__spellJump.app.save.cosmetics.stickers.includes('star') && window.__spellJump.app.save.crates.earned) === crates0.earned + 2, "the laptop's in-memory save got the ipad's sticker");

    console.log('\n=== status screens ===');
    await L.click('#btn-parents');
    await syncTab(L);
    check(/^Synced as .* · last sync just now$/.test((await statusText(L)).trim()), `laptop: "${(await statusText(L)).trim()}"`);
    await shot(L, '10-laptop-synced');
    // Leave family: stops syncing, keeps the data
    await L.click('#sync-leave');
    await L.click('#sync-leave-yes');
    await L.waitForSelector('#sync-create');
    check(await lineText(L) === 'Not synced · tap to set up family sync' && (await familyIds(L)).join() === 'Mia', 'Leave family: not synced, Mia stays on the laptop');
    await shot(L, '11-laptop-left');
    const nReq = apiLog.length;
    await J(L, () => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(500);
    check(apiLog.filter((r) => r.name === 'laptop').length === apiLog.slice(0, nReq).filter((r) => r.name === 'laptop').length, 'after leaving, the laptop makes no more sync requests');
    await L.click('#pz-close');

    const errors = [...laptop.errors, ...ipad.errors];
    check(ttsLog.length > 0 && ttsLog.every((r) => r.path === '/api/tts/status' && r.status === 200), `natural voice: devices in a family asked /api/tts/status only (${ttsLog.length}×, no key on this server: the device voice stays)`);
    check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  } finally {
    await browser.close();
    if (srv) srv.kill();
  }
  console.log(`\nscreenshots: ${SHOTS}`);
  console.log(`requests: ${apiLog.length} (${['GET', 'PUT', 'POST'].map((m) => `${m} ${apiLog.filter((r) => r.method === m).length}`).join(', ')}; 409s ${apiLog.filter((r) => r.status === 409).length}; offline ${apiLog.filter((r) => r.status === 'offline').length})`);
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n- ` + failures.join('\n- ')); process.exit(1); }
  console.log('\nALL SYNC CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
