// The Gate panel (SPEC §5, v1.2): over the frozen race, the Ranger parked at the gate sign behind it. The fact in big
// type ("7 × 8", a commutative fact either way round), read aloud as it appears ("seven times eight."), the typed
// answer in big tiles, a numpad (0-9 ⌫ GO, keyboard digits / Backspace / Enter) and Hear it.
//   ask → right: green, "56! ⚡ Quick!" (≤ 3 s from the moment the fact appeared, voice or not) or "56!", 0.9 s, done
//       → wrong: the typed answer goes (never left on screen), the whole fact with its answer and a strategy hint,
//         read aloud, 2.5 s → copy: the answer covered, type it from memory; a match → "Fixed it!", done (fixed);
//         a wrong copy clears within a second and the fact with its answer shows again (then copy again)
// The panel owns no data: open() resolves { correct, quick, fixed, ms } and main.js records it and opens the gate.
// opts.aloud() false ("Facts aloud" off in the Parent Zone): shown only, no Hear it.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { factAnswer, factText, fullSentence, questionSentence } from '../facts/facts.js';
import { hintFor, hintSpoken } from '../facts/hints.js';
import { QUICK_MS } from '../facts/scheduler.js';
import { createNumpad } from './numpad.js';
import { icon } from './tbIcons.js';

export const RIGHT_MS = 900;
export const SHOW_MS = 2500;
export const WRONG_FLASH_MS = 450;

export function createGatePanel(root, { tts, audio, aloud = () => true } = {}) {
  const chip = h('span', { class: 'gp-chip', id: 'gp-chip' });
  const hear = h('button', { class: 'btn btn-sm gp-hear', id: 'gp-hear', 'data-sfx': '', 'aria-label': 'Hear it' }, h('span', { html: icon('sound') }), 'Hear it');
  const q = h('span', { class: 'gp-q', id: 'gp-q' });
  const tiles = h('span', { class: 'gp-tiles', id: 'gp-tiles', 'aria-live': 'polite' });
  const msg = h('div', { class: 'gp-msg', id: 'gp-msg', 'aria-live': 'polite' });
  const hint = h('div', { class: 'gp-hint', id: 'gp-hint' });
  const pad = createNumpad({ onDigit: (d) => type(d), onBack: () => back(), onGo: () => go() });
  const card = h('div', { class: 'gp-card', role: 'dialog', 'aria-labelledby': 'gp-q' },
    h('div', { class: 'gp-top' }, h('span', { class: 'gp-title' }, h('span', { html: icon('lock') }), h('span', { class: 'gp-title-text' }, 'Math gate')), chip, hear),
    h('div', { class: 'gp-main' }, h('div', { class: 'gp-fact' }, q, h('span', { class: 'gp-eq' }, '='), tiles), msg, hint),
    h('div', { class: 'gp-pad' }, pad.el));
  root.replaceChildren(card);
  root.hidden = true;

  let S = null;            // { fact, flip, answer, state, typed, t0, resolve, timers, ms, missed }
  const later = (fn, ms) => { const st = S; const t = setTimeout(() => { if (S === st) fn(); }, ms); S.timers.push(t); };
  const speakable = () => aloud() && tts && tts.available;
  function say(text) { if (!speakable()) return; try { tts.cancel(); tts.say(text); } catch (_) { /* ignore */ } }

  function paint() {
    if (!S) return;
    const { state, answer } = S;
    root.dataset.state = state;
    q.textContent = factText(S.fact, S.flip);
    const len = String(answer).length;
    let shown, cls = '';
    if (state === 'show') { shown = String(answer); cls = 'model'; }
    else if (state === 'right' || state === 'fixed') { shown = String(answer); cls = 'ok'; }
    else if (state === 'bad') { shown = S.typed; cls = 'bad'; }
    else shown = S.typed;
    const n = Math.max(len, shown.length);
    const kids = [];
    for (let i = 0; i < n; i++) {
      const ch = shown[i] || '';
      kids.push(h('i', { class: `gp-tile ${cls}${!ch && i === shown.length && (state === 'ask' || state === 'copy') ? ' cursor' : ''}${state === 'copy' && !ch ? ' covered' : ''}` }, ch));
    }
    tiles.replaceChildren(...kids);
    tiles.dataset.typed = S.typed;
    const busy = state !== 'ask' && state !== 'copy';
    pad.setEnabled(!busy);
    pad.setGoEnabled(!busy && S.typed.length > 0);
    hear.hidden = !speakable();
  }
  function setMsg(text, kind = '') { msg.textContent = text; msg.className = 'gp-msg' + (kind ? ' ' + kind : ''); }

  function type(d) {
    if (!S || (S.state !== 'ask' && S.state !== 'copy')) return;
    if (S.typed.length >= Math.max(4, String(S.answer).length + 1)) return;
    if (S.typed === '0') S.typed = '';
    S.typed += d;
    if (audio && audio.letter) audio.letter();
    paint();
  }
  function back() {
    if (!S || !S.typed) return;
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
        S.state = 'right'; S.quick = quick;
        setMsg(quick ? `${S.answer}! ⚡ Quick!` : `${S.answer}!`, quick ? 'quick' : 'go');
        if (audio) audio.correct();
        if (speakable()) { try { tts.cancel(); } catch (_) { /* ignore */ } }
        paint();
        later(() => finish({ correct: true, quick, fixed: false, ms: S.ms }), RIGHT_MS);
        return;
      }
      S.missed = true;
      wrong();
      return;
    }
    // copy
    if (ok) {
      S.state = 'fixed';
      setMsg(`${S.answer}! Fixed it!`, 'go');
      if (audio) audio.correct(true);
      paint();
      later(() => finish({ correct: false, quick: false, fixed: true, ms: S.ms }), RIGHT_MS);
      return;
    }
    wrong(true);
  }
  // a wrong answer: shake it away within half a second, then the fact with its answer and the hint (read aloud)
  function wrong(copy = false) {
    S.state = 'bad';
    if (audio) audio.oops(copy);
    setMsg(copy ? 'Not quite. Look again:' : 'Not quite. Here it is:', 'hot');
    paint();
    later(() => show(), WRONG_FLASH_MS);
  }
  function show() {
    S.typed = '';
    S.state = 'show';
    hint.textContent = hintFor(S.fact, S.flip);
    hint.hidden = false;
    setMsg(`${factText(S.fact, S.flip)} = ${S.answer}`, 'model');
    paint();
    say(`${fullSentence(S.fact, S.flip)} ${hintSpoken(S.fact, S.flip)}`);
    later(() => copy(), SHOW_MS);
  }
  function copy() {
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
    say(S.state === 'show' ? `${fullSentence(S.fact, S.flip)} ${hintSpoken(S.fact, S.flip)}` : questionSentence(S.fact, S.flip));
  });

  return {
    get isOpen() { return !!S; },
    get state() { return S ? S.state : 'closed'; },
    get fact() { return S ? S.fact : null; },
    get flip() { return S ? S.flip : false; },
    get answer() { return S ? S.answer : null; },
    /** Ask one fact. info: { fact, flip, index (0-based), total }. Resolves { correct, quick, fixed, ms }. */
    open({ fact, flip = false, index = 0, total = 1 } = {}) {
      if (S) finish({ cancelled: true });
      return new Promise((resolve) => {
        S = { fact, flip, answer: factAnswer(fact), state: 'ask', typed: '', t0: 0, resolve, timers: [], ms: 0, missed: false, quick: false };
        chip.textContent = `Gate ${index + 1} of ${total}`;
        hint.hidden = true;
        setMsg('');
        root.hidden = false;
        pad.setActive(true);
        paint();
        S.t0 = performance.now();          // quick is timed from the moment the fact is on screen
        say(questionSentence(fact, flip));
      });
    },
    /** Close without an answer (the race was left). */
    cancel() { if (S) { try { tts.cancel(); } catch (_) { /* ignore */ } finish({ cancelled: true }); } },
  };
}
