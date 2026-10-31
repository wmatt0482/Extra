// The camera rig: a perspective camera orbiting a target point. On the title it frames the whole yard from high up;
// in a job it follows behind the active machine, nudged toward the pad, and the player can drag to orbit and scroll or
// pinch to zoom. A finished job starts a slow celebratory sweep around the pad. Reduced motion snaps instead of
// easing and skips the sweep.
import * as T from '../../vendor/three.module.js';

/** Orbit and zoom limits: pitch in radians above the horizon, distance in metres. */
const PITCH = [0.25, 1.25];
const DISTANCE = [12, 52];

/** The overview frames the whole yard from at least this far away. */
const OVERVIEW_DISTANCE = 35;

export class CameraRig {
  constructor() {
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 160);
    this.target = new T.Vector3(0, 0, 2);
    this.yaw = -0.68;
    this.pitch = 0.77;
    this.distance = 35;
    /** true on the title (whole-yard view), false while following a machine. */
    this.overview = true;
    /** Seconds of celebration sweep left. */
    this.sweep = 0;
    this.desired = new T.Vector3();
  }

  /** Drag to orbit: horizontal turns around the target, vertical tilts within PITCH. */
  orbit(dx, dy) {
    this.yaw -= dx * 0.006;
    this.pitch = Math.max(PITCH[0], Math.min(PITCH[1], this.pitch + dy * 0.004));
  }

  /** Scroll or pinch to zoom within DISTANCE. */
  zoom(delta) {
    this.distance = Math.max(DISTANCE[0], Math.min(DISTANCE[1], this.distance + delta));
  }

  /** Eases the target toward the overview point, the follow point (65 % machine, 15 % pad) or, during a sweep, the
   *  pad itself, then places the camera. Tall phone screens pull back so the yard still fits. */
  update(dt, machine, pad, reducedMotion) {
    const desired = this.overview
      ? this.desired.set(0, 0, 1)
      : this.desired.set(machine.x * 0.65 + pad.x * 0.15, 0.7, machine.z * 0.65 + pad.z * 0.15);
    if (this.sweep > 0) {
      this.sweep -= dt;
      this.yaw += dt * 0.15;
      desired.set(pad.x, 1, pad.z);
    }
    this.target.lerp(desired, reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
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
