// Squirrel Chase's family sync (SPEC §7): the per-player `sq` kind added to Spell Jump's sync client (registerSyncKind) and its merge rule.
// Pure apart from the registration: no DOM, no storage, no network.
//   <id>.sq   the save (squirrelChase.<id>.save)
// A merge runs when both this device and the server changed the same key. local / remote = { updatedAt, data }. The rule is save.js's
// mergeSaves: opened and album are unions, a closed case keeps the record with the earliest `at`, nextEarly follows the later updatedAt.
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { mergeSaves, normalize, saveKey } from './save.js';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function mergeSq(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = normalize(clone(local.data)), B = normalize(clone(remote.data));
  if (!A.updatedAt) A.updatedAt = num(local.updatedAt);
  if (!B.updatedAt) B.updatedAt = num(remote.updatedAt);
  return mergeSaves(A, B);
}

let registered = false;
/** Register Squirrel Chase's kind with Spell Jump's sync client (before createSyncClient). Safe to call twice. */
export function registerSquirrelChaseSync() {
  if (registered) return;
  registered = true;
  registerSyncKind('sq', { storageKey: saveKey, merge: (k, local, remote) => mergeSq(local, remote) });
}
