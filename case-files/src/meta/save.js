// Case Files' save, per player: `caseFiles.<playerId>.save` (SPEC §6), synced as the `cf` kind. Device settings (sound,
// reduced motion) live at `caseFiles.settings`. The family (players, PIN, family code) is Spell Jump's record, read and
// written only through spell-jump/src/spelling/profiles.js. Same rules as the other games' saves: every localStorage
// access is wrapped (a blocked or corrupt store never breaks boot), a corrupt save is kept aside at `<key>.corrupt`, a save
// from a newer version is not misread, and writes tell the family sync (notify.js localWrite).
import { localWrite } from '../../../spell-jump/src/sync/notify.js';

export const SAVE_VERSION = 1;
export const SETTINGS_KEY = 'caseFiles.settings';
export const saveKey = (playerId) => `caseFiles.${playerId}.save`;
export const wipKey = (playerId) => `caseFiles.${playerId}.wip`;       // device-local: the case being worked on (not synced)

/** The step coach cards (v0.1.2): which ones this player has already been shown. */
export const HELP_KEYS = Object.freeze(['home', 'brief', 'read', 'pin', 'order', 'close']);
export const defaultSeenHelp = () => Object.fromEntries(HELP_KEYS.map((k) => [k, false]));
export const defaultSave = () => ({ v: SAVE_VERSION, rank: 4, readMode: 'auto', seenHelp: defaultSeenHelp(), opened: {}, closed: {}, nextEarly: false, wordsMet: {}, updatedAt: 0 });
export const defaultSettings = () => ({ sound: true, reducedMotion: false });

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int0 = (v, max = 1e9) => Math.max(0, Math.min(max, Math.floor(num(v))));
const stamp = (v) => int0(v, 1e14);                 // a millisecond timestamp
const ID = /^[A-Za-z0-9_-]{1,48}$/;
const DAY = /^\d{4}-\d\d-\d\d$/;
const own = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).filter(([k]) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype') : []);
const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '');

export function normalizeClosed(r) {
  const o = r && typeof r === 'object' ? r : {};
  const c = { day: DAY.test(o.day) ? o.day : '', at: stamp(o.at), firstTap: {}, hints: {}, timelineTries: int0(o.timelineTries), report: { who: '', because: '', clueId: '' }, listens: {} };
  for (const [k, v] of own(o.firstTap)) if (ID.test(k) && typeof v === 'boolean') c.firstTap[k] = v;
  for (const [k, v] of own(o.hints)) if (ID.test(k)) c.hints[k] = Math.min(3, int0(v));
  if (o.report && typeof o.report === 'object') c.report = { who: str(o.report.who, 80), because: str(o.report.because, 400), clueId: ID.test(o.report.clueId) ? o.report.clueId : '' };
  for (const [k, v] of own(o.listens)) if (ID.test(k)) c.listens[k] = int0(v);
  return c;
}

export function normalize(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  const rank = Math.floor(num(raw.rank, 4));
  s.rank = rank >= 1 && rank <= 6 ? rank : 4;
  s.readMode = ['auto', 'tap', 'off'].includes(raw.readMode) ? raw.readMode : 'auto';   // "Read it to me": by rank / only when tapped / off (v0.1.1)
  if (raw.seenHelp && typeof raw.seenHelp === 'object') for (const k of HELP_KEYS) s.seenHelp[k] = raw.seenHelp[k] === true;   // step coach cards already shown (v0.1.2)
  for (const [id, day] of own(raw.opened)) if (ID.test(id) && DAY.test(day)) s.opened[id] = day;
  for (const [id, rec] of own(raw.closed)) if (ID.test(id)) { s.closed[id] = normalizeClosed(rec); if (!s.opened[id] && DAY.test(s.closed[id].day)) s.opened[id] = s.closed[id].day; }
  s.nextEarly = raw.nextEarly === true;
  for (const [w, n] of own(raw.wordsMet)) if (/^[a-z'-]{1,24}$/.test(w)) s.wordsMet[w] = int0(n);
  s.updatedAt = stamp(raw.updatedAt);
  return s;
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
