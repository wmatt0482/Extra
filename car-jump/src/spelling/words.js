// Spelling words: parsing the parent's list, normalizing, pattern / syllable helpers, and the attempt-vs-word
// alignment used to mark differing letters (R2). Pure functions, no DOM: unit-tested in tools/spelling-tests.mjs.

export const MAX_WORDS = 40;
export const MAX_WORD_LEN = 24;
export const MAX_SENTENCE_LEN = 200;
export const MAX_SAY_AS_LEN = 40;

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

// "Say as" (pronunciation override, never shown to the child): same folding as a word but case is kept.
// Returns the cleaned text, '' when empty, or null when invalid (letters, apostrophes, hyphens, spaces; ≤ 40).
export function cleanSayAs(s) {
  const t = String(s == null ? '' : s).normalize('NFC').replace(/[‘’ʼ`´]/g, "'").replace(/[‐-—−]/g, '-').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length > MAX_SAY_AS_LEN || !/^[A-Za-z' -]+$/.test(t) || !/[A-Za-z]/.test(t)) return null;
  return t;
}

// Letters only (what the engine's letter rings carry).
export const ringLetters = (word) => normalizeWord(word).replace(/[^a-z]/g, '').split('');

export function normalizePattern(p) {
  const s = normalizeWord(p).replace(/[^a-z'-]/g, '');
  return /[a-z]/.test(s) ? s.slice(0, 12) : '';
}

/**
 * Parse the Words-of-the-week text area. One word per line, optional parts after ` | `:
 *   neighbor | neigh/bor | My neighbor has a dog.
 *   read | | I read a book yesterday. | red          ← 4th part: "say as" (how the voice pronounces it)
 * A line without `|` may also hold several comma-separated words (pasted lists).
 * Returns { ok, words: [{word, syllables|null, sentence|null, sayAs?}], errors: [], warnings: [], duplicates: [] }
 * (`sayAs` is present only when given).
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
      if (parts.length > 4) { out.errors.push(`Line ${n}: too many "|" parts. Use word | syllables | sentence | say as`); continue; }
      const sayAs = cleanSayAs(parts[3]);
      if (sayAs === null) {
        out.errors.push(`Line ${n}: "say as" text "${parts[3]}" can only use letters, apostrophes ('), hyphens (-) and spaces, up to ${MAX_SAY_AS_LEN} characters`);
        continue;
      }
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
      let sentence = (parts[2] || '').replace(/\s+/g, ' ').trim() || null;
      if (sentence && sentence.length > MAX_SENTENCE_LEN) {
        sentence = sentence.slice(0, MAX_SENTENCE_LEN);
        out.warnings.push(`Line ${n}: the sentence was shortened to ${MAX_SENTENCE_LEN} characters`);
      }
      const entryOut = { word, syllables, sentence };
      if (sayAs) entryOut.sayAs = sayAs;
      out.words.push(entryOut);
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
    if (w.syllables || w.sentence || w.sayAs) parts.push(w.syllables ? w.syllables.join('/') : '');
    if (w.sentence || w.sayAs) parts.push(w.sentence || '');
    if (w.sayAs) parts.push(w.sayAs);
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

// Spoken name for a typed character (letters are said by name: SOS, R6). Letter names are spelled out
// phonetically because speech engines read a bare uppercase letter as "capital B" and a bare lowercase
// "a" as the word "a".
export const LETTER_NAMES = {
  a: 'a', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'gee', h: 'aitch', i: 'eye', j: 'jay',
  k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'are', s: 'ess', t: 'tee',
  u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee',
};
export function letterName(ch) {
  if (ch === "'") return 'apostrophe';
  if (ch === '-') return 'hyphen';
  if (ch === ' ') return 'space';
  const k = String(ch).toLowerCase();
  return LETTER_NAMES[k] || k;
}

// The built-in list ships so the game is playable before a parent adds a list (SPEC v3). This is the
// week of Oct 13, 2026: long-o words (o, o_e, oa, ow). Sentences make homophones unambiguous when spoken.
export const SAMPLE_LIST_NAME = 'Week of Oct 13 (built in)';
export const SAMPLE_PATTERN = 'o';
export const SAMPLE_VERSION = 2;
export const SAMPLE_WORDS = [
  { word: 'bolt', syllables: null, sentence: 'The bolt holds the wheel on the car.' },
  { word: 'mold', syllables: null, sentence: 'There was green mold on the old bread.' },
  { word: 'shadow', syllables: ['shad', 'ow'], sentence: 'My shadow follows me on a sunny day.' },
  { word: 'flow', syllables: null, sentence: 'Water will flow down the hill.' },
  { word: 'lower', syllables: ['low', 'er'], sentence: 'Please lower the window.' },
  { word: 'blown', syllables: null, sentence: 'The leaves were blown across the yard.' },
  { word: 'quote', syllables: null, sentence: 'She read a quote from the book.' },
  { word: 'mole', syllables: null, sentence: 'A mole dug a tunnel under the garden.' },
  { word: 'stone', syllables: null, sentence: 'I skipped a stone across the pond.' },
  { word: 'stove', syllables: null, sentence: 'Dad cooked soup on the stove.' },
  { word: 'goal', syllables: null, sentence: 'He kicked the ball into the goal.' },
  { word: 'groan', syllables: null, sentence: 'I heard him groan when he stubbed his toe.' },
  { word: 'load', syllables: null, sentence: 'We will load the boxes into the truck.' },
  { word: 'roast', syllables: null, sentence: 'We will roast marshmallows at the campfire.' },
  { word: 'chose', syllables: null, sentence: 'She chose the red crayon.' },
];
