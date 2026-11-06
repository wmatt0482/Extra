// The case screen: the five beats of SPEC §4, each a comprehension act.
//   1 Briefing    the Chief states the objective (voiced); 2-3 case words are pre-taught with a quick active task
//   2 Investigate the desk of documents; each opens in the reader (silent, a listen button per paragraph, "Read it to me")
//   3 Pin evidence  the partner's notebook asks one question at a time; tap the sentence that proves it, then "Pin it":
//                   a wrong tap goes straight to the next hint tier (1 a guiding question, 2 the right paragraph glows,
//                   3 the partner models it); after pinning, the "why" line
//   4 Reconstruct a half-filled timeline: tap a card then a slot (or drag); a misplaced card slides back, "Check the logbook"
//   5 Close       the answer on the in-game keyboard, attach a pinned clue, then the sentence-frame case report
// All state is the plain `run` object (src/logic/run.js); this file draws it and calls the moves. Nothing here shows a
// timer, a score, a count of mistakes or a "wrong" (SPEC §1).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { display } from '../logic/answers.js';
import { LINES, KIND_LABEL, checkDoc, wordSpeech } from '../logic/lines.js';
import { readAloudDefault, supportsFor, wordsToTeach } from '../logic/pacing.js';
import { attachClue, countListen, docOfSentence, nextQuestion, pinTap, pinnedIn, placeCard, questionOf, requestHint, sentenceIndex, submitReport, submitSolution, trayOf } from '../logic/run.js';
import { createReader } from './reader.js';
import { createBoard } from './board.js';
import { EXTRA_ICONS } from './art.js';

const STEPS = [['brief', 'Brief'], ['investigate', 'Read'], ['pin', 'Pin'], ['rebuild', 'Order'], ['solve', 'Close']];
const stepIndex = (beat) => (beat === 'report' ? 4 : Math.max(0, STEPS.findIndex(([b]) => b === beat)));
const wordKey = (s) => String(s).toLowerCase().replace(/[^a-z']/g, '');

export function createCaseView(app) {
  const body = $('#case-body');
  const titleEl = $('#case-title');
  const boardBtn = $('#case-board');
  let kase = null, run = null, idx = {};
  let readers = new Map();            // docId -> reader (the pin beat keeps one per document)
  let timers = [];
  let typed = '';
  let kbMode = null;                  // { max, label, onEnter, upper }
  let sheet = null;                   // the open sheet element (board / documents)
  const say = (text) => app.speak(text);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { for (const t of timers.splice(0)) clearTimeout(t); };
  const persist = () => app.persistWip(run);

  // ---- the in-game keyboard (Spell Jump's module): one instance, moved into whichever beat needs it ----
  const kb = createKeyboard({
    id: 'case-kb', enterLabel: 'Check', upper: true,
    onKey: (ch) => {
      if (!kbMode || typed.length >= kbMode.max) return;
      if (ch === ' ' && (!typed || typed.endsWith(' '))) return;
      typed += ch; app.audio.letter(); kbMode.draw();
    },
    onBackspace: () => { if (!kbMode || !typed) return; typed = typed.slice(0, -1); app.audio.letter(true); kbMode.draw(); },
    onEnter: () => { if (kbMode && typed.trim()) kbMode.enter(); },
  });
  function useKeyboard(mode) { for (const k of kb.el.querySelectorAll('.is-down')) k.classList.remove('is-down'); kbMode = mode; kb.setEnterLabel(mode.label); kb.setEnabled(true); kb.setEnterEnabled(!!typed.trim()); kb.setActive(true); }
  const syncEnter = () => kb.setEnterEnabled(!!typed.trim());
  function releaseKeyboard() { kbMode = null; kb.setActive(false); }

  // ---------- chrome: steps, board button ----------
  function chrome() {
    titleEl.textContent = kase.title;
    const cur = stepIndex(run.beat);
    for (const row of [$('#case-steps'), $('#case-steps2')]) {
      row.replaceChildren(...STEPS.map(([, label], i) => h('i', { class: i === cur ? 'on' : i < cur ? 'done' : '' }, `${i + 1} ${label}`)));
    }
    const showBoard = ['pin', 'rebuild', 'solve', 'report'].includes(run.beat);
    boardBtn.hidden = !showBoard;
    boardBtn.innerHTML = EXTRA_ICONS.board;
    boardBtn.setAttribute('aria-label', `Evidence board, ${run.board.length} pinned`);
    boardBtn.dataset.count = String(run.board.length);
  }
  boardBtn.addEventListener('click', () => openBoardSheet());

  function openSheet(title, content, onClose, tall = false) {
    closeSheet();
    const close = h('button', { class: 'btn icon-btn', 'aria-label': 'Close', 'data-act': 'close-sheet', 'data-sfx': '', html: icon('close') });
    const wrap = h('div', { class: 'sheet-wrap', role: 'dialog', 'aria-label': title }, h('div', { class: 'sheet' + (tall ? ' tall' : '') }, h('div', { class: 'sheet-head' }, h('h3', {}, title), close), content));
    close.addEventListener('click', () => { closeSheet(); if (onClose) onClose(); });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { closeSheet(); if (onClose) onClose(); } });
    body.append(wrap); sheet = wrap;
    return wrap;
  }
  function closeSheet() { if (sheet) { for (const r of sheet._readers || []) r.stop(); sheet.remove(); sheet = null; } }
  function openBoardSheet(glow = []) {
    const scroll = h('div', { class: 'pane-scroll scroll' });
    const board = createBoard(kase, run.board, { glow, empty: 'Nothing pinned yet.' });
    scroll.append(board);
    openSheet('Evidence board', scroll);
    board.redraw();
  }
  function openDocsSheet() {
    const rs = [];
    const scroll = h('div', { class: 'doc-wrap', style: { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' } });
    const tabs = h('div', { class: 'doc-tabs' });
    const holder = h('div', { style: { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' } });
    let cur = null;
    const show = (d) => {
      for (const t of tabs.children) t.classList.toggle('on', t.dataset.doc === d.id);
      holder.replaceChildren(); if (cur) cur.stop();
      cur = createReader(ctx, kase, d, { mode: 'read', readAloud: false }); rs.push(cur);
      holder.append(cur.el);
    };
    for (const d of kase.docs) { const t = h('button', { class: 'doc-tab', type: 'button', 'data-doc': d.id }, d.title); t.addEventListener('click', () => show(d)); tabs.append(t); }
    scroll.append(tabs, holder);
    const wrap = openSheet('The documents', scroll, null, true);
    wrap._readers = rs;
    show(kase.docs[0]);
  }

  // what the readers need from the app
  const ctx = {
    speech: app.speech,
    voiceReady: () => app.voiceReady(),
    voiceHint: () => app.voiceHint(),
    toast: (t) => app.toast(t),
    noteListen: (docId) => { if (run) { countListen(run, docId); persist(); } },
  };

  // ---------- beat 1: the briefing ----------
  function renderBrief() {
    releaseKeyboard();
    const col = h('div', { class: 'col' });
    const bubbles = kase.briefing.map((b, i) => {
      const say1 = h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear this line', 'data-line': String(i), html: icon('sound') });
      say1.addEventListener('click', () => say(b.text));
      return h('div', { class: `bubble ${b.who === 'partner' ? 'partner' : 'chief'}`, 'data-line': String(i) },
        h('span', { class: 'who' }, b.who === 'partner' ? 'PT' : 'CH'),
        h('p', {}, h('span', { class: 'who-name' }, b.who === 'partner' ? 'Your partner' : 'The Chief'), b.text), say1);
    });
    col.append(...bubbles);
    col.append(h('div', { class: 'objective' }, h('span', { class: 'label-type' }, 'Objective'), h('p', {}, kase.objective)));
    const words = wordsToTeach(run.rank, kase);
    const go = h('button', { class: 'btn btn-teal btn-big', id: 'brief-go', type: 'button', 'data-sfx': '' }, 'Start investigating', h('span', { html: icon('right') }));
    const refreshGo = () => { go.disabled = words.some((w) => !run.wordsDone.includes(w.word)); };
    if (words.length) {
      col.append(h('div', { class: 'sec-head' }, h('h3', {}, 'Case words')));
      for (const w of words) col.append(wordCard(w, refreshGo));
    }
    refreshGo();
    go.addEventListener('click', () => { app.speech.cancel(); run.beat = 'investigate'; persist(); render(); });
    body.replaceChildren(h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll' }, col), h('div', { class: 'foot' }, go)));
    // the Chief speaks the briefing, line by line, with the bubble lit
    if (!run.briefed) {
      run.briefed = true;
      later(async () => {
        if (!app.voiceReady()) return;
        const lines = kase.briefing.map((b) => b.text);
        await app.speech.readEach(lines, (i) => { for (const b of bubbles) b.classList.toggle('speaking', i != null && b.dataset.line === String(i)); });
        for (const b of bubbles) b.classList.remove('speaking');
      }, 250);
    }
  }
  function wordCard(w, onDone) {
    const sent = idx[w.sentenceId] ? idx[w.sentenceId].text : w.word;
    const done = run.wordsDone.includes(w.word);
    const card = h('div', { class: 'wordcard' + (done ? ' done' : ''), 'data-word': w.word });
    const sentEl = h('p', { class: 'wc-sent' });
    sent.split(/\s+/).forEach((tok, i, arr) => {
      const key = wordKey(tok), target = wordKey(w.word);
      const right = key === target || (key.startsWith(target) && key.length - target.length <= 3);
      const b = h('span', { class: 'tok' + (done && right ? ' right' : ''), role: 'button', tabindex: '0', 'data-right': right ? '1' : '0' }, tok);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
      b.addEventListener('click', () => {
        if (run.wordsDone.includes(w.word)) { if (right) say(wordSpeech(w)); return; }
        if (!right) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); app.audio.click(); return; }
        b.classList.add('right'); card.classList.add('done'); app.audio.pop();
        run.wordsDone.push(w.word); persist();
        card.append(h('p', { class: 'wc-mean' }, h('b', {}, w.word), ' means ', w.meaning, '.'));
        say(wordSpeech(w)); onDone();
      });
      sentEl.append(b); if (i < arr.length - 1) sentEl.append(' ');
    });
    card.append(h('p', { class: 'wc-ask' }, `Tap the word “${w.word}”`), sentEl);
    if (done) card.append(h('p', { class: 'wc-mean' }, h('b', {}, w.word), ' means ', w.meaning, '.'));
    return card;
  }

  // ---------- beat 2: investigate (the desk and the readers) ----------
  let deskDoc = null;
  function renderInvestigate() {
    releaseKeyboard();
    if (deskDoc) return renderDocPage(deskDoc);
    const col = h('div', { class: 'col' });
    col.append(h('div', { class: 'bubble partner' }, h('span', { class: 'who' }, 'PT'), h('p', {}, h('span', { class: 'who-name' }, 'Your partner'), LINES.openDocs), h('span')));
    const desk = h('div', { class: 'desk' });
    for (const d of kase.docs) {
      const opened = run.opened.includes(d.id);
      const rd = readAloudDefault(run.rank, d);
      const f = h('button', { class: 'docfolder' + (opened ? ' opened' : ''), type: 'button', 'data-doc': d.id, 'data-kind': KIND_LABEL[d.kind] || 'Document', 'data-sfx': '' },
        h('h4', {}, d.title), h('span', { class: 'from' }, d.from),
        h('span', { class: 'tags' }, d.stretch ? h('span', { class: 'tag stretch' }, 'Stretch') : null, rd ? h('span', { class: 'tag read' }, 'Read to me') : null, opened ? h('span', { class: 'tag' }, 'Opened') : null));
      f.addEventListener('click', () => { deskDoc = d; if (!run.opened.includes(d.id)) run.opened.push(d.id); persist(); render(); });
      desk.append(f);
    }
    col.append(desk);
    const all = kase.docs.every((d) => run.opened.includes(d.id));
    const go = h('button', { class: 'btn btn-teal btn-big', id: 'open-notebook', type: 'button', 'data-sfx': '' }, 'Open the notebook', h('span', { html: icon('right') }));
    go.disabled = !all;
    go.addEventListener('click', () => { run.beat = 'pin'; persist(); render(); });
    body.replaceChildren(h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll' }, col), h('div', { class: 'foot' }, go)));
  }
  function renderDocPage(d) {
    const rd = readAloudDefault(run.rank, d);
    const on = run.readAloud && d.id in run.readAloud ? run.readAloud[d.id] : rd;
    const reader = createReader(ctx, kase, d, { mode: 'read', readAloud: on, onReadAloud: (v) => { run.readAloud[d.id] = v; persist(); } });
    const back = h('button', { class: 'btn btn-teal', id: 'doc-back', type: 'button', 'data-sfx': '' }, h('span', { html: icon('back') }), 'Back to the desk');
    back.addEventListener('click', () => { reader.stop(); deskDoc = null; render(); });
    body.replaceChildren(h('div', { class: 'pane' }, reader.el, h('div', { class: 'foot' }, back)));
    if (on) later(() => reader.startAll(), 350);
  }

  // ---------- beat 3: pin the evidence ----------
  let sel = '';                       // the sentence tapped (not pinned yet)
  let nb = null;                      // the notebook element
  let tabs = null, readerHolder = null, curDoc = null;
  let qState = { done: false, why: false, note: '' };     // per question: whether it is pinned and the partner's last note
  let idleTimer = 0;
  function hintTexts(q, tier, repeated) {
    const out = [];
    if (tier >= 1) out.push(['Your partner asks', q.hint]);
    if (tier >= 2) out.push(['Look closer', LINES.tier2]);
    if (tier >= 3) out.push(['Your partner shows how', `${q.model} ${repeated ? LINES.tier3Again : LINES.tier3Tap}`]);
    return out.slice(-1)[0] ? [out.slice(-1)[0]] : [];
  }
  function applyTierView(q, tier, repeated) {
    // the document side: tier 2 lights the right paragraph (switching to its tab), tier 3 dims the rest, and a repeat glows the sentence
    const left = (q.answer || []).filter((id) => !pinnedIn(run, q.id).includes(id));
    const target = left[0];
    const d = target && docOfSentence(kase, target);
    if (tier >= 2 && d) {
      if (!curDoc || curDoc.id !== d.id) showDoc(d, true);
      const r = readers.get(d.id);
      r.highlightPara(r.paraOf(target), tier >= 3);
      if (tier >= 3 && repeated) r.glow(target);
    }
  }
  function clearTierView() { for (const r of readers.values()) { r.highlightPara(null, false); r.glow(null); } }
  function showDoc(d, flash) {
    curDoc = d;
    for (const t of tabs.children) { t.classList.toggle('on', t.dataset.doc === d.id); if (flash && t.dataset.doc === d.id) { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); } }
    readerHolder.replaceChildren(readers.get(d.id).el);
  }
  function renderPin() {
    const q = questionOf(run, kase);
    if (!q) { run.beat = 'rebuild'; persist(); return render(); }
    if (!nb) {
      // first time in this beat: the readers, the tabs, the notebook
      readers = new Map();
      for (const d of kase.docs) {
        const r = createReader(ctx, kase, d, { mode: 'pick', readAloud: false, onSelect: (id) => selectSentence(id) });
        readers.set(d.id, r);
      }
      tabs = h('div', { class: 'doc-tabs' });
      for (const d of kase.docs) {
        const t = h('button', { class: 'doc-tab', type: 'button', 'data-doc': d.id, 'data-sfx': '' }, d.title);
        t.addEventListener('click', () => showDoc(d));
        tabs.append(t);
      }
      readerHolder = h('div', { style: { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' } });
      nb = h('div', { class: 'notebook', id: 'notebook' });
      body.replaceChildren(h('div', { class: 'split' }, nb, h('div', { class: 'doc-wrap' }, tabs, readerHolder)));
      const first = docOfSentence(kase, (q.answer || [])[0]) || kase.docs[0];
      showDoc(kase.docs.find((d) => d.id === (run.lastDoc || '')) || kase.docs[0] || first);
    }
    for (const r of readers.values()) r.markPinned(run.board);
    drawNotebook(q);
  }
  function drawNotebook(q) {
    const pinned = pinnedIn(run, q.id), need = (q.answer || []).length;
    const complete = pinned.length >= need;
    const tier = run.hints[q.id] || 0;
    const dots = h('span', { class: 'pindots', 'aria-label': `Question ${run.q + 1} of ${kase.questions.length}` }, ...kase.questions.map((x, i) => h('i', { class: pinnedIn(run, x.id).length >= (x.answer || []).length ? 'on' : '' })));
    const hearQ = h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear the question', html: icon('sound'), style: { background: 'rgba(0,0,0,.1)', color: '#26200f' } });
    hearQ.addEventListener('click', () => say(q.prompt));
    const head = h('div', { class: 'nb-top' }, h('span', { class: 'label-type' }, `Question ${run.q + 1} of ${kase.questions.length}`), h('span', { style: { flex: 1 } }), dots);
    const parts = [h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start' } }, h('p', { class: 'nb-q', id: 'nb-q' }, q.prompt), hearQ)];
    if (need > 1 && !complete) parts.push(h('p', { class: 'label-type', style: { color: '#8a5a2a' } }, `Pinned ${pinned.length} of ${need}`));
    if (complete) {
      parts.push(h('p', { class: 'nb-why', id: 'nb-why' }, h('b', {}, 'Why it proves it'), q.why));
    } else if (tier > 0) {
      const [label, txt] = hintTexts(q, tier, run.misses[q.id] > 3)[0];
      parts.push(h('p', { class: 'nb-hint', id: 'nb-hint', 'data-tier': String(tier) }, h('b', {}, label), qState.note ? h('span', { id: 'nb-note', style: { display: 'block', fontWeight: '700' } }, qState.note) : null, txt));
    } else if (qState.note) parts.push(h('p', { class: 'nb-hint', id: 'nb-note' }, h('b', {}, 'Your partner'), qState.note));
    const act = h('div', { class: 'nb-actions' });
    if (complete) {
      const last = run.q + 1 >= kase.questions.length;
      const next = h('button', { class: 'btn btn-teal', id: 'nb-next', type: 'button', 'data-sfx': '' }, last ? 'Put the story in order' : 'Next question', h('span', { html: icon('right') }));
      next.addEventListener('click', () => {
        qState = { done: false, note: '' }; sel = ''; clearTierView();
        if (last) { run.beat = 'rebuild'; nb = null; persist(); say(LINES.allSet); render(); return; }
        nextQuestion(run, kase); persist(); startQuestion();
      });
      act.append(next);
    } else {
      const hint = h('button', { class: 'btn btn-sm', id: 'nb-hint-btn', type: 'button', 'data-sfx': '' }, h('span', { html: EXTRA_ICONS.bulb }), 'Hint');
      hint.addEventListener('click', () => { const t = requestHint(run, q.id); qState.note = ''; persist(); app.audio.click(); showTier(q, t, false); });
      const pin = h('button', { class: 'btn btn-teal', id: 'nb-pin', type: 'button', 'data-sfx': '' }, h('span', { html: EXTRA_ICONS.pin }), 'Pin it');
      pin.disabled = !sel;
      pin.addEventListener('click', () => pinIt(q));
      act.append(hint, h('span', { class: 'grow' }), pin);
    }
    nb.replaceChildren(head, h('div', { class: 'nb-scroll' }, ...parts), act);
  }
  function selectSentence(id) {
    const q = questionOf(run, kase); if (!q || qState.done) return;
    if (pinnedIn(run, q.id).includes(id)) return;
    sel = id; app.audio.click();
    for (const r of readers.values()) r.setSelected(r.hasSentence(id) ? id : '');
    const pin = $('#nb-pin'); if (pin) pin.disabled = false;
    armIdle(q);
  }
  function showTier(q, tier, repeated) {
    drawNotebook(q); applyTierView(q, tier, repeated);
    const [, txt] = hintTexts(q, tier, repeated)[0] || [];
    if (txt) say(txt);
    armIdle(q);
  }
  function pinIt(q) {
    if (!sel) return;
    const id = sel, from = readers.get(curDoc.id).el.querySelector(`.s[data-id="${id}"]`);
    const r = pinTap(run, kase, id);
    for (const rd of readers.values()) rd.setSelected('');
    sel = '';
    if (r.ok) {
      app.audio.pop(); fly(from, id); clearTierView(); qState.note = '';
      for (const rd of readers.values()) rd.markPinned(run.board);
      chrome(); persist();
      if (r.done) { qState.done = true; drawNotebook(q); say(q.why); clearIdle(); }
      else { qState.note = LINES.oneMore; drawNotebook(q); say(LINES.oneMore); armIdle(q); }
    } else {
      app.audio.click();
      qState.note = LINES.checkAgain; persist();
      showTier(q, r.tier, r.repeated);
    }
  }
  function fly(fromEl, id) {
    if (app.settings.reducedMotion || !fromEl) return;
    const a = fromEl.getBoundingClientRect(), b = boardBtn.getBoundingClientRect();
    const f = h('div', { class: 'flyer' }, idx[id] ? idx[id].text : '');
    f.style.left = `${a.left}px`; f.style.top = `${a.top}px`;
    document.body.append(f);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.18) rotate(8deg)`; f.style.opacity = '.2';
    }));
    setTimeout(() => f.remove(), 700);
  }
  function startQuestion() {
    const q = questionOf(run, kase);
    qState = { done: false, note: '' }; sel = '';
    clearTierView();
    render();
    if (q) { say(q.prompt); armIdle(q); }
  }
  // ranks 1-3: the partner offers hint tier 1 after 20 s idle (no visible timer)
  function clearIdle() { clearTimeout(idleTimer); idleTimer = 0; }
  function armIdle(q) {
    clearIdle();
    const ms = supportsFor(run.rank).idleHintMs;
    if (!ms || !q || run.beat !== 'pin' || qState.done) return;
    idleTimer = setTimeout(() => {
      if (run.beat !== 'pin' || qState.done || questionOf(run, kase) !== q) return;
      if ((run.hints[q.id] || 0) === 0) { requestHint(run, q.id); persist(); showTier(q, 1, false); }
    }, ms);
  }

  // ---------- beat 4: reconstruct (the timeline) ----------
  function renderRebuild() {
    releaseKeyboard(); clearIdle();
    const tl = kase.timeline, items = tl.items;
    const byId = Object.fromEntries(items.map((it) => [it.id, it]));
    let selCard = '', msg = '', justPlaced = -1;
    const slotsEl = h('div', { class: 'tl', id: 'tl-slots' });
    const trayEl = h('div', { class: 'tray', id: 'tl-tray' });
    const msgEl = h('p', { class: 'msg', id: 'tl-msg', 'aria-live': 'polite' });
    const goEl = h('button', { class: 'btn btn-teal btn-big', id: 'tl-go', type: 'button', 'data-sfx': '' }, 'Close the case', h('span', { html: icon('right') }));
    goEl.hidden = true;
    goEl.addEventListener('click', () => { run.beat = 'solve'; typed = ''; persist(); render(); });
    const docs = h('button', { class: 'btn', id: 'tl-docs', type: 'button', 'data-sfx': '' }, h('span', { html: EXTRA_ICONS.magnifier }), 'Check the documents');
    docs.addEventListener('click', () => openDocsSheet());
    const prompt = h('div', { class: 'bubble partner' }, h('span', { class: 'who' }, 'PT'), h('p', {}, h('span', { class: 'who-name' }, 'Your partner'), tl.prompt), h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear it', html: icon('sound'), onclick: () => say(tl.prompt) }));

    function draw() {
      slotsEl.replaceChildren();
      run.tl.slots.forEach((id, i) => {
        const it = id ? byId[id] : null;
        const s = h('div', { class: 'slot' + (it ? ' filled' : '') + (it && (tl.given || []).includes(i) ? ' given' : '') + (!it && selCard ? ' target' : '') + (i === justPlaced ? ' just' : ''), 'data-slot': String(i) },
          h('span', { class: 'no' }, String(i + 1)), it ? h('span', { class: 'txt' }, it.text) : h('span', { class: 'ph' }, selCard ? 'Tap to place' : 'Which comes here?'));
        if (tl.kind === 'cause' && i < items.length - 1) s.append(h('span', { class: 'so' }, 'so'));
        s.addEventListener('click', () => { if (!it && selCard) place(selCard, i); });
        slotsEl.append(s);
      });
      trayEl.replaceChildren();
      for (const id of trayOf(run, kase, app.playerId)) {
        const c = h('button', { class: 'tcard' + (id === selCard ? ' sel' : ''), type: 'button', 'data-card': id }, byId[id].text);
        wireCard(c, id);
        trayEl.append(c);
      }
      msgEl.textContent = msg;
      const done = run.tl.slots.every(Boolean);
      goEl.hidden = !done;
    }
    function place(cardId, slot) {
      const r = placeCard(run, kase, cardId, slot);
      selCard = '';
      if (r.ignored) { draw(); return; }
      if (r.ok) {
        app.audio.pop(); justPlaced = slot; msg = r.done ? LINES.timelineDone : ''; persist();
        if (r.done) say(LINES.timelineDone);
        draw(); justPlaced = -1;
      } else {
        app.audio.click();
        const d = docOfSentence(kase, r.item.proof);
        msg = checkDoc(d ? d.kind : ''); persist(); say(msg);
        draw();
        const back = trayEl.querySelector(`[data-card="${cardId}"]`); if (back) back.classList.add('back');
      }
    }
    // tap a card then a slot; dragging a card onto a slot works too
    function wireCard(c, id) {
      let start = null, ghost = null, dragging = false;
      c.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, id: e.pointerId }; dragging = false; try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
      c.addEventListener('pointermove', (e) => {
        if (!start || e.pointerId !== start.id) return;
        if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
          dragging = true;
          ghost = c.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = `${c.offsetWidth}px`; document.body.append(ghost);
          selCard = id; c.classList.add('sel'); for (const s of slotsEl.children) if (!s.classList.contains('filled')) s.classList.add('target');
        }
        if (dragging) {
          ghost.style.left = `${e.clientX - 20}px`; ghost.style.top = `${e.clientY - 20}px`;
          const over = document.elementFromPoint(e.clientX, e.clientY), slot = over && over.closest && over.closest('.slot');
          for (const s of slotsEl.children) s.classList.toggle('over', s === slot);
        }
      });
      const end = (e) => {
        if (!start || e.pointerId !== start.id) return;
        const was = dragging; start = null; dragging = false;
        if (ghost) { ghost.remove(); ghost = null; }
        if (was) {
          const over = document.elementFromPoint(e.clientX, e.clientY), slot = over && over.closest && over.closest('.slot');
          if (slot && !slot.classList.contains('filled')) place(id, Number(slot.dataset.slot)); else { selCard = ''; draw(); }
          c._dragged = true; setTimeout(() => { c._dragged = false; }, 60);
        }
      };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      c.addEventListener('click', () => { if (c._dragged) return; selCard = selCard === id ? '' : id; app.audio.click(); draw(); });
    }
    const right = h('div', { class: 'tl-right' }, h('span', { class: 'label-type' }, 'Cards'), trayEl, msgEl);
    const tlWrap = h('div', { class: 'tl-wrap scroll' }, slotsEl, right);
    body.replaceChildren(h('div', { class: 'pane' }, prompt, tlWrap, h('div', { class: 'foot' }, docs, goEl)));
    msg = run.tl.slots.every(Boolean) ? LINES.timelineDone : '';
    draw();
    if (!run.tlSpoken) { run.tlSpoken = true; later(() => say(tl.prompt), 200); }
  }

  // ---------- beat 5: close the case ----------
  function renderSolve() {
    const sol = kase.solution;
    const stage = run.sol.ok ? 'attach' : 'type';
    const answer = h('div', { class: 'answer-box', id: 'answer-box', 'aria-live': 'polite' });
    const hintBox = h('div', { id: 'solve-hint' });
    const drawAnswer = () => {
      answer.replaceChildren(typed ? h('span', {}, display(typed)) : h('span', { class: 'ph' }, 'Type your answer'), h('i', { class: 'caret' }));
      syncEnter();
    };
    const prompt = h('div', { class: 'bubble partner' }, h('span', { class: 'who' }, 'PT'), h('p', {}, h('span', { class: 'who-name' }, 'Close the case'), sol.prompt), h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear the question', html: icon('sound'), onclick: () => say(sol.prompt) }));
    const hintLine = (txt) => hintBox.replaceChildren(h('p', { class: 'nb-hint', style: { background: 'rgba(47,209,192,.2)', color: '#e8fffd', border: '2px solid var(--accent)' } }, h('b', { style: { color: 'var(--accent)' } }, 'Your partner'), txt));
    function showSolveTier(tier) {
      const proof = (sol.proof || []).map((id) => idx[id] && idx[id].text).filter(Boolean);
      const lines = [LINES.checkAgain, [LINES.solveTier1, LINES.solveTier2, LINES.solveTier3][tier - 1]];
      if (tier >= 3) lines.push(`“${proof.join('” “')}”`);
      hintLine(lines.join(' ')); say(lines.slice(0, 2));
      if (tier >= 2) openBoardSheet((sol.proof || []).filter((id) => run.board.includes(id)));
    }
    if (stage === 'type') {
      const grid = h('div', { class: 'solve-grid' }, h('div', { class: 's-prompt' }, prompt, hintBox), h('div', { class: 's-answer' }, answer));
      body.replaceChildren(h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll solve-scroll' }, grid), h('div', { class: 'kbwrap' }, kb.el)));
      typed = run.sol.text || '';
      useKeyboard({ max: 40, label: 'Check', draw: drawAnswer, enter: () => {
        const r = submitSolution(run, kase, typed.trim()); persist();
        if (r.ok) { app.audio.cash(); say(LINES.attach); renderSolve(); }
        else { app.audio.click(); showSolveTier(r.tier); }
      } });
      drawAnswer();
      if (run.sol.hint > 0) hintLine([LINES.checkAgain, [LINES.solveTier1, LINES.solveTier2, LINES.solveTier3][run.sol.hint - 1]].join(' '));
      return;
    }
    releaseKeyboard();
    const col = h('div', { class: 'col' });
    col.append(prompt, h('div', { class: 'answer-box', style: { borderColor: 'var(--go)' } }, h('span', {}, display(run.sol.text || sol.answers[0]))));
    const note = h('p', { class: 'msg', id: 'attach-msg' }, run.sol.clueId ? 'Clue attached.' : LINES.attach);
    col.append(note);
    const go = h('button', { class: 'btn btn-teal btn-big', id: 'solve-go', type: 'button', 'data-sfx': '' }, 'Write the case report', h('span', { html: icon('right') }));
    go.disabled = !run.sol.clueId;
    const board = () => createBoard(kase, run.board, { pickable: true, selected: run.sol.clueId, onPick: (id) => {
      if (attachClue(run, kase, id)) { app.audio.pop(); persist(); note.textContent = 'Clue attached.'; go.disabled = false; swap(); }
      else { app.audio.click(); note.textContent = LINES.notThatClue; say(LINES.notThatClue); }
    } });
    const holder = h('div', {});
    const swap = () => { const b = board(); holder.replaceChildren(b); b.redraw(); };
    col.append(holder);
    go.addEventListener('click', () => { run.beat = 'report'; typed = run.rep.because || ''; persist(); say(LINES.writeReport); render(); });
    body.replaceChildren(h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll' }, col), h('div', { class: 'foot' }, go)));
    swap();
  }

  function renderReport() {
    const sol = kase.solution;
    const who = display(sol.answers[0]);
    const because = h('span', { class: 'blank active', id: 'blank-because' });
    const clueBtn = h('button', { class: 'blank empty', id: 'blank-clue', type: 'button', 'data-sfx': '' });
    const msg = h('p', { class: 'msg', id: 'report-msg', 'aria-live': 'polite' });
    const drawBecause = () => {
      because.replaceChildren(typed ? h('span', {}, typed.charAt(0).toUpperCase() + typed.slice(1)) : h('span', { class: 'ph', style: { fontWeight: 400, fontStyle: 'italic', color: '#8a7a52' } }, 'type why'), h('i', { class: 'caret', style: { height: '1.2em', verticalAlign: 'text-bottom' } }));
      run.rep.because = typed; syncEnter();
    };
    const drawClue = () => {
      const c = run.rep.clueId && idx[run.rep.clueId];
      clueBtn.classList.toggle('empty', !c);
      clueBtn.textContent = c ? `“${c.text}”` : 'tap a clue';
    };
    const pickClue = () => {
      const scroll = h('div', { class: 'pane-scroll scroll clue-pick' });
      const board = createBoard(kase, run.board, { pickable: true, selected: run.rep.clueId, onPick: (id) => { run.rep.clueId = id; persist(); app.audio.pop(); drawClue(); closeSheet(); msg.textContent = ''; } });
      scroll.append(board);
      openSheet('Pick the clue that proves it', scroll); board.redraw();
    };
    clueBtn.addEventListener('click', pickClue);
    const frame = h('p', { class: 'frame', id: 'frame' }, h('span', { class: 'blank fixed', id: 'blank-who' }, who), ' did it because ', because, '. The clue that proves it is ', clueBtn, '.');
    const prompt = h('div', { class: 'bubble partner' }, h('span', { class: 'who' }, 'PT'), h('p', {}, h('span', { class: 'who-name' }, 'Case report'), 'Finish the sentence. Then tap the clue that proves it.'), h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear it', html: icon('sound'), onclick: () => say(LINES.writeReport) }));
    const grid = h('div', { class: 'solve-grid report' }, h('div', { class: 's-prompt' }, prompt), h('div', { class: 's-answer' }, frame, msg));
    body.replaceChildren(h('div', { class: 'pane' }, h('div', { class: 'pane-scroll scroll solve-scroll' }, grid), h('div', { class: 'kbwrap' }, kb.el)));
    useKeyboard({ max: 110, label: 'File it', draw: drawBecause, enter: () => {
      const r = submitReport(run, kase, typed.trim(), run.rep.clueId); persist();
      if (r === 'ok') { app.audio.cash(); finish(who); return; }
      app.audio.click();
      const line = r === 'short' ? LINES.moreWords : r === 'ask' ? LINES.addMore : LINES.pickClue;
      msg.textContent = line; say(line);
      if (r === 'needclue') pickClue();
    } });
    drawBecause(); drawClue();
  }
  function finish(who) {
    releaseKeyboard(); clearIdle(); clearTimers(); closeSheet();
    app.speech.cancel();
    app.finishCase(kase, run, who);
  }

  // ---------- the beat router ----------
  function render() {
    clearTimers(); closeSheet();
    chrome();
    $('#screen-case').dataset.beat = run.beat;
    switch (run.beat) {
      case 'brief': return renderBrief();
      case 'investigate': return renderInvestigate();
      case 'pin': { const q = questionOf(run, kase), fresh = !nb; renderPin(); if (fresh && q && !qState.done) { say(q.prompt); armIdle(q); } return undefined; }
      case 'rebuild': nb = null; qState = { done: false, note: '' }; return renderRebuild();
      case 'solve': return renderSolve();
      case 'report': return renderReport();
      default: return undefined;
    }
  }

  return {
    /** Start or resume a case. */
    show({ kase: k, run: r }) {
      kase = k; run = r; idx = sentenceIndex(k); deskDoc = null; nb = null; sel = ''; typed = '';
      qState = { done: false, note: '' };
      if (run.beat === 'pin') { const q = questionOf(run, kase); qState.done = !!q && pinnedIn(run, q.id).length >= (q.answer || []).length; }
      render();
    },
    hide() { clearTimers(); clearIdle(); closeSheet(); releaseKeyboard(); app.speech.cancel(); for (const r of readers.values()) r.stop(); nb = null; },
    get run() { return run; },
    get beat() { return run ? run.beat : ''; },
  };
}
