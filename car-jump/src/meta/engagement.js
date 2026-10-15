// Spell Jump v3.3 engagement rules (SPEC "Engagement update"): daily streak with a weekly shield, speller XP and
// levels, mystery crates (weighted, with pity), mastery trophies + Week Champion, the weekly family board, and
// which cosmetics a player has earned. Pure functions over a player's game save (and words doc): every date comes
// in as `now` (ms) and every roll takes `rand`, so tools/spelling-tests.mjs runs them in Node. No DOM, no storage.
//
// save.streak   {count, best, lastDay 'YYYY-MM-DD', shieldAvailableWeek 'YYYY-Www' ('' = this week's shield is
//               spent), shieldUsedDays: [day], days: [day counted]}. A day counts once the daily mission (8 words)
//               or the Friday Test is complete. One shield per ISO week covers one missed day (the week of the
//               missed day); it is applied when the player next opens the game. Two misses in a week break it.
// save.xp       lifetime speller XP (XP in cosmetics.js); the level comes from LEVEL_XP.
// save.crates   {earned, opened, sinceCosmetic} monotonic counters; unopened = earned − opened.
// save.cosmetics {skins, stickers, equipped: {carId: {skin, sticker}}}
// save.trophies {listId: [mastered words]}, save.champion [listId] (Week Champion: every word of the list mastered)
// save.weekBest {week, distance} best jump (m) this ISO week (family board).
import {
  CRATE, LEVEL_XP, SKINS, SKIN_BY_ID, STICKERS, STICKER_BY_ID, STREAK_MILESTONES, XP, levelFor, levelProgress, levelTitle,
} from '../data/cosmetics.js';
import { dayKey, isMastered } from '../spelling/scheduler.js';

export { XP, levelFor, levelProgress, levelTitle };
const DAY = 86400000;

// ---------- dates (local calendar days, ISO weeks) ----------
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDayKey = (k) => typeof k === 'string' && DAY_RE.test(k);
const keyUTC = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const utcKey = (t) => { const d = new Date(t); const p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`; };
export const addDays = (k, n) => utcKey(keyUTC(k) + n * DAY);
export const dayDiff = (a, b) => Math.round((keyUTC(b) - keyUTC(a)) / DAY);   // b − a in days
export function weekOfDay(k) {
  const d = new Date(keyUTC(k));
  const dow = d.getUTCDay() || 7;                                // Monday = 1 … Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dow);                       // the Thursday of that week names the ISO year
  const y = d.getUTCFullYear();
  const wk = Math.ceil(((d.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}
export const isoWeek = (now) => weekOfDay(dayKey(now));
export const mondayOf = (now) => { const k = dayKey(now); const dow = new Date(keyUTC(k)).getUTCDay() || 7; return addDays(k, 1 - dow); };

// ---------- save shape (used by save.js normalize) ----------
export const defaultStreak = () => ({ count: 0, best: 0, lastDay: '', shieldAvailableWeek: '', shieldUsedDays: [], days: [] });
export const defaultCosmetics = () => ({ skins: [], stickers: [], equipped: {} });
export const defaultCrates = () => ({ earned: 0, opened: 0, sinceCosmetic: 0 });

// ---------- daily streak ----------
const shieldFreeIn = (used, week) => !used.some((d) => weekOfDay(d) === week);

// The missed days strictly between `from` and `to`: each must be covered by a shield already used on it, or by the
// unused shield of its own ISO week. Returns {ok, shields: [days that would use a new shield]}.
function coverGap(st, from, to) {
  const used = st.shieldUsedDays.slice(), shields = [];
  const n = dayDiff(from, to);
  if (n > 60) return { ok: false, shields: [] };
  for (let i = 1; i < n; i++) {
    const k = addDays(from, i);
    if (used.includes(k)) continue;
    if (!shieldFreeIn(used, weekOfDay(k))) return { ok: false, shields: [] };
    used.push(k); shields.push(k);
  }
  return { ok: true, shields };
}
function stampShieldWeek(st, now) {
  const wk = isoWeek(now);
  st.shieldAvailableWeek = shieldFreeIn(st.shieldUsedDays, wk) ? wk : '';
}

/** The streak shown right now: the count while it is still alive (only shieldable gaps since lastDay), else 0. */
export function streakNow(st, now) {
  if (!st || !isDayKey(st.lastDay) || !st.count) return 0;
  const today = dayKey(now);
  if (dayDiff(st.lastDay, today) <= 0) return st.count;
  return coverGap(st, st.lastDay, today).ok ? st.count : 0;
}

/** The player opened the game: missed days since the last counted day use their week's shield (when every gap
 *  day can be covered). Returns the newly shielded days ([] when nothing changed or the streak is broken). */
export function refreshStreak(save, now) {
  const st = save.streak;
  let shields = [];
  if (isDayKey(st.lastDay) && st.count > 0) {
    const g = coverGap(st, st.lastDay, dayKey(now));
    if (g.ok && g.shields.length) { shields = g.shields; st.shieldUsedDays = [...st.shieldUsedDays, ...shields].sort().slice(-60); }
  }
  stampShieldWeek(st, now);
  return shields;
}

export const nextMilestone = (count) => STREAK_MILESTONES.find((m) => m > count) || null;
export const streakRewards = (days) => [...SKINS.filter((s) => s.source === 'streak' && s.days === days).map((s) => ({ type: 'skin', id: s.id, name: s.name })),
  ...STICKERS.filter((s) => s.source === 'streak' && s.days === days).map((s) => ({ type: 'sticker', id: s.id, name: s.name }))];

/** Today's mission (or the Friday Test) is done: count the day once. A milestone pays a crate (and 7 / 14 / 30 days
 *  unlock their cosmetics). Returns {counted, count, best, milestone, shields, crates, unlocks}. */
export function completeDay(save, now) {
  const st = save.streak;
  const today = dayKey(now);
  const out = { counted: false, count: st.count, best: st.best, milestone: null, shields: [], crates: 0, unlocks: [] };
  if (st.lastDay === today || (isDayKey(st.lastDay) && dayDiff(st.lastDay, today) < 0)) return out;
  if (isDayKey(st.lastDay) && st.count > 0) {
    const g = coverGap(st, st.lastDay, today);
    if (g.ok) { st.count += 1; out.shields = g.shields; st.shieldUsedDays = [...st.shieldUsedDays, ...g.shields].sort().slice(-60); }
    else st.count = 1;
  } else st.count = 1;
  st.lastDay = today;
  if (!st.days.includes(today)) st.days = [...st.days, today].sort().slice(-120);
  st.best = Math.max(st.best, st.count);
  stampShieldWeek(st, now);
  Object.assign(out, { counted: true, count: st.count, best: st.best });
  if (STREAK_MILESTONES.includes(st.count)) {
    out.milestone = st.count;
    out.crates = 1;
    save.crates.earned += 1;
  }
  out.unlocks = grantEarned(save);
  return out;
}

// ---------- XP + levels ----------
/** Add XP; returns {gained, before, after, levelBefore, levelAfter, levelUp, unlocks}. */
export function addXp(save, amount) {
  const before = save.xp || 0;
  const gained = Math.max(0, Math.round(amount || 0));
  save.xp = before + gained;
  const levelBefore = levelFor(before), levelAfter = levelFor(save.xp);
  return { gained, before, after: save.xp, levelBefore, levelAfter, levelUp: levelAfter > levelBefore, unlocks: levelAfter > levelBefore ? grantEarned(save) : [] };
}
export const levelRewards = (level) => [...SKINS.filter((s) => s.source === 'level' && s.level === level).map((s) => ({ type: 'skin', id: s.id, name: s.name })),
  ...STICKERS.filter((s) => s.source === 'level' && s.level === level).map((s) => ({ type: 'sticker', id: s.id, name: s.name }))];

// ---------- cosmetics ----------
const kindKey = (type) => (type === 'skin' ? 'skins' : 'stickers');
export const owns = (save, type, id) => (type === 'skin' ? id === 'stock' : id === 'none') || save.cosmetics[kindKey(type)].includes(id);
function grant(save, type, id) {
  const arr = save.cosmetics[kindKey(type)];
  if (arr.includes(id)) return false;
  arr.push(id);
  return true;
}
/** Everything the player has earned by the rules (streak best, level, Week Champion) is owned. Returns the newly
 *  granted [{type, id, name}] (for "Unlocked" toasts). Crate cosmetics only come from crates. */
export function grantEarned(save) {
  const level = levelFor(save.xp || 0);
  const best = save.streak ? save.streak.best : 0;
  const champ = Array.isArray(save.champion) && save.champion.length > 0;
  const out = [];
  const earned = (c) => (c.source === 'level' && level >= c.level) || (c.source === 'streak' && best >= c.days) || (c.source === 'champion' && champ);
  for (const s of SKINS) if (earned(s) && grant(save, 'skin', s.id)) out.push({ type: 'skin', id: s.id, name: s.name });
  for (const s of STICKERS) if (earned(s) && grant(save, 'sticker', s.id)) out.push({ type: 'sticker', id: s.id, name: s.name });
  return out;
}
/** How to earn a cosmetic, for the garage's locked chips: "Crate", "7-day streak", "Level 8", "Week Champion". */
export function earnHint(c) {
  if (c.source === 'crate') return 'Crate';
  if (c.source === 'streak') return `${c.days}-day streak`;
  if (c.source === 'level') return `Level ${c.level}`;
  if (c.source === 'champion') return 'Week Champion';
  return '';
}
/** The equipped look of a car as ids: {skin, sticker} ('stock' / 'none' when nothing is equipped). */
export function equippedFor(save, carId) {
  const e = (save.cosmetics.equipped || {})[carId] || {};
  return { skin: e.skin && owns(save, 'skin', e.skin) ? e.skin : 'stock', sticker: e.sticker && owns(save, 'sticker', e.sticker) ? e.sticker : 'none' };
}
/** The look for the renderer: cosmetics.js entries or null (stock). */
export function lookFor(save, carId) {
  const e = equippedFor(save, carId);
  return { skin: e.skin !== 'stock' ? SKIN_BY_ID[e.skin] || null : null, sticker: e.sticker !== 'none' ? STICKER_BY_ID[e.sticker] || null : null };
}
export function equip(save, carId, type, id) {
  if (!owns(save, type, id)) return false;
  const eq = save.cosmetics.equipped;
  const cur = { ...equippedFor(save, carId) };
  cur[type] = id;
  if (cur.skin === 'stock' && cur.sticker === 'none') delete eq[carId];
  else eq[carId] = { skin: cur.skin, sticker: cur.sticker };
  return true;
}

// ---------- mystery crates ----------
export const unopened = (save) => Math.max(0, (save.crates.earned || 0) - (save.crates.opened || 0));
const CRATE_SKINS = SKINS.filter((s) => s.source === 'crate');
const CRATE_STICKERS = STICKERS.filter((s) => s.source === 'crate');
const weightOf = (kind) => (CRATE.outcomes.find((o) => o.kind === kind) || { weight: 0 }).weight;
/** Cash for a crate: $300-800 (multiples of $10) × the selected car's tier. */
export function crateCash(tier, rand) {
  const o = CRATE.outcomes.find((x) => x.kind === 'cash');
  return Math.round(((o.min + rand() * (o.max - o.min)) * Math.max(1, tier || 1)) / 10) * 10;
}
/**
 * Roll one crate (does not change the save). Weighted: cash 60 / sticker 25 / skin 12 / jackpot 3 (cash × 3).
 * Pity: the 5th crate in a row without a cosmetic is a cosmetic the player does not own yet (when any is left).
 * A duplicate cosmetic rolls again once; a second duplicate converts to cash.
 * Returns {kind: 'cash'|'jackpot'|'skin'|'sticker', cash?, id?, name?, pity, converted?}.
 */
export function rollCrate(save, { tier = 1, rand = Math.random } = {}) {
  const pity = (save.crates.sinceCosmetic || 0) >= CRATE.pityEvery - 1;
  const pools = { skin: CRATE_SKINS, sticker: CRATE_STICKERS };
  const missing = (kind) => pools[kind].filter((c) => !owns(save, kind, c.id));
  let kind;
  if (pity && (missing('sticker').length || missing('skin').length)) {
    const s = weightOf('sticker'), k = weightOf('skin');
    kind = rand() * (s + k) < s ? 'sticker' : 'skin';
    if (!missing(kind).length) kind = kind === 'skin' ? 'sticker' : 'skin';
    const pool = missing(kind);
    const c = pool[Math.floor(rand() * pool.length) % pool.length];
    return { kind, id: c.id, name: c.name, pity: true };
  }
  const total = CRATE.outcomes.reduce((a, o) => a + o.weight, 0);
  let r = rand() * total;
  kind = CRATE.outcomes[CRATE.outcomes.length - 1].kind;
  for (const o of CRATE.outcomes) { r -= o.weight; if (r < 0) { kind = o.kind; break; } }
  if (kind === 'cash') return { kind, cash: crateCash(tier, rand), pity: false };
  if (kind === 'jackpot') return { kind, cash: crateCash(tier, rand) * (CRATE.outcomes.find((o) => o.kind === 'jackpot').mult || 3), pity: false };
  const pool = pools[kind];
  let c = pool[Math.floor(rand() * pool.length) % pool.length];
  if (owns(save, kind, c.id)) c = pool[Math.floor(rand() * pool.length) % pool.length];      // a duplicate rolls again, once
  if (owns(save, kind, c.id)) return { kind: 'cash', cash: crateCash(tier, rand), pity: false, converted: kind, duplicate: c.id };
  return { kind, id: c.id, name: c.name, pity: false };
}
/** Open one unopened crate: roll, apply (cash is earned, cosmetics are granted), count it. null when none waits. */
export function openCrate(save, opts = {}) {
  if (unopened(save) <= 0) return null;
  const out = rollCrate(save, opts);
  if (out.cash) { save.cash += out.cash; save.records.lifetimeCash += out.cash; }
  const cosmetic = out.kind === 'skin' || out.kind === 'sticker';
  if (cosmetic) grant(save, out.kind, out.id);
  save.crates.opened += 1;
  save.crates.sinceCosmetic = cosmetic ? 0 : (save.crates.sinceCosmetic || 0) + 1;
  return out;
}
export function earnCrate(save, n = 1) { save.crates.earned += n; return n; }

// ---------- mastery trophies + Week Champion ----------
export function addTrophy(save, listId, word) {
  if (!listId) return false;
  const arr = save.trophies[listId] || (save.trophies[listId] = []);
  if (arr.includes(word)) return false;
  arr.push(word);
  return true;
}
const activeOf = (words) => (words && Array.isArray(words.lists) ? words.lists.find((l) => l.id === words.activeId) || words.lists[0] : null);
/** Every word of the active list is Mastered. */
export function allMastered(words) {
  const l = activeOf(words);
  return !!l && l.words.length > 0 && l.words.every((w) => isMastered(words.records[w.word]));
}
/** Week Champion check after a word was mastered: the first time every word of the active list is Mastered, the
 *  player gets the champion badge (save.champion), the Champion Chrome skin + Trophy sticker, a crate and +300 XP.
 *  Returns null, or {listId, xp: addXp result, unlocks}. */
export function checkChampion(save, words) {
  const l = activeOf(words);
  if (!l || !allMastered(words) || save.champion.includes(l.id)) return null;
  save.champion.push(l.id);
  for (const w of l.words) addTrophy(save, l.id, w.word);
  const unlocks = grantEarned(save);
  save.crates.earned += 1;
  const xp = addXp(save, XP.champion);
  return { listId: l.id, xp, unlocks: [...unlocks, ...xp.unlocks] };
}
/** Champion of this week's words, won this ISO week (the crown on the family board). */
export function championThisWeek(save, words, now) {
  const l = activeOf(words);
  if (!l || !save.champion.includes(l.id) || !allMastered(words)) return false;
  const last = Math.max(0, ...l.words.map((w) => (words.records[w.word] && words.records[w.word].masteredAt) || 0));
  return last > 0 && isoWeek(last) === isoWeek(now);
}
/** Trophy shelf for the Trophies panel: this week's list (slots) and past lists, newest first. */
export function trophyShelf(save, words) {
  const l = activeOf(words);
  const slot = (list) => list.words.map((w) => ({ word: w.word, mastered: isMastered(words.records[w.word]) || ((save.trophies[list.id] || []).includes(w.word) && list.id !== words.activeId) }));
  const past = (words.lists || []).filter((x) => x !== l).sort((a, b) => (b.archivedAt || b.createdAt) - (a.archivedAt || a.createdAt))
    .map((x) => ({ id: x.id, name: x.name, champion: save.champion.includes(x.id), slots: slot(x) }));
  return { current: l ? { id: l.id, name: l.name, sample: !!l.sample, champion: save.champion.includes(l.id), slots: slot(l) } : null, past };
}

// ---------- weekly best jump ----------
export function noteJump(save, distance, now) {
  const wk = isoWeek(now), d = Math.floor(distance || 0);
  if (!save.weekBest || save.weekBest.week !== wk) save.weekBest = { week: wk, distance: 0 };
  if (d > save.weekBest.distance) { save.weekBest.distance = d; return true; }
  return false;
}

// ---------- family board ----------
/** One player's numbers for this ISO week: words mastered this week, current streak, best jump this week (m). */
export function weekStats(save, words, now) {
  const wk = isoWeek(now);
  const mastered = Object.values((words && words.records) || {}).filter((r) => isMastered(r) && r.masteredAt > 0 && isoWeek(r.masteredAt) === wk).length;
  return {
    mastered,
    streak: streakNow(save.streak, now),
    best: save.weekBest && save.weekBest.week === wk ? save.weekBest.distance : 0,
    champion: championThisWeek(save, words, now),
    level: levelFor(save.xp || 0),
  };
}
const cmpRows = (a, b) => b.mastered - a.mastered || b.streak - a.streak || b.best - a.best;
/** entries: [{player: {id, name, color}, save, words}] → rows ranked (words mastered, then streak, then best jump).
 *  Ties share a rank. `leader` is set on the single top row when there are 2+ players and it is strictly ahead. */
export function weeklyBoard(entries, now) {
  const rows = entries.map(({ player, save, words }) => ({ id: player.id, name: player.name, color: player.color, ...weekStats(save, words, now) }));
  rows.sort((a, b) => cmpRows(a, b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  rows.forEach((r, i) => { r.rank = i > 0 && cmpRows(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; r.leader = false; });
  if (rows.length > 1 && cmpRows(rows[0], rows[1]) < 0 && (rows[0].mastered || rows[0].streak || rows[0].best)) rows[0].leader = true;
  return rows;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** One line under the board for the selected player: "Mia is 2 words ahead" / "You're in the lead!" ('' with one player). */
export function boardNudge(rows, id) {
  if (rows.length < 2) return '';
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return '';
  const me = rows[i];
  if (i === 0 || cmpRows(rows[0], me) === 0) {
    if (!me.mastered && !me.streak && !me.best) return 'Master a word to get on the board!';
    return rows.filter((r) => cmpRows(r, me) === 0).length > 1 ? "You're tied for the lead!" : "You're in the lead!";
  }
  // the player just ahead
  let j = i - 1;
  while (j > 0 && cmpRows(rows[j], me) === 0) j--;
  const a = rows[j];
  if (a.mastered > me.mastered) return `${a.name} is ${plural(a.mastered - me.mastered, 'word')} ahead`;
  if (a.streak > me.streak) return `${a.name}'s streak is ${plural(a.streak - me.streak, 'day')} longer`;
  return `${a.name} jumped ${a.best - me.best} m farther`;
}

// ---------- normalize helpers (save.js) ----------
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const days = (v, cap) => (Array.isArray(v) ? [...new Set(v.filter(isDayKey))].sort().slice(-cap) : []);
export function normalizeStreak(raw) {
  const s = defaultStreak();
  if (!raw || typeof raw !== 'object') return s;
  s.count = Math.max(0, Math.floor(num(raw.count)));
  s.best = Math.max(s.count, Math.floor(num(raw.best)));
  s.lastDay = isDayKey(raw.lastDay) ? raw.lastDay : '';
  s.shieldAvailableWeek = typeof raw.shieldAvailableWeek === 'string' && /^\d{4}-W\d{2}$/.test(raw.shieldAvailableWeek) ? raw.shieldAvailableWeek : '';
  s.shieldUsedDays = days(raw.shieldUsedDays, 60);
  s.days = days(raw.days, 120);
  return s;
}
export function normalizeCosmetics(raw, carIds) {
  const c = defaultCosmetics();
  if (!raw || typeof raw !== 'object') return c;
  c.skins = [...new Set((Array.isArray(raw.skins) ? raw.skins : []).filter((id) => SKIN_BY_ID[id] && id !== 'stock'))];
  c.stickers = [...new Set((Array.isArray(raw.stickers) ? raw.stickers : []).filter((id) => STICKER_BY_ID[id] && id !== 'none'))];
  if (raw.equipped && typeof raw.equipped === 'object') {
    for (const [car, e] of Object.entries(raw.equipped)) {
      if (!carIds.includes(car) || !e || typeof e !== 'object') continue;
      const skin = SKIN_BY_ID[e.skin] ? e.skin : 'stock', sticker = STICKER_BY_ID[e.sticker] ? e.sticker : 'none';
      if (skin !== 'stock' || sticker !== 'none') c.equipped[car] = { skin, sticker };
    }
  }
  return c;
}
export function normalizeCrates(raw) {
  const c = defaultCrates();
  if (!raw || typeof raw !== 'object') return c;
  c.earned = Math.max(0, Math.floor(num(raw.earned)));
  c.opened = Math.max(0, Math.min(c.earned, Math.floor(num(raw.opened))));
  c.sinceCosmetic = Math.max(0, Math.floor(num(raw.sinceCosmetic)));
  return c;
}
export function normalizeTrophies(raw) {
  const t = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return t;
  for (const [id, ws] of Object.entries(raw)) {
    if (typeof id !== 'string' || id.length > 40 || !Array.isArray(ws)) continue;
    const list = [...new Set(ws.filter((w) => typeof w === 'string' && w.length < 40))].slice(0, 60);
    if (list.length) t[id] = list;
  }
  return t;
}
export const LEVEL_MAX = LEVEL_XP.length;
