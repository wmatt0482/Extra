// STAND-IN for the Journey stream's pure fight stepper (SPEC v1.4 §3.3, `src/journey/fishing.js`), written to the same
// signature so integration is a one-line swap: in `fishing2.js` and in `src/meta/mockScene.js` replace
//     import { createFight, fightStep, fightHelp } from './fightStandin.js'      (mockScene: '../scene/fightStandin.js')
// with  import { createFight, fightStep, fightHelp } from '../journey/fishing.js'  (mockScene: '../journey/fishing.js')
// The scene never decides a fight: it calls fightStep(state, dtMs, down) every frame and draws what the state says.
//
// fight = { reelMs, pullPerMs, wobbles: [[startMs, endMs]], strainMaxMs, warnMs, help, helpAt }
//   createFight(fight) → { t: 0, progress: 0, strain: 0, phase: 'reel', wobble: false, warn: false, helped: false, fight }
//   fightStep: pure, deterministic, returns a new state. phase 'help' changes nothing until fightHelp; t += dt;
//   wobble = t inside a wobble window; warn = a window starts within warnMs; down: progress += dt / reelMs (x2 once
//   helped); in a wobble strain += dt, else strain = max(0, strain - dt / 2); up: progress = max(0, progress - pullPerMs
//   x dt), strain = max(0, strain - dt). strain > strainMaxMs → 'off'; help && !helped && progress >= helpAt → 'help';
//   progress >= 1 → 'landed'. There is no other phase: nothing snaps and nothing is ever lost.
export const HELP_SPEED = 2;

export function createFight(fight) {
  return { t: 0, progress: 0, strain: 0, phase: 'reel', wobble: false, warn: false, helped: false, fight };
}
export function fightStep(state, dtMs, down) {
  if (state.phase === 'off' || state.phase === 'landed' || state.phase === 'help') return state;
  const f = state.fight, t = state.t + dtMs;
  const ws = f.wobbles || [];
  let wobble = false, warn = false;
  for (const [a, b] of ws) {
    if (t >= a && t < b) wobble = true;
    else if (a > t && a - t <= (f.warnMs || 250)) warn = true;
  }
  let progress = state.progress, strain = state.strain;
  if (down) {
    progress += dtMs / f.reelMs * (state.helped ? HELP_SPEED : 1);
    if (wobble) strain += dtMs; else strain = Math.max(0, strain - dtMs / 2);
  } else {
    progress = Math.max(0, progress - (f.pullPerMs || 0) * dtMs);
    strain = Math.max(0, strain - dtMs);
  }
  let phase = 'reel';
  if (strain > f.strainMaxMs) phase = 'off';
  else if (f.help && !state.helped && progress >= (f.helpAt == null ? 0.5 : f.helpAt)) { phase = 'help'; progress = Math.min(progress, f.helpAt == null ? 0.5 : f.helpAt); }
  else if (progress >= 1) { phase = 'landed'; progress = 1; }
  return { ...state, t, progress, strain, phase, wobble, warn: warn && !wobble };
}
export function fightHelp(state) {
  return state.phase === 'help' ? { ...state, phase: 'reel', helped: true } : state;
}
