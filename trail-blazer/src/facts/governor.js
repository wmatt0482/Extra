// The difficulty governor (SPEC v1.4 §11; Matt: "keep the math hardness in the level where the student is still
// learning all the time"). The gates should sit at the child's instructional level: mostly right, never all right,
// never a wall. Over the last 12 gate answers (rolling, across races; scouts and probes included):
//   ≥ 92 % right and ≥ 70 % quick → EASY: the frontier is re-tested for secure after every gate (the secure families
//     leave), 2 scouts a race, gates 50 % frontier / 25 % known / 25 % scout
//   70 – 92 % right                → TARGET: 60 % frontier / 30 % known / 10 % mastered, one scout a race
//   < 70 % right                   → HARD: the frontier narrows to one family, 50 % frontier / 50 % known, no scouts;
//     a family with ≥ 3 misses in its last 6 answers STEPS BACK: the family its strategy leans on (×8 → ×4, ×7 → ×6,
//     ×6 → ×3 …) re-enters the frontier in its place, and it returns once that family is secure again (4+ answers
//     since, all right, ≥ 75 % quick) or after a week.
// Fewer than 6 answers: on target. Re-evaluated after every gate (store.recordAnswer). Pure: no DOM, no storage.
import { famLabel, familyMembers, missCountsFor } from './facts.js';
import { DAY_MS } from './scheduler.js';

export const DIAL_WINDOW = 12;
export const DIAL_MIN = 6;
export const EASY = { right: 0.92, quick: 0.7 };
export const HARD_BELOW = 0.7;
export const STEP_BACK = { x3: 'x2', x4: 'x2', x5: 'x10', x10: 'x2', x6: 'x3', x9: 'x10', x7: 'x6', x8: 'x4', x11: 'x10', x12: 'x6', sub: 'add' };
const DIAL_HISTORY = 20;

/** One gate answer into the rolling window: [at, right, quick]. */
export function noteGate(d, right, quick, at = Date.now()) {
  d.gateLog = [...(Array.isArray(d.gateLog) ? d.gateLog : []), [at, right ? 1 : 0, right && quick ? 1 : 0]].slice(-DIAL_WINDOW);
}
/** The dial: { band: 'easy' | 'target' | 'hard', right, quick, n }. */
export function dial(d) {
  const log = (Array.isArray(d && d.gateLog) ? d.gateLog : []).slice(-DIAL_WINDOW);
  const n = log.length, right = log.filter((x) => x[1]).length, quick = log.filter((x) => x[2]).length;
  let band = 'target';
  if (n >= DIAL_MIN) {
    if (right / n < HARD_BELOW) band = 'hard';
    else if (right / n >= EASY.right && quick / n >= EASY.quick) band = 'easy';
  }
  return { band, right, quick, n };
}
export const BAND_WORDS = { target: 'on target', easy: 'a bit easy: moving up', hard: 'a bit hard: stepping back' };
/** "Right now: on target (10 of 12 right)" */
export function dialText(dl) {
  return `Right now: ${BAND_WORDS[dl.band]} (${dl.n >= DIAL_MIN ? `${dl.right} of ${dl.n} right` : 'just getting started'})`;
}
/** A finished race: keep the dial for the Report's race-by-race history. */
export function noteRaceDial(d, at = Date.now()) {
  const dl = dial(d);
  d.dialHistory = [...(Array.isArray(d.dialHistory) ? d.dialHistory : []), { at, band: dl.band, right: dl.right, n: dl.n }].slice(-DIAL_HISTORY);
}

/** How many gates of a race go to each kind, for the band: { frontier, known, scout, mastered }. */
export function raceQuota(band, gates, { scout = true } = {}) {
  const q = { frontier: 0, known: 0, scout: 0, mastered: 0 };
  if (band === 'hard') { q.known = Math.floor(gates / 2); q.frontier = gates - q.known; return q; }
  if (band === 'easy') {
    q.scout = scout ? (gates >= 4 ? 2 : 1) : 0;
    q.known = gates >= 2 ? Math.max(1, Math.round(gates * 0.25)) : 0;
    q.frontier = Math.max(1, gates - q.scout - q.known);
    if (q.frontier + q.scout + q.known > gates) q.known = Math.max(0, gates - q.frontier - q.scout);
    return q;
  }
  q.scout = gates >= 4 && scout ? 1 : 0;
  q.mastered = gates >= 4 && !scout ? 1 : 0;
  q.known = gates >= 2 ? Math.max(1, Math.round(gates * 0.3)) : 0;
  q.frontier = Math.max(1, gates - q.scout - q.mastered - q.known);
  return q;
}
/** The kind for the next gate: the biggest shortfall (frontier, known, scout, mastered on ties); the scouts are sure
 *  to happen (forced when the gates left equal the scouts still owed). */
export function nextSlot(quota, used = {}, left = 1) {
  const owed = (k) => (quota[k] || 0) - (used[k] || 0);
  if (owed('scout') > 0 && left <= owed('scout')) return 'scout';
  let best = 'frontier', most = -Infinity;
  for (const k of ['frontier', 'known', 'scout', 'mastered']) if (owed(k) > most) { most = owed(k); best = k; }
  return most > 0 ? best : 'frontier';
}

/** A family's answers, newest last: [[at, right, quick]] (a × miss only in the harder family's list). */
export function familyRecent(d, fam) {
  const out = [];
  for (const f of familyMembers(fam)) for (const x of (d.records[f] && d.records[f].recent) || []) if (x[1] || missCountsFor(f, fam)) out.push(x);
  return out.sort((a, b) => a[0] - b[0]);
}
/** ≥ 3 misses in the family's last 6 answers. */
export function drowning(d, fam) {
  const last = familyRecent(d, fam).slice(-6);
  return last.filter((x) => !x[1]).length >= 3;
}
export const stepBackTo = (fam) => (fam[0] === 'd' ? 'x' + fam.slice(1) : STEP_BACK[fam] || null);
/** Step a drowning family back: its lower neighbour takes its place until that one is secure again. */
export function stepBack(d, fam, at = Date.now()) {
  const back = stepBackTo(fam);
  if (!back) return null;
  d.stepped = d.stepped || {};
  if (!d.stepped[fam]) d.stepped[fam] = { at, back };
  return d.stepped[fam];
}
/** Release the stepped-back families whose neighbour is secure again (4+ answers since, all right, ≥ 75 % quick) or
 *  after a week. Returns the families released. */
export function releaseStepped(d, at = Date.now()) {
  const out = [];
  for (const [fam, s] of Object.entries(d.stepped || {})) {
    const since = familyRecent(d, s.back).filter((x) => x[0] >= s.at);
    const ok = since.length >= 4 && since.every((x) => x[1]) && since.filter((x) => x[2]).length >= since.length * 0.75;
    if (ok || at - s.at >= 7 * DAY_MS) { delete d.stepped[fam]; out.push(fam); }
  }
  return out;
}
export const steppedText = (d) => Object.entries(d.stepped || {}).map(([f, s]) => `${famLabel(f)} waits while ${famLabel(s.back)} gets solid`);
