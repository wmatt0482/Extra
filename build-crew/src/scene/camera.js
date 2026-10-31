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
    this.target.lerp(desired, reducedMotion ? 1 : lerp);
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
