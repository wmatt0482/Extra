// Spelling words: parsing the parent's list, normalizing, pattern / syllable helpers, and the attempt-vs-word
// alignment used to mark differing letters (R2). Pure functions, no DOM: unit-tested in tools/spelling-tests.mjs.

export const MAX_WORDS = 40;
export const MAX_WORD_LEN = 24;
export const MAX_SENTENCE_LEN = 200;

// Curly quotes, modifier apostrophes and dash variants are folded to ' and -; case-insensitive; trimmed;
// inner whitespace collapsed to one space.
export function normalizeWord(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐-—−]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// letters, apostrophes, hyphens and single spaces; at least one letter; no leading/trailing hyphen or space
export function isValidWord(w) {
  if (!w || w.length > MAX_WORD_LEN) return false;
  if (!/^[a-z' -]+$/.test(w)) return false;
  if (!/[a-z]/.test(w)) return false;
  if (/^[- ]|[- ]$/.test(w) || /--|''/.test(w)) return false;
  return true;
}

export const sameWord = (a, b) => normalizeWord(a) === normalizeWord(b);

// Letters only (what the engine's letter rings carry).
export const ringLetters = (word) => normalizeWord(word).replace(/[^a-z]/g, '').split('');

export function normalizePattern(p) {
  const s = normalizeWord(p).replace(/[^a-z'-]/g, '');
  return /[a-z]/.test(s) ? s.slice(0, 12) : '';
}

/**
 * Parse the Words-of-the-week text area. One word per line, optional parts after ` | `:
 *   neighbor | neigh/bor | My neighbor has a dog.
 * A line without `|` may also hold several comma-separated words (pasted lists).
 * Returns { ok, words: [{word, syllables|null, sentence|null}], errors: [], warnings: [], duplicates: [] }.
 */
export function parseList(text) {
  const out = { ok: false, words: [], errors: [], warnings: [], duplicates: [] };
  const seen = new Set();
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const n = i + 1;
    const entries = line.includes('|') ? [line] : line.split(',').map((x) => x.trim()).filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split('|').map((x) => x.trim());
      const word = normalizeWord(parts[0]);
      if (!word) { out.errors.push(`Line ${n}: the word is missing before "|"`); continue; }
      if (!isValidWord(word)) {
        out.errors.push(word.length > MAX_WORD_LEN
          ? `Line ${n}: "${parts[0]}" is too long (max ${MAX_WORD_LEN} letters)`
          : `Line ${n}: "${parts[0]}" can only use letters, apostrophes ('), hyphens (-) and spaces`);
        continue;
      }
      if (seen.has(word)) { out.duplicates.push(word); continue; }
      seen.add(word);
      let syllables = null;
      const sylRaw = parts[1] || '';
      if (sylRaw) {
        const syl = sylRaw.split('/').map((x) => normalizeWord(x)).filter(Boolean);
        const flat = (s) => s.replace(/[ -]/g, '');
        if (flat(syl.join('')) === flat(word)) syllables = syl.length > 1 ? syl : null;
        else out.warnings.push(`Line ${n}: syllables "${sylRaw}" don't spell "${word}", so they were left out`);
      }
      let sentence = parts.slice(2).join(' | ').replace(/\s+/g, ' ').trim() || null;
      if (sentence && sentence.length > MAX_SENTENCE_LEN) {
        sentence = sentence.slice(0, MAX_SENTENCE_LEN);
        out.warnings.push(`Line ${n}: the sentence was shortened to ${MAX_SENTENCE_LEN} characters`);
      }
      out.words.push({ word, syllables, sentence });
    }
  });
  if (out.duplicates.length) out.warnings.push(`Removed duplicates: ${Array.from(new Set(out.duplicates)).join(', ')}`);
  if (!out.words.length && !out.errors.length) out.errors.push('Add at least one word (one per line).');
  if (out.words.length > MAX_WORDS) out.errors.push(`That is ${out.words.length} words. The limit is ${MAX_WORDS} per list.`);
  out.ok = out.errors.length === 0;
  return out;
}

// Back to text-area form (round-trips with parseList).
export function formatList(words) {
  return (words || []).map((w) => {
    const parts = [w.word];
    if (w.syllables || w.sentence) parts.push(w.syllables ? w.syllables.join('/') : '');
    if (w.sentence) parts.push(w.sentence);
    return parts.join(' | ');
  }).join('\n');
}

// Character ranges [start, end) of the pattern chunk inside the word. "-tion" prefers a match at the end,
// "un-" one at the start; otherwise every occurrence.
export function patternRanges(word, pattern) {
  const w = normalizeWord(word);
  const p = normalizePattern(pattern);
  const core = p.replace(/^-+|-+$/g, '');
  if (!core) return [];
  const all = [];
  for (let i = w.indexOf(core); i >= 0; i = w.indexOf(core, i + 1)) all.push([i, i + core.length]);
  if (!all.length) return [];
  if (p.startsWith('-') && !p.endsWith('-')) { const end = all.filter(([, e]) => e === w.length); if (end.length) return end; }
  if (p.endsWith('-') && !p.startsWith('-')) { const st = all.filter(([s]) => s === 0); if (st.length) return st; }
  return all;
}

// Indices i (into the word) where a syllable break falls just before character i.
export function syllableBreaks(word, syllables) {
  const out = new Set();
  if (!Array.isArray(syllables) || syllables.length < 2) return out;
  const w = normalizeWord(word);
  let i = 0;
  for (let s = 0; s < syllables.length - 1; s++) {
    let need = syllables[s].replace(/[ -]/g, '').length;
    while (i < w.length && need > 0) { if (!/[ -]/.test(w[i])) need--; i++; }
    while (i < w.length && /[ -]/.test(w[i])) i++;
    if (i > 0 && i < w.length) out.add(i);
  }
  return out;
}

/**
 * Align the child's attempt with the word (Levenshtein, case-insensitive) and return display cells for the
 * ATTEMPT row: every typed character in order, each `ok` or `bad`, plus `missing` gap cells where a letter of
 * the word is absent. Only the child's own letters are ever shown (R2); a gap cell is empty.
 */
export function diffAttempt(attempt, target) {
  const a = Array.from(normalizeWord(attempt));
  const t = Array.from(normalizeWord(target));
  const n = a.length, m = t.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === t[j - 1] ? 0 : 1));
    }
  }
  const cells = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === t[j - 1] ? 0 : 1)) {
      cells.push({ ch: a[i - 1], state: a[i - 1] === t[j - 1] ? 'ok' : 'bad' }); i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      cells.push({ ch: a[i - 1], state: 'bad' }); i--;               // extra letter typed
    } else {
      cells.push({ ch: '', state: 'missing' }); j--;                 // a letter of the word is missing here
    }
  }
  cells.reverse();
  return { cells, distance: d[n][m], correct: d[n][m] === 0 && n === m };
}

// Spoken name for a typed character (letters are said by name: SOS, R6).
export function letterName(ch) {
  if (ch === "'") return 'apostrophe';
  if (ch === '-') return 'hyphen';
  if (ch === ' ') return 'space';
  return String(ch).toUpperCase();
}

// The sample list ships so the game is playable before a parent adds a list (SPEC v3). Sentences make
// homophones (weather / whether) unambiguous when spoken.
export const SAMPLE_WORDS = [
  { word: 'because', syllables: ['be', 'cause'], sentence: 'I wore a coat because it was cold.' },
  { word: 'beautiful', syllables: ['beau', 'ti', 'ful'], sentence: 'The sunset was beautiful.' },
  { word: 'favorite', syllables: ['fa', 'vor', 'ite'], sentence: 'Pizza is my favorite food.' },
  { word: 'friend', syllables: null, sentence: 'My friend sits next to me at lunch.' },
  { word: 'neighbor', syllables: ['neigh', 'bor'], sentence: 'My neighbor has a dog.' },
  { word: 'enough', syllables: ['e', 'nough'], sentence: 'Do we have enough chairs?' },
  { word: 'through', syllables: null, sentence: 'The car drove through the tunnel.' },
  { word: 'thought', syllables: null, sentence: 'I thought about the question.' },
  { word: 'weather', syllables: ['weath', 'er'], sentence: 'The weather is sunny today.' },
  { word: 'whether', syllables: ['wheth', 'er'], sentence: 'I do not know whether it will rain.' },
  { word: 'library', syllables: ['li', 'brar', 'y'], sentence: 'We borrowed books from the library.' },
  { word: 'different', syllables: ['dif', 'fer', 'ent'], sentence: 'Each snowflake is different.' },
  { word: 'question', syllables: ['ques', 'tion'], sentence: 'Raise your hand to ask a question.' },
  { word: 'straight', syllables: null, sentence: 'Draw a straight line.' },
  { word: 'especially', syllables: ['es', 'pe', 'cial', 'ly'], sentence: 'I like fruit, especially apples.' },
];
