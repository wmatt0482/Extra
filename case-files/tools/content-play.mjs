// Scripted full playthrough of EVERY real case (Detective Training + Erie Canal cases 1-5) in Chromium, from the repo root:
//   bash build.sh && (cd dist && python3 -m http.server 8741 &)      then      BASE_URL=http://localhost:8741 node case-files/tools/content-play.mjs
//   (ALL_LANDSCAPE=1 plays all six at 844x390 too; ONLY=portrait | landscape; SHOTS_DIR=... keeps screenshots at deviceScaleFactor 2)
// Unlike ui-smoke.mjs (which runs on the fixtures), this runs on the REAL content in src/content/, using each case's own answer key:
// briefing + word pre-teach, every document opened, every question answered (the keyed sentence(s) pinned, one wrong pin per case),
// the timeline placed (one misplaced card per case), a wrong accusation, then the first accepted answer, a proof clue attached,
// the case report, Case Closed (+ closing line, knowledge card, teaser). Days are advanced with window.__caseFilesNow so all six cases
// open. Asserts: no console errors, no horizontal scroll, the device voice is never used, the kid rules hold on every rendered screen
// (banned words, no timers/pressure text, no authored wrong options), and every case reaches Case Closed.
// v0.1.2: each step's coach card shows once (the first case) and never again; a wrong pin, a misplaced card, a wrong accusation, a clue that
// does not prove it and a short report each open the partner's popup (closed before play goes on).
// Sizes: 390x844 plays all six; 844x390 plays Training + Erie 1 (all six with ALL_LANDSCAPE=1).
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { TRAINING, ARCS } = await import(pathToFileURL(path.join(here, '..', 'src', 'content', 'index.js')).href);
const CASES = [TRAINING, ...ARCS.flatMap((a) => a.cases)];
const { COACH } = await import(pathToFileURL(path.join(here, '..', 'src', 'logic', 'coach.js')).href);
const { LINES } = await import(pathToFileURL(path.join(here, '..', 'src', 'logic', 'lines.js')).href);
const { wordChips, leadOf, splitLead, CLUE_INTRO } = await import(pathToFileURL(path.join(here, '..', 'src', 'logic', 'report.js')).href);
const { requiredDocs } = await import(pathToFileURL(path.join(here, '..', 'src', 'logic', 'run.js')).href);
const { display } = await import(pathToFileURL(path.join(here, '..', 'src', 'logic', 'answers.js')).href);
const ONLY_CASES = (process.env.CASE_IDS || '').split(',').filter(Boolean);
const BASE = process.env.BASE_URL || 'http://localhost:8741';
const URL0 = BASE + '/case-files/index.html?nosw=1';
const SHOTS = process.env.SHOTS_DIR || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.ONLY || '';
const DAY = 86400000;

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
  { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 }, cases: CASES.map((c) => c.id).filter((id) => !ONLY_CASES.length || ONLY_CASES.includes(id)) },
  { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 }, cases: process.env.ALL_LANDSCAPE ? CASES.map((c) => c.id) : ['training', 'erie-01'] },
].filter((l) => !ONLY || l.name === ONLY);

// The kid rules (SPEC section 1) as rendered. CHROME is everything but the case text; TEXT is the case text too.
const HARD = /\b(kill(s|ed|ing)?|die[sd]?|dying|dead|death|lost|lives|life left|gun|blood|weapon|shoot(s|ing)?|timer|countdown|hurry|time'?s up|seconds? left|only \d+ left|game over)\b/i;
const CHROME = /\b(incorrect|lose|fail(ed)?|energy|percent)\b|\d+\s?%/i;

const J = (page, fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visibleSel = (sel) => `${sel}:not([hidden])`;
const waitScreen = (page, name, ms = 8000) => page.waitForSelector(`#screen-${name}:not([hidden])`, { timeout: ms });
const waitBeat = (page, beat, ms = 8000) => page.waitForFunction((b) => { const g = window.__caseFiles; return g.screen === 'case' && g.run && g.run.beat === b; }, beat, { timeout: ms });
const textOf = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const exists = (page, sel) => page.$(sel).then((e) => !!e);
async function typeText(page, text) {
  for (const ch of text.toLowerCase()) {
    if (!/[a-z ]/.test(ch)) continue;
    await page.click(`#case-kb .kb-key[data-key="${ch === ' ' ? 'space' : ch}"]`);
  }
}
const pressEnter = (page) => page.click('#case-kb .kb-key[data-key="enter"]');
const fbClear = (page) => J(page, () => { window.__fb.length = 0; window.__snd.correct = 0; window.__snd.oops = 0; });
const fbOn = (page, k, what = '') => J(page, ([k, what]) => window.__fb.some((x) => x.startsWith(k + ':') && x.includes(what)), [k, what]);
const sounds = (page) => J(page, () => ({ ...window.__snd }));
// ---- the modal: coach cards (once per step) and the partner's popups ----
const modalText = (page) => page.$eval('.modal-wrap .modal-text', (e) => e.textContent.trim()).catch(() => null);
const modalButton = (page) => page.$eval('.modal-wrap .modal-go', (e) => e.textContent.trim()).catch(() => null);
const waitModal = (page, kind) => page.waitForSelector(`.modal-wrap${kind ? `[data-kind="${kind}"]` : ''}`, { timeout: 5000 });
const closeModal = async (page) => { await waitModal(page); await page.click('.modal-go'); await page.waitForFunction(() => !document.querySelector('.modal-wrap'), null, { timeout: 4000 }); };
let seenCoach = new Set();            // the coach cards this browser context has shown (a new player context starts empty)
async function coach(page, key, tag, shot) {
  if (!seenCoach.has(key)) {
    seenCoach.add(key);
    await waitModal(page, 'coach');
    const id = await page.$eval('.modal-wrap', (e) => e.dataset.id), text = await modalText(page);
    check(id === `coach-${key}` && COACH[key].lines.every((l) => text.includes(l)), `${tag}: the ${key} coach card opens on first play`);
    await stepOk(page, `${tag} ${key} coach`);
    if (shot) await shot();
    await closeModal(page);
  } else check(!(await exists(page, '.modal-wrap')), `${tag}: no ${key} coach card the second time`);
}

// every visible word outside the Parent Zone; case text (the documents, which are authored history) is returned separately
const renderedText = (page) => J(page, () => {
  const chrome = [], docs = [];
  const walk = (n, inDoc) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) (inDoc ? docs : chrome).push(c.textContent);
      else if (c.nodeType === 1 && c.id !== 'pz' && !['SCRIPT', 'STYLE'].includes(c.tagName) && !c.closest('[hidden]')) {
        if (c.getAttribute('aria-label')) chrome.push(c.getAttribute('aria-label'));
        walk(c, inDoc || c.classList.contains('doc-text') || c.classList.contains('para'));
      }
    }
  };
  walk(document.querySelector('#app'), false);
  const norm = (a) => a.join(' ').replace(/\s+/g, ' ');
  return { chrome: norm(chrome), docs: norm(docs) };
});
async function kidAudit(page, label) {
  const t = await renderedText(page);
  const all = t.chrome + ' ' + t.docs;
  const m = all.match(HARD) || t.chrome.match(CHROME);
  check(!m, `${label}: kid rules (no banned or pressure words)${m ? ` — found "${m[0]}" in "…${(all.slice(Math.max(0, all.search(m[0]) - 40), all.search(m[0]) + 40))}…"` : ''}`);
  check(!/\brank\b/i.test(t.chrome), `${label}: the Detective Rank is not shown to the child`);
  const opts = await J(page, () => document.querySelectorAll('#app input[type=radio], #app input[type=checkbox], #app [role=radio], #app [role=option], #app select, #app .choice, #app .option').length);
  check(opts === 0, `${label}: no multiple choice or authored options on screen`);
}
async function layoutOk(page, label) {
  const r = await J(page, () => ({ sw: document.documentElement.scrollWidth, w: innerWidth, bsw: document.body.scrollWidth }));
  check(r.sw <= r.w + 1 && r.bsw <= r.w + 1, `${label}: no horizontal scroll (${r.sw}/${r.bsw} <= ${r.w})`);
  // an overflow:hidden container that got scrolled sideways (a click that scrolled something into view) shifts the whole screen
  const shifted = await J(page, () => [document.documentElement, document.body, ...document.querySelectorAll('#app, #app *')].filter((e) => e.scrollLeft > 1 && !e.closest('.doc-tabs, .tabs, [data-hscroll]')).map((e) => `${e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + e.className}${e === document.documentElement || e === document.body ? '' : ''} scrollLeft ${Math.round(e.scrollLeft)}`));
  check(shifted.length === 0, `${label}: nothing is scrolled sideways${shifted.length ? ' — ' + shifted.join('; ') : ''}`);
}
const stepOk = async (page, label) => { await layoutOk(page, label); await kidAudit(page, label); };

const shotN = { n: 0 };
async function shot(page, layout, name, wait = 350) {
  if (!SHOTS) return;
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `${layout.name}-${name}.png`) });
}

// ---------- driving a case with its own key ----------
const docIdOf = (k, sid) => k.docs.find((d) => d.paragraphs.some((p) => p.some((s) => s.id === sid))).id;
async function openDocTab(page, k, docId) {
  const on = await J(page, (id) => !!document.querySelector(`.doc[data-doc="${id}"]`), docId);
  if (!on) await page.click(`.doc-tab[data-doc="${docId}"]`);
  await page.waitForSelector(`.doc[data-doc="${docId}"]`);
}
async function pickSentence(page, k, sid) {
  await openDocTab(page, k, docIdOf(k, sid));
  await page.click(`.doc.pick .s[data-id="${sid}"]`);
}
async function pinAnswer(page, k, q) {
  for (const id of q.answer) { await pickSentence(page, k, id); await page.click('#nb-pin'); }
  await page.waitForSelector('#nb-why');
}
// a sentence that is in the case but is not part of this question's key (a real sentence, never an authored wrong option)
const wrongSentence = (k, q) => k.docs.flatMap((d) => d.paragraphs.flat()).map((s) => s.id).find((id) => !q.answer.includes(id) && !q.answer.some((a) => a.split('s')[0] === id.split('s')[0] && Math.abs(Number(a.split('s')[1]) - Number(id.split('s')[1])) < 1));

async function playCase(page, layout, k, i) {
  const tag = `${layout.name} ${k.id}`;
  console.log(`\n--- ${tag}: ${k.title} (${k.docs.length} docs, ${k.questions.length} questions, ${k.timeline.items.length}-card timeline) ---`);
  const day = k.id === 'training' ? 0 : k.order - 1;                            // Training and Erie 1 on day 1, then one a day
  await J(page, (ms) => { window.__fakeNow = ms; }, day * DAY + (day ? 3600000 : 0));
  await page.click('#btn-player'); await waitScreen(page, 'players');
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  await coach(page, 'home', tag);
  const state0 = await J(page, (id) => { const c = document.querySelector(`.case-card[data-case="${id}"]`); return c && c.dataset.state; }, k.id);
  check(state0 === 'new', `${tag}: the case is open on its day (state ${state0})`);
  const sealedNext = CASES[i + 1] && CASES[i + 1].id !== 'erie-01' ? await J(page, (id) => document.querySelector(`.case-card[data-case="${id}"]`).dataset.state, CASES[i + 1].id) : 'sealed';
  check(sealedNext === 'sealed' || sealedNext === 'new', `${tag}: the next case is sealed or opening`);
  await stepOk(page, `${tag} home`);
  if (k.id === 'training' || k.id === 'erie-01') await shot(page, layout, `${k.id}-00-agency-home`);
  await page.click(`.case-card[data-case="${k.id}"]`);

  // 1. briefing + word pre-teach
  await waitBeat(page, 'brief');
  await coach(page, 'brief', tag, () => shot(page, layout, `${k.id}-00b-coach-brief`));
  check((await textOf(page, '.objective p')) === k.objective, `${tag}: the objective is shown: "${k.objective}"`);
  const cards = await page.$$eval('.wordcard', (c) => c.map((x) => x.dataset.word));
  check(cards.length >= 2 && cards.length <= 3 && cards.every((w) => k.words.some((x) => x.word === w)), `${tag}: ${cards.length} pre-taught words (${cards.join(', ')})`);
  check(await J(page, () => document.querySelector('#brief-go').disabled), `${tag}: "Start investigating" waits for the words`);
  const w0 = k.words.find((w) => cards.includes(w.word));
  const wrongTok = await page.$(`.wordcard[data-word="${w0.word}"] .tok[data-right="0"]`);
  if (wrongTok) {
    await fbClear(page);
    await wrongTok.click();
    check(!(await exists(page, `.wordcard[data-word="${w0.word}"] .wc-mean`)), `${tag}: a wrong word tap shows no meaning, no penalty`);
    check((await fbOn(page, 'fb-wrong', 'tok')) && (await sounds(page)).oops === 1 && !(await exists(page, '.modal-wrap')), `${tag}: a wrong word tap shakes (fb-wrong) with the soft boop`);
  }
  await fbClear(page);
  for (const w of cards) await page.click(`.wordcard[data-word="${w}"] .tok[data-right="1"]`);
  check((await fbOn(page, 'fb-right', 'tok')) && (await sounds(page)).correct === cards.length, `${tag}: each right word tap flashes gold (fb-right) with the chime`);
  for (const w of cards) check(((await textOf(page, `.wordcard[data-word="${w}"] .wc-mean`)) || '').includes(k.words.find((x) => x.word === w).meaning), `${tag}: "${w}" shows its meaning`);
  await stepOk(page, `${tag} briefing`);
  await shot(page, layout, `${k.id}-01-briefing`);
  await page.click('#brief-go'); await waitBeat(page, 'investigate');
  await coach(page, 'read', tag, () => shot(page, layout, `${k.id}-01b-coach-read`));

  // 2. investigate: every document, every paragraph visible, no overflow
  const folders = await page.$$eval('.docfolder', (f) => f.map((x) => x.dataset.doc));
  check(folders.length === k.docs.length, `${tag}: the desk shows all ${k.docs.length} documents`);
  const need = requiredDocs(k);
  for (const d of k.docs.filter((x) => x.stretch)) {
    const want = need.has(d.id) ? 'Harder · needed' : 'Bonus · harder';
    check((await textOf(page, `.docfolder[data-doc="${d.id}"] .tag.stretch`)) === want, `${tag}: the harder document ${d.id} is tagged "${want}" (${need.has(d.id) ? 'a question answer or the proof is in it' : 'optional reading'})`);
  }
  if (!k.docs.some((x) => x.stretch)) check(!(await exists(page, '#desk-note')), `${tag}: no desk note when there is no harder document`);
  else check(((await textOf(page, '#desk-note')) || '').includes(k.docs.some((x) => x.stretch && need.has(x.id)) ? 'clue you need' : 'bonus'), `${tag}: the desk note says whether the harder file is needed or a bonus`);
  const notNeeded = k.docs.filter((x) => !need.has(x.id));
  if (notNeeded.length) {
    for (const d of k.docs.filter((x) => need.has(x.id))) { await page.click(`.docfolder[data-doc="${d.id}"]`); await page.waitForSelector(`.doc[data-doc="${d.id}"]`); await page.click('#doc-back'); await page.waitForSelector('#open-notebook'); }
    check(!(await J(page, () => document.querySelector('#open-notebook').disabled)), `${tag}: the notebook opens without the bonus document`);
  } else check(await J(page, () => document.querySelector('#open-notebook').disabled), `${tag}: the notebook waits for every document (the harder one holds an answer)`);
  await stepOk(page, `${tag} desk`);
  await shot(page, layout, `${k.id}-02-desk`);
  let firstDoc = true;
  for (const d of k.docs) {
    await page.click(`.docfolder[data-doc="${d.id}"]`);
    await page.waitForSelector(`.doc[data-doc="${d.id}"]`);
    const nS = await page.$$eval(`.doc[data-doc="${d.id}"] .s`, (s) => s.length);
    check(nS === d.paragraphs.flat().length, `${tag} ${d.id} "${d.title}"${d.stretch ? ' (stretch)' : ''}: ${nS} sentences rendered`);
    if (d.stretch) check((await page.getAttribute('.toggle-btn', 'aria-pressed')) === 'true', `${tag} ${d.id}: the stretch document opens with "Read it to me" on`);
    await stepOk(page, `${tag} doc ${d.id}`);
    if (firstDoc) { await shot(page, layout, `${k.id}-03-document`); firstDoc = false; }
    if (d.stretch) await shot(page, layout, `${k.id}-03s-stretch-document`);
    await page.click('#doc-back'); await page.waitForSelector('#open-notebook');
  }
  await page.click('#open-notebook'); await waitBeat(page, 'pin');
  await coach(page, 'pin', tag, () => shot(page, layout, `${k.id}-03b-coach-pin`));

  // 3. pin evidence: a wrong pin on question 1 (-> hint tier 1), then every question with its key
  for (let qi = 0; qi < k.questions.length; qi++) {
    const q = k.questions[qi];
    check((await textOf(page, '#nb-q')) === q.prompt, `${tag} ${q.id}: "${q.prompt}"`);
    if (qi === 0) {
      const bad = wrongSentence(k, q);
      await pickSentence(page, k, bad);
      await shot(page, layout, `${k.id}-04-sentence-selected`);
      await fbClear(page);
      await page.click('#nb-pin');
      await waitModal(page, 'feedback');
      check((await fbOn(page, 'fb-wrong', ':s ')) && (await sounds(page)).oops === 1, `${tag} ${q.id}: the wrong sentence shook (fb-wrong) with the soft boop before the popup`);
      const pt = await modalText(page);
      check(pt.includes(LINES.pinMiss1) && pt.includes(q.hint) && (await modalButton(page)) === 'Try again' && !/wrong|incorrect/i.test(pt), `${tag} ${q.id}: a wrong pin opens the partner's popup with the authored guiding question`);
      await stepOk(page, `${tag} wrong pin popup`);
      await shot(page, layout, `${k.id}-04b-popup-wrong-pin`);
      if (!layout.__voiced) { layout.__voiced = true; check(await page.waitForFunction((t) => window.__cloudPlayed.includes(t), q.hint, { timeout: 4000 }).then(() => true).catch(() => false), `${tag}: the popup is voiced (clip)`); }
      await closeModal(page);
      check((await textOf(page, '#nb-hint')) !== null && (await textOf(page, '#nb-hint')).includes(q.hint) && (await page.getAttribute('#nb-hint', 'data-tier')) === '1' && !(await exists(page, '#nb-note')), `${tag} ${q.id}: after the popup, hint tier 1 stays in the notebook (no inline error line)`);
      await stepOk(page, `${tag} hint tier 1`);
    }
    if (qi === 1) {
      await page.click('#nb-hint-btn'); await waitModal(page, 'feedback');
      const hm = await modalText(page);
      check(hm.includes(LINES.hint1) && hm.includes(q.hint) && (await modalButton(page)) === 'Got it', `${tag} ${q.id}: the Hint button opens a popup with the authored guiding question`);
      await closeModal(page);
      check((await textOf(page, '#nb-hint')).includes(q.hint), `${tag} ${q.id}: the inline hint line stays after the popup`);
    }
    await fbClear(page);
    await pinAnswer(page, k, q);
    check((await fbOn(page, 'fb-right', ':s ')) && (await sounds(page)).correct === q.answer.length, `${tag} ${q.id}: each right sentence flashed gold (fb-right) with the chime (${q.answer.length})`);
    check((await textOf(page, '#nb-why')).includes(q.why), `${tag} ${q.id}: the "why it proves it" line shows (${q.answer.length} pinned sentence${q.answer.length > 1 ? 's' : ''})`);
    if (qi === 1) {
      await page.click('#case-board'); await page.waitForSelector('.sheet .clue');
      await shot(page, layout, `${k.id}-05-cork-board`, 700);
      await stepOk(page, `${tag} cork board`);
      await page.click('[data-act="close-sheet"]');
    }
    await page.click('#nb-next'); await sleep(60);
  }
  await waitBeat(page, 'rebuild');
  await coach(page, 'order', tag, () => shot(page, layout, `${k.id}-06b-coach-order`));
  await page.click('#case-help'); await waitModal(page, 'coach');
  check((await page.$eval('.modal-wrap', (e) => e.dataset.id)) === 'coach-order', `${tag}: the "?" help button reopens this step's card`);
  await closeModal(page);
  check((await page.getAttribute('#case-board', 'data-count')) === String(new Set(k.questions.flatMap((q) => q.answer)).size), `${tag}: the board holds every pinned clue`);

  // 4. reconstruct: one misplaced card, then everything placed
  const tl = k.timeline;
  const open = tl.items.map((it, n) => (tl.given.includes(n) ? -1 : n)).filter((n) => n >= 0);
  check((await page.$$('.slot')).length === tl.items.length && (await page.$$('.tcard')).length === open.length, `${tag}: the timeline has ${tl.items.length} slots, ${tl.given.length} pre-placed, ${open.length} cards in the tray`);
  await stepOk(page, `${tag} timeline start`);
  await shot(page, layout, `${k.id}-06-timeline`);
  if (open.length > 1) {
    await page.click(`[data-card="${tl.items[open[1]].id}"]`);
    await fbClear(page);
    await page.click(`.slot[data-slot="${open[0]}"]`);
    await waitModal(page, 'feedback');
    check((await fbOn(page, 'fb-wrong', 'tcard')) && (await sounds(page)).oops === 1, `${tag}: the misplaced card shook (fb-wrong) with the soft boop before the popup`);
    const msg = await modalText(page);
    check(msg.includes(LINES.cardMiss) && /Check the /.test(msg) && !/wrong/i.test(msg) && (await modalButton(page)) === 'Try again', `${tag}: a misplaced card opens a popup ("${msg}")`);
    await stepOk(page, `${tag} misplaced card popup`);
    await shot(page, layout, `${k.id}-06c-popup-misplaced-card`);
    await closeModal(page);
  }
  await fbClear(page);
  for (const n of open) { await page.click(`[data-card="${tl.items[n].id}"]`); await page.click(`.slot[data-slot="${n}"]`); await sleep(40); }
  await page.waitForSelector('#tl-go:not([hidden])', { timeout: 6000 });
  check((await fbOn(page, 'fb-right', 'slot')) && (await sounds(page)).correct === open.length, `${tag}: each right card flashed its slot gold (fb-right) with the chime`);
  await stepOk(page, `${tag} timeline done`);
  await shot(page, layout, `${k.id}-07-timeline-done`);
  await page.click('#tl-go'); await waitBeat(page, 'solve');
  await coach(page, 'close', tag, () => shot(page, layout, `${k.id}-07b-coach-close`));

  // 5. accuse: wrong first, then the first accepted answer; attach a proof clue
  const WRONG = { training: 'Mia', 'erie-01': 'Tom Fisk', 'erie-02': 'beaver', 'erie-03': 'bell', 'erie-04': 'Lively Nell', 'erie-05': 'blue' }[k.id] || 'banana';
  check((await textOf(page, '.bubble.partner p')).includes(k.solution.prompt), `${tag}: the solution question is asked ("${k.solution.prompt}")`);
  await typeText(page, WRONG); await fbClear(page); await pressEnter(page);
  await waitModal(page, 'feedback');
  check((await fbOn(page, 'fb-wrong', 'answer-box')) && (await sounds(page)).oops === 1, `${tag}: the wrong accusation shook the answer box (fb-wrong) with the soft boop before the popup`);
  const at = await modalText(page);
  check(at.includes('Good detectives check again') && at.includes(LINES.solveTier1) && (await modalButton(page)) === 'Try again', `${tag}: a wrong accusation ("${WRONG}") opens a popup: "Good detectives check again" + a hint`);
  await stepOk(page, `${tag} wrong accusation popup`);
  await shot(page, layout, `${k.id}-07c-popup-wrong-accusation`);
  await closeModal(page);
  check((await textOf(page, '#solve-hint')).includes(LINES.solveTier1), `${tag}: after the popup the partner's hint stays on the page`);
  for (let n = 0; n < 30; n++) await page.keyboard.press('Backspace');                       // the physical keyboard deletes ...
  check((await textOf(page, '#answer-box')) === 'Type your answer', `${tag}: the physical Backspace cleared the answer box`);
  await page.keyboard.type(k.solution.answers[0]);                                          // ... and types (v0.1.3), Enter = Check
  check((await textOf(page, '#answer-box')).toLowerCase() === k.solution.answers[0].toLowerCase(), `${tag}: the physical keyboard typed "${k.solution.answers[0]}" into the in-game field`);
  await shot(page, layout, `${k.id}-08-accuse`);
  await fbClear(page);
  await page.keyboard.press('Enter'); await page.waitForSelector('#attach-msg');
  check((await fbOn(page, 'fb-right', 'answer-ok')) && (await sounds(page)).correct === 1, `${tag}: the right name flashed gold (fb-right) with the chime`);
  check(/attach/.test(await textOf(page, '#attach-msg')), `${tag}: "${k.solution.answers[0]}" is accepted, then: attach a clue`);
  const clueIds = await page.$$eval('.clue', (c) => c.map((x) => x.dataset.clue));
  const proofClue = k.solution.proof.find((id) => clueIds.includes(id));
  const notProof = clueIds.find((id) => !k.solution.proof.includes(id));
  check(!!proofClue, `${tag}: a pinned clue from the proof set (${k.solution.proof.join(', ')}) is on the board`);
  if (notProof) {
    await page.click(`.clue[data-clue="${notProof}"]`);
    await waitModal(page, 'feedback');
    check((await modalText(page)) === LINES.notThatClue && await J(page, () => document.querySelector('#solve-go').disabled), `${tag}: a clue that does not prove it -> a popup (check again), nothing attached`);
    await closeModal(page);
  }
  await page.click(`.clue[data-clue="${proofClue}"]`);
  check(!(await J(page, () => document.querySelector('#solve-go').disabled)), `${tag}: the proof clue attaches`);
  await stepOk(page, `${tag} attach`);
  await shot(page, layout, `${k.id}-09-attach-clue`);
  await page.click('#solve-go'); await waitBeat(page, 'report');

  // 6. the case report
  const because = `it was ${k.report.keywords.slice(0, 3).join(' and ')} in the story`.replace(/[^a-z ]/gi, '');
  // the frame: this case's lead (or the neutral default), the answer, "because", the blank with its own period, the clue on its own line
  const [lb, la] = splitLead(leadOf(k));
  const whoText = lb.trim() ? k.solution.answers[0] : display(k.solution.answers[0]);
  const frameText = await textOf(page, '#frame');
  check(frameText.startsWith(`${lb}${whoText}${la} because `) && frameText.includes(CLUE_INTRO), `${tag}: the report reads "${lb}${whoText}${la} because … ${CLUE_INTRO} …" (${k.report.lead ? 'the case lead' : 'the neutral default'})`);
  check(await J(page, () => { const d = document.querySelector('#blank-because .dot'); return !!d && d.textContent === '.' && ![...document.querySelectorAll('#frame > *')].some((x) => x.textContent.trim() === '.'); }), `${tag}: no orphan period (it lives inside the "because" blank)`);
  const clueText = k.docs.flatMap((d) => d.paragraphs.flat()).find((s) => s.id === proofClue).text;
  const chipWords = await page.$$eval('#word-chips .word-chip', (c) => c.map((x) => x.dataset.word));
  check(chipWords.length >= 4 && JSON.stringify(chipWords) === JSON.stringify(wordChips(k, clueText)) && k.report.keywords.some((w) => chipWords.map((x) => x.toLowerCase()).includes(w.toLowerCase())), `${tag}: word chips above the keyboard (${chipWords.join(', ')})`);
  await page.click(`#word-chips .word-chip[data-word="${chipWords[0]}"]`);
  check((await textOf(page, '#blank-because')).toLowerCase().startsWith(chipWords[0].toLowerCase()), `${tag}: tapping a chip inserts its word`);
  for (let n = 0; n < chipWords[0].length + 1; n++) await page.keyboard.press('Backspace');
  check((await textOf(page, '#blank-because')) === 'type why.', `${tag}: the chip's word can be deleted again`);
  await typeText(page, 'it was'); await fbClear(page); await pressEnter(page);                 // two words: too short -> a popup
  await waitModal(page, 'feedback');
  check((await fbOn(page, 'fb-wrong', 'blank-because')) && (await sounds(page)).oops === 1, `${tag}: the short report shook the blank (fb-wrong) before the popup`);
  check((await modalText(page)) === LINES.moreWords && (await modalButton(page)) === 'Try again', `${tag}: a too-short report opens a popup ("${LINES.moreWords}")`);
  await shot(page, layout, `${k.id}-10b-popup-short-report`);
  await closeModal(page);
  await typeText(page, because.slice('it was'.length));
  await page.click('#blank-clue'); await page.waitForSelector('.sheet .clue'); await page.click(`.sheet .clue[data-clue="${proofClue}"]`);
  check((await textOf(page, '#blank-clue')).includes('“'), `${tag}: the report shows the tapped clue`);
  await shot(page, layout, `${k.id}-10-report`);
  await stepOk(page, `${tag} report`);
  await fbClear(page);
  await page.keyboard.press('Enter'); await waitScreen(page, 'closed');
  check((await fbOn(page, 'fb-right', 'frame')) && (await sounds(page)).correct === 1, `${tag}: filing the report flashed the sentence (fb-right) with the chime`);

  // Case Closed
  check((await textOf(page, '#big-stamp')).toLowerCase() === 'case closed', `${tag}: CASE CLOSED stamp`);
  check((await textOf(page, '#closing-line')).includes(k.closing.text), `${tag}: the Chief's closing line`);
  check((await textOf(page, '#knowledge-card')).includes(k.knowledge), `${tag}: the knowledge card`);
  check((await textOf(page, '#teaser')) === k.teaser, `${tag}: the teaser ("${k.teaser}")`);
  check((await textOf(page, '#see-you')) === 'Case closed. See you tomorrow, Detective.', `${tag}: "See you tomorrow, Detective."`);
  await page.waitForFunction(() => !!document.querySelector('#payout') && Number(document.querySelector('#payout').dataset.coins) > 0, null, { timeout: 6000 }).catch(() => {});
  check(Number(await page.getAttribute('#payout', 'data-coins')) > 0, `${tag}: the flat Lab payout shows`);
  await sleep(700);
  check((await J(page, () => window.__caseFiles.screen)) === 'closed', `${tag}: the next case never starts by itself`);
  await stepOk(page, `${tag} closed`);
  await shot(page, layout, `${k.id}-11-case-closed`, 900);
  const rec = await J(page, (id) => JSON.parse(JSON.stringify(window.__caseFiles.save.closed[id] || null)), k.id);
  check(!!rec && rec.report.clueId === proofClue && rec.report.because.toLowerCase() === because.toLowerCase(), `${tag}: the save has the closed record and the report`);
  check(!!rec && rec.firstTap[k.questions[0].id] === false && k.questions.slice(1).every((q) => rec.firstTap[q.id] === true), `${tag}: first taps recorded (first question missed on purpose, the rest right)`);
  await page.click('#closed-home'); await waitScreen(page, 'home');
  if (k.id === 'training' || k.id === 'erie-01') await replayCase(page, layout, k);
}

// v0.1.3 "Solve it again": the whole closed case once more on the real content; no Lab payout, the record unchanged but `replays`
async function replayCase(page, layout, k) {
  const tag = `${layout.name} ${k.id} replay`;
  const before = await J(page, (id) => JSON.parse(JSON.stringify(window.__caseFiles.save.closed[id])), k.id);
  const words = await J(page, () => JSON.stringify(window.__caseFiles.save.wordsMet));
  await J(page, async () => { const { labBridge } = await import('./src/meta/labBridge.js'); window.__labCalls = []; if (!labBridge.__spied) { labBridge.__spied = true; const o = labBridge.report.bind(labBridge); labBridge.report = (ev) => { window.__labCalls.push(ev); return o(ev); }; } });
  await page.click(`.case-card[data-case="${k.id}"]`); await waitScreen(page, 'file');
  check((await exists(page, '#file-replay')) && (await textOf(page, '#file-replay')) === 'Solve it again', `${tag}: the closed case file offers "Solve it again" (read-only view stays)`);
  await page.click('#file-body [data-tab="report"]');
  const [lb, la] = splitLead(leadOf(k));
  const rep = await textOf(page, '#file-report');
  check(rep.startsWith(`${lb}`) && rep.includes(` because `) && rep.includes(`${CLUE_INTRO} “`) && !/\s\.($|\s)/.test(rep), `${tag}: the file shows the report with the case lead: "${rep.slice(0, 90)}…"`);
  await page.click('#file-replay'); await waitBeat(page, 'brief');
  check(await J(page, () => window.__caseFiles.run.replay === true && window.__caseFiles.run.board.length === 0), `${tag}: a fresh run (a replay)`);
  const cards = await page.$$eval('.wordcard', (c) => c.map((x) => x.dataset.word));
  for (const w of cards) await page.click(`.wordcard[data-word="${w}"] .tok[data-right="1"]`);
  await page.click('#brief-go'); await waitBeat(page, 'investigate');
  const need = requiredDocs(k);
  for (const d of k.docs.filter((x) => need.has(x.id))) { await page.click(`.docfolder[data-doc="${d.id}"]`); await page.waitForSelector(`.doc[data-doc="${d.id}"]`); await page.click('#doc-back'); await page.waitForSelector('#open-notebook'); }
  await page.click('#open-notebook'); await waitBeat(page, 'pin');
  for (const q of k.questions) { await pinAnswer(page, k, q); await page.click('#nb-next'); await sleep(50); }
  await waitBeat(page, 'rebuild');
  const tl = k.timeline;
  for (const n of tl.items.map((it, i) => (tl.given.includes(i) ? -1 : i)).filter((i) => i >= 0)) { await page.click(`[data-card="${tl.items[n].id}"]`); await page.click(`.slot[data-slot="${n}"]`); await sleep(40); }
  await page.waitForSelector('#tl-go:not([hidden])'); await page.click('#tl-go'); await waitBeat(page, 'solve');
  await page.keyboard.type(k.solution.answers[0]); await page.keyboard.press('Enter'); await page.waitForSelector('#attach-msg');
  const proof = k.solution.proof.find((id) => k.questions.some((q) => q.answer.includes(id)));
  await page.click(`.clue[data-clue="${proof}"]`); await page.click('#solve-go'); await waitBeat(page, 'report');
  await page.keyboard.type(`it was ${k.report.keywords.slice(0, 3).join(' and ')} in the story`.replace(/[^a-z ]/gi, ''));
  await page.click('#blank-clue'); await page.waitForSelector('.sheet .clue'); await page.click(`.sheet .clue[data-clue="${proof}"]`);
  await page.keyboard.press('Enter');
  await waitScreen(page, 'file');
  check(((await textOf(page, '#replay-note')) || '').includes('Solved again'), `${tag}: the replay ends on the case file ("Solved again")`);
  const after = await J(page, (id) => JSON.parse(JSON.stringify(window.__caseFiles.save.closed[id])), k.id);
  check(after.replays === 1 && JSON.stringify({ ...after, replays: 0 }) === JSON.stringify({ ...before, replays: 0 }), `${tag}: the closed record is unchanged except replays: 1`);
  check((await J(page, () => JSON.stringify(window.__caseFiles.save.wordsMet))) === words && (await J(page, () => window.__labCalls.length)) === 0, `${tag}: no Lab payout and no words counted again`);
  await stepOk(page, `${tag} file`);
  await page.click('#file-back'); await waitScreen(page, 'home');
}

async function runLayout(browser, layout) {
  console.log(`\n=== ${layout.name} ${layout.width}x${layout.height}: ${layout.cases.join(', ')} ===`);
  const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: true, hasTouch: true });
  const fontCache = new Map();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    if (!SHOTS) return route.fulfill({ status: 200, body: '', contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf' });
    try {
      if (!fontCache.has(url)) fontCache.set(url, execSync(`curl -sSL --max-time 15 -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" "${url}"`));
      await route.fulfill({ status: 200, body: fontCache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    } catch (_) { await route.fulfill({ status: 200, body: '', contentType: 'text/css' }); }
  });
  await ctx.route('**/api/family/**', (r) => r.abort());
  let ttsNetwork = 0;
  await ctx.route('**/api/tts/**', (r) => { ttsNetwork++; return r.abort(); });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|api\/family|ERR_FAILED|ERR_INTERNET|net::ERR/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.addInitScript(({ insets }) => {
    if (!sessionStorage.getItem('cfSeeded')) {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem('spellJump.family', JSON.stringify({ v: 1, players: [{ id: 'pmia', name: 'Mia', color: '#3b7dd9', createdAt: now, updatedAt: now }],
        pinHash: null, pinUpdatedAt: 0, options: { pmia: { cloudVoice: 'en-US-Neural2-F' } }, optionsUpdatedAt: { pmia: now }, removedPlayers: [], migrated: true, lastPlayer: null }));
      localStorage.setItem('spellJump.sync', JSON.stringify({ v: 1, code: 'ABCD-2345', deviceId: 'devC', keys: {} }));
      sessionStorage.setItem('cfSeeded', '1');
    }
    window.__fakeNow = 0;
    window.__caseFilesNow = () => Date.now() + window.__fakeNow;
    window.__cloudAsked = []; window.__cloudPlayed = []; window.__spoken = [];
    window.__fb = []; window.__snd = { correct: 0, oops: 0 };       // v0.1.3: every fb-right / fb-wrong class that appears, and the feedback sounds
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((ms) => { for (const m of ms) { const c = m.target.classList; for (const k of ['fb-right', 'fb-wrong']) if (c && c.contains(k)) window.__fb.push(k + ':' + (m.target.id || m.target.className)); } })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    window.__ttsBackend = {   // a SPY on the device voice: Case Files must never use it
      speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
      speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 30); },
      cancel() {}, addEventListener() {},
    };
    if (window.speechSynthesis) { const orig = window.speechSynthesis.speak.bind(window.speechSynthesis); window.speechSynthesis.speak = (u) => { window.__spoken.push('native:' + String(u.text).trim()); return orig(u); }; }
    const hex = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').repeat(4); };
    window.__cloudVoiceBackend = {   // mocked natural voice: no network, no WebAudio
      async status() { return { key: true }; },
      async prepare({ code, voice, texts }) {
        window.__cloudAsked.push({ code, voice, texts });
        const clips = {};
        for (const t of texts) clips[t] = '/api/tts/clip/' + hex(voice + '\n' + t);
        return { status: 200, body: { clips, generated: texts.length, cached: 0, charsToday: 100 } };
      },
      async load(url, text) { return { url, text, duration: 0.02 }; },
      play(buf, text) { window.__cloudPlayed.push(text); return new Promise((r) => setTimeout(() => r(true), 8)); },
      stop() {},
    };
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
      document.head.append(st);
    });
  }, { insets: layout.insets });

  await page.goto(URL0, { waitUntil: 'networkidle' });
  await page.waitForSelector(visibleSel('#screen-players'));
  seenCoach = new Set();
  await page.click('[data-player="pmia"]'); await waitScreen(page, 'home');
  await coach(page, 'home', `${layout.name}`, () => shot(page, layout, 'coach-home'));
  await J(page, () => { const a = window.__caseFiles.app.audio; for (const k of ['correct', 'oops']) { const o = a[k].bind(a); a[k] = (...x) => { window.__snd[k]++; return o(...x); }; } });   // count the feedback sounds
  await layoutOk(page, `${layout.name} home`);
  let played = 0;
  for (const id of layout.cases) {
    const i = CASES.findIndex((c) => c.id === id);
    await playCase(page, layout, CASES[i], i);
    played++;
    if (played === 2) {   // the Parent Zone after two closed cases
      await page.click('#btn-parents'); await page.waitForSelector('#pin-title');
      if ((await textOf(page, '#pin-title')) === 'Choose a 4-digit PIN') { for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`); await page.waitForFunction(() => document.querySelector('#pin-title').textContent === 'Type the PIN again'); }
      for (const d of '1234') await page.click(`.pin-key[data-digit="${d}"]`);
      await page.waitForSelector('.pz-tabs'); await page.click('.pz-tabs [data-tab="det"]'); await page.waitForSelector('#rank-line');
      const reports = await page.$$eval('.pz-report', (r) => r.map((x) => x.textContent));
      check(reports.length === 2 && reports.every((r) => / because .+The clue that proves it is: “/.test(r)), `${layout.name}: Parent Zone shows both case reports in full (${reports.length})`);
      await layoutOk(page, `${layout.name} parent zone`);
      await shot(page, layout, 'parent-zone-two-closed', 500);
      await page.click('#pz-close'); await waitScreen(page, 'home');
    }
  }
  const final = await J(page, () => Object.keys(window.__caseFiles.save.closed));
  check(layout.cases.every((id) => final.includes(id)), `${layout.name}: every played case reached Case Closed (${final.join(', ')})`);
  const spoken = await J(page, () => window.__spoken.slice());
  check(spoken.length === 0, `${layout.name}: the device voice was never used (${spoken.length} utterances)`);
  check(ttsNetwork === 0, `${layout.name}: no real calls to the voice server`);
  check(await J(page, () => window.__cloudAsked.length) >= layout.cases.length, `${layout.name}: the natural voice was asked for clips`);
  check(errors.length === 0, `${layout.name}: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try { for (const l of LAYOUTS) await runLayout(browser, l); } finally { await browser.close(); }
  if (SHOTS) console.log(`\nscreenshots: ${SHOTS}`);
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n- ` + failures.join('\n- ')); process.exit(1); }
  console.log('\nALL CASE FILES CONTENT-PLAY CHECKS PASSED');
}
main().catch((e) => { console.error(e); process.exit(1); });
