// Medals per track (SPEC v1.1 §2, §5; v1.4 raceMedal): Gold / Silver / Bronze from the place (1st / 2nd / 3rd) or
// the target times, whichever is better. The engine agent's data/trails.js
// exports MEDAL_TIMES (the source); medalTimesFor() accepts { gold, silver, bronze } or [gold, silver, bronze] (seconds)
// and falls back to times from the track length when a track has none.
export const MEDALS = ['gold', 'silver', 'bronze'];
export const MEDAL_RANK = { gold: 3, silver: 2, bronze: 1 };
export const MEDAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
export const MEDAL_COLOR = { gold: '#ffd23a', silver: '#d4dde4', bronze: '#d9822b' };

export function medalTimesFor(trail, table) {
  const t = table && trail ? table[trail.id] : null;
  if (Array.isArray(t) && t.length >= 3 && t.every((x) => Number(x) > 0)) return { gold: +t[0], silver: +t[1], bronze: +t[2] };
  if (t && typeof t === 'object' && Number(t.gold) > 0 && Number(t.silver) > 0 && Number(t.bronze) > 0) return { gold: +t.gold, silver: +t.silver, bronze: +t.bronze };
  const len = (trail && trail.length) || 600;
  return { gold: Math.round(len / 21), silver: Math.round(len / 18), bronze: Math.round(len / 15) };
}

/** The medal a finished race time earns (null: slower than bronze, or no time). */
export function medalFor(timeSec, times) {
  const s = Number(timeSec);
  if (!(s > 0) || !times) return null;
  if (s <= times.gold) return 'gold';
  if (s <= times.silver) return 'silver';
  if (s <= times.bronze) return 'bronze';
  return null;
}
export const betterMedal = (a, b) => ((MEDAL_RANK[a] || 0) >= (MEDAL_RANK[b] || 0) ? a || null : b || null);
/** The medal a finishing place earns on its own: 1st gold, 2nd silver, 3rd bronze (null otherwise). */
export const placeMedal = (place) => ['', 'gold', 'silver', 'bronze'][Math.floor(Number(place)) || 0] || null;
/** The medal of a finished race: the better of the place and the time (v1.4: winning the race is always gold, a 2nd
 *  under the gold time is still gold; the target times stay as a second way to earn one). */
export const raceMedal = (place, timeSec, times) => betterMedal(placeMedal(place), medalFor(timeSec, times));

/** "1st", "2nd", "3rd", "4th" */
export const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
/** 42.37 → "0:42.3" */
export function fmtTime(sec) {
  const tenths = Math.floor(Math.max(0, Number(sec) || 0) * 10 + 1e-6);
  const m = Math.floor(tenths / 600), r = tenths - m * 600;
  return `${m}:${String(Math.floor(r / 10)).padStart(2, '0')}.${r % 10}`;
}
