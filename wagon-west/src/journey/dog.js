// The dog (SPEC v1.4 §1.1, §1.2, §3.2): it joins at the Kansas River, then its nose finds things on the trail (an old horseshoe, a feather,
// a skipping stone …), warns of a rattlesnake, chases a jackrabbit and finds a berry patch every other leg; at camp it plays fetch.
// Pure functions over the journey object J (J.dog = { name, coat, legs, nextBerries, treats, muddy } | null): no DOM, no clock, no
// storage, no Math.random. sim.js re-exports these (wrapping the ones that move the party's spirit or food so the mood words follow).
// Nothing here can be failed: the worst outcome is a muddy dog, which `arrive` and `camp` wash.
import { FINDS, FIND_BY_ID } from '../content/finds.js';
import { EVENT_BY_ID } from '../content/events.js';
import { legOf, legList, seasonOf } from './route.js';
import { NOSE, FETCH, HORSESHOE, MOOD } from './economy.js';
import { hashSeed, mulberry32 } from './rng.js';
import { fill14 } from './collections.js';
import { questFindable, findQuestItem, questAtStop } from './quests.js';
import { addFoodKind } from './supplies.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
/** The name a child gave the dog, as the journey keeps it: trimmed, at most 12 characters. */
export const cleanDogName = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 12);

/** Is the dog offered here? No dog yet, and the leg is the Kansas River (the far bank, after the crossing) or a fort from the second
 *  leg on (the stores ask again after a "Not now"). */
export function dogOfferAt(J, leg) {
  if (!J || J.dog) return false;
  const l = legOf(leg || J.legId);
  if (!l) return false;
  return l.id === 'kansas-river' || !!(l.stop && l.stop.kind === 'fort' && (l.n | 0) >= 2);
}

/** The dog joins: J.dog = { name (at most 12 characters), coat, legs: 0, nextBerries: 1, treats: 0, muddy: false }. If a quest is found
 *  at this stop (the locket at the Kansas River) its item comes back at once: returns { dog, quest: questId | null } (the quest is
 *  now 'carried'; the app shows the item's card). A journey that already has a dog keeps it ({ dog, quest: null }, nothing changes).
 *  The first berry patch is the first leg after the dog joins: if the leg's pay was already counted (arrive ran before the dog was
 *  named) the dog starts at nextBerries 0 so the next leg still has the patch. */
export function adoptDog(J, { name, coat } = {}) {
  fill14(J);
  if (J.dog) return { dog: J.dog, quest: null };
  const counted = !!(J.trip && J.trip.result);
  J.dog = { name: cleanDogName(name) || 'Dog', coat: coat || 'brown', legs: 0, nextBerries: counted ? 0 : 1, treats: 0, muddy: false };
  let quest = null;
  const id = questAtStop(J, J.legId);
  if (id && findQuestItem(J, id)) quest = id;
  return { dog: J.dog, quest };
}

// the last leg runs as the Columbia raft (no trail days): nothing is planned on it
const isLastLeg = (l) => !!l && legList().length > 0 && legList()[legList().length - 1].id === l.id;

/** The leg's nose slots (the dog must be in the party; no dog, no slots): [{ atMile, kind: 'find' | 'rabbit' | 'snake' | 'berries' | 'quest',
 *  quest?, fired: false }] sorted by mile. NOSE.perLeg (2 or 3, even odds) slots at evenly spread, jittered miles in [from, to] of the
 *  leg, at least NOSE.spacingMi miles apart; the first is the quest item when a quest can start by the nose on this leg; one is the
 *  berry patch when dog.legs ≥ dog.nextBerries (then nextBerries = legs + 2); the rest by NOSE.weights (a snake only in
 *  NOSE.snakeBiomes, at most one rabbit and one snake a leg). The last leg (the raft) has none. `rand` is a () → [0, 1) function. */
export function planNose(J, leg, rand) {
  fill14(J);
  const l = legOf(leg);
  if (!J || !J.dog || !l || isLastLeg(l)) return [];
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, l.id, J.legStarts, 'nose-plan'));
  const wantN = r() < 0.5 ? NOSE.perLeg[0] : NOSE.perLeg[1];
  const kinds = [];
  const quest = questFindable(J, 'nose');
  if (quest) kinds.push({ kind: 'quest', quest });
  if ((J.dog.legs | 0) >= (J.dog.nextBerries | 0)) { kinds.push({ kind: 'berries' }); J.dog.nextBerries = (J.dog.legs | 0) + 2; }
  const count = Math.max(wantN, kinds.length);
  let rabbits = 0, snakes = 0;
  const rest = [];
  while (kinds.length + rest.length < count) {
    const w = { find: NOSE.weights.find, rabbit: rabbits < 1 ? NOSE.weights.rabbit : 0,
      snake: snakes < 1 && NOSE.snakeBiomes.includes(l.biome) ? NOSE.weights.snake : 0 };
    const total = w.find + w.rabbit + w.snake;
    let x = r() * total, kind = 'find';
    for (const k of ['find', 'rabbit', 'snake']) { if (x < w[k]) { kind = k; break; } x -= w[k]; }
    if (kind === 'rabbit') rabbits++; else if (kind === 'snake') snakes++;
    rest.push({ kind });
  }
  // the quest item keeps the first slot; the other kinds are shuffled among the rest
  const mix = [...kinds.filter((k) => k.kind !== 'quest'), ...rest];
  for (let i = mix.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mix[i], mix[j]] = [mix[j], mix[i]]; }
  const order = [...kinds.filter((k) => k.kind === 'quest'), ...mix];
  const from = Math.round(NOSE.from * l.miles), to = Math.floor(NOSE.to * l.miles);
  const sp = Math.max(1, Math.min(NOSE.spacingMi, Math.floor((to - from) / count)));
  const free = Math.max(0, to - from - (count - 1) * sp);
  return order.map((k, i) => {
    const at = Math.min(to, Math.ceil(from + ((i + r()) / count) * free + i * sp - 1e-9));
    return { atMile: at, kind: k.kind, ...(k.quest ? { quest: k.quest } : {}), fired: false };
  }).sort((a, b) => a.atMile - b.atMile);
}

/** Which find the dog brings back (the id) on this leg: weighted by the content's FINDS[].weight among the finds the leg's biome allows
 *  (biomes null = every biome); with probability NOSE.unseenBias a find the sketchbook does not have yet when there is one. The shiny
 *  spoon is never drawn while the wagon has one; in the nose draw it is a rare weight, in a fetch (`fromFetch`) it is left out here
 *  (fetchThrow rolls FETCH.spoonChance for it). */
export function drawFind(J, leg, rand, { fromFetch = false } = {}) {
  fill14(J);
  const l = legOf(leg || J.legId);
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, l ? l.id : '', J.legStarts, 'find'));
  let pool = FINDS.filter((f) => (!Array.isArray(f.biomes) || (l && f.biomes.includes(l.biome))) && !(f.id === 'spoon' && (J.goods.spoon > 0 || fromFetch)));
  if (!pool.length) pool = FINDS.filter((f) => f.id !== 'spoon');
  const unseen = pool.filter((f) => !(J.finds[f.id] > 0));
  const pickFrom = unseen.length && r() < NOSE.unseenBias ? unseen : pool;
  const total = pickFrom.reduce((a, f) => a + (Number.isFinite(f.weight) ? f.weight : 1), 0);
  let x = r() * total;
  for (const f of pickFrom) { x -= Number.isFinite(f.weight) ? f.weight : 1; if (x < 0) return f.id; }
  return pickFrom[pickFrom.length - 1].id;
}

/** The dog's find is kept: J.finds[id]++ and the find's effects: `goods` adds one to J.goods[goods] (the spoon only one; a find kept as a
 *  'sketch' never adds goods), a 'use' find's spirit (capped at MOOD.max), a flat stone's +2 skips on the next stone throw (J.trip.skipBonus).
 *  Returns { id, first, n, goods?: { id, n }, effect?: { spirit?, skips? } }; null for an unknown id. */
export function recordFind(J, findId) {
  fill14(J);
  const f = FIND_BY_ID[findId];
  if (!f) return null;
  const first = !(J.finds[f.id] > 0);
  J.finds[f.id] = (J.finds[f.id] | 0) + 1;
  const out = { id: f.id, first, n: J.finds[f.id] };
  if (f.goods && f.keep !== 'sketch') {
    J.goods[f.goods] = f.goods === 'spoon' ? 1 : (J.goods[f.goods] | 0) + 1;
    out.goods = { id: f.goods, n: J.goods[f.goods] };
  }
  if (f.effect) {
    out.effect = { ...f.effect };
    if (f.effect.spirit) J.spirit = clamp((Number.isFinite(J.spirit) ? J.spirit : MOOD.start) + f.effect.spirit, 0, MOOD.max);
    if (f.effect.skips && J.trip) J.trip.skipBonus = (J.trip.skipBonus | 0) + f.effect.skips;
  }
  return out;
}

/** The rabbit chase's outcome: called in the first NOSE.chaseLate (80 %) of the run → the dog skids round, clean ('good'); called late or
 *  not at all → he comes back on his own, muddy from nose to tail (J.dog.muddy, until the next stop or camp: `arrive` and `camp` wash).
 *  Either way: a laugh, spirit +NOSE.spirit and the jackrabbit card. It never takes anything away. */
export function chaseResult(J, { called = false, dist = 1 } = {}) {
  fill14(J);
  const good = !!called && Number(dist) < NOSE.chaseLate;
  if (J.dog) J.dog.muddy = !good;
  J.spirit = clamp((Number.isFinite(J.spirit) ? J.spirit : MOOD.start) + NOSE.spirit, 0, MOOD.max);
  J.totals.chases++; if (called) J.totals.chasesCalled++;
  return { muddy: !good, line: good ? 'good' : 'muddy', card: 'jackrabbit' };
}

/** One throw of the stick at camp (the dog must be in the party; at most FETCH.throws a camp visit, `J.trip.fetchThrows`, reset by `camp`
 *  and `arrive`): `dist` is 0..1 of the field; treats are 1, 2 or 3 by FETCH.at. Now and then (FETCH.itemChance) he brings back a find of
 *  the leg's biome (or the item of a quest that is found by fetch: `quest: { id, item }`), very rarely (FETCH.spoonChance) the shiny spoon (while
 *  the wagon has none). { treats, item, first?, spoon?, quest?, left };
 *  after the last throw (or without a dog) { treats: 0, item: null, left: 0 } and nothing changes. No day passes, no food is eaten. */
export function fetchThrow(J, { dist = 0, rand } = {}) {
  fill14(J);
  const t = J.trip;
  const used = t ? t.fetchThrows | 0 : 0;
  if (!J.dog || used >= FETCH.throws) return { treats: 0, item: null, left: 0 };
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, J.legId, J.legStarts, 'fetch', J.totals.fetchThrows | 0));
  if (t) t.fetchThrows = used + 1;
  const d = clamp(Number(dist) || 0, 0, 1);
  const treats = d < FETCH.at[0] ? FETCH.treats[0] : d < FETCH.at[1] ? FETCH.treats[1] : FETCH.treats[2];
  J.dog.treats += treats; J.treatsBest = Math.max(J.treatsBest, d);
  J.totals.fetchThrows++; J.totals.treats += treats;
  const out = { treats, item: null, left: Math.max(0, FETCH.throws - (used + 1)) };
  const u = r();
  if (u < FETCH.spoonChance && !(J.goods.spoon > 0)) {
    const rec = recordFind(J, 'spoon');
    if (rec) { out.item = 'spoon'; out.first = rec.first; out.spoon = true; }
  } else if (u < FETCH.itemChance) {
    const qid = questFindable(J, 'fetch');          // a quest that is found by fetch (a glove, say) is what he brings back
    const got = qid && findQuestItem(J, qid);
    if (got) out.quest = { id: got.quest.id, item: got.item };
    else {
      const id = drawFind(J, J.legId, r, { fromFetch: true });
      const rec = recordFind(J, id);
      if (rec) { out.item = id; out.first = rec.first; }
    }
  }
  if ((out.item || out.quest) && t && Array.isArray(t.happened) && !t.happened.includes('fetch')) t.happened.push('fetch');
  return out;
}

/** The blacksmith at a fort buys old iron: all of J.goods.horseshoes at HORSESHOE.price × the season's price level each. { n, cash }. */
export function sellHorseshoes(J) {
  fill14(J);
  const n = J.goods.horseshoes | 0;
  if (n <= 0) return { n: 0, cash: 0 };
  const cash = n * Math.round(HORSESHOE.price * seasonOf(J.season).priceMult);
  J.goods.horseshoes = 0; J.cash += cash;
  return { n, cash };
}

/** Fire one nose slot on the trail (tickDay calls this; the app never does): applies what the journey owns (a find recorded, the berries'
 *  food added, the snake's spirit, a quest item found) and returns what the app shows:
 *  { kind: 'find' | 'berries' | 'snake' | 'rabbit' | 'quest', find?, quest?: { id, item }, foodLb?, card? }. The rabbit's outcome waits for chaseResult. */
export function fireNose(J, slot, index = 0) {
  fill14(J);
  const leg = legOf(J.legId);
  const t = J.trip;
  const happen = (k) => { if (t && Array.isArray(t.happened) && !t.happened.includes(k)) t.happened.push(k); };
  const r = mulberry32(hashSeed(J.seed, J.legId, J.legStarts, 'nose', index));
  let kind = slot.kind;
  if (kind === 'quest') {
    const id = questFindable(J, 'nose');
    const got = id && findQuestItem(J, id);
    if (got) return { kind: 'quest', quest: { id: got.quest.id, item: got.item } };
    kind = 'find';
  }
  if (kind === 'berries') {
    const ev = EVENT_BY_ID.berries;
    const lb = addFoodKind(J, 'other', (ev && ev.foodLb) || 20);
    J.totals.berries++; happen('berries');
    return { kind: 'berries', foodLb: lb, card: 'wild-plum' };
  }
  if (kind === 'snake') {
    J.spirit = clamp((Number.isFinite(J.spirit) ? J.spirit : MOOD.start) + NOSE.spirit, 0, MOOD.max);
    J.totals.snakes++; happen('snake');
    return { kind: 'snake', card: 'rattlesnake' };
  }
  if (kind === 'rabbit') { happen('chase'); return { kind: 'rabbit', card: 'jackrabbit' }; }
  const id = drawFind(J, leg, r);
  const rec = recordFind(J, id);
  J.totals.noseFinds++; happen('nose');
  return { kind: 'find', find: rec };
}
