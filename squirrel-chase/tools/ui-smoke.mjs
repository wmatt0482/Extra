// Playwright smoke test of Pip's Squirrel Chase, portrait 390x844 and landscape 844x390 (iPhone safe-area insets faked), from the repo root:
//   bash build.sh && (cd dist && python3 -m http.server 8811 &)      then      BASE_URL=http://localhost:8811 node squirrel-chase/tools/ui-smoke.mjs
//   (ONLY=portrait | landscape runs one part; SHOTS_DIR=... keeps the screenshots at deviceScaleFactor 2)
// The page runs on the fixture content (tools/fixtures/content.js, served in place of src/content/index.js by a route), so this test does not
// depend on the final cases. A MOCKED natural voice (window.__cloudVoiceBackend: no network, no WebAudio) and a SPY on the device voice
// (window.__ttsBackend and speechSynthesis) record everything that is spoken. It plays a whole case: the picker, the case board, the briefing,
// two sealed witness notes per stop (the shared Spell Jump panel, a miss and its fix), a wrong city (the gentle line, no penalty), the right cities
// (the plane / train, one letter flying onto the sign), the hideout dictation (voice, typed from memory, scored), the postcard, the closed screen
// (never starts the next case), leaving mid-case and resuming, the next day's case, the Parent Zone, and the rules: the only spoken texts are the
// words, their sentences, the letters and the hideout sentence; the device voice is never used; words come only from the active list and bank in
// the shared store; no console errors; no horizontal scroll.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACTIVE_WORDS, ARCHIVED_WORDS, familyDoc, wordsDoc } from './fixtures/seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:8811';
const URL0 = BASE + '/squirrel-chase/index.html?nosw=1';
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'squirrel-chase-ui-shots');
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
const BANNED = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|lives|life left|wrong|timer|countdown|hurry|time'?s up|seconds? left|only \d+ left|game over|lose|lost|fail(ed)?|gun|blood|energy|jail|arrest(ed)?|percent|penalty|punish)\b|\d+\s?%/i;
const COLD = 'The trail is cold here — check your clues.';

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
    for (const b of document.querySelectorAll('#app button, #app a[href]')) {
      if (!visible(b) || b.closest('.lab-root, .lab-chipx')) continue;
      const q = b.getBoundingClientRect();
      if (!q.width) continue;
      const sc = inScroller(b);
      if (b.classList.contains('kb-key') ? (q.height < 44 || q.width < W * 0.07) : Math.min(q.width, q.height) < 44) out.push(`tap target ${Math.round(q.width)}x${Math.round(q.height)} ${desc(b)}`);
      if (!sc && q.bottom > H - insets.b + 1) out.push(`under home indicator ${desc(b)}`);
      if (!sc && (q.left < insets.l - 1 || q.right > W - insets.r + 1)) out.push(`inside side inset ${desc(b)}`);
      if (!sc && q.top < insets.t - 1) out.push(`under status bar ${desc(b)}`);
    }
    for (const p of document.querySelectorAll('.b-text p, .clue, .hint-line, .msg')) {
      if (!visible(p)) continue;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      if (fs < 16 && innerWidth < 500) out.push(`small text ${fs}px ${desc(p)}`);
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

async function newPage(browser, layout, { voice = true, now = null, seed = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/api/family/**', (r) => r.abort());
  const net = { tts: 0 };
  await ctx.route('**/api/tts/**', (r) => { net.tts++; return r.abort(); });
  await ctx.route('**/squirrel-chase/src/content/index.js', (r) => r.fulfill({ status: 200, body: readFileSync(path.join(here, 'fixtures', 'content.js')), contentType: 'text/javascript' }));
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|ERR_INTERNET|ERR_ABORTED/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  const t = Date.now();
  await page.addInitScript(({ insets, voice, now, seed, fam, words }) => {
    if (!sessionStorage.getItem('sqSeeded')) {
      if (seed) {
        localStorage.clear();
        localStorage.setItem('spellJump.family', JSON.stringify(fam));
        localStorage.setItem('spellJump.pmia.words', JSON.stringify(words));
        if (voice) localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devS', keys: {} }));
      }
      sessionStorage.setItem('sqSeeded', '1');
    }
    if (now) window.__squirrelNow = () => Number(localStorage.getItem('sqTestNow') || now);
    window.__cloudPlayed = []; window.__cloudAsked = []; window.__deviceSpoken = [];
    // the device voice: a spy on both ways in (the test backend and the real speechSynthesis); the game must never touch either
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
  }, { insets: layout.insets, voice, now, seed, fam: familyDoc(t, { voice: voice ? 'en-US-Neural2-F' : '' }), words: wordsDoc(t) });
  return { ctx, page, errors, net };
}

// ---------- reading the page ----------
const state = (page) => J(page, () => {
  const w = window.__squirrelChase, sp = w.spellPanel, r = w.run;
  return { screen: w.screen, spell: sp.isOpen ? sp.mode : null, word: sp.word, kbOn: !!document.querySelector('#sp-keyboard:not(.is-disabled)'),
    run: r ? { phase: r.phase, stop: r.stop, notes: r.notes, found: r.found, words: r.words, hideout: r.hideout } : null };
});
const model = (page) => J(page, async () => {
  const m = await import('/squirrel-chase/src/logic/caseModel.js');
  const one = (c) => ({ title: c.title, sign: m.signOf(c), missing: m.missingOf(c), stops: m.stopsOf(c).map((s) => ({ cityId: s.cityId, next: s.next, last: s.last, clues: s.witnesses.map((x) => x.clue) })), postcard: m.postcardOf(c).facts, route: m.routeOf(c) });
  return { seq: m.SEQUENCE, cases: Object.fromEntries(m.CASE_LIST.map((c) => [c.id, one(c)])), cities: m.CITY_LIST.map((c) => ({ id: c.id, name: c.name })) };
});
const wordsDocOf = (page, id = 'pmia') => J(page, (id) => JSON.parse(localStorage.getItem(`spellJump.${id}.words`) || 'null'), id);
const saveOf = (page, id = 'pmia') => J(page, (id) => JSON.parse(localStorage.getItem(`squirrelChase.${id}.save`) || 'null'), id);
const played = (page) => J(page, () => window.__cloudPlayed.slice());
const deviceSpoken = (page) => J(page, () => window.__deviceSpoken.slice());
const exists = (page, sel) => page.$(sel).then((e) => !!e);
const textOf = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);

async function typeKeys(page, root, text) {
  for (const ch of text) await page.click(`${root} .kb-key[data-key="${ch === ' ' ? 'space' : ch}"]`);
}
/** Spell the word on Spell Jump's panel, as a child would: a patient child types when the panel asks. `missFirst`: the first Write is wrong on purpose. */
async function spellNote(page, { missFirst = false, onPanel = null } = {}) {
  await page.waitForFunction(() => window.__squirrelChase.spellPanel.isOpen, null, { timeout: 15000 });
  let missed = false, sawPanel = false, words = new Set(), modes = [];
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

// ---------- one layout: a whole case ----------
async function playLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height} ===`);
  const { ctx, page, errors } = await newPage(browser, layout, { now: Date.UTC(2026, 10, 9, 15) });
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  const M = await model(page);
  const c1 = M.cases[M.seq[0]];
  const active = ACTIVE_WORDS.map((w) => w.word);
  const archived = ARCHIVED_WORDS.map((w) => w.word);

  // ----- the picker -----
  check((await page.$$eval('#player-grid .pl-tile[data-player]', (t) => t.map((x) => x.dataset.player))).join() === 'pmia,pleo', 'the picker shows the family\'s two players');
  check((await textOf(page, '#screen-players h2')) === "Who's on the chase?", 'the picker title is "Who\'s on the chase?"');
  await page.waitForSelector('#player-grid .lab-pickbtn', { timeout: 8000 }).then(() => check(true, 'the Lab\'s picker button is in the player block'), () => check(false, 'the Lab\'s picker button is in the player block'));
  await audit(page, layout.insets, 'picker'); await kidAudit(page, 'picker');
  await shot(page, layout, '01-picker');

  // ----- the case board -----
  await page.click('[data-player="pmia"]');
  await page.waitForSelector(visibleSel('#screen-home'));
  await page.waitForSelector('#lab-slot-home .lab-chipx', { timeout: 8000 }).then(() => check(true, 'the case board has the Lab chip (top-left slot)'), () => check(false, 'the case board has the Lab chip'));
  check((await page.$$('#home-map [data-city]')).length === M.cities.length, `the map shows every city as a tappable pin (${M.cities.length})`);
  check(await exists(page, '#btn-open-case[data-state="new"]') && (await textOf(page, '#btn-open-case')) === 'Start the chase', 'today\'s case is open: "Start the chase"');
  check(!(await exists(page, '#next-note')), 'no "Next case tomorrow" while a case is waiting');
  check((await page.$$eval('.stamp-card.sealed', (e) => e.length)) === M.seq.length - 1 && !(await page.$eval('.home-side', (e) => e.innerText)).includes(M.cases[M.seq[1]].title), 'the next case is sealed: its title is not shown');
  check(!!(await J(page, () => window.__squirrelChase.save.opened['ny-01'])) && !(await J(page, () => window.__squirrelChase.save.opened['ny-02'])), 'one case opens on the first day');
  await audit(page, layout.insets, 'case board'); await kidAudit(page, 'case board');
  await shot(page, layout, '02-home-map');

  // ----- the briefing -----
  await page.click('#btn-open-case');
  await page.waitForSelector('#btn-start');
  const brief = await textOf(page, '.bubble.chief');
  check(brief.length > 20 && (await exists(page, '#case-sign svg')), 'the briefing is the Chief\'s text and the sign with its gaps is shown');
  check((await page.$$('#case-sign [data-gap]')).length === c1.missing.length, `the sign shows ${c1.missing.length} gaps`);
  check((await played(page)).length === 0, 'the briefing is silent text (nothing was spoken)');
  await audit(page, layout.insets, 'briefing'); await kidAudit(page, 'briefing');
  await shot(page, layout, '03-briefing');
  await page.click('#btn-start');

  // ----- the stops -----
  const spelled = [];
  let firstPanelShot = false, missDone = false, coldShown = false;
  for (let i = 0; i < c1.stops.length; i++) {
    const stop = c1.stops[i];
    await page.waitForSelector('.note.sealed');
    check((await page.$$('.note.sealed')).length === 2 && (await page.$$('.note.open')).length === 0, `stop ${i + 1}: two sealed witness notes`);
    if (i === 0) { await audit(page, layout.insets, 'a stop with sealed notes'); await kidAudit(page, 'a stop'); await shot(page, layout, '04-stop-sealed-notes'); }
    for (let w = 0; w < 2; w++) {
      const before = await wordsDocOf(page);
      await page.click(`.note.sealed[data-w="${w}"]`);
      const wantMiss = !missDone && i === 0 && w === 0;
      const r = await spellNote(page, {
        missFirst: wantMiss,
        onPanel: async (s) => {
          if (firstPanelShot) return;
          firstPanelShot = true;
          check(await page.$eval('#spell', (e) => !e.hidden) && (await exists(page, '#sp-keyboard')), 'a sealed note opens Spell Jump\'s spell panel (audio first, the keyboard, "Hear it")');
          check(/Today \d+ \/ 8/.test(await textOf(page, '#sp-chip')), 'the panel chip shows the shared mission ("Today n / 8")');
          await page.waitForTimeout(500);
          await audit(page, layout.insets, 'the spell panel');
          await shot(page, layout, '05-spell-panel');
        },
      });
      if (wantMiss) {
        missDone = true;
        check(r.modes.includes('compare') || r.modes.includes('copy'), `a miss: the panel compares, then copies and covers (fix) — modes ${r.modes.join(' > ')}`);
      }
      const word = r.words[0];
      spelled.push(word);
      await page.waitForSelector(`.note.open[data-w="${w}"]`);
      const clue = await textOf(page, `.note.open[data-w="${w}"] .clue`);
      check(clue === stop.clues[w], `stop ${i + 1} note ${w + 1}: the note opens with its text clue ("${(clue || '').slice(0, 40)}…")`);
      check(active.includes(word), `the word "${word}" is from the active list`);
      const after = await wordsDocOf(page);
      const rec = after.records[word], rec0 = before.records[word];
      check(rec && rec.seenCount === ((rec0 && rec0.seenCount) || 0) + 1, `"${word}" banked at once in the shared store (seenCount ${(rec0 && rec0.seenCount) || 0} -> ${rec && rec.seenCount})`);
      check(after.today.count === ((before.today && before.today.count) || 0) + 1, `today's shared mission count went up (${after.today.count})`);
      if (wantMiss) check(rec.firstTry === ((rec0 && rec0.firstTry) || 0) && rec.misses >= 1, `the missed word "${word}" counts as a miss (fixed, not first try)`);
      if (i === 0 && w === 0) { await audit(page, layout.insets, 'an opened clue'); await shot(page, layout, '06-opened-clue'); }
    }
    check((await page.$$('.note.open')).length === 2, `stop ${i + 1}: both notes are open`);
    check(!(await exists(page, '#travel-map')), 'no map before both notes are open');
    await page.click('#btn-follow');
    if (stop.last) break;
    // travel: the map
    await page.waitForSelector('#travel-map [data-city]');
    check((await textOf(page, '#clue-recap')).includes(stop.clues[0]) && (await textOf(page, '#clue-recap')).includes(stop.clues[1]), 'the map shows both clues');
    const wrong = M.cities.find((c) => c.id !== stop.next && c.id !== stop.cityId) || M.cities[0];
    const before = await state(page);
    await page.click(`#travel-map [data-city="${wrong.id}"]`);
    check((await textOf(page, '#case-msg')) === COLD, `a wrong city ("${wrong.name}") gets the gentle line: "${COLD}"`);
    const after = await state(page);
    check(after.run.stop === before.run.stop && after.run.phase === 'travel' && after.run.found.length === before.run.found.length, 'a wrong city costs nothing: same stop, no letter, no counter');
    if (!coldShown) { coldShown = true; await audit(page, layout.insets, 'a wrong city'); await kidAudit(page, 'a wrong city'); await shot(page, layout, '07-wrong-city'); }
    const gaps0 = await page.$$eval('#case-sign [data-gap]', (e) => e.length);
    await page.click(`#travel-map [data-city="${stop.next}"]`);
    if (i === 0) await shot(page, layout, '08-travel-and-letter', 450);
    await page.waitForFunction((s) => window.__squirrelChase.run.stop === s, i + 1, { timeout: 8000 });
    await page.waitForSelector('.note.sealed', { timeout: 8000 });
    await page.waitForTimeout(150);
    const gaps1 = await page.$$eval('#case-sign [data-gap]', (e) => e.length);
    check(gaps1 === gaps0 - 1, `the right city: the plane flies and a recovered letter lands on the sign (${gaps0} -> ${gaps1} gaps)`);
    check((await textOf(page, '#step-chip')) === `Stop ${i + 2} of ${c1.stops.length}`, 'the next stop is shown');
  }

  // ----- leaving mid-hideout is not needed: the hideout -----
  await page.waitForSelector('#btn-hear, #look-card');
  const hideState = await state(page);
  check(hideState.run.phase === 'hideout' && !!hideState.run.hideout && hideState.run.hideout.words.length >= 2 && hideState.run.hideout.words.length <= 3, `the hideout password has 2 or 3 list words ("${hideState.run.hideout.sentence}", source ${hideState.run.hideout.source})`);
  check(hideState.run.hideout.words.every((x) => active.includes(x)), 'the hideout words are on the active list');
  await page.waitForFunction((t) => window.__cloudPlayed.includes(t), hideState.run.hideout.sentence, { timeout: 8000 });
  check(true, 'the voice read the hideout sentence (natural clip)');
  check(!(await exists(page, '#look-sentence')) && !(await page.$eval('#screen-case', (e) => e.innerText)).includes(hideState.run.hideout.sentence), 'with the voice on the sentence is not shown');
  await audit(page, layout.insets, 'the hideout'); await kidAudit(page, 'the hideout');
  await shot(page, layout, '09-hideout');
  const target = hideState.run.hideout.sentence.toLowerCase().replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();
  const doc0 = await wordsDocOf(page);
  const letters0 = (await played(page)).length;
  await typeKeys(page, '#hide-keyboard', target);
  check((await played(page)).length > letters0, 'typed letters are spoken as they are typed');
  await page.waitForTimeout(150);
  check((await textOf(page, '#type-box')).replace(/\s+/g, ' ').includes(target), 'the typed sentence shows (no punctuation or capitals needed)');
  await page.click('#hide-keyboard .kb-enter');
  await page.waitForSelector('#hide-result:not([hidden])');
  const doc1 = await wordsDocOf(page);
  const res = await J(page, () => ({ c: document.querySelector('#hide-result').dataset.correct, t: document.querySelector('#hide-result').dataset.total, text: document.querySelector('#hide-result').innerText }));
  check(res.c === res.t && Number(res.t) === hideState.run.hideout.words.length && /accepted/i.test(res.text), `the dictation is scored: ${res.c} of ${res.t} list words right`);
  for (const wd of hideState.run.hideout.words) check(doc1.records[wd].seenCount === ((doc0.records[wd] && doc0.records[wd].seenCount) || 0) + 1, `hideout word "${wd}" banked as a retrieval`);
  await audit(page, layout.insets, 'the hideout result'); await kidAudit(page, 'the hideout result');
  await shot(page, layout, '10-hideout-result');
  const gapsB = await page.$$eval('#case-sign [data-gap]', (e) => e.length);
  await page.click('#btn-letters');

  // ----- closed -----
  await page.waitForSelector(visibleSel('#screen-closed'), { timeout: 10000 });
  await page.waitForSelector('#closed-postcard');
  check((await textOf(page, '#see-you')) === 'Case closed — see you tomorrow.', 'the closed screen says "Case closed — see you tomorrow."');
  check((await page.$$('#screen-closed [data-gap]')).length === 0, 'the letters are returned: the sign is whole');
  check((await page.$$eval('#closed-postcard li', (l) => l.map((x) => x.textContent.trim()))).join('|') === c1.postcard.join('|') && c1.postcard.length === 2, 'the postcard has the city illustration and 2 facts');
  await page.waitForFunction(() => { const p = document.querySelector('#payout'); return p && p.dataset.coins === '40'; }, null, { timeout: 8000 }).then(() => check(true, 'the Lab paid the flat +40 coins / +55 XP for the closed case'), async () => check(false, `the Lab payout arrived (payout: ${await J(page, () => document.querySelector('#payout').outerHTML)})`));
  check(!(await exists(page, '#screen-home:not([hidden]) #btn-open-case')) && (await J(page, () => !window.__squirrelChase.save.opened['ny-02'])), 'closing a case never starts another (the next case stays sealed)');
  await audit(page, layout.insets, 'the closed screen'); await kidAudit(page, 'the closed screen');
  await shot(page, layout, '11-closed', 700);
  const sv = await saveOf(page);
  check(sv.closed['ny-01'] && sv.closed['ny-01'].words.length >= 6 && sv.closed['ny-01'].hideout.total === hideState.run.hideout.words.length && sv.album.join() === c1.route[c1.route.length - 1], `the save has the closed record (${sv.closed['ny-01'].words.length} words, hideout ${sv.closed['ny-01'].hideout.correct}/${sv.closed['ny-01'].hideout.total}) and the postcard in the album`);
  const doc2 = await wordsDocOf(page);
  check(doc2.today.count >= 8 && doc2.today.missionPaid === true, `the shared 8-word mission completed through the case (today's count ${doc2.today.count}, paid)`);
  check(archived.every((a) => !doc2.records[a] || doc2.records[a].seenCount === 0), 'archived list words never came up');
  void gapsB; void spelled;
  await page.click('#closed-album');
  await page.waitForSelector(visibleSel('#screen-album'));
  check((await page.$$('.album-grid .postcard')).length === 1, 'the postcard album has the postcard');
  await audit(page, layout.insets, 'the album'); await shot(page, layout, '12-album');
  await page.click('#screen-album [data-back="home"]');
  await page.waitForSelector(visibleSel('#screen-home'));
  check(await exists(page, '#next-note') && /Next case tomorrow/.test(await textOf(page, '#next-note')), 'the board says "Next case tomorrow." (no countdown)');
  check(!(await exists(page, '#screen-home:not([hidden]) #btn-open-case')) && (await page.$$('.stamp-card[data-state="closed"]')).length === 1, 'the closed case shows its postcard stamp; the next case is still sealed');
  await shot(page, layout, '13-home-closed');
  // the next local day: the next case opens
  await J(page, (t) => localStorage.setItem('sqTestNow', String(t)), Date.UTC(2026, 10, 10, 15));
  await page.click('#btn-player'); await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]'); await page.waitForSelector(visibleSel('#screen-home'));
  check(await exists(page, '#btn-open-case[data-case="ny-02"]'), 'the next day opens case 2');

  // ----- leaving mid-case and resuming at the same stop -----
  await page.click('#btn-open-case'); await page.click('#btn-start');
  await page.waitForSelector('.note.sealed');
  await page.click('.note.sealed[data-w="0"]');
  await spellNote(page);
  await page.waitForSelector('.note.open[data-w="0"]');
  const midWords = (await wordsDocOf(page)).today.count;
  await page.click('#case-back');
  await page.waitForSelector(visibleSel('#screen-home'));
  const pre = { played: await played(page), asked: await J(page, () => window.__cloudAsked.flatMap((a) => a.texts)), dev: await deviceSpoken(page) };      // (the reload below starts a new page)
  check((await textOf(page, '#btn-open-case')) === 'Keep chasing', 'leaving mid-case: the board says "Keep chasing"');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]'); await page.waitForSelector(visibleSel('#screen-home'));
  await page.click('#btn-open-case');
  await page.waitForSelector('.note.open[data-w="0"]');
  const rs = await state(page);
  check(rs.run.phase === 'stop' && rs.run.stop === 0 && (await page.$$('.note.open')).length === 1 && (await page.$$('.note.sealed')).length === 1, 'resumed at the same stop with the answered note still open (also after a reload)');
  check((await wordsDocOf(page)).today.count === midWords, 'the answered word stayed banked (nothing lost, nothing counted twice)');
  await page.click('#case-back'); await page.waitForSelector(visibleSel('#screen-home'));

  // ----- the Parent Zone -----
  await page.click('#btn-parents');
  await page.waitForSelector('#pin-title');
  for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
  await page.waitForSelector('#pin-title:has-text("again")');
  for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
  await page.waitForSelector('#pz-progress');
  const prog = await textOf(page, '#pz-progress');
  check(/1 of 2 cases closed/.test(prog) && /1 postcard/.test(prog), `Parent Zone: cases closed and postcards ("${prog}")`);
  check(/words on the current list practiced/.test(await textOf(page, '#pz-words')) && /Today's mission: \d+ \/ 8/.test(await textOf(page, '#pz-words')), 'Parent Zone: words practiced come from Spell Jump\'s records');
  check(await exists(page, '#pz-open-next') && (await exists(page, '#pz-cases')), 'Parent Zone: "Open the next case now" and the closed cases');
  await audit(page, layout.insets, 'Parent Zone players'); await shot(page, layout, '14-parent-zone');
  await page.click('.seg-btn[data-tab="options"]');
  check(await exists(page, '#pz-family-music') && await exists(page, '#pz-sound') && await exists(page, '#pz-motion'), 'Parent Zone options: sound, the family music switch and calm motion');
  const musicOff = async () => J(page, () => !!JSON.parse(localStorage.getItem('spellJump.family')).musicOff);
  const m0 = await musicOff();
  await page.click('#pz-family-music');
  check((await musicOff()) !== m0, 'the family music switch writes the shared family record');
  await page.click('#pz-family-music');
  await shot(page, layout, '15-parent-options');
  await page.click('#pz-close');
  await page.waitForSelector(visibleSel('#screen-home'));

  // ----- the rules over the whole run -----
  const spoken = [...pre.played, ...(await played(page))];
  const allowed = new Set(await J(page, async () => {
    const CV = await import('/spell-jump/src/spelling/cloudVoice.js'), PF = await import('/spell-jump/src/spelling/profiles.js');
    const out = new Set();
    for (const l of PF.loadWords('pmia').lists) for (const w of l.words) for (const t of CV.wordTexts(w)) out.add(t);
    for (const ch of "abcdefghijklmnopqrstuvwxyz'- ") out.add(CV.cloudLetterText(ch));
    return [...out];
  }));
  allowed.add(hideState.run.hideout.sentence);
  const stray = spoken.filter((t) => !allowed.has(t));
  check(spoken.length > 20 && stray.length === 0, `the only spoken texts are the words, their sentences, letters and the hideout sentence (${spoken.length} clips${stray.length ? '; stray: ' + stray.slice(0, 4).join(' | ') : ''})`);
  check(!spoken.some((t) => /castle|bridge/i.test(t)), 'no archived-list word was ever spoken');
  const dev = [...pre.dev, ...(await deviceSpoken(page))];
  check(dev.filter((t) => t && t !== 'ready').length === 0, `the device voice was never used${dev.length ? ' (' + dev.slice(0, 3).join(', ') + ')' : ''}`);
  const asked = [...pre.asked, ...(await J(page, () => window.__cloudAsked.flatMap((a) => a.texts)))];
  check(asked.length > 0 && asked.length < 140, `the natural voice was asked for only what the case needs (${asked.length} texts, not the whole game)`);
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

// ---------- no natural voice: silence, the word shown for a moment, never the device voice ----------
async function quietLayout(browser, layout) {
  console.log(`\n=== no natural voice (${layout.name}) ===`);
  const { ctx, page, errors } = await newPage(browser, layout, { voice: false });
  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  await page.click('[data-player="pmia"]'); await page.waitForSelector(visibleSel('#screen-home'));
  await page.click('#btn-open-case'); await page.click('#btn-start');
  await page.waitForSelector('.note.sealed');
  await page.click('.note.sealed[data-w="0"]');
  await page.waitForFunction(() => window.__squirrelChase.spellPanel.isOpen);
  await page.waitForFunction(() => /Look, then spell it/.test(document.querySelector('#sp-msg').textContent), null, { timeout: 12000 });
  check(true, 'without a natural voice the panel shows the word for a moment ("Look, then spell it") and covers it');
  await spellNote(page);
  await page.waitForSelector('.note.open[data-w="0"]');
  check((await deviceSpoken(page)).filter((t) => t !== 'ready').length === 0 && (await played(page)).length === 0, 'nothing was spoken: no device voice, no clips');
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  for (const layout of LAYOUTS) await playLayout(browser, layout);
  await quietLayout(browser, LAYOUTS[0]);
} catch (e) { failures.push('crashed: ' + (e && e.stack || e)); console.log('  ✗ crashed: ' + (e && e.stack || e)); }
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nALL SQUIRREL CHASE UI CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
