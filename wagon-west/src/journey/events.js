// When trail events fire (SPEC §3, §10; v1.5 §2.9, §3.3). src/content/events.js says what each event is (text, kind, biomes); this
// module decides which ones a leg gets: one or two, seeded per leg (a replayed leg is fresh), only events whose biomes
// include the leg's (biomes null = anywhere), a trading post only where a nation trades, no hunt when the Parent Zone
// turned hunting off, and never two of the same kind in one leg (two problems in a row feel like homework; two hunts
// feel like a chore). The same rule picks the safety-net hunt or fishing hole when food runs out (economy.js RESCUE).
// v1.5: the second event's chance and the weight of breakdown and weather events are the tier's (TIER_FX); on a dry stretch no fish, hunt or berries are
// planned (a hidden spring may be: the 'spring' event, dry legs only) and the safety net is the quiet "foraged" share; the new events fire only where §2.9 puts
// them (WHERE below), and two of them are certain on their leg ('laurel-hill' on the Barlow Road, 'ice' at Ice Slough).
import { EVENTS, EVENT_BY_ID } from '../content/events.js';
import { nationFor, legOf, routeOfLeg, tierOf } from './route.js';
import { EVENTS_PLAN, TIER_FX } from './economy.js';

/** The new biomes borrow the events of the old biome they look like, when an event's `biomes` list does not name them yet. */
export const BIOME_ALIAS = { basin: 'highdesert', sierra: 'mountains', siskiyou: 'mountains', goldcountry: 'valley', sea: 'gorge' };
/** Where the v1.5 events fire (the table is authoritative over an event's `biomes`; the content's `legs` and `dry` are checked on top of it). */
export const WHERE = {
  spring: (l) => !!l.dry,
  'laurel-hill': (l) => l.id === 'barlow-road',
  ice: (l) => l.id === 'ice-slough',
  'gold-fever': (l) => routeOfLeg(l.id) === 'gold-road' && l.biome !== 'sea',
  swell: (l) => l.biome === 'sea',
};
/** The events that happen on their leg every time (the rope slide down Laurel Hill, the ice at Ice Slough). */
export const CERTAIN = ['laurel-hill', 'ice'];
/** The kind an event fires as: the hidden spring is its own kind (spirit, nothing else), Laurel Hill is 'snub' (the rope mini-game). */
export const eventKind = (e) => (e.id === 'spring' ? 'spring' : e.id === 'laurel-hill' ? 'snub' : e.kind);

const biomeOk = (e, l) => !Array.isArray(e.biomes) || e.biomes.includes(l.biome) || (BIOME_ALIAS[l.biome] ? e.biomes.includes(BIOME_ALIAS[l.biome]) : false);
const isDry = (l, opts) => (opts && opts.dry != null ? !!opts.dry : !!(l && l.dry));

/** The events that can happen on a leg: by biome, a trade only with a nation there, a hunt only when hunting is on; on a dry stretch no fish, no hunt and no
 *  berries (the spring only). */
export function eligibleEvents(leg, { hunting = true, dry } = {}) {
  const l = legOf(leg);
  if (!l) return [];
  const hasNation = !!nationFor(l);
  const parched = isDry(l, { dry });
  return EVENTS.filter((e) => {
    const kind = eventKind(e);
    if (WHERE[e.id]) { if (!WHERE[e.id](l)) return false; } else if (!biomeOk(e, l)) return false;
    if (Array.isArray(e.legs) && !e.legs.includes(l.id)) return false;          // the content's own restrictions: `legs` (only these legs) and `dry` (dry legs only)
    if (e.dry === true && !l.dry) return false;
    if (kind === 'trade' && !hasNation) return false;
    if (kind === 'hunt' && !hunting) return false;
    if (parched && (kind === 'hunt' || kind === 'fish' || (kind === 'bonus' && e.id !== 'spring'))) return false;
    return true;
  });
}

// a pick by weights (one draw): with every weight 1 it is exactly pick(rand, list)
function pickWeighted(rand, list, weight) {
  const w = list.map(weight), total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
  return list[list.length - 1];
}

/** The leg's event plan: [{ id, kind, atMile, fired: false }], one or two (the tier's secondEvent chance, else EVENTS_PLAN.secondChance), different kinds,
 *  the first in the first half of the leg and the second in the second half. `avoid` (mile positions of the markers) nudges an event off a marker's mile so the two
 *  do not land on the same day. opts: { hunting, cook, tier, dry }: the cook finds wild food twice as often; the tier weighs breakdown and weather events;
 *  a dry leg plans no fish, hunt or berries. The leg's certain event (CERTAIN) is its first. */
export function planEvents(leg, rand, opts = {}, avoid = []) {
  const l = legOf(leg);
  const pool = eligibleEvents(l, opts);
  if (!l || !pool.length) return [];
  const fx = opts.tier != null ? TIER_FX[tierOf(opts.tier)] || TIER_FX.rookie : null;
  const weight = (e) => (opts.cook && eventKind(e) === 'bonus' ? 2 : 1) * (fx && eventKind(e) === 'breakdown' ? fx.breakdownW : 1) * (fx && e.weather ? fx.weatherW : 1);
  const drawn = pickWeighted(rand, pool, weight);
  const certain = pool.find((e) => CERTAIN.includes(e.id));
  const first = certain || drawn;
  const out = [first];
  const rest = pool.filter((e) => eventKind(e) !== eventKind(first) && !CERTAIN.includes(e.id));
  const second = fx ? fx.secondEvent : EVENTS_PLAN.secondChance;
  const busy = !!(l.stop && l.stop.kind === 'fort');          // v1.5: a fort's session is already the store, the post office and the derby: one event there
  if (rest.length && !busy && rand() < second) out.push(pickWeighted(rand, rest, weight));
  const spans = [EVENTS_PLAN.first, EVENTS_PLAN.second];
  const roomy = avoid.length < 2 || Math.min(...avoid.slice(1).map((m, i) => m - avoid[i])) >= 24;
  return out.map((e, i) => {
    const [a, b] = spans[i];
    let at = Math.round(l.miles * (a + (b - a) * rand()));
    if (roomy) for (const m of avoid) if (Math.abs(at - m) < 8) at = m + 10;   // a few miles past the marker: the next day (only where the markers leave room: on a 60-110 mile leg they are 10-20 miles apart, and a due event may share a marker day)
    at = Math.max(1, Math.min(l.miles - 1, at));
    return { id: e.id, kind: eventKind(e), atMile: at, fired: false };
  });
}

/** The safety-net event when food runs out: a hunt (when hunting is on and allowed here) or a fishing hole or a bonus
 *  find, of a kind the leg has not had yet; any biome (a creek, a rabbit warren and wild plums are everywhere). null
 *  when every such kind was used: then the sim forages quietly instead; always null on a dry stretch (no fish, game or berries there). */
export function rescueEvent(leg, usedKinds = [], { hunting = true, dry } = {}) {
  const l = legOf(leg);
  if (l && isDry(l, { dry })) return null;
  const kinds = [...(hunting ? ['hunt'] : []), 'fish', 'bonus'].filter((k) => !usedKinds.includes(k));
  for (const k of kinds) {
    const here = EVENTS.filter((e) => eventKind(e) === k && !WHERE[e.id] && (!Array.isArray(e.biomes) || (l && biomeOk(e, l))));
    const any = here.length ? here : EVENTS.filter((e) => eventKind(e) === k && !WHERE[e.id]);
    if (any.length) return any[0];
  }
  return null;
}

/** What tickDay hands the app for an event: the content entry (text, say, fix, kind, problem, foodLb, animal) plus the
 *  trading post's nation, whether it is the safety net, and what the sim already did (food added, a part used). */
export function eventPayload(id, leg, extra = {}) {
  const e = EVENT_BY_ID[id] || { id, kind: 'bonus' };
  const kind = eventKind(e);
  const nation = kind === 'trade' ? nationFor(leg) : null;
  return { ...e, kind, nation: nation ? nation.id : null, rescue: false, ...extra };
}

export { EVENTS, EVENT_BY_ID };
