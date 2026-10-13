// Persistent save for Ramp Rage. Everything is wrapped in try/catch: a missing, blocked, or corrupt
// localStorage must never break boot — we fall back to defaults and keep playing in memory.

import { CARS, CAR_BY_ID } from '../data/cars.js';
import { TRACKS, TRACK_BY_ID } from '../data/tracks.js';
import { UPGRADES, MAX_LEVEL } from '../data/upgrades.js';

export const SAVE_KEY = 'rampRage.save.v1';
export const SAVE_VERSION = 1;

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
    },
    daily: { date: '', done: false, attempts: 0 },
    goals: { list: [], rolled: 0 },
    settings: { sound: true, music: true, reducedMotion: false },
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
  }
  return s;
}

export function loadSave() {
  let text = null;
  try {
    text = localStorage.getItem(SAVE_KEY);
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
    try { localStorage.setItem(SAVE_KEY + '.corrupt', text); } catch (_) { /* ignore */ }
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) {
    console.warn('[save] could not write save', e);
    return false;
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
  return defaultSave();
}

export function carLevels(save, carId) {
  if (!save.levels[carId]) save.levels[carId] = emptyLevels();
  return save.levels[carId];
}

