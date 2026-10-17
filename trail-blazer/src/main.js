// Trail Blazer bootstrap: the family (Spell Jump's players, PIN and family code through profiles.js), family sync,
// the save, audio, the engine (real or mock), the screens and the ride lifecycle.
// The real engine lives at ./game/engine.js and the trails at ./data/trails.js (the engine agent's, SPEC §3); both are
// imported dynamically so the shell keeps working (mock engine, built-in trail list) if they are missing or broken.
// v1 has no math layer: rides start with `gates: 0`; boost fuel comes from trail coins and good landings, and the
// winch is free (a 1 s pull, then game.winch(true)).
// TODO (math phase, SPEC §4-§5): the gate flow hooks in at onEvent 'gate' (src/ui/gatePanel.js → game.openGate()),
// the winch question at showWinch(), the ride's facts on the results, and Facts this week / Report in the Parent Zone.

import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { $, $$, h, money } from '../../spell-jump/src/ui/dom.js';
import { COIN } from '../../spell-jump/src/ui/icons.js';
import { createControls } from '../../spell-jump/src/ui/controls.js';
import { Sfx } from './sfx.js';
import { FALLBACK_TRAILS } from './data/fallbackTrails.js';
import { defaultSave, loadSave, loadSettings, removeSave, writeSave, writeSettings } from './meta/save.js';
import {
  bankRide, cashRows, currentTrail, finishedCount, hashString, isUnlocked, nextTrail, ratingFor, statsFor,
} from './meta/economy.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { hydrateAll } from './ui/tbIcons.js';
import { createPlayers } from './ui/players.js';
import { createGarage } from './ui/garage.js';
import { createTrails } from './ui/trails.js';
import { createHud } from './ui/hud.js';
import { createResults } from './ui/results.js';
import { createParentZone } from './ui/parentZone.js';
import { drawAvatar, drawPreview, loadVehicle } from './ui/vehiclePreview.js';

const VERSION = '1.0.0';
const params = new URLSearchParams(location.search);
const RESUME_KEY = 'trailBlazer.resumePlayer';   // sessionStorage: the player to come back to after an update reload
const WINCH_MS = 1000;
const swUsable = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw');

// ---------- self-update (see meta/selfUpdate.js) ----------
const updateHooks = { isSafe: () => true, notify: () => {}, beforeReload: () => {} };
const updater = createUpdateGuard({
  hadController: swUsable && !!navigator.serviceWorker.controller,
  isSafe: () => updateHooks.isSafe(),
  notify: () => updateHooks.notify(),
  reload: () => { try { updateHooks.beforeReload(); } catch (_) { /* ignore */ } location.reload(); },
});
if (swUsable) {
  window.__trailBlazerUpdate = updater;   // tells the index.html safety net that this module loaded
  navigator.serviceWorker.addEventListener('controllerchange', () => updater.onControllerChange());
}

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
    console.warn('[TrailBlazer] Real engine (src/game/engine.js) failed to load: using the MOCK engine.', e);
    const m = await import('./meta/mockEngine.js');
    return { createGame: m.createGame, name: 'mock engine (fallback)' };
  }
}

// the engine agent's trail list (TRAILS or the default export); the built-in list if it is missing or malformed
async function loadTrails() {
  try {
    const m = await import('./data/trails.js');
    const list = Array.isArray(m.TRAILS) ? m.TRAILS : Array.isArray(m.default) ? m.default : null;
    if (list && list.length && list.every((t) => t && typeof t.id === 'string' && typeof t.name === 'string')) {
      return { trails: list.map((t) => ({ ...t, length: Number(t.length) > 0 ? Number(t.length) : 600 })), source: 'data/trails.js' };
    }
    console.warn('[TrailBlazer] data/trails.js has no usable TRAILS list: using the built-in trails.');
  } catch (e) {
    console.warn('[TrailBlazer] data/trails.js failed to load: using the built-in trails.', e);
  }
  return { trails: FALLBACK_TRAILS, source: 'built-in' };
}

async function boot() {
  hydrateAll();
  const settings = loadSettings();
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  // family sync (off until a parent creates or joins a family): Spell Jump's client, started the same way. It syncs
  // the family record (players, PIN, options) and Spell Jump's own keys; Trail Blazer's save stays on this device (v1)
  const sync = createSyncClient({
    canApply: (k) => (k === 'family' ? !run : true),
    onApply: (k) => syncApplied(k),
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); },
  });
  const family = Profiles.loadFamily();
  const save = defaultSave();           // replaced in place when a player is picked (screens hold this reference)
  let currentPlayerId = null;
  const { trails, source: trailSource } = await loadTrails();
  const canvas = $('#game');
  const engineMod = await loadEngine();
  let game = null, run = null, hudRaf = 0, screen = 'players', paused = false, coaching = false, stopFallback = 0, lastResult = null;
  let input = { gas: false, brake: false, boost: false };
  const toastsEl = $('#toasts');

  const app = {
    save, settings, sync, trails, trailSource,
    audio: Audio, sfx: Sfx,
    version: VERSION,
    engineName: engineMod.name,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    persist: () => writeSave(currentPlayerId, save),
    go, toast, refreshCash, startRide, setSetting, setShake, selectPlayer,
    createPlayer: (name, color) => Profiles.createPlayer(family, name, color),
    openParents: (opts) => pz.open(opts),
    onLookChanged: () => drawHero(),
    trailsDoneFor(id) { return finishedCount(id === currentPlayerId ? save : loadSave(id), trails); },
    resetSaveFor(id) {
      removeSave(id);
      if (id === currentPlayerId) { replaceSave(defaultSave()); save.seen.coach = true; app.persist(); refreshCash(); }
    },
    removePlayer(id) {
      Profiles.removePlayer(family, id);    // tombstoned in the family record: removed on every device, both games
      removeSave(id);
      if (id === currentPlayerId) { currentPlayerId = null; replaceSave(defaultSave()); }
    },
    onFamilyChanged() { if (screen === 'title') refreshTitle(); },
    onParentZoneClosed() {
      if (!currentPlayerId || screen === 'players') go('players');   // players may have been added, joined or removed
      else if (screen === 'title') refreshTitle();
      setTimeout(() => updater.check(), 0);
    },
  };

  // ---------- engine ----------
  function makeGame() {
    try { game = engineMod.createGame(canvas, { onEvent, reducedMotion: settings.reducedMotion }); } catch (e) { console.error('[TrailBlazer] createGame threw', e); game = null; }
  }
  makeGame();
  if (!game && engineMod.name === '') {
    console.warn('[TrailBlazer] Real engine threw on create: using the MOCK engine.');
    const m = await import('./meta/mockEngine.js');
    engineMod.createGame = m.createGame; engineMod.name = app.engineName = 'mock engine (fallback)';
    makeGame();
  }

  // ---------- UI ----------
  const hud = createHud();
  const controls = createControls($('#controls'), (s) => {
    input = { gas: !!s.gas, brake: !!s.brake, boost: !!s.nitro };
    if (game && run) game.setInput(input);
  });
  const playersUI = createPlayers(app);
  const screens = { players: playersUI.players, newplayer: playersUI.newplayer, garage: createGarage(app), trails: createTrails(app), results: createResults(app) };
  const pz = createParentZone(app);
  const heroCanvas = $('#hero');
  let heroRaf = 0;
  function drawHero(t = 0) {
    if (!currentPlayerId) return;
    const rm = settings.reducedMotion;
    drawPreview(heroCanvas, { paint: save.paint, decal: save.decal }, { t: 0, bob: rm ? 0 : Math.sin(t / 70) * 0.7 + Math.sin(t / 23) * 0.3 });
  }
  function heroLoop(t) { drawHero(t); heroRaf = requestAnimationFrame(heroLoop); }
  function setHero(on) {
    cancelAnimationFrame(heroRaf); heroRaf = 0;
    heroCanvas.hidden = !on;
    if (on) { if (settings.reducedMotion) drawHero(0); else heroRaf = requestAnimationFrame(heroLoop); }
  }
  // the engine's Ranger art arrives later (or never): redraw what shows the Ranger when it does
  loadVehicle().then((m) => { if (!m) return; if (screen === 'title') drawHero(); if (screen === 'players') screens.players.show(); });

  function refreshCash() {
    const html = `${COIN}<span>${money(save.cash)}</span>`;
    for (const el of $$('[data-cash]')) el.innerHTML = html;
  }
  function replaceSave(fresh) {
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, fresh);
  }

  // ---------- players ----------
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    currentPlayerId = id;
    replaceSave(loadSave(id));
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    app.persist();
    go('title');
  }
  function refreshTitle() {
    const p = Profiles.playerById(family, currentPlayerId);
    if (!p) return;
    $('#title-player').textContent = p.name;
    drawAvatar($('#title-avatar'), p.color);
    $('#title-trails-text').textContent = `Trails ${finishedCount(save, trails)} / ${trails.length}`;
  }

  function go(name, arg) {
    closePanel();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    const inRide = name === 'ride';
    document.documentElement.classList.toggle('in-run', inRide);
    if (!inRide) { hud.clearBanners(); hideCoach(); hideWinch(); }
    if (inRide || name === 'results') toastsEl.replaceChildren();
    $('#hud').hidden = !inRide;
    $('#controls').hidden = !inRide;
    $('#backdrop').hidden = inRide || name === 'results';
    setHero(name === 'title');
    if (name === 'title') refreshTitle();
    if (screens[name]) screens[name].show(arg);
    refreshCash();
    setTimeout(() => updater.check(), 0);   // a waiting update reloads once the app is on a safe screen
  }
  function openPanel(name) { for (const el of $$('.modal')) el.hidden = el.dataset.panel !== name; }
  function closePanel() { for (const el of $$('.modal')) el.hidden = true; }

  function toast(text) {
    const t = h('div', { class: 'toast' }, text);
    toastsEl.append(t);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
    setTimeout(() => t.remove(), 2700);
  }

  // ---------- settings (this device) ----------
  function setSetting(key, value) {
    settings[key] = !!value;
    writeSettings(settings);
    if (key === 'sound') { Audio.setSound(settings.sound); Sfx.setSound(settings.sound); }
    if (key === 'music') Audio.music(settings.music);
    if (key === 'reducedMotion') {
      document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
      if (!run) { try { game && game.destroy(); } catch (_) { /* ignore */ } makeGame(); }
      setHero(screen === 'title');
    }
    renderPauseToggles();
  }
  function setShake(value) {
    settings.shake = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    writeSettings(settings);
  }

  // ---------- family sync: newer data from another device ----------
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };
  function syncApplied(k) {
    if (k !== 'family') return;                    // Spell Jump's own keys: nothing in memory here
    replaceInPlace(family, Profiles.loadFamily());
    if (currentPlayerId && !Profiles.playerById(family, currentPlayerId)) {
      currentPlayerId = null; replaceSave(defaultSave());
      if (!pz.isOpen) go('players');
    } else if (screen === 'players') screens.players.show();
    else if (screen === 'title') refreshTitle();
    pz.onSyncApplied();
  }

  // ---------- ride lifecycle ----------
  function startRide(trailId) {
    if (!game) { toast('The ride could not load'); return; }
    closePanel();
    const trail = trails.find((t) => t.id === trailId && isUnlocked(save, trails, t.id)) || currentTrail(save, trails);
    clearTimeout(stopFallback);
    run = { trail, ended: false, winching: false, winchCalled: false, winchTimer: 0, quitting: false };
    save.selectedTrail = trail.id;
    go('ride');
    hud.reset(trail);
    controls.reset();
    controls.enable(true);
    paused = false;
    try {
      game.start({
        trail, stats: statsFor(save), seed: hashString('trail:' + trail.id), paint: save.paint, decal: save.decal,
        bestDistance: save.best[trail.id] || null, gates: 0,          // v1: no gate signs (the math layer adds them)
        shake: settings.reducedMotion ? 0 : settings.shake / 100,
      });
      game.setInput({ gas: false, brake: false, boost: false });
    } catch (e) {
      console.error('[TrailBlazer] game.start threw', e);
      run = null; controls.enable(false); go('trails'); toast('Could not start the ride');
      return;
    }
    cancelAnimationFrame(hudRaf);
    hudRaf = requestAnimationFrame(hudLoop);
    if (!save.seen.coach) showCoach();
  }

  function hudLoop() {
    if (!run) return;
    hudRaf = requestAnimationFrame(hudLoop);
    let s = null;
    try { s = game.getState(); } catch (_) { /* engine between rides */ }
    if (!s) return;
    hud.update(s);
    // the engine keeps phase 'stuck' while its own winch animation pulls the Ranger (until 'winched'): no second button
    if (s.stuck && !run.winching && !run.winchCalled && winchBtn.hidden && !paused && !coaching) showWinch();
    if (!s.stuck) { run.winchCalled = false; if (!run.winching && !winchBtn.hidden) hideWinch(); }
    if (!paused) {
      Audio.engine(s.phase === 'done' ? -1 : Math.min(1, (s.speedKmh || 0) / 90));
      Audio.nitro(!!(input.boost && s.boost > 0.01 && s.phase === 'ride'));
    }
  }

  // ---------- the winch: free in v1 (TODO math phase: the gate panel in winch mode asks one fact first) ----------
  const winchBtn = $('#btn-winch');
  function showWinch() {
    if (!run) return;
    winchBtn.classList.remove('pulling');
    $('#winch-text').textContent = 'Winch';
    winchBtn.hidden = false;
    Audio.oops(true);
  }
  function hideWinch() {
    winchBtn.hidden = true;
    winchBtn.classList.remove('pulling');
  }
  function pullWinch() {
    const r = run;
    if (!r || r.winching || winchBtn.hidden || paused) return;
    r.winching = true;
    winchBtn.classList.add('pulling');
    $('#winch-text').textContent = 'Pulling…';
    Sfx.winch(WINCH_MS / 1000);
    r.winchTimer = setTimeout(() => {
      if (run !== r || r.ended) return;
      r.winching = false;
      let ok = false;
      try { ok = game.winch(true) !== false; } catch (e) { console.error('[TrailBlazer] winch failed', e); }
      r.winchCalled = ok;           // the engine now pulls the Ranger up the trail; 'winched' ends it
      hideWinch();
    }, WINCH_MS);
  }
  winchBtn.addEventListener('click', pullWinch);

  function onEvent(evt) {
    if (!run || !evt) return;
    switch (evt.type) {
      case 'launch': Audio.whoosh(); break;
      case 'flip': Audio.flip(); break;
      case 'land':
        Audio.land(evt.quality === 'hard' ? 'rough' : evt.quality);
        if (evt.quality === 'perfect') setTimeout(() => Audio.cheer(0.6), 120);
        break;
      case 'smash': Audio.smash(); setTimeout(() => Audio.coin(), 60); break;
      case 'coin': Audio.coin(); break;
      case 'splash': Sfx.splash(); break;
      case 'stuck': if (!run.winching && !run.winchCalled) showWinch(); break;
      case 'winched': run.winchCalled = false; hideWinch(); Audio.land('good'); break;
      case 'unstuck': if (!run.winching) hideWinch(); break;     // drove out without the winch
      case 'gate':
        // v1 starts every ride with gates: 0, so no gate should appear; never leave the Ranger parked if one does.
        // TODO (math phase): open src/ui/gatePanel.js here and pass its result to game.openGate().
        try { game.openGate({ correct: true, quick: false, fixed: false }); } catch (_) { /* ignore */ }
        break;
      case 'gateOpen': Sfx.creak(); break;
      case 'finishLine': {
        Audio.cheer(1.2); Audio.fireworks();
        const n = nextTrail(trails, run.trail.id);
        if (n && !isUnlocked(save, trails, n.id)) hud.banner('go', `Unlocked: ${n.name}`);
        break;
      }
      case 'finish': endRide(evt.summary); break;
      default: break;
    }
  }

  function endRide(summary) {
    if (!run || run.ended) return;
    const r = run;
    r.ended = true;
    run = null;
    clearTimeout(stopFallback); clearTimeout(r.winchTimer);
    controls.enable(false);
    hideWinch(); hideCoach();
    Audio.engine(-1); Audio.nitro(false);
    summary = summary && typeof summary === 'object' ? summary : {};
    const { rows, total } = cashRows(summary.cash);
    const bank = bankRide(save, trails, r.trail.id, summary);
    save.seen.coach = true;
    app.persist();
    const rating = summary.rating || ratingFor(summary, r.trail.length).rating;
    const nt = nextTrail(trails, r.trail.id);
    const result = lastResult = {
      trail: r.trail, summary, rows, total, bank, rating,
      next: nt && isUnlocked(save, trails, nt.id) ? nt : null,
      unlocked: bank.unlocked ? trails.find((t) => t.id === bank.unlocked) : null,
    };
    const wasPaused = paused;
    paused = false;
    setTimeout(() => {
      go('results', result);
      if (bank.earned) Audio.cash();
      if (bank.unlocked || bank.paints.length || bank.decals.length) setTimeout(() => Audio.fanfare(), 400);
    }, wasPaused ? 0 : 900);
  }

  // ---------- pause (sound, music, motion, shake, end ride) ----------
  function pause() {
    if (!run || paused || coaching || run.winching) return;
    paused = true;
    try { game.pause(); } catch (_) { /* ignore */ }
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
    try { game.resume(); } catch (_) { /* ignore */ }
  }
  // the pause menu's shake slider is a plain element (role="slider"), not a native <input>: the only native inputs
  // in the app live in the Parent Zone
  const shakeEl = $('#pause-shake');
  const shakeOff = () => !!settings.reducedMotion;
  function paintShake(v) {
    shakeEl.setAttribute('aria-valuenow', String(v));
    shakeEl.style.setProperty('--pct', `${v}%`);
    shakeEl.style.setProperty('--p', String(v / 100));
    $('#pause-shake-val').textContent = `${v}%`;
  }
  function renderPauseToggles() {
    $('#pause-sound').textContent = `Sound: ${settings.sound ? 'On' : 'Off'}`;
    $('#pause-music').textContent = `Music: ${settings.music ? 'On' : 'Off'}`;
    $('#pause-motion').textContent = `Motion: ${settings.reducedMotion ? 'Calm' : 'Full'}`;
    paintShake(settings.shake);
    shakeEl.setAttribute('aria-disabled', String(shakeOff()));
    shakeEl.tabIndex = shakeOff() ? -1 : 0;
    shakeEl.closest('.row').classList.toggle('is-disabled', shakeOff());
  }
  const shakeFromPointer = (e) => {
    const rect = shakeEl.getBoundingClientRect();
    const v = Math.round((Math.max(0, Math.min(1, (e.clientX - rect.left - 15) / Math.max(1, rect.width - 30))) * 100) / 5) * 5;
    if (v !== settings.shake) { setShake(v); paintShake(v); }
  };
  shakeEl.addEventListener('pointerdown', (e) => { if (shakeOff()) return; e.preventDefault(); try { shakeEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } shakeFromPointer(e); });
  shakeEl.addEventListener('pointermove', (e) => { if (shakeEl.hasPointerCapture && shakeEl.hasPointerCapture(e.pointerId)) shakeFromPointer(e); });
  shakeEl.addEventListener('keydown', (e) => {
    if (shakeOff()) return;
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, Home: -100, End: 100 }[e.key];
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    setShake(Math.max(0, Math.min(100, settings.shake + step))); paintShake(settings.shake);
  });
  $('#btn-pause').addEventListener('click', pause);
  $('#pause-resume').addEventListener('click', resume);
  $('#pause-sound').addEventListener('click', () => setSetting('sound', !settings.sound));
  $('#pause-music').addEventListener('click', () => setSetting('music', !settings.music));
  $('#pause-motion').addEventListener('click', () => setSetting('reducedMotion', !settings.reducedMotion));
  $('#pause-end').addEventListener('click', () => {
    if (!run) return;
    closePanel();
    const snap = (() => { try { return game.getState(); } catch (_) { return null; } })();
    const r = run;
    r.quitting = true;
    try { game.resume(); game.stop(); } catch (e) { console.error(e); }
    // stop() should end the ride with a 'finish' event; if an engine does not, bank what the HUD showed (for THIS ride)
    clearTimeout(stopFallback);
    stopFallback = setTimeout(() => {
      if (!run || run !== r || r.ended) return;
      const s = snap || {};
      const c = Math.round(s.cash || 0);
      endRide({ distance: s.distance || 0, airTime: 0, flips: s.flips || 0, smashed: s.smashed || 0, maxSpeedKmh: s.speedKmh || 0, finishCrossed: !!s.finishCrossed,
        cash: { distance: c, air: 0, smash: 0, coins: 0, total: c }, winches: 0 });
    }, 600);
  });

  // ---------- keyboard hints (coach tips, pause menu) ----------
  let keyPressed = false;
  const fineHover = (() => { try { return matchMedia('(hover: hover) and (pointer: fine)'); } catch (_) { return null; } })();
  const paintKbd = () => document.documentElement.classList.toggle('kbd', keyPressed || !!(fineHover && fineHover.matches));
  paintKbd();
  if (fineHover && fineHover.addEventListener) fineHover.addEventListener('change', paintKbd);
  window.addEventListener('keydown', () => { if (!keyPressed) { keyPressed = true; paintKbd(); } }, { capture: true });

  // ---------- first-ride coach ----------
  function showCoach() {
    coaching = true;
    try { game.pause(); } catch (_) { /* ignore */ }
    controls.enable(false);
    $('#coach').hidden = false;
  }
  function hideCoach() {
    if (!coaching) return;
    coaching = false;
    $('#coach').hidden = true;
  }
  function dismissCoach(e) {
    if (!coaching) return;
    if (e) e.preventDefault();
    hideCoach();
    save.seen.coach = true;
    app.persist();
    if (run && !paused) { controls.enable(true); try { game.resume(); } catch (_) { /* ignore */ } }
  }
  $('#coach').addEventListener('pointerdown', dismissCoach);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); Audio.suspend(); Sfx.suspend(); app.persist(); setHero(false); } else { Audio.resume(); Sfx.resume(); setHero(screen === 'title'); }
  });
  window.addEventListener('pagehide', () => { pause(); app.persist(); });
  window.addEventListener('keydown', (e) => {
    if (coaching && (e.code === 'Enter' || e.code === 'Space')) { dismissCoach(e); return; }
    if (run && !winchBtn.hidden && (e.code === 'Enter' || e.code === 'KeyW')) { e.preventDefault(); pullWinch(); return; }
    if (e.code === 'Escape' || (e.code === 'KeyP' && run)) {
      if (coaching) { dismissCoach(e); return; }
      if (pz.isOpen) { pz.close(); return; }
      if (run) { paused ? resume() : pause(); e.preventDefault(); }
    }
  });

  // ---------- navigation wiring ----------
  $('#btn-ride').addEventListener('click', () => go('trails'));
  $('#btn-garage').addEventListener('click', () => go('garage'));
  $('#btn-parents').addEventListener('click', () => pz.open({ tab: 'sync' }));
  $('#btn-player').addEventListener('click', () => go('players'));
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) Audio.click(); });

  // ---------- audio unlock (first gesture anywhere) ----------
  Audio.setSound(settings.sound); Audio.music(settings.music); Sfx.setSound(settings.sound);
  const unlock = () => { Audio.unlock(); Sfx.unlock(); Audio.setSound(settings.sound); if (!settings.music) Audio.music(false); };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  // ---------- iOS gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.pz input, .pz textarea')) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .garage-body, .trails-body, .results-body, .style-strip, .pz input')) e.preventDefault();
  }, { passive: false });

  go('players');
  updateHooks.isSafe = () => safeToReload({ screen, running: !!run, parentZone: pz.isOpen }) && !coaching;
  updateHooks.notify = () => {
    const t = h('div', { class: 'toast update-note', id: 'update-note', role: 'status' }, UPDATE_NOTICE);
    $('#app').append(t);
    setTimeout(() => t.remove(), 4000);
  };
  updateHooks.beforeReload = () => {
    app.persist();
    try { if (currentPlayerId && screen !== 'players') sessionStorage.setItem(RESUME_KEY, currentPlayerId); } catch (_) { /* ignore */ }
  };
  let resumeId = null;
  try { resumeId = sessionStorage.getItem(RESUME_KEY); sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
  if (resumeId && Profiles.playerById(family, resumeId)) selectPlayer(resumeId);
  sync.start();                       // first pull after the picker is on screen (never blocks it)
  window.__trailBlazer = {
    app, hud, pz, sync, controls,
    get game() { return game; }, get run() { return run; }, get lastResult() { return lastResult; }, get coaching() { return coaching; },
    get screen() { return screen; }, get paused() { return paused; },
  }; // debugging / smoke tests
  registerSW();
}

function registerSW() {
  try {
    if (!swUsable) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // look for a new version whenever the app comes back to the front (a Home Screen app may stay open for days)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      return navigator.serviceWorker.ready;
    }).then((reg) => {
      // hand the SW every same-origin file this page loaded (the engine's modules, the shared Spell Jump modules)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[TrailBlazer] service worker registration failed', e));
  } catch (e) {
    console.warn('[TrailBlazer] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[TrailBlazer] boot failed', e));
