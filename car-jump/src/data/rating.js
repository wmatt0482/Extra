// Run rating (S/A/B/C/D), shared by the engine (summary.rating), the mock engine, and the meta fallback.
// It scores what the player did on this track, not how much the car's upgrades and cash multiplier pay, so
// a maxed Bonus upgrade can't inflate it and a crash that spins six flips can't buy an A:
//
//   reach    35 × min(1, distance / track.finish)
//   finish   +10 when the finish line was crossed
//   landing  the jump's landing (summary.landing): perfect 20, good 12, rough 4, crash 0
//   flips    6 per flip landed (flips in a flight that ended in a crash don't count), at most 3 (18)
//   combo    6 × (best multiplier − 1), best multiplier = min(4, 1 + 0.25 × (bestCombo − 1)): ×3 → 12, ×4 → 18
//   rings    3 per gold ring, at most 3 (9)
//
//   score (max 110) → S ≥ 88 · A ≥ 60 · B ≥ 40 · C ≥ 10 · D below (a crash that barely gets going)
//
// Anchors: S is a near-max run (finish crossed + perfect landing + 2 flips + a ×3 combo = 89, or the
// equivalent from more flips / a longer chain / rings); a clean run (good landing, a flip, most of the way)
// lands in B; a clean run with a combo chain and a couple of rings reaches A; a sloppy one (crash or rough
// landing, part of the way) is C.

export const RATING_THRESHOLDS = { S: 88, A: 60, B: 40, C: 10 };
const LANDING_PTS = { perfect: 20, good: 12, rough: 4, crash: 0 };

// s: a run summary (+ cleanFlips when the engine tracks it). finish: the track's finish distance (m).
export function ratingScore(s, finish) {
  const reach = 35 * Math.min(1, Math.max(0, (s.distance || 0) / Math.max(1, finish || 400)));
  const fin = s.finishCrossed ? 10 : 0;
  const landing = LANDING_PTS[s.landing] || 0;
  const clean = s.cleanFlips != null ? s.cleanFlips : s.landing === 'crash' ? 0 : s.flips || 0;
  const flips = 6 * Math.min(3, Math.max(0, clean));
  const mult = s.bestCombo >= 2 ? Math.min(4, 1 + 0.25 * (s.bestCombo - 1)) : 1;
  const combo = 6 * (mult - 1);
  const rings = 3 * Math.min(3, Math.max(0, s.rings || 0));
  return Math.round(reach + fin + landing + flips + combo + rings);
}

export function ratingLetter(score) {
  const t = RATING_THRESHOLDS;
  return score >= t.S ? 'S' : score >= t.A ? 'A' : score >= t.B ? 'B' : score >= t.C ? 'C' : 'D';
}

export function rateRun(s, finish) {
  return ratingLetter(ratingScore(s, finish));
}
