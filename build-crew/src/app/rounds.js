// A job's (or the sandbox's) life: building the physics yard and showing it, starting a job with its camera, HUD and
// spoken goal, one fixed physics step with the mission check and first-use hints, the player's one-shot actions
// (grab, hop, reset, horn, pause), the pause sheet, and finishing a job: the reward is recorded once and put on the
// machine, the yard celebrates for a few seconds (camera sweep, confetti, sparks, dust, horn fanfare, music stinger)
// and then the sheet slides in with the reward drawn large and offers the next job. Completion only ever comes from
// the mission check on real poses; nothing in the celebration needs a press or runs against a clock the child feels.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { dayKey } from '../../../spell-jump/src/ui/chart.js';
import { completeDay } from '../../../spell-jump/src/meta/engagement.js';
import { ROUNDS, SANDBOX, MACHINES } from '../content.mjs';
import { Yard, DT } from '../physics.mjs';
import { Mission } from '../missions.mjs';
import { Music } from '../meta/music.js';
import { Sound } from '../meta/sound.js';
import { PAINTS, rewardArt } from '../scene/machines.js';
import { app, persist, account, activePlay, setSetting } from './state.js';
import { MACHINE_UI, toast, showHint, modal, closeModal, renderMachines, updateUI } from './hud.js';
import { prepareVoice, say } from './voice.js';
import { showTitle } from './title.js';
import { resetClock } from './loop.js';

/** How long the job-complete show runs before the reward sheet, and the short beat used in calm motion (ms). */
const SHOW_MS = 2800;
const CALM_MS = 450;

/** The hint line, unless the job is already done: after completion nothing is shown until the next job starts. */
function hint(text) {
  if (!app.jobDone) showHint(text);
}

/** Marks the current job as finished (or not) for the hint line and the stylesheet. */
function setJobDone(done) {
  app.jobDone = done;
  document.documentElement.classList.toggle('job-done', done);
}

/** Ends a celebration that is still running (a new world replaced it): the controls come back. */
function cancelCelebration() {
  const show = app.celebration;
  if (!show) return;
  clearTimeout(show.timer);
  app.celebration = null;
  if (app.screen === 'play' && app.paused) {
    app.paused = false;
    app.controls?.setEnabled(true);
  }
}

/** The machines this builder may drive in the sandbox: the skid steer, plus any earned (or parent-unlocked). */
export function availableMachines() {
  return Object.keys(MACHINES).filter((k) => k === 'skid' || app.save.unlockAll || app.save.rewards.includes(k));
}

/** Replaces the physics yard with a new one for `round` (optionally restoring a saved sandbox) and shows it with
 *  the builder's paint, decal and the saved daylight. Physics events become sounds and effects. */
export function makeWorld(round, snapshot) {
  cancelCelebration();
  setJobDone(false);
  app.yard?.destroy();
  app.yard = new Yard(round, {
    onEvent(event) {
      if (event.type === 'impact') Sound.impact(event.force);
      if (event.type === 'glitter') app.scene?.emit(event.position, '#def8e7', 25);
      if (event.type === 'stamp') app.scene?.syncStamps();
    },
  });
  if (snapshot) app.yard.restore(snapshot);
  app.mission = round.id ? new Mission(round) : null;
  const scene = app.scene;
  scene.setRound(app.yard);
  scene.paint = app.save.paint;
  scene.decal = app.save.decal;
  // The roof horn follows the builder's save, wherever it changes.
  if (!Object.getOwnPropertyDescriptor(scene, 'horn')) {
    Object.defineProperty(scene, 'horn', { get: () => app.save.horn, configurable: true });
  }
  scene.daylightTo(snapshot?.daylight ?? 0.72);
  resetClock();
}

/** Starts job `id` (0 is the sandbox; restore loads the saved site): switches to the HUD, frames the first machine
 *  from behind, shows the job and its first hint, and reads the goal aloud. */
export function startRound(id, { restore = false } = {}) {
  if (!app.playerId) return;
  account();
  persist();
  closeModal();
  app.screen = 'play';
  app.paused = false;
  app.stamp = null;
  $('#tray').hidden = true;
  $('#hud').hidden = false;
  $('#title').hidden = $('#title-head').hidden = $('#title-foot').hidden = true;
  const round = id ? ROUNDS.find((r) => r.id === id) : { ...SANDBOX, machines: availableMachines() };
  makeWorld(round, restore ? app.save.yard : null);
  const scene = app.scene;
  scene.overview = false;
  scene.yaw = -2.45;
  scene.pitch = 0.6;
  scene.distance = round.machines.includes('crane') ? 32 : 28;
  const focus = app.yard.machine;
  scene.target.set(focus.x * 0.65 + round.pad.x * 0.15, 0.7, focus.z * 0.65 + round.pad.z * 0.15);
  app.controls.setEnabled(true);
  $('#job-number').textContent = id ? `THE YARD / JOB ${String(id).padStart(2, '0')}` : 'THE YARD / SANDBOX';
  $('#job-title').textContent = round.title;
  $('#goal').textContent = round.goal;
  for (const el of ['open-tray', 'save-yard']) $('#' + el).hidden = !!id;
  $('#wreck').hidden = !(app.save.unlockAll || app.save.rewards.includes('wrecking'));
  $('#clear-yard').hidden = !!id;
  renderMachines();
  updateUI();
  app.hintIndex = 0;
  app.said = new Set();
  hint(MACHINES[app.yard.machine.kind].hint);
  prepareVoice();
  say(round.goal);
  account();
}

/** One fixed physics step with this frame's axes. During a job it also runs the mission check on the settled poses
 *  (a coin sounds when the placed count rises) and finishes the job when it completes; the first drive and the first
 *  tool movement each bring the next hint. Returns the poses it read for the check (null when it read none), so the
 *  frame can draw the same poses instead of reading them again. */
export function step(input) {
  const yard = app.yard;
  yard.step(input);
  let poses = null;
  const mission = app.mission;
  if (mission && !mission.complete) {
    const was = mission.status.count;
    poses = yard.poses();
    const done = mission.step(poses, yard.held?.id, DT);
    if (mission.status.count > was && yard.time - app.lastChime > 0.25) {
      app.lastChime = yard.time;
      Audio.coin();
    }
    if (done) win();
  }
  const arm = Math.abs(input.lift || 0) + Math.abs(input.tool || 0);
  if (arm > 0.1 && !app.said.has('tool')) {
    app.said.add('tool');
    hint(
      yard.held ? 'Carry it to the outline, then release.' : 'Bring the tool close to a block, then press Grab.',
    );
  }
  if (Math.abs(input.drive || 0) > 0.1 && !app.said.has('drive')) {
    app.said.add('drive');
    hint('Try I and K, or the right stick, to lift your tool.');
  }
  return poses;
}

/** Where the finished build stands: the middle of the blocks resting on the pad (or the pad's middle), the ground
 *  level under them and a radius that covers them. The celebration frames and showers this spot. */
function buildSpot(yard) {
  const pad = yard.round.pad,
    near = yard
      .poses()
      .filter(
        (b) => Math.abs(b.position.x - pad.x) <= pad.w / 2 + 1 && Math.abs(b.position.z - pad.z) <= pad.d / 2 + 1,
      );
  if (!near.length) return { x: pad.x, y: 0, z: pad.z, radius: 3 };
  const x = near.reduce((n, b) => n + b.position.x, 0) / near.length,
    z = near.reduce((n, b) => n + b.position.z, 0) / near.length,
    low = Math.min(...near.map((b) => b.position.y)),
    high = Math.max(...near.map((b) => b.position.y)),
    spread = Math.max(...near.map((b) => Math.hypot(b.position.x - x, b.position.z - z)));
  const base = Math.max(0, low - 0.6);
  return { x, y: base, z, mid: (base + high) / 2 + 0.4, radius: Math.max(2.5, spread + 1.5, (high - base) * 0.8) };
}

/** Puts the reward just earned on the machine: a paint, a decal or the bell horn becomes the builder's current look. */
function equipReward(save, unlock) {
  if (PAINTS[unlock]) save.paint = unlock;
  else if (unlock === 'star' || unlock === 'stripe') save.decal = unlock;
  else if (unlock === 'bell') save.horn = 'bell';
  app.scene.paint = save.paint;
  app.scene.decal = save.decal;
}

/** The job is complete: record the job, its reward and today's count once, put the reward on the machine, and start
 *  the celebration. The reward sheet follows when it ends (a beat after a fade in calm motion). */
function win() {
  if (app.screen !== 'play' || app.celebration) return;
  const r = app.yard.round,
    save = app.save,
    scene = app.scene,
    calm = app.settings.reducedMotion;
  account();
  if (!save.done.includes(r.id)) {
    save.done.push(r.id);
    save.rewards.push(r.unlock);
    const key = dayKey(Date.now());
    save.play[key] ||= { rounds: 0, seconds: 0 };
    save.play[key].rounds++;
    completeDay(save, Date.now());
    equipReward(save, r.unlock);
  }
  persist();
  app.ping('round');
  // The job is done: the hint line empties and stays empty until the next job starts. Controls rest during the show.
  setJobDone(true);
  showHint('');
  app.paused = true;
  app.controls.clear();
  app.controls.setEnabled(false);
  account();
  updateUI();
  const spot = buildSpot(app.yard);
  scene.rig.celebrate({ x: spot.x, y: spot.mid ?? 1, z: spot.z }, spot.radius, SHOW_MS, calm);
  scene.effects.celebrate({ x: spot.x, y: spot.y, z: spot.z }, spot.radius);
  Sound.fanfare(save.horn === 'bell');
  Music.celebrate();
  const show = (app.celebration = {});
  show.timer = setTimeout(() => reveal(show), calm ? CALM_MS : SHOW_MS);
}

/** The celebration is over: the reward sheet slides in with the reward drawn large and offers what comes next. */
function reveal(show) {
  if (app.celebration !== show) return;
  app.celebration = null;
  if (app.screen !== 'play') return;
  const r = app.yard.round;
  app.paused = false;
  Audio.coin();
  modal('JOB COMPLETE', [
    h('div', { class: 'reward-art', html: rewardArt(r.unlock, app.yard.machine.kind, app.save.paint) }),
    h('p', {}, `Job complete. Unlocked: ${r.reward}.`),
    h(
      'div',
      { class: 'modal-actions' },
      h(
        'button',
        { class: 'primary', id: 'next-round', onclick: () => (r.id < 10 ? startRound(r.id + 1) : startRound(0)) },
        r.id < 10 ? 'Next job' : 'Open sandbox',
      ),
      h(
        'button',
        {
          id: 'keep-playing',
          onclick() {
            app.mission = null;
            closeModal();
          },
        },
        'Continue on site',
      ),
      h('button', { onclick: showTitle }, 'Back to base'),
    ),
  ]);
  say(`Job complete. Unlocked: ${r.reward}.`);
}

/** Puts every block and machine back at the job's start, keeping earned progress. */
export function resetBlocks() {
  const round = app.yard.round;
  makeWorld(round);
  app.scene.overview = false;
  renderMachines();
  updateUI();
  hint('All set. Resume!');
}

/** A one-shot action from a key, a gamepad button or the HUD. Pause works whenever a job is open; the rest only
 *  during active play. */
export function action(a) {
  if (a === 'pause') {
    if (app.screen !== 'play' || app.celebration) return;
    if (!$('#modal').hidden) {
      closeModal();
      return;
    }
    pause();
    return;
  }
  if (!activePlay()) return;
  const yard = app.yard;
  if (a === 'grab') {
    if (!yard.grab()) hint('Bring the tool close to a block, then press Grab.');
    else if (yard.held) hint('Raise the load clear of the ground, then move to the outline.');
    else if (MACHINE_UI[yard.machine.kind].releaseHint) hint(MACHINE_UI[yard.machine.kind].releaseHint);
    updateUI();
  }
  if (a === 'hop') {
    yard.hop();
    renderMachines();
  }
  if (a === 'reset') {
    yard.resetMachine();
    toast('Back on steady ground.');
  }
  if (a === 'horn') {
    const m = yard.machine;
    Sound.horn(app.save.horn === 'bell');
    // The roof horn swells and a little dust-pale puff leaves its mouth.
    app.scene.honkAt = performance.now();
    app.scene.emit({ x: m.x + Math.sin(m.yaw) * 0.6, y: m.y + 2.8, z: m.z + Math.cos(m.yaw) * 0.6 }, '#f1e6c2', 6);
  }
}

/** The pause sheet: resume, back to base, and the sound, music and motion settings. */
function pause() {
  account();
  app.paused = true;
  const settings = app.settings;
  const toggle = (id, label, flip) =>
    h(
      'button',
      {
        id,
        onclick() {
          flip();
          this.textContent = label();
        },
      },
      label(),
    );
  modal('PAUSED', [
    h('p', {}, 'Take a break. Your site is ready when you are.'),
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'primary', id: 'resume', onclick: closeModal }, 'Resume'),
      h('button', { onclick: showTitle }, 'Back to base'),
      toggle(
        'pause-sound',
        () => `Sound ${settings.sound ? 'on' : 'off'}`,
        () => setSetting('sound', !settings.sound),
      ),
      toggle(
        'pause-music',
        () => `Music ${settings.music ? 'on' : 'off'}`,
        () => setSetting('music', !settings.music),
      ),
      toggle(
        'pause-motion',
        () => (settings.reducedMotion ? 'Calm motion' : 'Full motion'),
        () => setSetting('reducedMotion', !settings.reducedMotion),
      ),
    ),
  ]);
}
