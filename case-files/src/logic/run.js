// The state of one case being worked (SPEC §4 beats 1-5), as plain JSON, and the moves that change it. Pure: the screens call
// these and draw the result; tools/logic-tests.mjs drives a whole case with them. Nothing here punishes: a wrong tap raises the
// hint tier (never a score, never a lost anything), a misplaced card goes back to the tray.
import { becauseStep, checkTap, matchSolution, proofClues } from './answers.js';
import { supportsFor, wordsToTeach } from './pacing.js';

export const BEATS = Object.freeze(['brief', 'investigate', 'pin', 'rebuild', 'solve', 'report', 'closed']);
export const MAX_TIER = 3;

/** cheap deterministic string hash (FNV-1a) and RNG (mulberry32) for the card tray */
export function hashString(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** All sentences of a case: id -> { id, doc, para, text } */
export function sentenceIndex(kase) {
  const idx = {};
  for (const d of kase.docs) d.paragraphs.forEach((p, pi) => p.forEach((s) => { idx[s.id] = { id: s.id, doc: d.id, para: pi, text: s.text }; }));
  return idx;
}
export const docOfSentence = (kase, id) => kase.docs.find((d) => d.paragraphs.some((p) => p.some((s) => s.id === id))) || null;

/** replay: a closed case played again (v0.1.3): the same moves, but nothing is paid and the first record never changes. */
export function newRun(kase, rank = 4, replay = false) {
  const slots = kase.timeline.items.map((it, i) => ((kase.timeline.given || []).includes(i) ? it.id : null));
  return {
    caseId: kase.id, rank, beat: 'brief', startedAt: 0,
    wordsDone: [], opened: [], q: 0,
    pinned: {}, board: [],                   // board = every pinned sentence id, in pin order
    firstTap: {}, hints: {}, misses: {},
    tl: { slots, tries: 0 },
    sol: { hint: 0, tries: 0, ok: false, text: '', clueId: '' },
    rep: { because: '', asked: false, clueId: '' },
    listens: {}, readAloud: {},
    ...(replay ? { replay: true } : {}),
  };
}

/**
 * The documents the child has to open before the notebook (v0.1.3): every core document, and a stretch document only when a question's
 * answer or the solution's proof is in it (then the desk says so). -> Set of doc ids
 */
export function requiredDocs(kase) {
  const need = new Set(kase.docs.filter((d) => !d.stretch).map((d) => d.id));
  const ids = [...kase.questions.flatMap((q) => q.answer || []), ...((kase.solution && kase.solution.proof) || [])];
  for (const id of ids) { const d = docOfSentence(kase, id); if (d) need.add(d.id); }
  return need;
}

export const questionOf = (run, kase) => kase.questions[run.q] || null;
export const pinnedIn = (run, qid) => run.pinned[qid] || [];

/** The child asks the partner for help on a question: the next tier (1 guiding question, 2 the paragraph, 3 the partner models it). */
export function requestHint(run, qid) {
  run.hints[qid] = Math.min(MAX_TIER, (run.hints[qid] || 0) + 1);
  return run.hints[qid];
}

/**
 * "Pin it" on a tapped sentence of the current question. The first attempt on a question is its "first tap" (the Parent Zone's
 * accuracy). A wrong one goes straight to the next hint tier. -> { ok, done, left, tier, first }
 */
export function pinTap(run, kase, sentenceId) {
  const q = questionOf(run, kase);
  if (!q) return { ok: false, done: true, left: 0, tier: 0, first: false };
  const pinned = pinnedIn(run, q.id);
  const first = !(q.id in run.firstTap);
  const r = checkTap(q, sentenceId, pinned);
  if (first) run.firstTap[q.id] = r.ok;
  if (!r.ok) {
    run.misses[q.id] = (run.misses[q.id] || 0) + 1;
    const was = run.hints[q.id] || 0;
    run.hints[q.id] = Math.min(MAX_TIER, was + 1);
    return { ...r, tier: run.hints[q.id], first, repeated: was >= MAX_TIER };
  }
  run.pinned[q.id] = [...pinned, sentenceId];
  if (!run.board.includes(sentenceId)) run.board.push(sentenceId);
  return { ...r, tier: run.hints[q.id] || 0, first };
}
/** Move on to the next question (after the "why" line). true when there was one. */
export function nextQuestion(run, kase) { if (run.q + 1 < kase.questions.length) { run.q += 1; return true; } return false; }
export const allPinned = (run, kase) => kase.questions.every((q) => pinnedIn(run, q.id).length >= (q.answer || []).length);

/** Timeline tray: the cards not yet placed, in a fixed shuffled order for this player and case (never already solved). */
export function trayOf(run, kase, seed = '') {
  const items = kase.timeline.items;
  const left = items.filter((it) => !run.tl.slots.includes(it.id)).map((it) => it.id);
  const rng = rngFrom(hashString(`${seed}|${kase.id}`));
  const order = left.slice();
  const shuffle = () => { for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } };
  shuffle();
  for (let n = 0; n < 6 && order.length > 1 && order.every((id, i) => id === left[i]); n++) shuffle();
  return order;
}
/** Put a card in a slot. Right slot: it stays. Wrong slot (or a given one): it slides back and a try is counted (no penalty). -> { ok, done, item } */
export function placeCard(run, kase, itemId, slotIndex) {
  const items = kase.timeline.items;
  const item = items.find((it) => it.id === itemId);
  if (!item || run.tl.slots.includes(itemId) || slotIndex < 0 || slotIndex >= items.length || run.tl.slots[slotIndex]) return { ok: false, done: false, item: item || null, ignored: true };
  if (items[slotIndex].id !== itemId) { run.tl.tries += 1; return { ok: false, done: false, item }; }
  run.tl.slots[slotIndex] = itemId;
  return { ok: true, done: run.tl.slots.every(Boolean), item };
}

/** The typed solution. Wrong: the next hint tier (1 look at the clues, 2 the proof sentences glow on the board, 3 the proof is shown). -> { ok, tier } */
export function submitSolution(run, kase, text) {
  run.sol.text = text;
  if (matchSolution(text, kase.solution)) { run.sol.ok = true; return { ok: true, tier: run.sol.hint }; }
  run.sol.tries += 1;
  run.sol.hint = Math.min(MAX_TIER, run.sol.hint + 1);
  return { ok: false, tier: run.sol.hint };
}
/** Attach a pinned clue to the solution: it has to be one that proves it. */
export function attachClue(run, kase, clueId) {
  if (!run.board.includes(clueId)) return false;
  if (!proofClues(kase.solution, run.board).includes(clueId)) return false;
  run.sol.clueId = clueId;
  return true;
}

/** Filing the case report. -> 'short' | 'ask' | 'needclue' | 'ok' ('ask' only once) */
export function submitReport(run, kase, because, clueId) {
  run.rep.because = because;
  if (clueId) run.rep.clueId = clueId;
  const step = becauseStep(because, kase.report && kase.report.keywords, run.rep.asked);
  if (step === 'short') return 'short';
  if (step === 'ask') { run.rep.asked = true; return 'ask'; }
  if (!run.rep.clueId || !run.board.includes(run.rep.clueId)) return 'needclue';
  return 'ok';
}

export const countListen = (run, docId) => { run.listens[docId] = (run.listens[docId] || 0) + 1; };

/** The record kept in the save when the case closes (SPEC §6). */
export function closeRecord(run, kase, who, now, day) {
  const firstTap = {}, hints = {};
  for (const q of kase.questions) { firstTap[q.id] = run.firstTap[q.id] === true; hints[q.id] = Math.min(MAX_TIER, run.hints[q.id] || 0); }
  return { day, at: now, firstTap, hints, timelineTries: run.tl.tries,
    report: { who, because: run.rep.because.trim(), clueId: run.rep.clueId }, listens: { ...run.listens } };
}
/** Write a closed case into a save. The first close of a case wins (re-reading never changes it). -> true when it was the first. */
export function applyClose(save, kase, record, rank = 4) {
  if (save.closed[kase.id]) return false;
  save.closed[kase.id] = record;
  if (!save.opened[kase.id]) save.opened[kase.id] = record.day;
  for (const w of wordsToTeach(rank, kase)) { const key = String(w.word).toLowerCase(); save.wordsMet[key] = (save.wordsMet[key] || 0) + 1; }
  return true;
}

/** A replay closed: the closed record is untouched except `replays` goes up by one. -> the new count (0 if the case was never closed) */
export function applyReplay(save, kase) {
  const rec = save.closed[kase.id];
  if (!rec) return 0;
  rec.replays = Math.min(1e6, (rec.replays || 0) + 1);
  return rec.replays;
}

/** Which standards the first taps cover: { '4R1': { right, total } } over the closed records (the Parent Zone's accuracy). */
export function accuracyByStandard(save, byId) {
  const out = {};
  for (const [id, rec] of Object.entries(save.closed || {})) {
    const k = byId[id];
    if (!k) continue;
    for (const q of k.questions) {
      if (!(q.id in rec.firstTap)) continue;
      const a = out[q.std] || (out[q.std] = { right: 0, total: 0 });
      a.total += 1; if (rec.firstTap[q.id]) a.right += 1;
    }
  }
  return out;
}
export { supportsFor };
