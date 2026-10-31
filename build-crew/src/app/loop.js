// The game loop: one requestAnimationFrame callback that reads the controls, runs the physics in fixed 1/60 s steps
// (at most three per frame, so a slow device slows the game down instead of spiralling), updates the HUD and machine
// sounds, draws the scene and feeds the frame times to the adaptive quality controller and the performance samples
// the frame check reads. In test mode (?test=1) the loop only draws; tests step the simulation themselves.
import { DT } from '../physics.mjs';
import { Sound } from '../meta/sound.js';
import { app, activePlay } from './state.js';
import { updateUI } from './hud.js';
import { step } from './rounds.js';

/** Frame, update and render times (ms) during play, newest 1200 kept, for the frame check. */
export const samples = { frame: [], update: [], render: [] };

/** The time of the previous frame (0 when there is none to measure from) and unsimulated time carried over. */
let last = 0,
  acc = 0;

/** Starts the clock afresh, e.g. for a new yard, so the first frame does not try to catch up. */
export function resetClock() {
  acc = 0;
  last = 0;
}

/** Forgets the previous frame's time after the tab was hidden, so the gap is not simulated. */
export function forgetLastFrame() {
  last = 0;
}

export function startLoop() {
  requestAnimationFrame(frame);
}

/** One rendered frame. The poses read for the last physics step's mission check are drawn as they are, so a frame
 *  reads the yard's poses once rather than twice. */
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) {
    last = 0;
    acc = 0;
    return;
  }
  const dt = last ? Math.min(0.05, (now - last) / 1000) : DT,
    elapsed = last ? now - last : 16.67;
  last = now;
  const t0 = performance.now();
  let input = {};
  let poses = null;
  if (activePlay() && !app.testing) {
    input = app.controls.read();
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 3) {
      poses = step(input);
      acc -= DT;
      if (!activePlay()) break;
    }
    updateUI();
  } else acc = 0;
  Sound.update(
    app.yard?.machine.kind,
    input.drive || 0,
    Math.abs(input.lift || 0) + Math.abs(input.tool || 0),
    activePlay(),
  );
  const beforeRender = performance.now();
  app.scene.render(dt, app.mission?.status, poses);
  const end = performance.now();
  app.scene.adapt(end - beforeRender, elapsed);
  if (app.screen === 'play' && !document.hidden) {
    samples.frame.push(elapsed);
    samples.update.push(beforeRender - t0);
    samples.render.push(end - beforeRender);
    if (samples.frame.length > 1200) for (const a of Object.values(samples)) a.shift();
  }
}
