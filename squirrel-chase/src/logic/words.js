// The case's words (SPEC §3): ONLY the child's current active Spell Jump list, in the scheduler's own order (focus / due words first), through
// the shared store (wordStore.js, scheduler.js) exactly as Wagon West does. Pure apart from the data handed in: nothing here reads storage.
//   pickWord()    the next list word for a sealed note: never the one just spelled, never from an archived list
//   recordWord()  bank one retrieval in the shared store: the word's record, its Leitner box and today's mission count (the 8-word daily
//                 mission is Spell Jump's: recordSpell is the same call Spell Jump makes)
import * as WS from '../../../spell-jump/src/spelling/wordStore.js';
import { noteSpelled } from '../../../spell-jump/src/spelling/scheduler.js';

const copy = (x) => JSON.parse(JSON.stringify(x));

/** The words of the active list as entries ({ word, sentence, syllables, sayAs }). */
export const activeEntries = (d) => ((WS.activeList(d) || {}).words || []).slice();
export const activeWords = (d) => activeEntries(d).map((e) => e.word);

/** What the scheduler is given: the player's options, but never the archived lists' review words (this game is the active list only). */
export const schedulerOptions = (playerOptions) => ({ ...(playerOptions || WS.DEFAULT_OPTIONS), includeReview: false });

/**
 * The next word to spell, picked without recording. `session` is the scheduler's same-session queue (a word missed earlier this session returns
 * after a gap), `last` the word spelled just before (never repeated back to back while the list has another word).
 * Returns the word's info ({ word, sentence, syllables, sayAs, pattern, isNew, look, ... }) or null for an empty list.
 */
export function pickWord(d, now, session, playerOptions, last = '', rand = Math.random) {
  const words = activeWords(d);
  if (!words.length) return null;
  const opts = schedulerOptions(playerOptions);
  const tmp = copy(session);
  let fallback = null;
  for (let i = 0; i < 12; i++) {
    const p = WS.nextWord(d, now, tmp, opts, rand);
    if (!p) break;
    noteSpelled(tmp, p.word, false);
    if (!words.includes(p.word)) continue;
    if (p.word !== last || words.length === 1) return p;
    fallback = fallback || p;
  }
  if (words.length > 1) { const w = words.find((x) => x !== last); return { word: w, ...WS.wordInfo(d, w) }; }
  return fallback || { word: words[0], ...WS.wordInfo(d, words[0]) };
}

/** Bank one retrieval (a note's word or a word in the hideout sentence). Mutates `d` and `session`; the caller writes the store. */
export function recordWord(d, word, firstTry, now, session) {
  return WS.recordSpell(d, word, { firstTry: !!firstTry }, now, session);
}

/** Up to n different words for the hideout sentence: the scheduler's picks, none of `avoid` (the words of this case's notes) while the list has others. */
export function pickMany(d, now, session, playerOptions, n, avoid = [], rand = Math.random) {
  const words = activeWords(d);
  const out = [];
  const tmp = copy(session);
  const skip = new Set(avoid);
  for (let i = 0; i < n * 8 && out.length < n; i++) {
    const p = pickWord(d, now, tmp, playerOptions, out.length ? out[out.length - 1].word : '', rand);
    if (!p) break;
    noteSpelled(tmp, p.word, false);
    if (out.some((x) => x.word === p.word)) continue;
    if (skip.has(p.word) && words.filter((w) => !skip.has(w)).length > out.length) continue;
    out.push(p);
  }
  for (const w of words) { if (out.length >= n) break; if (!out.some((x) => x.word === w)) out.push({ word: w, ...WS.wordInfo(d, w) }); }
  return out.slice(0, n);
}
