// Family sync for The Lab (lab/SPEC.md §3.4): the per-player kind `lab` it adds to Spell Jump's sync client
// (car-jump/src/sync/client.js registerSyncKind). <id>.lab is the child's lab doc (learningLab.<id>.lab). Server side: the kind is in
// PLAYER_KINDS in car-jump/src/sync/protocol.mjs. No game's sync module changes.
import { registerSyncKind } from '../../spell-jump/src/sync/client.js';
import { localWrite } from '../../spell-jump/src/sync/notify.js';
import { labKey, normalizeLab } from './core/model.js';
import { mergeLab } from './core/merge.js';

export { labKey, mergeLab };
let registered = false;
/** Register the `lab` kind with the sync client's registry. Safe to call twice. */
export function registerLabSync() {
  if (registered) return false;
  registerSyncKind('lab', { storageKey: labKey, merge: (k, local, remote) => mergeLab(local, remote), canon: (d) => normalizeLab(d, 0) });
  registered = true;
  return true;
}
/** Mark the family's existing lab docs as local writes, so a device that registered late still pushes them. */
export function markLabDocsDirty(playerIds) {
  for (const id of playerIds) { try { localWrite(labKey(id)); } catch (_) { /* ignore */ } }
}
