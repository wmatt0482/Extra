// Playwright smoke test of Case Files, portrait 390x844 and landscape 844x390 (iPhone safe-area insets faked), from the repo root:
//   bash build.sh && (cd dist && python3 -m http.server 8741 &)      then      BASE_URL=http://localhost:8741 node case-files/tools/ui-smoke.mjs
//   (ONLY=portrait | landscape runs one part; SHOTS_DIR=... keeps the screenshots at deviceScaleFactor 2)
// The page runs on the fixture content (tools/fixtures/, served in place of src/content/ by a route), so this test does not depend on
// the final cases. With a MOCKED voice backend (window.__cloudVoiceBackend: no network, no WebAudio) and a SPY on the device voice
// (window.__ttsBackend) it plays Detective Training end to end and Erie case 1: the picker, the agency home, the briefing with the
// pre-taught words, the documents (listen buttons, sentence highlight, "Read it to me" by default for the stretch document), pinning
// evidence with a wrong tap -> hint tiers 1, 2, 3, the cork board, a misplaced timeline card (and a drag), a wrong accusation, the
// case report (the partner asks once), the CASE CLOSED screen (never starts the next case), the pacing (one new case a day, the
// parent opens the next one early), the Parent Zone (PIN, rank labels, reports, accuracy, hints, listens, words met, "Talking with
// school"), the Lab payout, reload persistence, a kid-rule audit, the layout audit (no horizontal scroll), the device voice never
// used and no console errors.
// v0.1.2: the step coach cards (each step once on first play, not again; the "?" help button reopens the current step's card) and the
// feedback popups (a wrong pin, a misplaced card, a wrong accusation, a clue that does not prove it, a short report, the voice-not-ready
// note: one popup at a time, Enter / Escape / the button close it, focus comes back, the hint highlight / board / picker appear AFTER it).
// v0.1.3: fb-right / fb-wrong classes and the chime / boop on every checked tap (word taps, pins, cards, name, clue, report); the Hint
// button always opens a popup; the physical keyboard types into the in-game field; word chips; the report frame (lead, no orphan period);
// a harder document is a bonus unless an answer is in it; no rank on a child screen; "Solve it again" (no payout, only `replays`).
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CASE_BY_ID, TRAINING } from './fixtures/index.js';
import { runMusicOffCheck } from '../../car-jump/tools/music-off-check.mjs';   // the family music switch (Parents → Options)
import { COACH } from '../src/logic/coach.js';
import { LINES } from '../src/logic/lines.js';
import { wordChips } from '../src/logic/report.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:8741';
const URL0 = BASE + '/case-files/index.html?nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'case-files-ui-shots');
mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.ONLY || '';

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const LAYOUTS = [
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 } },
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 } },
].filter((l) => !ONLY || l.name === ONLY);
// words a kid must never see (SPEC section 1); the Parent Zone is for grown-ups and is left out
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|only \d+ left|game over|lose|lost|fail(ed)?|gun|blood|energy|percent)\b|\d+\s?%/i;

async function routeFonts(ctx) {
  const cache = new Map();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!cache.has(url)) cache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: cache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
}
const J = (page, fn, arg) => page.evaluate(fn, arg);
const visibleSel = (sel) => `${sel}:not([hidden])`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, layout, name, wait = 350) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}

async function audit(page, insets, label) {
  const r = await J(page, ({ insets }) => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    const visible = (el) => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const inScroller = (el) => { for (let p = el.parentElement; p && p.id !== 'app'; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return p; } return null; };
    const desc = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('#backdrop, #toasts, .flyer, .ghost') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (!inScroller(el) && (b.right > W + 1 || b.left < -1)) out.push(`h-overflow ${desc(el)} [${Math.round(b.left)}..${Math.round(b.right)}]`);
      if (!inScroller(el) && (b.bottom > H + 1 || b.top < -1)) out.push(`v-overflow ${desc(el)} [${Math.round(b.top)}..${Math.round(b.bottom)}]`);
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push(`clipped text ${desc(el)}`);
    }
    for (const b of document.querySelectorAll('#app button, #app a[href]')) {
      if (!visible(b)) continue;
      const q = b.getBoundingClientRect();
      if (!q.width) continue;
      const sc = inScroller(b);
      if (b.classList.contains('kb-key') ? (q.height < 44 || q.width < W * 0.07) : Math.min(q.width, q.height) < 44) out.push(`tap target ${Math.round(q.width)}x${Math.round(q.height)} ${desc(b)}`);
      if (!sc && q.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)}`);
      if (!sc && (q.left < insets.l - 1 || q.right > W - insets.r + 1)) out.push(`inside side inset ${desc(b)}`);
      if (!sc && q.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    // passage text: >= 18 px, line-height >= 1.5
    for (const p of document.querySelectorAll('.para p')) {
      if (!visible(p)) continue;
      const cs = getComputedStyle(p), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
      if (fs < 18 || lh / fs < 1.5) out.push(`passage text ${fs}px / ${lh}px`);
      break;
    }
    const natives = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')].filter((e) => !e.closest('#pz'));
    const links = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin).map((a) => a.href);
    return { out, natives: natives.map(desc), links };
  }, { insets });
  check(r.out.length === 0, `${label}: layout clean (no overflow, targets >= 44 px, passage text >= 18 px, clear of insets)${r.out.length ? ' — ' + r.out.slice(0, 6).join('; ') : ''}`);
  check(r.natives.length === 0, `${label}: no native inputs outside the Parent Zone${r.natives.length ? ' — ' + r.natives.join(', ') : ''}`);
  check(r.links.length === 0, `${label}: no links to another origin${r.links.length ? ' — ' + r.links.join(', ') : ''}`);
}
// every word a kid can see right now (outside the Parent Zone), for the kid-rule audit
const kidText = (page) => J(page, () => {
  const out = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(c.textContent); else if (c.nodeType === 1 && c.id !== 'pz' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE' && !c.closest('#backdrop') && !(c.closest('.doc-text'))) { if (c.getAttribute('aria-label')) out.push(c.getAttribute('aria-label')); walk(c); } } };
  walk(document.querySelector('#app'));
  return out.join(' ').replace(/\s+/g, ' ');
});
async function kidAudit(page, label) {
  const t = await kidText(page);
  const m = t.match(BANNED);
  check(!m, `${label}: no banned or pressure words on screen${m ? ` (found "${m[0]}")` : ''}`);
}

// ---------- driving the game ----------
const state = (page) => J(page, () => { const g = window.__caseFiles; return { screen: g.screen, beat: g.run && g.run.beat }; });
const waitScreen = (page, name, ms = 8000) => page.waitForSelector(`#screen-${name}:not([hidden])`, { timeout: ms });
const waitBeat = (page, beat, ms = 8000) => page.waitForFunction((b) => { const g = window.__caseFiles; return g.screen === 'case' && g.run && g.run.beat === b; }, beat, { timeout: ms });
async function typeText(page, text) {
  for (const ch of text.toLowerCase()) {
    const key = ch === ' ' ? 'space' : ch;
    await page.click(`#case-kb .kb-key[data-key="${key}"]`);
  }
}
const pressEnter = (page) => page.click('#case-kb .kb-key[data-key="enter"]');
const textOf = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const exists = (page, sel) => page.$(sel).then((e) => !!e);
const played = (page) => J(page, () => window.__cloudPlayed.slice());
// ---- the modal: coach cards and feedback popups (v0.1.2) ----
const modalCount = (page) => page.$$eval('.modal-wrap', (m) => m.length);
const modalInfo = (page) => J(page, () => { const w = document.querySelector('.modal-wrap'); if (!w) return null; const c = w.querySelector('.modal-card'); return { kind: w.dataset.kind, id: w.dataset.id || '', who: w.dataset.who, text: w.querySelector('.modal-text').textContent.trim(), button: w.querySelector('.modal-go').textContent.trim(), title: (w.querySelector('.modal-title') || {}).textContent || '', role: c.getAttribute('role'), modal: c.getAttribute('aria-modal'), focus: document.activeElement === w.querySelector('.modal-go'), inert: [...document.querySelectorAll('#app > .screen')].every((e) => e.hasAttribute('inert')) }; });
const waitModal = (page, kind) => page.waitForSelector(`.modal-wrap${kind ? `[data-kind="${kind}"]` : ''}`, { timeout: 5000 });
const closeModal = async (page, how = 'button') => {
  await waitModal(page);
  if (how === 'button') await page.click('.modal-go'); else await page.keyboard.press(how);
  await page.waitForFunction(() => !document.querySelector('.modal-wrap'), null, { timeout: 4000 });
};
// ---- v0.1.3: instant feedback classes and sounds, the physical keyboard ----
const fbClear = (page) => J(page, () => { window.__fb.length = 0; window.__snd.correct = 0; window.__snd.oops = 0; });
const fbSeen = (page, k) => J(page, (k) => window.__fb.some((x) => x.startsWith(k + ':')), k);
const fbOn = (page, k, what) => J(page, ([k, what]) => window.__fb.some((x) => x.startsWith(k + ':') && x.includes(what)), [k, what]);
const sounds = (page) => J(page, () => ({ ...window.__snd }));
const answerText = (page) => textOf(page, '#answer-box');
const voiceToasts = (page) => page.$$eval('#toasts .toast', (t) => t.filter((x) => /voice/i.test(x.textContent)).length);
const noModal = async (page, label) => check((await modalCount(page)) === 0, label);
// a step's coach card shows by itself the first time: right card, right voice, role/focus, then "Got it"
async function expectCoach(page, layout, key, { shotName, voiced = true } = {}) {
  await waitModal(page, 'coach');
  const m = await modalInfo(page), c = COACH[key];
  check(m.id === `coach-${key}` && m.title === c.title && m.button === 'Got it' && m.who === c.who, `the ${key} coach card opens by itself on first play ("${m.title}", ${m.who}, button "${m.button}")`);
  check(m.role === 'dialog' && m.modal === 'true' && m.focus && m.inert, `${key} coach: role=dialog aria-modal, focus on the button, the screen behind is inert`);
  check(c.lines.every((l) => m.text.includes(l)), `${key} coach: the lines are on the card (${c.lines.length} short sentences)`);
  check(await page.$eval('.modal-wrap .coach-art svg', () => true).catch(() => false), `${key} coach: has its picture`);
  if (voiced) { await page.waitForFunction((t) => window.__cloudPlayed.includes(t), c.lines[0], { timeout: 5000 }); check(true, `${key} coach: spoken in the natural voice (a clip)`); }
  await audit(page, layout.insets, `${key} coach card`); await kidAudit(page, `${key} coach card`);
  if (shotName) await shot(page, layout, shotName, 500);
  await closeModal(page);
}
// the "?" button always reopens the current step's card
async function expectHelp(page, layout, sel, key) {
  check((await page.getAttribute(sel, 'aria-label')) === 'How this step works' && (await textOf(page, sel)) === '?', `the help button (${sel}) is a "?" with the label "How this step works"`);
  await page.click(sel);
  await waitModal(page, 'coach');
  check((await modalInfo(page)).id === `coach-${key}`, `the help button reopens the ${key} coach card`);
  await closeModal(page);
}

async function doBrief(page, k) {
  await waitBeat(page, 'brief');
  for (const w of k.words.slice(0, 3)) {
    if (!(await exists(page, `.wordcard[data-word="${w.word}"]`))) continue;
    await page.click(`.wordcard[data-word="${w.word}"] .tok[data-right="1"]`);
  }
  await page.click('#brief-go');
  await waitBeat(page, 'investigate');
}
async function doDesk(page, k, { listenShot } = {}) {
  for (const d of k.docs) {
    await page.click(`.docfolder[data-doc="${d.id}"]`);
    await page.waitForSelector(`.doc[data-doc="${d.id}"]`);
    if (listenShot && d.id === k.docs[0].id) await listenShot();
    await page.click('#doc-back');
    await page.waitForSelector('#open-notebook');
  }
  await page.click('#open-notebook');
  await waitBeat(page, 'pin');
}
async function openDocTab(page, k, docId) {
  const on = await J(page, (id) => !!document.querySelector(`.doc[data-doc="${id}"]`), docId);
  if (!on) await page.click(`.doc-tab[data-doc="${docId}"]`);
  await page.waitForSelector(`.doc[data-doc="${docId}"]`);
}
const docIdOf = (k, sid) => k.docs.find((d) => d.paragraphs.some((p) => p.some((s) => s.id === sid))).id;
async function pickSentence(page, k, sid) {
  await openDocTab(page, k, docIdOf(k, sid));
  await page.click(`.doc.pick .s[data-id="${sid}"]`);
}
async function pinAnswer(page, k, q) {
  for (const id of q.answer) {
    await pickSentence(page, k, id);
    await page.click('#nb-pin');
  }
  await page.waitForSelector('#nb-why');
}
async function pinAll(page, k, { skip = [] } = {}) {
  for (const q of k.questions) {
    if (!skip.includes(q.id)) await pinAnswer(page, k, q);
    await page.click('#nb-next');
    await sleep(60);
  }
}
async function doRebuild(page, k, { misplace = false, drag = false } = {}) {
  await waitBeat(page, 'rebuild');
  const items = k.timeline.items, open = items.map((it, i) => (k.timeline.given.includes(i) ? -1 : i)).filter((i) => i >= 0);
  if (misplace && open.length > 1) {
    const card = items[open[1]].id;
    await page.click(`[data-card="${card}"]`);
    await page.click(`.slot[data-slot="${open[0]}"]`);
    await closeModal(page);                                  // the partner's popup for the misplaced card
  }
  for (let n = 0; n < open.length; n++) {
    const i = open[n];
    const card = items[i].id;
    if (drag && n === 0) {
      await page.locator(`[data-card="${card}"]`).scrollIntoViewIfNeeded(); await page.locator(`.slot[data-slot="${i}"]`).scrollIntoViewIfNeeded();
      const a = await page.locator(`[data-card="${card}"]`).boundingBox(), b = await page.locator(`.slot[data-slot="${i}"]`).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2 + 14, a.y + a.height / 2 + 14, { steps: 3 });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up();
    } else {
      await page.click(`[data-card="${card}"]`);
      await page.click(`.slot[data-slot="${i}"]`);
    }
    await sleep(40);
  }
  await page.waitForSelector('#tl-go:not([hidden])', { timeout: 6000 });
}

// ================================ one layout ================================
async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await routeFonts(ctx);
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsNetwork = 0;
  await ctx.route('**/api/tts/**', (r) => { ttsNetwork++; return r.abort(); });
  // the page runs on the fixtures, not on whatever src/content/ holds
  await ctx.route('**/case-files/src/content/**', async (route) => {
    const rel = new URL(route.request().url()).pathname.split('/case-files/src/content/')[1];
    try { await route.fulfill({ status: 200, body: readFileSync(path.join(here, 'fixtures', rel)), contentType: 'text/javascript' }); } catch (_) { await route.fulfill({ status: 404, body: '' }); }
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|ERR_INTERNET|net::ERR/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets }) => {
    if (!sessionStorage.getItem('cfSeeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }, { id: 'pleo', name: 'Leo', color: '#ff8a1f', createdAt: now, updatedAt: now }],
        pinHash: null, pinUpdatedAt: 0, options: { pmia: { cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: null }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devC', keys: {} }));
      sessionStorage.setItem('cfSeeded', '1');
    }
    { const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => st(f, ms === 20000 ? 400 : ms, ...a); }   // the ranks 1-3 idle hint (20 s) takes 0.4 s in this test
    window.__fakeNow = 0;
    window.__caseFilesNow = () => Date.now() + window.__fakeNow;
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__playMs = 12; window.__spoken = [];
    // v0.1.3: record every fb-right / fb-wrong class that appears (they clear themselves after ~0.7 s) and count the feedback sounds
    window.__fb = []; window.__snd = { correct: 0, oops: 0 };
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((ms) => { for (const m of ms) { const c = m.target.classList; for (const k of ['fb-right', 'fb-wrong']) if (c && c.contains(k)) window.__fb.push(k + ':' + (m.target.id || m.target.className)); } })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    // a SPY on the device voice: Case Files must never use it
    window.__ttsBackend = {
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); },
      cancel() {}, addEventListener() {},
    };
    if (window.speechSynthesis) { const orig = window.speechSynthesis.speak.bind(window.speechSynthesis); window.speechSynthesis.speak = (u) => { window.__spoken.push('native:' + String(u.text).trim()); return orig(u); }; }
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        const clips = {};
        for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.02 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), window.__playMs)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets });

  // ---------- the picker ----------
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  check((await textOf(page, '#screen-players h2')) === "Who's on the case?", 'the picker heading is "Who\'s on the case?"');
  check(await exists(page, '#btn-home') && (await textOf(page, '#btn-home')).includes('Learning Lab') && await exists(page, '#btn-parents-picker'), 'top bar: the Learning Lab chip (left) and the Parents chip (right)');
  check(await exists(page, '[data-player="pmia"]') && await exists(page, '[data-player="pleo"]') && await exists(page, '#pl-add'), 'player cards (from the family) and the dashed New player card');
  await kidAudit(page, 'picker'); await audit(page, layout.insets, 'picker');
  check(!/\brank\b/i.test(await kidText(page)) && !/rank/i.test(await page.$eval('[data-player="pmia"]', (e) => e.getAttribute('aria-label'))), 'v0.1.3: the Detective Rank is not shown or announced on the picker (it is a Parent Zone setting)');
  await page.waitForSelector('#player-grid #lab-picker-btn', { timeout: 8000 }).catch(() => {});
  const pb = await J(page, () => { const b = document.querySelector('#player-grid #lab-picker-btn'); return b ? { last: b === document.querySelector('#player-grid').lastElementChild, h: b.getBoundingClientRect().height, txt: b.textContent, links: document.querySelectorAll('.pl-other, #btn-spelljump, #btn-wagonwest').length } : null; });
  check(pb && pb.last && pb.h >= 44 && /The Lab/.test(pb.txt) && pb.links === 0, 'v0.1.4: the picker has the Lab\'s own "The Lab" button, last in the players\' block, and no partial Spell Jump / Wagon West links');
  await shot(page, layout, '01-picker');
  await page.click('#pl-add');
  await page.waitForSelector(visibleSel('#screen-newplayer'));
  await page.click('#np-kb .kb-key[data-key="z"]'); await page.click('#np-kb .kb-key[data-key="o"]'); await page.click('#np-kb .kb-key[data-key="e"]');
  check((await textOf(page, '#np-name')) === 'Zoe', 'a new player is typed on the in-game keyboard');
  await page.click('[data-back="players"]');
  await page.waitForSelector(visibleSel('#screen-players'));
  check(!(await exists(page, '[data-player="pzoe"]')), 'going back does not create the player');

  // ---------- the agency home ----------
  await page.click('[data-player="pmia"]');
  await waitScreen(page, 'home');
  await expectCoach(page, layout, 'home', { shotName: '02a-coach-home' });
  await expectHelp(page, layout, '#btn-help-home', 'home');
  await page.waitForSelector('#lab-slot-home .lab-chipx', { timeout: 8000 });
  const chip = await J(page, () => { const c = document.querySelector('#lab-slot-home .lab-chipx'); const r = c.getBoundingClientRect(); const m = c.querySelector('.lab-chipx-main').getBoundingClientRect(); const pc = document.querySelector('#btn-player').getBoundingClientRect(); return { left: r.left, top: r.top, h: m.height, compact: c.classList.contains('compact'), txt: c.textContent, first: r.top < pc.top || r.left < pc.left, n: document.querySelectorAll('.lab-chipx').length, old: !!document.querySelector('#btn-thelab'), pill: !!document.querySelector('#screen-home .lab-pill, #screen-home .lab-hud'), w: innerWidth, flames: document.querySelectorAll('#screen-home .lab-chipx-flame').length, bare: /(?<!Lab )\bLV\b/.test(document.querySelector("#screen-home").textContent) }; });
  check(chip.n === 1 && chip.flames === 1 && !chip.old && !chip.pill && /Lab LV \d+/.test(chip.txt) && chip.h >= 44 && chip.top < 80 && chip.left < 80 && chip.first && chip.compact === (chip.w < 520), `v0.1.4: ONE Lab chip top-left of the agency home (${Math.round(chip.left)},${Math.round(chip.top)}), "Lab LV n", ${chip.compact ? 'compact' : 'full'} at ${chip.w} px, before the player chip, the one flame; no star button, no LAB LV pill`);
  check(!chip.bare, 'v0.1.4: no bare "LV" on the agency home');
  const sum = await J(page, () => { const d = window.__lab.store.doc(); return d && d.sum && d.sum.cf; });
  check(sum && /^Detective: \d+ cases? closed$/.test(sum.level) && /^Erie Canal: \d+ \/ \d+$/.test(sum.line) && /^(New case ready|Next case tomorrow|All cases closed)$/.test(sum.today), `v0.1.4: the Lab's summary for Case Files: "${sum && sum.level}" · "${sum && sum.line}" · "${sum && sum.today}"`);
  await page.click('#lab-chip-games');
  await page.waitForSelector('#lab-games-panel');
  const gp = await J(page, () => ({ n: document.querySelectorAll('#lab-games-panel .lab-gp-row').length, here: (document.querySelector('#lab-games-panel .lab-gp-row.here') || {}).dataset && document.querySelector('#lab-games-panel .lab-gp-row.here').dataset.game, cf: ((document.querySelector('#lab-games-panel [data-game="cf"] small') || {}).textContent || '') }));
  check(gp.n === 8 && gp.here === 'cf' && /Detective/.test(gp.cf), `v0.1.4: the chip's Games button opens the six-game panel, Case Files highlighted with "${gp.cf}"`);
  await shot(page, layout, '02-games');
  await page.click('#lab-games-close');
  await page.waitForFunction(() => !document.querySelector('#lab-games-panel'));
  // the Lab's looks are drawn on the detective: a deerstalker, a trench coat and a gold badge change the home chip's avatar (and the picker tile's)
  const px = () => J(page, () => document.querySelector('#home-avatar').toDataURL());
  const plain = await px();
  await J(page, () => { window.__lab.grantCoins(9000); for (const id of ['cf.hat.deerstalker', 'cf.coat.trench', 'cf.badge.goldbadge', 'cf.hat.detcap', 'cf.coat.tweed', 'cf.badge.magnifier']) window.__lab.store.buy(id); });
  const seen = {};
  for (const [slot, id] of [['cf.hat', 'cf.hat.detcap'], ['cf.hat', 'cf.hat.deerstalker'], ['cf.coat', 'cf.coat.tweed'], ['cf.coat', 'cf.coat.trench'], ['cf.badge', 'cf.badge.magnifier'], ['cf.badge', 'cf.badge.goldbadge']]) {
    await J(page, ([sl, i]) => window.__lab.store.equip(sl, i), [slot, id]);
    await page.waitForTimeout(200);
    seen[id] = await px();
    await J(page, ([sl]) => window.__lab.store.equip(sl, null), [slot]);
  }
  const imgs = Object.values(seen);
  check(imgs.every((u) => u !== plain) && new Set(imgs).size === 6, 'v0.1.4: each of the six Lab looks changes the detective drawn on the agency home chip, and each looks different');
  await J(page, () => { window.__lab.store.equip('cf.hat', 'cf.hat.deerstalker'); window.__lab.store.equip('cf.coat', 'cf.coat.trench'); window.__lab.store.equip('cf.badge', 'cf.badge.goldbadge'); });
  await page.waitForTimeout(300);
  await shot(page, layout, '02b-home-looks');
  await J(page, () => { for (const sl of ['cf.hat', 'cf.coat', 'cf.badge']) window.__lab.store.equip(sl, null); });
  const home1 = await J(page, () => Object.fromEntries([...document.querySelectorAll('.case-card')].map((c) => [c.dataset.case, c.dataset.state])));
  check(home1.training === 'new' && home1['erie-01'] === 'new' && home1['erie-02'] === 'sealed', `day 1: Training and Erie case 1 are open, case 2 is sealed (${JSON.stringify(home1)})`);
  check((await textOf(page, '.folder[data-tab="Training"] h3')) === 'Detective Training' && (await exists(page, '.folder[data-tab="Erie Canal"]')), 'the case board: Detective Training first, then the Erie Canal folder');
  check(!(await exists(page, '#next-note')), 'no "next case" note while a case is waiting to be played');
  const sealedText = await textOf(page, '.case-card.sealed');
  check(!sealedText.includes('Mule'), 'a sealed file does not show its title');
  await kidAudit(page, 'home'); await audit(page, layout.insets, 'home');
  check(!/\brank\b/i.test(await kidText(page)), 'v0.1.3: no rank anywhere on the agency home');
  await J(page, () => { const a = window.__caseFiles.app.audio; for (const k of ['correct', 'oops']) { const o = a[k].bind(a); a[k] = (...x) => { window.__snd[k]++; return o(...x); }; } });   // count the feedback sounds
  await shot(page, layout, '02-agency-home');

  // ---------- Detective Training: the briefing ----------
  await page.click('.case-card[data-case="training"]');
  await waitBeat(page, 'brief');
  await expectCoach(page, layout, 'brief', { shotName: '02b-coach-brief' });
  await page.waitForFunction((t) => window.__cloudAsked.some((a) => a.texts.includes(t)), TRAINING.briefing[0].text, { timeout: 5000 });
  const asked0 = await J(page, () => window.__cloudAsked.flatMap((a) => a.texts));
  check(asked0.includes(TRAINING.objective) && asked0.includes(TRAINING.closing.text) && !asked0.some((t) => /Missing Toll Ticket|towpath|Ruth Ann/.test(t)), `the voice prepares only this case's lines (${asked0.length} texts, none from the Erie cases)`);
  check(await J(page, () => window.__cloudAsked.every((a) => a.code === 'ABCD-2345' && a.texts.length <= 80)), 'clips are asked for with the family code, at most 80 a request');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), TRAINING.briefing[0].text, { timeout: 6000 });
  check(true, 'the Chief\'s briefing is voiced (a clip, line by line)');
  check((await textOf(page, '.objective p')) === TRAINING.objective, 'the objective is shown');
  check((await page.$$('.wordcard')).length === 2 && (await J(page, () => document.querySelector('#brief-go').disabled)), 'the case words are pre-taught (2 for this case) and "Start investigating" waits for them');
  const w0 = TRAINING.words[0];
  await fbClear(page);
  await page.click(`.wordcard[data-word="${w0.word}"] .tok[data-right="0"]`);
  check(!(await exists(page, `.wordcard[data-word="${w0.word}"] .wc-mean`)), 'tapping the wrong word in the sentence shows no meaning and no penalty');
  check((await fbOn(page, 'fb-wrong', 'tok')) && !(await fbSeen(page, 'fb-right')) && (await sounds(page)).oops === 1 && (await sounds(page)).correct === 0, 'v0.1.3: a wrong word tap gets fb-wrong (a gentle shake) and the soft low boop, no popup');
  check(!(await exists(page, '.modal-wrap')), 'a wrong word tap has no popup (the shake and boop are the feedback)');
  await fbClear(page);
  await page.click(`.wordcard[data-word="${w0.word}"] .tok[data-right="1"]`);
  check((await textOf(page, `.wordcard[data-word="${w0.word}"] .wc-mean`)).includes(w0.meaning), 'tapping the right word shows what it means');
  check((await fbOn(page, 'fb-right', 'tok')) && !(await fbSeen(page, 'fb-wrong')) && (await sounds(page)).correct === 1, 'v0.1.3: the right word tap gets fb-right (a gold flash) and the soft chime');
  await page.waitForFunction((t) => window.__cloudPlayed.some((x) => x.startsWith(t)), w0.word, { timeout: 4000 });
  await kidAudit(page, 'briefing'); await audit(page, layout.insets, 'briefing');
  await shot(page, layout, '03-briefing');
  await expectHelp(page, layout, '#case-help', 'brief');
  await doBrief(page, TRAINING);
  await expectCoach(page, layout, 'read', { shotName: '03a-coach-read' });
  await expectHelp(page, layout, '#case-help', 'read');

  // ---------- investigate: the desk, a document with a highlighted sentence, "Read it to me" ----------
  check((await page.$$('.docfolder')).length === 2 && (await exists(page, '.docfolder .tag.stretch')), 'the desk shows the documents; the harder one carries the tag.stretch');
  check((await textOf(page, '.docfolder .tag.stretch')) === 'Harder · needed' && (await textOf(page, '#desk-note')).includes('has a clue you need'), 'v0.1.3: a harder document that holds an answer says so on the desk ("Harder · needed")');
  check(await J(page, () => document.querySelector('#open-notebook').disabled), 'the notebook waits until every document has been opened');
  await kidAudit(page, 'desk'); await audit(page, layout.insets, 'desk');
  const d1 = TRAINING.docs[0], d2 = TRAINING.docs[1];
  const beforeD1 = (await played(page)).length;
  await page.click(`.docfolder[data-doc="${d1.id}"]`);
  await page.waitForSelector(`.doc[data-doc="${d1.id}"]`);
  await sleep(700);
  check((await played(page)).length === beforeD1 && (await page.getAttribute('.toggle-btn', 'aria-pressed')) === 'false', 'a core document is silent at rank 4 (listen buttons only)');
  await J(page, () => { window.__playMs = 1400; });
  await page.click(`.doc[data-doc="${d1.id}"] .say-btn[data-para="0"]`);
  await page.waitForSelector('.doc .s.speaking', { timeout: 4000 });
  const speakingId = await page.$eval('.doc .s.speaking', (e) => e.dataset.id);
  check(speakingId === d1.paragraphs[0][0].id, `the listen button highlights the sentence being read (${speakingId})`);
  await shot(page, layout, '04-document-highlight', 120);
  await page.waitForFunction((n) => window.__cloudPlayed.length >= n, beforeD1 + 3, { timeout: 8000 });
  const seq = (await played(page)).slice(beforeD1, beforeD1 + 3);
  check(JSON.stringify(seq) === JSON.stringify(d1.paragraphs[0].map((s) => s.text)), 'a paragraph plays its sentences in order, one clip each');
  await J(page, () => { window.__playMs = 12; });
  await page.waitForFunction(() => !document.querySelector('.doc .s.speaking'), null, { timeout: 5000 });
  await audit(page, layout.insets, 'document');
  await page.click('#doc-back');
  const beforeD2 = (await played(page)).length;
  await page.click(`.docfolder[data-doc="${d2.id}"]`);
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), d2.paragraphs[0][0].text, { timeout: 5000 });
  check((await page.getAttribute('.toggle-btn', 'aria-pressed')) === 'true' && (await played(page)).length > beforeD2, 'the stretch document opens with "Read it to me" on, and reads');
  await page.click('.toggle-btn');
  check((await page.getAttribute('.toggle-btn', 'aria-pressed')) === 'false', '"Read it to me" can be switched off');
  await page.click('#doc-back');
  await page.click('#open-notebook');
  await waitBeat(page, 'pin');
  await expectCoach(page, layout, 'pin', { shotName: '04a-coach-pin' });
  await expectHelp(page, layout, '#case-help', 'pin');

  // ---------- pin the evidence: a wrong tap opens the partner's popup (hint tiers 1, 2, 3) ----------
  const q1 = TRAINING.questions[0];
  check((await textOf(page, '#nb-q')) === q1.prompt, 'the partner\'s notebook asks one question at a time');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q1.prompt, { timeout: 4000 });
  await sleep(900);
  check(!(await exists(page, '#nb-hint')), 'rank 4: the partner does not offer a hint by herself');
  check(await J(page, () => document.querySelector('#nb-pin').disabled), 'Pin it waits for a tapped sentence');
  const wrongId = 'd1s6';
  await pickSentence(page, TRAINING, wrongId);
  check((await page.$eval(`.s[data-id="${wrongId}"]`, (e) => e.classList.contains('sel'))), 'a tapped sentence is selected (not pinned yet)');
  await fbClear(page);
  await page.click('#nb-pin');
  check(await page.waitForFunction(() => window.__fb.some((x) => x.startsWith('fb-wrong:')) && !document.querySelector('.modal-wrap'), null, { timeout: 2000 }).then(() => true).catch(() => false), 'v0.1.3: a wrong pin first shakes the tapped sentence (fb-wrong), THEN the popup opens');
  await waitModal(page, 'feedback');
  check((await fbOn(page, 'fb-wrong', ':s ')) && (await sounds(page)).oops === 1, 'the wrong sentence got fb-wrong and the soft boop played once');
  let pm = await modalInfo(page);
  check(pm.text.includes(LINES.pinMiss1) && pm.text.includes(q1.hint) && pm.button === 'Try again' && pm.who === 'partner' && pm.role === 'dialog' && pm.modal === 'true', `a wrong tap opens a popup: "${pm.text}" (button "${pm.button}")`);
  check(!/wrong|incorrect/i.test(pm.text) && !(await page.$('.modal-wrap .coach-art')), 'the popup is kind: never "wrong", never "incorrect"');
  check((await modalCount(page)) === 1 && pm.focus && pm.inert, 'one popup, focus on its button, the screen behind is inert');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q1.hint, { timeout: 4000 });
  check(true, 'the popup is voiced (the guiding question, a clip)');
  await audit(page, layout.insets, 'popup tier 1'); await kidAudit(page, 'popup tier 1');
  await shot(page, layout, '05b-popup-wrong-pin', 400);
  await closeModal(page);
  check((await textOf(page, '#nb-hint')).includes(q1.hint) && (await page.getAttribute('#nb-hint', 'data-tier')) === '1', 'after the popup: the partner\'s guiding question stays in the notebook (hint tier 1)');
  check(!(await exists(page, '#nb-note')) && (await J(page, () => document.activeElement && document.activeElement.id)) === 'nb-hint-btn', 'there is no small error line any more, and focus came back to the notebook (the Hint button)');
  check(await J(page, () => document.querySelector('#nb-pin').disabled), 'no blind re-tapping: Pin it waits for a new tap');
  await pickSentence(page, TRAINING, wrongId); await page.click('#nb-pin');
  await waitModal(page, 'feedback');
  pm = await modalInfo(page);
  check(pm.text.includes(LINES.pinMiss2) && pm.text.includes(LINES.tier2) && pm.button === 'Show me', `a second miss: "${pm.text}" (button "${pm.button}")`);
  check(!(await exists(page, '.para.hl')), 'tier 2: the paragraph highlight is NOT shown while the popup is open');
  await closeModal(page, 'Escape');
  check((await page.getAttribute('#nb-hint', 'data-tier')) === '2' && (await exists(page, '.para.hl')), 'Escape closes the popup, and then the right paragraph is highlighted (tier 2)');
  await pickSentence(page, TRAINING, wrongId); await page.click('#nb-pin');
  await waitModal(page, 'feedback');
  pm = await modalInfo(page);
  check(pm.text.includes(LINES.pinMiss3) && pm.text.includes(q1.model) && pm.button === 'Got it', `a third miss: the partner models it in a popup (button "${pm.button}")`);
  check(!(await exists(page, '.para.dim')), 'tier 3: the other paragraphs are not dimmed until the popup closes');
  await closeModal(page, 'Enter');
  check((await page.getAttribute('#nb-hint', 'data-tier')) === '3' && (await textOf(page, '#nb-hint')).includes(q1.model) && (await exists(page, '.para.dim')), 'Enter closes the popup, and then the paragraphs dim (tier 3)');
  // v0.1.3: the Hint button always shows something: at the last tier it opens the partner's popup with the model again
  await page.click('#nb-hint-btn');
  await waitModal(page, 'feedback');
  pm = await modalInfo(page);
  check(pm.text.includes(LINES.hint3) && pm.text.includes(q1.model) && pm.text.includes(LINES.tier3Again) && pm.button === 'Got it' && (await J(page, () => window.__caseFiles.run.hints.q1)) === 3, `the Hint button at tier 3 still opens a popup (the model and "${LINES.tier3Again}")`);
  await closeModal(page);
  // one popup at a time: a second waits in a queue behind the first, never stacked
  await J(page, () => { const a = window.__caseFiles.app; a.feedback({ lines: ['First popup.'] }); a.feedback({ lines: ['Second popup.'] }); });
  await waitModal(page);
  check((await modalCount(page)) === 1 && (await modalInfo(page)).text === 'First popup.', 'two popups at once: one shows, the other waits (never stacked)');
  await page.click('.modal-go');
  await page.waitForFunction(() => { const t = document.querySelector('.modal-text'); return t && t.textContent.trim() === 'Second popup.'; }, null, { timeout: 4000 });
  check((await modalInfo(page)).text === 'Second popup.' && (await modalCount(page)) === 1, 'the queued popup shows after the first closes');
  await closeModal(page);
  await audit(page, layout.insets, 'notebook tier 3');
  await shot(page, layout, '05a-hint-tier3');
  await fbClear(page);
  await pickSentence(page, TRAINING, q1.answer[0]); await page.click('#nb-pin');
  await page.waitForSelector('#nb-why');
  check((await fbOn(page, 'fb-right', ':s ')) && !(await fbSeen(page, 'fb-wrong')) && (await sounds(page)).correct === 1 && !(await exists(page, '.modal-wrap')), 'v0.1.3: the right sentence gets fb-right (gold flash) and the soft chime straight away');
  check((await textOf(page, '#nb-why')).includes(q1.why), 'after pinning, the elaborated "why it proves it" line');
  check((await page.getAttribute('#case-board', 'data-count')) === '1', 'the pinned sentence went to the board (count 1)');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q1.why, { timeout: 4000 });
  await page.click('#nb-next');
  for (const q of TRAINING.questions.slice(1)) {
    check((await textOf(page, '#nb-q')) === q.prompt, `question: ${q.prompt}`);
    if (q.id === TRAINING.questions[1].id) {
      // v0.1.3: the Hint button on a fresh question opens the partner's popup with the first tier, and the inline hint line stays
      check(!(await exists(page, '#nb-hint')), 'a fresh question has no hint showing yet');
      await page.click('#nb-hint-btn');
      await waitModal(page, 'feedback');
      const hm = await modalInfo(page);
      check(hm.text.includes(LINES.hint1) && hm.text.includes(q.hint) && hm.button === 'Got it' && hm.who === 'partner' && hm.role === 'dialog' && hm.focus, `Hint: a visible result at once, the partner's popup ("${hm.text}")`);
      await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q.hint, { timeout: 4000 });
      await closeModal(page);
      check((await textOf(page, '#nb-hint')).includes(q.hint) && (await page.getAttribute('#nb-hint', 'data-tier')) === '1', 'Hint: the inline hint line stays in the notebook after the popup');
      await page.click('#nb-hint-btn'); await waitModal(page, 'feedback');
      const hm2 = await modalInfo(page);
      check(hm2.text.includes(LINES.hint2) && hm2.text.includes(LINES.tier2) && hm2.button === 'Show me' && !(await exists(page, '.para.hl')), 'Hint again: the next tier (the paragraph glows after the popup closes)');
      await closeModal(page);
      check(await exists(page, '.para.hl'), 'the second hint tier lights the paragraph after the popup');
      check(await J(page, (id) => window.__caseFiles.run.firstTap[id] === undefined, q.id), 'asking for a hint is not a tap: the first tap is still to come');
    }
    await pinAnswer(page, TRAINING, q);
    if (q.id === TRAINING.questions[1].id) {
      await page.click('#case-board'); await page.waitForSelector('.sheet .clue');
      check((await page.$$('.sheet .clue')).length === 2, 'the evidence board shows both pinned clues on the cork');
      await shot(page, layout, '05-cork-board', 600);
      await page.click('[data-act="close-sheet"]');
    }
    await page.click('#nb-next'); await sleep(60);
  }
  await waitBeat(page, 'rebuild');
  await expectCoach(page, layout, 'order', { shotName: '06a-coach-order' });
  await expectHelp(page, layout, '#case-help', 'order');

  // ---------- reconstruct: a misplaced card slides back (with a popup); tap-then-slot; drag ----------
  const tl = TRAINING.timeline;
  check((await page.$$('.slot.filled')).length === tl.given.length && (await page.$$('.tcard')).length === tl.items.length - tl.given.length, 'the timeline is half filled: given cards placed, the rest in the tray');
  const open = tl.items.map((it, i) => (tl.given.includes(i) ? -1 : i)).filter((i) => i >= 0);
  const wrongCard = tl.items[open[1]].id;
  await page.click(`[data-card="${wrongCard}"]`);
  check(await page.$$eval('.slot.target', (s) => s.length > 0), 'a tapped card lights the empty slots');
  await fbClear(page);
  await page.click(`.slot[data-slot="${open[0]}"]`);
  const proofDoc = TRAINING.docs.find((d) => d.paragraphs.some((p) => p.some((s) => s.id === tl.items[open[1]].proof)));
  check(await page.waitForFunction(() => window.__fb.some((x) => x.startsWith('fb-wrong:')) && !document.querySelector('.modal-wrap'), null, { timeout: 2000 }).then(() => true).catch(() => false), 'v0.1.3: a misplaced card shakes first (fb-wrong), then the popup');
  await waitModal(page, 'feedback');
  check((await fbOn(page, 'fb-wrong', 'tcard')) && (await sounds(page)).oops === 1, 'the misplaced card got fb-wrong and the soft boop');
  const cm = await modalInfo(page);
  check(cm.text.includes(LINES.cardMiss) && /Check the /.test(cm.text) && cm.button === 'Try again' && !/wrong/i.test(cm.text), `a misplaced card opens a popup: "${cm.text}" (button "${cm.button}"), no penalty`);
  check(await exists(page, `#tl-tray [data-card="${wrongCard}"]`), 'the misplaced card is back in the tray');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), LINES.cardMiss, { timeout: 4000 });
  await audit(page, layout.insets, 'popup misplaced card');
  await shot(page, layout, '06b-popup-misplaced-card', 400);
  await closeModal(page);
  check((await textOf(page, '#tl-msg')) === '' && (await J(page, () => document.activeElement && document.activeElement.id)) === 'tl-docs', 'no small message line on the timeline any more; focus came back to the page');
  await page.click('#tl-docs'); await page.waitForSelector('.sheet .doc');
  check(true, '"Check the documents" reopens the document drawer');
  await page.click('[data-act="close-sheet"]');
  await shot(page, layout, '06-timeline');
  await audit(page, layout.insets, 'timeline');
  const a = await page.locator(`[data-card="${tl.items[open[0]].id}"]`).boundingBox();
  check(!!a, 'cards are big enough to drag');
  await fbClear(page);
  await doRebuild(page, TRAINING, { drag: true });
  check((await page.$$('.slot.filled')).length === tl.items.length, 'every card is placed (one by dragging)');
  check((await fbOn(page, 'fb-right', 'slot')) && !(await fbSeen(page, 'fb-wrong')) && (await sounds(page)).correct === open.length, `v0.1.3: every right card gets fb-right on its slot and the chime (${open.length} placed)`);
  await page.click('#tl-go');
  await waitBeat(page, 'solve');
  await expectCoach(page, layout, 'close', { shotName: '07-coach-close' });
  await expectHelp(page, layout, '#case-help', 'close');

  // ---------- close the case: a wrong accusation, the keyboard, the clue, the report ----------
  check((await textOf(page, '.bubble.partner p')).includes(TRAINING.solution.prompt), 'the solution question is asked');
  // v0.1.3: the real keyboard types into the in-game field (letters, space, apostrophe, hyphen, Backspace; Enter = Check); no native input exists
  await page.keyboard.type("ab'-c d");
  check((await answerText(page)) === "Ab'-C D", `the physical keyboard types letters, apostrophe, hyphen and space into the in-game field ("${await answerText(page)}")`);
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  check((await answerText(page)) === "Ab'-C", 'the physical Backspace deletes (the trailing space too)');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  check((await answerText(page)) === 'Type your answer' && !(await exists(page, '.modal-wrap')), 'Enter with nothing typed does nothing');
  check(!(await J(page, () => !!document.querySelector('#screen-case input, #screen-case textarea'))), 'no native input is in the case screen (the keys are caught by a keydown listener)');
  await page.keyboard.type('Mia');
  check((await answerText(page)) === 'Mia', 'the answer is typed on the keyboard, names capitalized');
  await shot(page, layout, '07a-keyboard-answer');
  await fbClear(page);
  await page.keyboard.press('Enter');                                  // Enter = Check
  check(await page.waitForFunction(() => window.__fb.some((x) => x.startsWith('fb-wrong:')) && !document.querySelector('.modal-wrap'), null, { timeout: 2000 }).then(() => true).catch(() => false), 'v0.1.3: a wrong name shakes the answer box (fb-wrong), then the popup');
  await waitModal(page, 'feedback');
  check((await fbOn(page, 'fb-wrong', 'answer-box')) && (await sounds(page)).oops === 1, 'the answer box got fb-wrong and the soft boop');
  await page.keyboard.type('zzz');
  check((await answerText(page)) === 'Mia', 'while a popup is open the physical keys do not type behind it');
  const am = await modalInfo(page);
  check(am.text.includes(LINES.nameMiss) && am.text.includes('Good detectives check again') && am.text.includes(LINES.solveTier1) && am.button === 'Try again' && !/wrong/i.test(am.text), `a wrong name opens a popup: "Good detectives check again" + hint tier 1 (button "${am.button}")`);
  await audit(page, layout.insets, 'popup wrong accusation');
  await shot(page, layout, '07b-popup-wrong-accusation', 400);
  await closeModal(page);
  check((await textOf(page, '#solve-hint')).includes(LINES.solveTier1), 'after the popup the partner\'s hint stays on the page');
  await page.keyboard.press('Enter');                                  // the same name again (Enter = Check): tier 2 -> the evidence board opens AFTER the popup
  await waitModal(page, 'feedback');
  check((await modalInfo(page)).button === 'Show me' && !(await exists(page, '.sheet')), 'a second wrong name: "Show me", and the evidence board is not open yet');
  await closeModal(page);
  await page.waitForSelector('.sheet .clue');
  check(true, 'after the popup closes the evidence board opens with the proof glowing');
  await page.click('[data-act="close-sheet"]');
  for (let i = 0; i < 12; i++) await page.click('#case-kb .kb-key[data-key="back"]');
  await typeText(page, 'mr bel');                                    // a typo and no "Martin": still accepted (variants + edit distance)
  await fbClear(page);
  await pressEnter(page);
  await page.waitForSelector('#attach-msg');
  check((await fbOn(page, 'fb-right', 'answer-ok')) && (await sounds(page)).correct === 1, 'v0.1.3: the right name flashes gold (fb-right) with the chime');
  check((await textOf(page, '#attach-msg')).includes('attach'), 'the right name (with a typo) is accepted, then: attach the clue');
  const proofId = TRAINING.solution.proof.find((id) => TRAINING.questions.some((q) => q.answer.includes(id)));
  const notProof = await J(page, ({ proof }) => [...document.querySelectorAll('.clue')].map((c) => c.dataset.clue).find((id) => !proof.includes(id)), { proof: TRAINING.solution.proof });
  await fbClear(page);
  await page.click(`.clue[data-clue="${notProof}"]`);
  await waitModal(page, 'feedback');
  check((await modalInfo(page)).text === LINES.notThatClue && await J(page, () => document.querySelector('#solve-go').disabled), 'a pinned clue that does not prove it: a popup (check again), nothing attached');
  check((await fbOn(page, 'fb-wrong', 'clue')) && (await sounds(page)).oops === 1, 'v0.1.3: the clue that does not prove it shook first (fb-wrong) with the soft boop');
  await closeModal(page);
  await fbClear(page);
  await page.click(`.clue[data-clue="${proofId}"]`);
  check(!(await J(page, () => document.querySelector('#solve-go').disabled)), 'a pinned clue from the proof set is attached');
  check((await fbOn(page, 'fb-right', 'clue')) && (await sounds(page)).correct === 1, 'v0.1.3: the proof clue flashes gold (fb-right) with the chime');
  await shot(page, layout, '07b-attach-clue');
  await page.click('#solve-go');
  await waitBeat(page, 'report');
  check((await textOf(page, '#blank-who')) === 'Martin Bell', 'the case report frame: blank 1 is pre-filled from the solution');
  // v0.1.3: the frame (neutral default lead, the clue after a colon, the period inside the "because" blank: never alone on a line)
  const frameText = await textOf(page, '#frame');
  check(/^The answer is Martin Bell because .+The clue that proves it is:/.test(frameText), `the report frame uses the neutral default lead: "${frameText}"`);
  const dot = await J(page, () => { const d = document.querySelector('#blank-because .dot'), b = document.querySelector('#blank-because'); if (!d) return null; const r = d.getBoundingClientRect(), br = b.getBoundingClientRect(); return { text: d.textContent, inside: r.top >= br.top - 1 && r.bottom <= br.bottom + 1, others: [...document.querySelectorAll('#frame > *')].filter((x) => x.textContent.trim() === '.').length }; });
  check(dot && dot.text === '.' && dot.inside && dot.others === 0, 'the period sits inside the "because" blank, so it can never wrap onto a line of its own');
  check(await J(page, () => { const c = document.querySelector('#frame .frame-clue'); return !!c && getComputedStyle(c).display === 'block'; }), 'the clue is on its own line after "The clue that proves it is:" (no trailing orphan)');
  // word chips: the words of the attached clue and the report keywords, tap to insert; typing stays
  const chipWords = await page.$$eval('#word-chips .word-chip', (c) => c.map((x) => x.dataset.word));
  const clueSentence = TRAINING.docs.flatMap((d) => d.paragraphs.flat()).find((s) => s.id === proofId).text;
  const expectChips = wordChips(TRAINING, clueSentence);
  check(chipWords.length >= 4 && JSON.stringify(chipWords) === JSON.stringify(expectChips) && TRAINING.report.keywords.some((k) => chipWords.includes(k)), `word chips above the keyboard: the attached clue's words and the case keywords (${chipWords.join(', ')})`);
  check(await J(page, () => { const w = document.querySelector('#word-chips'), k = document.querySelector('#case-kb'); return !!w && !w.hidden && w.getBoundingClientRect().bottom <= k.getBoundingClientRect().top + 1; }), 'the chips sit above the keyboard');
  await page.click(`#word-chips .word-chip[data-word="${chipWords[0]}"]`);
  await page.click(`#word-chips .word-chip[data-word="${chipWords[1]}"]`);
  const typedChips = (await textOf(page, '#blank-because')).replace(/\.$/, '').trim().toLowerCase();
  check(typedChips === `${chipWords[0]} ${chipWords[1]}`.toLowerCase(), `tapping chips inserts their words ("${typedChips}")`);
  for (let i = 0; i < `${chipWords[0]} ${chipWords[1]} `.length; i++) await page.keyboard.press('Backspace');   // typing and deleting still work
  check((await textOf(page, '#blank-because')) === 'type why.', 'the physical Backspace clears what the chips added');
  await audit(page, layout.insets, 'report with word chips');
  await page.keyboard.type('it was');                                  // two words: too short
  await fbClear(page);
  await page.keyboard.press('Enter');
  check(await page.waitForFunction(() => window.__fb.some((x) => x.startsWith('fb-wrong:blank-because')) && !document.querySelector('.modal-wrap'), null, { timeout: 2000 }).then(() => true).catch(() => false), 'v0.1.3: a report that is too short shakes the "because" blank, then the popup');
  await waitModal(page, 'feedback');
  const sm = await modalInfo(page);
  check(sm.text === LINES.moreWords && sm.button === 'Try again', `a report that is too short opens a popup: "${sm.text}"`);
  await audit(page, layout.insets, 'popup short report');
  await shot(page, layout, '08a-popup-short-report', 400);
  await closeModal(page);
  await typeText(page, ' a nice day');                                 // no report keyword: the partner asks once
  await shot(page, layout, '08-keyboard-report');
  await pressEnter(page);
  await waitModal(page, 'feedback');
  const km = await modalInfo(page);
  check(km.text === 'Can you add what the clue shows?' && km.button === 'Got it', 'a report with none of the case keywords: a popup asks "Can you add what the clue shows?"');
  await closeModal(page);
  const msgEls = await J(page, () => document.querySelector('#blank-clue').textContent);
  check(msgEls === 'tap a clue', 'blank 3 waits for the child to tap a pinned clue');
  await pressEnter(page);                                             // accepted after the ask, but the clue is missing
  await waitModal(page, 'feedback');
  check((await modalInfo(page)).text === LINES.pickClue && (await modalInfo(page)).button === 'Show me' && !(await exists(page, '.sheet')), 'no clue chosen yet: a popup asks for it (the picker opens after it closes)');
  await closeModal(page);
  await page.waitForSelector('.sheet .clue');
  await page.click(`.sheet .clue[data-clue="${proofId}"]`);
  check((await textOf(page, '#blank-clue')).includes('“'), 'blank 3 shows the tapped clue');
  await audit(page, layout.insets, 'report');
  await fbClear(page);
  await page.keyboard.press('Enter');
  await waitScreen(page, 'closed');
  check((await fbOn(page, 'fb-right', 'frame')) && (await sounds(page)).correct === 1, 'v0.1.3: filing the report flashes the sentence (fb-right) with the chime before the stamp');

  // ---------- case closed ----------
  check(await exists(page, '#big-stamp') && (await textOf(page, '#big-stamp')).toLowerCase() === 'case closed', 'the CASE CLOSED stamp');
  check((await textOf(page, '#closing-line')).includes(TRAINING.closing.text), 'the Chief\'s closing line');
  check((await textOf(page, '#knowledge-card')).includes(TRAINING.knowledge), 'the knowledge card: one fact learned');
  check((await textOf(page, '#teaser')) === TRAINING.teaser, 'the teaser for tomorrow');
  check((await textOf(page, '#see-you')) === 'Case closed. See you tomorrow, Detective.', '"See you tomorrow, Detective."');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), TRAINING.closing.text, { timeout: 5000 });
  check(true, 'the closing line is voiced');
  await page.waitForFunction(() => !!document.querySelector('#payout') && Number(document.querySelector('#payout').dataset.coins) > 0, null, { timeout: 6000 }).catch(() => {});
  const coins1 = Number(await page.getAttribute('#payout', 'data-coins'));
  check(coins1 > 0, `the flat Lab payout shows (${coins1} coins)`);
  const payUi = await J(page, () => ({ coin: !!document.querySelector('#payout .pay-coin svg.lab-coin'), old: !!document.querySelector('#payout .pay-coin svg:not(.lab-coin)'), text: document.querySelector('#payout').textContent }));
  check(payUi.coin && !payUi.old && /Lab coins/.test(payUi.text) && !payUi.text.includes('$'), `v0.1.4: the payout uses the Lab coin icon and says "Lab coins" ("${payUi.text}")`);
  await sleep(1500);
  check((await state(page)).screen === 'closed', 'the next case is never started automatically');
  await kidAudit(page, 'closed'); await audit(page, layout.insets, 'closed');
  await shot(page, layout, '09-case-closed', 900);
  const sv = await J(page, () => JSON.parse(JSON.stringify(window.__caseFiles.save)));
  const rec = sv.closed.training;
  check(rec && rec.firstTap.q1 === false && rec.firstTap.q2 === true && rec.hints.q1 === 3 && rec.timelineTries === 1 && rec.report.who === 'Martin Bell' && rec.report.because === 'it was a nice day' && /^\d{4}-\d\d-\d\d$/.test(rec.day),
    `the save has the record: first taps ${JSON.stringify(rec && rec.firstTap)}, hints ${JSON.stringify(rec && rec.hints)}, ${rec && rec.timelineTries} timeline retry, report "${rec && rec.report.because}"`);
  check(rec && rec.listens[d1.id] >= 1 && rec.listens[d2.id] >= 1, `listens are counted per document (${JSON.stringify(rec && rec.listens)})`);
  check(sv.wordsMet.cubby === 1 && sv.wordsMet.cooler === 1, 'words met are counted');
  check(await J(page, () => { const h = JSON.parse(localStorage.getItem('caseFiles.pmia.save')).seenHelp; return ['home', 'brief', 'read', 'pin', 'order', 'close'].every((k) => h[k] === true); }), 'the save keeps seenHelp: every card was shown once (home, brief, read, pin, order, close)');
  const wipLeft = await J(page, () => localStorage.getItem('caseFiles.pmia.wip'));
  check(wipLeft === null, 'the in-progress copy is cleared when the case closes');
  await page.click('#closed-home');
  await waitScreen(page, 'home');
  const home2 = await J(page, () => Object.fromEntries([...document.querySelectorAll('.case-card')].map((c) => [c.dataset.case, c.dataset.state])));
  check(home2.training === 'closed' && home2['erie-01'] === 'new', 'home: Training carries its stamp, Erie case 1 is still open (re-readable from the Archive)');
  await page.click('#btn-archive');
  await waitScreen(page, 'archive');
  check((await page.$$('#archive-body .case-card')).length === 1, 'the Archive lists the closed case');
  await page.click('#archive-body .case-card');
  await waitScreen(page, 'file');
  check((await page.$$('#file-body .doc')).length === 1, 'a closed case can be re-read: its documents open');
  await page.click('#file-body [data-tab="report"]');
  check((await textOf(page, '#file-report')).startsWith('The answer is Martin Bell because it was a nice day. The clue that proves it is: “'), 'the Archive shows the child\'s own case report (the same frame, the clue after a colon)');
  await audit(page, layout.insets, 'archive file');
  check((await textOf(page, '#file-replay')) === 'Solve it again', 'v0.1.3: a closed case file offers "Solve it again" (the read-only view stays)');

  // ---------- v0.1.3: Solve it again: the full case, a fresh run; no Lab payout, nothing in the record changes but `replays` ----------
  const closedBefore = await J(page, () => JSON.parse(JSON.stringify(window.__caseFiles.save.closed.training)));
  const wordsBefore = await J(page, () => JSON.stringify(window.__caseFiles.save.wordsMet));
  await J(page, async () => { const { labBridge } = await import('./src/meta/labBridge.js'); window.__labCalls = []; const o = labBridge.report.bind(labBridge); labBridge.report = (ev) => { window.__labCalls.push(ev); return o(ev); }; });
  await page.click('#file-replay');
  await waitBeat(page, 'brief');
  check((await J(page, () => window.__caseFiles.run.replay === true && window.__caseFiles.run.beat === 'brief' && window.__caseFiles.run.wordsDone.length === 0 && window.__caseFiles.run.board.length === 0)) && (await page.$$('.wordcard')).length === 2, 'Solve it again starts a fresh run at the briefing (a replay run)');
  await noModal(page, 'a replay shows no coach card (all seen)');
  await doBrief(page, TRAINING);
  await doDesk(page, TRAINING);
  check((await J(page, () => localStorage.getItem('caseFiles.pmia.wip'))) === null && (await J(page, () => !!localStorage.getItem('caseFiles.pmia.replay'))), 'a replay is kept apart from the case in progress (its own device-local copy)');
  await pinAll(page, TRAINING);
  await doRebuild(page, TRAINING);
  await page.click('#tl-go'); await waitBeat(page, 'solve');
  await page.keyboard.type('Martin Bell'); await page.keyboard.press('Enter');
  await page.waitForSelector('#attach-msg');
  await page.click(`.clue[data-clue="${TRAINING.solution.proof.find((id) => TRAINING.questions.some((q) => q.answer.includes(id)))}"]`); await page.click('#solve-go');
  await waitBeat(page, 'report');
  await page.keyboard.type('the yogurt was cold');
  await page.click('#blank-clue'); await page.waitForSelector('.sheet .clue'); await page.click(`.sheet .clue[data-clue="${TRAINING.solution.proof.find((id) => TRAINING.questions.some((q) => q.answer.includes(id)))}"]`);
  await page.keyboard.press('Enter');
  await waitScreen(page, 'file');
  check((await textOf(page, '#replay-note')).includes('Solved again') && (await exists(page, '#file-replay')), 'the replay ends on the case file: "Solved again", with "Solve it again" still there');
  const closedAfter = await J(page, () => JSON.parse(JSON.stringify(window.__caseFiles.save.closed.training)));
  check(closedAfter.replays === 1 && JSON.stringify({ ...closedAfter, replays: 0 }) === JSON.stringify({ ...closedBefore, replays: 0 }), `the closed record is unchanged except replays: 1 (was ${closedBefore.replays})`);
  check((await J(page, () => JSON.stringify(window.__caseFiles.save.wordsMet))) === wordsBefore, 'the words met are not counted again');
  check((await J(page, () => window.__labCalls.length)) === 0 && !(await exists(page, '#screen-closed:not([hidden]) #payout')), 'no Lab payout for a replay (the Lab was told nothing)');
  check((await J(page, () => localStorage.getItem('caseFiles.pmia.replay'))) === null && (await J(page, () => localStorage.getItem('caseFiles.pmia.wip'))) === null, 'the replay copy is cleared when it ends');
  await page.click('#file-body [data-tab="docs"]');
  check((await page.$$('#file-body .doc')).length === 1 && (await textOf(page, '#file-title')) === TRAINING.title, 'the read-only view of the closed case is still there after a replay');
  await page.click('#file-back'); await waitScreen(page, 'archive');
  await page.click('[data-back="home"]'); await waitScreen(page, 'home');

  // ---------- Erie case 1, fast: a wrong tap, a misplaced card, the keyboard; then the pacing ----------
  const E1 = CASE_BY_ID['erie-01'];
  await page.click('.case-card[data-case="erie-01"]');
  await waitBeat(page, 'brief'); await noModal(page, 'a second case: no coach card at the briefing (each step\'s card is shown once, for any case)');
  await doBrief(page, E1);
  await noModal(page, 'a second case: no coach card at the desk');
  await doDesk(page, E1);
  await noModal(page, 'a second case: no coach card at the notebook');
  // the two-sentence question needs both pinned
  const q6 = E1.questions.find((q) => q.id === 'q6');
  await pickSentence(page, E1, 'd1s2'); await page.click('#nb-pin'); await closeModal(page);   // a wrong tap on q1 (first tap false): the popup
  await pinAll(page, E1);
  await noModal(page, 'a second case: no coach card at the timeline');
  await doRebuild(page, E1, { misplace: true });
  await page.click('#tl-go'); await waitBeat(page, 'solve');
  await noModal(page, 'a second case: no coach card at the close');
  await typeText(page, 'tom fisk'); await pressEnter(page);
  await page.waitForSelector('#attach-msg');
  const proof1 = E1.solution.proof.find((id) => E1.questions.some((q) => q.answer.includes(id)));
  await page.click(`.clue[data-clue="${proof1}"]`); await page.click('#solve-go');
  await waitBeat(page, 'report');
  check((await textOf(page, '#frame')).startsWith('The toll ticket was with Tom Fisk because '), 'v0.1.3: the case lead is used: "The toll ticket was with Tom Fisk because …"');
  await typeText(page, 'the ticket is in the coat pocket');
  await page.click('#blank-clue'); await page.waitForSelector('.sheet .clue'); await page.click(`.sheet .clue[data-clue="${proof1}"]`);
  await pressEnter(page);
  await waitScreen(page, 'closed');
  const sv2 = await J(page, () => JSON.parse(JSON.stringify(window.__caseFiles.save)));
  check(sv2.closed['erie-01'] && sv2.closed['erie-01'].firstTap.q1 === false && sv2.closed['erie-01'].report.who === 'Tom Fisk', 'Erie case 1 closes: the two-sentence question needed both sentences, the first-tap miss is recorded');
  check(sv2.closed['erie-01'].timelineTries >= 1, 'the misplaced timeline card was counted');
  check(Object.keys(q6.answer).length === 2, 'fixture check: q6 needs two sentences');
  await page.click('#closed-home'); await waitScreen(page, 'home');
  check((await textOf(page, '#next-note')) === 'Next case arrives tomorrow.', 'both open cases closed on day 1: "Next case arrives tomorrow." (no countdown)');
  const home3 = await J(page, () => document.querySelector('.case-card[data-case="erie-02"]').dataset.state);
  check(home3 === 'sealed', 'the next case stays sealed until the next local day');
  await kidAudit(page, 'home (waiting)');
  await J(page, () => { window.__fakeNow = 86400000 + 3600000; });          // tomorrow
  await page.click('#btn-player'); await waitScreen(page, 'players');
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  const home4 = await J(page, () => document.querySelector('.case-card[data-case="erie-02"]').dataset.state);
  check(home4 === 'new' && !(await exists(page, '#next-note')), 'the next day: case 2 arrives (one new case a day)');
  await J(page, () => { window.__fakeNow = 0; });                             // (the clock goes back: nothing re-seals what is open)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  await noModal(page, 'reload: the seen coach cards do not come back (the seen state is saved)');
  const home5 = await J(page, () => Object.fromEntries([...document.querySelectorAll('.case-card')].map((c) => [c.dataset.case, c.dataset.state])));
  check(home5.training === 'closed' && home5['erie-01'] === 'closed' && home5['erie-02'] === 'new', 'reload: the progress persists');

  // ---------- resume: leaving a case in the middle keeps it ----------
  await page.click('.case-card[data-case="erie-02"]');
  await doBrief(page, CASE_BY_ID['erie-02']);
  // v0.1.3: a harder document that no answer or proof points into is a bonus: the notebook opens without it
  const e2 = CASE_BY_ID['erie-02'];
  check((await textOf(page, '.docfolder[data-doc="d3"] .tag.stretch')) === 'Bonus · harder' && (await textOf(page, '#desk-note')).includes('bonus') && (await page.getAttribute('.docfolder[data-doc="d3"]', 'data-required')) === '0', 'v0.1.3: the harder document is labelled "Bonus · harder" (tag stretch) and the desk says it is a bonus');
  check(await J(page, () => document.querySelector('#open-notebook').disabled), 'the notebook still waits for the core documents');
  for (const d of e2.docs.filter((x) => !x.stretch)) { await page.click(`.docfolder[data-doc="${d.id}"]`); await page.waitForSelector(`.doc[data-doc="${d.id}"]`); await page.click('#doc-back'); await page.waitForSelector('#open-notebook'); }
  check(!(await J(page, () => document.querySelector('#open-notebook').disabled)) && !(await J(page, () => window.__caseFiles.run.opened.includes('d3'))), 'the notebook opens once the core documents are read: the bonus document does not have to be opened');
  await page.click('#case-back'); await waitScreen(page, 'home');
  check((await J(page, () => document.querySelector('.case-card[data-case="erie-02"]').dataset.state)) === 'started', 'stopping mid-case is fine: the file says "Keep going"');
  await page.click('.case-card[data-case="erie-02"]');
  await waitBeat(page, 'investigate');
  check(true, 'and it resumes at the desk where the child stopped');
  await page.click('#case-back'); await waitScreen(page, 'home');

  // ---------- rank 1: read-aloud in every document, the idle hint offered by the partner (Mia, erie-02) ----------
  const E2 = CASE_BY_ID['erie-02'], e2q1 = E2.questions[0];
  await page.click('#btn-player'); await waitScreen(page, 'players');
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  await J(page, () => { localStorage.setItem('caseFiles.pmia.wip', 'null'); window.__caseFiles.app.setRankFor('pmia', 1); });
  await page.click('.case-card[data-case="erie-02"]'); await waitBeat(page, 'brief');
  check((await J(page, () => window.__caseFiles.run.rank)) === 1, 'rank 1 starts the case at rank 1');
  await doBrief(page, E2);
  check((await page.$$('.docfolder .tag.read')).length === E2.docs.length, 'rank 1: "Read to me" is on for every document');
  const beforeR1 = (await played(page)).length;
  await page.click(`.docfolder[data-doc="${E2.docs[0].id}"]`);
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), E2.docs[0].paragraphs[0][0].text, { timeout: 5000 });
  check((await page.getAttribute('.toggle-btn', 'aria-pressed')) === 'true' && (await played(page)).length > beforeR1, 'rank 1: a core document opens already reading');
  await page.click('#doc-back');
  await doDesk(page, E2);
  await page.waitForSelector('#nb-hint[data-tier="1"]', { timeout: 4000 });
  check((await textOf(page, '#nb-hint')).includes(e2q1.hint) && !(await J(page, () => window.__caseFiles.run.firstTap.q1 !== undefined)), 'rank 1: after a pause the partner offers hint tier 1 by herself (no tap, no timer on screen)');
  await kidAudit(page, 'notebook (rank 1)');
  await page.click('#case-back'); await waitScreen(page, 'home');
  await J(page, () => { localStorage.setItem('caseFiles.pmia.wip', 'null'); window.__caseFiles.app.setRankFor('pmia', 4); });


  // ---------- the Parent Zone ----------
  await page.click('#btn-parents');
  await page.waitForSelector('#pin-title');
  check((await textOf(page, '#pin-title')) === 'Choose a 4-digit PIN', 'Parent Zone: first open asks for a PIN');
  for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
  await page.waitForFunction(() => document.querySelector('#pin-title') && document.querySelector('#pin-title').textContent === 'Type the PIN again');
  for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
  await page.waitForSelector('.pz-tabs');
  check((await page.getAttribute('#pz', 'data-view')) === 'main', 'Parent Zone: the PIN is set and the zone opens');
  await page.click('.pz-tabs [data-tab="det"]');
  await page.waitForSelector('#rank-line');
  check((await textOf(page, '#rank-line')) === 'Rank 4 · grade 5 feel · roughly comparable to F&P S–U / about 830–1010L (approximate; not affiliated with or leveled by Fountas & Pinnell, Heinemann or MetaMetrics)', 'Parent Zone: the Rank 4 label, verbatim');
  await page.click('[data-rank="2"]');
  check((await textOf(page, '#rank-line')).startsWith('Rank 2 · grade 3 feel'), 'Parent Zone: the rank select changes the label');
  await page.click('[data-rank="4"]');
  // v0.1.1: the parent's "Read it to me" setting
  check((await page.$$('[data-readmode]')).length === 3 && (await page.getAttribute('[data-readmode="auto"]', 'aria-pressed')) === 'true', 'Parent Zone: "Read it to me" offers By rank / Only when tapped / Off, By rank on by default');
  await page.click('[data-readmode="off"]');
  check((await textOf(page, '#readmode-help')).startsWith('Off:') && (await J(page, () => JSON.parse(localStorage.getItem('caseFiles.pmia.save')).readMode)) === 'off', 'Parent Zone: "Read it to me: Off" is saved for the child');
  const noAudio = await J(page, async () => {
    const { createReader } = await import('./src/ui/reader.js');
    const app = { speech: { cancel() {}, readEach: async () => ({ spoken: 0 }) }, voiceReady: () => true, voiceHint() {}, noteListen() {} };
    const d = { id: 'd1', title: 'T', from: 'F', paragraphs: [[{ id: 'd1s1', text: 'One.' }], [{ id: 'd1s2', text: 'Two.' }]] };
    const off = createReader(app, {}, d, { mode: 'read', readAloud: true, noAudio: true }), on = createReader(app, {}, d, { mode: 'read' });
    return [off.el.querySelectorAll('.say-btn, [data-act="read-all"]').length, on.el.querySelectorAll('.say-btn').length, on.el.querySelectorAll('[data-act="read-all"]').length];
  });
  check(noAudio[0] === 0 && noAudio[1] === 2 && noAudio[2] === 1, `"Read it to me: Off" hides the switch and every listen button (${noAudio})`);
  await page.click('[data-readmode="tap"]');
  check((await J(page, () => JSON.parse(localStorage.getItem('caseFiles.pmia.save')).readMode)) === 'tap', 'Parent Zone: "Only when tapped" is saved');
  await page.click('[data-readmode="auto"]');
  const reports = await page.$$eval('.pz-report', (r) => r.map((x) => x.textContent));
  check(reports.length === 2 && reports.some((r) => r.includes('The answer is Martin Bell because it was a nice day. The clue that proves it is: “')) && reports.some((r) => r.includes('The toll ticket was with Tom Fisk because the ticket is in the coat pocket. The clue that proves it is: “')), `Parent Zone: the child's case reports, in full, with each case's lead (${reports.length})`);
  check(reports.some((r) => /played again 1 time/.test(r)), 'Parent Zone: shows that a closed case was played again');
  check(/\bRank \d/.test(await textOf(page, '#rank-line')), 'the Detective Rank is shown in the Parent Zone only');
  const acc = await page.$$eval('#pz-acc tbody tr', (rows) => rows.map((r) => [r.dataset.std, r.children[1].textContent, r.children[2].textContent]));
  check(acc.length >= 3 && acc.some((r) => r[0] === '4R1') && acc.some((r) => r[0] === '4R4') && acc.every((r) => /^\d+ \(\d+%\)$/.test(r[1])), `Parent Zone: first-tap accuracy per standard ${JSON.stringify(acc)}`);
  const casesRows = await page.$$eval('#pz-cases tbody tr', (rows) => rows.map((r) => r.textContent));
  check(casesRows.length === 2 && casesRows[0].includes('questions') && /Maya|Statement|Cooler/.test(casesRows[0]), 'Parent Zone: hints, timeline retries and listens per case');
  const words = await textOf(page, '#pz-words');
  check(/cubby ×1/.test(words) && /toll ×1/.test(words), `Parent Zone: words met (${words})`);
  await shot(page, layout, '10-parent-zone', 500);
  const nextOpen = await J(page, () => document.querySelector('#pz-open-next').disabled);
  check(nextOpen === true, 'Parent Zone: "Open the next case now" is disabled when every case is open');
  await page.click('.pz-tabs [data-tab="school"]');
  const school = await page.$$eval('[data-school]', (e) => e.map((x) => x.textContent));
  check(school.length >= 3 && /Benchmark Assessment/.test(school[0]) && /instructional/.test(school[0]) && /i-Ready/.test(school[1]) && /Lexile/.test(school[1]) && /one reading/i.test(school[2]), 'Parent Zone: the "Talking with school" card');
  await page.click('.pz-tabs [data-tab="options"]');
  check(await exists(page, '#pz-sound') && (await textOf(page, '#pz-voice')).includes('Natural voice'), 'Parent Zone: sound and the natural voice status');
  await page.click('.pz-tabs [data-tab="family"]');
  check((await textOf(page, '#pz-code')) === 'ABCD-2345', 'Parent Zone: the family code');
  await audit(page, layout.insets, 'parent zone');
  await page.click('#pz-close');
  await waitScreen(page, 'home');
  // the parent opens the next case early: needs a closed-state with an unopened case, so check the pacing with the real button on a fresh save
  await page.click('#btn-player'); await waitScreen(page, 'players');
  await page.click('[data-player="pleo"]'); await waitScreen(page, 'home');
  await expectCoach(page, layout, 'home', { voiced: false });
  const leo = await J(page, () => Object.fromEntries([...document.querySelectorAll('.case-card')].map((c) => [c.dataset.case, c.dataset.state])));
  check(leo.training === 'new' && leo['erie-01'] === 'new' && leo['erie-02'] === 'sealed', 'a second player starts on their own day 1');
  await page.click('#btn-parents'); await page.waitForSelector('#pin-title');
  for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
  await page.waitForSelector('.pz-tabs'); await page.click('.pz-tabs [data-tab="det"]');
  await page.waitForSelector('#pz-open-next');
  check(!(await J(page, () => document.querySelector('#pz-open-next').disabled)), 'Parent Zone: "Open the next case now" is available while a case is still sealed');
  await page.click('[data-rank="5"]');
  await page.click('#pz-open-next');
  await page.click('#pz-close'); await waitScreen(page, 'home');
  const leo2 = await J(page, () => document.querySelector('.case-card[data-case="erie-02"]').dataset.state);
  check(leo2 === 'new', 'the parent opened the next case early');
  await page.click('.case-card[data-case="training"]'); await waitBeat(page, 'brief');
  await expectCoach(page, layout, 'brief', { voiced: false });
  check((await modalCount(page)) === 0 && (await J(page, () => Object.values(window.__caseFiles.save.seenHelp).filter(Boolean).length)) === 2, 'a second player has their own seen state (home and brief so far)');
  check((await page.$$('.wordcard')).length === 2 && (await J(page, () => window.__caseFiles.run.rank)) === 5, 'rank 5 pre-teaches 2 words and starts a run at that rank');
  // the voice-not-ready note is a partner popup too (Leo has no natural voice picked)
  await doBrief(page, TRAINING);
  await expectCoach(page, layout, 'read', { voiced: false });
  await page.click(`.docfolder[data-doc="${d1.id}"]`); await page.waitForSelector(`.doc[data-doc="${d1.id}"]`);
  await page.click('.say-btn[data-act="listen"]');
  await waitModal(page, 'feedback');
  const vm = await modalInfo(page);
  check(vm.text === LINES.noVoice && vm.button === 'Got it' && (await voiceToasts(page)) === 0, `no natural voice yet: a popup, not a toast ("${vm.text}")`);
  await audit(page, layout.insets, 'popup no voice');
  await closeModal(page);
  await page.click('#doc-back');
  await page.click('#case-back'); await waitScreen(page, 'home');

  // ---------- the rules ----------
  const spoken = await J(page, () => window.__spoken.slice());
  check(spoken.length === 0, `the device voice was never used (${spoken.length} device utterances)`);
  check(ttsNetwork === 0, 'no real network calls to the voice server (the backend was mocked)');
  const asked = await J(page, () => window.__cloudAsked.length);
  check(asked >= 1, `the natural voice was asked for clips (${asked} requests)`);
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

// ---------- offline: the service worker keeps the game working (a real worker, a real offline reload) ----------
async function runOffline(browser) {
  console.log('\n=== offline (service worker) ===');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/api/**', (r) => r.abort());
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('cfOffSeeded')) {
      localStorage.clear(); const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }], pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], migrated: true, lastPlayer: null }));
      sessionStorage.setItem('cfOffSeeded', '1');
    }
  });
  await page.goto(BASE + '/case-files/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  await closeModal(page);
  await page.waitForFunction(async () => { const c = await caches.open('case-files-v0.1.5'); return (await c.keys()).length > 25; }, null, { timeout: 15000 });
  const names = await J(page, async () => (await caches.keys()).filter((k) => k.startsWith('case-files-')));
  check(names.length === 1 && names[0] === 'case-files-v0.1.5', `the service worker cache is named case-files-v0.1.5 (${names.join(',')})`);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(visibleSel('#screen-players'), { timeout: 15000 });
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  await noModal(page, 'offline: the home card was already seen');
  check(await exists(page, '.case-card[data-case="training"]'), 'offline: the page reloads from the cache and the agency home opens');
  await page.click('.case-card[data-case="training"]'); await waitBeat(page, 'brief');
  check((await textOf(page, '.objective p')).length > 5, 'offline: a case opens and plays');
  check(errors.length === 0, `offline: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    if (!ONLY || ONLY === 'musicoff') {
      // Case Files plays no background music of its own: the check is the toggle behind the PIN, the stored record, the shared audio lock and that effects still play
      await runMusicOffCheck(browser, { name: 'case-files', url: BASE + '/case-files/index.html', audio: '/spell-jump/src/audio.js', hasMusic: false,
        pick: async (page) => { await page.waitForSelector('#screen-players:not([hidden])'); },      // (the Parents button on the picker; the agency home opens with a coach card)
        parentsBtn: '#btn-parents-picker', zoneReady: '.pz-tabs', famToggle: '#pz-family-music', shot: process.env.MUSICOFF_SHOT || null }, check);
    }
    for (const l of LAYOUTS) await runLayout(browser, l); if (!ONLY || ONLY === 'offline') await runOffline(browser); } finally { await browser.close(); }
  console.log(`\nscreenshots: ${SHOTS}`);
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n- ` + failures.join('\n- ')); process.exit(1); }
  console.log('\nALL CASE FILES UI CHECKS PASSED');
}
main().catch((e) => { console.error(e); process.exit(1); });
