// A scripted operator that solves any of the ten jobs and the four Lab blueprints (101 to 104), shared by the Node physics tests and the browser smoke. It
// only sends production control axes and Grab/Release through the caller's state/advance/action/select callbacks, and
// never sets a pose, so a job completes only if the real machines really move the toys. The routes are deliberately
// slow and careful: drive along a lane at z = -6.2, approach square on, lift high, then place and let things settle.
import { findJob, TOYS } from '../src/content.mjs';
import { SITES } from '../src/sites.mjs';
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
async function operator({ state, advance, action, select }, id) {
  const round = findJob(id);
  let s = await state();
  // Exercise every machine listed for the job, then choose its most capable available tool.
  for (let i = 0; i < s.machines.length; i++) await select(i);
  const index = s.machines.findIndex(
    (m) =>
      m.kind ===
      (round.machines.includes('crane') ? 'crane' : round.machines.includes('excavator') ? 'excavator' : 'skid'),
  );
  await select(index);
  const get = async () => {
    s = await state();
    return s.machines[s.active];
  };
  const tick = async (a, n = 12) => {
    s = await advance(a, n);
  };
  // Raises or lowers the tool to height y, then waits for the load to stop swinging.
  async function height(y) {
    for (let i = 0; i < 100; i++) {
      const m = await get(),
        diff = y - m.lift;
      if (Math.abs(diff) < 0.015) break;
      await tick({ lift: clamp(diff * 2) }, 8);
    }
    await tick({}, 40);
  }
  // Turns the chassis on the spot to face yaw.
  async function rotate(yaw) {
    for (let i = 0; i < 140; i++) {
      const m = await get(),
        diff = angle(yaw - m.yaw);
      if (Math.abs(diff) < 0.008) break;
      await tick({ steer: clamp(diff * 1.7) }, 8);
    }
    await tick({}, 25);
  }
  // Drives the chassis centre to (x, z): steer toward it, creep forward only when nearly facing it, then square up.
  async function move(x, z) {
    for (let i = 0; i < 350; i++) {
      const m = await get(),
        dx = x - m.x,
        dz = z - m.z,
        dist = Math.hypot(dx, dz);
      if (dist < 0.055) break;
      const err = angle(Math.atan2(dx, dz) - m.yaw);
      await tick({ steer: clamp(err * 1.8), drive: Math.abs(err) < 0.19 ? clamp(dist * 0.65, 0, 0.85) : 0 }, 10);
      if (i === 349) throw Error(`drive did not arrive at ${x},${z}: ${JSON.stringify(m)}`);
    }
    await tick({}, 35);
    await rotate(0);
  }
  // Gets to (x, z) via the lane, so the machine never cuts through the pad or the props.
  async function route(x, z) {
    let m = await get();
    await move(m.x, -6.2);
    await move(x, -6.2);
    await move(x, z);
  }
  if ((await get()).kind === 'crane') await tick({ extend: 1 }, 100);
  await height(3.5);
  await tick({}, 90);
  // Picks `block` up and sets it down centred on `target` (x, y, z), then lets it settle.
  async function carry(block, target, label) {
    const m = await get();
    await height(m.kind === 'skid' ? 3.5 : 6.1);
    await route(block.position.x, block.position.z - m.reach);
    await height(block.position.y + 0.04);
    await action('grab');
    s = await state();
    if (s.held !== block.id)
      throw Error(
        `grab ${id}:${label} missed: ${JSON.stringify({ tip: s.machines[s.active].tip, p: block.position, held: s.held })}`,
      );
    await height(m.kind === 'skid' ? 3.5 : 6.1);
    await route(target.x, target.z - m.reach);
    await height(target.y + 0.15);
    await tick({}, 100);
    if (m.kind === 'skid') await tick({ tool: 1 }, 60);
    await action('grab');
    await tick({}, 40);
    if (m.kind === 'skid') {
      await tick({ drive: -0.45 }, 70);
      await tick({}, 30);
      await height(3.5);
      await tick({ tool: -1 }, 60);
    }
    await tick({}, 180);
    if (typeof process !== 'undefined' && process.env.TRACE)
      console.log(
        'placed',
        label,
        (await state()).blocks.map((b) => b.position),
      );
  }
  return { round, get, tick, carry, state: () => state() };
}
/** Solves job `id` (1 to 20, or a Lab blueprint 101 to 104) through the production controls. With `stretch`, a height
 *  blueprint's spare cube is also stacked on top once it stands. */
export async function solve(api, id, { stretch: top = false } = {}) {
  if (PLANS[id]) return solveSite(api, id);
  const { round, tick, carry, state } = await operator(api, id);
  let s = await state();
  // A blueprint is built ghost by ghost (bottom first, as listed) from the nearest unused toy of the ghost's type; a
  // delivery job carries every toy to a spot on the pad. Spare toys beyond the ghosts stay where they are.
  const used = new Set(),
    steps = round.ghosts ? round.ghosts.map((g) => ({ g })) : s.blocks.map((b, i) => ({ id: b.id, i }));
  for (const step of steps) {
    s = await state();
    let block;
    if (step.g) {
      block = s.blocks.filter((b) => b.type === step.g.type && !used.has(b.id)).sort((a, b) => a.id - b.id)[0];
      if (block) used.add(block.id);
    } else block = s.blocks.find((b) => b.id === step.id);
    if (!block) throw Error('missing toy');
    const i = step.i ?? round.ghosts.indexOf(step.g);
    await carry(block, step.g || { x: 2.4 + (i % 3) * 2.6, y: 0.6, z: 3.2 + Math.floor(i / 3) * 2.8 }, i);
  }
  await tick({}, 180);
  s = await state();
  if (!s.complete)
    throw Error(
      `job ${id} incomplete: ${JSON.stringify(s.status)} poses=${JSON.stringify(s.blocks.map((b) => b.position))}`,
    );
  if (top) s = await stretch(api, id);
  return s;
}

/** The optional stretch of a height challenge: a spare cube (one the blueprint did not use) goes on top of the build's
 *  highest piece. It works from the poses alone, so it can run after "Continue on site". */
export async function stretch(api, id) {
  const { round, carry, state } = await operator(api, id);
  if (round.challenge?.kind !== 'height') throw Error('no height challenge');
  const s = await state(),
    top = round.ghosts[round.ghosts.length - 1],
    // the cubes standing on the pad belong to the build; a spare is one waiting out in the loading area
    spare = s.blocks.find((b) => b.type === 'cube' && b.position.x < 1);
  if (!spare) throw Error('no spare cube for the height challenge');
  await carry(spare, { x: top.x, y: top.y + TOYS[top.type].size[1] / 2 + 0.6, z: top.z }, 'stretch');
  return state();
}

// ---- The harbor and the hillside (jobs 11 to 20) ---------------------------------------------------------------------
// Each job has a plan: the free machine that does the work (every machine listed is still selected once), the lane it
// travels along (south of everything it approaches), the crane's boom reach, and for a delivery the spot on the pad for
// each load in load order (far rows first, so a machine never drives into a load it has placed). A target with `face`
// is approached from the quay side, facing the water (+x), instead of facing north (+z). On a slope the solver reads the
// real grab point back from the yard and corrects for the pitch of the machine, as an operator watching the bucket would.
const PLANS = {
  11: {
    machine: 'skid',
    slots: [
      [2.4, 7.6],
      [5, 7.6],
      [7.6, 7.6],
      [2.4, 4.8],
      [5, 4.8],
      [7.6, 4.8],
      [2.4, 2],
      [5, 2],
    ],
  },
  12: {
    machine: 'crane',
    slots: [
      [2.4, 7.7],
      [5, 7.7],
      [7.6, 7.7],
      [2, 3],
      [5, 3],
      [8, 3],
    ],
  },
  13: {
    machine: 'crane',
    reach: 8,
    face: Math.PI / 2,
    slots: [
      [14.5, 1.4],
      [14.5, 4.6],
      [12.7, 1.4],
      [12.7, 4.6],
    ],
  },
  14: { machine: 'crane' },
  15: { machine: 'crane', face: Math.PI / 2 },
  16: {
    machine: 'loader',
    lane: -12,
    slots: [
      [-10, 11.6],
      [-6, 11.6],
      [-10, 9],
      [-6, 9],
    ],
  },
  17: {
    machine: 'loader',
    lane: -12,
    slots: [
      [-12.1, -5],
      [-9.5, -5],
      [-6.9, -5],
      [-11, -7.6],
      [-8, -7.6],
    ],
  },
  18: {
    machine: 'excavator',
    lane: -12,
    slots: [
      [-5, 11.8],
      [-2.4, 11.8],
      [-5, 9.2],
      [-2.4, 9.2],
    ],
  },
  19: { machine: 'crane', lane: 7 },
  20: { machine: 'crane', lane: 0 },
};
/** The scoop machines pour a load out by tilting the bucket forward and backing away. */
const SCOOPS = new Set(['skid', 'loader']);
const TRAVEL = { skid: 3.5, loader: 3.5, excavator: 6.1, crane: 6.1 };

async function solveSite(api, id) {
  const { state, advance, action, select } = api,
    round = findJob(id),
    plan = PLANS[id],
    lane = plan.lane ?? -6.2;
  let s = await state();
  for (let i = 0; i < s.machines.length; i++) await select(i);
  await select(s.machines.findIndex((m) => m.kind === plan.machine));
  const get = async () => {
    s = await state();
    return s.machines[s.active];
  };
  const tick = async (a, n = 12) => {
    s = await advance(a, n);
  };
  /** Sets the lift joint (the tool's height above the ground under the machine), then lets a load stop swinging. */
  async function lift(v, settle = 40) {
    for (let i = 0; i < 100; i++) {
      const m = await get(),
        diff = v - m.lift;
      if (Math.abs(diff) < 0.015) break;
      await tick({ lift: clamp(diff * 2) }, 8);
    }
    await tick({}, settle);
  }
  /** Brings the grab point itself to height y, reading it back (a pitched loader's bucket does not rise straight). */
  async function tipTo(y) {
    for (let i = 0; i < 100; i++) {
      const m = await get(),
        diff = y - m.tip.y;
      if (Math.abs(diff) < 0.015) break;
      const before = m.lift;
      await tick({ lift: clamp(diff * 2) }, 8);
      if ((await get()).lift === before) break;
    }
    await tick({}, 40);
  }
  async function rotate(yaw) {
    for (let i = 0; i < 160; i++) {
      const m = await get(),
        diff = angle(yaw - m.yaw);
      if (Math.abs(diff) < 0.008) break;
      await tick({ steer: clamp(diff * 1.7) }, 8);
    }
    await tick({}, 25);
  }
  async function move(x, z, face = 0) {
    for (let i = 0; i < 400; i++) {
      const m = await get(),
        dx = x - m.x,
        dz = z - m.z,
        dist = Math.hypot(dx, dz);
      if (dist < 0.055) break;
      let err = angle(Math.atan2(dx, dz) - m.yaw),
        dir = 1;
      // A loader bends to steer and its long rear swings wide on the spot, so it reverses to anything behind it.
      if (m.kind === 'loader' && Math.abs(err) > Math.PI / 2) {
        err = angle(err + Math.PI);
        dir = -1;
      }
      await tick({ steer: clamp(err * 1.8), drive: Math.abs(err) < 0.19 ? dir * clamp(dist * 0.65, 0, 0.85) : 0 }, 10);
      if (i === 399) throw Error(`job ${id}: drive did not arrive at ${x},${z}: ${JSON.stringify(m)}`);
    }
    await tick({}, 35);
    await rotate(face);
  }
  async function route(x, z, face = 0) {
    const m = await get();
    await move(m.x, lane);
    await move(x, lane);
    await move(x, z, face);
  }
  /** Drives so the grab point is over (x, z), approaching facing `face`: from the reach, then by what the tip shows. */
  async function approach(x, z, face = 0) {
    let m = await get();
    await route(x - Math.sin(face) * m.reach, z - Math.cos(face) * m.reach, face);
    for (let k = 0; k < 3; k++) {
      m = await get();
      const ex = x - m.tip.x,
        ez = z - m.tip.z;
      if (Math.hypot(ex, ez) < 0.12) break;
      await move(m.x + ex, m.z + ez, face);
    }
  }
  const m0 = await get();
  if (m0.kind === 'crane') await tick({ extend: 1 }, Math.round((((plan.reach ?? 6.5) - 3.5) / 1.8) * 60));
  await lift(TRAVEL[m0.kind]);
  await tick({}, 90);
  /** Turns the bucket's tilt joint to v (radians; forward is positive). */
  async function tiltTo(v) {
    for (let i = 0; i < 60; i++) {
      const m = await get(),
        diff = v - m.tilt;
      if (Math.abs(diff) < 0.02) break;
      await tick({ tool: clamp(diff * 3) }, 4);
    }
  }
  async function carry(block, target, face, label) {
    const m = await get(),
      travel = TRAVEL[m.kind];
    await lift(travel);
    if (m.kind === 'loader') {
      // A loader scoops the way a real one does: the bucket down on the ground just short of the load, tipped forward
      // so its cutting edge is at the ground, the load drawn up the floor, then the bucket curled back to hold it.
      await approach(block.position.x, block.position.z - 1.8);
      await lift(0.7, 20);
      await tiltTo(0.3);
      // creep in until the load is within reach of the bucket (its cutting edge still clear of the load)
      for (let i = 0; i < 60; i++) {
        const t = (await get()).tip,
          p = s.blocks.find((b) => b.id === block.id).position;
        if (Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) < 1.45) break;
        await tick({ drive: 0.15 }, 3);
      }
      await tick({}, 10);
    } else {
      await approach(block.position.x, block.position.z);
      await tipTo(block.position.y + 0.04);
    }
    await action('grab');
    s = await state();
    if (s.held !== block.id)
      throw Error(`grab ${id}:${label} missed: ${JSON.stringify({ tip: s.machines[s.active].tip, p: block.position, held: s.held })}`);
    if (m.kind === 'loader') {
      await tick({}, 60);
      await tiltTo(-0.2);
    }
    await lift(travel);
    await approach(target.x, target.z, face);
    // a scoop machine is lowered by the joint (its bucket floor must clear the ground); the others by the grab point
    await tipTo(target.y + 0.15);
    await tick({}, 100);
    if (SCOOPS.has(m.kind)) await tick({ tool: 1 }, 60);
    await action('grab');
    await tick({}, 40);
    if (SCOOPS.has(m.kind)) {
      await tick({ drive: -0.45 }, 70);
      await tick({}, 30);
      await lift(travel);
      await tick({ tool: -1 }, 60);
    }
    await tick({}, 180);
    if (typeof process !== 'undefined' && process.env.TRACE)
      console.log('placed', id, label, JSON.stringify((await state()).blocks.map((b) => b.position)));
  }
  s = await state();
  if (round.ghosts) {
    const used = new Set();
    for (const [i, g] of round.ghosts.entries()) {
      s = await state();
      const block = s.blocks.filter((b) => b.type === g.type && !used.has(b.id)).sort((a, b) => a.id - b.id)[0];
      if (!block) throw Error('missing toy');
      used.add(block.id);
      await carry(block, g, plan.face ?? 0, i);
    }
  } else {
    const ids = s.blocks.map((b) => b.id);
    for (const [i, bid] of ids.entries()) {
      s = await state();
      const block = s.blocks.find((b) => b.id === bid),
        [x, z] = plan.slots[i],
        type = TOYS[block.type];
      // the load rests on the pad's own ground (the barge deck and the terrace are not at y = 0)
      await carry(block, { x, y: padGround(round, x, z) + type.size[1] / 2, z }, plan.face ?? 0, i);
    }
  }
  await tick({}, 180);
  s = await state();
  if (!s.complete)
    throw Error(`job ${id} incomplete: ${JSON.stringify(s.status)} poses=${JSON.stringify(s.blocks.map((b) => b.position))}`);
  return s;
}

/** The ground height where a load is set down on a job's pad (the quay, the barge deck or the hillside). */
function padGround(round, x, z) {
  return SITES[round.site].height(x, z);
}
