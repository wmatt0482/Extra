// Wagon West's own save, per player: `wagonWest.<playerId>.save` (SPEC §12 "Data"); device settings (sound, music,
// reduced motion, hunting, fractions at rivers, far-off sounds) at `wagonWest.settings`. The family (players, PIN, family code) is
// Spell Jump's record, read and written only through ../spell-jump/src/spelling/profiles.js; the child's math facts
// and spelling words are Trail Blazer's and Spell Jump's own stores, written through their modules (recordAnswer,
// recordSpell), never copied here. Same rules as Fraction Fright's save.js: every localStorage access is wrapped (a
// blocked or corrupt store never breaks boot), a corrupt save is kept aside at `<key>.corrupt`, a save from a newer
// version is not misread, writes tell the family sync (Spell Jump's notify.js localWrite), and `resetAt` (Parents →
// Reset) is kept so a reset on one device wins the merge (src/meta/sync.js).
//
// v1 shape:
//   journey      the Journey stream's J object (src/journey/sim.js createJourney), or null before the first outfit
//   trip         the leg in progress (app state around J): { legId, stage: 'trail' | 'stop', events: [ids], asked:
//                { ration, distance }, markers, at } or null between legs
//   seasonsDone  journeys finished (the valley reached)
//   stickers     sticker ids earned (every season; the journal's page)
//   letters      the letters home, newest last (≤ 36, text only): { at, leg, season, text }
//   cosmetics    { owned: { paint, flag, bugle, hat: [ids] }, equipped: { paint, flag, bugle, hat } } (src/ui/looks.js)
//   crates       { queue: ['bronze' | 'silver' | 'gold'], earned, opened }
//   streak       Spell Jump's streak shape (car-jump/src/meta/engagement.js): a day counts once a leg is finished
//   play         'YYYY-MM-DD' (local) → { legs, markers, markersRight, problems, problemsRight, words, wordsRight } (90 days)
//   kinds        problem kind → { n, right } (the Report's "problems right by kind"; 'fact' = event facts)
//   legsLog      the last 40 legs: { at, leg, season, stars, markers, markersRight, problems, problemsRight, words, wordsRight }
//   homestead    the name the child gave the homestead in the valley ('' until then)
//   seen         { coach } first-trail tips shown
//   daily        the daily trail challenge (v1.1): { key: 'YYYY-MM-DD', id, claimed } (one a day; claimed = the token and
//                the card were given)
//   suitsDone    trail-card suits completed (v1.1): each paid its gold crate once
//   resetAt      Parents → Reset (a stamped fresh save wins every merge)
// v1.1 keeps the v1 shape (no migration): the trail cards are the journey's own (J.cards, the Journey stream's
// awardCard), the dog the child named is J.dog = { name, coat, legs, nextBerries } (the app stores it on the journey:
// the journey stream does not model it), and the leg in progress remembers the Fort Derby race (trip.derby) and the
// dog's berry patch (trip.berries) so neither repeats when a stop is resumed.
// v1.5 (The Long Trail, SPEC v1.5 §3.8) keeps v: 1 and adds, all normalized (normalize drops what it does not know):
//   ledger       the years: { year, journeys: [{ id, at, route, branches, tier, year, journeyN, end, stars, legs }], routesDone, branchesDone, tiersDone,
//                trophies, lifetime } (journey/seasons.js newLedger / normalizeLedger)
//   farm         the homesteads: { sites: { willamette | sacramento: { name, founded, pieces } }, savingsIn / Out, goldIn / Out, animals, log }
//                (journey/homestead.js newFarm / normalizeFarm); nothing in it ever goes down but the Out counters
//   setsDone     trail-card sets completed (each paid its wagon decoration once)
//   cosmetics    + owned.decor (the earned decorations) and equipped.decor (the two worn, in order)
//   seen         + forks: { [forkId]: true } (the first-time explanation shown), placeOffers (how many times the Pit Crew Check was offered) and
//                worked: { 'site:piece': true } (the farm's "Work it out" for a token is offered once a piece)
//   journeyResetAt  Parents → "Reset this journey only" (the farm, the ledger, the cards and the sets stay; a merge drops an older journey)
//   homestead    (the 1.0 name) migrates into farm.sites.willamette.name for a 1.3 save done in the valley, and stays readable for an older build
//   trip         + dig: { pans, rocker } (the digging at this stop so far)
// v1.4 (Frodo and the river) adds no top-level field: everything new is on the journey (J.dog with treats and muddy, J.finds,
// J.fishLog, J.fishJunk, J.fishBest, J.skips, J.wishes, J.quests, J.questsDone, J.factsHeard, J.moments, J.opts.farSounds and the
// journey's rev 14, filled by the Journey stream's ensureJourney); `normalize` keeps an older journey whole for it to fill. The
// Parent Zone's "Far-off sounds on the trail" is a device setting (settings.farSounds, like hunting) and `JA.setTrailSounds(J, on)`
// writes it onto the journey (J.opts.farSounds) so a parent's choice also holds in the pure journey.
import { localWrite } from '../../../spell-jump/src/sync/notify.js';
import { defaultStreak, normalizeStreak } from '../../../spell-jump/src/meta/engagement.js';
import { DECOR_SLOTS, LOOK_KINDS, STOCK, itemOf } from '../ui/looks.js';
import { newLedger, normalizeLedger } from '../journey/seasons.js';
import { foundSite, newFarm, normalizeFarm } from '../journey/homestead.js';

export { normalizeLedger, normalizeFarm };

export const SAVE_VERSION = 1;
export const SETTINGS_KEY = 'wagonWest.settings';
export const saveKey = (playerId) => `wagonWest.${playerId}.save`;
export const LETTERS_KEPT = 36;
export const PLAY_DAYS = 90;
export const LEGS_KEPT = 40;
export const PLAY_FIELDS = Object.freeze(['legs', 'markers', 'markersRight', 'problems', 'problemsRight', 'words', 'wordsRight']);
export const PROBLEM_KINDS = Object.freeze(['buy', 'divide', 'ration', 'distance', 'parts', 'trade', 'fact']);
export const CRATE_TIERS = Object.freeze(['bronze', 'silver', 'gold']);

export const defaultCosmetics = () => ({ owned: Object.fromEntries(LOOK_KINDS.map((k) => [k, []])), equipped: { ...STOCK, decor: [] } });
export function defaultSave() {
  return {
    v: SAVE_VERSION,
    journey: null,
    trip: null,
    seasonsDone: 0,
    stickers: [],
    letters: [],
    cosmetics: defaultCosmetics(),
    crates: { queue: [], earned: 0, opened: 0 },
    streak: defaultStreak(),
    play: {},
    kinds: {},
    legsLog: [],
    homestead: '',
    seen: { coach: false, forks: {}, placeOffers: 0, worked: {} },
    daily: { key: '', id: '', claimed: false },
    suitsDone: [],
    ledger: newLedger(),
    farm: newFarm(),
    setsDone: [],
    journeyResetAt: 0,
  };
}
export const defaultSettings = () => ({ sound: true, music: true, reducedMotion: false, hunting: true, fractions: true, farSounds: true, chooseTier: true, panning: true });

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int0 = (v) => Math.max(0, Math.floor(num(v)));
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const DAY_RE = /^\d{4}-\d\d-\d\d$/;

/** The journey object as stored: the Journey stream owns its shape; here only "is it a journey" is checked. */
export function normalizeJourney(j) {
  const J = obj(j);
  if (!J || !Number.isFinite(J.legIndex)) return null;
  return J;
}
function normalizeTrip(t) {
  const T = obj(t);
  if (!T || typeof T.legId !== 'string') return null;
  return {
    legId: T.legId,
    stage: T.stage === 'stop' ? 'stop' : 'trail',
    events: (Array.isArray(T.events) ? T.events : []).filter((x) => typeof x === 'string').slice(0, 8),
    asked: { ration: int0(T.asked && T.asked.ration), distance: int0(T.asked && T.asked.distance) },
    markers: int0(T.markers),
    at: int0(T.at),
    tokens0: int0(T.tokens0),
    derby: !!T.derby,
    berries: !!T.berries,
    dig: { pans: int0(T.dig && T.dig.pans), rocker: int0(T.dig && T.dig.rocker) },
    look: !!T.look,
    gold0: int0(T.gold0),
  };
}
const letterKey = (l) => `${l.at}|${l.text}`;
export function normalizeLetters(list) {
  const seen = new Map();
  for (const l of Array.isArray(list) ? list : []) {
    if (!l || typeof l !== 'object' || typeof l.text !== 'string' || !l.text.trim()) continue;
    const x = { at: int0(l.at), leg: str(l.leg, 40), season: str(l.season, 12), text: str(l.text, 2000) };
    if (!seen.has(letterKey(x))) seen.set(letterKey(x), x);
  }
  return [...seen.values()].sort((a, b) => a.at - b.at).slice(-LETTERS_KEPT);
}
export function normalizePlay(raw) {
  const out = {};
  for (const [k, v] of Object.entries(obj(raw) || {}).sort().slice(-PLAY_DAYS)) {
    if (!DAY_RE.test(k) || !obj(v)) continue;
    out[k] = Object.fromEntries(PLAY_FIELDS.map((f) => [f, int0(v[f])]));
  }
  return out;
}
export function normalizeKinds(raw) {
  const out = {};
  for (const k of PROBLEM_KINDS) { const v = obj(raw && raw[k]); if (v) out[k] = { n: int0(v.n), right: Math.min(int0(v.n), int0(v.right)) }; }
  return out;
}
export function normalizeLegsLog(list) {
  const seen = new Map();
  for (const l of Array.isArray(list) ? list : []) {
    if (!obj(l) || typeof l.leg !== 'string') continue;
    const x = { at: int0(l.at), leg: str(l.leg, 40), season: str(l.season, 12), stars: Math.min(3, int0(l.stars)) };
    for (const f of PLAY_FIELDS.slice(1)) x[f] = int0(l[f]);
    if (!seen.has(`${x.at}|${x.leg}`)) seen.set(`${x.at}|${x.leg}`, x);
  }
  return [...seen.values()].sort((a, b) => a.at - b.at).slice(-LEGS_KEPT);
}
export function normalizeDaily(raw) {
  const d = obj(raw) || {};
  return { key: DAY_RE.test(d.key || '') ? d.key : '', id: str(d.id, 80), claimed: !!d.claimed };
}
function normalizeCosmetics(raw) {
  const c = defaultCosmetics();
  const r = obj(raw) || {};
  const owned = obj(r.owned) || {};
  for (const k of LOOK_KINDS) {
    c.owned[k] = [...new Set((Array.isArray(owned[k]) ? owned[k] : []).filter((id) => itemOf(k, id) && id !== STOCK[k]))];
    if (k === 'decor') {            // the worn decorations: a list of at most two earned ones
      const eq = r.equipped && Array.isArray(r.equipped.decor) ? r.equipped.decor : [];
      c.equipped.decor = [...new Set(eq.filter((id) => c.owned.decor.includes(id)))].slice(0, DECOR_SLOTS);
      continue;
    }
    const eq = r.equipped && r.equipped[k];
    c.equipped[k] = itemOf(k, eq) && (eq === STOCK[k] || c.owned[k].includes(eq)) ? eq : STOCK[k];
  }
  return c;
}

export function normalize(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  s.journey = normalizeJourney(raw.journey);
  s.trip = s.journey ? normalizeTrip(raw.trip) : null;
  s.seasonsDone = int0(raw.seasonsDone);
  s.stickers = [...new Set((Array.isArray(raw.stickers) ? raw.stickers : []).filter((x) => typeof x === 'string' && x.length <= 40))];
  s.letters = normalizeLetters(raw.letters);
  s.cosmetics = normalizeCosmetics(raw.cosmetics);
  const cr = obj(raw.crates) || {};
  s.crates = { queue: (Array.isArray(cr.queue) ? cr.queue : []).filter((t) => CRATE_TIERS.includes(t)).slice(0, 20), earned: int0(cr.earned), opened: int0(cr.opened) };
  s.streak = normalizeStreak(raw.streak);
  s.play = normalizePlay(raw.play);
  s.kinds = normalizeKinds(raw.kinds);
  s.legsLog = normalizeLegsLog(raw.legsLog);
  s.homestead = str(raw.homestead, 24);
  const seenForks = {};
  if (raw.seen && obj(raw.seen.forks)) for (const [k, v] of Object.entries(raw.seen.forks)) if (v && /^[a-z0-9-]{1,32}$/.test(k)) seenForks[k] = true;
  const worked = {};
  if (raw.seen && obj(raw.seen.worked)) for (const [k, v] of Object.entries(raw.seen.worked).slice(0, 80)) if (v && /^[a-z0-9:-]{1,48}$/.test(k)) worked[k] = true;
  s.seen = { coach: !!(raw.seen && raw.seen.coach), forks: seenForks, placeOffers: Math.min(9, int0(raw.seen && raw.seen.placeOffers)), worked };
  s.ledger = normalizeLedger(raw.ledger);
  s.farm = normalizeFarm(raw.farm);
  s.setsDone = [...new Set((Array.isArray(raw.setsDone) ? raw.setsDone : []).filter((x) => typeof x === 'string' && x.length <= 40))];
  s.journeyResetAt = int0(raw.journeyResetAt);
  // a 1.3 save done in the valley: the homestead the child named is the Willamette farm's name; an older build still reads save.homestead
  const done = !!(s.journey && s.journey.done) || s.seasonsDone > 0;
  if (s.homestead && done && !s.farm.sites.willamette) foundSite(s.farm, 'willamette', { name: s.homestead, year: s.journey && Number.isFinite(s.journey.year) ? s.journey.year : 1847 });
  else if (s.farm.sites.willamette && s.farm.sites.willamette.name && !s.homestead) s.homestead = str(s.farm.sites.willamette.name, 24);
  s.daily = normalizeDaily(raw.daily);
  s.suitsDone = [...new Set((Array.isArray(raw.suitsDone) ? raw.suitsDone : []).filter((x) => typeof x === 'string' && x.length <= 20))];
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

export function loadSettings() {
  const d = defaultSettings();
  const text = readText(SETTINGS_KEY);
  if (!text) return d;
  try {
    const raw = JSON.parse(text);
    for (const k of Object.keys(d)) if (typeof raw[k] === 'boolean') d[k] = raw[k];
  } catch (_) { /* defaults */ }
  return d;
}
export function writeSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch (_) { return false; } }

// ---------- the per-day log and the per-kind tallies (the Report and its chart) ----------
const pad = (n) => String(n).padStart(2, '0');
/** The local calendar day ('YYYY-MM-DD'), the same key as Spell Jump's chart module. */
export const dayKeyOf = (ms) => { const t = new Date(ms); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
/** Add to today's log (fields of PLAY_FIELDS); keeps the last PLAY_DAYS days. */
export function logPlay(save, add, now = Date.now()) {
  const k = dayKeyOf(now);
  const day = save.play[k] || (save.play[k] = Object.fromEntries(PLAY_FIELDS.map((f) => [f, 0])));
  for (const [f, v] of Object.entries(add || {})) if (PLAY_FIELDS.includes(f)) day[f] += int0(v);
  const keys = Object.keys(save.play).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - PLAY_DAYS))) delete save.play[old];
  return day;
}
/** One problem of a kind, right (on the first try) or not. */
export function logKind(save, kind, right) {
  if (!PROBLEM_KINDS.includes(kind)) return;
  const k = save.kinds[kind] || (save.kinds[kind] = { n: 0, right: 0 });
  k.n += 1; if (right) k.right += 1;
}
/** A letter home into the journal (text only; the newest 36 are kept). */
export function addLetter(save, letter) {
  save.letters = normalizeLetters([...save.letters, letter]);
  return save.letters[save.letters.length - 1];
}
