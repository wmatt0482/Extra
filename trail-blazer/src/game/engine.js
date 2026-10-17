// Trail Blazer gameplay engine (SPEC §3). A hill-climb driving model on Matter.js (global `Matter`):
// 1 m = 30 px, fixed 60 Hz step (2 substeps), y-down in physics space; game logic and drawing in meters, +y UP.
//
// The arcade drive model: the wheels are frictionless rollers on the terrain and the engine applies every
// tangential force itself (drive from stats.power along the ground, capped by traction = mu x grip x trail.grip x
// surface x g cos; brake / reverse; rolling, mud, sand and water drag), so the same inputs always give the same
// ride and the numbers tune cleanly. Gravity, the spring suspension, landings and rollovers are Matter's.
//
// Contract (SPEC §3): createGame(canvas, { onEvent, simSpeed?, reducedMotion? }) → { start, setInput, openGate,
// winch, pause, resume, stop, destroy, getState }.
//   start({ trail, stats, seed?, paint?, decal?, bestDistance?, gates?, shake?, helmet? }): seed defaults to
//     trail.seed; gates: a count (0 = no gates, the v1 app) or omitted for the trail default. The tank starts full.
//   setInput({ gas, brake, boost }) (`nitro` is accepted as an alias of boost).
//   openGate({ correct, quick, fixed }) → true when a parked gate opened (false otherwise).
//   winch(ok) → true when the winch started (only in phase 'stuck'); the 'winched' event fires ~1.2 s later.
//   stop() ends the ride (emits finish once) and freezes it on screen; destroy() releases everything.
// Boost fuel: gates (correct +40 % of the tank, quick +60 %, fixed +15 %), trail coins (+8 % each) and landings
// after >= 1 s of air (perfect +25 %, good +12 %).
// Additions to the contract (nothing renamed or removed):
//   events: `unstuck` (driven out of a stuck spot without the winch), `record` { distance } (passed bestDistance);
//     payloads: stuck { upsideDown, x }, winched { x }, splash { x }, gateOpen { index, cash, fuel, correct, quick,
//     fixed }, air { airTime } / land { quality } after every flight >= 0.3 s.
//   summary: cash.finish (the $300 finish bonus, so the parts add up), endReason ('finish' | 'stopped' | 'fell' |
//     'error'), landings { perfect, good, hard, crash }, gatesTotal, length.
//   getState(): coins, winches, progress (0..1), x.
//   debug (not contract): debugStep(n), debugInfo(), debugPerf(reset), debugCourse(), debugTeleport(x, vx, tilt).
// Rating: score = 55 x reach + 15 finish + 15 x gate quality (reach when no gates) + 15 x landing quality
//   - 2 per winch (max 10) → S >= 90, A >= 75, B >= 55, C >= 35, else D.

import { createCourse, CHUNK, START_X, SURF_IDS } from './course.js';
import { VEHICLE, resolveLook, drawVehicle } from './vehicle.js';
import * as R from './render.js';
import { OBSTACLE_KINDS, SURFACES } from '../data/trails.js';
import { TAU, clamp, wrapPi, smoothstep, shade } from './util.js';

const S = 30; // px per meter (physics space)
const STEP = 1 / 60;
const STEP_MS = 1000 / 60;
const SUBSTEPS = 2;
const MAX_STEPS_PER_FRAME = 4;
const U = S / 60; // m/s -> Matter velocity units (px per 16.67 ms)
const G = 9.81;
const CAT_TERRAIN = 0x1, CAT_CAR = 0x2, CAT_PROP = 0x4, CAT_GATE = 0x8;
const MAX_PARTICLES = 320;
const P_DUST = 0, P_MUD = 1, P_SNOW = 2, P_SPLASH = 3, P_CHUNK = 4, P_CONFETTI = 5, P_SPARK = 6, P_RING = 7;

export const TUNING = {
  driveA: 3.9, // m/s^2 x power from standstill (fades to 0 at the top speed)
  vTop: 12.5, vTopExp: 0.6, // top speed on the flat (m/s) x power^vTopExp
  mu: 0.75, // traction coefficient x grip x trail.grip x surface grip
  brakeA: 9, reverseA: 2.6, reverseV: 4,
  rollBase: 0.3, airDrag: 0.0035,
  stallDamp: 6, // 1/s: wheels spinning on a too-steep slope dig in (the ride settles instead of rocking)
  wheelie: 0.1, // nose-up spin (rad/s^2) per m/s^2 of drive
  boostA: 8, boostSec: 1.6, boostVMul: 1.75, // thrust (m/s^2) x boostPower, tank (s) x boostCapacity, speed cap x vTop
  airTilt: 3.4, airTiltMax: 2.6, // in-air GAS = nose up / BRAKE = nose down (rad/s^2, rad/s)
  landK: 30, landD: 8, landLook: 0.65, // landing assist: PD gains, look-ahead (s) at suspension 1 (+0.45 s at 2.4)
  impactThr: 7.5, // m/s into the ground the stock suspension soaks up cleanly (x suspension)
  stuckSpeed: 0.6, stuckTime: 2.5, upsideTime: 1.5, noProgressTime: 7,
  gateZone: 32, gateArriveV: 3.5, gateTakeover: 3, gateStop: 1.25, gateBurst: 5,
  winchDist: 6, winchDur: 1.15, winchHop: 1.1, winchPush: 2.2,
  cash: { perM: 2, airPerS: 30, gate: 120, quick: 80, fixed: 40, coin: 10, finish: 300 },
  fuel: { correct: 0.4, quick: 0.6, fixed: 0.15, coin: 0.08, perfect: 0.25, good: 0.12, landMinAir: 1.0 },
  minFlight: 0.3, // s of air before a hop counts as a flight (air cash, land event)
};
const T = TUNING;
const SURF_LIST = SURF_IDS.map((id) => SURFACES[id]);
const LANE_BIG = 0.62, LANE_SUB = 0.72;
const CONFETTI = ['#ff4d6d', '#ffd23f', '#4dd2ff', '#7dff6b', '#c77dff', '#ffffff', '#ff9b2e'];
const NO_INPUT = { gas: false, brake: false, boost: false };

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
  let wallT = 0;
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

  // ---------- body helpers ----------
  function addV(b, dx, dy) {
    const v = b.velocity;
    Body.setVelocity(b, { x: v.x + dx * U, y: v.y - dy * U });
  }
  function addVelAll(r, dx, dy) { for (let i = 0; i < r.parts.length; i++) addV(r.parts[i], dx, dy); }
  function measure(r) {
    let m = 0, x = 0, y = 0, vx = 0, vy = 0;
    for (let i = 0; i < r.parts.length; i++) {
      const b = r.parts[i];
      m += b.mass;
      x += b.position.x * b.mass; y += b.position.y * b.mass;
      vx += b.velocity.x * b.mass; vy += b.velocity.y * b.mass;
    }
    r.com.x = x / m / S; r.com.y = -y / m / S;
    r.com.vx = vx / m / U; r.com.vy = -vy / m / U;
    r.speed = Math.hypot(r.com.vx, r.com.vy);
    r.ang = -r.chassis.angle;
    r.omega = -r.chassis.angularVelocity * 60;
    r.fx = Math.cos(r.ang); r.fy = Math.sin(r.ang);
    r.vf = r.com.vx * r.fx + r.com.vy * r.fy;
  }
  function setOmegaAll(r, w) {
    const dw = w - r.omega;
    if (!dw) return;
    for (let i = 0; i < r.parts.length; i++) {
      const b = r.parts[i];
      const rx = b.position.x / S - r.com.x, ry = -b.position.y / S - r.com.y;
      addV(b, -dw * ry, dw * rx);
      Body.setAngularVelocity(b, b.angularVelocity - dw / 60);
    }
    r.omega = w;
  }
  // vehicle-local (VEHICLE coords) -> world, from the chassis pose
  function localToWorld(r, lx, ly, out) {
    const ch = r.chassis;
    const dx = lx - HULL_C[0], dy = ly - HULL_C[1];
    const c = Math.cos(r.ang), s = Math.sin(r.ang);
    out[0] = ch.position.x / S + c * dx - s * dy;
    out[1] = -ch.position.y / S + s * dx + c * dy;
    return out;
  }
  const tmp2 = [0, 0];
  function bumpStops(r) {
    const ch = r.chassis;
    const c = Math.cos(ch.angle), s = Math.sin(ch.angle);
    const cv = ch.velocity, cw = ch.angularVelocity;
    for (let i = 0; i < 2; i++) {
      const w = r.wheels[i], rest = r.wheelRest[i];
      const dx = w.position.x - ch.position.x, dy = w.position.y - ch.position.y;
      const lx = c * dx + s * dy, ly = -s * dx + c * dy;
      const ox = lx - rest.x, oy = ly - rest.y;
      const cx = clamp(ox, -0.16 * S, 0.16 * S), cy = clamp(oy, -0.24 * S, 0.16 * S); // up is -y
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
  function manageChunks(r) {
    const x = r.com.x;
    const lo = Math.floor((x - 60) / CHUNK), hi = Math.floor((x + 130) / CHUNK);
    for (let ci = lo; ci <= hi; ci++) if (!r.chunks.has(ci)) buildChunk(r, ci);
    let removed = false;
    for (const [ci, ch] of r.chunks) {
      if (ci < lo - 1 || ci > hi + 1) {
        Composite.remove(r.world, ch.bodies.filter((b) => !b.plugin.tb.removed));
        r.chunks.delete(ci);
        removed = true;
      }
    }
    if (removed) {
      const live = new Set();
      for (const ch of r.chunks.values()) for (const p of ch.props) live.add(p);
      r.props = r.props.filter((p) => live.has(p));
    }
  }

  // ---------- vehicle ----------
  function buildVehicle(r, ox) {
    const st = r.stats, V = VEHICLE;
    const oy = r.course.groundY(ox) + 0.04;
    const cx = ox + HULL_C[0], cy = oy + HULL_C[1];
    const verts = Vertices.clockwiseSort(V.hull.map(([x, y]) => ({ x: (ox + x) * S, y: -(oy + y) * S })));
    const group = Body.nextGroup(true);
    const filter = () => ({ group, category: CAT_CAR, mask: CAT_TERRAIN | CAT_PROP | CAT_GATE });
    const chassis = Body.create({
      position: { x: cx * S, y: -cy * S }, vertices: verts,
      friction: 0.5, frictionStatic: 0.6, frictionAir: 0, restitution: 0.05, collisionFilter: filter(), label: 'chassis',
    });
    chassis.plugin.tb = { t: 'car', i: 0 };
    Body.setMass(chassis, 9);
    const wheels = [], cons = [];
    V.wheels.forEach((w, k) => {
      const wb = Bodies.circle((ox + w.x) * S, -(oy + w.y) * S, w.r * S, {
        friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, collisionFilter: filter(), label: 'wheel',
      }, 22);
      wb.plugin.tb = { t: 'car', i: k + 1 };
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
    r.chassis = chassis;
    r.wheels = wheels;
    r.wheelRest = V.wheels.map((w) => ({ x: (w.x - HULL_C[0]) * S, y: -(w.y - HULL_C[1]) * S }));
    r.cons = cons;
    r.parts = [chassis, ...wheels];
    r.contacts = [false, false, false];
    r.wheelAgo = [9, 9, 9];
    Composite.add(r.world, [chassis, ...wheels, ...cons]);
  }
  // settle the suspension, then hold that pose (a parked vehicle never creeps)
  function settle(r, n) {
    for (let i = 0; i < n * SUBSTEPS; i++) {
      Engine.update(r.engine, STEP_MS / SUBSTEPS);
      for (const b of r.parts) Body.setVelocity(b, { x: 0, y: b.velocity.y });
    }
    for (const b of r.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
    measure(r);
  }
  function capturePose(r) {
    for (let i = 0; i < r.parts.length; i++) {
      const b = r.parts[i], P = r.pose[i];
      P.x = b.position.x; P.y = b.position.y; P.a = b.angle;
    }
  }
  function holdPose(r) {
    for (let i = 0; i < r.parts.length; i++) {
      const b = r.parts[i], P = r.pose[i];
      Body.setPosition(b, { x: P.x, y: P.y });
      Body.setAngle(b, P.a);
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
    }
  }
  // place the whole vehicle: origin (ground point under the centre) at (x, y), rotated by ang (world, CCW)
  function placeVehicle(r, x, y, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const px = x + c * HULL_C[0] - s * HULL_C[1], py = y + s * HULL_C[0] + c * HULL_C[1];
    Body.setPosition(r.chassis, { x: px * S, y: -py * S });
    Body.setAngle(r.chassis, -ang);
    for (let i = 0; i < 2; i++) {
      const w = VEHICLE.wheels[i];
      const wx = x + c * w.x - s * w.y, wy = y + s * w.x + c * w.y;
      Body.setPosition(r.wheels[i], { x: wx * S, y: -wy * S });
    }
    for (const b of r.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
  }

  // ---------- run lifecycle ----------
  function start(cfg = {}) {
    const trail = cfg.trail;
    if (!trail || !trail.length) throw new Error('game.start needs { trail, stats, seed }');
    teardown();
    const seed = cfg.seed != null && cfg.seed !== '' ? (Number(cfg.seed) | 0) >>> 0 : (trail.seed | 0) >>> 0;
    const stats = statsArg(cfg.stats);
    const course = createCourse(trail, seed, { gates: cfg.gates });
    const bd = R.createBackdrop(trail, seed);
    const look = resolveLook({ paint: cfg.paint || 'sage', decal: cfg.decal || 'none', helmet: cfg.helmet });
    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: (G * S) / 1e6 },
      positionIterations: 8, velocityIterations: 8, constraintIterations: 4, enableSleeping: false,
    });
    const tank = Math.max(0.3, T.boostSec * stats.boostCapacity);
    const r = {
      trail, stats, seed, course, bd, engine, world: engine.world, look,
      trailGrip: trail.grip || 1,
      phase: 'parked', t: 0, realT: 0, rideT: 0,
      com: { x: 0, y: 0, vx: 0, vy: 0 }, speed: 0, ang: 0, omega: 0, fx: 1, fy: 0, vf: 0,
      maxX: 0, distance: 0, maxKmh: 0,
      air: false, noContactT: 0, airTime: 0, flightRot: 0, flipMark: 0, prevAngle: 0, totalAir: 0, flights: 0,
      flips: 0, smashed: 0, smashRaw: 0, coins: 0, landings: { perfect: 0, good: 0, hard: 0, crash: 0 }, lastLanding: null,
      tank, fuel: tank, boostOn: false, boostUsed: 0, burstT: 0,
      gates: course.gates.map((g) => ({ ...g, open: 0, openT: -1, body: null, done: false, result: null })),
      gateIndex: 0, gateMode: null, gateAnswered: 0, gateCorrect: 0, gateQuick: 0, gateFixed: 0, gatesRaw: 0, quickRaw: 0,
      stallT: 0, upsideT: 0, progT: 0, progMark: 0, stuck: false, upsideDown: false, stuckX: 0, stuckT: 0, winches: 0, winchAnim: null, winchShow: null,
      finishCrossed: false, finishT: 0, endReason: null, summary: null, launched: false,
      best: Number(cfg.bestDistance) > 0 ? Number(cfg.bestDistance) : 0, recordHit: false,
      chunks: new Map(), props: [], smashedIds: new Set(), pendingRemove: [], slowFactor: 1,
      coinLo: 0, coinHit: new Uint8Array(course.coins.length), coinPopT: -9,
      particles: [], np: 0, popups: [], shake: 0, flash: 0,
      surf: 0, inWater: false, splashT: -9,
      pose: [{ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }],
      speedLines: Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), len: 0.5 + Math.random(), w: 1 + Math.random() * 2 })),
      wheelSpin: [0, 0], wheelLocal: [{ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }],
      dustCol: bd.dust, imp: { t: 0, x: 0, ok: false }, pre: { vx: 0, vy: 0 },
    };
    for (let i = 0; i < MAX_PARTICLES; i++) r.particles.push({ type: 0, x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#fff', life: 0, max: 1, alpha: 1, a: 0, extra: 0 });
    run = r;
    buildVehicle(r, START_X);
    manageChunks(r);
    // gate walls (a few static bodies, removed when the gate opens)
    for (const g of r.gates) {
      g.body = Bodies.rectangle(g.x * S, -(g.y + 1.6) * S, 0.3 * S, 3.2 * S, {
        isStatic: true, friction: 0, frictionStatic: 0, collisionFilter: { category: CAT_GATE, mask: CAT_CAR }, label: 'gate',
      });
      g.body.plugin.tb = { t: 'gate', gate: g };
      Composite.add(r.world, g.body);
    }
    settle(r, 90);
    r.rideH = r.com.y - course.groundY(r.com.x);
    capturePose(r);
    r.prevAngle = r.chassis.angle;
    r.maxX = Math.max(0, r.com.x);
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
      if (other.t === 'prop') {
        if (isStart && !other.prop.smashed && r.phase !== 'done') smash(r, other.prop);
        continue;
      }
      if (other.t === 'gate') { r.gateTouch = true; r.contacts[car.i] = true; continue; }
      r.contacts[car.i] = true;
      if (other.t === 'terrain' && (!r.nrm || car.i > 0)) r.nrm = other;
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
    if (def.mass > 0) r.slowFactor *= 1 - clamp(def.mass * 0.18, 0.005, 0.1);
    r.shake = Math.max(r.shake, 2 + def.mass * 8);
    const cx = pr.x, cy = pr.y + def.h * 0.5;
    if (def.flat) {
      for (let k = 0; k < 14; k++) particle(r, P_SPLASH, cx + (Math.random() - 0.5) * def.w, cy, r.com.vx * 0.3 + (Math.random() - 0.5) * 3, 2 + Math.random() * 4, 0.1 + Math.random() * 0.08, '#cfeaff', 0.6 + Math.random() * 0.3, 0.9);
      return;
    }
    const n = kindChunks(pr.kind);
    for (let k = 0; k < n; k++) {
      particle(r, P_CHUNK, cx + (Math.random() - 0.5) * def.w, cy + (Math.random() - 0.5) * def.h, r.com.vx * (0.4 + Math.random() * 0.5) + (Math.random() - 0.3) * 3,
        2 + Math.random() * 5, 0.1 + Math.random() * Math.min(0.22, def.w * 0.18), k % 3 === 2 ? shade(def.color, -0.25) : def.color, 1.2 + Math.random() * 0.6, 1);
    }
    for (let k = 0; k < 5; k++) particle(r, P_DUST, cx + (Math.random() - 0.5) * def.w, cy, (Math.random() - 0.5) * 2, Math.random() * 1.5, 0.3 + Math.random() * 0.3, r.dustCol, 0.6 + Math.random() * 0.4, 0.7);
  }
  const kindChunks = (k) => (k === 'tumbleweed' ? 5 : k === 'snowman' ? 9 : 7);

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

  // ---------- simulation ----------
  function tick() {
    const r = run;
    const dt = STEP;
    measure(r);
    r.pre.vx = r.com.vx; r.pre.vy = r.com.vy;
    const held = r.phase === 'parked' || r.phase === 'gate';
    if (r.phase === 'parked' && (input.gas || input.boost)) {
      r.phase = 'ride';
      r.launched = true;
      emit({ type: 'launch' });
    }
    if (r.winchAnim) winchStep(r, dt);
    else if (!held && r.phase !== 'done') controls(r, dt);
    else if (r.phase === 'done') coastToStop(r, dt);
    measure(r);
    const gsl = r.course.groundSlope(r.com.x);
    const gn = Math.hypot(gsl, 1), gtx = 1 / gn, gty = gsl / gn;
    const vtBefore = r.com.vx * gtx + r.com.vy * gty;
    r.contacts[0] = r.contacts[1] = r.contacts[2] = false;
    r.nrm = null;
    r.gateTouch = false;
    for (let i = 0; i < SUBSTEPS; i++) Engine.update(r.engine, STEP_MS / SUBSTEPS);
    if (r.phase === 'parked' || r.phase === 'gate') holdPose(r);
    else if (r.winchAnim) winchPose(r);
    bumpStops(r);
    measure(r);
    // give back most of the speed the solver scrubs off on segment seams while rolling upright
    const upDiff = wrapPi(r.ang - Math.atan(gsl));
    if (!held && !r.air && Math.abs(upDiff) < 0.6 && vtBefore > 2 && (r.contacts[1] || r.contacts[2]) && !r.contacts[0]) {
      const vtAfter = r.com.vx * gtx + r.com.vy * gty;
      const loss = vtAfter - vtBefore + G * (gsl / gn) * dt;
      if (loss < 0) { addVelAll(r, gtx * -loss * 0.9, gty * -loss * 0.9); measure(r); }
    }
    if (r.pendingRemove.length) { Composite.remove(r.world, r.pendingRemove); r.pendingRemove.length = 0; }
    if (r.slowFactor !== 1) {
      addVelAll(r, r.com.vx * (r.slowFactor - 1), r.com.vy * (r.slowFactor - 1));
      r.slowFactor = 1;
      measure(r);
    }
    if (!isFinite(r.com.x) || !isFinite(r.com.y) || !isFinite(r.speed)) {
      console.warn('[engine] non-finite vehicle state; ending ride');
      r.com.x = r.maxX; r.com.y = 0; r.com.vx = 0; r.com.vy = 0; r.speed = 0;
      if (r.phase !== 'done') endRun(r, 'error');
      return;
    }
    if (r.speed > 60) { const f = 60 / r.speed; addVelAll(r, r.com.vx * (f - 1), r.com.vy * (f - 1)); measure(r); }
    r.t += dt;
    if (r.phase !== 'done') logic(r, dt);
    manageChunks(r);
  }

  function surfaceGrip(r, x) {
    const s = r.course.surfaceAt(x);
    r.surf = s;
    return SURF_LIST[s];
  }

  function controls(r, dt) {
    const st = r.stats;
    const locked = r.gateMode === 'stop' || r.finishCrossed;
    const inp = locked ? NO_INPUT : r.phase === 'stuck' && r.upsideDown ? NO_INPUT : input;
    const rearDown = r.wheelAgo[1] < 0.1, frontDown = r.wheelAgo[2] < 0.1;
    const grounded = rearDown || frontDown;
    const rearX = r.wheels[0].position.x / S;
    const sf = surfaceGrip(r, rearX);
    const cosT = Math.max(0.2, Math.cos(r.ang));
    const mu = T.mu * st.grip * r.trailGrip * sf.grip * (r.inWater ? SURFACES.water.grip : 1);
    const aTrac = mu * G * cosT;
    const vTop = T.vTop * Math.pow(st.power, T.vTopExp);
    const vf = r.vf;
    r.spin = 0;
    // gate approach: the engine slows the ride so it arrives at the takeover point at walking pace
    let govern = false;
    const g = r.gates[r.gateIndex];
    r.gateZone = false;
    if (g && !g.done && r.phase === 'ride' && !r.gateMode) {
      const frontX = r.wheels[1].position.x / S;
      const d = g.x - T.gateTakeover - frontX;
      if (d < T.gateZone && d > -1) {
        r.gateZone = true;
        const vAllow = Math.sqrt(T.gateArriveV * T.gateArriveV + 2 * 5 * Math.max(0, d));
        if (vf > vAllow) {
          govern = true;
          if (grounded) {
            const dv = Math.min(vf - vAllow, Math.min(12, (vf - vAllow) * 6 + 3) * dt);
            addVelAll(r, -r.fx * dv, -r.fy * dv);
          }
        }
      }
    }
    if (r.gateMode === 'stop') {
      const frontX = r.wheels[1].position.x / S;
      const dRem = Math.max(0.03, g.x - T.gateStop - frontX);
      if (vf > 0) {
        const need = clamp((vf * vf) / (2 * dRem) + 0.5, 1, 18);
        const dv = Math.min(vf, need * dt);
        addVelAll(r, -r.fx * dv, -r.fy * dv);
      }
    }
    let drive = 0;
    // the wheels push along the ground under the rear wheel, and only while the ranger sits on it
    const gsl = r.course.groundSlope(rearX), gn = Math.hypot(1, gsl), tx = 1 / gn, ty = gsl / gn;
    const pitch = wrapPi(r.ang - Math.atan(gsl)); // + = nose up relative to the ground
    const onWheels = Math.abs(pitch) < 0.9;
    if (grounded && !r.air && onWheels) {
      if (inp.gas && rearDown && !govern) {
        const aEng = T.driveA * st.power * Math.max(0, 1 - Math.pow(Math.max(0, vf) / vTop, 2));
        drive = Math.min(aEng, aTrac);
        if (aEng > aTrac * 1.02) r.spin = 1;
        addVelAll(r, tx * drive * dt, ty * drive * dt);
        // too steep for the grip / engine: the wheels dig in and the ride settles instead of rocking
        const vt = r.com.vx * tx + r.com.vy * ty;
        if (G * ty > drive * 0.98 && Math.abs(vt) < 1.6) {
          const k = 1 - Math.exp(-T.stallDamp * dt);
          addVelAll(r, -tx * vt * k, -ty * vt * k);
          r.spin = 1;
        }
        // a little wheelie under power; the suspension keeps it from going over (stability grows with it)
        let wdot = T.wheelie * drive;
        if (pitch > 0.3 && !frontDown) wdot -= (pitch - 0.3) * 5 * st.suspension + r.omega * 1.5 * st.suspension;
        setOmegaAll(r, r.omega + wdot * dt);
      } else if (inp.brake) {
        if (vf > 0.4) {
          const dv = Math.min(vf, Math.min(T.brakeA, aTrac * 1.2) * dt);
          addVelAll(r, -r.fx * dv, -r.fy * dv);
        } else if (rearDown && vf > -T.reverseV) {
          const a = Math.min(T.reverseA * Math.sqrt(st.power), aTrac);
          addVelAll(r, -r.fx * a * dt, -r.fy * a * dt);
        }
      }
    }
    // in the air: GAS tips the nose up, BRAKE tips it down; near touchdown the suspension's assist lines it up
    if (r.air) airControl(r, dt, inp);
    else if (r.contacts[0] && Math.abs(pitch) > 0.9 && Math.abs(pitch) < 2.1 && r.speed < 3) {
      // standing on the tail / nose or lying on a side: tip back onto the wheels
      setOmegaAll(r, r.omega - Math.sign(pitch) * 5 * st.suspension * dt);
    } else if (grounded && !r.contacts[0]) {
      // both wheels down: a little damping on the pitch so bumps don't rock the cage
      if (rearDown && frontDown) setOmegaAll(r, r.omega * (1 - Math.min(1, dt * 2 * st.suspension)));
    }
    // boost: thrust along the heading while the tank lasts (on the ground and in the air)
    const wantBoost = (inp.boost && r.fuel > 0 && !govern && !r.gateZone) || r.burstT > 0;
    if (wantBoost) {
      if (r.burstT > 0) r.burstT -= dt; else { r.fuel = Math.max(0, r.fuel - dt); r.boostUsed += dt; }
      const vMax = vTop * T.boostVMul;
      const a = T.boostA * st.boostPower * Math.max(0.15, 1 - Math.max(0, vf) / vMax);
      // thrust along the ground while on the wheels, along the heading in the air
      const bx = grounded && onWheels ? tx : r.fx, by = grounded && onWheels ? ty : r.fy;
      addVelAll(r, bx * a * dt, by * a * dt);
    }
    if (wantBoost !== r.boostOn) {
      r.boostOn = wantBoost;
      emit({ type: 'boost', on: wantBoost });
      if (wantBoost && r.burstT <= 0) popup(r, 'BOOST!', 0.5, LANE_SUB, '#7cf2ff', 0.7, false, 0.9, 'boost');
    }
    // resistances
    measure(r);
    const sp = r.speed;
    if (sp > 0.01) {
      let dec = T.airDrag * sp * sp;
      if (grounded) dec += T.rollBase + sf.drag;
      else if (r.contacts[0]) dec += 2.5; // sliding on the roof / side
      if (r.inWater) dec += SURFACES.water.drag * 0.5 + 0.12 * sp;
      const dv = Math.min(sp, dec * dt);
      addVelAll(r, (-r.com.vx / sp) * dv, (-r.com.vy / sp) * dv);
    }
    // the wheels roll at ground speed (they spin faster when the drive is past the grip)
    const wr = VEHICLE.wheels[0].r;
    for (let i = 0; i < 2; i++) {
      const touching = r.contacts[i + 1];
      let target = touching ? r.vf / wr : r.wheelSpin[i];
      if (i === 0 && r.spin && inp.gas) target = Math.max(target, 9);
      if (r.air && inp.gas && i === 0) target = Math.max(target, 12);
      if (inp.brake && touching && r.vf > 0.4) target *= 0.25;
      r.wheelSpin[i] = target;
      Body.setAngularVelocity(r.wheels[i], target / 60);
    }
  }

  function coastToStop(r, dt) {
    measure(r);
    if (r.speed > 0.01 && (r.contacts[1] || r.contacts[2] || r.contacts[0])) {
      const dv = Math.min(r.speed, 7 * dt);
      addVelAll(r, (-r.com.vx / r.speed) * dv, (-r.com.vy / r.speed) * dv);
    }
  }

  // time until the vehicle's centre comes down to ride height on a ballistic path (r.imp)
  function predictImpact(r, maxT) {
    const h = 0.03, c = r.course;
    let x = r.com.x, y = r.com.y, vx = r.com.vx, vy = r.com.vy;
    for (let t = 0; t <= maxT; t += h) {
      if (vy < 0 && y - c.groundY(x) <= r.rideH + 0.15) { r.imp.t = t; r.imp.x = x; r.imp.ok = true; return true; }
      x += vx * h; y += vy * h - 0.5 * G * h * h; vy -= G * h;
    }
    r.imp.ok = false;
    return false;
  }

  function airControl(r, dt, inp) {
    const st = r.stats;
    const k01 = clamp((st.suspension - 1) / 1.4, 0, 1);
    const dir = (inp.gas ? 1 : 0) - (inp.brake ? 1 : 0); // +1 nose up (CCW)
    let w = r.omega;
    // landing assist: in the last moments before touchdown the suspension lines the wheels up with the slope
    // (toward the nearest wheels-down attitude, so a flip that is nearly round gets finished); a better
    // suspension starts earlier and turns harder
    if (predictImpact(r, T.landLook + 0.45 * k01)) {
      const target = Math.atan(r.course.groundSlope(r.imp.x));
      const lead = r.ang + w * 0.2;
      const goal = lead - wrapPi(lead - target);
      const err = r.ang - goal;
      const gain = 1 + 0.8 * k01;
      const a = clamp(-err * T.landK * gain - w * T.landD * Math.sqrt(gain), -18 * gain, 18 * gain);
      w += a * dt;
    } else if (dir) {
      const cap = T.airTiltMax;
      if (dir > 0 ? w < cap : w > -cap) w += T.airTilt * dir * dt;
    } else {
      w *= 1 - Math.min(1, 1.2 * dt);
    }
    setOmegaAll(r, w);
  }

  function logic(r, dt) {
    const c = r.course;
    for (let i = 0; i < 3; i++) { if (r.contacts[i]) r.wheelAgo[i] = 0; else r.wheelAgo[i] += dt; }
    const wheelsDown = (r.wheelAgo[1] < 0.1 ? 1 : 0) + (r.wheelAgo[2] < 0.1 ? 1 : 0);
    const anyContact = r.contacts[0] || r.contacts[1] || r.contacts[2];
    if (r.phase !== 'parked') r.rideT += dt;
    if (r.com.x > r.maxX) r.maxX = r.com.x;
    r.distance = clamp(r.maxX, 0, c.length);
    const kmh = r.speed * 3.6;
    if (kmh > r.maxKmh && r.phase !== 'parked') r.maxKmh = kmh;
    if (r.best > 0 && !r.recordHit && r.distance >= r.best && r.phase !== 'parked') {
      r.recordHit = true;
      emit({ type: 'record', distance: Math.round(r.best) });
      popup(r, 'NEW BEST!', 0.5, LANE_SUB, '#7dff6b', 0.75, false, 1.4, 'sub');
    }
    // ---- airborne / landing ----
    if (!r.air) {
      if (!anyContact && !r.winchAnim) {
        r.noContactT += dt;
        if (r.noContactT > 0.12 && r.com.y - c.groundY(r.com.x) > r.rideH + 0.35) {
          r.air = true;
          r.airTime = r.noContactT;
          r.flightRot = 0; r.flipMark = 0;
        }
      } else r.noContactT = 0;
    } else {
      r.airTime += dt;
      r.flightRot += -(r.chassis.angle - r.prevAngle);
      while (r.flightRot - r.flipMark >= TAU) { r.flipMark += TAU; flip(r, 'back'); }
      while (r.flightRot - r.flipMark <= -TAU) { r.flipMark -= TAU; flip(r, 'front'); }
      if (anyContact) land(r);
    }
    r.prevAngle = r.chassis.angle;

    // ---- water ----
    const w = c.waterAt(r.com.x);
    const wet = !!w && r.com.y < w.level + 0.9;
    if (wet && !r.inWater && r.realT - r.splashT > 0.6) {
      r.splashT = r.realT;
      emit({ type: 'splash', x: Math.round(r.com.x) });
      const n = reducedMotion ? 10 : 24;
      for (let k = 0; k < n; k++) particle(r, P_SPLASH, r.com.x + (Math.random() - 0.5) * 2.4, w.level, r.com.vx * 0.35 + (Math.random() - 0.5) * 5, 3 + Math.random() * 6, 0.1 + Math.random() * 0.1, k % 3 ? '#d8f1ff' : '#8fd0ff', 0.7 + Math.random() * 0.5, 0.95);
      particle(r, P_RING, r.com.x, w.level, 0, 0, 0.4, '#ffffff', 0.5, 0.8, 2.5);
      r.shake = Math.max(r.shake, 3);
    }
    r.inWater = wet;
    if (wet && r.speed > 2 && Math.random() < 0.5) {
      particle(r, P_SPLASH, r.com.x - 1 + Math.random() * 2, w.level, -r.com.vx * 0.1 + (Math.random() - 0.5) * 2, 1 + Math.random() * 3, 0.08 + Math.random() * 0.06, '#d8f1ff', 0.5, 0.9);
    }

    // ---- coins ----
    const C = c.coins;
    while (r.coinLo < C.length && C[r.coinLo].x < r.com.x - 4) r.coinLo++;
    for (let i = r.coinLo; i < C.length; i++) {
      const cn = C[i];
      if (cn.x > r.com.x + 4) break;
      if (r.coinHit[i]) continue;
      const dx = cn.x - r.com.x, dy = cn.y - r.com.y;
      if (dx * dx + dy * dy < 1.7 * 1.7) collectCoin(r, cn, i);
    }

    // ---- wheel fx: dust / mud / snow / sand ----
    if (wheelsDown && r.speed > 1.5 && !r.inWater) {
      const sid = r.surf;
      const p = r.spin ? 0.8 : Math.min(0.6, r.speed / 25);
      if (Math.random() < p) {
        const wb = r.wheels[0];
        const wx = wb.position.x / S - 0.3, wy = -wb.position.y / S - 0.3;
        const st = SURF_IDS[sid];
        if (st === 'mud') particle(r, P_MUD, wx, wy, -r.com.vx * 0.25 - 2 - Math.random() * 3, 1.5 + Math.random() * 3, 0.07 + Math.random() * 0.07, Math.random() < 0.5 ? '#5a3b22' : '#3e2814', 0.7, 1);
        else if (r.bd.style === 'snow' || st === 'ice') particle(r, P_SNOW, wx, wy, -r.com.vx * 0.15 - Math.random() * 2, 0.5 + Math.random() * 2, 0.12 + Math.random() * 0.12, '#ffffff', 0.6 + Math.random() * 0.4, 0.85);
        else particle(r, P_DUST, wx, wy, -r.com.vx * 0.08 + (Math.random() - 0.5), 0.5 + Math.random() * 1.2, 0.14 + Math.random() * 0.16 + Math.min(0.2, r.speed / 90), st === 'sand' ? '#efd9a3' : r.dustCol, 0.45 + Math.random() * 0.35, 0.5);
      }
    }
    if (r.boostOn && Math.random() < 0.6) {
      localToWorld(r, VEHICLE.exhaust[0] - 0.5, VEHICLE.exhaust[1], tmp2);
      particle(r, P_DUST, tmp2[0], tmp2[1], r.com.vx * 0.3 - r.fx * 3, r.com.vy * 0.3 - r.fy * 3 + 0.4, 0.2 + Math.random() * 0.2, '#d6d6e0', 0.45, 0.5);
    }

    // ---- gates ----
    gateLogic(r, dt);
    // ---- stuck ----
    stuckLogic(r, dt, wheelsDown, anyContact);

    // ---- finish ----
    if (!r.finishCrossed && r.com.x >= c.finishX) {
      r.finishCrossed = true;
      r.finishT = r.t;
      emit({ type: 'finishLine' });
      popup(r, 'FINISH!', 0.5, LANE_BIG, '#ffd23f', 1.25, false, 1.8, 'big');
      popup(r, '+$' + Math.round(T.cash.finish * r.stats.coinMult), 0.5, LANE_SUB, '#ffe14a', 0.75, false, 1.6, 'sub');
      confetti(r, c.finishX, c.groundY(c.finishX) + 6, reducedMotion ? 30 : 80);
      if (r.phase === 'stuck') { r.phase = 'ride'; r.stuck = false; }
    }
    if (r.finishCrossed && r.phase !== 'done') {
      // the ranger rolls to a stop past the flag, then the ride ends
      if (!r.air && r.speed > 0.2) {
        const dv = Math.min(r.speed, 6 * dt);
        addVelAll(r, (-r.com.vx / r.speed) * dv, (-r.com.vy / r.speed) * dv);
      }
      if ((r.speed < 0.4 && !r.air && r.t - r.finishT > 0.6) || r.t - r.finishT > 3.5) return endRun(r, 'finish');
    }
    if (r.com.y < c.groundY(r.com.x) - 30) return endRun(r, 'fell');
  }

  function collectCoin(r, cn, i) {
    r.coinHit[i] = 1;
    r.coins++;
    const cash = Math.round(T.cash.coin * r.stats.coinMult);
    r.fuel = Math.min(r.tank, r.fuel + r.tank * T.fuel.coin);
    emit({ type: 'coin', cash });
    for (let k = 0; k < 6; k++) particle(r, P_SPARK, cn.x, cn.y, r.com.vx * 0.3 + (Math.random() - 0.5) * 5, (Math.random() - 0.3) * 5, 0.06, k % 2 ? '#fff3a0' : '#ffc93c', 0.35, 1);
    if (r.realT - r.coinPopT > 0.35) { r.coinPopT = r.realT; popup(r, '+$' + cash, cn.x, cn.y + 1.1, '#ffe14a', 0.55, true, 0.9); }
  }

  function flip(r, direction) {
    r.flips++;
    emit({ type: 'flip', direction });
    popup(r, direction === 'back' ? 'BACKFLIP!' : 'FRONTFLIP!', 0.5, LANE_BIG, '#ff5ec4', 1.0, false, 1.2, 'big');
  }

  function land(r) {
    const st = r.stats, c = r.course;
    const air = r.airTime;
    r.air = false;
    r.noContactT = 0;
    if (air < T.minFlight) return;
    const n = r.nrm || { nx: 0, ny: 1 };
    const pre = r.pre;
    const impact = Math.max(0, -(pre.vx * n.nx + pre.vy * n.ny));
    const ux = -Math.sin(r.ang), uy = Math.cos(r.ang);
    const err = (Math.acos(clamp(ux * n.nx + uy * n.ny, -1, 1)) * 180) / Math.PI;
    const thr = T.impactThr * st.suspension;
    const roof = r.contacts[0] && !r.contacts[1] && !r.contacts[2];
    let q;
    if (err > 75 || (roof && err > 45)) q = 'crash';
    else if (err < 15 && impact < thr) q = 'perfect';
    else if (err < 32 && impact < thr * 1.45) q = 'good';
    else q = 'hard';
    r.flights++;
    r.totalAir += air;
    r.landings[q]++;
    r.lastLanding = q;
    // a flip that is landed wheels-down counts even if the slope saved the last few degrees
    if (q !== 'crash') {
      const rem = r.flightRot - r.flipMark;
      if (Math.abs(rem) >= TAU - 0.9) { r.flipMark += Math.sign(rem) * TAU; flip(r, rem > 0 ? 'back' : 'front'); }
    }
    emit({ type: 'air', airTime: Math.round(air * 100) / 100 });
    emit({ type: 'land', quality: q });
    const gsl = c.groundSlope(r.com.x), gn = Math.hypot(gsl, 1), tx = 1 / gn, ty = gsl / gn;
    if (q === 'perfect' || q === 'good') {
      const vt = (pre.vx * tx + pre.vy * ty) * (q === 'perfect' ? 1 : 0.95);
      addVelAll(r, tx * vt - r.com.vx, ty * vt - r.com.vy);
      measure(r);
      setOmegaAll(r, clamp(r.omega, -1, 1));
      if (air >= T.fuel.landMinAir) {
        const f = q === 'perfect' ? T.fuel.perfect : T.fuel.good;
        r.fuel = Math.min(r.tank, r.fuel + r.tank * f);
      }
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
    const cx = r.com.x;
    for (let k = 0; k < 9; k++) {
      particle(r, r.bd.style === 'snow' ? P_SNOW : P_DUST, cx + (Math.random() - 0.5) * 3, c.groundY(cx) + 0.2, (Math.random() - 0.5) * 5 + r.com.vx * 0.1, Math.random() * 2,
        0.3 + Math.random() * 0.4, r.bd.style === 'snow' ? '#ffffff' : r.dustCol, 0.6 + Math.random() * 0.5, 0.7);
    }
    r.shake = Math.max(r.shake, clamp(impact * 0.8, 1.5, 12) * (q === 'crash' ? 1.4 : q === 'hard' ? 1.1 : 0.6));
  }

  // ---- gates ----
  function gateLogic(r, dt) {
    const g = r.gates[r.gateIndex];
    for (const q of r.gates) if (q.openT >= 0 && q.open < 1) q.open = Math.min(1, (r.realT - q.openT) / 0.75);
    if (!g || r.phase !== 'ride') return;
    const frontX = r.wheels[1].position.x / S;
    if (frontX > g.x + 1.5) { // got past it somehow (should not happen): just open it
      openGateNow(r, g, null);
      return;
    }
    if (!r.gateMode && ((frontX >= g.x - T.gateTakeover && !r.air) || r.gateTouch)) {
      r.gateMode = 'stop';
      r.gateStopT = r.t;
    }
    if (r.gateMode === 'stop' && !r.air) {
      const dRem = g.x - T.gateStop - frontX;
      if ((r.vf < 0.25 && r.speed < 0.6) || dRem < 0.02 || r.t - r.gateStopT > 1.5) park(r, g);
    }
  }
  function park(r, g) {
    measure(r);
    for (const b of r.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
    capturePose(r);
    r.phase = 'gate';
    r.gateMode = 'parked';
    r.boostOn && emit({ type: 'boost', on: false });
    r.boostOn = false;
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

  // ---- stuck + winch ----
  function stuckLogic(r, dt, wheelsDown, anyContact) {
    const c = r.course;
    if (r.finishCrossed || r.winchAnim) return;
    const upCos = Math.cos(r.ang);
    const slope = c.groundSlope(r.com.x);
    if (r.phase === 'ride') {
      const stalled = input.gas && !r.air && r.speed < T.stuckSpeed && Math.abs(slope) > 0.06;
      r.stallT = stalled ? r.stallT + dt : 0;
      const flipped = upCos < 0.25 && !r.air && r.speed < 1.5 && (r.contacts[0] || wheelsDown < 2);
      r.upsideT = flipped ? r.upsideT + dt : 0;
      if (input.gas && !r.gateMode && (!r.air || r.speed < 0.5)) {
        if (r.maxX > r.progMark + 1) { r.progMark = r.maxX; r.progT = 0; } else r.progT += dt;
      } else if (r.maxX > r.progMark + 1) { r.progMark = r.maxX; r.progT = 0; }
      if (r.stallT >= T.stuckTime || r.upsideT >= T.upsideTime || r.progT >= T.noProgressTime) {
        r.phase = 'stuck';
        r.stuck = true;
        r.upsideDown = upCos < 0.25;
        r.stuckX = r.maxX;
        r.stuckT = r.t;
        r.stallT = 0; r.upsideT = 0; r.progT = 0;
        emit({ type: 'stuck', upsideDown: r.upsideDown, x: Math.round(r.com.x * 10) / 10 });
        popup(r, 'STUCK!', 0.5, LANE_BIG, '#ff9b6b', 1.15, false, 1.5, 'big');
      }
    } else if (r.phase === 'stuck') {
      // driven out without the winch (backed up and took a run at it)
      r.upsideDown = upCos < 0.25;
      if (upCos > 0.6 && r.maxX > r.stuckX + 2.5 && r.speed > 1) {
        r.phase = 'ride';
        r.stuck = false;
        r.progMark = r.maxX; r.progT = 0;
        emit({ type: 'unstuck' });
      }
    }
  }
  function winchTarget(r) {
    const c = r.course;
    let tx = r.com.x + T.winchDist;
    for (let k = 0; k < 4; k++) {
      const w = c.waterAt(tx) || c.waterAt(tx - 2) || c.waterAt(tx + 2);
      if (w) tx = w.x1 + 2.5;
      const kk = c.kickerAt(tx, 1.5);
      if (kk) tx = kk.x2 + 2;
    }
    const g = r.gates[r.gateIndex];
    if (g && !g.done && tx > g.x - T.gateTakeover - 1.5) tx = Math.max(r.com.x + 1, g.x - T.gateTakeover - 2);
    return tx;
  }
  function winchStart(r) {
    const tx = winchTarget(r);
    const c = r.course;
    const ta = Math.atan(c.groundSlope(tx));
    const ch = r.chassis;
    // current vehicle origin (ground point under the centre) from the chassis pose
    const a0 = r.ang;
    const cs = Math.cos(a0), sn = Math.sin(a0);
    const ox = ch.position.x / S - (cs * HULL_C[0] - sn * HULL_C[1]);
    const oy = -ch.position.y / S - (sn * HULL_C[0] + cs * HULL_C[1]);
    r.winchAnim = { t: 0, x0: ox, y0: oy, a0, x1: tx, y1: c.groundY(tx) + 0.06, a1: ta, ax: tx + 6.5, ay: c.groundY(tx + 6.5) };
    r.winchShow = r.winchAnim;
    r.winchShowT = r.realT;
    if (r.boostOn) { r.boostOn = false; emit({ type: 'boost', on: false }); }
  }
  function winchPoseAt(r, u) {
    const W = r.winchAnim;
    const e = smoothstep(0, 1, u);
    const x = W.x0 + (W.x1 - W.x0) * e;
    const hop = Math.sin(Math.PI * u) * T.winchHop;
    const y = W.y0 + (W.y1 - W.y0) * e + hop;
    // right the vehicle on the shortest way round
    const da = wrapPi(W.a1 - W.a0);
    const a = W.a0 + da * smoothstep(0.05, 0.85, u);
    placeVehicle(r, x, y, a);
  }
  function winchStep(r, dt) {
    const W = r.winchAnim;
    W.t += dt;
    const u = Math.min(1, W.t / T.winchDur);
    winchPoseAt(r, u);
    if (u >= 1) {
      r.winchAnim = null;
      measure(r);
      const sl = r.course.groundSlope(W.x1), n = Math.hypot(1, sl);
      addVelAll(r, (T.winchPush * 1) / n, (T.winchPush * sl) / n);
      r.phase = 'ride';
      r.stuck = false;
      r.upsideDown = false;
      r.winches++;
      r.stallT = 0; r.upsideT = 0; r.progT = 0;
      r.progMark = Math.max(r.maxX, r.com.x);
      r.air = false; r.noContactT = 0;
      r.prevAngle = r.chassis.angle;
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
    return { distance, air, smash, gates, quick, coins, finish, total: distance + air + smash + gates + quick + coins + finish };
  }
  function ratingOf(r) {
    const reach = clamp(r.distance / r.course.length, 0, 1);
    const L = r.landings;
    const nl = L.perfect + L.good + L.hard + L.crash;
    const landQ = nl ? (L.perfect + 0.75 * L.good + 0.3 * L.hard) / nl : reach;
    const gateQ = r.gateAnswered ? (r.gateCorrect + 0.5 * r.gateFixed) / r.gateAnswered : reach;
    const score = Math.round(clamp(55 * reach + (r.finishCrossed ? 15 : 0) + 15 * gateQ + 15 * landQ - Math.min(10, 2 * r.winches), 0, 100));
    const letter = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';
    return { score, letter };
  }
  function endRun(r, reason) {
    if (r.phase === 'done') return;
    r.phase = 'done';
    r.endReason = reason;
    if (r.boostOn) { r.boostOn = false; emit({ type: 'boost', on: false }); }
    r.winchAnim = null;
    const cash = cashBreakdown(r);
    const rt = ratingOf(r);
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
      // additions
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
    const c = r.com;
    const sp = r.speed;
    const gy = r.course.groundY(c.x);
    const alt = Math.max(0, c.y - gy - 1);
    let visH = clamp(11 + sp * 0.28 + alt * 0.55, 11, 30);
    if (r.phase === 'gate') visH = 12;
    const portrait = view.H > view.W;
    const z = portrait ? view.W / (visH * 1.05) : Math.min(view.H / visH, view.W / (visH * 1.75));
    const visW = view.W / z, visHH = view.H / z;
    const lead = clamp(c.vx * 0.35, -6, 9);
    let tx = c.x + lead + visW * (portrait ? 0.08 : 0.14);
    const aheadY = r.course.groundY(c.x + visW * 0.25);
    let ty = c.y + 1.4 + (aheadY - gy) * 0.35 + clamp(c.vy * 0.15, -3, 3);
    if (r.winchAnim) { tx = (r.winchAnim.x0 + r.winchAnim.ax) / 2; ty = r.winchAnim.y1 + 2; }
    ty = clamp(ty, c.y - visHH * 0.28, c.y + visHH * 0.3);
    if (snap) { cam.x = tx; cam.y = ty; cam.z = z; return; }
    const kp = 1 - Math.exp(-dt * 5), kz = 1 - Math.exp(-dt * 1.8);
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
    const inten = clamp((r.speed - 14) / 14, 0, 1);
    if (inten > 0) {
      const dx = r.com.vx / (r.speed || 1), dy = r.com.vy / (r.speed || 1);
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
    const course = r.course, bd = r.bd;
    const t = r.realT;
    R.drawBackground(ctx, view, cam, bd, t);
    R.worldTransform(ctx, view, cam);
    const z = cam.z;
    vis.x0 = cam.x - (W / 2 + Math.abs(cam.sx)) / z; vis.x1 = cam.x + (W / 2 + Math.abs(cam.sx)) / z;
    vis.y0 = cam.y - (H / 2 + Math.abs(cam.sy)) / z; vis.y1 = cam.y + (H / 2 + Math.abs(cam.sy)) / z;
    const lw = clamp(z * 0.11, 1.3, 3) / z;
    R.drawDecor(ctx, course, bd, vis, lw);
    R.drawTerrain(ctx, course, bd, vis, lw, cam);
    R.drawRavines(ctx, course, bd, vis, lw);
    R.drawBridges(ctx, course, vis, lw);
    R.drawKickers(ctx, course, vis, lw);
    if (vis.x0 < 0) R.drawStartSign(ctx, course, r.trail, lw);
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
    // night: the headlight cone lights the trail ahead
    if (bd.night && r.phase !== 'done') {
      localToWorld(r, VEHICLE.headlight[0], VEHICLE.headlight[1], tmp2);
      R.drawHeadlights(ctx, course, tmp2[0], tmp2[1], r.ang, true);
    }
    const ws = r.winchShow;
    if (ws && (r.winchAnim || r.realT - r.winchShowT < T.winchDur + 0.5)) {
      localToWorld(r, VEHICLE.winchHook[0], VEHICLE.winchHook[1], tmp2);
      R.drawWinch(ctx, ws.ax, ws.ay, tmp2[0], tmp2[1], lw, r.winchAnim ? clamp(ws.t / 0.3, 0, 1) : 1 - clamp((r.realT - r.winchShowT - T.winchDur) / 0.5, 0, 1));
    }
    drawRanger(r, lw);
    R.drawWater(ctx, course, bd, vis, lw, t);
    R.drawParticles(ctx, r.particles, r.np, vis);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R.drawWeather(ctx, view, cam, bd, t);
    const inten = clamp((r.speed - 14) / 14, 0, 1) * (r.phase === 'ride' ? 1 : 0);
    if (inten > 0) R.drawSpeedLines(ctx, view, r.speedLines, inten, r.com.vx / (r.speed || 1), r.com.vy / (r.speed || 1));
    R.drawFlash(ctx, view, r.flash, '#ffffff');
    R.drawPopups(ctx, r.popups, toScreen, view);
  }

  const drawState = { t: 0, nitroOn: false, speed: 0, lw: 0.05, wheels: null, lights: false, rim: null };
  function drawRanger(r, lw) {
    const ch = r.chassis;
    const a = -ch.angle;
    const c = Math.cos(a), s = Math.sin(a);
    // the vehicle origin in world
    const px = ch.position.x / S, py = -ch.position.y / S;
    const ox = px - (c * HULL_C[0] - s * HULL_C[1]), oy = py - (s * HULL_C[0] + c * HULL_C[1]);
    // wheel centres in vehicle-local coordinates (suspension travel)
    for (let i = 0; i < 2; i++) {
      const w = r.wheels[i];
      const dx = w.position.x / S - ox, dy = -w.position.y / S - oy;
      const L = r.wheelLocal[i];
      L.x = c * dx + s * dy; L.y = -s * dx + c * dy; L.a = -w.angle - a;
    }
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(a);
    drawState.t = r.realT;
    drawState.nitroOn = r.boostOn;
    drawState.speed = r.vf;
    drawState.lw = lw;
    drawState.wheels = r.wheelLocal;
    drawState.lights = r.bd.night;
    drawState.rim = r.bd.night ? 'rgba(200,215,255,0.3)' : null;
    drawVehicle(ctx, r.look, drawState);
    ctx.restore();
  }

  // ---------- loop ----------
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    wallT += dt;
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
        updateFx(r, dt);
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
        gateIndex: 0, gatesTotal: 0, stuck: false, upsideDown: false, coins: 0, winches: 0, progress: 0, x: 0 };
    }
    return {
      phase: r.phase,
      distance: Math.round(r.distance * 10) / 10,
      speedKmh: Math.round(r.speed * 3.6),
      boost: r.tank > 0 ? clamp(r.fuel / r.tank, 0, 1) : 0,
      airTime: r.air ? Math.round(r.airTime * 100) / 100 : 0,
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
      x: Math.round(r.com.x * 10) / 10,
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
    // result = { correct, quick, fixed } after the gate panel; returns false when no gate is waiting
    openGate(result = {}) {
      const r = run;
      if (!r || r.phase !== 'gate') return false;
      const g = r.gates[r.gateIndex];
      if (!g) return false;
      const res = { correct: !!result.correct, quick: !!result.quick && !!result.correct, fixed: !!result.fixed && !result.correct };
      r.gateAnswered++;
      let raw = 0, quick = 0, fuel = 0;
      if (res.correct) { r.gateCorrect++; raw = T.cash.gate; fuel = T.fuel.correct; }
      if (res.quick) { r.gateQuick++; quick = T.cash.quick; fuel = T.fuel.quick; }
      if (res.fixed) { r.gateFixed++; raw = T.cash.fixed; fuel = T.fuel.fixed; }
      r.gatesRaw += raw;
      r.quickRaw += quick;
      r.fuel = Math.min(r.tank, r.fuel + r.tank * fuel);
      const m = r.stats.coinMult;
      const cash = Math.round(raw * m) + Math.round(quick * m);
      openGateNow(r, g, res);
      r.phase = 'ride';
      r.progMark = r.maxX; r.progT = 0; r.stallT = 0;
      // the burst: a free boost kick out of the gate
      if (res.correct || res.fixed) r.burstT = res.quick ? 0.7 : 0.5;
      addVelAll(r, r.fx * (res.correct || res.fixed ? T.gateBurst * 0.4 : 0), r.fy * (res.correct || res.fixed ? T.gateBurst * 0.4 : 0));
      emit({ type: 'gateOpen', index: g.index, cash, fuel, correct: res.correct, quick: res.quick, fixed: res.fixed });
      if (cash > 0) popup(r, '+$' + cash, 0.5, LANE_SUB, '#ffe14a', 0.75, false, 1.3, 'sub');
      if (res.quick) popup(r, 'QUICK!', 0.5, LANE_BIG, '#7cf2ff', 1.1, false, 1.2, 'big');
      return true;
    },
    winch(ok) {
      const r = run;
      if (!ok || !r || r.phase !== 'stuck' || r.winchAnim) return false;
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
      for (let i = 0; i < n && run; i++) { tick(); if (run) { run.realT += STEP; updateFx(run, STEP); updateCamera(run, STEP, false); } }
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
      return { x: r.com.x, y: r.com.y, vx: r.com.vx, vy: r.com.vy, vf: r.vf, frontX: r.wheels[1].position.x / S, rearX: r.wheels[0].position.x / S, ang: r.ang, omega: r.omega, phase: r.phase, air: r.air,
        bodies: Composite.allBodies(r.world).length, particles: r.np, props: r.props.length, chunks: r.chunks.size, fuel: r.fuel, tank: r.tank,
        surf: SURF_IDS[r.surf], inWater: r.inWater, gateMode: r.gateMode, endReason: r.endReason, upCos: Math.cos(r.ang),
        gates: r.gates.map((g) => ({ x: g.x, done: g.done })), landings: { ...r.landings }, cam: { ...cam }, perf: { ...perf },
        winch: !!r.winchAnim, slope: r.course.groundSlope(r.com.x), groundY: r.course.groundY(r.com.x), view: { W: view.W, H: view.H } };
    },
    debugCourse() { return run ? run.course : null; },
    // move the vehicle to x (upright, parked on the ground) — for tests and screenshots
    debugTeleport(x, vx = 0, tilt = 0) {
      const r = run;
      if (!r) return;
      const a = Math.atan(r.course.groundSlope(x));
      placeVehicle(r, x, r.course.groundY(x) + (tilt ? 2.6 : 0.06), a + tilt);
      if (vx) addVelAll(r, vx * Math.cos(a), vx * Math.sin(a));
      measure(r);
      r.maxX = Math.max(r.maxX, x);
      r.progMark = r.maxX;
      while (r.gateIndex < r.gates.length && r.gates[r.gateIndex].x < x + 2) openGateNow(r, r.gates[r.gateIndex], null);
      r.coinLo = 0;
      if (r.phase === 'parked') { r.phase = 'ride'; r.launched = true; }
      manageChunks(r);
      updateCamera(r, 1, true);
    },
  };
}
