// The `lab` save (lab/SPEC.md §2.1): the shape, its normalizer, the wallet. PURE: no DOM, no storage, no clock.
// One document per child at localStorage['learningLab.<playerId>.lab'] (sync kind `lab`). normalizeLab is idempotent, bounds every list,
// sorts every map's keys (so equal docs serialize equally and the sync client's hash comparison is stable), and drops what it does not know.
import { addDays, isDayKey, normalizeStreak, weekOfDay } from '../../../spell-jump/src/meta/engagement.js';
import { ITEM_BY_ID, SLOT_BY_KEY, isStock } from '../data/catalog.js';

export const LAB_VERSION = 1;
export const GAMES = ['sj', 'tb', 'ff', 'ww', 'bc', 'cf', 'sq'];
export const GAME_NAMES = { sj: 'Spell Jump', tb: 'Trail Blazer', ff: 'Fraction Fright', ww: 'Wagon West', bc: 'Build Crew', cf: 'Case Files', sq: "Pip's Squirrel Chase" };
export const DEVICE_STORAGE_KEY = 'learningLab.device';
export const PET_SPECIES = ['fox', 'owl', 'otter', 'dino'];
export const WEEK_FIELDS = ['xp', 'coins', 'zap', 'race', 'word', 'ft', 'leg', 'job'];
export const TROPHY_TIERS = ['gold', 'silver', 'bronze', 'brave'];
export const LIMITS = { dev: 12, weeks: 6, quests: 14, play: 28, gallery: 12, trophies: 40, crowns: 12, picks: 6, claimed: 12, crates: 200, pieces: 48, questIds: 3 };

export const labKey = (playerId) => `learningLab.${playerId}.lab`;
export const WEEK_RE = /^\d{4}-W\d{2}$/;
const DEV_RE = /^(?:[a-z0-9]{3,12}|_)$/;
const ITEM_RE = /^[a-z][a-z0-9]{0,7}\.[a-z0-9]{1,12}\.[a-z0-9-]{1,24}$/;
const SLOT_RE = /^[a-z][a-z0-9]{1,7}\.[a-z0-9]{2,12}$/;
const QUEST_RE = /^[a-z]{2,4}-[a-z]{2,16}$/;
const CRATE_RE = /^[a-z]{3,10}:[A-Za-z0-9_@:-]{1,28}$/;
const EVKEY_RE = /^[a-z]{2,3}\.[A-Za-z]{2,12}$/;
const GALID_RE = /^[A-Za-z0-9._-]{1,48}$/;
const GOAL_RE = /^[a-z]{2,12}$/;
const SUM_TEXT_RE = /[^A-Za-z0-9 '.,!:\/%+&()-]/g;
export const deviceKeyOk = (k) => typeof k === 'string' && DEV_RE.test(k);

// ---------- small helpers ----------
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const int = (v, lo = 0, hi = 1e9, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d);
const TS_MAX = 1e13;
const ts = (v) => int(v, 0, TS_MAX);          // a timestamp in ms
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const str = (v, re, d = '') => (typeof v === 'string' && re.test(v) ? v : d);
const sortedObject = (entries) => { const o = {}; for (const [k, v] of entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) o[k] = v; return o; };
const ownEntries = (o) => (isObj(o) ? Object.keys(o).map((k) => [k, o[k]]) : []);
const newestKeys = (keys, n) => keys.slice().sort().slice(-n);
export const jsonLater = (a, b) => (JSON.stringify(a) >= JSON.stringify(b) ? a : b);

// ---------- ISO-week helpers (the Lab's own; day keys are engagement.js's) ----------
/** The Monday ('YYYY-MM-DD') of an ISO week like '2026-W45'. */
export function mondayOfWeek(wk) {
  const y = Number(wk.slice(0, 4)), w = Number(wk.slice(6));
  const jan4 = `${y}-01-04`;
  const dow = new Date(Date.UTC(y, 0, 4)).getUTCDay() || 7;
  return addDays(jan4, 1 - dow + (w - 1) * 7);
}
export const weekShift = (wk, n) => weekOfDay(addDays(mondayOfWeek(wk), 7 * n));

// ---------- defaults ----------
export function defaultLab() {
  return {
    v: LAB_VERSION, resetAt: 0, dev: {}, paid: {}, owned: {}, equipped: {},
    pet: { species: 'fox', name: 'Pip', at: 0 },
    streak: normalizeStreak(null),
    quests: {}, crates: { earned: {}, opened: {} }, play: {}, weeks: {},
    fam: { week: '', goal: '', at: 0 }, picks: {}, claimed: {}, crowns: [], trophies: [], gallery: [],
    best: { sj: 0, tb: 0, ff: 0, ww: 0, bc: 0, cf: 0, sq: 0 },
    opts: { quests: true, board: true, goal: true, at: 0 },
    seen: { games: {}, welcome: 0 }, coinDay: { day: '', n: 0, ev: {} }, sum: {},
  };
}

export function cleanPetName(name) {
  return String(name == null ? '' : name).replace(/[^A-Za-z' -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10);
}

// ---------- normalize ----------
function normDev(raw) {
  const rows = ownEntries(raw).filter(([k, v]) => DEV_RE.test(k) && isObj(v)).map(([k, v]) => [k, { c: int(v.c), x: int(v.x) }]);
  const fold = rows.filter(([k]) => k === '_').map(([, v]) => v)[0] || { c: 0, x: 0 };
  let rest = rows.filter(([k]) => k !== '_');
  if (rows.length > LIMITS.dev) {
    rest.sort((a, b) => (b[1].c + b[1].x) - (a[1].c + a[1].x) || (a[0] < b[0] ? -1 : 1));
    const extra = rest.slice(LIMITS.dev - 1);
    rest = rest.slice(0, LIMITS.dev - 1);
    for (const [, v] of extra) { fold.c = Math.min(1e9, fold.c + v.c); fold.x = Math.min(1e9, fold.x + v.x); }
  }
  const out = rest.slice();
  if (fold.c || fold.x || rows.some(([k]) => k === '_')) out.push(['_', fold]);
  return sortedObject(out);
}
function normCount(raw, keyRe, hi = 1e9) {
  return sortedObject(ownEntries(raw).filter(([k, v]) => keyRe.test(k) && typeof v === 'number' && Number.isFinite(v)).slice(0, 400).map(([k, v]) => [k, int(v, 0, hi)]));
}
function normSlotAt(raw, owned) {
  const out = [];
  for (const [slot, v] of ownEntries(raw)) {
    if (!SLOT_RE.test(slot) || !Array.isArray(v)) continue;
    const id = typeof v[0] === 'string' ? v[0] : '';
    const base = SLOT_BY_KEY[slot] && SLOT_BY_KEY[slot].alias ? SLOT_BY_KEY[slot].alias : slot;
    if (id !== '' && (!ITEM_RE.test(id) || !id.startsWith(base + '.') || !(owned[id] !== undefined || isStock(id)))) continue;
    out.push([slot, [id, ts(v[1])]]);
  }
  return sortedObject(out);
}
function normQuests(raw) {
  const days = ownEntries(raw).filter(([k, v]) => isDayKey(k) && isObj(v));
  const keep = newestKeys(days.map(([k]) => k), LIMITS.quests);
  const out = [];
  for (const [day, q] of days) {
    if (!keep.includes(day)) continue;
    const ids = []; for (const id of Array.isArray(q.ids) ? q.ids : []) if (typeof id === 'string' && QUEST_RE.test(id) && !ids.includes(id) && ids.length < LIMITS.questIds) ids.push(id);
    const p = sortedObject(ownEntries(q.p).filter(([k, v]) => QUEST_RE.test(k) && typeof v === 'number').slice(0, 8).map(([k, v]) => [k, int(v, 0, 99999)]));
    const done = sortedObject(ownEntries(q.done).filter(([k, v]) => QUEST_RE.test(k) && typeof v === 'number').slice(0, 8)
    .map(([k, v]) => [k, ts(v)]));
    out.push([day, { ids, drawnAt: ts(q.drawnAt), rr: int(q.rr, 0, 9), tier: ['easy', 'mid', 'hard'].includes(q.tier) ? q.tier : 'easy', p, done }]);
  }
  return sortedObject(out);
}
function normCrates(raw, now) {
  const r = isObj(raw) ? raw : {};
  let earned = ownEntries(r.earned).filter(([k, v]) => CRATE_RE.test(k) && typeof v === 'number').slice(0, 400).map(([k, v]) => [k, ts(v)]);
  let opened = ownEntries(r.opened).filter(([k, v]) => CRATE_RE.test(k) && isObj(v)).slice(0, 400).map(([k, v]) => [k, {
    at: ts(v.at), id: typeof v.id === 'string' && ITEM_RE.test(v.id) ? v.id : '', coins: int(v.coins, 0, 1e6), r: ['c', 'r', 'e'].includes(v.r) ? v.r : 'c', pity: v.pity ? 1 : 0,
  }]);
  if (now > 0) {
    const cut = now - 120 * 86400000, old = new Set(earned.filter(([k, at]) => at > 0 && at < cut && opened.some(([o]) => o === k)).map(([k]) => k));
    earned = earned.filter(([k]) => !old.has(k)); opened = opened.filter(([k]) => !old.has(k));
  }
  const cap = (rows) => (rows.length > LIMITS.crates ? rows.sort((a, b) => (a[1].at ?? a[1]) - (b[1].at ?? b[1])).slice(-LIMITS.crates) : rows);
  return { earned: sortedObject(cap(earned)), opened: sortedObject(cap(opened)) };
}
function normPlay(raw) {
  const days = ownEntries(raw).filter(([k, v]) => isDayKey(k) && isObj(v));
  const keep = newestKeys(days.map(([k]) => k), LIMITS.play);
  return sortedObject(days.filter(([k]) => keep.includes(k)).map(([k, v]) => [k, Object.fromEntries(GAMES.map((g) => [g, int(v[g], 0, 99999)]))]));
}
function normWeeks(raw) {
  const wks = ownEntries(raw).filter(([k, v]) => WEEK_RE.test(k) && isObj(v));
  const keep = newestKeys(wks.map(([k]) => k), LIMITS.weeks);
  const out = [];
  for (const [wk, devs] of wks) {
    if (!keep.includes(wk)) continue;
    const rows = ownEntries(devs).filter(([k, v]) => DEV_RE.test(k) && isObj(v)).slice(0, LIMITS.dev).map(([k, v]) => {
      const o = {}; for (const f of WEEK_FIELDS) o[f] = int(v[f]);
      o.g = [...new Set((Array.isArray(v.g) ? v.g : []).filter((g) => GAMES.includes(g)))].sort();
      return [k, o];
    });
    out.push([wk, sortedObject(rows)]);
  }
  return sortedObject(out);
}
const sumText = (v, max) => String(typeof v === 'string' ? v : '').replace(SUM_TEXT_RE, '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Per-game summaries (core/summary.js): { sj: { level, line, today, lastPlayed } }, only the six games, text cleaned and cut. */
function normSum(raw) {
  const out = [];
  for (const [g, v] of ownEntries(raw)) {
    if (!GAMES.includes(g) || !isObj(v)) continue;
    const row = { level: sumText(v.level, 28), line: sumText(v.line, 44), today: sumText(v.today, 44), lastPlayed: ts(v.lastPlayed) };
    if (row.level || row.line || row.today || row.lastPlayed) out.push([g, row]);
  }
  return sortedObject(out);
}
function normTrophies(raw) {
  const seen = new Set(), out = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    if (!isObj(t) || !GAMES.includes(t.game) || typeof t.id !== 'string' || !/^[a-z0-9-]{1,16}$/.test(t.id)) continue;
    const row = { game: t.game, id: t.id, tier: TROPHY_TIERS.includes(t.tier) ? t.tier : 'brave', at: ts(t.at), n: int(t.n, 0, 999), of: int(t.of, 0, 999) };
    const key = `${row.game}|${row.id}|${row.at}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(row);
  }
  return out.sort((a, b) => b.at - a.at || (a.game + a.id < b.game + b.id ? -1 : 1)).slice(0, LIMITS.trophies);
}
export function cleanTitle(t) { return String(t == null ? '' : t).replace(/[^A-Za-z0-9 '.,!-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
export function cleanPieces(raw) {
  const out = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    if (!Array.isArray(p) || p.length < 5 || out.length >= LIMITS.pieces) continue;
    out.push([int(p[0], 0, 99), int(p[1], 0, 255), int(p[2], -9999, 9999), int(p[3], -9999, 9999), int(p[4], -9999, 9999)]);
  }
  return out;
}
function normGallery(raw) {
  const byId = new Map();
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!isObj(g) || typeof g.id !== 'string' || !GALID_RE.test(g.id)) continue;
    const row = { id: g.id, at: ts(g.at), kind: ['job', 'site', 'blueprint'].includes(g.kind) ? g.kind : 'job', title: cleanTitle(g.title), pieces: cleanPieces(g.pieces) };
    const cur = byId.get(row.id);
    if (!cur || row.at > cur.at || (row.at === cur.at && JSON.stringify(row) > JSON.stringify(cur))) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1)).slice(0, LIMITS.gallery);
}

// the shield-week stamp is informational (freezeView reads the used days); keep it derived from lastDay and the used days so merged docs agree
function canonStreak(st) {
  const wk = st.lastDay ? weekOfDay(st.lastDay) : '';
  st.shieldAvailableWeek = wk && !st.shieldUsedDays.some((d) => weekOfDay(d) === wk) ? wk : '';
  return st;
}

/** Coerce whatever was read into a valid lab doc. `now` (ms) only matters for pruning old opened crates (0 = no pruning, as sync's canon uses). */
export function normalizeLab(raw, now = 0) {
  const d = defaultLab();
  if (!isObj(raw)) return d;
  const owned = sortedObject(ownEntries(raw.owned).filter(([k, v]) => ITEM_RE.test(k) && typeof v === 'number' && Number.isFinite(v)).slice(0, 400).map(([k, v]) => [k, Math.max(1, ts(v))]));
  const sp = isObj(raw.pet) ? raw.pet : {};
  const pn = cleanPetName(sp.name);
  const op = isObj(raw.opts) ? raw.opts : {};
  const fam = isObj(raw.fam) ? raw.fam : {};
  const seen = isObj(raw.seen) ? raw.seen : {};
  const cd = isObj(raw.coinDay) ? raw.coinDay : {};
  const best = isObj(raw.best) ? raw.best : {};
  const picks = ownEntries(raw.picks).filter(([k, v]) => WEEK_RE.test(k) && Array.isArray(v) && GOAL_RE.test(String(v[0]))).map(([k, v]) => [k, [v[0], ts(v[1]), int(v[2])]]);
  const keepPicks = newestKeys(picks.map(([k]) => k), LIMITS.picks);
  const claimed = ownEntries(raw.claimed).filter(([k, v]) => /^fam:\d{4}-W\d{2}$/.test(k) && typeof v === 'number').map(([k, v]) => [k, ts(v)]);
  const keepClaimed = newestKeys(claimed.map(([k]) => k), LIMITS.claimed);
  return {
    v: int(raw.v, 1, 1000, LAB_VERSION),
    resetAt: ts(raw.resetAt),
    dev: normDev(raw.dev),
    paid: normCount(raw.paid, ITEM_RE, 1e6),
    owned,
    equipped: normSlotAt(raw.equipped, owned),
    pet: { species: PET_SPECIES.includes(sp.species) ? sp.species : 'fox', name: pn || 'Pip', at: ts(sp.at) },
    streak: canonStreak(normalizeStreak(raw.streak)),
    quests: normQuests(raw.quests),
    crates: normCrates(raw.crates, now),
    play: normPlay(raw.play),
    weeks: normWeeks(raw.weeks),
    fam: { week: str(fam.week, WEEK_RE), goal: str(fam.goal, GOAL_RE), at: ts(fam.at) },
    picks: sortedObject(picks.filter(([k]) => keepPicks.includes(k))),
    claimed: sortedObject(claimed.filter(([k]) => keepClaimed.includes(k))),
    crowns: [...new Set((Array.isArray(raw.crowns) ? raw.crowns : []).filter((c) => typeof c === 'string' && /^\d{4}-W\d{2}:(most|improved)$/.test(c)))].sort().slice(-LIMITS.crowns),
    trophies: normTrophies(raw.trophies),
    gallery: normGallery(raw.gallery),
    best: Object.fromEntries(GAMES.map((g) => [g, int(best[g], 0, 99999)])),
    opts: { quests: bool(op.quests, true), board: bool(op.board, true), goal: bool(op.goal, true), at: ts(op.at) },
    seen: {
      games: sortedObject(ownEntries(seen.games).filter(([k, v]) => GAMES.includes(k) && typeof v === 'number' && v > 0).map(([k, v]) => [k, Math.max(1, ts(v))])),
      welcome: ts(seen.welcome),
    },
    coinDay: { day: isDayKey(cd.day) ? cd.day : '', n: int(cd.n), ev: normCount(cd.ev, EVKEY_RE, 99999) },
    sum: normSum(raw.sum),
  };
}

// ---------- the wallet ----------
const sumOf = (o, f) => { let n = 0; for (const k of Object.keys(o || {})) n += f ? (o[k] && o[k][f]) || 0 : o[k] || 0; return n; };
/** Coins: lifetime earned (every device's counter, summed) minus everything paid. Never below 0. */
export function wallet(lab) {
  const earned = sumOf(lab.dev, 'c'), paid = sumOf(lab.paid);
  return { earned, paid, coins: Math.max(0, earned - paid) };
}
export const totalXp = (lab) => sumOf(lab.dev, 'x');
export const owns = (lab, id) => !!lab && (isStock(id) || (lab.owned && lab.owned[id] !== undefined));
export const itemDef = (id) => ITEM_BY_ID[id] || null;

/** A fresh device key: 6 base-36 characters from a random source. */
export function newDeviceKey(rand = Math.random) {
  let k = ''; for (let i = 0; i < 6; i++) k += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(rand() * 36) % 36];
  return k;
}
/** The doc's counter row for this device, created when missing. */
export function devRow(lab, device) {
  const k = deviceKeyOk(device) ? device : '_';
  return lab.dev[k] || (lab.dev[k] = { c: 0, x: 0 });
}
/** The weekly row for this device and ISO week, created when missing. */
export function weekRow(lab, wk, device) {
  const k = deviceKeyOk(device) ? device : '_';
  const w = lab.weeks[wk] || (lab.weeks[wk] = {});
  return w[k] || (w[k] = { xp: 0, coins: 0, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: [] });
}

/** Credit earned coins / XP to this device's counters and to the ISO week of ctx.day (coins and XP only: the caller counts the rest). */
export function creditEarned(lab, ctx, { coins = 0, xp = 0 } = {}) {
  const c = Math.max(0, Math.floor(coins)), x = Math.max(0, Math.floor(xp));
  if (!c && !x) return;
  const row = devRow(lab, ctx.device);
  row.c = Math.min(1e9, row.c + c); row.x = Math.min(1e9, row.x + x);
  const w = weekRow(lab, weekOfDay(ctx.day), ctx.device);
  w.coins += c; w.xp += x;
}
