// Wagon West's family sync (SPEC §12): the per-player kind it adds to Spell Jump's sync client
// (car-jump/src/sync/client.js registerSyncKind) and its merge rules, modelled on fraction-fright/src/skills/sync.js.
//   <id>.ww   the save (wagonWest.<id>.save)
// It also registers Trail Blazer's kinds (<id>.tb, <id>.facts) through trail-blazer/src/meta/sync.js: mile markers
// write the child's Trail Blazer facts store (recordAnswer), and without the kind registered here a write from this
// game would not be marked for the family sync until Trail Blazer itself wrote the facts again. Spell Jump's `words`
// kind (river words and letters write it through recordSpell) is registered by the client itself.
// A merge runs when both this device and the server changed the same key. local / remote = { updatedAt, data }; both
// sides are normalized first, the later doc is the base, and nothing a child earned is lost. Pure: no DOM, no storage.
//
// ww save   a reset (resetAt) on one device wins whole · journey (and the leg in progress) = the later doc's (a
//           journey is played on one device at a time) with cash and tokens = max when both sides are on the same
//           journey (season + seed) · seasonsDone max · stickers union · letters union (the newest 36) · cosmetics
//           owned union, worn = the later doc's · crates earned / opened max, the longer waiting queue · streak =
//           Spell Jump's rule (mergeStreak) · play per day per field max · kinds per kind max · legsLog union (40) ·
//           homestead = the later doc's, else the other's · seen OR.
// v1.1      the trail cards (J.cards, the journey's): the union of both sides' cards whenever both have a journey (a
//           collection is never lost to "the later doc"), and the tokens the max, explicitly · the dog (J.dog, stored
//           by the app on the journey) kept from the other side when the later one has none · suitsDone union · the
//           daily challenge: the later doc's, claimed when either side claimed the same day's challenge.
// v1.5      the ledger (journeys union by id, the newest 60; year max; routesDone / branchesDone / trophies union; tiersDone and lifetime per field max),
//           the farm (sites union; per site the later doc's name, founded min, pieces per id max; savings / gold earned and spent counters each max, so a
//           spend on one device and an earning on the other both survive; animals max; log union) and setsDone (union) are the journey stream's mergeLedger /
//           mergeFarm / mergeWw15 (src/journey/seasons.js, homestead.js), every rule a union or a max, so a doc written by an older build (which drops
//           these fields) never erases them · cosmetics.owned.decor union, equipped.decor the later doc's (owned only) · seen.forks OR, seen.placeOffers
//           max · on the same journey gold max and branches union (the plan is rebuilt) · journeyResetAt max, and a journey last written before another
//           device's "Reset this journey only" stamp is dropped from the merge (the farm, the ledger, the cards and the sets are not touched).
// v1.6      the six choice moments (J.choices): on the same journey the union by id of both devices' (journey/choices.js mergeChoices); a record already on the later doc wins a clash.
// v1.4      after the rules above, merge14(s.journey, o.journey) (src/journey/collections.js, the Journey stream's: finds per id max,
//           fish log per species n max and the bigger fish, junk max, personal best the bigger, skips best / throws / per river max,
//           wishes and finished quests union, the longest fetch max; and, on the same journey, the further state of each quest, the
//           trail facts heard union, the spoon max): both devices end with both devices' records. Settings.farSounds is this device's.
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { mergeStreak } from '../../../spell-jump/src/sync/merge.js';
import { registerTrailBlazerSync } from '../../../trail-blazer/src/meta/sync.js';
import { LOOK_KINDS } from '../ui/looks.js';
import { PLAY_FIELDS, normalize, normalizeLegsLog, normalizeLetters, saveKey } from './save.js';
import * as Sim from '../journey/sim.js';          // (v1.4: merge14, the journey's own collections rules; a namespace import so an older journey module still loads)

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const uniq = (...arrs) => { const out = []; for (const a of arrs) for (const x of Array.isArray(a) ? a : []) if (!out.includes(x)) out.push(x); return out; };
function laterDoc(a, b) {
  if (num(a.updatedAt) !== num(b.updatedAt)) return num(a.updatedAt) > num(b.updatedAt) ? a : b;
  return JSON.stringify(a.data) >= JSON.stringify(b.data) ? a : b;
}
/** Two card collections in one: ids (an array) or counts by id (an object), whichever shape the journey keeps. */
export function unionCards(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return uniq(Array.isArray(a) ? a : Object.keys(a || {}), Array.isArray(b) ? b : Object.keys(b || {}));
  if (!a && !b) return a;
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) out[k] = Math.max(num(out[k]), num(v));
  return out;
}
const sameJourney = (x, y) => !!(x && y && x.season === y.season && String(x.seed) === String(y.seed));

export { mergeLedger, mergeFarm } from '../journey/sim.js';
export function mergeWw(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: local.updatedAt, data: normalize(clone(local.data)) };
  const B = { updatedAt: remote.updatedAt, data: normalize(clone(remote.data)) };
  const ra = num(A.data.resetAt), rb = num(B.data.resetAt);
  if (ra !== rb) return ra > rb ? A.data : B.data;
  // v1.5: "Reset this journey only" on one device: a journey last written before the stamp is dropped from the merge
  const jr = Math.max(num(A.data.journeyResetAt), num(B.data.journeyResetAt));
  if (jr) for (const X of [A, B]) if (num(X.data.journeyResetAt) < jr && num(X.updatedAt) < jr) { X.data.journey = null; X.data.trip = null; }
  const base = laterDoc(A, B);
  const s = clone(base.data), o = (base === A ? B : A).data;
  if (!s.journey && o.journey) { s.journey = clone(o.journey); s.trip = clone(o.trip); }
  else if (sameJourney(s.journey, o.journey)) {
    s.journey.cash = Math.max(num(s.journey.cash), num(o.journey.cash));
    s.journey.tokens = Math.max(num(s.journey.tokens), num(o.journey.tokens));
    // v1.6 (The Lab): the choice moments taken on either device (a union by id: a choice is resolved once and never lost)
    if (typeof Sim.mergeChoices === 'function') s.journey.choices = Sim.mergeChoices(s.journey.choices, o.journey.choices);
  }
  if (s.journey && o.journey) {
    s.journey.cards = unionCards(s.journey.cards, o.journey.cards);
    s.journey.tokens = Math.max(num(s.journey.tokens), num(o.journey.tokens));
    if (!s.journey.dog && o.journey.dog) s.journey.dog = clone(o.journey.dog);
    // v1.2: deeds earned and people met are collections too: the union of both sides
    for (const k of ['deeds', 'met']) if (s.journey[k] !== undefined || o.journey[k] !== undefined) s.journey[k] = unionCards(s.journey[k], o.journey[k]);
    // v1.4: the dog's finds, the fish log, the skipping stones, the wishes and the quests (the journey's own rules)
    if (typeof Sim.merge14 === 'function') {
      try {
        if (typeof Sim.ensureJourney === 'function') { Sim.ensureJourney(s.journey); Sim.ensureJourney(o.journey); }     // (both sides filled with the 1.4 fields)
        const m = Sim.merge14(s.journey, o.journey);                                                                    // (in place, or the merged journey returned)
        if (m && typeof m === 'object' && m !== s.journey && Number.isFinite(m.legIndex)) s.journey = m;
      } catch (e) { console.warn('[WagonWest] merge14', e); }
    }
  }
  s.suitsDone = uniq(s.suitsDone, o.suitsDone);
  if (o.daily && s.daily && o.daily.key === s.daily.key && o.daily.id === s.daily.id && o.daily.claimed) s.daily.claimed = true;
  s.seasonsDone = Math.max(s.seasonsDone, o.seasonsDone);
  s.stickers = uniq(s.stickers, o.stickers);
  s.letters = normalizeLetters([...s.letters, ...o.letters]);
  for (const k of LOOK_KINDS) s.cosmetics.owned[k] = uniq(s.cosmetics.owned[k], o.cosmetics.owned[k]);
  s.crates = { earned: Math.max(s.crates.earned, o.crates.earned), opened: Math.max(s.crates.opened, o.crates.opened),
    queue: (o.crates.queue.length > s.crates.queue.length ? o.crates.queue : s.crates.queue).slice() };
  s.streak = mergeStreak(s.streak, o.streak);
  for (const [day, p] of Object.entries(o.play)) {
    const m = s.play[day] || {};
    s.play[day] = Object.fromEntries(PLAY_FIELDS.map((f) => [f, Math.max(num(m[f]), num(p[f]))]));
  }
  for (const [k, v] of Object.entries(o.kinds)) {
    const m = s.kinds[k] || { n: 0, right: 0 };
    s.kinds[k] = { n: Math.max(m.n, v.n), right: Math.max(m.right, v.right) };
  }
  s.legsLog = normalizeLegsLog([...s.legsLog, ...o.legsLog]);
  if (!s.homestead && o.homestead) s.homestead = o.homestead;
  s.seen = { coach: !!(s.seen.coach || o.seen.coach), forks: { ...(o.seen.forks || {}), ...(s.seen.forks || {}) }, placeOffers: Math.max(num(s.seen.placeOffers), num(o.seen.placeOffers)), worked: { ...(o.seen.worked || {}), ...(s.seen.worked || {}) } };
  // v1.5: the ledger, the farm, the sets, the worn decorations, the forks chosen on either device (the journey stream's pure merge)
  if (typeof Sim.mergeWw15 === 'function') {
    try {
      const m = Sim.mergeWw15(s, o);
      s.ledger = m.ledger; s.farm = m.farm; s.setsDone = m.setsDone;
      s.cosmetics.equipped.decor = (m.cosmetics && m.cosmetics.equipped && m.cosmetics.equipped.decor) || s.cosmetics.equipped.decor;
      s.journeyResetAt = Math.max(num(s.journeyResetAt), num(o.journeyResetAt));
      if (s.journey && m.journey && sameJourney(s.journey, o.journey)) { s.journey.gold = Math.max(num(s.journey.gold), num(m.journey.gold)); if (m.journey.branches) s.journey.branches = m.journey.branches; if (m.journey.plan) s.journey.plan = m.journey.plan; }
    } catch (e) { console.warn('[WagonWest] mergeWw15', e); }
  }
  // the farm's name is also the 1.0 homestead name (an older build reads save.homestead)
  if (s.farm && s.farm.sites && s.farm.sites.willamette && s.farm.sites.willamette.name && !s.homestead) s.homestead = s.farm.sites.willamette.name.slice(0, 24);
  return normalize(s);
}

let registered = false;
/** Register Wagon West's kind (and Trail Blazer's) with Spell Jump's sync client, before createSyncClient. Safe to call twice. */
export function registerWagonWestSync() {
  if (registered) return;
  registered = true;
  registerSyncKind('ww', { storageKey: saveKey, merge: (k, local, remote) => mergeWw(local, remote) });
  registerTrailBlazerSync();
}
