// The three cups (SPEC v1.5 §2-§3). Trails carry `cup: 'rookie' | 'pro' | 'legend'` (the engine agent's
// src/data/trails.js); without it, a trail's cup comes from its place in the list (6 per cup). Inside a cup a trail
// opens with 3rd or better on the previous one (as before); the NEXT cup opens with the cup's trophy (a championship
// weekend WON: the gold trophy; silver and bronze pay but do not open it) or enough stars (STARS_TO_OPEN in runway.js: 18 for Pro (every Rookie star), 36 for Legend, sim-tuned). Every race in a cup pays ×1 / ×2 / ×4
// (CUP_MULT in src/data/runway.js, the engine's coinMult input × it). A championship weekend: 3 races in a row on the
// cup's unlocked trails, points [10, 6, 3, 1] by place, standings between races, a podium with the trophy on top.
import { CUP_MULT, STARS_TO_OPEN, WEEKEND_BONUS } from './runway.js';

export const CUPS = [
  { id: 'rookie', name: 'Rookie Cup', short: 'Rookie', color: '#2fd36b', trophyName: 'Rookie Cup', starsToOpen: 0 },
  { id: 'pro', name: 'Pro Cup', short: 'Pro', color: '#22d3ff', trophyName: 'Pro Cup', starsToOpen: STARS_TO_OPEN.pro },
  { id: 'legend', name: 'Legend Cup', short: 'Legend', color: '#ffd23a', trophyName: 'Legend Cup', starsToOpen: STARS_TO_OPEN.legend },
];
export const CUP_BY_ID = Object.fromEntries(CUPS.map((c) => [c.id, c]));
export const POINTS = [10, 6, 3, 1];
export const WEEKEND_RACES = 3;
export const TROPHIES = ['gold', 'silver', 'bronze'];

export const cupMult = (cupId) => CUP_MULT[cupId] || 1;
/** The cup of a trail: its own `cup`, else by position (6 per cup). */
export function cupOf(trail, trails = []) {
  if (trail && CUP_BY_ID[trail.cup]) return trail.cup;
  const i = trails.findIndex((t) => t.id === (trail && trail.id));
  return CUPS[Math.max(0, Math.min(CUPS.length - 1, Math.floor(Math.max(0, i) / 6)))].id;
}
export const trailsOfCup = (cupId, trails) => trails.filter((t) => cupOf(t, trails) === cupId);
/** Points for a finishing place (1-based). */
export const pointsFor = (place) => POINTS[(place || 99) - 1] || 0;
/** The weekend's cash bonus for a trophy, × the cup multiplier. */
export const weekendBonus = (cupId, trophy) => Math.round((WEEKEND_BONUS[trophy] || 0) * cupMult(cupId));
/** The trophy for a final standing place (1-based). */
export const trophyFor = (place) => TROPHIES[place - 1] || null;
