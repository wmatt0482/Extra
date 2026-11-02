// The one file in Spell Jump that knows the Lab (lab/SPEC.md §3.6, §4.1). It loads /lab/src/index.js lazily, so the game never fails to
// start because /lab/ is missing, blocked, old in the service-worker cache or offline: calls made before the load finishes are queued
// (at most 100) and replayed, and if the load fails every call is a no-op that returns EMPTY (the same shape as the Lab's NOOP_RECEIPT).
// The Lab never writes to a game save and the game never reads the Lab's economy: this file only reports events and mounts the Lab's UI.
const GAME = 'sj';
const EMPTY = Object.freeze({
  ok: false, coins: 0, xp: 0, capped: false, combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null, quests: Object.freeze([]), questsAllDone: false, crate: false, unlocks: Object.freeze([]), streak: null, day: '',
  bonus: Object.freeze({ coins: 0, xp: 0 }),
});
const NO_COSMETICS = () => ({ slots: {}, owns: () => false, ready: [] });
let L = null, dead = false;
const queue = [];
function load() {
  if (L || dead || load.p) return;
  load.p = import('../../../lab/src/index.js').then((m) => {
    L = m.lab;
    for (const f of queue.splice(0)) { try { f(L); } catch (e) { console.warn('[lab]', e); } }
  }).catch((e) => { dead = true; queue.length = 0; console.warn('[lab] unavailable', e && e.message ? e.message : e); });
}
const later = (f) => {
  if (dead) return;
  if (L) { try { f(L); } catch (e) { console.warn('[lab]', e); } return; }
  if (queue.length < 100) queue.push(f);
  load();
};
// a handle that is usable at once and mounts when the Lab has loaded
function lazy(make) {
  let real = null, gone = false;
  later((l) => { if (!gone) real = make(l); });
  return { update() { try { if (real) real.update(); } catch (_) { /* ignore */ } }, destroy() { gone = true; try { if (real) real.destroy(); } catch (_) { /* ignore */ } } };
}

export const labBridge = {
  attach(info) { load(); later((l) => l.attach({ game: GAME, ...info })); },
  detach() { later((l) => l.detach()); },
  /** One event; the receipt of the Lab, or EMPTY when the Lab is not here (yet). A report made before the load is replayed. */
  report(ev) {
    try { if (L) return L.report({ game: GAME, ...ev }) || EMPTY; later((l) => l.report({ game: GAME, ...ev })); } catch (e) { console.warn('[lab]', e); }
    return EMPTY;
  },
  beginRound() { later((l) => l.beginRound(GAME)); },
  hud(opts) { return lazy((l) => l.hud(opts)); },
  results(opts) { return lazy((l) => l.results(opts)); },
  /** What to draw now: { slots: { skin, sticker, trail }, owns(id), ready }. Re-read at the start of every round, not once at boot. */
  cosmetics() { try { return L ? L.cosmetics(GAME) : NO_COSMETICS(); } catch (_) { return NO_COSMETICS(); } },
  owns(id) { try { return !!(L && L.owns(id)); } catch (_) { return false; } },
  openShop(o) { later((l) => l.openShop({ game: GAME, ...o })); },
  openHome(o) { later((l) => l.openHome(o)); },
  openParent(o) { later((l) => l.openParent(o)); },
  onChange(fn) { let off = () => {}; later((l) => { off = l.onChange(fn); }); return () => off(); },
  flush() { try { if (L) L.flush(); } catch (_) { /* ignore */ } },
  get ready() { return !!L; },
  get unavailable() { return dead; },
};
