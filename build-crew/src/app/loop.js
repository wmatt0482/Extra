// The game loop: one requestAnimationFrame callback that reads the controls, runs the physics in fixed 1/60 s steps
// (at most three per frame, two on a phone, so a slow device slows the game down instead of spiralling), updates the
// HUD and machine sounds, draws the scene and feeds the frame times to the adaptive quality controller and the
// performance samples the frame check reads. On the touch tiers the scene is drawn between the last two physics steps
// (src/scene/interp.js), so motion stays smooth when frames come at 30 fps or on a 120 Hz screen. The loop stops
// asking for frames while the tab is hidden and starts again when it is shown. In test mode (?test=1) the loop only
// draws; tests step the simulation themselves.
import { DT } from '../physics.mjs';
import { Sound } from '../meta/sound.js';
import { TIER } from '../scene/quality.js';
import { Interpolator } from '../scene/interp.js';
import { app, activePlay } from './state.js';
import { updateUI } from './hud.js';
import { step } from './rounds.js';

/** Frame, update and render times (ms) during play, newest 1200 kept, for the frame check. */
export const samples = { frame: [], update: [], render: [] };

/** How the loop has been coping: frames drawn, physics steps run per frame (index = steps), and frames where the
 *  physics could not keep up with real time and the extra time was dropped. */
export const loopStats = { frames: 0, steps: [0, 0, 0, 0], behind: 0 };

const NO_INPUT = Object.freeze({});

/** The time of the previous frame (0 when there is none to measure from) and unsimulated time carried over. */
let last = 0,
  acc = 0,
  raf = 0;

const blend = TIER.interpolate ? new Interpolator() : null;

/** Starts the clock afresh, e.g. for a new yard, so the first frame does not try to catch up. */
export function resetClock() {
  acc = 0;
  last = 0;
  blend?.reset();
}

/** Forgets the previous frame's time after the tab was hidden, so the gap is not simulated. */
export function forgetLastFrame() {
  last = 0;
}

/** Asks for frames; a hidden tab stops asking (see frame) and the first visible moment starts again. */
export function startLoop() {
  if (!raf) raf = requestAnimationFrame(frame);
  if (!startLoop.bound) {
    startLoop.bound = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    });
  }
}

/** One rendered frame. The poses read for the last physics step's mission check are drawn as they are, so a frame
 *  reads the yard's poses once rather than twice. */
function frame(now) {
  raf = 0;
  if (document.hidden) {
    // Nothing is drawn or simulated while hidden, and no frame is requested until the tab is shown again.
    last = 0;
    acc = 0;
    return;
  }
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : DT,
    elapsed = last ? now - last : 16.67;
  last = now;
  const t0 = performance.now();
  let input = NO_INPUT;
  let poses = null;
  let mix = null;
  if (activePlay() && !app.testing) {
    input = app.controls.read();
    acc += dt;
    const yard = app.yard,
      want = Math.min(TIER.maxSteps, Math.floor(acc / DT));
    let n = 0;
    while (n < want) {
      // With several steps in a frame the state just before the last one is what the blend starts from.
      if (blend && want > 1 && n === want - 1) blend.before(yard, poses || yard.poses());
      poses = step(input);
      acc -= DT;
      n++;
      if (!activePlay()) break;
    }
    loopStats.steps[n]++;
    // Physics that is still behind after the allowed steps drops the rest instead of chasing it.
    if (acc >= DT) {
      loopStats.behind++;
      acc = 0;
    }
    if (blend && activePlay() && app.yard === yard) {
      if (n > 0) blend.after(yard, poses || yard.poses());
      if (blend.ready) {
        blend.alpha = acc / DT;
        mix = blend;
      }
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
  app.scene.render(dt, app.mission?.status, poses, mix);
  const end = performance.now();
  loopStats.frames++;
  app.scene.adapt(end - beforeRender, elapsed);
  if (app.screen === 'play') {
    samples.frame.push(elapsed);
    samples.update.push(beforeRender - t0);
    samples.render.push(end - beforeRender);
    if (samples.frame.length > 1200) for (const a of Object.values(samples)) a.shift();
  }
}
