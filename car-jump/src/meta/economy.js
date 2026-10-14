// Economy: buying cars and upgrades, resolving stats, and banking a finished run.
// Pure functions over the save object (they mutate it and return a result); the caller persists.

import { CAR_BY_ID } from '../data/cars.js';
import { TRACKS, TRACK_BY_ID } from '../data/tracks.js';
import { MAX_LEVEL, UPGRADE_BY_ID, resolveStats, upgradeCost } from '../data/upgrades.js';
import { carLevels } from './save.js';

export function canAfford(save, amount) {
  return save.cash >= amount;
}

export function isOwned(save, carId) {
  return save.owned.includes(carId);
}

export function buyCar(save, carId) {
  const car = CAR_BY_ID[carId];
  if (!car) return { ok: false, reason: 'unknown car' };
  if (isOwned(save, carId)) return { ok: false, reason: 'owned' };
  if (!canAfford(save, car.price)) return { ok: false, reason: 'cash' };
  save.cash -= car.price;
  save.owned.push(carId);
  carLevels(save, carId);
  save.selectedCar = carId;
  return { ok: true, spent: car.price };
}

export function selectCar(save, carId) {
  if (!isOwned(save, carId)) return false;
  save.selectedCar = carId;
  return true;
}

// Cost of the next level, or null when maxed.
export function nextUpgradeCost(save, carId, upgradeId) {
  const car = CAR_BY_ID[carId];
  const lv = carLevels(save, carId)[upgradeId] || 0;
  if (lv >= MAX_LEVEL) return null;
  return upgradeCost(car.tier, lv);
}

export function buyUpgrade(save, carId, upgradeId) {
  if (!UPGRADE_BY_ID[upgradeId]) return { ok: false, reason: 'unknown upgrade' };
  if (!isOwned(save, carId)) return { ok: false, reason: 'not owned' };
  const cost = nextUpgradeCost(save, carId, upgradeId);
  if (cost === null) return { ok: false, reason: 'max' };
  if (!canAfford(save, cost)) return { ok: false, reason: 'cash' };
  save.cash -= cost;
  carLevels(save, carId)[upgradeId] += 1;
  return { ok: true, spent: cost, level: carLevels(save, carId)[upgradeId] };
}

export function statsFor(save, carId) {
  return resolveStats(CAR_BY_ID[carId], carLevels(save, carId));
}

export function nextTrackId(trackId) {
  const t = TRACKS.find((x) => x.unlockedBy === trackId);
  return t ? t.id : null;
}

export function isUnlocked(save, trackId) {
  return save.unlocked.includes(trackId);
}

export function earn(save, amount) {
  const a = Math.max(0, Math.round(amount || 0));
  save.cash += a;
  save.records.lifetimeCash += a;
  return a;
}

// Bank a finished run: cash, records, track unlock. `ranked` = false for the daily challenge
// (loaner car), which still pays and counts toward lifetime stats but not track bests/unlocks.
export function bankRun(save, trackId, summary, { ranked = true } = {}) {
  const r = save.records;
  const out = { earned: 0, newBest: false, prevBest: save.best[trackId] || 0, newBestScore: false, unlocked: null };
  out.earned = earn(save, summary.cash && summary.cash.total);
  r.runs += 1;
  r.totalSmashes += summary.smashed || 0;
  r.totalFlips += summary.flips || 0;
  r.maxSpeedKmh = Math.max(r.maxSpeedKmh, Math.round(summary.maxSpeedKmh || 0));
  r.longestAir = Math.max(r.longestAir, Math.round((summary.airTime || 0) * 10) / 10);
  if (summary.landing === 'perfect') r.perfectLandings += 1;
  // v2 summary fields (absent on a v1 engine: they just stay 0)
  r.bestCombo = Math.max(r.bestCombo, Math.floor(summary.bestCombo || 0));
  r.maxAltitude = Math.max(r.maxAltitude, Math.round(summary.maxAltitude || 0));
  r.rings += Math.max(0, Math.floor(summary.rings || 0));
  r.explosions += Math.max(0, Math.floor(summary.explosions || 0));
  r.rejumps += Math.max(0, Math.floor(summary.rejumps || 0));
  const score = (summary.cash && summary.cash.total) || 0;
  if (score > r.bestScore) { r.bestScore = score; out.newBestScore = true; }
  if (ranked) {
    const d = Math.floor(summary.distance || 0);
    if (d > out.prevBest) { save.best[trackId] = d; out.newBest = true; }
    if (summary.finishCrossed) {
      const next = nextTrackId(trackId);
      if (next && !save.unlocked.includes(next)) {
        // keep TRACKS order
        save.unlocked = TRACKS.map((t) => t.id).filter((id) => id === next || save.unlocked.includes(id));
        out.unlocked = next;
      }
    }
  }
  return out;
}

// Run rating (SPEC v2): cash.total / (track.finish × 4) → S ≥ 1.5, A ≥ 1.0, B ≥ 0.6, C ≥ 0.3, else D.
// The engine reports summary.rating; this is the same formula for engines that don't.
export function ratingFor(total, finish) {
  const x = (total || 0) / Math.max(1, (finish || 400) * 4);
  return x >= 1.5 ? 'S' : x >= 1.0 ? 'A' : x >= 0.6 ? 'B' : x >= 0.3 ? 'C' : 'D';
}

export function trackFinish(trackId) {
  return TRACK_BY_ID[trackId] ? TRACK_BY_ID[trackId].finish : 0;
}
