// Trail moments and trail facts (SPEC v1.4 §1.4, §1.6, §3.5): the dust devil that sends the hats flying, the skipping stones at the rivers,
// the falling stars on an arrival evening, and the ambient history (a far-off sound, a grizzly on the ridge) with its card. All pure fun:
// nothing here asks a question or can be failed. Pure functions over the journey object J: no DOM, no clock, no storage, no Math.random.
import { TRAIL_FACTS, TRAIL_FACT_BY_ID } from '../content/trailFacts.js';
import { WISHES } from '../content/finds.js';
import { WATER_NAMES, RIVER_STOPS } from '../content/fish.js';
import { legOf, legList } from './route.js';
import { MOMENTS } from './economy.js';
import { hashSeed, mulberry32 } from './rng.js';
import { fill14 } from './collections.js';
import { waterOf } from './fishing.js';

// the last leg runs as the Columbia raft (no trail days, no camp): none of the trail moments are planned on it
const isLastLeg = (l) => !!l && legList().length > 0 && legList()[legList().length - 1].id === l.id;
const happen = (J, k) => { const t = J.trip; if (t && Array.isArray(t.happened) && !t.happened.includes(k)) t.happened.push(k); };

/** The Parent Zone's "Far-off sounds on the trail" switch (J.opts.farSounds, default on): off, and the facts with `far: true` are never planned. */
export function setTrailSounds(J, on) { fill14(J); J.opts.farSounds = on !== false; return J.opts.farSounds; }

/** The trail facts this leg can have: when 'day' | 'night', the leg among its `legs` (null = any), not heard yet this season, and allowed by
 *  the far-off sounds switch. Ids, in the content's order. */
export function factsFor(J, leg) {
  fill14(J);
  const l = legOf(leg || J.legId);
  if (!l) return [];
  return TRAIL_FACTS.filter((f) => (f.when === 'day' || f.when === 'night') && (!Array.isArray(f.legs) || f.legs.includes(l.id))
    && !J.factsHeard.includes(f.id) && !(f.far && J.opts.farSounds === false)).map((f) => f.id);
}

/** The leg's trail fact (at most one a leg): MOMENTS.facts.chance of the legs that have one left, the first of factsFor in the content's order,
 *  at a mile between MOMENTS.facts.from and .to of the leg → { id, atMile, fired: false } | null. */
export function planFact(J, leg, rand) {
  const l = legOf(leg);
  if (!J || !l || isLastLeg(l)) return null;
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, l.id, J.legStarts, 'fact-plan'));
  const list = factsFor(J, l);
  const hit = r() < MOMENTS.facts.chance, u = r();
  if (!hit || !list.length) return null;
  const { from, to } = MOMENTS.facts;
  return { id: list[0], atMile: Math.round(l.miles * (from + (to - from) * u)), fired: false };
}

/** The fact was shown (the app calls it when the card appears): J.factsHeard (this season), totals.factsHeard; { card, first } — the card id for
 *  the app (awardCard pays a duplicate's token as usual) and whether it is new this season. null for an unknown id. */
export function heardFact(J, id) {
  fill14(J);
  const f = TRAIL_FACT_BY_ID[id];
  if (!f) return null;
  const first = !J.factsHeard.includes(f.id);
  if (first) { J.factsHeard.push(f.id); J.totals.factsHeard++; }
  happen(J, f.id);
  return { card: f.card || f.id, first };
}

/** The stampede's fact: 'bison-thunder' while it has not been heard this season (stampedePay hands it to the app), else null. */
export function stampedeFact(J) {
  fill14(J);
  const f = TRAIL_FACTS.find((x) => x.when === 'stampede');
  return f && !J.factsHeard.includes(f.id) ? f.id : null;
}

/** The leg's dust devil: a swirling column of dust crosses the trail and the hats fly. MOMENTS.dustDevil.chance of the prairie, bluffs and high
 *  desert legs, never the leg right after one (gapLegs), at a mile between .from and .to of the leg → { atMile, fired: false } | null. */
export function planDustDevil(J, leg, rand) {
  fill14(J);
  const l = legOf(leg);
  if (!J || !l || isLastLeg(l)) return null;
  const D = MOMENTS.dustDevil;
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, l.id, J.legStarts, 'dust-plan'));
  const hit = r() < D.chance, u = r();
  if (!hit || !D.biomes.includes(l.biome)) return null;
  const idx = legList().findIndex((x) => x.id === l.id);
  if (idx - J.moments.dustDevilLeg <= D.gapLegs) return null;
  return { atMile: Math.round(l.miles * (D.from + (D.to - D.from) * u)), fired: false };
}
/** The hats are caught: all of them (of ≥ 1) is "What a hat trick!" and a trade token. → { all, tokens }. */
export function dustDevilResult(J, { caught = 0, of = 0 } = {}) {
  fill14(J);
  const c = Math.max(0, caught | 0), n = Math.max(0, of | 0);
  const all = n >= 1 && c >= n;
  const tokens = all ? MOMENTS.dustDevil.tokenAll : 0;
  J.tokens = (J.tokens | 0) + tokens;
  J.totals.hatsCaught += c; if (all) J.totals.hatsAll++;
  J.moments.dustDevilLeg = J.legIndex | 0;
  happen(J, 'dust-devil');
  return { all, tokens };
}

/** Skipping stones: what the scene needs for the next throws → { throws, bonus, maxSkips, startSkips, available }. `bonus` = the flat stone's
 *  extra skips (J.trip.skipBonus), cleared by this call; `available` is false once the stones were skipped at this place on this leg. */
export function stonesPlan(J) {
  fill14(J);
  const t = J.trip, S = MOMENTS.stones;
  const bonus = t ? t.skipBonus | 0 : 0;
  if (t) t.skipBonus = 0;
  const here = t && t.arrived ? 'stonesStop' : 'stones';
  return { throws: S.throws, bonus, maxSkips: S.maxSkips, startSkips: S.startSkips, available: !(t && t[here]) };
}
/** The stones' result: `throws` = the skips of each throw; the best counts (at most MOMENTS.stones.maxSkips). Updates J.skips = { best, throws,
 *  byRiver: { [legId]: best } }. Once a stop (after the crossing) and once a leg at camp: a second result in the same place is ignored
 *  ({ best: 0, newBest: false, repeat: true }). → { best, newBest, byRiver }. */
export function stonesResult(J, { throws = [] } = {}) {
  fill14(J);
  const t = J.trip, S = MOMENTS.stones;
  const here = t && t.arrived ? 'stonesStop' : 'stones';
  if (t && t[here]) return { best: 0, newBest: false, byRiver: J.skips.byRiver, repeat: true };
  if (t) t[here] = true;
  const list = (Array.isArray(throws) ? throws : []).map((x) => Math.max(0, Math.min(S.maxSkips, x | 0)));
  const best = list.length ? Math.max(...list) : 0;
  const newBest = best > J.skips.best;
  J.skips.throws += list.length; J.totals.skipThrows += list.length;
  if (newBest) J.skips.best = best;
  if (J.legId && best > (J.skips.byRiver[J.legId] | 0)) J.skips.byRiver[J.legId] = best;
  if (best > 0) happen(J, 'stones');
  return { best, newBest, byRiver: J.skips.byRiver };
}
/** The water at the camp (the leg's): { water, name, river } — `river` is true where it is a river (the camp's skipping stones card), false for the creeks. */
export function campWater(J) {
  const water = waterOf(J);
  return { water, name: WATER_NAMES[water] || 'the river', river: !['creek', 'blue'].includes(water) };
}
/** Is this leg's stop a river stop where the stones are offered after the crossing (RIVER_STOPS)? */
export const isRiverStop = (J) => RIVER_STOPS.includes(J && J.legId);

/** Falling stars tonight? Only the evening of an arrival, decided once per arrival (J.trip.meteors): MOMENTS.meteors.chance of the evenings, at
 *  most once in gapLegs legs, never in the valley (the last leg), and not after a snowy leg. */
export function meteorsTonight(J) {
  fill14(J);
  const t = J.trip;
  if (!t || !t.arrived) return false;
  if (typeof t.meteors === 'boolean') return t.meteors;
  const l = legOf(J.legId), M = MOMENTS.meteors;
  const idx = J.legIndex | 0;
  let ok = !isLastLeg(l) && !t.snow && idx - J.moments.meteorsLeg >= M.gapLegs;
  ok = ok && mulberry32(hashSeed(J.seed, 'meteors', J.legId, J.legStarts))() < M.chance;
  if (ok) J.moments.meteorsLeg = idx;
  t.meteors = ok;
  return ok;
}
/** A star is tapped: a wish not yet in J.wishes (else a repeat) → { id, first, text, say }. `rand` is a () → [0, 1) function. */
export function wishFor(J, rand) {
  fill14(J);
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, 'wish', J.totals.meteorsTapped | 0, J.wishes.length));
  const fresh = WISHES.filter((w) => !J.wishes.includes(w.id));
  const pool = fresh.length ? fresh : WISHES;
  const w = pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
  const first = !J.wishes.includes(w.id);
  if (first) J.wishes.push(w.id);
  J.totals.meteorsTapped++;
  happen(J, 'meteors');
  return { id: w.id, first, text: w.text, say: w.say || w.text };
}

/** A trail fact's content entry by id (null when unknown): the title, text, card, ambient vignette and sound the app plays. */
export const factDef = (id) => TRAIL_FACT_BY_ID[id] || null;
