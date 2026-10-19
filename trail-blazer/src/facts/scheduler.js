// Facts scheduler (SPEC §4): Leitner boxes with expanding intervals, mastery and fluency, the same-session re-queue
// and incremental rehearsal for new facts. Ported from Spell Jump's car-jump/src/spelling/scheduler.js (same box,
// interval, mastery and re-queue semantics), keyed by the fact string. Pure functions: everything date-dependent
// takes `now` (ms), so tools/facts-tests.mjs can simulate days. No DOM, no storage.
//
// Record: { fact, box 0..3, due (ms), attempts, firstTry, quick, seenCount, lastSeen, daysCorrect: [day], daysSeen,
//           daysQuick: [day], misses, fixed, missDay (the last day it was missed), totalMs, answeredMs (correct answers
//           timed), lastMs, rehearsed }

export const DAY_MS = 86400000;
export const INTERVAL_DAYS = [0, 1, 2, 4];       // box 0 = again this session (after ≥ 2 other facts)
export const REQUEUE_GAP = 2;                     // a missed fact returns after at least 2 other facts …
export const REQUEUE_MAX = 2;                     // … at most twice per session
export const QUICK_MS = 3000;                     // a correct answer within 3 s of the fact appearing is quick
export const REHEARSAL_GAPS = [1, 2, 3];          // a new fact returns after 1, then 2, then 3 known facts
export const MAX_REHEARSING = 2;                  // at most 2 new facts in rehearsal at once
export const SPARSE_KNOWN = 3;                    // fewer known facts than this (a new player, a brand-new list): sparse mode
export const BOX_WEIGHTS = [4, 3, 2, 1];
export const STATUSES = ['New', 'Learning', 'Almost', 'Mastered', 'Fluent'];

export const intervalMs = (box) => INTERVAL_DAYS[Math.max(0, Math.min(3, box | 0))] * DAY_MS;

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newRecord(fact) {
  return { fact, box: 0, due: 0, attempts: 0, firstTry: 0, quick: 0, seenCount: 0, lastSeen: 0, daysCorrect: [], daysSeen: [], daysQuick: [], misses: 0, fixed: 0, missDay: '',
    totalMs: 0, answeredMs: 0, lastMs: 0, rehearsed: false };
}
const addDay = (list, now) => { const k = dayKey(now); if (!list.includes(k)) list.push(k); };

/**
 * One gate answer. result: { correct (first try), quick, fixed (missed, then copied right), ms (time to the answer) }.
 * Correct: the first correct answer of a day moves the fact up a box (max 3), due after that box's interval, and
 *   counts as a first-try retrieval, a correct day (and a quick day when quick ≤ 3 s). Later correct answers the same
 *   day (incremental rehearsal, free picks) are practice: timed, but no second promotion, so a box means days.
 * Missed (fixed or not): box 0, due now (the session re-queue brings it back after 2 other facts). A correct answer to
 *   that re-queue the same day leaves it in box 0, due tomorrow (SPEC §4.5 "goes to box 0 for tomorrow").
 */
export function applyAnswer(rec, result = {}, now) {
  rec.attempts += 1;
  rec.seenCount += 1;
  rec.lastSeen = now;
  addDay(rec.daysSeen, now);
  const today = dayKey(now);
  const ms = Number(result.ms) > 0 ? Math.round(result.ms) : 0;
  if (result.correct) {
    if (ms) { rec.totalMs += ms; rec.answeredMs += 1; rec.lastMs = ms; }
    if (rec.missDay === today) {
      rec.box = 0;
      rec.due = now + DAY_MS;
    } else if (!rec.daysCorrect.includes(today)) {
      rec.firstTry += 1;
      rec.box = Math.min(3, rec.box + 1);
      rec.due = now + intervalMs(rec.box);
      addDay(rec.daysCorrect, now);
      if (result.quick && (!ms || ms <= QUICK_MS)) { rec.quick += 1; addDay(rec.daysQuick, now); }
    } else if (result.quick && (!ms || ms <= QUICK_MS)) {
      rec.quick += 1;
    }
  } else {
    rec.misses += 1;
    if (result.fixed) rec.fixed += 1;
    rec.missDay = today;
    rec.box = 0;
    rec.due = now;
  }
  return rec;
}

/** Mastered = box 3 + correct on 2 different days + 3 first-try retrievals (Spell Jump's rule). */
export const isMastered = (rec) => !!rec && rec.box >= 3 && new Set(rec.daysCorrect).size >= 2 && rec.firstTry >= 3;
/** Fluent = mastered + quick (≤ 3 s) on 2 different days. */
export const isFluent = (rec) => isMastered(rec) && new Set(rec.daysQuick || []).size >= 2;
export const isNew = (rec) => !rec || rec.seenCount === 0;
export const isDue = (rec, now) => !!rec && rec.seenCount > 0 && rec.due <= now;
/** New · Learning (box 0-1) · Almost (box 2, or 3 not yet mastered) · Mastered · Fluent */
export function status(rec) {
  if (isNew(rec)) return 'New';
  if (isFluent(rec)) return 'Fluent';
  if (isMastered(rec)) return 'Mastered';
  if (rec.box <= 1) return 'Learning';
  return 'Almost';
}
export const avgMs = (rec) => (rec && rec.answeredMs ? Math.round(rec.totalMs / rec.answeredMs) : 0);

// ---------- the session (one sitting: every race until the player changes) ----------
// history: facts asked, in order · pending: missed facts waiting to come back ({ fact, at, times })
// rehearsal: new facts being rehearsed among known ones ({ fact, step, at }): back after 1, 2, then 3 known facts
//
// Sparse mode (fewer than SPARSE_KNOWN known facts in the set: a new player, or a brand-new list): there are not
// enough known facts to rehearse among, so the gaps count any other fact, every gate brings a new fact while the
// daily cap allows (no ≤ 2-in-rehearsal limit), and only a *missed* new fact goes into rehearsal (back after 1 other
// fact). A new player's first race is 4 different facts, not 10 × 3, 5 × 10, 10 × 3, 5 × 10.

/** Known = answered right at least once (box ≥ 1, or a correct day). */
export const isKnown = (rec) => !isNew(rec) && (rec.box >= 1 || (rec.daysCorrect || []).length > 0);
export const knownCount = (facts, recs) => (facts || []).filter((f) => isKnown(recs[f])).length;
export const isSparse = (facts, recs) => knownCount(facts, recs) < SPARSE_KNOWN;
export function createSession() {
  return { history: [], pending: [], rehearsal: [], requeues: {}, lastReason: null };
}
/** Record that `fact` was answered. isNewFact: it had never been seen before this answer. sparse: see above. */
export function noteAnswered(session, fact, { correct = false, isNewFact = false, sparse = false } = {}) {
  if (!session.requeues) session.requeues = {};
  session.pending = session.pending.filter((p) => p.fact !== fact);
  session.history.push(fact);
  const at = session.history.length;
  const times = session.requeues[fact] || 0;              // re-queues this session (never more than REQUEUE_MAX)
  if (!correct && times < REQUEUE_MAX) session.pending.push({ fact, at, times });
  const r = session.rehearsal.find((x) => x.fact === fact);
  if (r) {
    r.at = at;
    if (correct) { r.step += 1; if (r.step >= REHEARSAL_GAPS.length) session.rehearsal = session.rehearsal.filter((x) => x !== r); }
    else r.step = 0;                       // missed while rehearsing: start the expanding gaps again
  } else if (isNewFact && (!correct || !sparse)) {
    session.rehearsal.push({ fact, step: 0, at });
  }
}
/** Facts asked since position `at` that are "known" (not the fact itself and not a rehearsal / new fact); in sparse
 *  mode any other fact counts. */
function knownSince(session, at, fact, sparse = false) {
  const rehearsing = new Set(session.rehearsal.map((x) => x.fact));
  return session.history.slice(at).filter((f) => f !== fact && (sparse || !rehearsing.has(f))).length;
}
export const pendingReady = (session) => session.pending.filter((p) => session.history.length - p.at >= REQUEUE_GAP && (p.times || 0) < REQUEUE_MAX);
export const rehearsalReady = (session, sparse = false) => session.rehearsal.filter((r) => knownSince(session, r.at, r.fact, sparse) >= REHEARSAL_GAPS[r.step]);
export const newRehearsalSlot = (session) => session.rehearsal.length < MAX_REHEARSING;

function weightedPick(facts, recs, rand) {
  const w = facts.map((f) => BOX_WEIGHTS[Math.max(0, Math.min(3, (recs[f] && recs[f].box) || 0))]);
  const total = w.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < facts.length; i++) { x -= w[i]; if (x < 0) return facts[i]; }
  return facts[facts.length - 1];
}

/**
 * The next fact for a gate. Returns { fact, reason: 'requeue' | 'rehearsal' | 'due' | 'new' | 'free', isNew } or null.
 * active: the week's facts (any order) · recs: { fact: rec } · opts: { newLeft (new facts still allowed today),
 * rank(fact) (new facts easiest first) }
 * Order: a missed fact after 2 others (max twice) → a rehearsing new fact whose gap is done → due facts (lowest box,
 * then earliest due) → a new fact (daily cap, ≤ 2 rehearsing) → free practice weighted by box (box 0 ×4 … box 3 ×1)
 * across every family (interleaving). Never the same fact twice in a row while another exists. In sparse mode (fewer
 * than 3 known facts) the rehearsal gaps count any other fact and the ≤ 2-rehearsing limit is off.
 */
export function pickNext(active, recs, now, session, opts = {}, rand = Math.random) {
  const facts = [...new Set(active || [])];
  if (!facts.length) return null;
  const inSet = new Set(facts);
  const last = session.history[session.history.length - 1];
  session.pending = session.pending.filter((p) => inSet.has(p.fact) && (p.times || 0) < REQUEUE_MAX);
  session.rehearsal = session.rehearsal.filter((r) => inSet.has(r.fact));
  const ready = pendingReady(session).filter((p) => p.fact !== last);
  if (ready.length && session.lastReason !== 'requeue') {
    ready[0].times = (ready[0].times || 0) + 1;
    session.requeues = session.requeues || {};
    session.requeues[ready[0].fact] = ready[0].times;
    session.lastReason = 'requeue';
    return { fact: ready[0].fact, reason: 'requeue', isNew: false };
  }
  const sparse = isSparse(facts, recs);
  const reh = rehearsalReady(session, sparse).filter((r) => r.fact !== last);
  if (reh.length) { session.lastReason = 'rehearsal'; return { fact: reh[0].fact, reason: 'rehearsal', isNew: false }; }
  const busy = new Set([...session.pending.map((p) => p.fact), ...session.rehearsal.map((r) => r.fact), last].filter(Boolean));
  const pick = (fact, reason) => { session.lastReason = reason; return { fact, reason, isNew: isNew(recs[fact]) }; };
  const due = facts.filter((f) => !busy.has(f) && isDue(recs[f], now))
    .sort((a, b) => recs[a].box - recs[b].box || recs[a].due - recs[b].due);
  if (due.length) return pick(due[0], 'due');
  const newLeft = opts.newLeft == null ? Infinity : opts.newLeft;
  const fresh = facts.filter((f) => !busy.has(f) && isNew(recs[f]));
  if (fresh.length && newLeft > 0 && (sparse || newRehearsalSlot(session))) {
    // opts.rank(fact): easiest first (a little shuffled among the 3 easiest), else any new fact
    const ranked = typeof opts.rank === 'function' ? fresh.slice().sort((a, b) => opts.rank(a) - opts.rank(b)).slice(0, 3) : fresh;
    return pick(ranked[Math.floor(rand() * ranked.length) % ranked.length], 'new');
  }
  let pool = facts.filter((f) => !busy.has(f) && !isNew(recs[f]));
  // nothing else known yet: a fact being rehearsed / re-queued early, else the easiest new fact, else anything
  if (!pool.length) pool = facts.filter((f) => f !== last && busy.has(f));
  if (!pool.length) {
    const fresh2 = facts.filter((f) => f !== last && isNew(recs[f]));
    if (fresh2.length && typeof opts.rank === 'function') return pick(fresh2.slice().sort((a, b) => opts.rank(a) - opts.rank(b))[0], 'new');
    pool = fresh2;
  }
  if (!pool.length) pool = facts.filter((f) => f !== last);
  if (!pool.length) pool = facts;
  return pick(weightedPick(pool, recs, rand), 'free');
}
