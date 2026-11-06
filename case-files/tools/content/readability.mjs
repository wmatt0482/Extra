// Open readability formula (Flesch-Kincaid grade level). Sentence and word length only; it flags outliers
// and does not assign levels. Never display these scores to children.

export function countWords(text) {
  return (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length;
}

export function splitSentences(text) {
  return text.replace(/\b(Mr|Mrs|Ms|Dr|St)\./g, '$1').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function readabilityGrade(text) {
  const sentences = splitSentences(text);
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  if (!sentences.length || !words.length) return 0;
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}
