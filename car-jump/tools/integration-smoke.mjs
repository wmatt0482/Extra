// Integration test (Spell Jump v3): the full app (index.html?nosw=1) on the REAL engine, driven with real
// touch input (Playwright touchscreen taps; GAS / BRAKE / NITRO holds through CDP Input.dispatchTouchEvent).
//   SHOTS_DIR=/some/dir node tools/integration-smoke.mjs      (starts python3 -m http.server 8080 if needed)
//   ONLY=landscape|portrait|speech|perf to run one part.
// At 844×390 and 390×844 (DPR 2, touch), with a fake speech backend (window.__ttsBackend) that records speech:
//   player picker → new player → title (sample list: no Qualifier) → PLAY → garage → tracks →
//   A: new word → Look → Write → first try → drive with GAS → letterRing events, WORD COMPLETE, bonus credited
//   B: a miss → Compare (attempt cleared ≤ 3 s, R2) → Copy → Cover → go at 65 % (launch slower than A)
//   mission: retrievals 3..8 → $500 once (not again on the 9th); title chip "Mission complete"
//   Parent Zone: set PIN, save a 6-word list (syllables / sentence / pattern), wrong PIN refused, forgot PIN
//   → Qualifier on the next PLAY → Friday Test → Mega Run → Report shows pretest + test; Options speech "on"
//   second player: independent cash and words; reload keeps players, lists and progress.
// R1 is asserted on every Write / Cover step: the word is in no visible element or the spell panel's DOM, the
// HUD letter strip is empty and game.debugInfo().lettersRevealed === false (no letter glyph on the canvas).
// "speech" part: speechSynthesis deleted / voices never listed / utterances never start → the word is shown
// for 3 s ("Look, then spell it") with a one-time hint, in the spell panel and the tests; the whole app still
// plays. "perf" part: city run with a 9-letter word at 4x CPU throttle; game code per frame avg and p95.
// No console errors, no horizontal overflow, a screenshot of every state.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'spell-jump-integration-shots');
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  return srv;
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390 },
  { name: 'portrait', width: 390, height: 844 },
];
const LIST = [
  ['neighbor', 'neigh/bor', 'My neighbor has a dog.'],
  ['enough', 'e/nough', 'Do we have enough chairs?'],
  ['through', '', 'We walked through the park.'],
  ['thought', '', ''],
  ['rough', '', ''],
  ['tough', '', 'That puzzle was tough.'],
];
const LIST_TEXT = LIST.map(([w, s, t]) => [w, s, t].filter((x, i) => x || (i === 1 && t)).join(' | ')).join('\n');
const PATTERN = 'ough';

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

// ---------- page helpers ----------
const J = (page, fn, arg) => page.evaluate(fn, arg);
const vis = (sel) => `${sel}:not([hidden])`;
const SJ = 'window.__spellJump';
const readSave = (page) => J(page, () => { const id = window.__spellJump.app.currentPlayerId; return JSON.parse(localStorage.getItem(`spellJump.${id}.save`)); });
const readWords = (page) => J(page, () => { const id = window.__spellJump.app.currentPlayerId; return JSON.parse(localStorage.getItem(`spellJump.${id}.words`)); });
const family = (page) => J(page, () => JSON.parse(localStorage.getItem('spellJump.family')));
const spoken = (page) => J(page, () => window.__spoken.slice());
const panelMode = (page) => J(page, () => window.__spellJump.spellPanel.mode);
const waitMode = (page, mode, timeout = 10000) => page.waitForFunction((m) => window.__spellJump.spellPanel.mode === m, mode, { timeout });
const testMode = (page) => J(page, () => document.querySelector('#screen-test').dataset.mode);

async function tap(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box for ' + sel);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
async function tapKeys(page, kbSel, text) {
  for (const ch of text) await tap(page, `${kbSel} [data-key="${ch === ' ' ? 'space' : ch}"]`);
}
async function pin(page, digits) { for (const d of digits) await tap(page, `.pinpad [data-digit="${d}"]`); }

let shotN = 0;
async function shot(page, layout, name, wait = 200) {
  if (wait) await sleep(wait);
  const file = path.join(SHOTS, `${layout.name}-${String(++shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  await overflowCheck(page, `${layout.name} ${name}`);
  return file;
}
// no horizontal page overflow; no visible element outside the viewport sideways (unless inside a scroller)
async function overflowCheck(page, label) {
  const bad = await J(page, () => {
    const W = innerWidth, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`scrollWidth ${document.documentElement.scrollWidth}`);
    const scroller = (el) => { for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowX + o.overflowY)) return true; } return false; };
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('[hidden], #backdrop, #toasts, #stage, #res-fx, #banner, svg')) continue;   // #banner: animated pop-in (scale) over the HUD
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || scroller(el)) continue;
      if (r.right > W + 1 || r.left < -1) out.push(`${el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    return out.slice(0, 4);
  });
  if (bad.length) check(false, `${label}: horizontal overflow — ${bad.join('; ')}`);
}

// Visible text, concatenated in DOM order (letter tiles side by side spell the word) + the canvas state.
async function r1Check(page, word, label) {
  const r = await J(page, (w) => {
    const visible = (el) => {
      if (!el || el.closest('[hidden]')) return false;
      for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; }
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && visible(n.parentElement)) text += n.textContent;
    const vals = [...document.querySelectorAll('textarea, input')].filter(visible).map((e) => e.value).join(' ');
    const flat = (s) => s.toLowerCase().replace(/[\s·]+/g, '');
    const panel = document.querySelector('#spell'), test = document.querySelector('#screen-test');
    const g = window.__spellJump.game, d = g && g.debugInfo && g.debugInfo();
    const hudWord = document.querySelector('#hud-word');
    return {
      visibleText: flat(text).includes(flat(w)) || flat(vals).includes(flat(w)),
      panelDom: flat(panel.textContent).includes(flat(w)) || (!test.hidden && flat(test.querySelector('.tm-body').textContent).includes(flat(w))),
      model: document.querySelector('#sp-model').children.length + document.querySelector('#tm-model').children.length,
      revealed: d ? d.lettersRevealed : null, leaks: d ? d.glyphLeaks : 0,
      letters: g ? g.getState().letters : null,
      hudWord: !!hudWord && visible(hudWord) && hudWord.children.length > 0,
    };
  }, word);
  const ok = !r.visibleText && !r.panelDom && r.model === 0 && r.revealed !== true && !r.leaks && !r.hudWord && (!r.letters || r.letters.total === 0);
  check(ok, `${label}: R1 "${word}" nowhere visible / in the panel DOM, no model tiles, HUD strip empty, lettersRevealed=${r.revealed}, getState().letters=${JSON.stringify(r.letters)}${ok ? '' : ' ' + JSON.stringify(r)}`);
}

// R2: after LAUNCH / CHECK on a miss, the marked attempt shows, then the attempt row is cleared within 3 s.
function r2Watch(page, rowSel) {
  return J(page, (sel) => new Promise((resolve) => {
    const t0 = performance.now();
    let marked = false, tm = 0;
    const tick = () => {
      const tiles = [...document.querySelectorAll(`${sel} .tile`)];
      if (!marked && tiles.some((x) => x.classList.contains('bad') || x.classList.contains('missing'))) { marked = true; tm = performance.now(); }
      const letters = tiles.filter((x) => !x.classList.contains('cursor') && x.textContent.trim()).length;
      if (marked && letters === 0) { resolve({ ms: performance.now() - tm, marked }); return; }
      if (performance.now() - t0 > 30000) { resolve({ ms: 99999, marked }); return; }
      setTimeout(tick, 25);
    };
    tick();
  }), rowSel);
}

// wrap what main.js passes to the engine and what the engine reports to the HUD
async function instrument(page) {
  await J(page, () => {
    const S = window.__spellJump;
    window.__starts ||= []; window.__power ||= []; window.__letterHits ||= []; window.__wordComplete ||= 0; window.__banners ||= [];
    const g = S.game;
    if (g && !g.__wrapped) {
      const o = g.start; g.start = (opts) => { window.__starts.push({ letters: opts.letters, powerScale: opts.powerScale, nitroScale: opts.nitroScale, track: opts.track.id }); return o(opts); };
      const p = g.setLaunchPower; g.setLaunchPower = (a, b) => { window.__power.push([a, b]); return p(a, b); };
      g.__wrapped = true;
    }
    const h = S.hud;
    if (!h.__wrapped) {
      const lh = h.letterHit; h.letterHit = (i) => { window.__letterHits.push({ i, revealed: !document.querySelector('#hud-word').hidden }); return lh(i); };
      const wc = h.wordComplete; h.wordComplete = () => { window.__wordComplete++; return wc(); };
      const bn = h.banner; h.banner = (k, t) => { window.__banners.push([k, t]); return bn(k, t); };
      h.__wrapped = true;
    }
  });
}

// Wait for the spell panel; if it opens on a Look step, wait it out. Returns { word, look }.
async function panelWord(page) {
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  const word = await J(page, () => window.__spellJump.spellPanel.word);
  const look = await panelMode(page) === 'look';
  if (look) await waitMode(page, 'write', 12000);
  else await waitMode(page, 'write', 5000);
  return { word, look };
}

async function startFromTitle(page, layout) {
  await tap(page, '#btn-play');
  await page.waitForSelector(vis('#screen-garage'));
  await tap(page, '#btn-race');
  await page.waitForSelector(vis('#screen-tracks'));
  await tap(page, '[data-track="canyon"]');
}

// Drive with real touches. stopAt: 'results' (play to the end) or 'launch' (end the run via pause → End run
// once the car is airborne). Returns { launchKmh, info }.
async function drive(page, cdp, { stopAt = 'results', label = '', layout = null } = {}) {
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  await sleep(150);
  if (await J(page, () => !document.querySelector('#coach').hidden)) { if (layout) await shot(page, layout, `${label}-coach`); await tap(page, '#coach'); }
  const pos = await J(page, () => {
    const c = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; };
    return { gas: c('#ctl-gas'), brake: c('#ctl-brake'), nitro: c('#ctl-nitro') };
  });
  const ids = { gas: 1, brake: 2, nitro: 3 };
  let cur = '';
  const setTouches = async (want) => {
    const names = Object.keys(want).filter((k) => want[k]);
    const key = names.join(',');
    if (key === cur) return;
    if (cur) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (names.length) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: names.map((n) => ({ x: pos[n].x, y: pos[n].y, id: ids[n], radiusX: 8, radiusY: 8, force: 1 })) });
    cur = key;
  };
  const out = { launchKmh: 0, preLaunch: [], sawInput: false, shotAir: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const st = await J(page, () => {
      const R = window.__spellJump;
      if (!R.run) return null;
      const g = R.game, d = g.debugInfo(), s = g.getState();
      return { phase: s.phase, nitro: s.nitro, letters: s.letters, revealed: d.lettersRevealed, leaks: d.glyphLeaks, launchKmh: d.launchKmh, powerScale: d.powerScale,
        hudWord: !document.querySelector('#hud-word').hidden, gasDown: document.querySelector('#ctl-gas').classList.contains('is-down') };
    });
    if (!st) break;
    if (st.gasDown) out.sawInput = true;
    if (st.phase === 'ramp') out.preLaunch.push(!st.revealed && !st.leaks && !st.hudWord && st.letters.total === 0);
    out.powerScale = st.powerScale;
    if (st.launchKmh) out.launchKmh = st.launchKmh;
    const want = { gas: st.phase !== 'air', brake: false, nitro: st.phase === 'ground' && st.nitro > 0.02 };
    await setTouches(want);
    if (st.phase === 'air' && layout && !out.shotAir) { out.shotAir = true; await sleep(450); await shot(page, layout, `${label}-air-letters`, 0); }
    if (stopAt === 'launch' && st.phase === 'air') {
      await setTouches({});
      await sleep(300);
      await tap(page, '#btn-pause');
      await page.waitForSelector(vis('#panel-pause'));
      await tap(page, '#pause-end');
      break;
    }
    await sleep(25);
  }
  await setTouches({});
  await page.waitForSelector(vis('#screen-results'), { timeout: 20000 });
  await page.waitForFunction(() => {
    const td = document.querySelector('#res-pay tr[data-pay="total"] td:last-child');
    return td && Number(td.textContent.replace(/[^0-9-]/g, '')) === Number(td.dataset.value);
  }, null, { timeout: 6000 });
  out.preLaunchOk = out.preLaunch.length > 0 && out.preLaunch.every(Boolean);
  return out;
}

async function payout(page, before) {
  const pay = await J(page, () => {
    const val = (tr) => Number(tr.lastElementChild.textContent.replace(/[^0-9-]/g, ''));
    const rows = [...document.querySelectorAll('#res-pay tr')];
    const base = rows.filter((r) => ['distance', 'stunts', 'smashes', 'combo', 'air', 'landing', 'bonus'].includes(r.dataset.pay)).map(val);
    const total = val(rows.find((r) => r.dataset.pay === 'total'));
    const extras = rows.filter((r) => ['goal', 'daily', 'spelling', 'mission', 'friday'].includes(r.dataset.pay)).map((r) => [r.dataset.pay, val(r)]);
    return { base, total, extras, cash: window.__spellJump.lastResult.summary.cash };
  });
  const after = await readSave(page);
  const expected = before.cash + pay.total + pay.extras.reduce((a, b) => a + b[1], 0);
  return { ...pay, after, expected, ok: pay.base.reduce((a, b) => a + b, 0) === pay.total && pay.total === pay.cash.total && after.cash === expected };
}

// type the right word and LAUNCH (from Write); resolves when the panel has closed
async function spellRight(page, word) {
  await tapKeys(page, '#sp-keyboard', word);
  await tap(page, '#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
}

function newContext(browser, layout, init) {
  return browser.newContext({
    viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  }).then(async (ctx) => {
    await routeFonts(ctx);
    await ctx.addInitScript(init.fn, init.arg);
    return ctx;
  });
}
function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

// speech backends for the init script. mode: 'ok' (voices + onstart), 'silent' (voices, never starts),
// 'novoices' (empty voice list, never starts), 'none' (speechSynthesis deleted)
function initScript({ mode }) {
  if (!sessionStorage.getItem('itSeeded')) { localStorage.clear(); sessionStorage.setItem('itSeeded', '1'); }
  window.__spoken = []; window.__ttsCalls = { cancel: 0, resume: 0, speak: 0 };
  if (mode === 'none') {
    try { delete window.speechSynthesis; } catch (_) {}
    try { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); } catch (_) {}
    try { delete window.SpeechSynthesisUtterance; } catch (_) {}
    return;
  }
  const voices = mode === 'novoices' ? [] : [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }];
  window.__ttsBackend = {
    speaking: false, pending: false, paused: mode === 'ok',     // iOS can leave the synth paused: unlock must resume it
    getVoices: () => voices,
    speak(u) {
      window.__ttsCalls.speak++;
      if (mode !== 'ok') return;                                // never starts (no onstart / onend)
      window.__spoken.push(String(u.text).trim());
      setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5);
      setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40);
    },
    cancel() { window.__ttsCalls.cancel++; },
    resume() { window.__ttsCalls.resume++; this.paused = false; },
    addEventListener() {},
  };
}

// ================================================================================================
async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} (real engine) ===`);
  shotN = 0;
  const ctx = await newContext(browser, layout, { fn: initScript, arg: { mode: 'ok' } });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + '/index.html?nosw=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  check(await J(page, () => !window.__spellJump.app.engineName), 'real engine loaded (not the mock)');

  // ---------- player picker → new player ----------
  await page.waitForSelector(vis('#screen-players'));
  await shot(page, layout, 'players');
  await tap(page, '#pl-add');
  await page.waitForSelector(vis('#screen-newplayer'));
  await tapKeys(page, '#np-keyboard', 'mia');
  await tap(page, '.swatch[data-color="#3b7dd9"]');
  await shot(page, layout, 'new-player');
  await tap(page, '#np-keyboard [data-key="enter"]');
  await page.waitForSelector(vis('#screen-title'));
  check(await J(page, () => window.__ttsCalls.resume > 0), 'iOS paused synth: a tap called speechSynthesis.resume()');
  const pid = (await family(page)).players[0].id;
  await instrument(page);
  await shot(page, layout, 'title');
  const t0 = await J(page, () => ({ play: document.querySelector('#btn-play').textContent.trim(), sample: !document.querySelector('#title-sample').hidden, mission: document.querySelector('#title-mission-text').textContent }));
  check(t0.play === 'Play' && t0.sample && t0.mission === 'Today: 0 / 8 words', `title: "${t0.play}", sample list notice, "${t0.mission}" (no Qualifier for the sample list)`);

  // ---------- path A (+ C): new word → Look → Write → first try → drive ----------
  let save = await readSave(page);
  await startFromTitle(page, layout);
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  const wA = await J(page, () => window.__spellJump.spellPanel.word);
  check(await panelMode(page) === 'look', `C: new word "${wA}" starts with the Look step`);
  await sleep(600);
  const lookInfo = await J(page, () => ({ tiles: document.querySelectorAll('#sp-model .tile').length, kbOff: document.querySelector('#sp-keyboard').classList.contains('is-disabled'), revealed: window.__spellJump.game.debugInfo().lettersRevealed }));
  check(lookInfo.tiles === wA.length && lookInfo.kbOff && lookInfo.revealed === false, `C: Look shows ${lookInfo.tiles} tiles, keyboard off, canvas letters still hidden`);
  await shot(page, layout, 'A-look', 0);
  await waitMode(page, 'write', 12000);
  const spA = await spoken(page);
  check(spA.includes(wA) && [...wA].every((c) => spA.includes(c.toUpperCase())), 'C: Look says the word and spells it letter by letter');
  await r1Check(page, wA, 'A Write');
  await shot(page, layout, 'A-write', 0);
  const before6 = (await spoken(page)).length;
  await tapKeys(page, '#sp-keyboard', wA);
  const typed = (await spoken(page)).slice(before6);
  check(typed.join('') === wA.toUpperCase(), `R6: typed letters spoken by name (${typed.join(' ')})`);
  await tap(page, '#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'done', 4000);
  await shot(page, layout, 'A-perfect', 150);
  const cancelsBefore = await J(page, () => window.__ttsCalls.cancel);
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 6000 });
  check(await J(page, (n) => window.__ttsCalls.cancel > n, cancelsBefore), 'speech is cancelled when the spell panel closes');
  check(await J(page, () => { const p = window.__power.at(-1); return p && p[0] === 1 && p[1] === 1.25; }), 'A: setLaunchPower(1, 1.25)');
  check(await J(page, () => document.querySelector('#hud-word').hidden && window.__spellJump.game.debugInfo().lettersRevealed === false), 'A: panel closed, car parked: HUD letter strip and canvas letters still hidden');
  const hitsBefore = await J(page, () => window.__letterHits.length);
  const A = await drive(page, cdp, { label: 'A', layout });
  check(A.sawInput, 'A: GAS responded to a real touch hold');
  check(A.preLaunchOk, `A: every ramp frame (${A.preLaunch.length}) had lettersRevealed false, no glyph, empty HUD strip`);
  const hitsA = await J(page, (n) => window.__letterHits.slice(n), hitsBefore);
  const resA = await J(page, () => ({ spell: window.__spellJump.lastResult.spell, letters: window.__spellJump.lastResult.summary.letters, coinMult: window.__spellJump.lastResult.stats.coinMult, row: !!document.querySelector('#res-pay tr[data-pay="spelling"]'), wc: window.__wordComplete }));
  check(hitsA.length > 0 && hitsA.length === resA.letters.collected && hitsA.every((h) => h.revealed), `A: ${hitsA.length} letterRing events (summary.letters ${JSON.stringify(resA.letters)}), strip revealed after launch`);
  const ringSpoken = (await spoken(page)).filter((x) => /^[A-Z]$/.test(x)).slice(-hitsA.length);
  check(ringSpoken.length === hitsA.length, `A: letter rings said their letters (${ringSpoken.join(' ')})`);
  if (resA.letters.inOrder) check(resA.wc >= 1, 'A: WORD COMPLETE reached the HUD');
  const wantBonus = Math.round(400 * resA.coinMult);
  check(resA.row && resA.spell.firstTry && resA.spell.bonus === wantBonus, `A: results Spelling row, first try, bonus $${resA.spell.bonus} (= $400 × ${resA.coinMult})`);
  let pay = await payout(page, save);
  check(pay.ok, `A: run ${pay.total} + extras ${JSON.stringify(pay.extras)} credited (${save.cash} → ${pay.after.cash})`);
  console.log(`    A: launch ${Math.round(A.launchKmh)} km/h, power ${A.powerScale}, letters ${JSON.stringify(resA.letters)}`);
  await sleep(1200);
  await shot(page, layout, 'A-results');

  // ---------- path B: miss → Compare → Copy → Cover → 65 % ----------
  save = await readSave(page);
  await tap(page, '#res-retry');
  const B = await panelWord(page);
  await r1Check(page, B.word, 'B Write');
  const wrong = B.word.slice(0, -2) + (B.word.at(-1) === 'x' ? 'q' : 'x');
  const r2 = r2Watch(page, '#sp-attempt');
  await tapKeys(page, '#sp-keyboard', wrong);
  await tap(page, '#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'compare', 3000);
  await shot(page, layout, 'B-compare', 250);
  const cmp = await J(page, () => ({ bad: document.querySelectorAll('#sp-attempt .tile.bad, #sp-attempt .tile.missing').length, model: document.querySelectorAll('#sp-model .tile').length }));
  check(cmp.bad > 0 && cmp.model === B.word.length, `B: Compare marks ${cmp.bad} positions, the word above in green`);
  const r2r = await r2;
  check(r2r.marked && r2r.ms <= 3000, `B: R2 the misspelling was cleared after ${Math.round(r2r.ms)} ms (≤ 3000)`);
  await waitMode(page, 'copy', 3500);
  await tapKeys(page, '#sp-keyboard', B.word);
  await shot(page, layout, 'B-copy', 0);
  await tap(page, '#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'cover', 3000);
  await r1Check(page, B.word, 'B Cover');
  await shot(page, layout, 'B-cover', 0);
  await spellRight(page, B.word);
  check(await J(page, () => { const p = window.__power.at(-1); return p && p[0] === 0.65 && p[1] === 1; }), 'B: setLaunchPower(0.65, 1)');
  const Bd = await drive(page, cdp, { stopAt: 'launch' });
  check(Bd.powerScale === 0.65 && Bd.launchKmh > 0 && Bd.launchKmh < A.launchKmh - 5, `B: launch at 65 % is slower (${Math.round(Bd.launchKmh)} vs ${Math.round(A.launchKmh)} km/h, debugInfo().powerScale ${Bd.powerScale})`);
  const resB = await J(page, () => window.__spellJump.lastResult.spell);
  check(resB && !resB.firstTry && resB.fixed && resB.bonus === 0, 'B: results say fixed, no bonus');
  pay = await payout(page, save);
  check(pay.ok, `B: save credited (${save.cash} → ${pay.after.cash})`);
  await shot(page, layout, 'B-results', 900);

  // ---------- mission: retrievals 3..9; the 8th pays $500 once ----------
  let missionPaid = 0, missionRuns = [];
  for (let n = 3; n <= 9; n++) {
    save = await readSave(page);
    await tap(page, '#res-retry');
    const w = await panelWord(page);
    if (n === 3) { await r1Check(page, w.word, `run ${n} Write`); }
    await spellRight(page, w.word);
    if (n === 8) await page.waitForSelector('#banner[data-kind="mission"]:not([hidden])', { timeout: 3000 }).then(() => shot(page, layout, 'mission-banner', 0)).catch(() => check(false, 'mission banner'));
    await drive(page, cdp, { stopAt: 'launch' });
    const r = await J(page, () => ({ reward: window.__spellJump.lastResult.missionReward, mission: window.__spellJump.lastResult.mission }));
    missionRuns.push(`${n}:${r.mission.count}${r.reward ? '+$' + r.reward : ''}`);
    missionPaid += r.reward;
    pay = await payout(page, save);
    if (!pay.ok) check(false, `run ${n}: payout mismatch ${JSON.stringify(pay)}`);
    if (n === 8) { check(r.reward === 500 && r.mission.count === 8, `mission: the 8th retrieval pays $500 (${missionRuns.join(' ')})`); await shot(page, layout, 'mission-results', 900); }
  }
  check(missionPaid === 500, `mission paid once in total ($${missionPaid}; ${missionRuns.join(' ')})`);
  await tap(page, '#res-garage');
  await tap(page, '#screen-garage [data-back]');
  await page.waitForSelector(vis('#screen-title'));
  check(/mission complete/i.test(await page.textContent('#title-mission-text')), `title chip: "${await page.textContent('#title-mission-text')}"`);
  await shot(page, layout, 'title-mission-done');

  // ---------- Parent Zone: PIN, list ----------
  await tap(page, '#btn-parents');
  await page.waitForSelector(vis('#pz'));
  await shot(page, layout, 'pz-set-pin');
  await pin(page, '1234');
  await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
  await pin(page, '1234');
  await page.waitForSelector('#pz-words');
  await page.fill('#pz-words', LIST_TEXT);              // parent-facing native fields (allowed)
  await page.fill('#pz-pattern', PATTERN);
  await tap(page, '#pz-save');
  await page.waitForFunction(() => /Saved 6 words/.test((document.querySelector('#pz-msg') || {}).textContent || ''), null, { timeout: 4000 });
  const wd = await readWords(page);
  const act = wd.lists.find((l) => l.id === wd.activeId);
  check(act && act.words.length === 6 && act.pattern === PATTERN && act.words[0].syllables.join('/') === 'neigh/bor' && act.words[0].sentence === LIST[0][2] && wd.qualifierPending === wd.activeId,
    `list saved: ${act && act.words.map((w) => w.word).join(', ')} (pattern ${act && act.pattern}), syllables + sentence kept, Qualifier pending`);
  await shot(page, layout, 'pz-list-saved');
  await tap(page, '.pz-tabs [data-tab="options"]');
  await page.waitForSelector('#opt-speech-state');
  await sleep(300);
  const sp = await J(page, () => ({ pill: document.querySelector('#opt-speech-state').textContent, sub: document.querySelector('#opt-speech-sub').textContent }));
  check(sp.pill === 'Speech on' && /voice/.test(sp.sub), `Options: "${sp.pill}" (${sp.sub})`);
  await shot(page, layout, 'pz-options-speech');
  await tap(page, '#pz-close');
  // wrong PIN refused, right PIN opens
  await J(page, () => window.__spellJump.pz.lock());
  await tap(page, '#btn-parents');
  await pin(page, '9999');
  await page.waitForSelector('#pin-err');
  check(await J(page, () => !document.querySelector('#pz-words')), 'wrong PIN refused');
  await shot(page, layout, 'pz-wrong-pin');
  await pin(page, '1234');
  await page.waitForSelector('#pz-words');
  await tap(page, '#pz-close');
  // forgot PIN: hold 3 s (a real touch hold), 2-digit × 2-digit, new PIN
  await J(page, () => window.__spellJump.pz.lock());
  await tap(page, '#btn-parents');
  await tap(page, '#pin-forgot');
  const hb = await page.locator('#pin-hold').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2, id: 7 }] });
  await page.waitForSelector('#math-q', { timeout: 5000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const q = await J(page, () => ({ a: +document.querySelector('#math-q').dataset.a, b: +document.querySelector('#math-q').dataset.b }));
  await pin(page, String(q.a * q.b));
  await shot(page, layout, 'pz-forgot-math', 0);
  await tap(page, '#pin-ok');
  await page.waitForFunction(() => /new 4-digit/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
  await pin(page, '5678');
  await page.waitForFunction(() => /again/i.test(document.querySelector('#pin-title').textContent));
  await pin(page, '5678');
  await page.waitForSelector('#pz-words');
  await tap(page, '#pz-close');
  await J(page, () => window.__spellJump.pz.lock());
  await tap(page, '#btn-parents');
  await pin(page, '5678');
  await page.waitForSelector('#pz-words');
  check(true, `forgot PIN: hold 3 s, ${q.a} × ${q.b}, new PIN 5678 opens the Parent Zone`);
  await tap(page, '#pz-close');

  // ---------- Qualifier on the next PLAY ----------
  save = await readSave(page);
  check(/new words/i.test(await page.textContent('#btn-play')), 'PLAY announces new words');
  await tap(page, '#btn-play');
  await page.waitForSelector('#tm-go');
  await shot(page, layout, 'qualifier-intro');
  await tap(page, '#tm-go');
  let qMiss = null;
  for (let i = 0; i < LIST.length; i++) {
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 9000 });
    const w = await J(page, () => window.__spellJump.testScreen.word);
    if (i === 0) { await r1Check(page, w, 'Qualifier ask'); await shot(page, layout, 'qualifier-ask', 0); }
    if (i === 2) {
      qMiss = w;
      const r2q = r2Watch(page, '#tm-attempt');
      await tapKeys(page, '#tm-keyboard', w.slice(1));
      await tap(page, '#tm-keyboard [data-key="enter"]');
      await shot(page, layout, 'qualifier-compare', 300);
      const rr = await r2q;
      check(rr.marked && rr.ms <= 3000, `Qualifier: R2 the miss was cleared after ${Math.round(rr.ms)} ms`);
    } else {
      await tapKeys(page, '#tm-keyboard', w);
      await tap(page, '#tm-keyboard [data-key="enter"]');
    }
  }
  await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'done' && document.querySelector('#tm-go'), null, { timeout: 12000 });
  await shot(page, layout, 'qualifier-done');
  const after = await readSave(page);
  check(after.cash === save.cash + 500, `Qualifier paid $100 × 5 (${save.cash} → ${after.cash})`);
  await tap(page, '#tm-go');
  await page.waitForSelector(vis('#screen-garage'));
  await tap(page, '#screen-garage [data-back]');

  // ---------- Friday Test → Mega Run ----------
  save = await readSave(page);
  await tap(page, '#btn-friday');
  await page.waitForSelector('#tm-go');
  await tap(page, '#tm-go');
  for (let i = 0; i < LIST.length; i++) {
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 9000 });
    const w = await J(page, () => window.__spellJump.testScreen.word);
    if (i === 0) await r1Check(page, w, 'Friday Test ask');
    await tapKeys(page, '#tm-keyboard', i === 4 ? w + 'e' : w);
    if (i === 0) await shot(page, layout, 'friday-typed', 0);
    await tap(page, '#tm-keyboard [data-key="enter"]');
  }
  await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'done' && document.querySelector('#tm-go'), null, { timeout: 12000 });
  await shot(page, layout, 'friday-done');
  check((await readSave(page)).cash === save.cash + 750, 'Friday Test paid $150 × 5');
  save = await readSave(page);
  await tap(page, '#tm-go');
  await page.waitForSelector(vis('#hud'));
  const mega = await J(page, () => window.__starts.at(-1));
  check(mega && Math.abs(mega.powerScale - (0.6 + 0.4 * 5 / 6)) < 1e-9 && !mega.letters, `Mega Run power ${mega && mega.powerScale.toFixed(3)} = 0.6 + 0.4 × 5/6, no letters`);
  await drive(page, cdp, { stopAt: 'launch' });
  check(await J(page, () => /mega/i.test(document.querySelector('#res-title').textContent)), 'Mega Run results');
  await shot(page, layout, 'mega-results', 900);
  await tap(page, '#res-garage');
  await tap(page, '#screen-garage [data-back]');

  // ---------- Report ----------
  await J(page, () => window.__spellJump.pz.lock());
  await tap(page, '#btn-parents');
  await pin(page, '5678');
  await page.waitForSelector('#pz-words');
  await tap(page, '.pz-tabs [data-tab="report"]');
  await page.waitForSelector('#pz-table');
  const rep = await J(page, () => ({
    pre: document.querySelector('[data-score="pretest"] b').textContent, latest: document.querySelector('[data-score="latest"] b').textContent,
    rows: document.querySelectorAll('#pz-table tbody tr').length, hist: document.querySelectorAll('.pz-hist .row').length,
  }));
  check(/^5 \/ 6/.test(rep.pre) && /^5 \/ 6/.test(rep.latest) && rep.rows === 6 && rep.hist >= 2, `Report: pretest ${rep.pre}, Friday Test ${rep.latest}, ${rep.rows} words, ${rep.hist} tests`);
  await shot(page, layout, 'pz-report');
  await tap(page, '#pz-close');

  // ---------- second player: independent cash and words ----------
  const mia = { save: await readSave(page), words: await readWords(page) };
  await tap(page, '#btn-player');
  await page.waitForSelector(vis('#screen-players'));
  await tap(page, '#pl-add');
  await tapKeys(page, '#np-keyboard', 'leo');
  await tap(page, '#np-keyboard [data-key="enter"]');
  await page.waitForSelector(vis('#screen-title'));
  await instrument(page);
  const leo = { save: await readSave(page), words: await readWords(page), id: await J(page, () => window.__spellJump.app.currentPlayerId) };
  check(leo.id !== pid && leo.save.cash === 0 && leo.words.lists.some((l) => l.sample) && !leo.words.tests.length, `second player Leo: $${leo.save.cash}, sample list, no tests (Mia has $${mia.save.cash})`);
  await startFromTitle(page, layout);
  const lw = await panelWord(page);
  await spellRight(page, lw.word);
  await drive(page, cdp, { stopAt: 'launch' });
  const miaNow = await J(page, (id) => JSON.parse(localStorage.getItem(`spellJump.${id}.save`)).cash, pid);
  check(miaNow === mia.save.cash, `Leo's run left Mia's cash alone ($${miaNow})`);
  await shot(page, layout, 'leo-results', 900);

  // ---------- reload keeps everything ----------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(vis('#screen-players'));
  check(await J(page, () => document.querySelectorAll('[data-player]').length) === 2, 'reload: both players on the picker');
  await shot(page, layout, 'players-after-reload');
  await tap(page, `[data-player="${pid}"]`);
  await page.waitForSelector(vis('#screen-title'));
  const back = { save: await readSave(page), words: await readWords(page) };
  check(back.save.cash === mia.save.cash && back.words.tests.length === mia.words.tests.length && back.words.activeId === mia.words.activeId && Object.keys(back.words.records).length === Object.keys(mia.words.records).length,
    `reload: Mia's cash $${back.save.cash}, list, ${back.words.tests.length} tests and ${Object.keys(back.words.records).length} word records kept`);
  // app hidden → speech cancelled
  const c0 = await J(page, () => window.__ttsCalls.cancel);
  await J(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  check(await J(page, (n) => window.__ttsCalls.cancel > n, c0), 'app hidden: speech cancelled');
  await J(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  await ctx.close();
}

// ================================================================================================
// Speech robustness: no speechSynthesis at all, voices never listed, utterances that never start.
async function runSpeech(browser) {
  const layout = { name: 'speech', width: 844, height: 390 };
  shotN = 0;
  for (const mode of ['none', 'silent', 'novoices']) {
    console.log(`\n=== speech: ${mode} ===`);
    const ctx = await newContext(browser, layout, { fn: initScript, arg: { mode } });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    const cdp = await ctx.newCDPSession(page);
    await page.goto(BASE + '/index.html?nosw=1', { waitUntil: 'networkidle' });
    if (mode === 'none') check(await J(page, () => typeof window.speechSynthesis === 'undefined' && !window.__spellJump.tts.available), 'speechSynthesis is undefined on this page');
    await page.waitForSelector(vis('#screen-players'));
    await tap(page, '#pl-add');
    await tapKeys(page, '#np-keyboard', 'zoe');
    await tap(page, '#np-keyboard [data-key="enter"]');
    await page.waitForSelector(vis('#screen-title'));
    await instrument(page);
    // a word that is not new (no Look step of its own): the panel must show it for 3 s first
    await J(page, async () => {
      const S = window.__spellJump, sch = await import('/src/spelling/scheduler.js');
      for (const w of S.words.lists[0].words) { const r = S.words.records[w.word] = sch.newRecord(w.word, S.words.lists[0].id); r.studied = true; r.seenCount = 1; r.box = 1; r.due = 0; }
    });
    await startFromTitle(page, layout);
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
    const word = await J(page, () => window.__spellJump.spellPanel.word);
    const tOpen = Date.now();
    await waitMode(page, 'look', 4000);
    const lk = await J(page, () => ({ msg: document.querySelector('#sp-msg').textContent, note: !document.querySelector('#sp-note').hidden && document.querySelector('#sp-note').textContent, tiles: document.querySelectorAll('#sp-model .tile').length, hear: !document.querySelector('#sp-hear').hidden }));
    const lookAfter = Date.now() - tOpen;
    check(/look, then spell/i.test(lk.msg) && lk.tiles === word.length && /speech isn't available/i.test(lk.note || ''), `${mode}: the word "${word}" is shown ("${lk.msg}") with the hint "${lk.note}" after ${lookAfter} ms`);
    check(lookAfter < 4500, `${mode}: the child waited ${lookAfter} ms (≤ ~3 s) before seeing the word`);
    if (mode === 'none') check(!lk.hear, 'none: no "Hear it" button without speech');
    await shot(page, layout, `${mode}-look`, 0);
    await waitMode(page, 'write', 5000);
    await r1Check(page, word, `${mode}: Write after the look`);
    await shot(page, layout, `${mode}-write`, 0);
    await spellRight(page, word);
    await drive(page, cdp, { stopAt: 'launch' });
    await shot(page, layout, `${mode}-results`, 800);
    // second run: the hint is one-time
    await tap(page, '#res-retry');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
    const w2 = await J(page, () => window.__spellJump.spellPanel.word);
    await waitMode(page, 'look', 4000);
    check(await J(page, () => document.querySelector('#sp-note').hidden), `${mode}: the hint shows only once`);
    await waitMode(page, 'write', 5000);
    await spellRight(page, w2);
    await drive(page, cdp, { stopAt: 'launch' });
    await tap(page, '#res-garage');
    await tap(page, '#screen-garage [data-back]');
    // Friday Test (audio only) falls back to Look too
    if (mode !== 'novoices') {
      await J(page, () => { const l = window.__spellJump.words.lists[0]; l.words = l.words.slice(0, 3); });
      await tap(page, '#btn-friday');
      await page.waitForSelector('#tm-go');
      await tap(page, '#tm-go');
      for (let i = 0; i < 3; i++) {
        await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'look', null, { timeout: 6000 });
        const w = await J(page, () => window.__spellJump.testScreen.word);
        const t = await J(page, () => ({ tiles: document.querySelectorAll('#tm-model .tile').length, msg: document.querySelector('#tm-msg').textContent }));
        if (i === 0) { check(t.tiles === w.length && /look, then spell/i.test(t.msg), `${mode}: Friday Test shows "${w}" first ("${t.msg}")`); await shot(page, layout, `${mode}-friday-look`, 0); }
        await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 6000 });
        if (i === 0) await r1Check(page, w, `${mode}: Friday Test ask after the look`);
        await tapKeys(page, '#tm-keyboard', w);
        await tap(page, '#tm-keyboard [data-key="enter"]');
      }
      await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'done' && document.querySelector('#tm-go'), null, { timeout: 12000 });
      await tap(page, '#tm-go');
      await page.waitForSelector(vis('#hud'));
      await drive(page, cdp, { stopAt: 'launch' });
      check(true, `${mode}: Friday Test + Mega Run played through without speech`);
      await tap(page, '#res-garage');
      await tap(page, '#screen-garage [data-back]');
    }
    // Parent Zone indicator
    await tap(page, '#btn-parents');
    await pin(page, '1111');
    await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
    await pin(page, '1111');
    await page.waitForSelector('#pz-words');
    await tap(page, '.pz-tabs [data-tab="options"]');
    await page.waitForSelector('#opt-speech-state');
    await sleep(1700);
    await tap(page, '.pz-tabs [data-tab="words"]');
    await tap(page, '.pz-tabs [data-tab="options"]');
    const ind = await J(page, () => ({ pill: document.querySelector('#opt-speech-state').textContent, sub: document.querySelector('#opt-speech-sub').textContent }));
    check(ind.pill === 'Speech off', `${mode}: Parent Zone shows "${ind.pill}" (${ind.sub})`);
    await shot(page, layout, `${mode}-pz-speech-off`);
    check(errors.length === 0, `${mode}: no console errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
    await ctx.close();
  }
}

// ================================================================================================
// Perf: city, a 9-letter word, 4x CPU throttle. Game code per frame = engine sim + draw (debugPerf).
async function runPerf(browser) {
  console.log('\n=== perf: city, "beautiful", 4x CPU throttle ===');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${BASE}/dev.html?ui=0&panel=0&car=rally&track=city&lvl=5&seed=7&letters=beautiful`);
  await page.waitForFunction(() => window.__rr && window.__rr.game && window.__rr.game.getState().phase === 'ramp');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Two numbers per rendered frame, from the engine's own counters (debugPerf): raw = sim + draw of that frame;
  // per 60 Hz frame = one physics step (sim / ticks) + one draw. Headless Chromium rasterizes the DPR-2 canvas in
  // software, so at 4x it only reaches ~12 fps and each rendered frame also runs ~5 catch-up physics steps; the
  // per-60 Hz number is the cost a device that keeps up actually pays per frame (the budget is checked on it).
  const res = await J(page, () => new Promise((resolve) => {
    const g = window.__rr.game;
    g.debugPerf(true);
    const raw = [], norm = [];
    g.setInput({ gas: true });
    const t0 = performance.now();
    const tick = () => {
      const p = g.debugPerf(true);
      if (p.frames > 0 && p.ticks > 0) { raw.push((p.sim + p.draw) / p.frames); norm.push(p.sim / p.ticks + p.draw / p.frames); }
      const s = g.getState();
      g.setInput({ gas: s.phase !== 'air', nitro: s.phase === 'ground' && s.nitro > 0.05 });
      if (window.__rr.finished || performance.now() - t0 > 40000) {
        const st = (a) => { const b = a.slice().sort((x, y) => x - y); return { avg: a.reduce((x, y) => x + y, 0) / a.length, p95: b[Math.floor(b.length * 0.95)], max: b.at(-1) }; };
        resolve({ frames: raw.length, wall: performance.now() - t0, raw: st(raw), norm: st(norm), letters: s.letters });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const f = (x) => x.toFixed(2);
  console.log(`    ${res.frames} frames over ${(res.wall / 1000).toFixed(1)} s (${(res.frames / res.wall * 1000).toFixed(0)} fps), letters ${JSON.stringify(res.letters)}`);
  console.log(`    per 60 Hz frame (1 step + 1 draw): avg ${f(res.norm.avg)} ms, p95 ${f(res.norm.p95)} ms · per rendered frame incl. catch-up steps: avg ${f(res.raw.avg)} ms, p95 ${f(res.raw.p95)} ms`);
  check(res.letters.collected >= 1, `perf: the 9-letter word rode the rings (${res.letters.collected}/${res.letters.total} collected)`);
  check(res.norm.avg < 8, `perf: game code per 60 Hz frame avg ${f(res.norm.avg)} ms < 8 ms at 4x throttle (p95 ${f(res.norm.p95)} ms)`);
  check(errors.length === 0, `perf: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  globalThis.__perf = res;
  await ctx.close();
}

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const only = process.env.ONLY;
try {
  for (const l of LAYOUTS) if (!only || only === l.name) await runLayout(browser, l);
  if (!only || only === 'speech') await runSpeech(browser);
  if (!only || only === 'perf') await runPerf(browser);
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');
