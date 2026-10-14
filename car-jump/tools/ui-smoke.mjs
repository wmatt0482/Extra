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
//   "Why this works") → Options (tile case, voice picker, rate, words before each race) → a 2-word set (first
//   right, second missed and fixed → setLaunchPower(0.825, 1.125), rings carry the missed word, mission +2, both
//   words on the results row) → reload persistence (incl. the chosen voice). Earlier paths use 1 word per race.
// Speech: a word is presented as exactly ["The word is, <word>.", <sentence>, "<word>."] once (Look), again on
// "Hear it"; "Say it again" → "<word>. <word>."; "Syllables" → "neigh, bor.".
// Asserts R1 (no visible element spells the target word while the child spells from memory), R2 (a wrong attempt
// is cleared within 3 s), R6 (each typed letter is spoken by name), keyboard keys ≥ 7 % (landscape) / 9 %
// (portrait) of the viewport width, no console errors, no horizontal overflow, tap targets ≥ 44 px.
// Screenshots every state.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { letterName } from '../src/spelling/words.js';
const spelled = (w) => w.split('').map(letterName);

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
      const o = g.start; g.start = (opts) => { window.__starts.push({ letters: opts.letters, powerScale: opts.powerScale, nitroScale: opts.nitroScale, track: opts.track.id }); return o(opts); };
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
    links: document.querySelectorAll('a[href]').length,
  }));
  check(title.buttons.join('|') === 'play|friday test|badges|parents', `title buttons: ${title.buttons.join(', ')}`);
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
  await layoutAudit(page, layout.insets, 'results (mission)');
  await payoutCheck(page, 'mission run', save);
  await page.click('#res-garage');
  await page.click('#screen-garage [data-back]');
  await page.waitForSelector(visibleSel('#screen-title'));
  check(/mission complete/i.test(await page.textContent('#title-mission-text')), `title chip: "${await page.textContent('#title-mission-text')}"`);
  await shot(page, layout, '15-title-mission');

  // ---------- Parent Zone: set PIN, save a list ----------
  await page.click('#btn-parents');
  await page.waitForSelector(visibleSel('#pz'));
  check(await page.textContent('#pin-title') === 'Choose a 4-digit PIN', 'first open: set a PIN');
  await shot(page, layout, '16-pz-set-pin');
  await layoutAudit(page, layout.insets, 'parent zone (set PIN)');
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForFunction(() => document.querySelector('#pin-title') && /again/i.test(document.querySelector('#pin-title').textContent));
  for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('#pz-words');
  check(!!(await family(page)).pinHash, 'PIN saved (hashed) in spellJump.family');
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
  await page.waitForSelector('#pz-words');
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
  await page.waitForSelector('#pz-words');
  await page.click('#pz-close');
  await J(page, () => window.__spellJump.pz.lock());
  await page.click('#btn-parents');
  for (const d of '4321') await page.click(`.pinpad [data-digit="${d}"]`);
  await page.waitForSelector('#pz-words');
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
  await page.waitForSelector('#pz-words');
  await page.click('.pz-tabs [data-tab="report"]');
  await page.waitForSelector('#pz-table');
  const rep = await J(page, () => ({
    pre: document.querySelector('[data-score="pretest"] b').textContent, latest: document.querySelector('[data-score="latest"] b').textContent,
    rows: document.querySelectorAll('#pz-table tbody tr').length, hist: document.querySelectorAll('.pz-hist .row').length,
  }));
  check(/^3 \/ 4/.test(rep.pre) && /^3 \/ 4/.test(rep.latest) && rep.rows === 4 && rep.hist === 2, `report: pretest ${rep.pre}, latest ${rep.latest}, ${rep.rows} word rows, ${rep.hist} tests`);
  await shot(page, layout, '34-pz-report');
  await layoutAudit(page, layout.insets, 'parent zone (report)');
  if (!layout.clipboard) await J(page, () => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await page.click('#pz-copy-report');
  await page.waitForTimeout(400);
  if (layout.clipboard) {
    const clip = await J(page, () => navigator.clipboard.readText());
    check(/Spell Jump report: Sam/.test(clip) && /Pretest \(Qualifier\): 3\/4/.test(clip), 'Copy report → clipboard');
  } else {
    const fb = await J(page, () => ({ shown: !document.querySelector('#pz-report-text').hidden, sel: String(window.getSelection()) }));
    check(fb.shown && /Spell Jump report: Sam/.test(fb.sel), 'Copy report: clipboard unavailable → the report text is shown selected');
    await shot(page, layout, '35-pz-report-fallback');
  }
  await page.click('.pz-tabs [data-tab="options"]');
  await page.waitForSelector('#opt-case');
  await shot(page, layout, '36-pz-options');
  await layoutAudit(page, layout.insets, 'parent zone (options)');
  await page.click('#opt-case [data-value="upper"]');
  check((await family(page)).options[pid].tileCase === 'upper', 'option saved: tile case ABC');
  // voice picker: English voices ranked (Enhanced first, novelty last, French left out), ▶ Test, choose one
  const vp = await J(page, () => ({ rows: [...document.querySelectorAll('#opt-voices [data-voice-row]')].map((r) => r.dataset.voiceRow), now: document.querySelector('#opt-voice-now').textContent, tip: (document.querySelector('#opt-voice-tip') || {}).textContent || '' }));
  check(vp.rows.join('|') === '|Samantha (Enhanced)|Fake US|Fred' && /Samantha \(Enhanced\)/.test(vp.now), `voice list: Automatic, ${vp.rows.slice(1).join(', ')} (${vp.now})`);
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

async function corruptBoot(browser) {
  console.log('\n=== corrupt data boot ===');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
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

const srv = await ensureServer();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const only = process.env.ONLY;
try {
  for (const l of LAYOUTS) if (!only || only === l.name) await runLayout(browser, l);
  if (!only || only === 'corrupt') await corruptBoot(browser);
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
