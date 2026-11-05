// Fishing 2.0 (SPEC v1.4 §1.3, §3.3). Imported by the scene as well as by sim.js, so it keeps to the content's fish tables, the seeded rng and
// the economy numbers (the quest hooks below are registered by sim.js; the scene never plans a session).
//
// A session is four casts planned up front from the seed (species by the water and the bait, junk, sizes, the bite time, the fight's
// wobble windows), so the scene can run it with no randomness of its own and a reload replays it. The fight is one small pure stepper:
//   createFight(fight) → state · fightStep(state, dtMs, down) → state · fightHelp(state) → state
// Hold (down) to reel; the line wobbles red now and then (a yellow shiver `warnMs` before); held through `strainMaxMs` of one wobble the fish
// wiggles off ('off': cast again once). There is no other way to lose anything: nothing snaps and nothing is ever lost.
import { FISH, FISH_BY_ID, BAITS, BAIT_BY_ID, JUNK, JUNK_BY_ID, WATERS, WATER_NAMES } from '../content/fish.js';
import { FISHING, RESCUE } from './economy.js';
import { hashSeed, mulberry32 } from './rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ---- the quest hooks (sim.js registers questFindable / findQuestItem so the scene's import stays small) ----
let hooks = { questFindable: () => null, findQuestItem: () => null };
/** sim.js hands in the quest machine ({ questFindable(J, via), findQuestItem(J, id) }). */
export function setQuestHooks(h) { hooks = { ...hooks, ...(h || {}) }; }

/** The water a leg (an id, a leg object or the journey) is fished in: WATERS[leg id], 'kansas' by default. */
export function waterOf(x) {
  const id = typeof x === 'string' ? x : x && typeof x === 'object' ? (x.legId || x.id) : null;
  return WATERS[id] || 'kansas';
}

/** The rock-flip baits (v1.7): the tins that are kept in J.goods under the bait's own id, at most `max` each. */
export const ROCK_BAITS = BAITS.filter((b) => b.rock).map((b) => b.id);
const fillGoods = (J) => { if (!J.goods || typeof J.goods !== 'object') J.goods = {}; for (const k of ['hoppers', 'spoon', ...ROCK_BAITS]) if (!Number.isFinite(J.goods[k])) J.goods[k] = 0; return J.goods; };
/** Is this bait used up one a cast (grasshoppers and the critters from the rocks)? */
const consumable = (id) => id === 'hoppers' || ROCK_BAITS.includes(id);

/** The bait buttons: [{ id, n?, ok }] — worms always, grasshoppers with the tin's count, the spoon when owned, and each rock critter only while its
 *  tin has some (v1.7). */
export function baitsAvailable(J) {
  const g = fillGoods(J);
  const out = [{ id: 'worms', ok: true }, { id: 'hoppers', n: g.hoppers | 0, ok: (g.hoppers | 0) > 0 }, { id: 'spoon', ok: (g.spoon | 0) > 0 }];
  for (const id of ROCK_BAITS) if ((g[id] | 0) > 0) out.push({ id, n: g[id] | 0, ok: true });
  return out;
}
/** The grasshopper game's catch: `n` more in the tin, at most FISHING.hopperMax. { added, have }. */
export function catchHoppers(J, n) {
  const g = fillGoods(J);
  const before = Math.max(0, Math.min(FISHING.hopperMax, g.hoppers | 0));
  const have = Math.min(FISHING.hopperMax, before + Math.max(0, Math.floor(Number(n) || 0)));
  g.hoppers = have;
  return { added: have - before, have };
}
/** A critter from under a rock goes into its tin (the bait with that `critter`), at most the bait's `max`. → { bait, added, have, full } or null. */
export function catchBait(J, critter, n = 1) {
  const def = BAITS.find((b) => b.critter === critter);
  if (!def) return null;
  const g = fillGoods(J);
  const before = Math.max(0, Math.min(def.max, g[def.id] | 0));
  const have = Math.min(def.max, before + Math.max(0, Math.floor(Number(n) || 0)));
  g[def.id] = have;
  return { bait: def.id, added: have - before, have, full: have >= def.max };
}
/** Is some rock-critter tin short of full (so a round of rock-flipping can still fill one)? */
export const rockTinsOpen = (J) => { const g = fillGoods(J); return BAITS.some((b) => b.rock && (g[b.id] | 0) < b.max); };

// ---- the fight ----
/** A fresh fight for a species (the cast's `fight`): reel time, the fish's pull, and the wobble windows [[startMs, endMs] …] laid out over
 *  a generous horizon (the first window starts 30-55 % of the way in; the calm between two windows is a draw from wobbleEvery). */
function layFight(species, r, help) {
  const f = species.fight;
  const reelMs = Math.round(f.reelS * 1000), w = Math.round(f.wobbleS * 1000);
  const [a, b] = f.wobbleEvery;
  const horizon = Math.max(60000, reelMs * 10);
  const wobbles = [];
  // the first red comes early, between 30 % and 55 % of the way in (of the way to the half-way tap for a sturgeon), so a hand that never lets go
  // is always caught by it; after that the calm between two windows is a draw from wobbleEvery
  let at = Math.round(reelMs * (help ? FISHING.helpAt : 1) * (0.3 + 0.25 * r()));
  while (at < horizon) { wobbles.push([at, at + w]); at += w + Math.round((a + (b - a) * r()) * 1000); }
  return { reelMs, pullPerMs: f.pullPerS / 1000, wobbles, strainMaxMs: FISHING.strainMaxMs, warnMs: FISHING.warnMs, help: !!help, helpAt: FISHING.helpAt,
    helpSpeed: FISHING.helpSpeed };
}
const junkFight = () => ({ reelMs: 1500, pullPerMs: 0, wobbles: [], strainMaxMs: FISHING.strainMaxMs, warnMs: FISHING.warnMs, help: false, helpAt: FISHING.helpAt,
  helpSpeed: FISHING.helpSpeed });

/** A new fight state from a cast's `fight`: { t: 0, progress: 0, strain: 0, phase: 'reel', wobble: false, warn: false, helped: false, fight }. */
export function createFight(fight) {
  return { t: 0, progress: 0, strain: 0, phase: 'reel', wobble: false, warn: false, helped: false, fight };
}

/** One step of the fight (pure; returns a new state). `down` is whether the finger / mouse / Space is held.
 *  - phases: 'reel' (the fight), 'help' (the sturgeon waits half way for a second tap), 'off' (it wiggled off), 'landed'; 'help', 'off' and
 *    'landed' change nothing until fightHelp (help) — there is no other phase: nothing snaps, nothing is ever lost.
 *  - t += dt; wobble = t is inside a wobble window; warn = a window starts within warnMs.
 *  - down: progress += dt / reelMs (× helpSpeed once helped); in a wobble strain += dt, else strain = max(0, strain − dt / 2).
 *  - up: progress = max(0, progress − pullPerMs × dt); strain = max(0, strain − dt).
 *  - strain > strainMaxMs → 'off' · help && !helped && progress ≥ helpAt → 'help' · progress ≥ 1 → 'landed'. */
export function fightStep(state, dtMs, down) {
  if (!state || state.phase !== 'reel') return state;
  const f = state.fight, dt = Math.max(0, num(dtMs));
  const t = state.t + dt;
  let wobble = false, warn = false;
  for (const [s, e] of f.wobbles) {
    if (s > t + f.warnMs) break;
    if (t >= s && t < e) { wobble = true; break; }
    if (s > t) { warn = true; break; }
  }
  let progress = state.progress, strain = state.strain;
  if (down) {
    progress += (dt / f.reelMs) * (state.helped ? (f.helpSpeed || FISHING.helpSpeed) : 1);
    strain = wobble ? strain + dt : Math.max(0, strain - dt / 2);
  } else {
    progress = Math.max(0, progress - f.pullPerMs * dt);
    strain = Math.max(0, strain - dt);
  }
  progress = Math.min(1, progress);
  let phase = 'reel';
  if (strain > f.strainMaxMs) phase = 'off';
  else if (f.help && !state.helped && progress >= f.helpAt) { phase = 'help'; progress = Math.min(progress, f.helpAt); }
  else if (progress >= 1) phase = 'landed';
  return { ...state, t, progress, strain, wobble, warn, phase };
}
/** The second tap on the sturgeon: 'help' → 'reel', helped true (the two reel at double speed). Any other phase is returned as it is. */
export function fightHelp(state) {
  if (!state || state.phase !== 'help') return state;
  return { ...state, phase: 'reel', helped: true };
}
/** Run a fight over scripted presses (the tests' and the mock scene's helper): `presses` = [{ atMs, down?, help? }] in any order; `down` is the
 *  held state from that moment on, `help: true` is the second tap. Steps every `stepMs` until the fight ends or `maxMs` passes.
 *  → { phase, progress, ms, state }. A sturgeon with no help press stops at 'help'. */
export function fightOutcome(fight, presses = [], { maxMs = 180000, stepMs = 10 } = {}) {
  const ev = [...presses].sort((a, b) => a.atMs - b.atMs);
  let s = createFight(fight), t = 0, i = 0, down = false;
  while (t < maxMs) {
    while (i < ev.length && ev[i].atMs <= t) { if (ev[i].down !== undefined) down = !!ev[i].down; if (ev[i].help) s = fightHelp(s); i++; }
    if (s.phase === 'help') {                                  // the reel holds until the second tap: jump to it, or stop here
      const next = ev.slice(i).find((e) => e.help);
      if (!next) break;
      t = Math.max(t, next.atMs);
      continue;
    }
    if (s.phase !== 'reel') break;
    s = fightStep(s, stepMs, down);
    t += stepMs;
  }
  return { phase: s.phase, progress: s.progress, ms: t, state: s };
}

/** The bear at the fishing hole: one session in BEAR.oneIn (about), never two in a row, on the 2nd or 3rd cast, fishing or eating berries. */
export const BEAR = { oneIn: 8, atCast: [1, 2], kinds: ['fishing', 'berries'] };

// ---- the session ----
function weightedPick(r, items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  if (!(total > 0)) return null;
  let x = r() * total;
  for (const it of items) { x -= weightOf(it); if (x < 0) return it; }
  return items[items.length - 1];
}
const lerp = (a, b, t) => a + (b - a) * t;
const baitWeight = (species, baitId) => { const w = species.bait && species.bait[baitId]; return Number.isFinite(w) ? w : 1; };

/** Plan a fishing session: FISHING.casts casts, all decided now from the seed (J.seed, the leg, the day and J.trip.fishing, which it
 *  increments) or from the `rand` passed.
 *  - session = { id, water, waterName, bait, rescue, casts: [cast], cameo: { at, kind: 'splash' | 'steal' } | null, results: {}, lb: 0 }
 *  - cast = { i, kind: 'fish' | 'junk', species?, junk?, lengthIn?, lb?, biteS, bait, fight: { reelMs, pullPerMs, wobbles, strainMaxMs, warnMs, help,
 *    helpAt, helpSpeed }, retries: 0 }
 *  Species are drawn by the water (FISH[].waters[water]) × the bait's weight for the species; the sturgeon at most once a session; junk at
 *  FISHING.junkChance (the snapping turtle only in its waters; the bottle only while its quest can start, at FISHING.bottleChance of the junk
 *  casts, at most one a session); sizes lean toward the big end by the bait's sizeBias (× the species' weight for the bait, up to 1); pounds
 *  by size × FISHING.lbScale; the grasshoppers are used one a cast at plan time (casts beyond the tin fall back to worms); the spoon is never
 *  used up. The dog's cameo (J.dog, FISHING.cameoChance a session): a splash after the bobber or a fish grabbed off the bank, on one cast. */
export function fishingSession(J, { bait = 'worms', rescue = false, rand } = {}) {
  const g = fillGoods(J);
  const t = J.trip || null;
  const counter = t ? t.fishing | 0 : 0;
  if (t) t.fishing = counter + 1;
  const id = `${J.legId || 'camp'}|${J.day | 0}|${counter}`;
  const r = typeof rand === 'function' ? rand : mulberry32(hashSeed(J.seed, J.legId, J.day | 0, counter, 'fish'));
  const water = waterOf(J);
  let chosen = BAIT_BY_ID[bait] ? bait : 'worms';
  if (consumable(chosen) && !(g[chosen] > 0)) chosen = 'worms';
  if (chosen === 'spoon' && !(g.spoon > 0)) chosen = 'worms';
  const casts = [];
  let sturgeon = false, bottle = false;
  for (let i = 0; i < FISHING.casts; i++) {
    let castBait = chosen;
    if (consumable(chosen)) { if (g[chosen] > 0) g[chosen]--; else castBait = 'worms'; }
    const baitDef = BAIT_BY_ID[castBait] || {};
    let cast = null;
    if (r() < FISHING.junkChance) {
      let pool = JUNK.filter((j) => (!Array.isArray(j.waters) || j.waters.includes(water)) && !j.quest);
      let pickJ = null;
      const bottleDef = JUNK.find((j) => j.quest && (!Array.isArray(j.waters) || j.waters.includes(water)));
      if (bottleDef && !bottle && hooks.questFindable(J, 'fish') === bottleDef.quest && r() < FISHING.bottleChance) { pickJ = bottleDef; bottle = true; }
      else pickJ = pool[Math.floor(r() * pool.length)] || JUNK_BY_ID.boot || pool[0];
      if (pickJ) cast = { i, kind: 'junk', junk: pickJ.id, lb: 0, biteS: lerp(FISHING.biteS[0], FISHING.biteS[1], r()), bait: castBait, fight: junkFight(), retries: 0 };
    }
    if (!cast) {
      const pool = FISH.filter((f) => num(f.waters && f.waters[water]) > 0 && !(f.onePerSession && sturgeon));
      const sp = weightedPick(r, pool, (f) => f.waters[water] * baitWeight(f, castBait));
      if (sp) {
        if (sp.onePerSession) sturgeon = true;
        const w = Math.min(1, baitWeight(sp, castBait));
        const bias = num(baitDef.sizeBias) * w;
        const size = clamp(r() * (1 - bias) + bias, 0, 1);
        const lengthIn = Math.round(lerp(sp.sizeIn[0], sp.sizeIn[1], size) * 10) / 10;
        const lb = Math.max(1, Math.round(lerp(sp.lb[0], sp.lb[1], size) * FISHING.lbScale));
        const sooner = 1 - num(baitDef.biteSooner) * w;
        const biteS = Math.round(lerp(FISHING.biteS[0], FISHING.biteS[1], r()) * sooner * 100) / 100;
        cast = { i, kind: 'fish', species: sp.id, lengthIn, lb, biteS, bait: castBait, fight: layFight(sp, r, sp.help), retries: 0 };
      } else cast = { i, kind: 'junk', junk: 'boot', lb: 0, biteS: lerp(FISHING.biteS[0], FISHING.biteS[1], r()), bait: castBait, fight: junkFight(), retries: 0 };
    }
    casts.push(cast);
  }
  let cameo = null;
  if (J.dog && r() < FISHING.cameoChance) cameo = { at: Math.floor(r() * FISHING.casts), kind: r() < 0.5 ? 'splash' : 'steal' };
  const bear = planBear(J, r, { rescue });                 // (drawn last, so every older draw of a seeded session is unchanged)
  return { id, water, waterName: WATER_NAMES[water] || 'the river', bait: chosen, rescue: !!rescue, casts, cameo, bear, results: {}, lb: 0 };
}

/** Decide a session's bear (called by fishingSession after its other draws; `rand` is the session's stream): null, or { at: cast index, kind }.
 *  About one session in BEAR.oneIn, never right after a session that had one (J.moments.bearLast); a safety-net session never has one. */
export function planBear(J, r, { rescue = false } = {}) {
  if (!J.moments || typeof J.moments !== 'object') J.moments = {};
  if (rescue) return null;
  const was = !!J.moments.bearLast;
  const roll = r(), at = BEAR.atCast[Math.floor(r() * BEAR.atCast.length)], kind = BEAR.kinds[Math.floor(r() * BEAR.kinds.length)];
  const bear = !was && roll < 1 / (BEAR.oneIn - 1) ? { at, kind } : null;     // (1 in 7 after a session without one, so about 1 in 8 overall)
  J.moments.bearLast = !!bear;
  return bear;
}
/** The child chose ('wait' | 'spot'): counted (J.totals.bearsSeen, bearWaits, bearMoves). Nothing is lost either way. */
export function bearChoice(J, choice) {
  const T = J.totals || (J.totals = {});
  T.bearsSeen = (T.bearsSeen | 0) + 1;
  if (choice === 'spot') T.bearMoves = (T.bearMoves | 0) + 1; else T.bearWaits = (T.bearWaits | 0) + 1;
  return { choice: choice === 'spot' ? 'spot' : 'wait' };
}

/** A fish wiggled off the hook: the cast is cast again once (retries < FISHING.retriesPerCast) with a fresh fight, so a session always has its
 *  four tries. { retry, fight? } — the cast's fight is replaced. A second wiggle-off just uses the cast. */
export function castOff(J, session, i) {
  const c = session && session.casts && session.casts[i];
  if (!c || c.kind !== 'fish') return { retry: false };
  if (J && J.totals) J.totals.fishOff = (J.totals.fishOff | 0) + 1;
  if ((c.retries | 0) >= FISHING.retriesPerCast) return { retry: false };
  c.retries = (c.retries | 0) + 1;
  c.fight = layFight(FISH_BY_ID[c.species], mulberry32(hashSeed(session.id, i, c.retries, 'retry')), FISH_BY_ID[c.species].help);
  return { retry: true, fight: c.fight };
}

const pushHappened = (J, k) => { const t = J.trip; if (t && Array.isArray(t.happened) && !t.happened.includes(k)) t.happened.push(k); };

/** A cast is landed (a fish reeled in, or junk pulled up). A fish is logged (J.fishLog: n, the biggest in inches with its pounds, where it
 *  was first caught; J.fishBest follows the biggest inches of all), counted in the session's pounds (the cap is applied at the end), in
 *  totals.fishCaught and, for the sturgeon, totals.sturgeon. Junk is counted in J.fishJunk (the boot is a laugh, the turtle is let go, the
 *  bottle starts its quest). Landing the same cast twice changes nothing the second time.
 *  → { kind, species?, junk?, name, lengthIn?, lb, firstSpecies, best, card?, quest?, released? } (card: the species' card id, on the first catch). */
export function landCast(J, session, i) {
  const c = session && session.casts && session.casts[i];
  if (!c) return null;
  if (session.results && session.results[i]) return session.results[i];
  if (!session.results) session.results = {};
  let out;
  if (c.kind === 'fish') {
    const sp = FISH_BY_ID[c.species];
    if (!J.fishLog || typeof J.fishLog !== 'object') J.fishLog = {};
    const rec = J.fishLog[c.species];
    const firstSpecies = !rec || !(rec.n > 0);
    const cur = rec || { n: 0, bestIn: 0, bestLb: 0, firstLeg: J.legId || null, firstSeason: J.season || null };
    cur.n = (cur.n | 0) + 1;
    if (c.lengthIn > num(cur.bestIn)) { cur.bestIn = c.lengthIn; cur.bestLb = c.lb; }
    if (firstSpecies) { cur.firstLeg = J.legId || null; cur.firstSeason = J.season || null; }
    J.fishLog[c.species] = cur;
    const best = c.lengthIn > num(J.fishBest && J.fishBest.in);
    if (best) J.fishBest = { species: c.species, in: c.lengthIn };
    session.lb = (session.lb | 0) + c.lb;
    if (J.totals) { J.totals.fishCaught = (J.totals.fishCaught | 0) + 1; if (sp && sp.onePerSession) J.totals.sturgeon = (J.totals.sturgeon | 0) + 1; }
    if (sp && sp.onePerSession) pushHappened(J, 'sturgeon');
    out = { kind: 'fish', species: c.species, name: sp ? sp.name : c.species, lengthIn: c.lengthIn, lb: c.lb, firstSpecies, best, ...(firstSpecies && sp ? { card: sp.card } : {}) };
  } else {
    const jd = JUNK_BY_ID[c.junk] || { id: c.junk, name: 'something' };
    if (!J.fishJunk || typeof J.fishJunk !== 'object') J.fishJunk = {};
    J.fishJunk[jd.id] = (J.fishJunk[jd.id] | 0) + 1;
    if (J.totals) J.totals.fishJunk = (J.totals.fishJunk | 0) + 1;
    if (jd.id === 'boot') pushHappened(J, 'fish-boot');
    out = { kind: 'junk', junk: jd.id, name: jd.name, lb: 0, firstSpecies: false, best: false };
    if (jd.release) out.released = true;
    if (jd.quest) {
      const got = hooks.findQuestItem(J, jd.quest);
      if (got) out.quest = { id: got.quest.id, item: got.item };
    }
  }
  session.results[i] = out;
  return out;
}

// ---- the summary ("Two channel catfish and an old boot. Twelve pounds of fish for the wagon.") ----
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** A number up to 999 in words (the summary is spoken, so it has no digits). */
export function wordsOf(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + wordsOf(n % 100) : '');
  return String(n);
}
const lowerFirst = (s) => (/^Chinook/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const SAME_PLURAL = /(fish|trout|salmon|sturgeon)$/i;
const pluralOf = (s) => (SAME_PLURAL.test(s) ? s : /s$/i.test(s) ? s : s + 's');
function pluralPhrase(phrase) {
  const bare = phrase.replace(/^(an?|the)\s+/i, '');
  const m = bare.match(/^(.*?)(\s+with\s+.*)?$/i);
  return pluralOf(m[1]) + (m[2] || '');
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const joinList = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

/** Everything about a finished session that does not touch the wagon (the sim's endFishing adds the food): the catch (in landing order), the
 *  junk, the new species, the best fish, the pounds (capped at FISHING.lbCap) and the spoken summary text from fixed parts. */
export function summarizeSession(J, session, lb) {
  const order = Object.keys(session.results || {}).map(Number).sort((a, b) => a - b).map((i) => session.results[i]);
  const caught = order.filter((r) => r.kind === 'fish').map((r) => ({ species: r.species, lengthIn: r.lengthIn }));
  const junk = order.filter((r) => r.kind === 'junk').map((r) => r.junk);
  const newSpecies = order.filter((r) => r.firstSpecies).map((r) => r.species);
  const best = order.some((r) => r.best);
  const bySpecies = new Map();
  for (const c of caught) bySpecies.set(c.species, (bySpecies.get(c.species) || 0) + 1);
  const parts = [];
  for (const [id, n] of bySpecies) { const nm = lowerFirst((FISH_BY_ID[id] || { name: id }).name); parts.push(n === 1 ? `${/^[aeiou]/i.test(nm) ? 'an' : 'a'} ${nm}` : `${wordsOf(n)} ${pluralOf(nm)}`); }
  const byJunk = new Map();
  for (const id of junk) byJunk.set(id, (byJunk.get(id) || 0) + 1);
  for (const [id, n] of byJunk) { const nm = lowerFirst((JUNK_BY_ID[id] || { name: 'something' }).name); parts.push(n === 1 ? nm : `${wordsOf(n)} ${pluralPhrase(nm)}`); }
  let text;
  const pounds = lb === 1 ? 'one pound' : `${wordsOf(lb)} pounds`;
  if (!parts.length) text = lb > 0 ? `${cap(pounds)} of fish for the wagon.` : 'No bites this time. The river has more.';
  else text = `${cap(joinList(parts))}. ${lb > 0 ? `${cap(pounds)} of fish for the wagon.` : 'No fish for the wagon this time.'}`;
  return { caught, junk, newSpecies, best, summary: { text, say: text } };
}

/** The pounds a session is worth before the safety net: the landed fish, at most FISHING.lbCap. */
export const sessionLb = (session) => Math.min(FISHING.lbCap, Math.max(0, session ? session.lb | 0 : 0));

/** The safety net's pounds: a rescue session is worth at least RESCUE.minLb. */
export const rescueFloor = (lb, rescue) => (rescue ? Math.max(lb, RESCUE.minLb) : lb);

// ---- the family's records ----
/** The biggest of each species in the family: players = [{ playerId, name, J }] → { [speciesId]: { name, playerId, lengthIn } }. Ties keep the
 *  earlier player. Pure: the app reads the family's saves. */
export function familyRecords(players) {
  const out = {};
  for (const p of Array.isArray(players) ? players : []) {
    const log = p && p.J && p.J.fishLog;
    if (!log || typeof log !== 'object') continue;
    for (const [sp, r] of Object.entries(log)) {
      const inch = num(r && r.bestIn);
      if (inch > 0 && (!out[sp] || inch > out[sp].lengthIn)) out[sp] = { name: p.name, playerId: p.playerId, lengthIn: inch };
    }
  }
  return out;
}
/** The skipping-stones board: the family's best skips by player, best first (ties keep the earlier player); players who have not skipped
 *  yet are left out. → [{ name, playerId, best }]. */
export function skipsBoard(players) {
  const rows = [];
  (Array.isArray(players) ? players : []).forEach((p, i) => {
    const best = num(p && p.J && p.J.skips && p.J.skips.best);
    if (best > 0) rows.push({ name: p.name, playerId: p.playerId, best, i });
  });
  return rows.sort((a, b) => b.best - a.best || a.i - b.i).map(({ name, playerId, best }) => ({ name, playerId, best }));
}
