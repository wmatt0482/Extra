// Headless Node checks of the phone-feel logic that needs no browser: the stick's dead zone and curve, the render
// interpolation between physics steps (including angle wrap-around and teleports), the follow camera's critically
// damped spring (it keeps up with a moving machine and does not overshoot when the machine stops) and the device tier
// table. Run with: node build-crew/tools/mobile-tests.mjs
import assert from 'node:assert/strict';
import { shapeStick } from '../src/controls.js';
import { Interpolator } from '../src/scene/interp.js';
import { CameraRig } from '../src/scene/camera.js';
import { TIERS } from '../src/scene/quality.js';

const close = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg || ''} expected ${b}, got ${a}`);

// ---- Stick: 12 % dead zone, smooth curve, direction kept ----
{
  const v = (x, y) => shapeStick(x, y, { x: 0, y: 0 });
  assert.deepEqual(v(0.11, 0), { x: 0, y: 0 }, 'inside the dead zone is nothing');
  assert.deepEqual(v(0.06, 0.09), { x: 0, y: 0 });
  const edge = v(0.1201, 0);
  assert(edge.x > 0 && edge.x < 0.001, 'just outside the dead zone starts from zero (no jump)');
  close(v(1, 0).x, 1, 1e-9, 'full deflection is full power');
  close(v(0.95, 0).x, 1, 1e-9, 'full power just before the rim');
  const half = v(0.5, 0).x,
    quarter = v(0.25, 0).x;
  assert(half > 0.2 && half < 0.5, 'mid deflection is gentle, for placing loads: ' + half);
  assert(quarter < half && quarter > 0);
  let last = -1;
  for (let r = 0; r <= 1.0001; r += 0.01) {
    const out = v(r, 0).x;
    assert(out >= last - 1e-12, 'monotonic');
    last = out;
  }
  const d = v(0.5, 0.5);
  close(d.x, d.y, 1e-12, 'diagonals keep their direction');
  console.log('PASS stick dead zone and curve');
}

// ---- Interpolator ----
{
  const mk = (x, yaw, qz = 0, qw = 1) => ({
    machines: [{ x, y: 0.7, z: 0, yaw, swing: 0, lift: 1, reach: 2.7, tilt: 0 }],
    poses: [{ id: 7, type: 'cube', color: '#c33', position: { x, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: qz, w: qw } }],
  });
  const state = mk(0, 0);
  const yard = { machines: state.machines };
  const blend = new Interpolator();
  blend.after(yard, state.poses);
  assert(blend.ready, 'the first snapshot is drawable');
  // One step: from 0 to 1 m. Halfway is 0.5 m, and the machine's real fields are restored afterwards.
  const next = mk(1, 0.2);
  yard.machines[0].x = 1;
  yard.machines[0].yaw = 0.2;
  blend.after(yard, next.poses);
  blend.alpha = 0.5;
  const view = blend.poses();
  close(view[0].position.x, 0.5, 1e-12, 'toy halfway');
  blend.apply(yard);
  close(yard.machines[0].x, 0.5, 1e-12, 'machine halfway');
  close(yard.machines[0].yaw, 0.1, 1e-12, 'yaw halfway');
  blend.restore(yard);
  assert.equal(yard.machines[0].x, 1);
  assert.equal(yard.machines[0].yaw, 0.2);
  // Alpha 1 is the new state, alpha 0 the old.
  blend.alpha = 1;
  close(blend.poses()[0].position.x, 1, 1e-12);
  blend.alpha = 0;
  close(blend.poses()[0].position.x, 0, 1e-12);
  // Several steps in a frame: before() records the state ahead of the last step.
  blend.before(yard, next.poses);
  const last = mk(2, 0.4);
  yard.machines[0].x = 2;
  yard.machines[0].yaw = 0.4;
  blend.after(yard, last.poses);
  blend.alpha = 0.5;
  close(blend.poses()[0].position.x, 1.5, 1e-12, 'blend between the last two steps, not the last two frames');
  // Angles take the short way round the circle.
  const wrap = mk(0, 3.1);
  yard.machines[0].yaw = 3.1;
  blend.reset();
  blend.after(yard, wrap.poses);
  yard.machines[0].yaw = -3.1;
  blend.after(yard, wrap.poses);
  blend.alpha = 0.5;
  blend.apply(yard);
  assert(Math.abs(Math.abs(yard.machines[0].yaw) - Math.PI) < 0.05, 'yaw wraps through pi, not through 0: ' + yard.machines[0].yaw);
  blend.restore(yard);
  // A teleport is drawn at once.
  blend.reset();
  yard.machines[0].x = 0;
  blend.after(yard, mk(0, 0).poses);
  yard.machines[0].x = 10;
  blend.after(yard, mk(10, 0).poses);
  blend.alpha = 0.5;
  close(blend.poses()[0].position.x, 10, 1e-12, 'toy teleport');
  blend.apply(yard);
  close(yard.machines[0].x, 10, 1e-12, 'machine teleport');
  blend.restore(yard);
  // Quaternions: the blend is normalised and takes the shorter arc.
  blend.reset();
  blend.after(yard, mk(0, 0, 0, 1).poses);
  blend.after(yard, mk(0, 0, Math.sin(0.4), Math.cos(0.4)).poses);
  blend.alpha = 0.5;
  const q = blend.poses()[0].rotation;
  close(Math.hypot(q.x, q.y, q.z, q.w), 1, 1e-9, 'unit quaternion');
  close(q.z, Math.sin(0.2), 1e-3, 'half the rotation');
  console.log('PASS interpolation between physics steps');
}

// ---- Follow camera: critically damped spring with velocity lead ----
{
  const rig = new CameraRig();
  const dt = 1 / 60;
  const machine = { x: 0, z: 0 },
    pad = { x: 0, z: 0 };
  rig.overview = false;
  // Settle at rest, then drive at 3.1 m/s for three seconds.
  for (let i = 0; i < 120; i++) rig.update(dt, machine, pad, false);
  const speed = 3.1;
  let worst = 0;
  for (let i = 0; i < 180; i++) {
    machine.z += speed * dt;
    rig.update(dt, machine, pad, false);
    if (i > 90) worst = Math.max(worst, Math.abs(rig.target.z - machine.z * 0.65));
  }
  assert(worst < 0.08, `the camera keeps up with a moving machine (steady lag ${worst.toFixed(3)} m)`);
  // Stop: the camera settles without swinging past the machine.
  const stopAt = machine.z * 0.65;
  let over = 0;
  for (let i = 0; i < 180; i++) {
    rig.update(dt, machine, pad, false);
    over = Math.max(over, rig.target.z - stopAt);
  }
  assert(over < 0.35, `no big overshoot when the machine stops (${over.toFixed(3)} m)`);
  close(rig.target.z, stopAt, 0.01, 'settled on the machine');
  // The spring is stable at a long frame (a phone at 15 fps).
  for (let i = 0; i < 60; i++) {
    machine.z += speed * 0.066;
    rig.update(0.066, machine, pad, false);
  }
  assert(Number.isFinite(rig.target.z) && Math.abs(rig.target.z - machine.z * 0.65) < 0.5);
  // Hopping to a machine 8 m away does not fling the camera.
  machine.x += 8;
  let fling = 0;
  for (let i = 0; i < 90; i++) {
    rig.update(dt, machine, pad, false);
    fling = Math.max(fling, rig.target.x - machine.x * 0.65);
  }
  assert(fling < 0.1, 'a jump does not overshoot: ' + fling);
  // Calm motion snaps.
  const calm = new CameraRig();
  calm.overview = false;
  machine.x = 5;
  calm.update(dt, machine, pad, true);
  close(calm.target.x, 5 * 0.65, 1e-9, 'reduced motion snaps');
  console.log('PASS follow camera spring');
}

// ---- Device tiers ----
{
  assert.equal(TIERS.phone.maxSteps, 2, 'a phone runs at most two physics steps a frame');
  assert.equal(TIERS.phone.shadowMap, 512);
  assert(TIERS.phone.particles < TIERS.desktop.particles);
  assert(TIERS.phone.interpolate && !TIERS.desktop.interpolate);
  assert(TIERS.phone.maxDpr <= 1.5);
  console.log('PASS device tier table');
}
console.log('All mobile checks passed.');
