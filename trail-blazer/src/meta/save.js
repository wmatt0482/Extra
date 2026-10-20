// Trail Blazer's own save, per player and per device (v1): `trailBlazer.<playerId>.save`. Device settings (sound,
// music, reduced motion, shake) live in `trailBlazer.settings`. The family (players, PIN, family code) is Spell
// Jump's record, read and written only through ../spell-jump/src/spelling/profiles.js.
// Every localStorage access is wrapped in try/catch: a missing, blocked or corrupt store never breaks boot (defaults
// in memory); a corrupt save is backed up to `<key>.corrupt`. `v` is the schema version: normalize() upgrades older
// saves and a save from a newer app version is kept aside (backup) rather than misread. v1.1 (races) added bestPlace,
// bestTime, medals and the race records as optional fields (v stays 1: an older copy just ignores them).
// v3 (1.5, "The Season"): vehicles { id: { owned, levels } } + vehicle (the per-vehicle upgrades replace `levels`),
// cups, stars, crates (a queue of crate tiers), cosmetics (owned per kind + equipped rider gear), streak (Spell Jump's
// shape), rivals, ghosts (best run per trail), daily (the Pit Challenge), weekend (a championship in progress), play
// (races / stars / crates per day for the Report). Older saves migrate: the Ranger is owned with the old levels.
import { UPGRADES, MAX_LEVEL, emptyLevels } from '../data/upgrades.js';
import { PAINT_BY_ID, DECAL_BY_ID } from '../data/paints.js';
import { KINDS, STOCK, itemOf } from '../data/cosmetics.js';
import { CUP_BY_ID, TROPHIES } from '../data/cups.js';
import { defaultRivals, normalizeRivals } from '../data/rivals.js';
import { defaultStreak, normalizeStreak } from '../../../spell-jump/src/meta/engagement.js';
import { MEDALS as MEDAL_IDS } from '../data/medals.js';
import { FACTS_VERSION, defaultFacts, factsKey, normalizeFacts } from '../facts/store.js';

export const SAVE_VERSION = 3;
export const FIRST_VEHICLE = 'ranger150';
export const GHOST_MAX = 1500;            // samples kept per trail (0.1 s each)
const CRATE_TIER_IDS = ['bronze', 'silver', 'gold'];
export const defaultCosmetics = () => ({ owned: Object.fromEntries(KINDS.map((k) => [k, []])), equipped: { helmet: STOCK.helmet, suit: STOCK.suit, horn: STOCK.horn, trail: STOCK.trail, flag: STOCK.flag } });
export const defaultCrates = () => ({ queue: [], earned: 0, opened: 0, sinceNew: 0 });
export const SETTINGS_KEY = 'trailBlazer.settings';
export const saveKey = (playerId) => `trailBlazer.${playerId}.save`;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    cash: 0,
    vehicle: FIRST_VEHICLE,
    vehicles: { [FIRST_VEHICLE]: { owned: true, levels: emptyLevels() } },
    best: {},                 // trailId -> best distance (m)
    finished: {},             // trailId -> times the finish line was crossed
    bestPlace: {},            // trailId -> best finishing place (1..4); 3rd or better unlocks the next track
    bestTime: {},             // trailId -> best finishing time (s)
    medals: {},               // trailId -> best medal ('gold' | 'silver' | 'bronze')
    selectedTrail: null,
    paint: 'sage',
    decal: 'none',
    records: { rides: 0, lifetimeCash: 0, longestRide: 0, totalSmashes: 0, totalFlips: 0, totalCoins: 0, maxSpeedKmh: 0, longestAir: 0, winches: 0,
      wins: 0, podiums: 0, crashes: 0, perfectLandings: 0 },
    seen: { coach: false },
    cups: {},                 // cupId -> { best: points, trophy: 'gold' | 'silver' | 'bronze', weekends }
    stars: {},                // trailId -> [win, every gate right, the trail's stunt]
    crates: defaultCrates(),
    cosmetics: defaultCosmetics(),
    streak: defaultStreak(),
    rivals: defaultRivals(),
    ghosts: {},               // trailId -> [[t, x, angle] …] the best finished run, sampled every 0.1 s
    daily: { day: '', trailId: null, mutator: null, done: false },
    weekend: null,            // { cup, trails: [ids], results: [{ trailId, standings: [{ name, place, points, me }] }], points: { name: n } }
    play: {},                 // 'YYYY-MM-DD' -> { races, stars, crates } (the last 14 days)
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
  const levelsFrom = (l) => Object.fromEntries(UPGRADES.map((u) => [u.id, Math.max(0, Math.min(MAX_LEVEL, Math.floor(num(l && l[u.id]))))]));
  // v1 / v2 saves: the Ranger is owned with the old levels
  if ((!raw.vehicles || typeof raw.vehicles !== 'object') && raw.levels && typeof raw.levels === 'object') s.vehicles[FIRST_VEHICLE].levels = levelsFrom(raw.levels);
  if (raw.vehicles && typeof raw.vehicles === 'object') {
    for (const [id, v] of Object.entries(raw.vehicles)) if (idOk(id) && v && typeof v === 'object' && (v.owned || id === FIRST_VEHICLE)) s.vehicles[id] = { owned: true, levels: levelsFrom(v.levels) };
  }
  s.vehicle = idOk(raw.vehicle) && s.vehicles[raw.vehicle] ? raw.vehicle : FIRST_VEHICLE;
  for (const key of ['best', 'finished']) {
    if (raw[key] && typeof raw[key] === 'object') {
      for (const [k, v] of Object.entries(raw[key])) if (idOk(k) && num(v) > 0) s[key][k] = key === 'best' ? Math.floor(num(v)) : Math.floor(num(v));
    }
  }
  if (raw.bestPlace && typeof raw.bestPlace === 'object') {
    for (const [k, v] of Object.entries(raw.bestPlace)) if (idOk(k) && num(v) >= 1) s.bestPlace[k] = Math.min(4, Math.floor(num(v)));
  }
  if (raw.bestTime && typeof raw.bestTime === 'object') {
    for (const [k, v] of Object.entries(raw.bestTime)) if (idOk(k) && num(v) > 0) s.bestTime[k] = Math.round(num(v) * 100) / 100;
  }
  if (raw.medals && typeof raw.medals === 'object') {
    for (const [k, v] of Object.entries(raw.medals)) if (idOk(k) && MEDAL_IDS.includes(v)) s.medals[k] = v;
  }
  // v1 saves (trail rides, before races): a finished trail keeps the next one open
  for (const k of Object.keys(s.finished)) if (!s.bestPlace[k]) s.bestPlace[k] = 3;
  s.selectedTrail = idOk(raw.selectedTrail) ? raw.selectedTrail : null;
  s.paint = PAINT_BY_ID[raw.paint] ? raw.paint : 'sage';
  s.decal = DECAL_BY_ID[raw.decal] ? raw.decal : 'none';
  s.v = SAVE_VERSION;
  if (raw.records && typeof raw.records === 'object') {
    for (const k of Object.keys(s.records)) s.records[k] = Math.max(0, num(raw.records[k]));
  }
  const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
  s.seen.coach = bool(seen.coach, s.records.rides > 0);
  // ---- v3 ----
  if (raw.cups && typeof raw.cups === 'object') for (const [k, v] of Object.entries(raw.cups)) if (CUP_BY_ID[k] && v && typeof v === 'object') {
    s.cups[k] = { best: Math.max(0, Math.floor(num(v.best))), trophy: TROPHIES.includes(v.trophy) ? v.trophy : null, weekends: Math.max(0, Math.floor(num(v.weekends))) };
  }
  if (raw.stars && typeof raw.stars === 'object') for (const [k, v] of Object.entries(raw.stars)) if (idOk(k) && Array.isArray(v)) s.stars[k] = [0, 1, 2].map((i) => !!v[i]);
  const c = raw.crates && typeof raw.crates === 'object' ? raw.crates : {};
  s.crates = { queue: (Array.isArray(c.queue) ? c.queue : []).filter((t) => CRATE_TIER_IDS.includes(t)).slice(0, 50), earned: Math.max(0, Math.floor(num(c.earned))),
    opened: Math.max(0, Math.floor(num(c.opened))), sinceNew: Math.max(0, Math.floor(num(c.sinceNew))) };
  const cos = raw.cosmetics && typeof raw.cosmetics === 'object' ? raw.cosmetics : {};
  for (const k of KINDS) s.cosmetics.owned[k] = [...new Set(((cos.owned && cos.owned[k]) || []).filter((id) => itemOf(k, id)))];
  const eq = cos.equipped && typeof cos.equipped === 'object' ? cos.equipped : {};
  for (const k of ['helmet', 'suit', 'horn', 'trail', 'flag']) if (itemOf(k, eq[k]) && (eq[k] === STOCK[k] || s.cosmetics.owned[k].includes(eq[k]))) s.cosmetics.equipped[k] = eq[k];
  s.streak = normalizeStreak(raw.streak);
  s.rivals = normalizeRivals(raw.rivals);
  if (raw.ghosts && typeof raw.ghosts === 'object') for (const [k, v] of Object.entries(raw.ghosts)) {
    if (!idOk(k) || !Array.isArray(v)) continue;
    const g = v.filter((x) => Array.isArray(x) && x.length >= 2 && x.every((n) => typeof n === 'number' && Number.isFinite(n))).slice(0, GHOST_MAX).map((x) => [x[0], x[1], x[2] || 0]);
    if (g.length) s.ghosts[k] = g;
  }
  const d = raw.daily && typeof raw.daily === 'object' ? raw.daily : {};
  s.daily = { day: typeof d.day === 'string' && /^\d{4}-\d\d-\d\d$/.test(d.day) ? d.day : '', trailId: idOk(d.trailId) ? d.trailId : null, mutator: idOk(d.mutator) ? d.mutator : null, done: !!d.done };
  const w = raw.weekend;
  if (w && typeof w === 'object' && CUP_BY_ID[w.cup] && Array.isArray(w.trails)) {
    s.weekend = { cup: w.cup, trails: w.trails.filter(idOk).slice(0, 3), results: (Array.isArray(w.results) ? w.results : []).slice(0, 3).filter((r) => r && idOk(r.trailId) && Array.isArray(r.standings))
      .map((r) => ({ trailId: r.trailId, standings: r.standings.slice(0, 4).map((x) => ({ name: String(x.name || '').slice(0, 20), place: Math.floor(num(x.place)), points: Math.floor(num(x.points)), me: !!x.me })) })),
    points: {} };
    if (Array.isArray(w.trio)) s.weekend.trio = w.trio.filter(idOk).slice(0, 3);
    if (w.points && typeof w.points === 'object') for (const [k, v] of Object.entries(w.points)) if (typeof k === 'string' && k.length <= 20) s.weekend.points[k] = Math.max(0, Math.floor(num(v)));
  }
  if (raw.play && typeof raw.play === 'object') for (const [k, v] of Object.entries(raw.play).sort().slice(-14)) if (/^\d{4}-\d\d-\d\d$/.test(k) && v && typeof v === 'object') {
    s.play[k] = { races: Math.max(0, Math.floor(num(v.races))), stars: Math.max(0, Math.floor(num(v.stars))), crates: Math.max(0, Math.floor(num(v.crates))) };
    if (num(v.streak) > 0) s.play[k].streak = Math.floor(num(v.streak));
  }
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

// ---------- the math data (src/facts/store.js): `trailBlazer.<playerId>.facts` ----------
export function loadFactsData(playerId, now = Date.now()) {
  if (!playerId) return defaultFacts(now);
  const key = factsKey(playerId);
  const text = readText(key);
  if (!text) return defaultFacts(now);
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || (raw.v !== undefined && raw.v > FACTS_VERSION)) throw new Error('bad facts shape');
    return normalizeFacts(raw, now);
  } catch (e) {
    console.warn('[save] corrupt facts data, starting fresh (backup kept)', e);
    try { localStorage.setItem(key + '.corrupt', text); } catch (_) { /* ignore */ }
    return defaultFacts(now);
  }
}
export function writeFactsData(playerId, d) {
  if (!playerId || !d) return false;
  try { localStorage.setItem(factsKey(playerId), JSON.stringify(d)); return true; } catch (e) { console.warn('[save] could not write facts', e); return false; }
}
export function removeFactsData(playerId) {
  if (!playerId) return;
  try { localStorage.removeItem(factsKey(playerId)); } catch (_) { /* ignore */ }
}
