// Spell Jump (ex Ramp Rage) gameplay engine. Contract: see SPEC.md "The contract: src/game/engine.js".
// Physics: Matter.js (global `Matter`), 1 m = 30 px, fixed 60 Hz step (2 substeps), y-down in
// physics space. Game logic and rendering work in meters with +y UP.

import { createCourse, CHUNK, SEG } from './course.js';
import { carGeometry, resolveLook, carPieces } from './car.js';
import * as R from './render.js';
import { OBSTACLE_KINDS } from '../data/tracks.js';
import { ratingLetter, ratingScore } from '../data/rating.js';
import { TAU, clamp, shade, luminance, mulberry32, smoothstep } from './util.js';

const S = 30; // px per meter (physics space)
const STEP = 1 / 60; // seconds per fixed step (real time)
const STEP_MS = 1000 / 60;
const SUBSTEPS = 2;
const MAX_STEPS_PER_FRAME = 4;
const U = S / 60; // m/s -> Matter velocity units (px per 16.67 ms)
const CAT_TERRAIN = 0x1, CAT_CAR = 0x2, CAT_PROP = 0x4, CAT_DEBRIS = 0x8;
const MAX_DEBRIS = 60;
const MAX_PARTICLES = 380;

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
  // ---- v2 ----
  comboWindow: 1.5, comboStep: 0.25, comboMax: 4,
  comboCap: 1.0, // per run, the multiplier extra (cash.combo) can at most match the base smash cash (cash.smash)
  blastR: 6, chainDelay: 0.12, blastKick: 6, blastLift: 4,
  collapseDelay: 0.08, deckHold: 0.3,
  launchSlowmo: 0.3, launchSlowDur: 0.5, landSlowDur: 0.4,
  ringCash: 150, ringNitro: 0.25, coinCash: 20, balloonCash: 200, blimpCash: 500,
  orbitAlt: 45, altCash: 8, // v3.3: $ per metre of EVERY flight's peak altitude, paid on landing (cash.air)
  // v3.3 air pays: $ per second of flight (every flight, kickers included) + Big Air tiers paid once per
  // flight on landing (min air time s, $, tier), both into cash.stunts
  airTimeCash: 50, bigAir: [[8, 600, 3], [5, 300, 2], [3, 150, 1]],
  kickMinSpeed: 6, kickerBonus: 0.5,
  // ---- v3 (Spell Jump) ----
  letterCash: 40, letterNitro: 0.25, wordCash: 200, // per letter ring / all letters in order (x coinMult, into cash.air)
  letterR: 2.5, // letter ring hit radius (m), a little bigger than a plain ring
  letterGapMax: 11, letterGapMin: 4, letterStart: 10, // arc-length spacing / first ring (m past the lip)
  letterClear: 4.5, // plain air targets this close to a letter ring are removed (no clutter between letters)
  letterFitSteps: 4, // the letter arc is refitted to the real flight this many steps after the lip
  letterGlide: 0.35, // s (real time): rings glide from the preview arc onto the fitted one
  // ---- Grand Finale: the car blows up (cartoon, no penalty) at the end of crash runs and some others ----
  finaleChance: 0.3, // default chance on a clean run end (opts.finaleChance overrides; crash ends always go)
  finaleCash: 150, // flat bonus x coinMult, into cash.stunts
  finaleWobble: 0.3, finaleDur: 1.6, // s: wobble + whine, then KABOOM; finish fires finaleDur after the stop
};
const T = TUNING;
// Screen-space popup lanes (fractions of the view height). The HUD's banners and toasts own the band
// under the top bar (~19-36%), the camera keeps the car around 43-51%, so the engine's own big texts
// (flips, landings, finish line) sit in the lower band and never share pixels with a HUD banner.
const LANE_BIG = 0.6, LANE_SUB = 0.7;
const BALLOON_COLS = ['#ff4d6d', '#ffd23f', '#4dd2ff', '#7dff6b', '#c77dff'];
const CONFETTI = ['#ff4d6d', '#ffd23f', '#4dd2ff', '#7dff6b', '#c77dff', '#ffffff', '#ff9b2e'];
const FW_COLS = [['#ff4d6d', '#ffd1dc'], ['#4dd2ff', '#e0f8ff'], ['#ffd23f', '#fff6c9'], ['#7dff6b', '#e6ffe0']];

export function createGame(canvas, opts = {}) {
  const M = globalThis.Matter;
  if (!M) throw new Error('Spell Jump engine: global Matter (vendor/matter.min.js) is not loaded');
  const { Engine, Bodies, Body, Composite, Constraint, Events, Vertices } = M;
  const emitTo = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const reducedMotion = !!opts.reducedMotion;
  let shakeMul = 1; // game.start({ shake }) 0..1; reducedMotion still wins
  const simSpeed = Math.max(0.1, Number(opts.simSpeed) || 1);
  const finaleChance = opts.finaleChance == null || opts.finaleChance === '' ? T.finaleChance : clamp(Number(opts.finaleChance) || 0, 0, 1);

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
  const perf = { frames: 0, sim: 0, draw: 0, max: 0, ticks: 0, maxTick: 0, maxDraw: 0 }; // ms accumulators + worst frame (debugInfo)

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
    const piece = p.form != null; // v2 formation piece: explicit centre, size and frame angle
    const segs = piece ? 1 : def.segments || 1;
    const w = piece ? p.w : def.w, h = piece ? p.h : def.h;
    const ang = piece ? p.ang : Math.atan(r.course.groundSlope(p.x));
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    // (x, y) = base centre on the ground (pieces: back-computed from their centre)
    const gx = piece ? p.x - nx * h * 0.5 : p.x;
    const gy = piece ? p.y - ny * h * 0.5 : r.course.groundY(p.x);
    const sh = h / segs;
    const rec = { id: p.id, kind: p.kind, def, x: gx, y: gy, ang, nx, ny, segs, sh, w, h, bodies: [], smashed: false,
      form: piece ? p.form : null, role: p.role || null, sup: p.sup || null, collapseAt: 0 };
    for (let j = 0; j < segs; j++) {
      const d = sh * (j + 0.5) - (piece ? 0 : 0.04);
      const b = Bodies.rectangle((gx + nx * d) * S, -(gy + ny * d) * S, w * S, sh * S, {
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
    const xs = r.course.terrainXs(x0, x0 + CHUNK);
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1];
      bodies.push(segBody(xa, g(xa), xb, g(xb), 'terrain', 4));
    }
    const props = [];
    for (const p of r.course.propsInChunk(ci)) {
      if (r.smashedIds.has(p.id)) continue;
      const rec = makeProp(r, p);
      props.push(rec);
      r.propById.set(rec.id, rec);
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
      for (const [id, p] of r.propById) if (!live.has(p)) r.propById.delete(id);
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
  // v3 start() args: a 0..max scale (default 1), and the word's letters (array, or a string split into chars)
  function scaleArg(v, max) {
    const n = Number(v);
    return v == null || v === '' || !Number.isFinite(n) ? 1 : clamp(n, 0, max);
  }
  function lettersArg(v) {
    const a = typeof v === 'string' ? [...v] : Array.isArray(v) ? v : [];
    return a.map((c) => String(c == null ? '' : c)).filter((c) => c.length > 0);
  }

  // v3: let the suspension settle at the ramp top before the first frame, then hold that pose (a static
  // brake, see holdParked) until the first GAS/NITRO input, so a parked car never creeps.
  function settleParked(r) {
    for (let i = 0; i < 90 * SUBSTEPS; i++) {
      Engine.update(r.engine, STEP_MS / SUBSTEPS);
      for (const b of r.parts) { const v = Body.getVelocity(b); Body.setVelocity(b, { x: 0, y: v.y }); }
    }
    for (const b of r.parts) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
    r.parkPose = r.parts.map((b) => ({ x: b.position.x, y: b.position.y, a: b.angle }));
    measure(r);
  }
  function holdParked(r) {
    const P = r.parkPose;
    for (let i = 0; i < r.parts.length; i++) {
      const b = r.parts[i];
      Body.setPosition(b, { x: P[i].x, y: P[i].y });
      Body.setAngle(b, P[i].a);
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
    }
  }

  // v3: rough GAS-only launch speed for the current power (1-D model down the ramp profile, calibrated
  // against the real ramp run: ~0.89 of the frictionless estimate). Only used to preview the letter rings
  // before the jump; at the lip they are refitted to the real flight.
  function predictLaunch(r) {
    const st = r.stats, c = r.course;
    const pw = st.power * r.powerScale;
    const vTop = T.vTopBase * Math.pow(pw, T.vTopExp);
    const g = 9.81 * r.gMul, gripF = Math.min(1, clamp(st.grip * r.trackGrip, 0.4, 2));
    let x = r.com.x, v = 0;
    const h = 1 / 60;
    for (let i = 0; i < 60 * 90 && x < 0; i++) {
      const sl = c.rampSlope(x), cs = 1 / Math.hypot(1, sl);
      let a = -g * sl * cs + T.rampDrive * pw * Math.max(0, 1 - Math.pow(v / Math.max(0.01, vTop), 8)) * gripF - T.airDrag * v * v;
      if (v > vTop) a -= T.limiterK * (v - vTop);
      v = Math.max(0, v + a * h);
      x += v * cs * h;
      if (v === 0 && i > 30) break;
    }
    return v * 0.89 * (1 + T.launchKick * st.launchBoost * r.powerScale);
  }

  // v3 letter rings: one ring per letter, in order, along the jump's flight arc (arc-length spacing
  // letterGapMin..letterGapMax m, starting letterStart m past the lip). `from` = {x, y, vx, vy} of the
  // real flight (refit at the lip), or null for the preview arc from predictLaunch.
  function layoutLetters(r, from) {
    const N = r.letters.length;
    if (!N) return;
    const c = r.course;
    let s0 = from;
    if (!s0) {
      const v = predictLaunch(r), ang = (13.8 * Math.PI) / 180;
      s0 = { x: 0.2, y: c.lipY + r.restAlt, vx: v * Math.cos(ang), vy: v * Math.sin(ang) };
    }
    // the same integrator as the flight (gravity + quadratic air drag), until the car is back down
    const g = 9.81 * r.gMul, h = 1 / 60;
    const pts = [];
    let x = s0.x, y = s0.y, vx = s0.vx, vy = s0.vy, s = 0;
    for (let i = 0; i < 60 * 40; i++) {
      pts.push({ x, y, s });
      if (i > 10 && vy < 0 && y - c.surfaceY(x) < r.restAlt + 0.2) break;
      const sp = Math.hypot(vx, vy), k = T.airDrag * sp;
      vx -= k * vx * h; vy -= (g + k * vy) * h;
      const nx = x + vx * h, ny = y + vy * h;
      s += Math.hypot(nx - x, ny - y);
      x = nx; y = ny;
    }
    // usable stretch: rings stay clear of the ground (and of the lip)
    const R = T.letterR;
    let sB = 0;
    for (const p of pts) if (p.y - c.surfaceY(p.x) >= R + 1.2) sB = p.s;
    let sA = Math.min(T.letterStart, sB * 0.15);
    let d = N > 1 ? Math.min(T.letterGapMax, (sB - sA) / (N - 1)) : 0;
    if (N > 1 && d < T.letterGapMin) { d = T.letterGapMin; sA = Math.max(4, sB - d * (N - 1)); }
    const at = (sv) => {
      let lo = 0, hi = pts.length - 1;
      if (sv >= pts[hi].s) { const p = pts[hi], q = pts[Math.max(0, hi - 1)], k = (sv - p.s) / Math.max(1e-6, p.s - q.s); return { x: p.x + (p.x - q.x) * k, y: p.y + (p.y - q.y) * k }; }
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= sv) lo = m; else hi = m; }
      const p = pts[lo], q = pts[hi], k = (sv - p.s) / Math.max(1e-6, q.s - p.s);
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
    };
    const old = r.air.filter((a) => a.li != null);
    const keep = r.air.filter((a) => a.li == null);
    const rings = [];
    for (let i = 0; i < N; i++) {
      const p = at(sA + d * i);
      const o = old[i];
      const a = o || { id: 10000 + i, kind: 'ring', li: i, letter: r.letters[i], r: R, hit: false, hitT: 0, ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, spin: 0, gx: 0, gy: 0, glideT: -9 };
      if (o && from) { a.gx = o.x - p.x; a.gy = o.y - p.y; a.glideT = r.realT; }
      a.x = p.x; a.y = p.y;
      rings.push(a);
    }
    // no plain ring/coin/balloon sitting among the letters (a stray gold ring between F and R would read
    // as a missing letter); targets already hit are left alone
    for (const a of keep) {
      if (a.kind === 'blimp' || a.hit) continue;
      a.gone = rings.some((l) => Math.hypot(a.x - l.x, a.y - l.y) < T.letterClear + (a.r || 0));
    }
    r.air = keep.concat(rings).sort((a, b) => a.x - b.x);
    r.airLo = 0;
  }

  function start(cfg = {}) {
    const { car, stats, track } = cfg;
    if (!car || !stats || !track) throw new Error('game.start needs { car, stats, track, seed }');
    teardown();
    const seed = (Number(cfg.seed) | 0) >>> 0;
    const course = createCourse(track, seed);
    const bd = R.createBackdrop(track, seed);
    bd.baseY = 0; // terrain baseline: the horizon sits low when the camera is high up
    const gMul = track.gravity || 1;
    // v3.3: optional skin {body, accent, decal} / sticker {glyph, color}; ids are accepted too
    const look = resolveLook(car, { skin: cfg.skin || null, sticker: cfg.sticker || null });
    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: (9.81 * gMul * S) / 1e6 },
      positionIterations: 8, velocityIterations: 8, constraintIterations: 4, enableSleeping: false,
    });
    const r = {
      car, stats, track, seed, course, bd, engine, world: engine.world,
      look, // v3.3 cosmetics: {skin, sticker} (cosmetics.js entries or null = stock)
      geom: Object.assign(carGeometry(car, look), { rim: bd.night ? 'rgba(225,232,255,0.9)' : null }), gMul, trackGrip: track.grip || 1,
      phase: 'ramp', t: 0, runT: 0, realT: 0,
      com: { x: 0, y: 0, vx: 0, vy: 0 }, speed: 0, ang: 0, omega: 0, speedNow: 0,
      maxX: 0, distance: 0,
      airTime: 0, totalAir: 0, flightRot: 0, flipMark: 0, flightFlips: 0, prevAngle: 0,
      flips: 0, frontFlips: 0, backFlips: 0, flipCash: 0, bigAirRaw: 0, cleanFlips: 0,
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
      // v2
      propById: new Map(), timers: [], pool: [], boomLoad: 0, boomLoadT: 0, fxRand: mulberry32((seed ^ 0xdeb715) >>> 0),
      combo: { count: 0, mult: 1, timer: 0, extra: 0, paid: 0 }, comboRaw: 0, bestCombo: 0, airRaw: 0,
      explosions: 0, maxChain: 0, kick: { x: 0, y: 0 }, wantDamage: 0, damageT: -9, lost: {}, damage: 0,
      air: course.airTargets.map((a) => ({ ...a, hit: false, hitT: 0, ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, spin: 0 })), airLo: 0,
      rings: 0, coins: 0, airHits: 0, rejumps: 0, coinPopT: -9,
      alt: 0, maxAlt: 0, flightPeak: 0, orbitFlight: false, orbitPaid: 0, orbits: 0, flightKind: null,
      best: Number(cfg.bestDistance) > 0 ? Number(cfg.bestDistance) : 0, recordHit: false, recordT: 0,
      cine: null, cineT: 0, chaseT: 0, letterbox: 0, flash: 0, flashCol: '255,255,255', radial: 0, spaceK: 0,
      fireworks: [], slowScale: 1, slowmoDur: T.slowmoDur, px: 0, py: 0, camFin: 0,
      speedLines: Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), len: 0.5 + Math.random(), w: 1 + Math.random() * 2 })),
      dustColor: shade(track.theme.ground, luminance(track.theme.ground) > 0.8 ? -0.08 : 0.18),
      // v3 (Spell Jump): launch power from the spelling result, letter rings, parked start
      powerScale: scaleArg(cfg.powerScale, 1.25), nitroScale: scaleArg(cfg.nitroScale, 1.5),
      letters: lettersArg(cfg.letters), letterHit: [], lettersCollected: 0, wordDone: false, letterFitIn: 0,
      parked: true, parkPose: null,
      // R1: no letter glyph is drawn and getState().letters reveals nothing until the car leaves the ramp lip
      // (phase 'air'): the rings show '?' while the child may still be spelling behind the panel
      lettersRevealed: false, glyphLeaks: 0,
      // Grand Finale: decided at the run end (a dedicated seeded roll, so replays agree), see startFinale
      finale: null, finaleRaw: 0, finaleRoll: mulberry32((seed ^ 0xf1a1e5) >>> 0)(), endT: 0, carGone: false, fxN: 0,
    };
    r.nitroFuel = r.nitroTank * r.nitroScale; // the tank can start above 100% (the bar clamps at full)
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
    settleParked(r);
    r.px = r.com.x; r.py = r.com.y;
    shakeMul = cfg.shake == null ? 1 : clamp(Number(cfg.shake) || 0, 0, 1);
    r.prevAngle = r.chassis.angle;
    manageChunks(r);
    layoutLetters(r, null);
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
        if (pr.role === 'deck' && r.phase !== 'done') {
          // a scaffold deck carries the car for a moment, then gives way under it
          if (!pr.collapseAt) pr.collapseAt = r.t + T.deckHold;
          r.contacts[carP.i] = true;
          r.touchTerrain = true;
          if (!r.nrm || carP.i > 0) r.nrm = { nx: pr.nx, ny: pr.ny };
          continue;
        }
        if (isStart && r.phase !== 'done' && r.speedNow > T.smashMin) {
          smash(r, pr, 'hit');
          pair.isActive = false;
        }
        continue;
      }
      r.contacts[carP.i] = true;
      if (other.t === 'terrain') { r.touchTerrain = true; if (!r.nrm || carP.i > 0) r.nrm = other; } else r.touchRamp = true;
    }
  }

  // how: 'hit' (the car ran into it), 'cascade' (its support was knocked out), 'blast' (explosion)
  function smash(r, pr, how = 'hit', blast = null) {
    if (pr.smashed) return;
    if (!blast && pr.fuse) blast = pr.fuse; // driven into while its fuse burns: still part of the chain
    pr.smashed = true;
    r.smashedIds.add(pr.id);
    for (const b of pr.bodies) { b.collisionFilter.mask = 0; b.plugin.rr.removed = true; r.pendingRemove.push(b); }
    const def = pr.def;
    const m = r.stats.coinMult;
    const live = r.phase !== 'done'; // after the finish event a chain still plays out, unpaid
    // combo chain: each smash within comboWindow of the previous one extends it
    const cb = live ? r.combo : { count: 0, timer: 0, extra: 0, mult: 1 };
    if (cb.timer > 0) cb.count++; else { cb.count = 1; cb.extra = 0; cb.paid = 0; }
    cb.timer = T.comboWindow;
    const mult = Math.min(T.comboMax, 1 + T.comboStep * (cb.count - 1));
    cb.mult = mult;
    const cash = Math.round(def.cash * m);
    const cx = pr.x + pr.nx * pr.h * 0.5, cy = pr.y + pr.ny * pr.h * 0.5;
    let extra = 0;
    if (live) {
      // the multiplier extra, within the per-run cap (a long depot chain can't outpay the rest of the run)
      extra = Math.max(0, Math.min(def.cash * (mult - 1), T.comboCap * (r.smashRaw + def.cash) - r.comboRaw));
      cb.extra += extra;
      r.comboRaw += extra;
      if (cb.count > r.bestCombo) r.bestCombo = cb.count;
      r.smashRaw += def.cash;
      r.smashed++;
      emit({ type: 'smash', kind: pr.kind, cash, x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 });
      if (cb.count >= 2) emit({ type: 'combo', count: cb.count, mult });
      const shown = Math.round((def.cash + extra) * m);
      cb.paid += shown;
      const col = mult >= 3 ? '#ff5a3c' : mult >= 2 ? '#ff9b2e' : mult > 1 ? '#ffd23f' : '#ffe14a';
      // a chain's running total and multiplier belong to the HUD combo badge (it can't drift into the HUD
      // band from here); the world only shows the first hit's cash
      if (cb.count < 2) popup(r, `+$${shown}`, cx, cy + pr.h * 0.5 + 0.8, col, 0.85, true);
    }
    if (how === 'hit' && !def.explosive) r.slowFactor *= 1 - clamp((def.mass * 0.12) / r.stats.mass, 0.01, 0.3); // explosives: the car blasts through
    r.shake = Math.max(r.shake, how === 'hit' ? 4 + def.mass * 6 : 3);
    // debris velocity: carried by the car, blown out by a blast, or just falling
    let vx = r.com.vx, vy = r.com.vy;
    let bx = 0, by = 0, bk = 0;
    if (how === 'blast' && blast) {
      const dx = cx - blast.x, dy = cy - blast.y, d = Math.hypot(dx, dy) || 1;
      bk = 14 * (1 - d / (T.blastR + 1));
      bx = (dx / d) * bk; by = (dy / d) * bk + 4;
      vx = 0; vy = 0;
    } else if (how === 'cascade') { vx *= 0.25; vy = 0; }
    const sr = r.fxRand;
    if (pr.kind === 'glass' || pr.kind === 'dome') {
      const nS = how === 'cascade' ? 8 : 16;
      for (let k = 0; k < nS; k++) {
        particle(r, 'shard', cx + (Math.random() - 0.5) * pr.w, cy + (Math.random() - 0.5) * pr.h,
          vx * (0.4 + Math.random() * 0.6) + bx + (Math.random() - 0.5) * 6, Math.random() * 8 + 1 + by,
          0.12 + Math.random() * 0.15, '#cdf3ff', 0.9 + Math.random() * 0.6);
      }
    }
    const piece = pr.form != null;
    for (let j = 0; j < pr.segs; j++) {
      const d = pr.sh * (j + 0.5);
      const px = pr.x + pr.nx * d, py = pr.y + pr.ny * d;
      let n = pr.segs > 1 ? 2 : pr.kind === 'glass' ? 1 : 3;
      if (piece) n = pr.role === 'deck' ? 3 : pr.kind === 'glass' ? 1 : 2;
      if (how === 'cascade' && n > 1) n--;
      for (let k = 0; k < n; k++) {
        const w = clamp(pr.w * (0.35 + sr() * 0.3), 0.15, pr.role === 'deck' ? 2.4 : 1.4);
        const h = clamp(pr.sh * (0.25 + sr() * 0.3), 0.12, 1.2);
        r.pendingSpawn.push({ x: px + (sr() - 0.5) * pr.w * 0.5, y: py + (sr() - 0.5) * pr.sh * 0.5, w, h,
          color: k === 0 && pr.kind === 'tnt' ? '#c9302c' : def.color,
          vx: vx * (0.55 + sr() * 0.5) + (sr() - 0.3) * 3 + bx * (0.7 + sr() * 0.6),
          vy: Math.max(vy, 0) * 0.3 + (how === 'cascade' ? sr() * 2 : 2 + sr() * 6) + by * (0.7 + sr() * 0.6) });
      }
    }
    const nd = how === 'hit' ? 8 : 4;
    for (let k = 0; k < nd; k++) {
      particle(r, 'dust', cx + (Math.random() - 0.5) * pr.w, cy + (Math.random() - 0.5) * pr.h,
        vx * 0.15 + (Math.random() - 0.5) * 3, Math.random() * 2, 0.4 + Math.random() * 0.4, r.dustColor, 0.7 + Math.random() * 0.5);
    }
    // structures: whatever rested on this piece comes down a moment later
    if (pr.form != null) {
      for (const q of r.props) {
        if (q.smashed || q.form !== pr.form || !q.sup || !q.sup.includes(pr.id) || q.collapseAt) continue;
        q.collapseAt = r.t + T.collapseDelay * (0.8 + 0.4 * sr());
      }
    }
    if (def.explosive) explode(r, pr, cx, cy, blast ? blast.chain : 0);
  }

  // Explosive prop went up: flash, shockwave, fire, radial impulse; other explosives in range
  // detonate chainDelay later (fixed-step timers, so a chain is deterministic).
  function explode(r, pr, x, y, chain) {
    const def = pr.def;
    const live = r.phase !== 'done';
    if (live) {
      r.explosions++;
      r.maxChain = Math.max(r.maxChain, chain);
      const cash = Math.round(def.cash * r.stats.coinMult);
      emit({ type: 'explosion', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, cash, chain });
    }
    blastArea(r, x, y, chain, pr);
    const R0 = T.blastR;
    // the car gets a modest kick (and loses a part if it was close)
    const dx = r.com.x - x, dy = r.com.y - y, dist = Math.hypot(dx, dy);
    if (dist < R0 && live) {
      const k = 1 - dist / R0;
      const ux = dist > 1e-3 ? dx / dist : 0, uy = dist > 1e-3 ? dy / dist : 1;
      // mostly a hop: the horizontal part never brakes the car much (it usually drove into the drum)
      r.kick.x += clamp(ux * T.blastKick * k, 0, T.blastKick);
      r.kick.y += Math.max(0, uy) * T.blastKick * k * 0.4 + T.blastLift * k;
      if (dist < 4.5 && r.t - r.damageT > 0.6) { r.wantDamage = Math.max(r.wantDamage, 1); r.damageT = r.t; }
    }
    explosionFx(r, x, y, chain);
  }

  // A blast at (x, y): props within blastR are blown apart (explosives queued: chain reaction), loose
  // debris gets thrown. Shared by explosive props and the Grand Finale.
  function blastArea(r, x, y, chain, skip) {
    const R0 = T.blastR;
    const blast = { x, y, chain: chain + 1 };
    // props in range: explosives are queued (chain reaction), the rest are blown apart now
    for (const q of r.props) {
      if (q.smashed || q === skip) continue;
      const qx = q.x + q.nx * q.h * 0.5, qy = q.y + q.ny * q.h * 0.5;
      const d = Math.hypot(qx - x, qy - y);
      if (d > R0) continue;
      if (q.def.explosive) {
        if (!q.fuse) { q.fuse = blast; q.collapseAt = -1; r.timers.push({ at: r.t + T.chainDelay, kind: 'detonate', prop: q, blast }); }
      } else if (!q.collapseAt || q.collapseAt > r.t + 0.02) {
        r.timers.push({ at: r.t + 0.02 + (d / R0) * 0.06, kind: 'blast', prop: q, blast });
        q.collapseAt = -1; // claimed by the blast
      }
    }
    // debris in range gets thrown
    for (const d of r.debris) {
      const b = d.body;
      const dx = b.position.x / S - x, dy = -b.position.y / S - y, dist = Math.hypot(dx, dy);
      if (dist > R0 || dist < 1e-3) continue;
      const k = 12 * (1 - dist / R0);
      addV(b, (dx / dist) * k, (dy / dist) * k + 3);
    }
  }

  function explosionFx(r, x, y, chain) {
    r.shake = Math.max(r.shake, 12 + Math.min(8, chain * 2));
    // one flash per chain (the full-screen blend is the priciest thing a blast draws); later links just shake
    if (chain === 0) { r.flash = Math.max(r.flash, reducedMotion ? 0.14 : 0.26); r.flashCol = '255,232,170'; }
    // fx budget: a depot going up sets off a dozen blasts within a few frames. The first couple get the
    // full burst; while the load (decaying 4/s) stays high, later ones get a light burst and no shockwave
    // ring, so the worst frame of a chain stays cheap to draw (the blasts overlap on screen anyway).
    r.boomLoad = Math.max(0, r.boomLoad - (r.t - r.boomLoadT) * 4) + 1;
    r.boomLoadT = r.t;
    const full = r.boomLoad <= 2.2;
    // smoke first so the fireball draws over it
    for (let k = 0, n = full ? 5 : 2; k < n; k++) {
      particle(r, 'smoke', x + (Math.random() - 0.5) * 2.4, y + 0.5 + Math.random() * 1.5, (Math.random() - 0.5) * 3, 2 + Math.random() * 2.5,
        1.1 + Math.random() * 0.7, k % 2 ? '#3b3640' : '#5e5761', 1.6 + Math.random() * 1.2, 0.8);
    }
    if (full) particle(r, 'ring', x, y + 0.4, 0, 0, 0.8, '#fff6dc', 0.42, chain ? 0.45 : 0.8, 9.5);
    particle(r, 'fire', x, y + 0.6, 0, 1.5, 2.3, '#fff7c2', 0.2, 1); // the white-hot flashball
    for (let k = 0, n = full ? 9 : 4; k < n; k++) {
      const a = Math.random() * TAU, sp = 2 + Math.random() * 5;
      particle(r, 'fire', x + Math.cos(a) * 0.7, y + Math.sin(a) * 0.7 + 0.8, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 + 3,
        1.0 + Math.random() * 1.0, null, 0.5 + Math.random() * 0.45, 1);
    }
    for (let k = 0, n = full ? 12 : 5; k < n; k++) {
      const a = Math.random() * Math.PI, sp = 8 + Math.random() * 14;
      particle(r, 'spark', x, y + 0.3, Math.cos(a) * sp, Math.sin(a) * sp, 0.09 + Math.random() * 0.06,
        Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a', 0.5 + Math.random() * 0.5);
    }
  }

  // fixed-step timers: chain detonations, blast smashes, structure collapses
  function runTimers(r) {
    if (r.timers.length) {
      const due = [];
      r.timers = r.timers.filter((tm) => (tm.at <= r.t ? (due.push(tm), false) : true));
      due.sort((a, b) => a.at - b.at);
      for (const tm of due) {
        if (tm.prop.smashed) continue;
        smash(r, tm.prop, 'blast', tm.blast);
      }
    }
    for (let i = 0; i < r.props.length; i++) {
      const q = r.props[i];
      if (!q.smashed && q.collapseAt > 0 && q.collapseAt <= r.t) smash(r, q, 'cascade');
    }
  }

  function spawnDebrisBody(r, d) {
    while (r.debris.length >= MAX_DEBRIS) {
      const old = r.debris.shift();
      Composite.remove(r.world, old.body);
    }
    const o = {
      angle: d.angle != null ? d.angle : r.fxRand() * TAU, friction: 0.7, restitution: d.round ? 0.45 : 0.25, frictionAir: 0.005,
      collisionFilter: { category: CAT_DEBRIS, mask: CAT_TERRAIN }, label: 'debris', plugin: { rr: { t: 'debris' } },
    };
    const b = d.round ? Bodies.circle(d.x * S, -d.y * S, (d.w / 2) * S, o, 10) : Bodies.rectangle(d.x * S, -d.y * S, d.w * S, d.h * S, o);
    Body.setMass(b, 0.2);
    Body.setVelocity(b, { x: d.vx * U, y: -d.vy * U });
    Body.setAngularVelocity(b, d.spin != null ? d.spin : (r.fxRand() - 0.5) * 0.5);
    Composite.add(r.world, b);
    const life = d.life || 2.2 + r.fxRand() * 1.2;
    // finale pieces: piece = a car panel (car.js carPieces) or {wheel: radius}; trail = s of fire trail left
    r.debris.push({ body: b, w: d.w, h: d.h, color: d.color, life, max: life, round: !!d.round, piece: d.piece || null, trail: d.trail || 0 });
  }

  // ---------- fx ----------
  // pooled particles: dead ones go back to r.pool (no per-particle garbage during a chain reaction)
  function particle(r, type, x, y, vx, vy, size, color, life, alpha, extra = 0) {
    let p;
    if (r.particles.length >= MAX_PARTICLES) { p = r.particles.shift(); } else p = r.pool.pop() || {};
    p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.size = size; p.color = color;
    p.life = life; p.max = life; p.alpha = alpha; p.a = Math.random() * TAU; p.extra = extra;
    r.particles.push(p);
    return p;
  }
  // slot: a new popup replaces the live one in the same slot so texts never pile up
  function popup(r, text, x, y, color, scale = 1, world = false, life = 1.3, slot = null) {
    if (slot) r.popups = r.popups.filter((p) => p.slot !== slot && !(slot === 'cash' && p.slot === 'speed')); // cash and speed share a line
    if (slot === 'combo') r.popups = r.popups.filter((p) => !(p.world && !p.slot && p.t < 0.6 && Math.abs(p.x - x) < 8));
    if (world && !slot) {
      // stack over a fresh popup at the same spot instead of overprinting it
      for (const p of r.popups) if (p.world && p.t < 0.45 && Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 1.4) y = p.y + 1.5;
    }
    r.popups.push({ text, x, y, color, scale, world, t: 0, life, slot });
    if (r.popups.length > 10) r.popups.shift();
  }
  function slowmo(r, scale = T.slowmo, dur = T.slowmoDur) {
    if (reducedMotion) return;
    r.slowScale = scale;
    r.timeScale = scale;
    r.slowmoT = dur;
    r.slowmoDur = dur;
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
      r.timeScale = r.slowmoT > 0 ? r.slowScale : 1;
    }
    if (r.cineT > 0) {
      r.cineT -= STEP;
      if (r.cineT <= 0) { r.cine = null; r.chaseT = 0.7; } // snap back: the chase cam catches up
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
    if (r.parked) holdParked(r); // v3: static brake at the ramp top until the first GAS/NITRO
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
    runTimers(r);
    if (r.pendingRemove.length) { Composite.remove(r.world, r.pendingRemove); r.pendingRemove.length = 0; }
    if (r.pendingSpawn.length) { for (const d of r.pendingSpawn) spawnDebrisBody(r, d); r.pendingSpawn.length = 0; }
    if (r.slowFactor !== 1) {
      measure(r);
      addVelAll(r, r.com.vx * (r.slowFactor - 1), r.com.vy * (r.slowFactor - 1));
      r.slowFactor = 1;
    }
    if (r.kick.x || r.kick.y) {
      addVelAll(r, r.kick.x, r.kick.y);
      r.kick.x = 0; r.kick.y = 0;
      // a blast under the car spins it a little: the player has to catch it
      if (r.phase !== 'done') setOmegaAll(r, r.omega + 1.2 * (r.combo.count % 2 ? 1 : -1));
    }
    if (r.wantDamage > 0 && r.phase !== 'done') { knockPart(r, r.wantDamage); r.wantDamage = 0; }
    measure(r);
    if (!isFinite(r.com.x) || !isFinite(r.com.y) || !isFinite(r.speed)) {
      console.warn('[engine] non-finite car state; ending run');
      r.com.x = r.maxX; r.com.y = 0; r.com.vx = 0; r.com.vy = 0; r.speed = 0;
      if (r.phase !== 'done') endRun(r, 'error', true);
      return;
    }
    // hard safety cap on speed
    if (r.speed > 120) { const f = 120 / r.speed; addVelAll(r, r.com.vx * (f - 1), r.com.vy * (f - 1)); measure(r); }
    r.t += dt;
    if (r.combo.timer > 0) {
      r.combo.timer -= dt;
      if (r.combo.timer <= 0) endCombo(r);
    }
    if (r.phase !== 'done') logic(r, dt, pre);
    if (r.finale) finaleStep(r, dt);
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
    if (r.parked && (input.gas || input.nitro)) r.parked = false;
    const power = st.power * r.powerScale; // v3: launch power from the spelling result scales the drive
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
          const vTop = T.vTopBase * Math.pow(power, T.vTopExp);
          a = vTop > 0 ? T.rampDrive * power * Math.max(0, 1 - Math.pow(v / vTop, 8)) : 0;
        } else {
          a = T.groundDrive * power * Math.exp(-r.groundT / T.groundFade);
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
        const vTop = T.vTopBase * Math.pow(power, T.vTopExp);
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

    // v2: altitude above the surface under the car (0 while rolling), orbit, record, air targets
    r.alt = r.phase === 'ramp' ? 0 : Math.max(0, r.com.y - r.course.surfaceY(r.com.x) - r.restAlt);
    if (r.alt > r.maxAlt) r.maxAlt = r.alt;
    if (r.phase === 'air') {
      if (r.alt > r.flightPeak) r.flightPeak = r.alt;
      if (!r.orbitFlight && r.alt >= T.orbitAlt) {
        r.orbitFlight = true;
        r.orbitPaid = 0;
        r.orbits++;
        emit({ type: 'orbit', altitude: Math.round(r.alt) });
      }
    }
    if (r.best > 0 && !r.recordHit && r.distance >= r.best) {
      r.recordHit = true;
      r.recordT = r.realT;
      emit({ type: 'record' });
      const fy = r.course.groundY(r.best);
      confetti(r, r.best, fy + 6, 40, 6);
    }
    checkAirTargets(r);
    if (r.damage > 0 && Math.random() < 0.12 + 0.12 * r.damage) {
      const g = r.geom;
      const [hx, hy] = localToWorld(r, g.maxX - 0.7, g.minY + (g.maxY - g.minY) * 0.75);
      particle(r, 'smoke', hx, hy, -r.com.vx * 0.15 + (Math.random() - 0.5), 1 + Math.random(),
        0.25 + Math.random() * 0.2 + r.damage * 0.06, r.damage > 2 ? '#2e2a33' : '#5a5560', 0.9 + Math.random() * 0.5, 0.55);
    }

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
          popup(r, `NEW MAX ${Math.round(kmh)} km/h`, 0.5, LANE_SUB, '#7cf2ff', 0.62, false, 1.2, 'speed');
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
      if (r.letterFitIn > 0 && --r.letterFitIn === 0) layoutLetters(r, { x: r.com.x, y: r.com.y, vx: r.com.vx, vy: r.com.vy });
      r.airTime += dt;
      r.totalAir += dt;
      r.flightRot += r.chassis.angle - r.prevAngle;
      while (r.flightRot - r.flipMark >= TAU) { r.flipMark += TAU; flip(r, 'front'); }
      while (r.flightRot - r.flipMark <= -TAU) { r.flipMark -= TAU; flip(r, 'back'); }
      if (r.airTime > 0.15 && r.touchTerrain) land(r, pre);
    } else if (r.phase === 'ground') {
      r.groundT += dt;
      for (const k of r.course.kickers) {
        if (r.px < k.x1 && r.com.x >= k.x1 && r.speed > T.kickMinSpeed && r.com.y - r.course.groundY(k.x1) < r.restAlt + 1.6) { rejump(r, k); break; }
      }
      if (r.phase !== 'ground') { /* kicked into a new flight */ } else if (!anyDown) {
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
    r.px = r.com.x; r.py = r.com.y;

    if (!r.finishCrossed && r.com.x >= r.course.finish) {
      r.finishCrossed = true;
      emit({ type: 'finishLine' });
      popup(r, 'FINISH LINE!', 0.5, LANE_BIG, '#ffd23f', 1.2, false, 1.8, 'big');
      if (r.phase !== 'done') slowmo(r);
      celebrate(r);
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
    r.flightKind = 'hop';
    r.flightPeak = 0;
    r.orbitFlight = false;
  }

  // v2: a kicker lip starts a new scored flight (flips count, landing pays half bonus)
  function rejump(r, k) {
    beginFlight(r);
    r.flightKind = 'kicker';
    r.rejumps++;
    const kmh = Math.round(r.speed * 3.6);
    emit({ type: 'rejump', count: r.rejumps, speedKmh: kmh });
    r.popups = r.popups.filter((p) => p.world); // the HUD's REJUMP banner owns this moment: clear the landing text
    const ly = r.course.groundY(k.x1);
    particle(r, 'ring', k.x1, ly + 0.8, 0, 0, 0.4, '#ffffff', 0.45, 0.8, 7);
    for (let i = 0; i < 8; i++) {
      particle(r, 'dust', k.x1 - Math.random() * 2, ly + 0.2, -1 + Math.random() * 2, Math.random() * 2,
        0.4 + Math.random() * 0.4, r.dustColor, 0.6 + Math.random() * 0.4, 0.6);
    }
    r.shake = Math.max(r.shake, 4);
  }

  const PARTS = ['bumper', 'door', 'hubcap'];
  // v2 cosmetic damage: knock the next part off as a short-lived debris body, start a smoke trail
  function knockPart(r, n) {
    const g = r.geom;
    for (let k = 0; k < n; k++) {
      const part = PARTS.find((p) => !r.lost[p]);
      if (!part) return;
      r.lost[part] = true;
      r.damage++;
      emit({ type: 'damage', part });
      const sr = r.fxRand;
      let lx, ly, w, h, color, round = false;
      if (part === 'bumper') { lx = g.maxX - 0.2; ly = g.minY + 0.12; w = 0.9; h = 0.22; color = '#9aa0aa'; }
      else if (part === 'door') { lx = (g.winBox[0] + g.winBox[2]) / 2; ly = g.minY + (g.maxY - g.minY) * 0.4; w = 1.1; h = 0.6; color = g.color; }
      else { const wh = g.wheels[g.wheels.length - 1]; lx = wh.x; ly = wh.y; w = h = wh.r * 1.1; color = '#d7dbe3'; round = true; }
      const [wx, wy] = localToWorld(r, lx, ly);
      r.pendingSpawn.push({ x: wx, y: wy + 0.3, w, h, color, round, life: 3.2,
        vx: r.com.vx * 0.7 + (sr() - 0.5) * 5, vy: Math.max(0, r.com.vy) * 0.4 + 3 + sr() * 4 });
      sparks(r, wx, wy, 8);
    }
  }

  // ---- v2 air targets (logical sensors: rings/coins have no bodies; balloons/blimp are batted) ----
  function balloonBob(a, t) { return 0.35 * Math.sin(t * 1.4 + a.id * 1.7); }
  function checkAirTargets(r) {
    const A = r.air;
    if (!A.length) return;
    const x = r.com.x, y = r.com.y, px = r.px, py = r.py;
    const lo = Math.min(x, px) - 12, hi = Math.max(x, px) + 12;
    while (r.airLo < A.length && A[r.airLo].x < lo) r.airLo++;
    const sx = x - px, sy = y - py, sl = sx * sx + sy * sy;
    for (let i = r.airLo; i < A.length; i++) {
      const a = A[i];
      if (a.x > hi) break;
      if (a.hit || a.gone) continue;
      let hit;
      if (a.kind === 'blimp') {
        const dx = (x - a.x) / (a.r + 1.2), dy = (y - a.y) / (a.rh + 1.2);
        hit = dx * dx + dy * dy < 1;
      } else {
        const ay = a.kind === 'balloon' ? a.y + balloonBob(a, r.t) : a.y;
        // closest approach of the car centre this step
        let u = sl > 0 ? ((a.x - px) * sx + (ay - py) * sy) / sl : 0;
        u = clamp(u, 0, 1);
        const d = Math.hypot(px + sx * u - a.x, py + sy * u - ay);
        const rad = a.kind === 'ring' ? a.r : a.kind === 'coin' ? a.r + 1.35 : a.r + 1.5;
        hit = d < rad;
      }
      if (hit) { if (a.li != null) hitLetter(r, a); else hitAir(r, a); }
    }
  }
  // refill a fraction of the tank, capped at full, but never taking away a >100% start (nitroScale)
  function refillNitro(r, frac) {
    r.nitroFuel = Math.max(r.nitroFuel, Math.min(r.nitroTank, r.nitroFuel + r.nitroTank * frac));
  }
  // v3: a letter ring. Not an airTarget (no event, not in summary.rings/airTargets/rating); pays into cash.air.
  function hitLetter(r, a) {
    a.hit = true;
    a.hitT = r.realT;
    const m = r.stats.coinMult, N = r.letters.length, i = a.li;
    let inOrder = true;
    for (let j = 0; j < i; j++) if (!r.letterHit[j]) inOrder = false;
    r.letterHit[i] = true;
    r.lettersCollected++;
    r.airRaw += T.letterCash;
    refillNitro(r, T.letterNitro);
    const cash = Math.round(T.letterCash * m);
    emit({ type: 'letterRing', letter: a.letter, index: i, inOrder, cash, nitroRefill: T.letterNitro });
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * TAU;
      particle(r, 'spark', a.x + Math.cos(ang) * a.r * 0.8, a.y + Math.sin(ang) * a.r, Math.cos(ang) * 5 + r.com.vx * 0.3, Math.sin(ang) * 6,
        0.09, k % 2 ? '#e9fbff' : '#6ee7ff', 0.55);
    }
    popup(r, `+$${cash}`, a.x, a.y + a.r + 0.7, '#ffd23f', 0.8, true);
    if (i === N - 1 && inOrder) {
      r.wordDone = true;
      r.airRaw += T.wordCash;
      const wc = Math.round(T.wordCash * m);
      emit({ type: 'wordComplete', cash: wc });
      // the big "WORD COMPLETE" text is the HUD's (one big text per moment); the engine adds the in-world
      // cash popup and a confetti burst at the last ring
      popup(r, `+$${wc}`, a.x + 1.5, a.y + a.r + 2.4, '#7dff6b', 1.05, true, 1.6);
      confetti(r, a.x, a.y, 50, 3);
    }
  }
  function hitAir(r, a) {
    a.hit = true;
    a.hitT = r.realT;
    const m = r.stats.coinMult;
    let raw = 0, refill = 0;
    if (a.kind === 'ring') {
      raw = T.ringCash; refill = T.ringNitro; r.rings++;
      refillNitro(r, T.ringNitro);
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * TAU;
        particle(r, 'spark', a.x + Math.cos(ang) * 0.6, a.y + Math.sin(ang) * a.r, Math.cos(ang) * 4 + r.com.vx * 0.3, Math.sin(ang) * 6,
          0.08, k % 2 ? '#fff3a0' : '#ffc93c', 0.5);
      }
      popup(r, '+25% NITRO', a.x, a.y - a.r - 0.6, '#7cf2ff', 0.62, true, 1.1);
    } else if (a.kind === 'coin') {
      raw = T.coinCash; r.coins++;
      particle(r, 'spark', a.x, a.y, r.com.vx * 0.3, 3, 0.07, '#ffe14a', 0.3);
    } else if (a.kind === 'balloon') {
      raw = T.balloonCash;
      const by = a.y + balloonBob(a, r.t);
      for (let k = 0; k < 10; k++) {
        const ang = Math.random() * TAU;
        particle(r, 'shard', a.x + Math.cos(ang) * 0.6, by + Math.sin(ang) * 0.7, Math.cos(ang) * 6 + r.com.vx * 0.3, Math.sin(ang) * 6,
          0.16 + Math.random() * 0.1, BALLOON_COLS[a.hue % BALLOON_COLS.length], 0.6 + Math.random() * 0.3);
      }
      particle(r, 'ring', a.x, by, 0, 0, 0.5, '#ffffff', 0.25, 0.8, 3);
    } else if (a.kind === 'blimp') {
      raw = T.blimpCash;
      a.vx = r.com.vx * 0.3; a.vy = r.com.vy * 0.3 + 1.5; a.spin = (r.com.vy > 0 ? 0.25 : -0.25);
      r.shake = Math.max(r.shake, 8);
      popup(r, 'BLIMP!', 0.5, LANE_BIG, '#ffe14a', 1.1, false, 1.4, 'big');
    }
    r.airRaw += raw;
    r.airHits++;
    const cash = Math.round(raw * m);
    emit({ type: 'airTarget', kind: a.kind, cash, nitroRefill: refill });
    if (a.kind !== 'coin' || r.coinPopT < r.realT - 0.25) {
      popup(r, `+$${cash}`, a.x, a.y + (a.kind === 'blimp' ? a.rh + 1 : a.kind === 'ring' ? a.r + 0.6 : 1.2), a.kind === 'coin' ? '#ffe14a' : '#ffd23f', a.kind === 'coin' ? 0.6 : 0.85, true);
      if (a.kind === 'coin') r.coinPopT = r.realT;
    }
  }

  // ---- v2 celebrations (visual only) ----
  function confetti(r, x, y, n, spread) {
    for (let k = 0; k < n; k++) {
      const ang = Math.PI * (0.15 + Math.random() * 0.7);
      const sp = 6 + Math.random() * 10;
      particle(r, 'confetti', x + (Math.random() - 0.5) * spread, y, Math.cos(ang) * sp, Math.sin(ang) * sp,
        0.24 + Math.random() * 0.14, CONFETTI[k % CONFETTI.length], 2.4 + Math.random() * 1.6, 1);
    }
  }
  function celebrate(r) {
    const F = r.course.finish;
    const gy = Math.min(r.course.groundY(F - 2.4), r.course.groundY(F + 2.4));
    confetti(r, F, gy + 7.5, 90, 5);
    const n = 4;
    for (let i = 0; i < n; i++) {
      r.fireworks.push({ at: r.realT + 0.2 + i * 0.42, x: F + [-5, 6, -1.5, 3.5][i], y: r.course.groundY(F) + 0.5,
        col: FW_COLS[i % FW_COLS.length], h: 12 + (i % 2) * 4 + Math.random() * 3 });
    }
  }

  function launch(r) {
    beginFlight(r);
    const k = 1 + T.launchKick * r.stats.launchBoost * r.powerScale;
    addVelAll(r, r.com.vx * (k - 1), r.com.vy * (k - 1));
    measure(r);
    r.launched = true;
    r.flightKind = 'jump';
    r.launchKmh = r.speed * 3.6;
    r.lettersRevealed = true; // R1: the letters appear only once the car is airborne
    if (r.letters.length) r.letterFitIn = T.letterFitSteps; // refit the letter arc once clear of the lip
    emit({ type: 'launch', speedKmh: Math.round(r.launchKmh) });
    for (let k2 = 0; k2 < 10; k2++) {
      particle(r, 'dust', r.com.x - 2 + Math.random() * 2, r.course.rampY(0) - 0.2, -2 + Math.random() * 4, Math.random() * 2,
        0.5 + Math.random() * 0.5, '#ffffff', 0.6 + Math.random() * 0.4, 0.6);
    }
    r.shake = Math.max(r.shake, 3);
    // the movie moment: slow-mo, letterbox, camera pull-back, sonic boom; then snap to the chase
    slowmo(r, T.launchSlowmo, T.launchSlowDur);
    r.cine = 'launch';
    r.cineT = reducedMotion ? 0.6 : T.launchSlowDur;
    particle(r, 'ring', r.com.x, r.com.y, 0, 0, 0.6, '#ffffff', 0.9, 0.95, 16);
    particle(r, 'ring', r.com.x, r.com.y, 0, 0, 0.3, '#bfe9ff', 0.7, 0.7, 9);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      particle(r, 'spark', r.com.x + Math.cos(a) * 1.2, r.com.y + Math.sin(a) * 1.2, Math.cos(a) * 14 + r.com.vx * 0.2, Math.sin(a) * 14,
        0.06, '#ffffff', 0.35, 0.9);
    }
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
    popup(r, `${word}${dir === 'front' ? 'FRONTFLIP' : 'BACKFLIP'}!`, 0.5, LANE_BIG, dir === 'front' ? '#ffb13d' : '#ff5ec4', 1.05, false, 1.3, 'big');
    popup(r, `+$${Math.round(cash * r.stats.coinMult)}`, 0.5, LANE_SUB, '#ffe14a', 0.7, false, 1.3, 'cash');
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
    // v3.3 altitude: $8 x this flight's peak altitude above terrain, paid on landing (cash.air)
    const peak = r.flightPeak;
    r.airRaw += T.altCash * peak;
    // v3.3 Big Air: paid once per flight on landing (crash landings too: the air was earned)
    const tierDef = T.bigAir.find(([min]) => r.airTime >= min);
    if (tierDef) {
      r.bigAirRaw += tierDef[1];
      emit({ type: 'bigAir', tier: tierDef[2], airTime: Math.round(r.airTime * 100) / 100, cash: Math.round(tierDef[1] * st.coinMult) });
    }
    r.phase = 'ground';
    r.noContactT = 0;
    r.landing = q;
    if (q !== 'crash') r.cleanFlips += r.flightFlips; // rating: only flips the car came down from count
    if (q !== 'crash') {
      // the suspension soaks the hit: no bounce, speed kept along the ground
      r.assistT = 0.45;
      redirectAlongGround(r, pre, q === 'perfect' ? 1 : q === 'good' ? 0.96 : 0.85);
      setOmegaAll(r, clamp(r.omega, -1.5, 1.5)); // wheels down: the spin dies in the springs
    }
    const jump = !r.firstLanding; // the landing bonus is paid for the big jump only, not for later hops
    if (jump) { r.firstLanding = q; r.groundT = 0; }
    // v2: a kicker flight's landing is scored again at half bonus
    const kicker = !jump && r.flightKind === 'kicker';
    const scale = jump ? 1 : kicker ? T.kickerBonus : 0;
    r.flightKind = 'hop';
    const bonus = scale * (q === 'perfect' ? 300 : q === 'good' ? 100 : 0);
    r.landingRaw += bonus;
    emit({ type: 'land', quality: q, impact: Math.round(impact * 10) / 10, peak: Math.round(peak * 1000) / 1000 });
    const cx = r.com.x, cy = r.com.y;
    const pay = Math.round(bonus * st.coinMult);
    if (!scale && (q === 'perfect' || q === 'good')) {
      // a hop over a crest: acknowledge it, no bonus and no slow-mo
      if (r.airTime > 0.8) popup(r, q === 'perfect' ? 'CLEAN HOP' : 'NICE HOP', 0.5, LANE_BIG, '#c6ff8a', 0.8, false, 1.1, 'big');
    } else if (q === 'perfect') {
      popup(r, 'PERFECT LANDING!', 0.5, LANE_BIG, '#7dff6b', 1.1, false, 1.6, 'big');
      popup(r, `+$${pay}`, 0.5, LANE_SUB, '#ffe14a', 0.75, false, 1.3, 'cash');
      slowmo(r, T.slowmo, T.landSlowDur);
      r.radial = reducedMotion ? 0.35 : 0.7;
    } else if (q === 'good') {
      popup(r, 'GOOD LANDING', 0.5, LANE_BIG, '#c6ff8a', 0.95, false, 1.3, 'big');
      popup(r, `+$${pay}`, 0.5, LANE_SUB, '#ffe14a', 0.7, false, 1.3, 'cash');
    } else if (q === 'rough') {
      popup(r, 'ROUGH LANDING', 0.5, LANE_BIG, '#ffb36b', 0.9, false, 1.3, 'big');
      sparks(r, cx, cy - 0.6, 14);
    } else {
      popup(r, 'CRASH!', 0.5, LANE_BIG, '#ff4d4d', 1.3, false, 1.6, 'big');
      r.slowFactor *= 0.62;
      knockPart(r, impact > thr ? 2 : 1);
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
    const stunts = Math.round((r.flipCash + T.airTimeCash * r.totalAir + r.bigAirRaw + r.finaleRaw) * m);
    const smash = Math.round(r.smashRaw * m);
    const landing = Math.round(r.landingRaw * m);
    const combo = Math.round(r.comboRaw * m);
    const air = Math.round(r.airRaw * m);
    return { distance, stunts, smash, landing, combo, air, total: distance + stunts + smash + landing + combo + air };
  }

  function endCombo(r) {
    const cb = r.combo;
    if (cb.count >= 3) emit({ type: 'comboEnd', count: cb.count, mult: cb.mult, cash: Math.round(cb.extra * r.stats.coinMult) });
    cb.count = 0; cb.mult = 1; cb.extra = 0; cb.timer = 0;
  }

  // instant: end now without a Grand Finale (stop(), errors)
  function endRun(r, reason, instant = false) {
    if (r.phase === 'done') return;
    endCombo(r); // a chain still running when the run ends is closed (and reported) first
    r.phase = 'done';
    r.endReason = reason;
    r.nitroOn = false;
    r.endT = r.t;
    if (!instant && wantFinale(r, reason)) { startFinale(r); return; }
    emitFinish(r);
  }

  function emitFinish(r) {
    if (r.summary) return;
    const cash = cashBreakdown(r);
    const summary = {
      distance: Math.round(r.distance * 10) / 10,
      airTime: Math.round(r.totalAir * 100) / 100,
      flips: r.flips, frontFlips: r.frontFlips, backFlips: r.backFlips,
      smashed: r.smashed,
      maxSpeedKmh: Math.round(r.maxKmh),
      landing: r.firstLanding,
      finishCrossed: r.finishCrossed,
      cash,
      durationSec: Math.round(r.endT * 10) / 10,
      // v2
      rating: 'D', ratingScore: 0, // set below (src/data/rating.js)
      maxAltitude: Math.round(r.maxAlt * 10) / 10,
      bestCombo: r.bestCombo,
      explosions: r.explosions,
      rings: r.rings,
      coins: r.coins,
      airTargets: r.airHits,
      rejumps: r.rejumps,
      // v3
      letters: { collected: r.lettersCollected, total: r.letters.length, inOrder: r.wordDone },
      finale: !!(r.finale && r.finale.boomed), // the car went up in a Grand Finale (cash.stunts holds its bonus)
    };
    summary.ratingScore = ratingScore({ ...summary, cleanFlips: r.cleanFlips }, r.course.finish);
    summary.rating = ratingLetter(summary.ratingScore);
    r.summary = summary;
    emit({ type: 'finish', summary });
  }

  // ---------- Grand Finale ----------
  // Crash ends (upside-down rest, or the last landing was a crash) always go up; other ends roll the run's
  // seeded finaleRoll against finaleChance. A car that fell off the world, or an error, never does.
  function wantFinale(r, reason) {
    if (reason === 'fell' || reason === 'error' || !r.launched) return false;
    if (reason === 'upside-down' || r.landing === 'crash') return true;
    return r.finaleRoll < finaleChance;
  }
  // Sequence (finale clock in real fixed steps, so slow-mo can't stretch it): 0 .. finaleWobble the car
  // shakes, swells and smokes (finaleWhine), then KABOOM (finale event, +$150 x coinMult into stunts); the
  // finish event fires at finaleDur. The physics, pieces and the parachuting driver carry on after it.
  function startFinale(r) {
    r.finale = { t: 0, boomed: false, boomAt: 0, x: r.com.x, y: r.com.y, ring2: false, driver: null, lobes: null, spikes: null };
    emit({ type: 'finaleWhine' });
  }
  function finaleStep(r, dt) {
    const f = r.finale;
    f.t += STEP;
    const n = r.fxN++;
    if (!f.boomed) {
      f.x = r.com.x; f.y = r.com.y;
      const k = f.t / T.finaleWobble;
      if (n % 3 === 0) {
        const g = r.geom;
        const [hx, hy] = localToWorld(r, g.maxX - 0.6 - Math.random() * (g.maxX - g.minX) * 0.6, g.beltY);
        particle(r, 'smoke', hx, hy, (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 1.5, 0.3 + 0.25 * k + Math.random() * 0.15,
          n % 2 ? '#4a4550' : '#77707c', 0.7 + Math.random() * 0.4, 0.75);
      }
      if (n % 5 === 0) sparks(r, f.x + (Math.random() - 0.5) * 1.5, f.y, 2);
      r.shake = Math.max(r.shake, 2 + 4 * k);
      if (f.t >= T.finaleWobble - 1e-9) finaleBoom(r);
    } else {
      const u = f.t - f.boomAt;
      if (!f.ring2 && u >= 0.1) {
        f.ring2 = true;
        particle(r, 'ring', f.x, f.y + 0.6, 0, 0, 0.6, '#ffe9a8', 0.6, 0.8, 10.5);
      }
      // the lingering smoke column
      if (u > 0.3 && u < 1.6 && n % 4 === 0) {
        particle(r, 'smoke', f.x + (Math.random() - 0.5) * 1.8, f.y + 1.5 + u * 2.5, (Math.random() - 0.5) * 0.8, 2.2 + Math.random() * 1.2,
          0.55 + Math.random() * 0.4 + u * 0.25, n % 8 ? '#6d6672' : '#8c8591', 1.5 + Math.random() * 0.7, 0.55);
      }
      // the flying pieces leave fire trails
      if (n % 3 === 0) {
        for (const d of r.debris) {
          if (!(d.trail > 0)) continue;
          d.trail -= STEP * 3;
          const b = d.body;
          particle(r, 'fire', b.position.x / S, -b.position.y / S, 0, 0.5, 0.32 + Math.random() * 0.12, null, 0.28 + Math.random() * 0.12, 1);
        }
      }
    }
    if (f.driver) stepDriver(r, f.driver, dt);
    if (!r.summary && f.t >= T.finaleDur - 1e-9) emitFinish(r);
  }
  function finaleBoom(r) {
    const f = r.finale, g = r.geom, sr = r.fxRand;
    f.boomed = true;
    f.boomAt = f.t;
    const x = r.com.x, y = r.com.y;
    f.x = x; f.y = y;
    r.finaleRaw = T.finaleCash;
    emit({ type: 'finale', cash: Math.round(T.finaleCash * r.stats.coinMult) });
    // crates and drums nearby go too (unpaid: the run is over), and loose debris gets thrown
    blastArea(r, x, y, 0, null);
    // the chassis flies apart: panels in the car's (skin) colours, then every wheel
    const vx0 = clamp(r.com.vx, -6, 6) * 0.3;
    for (const p of carPieces(g)) {
      const [wx, wy] = localToWorld(r, p.cx, p.cy);
      const dx = wx - x, dy = wy - y, dd = Math.hypot(dx, dy) || 1;
      const sp = 7 + sr() * 6;
      spawnDebrisBody(r, { x: wx, y: wy, w: p.w, h: p.h, angle: r.chassis.angle, piece: p, color: p.color, trail: 0.55 + sr() * 0.35,
        vx: vx0 + (dx / dd) * sp + (sr() - 0.5) * 3, vy: Math.max(0, dy / dd) * sp * 0.6 + 8 + sr() * 7,
        spin: (sr() < 0.5 ? -1 : 1) * (0.18 + sr() * 0.22), life: 2.6 + sr() * 0.8 });
    }
    const spoke = luminance(g.accent) > 0.7 ? '#8a8f9c' : g.accent;
    for (let i = 0; i < r.wheels.length; i++) {
      const w = r.wheels[i], rad = r.wheelR[i];
      const wx = w.position.x / S, wy = -w.position.y / S;
      const side = wx >= x ? 1 : -1;
      spawnDebrisBody(r, { x: wx, y: wy, w: rad * 2, h: rad * 2, round: true, color: '#23222b', trail: 0.4,
        piece: { wheel: rad, spoke, noHub: i === r.wheels.length - 1 && !!r.lost.hubcap },
        vx: vx0 + side * (4 + sr() * 5), vy: 9 + sr() * 6, spin: -side * (0.25 + sr() * 0.2), life: 3 + sr() * 0.6 });
    }
    // the car itself leaves the world (its bodies stay put for the camera)
    Composite.remove(r.world, [r.chassis, ...r.wheels, ...r.cons]);
    r.carGone = true;
    // the tiny driver ejects and floats down on a parachute
    f.driver = { x, y: y + 0.6, vx: 2.6 + clamp(r.com.vx * 0.08, -1.5, 1.5), vy: 8.5, t: 0, open: 0, rot: 0, landed: false, landT: 0 };
    // fx: cartoon fireball (drawn in render), two shockwave rings, flash, shake, fire, sparks, smoke, KABOOM
    f.lobes = [9, 7, 5].map((nl) => Array.from({ length: nl }, (_, i) => ({ a: (i / nl) * TAU + Math.random() * 0.5, d: 0.5 + Math.random() * 0.25, r: 0.45 + Math.random() * 0.2 })));
    f.spikes = Array.from({ length: 16 }, () => 0.7 + Math.random() * 0.5);
    r.boomLoad += 2; // a prop chain set off by the finale gets the light bursts
    r.boomLoadT = r.t;
    r.shake = Math.max(r.shake, 26);
    if (!reducedMotion) { r.flash = Math.max(r.flash, 0.62); r.flashCol = '255,255,255'; }
    particle(r, 'ring', x, y + 0.5, 0, 0, 1, '#ffffff', 0.75, 0.95, 15);
    for (let k = 0; k < 4; k++) {
      particle(r, 'smoke', x + (Math.random() - 0.5) * 3, y + 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 2.5 + Math.random() * 2,
        1.4 + Math.random() * 0.8, k % 2 ? '#3b3640' : '#5e5761', 1.8 + Math.random() * 1, 0.75);
    }
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * TAU, sp = 4 + Math.random() * 7;
      particle(r, 'fire', x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.2 + 1, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 + 4,
        0.8 + Math.random() * 0.7, null, 0.5 + Math.random() * 0.5, 1);
    }
    for (let k = 0; k < 22; k++) {
      const a = Math.random() * Math.PI * 1.1 - 0.05, sp = 10 + Math.random() * 16;
      particle(r, 'spark', x, y + 0.5, Math.cos(a) * sp, Math.sin(a) * sp, 0.1 + Math.random() * 0.08,
        k % 3 ? '#ffd23f' : '#ff7a1a', 0.5 + Math.random() * 0.6);
    }
    // over the fireball (the band under the top bar is the HUD's GRAND FINALE banner)
    popup(r, 'KABOOM!', x, y + 1.4, '#ffe14a', 1.7, true, 1.3);
  }
  function stepDriver(r, d, dt) {
    d.t += dt;
    if (d.landed) { d.landT += dt; d.open = Math.max(0, d.open - dt * 2); return; }
    if (d.t < 0.4) {
      d.vy -= 9.81 * dt; // thrown clear, tumbling
      d.rot += dt * 11;
    } else {
      // pop! the canopy opens and the drop slows to a gentle float
      d.open = Math.min(1, d.open + dt * 3.2);
      const k = 1 - Math.exp(-dt * 4.5);
      d.vy += (-2.3 - d.vy) * k;
      d.vx += (0.8 - d.vx) * k * 0.5;
      d.rot = wrapPi(d.rot) * Math.exp(-dt * 9);
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const gy = r.course.surfaceY(d.x);
    if (d.vy < 0 && d.y - gy <= 0.62) {
      d.y = gy + 0.62;
      d.landed = true;
      d.rot = 0;
      for (let k = 0; k < 6; k++) {
        particle(r, 'dust', d.x + (Math.random() - 0.5) * 1.2, gy + 0.1, (Math.random() - 0.5) * 2, Math.random(), 0.25 + Math.random() * 0.2, r.dustColor, 0.5 + Math.random() * 0.3, 0.6);
      }
    }
  }

  // ---------- camera ----------
  function updateCamera(r, dt, snap) {
    const c = r.com;
    const sp = r.speed;
    const surf = r.course.surfaceY(c.x);
    const alt = Math.max(0, c.y - surf);
    let visH = 14 + sp * 0.22 + alt * 1.05;
    if (r.phase === 'ramp' && sp < 5) visH = Math.max(visH, 30 - sp * 2);
    if (r.cine === 'launch') visH *= 1.55; // launch: the camera pulls back while time slows
    visH = clamp(visH, 14, 170);
    // landscape: fit visH vertically; portrait: fit a slightly wider span horizontally
    const z = view.H > view.W ? view.W / (visH * 1.2) : Math.min(view.H / visH, view.W / (visH * 1.55));
    const visW = view.W / z, visHH = view.H / z;
    const lx = clamp(c.vx * 0.45, -22, 22), ly = clamp(c.vy * 0.35, -16, 16);
    let tx = c.x + lx + visW * 0.12;
    let ty = c.y + ly;
    if (r.phase === 'ramp') ty -= visHH * 0.14;
    const gAhead = Math.min(surf, r.course.surfaceY(tx));
    ty = Math.min(ty, gAhead - 1.5 + visHH / 2);
    ty = clamp(ty, c.y + 2.5 - visHH / 2, c.y - 2.5 + visHH / 2);
    // finish: ease out so the banner (and the fireworks over it) and the car share the frame
    let fz = z;
    const F = r.course.finish;
    const finTarget = r.finishCrossed && c.x - F < 140 && c.x - F > -5 ? 1 : 0;
    if (!snap) r.camFin += (finTarget - r.camFin) * (1 - Math.exp(-dt * (finTarget ? 2.6 : 1.2)));
    if (r.camFin > 0.001) {
      const gy = r.course.groundY(F);
      const yTop = gy + 24, yBot = Math.min(gy, c.y) - 3;
      const xL = Math.min(F - 8, c.x - 6), xR = Math.max(F + 8, c.x + 8);
      const needH = Math.max(yTop - yBot, (xR - xL) / (view.W / view.H), 14);
      const zf = Math.min(view.H / needH, view.W / (xR - xL));
      const k = r.camFin;
      tx = tx + ((xL + xR) / 2 - tx) * k;
      ty = ty + ((yTop + yBot) / 2 - ty) * k;
      fz = Math.exp(Math.log(z) + (Math.log(Math.min(z, zf)) - Math.log(z)) * k);
    }
    if (r.finale) {
      // Grand Finale: pull back to frame the blast, the flying pieces and the parachuting driver
      const f = r.finale, dr = f.driver;
      const top = Math.max(f.y + 10, dr ? dr.y + 4 : 0), bot = Math.min(r.course.surfaceY(f.x), f.y) - 3;
      const needH = clamp(top - bot, 22, 40);
      fz = view.H > view.W ? view.W / (needH * 1.2) : Math.min(view.H / needH, view.W / (needH * 1.55));
      tx = (dr ? f.x * 0.7 + dr.x * 0.3 : f.x) + 1;
      ty = (top + bot) / 2;
    }
    if (snap) { cam.x = tx; cam.y = ty; cam.z = fz; return; }
    // launch cine: the camera lags (the car crosses the frame in slow-mo), then the chase snaps back
    const fol = r.cine === 'launch' ? 1.6 : r.chaseT > 0 ? 9 : 5;
    const kp = 1 - Math.exp(-dt * fol), kz = 1 - Math.exp(-dt * (r.cine === 'launch' ? 4.5 : r.chaseT > 0 ? 3.5 : 2.2));
    cam.x += (tx - cam.x) * kp;
    cam.y += (ty - cam.y) * kp;
    cam.z = Math.exp(Math.log(cam.z) + (Math.log(fz) - Math.log(cam.z)) * kz);
    // hard keep-in-view (very fast cars)
    const hw = view.W / cam.z / 2 - 3, hh = view.H / cam.z / 2 - 2;
    cam.x = clamp(cam.x, c.x - hw, c.x + hw);
    cam.y = clamp(cam.y, c.y - hh, c.y + hh);
  }

  function updateFx(r, dt) {
    const sdt = dt * r.timeScale;
    const g = 9.81 * r.gMul;
    const ps = r.particles;
    let bursts = null;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= sdt;
      if (p.life <= 0) {
        if (p.type === 'rocket') (bursts || (bursts = [])).push(p.x, p.y, p.extra);
        r.pool.push(p);
        continue;
      }
      p.x += p.vx * sdt;
      p.y += p.vy * sdt;
      switch (p.type) {
        case 'dust': p.vx *= 1 - 1.5 * sdt; p.vy = p.vy * (1 - 1.5 * sdt) + 0.6 * sdt; break;
        case 'smoke': p.vx *= 1 - 1.2 * sdt; p.vy = p.vy * (1 - 0.8 * sdt) + 1.2 * sdt; break;
        case 'fire': p.vx *= 1 - 3 * sdt; p.vy = p.vy * (1 - 3 * sdt) + 3 * sdt; break;
        case 'ring': break;
        case 'confetti': p.vx *= 1 - 2.2 * sdt; p.vy = p.vy * (1 - 2.2 * sdt) - 3 * sdt; p.a += sdt * 9; break;
        case 'fw': p.vx *= 1 - 1.6 * sdt; p.vy = p.vy * (1 - 1.6 * sdt) - 2.5 * sdt; break;
        case 'rocket':
          p.vy -= 22 * sdt;
          if (Math.random() < 0.7) (bursts || (bursts = [])).push(p.x, p.y, -1);
          break;
        default: p.vy -= g * sdt; p.a += sdt * 8;
      }
      ps[j++] = p;
    }
    ps.length = j;
    if (bursts) {
      for (let i = 0; i < bursts.length; i += 3) {
        const x = bursts[i], y = bursts[i + 1], ci = bursts[i + 2];
        if (ci < 0) { particle(r, 'spark', x, y, (Math.random() - 0.5) * 2, -2, 0.08, '#ffe9a8', 0.35); continue; }
        const [c1, c2] = FW_COLS[ci];
        const n = 36;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + Math.random() * 0.15, sp = (k % 2 ? 15 : 10) + Math.random() * 2.5;
          particle(r, 'fw', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.26, k % 3 ? c1 : c2, 1.3 + Math.random() * 0.5, 1);
        }
        particle(r, 'fire', x, y, 0, 0, 0.7, c2, 0.12, 1);
        r.flash = Math.max(r.flash, 0.12);
        r.flashCol = '255,240,220';
      }
    }
    // finish-line fireworks launch on a schedule (visual only)
    if (r.fireworks.length) {
      r.fireworks = r.fireworks.filter((f) => {
        if (r.realT < f.at) return true;
        const v = Math.sqrt(2 * 22 * f.h);
        particle(r, 'rocket', f.x, f.y, (Math.random() - 0.5) * 2, v, 0.16, '#fff2c0', v / 22, 1, FW_COLS.indexOf(f.col));
        return false;
      });
    }
    // a batted blimp drifts off and deflates
    for (const a of r.air) {
      if (!a.hit || a.kind !== 'blimp') continue;
      a.ox += a.vx * dt; a.oy += a.vy * dt;
      a.vx *= 1 - 0.6 * dt; a.vy = a.vy * (1 - 0.6 * dt) - 1.2 * dt;
      a.rot += a.spin * dt;
    }
    for (const p of r.popups) p.t += dt;
    r.popups = r.popups.filter((p) => p.t < p.life);
    r.shake *= Math.exp(-dt * 7);
    // reduced motion: no shake, except a small one for the Grand Finale
    const shk = reducedMotion ? (r.finale ? Math.min(2, r.shake * shakeMul) : 0) : r.shake * shakeMul;
    if (shk < 0.2) { cam.sx = 0; cam.sy = 0; } else {
      cam.sx = (Math.random() - 0.5) * 2 * shk;
      cam.sy = (Math.random() - 0.5) * 2 * shk;
    }
    // cinematic overlays
    const lbTarget = r.cine === 'launch' ? 1 : 0;
    r.letterbox += (lbTarget - r.letterbox) * (1 - Math.exp(-dt * (lbTarget ? 14 : 5)));
    const fd = reducedMotion ? 10 : 6;
    r.flash *= Math.exp(-dt * fd);
    r.radial *= Math.exp(-dt * fd * 0.8);
    if (r.chaseT > 0) r.chaseT -= dt;
    // orbit: the sky darkens toward space as the car climbs, and eases back on the way down
    const spaceT = r.phase === 'done' ? 0 : smoothstep(T.orbitAlt * 0.62, T.orbitAlt * 1.25, r.alt);
    r.spaceK += (spaceT - r.spaceK) * (1 - Math.exp(-dt * 1.6));
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
  // v3 letter rings: drawn position (glides from the preview arc onto the refitted one), next letter to get
  function letterPos(a, t) {
    if (!(a.gx || a.gy)) return a;
    const u = 1 - smoothstep(0, T.letterGlide, t - a.glideT);
    if (u <= 0) { a.gx = 0; a.gy = 0; return a; }
    return { ...a, x: a.x + a.gx * u, y: a.y + a.gy * u };
  }
  function nextLetter(r) {
    for (let i = 0; i < r.letters.length; i++) if (!r.letterHit[i]) return i;
    return -1;
  }
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
    R.drawBackground(ctx, view, cam, bd, t, run ? run.spaceK : 0);
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
    for (const k of course.kickers) if (k.x2 > vis.x0 - 2 && k.x0 < vis.x1 + 2) R.drawKicker(ctx, course, k, lw, bd);
    for (const f of course.formationsIn(vis.x0 - 3, vis.x1 + 3)) if (f.frame) R.drawFormationBase(ctx, f, lw, t);
    R.drawFinish(ctx, course, vis, lw);
    if (run) {
      const r = run;
      if (r.best > 0 && r.best > vis.x0 - 8 && r.best < vis.x1 + 4) {
        R.drawBestFlag(ctx, course, r.best, t, r.recordHit, r.recordHit ? Math.min(1, (t - r.recordT) / 0.5) : 0, lw, z);
      }
      for (const pr of r.props) {
        if (pr.smashed || pr.x < vis.x0 - 9 || pr.x > vis.x1 + 9 || pr.y - 4 > vis.y1 || pr.y + (pr.h || 4) + 4 < vis.y0) continue;
        for (let j = 0; j < pr.bodies.length; j++) {
          const b = pr.bodies[j];
          ctx.save();
          ctx.translate(b.position.x / S, -b.position.y / S);
          ctx.rotate(-b.angle);
          R.drawPropPiece(ctx, pr.kind, pr.def, pr.w, pr.sh, j, pr.segs, lw, pr.role);
          ctx.restore();
        }
      }
      for (const d of r.debris) {
        const b = d.body;
        if (d.piece) continue; // Grand Finale pieces draw over the fireball (below)
        const x = b.position.x / S, y = -b.position.y / S;
        if (x < vis.x0 - 2 || x > vis.x1 + 2 || y < vis.y0 - 2 || y > vis.y1 + 2) continue;
        ctx.globalAlpha = clamp(d.life / 0.6, 0, 1);
        ctx.fillStyle = d.color;
        ctx.lineWidth = lw * 0.8;
        ctx.strokeStyle = R.OUT;
        if (d.round) {
          ctx.beginPath();
          ctx.arc(x, y, d.w / 2, 0, TAU);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-b.angle);
          ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
          ctx.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      // air targets behind the car (ring back halves, coins, balloons, blimp)
      const A = r.air;
      const airVis = (a, m) => a.x + m > vis.x0 && a.x - m < vis.x1 && a.y + m > vis.y0 && a.y - m < vis.y1;
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (a.kind === 'blimp') {
          const k = a.hit ? clamp((t - a.hitT) / 3, 0, 1) : 0;
          if (k < 1 && airVis({ x: a.x + a.ox, y: a.y + a.oy }, a.r + 3)) R.drawBlimp(ctx, a, lw, t, k, 'SPELL JUMP');
          continue;
        }
        if (a.gone || !airVis(a, 4)) continue;
        if (a.li != null) {
          const k = a.hit ? clamp((t - a.hitT) / 0.55, 0, 1) : 0;
          if (k < 1 && R.drawLetterRing(ctx, letterPos(a, t), t, 'back', lw, k, a.li === nextLetter(r), r.lettersRevealed) && !r.lettersRevealed) r.glyphLeaks++;
        } else if (a.kind === 'ring') {
          const k = a.hit ? clamp((t - a.hitT) / 0.45, 0, 1) : 0;
          if (k < 1) R.drawRing(ctx, a, t, 'back', lw, k);
        } else if (a.hit) continue;
        else if (a.kind === 'coin') R.drawCoin(ctx, a, t, lw);
        else if (a.kind === 'balloon') R.drawBalloon(ctx, a.x, a.y + 0.35 * Math.sin(r.t * 1.4 + a.id * 1.7), a, BALLOON_COLS[a.hue % BALLOON_COLS.length], lw, t);
      }
      if (!r.carGone) drawCar(r, lw);
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (a.kind !== 'ring' || a.gone || !airVis(a, 4)) continue;
        if (a.li != null) {
          const k = a.hit ? clamp((t - a.hitT) / 0.55, 0, 1) : 0;
          if (k < 1) R.drawLetterRing(ctx, letterPos(a, t), t, 'front', lw, k, a.li === nextLetter(r), r.lettersRevealed);
          continue;
        }
        const k = a.hit ? clamp((t - a.hitT) / 0.45, 0, 1) : 0;
        if (k < 1) R.drawRing(ctx, a, t, 'front', lw, k);
      }
      R.drawParticles(ctx, r.particles, vis);
      if (r.finale && r.finale.boomed) drawFinale(r, lw, vis); // over the smoke: a bright fireball, not a smudge
      if (r.finale && r.finale.driver) R.drawParachuter(ctx, r.finale.driver, lw, t, r.geom.accent);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const inten = clamp((r.speed - 22) / 30, 0, 1) * (r.phase === 'done' ? 0 : 1);
      if (inten > 0) R.drawSpeedLines(ctx, view, r.speedLines, inten, r.com.vx / (r.speed || 1), r.com.vy / (r.speed || 1));
      const toScreen = (x, y) => [(x - cam.x) * z + W / 2 + cam.sx, H / 2 - (y - cam.y) * z + cam.sy];
      if (r.radial > 0.01) { const [sx, sy] = toScreen(r.com.x, r.com.y); R.drawRadialFlash(ctx, view, sx, sy, r.radial); }
      R.drawFlash(ctx, view, r.flash, r.flashCol);
      if (r.timeScale < 1) R.drawVignette(ctx, view, clamp((r.slowmoT / r.slowmoDur) * 1.5, 0, 1));
      R.drawLetterbox(ctx, view, r.letterbox);
      R.drawPopups(ctx, r.popups, toScreen, view);
    }
  }

  const debrisCols = [];
  function debrisPath(d, x, y) {
    if (d.round) { const rr = d.w / 2; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU); return; }
    const a = d.body.angle, c = Math.cos(a), sn = Math.sin(a), hw = d.w / 2, hh = d.h / 2;
    // world y is flipped relative to Matter: a corner (u, v) lands at (x + u c + v s, y - u s + v c)
    ctx.moveTo(x - hw * c - hh * sn, y + hw * sn - hh * c);
    ctx.lineTo(x + hw * c - hh * sn, y - hw * sn - hh * c);
    ctx.lineTo(x + hw * c + hh * sn, y - hw * sn + hh * c);
    ctx.lineTo(x - hw * c + hh * sn, y + hw * sn + hh * c);
    ctx.closePath();
  }

  // Grand Finale after the boom: the cartoon fireball, then the car's panels and wheels flying over it
  function drawFinale(r, lw, vis) {
    const f = r.finale;
    const u = f.t - f.boomAt;
    R.drawFinaleBoom(ctx, f.x, f.y + 0.6, u, f.lobes, f.spikes, lw);
    const g = r.geom;
    for (const d of r.debris) {
      if (!d.piece) continue;
      const b = d.body;
      const x = b.position.x / S, y = -b.position.y / S;
      if (x < vis.x0 - 3 || x > vis.x1 + 3 || y < vis.y0 - 3 || y > vis.y1 + 3) continue;
      ctx.globalAlpha = clamp(d.life / 0.6, 0, 1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-b.angle);
      ctx.scale(1.4, 1.4); // cartoon: the flying panels read a size up
      if (d.piece.wheel) R.drawWheel(ctx, d.piece.wheel, lw / 1.4, d.piece.spoke, d.piece.noHub);
      else R.drawCarPiece(ctx, d.piece, g, lw / 1.4, clamp(1 - d.life / d.max, 0, 1));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
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
    // Grand Finale wobble: the car rattles and swells before it goes up
    const wob = r.finale && !r.finale.boomed ? clamp(r.finale.t / T.finaleWobble, 0, 1) : 0;
    if (wob > 0) {
      const tt = r.realT;
      const sw = 1 + 0.14 * wob * wob;
      ctx.translate(r.com.x + Math.sin(tt * 83) * 0.09 * wob, r.com.y + Math.sin(tt * 67 + 1) * 0.07 * wob);
      ctx.rotate(Math.sin(tt * 47) * 0.06 * wob);
      ctx.scale(sw * (1 + 0.03 * Math.sin(tt * 90)), sw * (1 - 0.03 * Math.sin(tt * 90)));
      ctx.translate(-r.com.x, -r.com.y);
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
    g.rim = r.bd.night || r.spaceK > 0.25 ? 'rgba(225,232,255,0.9)' : null; // dark cars stay readable in space
    R.drawChassis(ctx, g, lw, r.realT, r.nitroOn, r.damage ? r.lost : null);
    if (wob > 0) {
      // the paint glows hot and blinks red/white
      ctx.beginPath();
      ctx.moveTo(g.body[0][0], g.body[0][1]);
      for (let i = 1; i < g.body.length; i++) ctx.lineTo(g.body[i][0], g.body[i][1]);
      ctx.closePath();
      ctx.fillStyle = Math.sin(r.realT * 38) > 0 ? `rgba(255,60,30,${(0.55 * wob).toFixed(3)})` : `rgba(255,240,200,${(0.4 * wob).toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
    const spoke = luminance(g.accent) > 0.7 ? '#8a8f9c' : g.accent;
    for (let i = 0; i < r.wheels.length; i++) {
      const w = r.wheels[i];
      ctx.save();
      ctx.translate(w.position.x / S, -w.position.y / S);
      ctx.rotate(-w.angle);
      R.drawWheel(ctx, r.wheelR[i], lw, spoke, i === r.wheels.length - 1 && !!r.lost.hubcap);
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
      while (acc >= STEP && n < maxSteps && run === r) {
        const t0 = performance.now();
        tick(); acc -= STEP; n++;
        const tt = performance.now() - t0;
        if (tt > perf.maxTick) perf.maxTick = tt;
      }
      perf.ticks += n;
      if (n >= maxSteps) acc = 0; // accumulator cap: no spiral of death
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
      return { phase: 'done', distance: 0, speedKmh: 0, nitro: 0, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false, landing: null,
        altitude: 0, combo: { count: 0, mult: 1, timer01: 0 }, rejumps: 0, letters: { collected: 0, total: 0 } };
    }
    return {
      phase: r.phase,
      distance: Math.round(r.distance * 10) / 10,
      speedKmh: Math.round(r.speed * 3.6),
      nitro: r.nitroTank > 0 ? clamp(r.nitroFuel / r.nitroTank, 0, 1) : 0,
      airTime: Math.round(r.airTime * 100) / 100,
      flips: r.flips,
      smashed: r.smashed,
      cash: cashBreakdown(r).total,
      finishCrossed: r.finishCrossed,
      landing: r.landing,
      // v2
      altitude: Math.round(r.alt * 10) / 10,
      combo: { count: r.combo.count, mult: r.combo.mult, timer01: r.combo.count ? clamp(r.combo.timer / T.comboWindow, 0, 1) : 0 },
      rejumps: r.rejumps,
      // v3 (R1: nothing about the word, not even its length, before the car is airborne)
      letters: { collected: r.lettersCollected, total: r.lettersRevealed ? r.letters.length : 0 },
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
    // v3: the spelling result decides the launch power after start() (the scene shows behind the panel)
    setLaunchPower(powerScale, nitroScale) {
      const r = run;
      if (!r || r.phase !== 'ramp' || !r.parked || r.started || r.speed >= 0.5) {
        console.warn('[engine] setLaunchPower ignored: only allowed while the car is parked at the ramp top');
        return false;
      }
      r.powerScale = scaleArg(powerScale, 1.25);
      r.nitroScale = scaleArg(nitroScale, 1.5);
      r.nitroFuel = r.nitroTank * r.nitroScale;
      layoutLetters(r, null); // the preview arc follows the new power
      return true;
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); acc = 0; },
    stop() {
      if (run && run.phase !== 'done') endRun(run, 'stopped', true);
      else if (run && !run.summary) emitFinish(run); // mid Grand Finale: finish now
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
    debugPerf(reset = false) {
      const out = { ...perf };
      if (reset) { perf.frames = 0; perf.sim = 0; perf.draw = 0; perf.max = 0; perf.ticks = 0; perf.maxTick = 0; perf.maxDraw = 0; }
      return out;
    },
    debugInfo() {
      const r = run;
      if (!r) return null;
      return { x: r.com.x, y: r.com.y, vx: r.com.vx, vy: r.com.vy, ang: r.ang, omega: r.omega, phase: r.phase, bodies: Composite.allBodies(r.world).length,
        debris: r.debris.length, particles: r.particles.length, props: r.props.length, chunks: r.chunks.size, endReason: r.endReason, launchKmh: r.launchKmh, wd: r.wheelsDown, cd: r.chassisDown,
        timeScale: r.timeScale, lastLand: r.lastLand || null, cam: { ...cam }, perf: { ...perf },
        letterbox: r.letterbox, popups: r.popups.map((p) => ({ text: p.text, slot: p.slot, world: p.world, t: p.t, life: p.life, x: p.x, y: p.y, scale: p.scale })),
        letterRings: r.air.filter((a) => a.li != null).map((a) => ({ letter: a.letter, i: a.li, x: a.x, y: a.y, hit: a.hit })),
        lettersRevealed: r.lettersRevealed, glyphLeaks: r.glyphLeaks,
        finale: r.finale ? { t: r.finale.t, boomed: r.finale.boomed, x: r.finale.x, y: r.finale.y, driver: r.finale.driver && { ...r.finale.driver } } : null,
        finaleRoll: r.finaleRoll, finaleChance, flash: r.flash, carGone: r.carGone,
        goneTargets: r.air.filter((a) => a.gone).length,
        powerScale: r.powerScale, nitroScale: r.nitroScale, parked: r.parked, nitroFuel: r.nitroFuel, nitroTank: r.nitroTank,
        view: { W: view.W, H: view.H }, carHalf: Math.max(r.geom.maxX - r.geom.minX, r.geom.maxY - r.geom.minY) / 2 * Math.pow(clamp(10 / cam.z, 1, 3), 0.85) };
    },
  };
}
