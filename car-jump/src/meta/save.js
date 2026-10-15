// Persistent game save (cash, cars, upgrades, records, settings). Everything is wrapped in try/catch: a
// missing, blocked, or corrupt localStorage must never break boot — we fall back to defaults and keep playing
// in memory. Spell Jump (v3) keeps one save per player under `spellJump.<playerId>.save` (see
// src/spelling/profiles.js); `setSaveKey` points load/write/wipe at the current player's key. The old
// single-player key `rampRage.save.v1` (LEGACY_SAVE_KEY) is only read once, to migrate it into the first player.

import { CARS, CAR_BY_ID } from '../data/cars.js';
import { TRACKS, TRACK_BY_ID } from '../data/tracks.js';
import { UPGRADES, MAX_LEVEL } from '../data/upgrades.js';
import { localWrite } from '../sync/notify.js';
import { defaultCosmetics, defaultCrates, defaultStreak, grantEarned, normalizeCosmetics, normalizeCrates, normalizeStreak, normalizeTrophies } from './engagement.js';

// The key keeps its v1 name so existing saves load in place; `v` inside the object is the schema
// version. v2 (epic update) added: records.bestCombo/maxAltitude/rings/explosions/rejumps,
// settings.shake (0-100), and achievements ({id: earned timestamp ms}). Older saves are upgraded by
// normalize() with defaults for the new fields; nothing else changes shape. v3.3 (engagement update) adds xp,
// streak, cosmetics, crates, trophies, champion and weekBest (src/meta/engagement.js); `v` stays 2 so an older app
// on another family device still reads a synced save (it keeps the fields it does not know out of its copy).
export const LEGACY_SAVE_KEY = 'rampRage.save.v1';
export const SAVE_KEY = LEGACY_SAVE_KEY;    // kept for older imports
export const SAVE_VERSION = 2;
let currentKey = null;                      // no player chosen yet: nothing is read or written
export function setSaveKey(key) { currentKey = key; }
export function getSaveKey() { return currentKey; }

function emptyLevels() {
  return Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));
}

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    cash: 0,
    owned: ['beater'],
    selectedCar: 'beater',
    levels: { beater: emptyLevels() },
    unlocked: ['canyon'],
    selectedTrack: 'canyon',
    best: {},                // trackId -> best distance (m)
    records: {
      bestScore: 0,          // best single-run payout (cash.total)
      totalSmashes: 0,
      totalFlips: 0,
      lifetimeCash: 0,       // every dollar ever earned (runs + goals + daily)
      runs: 0,
      maxSpeedKmh: 0,
      longestAir: 0,
      perfectLandings: 0,
      bestCombo: 0,          // longest smash chain
      maxAltitude: 0,        // m above terrain
      rings: 0,              // gold rings flown through (lifetime)
      explosions: 0,
      rejumps: 0,
    },
    daily: { date: '', done: false, attempts: 0 },
    goals: { list: [], rolled: 0 },
    settings: { sound: true, music: true, reducedMotion: false, shake: 100 },
    seen: { coach: false, ach: 0 },  // one-time UI hints already shown
    achievements: {},        // achievement id -> earned timestamp (ms)
    // ----- v3.3 engagement (src/meta/engagement.js) -----
    xp: 0,
    streak: defaultStreak(),
    cosmetics: defaultCosmetics(),
    crates: defaultCrates(),
    trophies: {},            // listId -> [mastered words]
    champion: [],            // listIds of Week Champion lists
    weekBest: { week: '', distance: 0 },
  };
}

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

// Coerce whatever we read into a valid save. Unknown ids are dropped, numbers clamped.
export function normalize(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = d;
  s.cash = Math.max(0, Math.floor(num(raw.cash)));

  const owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => CAR_BY_ID[id]) : [];
  s.owned = Array.from(new Set(['beater', ...owned]));
  s.selectedCar = CAR_BY_ID[raw.selectedCar] && s.owned.includes(raw.selectedCar) ? raw.selectedCar : 'beater';

  s.levels = {};
  for (const id of s.owned) {
    const src = raw.levels && typeof raw.levels === 'object' ? raw.levels[id] : null;
    const lv = emptyLevels();
    if (src && typeof src === 'object') {
      for (const u of UPGRADES) lv[u.id] = Math.max(0, Math.min(MAX_LEVEL, Math.floor(num(src[u.id]))));
    }
    s.levels[id] = lv;
  }

  const unl = Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => TRACK_BY_ID[id]) : [];
  s.unlocked = TRACKS.map((t) => t.id).filter((id) => id === 'canyon' || unl.includes(id));
  s.selectedTrack = s.unlocked.includes(raw.selectedTrack) ? raw.selectedTrack : 'canyon';

  if (raw.best && typeof raw.best === 'object') {
    for (const t of TRACKS) if (num(raw.best[t.id]) > 0) s.best[t.id] = num(raw.best[t.id]);
  }
  if (raw.records && typeof raw.records === 'object') {
    for (const k of Object.keys(s.records)) s.records[k] = Math.max(0, num(raw.records[k]));
  }
  if (raw.daily && typeof raw.daily === 'object') {
    s.daily.date = typeof raw.daily.date === 'string' ? raw.daily.date : '';
    s.daily.done = bool(raw.daily.done, false);
    s.daily.attempts = Math.max(0, Math.floor(num(raw.daily.attempts)));
  }
  if (raw.goals && typeof raw.goals === 'object') {
    s.goals.rolled = Math.max(0, Math.floor(num(raw.goals.rolled)));
    if (Array.isArray(raw.goals.list)) {
      s.goals.list = raw.goals.list
        .filter((g) => g && typeof g === 'object' && typeof g.type === 'string' && num(g.target) > 0)
        .slice(0, 3)
        .map((g) => ({
          id: String(g.id || ''), type: g.type, kind: typeof g.kind === 'string' ? g.kind : undefined,
          target: num(g.target), progress: Math.max(0, num(g.progress)), reward: Math.max(0, num(g.reward)),
          done: bool(g.done, false),
        }));
    }
  }
  if (raw.settings && typeof raw.settings === 'object') {
    s.settings.sound = bool(raw.settings.sound, true);
    s.settings.music = bool(raw.settings.music, true);
    s.settings.reducedMotion = bool(raw.settings.reducedMotion, false);
    s.settings.shake = Math.max(0, Math.min(100, Math.round(num(raw.settings.shake, 100))));
  }
  if (raw.achievements && typeof raw.achievements === 'object' && !Array.isArray(raw.achievements)) {
    for (const [id, t] of Object.entries(raw.achievements)) {
      if (typeof id === 'string' && id.length < 40 && num(t) > 0) s.achievements[id] = num(t);
    }
  }
  // players who already have runs on the clock don't need the first-run coach
  const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
  s.seen.coach = bool(seen.coach, s.records.runs > 0);
  s.seen.ach = Math.max(0, Math.floor(num(seen.ach)));   // achievements already seen in the panel (title badge)
  if (num(raw.resetAt) > 0) s.resetAt = num(raw.resetAt);  // family sync: when a parent last reset this save
  // v3.3 engagement
  s.xp = Math.max(0, Math.floor(num(raw.xp)));
  s.streak = normalizeStreak(raw.streak);
  s.cosmetics = normalizeCosmetics(raw.cosmetics, CARS.map((c) => c.id));
  s.crates = normalizeCrates(raw.crates);
  s.trophies = normalizeTrophies(raw.trophies);
  s.champion = Array.isArray(raw.champion) ? [...new Set(raw.champion.filter((id) => typeof id === 'string' && id.length <= 40))].slice(-60) : [];
  if (raw.weekBest && typeof raw.weekBest === 'object' && /^\d{4}-W\d{2}$/.test(raw.weekBest.week)) s.weekBest = { week: raw.weekBest.week, distance: Math.max(0, Math.floor(num(raw.weekBest.distance))) };
  grantEarned(s);          // level / streak / champion cosmetics follow from the numbers (also after a merge)
  return s;
}

export function loadSave(key = currentKey) {
  if (!key) return defaultSave();
  let text = null;
  try {
    text = localStorage.getItem(key);
  } catch (e) {
    console.warn('[save] localStorage unavailable, playing without persistence', e);
    return defaultSave();
  }
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

export function writeSave(save, key = currentKey) {
  if (!key) return false;
  try {
    localStorage.setItem(key, JSON.stringify(save));
  } catch (e) {
    console.warn('[save] could not write save', e);
    return false;
  }
  localWrite(key);            // family sync marks the key dirty (no-op when sync is off)
  return true;
}

export function wipeSave(key = currentKey) {
  if (key) try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
  return defaultSave();
}

export function carLevels(save, carId) {
  if (!save.levels[carId]) save.levels[carId] = emptyLevels();
  return save.levels[carId];
}

