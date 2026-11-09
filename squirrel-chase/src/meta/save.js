// Squirrel Chase's save, per player: `squirrelChase.<playerId>.save` (SPEC §7), synced as the `sq` kind. Device settings (sound, calm motion)
// live at `squirrelChase.settings`; the case in progress is device-local at `squirrelChase.<playerId>.wip` (not synced). The family (players,
// PIN, family code, family music) is Spell Jump's record, read and written only through spell-jump/src/spelling/profiles.js; the words are
// Spell Jump's store (profiles.loadWords / writeWords). Same rules as the other games' saves: every localStorage access is wrapped, a corrupt
// save is kept aside at `<key>.corrupt`, a save from a newer version is not misread, writes tell the family sync (notify.js localWrite).
//   { v:1, opened:{caseId:day}, closed:{caseId:{day, at, words:[...], hideout:{correct,total}}}, album:[cityIds], nextEarly, updatedAt }
import { localWrite } from '../../../spell-jump/src/sync/notify.js';

export const SAVE_VERSION = 1;
export const SETTINGS_KEY = 'squirrelChase.settings';
export const saveKey = (playerId) => `squirrelChase.${playerId}.save`;
export const wipKey = (playerId) => `squirrelChase.${playerId}.wip`;
export const MAX_WORDS = 24;

export const defaultSave = () => ({ v: SAVE_VERSION, opened: {}, closed: {}, album: [], nextEarly: false, updatedAt: 0 });
export const defaultSettings = () => ({ sound: true, reducedMotion: false });

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int0 = (v, max = 1e9) => Math.max(0, Math.min(max, Math.floor(num(v))));
const ID = /^[A-Za-z0-9_-]{1,48}$/;
const DAY = /^\d{4}-\d\d-\d\d$/;
const WORD = /^[a-z'-]{1,24}$/;
const own = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).filter(([k]) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype') : []);

export function normalizeClosed(r) {
  const o = r && typeof r === 'object' ? r : {};
  const total = int0(o.hideout && o.hideout.total, 9);
  return {
    day: DAY.test(o.day) ? o.day : '', at: int0(o.at, 1e14),
    words: (Array.isArray(o.words) ? o.words : []).filter((w) => typeof w === 'string' && WORD.test(w)).slice(0, MAX_WORDS),
    hideout: { correct: Math.min(total, int0(o.hideout && o.hideout.correct, 9)), total },
  };
}

export function normalize(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  for (const [id, day] of own(raw.opened)) if (ID.test(id) && DAY.test(day)) s.opened[id] = day;
  for (const [id, rec] of own(raw.closed)) if (ID.test(id)) { s.closed[id] = normalizeClosed(rec); if (!s.opened[id] && DAY.test(s.closed[id].day)) s.opened[id] = s.closed[id].day; }
  const seen = new Set();
  for (const c of Array.isArray(raw.album) ? raw.album : []) if (typeof c === 'string' && ID.test(c) && !seen.has(c)) { seen.add(c); s.album.push(c); }
  s.nextEarly = raw.nextEarly === true;
  s.updatedAt = int0(raw.updatedAt, 1e14);
  return s;
}

/** Merge two saves of one player (a device and the server, or two devices): opened = union (earliest day), closed = union (the record with the
 *  earliest `at` wins whole), album = union (this device's order first), nextEarly from the later updatedAt, updatedAt = the later. */
export function mergeSaves(a, b) {
  const A = normalize(a), B = normalize(b);
  const later = A.updatedAt >= B.updatedAt ? A : B;
  const out = defaultSave();
  for (const d of [A, B]) for (const [id, day] of Object.entries(d.opened)) if (!out.opened[id] || day < out.opened[id]) out.opened[id] = day;
  for (const id of new Set([...Object.keys(A.closed), ...Object.keys(B.closed)])) {
    const x = A.closed[id], y = B.closed[id];
    const win = !x ? y : !y ? x : (x.at && y.at ? (x.at <= y.at ? x : y) : (x.at ? x : y));
    out.closed[id] = JSON.parse(JSON.stringify(win));
    if (!out.opened[id] && win.day) out.opened[id] = win.day;
  }
  for (const c of [...A.album, ...B.album]) if (!out.album.includes(c)) out.album.push(c);
  out.nextEarly = later.nextEarly;
  out.updatedAt = Math.max(A.updatedAt, B.updatedAt);
  return normalize(out);
}

function readText(key) {
  try { return localStorage.getItem(key); } catch (e) { console.warn('[save] localStorage unavailable, playing without persistence', e); return null; }
}
export function loadSave(playerId) {
  if (!playerId) return defaultSave();
  const key = saveKey(playerId);
  const text = readText(key);
  if (!text) return defaultSave();
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || (raw.v !== undefined && raw.v > SAVE_VERSION)) throw new Error('bad shape');
    return normalize(raw);
  } catch (e) {
    console.warn(`[save] corrupt ${key}, starting fresh (backup kept)`, e);
    try { localStorage.setItem(key + '.corrupt', text); } catch (_) { /* ignore */ }
    return defaultSave();
  }
}
export function writeSave(playerId, save) {
  if (!playerId || !save) return false;
  // nothing changed since the last write: do not write (and so do not bump updatedAt or wake the family sync)
  try {
    const prev = readText(saveKey(playerId));
    if (prev && JSON.stringify({ ...normalize(JSON.parse(prev)), updatedAt: 0 }) === JSON.stringify({ ...normalize(save), updatedAt: 0 })) return true;
  } catch (_) { /* write it */ }
  save.updatedAt = Date.now();
  try { localStorage.setItem(saveKey(playerId), JSON.stringify(save)); } catch (e) { console.warn('[save] could not write', e); return false; }
  localWrite(saveKey(playerId));
  return true;
}
export function removeSave(playerId) { if (playerId) try { localStorage.removeItem(saveKey(playerId)); localStorage.removeItem(wipKey(playerId)); } catch (_) { /* ignore */ } }

// the case in progress (plain JSON; device-local)
export function loadWip(playerId) {
  if (!playerId) return null;
  try { const o = JSON.parse(readText(wipKey(playerId)) || 'null'); return o && typeof o === 'object' && typeof o.caseId === 'string' ? o : null; } catch (_) { return null; }
}
export function writeWip(playerId, run) { if (!playerId) return; try { if (run) localStorage.setItem(wipKey(playerId), JSON.stringify(run)); else localStorage.removeItem(wipKey(playerId)); } catch (_) { /* ignore */ } }

export function loadSettings() {
  const d = defaultSettings();
  const text = readText(SETTINGS_KEY);
  if (!text) return d;
  try { const raw = JSON.parse(text); for (const k of Object.keys(d)) if (typeof raw[k] === 'boolean') d[k] = raw[k]; } catch (_) { /* defaults */ }
  return d;
}
export function writeSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch (_) { return false; } }
