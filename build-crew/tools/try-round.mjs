// Development helper: solves the given jobs headless through tools/solution.mjs and prints the time each took.
// node build-crew/tools/try-round.mjs 11 12 (TRACE=1 prints every placement).
import { initPhysics, Yard, DT } from '../src/physics.mjs';
import { findJob } from '../src/content.mjs';
import { Mission } from '../src/missions.mjs';
import { solve } from './solution.mjs';
await initPhysics();
for (const id of process.argv.slice(2).map(Number)) {
  const round = findJob(id),
    yard = new Yard(round),
    mission = new Mission(round);
  const state = () => ({
    active: yard.active,
    held: yard.held?.id,
    blocks: yard.poses(),
    machines: yard.machines.map((m) => ({
      kind: m.kind,
      x: m.x,
      y: m.y,
      z: m.z,
      yaw: m.yaw,
      swing: m.swing,
      lift: m.lift,
      reach: m.reach,
      pitch: m.pitch,
      tilt: m.tilt,
      tip: { ...m.tip },
    })),
    status: mission.status,
    complete: mission.complete,
  });
  const advance = (axes, n) => {
    for (let i = 0; i < n; i++) {
      yard.step(axes);
      mission.step(yard.poses(), yard.held?.id, DT);
    }
    return state();
  };
  const t0 = performance.now();
  try {
    await solve({ state, advance, action: () => yard.grab(), select: (i) => yard.select(i) }, id);
    console.log(`job ${id} solved in ${Math.round(yard.time)} s simulated, ${Math.round(performance.now() - t0)} ms, returned ${yard.returned}`);
  } catch (e) {
    console.log(`job ${id} FAILED after ${Math.round(yard.time)} s: ${e.message.slice(0, 1500)}`);
  }
  yard.destroy();
}
