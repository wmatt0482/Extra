// The yard's physics: one Rapier world that runs the same fixed 1/60 s steps in browsers and in the Node tests. Toys
// are dynamic bodies with real mass, friction and collisions. Machines are deliberately assisted: their chassis and
// tools are kinematic bodies moved to where the controls say, so a machine never tips over, while a held toy hangs
// from a bounded spring and still collides with everything. Each machine kind's tool shape and joints come from the
// MACHINE table below, so a new machine is a table row (plus its model in scene/machines.js).
import RAPIER from '../vendor/rapier.mjs';
import { TOYS, MACHINES } from './content.mjs';
import { RECESS, hillHeight, hillPoints, rampHeight, rampPoints } from './terrain.mjs';
import { SITES, HARBOR, siteOf, mudAt, inWater, terrainGrid } from './sites.mjs';
import { grassTouches, evaluate, halfHeight } from './missions.mjs';
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

/** The skid steer's bucket tilt limits in radians (the default tilt joint range; a MACHINE row may set `tiltRange`). */
const TILT = [-0.7, 0.7];

/** How fast the tool rises and falls (m/s at full stick). */
const LIFT_RATE = 2.2;

/** Where a bucket (the skid steer's and the wheel loader's) can pick a block up, in metres around the grab point in the
 *  machine's heading: this far to either side (the bucket is 2.4 m wide, a block 1.2 m), from this far behind to this far
 *  ahead (a block pushed in front of the lip sits about 1.3 m out) and this far below and above it. The bucket's tilt
 *  does not matter. Machines with a hanging tool (the excavator's bucket, the crane's magnet) grab inside a sphere. */
export const GRAB_BOX = { x: 1.8, z: [-1.1, 2.4], y: [-1.5, 1.4] };
const GRAB_SPHERE = 2.1;

/** Once a block has matched its place for this long (seconds) and is not being held, it locks there (see lockStep). The
 *  check runs every LOCK_EVERY steps; a locking block glides to its exact slot over SNAP_STEPS steps. */
export const LOCK_AFTER = 0.4;
const LOCK_EVERY = 4;
const SNAP_STEPS = 10;
/** A block resting this long (seconds) just outside the delivery zone, or near a free outline, slides into it. */
const NEAR_AFTER = 0.7;
/** How far outside the zone's edge (metres, measured at the block's centre) and how far from an outline's centre a block
 *  may rest and still be drawn in. */
const NEAR_EDGE = 0.7;
const NEAR_GHOST = 1.0;

/** Pouring: a bucket tilted forward past POUR_TILT (radians) with a block lying in it lets the block slide out. Rubber on
 *  steel at 40 degrees (the bucket's largest tilt) is below the friction angle of the blocks' 0.9, so a released block used
 *  to stay wedged; while it is in a tilted bucket it now has POUR_FRICTION, a gentle push down the floor and some damping. */
export const POUR_TILT = 0.25;
const POUR_FRICTION = 0.1;
const POUR_PUSH = 2.2;
const POUR_DAMPING = 2.2;
const POUR_LIGHTEN = 0.8;
const BLOCK_FRICTION = 0.9;

/** Collision groups (Rapier packs membership in the high 16 bits and the filter in the low 16). Tools are group 2; a
 *  block that has just been grabbed is group 1 and ignores group 2 until it has been drawn into the bucket (a block pushed
 *  in front of the lip, or grabbed with the bucket tilted, would otherwise jam against the plates), then it is ordinary. */
const GROUP_ALL = 0xffffffff;
const GROUP_TOOL = 0x0002ffff;
const GROUP_THROUGH = 0x0001fffd;

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
  tilt: (d) => d.tiltRange || TILT,
};

/** The skid steer's bucket in the tool's frame (origin at the grab point, +z ahead, metres), shared with its model
 *  in scene/machines.js so what is drawn is what pushes. A wide, low box bucket: a floor plate, a back plate and two
 *  side plates whose top edge slopes down toward the cutting edge, as on a real skid-steer bucket. `side` is the side
 *  plate's outline as [z, y] points; each plate is a convex hull of that outline across `sideX`. */
export const SKID_BUCKET = {
  width: 2.4,
  floor: { y: -0.62, thick: 0.12, z: [-0.65, 0.65] },
  back: { z: -0.62, thick: 0.12, y: [-0.64, 0.16] },
  sideX: [1.09, 1.21],
  side: [
    [-0.68, -0.68],
    [0.66, -0.68],
    [0.66, -0.4],
    [-0.68, 0.16],
  ],
};

/** The bucket's colliders: the floor and back as boxes ([size, offset]) and each side plate as { hull } points. */
function bucketColliders(b = SKID_BUCKET) {
  const { floor, back } = b;
  const sides = [-1, 1].map((k) => ({
    hull: b.sideX.flatMap((x) => b.side.flatMap(([z, y]) => [k * x, y, z])),
  }));
  return [
    [
      [b.width, floor.thick, floor.z[1] - floor.z[0]],
      [0, floor.y, (floor.z[0] + floor.z[1]) / 2],
    ],
    [
      [b.width, back.y[1] - back.y[0], back.thick],
      [0, (back.y[0] + back.y[1]) / 2, back.z],
    ],
    ...sides,
  ];
}


// ---- Small quaternion helpers for the two Lab machines (a tool that is neither a plain yaw nor a bucket tilt) --------
/** The quaternion of a turn by `yaw` about the vertical axis followed (in the machine's frame) by `pitch` about x. */
const yawPitch = (yaw, pitch) => {
  const sy = Math.sin(yaw / 2),
    cy = Math.cos(yaw / 2),
    sx = Math.sin(pitch / 2),
    cx = Math.cos(pitch / 2);
  return { x: cy * sx, y: sy * cx, z: -sy * sx, w: cy * cx };
};
/** The product of two quaternions (a then b, in a's frame). */
const qmul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const qx = (a) => ({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) });
const qz = (a) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
/** The chassis's rotation: its heading, then its pitch (nose up is positive) and roll (the +x side up is positive) where
 *  it stands on a slope. On flat ground (and always in the yard) it is the plain heading. The scene turns the model by
 *  the same angles (Euler order YXZ: yaw, -pitch, roll). */
export const chassisQ = (m) =>
  m.pitch || m.roll ? qmul(qmul(qyaw(m.yaw), qx(-m.pitch)), qz(m.roll)) : qyaw(m.yaw);
/** A point given in the machine's frame (lx right, ly up from the ground, lz ahead) as a world point. On a slope the
 *  frame pitches and rolls with the chassis. */
const toWorld = (m, lx, ly, lz) => {
  if (!m.pitch && !m.roll)
    return {
      x: m.x + lx * Math.cos(m.yaw) + lz * Math.sin(m.yaw),
      y: m.y - RIDE_HEIGHT + ly,
      z: m.z - lx * Math.sin(m.yaw) + lz * Math.cos(m.yaw),
    };
  const v = rotate(chassisQ(m), { x: lx, y: ly, z: lz });
  return { x: m.x + v.x, y: m.y - RIDE_HEIGHT + v.y, z: m.z + v.z };
};
/** A tool rotation given in the machine's frame (turned `yaw` about its vertical, then pitched by `pitch` about its x)
 *  as a world rotation: the plain yawPitch on level ground. */
const toolQ = (m, yaw, pitch) =>
  m.pitch || m.roll ? qmul(qmul(chassisQ(m), qyaw(yaw)), qx(pitch)) : yawPitch(m.yaw + yaw, pitch);
/** Rotates vector v by the unit quaternion q. */
function rotate(q, v) {
  const { x, y, z, w } = q,
    tx = 2 * (y * v.z - z * v.y),
    ty = 2 * (z * v.x - x * v.z),
    tz = 2 * (x * v.y - y * v.x);
  return { x: v.x + w * tx + (y * tz - z * ty), y: v.y + w * ty + (z * tx - x * tz), z: v.z + w * tz + (x * ty - y * tx) };
}
const conj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

/** DT-04, the dump truck (Lab vehicle). Lengths in metres in the truck's frame (x across, z ahead, y up from the
 *  ground); the chassis origin is the middle of the truck. The bed is the machine's tool body: it hinges at the back
 *  (`hinge`), carries loose blocks between a floor, two side walls and a headboard, and the tailgate is a second
 *  kinematic body hinged along the bottom of the rear edge that drops open into a chute as the bed tips (`gate`). The lift joint
 *  is the tip: `lift` runs 0.7 (flat) to 2.5, which is 0 to `max` radians. The scene draws from these same numbers. */
export const DUMP = {
  pivot: -1.4,
  hinge: { z: -2.5, y: 1.62 },
  bed: { inner: 2.5, length: 3.6, wall: 0.14, wallH: 1.3, floor: 0.16, headH: 1.9 },
  max: 0.92,
  gate: { from: 0.1, span: 0.25, open: 1.62, h: 1.3, t: 0.1 },
  rear: { z: -2.7 },
  front: { z: 2.9 },
};
/** The bed's tip angle (radians) for a dump truck's lift joint. */
export const bedAngle = (lift, d = MACHINES.dump) => ((lift - d.height[0]) / (d.height[1] - d.height[0])) * DUMP.max;
/** How far the tailgate has swung open (radians) at bed angle `a`: shut until the bed starts to rise, then fully open
 *  well before a load can slide. */
export const gateAngle = (a) => clamp((a - DUMP.gate.from) / DUMP.gate.span, 0, 1) * DUMP.gate.open;

/** The bed's colliders in its own frame (origin at the hinge, +z along the bed, floor top at y = 0). */
function dumpBedColliders(b = DUMP.bed) {
  const w = b.inner + 2 * b.wall;
  return [
    [[w, b.floor, b.length], [0, -b.floor / 2, b.length / 2]],
    ...[-1, 1].map((k) => [[b.wall, b.wallH, b.length], [k * (b.inner + b.wall) / 2, b.wallH / 2, b.length / 2]]),
    [[w, b.headH + b.floor, 0.16], [0, (b.headH - b.floor) / 2, b.length + 0.08]],
  ];
}
/** The truck's chassis colliders in the machine frame, y measured from the ground (placed relative to the body). */
const g = (y) => y - RIDE_HEIGHT;
const DUMP_CHASSIS = [
  [[2.1, 0.5, 5.4], [0, g(1.05), 0.1]],
  [[2.3, 1.6, 1.4], [0, g(2.1), 2.1]],
  ...[-1, 1].flatMap((k) => [
    [[0.5, 1.2, 2.1], [k * 1.15, g(0.6), -1.5]],
    [[0.5, 1.2, 1.2], [k * 1.15, g(0.6), 1.75]],
  ]),
];

/** The dump truck's tool and gate poses for its current joints: the bed turns about the hinge (its back stays down, the
 *  front rises), and the tailgate hangs from the top of the rear edge. */
function placeDump(m) {
  const a = bedAngle(m.lift),
    h = DUMP.hinge,
    pos = toWorld(m, 0, h.y, h.z),
    q = toolQ(m, 0, -a),
    // the bed's middle, for the camera and the effects
    mid = rotate(q, { x: 0, y: 0.5, z: DUMP.bed.length / 2 }),
    gv = { x: 0, y: 0, z: 0 };
  return {
    tip: { x: pos.x + mid.x, y: pos.y + mid.y, z: pos.z + mid.z },
    pos,
    q,
    gate: { pos: { x: pos.x + gv.x, y: pos.y + gv.y, z: pos.z + gv.z }, q: toolQ(m, 0, -a - gateAngle(a)) },
  };
}

/** FL-05, the forklift (Lab vehicle). The drive wheels are at the front and it steers with the rear wheels, so it
 *  yaws about the front axle (`pivot`) and its tail swings. The tool body is the carriage with the two tines and the
 *  load backrest; it rides up the mast, which tilts about the mast foot (`mast`). `lift` is the height of the tine tops
 *  above the floor; the tines are `t` thick, so they slip into the 0.30 m opening under a pallet only when they are low,
 *  level and lined up with the two runners' gap (tines at +-`x`, 0.14 wide, against a gap 1.3 m wide). */
export const FORK = {
  pivot: 0.55,
  mast: { z: 1.4, y: 0.45 },
  tine: { x: 0.4, w: 0.14, t: 0.07, len: 1.7, heel: 0.1 },
  back: { w: 1.5, h: 1.15, t: 0.08 },
  tilt: [-0.06, 0.2],
};
const FORK_CHASSIS = [
  [[1.6, 0.95, 2.4], [0, g(0.925), -0.1]],
  ...[-1, 1].flatMap((k) => [
    [[0.42, 0.95, 0.95], [k * 0.78, g(0.475), 0.55]],
    [[0.3, 0.7, 0.7], [k * 0.55, g(0.35), -0.95]],
  ]),
];
const FORK_TOOL = (f = FORK) => [
  ...[-1, 1].map((k) => [[f.tine.w, f.tine.t, f.tine.len], [k * f.tine.x, -f.tine.t / 2, f.tine.heel + f.tine.len / 2]]),
  [[f.back.w, f.back.h, f.back.t], [0, f.back.h / 2 - f.tine.t, f.tine.heel - f.back.t / 2]],
];
/** The tine top's height for a lift joint, never so low that a tipped-forward tine would dig into the floor. */
const forkHeight = (m) => Math.max(m.lift, 0.08 + (FORK.tine.heel + FORK.tine.len) * Math.sin(Math.max(0, -m.tilt)) + 0.01);
/** Where the carriage sits in the forklift's own frame (y from the ground, z ahead of its centre): it slides along the
 *  mast's axis, which leans back by the tilt about the mast foot. */
export function forkCarriage(m) {
  const up = forkHeight(m) - FORK.mast.y;
  return { y: FORK.mast.y + up * Math.cos(m.tilt), z: FORK.mast.z - up * Math.sin(m.tilt) };
}
/** The carriage's pose and the tine tips for the forklift's lift and mast tilt. */
function placeFork(m) {
  const f = FORK,
    q = toolQ(m, 0, -m.tilt),
    c = forkCarriage(m),
    pos = toWorld(m, 0, c.y, c.z),
    tipV = rotate(q, { x: 0, y: 0, z: f.tine.heel + f.tine.len });
  return { tip: { x: pos.x + tipV.x, y: pos.y + tipV.y, z: pos.z + tipV.z }, pos, q };
}

/** WL-06, the wheel loader (a free machine, earned at job 16). It steers by bending in the middle: the front frame,
 *  which carries the lift arms and the bucket, turns about the hinge at the machine's centre by half the articulation
 *  angle `artic` and the rear frame by the other half, so the bucket swings out to the side of a turn. The arms pivot at
 *  `arm` on the front frame and pin to the bucket `length` metres away, so the bucket rises on a real arc: `lift` is the
 *  grab point's height above the ground and the reach follows from it (furthest out at the arm pivot's height). The
 *  bucket is a wider, deeper box than the skid steer's (floor, back and two sloped side plates) that tilts on `tilt`. */
export const LOADER = {
  arm: { z: 0.6, y: 2.1 },
  length: 3.2,
  /** The largest articulation (radians) and the share of the gap it closes each step as it follows the steering. */
  artic: 0.55,
  articEase: 0.15,
  bucket: {
    width: 2.9,
    floor: { y: -0.62, thick: 0.12, z: [-0.78, 0.78] },
    back: { z: -0.74, thick: 0.12, y: [-0.66, 0.34] },
    sideX: [1.33, 1.45],
    side: [
      [-0.8, -0.68],
      [0.78, -0.68],
      [0.78, -0.36],
      [-0.8, 0.34],
    ],
  },
  rearAxle: -1.55,
  frontAxle: 1.35,
};
/** How far ahead of the hinge the loader's grab point is at lift height `lift` (the arc of the lift arms). */
export const loaderReach = (lift) => {
  const { arm, length } = LOADER,
    s = clamp((lift - arm.y) / length, -0.999, 0.999);
  return arm.z + length * Math.sqrt(1 - s * s);
};
/** The loader's bucket pose: on the arc for its lift, turned by half the articulation, tilted by its tilt joint. */
function placeLoader(m) {
  const reach = loaderReach(m.lift),
    half = (m.artic || 0) / 2;
  m.reach = reach;
  const pos = toWorld(m, Math.sin(half) * reach, m.lift, Math.cos(half) * reach);
  return { tip: pos, pos, q: toolQ(m, half, m.tilt) };
}
const LOADER_CHASSIS = [
  [[2.3, 1.3, 2.9], [0, g(1.35), -1.25]],
  [[2.0, 0.9, 1.6], [0, g(1.2), 1.0]],
];

/** Physics for each machine kind.
 *  - speed, turn, height, reach: drive speed, turn rate, tool height range and reach range (from content.mjs).
 *  - tool: colliders on the tool body in the tool's frame, each a box [size, offset] or a convex { hull } of flat
 *    [x, y, z, ...] points; an empty list is a tool that only grabs (the excavator's bucket and the crane's magnet).
 *    The skid steer's open bucket (floor, back, two sloped sides) can also scoop and push loose toys.
 *  - orient: the tool's rotation from the boom angle (yaw + swing) and the machine's joints.
 *  - stick: the joint the right stick's left/right axis (J/L) drives, and its rate per second at full stick.
 *  - extend: the joint U/O drives, or null.
 *  - swings: whether the swing joint exists (the excavator's house and the crane's slewing house turn; the skid
 *    steer's arms are fixed to its body, so it ignores swing input).
 *  - wreckingBall: whether this machine can hang the wrecking ball.
 *  The grab point is the same for every machine: `reach` metres ahead along the boom, at the tool's lift height. */
export const MACHINE = {
  skid: {
    ...pick(MACHINES.skid),
    tool: bucketColliders(),
    orient: yawAndTilt,
    stick: { joint: 'tilt', rate: 1 },
    extend: null,
    swings: false,
    wreckingBall: false,
    bucket: true,
  },
  excavator: {
    ...pick(MACHINES.excavator),
    tool: [],
    orient: yawOnly,
    stick: { joint: 'reach', rate: 1.8 },
    extend: null,
    swings: true,
    wreckingBall: false,
  },
  crane: {
    ...pick(MACHINES.crane),
    tool: [],
    orient: yawOnly,
    stick: { joint: 'swing', rate: 0.8 },
    extend: { joint: 'reach', rate: 1.8 },
    swings: true,
    wreckingBall: true,
  },
  // WL-06 wheel loader (0.6), a free machine like the first three: `place` puts its bucket on the arms' arc, and
  // `artic` makes it steer by bending in the middle (it turns slowly on the spot; the bucket swings out on a turn).
  loader: {
    ...pick(MACHINES.loader),
    tool: bucketColliders(LOADER.bucket),
    chassis: LOADER_CHASSIS,
    place: placeLoader,
    home: 0.8,
    liftRate: 1.8,
    ease: 0.07,
    pivot: 0,
    steerLow: 0.4,
    margin: 1.6,
    tiltRange: [-0.8, 0.7],
    tiltRate: 1,
    artic: true,
    orient: yawAndTilt,
    stick: { joint: 'tilt', rate: 1 },
    extend: null,
    swings: false,
    wreckingBall: false,
    bucket: true,
  },
  // The Lab machines. `place(m)` gives the tool's pose (and the tip the camera and effects follow) from the joints, in
  // place of the boom rule; `chassis` lists the body's box colliders; `gate` is the dump truck's second kinematic body.
  // `ease` is how quickly the drive speed follows the stick (small = long stopping distance), `pivot` the point on the
  // machine's centre line that it turns about, `steerLow` the share of the turn rate available at a standstill.
  // `grabs: false` machines have no Grab: loads ride on them (a bed, a pair of tines) instead of hanging from a spring.
  dump: {
    ...pick(MACHINES.dump),
    tool: dumpBedColliders(),
    // the gate plate sits behind its hinge line, so when it drops open its upper face is flush with the bed floor
    gate: [[[DUMP.bed.inner, DUMP.gate.h, DUMP.gate.t], [0, DUMP.gate.h / 2, -DUMP.gate.t / 2]]],
    chassis: DUMP_CHASSIS,
    place: placeDump,
    home: 0.7,
    liftRate: 0.62,
    ease: 0.022,
    pivot: DUMP.pivot,
    steerLow: 0.3,
    margin: 1.7,
    friction: 0.5,
    orient: yawOnly,
    stick: null,
    extend: null,
    swings: false,
    wreckingBall: false,
    grabs: false,
  },
  fork: {
    ...pick(MACHINES.fork),
    tool: FORK_TOOL(),
    chassis: FORK_CHASSIS,
    place: placeFork,
    home: 0.1,
    liftRate: 0.9,
    ease: 0.09,
    pivot: FORK.pivot,
    steerLow: 0.5,
    margin: 1.4,
    tiltRange: FORK.tilt,
    tiltRate: 0.35,
    orient: yawOnly,
    stick: { joint: 'tilt', rate: 0.35 },
    extend: null,
    swings: false,
    wreckingBall: false,
    grabs: false,
  },
};

/** The driving numbers a MACHINE row takes from the shared machine metadata. */
function pick({ speed, turn, height, reach }) {
  return { speed, turn, height, reach };
}

/** How each machine copes with real slopes and mud (the hillside, 0.6): `climb` is the steepest slope in degrees it can
 *  drive onto (tracks grip better than wheels; the tall crane and the forklift are kept to gentle ground), `gear` picks
 *  its mud factor, and `length` and `width` are the spread of its wheels or tracks, which set how it pitches and rolls.
 *  A machine stands still on any slope it could climb (nothing slides), slows as it climbs, and stops at the foot of
 *  anything steeper, in both directions, so it never drives over a cliff edge. */
export const TRACTION = {
  skid: { climb: 20, gear: 'wheels', length: 1.2, width: 1.84 },
  excavator: { climb: 24, gear: 'tracks', length: 2.6, width: 2.1 },
  crane: { climb: 17, gear: 'tracks', length: 3.5, width: 2.5 },
  loader: { climb: 22, gear: 'wheels', length: 2.9, width: 2.2 },
  dump: { climb: 16, gear: 'wheels', length: 3.7, width: 2.3 },
  fork: { climb: 9, gear: 'wheels', length: 1.5, width: 1.56 },
};
/** The share of its speed a machine keeps in mud. */
export const MUD_FACTOR = { wheels: 0.45, tracks: 0.72 };
/** How much of its speed a machine loses climbing a slope at its limit (it keeps the rest; a gentler slope costs less). */
const CLIMB_LOSS = 0.55;

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
    /** Successful grabs since the job began (the "grabs" build challenge counts these). */
    this.grabs = 0;
    this.wrecking = false;
    this.ball = null;
    this.ballMachine = null;
    /** The work site (sites.mjs): the yard's tiles, the harbor's quay and water, or the hillside's slopes. */
    this.site = siteOf(round);
    /** Rule breaks this job has sent back (the "off the grass" rule), and the steps until the rule is next checked. */
    this.returned = 0;
    this.ruleTick = 0;
    /** The steps since the placed-block check last ran (it runs every LOCK_EVERY steps, in jobs only). */
    this.lockTick = 0;
    this.tiles = new Map();
    if (this.site.floor === 'tiles') {
      for (let x = -YARD.half; x <= YARD.half; x += YARD.tile) {
        for (let z = -YARD.half; z <= YARD.half; z += YARD.tile) this.tile(x, z, 0);
      }
    } else if (this.site.floor === 'quay') this.buildHarbor();
    else this.buildTerrain();
    for (const p of round.props || []) this.fixed(p.x, p.y, p.z, p.size);
    if (this.site.fence) {
      // A tall wall where the ground climbs, so nothing drives or rolls away over the hillside's fence.
      for (const [x, z, s] of this.site.fence) this.fixed(x, s[1] > 3 ? s[1] / 2 - 3 : 1.5, z, s);
    } else {
      // The fence: four 3 m walls just outside the yard, so nothing drives or rolls away.
      const fence = [
        [-YARD.fence, 0, [1, 3, 35]],
        [YARD.fence, 0, [1, 3, 35]],
        [0, -YARD.fence, [35, 3, 1]],
        [0, YARD.fence, [35, 3, 1]],
      ];
      for (const [x, z, s] of fence) this.fixed(x, 1.5, z, s);
    }
    // Jobs line the machines up from (-6, -4); a round's `spawns` ([x, z] per machine) overrides that.
    round.machines.forEach((kind, i) => this.addMachine(kind, ...(round.spawns?.[i] || [-6 + i * 5, -4])));
    round.toys.forEach((t) => this.spawn(t));
  }

  /** The harbor: one quay slab (top at y = 0) up to the edge, the edge kerb, the harbor bed under the water, the moored
   *  barge (a fixed hull whose deck sits just below the quay, with a low gunwale round it) and the two old piles. */
  buildHarbor() {
    const H = HARBOR,
      b = H.barge;
    this.fixed((H.edge - 22) / 2, -1, 0, [H.edge + 22, 2, 44]);
    const k = H.kerb;
    this.fixed(k.x, k.h / 2, (k.z[0] + k.z[1]) / 2, [k.w, k.h, k.z[1] - k.z[0]]);
    this.fixed(H.edge + 15, H.water.bed - 1, 0, [30, 2, 44]);
    const bx = (b.x[0] + b.x[1]) / 2,
      bz = (b.z[0] + b.z[1]) / 2,
      bw = b.x[1] - b.x[0],
      bd = b.z[1] - b.z[0],
      hull = b.deck - H.water.bed;
    this.fixed(bx, b.deck - hull / 2, bz, [bw, hull, bd]);
    for (const k of [-1, 1]) {
      this.fixed(bx + (k * (bw - b.rimW)) / 2, b.deck + b.rim / 2, bz, [b.rimW, b.rim, bd]);
      this.fixed(bx, b.deck + b.rim / 2, bz + (k * (bd - b.rimW)) / 2, [bw, b.rim, b.rimW]);
    }
    for (const p of H.piles) this.fixed(p.x, -2, p.z, [p.size, 4, p.size]);
  }

  /** The hillside's ground: one Rapier heightfield sampled from the same height function the machines ride on and the
   *  scene draws (sites.mjs). */
  buildTerrain() {
    const { n, size, heights } = terrainGrid(this.site);
    this.world.createCollider(
      RAPIER.ColliderDesc.heightfield(n, n, heights, { x: size, y: 1, z: size }).setFriction(0.95),
    );
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

  /** Adds a machine of `kind` at (x, z): a kinematic chassis and a separate kinematic tool body (and, for the dump
   *  truck, a kinematic tailgate). */
  addMachine(kind, x, z) {
    const def = MACHINE[kind],
      ground = this.groundAt(x, z);
    const chassis = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, RIDE_HEIGHT + ground, z);
    const body = this.world.createRigidBody(chassis);
    for (const [size, offset] of def.chassis || [[CHASSIS.map((v) => v * 2), [0, 0, 0]]]) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
          .setTranslation(...offset)
          .setFriction(0.8),
        body,
      );
    }
    const m = {
      kind,
      body,
      x,
      z,
      y: RIDE_HEIGHT + ground,
      yaw: 0,
      swing: 0,
      lift: def.home ?? HOME_LIFT,
      reach: def.reach[0],
      tilt: 0,
      speed: 0,
      // where it stands on a slope (radians; always 0 in the yard), and the loader's bend
      pitch: 0,
      roll: 0,
      artic: 0,
      home: { x, z },
      tool: null,
      gate: null,
      tip: null,
    };
    m.tool = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const friction = def.friction ?? 0.95;
    for (const shape of def.tool) {
      const part = shape.hull
        ? RAPIER.ColliderDesc.convexHull(new Float32Array(shape.hull))
        : RAPIER.ColliderDesc.cuboid(...shape[0].map((v) => v / 2)).setTranslation(...shape[1]);
      this.world.createCollider(part.setFriction(friction).setCollisionGroups(GROUP_TOOL), m.tool);
    }
    if (def.gate) {
      m.gate = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      for (const [size, offset] of def.gate) {
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
            .setTranslation(...offset)
            .setFriction(friction),
          m.gate,
        );
      }
    }
    this.machines.push(m);
    this.seat(m, true);
    this.updateTip(m, true);
    return m;
  }

  /** Sets a machine on the ground under it: its ride height and, on a terrain site, the pitch and roll that put its
   *  wheels or tracks on the slope (eased, or at once when `instant`), then moves its kinematic chassis there. */
  seat(m, instant = false) {
    const base = this.groundAt(m.x, m.z);
    m.y = RIDE_HEIGHT + base;
    if (this.site.terrain) {
      const t = TRACTION[m.kind],
        s = Math.sin(m.yaw),
        c = Math.cos(m.yaw),
        hl = t.length / 2,
        hw = t.width / 2,
        pitch = Math.atan2(this.groundAt(m.x + s * hl, m.z + c * hl) - this.groundAt(m.x - s * hl, m.z - c * hl), t.length),
        roll = Math.atan2(this.groundAt(m.x + c * hw, m.z - s * hw) - this.groundAt(m.x - c * hw, m.z + s * hw), t.width),
        k = instant ? 1 : 0.3;
      m.pitch += (pitch - m.pitch) * k;
      m.roll += (roll - m.roll) * k;
    }
    const q = chassisQ(m),
      up = m.pitch || m.roll ? rotate(q, { x: 0, y: RIDE_HEIGHT, z: 0 }) : { x: 0, y: RIDE_HEIGHT, z: 0 },
      at = { x: m.x + up.x, y: base + up.y, z: m.z + up.z };
    if (instant) {
      m.body.setTranslation(at, true);
      m.body.setRotation(q, true);
    } else {
      m.body.setNextKinematicTranslation(at);
      m.body.setNextKinematicRotation(q);
    }
  }

  /** How steep the ground is at (x, z): the slope's rise per metre, measured over a metre around the point. */
  steepness(x, z) {
    const e = 0.5,
      gx = (this.groundAt(x + e, z) - this.groundAt(x - e, z)) / (2 * e),
      gz = (this.groundAt(x, z + e) - this.groundAt(x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
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
    const colliders = [];
    const add = (shape, mass) => {
      const collider = shape
        .setMass(mass)
        .setFriction(BLOCK_FRICTION)
        .setRestitution(0.07)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(130);
      const made = this.world.createCollider(collider, b);
      colliders.push(made);
      return made;
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
      colliders,
      home: { ...def },
      born: this.time,
      // placed for good (see lockStep), and the counters that decide it
      locked: false,
      settle: 0,
      near: 0,
      pour: null,
      glide: null,
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

  /** The blocks lying inside the dump truck's bed right now (the bed's own frame: between the walls, past the tailgate
   *  and under the headboard's top). Empty for any other machine. */
  bedCargo(m = this.machine) {
    if (m.kind !== 'dump') return [];
    const a = bedAngle(m.lift),
      inv = conj(toolQ(m, 0, -a)),
      h = toWorld(m, 0, DUMP.hinge.y, DUMP.hinge.z),
      half = DUMP.bed.inner / 2;
    return this.blocks.filter((b) => {
      const t = b.body.translation(),
        l = rotate(inv, { x: t.x - h.x, y: t.y - h.y, z: t.z - h.z });
      return Math.abs(l.x) < half && l.z > 0 && l.z < DUMP.bed.length && l.y > -0.1 && l.y < DUMP.bed.wallH + 1;
    });
  }

  /** How the active forklift stands with the nearest pallet ahead of its forks, in the carriage's frame:
   *  `state` is 'none' (no pallet within reach), 'high' (the tines are above the pallet's openings), 'off' (not lined up
   *  with the openings), 'ready' (low, level and lined up), 'in' (the tines are under the deck) or 'carrying' (the
   *  pallet rides on the tines, clear of the floor). It only reads: the physics decides what actually happens. */
  forkStatus(m = this.machine) {
    if (m.kind !== 'fork') return { state: 'none' };
    const { pos, q } = placeFork(m),
      inv = conj(q);
    let best = null;
    for (const b of this.blocks) {
      if (b.type !== 'pallet') continue;
      const t = b.body.translation(),
        l = rotate(inv, { x: t.x - pos.x, y: t.y - pos.y, z: t.z - pos.z });
      if (l.z < 0.2 || l.z > 4 || Math.abs(l.x) > 2) continue;
      if (!best || l.z < best.l.z) best = { b, l };
    }
    if (!best) return { state: 'none' };
    const { b, l } = best,
      // the pallet's long gap runs along its own z axis; its heading against the forks' is the angle between them
      axis = rotate(conj(q), rotate(b.body.rotation(), { x: 0, y: 0, z: 1 })),
      raw = Math.atan2(axis.x, axis.z),
      heading = Math.abs(raw) > Math.PI / 2 ? raw - Math.sign(raw) * Math.PI : raw,
      lateral = Math.abs(l.x),
      inside = lateral < 0.3 && l.z > 0.45 && l.z < 1.75 && l.y > -0.03 && l.y < 0.4,
      lifted = b.body.translation().y > 0.5 + 0.05 && inside;
    let state;
    if (lifted) state = 'carrying';
    else if (inside) state = 'in';
    else if (m.lift > 0.3) state = 'high';
    else if (lateral > 0.2 || Math.abs(heading) > 0.12 || Math.abs(m.tilt) > 0.1) state = 'off';
    else state = 'ready';
    return { state, pallet: b.id, lateral: l.x, ahead: l.z, heading };
  }

  /** Recomputes a machine's grab point (reach ahead along the boom, at lift height) and moves its tool body there:
   *  instantly when placing or resetting, otherwise as the next kinematic target so contacts stay smooth. The Lab
   *  machines place their tool (the bed, the carriage) and the tailgate from their own joints instead (`place`). */
  updateTip(m, instant = false) {
    const def = MACHINE[m.kind];
    let tip, pos, q, gate;
    if (def.place) ({ tip, pos, q, gate } = def.place(m));
    else if (this.site.terrain) {
      // On a slope the lift is measured from the ground under the machine (the boom and its operator keep the grab
      // point `reach` metres out and level, so a slope never throws the load); the model's arms solve back to it.
      const a = m.yaw + m.swing;
      tip = pos = { x: m.x + Math.sin(a) * m.reach, y: m.y - RIDE_HEIGHT + m.lift, z: m.z + Math.cos(a) * m.reach };
      q = def.orient(a, m);
    } else {
      const a = m.yaw + m.swing;
      tip = pos = { x: m.x + Math.sin(a) * m.reach, y: m.lift, z: m.z + Math.cos(a) * m.reach };
      q = def.orient(a, m);
    }
    m.tip = tip;
    if (instant) {
      m.tool.setTranslation(pos, true);
      m.tool.setRotation(q, true);
      if (gate && m.gate) {
        m.gate.setTranslation(gate.pos, true);
        m.gate.setRotation(gate.q, true);
      }
    } else {
      m.tool.setNextKinematicTranslation(pos);
      m.tool.setNextKinematicRotation(q);
      if (gate && m.gate) {
        m.gate.setNextKinematicTranslation(gate.pos);
        m.gate.setNextKinematicRotation(gate.q);
      }
    }
  }

  /** The block a Grab would pick up now (null when none is in reach, the machine has no Grab, or a block is already
   *  held). A bucket reaches a box around its grab point in its own heading, whatever its tilt, so a block pushed in front
   *  of the lip or lying off to one side is in reach; the excavator's bucket and the crane's magnet use a sphere. Of the
   *  blocks in reach the nearest and best centred wins. A locked (placed) block is never offered: only a bump could have
   *  moved it, and a bump does not pick things up. The scene glows this block and the Grab button lights up for it. */
  grabCandidate() {
    const m = this.machine,
      def = MACHINE[m.kind];
    if (this.held || def.grabs === false || !m.tip) return null;
    const tip = m.tip,
      a = m.yaw + m.swing,
      s = Math.sin(a),
      c = Math.cos(a);
    let best = null,
      bestScore = Infinity;
    for (const b of this.blocks) {
      if (b.locked) continue;
      const p = b.body.translation(),
        dx = p.x - tip.x,
        dy = p.y - tip.y,
        dz = p.z - tip.z;
      let score;
      if (def.bucket) {
        const lx = dx * c - dz * s,
          lz = dx * s + dz * c;
        if (Math.abs(lx) > GRAB_BOX.x || lz < GRAB_BOX.z[0] || lz > GRAB_BOX.z[1] || dy < GRAB_BOX.y[0] || dy > GRAB_BOX.y[1]) continue;
        score = lx * lx * 0.6 + (lz - 0.5) * (lz - 0.5) + dy * dy;
      } else {
        score = dx * dx + dy * dy + dz * dz;
        if (score > GRAB_SPHERE * GRAB_SPHERE) continue;
      }
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  /** Grab toggles: releases a held toy, or picks the block grabCandidate() names. Returns false only when nothing is
   *  close enough, so the HUD can explain why. */
  grab() {
    if (this.held) {
      this.release();
      return true;
    }
    if (MACHINE[this.machine.kind].grabs === false) return false;
    const found = this.grabCandidate();
    if (!found) return false;
    this.held = found;
    this.held.body.wakeUp();
    // a bucket draws the block in through its plates, and gives them back once it sits in the bucket
    if (MACHINE[this.machine.kind].tool.length) this.setGroups(found, GROUP_THROUGH);
    this.held.pour && this.endPour(this.held);
    this.grabs++;
    this.onEvent({ type: 'grab', id: found.id });
    return true;
  }

  /** Lets go of the held toy; a released toy keeps no assistance at all. */
  release() {
    if (this.held) {
      this.setGroups(this.held, GROUP_ALL);
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
      lift: MACHINE[m.kind].home ?? HOME_LIFT,
      tilt: 0,
      speed: 0,
      reach: MACHINE[m.kind].reach[0],
      pitch: 0,
      roll: 0,
      artic: 0,
    });
    this.seat(m, true);
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
      locked: b.locked,
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
    m.lift = clamp(m.lift + (input.lift || 0) * (d.liftRate ?? LIFT_RATE) * dt, ...d.height);
    if (d.stick) moveJoint(m, d, d.stick.joint, (input.tool || 0) * d.stick.rate * dt);
    if (d.swings) m.swing += (input.swing || 0) * dt;
    if (d.tiltRange || !d.place) m.tilt = clamp(m.tilt + (input.tilt || 0) * (d.tiltRate ?? 1) * dt, ...(d.tiltRange || TILT));
    if (d.extend) moveJoint(m, d, d.extend.joint, (input.extend || 0) * d.extend.rate * dt);
    // The loader bends toward the steering and straightens when the stick is let go.
    if (d.artic) m.artic += (clamp(input.steer || 0, -1, 1) * LOADER.artic - m.artic) * LOADER.articEase;
    this.seat(m);
    for (const machine of this.machines) this.updateTip(machine);
    if (this.held) {
      this.carry(this.held.body, m.tip);
      // seated in the bucket: it collides with the plates again
      if (this.held.through) {
        const p = this.held.body.translation();
        if (Math.hypot(p.x - m.tip.x, p.y - m.tip.y, p.z - m.tip.z) < 0.5) this.setGroups(this.held, GROUP_ALL);
      }
    }
    if (this.ball) this.swingBall();
    this.glideLocks();
    this.pourStep();
    this.world.step(this.queue);
    this.queue.drainContactForceEvents((e) => this.contact(e));
    const harbor = this.site.id === 'harbor';
    for (const b of this.blocks) {
      const p = b.body.translation();
      if (p.y < -6 || Math.abs(p.x) > YARD.lost || Math.abs(p.z) > YARD.lost) this.recover(b);
      else if (harbor && p.y < HARBOR.water.level - 0.5 && inWater(p.x, p.z)) {
        // A load that falls in the harbor comes back to its start, with a splash where it went in.
        this.onEvent({ type: 'splash', position: { x: p.x, y: HARBOR.water.level, z: p.z } });
        this.recover(b);
      }
    }
    // Placed blocks: a block that has matched its place and settled locks there (jobs only; the sandbox has no places).
    if (this.round.id && ++this.lockTick >= LOCK_EVERY) {
      this.lockTick = 0;
      this.lockStep(DT * LOCK_EVERY);
    }
    // A job's "keep the blocks off the grass" rule: a block resting on the grass goes back to its start (never a fail).
    if (this.round.rules?.includes('noGrass') && ++this.ruleTick >= 6) {
      this.ruleTick = 0;
      for (const id of grassTouches(this.round, this.poses(), this.held?.id)) {
        const b = this.blocks.find((x) => x.id === id);
        this.returned++;
        this.onEvent({ type: 'rule', rule: 'noGrass', position: { ...b.body.translation() } });
        this.recover(b);
      }
    }
  }

  /** Eases the chassis speed toward the drive axis, turns, and moves it, sliding along props instead of through
   *  them (each axis is checked separately) and staying inside the yard. A machine with a `pivot` turns about that
   *  point on its centre line (the dump truck about its rear axle, the forklift about its front axle, so its tail
   *  swings), and one with `steerLow` turns more slowly when it is not moving. */
  drive(m, d, input, dt) {
    m.speed += (clamp(input.drive || 0, -1, 1) * d.speed - m.speed) * (d.ease ?? 0.12);
    const steer = clamp(input.steer || 0, -1, 1),
      low = d.steerLow ?? 1,
      rate = d.turn * (low + (1 - low) * Math.min(1, Math.abs(m.speed) / (0.5 * d.speed))),
      pv = d.pivot || 0,
      px = m.x + Math.sin(m.yaw) * pv,
      pz = m.z + Math.cos(m.yaw) * pv;
    m.yaw += steer * rate * dt;
    const cx = px - Math.sin(m.yaw) * pv,
      cz = pz - Math.cos(m.yaw) * pv,
      b = this.site.bounds,
      mg = d.margin || 0;
    let step = m.speed * dt;
    // Mud slows wheels (tracks less); a climb slows every machine by how close the slope is to its limit.
    const t = TRACTION[m.kind];
    if (mudAt(this.site, cx, cz)) step *= MUD_FACTOR[t.gear];
    let nx = clamp(cx + Math.sin(m.yaw) * step, b.x[0] + mg, b.x[1] - mg),
      nz = clamp(cz + Math.cos(m.yaw) * step, b.z[0] + mg, b.z[1] - mg);
    if (this.site.terrain && (nx !== cx || nz !== cz)) {
      const limit = Math.tan((t.climb * Math.PI) / 180),
        here = this.groundAt(cx, cz),
        run = Math.hypot(nx - cx, nz - cz),
        grade = (this.groundAt(nx, nz) - here) / Math.max(1e-6, run),
        steep = this.steepness(nx, nz);
      // Too steep to drive onto (up or down) unless the move leads to gentler ground: the machine waits at the foot of a
      // steep bank or at the lip of the ravine, and never slides on a slope it may stand on.
      if (steep > limit && steep >= this.steepness(cx, cz) - 1e-4) {
        nx = cx;
        nz = cz;
        m.stalled = true;
      } else {
        m.stalled = false;
        if (grade > 0) {
          const k = Math.max(0.3, 1 - (CLIMB_LOSS * grade) / limit);
          nx = cx + (nx - cx) * k;
          nz = cz + (nz - cz) * k;
        }
      }
    }
    m.x = this.blocked(nx, cz) ? m.x + (cx - m.x) : nx;
    m.z = this.blocked(m.x, nz) ? m.z + (cz - m.z) : nz;
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

  // ---- Placed blocks ----------------------------------------------------------------------------------------------
  /** How high the surface under block `p` (a pose) is: the ground there, or the top of a locked block it rests on. A
   *  block that is not on something low (the dump truck's bed, a bucket held up in the air) has no support near it. */
  supportUnder(p, self) {
    const half = TOYS[p.type].size,
      r = Math.hypot(half[0], half[2]) / 2,
      bottom = p.position.y - halfHeight(p);
    let top = this.groundAt(p.position.x, p.position.z);
    for (const o of this.blocks) {
      if (!o.locked || o.id === self) continue;
      const q = o.body.translation(),
        d = TOYS[o.type].size,
        ro = Math.hypot(d[0], d[2]) / 2;
      if (Math.hypot(q.x - p.position.x, q.z - p.position.z) > (r + ro) * 0.75) continue;
      const t = q.y + halfHeight({ type: o.type, rotation: o.body.rotation() });
      if (t <= bottom + 0.3 && t > top) top = t;
    }
    return top;
  }

  /** The once-in-a-few-steps check that makes a placed block stay placed. Anything that has matched the job's blueprint
   *  slot (or lies inside the delivery zone), is not held, rests on the ground or on another placed block, and has done so
   *  for LOCK_AFTER seconds is locked: it becomes a kinematic body, so no touch from a machine moves it and it can never
   *  drop out of the count, and it glides to its slot's exact pose. A block that comes to rest just outside the zone, or
   *  near an open outline, is drawn in the same way after a little longer. Fires a 'placed' event for each. */
  lockStep(dt) {
    const round = this.round,
      poses = this.poses(),
      held = this.held?.id ?? null,
      status = evaluate(round, poses, held),
      pose = new Map(poses.map((p) => [p.id, p])),
      taken = new Set(this.blocks.filter((b) => b.locked && b.slot != null).map((b) => b.slot));
    const matched = new Map();
    status.matches.forEach((id, i) => {
      if (id != null) matched.set(id, round.ghosts ? i : -1);
    });
    for (const b of this.blocks) {
      if (b.locked || b.id === held) {
        b.settle = b.near = 0;
        continue;
      }
      const p = pose.get(b.id),
        slot = matched.get(b.id);
      if (slot !== undefined && !(slot >= 0 && taken.has(slot))) {
        const support = this.supportUnder(p, b.id);
        const resting = round.ghosts || p.position.y - halfHeight(p) - support < 0.25,
          calm =
            !b.pour &&
            Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z) < 0.3 &&
            Math.hypot(p.angular.x, p.angular.y, p.angular.z) < 0.5;
        b.settle = resting && calm ? b.settle + dt : 0;
        b.near = 0;
        if (b.settle >= LOCK_AFTER) {
          this.lock(b, p, round.ghosts ? round.ghosts[slot] : null, support);
          if (slot >= 0) taken.add(slot);
        }
        continue;
      }
      b.settle = 0;
      // a block resting just outside the delivery zone, or beside an open outline, is drawn in
      const still =
        Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z) < 0.25 &&
        Math.hypot(p.angular.x, p.angular.y, p.angular.z) < 0.4;
      let aim = null;
      if (still && !b.pour) {
        if (round.ghosts) {
          let near = Infinity;
          round.ghosts.forEach((g, i) => {
            const d = Math.hypot(p.position.x - g.x, p.position.z - g.z);
            if (
              g.type === b.type &&
              !taken.has(i) &&
              !status.matches[i] &&
              d < NEAR_GHOST &&
              Math.abs(p.position.y - g.y) < 0.45 &&
              Math.abs(p.rotation.x) < 0.25 &&
              Math.abs(p.rotation.z) < 0.25 &&
              d < near
            ) {
              near = d;
              aim = { slot: i, g };
            }
          });
        } else if (round.pad) {
          const pad = round.pad,
            t = TOYS[b.type],
            margin = Math.hypot(t.size[0], t.size[2]) / 2,
            dx = p.position.x - pad.x,
            dz = p.position.z - pad.z;
          if (
            Math.abs(dx) < pad.w / 2 + NEAR_EDGE &&
            Math.abs(dz) < pad.d / 2 + NEAR_EDGE &&
            p.position.y - halfHeight(p) - this.supportUnder(p, b.id) < 0.25
          ) {
            const spot = this.freeSpot(b, pad, margin);
            if (spot) aim = { slot: -1, g: spot };
          }
        }
      }
      if (aim) {
        b.near += dt;
        if (b.near >= NEAR_AFTER) {
          this.lock(b, p, aim.g, this.supportUnder(p, b.id));
          if (aim.slot >= 0) taken.add(aim.slot);
        }
      } else b.near = 0;
    }
  }

  /** A place inside the delivery zone for block `b`, as close as possible to where it lies: clear of every other block, or
   *  null when the zone is too full there. */
  freeSpot(b, pad, margin) {
    const p = b.body.translation(),
      ox = pad.w / 2 - margin - 0.12,
      oz = pad.d / 2 - margin - 0.12;
    const clamped = { x: clamp(p.x, pad.x - ox, pad.x + ox), z: clamp(p.z, pad.z - oz, pad.z + oz) };
    const free = (x, z) =>
      this.blocks.every((o) => {
        if (o === b) return true;
        const q = o.body.translation(),
          d = TOYS[o.type].size;
        return Math.hypot(q.x - x, q.z - z) > margin + Math.hypot(d[0], d[2]) / 2 + 0.05 || Math.abs(q.y - p.y) > 1;
      });
    for (const ring of [0, 0.45, 0.9, 1.35, 1.8]) {
      for (let k = 0; k < (ring ? 8 : 1); k++) {
        const a = (k / 8) * Math.PI * 2,
          x = clamp(clamped.x + Math.sin(a) * ring, pad.x - ox, pad.x + ox),
          z = clamp(clamped.z + Math.cos(a) * ring, pad.z - oz, pad.z + oz);
        if (free(x, z)) return { x, z, y: p.y };
      }
    }
    return null;
  }

  /** Locks block `b` (a pose `p`) in place at `slot` (an outline {x, y, z} or a spot {x, z, y}), or where it lies. */
  lock(b, p, slot, support) {
    const type = TOYS[b.type],
      symmetric = b.type === 'cube' || type.round,
      rest = support + halfHeight({ type: b.type, rotation: { x: 0, y: 0, z: 0, w: 1 } }),
      to = slot
        ? { x: slot.x, y: slot.y ?? p.position.y, z: slot.z }
        : { x: p.position.x, y: Math.abs(p.position.y - rest) < 0.3 ? rest : p.position.y, z: p.position.z },
      yaw = Math.atan2(
        2 * (p.rotation.w * p.rotation.y + p.rotation.x * p.rotation.z),
        1 - 2 * (p.rotation.y ** 2 + p.rotation.z ** 2),
      ),
      // a cube or a barrel looks the same turned a quarter, so it squares up for nothing; anything else keeps its heading
      toQ = symmetric || (slot && this.round.ghosts) ? { x: 0, y: 0, z: 0, w: 1 } : qyaw(yaw);
    if (b.pour) this.endPour(b);
    b.locked = true;
    b.slot = slot && this.round.ghosts ? this.round.ghosts.indexOf(slot) : null;
    if (b.slot < 0) b.slot = null;
    b.settle = b.near = 0;
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    b.glide = { i: 0, from: { ...p.position }, fromQ: { ...p.rotation }, to, toQ };
    const count = this.blocks.filter((o) => o.locked).length;
    this.onEvent({ type: 'placed', id: b.id, position: { ...to }, count, slot: b.slot });
  }

  /** Unlocks a block (it was sent back to its start): it is an ordinary dynamic toy again. */
  unlock(b) {
    if (!b.locked) return;
    b.locked = false;
    b.slot = null;
    b.glide = null;
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  }

  /** Moves each gliding block one step along its way to its slot (a smooth ease over SNAP_STEPS steps). */
  glideLocks() {
    for (const b of this.blocks) {
      const g = b.glide;
      if (!g) continue;
      const t = ++g.i / SNAP_STEPS,
        k = t >= 1 ? 1 : t * t * (3 - 2 * t),
        dot = g.fromQ.x * g.toQ.x + g.fromQ.y * g.toQ.y + g.fromQ.z * g.toQ.z + g.fromQ.w * g.toQ.w,
        sign = dot < 0 ? -1 : 1,
        q = {
          x: g.fromQ.x + (g.toQ.x * sign - g.fromQ.x) * k,
          y: g.fromQ.y + (g.toQ.y * sign - g.fromQ.y) * k,
          z: g.fromQ.z + (g.toQ.z * sign - g.fromQ.z) * k,
          w: g.fromQ.w + (g.toQ.w * sign - g.fromQ.w) * k,
        },
        l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
      q.x /= l;
      q.y /= l;
      q.z /= l;
      q.w /= l;
      b.body.setNextKinematicTranslation({
        x: g.from.x + (g.to.x - g.from.x) * k,
        y: g.from.y + (g.to.y - g.from.y) * k,
        z: g.from.z + (g.to.z - g.from.z) * k,
      });
      b.body.setNextKinematicRotation(q);
      if (t >= 1) b.glide = null;
    }
  }

  // ---- Pouring ----------------------------------------------------------------------------------------------------
  /** Sets the collision groups of every collider of block `b`. */
  setGroups(b, groups) {
    for (const c of b.colliders) c.setCollisionGroups(groups);
    b.through = groups === GROUP_THROUGH;
  }

  /** Sets the friction of every collider of block `b`. */
  setFriction(b, f) {
    for (const c of b.colliders) c.setFriction(f);
  }

  /** Ends a block's pour: its own friction, damping and forces come back. */
  endPour(b) {
    if (!b.pour) return;
    b.pour = null;
    this.setFriction(b, BLOCK_FRICTION);
    b.body.setLinearDamping(0.45);
    b.body.resetForces(true);
  }

  /** A block lying in a bucket that is tilted forward past POUR_TILT slides out: while it is in the bucket it has little
   *  friction and a gentle push down the floor, so it leaves forward in a second or so, falls, and lands with a small hop
   *  (a 'thud' event for the sound and the dust). Blocks that are held, locked or just resting elsewhere are never touched. */
  pourStep() {
    for (const m of this.machines) {
      const def = MACHINE[m.kind];
      if (!def.bucket || !m.tool) continue;
      const tilted = m.tilt > POUR_TILT,
        q = m.tool.rotation(),
        at = m.tool.translation(),
        inv = conj(q),
        fwd = rotate(q, { x: 0, y: 0, z: 1 }),
        hl = Math.hypot(fwd.x, fwd.z) || 1,
        bucket = m.kind === 'loader' ? LOADER.bucket : SKID_BUCKET,
        half = bucket.width / 2 + 0.05;
      for (const b of this.blocks) {
        if (b.locked || b === this.held) continue;
        const t = b.body.translation(),
          l = rotate(inv, { x: t.x - at.x, y: t.y - at.y, z: t.z - at.z }),
          inside =
            Math.abs(l.x) < half &&
            l.z > bucket.floor.z[0] - 0.15 &&
            l.z < bucket.floor.z[1] + 0.2 &&
            l.y > -0.8 &&
            l.y < 0.7;
        if (inside && tilted) {
          if (!b.pour) {
            b.pour = { out: false, vy: 0, t: 0 };
            this.setFriction(b, POUR_FRICTION);
            b.body.setLinearDamping(POUR_DAMPING);
            b.body.wakeUp();
          }
          b.pour.out = false;
          b.body.resetForces(false);
          // the push is along the heading, level: a bucket low to the ground has no slope under the block to slide it
          const f = (b.body.mass() * POUR_PUSH) / hl;
          // and most of its weight is taken off, so it never stays pressed between the tilted floor and the ground ahead
          b.body.addForce({ x: fwd.x * f, y: b.body.mass() * 9.81 * POUR_LIGHTEN, z: fwd.z * f }, true);
        } else if (b.pour && !b.pour.out) {
          // out of the bucket (it left the lip), or the bucket came back up before the block went
          if (!inside && tilted) {
            b.pour.out = true;
            b.body.resetForces(true);
            b.body.setLinearDamping(0.45);
            // a block that slides off a bucket lying on the ground lands as it leaves: a small hop and a thud
            const t = b.body.translation(),
              v = b.body.linvel();
            if (t.y - this.groundAt(t.x, t.z) - halfHeight({ type: b.type, rotation: b.body.rotation() }) < 0.35) {
              b.body.setLinvel({ x: v.x, y: Math.max(v.y, 1.3), z: v.z }, true);
              b.pour.landed = true;
              this.onEvent({ type: 'thud', id: b.id, position: { x: t.x, y: t.y - 0.5, z: t.z }, speed: 2 });
            }
          } else this.endPour(b);
        }
      }
    }
    // a poured block in the air: friction stays low until it lands, then it hops a little and settles
    for (const b of this.blocks) {
      const pr = b.pour;
      if (!pr || !pr.out) continue;
      pr.t += DT;
      const v = b.body.linvel(),
        p = b.body.translation(),
        low = p.y - this.groundAt(p.x, p.z) - halfHeight({ type: b.type, rotation: b.body.rotation() }) < 0.08;
      if (low && pr.vy < -0.7 && !pr.landed) {
        b.body.setLinvel({ x: v.x * 0.6, y: Math.min(1.9, -pr.vy * 0.4), z: v.z * 0.6 }, true);
        this.onEvent({ type: 'thud', id: b.id, position: { x: p.x, y: p.y - 0.5, z: p.z }, speed: -pr.vy });
        this.endPour(b);
        continue;
      }
      pr.vy = v.y;
      if (pr.t > 3 || (low && Math.hypot(v.x, v.z) < 0.2)) this.endPour(b);
    }
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
    this.unlock(b);
    this.endPour(b);
    b.body.setTranslation({ x: b.home.x, y: b.home.y || 2, z: b.home.z }, true);
    b.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.born = this.time;
  }

  /** The ground height at (x, z): 0, or the shape of the terrain stamp covering that point. */
  groundAt(x, z) {
    if (this.site.floor !== 'tiles') return this.site.height(x, z);
    const s = this.stamps.find((s) => Math.abs(s.x - x) < 2 && Math.abs(s.z - z) < 2);
    if (!s) return 0;
    return Object.hasOwn(STAMP_HEIGHT, s.kind) ? STAMP_HEIGHT[s.kind](x - s.x, z - s.z) : 0;
  }

  /** Places a terrain stamp on the tile nearest (x, z). Pits and water lower the tile; a hill adds a low mound and a
   *  ramp a wedge. Returns false when the yard already has 12 stamps or the tile is taken. */
  stamp(kind, x, z) {
    // Terrain stamps belong to the yard's tiled floor (the sandbox); the other sites have ground of their own.
    if (this.stamps.length >= 12 || this.site.floor !== 'tiles') return false;
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
