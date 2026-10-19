// Trail Blazer bootstrap: the family (Spell Jump's players, PIN and family code through profiles.js), family sync,
// the save, audio, the engine (real or mock), the screens and the ride lifecycle.
// The real engine lives at ./game/engine.js and the trails at ./data/trails.js (the engine agent's, SPEC §3); both are
// imported dynamically so the shell keeps working (mock engine, built-in trail list) if they are missing or broken.
// v1.1 (SPEC "Race mode"): every ride is a motocross race against three AI riders: a 3-2-1 gate drop, position +
// time + track bar on the HUD, stunt banners, crashes respawn at the last checkpoint (no winch), a podium with a medal.
// v1.2 (SPEC §4-§5 + "The math layer, in race mode"): Math Gates. A race starts with `gates` (Parents → Options, 3 / 4
// / 6) and on each 'gate' event the engine freezes the race; the Gate panel asks the scheduler's next fact (read
// aloud through Spell Jump's tts), main.js records the answer (facts store: boxes, mission, XP) and calls
// game.openGate({ correct, quick, fixed }). Results list the race's facts; the Fact Grid shows every fact's status.

import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { $, $$, h, money } from '../../spell-jump/src/ui/dom.js';
import { COIN } from '../../spell-jump/src/ui/icons.js';
import { createControls } from '../../spell-jump/src/ui/controls.js';
import { tts } from '../../spell-jump/src/spelling/tts.js';
import { createCloudVoice } from '../../spell-jump/src/spelling/cloudVoice.js';
import { Sfx } from './sfx.js';
import { FALLBACK_TRAILS } from './data/fallbackTrails.js';
import {
  defaultSave, loadFactsData, loadSave, loadSettings, removeFactsData, removeSave, writeFactsData, writeSave, writeSettings,
} from './meta/save.js';
import {
  bankRide, cashRows, currentTrail, earn, finishedCount, hashString, isUnlocked, nextTrail, statsFor,
} from './meta/economy.js';
import { MISSION_REWARD, activeFacts, levelFor, missionState, nextFact, noteRace, recordAnswer, resetFacts } from './facts/store.js';
import { createSession } from './facts/scheduler.js';
import { questionSentence } from './facts/facts.js';
import { createGatePanel } from './ui/gatePanel.js';
import { createGrid } from './ui/grid.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { hydrateAll } from './ui/tbIcons.js';
import { createPlayers } from './ui/players.js';
import { createGarage } from './ui/garage.js';
import { createTrails } from './ui/trails.js';
import { createHud } from './ui/hud.js';
import { createResults } from './ui/results.js';
import { createParentZone } from './ui/parentZone.js';
import { drawAvatar, drawPreview, loadVehicle, vehicleModule } from './ui/vehiclePreview.js';
import { COLOR_BY_PAINT } from './data/paints.js';
import { medalTimesFor, ordinal } from './data/medals.js';

const VERSION = '1.2.0';
const params = new URLSearchParams(location.search);
const RESUME_KEY = 'trailBlazer.resumePlayer';   // sessionStorage: the player to come back to after an update reload
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
      return { trails: list.map((t) => ({ ...t, length: Number(t.length) > 0 ? Number(t.length) : 600 })), source: 'data/trails.js',
        medalTable: m.MEDAL_TIMES && typeof m.MEDAL_TIMES === 'object' ? m.MEDAL_TIMES : null };
    }
    console.warn('[TrailBlazer] data/trails.js has no usable TRAILS list: using the built-in trails.');
  } catch (e) {
    console.warn('[TrailBlazer] data/trails.js failed to load: using the built-in trails.', e);
  }
  return { trails: FALLBACK_TRAILS, source: 'built-in', medalTable: null };
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
  let facts = null;                     // the current player's math data (src/facts/store.js)
  let session = createSession();        // re-queue + incremental rehearsal across the races of one sitting
  const factsCache = new Map();         // other players' math data while the Parent Zone edits them
  const { trails, source: trailSource, medalTable } = await loadTrails();
  const canvas = $('#game');
  const engineMod = await loadEngine();
  let game = null, run = null, hudRaf = 0, screen = 'players', paused = false, coaching = false, stopFallback = 0, lastResult = null;
  let input = { gas: false, brake: false, boost: false };
  const toastsEl = $('#toasts');

  const app = {
    save, settings, sync, trails, trailSource, medalTable,
    audio: Audio, sfx: Sfx,
    version: VERSION,
    engineName: engineMod.name,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get facts() { return facts; },
    persist: () => writeSave(currentPlayerId, save),
    persistFacts: () => { if (currentPlayerId && facts) writeFactsData(currentPlayerId, facts); },
    // ----- the math data of any player (Parent Zone) -----
    factsFor(id) {
      if (id === currentPlayerId && facts) return facts;
      if (!factsCache.has(id)) factsCache.set(id, loadFactsData(id));
      return factsCache.get(id);
    },
    saveFactsFor(id, d) {
      writeFactsData(id, d);
      if (id === currentPlayerId) { facts = d; session = createSession(); prepareVoice(); }
    },
    resetFactsFor(id) { const d = app.factsFor(id); resetFacts(d, Date.now()); app.saveFactsFor(id, d); },
    levelFor: (id) => levelFor((id === currentPlayerId && facts ? facts : app.factsFor(id)).xp || 0),
    // ----- the voice (Spell Jump's tts + natural voice) -----
    tts,
    say(text) { if (!facts || !facts.opts.aloud || !tts.available) return; try { tts.cancel(); tts.say(text); } catch (_) { /* ignore */ } },
    unlockVoice() { try { tts.unlock(); } catch (_) { /* ignore */ } },
    voiceInfo(id) {
      const o = Profiles.playerOptions(family, id);
      return { rate: o.rate, voiceName: o.voiceName || '', cloudVoice: o.cloudVoice || '', synced: !!sync.code, available: tts.available };
    },
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
      removeSave(id); removeFactsData(id); factsCache.delete(id);
      if (id === currentPlayerId) { currentPlayerId = null; facts = null; replaceSave(defaultSave()); }
    },
    onFamilyChanged() { if (screen === 'title') refreshTitle(); },
    onParentZoneClosed() {
      factsCache.clear();
      if (currentPlayerId) applyVoice();
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
  const paintColor = (id) => { const m = vehicleModule(); return (m && m.PAINT_BY_ID && m.PAINT_BY_ID[id] && m.PAINT_BY_ID[id].body) || COLOR_BY_PAINT[id] || '#c9d1d6'; };
  app.paintColor = paintColor;
  const hud = createHud({ paintColor });
  const controls = createControls($('#controls'), (s) => {
    input = { gas: !!s.gas, brake: !!s.brake, boost: !!s.nitro };
    if (game && run) game.setInput(input);
  });
  const playersUI = createPlayers(app);
  const screens = { players: playersUI.players, newplayer: playersUI.newplayer, garage: createGarage(app), trails: createTrails(app), results: createResults(app), grid: createGrid(app) };
  // the voice (SPEC §1): Spell Jump's tts, with the natural voice when the family has a code and the player's Spell Jump
  // voice option picked one (clips of "seven times eight." etc. from /api/tts/prepare; the device voice otherwise)
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => [], audio: Audio });
  tts.setCloud(cloud);
  tts.setOnSpeaking((on) => Audio.voice(on));
  const gatePanel = createGatePanel($('#gate'), { tts, audio: Audio, aloud: () => !!(facts && facts.opts.aloud) });
  function applyVoice() {
    if (!currentPlayerId) return;
    const o = Profiles.playerOptions(family, currentPlayerId);
    tts.setRate(o.rate);
    tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
    cloud.setVoice(o.cloudVoice || '');
    prepareVoice();
  }
  // the natural voice's clips for this week's facts (both ways round): asked once, the server keeps them
  function prepareVoice() {
    if (!facts || !cloud.active) return;
    const texts = [];
    for (const f of activeFacts(facts)) texts.push(questionSentence(f, false), questionSentence(f, true));
    cloud.prepare([...new Set(texts)]).catch(() => {});
  }
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
    facts = loadFactsData(id);
    session = createSession();
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    app.persist();
    app.persistFacts();
    applyVoice();
    go('title');
  }
  function refreshTitle() {
    const p = Profiles.playerById(family, currentPlayerId);
    if (!p) return;
    $('#title-player').textContent = p.name;
    drawAvatar($('#title-avatar'), p.color);
    $('#title-trails-text').textContent = `Tracks ${finishedCount(save, trails)} / ${trails.length}`;
    if (facts) {
      $('#title-lv').textContent = `Lv ${levelFor(facts.xp)}`;
      const m = missionState(facts, Date.now());
      $('#title-mission').classList.toggle('done', m.done);
      $('#title-mission-text').textContent = m.done ? 'Mission complete! Race on' : `Today: ${m.count} / ${m.size} math gates`;
    }
  }
  function refreshFactsHud() {
    if (!facts) return;
    const m = missionState(facts, Date.now());
    const el = $('#hud-facts');
    el.textContent = m.done ? `Facts ${m.answered} · mission done` : `Facts ${m.count} / ${m.size}`;
    el.classList.toggle('done', m.done);
  }

  // Ghost-click guard: on-screen keys act on pointerdown, so the click that follows the same tap would land on whatever the
  // new screen has under the finger (Done on the name keyboard sits over the title's Parents button). Swallow a pointer
  // click that arrives just after a screen change when its pointerdown came before the change.
  let lastGo = 0, lastDown = 0;
  document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, true);
  document.addEventListener('click', (e) => {
    const t = performance.now();
    if (lastDown < lastGo && t - lastGo < 500) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  function go(name, arg) {
    lastGo = performance.now();
    closePanel();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    const inRide = name === 'ride';
    document.documentElement.classList.toggle('in-run', inRide);
    if (!inRide) { hud.clearBanners(); hideCoach(); hideCountdown(); gatePanel.cancel(); document.documentElement.classList.remove('math'); }
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

  // ---------- race lifecycle (SPEC v1.1) ----------
  // AI skill: left to the engine (its default sits between the player's upgrade level and the track's design level, so
  // a stock Ranger can win Pine Ridge with clean riding and later tracks want upgrades: SPEC v1.1 §2)
  const playerName = () => { const p = Profiles.playerById(family, currentPlayerId); return p ? p.name : 'You'; };
  function startRide(trailId) {
    if (!game) { toast('The race could not load'); return; }
    closePanel();
    const trail = trails.find((t) => t.id === trailId && isUnlocked(save, trails, t.id)) || currentTrail(save, trails);
    clearTimeout(stopFallback);
    run = { trail, ended: false, quitting: false, place: null, lastState: null, started: false, posBannerAt: 0, cdTimer: 0,
      gates: facts ? facts.opts.gates : 4, facts: [], xp: 0, mastered: [], fluent: [], missionPaid: 0, levelBefore: facts ? levelFor(facts.xp) : 1 };
    save.selectedTrail = trail.id;
    go('ride');
    hud.reset(trail, paintColor(save.paint));
    refreshFactsHud();
    hideCountdown();
    controls.reset();
    controls.enable(true);
    paused = false;
    try {
      game.start({
        trail, stats: statsFor(save), seed: hashString('trail:' + trail.id), paint: save.paint, decal: save.decal,
        bestDistance: save.best[trail.id] || null, bestTime: save.bestTime[trail.id] || null,
        gates: facts ? facts.opts.gates : 4,           // Math Gates (Parents → Options: 3 / 4 / 6)
        race: { riders: 3, name: playerName() },
        shake: settings.reducedMotion ? 0 : settings.shake / 100,
      });
      game.setInput({ gas: false, brake: false, boost: false });
    } catch (e) {
      console.error('[TrailBlazer] game.start threw', e);
      run = null; controls.enable(false); go('trails'); toast('Could not start the race');
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
    try { s = game.getState(); } catch (_) { /* engine between races */ }
    if (!s) return;
    run.lastState = s;
    hud.update(s);
    if (s.place >= 1 && run.place == null) run.place = s.place;
    if (!paused) {
      Audio.engine(s.phase === 'done' ? -1 : Math.min(1, (s.speedKmh || 0) / 120));
      Audio.nitro(!!(input.boost && s.boost > 0.01 && s.phase === 'ride'));
    }
  }

  // ---------- countdown + gate drop ----------
  const cdEl = $('#countdown'), cdN = $('#countdown-n'), cdGate = $('#cd-gate');
  function showCount(text, go) {
    clearTimeout(run && run.cdTimer);
    cdEl.hidden = false;
    cdN.textContent = text;
    cdN.classList.toggle('go', !!go);
    cdN.classList.remove('tick'); void cdN.offsetWidth; cdN.classList.add('tick');
    cdGate.classList.toggle('drop', !!go);
    if (go && run) run.cdTimer = setTimeout(hideCountdown, 800);
  }
  function hideCountdown() { cdEl.hidden = true; cdGate.classList.remove('drop'); }

  // banners: one at a time, position changes at most every 1.2 s (and never during the countdown)
  function positionChanged(place) {
    const r = run;
    if (!r || !(place >= 1)) return;
    const prev = r.place;
    r.place = place;
    if (prev == null || prev === place) return;
    hud.bumpPlace();
    if (!r.started || r.lastState && r.lastState.finishCrossed) return;
    const now = performance.now();
    if (now - r.posBannerAt < 1200) return;
    if (!hud.banner('pos', place === 1 ? "You're in the lead!" : `You're ${ordinal(place)}!`, 1100, { low: true })) return;
    r.posBannerAt = now;
    if (place < prev) Audio.coin();
  }

  function onEvent(evt) {
    if (!run || !evt) return;
    switch (evt.type) {
      case 'countdown': showCount(String(evt.n), false); Sfx.beep(false); break;
      case 'go': run.started = true; showCount('GO!', true); Sfx.beep(true); Sfx.gateDrop(); Audio.whoosh(); if (evt.bogged) bogged(); break;
      case 'bogged': bogged(); break;
      case 'launch': if (!run.started) { run.started = true; Audio.whoosh(); } break;
      // the engine draws BACKFLIP! / BIG AIR! / PERFECT! / CRASH! in the world itself; the HUD only adds sound and
      // the things the engine does not say (a double / triple flip, the respawn, position changes)
      case 'flip': {
        Audio.flip();
        const n = Math.max(1, Number(evt.count) || 1);
        if (n >= 2) hud.banner('flip', n >= 3 ? 'Triple flip!' : 'Double flip!', 1000);
        break;
      }
      case 'bigAir': Audio.whoosh(); break;
      case 'land':
        Audio.land(evt.quality === 'hard' ? 'rough' : evt.quality);
        if (evt.quality === 'perfect') setTimeout(() => Audio.cheer(0.6), 120);
        break;
      case 'crash': Audio.smash(); Audio.oops(); break;
      case 'respawn': hud.banner('small', 'Back on track!', 1000); Audio.whoosh(); break;
      case 'position': positionChanged(evt.place); break;
      case 'smash': Audio.smash(); setTimeout(() => Audio.coin(), 60); break;
      case 'coin': Audio.coin(); break;
      case 'splash': Sfx.splash(); break;
      case 'gate': askGate(evt).catch((e) => { console.error('[TrailBlazer] gate failed', e); try { game.openGate({ correct: true }); } catch (_) { /* ignore */ } }); break;
      case 'gateOpen': Sfx.creak(); break;
      case 'finishLine': {
        if (evt.place >= 1) run.place = evt.place;
        Audio.cheer(1.4); Audio.fireworks(); Sfx.cowbell();
        break;
      }
      case 'finish': endRide(evt.summary); break;
      default: break;
    }
  }

  // ---------- Math Gates: the race is frozen while the Gate panel asks one fact ----------
  async function askGate(evt) {
    const r = run;
    if (!r || r.ended || gatePanel.isOpen) return;
    if (!facts) { game.openGate({ correct: true }); return; }
    controls.reset(); controls.enable(false);
    input = { gas: false, brake: false, boost: false };
    try { game.setInput(input); } catch (_) { /* ignore */ }
    Audio.engine(-1); Audio.nitro(false);
    document.documentElement.classList.add('math');
    const pick = nextFact(facts, Date.now(), session) || { fact: '7x8', flip: false, isNew: false };
    const index = Number.isInteger(evt.index) ? evt.index : r.facts.length;
    const res = await gatePanel.open({ fact: pick.fact, flip: pick.flip, index, total: r.gates });
    if (res.cancelled || run !== r || r.ended) return;
    const out = recordAnswer(facts, pick.fact, res, Date.now(), session);
    r.facts.push({ fact: pick.fact, flip: pick.flip, correct: !!res.correct, quick: !!res.quick, fixed: !!res.fixed, ms: res.ms, status: out.status, newlyMastered: out.newlyMastered });
    r.xp += out.xp;
    if (out.newlyMastered) r.mastered.push(pick.fact);
    if (out.newlyFluent) r.fluent.push(pick.fact);
    if (out.missionJustDone) {
      r.missionPaid = earn(save, MISSION_REWARD);
      setTimeout(() => { if (run === r) { hud.banner('mission', `Mission complete! +$${MISSION_REWARD}`, 1500); Audio.missionComplete(); } }, 300);
    }
    app.persistFacts(); app.persist();
    refreshFactsHud();
    document.documentElement.classList.remove('math');
    controls.enable(!paused);
    try { game.openGate({ correct: !!res.correct, quick: !!res.quick, fixed: !!res.fixed }); } catch (e) { console.error('[TrailBlazer] openGate threw', e); }
  }

  function bogged() { if (run && !run.boggedShown) { run.boggedShown = true; hud.banner('small', 'Too early! Bogged start', 1200); Audio.oops(true); } }

  // the final order for the podium: the engine's summary.riders when every rider has a place; else the player at
  // summary.place and the AI riders around them by how far along the track they were at the end
  function standings(r, summary) {
    const p = Profiles.playerById(family, currentPlayerId);
    const meRow = { name: p ? p.name : 'You', paint: save.paint, color: p ? p.color : null, me: true };
    const list = Array.isArray(summary.riders) && summary.riders.length ? summary.riders : null;
    if (list && list.some((x) => x.me) && list.every((x) => x.place >= 1) && summary.finishCrossed) {
      return list.slice().sort((a, b) => a.place - b.place).map((x) => (x.me ? { ...meRow, place: x.place } : { name: x.name, paint: x.paint, place: x.place }));
    }
    const ai = ((r.lastState && r.lastState.riders) || []).filter((x) => !x.me).sort((a, b) => (b.x || 0) - (a.x || 0));
    const total = ai.length + 1;
    const myPlace = summary.finishCrossed && summary.place >= 1 ? Math.min(total, summary.place) : total;
    const out = [];
    for (let place = 1, k = 0; place <= total; place++) out.push(place === myPlace ? { ...meRow, place } : { name: ai[k].name, paint: ai[k++].paint, place });
    return out;
  }

  function endRide(summary) {
    if (!run || run.ended) return;
    const r = run;
    r.ended = true;
    run = null;
    clearTimeout(stopFallback); clearTimeout(r.cdTimer);
    controls.enable(false);
    hideCoach(); hideCountdown();
    gatePanel.cancel(); document.documentElement.classList.remove('math');
    Audio.engine(-1); Audio.nitro(false);
    summary = summary && typeof summary === 'object' ? summary : {};
    const { rows, total } = cashRows(summary.cash);
    const medalTimes = medalTimesFor(r.trail, medalTable);
    const bank = bankRide(save, trails, r.trail.id, summary, medalTimes);
    save.seen.coach = true;
    app.persist();
    if (facts && r.facts.length) {
      noteRace(facts, { at: Date.now(), trail: r.trail.id, place: bank.place, asked: r.facts.length, correct: r.facts.filter((f) => f.correct).length,
        quick: r.facts.filter((f) => f.quick).length, fixed: r.facts.filter((f) => f.fixed).length });
      app.persistFacts();
    }
    const math = facts ? { facts: r.facts, xp: r.xp, mastered: r.mastered, fluent: r.fluent, missionPaid: r.missionPaid, mission: missionState(facts, Date.now()),
      levelBefore: r.levelBefore, levelAfter: levelFor(facts.xp) } : null;
    const nt = nextTrail(trails, r.trail.id);
    const result = lastResult = {
      trail: r.trail, summary, rows, total, bank, medalTimes, standings: standings(r, summary),
      place: bank.place, timeSec: summary.timeSec || 0, math,
      next: nt && isUnlocked(save, trails, nt.id) ? nt : null,
      unlocked: bank.unlocked ? trails.find((t) => t.id === bank.unlocked) : null,
    };
    const wasPaused = paused;
    paused = false;
    setTimeout(() => {
      go('results', result);
      if (bank.earned) Audio.cash();
      if (bank.place === 1 || bank.newMedal || bank.unlocked || bank.paints.length || bank.decals.length) setTimeout(() => Audio.fanfare(), 400);
      if (math && math.mastered.length) setTimeout(() => Audio.trophy(), 900);
    }, wasPaused ? 0 : 900);
  }

  // ---------- pause (sound, music, motion, shake, end ride) ----------
  function pause() {
    if (!run || paused || coaching || gatePanel.isOpen) return;    // the race is frozen at the gate anyway
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
      endRide({ distance: s.distance || 0, airTime: 0, flips: s.flips || 0, smashed: s.smashed || 0, maxSpeedKmh: s.speedKmh || 0, finishCrossed: false,
        timeSec: s.timeSec || 0, place: null, cash: { distance: c, air: 0, flips: 0, perfect: 0, coins: 0, total: c }, winches: 0 });
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
    if (document.hidden) { pause(); tts.cancel(); Audio.suspend(); Sfx.suspend(); app.persist(); app.persistFacts(); setHero(false); } else { Audio.resume(); Sfx.resume(); setHero(screen === 'title'); }
  });
  window.addEventListener('pagehide', () => { pause(); tts.cancel(); app.persist(); app.persistFacts(); });
  window.addEventListener('keydown', (e) => {
    if (coaching && (e.code === 'Enter' || e.code === 'Space')) { dismissCoach(e); return; }
    if (e.code === 'Escape' || (e.code === 'KeyP' && run)) {
      if (coaching) { dismissCoach(e); return; }
      if (pz.isOpen) { pz.close(); return; }
      if (run && !gatePanel.isOpen) { paused ? resume() : pause(); e.preventDefault(); }
    }
  });

  // ---------- navigation wiring ----------
  $('#btn-ride').addEventListener('click', () => go('trails'));
  $('#btn-garage').addEventListener('click', () => go('garage'));
  $('#btn-grid').addEventListener('click', () => go('grid'));
  $('#btn-parents').addEventListener('click', () => pz.open({ tab: 'sync' }));
  $('#btn-player').addEventListener('click', () => go('players'));
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) Audio.click(); });

  // ---------- audio unlock (first gesture anywhere) ----------
  Audio.setSound(settings.sound); Audio.music(settings.music); Sfx.setSound(settings.sound);
  // iOS: the first speak() must happen inside a tap; the first GAS / countdown tap (or any tap) unlocks the voice
  const unlock = () => { Audio.unlock(); Sfx.unlock(); tts.unlock(); Audio.setSound(settings.sound); if (!settings.music) Audio.music(false); };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  // ---------- iOS gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.pz input, .pz textarea, .pz pre')) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .garage-body, .trails-body, .results-body, .style-strip, .grid-scroll, .pz input, .pz textarea')) e.preventDefault();
  }, { passive: false });

  go('players');
  updateHooks.isSafe = () => safeToReload({ screen, running: !!run, parentZone: pz.isOpen }) && !coaching && !gatePanel.isOpen;
  updateHooks.notify = () => {
    const t = h('div', { class: 'toast update-note', id: 'update-note', role: 'status' }, UPDATE_NOTICE);
    $('#app').append(t);
    setTimeout(() => t.remove(), 4000);
  };
  updateHooks.beforeReload = () => {
    app.persist(); app.persistFacts();
    try { if (currentPlayerId && screen !== 'players') sessionStorage.setItem(RESUME_KEY, currentPlayerId); } catch (_) { /* ignore */ }
  };
  let resumeId = null;
  try { resumeId = sessionStorage.getItem(RESUME_KEY); sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
  if (resumeId && Profiles.playerById(family, resumeId)) selectPlayer(resumeId);
  sync.start();                       // first pull after the picker is on screen (never blocks it)
  window.__trailBlazer = {
    app, hud, pz, sync, controls, gatePanel, tts, get facts() { return facts; }, get session() { return session; },
    get game() { return game; }, get run() { return run; }, get lastResult() { return lastResult; }, get coaching() { return coaching; },
    get screen() { return screen; }, get paused() { return paused; },
    // the open Math Gate, for playtests that answer the real engine's gates: { open, fact, answer, state, flip, index }
    // (fact / answer null while no gate is open; state 'ask' | 'right' | 'bad' | 'show' | 'copy' | 'fixed' | null)
    get gate() {
      const open = gatePanel.isOpen;
      return { open, fact: open ? gatePanel.fact : null, answer: open ? gatePanel.answer : null, state: open ? gatePanel.state : null,
        flip: open ? gatePanel.flip : false, index: run && run.facts ? run.facts.length : 0 };
    },
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
