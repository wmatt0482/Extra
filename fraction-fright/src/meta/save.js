// Fraction Fright's own save, per player: `fractionFright.<playerId>.save`; the fraction skills next to it at
// `fractionFright.<playerId>.skills` (src/skills/store.js); device settings (sound, music, reduced motion) at
// `fractionFright.settings`. The family (players, PIN, family code) is Spell Jump's record, read and written only
// through ../spell-jump/src/spelling/profiles.js. Same rules as Trail Blazer's save.js: every localStorage access is
// wrapped (a blocked or corrupt store never breaks boot), a corrupt save is kept aside at `<key>.corrupt`, a save from
// a newer version is not misread, writes tell the family sync (Spell Jump's notify.js localWrite), and `resetAt`
// (Parents → Reset) is kept so a reset on one device wins the merge (src/skills/sync.js).
import { EXTRAS, STOCK, YARD_KINDS, itemOf } from '../data/looks.js';
import { STREETS } from '../data/streets.js';
import { SKILLS_VERSION, defaultSkills, normalizeSkills, skillsKey } from '../skills/store.js';
import { localWrite } from '../../../spell-jump/src/sync/notify.js';

export const SAVE_VERSION = 1;
export const SETTINGS_KEY = 'fractionFright.settings';
export const saveKey = (playerId) => `fractionFright.${playerId}.save`;
const STREET_IDS = STREETS.map((s) => s.id);

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    cash: 0,
    cures: 0,                 // neighbours cured, ever (the Cure Counter: a new neighbour on the title per 10)
    bulls: 0,
    pumpkins: 0,              // planted in the calm beat after each final wave
    waves: 0,                 // waves played (stopped ones too)
    streets: {},              // streetId -> { wave: the next wave 1-5, cleared: times all 5 waves were played }
    yard: { owned: { grenade: [], goo: [], fence: [], extra: [] }, grenade: STOCK.grenade, goo: STOCK.goo, fence: STOCK.fence, dog: false, lantern: false },
    records: { lifetimeCash: 0, throws: 0, reached: 0, bestWave: 0 },
    seen: { coach: false },
    play: {},                 // 'YYYY-MM-DD' -> { waves, cures } (the last 14 days)
  };
}
export const defaultSettings = () => ({ sound: true, music: true, reducedMotion: false, bonus: true, gentle: false, pace: 'auto' });   // bonus: the Critter Stampede (§14); gentle: cure instead of blast (§15); pace: 'auto' | 'calm' | 'quick' (§16)
export const PACES = Object.freeze(['auto', 'calm', 'quick']);

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int0 = (v) => Math.max(0, Math.floor(num(v)));

export function normalize(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of ['cash', 'cures', 'bulls', 'pumpkins', 'waves']) s[k] = int0(raw[k]);
  if (raw.streets && typeof raw.streets === 'object') {
    for (const [id, v] of Object.entries(raw.streets)) if (STREET_IDS.includes(id) && v && typeof v === 'object') {
      s.streets[id] = { wave: Math.max(1, Math.min(5, Math.floor(num(v.wave, 1)))), cleared: int0(v.cleared) };
    }
  }
  const y = raw.yard && typeof raw.yard === 'object' ? raw.yard : {};
  for (const kind of Object.keys(YARD_KINDS)) {
    s.yard.owned[kind] = [...new Set(((y.owned && y.owned[kind]) || []).filter((id) => itemOf(kind, id) && id !== STOCK[kind]))];
    const eq = y[kind];
    s.yard[kind] = itemOf(kind, eq) && (eq === STOCK[kind] || s.yard.owned[kind].includes(eq)) ? eq : STOCK[kind];
  }
  s.yard.owned.extra = [...new Set(((y.owned && y.owned.extra) || []).filter((id) => EXTRAS.some((x) => x.id === id)))];
  for (const x of EXTRAS) s.yard[x.id] = s.yard.owned.extra.includes(x.id) && y[x.id] === true;
  if (raw.records && typeof raw.records === 'object') for (const k of Object.keys(s.records)) s.records[k] = int0(raw.records[k]);
  const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
  s.seen.coach = typeof seen.coach === 'boolean' ? seen.coach : s.waves > 0;
  if (raw.play && typeof raw.play === 'object') for (const [k, v] of Object.entries(raw.play).sort().slice(-14)) if (/^\d{4}-\d\d-\d\d$/.test(k) && v && typeof v === 'object') {
    s.play[k] = { waves: int0(v.waves), cures: int0(v.cures) };
  }
  if (num(raw.resetAt) > 0) s.resetAt = num(raw.resetAt);
  return s;
}

function readText(key) {
  try { return localStorage.getItem(key); } catch (e) { console.warn('[save] localStorage unavailable, playing without persistence', e); return null; }
}
function readJSON(key, version, fresh, norm) {
  const text = readText(key);
  if (!text) return fresh();
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || (raw.v !== undefined && raw.v > version)) throw new Error('bad shape');
    return norm(raw);
  } catch (e) {
    console.warn(`[save] corrupt ${key}, starting fresh (backup kept)`, e);
    try { localStorage.setItem(key + '.corrupt', text); } catch (_) { /* ignore */ }
    return fresh();
  }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('[save] could not write', key, e); return false; }
  localWrite(key);           // family sync (no subscriber = no cost)
  return true;
}

export const loadSave = (playerId) => (playerId ? readJSON(saveKey(playerId), SAVE_VERSION, defaultSave, normalize) : defaultSave());
export const writeSave = (playerId, save) => (playerId ? writeJSON(saveKey(playerId), save) : false);
export function removeSave(playerId) { if (playerId) try { localStorage.removeItem(saveKey(playerId)); } catch (_) { /* ignore */ } }

export const loadSkills = (playerId) => (playerId ? readJSON(skillsKey(playerId), SKILLS_VERSION, defaultSkills, normalizeSkills) : defaultSkills());
export const writeSkills = (playerId, d) => (playerId && d ? writeJSON(skillsKey(playerId), d) : false);
export function removeSkills(playerId) { if (playerId) try { localStorage.removeItem(skillsKey(playerId)); } catch (_) { /* ignore */ } }

export function loadSettings() {
  const d = defaultSettings();
  const text = readText(SETTINGS_KEY);
  if (!text) return d;
  try {
    const raw = JSON.parse(text);
    for (const k of Object.keys(d)) if (typeof raw[k] === 'boolean' && typeof d[k] === 'boolean') d[k] = raw[k];
    if (PACES.includes(raw.pace)) d.pace = raw.pace;
  } catch (_) { /* defaults */ }
  return d;
}
export function writeSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch (_) { return false; } }
