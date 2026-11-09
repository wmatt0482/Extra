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

const DET = '(?:a|an|the|my|your|our|their|his|her|this|that)';
const AFTER = new Set(['is', 'was', 'are', 'were', 'in', 'on', 'at', 'of', 'and', 'to', 'with', 'for', 'by', 'from', 'near', 'under', 'over', 'that', 'has', 'had', 'can', 'will', 'would', 'could', 'did', 'does', 'looks', 'looked', 'ran', 'sat', 'fell', 'got', 'made', 'came', 'went', 'but', 'or', 'as', 'when', 'while', 'because', 'so', 'too']);
/** Is the word a noun in the way its own list sentence uses it? True only when it sits right after a/an/the/my... and the sentence ends or goes on with a small word (not "the beautiful sky"). */
export function usedAsNoun(word, sentence) {
  const w = String(word || '').toLowerCase();
  if (!w || !sentence) return false;
  const t = tokens(sentence);
  for (let i = 1; i < t.length; i++) {
    if (t[i] !== w || !new RegExp(`^${DET}$`).test(t[i - 1])) continue;
    if (i === t.length - 1 || AFTER.has(t[i + 1])) return true;
  }
  return false;
}
const hashStr = (str) => { let h = 7; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

/** A template filled with the picks: 'noun' slots only with words used as nouns in their own sentences, 'any' slots with any pick. Null when none fits. */
export function fillTemplate(picks, templates) {
  const list = (picks || []).filter((p) => p && p.word);
  if (list.length < 2) return null;
  const nouns = list.filter((p) => usedAsNoun(p.word, p.sentence));
  const seed = hashStr(list.map((p) => p.word).join('|'));
  const ok = (templates || []).filter((t) => t && t.text && Array.isArray(t.slots) && t.slots.length >= 2 && t.slots.length <= list.length
    && t.slots.filter((k) => k === 'noun').length <= nouns.length && (t.text.match(/\{w\}/g) || []).length === t.slots.length);
  if (!ok.length) return null;
  const t = ok[seed % ok.length];
  const nounPool = nouns.slice(), anyPool = list.filter((p) => !nounPool.includes(p));
  const used = [];
  const chosen = t.slots.map((k) => {
    // a noun slot takes a noun; an 'any' slot prefers a non-noun so the nouns stay free for the noun slots
    const pool = k === 'noun' ? nounPool : (anyPool.length ? anyPool : nounPool);
    return pool.shift();
  });
  if (chosen.some((c) => !c)) return null;
  chosen.forEach((c) => used.push(c.word));
  let n = 0;
  return { sentence: t.text.replace(/\{w\}/g, () => used[n++]), words: used, source: 'template', template: t.id };
}

/**
 * Build the dictation. picks = the scheduler's words for it ([{ word, sentence }], 3 of them); entries = the whole active list (so a sentence that
 * happens to hold other list words counts them too); templates = the content's HIDEOUT_TEMPLATES. Returns { sentence, words: [the list words it holds],
 * source: 'list' | 'joined' | 'template' }.
 */
export function buildHideout(picks, entries, templates = []) {
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
  const filled = fillTemplate(picks, templates);
  if (filled) {
    const held = listWordsIn(filled.sentence, entries);          // a list word that sits in the template's own text counts too
    return { sentence: filled.sentence, words: [...new Set([...filled.words, ...held])], source: 'template', template: filled.template };
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
