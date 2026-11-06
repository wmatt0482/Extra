// Pacing and rank supports for Case Files (SPEC §4). Pure: today's date comes in as a 'YYYY-MM-DD' string.
//   One new case per day. Day 1 opens Detective Training and Erie case 1. After a case is closed, the next one opens on the
//   next local day. A parent can open the next case now (save.nextEarly). Re-reading closed cases is always allowed.
import { TRAINING, ARCS } from '../content/index.js';

/** The cases in play order: Training, then each arc's cases in order. */
export const SEQUENCE = Object.freeze([TRAINING, ...ARCS.flatMap((a) => a.cases)].map((c) => c.id));

/** local calendar day 'YYYY-MM-DD' */
export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Which cases are open for this save today? Mutates save.opened (and clears save.nextEarly once used); returns the ids newly opened. */
export function refreshOpened(save, today = dayKey(), seq = SEQUENCE) {
  const out = [];
  if (!save.opened) save.opened = {};
  if (!Object.keys(save.opened).length) {
    // day 1: Training and the first case of the first arc
    for (const id of [seq[0], seq[1]]) if (id && !save.opened[id]) { save.opened[id] = today; out.push(id); }
    save.nextEarly = false;
    return out;
  }
  const next = seq.find((id) => !save.opened[id]);
  if (!next) { save.nextEarly = false; return out; }
  if (save.nextEarly) { save.opened[next] = today; save.nextEarly = false; out.push(next); return out; }
  const i = seq.indexOf(next);
  const prev = seq[i - 1];
  const prevClosed = save.closed && save.closed[prev];
  const openedToday = Object.values(save.opened).some((d) => d === today);
  if (prevClosed && prevClosed.day < today && !openedToday) { save.opened[next] = today; out.push(next); }
  return out;
}

/** What the agency home shows about tomorrow: 'tomorrow' (a case is waiting for the next day), 'open' (nothing to wait for: cases are open), 'done' (every case is open and closed). */
export function waitingState(save, seq = SEQUENCE) {
  const next = seq.find((id) => !save.opened[id]);
  const openUnclosed = seq.filter((id) => save.opened[id] && !(save.closed && save.closed[id]));
  if (openUnclosed.length) return next ? 'open' : 'open';
  if (!next) return 'done';
  return 'tomorrow';
}

/** The first open case that is not closed yet (the one the home screen points at), or null. */
export function currentCase(save, seq = SEQUENCE) {
  return seq.find((id) => save.opened[id] && !(save.closed && save.closed[id])) || null;
}

/** The next unopened case id (what the parent's "Open the next case now" opens), or null. */
export const nextUnopened = (save, seq = SEQUENCE) => seq.find((id) => !save.opened[id]) || null;

export const RANKS = Object.freeze([1, 2, 3, 4, 5, 6]);
/** The Parent Zone labels (SPEC §4, verbatim wording for the approximate level). */
export const RANK_LABELS = Object.freeze({
  1: { grade: 'grade 2 feel', fp: 'F&P K–M', lexile: 'about 420–600L' },
  2: { grade: 'grade 3 feel', fp: 'F&P N–P', lexile: 'about 520–820L' },
  3: { grade: 'grade 4 feel', fp: 'F&P P–R', lexile: 'about 740–940L' },
  4: { grade: 'grade 5 feel', fp: 'F&P S–U', lexile: 'about 830–1010L' },
  5: { grade: 'grade 6 feel', fp: 'F&P U–W', lexile: 'about 925–1070L' },
  6: { grade: 'grade 7 feel', fp: 'F&P W–Y', lexile: 'about 970–1120L' },
});
export const RANK_DISCLAIMER = 'approximate; not affiliated with or leveled by Fountas & Pinnell, Heinemann or MetaMetrics';
export function rankLabel(rank) {
  const r = RANK_LABELS[rank] || RANK_LABELS[4];
  return `Rank ${rank} · ${r.grade} · roughly comparable to ${r.fp} / ${r.lexile} (${RANK_DISCLAIMER})`;
}

/**
 * What a rank switches on (SPEC §4 Parent Zone). In v0.1 every case is written at one level; the rank sets supports:
 *   Rank 1-3: "Read it to me" on in every document, 3 pre-taught words, hint tier 1 offered after 20 s idle (no visible timer)
 *   Rank 4:   core documents silent with listen buttons, the stretch document reads aloud, 3 pre-taught words
 *   Rank 5-6: the stretch document is silent by default too, 2 pre-taught words
 */
export function supportsFor(rank) {
  const r = Math.max(1, Math.min(6, Math.floor(rank) || 4));
  return {
    rank: r,
    readAloudCore: r <= 3,
    readAloudStretch: r <= 4,
    preTeach: r >= 5 ? 2 : 3,
    idleHintMs: r <= 3 ? 20000 : 0,
  };
}
/** Is "Read it to me" switched on by default for this document at this rank? */
export const readAloudDefault = (rank, doc) => { const s = supportsFor(rank); return doc && doc.stretch ? s.readAloudStretch : s.readAloudCore; };
/** The words to pre-teach: the first `preTeach` of the case's list. */
export const wordsToTeach = (rank, kase) => (kase.words || []).slice(0, supportsFor(rank).preTeach);
