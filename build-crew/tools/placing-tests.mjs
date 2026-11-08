// The 0.8 "placing" checks, run by physics-tests.mjs on the same Rapier world: a block that has settled in its place locks
// there for good (a bump from the machine cannot move it or unplace it), a bucket tilted forward reliably pours a released
// block out and the block comes to rest in or beside the delivery zone, and a Grab picks up the nearest block at any bucket
// tilt and from either side of the bucket. Everything goes through production axes and the real Yard.
import assert from 'node:assert/strict';
import { Yard, DT, GRAB_BOX, POUR_TILT, LOCK_AFTER, MACHINE } from '../src/physics.mjs';
import { ROUNDS, SANDBOX, MACHINES } from '../src/content.mjs';
import { Mission } from '../src/missions.mjs';
import { TAP_MS } from '../src/controls.js';
import { GOALS, GOAL_IDS, evaluateGoals, stackStats } from '../src/goals.mjs';
import { LAB_PAY, jobPayout, measure, measureLine, pieceCount } from '../src/payout.mjs';
import { defaultSave, normalize, mergeBc } from '../src/meta/save.mjs';
import { placedHint, PLACED_HINTS, BLUEPRINTS } from '../src/content.mjs';

const job1 = ROUNDS[0];
const cube = (x, z, y = 0.68) => ({ type: 'cube', color: '#c6412f', x, y, z });
const run = (yard, axes, n) => {
  for (let i = 0; i < n; i++) yard.step(axes);
};
/** A job 1 yard with the skid steer at (x, z) facing +z and `toys`, settled for half a second. */
function yardWith(toys, spawn = [5, -6], round = job1) {
  const events = [];
  const yard = new Yard({ ...round, spawns: [spawn], toys }, { onEvent: (e) => events.push(e) });
  run(yard, {}, 30);
  return { yard, events };
}

export function placingTests(report) {
  // ---- a settled block locks and stays ---------------------------------------------------------------------------------
  {
    // three blocks dropped into the zone settle, lock one by one, and never leave the count
    const { yard, events } = yardWith([cube(3, 4, 2), cube(5, 4, 2), cube(7, 4, 2)], [-6, -4]);
    const mission = new Mission(job1);
    const check = (n) => {
      for (let i = 0; i < n; i++) {
        yard.step({});
        mission.step(yard.poses(), yard.held?.id, DT);
      }
    };
    check(Math.round((LOCK_AFTER + 1.2) * 60));
    assert(yard.blocks.every((b) => b.locked), 'every block that settled in the zone locked');
    assert.equal(events.filter((e) => e.type === 'placed').length, 3, 'one "placed" event each');
    assert.equal(mission.status.count, 3);
    assert(mission.complete, 'a job of three locked blocks completes');
    const where = yard.poses().map((p) => ({ ...p.position }));
    // the bump test: drive straight at them, reverse, turn in place, swing the bucket and drop it on them
    const m = yard.machine;
    Object.assign(m, { x: 5, z: -1, yaw: 0 });
    yard.seat(m, true);
    yard.updateTip(m, true);
    for (const axes of [
      { drive: 1 },
      { drive: -1, steer: 0.6 },
      { steer: 1, tilt: 1 },
      { drive: 1, tilt: -1 },
      { drive: -1 },
      { lift: -1, steer: -1 },
      { drive: 1, lift: -1 },
    ]) {
      for (let i = 0; i < 90; i++) {
        yard.step(axes);
        mission.step(yard.poses(), yard.held?.id, DT);
        assert.equal(mission.status.count, 3, 'a bump never unplaces a block');
      }
    }
    yard.poses().forEach((p, i) => {
      assert(Math.hypot(p.position.x - where[i].x, p.position.y - where[i].y, p.position.z - where[i].z) < 1e-4, 'a locked block does not move');
      assert(p.locked);
    });
    report.lock = { locked: 3, bumped: true };
    yard.destroy();
  }
  {
    // a locked block is not offered to Grab, and a block that is sent back to its start is an ordinary toy again
    const { yard } = yardWith([cube(5, 4, 2), cube(5, 9)], [5, 1.5]);
    run(yard, {}, 120);
    const placed = yard.blocks[0];
    assert(placed.locked);
    Object.assign(yard.machine, { x: 5, z: 1.3 });
    yard.seat(yard.machine, true);
    yard.updateTip(yard.machine, true);
    assert.notEqual(yard.grabCandidate()?.id, placed.id, 'a placed block cannot be grabbed by accident');
    yard.recover(placed);
    assert(!placed.locked);
    assert.equal(placed.body.bodyType(), 0, 'it is dynamic again');
    yard.destroy();
  }
  {
    // the dump truck's bed over the delivery zone is not a place: its load rides without locking
    const toys = [0, 1].map((i) => ({ type: 'cube', color: '#c6412f', x: 4.4 + i * 1.3, y: 2.4, z: 3 }));
    const events = [];
    const yard = new Yard({ ...job1, machines: ['dump'], spawns: [[5, 4]], toys }, { onEvent: (e) => events.push(e) });
    run(yard, {}, 240);
    assert(yard.bedCargo().length >= 1);
    assert(!yard.blocks.some((b) => b.locked), 'a block riding on a bed over the zone does not lock');
    yard.destroy();
  }
  {
    // a blueprint: a cube set near its outline snaps onto it, and a second one cannot take the same outline
    const bp = ROUNDS[2];
    const events = [];
    const yard = new Yard({ ...bp, toys: [cube(3.3, 5.35, 2), cube(3.4, 5.2, 2.2)] }, { onEvent: (e) => events.push(e) });
    run(yard, {}, 300);
    const first = yard.blocks.filter((b) => b.locked);
    assert(first.length >= 1);
    const slot = first[0].body.translation();
    assert(Math.hypot(slot.x - 3, slot.z - 5) < 0.01 && Math.abs(slot.y - 0.6) < 0.01, 'it snapped to the exact outline');
    assert.equal(new Set(yard.blocks.filter((b) => b.locked).map((b) => b.slot)).size, yard.blocks.filter((b) => b.locked).length, 'one block per outline');
    yard.destroy();
  }
  console.log('PASS placed blocks lock, snap and survive bumps');

  // ---- generous snap at the zone's edge --------------------------------------------------------------------------------
  {
    // a block resting with its middle just outside the edge of the zone slides in and counts; one far away does not
    const { yard } = yardWith([cube(5.2, 0.85, 0.7), cube(-2, 5)], [-6, -6]);
    const mission = new Mission(job1);
    for (let i = 0; i < 300; i++) {
      yard.step({});
      mission.step(yard.poses(), null, DT);
    }
    const [edge, far] = yard.blocks;
    assert(edge.locked, 'a block resting at the zone edge drew in');
    assert(!far.locked, 'a block far from the zone stays loose');
    assert.equal(mission.status.count, 1);
    yard.destroy();
    console.log('PASS the zone draws in a block resting at its edge');
  }

  // ---- pouring ---------------------------------------------------------------------------------------------------------
  {
    const rows = [];
    for (const lift of [0.7, 0.8, 1.8, 3.2]) {
      for (const tilt of [0.3, 0.5, 0.7]) {
        const events = [];
        const yard = new Yard({ ...job1, spawns: [[5, -3]], toys: [cube(5, 0, 0.68)] }, { onEvent: (e) => events.push(e) });
        run(yard, {}, 30);
        for (let i = 0; i < 400 && Math.abs(yard.machine.lift - lift) > 0.02; i++) yard.step({ lift: lift > yard.machine.lift ? 1 : -1 });
        assert(yard.grab(), 'the block is picked up');
        run(yard, {}, 40);
        for (let i = 0; i < 200 && yard.machine.tilt < tilt; i++) yard.step({ tilt: 1 });
        run(yard, {}, 20);
        assert(yard.machine.tilt > POUR_TILT);
        const lip = yard.machine.z + 2.7 + 0.66;
        yard.release();
        let leftAt = null;
        for (let i = 0; i < 360; i++) {
          yard.step({});
          const p = yard.blocks[0].body.translation();
          if (leftAt === null && p.z > lip) leftAt = i / 60;
        }
        const b = yard.blocks[0],
          p = b.body.translation();
        assert(leftAt !== null && leftAt < 3, `lift ${lift} tilt ${tilt}: the block slid out (${leftAt})`);
        assert(p.y < 1, `lift ${lift} tilt ${tilt}: it is lying on the ground`);
        assert(events.some((e) => e.type === 'thud'), `lift ${lift} tilt ${tilt}: it landed with a thud`);
        assert(b.locked || (p.z > 1 && Math.abs(p.x - 5) < 3), `lift ${lift} tilt ${tilt}: it ended in or beside the zone (${p.z.toFixed(2)})`);
        rows.push({ lift, tilt, leftAt, z: +p.z.toFixed(2), locked: b.locked });
        yard.destroy();
      }
    }
    report.pour = rows;
    console.log(`PASS a tilted bucket pours its block out every time (${rows.length} cases, out by ${Math.max(...rows.map((r) => r.leftAt)).toFixed(1)} s)`);
  }
  {
    // a bucket that is not tilted past the pour angle keeps a block: nothing is pushed out of a level bucket
    const yard = new Yard({ ...job1, spawns: [[5, -3]], toys: [cube(5, 0, 0.68)] });
    run(yard, {}, 30);
    assert(yard.grab());
    run(yard, { lift: 1 }, 40);
    yard.release();
    run(yard, {}, 180);
    const p = yard.blocks[0].body.translation(),
      tip = yard.machine.tip;
    assert(Math.hypot(p.x - tip.x, p.z - tip.z) < 0.9 && p.y > 1, 'a level bucket keeps its block');
    yard.destroy();
    console.log('PASS a level bucket keeps its block');
  }

  // ---- grabbing --------------------------------------------------------------------------------------------------------
  {
    let cases = 0;
    for (const off of [0, 0.6, -1.0, 1.4]) {
      for (const tilt of [-0.6, 0, 0.6]) {
        const { yard } = yardWith([cube(5 + off, -1)], [5, -6]);
        for (let i = 0; i < 80 && Math.abs(yard.machine.tilt - tilt) > 0.02; i++) yard.step({ tilt: tilt > yard.machine.tilt ? 1 : -1 });
        run(yard, { drive: 0.5 }, 90);
        run(yard, {}, 40);
        assert(yard.grabCandidate(), `offset ${off} tilt ${tilt}: a block in front of the bucket is in reach`);
        assert(yard.grab());
        run(yard, { lift: 1 }, 70);
        const p = yard.blocks[0].body.translation(),
          tip = yard.machine.tip;
        assert(Math.hypot(p.x - tip.x, p.y - tip.y, p.z - tip.z) < 0.75, `offset ${off} tilt ${tilt}: it rides in the bucket`);
        cases++;
        yard.destroy();
      }
    }
    // two blocks in reach: the nearer, better centred one is chosen
    const { yard } = yardWith([cube(4.0, 0.2), cube(5.05, 0.9)], [5, -2.2]);
    assert.equal(yard.grabCandidate().id, yard.blocks[1].id, 'the nearest centred block wins');
    // far away and behind: nothing
    const far = yardWith([cube(5, 9)], [5, -6]);
    assert.equal(far.yard.grabCandidate(), null);
    assert.equal(far.yard.grab(), false);
    far.yard.destroy();
    yard.destroy();
    assert(GRAB_BOX.x >= 1.7 && GRAB_BOX.z[1] >= 2.3, 'the reach is wide');
    assert.equal(MACHINE.dump.grabs, false);
    console.log(`PASS grab: ${cases} approaches (off to the side, bucket tilted either way) all pick the block up and carry it`);
  }

  // ---- tap driving -----------------------------------------------------------------------------------------------------
  {
    // a keyboard tap (held TAP_MS with the quick start) is a clear nudge; the same tap without the quick start was a few cm
    const nudge = (axes, steps) => {
      const y = new Yard({ ...SANDBOX, machines: ['skid'], toys: [], spawns: [[0, -8]] });
      const z0 = y.machine.z;
      run(y, axes, steps);
      run(y, { quick: axes.quick }, 90);
      const d = y.machine.z - z0;
      y.destroy();
      return d;
    };
    const steps = Math.ceil((TAP_MS / 1000) * 60),
      tap = nudge({ drive: 1, quick: true }, steps),
      oldTap = nudge({ drive: 1 }, 1);
    assert(tap > 0.35 && tap < 1.2, `a tap nudges the machine ${tap.toFixed(2)} m`);
    assert(oldTap < 0.1, `a one-frame tap used to move it ${oldTap.toFixed(2)} m`);
    // a held key still reaches full speed, and a stick (no quick start) keeps its old feel
    const y = new Yard({ ...SANDBOX, machines: ['skid'], toys: [], spawns: [[0, -8]] });
    run(y, { drive: 1, quick: true }, 60);
    assert(Math.abs(y.machine.speed - MACHINES.skid.speed) < 0.01, 'holding the key reaches full speed');
    y.destroy();
    report.tap = { metres: tap, oldMetres: oldTap };
    console.log(`PASS keyboard tap: ${tap.toFixed(2)} m per tap (was ${oldTap.toFixed(2)} m)`);
  }

  // ---- the payout, the measures and the placed-block hints --------------------------------------------------------------------
  // every Build Crew row the cards quote is the Lab's own (a read-only import of its exchange table and catalogue)
  return import('../../lab/src/data/events.js').then(async ({ EVENTS }) => {
    const row = (event) => EVENTS.find((e) => e.game === 'bc' && e.event === event);
    for (const k of ['job', 'piece', 'challenge', 'blueprint']) {
      assert.equal(LAB_PAY[k].coins, row(k).coins, `bc ${k} coins`);
      assert.equal(LAB_PAY[k].xp, row(k).xp, `bc ${k} xp`);
    }
    assert.equal(LAB_PAY.job.replay, row('job').replay);
    assert.deepEqual(jobPayout(job1), { coins: 52, xp: 64 }, 'job 1 pays 52 coins and 64 XP');
    assert.deepEqual(jobPayout(job1, { replay: true }), { coins: 22, xp: 23 });
    assert.equal(pieceCount(job1), 3);
    const lh = BLUEPRINTS[0];
    assert.deepEqual(jobPayout(lh), { coins: 40 + 5 * 4 + 30, xp: 55 + 5 * 3 + 30 });
    // the shop's price is the single source: the board takes the Lab catalogue's number when the Lab is there
    const { ITEM_BY_ID } = await import('../../lab/src/data/catalog.js');
    for (const r of BLUEPRINTS) assert.equal(ITEM_BY_ID[r.lab].price, r.price);
    assert.equal(measureLine(ROUNDS[2]), 'Foundation grid: 5.2 m long, 1.2 m tall');
    assert.equal(measureLine(job1), '');
    assert.equal(measure(lh).tall, 5.7);
    assert.equal(placedHint(job1, 2), '2 to go: bring the next red block.');
    assert.equal(placedHint(ROUNDS[2], 1), 'Last one to go: fill the final outline.');
    assert(PLACED_HINTS.includes('2 to go: bring the next red block.'));
    console.log('PASS payout numbers match the Lab, blueprint measures, placed-block hints');
    goalTests();
  });
}

/** The eight site goals, each met by a real settled yard. */
function goalTests() {
  const cubes = (n, x = 5, z = 5) => Array.from({ length: n }, (_, i) => ({ type: 'cube', color: '#c6412f', x, y: 0.61 + i * 1.21, z }));
  const settle = (round, n = 240) => {
    const y = new Yard({ ...SANDBOX, ...round });
    run(y, {}, n);
    return y;
  };
  let y = settle({ toys: cubes(3), machines: ['skid'] });
  let got = evaluateGoals(y);
  assert(got.done.includes('tower3') && got.done.includes('tall2') && !got.done.includes('tall4'), '3 cubes: a tower, 2 m, not 4 m');
  assert(got.tallest > 3.4 && got.tallest < 3.8, `tallest stack ${got.tallest} m`);
  y.destroy();
  y = settle({ toys: cubes(4), machines: ['skid'] });
  assert(evaluateGoals(y).done.includes('tall4'), 'four cubes make 4 m');
  y.destroy();
  y = settle({ toys: [{ type: 'cube', color: '#c33', x: -10, y: 0.7, z: 6 }], machines: ['skid'] });
  assert.deepEqual(evaluateGoals(y).done, [], 'a single block meets nothing');
  assert.equal(stackStats(y.poses()).blocks, 1);
  y.destroy();
  y = settle({ toys: [0, 1, 2, 3].map((i) => ({ type: 'pallet', color: '#c33', x: 3 + (i % 2) * 2.2, y: 0.3, z: 3.2 + Math.floor(i / 2) * 2 })), machines: ['skid'] });
  assert(evaluateGoals(y).done.includes('pallets4'), 'four pallets in the bay');
  y.destroy();
  y = settle({ toys: [{ type: 'cube', color: '#c33', x: 1.5, y: 2, z: -2 }], machines: ['skid'] });
  y.stamp('pit', 2, -2);
  y.blocks[0].body.setTranslation({ x: 2, y: 2, z: -2 }, true);
  run(y, {}, 240);
  assert(evaluateGoals(y).done.includes('pit'), 'a block rests in the pit');
  y.destroy();
  y = settle({ toys: [], machines: ['skid'], spawns: [[2, -9]] });
  y.stamp('ramp', 2, -2);
  assert(!evaluateGoals(y).done.includes('ramp'));
  for (let i = 0; i < 700 && y.groundAt(y.machine.x, y.machine.z) < 1; i++) y.step({ drive: 0.7 });
  assert(evaluateGoals(y).done.includes('ramp'), 'driving up a ramp counts (at ' + y.machine.z.toFixed(1) + ')');
  y.destroy();
  y = settle({
    toys: [
      { type: 'cube', color: '#c33', x: 3, y: 0.61, z: -3 },
      { type: 'cube', color: '#c33', x: 6.4, y: 0.61, z: -3 },
      { type: 'beam', color: '#c33', x: 4.7, y: 1.5, z: -3 },
    ],
    machines: ['skid'],
  });
  assert(evaluateGoals(y).done.includes('bridge'), 'a beam across two blocks');
  y.destroy();
  y = settle({ toys: [], machines: ['skid'] });
  for (const [k, x, z] of [['hill', 6, 6], ['pit', -6, 6], ['ramp', -6, -6], ['water', 6, -6]]) y.stamp(k, x, z);
  assert(evaluateGoals(y).done.includes('shape'), 'all four terrain pieces');
  y.destroy();
  assert.equal(GOALS.length, 8);
  // saved stars: bounded to the known goals, and merging two devices keeps every star
  assert.deepEqual(defaultSave().goals, []);
  assert.deepEqual(normalize({ goals: ['ramp', 'nope', 'ramp', 7] }).goals, ['ramp']);
  const a = { ...defaultSave(), goals: ['pit'] },
    b = { ...defaultSave(), goals: ['tower3', 'pit'] };
  assert.deepEqual(mergeBc({ updatedAt: 1, data: a }, { updatedAt: 2, data: b }).goals, GOAL_IDS.filter((g) => ['tower3', 'pit'].includes(g)));
  console.log('PASS site goals: eight rules, each met by a real yard; saved stars bounded and merged');
}
