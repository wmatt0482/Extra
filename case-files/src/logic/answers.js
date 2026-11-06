// Answer matching for Case Files (SPEC §4 beat 5 and §5). Pure: no DOM, no storage.
//   matchSolution(input, solution)   the typed solution: case-insensitive, ignores "the", accepts the listed variants,
//                                    edit distance <= 2 for names (shorter names get less slack so "Tim" is not "Tom").
//   becauseStep(text, keywords, asked)  the "because ___" blank of the case report: >= 3 words; none of the case's report
//                                    keywords -> the partner asks once, then takes whatever comes next.
//   checkTap(question, tapped, pinned)  one "Pin it" on a sentence of a question's proof set.

/** lower case, letters and digits only, "the" dropped, single spaces */
export function norm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[‘’]/g, "'").replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').filter((w) => w && w !== 'the').join(' ');
}

/** Levenshtein distance */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a name of this length forgives: 0 up to 3 letters, 1 up to 6, then 2. */
export const slack = (len) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** Does the typed text match one of the solution's accepted answers? */
export function matchSolution(input, solution) {
  const typed = norm(input);
  if (!typed) return false;
  const answers = ((solution && solution.answers) || []).map(norm).filter(Boolean);
  for (const a of answers) {
    if (typed === a) return true;
    if (editDistance(typed, a) <= Math.min(slack(a.length), slack(typed.length))) return true;
  }
  // a short sentence that holds a whole accepted answer ("it was tom fisk", "tom fisk has it")
  const words = typed.split(' ');
  if (words.length > 1 && words.length <= 5) {
    for (const a of answers) {
      const aw = a.split(' ');
      for (let i = 0; i + aw.length <= words.length; i++) {
        if (aw.every((w, k) => words[i + k] === w || (w.length > 3 && editDistance(words[i + k], w) <= 1))) return true;
      }
    }
  }
  return false;
}

export const wordCount = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;
export const MIN_BECAUSE_WORDS = 3;

/** 'short' (fewer than 3 words) | 'ask' (no report keyword yet: the partner asks once) | 'ok'. */
export function becauseStep(text, keywords = [], asked = false) {
  if (wordCount(text) < MIN_BECAUSE_WORDS) return 'short';
  const t = norm(text);
  const has = (keywords || []).some((k) => { const n = norm(k); return n && t.includes(n.length > 4 ? n.slice(0, n.length - 1) : n); });
  if (has || asked) return 'ok';
  return 'ask';
}

/**
 * One "Pin it" on `tapped`. question.answer = the sentence ids of the proof set; `pinned` = ids of this question already pinned.
 * -> { ok, done, left }: ok = the sentence is in the proof set (and new), done = the whole set is pinned, left = how many to go.
 */
export function checkTap(question, tapped, pinned = []) {
  const set = question.answer || [];
  if (!set.includes(tapped) || pinned.includes(tapped)) return { ok: false, done: false, left: set.filter((id) => !pinned.includes(id)).length };
  const now = [...pinned, tapped];
  const left = set.filter((id) => !now.includes(id)).length;
  return { ok: true, done: left === 0, left };
}

/** The pinned clue ids that count as proof of the solution; if none of the pinned ones is in the proof set (a content gap), any pinned clue. */
export function proofClues(solution, pinned = []) {
  const set = (solution && solution.proof) || [];
  const hit = pinned.filter((id) => set.includes(id));
  return hit.length ? hit : pinned.slice();
}

/** "tom fisk" -> "Tom Fisk" (what the child sees while typing on the in-game keyboard) */
export const display = (s) => String(s || '').replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
