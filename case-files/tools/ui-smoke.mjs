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
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CASE_BY_ID, TRAINING } from './fixtures/index.js';

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
    window.__fakeNow = 0;
    window.__caseFilesNow = () => Date.now() + window.__fakeNow;
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__playMs = 12; window.__spoken = [];
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
  await page.waitForFunction(() => !document.querySelector('#btn-thelab').hidden, null, { timeout: 8000 }).catch(() => {});
  const home1 = await J(page, () => Object.fromEntries([...document.querySelectorAll('.case-card')].map((c) => [c.dataset.case, c.dataset.state])));
  check(home1.training === 'new' && home1['erie-01'] === 'new' && home1['erie-02'] === 'sealed', `day 1: Training and Erie case 1 are open, case 2 is sealed (${JSON.stringify(home1)})`);
  check((await textOf(page, '.folder[data-tab="Training"] h3')) === 'Detective Training' && (await exists(page, '.folder[data-tab="Erie Canal"]')), 'the case board: Detective Training first, then the Erie Canal folder');
  check(!(await exists(page, '#next-note')), 'no "next case" note while a case is waiting to be played');
  const sealedText = await textOf(page, '.case-card.sealed');
  check(!sealedText.includes('Mule'), 'a sealed file does not show its title');
  await kidAudit(page, 'home'); await audit(page, layout.insets, 'home');
  await shot(page, layout, '02-agency-home');

  // ---------- Detective Training: the briefing ----------
  await page.click('.case-card[data-case="training"]');
  await waitBeat(page, 'brief');
  await page.waitForFunction((t) => window.__cloudAsked.some((a) => a.texts.includes(t)), TRAINING.briefing[0].text, { timeout: 5000 });
  const asked0 = await J(page, () => window.__cloudAsked.flatMap((a) => a.texts));
  check(asked0.includes(TRAINING.objective) && asked0.includes(TRAINING.closing.text) && !asked0.some((t) => /Missing Toll Ticket|towpath|Ruth Ann/.test(t)), `the voice prepares only this case's lines (${asked0.length} texts, none from the Erie cases)`);
  check(await J(page, () => window.__cloudAsked.every((a) => a.code === 'ABCD-2345' && a.texts.length <= 80)), 'clips are asked for with the family code, at most 80 a request');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), TRAINING.briefing[0].text, { timeout: 6000 });
  check(true, 'the Chief\'s briefing is voiced (a clip, line by line)');
  check((await textOf(page, '.objective p')) === TRAINING.objective, 'the objective is shown');
  check((await page.$$('.wordcard')).length === 2 && (await J(page, () => document.querySelector('#brief-go').disabled)), 'the case words are pre-taught (2 for this case) and "Start investigating" waits for them');
  const w0 = TRAINING.words[0];
  await page.click(`.wordcard[data-word="${w0.word}"] .tok[data-right="0"]`);
  check(!(await exists(page, `.wordcard[data-word="${w0.word}"] .wc-mean`)), 'tapping the wrong word in the sentence shows no meaning and no penalty');
  await page.click(`.wordcard[data-word="${w0.word}"] .tok[data-right="1"]`);
  check((await textOf(page, `.wordcard[data-word="${w0.word}"] .wc-mean`)).includes(w0.meaning), 'tapping the right word shows what it means');
  await page.waitForFunction((t) => window.__cloudPlayed.some((x) => x.startsWith(t)), w0.word, { timeout: 4000 });
  await kidAudit(page, 'briefing'); await audit(page, layout.insets, 'briefing');
  await shot(page, layout, '03-briefing');
  await doBrief(page, TRAINING);

  // ---------- investigate: the desk, a document with a highlighted sentence, "Read it to me" ----------
  check((await page.$$('.docfolder')).length === 2 && (await exists(page, '.docfolder .tag.stretch')), 'the desk shows the documents; one is marked Stretch');
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

  // ---------- pin the evidence: a wrong tap goes to hint tiers 1, 2, 3 ----------
  const q1 = TRAINING.questions[0];
  check((await textOf(page, '#nb-q')) === q1.prompt, 'the partner\'s notebook asks one question at a time');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q1.prompt, { timeout: 4000 });
  check(await J(page, () => document.querySelector('#nb-pin').disabled), 'Pin it waits for a tapped sentence');
  const wrongId = 'd1s6';
  await pickSentence(page, TRAINING, wrongId);
  check((await page.$eval(`.s[data-id="${wrongId}"]`, (e) => e.classList.contains('sel'))), 'a tapped sentence is selected (not pinned yet)');
  await page.click('#nb-pin');
  check((await textOf(page, '#nb-hint')).includes(q1.hint) && (await page.getAttribute('#nb-hint', 'data-tier')) === '1', 'a wrong tap goes straight to hint tier 1: the partner asks the guiding question');
  check(!(await page.$eval('#nb-note', (e) => e.textContent).then((t) => /wrong|incorrect/i.test(t)).catch(() => false)) && (await textOf(page, '#nb-note')).includes('Good detectives check again'), 'the wrong tap says "Good detectives check again", never "wrong"');
  check(await J(page, () => document.querySelector('#nb-pin').disabled), 'no blind re-tapping: Pin it waits for a new tap');
  await pickSentence(page, TRAINING, wrongId); await page.click('#nb-pin');
  check((await page.getAttribute('#nb-hint', 'data-tier')) === '2' && (await exists(page, '.para.hl')), 'a second miss goes to tier 2: the right paragraph is highlighted');
  await pickSentence(page, TRAINING, wrongId); await page.click('#nb-pin');
  check((await page.getAttribute('#nb-hint', 'data-tier')) === '3' && (await textOf(page, '#nb-hint')).includes(q1.model) && (await exists(page, '.para.dim')), 'a third goes to tier 3: the partner models the reasoning and the other paragraphs dim');
  await audit(page, layout.insets, 'notebook tier 3');
  await shot(page, layout, '05a-hint-tier3');
  await pickSentence(page, TRAINING, q1.answer[0]); await page.click('#nb-pin');
  await page.waitForSelector('#nb-why');
  check((await textOf(page, '#nb-why')).includes(q1.why), 'after pinning, the elaborated "why it proves it" line');
  check((await page.getAttribute('#case-board', 'data-count')) === '1', 'the pinned sentence went to the board (count 1)');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q1.why, { timeout: 4000 });
  await page.click('#nb-next');
  for (const q of TRAINING.questions.slice(1)) {
    check((await textOf(page, '#nb-q')) === q.prompt, `question: ${q.prompt}`);
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

  // ---------- reconstruct: a misplaced card slides back; tap-then-slot; drag ----------
  const tl = TRAINING.timeline;
  check((await page.$$('.slot.filled')).length === tl.given.length && (await page.$$('.tcard')).length === tl.items.length - tl.given.length, 'the timeline is half filled: given cards placed, the rest in the tray');
  const open = tl.items.map((it, i) => (tl.given.includes(i) ? -1 : i)).filter((i) => i >= 0);
  const wrongCard = tl.items[open[1]].id;
  await page.click(`[data-card="${wrongCard}"]`);
  check(await page.$$eval('.slot.target', (s) => s.length > 0), 'a tapped card lights the empty slots');
  await page.click(`.slot[data-slot="${open[0]}"]`);
  const proofDoc = TRAINING.docs.find((d) => d.paragraphs.some((p) => p.some((s) => s.id === tl.items[open[1]].proof)));
  const msg = await textOf(page, '#tl-msg');
  check(/^Check the /.test(msg) && !/wrong/i.test(msg), `a misplaced card slides back with "${msg}" (no penalty)`);
  check(await exists(page, `#tl-tray [data-card="${wrongCard}"]`), 'the misplaced card is back in the tray');
  await page.click('#tl-docs'); await page.waitForSelector('.sheet .doc');
  check(true, '"Check the documents" reopens the document drawer');
  await page.click('[data-act="close-sheet"]');
  await shot(page, layout, '06-timeline');
  await audit(page, layout.insets, 'timeline');
  const a = await page.locator(`[data-card="${tl.items[open[0]].id}"]`).boundingBox();
  check(!!a, 'cards are big enough to drag');
  await doRebuild(page, TRAINING, { drag: true });
  check((await page.$$('.slot.filled')).length === tl.items.length, 'every card is placed (one by dragging)');
  await page.click('#tl-go');
  await waitBeat(page, 'solve');

  // ---------- close the case: a wrong accusation, the keyboard, the clue, the report ----------
  check((await textOf(page, '.bubble.partner p')).includes(TRAINING.solution.prompt), 'the solution question is asked');
  await typeText(page, 'Mia');
  check((await textOf(page, '#answer-box')) === 'Mia', 'the answer is typed on the in-game keyboard, names capitalized');
  await shot(page, layout, '07a-keyboard-answer');
  await pressEnter(page);
  await page.waitForSelector('#solve-hint');
  check((await textOf(page, '#solve-hint')).includes('Good detectives check again') && !/wrong/i.test(await textOf(page, '#solve-hint')), 'a wrong name: "Good detectives check again" + the next hint tier');
  for (let i = 0; i < 12; i++) await page.click('#case-kb .kb-key[data-key="back"]');
  await typeText(page, 'mr bel');                                    // a typo and no "Martin": still accepted (variants + edit distance)
  await pressEnter(page);
  await page.waitForSelector('#attach-msg');
  check((await textOf(page, '#attach-msg')).includes('attach'), 'the right name (with a typo) is accepted, then: attach the clue');
  const proofId = TRAINING.solution.proof.find((id) => TRAINING.questions.some((q) => q.answer.includes(id)));
  const notProof = await J(page, ({ proof }) => [...document.querySelectorAll('.clue')].map((c) => c.dataset.clue).find((id) => !proof.includes(id)), { proof: TRAINING.solution.proof });
  await page.click(`.clue[data-clue="${notProof}"]`);
  check((await textOf(page, '#attach-msg')).includes('check again') && await J(page, () => document.querySelector('#solve-go').disabled), 'a pinned clue that does not prove it: check again, nothing attached');
  await page.click(`.clue[data-clue="${proofId}"]`);
  check(!(await J(page, () => document.querySelector('#solve-go').disabled)), 'a pinned clue from the proof set is attached');
  await shot(page, layout, '07b-attach-clue');
  await page.click('#solve-go');
  await waitBeat(page, 'report');
  check((await textOf(page, '#blank-who')) === 'Martin Bell', 'the case report frame: blank 1 is pre-filled from the solution');
  await typeText(page, 'it was a nice day');                          // no report keyword: the partner asks once
  await shot(page, layout, '08-keyboard-report');
  await pressEnter(page);
  check((await textOf(page, '#report-msg')) === 'Can you add what the clue shows?', 'a report with none of the case keywords: the partner asks "Can you add what the clue shows?"');
  const msgEls = await J(page, () => document.querySelector('#blank-clue').textContent);
  check(msgEls === 'tap a clue', 'blank 3 waits for the child to tap a pinned clue');
  await pressEnter(page);                                             // accepted after the ask, but the clue is missing
  await page.waitForSelector('.sheet .clue');
  check((await textOf(page, '#report-msg')) === 'Pick the clue that proves it.', 'no clue chosen yet: the partner asks for it');
  await page.click(`.sheet .clue[data-clue="${proofId}"]`);
  check((await textOf(page, '#blank-clue')).includes('“'), 'blank 3 shows the tapped clue');
  await audit(page, layout.insets, 'report');
  await pressEnter(page);
  await waitScreen(page, 'closed');

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
  check((await textOf(page, '#file-report')).includes('Martin Bell did it because it was a nice day'), 'the Archive shows the child\'s own case report');
  await audit(page, layout.insets, 'archive file');
  await page.click('#file-back'); await waitScreen(page, 'archive');
  await page.click('[data-back="home"]'); await waitScreen(page, 'home');

  // ---------- Erie case 1, fast: a wrong tap, a misplaced card, the keyboard; then the pacing ----------
  const E1 = CASE_BY_ID['erie-01'];
  await page.click('.case-card[data-case="erie-01"]');
  await doBrief(page, E1);
  await doDesk(page, E1);
  // the two-sentence question needs both pinned
  const q6 = E1.questions.find((q) => q.id === 'q6');
  await pickSentence(page, E1, 'd1s2'); await page.click('#nb-pin');                  // a wrong tap on q1 (first tap false)
  await pinAll(page, E1);
  await doRebuild(page, E1, { misplace: true });
  await page.click('#tl-go'); await waitBeat(page, 'solve');
  await typeText(page, 'tom fisk'); await pressEnter(page);
  await page.waitForSelector('#attach-msg');
  const proof1 = E1.solution.proof.find((id) => E1.questions.some((q) => q.answer.includes(id)));
  await page.click(`.clue[data-clue="${proof1}"]`); await page.click('#solve-go');
  await waitBeat(page, 'report');
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
  const home5 = await J(page, () => Object.fromEntries([...document.querySelectorAll('.case-card')].map((c) => [c.dataset.case, c.dataset.state])));
  check(home5.training === 'closed' && home5['erie-01'] === 'closed' && home5['erie-02'] === 'new', 'reload: the progress persists');

  // ---------- resume: leaving a case in the middle keeps it ----------
  await page.click('.case-card[data-case="erie-02"]');
  await doBrief(page, CASE_BY_ID['erie-02']);
  await page.click('#case-back'); await waitScreen(page, 'home');
  check((await J(page, () => document.querySelector('.case-card[data-case="erie-02"]').dataset.state)) === 'started', 'stopping mid-case is fine: the file says "Keep going"');
  await page.click('.case-card[data-case="erie-02"]');
  await waitBeat(page, 'investigate');
  check(true, 'and it resumes at the desk where the child stopped');
  await page.click('#case-back'); await waitScreen(page, 'home');

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
  const reports = await page.$$eval('.pz-report', (r) => r.map((x) => x.textContent));
  check(reports.length === 2 && reports.some((r) => r.includes('Martin Bell did it because it was a nice day')) && reports.some((r) => r.includes('Tom Fisk did it because the ticket is in the coat pocket')), `Parent Zone: the child's case reports, in full (${reports.length})`);
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
  check((await page.$$('.wordcard')).length === 2 && (await J(page, () => window.__caseFiles.run.rank)) === 5, 'rank 5 pre-teaches 2 words and starts a run at that rank');
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

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try { for (const l of LAYOUTS) await runLayout(browser, l); } finally { await browser.close(); }
  console.log(`\nscreenshots: ${SHOTS}`);
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n- ` + failures.join('\n- ')); process.exit(1); }
  console.log('\nALL CASE FILES UI CHECKS PASSED');
}
main().catch((e) => { console.error(e); process.exit(1); });
