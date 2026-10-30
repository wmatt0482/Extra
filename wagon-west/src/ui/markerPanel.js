// The Mile marker panel (SPEC §3 "Mile markers", §12 "the marker"): Wagon West's own panel in the gate panel's shape
// (Trail Blazer's trail-blazer/src/ui/gatePanel.js is not edited: this is a sibling built on its shared numpad), over
// the stopped wagon. Title "Mile marker", the chip "Marker 2 of 5", one fact from the child's Trail Blazer ladder in
// big type ("7 × 8", a commutative fact either way round), read aloud as it appears, the typed answer in big tiles, the
// shared numpad (trail-blazer/src/ui/numpad.js: 0-9 ⌫ GO; keyboard digits / Backspace / Enter) and Hear it.
//   ask → right: green, "56! Nice!" or, within 3 s of the fact appearing, "56! Quick!" (a tailwind), then done
//       → a miss: the typed answer shakes away within half a second (never left on screen), then the whole fact
//         with its answer and Trail Blazer's strategy hint, read aloud, 2.5 s → cover: the answer covered, type it
//         from memory once; a match → "Fixed it!", done. A wrong copy clears at once and the answer shows again,
//         then the cover again. The wagon rolls on either way (main.js: applyMarker with the result).
// No clock on screen, no score, no lives. The panel owns no data: open() resolves { correct, quick, fixed, ms, given }
// and main.js records it in the child's facts store (recordAnswer) and the journey (applyMarker).
// open({ title }) re-titles it for the trail's other quick facts (the storm's card game, the mud hole, a riddle).
// v1.1: open({ riddle: { text, say } }) asks the fact in disguise (Campfire tales' riddle: "Seven wagons, eight oxen
// each. How many oxen?"): the riddle stands where the fact would, and a miss shows the plain fact with its answer as
// always. markerTexts(fact, flip) lists every sentence the panel may say for a fact (the question, and on a miss the
// full sentence with the strategy hint), so main.js can have the natural voice ready before the panel opens.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { factAnswer, factText, fullSentence, questionSentence } from '../../../trail-blazer/src/facts/facts.js';
import { hintFor, spokenHint } from '../../../trail-blazer/src/facts/hints.js';
import { QUICK_MS } from '../../../trail-blazer/src/facts/scheduler.js';
import { createNumpad } from '../../../trail-blazer/src/ui/numpad.js';

export const RIGHT_MS = 1000;
export const SHOW_MS = 2500;
export const WRONG_FLASH_MS = 450;

/** Every sentence the panel can say for this fact: the question, and on a miss the full sentence + the hint. */
export function markerTexts(fact, flip = false) {
  let t = '';
  try { t = hintFor(fact, flip); } catch (_) { t = ''; }
  const full = fullSentence(fact, flip);
  return [questionSentence(fact, flip), `${full} ${t ? spokenHint(t) : ''}`.trim(), full];
}

export function createMarkerPanel(root, { tts, audio, sfx = null, aloud = () => true } = {}) {
  const chip = h('span', { class: 'pn-chip', id: 'mk-chip' });
  const hear = h('button', { class: 'btn btn-sm pn-hear', id: 'mk-hear', 'data-sfx': '', 'aria-label': 'Hear it' }, h('span', { html: icon('sound') }), h('span', { class: 'pn-hear-text' }, 'Hear it'));
  const q = h('span', { class: 'mk-q', id: 'mk-q' });
  let factEl = null;
  const tiles = h('span', { class: 'pn-tiles', id: 'mk-tiles', 'aria-live': 'polite' });
  const msg = h('div', { class: 'pn-msg', id: 'mk-msg', 'aria-live': 'polite' });
  const hint = h('div', { class: 'pn-hint', id: 'mk-hint', hidden: true });
  const pad = createNumpad({ onDigit: (d) => type(d), onBack: () => back(), onGo: () => go() });
  const titleText = h('span', { class: 'pn-title-text', id: 'mk-title' }, 'Mile marker');
  const card = h('div', { class: 'pn-card card', role: 'dialog', 'aria-labelledby': 'mk-title' },
    h('div', { class: 'pn-top' }, h('span', { class: 'pn-title' }, h('span', { class: 'pn-post', 'aria-hidden': 'true' }), titleText), chip, hear),
    h('div', { class: 'pn-main' }, factEl = h('div', { class: 'mk-fact' }, q, h('span', { class: 'mk-eq' }, '='), tiles), msg, hint),
    h('div', { class: 'pn-pad' }, pad.el));
  root.replaceChildren(card);
  root.hidden = true;

  let S = null;
  const later = (fn, ms) => { const st = S; const t = setTimeout(() => { if (S === st) fn(); }, ms); S.timers.push(t); };
  const speakable = () => aloud() && tts && tts.available;
  function say(text) { if (!speakable() || !text) return; try { tts.cancel(); tts.say(text); } catch (_) { /* ignore */ } }

  function paint() {
    if (!S) return;
    const { state, answer } = S;
    root.dataset.state = state;
    const disguised = !!S.riddle && (state === 'ask' || state === 'bad' || state === 'right');
    q.textContent = disguised ? S.riddle.text : factText(S.fact, S.flip);
    factEl.classList.toggle('riddle', disguised);
    let shown, cls = '';
    if (state === 'show') { shown = String(answer); cls = 'model'; }
    else if (state === 'right' || state === 'fixed') { shown = String(answer); cls = 'ok'; }
    else if (state === 'bad') { shown = S.typed; cls = 'bad'; }
    else shown = S.typed;
    const n = Math.max(String(answer).length, shown.length, 1);
    const kids = [];
    for (let i = 0; i < n; i++) {
      const ch = shown[i] || '';
      kids.push(h('i', { class: `pn-tile ${cls}${!ch && i === shown.length && (state === 'ask' || state === 'copy') ? ' cursor' : ''}${state === 'copy' && !ch ? ' covered' : ''}` }, ch));
    }
    tiles.replaceChildren(...kids);
    tiles.dataset.typed = S.typed;
    const busy = state !== 'ask' && state !== 'copy';
    pad.setEnabled(!busy);
    pad.setGoEnabled(!busy && S.typed.length > 0);
    hear.hidden = !speakable();
  }
  function setMsg(text, kind = '') { msg.textContent = text; msg.className = 'pn-msg' + (kind ? ' ' + kind : ''); }

  function type(d) {
    if (!S || (S.state !== 'ask' && S.state !== 'copy')) return;
    if (S.typed.length >= Math.max(4, String(S.answer).length + 1)) return;
    if (S.typed === '0') S.typed = '';
    S.typed += d;
    if (audio && audio.letter) audio.letter();
    paint();
  }
  function back() {
    if (!S || !S.typed || (S.state !== 'ask' && S.state !== 'copy')) return;
    S.typed = S.typed.slice(0, -1);
    if (audio && audio.letter) audio.letter(true);
    paint();
  }
  function go() {
    if (!S || !S.typed || (S.state !== 'ask' && S.state !== 'copy')) return;
    const ok = Number(S.typed) === S.answer;
    if (S.state === 'ask') {
      S.ms = Math.round(performance.now() - S.t0);
      if (ok) {
        const quick = S.ms <= QUICK_MS;
        S.state = 'right';
        setMsg(quick ? `${S.answer}! Quick!` : `${S.answer}! Nice!`, quick ? 'quick' : 'go');
        if (sfx) { sfx.nice(); if (quick) sfx.quick(); }
        if (speakable()) { try { tts.cancel(); } catch (_) { /* ignore */ } }
        paint();
        later(() => finish({ correct: true, quick, fixed: false, ms: S.ms, given: null }), RIGHT_MS);
        return;
      }
      S.given = Number(S.typed);
      miss(false);
      return;
    }
    if (ok) {
      S.state = 'fixed';
      setMsg(`${S.answer}! Fixed it!`, 'go');
      if (sfx) sfx.nice();
      paint();
      later(() => finish({ correct: false, quick: false, fixed: true, ms: S.ms, given: S.given }), RIGHT_MS);
      return;
    }
    miss(true);
  }
  // the typed answer goes within half a second; then the fact with its answer (and the hint), read aloud
  function miss(copy) {
    S.state = 'bad';
    if (sfx) sfx.soft();
    setMsg(copy ? 'Look again:' : 'Here it is:', 'hot');
    paint();
    later(() => show(copy), WRONG_FLASH_MS);
  }
  function show(again) {
    S.typed = '';
    S.state = 'show';
    let t = '';
    try { t = hintFor(S.fact, S.flip); } catch (_) { t = ''; }
    S.hintText = t;
    hint.textContent = t;
    hint.hidden = !t;
    setMsg(`${factText(S.fact, S.flip)} = ${S.answer}`, 'model');
    paint();
    say(again ? fullSentence(S.fact, S.flip) : `${fullSentence(S.fact, S.flip)} ${t ? spokenHint(t) : ''}`.trim());
    later(() => cover(), again ? Math.round(SHOW_MS * 0.6) : SHOW_MS);
  }
  function cover() {
    S.state = 'copy';
    S.typed = '';
    hint.hidden = true;
    setMsg('Now you: type the answer from memory', 'cyan');
    paint();
  }
  function finish(result) {
    const st = S;
    if (!st) return;
    st.timers.forEach(clearTimeout);
    S = null;
    pad.setActive(false);
    root.hidden = true;
    st.resolve(result);
  }

  hear.addEventListener('pointerdown', () => { try { tts.unlock(); } catch (_) { /* ignore */ } });
  hear.addEventListener('click', () => {
    if (!S || !speakable()) return;
    try { tts.reprobe(); } catch (_) { /* ignore */ }
    say(S.state === 'show' ? `${fullSentence(S.fact, S.flip)} ${S.hintText ? spokenHint(S.hintText) : ''}`.trim() : S.riddle ? (S.riddle.say || S.riddle.text) : questionSentence(S.fact, S.flip));
  });

  return {
    get isOpen() { return !!S; },
    get state() { return S ? S.state : 'closed'; },
    get fact() { return S ? S.fact : null; },
    get answer() { return S ? S.answer : null; },
    get riddle() { return S && S.riddle ? S.riddle.text : null; },
    /** Ask one fact. { fact, flip, index (0-based), total, title, chipText, riddle: { text, say } }. Resolves
     *  { correct, quick, fixed, ms, given } or { cancelled }. */
    open({ fact, flip = false, index = 0, total = 0, title = 'Mile marker', chipText = '', riddle = null } = {}) {
      if (S) finish({ cancelled: true });
      return new Promise((resolve) => {
        S = { fact, flip, answer: factAnswer(fact), state: 'ask', typed: '', t0: 0, resolve, timers: [], ms: 0, given: null, hintText: '', riddle: riddle && riddle.text ? riddle : null };
        titleText.textContent = title;
        chip.textContent = chipText || (total > 0 ? `Marker ${index + 1} of ${total}` : '');
        chip.hidden = !chip.textContent;
        hint.hidden = true;
        setMsg('');
        root.hidden = false;
        pad.setActive(true);
        paint();
        S.t0 = performance.now();          // quick is timed from the moment the fact is on screen
        say(S.riddle ? (S.riddle.say || S.riddle.text) : questionSentence(fact, flip));
      });
    },
    /** Close without an answer (the trail was left). */
    cancel() { if (S) { try { tts.cancel(); } catch (_) { /* ignore */ } finish({ cancelled: true }); } },
  };
}
