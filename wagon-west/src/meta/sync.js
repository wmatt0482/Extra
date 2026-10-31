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
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { mergeStreak } from '../../../spell-jump/src/sync/merge.js';
import { registerTrailBlazerSync } from '../../../trail-blazer/src/meta/sync.js';
import { LOOK_KINDS } from '../ui/looks.js';
import { PLAY_FIELDS, normalize, normalizeLegsLog, normalizeLetters, saveKey } from './save.js';

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

export function mergeWw(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: local.updatedAt, data: normalize(clone(local.data)) };
  const B = { updatedAt: remote.updatedAt, data: normalize(clone(remote.data)) };
  const ra = num(A.data.resetAt), rb = num(B.data.resetAt);
  if (ra !== rb) return ra > rb ? A.data : B.data;
  const base = laterDoc(A, B);
  const s = clone(base.data), o = (base === A ? B : A).data;
  if (!s.journey && o.journey) { s.journey = clone(o.journey); s.trip = clone(o.trip); }
  else if (sameJourney(s.journey, o.journey)) {
    s.journey.cash = Math.max(num(s.journey.cash), num(o.journey.cash));
    s.journey.tokens = Math.max(num(s.journey.tokens), num(o.journey.tokens));
  }
  if (s.journey && o.journey) {
    s.journey.cards = unionCards(s.journey.cards, o.journey.cards);
    s.journey.tokens = Math.max(num(s.journey.tokens), num(o.journey.tokens));
    if (!s.journey.dog && o.journey.dog) s.journey.dog = clone(o.journey.dog);
    // v1.2: deeds earned and people met are collections too: the union of both sides
    for (const k of ['deeds', 'met']) if (s.journey[k] !== undefined || o.journey[k] !== undefined) s.journey[k] = unionCards(s.journey[k], o.journey[k]);
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
  s.seen = { coach: !!(s.seen.coach || o.seen.coach) };
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
