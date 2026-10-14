// Spell panel: "Spell to Launch" (SPEC v3 steps 1-5). Overlays the parked car at the top of the ramp.
//   new word  → Look (4 s: tiles with the pattern chunk + syllable breaks, said and spelled aloud) → Cover → Write
//   Write     → LAUNCH checks immediately. First try right → PERFECT SPELL (100 % power, 125 % nitro, bonus).
//   a miss    → Cover-Copy-Compare: Compare (≤ 3 s: the attempt with differing positions in red, the word above
//               in green, spelled aloud with each tile lighting) → the attempt clears (R2) → Copy (word visible,
//               only matching letters are accepted, LAUNCH only on a match) → Cover (word hidden, from memory).
//               Cover right → 65 % power. Cover wrong → Compare + Copy + Cover once more; a second miss goes at
//               65 % anyway and the word is re-queued for later this session (the caller's scheduler does that).
// R1: while the child spells from memory (Write / Cover) the word is not in the DOM at all.
// Speech fallback: when speech is missing, lists no voices within 1.5 s, or the spoken word never starts
// (no onstart within 1.5 s: iOS before a tap, an iframe without audio, a paused synth), the word is shown for
// 3 s ("Look, then spell it") and then covered, with a one-time hint. The child never waits on a silent panel.
// Resolves { word, firstTry, fixed, bonus, powerScale, nitroScale, misses } or { cancelled: true }.
import { diffAttempt, letterName, normalizeWord, patternRanges, syllableBreaks } from './words.js';
import { createKeyboard } from './keyboard.js';
import { spellBonus } from './wordStore.js';

export const LOOK_MS = 4000;
export const FALLBACK_LOOK_MS = 3000;
export const NO_SPEECH_HINT = "Speech isn't available on this device, so you'll see each word first.";
export const COMPARE_MS = 2800;          // the child's wrong attempt is gone before 3 s (R2)
export const MAX_ATTEMPT = 24;
export const POWER = { perfect: [1, 1.25], fixed: [0.65, 1], anyway: [0.65, 1] };

const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H10l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

const CANCEL = Symbol('cancel');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** Render a row of letter tiles. cells: [{ch, state?}] or a string. opts: { upper, ranges, breaks, cursor } */
export function renderTiles(row, cells, { upper = false, ranges = [], breaks = new Set(), cursor = false } = {}) {
  const list = typeof cells === 'string' ? Array.from(cells).map((ch) => ({ ch })) : cells;
  row.style.setProperty('--n', String(Math.max(list.length + (cursor ? 1 : 0), 6)));
  row.style.setProperty('--b', String(breaks.size));          // syllable breaks add a little space each
  const frag = document.createDocumentFragment();
  let wi = 0;   // index into the word for pattern / syllable marks (missing cells count, they stand for a word letter)
  list.forEach((c) => {
    const t = el('span', 'tile');
    if (c.state) t.classList.add(c.state);
    if (c.ch === ' ') t.classList.add('sp');
    t.textContent = c.state === 'missing' ? '' : (upper ? c.ch.toUpperCase() : c.ch);
    if (ranges.some(([a, b]) => wi >= a && wi < b)) t.classList.add('pat');
    if (breaks.has(wi)) t.classList.add('brk');
    frag.append(t);
    wi++;
  });
  if (cursor) frag.append(el('span', 'tile cursor'));
  row.replaceChildren(frag);
}

export function createSpellPanel(root, { tts, audio, onCancel = () => {} } = {}) {
  root.classList.add('spell');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Spell the word');
  const card = el('div', 'sp-card');
  const top = el('div', 'sp-top');
  const exit = el('button', 'btn icon-btn sp-exit', BACK); exit.setAttribute('aria-label', 'Back to the garage'); exit.dataset.sfx = '';
  const hear = el('button', 'btn btn-cyan sp-hear', `${SPEAKER}<span>Hear it</span>`); hear.id = 'sp-hear';
  const again = el('button', 'btn sp-again', 'Say it again'); again.id = 'sp-again';
  const sent = el('button', 'btn sp-sentence', `${BUBBLE}<span>Sentence</span>`); sent.id = 'sp-sentence';
  const msg = el('div', 'sp-msg'); msg.id = 'sp-msg';
  const chip = el('div', 'sp-chip'); chip.id = 'sp-chip';
  top.append(exit, hear, again, sent, chip);
  const tiles = el('div', 'sp-tiles');
  tiles.append(msg);
  const model = el('div', 'sp-row sp-model'); model.id = 'sp-model'; model.hidden = true;
  const attemptRow = el('div', 'sp-row sp-attempt'); attemptRow.id = 'sp-attempt';
  const note = el('div', 'sp-note'); note.id = 'sp-note'; note.hidden = true;
  const banner = el('div', 'sp-banner'); banner.id = 'sp-banner'; banner.hidden = true;
  tiles.append(model, attemptRow, note);
  const kbWrap = el('div', 'sp-kb');
  card.append(top, tiles, kbWrap, banner);
  root.replaceChildren(card);

  let S = null;              // current run state
  const kb = createKeyboard({ id: 'sp-keyboard', onKey: typeKey, onBackspace: backspace, onEnter: launch });
  kbWrap.append(kb.el);

  const upper = () => !!(S && S.upper);
  const isOpen = () => !!S;

  function setMode(m) {
    S.mode = m;
    root.dataset.mode = m;
  }
  function setMsg(text, tone = '') { msg.textContent = text; msg.className = 'sp-msg' + (tone ? ' ' + tone : ''); }

  function showModel(lit = -1) {
    model.hidden = false;
    renderTiles(model, Array.from(S.word).map((ch, i) => ({ ch, state: i <= lit ? 'lit' : 'model' })), { upper: upper(), ranges: S.ranges, breaks: S.breaks });
  }
  // R1: hiding the model removes the word from the DOM, not just from view
  function hideModel() { model.hidden = true; model.replaceChildren(); }
  function lightModel(i) {
    const t = model.children[i];
    if (!t) return;
    for (const x of model.children) x.classList.remove('now');
    t.classList.add('lit', 'now');
  }
  function drawAttempt(cells) {
    if (!cells) attemptRow.classList.remove('flash');
    if (cells) renderTiles(attemptRow, cells, { upper: upper() });
    else renderTiles(attemptRow, S.attempt, { upper: upper(), cursor: S.typing && S.attempt.length < MAX_ATTEMPT });
  }
  function clearAttempt() { S.attempt = ''; drawAttempt(); }

  function refreshLaunch() {
    if (!S) return;
    const ok = S.typing && (S.mode === 'copy' ? S.attempt === S.word : S.attempt.trim().length > 0);
    kb.setEnterEnabled(ok);
  }
  function setTyping(on) {
    S.typing = !!on;
    kb.setEnabled(!!on);
    drawAttempt();
    refreshLaunch();
  }

  function typeKey(ch) {
    if (!S || !S.typing) return;
    if (S.attempt.length >= MAX_ATTEMPT) return;
    if (ch === ' ' && (!S.attempt || S.attempt.endsWith(' '))) return;
    if (S.mode === 'copy') {
      // Copy: only the matching next letter is accepted, so a misspelling never builds up on screen (R2)
      const want = S.word[S.attempt.length];
      if (ch !== want) {
        audio.oops && audio.oops(true);
        const t = model.children[S.attempt.length];
        if (t) { t.classList.remove('hint'); void t.offsetWidth; t.classList.add('hint'); }
        return;
      }
    }
    S.attempt += ch;
    audio.letter && audio.letter();
    tts.sayLetter(ch);                // SOS: each typed letter is said by name (R6)
    drawAttempt();
    refreshLaunch();
  }
  function backspace() {
    if (!S || !S.typing || !S.attempt) return;
    S.attempt = S.attempt.slice(0, -1);
    audio.letter && audio.letter(true);
    drawAttempt();
    refreshLaunch();
  }
  function launch() {
    if (!S || !S.typing || !S.waiter) return;
    const w = S.waiter; S.waiter = null;
    setTyping(false);
    w(normalizeWord(S.attempt));
  }
  function waitLaunch() {
    return new Promise((resolve, reject) => { S.waiter = resolve; S.reject = reject; });
  }
  function guard(state) { if (S !== state || state.dead) throw CANCEL; }

  hear.addEventListener('click', () => { if (S) tts.say(S.word); });
  again.addEventListener('click', () => { if (S) { const r = tts.rate; tts.setRate('slow'); tts.say(S.word); tts.setRate(r); } });
  sent.addEventListener('click', () => { if (S && S.info.sentence) tts.say(S.info.sentence); });
  exit.addEventListener('click', () => { if (S) { cancel(); onCancel(); } });

  function cancel() {
    if (!S) return;
    const st = S;
    st.dead = true;
    tts.cancel();
    if (st.reject) st.reject(CANCEL);
    finishUI();
    if (st.resolve) st.resolve({ cancelled: true, word: st.word });
  }
  function finishUI() {
    tts.cancel();               // the panel closing stops any speech it started
    kb.setActive(false);
    kb.setEnabled(false);
    root.hidden = true;
    root.removeAttribute('data-mode');
    hideModel();
    attemptRow.replaceChildren();
    banner.hidden = true;
    S = null;
  }

  async function look(st, ms, silent = false) {
    setMode('look');
    setTyping(false);
    setMsg(silent ? 'Look, then spell it' : st.info.isNew ? 'New word! Look and listen' : 'Look and listen', 'cyan');
    showModel(st.word.length);
    const t0 = performance.now();
    if (!silent && tts.available) {
      const ok = await tts.say(st.word); guard(st);
      if (ok === false) setMsg('Look, then spell it', 'cyan');   // the word is on screen anyway
      else {
        await sleep(200); guard(st);
        await tts.spell(st.word, (i) => { if (S === st) lightModel(i); }, { gap: 180 }); guard(st);
      }
    }
    const left = ms - (performance.now() - t0);
    if (left > 0) { await sleep(left); guard(st); }
    // Cover
    hideModel();
  }
  function noSpeechHint() {
    if (tts.hintShown) return;
    tts.hintShown = true;
    note.hidden = false;
    note.textContent = NO_SPEECH_HINT;
  }
  // speech failed while the child was waiting to hear the word: show it for 3 s, cover it, then spell (R1 holds
  // again from the moment it is covered; any letters typed meanwhile are cleared)
  async function lookInstead(st) {
    if (S !== st || st.dead || st.mode !== 'write' || st.lookedInstead) return;
    st.lookedInstead = true;
    noSpeechHint();
    const waiter = st.waiter;
    st.waiter = null;
    await look(st, FALLBACK_LOOK_MS, true);
    if (S !== st || st.dead) return;
    setMode('write');
    setMsg('Now spell it from memory!', 'cyan');
    st.waiter = waiter;
    clearAttempt();
    setTyping(true);
  }

  async function compare(st, attempt) {
    setMode('compare');
    setTyping(false);
    audio.oops && audio.oops();
    setMsg('So close! The red tiles are different', 'hot');
    S.attempt = attempt;
    drawAttempt(diffAttempt(attempt, st.word).cells);
    showModel(-1);
    const spelled = tts.spell(st.word, (i) => { if (S === st && (st.mode === 'compare' || st.mode === 'copy')) lightModel(i); });
    st.lastSpell = spelled;
    await sleep(COMPARE_MS); guard(st);
    clearAttempt();                   // R2: the misspelling is gone within 3 s
  }

  async function copy(st) {
    setMode('copy');
    showModel(st.word.length);
    setMsg('Copy it, letter by letter', 'go');
    clearAttempt();
    setTyping(true);
    await waitLaunch(); guard(st);
    tts.cancel();
  }

  async function cover(st, round) {
    setMode('cover');
    hideModel();
    setMsg(round ? 'One more time, from memory!' : 'Now cover it. Spell it from memory!', 'cyan');
    clearAttempt();
    setTyping(true);
    tts.say(st.word);
    const a = await waitLaunch(); guard(st);
    return a;
  }

  async function celebrate(st, kind) {
    setMode('done');
    setTyping(false);
    if (kind !== 'anyway') {
      hideModel();
      drawAttempt(Array.from(st.word).map((ch) => ({ ch, state: 'ok' })));
      attemptRow.classList.remove('flash'); void attemptRow.offsetWidth; attemptRow.classList.add('flash');
    }
    banner.className = 'sp-banner ' + kind;
    banner.hidden = false;
    if (kind === 'perfect') {
      banner.innerHTML = `<b>Perfect spell!</b><small>+$${st.bonus.toLocaleString('en-US')} · full power</small>`;
      setMsg(st.streak >= 2 ? `${st.streak} in a row!` : 'First try!', 'go');
      audio.correct && audio.correct();
      await sleep(380); guard(st);
      tts.say(st.word);
      await sleep(1250); guard(st);
    } else if (kind === 'fixed') {
      banner.innerHTML = '<b>You fixed it!</b><small>Good power</small>';
      setMsg('Nice work', 'go');
      audio.correct && audio.correct(true);
      await sleep(1100); guard(st);
    } else {
      hideModel();
      attemptRow.replaceChildren();
      banner.innerHTML = '<b>Good try!</b><small>This word comes back soon</small>';
      setMsg('Let\'s jump anyway', 'cyan');
      await sleep(1300); guard(st);
    }
  }

  async function flow(st) {
    note.hidden = true;           // the no-speech hint shows once per app session (tts.hintShown)
    // Look-Say-Cover-Write-Check for a new word. Otherwise the word is only heard: make sure speech can work
    // (API + voices within 1.5 s), else Look for 3 s first.
    let silentLook = false;
    if (st.info.look) await look(st, LOOK_MS);
    else {
      setMode('init');
      setTyping(false);
      setMsg('Get ready…', 'cyan');
      const speech = await tts.ready(); guard(st);
      if (!speech) { noSpeechHint(); silentLook = true; await look(st, FALLBACK_LOOK_MS, true); }
    }
    // Write (R1: no word on screen)
    setMode('write');
    hideModel();
    setMsg(st.info.look || silentLook ? 'Now spell it from memory!' : 'Listen, then spell it!', 'cyan');
    clearAttempt();
    setTyping(true);
    if (!st.info.look && !silentLook) {
      tts.say(st.word).then((ok) => { if (ok === false) lookInstead(st).catch(() => {}); });
    }
    let attempt = await waitLaunch(); guard(st);
    if (attempt === st.word) {
      st.result = { firstTry: true, fixed: false, power: POWER.perfect };
      st.bonus = spellBonus(st.ctx.streakBefore || 0, st.ctx.coinMult || 1);
      st.streak = (st.ctx.streakBefore || 0) + 1;
      await celebrate(st, 'perfect');
      return;
    }
    st.misses = 1;
    for (let round = 0; round < 2; round++) {
      await compare(st, attempt);
      await copy(st);
      attempt = await cover(st, round);
      if (attempt === st.word) {
        st.result = { firstTry: false, fixed: true, power: POWER.fixed };
        await celebrate(st, 'fixed');
        return;
      }
      st.misses++;
    }
    await compare(st, attempt);
    st.result = { firstTry: false, fixed: false, power: POWER.anyway };
    await celebrate(st, 'anyway');
  }

  return {
    get isOpen() { return isOpen(); },
    get mode() { return S ? S.mode : null; },
    get word() { return S ? S.word : null; },
    /**
     * info: { word, syllables, sentence, pattern, isNew, look }; ctx: { coinMult, streakBefore, mission: {count,size}, upper }
     */
    run(info, ctx = {}) {
      if (S) cancel();
      const word = normalizeWord(info.word);
      const st = S = {
        info, ctx, word, attempt: '', mode: 'init', typing: false, upper: !!ctx.upper, misses: 0, bonus: 0, streak: 0,
        ranges: info.pattern ? patternRanges(word, info.pattern) : [], breaks: syllableBreaks(word, info.syllables), dead: false,
      };
      root.hidden = false;
      root.dataset.word = '';
      sent.hidden = !info.sentence || !tts.available;
      hear.hidden = again.hidden = !tts.available;
      chip.textContent = ctx.mission ? `Today ${Math.min(ctx.mission.count, ctx.mission.size)} / ${ctx.mission.size}` : '';
      chip.hidden = !ctx.mission;
      kb.setUpper(!!ctx.upper);
      kb.setEnterLabel('Launch');
      kb.setActive(true);
      banner.hidden = true;
      attemptRow.classList.remove('flash');
      return new Promise((resolve) => {
        st.resolve = resolve;
        flow(st).then(() => {
          if (st.dead) return;
          const [powerScale, nitroScale] = st.result.power;
          const out = { word, firstTry: st.result.firstTry, fixed: st.result.fixed, bonus: st.result.firstTry ? st.bonus : 0, powerScale, nitroScale, misses: st.misses };
          st.resolve = null;
          finishUI();
          resolve(out);
        }).catch((e) => {
          if (e !== CANCEL) { console.error('[spellPanel]', e); if (S === st) { finishUI(); resolve({ cancelled: true, word, error: true }); } }
        });
      });
    },
    cancel,
    letterName,
  };
}
