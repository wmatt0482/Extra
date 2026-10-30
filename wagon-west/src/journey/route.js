// The trail the journey runs on (SPEC §3, §9): the legs, seasons, animals, goods and nations, read from
// src/content/* (the Content stream fills them; the shapes are fixed). Every journey module looks legs up through here
// so that the unit tests and the economy sim can run a whole 12-leg journey while the content is still a skeleton:
// `useLegs(syntheticTrail())` swaps the table, `useLegs(null)` puts the real one back. The app never calls useLegs.
import { LEGS, SEASONS, SEASON_BY_ID, ANIMALS, ANIMAL_BY_ID, GOODS, GOOD_BY_ID } from '../content/legs.js';
import { NATIONS, NATION_BY_ID } from '../content/nations.js';

let table = LEGS;

/** Swap the leg table (tests and tools only); null or an empty list restores the content's LEGS. */
export function useLegs(list) { table = Array.isArray(list) && list.length ? list : LEGS; return table; }
/** The legs in trail order. */
export const legList = () => table;
/** The leg at an index (null past the end). */
export const legAt = (i) => table[i] || null;
/** The index of a leg id in the current table (-1 when unknown). */
export const legIndexOf = (id) => table.findIndex((l) => l.id === id);
/** A leg from an id or a leg object (null when unknown). Why: the API takes either, as the app holds both. */
export function legOf(x) {
  if (!x) return null;
  if (typeof x === 'object') return x;
  return table.find((l) => l.id === x) || LEGS.find((l) => l.id === x) || null;
}
/** A season from an id or a season object; the first season when unknown (a save from an older build stays playable). */
export function seasonOf(x) {
  if (x && typeof x === 'object') return x;
  return SEASON_BY_ID[x] || SEASONS[0];
}
/** The season after this one (the last season repeats: a fourth journey is another Trailblazer year). */
export function nextSeasonId(id) {
  const i = SEASONS.findIndex((s) => s.id === id);
  return SEASONS[Math.min(SEASONS.length - 1, i + 1)].id;
}
/** An animal from an id or an object; oxen when unknown. */
export function animalOf(x) {
  if (x && typeof x === 'object') return x;
  return ANIMAL_BY_ID[x] || ANIMALS[0];
}
/** A store good from an id or an object (null when unknown). */
export function goodOf(x) {
  if (x && typeof x === 'object') return x;
  return GOOD_BY_ID[x] || null;
}
/** The nation whose trading post is on this leg: the leg's `nation`, else a nation that lists the leg; null when the
 *  leg has none (then no trading-post event is planned there). */
export function nationFor(leg) {
  const l = legOf(leg);
  if (!l) return null;
  return (l.nation && NATION_BY_ID[l.nation]) || NATIONS.find((n) => Array.isArray(n.legs) && n.legs.includes(l.id)) || null;
}

// A plausible 12-leg trail for the tests and the economy sim while src/content/legs.js is a skeleton: the content's
// legs where they exist, then the rest of the route of SPEC §3 (stops, biomes and fort price levels as the Content
// stream is likely to write them, 150-200 miles each).
const SYNTH = [
  ['kansas-river', 'Kansas River', 150, 'prairie', 'river', { river: { width: 'wide' }, nation: 'kansa' }],
  ['fort-kearny', 'Fort Kearny', 170, 'prairie', 'fort', { fort: { prices: 1.2 }, nation: 'pawnee' }],
  ['chimney-rock', 'Chimney Rock', 160, 'bluffs', 'landmark', {}],
  ['fort-laramie', 'Fort Laramie', 180, 'bluffs', 'fort', { fort: { prices: 1.4 }, nation: 'lakota' }],
  ['independence-rock', 'Independence Rock', 190, 'highdesert', 'landmark', {}],
  ['south-pass', 'South Pass', 170, 'mountains', 'landmark', {}],
  ['fort-bridger', 'Fort Bridger', 180, 'mountains', 'fort', { fort: { prices: 1.6 }, nation: 'shoshone' }],
  ['soda-springs', 'Soda Springs', 160, 'highdesert', 'landmark', {}],
  ['fort-hall', 'Fort Hall', 150, 'highdesert', 'fort', { fort: { prices: 1.8 }, nation: 'bannock' }],
  ['snake-river', 'Snake River', 200, 'highdesert', 'river', { river: { width: 'wide' } }],
  ['the-dalles', 'The Dalles', 190, 'gorge', 'river', { river: { width: 'narrow' }, nation: 'chinook' }],
  ['willamette-valley', 'Willamette Valley', 170, 'valley', 'home', {}],
];
/** A 12-leg trail (or n legs, repeating the pattern): the content's real legs first, synthetic ones after. */
export function syntheticTrail(n = 12) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const real = LEGS[i];
    if (real && i < SYNTH.length) { out.push(real); continue; }
    const [id, name, miles, biome, kind, extra] = SYNTH[i % SYNTH.length];
    const sid = i < SYNTH.length ? id : `${id}-${i}`;
    out.push({ id: sid, n: i + 1, name, from: i ? out[i - 1].name : 'Independence', to: name, miles, biome,
      stop: { kind, name }, ...extra, lookout: sid, sticker: { id: sid, name, emoji: '⭐' } });
  }
  return out;
}

export { LEGS, SEASONS, ANIMALS, GOODS, NATIONS };
