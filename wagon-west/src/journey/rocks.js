// Flip rocks for bait (SPEC v1.7 §2, §5); the bear at the fishing hole (§4) is planned in fishing.js. Pure over the journey object J: no DOM, no clock, no storage, no
// Math.random (the rand passed, else a seeded stream). Nothing here can be failed: the worst a rock hides is mud.
//
// A round is ROCKS.count rocks on the bank, all decided now from the seed (so a reload, or the scene, needs no randomness): under each a worm, a
// beetle, a cricket, a crawdad or nothing ('mud'), and now and then (once a round at most, only on legs whose biome has arrowheads) a stone
// arrowhead. A critter goes into its bait tin (journey/fishing.js catchBait; a full tin lets it go); an arrowhead follows the finds rule: it is
// recorded as a find (the Finds page counts it) but never kept: it is sketched in the journal and left where it lay (content/finds.js 'sketch').
// One round a stop (the river stops, after the crossing) and one a camp, like the skipping stones.
import { FIND_BY_ID } from '../content/finds.js';
import { BAITS } from '../content/fish.js';
import { legOf } from './route.js';
import { catchBait, rockTinsOpen } from './fishing.js';
import { recordFind } from './dog.js';
import { hashSeed, mulberry32 } from './rng.js';

/** The numbers: five rocks, the odds of what is under one (they add to 1), the arrowhead's chance per rock. */
export const ROCKS = { count: 5, odds: { worm: 0.3, beetle: 0.2, cricket: 0.2, crawdad: 0.1, mud: 0.2 }, arrowhead: 0.06 };

/** Is this leg's biome one where an arrowhead can lie (the arrowhead find's biomes)? */
export function arrowheadHere(J) {
  const l = legOf(J && J.legId), f = FIND_BY_ID.arrowhead;
  return !!(l && f && Array.isArray(f.biomes) && f.biomes.includes(l.biome));
}

/** Is a round of rock-flipping still to play here (the stop after the crossing, or the camp), and is some tin still short of full? */
export function rocksFree(J) {
  const t = J && J.trip;
  return !!t && !t[t.arrived ? 'rocksStop' : 'rocks'] && rockTinsOpen(J);
}

/** Plan a round: { id, here, rocks: [{ i, kind: 'worm' | 'beetle' | 'cricket' | 'crawdad' | 'mud' | 'arrowhead' }], done: {} }. Seeded by the journey, the leg, the
 *  day and a counter on the trip (J.trip.rockN, incremented). */
export function rocksPlan(J, { rand } = {}) {
  const t = J.trip || (J.trip = {});
  const n = t.rockN | 0;
  t.rockN = n + 1;
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, J.legId, J.day | 0, n, 'rocks'));
  const kinds = Object.keys(ROCKS.odds);
  const rocks = [];
  let arrow = false;
  for (let i = 0; i < ROCKS.count; i++) {
    if (!arrow && arrowheadHere(J) && r() < ROCKS.arrowhead) { arrow = true; rocks.push({ i, kind: 'arrowhead' }); continue; }
    let x = r(), kind = kinds[kinds.length - 1];
    for (const k of kinds) { x -= ROCKS.odds[k]; if (x < 0) { kind = k; break; } }
    rocks.push({ i, kind });
  }
  return { id: `${J.legId || 'camp'}|${J.day | 0}|${n}`, here: t.arrived ? 'stop' : 'camp', rocks, done: {} };
}

/** A rock is flipped: what the child finds, applied once (a second flip of the same rock changes nothing).
 *  → { kind, bait?, added?, have?, full?, find?: { id, first, n } } — a critter fills its tin (full: the tin was already full and the critter goes free);
 *  an arrowhead is recorded as a find (never kept in the wagon); mud is mud. */
export function flipRock(J, plan, i) {
  const rock = plan && plan.rocks && plan.rocks[i];
  if (!rock) return null;
  if (plan.done[i]) return plan.done[i];
  let out;
  if (rock.kind === 'mud') out = { kind: 'mud' };
  else if (rock.kind === 'arrowhead') {
    const f = recordFind(J, 'arrowhead');
    out = { kind: 'arrowhead', find: f ? { id: f.id, first: f.first, n: f.n } : null };
  } else {
    const def = BAITS.find((b) => b.critter === rock.kind);
    const c = catchBait(J, rock.kind, 1);
    out = { kind: rock.kind, bait: def ? def.id : null, added: c ? c.added : 0, have: c ? c.have : 0, full: !!c && c.added === 0 };
  }
  plan.done[i] = out;
  if (J.totals) J.totals.rocksFlipped = (J.totals.rocksFlipped | 0) + 1;
  return out;
}

/** The round is over (all five flipped, or the child left): the round for this stop / camp is used up. → { flipped, critters, arrowhead }. */
export function endRocks(J, plan) {
  const t = J.trip || (J.trip = {});
  t[plan && plan.here === 'stop' ? 'rocksStop' : 'rocks'] = true;
  const got = Object.values((plan && plan.done) || {});
  return { flipped: got.length, critters: got.filter((g) => g.bait && g.added > 0).length, arrowhead: got.some((g) => g.kind === 'arrowhead') };
}
