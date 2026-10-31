// Small effects that ground the toys and show movement: soft contact discs under every toy, a trail of tire marks,
// exhaust puffs, dust from a scooping bucket, glitter from broken glass and celebration confetti. All of them are
// pooled instanced meshes with fixed caps from quality.js, and particle records are recycled, so a busy yard
// allocates nothing per frame. Reduced motion turns off particles but keeps the contact discs.
import * as T from '../../vendor/three.module.js';
import { COLORS, TOYS } from '../content.mjs';
import { BUDGET } from './quality.js';
import { MACHINE } from './machines.js';

/** Particle motion: a gentle upward spray that falls back under this much gravity (m/s²). */
const PARTICLE_GRAVITY = 1.4;

/** Seconds between tire marks while a machine is moving. */
const MARK_INTERVAL = 0.24;

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
  }

  /** Sprays `count` small particles of `color` from `position`. The oldest particles make room past the cap. */
  emit(position, color = '#ddc196', count = 8) {
    if (this.isCalm()) return;
    for (let i = 0; i < count; i++) {
      const p = this.spare.pop() || { p: new T.Vector3(), v: new T.Vector3(), life: 0, color: '', size: 0 };
      p.p.set(position.x, position.y, position.z);
      p.v.set(Math.sin(i * 2.4) * 1.3, 0.6 + (i % 3) * 0.65, Math.cos(i * 2.4) * 1.3);
      p.life = 0.8 + (i % 3) * 0.2;
      p.color = color;
      p.size = 0.1 + (i % 3) * 0.05;
      this.particles.push(p);
    }
    const extra = this.particles.length - BUDGET.particles;
    if (extra > 0) {
      for (let k = 0; k < extra; k++) this.spare.push(this.particles[k]);
      this.particles.copyWithin(0, extra);
      this.particles.length -= extra;
    }
  }

  /** Five bursts of confetti in the paint colors across the pad. */
  confetti(pad) {
    for (let i = 0; i < 5; i++) this.emit({ x: pad.x + (i - 2) * 1.2, y: 4, z: pad.z }, COLORS[i], 18);
  }

  /** Places a flattened disc on the ground under every toy, sized to its footprint. */
  updateContacts(poses, yard) {
    const tmp = this.kit.tmp;
    poses.forEach((b, i) => {
      const d = TOYS[b.type];
      tmp.position.set(b.position.x, 0.065 + yard.groundAt(b.position.x, b.position.z), b.position.z);
      tmp.rotation.set(-Math.PI / 2, 0, 0);
      tmp.scale.set(d.size[0] * 0.65, d.size[2] * 0.65, 1);
      tmp.updateMatrix();
      this.contacts.setMatrixAt(i, tmp.matrix);
    });
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
    this.marks.push({ x: m.x, z: m.z, yaw: m.yaw });
    if (this.marks.length > BUDGET.tireMarks) this.marks.shift();
    if (Math.abs(m.speed) > 1) {
      const scooping = MACHINE[m.kind].scoops && m.lift < 1;
      this.emit(scooping ? { x: m.tip.x, y: 0.2, z: m.tip.z } : { x: m.x, y: 0.25, z: m.z - 1 }, '#d7ba85', 1);
    }
  }

  /** Draws each tire mark as a pair of track prints on the ground. */
  drawMarks(yard) {
    const tmp = this.kit.tmp;
    this.marks.forEach((p, i) => {
      for (let k = 0; k < 2; k++) {
        tmp.position.set(p.x + (k ? 0.85 : -0.85) * Math.cos(p.yaw), 0.035 + yard.groundAt(p.x, p.z), p.z);
        tmp.rotation.set(0, p.yaw, 0);
        tmp.scale.set(0.3, 0.012, 0.6);
        tmp.updateMatrix();
        this.trackPool.setMatrixAt(i * 2 + k, tmp.matrix);
      }
    });
    this.trackPool.count = this.marks.length * 2;
    this.trackPool.instanceMatrix.needsUpdate = true;
  }

  /** Ages, moves and draws the particles. A particle whose life ran out last frame is retired first; one that runs
   *  out this frame is drawn at zero size. */
  updateParticles(dt) {
    const list = this.particles;
    let alive = 0;
    for (let k = 0; k < list.length; k++) {
      if (list[k].life > 0) list[alive++] = list[k];
      else this.spare.push(list[k]);
    }
    list.length = alive;
    const tmp = this.kit.tmp;
    list.forEach((p, i) => {
      p.life -= dt;
      p.p.addScaledVector(p.v, dt);
      p.v.y -= dt * PARTICLE_GRAVITY;
      tmp.position.copy(p.p);
      tmp.rotation.set(i * 0.8, i, 0);
      tmp.scale.setScalar(p.size * Math.max(0, p.life));
      tmp.updateMatrix();
      this.pool.setMatrixAt(i, tmp.matrix);
      this.pool.setColorAt(i, this.kit.color.set(p.color));
    });
    this.pool.count = list.length;
    this.pool.instanceMatrix.needsUpdate = true;
    if (this.pool.instanceColor) this.pool.instanceColor.needsUpdate = true;
  }
}
