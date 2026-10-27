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
// Class lists (v3.7; ONLY=class): see classListTest below. The other paths set window.__noClassLists (the built-in list).
// Self-update (ONLY=update runs just this): a copy of the app served on another port with the REAL service worker;
// changing sw.js VERSION reloads the page once on the picker (not on the first install), and with the spell panel
// open it only shows "Update ready, restarting soon" and reloads when the run is left; index.html and src/main.js
// are network-first (an edit shows up on the next load while the worker controls the page).
import { execSync, spawn } from 'node:child_process';
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

async function ensureServer() {
  const up = async () => { try { return (await fetch(BASE + '/index.html')).ok; } catch (_) { return false; } };
  if (await up()) return null;
  const srv = spawn('python3', ['-m', 'http.server', '8080'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return srv;
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
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ save, insets }) => {
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
  check(title.buttons.join('|') === 'play|friday test|badges|trophies|parents', `title buttons: ${title.buttons.join(', ')}`);
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
  const wantLines = [/^Speech check · /m, /Spell Jump 3\.\d+\.\d+/, /\[\+\s*\d+ ms\] API present: yes/, /voices: 4 \(3 English, 3 on-device\)/, /chosen voice: Fake US · en-US · localService: true/,
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
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => {
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
    const done = (w, list) => ({ ...near(w, list), firstTry: 3, masteredAt: now - 3600e3 });
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
  check(board.levels.pmia === 'Lv 1' && board.levels.pleo === 'Lv 3', `tiles show the level (${JSON.stringify(board.levels)})`);
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
  check(t.lv === 'Lv 1' && t.lvName === 'Rookie Speller' && t.bar === '90%', `level row: ${t.lv} · ${t.lvName}, bar ${t.bar}`);
  check(!t.crate, 'no crate button while no crate waits');
  check(t.buttons.join('|') === 'play|friday test|badges|trophies|parents', `title buttons: ${t.buttons.join(', ')}`);
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
  check(t.crate === '1 crate' && t.flame === '3' && t.lv === 'Lv 3', `title: "${t.crate}" button, flame ${t.flame}, ${t.lv}`);
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
  b.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await b.addInitScript(({ insets }) => {
    window.__noClassLists = true;
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets });
  await b.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devB', keys: {} })); sessionStorage.setItem('seeded', '1'); } });
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
    await page.addInitScript(() => {
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
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: dir, stdio: 'ignore' });
  const up = async () => { try { return (await fetch(B + '/index.html')).ok; } catch (_) { return false; } };
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  const swFile = path.join(dir, 'sw.js');
  const bump = (v) => writeFileSync(swFile, readFileSync(swFile, 'utf8').replace(/const VERSION = '[^']+';/, `const VERSION = '${v}';`));
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
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
    await ctx.close();
    srv.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function corruptBoot(browser) {
  console.log('\n=== corrupt data boot ===');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
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
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => {
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
  check(save0.selectedCar === 'super' && save0.unlocked.length === 1, `start: Vantablack GT selected, ${save0.unlocked.length} track unlocked`);
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
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets }) => {
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
  await waitMode(page, 'write', 15000);
  const B = await J(page, () => ({ played: window.__cloudPlayed.slice(), spoken: window.__spoken.filter((t) => t !== 'ready'), noteHidden: document.querySelector('#sp-note').hidden }));
  check(JSON.stringify(B.spoken.slice(0, 3)) === JSON.stringify([`The word is, ${w2}.`, info2.sentence, `${w2}.`]) && !B.played.includes(`${w2}.`),
    `no clip for "The word is, ${w2}." → the device voice says the whole presentation (${B.spoken.slice(0, 3).join(' | ')})`);
  check(JSON.stringify(B.played) === JSON.stringify(cloudSpelled(w2)) && B.noteHidden, `the letters still play as clips (${B.played.join(' ')}); the note is gone`);
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

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
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
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(({ insets }) => {
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
    return { id: c.id, name: c.name, pattern: c.pattern, n: c.words.length, words: c.words.map((w) => w.word) };
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
  await shot(page, layout, 'cl-02-words-card');
  await layoutAudit(page, layout.insets, 'parent zone (class list card)');
  await page.click('#pz-class-use');
  await page.waitForSelector('#pz-class-following');
  const mia1 = await activeOf('pmia');
  check(mia1.classId === CL.id && mia1.pattern === CL.pattern && mia1.words.join() === CL.words.join(), `Use for Mia: her active list is the class list with its pattern (${mia1.pattern})`);
  check(await J(page, () => /^Following the class lists ✓/.test(document.querySelector('#pz-class-following').textContent) && !!document.querySelector('#pz-class-stop')), '"Following the class lists ✓ · each new week applies on its own" with "Stop following"');
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
  await page.waitForSelector('#pz-class-use');
  const zoe = await activeOf('pzoe');
  check(!zoe.classId && zoe.words.length === CL.n, 'Stop following: the words stay, the list is no longer a class list');
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

const only = process.env.ONLY;
try {
  for (const l of LAYOUTS) if (!only || only === l.name) await runLayout(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'engage' || only === l.name) await engagement(browser, l);
  if (!only || only === 'keys') await coachKeys(browser);
  if (!only || only === 'corrupt') await corruptBoot(browser);
  if (!only || only === 'update') await selfUpdate(browser);
  for (const l of LAYOUTS) if (!only || only === 'cloud') await cloudVoiceTest(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'levels' || only === l.name) await levelsTest(browser, l);
  for (const l of LAYOUTS) if (!only || only === 'class' || only === l.name) await classListTest(browser, l);
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
