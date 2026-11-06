// Every line of ONE case that the voice may say, in the order the child needs them: the briefing and the pre-taught words
// first, then the documents (every sentence, because a paragraph's listen button plays sentence by sentence), then the
// notebook (questions, the partner's hints and models, the "why" lines), the timeline lines and the closing. Prepared when a
// case starts (never the whole game: SPEC §1 voice rules). Pure.
import { LINES, checkDoc, wordSpeech } from '../logic/lines.js';
import { wordsToTeach } from '../logic/pacing.js';
import { speechChunks } from './speech.js';

export function caseVoiceTexts(kase, rank = 4) {
  const out = [];
  for (const b of kase.briefing || []) out.push(b.text);
  for (const w of wordsToTeach(rank, kase)) out.push(wordSpeech(w));
  out.push(kase.objective);
  const docs = kase.docs.slice().sort((a, b) => (a.stretch ? 1 : 0) - (b.stretch ? 1 : 0));
  for (const d of docs) for (const p of d.paragraphs) for (const s of p) out.push(s.text);
  for (const q of kase.questions) out.push(q.prompt, q.hint, q.model, q.why);
  out.push(LINES.tier2, LINES.tier3Tap, LINES.tier3Again, LINES.oneMore, LINES.checkAgain, LINES.allSet, LINES.timelineDone);
  out.push(kase.timeline.prompt);
  for (const k of new Set(kase.docs.map((d) => d.kind))) out.push(checkDoc(k));
  out.push(kase.solution.prompt, LINES.solveTier1, LINES.solveTier2, LINES.solveTier3, LINES.notThatClue, LINES.addMore, LINES.moreWords, LINES.pickClue);
  if (kase.closing) out.push(kase.closing.text);
  out.push(kase.knowledge, LINES.seeYou);
  if (kase.teaser) out.push(kase.teaser);
  return out.filter(Boolean);
}
/** The clip-sized pieces (unique, in order) for a case. */
export const caseClips = (kase, rank = 4) => speechChunks(caseVoiceTexts(kase, rank));
