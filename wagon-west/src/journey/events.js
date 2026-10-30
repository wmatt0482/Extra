// When trail events fire (SPEC §3, §10). src/content/events.js says what each event is (text, kind, biomes); this
// module decides which ones a leg gets: one or two, seeded per leg (a replayed leg is fresh), only events whose biomes
// include the leg's (biomes null = anywhere), a trading post only where a nation trades, no hunt when the Parent Zone
// turned hunting off, and never two of the same kind in one leg (two problems in a row feel like homework; two hunts
// feel like a chore). The same rule picks the safety-net hunt or fishing hole when food runs out (economy.js RESCUE).
import { EVENTS, EVENT_BY_ID } from '../content/events.js';
import { nationFor, legOf } from './route.js';
import { EVENTS_PLAN } from './economy.js';
import { pick } from './rng.js';

/** The events that can happen on a leg: by biome, a trade only with a nation there, a hunt only when hunting is on. */
export function eligibleEvents(leg, { hunting = true } = {}) {
  const l = legOf(leg);
  if (!l) return [];
  const hasNation = !!nationFor(l);
  return EVENTS.filter((e) => (!Array.isArray(e.biomes) || e.biomes.includes(l.biome))
    && (e.kind !== 'trade' || hasNation)
    && (e.kind !== 'hunt' || hunting));
}

/** The leg's event plan: [{ id, kind, atMile, fired: false }], one or two (EVENTS_PLAN.secondChance), different kinds,
 *  the first in the first half of the leg and the second in the second half. `avoid` (mile positions of the markers)
 *  nudges an event off a marker's mile so the two do not land on the same day. */
export function planEvents(leg, rand, opts = {}, avoid = []) {
  const l = legOf(leg);
  const pool = eligibleEvents(l, opts);
  if (!l || !pool.length) return [];
  const first = pick(rand, pool);
  const out = [first];
  const rest = pool.filter((e) => e.kind !== first.kind);
  if (rest.length && rand() < EVENTS_PLAN.secondChance) out.push(pick(rand, rest));
  const spans = [EVENTS_PLAN.first, EVENTS_PLAN.second];
  return out.map((e, i) => {
    const [a, b] = spans[i];
    let at = Math.round(l.miles * (a + (b - a) * rand()));
    for (const m of avoid) if (Math.abs(at - m) < 8) at = m + 10;   // a few miles past the marker: the next day
    at = Math.max(1, Math.min(l.miles - 1, at));
    return { id: e.id, kind: e.kind, atMile: at, fired: false };
  });
}

/** The safety-net event when food runs out: a hunt (when hunting is on and allowed here) or a fishing hole or a bonus
 *  find, of a kind the leg has not had yet; any biome (a creek, a rabbit warren and wild plums are everywhere). null
 *  when every such kind was used: then the sim forages quietly instead. */
export function rescueEvent(leg, usedKinds = [], { hunting = true } = {}) {
  const l = legOf(leg);
  const kinds = [...(hunting ? ['hunt'] : []), 'fish', 'bonus'].filter((k) => !usedKinds.includes(k));
  for (const k of kinds) {
    const here = EVENTS.filter((e) => e.kind === k && (!Array.isArray(e.biomes) || (l && e.biomes.includes(l.biome))));
    const any = here.length ? here : EVENTS.filter((e) => e.kind === k);
    if (any.length) return any[0];
  }
  return null;
}

/** What tickDay hands the app for an event: the content entry (text, say, fix, kind, problem, foodLb, animal) plus the
 *  trading post's nation, whether it is the safety net, and what the sim already did (food added, a part used). */
export function eventPayload(id, leg, extra = {}) {
  const e = EVENT_BY_ID[id] || { id, kind: 'bonus' };
  const nation = e.kind === 'trade' ? nationFor(leg) : null;
  return { ...e, nation: nation ? nation.id : null, rescue: false, ...extra };
}

export { EVENTS, EVENT_BY_ID };
