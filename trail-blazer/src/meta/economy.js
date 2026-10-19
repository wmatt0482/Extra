// Economy: upgrades, stats, the track unlock chain (3rd or better opens the next track), banking a race (cash, best
// time, place, medal), and the paints / decals that racing unlocks. Pure functions over the save object (they mutate
// it and return a result); the caller persists. Tracks are passed in (the engine agent's src/data/trails.js, or the
// fallback list), so nothing here depends on ids.
import { MAX_LEVEL, UPGRADE_BY_ID, resolveStats, upgradeCost } from '../data/upgrades.js';
import { DECALS, PAINTS } from '../data/paints.js';
import { MEDAL_RANK, raceMedal } from '../data/medals.js';

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

// ---------- tracks: 3rd or better unlocks the next ----------
export const PODIUM = 3;
export const PLACE_BONUS = { 1: 500, 2: 300, 3: 150 };   // the engine pays it (summary.cash.place); shown for reference
export const trailIndex = (trails, id) => trails.findIndex((t) => t.id === id);
export const isFinished = (save, id) => (save.finished[id] || 0) > 0;
export const isCleared = (save, id) => (save.bestPlace[id] || 99) <= PODIUM;
export function isUnlocked(save, trails, id) {
  const i = trailIndex(trails, id);
  if (i < 0) return false;
  return i === 0 || isCleared(save, trails[i - 1].id);
}
export function nextTrail(trails, id) {
  const i = trailIndex(trails, id);
  return i >= 0 && i < trails.length - 1 ? trails[i + 1] : null;
}
/** Tracks with a podium (3rd or better): the progress shown on the title and the player tiles. */
export const finishedCount = (save, trails) => trails.filter((t) => isCleared(save, t.id)).length;
export const medalCount = (save, medal) => Object.values(save.medals).filter((m) => (MEDAL_RANK[m] || 0) >= MEDAL_RANK[medal]).length;
/** The track to race next: the selected one if still unlocked, else the first unlocked one without a podium. */
export function currentTrail(save, trails) {
  if (save.selectedTrail && isUnlocked(save, trails, save.selectedTrail)) return trails[trailIndex(trails, save.selectedTrail)];
  return trails.find((t) => isUnlocked(save, trails, t.id) && !isCleared(save, t.id)) || trails[0];
}

// ---------- paints + decals ----------
export function ownsPaint(save, trails, paintId) {
  const p = PAINTS.find((x) => x.id === paintId);
  if (!p) return false;
  const u = p.unlock;
  if (!u) return true;
  if (u.finish) return trails.some((t) => t.style === u.finish && isFinished(save, t.id));
  if (u.medal) {
    if (u.count === 'all') return trails.length > 0 && trails.every((t) => save.medals[t.id] === u.medal);
    return medalCount(save, u.medal) >= (u.count || 1);
  }
  return false;
}
export function ownsDecal(save, decalId) {
  const d = DECALS.find((x) => x.id === decalId);
  if (!d) return false;
  const u = d.unlock;
  if (!u) return true;
  const r = save.records;
  if (u.distance) return (r.longestRide || 0) >= u.distance;
  if (u.flips) return (r.totalFlips || 0) >= u.flips;
  if (u.wins) return (r.wins || 0) >= u.wins;
  return false;
}
export const ownedPaints = (save, trails) => PAINTS.filter((p) => ownsPaint(save, trails, p.id));
export const ownedDecals = (save) => DECALS.filter((d) => ownsDecal(save, d.id));

/** The race's cash rows (the engine's breakdown): every part as a whole dollar amount, plus a 'bonus' row for whatever
 *  the total holds beyond the parts, so the rows always add up to the total that is banked. */
export const CASH_ORDER = ['distance', 'air', 'flips', 'perfect', 'smash', 'coins', 'place', 'finish', 'gates', 'quick'];
const ALWAYS = ['distance', 'air', 'flips', 'perfect', 'coins'];
export function cashRows(cash) {
  const c = cash && typeof cash === 'object' ? cash : {};
  const rows = [];
  const keys = [...CASH_ORDER, ...Object.keys(c).filter((k) => k !== 'total' && !CASH_ORDER.includes(k))];
  for (const k of keys) {
    const v = Math.round(Number(c[k]) || 0);
    if (typeof c[k] === 'number' && (v > 0 || ALWAYS.includes(k))) rows.push({ key: k, value: Math.max(0, v) });
  }
  const sum = rows.reduce((a, r) => a + r.value, 0);
  const total = typeof c.total === 'number' ? Math.max(0, Math.round(c.total)) : sum;
  if (total > sum) rows.push({ key: 'bonus', value: total - sum });
  return { rows, total: Math.max(total, sum) };
}

/** Bank a finished race: cash, records, best distance / time / place / medal, unlocks, new paints / decals.
 *  medalTimes: { gold, silver, bronze } seconds for this track. */
export function bankRide(save, trails, trailId, summary = {}, medalTimes = null) {
  const r = save.records;
  const paintsBefore = new Set(ownedPaints(save, trails).map((p) => p.id));
  const decalsBefore = new Set(ownedDecals(save).map((d) => d.id));
  const unlockedBefore = new Set(trails.filter((t) => isUnlocked(save, trails, t.id)).map((t) => t.id));
  const { total } = cashRows(summary.cash);
  const out = {
    earned: earn(save, total), newBest: false, prevBest: save.best[trailId] || 0, firstFinish: false, unlocked: null, paints: [], decals: [],
    place: null, medal: null, newMedal: false, prevBestTime: save.bestTime[trailId] || 0, newBestTime: false,
  };
  const d = Math.max(0, Math.floor(summary.distance || 0));
  r.rides += 1;
  r.longestRide = Math.max(r.longestRide, d);
  r.totalSmashes += Math.max(0, Math.floor(summary.smashed || 0));
  r.totalFlips += Math.max(0, Math.floor(summary.flips || 0));
  r.totalCoins += Math.max(0, Math.floor(summary.coins || 0));
  r.winches += Math.max(0, Math.floor(summary.winches || 0));
  r.crashes += Math.max(0, Math.floor(summary.crashes || 0));
  r.perfectLandings += Math.max(0, Math.floor(summary.perfect || (summary.landings && summary.landings.perfect) || 0));
  r.maxSpeedKmh = Math.max(r.maxSpeedKmh, Math.round(summary.maxSpeedKmh || 0));
  r.longestAir = Math.max(r.longestAir, Math.round((summary.airTime || 0) * 10) / 10);
  if (d > out.prevBest) { save.best[trailId] = d; out.newBest = true; }
  if (summary.finishCrossed) {
    out.firstFinish = !isFinished(save, trailId);
    save.finished[trailId] = (save.finished[trailId] || 0) + 1;
    const place = Math.floor(Number(summary.place)) || null;
    if (place >= 1) {
      out.place = place;
      if (place === 1) r.wins += 1;
      if (place <= PODIUM) r.podiums += 1;
      save.bestPlace[trailId] = Math.min(save.bestPlace[trailId] || 99, place);
    }
    const t = Number(summary.timeSec);
    if (t > 0 && (!out.prevBestTime || t < out.prevBestTime)) { save.bestTime[trailId] = Math.round(t * 100) / 100; out.newBestTime = true; }
    // v1.4: 1st is gold, 2nd silver, 3rd bronze, or better when the time beats a target
    out.medal = raceMedal(place, t, medalTimes);
    if (out.medal && (MEDAL_RANK[out.medal] || 0) > (MEDAL_RANK[save.medals[trailId]] || 0)) { save.medals[trailId] = out.medal; out.newMedal = true; }
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
