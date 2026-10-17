// Trail Blazer's own save, per player and per device (v1): `trailBlazer.<playerId>.save`. Device settings (sound,
// music, reduced motion, shake) live in `trailBlazer.settings`. The family (players, PIN, family code) is Spell
// Jump's record, read and written only through ../spell-jump/src/spelling/profiles.js.
// Every localStorage access is wrapped in try/catch: a missing, blocked or corrupt store never breaks boot (defaults
// in memory); a corrupt save is backed up to `<key>.corrupt`. `v` is the schema version: normalize() upgrades older
// saves and a save from a newer app version is kept aside (backup) rather than misread.
import { UPGRADES, MAX_LEVEL, emptyLevels } from '../data/upgrades.js';
import { PAINT_BY_ID, DECAL_BY_ID } from '../data/paints.js';

export const SAVE_VERSION = 1;
export const SETTINGS_KEY = 'trailBlazer.settings';
export const saveKey = (playerId) => `trailBlazer.${playerId}.save`;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    cash: 0,
    levels: emptyLevels(),
    best: {},                 // trailId -> best distance (m)
    finished: {},             // trailId -> times the finish flag was crossed
    selectedTrail: null,
    paint: 'sage',
    decal: 'none',
    records: { rides: 0, lifetimeCash: 0, longestRide: 0, totalSmashes: 0, totalFlips: 0, totalCoins: 0, maxSpeedKmh: 0, longestAir: 0, winches: 0 },
    seen: { coach: false },
  };
}
export function defaultSettings() {
  return { sound: true, music: true, reducedMotion: false, shake: 100 };
}

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const idOk = (k) => typeof k === 'string' && /^[a-z0-9_-]{1,40}$/i.test(k);

/** Coerce whatever was read into a valid save (unknown fields dropped, numbers clamped). */
export function normalize(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  s.cash = Math.max(0, Math.floor(num(raw.cash)));
  if (raw.levels && typeof raw.levels === 'object') {
    for (const u of UPGRADES) s.levels[u.id] = Math.max(0, Math.min(MAX_LEVEL, Math.floor(num(raw.levels[u.id]))));
  }
  for (const key of ['best', 'finished']) {
    if (raw[key] && typeof raw[key] === 'object') {
      for (const [k, v] of Object.entries(raw[key])) if (idOk(k) && num(v) > 0) s[key][k] = key === 'best' ? Math.floor(num(v)) : Math.floor(num(v));
    }
  }
  s.selectedTrail = idOk(raw.selectedTrail) ? raw.selectedTrail : null;
  s.paint = PAINT_BY_ID[raw.paint] ? raw.paint : 'sage';
  s.decal = DECAL_BY_ID[raw.decal] ? raw.decal : 'none';
  if (raw.records && typeof raw.records === 'object') {
    for (const k of Object.keys(s.records)) s.records[k] = Math.max(0, num(raw.records[k]));
  }
  const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
  s.seen.coach = bool(seen.coach, s.records.rides > 0);
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
    if (!raw || typeof raw !== 'object' || (raw.v !== undefined && raw.v > SAVE_VERSION)) throw new Error('bad save shape');
    return normalize(raw);
  } catch (e) {
    console.warn('[save] corrupt save, starting fresh (backup kept)', e);
    try { localStorage.setItem(key + '.corrupt', text); } catch (_) { /* ignore */ }
    return defaultSave();
  }
}

export function writeSave(playerId, save) {
  if (!playerId) return false;
  try { localStorage.setItem(saveKey(playerId), JSON.stringify(save)); return true; } catch (e) { console.warn('[save] could not write save', e); return false; }
}

export function removeSave(playerId) {
  if (!playerId) return;
  try { localStorage.removeItem(saveKey(playerId)); } catch (_) { /* ignore */ }
}

export function loadSettings() {
  const d = defaultSettings();
  const text = readText(SETTINGS_KEY);
  if (!text) return d;
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return d;
    d.sound = bool(raw.sound, true);
    d.music = bool(raw.music, true);
    d.reducedMotion = bool(raw.reducedMotion, false);
    d.shake = Math.max(0, Math.min(100, Math.round(num(raw.shake, 100))));
    return d;
  } catch (_) { return d; }
}
export function writeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch (_) { return false; }
}
