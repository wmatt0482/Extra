// The problem panel (SPEC §3 "The General Store", "Rations and distance", events; §12): one word problem from the
// Journey stream's problems.js (problemFor → { text, say, answer, unit, work: [3 lines], kind, fact }), the sentence in
// big type, read aloud as it appears (and again with Hear it), the answer typed on the shared numpad (Trail Blazer's
// trail-blazer/src/ui/numpad.js; keyboard digits / Backspace / Enter) with its unit around the tiles ("$ _ _",
// "_ _ lb", "_ days").
//   right → green, "Nice!", done
//   a miss → the typed answer shakes away within half a second (never left on screen), then the work, one line at a
//            time, each read aloud (a worked example), then the answer typed once with the work still showing (copy);
//            a match → "Fixed it!"; a wrong copy clears at once and the answer shows in the tiles for a moment, then
//            the copy again. Nothing is lost by a miss: the goods cost the same, the wagon rolls on (main.js).
// Two-answer problems ("how many, and what is left?", SPEC §10 'divide'): `steps: [{ ask, answer, unit }]`,
// `remainder` (asked second: "And how much is left?") or `answer: [a, b]` are asked in turn, the same rules for each.
// The panel owns no data: open() resolves { correct (every answer right the first time), fixed, ms, given, answers }.
// v1.1: every sentence is its own utterance (the problem, then its first question; the work one line at a time), so
// each one can be a natural-voice clip (≤ 200 characters each); problemTexts(p) lists them all, and main.js has the
// voice prepare them (app.voiceFor) before the panel opens.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { spokenHint } from '../../../trail-blazer/src/facts/hints.js';
import { createNumpad } from '../../../trail-blazer/src/ui/numpad.js';

export const RIGHT_MS = 1000;
export const WRONG_FLASH_MS = 450;
export const LINE_MS = 1300;          // between the work lines (at least; the voice finishing each line counts too)
export const SHOW_ANSWER_MS = 1400;

/** A line with symbols as the voice reads it ("$56" → "56 dollars", "7 × 8 = 56" → "seven times eight equals fifty-six."). */
export const spokenLine = (text) => spokenHint(String(text || '').replace(/\$\s?(\d[\d,]*)/g, (m, d) => `${d.replace(/,/g, '')} dollars`));

/** Every sentence the panel may say for a problem (in the order it says them), for the natural voice to prepare. */
export function problemTexts(p) {
  if (!p) return [];
  const out = [p.say || spokenLine(p.text)];
  for (const st of stepsOf(p)) if (st.ask || st.say) out.push(st.say || spokenLine(st.ask));
  if (Array.isArray(p.parts)) for (const part of p.parts) if (part && part.say) out.push(part.say);
  for (const line of Array.isArray(p.work) ? p.work : []) if (typeof line === 'string' && line.trim()) out.push(spokenLine(line));
  return [...new Set(out.map((t) => String(t || '').trim()).filter(Boolean))];
}

/** The answers one problem asks for, in turn: [{ ask, answer, unit }]. */
export function stepsOf(p) {
  if (!p) return [];
  // the Journey stream's remainder variant: parts [{ text, say, answer, unit }] asked in turn (a part's text that only
  // repeats the sentence is not shown twice)
  if (Array.isArray(p.parts) && p.parts.length) return p.parts.map((s) => ({ ask: s.text && s.text !== p.text ? s.text : null, say: s.say || null, answer: Math.round(Number(s.answer)), unit: s.unit ?? p.unit ?? '' }));
  if (Array.isArray(p.steps) && p.steps.length) return p.steps.map((s) => ({ ask: s.ask || null, answer: Math.round(Number(s.answer)), unit: s.unit ?? p.unit ?? '' }));
  const list = Array.isArray(p.answers) && p.answers.length > 1 ? p.answers : Array.isArray(p.answer) ? p.answer : null;
  if (list) return list.map((a, i) => ({ ask: i ? 'And how much is left?' : null, answer: Math.round(Number(a)), unit: i ? '$' : p.unit || '' }));
  const out = [{ ask: null, answer: Math.round(Number(p.answer)), unit: p.unit || '' }];
  if (Number.isFinite(Number(p.remainder)) && p.remainder !== null && p.remainder !== undefined) out.push({ ask: p.remainderAsk || 'And how much is left?', answer: Math.round(Number(p.remainder)), unit: p.remainderUnit || '$' });
  return out;
}

export function createProblemPanel(root, { tts, audio, sfx = null, aloud = () => true } = {}) {
  const chip = h('span', { class: 'pn-chip', id: 'pp-chip' });
  const hear = h('button', { class: 'btn btn-sm pn-hear', id: 'pp-hear', 'data-sfx': '', 'aria-label': 'Hear it' }, h('span', { html: icon('sound') }), h('span', { class: 'pn-hear-text' }, 'Hear it'));
  const titleText = h('span', { class: 'pn-title-text', id: 'pp-title' }, 'General Store');
  const text = h('p', { class: 'pp-text', id: 'pp-text' });
  const ask = h('p', { class: 'pp-ask', id: 'pp-ask', hidden: true });
  const work = h('ol', { class: 'pp-work', id: 'pp-work', hidden: true });
  const pre = h('span', { class: 'pp-unit pre', id: 'pp-pre' });
  const post = h('span', { class: 'pp-unit post', id: 'pp-post' });
  const tiles = h('span', { class: 'pn-tiles', id: 'pp-tiles', 'aria-live': 'polite' });
  const msg = h('div', { class: 'pn-msg', id: 'pp-msg', 'aria-live': 'polite' });
  const pad = createNumpad({ onDigit: (d) => type(d), onBack: () => back(), onGo: () => go() });
  const card = h('div', { class: 'pn-card pp-card card', role: 'dialog', 'aria-labelledby': 'pp-title' },
    h('div', { class: 'pn-top' }, h('span', { class: 'pn-title' }, h('span', { class: 'pn-post', 'aria-hidden': 'true' }), titleText), chip, hear),
    h('div', { class: 'pn-main pp-main' }, text, ask, work, h('div', { class: 'pp-answer' }, pre, tiles, post), msg),
    h('div', { class: 'pn-pad' }, pad.el));
  root.replaceChildren(card);
  root.hidden = true;

  let S = null;     // { p, steps, i, state, typed, t0, ms, given, missed, fixedAny, resolve, timers, answers }
  const sleep = (ms) => new Promise((r) => { const st = S; const t = setTimeout(r, ms); if (st) st.timers.push(t); });
  const speakable = () => aloud() && tts && tts.available;
  function say(t) { if (!speakable() || !t) return Promise.resolve(); try { tts.cancel(); return Promise.resolve(tts.say(t)).catch(() => {}); } catch (_) { return Promise.resolve(); } }
  // several sentences, one utterance each, in turn (a newer speech cuts the rest off)
  async function sayAll(list) {
    const L = (list || []).filter(Boolean);
    if (!speakable() || !L.length) return;
    try { tts.cancel(); } catch (_) { /* ignore */ }
    for (const t of L) {
      let r = null;
      try { r = await tts.say(t); } catch (_) { r = null; }
      if (r === null) return;
    }
  }
  const step = () => S.steps[S.i];

  function paint() {
    if (!S) return;
    const st = step();
    root.dataset.state = S.state;
    const answer = String(st.answer);
    let shown, cls = '';
    if (S.state === 'show') { shown = answer; cls = 'model'; }
    else if (S.state === 'right' || S.state === 'fixed') { shown = answer; cls = 'ok'; }
    else if (S.state === 'bad') { shown = S.typed; cls = 'bad'; }
    else if (S.state === 'work') shown = '';
    else shown = S.typed;
    const n = Math.max(answer.length, shown.length, 1);
    const kids = [];
    for (let i = 0; i < n; i++) {
      const ch = shown[i] || '';
      kids.push(h('i', { class: `pn-tile ${cls}${!ch && i === shown.length && (S.state === 'ask' || S.state === 'copy') ? ' cursor' : ''}` }, ch));
    }
    tiles.replaceChildren(...kids);
    tiles.dataset.typed = S.typed;
    const u = st.unit || '';
    pre.textContent = u === '$' ? '$' : '';
    post.textContent = u && u !== '$' ? u : '';
    const busy = S.state !== 'ask' && S.state !== 'copy';
    pad.setEnabled(!busy);
    pad.setGoEnabled(!busy && S.typed.length > 0);
    hear.hidden = !speakable();
  }
  function setMsg(t, kind = '') { msg.textContent = t; msg.className = 'pn-msg' + (kind ? ' ' + kind : ''); }

  function type(d) {
    if (!S || (S.state !== 'ask' && S.state !== 'copy')) return;
    if (S.typed.length >= Math.max(5, String(step().answer).length + 1)) return;
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
    const st = S;
    const ok = Number(S.typed) === step().answer;
    if (S.state === 'ask') {
      if (S.i === 0) S.ms = Math.round(performance.now() - S.t0);
      if (ok) { right(st, false); return; }
      if (S.given == null) S.given = Number(S.typed);
      S.missed = true;
      missThenWork(st).catch(() => {});
      return;
    }
    if (ok) { right(st, true); return; }
    copyAgain(st).catch(() => {});
  }
  function right(st, fixed) {
    S.state = fixed ? 'fixed' : 'right';
    S.answers.push(step().answer);
    if (fixed) S.fixedAny = true;
    setMsg(fixed ? 'Fixed it!' : 'Nice!', 'go');
    if (sfx) sfx.nice();
    if (speakable()) { try { tts.cancel(); } catch (_) { /* ignore */ } }
    paint();
    sleep(RIGHT_MS).then(() => {
      if (S !== st) return;
      if (S.i + 1 < S.steps.length) { S.i += 1; askStep(); return; }
      finish({ correct: !S.missed, fixed: S.missed && S.fixedAny, ms: S.ms, given: S.given, answers: S.answers.slice() });
    });
  }
  // the typed answer goes; the work, one line at a time, each read aloud; then the copy with the work showing
  async function missThenWork(st) {
    S.state = 'bad';
    if (sfx) sfx.soft();
    setMsg("Let's work it out:", 'hot');
    paint();
    await sleep(WRONG_FLASH_MS); if (S !== st) return;
    S.typed = '';
    S.state = 'work';
    paint();
    const lines = (Array.isArray(S.p.work) ? S.p.work : []).filter((x) => typeof x === 'string' && x.trim());
    work.replaceChildren();
    work.hidden = !lines.length;
    for (const line of lines) {
      if (S !== st) return;
      work.append(h('li', { class: 'pp-line' }, line));
      await Promise.all([sleep(LINE_MS), Promise.race([say(spokenLine(line)), sleep(6000)])]);
    }
    if (S !== st) return;
    S.state = 'copy';
    S.typed = '';
    setMsg(lines.length ? 'Now you: type the answer' : `It is ${step().answer}. Now you: type it`, 'cyan');
    paint();
  }
  async function copyAgain(st) {
    S.state = 'bad';
    if (sfx) sfx.soft();
    setMsg('Look again:', 'hot');
    paint();
    await sleep(WRONG_FLASH_MS); if (S !== st) return;
    S.typed = '';
    S.state = 'show';
    paint();
    await sleep(SHOW_ANSWER_MS); if (S !== st) return;
    S.state = 'copy';
    setMsg('Now you: type the answer', 'cyan');
    paint();
  }
  function askStep() {
    const st = step();
    S.state = 'ask';
    S.typed = '';
    ask.hidden = !st.ask;
    ask.textContent = st.ask || '';
    work.hidden = true;
    work.replaceChildren();
    setMsg('');
    paint();
    if (st.ask && S.i > 0) say(st.say || spokenLine(st.ask));
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
    const st = step();
    sayAll(S.state === 'copy' || S.state === 'work' ? (S.p.work || []).map(spokenLine) : [S.p.say || spokenLine(S.p.text), st.ask ? st.say || spokenLine(st.ask) : null]);
  });

  return {
    get isOpen() { return !!S; },
    get state() { return S ? S.state : 'closed'; },
    get problem() { return S ? S.p : null; },
    /** The answer the panel waits for now (tests). */
    get answer() { return S ? step().answer : null; },
    /** Ask one problem. { problem, title, chipText }. Resolves { correct, fixed, ms, given, answers } or { cancelled }. */
    open({ problem, title = 'General Store', chipText = '' } = {}) {
      if (S) finish({ cancelled: true });
      const steps = stepsOf(problem).filter((s) => Number.isFinite(s.answer));
      if (!steps.length) return Promise.resolve({ cancelled: true, error: 'no answer' });
      return new Promise((resolve) => {
        S = { p: problem, steps, i: 0, state: 'ask', typed: '', t0: 0, ms: 0, given: null, missed: false, fixedAny: false, resolve, timers: [], answers: [] };
        titleText.textContent = title;
        chip.textContent = chipText;
        chip.hidden = !chipText;
        text.textContent = problem.text || '';
        root.dataset.kind = problem.kind || '';
        root.hidden = false;
        pad.setActive(true);
        askStep();
        S.t0 = performance.now();
        sayAll([problem.say || spokenLine(problem.text), steps[0].ask ? steps[0].say || spokenLine(steps[0].ask) : null]);
      });
    },
    cancel() { if (S) { try { tts.cancel(); } catch (_) { /* ignore */ } finish({ cancelled: true }); } },
  };
}
