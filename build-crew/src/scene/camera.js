// The camera rig: a perspective camera orbiting a target point. On the title it frames the whole yard from high up;
// in a job it follows behind the active machine, nudged toward the pad, and the player can drag to orbit and scroll or
// pinch to zoom. A finished job runs a celebration sweep: the camera turns about a quarter of the way around the
// finished build, pulls in to frame it and settles at a low angle, then eases back to the player's own zoom and angle.
// Reduced motion snaps instead of easing and skips the sweep.
import * as T from '../../vendor/three.module.js';

/** Orbit and zoom limits: pitch in radians above the horizon, distance in metres. */
const PITCH = [0.25, 1.25];
const DISTANCE = [12, 52];

/** The overview frames the whole yard from at least this far away. */
const OVERVIEW_DISTANCE = 35;

/** How far the celebration turns around the build (radians) and the pitch it settles at. */
const SWEEP_TURN = 1.7;
const SWEEP_PITCH = 0.46;

/** The follow camera is a critically damped spring on the machine: it settles with no overshoot, and because it also
 *  leads by the machine's own velocity it keeps up with a moving machine instead of trailing behind it. FOLLOW_W is
 *  the spring's natural frequency (rad/s): the camera closes 95 % of a sudden gap in about a quarter of a second. */
const FOLLOW_W = 12;
const AXES = ['x', 'z'];
/** A followed point faster than this (m/s) is a jump, not travel. */
const MAX_LEAD = 8;

/** Smooth start and end: 0..1 in, 0..1 out. */
const ease = (p) => p * p * (3 - 2 * p);

export class CameraRig {
  constructor() {
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 160);
    this.target = new T.Vector3(0, 0, 2);
    this.yaw = -0.68;
    this.pitch = 0.77;
    this.distance = 35;
    /** true on the title (whole-yard view), false while following a machine. */
    this.overview = true;
    /** Seconds of the older slow-turn sweep left (kept for callers that still set it). */
    this.sweep = 0;
    /** The celebration in progress, or null: wall-clock start, length in ms, the framed point and the starting view. */
    this.show = null;
    /** The view to ease back to once the celebration ends (the player's own pitch and zoom), or null. */
    this.settle = null;
    this.desired = new T.Vector3();
    /** The follow spring's velocity (m/s) and the low-passed velocity of the point it follows. */
    this.vel = new T.Vector3();
    this.lead = new T.Vector3();
    this.lastDesired = new T.Vector3();
    this.following = false;
    /** Pixels of the screen taken by the top bar and the bottom controls; the view is shifted so the machine sits in
     *  the middle of the free band between them. {top, bottom} (zero on a desktop). */
    this.insets = { top: 0, bottom: 0 };
    this.viewShift = 0;
  }

  /** Sets the covered bands (px) at the top and bottom of the screen and reapplies the view shift. */
  setInsets(top, bottom) {
    this.insets.top = top;
    this.insets.bottom = bottom;
    this.applyView();
  }

  /** Shifts the picture vertically with the camera's view offset so the look-at point lands in the middle of the
   *  free band instead of the middle of the screen. Does nothing without insets or before the first resize. */
  applyView() {
    const cam = this.camera,
      h = this.height || 0,
      w = this.width || 0;
    const shift = h ? Math.round((this.insets.top - this.insets.bottom) / 2) : 0;
    if (!shift || !h) {
      if (this.viewShift) cam.clearViewOffset();
      this.viewShift = 0;
      return;
    }
    this.viewShift = shift;
    cam.setViewOffset(w, h, 0, -shift, w, h);
  }

  /** The renderer's size changed. */
  resized(w, h) {
    this.width = w;
    this.height = h;
    this.applyView();
  }

  /** Drag to orbit: horizontal turns around the target, vertical tilts within PITCH. */
  orbit(dx, dy) {
    this.yaw -= dx * 0.006;
    this.pitch = Math.max(PITCH[0], Math.min(PITCH[1], this.pitch + dy * 0.004));
    this.show = this.settle = null;
  }

  /** Scroll or pinch to zoom within DISTANCE. */
  zoom(delta) {
    this.distance = Math.max(DISTANCE[0], Math.min(DISTANCE[1], this.distance + delta));
    this.show = this.settle = null;
  }

  /** Starts the celebration sweep around `center` ({x, y, z}), a build about `radius` metres across, lasting
   *  `ms` milliseconds on the wall clock. Reduced motion skips it (the view just stays where it is). */
  celebrate(center, radius, ms, reducedMotion) {
    if (reducedMotion) return;
    // Far enough that the whole build and some yard show, and a little wider on tall phone screens (update()).
    const framed = Math.max(17, Math.min(30, 12 + radius * 2.4));
    this.show = {
      t0: performance.now(),
      ms,
      center: new T.Vector3(center.x, center.y, center.z),
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.distance,
      framed,
    };
    this.settle = { pitch: this.pitch, distance: this.distance };
  }

  /** True while the celebration sweep is running. */
  get sweeping() {
    return !!this.show;
  }

  /** One step of the critically damped spring toward `desired` (exact for a steady target, so any frame length is
   *  stable). The target leads by the followed point's velocity (low-passed), which cancels the steady lag. */
  follow(dt, desired) {
    const step = Math.max(dt, 1e-4),
      k = 1 - Math.exp(-step * 20),
      t = this.target,
      lead = this.lead,
      e = Math.exp(-FOLLOW_W * step);
    // x and z follow the machine; y is a constant height.
    for (const axis of AXES) {
      // A jump (hopping to another machine) is not a speed: the lead is dropped and the spring simply pulls over.
      const speed = (desired[axis] - this.lastDesired[axis]) / step;
      lead[axis] += ((Math.abs(speed) > MAX_LEAD ? 0 : speed) - lead[axis]) * k;
      const goal = desired[axis] + (lead[axis] * 2) / FOLLOW_W,
        x0 = t[axis] - goal,
        v0 = this.vel[axis],
        temp = v0 + FOLLOW_W * x0;
      t[axis] = goal + (x0 + temp * step) * e;
      this.vel[axis] = (v0 - FOLLOW_W * temp * step) * e;
    }
    t.y += (desired.y - t.y) * (1 - Math.exp(-step * 3));
    this.lastDesired.copy(desired);
  }

  /** Eases the target toward the overview point, the follow point (65 % machine, 15 % pad) or, during a sweep, the
   *  finished build, then places the camera. Tall phone screens pull back so the yard still fits. */
  update(dt, machine, pad, reducedMotion) {
    const desired = this.overview
      ? this.desired.set(0, 0, 1)
      : this.desired.set(machine.x * 0.65 + pad.x * 0.15, 0.7, machine.z * 0.65 + pad.z * 0.15);
    if (this.sweep > 0) {
      this.sweep -= dt;
      this.yaw += dt * 0.15;
      desired.set(pad.x, 1, pad.z);
    }
    let lerp = 1 - Math.exp(-dt * 3);
    const show = this.show;
    if (show) {
      const p = Math.min(1, (performance.now() - show.t0) / show.ms),
        e = ease(p);
      this.yaw = show.yaw + SWEEP_TURN * e;
      // Pull in over the first part of the sweep, and drop to the settled low angle.
      this.distance = show.distance + (show.framed - show.distance) * ease(Math.min(1, p * 1.8));
      this.pitch = show.pitch + (SWEEP_PITCH - show.pitch) * ease(Math.min(1, p * 1.4));
      desired.copy(show.center);
      lerp = 1 - Math.exp(-dt * 6);
      if (p >= 1) this.show = null;
    } else if (this.settle && !reducedMotion) {
      // Back to the player's own zoom and angle behind the sheet.
      const k = 1 - Math.exp(-dt * 2.5);
      this.pitch += (this.settle.pitch - this.pitch) * k;
      this.distance += (this.settle.distance - this.distance) * k;
      if (Math.abs(this.distance - this.settle.distance) < 0.05) this.settle = null;
    } else this.settle = null;
    if (reducedMotion || show || this.sweep > 0 || this.overview || !this.following) {
      // Overview, celebration, calm motion and the first frame of a follow: ease or snap, and start the spring afresh.
      this.target.lerp(desired, reducedMotion ? 1 : lerp);
      this.vel.set(0, 0, 0);
      this.lead.set(0, 0, 0);
      this.lastDesired.copy(desired);
      this.following = !this.overview && !show && !(this.sweep > 0);
    } else this.follow(dt, desired);
    const aspect = this.camera.aspect;
    const dist =
      (this.overview ? Math.max(OVERVIEW_DISTANCE, this.distance) : this.distance) *
      (aspect < 0.8 ? Math.min(1.5, 0.85 / aspect) : 1);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
      this.target.y + Math.sin(this.pitch) * dist,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist,
    );
    this.camera.lookAt(this.target);
  }
}
