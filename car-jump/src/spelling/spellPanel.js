// Spell panel: "Spell to Launch" (SPEC v3 steps 1-5). Overlays the parked car at the top of the ramp.
//   new word  → Look (4 s: tiles with the pattern chunk + syllable breaks, said and spelled aloud) → Cover → Write
//   Write     → LAUNCH checks immediately. First try right → PERFECT SPELL (100 % power, 125 % nitro, bonus).
//   a miss    → Cover-Copy-Compare: Compare (≤ 3 s: the attempt with differing positions in red, the word above
//               in green, spelled aloud with each tile lighting) → the attempt clears (R2) → Copy (word visible,
//               only matching letters are accepted, LAUNCH only on a match) → Cover (word hidden, from memory).
//               Cover right → 65 % power. Cover wrong → Compare + Copy + Cover once more; a second miss goes at
//               65 % anyway and the word is re-queued for later this session (the caller's scheduler does that).
// R1: while the child spells from memory (Write / Cover) the word is not in the DOM at all.
// Speech fallback (per word, v3.2.1): when speech is missing, lists no voices within 1.5 s, or the spoken word never
// starts (no onstart within 5 s for the session's first utterance, 3 s afterwards: a slow online voice, iOS before a
// tap, a muted tab, a paused synth), the word is shown for 3 s ("Look, then spell it") and then covered, with a
// one-time hint and a small "Hear it" retry next to the message that presents the word again. The next word tries
// speech again; only after 3 failures in a row does tts count speech as off for the session (ready() → false at
// once), and a Hear it tap re-probes. An onerror 'not-allowed' (the browser wanted a tap first) shows the one-time
// hint "Tap Hear it to turn on the voice" instead. The child never waits on a silent panel.
// Speech clarity (v3.1): the word is presented like a spelling test ("The word is, <word>." → sentence →
// "<word>.", tts.present) once per presentation: in Look for a new word, else when Write opens. "Hear it" cancels
// whatever is playing and presents it again; "Say it again" says "<word>. <word>." slowly; "Syllables" (only when
// the parent gave them) says "neigh, bor." slowly. The parent's "say as" text replaces the word in all of these.
// Word sets ("Words before each race"): the caller runs several words back to back with ctx.set = {index, count}
// ("Word 1 of 2" on the chip) and ctx.keepOpen (the panel stays up after the word), beat('Next word!') between
// words, and close() after the last one. The car stays parked behind the panel the whole time.
// Resolves { word, firstTry, fixed, bonus, powerScale, nitroScale, misses } or { cancelled: true }.
import { diffAttempt, letterName, normalizeWord, patternRanges, syllableBreaks } from './words.js';
import { createKeyboard } from './keyboard.js';
import { spellBonus } from './wordStore.js';
import { VOICE_TIP } from './tts.js';

export const LOOK_MS = 4000;
export const FALLBACK_LOOK_MS = 3000;
export const NO_SPEECH_HINT = "Speech isn't available on this device, so you'll see each word first.";
export const TAP_HINT = 'Tap Hear it to turn on the voice';
// shown under the one-time no-speech hint on the spell panel only (a grown-up is usually nearby)
export const NO_SPEECH_TIP = VOICE_TIP.replace('then pick it here.', 'then pick it in Parents → Options.');
export const COMPARE_MS = 2800;          // the child's wrong attempt is gone before 3 s (R2)
export const MAX_ATTEMPT = 24;
export const POWER = { perfect: [1, 1.25], fixed: [0.65, 1], anyway: [0.65, 1] };

const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H10l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
const SPLIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="8" height="10" rx="2"/><rect x="13.5" y="7" width="8" height="10" rx="2"/></svg>';
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
  const syl = el('button', 'btn sp-syl', `${SPLIT}<span>Syllables</span>`); syl.id = 'sp-syllables';
  const msg = el('div', 'sp-msg'); msg.id = 'sp-msg';
  // small retry next to the message, shown only after this word's speech failed and the word was shown instead
  const retry = el('button', 'btn btn-sm btn-cyan sp-retry', `${SPEAKER}<span>Hear it</span>`); retry.id = 'sp-retry'; retry.hidden = true;
  retry.setAttribute('aria-label', 'Hear the word again');
  const msgRow = el('div', 'sp-msgrow'); msgRow.append(msg, retry);
  const chip = el('div', 'sp-chip'); chip.id = 'sp-chip';
  top.append(exit, hear, again, sent, syl, chip);
  const tiles = el('div', 'sp-tiles');
  tiles.append(msgRow);
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
  const isOpen = () => !!S || (!root.hidden && root.dataset.mode === 'between');   // between: a set's next word follows

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

  // what the voice needs about the current word (the parent's "say as" replaces the word when spoken)
  const speechInfo = (st, withSentence = true) => ({ word: st.word, sentence: withSentence ? st.info.sentence : null, sayAs: st.info.sayAs });
  // Safari: the first speak() must happen inside the gesture → unlock on pointerdown; a tap also re-probes speech
  // that was switched off for the session (3 failures in a row)
  const hearAgain = () => { if (!S) return; tts.reprobe(); tts.cancel(); S.hearing = tts.present(speechInfo(S)); };
  for (const b of [hear, retry]) b.addEventListener('pointerdown', () => tts.unlock());
  hear.addEventListener('click', hearAgain);
  retry.addEventListener('click', hearAgain);
  again.addEventListener('click', () => { if (S) { tts.cancel(); tts.sayAgain(speechInfo(S)); } });
  sent.addEventListener('click', () => { if (S && S.info.sentence) { tts.cancel(); tts.say(S.info.sentence); } });
  syl.addEventListener('click', () => { if (S && S.syllables) { tts.cancel(); tts.saySyllables(S.syllables); } });
  exit.addEventListener('click', () => {
    if (S) { cancel(); onCancel(); return; }
    if (beatState) { beatState.cancelled = true; beatState.wake(); close(); onCancel(); }
  });
  let beatState = null;            // the "Next word!" pause between the words of a set

  function cancel() {
    if (!S) return;
    const st = S;
    st.dead = true;
    tts.cancel();
    if (st.reject) st.reject(CANCEL);
    finishUI();
    if (st.resolve) st.resolve({ cancelled: true, word: st.word });
  }
  function finishUI(keepOpen = false) {
    if (keepOpen) {               // more words follow in this set: the panel stays up (tiles cleared, keys off)
      kb.setEnabled(false);
      root.dataset.mode = 'between';
      hideModel();
      attemptRow.replaceChildren();
      S = null;
      return;
    }
    tts.cancel();               // the panel closing stops any speech it started
    retry.hidden = true;
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
      st.presented = true;              // the full presentation plays once per word: here, not again in Write
      let ok = await tts.present(speechInfo(st)); guard(st);
      // "Hear it" tapped mid-way: let that presentation finish before the letters are spelled
      if (ok === null && st.hearing) { ok = await st.hearing; guard(st); }
      if (ok === false) { setMsg('Look, then spell it', 'cyan'); speechFailed(st); }   // the word is on screen anyway
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
    // the browser wanted a tap first (onerror 'not-allowed'): its own one-time hint
    if (tts.needsTap) {
      if (tts.tapHintShown) return;
      tts.tapHintShown = true;
      note.hidden = false;
      note.replaceChildren(document.createTextNode(TAP_HINT));
      return;
    }
    if (tts.hintShown) return;
    tts.hintShown = true;
    note.hidden = false;
    note.replaceChildren(document.createTextNode(NO_SPEECH_HINT), el('small', 'sp-tip'));
    note.lastChild.textContent = NO_SPEECH_TIP;
  }
  // this word's speech failed (or speech is off) and the word is shown instead: one-time hint + the small retry
  function speechFailed(st) {
    if (S !== st || st.dead) return;
    noSpeechHint();
    retry.hidden = !tts.available;
  }
  // speech failed while the child was waiting to hear the word: show it for 3 s, cover it, then spell (R1 holds
  // again from the moment it is covered; any letters typed meanwhile are cleared)
  async function lookInstead(st) {
    if (S !== st || st.dead || st.mode !== 'write' || st.lookedInstead) return;
    st.lookedInstead = true;
    speechFailed(st);
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
    tts.present(speechInfo(st, false));   // "The word is, <word>." … "<word>." (no sentence: keep it quick)
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
      tts.sayWord(speechInfo(st));
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
    retry.hidden = true;          // the retry belongs to one word
    // Look-Say-Cover-Write-Check for a new word. Otherwise the word is only heard: make sure speech can work
    // (API + voices within 1.5 s), else Look for 3 s first.
    let silentLook = false;
    if (st.info.look) await look(st, LOOK_MS);
    else {
      setMode('init');
      setTyping(false);
      setMsg('Get ready…', 'cyan');
      const speech = await tts.ready(); guard(st);
      if (!speech) {
        speechFailed(st); silentLook = true;
        // no voices listed (some browsers never list any, yet speak with the default voice): still try to present
        // the word while it is shown; if it starts, speech is back for the next word. Not when speech is off for
        // the session (3 failures in a row): then only a Hear it tap tries again.
        if (tts.available && !tts.gaveUp) { st.presented = true; tts.present(speechInfo(st)); }
        await look(st, FALLBACK_LOOK_MS, true);
      }
    }
    // Write (R1: no word on screen)
    setMode('write');
    hideModel();
    setMsg(st.info.look || silentLook ? 'Now spell it from memory!' : 'Listen, then spell it!', 'cyan');
    clearAttempt();
    setTyping(true);
    if (!st.info.look && !silentLook && !st.presented) {
      st.presented = true;
      tts.present(speechInfo(st)).then((ok) => { if (ok === false) lookInstead(st).catch(() => {}); });
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
     * info: { word, syllables, sentence, sayAs, pattern, isNew, look }; ctx: { coinMult, streakBefore, mission: {count,size}, upper }
     */
    run(info, ctx = {}) {
      if (S) cancel();
      tts.unlock();                 // opened from a tap: Safari's first speak() must be inside the gesture
      const word = normalizeWord(info.word);
      const st = S = {
        info, ctx, word, attempt: '', mode: 'init', typing: false, upper: !!ctx.upper, misses: 0, bonus: 0, streak: 0,
        ranges: info.pattern ? patternRanges(word, info.pattern) : [], breaks: syllableBreaks(word, info.syllables), dead: false,
        syllables: Array.isArray(info.syllables) && info.syllables.length > 1 ? info.syllables.slice() : null, presented: false,
      };
      root.hidden = false;
      root.dataset.word = '';
      sent.hidden = !info.sentence || !tts.available;
      syl.hidden = !st.syllables || !tts.available;
      hear.hidden = again.hidden = !tts.available;
      const set = ctx.set && ctx.set.count > 1 ? ctx.set : null;
      const today = ctx.mission ? `Today ${Math.min(ctx.mission.count, ctx.mission.size)} / ${ctx.mission.size}` : '';
      chip.replaceChildren();
      if (set) { const c = el('span', 'sp-set'); c.id = 'sp-set'; c.textContent = `Word ${set.index + 1} of ${set.count}`; chip.append(c); }
      if (today) { const c = el('span', 'sp-today'); c.textContent = today; chip.append(c); }
      chip.classList.toggle('two', !!(set && today));
      chip.hidden = !set && !ctx.mission;
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
          finishUI(!!ctx.keepOpen);
          resolve(out);
        }).catch((e) => {
          if (e !== CANCEL) { console.error('[spellPanel]', e); if (S === st) { finishUI(); resolve({ cancelled: true, word, error: true }); } }
        });
      });
    },
    cancel,
    /** Between two words of a set: a short message on the still-open panel. Resolves true, or false when the
     *  child left with the back button meanwhile (onCancel has run). */
    beat(text = 'Next word!', ms = 800) {
      if (S || root.hidden) return Promise.resolve(!root.hidden);
      setMsg(text, 'go');
      banner.hidden = true;
      return new Promise((resolve) => {
        const bs = beatState = { cancelled: false, wake: () => {} };
        const t = setTimeout(() => bs.wake(), ms);
        bs.wake = () => { clearTimeout(t); if (beatState === bs) beatState = null; resolve(!bs.cancelled); };
      });
    },
    /** Close the panel after the last word of a set (or when no further word could be picked). */
    close() { if (S) return; beatState = null; finishUI(); },
    letterName,
  };
}
