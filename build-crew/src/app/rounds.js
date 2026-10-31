// A job's (or the sandbox's) life: building the physics yard and showing it, starting a job with its camera, HUD and
// spoken goal, one fixed physics step with the mission check and first-use hints, the player's one-shot actions
// (grab, hop, reset, horn, pause), the pause sheet, and finishing a job: the reward is recorded once, the yard
// celebrates and the sheet offers the next job. Completion only ever comes from the mission check on real poses.
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
import { app, persist, account, activePlay, setSetting } from './state.js';
import { MACHINE_UI, toast, showHint, modal, closeModal, renderMachines, updateUI } from './hud.js';
import { prepareVoice, say } from './voice.js';
import { showTitle } from './title.js';
import { resetClock } from './loop.js';

/** The machines this builder may drive in the sandbox: the skid steer, plus any earned (or parent-unlocked). */
export function availableMachines() {
  return Object.keys(MACHINES).filter((k) => k === 'skid' || app.save.unlockAll || app.save.rewards.includes(k));
}

/** Replaces the physics yard with a new one for `round` (optionally restoring a saved sandbox) and shows it with
 *  the builder's paint, decal and the saved daylight. Physics events become sounds and effects. */
export function makeWorld(round, snapshot) {
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
  showHint(MACHINES[app.yard.machine.kind].hint);
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
    showHint(
      yard.held ? 'Carry it to the outline, then release.' : 'Bring the tool close to a block, then press Grab.',
    );
  }
  if (Math.abs(input.drive || 0) > 0.1 && !app.said.has('drive')) {
    app.said.add('drive');
    showHint('Try I and K, or the right stick, to lift your tool.');
  }
  return poses;
}

/** The job is complete: record the job, its reward and today's count once, celebrate, and offer what comes next. */
function win() {
  if (app.screen !== 'play') return;
  const r = app.yard.round,
    save = app.save;
  account();
  if (!save.done.includes(r.id)) {
    save.done.push(r.id);
    save.rewards.push(r.unlock);
    const key = dayKey(Date.now());
    save.play[key] ||= { rounds: 0, seconds: 0 };
    save.play[key].rounds++;
    completeDay(save, Date.now());
  }
  persist();
  app.ping('round');
  app.scene.celebrate();
  Music.celebrate();
  Audio.coin();
  updateUI();
  modal('JOB COMPLETE', [
    h('div', { class: 'celebration-stamp', html: icon('trophy') }),
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
  showHint('All set. Resume!');
}

/** A one-shot action from a key, a gamepad button or the HUD. Pause works whenever a job is open; the rest only
 *  during active play. */
export function action(a) {
  if (a === 'pause') {
    if (app.screen !== 'play') return;
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
    if (!yard.grab()) showHint('Bring the tool close to a block, then press Grab.');
    else if (yard.held) showHint('Raise the load clear of the ground, then move to the outline.');
    else if (MACHINE_UI[yard.machine.kind].releaseHint) showHint(MACHINE_UI[yard.machine.kind].releaseHint);
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
  if (a === 'horn') Sound.horn(app.save.horn === 'bell');
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
