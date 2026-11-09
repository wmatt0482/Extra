import { createCourse } from '../src/game/course.js';
import { SKY_TRACKS } from '../src/data/skyTracks.js';
for (const t of SKY_TRACKS) {
  const c = createCourse(t, 42);
  console.log(t.id, 'islands', c.islands.length, 'xL', Math.round(c.xL), 'air', c.airTargets.length, 'wells', c.wells.length, 'first', c.islands.slice(0, 3).map((i) => [Math.round(i.x0), Math.round(i.x1)].join('-')).join(' '));
  let bad = 0; for (let x = -100; x < t.finish + 200; x += 0.5) { const y = c.groundY(x); if (!isFinite(y)) bad++; }
  console.log(' bad', bad, 'finish ground', c.groundY(t.finish).toFixed(1), 'onIsland', c.onIsland(t.finish, 5), 'boost', c.airTargets.filter((a) => a.kind === 'boost').length);
}
