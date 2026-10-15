// Players and the family record (SPEC v3 "Players"). Storage layout:
//   spellJump.family              { v, players: [{id, name, color, createdAt, updatedAt}], pinHash, pinUpdatedAt,
//                                   options: {playerId: {rate, newPerDay, includeReview, tileCase, wordsPerRace, levelsPerRace,
//                                   voiceName, voiceLang, cloudVoice?}}, optionsUpdatedAt: {playerId: ms},
//                                   removedPlayers: [id] (tombstones for family sync), migrated, lastPlayer }
//                                   (migrated and lastPlayer are per device; the rest is what family sync shares)
//   spellJump.<playerId>.save     the player's full game save (src/meta/save.js schema)
//   spellJump.<playerId>.words    the player's spelling data (src/spelling/wordStore.js schema)
// Every localStorage access is wrapped in try/catch. A corrupt record is backed up to `<key>.corrupt` and
// replaced by defaults without touching the other players' keys; a corrupt family record is rebuilt from the
// per-player keys it can still find.
import { LEGACY_SAVE_KEY, loadSave, writeSave } from '../meta/save.js';
import { hashString } from '../meta/rng.js';
import { DEFAULT_OPTIONS, defaultWords, normalizeWordsData } from './wordStore.js';
import { isCloudVoice } from '../tts/voices.js';
import { localWrite } from '../sync/notify.js';

export const FAMILY_KEY = 'spellJump.family';
export const MAX_PLAYERS = 4;
export const MAX_NAME = 12;
export const PLAYER_COLORS = ['#ff3b5c', '#3b7dd9', '#2fd36b', '#ffcf1a', '#8f6bff', '#ff8a1f'];
export const saveKey = (id) => `spellJump.${id}.save`;
export const wordsKey = (id) => `spellJump.${id}.words`;

function read(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { console.warn('[profiles] could not write', key, e); return false; }
  localWrite(key);            // family sync marks the key dirty (no-op when sync is off)
  return true;
}
function remove(key) {
  try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
}
function storageKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (_) { /* ignore */ }
  return out;
}

export function defaultFamily() {
  return { v: 1, players: [], pinHash: null, pinUpdatedAt: 0, options: {}, optionsUpdatedAt: {}, removedPlayers: [], migrated: false, lastPlayer: null };
}

export function cleanName(name) {
  return String(name || '').replace(/[^A-Za-z' -]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function normalizeFamily(raw) {
  const f = defaultFamily();
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.players)) {
    f.players = raw.players.filter((p) => p && typeof p.id === 'string' && /^[a-z0-9]{2,24}$/i.test(p.id)).slice(0, MAX_PLAYERS).map((p, i) => ({
      id: p.id, name: cleanName(p.name) || `Player ${i + 1}`, color: PLAYER_COLORS.includes(p.color) ? p.color : PLAYER_COLORS[i % PLAYER_COLORS.length],
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : (typeof p.createdAt === 'number' ? p.createdAt : 0),
    }));
  }
  if (Array.isArray(raw.removedPlayers)) f.removedPlayers = raw.removedPlayers.filter((id) => typeof id === 'string' && id.length <= 32).slice(-50);
  const removed = new Set(f.removedPlayers);
  f.players = f.players.filter((p) => !removed.has(p.id));
  f.pinHash = typeof raw.pinHash === 'string' ? raw.pinHash : null;
  f.pinUpdatedAt = f.pinHash && typeof raw.pinUpdatedAt === 'number' ? raw.pinUpdatedAt : 0;
  f.migrated = !!raw.migrated;
  f.lastPlayer = f.players.some((p) => p.id === raw.lastPlayer) ? raw.lastPlayer : null;
  if (raw.options && typeof raw.options === 'object') {
    for (const p of f.players) if (raw.options[p.id] && typeof raw.options[p.id] === 'object') f.options[p.id] = cleanOptions(raw.options[p.id]);
  }
  if (raw.optionsUpdatedAt && typeof raw.optionsUpdatedAt === 'object') {
    for (const id of Object.keys(f.options)) if (typeof raw.optionsUpdatedAt[id] === 'number') f.optionsUpdatedAt[id] = raw.optionsUpdatedAt[id];
  }
  return f;
}

function cleanOptions(o) {
  const d = { ...DEFAULT_OPTIONS };
  if (o.rate === 'veryslow' || o.rate === 'slow' || o.rate === 'normal') d.rate = o.rate;
  // the voice picked in Parent Zone → Options ('' = the best English voice on the device). Stored by name (+ lang)
  // because voice objects differ per device; tts.js falls back to the ranked default when the name is absent.
  d.voiceName = typeof o.voiceName === 'string' ? o.voiceName.slice(0, 120) : '';
  d.voiceLang = d.voiceName && typeof o.voiceLang === 'string' && /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(o.voiceLang) ? o.voiceLang : '';
  // v3.4 natural voice: a Google voice id from src/tts/voices.js, '' = the device voice (the parent chose it), absent =
  // never chosen (the app picks the default natural voice once the server has one and the family has a code)
  if (o.cloudVoice === '' || isCloudVoice(o.cloudVoice)) d.cloudVoice = o.cloudVoice;
  if ([3, 5, 8, 99].includes(o.newPerDay)) d.newPerDay = o.newPerDay;
  if (typeof o.includeReview === 'boolean') d.includeReview = o.includeReview;
  if (o.tileCase === 'lower' || o.tileCase === 'upper') d.tileCase = o.tileCase;
  if ([1, 2, 3, 4].includes(o.wordsPerRace)) d.wordsPerRace = o.wordsPerRace;
  if ([1, 2, 3].includes(o.levelsPerRace)) d.levelsPerRace = o.levelsPerRace;
  return d;
}

// players whose keys exist but who are missing from the family list (corrupt / lost family record)
function rebuildPlayers(f) {
  const ids = new Set([...f.players.map((p) => p.id), ...f.removedPlayers]);
  for (const k of storageKeys()) {
    const m = /^spellJump\.([a-z0-9]{2,24})\.(save|words)$/i.exec(k || '');
    if (m && !ids.has(m[1]) && f.players.length < MAX_PLAYERS) {
      ids.add(m[1]);
      f.players.push({ id: m[1], name: `Player ${f.players.length + 1}`, color: PLAYER_COLORS[f.players.length % PLAYER_COLORS.length], createdAt: 0, updatedAt: 0 });
    }
  }
  return f;
}

export function loadFamily() {
  const text = read(FAMILY_KEY);
  if (!text) return rebuildPlayers(defaultFamily());
  try {
    const f = normalizeFamily(JSON.parse(text));
    if (!f) throw new Error('bad family shape');
    return rebuildPlayers(f);
  } catch (e) {
    console.warn('[profiles] corrupt family record, rebuilding (backup kept)', e);
    write(FAMILY_KEY + '.corrupt', text);
    return rebuildPlayers(defaultFamily());
  }
}

export const writeFamily = (f) => write(FAMILY_KEY, JSON.stringify(f));

export const playerById = (f, id) => f.players.find((p) => p.id === id) || null;
export const playerOptions = (f, id) => ({ ...DEFAULT_OPTIONS, ...(f.options[id] || {}) });
export function setPlayerOption(f, id, key, value) {
  f.options[id] = cleanOptions({ ...playerOptions(f, id), ...(key && typeof key === 'object' ? key : { [key]: value }) });
  f.optionsUpdatedAt[id] = Date.now();     // family sync: the later change per player wins
  return f.options[id];
}

function newId(f) {
  let id;
  do { id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); } while (playerById(f, id));
  return id;
}

/** Add a player (max 4). The first player created inherits an existing single-player save
 *  (`rampRage.save.v1`). Returns the player, or null when full / the name is empty. */
export function createPlayer(f, name, color) {
  const n = cleanName(name);
  if (!n || f.players.length >= MAX_PLAYERS) return null;
  const now = Date.now();
  const p = { id: newId(f), name: n, color: PLAYER_COLORS.includes(color) ? color : PLAYER_COLORS[f.players.length % PLAYER_COLORS.length], createdAt: now, updatedAt: now };
  if (!f.migrated) {
    f.migrated = true;
    if (read(LEGACY_SAVE_KEY)) {
      const legacy = loadSave(LEGACY_SAVE_KEY);      // normalized (v1 → v2 upgrade, corrupt → defaults)
      writeSave(legacy, saveKey(p.id));
    }
  }
  f.players.push(p);
  f.lastPlayer = p.id;
  writeFamily(f);
  return p;
}

export function renamePlayer(f, id, name) {
  const p = playerById(f, id); const n = cleanName(name);
  if (!p || !n) return false;
  p.name = n; p.updatedAt = Date.now(); writeFamily(f); return true;
}

// Only the Parent Zone calls this. The id stays in removedPlayers (a tombstone) so family sync removes the player on
// every device instead of bringing it back from another one.
export function removePlayer(f, id) {
  f.players = f.players.filter((p) => p.id !== id);
  delete f.options[id];
  delete f.optionsUpdatedAt[id];
  if (!f.removedPlayers.includes(id)) f.removedPlayers = [...f.removedPlayers, id].slice(-50);
  if (f.lastPlayer === id) f.lastPlayer = null;
  remove(saveKey(id)); remove(wordsKey(id));
  writeFamily(f);
}

// ---------- spelling data per player ----------
export function loadWords(id, now = Date.now()) {
  const key = wordsKey(id);
  const text = read(key);
  if (!text) return defaultWords(now);
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.lists)) throw new Error('bad words shape');
    return normalizeWordsData(raw, now);
  } catch (e) {
    console.warn('[profiles] corrupt words data, starting fresh (backup kept)', e);
    write(key + '.corrupt', text);
    return defaultWords(now);
  }
}
export const writeWords = (id, data) => write(wordsKey(id), JSON.stringify(data));

// ---------- parent PIN ----------
const pinHash = (pin) => 'h' + hashString('spellJump.pin:' + pin).toString(36);
export const hasPin = (f) => !!f.pinHash;
export const checkPin = (f, pin) => !!f.pinHash && pinHash(String(pin)) === f.pinHash;
export function setPin(f, pin) {
  if (!/^\d{4}$/.test(String(pin))) return false;
  f.pinHash = pinHash(String(pin));
  f.pinUpdatedAt = Date.now();             // family sync: the later PIN wins
  writeFamily(f);
  return true;
}
