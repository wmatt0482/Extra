// The Lab bridge (lab/SPEC.md §3.6): the ONE file in Wagon West that knows The Lab (learninglab.fun/lab/). It loads /lab/src/index.js lazily, so the game never fails to start because
// /lab/ is missing, blocked, offline or an old copy in the service-worker cache: calls made before the load finishes are queued (at most 100) and replayed, and when the load fails
// every call is a no-op that returns EMPTY. The Lab only listens (`report`) and decorates (`cosmetics`): it never reads or writes a Wagon West save, dollar, token or piece of gold.
// Identical in shape in all five games; only GAME differs.
const GAME = 'ww';
const EMPTY = Object.freeze({ ok: false, coins: 0, xp: 0, capped: false, combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null, quests: Object.freeze([]), questsAllDone: false, crate: false, unlocks: Object.freeze([]), streak: null, day: '' });
const NO_LOOKS = () => ({ slots: {}, owns: () => false, ready: [] });
let L = null, dead = false;
const queue = [];
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
  return { get el() { return real ? real.el : null; }, update() { if (real) real.update(); }, destroy() { gone = true; if (real) real.destroy(); } };
}
export const labBridge = {
  attach(info) { load(); later((l) => l.attach({ game: GAME, ...info })); },
  detach() { later((l) => l.detach()); },
  report(ev) { try { if (L) return L.report({ game: GAME, ...ev }) || EMPTY; later((l) => l.report({ game: GAME, ...ev })); } catch (e) { console.warn('[lab]', e); } return EMPTY; },   // a report before the load returns EMPTY, and is replayed
  beginRound() { later((l) => l.beginRound(GAME)); },
  hud(opts) { return lazy((l) => l.hud(opts)); },
  results(opts) { return lazy((l) => l.results(opts)); },
  /** Stage 2 (lab/docs/COHESION.md): the Lab chip (top-left of the home / title), the picker's Lab button, the Games panel, the per-game summary and the Lab coin icon. */
  mountChip(container, opts) { return lazy((l) => l.mountChip(container, { game: GAME, ...opts })); },
  mountPickerButton(container, opts) { return lazy((l) => l.mountPickerButton(container, { game: GAME, ...opts })); },
  openGames(o) { later((l) => l.openGames({ ...o })); },
  summary(row) { later((l) => l.summary(GAME, row)); },       // queued like report; the Lab drops text it does not accept
  coinIcon(size) { try { return L && L.coinIcon ? L.coinIcon(size) : ''; } catch (_) { return ''; } },   // '' until the Lab has loaded
  cosmeticsOf(playerId) { try { return L && L.cosmeticsOf ? L.cosmeticsOf(playerId, GAME) : { slots: {} }; } catch (_) { return { slots: {} }; } },
  cosmetics() { try { return L ? L.cosmetics(GAME) : NO_LOOKS(); } catch (_) { return NO_LOOKS(); } },
  owns(id) { try { return !!(L && L.owns(id)); } catch (_) { return false; } },
  openShop(o) { later((l) => l.openShop({ game: GAME, ...o })); },
  openHome(o) { later((l) => l.openHome(o)); },
  openParent(o) { later((l) => l.openParent(o)); },
  onChange(fn) { let off = () => {}; later((l) => { off = l.onChange(fn); }); return () => off(); },
  get ready() { return !!L; },
  whenReady(fn) { later(() => fn()); },        // (Wagon West's one addition: run fn once the Lab has loaded; never, when it is missing: the title shows its Lab button then)
};
export { EMPTY };
