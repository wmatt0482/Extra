// Fraction Fright's family sync (SPEC §9): the two per-player kinds it adds to Spell Jump's sync client
// (car-jump/src/sync/client.js registerSyncKind) and their merge rules, modelled on trail-blazer/src/meta/sync.js.
// Pure: no DOM, no storage, no network.
//   <id>.ff     the save (fractionFright.<id>.save)
//   <id>.fracs  the fraction skills (fractionFright.<id>.skills)
// A merge runs when both this device and the server changed the same key. local / remote = { updatedAt, data }; both
// sides are normalized first, the later doc is the base, and nothing a child earned is lost.
//
// ff save   a reset (resetAt) on one device wins whole · cash / cures / bulls / pumpkins / waves = max · streets: cleared
//           = max, the next wave = the one of the side that cleared more (same: max) · yard: owned = union, the goo and
//           fence worn = the later doc's · records = max · seen = OR · play = per day max
// fracs     a reset wins whole · xp = max · lab: done = the earliest, runs = max · opened = the earliest per street ·
//           records per tier + kind = the union of throws by time (the last 12) · fracs per fraction = the side with
//           more throws (counts and PAE sum together; a tie: the later last throw) · days = per day the side with more
//           throws · waves / moves = union by time (40 / 20) · opts = the later opts.updatedAt
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { normalize as normalizeSave, saveKey } from '../meta/save.js';
import { MOVES_KEPT, WAVES_KEPT, normalizeSkills, skillsKey } from './store.js';
import { RECORD_KEPT } from './ladder.js';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const uniq = (...arrs) => { const out = []; for (const a of arrs) for (const x of Array.isArray(a) ? a : []) if (!out.includes(x)) out.push(x); return out; };
function laterDoc(a, b) {
  if (num(a.updatedAt) !== num(b.updatedAt)) return num(a.updatedAt) > num(b.updatedAt) ? a : b;
  return JSON.stringify(a.data) >= JSON.stringify(b.data) ? a : b;
}
const byAt = (list, n) => {
  const seen = new Map();
  for (const x of list) if (x != null && !seen.has(JSON.stringify(x))) seen.set(JSON.stringify(x), x);
  return [...seen.values()].sort((a, b) => num(a.at) - num(b.at)).slice(-n);
};
const earliest = (x, y) => (num(x) && num(y) ? Math.min(num(x), num(y)) : num(x) || num(y));

// ---------- the save ----------
export function mergeFf(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: local.updatedAt, data: normalizeSave(clone(local.data)) };
  const B = { updatedAt: remote.updatedAt, data: normalizeSave(clone(remote.data)) };
  const ra = num(A.data.resetAt), rb = num(B.data.resetAt);
  if (ra !== rb) return ra > rb ? A.data : B.data;
  const base = laterDoc(A, B);
  const s = clone(base.data), o = (base === A ? B : A).data;
  for (const k of ['cash', 'cures', 'bulls', 'pumpkins', 'waves']) s[k] = Math.max(num(s[k]), num(o[k]));
  for (const [id, v] of Object.entries(o.streets)) {
    const m = s.streets[id];
    if (!m) { s.streets[id] = clone(v); continue; }
    s.streets[id] = { cleared: Math.max(m.cleared, v.cleared), wave: m.cleared !== v.cleared ? (m.cleared > v.cleared ? m.wave : v.wave) : Math.max(m.wave, v.wave) };
  }
  for (const kind of Object.keys(s.yard.owned)) s.yard.owned[kind] = uniq(s.yard.owned[kind], o.yard.owned[kind]);
  for (const k of Object.keys(s.records)) s.records[k] = Math.max(num(s.records[k]), num(o.records[k]));
  s.seen = { coach: !!(s.seen.coach || o.seen.coach) };
  for (const [day, p] of Object.entries(o.play)) { const m = s.play[day] || {}; s.play[day] = { waves: Math.max(num(m.waves), num(p.waves)), cures: Math.max(num(m.cures), num(p.cures)) }; }
  return normalizeSave(s);
}

// ---------- the skills ----------
export function mergeFracs(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: local.updatedAt, data: normalizeSkills(clone(local.data)) };
  const B = { updatedAt: remote.updatedAt, data: normalizeSkills(clone(remote.data)) };
  const ra = num(A.data.resetAt), rb = num(B.data.resetAt);
  if (ra !== rb) return ra > rb ? A.data : B.data;
  const base = laterDoc(A, B);
  const d = clone(base.data), o = (base === A ? B : A).data;
  d.xp = Math.max(d.xp, o.xp);
  d.lab = { done: earliest(d.lab.done, o.lab.done), runs: Math.max(d.lab.runs, o.lab.runs) };
  for (const [t, at] of Object.entries(o.opened)) d.opened[t] = earliest(d.opened[t], at);
  for (const [key, list] of Object.entries(o.records)) {
    const all = [...(d.records[key] || []), ...list].map((x) => ({ at: x[0], x }));
    d.records[key] = byAt(all, RECORD_KEPT).map((y) => y.x);
  }
  for (const [k, f] of Object.entries(o.fracs)) {
    const m = d.fracs[k];
    if (!m || f.n > m.n || (f.n === m.n && f.last > m.last)) d.fracs[k] = clone(f);
  }
  for (const [k, v] of Object.entries(o.days)) { const m = d.days[k]; if (!m || v.throws > m.throws) d.days[k] = clone(v); }
  d.waves = byAt([...d.waves, ...o.waves], WAVES_KEPT);
  d.moves = byAt([...d.moves, ...o.moves], MOVES_KEPT);
  if (o.opts.updatedAt > d.opts.updatedAt) d.opts = clone(o.opts);
  d.updatedAt = Math.max(num(d.updatedAt), num(o.updatedAt));
  return normalizeSkills(d);
}

let registered = false;
/** Register Fraction Fright's kinds with Spell Jump's sync client (before createSyncClient). Safe to call twice. */
export function registerFractionFrightSync() {
  if (registered) return;
  registered = true;
  registerSyncKind('ff', { storageKey: saveKey, merge: (k, local, remote) => mergeFf(local, remote) });
  registerSyncKind('fracs', { storageKey: skillsKey, merge: (k, local, remote) => mergeFracs(local, remote) });
}
