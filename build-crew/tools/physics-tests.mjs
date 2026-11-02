// Headless Node checks of the real Rapier simulation and the save logic (SPEC §7): all ten jobs solved through the
// same production axes the browser uses (tools/solution.mjs), a tall stack that stays upright and falls asleep, grab
// range, held-toy exclusion and machine reset, chassis collision with a wall, the wrecking ball staying on its crane
// across hops, and the sync merge's commutativity, reset rule and bounds. Timings go to RESULTS_DIR.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resultsPath } from './runner.mjs';
import { performance } from 'node:perf_hooks';
import { initPhysics, Yard, DT, RAPIER, MACHINE, DUMP, FORK, bedAngle, gateAngle } from '../src/physics.mjs';
import { ROUNDS, SANDBOX, BLUEPRINTS, MACHINES, COLORS, TOYS, findJob, sandboxSpawns, LAB_MACHINES } from '../src/content.mjs';
import { Mission, Challenge, evaluate, standingHeight } from '../src/missions.mjs';
import { defaultSave, normalize, normalizeYard, mergeBc } from '../src/meta/save.mjs';
import { solve } from './solution.mjs';
import { createHash } from 'node:crypto';
await initPhysics();
const report = {};
let yard, mission;
const state = () => ({
  active: yard.active,
  held: yard.held?.id,
  blocks: yard.poses(),
  machines: yard.machines.map((m) => ({
    kind: m.kind,
    x: m.x,
    z: m.z,
    yaw: m.yaw,
    swing: m.swing,
    lift: m.lift,
    reach: m.reach,
    tip: { ...m.tip },
  })),
  status: mission.status,
  complete: mission.complete,
});
// Steps the simulation exactly as the game loop does: a physics step, then the mission check on the new poses.
const advance = (axes, n) => {
  for (let i = 0; i < n; i++) {
    yard.step(axes);
    mission.step(yard.poses(), yard.held?.id, DT);
  }
  return state();
};
for (const round of ROUNDS) {
  yard = new Yard(round);
  mission = new Mission(round);
  const start = performance.now();
  await solve({ state, advance, action: () => yard.grab(), select: (i) => yard.select(i) }, round.id);
  report[round.id] = {
    simulatedSeconds: Math.round(yard.time),
    cpuMs: Math.round(performance.now() - start),
    complete: mission.complete,
  };
  yard.destroy();
  console.log(`PASS job ${round.id}`);
}
// A tower must remain upright and sleeping without a grab. This is separate from mission flags.
yard = new Yard({
  ...SANDBOX,
  toys: Array.from({ length: 8 }, (_, i) => ({ type: 'cube', x: 5, y: 0.61 + i * 1.21, z: 5 })),
});
const t0 = performance.now();
for (let i = 0; i < 1200; i++) yard.step();
const poses = yard.poses(),
  maxDrift = Math.max(...poses.map((b) => Math.hypot(b.position.x - 5, b.position.z - 5)));
assert(maxDrift < 0.15);
assert(poses.every((b, i) => Math.abs(b.position.y - (0.6 + i * 1.2)) < 0.1));
report.stack = {
  blocks: 8,
  seconds: 20,
  maxDrift,
  cpuMs: performance.now() - t0,
  sleeping: yard.blocks.every((b) => b.body.isSleeping()),
};
assert(report.stack.sleeping);
assert(evaluate(ROUNDS[0], poses).done, 'a tall settled stack inside a delivery square counts');
yard.destroy();
console.log('PASS stable eight-block stack and sleep');
yard = new Yard(ROUNDS[0]);
for (let i = 0; i < 100; i++) yard.step();
assert.equal(yard.grab(), false, 'tool cannot grab remotely');
const first = yard.blocks[0];
first.body.setTranslation({ x: yard.tool.x, y: yard.tool.y, z: yard.tool.z }, true);
assert(yard.grab());
yard.step({ lift: 1 });
assert.equal(evaluate(ROUNDS[0], yard.poses(), first.id).done, false);
yard.resetMachine();
assert.equal(yard.held, null);
assert(yard.poses().every((b) => Number.isFinite(b.position.y)));
yard.destroy();
console.log('PASS grab range, held exclusion, recovery');
yard = new Yard({ ...ROUNDS[0], props: [{ x: -6, y: 1, z: 0, size: [4, 2, 0.6] }] });
for (let i = 0; i < 300; i++) yard.step({ drive: 1 });
assert(yard.machine.z < -1.5, 'assisted chassis stops at a solid wall');
yard.destroy();
console.log('PASS chassis obstacle collision');
yard = new Yard({ ...SANDBOX, machines: ['skid', 'excavator', 'crane'] });
yard.select(2);
yard.wreck();
const owner = yard.machine;
yard.select(0);
for (let i = 0; i < 120; i++) yard.step({ drive: 1 });
assert(
  Math.abs(yard.ball.translation().x - owner.tip.x) < 0.25,
  'wrecking ball stays attached to its crane when switching machines',
);
yard.destroy();
console.log('PASS wrecking-ball ownership across machine hops');
// Terrain stamps: what is drawn is what is solid. The hill's collider surface must follow the height machines ride
// on (groundAt), a cube dropped on its crown must rest on it, and a cube in a pit must settle at the bottom.
yard = new Yard({ ...SANDBOX, machines: ['skid'], toys: [] });
assert(yard.stamp('hill', 6, 6) && yard.stamp('pit', -6, 6));
yard.world.step();
for (const angle of [0, 0.26, 1.1, 2.4]) {
  for (const r of [0, 0.4, 0.9, 1.4, 1.8]) {
    const x = 6 + r * Math.sin(angle),
      z = 6 + r * Math.cos(angle),
      hit = yard.world.castRay(new RAPIER.Ray({ x, y: 5, z }, { x: 0, y: -1, z: 0 }), 10, true);
    assert(
      Math.abs(5 - hit.timeOfImpact - yard.groundAt(x, z)) < 0.08,
      `hill surface at r=${r} matches its ride height`,
    );
  }
}
assert(yard.groundAt(6, 6) > 0.5 && yard.groundAt(6, 6) < 0.7, 'a hill is a low mound');
assert.equal(yard.groundAt(-6, 6), -0.9, 'a pit is recessed');
yard.spawn({ type: 'cube', color: '#e65e4b', x: 6, y: 3, z: 6 });
yard.spawn({ type: 'cube', color: '#e65e4b', x: -6, y: 3, z: 6 });
for (let i = 0; i < 300; i++) yard.step();
const [onHill, inPit] = yard.poses();
assert(
  Math.abs(onHill.position.y - (yard.groundAt(onHill.position.x, onHill.position.z) + 0.6)) < 0.25,
  'a cube rests on the mound',
);
assert(onHill.position.y > 1 && onHill.position.y < 1.4);
assert(Math.abs(inPit.position.y - (-0.9 + 0.6)) < 0.1, 'a cube falls to the bottom of the pit');
yard.destroy();
console.log('PASS terrain stamps: mound and pit colliders match what is drawn');
// The ramp is a wedge: its collider surface follows groundAt along the whole slope, it is solid behind the high edge
// (a ray from above never lands below the slope), and a dropped cube comes to rest on it rather than inside it.
yard = new Yard({ ...SANDBOX, machines: ['skid'], toys: [] });
assert(yard.stamp('ramp', -6, -6));
yard.world.step();
for (const dx of [-1.8, 0, 1.8]) {
  for (const dz of [-1.9, -1, 0, 1, 1.9]) {
    const hit = yard.world.castRay(new RAPIER.Ray({ x: -6 + dx, y: 5, z: -6 + dz }, { x: 0, y: -1, z: 0 }), 10, true);
    assert(Math.abs(5 - hit.timeOfImpact - yard.groundAt(-6 + dx, -6 + dz)) < 0.05, `ramp surface at dz=${dz}`);
  }
}
assert(Math.abs(yard.groundAt(-6, -4.1) - 1.8) < 0.1 && yard.groundAt(-6, -7.9) < 0.1, 'a ramp climbs 1.8 m along z');
yard.spawn({ type: 'cube', color: '#e65e4b', x: -6, y: 4, z: -6.5 });
for (let i = 0; i < 400; i++) yard.step();
const [onRamp] = yard.poses();
assert(onRamp.position.y > yard.groundAt(onRamp.position.x, onRamp.position.z) - 0.05, 'a cube rests on the ramp, not in it');
yard.destroy();
console.log('PASS terrain stamps: ramp wedge collider matches what is drawn');

// ---- Lab (0.5): nothing that was playable changed -----------------------------------------------------------------
// The ten jobs, the sandbox, the toys, the colours and the three original machines hash to the value taken from the
// 0.4.0 source before the Lab work began (their numbers are the game's economy; the Lab adds beside them).
{
  const snap = JSON.stringify({
    ROUNDS,
    SANDBOX,
    COLORS,
    TOYS,
    machines: { skid: MACHINES.skid, excavator: MACHINES.excavator, crane: MACHINES.crane },
  });
  assert.equal(
    createHash('sha256').update(snap).digest('hex'),
    '1621a802ceb59e9f0f9149cb2fc7120bf5ffc3941e8a92bbc2248069763cc6cf',
    'jobs 1 to 10, the sandbox, the toys and the three original machines are unchanged',
  );
  assert.equal(ROUNDS.length, 10);
  assert.deepEqual(Object.keys(MACHINES).slice(0, 3), ['skid', 'excavator', 'crane']);
  console.log('PASS the original jobs, sandbox and machines match their 0.4.0 snapshot');
}
// The blueprint prices and ids mirror the Lab catalogue (data only, no imports).
{
  const { ITEM_BY_ID } = await import('../../lab/src/data/catalog.js');
  for (const r of BLUEPRINTS) {
    assert.equal(ITEM_BY_ID[r.lab].price, r.price, `${r.lab} costs what the job board says`);
    assert(!ITEM_BY_ID[r.lab].soon);
  }
  const { VEHICLE_PRICE } = await import('../src/app/vehiclePrice.mjs');
  for (const kind of LAB_MACHINES) {
    assert(ITEM_BY_ID[`bc.veh.${kind}`] && !ITEM_BY_ID[`bc.veh.${kind}`].soon);
    assert.equal(ITEM_BY_ID[`bc.veh.${kind}`].price, VEHICLE_PRICE[kind], `${kind} costs what the board says`);
  }
  console.log('PASS blueprint and vehicle ids and prices match the Lab catalogue');
}
// Each blueprint is solvable with the machines everyone has. A grabs challenge is met by a tidy build; a height
// challenge is not met by the plain blueprint and is met by the spare block stacked on top afterwards.
for (const round of BLUEPRINTS) {
  for (const stretch of round.challenge.kind === 'height' ? [false, true] : [false]) {
    yard = new Yard(round);
    mission = new Mission(round);
    const challenge = new Challenge(round);
    const track = (axes, n) => {
      for (let i = 0; i < n; i++) {
        yard.step(axes);
        const poses = yard.poses();
        mission.step(poses, yard.held?.id, DT);
        challenge.step(poses, yard.held?.id, yard.grabs);
      }
      return { ...state(), grabs: yard.grabs };
    };
    const start = performance.now();
    await solve({ state, advance: track, action: () => yard.grab(), select: (i) => yard.select(i) }, round.id, { stretch });
    challenge.finish(yard.grabs);
    assert(mission.complete, `blueprint ${round.id} completes`);
    if (round.challenge.kind === 'grabs') {
      assert(challenge.met, `${round.title}: ${challenge.label()} is met by a tidy build`);
      assert(yard.grabs >= round.ghosts.length && yard.grabs <= round.challenge.par);
    } else assert.equal(challenge.met, stretch, `${round.title}: ${challenge.label()} (stretch ${stretch})`);
    report[round.id + (stretch ? 's' : '')] = {
      simulatedSeconds: Math.round(yard.time),
      cpuMs: Math.round(performance.now() - start),
      complete: mission.complete,
      challenge: challenge.label(),
      met: challenge.met,
    };
    yard.destroy();
    console.log(`PASS blueprint ${round.id} ${round.title}${stretch ? ' with the stretch' : ''}: ${challenge.label()}`);
  }
}
// The challenge numbers: a chain of grabs counts, the height follows real poses, a held or moving block never counts.
{
  const c = new Challenge(findJob(104));
  const still = { velocity: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const cube = (id, y) => ({ id, type: 'cube', position: { x: 0, y, z: 0 }, ...still });
  c.step([cube(1, 0.6), cube(2, 1.8)], null, 0);
  assert(Math.abs(c.height - 2.4) < 1e-9 && !c.met);
  c.step([cube(1, 0.6), cube(2, 5.0)], 2, 0);
  assert(Math.abs(c.height - 1.2) < 1e-9, 'a held block does not count');
  c.step([cube(1, 0.6), cube(2, 5.2)], null, 0);
  assert(c.met && c.label().includes('target 5.6'), 'a block top at 5.8 m meets a 5.6 m target');
  c.step([cube(1, 0.6)], null, 0);
  assert(c.met, 'once met it stays met');
  const on = { ...still, rotation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } };
  assert(Math.abs(standingHeight([{ id: 1, type: 'beam', position: { x: 0, y: 2, z: 0 }, ...on }]) - 2.575) < 1e-9, "a beam rolled onto its side is 1.15 m tall");
  console.log('PASS challenge counting');
}
// The dump truck. Six cubes and a spare on the bed ride through a drive without spilling; the lift tips the bed; the
// tailgate opens before anything can slide; rolling forward while tipping lays the whole load out behind the truck.
{
  const toys = [];
  for (const dz of [0.7, 1.9, 3.0]) for (const dx of [-0.65, 0.65]) toys.push({ type: 'cube', color: '#c33', x: dx, y: DUMP.hinge.y + 0.7, z: -6.5 + dz });
  toys.push({ type: 'cube', color: '#c33', x: 0, y: DUMP.hinge.y + 1.9, z: -4.6 });
  yard = new Yard({ ...SANDBOX, machines: ['dump'], toys, spawns: [[0, -4]] });
  const truck = yard.machine;
  for (let i = 0; i < 120; i++) yard.step();
  assert.equal(yard.bedCargo().length, 7, 'seven cubes ride in the bed');
  assert.equal(yard.grab(), false, 'a dump truck has no Grab');
  for (let i = 0; i < 150; i++) yard.step({ drive: 1, steer: i > 60 ? 0.3 : 0 });
  assert.equal(yard.bedCargo().length, 7, 'a drive with a turn does not spill the load');
  // stopping takes real distance: the same release of the stick coasts further than a skid steer's
  const speed0 = truck.speed,
    z0 = truck.z,
    x0 = truck.x;
  for (let i = 0; i < 120; i++) yard.step({});
  const coast = Math.hypot(truck.z - z0, truck.x - x0);
  yard.destroy();
  const skid = new Yard({ ...SANDBOX, machines: ['skid'], toys: [] });
  for (let i = 0; i < 150; i++) skid.step({ drive: 1 });
  const s0 = { x: skid.machine.x, z: skid.machine.z };
  for (let i = 0; i < 120; i++) skid.step({});
  const skidCoast = Math.hypot(skid.machine.z - s0.z, skid.machine.x - s0.x);
  skid.destroy();
  assert(speed0 > 3 && coast > 1.8 && coast > skidCoast * 3, `the truck coasts ${coast.toFixed(2)} m, the skid steer ${skidCoast.toFixed(2)} m`);
  report.dumpCoastMetres = { truck: coast, skid: skidCoast };
  // tipping: the angle follows the lift, the gate opens first, a stationary tip leaves a heap but never traps the truck
  assert(Math.abs(bedAngle(MACHINES.dump.height[1]) - DUMP.max) < 1e-9 && bedAngle(MACHINES.dump.height[0]) === 0);
  assert.equal(gateAngle(0), 0);
  assert(Math.abs(gateAngle(DUMP.gate.from + DUMP.gate.span) - DUMP.gate.open) < 1e-9 && gateAngle(0.5) === DUMP.gate.open && DUMP.gate.from + DUMP.gate.span < 0.4, 'the gate is fully open (by 23 degrees of bed tilt) well before a load slides (about 36)');
  yard = new Yard({ ...SANDBOX, machines: ['dump'], toys, spawns: [[0, -4]] });
  for (let i = 0; i < 120; i++) yard.step();
  let tipped = 0;
  for (let i = 0; i < 60 * 14; i++) {
    yard.step({ lift: 1, drive: i > 90 ? 0.25 : 0 });
    if (yard.machine.lift >= MACHINES.dump.height[1] - 1e-6 && !tipped) tipped = i;
  }
  assert(tipped > 60, 'the bed takes seconds to tip, not a blink: ' + tipped / 60);
  assert.equal(yard.bedCargo().length, 0, 'tipping while rolling forward empties the bed');
  const out = yard.poses();
  assert(out.every((p) => Math.abs(p.position.y - 0.6) < 0.2 && p.position.z < yard.machine.z - 2), 'the cubes lie on the ground behind the truck');
  report.dumpTip = { seconds: tipped / 60, cargoLeft: 0 };
  yard.destroy();
  // a load that is tipped while standing still still comes out when the truck then rolls on
  yard = new Yard({ ...SANDBOX, machines: ['dump'], toys, spawns: [[0, -4]] });
  for (let i = 0; i < 120; i++) yard.step();
  for (let i = 0; i < 60 * 6; i++) yard.step({ lift: 1 });
  for (let i = 0; i < 60 * 6; i++) yard.step({ drive: 0.4 });
  assert(yard.bedCargo().length <= 1, 'the last blocks leave when the truck rolls forward');
  // lowering the bed puts it flat again and the gate shuts
  for (let i = 0; i < 60 * 8; i++) yard.step({ lift: -1 });
  assert.equal(yard.machine.lift, MACHINES.dump.height[0]);
  yard.destroy();
  console.log('PASS dump truck carries a load, stops slowly and tips it out');
}
// The forklift. Its tines are 0.14 m wide at +-0.4 m and 0.07 m thick; a pallet's openings are 1.3 m wide and 0.30 m
// tall. Only forks that are low, square and centred go in and lift; anything else shoves the pallet or rides over it.
{
  const attempt = async ({ dx = 0, yaw = 0, raise = 0, tilt = 0 }) => {
    const y = new Yard({
      ...SANDBOX,
      machines: ['fork'],
      toys: [{ type: 'pallet', color: '#c33', x: 0, y: 0.3, z: 0 }, { type: 'cube', color: '#c33', x: 0, y: 1.0, z: 0 }],
      spawns: [[dx, -8]],
    });
    const m = y.machine;
    m.yaw = yaw;
    y.updateTip(m, true);
    for (let i = 0; i < 120; i++) y.step();
    for (let i = 0; i < 400 && raise && m.lift < raise; i++) y.step({ lift: 1 });
    // Creep forward the way a careful operator would: stop once the tines are under the deck, or as soon as the pallet
    // is shoved, then try the lift.
    for (let i = 0; i < 60 * 12; i++) {
      y.step({ drive: 0.6 });
      const p = y.poses()[0].position;
      if (y.forkStatus().state === 'in' || Math.hypot(p.x, p.z) > 0.2 || m.z > 0.5) break;
    }
    const seen = y.forkStatus().state;
    for (let i = 0; i < 90; i++) y.step({});
    for (let i = 0; i < 60 * 3; i++) y.step({ lift: 1 });
    const pallet = y.poses()[0],
      cube = y.poses()[1];
    const out = { seen, palletY: pallet.position.y, cubeY: cube.position.y, lift: m.lift, grab: y.grab() };
    y.destroy();
    return out;
  };
  const clean = await attempt({});
  assert.equal(clean.seen, 'in', 'a clean approach puts the tines under the deck');
  assert(clean.palletY > 2 && clean.cubeY > 2.8, `the pallet and its cube rise with the forks (${clean.palletY.toFixed(2)})`);
  assert.equal(clean.grab, false, 'a forklift has no Grab');
  for (const dx of [0.12, -0.15, 0.2]) assert((await attempt({ dx })).palletY > 2, `${dx} m off centre still goes in (the openings are 1.3 m wide)`);
  for (const [label, opts] of [
    ['offset 0.3 m', { dx: 0.3 }],
    ['offset 0.45 m', { dx: 0.45 }],
    ['yawed 0.15 rad', { yaw: 0.15 }],
    ['yawed 0.08 rad', { yaw: 0.08 }],
    ['forks held at 0.5 m', { raise: 0.5 }],
    ['forks held high', { raise: 0.7 }],
  ]) {
    const bad = await attempt(opts);
    assert(bad.palletY < 0.4, `${label}: the pallet is not lifted (${bad.palletY.toFixed(2)})`);
    report['fork ' + label] = bad;
  }
  // rear steer: turning pivots about the front axle, so the tail swings out and the forks barely move
  yard = new Yard({ ...SANDBOX, machines: ['fork'], toys: [], spawns: [[0, 0]] });
  const f = yard.machine,
    axle = () => ({ x: f.x + Math.sin(f.yaw) * FORK.pivot, z: f.z + Math.cos(f.yaw) * FORK.pivot }),
    a0 = axle();
  for (let i = 0; i < 90; i++) yard.step({ steer: 1 });
  assert(Math.hypot(axle().x - a0.x, axle().z - a0.z) < 1e-6, 'a standing turn pivots about the front axle');
  assert(Math.hypot(f.x - 0, f.z - 0) > 0.3, 'so the middle of the machine swings');
  const heightRange = MACHINES.fork.height;
  for (let i = 0; i < 60 * 6; i++) yard.step({ lift: 1 });
  assert.equal(f.lift, heightRange[1]);
  for (let i = 0; i < 60 * 6; i++) yard.step({ lift: -1, tilt: 1 });
  assert.equal(f.lift, heightRange[0]);
  assert(f.tilt <= FORK.tilt[1] + 1e-9 && f.tilt > 0.19, 'the mast tilts back to its stop');
  yard.destroy();
  console.log('PASS forklift lifts a pallet only on a clean approach');
}
// Both Lab machines are a row in every table, share a yard with the others, and survive a save and restore.
{
  for (const kind of LAB_MACHINES) {
    assert(MACHINE[kind] && MACHINES[kind].lab, kind + ' has its physics row');
    assert(MACHINE[kind].grabs === false);
  }
  yard = new Yard({ ...SANDBOX, machines: ['skid', 'excavator', 'crane', 'dump', 'fork'], spawns: sandboxSpawns(['skid', 'excavator', 'crane', 'dump', 'fork']) });
  for (let i = 0; i < 120; i++) yard.step();
  yard.select(3);
  for (let i = 0; i < 60; i++) yard.step({ drive: 1, lift: 0.5 });
  const saved = normalizeYard({ ...yard.snapshot(), daylight: 0.5 });
  assert.equal(saved.machines.length, 5);
  assert(saved.machines.find((m) => m.kind === 'dump').lift > 0.7);
  yard.hop();
  assert.notEqual(yard.active, 3);
  yard.destroy();
  console.log('PASS five machines share a yard and a saved site');
}

const a = defaultSave(),
  b = defaultSave();
a.done = [1, 2];
a.rewards = ['cream'];
b.done = [1, 3];
b.rewards = ['leaf'];
a.play['2026-10-31'] = { rounds: 2, seconds: 20 };
b.play['2026-10-31'] = { rounds: 1, seconds: 50 };
const merged = mergeBc({ updatedAt: 1, data: a }, { updatedAt: 2, data: b });
assert.deepEqual(merged.done, [1, 2, 3]);
assert.equal(merged.play['2026-10-31'].seconds, 50);
assert.deepEqual(merged, mergeBc({ updatedAt: 2, data: b }, { updatedAt: 1, data: a }));
b.resetAt = 20;
assert.deepEqual(mergeBc({ updatedAt: 40, data: a }, { updatedAt: 1, data: b }).done, b.done);
assert.equal(normalizeYard({ toys: Array(100).fill({ type: 'cube', x: Infinity }) }).toys.length, 64);
assert.deepEqual(normalize({ done: [-2, 50, 1, 1, 101, 104, 105, 11] }).done, [1, 101, 104]);
console.log('PASS commutative merge, reset, bounds');
writeFileSync(resultsPath('physics-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log('All physics and mission checks passed.');
