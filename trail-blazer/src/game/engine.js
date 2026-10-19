// Trail Blazer gameplay engine (SPEC §3 + v1.1 race mode). Matter.js (global `Matter`), 1 m = 30 px, fixed 60 Hz
// step (2 substeps), y-down in physics space; game logic and drawing in meters, +y UP.
//
// Two modes:
//   race (start({ race: {...} }), v1.1): a motocross race on a jump track (course.js createMxCourse) against 3 AI
//     Rangers (Max, Zoe, Kai) driven by the same physics with a scripted throttle / landing policy. 3-2-1 gate drop,
//     air lean (BRAKE = lean back, GAS = lean forward; a button held through the takeoff only leans after it is
//     released and pressed again), flips scored on landing, PERFECT landings, BIG AIR, CRASH → tumble → respawn at
//     the last checkpoint. No stuck state, no winch.
//   trail (no `race`, v1): the hill-climb ride with gates, stuck detection and the winch (unchanged behaviour).
//
// The drive model is arcade: the wheels are frictionless rollers and the engine applies every tangential force
// (drive from stats.power along the ground, capped by traction = mu x grip x trail.grip x surface x g cos; brake /
// reverse; rolling, mud, sand and water drag). Gravity, the spring suspension, landings and tumbles are Matter's.
//
// Contract (SPEC §3): createGame(canvas, { onEvent, simSpeed?, reducedMotion? }) → { start, setInput, openGate,
// winch, pause, resume, stop, destroy, getState }.
//   start({ trail, stats, seed?, paint?, decal?, bestDistance?, gates?, shake?, helmet?, race? })
//     race: { riders: 3 (0..3), skill?: 0..1 (AI level / 10; default: halfway between the player's upgrade level and
//     the track's design level), countdown?: true, names?, paints?, name? (the player's tag) } or true.
//   setInput({ gas, brake, boost }) (`nitro` = boost).  openGate(result) → bool.  winch(ok) → bool (trail mode).
//   stop() ends the ride (emits finish once) and freezes it on screen; destroy() releases everything.
// Race events (v1.1 §6): countdown { n }, go, bogged (GAS before the drop), checkpoint { index }, crash, respawn
//   { checkpoint, x }, flip { kind: 'back'|'front', count, cash }, bigAir { airTime }, position { place },
//   lap { timeSec } (the player crosses the finish), plus the v1 events (launch, air, land, smash, coin, boost,
//   splash, finishLine, finish).
// getState() adds place, timeSec, riders [{ name, paint, x, place, finished, timeSec, me }], crashed, countdown
//   (seconds to the drop), coins, winches, progress, x.
// Summary adds place, timeSec, medal, crashes, riders, race; cash adds flips, perfect, place, finish (all parts add up
//   to total). Trail-mode additions (v1): events unstuck / record, summary endReason / landings / gatesTotal / length.
// Debug (not contract): debugStep(n), debugInfo(), debugPerf(reset), debugCourse(), debugTeleport(x, vx, tilt),
//   debugRiders().

import { createCourse, CHUNK, START_X, SURF_IDS, RACE, levelStats, raceTop } from './course.js';
import { VEHICLE, resolveLook, drawVehicle, drawRider, drawHelmet } from './vehicle.js';
import * as R from './render.js';
import { OBSTACLE_KINDS, SURFACES, medalFor } from '../data/trails.js';
import { TAU, clamp, wrapPi, smoothstep, shade, mulberry32, hash2 } from './util.js';

const S = 30; // px per meter (physics space)
const STEP = 1 / 60;
const STEP_MS = 1000 / 60;
const SUBSTEPS = 2;
const MAX_STEPS_PER_FRAME = 4;
const U = S / 60; // m/s -> Matter velocity units (px per 16.67 ms)
const G = 9.81;
const CAT_TERRAIN = 0x1, CAT_CAR = 0x2, CAT_PROP = 0x4, CAT_GATE = 0x8;
const MAX_PARTICLES = 340;
const P_DUST = 0, P_MUD = 1, P_SNOW = 2, P_SPLASH = 3, P_CHUNK = 4, P_CONFETTI = 5, P_SPARK = 6, P_RING = 7;

// v1 trail-mode tuning (unchanged)
export const TUNING = {
  driveA: 3.9, vTop: 12.5, vTopExp: 0.6, mu: 0.75,
  brakeA: 9, reverseA: 2.6, reverseV: 4,
  rollBase: 0.3, airDrag: 0.0035,
  stallDamp: 6, wheelie: 0.1,
  boostA: 8, boostSec: 1.6, boostVMul: 1.75,
  airTilt: 3.4, airTiltMax: 2.6,
  landK: 30, landD: 8, landLook: 0.65, // landing assist: PD gains, look-ahead (s) at suspension 1 (+0.45 s at 2.4)
  impactThr: 7.5,
  stuckSpeed: 0.6, stuckTime: 2.5, upsideTime: 1.5, noProgressTime: 7,
  gateZone: 32, gateArriveV: 3.5, gateTakeover: 3, gateStop: 1.25, gateBurst: 5,
  winchDist: 6, winchDur: 1.15, winchHop: 1.1, winchPush: 2.2,
  cash: { perM: 2, airPerS: 30, gate: 120, quick: 80, fixed: 40, coin: 10, finish: 300 },
  fuel: { correct: 0.4, quick: 0.6, fixed: 0.15, coin: 0.08, perfect: 0.25, good: 0.12, landMinAir: 1.0 },
  minFlight: 0.3,
};
// v1.1 race tuning (drive: course.js RACE, so the track generator's design rider matches)
export const RACE_TUNING = {
  boostA: 9, boostSec: 1.8, boostVMul: 1.3,
  airLean: 10, airLeanMax: 6.5, // lean: rad/s^2, max spin rad/s
  assistLook: 0.8, assistK: 16, assistD: 5, assistMax: 10, assistMaxPer: 8, // auto-level before touchdown (no lean held)
  crashAngle: 58, roofAngle: 42, perfectAngle: 13, goodAngle: 30, impactThr: 9, // landing (deg, m/s x suspension)
  flipGrace: 0.9, // rad short of a full turn that still counts when landed wheels-down
  flipCash: 150, perfectCash: 50, comboStep: 0.5, comboMax: 3,
  flipFuel: 0.2, perfectFuel: 0.25, coinFuel: 0.08, bigAir: 1.5,
  crashTime: 1.5, respawnPush: 0.62, invuln: 1.5,
  placeCash: [500, 300, 150, 0],
  goAt: 3.6, // s after start(): countdown 3 / 2 / 1 one second apart, then the gate drops
  bogWindow: 0.8, bogTime: 1.0, bogMul: 0.25,
  slowmo: 0.35, slowmoDur: 0.5,
  names: ['Max', 'Zoe', 'Kai'], paints: ['lakeblue', 'sunset', 'purple'], helmets: ['#ffd23f', '#7dff6b', '#4dd2ff'],
  pace: [1, 0.965, 0.93],
};
const T = TUNING, TR = RACE_TUNING;
const SURF_LIST = SURF_IDS.map((id) => SURFACES[id]);
const LANE_BIG = 0.62, LANE_SUB = 0.72;
const CONFETTI = ['#ff4d6d', '#ffd23f', '#4dd2ff', '#7dff6b', '#c77dff', '#ffffff', '#ff9b2e'];
const NO_INPUT = { gas: false, brake: false, boost: false };
const AI_INPUT = { gas: true, brake: false, boost: false };
const ORD = ['1ST', '2ND', '3RD', '4TH'];

function polyCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}
const HULL_C = polyCentroid(VEHICLE.hull);

function statsArg(s = {}) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return { power: n(s.power, 1), grip: n(s.grip, 1), suspension: n(s.suspension, 1), boostPower: n(s.boostPower, 1),
    boostCapacity: n(s.boostCapacity, 1), coinMult: n(s.coinMult, 1) };
}
// the upgrade level (0..10) a stat block corresponds to (average over the four upgrades)
function statsLevel(st) {
  const l = [(st.power - 1) / 0.12, (st.grip - 1) / 0.06, (st.suspension - 1) / 0.14, (st.boostPower - 1) / 0.15];
  return clamp(l.reduce((a, b) => a + b, 0) / l.length, 0, 10);
}

export function createGame(canvas, opts = {}) {
  const M = globalThis.Matter;
  if (!M) throw new Error('Trail Blazer engine: global Matter (spell-jump/vendor/matter.min.js) is not loaded');
  const { Engine, Bodies, Body, Composite, Constraint, Events, Vertices } = M;
  const emitTo = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const reducedMotion = !!opts.reducedMotion;
  const simSpeed = Math.max(0.1, Number(opts.simSpeed) || 1);
  let shakeMul = 1;

  const ctx = canvas.getContext('2d');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  const view = { W: 1, H: 1, dpr: 1 };
  const cam = { x: 0, y: 0, z: 22, sx: 0, sy: 0 };

  let run = null;
  let input = { gas: false, brake: false, boost: false };
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const perf = { frames: 0, sim: 0, draw: 0, max: 0, ticks: 0, maxTick: 0, maxDraw: 0 };

  function emit(evt) {
    try { emitTo(evt); } catch (e) { console.error('[engine] onEvent handler threw', e); }
  }

  // ---------- sizing ----------
  function resize() {
    const el = canvas.parentElement || canvas;
    const rect = el.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
    const H = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    view.W = W; view.H = H; view.dpr = dpr;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(canvas.parentElement || canvas);
  resize();

  // ---------- body helpers (per vehicle v) ----------
  function addV(b, dx, dy) {
    const vel = b.velocity;
    Body.setVelocity(b, { x: vel.x + dx * U, y: vel.y - dy * U });
  }
  function addVelAll(v, dx, dy) { for (let i = 0; i < v.parts.length; i++) addV(v.parts[i], dx, dy); }
  function measure(v) {
    let m = 0, x = 0, y = 0, vx = 0, vy = 0;
    for (let i = 0; i < v.parts.length; i++) {
      const b = v.parts[i];
      m += b.mass;
      x += b.position.x * b.mass; y += b.position.y * b.mass;
      vx += b.velocity.x * b.mass; vy += b.velocity.y * b.mass;
    }
    v.com.x = x / m / S; v.com.y = -y / m / S;
    v.com.vx = vx / m / U; v.com.vy = -vy / m / U;
    v.speed = Math.hypot(v.com.vx, v.com.vy);
    v.ang = -v.chassis.angle;
    v.omega = -v.chassis.angularVelocity * 60;
    v.fx = Math.cos(v.ang); v.fy = Math.sin(v.ang);
    v.vf = v.com.vx * v.fx + v.com.vy * v.fy;
  }
  function setOmegaAll(v, w) {
    const dw = w - v.omega;
    if (!dw) return;
    for (let i = 0; i < v.parts.length; i++) {
      const b = v.parts[i];
      const rx = b.position.x / S - v.com.x, ry = -b.position.y / S - v.com.y;
      addV(b, -dw * ry, dw * rx);
      Body.setAngularVelocity(b, b.angularVelocity - dw / 60);
    }
    v.omega = w;
  }
  function localToWorld(v, lx, ly, out) {
    const ch = v.chassis;
    const dx = lx - HULL_C[0], dy = ly - HULL_C[1];
    const c = Math.cos(v.ang), s = Math.sin(v.ang);
    out[0] = ch.position.x / S + c * dx - s * dy;
    out[1] = -ch.position.y / S + s * dx + c * dy;
    return out;
  }
  const tmp2 = [0, 0];
  function bumpStops(v) {
    const ch = v.chassis;
    const c = Math.cos(ch.angle), s = Math.sin(ch.angle);
    const cv = ch.velocity, cw = ch.angularVelocity;
    for (let i = 0; i < 2; i++) {
      const w = v.wheels[i], rest = v.wheelRest[i];
      const dx = w.position.x - ch.position.x, dy = w.position.y - ch.position.y;
      const lx = c * dx + s * dy, ly = -s * dx + c * dy;
      const ox = lx - rest.x, oy = ly - rest.y;
      const cx = clamp(ox, -0.16 * S, 0.16 * S), cy = clamp(oy, -0.24 * S, 0.16 * S);
      if (cx === ox && cy === oy) continue;
      const nlx = rest.x + cx, nly = rest.y + cy;
      const wx = c * nlx - s * nly, wy = s * nlx + c * nly;
      Body.setPosition(w, { x: ch.position.x + wx, y: ch.position.y + wy });
      Body.setVelocity(w, { x: cv.x - cw * wy, y: cv.y + cw * wx });
    }
  }

  // ---------- course bodies ----------
  function segBody(xa, ya, xb, yb, thick) {
    const dx = xb - xa, dy = yb - ya;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const mx = (xa + xb) / 2 - (nx * thick) / 2, my = (ya + yb) / 2 - (ny * thick) / 2;
    const b = Bodies.rectangle(mx * S, -my * S, (len + 0.04) * S, thick * S, {
      isStatic: true, angle: -ang, friction: 0.6, frictionStatic: 0.6, restitution: 0,
      collisionFilter: { category: CAT_TERRAIN, mask: CAT_CAR }, label: 'terrain',
    });
    b.plugin.tb = { t: 'terrain', nx, ny };
    return b;
  }
  function makeProp(r, p) {
    const def = OBSTACLE_KINDS[p.kind];
    const c = r.course;
    const ang = Math.atan(c.groundSlope(p.x));
    const gy = c.groundY(p.x);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const h = Math.max(0.3, def.h);
    const b = Bodies.rectangle((p.x + nx * h * 0.5) * S, -(gy + ny * h * 0.5) * S, def.w * S, h * S, {
      isStatic: true, isSensor: true, angle: -ang, collisionFilter: { category: CAT_PROP, mask: CAT_CAR }, label: 'prop',
    });
    const rec = { id: p.id, kind: p.kind, def, x: p.x, y: gy, ang, body: b, smashed: false };
    b.plugin.tb = { t: 'prop', prop: rec };
    return rec;
  }
  function buildChunk(r, ci) {
    const bodies = [];
    const g = r.course.groundY;
    const x0 = ci * CHUNK;
    const xs = r.course.terrainXs(x0, x0 + CHUNK);
    for (let i = 0; i < xs.length - 1; i++) bodies.push(segBody(xs[i], g(xs[i]), xs[i + 1], g(xs[i + 1]), 4));
    const props = [];
    for (const p of r.course.propsInChunk(ci)) {
      if (r.smashedIds.has(p.id)) continue;
      const rec = makeProp(r, p);
      props.push(rec);
      bodies.push(rec.body);
    }
    Composite.add(r.world, bodies);
    r.chunks.set(ci, { bodies, props });
    for (const p of props) r.props.push(p);
  }
  // terrain chunks around every rider (riders can be far apart in a race)
  function manageChunks(r) {
    const need = r.chunkNeed;
    need.clear();
    for (const v of r.riders) {
      const lo = Math.floor((v.com.x - 60) / CHUNK), hi = Math.floor((v.com.x + 130) / CHUNK);
      for (let ci = lo; ci <= hi; ci++) need.add(ci);
    }
    for (const ci of need) if (!r.chunks.has(ci)) buildChunk(r, ci);
    let removed = false;
    for (const [ci, ch] of r.chunks) {
      if (need.has(ci) || need.has(ci - 1) || need.has(ci + 1)) continue;
      Composite.remove(r.world, ch.bodies.filter((b) => !b.plugin.tb.removed));
      r.chunks.delete(ci);
      removed = true;
    }
    if (removed) {
      const live = new Set();
      for (const ch of r.chunks.values()) for (const p of ch.props) live.add(p);
      r.props = r.props.filter((p) => live.has(p));
    }
  }

  // ---------- vehicles ----------
  function makeRider(r, i, cfg) {
    return {
      i, me: !!cfg.me, name: cfg.name, paint: cfg.paint, look: resolveLook({ paint: cfg.paint, decal: cfg.decal || 'none', helmet: cfg.helmet }),
      stats: cfg.stats, vTop: 0, chassis: null, wheels: null, parts: null, cons: null, wheelRest: null,
      contacts: [false, false, false], wheelAgo: [9, 9, 9], nrm: null, gateTouch: false,
      com: { x: 0, y: 0, vx: 0, vy: 0 }, speed: 0, ang: 0, omega: 0, fx: 1, fy: 0, vf: 0, rideH: 1,
      air: false, noContactT: 0, airTime: 0, flightRot: 0, flipMark: 0, prevAngle: 0, spin: 0, surf: 0, inWater: false,
      tank: Math.max(0.3, (r.race ? TR.boostSec : T.boostSec) * cfg.stats.boostCapacity), fuel: 0, boostOn: false, burstT: 0,
      wheelSpin: [0, 0], wheelLocal: [{ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }],
      pose: [{ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }], hold: true,
      imp: { t: 0, x: 0, ok: false }, pre: { vx: 0, vy: 0 }, vtBefore: 0,
      maxX: 0, // race
      leanBlockGas: false, leanBlockBrake: false, leaned: false, aiErr: 0, ai: null,
      crashed: false, crashT: 0, crashes: 0, invulnT: 0, driver: null, helmetObj: null, upT: 0, slowT: 0,
      cpIndex: 0, finished: false, finishTime: 0, finishOrder: 0, place: i + 1, startDelay: 0, bogT: 0, stopped: false, releaseT: 0,
    };
  }
  function buildVehicle(r, v, ox) {
    const st = v.stats, V = VEHICLE;
    const oy = r.course.groundY(ox) + 0.04;
    const cx = ox + HULL_C[0], cy = oy + HULL_C[1];
    const verts = Vertices.clockwiseSort(V.hull.map(([x, y]) => ({ x: (ox + x) * S, y: -(oy + y) * S })));
    const group = Body.nextGroup(true);
    const mask = CAT_TERRAIN | (v.me ? CAT_PROP | CAT_GATE : 0); // riders never touch each other
    const filter = () => ({ group, category: CAT_CAR, mask });
    const chassis = Body.create({
      position: { x: cx * S, y: -cy * S }, vertices: verts,
      friction: 0.5, frictionStatic: 0.6, frictionAir: 0, restitution: 0.05, collisionFilter: filter(), label: 'chassis',
    });
    chassis.plugin.tb = { t: 'car', i: 0, v };
    Body.setMass(chassis, 9);
    const wheels = [], cons = [];
    V.wheels.forEach((w, k) => {
      const wb = Bodies.circle((ox + w.x) * S, -(oy + w.y) * S, w.r * S, {
        friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, collisionFilter: filter(), label: 'wheel',
      }, 22);
      wb.plugin.tb = { t: 'car', i: k + 1, v };
      Body.setMass(wb, 2.6);
      wheels.push(wb);
      const stiff = clamp(0.32 + 0.06 * (st.suspension - 1), 0.3, 0.45);
      for (const ax of [-0.38, 0.38]) {
        const px = w.x + ax, py = w.y + 0.5;
        cons.push(Constraint.create({
          bodyA: chassis, pointA: { x: (px - HULL_C[0]) * S, y: -(py - HULL_C[1]) * S },
          bodyB: wb, pointB: { x: 0, y: 0 }, stiffness: stiff, damping: 0.14, label: 'susp',
        }));
      }
    });
    v.chassis = chassis;
    v.wheels = wheels;
    v.wheelRest = V.wheels.map((w) => ({ x: (w.x - HULL_C[0]) * S, y: -(w.y - HULL_C[1]) * S }));
    v.cons = cons;
    v.parts = [chassis, ...wheels];
    Composite.add(r.world, [chassis, ...wheels, ...cons]);
  }
  function capturePose(v) {
    for (let i = 0; i < v.parts.length; i++) {
      const b = v.parts[i], P = v.pose[i];
      P.x = b.position.x; P.y = b.position.y; P.a = b.angle;
    }
  }
  function holdPose(v) {
    for (let i = 0; i < v.parts.length; i++) {
      const b = v.parts[i], P = v.pose[i];
      Body.setPosition(b, { x: P.x, y: P.y });
      Body.setAngle(b, P.a);
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
    }
  }
  // place the whole vehicle: origin (ground point under the centre) at (x, y), rotated by ang (world, CCW)
  function placeVehicle(v, x, y, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const px = x + c * HULL_C[0] - s * HULL_C[1], py = y + s * HULL_C[0] + c * HULL_C[1];
    Body.setPosition(v.chassis, { x: px * S, y: -py * S });
    Body.setAngle(v.chassis, -ang);
    for (let i = 0; i < 2; i++) {
      const w = VEHICLE.wheels[i];
      const wx = x + c * w.x - s * w.y, wy = y + s * w.x + c * w.y;
      Body.setPosition(v.wheels[i], { x: wx * S, y: -wy * S });
      Body.setAngle(v.wheels[i], 0);
    }
    for (const b of v.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
  }

  // ---------- run lifecycle ----------
  function start(cfg = {}) {
    const trail = cfg.trail;
    if (!trail || !trail.length) throw new Error('game.start needs { trail, stats, seed }');
    teardown();
    const seed = cfg.seed != null && cfg.seed !== '' ? (Number(cfg.seed) | 0) >>> 0 : (trail.seed | 0) >>> 0;
    const stats = statsArg(cfg.stats);
    const raceCfg = cfg.race === true ? {} : cfg.race && typeof cfg.race === 'object' ? cfg.race : null;
    const race = !!raceCfg && !!trail.mx;
    // v1.2: a race has math gates (default 4; gates: 0 = none); the AI riders pass through them
    const course = createCourse(trail, seed, { gates: race ? (cfg.gates == null || cfg.gates === '' ? 4 : cfg.gates) : cfg.gates, race });
    const bd = R.createBackdrop(trail, seed);
    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: (G * S) / 1e6 },
      positionIterations: 8, velocityIterations: 8, constraintIterations: 4, enableSleeping: false,
    });
    const r = {
      trail, stats, seed, course, bd, engine, world: engine.world, race,
      trailGrip: trail.grip || 1,
      phase: 'parked', t: 0, realT: 0, rideT: 0, timeScale: 1, slowT: 0, zoomPunch: 1,
      riders: [], me: null, chunkNeed: new Set(),
      maxX: 0, distance: 0, maxKmh: 0,
      totalAir: 0, flights: 0, flips: 0, smashed: 0, smashRaw: 0, coins: 0, landings: { perfect: 0, good: 0, hard: 0, crash: 0 },
      flipRaw: 0, perfectRaw: 0, combo: 0, crashes: 0,
      boostUsed: 0,
      gates: course.gates.map((g) => ({ ...g, open: 0, openT: -1, body: null, done: false, result: null })),
      gateIndex: 0, gateMode: null, gateAnswered: 0, gateCorrect: 0, gateQuick: 0, gateFixed: 0, gatesRaw: 0, quickRaw: 0,
      stallT: 0, upsideT: 0, progT: 0, progMark: 0, stuck: false, upsideDown: false, stuckX: 0, winches: 0, winchAnim: null, winchShow: null,
      finishCrossed: false, finishT: 0, endReason: null, summary: null, launched: false,
      best: Number(cfg.bestDistance) > 0 ? Number(cfg.bestDistance) : 0, recordHit: false,
      chunks: new Map(), props: [], smashedIds: new Set(), pendingRemove: [], slowFactor: 1,
      coinLo: 0, coinHit: new Uint8Array(course.coins.length), coinPopT: -9,
      particles: [], np: 0, popups: [], shake: 0, flash: 0, splashT: -9,
      speedLines: Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), len: 0.5 + Math.random(), w: 1 + Math.random() * 2 })),
      dustCol: bd.dust,
      // race
      cdT: 0, cdStep: 0, goT: -1, bogged: false, gateDrop: 0, finishCount: 0, place: 1, placeEmitted: 0, timeSec: 0,
      aiRand: mulberry32(hash2(seed, 0xa1)), aiLevel: 0, countdownOn: !raceCfg || raceCfg.countdown !== false,
    };
    for (let i = 0; i < MAX_PARTICLES; i++) r.particles.push({ type: 0, x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#fff', life: 0, max: 1, alpha: 1, a: 0, extra: 0 });
    const me = makeRider(r, 0, { me: true, name: (raceCfg && raceCfg.name) || 'You', paint: cfg.paint || 'sage', decal: cfg.decal, helmet: cfg.helmet, stats });
    r.me = me;
    r.riders.push(me);
    if (race) {
      const n = clamp(raceCfg.riders == null ? 3 : Number(raceCfg.riders) | 0, 0, 3);
      const mx = trail.mx;
      // the AI's upgrade level: halfway between yours and the track's design level, plus a per-track edge (max 9)
      const lvl = raceCfg.skill != null && Number.isFinite(Number(raceCfg.skill)) ? clamp(Number(raceCfg.skill), 0, 1) * 10 : clamp((statsLevel(stats) + (mx.design || 0)) / 2 + (mx.aiBias || 0), 0, 9);
      r.aiLevel = lvl;
      for (let k = 0; k < n; k++) {
        const st = levelStats(lvl);
        st.power *= TR.pace[k] * (mx.aiPace || 1);
        const ai = makeRider(r, k + 1, { name: (raceCfg.names && raceCfg.names[k]) || TR.names[k], paint: (raceCfg.paints && raceCfg.paints[k]) || TR.paints[k], helmet: TR.helmets[k], stats: st });
        ai.ai = { skill: clamp(lvl / 10, 0, 1), boostT: 0 };
        ai.startDelay = 0.06 + r.aiRand() * 0.22;
        r.riders.push(ai);
      }
    }
    for (const v of r.riders) { v.vTop = race ? raceTop(v.stats) : T.vTop * Math.pow(v.stats.power, T.vTopExp); v.fuel = v.tank; }
    run = r;
    for (const v of r.riders) buildVehicle(r, v, START_X - (v.ai ? 2.6 * v.i : 0)); // the AI line up in a row behind
    for (const v of r.riders) measure(v);
    manageChunks(r);
    for (const g of r.gates) {
      g.body = Bodies.rectangle(g.x * S, -(g.y + 1.6) * S, 0.3 * S, 3.2 * S, {
        isStatic: true, friction: 0, frictionStatic: 0, collisionFilter: { category: CAT_GATE, mask: CAT_CAR }, label: 'gate',
      });
      g.body.plugin.tb = { t: 'gate', gate: g };
      Composite.add(r.world, g.body);
    }
    // settle the suspensions, then hold the pose until the start
    for (let i = 0; i < 90 * SUBSTEPS; i++) {
      Engine.update(engine, STEP_MS / SUBSTEPS);
      for (const v of r.riders) for (const b of v.parts) Body.setVelocity(b, { x: 0, y: b.velocity.y });
    }
    for (const v of r.riders) {
      for (const b of v.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
      measure(v);
      v.rideH = v.com.y - course.groundY(v.com.x);
      capturePose(v);
      v.hold = true;
      v.prevAngle = v.chassis.angle;
      v.maxX = v.com.x;
    }
    r.maxX = Math.max(0, me.com.x);
    r.progMark = r.maxX;
    shakeMul = cfg.shake == null ? 1 : clamp(Number(cfg.shake) || 0, 0, 1);
    Events.on(engine, 'collisionStart', (e) => onPairs(r, e.pairs, true));
    Events.on(engine, 'collisionActive', (e) => onPairs(r, e.pairs, false));
    input = { gas: false, brake: false, boost: false };
    paused = false;
    acc = 0;
    updateCamera(r, 1, true);
  }

  function teardown() {
    const r = run;
    if (!r) return;
    Events.off(r.engine);
    Composite.clear(r.world, false, true);
    Engine.clear(r.engine);
    run = null;
  }

  // ---------- collisions ----------
  function onPairs(r, pairs, isStart) {
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const A = pair.bodyA.plugin && pair.bodyA.plugin.tb, B = pair.bodyB.plugin && pair.bodyB.plugin.tb;
      if (!A || !B) continue;
      let car, other;
      if (A.t === 'car') { car = A; other = B; } else if (B.t === 'car') { car = B; other = A; } else continue;
      const v = car.v;
      if (other.t === 'prop') {
        if (isStart && v.me && !other.prop.smashed && r.phase !== 'done') smash(r, other.prop);
        continue;
      }
      if (other.t === 'gate') { r.gateTouch = true; v.contacts[car.i] = true; continue; }
      v.contacts[car.i] = true;
      if (other.t === 'terrain' && (!v.nrm || car.i > 0)) v.nrm = other;
    }
  }

  function smash(r, pr) {
    pr.smashed = true;
    r.smashedIds.add(pr.id);
    pr.body.plugin.tb.removed = true;
    r.pendingRemove.push(pr.body);
    const def = pr.def;
    const cash = Math.round(def.cash * r.stats.coinMult);
    r.smashRaw += def.cash;
    r.smashed++;
    emit({ type: 'smash', kind: pr.kind, cash });
    popup(r, '+$' + cash, pr.x, pr.y + def.h + 1.0, '#ffe14a', 0.62, true);
    if (def.mass > 0) r.slowFactor *= 1 - clamp(def.mass * (r.race ? 0.08 : 0.18), 0.005, 0.1);
    r.shake = Math.max(r.shake, 2 + def.mass * 8);
    const cx = pr.x, cy = pr.y + def.h * 0.5, me = r.me;
    if (def.flat) {
      for (let k = 0; k < 14; k++) particle(r, P_SPLASH, cx + (Math.random() - 0.5) * def.w, cy, me.com.vx * 0.3 + (Math.random() - 0.5) * 3, 2 + Math.random() * 4, 0.1 + Math.random() * 0.08, '#cfeaff', 0.6 + Math.random() * 0.3, 0.9);
      return;
    }
    const n = pr.kind === 'tumbleweed' ? 5 : pr.kind === 'snowman' ? 9 : 7;
    for (let k = 0; k < n; k++) {
      particle(r, P_CHUNK, cx + (Math.random() - 0.5) * def.w, cy + (Math.random() - 0.5) * def.h, me.com.vx * (0.4 + Math.random() * 0.5) + (Math.random() - 0.3) * 3,
        2 + Math.random() * 5, 0.1 + Math.random() * Math.min(0.22, def.w * 0.18), k % 3 === 2 ? shade(def.color, -0.25) : def.color, 1.2 + Math.random() * 0.6, 1);
    }
    for (let k = 0; k < 5; k++) particle(r, P_DUST, cx + (Math.random() - 0.5) * def.w, cy, (Math.random() - 0.5) * 2, Math.random() * 1.5, 0.3 + Math.random() * 0.3, r.dustCol, 0.6 + Math.random() * 0.4, 0.7);
  }

  // ---------- fx ----------
  function particle(r, type, x, y, vx, vy, size, color, life, alpha, extra = 0) {
    let p;
    if (r.np < MAX_PARTICLES) p = r.particles[r.np++];
    else p = r.particles[(Math.random() * MAX_PARTICLES) | 0];
    p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.size = size; p.color = color;
    p.life = life; p.max = life; p.alpha = alpha; p.a = Math.random() * TAU; p.extra = extra;
    return p;
  }
  function popup(r, text, x, y, color, scale = 1, world = false, life = 1.3, slot = null) {
    if (slot) for (let i = r.popups.length - 1; i >= 0; i--) if (r.popups[i].slot === slot) r.popups.splice(i, 1);
    if (world && !slot) for (const p of r.popups) if (p.world && p.t < 0.45 && Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 1.2) y = p.y + 1.2;
    r.popups.push({ text, x, y, color, scale, world, t: 0, life, slot });
    if (r.popups.length > 10) r.popups.shift();
  }
  function confetti(r, x, y, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (0.15 + Math.random() * 0.7), sp = 6 + Math.random() * 9;
      particle(r, P_CONFETTI, x + (Math.random() - 0.5) * 4, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.18 + Math.random() * 0.12, CONFETTI[k % CONFETTI.length], 2.2 + Math.random() * 1.4, 1);
    }
  }
  function slowmo(r) {
    if (reducedMotion) return;
    r.timeScale = TR.slowmo;
    r.slowT = TR.slowmoDur;
    r.zoomPunch = 1.25;
  }

  // ---------- simulation ----------
  function tick() {
    const r = run;
    // v1.2 math gate: the whole race is frozen (riders, clock, particles); only the player's glide to the sign runs
    if (r.frozen) { if (r.gateGlide) gateGlideStep(r); return; }
    const ts = r.timeScale;
    const dt = STEP * ts;
    if (r.slowT > 0) { r.slowT -= STEP; if (r.slowT <= 0) r.timeScale = 1; }
    if (r.race && r.me.hold && r.me.releaseT > 0 && r.t >= r.me.releaseT) releasePlayer(r);
    if (r.race && r.phase === 'parked') countdownStep(r);
    const me = r.me;
    if (r.race && r.goT >= 0) for (const v of r.riders) if (v.ai && v.hold && !v.finished && r.t - r.goT >= v.startDelay) v.hold = false;
    for (const v of r.riders) {
      measure(v);
      v.pre.vx = v.com.vx; v.pre.vy = v.com.vy;
      if (v.hold) continue;
      if (v === me && r.winchAnim) winchStep(r, dt);
      else if (v.crashed) { /* tumbling: no control */ }
      else if (v.finished || (v === me && r.phase === 'done')) coastToStop(v, dt);
      else if (r.race) controlsRace(r, v, dt, v.ai ? aiInput(r, v) : r.finishCrossed ? NO_INPUT : input);
      else if (r.phase !== 'gate') controls(r, dt);
    }
    for (const v of r.riders) {
      measure(v);
      // Matter's constraint damping works on the bodies' centre velocities, so in the air it would eat the spin of
      // the whole assembly: the suspension is undamped while airborne / tumbling
      const damp = v.air || v.crashed ? 0 : 0.14;
      if (v.cons[0].damping !== damp) for (const k of v.cons) k.damping = damp;
      const gsl = r.course.groundSlope(v.com.x), gn = Math.hypot(gsl, 1);
      v.vtBefore = (v.com.vx + v.com.vy * gsl) / gn;
      v.contacts[0] = v.contacts[1] = v.contacts[2] = false;
      v.nrm = null;
    }
    r.gateTouch = false;
    for (let i = 0; i < SUBSTEPS; i++) Engine.update(r.engine, (STEP_MS * ts) / SUBSTEPS);
    for (const v of r.riders) {
      if (v.hold || (!r.race && (r.phase === 'parked' || r.phase === 'gate'))) { holdPose(v); measure(v); continue; }
      if (v === me && r.winchAnim) winchPose(r);
      bumpStops(v);
      measure(v);
      // give back most of the speed the solver scrubs off on segment seams while rolling upright
      const gsl = r.course.groundSlope(v.com.x), gn = Math.hypot(gsl, 1), gtx = 1 / gn, gty = gsl / gn;
      const upDiff = wrapPi(v.ang - Math.atan(gsl));
      if (!v.air && !v.crashed && Math.abs(upDiff) < 0.6 && v.vtBefore > 2 && (v.contacts[1] || v.contacts[2]) && !v.contacts[0]) {
        const vtAfter = v.com.vx * gtx + v.com.vy * gty;
        const loss = vtAfter - v.vtBefore + G * (gsl / gn) * dt;
        if (loss < 0) { addVelAll(v, gtx * -loss * 0.9, gty * -loss * 0.9); measure(v); }
      }
      if (v.speed > 70) { const f = 70 / v.speed; addVelAll(v, v.com.vx * (f - 1), v.com.vy * (f - 1)); measure(v); }
    }
    if (r.pendingRemove.length) { Composite.remove(r.world, r.pendingRemove); r.pendingRemove.length = 0; }
    if (r.slowFactor !== 1) {
      addVelAll(me, me.com.vx * (r.slowFactor - 1), me.com.vy * (r.slowFactor - 1));
      r.slowFactor = 1;
      measure(me);
    }
    for (const v of r.riders) {
      if (!isFinite(v.com.x) || !isFinite(v.com.y) || !isFinite(v.speed)) {
        console.warn('[engine] non-finite vehicle state; resetting rider');
        placeVehicle(v, Math.max(0, v.maxX || 0), r.course.groundY(Math.max(0, v.maxX || 0)) + 0.1, 0);
        measure(v);
        if (v === me && r.phase !== 'done' && !r.race) { endRun(r, 'error'); return; }
      }
    }
    r.t += dt;
    if (r.race) {
      for (const v of r.riders) if (!v.hold) riderLogicRace(r, v, dt);
      if (r.phase !== 'done') playerLogic(r, dt);
      racePlaces(r);
    } else if (r.phase !== 'done') logic(r, dt);
    manageChunks(r);
  }

  function surfaceGrip(r, v, x) {
    const s = r.course.surfaceAt(x);
    v.surf = s;
    return SURF_LIST[s];
  }

  // ===================================== race mode =====================================
  function countdownStep(r) {
    if (!r.countdownOn) { goNow(r); return; }
    r.cdT += STEP;
    const marks = [TR.goAt - 3, TR.goAt - 2, TR.goAt - 1];
    while (r.cdStep < 3 && r.cdT >= marks[r.cdStep]) {
      const n = 3 - r.cdStep;
      r.cdStep++;
      emit({ type: 'countdown', n });
      popup(r, String(n), 0.5, 0.36, '#ffffff', 2.2, false, 0.9, 'cd');
    }
    if (input.gas && r.cdT > TR.goAt - TR.bogWindow) r.bogged = true;
    if (r.cdT >= TR.goAt) goNow(r);
  }
  function goNow(r) {
    r.phase = 'ride';
    r.goT = r.t;
    r.gateDrop = r.realT;
    emit({ type: 'go' });
    if (r.riders.length > 1) emit({ type: 'position', place: r.place });
    popup(r, 'GO!', 0.5, 0.36, '#7dff6b', 2.2, false, 0.9, 'cd');
    const me = r.me;
    me.hold = false;
    if (r.bogged) {
      me.bogT = TR.bogTime;
      emit({ type: 'bogged' });
      popup(r, 'BOGGED!', 0.5, LANE_SUB, '#ff9b6b', 0.9, false, 1.2, 'sub');
    }
  }

  // AI riders: full throttle, a short boost now and then on the straights; landings via the assist with an error
  function aiInput(r, v) {
    const ai = v.ai;
    AI_INPUT.boost = false;
    if (ai.boostT > 0) { ai.boostT -= STEP; AI_INPUT.boost = v.fuel > 0; }
    else if (!v.air && v.fuel > v.tank * 0.35 && v.vf < v.vTop * 0.95 && Math.abs(r.course.groundSlope(v.com.x)) < 0.08 && r.aiRand() < 0.04) ai.boostT = 0.4 + r.aiRand() * 0.5;
    return AI_INPUT;
  }

  function controlsRace(r, v, dt, inp) {
    const st = v.stats;
    const rearDown = v.wheelAgo[1] < 0.1, frontDown = v.wheelAgo[2] < 0.1;
    const grounded = rearDown || frontDown;
    const rearX = v.wheels[0].position.x / S;
    const sf = surfaceGrip(r, v, rearX);
    const gsl = r.course.groundSlope(rearX), gn = Math.hypot(1, gsl), tx = 1 / gn, ty = gsl / gn;
    const pitch = wrapPi(v.ang - Math.atan(gsl));
    const onWheels = Math.abs(pitch) < 0.9;
    const cosT = 1 / gn;
    const mu = RACE.mu * st.grip * r.trailGrip * sf.grip * (v.inWater ? 0.85 : 1);
    const aTrac = mu * G * cosT;
    const vf = v.vf;
    if (v.bogT > 0) v.bogT -= dt;
    if (v.invulnT > 0) v.invulnT -= dt;
    v.spin = 0;
    if (grounded && !v.air && onWheels) {
      if (inp.gas && rearDown) {
        let aEng = RACE.driveA * Math.pow(st.power, RACE.driveExp) * Math.max(0, 1 - Math.pow(Math.max(0, vf) / v.vTop, RACE.curve));
        if (v.bogT > 0) aEng *= TR.bogMul;
        const drive = Math.min(aEng, aTrac);
        if (aEng > aTrac * 1.02) v.spin = 1;
        addVelAll(v, tx * drive * dt, ty * drive * dt);
        let wdot = T.wheelie * drive * 0.5;
        if (pitch > 0.3 && !frontDown) wdot -= (pitch - 0.3) * 5 * st.suspension + v.omega * 1.5 * st.suspension;
        setOmegaAll(v, v.omega + wdot * dt);
      } else if (inp.brake) {
        if (vf > 0.4) {
          const dv = Math.min(vf, Math.min(T.brakeA, aTrac * 1.2) * dt);
          addVelAll(v, -tx * dv, -ty * dv);
        } else if (rearDown && vf > -T.reverseV) {
          const a = Math.min(T.reverseA * Math.sqrt(st.power), aTrac);
          addVelAll(v, -tx * a * dt, -ty * a * dt);
        }
      }
    }
    if (v.air) airControlRace(r, v, dt, inp);
    else if (v.contacts[0] && Math.abs(pitch) > 0.9 && Math.abs(pitch) < 2.1 && v.speed < 3) setOmegaAll(v, v.omega - Math.sign(pitch) * 5 * st.suspension * dt);
    else if (rearDown && frontDown && !v.contacts[0]) setOmegaAll(v, v.omega * (1 - Math.min(1, dt * 2 * st.suspension)));
    // boost: thrust along the ground (heading in the air), a little past the top speed
    const wantBoost = (inp.boost && v.fuel > 0) || v.burstT > 0;
    if (wantBoost) {
      if (v.burstT > 0) v.burstT -= dt; else { v.fuel = Math.max(0, v.fuel - dt); if (v.me) r.boostUsed += dt; }
      const vMax = v.vTop * TR.boostVMul;
      const a = TR.boostA * st.boostPower * Math.max(0.1, 1 - Math.max(0, vf) / vMax);
      const bx = grounded && onWheels ? tx : v.fx, by = grounded && onWheels ? ty : v.fy;
      addVelAll(v, bx * a * dt, by * a * dt);
    }
    if (wantBoost !== v.boostOn) {
      v.boostOn = wantBoost;
      if (v.me) {
        emit({ type: 'boost', on: wantBoost });
        if (wantBoost && v.burstT <= 0) popup(r, 'BOOST!', 0.5, LANE_SUB, '#7cf2ff', 0.7, false, 0.9, 'boost');
      }
    }
    // resistances (a berm holds the speed: no rolling drag there)
    measure(v);
    const sp = v.speed;
    if (sp > 0.01) {
      let dec = RACE.drag * sp * sp;
      if (grounded && !r.course.bermAt(v.com.x)) dec += RACE.roll + sf.drag;
      else if (v.contacts[0]) dec += 2.5;
      if (v.inWater) dec += 1.0 + 0.05 * sp;
      const dv = Math.min(sp, dec * dt);
      addVelAll(v, (-v.com.vx / sp) * dv, (-v.com.vy / sp) * dv);
    }
    spinWheels(v, inp);
  }
  function spinWheels(v, inp) {
    const wr = VEHICLE.wheels[0].r;
    for (let i = 0; i < 2; i++) {
      const touching = v.contacts[i + 1];
      let target = touching ? v.vf / wr : v.wheelSpin[i];
      if (i === 0 && v.spin && inp.gas) target = Math.max(target, 9);
      if (v.air && inp.gas && i === 0) target = Math.max(target, 30);
      if (inp.brake && touching && v.vf > 0.4) target *= 0.25;
      v.wheelSpin[i] = target;
      Body.setAngularVelocity(v.wheels[i], target / 60);
    }
  }

  function airControlRace(r, v, dt, inp) {
    const st = v.stats;
    const k01 = clamp((st.suspension - 1) / 1.4, 0, 1);
    // a button held through the takeoff leans only after it is released and pressed again
    if (!inp.gas) v.leanBlockGas = false;
    if (!inp.brake) v.leanBlockBrake = false;
    const lean = (inp.brake && !v.leanBlockBrake ? 1 : 0) - (inp.gas && !v.leanBlockGas ? 1 : 0); // +1 = back
    let w = v.omega;
    v.lastLean = lean; v.lastW0 = w;
    if (lean) {
      v.leaned = true;
      if (lean > 0 ? w < TR.airLeanMax : w > -TR.airLeanMax) w += TR.airLean * lean * dt;
    } else {
      // no lean held: the suspension rights the Ranger toward the nearest wheels-down attitude (it finishes a
      // nearly-round flip), aiming at the landing slope once touchdown is near; a better suspension turns harder
      const near = predictImpact(r, v, TR.assistLook + (v.ai ? 0.3 : 0.25 * k01));
      const target = (near ? Math.atan(r.course.groundSlope(v.imp.x)) : 0) + v.aiErr;
      const lead = v.ang + w * 0.25;
      const goal = lead - wrapPi(lead - target);
      const err = v.ang - goal;
      const amax = (v.ai ? TR.assistMax + TR.assistMaxPer : TR.assistMax + TR.assistMaxPer * k01) * (near ? 1 : 0.6);
      w += clamp(-err * TR.assistK - w * TR.assistD, -amax, amax) * dt;
    }
    setOmegaAll(v, w);
  }

  function predictImpact(r, v, maxT) {
    const h = 0.03, c = r.course;
    let x = v.com.x, y = v.com.y, vx = v.com.vx, vy = v.com.vy;
    for (let t = 0; t <= maxT; t += h) {
      if (vy < 0 && y - c.groundY(x) <= v.rideH + 0.15) { v.imp.t = t; v.imp.x = x; v.imp.ok = true; return true; }
      x += vx * h; y += vy * h - 0.5 * G * h * h; vy -= G * h;
    }
    v.imp.ok = false;
    return false;
  }

  function coastToStop(v, dt) {
    measure(v);
    if (v.speed > 0.01 && (v.contacts[1] || v.contacts[2] || v.contacts[0])) {
      const dv = Math.min(v.speed, 7 * dt);
      addVelAll(v, (-v.com.vx / v.speed) * dv, (-v.com.vy / v.speed) * dv);
    }
  }

  // per-rider race logic: air / landing / flips, crash + respawn, checkpoints, finish
  function riderLogicRace(r, v, dt) {
    const c = r.course;
    for (let i = 0; i < 3; i++) { if (v.contacts[i]) v.wheelAgo[i] = 0; else v.wheelAgo[i] += dt; }
    const anyContact = v.contacts[0] || v.contacts[1] || v.contacts[2];
    if (v.com.x > v.maxX) v.maxX = v.com.x;
    if (v.crashed) {
      v.crashT -= dt;
      stepThrown(r, v, dt);
      if (v.crashT <= 0) respawn(r, v);
      return;
    }
    // airborne / landing
    if (!v.air) {
      if (!anyContact) {
        v.noContactT += dt;
        if (v.noContactT > 0.1 && v.com.y - c.groundY(v.com.x) > v.rideH + 0.3) {
          v.air = true;
          v.airTime = v.noContactT;
          v.flightRot = 0; v.flipMark = 0; v.leaned = false;
          const inp = v.ai ? AI_INPUT : input;
          v.leanBlockGas = !!inp.gas; v.leanBlockBrake = !!inp.brake;
          if (v.ai) {
            const sk = v.ai.skill;
            v.aiErr = (r.aiRand() - 0.5) * 2 * (0.08 + 0.16 * (1 - sk));
            if (r.aiRand() < 0.025 * (1.3 - sk)) v.aiErr = (r.aiRand() < 0.5 ? -1 : 1) * 1.1; // a rare big mistake
          } else v.aiErr = 0;
        }
      } else v.noContactT = 0;
    } else {
      v.airTime += dt;
      v.flightRot += -(v.chassis.angle - v.prevAngle);
      if (anyContact) landRace(r, v);
    }
    v.prevAngle = v.chassis.angle;
    if (!v.me) { const w = c.waterAt(v.com.x); v.inWater = !!w && v.com.y < w.level + 0.9; }
    if (r.goT < 0) return;
    // checkpoints
    const cps = c.checkpoints;
    while (v.cpIndex + 1 < cps.length && v.com.x >= cps[v.cpIndex + 1].x) {
      v.cpIndex++;
      if (v.me) emit({ type: 'checkpoint', index: v.cpIndex });
    }
    // finish
    if (!v.finished && v.com.x >= c.finishX) {
      v.finished = true;
      v.finishTime = r.t - r.goT;
      v.finishOrder = ++r.finishCount;
      if (v.me) {
        r.finishCrossed = true;
        r.finishT = r.t;
        r.timeSec = v.finishTime;
        emit({ type: 'lap', timeSec: Math.round(v.finishTime * 100) / 100 });
        emit({ type: 'finishLine' });
        popup(r, ORD[v.finishOrder - 1] + '!', 0.5, LANE_BIG, v.finishOrder === 1 ? '#ffd23f' : '#ffffff', 1.5, false, 2.2, 'big');
        confetti(r, c.finishX, c.groundY(c.finishX) + 6, reducedMotion ? 30 : 90);
      }
    }
    if (v.finished) {
      if (!v.stopped && v.speed < 0.3 && !v.air && r.t - (r.goT + v.finishTime) > 1) { v.stopped = true; capturePose(v); v.hold = true; }
      return;
    }
    // no stuck state in a race: on the roof / stopped / off the world → it counts as a crash and respawns
    const upCos = Math.cos(v.ang);
    if (!v.air && upCos < 0.2 && v.speed < 2.5) v.upT += dt; else v.upT = 0;
    if (!v.air && v.speed < 1 && r.t - r.goT > 3 && (v.ai || input.gas)) v.slowT += dt; else v.slowT = 0;
    if (v.upT > 0.8 || v.slowT > 3 || v.com.y < c.groundY(v.com.x) - 20) crash(r, v, false);
  }

  function landRace(r, v) {
    const st = v.stats, c = r.course;
    const air = v.airTime;
    v.air = false;
    v.noContactT = 0;
    if (air < T.minFlight) return;
    const n = v.nrm || { nx: 0, ny: 1 };
    const pre = v.pre;
    const impact = Math.max(0, -(pre.vx * n.nx + pre.vy * n.ny));
    const ux = -Math.sin(v.ang), uy = Math.cos(v.ang);
    const err = (Math.acos(clamp(ux * n.nx + uy * n.ny, -1, 1)) * 180) / Math.PI;
    const thr = TR.impactThr * st.suspension;
    const roof = v.contacts[0] && !v.contacts[1] && !v.contacts[2];
    const slope = c.groundSlope(v.com.x);
    let q;
    if (v.invulnT <= 0 && (err > TR.crashAngle || (roof && err > TR.roofAngle))) q = 'crash';
    else if (err < TR.perfectAngle && slope < -0.12 && impact < thr && air >= 0.5) q = 'perfect';
    else if (err < TR.goodAngle && impact < thr * 1.6) q = 'good';
    else q = 'hard';
    if (q === 'crash') { if (v.me) { r.totalAir += air; r.flights++; r.landings.crash++; emit({ type: 'air', airTime: Math.round(air * 100) / 100 }); emit({ type: 'land', quality: 'crash' }); } crash(r, v, true); return; }
    // keep the speed along the ground on a clean landing
    const gn = Math.hypot(slope, 1), tx = 1 / gn, ty = slope / gn;
    if (q !== 'hard') {
      const vt = (pre.vx * tx + pre.vy * ty) * (q === 'perfect' ? 1.02 : 0.97);
      addVelAll(v, tx * vt - v.com.vx, ty * vt - v.com.vy);
      measure(v);
      setOmegaAll(v, clamp(v.omega, -1, 1));
    } else {
      const vt = Math.max(0, pre.vx * tx + pre.vy * ty) * 0.72;
      addVelAll(v, tx * vt - v.com.vx, ty * vt - v.com.vy);
      measure(v);
    }
    // flips: a full turn (minus a little grace) landed wheels-down
    const turns = Math.floor((Math.abs(v.flightRot) + TR.flipGrace) / TAU);
    if (q === 'perfect') v.fuel = Math.min(v.tank, v.fuel + v.tank * TR.perfectFuel);
    if (!v.me) return;
    r.flights++;
    r.totalAir += air;
    r.landings[q]++;
    emit({ type: 'air', airTime: Math.round(air * 100) / 100 });
    emit({ type: 'land', quality: q });
    const m = r.stats.coinMult;
    if (turns >= 1) {
      const kind = v.flightRot > 0 ? 'back' : 'front';
      r.combo++;
      const mult = Math.min(TR.comboMax, 1 + TR.comboStep * (r.combo - 1));
      const raw = TR.flipCash * turns * (turns > 1 ? 2 : 1) * mult;
      r.flipRaw += raw;
      r.flips += turns;
      v.fuel = Math.min(v.tank, v.fuel + v.tank * TR.flipFuel * turns);
      const cash = Math.round(raw * m);
      emit({ type: 'flip', kind, count: turns, cash, combo: r.combo });
      const word = turns === 1 ? '' : turns === 2 ? 'DOUBLE ' : turns + 'x ';
      popup(r, word + (kind === 'back' ? 'BACKFLIP!' : 'FRONT FLIP!'), 0.5, LANE_BIG, '#ff5ec4', 1.15, false, 1.4, 'big');
      popup(r, '+$' + cash + (mult > 1 ? '  x' + mult : ''), 0.5, LANE_SUB, '#ffe14a', 0.75, false, 1.4, 'sub');
      slowmo(r);
    } else {
      if (air >= 0.6) r.combo = 0;
      if (q === 'perfect') popup(r, 'PERFECT!', 0.5, LANE_BIG, '#7dff6b', 1.1, false, 1.2, 'big');
      else if (q === 'hard') popup(r, 'OOF!', 0.5, LANE_BIG, '#ffb36b', 0.95, false, 1.0, 'big');
    }
    if (q === 'perfect') {
      r.perfectRaw += TR.perfectCash;
      if (turns >= 1) popup(r, 'PERFECT!', 0.5, 0.82, '#7dff6b', 0.7, false, 1.2, 'perf');
    }
    if (q === 'hard') r.combo = 0;
    if (air >= TR.bigAir) {
      emit({ type: 'bigAir', airTime: Math.round(air * 100) / 100 });
      if (turns < 1) popup(r, 'BIG AIR!', 0.5, 0.82, '#7cf2ff', 0.8, false, 1.2, 'perf');
    }
    const cx = v.com.x;
    for (let k = 0; k < 10; k++) {
      particle(r, r.bd.style === 'snow' ? P_SNOW : P_DUST, cx + (Math.random() - 0.5) * 3, c.groundY(cx) + 0.2, (Math.random() - 0.5) * 5 + v.com.vx * 0.15, Math.random() * 2,
        0.3 + Math.random() * 0.4, r.bd.style === 'snow' ? '#ffffff' : r.dustCol, 0.6 + Math.random() * 0.5, 0.7);
    }
    r.shake = Math.max(r.shake, clamp(impact * 0.7, 1.5, 14) * (q === 'hard' ? 1.3 : 0.5));
  }

  // a crash: the Ranger tumbles, the driver and the helmet fly off; respawn at the last checkpoint after crashTime
  function crash(r, v, fromLanding) {
    if (v.crashed) return;
    v.crashed = true;
    v.crashT = TR.crashTime;
    v.crashes++;
    v.air = false;
    if (v.boostOn) { v.boostOn = false; if (v.me) emit({ type: 'boost', on: false }); }
    localToWorld(v, -0.06, 1.7, tmp2);
    const dir = v.com.vx >= 0 ? 1 : -1;
    v.driver = { x: tmp2[0], y: tmp2[1] - 0.5, vx: v.com.vx * 0.6 + dir * 3, vy: 6.5 + Math.random() * 2, rot: 0, spin: -dir * (6 + Math.random() * 3), helmet: false };
    v.helmetObj = { x: tmp2[0], y: tmp2[1], vx: v.com.vx * 0.7 + dir * 3, vy: 6 + Math.random() * 2, rot: 0, spin: -dir * 10, bounces: 0 };
    if (fromLanding) setOmegaAll(v, v.omega + (v.flightRot >= 0 ? 3 : -3));
    if (v.me) {
      r.crashes++;
      r.combo = 0;
      emit({ type: 'crash' });
      popup(r, 'CRASH!', 0.5, LANE_BIG, '#ff6b5a', 1.25, false, 1.3, 'big');
      r.shake = Math.max(r.shake, 12);
      for (let k = 0; k < 7; k++) particle(r, P_DUST, v.com.x + (Math.random() - 0.5) * 3, v.com.y - 0.8, (Math.random() - 0.5) * 6 + v.com.vx * 0.2, Math.random() * 2, 0.22 + Math.random() * 0.22, r.dustCol, 0.6, 0.5);
      for (let k = 0; k < 10; k++) particle(r, P_SPARK, v.com.x, v.com.y, (Math.random() - 0.5) * 12, Math.random() * 8, 0.07, k % 2 ? '#ffd23f' : '#ff7a1a', 0.4, 1);
    }
  }
  function stepThrown(r, v, dt) {
    const c = r.course;
    for (const o of [v.driver, v.helmetObj]) {
      if (!o) continue;
      o.vy -= G * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.rot += o.spin * dt;
      const gy = c.groundY(o.x) + (o === v.driver ? 0.45 : 0.2);
      if (o.y < gy) {
        o.y = gy;
        if (o.vy < -1.5) { o.vy = -o.vy * (o === v.driver ? 0.25 : 0.55); o.spin *= 0.6; }
        else { o.vy = 0; o.spin *= 0.8; }
        o.vx *= o === v.driver ? 0.6 : 0.8;
      }
    }
  }
  function respawn(r, v) {
    const c = r.course;
    const cp = c.checkpoints[v.cpIndex] || c.checkpoints[0];
    const x = cp.x;
    const a = Math.atan(c.groundSlope(x));
    placeVehicle(v, x, c.groundY(x) + 0.08, a);
    measure(v);
    const push = TR.respawnPush * v.vTop;
    addVelAll(v, push * Math.cos(a), push * Math.sin(a));
    measure(v);
    v.crashed = false;
    v.driver = null; v.helmetObj = null;
    v.invulnT = TR.invuln;
    v.air = false; v.noContactT = 0; v.upT = 0; v.slowT = 0;
    v.prevAngle = v.chassis.angle;
    v.wheelAgo[0] = v.wheelAgo[1] = v.wheelAgo[2] = 0;
    if (v.me) {
      emit({ type: 'respawn', checkpoint: cp.index, x: Math.round(x * 10) / 10 });
      if (cam.x - x > 25) updateCamera(r, 1, true);
    }
  }

  // player-only race logic: distance, coins, water splash, wheel fx, the end of the ride
  function playerLogic(r, dt) {
    const v = r.me, c = r.course;
    if (r.goT >= 0) { r.rideT += dt; if (!v.finished) r.timeSec = r.t - r.goT; }
    if (v.com.x > r.maxX && !v.crashed) r.maxX = v.com.x;
    r.distance = clamp(r.maxX, 0, c.length);
    const kmh = v.speed * 3.6;
    if (kmh > r.maxKmh && r.goT >= 0 && !v.crashed) r.maxKmh = kmh;
    if (!r.launched && r.goT >= 0 && input.gas) { r.launched = true; emit({ type: 'launch' }); }
    if (r.best > 0 && !r.recordHit && r.distance >= r.best) { r.recordHit = true; emit({ type: 'record', distance: Math.round(r.best) }); }
    waterFx(r, v);
    coinsFor(r, v, true);
    wheelFx(r, v, input);
    raceGate(r, v);
    if (r.finishCrossed && (v.stopped || r.t - r.finishT > 4)) endRun(r, 'finish');
  }

  // ---- v1.2 math gates in a race: only the player stops; the race freezes while the question is open ----
  function raceGate(r, v) {
    for (const q of r.gates) if (q.openT >= 0 && q.open < 1) q.open = Math.min(1, (r.realT - q.openT) / 0.6);
    const g = r.gates[r.gateIndex];
    if (!g || g.done || v.crashed || v.finished || v.hold || r.goT < 0) return;
    const frontX = v.wheels[1].position.x / S;
    const stopX = g.x - T.gateStop;
    if (frontX > g.x + 2) { openGateNow(r, g, null); return; } // carried past it (should not happen)
    // start the glide early enough that it lasts about a second at the current speed
    const d = clamp(v.speed * 0.5, 3, 14);
    if (frontX >= stopX - d) startGateGlide(r, g);
  }
  function startGateGlide(r, g) {
    const v = r.me, c = r.course;
    measure(v);
    r.gateEntryV = clamp(Math.max(v.vf, v.speed * 0.8), 6, v.vTop);
    const a0 = v.ang, cs = Math.cos(a0), sn = Math.sin(a0);
    const ox = v.chassis.position.x / S - (cs * HULL_C[0] - sn * HULL_C[1]);
    const oy = -v.chassis.position.y / S - (sn * HULL_C[0] + cs * HULL_C[1]);
    const x1 = g.x - T.gateStop - VEHICLE.wheels[1].x;
    const dist = Math.max(0.5, x1 - ox);
    r.gateGlide = { t: 0, dur: clamp(dist / Math.max(4, r.gateEntryV * 0.5), 0.35, 1.0), x0: ox, y0: oy, a0, x1, a1: Math.atan(c.groundSlope(x1)), g };
    r.frozen = true;
    r.gateApproach = true;
    v.air = false;
    if (v.boostOn) { v.boostOn = false; emit({ type: 'boost', on: false }); }
  }
  function gateGlideStep(r) {
    const G = r.gateGlide, v = r.me, c = r.course;
    G.t += STEP;
    const u = Math.min(1, G.t / G.dur);
    const e = 1 - (1 - u) * (1 - u); // brakes hard, settles gently
    const x = G.x0 + (G.x1 - G.x0) * e;
    const yg = c.groundY(x) + 0.06;
    const y = G.y0 + (yg - G.y0) * smoothstep(0, 0.6, u);
    const a = G.a0 + wrapPi(Math.atan(c.groundSlope(x)) - G.a0) * smoothstep(0, 0.7, u);
    placeVehicle(v, x, y, a);
    for (let i = 0; i < 2; i++) Body.setAngle(v.wheels[i], (x - G.x0) / VEHICLE.wheels[i].r);
    measure(v);
    if (u >= 1) {
      capturePose(v);
      v.hold = true;
      v.prevAngle = v.chassis.angle;
      r.gateGlide = null;
      r.gateApproach = false;
      r.phase = 'gate';
      emit({ type: 'gate', index: G.g.index, x: G.g.x });
      popup(r, 'GATE!', 0.5, LANE_BIG, '#ffb347', 1.2, false, 1.3, 'big');
    }
  }
  // release the player from the line at the speed it reached the gate with (a gate is time-neutral)
  function releasePlayer(r) {
    const v = r.me, c = r.course;
    v.hold = false;
    v.releaseT = 0;
    const a = Math.atan(c.groundSlope(v.com.x));
    for (const b of v.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
    measure(v);
    addVelAll(v, r.gateEntryV * Math.cos(a), r.gateEntryV * Math.sin(a));
    measure(v);
    v.wheelAgo[1] = v.wheelAgo[2] = 0;
    v.air = false; v.noContactT = 0;
    v.prevAngle = v.chassis.angle;
  }

  function racePlaces(r) {
    const rs = r.riders;
    if (r.goT < 0 || rs.length < 2) return;
    for (const v of rs) {
      let p = 1;
      for (const o of rs) {
        if (o === v) continue;
        if (o.finished && (!v.finished || o.finishOrder < v.finishOrder)) p++;
        else if (!o.finished && !v.finished && o.com.x > v.com.x) p++;
      }
      v.place = p;
    }
    const p = r.me.finished ? r.me.finishOrder : r.me.place;
    if (p !== r.place) { r.place = p; emit({ type: 'position', place: p }); }
  }

  // ===================================== shared fx =====================================
  function waterFx(r, v) {
    const c = r.course;
    const w = c.waterAt(v.com.x);
    const wet = !!w && v.com.y < w.level + 0.9;
    if (wet && !r.wasWet && r.realT - r.splashT > 0.6) {
      r.splashT = r.realT;
      emit({ type: 'splash', x: Math.round(v.com.x) });
      const n = reducedMotion ? 10 : 24;
      for (let k = 0; k < n; k++) particle(r, P_SPLASH, v.com.x + (Math.random() - 0.5) * 2.4, w.level, v.com.vx * 0.35 + (Math.random() - 0.5) * 5, 3 + Math.random() * 6, 0.1 + Math.random() * 0.1, k % 3 ? '#d8f1ff' : '#8fd0ff', 0.7 + Math.random() * 0.5, 0.95);
      particle(r, P_RING, v.com.x, w.level, 0, 0, 0.4, '#ffffff', 0.5, 0.8, 2.5);
      r.shake = Math.max(r.shake, 3);
    }
    r.wasWet = wet;
    v.inWater = wet;
    if (wet && v.speed > 2 && Math.random() < 0.5) particle(r, P_SPLASH, v.com.x - 1 + Math.random() * 2, w.level, -v.com.vx * 0.1 + (Math.random() - 0.5) * 2, 1 + Math.random() * 3, 0.08 + Math.random() * 0.06, '#d8f1ff', 0.5, 0.9);
  }
  function coinsFor(r, v, race) {
    const C = r.course.coins;
    while (r.coinLo < C.length && C[r.coinLo].x < v.com.x - 4) r.coinLo++;
    for (let i = r.coinLo; i < C.length; i++) {
      const cn = C[i];
      if (cn.x > v.com.x + 4) break;
      if (r.coinHit[i]) continue;
      const dx = cn.x - v.com.x, dy = cn.y - v.com.y;
      if (dx * dx + dy * dy < 1.7 * 1.7) {
        r.coinHit[i] = 1;
        r.coins++;
        const cash = Math.round(T.cash.coin * r.stats.coinMult);
        v.fuel = Math.min(v.tank, v.fuel + v.tank * (race ? TR.coinFuel : T.fuel.coin));
        emit({ type: 'coin', cash });
        for (let k = 0; k < 6; k++) particle(r, P_SPARK, cn.x, cn.y, v.com.vx * 0.3 + (Math.random() - 0.5) * 5, (Math.random() - 0.3) * 5, 0.06, k % 2 ? '#fff3a0' : '#ffc93c', 0.35, 1);
        if (r.realT - r.coinPopT > 0.35) { r.coinPopT = r.realT; popup(r, '+$' + cash, cn.x, cn.y + 1.1, '#ffe14a', 0.55, true, 0.9); }
      }
    }
  }
  function wheelFx(r, v, inp) {
    const wheelsDown = v.wheelAgo[1] < 0.1 || v.wheelAgo[2] < 0.1;
    if (wheelsDown && v.speed > 1.5 && !v.inWater && !v.crashed) {
      const sid = v.surf;
      const rooster = r.race && inp.gas && v.wheelAgo[1] < 0.1;
      const p = rooster ? 0.9 : v.spin ? 0.8 : Math.min(0.6, v.speed / 25);
      if (Math.random() < p) {
        const wb = v.wheels[0];
        const wx = wb.position.x / S - 0.3, wy = -wb.position.y / S - 0.3;
        const st = SURF_IDS[sid];
        // a rooster tail on throttle: thrown up and back
        const kx = rooster ? -2.5 - Math.random() * 4 - v.speed * 0.15 : -v.com.vx * 0.08 + (Math.random() - 0.5);
        const ky = rooster ? 2 + Math.random() * 3.5 : 0.5 + Math.random() * 1.2;
        if (st === 'mud') particle(r, P_MUD, wx, wy, -v.com.vx * 0.25 - 2 - Math.random() * 3, 1.5 + Math.random() * 3, 0.07 + Math.random() * 0.07, Math.random() < 0.5 ? '#5a3b22' : '#3e2814', 0.7, 1);
        else if (r.bd.style === 'snow' || st === 'ice') particle(r, P_SNOW, wx, wy, kx * 0.8, ky, 0.12 + Math.random() * 0.12, '#ffffff', 0.6 + Math.random() * 0.4, 0.85);
        else particle(r, rooster ? P_MUD : P_DUST, wx, wy, kx, ky, rooster ? 0.08 + Math.random() * 0.08 : 0.14 + Math.random() * 0.16 + Math.min(0.2, v.speed / 90), st === 'sand' ? '#e9d29b' : rooster ? shade(r.bd.theme.trail || r.dustCol, -0.15) : r.dustCol, rooster ? 0.6 : 0.45 + Math.random() * 0.35, rooster ? 1 : 0.5);
        if (rooster && Math.random() < 0.4) particle(r, P_DUST, wx, wy, kx * 0.4, ky * 0.4, 0.18 + Math.random() * 0.2, r.dustCol, 0.5, 0.45);
      }
    }
    if (v.boostOn && Math.random() < 0.6) {
      localToWorld(v, VEHICLE.exhaust[0] - 0.5, VEHICLE.exhaust[1], tmp2);
      particle(r, P_DUST, tmp2[0], tmp2[1], v.com.vx * 0.3 - v.fx * 3, v.com.vy * 0.3 - v.fy * 3 + 0.4, 0.2 + Math.random() * 0.2, '#d6d6e0', 0.45, 0.5);
    }
  }

  // ===================================== trail mode (v1) =====================================
  function controls(r, dt) {
    const v = r.me, st = v.stats;
    const locked = r.gateMode === 'stop' || r.finishCrossed;
    const inp = locked ? NO_INPUT : r.phase === 'stuck' && r.upsideDown ? NO_INPUT : input;
    const rearDown = v.wheelAgo[1] < 0.1, frontDown = v.wheelAgo[2] < 0.1;
    const grounded = rearDown || frontDown;
    const rearX = v.wheels[0].position.x / S;
    const sf = surfaceGrip(r, v, rearX);
    const cosT = Math.max(0.2, Math.cos(v.ang));
    const mu = T.mu * st.grip * r.trailGrip * sf.grip * (v.inWater ? SURFACES.water.grip : 1);
    const aTrac = mu * G * cosT;
    const vTop = v.vTop;
    const vf = v.vf;
    v.spin = 0;
    let govern = false;
    const g = r.gates[r.gateIndex];
    r.gateZone = false;
    if (g && !g.done && r.phase === 'ride' && !r.gateMode) {
      const frontX = v.wheels[1].position.x / S;
      const d = g.x - T.gateTakeover - frontX;
      if (d < T.gateZone && d > -1) {
        r.gateZone = true;
        const vAllow = Math.sqrt(T.gateArriveV * T.gateArriveV + 2 * 5 * Math.max(0, d));
        if (vf > vAllow) {
          govern = true;
          if (grounded) {
            const dv = Math.min(vf - vAllow, Math.min(12, (vf - vAllow) * 6 + 3) * dt);
            addVelAll(v, -v.fx * dv, -v.fy * dv);
          }
        }
      }
    }
    if (r.gateMode === 'stop') {
      const frontX = v.wheels[1].position.x / S;
      const dRem = Math.max(0.03, g.x - T.gateStop - frontX);
      if (vf > 0) {
        const need = clamp((vf * vf) / (2 * dRem) + 0.5, 1, 18);
        const dv = Math.min(vf, need * dt);
        addVelAll(v, -v.fx * dv, -v.fy * dv);
      }
    }
    let drive = 0;
    const gsl = r.course.groundSlope(rearX), gn = Math.hypot(1, gsl), tx = 1 / gn, ty = gsl / gn;
    const pitch = wrapPi(v.ang - Math.atan(gsl));
    const onWheels = Math.abs(pitch) < 0.9;
    if (grounded && !v.air && onWheels) {
      if (inp.gas && rearDown && !govern) {
        const aEng = T.driveA * st.power * Math.max(0, 1 - Math.pow(Math.max(0, vf) / vTop, 2));
        drive = Math.min(aEng, aTrac);
        if (aEng > aTrac * 1.02) v.spin = 1;
        addVelAll(v, tx * drive * dt, ty * drive * dt);
        const vt = v.com.vx * tx + v.com.vy * ty;
        if (G * ty > drive * 0.98 && Math.abs(vt) < 1.6) {
          const k = 1 - Math.exp(-T.stallDamp * dt);
          addVelAll(v, -tx * vt * k, -ty * vt * k);
          v.spin = 1;
        }
        let wdot = T.wheelie * drive;
        if (pitch > 0.3 && !frontDown) wdot -= (pitch - 0.3) * 5 * st.suspension + v.omega * 1.5 * st.suspension;
        setOmegaAll(v, v.omega + wdot * dt);
      } else if (inp.brake) {
        if (vf > 0.4) {
          const dv = Math.min(vf, Math.min(T.brakeA, aTrac * 1.2) * dt);
          addVelAll(v, -v.fx * dv, -v.fy * dv);
        } else if (rearDown && vf > -T.reverseV) {
          const a = Math.min(T.reverseA * Math.sqrt(st.power), aTrac);
          addVelAll(v, -v.fx * a * dt, -v.fy * a * dt);
        }
      }
    }
    if (v.air) airControl(r, dt, inp);
    else if (v.contacts[0] && Math.abs(pitch) > 0.9 && Math.abs(pitch) < 2.1 && v.speed < 3) {
      setOmegaAll(v, v.omega - Math.sign(pitch) * 5 * st.suspension * dt);
    } else if (grounded && !v.contacts[0]) {
      if (rearDown && frontDown) setOmegaAll(v, v.omega * (1 - Math.min(1, dt * 2 * st.suspension)));
    }
    const wantBoost = (inp.boost && v.fuel > 0 && !govern && !r.gateZone) || v.burstT > 0;
    if (wantBoost) {
      if (v.burstT > 0) v.burstT -= dt; else { v.fuel = Math.max(0, v.fuel - dt); r.boostUsed += dt; }
      const vMax = vTop * T.boostVMul;
      const a = T.boostA * st.boostPower * Math.max(0.15, 1 - Math.max(0, vf) / vMax);
      const bx = grounded && onWheels ? tx : v.fx, by = grounded && onWheels ? ty : v.fy;
      addVelAll(v, bx * a * dt, by * a * dt);
    }
    if (wantBoost !== v.boostOn) {
      v.boostOn = wantBoost;
      emit({ type: 'boost', on: wantBoost });
      if (wantBoost && v.burstT <= 0) popup(r, 'BOOST!', 0.5, LANE_SUB, '#7cf2ff', 0.7, false, 0.9, 'boost');
    }
    measure(v);
    const sp = v.speed;
    if (sp > 0.01) {
      let dec = T.airDrag * sp * sp;
      if (grounded) dec += T.rollBase + sf.drag;
      else if (v.contacts[0]) dec += 2.5;
      if (v.inWater) dec += SURFACES.water.drag * 0.5 + 0.12 * sp;
      const dv = Math.min(sp, dec * dt);
      addVelAll(v, (-v.com.vx / sp) * dv, (-v.com.vy / sp) * dv);
    }
    spinWheels(v, inp);
  }

  function airControl(r, dt, inp) {
    const v = r.me, st = v.stats;
    const k01 = clamp((st.suspension - 1) / 1.4, 0, 1);
    const dir = (inp.gas ? 1 : 0) - (inp.brake ? 1 : 0); // +1 nose up (CCW)
    let w = v.omega;
    if (predictImpact(r, v, T.landLook + 0.45 * k01)) {
      const target = Math.atan(r.course.groundSlope(v.imp.x));
      const lead = v.ang + w * 0.2;
      const goal = lead - wrapPi(lead - target);
      const err = v.ang - goal;
      const gain = 1 + 0.8 * k01;
      const a = clamp(-err * T.landK * gain - w * T.landD * Math.sqrt(gain), -18 * gain, 18 * gain);
      w += a * dt;
    } else if (dir) {
      const cap = T.airTiltMax;
      if (dir > 0 ? w < cap : w > -cap) w += T.airTilt * dir * dt;
    } else {
      w *= 1 - Math.min(1, 1.2 * dt);
    }
    setOmegaAll(v, w);
  }

  function logic(r, dt) {
    const c = r.course, v = r.me;
    if (r.phase === 'parked' && (input.gas || input.boost)) {
      r.phase = 'ride';
      v.hold = false;
      r.launched = true;
      emit({ type: 'launch' });
    }
    for (let i = 0; i < 3; i++) { if (v.contacts[i]) v.wheelAgo[i] = 0; else v.wheelAgo[i] += dt; }
    const wheelsDown = (v.wheelAgo[1] < 0.1 ? 1 : 0) + (v.wheelAgo[2] < 0.1 ? 1 : 0);
    const anyContact = v.contacts[0] || v.contacts[1] || v.contacts[2];
    if (r.phase !== 'parked') r.rideT += dt;
    if (v.com.x > r.maxX) r.maxX = v.com.x;
    r.distance = clamp(r.maxX, 0, c.length);
    r.timeSec = r.rideT;
    const kmh = v.speed * 3.6;
    if (kmh > r.maxKmh && r.phase !== 'parked') r.maxKmh = kmh;
    if (r.best > 0 && !r.recordHit && r.distance >= r.best && r.phase !== 'parked') {
      r.recordHit = true;
      emit({ type: 'record', distance: Math.round(r.best) });
      popup(r, 'NEW BEST!', 0.5, LANE_SUB, '#7dff6b', 0.75, false, 1.4, 'sub');
    }
    if (!v.air) {
      if (!anyContact && !r.winchAnim) {
        v.noContactT += dt;
        if (v.noContactT > 0.12 && v.com.y - c.groundY(v.com.x) > v.rideH + 0.35) {
          v.air = true;
          v.airTime = v.noContactT;
          v.flightRot = 0; v.flipMark = 0;
        }
      } else v.noContactT = 0;
    } else {
      v.airTime += dt;
      v.flightRot += -(v.chassis.angle - v.prevAngle);
      while (v.flightRot - v.flipMark >= TAU) { v.flipMark += TAU; flipLegacy(r, 'back'); }
      while (v.flightRot - v.flipMark <= -TAU) { v.flipMark -= TAU; flipLegacy(r, 'front'); }
      if (anyContact) land(r);
    }
    v.prevAngle = v.chassis.angle;
    waterFx(r, v);
    coinsFor(r, v, false);
    wheelFx(r, v, input);
    gateLogic(r, dt);
    stuckLogic(r, dt, wheelsDown);
    if (!r.finishCrossed && v.com.x >= c.finishX) {
      r.finishCrossed = true;
      r.finishT = r.t;
      emit({ type: 'finishLine' });
      popup(r, 'FINISH!', 0.5, LANE_BIG, '#ffd23f', 1.25, false, 1.8, 'big');
      popup(r, '+$' + Math.round(T.cash.finish * r.stats.coinMult), 0.5, LANE_SUB, '#ffe14a', 0.75, false, 1.6, 'sub');
      confetti(r, c.finishX, c.groundY(c.finishX) + 6, reducedMotion ? 30 : 80);
      if (r.phase === 'stuck') { r.phase = 'ride'; r.stuck = false; }
    }
    if (r.finishCrossed && r.phase !== 'done') {
      if (!v.air && v.speed > 0.2) {
        const dv = Math.min(v.speed, 6 * dt);
        addVelAll(v, (-v.com.vx / v.speed) * dv, (-v.com.vy / v.speed) * dv);
      }
      if ((v.speed < 0.4 && !v.air && r.t - r.finishT > 0.6) || r.t - r.finishT > 3.5) return endRun(r, 'finish');
    }
    if (v.com.y < c.groundY(v.com.x) - 30) return endRun(r, 'fell');
  }

  function flipLegacy(r, direction) {
    r.flips++;
    emit({ type: 'flip', direction, kind: direction, count: 1 });
    popup(r, direction === 'back' ? 'BACKFLIP!' : 'FRONTFLIP!', 0.5, LANE_BIG, '#ff5ec4', 1.0, false, 1.2, 'big');
  }

  function land(r) {
    const v = r.me, st = v.stats, c = r.course;
    const air = v.airTime;
    v.air = false;
    v.noContactT = 0;
    if (air < T.minFlight) return;
    const n = v.nrm || { nx: 0, ny: 1 };
    const pre = v.pre;
    const impact = Math.max(0, -(pre.vx * n.nx + pre.vy * n.ny));
    const ux = -Math.sin(v.ang), uy = Math.cos(v.ang);
    const err = (Math.acos(clamp(ux * n.nx + uy * n.ny, -1, 1)) * 180) / Math.PI;
    const thr = T.impactThr * st.suspension;
    const roof = v.contacts[0] && !v.contacts[1] && !v.contacts[2];
    let q;
    if (err > 75 || (roof && err > 45)) q = 'crash';
    else if (err < 15 && impact < thr) q = 'perfect';
    else if (err < 32 && impact < thr * 1.45) q = 'good';
    else q = 'hard';
    r.flights++;
    r.totalAir += air;
    r.landings[q]++;
    if (q !== 'crash') {
      const rem = v.flightRot - v.flipMark;
      if (Math.abs(rem) >= TAU - 0.9) { v.flipMark += Math.sign(rem) * TAU; flipLegacy(r, rem > 0 ? 'back' : 'front'); }
    }
    emit({ type: 'air', airTime: Math.round(air * 100) / 100 });
    emit({ type: 'land', quality: q });
    const gsl = c.groundSlope(v.com.x), gn = Math.hypot(gsl, 1), tx = 1 / gn, ty = gsl / gn;
    if (q === 'perfect' || q === 'good') {
      const vt = (pre.vx * tx + pre.vy * ty) * (q === 'perfect' ? 1 : 0.95);
      addVelAll(v, tx * vt - v.com.vx, ty * vt - v.com.vy);
      measure(v);
      setOmegaAll(v, clamp(v.omega, -1, 1));
      if (air >= T.fuel.landMinAir) v.fuel = Math.min(v.tank, v.fuel + v.tank * (q === 'perfect' ? T.fuel.perfect : T.fuel.good));
      if (q === 'perfect') popup(r, 'PERFECT!', 0.5, LANE_BIG, '#7dff6b', 1.1, false, 1.3, 'big');
      else if (air > 0.7) popup(r, 'NICE LANDING', 0.5, LANE_BIG, '#c6ff8a', 0.9, false, 1.1, 'big');
    } else if (q === 'hard') {
      r.slowFactor *= 0.75;
      popup(r, 'OOF!', 0.5, LANE_BIG, '#ffb36b', 0.95, false, 1.1, 'big');
    } else {
      r.slowFactor *= 0.55;
      popup(r, 'CRASH!', 0.5, LANE_BIG, '#ff6b5a', 1.1, false, 1.2, 'big');
    }
    if (air > 0.6) popup(r, '+$' + Math.round(T.cash.airPerS * air * st.coinMult), 0.5, LANE_SUB, '#ffe14a', 0.62, false, 1.1, 'sub');
    const cx = v.com.x;
    for (let k = 0; k < 9; k++) {
      particle(r, r.bd.style === 'snow' ? P_SNOW : P_DUST, cx + (Math.random() - 0.5) * 3, c.groundY(cx) + 0.2, (Math.random() - 0.5) * 5 + v.com.vx * 0.1, Math.random() * 2,
        0.3 + Math.random() * 0.4, r.bd.style === 'snow' ? '#ffffff' : r.dustCol, 0.6 + Math.random() * 0.5, 0.7);
    }
    r.shake = Math.max(r.shake, clamp(impact * 0.8, 1.5, 12) * (q === 'crash' ? 1.4 : q === 'hard' ? 1.1 : 0.6));
  }

  function gateLogic(r, dt) {
    const v = r.me;
    const g = r.gates[r.gateIndex];
    for (const q of r.gates) if (q.openT >= 0 && q.open < 1) q.open = Math.min(1, (r.realT - q.openT) / 0.75);
    if (!g || r.phase !== 'ride') return;
    const frontX = v.wheels[1].position.x / S;
    if (frontX > g.x + 1.5) { openGateNow(r, g, null); return; }
    if (!r.gateMode && ((frontX >= g.x - T.gateTakeover && !v.air) || r.gateTouch)) {
      r.gateMode = 'stop';
      r.gateStopT = r.t;
    }
    if (r.gateMode === 'stop' && !v.air) {
      const dRem = g.x - T.gateStop - frontX;
      if ((v.vf < 0.25 && v.speed < 0.6) || dRem < 0.02 || r.t - r.gateStopT > 1.5) park(r, g);
    }
  }
  function park(r, g) {
    const v = r.me;
    measure(v);
    for (const b of v.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
    capturePose(v);
    r.phase = 'gate';
    r.gateMode = 'parked';
    if (v.boostOn) emit({ type: 'boost', on: false });
    v.boostOn = false;
    emit({ type: 'gate', index: g.index, x: g.x });
    popup(r, 'GATE!', 0.5, LANE_BIG, '#ffb347', 1.2, false, 1.3, 'big');
  }
  function openGateNow(r, g, res) {
    g.done = true;
    g.openT = r.realT;
    g.result = res;
    if (g.body) { Composite.remove(r.world, g.body); g.body = null; }
    r.gateIndex++;
    r.gateMode = null;
  }

  function stuckLogic(r, dt, wheelsDown) {
    const v = r.me, c = r.course;
    if (r.finishCrossed || r.winchAnim) return;
    const upCos = Math.cos(v.ang);
    const slope = c.groundSlope(v.com.x);
    if (r.phase === 'ride') {
      const stalled = input.gas && !v.air && v.speed < T.stuckSpeed && Math.abs(slope) > 0.06;
      r.stallT = stalled ? r.stallT + dt : 0;
      const flipped = upCos < 0.25 && !v.air && v.speed < 1.5 && (v.contacts[0] || wheelsDown < 2);
      r.upsideT = flipped ? r.upsideT + dt : 0;
      if (input.gas && !r.gateMode && (!v.air || v.speed < 0.5)) {
        if (r.maxX > r.progMark + 1) { r.progMark = r.maxX; r.progT = 0; } else r.progT += dt;
      } else if (r.maxX > r.progMark + 1) { r.progMark = r.maxX; r.progT = 0; }
      if (r.stallT >= T.stuckTime || r.upsideT >= T.upsideTime || r.progT >= T.noProgressTime) {
        r.phase = 'stuck';
        r.stuck = true;
        r.upsideDown = upCos < 0.25;
        r.stuckX = r.maxX;
        r.stallT = 0; r.upsideT = 0; r.progT = 0;
        emit({ type: 'stuck', upsideDown: r.upsideDown, x: Math.round(v.com.x * 10) / 10 });
        popup(r, 'STUCK!', 0.5, LANE_BIG, '#ff9b6b', 1.15, false, 1.5, 'big');
      }
    } else if (r.phase === 'stuck') {
      r.upsideDown = upCos < 0.25;
      if (upCos > 0.6 && r.maxX > r.stuckX + 2.5 && v.speed > 1) {
        r.phase = 'ride';
        r.stuck = false;
        r.progMark = r.maxX; r.progT = 0;
        emit({ type: 'unstuck' });
      }
    }
  }
  function winchTarget(r) {
    const c = r.course, v = r.me;
    let tx = v.com.x + T.winchDist;
    for (let k = 0; k < 4; k++) {
      const w = c.waterAt(tx) || c.waterAt(tx - 2) || c.waterAt(tx + 2);
      if (w) tx = w.x1 + 2.5;
      const kk = c.kickerAt(tx, 1.5);
      if (kk) tx = kk.x2 + 2;
    }
    const g = r.gates[r.gateIndex];
    if (g && !g.done && tx > g.x - T.gateTakeover - 1.5) tx = Math.max(v.com.x + 1, g.x - T.gateTakeover - 2);
    return tx;
  }
  function winchStart(r) {
    const v = r.me;
    const tx = winchTarget(r);
    const c = r.course;
    const ta = Math.atan(c.groundSlope(tx));
    const ch = v.chassis;
    const a0 = v.ang;
    const cs = Math.cos(a0), sn = Math.sin(a0);
    const ox = ch.position.x / S - (cs * HULL_C[0] - sn * HULL_C[1]);
    const oy = -ch.position.y / S - (sn * HULL_C[0] + cs * HULL_C[1]);
    r.winchAnim = { t: 0, x0: ox, y0: oy, a0, x1: tx, y1: c.groundY(tx) + 0.06, a1: ta, ax: tx + 6.5, ay: c.groundY(tx + 6.5) };
    r.winchShow = r.winchAnim;
    r.winchShowT = r.realT;
    if (v.boostOn) { v.boostOn = false; emit({ type: 'boost', on: false }); }
  }
  function winchPoseAt(r, u) {
    const W = r.winchAnim;
    const e = smoothstep(0, 1, u);
    const x = W.x0 + (W.x1 - W.x0) * e;
    const hop = Math.sin(Math.PI * u) * T.winchHop;
    const y = W.y0 + (W.y1 - W.y0) * e + hop;
    const da = wrapPi(W.a1 - W.a0);
    const a = W.a0 + da * smoothstep(0.05, 0.85, u);
    placeVehicle(r.me, x, y, a);
  }
  function winchStep(r, dt) {
    const W = r.winchAnim, v = r.me;
    W.t += dt;
    const u = Math.min(1, W.t / T.winchDur);
    winchPoseAt(r, u);
    if (u >= 1) {
      r.winchAnim = null;
      measure(v);
      const sl = r.course.groundSlope(W.x1), n = Math.hypot(1, sl);
      addVelAll(v, T.winchPush / n, (T.winchPush * sl) / n);
      r.phase = 'ride';
      r.stuck = false;
      r.upsideDown = false;
      r.winches++;
      r.stallT = 0; r.upsideT = 0; r.progT = 0;
      r.progMark = Math.max(r.maxX, v.com.x);
      v.air = false; v.noContactT = 0;
      v.prevAngle = v.chassis.angle;
      emit({ type: 'winched', x: Math.round(W.x1 * 10) / 10 });
      popup(r, 'WINCHED!', 0.5, LANE_SUB, '#7cf2ff', 0.75, false, 1.1, 'sub');
      for (let k = 0; k < 8; k++) particle(r, P_DUST, W.x1 + (Math.random() - 0.5) * 3, W.y1 + 0.1, (Math.random() - 0.5) * 3, Math.random() * 1.5, 0.3 + Math.random() * 0.3, r.dustCol, 0.6, 0.7);
    }
  }
  function winchPose(r) {
    const W = r.winchAnim;
    if (W) winchPoseAt(r, Math.min(1, W.t / T.winchDur));
  }

  // ---------- cash, rating, summary ----------
  function cashBreakdown(r) {
    const m = r.stats.coinMult;
    const distance = Math.round(T.cash.perM * r.distance * m);
    const air = Math.round(T.cash.airPerS * r.totalAir * m);
    const smash = Math.round(r.smashRaw * m);
    const gates = Math.round(r.gatesRaw * m);
    const quick = Math.round(r.quickRaw * m);
    const coins = Math.round(T.cash.coin * r.coins * m);
    const finish = r.finishCrossed ? Math.round(T.cash.finish * m) : 0;
    const flips = Math.round(r.flipRaw * m);
    const perfect = Math.round(r.perfectRaw * m);
    const place = r.race && r.finishCrossed ? Math.round((TR.placeCash[r.me.finishOrder - 1] || 0) * m) : 0;
    return { distance, air, smash, gates, quick, coins, finish, flips, perfect, place,
      total: distance + air + smash + gates + quick + coins + finish + flips + perfect + place };
  }
  function ratingOf(r) {
    const L = r.landings;
    const nl = L.perfect + L.good + L.hard + L.crash;
    if (r.race) {
      const place = r.finishCrossed ? r.me.finishOrder : 0;
      const medal = r.finishCrossed ? medalFor(r.trail.id, r.timeSec) : null;
      let score = [0, 50, 35, 20, 5][place] + ({ gold: 35, silver: 25, bronze: 15 }[medal] || 0) + Math.min(15, 5 * r.flips) - Math.min(15, 3 * r.crashes);
      // v1.2: the gate answers fold in (correct = full, fixed = half) when the race had gates
      if (r.gateAnswered) score = 0.85 * score + 15 * ((r.gateCorrect + 0.5 * r.gateFixed) / r.gateAnswered);
      score = Math.round(clamp(score, 0, 100));
      return { score, letter: score >= 90 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D', medal };
    }
    const reach = clamp(r.distance / r.course.length, 0, 1);
    const landQ = nl ? (L.perfect + 0.75 * L.good + 0.3 * L.hard) / nl : reach;
    const gateQ = r.gateAnswered ? (r.gateCorrect + 0.5 * r.gateFixed) / r.gateAnswered : reach;
    const score = Math.round(clamp(55 * reach + (r.finishCrossed ? 15 : 0) + 15 * gateQ + 15 * landQ - Math.min(10, 2 * r.winches), 0, 100));
    return { score, letter: score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D', medal: null };
  }
  function ridersOut(r) {
    return r.riders.map((v) => ({ name: v.name, paint: v.look.paint.id, x: Math.round(v.com.x * 10) / 10, place: v.place, finished: v.finished,
      timeSec: v.finished ? Math.round(v.finishTime * 100) / 100 : null, me: v.me, crashed: v.crashed }));
  }
  function endRun(r, reason) {
    if (r.phase === 'done') return;
    const me = r.me;
    r.phase = 'done';
    r.endReason = reason;
    if (me.boostOn) { me.boostOn = false; emit({ type: 'boost', on: false }); }
    r.winchAnim = null;
    const cash = cashBreakdown(r);
    const rt = ratingOf(r);
    const place = r.race ? (r.finishCrossed ? me.finishOrder : me.place) : 1;
    const summary = {
      distance: Math.round(r.distance * 10) / 10,
      durationSec: Math.round(r.rideT * 10) / 10,
      airTime: Math.round(r.totalAir * 100) / 100,
      flips: r.flips,
      smashed: r.smashed,
      coins: r.coins,
      maxSpeedKmh: Math.round(r.maxKmh),
      gates: { answered: r.gateAnswered, correct: r.gateCorrect, quick: r.gateQuick, fixed: r.gateFixed },
      winches: r.winches,
      finishCrossed: r.finishCrossed,
      cash,
      rating: rt.letter,
      ratingScore: rt.score,
      // v1.1 race
      race: r.race,
      place,
      timeSec: Math.round(r.timeSec * 100) / 100,
      medal: rt.medal,
      crashes: r.crashes,
      riders: ridersOut(r),
      // v1 additions
      endReason: reason,
      landings: { ...r.landings },
      gatesTotal: r.gates.length,
      length: r.course.length,
    };
    r.summary = summary;
    emit({ type: 'finish', summary });
  }

  // ---------- camera ----------
  function updateCamera(r, dt, snap) {
    const v = r.me, c = v.com;
    const sp = v.crashed ? 6 : v.speed;
    const gy = r.course.groundY(c.x);
    const alt = Math.max(0, c.y - gy - 1);
    let visH;
    if (r.race) visH = clamp(12.5 + sp * 0.22 + alt * 0.38, 12.5, 26) / r.zoomPunch;
    else { visH = clamp(11 + sp * 0.28 + alt * 0.55, 11, 30); if (r.phase === 'gate') visH = 12; }
    const portrait = view.H > view.W;
    const z = portrait ? view.W / (visH * 1.05) : Math.min(view.H / visH, view.W / (visH * 1.75));
    const visW = view.W / z, visHH = view.H / z;
    const lead = r.race ? clamp(c.vx * 0.32, -6, 9) : clamp(c.vx * 0.35, -6, 9);
    let tx = c.x + lead + visW * (portrait ? 0.08 : 0.12);
    const aheadY = r.course.groundY(c.x + visW * 0.25);
    let ty = c.y + 1.4 + (aheadY - gy) * 0.35 + clamp(c.vy * 0.15, -3, 3);
    if (r.winchAnim) { tx = (r.winchAnim.x0 + r.winchAnim.ax) / 2; ty = r.winchAnim.y1 + 2; }
    ty = clamp(ty, c.y - visHH * 0.28, c.y + visHH * 0.3);
    if (snap) { cam.x = tx; cam.y = ty; cam.z = z; return; }
    const kp = 1 - Math.exp(-dt * (r.race ? 6 : 5)), kz = 1 - Math.exp(-dt * (r.zoomPunch > 1.01 ? 5 : 1.8));
    cam.x += (tx - cam.x) * kp;
    cam.y += (ty - cam.y) * kp;
    cam.z = Math.exp(Math.log(cam.z) + (Math.log(z) - Math.log(cam.z)) * kz);
    const hw = view.W / cam.z / 2 - 2.5, hh = view.H / cam.z / 2 - 2;
    cam.x = clamp(cam.x, c.x - hw, c.x + hw);
    cam.y = clamp(cam.y, c.y - hh, c.y + hh);
  }

  function updateFx(r, dt) {
    const ps = r.particles;
    let j = 0;
    for (let i = 0; i < r.np; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === P_DUST) { p.vx *= 1 - 1.5 * dt; p.vy = p.vy * (1 - 1.5 * dt) + 0.6 * dt; }
      else if (p.type === P_CONFETTI) { p.vx *= 1 - 2.2 * dt; p.vy = p.vy * (1 - 2.2 * dt) - 3 * dt; p.a += dt * 9; }
      else if (p.type === P_RING) { /* expands in draw */ }
      else if (p.type === P_SNOW) { p.vx *= 1 - 1.2 * dt; p.vy -= 3 * dt; }
      else { p.vy -= G * dt; p.a += dt * 7; }
      if (j !== i) { ps[i] = ps[j]; ps[j] = p; }
      j++;
    }
    r.np = j;
    for (const p of r.popups) p.t += dt;
    for (let i = r.popups.length - 1; i >= 0; i--) if (r.popups[i].t >= r.popups[i].life) r.popups.splice(i, 1);
    r.shake *= Math.exp(-dt * 7);
    const shk = reducedMotion ? 0 : r.shake * shakeMul;
    if (shk < 0.2) { cam.sx = 0; cam.sy = 0; } else { cam.sx = (Math.random() - 0.5) * 2 * shk; cam.sy = (Math.random() - 0.5) * 2 * shk; }
    r.flash *= Math.exp(-dt * 6);
    r.zoomPunch = 1 + (r.zoomPunch - 1) * Math.exp(-dt * (r.timeScale < 1 ? 0.5 : 3));
    const v = r.me;
    const inten = r.race ? clamp((v.speed - 16.7) / 14, 0, 1) : clamp((v.speed - 14) / 14, 0, 1);
    if (inten > 0) {
      const dx = v.com.vx / (v.speed || 1), dy = v.com.vy / (v.speed || 1);
      for (const l of r.speedLines) {
        l.x -= dx * dt * (1.5 + inten * 2.5);
        l.y += dy * dt * (1.5 + inten * 2.5);
        if (l.x < -0.1) { l.x += 1.2; l.y = Math.random(); }
        if (l.x > 1.1) { l.x -= 1.2; l.y = Math.random(); }
        if (l.y < -0.1) l.y += 1.2;
        if (l.y > 1.1) l.y -= 1.2;
      }
    }
  }

  // ---------- rendering ----------
  const vis = { x0: 0, x1: 0, y0: 0, y1: 0 };
  function toScreen(x, y) { return [(x - cam.x) * cam.z + view.W / 2 + cam.sx, view.H / 2 - (y - cam.y) * cam.z + cam.sy]; }
  function render() {
    const { W, H, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = run;
    if (!r) {
      ctx.fillStyle = '#7cc6ff';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const course = r.course, bd = r.bd, me = r.me;
    const t = r.realT;
    R.drawBackground(ctx, view, cam, bd, t);
    R.worldTransform(ctx, view, cam);
    const z = cam.z;
    vis.x0 = cam.x - (W / 2 + Math.abs(cam.sx)) / z; vis.x1 = cam.x + (W / 2 + Math.abs(cam.sx)) / z;
    vis.y0 = cam.y - (H / 2 + Math.abs(cam.sy)) / z; vis.y1 = cam.y + (H / 2 + Math.abs(cam.sy)) / z;
    const lw = clamp(z * 0.11, 1.3, 3) / z;
    R.drawDecor(ctx, course, bd, vis, lw);
    if (r.race) R.drawBerms(ctx, course, vis, lw);
    R.drawTerrain(ctx, course, bd, vis, lw, cam);
    R.drawRavines(ctx, course, bd, vis, lw);
    R.drawBridges(ctx, course, vis, lw);
    R.drawKickers(ctx, course, vis, lw);
    if (r.race) {
      R.drawCheckpoints(ctx, course, vis, lw, me.cpIndex);
      if (vis.x0 < 8) R.drawStartGate(ctx, course, lw, r.goT >= 0 ? clamp((t - r.gateDrop) / 0.35, 0, 1) : 0);
    } else if (vis.x0 < 0) R.drawStartSign(ctx, course, r.trail, lw);
    for (const g of r.gates) if (g.x > vis.x0 - 4 && g.x < vis.x1 + 2) R.drawGate(ctx, g, g.y, lw, g.open, t, bd.night);
    if (course.finishX > vis.x0 - 8 && course.finishX < vis.x1 + 8) R.drawFinish(ctx, course, lw, t);
    if (r.best > 1 && r.best < course.length - 2 && r.best > vis.x0 - 3 && r.best < vis.x1 + 3) R.drawBestFlag(ctx, course, r.best, lw, r.recordHit);
    for (const pr of r.props) {
      if (pr.smashed || pr.x < vis.x0 - 3 || pr.x > vis.x1 + 3) continue;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.ang);
      R.drawProp(ctx, pr.kind, lw, t, pr.id);
      ctx.restore();
    }
    const C = course.coins;
    for (let i = Math.max(0, r.coinLo - 2); i < C.length; i++) {
      const cn = C[i];
      if (cn.x > vis.x1 + 1) break;
      if (r.coinHit[i] || cn.x < vis.x0 - 1) continue;
      R.drawCoin(ctx, cn, t, lw);
    }
    if (bd.night && r.phase !== 'done') {
      for (const v of r.riders) {
        if (v.crashed || v.com.x < vis.x0 - 16 || v.com.x > vis.x1 + 2) continue;
        localToWorld(v, VEHICLE.headlight[0], VEHICLE.headlight[1], tmp2);
        R.drawHeadlights(ctx, course, tmp2[0], tmp2[1], v.ang, true);
      }
    }
    const ws = r.winchShow;
    if (ws && (r.winchAnim || r.realT - r.winchShowT < T.winchDur + 0.5)) {
      localToWorld(me, VEHICLE.winchHook[0], VEHICLE.winchHook[1], tmp2);
      R.drawWinch(ctx, ws.ax, ws.ay, tmp2[0], tmp2[1], lw, r.winchAnim ? clamp(ws.t / 0.3, 0, 1) : 1 - clamp((r.realT - r.winchShowT - T.winchDur) / 0.5, 0, 1));
    }
    // AI riders: ghosts (they never touch you) with a name tag, then the player on top
    for (let i = r.riders.length - 1; i >= 0; i--) {
      const v = r.riders[i];
      if (v.com.x < vis.x0 - 3 || v.com.x > vis.x1 + 3) continue;
      if (!v.me) ctx.globalAlpha = 0.62;
      drawRanger(r, v, lw);
      ctx.globalAlpha = 1;
      if (!v.me) R.drawNameTag(ctx, v.name, v.com.x, v.com.y + 2.2, v.look.helmet);
      if (v.crashed) drawThrown(v, lw);
    }
    R.drawWater(ctx, course, bd, vis, lw, t);
    R.drawParticles(ctx, r.particles, r.np, vis);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R.drawWeather(ctx, view, cam, bd, t);
    const inten = (r.race ? clamp((me.speed - 16.7) / 14, 0, 1) : clamp((me.speed - 14) / 14, 0, 1)) * (r.phase === 'ride' ? 1 : 0);
    if (inten > 0) R.drawSpeedLines(ctx, view, r.speedLines, inten, me.com.vx / (me.speed || 1), me.com.vy / (me.speed || 1));
    R.drawFlash(ctx, view, r.flash, '#ffffff');
    R.drawPopups(ctx, r.popups, toScreen, view);
  }

  const drawState = { t: 0, nitroOn: false, speed: 0, lw: 0.05, wheels: null, lights: false, rim: null, noDriver: false };
  function drawRanger(r, v, lw) {
    const ch = v.chassis;
    const a = -ch.angle;
    const c = Math.cos(a), s = Math.sin(a);
    const px = ch.position.x / S, py = -ch.position.y / S;
    const ox = px - (c * HULL_C[0] - s * HULL_C[1]), oy = py - (s * HULL_C[0] + c * HULL_C[1]);
    for (let i = 0; i < 2; i++) {
      const w = v.wheels[i];
      const dx = w.position.x / S - ox, dy = -w.position.y / S - oy;
      const L = v.wheelLocal[i];
      L.x = c * dx + s * dy; L.y = -s * dx + c * dy; L.a = -w.angle - a;
    }
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(a);
    drawState.t = r.realT;
    drawState.nitroOn = v.boostOn;
    drawState.speed = v.vf;
    drawState.lw = lw;
    drawState.wheels = v.wheelLocal;
    drawState.lights = r.bd.night;
    drawState.rim = r.bd.night && v.me ? 'rgba(200,215,255,0.3)' : null;
    drawState.noDriver = v.crashed;
    drawVehicle(ctx, v.look, drawState);
    ctx.restore();
    if (v.invulnT > 0 && v.me && Math.sin(r.realT * 30) > 0) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(v.com.x, v.com.y, 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function drawThrown(v, lw) {
    const d = v.driver, h = v.helmetObj;
    if (d) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); drawRider(ctx, v.look, lw, false); ctx.restore(); }
    if (h) { ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); drawHelmet(ctx, v.look, lw, 0, 0); ctx.restore(); }
  }

  // ---------- loop ----------
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    const r = run;
    const tA = performance.now();
    if (r && !paused) {
      acc += dt * simSpeed;
      let n = 0;
      const maxSteps = MAX_STEPS_PER_FRAME * Math.ceil(simSpeed);
      while (acc >= STEP && n < maxSteps && run === r) {
        const t0 = performance.now();
        tick(); acc -= STEP; n++;
        const tt = performance.now() - t0;
        if (tt > perf.maxTick) perf.maxTick = tt;
      }
      perf.ticks += n;
      if (n >= maxSteps) acc = 0;
      if (run === r) {
        r.realT += dt;
        if (!r.frozen || r.gateGlide) updateFx(r, dt);
        updateCamera(r, dt, false);
      }
    }
    const tB = performance.now();
    try { render(); } catch (e) { console.error('[engine] render failed', e); }
    const tC = performance.now();
    perf.frames++; perf.sim += tB - tA; perf.draw += tC - tB;
    if (tC - tA > perf.max) perf.max = tC - tA;
    if (tC - tB > perf.maxDraw) perf.maxDraw = tC - tB;
  }
  raf = requestAnimationFrame(frame);

  // ---------- public API ----------
  function getState() {
    const r = run;
    if (!r) {
      return { phase: 'done', distance: 0, speedKmh: 0, boost: 0, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false,
        gateIndex: 0, gatesTotal: 0, stuck: false, upsideDown: false, coins: 0, winches: 0, progress: 0, x: 0,
        place: 1, timeSec: 0, riders: [], crashed: false, countdown: 0, race: false };
    }
    const v = r.me;
    return {
      phase: r.phase,
      distance: Math.round(r.distance * 10) / 10,
      speedKmh: Math.round(v.speed * 3.6),
      boost: v.tank > 0 ? clamp(v.fuel / v.tank, 0, 1) : 0,
      airTime: v.air ? Math.round(v.airTime * 100) / 100 : 0,
      flips: r.flips,
      smashed: r.smashed,
      cash: cashBreakdown(r).total,
      finishCrossed: r.finishCrossed,
      gateIndex: r.gateIndex,
      gatesTotal: r.gates.length,
      stuck: r.phase === 'stuck',
      upsideDown: r.phase === 'stuck' && r.upsideDown,
      // additions
      coins: r.coins,
      winches: r.winches,
      progress: clamp(r.distance / r.course.length, 0, 1),
      x: Math.round(v.com.x * 10) / 10,
      race: r.race,
      place: r.race ? (v.finished ? v.finishOrder : v.place) : 1,
      timeSec: Math.round(r.timeSec * 100) / 100,
      riders: ridersOut(r),
      crashed: v.crashed,
      // v1.2 gates: gliding to a sign (the race is already frozen), or held at the line after a fixed answer
      gateApproach: !!r.gateApproach,
      gateHold: r.race && v.hold && v.releaseT > 0 ? Math.max(0, Math.round((v.releaseT - r.t) * 100) / 100) : 0,
      frozen: !!r.frozen,
      countdown: r.race && r.goT < 0 ? Math.max(0.01, Math.round((TR.goAt - r.cdT) * 100) / 100) : 0,
      length: r.course.length,
    };
  }

  return {
    start,
    setInput(next = {}) {
      input = {
        gas: next.gas !== undefined ? !!next.gas : input.gas,
        brake: next.brake !== undefined ? !!next.brake : input.brake,
        boost: next.boost !== undefined ? !!next.boost : next.nitro !== undefined ? !!next.nitro : input.boost,
      };
    },
    openGate(result = {}) {
      const r = run;
      if (!r || r.phase !== 'gate') return false;
      const g = r.gates[r.gateIndex];
      if (!g) return false;
      const v = r.me;
      const quickIn = !!result.quick && !result.fixed;
      const res = { correct: !!result.correct || quickIn, quick: quickIn, fixed: !!result.fixed && !result.correct && !quickIn };
      r.gateAnswered++;
      let raw = 0, quick = 0, fuel = 0;
      if (res.correct) { r.gateCorrect++; raw = T.cash.gate; fuel = T.fuel.correct; }
      if (res.quick) { r.gateQuick++; quick = T.cash.quick; fuel = T.fuel.quick; }
      if (res.fixed) { r.gateFixed++; raw = T.cash.fixed; fuel = r.race ? 0 : T.fuel.fixed; } // a race: no boost for a fixed answer
      r.gatesRaw += raw;
      r.quickRaw += quick;
      v.fuel = Math.min(v.tank, v.fuel + v.tank * fuel);
      const m = r.stats.coinMult;
      const cash = Math.round(raw * m) + Math.round(quick * m);
      openGateNow(r, g, res);
      if (r.race) {
        // the gate drops: everyone resumes at once (fixed: the rivals get a head start while you wait at the line)
        r.phase = 'ride';
        r.frozen = false;
        const hold = res.fixed ? (Number.isFinite(Number(result.holdSec)) ? clamp(Number(result.holdSec), 0, 10) : 1.5) : 0;
        if (hold > 0) { v.hold = true; v.releaseT = r.t + hold; } else releasePlayer(r);
        if (res.quick) v.burstT = 1.2;
        emit({ type: 'gateOpen', index: g.index, cash, fuel, correct: res.correct, quick: res.quick, fixed: res.fixed, holdSec: hold });
        if (cash > 0) popup(r, '+$' + cash + (res.quick ? ' QUICK!' : ''), 0.5, LANE_SUB, '#ffe14a', 0.85, false, 1.4, 'sub');
        if (res.quick) popup(r, 'BOOST!', 0.5, LANE_BIG, '#7cf2ff', 1.2, false, 1.1, 'big');
        else if (hold > 0) popup(r, 'WAIT...', 0.5, LANE_BIG, '#ffb36b', 1.0, false, hold, 'big');
        return true;
      }
      r.phase = 'ride';
      r.progMark = r.maxX; r.progT = 0; r.stallT = 0;
      if (res.correct || res.fixed) v.burstT = res.quick ? 0.7 : 0.5;
      addVelAll(v, v.fx * (res.correct || res.fixed ? T.gateBurst * 0.4 : 0), v.fy * (res.correct || res.fixed ? T.gateBurst * 0.4 : 0));
      emit({ type: 'gateOpen', index: g.index, cash, fuel, correct: res.correct, quick: res.quick, fixed: res.fixed });
      if (cash > 0) popup(r, '+$' + cash, 0.5, LANE_SUB, '#ffe14a', 0.75, false, 1.3, 'sub');
      if (res.quick) popup(r, 'QUICK!', 0.5, LANE_BIG, '#7cf2ff', 1.1, false, 1.2, 'big');
      return true;
    },
    winch(ok) {
      const r = run;
      if (!ok || !r || r.race || r.phase !== 'stuck' || r.winchAnim) return false;
      winchStart(r);
      return true;
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); acc = 0; },
    stop() {
      if (run && run.phase !== 'done') endRun(run, 'stopped');
      paused = true;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      teardown();
    },
    getState,
    // --- not part of the contract: test / debug helpers ---
    debugStep(n = 1) {
      for (let i = 0; i < n && run; i++) { tick(); if (run) { run.realT += STEP; if (!run.frozen || run.gateGlide) updateFx(run, STEP); updateCamera(run, STEP, false); } }
      return getState();
    },
    debugPerf(reset = false) {
      const out = { ...perf };
      if (reset) { perf.frames = 0; perf.sim = 0; perf.draw = 0; perf.max = 0; perf.ticks = 0; perf.maxTick = 0; perf.maxDraw = 0; }
      return out;
    },
    debugInfo() {
      const r = run;
      if (!r) return null;
      const v = r.me;
      return { x: v.com.x, y: v.com.y, vx: v.com.vx, vy: v.com.vy, vf: v.vf, frontX: v.wheels[1].position.x / S, rearX: v.wheels[0].position.x / S,
        ang: v.ang, omega: v.omega, phase: r.phase, air: v.air, crashed: v.crashed, flightRot: v.flightRot, cpIndex: v.cpIndex,
        bodies: Composite.allBodies(r.world).length, particles: r.np, props: r.props.length, chunks: r.chunks.size, fuel: v.fuel, tank: v.tank,
        surf: SURF_IDS[v.surf], inWater: v.inWater, gateMode: r.gateMode, endReason: r.endReason, upCos: Math.cos(v.ang),
        gates: r.gates.map((g) => ({ x: g.x, done: g.done })), landings: { ...r.landings }, cam: { ...cam }, perf: { ...perf },
        winch: !!r.winchAnim, slope: r.course.groundSlope(v.com.x), groundY: r.course.groundY(v.com.x), view: { W: view.W, H: view.H },
        timeScale: r.timeScale, aiLevel: r.aiLevel, vTop: v.vTop, lean: v.lastLean, w0: v.lastW0 };
    },
    debugCourse() { return run ? run.course : null; },
    debugRiders() {
      const r = run;
      return r ? r.riders.map((v) => ({ name: v.name, x: v.com.x, vf: v.vf, air: v.air, crashed: v.crashed, crashes: v.crashes, finished: v.finished, finishTime: v.finishTime, place: v.place, power: v.stats.power, vTop: v.vTop })) : [];
    },
    // move the player to x (upright, on the ground) — for tests and screenshots; tilt (rad) drops it rotated from 2.6 m
    debugTeleport(x, vx = 0, tilt = 0) {
      const r = run;
      if (!r) return;
      const v = r.me;
      const a = Math.atan(r.course.groundSlope(x));
      placeVehicle(v, x, r.course.groundY(x) + (tilt ? 2.6 : 0.06), a + tilt);
      if (vx) addVelAll(v, vx * Math.cos(a), vx * Math.sin(a));
      measure(v);
      r.maxX = Math.max(r.maxX, x);
      r.progMark = r.maxX;
      while (r.gateIndex < r.gates.length && r.gates[r.gateIndex].x < x + 2) openGateNow(r, r.gates[r.gateIndex], null);
      r.coinLo = 0;
      if (r.phase === 'parked') {
        if (r.race) goNow(r); else { r.phase = 'ride'; r.launched = true; }
        v.hold = false;
      }
      if (r.race) { const cps = r.course.checkpoints; while (v.cpIndex + 1 < cps.length && x >= cps[v.cpIndex + 1].x) v.cpIndex++; }
      v.air = false; v.prevAngle = v.chassis.angle;
      manageChunks(r);
      updateCamera(r, 1, true);
    },
  };
}
