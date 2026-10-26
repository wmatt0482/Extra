// Fraction Fright bootstrap: the family (Spell Jump's players, PIN and family code through profiles.js), family sync
// (the save and the fraction skills registered as the 'ff' and 'fracs' kinds), the save, audio and the voice, the
// engine (real or mock), the screens and the wave lifecycle. SPEC.md is the design; §0 holds the rules nothing here
// may break: the aim point alone decides a hit, the true spot is shown after every throw, 0 / ½ / 1 stay labelled,
// the Zombie Lab comes before the first street, accuracy (never speed) is scored and adapted on, big effects only on
// success, no progress meters or timers, no streak, the number line (not pies) is the picture.
// The real engine lives at ./game/engine.js (the engine agent's, SPEC §3); it is imported dynamically so the shell keeps
// working on the mock engine (./meta/mockEngine.js) if it is missing or broken (?mock=1 forces the mock).
// The app owns the math: it builds each wave's items (src/skills/items.js), maps the finger on the road to setAim()
// (getState().roadPx), speaks the called fraction ('target'), records every 'throw' event in the skills store
// (src/skills/store.js), plays the engine's 'sound' events (src/sfx.js), and computes the cash rows from the throws
// (src/meta/economy.js), so the rows always add up whatever the engine shows. The zombie's lane is deliberately not its
// fraction: slime on the called spot fires a goo bolt that cures the called zombie wherever it stands.

import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { createPinger } from '../../spell-jump/src/meta/pings.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { $, $$, h, money } from '../../spell-jump/src/ui/dom.js';
import { COIN, hydrateIcons, icon } from '../../spell-jump/src/ui/icons.js';
import { tts } from '../../spell-jump/src/spelling/tts.js';
import { createCloudVoice } from '../../spell-jump/src/spelling/cloudVoice.js';
import { Sfx } from './sfx.js';
import { registerFractionFrightSync } from './skills/sync.js';
import {
  defaultSave, loadSave, loadSettings, loadSkills, removeSave, removeSkills, writeSave, writeSettings, writeSkills,
} from './meta/save.js';
import { accuracyOf, bankWave, nextWaveOf, waveCash } from './meta/economy.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { STREET_BY_ID } from './data/streets.js';
import { itemOf } from './data/looks.js';
import { buildWave, hashString, isHit, rngFrom, roadFor, sayTexts, tierOfDen, toleranceFor } from './skills/items.js';
import { isUnlocked, moreDenominators, reviewTierOf, tierState } from './skills/ladder.js';
import { finishLab, levelFor, noteWave, recordThrow, resetSkills } from './skills/store.js';
import { createPlayers, drawAvatar } from './ui/players.js';
import { drawYard, tallySvg } from './ui/title.js';
import { createLab } from './ui/lab.js';
import { createStreets } from './ui/streets.js';
import { createHud } from './ui/hud.js';
import { createResults } from './ui/results.js';
import { createYard } from './ui/yard.js';
import { createParentZone } from './ui/parentZone.js';

const VERSION = '1.0.0';
const GAME = 'fraction-fright';
const params = new URLSearchParams(location.search);
const RESUME_KEY = 'fractionFright.resumePlayer';   // sessionStorage: the player to come back to after an update reload
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
  window.__fractionFrightUpdate = updater;   // tells the index.html safety net that this module loaded
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
    console.warn('[FractionFright] Real engine (src/game/engine.js) failed to load: using the MOCK engine.', e);
    const m = await import('./meta/mockEngine.js');
    return { createGame: m.createGame, name: 'mock engine (fallback)' };
  }
}

async function boot() {
  hydrateIcons();
  const settings = loadSettings();
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  registerFractionFrightSync();          // <id>.ff and <id>.fracs, before the client exists
  // the family record and the current player's save / skills are in use during a wave and the Lab
  const inUse = (k) => k === 'family' || (currentPlayerId && (k === `${currentPlayerId}.ff` || k === `${currentPlayerId}.fracs`));
  const sync = createSyncClient({
    canApply: (k) => (inUse(k) ? !run && screen !== 'lab' : true),
    onApply: (k) => syncApplied(k),
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); },
  });
  // the anonymous lights-on counter (Spell Jump's src/meta/pings.js): 'day' / 'wave' / 'lab', no names or ids
  const pingNow = createPinger(GAME, { version: VERSION, getCode: () => sync.code });
  const family = Profiles.loadFamily();
  const save = defaultSave();             // replaced in place when a player is picked (screens hold this reference)
  let currentPlayerId = null;
  let skills = loadSkills(null);          // the current player's fraction skills (src/skills/store.js)
  const skillsCache = new Map();          // other players' skills while the Parent Zone shows them
  const canvas = $('#game');
  const engineMod = await loadEngine();
  let game = null, run = null, hudRaf = 0, screen = 'players', paused = false, coaching = false, lastResult = null;
  const toastsEl = $('#toasts');

  const app = {
    save, settings, sync,
    audio: Audio, sfx: Sfx, tts, icon,
    version: VERSION,
    ping: pingNow,
    engineName: engineMod.name,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get skills() { return skills; },
    get screen() { return screen; },
    persist: () => writeSave(currentPlayerId, save),
    persistSkills: () => { if (currentPlayerId && skills) writeSkills(currentPlayerId, skills); },
    // ----- any player's data (picker, Parent Zone) -----
    skillsFor(id) {
      if (id === currentPlayerId) return skills;
      if (!skillsCache.has(id)) skillsCache.set(id, loadSkills(id));
      return skillsCache.get(id);
    },
    saveSkillsFor(id, d) { writeSkills(id, d); if (id === currentPlayerId) skills = d; else skillsCache.set(id, d); },
    resetSkillsFor(id) { const d = app.skillsFor(id); resetSkills(d, Date.now()); app.saveSkillsFor(id, d); },
    saveOf: (id) => (id === currentPlayerId ? save : loadSave(id)),
    curesFor: (id) => app.saveOf(id).cures,
    levelFor: (id) => levelFor(app.skillsFor(id).xp),
    resetSaveFor(id) {
      const fresh = defaultSave();
      fresh.seen.coach = true;
      fresh.resetAt = Date.now();             // a stamped fresh save, so the reset wins the sync merge everywhere
      writeSave(id, fresh);
      if (id === currentPlayerId) { replaceInPlace(save, loadSave(id)); refreshCash(); }
    },
    removePlayer(id) {
      Profiles.removePlayer(family, id);      // tombstoned in the family record: removed on every device, every game
      removeSave(id); removeSkills(id); skillsCache.delete(id);
      if (id === currentPlayerId) { currentPlayerId = null; skills = loadSkills(null); replaceInPlace(save, defaultSave()); }
    },
    createPlayer: (name, color) => Profiles.createPlayer(family, name, color),
    openParents: (opts) => pz.open(opts),
    voiceInfo(id) {
      const o = Profiles.playerOptions(family, id);
      return { rate: o.rate, voiceName: o.voiceName || '', cloudVoice: o.cloudVoice || '', synced: !!sync.code, available: tts.available };
    },
    /** Read a line aloud (fractions aloud on, a voice available). */
    say(text) { if (!skills || !skills.opts.aloud || !tts.available || !text) return; try { tts.cancel(); tts.say(text); } catch (_) { /* ignore */ } },
    gooColor: () => (itemOf('goo', save.yard.goo) || itemOf('goo', 'lime')).color,
    reducedMotion: () => !!settings.reducedMotion,
    go, toast, refreshCash, selectPlayer, setSetting, startWave,
    // ----- the Zombie Lab -----
    labDone: () => !!(skills && skills.lab.done),
    recordLabThrow({ n, d, pae, result }) {
      if (!currentPlayerId) return;
      recordThrow(skills, { tier: tierOfDen(d), kind: 'locate', show: `${n}/${d}`, pae, result, at: Date.now() });
      app.persistSkills();
    },
    finishLab() {
      const r = finishLab(skills, Date.now());
      app.persistSkills();
      pingNow('lab');
      return r;
    },
    labExit(opts = {}) { go(opts.toStreets && app.labDone() ? 'streets' : 'title'); },
    runLabFor(id) {
      if (!Profiles.playerById(family, id)) return;
      pz.close();
      if (id !== currentPlayerId) selectPlayer(id);
      setTimeout(() => go('lab'), 0);
    },
    onFamilyChanged() { if (screen === 'title') refreshTitle(); },
    onParentZoneClosed() {
      skillsCache.clear();
      if (currentPlayerId) applyVoice();
      if (!currentPlayerId || screen === 'players') go('players');
      else if (screen === 'title') refreshTitle();
      setTimeout(() => updater.check(), 0);
    },
  };

  // ---------- engine ----------
  function makeGame() {
    try { game = engineMod.createGame(canvas, { onEvent, reducedMotion: settings.reducedMotion }); } catch (e) { console.error('[FractionFright] createGame threw', e); game = null; }
  }
  makeGame();
  if (!game && engineMod.name === '') {
    console.warn('[FractionFright] Real engine threw on create: using the MOCK engine.');
    const m = await import('./meta/mockEngine.js');
    engineMod.createGame = m.createGame; engineMod.name = app.engineName = 'mock engine (fallback)';
    makeGame();
  }

  // ---------- UI ----------
  const playersUI = createPlayers(app);
  const hud = createHud();
  const lab = createLab(app);
  const results = createResults(app);
  const screens = { players: playersUI.players, newplayer: playersUI.newplayer, lab, streets: createStreets(app), results, yard: createYard(app) };
  // the voice: Spell Jump's tts, with the natural voice when the family has a code and the player picked one in Spell
  // Jump; the fractions are a finite set, so their clips are prepared once (SPEC §9)
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => [], audio: Audio });
  tts.setCloud(cloud);
  tts.setOnSpeaking((on) => Audio.voice(on));
  function applyVoice() {
    if (!currentPlayerId) return;
    const o = Profiles.playerOptions(family, currentPlayerId);
    tts.setRate(o.rate);
    tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
    cloud.setVoice(o.cloudVoice || '');
    if (cloud.active) cloud.prepare(sayTexts()).catch(() => {});
  }
  const pz = createParentZone(app);

  function refreshCash() {
    const html = `${COIN}<span>${money(save.cash)}</span>`;
    for (const el of $$('[data-cash]')) el.innerHTML = html;
  }
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };

  // ---------- players ----------
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    currentPlayerId = id;
    replaceInPlace(save, loadSave(id));
    skills = loadSkills(id);
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    app.persist();
    app.persistSkills();
    applyVoice();
    go('title');
  }
  function refreshTitle() {
    const p = Profiles.playerById(family, currentPlayerId);
    if (!p) return;
    $('#title-player').textContent = p.name;
    drawAvatar($('#title-avatar'), p.color);
    $('#title-lv').textContent = `Lv ${levelFor(skills.xp)}`;
    $('#title-cures-n').textContent = money(save.cures);
    $('#title-tally').innerHTML = tallySvg(save.cures);
    const labDone = app.labDone();
    $('#title-lab-note').hidden = labDone;
    const b = $('#btn-streets');
    b.dataset.lab = String(!labDone);
    b.firstChild.textContent = labDone ? 'Defend the fence' : 'Zombie Lab';
  }
  function drawBackdrop() { drawYard($('#yard-scene'), currentPlayerId ? save : defaultSave()); }

  // Ghost-click guard (same as the other games): swallow a click that lands just after a screen change when its
  // pointerdown came before the change
  let lastGo = 0, lastDown = 0;
  document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, true);
  document.addEventListener('click', (e) => { const t = performance.now(); if (lastDown < lastGo && t - lastGo < 500) { e.preventDefault(); e.stopPropagation(); } }, true);

  function go(name, arg) {
    lastGo = performance.now();
    closePanel();
    if (name !== 'wave' && run && !run.ended) stopWave();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    const inWave = name === 'wave';
    document.documentElement.classList.toggle('in-wave', inWave);
    if (inWave || name === 'results') toastsEl.replaceChildren();
    $('#hud').hidden = !inWave;
    $('#backdrop').hidden = inWave || name === 'results' || name === 'lab';
    if (!inWave) { hud.clearBanner(); hideCoach(); }
    if (!inWave && name !== 'results' && name !== 'lab') drawBackdrop();
    if (name === 'title') refreshTitle();
    if (screens[name]) screens[name].show(arg);
    refreshCash();
    setTimeout(() => updater.check(), 0);
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
    }
    renderPauseToggles();
  }

  // ---------- family sync: newer data from another device ----------
  function syncApplied(k) {
    const m = /^([a-z0-9_-]{1,32})\.(ff|fracs)$/.exec(k);
    if (m) {
      const [, id, kind] = m;
      if (kind === 'fracs') skillsCache.delete(id);
      if (id === currentPlayerId) {
        if (kind === 'ff') replaceInPlace(save, loadSave(id)); else skills = loadSkills(id);
        refreshCash();
        if (screen === 'title') { refreshTitle(); drawBackdrop(); } else if (['streets', 'yard'].includes(screen)) screens[screen].show();
      } else if (screen === 'players') screens.players.show();
      pz.onSyncApplied();
      return;
    }
    if (k !== 'family') return;               // the other games' keys: nothing in memory here
    replaceInPlace(family, Profiles.loadFamily());
    if (currentPlayerId && !Profiles.playerById(family, currentPlayerId)) {
      currentPlayerId = null; replaceInPlace(save, defaultSave());
      if (!pz.isOpen) go('players');
    } else if (screen === 'players') screens.players.show();
    else if (screen === 'title') refreshTitle();
    pz.onSyncApplied();
  }

  // ---------- the wave ----------
  /** Start the street's next wave (the Lab first, once). */
  function startWave(streetId) {
    if (!game) { toast('The street could not load'); return; }
    if (!app.labDone()) { go('lab'); return; }
    const street = STREET_BY_ID[streetId];
    if (!street || !street.playable || !isUnlocked(skills, street.tier)) { go('streets'); return; }
    const tier = street.tier;
    const number = nextWaveOf(save, streetId);
    const state = tierState(skills, tier);
    const rv = reviewTierOf(tier);
    const seed = hashString(`${currentPlayerId}:${streetId}:${save.waves}:${number}`);
    const w = buildWave({ tier, number, state, reviewTier: rv, reviewState: rv ? tierState(skills, rv) : 'secure', more: moreDenominators(skills, tier), rng: rngFrom(seed) });
    const goo = itemOf('goo', save.yard.goo), fence = itemOf('fence', save.yard.fence);
    run = { street: streetId, streetName: street.name, tier, number, big: w.big, final: w.final, items: w.items, byId: new Map(w.items.map((it) => [it.id, it])),
      throws: [], targetId: null, ended: false, cured: 0, reached: 0, curedIds: new Set(), reachedIds: new Set(), opened: [], at: Date.now() };
    go('wave');
    hud.reset(street.name, number, { big: w.big, final: w.final });
    paused = false;
    try {
      game.start({
        road: roadFor(tier),
        wave: { street: { id: streetId, name: street.name, weather: street.look.weather }, number, zombies: w.items, big: w.big, final: w.final },
        look: { goo: goo.color, fence: fence.id, fenceColor: fence.color, pumpkins: Math.max(3, Math.min(12, 3 + save.pumpkins)), sky: street.sky, landmark: street.look.landmark, hats: street.look.hats },
        stats: { radius: toleranceFor(state), power: 1 },
        seed,
      });
    } catch (e) {
      console.error('[FractionFright] game.start threw', e);
      run = null; go('streets'); toast('Could not start the wave');
      return;
    }
    cancelAnimationFrame(hudRaf);
    hudRaf = requestAnimationFrame(hudLoop);
    if (!save.seen.coach) showCoach();
  }
  function setTarget(item) {
    if (!run || !item || item.id === run.targetId) return;
    run.targetId = item.id;
    hud.setTarget(item);
    app.say(`${item.say}.`);
  }
  function hudLoop() {
    if (!run || run.ended) return;
    hudRaf = requestAnimationFrame(hudLoop);
    let s = null;
    try { s = game.getState(); } catch (_) { /* between waves */ }
    if (!s) return;
    run.state = s;
    if (s.target) setTarget(s.target);
  }

  // the finger on the road: drag to aim (setAim), let go to throw
  const stage = $('#stage');
  let aiming = false;
  const canAim = () => run && !run.ended && !paused && !coaching && screen === 'wave';
  function x01Of(e) {
    const r = canvas.getBoundingClientRect();
    const s = (run && run.state) || {};
    const rp = s.roadPx && s.roadPx.right > s.roadPx.left ? s.roadPx : { left: r.width * 0.08, right: r.width * 0.92 };
    return Math.max(0, Math.min(1, (e.clientX - r.left - rp.left) / (rp.right - rp.left)));
  }
  stage.addEventListener('pointerdown', (e) => {
    if (!canAim()) return;
    aiming = true;
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    try { game.setAim(x01Of(e)); } catch (_) { /* ignore */ }
  });
  stage.addEventListener('pointermove', (e) => { if (aiming && canAim()) try { game.setAim(x01Of(e)); } catch (_) { /* ignore */ } });
  stage.addEventListener('pointerup', (e) => {
    if (!aiming) return;
    aiming = false;
    if (!canAim()) return;
    try { game.setAim(x01Of(e)); throwNow(); } catch (err) { console.error(err); }
  });
  stage.addEventListener('pointercancel', () => { aiming = false; });
  function throwNow() {
    let ok = false;
    try { ok = game.throw() !== false; } catch (e) { console.error('[FractionFright] throw failed', e); }
    if (ok) hud.hideHelp();
    return ok;
  }

  function onEvent(evt) {
    if (!evt || !run || run.ended) return;
    switch (evt.type) {
      case 'target': setTarget(evt.item); break;
      case 'throw': onThrow(evt); break;
      case 'sound': Sfx.play(evt.name, evt.vol); break;
      case 'cured': run.cured++; if (evt.item) run.curedIds.add(evt.item.id); break;
      case 'reached': run.reached++; if (evt.item) run.reachedIds.add(evt.item.id); break;
      // the engine draws 'BIG WAVE!' / 'FINAL WAVE!' in the world itself (and plays their sound)
      case 'waveEnd': endWave(evt); break;
      default: break;
    }
  }
  function onThrow(evt) {
    // the engine's item copy has no tier: the app's own item (by id) knows the tier and the kind
    const item = { ...(evt.item || {}), ...(run.byId.get(evt.item && evt.item.id) || {}) };
    const pae = Number.isFinite(evt.pae) ? evt.pae : 100;
    const result = ['bull', 'hit', 'near', 'miss'].includes(evt.result) ? evt.result : 'miss';
    run.throws.push({ item: { id: item.id, show: item.show, say: item.say }, result, pae });
    const out = recordThrow(skills, { tier: item.tier || run.tier, kind: item.kind || 'locate', show: item.show, pae, result, at: Date.now() });
    run.opened.push(...out.opened);
    app.persistSkills();
  }
  function endWave(summary) {
    const r = run;
    if (!r || r.ended) return;
    r.ended = true;
    cancelAnimationFrame(hudRaf);
    const stopped = !!(summary && summary.stopped);
    const cash = waveCash(r.throws, { final: r.final && !stopped });
    const at = Date.now();
    const bank = bankWave(save, { street: r.street, number: r.number, cash: cash.total, cured: cash.cured, bulls: cash.bulls, reached: r.reached, throws: r.throws.length, final: r.final, stopped, at });
    if (!save.seen.coach) save.seen.coach = true;
    noteWave(skills, { at, street: r.street, number: r.number, cured: cash.cured, reached: r.reached, throws: r.throws.length, hits: r.throws.filter((t) => isHit(t.result)).length,
      bulls: cash.bulls, pae: r.throws.length ? r.throws.reduce((a, t) => a + t.pae, 0) / r.throws.length : 0, stopped });
    app.persist(); app.persistSkills();
    pingNow('wave');
    // what happened to each zombie: cured (the engine's 'cured' events; a hit after its zombie took a pumpkin cures the
    // next one in line) / reached the fence / still out (stopped early); the best throw at it, for the chip
    const by = new Map();
    for (const t of r.throws) { const x = by.get(t.item.id); if (!x || (isHit(t.result) && !isHit(x)) || (t.result === 'bull')) by.set(t.item.id, t.result); }
    const items = r.items.map((it) => {
      const best = by.get(it.id) || null;
      const outcome = r.curedIds.has(it.id) || (best && isHit(best) && !r.reachedIds.has(it.id)) ? 'cured' : r.reachedIds.has(it.id) ? 'reached' : 'out';
      return { id: it.id, show: it.show, say: it.say, result: outcome === 'cured' && best && isHit(best) ? best : outcome === 'cured' ? 'hit' : null, outcome };
    }).filter((x) => x.outcome !== 'out' || by.has(x.id));
    const result = lastResult = { street: r.street, streetName: r.streetName, number: r.number, stopped, cleared: bank.cleared, cash, bank, accuracy: accuracyOf(r.throws), items, opened: r.opened, throws: r.throws.length };
    run = null;
    setTimeout(() => {
      go('results', result);
      if (cash.total) Audio.cash();
      if (bank.cleared || bank.neighboursAfter > bank.neighboursBefore) setTimeout(() => Audio.fanfare(), 400);
      for (const t of result.opened) toast(`${(Object.values(STREET_BY_ID).find((s) => s.tier === t) || {}).name} is open!`);
    }, stopped ? 0 : 700);
  }
  /** Stop the wave: the engine sends waveEnd { stopped: true } (or, if it does not, the app ends it from what it has). */
  function stopWave() {
    if (!run || run.ended) return;
    const r = run;
    try { game.resume(); game.stop(); } catch (e) { console.error(e); }
    setTimeout(() => { if (run === r && !r.ended) endWave({ stopped: true }); }, 400);
  }

  // ---------- pause ----------
  function pause() {
    if (!run || run.ended || paused || coaching) return;
    paused = true;
    try { game.pause(); } catch (_) { /* ignore */ }
    renderPauseToggles();
    openPanel('pause');
  }
  function resume() {
    if (!run || !paused) return;
    paused = false;
    closePanel();
    try { game.resume(); } catch (_) { /* ignore */ }
  }
  function renderPauseToggles() {
    $('#pause-sound').textContent = `Sound: ${settings.sound ? 'On' : 'Off'}`;
    $('#pause-music').textContent = `Music: ${settings.music ? 'On' : 'Off'}`;
    $('#pause-motion').textContent = `Motion: ${settings.reducedMotion ? 'Calm' : 'Full'}`;
  }
  $('#btn-pause').addEventListener('click', pause);
  $('#pause-resume').addEventListener('click', resume);
  $('#pause-sound').addEventListener('click', () => setSetting('sound', !settings.sound));
  $('#pause-music').addEventListener('click', () => setSetting('music', !settings.music));
  $('#pause-motion').addEventListener('click', () => setSetting('reducedMotion', !settings.reducedMotion));
  $('#pause-stop').addEventListener('click', () => { closePanel(); paused = false; stopWave(); });
  $('#btn-say').addEventListener('click', () => { if (hud.target) app.say(`${hud.target.say}.`); });

  // ---------- first-wave coach ----------
  function showCoach() { coaching = true; try { game.pause(); } catch (_) { /* ignore */ } $('#coach').hidden = false; }
  function hideCoach() { if (!coaching) return; coaching = false; $('#coach').hidden = true; }
  function dismissCoach(e) {
    if (!coaching) return;
    if (e) e.preventDefault();
    hideCoach();
    save.seen.coach = true;
    app.persist();
    if (run && !paused) try { game.resume(); } catch (_) { /* ignore */ }
    if (hud.target) app.say(`${hud.target.say}.`);
  }
  $('#coach').addEventListener('pointerdown', dismissCoach);

  // ---------- keyboard: ← → aim, Space / Enter throw, Esc pause ----------
  window.addEventListener('keydown', (e) => {
    if (coaching && (e.code === 'Enter' || e.code === 'Space')) { dismissCoach(e); return; }
    if (e.code === 'Escape' || (e.code === 'KeyP' && run)) {
      if (coaching) { dismissCoach(e); return; }
      if (pz.isOpen) { pz.close(); return; }
      if (run) { paused ? resume() : pause(); e.preventDefault(); }
      return;
    }
    if (!canAim() || e.target.closest && e.target.closest('input, textarea')) return;
    const s = run.state || {};
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const step = (e.shiftKey ? 0.05 : 0.01) * (e.code === 'ArrowLeft' ? -1 : 1);
      try { game.setAim(Math.max(0, Math.min(1, (Number(s.aim) || 0.5) + step))); } catch (_) { /* ignore */ }
      e.preventDefault();
    } else if (e.code === 'Space' || e.code === 'Enter') { throwNow(); e.preventDefault(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); tts.cancel(); Audio.suspend(); Sfx.suspend(); app.persist(); app.persistSkills(); } else { Audio.resume(); Sfx.resume(); }
  });
  window.addEventListener('pagehide', () => { pause(); tts.cancel(); app.persist(); app.persistSkills(); });

  // ---------- navigation ----------
  $('#btn-streets').addEventListener('click', () => go(app.labDone() ? 'streets' : 'lab'));
  $('#btn-lab').addEventListener('click', () => go('lab'));
  $('#btn-yard').addEventListener('click', () => go('yard'));
  $('#btn-parents').addEventListener('click', () => pz.open({ tab: 'sync' }));
  $('#btn-player').addEventListener('click', () => go('players'));
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) Audio.click(); });

  // ---------- audio unlock (first gesture anywhere) ----------
  Audio.setSound(settings.sound); Audio.music(settings.music); Sfx.setSound(settings.sound);
  const unlock = () => { Audio.unlock(); Sfx.unlock(); tts.unlock(); Audio.setSound(settings.sound); if (!settings.music) Audio.music(false); };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  // ---------- iOS gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.pz input, .pz textarea, .pz pre')) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .streets-body, .yard-side, .results-body, .pz input, .pz textarea')) e.preventDefault();
  }, { passive: false });

  go('players');
  updateHooks.isSafe = () => safeToReload({ screen, running: !!run, parentZone: pz.isOpen }) && !coaching;
  updateHooks.notify = () => {
    const t = h('div', { class: 'toast update-note', id: 'update-note', role: 'status' }, UPDATE_NOTICE);
    $('#app').append(t);
    setTimeout(() => t.remove(), 4000);
  };
  updateHooks.beforeReload = () => {
    app.persist(); app.persistSkills();
    try { if (currentPlayerId && screen !== 'players') sessionStorage.setItem(RESUME_KEY, currentPlayerId); } catch (_) { /* ignore */ }
  };
  let resumeId = null;
  try { resumeId = sessionStorage.getItem(RESUME_KEY); sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
  if (resumeId && Profiles.playerById(family, resumeId)) selectPlayer(resumeId);
  sync.start();                        // first pull after the picker is on screen (never blocks it)
  pingNow('day');                      // once per device per UTC day (fire and forget)
  window.__fractionFright = {
    app, hud, pz, sync, lab, results, tts,
    get game() { return game; }, get run() { return run; }, get lastResult() { return lastResult; }, get screen() { return screen; },
    get skills() { return skills; }, get save() { return save; }, get paused() { return paused; }, get coaching() { return coaching; },
    throwAt(x01) { if (!canAim()) return false; try { game.setAim(x01); } catch (_) { return false; } return throwNow(); },
  }; // debugging / smoke tests
  registerSW();
}

function registerSW() {
  try {
    if (!swUsable) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      return navigator.serviceWorker.ready;
    }).then((reg) => {
      // hand the SW every same-origin file this page loaded (the engine's modules, the shared Spell Jump modules)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[FractionFright] service worker registration failed', e));
  } catch (e) {
    console.warn('[FractionFright] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[FractionFright] boot failed', e));
