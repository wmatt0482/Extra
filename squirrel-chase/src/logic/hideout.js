// The hideout's dictation (SPEC §4): the gang's password is a short sentence with 2 or 3 of the child's list words. It is built from the list's own
// sentences when they have them, else from a template. The voice reads it; the child types the whole sentence from memory. Capitals and
// punctuation are forgiven; every list word in the sentence is scored as a retrieval, other words are not scored. Pure: no DOM, no storage.

const TOKEN = /[a-z]+(?:['’-][a-z]+)*/g;
/** The words of a text, lowercase, curly apostrophes straightened, punctuation gone. */
export function tokens(text) { return (String(text == null ? '' : text).toLowerCase().replace(/’/g, "'").match(TOKEN) || []); }
/** A sentence as it is compared: its tokens joined by single spaces. */
export const normSentence = (text) => tokens(text).join(' ');
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const MAX_ONE = 14, MAX_TWO = 24;

/** The list words (entries { word }) that appear as whole words in a sentence, in order of appearance, no duplicates. */
export function listWordsIn(sentence, entries) {
  const set = new Set((entries || []).map((e) => (typeof e === 'string' ? e : e.word)));
  const out = [];
  for (const t of tokens(sentence)) if (set.has(t) && !out.includes(t)) out.push(t);
  return out;
}
const withStop = (s) => (/[.!?]$/.test(s) ? s : s + '.');

/** The template sentence for 2 or 3 words (grammatical for any word class). */
export function templateSentence(words) {
  const w = words.slice(0, 3);
  if (w.length <= 1) return `The secret password is ${w[0] || 'squirrel'}.`;
  if (w.length === 2) return `The secret password is ${w[0]} and ${w[1]}.`;
  return `The secret password is ${w[0]}, ${w[1]}, and ${w[2]}.`;
}

/**
 * Build the dictation. picks = the scheduler's words for it ([{ word, sentence }], 3 of them); entries = the whole active list (so a sentence that
 * happens to hold other list words counts them too). Returns { sentence, words: [the list words it holds], source: 'list' | 'joined' | 'template' }.
 */
export function buildHideout(picks, entries) {
  const withSent = (picks || []).filter((p) => p && clean(p.sentence) && tokens(p.sentence).includes(p.word));
  for (const p of withSent) {
    const s = withStop(clean(p.sentence));
    const held = listWordsIn(s, entries);
    if (tokens(s).length <= MAX_ONE && held.length >= 2 && held.length <= 3) return { sentence: s, words: held, source: 'list' };
  }
  for (let i = 0; i < withSent.length; i++) for (let j = 0; j < withSent.length; j++) {
    if (i === j) continue;
    const a = withStop(clean(withSent[i].sentence)), b = withStop(clean(withSent[j].sentence));
    const s = `${a} ${b}`, held = listWordsIn(s, entries);
    if (tokens(s).length <= MAX_TWO && held.length >= 2 && held.length <= 3) return { sentence: s, words: held, source: 'joined' };
  }
  const ws = (picks || []).map((p) => p.word).slice(0, 3);
  return { sentence: templateSentence(ws), words: ws, source: 'template' };
}

/** Score what the child typed against the sentence: one result per list word ({ word, ok }), how many were right, and whether the whole sentence matched. */
export function scoreHideout(sentence, listWords, typed) {
  const got = tokens(typed);
  const perWord = (listWords || []).map((word) => ({ word, ok: got.includes(word) }));
  return { perWord, correct: perWord.filter((x) => x.ok).length, total: perWord.length, exact: normSentence(typed) === normSentence(sentence) };
}

/** The sentence's tokens each marked ok / wrong against what was typed, to show the gentle comparison after the check (only list words can be wrong). */
export function markSentence(sentence, listWords, typed) {
  const got = new Set(tokens(typed));
  const set = new Set(listWords);
  const out = [];
  const re = /[A-Za-z]+(?:['’-][A-Za-z]+)*|[^A-Za-z]+/g;
  for (const m of String(sentence).match(re) || []) {
    const t = m.toLowerCase().replace(/’/g, "'");
    out.push({ text: m, list: set.has(t), ok: !set.has(t) || got.has(t) });
  }
  return out;
}
