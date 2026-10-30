// Trail Blazer's family sync (SPEC v1.6): the two per-player kinds it adds to Spell Jump's sync client
// (car-jump/src/sync/client.js registerSyncKind) and their merge rules. Pure: no DOM, no storage, no network.
//   <id>.tb     the save (trailBlazer.<id>.save)
//   <id>.facts  the math facts (trailBlazer.<id>.facts)
// A merge runs when both this device and the server changed the same key (a 409 on push, a pull while local changes
// wait, Join). local / remote = { updatedAt, data } with data in its stored form; the result is in stored form too.
// Both sides are normalized first (older versions migrate the same way they load), the later doc is the base, and
// nothing a child earned is lost: no purchase, no fact record, no day.
//
// tb save   cash max · vehicles owned = union, levels = per-upgrade max · vehicle / paint / decal / equipped gear /
//           daily / weekend = the later doc · cosmetics owned = union · best / records / finished = max · bestPlace /
//           bestTime = min · medals = the better · stars = per-trail OR · cups = the better trophy, max points, max
//           weekends · crates earned / opened / sinceNew = max, the longer waiting queue · streak = Spell Jump's rule
//           (mergeStreak) · rivals = max tier, retired = union, beats = max · ghosts = the faster trace per trail ·
//           seen = OR · play = per day max · hill = per-field max · summits = union · resetAt: a reset on one device
//           wins whole.
// facts     records per fact: base = the later lastSeen; attempts / firstTry / quick / misses / fixed / seenCount /
//           totalMs / answeredMs = max; box = the base's unless the other answered it the same day with a higher box;
//           day lists = union (the last 12); times = the base's; patterns = union by `at` (newest 6); recent = union by
//           `at` (newest 8); missDay = the later. Store: xp max; placement = the later `at`; scouts = per-family max;
//           vouched / stepped = union (the earliest `at`); gateLog / dialHistory = union by `at` (12 / 20); races =
//           union by `at` (40); today = the same day → max counts, else the later day; sets = the later
//           sets.updatedAt; pulled = union; the frontier is recomputed. A reset (resetAt) on one device wins whole.
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { mergeStreak } from '../../../spell-jump/src/sync/merge.js';
import { normalize as normalizeSave, saveKey, storedSave } from './save.js';
import { compactFacts, factsKey, normalizeFacts, refreshFrontier } from '../facts/store.js';
import { DAYS_KEPT, RECENT_KEPT } from '../facts/scheduler.js';
import { PATTERNS_KEPT } from '../facts/patterns.js';
import { MEDAL_RANK } from '../data/medals.js';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const uniq = (...arrs) => { const out = []; for (const a of arrs) for (const x of Array.isArray(a) ? a : []) if (!out.includes(x)) out.push(x); return out; };
// the later of two { updatedAt, data } (a tie is broken by content, so both devices pick the same one)
function laterDoc(a, b) {
  if (num(a.updatedAt) !== num(b.updatedAt)) return num(a.updatedAt) > num(b.updatedAt) ? a : b;
  return JSON.stringify(a.data) >= JSON.stringify(b.data) ? a : b;
}
const TROPHY_RANK = { gold: 3, silver: 2, bronze: 1 };

// ---------- the Trail Blazer save ----------
/** local / remote: { updatedAt, data } (data = a stored save). Returns the merged save in stored form. */
export function mergeTb(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: local.updatedAt, data: normalizeSave(clone(local.data)) };
  const B = { updatedAt: remote.updatedAt, data: normalizeSave(clone(remote.data)) };
  const ra = num(A.data.resetAt), rb = num(B.data.resetAt);
  if (ra !== rb) return storedSave(ra > rb ? A.data : B.data);
  const baseDoc = laterDoc(A, B);
  const s = clone(baseDoc.data), o = (baseDoc === A ? B : A).data;
  s.cash = Math.max(num(s.cash), num(o.cash));
  for (const [id, v] of Object.entries(obj(o.vehicles))) {
    if (!v || !v.owned) continue;
    const mine = s.vehicles[id] || (s.vehicles[id] = { owned: true, levels: clone(v.levels) });
    mine.owned = true;
    for (const [k, lv] of Object.entries(obj(v.levels))) mine.levels[k] = Math.max(num(mine.levels[k]), num(lv));
  }
  for (const [k, list] of Object.entries(obj(o.cosmetics && o.cosmetics.owned))) s.cosmetics.owned[k] = uniq(s.cosmetics.owned[k], list);
  for (const key of ['best', 'finished']) for (const [k, v] of Object.entries(obj(o[key]))) s[key][k] = Math.max(num(s[key][k]), num(v));
  for (const [k, v] of Object.entries(obj(o.records))) s.records[k] = Math.max(num(s.records[k]), num(v));
  for (const [k, v] of Object.entries(obj(o.bestPlace))) s.bestPlace[k] = s.bestPlace[k] ? Math.min(s.bestPlace[k], num(v)) : num(v);
  for (const [k, v] of Object.entries(obj(o.bestTime))) if (num(v) > 0) s.bestTime[k] = s.bestTime[k] ? Math.min(s.bestTime[k], num(v)) : num(v);
  for (const [k, m] of Object.entries(obj(o.medals))) if ((MEDAL_RANK[m] || 0) > (MEDAL_RANK[s.medals[k]] || 0)) s.medals[k] = m;
  for (const [k, v] of Object.entries(obj(o.stars))) { const mine = s.stars[k] || [false, false, false]; s.stars[k] = [0, 1, 2].map((i) => !!mine[i] || !!(v && v[i])); }
  for (const [k, c] of Object.entries(obj(o.cups))) {
    const mine = s.cups[k] || { best: 0, trophy: null, weekends: 0 };
    s.cups[k] = { best: Math.max(num(mine.best), num(c.best)), weekends: Math.max(num(mine.weekends), num(c.weekends)),
      trophy: (TROPHY_RANK[c.trophy] || 0) > (TROPHY_RANK[mine.trophy] || 0) ? c.trophy : mine.trophy || null };
  }
  const ca = obj(s.crates), cb = obj(o.crates);
  s.crates = { queue: (cb.queue || []).length > (ca.queue || []).length ? clone(cb.queue) : clone(ca.queue || []),
    earned: Math.max(num(ca.earned), num(cb.earned)), opened: Math.max(num(ca.opened), num(cb.opened)), sinceNew: Math.max(num(ca.sinceNew), num(cb.sinceNew)) };
  s.streak = mergeStreak(s.streak, o.streak);
  const va = obj(s.rivals), vb = obj(o.rivals);
  s.rivals = { tier: Math.max(num(va.tier), num(vb.tier)), retired: uniq(va.retired, vb.retired), beats: { ...obj(vb.beats) } };
  for (const [k, n] of Object.entries(obj(va.beats))) s.rivals.beats[k] = Math.max(num(n), num(s.rivals.beats[k]));
  const end = (g) => (Array.isArray(g) && g.length ? num(g[g.length - 1][0]) : Infinity);
  for (const [k, g] of Object.entries(obj(o.ghosts))) if (!s.ghosts[k] || end(g) < end(s.ghosts[k])) s.ghosts[k] = clone(g);
  s.seen = { ...obj(s.seen), coach: !!(obj(s.seen).coach || obj(o.seen).coach) };
  for (const [day, p] of Object.entries(obj(o.play))) {
    const mine = s.play[day] || {};
    s.play[day] = { races: Math.max(num(mine.races), num(p.races)), stars: Math.max(num(mine.stars), num(p.stars)), crates: Math.max(num(mine.crates), num(p.crates)) };
    if (Math.max(num(mine.streak), num(p.streak))) s.play[day].streak = Math.max(num(mine.streak), num(p.streak));
  }
  const ha = obj(s.hill), hb = obj(o.hill);
  s.hill = Object.fromEntries(['climbs', 'summits', 'bestHeightM', 'flags'].map((k) => [k, Math.max(num(ha[k]), num(hb[k]))]));
  for (const [k, v] of Object.entries(obj(o.summits))) if (v) s.summits[k] = true;
  if (Math.max(ra, rb) > 0) s.resetAt = Math.max(ra, rb);
  return storedSave(normalizeSave(s));
}

// ---------- the math facts ----------
const byAt = (list, n, key = (x) => num(x.at)) => {
  const seen = new Map();
  for (const x of list) if (x != null && !seen.has(JSON.stringify(x))) seen.set(JSON.stringify(x), x);
  return [...seen.values()].sort((a, b) => key(a) - key(b)).slice(-n);
};
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const COUNTERS = ['attempts', 'firstTry', 'quick', 'misses', 'fixed', 'seenCount', 'totalMs', 'answeredMs'];
/** One fact answered on two devices: nothing either device counted is lost. */
export function mergeRecord(a, b) {
  if (!a) return clone(b);
  if (!b) return clone(a);
  const later = num(a.lastSeen) !== num(b.lastSeen) ? (num(a.lastSeen) > num(b.lastSeen) ? a : b) : num(a.attempts) !== num(b.attempts) ? (num(a.attempts) > num(b.attempts) ? a : b) : JSON.stringify(a) >= JSON.stringify(b) ? a : b;
  const other = later === a ? b : a;
  const r = clone(later);
  for (const k of COUNTERS) r[k] = Math.max(num(a[k]), num(b[k]));
  if (sameDay(num(other.lastSeen), num(later.lastSeen)) && num(other.box) > num(later.box)) { r.box = other.box; r.due = other.due; }
  for (const k of ['daysSeen', 'daysCorrect', 'daysQuick']) r[k] = uniq(a[k], b[k]).sort().slice(-DAYS_KEPT);
  r.patterns = byAt([...(a.patterns || []), ...(b.patterns || [])], PATTERNS_KEPT);
  r.recent = byAt([...(a.recent || []), ...(b.recent || [])], RECENT_KEPT, (x) => num(x[0]));
  r.missDay = [a.missDay || '', b.missDay || ''].sort().pop();
  r.lastSeen = Math.max(num(a.lastSeen), num(b.lastSeen));
  return r;
}
const earliestAt = (x, y) => (num(x) && num(y) ? Math.min(num(x), num(y)) : num(x) || num(y));

/** local / remote: { updatedAt, data } (data = a stored facts store). Returns the merged store in stored form. */
export function mergeFactsDocs(local, remote, now = Date.now()) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: local.updatedAt, data: normalizeFacts(clone(local.data), now) };
  const B = { updatedAt: remote.updatedAt, data: normalizeFacts(clone(remote.data), now) };
  const ra = num(A.data.resetAt), rb = num(B.data.resetAt);
  if (ra !== rb) return compactFacts(ra > rb ? A.data : B.data);
  const baseDoc = laterDoc(A, B);
  const d = clone(baseDoc.data), o = (baseDoc === A ? B : A).data;
  // records
  for (const [f, r] of Object.entries(o.records)) d.records[f] = mergeRecord(d.records[f], r);
  d.xp = Math.max(num(d.xp), num(o.xp));
  if (o.placement && (!d.placement || num(o.placement.at) > num(d.placement.at))) d.placement = clone(o.placement);
  for (const [k, v] of Object.entries(o.scouts)) { const m = d.scouts[k] || {}; d.scouts[k] = { asked: Math.max(num(m.asked), num(v.asked)), quick: Math.max(num(m.quick), num(v.quick)), miss: Math.max(num(m.miss), num(v.miss)) }; }
  for (const [k, at] of Object.entries(o.vouched)) d.vouched[k] = earliestAt(d.vouched[k], at);
  for (const [k, v] of Object.entries(o.stepped)) if (!d.stepped[k] || num(v.at) < num(d.stepped[k].at)) d.stepped[k] = clone(v);
  d.gateLog = byAt([...d.gateLog, ...o.gateLog], 12, (x) => num(x[0]));
  d.dialHistory = byAt([...d.dialHistory, ...o.dialHistory], 20);
  d.races = byAt([...d.races, ...o.races], 40);
  for (const [k, v] of Object.entries(o.pulled)) d.pulled[k] = Math.max(num(d.pulled[k]), num(v));
  if (d.today.date === o.today.date) {
    d.today = { date: d.today.date, count: Math.max(d.today.count, o.today.count), newCount: Math.max(d.today.newCount, o.today.newCount), missionPaid: d.today.missionPaid || o.today.missionPaid };
  } else if (o.today.date > d.today.date) d.today = clone(o.today);
  if (num(o.sets.updatedAt) > num(d.sets.updatedAt)) { d.sets = clone(o.sets); d.opts = clone(o.opts); }
  for (const k of ['raceCount', 'checkOffers', 'lastCheckOfferAt', 'lastProbeAt']) d[k] = Math.max(num(d[k]), num(o[k]));
  refreshFrontier(d, now, '');
  return compactFacts(normalizeFacts(d, now));
}

// ---------- registration ----------
let registered = false;
/** Register Trail Blazer's kinds with Spell Jump's sync client (before createSyncClient). Safe to call twice. */
export function registerTrailBlazerSync() {
  if (registered) return;
  registered = true;
  registerSyncKind('tb', { storageKey: saveKey, merge: (k, local, remote) => mergeTb(local, remote) });
  registerSyncKind('facts', { storageKey: factsKey, merge: (k, local, remote) => mergeFactsDocs(local, remote) });
}
