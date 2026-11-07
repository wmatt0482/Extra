// Case Files' family sync (SPEC §6): the per-player `cf` kind added to Spell Jump's sync client (registerSyncKind) and its
// merge rule. Pure apart from the registration: no DOM, no storage, no network.
//   <id>.cf   the save (caseFiles.<id>.save)
// A merge runs when both this device and the server changed the same key. local / remote = { updatedAt, data }; both sides
// are normalized first. opened and closed are unions (the earliest day wins for an open day; for a closed case the record
// with the earliest `at` wins whole, its listen counts raised to the per-document maximum), wordsMet = per-word max,
// rank and nextEarly from the later updatedAt, updatedAt = the max.
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { normalize, saveKey } from './save.js';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function mergeCf(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = { updatedAt: num(local.updatedAt), data: normalize(clone(local.data)) };
  const B = { updatedAt: num(remote.updatedAt), data: normalize(clone(remote.data)) };
  const later = num(A.data.updatedAt) !== num(B.data.updatedAt) ? (num(A.data.updatedAt) > num(B.data.updatedAt) ? A : B)
    : num(A.updatedAt) !== num(B.updatedAt) ? (A.updatedAt > B.updatedAt ? A : B) : (JSON.stringify(A.data) >= JSON.stringify(B.data) ? A : B);
  const out = normalize({});
  out.rank = later.data.rank;
  out.readMode = later.data.readMode || 'auto';
  out.nextEarly = later.data.nextEarly;
  for (const d of [A.data, B.data]) for (const [id, day] of Object.entries(d.opened)) if (!out.opened[id] || day < out.opened[id]) out.opened[id] = day;
  for (const id of new Set([...Object.keys(A.data.closed), ...Object.keys(B.data.closed)])) {
    const a = A.data.closed[id], b = B.data.closed[id];
    const win = !a ? b : !b ? a : (a.at && b.at ? (a.at <= b.at ? a : b) : (a.at ? a : b));
    const rec = clone(win);
    for (const side of [a, b]) if (side) for (const [doc, n] of Object.entries(side.listens)) rec.listens[doc] = Math.max(num(rec.listens[doc]), n);
    out.closed[id] = rec;
    if (!out.opened[id] && rec.day) out.opened[id] = rec.day;
  }
  for (const d of [A.data, B.data]) for (const [w, n] of Object.entries(d.wordsMet)) out.wordsMet[w] = Math.max(num(out.wordsMet[w]), n);
  out.updatedAt = Math.max(num(A.data.updatedAt), num(B.data.updatedAt));
  return normalize(out);
}

let registered = false;
/** Register Case Files' kind with Spell Jump's sync client (before createSyncClient). Safe to call twice. */
export function registerCaseFilesSync() {
  if (registered) return;
  registered = true;
  registerSyncKind('cf', { storageKey: saveKey, merge: (k, local, remote) => mergeCf(local, remote) });
}
