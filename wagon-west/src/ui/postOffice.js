// The Post Office (SPEC §3 "Letters home", §12): at every fort. The letter from the Journey stream's letters.js
// (composeLetter(J, the leg's events, the three words) → { opening, lines: [3], ps, text }) is written on a sheet of
// paper: the opening and the three narrative lines appear one by one, each read aloud; then the P.S. ("My spelling
// words this week: ___, ___ and ___.") with three blanks, and each word is dictated on Spell Jump's spell panel (main.js
// app.spellWords records it in the child's own word store); a spelled word fills its blank. The finished letter is
// read back aloud and kept in the journal (text only, the newest 36; parents read them in the Parent Zone; nothing
// is ever sent anywhere). R1 holds: a word is never on screen before it is spelled (only the blanks are).
// v1.1: the natural voice has the letter's sentences prepared before it is read (app.voiceFor: the opening, the lines,
// the P.S. with the words, the closing), and the read-back is one sentence per utterance (each one a clip).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { composeLetter } from '../journey/letters.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const PS_INTRO = 'And now the P.S. Spell each word for the letter.';
export const READ_BACK = 'Here is your letter.';

/** The P.S. split around the words, in order: ['P.S. My spelling words this week: ', 0, ', ', 1, ' and ', 2, '.']. */
export function psParts(ps, words) {
  const out = [];
  let pos = 0;
  words.forEach((w, i) => {
    const at = w ? ps.indexOf(w, pos) : -1;
    if (at < 0) return;
    if (at > pos) out.push(ps.slice(pos, at));
    out.push(i);
    pos = at + w.length;
  });
  if (pos < ps.length) out.push(ps.slice(pos));
  for (let i = 0; i < words.length; i++) if (!out.includes(i)) out.push(i ? ' · ' : ' ', i);   // a P.S. that did not name a word: blanks at the end
  return out;
}

export function createPostOffice(app) {
  const paper = $('#po-paper');
  const title = $('#po-title');
  const foot = $('#po-foot');
  const hearBtn = $('#po-hear');
  const goBtn = $('#po-go');
  let cur = null;     // { letter, words, blanks, text, done }
  let onDone = null;
  goBtn.addEventListener('click', () => { if (onDone) { const d = onDone; onDone = null; d(); } });
  hearBtn.addEventListener('click', () => { if (cur && cur.text) app.sayAll(cur.text.split('\n').map((t) => app.spoken(t))); });

  async function line(text, cls) {
    const p = h('p', { class: `po-line ${cls || ''}` }, text);
    paper.append(p);
    p.scrollIntoView({ block: 'nearest' });
    await app.sayWait(app.spoken(text), app.beat(1100));
    return p;
  }

  return {
    get letter() { return cur ? cur.letter : null; },
    get words() { return cur ? cur.words.map((w) => w.word) : []; },
    show() {},
    hide() {},
    /** Write the letter at this fort. Resolves { words: { asked, right }, text } or { cancelled }. */
    async run({ leg }) {
      onDone = null;
      app.go('post');
      app.scene.setBackdrop('post');
      title.textContent = `Post Office · ${(leg.stop && leg.stop.name) || leg.name}`;
      paper.replaceChildren();
      foot.hidden = true;
      const picks = app.pickWords(3);
      const words = picks.map((p) => p.word);
      let letter = null;
      try { letter = composeLetter(app.save.journey, app.legEvents(), words); } catch (e) { console.error('[post] composeLetter failed', e); }
      if (!letter || !Array.isArray(letter.lines)) {
        letter = { opening: 'Dear everyone back home,', lines: [`We made it to ${(leg.stop && leg.stop.name) || leg.name}.`], ps: `P.S. My spelling words this week: ${words.join(', ')}.`, text: '' };
      }
      cur = { letter, words: picks, done: false, text: '' };
      const psText = letter.ps || `P.S. My spelling words this week: ${words.join(', ')}.`;
      const signed = `${letter.close || 'Love,'} ${(app.player && app.player.name) || ''}`.trim();
      await Promise.all([app.voiceFor([letter.opening || 'Dear everyone back home,', ...letter.lines, PS_INTRO, READ_BACK, psText, signed].map((t) => app.spoken(t))), sleep(app.beat(400))]);
      await line(letter.opening || 'Dear everyone back home,', 'po-open');
      for (const l of letter.lines) { if (app.screen !== 'post') return { cancelled: true }; await line(l); }
      if (app.screen !== 'post') return { cancelled: true };
      // the P.S. with its blanks
      const ps = letter.ps || `P.S. My spelling words this week: ${words.join(', ')}.`;
      const blanks = [];
      const psEl = h('p', { class: 'po-line po-ps' }, ...psParts(ps, words).map((x) => {
        if (typeof x === 'string') return x;
        const b = h('span', { class: 'po-blank', 'data-i': String(x) }, ' ');
        blanks[x] = b;
        return b;
      }));
      paper.append(psEl);
      psEl.scrollIntoView({ block: 'nearest' });
      await app.sayWait(PS_INTRO, app.beat(900));
      const w = await app.spellWords(picks.length, {
        context: 'post', picks,
        onWord: (i, res) => { const b = blanks[i]; if (b) { b.textContent = picks[i].word; b.className = `po-blank filled ${res.firstTry ? 'first' : 'fixed'}`; } },
      });
      if (w.cancelled) return { cancelled: true, words: w };
      const name = (app.player && app.player.name) || '';
      const closeWord = letter.close || 'Love,';
      const close = h('p', { class: 'po-line po-close' }, closeWord, h('br'), name);
      paper.append(close);
      const text = [letter.opening, ...letter.lines, ps, `${closeWord} ${name}`].filter(Boolean).join('\n');
      cur.text = text;
      cur.done = true;
      app.saveLetter(text, leg, letter);
      foot.hidden = false;
      close.scrollIntoView({ block: 'nearest' });
      const tapped = new Promise((resolve) => { onDone = resolve; });
      app.sayAll([READ_BACK, ...text.split('\n').map((t) => app.spoken(t))]);
      await tapped;
      return { words: w, text };
    },
  };
}
