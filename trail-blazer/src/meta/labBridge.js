// The one file in Trail Blazer that knows the Lab (lab/SPEC.md §3.6). It loads /lab/src/index.js lazily, so the game never fails to
// start because /lab/ is missing, blocked, old in the service-worker cache or offline: calls made before the load finishes are queued
// (at most 100) and replayed, and if the load fails every call is a no-op that returns EMPTY (and the game plays as it always did).
// Rules for the game: call attach() when a player is chosen and detach() when they leave; report() at the event hooks, once per event,
// never inside an engine frame loop; read cosmetics() at the start of every round; mount hud() / results() into elements the game
// provides (the handle works at once and mounts when the Lab has loaded) and destroy() them with the screen.
const GAME = 'tb';
const EMPTY = Object.freeze({
  ok: false, coins: 0, xp: 0, capped: false, combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null, quests: Object.freeze([]), questsAllDone: false, crate: false, unlocks: Object.freeze([]), streak: null, day: '',
});
const NO_LOOKS = () => ({ slots: {}, owns: () => false, ready: [] });
let L = null, dead = false;
const queue = [];

function load() {
  if (L || dead || load.p) return;
  load.p = import('../../../lab/src/index.js').then((m) => {
    L = m.lab;
    for (const f of queue.splice(0)) { try { f(L); } catch (e) { console.warn('[lab]', e); } }
  }).catch((e) => { dead = true; queue.length = 0; console.warn('[lab] unavailable', e); });
}
const later = (f) => {
  if (dead) return;
  if (L) { try { f(L); } catch (e) { console.warn('[lab]', e); } return; }
  if (queue.length < 100) queue.push(f);
  load();
};
/** A handle that is usable at once and mounts when the Lab has loaded. */
function lazy(make) {
  let real = null, gone = false;
  later((l) => { if (!gone) real = make(l); });
  return { update() { if (real) real.update(); }, destroy() { gone = true; if (real) real.destroy(); } };
}

export const labBridge = {
  attach(info) { load(); later((l) => l.attach({ game: GAME, ...info })); },
  detach() { later((l) => l.detach()); },
  /** One game event: returns the Receipt, or EMPTY before the Lab has loaded (the call is replayed once it has). */
  report(ev) {
    try {
      if (L) return L.report({ game: GAME, ...ev }) || EMPTY;
      later((l) => l.report({ game: GAME, ...ev }));
    } catch (e) { console.warn('[lab]', e); }
    return EMPTY;
  },
  beginRound() { later((l) => l.beginRound(GAME)); },
  hud(opts) { return lazy((l) => l.hud(opts)); },
  results(opts) { return lazy((l) => l.results(opts)); },
  /** What to DRAW: { slots: { paint, decal, rim, ghost }, owns(id), ready }; null in a slot = the game's own look. */
  cosmetics() { try { return L ? L.cosmetics(GAME) : NO_LOOKS(); } catch (_) { return NO_LOOKS(); } },
  /** A family member's equipped looks (a sibling's ghost look), read-only. */
  cosmeticsOf(playerId) { try { return L && typeof L.cosmeticsOf === 'function' ? L.cosmeticsOf(playerId, GAME) : { slots: {} }; } catch (_) { return { slots: {} }; } },
  owns(id) { try { return !!(L && L.owns(id)); } catch (_) { return false; } },
  /** The summary the results text uses (null before the Lab has loaded). */
  roundSummary() { try { return L ? L.roundSummary() : null; } catch (_) { return null; } },
  level() { try { return L ? L.level() : null; } catch (_) { return null; } },
  openShop(o) { later((l) => l.openShop({ game: GAME, ...o })); },
  openHome(o) { later((l) => l.openHome(o)); },
  openParent(o) { later((l) => l.openParent(o)); },
  onChange(fn) { let off = () => {}; later((l) => { off = l.onChange(fn); }); return () => off(); },
  flush() { try { if (L) L.flush(); } catch (_) { /* ignore */ } },
  /** Lines the Lab says that are known ahead (for the natural voice's clips); [] before the Lab has loaded. */
  voiceLines() { try { return L && L.LAB_LINES ? Object.values(L.LAB_LINES).filter((x) => typeof x === 'string') : []; } catch (_) { return []; } },
  /** The Lab's fixed lines ({ levelUp(level, title), crate, ... }), or null before it has loaded. */
  lines() { try { return L && L.LAB_LINES ? L.LAB_LINES : null; } catch (_) { return null; } },
  /** Runs fn once the Lab has loaded (at once when it has); never when it failed to load. */
  whenLoaded(fn) { later(() => fn()); },
  get ready() { return !!L; },
  get failed() { return dead; },
};
