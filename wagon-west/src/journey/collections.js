// What the journey collects in v1.4 (SPEC v1.4 §3.1, §3.7): the dog's finds, the fish log, the skipping stones, the wishes, the
// quests and the trail facts. This module has no imports from sim.js (sim.js imports it), so the app's sync code can use the merge
// rules on their own:
//   fill14(J)            the v1.4 fields on a journey from an older save (idempotent; the sim's ensureJourney calls it)
//   carry14(prev, next)  what a new season keeps (newSeason calls it)
//   merge14(s, o)        the family-sync merge of two journeys (the app's mergeWw calls merge14(s.journey, o.journey); s is the later doc)
// Pure: no DOM, no clock, no storage.

/** The plain-number counters v1.4 adds to J.totals (ensureJourney defaults each on an older save). */
export const V14_COUNTERS = ['noseFinds', 'chases', 'chasesCalled', 'snakes', 'berries', 'fetchThrows', 'treats', 'fishCaught', 'fishOff',
  'fishJunk', 'sturgeon', 'skipThrows', 'dustDevils', 'hatsCaught', 'hatsAll', 'meteorsTapped', 'questsDone', 'factsHeard'];

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const uniq = (...arrs) => { const out = []; for (const a of arrs) for (const x of Array.isArray(a) ? a : []) if (!out.includes(x)) out.push(x); return out; };
const maxMap = (a, b) => { const out = { ...(isObj(a) ? a : {}) }; for (const [k, v] of Object.entries(isObj(b) ? b : {})) out[k] = Math.max(num(out[k]), num(v)); return out; };

/** The rank of a quest state in a merge: none < carried < mailed < returned. */
export const QUEST_RANK = { none: 0, carried: 1, mailed: 2, returned: 3 };

/** The empty quest record of a journey that has not met the quest yet. */
export const newQuestRecord = () => ({ state: 'none', step: 0, foundLeg: null, season: null });

/** Fill in the v1.4 fields on a journey (a 1.3.2 save has none of them), without touching anything else; harmless on a current
 *  one. The trip's own fields are filled by the sim (they need the leg). Sets J.rev to 14 when it was older. */
export function fill14(J) {
  if (!J) return J;
  if (J.dog !== null && J.dog !== undefined) {
    if (!isObj(J.dog)) J.dog = null;
    else {
      J.dog.legs = num(J.dog.legs); J.dog.nextBerries = Number.isFinite(J.dog.nextBerries) ? J.dog.nextBerries : 1;
      J.dog.treats = Math.max(0, num(J.dog.treats)); J.dog.muddy = !!J.dog.muddy;
    }
  } else J.dog = null;
  if (!isObj(J.finds)) J.finds = {};
  if (!isObj(J.goods)) J.goods = {};
  for (const k of ['horseshoes', 'hoppers', 'spoon']) if (!Number.isFinite(J.goods[k]) || J.goods[k] < 0) J.goods[k] = 0;
  J.goods.spoon = Math.min(1, J.goods.spoon | 0);
  if (!isObj(J.fishLog)) J.fishLog = {};
  if (!isObj(J.fishJunk)) J.fishJunk = {};
  for (const k of ['boot', 'turtle', 'bottle']) if (!Number.isFinite(J.fishJunk[k])) J.fishJunk[k] = 0;
  if (!isObj(J.fishBest) || !Number.isFinite(J.fishBest.in)) J.fishBest = null;
  if (!isObj(J.skips)) J.skips = { best: 0, throws: 0, byRiver: {} };
  J.skips.best = num(J.skips.best); J.skips.throws = num(J.skips.throws); if (!isObj(J.skips.byRiver)) J.skips.byRiver = {};
  if (!Array.isArray(J.wishes)) J.wishes = [];
  J.treatsBest = num(J.treatsBest);
  if (!isObj(J.quests)) J.quests = {};
  if (!Array.isArray(J.questsDone)) J.questsDone = [];
  if (!Array.isArray(J.factsHeard)) J.factsHeard = [];
  if (!isObj(J.opts)) J.opts = { hunting: true };
  if (typeof J.opts.farSounds !== 'boolean') J.opts.farSounds = true;
  if (!isObj(J.moments)) J.moments = {};
  if (!Number.isFinite(J.moments.dustDevilLeg)) J.moments.dustDevilLeg = -9;
  if (!Number.isFinite(J.moments.meteorsLeg)) J.moments.meteorsLeg = -9;
  if (!isObj(J.totals)) J.totals = {};
  for (const k of V14_COUNTERS) if (!Number.isFinite(J.totals[k])) J.totals[k] = 0;
  return J;
}

/** A new season keeps (SPEC §3.1): the dog (clean again), the finds, the fish log, the junk, the best fish, the stones, the wishes,
 *  the quests given back, the longest fetch, the shiny spoon and the far-off sounds switch; the quests, the facts heard, the moments
 *  and the rest of the goods start over. Mutates and returns `next` (a fresh journey from createJourney). */
export function carry14(prev, next) {
  if (!prev || !next) return next;
  fill14(prev); fill14(next);
  next.dog = prev.dog ? { ...clone(prev.dog), muddy: false } : null;
  next.finds = clone(prev.finds);
  next.fishLog = clone(prev.fishLog);
  next.fishJunk = clone(prev.fishJunk);
  next.fishBest = clone(prev.fishBest);
  next.skips = clone(prev.skips);
  next.wishes = prev.wishes.slice();
  next.questsDone = prev.questsDone.slice();
  next.treatsBest = prev.treatsBest;
  next.goods.spoon = prev.goods.spoon ? 1 : 0;
  next.opts.farSounds = prev.opts.farSounds !== false;
  next.quests = {}; next.factsHeard = []; next.moments = { dustDevilLeg: -9, meteorsLeg: -9 };
  return next;
}

/** The family-sync merge of two journeys (SPEC §3.7). `s` is the later doc's journey and is changed and returned; `o` is the other
 *  and is only read. Both may be older (fields missing): a missing field counts as empty. When both have a journey:
 *  finds per id max · fishLog per species: n max, the bigger bestIn with its lb / leg · fishJunk per kind max · fishBest the bigger ·
 *  skips.best and skips.throws max, byRiver per key max · wishes and questsDone union · treatsBest max · dog: the later doc's, else the
 *  other's, then treats max · and, when it is the same journey (season + seed): quests per id the further state (none < carried <
 *  mailed < returned, step max), factsHeard union, goods.spoon max. Everything else stays the later doc's. */
export function merge14(s, o) {
  if (!s || !o) return s;
  fill14(s);
  const O = clone(o); fill14(O);
  s.finds = maxMap(s.finds, O.finds);
  for (const [id, r] of Object.entries(O.fishLog)) {
    const m = s.fishLog[id];
    if (!m) { s.fishLog[id] = clone(r); continue; }
    const bigger = num(r.bestIn) > num(m.bestIn) ? r : m;
    s.fishLog[id] = { ...clone(m), n: Math.max(num(m.n), num(r.n)), bestIn: num(bigger.bestIn), bestLb: num(bigger.bestLb),
      firstLeg: bigger.firstLeg ?? m.firstLeg ?? r.firstLeg ?? null, firstSeason: bigger.firstSeason ?? m.firstSeason ?? r.firstSeason ?? null };
  }
  s.fishJunk = maxMap(s.fishJunk, O.fishJunk);
  if (O.fishBest && (!s.fishBest || num(O.fishBest.in) > num(s.fishBest.in))) s.fishBest = clone(O.fishBest);
  s.skips = { best: Math.max(num(s.skips.best), num(O.skips.best)), throws: Math.max(num(s.skips.throws), num(O.skips.throws)),
    byRiver: maxMap(s.skips.byRiver, O.skips.byRiver) };
  s.wishes = uniq(s.wishes, O.wishes);
  s.questsDone = uniq(s.questsDone, O.questsDone);
  s.treatsBest = Math.max(num(s.treatsBest), num(O.treatsBest));
  if (!s.dog && O.dog) s.dog = clone(O.dog);
  else if (s.dog && O.dog) s.dog.treats = Math.max(num(s.dog.treats), num(O.dog.treats));
  const same = s.season === o.season && String(s.seed) === String(o.seed);
  if (same) {
    for (const [id, r] of Object.entries(O.quests)) {
      const m = s.quests[id];
      if (!m) { s.quests[id] = clone(r); continue; }
      const win = (QUEST_RANK[r.state] || 0) > (QUEST_RANK[m.state] || 0) ? r : m;
      s.quests[id] = { ...clone(win), step: Math.max(num(m.step), num(r.step)) };
    }
    s.factsHeard = uniq(s.factsHeard, O.factsHeard);
    s.goods.spoon = Math.max(s.goods.spoon | 0, O.goods.spoon | 0) ? 1 : 0;
  }
  return s;
}
