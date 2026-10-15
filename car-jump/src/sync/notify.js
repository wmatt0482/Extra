// Local-write notifications for family sync. profiles.js and save.js call localWrite(storageKey) after every
// successful localStorage write of the family record, a player's save or a player's words; the sync client
// (src/sync/client.js) subscribes and marks the matching key dirty. No subscriber = no cost (sync off).
const subs = new Set();
export function onLocalWrite(fn) { subs.add(fn); return () => subs.delete(fn); }
export function localWrite(storageKey) {
  for (const fn of subs) { try { fn(storageKey); } catch (e) { console.warn('[sync] write hook failed', e); } }
}
