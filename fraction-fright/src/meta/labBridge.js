// The ONE file in Fraction Fright that knows the Lab (lab/SPEC.md §3.6; the same shape in all five games). The Lab loads lazily, so the game
// never fails to start because /lab/ is missing, old in the service-worker cache, blocked or offline: calls made before the load finishes are
// queued (at most 100) and replayed, and if the load fails every call is a no-op that returns EMPTY. Lab coins never enter the game's own cash.
const GAME = 'ff';
const EMPTY = Object.freeze({ ok: false, coins: 0, xp: 0, capped: false, combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null, quests: Object.freeze([]), questsAllDone: false, crate: false, unlocks: Object.freeze([]), streak: null, day: '' });
let L = null, dead = false; const queue = [];
function load() {
  if (L || dead || load.p) return;
  load.p = import('../../../lab/src/index.js').then((m) => { L = m.lab; for (const f of queue.splice(0)) { try { f(L); } catch (e) { console.warn('[lab]', e); } } })
    .catch((e) => { dead = true; queue.length = 0; console.warn('[lab] unavailable', e); });
}
const later = (f) => {
  if (dead) return;
  if (L) { try { f(L); } catch (e) { console.warn('[lab]', e); } return; }
  if (queue.length < 100) queue.push(f);
  load();
};
function lazy(make) {          // a handle that is usable at once and mounts when the Lab has loaded
  let real = null, gone = false;
  later((l) => { if (!gone) real = make(l); });
  return { update() { if (real) real.update(); }, destroy() { gone = true; if (real) real.destroy(); } };
}
export const labBridge = {
  attach(info) { load(); later((l) => l.attach({ game: GAME, ...info })); },
  detach() { later((l) => l.detach()); },
  report(ev) { try { if (L) return L.report({ game: GAME, ...ev }) || EMPTY; later((l) => l.report({ game: GAME, ...ev })); } catch (e) { console.warn('[lab]', e); } return EMPTY; },   // a report before the load returns EMPTY, and is replayed
  beginRound() { later((l) => l.beginRound(GAME)); },
  hud(opts) { return lazy((l) => l.hud(opts)); },
  results(opts) { return lazy((l) => l.results(opts)); },
  cosmetics() { try { return L ? L.cosmetics(GAME) : { slots: {}, owns: () => false, ready: [] }; } catch (_) { return { slots: {}, owns: () => false, ready: [] }; } },
  owns(id) { try { return !!(L && L.owns(id)); } catch (_) { return false; } },
  openShop(o) { later((l) => l.openShop({ game: GAME, ...o })); },
  openHome(o) { later((l) => l.openHome(o)); },
  openParent(o) { later((l) => l.openParent(o)); },
  onChange(fn) { let off = () => {}; later((l) => { off = l.onChange(fn); }); return () => off(); },
  get ready() { return !!L; },
};
