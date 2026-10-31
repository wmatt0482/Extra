// Small effects that ground the toys and show movement: soft contact discs under every toy, a trail of tire marks,
// exhaust puffs, dust from a scooping bucket and glitter from broken glass, plus the job-complete show: a dust kick
// at the base of the build, streaking sparks and large tumbling confetti flakes in the site's accent colours. All of
// them are pooled instanced meshes with fixed caps from quality.js (dust and flakes together never exceed
// BUDGET.particles), and particle records are recycled, so a busy yard allocates nothing per frame. Reduced motion
// turns off particles but keeps the contact discs.
import * as T from '../../vendor/three.module.js';
import { TOYS } from '../content.mjs';
import { BUDGET } from './quality.js';
import { MACHINE } from './machines.js';

/** Particle motion: a gentle upward spray that falls back under this much gravity (m/s²). */
const PARTICLE_GRAVITY = 1.4;
const Z_AXIS = new T.Vector3(0, 0, 1);

/** Seconds between tire marks while a machine is moving. */
const MARK_INTERVAL = 0.24;

/** Celebration colors: safety amber and orange, signal red, steel blue, and a pale steel white. */
const SHOW_COLORS = ['#f2b538', '#e9aa26', '#d75a29', '#c6412f', '#287da5', '#edf2f6'];
const SPARK_COLORS = ['#ffd36a', '#f2b538', '#fff1c2'];

/** The celebration's bursts: milliseconds after the start, confetti, sparks and the spread of the burst (m). Their
 *  totals keep the live particles inside BUDGET.particles together with the dust ring. */
const SHOW_WAVES = [
  { at: 0, confetti: 30, sparks: 14, dust: 18, spread: 1 },
  { at: 650, confetti: 24, sparks: 10, dust: 0, spread: 1.5 },
  { at: 1300, confetti: 14, sparks: 6, dust: 0, spread: 2 },
];

/** Confetti air drag (1/s) and gravity (m/s²): flakes launch fast, then drift down at about 2 m/s. */
const FLAKE_DRAG = 2.2;
const FLAKE_GRAVITY = 5;

export class Effects {
  /** Creates the particle and tire-mark pools in `scene`. isCalm() reports the reduced-motion setting. */
  constructor(scene, kit, isCalm) {
    this.kit = kit;
    this.isCalm = isCalm;
    this.particles = [];
    /** Retired particle records, reused by emit(). */
    this.spare = [];
    this.marks = [];
    this.lastMark = 0;
    this.pool = new T.InstancedMesh(kit.sphereGeo, kit.mat('#958975'), BUDGET.particles);
    this.pool.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.pool.frustumCulled = false;
    scene.add(this.pool);
    this.pool.count = 0;
    const markMaterial = new T.MeshBasicMaterial({
      color: '#242e30',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.trackPool = new T.InstancedMesh(kit.boxGeo, markMaterial, BUDGET.tireMarks * 2);
    this.trackPool.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.trackPool.frustumCulled = false;
    scene.add(this.trackPool);
    this.trackPool.count = 0;
    // Confetti flakes and spark streaks share one unlit pool of thin boxes; each flake draws bright against any light.
    this.flakes = [];
    this.spareFlakes = [];
    this.show = null;
    this.flakePool = new T.InstancedMesh(
      kit.boxGeo,
      new T.MeshBasicMaterial({ side: T.DoubleSide, fog: false }),
      BUDGET.particles,
    );
    this.flakePool.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.flakePool.frustumCulled = false;
    scene.add(this.flakePool);
    this.flakePool.count = 0;
    this.axis = new T.Vector3();
    this.quat = new T.Quaternion();
  }

  /** Adds this round's contact-disc layer (one disc per toy) to the round group. */
  attachRound(roundGroup) {
    const material = new T.MeshBasicMaterial({ color: '#524c32', transparent: true, opacity: 0.13, depthWrite: false });
    this.contacts = new T.InstancedMesh(this.kit.circleGeo, material, BUDGET.toys);
    this.contacts.userData.ownMaterial = true;
    this.contacts.frustumCulled = false;
    roundGroup.add(this.contacts);
  }

  /** Forgets every particle and tire mark when a round ends. */
  clear() {
    for (const p of this.particles) this.spare.push(p);
    this.particles.length = 0;
    this.marks = [];
    this.pool.count = this.trackPool.count = 0;
    for (const f of this.flakes) this.spareFlakes.push(f);
    this.flakes.length = 0;
    this.flakePool.count = 0;
    this.show = null;
  }

  /** Sprays `count` small particles of `color` from `position`. The oldest particles make room past the cap, which
   *  the confetti flakes share. `puff` makes them grow into soft dust balls that drift outward at `speed`. */
  emit(position, color = '#ddc196', count = 8, puff = 0, ring = 0) {
    if (this.isCalm()) return;
    for (let i = 0; i < count; i++) {
      const p = this.spare.pop() || { p: new T.Vector3(), v: new T.Vector3(), life: 0, col: new T.Color(), size: 0 };
      p.p.set(position.x, position.y, position.z);
      if (puff) {
        // A ring of dust: evenly spaced around the base (starting `ring` metres out), a little faster for every
        // other puff.
        const a = (i / count) * Math.PI * 2 + puff * 0.7;
        const speed = puff * (0.75 + (i % 2) * 0.45);
        p.p.x += Math.sin(a) * ring;
        p.p.z += Math.cos(a) * ring;
        p.v.set(Math.sin(a) * speed, 0.25 + (i % 3) * 0.12, Math.cos(a) * speed);
        p.life = 1.15 + (i % 3) * 0.1;
        p.size = 0.3 + (i % 3) * 0.09;
      } else {
        p.v.set(Math.sin(i * 2.4) * 1.3, 0.6 + (i % 3) * 0.65, Math.cos(i * 2.4) * 1.3);
        p.life = 0.8 + (i % 3) * 0.2;
        p.size = 0.1 + (i % 3) * 0.05;
      }
      p.puff = puff ? p.life : 0;
      p.col.set(color);
      this.particles.push(p);
    }
    const extra = this.particles.length - Math.max(0, BUDGET.particles - this.flakes.length);
    if (extra > 0) {
      for (let k = 0; k < extra; k++) this.spare.push(this.particles[k]);
      this.particles.copyWithin(0, extra);
      this.particles.length -= extra;
    }
  }

  /** One confetti flake or spark streak, if there is room under the shared particle cap. */
  flake(kind, x, y, z, vx, vy, vz, color, life) {
    if (this.flakes.length + this.particles.length >= BUDGET.particles) return;
    const f = this.spareFlakes.pop() || {
      p: new T.Vector3(),
      v: new T.Vector3(),
      r: new T.Vector3(),
      w: new T.Vector3(),
      col: new T.Color(),
    };
    f.kind = kind;
    f.p.set(x, y, z);
    f.v.set(vx, vy, vz);
    f.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    f.w.set(3 + Math.random() * 7, 2 + Math.random() * 6, 3 + Math.random() * 5);
    f.col.set(color);
    f.life = f.max = life;
    f.phase = Math.random() * 6.28;
    f.size = kind === 'spark' ? 1 : 0.7 + Math.random() * 0.5;
    this.flakes.push(f);
  }

  /** Starts the job-complete show at `center` ({x, y, z} of the finished build, y its ground level) with `radius`
   *  metres of build: a dust ring at the base, sparks and large confetti in bursts over about 1.5 s. Does nothing in
   *  calm motion. The bursts are timed against the wall clock, so they stay in step with the camera sweep. */
  celebrate(center, radius = 3) {
    if (this.isCalm()) return;
    this.show = { t0: performance.now(), next: 0, center: { ...center }, radius };
  }

  /** Fires the show bursts that are due. */
  runShow() {
    const show = this.show;
    if (!show) return;
    const elapsed = performance.now() - show.t0,
      // A phone's smaller particle budget gets a proportionally smaller show.
      scale = BUDGET.particles / 120;
    while (show.next < SHOW_WAVES.length && elapsed >= SHOW_WAVES[show.next].at) {
      const w = SHOW_WAVES[show.next++],
        c = show.center,
        r = show.radius * w.spread;
      if (w.dust) {
        this.emit({ x: c.x, y: c.y + 0.2, z: c.z }, '#d9ccaa', Math.round(w.dust * scale), 2.2 + show.radius * 0.3, show.radius * 0.7);
      }
      for (let i = 0, n = Math.round(w.confetti * scale); i < n; i++) {
        const a = i * 2.399 + show.next,
          out = 2 + (i % 5) * 1.5;
        this.flake(
          'confetti',
          c.x + Math.sin(a) * r * 0.4,
          c.y + 0.6 + (i % 4) * 0.5,
          c.z + Math.cos(a) * r * 0.4,
          Math.sin(a) * out,
          11 + (i % 6) * 1.4,
          Math.cos(a) * out,
          SHOW_COLORS[(i + show.next) % SHOW_COLORS.length],
          2.6 + (i % 4) * 0.25,
        );
      }
      for (let i = 0, n = Math.round(w.sparks * scale); i < n; i++) {
        const a = i * 2.399 + 1.3,
          out = 3 + (i % 4) * 1.4;
        this.flake(
          'spark',
          c.x + Math.sin(a) * r * 0.55,
          c.y + 0.5,
          c.z + Math.cos(a) * r * 0.55,
          Math.sin(a) * out,
          9 + (i % 5) * 1.6,
          Math.cos(a) * out,
          SPARK_COLORS[i % SPARK_COLORS.length],
          0.85 + (i % 3) * 0.2,
        );
      }
    }
    if (elapsed > 3000) this.show = null;
  }

  /** The legacy entry: five bursts of confetti in the paint colors across the pad. */
  confetti(pad) {
    this.celebrate({ x: pad.x, y: 0, z: pad.z }, 3);
  }

  /** Places a flattened disc on the ground under every toy, sized to its footprint. */
  updateContacts(poses, yard) {
    const tmp = this.kit.tmp;
    for (let i = 0; i < poses.length; i++) {
      const b = poses[i],
        d = TOYS[b.type];
      tmp.position.set(b.position.x, 0.065 + yard.groundAt(b.position.x, b.position.z), b.position.z);
      tmp.rotation.set(-Math.PI / 2, 0, 0);
      tmp.scale.set(d.size[0] * 0.65, d.size[2] * 0.65, 1);
      tmp.updateMatrix();
      this.contacts.setMatrixAt(i, tmp.matrix);
    }
    this.contacts.count = poses.length;
    this.contacts.instanceMatrix.needsUpdate = true;
  }

  /** While the active machine moves, drops a tire mark every MARK_INTERVAL seconds, with an exhaust puff on every
   *  third mark and, at speed, dust: from a lowered bucket that scoops, otherwise from behind the chassis. */
  trail(yard) {
    const m = yard.machine;
    if (this.isCalm() || Math.abs(m.speed) <= 0.3 || yard.time - this.lastMark <= MARK_INTERVAL) return;
    this.lastMark = yard.time;
    if (this.marks.length % 3 === 0) this.emit({ x: m.x + 0.45, y: m.y + 2.3, z: m.z - 0.8 }, '#c4c9b3', 1);
    // Once the ground is full of marks the oldest record is reused for the newest.
    const mark = this.marks.length >= BUDGET.tireMarks ? this.marks.shift() : { x: 0, z: 0, yaw: 0 };
    mark.x = m.x;
    mark.z = m.z;
    mark.yaw = m.yaw;
    this.marks.push(mark);
    if (Math.abs(m.speed) > 1) {
      const scooping = MACHINE[m.kind].scoops && m.lift < 1;
      this.emit(scooping ? { x: m.tip.x, y: 0.2, z: m.tip.z } : { x: m.x, y: 0.25, z: m.z - 1 }, '#d7ba85', 1);
    }
  }

  /** Draws each tire mark as a pair of track prints on the ground. */
  drawMarks(yard) {
    const tmp = this.kit.tmp;
    for (let i = 0; i < this.marks.length; i++) {
      const p = this.marks[i];
      for (let k = 0; k < 2; k++) {
        tmp.position.set(p.x + (k ? 0.85 : -0.85) * Math.cos(p.yaw), 0.035 + yard.groundAt(p.x, p.z), p.z);
        tmp.rotation.set(0, p.yaw, 0);
        tmp.scale.set(0.3, 0.012, 0.6);
        tmp.updateMatrix();
        this.trackPool.setMatrixAt(i * 2 + k, tmp.matrix);
      }
    }
    this.trackPool.count = this.marks.length * 2;
    this.trackPool.instanceMatrix.needsUpdate = true;
  }

  /** Ages, moves and draws the particles. A particle whose life ran out last frame is retired first; one that runs
   *  out this frame is drawn at zero size. Dust puffs swell and thin out; flakes tumble, sparks streak. */
  updateParticles(dt) {
    this.runShow();
    const list = this.particles;
    let alive = 0;
    for (let k = 0; k < list.length; k++) {
      if (list[k].life > 0) list[alive++] = list[k];
      else this.spare.push(list[k]);
    }
    list.length = alive;
    const tmp = this.kit.tmp;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      p.p.addScaledVector(p.v, dt);
      if (p.puff) {
        // Soft dust: drag the outward speed, rise a little, grow while fresh and shrink as it thins out.
        const f = Math.max(0, p.life / p.puff);
        p.v.x *= 1 - Math.min(1, dt * 1.8);
        p.v.z *= 1 - Math.min(1, dt * 1.8);
        p.v.y -= dt * 0.1;
        tmp.scale.setScalar(p.size * (1.5 - f * 0.7) * Math.min(1, f * 2.2));
      } else {
        p.v.y -= dt * PARTICLE_GRAVITY;
        tmp.scale.setScalar(p.size * Math.max(0, p.life));
      }
      tmp.position.copy(p.p);
      tmp.rotation.set(i * 0.8, i, 0);
      tmp.updateMatrix();
      this.pool.setMatrixAt(i, tmp.matrix);
      this.pool.setColorAt(i, p.col);
    }
    this.pool.count = list.length;
    this.pool.instanceMatrix.needsUpdate = true;
    if (this.pool.instanceColor) this.pool.instanceColor.needsUpdate = true;
    this.updateFlakes(dt);
  }

  /** Moves and draws the confetti flakes (thin tumbling rectangles that flutter as they fall) and the spark
   *  streaks (long thin boxes stretched along their velocity). */
  updateFlakes(dt) {
    const list = this.flakes;
    let alive = 0;
    for (let k = 0; k < list.length; k++) {
      if (list[k].life > 0) list[alive++] = list[k];
      else this.spareFlakes.push(list[k]);
    }
    list.length = alive;
    const tmp = this.kit.tmp;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      f.life -= dt;
      const spark = f.kind === 'spark';
      if (spark) {
        f.v.y -= dt * PARTICLE_GRAVITY * 6;
      } else {
        const drag = Math.max(0, 1 - FLAKE_DRAG * dt);
        f.v.multiplyScalar(drag);
        f.v.y -= dt * FLAKE_GRAVITY;
        f.v.x += Math.sin(f.life * 3.1 + f.phase) * dt * 2.2;
        f.v.z += Math.cos(f.life * 2.7 + f.phase) * dt * 2.2;
      }
      f.p.addScaledVector(f.v, dt);
      if (f.p.y < 0.06 && !spark) {
        f.p.y = 0.06;
        f.v.set(0, 0, 0);
        f.w.multiplyScalar(0.2);
      }
      // Shrink away over the last 0.35 s.
      const fade = Math.min(1, Math.max(0, f.life) / 0.35);
      tmp.position.copy(f.p);
      if (spark) {
        const speed = f.v.length() || 1;
        this.axis.copy(f.v).divideScalar(speed);
        tmp.quaternion.setFromUnitVectors(Z_AXIS, this.axis);
        tmp.scale.set(0.09 * fade, 0.09 * fade, (0.25 + Math.min(1.2, speed * 0.09)) * fade);
      } else {
        f.r.addScaledVector(f.w, dt);
        tmp.rotation.set(f.r.x, f.r.y, f.r.z);
        tmp.scale.set(0.5 * f.size * fade, 0.3 * f.size * fade, 0.02);
      }
      tmp.updateMatrix();
      this.flakePool.setMatrixAt(i, tmp.matrix);
      this.flakePool.setColorAt(i, f.col);
    }
    this.flakePool.count = list.length;
    this.flakePool.instanceMatrix.needsUpdate = true;
    if (this.flakePool.instanceColor) this.flakePool.instanceColor.needsUpdate = true;
  }
}
