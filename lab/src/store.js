// The Lab store (lab/SPEC.md §3.4): the only module with localStorage. One lab doc per child at learningLab.<id>.lab, the doc kept in memory,
// merged with whatever the sync client (or another tab) wrote behind its back before every action, written debounced (400 ms) and at once on
// the moments that matter, and announced to the family sync with localWrite. Nothing here ever throws out of report(): a blocked or full
// storage just means the doc lives in memory for the page.
import { FAMILY_KEY, normalizeFamily } from '../../spell-jump/src/spelling/profiles.js';
import { dayKey } from '../../spell-jump/src/spelling/scheduler.js';
import { weekOfDay } from '../../spell-jump/src/meta/engagement.js';
import { localWrite } from '../../spell-jump/src/sync/notify.js';
import { DEVICE_STORAGE_KEY, cleanPetName, defaultLab, deviceKeyOk, labKey, newDeviceKey, normalizeLab, PET_SPECIES, totalXp, weekShift, wallet } from './core/model.js';
import { NOOP_RECEIPT, applyEvent, beginRound, grantLevelGifts, newSession, roundSummary } from './core/engine.js';
import { mergeLab, setLocalDevice } from './core/merge.js';
import { ensureToday, rerollQuest, QUEST_BY_ID } from './core/quests.js';
import { labRefresh } from './core/streak.js';
import { buy as shopBuy, equip as shopEquip } from './core/shop.js';
import { openCrate as crateOpen } from './core/crate.js';
import { boardFor, claimGoal as familyClaim, ensureGoalPick, goalFor, settleCrowns } from './core/family.js';
import { buildView } from './core/view.js';
import { levelFor } from './core/xp.js';
import { GOAL_CLAIM_WINDOW } from './data/goals.js';
import { registerLabSync, markLabDocsDirty } from './sync.js';

const WRITE_DELAY_MS = 400;
const IMMEDIATE_EVENTS = ['leg', 'job', 'test', 'day'];
const DAY_MS = 86400000;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

export function createLabStore({ storage, now = Date.now, rand = Math.random, deviceKey, sync = true } = {}) {
  let ls = storage;
  if (ls === undefined) { try { ls = globalThis.localStorage || null; } catch (_) { ls = null; } }
  const mem = memoryStorage();
  let skew = 0;
  const clock = () => now() + skew;
  const read = (k) => { try { return ls ? ls.getItem(k) : mem.getItem(k); } catch (_) { return null; } };
  const write = (k, v) => { try { if (ls) ls.setItem(k, v); else mem.setItem(k, v); return true; } catch (_) { return false; } };

  // this browser profile's device key (shared by every game page on the device)
  let device = deviceKeyOk(deviceKey) && deviceKey !== '_' ? deviceKey : '';
  if (!device) { const saved = read(DEVICE_STORAGE_KEY); if (deviceKeyOk(saved) && saved !== '_') device = saved; }
  if (!device) { device = newDeviceKey(rand); write(DEVICE_STORAGE_KEY, device); }
  setLocalDevice(device);

  let player = null, info = {}, lab = null, lastWritten = null, dirty = false, timer = 0, ready = [], hooked = false;
  const sessions = {};
  const subs = new Set();
  let familyCache = { raw: null, players: [] };
  const docCache = new Map();

  const emit = (e) => { for (const fn of [...subs]) { try { fn(e); } catch (err) { console.warn('[lab] subscriber error', err); } } };
  const sessionFor = (game) => sessions[game] || (sessions[game] = newSession(game));
  const ctx = (game) => {
    const t = clock();
    const g = game || info.game || 'sj';
    return { playerId: player.id, name: player.name, color: player.color, device, now: t, day: dayKey(t), gentle: !!info.gentle, game: g, session: sessionFor(g) };
  };

  // ---------- load / refresh / persist ----------
  function load() {
    const key = labKey(player.id);
    const raw = read(key);
    let doc = null;
    if (raw != null) {
      try { doc = JSON.parse(raw); } catch (_) { write(`${key}.corrupt`, raw); doc = null; }
    }
    lab = normalizeLab(doc, clock());
    lastWritten = raw != null && doc ? raw : null;
    dirty = lastWritten === null;
  }
  // the doc was replaced behind our back (the sync client applied a pull, or another tab wrote): merge it into memory
  function refresh() {
    if (!player) return false;
    const raw = read(labKey(player.id));
    if (raw == null || raw === lastWritten) return false;
    let stored;
    try { stored = JSON.parse(raw); } catch (_) { return false; }
    lab = mergeLab({ updatedAt: 0, data: lab }, { updatedAt: 0, data: stored }, { device });
    lastWritten = raw;
    dirty = JSON.stringify(lab) !== JSON.stringify(normalizeLab(stored, 0));
    emit({ type: 'sync' });
    return true;
  }
  function persist() {
    clearTimeout(timer); timer = 0;
    if (!player || !lab || !dirty) return false;
    lab = normalizeLab(lab, clock());
    const text = JSON.stringify(lab);
    dirty = false;
    if (text === lastWritten) return false;
    if (!write(labKey(player.id), text)) { dirty = true; return false; }
    lastWritten = text;
    try { localWrite(labKey(player.id)); } catch (_) { /* ignore */ }
    return true;
  }
  function schedule(immediate) {
    dirty = true;
    if (immediate) { persist(); return; }
    if (!timer) {
      timer = setTimeout(persist, WRITE_DELAY_MS);
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
  }
  function hook() {
    if (hooked || typeof window === 'undefined') return;
    hooked = true;
    try {
      window.addEventListener('pagehide', () => persist());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
      window.addEventListener('storage', (e) => { if (player && e.key === labKey(player.id)) { refresh(); emit({ type: 'sync' }); } });
    } catch (_) { /* ignore */ }
  }

  // ---------- the family (from the mirrored docs of every child) ----------
  function familyPlayers() {
    const raw = read(FAMILY_KEY);
    if (raw !== familyCache.raw) {
      let list = [];
      try { const f = normalizeFamily(JSON.parse(raw)); list = f ? f.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) : []; } catch (_) { list = []; }
      familyCache = { raw, players: list };
    }
    const list = familyCache.players.slice();
    if (player && !list.some((p) => p.id === player.id)) list.push({ id: player.id, name: player.name, color: player.color });
    return list;
  }
  function docOf(id) {
    if (player && id === player.id) return lab;
    const raw = read(labKey(id));
    if (raw == null) return null;
    const hit = docCache.get(id);
    if (hit && hit.raw === raw) return hit.doc;
    let doc = null;
    try { doc = normalizeLab(JSON.parse(raw), 0); } catch (_) { doc = null; }
    docCache.set(id, { raw, doc });
    return doc;
  }
  const familyWith = () => familyPlayers().map((p) => ({ ...p, lab: docOf(p.id) }));

  // ---------- the store ----------
  const store = {
    get player() { return player; },
    get device() { return device; },
    get ready() { return ready; },
    setReady(ids) { ready = Array.isArray(ids) ? ids.slice() : []; emit({ type: 'ready' }); },
    now: () => clock(),

    /** info = { game, playerId, name, color, gentle, reducedMotion, sound }. Idempotent; switching player = attach again. */
    attach(i) {
      if (!i || typeof i.playerId !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(i.playerId)) return false;
      if (player && player.id !== i.playerId) persist();
      info = { ...info, ...i };
      const same = player && player.id === i.playerId;
      player = { id: i.playerId, name: String(i.name || ''), color: String(i.color || '') };
      if (!same) {
        load();
        const c = ctx(i.game);
        labRefresh(lab, c.now);
        ensureToday(lab, c);
        grantLevelGifts(lab, c, levelFor(totalXp(lab)));
        touchFamily(c);
        dirty = true;
        if (sync) { try { registerLabSync(); markLabDocsDirty(familyPlayers().map((p) => p.id)); } catch (e) { console.warn('[lab] sync not registered', e); } }
        persist();
      }
      hook();
      emit({ type: 'attach' });
      return true;
    },
    detach() { persist(); player = null; lab = null; lastWritten = null; emit({ type: 'detach' }); },

    doc() { if (!player) return null; refresh(); return lab; },
    report(ev) {
      try {
        if (!player || !ev) return NOOP_RECEIPT;
        refresh();
        const c = ctx(ev.game);
        const receipt = applyEvent(lab, c, ev);
        if (!receipt.ok) return receipt;
        schedule(IMMEDIATE_EVENTS.includes(ev.event) || receipt.level.up || receipt.crate);
        emit({ type: 'report', receipt, event: ev });
        return receipt;
      } catch (e) { console.warn('[lab] report error', e); return NOOP_RECEIPT; }
    },
    beginRound(game) { try { beginRound(sessionFor(game || info.game || 'sj'), clock()); emit({ type: 'round' }); } catch (_) { /* ignore */ } },
    roundSummary(game) { if (!player) return null; refresh(); return roundSummary(lab, ctx(game), sessionFor(game || info.game || 'sj')); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    view(game) { if (!player) return null; refresh(); return buildView(lab, ctx(game), { ready }); },

    buy(id) {
      if (!player) return { ok: false, spent: 0, reason: 'none' };
      refresh();
      const r = shopBuy(lab, ctx(), id, { ready });
      if (r.ok) { schedule(true); emit({ type: 'buy', id }); }
      return r;
    },
    equip(slotKey, id) {
      if (!player) return false;
      refresh();
      const ok = shopEquip(lab, ctx(), slotKey, id);
      if (ok) { schedule(false); emit({ type: 'equip', slotKey, id }); }
      return ok;
    },
    openCrate(key) {
      if (!player) return null;
      refresh();
      const k = key || (this.view().crates.nextKey);
      const r = k ? crateOpen(lab, ctx(), k, { ready }) : null;
      if (r && !r.again) { schedule(true); emit({ type: 'crate', key: k, result: r }); }
      return r;
    },
    rerollQuest(index) {
      if (!player) return { ok: false, reason: 'none' };
      refresh();
      const r = rerollQuest(lab, ctx(), index);
      if (r.ok) { schedule(false); emit({ type: 'quests' }); }
      return r;
    },
    claimGoal(wk) {
      if (!player) return { ok: false, reason: 'none' };
      refresh();
      const c = ctx(), players = familyWith();
      const cur = weekOfDay(c.day);
      const weeks = wk ? [wk] : [0, 1, 2, 3].slice(0, GOAL_CLAIM_WINDOW).map((i) => weekShift(cur, -i));
      let last = { ok: false, item: null, coins: 0, reason: 'unmet' };
      for (const w of weeks) { last = familyClaim(lab, c, w, players); if (last.ok) break; }
      if (last.ok) { schedule(true); emit({ type: 'goal' }); }
      return last;
    },
    setPet({ species, name } = {}) {
      if (!player) return false;
      refresh();
      const next = { ...lab.pet };
      if (PET_SPECIES.includes(species)) next.species = species;
      if (name !== undefined) { const n = cleanPetName(name); if (n) next.name = n; }
      next.at = Math.max(clock(), lab.pet.at + 1);
      lab.pet = next;
      schedule(false); emit({ type: 'pet' });
      return true;
    },
    setOpt(key, on) {
      if (!player || !['quests', 'board', 'goal'].includes(key)) return false;
      refresh();
      lab.opts = { ...lab.opts, [key]: !!on, at: Math.max(clock(), lab.opts.at + 1) };
      if (key === 'quests' && on) ensureToday(lab, ctx());
      schedule(true); emit({ type: 'opts' });
      return true;
    },
    /** gentle mode (Fraction Fright's setting): the quests and goal use the gentle wording */
    gentle(on) { info = { ...info, gentle: !!on }; emit({ type: 'gentle' }); },
    markWelcome() { if (!player) return; refresh(); if (!lab.seen.welcome) { lab.seen.welcome = Math.max(1, clock()); schedule(false); } },
    /** Parents -> Reset this child's Lab: a stamped fresh doc that wins every merge. */
    resetMe() {
      if (!player) return false;
      const t = Math.max(clock(), lab.resetAt + 1);
      lab = defaultLab();
      lab.resetAt = t;
      Object.keys(sessions).forEach((g) => delete sessions[g]);
      ensureToday(lab, ctx());
      schedule(true); emit({ type: 'reset' });
      return true;
    },
    family() {
      if (!player) return null;
      refresh();
      const c = ctx();
      touchFamily(c);
      const players = familyWith();
      const wk = weekOfDay(c.day);
      const goal = goalFor(players, wk, { day: c.day, gentle: !!info.gentle });
      const claimable = [];
      for (let i = 0; i < GOAL_CLAIM_WINDOW; i++) {
        const w = weekShift(wk, -i);
        if (lab.claimed[`fam:${w}`] !== undefined) continue;
        const g = i === 0 ? goal : goalFor(players, w, { day: c.day, gentle: !!info.gentle });
        if (g.met) claimable.push({ wk: w, text: g.text });
      }
      return { players, week: wk, board: boardFor(players, wk, c.now), goal, claimable, claimed: lab.claimed[`fam:${wk}`] !== undefined };
    },
    /** another family member's doc, read-only (a sibling's looks, gallery) */
    docOf(id) { return docOf(id); },
    flush() { persist(); },
  };
  // record this week's goal pick and last week's crowns in our own doc
  function touchFamily(c) {
    try {
      const players = familyWith();
      const before = JSON.stringify([lab.picks, lab.fam, lab.crowns]);
      ensureGoalPick(lab, c, players);
      settleCrowns(lab, c, players, player.id);
      if (before !== JSON.stringify([lab.picks, lab.fam, lab.crowns])) dirty = true;
    } catch (e) { console.warn('[lab] family not read', e); }
  }

  // ---------- test hook helpers (the facade exposes them on localhost only) ----------
  store.__test = {
    grantCoins(n) { if (!player) return; refresh(); lab.dev[device] = lab.dev[device] || { c: 0, x: 0 }; lab.dev[device].c += Math.max(0, Math.floor(n) || 0); schedule(true); emit({ type: 'report' }); },
    setQuests(ids) {
      if (!player) return false;
      refresh();
      const c = ctx(); const day = c.day;
      const q = ensureToday(lab, c) || null;
      const list = (ids || []).filter((id) => QUEST_BY_ID[id]).slice(0, 3);
      if (!q || list.length !== 3) return false;
      lab.quests[day] = { ...q, ids: list, p: {}, done: {}, rr: 0 };
      schedule(true); emit({ type: 'quests' });
      return true;
    },
    advanceDay() { skew += DAY_MS; if (player) { const c = ctx(); labRefresh(lab, c.now); ensureToday(lab, c); schedule(true); emit({ type: 'day' }); } return dayKey(clock()); },
    reset() { return store.resetMe(); },
    wallet() { return player ? wallet(lab) : null; },
  };
  return store;
}
