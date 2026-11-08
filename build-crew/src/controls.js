// Every input path (keyboard, the two touch sticks, the joint hold buttons, a standard gamepad, drag to orbit, pinch
// and wheel to zoom) produces the same bounded axes, read once per frame by the game loop. Captured fingers, blur,
// hidden tabs and a disconnected gamepad all return to neutral, so an axis can never stay stuck on.
/** The stick's dead zone (fraction of full deflection) and the deflection at which it reaches full power. */
const DEAD_ZONE = 0.12;
const FULL_AT = 0.92;
const STICK_AXES = { drive: ['drive', 'steer'], tool: ['lift', 'tool'] };

/** A tap on a driving key (W A S D or an arrow) lasts at least this long (milliseconds) however briefly the key is down,
 *  so a quick tap is a clear nudge of about half a metre (a 20 ms tap used to move the machine a few centimetres, too
 *  little to see). Holding a key works exactly as before, and the lift and tool keys are left alone: they place loads. */
export const TAP_MS = 170;
/** ...and is seen by at least this many frames, so a very slow device (frames longer than TAP_MS) still gets the nudge. */
const TAP_FRAMES = 3;
const DRIVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Shapes a stick deflection (x, y each -1..1, length up to 1) into `out`: nothing inside the 12 % dead zone, then a
 *  smooth curve that starts gentle (for placing a load precisely) and reaches full power just before the rim. The
 *  direction is kept, so diagonals work. Returns out. */
export function shapeStick(x, y, out = { x: 0, y: 0 }) {
  const r = Math.hypot(x, y);
  if (r <= DEAD_ZONE) {
    out.x = out.y = 0;
    return out;
  }
  const s = Math.min(1, (r - DEAD_ZONE) / (FULL_AT - DEAD_ZONE)),
    power = s * (0.3 + 0.7 * s);
  out.x = (x / r) * power;
  out.y = (y / r) * power;
  return out;
}

/** Wires all input to the canvas and the HUD. action(name) receives one-shot actions (grab, hop, reset, pause, horn);
 *  orbit(dx, dy) and zoom(delta) move the camera; tap(event) is a short click on the yard (terrain stamps). Returns
 *  { clear, setEnabled, read } where read() returns the axes clamped to -1..1, or {} while disabled. */
export function createControls(canvas, { action, orbit, zoom, tap }) {
  const keys = new Set(),
    // when each driving key last went down: until TAP_MS later it still counts as down
    tapped = new Map(),
    axes = { drive: 0, steer: 0, lift: 0, tool: 0, swing: 0, tilt: 0, extend: 0 };
  let enabled = true,
    previous = [],
    drag = null,
    pinches = new Map(),
    pinchDist = 0,
    pads = false;
  // Everything the sticks need is looked up once, so a pointermove only writes the knob's transform.
  const sticks = [...document.querySelectorAll('[data-stick]')],
    releases = [];
  // Releases every key, axis and stick dot.
  const neutral = () => {
    keys.clear();
    tapped.clear();
    for (const k in axes) axes[k] = 0;
    for (const release of releases) release();
  };
  // A gamepad is polled only once the browser has reported one (the poll allocates).
  addEventListener('gamepadconnected', () => (pads = true));
  // Typing in the Parent Zone or moving the daylight slider must not drive a machine.
  const isInput = (e) => e.target.closest('input,textarea,select,#pz,[role="slider"]');
  const special = { Space: 'grab', KeyE: 'hop', KeyR: 'reset', Escape: 'pause', KeyH: 'horn' };
  // Keys whose browser default (scrolling, mostly) is suppressed while playing.
  const codes = [
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyI',
    'KeyJ',
    'KeyK',
    'KeyL',
    'KeyU',
    'KeyO',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ShiftLeft',
    'ShiftRight',
  ];
  window.addEventListener('keydown', (e) => {
    if (!enabled || isInput(e)) return;
    if (e.target.closest('button') && ['Space', 'Enter'].includes(e.code)) return;
    if (codes.includes(e.code) || special[e.code]) e.preventDefault();
    if (special[e.code] && !e.repeat) action(special[e.code]);
    if (DRIVE_KEYS.has(e.code) && !keys.has(e.code)) tapped.set(e.code, { until: performance.now() + TAP_MS, reads: 0 });
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', neutral);
  document.addEventListener('visibilitychange', neutral);
  // The touch sticks: one captured finger each; the dot follows it inside a circle of 34 % of the stick's width. The
  // stick answers on the very first pointerdown (touch-action: none in the stylesheet keeps the browser's own scroll,
  // zoom and double-tap handling out of the way, so there is no delay to wait out and no preventDefault is needed).
  // The stick's box is measured once when the finger lands, so moving it never reads the layout, and the dot is moved
  // with a transform alone.
  const shaped = { x: 0, y: 0 };
  for (const stick of sticks) {
    let finger = null,
      cx = 0,
      cy = 0,
      rad = 1;
    const dot = stick.querySelector('.stick-dot'),
      [vertical, horizontal] = STICK_AXES[stick.dataset.stick],
      driving = stick.dataset.stick === 'drive';
    const move = (e) => {
      if (e.pointerId !== finger) return;
      let x = (e.clientX - cx) / rad,
        y = (e.clientY - cy) / rad;
      const l = Math.max(1, Math.hypot(x, y));
      x /= l;
      y /= l;
      dot.style.transform = `translate3d(${x * rad}px,${y * rad}px,0)`;
      shapeStick(x, y, shaped);
      // (`|| 0` keeps a centred stick at +0 rather than -0.)
      axes[vertical] = -shaped.y || 0;
      axes[horizontal] = (driving ? -shaped.x : shaped.x) || 0;
    };
    const end = () => {
      finger = null;
      axes[vertical] = axes[horizontal] = 0;
      dot.style.transform = '';
      stick.classList.remove('held');
    };
    releases.push(end);
    stick.addEventListener('pointerdown', (e) => {
      if (!enabled || finger !== null) return;
      finger = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.x + r.width / 2;
      cy = r.y + r.height / 2;
      rad = r.width * 0.34;
      stick.setPointerCapture(finger);
      stick.classList.add('held');
      stick.parentElement.classList.add('used');
      move(e);
    });
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    stick.addEventListener('lostpointercapture', end);
  }
  // Joint buttons ("swing:-1", "extend:1", "tilt:-1" ...) hold an extra axis while pressed, by pointer or keyboard.
  for (const b of document.querySelectorAll('[data-hold]')) {
    const [axis, v] = b.dataset.hold.split(':');
    const clear = () => (axes[axis] = 0);
    b.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      b.setPointerCapture(e.pointerId);
      axes[axis] = Number(v);
    });
    b.addEventListener('pointerup', clear);
    b.addEventListener('pointercancel', clear);
    b.addEventListener('lostpointercapture', clear);
    b.addEventListener('keydown', (e) => {
      if (['Space', 'Enter'].includes(e.code)) {
        e.preventDefault();
        axes[axis] = Number(v);
      }
    });
    b.addEventListener('keyup', clear);
    b.addEventListener('blur', clear);
  }
  // Dragging the yard orbits the camera; two fingers pinch to zoom; a short press without movement is a tap.
  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    pinches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, total: 0 };
    if (pinches.size === 2) {
      const p = [...pinches.values()];
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pinches.has(e.pointerId)) return;
    pinches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinches.size === 2) {
      const p = [...pinches.values()],
        d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      // Scaled to the screen, so a pinch across a phone zooms as far as one across a laptop's trackpad.
      zoom((pinchDist - d) * (22 / Math.max(300, Math.min(innerWidth, innerHeight))));
      pinchDist = d;
      return;
    }
    if (drag?.id === e.pointerId) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.total += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      orbit(dx, dy);
    }
  });
  const stop = (e) => {
    if (drag?.id === e.pointerId && drag.total < 8 && pinches.size === 1) tap?.(e);
    pinches.delete(e.pointerId);
    drag = null;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', () => {
    pinches.clear();
    drag = null;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(e.deltaY * 0.015);
    },
    { passive: false },
  );
  // +1, -1 or 0 for a pair of opposing keys. A driving key tapped a moment ago still counts as down (see TAP_MS).
  let now = 0;
  const isDown = (k) => {
    if (keys.has(k)) return true;
    const t = tapped.get(k);
    if (t === undefined) return false;
    if (now < t.until || t.reads < TAP_FRAMES) return true;
    tapped.delete(k);
    return false;
  };
  const down = (a, b) => Number(isDown(a)) - Number(isDown(b));
  const out = { drive: 0, steer: 0, lift: 0, tool: 0, swing: 0, tilt: 0, extend: 0, quick: false };
  const clamp = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);
  const NONE = Object.freeze({});
  return {
    clear: neutral,
    setEnabled(v) {
      enabled = v;
      neutral();
    },
    /** The stick and button axes as they stand, for tests and tools (the same object each time). */
    peek: () => axes,
    // Keyboard and gamepad add to the stick axes; Shift turns J/L from the tool axis into the excavator's cab swing.
    // Gamepad buttons A, Y and B fire grab, hop and reset on their press edge only. The object returned is reused by
    // the next read, so the game loop allocates nothing here.
    read() {
      if (!enabled) return NONE;
      if (tapped.size) {
        now = performance.now();
        for (const t of tapped.values()) t.reads++;
      }
      const shift = keys.has('ShiftLeft') || keys.has('ShiftRight'),
        horizontal = down('KeyL', 'KeyJ') + down('ArrowRight', 'ArrowLeft');
      let drive = axes.drive + down('KeyW', 'KeyS'),
        steer = axes.steer + down('KeyA', 'KeyD'),
        lift = axes.lift + down('KeyI', 'KeyK') + down('ArrowUp', 'ArrowDown'),
        tool = axes.tool + (shift ? 0 : horizontal);
      const pad = pads ? Array.from(navigator.getGamepads?.() || []).find((p) => p?.connected) : null;
      if (pad) {
        const dz = (v) => (Math.abs(v) > 0.18 ? v : 0);
        drive += -dz(pad.axes[1] || 0);
        steer += -dz(pad.axes[0] || 0);
        lift += -dz(pad.axes[3] || 0);
        tool += dz(pad.axes[2] || 0);
        [0, 3, 1].forEach((b, i) => {
          if (pad.buttons[b]?.pressed && !previous[b]) action(['grab', 'hop', 'reset'][i]);
        });
        previous = pad.buttons.map((b) => b.pressed);
      } else if (previous.length) previous = [];
      out.drive = clamp(drive);
      out.steer = clamp(steer);
      out.lift = clamp(lift);
      out.tool = clamp(tool);
      out.swing = clamp(axes.swing + (shift ? horizontal : 0));
      out.tilt = clamp(axes.tilt);
      out.extend = clamp(axes.extend + down('KeyO', 'KeyU'));
      // keys (not a stick) get the machine's quick start, so a tap reads as a nudge
      let quick = tapped.size > 0;
      if (!quick) for (const k of DRIVE_KEYS) if (keys.has(k)) quick = true;
      out.quick = quick;
      return out;
    },
  };
}
