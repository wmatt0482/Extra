// Family sync merge rules (pure, unit-tested in tools/spelling-tests.mjs). Used when both this device and the
// server changed the same key (a 409 on push, or a pull while local changes are still waiting) and on Join.
// Every function takes the local and the remote version and returns the merged data; neither input is mutated.
//
// family  players = union by id minus removedPlayers (same id: the later updatedAt wins); PIN hash: the later
//         pinUpdatedAt wins (Join adopts the family's PIN); per-player options: the later optionsUpdatedAt wins.
// words   lists = union by id minus deletedLists (same id: the later createdAt / archive state wins); the active list
//         comes from the side that chose it later (activeAt); records merged per word by the later lastSeen (higher
//         box on a tie); tests = union by date + score; today / streak from the doc with the later updatedAt. A reset
//         (resetAt) on one side drops the other side's older progress.
// save    the doc with the later updatedAt wins whole, except cash = max and owned cars / unlocked tracks = union
//         (also kept: the higher upgrade levels, best distances, records, earned badges), so nobody loses a car or
//         a track. A "Reset game save" (resetAt) on one side wins whole.
//         v3.3: xp = max; streak: the doc with the later lastDay wins count / lastDay (same day: the higher count),
//         best = max, shield days and counted days = union; cosmetics owned = union, equipped from the later doc;
//         crates earned / opened / sinceCosmetic = max each; trophies (per list) and champion = union; weekBest:
//         the later week, the farther jump within the same week.
// words   v3.7: a class list has the class list's id on every device, so the same week applied on two devices is one
//         list (the later copy's fields win; "Stop following" stamps editedAt so that edit wins).
// words   v3.3: a record's masteredAt comes with the winning record; when that one is Mastered without a date, the
//         other side's date is kept.
import { MAX_PLAYERS } from '../spelling/profiles.js';
import { normalizeWordsData } from '../spelling/wordStore.js';
import { normalize as normalizeSave } from '../meta/save.js';
import { isMastered } from '../spelling/scheduler.js';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const uniq = (...arrs) => { const out = []; for (const a of arrs) for (const x of Array.isArray(a) ? a : []) if (!out.includes(x)) out.push(x); return out; };

// the later of two values by timestamp; a tie is broken by content so both devices pick the same one
function later(a, ta, b, tb) {
  if (ta !== tb) return ta > tb ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** The part of the family record that is shared (migrated / lastPlayer stay on each device). */
export function familySyncData(f) {
  return {
    v: 1,
    players: (f.players || []).map((p) => ({ id: p.id, name: p.name, color: p.color, createdAt: num(p.createdAt), updatedAt: num(p.updatedAt) || num(p.createdAt) })),
    pinHash: f.pinHash || null,
    pinUpdatedAt: num(f.pinUpdatedAt),
    options: clone(f.options || {}),
    optionsUpdatedAt: clone(f.optionsUpdatedAt || {}),
    removedPlayers: (f.removedPlayers || []).slice(),
  };
}

export function mergeFamily(local, remote, { preferRemotePin = false } = {}) {
  if (!local) return clone(remote);
  if (!remote) return clone(local);
  const removed = uniq(local.removedPlayers, remote.removedPlayers).slice(-50);
  const byId = new Map();
  for (const p of [...(local.players || []), ...(remote.players || [])]) {
    if (!p || removed.includes(p.id)) continue;
    const cur = byId.get(p.id);
    byId.set(p.id, cur ? later(cur, num(cur.updatedAt) || num(cur.createdAt), p, num(p.updatedAt) || num(p.createdAt)) : p);
  }
  const players = [...byId.values()].sort((a, b) => num(a.createdAt) - num(b.createdAt) || (a.id < b.id ? -1 : 1)).slice(0, MAX_PLAYERS).map(clone);

  let pinSide;
  if (preferRemotePin && remote.pinHash) pinSide = remote;                       // Join: the family's PIN
  else if (!local.pinHash || !remote.pinHash) pinSide = local.pinHash ? local : remote;
  else if (num(local.pinUpdatedAt) !== num(remote.pinUpdatedAt)) pinSide = num(local.pinUpdatedAt) > num(remote.pinUpdatedAt) ? local : remote;
  else pinSide = local.pinHash >= remote.pinHash ? local : remote;

  const options = {}, optionsUpdatedAt = {};
  for (const p of players) {
    const lo = local.options && local.options[p.id], ro = remote.options && remote.options[p.id];
    const lt = num(local.optionsUpdatedAt && local.optionsUpdatedAt[p.id]), rt = num(remote.optionsUpdatedAt && remote.optionsUpdatedAt[p.id]);
    if (!lo && !ro) continue;
    const pick = !lo ? ro : !ro ? lo : lt !== rt ? (lt > rt ? lo : ro) : (JSON.stringify(lo) >= JSON.stringify(ro) ? lo : ro);
    options[p.id] = clone(pick);
    const t = pick === lo ? lt : rt;
    if (t) optionsUpdatedAt[p.id] = t;
  }
  return {
    v: Math.max(num(local.v), num(remote.v), 1), players,
    pinHash: pinSide.pinHash || null, pinUpdatedAt: pinSide.pinHash ? num(pinSide.pinUpdatedAt) : 0,
    options, optionsUpdatedAt, removedPlayers: removed,
  };
}

// ---------- words ----------
const listTime = (l) => Math.max(num(l.createdAt), num(l.archivedAt), num(l.editedAt));   // v3.7: editedAt (Stop following a class list)
function betterRecord(a, b) {
  if (num(a.lastSeen) !== num(b.lastSeen)) return num(a.lastSeen) > num(b.lastSeen) ? a : b;
  if (num(a.box) !== num(b.box)) return num(a.box) > num(b.box) ? a : b;
  if (num(a.attempts) !== num(b.attempts)) return num(a.attempts) > num(b.attempts) ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}
const testKey = (t) => `${t.kind}|${num(t.at)}|${num(t.correct)}/${num(t.total)}`;

/** local / remote: { updatedAt, data } (data = a player's words doc). */
export function mergeWords(local, remote, now = Date.now()) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const A = local.data, B = remote.data;
  const newer = later(local, num(local.updatedAt), remote, num(remote.updatedAt)).data;
  const resetA = num(A.resetAt), resetB = num(B.resetAt);
  const progress = resetA === resetB ? [A, B] : [resetA > resetB ? A : B];   // a reset drops the other side's older progress
  const deleted = uniq(A.deletedLists, B.deletedLists).slice(-100);

  const lists = new Map();
  for (const l of [...(A.lists || []), ...(B.lists || [])]) {
    if (!l || typeof l.id !== 'string' || deleted.includes(l.id)) continue;
    const cur = lists.get(l.id);
    lists.set(l.id, cur ? later(cur, listTime(cur), l, listTime(l)) : l);
  }
  const activeSide = num(A.activeAt) !== num(B.activeAt) ? (num(A.activeAt) > num(B.activeAt) ? A : B) : newer;
  let activeId = activeSide.activeId;
  if (!lists.has(activeId)) activeId = [A, B].map((d) => d.activeId).find((id) => lists.has(id)) || (lists.keys().next().value ?? null);
  let merged = [...lists.values()].map(clone);
  const active = merged.find((l) => l.id === activeId);
  if (active && !active.sample) merged = merged.filter((l) => !l.sample);       // the built-in list leaves once replaced
  merged.sort((a, b) => num(a.createdAt) - num(b.createdAt) || (a.id < b.id ? -1 : 1));

  const records = {};
  for (const d of progress) {
    for (const [w, r] of Object.entries(d.records || {})) {
      if (!r || typeof r !== 'object' || deleted.includes(r.listId)) continue;
      if (!records[w]) { records[w] = r; continue; }
      const win = betterRecord(records[w], r), lose = win === r ? records[w] : r;
      records[w] = !num(win.masteredAt) && num(lose.masteredAt) && isMastered(win) ? { ...win, masteredAt: num(lose.masteredAt) } : win;
    }
  }
  const tests = new Map();
  for (const d of progress) for (const t of d.tests || []) if (t && !deleted.includes(t.listId) && !tests.has(testKey(t))) tests.set(testKey(t), t);

  const base = progress.length === 2 ? newer : progress[0];
  const out = {
    v: Math.max(num(A.v), num(B.v), 1),
    lists: merged,
    activeId,
    records: clone(records),
    tests: [...tests.values()].sort((a, b) => num(a.at) - num(b.at)).slice(-60).map(clone),
    qualifierPending: activeSide.qualifierPending && merged.some((l) => l.id === activeSide.qualifierPending) ? activeSide.qualifierPending : null,
    today: clone(base.today),
    streak: num(base.streak),
    bestStreak: Math.max(...progress.map((d) => num(d.bestStreak))),
    perfectTotal: Math.max(...progress.map((d) => num(d.perfectTotal))),
  };
  // v3.8: the per-day progress log: each day's counts by max (both devices counted the same child)
  out.progress = {};
  for (const d of progress) for (const [day, p] of Object.entries(d.progress || {})) {
    const m = out.progress[day] || { mastered: 0, practiced: 0, right: 0 };
    out.progress[day] = { mastered: Math.max(num(m.mastered), num(p && p.mastered)), practiced: Math.max(num(m.practiced), num(p && p.practiced)), right: Math.max(num(m.right), num(p && p.right)) };
  }
  if (Math.max(num(A.activeAt), num(B.activeAt)) > 0) out.activeAt = Math.max(num(A.activeAt), num(B.activeAt));
  if (deleted.length) out.deletedLists = deleted;
  if (Math.max(resetA, resetB) > 0) out.resetAt = Math.max(resetA, resetB);
  return normalizeWordsData(out, now);
}

// ---------- game save ----------
/** local / remote: { updatedAt, data } (data = a player's game save). */
export function mergeSave(local, remote) {
  if (!local || !local.data) return clone(remote && remote.data);
  if (!remote || !remote.data) return clone(local.data);
  const ra = num(local.data.resetAt), rb = num(remote.data.resetAt);
  if (ra !== rb) return normalizeSave(clone(ra > rb ? local.data : remote.data));
  const newerDoc = later(local, num(local.updatedAt), remote, num(remote.updatedAt));
  const s = clone(newerDoc.data);
  const o = (newerDoc === local ? remote : local).data;
  s.cash = Math.max(num(s.cash), num(o.cash));
  s.owned = uniq(s.owned, o.owned);
  s.unlocked = uniq(s.unlocked, o.unlocked);
  s.levels = s.levels && typeof s.levels === 'object' ? s.levels : {};
  for (const [car, lv] of Object.entries(o.levels || {})) {
    if (!lv || typeof lv !== 'object') continue;
    const mine = s.levels[car] && typeof s.levels[car] === 'object' ? s.levels[car] : (s.levels[car] = {});
    for (const [k, v] of Object.entries(lv)) mine[k] = Math.max(num(mine[k]), num(v));
  }
  s.best = s.best && typeof s.best === 'object' ? s.best : {};
  for (const [t, v] of Object.entries(o.best || {})) s.best[t] = Math.max(num(s.best[t]), num(v));
  s.records = s.records && typeof s.records === 'object' ? s.records : {};
  for (const [k, v] of Object.entries(o.records || {})) s.records[k] = Math.max(num(s.records[k]), num(v));
  s.achievements = s.achievements && typeof s.achievements === 'object' ? s.achievements : {};
  for (const [id, t] of Object.entries(o.achievements || {})) if (num(t) > 0) s.achievements[id] = s.achievements[id] ? Math.min(num(s.achievements[id]), num(t)) : num(t);
  mergeEngagement(s, o);
  return normalizeSave(s);
}

/**
 * The streak rule (v3.3, shared with Trail Blazer's save sync in v3.6.3): the streak with the later lastDay wins count /
 * lastDay (the same day: the higher count), best = max, shield days and counted days = union.
 */
export function mergeStreak(sa, sb) {
  const a = obj(sa), b = obj(sb);
  const da = typeof a.lastDay === 'string' ? a.lastDay : '', db = typeof b.lastDay === 'string' ? b.lastDay : '';
  const win = da !== db ? (da > db ? a : b) : (num(a.count) >= num(b.count) ? a : b);   // ISO days compare as strings
  return {
    count: num(win.count), lastDay: win.lastDay || '', best: Math.max(num(a.best), num(b.best), num(win.count)),
    shieldAvailableWeek: win.shieldAvailableWeek || '',
    shieldUsedDays: uniq(a.shieldUsedDays, b.shieldUsedDays).sort(), days: uniq(a.days, b.days).sort(),
  };
}

// v3.3 fields; s = a clone of the later doc (modified in place), o = the other doc
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const arr = (x) => (Array.isArray(x) ? x : []);
function mergeEngagement(s, o) {
  s.xp = Math.max(num(s.xp), num(o.xp));
  s.streak = mergeStreak(s.streak, o.streak);
  const ca = obj(s.cosmetics), cb = obj(o.cosmetics);
  s.cosmetics = { skins: uniq(ca.skins, cb.skins), stickers: uniq(ca.stickers, cb.stickers), equipped: clone(obj(ca.equipped)) };
  const ka = obj(s.crates), kb = obj(o.crates);
  s.crates = { earned: Math.max(num(ka.earned), num(kb.earned)), opened: Math.max(num(ka.opened), num(kb.opened)), sinceCosmetic: Math.max(num(ka.sinceCosmetic), num(kb.sinceCosmetic)) };
  const ta = obj(s.trophies), tb = obj(o.trophies);
  s.trophies = {};
  for (const id of uniq(Object.keys(ta), Object.keys(tb))) s.trophies[id] = uniq(ta[id], tb[id]);
  s.champion = uniq(s.champion, o.champion);
  const wa = obj(s.weekBest), wb = obj(o.weekBest);
  const ka2 = typeof wa.week === 'string' ? wa.week : '', kb2 = typeof wb.week === 'string' ? wb.week : '';
  if (ka2 || kb2) s.weekBest = ka2 === kb2 ? { week: ka2, distance: Math.max(num(wa.distance), num(wb.distance)) } : clone(ka2 > kb2 ? wa : wb);
}

/** Dispatch by sync key: 'family' | '<id>.save' | '<id>.words' (Spell Jump's kinds; the client's registry dispatches
 *  every kind, Trail Blazer's tb / facts included). */
export function mergeKey(key, local, remote, opts) {
  if (key === 'family') return mergeFamily(local && local.data, remote && remote.data, opts);
  if (key.endsWith('.save')) return mergeSave(local, remote);
  return mergeWords(local, remote);
}
