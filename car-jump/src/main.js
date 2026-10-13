// Ramp Rage bootstrap: save, audio, engine (real or mock), screens, and the run lifecycle.
// The real engine lives at ./game/engine.js (built separately against the SPEC contract). It is
// imported dynamically so the shell keeps working — on the mock — if it is missing or broken.

import { CAR_BY_ID } from './data/cars.js';
import { TRACK_BY_ID } from './data/tracks.js';
import { resolveStats } from './data/upgrades.js';
import { Audio } from './audio.js';
import { loadSave, writeSave, wipeSave } from './meta/save.js';
import { bankRun, earn, statsFor } from './meta/economy.js';
import { claimGoals, ensureGoals, goalEvent, goalSummary, goalText } from './meta/goals.js';
import { dailyFor, refreshDaily, todayKey } from './meta/daily.js';
import { hashString } from './meta/rng.js';
import { $, $$, money } from './ui/dom.js';
import { COIN, hydrateIcons } from './ui/icons.js';
import { createControls } from './ui/controls.js';
import { createHud } from './ui/hud.js';
import { createGarage } from './ui/garage.js';
import { createTracks } from './ui/tracks.js';
import { createResults } from './ui/results.js';
import { createPanels } from './ui/panels.js';

const VERSION = '1.0.0';
const params = new URLSearchParams(location.search);

async function loadEngine() {
  if (params.get('mock') === '1') {
    const m = await import('./meta/mockEngine.js');
    return { createGame: m.createGame, name: 'mock engine' };
  }
  try {
    const m = await import('./game/engine.js');
    if (typeof m.createGame !== 'function') throw new Error('engine.js has no createGame export');
    return { createGame: m.createGame, name: '' };
  } catch (e) {
    console.warn('[RampRage] Real engine (src/game/engine.js) failed to load — falling back to the MOCK engine.', e);
    const m = await import('./meta/mockEngine.js');
    return { createGame: m.createGame, name: 'mock engine (fallback)' };
  }
}

async function boot() {
  hydrateIcons();
  const save = loadSave();
  refreshDaily(save);
  ensureGoals(save);

  const canvas = $('#game');
  const engineMod = await loadEngine();
  let game = null;
  let run = null;          // active run context, null when not running
  let hudRaf = 0;
  let input = { gas: false, brake: false, nitro: false };
  let screen = 'title';
  let paused = false, stopFallback = 0;

  const app = {
    save,
    audio: Audio,
    version: VERSION,
    engineName: engineMod.name,
    persist: () => writeSave(save),
    go,
    toast,
    refreshCash,
    startRun,
    closePanel,
    setSetting,
    resetProgress,
  };

  // ---------- engine ----------
  function makeGame() {
    try {
      game = engineMod.createGame(canvas, { onEvent, reducedMotion: save.settings.reducedMotion });
    } catch (e) {
      console.error('[RampRage] createGame threw', e);
      game = null;
    }
  }
  makeGame();
  if (!game && engineMod.name === '') {
    console.warn('[RampRage] Real engine threw on create — falling back to the MOCK engine.');
    const m = await import('./meta/mockEngine.js');
    engineMod.createGame = m.createGame; engineMod.name = app.engineName = 'mock engine (fallback)';
    makeGame();
  }

  // ---------- UI ----------
  const hud = createHud();
  const controls = createControls($('#controls'), (s) => {
    input = s;
    if (game && run) game.setInput(s);
  });
  const screens = { garage: createGarage(app), tracks: createTracks(app), results: createResults(app) };
  const panels = createPanels(app);

  function refreshCash() {
    const html = `${COIN}<span>${money(save.cash)}</span>`;
    for (const el of $$('[data-cash]')) el.innerHTML = html;
    $('#badge-daily').hidden = save.daily.done;
  }

  function go(name, arg) {
    closePanel();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    const inRun = name === 'run';
    document.documentElement.classList.toggle('in-run', inRun);
    if (name === 'results') $('#toasts').textContent = '';
    $('#hud').hidden = !inRun;
    $('#controls').hidden = !inRun;
    $('#backdrop').hidden = inRun || name === 'results';
    if (screens[name]) screens[name].show(arg);
    refreshCash();
  }

  function openPanel(name) {
    for (const el of $$('.modal')) el.hidden = el.dataset.panel !== name;
    panels.render(name);
  }
  function closePanel() {
    for (const el of $$('.modal')) el.hidden = true;
  }

  // toasts live on #app (not inside the HUD) so menus can use them too
  $('#app').append($('#toasts'));
  function toast(text) { hud.toast(text); }

  function setSetting(key, value) {
    save.settings[key] = !!value;
    app.persist();
    if (key === 'sound') Audio.setSound(value);
    if (key === 'music') Audio.music(value);
    if (key === 'reducedMotion') {
      document.documentElement.classList.toggle('reduced-motion', !!value);
      if (!run) { try { game && game.destroy(); } catch (_) {} makeGame(); }
    }
    renderPauseToggles();
  }

  function resetProgress() {
    const fresh = wipeSave();
    const keepSettings = save.settings;
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, fresh, { settings: keepSettings });
    refreshDaily(save); ensureGoals(save);
    app.persist();
    refreshCash();
  }

  // ---------- run lifecycle ----------
  function startRun({ trackId, daily = false }) {
    if (!game) { toast('Engine failed to load'); return; }
    closePanel();
    let car, stats, seed, def = null;
    trackId = daily ? dailyFor(todayKey()).trackId : trackId;
    const track = TRACK_BY_ID[trackId];
    if (daily) {
      refreshDaily(save);
      def = dailyFor(todayKey());
      car = CAR_BY_ID[def.carId];
      stats = resolveStats(car, def.levels);
      seed = def.seed;
      save.daily.attempts += 1;
      app.persist();
    } else {
      car = CAR_BY_ID[save.selectedCar];
      stats = statsFor(save, car.id);
      seed = hashString('track:' + trackId);   // fixed layout per track so it can be learned
    }
    run = { trackId, daily, def, carId: car.id, stats, ended: false, goalToasts: [] };
    go('run');
    hud.reset(track);
    controls.reset();
    controls.enable(true);
    Audio.duck(true);
    try {
      game.start({ car, stats, track, seed });
      game.setInput({ gas: false, brake: false, nitro: false });
    } catch (e) {
      console.error('[RampRage] game.start threw', e);
      run = null; controls.enable(false); go('tracks'); toast('Could not start the run');
      return;
    }
    cancelAnimationFrame(hudRaf);
    hudRaf = requestAnimationFrame(hudLoop);
  }

  function hudLoop() {
    if (!run) return;
    hudRaf = requestAnimationFrame(hudLoop);
    let s = null;
    try { s = game.getState(); } catch (_) { /* engine between runs */ }
    if (!s) return;
    hud.update(s);
    if (!paused) {
      Audio.engine(s.phase === 'done' ? -1 : Math.min(1, (s.speedKmh || 0) / 180));
      Audio.nitro(!!(input.nitro && s.nitro > 0.01 && s.phase !== 'done'));
    }
  }

  function onEvent(evt) {
    if (!run || !evt) return;
    switch (evt.type) {
      case 'launch': Audio.whoosh(); break;
      case 'flip': Audio.flip(); break;
      case 'land': Audio.land(evt.quality); break;
      case 'smash': Audio.smash(); setTimeout(() => Audio.coin(), 60); break;
      case 'finishLine': Audio.fanfare(); hud.toast(run.daily ? 'Finish line!' : 'Finish line! Next track unlocked'); break;
      case 'finish': endRun(evt.summary); return;
      default: break;
    }
    for (const g of goalEvent(save, evt)) hud.toast(`Goal done: ${goalText(g)}`);
  }

  function endRun(summary) {
    if (!run || run.ended) return;
    const r = run;
    r.ended = true;
    run = null;
    clearTimeout(stopFallback);
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false); Audio.duck(false);
    summary = summary || {};
    const bank = bankRun(save, r.trackId, summary, { ranked: !r.daily });
    for (const g of goalSummary(save, summary)) hud.toast(`Goal done: ${goalText(g)}`);
    const goals = claimGoals(save);
    let dailyReward = 0, dailyAlreadyDone = false;
    if (r.daily) {
      refreshDaily(save);
      if (save.daily.done) dailyAlreadyDone = true;
      else if (r.def.check(summary)) { save.daily.done = true; dailyReward = earn(save, r.def.reward); }
    }
    app.persist();
    const result = {
      trackId: r.trackId, daily: r.daily, carId: r.carId, stats: r.stats, summary, bank, goals,
      dailyReward, dailyAlreadyDone, dailyGoalText: r.def && r.def.goal.text, dailyValue: r.def && r.def.value(summary),
    };
    setTimeout(() => {
      go('results', result);
      if (bank.newBest || dailyReward || goals.length) Audio.cash();
    }, paused ? 0 : 900);
    paused = false;
  }

  // ---------- pause ----------
  function pause() {
    if (!run || paused) return;
    paused = true;
    try { game.pause(); } catch (_) {}
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false);
    renderPauseToggles();
    openPanel('pause');
  }
  function resume() {
    if (!run || !paused) return;
    paused = false;
    closePanel();
    controls.enable(true);
    try { game.resume(); } catch (_) {}
  }
  function renderPauseToggles() {
    $('#pause-sound').textContent = `Sound: ${save.settings.sound ? 'On' : 'Off'}`;
    $('#pause-music').textContent = `Music: ${save.settings.music ? 'On' : 'Off'}`;
  }
  $('#btn-pause').addEventListener('click', pause);
  $('#pause-resume').addEventListener('click', resume);
  $('#pause-sound').addEventListener('click', () => setSetting('sound', !save.settings.sound));
  $('#pause-music').addEventListener('click', () => setSetting('music', !save.settings.music));
  $('#pause-end').addEventListener('click', () => {
    if (!run) return;
    closePanel();
    const snap = (() => { try { return game.getState(); } catch (_) { return null; } })();
    try { game.resume(); game.stop(); } catch (e) { console.error(e); }
    // contract says stop() emits 'finish'; if an engine doesn't, bank what we have
    stopFallback = setTimeout(() => {
      if (!run) return;
      const s = snap || {};
      endRun({ distance: s.distance || 0, airTime: s.airTime || 0, flips: s.flips || 0, frontFlips: 0, backFlips: 0, smashed: s.smashed || 0,
        maxSpeedKmh: s.speedKmh || 0, landing: s.landing, finishCrossed: !!s.finishCrossed,
        cash: { distance: 0, stunts: 0, smash: 0, landing: 0, total: Math.round(s.cash || 0) }, durationSec: 0 });
    }, 600);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); Audio.suspend(); } else Audio.resume();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (run) { paused ? resume() : pause(); e.preventDefault(); }
      else if (!$$('.modal').every((m) => m.hidden)) closePanel();
    }
  });

  // ---------- navigation wiring ----------
  $('#btn-play').addEventListener('click', () => go('garage'));
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  for (const b of $$('[data-open]')) b.addEventListener('click', () => openPanel(b.dataset.open));
  for (const b of $$('[data-close]')) b.addEventListener('click', closePanel);
  for (const m of $$('.modal')) m.addEventListener('click', (e) => { if (e.target === m && m.dataset.panel !== 'pause') closePanel(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) Audio.click(); });

  // ---------- audio unlock (first gesture anywhere) ----------
  Audio.setSound(save.settings.sound);
  const unlock = () => {
    Audio.unlock();
    Audio.setSound(save.settings.sound);
    if (!save.settings.music) Audio.music(false);
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  // ---------- iOS gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .garage-body, .tracks-body, .results-body')) e.preventDefault();
  }, { passive: false });

  document.documentElement.classList.toggle('reduced-motion', save.settings.reducedMotion);
  go('title');
  app.persist();
  window.__rampRage = { app, get game() { return game; }, get run() { return run; } }; // debugging / smoke tests
  registerSW();
}

function registerSW() {
  try {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || params.has('nosw')) return;
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
      // hand the SW every same-origin file this page actually loaded (catches engine modules too)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[RampRage] service worker registration failed', e));
  } catch (e) {
    console.warn('[RampRage] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[RampRage] boot failed', e));
