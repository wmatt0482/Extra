// Plays every REAL case of Pip's Squirrel Chase (the New York tour, src/content/) end to end in a browser, portrait 390x844 and landscape 844x390, from the repo root:
//   bash build.sh && (cd dist && python3 -m http.server 8821 &)      then      BASE_URL=http://localhost:8821 node squirrel-chase/tools/content-play.mjs
//   (ONLY=portrait | landscape runs one part; CASES=ny-01,ny-02 plays only those (a prefix of the tour: a case opens only after the one before it closed); SHOTS_DIR=... keeps screenshots at deviceScaleFactor 2)
// Unlike ui-smoke.mjs (which runs on fixture content), this runs the shipped content with a real class list (the Nov 2 list of Spell Jump's class lists) and
// checks that every case plays exactly as written: the briefing's speakers and lines, the lead gang member (content name and art), the sign's gaps, every
// witness's own line and sealed note (spelling a list word opens it; the note text is the content's), a wrong city then the right city with the letter
// that the content says flies back, the hideout (place, password read by the natural voice, typed from memory, a missed word + the gentle fix step in
// one case), the gang's own lines, the postcard facts, the teaser and the closed screen. And the rules: only words / sentences / letters / the hideout
// sentence are spoken (natural clips; the device voice is never used), the shared 8-word mission advances in Spell Jump's records, close city pairs have
// big tap targets, no console errors, no horizontal scroll, layout clean.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CLASS_LIST_BY_ID } from '../../car-jump/src/data/classLists.js';
import { CASES, CITY_BY_ID, GANG_BY_ID } from '../src/content/index.js';
import { usedAsNoun } from '../src/logic/hideout.js';

const BASE = process.env.BASE_URL || 'http://localhost:8821';
const URL0 = BASE + '/squirrel-chase/index.html?nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'squirrel-chase-play-shots');
mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.ONLY || '';
const WANT = (process.env.CASES || '').split(',').filter(Boolean);
const PLAY = CASES.filter((c) => !WANT.length || WANT.includes(c.id));
const isTour = PLAY.every((c, i) => c.id === CASES[i].id);

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
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|only \d+ left|game over|lose|lost|fail(ed)?|gun|blood|energy|jail|arrest(ed)?|percent|penalty|punish)\b|\d+\s?%/i;
const COLD = 'The trail is cold here — check your clues.';
const LIST = CLASS_LIST_BY_ID['class-2026-11-02'];
const LIST_WORDS = LIST.words.map((w) => w.word);
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

const J = (page, fn, arg) => page.evaluate(fn, arg);
const visibleSel = (sel) => `${sel}:not([hidden])`;
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
    const desc = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : ''));
    for (const el of document.querySelectorAll('#app *')) {
      if (el.closest('#toasts, .letter-chip, .vehicle, .lab-root') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (!inScroller(el) && (b.right > W + 1 || b.left < -1)) out.push(`h-overflow ${desc(el)} [${Math.round(b.left)}..${Math.round(b.right)}]`);
      if (!inScroller(el) && (b.bottom > H + 1 || b.top < -1)) out.push(`v-overflow ${desc(el)} [${Math.round(b.top)}..${Math.round(b.bottom)}]`);
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push(`clipped text ${desc(el)}`);
    }
    for (const b of document.querySelectorAll('#app button, #app a[href], .lens-back button')) {
      if (!visible(b) || b.closest('.lab-root, .lab-chipx')) continue;
      const q = b.getBoundingClientRect();
      if (!q.width) continue;
      const sc = inScroller(b);
      if (b.classList.contains('kb-key') ? (q.height < 44 || q.width < W * 0.07) : Math.min(q.width, q.height) < 44) out.push(`tap target ${Math.round(q.width)}x${Math.round(q.height)} ${desc(b)}`);
      if (!sc && !b.closest('.lens-back') && q.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)}`);
      if (!sc && !b.closest('.lens-back') && (q.left < insets.l - 1 || q.right > W - insets.r + 1)) out.push(`inside side inset ${desc(b)}`);
      if (!sc && !b.closest('.lens-back') && q.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    for (const p of document.querySelectorAll('.b-text p, .clue, .hint-line, .msg, .wit-line')) {
      if (!visible(p)) continue;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      if (fs < 14 && innerWidth < 500) out.push(`small text ${fs}px ${desc(p)}`);
    }
    const natives = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')].filter((e) => !e.closest('#pz'));
    const links = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin).map((a) => a.href);
    return { out, natives: natives.map(desc), links };
  }, { insets });
  check(r.out.length === 0, `${label}: layout clean (no overflow, targets >= 44 px, clear of insets)${r.out.length ? ' — ' + r.out.slice(0, 6).join('; ') : ''}`);
  check(r.natives.length === 0, `${label}: no native inputs outside the Parent Zone${r.natives.length ? ' — ' + r.natives.join(', ') : ''}`);
  check(r.links.length === 0, `${label}: no external links`);
}
const kidAudit = async (page, label) => {
  const text = await J(page, () => [...document.querySelectorAll('.screen:not([hidden]), #spell:not([hidden])')].map((e) => e.innerText).join('\n'));
  const m = BANNED.exec(text);
  check(!m, `${label}: no banned words or percentages on a child screen${m ? ` — "${m[0]}"` : ''}`);
};

async function newPage(browser, layout, now) {
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/api/family/**', (r) => r.abort());
  await ctx.route('**/api/tts/**', (r) => r.abort());
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|ERR_INTERNET|ERR_ABORTED/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  const t = Date.now();
  const fam = { v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: t, updatedAt: t }], pinHash: null, pinUpdatedAt: 0, options: { pmia: { cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pmia: t }, removedPlayers: [], migrated: true, lastPlayer: 'pmia' };
  const words = {
    v: 1, lists: [{ id: LIST.id, name: LIST.name, createdAt: t - 1000, archivedAt: 0, pattern: '', sample: false, words: LIST.words.map((w) => ({ word: w.word, sentence: w.sentence || null, syllables: w.syllables || null })) }],
    activeId: LIST.id, records: {}, tests: [], qualifierPending: null, today: { date: '', count: 0, newCount: 0, missionPaid: false }, streak: 0, bestStreak: 0, perfectTotal: 0, progress: {},
  };
  await page.addInitScript(({ insets, now, fam, words }) => {
    if (!sessionStorage.getItem('sqSeeded')) {
      localStorage.clear();
      localStorage.setItem('spellJump.family', JSON.stringify(fam));
      localStorage.setItem('spellJump.pmia.words', JSON.stringify(words));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devS', keys: {} }));
      sessionStorage.setItem('sqSeeded', '1');
    }
    window.__squirrelNow = () => Number(localStorage.getItem('sqTestNow') || now);
    window.__cloudPlayed = []; window.__cloudAsked = []; window.__deviceSpoken = [];
    window.__ttsBackend = { speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__deviceSpoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (_) {} }, 5); }, cancel() {}, addEventListener() {}, resume() {}, pause() {} };
    try { const sy = window.speechSynthesis; if (sy) { const orig = sy.speak.bind(sy); sy.speak = (u) => { window.__deviceSpoken.push(String(u && u.text).trim()); return orig(u); }; } } catch (_) {}
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) { window.__cloudAsked.push({ code, voice, texts }); const clips = {}; for (const x of texts) clips[x] = '/api/tts/clip/' + hex(voice + '\n' + x); return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } }; },
      async load(url, text) { return { url, text, duration: 0.02 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 12)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets, now, fam, words });
  return { ctx, page, errors };
}

// ---------- reading the page ----------
const state = (page) => J(page, () => {
  const w = window.__squirrelChase, sp = w.spellPanel, r = w.run;
  return { screen: w.screen, spell: sp.isOpen ? sp.mode : null, word: sp.word, kbOn: !!document.querySelector('#sp-keyboard:not(.is-disabled)'),
    run: r ? { phase: r.phase, stop: r.stop, notes: r.notes, found: r.found, words: r.words, hideout: r.hideout } : null };
});
const wordsDocOf = (page, id = 'pmia') => J(page, (id) => JSON.parse(localStorage.getItem(`spellJump.${id}.words`) || 'null'), id);
const saveOf = (page, id = 'pmia') => J(page, (id) => JSON.parse(localStorage.getItem(`squirrelChase.${id}.save`) || 'null'), id);
const played = (page) => J(page, () => window.__cloudPlayed.slice());
const deviceSpoken = (page) => J(page, () => window.__deviceSpoken.slice());
const exists = (page, sel) => page.$(sel).then((e) => !!e);
const textOf = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const gapsOf = (page) => page.$$eval('#case-sign [data-gap]', (e) => e.map((x) => Number(x.getAttribute('data-gap'))).sort((a, b) => a - b));
const sortN = (a) => [...a].sort((x, y) => x - y);

async function typeKeys(page, root, text) {
  for (const ch of text) await page.click(`${root} .kb-key[data-key="${ch === ' ' ? 'space' : ch}"]`);
}
/** Spell the word on Spell Jump's panel, as a child would (a patient one types when the panel asks). `missFirst`: the first Write is wrong on purpose. */
async function spellNote(page, { missFirst = false, onPanel = null } = {}) {
  await page.waitForFunction(() => window.__squirrelChase.spellPanel.isOpen, null, { timeout: 15000 });
  let missed = false, sawPanel = false;
  const words = new Set(), modes = [];
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const s = await state(page);
    if (!s.spell) break;
    if (!sawPanel && onPanel) { sawPanel = true; await onPanel(s); }
    if (s.word) words.add(s.word);
    if (modes[modes.length - 1] !== s.spell) modes.push(s.spell);
    if (['write', 'cover', 'copy'].includes(s.spell) && s.kbOn && s.word) {
      if (missFirst && !missed && s.spell === 'write') { missed = true; await typeKeys(page, '#sp-keyboard', 'zzq'); await page.click('#sp-keyboard .kb-enter'); }
      else { await typeKeys(page, '#sp-keyboard', s.word); await page.click('#sp-keyboard .kb-enter'); }
      await page.waitForTimeout(80);
    } else await page.waitForTimeout(60);
  }
  return { words: [...words], modes };
}

// ---------- the map: pins, labels and tap targets (390 px phone and landscape) ----------
async function mapAudit(page, label, selector) {
  const r = await J(page, (sel) => {
    const box = document.querySelector(sel);
    const mb = box.getBoundingClientRect();
    const pins = [...box.querySelectorAll('.sqm-pin')].map((g) => {
      const sh = g.querySelector('.sqm-pin-shape').getBoundingClientRect(), hit = g.querySelector('.sqm-hit').getBoundingClientRect(), lab = g.querySelector('.sqm-label').getBoundingClientRect();
      return { id: g.dataset.city, cx: sh.left + sh.width / 2, cy: sh.top + sh.height / 2, hit: hit.width, lab: { l: lab.left, t: lab.top, r: lab.right, b: lab.bottom }, fs: parseFloat(getComputedStyle(g.querySelector('.sqm-label')).fontSize) * (mb.width / 720), name: g.getAttribute('aria-label').replace(/\s+/g, ''), text: g.querySelector('.sqm-label').textContent.replace(/\s+/g, '') };
    });
    return { w: mb.width, left: mb.left, right: mb.right, top: mb.top, bottom: mb.bottom, pins };
  }, selector);
  const ids = r.pins.map((p) => p.id);
  check(CITY_IDS.every((id) => ids.includes(id)), `${label}: every city has a pin (${ids.length}), Watkins Glen and Binghamton included`);
  check(r.pins.every((p) => p.text === p.name), `${label}: every pin has its label (${r.pins.filter((p) => p.text !== p.name).map((p) => p.id).join(', ') || 'all match'})`);
  const inside = r.pins.filter((p) => p.cx < r.left || p.cx > r.right || p.cy < r.top || p.cy > r.bottom || p.lab.l < r.left - 1 || p.lab.r > r.right + 1 || p.lab.t < r.top - 1 || p.lab.b > r.bottom + 1);
  check(inside.length === 0, `${label}: pins and labels are inside the map${inside.length ? ' — ' + inside.map((p) => p.id).join(', ') : ''}`);
  let overlaps = [];
  for (let i = 0; i < r.pins.length; i++) for (let j = i + 1; j < r.pins.length; j++) {
    const a = r.pins[i].lab, b = r.pins[j].lab;
    if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) overlaps.push(`${r.pins[i].id}/${r.pins[j].id}`);
  }
  check(overlaps.length === 0, `${label}: no two city labels overlap${overlaps.length ? ' — ' + overlaps.join(', ') : ''}`);
  const minFs = Math.min(...r.pins.map((p) => p.fs));
  check(minFs >= (r.w < 400 ? 11.5 : 13), `${label}: labels are readable (smallest ${minFs.toFixed(1)} px at map width ${Math.round(r.w)})`);
  // far pins: a hit target of 44 px or more; close pairs (< 50 px apart) are handled by the zoom-in list (checked where a pin is tapped)
  const far = [], close = [];
  for (const p of r.pins) {
    const near = r.pins.filter((q) => q !== p && Math.hypot(q.cx - p.cx, q.cy - p.cy) < 50);
    if (near.length) close.push(`${p.id}~${near.map((q) => q.id).join('+')}`); else if (p.hit < 44) far.push(`${p.id} ${Math.round(p.hit)}px`);
  }
  check(far.length === 0, `${label}: every city with room has a tap target of 44 px or more${far.length ? ' — ' + far.join(', ') : ''}`);
  return { close, pins: r.pins };
}
const CITY_IDS = Object.keys(CITY_BY_ID);

/** Tap a pin on the map at its head (a real thumb); returns whether the zoom-in list opened. */
async function tapPin(page, sel, id) {
  const c = await J(page, ({ sel, id }) => { const r = document.querySelector(`${sel} [data-city="${id}"] .sqm-pin-shape`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; }, { sel, id });
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(120);
  return exists(page, '#city-lens');
}
/** Choose a city on the map as a child does: a close pair opens the zoom-in list, so tap the city there. */
async function chooseOnMap(page, id, lensChecks = null) {
  const lens = await tapPin(page, '#travel-map', id);
  if (lens) {
    if (lensChecks) await lensChecks();
    await page.click(`#city-lens .lens-pin[data-city="${id}"]`);
  }
  return lens;
}

// ---------- one case ----------
async function playCase(page, layout, kase, idx, env) {
  const { allowedSentences, shotsFor } = env;
  console.log(`\n--- ${layout.name}: ${kase.id} ${kase.title} ---`);
  const active = LIST_WORDS;
  const lead = GANG_BY_ID[kase.lead];
  const route = kase.route;
  const swiped = kase.sign.swiped;

  // the board
  await page.waitForSelector(visibleSel('#screen-home'));
  check(await exists(page, `#btn-open-case[data-case="${kase.id}"]`), `${kase.id}: today's case is open on the board`);
  if (shotsFor) {
    await page.waitForTimeout(300);
    await shot(page, layout, `${kase.id}-01-home-map`);
  }
  if (idx === 0) {
    const m = await mapAudit(page, `${layout.name} case-board map`, '#home-map');
    env.closePairs = m.close;
    await audit(page, layout.insets, 'case board'); await kidAudit(page, 'case board');
  }
  await page.click(`#btn-open-case[data-case="${kase.id}"]`);
  await page.waitForSelector('#btn-start');

  // the briefing: the content's lines, in the content's speakers; the lead gang member with the CONTENT name and the matching art
  const bubbles = await page.$$eval('#case-body .bubble', (b) => b.map((x) => ({ cls: x.className, text: x.innerText })));
  const brief = bubbles.map((b) => b.text).join('\n');
  check(kase.briefing.every((l) => brief.includes(l.text)), `${kase.id}: the briefing shows every content line (${kase.briefing.length})`);
  check(bubbles.some((b) => /\bpip\b/.test(b.cls)) === kase.briefing.some((l) => l.who === 'pip'), `${kase.id}: Pip's lines are in Pip's bubble`);
  const culprit = norm(await textOf(page, '.culprit'));
  check(culprit.includes(lead.name) && culprit.includes(lead.animal) && culprit.includes(lead.reason.slice(0, 20)), `${kase.id}: today's letter-swiper is ${lead.name} the ${lead.animal} (content name and reason)`);
  check(await exists(page, `.culprit .gang-${lead.animal}`), `${kase.id}: the lead's portrait is the ${lead.animal} art`);
  check(!/Bandit|Snooze\b|Munch/.test(await J(page, () => document.body.innerText)), `${kase.id}: no placeholder gang names on screen`);
  check(sortN(await gapsOf(page)).join() === sortN(swiped).join(), `${kase.id}: the sign "${kase.sign.text}" shows the gaps ${kase.sign.gaps}`);
  const drawn = await J(page, () => [...document.querySelectorAll('#case-sign .sq-letter, #case-sign .sq-slot')].map((g) => (g.classList.contains('sq-slot') ? '_' : g.querySelector('text').textContent)).join(''));
  check(drawn === kase.sign.gaps.replace(/ /g, ''), `${kase.id}: the sign is drawn as ${kase.sign.gaps} (letters and empty slots in the right places: ${drawn})`);
  if (shotsFor) { await audit(page, layout.insets, `${kase.id} briefing`); await kidAudit(page, `${kase.id} briefing`); await shot(page, layout, `${kase.id}-02-briefing`); }
  await page.click('#btn-start');

  // the stops
  const wordsBeforeCase = (await wordsDocOf(page)).today.count;
  const spelledNotes = [];
  let travelShot = false;
  for (let i = 0; i < kase.stops.length; i++) {
    const stop = kase.stops[i], last = i === kase.stops.length - 1;
    await page.waitForSelector('.note.sealed');
    check((await textOf(page, '#step-chip')) === `Stop ${i + 1} of ${kase.stops.length}` && norm(await textOf(page, '.scene-text h2')) === CITY_BY_ID[stop.city].name, `${kase.id} stop ${i + 1}: ${CITY_BY_ID[stop.city].name}`);
    const lines = await page.$$eval('.note.sealed .wit-line', (e) => e.map((x) => x.textContent.trim()));
    const names = await page.$$eval('.note.sealed .wit-name', (e) => e.map((x) => x.textContent.trim()));
    check(stop.witnesses.every((w, k) => lines[k] === w.line && names[k] === w.name), `${kase.id} stop ${i + 1}: the witnesses ${stop.witnesses.map((w) => w.name).join(' and ')} say their own lines`);
    check(!(await page.$eval('#case-body', (e) => e.innerText)).includes(stop.witnesses[0].note), `${kase.id} stop ${i + 1}: the notes are sealed (their text is not on screen)`);
    if (shotsFor && i === 0) { await audit(page, layout.insets, `${kase.id} a stop with witnesses`); await kidAudit(page, `${kase.id} a stop`); await shot(page, layout, `${kase.id}-03-stop-witnesses`); }
    for (let w = 0; w < 2; w++) {
      const before = await wordsDocOf(page);
      await page.click(`.note.sealed[data-w="${w}"]`);
      const r = await spellNote(page, {
        missFirst: env.missNote && i === 0 && w === 0,
        onPanel: async () => {
          if (!shotsFor || i !== 0 || w !== 0) return;
          await page.waitForTimeout(500);
          await audit(page, layout.insets, `${kase.id} the spell panel`);
          await shot(page, layout, `${kase.id}-04-spell-panel`);
        },
      });
      const word = r.words[0];
      spelledNotes.push(word);
      await page.waitForSelector(`.note.open[data-w="${w}"]`);
      const note = await textOf(page, `.note.open[data-w="${w}"] .clue`);
      check(note === stop.witnesses[w].note, `${kase.id} stop ${i + 1} note ${w + 1}: spelled "${word}" -> the note reads exactly as written ("${(note || '').slice(0, 44)}…")`);
      check(active.includes(word), `  "${word}" is a word on the class list`);
      const after = await wordsDocOf(page);
      const rec = after.records[word], rec0 = before.records[word];
      check(rec && rec.seenCount === ((rec0 && rec0.seenCount) || 0) + 1 && after.today.count === ((before.today && before.today.count) || 0) + 1, `  "${word}" banked at once (seen ${(rec0 && rec0.seenCount) || 0} -> ${rec && rec.seenCount}; today's mission ${after.today.count})`);
      if (shotsFor && i === 0 && w === 0) { await audit(page, layout.insets, `${kase.id} an opened clue`); await shot(page, layout, `${kase.id}-05-opened-clue`); }
    }
    check(spelledNotes.length === (i + 1) * 2 && new Set(spelledNotes.slice(-2)).size === 2, `${kase.id} stop ${i + 1}: two different list words for two notes`);
    await page.click('#btn-follow');
    if (last) {
      check(stop.witnesses.every((w) => w.clueId === null), `${kase.id}: the hideout stop's notes lead to the hideout spot, not to a city`);
      break;
    }
    // travel
    await page.waitForSelector('#travel-map [data-city]');
    const recap = await textOf(page, '#clue-recap');
    check(stop.witnesses.every((w) => recap.includes(w.note)), `${kase.id}: the map shows both clues`);
    if (idx === 0 && i === 0) {
      const m = await mapAudit(page, `${layout.name} travel map`, '#travel-map');
      env.closePairs = m.close;
    }
    const nextId = route[i + 1];
    const wrong = CITY_IDS.find((c) => c !== nextId && c !== stop.city && !(env.closePairs || []).some((s) => s.startsWith(c + '~')));
    const before = await state(page);
    const lensWrong = await tapPin(page, '#travel-map', wrong);
    check(!lensWrong, `a city with room (${CITY_BY_ID[wrong].name}) is tapped directly`);
    check((await textOf(page, '#case-msg')) === COLD, `${kase.id}: a wrong city (${CITY_BY_ID[wrong].name}) gets "${COLD}"`);
    const after = await state(page);
    check(after.run.stop === before.run.stop && after.run.found.length === before.run.found.length, `${kase.id}: a wrong city costs nothing`);
    if (shotsFor && i === 0) { await shot(page, layout, `${kase.id}-06-wrong-city`, 200); }
    const gaps0 = await gapsOf(page);
    const lens = await chooseOnMap(page, nextId, async () => {
      if (!shotsFor || travelShot) return;
      await shot(page, layout, `${kase.id}-06b-close-pair-zoom`, 250);
      const lb = await page.$$eval('#city-lens .lens-pin', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height }; }));
      check(lb.length >= 2 && lb.every((q) => q.h >= 44 && q.w >= 44), `${kase.id}: the zoom-in list gives every close city a target of 44 px or more (${lb.length} cities)`);
      check(lb.every((q, k) => !lb.some((o, j) => j !== k && Math.min(q.r, o.r) - Math.max(q.l, o.l) > 0 && Math.min(q.b, o.b) - Math.max(q.t, o.t) > 0)), `${kase.id}: the zoom-in targets do not overlap`);
      await audit(page, layout.insets, `${kase.id} the zoom-in list`);
    });
    if (lens) env.lensSeen = true;
    if (shotsFor && i === 0 && !travelShot) { travelShot = true; await shot(page, layout, `${kase.id}-07-travel-letter`, 450); }
    await page.waitForFunction((s) => window.__squirrelChase.run.stop === s, i + 1, { timeout: 9000 });
    await page.waitForSelector('.note.sealed', { timeout: 9000 });
    await page.waitForTimeout(150);
    const gaps1 = await gapsOf(page);
    const landed = gaps0.filter((g) => !gaps1.includes(g));
    check(landed.length === 1 && landed[0] === swiped[i], `${kase.id}: the right city (${CITY_BY_ID[nextId].name}): the letter "${kase.sign.letters[i]}" lands on the sign (gap ${swiped[i]}; ${gaps0.length} -> ${gaps1.length} gaps)`);
  }

  // the hideout
  await page.waitForSelector('#btn-hear, #look-card');
  const hs = await state(page);
  const hid = hs.run.hideout;
  check(hs.run.phase === 'hideout' && !!hid && hid.words.length >= 2 && hid.words.length <= 3 && hid.words.every((x) => active.includes(x)), `${kase.id}: the password has 2 or 3 list words ("${hid.sentence}", source ${hid.source}${hid.template ? ' ' + hid.template : ''})`);
  allowedSentences.add(hid.sentence);
  env.sources.push(hid.source);
  if (hid.source === 'template') {
    const L = LIST.words;
    const nounWords = hid.words.filter((wd) => { const m = new RegExp(`the ${wd}\\b`, 'i'); return m.test(hid.sentence); });
    check(nounWords.every((wd) => usedAsNoun(wd, (L.find((x) => x.word === wd) || {}).sentence)), `${kase.id}: a list word after "the" in the template is a noun in its own list sentence (${nounWords.join(', ') || 'none'})`);
  }
  const hidText = norm(await J(page, () => document.querySelector('#screen-case').innerText));
  check(hidText.includes(kase.hideout.description) && hidText.includes(kase.hideout.place) === (layout.name === 'portrait'), `${kase.id}: the hideout place and description are the content's${layout.name === 'portrait' ? '' : ' (landscape keeps the description)'}`);
  const crew = await page.$$eval('.crew-faces .art', (e) => e.map((x) => x.innerHTML.match(/gang-(\w+)/)?.[1]));
  check(crew.join() === kase.crew.map((id) => GANG_BY_ID[id].animal).join() || (kase.crew.length > 1 && crew.length === kase.crew.length), `${kase.id}: the crew at the hideout is ${kase.crew.map((id) => GANG_BY_ID[id].name).join(', ')} (${crew.join(', ')})`);
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), hid.sentence, { timeout: 8000 });
  check(true, `${kase.id}: the natural voice read the password`);
  check(!(await exists(page, '#look-sentence')), 'the voice is on, so the sentence is not shown');
  if (shotsFor) { await audit(page, layout.insets, `${kase.id} the hideout`); await kidAudit(page, `${kase.id} the hideout`); await shot(page, layout, `${kase.id}-08-hideout`); }
  const target = hid.sentence.toLowerCase().replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();
  const doc0 = await wordsDocOf(page);
  let typedText = target;
  const missWord = env.missHideout ? hid.words[0] : null;
  if (missWord) typedText = target.replace(new RegExp(`\\b${missWord}\\b`), missWord.slice(0, -1) + 'x');
  await typeKeys(page, '#hide-keyboard', typedText);
  await page.waitForTimeout(150);
  await page.click('#hide-keyboard .kb-enter');
  await page.waitForSelector('#hide-result:not([hidden])');
  const doc1 = await wordsDocOf(page);
  const res = await J(page, () => ({ c: document.querySelector('#hide-result').dataset.correct, t: document.querySelector('#hide-result').dataset.total, text: document.querySelector('#hide-result').innerText }));
  if (!missWord) {
    check(res.c === res.t && Number(res.t) === hid.words.length && /accepted/i.test(res.text), `${kase.id}: the dictation is scored ${res.c} of ${res.t}`);
    for (const wd of hid.words) check(doc1.records[wd].seenCount === ((doc0.records[wd] && doc0.records[wd].seenCount) || 0) + 1, `  hideout word "${wd}" banked as a retrieval`);
  } else {
    check(Number(res.c) === hid.words.length - 1 && /close/i.test(res.text), `${kase.id}: a missed word in the password is marked (${res.c} of ${res.t})`);
    const r1 = doc1.records[missWord], r0 = doc0.records[missWord] || {};
    check(r1.seenCount === (r0.seenCount || 0) + 1 && (r1.misses || 0) >= (r0.misses || 0) + 1 && (r1.firstTry || 0) === (r0.firstTry || 0), `  the missed hideout word "${missWord}" banked as a miss (misses ${(r0.misses || 0)} -> ${r1.misses})`);
    await page.waitForSelector('#fix-step');
    check((await textOf(page, '#fix-word')) === missWord, `  the gentle fix step shows the right spelling "${missWord}"`);
    check(!(await exists(page, '#btn-letters')), '  the letters wait until the word is typed again');
    await shot(page, layout, `${kase.id}-08b-hideout-fix`, 150);
    await page.waitForFunction(() => document.querySelector('#fix-word').textContent.includes('•'), null, { timeout: 4500 });
    check(true, '  the word is covered again after about 3 seconds');
    await typeKeys(page, '#hide-keyboard', 'zz'); await page.click('#hide-keyboard .kb-enter');
    await page.waitForFunction(() => !document.querySelector('#fix-word').textContent.includes('•'), null, { timeout: 3000 });
    check((await textOf(page, '#fix-word')) === missWord, '  a wrong retype shows the word again, gently (nothing is lost)');
    await page.waitForFunction(() => document.querySelector('#fix-word').textContent.includes('•'), null, { timeout: 4500 });
    await typeKeys(page, '#hide-keyboard', missWord); await page.click('#hide-keyboard .kb-enter');
    await page.waitForSelector('#btn-letters');
    check(true, '  the word typed right: the gang steps in');
  }
  await page.waitForSelector('#gang-lines');
  const glines = await page.$$eval('#gang-lines .bubble', (b) => b.map((x) => ({ name: x.querySelector('.who-name').textContent.trim(), text: x.querySelector('p').textContent.trim(), art: (x.innerHTML.match(/gang-(\w+)/) || [])[1] })));
  check(glines.length === kase.hideout.gangLines.length && kase.hideout.gangLines.every((l, k) => glines[k].text === l.text && glines[k].name === GANG_BY_ID[l.who].name && glines[k].art === GANG_BY_ID[l.who].animal), `${kase.id}: the gang's own lines, with their content names and art (${[...new Set(glines.map((g) => g.name))].join(', ')})`);
  if (shotsFor) { await audit(page, layout.insets, `${kase.id} the hideout result`); await kidAudit(page, `${kase.id} the hideout result`); await shot(page, layout, `${kase.id}-09-hideout-gang`, 450); }
  const gapsB = await gapsOf(page);
  const expectBack = sortN(swiped.slice(route.length - 1));
  check(layout.name === 'landscape' || gapsB.join() === expectBack.join(), `${kase.id}: ${expectBack.length} letter(s) are still missing at the hideout (${kase.sign.letters.slice(route.length - 1)})`);
  await page.click('#btn-letters');

  // closed
  await page.waitForSelector(visibleSel('#screen-closed'), { timeout: 10000 });
  await page.waitForSelector('#closed-postcard');
  check((await page.$$('#screen-closed [data-gap]')).length === 0, `${kase.id}: every letter is back: the sign is whole`);
  check((await page.$$eval('#closed-postcard li', (l) => l.map((x) => x.textContent.trim()))).join('|') === kase.postcard.facts.map((f) => f.text).join('|'), `${kase.id}: the postcard from ${CITY_BY_ID[kase.postcard.city].name} has the content's 2 facts`);
  const apology = kase.hideout.gangLines[kase.hideout.gangLines.length - 1];
  check(norm(await textOf(page, '#gang-line')) === `${GANG_BY_ID[apology.who].name}: ${apology.text}`, `${kase.id}: the closed screen has the gang's apology`);
  const isFinal = kase.id === CASES[CASES.length - 1].id;
  check(isFinal ? !(await exists(page, '#teaser')) : (await textOf(page, '#teaser')) === kase.teaser, `${kase.id}: ${isFinal ? 'the finale ends the tour' : 'the teaser points at the next case'}`);
  check(/Case closed/.test(await textOf(page, '#see-you')), `${kase.id}: "${await textOf(page, '#see-you')}"`);
  await page.waitForFunction(() => { const p = document.querySelector('#payout'); return p && p.dataset.coins === '40'; }, null, { timeout: 8000 }).then(() => check(true, `${kase.id}: the Lab paid the flat reward`), () => check(false, `${kase.id}: the Lab payout arrived`));
  if (shotsFor) { await audit(page, layout.insets, `${kase.id} closed`); await kidAudit(page, `${kase.id} closed`); await shot(page, layout, `${kase.id}-10-closed`, 700); }
  const sv = await saveOf(page);
  check(sv.closed[kase.id] && sv.album.includes(kase.postcard.city), `${kase.id}: saved as closed, postcard in the album`);
  const doc2 = await wordsDocOf(page);
  const bankedNow = doc2.today.count - wordsBeforeCase;
  check(bankedNow === spelledNotes.length + hid.words.length, `${kase.id}: Spell Jump's records advanced by ${bankedNow} words (${spelledNotes.length} notes + ${hid.words.length} password words)`);
  env.totalWords += bankedNow;
}

async function playLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height}: ${PLAY.map((c) => c.id).join(' ')} ===`);
  const start = Date.UTC(2026, 10, 9, 15);
  const { ctx, page, errors } = await newPage(browser, layout, start);
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-home'));
  const allowedSentences = new Set();
  const env = { allowedSentences, sources: [], totalWords: 0, closePairs: [], lensSeen: false };
  let day = 0;
  for (let i = 0; i < PLAY.length; i++) {
    const kase = PLAY[i];
    env.shotsFor = i === 0 || kase.id === 'ny-04' || kase.id === 'ny-06';
    env.missHideout = kase.id === 'ny-03';
    env.missNote = i === 0;
    if (i > 0) {
      if (kase.id === 'ny-03') {                                   // the Parent Zone's "Open the next case now" (same day)
        await page.waitForSelector(visibleSel('#screen-home'));
        check(!(await exists(page, '#btn-open-case')), 'the next case is still sealed the same day');
        await page.click('#btn-parents');
        await page.waitForSelector('#pin-title');
        for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
        await page.waitForSelector('#pin-title:has-text("again")');
        for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
        await page.waitForSelector('#pz-open-next');
        await page.click('#pz-open-next');
        await page.click('#pz-close');
        await page.waitForSelector(visibleSel('#screen-home'));
      } else {
        day++;
        await J(page, (t) => localStorage.setItem('sqTestNow', String(t)), start + day * 86400000);
        await page.click('#btn-player'); await page.waitForSelector(visibleSel('#screen-players'));
        await page.click('[data-player="pmia"]'); await page.waitForSelector(visibleSel('#screen-home'));
      }
    }
    await playCase(page, layout, kase, i, env);
    await page.click('#closed-home');
  }
  // the album: every postcard
  await page.click('#btn-album');
  await page.waitForSelector(visibleSel('#screen-album'));
  check((await page.$$('.album-grid .postcard')).length === PLAY.length, `the album has ${PLAY.length} postcards`);
  await audit(page, layout.insets, 'the album'); await shot(page, layout, 'album', 500);
  await page.click('#screen-album [data-back="home"]');
  await page.waitForSelector(visibleSel('#screen-home'));
  await shot(page, layout, 'home-closed', 300);
  if (PLAY.length === CASES.length) { await mapAudit(page, `${layout.name} board map after the tour`, '#home-map'); }

  // the rules over the whole run
  const spoken = await played(page);
  const allowed = new Set(await J(page, async () => {
    const CV = await import('/spell-jump/src/spelling/cloudVoice.js'), PF = await import('/spell-jump/src/spelling/profiles.js');
    const out = new Set();
    for (const l of PF.loadWords('pmia').lists) for (const w of l.words) for (const t of CV.wordTexts(w)) out.add(t);
    for (const ch of "abcdefghijklmnopqrstuvwxyz'- ") out.add(CV.cloudLetterText(ch));
    return [...out];
  }));
  for (const s of allowedSentences) allowed.add(s);
  const stray = spoken.filter((t) => !allowed.has(t));
  check(spoken.length > 50 && stray.length === 0, `the only spoken texts are words, their sentences, letters and the hideout sentences (${spoken.length} clips${stray.length ? '; stray: ' + stray.slice(0, 4).join(' | ') : ''})`);
  check(PLAY.every((c) => spoken.some((t) => allowedSentences.has(t))) && [...allowedSentences].every((s) => spoken.includes(s)), `every hideout password was spoken (${allowedSentences.size})`);
  check(!spoken.some((t) => /scribble|chief|squiggle|squirrel chase|sealed|clue|trail/i.test(t) && !allowed.has(t)), 'no briefing, witness line, clue or UI text was ever spoken');
  const dev = await deviceSpoken(page);
  check(dev.filter((t) => t && t !== 'ready').length === 0, `the device voice was never used${dev.length ? ' (' + dev.slice(0, 3).join(', ') + ')' : ''}`);
  const doc = await wordsDocOf(page);
  check(doc.today.count >= 8 && doc.today.missionPaid === true, `the shared 8-word mission advanced and completed in Spell Jump's records (today ${doc.today.count}, paid)`);
  const bad = Object.keys(doc.records).filter((w) => !LIST_WORDS.includes(w));
  check(bad.length === 0, `only class-list words were ever recorded (${Object.keys(doc.records).length} different words, ${env.totalWords} retrievals)`);
  console.log(`  (hideout sentences came from: ${env.sources.join(', ')}; close-pair zoom-in seen: ${env.lensSeen})`);
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS) await playLayout(browser, layout);
} catch (e) { failures.push('crashed: ' + (e && e.stack || e)); console.log('  ✗ crashed: ' + (e && e.stack || e)); }
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nALL SQUIRREL CHASE CONTENT-PLAY CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
