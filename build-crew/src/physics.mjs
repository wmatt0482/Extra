// The yard's physics: one Rapier world that runs the same fixed 1/60 s steps in browsers and in the Node tests. Toys
// are dynamic bodies with real mass, friction and collisions. Machines are deliberately assisted: their chassis and
// tools are kinematic bodies moved to where the controls say, so a machine never tips over, while a held toy hangs
// from a bounded spring and still collides with everything. Each machine kind's tool shape and joints come from the
// MACHINE table below, so a new machine is a table row (plus its model in scene/machines.js).
import RAPIER from '../vendor/rapier.mjs';
import { TOYS, MACHINES } from './content.mjs';
import { RECESS, hillHeight, hillPoints, rampHeight, rampPoints } from './terrain.mjs';
export { RAPIER };

let ready;
/** Loads Rapier's embedded WASM once; every caller awaits the same promise. */
export const initPhysics = () => (ready ||= RAPIER.init());

/** The fixed step (seconds) and the dynamic-toy cap (SPEC §6). */
export const DT = 1 / 60,
  MAX_BLOCKS = 64;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** A quaternion for a turn of `a` radians about the vertical axis. */
const qyaw = (a) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });

const len = (v) => Math.hypot(v.x, v.y, v.z);

/** The yard is a 32 m square of 4 m floor tiles (-14..14 tile centres) with a fence just outside. */
const YARD = { half: 14, tile: 4, fence: 17, lost: 19 };

/** The chassis collider's half extents, shared by every first-flight machine. */
const CHASSIS = [1, 0.65, 1.25];

/** Every machine's chassis rides this high above the ground. */
const RIDE_HEIGHT = 0.7;

/** A machine's starting tool height. */
const HOME_LIFT = 0.8;

/** The skid steer's bucket tilt limits in radians (the tilt joint's range for every machine). */
const TILT = [-0.7, 0.7];

/** How fast the tool rises and falls (m/s at full stick). */
const LIFT_RATE = 2.2;

/** How close (metres) the tool tip must be to a toy's centre to grab it. */
const GRAB_RADIUS = 1.55;

/** The tool's orientation: a pure yaw for a hanging magnet or an excavator bucket that follows the stick... */
const yawOnly = (a) => qyaw(a);

/** ...or the skid steer's bucket, which also pitches by its tilt joint (yaw first, then tilt about the bucket's x). */
const yawAndTilt = (a, m) => ({
  x: Math.cos(a / 2) * Math.sin(m.tilt / 2),
  y: Math.sin(a / 2) * Math.cos(m.tilt / 2),
  z: -Math.sin(a / 2) * Math.sin(m.tilt / 2),
  w: Math.cos(a / 2) * Math.cos(m.tilt / 2),
});

/** How each joint is limited: the boom's swing turns freely, reach stays in the machine's range, tilt in TILT. */
const JOINT_LIMITS = {
  swing: () => null,
  reach: (d) => d.reach,
  tilt: () => TILT,
};

/** Physics for each machine kind.
 *  - speed, turn, height, reach: drive speed, turn rate, tool height range and reach range (from content.mjs).
 *  - tool: colliders on the tool body as [size, offset] boxes in the tool's frame; an empty list is a magnet, which
 *    only grabs. The skid steer's open bucket (floor, back, two sides) can also scoop and push loose toys.
 *  - orient: the tool's rotation from the boom angle (yaw + swing) and the machine's joints.
 *  - stick: the joint the right stick's left/right axis (J/L) drives, and its rate per second at full stick.
 *  - extend: the joint U/O drives, or null.
 *  - wreckingBall: whether this machine can hang the wrecking ball.
 *  The grab point is the same for every machine: `reach` metres ahead along the boom, at the tool's lift height. */
export const MACHINE = {
  skid: {
    ...pick(MACHINES.skid),
    tool: [
      [
        [2.4, 0.12, 1.3],
        [0, -0.62, 0],
      ],
      [
        [2.4, 0.8, 0.12],
        [0, -0.24, -0.62],
      ],
      [
        [0.12, 0.7, 1.3],
        [-1.15, -0.24, 0],
      ],
      [
        [0.12, 0.7, 1.3],
        [1.15, -0.24, 0],
      ],
    ],
    orient: yawAndTilt,
    stick: { joint: 'tilt', rate: 1 },
    extend: null,
    wreckingBall: false,
  },
  excavator: {
    ...pick(MACHINES.excavator),
    tool: [],
    orient: yawOnly,
    stick: { joint: 'reach', rate: 1.8 },
    extend: null,
    wreckingBall: false,
  },
  crane: {
    ...pick(MACHINES.crane),
    tool: [],
    orient: yawOnly,
    stick: { joint: 'swing', rate: 0.8 },
    extend: { joint: 'reach', rate: 1.8 },
    wreckingBall: true,
  },
};

/** The driving numbers a MACHINE row takes from the shared machine metadata. */
function pick({ speed, turn, height, reach }) {
  return { speed, turn, height, reach };
}

/** Moves one joint by `amount`, within its limits. */
function moveJoint(m, d, joint, amount) {
  const limits = JOINT_LIMITS[joint](d);
  m[joint] = limits ? clamp(m[joint] + amount, limits[0], limits[1]) : m[joint] + amount;
}

/** The ground's height under a terrain stamp at local offset (dx, dz) metres from the stamp's centre. A hill is a
 *  low mound, a pit and the water sit in recesses, and a ramp is a wedge climbing 1.8 m along z. */
const STAMP_HEIGHT = {
  pit: () => RECESS.pit,
  water: () => RECESS.water,
  ramp: (dx, dz) => rampHeight(dz),
  hill: (dx, dz) => hillHeight(Math.hypot(dx, dz)),
};

/** One job's (or the sandbox's) physical yard: floor tiles, fence, props, machines and toys. */
export class Yard {
  constructor(round, { onEvent = () => {} } = {}) {
    this.round = round;
    this.onEvent = onEvent;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = DT;
    // Extra solver and friction iterations keep tall stacks quiet (SPEC §2).
    this.world.numSolverIterations = 12;
    this.world.numAdditionalFrictionIterations = 8;
    this.queue = new RAPIER.EventQueue(true);
    this.blocks = [];
    this.machines = [];
    this.stamps = [];
    this.held = null;
    this.active = 0;
    this.serial = 0;
    this.time = 0;
    this.wrecking = false;
    this.ball = null;
    this.ballMachine = null;
    this.tiles = new Map();
    for (let x = -YARD.half; x <= YARD.half; x += YARD.tile) {
      for (let z = -YARD.half; z <= YARD.half; z += YARD.tile) this.tile(x, z, 0);
    }
    for (const p of round.props || []) this.fixed(p.x, p.y, p.z, p.size);
    // The fence: four 3 m walls just outside the yard, so nothing drives or rolls away.
    const fence = [
      [-YARD.fence, 0, [1, 3, 35]],
      [YARD.fence, 0, [1, 3, 35]],
      [0, -YARD.fence, [35, 3, 1]],
      [0, YARD.fence, [35, 3, 1]],
    ];
    for (const [x, z, s] of fence) this.fixed(x, 1.5, z, s);
    // Jobs line the machines up from (-6, -4); a round's `spawns` ([x, z] per machine) overrides that.
    round.machines.forEach((kind, i) => this.addMachine(kind, ...(round.spawns?.[i] || [-6 + i * 5, -4])));
    round.toys.forEach((t) => this.spawn(t));
  }

  /** A fixed box collider centred at (x, y, z) with full size `size`. */
  fixed(x, y, z, size) {
    const desc = RAPIER.ColliderDesc.cuboid(...size.map((n) => n / 2))
      .setTranslation(x, y, z)
      .setFriction(0.95);
    return this.world.createCollider(desc);
  }

  /** (Re)builds the floor tile at (x, z) with its top at height h. */
  tile(x, z, h) {
    const key = `${x},${z}`;
    if (this.tiles.has(key)) this.world.removeCollider(this.tiles.get(key), false);
    this.tiles.set(key, this.fixed(x, h - 1, z, [4, 2, 4]));
  }

  /** Adds a machine of `kind` at (x, z): a kinematic chassis and a separate kinematic tool body. */
  addMachine(kind, x, z) {
    const def = MACHINE[kind];
    const chassis = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, RIDE_HEIGHT, z);
    const body = this.world.createRigidBody(chassis);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(...CHASSIS).setFriction(0.8), body);
    const m = {
      kind,
      body,
      x,
      z,
      y: RIDE_HEIGHT,
      yaw: 0,
      swing: 0,
      lift: HOME_LIFT,
      reach: def.reach[0],
      tilt: 0,
      speed: 0,
      home: { x, z },
      tool: null,
      tip: null,
    };
    m.tool = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    for (const [size, offset] of def.tool) {
      const part = RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
        .setTranslation(...offset)
        .setFriction(0.95);
      this.world.createCollider(part, m.tool);
    }
    this.machines.push(m);
    this.updateTip(m, true);
    return m;
  }

  /** Adds a toy from a job or tray entry ({ type, color, x, y?, z, rotation? }); returns null when the yard is full.
   *  An unknown type becomes a cube. CCD keeps fast toys from tunnelling; contact-force events drive impact sounds
   *  and glass breaking. */
  spawn(t) {
    if (this.blocks.length >= MAX_BLOCKS) return null;
    const d = TOYS[t.type] || TOYS.cube,
      def = { ...t, type: TOYS[t.type] ? t.type : 'cube' };
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(t.x, t.y ?? d.size[1] / 2 + 0.1, t.z)
      .setLinearDamping(0.45)
      .setAngularDamping(1.8)
      .setCcdEnabled(true);
    const b = this.world.createRigidBody(desc);
    if (t.rotation) b.setRotation(t.rotation, true);
    const add = (shape, mass) => {
      const collider = shape
        .setMass(mass)
        .setFriction(0.9)
        .setRestitution(0.07)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(130);
      return this.world.createCollider(collider, b);
    };
    if (t.type === 'pallet') {
      // A pallet is a deck on two runners, leaving fork space underneath.
      add(RAPIER.ColliderDesc.cuboid(1, 0.075, 0.9).setTranslation(0, 0.15, 0), d.mass / 2);
      for (const x of [-0.8, 0.8]) {
        add(RAPIER.ColliderDesc.cuboid(0.15, 0.15, 0.9).setTranslation(x, -0.075, 0), d.mass / 4);
      }
    } else {
      const shape = d.round
        ? RAPIER.ColliderDesc.cylinder(d.size[1] / 2, d.size[0] / 2)
        : RAPIER.ColliderDesc.cuboid(...d.size.map((v) => v / 2));
      add(shape, d.mass);
    }
    const block = {
      id: ++this.serial,
      type: def.type,
      color: t.color || '#e65e4b',
      body: b,
      home: { ...def },
      born: this.time,
    };
    this.blocks.push(block);
    return block;
  }

  /** The machine being driven. */
  get machine() {
    return this.machines[this.active];
  }

  /** The active machine's grab point. */
  get tool() {
    return this.machine.tip;
  }

  /** Switches to machine i, dropping whatever the previous one held. */
  select(i) {
    if (i < 0 || i >= this.machines.length) return;
    this.release();
    this.active = i;
    this.onEvent({ type: 'machine', kind: this.machine.kind });
  }

  /** Hops into the nearest other machine. */
  hop() {
    const m = this.machine;
    const others = this.machines
      .map((a, i) => ({ i, d: Math.hypot(a.x - m.x, a.z - m.z) }))
      .filter((a) => a.i !== this.active)
      .sort((a, b) => a.d - b.d);
    if (others.length) this.select(others[0].i);
  }

  /** Recomputes a machine's grab point (reach ahead along the boom, at lift height) and moves its tool body there:
   *  instantly when placing or resetting, otherwise as the next kinematic target so contacts stay smooth. */
  updateTip(m, instant = false) {
    const a = m.yaw + m.swing,
      tip = { x: m.x + Math.sin(a) * m.reach, y: m.lift, z: m.z + Math.cos(a) * m.reach };
    m.tip = tip;
    const q = MACHINE[m.kind].orient(a, m);
    if (instant) {
      m.tool.setTranslation(tip, true);
      m.tool.setRotation(q, true);
    } else {
      m.tool.setNextKinematicTranslation(tip);
      m.tool.setNextKinematicRotation(q);
    }
  }

  /** Grab toggles: releases a held toy, or picks the nearest toy within reach of the tool. Returns false only when
   *  nothing is close enough, so the HUD can explain why. */
  grab() {
    if (this.held) {
      this.release();
      return true;
    }
    const tip = this.tool;
    const near = this.blocks
      .map((b) => {
        const p = b.body.translation();
        return { b, d: Math.hypot(p.x - tip.x, p.y - tip.y, p.z - tip.z) };
      })
      .filter((x) => x.d < GRAB_RADIUS)
      .sort((a, b) => a.d - b.d);
    const nearest = near[0];
    if (!nearest) return false;
    this.held = nearest.b;
    this.held.body.wakeUp();
    this.onEvent({ type: 'grab' });
    return true;
  }

  /** Lets go of the held toy; a released toy keeps no assistance at all. */
  release() {
    if (this.held) {
      this.held.body.resetForces(true);
      this.held.body.resetTorques(true);
      this.held = null;
      this.onEvent({ type: 'release' });
    }
  }

  /** Puts the active machine back at its start, upright and folded, after releasing its load. */
  resetMachine() {
    this.release();
    const m = this.machine;
    Object.assign(m, {
      x: m.home.x,
      z: m.home.z,
      yaw: 0,
      swing: 0,
      lift: HOME_LIFT,
      tilt: 0,
      speed: 0,
      reach: MACHINE[m.kind].reach[0],
    });
    m.body.setTranslation({ x: m.x, y: RIDE_HEIGHT, z: m.z }, true);
    m.body.setRotation(qyaw(0), true);
    this.updateTip(m, true);
  }

  /** A fresh copy of every toy's pose and velocity: what missions check and the scene draws. */
  poses() {
    return this.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      color: b.color,
      position: { ...b.body.translation() },
      rotation: { ...b.body.rotation() },
      velocity: { ...b.body.linvel() },
      angular: { ...b.body.angvel() },
    }));
  }

  /** True when a machine centred at (x, z) would overlap a fixed prop (the platform or the wall). */
  blocked(x, z) {
    return (this.round.props || []).some(
      (p) => Math.abs(x - p.x) < p.size[0] / 2 + 1.15 && Math.abs(z - p.z) < p.size[2] / 2 + 1.3,
    );
  }

  /** One fixed step with this frame's control axes: drive and steer the active machine, move its joints, carry the
   *  held toy and the wrecking ball on springs, step the world, then handle impacts, glass and lost toys. */
  step(input = {}) {
    const dt = DT,
      m = this.machine,
      d = MACHINE[m.kind];
    this.time += dt;
    this.drive(m, d, input, dt);
    m.lift = clamp(m.lift + (input.lift || 0) * LIFT_RATE * dt, ...d.height);
    moveJoint(m, d, d.stick.joint, (input.tool || 0) * d.stick.rate * dt);
    m.swing += (input.swing || 0) * dt;
    m.tilt = clamp(m.tilt + (input.tilt || 0) * dt, ...TILT);
    if (d.extend) moveJoint(m, d, d.extend.joint, (input.extend || 0) * d.extend.rate * dt);
    m.body.setNextKinematicTranslation({ x: m.x, y: m.y, z: m.z });
    m.body.setNextKinematicRotation(qyaw(m.yaw));
    for (const machine of this.machines) this.updateTip(machine);
    if (this.held) this.carry(this.held.body, m.tip);
    if (this.ball) this.swingBall();
    this.world.step(this.queue);
    this.queue.drainContactForceEvents((e) => this.contact(e));
    for (const b of this.blocks) {
      const p = b.body.translation();
      if (p.y < -6 || Math.abs(p.x) > YARD.lost || Math.abs(p.z) > YARD.lost) this.recover(b);
    }
  }

  /** Eases the chassis speed toward the drive axis, turns, and moves it, sliding along props instead of through
   *  them (each axis is checked separately) and staying inside the yard. */
  drive(m, d, input, dt) {
    m.speed += (clamp(input.drive || 0, -1, 1) * d.speed - m.speed) * 0.12;
    m.yaw += clamp(input.steer || 0, -1, 1) * d.turn * dt;
    const nx = clamp(m.x + Math.sin(m.yaw) * m.speed * dt, -YARD.half, YARD.half),
      nz = clamp(m.z + Math.cos(m.yaw) * m.speed * dt, -YARD.half, YARD.half);
    if (!this.blocked(nx, m.z)) m.x = nx;
    if (!this.blocked(m.x, nz)) m.z = nz;
    m.y = RIDE_HEIGHT + this.groundAt(m.x, m.z);
  }

  /** The held toy's spring: a damped pull toward the tip plus gravity compensation, capped so a load cannot be
   *  forced through a wall, and a torque that gently levels it. It carries weight through contacts like a real load. */
  carry(b, tip) {
    const p = b.translation(),
      v = b.linvel(),
      r = b.rotation(),
      w = b.angvel(),
      mass = b.mass(),
      target = { ...tip };
    b.resetForces(false);
    b.resetTorques(false);
    const f = {
      x: (target.x - p.x) * 95 - v.x * 19,
      y: (target.y - p.y) * 95 - v.y * 19 + 9.81,
      z: (target.z - p.z) * 95 - v.z * 19,
    };
    const scale = Math.min(1, 230 / Math.max(1, len(f)));
    b.addForce({ x: f.x * mass * scale, y: f.y * mass * scale, z: f.z * mass * scale }, true);
    const sign = r.w < 0 ? -1 : 1;
    b.addTorque(
      {
        x: (-r.x * sign * 28 - w.x * 9) * mass,
        y: (-r.y * sign * 28 - w.y * 9) * mass,
        z: (-r.z * sign * 28 - w.z * 9) * mass,
      },
      true,
    );
  }

  /** The wrecking ball hangs from its own crane's tip on a softer spring, even after hopping to another machine. */
  swingBall() {
    const p = this.ball.translation(),
      v = this.ball.linvel(),
      t = this.ballMachine.tip,
      mass = this.ball.mass();
    this.ball.resetForces(false);
    this.ball.addForce(
      {
        x: ((t.x - p.x) * 18 - v.x * 3) * mass,
        y: ((t.y - p.y) * 18 - v.y * 3 + 9.81) * mass,
        z: ((t.z - p.z) * 18 - v.z * 3) * mass,
      },
      true,
    );
  }

  /** A contact-force event: a thunk for a firm hit, and a very hard hit on glass (older than a second, so a fresh
   *  replacement cannot shatter at once) turns it into glitter and returns it to its start. */
  contact(e) {
    const force = e.totalForceMagnitude();
    if (force > 800) this.onEvent({ type: 'impact', force });
    if (force > 9000) {
      for (const b of this.blocks) {
        const glass = b.type === 'glass' && this.time - b.born > 1;
        if (glass && [e.collider1(), e.collider2()].includes(b.body.collider(0).handle)) {
          this.recover(b);
          this.onEvent({ type: 'glitter', position: { ...b.body.translation() } });
        }
      }
    }
  }

  /** Returns a lost (or shattered) toy to its starting spot, upright and still. */
  recover(b) {
    if (this.held === b) this.release();
    b.body.setTranslation({ x: b.home.x, y: b.home.y || 2, z: b.home.z }, true);
    b.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.born = this.time;
  }

  /** The ground height at (x, z): 0, or the shape of the terrain stamp covering that point. */
  groundAt(x, z) {
    const s = this.stamps.find((s) => Math.abs(s.x - x) < 2 && Math.abs(s.z - z) < 2);
    if (!s) return 0;
    return Object.hasOwn(STAMP_HEIGHT, s.kind) ? STAMP_HEIGHT[s.kind](x - s.x, z - s.z) : 0;
  }

  /** Places a terrain stamp on the tile nearest (x, z). Pits and water lower the tile; a hill adds a low mound and a
   *  ramp a wedge. Returns false when the yard already has 12 stamps or the tile is taken. */
  stamp(kind, x, z) {
    if (this.stamps.length >= 12) return false;
    x = clamp(Math.round((x - 2) / 4) * 4 + 2, -YARD.half, YARD.half);
    z = clamp(Math.round((z - 2) / 4) * 4 + 2, -YARD.half, YARD.half);
    if (this.stamps.some((s) => s.x === x && s.z === z)) return false;
    const s = { kind, x, z };
    this.stamps.push(s);
    if (Object.hasOwn(RECESS, kind)) this.tile(x, z, RECESS[kind]);
    else if (kind === 'hill') {
      // The mound's solid is the convex hull of the very points the scene draws.
      const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(hillPoints()));
      if (hull) this.world.createCollider(hull.setTranslation(x, 0, z).setFriction(1));
    } else if (kind === 'ramp') {
      // The wedge's solid is the convex hull of the very corners the scene draws.
      const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(rampPoints()));
      if (hull) this.world.createCollider(hull.setTranslation(x, 0, z).setFriction(1));
    }
    this.onEvent({ type: 'stamp', stamp: s });
    return true;
  }

  /** Hangs the 230 kg wrecking ball from the active machine's tip, or takes it down again. Only a machine whose row
   *  allows it (the crane) can carry it. */
  wreck() {
    if (!MACHINE[this.machine.kind].wreckingBall) return false;
    if (this.ball) {
      this.world.removeRigidBody(this.ball);
      this.ball = null;
      this.ballMachine = null;
      return true;
    }
    this.ballMachine = this.machine;
    const t = this.tool;
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(t.x, t.y, t.z).setLinearDamping(0.2).setCcdEnabled(true);
    this.ball = this.world.createRigidBody(desc);
    this.world.createCollider(RAPIER.ColliderDesc.ball(0.85).setMass(230), this.ball);
    return true;
  }

  /** The sandbox save: toy poses, machine poses and joints, and stamps (daylight is added by the app). */
  snapshot() {
    return {
      v: 1,
      toys: this.poses().map((b) => ({
        type: b.type,
        color: b.color,
        x: b.position.x,
        y: b.position.y,
        z: b.position.z,
        rotation: b.rotation,
      })),
      machines: this.machines.map((m) => ({
        kind: m.kind,
        x: m.x,
        z: m.z,
        yaw: m.yaw,
        swing: m.swing,
        lift: m.lift,
        reach: m.reach,
        tilt: m.tilt,
      })),
      stamps: this.stamps.map((s) => ({ ...s })),
    };
  }

  /** Rebuilds a saved sandbox: replaces the toys, re-places the stamps and moves matching machines into place. */
  restore(s) {
    this.release();
    for (const b of this.blocks) this.world.removeRigidBody(b.body);
    this.blocks = [];
    for (const t of s.toys || []) this.spawn(t);
    for (const st of s.stamps || []) this.stamp(st.kind, st.x, st.z);
    for (const saved of s.machines || []) {
      const m = this.machines.find((m) => m.kind === saved.kind);
      if (m) {
        Object.assign(m, saved);
        m.body.setTranslation({ x: m.x, y: RIDE_HEIGHT, z: m.z }, true);
        m.body.setRotation(qyaw(m.yaw), true);
        this.updateTip(m, true);
      }
    }
  }

  /** Frees the WASM world. */
  destroy() {
    this.queue.free();
    this.world.free();
  }
}
