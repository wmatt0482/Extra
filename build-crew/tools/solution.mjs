// A scripted operator that solves any of the ten jobs and the four Lab blueprints (101 to 104), shared by the Node physics tests and the browser smoke. It
// only sends production control axes and Grab/Release through the caller's state/advance/action/select callbacks, and
// never sets a pose, so a job completes only if the real machines really move the toys. The routes are deliberately
// slow and careful: drive along a lane at z = -6.2, approach square on, lift high, then place and let things settle.
import { findJob, TOYS } from '../src/content.mjs';
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
/** Solves job `id` (1 to 10, or a Lab blueprint 101 to 104) through the production controls. With `stretch`, a height
 *  blueprint's spare cube is also stacked on top once it stands. */
export async function solve(api, id, { stretch: top = false } = {}) {
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
