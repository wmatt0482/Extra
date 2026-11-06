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
import {
  SANDBOX,
  MACHINES,
  HINT,
  NEAT_LINE,
  jobIntro,
  jobDoneLine,
  findJob,
  labVehicleId,
  sandboxSpawns,
  JOB_COUNT,
  DECALS,
  HORNS,
} from '../content.mjs';
import { SITES, mudAt } from '../sites.mjs';
import { Yard, DT } from '../physics.mjs';
import { Mission, Challenge } from '../missions.mjs';
import { blueprintSvg } from '../blueprint.mjs';
import { labBridge } from '../meta/labBridge.js';
import { galleryPieces } from '../meta/labLooks.js';
import { Music } from '../meta/music.js';
import { Sound } from '../meta/sound.js';
import { PAINTS, rewardArt } from '../scene/machines.js';
import { app, persist, account, activePlay, setSetting, applyLook } from './state.js';
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

/** The machines this builder may drive in the sandbox: the skid steer, plus any earned (or parent-unlocked), plus the Lab's
 *  dump truck and forklift when this builder has bought them with Lab coins (the parent unlock does not cover those, and
 *  nothing that was already playable is ever behind the Lab). */
export function availableMachines() {
  return Object.keys(MACHINES).filter((k) =>
    MACHINES[k].lab
      ? labBridge.owns(labVehicleId(k))
      : k === 'skid' || app.save.unlockAll || app.save.rewards.includes(k),
  );
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
      // the harbor and the hillside: a load in the water or on the grass goes back to its start (never a fail)
      if (event.type === 'splash') {
        app.scene?.emit(event.position, '#d3ebe5', 22);
        if (app.screen === 'play') toast('Splash. That load is back on the quay.');
      }
      if (event.type === 'rule') {
        app.scene?.emit(event.position, '#93a273', 14);
        if (app.screen === 'play') {
          toast('That block touched the grass. It is back at the start.');
          if (!app.said.has('grass')) {
            app.said.add('grass');
            hint(HINT.grass);
          }
        }
      }
    },
  });
  if (snapshot) app.yard.restore(snapshot);
  app.mission = round.id ? new Mission(round) : null;
  // A blueprint's build challenge (grabs against a par, or a height to stand at) starts again with the world.
  app.challenge = round.challenge ? new Challenge(round) : null;
  app.neat = false;
  const scene = app.scene;
  scene.setRound(app.yard);
  applyLook();
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
  const round = id ? findJob(id) : null;
  // A Lab blueprint opens only for a builder who has bought it; otherwise the shop opens at it.
  if (round?.lab && !labBridge.owns(round.lab)) {
    closeModal();
    labBridge.openShop({});
    return;
  }
  account();
  persist();
  closeModal();
  app.screen = 'play';
  app.paused = false;
  app.stamp = null;
  $('#tray').hidden = true;
  $('#hud').hidden = false;
  for (const id of ['title', 'screen-players', 'screen-newplayer']) $('#' + id).hidden = true;
  document.documentElement.dataset.screen = 'play';
  // A harbor or hillside job also brings the Lab machines this builder owns that suit it (`optional`): a quicker way,
  // never a needed one. Every job is finished with the free machines it lists.
  const extras = (round?.optional || []).filter((k) => labBridge.owns(labVehicleId(k)));
  const job = round
    ? extras.length
      ? { ...round, machines: [...round.machines, ...extras] }
      : round
    : { ...SANDBOX, machines: availableMachines(), spawns: sandboxSpawns(availableMachines()) };
  labBridge.beginRound();
  makeWorld(job, restore ? app.save.yard : null);
  const scene = app.scene;
  scene.overview = false;
  scene.yaw = -2.45;
  scene.pitch = 0.6;
  scene.distance = job.machines.includes('crane') ? 32 : 28;
  const focus = app.yard.machine;
  scene.target.set(focus.x * 0.65 + job.pad.x * 0.15, Math.max(0.7, focus.y), focus.z * 0.65 + job.pad.z * 0.15);
  app.controls.setEnabled(true);
  const code = SITES[job.site]?.code || 'THE YARD';
  $('#job-number').textContent = round?.blueprint
    ? `THE YARD / BLUEPRINT ${String(id - 100).padStart(2, '0')}`
    : id
      ? `${code} / JOB ${String(id).padStart(2, '0')}`
      : 'THE YARD / SANDBOX';
  $('#job-title').textContent = job.title;
  $('#goal').textContent = job.goal;
  for (const el of ['open-tray', 'save-yard']) $('#' + el).hidden = !!id;
  $('#wreck').hidden = !(app.save.unlockAll || app.save.rewards.includes('wrecking'));
  $('#clear-yard').hidden = !!id;
  renderMachines();
  updateUI();
  app.hintIndex = 0;
  app.said = new Set();
  hint(MACHINES[app.yard.machine.kind].hint);
  app.optionalHint = extras.length > 0;
  prepareVoice();
  // The job is read aloud once as it starts ("Job three. Foundation grid. Place ..."); the machine's first hint above
  // follows it the first time this builder meets that machine (the voice watches the hint line, see voice.js).
  say(jobIntro(job));
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
  const mission = app.mission,
    challenge = app.challenge;
  if (mission && !mission.complete) {
    const was = mission.status.count;
    poses = yard.poses();
    const done = mission.step(poses, yard.held?.id, DT);
    if (mission.status.count > was && yard.time - app.lastChime > 0.25) {
      app.lastChime = yard.time;
      Audio.coin();
    }
    if (challenge) challenge.step(poses, yard.held?.id, yard.grabs);
    if (done) win();
  } else if (challenge && !app.neat && challenge.spec.kind === 'height') {
    // After the job is done ("Continue on site") a height target can still be reached with the spare blocks.
    challenge.step((poses = yard.poses()), yard.held?.id, yard.grabs);
    if (app.jobDone && challenge.met) neatBuild(true);
  }
  const arm = Math.abs(input.lift || 0) + Math.abs(input.tool || 0);
  if (arm > 0.1 && !app.said.has('tool')) {
    app.said.add('tool');
    hint(yard.held ? HINT.carry : HINT.grab);
  }
  if (Math.abs(input.drive || 0) > 0.1 && !app.said.has('drive')) {
    app.said.add('drive');
    hint(HINT.lift);
  }
  if (MACHINES[yard.machine.kind].lab && Math.floor(yard.time * 4) !== app.coachTick) {
    app.coachTick = Math.floor(yard.time * 4);
    coach(yard);
  }
  // The hillside's ground, each said once a job: a slope too steep for this machine, and mud slowing the wheels.
  const m = yard.machine;
  if (yard.site.terrain && Math.floor(yard.time * 4) !== app.siteTick) {
    app.siteTick = Math.floor(yard.time * 4);
    const say1 = (key, text) => {
      if (app.said.has(key)) return;
      app.said.add(key);
      hint(text);
    };
    if (m.stalled && Math.abs(input.drive || 0) > 0.1) say1('steep', HINT.steep);
    else if (mudAt(yard.site, m.x, m.z) && Math.abs(m.speed) > 0.5) say1('mud', HINT.mud);
  }
  // A Lab machine that joined the job is mentioned once, after the first tool move.
  if (app.optionalHint && app.said.has('tool') && !app.said.has('optional')) {
    app.said.add('optional');
    hint(HINT.optional);
  }
  return poses;
}

/** One short coaching line for the Lab machines, each at most once a visit: the forklift is told to lower its forks or
 *  line them up when a pallet is just ahead, and that it is in; the dump truck that a loaded bed tips with the lift. The
 *  lines are all prepared for the voice in content.mjs. */
function coach(yard) {
  const m = yard.machine;
  const say1 = (key, text) => {
    if (app.said.has(key)) return;
    app.said.add(key);
    hint(text);
  };
  if (m.kind === 'fork') {
    const { state } = yard.forkStatus();
    if (state === 'high') say1('forkLower', HINT.forkLower);
    else if (state === 'off') say1('forkAlign', HINT.forkAlign);
    else if (state === 'in') say1('forkIn', HINT.forkIn);
  } else if (m.kind === 'dump' && yard.bedCargo().length >= 2) say1('bedLoaded', HINT.bedLoaded);
}

/** "Neat build!": the blueprint's challenge was met. It shows on the finished sheet when it was met by then; a height
 *  reached afterwards (on site, with the spare blocks) gets a toast. Reported to the Lab once per blueprint visit. */
function neatBuild(late = false) {
  if (app.neat) return;
  app.neat = true;
  labBridge.report({ event: 'challenge' });
  if (late) toast('Neat build!');
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

/** Puts the reward just earned on the machine: a paint, a decal or a horn becomes the builder's current look. */
function equipReward(save, unlock) {
  if (PAINTS[unlock]) save.paint = unlock;
  else if (DECALS.includes(unlock)) save.decal = unlock;
  else if (HORNS.includes(unlock)) save.horn = unlock;
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
    calm = app.settings.reducedMotion,
    first = !save.done.includes(r.id);
  account();
  if (first) {
    save.done.push(r.id);
    if (r.unlock) save.rewards.push(r.unlock);
    const key = dayKey(Date.now());
    save.play[key] ||= { rounds: 0, seconds: 0 };
    save.play[key].rounds++;
    completeDay(save, Date.now());
    if (r.unlock) equipReward(save, r.unlock);
    labBridge.report({ event: 'day' });
  }
  persist();
  app.ping('round');
  // The Lab: the job (a replay pays a quarter), the blocks it counted, the blueprint and its challenge, and the finished
  // build for the family gallery. Each is one call, made once, here and never inside a frame.
  const meta = {
    id: `bc.job${r.id}.${dayKey(Date.now())}`,
    title: r.title,
    pieces: galleryPieces(app.yard.poses().filter((b) => buildSpotHas(app.yard, b))),
  };
  labBridge.report({ event: 'job', meta: { ...meta, first } });
  labBridge.report({ event: 'piece', n: Math.max(1, app.mission?.status.total || 1) });
  if (r.blueprint) labBridge.report({ event: 'blueprint', meta });
  if (app.challenge?.finish(app.yard.grabs)) neatBuild();
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
  // the ravine bridge's toy car drives across the finished bridge
  if (r.decor?.some((d) => d.kind === 'car')) {
    const beam = r.ghosts.find((g) => g.type === 'beam');
    scene.crossBridge(beam.x - 1.7, beam.x + 1.7, beam.y + 0.325);
  }
  Sound.fanfare(save.horn);
  Music.celebrate();
  const show = (app.celebration = {});
  show.timer = setTimeout(() => reveal(show), calm ? CALM_MS : SHOW_MS);
}

/** True when a toy belongs to the finished build: on or beside the delivery pad (the loose supply and the spare blocks
 *  waiting in the loading area are not part of it). */
function buildSpotHas(yard, b) {
  const pad = yard.round.pad;
  return Math.abs(b.position.x - pad.x) <= pad.w / 2 + 1 && Math.abs(b.position.z - pad.z) <= pad.d / 2 + 1;
}

/** The celebration is over: the reward sheet slides in with the reward drawn large and offers what comes next. */
function reveal(show) {
  if (app.celebration !== show) return;
  app.celebration = null;
  if (app.screen !== 'play') return;
  const r = app.yard.round,
    bp = !!r.blueprint;
  app.paused = false;
  Audio.coin();
  const last = bp || r.id >= JOB_COUNT,
    next = last ? () => startRound(0) : () => startRound(r.id + 1);
  // The family's results card: the reward drawn large on a plate, the line that names it, the Lab strip, then the
  // footer with the next step biggest (Next job) over Continue on site and Back to base.
  const sheet = [
    h('div', {
      class: 'reward-art',
      html: bp ? blueprintSvg(r, { neat: app.neat }) : rewardArt(r.unlock, app.yard.machine.kind, app.save.paint),
    }),
    h('p', { class: 'reward-line' }, bp ? 'Blueprint complete.' : `Job complete. Unlocked: ${r.reward}.`),
    app.neat ? h('p', { class: 'neat', id: 'neat' }, 'Neat build!') : null,
    h('div', { class: 'lab-results', id: 'lab-results' }),
    h(
      'div',
      { class: 'modal-actions results-foot' },
      h(
        'button',
        { class: 'btn btn-gold btn-big', id: 'next-round', onclick: next },
        last ? 'Open sandbox' : 'Next job',
        h('span', { html: icon('right') }),
      ),
      h(
        'button',
        {
          class: 'btn',
          id: 'keep-playing',
          onclick() {
            app.mission = null;
            closeModal();
          },
        },
        'Continue on site',
      ),
      h('button', { class: 'btn', id: 'to-base', onclick: showTitle }, 'Back to base'),
    ),
  ];
  modal(bp ? 'Blueprint complete' : 'Job complete', sheet.filter(Boolean), { kind: 'results' });
  app.labResults?.destroy();
  app.labResults = labBridge.results({ mount: $('#lab-results') });
  say(bp ? (app.neat ? NEAT_LINE : jobDoneLine(r)) : jobDoneLine(r));
}

/** Puts every block and machine back at the job's start, keeping earned progress. */
export function resetBlocks() {
  const round = app.yard.round;
  makeWorld(round);
  app.scene.overview = false;
  renderMachines();
  updateUI();
  hint(HINT.resume);
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
    // The dump truck and the forklift carry loads on the bed and the tines; they have no Grab.
    if (MACHINE_UI[yard.machine.kind].noGrab) return;
    if (!yard.grab()) hint(HINT.grab);
    else if (yard.held) hint(HINT.raise);
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
    Sound.horn(app.save.horn);
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
        class: 'btn btn-sm',
        onclick() {
          flip();
          this.textContent = label();
        },
      },
      label(),
    );
  // The family's pause sheet: a big Resume, Back to base, then Sound, Music and Motion side by side.
  modal(
    'Paused',
    [
      h('p', {}, 'Take a break. Your site is ready when you are.'),
      h(
        'div',
        { class: 'modal-actions pause-actions' },
        h(
          'button',
          { class: 'btn btn-gold btn-big', id: 'resume', onclick: closeModal },
          h('span', { html: icon('play') }),
          'Resume',
        ),
        h('button', { class: 'btn', id: 'to-base', onclick: showTitle }, 'Back to base'),
        h(
          'div',
          { class: 'pause-toggles' },
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
      ),
    ],
    { kind: 'pause' },
  );
}
