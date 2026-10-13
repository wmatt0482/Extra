// Ramp Rage gameplay engine. Contract: see SPEC.md "The contract: src/game/engine.js".
// Physics: Matter.js (global `Matter`), 1 m = 30 px, fixed 60 Hz step (2 substeps), y-down in
// physics space. Game logic and rendering work in meters with +y UP.

import { createCourse, CHUNK, SEG } from './course.js';
import { carGeometry } from './car.js';
import * as R from './render.js';
import { OBSTACLE_KINDS } from '../data/tracks.js';
import { TAU, clamp, shade, luminance } from './util.js';

const S = 30; // px per meter (physics space)
const STEP = 1 / 60; // seconds per fixed step (real time)
const STEP_MS = 1000 / 60;
const SUBSTEPS = 2;
const MAX_STEPS_PER_FRAME = 4;
const U = S / 60; // m/s -> Matter velocity units (px per 16.67 ms)
const CAT_TERRAIN = 0x1, CAT_CAR = 0x2, CAT_PROP = 0x4, CAT_DEBRIS = 0x8;
const MAX_DEBRIS = 40;
const MAX_PARTICLES = 320;

// Gameplay tuning (meters, seconds).
export const TUNING = {
  rampDrive: 5.0, // m/s^2 * power on the ramp
  vTopBase: 28, // ramp speed governor (m/s) * power^vTopExp
  vTopExp: 0.4,
  rampGlue: 8, // m/s^2 pressing the car onto the ramp deck
  limiterK: 1.5, // 1/s decel above the governor
  groundDrive: 2.0, // m/s^2 * power after landing ...
  groundFade: 2.5, // ... fading with exp(-t/groundFade) since the first landing
  brake: 7.5,
  rollRestore: 0.9, // fraction of solver speed loss given back while rolling on wheels
  airDrag: 0.0005, // * v^2
  rollBase: 3.0, rollGrav: 1.8, rollLin: 0.005, // ground rolling resistance (m/s^2)
  nitroAcc: 14, // m/s^2 * sqrt(nitroPower), fading toward nitroVMax
  nitroVMax: 60, nitroVMaxPer: 12, // m/s + per nitroPower
  nitroSeconds: 1.2, // tank = nitroCapacity * 1.2 s of burn
  // Air control. BRAKE = back flip at full torque; GAS = front flip at gasTorque (milder), with a
  // landing-timing assist so a held GAS still comes down wheels-first; no flip input = auto-level.
  // Every hold ramps its torque in over holdRamp s so a lingering thumb doesn't snap the car round.
  flipAlpha: 26, flipMax: 10,
  gasTorque: 0.6, gasFlipMax: 7, holdRamp: 0.25, holdRampMin: 0.3,
  levelKp: 9, levelKd: 5, levelMaxAcc: 16, levelLead: 0.25,
  stickWindow: 0.85, stickMinW: 2.2, stickClear: 1.2,
  flipGrace: 1.0, // rad short of 360° that still counts as a flip when landed wheels-down
  // Stunt cash: flipCash per flip, + flipCombo per extra consecutive flip in one flight, capped.
  flipCash: 150, flipCombo: 50, flipComboCap: 250,
  suspImpact: 12, // landing impact threshold = suspImpact * suspension (perfect < thr, good < 1.5 thr)
  launchKick: 0.12, // speed * (1 + launchKick * launchBoost) at the lip
  smashMin: 2.0,
  slowSpeed: 0.6, slowTime: 1.2, maxRun: 120,
  slowmo: 0.35, slowmoDur: 0.4,
};
const T = TUNING;

export function createGame(canvas, opts = {}) {
  const M = globalThis.Matter;
  if (!M) throw new Error('Ramp Rage engine: global Matter (vendor/matter.min.js) is not loaded');
  const { Engine, Bodies, Body, Composite, Constraint, Events, Vertices } = M;
  const emitTo = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const reducedMotion = !!opts.reducedMotion;
  const simSpeed = Math.max(0.1, Number(opts.simSpeed) || 1);

  const ctx = canvas.getContext('2d');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  const view = { W: 1, H: 1, dpr: 1 };
  const cam = { x: 0, y: 0, z: 16, sx: 0, sy: 0 };

  let run = null;
  let ghost = null; // course/backdrop kept for drawing after stop()
  let input = { gas: false, brake: false, nitro: false };
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let wallT = 0;
  const perf = { frames: 0, sim: 0, draw: 0 }; // ms accumulators (debugInfo)

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

  // ---------- helpers ----------
  function addV(b, dx, dy) {
    const v = Body.getVelocity(b);
    Body.setVelocity(b, { x: v.x + dx * U, y: v.y - dy * U });
  }
  function addVelAll(r, dx, dy) { for (const b of r.parts) addV(b, dx, dy); }

  function measure(r) {
    let m = 0, x = 0, y = 0, vx = 0, vy = 0;
    for (const b of r.parts) {
      const v = Body.getVelocity(b);
      m += b.mass;
      x += b.position.x * b.mass; y += b.position.y * b.mass;
      vx += v.x * b.mass; vy += v.y * b.mass;
    }
    r.com.x = x / m / S; r.com.y = -y / m / S;
    r.com.vx = vx / m / U; r.com.vy = -vy / m / U;
    r.speed = Math.hypot(r.com.vx, r.com.vy);
    r.ang = -r.chassis.angle;
    r.omega = -Body.getAngularVelocity(r.chassis) * 60;
  }

  // Set the whole car's angular velocity (world, rad/s, CCW+) as a rigid assembly.
  function setOmegaAll(r, w) {
    const dw = w - r.omega;
    if (!dw) return;
    for (const b of r.parts) {
      const rx = b.position.x / S - r.com.x, ry = -b.position.y / S - r.com.y;
      addV(b, -dw * ry, dw * rx);
      Body.setAngularVelocity(b, Body.getAngularVelocity(b) - dw / 60);
    }
    r.omega = w;
  }

  // Arcade landing: keep the pre-impact speed along the ground (times `keep`) and drop the
  // into-ground part, instead of letting the solver scrub speed on every touchdown.
  function redirectAlongGround(r, pre, keep) {
    const sl = r.course.groundSlope(r.com.x);
    const nn = Math.hypot(sl, 1);
    const tx = 1 / nn, ty = sl / nn;
    const vt = (pre.vx * tx + pre.vy * ty) * keep;
    addVelAll(r, tx * vt - r.com.vx, ty * vt - r.com.vy);
    measure(r);
  }

  // Suspension travel limits. Soft constraints can let a hard hit shove a wheel up through the
  // body (or flip the constraint triangle); clamp each wheel to a small box around its rest spot.
  function bumpStops(r) {
    const ch = r.chassis;
    const c = Math.cos(ch.angle), s = Math.sin(ch.angle);
    const cv = Body.getVelocity(ch), cw = Body.getAngularVelocity(ch);
    for (let i = 0; i < r.wheels.length; i++) {
      const w = r.wheels[i], rest = r.wheelRest[i];
      const dx = w.position.x - ch.position.x, dy = w.position.y - ch.position.y;
      const lx = c * dx + s * dy, ly = -s * dx + c * dy; // into chassis frame
      const ox = lx - rest.x, oy = ly - rest.y;
      const cx = clamp(ox, -0.22 * S, 0.22 * S), cy = clamp(oy, -0.32 * S, 0.22 * S); // up is -y
      if (cx === ox && cy === oy) continue;
      const nlx = rest.x + cx, nly = rest.y + cy;
      const wx = c * nlx - s * nly, wy = s * nlx + c * nly;
      Body.setPosition(w, { x: ch.position.x + wx, y: ch.position.y + wy });
      Body.setVelocity(w, { x: cv.x - cw * wy, y: cv.y + cw * wx });
    }
  }

  function localToWorld(r, lx, ly) {
    const g = r.geom, ch = r.chassis;
    const dx = lx - g.centroid[0], dy = ly - g.centroid[1];
    const c = Math.cos(r.ang), s = Math.sin(r.ang);
    return [ch.position.x / S + c * dx - s * dy, -ch.position.y / S + s * dx + c * dy];
  }

  // ---------- course bodies ----------
  function segBody(xa, ya, xb, yb, kind, thick) {
    const dx = xb - xa, dy = yb - ya;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const mx = (xa + xb) / 2 - (nx * thick) / 2, my = (ya + yb) / 2 - (ny * thick) / 2;
    return Bodies.rectangle(mx * S, -my * S, (len + 0.04) * S, thick * S, {
      isStatic: true, angle: -ang, friction: kind === 'ramp' ? 0.05 : 0.9, frictionStatic: kind === 'ramp' ? 0.1 : 0.5, restitution: 0,
      collisionFilter: { category: CAT_TERRAIN, mask: CAT_CAR | CAT_DEBRIS },
      label: kind, plugin: { rr: { t: kind, nx, ny } },
    });
  }

  function makeProp(r, p) {
    const def = OBSTACLE_KINDS[p.kind];
    const segs = def.segments || 1;
    const gy = r.course.groundY(p.x);
    const ang = Math.atan(r.course.groundSlope(p.x));
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const sh = def.h / segs;
    const rec = { id: p.id, kind: p.kind, def, x: p.x, y: gy, ang, nx, ny, segs, sh, bodies: [], smashed: false };
    for (let j = 0; j < segs; j++) {
      const d = sh * (j + 0.5) - 0.04;
      const b = Bodies.rectangle((p.x + nx * d) * S, -(gy + ny * d) * S, def.w * S, sh * S, {
        isStatic: true, angle: -ang,
        collisionFilter: { category: CAT_PROP, mask: CAT_CAR },
        label: 'prop',
      });
      // set after create: Matter deep-copies `plugin` options, which would give every segment its own
      // clone of `rec` (multi-segment walls then paid out once per segment and never stopped drawing)
      b.plugin.rr = { t: 'prop', prop: rec, seg: j };
      rec.bodies.push(b);
    }
    return rec;
  }

  function buildChunk(r, ci) {
    const bodies = [];
    const g = r.course.groundY;
    const x0 = ci * CHUNK;
    for (let i = 0; i < CHUNK / SEG; i++) {
      const xa = x0 + i * SEG, xb = xa + SEG;
      bodies.push(segBody(xa, g(xa), xb, g(xb), 'terrain', 4));
    }
    const props = [];
    for (const p of r.course.propsInChunk(ci)) {
      if (r.smashedIds.has(p.id)) continue;
      const rec = makeProp(r, p);
      props.push(rec);
      bodies.push(...rec.bodies);
    }
    Composite.add(r.world, bodies);
    r.chunks.set(ci, { bodies, props });
    for (const p of props) r.props.push(p);
  }

  function manageChunks(r) {
    const x = r.com.x;
    const ahead = Math.max(180, r.speed * 3.5);
    const lo = Math.max(-1, Math.floor((Math.max(x, 0) - 70) / CHUNK));
    const hi = Math.floor((Math.max(x, 0) + ahead) / CHUNK);
    for (let ci = lo; ci <= hi; ci++) if (!r.chunks.has(ci)) buildChunk(r, ci);
    let removed = false;
    for (const [ci, ch] of r.chunks) {
      if (ci < lo) {
        Composite.remove(r.world, ch.bodies.filter((b) => !b.plugin.rr.removed));
        r.chunks.delete(ci);
        removed = true;
      }
    }
    if (removed) {
      const live = new Set();
      for (const ch of r.chunks.values()) for (const p of ch.props) live.add(p);
      r.props = r.props.filter((p) => live.has(p));
    }
    // the ramp is never revisited once the car is well past the lip
    if (r.rampBodies && x > 60) {
      Composite.remove(r.world, r.rampBodies);
      r.rampBodies = null;
    }
  }

  // ---------- car ----------
  function buildCar(r) {
    const g = r.geom, st = r.stats, course = r.course;
    const ox = course.startX;
    const lowest = Math.min(...g.wheels.map((w) => w.y - w.r));
    const oy = course.topY - lowest + 0.06;
    const cx = ox + g.centroid[0], cy = oy + g.centroid[1];
    const verts = Vertices.clockwiseSort(g.hull.map(([x, y]) => ({ x: (ox + x) * S, y: -(oy + y) * S })));
    const group = Body.nextGroup(true);
    const filter = () => ({ group, category: CAT_CAR, mask: CAT_TERRAIN | CAT_PROP });
    const chassis = Body.create({
      position: { x: cx * S, y: -cy * S }, vertices: verts,
      friction: 0.2, frictionStatic: 0.3, frictionAir: 0, restitution: 0.05,
      collisionFilter: filter(), label: 'chassis', plugin: { rr: { t: 'car', i: 0 } },
    });
    Body.setMass(chassis, 10 * st.mass);
    const wheelFric = clamp(0.95 * st.grip * r.trackGrip, 0.3, 1.6);
    const wheels = [], cons = [];
    g.wheels.forEach((w, k) => {
      const wb = Bodies.circle((ox + w.x) * S, -(oy + w.y) * S, w.r * S, {
        friction: wheelFric, frictionStatic: 1.2, frictionAir: 0, restitution: 0,
        collisionFilter: filter(), label: 'wheel', plugin: { rr: { t: 'car', i: k + 1 } },
      }, 24);
      Body.setMass(wb, 1.4 * st.mass);
      wheels.push(wb);
      for (const ax of [-0.55, 0.55]) {
        const px = w.x + ax, py = w.y + 0.42;
        cons.push(Constraint.create({
          bodyA: chassis, pointA: { x: (px - g.centroid[0]) * S, y: -(py - g.centroid[1]) * S },
          bodyB: wb, pointB: { x: 0, y: 0 },
          stiffness: 0.45, damping: 0.12, label: 'susp',
        }));
      }
    });
    r.chassis = chassis;
    r.wheels = wheels;
    // rest offsets of the wheels in the chassis frame (px, Matter y-down) for the bump stops
    r.wheelRest = g.wheels.map((w) => ({ x: (w.x - g.centroid[0]) * S, y: -(w.y - g.centroid[1]) * S }));
    r.wheelR = g.wheels.map((w) => w.r);
    r.cons = cons;
    r.parts = [chassis, ...wheels];
    r.contacts = new Array(r.parts.length).fill(false);
    r.wheelAgo = new Array(r.parts.length).fill(9);
    Composite.add(r.world, [chassis, ...wheels, ...cons]);
  }

  // ---------- run lifecycle ----------
  function start(cfg = {}) {
    const { car, stats, track } = cfg;
    if (!car || !stats || !track) throw new Error('game.start needs { car, stats, track, seed }');
    teardown();
    const seed = (Number(cfg.seed) | 0) >>> 0;
    const course = createCourse(track, seed);
    const bd = R.createBackdrop(track, seed);
    bd.baseY = 0; // terrain baseline: the horizon sits low when the camera is high up
    const gMul = track.gravity || 1;
    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: (9.81 * gMul * S) / 1e6 },
      positionIterations: 8, velocityIterations: 8, constraintIterations: 4, enableSleeping: false,
    });
    const r = {
      car, stats, track, seed, course, bd, engine, world: engine.world,
      geom: Object.assign(carGeometry(car), { rim: bd.night ? 'rgba(225,232,255,0.9)' : null }), gMul, trackGrip: track.grip || 1,
      phase: 'ramp', t: 0, runT: 0, realT: 0,
      com: { x: 0, y: 0, vx: 0, vy: 0 }, speed: 0, ang: 0, omega: 0, speedNow: 0,
      maxX: 0, distance: 0,
      airTime: 0, totalAir: 0, flightRot: 0, flipMark: 0, flightFlips: 0, prevAngle: 0,
      flips: 0, frontFlips: 0, backFlips: 0, flipCash: 0,
      smashed: 0, smashRaw: 0, landingRaw: 0, landing: null, firstLanding: null,
      maxKmh: 0, speedBucket: 0, launchKmh: 0, launched: false, lastSpeedPopup: -9,
      finishCrossed: false,
      nitroTank: Math.max(0.1, stats.nitroCapacity * T.nitroSeconds), nitroFuel: 0, nitroOn: false,
      slowT: 0, upsideT: 0, noContactT: 0, groundT: 0, started: false,
      timeScale: 1, slowmoT: 0, shake: 0,
      contacts: [], wheelAgo: [], assistT: 0, airDir: 0, holdT: 0, wheelsDown: 0, chassisDown: false, touchTerrain: false, touchRamp: false, nrm: null,
      chunks: new Map(), props: [], smashedIds: new Set(),
      debris: [], particles: [], popups: [], pendingRemove: [], pendingSpawn: [], slowFactor: 1,
      summary: null, endReason: null,
      speedLines: Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), len: 0.5 + Math.random(), w: 1 + Math.random() * 2 })),
      dustColor: shade(track.theme.ground, luminance(track.theme.ground) > 0.8 ? -0.08 : 0.18),
    };
    r.nitroFuel = r.nitroTank;
    // ramp bodies
    const rp = course.rampPts;
    r.rampBodies = [];
    for (let i = 0; i < rp.length - 1; i++) r.rampBodies.push(segBody(rp[i][0], rp[i][1], rp[i + 1][0], rp[i + 1][1], 'ramp', 2));
    r.rampBodies.push(Bodies.rectangle((course.rampStart - 0.6) * S, -(course.topY + 0.8) * S, 1.2 * S, 5 * S, {
      isStatic: true, friction: 0.5, collisionFilter: { category: CAT_TERRAIN, mask: CAT_CAR | CAT_DEBRIS },
      label: 'ramp', plugin: { rr: { t: 'ramp', nx: 1, ny: 0 } },
    }));
    Composite.add(r.world, r.rampBodies);
    run = r;
    buildCar(r);
    measure(r);
    r.restAlt = r.com.y - course.topY;
    r.prevAngle = r.chassis.angle;
    manageChunks(r);
    Events.on(engine, 'collisionStart', (e) => onPairs(r, e.pairs, true));
    Events.on(engine, 'collisionActive', (e) => onPairs(r, e.pairs, false));
    input = { gas: false, brake: false, nitro: false };
    paused = false;
    acc = 0;
    ghost = null;
    updateCamera(r, 1, true);
  }

  function teardown() {
    const r = run;
    if (!r) return;
    Events.off(r.engine);
    Composite.clear(r.world, false, true);
    Engine.clear(r.engine);
    ghost = { course: r.course, bd: r.bd };
    run = null;
  }

  // ---------- collisions ----------
  function onPairs(r, pairs, isStart) {
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const A = pair.bodyA.plugin && pair.bodyA.plugin.rr, B = pair.bodyB.plugin && pair.bodyB.plugin.rr;
      if (!A || !B) continue;
      let carP, other;
      if (A.t === 'car') { carP = A; other = B; } else if (B.t === 'car') { carP = B; other = A; } else continue;
      if (other.t === 'prop') {
        const pr = other.prop;
        if (pr.smashed) { pair.isActive = false; continue; }
        if (isStart && r.phase !== 'done' && r.speedNow > T.smashMin) {
          smash(r, pr);
          pair.isActive = false;
        }
        continue;
      }
      r.contacts[carP.i] = true;
      if (other.t === 'terrain') { r.touchTerrain = true; if (!r.nrm || carP.i > 0) r.nrm = other; } else r.touchRamp = true;
    }
  }

  function smash(r, pr) {
    pr.smashed = true;
    r.smashedIds.add(pr.id);
    for (const b of pr.bodies) { b.collisionFilter.mask = 0; b.plugin.rr.removed = true; r.pendingRemove.push(b); }
    const def = pr.def;
    const cash = Math.round(def.cash * r.stats.coinMult);
    r.smashRaw += def.cash;
    r.smashed++;
    const cx = pr.x + pr.nx * def.h * 0.5, cy = pr.y + pr.ny * def.h * 0.5;
    emit({ type: 'smash', kind: pr.kind, cash, x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 });
    popup(r, `+$${cash}`, cx, cy + def.h * 0.5 + 0.8, '#ffe14a', 0.85, true);
    r.slowFactor *= 1 - clamp((def.mass * 0.12) / r.stats.mass, 0.01, 0.3);
    r.shake = Math.max(r.shake, 4 + def.mass * 6);
    const vx = r.com.vx, vy = r.com.vy;
    if (pr.kind === 'glass' || pr.kind === 'dome') {
      for (let k = 0; k < 18; k++) {
        particle(r, 'shard', cx + (Math.random() - 0.5) * def.w, cy + (Math.random() - 0.5) * def.h,
          vx * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 6, Math.random() * 8 + 1,
          0.12 + Math.random() * 0.15, '#cdf3ff', 0.9 + Math.random() * 0.6);
      }
    }
    for (let j = 0; j < pr.segs; j++) {
      const d = pr.sh * (j + 0.5);
      const px = pr.x + pr.nx * d, py = pr.y + pr.ny * d;
      const n = pr.segs > 1 ? 2 : pr.kind === 'glass' ? 1 : 3;
      for (let k = 0; k < n; k++) {
        const w = clamp(def.w * (0.35 + Math.random() * 0.3), 0.15, 1.4);
        const h = clamp(pr.sh * (0.25 + Math.random() * 0.3), 0.12, 1.2);
        r.pendingSpawn.push({ x: px + (Math.random() - 0.5) * def.w * 0.5, y: py + (Math.random() - 0.5) * pr.sh * 0.5, w, h,
          color: def.color, vx: vx * (0.55 + Math.random() * 0.5) + (Math.random() - 0.3) * 3, vy: Math.max(vy, 0) * 0.3 + 2 + Math.random() * 6 });
      }
    }
    for (let k = 0; k < 8; k++) {
      particle(r, 'dust', cx + (Math.random() - 0.5) * def.w, cy + (Math.random() - 0.5) * def.h,
        vx * 0.15 + (Math.random() - 0.5) * 3, Math.random() * 2, 0.4 + Math.random() * 0.4, r.dustColor, 0.7 + Math.random() * 0.5);
    }
  }

  function spawnDebrisBody(r, d) {
    while (r.debris.length >= MAX_DEBRIS) {
      const old = r.debris.shift();
      Composite.remove(r.world, old.body);
    }
    const b = Bodies.rectangle(d.x * S, -d.y * S, d.w * S, d.h * S, {
      angle: Math.random() * TAU, friction: 0.7, restitution: 0.25, frictionAir: 0.005,
      collisionFilter: { category: CAT_DEBRIS, mask: CAT_TERRAIN }, label: 'debris', plugin: { rr: { t: 'debris' } },
    });
    Body.setMass(b, 0.2);
    Body.setVelocity(b, { x: d.vx * U, y: -d.vy * U });
    Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.5);
    Composite.add(r.world, b);
    const life = 2.2 + Math.random() * 1.2;
    r.debris.push({ body: b, w: d.w, h: d.h, color: d.color, life, max: life });
  }

  // ---------- fx ----------
  function particle(r, type, x, y, vx, vy, size, color, life, alpha) {
    if (r.particles.length >= MAX_PARTICLES) r.particles.shift();
    r.particles.push({ type, x, y, vx, vy, size, color, life, max: life, alpha, a: Math.random() * TAU });
  }
  // slot: a new popup replaces the live one in the same slot so texts never pile up
  function popup(r, text, x, y, color, scale = 1, world = false, life = 1.3, slot = null) {
    if (slot) r.popups = r.popups.filter((p) => p.slot !== slot);
    r.popups.push({ text, x, y, color, scale, world, t: 0, life, slot });
    if (r.popups.length > 10) r.popups.shift();
  }
  function slowmo(r) {
    if (reducedMotion) return;
    r.timeScale = T.slowmo;
    r.slowmoT = T.slowmoDur;
  }
  function sparks(r, x, y, n) {
    for (let k = 0; k < n; k++) {
      particle(r, 'spark', x + (Math.random() - 0.5), y, r.com.vx * 0.5 + (Math.random() - 0.5) * 10, Math.random() * 9 + 2,
        0.08 + Math.random() * 0.06, Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a', 0.4 + Math.random() * 0.4);
    }
  }

  // ---------- simulation ----------
  function tick() {
    const r = run;
    if (r.slowmoT > 0) {
      r.slowmoT -= STEP;
      r.timeScale = r.slowmoT > 0 ? T.slowmo : 1;
    }
    const ts = r.timeScale;
    const dt = STEP * ts;
    measure(r);
    const pre = { vx: r.com.vx, vy: r.com.vy };
    r.speedNow = r.speed;
    if (r.phase !== 'done') controls(r, dt);
    measure(r);
    // rolling over the polyline terrain: remember the speed along the ground before the solver runs
    const gsl = r.course.groundSlope(r.com.x);
    const gn = Math.hypot(gsl, 1), gtx = 1 / gn, gty = gsl / gn;
    const vtBefore = r.com.vx * gtx + r.com.vy * gty;
    r.contacts.fill(false);
    r.touchTerrain = false; r.touchRamp = false; r.nrm = null;
    for (let i = 0; i < SUBSTEPS; i++) Engine.update(r.engine, (STEP_MS * ts) / SUBSTEPS);
    // deferred world changes
    bumpStops(r);
    measure(r);
    // Matter scrubs speed every time a wheel clips a segment seam or a bump at speed; a real
    // suspension would roll over it. Give most of that solver loss back while rolling upright.
    let upDiff = r.ang - Math.atan(gsl);
    upDiff = ((((upDiff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    if (r.phase === 'ground' && Math.abs(upDiff) < 0.6 && vtBefore > 2 && Math.abs(gsl) < 0.6) {
      let touching = false;
      for (let i = 1; i < r.contacts.length; i++) if (r.contacts[i]) touching = true;
      if (touching) {
        const vtAfter = r.com.vx * gtx + r.com.vy * gty;
        const loss = vtAfter - vtBefore + 9.81 * r.gMul * (gsl / gn) * dt;
        if (loss < 0) { addVelAll(r, gtx * -loss * T.rollRestore, gty * -loss * T.rollRestore); measure(r); }
      }
    }
    if (r.pendingRemove.length) { Composite.remove(r.world, r.pendingRemove); r.pendingRemove.length = 0; }
    if (r.pendingSpawn.length) { for (const d of r.pendingSpawn) spawnDebrisBody(r, d); r.pendingSpawn.length = 0; }
    if (r.slowFactor !== 1) {
      measure(r);
      addVelAll(r, r.com.vx * (r.slowFactor - 1), r.com.vy * (r.slowFactor - 1));
      r.slowFactor = 1;
    }
    measure(r);
    if (!isFinite(r.com.x) || !isFinite(r.com.y) || !isFinite(r.speed)) {
      console.warn('[engine] non-finite car state; ending run');
      r.com.x = r.maxX; r.com.y = 0; r.com.vx = 0; r.com.vy = 0; r.speed = 0;
      if (r.phase !== 'done') endRun(r, 'error');
      return;
    }
    // hard safety cap on speed
    if (r.speed > 120) { const f = 120 / r.speed; addVelAll(r, r.com.vx * (f - 1), r.com.vy * (f - 1)); measure(r); }
    r.t += dt;
    if (r.phase !== 'done') logic(r, dt, pre);
    // debris lifetimes
    for (let i = r.debris.length - 1; i >= 0; i--) {
      const d = r.debris[i];
      d.life -= dt;
      if (d.life <= 0) { Composite.remove(r.world, d.body); r.debris.splice(i, 1); }
    }
    manageChunks(r);
  }

  function controls(r, dt) {
    const st = r.stats;
    const gripF = clamp(st.grip * r.trackGrip, 0.4, 2);
    const fx = Math.cos(r.ang), fy = Math.sin(r.ang);
    let wheelsDown = r.wheelsDown > 0;
    const v = r.speed;
    // On the ramp the car is glued to the deck (extra normal force) so drive works at any
    // gravity and the wheels don't skip; "grounded" there is geometric.
    if (r.phase === 'ramp') {
      const sl = r.course.rampSlope(r.com.x);
      const nn = Math.hypot(sl, 1), nx = -sl / nn, ny = 1 / nn;
      const perp = (r.com.y - r.course.rampY(r.com.x)) / nn;
      if (perp < r.restAlt + 4) {
        addVelAll(r, -nx * T.rampGlue * dt, -ny * T.rampGlue * dt);
        const vn = r.com.vx * nx + r.com.vy * ny;
        if (vn > 0 && perp > r.restAlt + 0.1) addVelAll(r, -nx * vn, -ny * vn);
        let diff = r.ang - Math.atan(sl);
        diff = ((((diff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        if (Math.abs(diff) > 0.03) setOmegaAll(r, r.omega + (-diff * 10 - r.omega * 4) * dt);
        wheelsDown = wheelsDown || perp < r.restAlt + 0.45;
      }
    }
    if (wheelsDown && r.phase !== 'air') {
      if (input.gas) {
        let a;
        if (r.phase === 'ramp') {
          const vTop = T.vTopBase * Math.pow(st.power, T.vTopExp);
          a = T.rampDrive * st.power * Math.max(0, 1 - Math.pow(v / vTop, 8));
        } else {
          a = T.groundDrive * st.power * Math.exp(-r.groundT / T.groundFade);
        }
        a *= Math.min(1, gripF);
        addVelAll(r, fx * a * dt, fy * a * dt);
        r.started = true;
      }
      if (input.brake) {
        const vt = r.com.vx * fx + r.com.vy * fy;
        const dv = Math.sign(vt) * Math.min(Math.abs(vt), T.brake * Math.min(1.2, gripF) * dt);
        addVelAll(r, -fx * dv, -fy * dv);
      }
    }
    // ground: keep the car settling onto its wheels; right after a wheels-down landing the
    // "suspension" soaks the hit (no bounce, quick levelling)
    // Small hops over bumps (no player rotation in this phase) also get a gentle self-levelling.
    if (r.phase === 'ground' && !wheelsDown && !r.chassisDown && r.noContactT > 0.06) {
      // airborne off a crest but not a real flight: same auto-level as a released flip, so a big
      // car pitching over a bump comes down on its wheels instead of nosing in
      const imp = predictImpact(r, 2);
      const w = levelStep(r, r.omega, Math.atan(r.course.groundSlope(imp ? imp.x : r.com.x + r.com.vx * 0.3)), dt, 1);
      setOmegaAll(r, w);
    } else if (r.phase === 'ground' && !r.chassisDown) {
      const sl = r.course.groundSlope(r.com.x + 1);
      let diff = r.ang - Math.atan(sl);
      diff = ((((diff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      const assist = r.assistT > 0;
      if (Math.abs(diff) < 1.2) {
        const kP = assist ? 14 : wheelsDown ? 3 : 5, kD = assist ? 6 : wheelsDown ? 1 : 2;
        setOmegaAll(r, r.omega + (-diff * kP - r.omega * kD) * dt);
      }
      if (assist) {
        const nn = Math.hypot(sl, 1), nx = -sl / nn, ny = 1 / nn;
        const vn = r.com.vx * nx + r.com.vy * ny;
        if (vn > 0.5) addVelAll(r, -(vn - 0.5) * nx, -(vn - 0.5) * ny);
      }
    }
    if (r.phase === 'air') airControl(r, dt);
    r.nitroOn = false;
    if (input.nitro && r.nitroFuel > 0) {
      r.nitroFuel = Math.max(0, r.nitroFuel - dt);
      const vMax = T.nitroVMax + T.nitroVMaxPer * st.nitroPower;
      const a = T.nitroAcc * Math.sqrt(st.nitroPower) * Math.max(0.1, 1 - r.speed / vMax);
      addVelAll(r, fx * a * dt, fy * a * dt);
      r.nitroOn = true;
      r.started = true;
    }
    // resistances
    measure(r);
    const sp = r.speed;
    if (sp > 0.01) {
      let dec = T.airDrag * sp * sp;
      if (r.phase === 'ramp' && wheelsDown) {
        const vTop = T.vTopBase * Math.pow(st.power, T.vTopExp);
        if (sp > vTop) dec += T.limiterK * (sp - vTop);
      }
      if (r.phase === 'ground') {
        if (wheelsDown) dec += T.rollBase + T.rollGrav * r.gMul + T.rollLin * sp;
        else if (r.chassisDown) dec += 1.5; // sliding on the roof/side (plus Matter friction)
      }
      if (r.finishCrossed && r.phase === 'ground') dec += 5;
      const dv = Math.min(sp, dec * dt);
      addVelAll(r, (-r.com.vx / sp) * dv, (-r.com.vy / sp) * dv);
    }
  }

  // Seconds until the car's centre reaches wheel height above the surface on a ballistic path, and
  // the x where that happens. null if it is not coming down within `maxT`.
  function predictImpact(r, maxT, clear = 0.2) {
    const g = 9.81 * r.gMul, h = 0.03;
    let x = r.com.x, y = r.com.y, vx = r.com.vx, vy = r.com.vy;
    for (let t = 0; t <= maxT; t += h) {
      if (y - r.course.surfaceY(x) <= r.restAlt + clear && vy < 0) return { t, x };
      x += vx * h; y += vy * h - 0.5 * g * h * h; vy -= g * h;
    }
    return null;
  }
  const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  // PD step toward the upright attitude nearest to where the current spin is heading.
  function levelStep(r, w, target, dt, gain) {
    const lead = r.ang + w * T.levelLead;
    const goal = lead - wrapPi(lead - target);
    const a = clamp(-(r.ang - goal) * T.levelKp * gain - w * T.levelKd * Math.sqrt(gain), -T.levelMaxAcc * gain, T.levelMaxAcc * gain);
    return w + a * dt;
  }

  function airControl(r, dt) {
    const dir = (input.brake ? 1 : 0) - (input.gas ? 1 : 0); // brake = nose up = backflip (CCW)
    if (dir !== r.airDir) { r.airDir = dir; r.holdT = 0; } else r.holdT += dt;
    const ramp = Math.min(1, T.holdRampMin + (1 - T.holdRampMin) * (r.holdT / T.holdRamp));
    // integrate from the spin we commanded last tick: the soft wheel joints bleed a little spin every
    // solver step, which otherwise caps a held flip far below flipMax
    let w = r.airW != null && Math.abs(r.airW - r.omega) < 2 ? r.airW : r.omega;
    if (dir > 0) {
      w += T.flipAlpha * ramp * dt;
      w = clamp(w, -T.flipMax, T.flipMax);
    } else if (dir < 0) {
      // front flip: milder torque and spin cap; near touchdown, time the spin to land wheels-down
      const imp = predictImpact(r, T.stickWindow, T.stickClear); // aim to be level a bit early
      let stick = false;
      if (imp && imp.t > 0.04) {
        const target = Math.atan(r.course.groundSlope(imp.x));
        const err = wrapPi(r.ang - target);
        if (Math.abs(err) < 0.6 && imp.t < 0.3) {
          w = levelStep(r, w, target, dt, 1.6); // last moment and nearly flush: plant it
          stick = true;
        } else {
          const need = err < 0 ? err + TAU : err; // CW rotation still to go to reach upright
          const cands = [need, need + TAU].map((d) => d / imp.t).filter((v) => v >= T.stickMinW && v <= T.flipMax);
          if (cands.length) {
            const want = Math.min(...cands); // slowest spin that still lands it: most forgiving
            const cur = -w;
            const acc = T.flipAlpha * 1.6 * dt;
            w = -(cur + clamp(want - cur, -acc, acc));
            stick = true;
          }
        }
      }
      if (!stick) {
        w -= T.flipAlpha * T.gasTorque * ramp * dt;
        if (w < -T.gasFlipMax) w = Math.min(-T.gasFlipMax, w + T.flipAlpha * dt);
      }
      w = clamp(w, -T.flipMax, T.flipMax);
    } else {
      // no flip input: settle toward the nearest wheels-down attitude for where it will land
      const imp = predictImpact(r, 3);
      const target = Math.atan(r.course.groundSlope(imp ? imp.x : r.com.x + r.com.vx * 0.5));
      w = levelStep(r, w, target, dt, 1);
    }
    r.airW = w;
    if (w !== r.omega) setOmegaAll(r, w);
  }

  function logic(r, dt, pre) {
    // wheels skip on fast slopes; treat a wheel as down if it touched in the last 0.12 s
    let wd = 0;
    for (let i = 1; i < r.contacts.length; i++) {
      if (r.contacts[i]) r.wheelAgo[i] = 0; else r.wheelAgo[i] += dt;
      if (r.wheelAgo[i] < 0.12) wd++;
    }
    if (r.assistT > 0) r.assistT -= dt;
    r.wheelsDown = wd;
    r.chassisDown = r.contacts[0];
    const anyDown = wd > 0 || r.chassisDown;
    if (r.com.x > r.maxX) r.maxX = r.com.x;
    r.distance = Math.max(0, r.maxX);

    // speed records
    const kmh = r.speed * 3.6;
    if (kmh > r.maxKmh) {
      r.maxKmh = kmh;
      const b = Math.floor(kmh / 10);
      if (b > r.speedBucket) {
        r.speedBucket = b;
        emit({ type: 'speed', kmh: Math.round(kmh) });
        if (r.launched && kmh > r.launchKmh + 4 && r.realT - r.lastSpeedPopup > 1.5 && !r.popups.some((p) => p.slot === 'cash' || p.slot === 'speed')) {
          r.lastSpeedPopup = r.realT;
          popup(r, `NEW MAX ${Math.round(kmh)} km/h`, 0.5, 0.46, '#7cf2ff', 0.62, false, 1.2, 'speed');
        }
      }
    }

    // FX: dust from wheels, nitro smoke
    for (let i = 1; i < r.parts.length; i++) {
      if (!r.contacts[i] || r.speed < 3) continue;
      const onDeck = r.phase === 'ramp';
      if (Math.random() > (onDeck ? 0.18 : Math.min(0.7, r.speed / 35))) continue;
      const w = r.parts[i];
      const rr = r.wheelR[i - 1];
      particle(r, 'dust', w.position.x / S - rr * 0.3, -w.position.y / S - rr * 0.8, -r.com.vx * 0.08 + (Math.random() - 0.5), 0.6 + Math.random() * 1.5,
        0.25 + Math.random() * 0.3 + Math.min(0.4, r.speed / 80), onDeck ? '#e9e6e0' : r.dustColor, 0.5 + Math.random() * 0.5, onDeck ? 0.4 : 0.65);
    }
    if (r.nitroOn) {
      const [ex, ey] = localToWorld(r, r.geom.exhaust[0] - 0.8, r.geom.exhaust[1]);
      particle(r, 'dust', ex, ey, r.com.vx * 0.3 - Math.cos(r.ang) * 4, r.com.vy * 0.3 - Math.sin(r.ang) * 4 + 0.5,
        0.25 + Math.random() * 0.2, '#c9c9d6', 0.5 + Math.random() * 0.3, 0.5);
    }

    // wheels in contact roll at ground speed (drive/brake forces are applied to the bodies directly)
    {
      const vf = r.com.vx * Math.cos(r.ang) + r.com.vy * Math.sin(r.ang);
      for (let i = 1; i < r.parts.length; i++) {
        if (!r.contacts[i]) continue;
        let target = vf / r.wheelR[i - 1];
        if (input.brake && r.phase !== 'air') target *= 0.2;
        Body.setAngularVelocity(r.parts[i], target / 60);
      }
      if (r.phase === 'air' && input.gas) {
        for (let i = 1; i < r.parts.length; i++) Body.setAngularVelocity(r.parts[i], Math.max(Body.getAngularVelocity(r.parts[i]), 0.5));
      }
    }
    if (r.phase === 'ramp') {
      if (r.com.x > 0) launch(r);
    } else if (r.phase === 'air') {
      r.airTime += dt;
      r.totalAir += dt;
      r.flightRot += r.chassis.angle - r.prevAngle;
      while (r.flightRot - r.flipMark >= TAU) { r.flipMark += TAU; flip(r, 'front'); }
      while (r.flightRot - r.flipMark <= -TAU) { r.flipMark -= TAU; flip(r, 'back'); }
      if (r.airTime > 0.15 && r.touchTerrain) land(r, pre);
    } else if (r.phase === 'ground') {
      r.groundT += dt;
      if (!anyDown) {
        r.noContactT += dt;
        const alt = r.com.y - r.course.groundY(r.com.x);
        if (r.noContactT > 0.45 && alt > 3) beginFlight(r);
      } else {
        // touchdown after a small hop: wheels-down and roughly level keeps its momentum
        if (r.noContactT > 0.08 && wd > 0) {
          let diff = r.ang - Math.atan(r.course.groundSlope(r.com.x));
          diff = ((((diff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
          if (Math.abs(diff) < 0.6) { redirectAlongGround(r, pre, 0.98); r.assistT = Math.max(r.assistT, 0.25); }
        }
        r.noContactT = 0;
      }
    }
    r.prevAngle = r.chassis.angle;

    if (!r.finishCrossed && r.com.x >= r.course.finish) {
      r.finishCrossed = true;
      emit({ type: 'finishLine' });
      popup(r, 'FINISH LINE!', 0.5, 0.36, '#ffd23f', 1.2, false, 1.8, 'big');
      if (r.phase !== 'done') slowmo(r);
    }

    // run end
    if (r.started || r.phase !== 'ramp') r.runT += dt;
    if (r.started || r.phase !== 'ramp') {
      const slow = r.speed < T.slowSpeed && r.phase !== 'air';
      r.slowT = slow ? r.slowT + dt : 0;
      const upCos = Math.cos(r.ang); // car up . world up
      if (upCos < -0.4 && r.speed < 1.5 && anyDown && r.phase !== 'air') r.upsideT += dt; else r.upsideT = 0;
      if (r.slowT >= T.slowTime) return endRun(r, 'stopped');
      if (r.upsideT >= 1.0) return endRun(r, 'upside-down');
      if (r.com.y < r.course.groundY(r.com.x) - 60) return endRun(r, 'fell');
      if (r.runT >= T.maxRun) return endRun(r, 'timeout');
    }
  }

  function beginFlight(r) {
    r.phase = 'air';
    r.flightNo = (r.flightNo || 0) + 1;
    r.airTime = 0;
    r.flightRot = 0;
    r.flipMark = 0;
    r.flightFlips = 0;
    r.airDir = null; // a hold carried into the flight ramps in from launch
    r.holdT = 0;
    r.airW = null;
  }

  function launch(r) {
    beginFlight(r);
    const k = 1 + T.launchKick * r.stats.launchBoost;
    addVelAll(r, r.com.vx * (k - 1), r.com.vy * (k - 1));
    measure(r);
    r.launched = true;
    r.launchKmh = r.speed * 3.6;
    emit({ type: 'launch', speedKmh: Math.round(r.launchKmh) });
    popup(r, `LAUNCH! ${Math.round(r.launchKmh)} km/h`, 0.5, 0.36, '#ffffff', 0.9, false, 1.3, 'big');
    for (let k2 = 0; k2 < 10; k2++) {
      particle(r, 'dust', r.com.x - 2 + Math.random() * 2, r.course.rampY(0) - 0.2, -2 + Math.random() * 4, Math.random() * 2,
        0.5 + Math.random() * 0.5, '#ffffff', 0.6 + Math.random() * 0.4, 0.6);
    }
    r.shake = Math.max(r.shake, 3);
    slowmo(r);
  }

  const FLIP_WORDS = ['', '', 'DOUBLE ', 'TRIPLE ', 'QUAD '];
  function flip(r, dir) {
    r.flightFlips++;
    r.flips++;
    if (dir === 'front') r.frontFlips++; else r.backFlips++;
    const cash = T.flipCash + Math.min(T.flipComboCap, T.flipCombo * (r.flightFlips - 1));
    r.flipCash += cash;
    emit({ type: 'flip', dir, count: r.flightFlips });
    const n = r.flightFlips;
    const word = n < FLIP_WORDS.length ? FLIP_WORDS[n] : `${n}x `;
    popup(r, `${word}${dir === 'front' ? 'FRONTFLIP' : 'BACKFLIP'}!`, 0.5, 0.36, dir === 'front' ? '#ffb13d' : '#ff5ec4', 1.05, false, 1.3, 'big');
    popup(r, `+$${Math.round(cash * r.stats.coinMult)}`, 0.5, 0.46, '#ffe14a', 0.7, false, 1.3, 'cash');
  }

  function land(r, pre) {
    const st = r.stats;
    const n = r.nrm || { nx: 0, ny: 1 };
    const impact = Math.max(0, -(pre.vx * n.nx + pre.vy * n.ny));
    const ux = -Math.sin(r.ang), uy = Math.cos(r.ang);
    const ang = (Math.acos(clamp(ux * n.nx + uy * n.ny, -1, 1)) * 180) / Math.PI;
    const thr = T.suspImpact * st.suspension; // m/s into the ground the springs soak up cleanly
    const wheelsDown = r.wheelsDown > 0;
    r.lastLand = { ang: Math.round(ang), impact: Math.round(impact * 10) / 10, thr, wheelsDown, omega: Math.round(r.omega * 10) / 10 };
    let q;
    if (ang > 100 || (!wheelsDown && ang > 70)) q = 'crash';
    else if (ang < 20 && impact < thr) q = 'perfect';
    else if (ang < 35 && impact < thr * 1.5) q = 'good';
    else q = 'rough';
    // a flip that is landed wheels-down counts even if the slope saved the last few degrees
    // (lip kicks up ~15°, landings are often downhill: a flush backflip is only ~310° of rotation)
    if (q !== 'crash') {
      const rem = r.flightRot - r.flipMark;
      if (Math.abs(rem) >= TAU - T.flipGrace) { r.flipMark += Math.sign(rem) * TAU; flip(r, rem > 0 ? 'front' : 'back'); }
    }
    r.phase = 'ground';
    r.noContactT = 0;
    r.landing = q;
    if (q !== 'crash') {
      // the suspension soaks the hit: no bounce, speed kept along the ground
      r.assistT = 0.45;
      redirectAlongGround(r, pre, q === 'perfect' ? 1 : q === 'good' ? 0.96 : 0.85);
      setOmegaAll(r, clamp(r.omega, -1.5, 1.5)); // wheels down: the spin dies in the springs
    }
    const jump = !r.firstLanding; // the landing bonus is paid for the big jump only, not for later hops
    if (jump) { r.firstLanding = q; r.groundT = 0; }
    const bonus = !jump ? 0 : q === 'perfect' ? 300 : q === 'good' ? 100 : 0;
    r.landingRaw += bonus;
    emit({ type: 'land', quality: q, impact: Math.round(impact * 10) / 10 });
    const cx = r.com.x, cy = r.com.y;
    const pay = Math.round(bonus * st.coinMult);
    if (!jump && (q === 'perfect' || q === 'good')) {
      // a hop over a crest: acknowledge it, no bonus and no slow-mo
      if (r.airTime > 0.8) popup(r, q === 'perfect' ? 'CLEAN HOP' : 'NICE HOP', 0.5, 0.36, '#c6ff8a', 0.8, false, 1.1, 'big');
    } else if (q === 'perfect') {
      popup(r, 'PERFECT LANDING!', 0.5, 0.36, '#7dff6b', 1.1, false, 1.6, 'big');
      popup(r, `+$${pay}`, 0.5, 0.46, '#ffe14a', 0.75, false, 1.3, 'cash');
      slowmo(r);
    } else if (q === 'good') {
      popup(r, 'GOOD LANDING', 0.5, 0.36, '#c6ff8a', 0.95, false, 1.3, 'big');
      popup(r, `+$${pay}`, 0.5, 0.46, '#ffe14a', 0.7, false, 1.3, 'cash');
    } else if (q === 'rough') {
      popup(r, 'ROUGH LANDING', 0.5, 0.36, '#ffb36b', 0.9, false, 1.3, 'big');
      sparks(r, cx, cy - 0.6, 14);
    } else {
      popup(r, 'CRASH!', 0.5, 0.36, '#ff4d4d', 1.3, false, 1.6, 'big');
      r.slowFactor *= 0.62;
      sparks(r, cx, cy, 24);
      const g = r.geom;
      for (let k = 0; k < 4; k++) {
        r.pendingSpawn.push({ x: cx + (Math.random() - 0.5) * 2, y: cy + 0.5, w: 0.3 + Math.random() * 0.4, h: 0.15 + Math.random() * 0.2,
          color: k % 2 ? g.color : g.accent, vx: r.com.vx * 0.6 + (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 5 });
      }
    }
    for (let k = 0; k < 12; k++) {
      particle(r, 'dust', cx + (Math.random() - 0.5) * 4, r.course.groundY(cx) + 0.2, (Math.random() - 0.5) * 6 + r.com.vx * 0.1, Math.random() * 2.5,
        0.4 + Math.random() * 0.5, r.dustColor, 0.7 + Math.random() * 0.6, 0.75);
    }
    r.shake = Math.max(r.shake, clamp(impact * 0.9, 3, 16) * (q === 'crash' ? 1.4 : 1));
  }

  function cashBreakdown(r) {
    const m = r.stats.coinMult;
    const distance = Math.round(2 * r.distance * m);
    const stunts = Math.round((r.flipCash + 10 * r.totalAir) * m);
    const smash = Math.round(r.smashRaw * m);
    const landing = Math.round(r.landingRaw * m);
    return { distance, stunts, smash, landing, total: distance + stunts + smash + landing };
  }

  function endRun(r, reason) {
    if (r.phase === 'done') return;
    r.phase = 'done';
    r.endReason = reason;
    r.nitroOn = false;
    const summary = {
      distance: Math.round(r.distance * 10) / 10,
      airTime: Math.round(r.totalAir * 100) / 100,
      flips: r.flips, frontFlips: r.frontFlips, backFlips: r.backFlips,
      smashed: r.smashed,
      maxSpeedKmh: Math.round(r.maxKmh),
      landing: r.firstLanding,
      finishCrossed: r.finishCrossed,
      cash: cashBreakdown(r),
      durationSec: Math.round(r.t * 10) / 10,
    };
    r.summary = summary;
    emit({ type: 'finish', summary });
  }

  // ---------- camera ----------
  function updateCamera(r, dt, snap) {
    const c = r.com;
    const sp = r.speed;
    const surf = r.course.surfaceY(c.x);
    const alt = Math.max(0, c.y - surf);
    let visH = 14 + sp * 0.22 + alt * 1.05;
    if (r.phase === 'ramp' && sp < 5) visH = Math.max(visH, 30 - sp * 2);
    visH = clamp(visH, 14, 170);
    // landscape: fit visH vertically; portrait: fit a slightly wider span horizontally
    const z = view.H > view.W ? view.W / (visH * 1.2) : Math.min(view.H / visH, view.W / (visH * 1.55));
    const visW = view.W / z, visHH = view.H / z;
    const lx = clamp(c.vx * 0.45, -22, 22), ly = clamp(c.vy * 0.35, -16, 16);
    const tx = c.x + lx + visW * 0.12;
    let ty = c.y + ly;
    if (r.phase === 'ramp') ty -= visHH * 0.14;
    const gAhead = Math.min(surf, r.course.surfaceY(tx));
    ty = Math.min(ty, gAhead - 1.5 + visHH / 2);
    ty = clamp(ty, c.y + 2.5 - visHH / 2, c.y - 2.5 + visHH / 2);
    if (snap) { cam.x = tx; cam.y = ty; cam.z = z; return; }
    const kp = 1 - Math.exp(-dt * 5), kz = 1 - Math.exp(-dt * 2.2);
    cam.x += (tx - cam.x) * kp;
    cam.y += (ty - cam.y) * kp;
    cam.z = Math.exp(Math.log(cam.z) + (Math.log(z) - Math.log(cam.z)) * kz);
    // hard keep-in-view (very fast cars)
    const hw = view.W / cam.z / 2 - 3, hh = view.H / cam.z / 2 - 2;
    cam.x = clamp(cam.x, c.x - hw, c.x + hw);
    cam.y = clamp(cam.y, c.y - hh, c.y + hh);
  }

  function updateFx(r, dt) {
    const sdt = dt * r.timeScale;
    const g = 9.81 * r.gMul;
    const ps = r.particles;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= sdt;
      if (p.life <= 0) continue;
      p.x += p.vx * sdt;
      p.y += p.vy * sdt;
      if (p.type === 'dust') { p.vx *= 1 - 1.5 * sdt; p.vy = p.vy * (1 - 1.5 * sdt) + 0.6 * sdt; } else { p.vy -= g * sdt; p.a += sdt * 8; }
      ps[j++] = p;
    }
    ps.length = j;
    for (const p of r.popups) p.t += dt;
    r.popups = r.popups.filter((p) => p.t < p.life);
    r.shake *= Math.exp(-dt * 7);
    if (reducedMotion || r.shake < 0.2) { cam.sx = 0; cam.sy = 0; } else {
      cam.sx = (Math.random() - 0.5) * 2 * r.shake;
      cam.sy = (Math.random() - 0.5) * 2 * r.shake;
    }
    // speed lines drift
    const inten = clamp((r.speed - 22) / 30, 0, 1);
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
  function render() {
    const { W, H, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const src = run || ghost;
    if (!src) {
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#7cc6ff');
      gr.addColorStop(1, '#ffe6b8');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const course = src.course, bd = src.bd;
    const t = run ? run.realT : wallT;
    R.drawBackground(ctx, view, cam, bd, t);
    R.worldTransform(ctx, view, cam);
    const z = cam.z;
    const vis = {
      x0: cam.x - (W / 2 + Math.abs(cam.sx)) / z, x1: cam.x + (W / 2 + Math.abs(cam.sx)) / z,
      y0: cam.y - (H / 2 + Math.abs(cam.sy)) / z, y1: cam.y + (H / 2 + Math.abs(cam.sy)) / z,
    };
    const lwPx = clamp(z * 0.14, 1.3, 3.2);
    const lw = lwPx / z;
    R.drawTerrain(ctx, course, bd, vis, lw, cam);
    R.drawRamp(ctx, course, bd, vis, lw);
    R.drawFinish(ctx, course, vis, lw);
    if (run) {
      const r = run;
      for (const pr of r.props) {
        if (pr.smashed || pr.x < vis.x0 - 5 || pr.x > vis.x1 + 5) continue;
        for (let j = 0; j < pr.bodies.length; j++) {
          const b = pr.bodies[j];
          ctx.save();
          ctx.translate(b.position.x / S, -b.position.y / S);
          ctx.rotate(-b.angle);
          R.drawPropPiece(ctx, pr.kind, pr.def, pr.def.w, pr.sh, j, pr.segs, lw);
          ctx.restore();
        }
      }
      for (const d of r.debris) {
        const b = d.body;
        const x = b.position.x / S, y = -b.position.y / S;
        if (x < vis.x0 - 2 || x > vis.x1 + 2 || y < vis.y0 - 2 || y > vis.y1 + 2) continue;
        ctx.save();
        ctx.globalAlpha = clamp(d.life / 0.6, 0, 1);
        ctx.translate(x, y);
        ctx.rotate(-b.angle);
        ctx.fillStyle = d.color;
        ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
        ctx.lineWidth = lw * 0.8;
        ctx.strokeStyle = R.OUT;
        ctx.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
        ctx.restore();
      }
      drawCar(r, lw);
      R.drawParticles(ctx, r.particles, vis);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const inten = clamp((r.speed - 22) / 30, 0, 1) * (r.phase === 'done' ? 0 : 1);
      if (inten > 0) R.drawSpeedLines(ctx, view, r.speedLines, inten, r.com.vx / (r.speed || 1), r.com.vy / (r.speed || 1));
      const toScreen = (x, y) => [(x - cam.x) * z + W / 2 + cam.sx, H / 2 - (y - cam.y) * z + cam.sy];
      R.drawPopups(ctx, r.popups, toScreen, view);
      if (r.timeScale < 1) R.drawVignette(ctx, view, clamp(r.slowmoT / T.slowmoDur * 1.5, 0, 1));
    }
  }

  function drawCar(r, lw) {
    const g = r.geom, ch = r.chassis;
    // when the camera is zoomed far out (big air) draw the car a bit larger so it stays readable
    const boost = Math.pow(clamp(10 / cam.z, 1, 3), 0.85);
    ctx.save();
    if (boost > 1.01) {
      ctx.translate(r.com.x, r.com.y);
      ctx.scale(boost, boost);
      ctx.translate(-r.com.x, -r.com.y);
      lw /= boost;
    }
    // suspension struts
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    for (const c of r.cons) {
      const a = Constraint.pointAWorld(c), b = Constraint.pointBWorld(c);
      ctx.moveTo(a.x / S, -a.y / S);
      ctx.lineTo(b.x / S, -b.y / S);
    }
    ctx.stroke();
    ctx.save();
    ctx.translate(ch.position.x / S, -ch.position.y / S);
    ctx.rotate(-ch.angle);
    ctx.translate(-g.centroid[0], -g.centroid[1]);
    R.drawChassis(ctx, g, lw, r.realT, r.nitroOn);
    ctx.restore();
    const spoke = luminance(g.accent) > 0.7 ? '#8a8f9c' : g.accent;
    for (let i = 0; i < r.wheels.length; i++) {
      const w = r.wheels[i];
      ctx.save();
      ctx.translate(w.position.x / S, -w.position.y / S);
      ctx.rotate(-w.angle);
      R.drawWheel(ctx, r.wheelR[i], lw, spoke);
      ctx.restore();
    }
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
      while (acc >= STEP && n < maxSteps && run === r) { tick(); acc -= STEP; n++; }
      if (n >= maxSteps) acc = 0; // accumulator cap: no spiral of death
      if (run === r) {
        r.realT += dt;
        updateFx(r, dt);
        updateCamera(r, dt, false);
      }
    }
    const tB = performance.now();
    try { render(); } catch (e) { console.error('[engine] render failed', e); }
    perf.frames++; perf.sim += tB - tA; perf.draw += performance.now() - tB;
  }
  raf = requestAnimationFrame(frame);

  // ---------- public API ----------
  function getState() {
    const r = run;
    if (!r) {
      return { phase: 'done', distance: 0, speedKmh: 0, nitro: 0, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false, landing: null };
    }
    return {
      phase: r.phase,
      distance: Math.round(r.distance * 10) / 10,
      speedKmh: Math.round(r.speed * 3.6),
      nitro: r.nitroTank > 0 ? r.nitroFuel / r.nitroTank : 0,
      airTime: Math.round(r.airTime * 100) / 100,
      flips: r.flips,
      smashed: r.smashed,
      cash: cashBreakdown(r).total,
      finishCrossed: r.finishCrossed,
      landing: r.landing,
    };
  }

  return {
    start,
    setInput(next = {}) {
      input = {
        gas: next.gas !== undefined ? !!next.gas : input.gas,
        brake: next.brake !== undefined ? !!next.brake : input.brake,
        nitro: next.nitro !== undefined ? !!next.nitro : input.nitro,
      };
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); acc = 0; },
    stop() {
      if (run && run.phase !== 'done') endRun(run, 'stopped');
      teardown();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      teardown();
      ghost = null;
    },
    getState,
    // --- not part of the contract: test/debug helpers ---
    debugStep(n = 1) {
      for (let i = 0; i < n && run; i++) { tick(); run && (run.realT += STEP, updateFx(run, STEP), updateCamera(run, STEP, false)); }
      return getState();
    },
    debugInfo() {
      const r = run;
      if (!r) return null;
      return { x: r.com.x, y: r.com.y, vx: r.com.vx, vy: r.com.vy, ang: r.ang, omega: r.omega, phase: r.phase, bodies: Composite.allBodies(r.world).length,
        debris: r.debris.length, particles: r.particles.length, props: r.props.length, chunks: r.chunks.size, endReason: r.endReason, launchKmh: r.launchKmh, wd: r.wheelsDown, cd: r.chassisDown,
        timeScale: r.timeScale, lastLand: r.lastLand || null, cam: { ...cam }, perf: { ...perf } };
    },
  };
}
