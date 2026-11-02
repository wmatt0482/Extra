// Build Crew's composer. It creates the shared services in a fixed order (family sync, pings, natural voice, input,
// Parent Zone), wires the page's buttons and lifecycle events to the app modules, then boots: physics, the scene, a
// demo yard behind the title, the game loop and the offline worker. The game itself lives in src/app/* (title, HUD,
// rounds, sandbox tray, voice, Parent Zone, loop), src/scene/* (drawing) and physics.mjs/missions.mjs (rules).
// Shared family, PIN, speech, sync and reports remain live imports from Spell Jump.
import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import { tts } from '../../spell-jump/src/spelling/tts.js';
import { $, h } from '../../spell-jump/src/ui/dom.js';
import { hydrateIcons } from '../../spell-jump/src/ui/icons.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { createPinger } from '../../spell-jump/src/meta/pings.js';
import { createUpdateGuard, safeToReload } from '../../spell-jump/src/meta/selfUpdate.js';
import { ROUNDS, SANDBOX, COLORS, VERSION } from './content.mjs';
import { initPhysics } from './physics.mjs';
import { Scene } from './scene/scene.js';
import { createControls } from './controls.js';
import { defaultSave, loadSave, normalize } from './meta/save.mjs';
import { registerSync } from './meta/sync.js';
import { Music } from './meta/music.js';
import { Sound } from './meta/sound.js';
import { app, initState, persist, account, flush, activePlay, setSetting, applyLook } from './app/state.js';
import { toast, closeModal, updateUI, measureInsets } from './app/hud.js';
import { createVoice, applyVoice, voiceFor, say, hush } from './app/voice.js';
import { ensurePlayer, renderTitle, renderLab, attachLab, jobBoard, showTitle } from './app/title.js';
import { labBridge } from './meta/labBridge.js';
import { makeWorld, startRound, step, resetBlocks, action } from './app/rounds.js';
import {
  toggleTray,
  closeTray,
  placeStamp,
  clearSite,
  toggleWreckingBall,
  saveYard,
  bindDaylight,
  fitTray,
} from './app/tray.js';
import { initParentZone } from './app/parent.js';
import { samples, loopStats, startLoop, forgetLastFrame } from './app/loop.js';

initState();
registerSync();
app.sync = createSyncClient({
  // Synced changes apply only on the title, never mid-job or under the Parent Zone.
  canApply: () => app.screen === 'title' && !app.pz?.isOpen,
  onApply(k) {
    if (k === 'family') {
      app.family = Profiles.loadFamily();
      if (!Profiles.playerById(app.family, app.playerId)) app.playerId = app.family.players[0]?.id || null;
    }
    if (k === 'family' || k === `${app.playerId}.bc`) {
      app.save = app.playerId ? loadSave(app.playerId) : defaultSave();
      applyVoice();
      renderTitle();
    }
    app.pz?.onSyncApplied();
  },
  onStatus() {
    app.pz?.onSyncStatus();
    if (app.playerId) applyVoice();
  },
});
app.ping = createPinger('build-crew', { version: VERSION, getCode: () => app.sync.code });
createVoice();
app.controls = createControls($('#world'), {
  action,
  orbit: (x, y) => app.scene?.orbit(x, y),
  zoom: (d) => app.scene?.zoom(d),
  tap: placeStamp,
});
initParentZone();

/** Every static button on the page and what it does. */
const BUTTONS = {
  play: () => ensurePlayer(() => startRound(ROUNDS.find((r) => !app.save.done.includes(r.id))?.id || 1)),
  sandbox: () => ensurePlayer(() => startRound(0)),
  jobs: () => ensurePlayer(jobBoard),
  'my-yard': () => startRound(0, { restore: true }),
  home: showTitle,
  pause: () => action('pause'),
  grab: () => action('grab'),
  hop: () => action('hop'),
  horn: () => action('horn'),
  'repeat-goal': () => say(app.yard.round.goal),
  'right-machine': () => action('reset'),
  'reset-machine': () => action('reset'),
  'reset-blocks': resetBlocks,
  'save-yard': () => saveYard(),
  'modal-close': closeModal,
  'open-tray': toggleTray,
  'close-tray': closeTray,
  'clear-yard': clearSite,
  wreck: toggleWreckingBall,
  'lab-open': () => labBridge.openHome({}),
  'lab-gallery': () => labBridge.openHome({ view: 'gallery' }),
  'sound-title': () => {
    setSetting('sound', !app.settings.sound);
    toast(`Sound ${app.settings.sound ? 'on' : 'off'}`);
  },
};
for (const [id, fn] of Object.entries(BUTTONS)) $('#' + id).onclick = fn;
bindDaylight();
// The tray stays above the drive deck whenever the deck (a machine's joint buttons) or the window changes size.
addEventListener('resize', fitTray);
// On a touch screen the camera frames the machine between the top bar and the controls, whatever the window's shape.
const reframe = () => requestAnimationFrame(measureInsets);
addEventListener('resize', reframe);
addEventListener('orientationchange', reframe);
try {
  matchMedia('(pointer: coarse)').addEventListener('change', (e) => {
    document.documentElement.classList.toggle('touch', e.matches || app.params.get('touch') === '1');
    fitTray();
    reframe();
  });
} catch {}
new ResizeObserver(fitTray).observe(document.querySelector('.drive-deck'));

// A new version waits for a safe moment (the title, nothing open) before reloading.
app.updater = createUpdateGuard({
  hadController: !!navigator.serviceWorker?.controller,
  isSafe: () =>
    safeToReload({
      screen: app.screen === 'title' ? 'title' : 'running',
      running: app.screen === 'play',
      parentZone: app.pz.isOpen || !$('#modal').hidden,
    }),
  notify: () => toast('A fresh yard is ready next time you visit the gate.'),
  reload: () => {
    flush();
    location.reload();
  },
});
navigator.serviceWorker?.addEventListener('controllerchange', () => app.updater.onControllerChange());

/** Audio may only start after a gesture: the first one unlocks every sound source and starts the music. */
function unlock() {
  Audio.unlock();
  tts.unlock();
  Music.unlock();
  Sound.unlock();
  setSetting('sound', app.settings.sound);
  Music.play(!app.pz.isOpen && $('#modal').hidden);
}
// Unlocking is only needed for the first few gestures (a touch ends with touchend, which iOS needs to count); after
// that every pointerdown, a stick touch included, skips the audio and settings work and answers at once.
let gestures = 0;
function onGesture() {
  unlock();
  if (++gestures >= 4) for (const event of GESTURES) document.removeEventListener(event, onGesture, { capture: true });
}
const GESTURES = ['pointerdown', 'keydown', 'touchend'];
for (const event of GESTURES) document.addEventListener(event, onGesture, { capture: true });
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('#pz')) e.preventDefault();
});
document.addEventListener('gesturestart', (e) => e.preventDefault());
// A hidden tab saves, goes quiet and stops counting play time; coming back resumes without simulating the gap.
document.addEventListener('visibilitychange', () => {
  account();
  persist();
  app.controls.clear();
  if (document.hidden) {
    hush();
    Audio.suspend();
    Music.suspend();
    Sound.suspend();
  } else {
    Audio.resume();
    Music.resume();
    Sound.resume();
    forgetLastFrame();
    account();
  }
});
// Leaving the page keeps the time played, and an open sandbox is saved so nothing built is lost.
window.addEventListener('pagehide', () => {
  account();
  persist();
  if (!app.yard?.round.id && app.screen === 'play') saveYard({ report: false });
});
setInterval(() => {
  if (activePlay()) {
    account();
    persist();
  }
}, 10000);

/** Registers the offline worker and hands it every same-origin file this page actually loaded. */
async function registerSW() {
  if (app.params.has('nosw') || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    const reg = await navigator.serviceWorker.ready;
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin));
    reg.active?.postMessage({ type: 'cache-urls', urls });
  } catch (e) {
    console.warn('[BuildCrew] Offline cache unavailable', e);
  }
}

/** The demo yard behind the title: all three machines and a few loads resting on the pad. */
const TITLE_YARD = {
  ...SANDBOX,
  machines: ['skid', 'excavator', 'crane'],
  toys: [
    ...SANDBOX.toys,
    { type: 'cube', color: COLORS[0], x: 5, y: 0.7, z: 5 },
    { type: 'cube', color: COLORS[1], x: 5, y: 2, z: 5 },
    { type: 'beam', color: COLORS[3], x: 7, y: 0.4, z: 8 },
  ],
};

/** The Lab (lab/SPEC.md section 4.5): who is building, the XP pill in the top bar, and the buttons and looks that need it.
 *  Everything here waits for the Lab to load and does nothing when it cannot, so the yard plays the same either way. */
function startLab() {
  if (app.playerId) attachLab(app.playerId);
  app.labHud = labBridge.hud({ mount: $('#lab-hud'), compact: isTouchLayout() });
  labBridge.onReady(() => {
    renderLab();
    applyLook();
  });
  labBridge.onChange(() => {
    applyLook();
    renderLab();
  });
}
const isTouchLayout = () => document.documentElement.classList.contains('touch');

/** Loads physics and the renderer, settles the title yard for 1.5 simulated seconds and shows the title. */
async function boot() {
  hydrateIcons();
  setSetting('sound', app.settings.sound);
  await initPhysics();
  app.scene = new Scene($('#world'), app.settings);
  makeWorld(TITLE_YARD);
  for (let i = 0; i < 90; i++) app.yard.step();
  startLab();
  app.controls.setEnabled(false);
  renderTitle();
  $('#loading').hidden = true;
  $('#title').hidden = $('#title-head').hidden = $('#title-foot').hidden = false;
  applyVoice();
  app.sync.start();
  app.ping('day');
  startLoop();
  registerSW();
  exposeHooks();
}

/** window.__buildCrew: read-only state and performance for the browser checks, plus (with ?perf=1) a sample reset
 *  and (with ?test=1) hooks that start jobs and advance the real simulation with production axes. The hooks never
 *  move toys or set completion. */
function exposeHooks() {
  window.__buildCrew = {
    version: VERSION,
    get state() {
      const { yard, mission, scene, cloud } = app;
      return {
        screen: app.screen,
        paused: !activePlay(),
        playerId: app.playerId,
        round: yard.round.id,
        complete: !!mission?.complete,
        status: mission?.status,
        grabs: yard.grabs,
        challenge: app.challenge?.active
          ? { ...app.challenge.spec, label: app.challenge.label(), met: app.challenge.met, neat: app.neat }
          : null,
        held: yard.held?.id,
        blocks: yard.poses(),
        machines: yard.machines.map((m) => ({
          kind: m.kind,
          x: m.x,
          z: m.z,
          yaw: m.yaw,
          swing: m.swing,
          lift: m.lift,
          reach: m.reach,
          tip: { ...m.tip },
        })),
        active: yard.active,
        daylight: scene.daylight,
        camera: { yaw: scene.yaw, pitch: scene.pitch, distance: scene.distance },
        stamps: yard.stamps.map((s) => ({ ...s })),
        save: normalize(app.save),
        voice: { engine: app.lastEngine || '', clips: cloud.count(), active: cloud.active },
      };
    },
    get performance() {
      const renderer = app.scene.renderer;
      return {
        ...samples,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        effectiveDpr: renderer.getPixelRatio(),
        renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER),
        quality: app.scene.quality.summary(),
        loop: { ...loopStats, steps: loopStats.steps.slice() },
      };
    },
    /** Where the delivery pad's corners, the blueprint's ghosts and the active machine appear on screen (CSS pixels),
     *  for the layout checks: read-only, it projects through the camera and moves nothing. */
    get layout() {
      const { yard, scene } = app,
        cam = scene.camera,
        r = yard.round,
        v = scene.tapPoint;
      const at = (x, y, z) => {
        v.set(x, y, z).project(cam);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
      };
      const p = r.pad;
      return {
        pad: [
          at(p.x - p.w / 2, 0, p.z - p.d / 2),
          at(p.x + p.w / 2, 0, p.z - p.d / 2),
          at(p.x + p.w / 2, 0, p.z + p.d / 2),
          at(p.x - p.w / 2, 0, p.z + p.d / 2),
        ],
        padCentre: at(p.x, 0, p.z),
        ghosts: (r.ghosts || []).map((g) => at(g.x, g.y, g.z)),
        machine: at(yard.machine.x, 1, yard.machine.z),
      };
    },
    /** The stick and button axes as they stand right now (read-only; for tools). */
    get axes() {
      return { ...app.controls.peek() };
    },
    voiceFor,
    say,
    ...(app.params.has('perf')
      ? {
          resetPerformance() {
            for (const a of Object.values(samples)) a.length = 0;
          },
        }
      : {}),
    ...(app.testing
      ? {
          test: {
            start: (id) => startRound(id),
            advance(input = {}, n = 1) {
              for (let i = 0; i < Math.min(n, 3600); i++) {
                if (!activePlay()) break;
                step(input);
              }
              updateUI();
              return window.__buildCrew.state;
            },
            action,
            reset: resetBlocks,
          },
        }
      : {}),
  };
}

boot().catch((e) => {
  console.error('[BuildCrew] Could not open the yard', e);
  $('#loading').replaceChildren(
    h(
      'div',
      { class: 'loading-card' },
      h('h1', {}, 'The yard needs another try.'),
      h('p', {}, 'This game needs a browser with WebGL 2. Try reloading the yard.'),
      h('button', { class: 'primary', onclick: () => location.reload() }, 'Try again'),
    ),
  );
});
