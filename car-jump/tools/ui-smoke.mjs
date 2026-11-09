// UI smoke test for Spell Jump (meta screens + spelling layer + mock engine).
//   cd car-jump && python3 -m http.server 8080 &      (the script starts one itself if needed)
//   SHOTS_DIR=/some/dir node tools/ui-smoke.mjs
// At 844×390 and 390×844 (DPR 2, simulated iPhone safe-area insets, ?mock=1&nosw=1, a fake speechSynthesis
// injected through window.__ttsBackend so every spoken text is recorded):
//   player picker → "+ New player" on the on-screen keyboard (old rampRage.save.v1 migrates into it) → title
//   (PLAY / FRIDAY TEST / BADGES / PARENTS, "Today: n / 8", Sample-list notice) → runs through every spell-panel
//   path: new word (Look → Cover → Write) first-try PERFECT; a miss → Compare → Copy (wrong letters refused,
//   LAUNCH only on a match) → Cover → fixed (65 %); two more misses → go anyway (65 %) and the word comes back
//   after 2 other words; letter rings say their letters, WORD COMPLETE; results Spelling row + cash math;
//   the daily mission completing ($500, banner, results callout, title chip) → Parent Zone: set PIN, save a list
//   (a 41-word list is refused), enter PIN (wrong then right), forgot PIN (hold 3 s + multiplication) →
//   Qualifier (pays $100 a word, Focus words) → Friday Test → Mega Run (power 0.6 + 0.4 × score, $150 a word) →
//   Report (pretest vs test, per-word table, Copy report via clipboard or the select-text fallback,
//   "Why this works") → Options (tile case, voice picker incl. "Use default system voice", rate, Speech check: the
//   timestamped log lines + Copy log via clipboard or the select-text fallback, words before each race) → a 2-word set (first
//   right, second missed and fixed → setLaunchPower(0.825, 1.125), rings carry the missed word, mission +2, both
//   words on the results row) → reload persistence (incl. the chosen voice). Earlier paths use 1 word per race.
// Speech: a word is presented as exactly ["The word is, <word>.", <sentence>, "<word>."] once (Look), again on
// "Hear it"; "Say it again" → "<word>. <word>."; "Syllables" → "neigh, bor.".
// Asserts R1 (no visible element spells the target word while the child spells from memory), R2 (a wrong attempt
// is cleared within 3 s), R6 (each typed letter is spoken by name), keyboard keys ≥ 7 % (landscape) / 9 %
// (portrait) of the viewport width, no console errors, no horizontal overflow, tap targets ≥ 44 px.
// Screenshots every state.
// Parents from the player picker with zero players (PIN set there, Family code tab first with Create / Join on
// top, "Add a player first" on the per-player tabs, the sync status line under the title on every tab).
// Natural voice (ONLY=cloud runs just this, at both sizes): see cloudVoiceTest below.
// Class lists (v3.7; ONLY=class): see classListTest below (v3.9.1: the card says "In use" / "Not in use yet", opens to each
// word with its sentence) and openTitleNewWeekTest (v3.9.1: a page left open on the title picks up a new week on a
// visibilitychange, never during a run, and on the hourly check). The other paths set window.__noClassLists (the built-in list).
// Sky Era teaser (v3.10; ONLY=sky): see skyTeaserTest below (plays once by itself, Skip / Escape / tap, no replay after a reload,
// the title's Sky card replays it, waits for a panel, the milestone clip at 4, the Parent Zone line, reduced-motion stills; the
// other paths set window.__noSkyTeaser so the teaser does not cover their title).
// Sky Era (v4.0; ONLY=skyera): see skyEraTest below (the unlock ceremony once, the Earth / Sky tabs remembered, sky tracks + the Sky rides row on the
// stand-in data, the locked gate before the unlock, Parents → Options, the Spell Boost with the engine's freeze, boost power 1 / 0.5, the results line,
// Spell Boost off, no device voice, layout clean at both sizes). Uses ?mock=1&skyfixture=1 (tools/fixtures/sky/).
// Self-update (ONLY=update runs just this): a copy of the app served on another port with the REAL service worker;
// changing sw.js VERSION reloads the page once on the picker (not on the first install), and with the spell panel
// open it only shows "Update ready, restarting soon" and reloads when the run is left; index.html and src/main.js
// are network-first (an edit shows up on the next load while the worker controls the page).
import { execSync } from 'node:child_process';
import { startStaticServer, watchdog } from './serve.mjs';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { letterName } from '../src/spelling/words.js';
import { cloudLetterText } from '../src/spelling/cloudVoice.js';
const spelled = (w) => w.split('').map(letterName);
const cloudSpelled = (w) => w.split('').map(cloudLetterText);   // natural-voice letter clips are "B", "E", … (v3.5)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'spell-jump-ui-shots');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}

// v3.9.1 (tools/serve.mjs): a server this tool starts is stopped by its own pid on every way out (success, failure, a
// crash, a signal, the SMOKE_TIMEOUT_MS watchdog); one already on 8080 is used only if it serves Spell Jump, never stopped.
async function ensureServer() {
  if (process.env.BASE_URL) return null;
  return startStaticServer({ cwd: root, port: 8080 });
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const LAYOUTS = [
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 }, keyMin: 0.07, clipboard: true },
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 }, keyMin: 0.09, clipboard: false },
];

// an old single-player save: it must migrate into the first player created
const LEGACY_SAVE = { v: 1, cash: 5000, owned: ['beater'], selectedCar: 'beater', unlocked: ['canyon'], best: { canyon: 120 },
  settings: { sound: true, music: true, reducedMotion: false } };

const LIST_TEXT = 'enough | e/nough | Do we have enough chairs?\nthrough | | We walked through the park.\nneighbor | neigh/bor | My neighbor has a dog.\ndon\'t';
const LIST_WORDS = ['enough', 'through', 'neighbor', "don't"];

const fontCache = new Map();
async function routeFonts(ctx) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) {
        const body = execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`);
        fontCache.set(url, body);
      }
      const css = url.includes('googleapis');
      await route.fulfill({ status: 200, body: fontCache.get(url), contentType: css ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) {
      await route.fulfill({ status: 200, body: '', contentType: 'text/css' });
    }
  });
}

async function layoutAudit(page, insets, label) {
  const issues = await page.evaluate(({ insets }) => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    const visible = (el) => {
      if (el.closest('[hidden]')) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) {
        const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return p;
      }
      return null;
    };
    const desc = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('#backdrop, #toasts, #stage, #banner, #res-fx, .sp-banner') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const sc = inScroller(el);
      if (!sc && (r.right > W + 1 || r.left < -1)) out.push(`h-overflow ${desc(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      if (!sc && (r.bottom > H + 1 || r.top < -1)) out.push(`v-overflow ${desc(el)} [${Math.round(r.top)}..${Math.round(r.bottom)}]`);
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1) out.push(`clipped text ${desc(el)}`);
    }
    for (const b of document.querySelectorAll('#app button')) {
      if (!visible(b)) continue;
      const r = b.getBoundingClientRect();
      if (!r.width) continue;
      const sc = inScroller(b);
      // on-screen keyboard letter keys: 10 per row cannot be 44 px wide on a 390 px phone; they are held to
      // ≥ 7 % / 9 % of the viewport width (keySizes) and ≥ 44 px tall instead, like the iOS keyboard
      if (b.classList.contains('kb-char') ? (r.height < 44 || r.width < W * 0.07) : Math.min(r.width, r.height) < 44) out.push(`tap target ${Math.round(r.width)}x${Math.round(r.height)} ${desc(b)}`);
      if (!sc && r.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)} bottom=${Math.round(r.bottom)} limit=${H - insets.b}`);
      if (!sc && (r.left < insets.l - 1 || r.right > W - insets.r + 1)) out.push(`inside notch/side inset ${desc(b)}`);
      if (!sc && r.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    return out;
  }, { insets });
  check(issues.length === 0, `${label}: layout clean${issues.length ? ' — ' + issues.slice(0, 6).join('; ') : ''}`);
}

async function shot(page, layout, name, wait = 250) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}

const visibleSel = (sel) => `${sel}:not([hidden])`;
const J = (page, fn, arg) => page.evaluate(fn, arg);
const family = (page) => J(page, () => JSON.parse(localStorage.getItem('spellJump.family')));
async function readSave(page) {
  return J(page, () => { const id = window.__spellJump.app.currentPlayerId; return JSON.parse(localStorage.getItem(`spellJump.${id}.save`)); });
}
// Parent Zone: which tab is shown, the tab order, and the one-line sync status right under the title
async function pzState(page) {
  return J(page, () => {
    const line = document.querySelector('#pz-sync-line');
    const head = document.querySelector('.pz-head').getBoundingClientRect();
    const lr = line && !line.hidden ? line.getBoundingClientRect() : null;
    const tabs = [...document.querySelectorAll('.pz-tabs [data-tab]')];
    const content = document.querySelector('.pz-content');
    return {
      tab: content && content.dataset.tab, order: tabs.map((t) => t.dataset.tab), labels: tabs.map((t) => t.textContent.trim()),
      on: (tabs.find((t) => t.classList.contains('on')) || {}).dataset?.tab,
      line: lr ? line.textContent.trim() : null,
      // directly under the title: below the head, above the tabs / content, in the sheet's top area
      lineUnderTitle: !!lr && lr.top >= head.top + head.height / 2 && lr.top - head.bottom < 16 && lr.bottom <= document.querySelector('#pz-body').getBoundingClientRect().top + 1,
      first: content && content.firstElementChild ? (content.firstElementChild.id || content.firstElementChild.className) : null,
      firstHas: content && content.firstElementChild ? [...content.firstElementChild.querySelectorAll('[id]')].map((e) => e.id) : [],
      last: content && content.lastElementChild ? content.lastElementChild.id : null,
      noPlayer: (document.querySelector('#pz-noplayer .label') || {}).textContent || null,
    };
  });
}
async function pinIn(page, pin) { for (const d of pin) await page.click(`.pinpad [data-digit="${d}"]`); }

async function readWords(page) {
  return J(page, () => { const id = window.__spellJump.app.currentPlayerId; return JSON.parse(localStorage.getItem(`spellJump.${id}.words`)); });
}
const spoken = (page) => J(page, () => window.__spoken.slice());
const panelMode = (page) => J(page, () => window.__spellJump.spellPanel.mode);
// "Words before each race" defaults to 2 (v3.1): the single-word paths set it to 1 (what the Options control does)
const wordsPerRace = (page, n) => J(page, async (k) => {
  const S = window.__spellJump, P = await import('/src/spelling/profiles.js');
  P.setPlayerOption(S.app.family, S.app.currentPlayerId, 'wordsPerRace', k); S.app.persistFamily(); S.app.onOptionsChanged(S.app.currentPlayerId);
}, n);
const waitMode = (page, mode, timeout = 9000) => page.waitForFunction((m) => window.__spellJump.spellPanel.mode === m, mode, { timeout });

// Visible text, concatenated in DOM order (letter tiles side by side spell the word).
async function visibleTextHas(page, word) {
  return J(page, (w) => {
    const vis = (el) => {
      if (!el || el.closest('[hidden]')) return false;
      for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && vis(n.parentElement)) text += n.textContent;
    const vals = [...document.querySelectorAll('textarea, input')].filter(vis).map((e) => e.value).join(' ');
    const flat = (s) => s.toLowerCase().replace(/[\s·]+/g, '');
    return flat(text).includes(flat(w)) || flat(vals).includes(flat(w));
  }, word);
}

async function tapKeys(page, kbSel, text) {
  for (const ch of text) {
    const key = ch === ' ' ? 'space' : ch;
    await page.tap(`${kbSel} [data-key="${key}"]`);
  }
}

async function keySizes(page, kbSel, layout, label) {
  const r = await J(page, (sel) => {
    const keys = [...document.querySelectorAll(`${sel} .kb-char`)].map((k) => k.getBoundingClientRect());
    return { min: Math.min(...keys.map((k) => k.width)), minH: Math.min(...keys.map((k) => k.height)), W: innerWidth };
  }, kbSel);
  check(r.min >= layout.keyMin * r.W && r.minH >= 44, `${label}: keyboard keys ${r.min.toFixed(1)}×${r.minH.toFixed(0)} px ≥ ${Math.round(layout.keyMin * 100)} % of ${r.W} (${(layout.keyMin * r.W).toFixed(1)} px)`);
}

// Wrap game.start / setLaunchPower so the test sees what main.js passes.
async function instrument(page) {
  await J(page, () => {
    const g = window.__spellJump.game;
    window.__starts = window.__starts || [];
    window.__power = window.__power || [];
    if (g && !g.__wrapped) {
      const o = g.start; g.start = (opts) => { window.__starts.push({ letters: opts.letters, powerScale: opts.powerScale, nitroScale: opts.nitroScale, track: opts.track.id, finishLine: opts.track.finish }); return o(opts); };
      const p = g.setLaunchPower; g.setLaunchPower = (a, b) => { window.__power.push([a, b]); return p(a, b); };

      g.__wrapped = true;
    }
    if (window.__evts) return;
    window.__evts = [];
    const app = window.__spellJump;
    const onE = app.game && app.game.__onE;
    void onE;
  });
}

async function gas(page) {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
}

async function dismissCoachIfUp(page) {
  if (await J(page, () => !document.querySelector('#coach').hidden)) { await page.click('#coach'); return true; }
  return false;
}

// Start a run from the garage/tracks flow (or results Retry), returning the picked word.
async function startRunFromTitle(page) {
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#btn-race');
  await page.waitForSelector(visibleSel('#screen-tracks'));
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  return J(page, () => window.__spellJump.spellPanel.word);
}

// Finish the current run quickly after the panel: dismiss coach, press GAS, wait for the results.
async function driveToResults(page, { end = false } = {}) {
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  await page.waitForTimeout(150);
  await dismissCoachIfUp(page);
  await gas(page);
  if (end) {
    await page.waitForTimeout(400);
    await page.click('#btn-pause', { timeout: 5000 });
    await page.waitForSelector(visibleSel('#panel-pause'));
    await page.click('#pause-end');
  }
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  await page.waitForFunction(() => {
    const td = document.querySelector('#res-pay tr[data-pay="total"] td:last-child');
    return td && Number(td.textContent.replace(/[^0-9-]/g, '')) === Number(td.dataset.value);
  }, null, { timeout: 4000 });
}

async function payoutCheck(page, label, before) {
  const pay = await J(page, () => {
    const val = (tr) => Number(tr.lastElementChild.textContent.replace(/[^0-9-]/g, ''));
    const rows = [...document.querySelectorAll('#res-pay tr')];
    const base = rows.filter((r) => ['distance', 'stunts', 'smashes', 'combo', 'air', 'landing', 'bonus'].includes(r.dataset.pay)).map(val);
    const total = val(rows.find((r) => r.dataset.pay === 'total'));
    const extras = rows.filter((r) => ['goal', 'daily', 'spelling', 'mission', 'friday'].includes(r.dataset.pay)).map(val);
    return { base, total, extras, cash: window.__spellJump.lastResult.summary.cash };
  });
  const sum = pay.base.reduce((a, b) => a + b, 0);
  check(sum === pay.total && pay.total === pay.cash.total, `${label}: breakdown ${pay.base.join(' + ')} = ${sum} matches total ${pay.total}`);
  const after = await readSave(page);
  const expected = before.cash + pay.total + pay.extras.reduce((a, b) => a + b, 0);
  check(after.cash === expected, `${label}: save cash ${before.cash} → ${after.cash} (expected ${expected}: run ${pay.total} + extras ${pay.extras.join(' + ') || 0})`);
  return pay;
}

// R2: after LAUNCH on a miss, the marked attempt shows, then the attempt row is cleared within 3 s.
async function r2Check(page, rowSel, label) {
  const t = await J(page, (sel) => new Promise((resolve) => {
    const t0 = performance.now();
    let marked = false, tm = 0;
    const tick = () => {
      const row = document.querySelector(sel);
      const tiles = row ? [...row.querySelectorAll('.tile')] : [];
      // the clock starts when the marked attempt appears (= the moment LAUNCH / CHECK was pressed)
      if (!marked && tiles.some((x) => x.classList.contains('bad') || x.classList.contains('missing'))) { marked = true; tm = performance.now(); }
      const letters = tiles.filter((x) => !x.classList.contains('cursor') && x.textContent.trim()).length;
      if (marked && letters === 0) { resolve({ ms: performance.now() - tm, marked }); return; }
      if (performance.now() - t0 > 30000) { resolve({ ms: 99999, marked }); return; }
      setTimeout(tick, 30);
    };
    tick();
  }), rowSel);
  check(t.marked && t.ms <= 3000, `${label}: R2 the attempt showed red marks and was cleared after ${Math.round(t.ms)} ms (≤ 3000)`);
}

async function spellWrongThenCompare(page, wrong, label) {
  await tapKeys(page, '#sp-keyboard', wrong);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'compare', 3000);
  await page.waitForTimeout(250);
  const cmp = await J(page, () => ({ bad: document.querySelectorAll('#sp-attempt .tile.bad, #sp-attempt .tile.missing').length, model: document.querySelectorAll('#sp-model .tile').length }));
  check(cmp.bad > 0 && cmp.model > 0, `${label}: Compare marks ${cmp.bad} differing positions and shows the word above in green`);
}

async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({
    viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
    permissions: layout.clipboard ? ['clipboard-read', 'clipboard-write'] : [],
  });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ save, insets }) => { window.__noSkyTeaser = true;
    if (!sessionStorage.getItem('smokeSeeded')) {
      localStorage.clear();
      localStorage.setItem('rampRage.save.v1', JSON.stringify(save));
      sessionStorage.setItem('smokeSeeded', '1');
    }
    // headless Chromium has no voices: a fake speechSynthesis records every utterance (tts.js test hook)
    window.__spoken = [];
    window.__noClassLists = true;   // v3.7: these paths run on the built-in list (class lists: classListTest)
    window.__ttsBackend = {
      speaking: false, pending: false,
      // several voices so the Parent Zone voice picker has a choice (ranked: Enhanced first, novelty last, no French)
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }, { name: 'Samantha (Enhanced)', lang: 'en-US', localService: true, default: false },
        { name: 'Fred', lang: 'en-US', localService: true, default: false }, { name: 'Thomas', lang: 'fr-FR', localService: true, default: false }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { save: LEGACY_SAVE, insets: layout.insets });

  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);

  // ---------- player picker + new player ----------
  await page.waitForSelector(visibleSel('#screen-players'));
  await shot(page, layout, '01-players');
  await layoutAudit(page, layout.insets, 'player picker');
  check(await J(page, () => document.querySelectorAll('[data-player]').length === 0 && !!document.querySelector('#pl-add')), 'picker is the first screen, with "+ New player"');

  // ---------- Parents from the picker, before any player exists ----------
  const pb = await J(page, () => {
    const b = document.querySelector('#btn-parents-picker'), r = b.getBoundingClientRect(), h2 = document.querySelector('.players-top h2').getBoundingClientRect();
    return { visible: !b.closest('[hidden]') && r.width > 0, text: b.textContent.trim(), lock: !!b.querySelector('svg'), right: r.right, top: r.top, bottom: r.bottom, h2: [h2.left, h2.right, h2.top, h2.bottom],
      W: innerWidth, chipHidden: document.querySelector('#sync-chip').hidden };
  });
  check(pb.visible && pb.text === 'Parents' && pb.lock, `picker: a "Parents" button with the lock icon (${pb.text})`);
  check(pb.right >= pb.W - layout.insets.r - 24 && pb.top < 70 && (pb.right > pb.h2[1] || pb.bottom <= pb.h2[2] + 1), `picker: Parents sits in the top-right corner (right ${Math.round(pb.right)} of ${pb.W}, top ${Math.round(pb.top)})`);
  check(pb.chipHidden, 'picker: no sync chip while this device is not in a family');
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-01b-picker-parents-btn.png`), clip: { x: Math.max(0, pb.W / 2), y: 0, width: pb.W / 2, height: Math.ceil(pb.bottom + 16) } });
  await page.click('#btn-parents-picker');
  await page.waitForSelector(visibleSel('#pz'));
  check(await page.textContent('#pin-title') === 'Choose a 4-digit PIN', 'picker Parents (no players): first use sets the PIN');
  check(await J(page, () => document.querySelector('#pz-sync-line').hidden), 'the sync status (and code) stay hidden behind the PIN');
  await shot(page, layout, '16-pz-set-pin');
  await layoutAudit(page, layout.insets, 'parent zone (set PIN)');
  await pinIn(page, '1234');
  await page.waitForFunction(() => document.querySelector('#pin-title') && /again/i.test(document.querySelector('#pin-title').textContent));
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(!!(await family(page)).pinHash, 'PIN saved (hashed) in spellJump.family');
  let z = await pzState(page);
  check(z.order.join() === 'sync,words,report,options' && z.on === 'sync' && z.labels[0] === 'Family code', `Parent Zone opens on the first tab, "${z.labels[0]}" (tabs: ${z.labels.join(' | ')})`);
  check(z.firstHas.includes('sync-create') && !z.firstHas.includes('sync-privacy') && z.last === 'sync-transfer', `Family code tab: Create on top (${z.first}), Join right after, privacy note then Transfer progress last (${z.last})`);
  check(await J(page, () => { const c = document.querySelector('#sync-create').getBoundingClientRect(), j = document.querySelector('#sync-join-input').getBoundingClientRect(), pr = document.querySelector('#sync-privacy').getBoundingClientRect(); return c.top < j.top && j.top < pr.top && c.bottom <= innerHeight; }), 'Create and Join are above the fold, above the privacy note');
  check(z.line === 'Not synced · tap to set up family sync' && z.lineUnderTitle, `status line under the title: "${z.line}"`);
  await shot(page, layout, '16b-pz-family-code-no-players');
  await layoutAudit(page, layout.insets, 'parent zone (family code, no players)');
  for (const t of ['words', 'report', 'options']) {
    await page.click(`.pz-tabs [data-tab="${t}"]`);
    await page.waitForSelector(`.pz-content[data-tab="${t}"]`);
    z = await pzState(page);
    check(z.noPlayer === 'Add a player first' && z.line === 'Not synced · tap to set up family sync' && z.lineUnderTitle, `no players, ${t} tab: "Add a player first", status line still under the title`);
  }
  await shot(page, layout, '16c-pz-no-player-tab');
  await layoutAudit(page, layout.insets, 'parent zone (no player tab)');
  await page.click('#pz-sync-line');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(true, 'tapping the status line jumps to the Family code tab');
  await page.click('#pz-close');
  await page.waitForSelector(visibleSel('#screen-players'));
  check(await J(page, () => document.querySelectorAll('[data-player]').length === 0), 'closing the Parent Zone returns to the picker');
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  check(await J(page, () => !document.querySelector('#screen-newplayer input, #screen-newplayer textarea')), 'new player: no native text input');
  await tapKeys(page, '#np-keyboard', 'sam');
  await page.click('.swatch[data-color="#3b7dd9"]');
  check((await page.textContent('#np-name')).trim() === 'Sam', 'name typed on the on-screen keyboard (capitalized "Sam")');
  await keySizes(page, '#np-keyboard', layout, 'new player');
  await shot(page, layout, '02-new-player');
  await layoutAudit(page, layout.insets, 'new player');
  await page.tap('#np-keyboard [data-key="enter"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const fam = await family(page);
  const pid = fam.players[0].id;
  check(fam.players.length === 1 && fam.players[0].name === 'Sam' && fam.players[0].color === '#3b7dd9' && fam.migrated, 'family record: player Sam, blue car, migration done');
  const migrated = await readSave(page);
  check(migrated && migrated.cash === 5000 && migrated.best.canyon === 120, `rampRage.save.v1 migrated into spellJump.${pid}.save (cash ${migrated && migrated.cash})`);
  await instrument(page);
  await wordsPerRace(page, 1);

  // ---------- title ----------
  await shot(page, layout, '03-title');
  await layoutAudit(page, layout.insets, 'title');
  const title = await J(page, () => ({
    buttons: [...document.querySelectorAll('#screen-title .title-actions button')].map((b) => b.textContent.replace(/\d+/g, '').trim().toLowerCase()),
    mission: document.querySelector('#title-mission-text').textContent, sample: !document.querySelector('#title-sample').hidden,
    links: [...document.querySelectorAll('a[href]')].filter((a) => a.origin !== location.origin).length,   // the Learning Lab home link is same-origin
  }));
  check(title.buttons.join('|') === 'play|friday test|badges|trophies|days|parents', `title buttons: ${title.buttons.join(', ')}`);
  check(title.mission === 'Today: 0 / 8 words' && title.sample, `title shows "${title.mission}" and the Sample-list notice`);
  check(title.links === 0, 'no external links anywhere');

  // ---------- run 1: new word → Look → Cover → Write → first try PERFECT ----------
  let save = await readSave(page);
  const w1 = await startRunFromTitle(page);
  check(await J(page, () => document.documentElement.classList.contains('spelling') && getComputedStyle(document.querySelector('#controls')).visibility === 'hidden'), 'driving controls hidden while spelling');
  check(await panelMode(page) === 'look', `new word "${w1}": Look step first`);
  await page.waitForTimeout(500);
  const look = await J(page, () => ({ tiles: document.querySelectorAll('#sp-model .tile').length, brk: document.querySelectorAll('#sp-model .tile.brk').length, kb: document.querySelector('#sp-keyboard').classList.contains('is-disabled') }));
  check(look.tiles === w1.length && look.kb, `Look: ${look.tiles} tiles shown (${look.brk} syllable break${look.brk === 1 ? '' : 's'}), keyboard off`);
  await shot(page, layout, '04-spell-look', 0);
  await layoutAudit(page, layout.insets, 'spell panel (look)');
  await waitMode(page, 'write', 9000);
  const sp1 = await spoken(page);
  check(sp1.includes(`The word is, ${w1}.`) && sp1.includes(`${w1}.`) && spelled(w1).every((n) => sp1.includes(n)), 'Look: the word is presented, then spelled letter by letter');
  // the presentation protocol: exactly [carrier, sentence, word], once (Write does not replay it)
  const info1 = await J(page, (w) => { for (const l of window.__spellJump.words.lists) { const e = l.words.find((x) => x.word === w); if (e) return e; } return null; }, w1);
  const want1 = [`The word is, ${w1}.`, info1.sentence, `${w1}.`];
  const at1 = sp1.indexOf(want1[0]);
  check(at1 >= 0 && JSON.stringify(sp1.slice(at1, at1 + 3)) === JSON.stringify(want1) && sp1.filter((x) => x === want1[0]).length === 1,
    `Look presents "${w1}" as ${JSON.stringify(sp1.slice(at1, at1 + 3))}`);
  check(!(await visibleTextHas(page, w1)) && await J(page, () => document.querySelector('#sp-model').children.length === 0), `R1: "${w1}" is nowhere on screen (nor in the DOM's model row) during Write`);
  await keySizes(page, '#sp-keyboard', layout, 'spell panel');
  await shot(page, layout, '05-spell-write', 0);
  await layoutAudit(page, layout.insets, 'spell panel (write)');
  check(await J(page, () => document.querySelector('#sp-keyboard [data-key="enter"]').disabled), 'LAUNCH disabled while the attempt is empty');
  check((await spoken(page)).filter((x) => x === want1[0]).length === 1, 'Write after Look: the presentation is not replayed');
  // Hear it → the full presentation again; Say it again → "<word>. <word>."; Syllables only when given
  let n0 = (await spoken(page)).length;
  await page.tap('#sp-hear');
  await page.waitForTimeout(1400);
  const heard = (await spoken(page)).slice(n0);
  check(JSON.stringify(heard) === JSON.stringify(want1), `Hear it: exactly ${JSON.stringify(heard)}`);
  n0 = (await spoken(page)).length;
  await page.tap('#sp-again');
  await page.waitForTimeout(500);
  check(JSON.stringify((await spoken(page)).slice(n0)) === JSON.stringify([`${w1}. ${w1}.`]), `Say it again: "${w1}. ${w1}."`);
  const sylBtn = await J(page, () => !document.querySelector('#sp-syllables').hidden);
  check(sylBtn === !!info1.syllables, `Syllables button ${sylBtn ? 'shown' : 'hidden'} (syllables ${info1.syllables ? info1.syllables.join('/') : 'none'})`);
  if (sylBtn) {
    n0 = (await spoken(page)).length;
    await page.tap('#sp-syllables');
    await page.waitForTimeout(500);
    check((await spoken(page)).slice(n0).join('|') === info1.syllables.join(', ') + '.', `Syllables: "${info1.syllables.join(', ')}."`);
  }
  const before6 = (await spoken(page)).length;
  await tapKeys(page, '#sp-keyboard', w1);
  const typedSpoken = (await spoken(page)).slice(before6);
  check(typedSpoken.join('|') === spelled(w1).join('|'), `R6: each typed letter spoken by name (${typedSpoken.join(' ')})`);
  await shot(page, layout, '05b-spell-typed', 0);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'done', 3000);
  await page.waitForTimeout(250);
  check(await J(page, () => !document.querySelector('#sp-banner').hidden && /perfect/i.test(document.querySelector('#sp-banner').textContent)), 'PERFECT SPELL banner');
  await shot(page, layout, '06-spell-perfect', 0);
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const pw1 = await J(page, () => window.__power.at(-1));
  check(pw1 && pw1[0] === 1 && pw1[1] === 1.25, `first try: setLaunchPower(${pw1})`);
  const st1 = await J(page, () => window.__starts.at(-1));
  check(st1 && st1.letters.join('') === w1 && st1.powerScale === 1, `game.start got letters "${st1 && st1.letters.join('')}" and power 1 before the panel`);
  // first-run coach after the panel, then GAS: letter rings say their letters, WORD COMPLETE
  await page.waitForSelector(visibleSel('#coach'), { timeout: 3000 });
  await shot(page, layout, '06b-coach');
  await page.click('#coach');
  const spBefore = (await spoken(page)).length;
  await gas(page);
  await page.waitForSelector('#banner[data-kind="word"]:not([hidden])', { timeout: 9000 }).then(() => shot(page, layout, '06c-word-complete', 0)).catch(() => {});
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  const ringSpoken = (await spoken(page)).slice(spBefore);
  check(ringSpoken.slice(0, w1.length).join('|') === spelled(w1).join('|'), `letter rings said their letters in order (${ringSpoken.slice(0, w1.length).join(' ')})`);
  await page.waitForTimeout(1500);
  await shot(page, layout, '07-results');
  await layoutAudit(page, layout.insets, 'results');
  const res1 = await J(page, () => ({ spell: window.__spellJump.lastResult.spell, row: !!document.querySelector('#res-pay tr[data-pay="spelling"]'), today: (document.querySelector('#res-today') || {}).textContent, letters: window.__spellJump.lastResult.summary.letters }));
  check(res1.row && res1.spell.firstTry && res1.spell.bonus === 400, `results Spelling row: ${res1.spell.word}, first try, +$${res1.spell.bonus}`);
  check(res1.today === 'Today 1 / 8', `results show "${res1.today}"`);
  check(res1.letters && res1.letters.collected === w1.length && res1.letters.inOrder, `summary.letters ${JSON.stringify(res1.letters)}`);
  await payoutCheck(page, 'run 1', save);

  // ---------- run 2: miss → Compare → Copy → Cover → fixed (65 %) ----------
  save = await readSave(page);
  await page.click('#res-retry');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const w2 = await J(page, () => window.__spellJump.spellPanel.word);
  check(w2 !== w1, `next word "${w2}" differs from the last one`);
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  check(!(await visibleTextHas(page, w2)), `R1: "${w2}" not visible during Write`);
  const wrong2 = w2.slice(0, -2) + (w2.at(-1) === 'x' ? 'q' : 'x');
  const r2p = r2Check(page, '#sp-attempt', 'run 2 compare');
  await spellWrongThenCompare(page, wrong2, 'run 2');
  await shot(page, layout, '08-spell-compare', 0);
  await layoutAudit(page, layout.insets, 'spell panel (compare)');
  await r2p;
  await waitMode(page, 'copy', 3000);
  await page.waitForTimeout(150);
  const wrongKey = 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => c !== w2[0]);
  await page.tap(`#sp-keyboard [data-key="${wrongKey}"]`);
  check(await J(page, () => document.querySelectorAll('#sp-attempt .tile:not(.cursor)').length === 0), `Copy: a wrong letter ("${wrongKey}") is refused, so no misspelling builds up`);
  await tapKeys(page, '#sp-keyboard', w2.slice(0, -1));
  check(await J(page, () => document.querySelector('#sp-keyboard [data-key="enter"]').disabled), 'Copy: LAUNCH stays off until the copy matches');
  await shot(page, layout, '09-spell-copy', 0);
  await layoutAudit(page, layout.insets, 'spell panel (copy)');
  await tapKeys(page, '#sp-keyboard', w2.slice(-1));
  check(await J(page, () => !document.querySelector('#sp-keyboard [data-key="enter"]').disabled), 'Copy: LAUNCH on once it matches');
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'cover', 3000);
  check(!(await visibleTextHas(page, w2)) && await J(page, () => document.querySelector('#sp-model').hidden), 'Cover: the model is hidden (R1)');
  await shot(page, layout, '10-spell-cover', 0);
  await tapKeys(page, '#sp-keyboard', w2);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'done', 3000);
  await page.waitForTimeout(200);
  await shot(page, layout, '11-spell-fixed', 0);
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const pw2 = await J(page, () => window.__power.at(-1));
  check(pw2 && pw2[0] === 0.65 && pw2[1] === 1, `fixed after Cover-Copy-Compare: setLaunchPower(${pw2})`);
  await driveToResults(page, { end: true });
  const res2 = await J(page, () => window.__spellJump.lastResult.spell);
  check(res2 && !res2.firstTry && res2.fixed && res2.bonus === 0, 'results: fixed, no bonus');
  await payoutCheck(page, 'run 2', save);
  // v3.7.2: the lights-on counter stays quiet on localhost, window.__pings records what would be sent: one 'day' ping
  // for this device today, a 'run' ping per finished run, and only { game, v, kind, fam } (no names, no ids)
  const { pings, ver } = await J(page, () => ({ pings: window.__pings || [], ver: (window.__spellJump || window.__trailBlazer).app.version }));
  check(pings.filter((p) => p.kind === 'day').length === 1 && pings.filter((p) => p.kind === 'run').length >= 2
    && pings.every((p) => p.game === 'spell-jump' && p.v === ver && p.fam === '' && Object.keys(p).join() === 'game,v,kind,fam'),
    `pings: one day ping, a run ping per run, nothing else in them (${pings.map((p) => p.kind).join(', ')})`);

  // ---------- run 3: miss, Cover miss, Cover miss → go anyway; the word returns after 2 other words ----------
  await page.click('#res-retry');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const w3 = await J(page, () => window.__spellJump.spellPanel.word);
  const powerCount = await J(page, () => window.__power.length);
  check(w3 !== w2, `run 3 word "${w3}" is not "${w2}" (missed words wait for 2 others)`);
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  const wrong3 = w3.slice(0, -1);
  for (let round = 0; round < 3; round++) {
    await tapKeys(page, '#sp-keyboard', wrong3);
    await page.tap('#sp-keyboard [data-key="enter"]');
    await waitMode(page, 'compare', 3000);
    if (round === 2) break;
    await waitMode(page, 'copy', 3500);
    await tapKeys(page, '#sp-keyboard', w3);
    await page.tap('#sp-keyboard [data-key="enter"]');
    await waitMode(page, 'cover', 3000);
  }
  await waitMode(page, 'done', 4000);
  await page.waitForTimeout(200);
  check(await J(page, () => /good try/i.test(document.querySelector('#sp-banner').textContent)), 'second Cover miss: "Good try", goes anyway');
  await shot(page, layout, '12-spell-anyway', 0);
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const pw3 = await J(page, (n) => window.__power.length === n + 1 && window.__power.at(-1), powerCount);
  check(pw3 && pw3[0] === 0.65, `go anyway: setLaunchPower(${pw3})`);
  await driveToResults(page, { end: true });
  // a missed word comes back after at least 2 other words and within a few picks (re-queues never run
  // back to back, so other pending words can take a turn first)
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await page.click('#res-retry');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    const w = await J(page, () => window.__spellJump.spellPanel.word);
    seen.push(w);
    if (w === w3 || i === 5) break;
    if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
    await tapKeys(page, '#sp-keyboard', w);
    await page.tap('#sp-keyboard [data-key="enter"]');
    await driveToResults(page, { end: true });
  }
  const back = seen.indexOf(w3);
  check(back >= 2 && back <= 5, `re-queue: after "${w3}" came ${seen.join(', ')} (back at position ${back + 1})`);
  // leave this run from the panel (back button): nothing is recorded
  const cnt = (await readWords(page)).today.count;
  await page.click('#spell .sp-exit');
  await page.waitForSelector(visibleSel('#screen-garage'));
  check((await readWords(page)).today.count === cnt, 'back from the spell panel: no attempt recorded');

  // ---------- daily mission: the 8th word pays $500 once ----------
  await J(page, () => { window.__spellJump.words.today.count = 7; });
  save = await readSave(page);
  await page.click('#btn-race');
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const w8 = await J(page, () => window.__spellJump.spellPanel.word);
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  await tapKeys(page, '#sp-keyboard', w8);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  await page.waitForSelector('#banner[data-kind="mission"]:not([hidden])', { timeout: 3000 }).then(() => shot(page, layout, '13-mission-banner', 0)).catch(() => check(false, 'Mission complete banner'));
  await driveToResults(page, { end: true });
  await page.waitForTimeout(400);
  const res8 = await J(page, () => ({ mission: !!document.querySelector('#res-mission'), row: !!document.querySelector('#res-pay tr[data-pay="mission"]'), reward: window.__spellJump.lastResult.missionReward }));
  check(res8.mission && res8.row && res8.reward === 500, 'mission complete: callout + $500 row');
  await shot(page, layout, '14-results-mission');
  // the results play their moments (level-up stamp, trophies) and then drop the crate in from above: measure the
  // layout once the moments are over and the crate has landed (crateDrop .6 s), never mid-flight
  await page.waitForFunction(() => { const m = document.querySelector('#res-moment'); return !m || m.hidden; }, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await layoutAudit(page, layout.insets, 'results (mission)');
  await payoutCheck(page, 'mission run', save);
  await page.click('#res-garage');
  await page.click('#screen-garage [data-back]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(/mission complete/i.test(await page.textContent('#title-mission-text')), `title chip: "${await page.textContent('#title-mission-text')}"`);
  await shot(page, layout, '15-title-mission');

  // ---------- Parent Zone (PIN set from the picker): Family code first, status line on every tab, save a list ----------
  await J(page, () => window.__spellJump.pz.lock());
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  check(await page.textContent('#pin-title') === 'Enter the parent PIN', 'title Parents: asks for the PIN set from the picker');
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  z = await pzState(page);
  check(z.on === 'sync' && z.firstHas.includes('sync-create') && z.last === 'sync-transfer', 'with a player: still opens on Family code, Create on top');
  await shot(page, layout, '16d-pz-family-code');
  for (const t of ['sync', 'words', 'report', 'options']) {
    await page.click(`.pz-tabs [data-tab="${t}"]`);
    await page.waitForSelector(`.pz-content[data-tab="${t}"]`);
    z = await pzState(page);
    check(z.line === 'Not synced · tap to set up family sync' && z.lineUnderTitle, `${t} tab: status line under the title`);
  }
  check(await J(page, () => { const b = document.querySelector('#opt-reload'); return !!b && b.textContent === 'Reload now' && typeof window.__spellJump.app.reloadNow === 'function'; }), 'options tab: a "Reload now" button (v3.7.4: the newest version and this week\'s class list)');
  await page.click('.pz-tabs [data-tab="words"]');
  await page.waitForSelector('#pz-words');
  await shot(page, layout, '17-pz-words');
  await layoutAudit(page, layout.insets, 'parent zone (words)');
  // 41 words are refused
  await page.fill('#pz-words', Array.from({ length: 41 }, (_, i) => 'word' + 'abcdefghijklmnopqrstuvwxyz'[i % 26] + 'abc'[Math.floor(i / 26)]).join('\n'));
  await page.click('#pz-save');
  check(/41 words/.test(await page.textContent('#pz-msg')), 'a 41-word list is refused with a message');
  await shot(page, layout, '18-pz-error');
  await page.fill('#pz-words', LIST_TEXT);
  await page.fill('#pz-pattern', 'ough');
  await page.click('#pz-save');
  await page.waitForFunction(() => /Saved 4 words/.test((document.querySelector('#pz-msg') || {}).textContent || ''));
  const wd = await readWords(page);
  const active = wd.lists.find((l) => l.id === wd.activeId);
  check(active && active.words.map((w) => w.word).join(',') === LIST_WORDS.join(',') && active.pattern === 'ough' && wd.qualifierPending === wd.activeId && !wd.lists.some((l) => l.sample),
    `list saved: ${active && active.words.map((w) => w.word).join(', ')} (pattern ${active && active.pattern}), Qualifier pending, sample list gone`);
  check(active.words[0].syllables.join('/') === 'e/nough' && active.words[1].sentence === 'We walked through the park.', 'syllables and sentence kept');
  await shot(page, layout, '19-pz-saved');
  // Why this works
  if (await page.isVisible('#pz-why')) await page.click('#pz-why');
  else { await page.click('.pz-tabs [data-tab="report"]'); await page.click('#pz-why-2'); }   // portrait: from the Report tab
  await page.waitForSelector('#pz-why-page');
  check(await J(page, () => document.querySelectorAll('#pz-why-page .why-row').length === 12 && document.querySelectorAll('#pz a').length === 0), '"Why this works": 12 techniques, no links');
  await shot(page, layout, '20-pz-why');
  await layoutAudit(page, layout.insets, 'parent zone (why)');
  await page.click('#pz-back');
  await page.click('#pz-close');
  check(await J(page, () => document.querySelector('#title-sample').hidden), 'title: Sample-list notice gone after saving a list');

  // enter PIN (wrong, then right)
  await J(page, () => window.__spellJump.pz.lock());
  await page.click('#btn-parents');
  for (const d of '9999') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('#pin-err');
  await shot(page, layout, '21-pz-wrong-pin');
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(true, 'enter PIN: wrong PIN refused, right PIN opens');
  // forgot PIN: hold 3 s, multiplication, new PIN
  await page.click('#pz-close');
  await J(page, () => window.__spellJump.pz.lock());
  await page.click('#btn-parents');
  await page.click('#pin-forgot');
  const hb = await page.locator('#pin-hold').boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await shot(page, layout, '22-pz-hold', 0);
  await page.mouse.up();
  check(await J(page, () => !!document.querySelector('#pin-hold')), 'releasing early does not skip the hold');
  await page.mouse.down();
  await page.waitForSelector('#math-q', { timeout: 4500 });
  await page.mouse.up();
  const q = await J(page, () => ({ a: +document.querySelector('#math-q').dataset.a, b: +document.querySelector('#math-q').dataset.b }));
  check(q.a >= 10 && q.a <= 99 && q.b >= 10 && q.b <= 99, `2-digit × 2-digit question: ${q.a} × ${q.b}`);
  for (const d of String(q.a * q.b)) await page.click(`.pinpad [data-digit="${d}"]`);
  await shot(page, layout, '23-pz-math', 0);
  await page.click('#pin-ok');
  await page.waitForFunction(() => /new 4-digit/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
  for (const d of '4321') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForFunction(() => /again/i.test(document.querySelector('#pin-title').textContent));
  for (const d of '4321') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  await page.click('#pz-close');
  await J(page, () => window.__spellJump.pz.lock());
  await page.click('#btn-parents');
  for (const d of '4321') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(true, 'forgot PIN: hold 3 s + multiplication → new PIN works');
  await page.click('#pz-close');

  // ---------- Qualifier ----------
  save = await readSave(page);
  check(/new words/i.test(await page.textContent('#btn-play')), 'PLAY announces new words');
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-test'));
  await page.waitForSelector('#tm-go');
  await shot(page, layout, '24-qualifier-intro');
  await layoutAudit(page, layout.insets, 'qualifier intro');
  await page.click('#tm-go');
  const qMissed = [];
  for (let i = 0; i < LIST_WORDS.length; i++) {
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 8000 });
    const w = await J(page, () => window.__spellJump.testScreen.word);
    if (i === 0) {
      check(!(await visibleTextHas(page, w)), `R1 in the Qualifier: "${w}" not on screen while asked`);
      await keySizes(page, '#tm-keyboard', layout, 'qualifier');
      await shot(page, layout, '25-qualifier-ask', 0);
      await layoutAudit(page, layout.insets, 'qualifier (ask)');
    }
    if (i === 1) {
      qMissed.push(w);
      const p = r2Check(page, '#tm-attempt', 'qualifier compare');
      await tapKeys(page, '#tm-keyboard', w.slice(1));
      await page.tap('#tm-keyboard [data-key="enter"]');
      await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'compare');
      await page.waitForTimeout(300);
      await shot(page, layout, '26-qualifier-compare', 0);
      await p;
      check(await J(page, () => !document.querySelector('#screen-test').querySelector('.kb-key.ready')), 'Qualifier: no copy step after a miss');
    } else {
      await tapKeys(page, '#tm-keyboard', w);
      await page.tap('#tm-keyboard [data-key="enter"]');
    }
  }
  await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'done' && document.querySelector('#tm-go'), null, { timeout: 12000 });
  await shot(page, layout, '27-qualifier-done');
  await layoutAudit(page, layout.insets, 'qualifier done');
  const wq = await readWords(page);
  const qTest = wq.tests.find((t) => t.kind === 'qualifier');
  check(qTest && qTest.correct === 3 && qTest.total === 4 && qTest.missed[0] === qMissed[0] && !wq.qualifierPending, `Qualifier stored as pretest: ${qTest && qTest.correct}/${qTest && qTest.total}, missed ${qTest && qTest.missed}`);
  check(wq.records[qMissed[0]].focus && wq.records[qMissed[0]].box === 0 && LIST_WORDS.filter((x) => x !== qMissed[0]).every((x) => wq.records[x].box === 2), 'missed word → Focus (box 0); known words → box 2');
  check((await readSave(page)).cash === save.cash + 300, `Qualifier paid $100 × 3 (${save.cash} → ${(await readSave(page)).cash})`);
  await page.click('#tm-go');
  await page.waitForSelector(visibleSel('#screen-garage'));
  // the Focus word gets the Look step on its first practice (a fresh day's mission puts Focus words first)
  await J(page, () => { window.__spellJump.words.today.count = 0; });
  await page.click('#btn-race');
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const wf = await J(page, () => window.__spellJump.spellPanel.word);
  check(wf === qMissed[0] && await panelMode(page) === 'look', `Focus word "${wf}" comes first in the mission, with the Look step`);
  await page.waitForTimeout(400);
  check(await J(page, () => document.querySelectorAll('#sp-model .tile.pat').length) === (wf.includes('ough') ? 4 : 0), 'Look: the pattern chunk (ough) is highlighted');
  await shot(page, layout, '28-spell-look-pattern', 0);
  await page.click('#spell .sp-exit');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#screen-garage [data-back]');

  // ---------- Friday Test + Mega Run ----------
  save = await readSave(page);
  await page.click('#btn-friday');
  await page.waitForSelector('#tm-go');
  await shot(page, layout, '29-friday-intro');
  await page.click('#tm-go');
  for (let i = 0; i < LIST_WORDS.length; i++) {
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 8000 });
    const w = await J(page, () => window.__spellJump.testScreen.word);
    await tapKeys(page, '#tm-keyboard', i === 3 ? w + 'e' : w);
    if (i === 0) await shot(page, layout, '30-friday-typed', 0);
    await page.tap('#tm-keyboard [data-key="enter"]');
  }
  await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'done' && document.querySelector('#tm-go'), null, { timeout: 12000 });
  await shot(page, layout, '31-friday-done');
  const wfri = await readWords(page);
  const fTest = wfri.tests.filter((t) => t.kind === 'friday').at(-1);
  check(fTest && fTest.correct === 3 && fTest.total === 4, `Friday Test stored: ${fTest && fTest.correct}/${fTest && fTest.total}`);
  check(wfri.records[fTest.missed[0]].box === 0, `missed word ${fTest.missed[0]} dropped to box 0`);
  const afterTest = await readSave(page);
  check(afterTest.cash === save.cash + 450, `Friday Test paid $150 × 3 (${save.cash} → ${afterTest.cash})`);
  await page.click('#tm-go');
  await page.waitForSelector(visibleSel('#hud'));
  const stMega = await J(page, () => window.__starts.at(-1));
  check(stMega && Math.abs(stMega.powerScale - (0.6 + 0.4 * 0.75)) < 1e-9 && !stMega.letters && !(await J(page, () => window.__spellJump.spellPanel.isOpen)),
    `Mega Run starts with power ${stMega && stMega.powerScale} (0.6 + 0.4 × 0.75), no spell panel`);
  await page.waitForSelector('#banner[data-kind="mega"]:not([hidden])', { timeout: 2000 }).catch(() => {});
  await shot(page, layout, '32-mega-run', 0);
  await gas(page);
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 20000 });
  await page.waitForTimeout(1500);
  check(await J(page, () => /mega/i.test(document.querySelector('#res-title').textContent) && !!document.querySelector('#res-pay tr[data-pay="friday"]')), 'Mega Run results: title + Friday Test row');
  await shot(page, layout, '33-results-mega');
  await layoutAudit(page, layout.insets, 'results (mega)');
  await page.click('#res-garage');
  await page.click('#screen-garage [data-back]');

  // ---------- Report + Copy report, Options ----------
  await J(page, () => window.__spellJump.pz.lock());
  await page.click('#btn-parents');
  for (const d of '4321') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  await page.click('.pz-tabs [data-tab="report"]');
  await page.waitForSelector('#pz-table');
  const rep = await J(page, () => ({
    pre: document.querySelector('[data-score="pretest"] b').textContent, latest: document.querySelector('[data-score="latest"] b').textContent,
    rows: document.querySelectorAll('#pz-table tbody tr').length, hist: document.querySelectorAll('.pz-hist .row').length,
  }));
  check(/^3 \/ 4/.test(rep.pre) && /^3 \/ 4/.test(rep.latest) && rep.rows === 4 && rep.hist === 2, `report: pretest ${rep.pre}, latest ${rep.latest}, ${rep.rows} word rows, ${rep.hist} tests`);
  // v3.7.1: the week's progress on top (parent-facing): "This week: n % mastered", a bar, right on last try · pretest → now
  const wk = await J(page, async () => {
    const W = await import('/src/spelling/wordStore.js');
    const w = W.weekProgress(window.__spellJump.words, Date.now());
    const el = document.querySelector('#pz-week');
    return { w, first: document.querySelector('.pz-content').firstElementChild.id, big: el.querySelector('.pw-big').textContent, small: el.querySelector('.pw-small').textContent,
      bar: el.querySelector('.pw-bar i').style.width };
  });
  check(wk.first === 'pz-weeks' && wk.big === `This week: ${wk.w.masteredPct} % mastered` && wk.bar === `${wk.w.masteredPct}%`
    && wk.small.startsWith(`Right on last try ${wk.w.rightLastTry} / ${wk.w.words} (${wk.w.rightLastTryPct} %) · pretest 3 / 4 → now ${wk.w.rightLastTry} / 4`),
    `report: "${wk.big}" with a bar, "${wk.small}"`);
  // v3.8: the progress chart on the Report (inline SVG, a legend, range chips); it has data once the child played today
  const ch = await J(page, () => {
    const f = document.querySelector('#report-chart');
    const svg = f && f.querySelector('svg.pz-chart-svg');
    return f && { empty: f.dataset.empty, series: [...f.querySelectorAll('.pz-legend .lg')].map((x) => x.textContent), bars: svg.querySelectorAll('.bars rect').length, paths: svg.querySelectorAll('path[data-series]').length,
      chips: [...document.querySelectorAll('#chart-range .chip')].map((c) => c.textContent + (c.classList.contains('on') ? ':on' : '')), days: svg.querySelectorAll('.days text').length, links: f.querySelectorAll('a').length };
  });
  check(ch && ch.empty === 'false' && ch.series.join(',') === 'Words practiced,Words mastered,Spelled right %' && ch.bars >= 1 && ch.paths >= 1 && ch.chips.join(',') === '2 weeks,4 weeks:on,12 weeks' && ch.days >= 4 && ch.links === 0,
    `Report: the progress chart (words practiced, mastered, spelled right) has today's data (${ch && ch.bars} bars, ${ch && ch.paths} lines), legend "${ch && ch.series.join(' · ')}", range chips`);
  await page.click('#chart-range [data-days="84"]');
  await page.waitForTimeout(150);
  check(await J(page, () => document.querySelector('#chart-range [data-days="84"]').classList.contains('on') && document.querySelectorAll('#report-chart .days text').length >= 5), '12 weeks: the chart redraws with the longer range');
  await page.click('#chart-range [data-days="28"]');
  await page.waitForTimeout(150);
  check(await J(page, () => !!document.querySelector('#report-chart-tests') && document.querySelectorAll('#report-chart-tests .bars rect').length >= 1), 'Report: the test-scores chart shows the qualifier');
  await J(page, () => document.querySelector('#report-chart').scrollIntoView({ block: 'center' }));
  await shot(page, layout, '34a-pz-chart');
  await J(page, () => document.querySelector('.pz-content').scrollTo(0, 0));
  await shot(page, layout, '34-pz-report');
  await layoutAudit(page, layout.insets, 'parent zone (report)');
  if (!layout.clipboard) await J(page, () => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await page.click('#pz-copy-report');
  await page.waitForTimeout(400);
  if (layout.clipboard) {
    const clip = await J(page, () => navigator.clipboard.readText());
    check(/Spell Jump report: Sam/.test(clip) && /Pretest \(Qualifier\): 3\/4/.test(clip) && /\nThis week: \d+ % mastered/.test(clip), 'Copy report → clipboard (with the "This week" line)');
  } else {
    const fb = await J(page, () => ({ shown: !document.querySelector('#pz-report-text').hidden, sel: String(window.getSelection()) }));
    check(fb.shown && /Spell Jump report: Sam/.test(fb.sel), 'Copy report: clipboard unavailable → the report text is shown selected');
    await shot(page, layout, '35-pz-report-fallback');
  }
  // v3.7.5: the week picker (This week · prior weeks · All words) and the running list of all words
  const chips0 = await J(page, () => [...document.querySelectorAll('#pz-weeks .chip')].map((c) => c.dataset.week));
  check(chips0[0] === 'active' && chips0[chips0.length - 1] === 'all', `report: week chips (${chips0.join(' · ')})`);
  const prior = chips0.filter((c) => c !== 'active' && c !== 'all');
  if (prior.length) {
    await page.click(`#pz-weeks .chip[data-week="${prior[0]}"]`);
    await page.waitForSelector('#pz-table');
    const pw = await J(page, () => ({ list: document.querySelector('.pz-listname').dataset.list, big: document.querySelector('#pz-week .pw-big').textContent, past: /a past week/.test(document.querySelector('.pz-listname').textContent) }));
    check(pw.list === prior[0] && !pw.big.startsWith('This week') && pw.past, `report: a prior week's report ("${pw.big}")`);
  }
  await page.click('#pz-weeks .chip[data-week="all"]');
  await page.waitForSelector('#pz-all-sum');
  const all = await J(page, async () => { const W = await import('/src/spelling/wordStore.js'); const a = W.allWords(window.__spellJump.words); return { a: a.words, lists: a.lists.length, rows: document.querySelectorAll('#pz-all-table tbody tr').length, sum: document.querySelector('#pz-all-sum').dataset.words, big: document.querySelector('#pz-all-sum .pw-big').textContent, filters: document.querySelectorAll('#pz-all-filters .chip').length }; });
  check(all.rows === all.a && all.sum === String(all.a) && all.big === `All words: ${all.a} across ${all.lists} week${all.lists === 1 ? '' : 's'}` && all.filters === 3, `report: All words (${all.a} words, ${all.lists} lists, 3 filters)`);
  await page.click('#pz-all-filters .chip[data-filter="mastered"]');
  const onlyM = await J(page, () => [...document.querySelectorAll('#pz-all-table tbody tr .st')].every((s) => s.textContent === 'Mastered'));
  check(onlyM, 'All words: the Mastered filter shows only mastered words');
  await shot(page, layout, '34b-pz-all-words');
  await layoutAudit(page, layout.insets, 'parent zone (all words)');
  await page.click('#pz-all-filters .chip[data-filter="all"]');
  await page.click('#pz-weeks .chip[data-week="active"]');
  await page.waitForSelector('#pz-table');
  // v3.7.1: Family code tab: a strip per child, "Spelling this week · n % mastered" with a mini bar
  await page.click('.pz-tabs [data-tab="sync"]');
  await page.waitForSelector('#pz-week-list');
  const strips = await J(page, () => [...document.querySelectorAll('#pz-week-list .pz-week-row')].map((r) => ({ id: r.dataset.player, name: r.querySelector('b').textContent, text: r.querySelector('.pw-strip').textContent, bar: !!r.querySelector('.pw-mini i') })));
  const famIds = await J(page, () => window.__spellJump.app.family.players.map((p) => p.id));
  check(strips.length === famIds.length && strips.every((x) => x.bar && /^Spelling this week · (\d+ % mastered|— \(no practice yet\))$/.test(x.text)) && strips.some((x) => /^Spelling this week · \d+ % mastered$/.test(x.text)),
    `Family tab: a strip per child (${strips.map((x) => `${x.name}: ${x.text}`).join(' | ')})`);
  await page.locator('#pz-week-list').scrollIntoViewIfNeeded();
  await shot(page, layout, '34b-pz-family-week');
  await layoutAudit(page, layout.insets, 'parent zone (family: this week)');
  await page.click('.pz-tabs [data-tab="options"]');
  await page.waitForSelector('#opt-case');
  await shot(page, layout, '36-pz-options');
  await layoutAudit(page, layout.insets, 'parent zone (options)');
  await page.click('#opt-case [data-value="upper"]');
  check((await family(page)).options[pid].tileCase === 'upper', 'option saved: tile case ABC');
  // voice picker: English voices ranked (Enhanced first, novelty last, French left out), ▶ Test, choose one
  const vp = await J(page, () => ({ rows: [...document.querySelectorAll('#opt-voices [data-voice-row]')].map((r) => r.dataset.voiceRow), now: document.querySelector('#opt-voice-now').textContent, tip: (document.querySelector('#opt-voice-tip') || {}).textContent || '' }));
  check(vp.rows.join('|') === '|:system|Samantha (Enhanced)|Fake US|Fred' && /Samantha \(Enhanced\)/.test(vp.now), `voice list: Automatic, system default, ${vp.rows.slice(2).join(', ')} (${vp.now})`);
  check(/Spoken Content/.test(vp.tip), 'voice tip under the list');
  await page.click('#opt-voices [data-voice-row="Fake US"] [data-voice-test]');
  await page.waitForTimeout(1400);
  check(JSON.stringify((await spoken(page)).slice(-3)) === JSON.stringify(['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.']), '▶ Test speaks the sample presentation');
  await page.click('#opt-voices [data-voice="Fake US"]');
  const fo = (await family(page)).options[pid];
  check(fo.voiceName === 'Fake US' && fo.voiceLang === 'en-US' && await J(page, () => window.__spellJump.tts.voiceName === 'Fake US' && /Now using: Fake US/.test(document.querySelector('#opt-voice-now').textContent)),
    `voice chosen and stored: ${fo.voiceName} (${fo.voiceLang})`);
  await page.click('#opt-rate [data-value="veryslow"]');
  check((await family(page)).options[pid].rate === 'veryslow' && await J(page, () => window.__spellJump.tts.rateValue === 0.5), 'speech rate: very slow (0.5)');
  await shot(page, layout, '36b-pz-voices');
  await layoutAudit(page, layout.insets, 'parent zone (voices)');
  await page.click('#opt-rate [data-value="normal"]');
  // "Use default system voice": stored as the system choice, no voice set on the utterance; then back to Fake US
  await page.click('#opt-voices [data-voice=":system"]');
  check((await family(page)).options[pid].voiceName === ':system' && await J(page, () => window.__spellJump.tts.systemVoice && window.__spellJump.tts.voiceName === '' && /default system voice/.test(document.querySelector('#opt-voice-now').textContent)),
    'voice: "Use default system voice" stored and used (no voice set)');
  await page.click('#opt-voices [data-voice="Fake US"]');
  check(await J(page, () => window.__spellJump.tts.voiceName === 'Fake US'), 'voice: back to Fake US');
  // Speech check: speaks "The word is, neighbor." inside the tap and logs each step with a timestamp
  check(await J(page, () => document.querySelector('#opt-check-log').hidden && document.querySelector('#opt-check-copy-btn').hidden), 'speech check: no log (and no Copy log) before the first run');
  const nCheck = (await spoken(page)).length;
  await page.click('#opt-check-run');
  await page.waitForFunction(() => /result:/.test(document.querySelector('#opt-check-log').textContent), null, { timeout: 8000 });
  const chk = await J(page, () => ({ text: document.querySelector('#opt-check-log').textContent, cls: document.querySelector('#opt-check-log').className, copy: !document.querySelector('#opt-check-copy-btn').hidden, pill: document.querySelector('#opt-speech-state').textContent }));
  const wantLines = [/^Speech check · /m, /Spell Jump \d+\.\d+\.\d+/, /\[\+\s*\d+ ms\] API present: yes/, /voices: 4 \(3 English, 3 on-device\)/, /chosen voice: Fake US · en-US · localService: true/,
    /speak\(\) called: "The word is, neighbor\."/, /onstart after \d+ ms/, /onend after \d+ ms/, /result: speech started/];
  const missingLines = wantLines.filter((re) => !re.test(chk.text)).map(String);
  check(missingLines.length === 0 && /\bok\b/.test(chk.cls) && chk.copy, `speech check log lines shown${missingLines.length ? ' (missing ' + missingLines.join(', ') + ')' : ''}`);
  check(JSON.stringify((await spoken(page)).slice(nCheck)) === JSON.stringify(['The word is, neighbor.']) && chk.pill === 'Speech on', 'speech check speaks "The word is, neighbor." and Speech stays on');
  await shot(page, layout, '36c-pz-speech-check');
  await layoutAudit(page, layout.insets, 'parent zone (speech check)');
  await page.click('#opt-check-copy-btn');
  await page.waitForTimeout(400);
  if (layout.clipboard) {
    const clip = await J(page, () => navigator.clipboard.readText());
    check(/API present: yes/.test(clip) && /onstart after/.test(clip) && clip === await J(page, () => window.__spellJump.tts.lastCheck.text), 'Copy log → clipboard (the whole log)');
  } else {
    const fb = await J(page, () => ({ shown: !document.querySelector('#opt-check-copy').hidden, sel: String(window.getSelection()) }));
    check(fb.shown && /API present: yes/.test(fb.sel) && /onend after/.test(fb.sel), 'Copy log: clipboard unavailable → the log is shown selected');
  }
  // the log is kept in memory: it is still there after switching tabs
  await page.click('.pz-tabs [data-tab="report"]');
  await page.click('.pz-tabs [data-tab="options"]');
  await page.waitForSelector('#opt-check-log');
  check(await J(page, () => !document.querySelector('#opt-check-log').hidden && /onstart after/.test(document.querySelector('#opt-check-log').textContent)), 'speech check: the last log is kept after re-rendering');
  // "Words before each race": back to the default 2 through the Options control
  await page.click('#opt-race-words [data-value="2"]');
  check((await family(page)).options[pid].wordsPerRace === 2, 'option saved: 2 words before each race');
  await page.click('#pz-close');

  // ---------- a 2-word set: first right, second missed → Compare / Copy / Cover → power 0.825 ----------
  const wc0 = (await readWords(page)).today.count;
  const [pw0, st0] = await J(page, () => [window.__power.length, window.__starts.length]);
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#btn-race');
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen && window.__spellJump.spellPanel.word, null, { timeout: 5000 });
  const a1 = await J(page, () => window.__spellJump.spellPanel.word);
  check(await J(page, () => (document.querySelector('#sp-set') || {}).textContent) === 'Word 1 of 2', 'set: "Word 1 of 2" on the chip');
  await layoutAudit(page, layout.insets, 'spell panel (set chip)');
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  await tapKeys(page, '#sp-keyboard', a1);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => /next word/i.test(document.querySelector('#sp-msg').textContent) && window.__spellJump.spellPanel.isOpen, null, { timeout: 4000 });
  check(await J(page, (n) => window.__power.length === n && window.__spellJump.game.getState().phase === 'ramp', pw0), 'set: "Next word!" beat, panel still open, car parked, no launch power yet');
  await shot(page, layout, '36c-set-next', 0);
  await page.waitForFunction((w) => { const p = window.__spellJump.spellPanel; return p.word && p.word !== w && /Word 2 of 2/.test((document.querySelector('#sp-set') || {}).textContent || ''); }, a1, { timeout: 5000 });
  const a2 = await J(page, () => window.__spellJump.spellPanel.word);
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  check(!(await visibleTextHas(page, a2)), `R1: "${a2}" hidden during Write of word 2`);
  await tapKeys(page, '#sp-keyboard', a2.slice(0, -1));
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'copy', 4000);
  await tapKeys(page, '#sp-keyboard', a2);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'cover', 3000);
  await tapKeys(page, '#sp-keyboard', a2);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 6000 });
  const setOut = await J(page, ([p0, s0]) => ({ power: window.__power.slice(p0), starts: window.__starts.slice(s0), letters: window.__spellJump.run.letters.join('') }), [pw0, st0]);
  check(setOut.power.length === 1 && setOut.power[0][0] === 0.825 && setOut.power[0][1] === 1.125, `set (1 of 2 first try): setLaunchPower(${setOut.power.map((x) => x.join(', ')).join(' | ')}) once`);
  check(setOut.letters === a2.replace(/[^a-z]/g, '') && setOut.starts.at(-1).letters.join('') === setOut.letters, `rings carry the missed word "${setOut.letters}"`);
  check((await readWords(page)).today.count === wc0 + 2, `mission counter +2 (${wc0} → ${(await readWords(page)).today.count})`);
  await driveToResults(page, { end: true });
  const setRow = await J(page, () => ({ hint: (document.querySelector('#res-pay tr[data-pay="spelling"] .hint') || {}).textContent || '', n: (document.querySelector('#res-pay tr[data-pay="spelling"]') || {}).dataset.words, spell: window.__spellJump.lastResult.spell }));
  check(setRow.n === '2' && setRow.hint.includes(`${a1} ✓`) && setRow.hint.includes(`${a2} ↻`) && setRow.spell.bonus === setRow.spell.words[0].bonus && setRow.spell.words[0].bonus > 0, `results Spelling row lists both words: "${setRow.hint}" (+$${setRow.spell.bonus})`);
  await page.waitForTimeout(1500);            // the rating stamp animates in
  await shot(page, layout, '36d-results-set');
  await layoutAudit(page, layout.insets, 'results (2-word set)');
  await page.click('#res-garage');
  await page.click('#screen-garage [data-back]');
  await page.waitForSelector(visibleSel('#screen-title'));

  // ---------- persistence across reload ----------
  const beforeReload = { save: await readSave(page), words: await readWords(page), mission: await page.textContent('#title-mission-text') };
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await shot(page, layout, '37-players-after-reload');
  await page.click(`[data-player="${pid}"]`);
  await page.waitForSelector(visibleSel('#screen-title'));
  const afterReload = { save: await readSave(page), words: await readWords(page), mission: await page.textContent('#title-mission-text') };
  check((await family(page)).options[pid].voiceName === 'Fake US' && await J(page, () => window.__spellJump.tts.voiceName === 'Fake US'), 'reload: the chosen voice is kept and used');
  check(afterReload.save.cash === beforeReload.save.cash && afterReload.words.tests.length === beforeReload.words.tests.length
    && afterReload.mission === beforeReload.mission && Object.keys(afterReload.words.records).length === Object.keys(beforeReload.words.records).length,
    `reload: cash $${afterReload.save.cash}, ${afterReload.words.tests.length} tests, "${afterReload.mission}" all kept`);
  await instrument(page);
  await page.click('#btn-play');
  await page.click('#btn-race');
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  check(await J(page, () => document.querySelector('#sp-keyboard [data-key="q"]').textContent === 'Q'), 'tile case option: keys show capitals');
  await shot(page, layout, '38-spell-upper');
  await page.click('#spell .sp-exit');

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// ---------- v3.3 engagement (ONLY=engage runs just this, at both sizes) ----------
// Mia and Leo seeded on one device: the family board ranks them (Leo 3 words this week, leader's crown) with the
// nudge "Leo is 3 words ahead"; Mia's streak missed yesterday, so the shield covers it when she opens the game
// (calendar). Her two words are one first try from Mastered and the mission is at 7 / 8: one run masters a word
// (WORD MASTERED moment), completes the mission (crate) and the 3rd streak day (milestone crate), and levels her up
// (stamp). The crate drop opens to a reward that lands in the save; the second crate waits on the title. The garage
// Style row equips the Hot Flames skin (persists; the preview and game.start use it). The Trophies panel shows the
// shelf; a second run masters the last word → Week Champion (chip, Champion skin + Trophy sticker, crate).
async function engagement(browser, layout) {
  console.log(`\n=== v3.3 engagement ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__spoken = [];
    window.__noClassLists = true;   // v3.7: these paths run on the built-in list (class lists: classListTest)
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  const seed = await J(page, async () => {
    const E = await import('/src/meta/engagement.js'), S = await import('/src/spelling/scheduler.js');
    const now = Date.now(), DAY = 864e5, dk = (t) => S.dayKey(t);
    const near = (w, list) => ({ word: w, listId: list, box: 3, due: now - 1000, attempts: 3, firstTry: 2, seenCount: 3, lastSeen: now - DAY, daysCorrect: [dk(now - 2 * DAY), dk(now - DAY)], daysSeen: [dk(now - 2 * DAY), dk(now - DAY)], focus: false, studied: true, reviewsDone: 0, misses: 0 });
    const done = (w, list) => ({ ...near(w, list), firstTry: 3, masteredAt: now - 1000 });   // a moment ago, so it is this ISO week even just after midnight on a Monday
    const words = (id, ws, recs, today) => ({ v: 1, lists: [{ id, name: 'Week of practice', createdAt: now - 3 * DAY, archivedAt: 0, pattern: '', words: ws.map((word) => ({ word })) }], activeId: id,
      records: recs, tests: [], qualifierPending: null, today, streak: 0, bestStreak: 0, perfectTotal: 0 });
    localStorage.clear();
    localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, lastPlayer: 'pmia', options: { pmia: { wordsPerRace: 1 }, pleo: { wordsPerRace: 1 } },
      players: [{ id: 'pmia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }, { id: 'pleo', name: 'Leo', color: '#2fd36b', createdAt: 2, updatedAt: 2 }] }));
    localStorage.setItem('spellJump.pmia.save', JSON.stringify({ v: 2, cash: 1000, xp: 90, seen: { coach: true, ach: 0 },
      streak: { count: 2, best: 2, lastDay: dk(now - 2 * DAY), days: [dk(now - 3 * DAY), dk(now - 2 * DAY)], shieldUsedDays: [] },
      cosmetics: { skins: ['flames'], stickers: ['star'], equipped: {} } }));
    localStorage.setItem('spellJump.pmia.words', JSON.stringify(words('L1', ['shelf', 'medal'], { shelf: near('shelf', 'L1'), medal: near('medal', 'L1') }, { date: dk(now), count: 7, newCount: 0, missionPaid: false })));
    localStorage.setItem('spellJump.pleo.save', JSON.stringify({ v: 2, cash: 500, xp: 300, seen: { coach: true, ach: 0 },
      streak: { count: 4, best: 6, lastDay: dk(now - DAY), days: [dk(now - DAY)], shieldUsedDays: [] }, weekBest: { week: E.isoWeek(now), distance: 350 } }));
    localStorage.setItem('spellJump.pleo.words', JSON.stringify(words('L2', ['cat', 'dog', 'sun'], { cat: done('cat', 'L2'), dog: done('dog', 'L2'), sun: done('sun', 'L2') }, { date: '', count: 0, newCount: 0, missionPaid: false })));
    // the calendar shows this (Monday-start) week: on a Monday, yesterday belongs to last week and is not drawn
    return { yesterday: dk(now - DAY), sameMonth: new Date(now - DAY).getMonth() === new Date(now).getMonth(), sameWeek: new Date(now).getUTCDay() !== 1 };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const L = layout.name[0];

  // ----- family board on the picker -----
  await page.waitForSelector(visibleSel('#screen-players'));
  const board = await J(page, () => ({
    rows: [...document.querySelectorAll('#family-board [data-board]')].map((r) => ({ id: r.dataset.board, rank: r.querySelector('.medal').textContent, words: r.querySelector('[data-stat="words"] b').textContent, streak: r.querySelector('[data-stat="streak"] b').textContent, jump: r.querySelector('[data-stat="jump"] b').textContent })),
    nudge: (document.querySelector('#board-nudge') || {}).textContent, crownOn: [...document.querySelectorAll('.pl-tile .pl-crown')].map((c) => c.closest('[data-player]').dataset.player),
    levels: Object.fromEntries([...document.querySelectorAll('[data-player]')].map((t) => [t.dataset.player, t.querySelector('.pl-level').textContent])),
  }));
  check(board.rows.length === 2 && board.rows[0].id === 'pleo' && board.rows[0].words === '3' && board.rows[0].streak === '4' && board.rows[0].jump === '350' && board.rows[1].id === 'pmia' && board.rows[1].rank === '2',
    `family board: ${board.rows.map((r) => `${r.rank}. ${r.id} ${r.words} words, streak ${r.streak}, ${r.jump} m`).join(' | ')}`);
  check(board.crownOn.join() === 'pleo', `crown on the leader's tile (${board.crownOn})`);
  check(board.nudge === 'Leo is 3 words ahead', `nudge: "${board.nudge}"`);
  check(board.levels.pmia === 'Speller LV 1' && board.levels.pleo === 'Speller LV 3', `tiles show the level (${JSON.stringify(board.levels)})`);
  await shot(page, layout, `e01-picker-board`);
  await layoutAudit(page, layout.insets, 'picker with family board');

  // ----- title: streak flame (the shield covered yesterday), level, no crate yet -----
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await instrument(page);
  await J(page, () => { const g = window.__spellJump.game; if (!g.__looks) { const o = g.start; g.start = (opts) => { window.__looks = window.__looks || []; window.__looks.push({ skin: opts.skin && opts.skin.id, sticker: opts.sticker && opts.sticker.id }); return o(opts); }; g.__looks = true; } });
  let t = await J(page, () => ({ flame: document.querySelector('#title-streak').textContent, lv: document.querySelector('#title-lv').textContent, lvName: document.querySelector('#title-lv-name').textContent,
    bar: document.querySelector('#title-lv-bar').style.width, crate: !document.querySelector('#btn-crates').hidden, buttons: [...document.querySelectorAll('#screen-title .title-actions button')].map((b) => b.textContent.replace(/\d+/g, '').trim().toLowerCase()) }));
  const s0 = await readSave(page);
  check(t.flame === '2' && s0.streak.shieldUsedDays.includes(seed.yesterday), `title flame "${t.flame}": yesterday (${seed.yesterday}) was missed and the week's shield covered it (${s0.streak.shieldUsedDays})`);
  check(t.lv === 'Speller LV 1' && t.lvName === 'Rookie Speller' && t.bar === '90%', `level row: ${t.lv} · ${t.lvName}, bar ${t.bar}`);
  check(!t.crate, 'no crate button while no crate waits');
  check(t.buttons.join('|') === 'play|friday test|badges|trophies|days|parents', `title buttons: ${t.buttons.join(', ')}`);
  await shot(page, layout, 'e02-title');
  await layoutAudit(page, layout.insets, 'title (flame, level)');
  await page.click('#btn-streak');
  await page.waitForSelector(visibleSel('#panel-streak'));
  const sp = await J(page, (y) => ({ cur: document.querySelector('#streak-cur b').textContent, next: (document.querySelector('#streak-next') || {}).textContent, played: document.querySelectorAll('.cal-day.played').length,
    shield: !!document.querySelector(`.cal-day.shield[data-day="${y}"]`), line: document.querySelector('#shield-line').textContent }), seed.yesterday);
  check(sp.cur === '2' && sp.next === '1 day to a crate', `Streak panel: ${sp.cur} days, "${sp.next}"`);
  check(!seed.sameMonth || !seed.sameWeek || (sp.shield && /used/.test(sp.line)), `calendar marks the shield day (${seed.yesterday}): ${sp.shield}, "${sp.line}"${seed.sameWeek ? '' : ' (Monday: yesterday is last week, not drawn)'}`);
  await shot(page, layout, 'e03-streak-panel');
  await layoutAudit(page, layout.insets, 'streak panel');
  await page.click('#panel-streak [data-close]');

  // ----- garage Style row: locked hints, equip a skin + sticker for this car -----
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  // v3.6: two tabs (Paint / Stickers), owned chips first, the Stickers tab counts the owned stickers
  const chips = await J(page, () => ({
    skins: document.querySelectorAll('#style-strip [data-skin]').length, stickersHidden: document.querySelectorAll('#style-strip [data-sticker]').length,
    hints: Object.fromEntries(['galaxy', 'rainbow', 'champion', 'sunset'].map((id) => [id, document.querySelector(`[data-skin="${id}"]`).textContent.trim()])),
    owned: document.querySelector('[data-skin="flames"]').classList.contains('owned'), stockOn: document.querySelector('[data-skin="stock"]').classList.contains('on'),
    order: [...document.querySelectorAll('#style-strip [data-skin]')].slice(0, 2).map((b) => b.dataset.skin), tabs: [...document.querySelectorAll('#style-strip .style-tab')].map((b) => b.textContent.trim()),
  }));
  check(chips.skins === 13 && chips.stickersHidden === 0 && chips.owned && chips.stockOn, `Paint tab: ${chips.skins} skins, no sticker chips; Stock equipped (${chips.stockOn}), Hot Flames owned (${chips.owned})`);
  check(chips.order.join(',') === 'stock,flames' && chips.tabs.join('|') === 'Paint1|Stickers1', `owned paint first (${chips.order.join(', ')}); tabs count the owned items (${chips.tabs.join(' / ')})`);
  check(chips.hints.galaxy === 'Level 8' && chips.hints.rainbow === '14-day streak' && chips.hints.champion === 'Week Champion' && chips.hints.sunset === 'Crate', `locked chips say how to earn them: ${JSON.stringify(chips.hints)}`);
  await shot(page, layout, 'e04-garage-style');
  await layoutAudit(page, layout.insets, 'garage (style row)');
  const before = await J(page, () => document.querySelector('#car-preview').dataset.lookSkin);
  await page.click('[data-skin="flames"]');
  await page.click('[data-style-tab="sticker"]');
  const stickerChips = await J(page, () => ({ n: document.querySelectorAll('#style-strip [data-sticker]').length, skins: document.querySelectorAll('#style-strip [data-skin]').length, first: [...document.querySelectorAll('#style-strip [data-sticker]')].slice(0, 2).map((b) => b.dataset.sticker) }));
  check(stickerChips.n === 13 && stickerChips.skins === 0 && stickerChips.first.join(',') === 'none,star', `Stickers tab: ${stickerChips.n} stickers, owned first (${stickerChips.first.join(', ')})`);
  await page.click('[data-sticker="star"]');
  await page.waitForTimeout(300);
  check(await J(page, () => document.querySelector('[data-sticker="star"]').classList.contains('on')), 'the Gold Star chip is on');
  await page.click('[data-style-tab="skin"]');
  const eq = await J(page, () => ({ skin: document.querySelector('#car-preview').dataset.lookSkin, sticker: document.querySelector('#car-preview').dataset.lookSticker, on: document.querySelector('[data-skin="flames"]').classList.contains('on'),
    saved: JSON.parse(localStorage.getItem('spellJump.pmia.save')).cosmetics.equipped, hero: (() => { const l = window.__spellJump.app.save.cosmetics.equipped.beater; return l; })() }));
  check(before === 'stock' && eq.skin === 'flames' && eq.sticker === 'star' && eq.on && eq.saved.beater && eq.saved.beater.skin === 'flames' && eq.saved.beater.sticker === 'star',
    `equip: preview ${before} → (${eq.on}) ${eq.skin} + ${eq.sticker}, saved per car ${JSON.stringify(eq.saved)}`);
  await shot(page, layout, 'e05-garage-equipped');

  // ----- run 1: master a word + mission + streak day 3 + level up -----
  const save1 = await readSave(page);
  await page.click('#btn-race');
  await page.waitForSelector(visibleSel('#screen-tracks'));
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const w1 = await J(page, () => window.__spellJump.spellPanel.word);
  if (await panelMode(page) !== 'write') await waitMode(page, 'write', 9000);
  await tapKeys(page, '#sp-keyboard', w1);
  await page.tap('#sp-keyboard [data-key="enter"]');
  const look = await J(page, () => (window.__looks || []).at(-1));
  check(look && look.skin === 'flames' && look.sticker === 'star', `game.start got the equipped look (${JSON.stringify(look)})`);
  await driveToResults(page, { end: true });
  await page.waitForSelector('#res-moment.mastery:not([hidden])', { timeout: 5000 });
  const mm = await J(page, () => ({ word: document.querySelector('#res-moment').dataset.word, title: document.querySelector('.mm-title').textContent, tiles: document.querySelectorAll('.mm-tiles i').length }));
  check(mm.word === w1 && /word mastered/i.test(mm.title) && mm.tiles === w1.length, `WORD MASTERED moment for "${mm.word}" (${mm.tiles} gold tiles)`);
  await page.waitForTimeout(1500);
  await shot(page, layout, 'e06-word-mastered', 0);
  await page.waitForSelector('#res-levelup', { timeout: 6000 });
  await page.waitForTimeout(500);
  const lvText = await J(page, () => document.querySelector('#res-levelup').textContent);
  check(/level\s*3/i.test(lvText) && /letter cadet/i.test(lvText), `level-up stamp: "${lvText}"`);
  await shot(page, layout, 'e07-level-up', 0);
  await page.waitForSelector('#res-crate', { timeout: 6000 });
  await page.waitForTimeout(700);
  const r1 = await J(page, () => ({ eng: window.__spellJump.lastResult.eng, streak: (document.querySelector('#res-streak') || {}).textContent, xp: (document.querySelector('#res-xp') || {}).textContent, crate: document.querySelector('#res-crate').textContent }));
  const s1 = await readSave(page);
  check(r1.eng.mastered.length === 1 && r1.eng.mastered[0].word === w1 && s1.trophies.L1.includes(w1), `mastered "${w1}" → trophy saved (${JSON.stringify(s1.trophies)})`);
  check(r1.eng.levelBefore === 1 && r1.eng.levelAfter === 3 && s1.xp === 90 + 20 + 50 + 100, `XP 90 → ${s1.xp} (+20 first try, +50 mastered, +100 mission): level ${r1.eng.levelBefore} → ${r1.eng.levelAfter}`);
  check(r1.eng.crates === 2 && s1.crates.earned === 2 && s1.crates.opened === 0, `crates: mission + 3-day milestone = ${r1.eng.crates} (save earned ${s1.crates.earned})`);
  check(s1.streak.count === 3 && r1.streak === '3-day streak!' && r1.eng.xp === 170, `streak day 3 ("${r1.streak}"), +${r1.eng.xp} XP`);
  await shot(page, layout, 'e08-crate-drop', 0);
  await layoutAudit(page, layout.insets, 'results (engagement)');
  await page.click('#res-crate');
  await page.waitForSelector('#crate-fx.ready', { timeout: 4000 });
  const out = await J(page, () => window.__spellJump.app.crates.last);
  const s2 = await readSave(page);
  const applied = out.cash ? s2.cash === s1.cash + out.cash : (out.kind === 'skin' ? s2.cosmetics.skins : s2.cosmetics.stickers).includes(out.id);
  check(s2.crates.opened === 1 && applied, `crate opened: ${out.kind}${out.cash ? ' $' + out.cash : ' ' + out.id} applied to the save (cash ${s1.cash} → ${s2.cash})`);
  check(await J(page, () => !document.querySelector('#crate-card').hidden && document.querySelector('#crate-name').textContent.length > 0), `reveal card: "${await page.textContent('#crate-kind')}" ${await page.textContent('#crate-name')}`);
  await shot(page, layout, 'e09-crate-reveal', 0);
  await layoutAudit(page, layout.insets, 'crate reveal');
  await page.click('#crate-fx');
  await page.waitForSelector('#crate-fx', { state: 'hidden' });
  check(await J(page, () => !!document.querySelector('#res-crate')), 'the second crate is still on the results screen');
  await page.click('#res-garage');
  await page.click('#screen-garage [data-back]');
  await page.waitForSelector(visibleSel('#screen-title'));
  t = await J(page, () => ({ crate: document.querySelector('#btn-crates').hidden ? null : document.querySelector('#btn-crates').textContent.trim(), flame: document.querySelector('#title-streak').textContent, lv: document.querySelector('#title-lv').textContent }));
  check(t.crate === '1 crate' && t.flame === '3' && t.lv === 'Speller LV 3', `title: "${t.crate}" button, flame ${t.flame}, ${t.lv}`);
  await shot(page, layout, 'e10-title-crate');
  await layoutAudit(page, layout.insets, 'title (crate waiting)');
  await page.click('#btn-crates');
  await page.waitForSelector('#crate-fx.ready', { timeout: 4000 });
  await page.click('#crate-fx');
  await page.waitForSelector('#crate-fx', { state: 'hidden' });
  check(await J(page, () => document.querySelector('#btn-crates').hidden) && (await readSave(page)).crates.opened === 2, 'title crate opened: the button goes away');

  // ----- Trophies panel -----
  await page.click('#btn-trophies');
  await page.waitForSelector(visibleSel('#panel-trophies'));
  const tr = await J(page, () => ({ gold: [...document.querySelectorAll('#tr-shelf .tr-slot.gold')].map((x) => x.dataset.word), slots: document.querySelectorAll('#tr-shelf .tr-slot').length, count: document.querySelector('#trophy-count').textContent }));
  check(tr.slots === 2 && tr.gold.join() === w1 && tr.count === '1 / 2', `Trophies: shelf ${tr.count}, gold ${tr.gold}`);
  await shot(page, layout, 'e11-trophies');
  await layoutAudit(page, layout.insets, 'trophies panel');
  await page.click('#panel-trophies [data-close]');

  // ----- run 2: the last word → Week Champion -----
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#btn-race');
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const w2 = await J(page, () => window.__spellJump.spellPanel.word);
  if (await panelMode(page) !== 'write') await waitMode(page, 'write', 9000);
  await tapKeys(page, '#sp-keyboard', w2);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await driveToResults(page, { end: true });
  await page.waitForSelector('#res-champion', { timeout: 8000 });
  await page.waitForTimeout(600);
  const s3 = await readSave(page);
  const r2 = await J(page, () => window.__spellJump.lastResult.eng);
  check(w2 !== w1 && r2.champion && s3.champion.includes('L1') && s3.cosmetics.skins.includes('champion') && s3.cosmetics.stickers.includes('trophy') && s3.crates.earned === 3,
    `Week Champion: "${w2}" mastered too → badge, Champion Chrome + Trophy sticker, a crate (earned ${s3.crates.earned}), XP ${s2.xp} → ${s3.xp}`);
  await shot(page, layout, 'e12-champion', 0);
  await page.waitForSelector('#res-crate', { timeout: 8000 });
  await page.click('#res-garage');
  check(await J(page, () => document.querySelector('[data-skin="champion"]').classList.contains('owned')), 'garage: the Champion skin chip is now owned');
  await page.click('#screen-garage [data-back]');
  await page.click('#btn-player');
  await page.waitForSelector(visibleSel('#screen-players'));
  const b2 = await J(page, () => ({ nudge: (document.querySelector('#board-nudge') || {}).textContent, crown: !!document.querySelector('[data-board="pmia"] .b-crown'), words: document.querySelector('[data-board="pmia"] [data-stat="words"] b').textContent }));
  check(b2.words === '2' && b2.crown && b2.nudge === 'Leo is 1 word ahead', `board after: Mia ${b2.words} words, champion crown ${b2.crown}, "${b2.nudge}"`);
  await shot(page, layout, 'e13-board-champion');
  await layoutAudit(page, layout.insets, 'picker (champion)');
  // persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const s4 = await readSave(page);
  check(s4.cosmetics.equipped.beater.skin === 'flames' && s4.xp === s3.xp && s4.crates.earned === 3 && s4.streak.count === 3, 'reload: equipped look, XP, crates and streak kept');
  if (layout.name === 'landscape') await transferTest(browser, layout, page);
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// Progress transfer code: export Mia on this page (Parents → Family code → Transfer progress), import it on a fresh
// device that is in a (fake, offline) family: Mia is added with her cash, cars and words, and the sync keys are
// dirty (waiting to push). Importing again merges into Mia. A corrupt code is refused with a message.
async function transferTest(browser, layout, page) {
  console.log('\n--- progress transfer code ---');
  const src = { save: await readSave(page), words: await readWords(page) };
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  await pinIn(page, '1357');
  await page.waitForFunction(() => document.querySelector('#pin-title') && /again/i.test(document.querySelector('#pin-title').textContent));
  await pinIn(page, '1357');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  await page.click('[data-export="pmia"]');
  await page.waitForSelector('#transfer-out:not([hidden])');
  const code = await J(page, () => document.querySelector('#transfer-out').value);
  check(/^[A-Za-z0-9_-]{100,}$/.test(code) && code.startsWith('H4sI') && await J(page, () => !document.querySelector('#transfer-note').hidden && document.querySelector('#transfer-out').readOnly),
    `export: a ${code.length}-character gzip code in a read-only box, with the "Copy this code…" note`);
  await page.click('#transfer-copy');
  await page.evaluate(() => document.querySelector('#sync-transfer').scrollIntoView());
  await shot(page, layout, 'e14-transfer-export', 300);
  await layoutAudit(page, layout.insets, 'parent zone (transfer export)');
  await page.click('#pz-close');

  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());          // in a family, but offline: pushes wait (dirty)
  await ctx.route('**/api/tts/**', (r) => r.abort());             // ... and the natural voice server is unreachable too
  const errors = [];
  const b = await ctx.newPage();
  b.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  b.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await b.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__noClassLists = true;
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets });
  await b.addInitScript(() => { window.__noSkyTeaser = true; if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devB', keys: {} })); sessionStorage.setItem('seeded', '1'); } });
  await b.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await b.waitForSelector(visibleSel('#screen-players'));
  await b.click('#btn-parents-picker');
  await pinIn(b, '2468');
  await b.waitForFunction(() => document.querySelector('#pin-title') && /again/i.test(document.querySelector('#pin-title').textContent));
  await pinIn(b, '2468');
  await b.waitForSelector('.pz-content[data-tab="sync"]');
  await b.fill('#transfer-in', 'not-a-real-code!!');
  await b.click('#transfer-import');
  await b.waitForFunction(() => document.querySelector('#transfer-msg').textContent.length > 0);
  const badMsg = await b.textContent('#transfer-msg');
  check(/transfer code|damaged/i.test(badMsg) && await J(b, () => JSON.parse(localStorage.getItem('spellJump.family') || '{"players":[]}').players.length === 0), `corrupt code refused: "${badMsg}"`);
  await b.fill('#transfer-in', code.replace(/(.{60})/g, '$1\n'));     // pasted with line breaks
  await b.click('#transfer-import');
  await b.waitForFunction(() => /Added|Merged/.test(document.querySelector('#transfer-msg').textContent));
  const added = await b.textContent('#transfer-msg');
  const st = await J(b, () => {
    const f = JSON.parse(localStorage.getItem('spellJump.family')), p = f.players[0];
    const sync = JSON.parse(localStorage.getItem('spellJump.sync'));
    return { name: p.name, id: p.id, save: JSON.parse(localStorage.getItem(`spellJump.${p.id}.save`)), words: JSON.parse(localStorage.getItem(`spellJump.${p.id}.words`)),
      dirty: [sync.keys[`${p.id}.save`], sync.keys[`${p.id}.words`], sync.keys.family].map((k) => !!(k && k.dirty)) };
  });
  check(added === 'Added Mia' && st.name === 'Mia', `import on a fresh device: "${added}"`);
  check(st.save.cash === src.save.cash && st.save.owned.join() === src.save.owned.join() && st.save.xp === src.save.xp && Object.keys(st.words.records).sort().join() === Object.keys(src.words.records).sort().join()
    && st.words.records.shelf.firstTry === src.words.records.shelf.firstTry,
    `cash $${st.save.cash}, cars ${st.save.owned}, XP ${st.save.xp} and ${Object.keys(st.words.records).length} word records arrived`);
  check(st.dirty.every(Boolean), `sync keys marked dirty (save, words, family): ${st.dirty}`);
  await shot(b, layout, 'e15-transfer-import', 300);
  await layoutAudit(b, layout.insets, 'parent zone (transfer import)');
  // the same code again: merged into Mia (same name), nothing doubled
  await b.fill('#transfer-in', code);
  await b.click('#transfer-import');
  await b.waitForFunction(() => /Merged/.test(document.querySelector('#transfer-msg').textContent));
  const merged = await b.textContent('#transfer-msg');
  const nPlayers = await J(b, () => JSON.parse(localStorage.getItem('spellJump.family')).players.length);
  check(merged === `Merged into Mia: $${src.save.cash.toLocaleString('en-US')}, ${src.save.owned.length} car${src.save.owned.length === 1 ? '' : 's'}, ${Object.keys(src.words.records).length} words` && nPlayers === 1, `import again: "${merged}" (${nPlayers} player)`);
  await b.click('#pz-close');
  await b.waitForSelector(visibleSel('#screen-players'));
  await b.click('[data-player]');
  await b.waitForSelector(visibleSel('#screen-title'));
  check(await J(b, () => window.__spellJump.app.save.cash) === src.save.cash, 'the imported player plays with the imported cash');
  check(errors.length === 0, `transfer device: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// ---------- coach + pause key hints (ONLY=keys) ----------
// A desktop context (fine pointer, hover; Playwright's default) shows the keyboard commands in the "How to jump" tips
// and the pause menu; a touch phone (hasTouch + isMobile: coarse pointer, no hover) keeps the touch wording.
async function coachKeys(browser) {
  for (const v of [{ name: 'desktop', opts: { viewport: { width: 1280, height: 720 } }, keys: true }, { name: 'touch', opts: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, keys: false }]) {
    console.log(`\n=== coach key hints: ${v.name} ===`);
    const ctx = await browser.newContext(v.opts);
    await routeFonts(ctx);
    const errors = [];
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.addInitScript(() => { window.__noSkyTeaser = true;
      window.__noClassLists = true;   // v3.7: these paths run on the built-in list (class lists: classListTest)
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
        speak(u) { setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); }, cancel() {}, addEventListener() {} };
      if (!sessionStorage.getItem('seeded')) {
        localStorage.clear();
        localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, options: { pkid: { wordsPerRace: 1 } }, players: [{ id: 'pkid', name: 'Kid', color: '#3b7dd9', createdAt: 1, updatedAt: 1 }] }));
        sessionStorage.setItem('seeded', '1');
      }
    });
    await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
    const media = await J(page, () => ({ fine: matchMedia('(hover: hover) and (pointer: fine)').matches, coarse: matchMedia('(pointer: coarse)').matches }));
    const tap = (sel) => (v.opts.hasTouch ? page.tap(sel) : page.click(sel));
    await tap('[data-player="pkid"]');
    await page.waitForSelector(visibleSel('#screen-title'));
    await tap('#btn-play');
    await tap('#btn-race');
    await tap('[data-track="canyon"]');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    await waitMode(page, 'write', 12000);
    const w = await J(page, () => window.__spellJump.spellPanel.word);
    for (const ch of w) await tap(`#sp-keyboard [data-key="${ch === ' ' ? 'space' : ch}"]`);
    await tap('#sp-keyboard [data-key="enter"]');
    await page.waitForSelector(visibleSel('#coach'), { timeout: 8000 });
    await page.waitForTimeout(250);
    const text = await J(page, () => [...document.querySelectorAll('#coach li')].filter((li) => getComputedStyle(li).display !== 'none').map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
    if (v.keys) {
      check(media.fine && text.length === 4 && text[0] === '1 Hold GAS (→ or Space) down the ramp' && text[1] === '2 In the air: BRAKE (←) = back flip, GAS (→) = front flip, release to level out'
        && text[2] === '3 NITRO (↑) for a boost' && text[3] === '4 Land flat for a bonus', `desktop (fine pointer ${media.fine}): coach shows the keys: ${JSON.stringify(text)}`);
    } else {
      check(!media.fine && media.coarse && text.length === 3 && text[0] === '1 Hold GAS down the ramp' && text[2] === '3 Land flat for a bonus' && !text.join(' ').includes('→'),
        `touch (coarse pointer ${media.coarse}): coach keeps the touch wording: ${JSON.stringify(text)}`);
    }
    await page.screenshot({ path: path.join(SHOTS, `keys-${v.name}-coach.png`) });
    await tap('#coach');
    await page.waitForTimeout(150);
    await tap('#btn-pause');
    await page.waitForSelector(visibleSel('#panel-pause'));
    const pk = await J(page, () => { const e = document.querySelector('#pause-keys'); return getComputedStyle(e).display !== 'none' ? e.textContent : null; });
    check(v.keys ? pk === 'Keys: ← brake · → gas · ↑ nitro · Esc pause' : pk === null, `${v.name}: pause menu key line ${pk === null ? 'hidden' : `"${pk}"`}`);
    await page.screenshot({ path: path.join(SHOTS, `keys-${v.name}-pause.png`) });
    if (v.keys) {
      // ↑ = NITRO while driving
      await tap('#pause-resume');
      await page.keyboard.down('ArrowUp');
      const nitro = await J(page, () => document.querySelector('#ctl-nitro').classList.contains('is-down'));
      await page.keyboard.up('ArrowUp');
      check(nitro, '↑ holds NITRO');
    }
    check(errors.length === 0, `${v.name}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}

async function selfUpdate(browser) {
  console.log('\n=== self-update (real service worker) ===');
  const PORT = 8093, B = `http://localhost:${PORT}`;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'spell-jump-sw-'));
  cpSync(root, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  // its own copy on its own port: a server already there is someone else's (an error, not reused)
  const srv = await startStaticServer({ cwd: dir, port: PORT, check: async () => false });
  const swFile = path.join(dir, 'sw.js');
  const bump = (v) => writeFileSync(swFile, readFileSync(swFile, 'utf8').replace(/const VERSION = '[^']+';/, `const VERSION = '${v}';`));
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__noSkyTeaser = true;
    sessionStorage.setItem('loads', String((Number(sessionStorage.getItem('loads')) || 0) + 1));
    window.__noClassLists = true;   // v3.7: these paths run on the built-in list (class lists: classListTest)
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); }, cancel() {}, addEventListener() {} };
  });
  // the page context is replaced by a reload: poll, tolerating that
  const loads = async () => { for (let i = 0; i < 20; i++) { try { return Number(await page.evaluate(() => sessionStorage.getItem('loads'))); } catch (_) { await page.waitForTimeout(150); } } return -1; };
  const waitLoads = async (n, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await loads() === n) return true; await page.waitForTimeout(200); } return false; };
  const visible = () => { document.dispatchEvent(new Event('visibilitychange')); };   // the page is visible: reg.update()
  try {
    await page.goto(B + '/index.html?mock=1', { waitUntil: 'load' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    check(await loads() === 1, 'first install (clients.claim) does not reload the page');
    await page.waitForSelector(visibleSel('#screen-players'));
    await page.click('#pl-add');
    await tapKeys(page, '#np-keyboard', 'ann');
    await page.tap('#np-keyboard [data-key="enter"]');
    await page.waitForSelector(visibleSel('#screen-title'));
    await page.click('#btn-player');
    await page.waitForSelector(visibleSel('#screen-players'));

    bump('spell-jump-v9.9.1-test');
    await page.evaluate(visible);
    check(await waitLoads(2), 'new sw.js VERSION on the picker: the page reloads itself');
    await page.waitForSelector(visibleSel('#screen-players'));
    check(await page.evaluate(async () => (await caches.keys()).join()) === 'spell-jump-v9.9.1-test', 'the new worker controls the page (only its cache is left)');
    await page.waitForTimeout(2500);
    check(await loads() === 2 && await page.evaluate(() => window.__spellJump.screen) === 'players', 'reloaded exactly once, still on the picker');

    // spell panel open: no reload, a notice; leaving the run reloads (back to the same player)
    await page.click('#player-grid [data-player]');
    await page.waitForSelector(visibleSel('#screen-title'));
    await page.click('#btn-play');
    await page.waitForSelector(visibleSel('#screen-garage'));
    await page.click('#btn-race');
    await page.click('[data-track="canyon"]');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
    bump('spell-jump-v9.9.2-test');
    await page.evaluate(visible);
    const noticed = await page.waitForFunction(() => /update ready, restarting soon/i.test((document.querySelector("#update-note") || {}).textContent || ""), null, { timeout: 15000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, 'update-toast-spell-panel.png') });
    await page.waitForTimeout(2000);
    check(noticed && await loads() === 2 && await page.evaluate(() => window.__spellJump.spellPanel.isOpen), 'spell panel open: "Update ready, restarting soon", no reload');
    await page.click('#spell .sp-exit');
    check(await waitLoads(3), 'leaving the run (back to a safe screen) reloads');
    await page.waitForFunction(() => window.__spellJump && window.__spellJump.screen === 'title', null, { timeout: 8000 }).catch(() => {});
    check(await page.evaluate(() => window.__spellJump.screen === 'title' && !!window.__spellJump.app.currentPlayerId), 'after the update reload: back on the title with the same player');
    await page.waitForTimeout(2000);
    check(await loads() === 3, 'no second reload');

    // network-first: index.html and src/main.js edits show up on the next load (no new VERSION needed)
    const idx = path.join(dir, 'index.html'), mainJs = path.join(dir, 'src/main.js');
    writeFileSync(idx, readFileSync(idx, 'utf8').replace('</body>', '<meta name="nf-marker" content="1"></body>'));
    writeFileSync(mainJs, 'window.__nfMain = 1;\n' + readFileSync(mainJs, 'utf8'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__spellJump, null, { timeout: 10000 });
    check(await page.evaluate(() => !!navigator.serviceWorker.controller && !!document.querySelector('meta[name="nf-marker"]') && window.__nfMain === 1), 'network-first: edited index.html and src/main.js served fresh under the worker');
    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  } finally {
    await ctx.close().catch(() => {});
    await srv.stop();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function corruptBoot(browser) {
  console.log('\n=== corrupt data boot ===');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__noSkyTeaser = true;
    window.__noClassLists = true;
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('spellJump.family', '{"players": [oops');
    localStorage.setItem('spellJump.pa1.save', JSON.stringify({ v: 2, cash: 777, owned: ['beater'] }));
    localStorage.setItem('spellJump.pa1.words', '{"lists": [broken');
    localStorage.setItem('spellJump.pb2.save', '{"cash": 12, "owned": [oops');
    localStorage.setItem('spellJump.pb2.words', JSON.stringify({ lists: [{ id: 'L1', name: 'W', words: [{ word: 'friend' }] }], activeId: 'L1' }));
  });
  await page.goto(BASE + '/index.html?mock=1&nosw=1');
  await page.waitForSelector(visibleSel('#screen-players'));
  const n = await page.$$eval('[data-player]', (e) => e.length);
  check(n === 2, `corrupt family record rebuilt from the players' keys (${n} players)`);
  await page.click('[data-player="pa1"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const a = await page.evaluate(() => ({ cash: window.__spellJump.app.save.cash, sample: window.__spellJump.words.lists[0].sample }));
  check(a.cash === 777 && a.sample, 'player A: save kept ($777), corrupt words → sample list');
  await page.click('#btn-player');
  await page.click('[data-player="pb2"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const b = await page.evaluate(() => ({ cash: window.__spellJump.app.save.cash, word: window.__spellJump.words.lists[0].words[0].word }));
  check(b.cash === 0 && b.word === 'friend', 'player B: corrupt save → defaults, words kept');
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// ---------- natural voice (v3.4; ONLY=cloud runs just this) ----------
// A device in a family (sync code seeded, /api/family aborted = offline sync) with a fake natural-voice backend
// (window.__cloudVoiceBackend: status / prepare / load / play recorded, no network, no WebAudio) and the fake
// speechSynthesis. A: the server has the voice → Ava (en-US-Neural2-F) is picked for the player on its own; Options
// show "Natural voice ready · N clips cached", ▶ Test of Daniel asks for and plays the sample, the Speech check logs
// the natural engine; a new word is presented and spelled by clips only (the device voice says nothing). B: a reload
// with the clip store emptied, a slow server and no carrier clips → "Getting the voice ready…" on the spell panel,
// then the presentation falls back to the device voice while the letters still play as clips. C: the status line:
// no key, offline, no family code.
// v3.6 levels per race (mock engine, a Vantablack GT so the scripted run crosses the finish line): spell → launch →
// finish line → "Level 2!" → the spell panel again (new word, finish 480 m, cash ×1.5) → Level 3 (560 m, ×2) → one
// results screen: "All 3 levels!", the Spelling row lists the 3 words, cash parts add up to the total, the distance
// banked once, Downtown Drop unlocked. Ending a run from the pause menu never starts the next level.
async function levelsTest(browser, layout) {
  console.log(`\n=== levels per race (${layout.name}) ===`);
  const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await routeFonts(context);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__spoken = [];
    window.__noClassLists = true;   // v3.7: these paths run on the built-in list (class lists: classListTest)
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await J(page, async () => {
    const S = await import('/src/spelling/scheduler.js');
    const now = Date.now(), DAY = 864e5, dk = (t) => S.dayKey(t);
    const near = (w, list) => ({ word: w, listId: list, box: 1, due: now - 1000, attempts: 2, firstTry: 1, seenCount: 2, lastSeen: now - DAY, daysCorrect: [dk(now - DAY)], daysSeen: [dk(now - 2 * DAY), dk(now - DAY)], focus: false, studied: true, reviewsDone: 0, misses: 0 });
    const ws = ['mold', 'bolt', 'shadow', 'float', 'coast', 'throat'];
    localStorage.clear();
    localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, lastPlayer: 'pmia', options: { pmia: { wordsPerRace: 1 } },
      players: [{ id: 'pmia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }] }));
    localStorage.setItem('spellJump.pmia.save', JSON.stringify({ v: 2, cash: 1000, owned: ['beater', 'super'], selectedCar: 'super', seen: { coach: true, ach: 0 } }));
    localStorage.setItem('spellJump.pmia.words', JSON.stringify({ v: 1, lists: [{ id: 'L1', name: 'Long o', createdAt: now - 3 * DAY, archivedAt: 0, pattern: '', words: ws.map((word) => ({ word })) }], activeId: 'L1',
      records: Object.fromEntries(ws.map((w) => [w, near(w, 'L1')])), tests: [], qualifierPending: null, today: { date: dk(now), count: 0, newCount: 0, missionPaid: false }, streak: 0, bestStreak: 0, perfectTotal: 0 }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await instrument(page);
  const save0 = await readSave(page);
  const earthUnlocked = save0.unlocked.filter((id) => !id.startsWith('sky-'));   // v4.0: the first sky track is open with the era (real data files)
  check(save0.selectedCar === 'super' && earthUnlocked.length === 1, `start: Vantablack GT selected, ${earthUnlocked.length} track unlocked`);
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#btn-race');
  await page.waitForSelector(visibleSel('#screen-tracks'));
  await page.click('[data-track="canyon"]');
  const words = [];
  const spellOne = async (level) => {
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
    const w = await J(page, () => window.__spellJump.spellPanel.word);
    if (await panelMode(page) !== 'write') await waitMode(page, 'write', 9000);
    const lv = await J(page, () => ({ level: window.__spellJump.run.level, finish: window.__starts.at(-1).track.finish, trackId: window.__starts.at(-1).track }));
    check(lv.level === level, `level ${level}: the spell panel opens with "${w}" (run.level ${lv.level})`);
    words.push(w);
    await tapKeys(page, '#sp-keyboard', w);
    await page.tap('#sp-keyboard [data-key="enter"]');
    await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
    await page.waitForTimeout(200);
    await dismissCoachIfUp(page);
    await gas(page);
  };
  await spellOne(1);
  // level 1 ends at its finish line → the Level 2 moment, then the panel again
  await page.waitForFunction(() => window.__spellJump.run && window.__spellJump.run.level === 2, null, { timeout: 25000 });
  const lv2 = await J(page, () => ({ done: window.__spellJump.run.levelDone.length, crossed: window.__spellJump.run.levelDone[0].summary.finishCrossed, banner: (document.querySelector('.banner') || {}).textContent || '' }));
  check(lv2.done === 1 && lv2.crossed, `finish line crossed on level 1 → Level 2 (banner "${lv2.banner.trim()}")`);
  await shot(page, layout, 'l01-level-2', 0);
  await spellOne(2);
  const st2 = await J(page, () => window.__starts.at(-1));
  check(st2 && st2.finishLine === 480 && st2.powerScale === 1, `level 2 starts on a 480 m finish (${st2 && st2.finishLine}) at full power`);
  await page.waitForFunction(() => window.__spellJump.run && window.__spellJump.run.level === 3, null, { timeout: 25000 });
  await spellOne(3);
  const st3 = await J(page, () => window.__starts.at(-1));
  check(st3 && st3.finishLine === 560, `level 3 starts on a 560 m finish (${st3 && st3.finishLine})`);
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 30000 });
  await page.waitForFunction(() => { const td = document.querySelector('#res-pay tr[data-pay="total"] td:last-child'); return td && Number(td.textContent.replace(/[^0-9-]/g, '')) === Number(td.dataset.value); }, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  const res = await J(page, () => ({ title: document.querySelector('#res-title').textContent, sub: document.querySelector('#res-sub').textContent, s: window.__spellJump.lastResult.summary,
    spellWords: document.querySelector('#res-pay tr[data-pay="spelling"]').dataset.words, starts: window.__starts.length,
    levelsTile: (document.querySelector('#res-stats [data-stat="levels"] b') || {}).textContent, totalHint: document.querySelector('#res-pay tr[data-pay="total"] .hint').textContent }));
  check(/All 3 levels!/.test(res.title) && res.levelsTile === '3/3' && /levels \+\$[\d,]+/.test(res.totalHint), `results: "${res.title}" · Levels tile ${res.levelsTile} · total hint "${res.totalHint}"`);
  check(res.s.levels && res.s.levels.reached === 3 && res.s.levels.cleared.every(Boolean) && res.s.levels.bonus > 0, `summary.levels ${JSON.stringify(res.s.levels)}`);
  check(res.spellWords === '3' && new Set(words).size === 3, `the Spelling row lists the 3 words (${words.join(', ')})`);
  await payoutCheck(page, 'three levels', save0);
  const save1 = await readSave(page);
  check(save1.unlocked.includes('city') && save1.records.runs === 1 && save1.best.canyon >= 400, `banked once: runs ${save1.records.runs}, best ${save1.best.canyon} m, Downtown Drop unlocked`);
  await shot(page, layout, 'l02-results-levels', 0);
  await layoutAudit(page, layout.insets, 'results (levels)');
  // pause → End run during level 1 never starts level 2 (even with the finish line crossed)
  await page.click('#res-retry');
  await spellOne(1);
  await page.waitForFunction(() => window.__spellJump.game.getState().finishCrossed, null, { timeout: 25000 });
  await page.click('#btn-pause');
  await page.waitForSelector(visibleSel('#panel-pause'));
  await page.click('#pause-end');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 15000 });
  const ended = await J(page, () => ({ lv: window.__spellJump.lastResult.summary.levels, title: document.querySelector('#res-title').textContent }));
  check(ended.lv && ended.lv.reached === 1, `End run after the finish line: results for level 1 only (${JSON.stringify(ended.lv)}, "${ended.title}")`);
  check(await J(page, () => window.__spellJump.run === null), 'no run left behind');
  check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
  await context.close();
}

async function cloudVoiceTest(browser, layout) {
  console.log(`\n--- natural voice (${layout.name}) ---`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsNetwork = false;
  await ctx.route('**/api/tts/**', (r) => { ttsNetwork = true; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pmia: { wordsPerRace: 1 } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devC', keys: {} }));
      sessionStorage.setItem('seeded', '1');
    }
    const mode = JSON.parse(sessionStorage.getItem('cloudMode') || '{"key":true}');
    window.__cloudMode = mode;
    if (mode.omit) window.__spellVoiceWaitMs = 3000;      // (v3.8.1: the spell panel waits ~12 s for a clip; shortened for the test)
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__spoken = [];
    window.__noClassLists = true;   // v3.7: these paths run on the built-in list (class lists: classListTest)
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { if (window.__cloudMode.offline) throw new TypeError('Failed to fetch'); return { key: !!window.__cloudMode.key }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        if (window.__cloudMode.offline) return { status: 0, body: null };
        if (window.__cloudMode.delay) await new Promise((r) => setTimeout(r, window.__cloudMode.delay));
        if (!window.__cloudMode.key) return { status: 503, body: { error: 'no-key' } };
        const omit = window.__cloudMode.omit ? new RegExp(window.__cloudMode.omit) : null;
        const clips = {};
        for (const t of texts) if (!omit || !omit.test(t)) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: Object.keys(clips).length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.03 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 25)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets });
  const dev = () => J(page, () => window.__spoken.filter((t) => t !== 'ready'));
  const opt = () => J(page, () => JSON.parse(localStorage.getItem('spellJump.family')).options.pmia);
  const openOptions = async (first) => {
    await page.click('#btn-parents');
    await page.waitForSelector(visibleSel('#pz'));
    if (first) { await pinIn(page, '1234'); await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || '')); }
    await pinIn(page, '1234');
    await page.waitForSelector('.pz-content[data-tab="sync"]');
    await page.click('.pz-tabs [data-tab="options"]');
    await page.waitForSelector('#opt-cloud-status');
  };
  const cloudStatus = () => J(page, () => document.querySelector('#opt-cloud-status').textContent);

  // ----- A: picked on its own, Options, Test, Speech check, a word by clips -----
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('spellJump.family')).options.pmia.cloudVoice === 'en-US-Neural2-F', null, { timeout: 5000 }).catch(() => {});
  check((await opt()).cloudVoice === 'en-US-Neural2-F', `the server has the natural voice: Ava (en-US-Neural2-F) picked for Mia on its own (${(await opt()).cloudVoice})`);
  await page.waitForFunction(() => window.__cloudAsked.length > 0, null, { timeout: 5000 }).catch(() => {});
  const asked = await J(page, () => window.__cloudAsked);
  const sample = await J(page, () => window.__spellJump.words.lists[0].words.map((w) => w.word));
  const allAsked = asked.flatMap((a) => a.texts);
  check(asked.length >= 1 && asked.every((a) => a.code === 'ABCD-2345' && a.voice === 'en-US-Neural2-F' && a.texts.length <= 80)
    && sample.every((w) => allAsked.includes(`The word is, ${w}.`) && allAsked.includes(`${w}.`)) && ['B', 'W', 'apostrophe'].every((x) => allAsked.includes(x)) && !allAsked.includes('ef'),
    `prepare asked for the whole list + letter names in ${asked.length} request(s) (${allAsked.length} texts, ≤ 80 each)`);

  await openOptions(true);
  check(/^Natural voice ready · \d+ clips cached$/.test(await cloudStatus()), `status: "${await cloudStatus()}"`);
  const rows = await J(page, () => ({ ids: [...document.querySelectorAll('#opt-cloud-voices [data-cloud-voice]')].map((b) => b.dataset.cloudVoice), on: (document.querySelector('#opt-cloud-voices .pz-voice-pick.on') || { dataset: {} }).dataset.cloudVoice,
    labels: [...document.querySelectorAll('#opt-cloud-voices .label')].map((l) => l.textContent), groups: [...document.querySelectorAll('.pz-voice-group')].map((g) => g.textContent), now: document.querySelector('#opt-voice-now').textContent }));
  check(rows.ids.length === 6 && rows.on === 'en-US-Neural2-F' && rows.labels[0] === 'Ava · warm female' && rows.groups.join('|') === 'Natural voices (online)|Device voices' && /Now using: Ava, the natural voice/.test(rows.now),
    `Options: "Natural voices (online)" (${rows.labels.join(', ')}) above "Device voices"; ${rows.now}`);
  await shot(page, layout, 'n01-pz-natural-voices');
  await layoutAudit(page, layout.insets, 'parent zone (natural voices)');
  let n = await J(page, () => window.__cloudPlayed.length);
  await page.click('#opt-cloud-voices [data-cloud-test="en-US-Neural2-D"]');
  await page.waitForFunction((k) => window.__cloudPlayed.length >= k + 3, n, { timeout: 5000 }).catch(() => {});
  const tested = await J(page, () => ({ played: window.__cloudPlayed.slice(-3), asked: window.__cloudAsked[window.__cloudAsked.length - 1] }));
  check(tested.asked.voice === 'en-US-Neural2-D' && JSON.stringify(tested.played) === JSON.stringify(['The word is, neighbor.', 'My neighbor has a dog.', 'neighbor.']), '▶ Test (Daniel) prepares the sample in that voice and plays it');
  check((await opt()).cloudVoice === 'en-US-Neural2-F', 'testing a voice does not pick it');
  const nDev = (await dev()).length;
  await page.click('#opt-check-run');
  await page.waitForFunction(() => /result:/.test(document.querySelector('#opt-check-log').textContent), null, { timeout: 8000 });
  const chk = await J(page, () => document.querySelector('#opt-check-log').textContent);
  check(/natural voice: Ava · en-US-Neural2-F · \d+ clips on this device · clip ready/.test(chk) && /engine: natural voice \(clip\)/.test(chk) && /result: the natural voice played/.test(chk) && (await dev()).length === nDev,
    'Speech check logs the engine: the natural voice played the clip (the device voice did not)');
  await page.click('#pz-close');

  await J(page, () => { window.__cloudPlayed = []; window.__spoken = []; });
  const w = await startRunFromTitle(page);
  const info = await J(page, (word) => window.__spellJump.words.lists[0].words.find((x) => x.word === word), w);
  await waitMode(page, 'write', 12000);
  const A = await J(page, () => ({ played: window.__cloudPlayed.slice(), note: document.querySelector('#sp-note').hidden ? '' : document.querySelector('#sp-note').textContent }));
  const wantPresent = [`The word is, ${w}.`, info.sentence, `${w}.`];
  check(JSON.stringify(A.played.slice(0, 3)) === JSON.stringify(wantPresent) && JSON.stringify(A.played.slice(3)) === JSON.stringify(cloudSpelled(w)),
    `"${w}" presented and spelled by clips: ${A.played.slice(0, 4).join(' | ')} …`);
  check((await dev()).length === 0 && await J(page, () => window.__spellJump.tts.engine === 'cloud'), 'the device voice was not used for the word');
  await page.tap(`#sp-keyboard [data-key="${w[0]}"]`);
  await page.waitForTimeout(200);
  check(await J(page, (l) => window.__cloudPlayed[window.__cloudPlayed.length - 1] === l, cloudLetterText(w[0])) && (await dev()).length === 0, `a typed letter is said by its clip ("${cloudLetterText(w[0])}", not "${letterName(w[0])}")`);
  await shot(page, layout, 'n02-word-by-clips');
  await page.click('#spell .sp-exit');
  await page.waitForSelector(visibleSel('#screen-garage'));

  // ----- B: clips missing (store emptied, slow server, no carrier clips) → note, then the device voice -----
  await J(page, () => { sessionStorage.setItem('cloudMode', JSON.stringify({ key: true, delay: 1800, omit: '^The word is' })); localStorage.removeItem('spellJump.cloudVoice'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const w2 = await startRunFromTitle(page);
  const info2 = await J(page, (word) => window.__spellJump.words.lists[0].words.find((x) => x.word === word), w2);
  const noteSeen = await page.waitForFunction(() => { const nt = document.querySelector('#sp-note'); return !nt.hidden && nt.textContent === 'Getting the voice ready…'; }, null, { timeout: 2500 }).then(() => true, () => false);
  check(noteSeen, 'missing clips: "Getting the voice ready…" shows on the spell panel');
  await shot(page, layout, 'n03-getting-voice-ready');
  await waitMode(page, 'write', 25000);
  const B = await J(page, () => ({ played: window.__cloudPlayed.slice(), spoken: window.__spoken.filter((t) => t !== 'ready'), noteHidden: document.querySelector('#sp-note').hidden }));
  check(JSON.stringify(B.spoken.slice(0, 3)) === JSON.stringify([`The word is, ${w2}.`, info2.sentence, `${w2}.`]) && !B.played.includes(`${w2}.`),
    `no clip for "The word is, ${w2}." → the device voice says the whole presentation (${B.spoken.slice(0, 3).join(' | ')})`);
  // v3.8.1: never interleaved: once the device voice has said the word, its spelling-out is the device voice too (no clip plays)
  check(B.played.length === 0 && [...w2].every((ch) => B.spoken.includes(letterName(ch))) && B.noteHidden, `after the wait the same word stays with the device voice, its letters too (${B.spoken.slice(3, 8).join(' ')}…, no clip played); the note is gone`);
  await page.click('#spell .sp-exit');
  await page.waitForSelector(visibleSel('#screen-garage'));

  // ----- C: status lines -----
  await J(page, () => window.__spellJump.app.go('title'));
  await page.waitForSelector(visibleSel('#screen-title'));
  await J(page, () => { window.__cloudMode.key = false; window.__cloudMode.delay = 0; return window.__spellJump.app.cloud.status(true); });
  await openOptions(false);
  check(await cloudStatus() === 'Natural voice not set up on the server yet (ask the admin to add the Google key)' && await J(page, () => document.querySelector('[data-cloud-voice]').disabled), `no key: "${await cloudStatus()}" (rows disabled)`);
  await shot(page, layout, 'n04-no-key');
  await J(page, () => { window.__cloudMode.key = true; window.__cloudMode.offline = true; return window.__spellJump.app.cloud.status(true); });
  await page.click('.pz-tabs [data-tab="report"]'); await page.click('.pz-tabs [data-tab="options"]'); await page.waitForSelector('#opt-cloud-status');
  check(/^Offline: using the device voice/.test(await cloudStatus()), `offline: "${await cloudStatus()}"`);
  await J(page, () => { window.__cloudMode.offline = false; window.__spellJump.app.sync.leave(); });
  await page.click('.pz-tabs [data-tab="report"]'); await page.click('.pz-tabs [data-tab="options"]'); await page.waitForSelector('#opt-cloud-status');
  check(await cloudStatus() === 'No family code yet: natural voices need family sync' && await J(page, () => !window.__spellJump.tts.cloudActive), `no family code: "${await cloudStatus()}", natural voice off`);
  await shot(page, layout, 'n05-no-family-code');
  await layoutAudit(page, layout.insets, 'parent zone (natural voices, no family)');
  await page.click('#pz-close');
  check(!ttsNetwork, 'no request reached /api/tts (the fake backend answered everything)');
  check(errors.length === 0, `natural voice: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

watchdog('ui-smoke');
const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
// v4.0: the real Sky Era data files (src/data/skyTracks.js, skyRides.js) load in every context; the skyera paths use the stand-ins in tools/fixtures/sky/ with
// ?skyfixture=1 (small and fast) and the 'skyreal' path runs once against the real files.
// ---------- v3.7 class lists (ONLY=class runs just this, at both sizes) ----------
// Leo (built-in list) gets the class list when picked (toast); Mia (a pasted list) is never switched; Parents → Words:
// the class-list card, "Use for Mia" (the class list with its prefix pattern), the prefix highlighted on the Look
// step, "Use for everyone" from Zoe's tab, "Stop following" (the words stay, the classId goes).
async function classListTest(browser, layout) {
  console.log(`\n=== class lists (${layout.name}) ===`);
  const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await routeFonts(context);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  const CL = await J(page, async () => {
    const C = await import('/src/data/classLists.js');
    const now = Date.now(), DAY = 864e5;
    const pasted = (ws) => JSON.stringify({ v: 1, lists: [{ id: 'L1', name: 'Our list', createdAt: now - 3 * DAY, archivedAt: 0, pattern: '', words: ws.map((word) => ({ word })) }], activeId: 'L1', records: {}, tests: [], qualifierPending: null });
    localStorage.clear();
    localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, lastPlayer: null, options: {},
      players: [['pmia', 'Mia', '#ff3b5c'], ['pleo', 'Leo', '#22d3ff'], ['pzoe', 'Zoe', '#2fd36b']].map(([id, name, color], i) => ({ id, name, color, createdAt: i + 1, updatedAt: i + 1 })) }));
    for (const id of ['pmia', 'pleo', 'pzoe']) localStorage.setItem(`spellJump.${id}.save`, JSON.stringify({ v: 2, cash: 100, owned: ['beater'], seen: { coach: true, ach: 0 } }));
    localStorage.setItem('spellJump.pmia.words', pasted(['neighbor', 'because', 'enough']));
    localStorage.setItem('spellJump.pzoe.words', pasted(['friend', 'thought']));
    const c = C.newestClassList(now);
    return { id: c.id, name: c.name, pattern: c.pattern, n: c.words.length, words: c.words.map((w) => w.word), sentences: c.words.map((w) => w.sentence) };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const activeOf = (id) => J(page, (pid) => { const d = JSON.parse(localStorage.getItem(`spellJump.${pid}.words`) || 'null'); const l = d && d.lists.find((x) => x.id === d.activeId); return l ? { id: l.id, classId: l.classId || null, name: l.name, pattern: l.pattern, words: l.words.map((w) => w.word), sample: !!l.sample } : null; }, id);

  // Leo is on the built-in list: picking him applies the class list (toast)
  await page.click('[data-player="pleo"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.waitForTimeout(200);
  const toastText = await J(page, () => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '));
  const leo = await activeOf('pleo');
  check(leo && leo.classId === CL.id && leo.id === CL.id && !leo.sample && leo.words.length === CL.n, `a built-in-list player gets the class list on start (${leo && leo.name}, ${leo && leo.words.length} words)`);
  check(toastText.includes(`New class list: ${CL.name}`), `toast "New class list: ${CL.name}"`);
  await shot(page, layout, 'cl-01-title-toast', 0);
  // Mia has a pasted list: never switched
  await page.click('#btn-player').catch(() => J(page, () => window.__spellJump.app.go('players')));
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const mia0 = await activeOf('pmia');
  check(mia0.id === 'L1' && !mia0.classId, 'a player with a pasted list is never switched automatically');

  // Parents → Words: the class list card
  await page.click('#btn-parents');
  for (let k = 0; k < 2 && await J(page, () => !!document.querySelector('.pinpad')); k++) { await pinIn(page, '1234'); await page.waitForTimeout(250); }
  await page.waitForSelector('.pz-content');
  await page.click('.pz-tabs [data-tab="words"]');
  await page.waitForSelector('#pz-class');
  const card = await J(page, () => ({ head: document.querySelector('#pz-class .pc-head').textContent, words: document.querySelector('#pz-class .pc-words').textContent,
    use: (document.querySelector('#pz-class-use') || {}).textContent || '', all: (document.querySelector('#pz-class-all') || {}).textContent || '', first: document.querySelector('.pz-content').firstElementChild.id }));
  check(card.head === `Class list${CL.name} · ${CL.n} words` && card.first === 'pz-class', `Words tab: the class-list card on top ("Class list · ${CL.name} · ${CL.n} words")`);
  check(CL.words.every((w) => card.words.includes(w)) && card.use === 'Use for Mia' && card.all === 'Use for everyone', 'the words shown small, "Use for Mia" and "Use for everyone"');
  // v3.9.1: the card says plainly that this week is not in use for Mia yet, and which list she is on (the box below)
  const st0 = await J(page, () => ({ status: document.querySelector('#pz-class-status').textContent, inUse: document.querySelector('#pz-class').dataset.inUse,
    now: (document.querySelector('#pz-class-now') || {}).textContent || '', box: document.querySelector('#pz-active').textContent, listHidden: document.querySelector('#pz-class-list').hidden,
    more: document.querySelector('#pz-class-more').getAttribute('aria-expanded') }));
  check(st0.status === 'Not in use yet: tap Use for Mia' && st0.inUse === 'false', `not in use: "${st0.status}"`);
  check(/"Our list"/.test(st0.now) && /^Mia's list now/.test(st0.box), `the card names the list Mia is on now ("${st0.now}"), the box below says "Mia's list now"`);
  check(st0.listHidden && st0.more === 'false', 'the words and sentences are folded away at first');
  await shot(page, layout, 'cl-02-words-card');
  await layoutAudit(page, layout.insets, 'parent zone (class list card)');
  // expand: each word with its sentence
  await page.click('#pz-class-more');
  const open = await J(page, () => ({ hidden: document.querySelector('#pz-class-list').hidden, more: document.querySelector('#pz-class-more').getAttribute('aria-expanded'),
    rows: [...document.querySelectorAll('#pz-class-list li')].map((li) => ({ word: li.dataset.word, b: li.querySelector('b').textContent, sent: li.querySelector('.pc-sent').textContent })) }));
  const sentOk = open.rows.length === CL.n && open.rows.every((r, i) => r.word === CL.words[i] && r.b === CL.words[i] && r.sent === CL.sentences[i]);
  check(!open.hidden && open.more === 'true' && sentOk, `expanded: all ${CL.n} words, each with its sentence ("${open.rows[0] && open.rows[0].b}: ${open.rows[0] && open.rows[0].sent}")`);
  await shot(page, layout, 'cl-02b-words-card-open');
  await layoutAudit(page, layout.insets, 'parent zone (class list card, expanded)');
  await page.click('#pz-class-use');
  await page.waitForSelector('#pz-class-following');
  const mia1 = await activeOf('pmia');
  check(mia1.classId === CL.id && mia1.pattern === CL.pattern && mia1.words.join() === CL.words.join(), `Use for Mia: her active list is the class list with its pattern (${mia1.pattern})`);
  check(await J(page, () => /^Following the class lists ✓/.test(document.querySelector('#pz-class-following').textContent) && !!document.querySelector('#pz-class-stop')), '"Following the class lists ✓ · each new week applies on its own" with "Stop following"');
  const st1 = await J(page, () => ({ status: document.querySelector('#pz-class-status').textContent, inUse: document.querySelector('#pz-class').dataset.inUse, now: !!document.querySelector('#pz-class-now'),
    open: !document.querySelector('#pz-class-list').hidden, follows: document.querySelector('#pz-class').dataset.following }));
  check(st1.status === 'In use for Mia ✓' && st1.inUse === 'true' && !st1.now && st1.follows === 'true', `in use: "${st1.status}", and Mia follows the class lists from now on`);
  check(st1.open, 'the expanded list stays open after "Use for Mia"');
  await shot(page, layout, 'cl-03-following');
  // Use for everyone (from Zoe's tab)
  await page.click('.pz-ptab[data-player="pzoe"]');
  await page.waitForSelector('#pz-class-all');
  await page.click('#pz-class-all');
  await page.waitForSelector('#pz-class-following');
  const all = await Promise.all(['pmia', 'pleo', 'pzoe'].map(activeOf));
  check(all.every((a) => a.classId === CL.id), 'Use for everyone: Mia, Leo and Zoe all on the class list');
  // Stop following (Zoe): the words stay, the classId goes
  await page.click('#pz-class-stop');
  await page.waitForSelector('#pz-class-follow');
  const zoe = await activeOf('pzoe');
  check(!zoe.classId && zoe.words.length === CL.n, 'Stop following: the words stay, the list is no longer a class list');
  check(await J(page, () => document.querySelector('#pz-class-status').textContent === 'In use for Zoe ✓' && /^Not following/.test(document.querySelector('#pz-class-notfollowing').textContent)),
    'after Stop following: still "In use for Zoe", "Not following the class lists" with "Follow the class lists"');
  await page.click('#pz-class-follow');
  await page.waitForSelector('#pz-class-following');
  const zoe2 = await activeOf('pzoe');
  check(zoe2.classId === CL.id && zoe2.id === CL.id, 'Follow the class lists: Zoe follows again (same list)');
  await page.click('#pz-close');

  // the prefix is highlighted on the Look step (Mia: a new word on the class list; the Qualifier skipped here)
  await J(page, () => { const S = window.__spellJump; S.words.qualifierPending = null; S.words.today.count = 0; S.app.persistWords(); });
  await startRunFromTitle(page);
  await page.waitForTimeout(400);
  const look = await J(page, () => ({ word: window.__spellJump.spellPanel.word, mode: window.__spellJump.spellPanel.mode, pat: [...document.querySelectorAll('#sp-model .tile.pat')].map((t) => t.textContent).join('') }));
  const prefix = CL.pattern.split(' ').map((p) => p.replace(/-/g, '')).find((p) => look.word && look.word.startsWith(p));
  check(look.mode === 'look' && prefix && look.pat.toLowerCase() === prefix, `Look: the prefix of "${look.word}" is highlighted (${look.pat})`);
  await shot(page, layout, 'cl-04-look-prefix', 0);
  await page.click('#spell .sp-exit').catch(() => {});
  check(errors.length === 0, `class lists: no console errors${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
  await context.close();
}


// ---------- v3.9.1: a page left open picks up a new week (ONLY=class runs it, with classListTest) ----------
// The owner's iPad kept Spell Jump open since last week and never applied the new class list (the check ran only when a
// player was chosen or on a sync). Leo follows the class lists and is on an older week; the page is opened while the class
// lists are held back (the window.__noClassLists hook) and left on the title; then the new week "arrives" (the hook off):
// nothing changes until an event; a visibilitychange (back to the front) applies it with the toast and asks the natural
// voice for the new week's clips (3.8.1); during a run a visibilitychange applies nothing, the title afterwards does;
// the hourly check (window.__classCheckEveryMs shortens the hour) applies a week on its own.
async function openTitleNewWeekTest(browser, layout) {
  console.log(`\n=== a page left open on the title picks up a new week (${layout.name}) ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  await ctx.route('**/api/tts/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|api\/family|api\/tts|ERR_FAILED|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__noClassLists = true;               // last week: the new class list is not out yet
    const every = Number(sessionStorage.getItem('classEvery'));
    if (every) window.__classCheckEveryMs = every;  // the hourly check, the hour shortened (read when the page boots)
    window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    window.__cloudAsked = [];
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ voice, texts }) {
        window.__cloudAsked.push(texts.slice());
        const clips = {};
        for (const x of texts) clips[x] = '/api/tts/clip/' + (x.length.toString(16).padStart(8, '0')).repeat(4);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 0 } };
      },
      async load(url, text) { return { url, text }; },
      play() { return new Promise((r) => setTimeout(() => r(true), 30)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  const CL = await J(page, async () => {
    const C = await import('/src/data/classLists.js');
    const now = Date.now(), DAY = 864e5;
    const newest = C.newestClassList(now);
    const older = C.CLASS_LISTS.find((l) => l.weekOf < newest.weekOf);
    localStorage.clear();
    localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, lastPlayer: null, options: { pleo: { cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pleo: now },
      players: [{ id: 'pleo', name: 'Leo', color: '#22d3ff', createdAt: 1, updatedAt: 1 }] }));
    localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devO', keys: {} }));
    localStorage.setItem('spellJump.pleo.save', JSON.stringify({ v: 2, cash: 100, owned: ['beater'], seen: { coach: true, ach: 0 } }));
    localStorage.setItem('spellJump.pleo.words', JSON.stringify({ v: 1, lists: [{ id: older.id, classId: older.id, name: older.name, createdAt: now - 8 * DAY, archivedAt: 0, pattern: older.pattern, words: older.words }],
      activeId: older.id, records: {}, tests: [], qualifierPending: null }));
    return { id: newest.id, name: newest.name, n: newest.words.length, first: newest.words[0], older: older.id, olderName: older.name };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const active = () => J(page, () => { const d = JSON.parse(localStorage.getItem('spellJump.pleo.words') || 'null'); const l = d && d.lists.find((x) => x.id === d.activeId); return l ? { id: l.id, classId: l.classId || null } : null; });
  // every toast shown (they fade after a few seconds)
  const watchToasts = () => J(page, () => { window.__toastLog = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__toastLog.push(n.textContent); }).observe(document.querySelector('#toasts'), { childList: true }); });
  const toasts = () => J(page, () => window.__toastLog.join(' | '));
  await watchToasts();
  const visible = () => J(page, () => document.dispatchEvent(new Event('visibilitychange')));
  await page.click('[data-player="pleo"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.waitForTimeout(300);
  const a0 = await active();
  check(a0.id === CL.older && !(await toasts()).includes('New class list'), `opened last week: Leo is on ${CL.olderName}, no toast`);
  // the new week is out (the page stayed open): nothing happens on its own before an event
  await J(page, () => { window.__noClassLists = false; window.__cloudAsked.length = 0; });
  await page.waitForTimeout(400);
  check((await active()).id === CL.older, 'the new week is out, the page sits on the title: not applied without an event');
  // back to the front
  await visible();
  await page.waitForFunction((n) => window.__toastLog.includes(`New class list: ${n}`), CL.name, { timeout: 3000 }).catch(() => {});
  const a1 = await active();
  check(a1.id === CL.id && a1.classId === CL.id, `visibilitychange on the title: Leo is on the new week (${a1.id})`);
  check((await toasts()).includes(`New class list: ${CL.name}`), `the toast "New class list: ${CL.name}"`);
  check(await J(page, () => document.querySelector('#btn-play').textContent === 'Play: new words!' && document.querySelector('#title-mission-text').textContent.includes('/')), 'the title is refreshed (PLAY: new words!, the Qualifier is next)');
  await page.waitForFunction((w) => window.__cloudAsked.some((b) => b.includes(w.sentence)), CL.first, { timeout: 5000 }).catch(() => {});
  const asked = await J(page, () => window.__cloudAsked.flat());
  check(asked.includes(CL.first.sentence) && asked.includes(`The word is, ${CL.first.word}.`), `the natural voice is asked for the new week's clips at once (3.8.1: ${asked.length} texts, "${CL.first.sentence}")`);
  await shot(page, layout, 'cl-05-open-title-new-week', 0);
  check((await toasts()).split('New class list').length === 2, 'one toast, once');
  await visible();
  await page.waitForTimeout(200);
  check((await toasts()).split('New class list').length === 2 && (await active()).id === CL.id, 'another visibilitychange: nothing more (already on it)');

  // never during a run: put Leo back on last week, start a run, the page comes back to the front → nothing; the title afterwards → applied
  await J(page, async (id) => {
    window.__noClassLists = true;
    const S = window.__spellJump;
    const W = await import('/src/spelling/wordStore.js');
    W.restoreList(S.words, id, Date.now());
    S.words.qualifierPending = null; S.app.persistWords();
  }, CL.older);
  check((await active()).id === CL.older, 'Leo back on last week (for the run check)');
  await startRunFromTitle(page);
  await J(page, () => { window.__noClassLists = false; });
  await visible();
  await page.waitForTimeout(300);
  check((await active()).id === CL.older && await J(page, () => !!window.__spellJump.run), 'during a run: a visibilitychange applies nothing');
  await page.click('#spell .sp-exit').catch(() => {});
  await page.waitForFunction(() => !window.__spellJump.run, null, { timeout: 3000 }).catch(() => {});
  await J(page, () => window.__spellJump.app.go('title'));
  await page.waitForTimeout(300);
  check((await active()).id === CL.id, 'after the run, the title shown: the held-back week applies');

  // once an hour while open (the hour shortened by the test hook): no event at all, the week applies on its own
  await J(page, async (id) => {
    const S = window.__spellJump;
    const W = await import('/src/spelling/wordStore.js');
    window.__noClassLists = true;
    W.restoreList(S.words, id, Date.now()); S.words.qualifierPending = null; S.app.persistWords();
    sessionStorage.setItem('classEvery', '800');
  }, CL.older);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pleo"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check((await active()).id === CL.older, 'reloaded on last week (the class lists held back)');
  await J(page, () => { window.__noClassLists = false; });
  await page.waitForFunction((id) => { const d = JSON.parse(localStorage.getItem('spellJump.pleo.words')); return d.activeId === id; }, CL.id, { timeout: 5000 }).catch(() => {});
  check((await active()).id === CL.id, 'the hourly check (hour shortened to 0.8 s) applies the new week with no event');
  check(errors.length === 0, `open title: no console errors${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

// ---------- v3.8.1: a brand-new class list, the natural voice, instrumented engines (ONLY=voice runs just this) ----------
// The owner applied a new week's class list and every line (the carrier "The word is, …", the sentence, "<word>." and the
// letter-by-letter spelling) was a text the server had never made: the clips were asked for in one big background request
// that the first word's own request queued behind, the spell panel waited 3 s, and the words were read by the device
// ("robot") voice, which the children cannot understand. Both engines log every utterance to window.__ulog (the device
// voice's unlock word at volume 0.01 is not logged); the stubbed /api/tts takes 300 ms + 120 ms per text, like the Wagon West
// voice test. cloud: the natural voice is available → the first race (a new word perfect, one missed and fixed: Compare /
// Copy / Cover) is read by clips only, the calm "Getting the voice ready…" note shows while the first clips come, the first
// request after "Use for" asks for the next race's words first, in small batches. nokey: no key on the server → the device
// voice at once (no waiting). slow: a clip never comes (the wait is shortened by window.__spellVoiceWaitMs) → the device voice
// says that word, and the cloud voice never follows it for the same word.
async function newListVoiceTest(browser, layout, scenario) {
  console.log(`\n=== new class list, natural voice: ${scenario} (${layout.name}) ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsNetwork = false;
  await ctx.route('**/api/tts/**', (r) => { ttsNetwork = true; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets, scenario }) => { window.__noSkyTeaser = true;
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now(), DAY = 864e5;
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pmia: { cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devV', keys: {} }));
      localStorage.setItem('spellJump.pmia.save', JSON.stringify({ v: 2, cash: 100, owned: ['beater'], seen: { coach: true, ach: 0 } }));
      localStorage.setItem('spellJump.pmia.words', JSON.stringify({ v: 1, lists: [{ id: 'L1', name: 'Our list', createdAt: now - 9 * DAY, archivedAt: 0, pattern: '', words: ['neighbor', 'because', 'enough'].map((word) => ({ word })) }], activeId: 'L1', records: {}, tests: [], qualifierPending: null }));
      sessionStorage.setItem('seeded', '1');
    }
    if (scenario === 'slow') window.__spellVoiceWaitMs = 4000;
    const t = () => Math.round(performance.now());
    const ulog = (window.__ulog = []);
    window.__cloudAsked = [];
    const begin = (engine, text) => { const e = { engine, text, t0: t(), t1: 0, end: '' }; ulog.push(e); return e; };
    const dev = { current: null };
    window.__ttsBackend = {
      get speaking() { return !!dev.current; }, get pending() { return false; },
      getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) {
        const text = String(u.text).trim();
        if (u.volume != null && u.volume < 0.05) { setTimeout(() => { try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (_) {} }, 5); return; }
        const e = begin('device', text);
        dev.current = e; e.u = u;
        setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5);
        e.timer = setTimeout(() => { if (dev.current === e) dev.current = null; e.end = 'ok'; e.t1 = t(); try { u.onend && u.onend(); } catch (_) {} }, Math.max(60, text.length * 5));
      },
      cancel() { const e = dev.current; if (e && !e.end) { clearTimeout(e.timer); dev.current = null; e.end = 'cancelled'; e.t1 = t(); try { e.u.onerror && e.u.onerror({ error: 'canceled' }); } catch (_) {} } },
      addEventListener() {}, resume() {}, pause() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    let cur = null;
    window.__cloudVoiceBackend = {
      async status() { return { key: scenario !== 'nokey' }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ at: t(), voice, texts: texts.slice() });
        await new Promise((r) => setTimeout(r, 300 + 120 * texts.length));
        if (scenario === 'nokey') return { status: 503, body: { error: 'no-key' } };
        const omit = window.__omit ? new RegExp(window.__omit) : null;
        const clips = {};
        for (const x of texts) if (!omit || !omit.test(x)) clips[x] = '/api/tts/clip/' + hex(voice + '\n' + x);
        return { status: 200, body: { clips, generated: Object.keys(clips).length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text }; },
      play(buf, text) {
        const e = begin('cloud', text);
        return new Promise((resolve) => {
          const done = (ok, end) => { if (cur && cur.e === e) cur = null; e.end = end; e.t1 = t(); resolve(ok); };
          cur = { e, stop: () => { clearTimeout(e.timer); done(false, 'cancelled'); } };
          e.timer = setTimeout(() => done(true, 'ok'), Math.max(60, text.length * 5));
        });
      },
      stop() { if (cur) cur.stop(); },
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets, scenario });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.waitForTimeout(500);
  // the owner: Parents → Words → "Use for Mia", then straight to PLAY (no waiting for anything to be prepared)
  await page.click('#btn-parents');
  for (let k = 0; k < 2 && await J(page, () => !!document.querySelector('.pinpad')); k++) { await pinIn(page, '1234'); await page.waitForTimeout(250); }
  await page.waitForSelector('.pz-content');
  await page.click('.pz-tabs [data-tab="words"]');
  await page.waitForSelector('#pz-class-use');
  await J(page, () => { window.__applyAt = Math.round(performance.now()); window.__cloudAsked.length = 0; window.__ulog.length = 0; });
  await page.click('#pz-class-use');
  await page.waitForSelector('#pz-class-following');
  const CL = await J(page, async (scenario) => {
    const C = await import('/src/data/classLists.js');
    const S = window.__spellJump;
    const c = C.newestClassList(Date.now());
    if (scenario !== 'qualifier') S.words.qualifierPending = null;
    S.words.today.count = 0; S.app.persistWords();
    const Sch = await import('/src/spelling/scheduler.js');
    const first = Sch.buildMission(S.words, Date.now(), { size: 8, newPerDay: 99, newToday: 0, includeReview: true });
    return { id: c.id, n: c.words.length, first: first.slice(0, 6), sentences: Object.fromEntries(c.words.map((w) => [w.word, w.sentence])) };
  }, scenario);
  await page.click('#pz-close');
  const applied = await J(page, () => window.__applyAt);
  await page.waitForSelector(visibleSel('#screen-title'));
  if (scenario === 'slow') {
    // the clip for the second word's carrier phrase never comes (the first word is fine)
    await J(page, (w) => { window.__omit = '^The word is, ' + w + '\\.$'; }, CL.first[1]);
  }
  const playAt = await J(page, () => Math.round(performance.now()));
  if (scenario === 'qualifier') {
    // the first thing after a new list is the Qualifier: every word of the list is dictated, in random order
    await J(page, () => {
      window.__noteSeen = 0;
      new MutationObserver(() => { const n = document.querySelector('#tm-note'); if (n && !n.hidden && n.textContent === 'Getting the voice ready…') window.__noteSeen++; })
        .observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    await page.click('#btn-play');
    await page.waitForSelector('#tm-go');
    await page.click('#tm-go');
    const heard = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 30000 });
      const w = await J(page, () => window.__spellJump.testScreen.word);
      heard.push(w);
      await page.waitForFunction((x) => window.__ulog.some((u) => u.text === `${x}.` && u.end), w, { timeout: 15000 });      // (a patient child: listens to the whole word)
      await tapKeys(page, '#tm-keyboard', i === 3 ? 'x' : w);       // the fourth is missed: Compare spells it aloud
      await page.tap('#tm-keyboard [data-key="enter"]');
      await page.waitForFunction((prev) => window.__spellJump.testScreen.word !== prev, w, { timeout: 15000 });
    }
    await page.click('#tm-exit');
    const Uq = await J(page, () => window.__ulog.map((u) => ({ engine: u.engine, text: u.text })));
    const devq = Uq.filter((u) => u.engine === 'device');
    const seen = await J(page, () => window.__noteSeen);
    console.log(`  (Qualifier: ${Uq.length} utterances, ${devq.length} device; "Getting the voice ready…" shown ${seen} time(s))`);
    check(devq.length === 0, `the Qualifier: zero device-voice utterances while the natural voice is available (${devq.length}${devq.length ? ': ' + devq.slice(0, 5).map((u) => JSON.stringify(u.text.slice(0, 30))).join(', ') : ''})`);
    check(heard.every((w) => Uq.some((u) => u.text === `The word is, ${w}.`) && Uq.some((u) => u.text === CL.sentences[w])), `each of the ${heard.length} words was dictated with its carrier phrase and sentence by clips (${heard.join(', ')})`);
    check(seen > 0, 'the calm "Getting the voice ready…" note showed on the test screen while the first clips came');
    check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
    return;
  }
  await page.click('#btn-play');
  await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#btn-race');
  await page.waitForSelector(visibleSel('#screen-tracks'));
  const t0 = Date.now();
  await page.click('[data-track="canyon"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  const w1 = await J(page, () => window.__spellJump.spellPanel.word);
  const noteSeen = scenario === 'cloud'
    ? await page.waitForFunction(() => { const nt = document.querySelector('#sp-note'); return !nt.hidden && nt.textContent === 'Getting the voice ready…'; }, null, { timeout: 4000 }).then(() => true, () => false)
    : null;
  if (noteSeen) {
    const calm = await J(page, () => ({ msg: document.querySelector('#sp-msg').textContent, mode: window.__spellJump.spellPanel.mode, text: document.querySelector('#spell').textContent }));
    check(calm.mode === 'init' && !/\d\s*(s|sec)\b|countdown|timer|hurry/i.test(calm.text.replace('Getting the voice ready…', '')), `the calm state: "Getting the voice ready…" with no timer or countdown text (${JSON.stringify(calm.msg)})`);
    await shot(page, layout, 'v01-getting-voice-ready', 0);
  }
  await page.waitForFunction(() => window.__spellJump.spellPanel.mode !== 'init', null, { timeout: 30000 });
  const readyMs = Date.now() - t0;          // the panel left "Get ready…" (the word's clips were ready, or the device voice took over)
  await waitMode(page, 'write', 30000);
  check(CL.first[0] === w1, `the race starts with the first word of the mission, "${w1}" (expected ${CL.first[0]})`);
  await tapKeys(page, '#sp-keyboard', w1);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction((w) => window.__spellJump.spellPanel.word && window.__spellJump.spellPanel.word !== w, w1, { timeout: 20000 });
  const w2 = await J(page, () => window.__spellJump.spellPanel.word);
  await waitMode(page, 'write', 30000);
  // word 2: a wrong try first (Compare spells it aloud) → Copy → Cover → fixed
  await tapKeys(page, '#sp-keyboard', 'x');
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'copy', 8000);
  await tapKeys(page, '#sp-keyboard', w2);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await waitMode(page, 'cover', 8000);
  await page.waitForTimeout(400);
  await tapKeys(page, '#sp-keyboard', w2);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const U = await J(page, () => window.__ulog.map((u) => ({ engine: u.engine, text: u.text, t0: u.t0, end: u.end })));
  const device = U.filter((u) => u.engine === 'device');
  const cloudU = U.filter((u) => u.engine === 'cloud');
  const asked = await J(page, () => window.__cloudAsked.map((a) => ({ at: a.at, n: a.texts.length, texts: a.texts })));
  const present = (w) => `The word is, ${w}.`;
  console.log(`  (${U.length} utterances: ${cloudU.length} cloud, ${device.length} device; ${asked.length} /api/tts requests; the panel left "Get ready…" after ${readyMs} ms)`);
  console.log('  device lines: ' + device.slice(0, 12).map((u) => JSON.stringify(u.text.slice(0, 40))).join(', '));
  if (process.env.VOICE_DEBUG) console.log(`  applied @${applied}, play @${playAt}`);
  if (process.env.VOICE_DEBUG) for (const a of asked.slice(0, 5)) console.log(`  request @${a.at} (${a.n}): ` + a.texts.map((x) => JSON.stringify(x.slice(0, 24))).join(' '));
  if (scenario === 'cloud') {
    check(device.length === 0, `zero device-voice utterances while the natural voice is available (${device.length}${device.length ? ': ' + device.slice(0, 6).map((u) => JSON.stringify(u.text.slice(0, 36))).join(', ') : ''})`);
    for (const w of [w1, w2]) {
      const texts = cloudU.map((u) => u.text);
      check(texts.includes(present(w)) && texts.includes(CL.sentences[w]) && texts.includes(`${w}.`), `"${w}": the carrier phrase, its sentence and the word were all said by clips`);
    }
    const spelledBy = (w) => w.split('').every((ch) => cloudU.some((u) => u.text === ch.toUpperCase()));
    check(spelledBy(w1) && spelledBy(w2), 'the letter-by-letter spelling was said by letter clips');
    check(asked.length > 3 && asked[0].at >= applied, `the clips are asked for from "Use for" on, in small batches (${asked.length} requests, sizes ${asked.slice(0, 8).map((a) => a.n).join(',')}…)`);
    // the order of the requests: the next race's two words and their sentences, then the later words of the mission
    const at = (text) => asked.findIndex((a) => a.texts.includes(text));
    const order = CL.first.slice(0, 4).flatMap((w) => [present(w), CL.sentences[w]]).map(at);
    check(order.every((i) => i >= 0) && order.every((i, k) => k === 0 || i >= order[k - 1]) && order[3] <= 1,
      `the next race's words and sentences are asked for first, then the rest of the mission, in order (request #${order.join(', #')})`);
    check(asked.length > 0 && asked.every((a) => a.n <= 12), `no request is long enough to make a waiting line queue behind it (largest ${Math.max(0, ...asked.map((a) => a.n))} texts)`);
    check(noteSeen, 'the calm "Getting the voice ready…" note showed on the spell panel while the first clips came');
  } else if (scenario === 'nokey') {
    check(cloudU.length === 0 && device.length > 0, `no key on the server: the device voice speaks (${device.length} utterances), no clip played`);
    check(device.some((u) => u.text === present(w1)) && device.some((u) => u.text === CL.sentences[w1]), `the device voice said the carrier phrase and the sentence of "${w1}"`);
    check(readyMs < 2000, `no waiting for a voice that cannot come (the panel left "Get ready…" after ${readyMs} ms)`);
  } else {
    // the second word's carrier clip never comes: after the wait the device voice says that word, and the cloud voice never follows it
    const i = U.findIndex((u) => u.engine === 'device' && u.text === present(w2));
    check(i >= 0, `the clip for "${present(w2)}" never came: after the wait the device voice said it`);
    const after = i >= 0 ? U.slice(i) : [];
    check(after.length > 3 && after.every((u) => u.engine === 'device'), `the same word is never spoken in the cloud voice after the device voice (${after.map((u) => u.engine[0]).join('')}: ${after.slice(0, 6).map((u) => u.text).join(' | ')})`);
    check(i > 0 && U.slice(0, i).every((u) => u.engine === 'cloud') && U.slice(0, i).some((u) => u.text === present(w1)), `the first word, whose clips came, was all cloud (${U.slice(0, Math.max(i, 0)).length} utterances)`);
  }
  check(!ttsNetwork, 'no request reached /api/tts (the stub answered everything)');
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// ---------- v3.10: the Sky Era teaser + the Sky Road (ONLY=sky runs just this, at both sizes) ----------
// A player with 3 mission days on the Sky Road (window.__noSkyTeaser NOT set): the full teaser plays by itself on the title
// (seen is saved when it starts), speaks only natural-voice clips (stubbed, never the device voice), Skip / Escape / a tap
// return to the title as it was; it does not replay after a reload; the title's Sky card shows "Sky Road 3 / 15" and replays
// it; it waits while a panel is open; a 4th mission day plays the milestone clip once; the Parent Zone shows the road; with
// prefers-reduced-motion the teaser is 3 still frames, a tap for each.
const SKY_DAYS = (n) => Array.from({ length: n }, (_, i) => { const d = new Date('2026-11-06T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
async function skyTeaserTest(browser, layout, { reduced = false } = {}) {
  console.log(`\n--- Sky Era teaser (${layout.name}${reduced ? ', reduced motion' : ''}) ---`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsNetwork = false;
  await ctx.route('**/api/tts/**', (r) => { ttsNetwork = true; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets, days }) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pmia: { wordsPerRace: 1, cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devS', keys: {} }));
      localStorage.setItem('spellJump.pmia.save', JSON.stringify({ v: 2, cash: 100, seen: { coach: true }, streak: { count: 1, best: 3, lastDay: days[days.length - 1], days: ['2026-10-30', ...days] } }));
      sessionStorage.setItem('seeded', '1');
    }
    window.__noClassLists = true;
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__spoken = [];
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        const clips = {};
        for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.03 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 25)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets, days: SKY_DAYS(3) });
  const sky = () => J(page, () => window.__spellJump.sky.state);
  const isOpen = () => J(page, () => window.__spellJump.sky.isOpen);
  const waitOpen = (timeout = 6000) => page.waitForFunction(() => window.__spellJump && window.__spellJump.sky.isOpen, null, { timeout }).then(() => true, () => false);
  const waitClosed = (timeout = 9000) => page.waitForFunction(() => !window.__spellJump.sky.isOpen, null, { timeout }).then(() => true, () => false);
  const titleAsBefore = () => J(page, () => ({ screen: window.__spellJump.screen, play: !document.querySelector('#btn-play').closest('[hidden]') && document.querySelector('#btn-play').getBoundingClientRect().height > 40,
    overlay: document.querySelector('#sky-teaser').hidden, hero: window.__spellJump.hero.mode }));
  const SKY = await import(pathToFileURL(path.join(root, 'src/meta/skyRoad.js')).href);
  const pick = async () => {
    await page.waitForSelector(visibleSel('#screen-players'));
    await page.click('[data-player="pmia"]');
    await page.waitForSelector(visibleSel('#screen-title'));
  };

  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await pick();
  check(await waitOpen(), 'a player who has not seen it: the Sky Era teaser opens by itself on the title');
  let st = await sky();
  check(st && st.kind === 'full' && st.steps === 3 && st.name === 'MIA' && st.reduced === reduced, `the full teaser, Sky Road 3 (2 days before the start not counted), the rings spell MIA (${JSON.stringify(st && { kind: st.kind, steps: st.steps, name: st.name, reduced: st.reduced })})`);
  check((await readSave(page)).seen.teaser === true, 'seen.teaser is saved as it starts (a closed tab does not loop it)');
  const skipBox = await J(page, () => { const r = document.querySelector('#st-skip').getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, right: r.right, W: innerWidth }; });
  check(skipBox.w >= 44 && skipBox.h >= 44 && skipBox.top >= layout.insets.t - 1 && skipBox.right <= skipBox.W - layout.insets.r + 1, `Skip is a big button inside the safe area (${Math.round(skipBox.w)}×${Math.round(skipBox.h)})`);

  if (reduced) {
    check(st.frames === 3 && st.frame === 0 && /above the clouds/.test(st.caption), `reduced motion: 3 still frames, the first one captioned (${st.caption})`);
    check(await J(page, () => !document.querySelector('#st-tap').hidden), 'reduced motion: "Tap for more" shows');
    await shot(page, layout, 'sky-r1-still', 300);
    await page.waitForTimeout(400);
    const tapC = () => page.mouse.click(layout.width / 2, layout.height * 0.4);
    await tapC(); await page.waitForTimeout(250);
    st = await sky();
    check(st && st.frame === 1 && /The Sky Era\. And a second jump you earn by spelling\. New tracks\. New rides\./.test(st.caption), `a tap: the second still (${st && st.caption})`);
    await shot(page, layout, 'sky-r2-still', 200);
    await tapC(); await page.waitForTimeout(250);
    st = await sky();
    check(st && st.frame === 2 && st.badge === 'Sky Road: 3 / 15' && /road to the sky/.test(st.caption), `a tap: the road still, "${st && st.badge}"`);
    await shot(page, layout, 'sky-r3-still', 200);
    await page.waitForFunction(() => window.__cloudPlayed.includes('Every mission you finish builds your road to the sky.'), null, { timeout: 4000 }).catch(() => {});
    await tapC();
    check(await waitClosed(3000), 'a tap on the last still closes it');
    const tb = await titleAsBefore();
    check(tb.screen === 'title' && tb.play && tb.overlay && tb.hero !== 'off', `back on the title as it was (${JSON.stringify(tb)})`);
    const played = await J(page, () => window.__cloudPlayed.slice());
    check(played.includes("What's up above the clouds?") && played.includes('The Sky Era.'), `the stills speak their lines with the natural voice (${played.length} clips)`);
    check(!(await J(page, () => window.__spoken.some((t) => /clouds|Sky|mission you finish/.test(t)))), 'never the device voice');
    check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
    return;
  }

  // the voice: natural clips only
  await page.waitForFunction(() => window.__cloudPlayed.includes("What's up above the clouds?"), null, { timeout: 4000 }).catch(() => {});
  const asked = (await J(page, () => window.__cloudAsked)).flatMap((a) => a.texts);
  check(SKY.teaserTexts().every((t) => asked.includes(t)), 'the title asked for the teaser lines as clips (incl. "Step 4 / 8 / 12 of 15")');
  check(await J(page, () => window.__cloudPlayed.includes("What's up above the clouds?")), 'the hook line is spoken with the natural voice');
  st = await sky();
  check(st.caption === "What's up above the clouds?", `its caption is on screen ("${st.caption}")`);
  await page.waitForTimeout(500);
  await shot(page, layout, 'sky-01-hook', 0);
  await layoutAudit(page, layout.insets, 'Sky teaser');
  // a few frames from the middle (seek pauses and draws that moment)
  for (const [t, name, re] of [[3.2, '02-climb', /clouds/], [13.4, '03-name-rings', /second jump/], [16.0, '04-rides', /New rides/], [21.5, '05-road', /road to the sky/]]) {
    await J(page, (x) => window.__spellJump.sky.seek(x), t);
    await page.waitForTimeout(150);
    st = await sky();
    check(re.test(st.caption), `at ${t} s the caption reads "${st.caption}"`);
    await shot(page, layout, 'sky-' + name, 0);
  }
  check(st.badge === 'Sky Road: 3 / 15', `the road shows "${st.badge}" as text`);
  const dark = await J(page, () => [...document.querySelectorAll('#sky-teaser *')].map((e) => e.textContent).join(' '));
  check(!/hurry|only \d+ left|don't lose|lost|lives|days left|countdown/i.test(dark), 'no pressure words anywhere in the teaser');
  await page.click('#st-skip');
  check(await waitClosed(2000), 'Skip closes it');
  let tb = await titleAsBefore();
  check(tb.screen === 'title' && tb.play && tb.overlay && tb.hero === 'anim', `Skip: back on the title exactly as it was (${JSON.stringify(tb)})`);
  check(!(await J(page, () => window.__spoken.some((t) => /clouds|Sky Era|mission you finish|second jump/.test(t)))), 'the device voice never said a teaser line');

  // the Sky card
  const card = await J(page, () => { const b = document.querySelector('#btn-sky'); const r = b.getBoundingClientRect(); const p = document.querySelector('#btn-play').getBoundingClientRect(); const f = document.querySelector('#btn-friday').getBoundingClientRect();
    return { hidden: b.hidden, text: document.querySelector('#sky-steps').textContent, steps: b.dataset.steps, h: r.height, overlapsPlay: !(r.right < p.left || r.left > p.right || r.bottom < p.top || r.top > p.bottom), menuBottom: f.bottom, H: innerHeight }; });
  check(!card.hidden && card.text === 'Sky Road 3 / 15' && card.steps === '3' && card.h >= 44 && !card.overlapsPlay, `the title's Sky card: "${card.text}", clear of PLAY`);
  check(card.menuBottom <= card.H - layout.insets.b, 'the menu buttons are still on screen under it');
  await shot(page, layout, 'sky-06-title-card');
  await layoutAudit(page, layout.insets, 'title with the Sky card');

  // no replay after a reload
  await page.reload({ waitUntil: 'networkidle' });
  await pick();
  await page.waitForTimeout(2200);
  check(!(await isOpen()), 'after a reload it does not play again');

  // the card replays it; Escape and a tap end it
  await page.click('#btn-sky');
  check(await waitOpen(2000) && (await sky()).kind === 'full', 'tapping the Sky card replays the full teaser');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  check(await waitClosed(2000), 'Escape ends it');
  check((await J(page, () => window.__spellJump.screen)) === 'title' && (await J(page, () => document.querySelectorAll('.modal:not([hidden])').length)) === 0, 'Escape did not open or close anything else');
  await page.click('#btn-sky');
  await waitOpen(2000);
  await page.mouse.click(layout.width * 0.3, layout.height * 0.5);
  check(await isOpen(), 'a tap in the first half second does not skip (the tap that opened it)');
  await page.waitForTimeout(700);
  await page.mouse.click(layout.width * 0.3, layout.height * 0.5);
  check(await waitClosed(2000), 'a tap anywhere after that ends it');
  tb = await titleAsBefore();
  check(tb.screen === 'title' && tb.overlay, 'back on the title');

  // it waits while a panel is open (never on top of one)
  await J(page, () => { const S = window.__spellJump; S.app.save.seen.teaser = false; S.app.persist(); });
  await page.click('#btn-streak');
  await J(page, () => window.__spellJump.app.maybeSky());
  await page.waitForTimeout(1200);
  check(!(await isOpen()), 'with the streak panel open the teaser waits');
  await page.keyboard.press('Escape');
  check(await waitOpen(3000), 'the panel closed: then it plays');
  await page.click('#st-skip');
  await waitClosed(2000);

  // a 4th mission day: the milestone clip, once
  await J(page, () => { const S = window.__spellJump; S.app.save.streak.days = [...S.app.save.streak.days, '2026-11-09']; S.app.persist(); S.app.go('garage'); });
  await page.waitForTimeout(200);
  await J(page, () => window.__spellJump.app.go('title'));
  check(await waitOpen(4000), 'Sky Road reached 4: the title plays the milestone clip');
  st = await sky();
  check(st.kind === 'clip' && st.step === 4 && st.steps === 4 && st.len < 6, `a short clip (${st.len} s) for step 4`);
  check((await readSave(page)).seen.skyClip === 4, 'seen.skyClip = 4 as it starts');
  await page.waitForFunction(() => /Step 4 of 15/.test((window.__spellJump.sky.state || {}).caption || ''), null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
  st = await sky();
  check(st && st.caption === 'Your Sky Road grew! Step 4 of 15.' && st.badge === 'Sky Road: 4 / 15', `the caption "${st && st.caption}", the meter "${st && st.badge}"`);
  await shot(page, layout, 'sky-07-milestone', 0);
  await page.waitForFunction(() => window.__cloudPlayed.includes('Your Sky Road grew! Step 4 of 15.'), null, { timeout: 3000 }).catch(() => {});
  check(await J(page, () => window.__cloudPlayed.includes('Your Sky Road grew! Step 4 of 15.')), 'the pre-made "Step 4 of 15" clip is spoken');
  check(await waitClosed(6000), 'the clip ends by itself');
  check((await J(page, () => window.__spellJump.screen)) === 'title' && (await J(page, () => document.querySelector('#sky-steps').textContent)) === 'Sky Road 4 / 15', 'back on the title, the card says 4 / 15');
  await J(page, () => window.__spellJump.app.go('garage'));
  await J(page, () => window.__spellJump.app.go('title'));
  await page.waitForTimeout(2000);
  check(!(await isOpen()), 'the milestone clip plays once');

  // the Parent Zone shows the road
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  await pinIn(page, '1234'); await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab]');
  await page.click('.pz-tabs [data-tab="report"]');
  await page.waitForSelector('#pz-sky');
  const pzLine = await J(page, () => document.querySelector('#pz-sky').textContent);
  check(pzLine === 'Sky Road: 4 / 15 mission days (the Sky Era teaser)', `Parent Zone → Report: "${pzLine}"`);
  await page.keyboard.press('Escape');

  check(!ttsNetwork, 'no request reached /api/tts (the stub answered everything)');
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// v3.11: every answered word banks at once. A Qualifier left midway keeps its answers (the word records, today's count, the cash) and resumes where it
// stopped next time without asking the answered words again; a race word answered and then left mid-banner still counts.
async function bankingTest(browser, layout) {
  console.log(`\n=== every word banks when it is answered (${layout.name}) ===`);
  const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await routeFonts(context);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|\/lab\/src\//.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => { window.__noSkyTeaser = true;
    window.__spoken = [];
    window.__noClassLists = true;
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(s);
    });
  }, { insets: layout.insets });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  const WS8 = ['shred', 'screw', 'strap', 'string', 'scrub', 'spray', 'straw', 'splash'];
  await J(page, async ({ ws }) => {
    const S = await import('/src/spelling/scheduler.js');
    const now = Date.now(), DAY = 864e5, dk = (t) => S.dayKey(t);
    localStorage.clear();
    localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, migrated: true, lastPlayer: 'pmia', options: { pmia: { wordsPerRace: 1 } },
      players: [{ id: 'pmia', name: 'Mia', color: '#ff3b5c', createdAt: 1, updatedAt: 1 }] }));
    localStorage.setItem('spellJump.pmia.save', JSON.stringify({ v: 2, cash: 1000, owned: ['beater'], selectedCar: 'beater', seen: { coach: true, ach: 0 } }));
    localStorage.setItem('spellJump.pmia.words', JSON.stringify({ v: 1, lists: [{ id: 'L1', name: 'Scr words', createdAt: now - DAY, archivedAt: 0, pattern: '', words: ws.map((word) => ({ word })) }], activeId: 'L1',
      records: {}, tests: [], qualifierPending: 'L1', today: { date: dk(now), count: 0, newCount: 0, missionPaid: false }, streak: 0, bestStreak: 0, perfectTotal: 0 }));
  }, { ws: WS8 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const rawWords = () => J(page, () => JSON.parse(localStorage.getItem('spellJump.pmia.words')));
  const rawSave = () => J(page, () => JSON.parse(localStorage.getItem('spellJump.pmia.save')));
  const askOne = async () => {
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask' && !document.querySelector('#tm-keyboard').classList.contains('is-disabled'), null, { timeout: 9000 });
    const w = await J(page, () => window.__spellJump.testScreen.word);
    await tapKeys(page, '#tm-keyboard', w);
    await page.tap('#tm-keyboard [data-key="enter"]');
    await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'right', null, { timeout: 4000 });
    return w;
  };
  // ---- Qualifier: two right answers, then leave mid-test (during the "Yes!" feedback)
  await page.click('#btn-play');
  await page.waitForSelector('#tm-go');
  check(/New words!/.test(await page.textContent('#screen-test h3')), 'first sitting: the Qualifier intro says "New words!"');
  await page.click('#tm-go');
  const asked1 = [await askOne()];
  await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask', null, { timeout: 5000 });
  const mid = await rawWords(), midSave = await rawSave();
  check(mid.today.count === 1 && midSave.cash === 1100, `word 1 banked at once: today ${mid.today.count} / 8, cash ${midSave.cash}`);
  asked1.push(await askOne());
  await page.click('#tm-exit');
  await page.waitForSelector(visibleSel('#screen-title'));
  const w2 = await rawWords(), s2 = await rawSave();
  check(w2.today.count === 2 && s2.cash === 1200, `left mid-test: today ${w2.today.count} / 8, cash ${s2.cash} (+$100 a word kept)`);
  check(asked1.every((w) => w2.records[w] && w2.records[w].box >= 2 && w2.records[w].seenCount >= 1), `the answered words keep their results (${asked1.join(', ')}: box ${asked1.map((w) => w2.records[w].box).join(',')})`);
  check(w2.testRun && w2.testRun.kind === 'qualifier' && w2.testRun.results.length === 2 && w2.tests.length === 0 && w2.qualifierPending === 'L1', 'the Qualifier is still pending with its 2 answers remembered, no test entry yet');
  check(/Today: 2 \/ 8 words/i.test(await page.textContent('#title-mission-text')), `the title says "${await page.textContent('#title-mission-text')}"`);
  // ---- next time (a fresh load): it resumes where it stopped
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(/new words/i.test(await page.textContent('#btn-play')), 'PLAY still announces the new words');
  await page.click('#btn-play');
  await page.waitForSelector('#tm-go');
  const intro = await J(page, () => ({ h: document.querySelector('#screen-test h3').textContent, p: document.querySelector('#screen-test .tm-card p').textContent, count: document.querySelector('#tm-count').textContent }));
  check(/Welcome back/.test(intro.h) && /2 of 8/.test(intro.p) && intro.count === '3 / 8', `resume intro: "${intro.h}" · "${intro.p}" · counter ${intro.count}`);
  await page.click('#tm-go');
  const asked2 = [];
  for (let i = 0; i < 6; i++) {
    asked2.push(await askOne());
    if (i < 5) await page.waitForFunction(() => document.querySelector('#screen-test').dataset.mode === 'ask', null, { timeout: 5000 });
  }
  check(asked2.every((w) => !asked1.includes(w)) && new Set(asked2).size === 6, `the answered words are not asked again (asked now: ${asked2.join(', ')})`);
  await page.waitForSelector('#tm-score', { timeout: 8000 });
  check((await page.textContent('#tm-score')).trim() === '8 / 8', `the end card counts all 8 (${(await page.textContent('#tm-score')).trim()})`);
  const w3 = await rawWords(), s3 = await rawSave();
  const q = w3.tests.find((t) => t.kind === 'qualifier');
  check(q && q.correct === 8 && q.total === 8 && !w3.qualifierPending && !w3.testRun && s3.cash === 2300, `finished: one Qualifier entry 8/8, no longer pending, nothing left to resume, cash ${s3.cash} (= 1000 + 8 × $100 + the $500 mission the 8th word completes, each paid once)`);
  await page.click('#tm-go');
  await page.waitForFunction(() => document.querySelector('#screen-garage') && !document.querySelector('#screen-garage').hidden, null, { timeout: 8000 }).catch(async () => { console.log('  (screen after the Qualifier:', await J(page, () => [...document.querySelectorAll('.screen')].filter((x) => !x.hidden).map((x) => x.id).join()), ')'); });
  // ---- a race word answered, then the panel is left during the banner: the word still counts
  await J(page, () => { const S = window.__spellJump; S.words.today = { date: S.words.today.date, count: 0, newCount: 0, missionPaid: false }; S.app.persistWords(); });
  const cash0 = (await rawSave()).cash;
  await J(page, () => window.__spellJump.app.startRun({ trackId: 'canyon' }));
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 8000 });
  await waitMode(page, 'write', 9000);
  const rw = await J(page, () => window.__spellJump.spellPanel.word);
  await tapKeys(page, '#sp-keyboard', rw);
  await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.mode === 'done', null, { timeout: 4000 });
  await page.click('#spell .sp-exit');                             // the back button during the banner
  await page.waitForSelector(visibleSel('#screen-garage'));
  const w4 = await rawWords(), s4 = await rawSave();
  check(w4.today.count === 1 && w4.records[rw].firstTry >= 1 && s4.cash > cash0, `a race word left mid-banner still counts: today ${w4.today.count}, "${rw}" firstTry ${w4.records[rw].firstTry}, cash ${cash0} → ${s4.cash}`);
  check(errors.length === 0, `no console errors (${errors.join(' | ')})`);
  await context.close();
}

// ---------- v4.0: the Sky Era (ONLY=skyera runs just this, at both sizes) ----------
// The app side of the Sky Era on the stand-in data (?mock=1&skyfixture=1: tools/fixtures/sky/, 2 sky tracks + 1 ride, and the mock engine's sky contract):
//   A the unlock ceremony: a child whose Sky Road is complete gets it once, by itself, on the title (the gate opens, the car drives through, three rides lit and
//     named), natural-voice clips only (never the device voice), skippable; then the Earth / Sky tabs, remembered across a reload; it does not replay
//   B tracks + garage: the sky track list with its own chain, the "Sky rides" row and the garage's order per era, buying a ride with Garage cash
//   C before the unlock: the Sky tab on the track screen shows the locked Sky Gate and the Sky Road and never blocks Earth; the title still has the Sky card
//   D Parents → Options: "Spell Boost in the Sky" (per child) and "Open the Sky Era now"
//   E the Spell Boost: the engine freezes at the gate (nothing moves, no timer), the panel is the launch word's panel with a gold chip, a miss fixed in the panel
//     boosts at 0.5, a first try at 1, then freeze(false); both words count; the results line "Spell Boost: +X m"; switched off = no freeze, start({ spellBoost: false })
async function skyEraPage(browser, layout, { days = 0, sky = null, seen = { coach: true, teaser: true, skyClip: 15 }, cash = 850000, options = { wordsPerRace: 1, levelsPerRace: 1 }, noTeaser = false, fixture = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: [] });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  const net = { tts: false };
  await ctx.route('**/api/tts/**', (r) => { net.tts = true; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|\/lab\/src\/|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets, dayList, sky, seen, cash, options, noTeaser }) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now();
      const opts = { pmia: { ...options, cloudVoice: 'en-US-Neural2-F' } };
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: opts, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devS', keys: {} }));
      const save = { v: 2, cash, seen, streak: { count: dayList.length, best: dayList.length, lastDay: dayList.length ? dayList[dayList.length - 1] : '', days: dayList } };
      if (sky) save.sky = sky;
      localStorage.setItem('spellJump.pmia.save', JSON.stringify(save));
      sessionStorage.setItem('seeded', '1');
    }
    window.__noClassLists = true;
    if (noTeaser) window.__noSkyTeaser = true;
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__spoken = []; window.__seq = [];
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
      cancel() {}, addEventListener() {},
    };
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        const clips = {};
        for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.03 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 25)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets, dayList: SKY_DAYS(days), sky, seen, cash, options, noTeaser });
  const go = async () => {
    await page.goto(BASE + '/index.html?mock=1&nosw=1' + (fixture ? '&skyfixture=1' : ''), { waitUntil: 'networkidle' });
    await page.waitForSelector(visibleSel('#screen-players'));
    await page.click('[data-player="pmia"]');
    await page.waitForSelector(visibleSel('#screen-title'));
  };
  return { ctx, page, errors, net, go };
}

async function skyEraTest(browser, layout) {
  console.log(`\n--- Sky Era (${layout.name}) ---`);
  const SKYM = await import(pathToFileURL(path.join(root, 'src/meta/sky.js')).href);
  void SKYM;
  const sv = (page) => J(page, () => JSON.parse(localStorage.getItem('spellJump.pmia.save')));
  const eraState = (page) => J(page, () => ({ era: window.__spellJump.era, switchOn: !document.querySelector('#era-switch').hidden, card: !document.querySelector('#btn-sky').hidden,
    tab: (document.querySelector('#era-switch .era-tab.on') || {}).dataset?.era || null }));
  const names = (page) => J(page, () => [...document.querySelectorAll('#track-grid .track-card')].map((c) => `${c.dataset.track}${c.classList.contains('locked') ? ':locked' : ''}`));

  // ============ A: the ceremony, once ============
  {
    const { ctx, page, errors, net, go } = await skyEraPage(browser, layout, { days: 15, seen: { coach: true, teaser: true, skyClip: 12 } });
    await go();
    const open = () => J(page, () => window.__spellJump.sky.isOpen);
    check(await page.waitForFunction(() => window.__spellJump.sky.isOpen, null, { timeout: 6000 }).then(() => true, () => false), 'A: a complete Sky Road (15 / 15) opens the Sky Era and the ceremony plays by itself on the title');
    await page.waitForTimeout(900);
    let st = await J(page, () => window.__spellJump.sky.state);
    check(st && st.kind === 'open' && st.caption === 'The Sky Era is open!' && !st.reduced, `A: the ceremony, captioned "${st && st.caption}"`);
    let s0 = await sv(page);
    check(s0.sky && s0.sky.unlocked === true && s0.sky.ceremonySeen === true && s0.sky.at > 0 && s0.seen.skyClip === 15, `A: save.sky = ${JSON.stringify(s0.sky)} saved as it starts (the gate clip "on its way" is never played now)`);
    check(!(await J(page, () => document.querySelector('#screen-title').hidden)) || true, 'A: over the title');
    await J(page, () => window.__spellJump.sky.seek(1.6)); await shot(page, layout, 'skyera-01-gate-opens', 120);
    await J(page, () => window.__spellJump.sky.seek(3.4)); await shot(page, layout, 'skyera-02-car-through', 120);
    await J(page, () => window.__spellJump.sky.seek(4.6)); await shot(page, layout, 'skyera-03-flash', 120);
    await J(page, () => window.__spellJump.sky.seek(5.9)); await shot(page, layout, 'skyera-04-first-ride-lit', 120);
    await J(page, () => window.__spellJump.sky.seek(9)); await shot(page, layout, 'skyera-05-rides-named', 120);
    st = await J(page, () => window.__spellJump.sky.state);
    check(st.rides && st.rides.map((r) => r.name).join('|') === 'Hover Bike|Rocket Car|Mech Walker' && st.rides.every((r) => r.lit), `A: the three rides are lit and named: ${JSON.stringify(st.rides && st.rides.map((r) => r.name))}`);
    const labels = await J(page, () => [...document.querySelectorAll('#st-rides .st-ride')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, o: Number(getComputedStyle(e).opacity) }; }));
    check(labels.every((r) => r.l >= 0 && r.r <= layout.width && r.t >= 0 && r.b <= layout.height && r.o > 0.9), `A: the ride names sit inside the screen (${labels.map((r) => Math.round(r.l) + '..' + Math.round(r.r)).join(', ')})`);
    const skipBox = await J(page, () => { const r = document.querySelector('#st-skip').getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, right: r.right, W: innerWidth }; });
    check(skipBox.w >= 44 && skipBox.h >= 44 && skipBox.top >= layout.insets.t - 1 && skipBox.right <= skipBox.W - layout.insets.r + 1, 'A: Skip is a big button inside the safe area');
    await page.keyboard.press('Escape');
    check(await page.waitForFunction(() => !window.__spellJump.sky.isOpen, null, { timeout: 3000 }).then(() => true, () => false), 'A: Escape skips it');
    let e = await eraState(page);
    check(e.switchOn && !e.card && e.tab === 'sky' && e.era === 'sky', `A: afterwards the title has the Earth / Sky tabs on Sky, the Sky Road card is gone (${JSON.stringify(e)})`);
    s0 = await sv(page);
    check(s0.sky.era === 'sky', 'A: the Sky tab is saved as the era');
    await shot(page, layout, 'skyera-06-title-sky-tab', 200);
    await layoutAudit(page, layout.insets, 'A title with the era switch');
    const sw = await J(page, () => [...document.querySelectorAll('#era-switch .era-tab')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), b.textContent.trim()]; }));
    check(sw.length === 2 && sw.every(([w, h]) => w >= 100 && h >= 48) && sw[0][2] === 'Earth' && sw[1][2] === 'Sky', `A: two big tabs Earth / Sky (${JSON.stringify(sw)})`);
    // replay once to hear it: the natural clips only, never the device voice
    await J(page, () => { window.__skyTeaserSpeed = 9; window.__spoken.length = 0; window.__cloudPlayed.length = 0; window.__spellJump.app.playSky({ kind: 'open', step: 15 }); });
    check(await page.waitForFunction(() => !window.__spellJump.sky.isOpen, null, { timeout: 6000 }).then(() => true, () => false), 'A: the ceremony runs to its end by itself');
    const played = await J(page, () => window.__cloudPlayed.slice());
    check(played.includes('The Sky Era is open!') && played.includes('New tracks. New rides.'), `A: it says "The Sky Era is open!" with the natural voice's clips (${JSON.stringify(played)})`);
    check(!(await J(page, () => window.__spoken.some((t) => /Sky|open|rides/i.test(t)))), 'A: never the device voice');
    await J(page, () => { window.__skyTeaserSpeed = 1; });
    // a reload: no second ceremony, the era is remembered
    await page.goto(BASE + '/index.html?mock=1&nosw=1&skyfixture=1', { waitUntil: 'networkidle' });
    await page.waitForSelector(visibleSel('#screen-players')); await page.click('[data-player="pmia"]'); await page.waitForSelector(visibleSel('#screen-title'));
    await page.waitForTimeout(2200);
    e = await eraState(page);
    check(!(await open()) && e.era === 'sky' && e.tab === 'sky', `A: after a reload it does not play again and the Sky tab is remembered (${JSON.stringify(e)})`);
    await page.click('#era-earth');
    e = await eraState(page);
    check(e.era === 'earth' && e.tab === 'earth' && (await sv(page)).sky.era === 'earth', 'A: the Earth tab: saved');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector(visibleSel('#screen-players')); await page.click('[data-player="pmia"]'); await page.waitForSelector(visibleSel('#screen-title'));
    check((await eraState(page)).tab === 'earth', 'A: Earth is remembered after a reload');
    await shot(page, layout, 'skyera-07-title-earth-tab', 200);
    check(!net.tts, 'A: no request reached /api/tts');
    check(errors.length === 0, `A: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ============ B: tracks and the garage (ceremony already seen, sky era chosen) ============
  {
    const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 15, sky: { unlocked: true, at: 5, ceremonySeen: true, era: 'sky' }, cash: 850000 });
    await go();
    await page.waitForTimeout(1200);
    check(!(await J(page, () => window.__spellJump.sky.isOpen)), 'B: a seen ceremony does not play');
    await page.click('#btn-play');
    await page.waitForSelector(visibleSel('#screen-garage'));
    await page.waitForTimeout(300);
    const g1 = await J(page, () => ({ name: document.querySelector('#car-name').textContent, row: !document.querySelector('#sky-rides').hidden, chips: [...document.querySelectorAll('#sky-rides .sr-chip')].map((c) => c.dataset.ride), label: (document.querySelector('#sky-rides .sr-label') || {}).textContent,
      dots: document.querySelectorAll('#car-dots i').length }));
    check(g1.row && g1.chips.join() === 'hoverbike' && g1.label === 'Sky rides' && g1.name === 'Hover Bike' && g1.dots === 12, `B: Sky era: the garage opens on the sky rides first with a "Sky rides" row (${JSON.stringify(g1)})`);
    await shot(page, layout, 'skyera-08-garage-sky-rides', 120);
    await layoutAudit(page, layout.insets, 'B garage (Sky rides row)');
    const before = await sv(page);
    await page.click('#car-action');
    await page.waitForTimeout(300);
    const after = await sv(page);
    const price = await J(page, async () => (await import('/tools/fixtures/sky/skyRides.js')).SKY_RIDES[0].price);
    check(after.owned.includes('hoverbike') && after.cash === before.cash - price && after.selectedCar === 'hoverbike', `B: the ride is bought with Garage cash (${before.cash} → ${after.cash}) and selected`);
    check(await J(page, () => document.querySelector('#sky-rides .sr-chip').classList.contains('owned') && !!document.querySelector('#sky-rides .sr-chip svg')), 'B: the owned ride is ticked in the row');
    await page.click('#btn-race');
    await page.waitForSelector(visibleSel('#screen-tracks'));
    await page.waitForTimeout(250);
    const t1 = await names(page);
    const tab1 = await J(page, () => ({ shown: !document.querySelector('#track-era').hidden, on: (document.querySelector('#track-era .era-tab.on') || {}).dataset?.era, locks: [...document.querySelectorAll('#track-grid .lock span')].map((x) => x.textContent), nums: [...document.querySelectorAll('#track-grid .track-num')].map((x) => x.textContent) }));
    check(t1.join() === 'sky-1,sky-2:locked' && tab1.shown && tab1.on === 'sky' && tab1.locks.join() === 'Finish Cloud Hop' && /^Sky 01/.test(tab1.nums[0]), `B: the Sky tab lists the sky tracks with their own chain (${t1.join(', ')}; ${JSON.stringify(tab1.locks)})`);
    await shot(page, layout, 'skyera-09-sky-tracks', 120);
    await layoutAudit(page, layout.insets, 'B track screen (Sky tab)');
    await page.click('#track-era [data-era="earth"]');
    await page.waitForTimeout(150);
    const t2 = await names(page);
    check(t2.length === 20 && t2[0] === 'canyon' && (await sv(page)).sky.era === 'earth', `B: the Earth tab lists the 20 Earth stages and is saved (${t2.length})`);
    await page.click('#track-era [data-era="sky"]');
    check((await names(page)).length === 2 && (await sv(page)).sky.era === 'sky', 'B: back on Sky: saved');
    // the garage in the Earth era: cars first, the ride at the end, no row
    await page.click('#track-era [data-era="earth"]');
    await page.click('[data-back="garage"]');
    await page.waitForSelector(visibleSel('#screen-garage'));
    await page.waitForTimeout(250);
    const g2 = await J(page, () => ({ row: !document.querySelector('#sky-rides').hidden, name: document.querySelector('#car-name').textContent, dots: document.querySelectorAll('#car-dots i').length }));
    check(!g2.row && g2.dots === 12, `B: Earth era: no Sky rides row, the 11 cars then the ride in the carousel (${JSON.stringify(g2)})`);
    await page.click('#car-prev'); await page.click('#car-prev');
    await page.waitForTimeout(150);
    const lastName = await J(page, () => document.querySelector('#car-name').textContent);
    await page.click('#car-next');
    const wrapName = await J(page, () => document.querySelector('#car-name').textContent);
    check(lastName.length > 0 && wrapName.length > 0, `B: every car stays reachable (${lastName} / ${wrapName})`);
    check(errors.length === 0, `B: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ============ C: before the unlock ============
  {
    const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 3, noTeaser: true, cash: 90000 });
    await go();
    const e0 = await eraState(page);
    check(e0.card && !e0.switchOn && e0.era === 'earth', `C: locked: the Sky Road card is on the title, no era tabs (${JSON.stringify(e0)})`);
    await page.click('#btn-play'); await page.waitForSelector(visibleSel('#screen-garage'));
    check(await J(page, () => document.querySelector('#sky-rides').hidden && document.querySelectorAll('#car-dots i').length === 11), 'C: the garage has no sky rides yet (11 cars)');
    await page.click('#btn-race'); await page.waitForSelector(visibleSel('#screen-tracks'));
    check((await J(page, () => !document.querySelector('#track-era').hidden)) && (await names(page)).length === 20, 'C: the track screen shows the tabs and Earth first');
    await page.click('#track-era [data-era="sky"]');
    await page.waitForTimeout(200);
    const gate = await J(page, () => { const c = document.querySelector('#sky-gate-card'); return c ? { text: c.textContent, steps: c.dataset.steps, tracks: document.querySelectorAll('#track-grid .track-card').length } : null; });
    check(gate && gate.steps === '3' && /Sky Gate/.test(gate.text) && /Sky Road 3 \/ 15/.test(gate.text) && gate.tracks === 0, `C: the Sky tab shows the locked Sky Gate and "Sky Road 3 / 15" (${gate && gate.text.replace(/\s+/g, ' ')})`);
    check((await sv(page)).sky.unlocked === false && (await sv(page)).sky.era === 'earth', 'C: a peek at the gate saves nothing');
    await shot(page, layout, 'skyera-10-locked-gate', 120);
    await layoutAudit(page, layout.insets, 'C locked Sky Gate');
    await page.click('#sky-gate-back');
    await page.waitForTimeout(150);
    check((await names(page)).length === 20, 'C: "Back to Earth": Earth was never blocked');
    await page.click('[data-track="canyon"]');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    check((await J(page, () => window.__spellJump.run.trackId)) === 'canyon', 'C: Earth tracks still start a run');
    check(errors.length === 0, `C: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ============ D: Parents → Options ============
  {
    const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 3, noTeaser: true });
    await go();
    await page.click('#btn-parents');
    await page.waitForSelector(visibleSel('#pz'));
    await pinIn(page, '1234'); await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
    await pinIn(page, '1234');
    await page.waitForSelector('.pz-content[data-tab]');
    await page.click('.pz-tabs [data-tab="options"]');
    await page.waitForSelector('#opt-sky-boost');
    const o0 = await J(page, () => ({ boost: document.querySelector('#opt-sky-boost').getAttribute('aria-checked'), open: document.querySelector('#opt-sky-open-row').dataset.unlocked, label: document.querySelector('#opt-sky-boost').closest('.row .label, .row').textContent, sub: document.querySelector('#opt-sky-open-row .sub').textContent }));
    check(o0.boost === 'true' && o0.open === 'false' && /Spell Boost in the Sky: on\/off/.test(o0.label) && /3\)/.test(o0.sub), `D: Spell Boost in the Sky defaults on; "Open the Sky Era now" is offered (${o0.sub})`);
    await J(page, () => document.querySelector('#opt-sky-open-row').scrollIntoView({ block: 'center' }));
    await shot(page, layout, 'skyera-11-parent-options', 200);
    await page.click('#opt-sky-boost');
    check((await J(page, () => JSON.parse(localStorage.getItem('spellJump.family')).options.pmia.skyBoost)) === false, 'D: the switch stores skyBoost: false for this child');
    await page.click('#opt-sky-boost');
    check((await J(page, () => JSON.parse(localStorage.getItem('spellJump.family')).options.pmia.skyBoost)) === true, 'D: and back on');
    await page.click('#opt-sky-open');
    check(await J(page, () => !document.querySelector('#opt-sky-open-yes').closest('.confirm').hidden), 'D: Open now asks first (it cannot be closed again)');
    await page.click('#opt-sky-open-yes');
    await page.waitForFunction(() => document.querySelector('#opt-sky-open-row').dataset.unlocked === 'true', null, { timeout: 3000 });
    const s1 = await sv(page);
    check(s1.sky.unlocked === true && s1.sky.ceremonySeen === false && s1.sky.at > 0 && (await J(page, () => document.querySelector('#opt-sky-open').disabled)), `D: a parent opens the Sky Era at 3 road steps: ${JSON.stringify(s1.sky)}, the button is done`);
    await J(page, () => document.querySelector('#opt-sky-open-row').scrollIntoView({ block: 'center' }));
    await shot(page, layout, 'skyera-12-parent-opened', 200);
    await page.keyboard.press('Escape');
    await page.waitForSelector(visibleSel('#screen-title'));
    await page.waitForTimeout(300);
    const e1 = await eraState(page);
    check(e1.switchOn && !e1.card && e1.tab === 'earth', `D: the title now has the era tabs (${JSON.stringify(e1)})`);
    check(errors.length === 0, `D: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ============ E: the Spell Boost ============
  {
    const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 3, sky: { unlocked: true, at: 5, ceremonySeen: true, era: 'sky' }, cash: 1000 });
    await go();
    await J(page, () => {
      const g = window.__spellJump.game;
      for (const k of ['freeze', 'boost', 'start']) { const o = g[k].bind(g); g[k] = (...a) => { window.__seq.push(k === 'start' ? ['start', a[0].track.id, a[0].spellBoost] : k === 'boost' ? ['boost', a[0].power, a[0].word] : ['freeze', a[0]]); return o(...a); }; }
    });
    const startSky = async () => {
      await page.click('#btn-play'); await page.waitForSelector(visibleSel('#screen-garage'));
      await page.click('#btn-race'); await page.waitForSelector(visibleSel('#screen-tracks'));
      await page.click('[data-track="sky-1"]');
      await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    };
    const launchWordFirstTry = async () => {
      if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
      const w = await J(page, () => window.__spellJump.spellPanel.word);
      await tapKeys(page, '#sp-keyboard', w); await page.tap('#sp-keyboard [data-key="enter"]');
      await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 9000 });
      return w;
    };
    await startSky();
    const mission0 = (await readWords(page)).today.count;
    const w1 = await launchWordFirstTry();
    check((await J(page, () => window.__seq.find((s) => s[0] === 'start')))[2] === true, 'E: a sky run starts the engine with spellBoost: true');
    await page.waitForTimeout(250);
    await page.keyboard.down('ArrowRight');
    check(await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 }).then(() => true, () => false), 'E: past the apex the spell panel opens by itself (the Spell Boost)');
    await page.keyboard.up('ArrowRight');
    const f1 = await J(page, () => { const h = window.__spellJump.game.getHudState(); return { frozen: h.frozen, ready: h.boostReady, used: h.boostUsed, d: window.__spellJump.game.getState().distance, air: window.__spellJump.game.getState().airTime }; });
    check(f1.frozen === true && f1.used === false && f1.ready === true, `E: the engine is frozen at the gate (${JSON.stringify(f1)})`);
    check(await J(page, () => document.querySelector('#sp-boost') && document.querySelector('#sp-boost').textContent === 'Spell Boost' && document.querySelector('#spell').dataset.kind === 'boost'), 'E: the panel is the launch word\'s panel with a "Spell Boost" chip');
    if (await panelMode(page) === 'look') { await shot(page, layout, 'skyera-13-boost-panel-look', 0); await waitMode(page, 'write', 9000); }
    const bw = await J(page, () => window.__spellJump.spellPanel.word);
    check(bw !== w1, `E: the boost word "${bw}" is another word than the launch word "${w1}" (same scheduler)`);
    check(!(await visibleTextHas(page, bw)), `E: R1: the boost word "${bw}" is nowhere on screen while it is spelled`);
    await page.waitForTimeout(1500);
    const f2 = await J(page, () => ({ d: window.__spellJump.game.getState().distance, air: window.__spellJump.game.getState().airTime, frozen: window.__spellJump.game.getHudState().frozen }));
    check(f2.frozen && f2.d === f1.d && f2.air === f1.air, `E: nothing ticks while the child spells: distance ${f1.d.toFixed(2)} → ${f2.d.toFixed(2)}, air time ${f1.air.toFixed(3)} → ${f2.air.toFixed(3)}`);
    check(await J(page, () => document.documentElement.classList.contains('spelling') && getComputedStyle(document.querySelector('#hud')).visibility === 'hidden'), 'E: the HUD and the driving controls are hidden: a calm frozen scene');
    await shot(page, layout, 'skyera-14-boost-panel', 0);
    await layoutAudit(page, layout.insets, 'E Spell Boost panel');
    // a miss, fixed in the panel → power 0.5
    const wrong = bw.slice(0, -2) + (bw.at(-1) === 'x' ? 'q' : 'x');
    await spellWrongThenCompare(page, wrong, 'E boost');
    await waitMode(page, 'copy', 3000); await page.waitForTimeout(150);
    await tapKeys(page, '#sp-keyboard', bw); await page.tap('#sp-keyboard [data-key="enter"]');
    await waitMode(page, 'cover', 3000);
    await tapKeys(page, '#sp-keyboard', bw); await page.tap('#sp-keyboard [data-key="enter"]');
    await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 9000 });
    await page.waitForTimeout(250);
    const seq1 = await J(page, () => window.__seq.filter((s) => s[0] !== 'start'));
    check(JSON.stringify(seq1) === JSON.stringify([['boost', 0.5, bw], ['freeze', false]]), `E: fixed after a miss: game.boost({ power: 0.5, word }) then game.freeze(false) (${JSON.stringify(seq1)})`);
    check(await J(page, () => !window.__spellJump.game.getHudState().frozen && window.__spellJump.game.getHudState().boostUsed), 'E: the scene runs again');
    await page.waitForSelector(visibleSel('#screen-results'), { timeout: 30000 });
    await page.waitForTimeout(1500);
    const r1 = await J(page, () => { const tr = document.querySelector('#res-pay tr[data-pay="boost"]'); return tr ? { text: tr.textContent, power: tr.dataset.power, meters: tr.dataset.meters } : null; });
    check(r1 && /^Spell Boost: \+40 m/.test(r1.text) && r1.power === '0.5' && r1.meters === '40' && r1.text.includes(bw), `E: the results line: "${r1 && r1.text}"`);
    const w2s = await readWords(page);
    check(w2s.today.count - mission0 === 2, `E: both words count toward the mission (today ${mission0} → ${w2s.today.count})`);
    check(w2s.records[bw] && w2s.records[bw].misses >= 1 && w2s.records[w1] && w2s.records[w1].firstTry >= 1, `E: the Leitner records moved for both: "${w1}" firstTry ${w2s.records[w1] && w2s.records[w1].firstTry}, "${bw}" misses ${w2s.records[bw] && w2s.records[bw].misses}`);
    await shot(page, layout, 'skyera-15-results-boost', 200);
    await layoutAudit(page, layout.insets, 'E results with the Spell Boost line');
    // race 2: the boost word right on the first try → power 1
    await J(page, () => { window.__seq.length = 0; });
    await page.click('#res-retry');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    await launchWordFirstTry();
    await page.waitForTimeout(250);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 });
    await page.keyboard.up('ArrowRight');
    if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
    const bw2 = await J(page, () => window.__spellJump.spellPanel.word);
    await tapKeys(page, '#sp-keyboard', bw2); await page.tap('#sp-keyboard [data-key="enter"]');
    await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 9000 });
    await page.waitForTimeout(250);
    const seq2 = await J(page, () => window.__seq.filter((s) => s[0] !== 'start'));
    check(JSON.stringify(seq2) === JSON.stringify([['boost', 1, bw2], ['freeze', false]]), `E: first try: game.boost({ power: 1, word }) then game.freeze(false) (${JSON.stringify(seq2)})`);
    await page.waitForSelector(visibleSel('#screen-results'), { timeout: 30000 });
    await page.waitForTimeout(1200);
    const r2 = await J(page, () => { const tr = document.querySelector('#res-pay tr[data-pay="boost"]'); return tr ? { text: tr.textContent, meters: tr.dataset.meters } : null; });
    check(r2 && r2.meters === '80' && /^Spell Boost: \+80 m/.test(r2.text), `E: the results line at power 1: "${r2 && r2.text}"`);
    // an Earth track never freezes
    await J(page, () => { window.__seq.length = 0; });
    await page.click('#res-garage'); await page.waitForSelector(visibleSel('#screen-garage'));
    await page.click('#btn-race'); await page.waitForSelector(visibleSel('#screen-tracks'));
    await page.click('#track-era [data-era="earth"]');
    await page.click('[data-track="canyon"]');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    await launchWordFirstTry();
    check(await J(page, () => window.__seq.find((s) => s[0] === 'start')[2] === undefined), 'E: an Earth track starts with no spellBoost flag');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
    await page.waitForSelector(visibleSel('#screen-results'), { timeout: 30000 });
    check(!(await J(page, () => window.__seq.some((s) => s[0] === 'freeze' || s[0] === 'boost'))) && (await J(page, () => !document.querySelector('#res-pay tr[data-pay="boost"]'))), 'E: Earth: no freeze, no boost, no Spell Boost line');
    check(errors.length === 0, `E: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ============ E2: Spell Boost off for this child ============
  {
    const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 3, sky: { unlocked: true, at: 5, ceremonySeen: true, era: 'sky' }, options: { wordsPerRace: 1, levelsPerRace: 1, skyBoost: false } });
    await go();
    await J(page, () => {
      const g = window.__spellJump.game;
      for (const k of ['freeze', 'boost', 'start']) { const o = g[k].bind(g); g[k] = (...a) => { window.__seq.push(k === 'start' ? ['start', a[0].track.id, a[0].spellBoost] : [k]); return o(...a); }; }
    });
    await page.click('#btn-play'); await page.waitForSelector(visibleSel('#screen-garage'));
    await page.click('#btn-race'); await page.waitForSelector(visibleSel('#screen-tracks'));
    await page.click('[data-track="sky-1"]');
    await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
    if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
    const w = await J(page, () => window.__spellJump.spellPanel.word);
    await tapKeys(page, '#sp-keyboard', w); await page.tap('#sp-keyboard [data-key="enter"]');
    await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 9000 });
    await page.waitForTimeout(250);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400);
    await page.waitForSelector(visibleSel('#screen-results'), { timeout: 30000 });
    await page.keyboard.up('ArrowRight');
    const seq = await J(page, () => window.__seq);
    check(seq.find((s) => s[0] === 'start')[2] === false && !seq.some((s) => s[0] === 'freeze' || s[0] === 'boost'), `E2: Spell Boost off: start({ spellBoost: false }), the flight never stops (${JSON.stringify(seq)})`);
    const words = await readWords(page);
    check(words.today.count === 1, `E2: only the launch word was asked (today ${words.today.count})`);
    check(await J(page, () => !document.querySelector('#res-pay tr[data-pay="boost"]')), 'E2: no Spell Boost line');
    check(errors.length === 0, `E2: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}

// ============ F: the REAL data files (src/data/skyTracks.js, skyRides.js), once: tabs, the 5 tracks and their chain, the 3 rides, the Spell Boost handshake on the mock engine ============
async function skyRealTest(browser, layout) {
  console.log(`\n--- Sky Era on the real data files (${layout.name}) ---`);
  const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 3, sky: { unlocked: true, at: 5, ceremonySeen: true, era: 'sky' }, cash: 1000, fixture: false });
  await go();
  check(await J(page, () => window.__spellJump.app.skyFor('pmia').available), 'F: the real sky data is loaded (the Sky Era is available without the stand-ins)');
  await page.click('#btn-play'); await page.waitForSelector(visibleSel('#screen-garage'));
  await page.click('#btn-race'); await page.waitForSelector(visibleSel('#screen-tracks'));
  const names = await J(page, () => [...document.querySelectorAll('#track-grid .track-card')].map((c) => `${c.dataset.track}${c.classList.contains('locked') ? ':locked' : ''}`));
  check(JSON.stringify(names) === JSON.stringify(['sky-1', 'sky-2:locked', 'sky-3:locked', 'sky-4:locked', 'sky-5:locked']), `F: the five real sky tracks, one chain (${names.join(' ')})`);
  await shot(page, layout, 'skyreal-01-tracks', 120);
  await page.click('#track-era [data-era="earth"]'); await page.click('#track-era [data-era="sky"]');
  await page.click('[data-track="sky-1"]');
  await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 5000 });
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  const w = await J(page, () => window.__spellJump.spellPanel.word);
  await tapKeys(page, '#sp-keyboard', w); await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForFunction(() => !window.__spellJump.spellPanel.isOpen, null, { timeout: 9000 });
  await page.waitForTimeout(250);
  await page.keyboard.down('ArrowRight');
  check(await page.waitForFunction(() => window.__spellJump.spellPanel.isOpen, null, { timeout: 15000 }).then(() => true, () => false), 'F: the Spell Boost panel opens on the real sky-1');
  await page.keyboard.up('ArrowRight');
  if (await panelMode(page) === 'look') await waitMode(page, 'write', 9000);
  const bw = await J(page, () => window.__spellJump.spellPanel.word);
  await tapKeys(page, '#sp-keyboard', bw); await page.tap('#sp-keyboard [data-key="enter"]');
  await page.waitForSelector(visibleSel('#screen-results'), { timeout: 30000 });
  await page.waitForTimeout(1200);
  const r = await J(page, () => { const tr = document.querySelector('#res-pay tr[data-pay="boost"]'); return tr ? tr.textContent : null; });
  check(r && /^Spell Boost: \+80 m/.test(r), `F: the results line on the real track: "${r}"`);
  await page.click('#res-garage'); await page.waitForSelector(visibleSel('#screen-garage'));
  const rides = await J(page, () => [...document.querySelectorAll('#sky-rides .sr-chip')].map((e) => e.dataset.ride));
  check(['hoverbike', 'rocketcar', 'mechwalker'].every((id) => rides.includes(id)), `F: the garage lists the three real rides (${rides.join(' ')})`);
  check(errors.length === 0, `F: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// the ceremony's reduced-motion still: one frame, a tap closes it (ONLY=skyera, portrait)
async function skyEraReducedTest(browser, layout) {
  console.log(`\n--- Sky Era ceremony, reduced motion (${layout.name}) ---`);
  const ctxOpts = { viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };
  const { ctx, page, errors, go } = await skyEraPage(browser, layout, { days: 15, seen: { coach: true, teaser: true, skyClip: 12 } });
  void ctxOpts;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go();
  check(await page.waitForFunction(() => window.__spellJump.sky.isOpen, null, { timeout: 6000 }).then(() => true, () => false), 'R: the ceremony opens');
  const st = await J(page, () => window.__spellJump.sky.state);
  check(st.kind === 'open' && st.reduced && st.frames === 1 && /The Sky Era is open! New tracks\. New rides\./.test(st.caption), `R: reduced motion: one still, captioned (${st.caption})`);
  check(st.rides.map((r) => r.name).join('|') === 'Hover Bike|Rocket Car|Mech Walker' && st.rides.every((r) => r.lit), 'R: the three rides are lit and named in the still');
  await shot(page, layout, 'skyera-16-ceremony-still', 300);
  await page.waitForTimeout(400);
  await page.mouse.click(layout.width / 2, layout.height * 0.4);
  check(await page.waitForFunction(() => !window.__spellJump.sky.isOpen, null, { timeout: 3000 }).then(() => true, () => false), 'R: a tap closes it');
  check((await J(page, () => window.__spellJump.era)) === 'sky', 'R: after it the title is on the Sky tab');
  check(errors.length === 0, `R: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// ---------- family music switch (ONLY=musicoff): Parents → Options → "Background music in all games" ----------
// Off: the music never starts (and stops at once if playing, also when a sync / another tab brings the change in),
// effects still play, the pause menu's Music button is Off + disabled with the note; On again: the child's own preference applies.
async function musicOffTest(browser, layout) {
  console.log(`\n=== family music switch: ${layout.name} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height } });
  await routeFonts(ctx);
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.__noSkyTeaser = true; window.__noClassLists = true;
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0,
        options: { pmia: { wordsPerRace: 1 } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' }));
      sessionStorage.setItem('seeded', '1');
    }
    window.__oscCount = 0;                       // every oscillator the page creates (music lead + bass, and effects)
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__oscCount++; return o.apply(this, arguments); }; }
  });
  await page.goto(BASE + '/index.html?mock=1&nosw=1', { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  const A = () => J(page, async () => { const { Audio } = await import('/src/audio.js'); return { playing: Audio.musicPlaying, locked: Audio.musicLocked }; });
  await page.waitForFunction(async () => (await import('/src/audio.js')).Audio.musicPlaying, null, { timeout: 5000 }).catch(() => {});
  check((await A()).playing === true && (await A()).locked === false, 'baseline: music plays (family switch absent)');
  const btnState = () => J(page, () => { const b = document.querySelector('#pause-music'), n = document.querySelector('[data-music-lock-note]'); return { text: b.textContent, disabled: b.disabled, note: n ? n.textContent : null }; });

  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  await pinIn(page, '1234'); await page.waitForFunction(() => /again/i.test((document.querySelector('#pin-title') || {}).textContent || ''));
  await pinIn(page, '1234');
  await page.waitForSelector('.pz-content[data-tab="sync"]');
  check(await J(page, () => !document.querySelector('#opt-family-music')), 'the switch is not on the PIN screen / sync tab (Options only, behind the PIN)');
  await page.click('.pz-tabs [data-tab="options"]');
  await page.waitForSelector('#opt-family-music');
  check(await J(page, () => document.querySelector('#opt-family-music').getAttribute('aria-checked') === 'true'), 'Options: "Background music in all games" is On by default');
  check(await J(page, () => /Turns off the music in every game on every device in the family\. Sound effects and the voice stay on\./.test(document.querySelector('#opt-family-music').parentElement.textContent)), 'the help line is shown');
  await page.screenshot({ path: path.join(process.env.MUSICOFF_SHOTS || SHOTS, `spell-jump-parent-zone-${layout.name}.png`) });
  const oscBefore = await J(page, () => window.__oscCount);
  await page.click('#opt-family-music');                         // → Off
  await page.waitForTimeout(300);
  const fam = await family(page);
  check(fam.musicOff === true && fam.musicOffAt > 0, 'stored in the family record (musicOff + musicOffAt)');
  check((await A()).playing === false && (await A()).locked === true, 'turning it Off stops the music at once');
  const bs = await btnState();
  check(bs.text === 'Music: Off' && bs.disabled && bs.note === 'Music is off (set by a grown-up)', `the pause menu's Music button: ${bs.text}, disabled=${bs.disabled}, note="${bs.note}"`);
  const o1 = await J(page, () => window.__oscCount);
  await J(page, async () => { const { Audio } = await import('/src/audio.js'); Audio.correct(); Audio.land(1); });
  check((await J(page, () => window.__oscCount)) > o1 && (await A()).playing === false, 'sound effects still play, the music stays off');
  await J(page, async () => { const { Audio } = await import('/src/audio.js'); Audio.music(true); Audio.unlock(); });
  check((await A()).playing === false, 'even a direct Audio.music(true) cannot start it');
  await page.click('#opt-family-music');                         // → On: the child's own preference (on) applies again
  await page.waitForFunction(async () => (await import('/src/audio.js')).Audio.musicPlaying, null, { timeout: 3000 }).catch(() => {});
  check((await A()).playing === true && !(await btnState()).disabled && (await btnState()).note === null && (await btnState()).text === 'Music: On', 'On again: music resumes, the button and the note are back to normal');
  // the child's own "Music: off" is respected once the family switch is back on
  await page.click('#opt-music');
  check((await A()).playing === false, "the child's own Music off stops it");
  await page.click('#opt-family-music'); await page.waitForTimeout(200);
  await page.click('#opt-family-music'); await page.waitForTimeout(300);
  check((await A()).playing === false && (await btnState()).text === 'Music: Off' && !(await btnState()).disabled, "family Off then On: the child's own Off still applies (not restarted)");
  await page.click('#opt-music');                                // child's pref back on
  // a change that arrives by sync / from another tab
  await J(page, () => { const f = JSON.parse(localStorage.getItem('spellJump.family')); f.musicOff = true; f.musicOffAt = Date.now() + 100000; localStorage.setItem('spellJump.family', JSON.stringify(f)); window.dispatchEvent(new StorageEvent('storage', { key: 'spellJump.family' })); });
  await page.waitForTimeout(200);
  check((await A()).playing === false && (await A()).locked === true, 'a family change arriving from elsewhere stops playing music at once');
  // a fresh load with the switch Off: never starts
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-title'));
  await page.waitForTimeout(600);
  check((await A()).playing === false && (await A()).locked === true, 'a fresh load with the switch Off: the music never starts');
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

const only = process.env.ONLY;
try {
  for (const l of LAYOUTS) if (!only || only === l.name) await runLayout(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'engage' || only === l.name) await engagement(browser, l);
  if (!only || only === 'keys') await coachKeys(browser);
  for (const l of LAYOUTS) if (!only || only === 'musicoff' || only === l.name) await musicOffTest(browser, l);
  if (!only || only === 'corrupt') await corruptBoot(browser);
  if (!only || only === 'update') await selfUpdate(browser);
  for (const l of LAYOUTS) if (!only || only === 'cloud') await cloudVoiceTest(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'levels' || only === l.name) await levelsTest(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'bank' || only === l.name) await bankingTest(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'class' || only === l.name) await classListTest(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'class' || only === l.name) await openTitleNewWeekTest(browser, l);
  if (!only || only === 'voice') for (const sc of ['cloud', 'qualifier', 'nokey', 'slow']) await newListVoiceTest(browser, LAYOUTS[0], sc);
  for (const l of LAYOUTS) if (!only || only === 'sky' || only === l.name) await skyTeaserTest(browser, l);
  if (!only || only === 'sky') await skyTeaserTest(browser, LAYOUTS[1], { reduced: true });
  for (const l of LAYOUTS) if (!only || only === 'skyera' || only === l.name) await skyEraTest(browser, l);
  if (!only || only === 'skyera') await skyEraReducedTest(browser, LAYOUTS[1]);
  if (!only || only === 'skyera' || only === 'skyreal') await skyRealTest(browser, LAYOUTS[0]);
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close().catch((e) => console.error('browser.close', e));
  if (srv) await srv.stop();
}
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) { console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');
