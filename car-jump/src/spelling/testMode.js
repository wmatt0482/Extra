// Qualifier (pretest) and Friday Test: one screen each (SPEC v3 "The weekly cycle"). All words once in random
// order, audio only (the word is never shown before the answer: R1), one attempt each, immediate check. A miss
// shows the comparison for under 3 s (R2: the attempt with differing positions marked, the correct word above,
// spelled aloud letter by letter) and moves on; there is no copy step, to keep the test quick.
// run() resolves { results: [{word, correct}], cancelled } after the end card's button is pressed.
import { createKeyboard } from './keyboard.js';
import { renderTiles, COMPARE_MS } from './spellPanel.js';
import { diffAttempt, normalizeWord } from './words.js';

const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H10l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CANCEL = Symbol('cancel');

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function createTestScreen(root, { tts, audio }) {
  const head = el('div', 'topbar tm-top');
  const exit = el('button', 'btn icon-btn', BACK); exit.id = 'tm-exit'; exit.setAttribute('aria-label', 'Leave the test'); exit.dataset.sfx = '';
  const title = el('h2', '', 'Test'); title.id = 'tm-title';
  const count = el('span', 'tm-count'); count.id = 'tm-count';
  const hear = el('button', 'btn btn-cyan btn-sm tm-hear', `${SPEAKER}<span>Hear it</span>`); hear.id = 'tm-hear';
  const sent = el('button', 'btn btn-sm tm-sent', `${BUBBLE}<span>Sentence</span>`); sent.id = 'tm-sentence';
  head.append(exit, title, hear, sent, count);
  const bar = el('div', 'tm-bar', '<i></i>'); bar.id = 'tm-bar';
  const body = el('div', 'tm-body');
  const msg = el('div', 'sp-msg tm-msg'); msg.id = 'tm-msg';
  const tiles = el('div', 'sp-tiles tm-tiles');
  const model = el('div', 'sp-row sp-model'); model.id = 'tm-model'; model.hidden = true;
  const attemptRow = el('div', 'sp-row sp-attempt'); attemptRow.id = 'tm-attempt';
  tiles.append(msg, model, attemptRow);
  const kbWrap = el('div', 'sp-kb');
  body.append(tiles, kbWrap);
  const card = el('div', 'tm-card card'); card.id = 'tm-card'; card.hidden = true;
  root.replaceChildren(head, bar, body, card);

  let S = null;
  const kb = createKeyboard({ id: 'tm-keyboard', enterLabel: 'Check', onKey: typeKey, onBackspace: backspace, onEnter: check });
  kbWrap.append(kb.el);

  function draw(cells) {
    if (!cells) attemptRow.classList.remove('flash');
    if (cells) renderTiles(attemptRow, cells, { upper: S.upper });
    else renderTiles(attemptRow, S.attempt, { upper: S.upper, cursor: S.typing });
  }
  function setTyping(on) {
    S.typing = !!on;
    kb.setEnabled(!!on);
    kb.setEnterEnabled(!!on && S.attempt.trim().length > 0);
    draw();
  }
  function typeKey(ch) {
    if (!S || !S.typing || S.attempt.length >= 24) return;
    if (ch === ' ' && (!S.attempt || S.attempt.endsWith(' '))) return;
    S.attempt += ch;
    audio.letter && audio.letter();
    tts.sayLetter(ch);               // R6
    draw();
    kb.setEnterEnabled(true);
  }
  function backspace() {
    if (!S || !S.typing || !S.attempt) return;
    S.attempt = S.attempt.slice(0, -1);
    audio.letter && audio.letter(true);
    draw();
    kb.setEnterEnabled(S.attempt.trim().length > 0);
  }
  function check() {
    if (!S || !S.typing || !S.waiter) return;
    const w = S.waiter; S.waiter = null;
    setTyping(false);
    w(normalizeWord(S.attempt));
  }
  const guard = (st) => { if (S !== st || st.dead) throw CANCEL; };
  const waitCheck = () => new Promise((resolve) => { S.waiter = resolve; });

  hear.addEventListener('click', () => { if (S && S.word) tts.say(S.word); });
  sent.addEventListener('click', () => { if (S && S.sentence) tts.say(S.sentence); });
  exit.addEventListener('click', () => {
    if (!S) return;
    const st = S; st.dead = true; tts.cancel();
    end(st);
    st.resolve({ results: st.results, cancelled: true });
  });

  function end(st) {
    kb.setActive(false); kb.setEnabled(false);
    model.hidden = true; model.replaceChildren(); attemptRow.replaceChildren();
    root.removeAttribute('data-mode');
    if (S === st) S = null;
  }

  function progress(st) {
    const i = st.results.length;
    count.textContent = `${Math.min(i + 1, st.words.length)} / ${st.words.length}`;
    bar.firstChild.style.width = `${(i / st.words.length) * 100}%`;
  }

  function showCard(st, { heading, lines, button, cls = '' }) {
    return new Promise((resolve) => {
      card.className = 'tm-card card ' + cls;
      card.replaceChildren(
        el('h3', '', heading),
        ...lines.map((l) => (typeof l === 'string' ? el('p', '', l) : l)),
        (() => { const b = el('button', 'btn btn-yellow btn-big', button); b.id = 'tm-go'; b.dataset.sfx = ''; b.addEventListener('click', () => resolve(), { once: true }); return b; })(),
      );
      card.hidden = false;
      body.hidden = true;
      hear.hidden = true; sent.hidden = true;
    });
  }

  async function flow(st) {
    root.dataset.mode = 'intro';
    await showCard(st, st.intro); guard(st);
    card.hidden = true; body.hidden = false; hear.hidden = false;
    for (const w of st.words) {
      st.word = w.word; st.sentence = w.sentence || null;
      root.dataset.mode = 'ask';
      progress(st);
      sent.hidden = !st.sentence;
      msg.textContent = 'Listen, then spell it'; msg.className = 'sp-msg tm-msg cyan';
      model.hidden = true; model.replaceChildren();
      st.attempt = '';
      setTyping(true);
      tts.say(w.word);
      const a = await waitCheck(); guard(st);
      const correct = a === w.word;
      st.results.push({ word: w.word, correct });
      if (correct) {
        root.dataset.mode = 'right';
        audio.correct && audio.correct();
        msg.textContent = st.kind === 'qualifier' ? 'Yes! +$100' : 'Correct!'; msg.className = 'sp-msg tm-msg go';
        draw(Array.from(w.word).map((ch) => ({ ch, state: 'ok' })));
        attemptRow.classList.remove('flash'); void attemptRow.offsetWidth; attemptRow.classList.add('flash');
        await sleep(850); guard(st);
      } else {
        // compare only (R2): marked attempt + the word in green, spelled aloud; the attempt clears before 3 s
        root.dataset.mode = 'compare';
        audio.oops && audio.oops();
        msg.textContent = 'Here is how it goes'; msg.className = 'sp-msg tm-msg hot';
        draw(diffAttempt(a, w.word).cells);
        model.hidden = false;
        renderTiles(model, Array.from(w.word).map((ch) => ({ ch, state: 'model' })), { upper: st.upper });
        const spelled = tts.spell(w.word, (i) => { const t = model.children[i]; if (t && S === st) { for (const x of model.children) x.classList.remove('now'); t.classList.add('lit', 'now'); } });
        await sleep(COMPARE_MS); guard(st);
        attemptRow.replaceChildren();
        await Promise.race([spelled, sleep(3500)]); guard(st);
        await sleep(300); guard(st);
      }
      progress(st);
    }
    bar.firstChild.style.width = '100%';
    root.dataset.mode = 'done';
    const summary = st.summary(st.results);
    await showCard(st, summary); guard(st);
  }

  return {
    get mode() { return root.dataset.mode || null; },
    get word() { return S ? S.word : null; },
    /** opts: { kind: 'qualifier'|'friday', title, words: [{word, sentence}], upper, intro: {heading, lines, button},
     *          summary(results) → {heading, lines, button} } */
    run(opts) {
      const st = S = { ...opts, words: shuffle(opts.words), results: [], attempt: '', typing: false, dead: false };
      title.textContent = opts.title;
      root.dataset.kind = opts.kind;
      kb.setUpper(!!opts.upper);
      kb.setActive(true);
      kb.setEnabled(false);
      progress(st);
      return new Promise((resolve) => {
        st.resolve = resolve;
        flow(st).then(() => { end(st); resolve({ results: st.results, cancelled: false }); })
          .catch((e) => { if (e !== CANCEL) { console.error('[testMode]', e); end(st); resolve({ results: st.results, cancelled: true }); } });
      });
    },
  };
}
