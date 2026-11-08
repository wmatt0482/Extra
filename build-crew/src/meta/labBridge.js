// The one file in Build Crew that knows about the Lab (lab/SPEC.md section 3.6, the template with GAME = 'bc'). It loads
// the Lab lazily, so the yard never fails to start because /lab/ is missing, blocked, old in the service worker's cache or
// offline: calls made before the load finishes are queued (at most 100) and replayed, and if the load fails every call is a
// quiet no-op that returns EMPTY. The game reads the Lab only through this object. One small addition to the template:
// `onReady(fn)` calls fn once the Lab has loaded (never, when it cannot), so buttons and shelves that need the Lab stay
// hidden until it is really there.
const GAME = 'bc';
const EMPTY = Object.freeze({
  ok: false,
  coins: 0,
  xp: 0,
  capped: false,
  combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null,
  quests: Object.freeze([]),
  questsAllDone: false,
  crate: false,
  unlocks: Object.freeze([]),
  streak: null,
  day: '',
});
let L = null,
  dead = false;
const queue = [],
  ready = [];
function load() {
  if (L || dead || load.p) return;
  load.p = import('../../../lab/src/index.js')
    .then((m) => {
      L = m.lab;
      for (const f of queue.splice(0)) {
        try {
          f(L);
        } catch (e) {
          console.warn('[lab]', e);
        }
      }
      for (const f of ready.splice(0)) {
        try {
          f();
        } catch (e) {
          console.warn('[lab]', e);
        }
      }
    })
    .catch((e) => {
      dead = true;
      queue.length = 0;
      ready.length = 0;
      console.warn('[lab] unavailable', e);
    });
}
const later = (f) => {
  if (dead) return;
  if (L) {
    try {
      f(L);
    } catch (e) {
      console.warn('[lab]', e);
    }
    return;
  }
  if (queue.length < 100) queue.push(f);
  load();
};
// A handle that is usable at once and mounts when the Lab has loaded.
function lazy(make) {
  let real = null,
    gone = false;
  later((l) => {
    if (!gone) real = make(l);
  });
  return {
    update() {
      if (real) real.update();
    },
    destroy() {
      gone = true;
      if (real) real.destroy();
    },
  };
}
const NO_LOOKS = () => ({ slots: {}, owns: () => false, ready: [] });
export const labBridge = {
  attach(info) {
    load();
    later((l) => l.attach({ game: GAME, ...info }));
  },
  detach() {
    later((l) => l.detach());
  },
  // A report before the load returns EMPTY and is replayed once the Lab is there.
  report(ev) {
    try {
      if (L) return L.report({ game: GAME, ...ev }) || EMPTY;
      later((l) => l.report({ game: GAME, ...ev }));
    } catch (e) {
      console.warn('[lab]', e);
    }
    return EMPTY;
  },
  beginRound() {
    later((l) => l.beginRound(GAME));
  },
  hud(opts) {
    return lazy((l) => l.hud(opts));
  },
  results(opts) {
    return lazy((l) => l.results(opts));
  },
  cosmetics() {
    try {
      return L ? L.cosmetics(GAME) : NO_LOOKS();
    } catch (_) {
      return NO_LOOKS();
    }
  },
  owns(id) {
    try {
      return !!(L && L.owns(id));
    } catch (_) {
      return false;
    }
  },
  /** Cohesion (lab/docs/COHESION.md): the one Lab chip, the picker button, the Games panel, the per-game summary and the Lab
   *  coin icon. All lazy and safe. */
  mountChip(container, opts) {
    return lazy((l) => l.mountChip(container, opts));
  },
  mountPickerButton(container, opts) {
    return lazy((l) => l.mountPickerButton(container, opts));
  },
  openGames(o) {
    later((l) => l.openGames(o || {}));
  },
  /** This game's card in the Lab: { level, line, today, lastPlayed }. Queued like a report; the same text twice is a no-op. */
  summary(row) {
    try {
      if (L) return !!L.summary(GAME, row);
      later((l) => l.summary(GAME, row));
    } catch (e) {
      console.warn('[lab]', e);
    }
    return false;
  },
  /** The Lab coin as an SVG string ('' until the Lab has loaded: draw Lab-coin prices after `ready`). */
  coinIcon(size) {
    try {
      return L && L.coinIcon ? L.coinIcon(size) : '';
    } catch (_) {
      return '';
    }
  },
  openShop(o) {
    later((l) => l.openShop({ game: GAME, ...o }));
  },
  openHome(o) {
    later((l) => l.openHome(o));
  },
  openParent(o) {
    later((l) => l.openParent(o));
  },
  onChange(fn) {
    let off = () => {};
    later((l) => {
      off = l.onChange(fn);
    });
    return () => off();
  },
  /** Calls fn once, when the Lab is loaded (now if it already is); never when it cannot load. */
  onReady(fn) {
    if (L) fn();
    else if (!dead) {
      ready.push(fn);
      load();
    }
  },
  get ready() {
    return !!L;
  },
};
