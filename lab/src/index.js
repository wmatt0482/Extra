// The Lab facade (lab/SPEC.md §3.3): what a game calls, through its own src/meta/labBridge.js. Synchronous, never throws, and every UI call is
// lazy (import('./ui/index.js')) and a no-op when the UI is absent, so a game never depends on the Lab being there.
import { createLabStore } from './store.js';
import { NOOP_RECEIPT } from './core/engine.js';
import { LAB_VERSION, GAMES, owns as docOwns, wallet } from './core/model.js';
import { levelProgress } from './core/xp.js';
import { totalXp } from './core/model.js';
import { labStreakNow, freezeView } from './core/streak.js';
import { SLOTS, ITEM_BY_ID } from './data/catalog.js';
import { collectVoiceTexts, voiceTexts, LAB_LINES } from './core/view.js';

export { NOOP_RECEIPT, LAB_VERSION };
/** Each game's looks module: `export const LOOKS_READY = [item ids it can draw or enforce]` and an optional paintPreview(ctx, item, w, h). */
export const GAME_MODULES = Object.freeze({
  sj: '/spell-jump/src/meta/labLooks.js', tb: '/trail-blazer/src/meta/labLooks.js', ff: '/fraction-fright/src/meta/labLooks.js',
  ww: '/wagon-west/src/meta/labLooks.js', bc: '/build-crew/src/meta/labLooks.js',
});

let store = null, game = 'sj';
const looks = {};                    // game -> { ids: [...], mod } once loaded ([] when its module is missing)
const loading = {};
const getStore = () => store || (store = createLabStore());
const NO_COSMETICS = () => ({ slots: {}, owns: () => false, ready: [] });

function loadLooks(g) {
  if (!GAME_MODULES[g]) return Promise.resolve([]);
  if (!loading[g]) {
    loading[g] = import(GAME_MODULES[g]).then((m) => { if (looks[g] && looks[g].standin) return looks[g].ids; looks[g] = { ids: Array.isArray(m.LOOKS_READY) ? m.LOOKS_READY.filter((x) => typeof x === 'string') : [], mod: m }; return looks[g].ids; })
      .catch(() => { if (looks[g] && looks[g].standin) return looks[g].ids; looks[g] = { ids: [], mod: null }; return []; })
      .then((ids) => { publishReady(); return ids; });
  }
  return loading[g];
}
const publishReady = () => { try { getStore().setReady(GAMES.flatMap((g) => (looks[g] ? looks[g].ids : []))); } catch (_) { /* ignore */ } };
const loadAllLooks = () => Promise.all(GAMES.map(loadLooks));
const lazyUi = () => import('./ui/index.js');

function lazyHandle(make) {
  let real = null, gone = false;
  lazyUi().then((ui) => { if (!gone) { ui.installStyles(); real = make(ui); } }).catch((e) => console.warn('[lab] ui unavailable', e));
  return { get el() { return real ? real.el : null; }, update() { if (real) real.update(); }, destroy() { gone = true; if (real) real.destroy(); } };
}
function overlay(view, o = {}, all = false) {
  (all ? loadAllLooks() : Promise.resolve()).then(() => lazyUi()).then((ui) => { ui.installStyles(); ui.openOverlay(getStore(), { view, ...o }); }).catch((e) => console.warn('[lab] ui unavailable', e));
}

const slotName = (key) => key.slice(key.indexOf('.') + 1);
function slotsOf(doc, g) {
  const out = {};
  for (const s of SLOTS) if (s.owner === g && !s.noEquip) { const e = doc && doc.equipped[s.key]; out[slotName(s.key)] = e && e[0] ? e[0] : null; }
  return out;
}

export const lab = {
  /** Once per page after the player is chosen (idempotent). info = { game, playerId, name, color, gentle, reducedMotion, sound }. */
  attach(info) {
    try {
      if (!info || !GAMES.includes(info.game)) return;
      game = info.game;
      getStore().attach(info);
      loadLooks(game);
    } catch (e) { console.warn('[lab] attach error', e); }
  },
  detach() { try { if (store) store.detach(); } catch (_) { /* ignore */ } },
  /** One game event. Synchronous, never throws, returns a Receipt (NOOP_RECEIPT when anything is off). */
  report(ev) { try { return getStore().report(ev) || NOOP_RECEIPT; } catch (_) { return NOOP_RECEIPT; } },
  beginRound(g) { try { getStore().beginRound(g || game); } catch (_) { /* ignore */ } },
  roundSummary() { try { return getStore().roundSummary(game) || null; } catch (_) { return null; } },
  hud({ mount, compact = false } = {}) { return lazyHandle((ui) => ui.mountHud(mount, getStore(), { game, compact })); },
  results({ mount } = {}) { return lazyHandle((ui) => ui.mountResults(mount, getStore(), { game })); },
  /** What to DRAW: { slots: { [slot]: itemId | null }, owns(id), ready } (null = use the game's own look). */
  cosmetics(g) {
    try {
      const doc = store && store.doc();
      if (!doc) return NO_COSMETICS();
      return { slots: slotsOf(doc, g), owns: (id) => docOwns(doc, id), ready: looks[g] ? looks[g].ids.slice() : [] };
    } catch (_) { return NO_COSMETICS(); }
  },
  /** Another family member's equipped looks for a game, read-only (a sibling's ghost look). */
  cosmeticsOf(playerId, g) { try { const d = store && store.docOf(playerId); return { slots: slotsOf(d, g) }; } catch (_) { return { slots: {} }; } },
  owns(id) { try { const d = store && store.doc(); return !!d && !!ITEM_BY_ID[id] && docOwns(d, id); } catch (_) { return false; } },
  wallet() { try { const d = store && store.doc(); return { coins: d ? wallet(d).coins : 0 }; } catch (_) { return { coins: 0 }; } },
  level() { try { const d = store && store.doc(); return levelProgress(d ? totalXp(d) : 0); } catch (_) { return levelProgress(0); } },
  streak() {
    try {
      const d = store && store.doc();
      if (!d) return { count: 0, best: 0, weeklyReady: true, bonus: 0 };
      const now = store.now();
      return { count: labStreakNow(d, now), best: d.streak.best, ...freezeView(d, now) };
    } catch (_) { return { count: 0, best: 0, weeklyReady: true, bonus: 0 }; }
  },
  openShop(o = {}) { overlay('shop', { game: o.game || game, onClose: o.onClose }, true); },
  openHome(o = {}) { overlay(o.view || 'home', { game, onClose: o.onClose }, true); },
  openParent(o = {}) { overlay('parent', { game, unlocked: !!o.unlocked, onClose: o.onClose }); },
  onChange(fn) { try { return getStore().subscribe(fn); } catch (_) { return () => {}; } },
  flush() { try { if (store) store.flush(); } catch (_) { /* ignore */ } },
  settings() { try { const d = store && store.doc(); return d ? { quests: d.opts.quests, board: d.opts.board, goal: d.opts.goal } : { quests: true, board: true, goal: true }; } catch (_) { return { quests: true, board: true, goal: true }; } },
  gentle(on) { try { getStore().gentle(on); } catch (_) { /* ignore */ } },
  /** Every line the Lab says that the natural voice could read (a finite set, for preparing clips). */
  voiceTexts, collectVoiceTexts, LAB_LINES,
  /** The store, for the Lab page (lab/src/main.js) and tools. */
  get store() { return getStore(); },
};
// test helpers: grantCoins(n), setQuests(ids), advanceDay(), reset(), plus setLooks(game, ids) to stand in for a game's labLooks module (a stand-in wins
// over the game's real module, whether that loads before or after)
lab.__test = {
  get store() { return getStore(); },
  grantCoins: (n) => getStore().__test.grantCoins(n),
  setQuests: (ids) => getStore().__test.setQuests(ids),
  advanceDay: () => getStore().__test.advanceDay(),
  reset: () => getStore().__test.reset(),
  setLooks: (g, ids) => { looks[g] = { ids: ids.slice(), mod: null, standin: true }; loading[g] = Promise.resolve(ids); publishReady(); },
};
try {
  if (typeof window !== 'undefined' && typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.__lab = { get store() { return getStore(); }, grantCoins: lab.__test.grantCoins, setQuests: lab.__test.setQuests, advanceDay: lab.__test.advanceDay, reset: lab.__test.reset, setLooks: lab.__test.setLooks };
  }
} catch (_) { /* not a browser */ }
