// Connects Build Crew's save to the shared family sync. registerSync() must run before the shared client is created so
// that the family's existing sync carries this game's document (kind 'bc'); writeSave() is the one place a save is
// written, and it marks the key for the next sync.
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { localWrite } from '../../../spell-jump/src/sync/notify.js';
import { saveKey, normalize, mergeBc } from './save.mjs';
export function registerSync() {
  registerSyncKind('bc', { storageKey: saveKey, merge: (_, a, b) => mergeBc(a, b), canon: normalize });
}
/** Writes a normalized save; returns false (and leaves the previous save intact) when storage refuses. */
export function writeSave(id, save) {
  if (!id) return false;
  try {
    localStorage.setItem(saveKey(id), JSON.stringify(normalize(save)));
    localWrite(saveKey(id));
    return true;
  } catch {
    return false;
  }
}
