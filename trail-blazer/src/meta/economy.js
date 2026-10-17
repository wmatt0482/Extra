// Economy: upgrades, stats, the trail unlock chain, banking a finished ride, and the paints / decals the ride
// progress unlocks. Pure functions over the save object (they mutate it and return a result); the caller persists.
// Trails are passed in (the engine agent's src/data/trails.js, or the fallback list) so nothing here depends on ids.
import { MAX_LEVEL, UPGRADE_BY_ID, resolveStats, upgradeCost } from '../data/upgrades.js';
import { DECALS, PAINTS } from '../data/paints.js';

export const canAfford = (save, amount) => save.cash >= amount;

/** Cost of the next level of an upgrade, or null when maxed. */
export function nextUpgradeCost(save, upgradeId) {
  const lv = save.levels[upgradeId] || 0;
  return lv >= MAX_LEVEL ? null : upgradeCost(lv);
}

export function buyUpgrade(save, upgradeId) {
  if (!UPGRADE_BY_ID[upgradeId]) return { ok: false, reason: 'unknown upgrade' };
  const cost = nextUpgradeCost(save, upgradeId);
  if (cost === null) return { ok: false, reason: 'max' };
  if (!canAfford(save, cost)) return { ok: false, reason: 'cash' };
  save.cash -= cost;
  save.levels[upgradeId] = (save.levels[upgradeId] || 0) + 1;
  return { ok: true, spent: cost, level: save.levels[upgradeId] };
}

export const statsFor = (save) => resolveStats(save.levels);

export function earn(save, amount) {
  const a = Math.max(0, Math.round(amount || 0));
  save.cash += a;
  save.records.lifetimeCash += a;
  return a;
}

// ---------- trails: finish one to unlock the next ----------
export const trailIndex = (trails, id) => trails.findIndex((t) => t.id === id);
export const isFinished = (save, id) => (save.finished[id] || 0) > 0;
export function isUnlocked(save, trails, id) {
  const i = trailIndex(trails, id);
  if (i < 0) return false;
  return i === 0 || isFinished(save, trails[i - 1].id);
}
export function nextTrail(trails, id) {
  const i = trailIndex(trails, id);
  return i >= 0 && i < trails.length - 1 ? trails[i + 1] : null;
}
export const finishedCount = (save, trails) => trails.filter((t) => isFinished(save, t.id)).length;
/** The trail to ride next: the selected one if still unlocked, else the first unlocked one not finished yet. */
export function currentTrail(save, trails) {
  if (save.selectedTrail && isUnlocked(save, trails, save.selectedTrail)) return trails[trailIndex(trails, save.selectedTrail)];
  return trails.find((t) => isUnlocked(save, trails, t.id) && !isFinished(save, t.id)) || trails[0];
}

// ---------- paints + decals ----------
export function ownsPaint(save, trails, paintId) {
  const p = PAINTS.find((x) => x.id === paintId);
  if (!p) return false;
  if (!p.style) return true;
  return trails.some((t) => t.style === p.style && isFinished(save, t.id));
}
export function ownsDecal(save, decalId) {
  const d = DECALS.find((x) => x.id === decalId);
  return !!d && (save.records.longestRide || 0) >= d.distance;
}
export const ownedPaints = (save, trails) => PAINTS.filter((p) => ownsPaint(save, trails, p.id));
export const ownedDecals = (save) => DECALS.filter((d) => ownsDecal(save, d.id));

/** The ride's cash rows (the engine's breakdown): every part as a whole dollar amount, plus a 'bonus' row for whatever
 *  the total holds beyond the parts, so the rows always add up to the total that is banked. */
export const CASH_ORDER = ['distance', 'air', 'smash', 'coins', 'gates', 'quick', 'finish'];
export function cashRows(cash) {
  const c = cash && typeof cash === 'object' ? cash : {};
  const rows = [];
  const keys = [...CASH_ORDER, ...Object.keys(c).filter((k) => k !== 'total' && !CASH_ORDER.includes(k))];
  for (const k of keys) {
    const v = Math.round(Number(c[k]) || 0);
    if (typeof c[k] === 'number' && (v > 0 || ['distance', 'air', 'smash', 'coins'].includes(k))) rows.push({ key: k, value: Math.max(0, v) });
  }
  const sum = rows.reduce((a, r) => a + r.value, 0);
  const total = typeof c.total === 'number' ? Math.max(0, Math.round(c.total)) : sum;
  if (total > sum) rows.push({ key: 'bonus', value: total - sum });
  return { rows, total: Math.max(total, sum) };
}

/** Bank a finished ride: cash, records, best distance, finish (unlocks), new paints / decals. */
export function bankRide(save, trails, trailId, summary = {}) {
  const r = save.records;
  const paintsBefore = new Set(ownedPaints(save, trails).map((p) => p.id));
  const decalsBefore = new Set(ownedDecals(save).map((d) => d.id));
  const unlockedBefore = new Set(trails.filter((t) => isUnlocked(save, trails, t.id)).map((t) => t.id));
  const { total } = cashRows(summary.cash);
  const out = { earned: earn(save, total), newBest: false, prevBest: save.best[trailId] || 0, firstFinish: false, unlocked: null, paints: [], decals: [] };
  const d = Math.max(0, Math.floor(summary.distance || 0));
  r.rides += 1;
  r.longestRide = Math.max(r.longestRide, d);
  r.totalSmashes += Math.max(0, Math.floor(summary.smashed || 0));
  r.totalFlips += Math.max(0, Math.floor(summary.flips || 0));
  r.totalCoins += Math.max(0, Math.floor(summary.coins || 0));
  r.winches += Math.max(0, Math.floor(summary.winches || 0));
  r.maxSpeedKmh = Math.max(r.maxSpeedKmh, Math.round(summary.maxSpeedKmh || 0));
  r.longestAir = Math.max(r.longestAir, Math.round((summary.airTime || 0) * 10) / 10);
  if (d > out.prevBest) { save.best[trailId] = d; out.newBest = true; }
  if (summary.finishCrossed) {
    out.firstFinish = !isFinished(save, trailId);
    save.finished[trailId] = (save.finished[trailId] || 0) + 1;
  }
  const nt = trails.find((t) => !unlockedBefore.has(t.id) && isUnlocked(save, trails, t.id));
  out.unlocked = nt ? nt.id : null;
  out.paints = ownedPaints(save, trails).filter((p) => !paintsBefore.has(p.id));
  out.decals = ownedDecals(save).filter((x) => !decalsBefore.has(x.id));
  return out;
}

/** A stable 32-bit hash (FNV-1a) for per-trail seeds, so a trail's layout can be learned. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Rating for an engine whose summary has none: how far along the trail, a finish, landings and stunts. */
export function ratingFor(summary = {}, length = 600) {
  const reach = Math.min(1, (summary.distance || 0) / Math.max(1, length));
  const score = Math.round(reach * 60 + (summary.finishCrossed ? 20 : 0) + Math.min(15, (summary.flips || 0) * 5) + Math.min(10, (summary.airTime || 0) * 2) - Math.min(10, (summary.winches || 0) * 3));
  return { rating: score >= 88 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 25 ? 'C' : 'D', ratingScore: score };
}
