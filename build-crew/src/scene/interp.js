// Interpolated drawing. Physics runs in fixed 1/60 s steps; a phone that draws at 30 fps (or a 120 Hz screen) would
// otherwise show every toy and machine snapping from step to step. The loop hands this class the state before and
// after the frame's last physics step, and the scene draws a blend of the two at the fraction of a step that is left
// over. Everything is kept in reused buffers, so a drawn frame allocates nothing. A teleport (a reset, a restored
// site, a lost block returning) is drawn at its new place at once instead of sliding across the yard.

/** The machine fields that move the drawn model, in the order they are stored. `angle` ones take the short way round. */
const FIELDS = ['x', 'y', 'z', 'yaw', 'swing', 'lift', 'reach', 'tilt', 'pitch', 'roll', 'artic'];
const ANGLE = new Set([3, 4]);
const TAU = Math.PI * 2;

/** A jump bigger than this many metres between two steps is a teleport. */
const SNAP = 2.5;

/** One toy's stored pose. */
const slot = () => ({ id: 0, type: '', color: '', px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 });

/** The state of a yard at one physics step: every toy's pose and every machine's drawn fields. */
class Snapshot {
  constructor() {
    this.toys = [];
    this.count = 0;
    this.machines = [];
  }

  /** Copies `poses` (the yard's toy poses) and the machines' fields into reused slots. */
  take(yard, poses) {
    const toys = this.toys;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i],
        s = toys[i] || (toys[i] = slot());
      s.id = p.id;
      s.type = p.type;
      s.color = p.color;
      s.px = p.position.x;
      s.py = p.position.y;
      s.pz = p.position.z;
      s.qx = p.rotation.x;
      s.qy = p.rotation.y;
      s.qz = p.rotation.z;
      s.qw = p.rotation.w;
    }
    this.count = poses.length;
    const ms = yard.machines;
    for (let i = 0; i < ms.length; i++) {
      const a = this.machines[i] || (this.machines[i] = new Float64Array(FIELDS.length));
      for (let k = 0; k < FIELDS.length; k++) a[k] = ms[i][FIELDS[k]];
    }
    this.machines.length = ms.length;
  }

  copy(from) {
    const toys = this.toys;
    for (let i = 0; i < from.count; i++) Object.assign(toys[i] || (toys[i] = slot()), from.toys[i]);
    this.count = from.count;
    for (let i = 0; i < from.machines.length; i++) {
      (this.machines[i] ||= new Float64Array(FIELDS.length)).set(from.machines[i]);
    }
    this.machines.length = from.machines.length;
  }
}

export class Interpolator {
  constructor() {
    this.prev = new Snapshot();
    this.curr = new Snapshot();
    /** Fraction (0..1) of a step between prev and curr to draw. */
    this.alpha = 1;
    /** True once a snapshot exists to blend from. */
    this.ready = false;
    this.stepped = false;
    /** Reused pose objects handed to the toy layer, and the machines' real fields while the blend is applied. */
    this.view = [];
    this.saved = [];
  }

  /** Forgets both snapshots (a new yard, a restore, a reset): the next drawn frame shows the live state. */
  reset() {
    this.ready = false;
    this.stepped = false;
  }

  /** Records the state just before the frame's last physics step (only needed when a frame runs several steps). */
  before(yard, poses) {
    this.prev.take(yard, poses);
    this.stepped = true;
  }

  /** Records the state after the frame's last physics step. With one step in the frame, the previous frame's end
   *  state is the "before" state; the very first time there is none, so the two are the same state. */
  after(yard, poses) {
    if (this.stepped) this.stepped = false;
    else if (this.ready) this.prev.copy(this.curr);
    else this.prev.take(yard, poses);
    this.curr.take(yard, poses);
    this.ready = true;
  }

  /** The blended toy poses at this.alpha, in reused objects with the shape the toy layer and effects read. A toy
   *  that is new, or that jumped, is drawn where it is. */
  poses() {
    const a = this.alpha,
      view = this.view,
      p = this.prev,
      c = this.curr;
    for (let i = 0; i < c.count; i++) {
      const to = c.toys[i],
        from = p.toys[i] && p.toys[i].id === to.id ? p.toys[i] : to,
        v =
          view[i] ||
          (view[i] = { id: 0, type: '', color: '', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
      v.id = to.id;
      v.type = to.type;
      v.color = to.color;
      const dx = to.px - from.px,
        dy = to.py - from.py,
        dz = to.pz - from.pz;
      const t = dx * dx + dy * dy + dz * dz > SNAP * SNAP ? 1 : a;
      v.position.x = from.px + dx * t;
      v.position.y = from.py + dy * t;
      v.position.z = from.pz + dz * t;
      // Normalised lerp of the quaternions, taking the shorter way round.
      const dot = from.qx * to.qx + from.qy * to.qy + from.qz * to.qz + from.qw * to.qw,
        s = dot < 0 ? -1 : 1;
      let x = from.qx + (s * to.qx - from.qx) * t,
        y = from.qy + (s * to.qy - from.qy) * t,
        z = from.qz + (s * to.qz - from.qz) * t,
        w = from.qw + (s * to.qw - from.qw) * t;
      const len = Math.hypot(x, y, z, w) || 1;
      v.rotation.x = x / len;
      v.rotation.y = y / len;
      v.rotation.z = z / len;
      v.rotation.w = w / len;
    }
    view.length = c.count;
    return view;
  }

  /** Writes the blended machine fields into the yard's machines for the duration of one draw (the model, the camera
   *  and the effects all read them there). restore() puts the real values back. */
  apply(yard) {
    const ms = yard.machines,
      a = this.alpha;
    for (let i = 0; i < ms.length; i++) {
      const saved = this.saved[i] || (this.saved[i] = new Float64Array(FIELDS.length));
      const from = this.prev.machines[i],
        to = this.curr.machines[i],
        m = ms[i];
      let t = a;
      if (from && to) {
        const jump = Math.hypot(to[0] - from[0], to[2] - from[2]);
        if (jump > SNAP) t = 1;
      }
      for (let k = 0; k < FIELDS.length; k++) {
        const f = FIELDS[k];
        saved[k] = m[f];
        if (!from || !to) continue;
        let d = to[k] - from[k];
        if (ANGLE.has(k)) d = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        m[f] = from[k] + d * t;
      }
    }
    this.saved.length = ms.length;
  }

  restore(yard) {
    const ms = yard.machines;
    for (let i = 0; i < ms.length; i++) for (let k = 0; k < FIELDS.length; k++) ms[i][FIELDS[k]] = this.saved[i][k];
  }
}
