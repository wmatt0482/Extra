// On-screen GAS / BRAKE / NITRO + keyboard. Multi-touch safe: each button tracks the set of pointerIds
// holding it, so GAS + NITRO can be held at once with two thumbs. Keyboard (desktop testing):
// ← = BRAKE/FLIP, → or Space = GAS, ↑ or Shift = NITRO (Esc / P = pause, in main.js).

const KEYMAP = { ArrowLeft: 'brake', ArrowRight: 'gas', Space: 'gas', ArrowUp: 'nitro', ShiftLeft: 'nitro', ShiftRight: 'nitro' };

export function createControls(root, onChange) {
  const names = ['gas', 'brake', 'nitro'];
  const held = { gas: new Set(), brake: new Set(), nitro: new Set() };
  const keys = { gas: new Set(), brake: new Set(), nitro: new Set() };
  const btn = {};
  let state = { gas: false, brake: false, nitro: false };
  let enabled = false;

  for (const el of root.querySelectorAll('[data-ctl]')) {
    const name = el.dataset.ctl;
    btn[name] = el;
    el.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      e.preventDefault();
      held[name].add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      update();
    });
    el.addEventListener('lostpointercapture', (e) => release(e.pointerId));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // stop iOS from turning a held thumb into a scroll, zoom, or callout
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  function release(id) {
    let changed = false;
    for (const n of names) if (held[n].delete(id)) changed = true;
    if (changed) update();
  }
  window.addEventListener('pointerup', (e) => release(e.pointerId), true);
  // a cancelled pointer means the system took the touch (edge swipe, Control Centre, palm rejection);
  // don't leave GAS/NITRO stuck on: release everything and let the player press again
  window.addEventListener('pointercancel', () => clearPointers(), true);
  // iOS can cancel every touch at once (notification banner, system gesture)
  window.addEventListener('touchcancel', () => clearPointers(), true);
  window.addEventListener('blur', () => reset());

  function clearPointers() {
    for (const n of names) held[n].clear();
    update();
  }

  window.addEventListener('keydown', (e) => {
    const n = KEYMAP[e.code];
    if (!n || !enabled) return;
    e.preventDefault();
    if (e.repeat) return;
    keys[n].add(e.code);
    update();
  });
  window.addEventListener('keyup', (e) => {
    const n = KEYMAP[e.code];
    if (!n) return;
    if (keys[n].delete(e.code)) update();
  });

  function update() {
    const next = {};
    for (const n of names) next[n] = enabled && (held[n].size > 0 || keys[n].size > 0);
    for (const n of names) if (btn[n]) btn[n].classList.toggle('is-down', next[n]);
    if (next.gas !== state.gas || next.brake !== state.brake || next.nitro !== state.nitro) {
      state = next;
      onChange({ ...state });
    }
  }

  function reset() {
    for (const n of names) { held[n].clear(); keys[n].clear(); }
    update();
  }

  return {
    get state() { return { ...state }; },
    enable(on) { enabled = !!on; if (!enabled) reset(); else update(); },
    reset,
  };
}
