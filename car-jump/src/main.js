// Spell Jump bootstrap: players, saves, audio + speech, engine (real or mock), screens, the spelling layer
// (spell panel before every run, Qualifier, Friday Test + Mega Run, daily mission) and the run lifecycle.
// The real engine lives at ./game/engine.js (built separately against the SPEC contract). It is imported
// dynamically so the shell keeps working — on the mock — if it is missing or broken.

import { resolveStats } from './data/upgrades.js';
import { Audio } from './audio.js';
import { defaultSave, loadSave, setSaveKey, wipeSave, writeSave } from './meta/save.js';
import { bankRun, earn, isUnlocked, nextTrackId, ratingFor, statsFor } from './meta/economy.js';
import { ACHIEVEMENTS, createAchievements } from './meta/achievements.js';
import { claimGoals, ensureGoals, goalEvent, goalSummary, goalText } from './meta/goals.js';
import { dailyFor, refreshDaily, todayKey } from './meta/daily.js';
import { hashString } from './meta/rng.js';
import {
  XP, addTrophy, addXp, checkChampion, completeDay, earnCrate, levelFor, levelProgress, lookFor, noteJump, refreshStreak, streakNow, unopened,
} from './meta/engagement.js';
import { tts } from './spelling/tts.js';
import { createCloudVoice } from './spelling/cloudVoice.js';
import { createSpellVoice, nextMissionEntries, orderTexts } from './spelling/spellVoice.js';
import { DEFAULT_CLOUD_VOICE } from './tts/voices.js';
import { createSpellPanel } from './spelling/spellPanel.js';
import { createTestScreen } from './spelling/testMode.js';
import { createSession } from './spelling/scheduler.js';
import { ringLetters } from './spelling/words.js';
import * as WS from './spelling/wordStore.js';
import { CLASS_CHECK_EVERY_MS, classCheckAllowed, classCheckWanted, hourlyCheckDue } from './spelling/classCheck.js';
import * as Profiles from './spelling/profiles.js';
import { $, $$, h, money } from './ui/dom.js';
import { COIN, hydrateIcons } from './ui/icons.js';
import { createControls } from './ui/controls.js';
import { createHud } from './ui/hud.js';
import { createGarage } from './ui/garage.js';
import { createTracks } from './ui/tracks.js';
import { createResults } from './ui/results.js';
import { createPanels } from './ui/panels.js';
import { createTitleHero } from './ui/titleHero.js';
import { createPlayers, drawAvatar } from './ui/players.js';
import { createParentZone } from './ui/parentZone.js';
import { bindMusicButton } from './ui/musicNote.js';
import { createCrateOpener } from './ui/crates.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { createSyncClient } from './sync/client.js';
import { applyImport, decodeTransfer, encodeTransfer } from './meta/transfer.js';
import { createPinger } from './meta/pings.js';
import { labBridge } from './meta/labBridge.js';
import { labLook, trailFor } from './meta/labLooks.js';
import { createTestBoss } from './ui/testBoss.js';
import { CEREMONY_LINES, improvement, qualifierFor, tierFor } from './ui/ceremony.js';
import { createSkyTeaser } from './ui/skyTeaser.js';
import { miniRoadSvg } from './ui/skyRoadSvg.js';
import { SKY_ROAD_STEPS, markTeaserSeen, skyName, skyRoadSteps, teaserDue, teaserTexts } from './meta/skyRoad.js';
import { carById, ceremonyRides, loadSkyData, skyAvailable, skyTracks, trackById } from './meta/skyData.js';
import { autoUnlock, ceremonyDue, currentEra, markCeremonySeen, setEra, skyTracksText, skyUnlocked, unlockSky } from './meta/sky.js';

const VERSION = '4.0.1';
const params = new URLSearchParams(location.search);
// v3.6 levels: cross a level's finish line and the car launches again (new word set, longer finish, more cash)
const LEVEL_FINISH = [1, 1.2, 1.4];     // finish line of level k as a multiple of the track's
const LEVEL_CASH = [1, 1.5, 2];         // cash multiplier of level k
const LEVEL_GAP_MS = 1600;              // the "Level 2!" moment before the car is back on the ramp
const levelTrack = (track, level) => (level > 1 ? { ...track, finish: Math.round((track.finish * LEVEL_FINISH[level - 1]) / 10) * 10 } : track);
const mockLevels = params.has('mock') && params.has('levels') ? Number(params.get('levels')) : null;   // tests only
const MISSION_REWARD = 500;
const QUALIFIER_PAY = 100;
const MEGA_PAY = 150;
const RESUME_KEY = 'spellJump.resumePlayer';   // sessionStorage: the player to come back to after an update reload
const swUsable = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw');

// ---------- self-update (see meta/selfUpdate.js) ----------
// Wired before boot so a new version can still take over if boot fails; boot() fills in the hooks.
const updateHooks = { isSafe: () => true, notify: () => {}, beforeReload: () => {} };
const updater = createUpdateGuard({
  hadController: swUsable && !!navigator.serviceWorker.controller,
  isSafe: () => updateHooks.isSafe(),
  notify: () => updateHooks.notify(),
  reload: () => { try { updateHooks.beforeReload(); } catch (_) { /* ignore */ } location.reload(); },
});
if (swUsable) {
  window.__spellJumpUpdate = updater;   // tells the index.html safety net that this module loaded
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
    console.warn('[SpellJump] Real engine (src/game/engine.js) failed to load — falling back to the MOCK engine.', e);
    const m = await import('./meta/mockEngine.js');
    return { createGame: m.createGame, name: 'mock engine (fallback)' };
  }
}

async function boot() {
  hydrateIcons();
  // family sync (off until a parent creates or joins a family): subscribes to local writes before anything is
  // written; the hooks below reload what is in memory when newer data arrives from another device
  const sync = createSyncClient({
    canApply: (k) => syncCanApply(k),
    onApply: (k) => syncApplied(k),
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); if (currentPlayerId && cloud) { if (cloud.active) pz.onCloudStatus(); else cloudDefault(currentPlayerId); } },
  });
  // v3.7.2: the anonymous lights-on counter (src/meta/pings.js): 'day' / 'run' / 'test' / 'list', no names or ids
  const pingNow = createPinger('spell-jump', { version: VERSION, getCode: () => sync.code });
  const family = Profiles.loadFamily();
  const save = defaultSave();          // replaced in place when a player is picked (screens hold this reference)
  let words = null;                    // the current player's spelling data
  let session = createSession();       // same-session re-queue (R4)
  let currentPlayerId = null;
  const wordsCache = new Map();        // other players' spelling data while the Parent Zone edits them

  const canvas = $('#game');
  const engineMod = await loadEngine();
  // v4.0: the Sky Era's tracks and rides (src/data/skyTracks.js, skyRides.js; a missing file is an empty list and the era stays closed);
  // ?mock=1&skyfixture=1 loads the stand-ins in tools/fixtures/sky/ (tests and screenshots only)
  await loadSkyData({ fixtures: params.get('mock') === '1' && params.has('skyfixture') });
  let game = null;
  let run = null;          // active run context, null when not running
  let hudRaf = 0;
  let input = { gas: false, brake: false, nitro: false };
  let screen = 'players';
  let paused = false, stopFallback = 0;
  let coaching = false;    // first-run coach overlay is up (run is held until it is dismissed)
  let lastResult = null;   // for smoke tests
  let runEarned = null;    // achievements earned during the current run (+ its summary), for the results callouts

  const opts = () => Profiles.playerOptions(family, currentPlayerId);

  // The Lab (lab/SPEC.md §4.1): the bridge loads /lab/ lazily and every call is a no-op when it is missing. labCos is what the Lab says to
  // draw right now (re-read when the Lab changes and at the start of every run); a null slot means the game's own look.
  let labCos = labBridge.cosmetics();
  let labHud = null, labRoundKind = '';
  const refreshLabCos = () => { labCos = labBridge.cosmetics(); };

  const app = {
    save,
    lab: labBridge,
    /** The look to draw on a car: the garage's own equip, with the Lab's skin / sticker over it when one is worn. */
    look: (carId) => labLook(lookFor(save, carId), labCos),
    audio: Audio,
    tts,
    sync,
    version: VERSION,
    ping: pingNow,
    engineName: engineMod.name,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get words() { return words; },
    persist: () => writeSave(save),
    // v3.3: another player's save + words (family board on the picker); the current player's come from memory
    playerData(id) {
      if (id === currentPlayerId && words) return { save, words };
      return { save: loadSave(Profiles.saveKey(id)), words: Profiles.loadWords(id) };
    },
    onLookChanged: () => hero.redraw(),
    // ----- progress transfer code (Parent Zone → Family code → Transfer progress; src/meta/transfer.js) -----
    async exportProgress(id) {
      const p = Profiles.playerById(family, id);
      if (!p) return null;
      if (id === currentPlayerId) { app.persist(); app.persistWords(); }
      const { save: sv, words: wd } = app.playerData(id);
      return encodeTransfer({ player: p, save: sv, words: wd });
    },
    async importProgress(code) {
      const d = await decodeTransfer(code);
      if (!d.ok) return d;
      const r = applyImport(family, d.data, {
        createPlayer: (f, name, color) => Profiles.createPlayer(f, name, color),
        loadSave: (id) => (id === currentPlayerId ? JSON.parse(JSON.stringify(save)) : loadSave(Profiles.saveKey(id))),
        loadWords: (id) => (id === currentPlayerId && words ? JSON.parse(JSON.stringify(words)) : Profiles.loadWords(id)),
        writeSave: (id, sv) => writeSave(sv, Profiles.saveKey(id)),
        writeWords: (id, wd) => Profiles.writeWords(id, wd),
      });
      if (!r.ok) return r;
      wordsCache.delete(r.player.id);
      if (r.player.id === currentPlayerId) {        // the merged data replaces what is in memory
        replaceSave(loadSave());
        replaceInPlace(words, Profiles.loadWords(currentPlayerId));
        WS.rollToday(words, Date.now()); session = createSession();
        refreshCash(); refreshAchBadge(); hero.redraw();
      }
      return r;
    },
    persistWords: () => { if (currentPlayerId && words) Profiles.writeWords(currentPlayerId, words); },
    persistFamily: () => Profiles.writeFamily(family),
    /** v3.7.4: Parents → Options → "Reload now": save, ask the service worker for a newer version, then reload. The page,
     *  main.js and the class lists are network-first, so the reload alone brings this week's list and the newest code. */
    async reloadNow() {
      app.persist(); app.persistWords();
      try {
        if (swUsable) { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await Promise.race([reg.update(), new Promise((r) => setTimeout(r, 2500))]); }
      } catch (_) { /* offline or no worker: a plain reload still works */ }
      location.reload();
    },
    /** v3.9: Parent Zone → Report → "Print certificate": the printable page for one Friday Test (same tab, local data only). */
    openCertificate(playerId, testAt) {
      app.persist(); app.persistWords();
      location.href = `certificate.html?p=${encodeURIComponent(playerId)}&t=${Math.floor(Number(testAt)) || 0}`;
    },
    go,
    toast,
    refreshCash,
    startRun,
    closePanel,
    setSetting,
    setShake,
    resetProgress,
    // ----- v4.0 Sky Era (src/meta/sky.js) -----
    setEra: (era) => chooseEra(era),
    get era() { return currentEra(save); },
    /** The era's state for any player (Parents → Options): { unlocked, available, steps }. */
    skyFor(id) {
      const sv = id === currentPlayerId ? save : loadSave(Profiles.saveKey(id));
      return { unlocked: skyUnlocked(sv), available: skyAvailable(), steps: skyRoadSteps(sv) };
    },
    /** A parent opens the Sky Era now (also for a child who is not playing): the ceremony plays on that child's next title. */
    openSkyFor(id) {
      if (id === currentPlayerId) {
        const fresh = unlockSky(save, Date.now());
        app.persist();
        if (screen === 'title') { refreshTitle(); scheduleSky(); }
        return fresh;
      }
      const sv = loadSave(Profiles.saveKey(id));
      const fresh = unlockSky(sv, Date.now());
      writeSave(sv, Profiles.saveKey(id));
      return fresh;
    },
    checkAchievements: () => { achievements.checkSave(); },
    createPlayer: (name, color) => Profiles.createPlayer(family, name, color),
    selectPlayer,
    // ----- Parent Zone helpers (any player, not only the current one) -----
    wordsFor(id) {
      if (id === currentPlayerId && words) return words;
      if (!wordsCache.has(id)) wordsCache.set(id, Profiles.loadWords(id));
      return wordsCache.get(id);
    },
    saveWordsFor(id, d) {
      Profiles.writeWords(id, d);
      if (id === currentPlayerId) { words = d; session = createSession(); refreshTitle(); }
    },
    settingsFor(id) { return id === currentPlayerId ? save.settings : loadSave(Profiles.saveKey(id)).settings; },
    setSettingFor(id, key, value) {
      if (id === currentPlayerId) { if (key === 'shake') setShake(value); else setSetting(key, value); return; }
      const s = loadSave(Profiles.saveKey(id));
      s.settings[key] = key === 'shake' ? Math.max(0, Math.min(100, Math.round(Number(value) || 0))) : !!value;
      writeSave(s, Profiles.saveKey(id));
    },
    resetGameFor(id) {
      if (id === currentPlayerId) { resetProgress(); return; }
      // a fresh save stamped with resetAt (family sync: the reset wins over older progress on other devices)
      wipeSave(Profiles.saveKey(id));
      writeSave({ ...defaultSave(), resetAt: Date.now() }, Profiles.saveKey(id));
    },
    removePlayer(id) {
      Profiles.removePlayer(family, id);
      wordsCache.delete(id);
      if (id === currentPlayerId) { currentPlayerId = null; words = null; setSaveKey(null); }
    },
    onOptionsChanged(id) { if (id === currentPlayerId) applyPlayerOptions(); },
    openFamilySync: () => pz.open(null, { tab: 'sync' }),
    onParentZoneClosed() {
      wordsCache.clear();
      if (!currentPlayerId || screen === 'players') go('players');   // players may have been added, joined or removed
      else if (screen === 'title') refreshTitle();
      classListCheck('screen');      // v3.9.1: a check held back while the Parent Zone was open
      setTimeout(() => updater.check(), 0);
    },
  };

  // ---------- achievements ----------
  const achievements = app.achievements = createAchievements(save, {
    onEarn(a) {
      app.persist();
      if (runEarned) runEarned.push(a);
      hud.achievement(a);
      setTimeout(() => Audio.ring(), 40);
      refreshAchBadge();
    },
  });

  // ---------- engine ----------
  function makeGame() {
    try {
      game = engineMod.createGame(canvas, { onEvent, reducedMotion: save.settings.reducedMotion, simSpeed: Math.min(6, Number(params.get('sim')) || 1) });   // ?sim=N: a test knob (tools/sky-play.mjs); players never set it
    } catch (e) {
      console.error('[SpellJump] createGame threw', e);
      game = null;
    }
  }
  makeGame();
  if (!game && engineMod.name === '') {
    console.warn('[SpellJump] Real engine threw on create — falling back to the MOCK engine.');
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
  const playersUI = createPlayers(app);
  const screens = { garage: createGarage(app), tracks: createTracks(app), results: createResults(app), players: playersUI.players, newplayer: playersUI.newplayer };
  const panels = createPanels(app);
  const hero = createTitleHero($('#hero'), () => carById(save.selectedCar), () => (currentPlayerId ? app.look(save.selectedCar) : null));
  const crates = app.crates = createCrateOpener(app);
  // natural voice (v3.4): clips from the server's Google voices, used when the player's options pick one and this
  // device is in a family; the device voice stays the fallback (src/spelling/cloudVoice.js, tts.setCloud)
  const cloud = app.cloud = createCloudVoice({
    getCode: () => sync.code,
    getWords: () => (words ? WS.activeList(words).words : []),
    extra: () => CEREMONY_LINES,           // v3.9: the Friday Test ceremony's lines are prepared with the list
    audio: Audio,
    onChange: () => { if (pz) pz.onCloudStatus(); },
  });
  tts.setCloud(cloud);
  // v3.8.1: the clips of a list are made in small batches, next-needed first, and a word is not dictated before its clips are
  // ready (the device voice only when the natural voice cannot be used at all or the clip has not come after ~12 s):
  // src/spelling/spellVoice.js. The spell panel, the Qualifier / Friday Test and the letter rings speak through its facade.
  const voice = app.voice = createSpellVoice({ tts, cloud });
  const vtts = voice.tts;
  const spellPanel = createSpellPanel($('#spell'), { tts: vtts, audio: Audio, onCancel: () => quitRun(), voiceWaitMs: voice.waitMs + 1500 });
  const testScreen = createTestScreen($('#screen-test'), { tts: vtts, audio: Audio, voiceWaitMs: voice.waitMs + 1500 });
  // v3.9: the Friday Test as a boss event (src/ui/testBoss.js wraps the test from the outside); its voice lines go through the same facade
  const testBoss = createTestBoss($('#screen-test'), { audio: Audio, say: (t) => (tts.available ? vtts.say(t) : null), reduced: () => !!save.settings.reducedMotion });
  const pz = createParentZone(app);
  tts.setOnSpeaking((on) => Audio.voice(on));
  // v3.10: the Sky Era teaser (src/ui/skyTeaser.js, src/meta/skyRoad.js). Its lines are spoken ONLY with the natural voice's
  // clips: no clip (no family code, offline, not made yet) means the caption alone, never the device voice.
  let skyVoiceN = 0;
  function skySpeak(text) {
    if (!save.settings.sound || !cloud.active || !cloud.has(text)) return null;
    const n = ++skyVoiceN;
    Audio.voice(true);
    const off = (r) => { if (n === skyVoiceN) Audio.voice(false); return r; };
    return cloud.play(text).then(off, off);
  }
  const sky = app.sky = createSkyTeaser($('#sky-teaser'), {
    audio: Audio,
    speak: skySpeak,
    stopSpeech: () => { skyVoiceN++; try { cloud.stop(); } catch (_) { /* ignore */ } Audio.voice(false); },
    onClose: (info) => {
      Audio.duck(false);
      hero.setMode(heroMode());
      if (info && info.kind === 'open') { setEra(save, 'sky'); app.persist(); }      // v4.0: after the ceremony the title is on the Sky tab
      if (screen === 'title') { refreshSkyCard(); setTimeout(() => updater.check(), 0); }
    },
  });

  function refreshAchBadge() {
    const n = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
    const fresh = Math.max(0, n - (save.seen.ach || 0));
    const b = $('#badge-ach');
    b.hidden = fresh === 0;
    b.textContent = String(fresh);
  }
  function heroMode() {
    if (screen === 'title') return save.settings.reducedMotion ? 'static' : 'anim';
    return screen === 'garage' || screen === 'tracks' ? 'static' : 'off';
  }

  function refreshCash() {
    // v3.11: the game's own money has a name wherever a balance shows ("Garage cash"); Lab coins are a different thing with their own icon
    const html = `${COIN}<span class="cash-txt"><span>${money(save.cash)}</span><small>Garage cash</small></span>`;
    for (const el of $$('[data-cash]')) el.innerHTML = html;
  }

  // ---------- players ----------
  function replaceSave(fresh) {
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, fresh);
  }
  function applyPlayerOptions() {
    const o = opts();
    tts.setRate(o.rate);
    tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
    cloud.setVoice(o.cloudVoice || '');
    if (cloud.active) prepareVoiceFor(currentPlayerId, true);    // only texts without a clip yet are sent
    else cloudDefault(currentPlayerId);
    document.documentElement.classList.toggle('tiles-upper', o.tileCase === 'upper');
  }
  // the first time a player is in a family whose server has the natural voice: pick the default natural voice for
  // them (stored in the player's options, so it syncs; a parent who picks a device voice stores '' instead)
  const cloudAsked = new Map();          // player id → when the server was last asked (once a minute at most)
  function cloudDefault(id) {
    if (!id || !sync.code || Profiles.playerOptions(family, id).cloudVoice !== undefined) return;
    if (Date.now() - (cloudAsked.get(id) || 0) < 60000) return;
    cloudAsked.set(id, Date.now());
    cloud.status().then((key) => {
      if (!key || !sync.code || !Profiles.playerById(family, id) || Profiles.playerOptions(family, id).cloudVoice !== undefined) return;
      Profiles.setPlayerOption(family, id, 'cloudVoice', DEFAULT_CLOUD_VOICE);
      Profiles.writeFamily(family);
      if (id === currentPlayerId) applyPlayerOptions();
      pz.onCloudStatus();
    }).catch(() => {});
  }
  app.cloudDefault = cloudDefault;
  // This player's clips, in the order the child will hear them: the next mission's words and sentences first (every word
  // of the list when a Qualifier is due), then the letters, the rest of the mission, the rest of the list. Small batches that
  // step aside while a line waits for its own clip (spellVoice.js). The player who is playing goes first.
  function prepareVoiceFor(id, front) {
    const o = Profiles.playerOptions(family, id);
    if (!o.cloudVoice || !sync.code) return Promise.resolve(null);
    const d = app.wordsFor(id);
    const list = WS.activeList(d);
    const mission = nextMissionEntries(d, Date.now(), o, (w) => WS.wordInfo(d, w));
    const texts = [...orderTexts(list.words, { mission, perRace: o.wordsPerRace, qualifier: WS.qualifierDue(d) }), ...CEREMONY_LINES, ...teaserTexts()];   // v3.9: and the Friday ceremony's lines; v3.10: then the Sky Era teaser's
    return voice.prepare(texts, { key: id, voice: o.cloudVoice, front: !!front || id === currentPlayerId }).catch(() => null);
  }
  // a list was saved (or the natural voice picked) in the Parent Zone: make that player's clips now
  app.cloudPrepareFor = (id) => prepareVoiceFor(id, false);
  app.prepareNow = (texts, v) => voice.prepareNow(texts, v);
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    const prevMotion = save.settings.reducedMotion;
    currentPlayerId = id;
    setSaveKey(Profiles.saveKey(id));
    replaceSave(loadSave());
    refreshDaily(save); ensureGoals(save);
    refreshStreak(save, Date.now());     // v3.3: a missed day since the last streak day uses this week's shield
    autoUnlock(save, Date.now());        // v4.0: a complete Sky Road opens the Sky Era (the ceremony plays on the title)
    words = Profiles.loadWords(id);
    WS.rollToday(words, Date.now());
    const classList = WS.autoClassList(words, Date.now(), classOverride());   // v3.7: a new class-list week for a player who follows them
    session = createSession();
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    applyPlayerOptions();
    Audio.setSound(save.settings.sound);
    if (Audio.unlocked) Audio.music(save.settings.music);
    document.documentElement.classList.toggle('reduced-motion', save.settings.reducedMotion);
    labAttach();
    if (prevMotion !== save.settings.reducedMotion) { try { game && game.destroy(); } catch (_) {} makeGame(); }
    achievements.checkSave();
    refreshAchBadge();
    hero.redraw();
    app.persist();
    app.persistWords();
    go('title');
    if (classList) { toast(`New class list: ${classList.name}`); pingNow('list'); }
  }
  // test hook (like window.__ttsBackend): window.__noClassLists = true keeps the built-in list (the pre-3.7 UI paths)
  const classOverride = () => (window.__noClassLists ? null : undefined);
  /** v3.7: a new class-list week applies when the current player follows them. v3.9.1: not only on a sync: also when the
   *  page comes back to the front ('visible'), whenever the title is shown ('title') and once an hour while the page stays
   *  open ('hourly'); never during a run, a test, the spell panel or the Parent Zone (it stays pending until a menu screen,
   *  src/spelling/classCheck.js). The toast and the new week's natural-voice clips (3.8.1) follow, as on a sync. */
  let classCheckPending = false, classCheckAt = 0;
  function classListCheck(reason = 'sync') {
    if (!classCheckWanted(reason, classCheckPending)) return;
    const ok = classCheckAllowed({ screen, hasPlayer: !!(words && currentPlayerId), running: !!run, spelling: spellPanel.isOpen, testing: screen === 'test',
      parentZone: pz.isOpen, hidden: document.visibilityState === 'hidden' });
    if (!ok) { if (words && currentPlayerId) classCheckPending = true; return; }
    classCheckPending = false;
    classCheckAt = Date.now();
    const l = WS.autoClassList(words, Date.now(), classOverride());
    if (!l) return;
    session = createSession();
    app.persistWords();
    pingNow('list');
    prepareVoiceFor(currentPlayerId, true);     // the new week's clips now
    toast(`New class list: ${l.name}`);
    if (screen === 'title') refreshTitle();
  }
  app.classListCheck = classListCheck;          // smoke tests: run a check by hand (reason as above)
  // once an hour while open: a cheap tick each minute (a sleeping tablet pauses timers; 'visible' covers waking up).
  // Test hook: window.__classCheckEveryMs shortens the hour.
  setInterval(() => {
    if (hourlyCheckDue(classCheckAt, Date.now(), window.__classCheckEveryMs || CLASS_CHECK_EVERY_MS)) classListCheck('hourly');
  }, Math.min(60000, window.__classCheckEveryMs || 60000));

  // ---------- The Lab (lab/SPEC.md §4.1): attach when a player is chosen, detach when they leave; the XP pill sits in the run HUD ----------
  let labAttached = false;
  function labInfo() {
    const p = Profiles.playerById(family, currentPlayerId);
    return p ? { playerId: p.id, name: p.name, color: p.color, gentle: false, reducedMotion: !!save.settings.reducedMotion, sound: !!save.settings.sound } : null;
  }
  function labAttach() {
    const info = labInfo();
    if (!info) return;
    labBridge.attach(info);
    labAttached = true;
    labRoundKind = '';
    labBridge.beginRound();
    if (labHud) labHud.destroy();
    labHud = labBridge.hud({ mount: $('#hud-lab'), compact: true });
    refreshLabCos();
  }
  function labDetach() {
    if (labHud) { labHud.destroy(); labHud = null; }
    if (labAttached) { labBridge.detach(); labAttached = false; labRoundKind = ''; }
    refreshLabCos();
  }
  // v3.11 (lab/docs/COHESION.md): the one Lab chip on the title (top-left), the Lab button on "Who's playing?", and this game's card for the Lab
  const phoneMq = window.matchMedia ? window.matchMedia('(max-width: 520px)') : { matches: false };
  let titleChip = null;
  function mountTitleChip() {
    if (titleChip) titleChip.destroy();
    $('#title-chip-host').replaceChildren();
    titleChip = labBridge.mountChip($('#title-chip-host'), { game: 'sj', current: 'sj', compact: phoneMq.matches, theme: 'dark' });
  }
  mountTitleChip();
  if (phoneMq.addEventListener) phoneMq.addEventListener('change', mountTitleChip);
  labBridge.mountPickerButton($('#picker-lab'));
  /** lab.summary for this player's Spell Jump card: after every answered word and run, and when the title shows. Same text twice is a no-op. */
  function labSummary() {
    if (!labAttached || !words || !currentPlayerId) return;
    try {
      const m = WS.missionState(words, Date.now());
      const mastered = WS.masteredCount(words);
      const skyLine = skyUnlocked(save) && skyAvailable() ? ` · ${skyTracksText(save, skyTracks())}` : '';     // v4.0: "Sky Era · 2 / 5 tracks"
      labBridge.summary({
        level: `Speller LV ${levelFor(save.xp || 0)}`,
        line: `${mastered} word${mastered === 1 ? '' : 's'} mastered${skyLine}`,
        today: `Today: ${m.count} / ${m.size} words`,
        lastPlayed: Date.now(),
      });
    } catch (e) { console.warn('[SpellJump] lab summary', e); }
  }
  app.labSummary = labSummary;
  // a new Lab round per mission or Mega Run, never per 3-word race: the combo lives one round (the Lab core's note)
  function labRound(kind) { if (kind !== labRoundKind) { labRoundKind = kind; labBridge.beginRound(); } }
  labBridge.onChange((e) => {
    refreshLabCos();
    if (e && ['attach', 'ready', 'equip', 'sync', 'reset'].includes(e.type)) { try { hero.redraw(); } catch (_) { /* no hero yet */ } }
  });

  function refreshTitle() {
    const p = Profiles.playerById(family, currentPlayerId);
    if (!p || !words) return;
    $('#title-player').textContent = p.name;
    drawAvatar($('#title-avatar'), p.color);
    const m = WS.missionState(words, Date.now());
    const chip = $('#title-mission');
    chip.classList.toggle('done', m.done);
    $('#title-mission-text').textContent = m.done ? 'Mission complete! Free play' : `Today: ${m.count} / ${m.size} words`;
    $('#title-sample').hidden = !WS.isSampleActive(words);
    $('#btn-play').textContent = WS.qualifierDue(words) ? 'Play: new words!' : 'Play';
    refreshEngagement();
    refreshSkyCard();
    labSummary();
  }

  // ---------- v3.10: the Sky Road card on the title + the Sky Era teaser ----------
  // The card shows the road (one step per mission day since release, src/meta/skyRoad.js) and replays the full teaser.
  // v4.0: before the era opens the title shows the Sky Road card; once it is open the card becomes the Earth / Sky switch.
  function refreshSkyCard() {
    const btn = $('#btn-sky');
    if (!btn) return;
    const open = !!currentPlayerId && skyUnlocked(save) && skyAvailable();
    const sw = $('#era-switch');
    sw.hidden = !open;
    document.documentElement.classList.toggle('era-sky', open && currentEra(save) === 'sky');
    if (open) for (const t of $$('#era-switch [data-era]')) { const on = t.dataset.era === currentEra(save); t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); }
    btn.hidden = !currentPlayerId || open;
    if (!currentPlayerId) return;
    const n = skyRoadSteps(save);
    $('#sky-steps').textContent = 'Sky Road ' + n + ' / ' + SKY_ROAD_STEPS;
    $('#sky-mini').innerHTML = miniRoadSvg(n);
    btn.dataset.steps = String(n);
    btn.setAttribute('aria-label', 'Sky Era: watch the teaser. Sky Road ' + n + ' of ' + SKY_ROAD_STEPS + '.');
  }
  // the Earth / Sky tabs (title + track screen): the choice is saved (save.sky.era) and the garage / track list follow it
  function chooseEra(era) {
    if (!skyUnlocked(save) || !skyAvailable()) era = 'earth';
    if (currentEra(save) === era) return era;
    setEra(save, era);
    app.persist();
    refreshSkyCard();
    if (screen === 'tracks') screens.tracks.render();
    if (screen === 'garage') screens.garage.render();
    return currentEra(save);
  }
  for (const t of $$('#era-switch [data-era]')) t.addEventListener('click', () => chooseEra(t.dataset.era));
  const reducedNow = () => !!save.settings.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Play once when due: never over a panel, a crate, the Parent Zone, the Lab, a toast (e.g. a new class list) or the coach,
  // never during a run or a test; it waits until the title is clear. Marked seen when it STARTS (a closed tab does not loop it).
  let skyTimer = 0, skyWaitFrom = 0;
  function skyBlocked() {
    return screen !== 'title' || !currentPlayerId || !!run || spellPanel.isOpen || pz.isOpen || coaching || sky.isOpen || document.hidden
      || !$('#crate-fx').hidden || !$$('.modal').every((m) => m.hidden) || document.documentElement.classList.contains('lab-open')
      || !!$('#toasts .toast') || !!$('#update-note');
  }
  function maybeSky() {
    clearTimeout(skyTimer);
    if (window.__noSkyTeaser || screen !== 'title' || !currentPlayerId) return;
    if (autoUnlock(save, Date.now())) { app.persist(); refreshSkyCard(); }      // v4.0: the road is complete: the era opens
    const due = ceremonyDue(save) ? { kind: 'open', step: skyRoadSteps(save) } : teaserDue(save);
    if (!due) return;
    if (skyBlocked()) { skyTimer = setTimeout(maybeSky, 900); return; }
    // the voice: wait (up to 6 s on the title) for the teaser's clips so the one full play is heard, then play either way
    if (save.settings.sound && cloud.active && cloud.missing(teaserTexts()).length) {
      if (!skyWaitFrom) skyWaitFrom = Date.now();
      if (Date.now() - skyWaitFrom < 6000) { prepareSkyVoice(true); skyTimer = setTimeout(maybeSky, 500); return; }
    }
    skyWaitFrom = 0;
    playSky(due);
  }
  function scheduleSky(ms = 700) { clearTimeout(skyTimer); skyTimer = setTimeout(maybeSky, ms); }
  function playSky(due) {
    clearTimeout(skyTimer);
    if (due.kind === 'open') markCeremonySeen(save); else markTeaserSeen(save, due);
    app.persist();
    const p = Profiles.playerById(family, currentPlayerId);
    hero.setMode('off');
    Audio.duck(true);
    prepareSkyVoice(true);
    return sky.play({ kind: due.kind, step: due.step, steps: skyRoadSteps(save), car: carById(save.selectedCar), look: app.look(save.selectedCar),
      name: skyName(p && p.name), reduced: reducedNow(), sound: !!save.settings.sound, rides: ceremonyRides() });
  }
  app.playSky = playSky;
  app.maybeSky = maybeSky;
  // the teaser's few lines as natural-voice clips (name-free; "Step 4 / 8 / 12 of 15" pre-made): they ride at the end of the
  // player's own clip queue (prepareVoiceFor, after the words: the next race comes first); on the title the ready ones are
  // decoded, and a teaser that starts with lines still missing asks for them itself
  const skyAsked = new Map();          // voice -> when its missing lines were last asked for
  function prepareSkyVoice(urgent = false) {
    if (!cloud.active) return;
    const texts = teaserTexts(), v = cloud.voice;
    if (!cloud.missing(texts).length || !urgent) { cloud.warm(texts); return; }
    if (Date.now() - (skyAsked.get(v) || 0) < 10 * 60000) return;
    skyAsked.set(v, Date.now());
    cloud.prepare(texts).then(() => cloud.warm(texts)).catch(() => {});
  }

  // ---------- v3.3 engagement: title chips (streak flame, level + progress, crates waiting) ----------
  function refreshEngagement() {
    const now = Date.now();
    const n = streakNow(save.streak, now);
    $('#title-streak').textContent = String(n);        // v3.11: the streak lives behind the Days button (a panel), not in the header: the one header flame is the Lab chip's
    $('#title-streak').classList.toggle('cold', n === 0);
    $('#btn-streak').setAttribute('aria-label', `Days in a row: ${n} day${n === 1 ? '' : 's'}. Opens the streak calendar.`);
    const lp = levelProgress(save.xp || 0);
    $('#title-lv').textContent = `Speller LV ${lp.level}`;
    $('#title-lv-name').textContent = lp.title;
    $('#title-lv-bar').style.width = `${lp.max ? 100 : Math.round((lp.into / lp.need) * 100)}%`;
    $('#title-level').setAttribute('aria-label', `Speller level ${lp.level}, ${lp.title}${lp.max ? '' : `, ${lp.need - lp.into} XP to the next level`}`);
    const c = unopened(save);
    const cb = $('#btn-crates');
    cb.hidden = c === 0;
    $('#crate-count').textContent = `${c} crate${c === 1 ? '' : 's'}`;
  }
  // a run's (or a Friday Test's) engagement bookkeeping, shown on the results screen
  function newEng() { const l = levelFor(save.xp || 0); return { xp: 0, levelBefore: l, levelAfter: l, mastered: [], crates: 0, champion: false, unlocks: [], streak: null }; }
  function gainXp(eng, n) {
    const x = addXp(save, n);
    eng.xp += x.gained; eng.unlocks.push(...x.unlocks); eng.levelAfter = levelFor(save.xp);
  }
  function masteredWord(eng, word, listId) {
    labBridge.report({ event: 'mastered', n: 1 });
    gainXp(eng, XP.mastered);
    addTrophy(save, listId, word);
    eng.mastered.push({ word, listId, shelf: (save.trophies[listId] || []).length });
    const ch = checkChampion(save, words);
    if (ch) { eng.champion = true; eng.crates += 1; eng.xp += ch.xp.gained; eng.unlocks.push(...ch.unlocks); eng.levelAfter = levelFor(save.xp); }
  }
  function dayDone(eng, now) {
    const d = completeDay(save, now);
    if (d.counted && autoUnlock(save, now)) eng.skyOpened = true;         // v4.0: the 15th Sky Road step opens the Sky Era
    labBridge.report({ event: 'day', n: 1 });           // the Lab pays its day once a local day across all five games
    if (!d.counted) return;
    eng.streak = d; eng.crates += d.crates; eng.unlocks.push(...d.unlocks);
  }

  function go(name, arg) {
    closePanel();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    if (name === 'players') labDetach();
    const inRun = name === 'run';
    document.documentElement.classList.toggle('in-run', inRun);
    if (!inRun) document.documentElement.classList.remove('spelling');
    if (name === 'results') { $('#toasts').textContent = ''; hud.flushAchievements(); }
    if (!inRun) hud.clearBanners();
    $('#hud').hidden = !inRun;
    $('#controls').hidden = !inRun;
    $('#backdrop').hidden = inRun || name === 'results';
    if (!inRun) hideCoach();
    if (name === 'title') refreshTitle();
    if (screens[name]) screens[name].show(arg);
    if (name === 'title') { prepareSkyVoice(); scheduleSky(); } else { clearTimeout(skyTimer); if (sky.isOpen) sky.close('screen'); }
    hero.setMode(heroMode());
    refreshCash();
    classListCheck(name === 'title' ? 'title' : 'screen');   // v3.9.1: a new week on a device that stayed open (or one held back by a run)
    setTimeout(() => updater.check(), 0);   // a waiting update reloads once the app is on a safe screen
  }

  function openPanel(name) {
    for (const el of $$('.modal')) el.hidden = el.dataset.panel !== name;
    panels.render(name);
    if (name === 'achievements') {
      save.seen.ach = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
      app.persist();
      refreshAchBadge();
    }
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
    if (key === 'sound') { Audio.setSound(value); if (labAttached && labInfo()) labBridge.attach(labInfo()); }
    if (key === 'music') Audio.music(value);
    if (key === 'reducedMotion') {
      document.documentElement.classList.toggle('reduced-motion', !!value);
      if (labAttached && labInfo()) labBridge.attach(labInfo());
      if (!run) { try { game && game.destroy(); } catch (_) {} makeGame(); }
      hero.setMode(heroMode());
    }
    renderPauseToggles();
  }

  // screen shake 0-100 (saved); passed to game.start as shake 0..1. preview = wiggle the pause sheet once.
  function setShake(value, preview) {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (save.settings.shake !== v) { save.settings.shake = v; app.persist(); }
    if (preview && v > 0 && !save.settings.reducedMotion) {
      const sheet = $('#panel-pause .sheet');
      sheet.style.setProperty('--amp', `${(v / 100) * 7}px`);
      sheet.classList.remove('shake-preview'); void sheet.offsetWidth; sheet.classList.add('shake-preview');
    }
  }

  function resetProgress() {
    const fresh = wipeSave();
    const keepSettings = save.settings;
    replaceSave(fresh);
    save.settings = keepSettings;
    save.resetAt = Date.now();          // family sync: this reset wins over older progress from other devices
    refreshDaily(save); ensureGoals(save);
    app.persist();
    refreshCash();
    refreshAchBadge();
    hero.redraw();
  }

  // ---------- family sync: newer data from another device ----------
  // the current player's data is not swapped out under a run, a test or the spell panel (the next pull applies it)
  function syncBusy() { return screen === 'run' || screen === 'test' || spellPanel.isOpen; }
  function syncCanApply(k) {
    if (k === 'family') return !syncBusy();
    return !(syncBusy() && k.startsWith(currentPlayerId + '.'));
  }
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };
  function syncApplied(k) {
    if (k === 'family') {
      Audio.syncFamilyMusic();
      replaceInPlace(family, Profiles.loadFamily());
      for (const id of [...wordsCache.keys()]) if (!Profiles.playerById(family, id)) wordsCache.delete(id);
      if (currentPlayerId && !Profiles.playerById(family, currentPlayerId)) {
        currentPlayerId = null; words = null; setSaveKey(null);
        if (!pz.isOpen) go('players');
      } else if (currentPlayerId) applyPlayerOptions();
      if (screen === 'players') screens.players.show();
      else if (screen === 'title') refreshTitle();
      pz.onSyncApplied();
      return;
    }
    const id = k.replace(/\.(save|words)$/, '');
    if (k.endsWith('.save')) {
      if (screen === 'players') screens.players.show();     // v3.3: the family board reads every player's save
      if (id !== currentPlayerId) return;
      replaceSave(loadSave());
      refreshCash();
      refreshAchBadge();
      hero.redraw();
      if (screen === 'title') { refreshTitle(); if (!sky.isOpen) scheduleSky(); }
    } else {
      const fresh = Profiles.loadWords(id);
      if (id === currentPlayerId && words) {
        replaceInPlace(words, fresh);
        WS.rollToday(words, Date.now());
        session = createSession();
        if (screen === 'title') refreshTitle();
        classListCheck('sync');
      }
      if (wordsCache.has(id) && wordsCache.get(id) !== words) replaceInPlace(wordsCache.get(id), fresh);
      if (screen === 'players') screens.players.show();
    }
    pz.onSyncApplied();
  }

  // ---------- Qualifier / Friday Test ----------
  // v3.11: every answer is banked the moment it is given (the word's record, today's count, the cash, XP, the Lab); a test left midway
  // keeps those results and resumes where it stopped (answered words are not asked again). The Friday Test is still a test: one try per word.
  function bankTestAnswer(kind, r, eng) {
    const now = Date.now();
    const b = WS.bankTestWord(words, kind, r.word, r.correct, now);
    if (!b) return null;
    labBridge.report({ event: 'testWord', n: 1, firstTry: !!r.correct });      // one per word, as asked (no combo)
    let paid = 0;
    if (r.correct) {
      paid = earn(save, kind === 'qualifier' ? QUALIFIER_PAY : MEGA_PAY);
      if (kind === 'friday') gainXp(eng, XP.testWord);
    }
    if (b.newlyMastered) masteredWord(eng, r.word, words.activeId);
    if (b.missionJustDone) { earn(save, MISSION_REWARD); gainXp(eng, XP.mission); eng.crates += earnCrate(save); dayDone(eng, now); }
    app.persist(); app.persistWords();
    refreshCash();
    labSummary();
    return { ...b, paid };
  }
  function startTest(kind) {
    if (!words) return;
    const list = WS.activeList(words);
    const n = list.words.length;
    const answered = WS.testAnswered(words, kind);
    const eng = newEng();
    go('test');
    const upper = opts().tileCase === 'upper';
    const q = kind === 'qualifier';
    if (!q) testBoss.start(n);          // v3.9: the Test Titan towers over the Friday Test (the test itself is unchanged)
    const resumed = answered.length > 0 && answered.length < n;
    testScreen.run({
      kind, title: q ? 'Qualifier' : 'Friday Test', upper, answered,
      words: list.words.map((w) => ({ word: w.word, sentence: w.sentence, sayAs: w.sayAs || '' })),
      onAnswer: (r) => bankTestAnswer(kind, r, eng),
      intro: resumed
        ? { heading: 'Welcome back!', lines: [`You already did ${answered.length} of ${n}. Your answers are saved: ${n - answered.length} to go.`, q ? `$${QUALIFIER_PAY} for each one you get right.` : 'No hints!'], button: 'Keep going' }
        : q
        ? { heading: 'New words!', lines: [`A quick check of this week's ${n} words: listen, then spell each one once.`, `Words you already know skip ahead. $${QUALIFIER_PAY} for each one you get right.`], button: 'Start' }
        : { heading: 'Friday Test', lines: [`All ${n} words. Listen and spell. No hints!`, 'Your score powers the MEGA RUN.'], button: 'Start' },
      summary(results) {
        const now = Date.now();
        const correct = results.filter((r) => r.correct).length;
        const total = results.length;
        const missed = total - correct;
        WS.finishTest(words, kind, results, now);
        if (q) {
          const paid = correct * QUALIFIER_PAY;                  // already banked word by word
          app.persist(); app.persistWords();
          labSummary();
          return {
            heading: correct === total ? 'You knew them all!' : 'Qualifier done!',
            lines: [h('div', { class: 'big-score', id: 'tm-score' }, `${correct} / ${total}`), `+$${money(paid)}`,
              missed ? `${missed} Focus Word${missed === 1 ? '' : 's'} to practice. Each run starts with a word!` : 'Every word skips ahead. Keep them fresh in your runs!'],
            button: "Let's go",
          };
        }
        const ft = words.tests[words.tests.length - 1];
        pingNow('test');
        const score = total ? correct / total : 0;
        const paid = correct * MEGA_PAY;                         // already banked word by word
        // v3.3: the test counts as a streak day (XP, trophies and cash were banked per word)
        dayDone(eng, now);
        // v3.9: the Lab hears about the finished test (its trophy shelf records the tier); the ceremony is the game's own and needs no Lab
        const tier = tierFor(correct, total);
        const rc = labBridge.report({ event: 'test', n: correct, meta: { of: total, tier } });
        const pre = qualifierFor(words.tests, ft);
        const gain = improvement(ft, pre);
        app.persist(); app.persistWords();
        labSummary();
        lastTest = { correct, total, score, paid, eng };
        if (score >= 0.8) Audio.fanfare(); else Audio.cash();
        const practice = results.filter((r) => !r.correct).map((r) => r.word);
        return {
          heading: score === 1 ? 'Perfect test!' : 'Test done!',
          lines: [h('div', { class: 'big-score', id: 'tm-score' }, `${correct} / ${total}`),
            `+$${money(paid)} ($${MEGA_PAY} a word) · Mega Run power ${Math.round((0.6 + 0.4 * score) * 100)}%`,
            testBoss.ceremony({ tier, improved: gain != null && gain >= 20, points: gain, shelf: rc.ok ? 'Lab shelf' : 'Your shelf', sound: true }),
            practice.length ? h('p', { class: 'cer-practice', id: 'tm-practice' }, `Words to practice this week: ${practice.slice(0, 6).join(', ')}${practice.length > 6 ? ` and ${practice.length - 6} more` : ''}`) : null].filter(Boolean),
          button: 'Mega Run!',
          cls: `ceremony tier-${tier}`,
        };
      },
    }).then(({ cancelled }) => {
      testBoss.stop();
      if (cancelled) { go('title'); return; }
      if (q) go('garage');
      else startRun({ trackId: save.selectedTrack, mega: lastTest });
    });
  }
  let lastTest = null;

  // ---------- run lifecycle ----------
  function startRun({ trackId, daily = false, mega = null }) {
    if (!game) { toast('Engine failed to load'); return; }
    closePanel();
    let car, stats, seed, def = null;
    trackId = daily ? dailyFor(todayKey()).trackId : (trackById(trackId) && isUnlocked(save, trackId) ? trackId : 'canyon');
    const track = trackById(trackId);
    if (daily) {
      refreshDaily(save);
      def = dailyFor(todayKey());
      car = carById(def.carId);
      stats = resolveStats(car, def.levels);
      seed = def.seed;
      save.daily.attempts += 1;
      app.persist();
    } else {
      car = carById(save.selectedCar) || carById('beater');
      stats = statsFor(save, car.id);
      seed = hashString('track:' + trackId);   // fixed layout per track so it can be learned
    }
    // every normal run starts with a set of words spelled from memory ("Words before each race", 1-4; the Mega
    // Run's power comes from the test). The rings get the first word's letters for now; spelledSet() restarts the
    // parked run with the ring word's letters if the set picks another one.
    const pick = !daily && !mega && words ? WS.nextWord(words, Date.now(), session, opts()) : null;
    const letters = pick ? ringLetters(pick.word) : null;
    const setSize = WS.WORDS_PER_RACE.includes(opts().wordsPerRace) ? opts().wordsPerRace : 2;
    const powerScale = mega ? 0.6 + 0.4 * mega.score : 1;
    // v3.6: levels per race (Parents → Options, default 3); the daily challenge and the Mega Run are one level
    const levelsOpt = mockLevels != null ? mockLevels : opts().levelsPerRace;
    const levels = daily || mega ? 1 : WS.LEVELS_PER_RACE.includes(levelsOpt) ? levelsOpt : 3;
    clearTimeout(stopFallback);
    runEarned = [];
    if (!daily) labRound(mega ? 'mega' : 'mission');          // the Lab's combo lives a mission or a Mega Run, not one 3-word race
    refreshLabCos();                                           // cosmetics are re-read at the start of every run
    // v4.0: on a sky track the engine freezes once per flight at the Spell Boost gate (unless a parent switched it off for this child;
    // the Mega Run is the Friday Test's own power, so it has none)
    const spellBoost = track.era === 'sky' && !daily && !mega && opts().skyBoost !== false;
    run = {
      trackId, daily, def, carId: car.id, sky: track.era === 'sky', boostOn: spellBoost, boosts: [], boosting: false, boostUsed: false, stats, ended: false, goalToasts: [], earned: runEarned, flight: false, bigAir: false, rampage: false, rings: 0,
      spelling: !!pick, pick, letters: letters || [], spell: null, mega, missionReward: 0, setSize, startCfg: null,
      eng: mega && mega.eng ? mega.eng : newEng(),
      level: 1, levels, levelDone: [], levelTimer: 0, pendingLevel: false, quitting: false,
    };
    if (mega) mega.eng = null;           // a Retry of the Mega Run does not replay the test's moments
    achievements.beginRun();
    go('run');
    hud.reset(track);
    hud.word(null);
    controls.reset();
    controls.enable(!pick);
    Audio.duck(true);
    try {
      // start first so the parked car is on screen behind the spell panel; the launch power is set after
      const look = app.look(car.id);       // v3.3: the equipped skin / sticker (cosmetics.js entries, null = stock); v3.9: the Lab's over them
      run.startCfg = {
        car, stats, track, seed, skin: look.skin, sticker: look.sticker, trail: trailFor(labCos),
        shake: save.settings.reducedMotion ? 0 : save.settings.shake / 100,
        bestDistance: daily ? null : (save.best[trackId] || null),
        letters, powerScale, nitroScale: 1,
        ...(track.era === 'sky' ? { spellBoost } : {}),
      };
      game.start(run.startCfg);
      game.setInput({ gas: false, brake: false, nitro: false });
    } catch (e) {
      console.error('[SpellJump] game.start threw', e);
      run = null; controls.enable(false); go('tracks'); toast('Could not start the run');
      return;
    }
    cancelAnimationFrame(hudRaf);
    hudRaf = requestAnimationFrame(hudLoop);
    if (pick) {
      const r = run;
      setSpelling(true);
      spellSet(r, pick).catch((e) => console.error('[SpellJump] spelling set', e));
    } else if (mega) {
      hud.banner('mega', `Mega run ${Math.round(powerScale * 100)}%`);
      if (!save.seen.coach) showCoach();
    } else if (!daily && !save.seen.coach) showCoach();
  }

  // ---------- v3.6 levels ----------
  // The level's finish was crossed and more levels remain: a "Level k!" moment, then the car is back on the ramp
  // (startLevel) with a new word set, a longer finish line and a bigger cash multiplier. The level's summary is kept
  // and folded into the round's results at the end (aggregateLevels).
  function advanceLevel(r, summary) {
    r.levelDone.push({ summary, spell: r.spell });
    r.level += 1;
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false);
    Audio.fanfare();
    hud.banner('level', `Level ${r.level}! Cash ×${LEVEL_CASH[r.level - 1]}`);
    clearTimeout(r.levelTimer);
    r.levelTimer = setTimeout(() => { if (run === r && !r.ended) { if (paused) r.pendingLevel = true; else startLevel(r); } }, LEVEL_GAP_MS);
  }
  function startLevel(r) {
    if (run !== r || r.ended) return;
    r.pendingLevel = false;
    const track = levelTrack(trackById(r.trackId), r.level);
    const pick = words ? WS.nextWord(words, Date.now(), session, opts()) : null;
    const letters = pick ? ringLetters(pick.word) : null;
    Object.assign(r, { pick, spelling: !!pick, letters: letters || [], spell: null, lettersShown: false, flight: false, bigAir: false, rampage: false, boosting: false, boostUsed: false });
    hud.reset(track);
    hud.word(null);
    controls.reset();
    controls.enable(false);
    try {
      r.startCfg = { ...r.startCfg, track, seed: hashString(`track:${r.trackId}:L${r.level}`), letters, powerScale: 1, nitroScale: 1, bestDistance: save.best[r.trackId] || null };
      game.start(r.startCfg);
      game.setInput({ gas: false, brake: false, nitro: false });
    } catch (e) {
      console.error('[SpellJump] level start threw', e);
      const prev = r.levelDone.pop();
      r.level -= 1;
      endRun(prev ? prev.summary : null);
      return;
    }
    Audio.duck(true);
    hud.banner('level', `Level ${r.level} of ${r.levels} · cash ×${LEVEL_CASH[r.level - 1]}`);
    if (pick) {
      setSpelling(true);
      spellSet(r, pick).catch((e) => console.error('[SpellJump] spelling set', e));
    } else controls.enable(true);
  }
  // one summary for the whole round: cash per level × its multiplier (parts stay whole numbers that add up to the
  // total), distance = the longest level, counters summed, rating = the best level's
  function aggregateLevels(r, sums) {
    const cash = { distance: 0, stunts: 0, smash: 0, landing: 0, combo: 0, air: 0, total: 0 };
    let raw = 0;
    sums.forEach((s, i) => {
      const m = LEVEL_CASH[i] || 1, c = s.cash || {};
      for (const k of ['distance', 'stunts', 'smash', 'landing', 'combo', 'air']) cash[k] += Math.round((c[k] || 0) * m);
      raw += c.total || 0;
    });
    cash.total = cash.distance + cash.stunts + cash.smash + cash.landing + cash.combo + cash.air;
    const sum = (k) => sums.reduce((a, s) => a + (s[k] || 0), 0);
    const max = (k) => sums.reduce((a, s) => Math.max(a, s[k] || 0), 0);
    const best = sums.reduce((a, s) => ((s.ratingScore || 0) > (a.ratingScore || 0) ? s : a), sums[0]);
    const last = sums[sums.length - 1];
    return {
      distance: max('distance'), airTime: Math.round(sum('airTime') * 100) / 100,
      flips: sum('flips'), frontFlips: sum('frontFlips'), backFlips: sum('backFlips'), smashed: sum('smashed'),
      maxSpeedKmh: max('maxSpeedKmh'), landing: last.landing, finishCrossed: sums.some((s) => s.finishCrossed), cash,
      durationSec: Math.round(sum('durationSec') * 10) / 10, rating: best.rating, ratingScore: best.ratingScore,
      maxAltitude: max('maxAltitude'), bestCombo: max('bestCombo'), explosions: sum('explosions'), rings: sum('rings'), coins: sum('coins'),
      airTargets: sum('airTargets'), rejumps: sum('rejumps'),
      letters: { collected: sums.reduce((a, s) => a + ((s.letters && s.letters.collected) || 0), 0), total: sums.reduce((a, s) => a + ((s.letters && s.letters.total) || 0), 0), inOrder: sums.every((s) => !s.letters || s.letters.inOrder) },
      finale: sums.some((s) => s.finale),
      levels: { reached: sums.length, total: r.levels, cleared: sums.map((s) => !!s.finishCrossed), bonus: cash.total - raw },
    };
  }
  function aggregateSpell(r) {
    const sets = [...r.levelDone.map((l) => l.spell), r.spell].filter(Boolean);
    if (sets.length <= 1) return sets[0] || null;
    const words = sets.flatMap((sp) => sp.words || []);
    const c = words.filter((w) => w.firstTry).length, n = words.length;
    const last = sets[sets.length - 1];
    return {
      words, word: last.word, correct: c, total: n, firstTry: c === n, fixed: c < n && words.every((w) => w.firstTry || w.fixed),
      misses: words.reduce((a, w) => a + (w.misses || 0), 0), bonus: sets.reduce((a, sp) => a + (sp.bonus || 0), 0),
      streak: last.streak, powerScale: last.powerScale, nitroScale: last.nitroScale,
    };
  }

  // the words of one race, back to back in the spell panel (the car stays parked behind it). Each word is recorded
  // as it is spelled (scheduler, mission counter, bonus, streak, badges); the launch power comes from the whole set.
  async function spellSet(r, first) {
    const n = r.setSize;
    const done = [];
    let pick = first;
    for (let i = 0; i < n && pick; i++) {
      if (i > 0) {
        const ok = await spellPanel.beat('Next word!', 800);
        if (!ok || run !== r || r.ended) return;
      }
      r.pick = pick;
      let banked = null;       // v3.11: banked the moment the word is answered (onResult), even if the child leaves during the banner
      const res = await spellPanel.run(pick, {
        onResult: (out) => { if (run === r && !r.ended) banked = recordWord(r, pick, out); },
        coinMult: r.stats.coinMult || 1, streakBefore: Math.min(WS.STREAK_CAP, words.streak),
        mission: WS.missionState(words, Date.now()), upper: opts().tileCase === 'upper',
        set: { index: i, count: n }, keepOpen: i < n - 1,
      });
      if (!res || res.cancelled) return;      // quitRun already ran (back button); an answered word is already banked
      if (run !== r || r.ended) return;
      done.push(banked || recordWord(r, pick, res));
      if (i < n - 1) pick = WS.nextWord(words, Date.now(), session, opts());
    }
    spellPanel.close();
    spelled(r, done);
  }

  // one word of the set: record it, pay its bonus (and the mission reward when it completes the mission)
  function recordWord(r, pick, res) {
    const now = Date.now();
    const rec = WS.recordSpell(words, pick.word, { firstTry: res.firstTry }, now, session);
    const lr = labBridge.report({ event: 'word', n: 1, firstTry: !!res.firstTry });
    if (lr.combo && lr.combo.moment) r.labMoment = lr.combo.name || 'Perfect Launch';      // drawn at the launch
    if (rec.missionJustDone) labRoundKind = '';                                         // the next race starts a clean Lab round
    const bonus = res.firstTry ? earn(save, res.bonus) : 0;
    const missionReward = rec.missionJustDone ? earn(save, MISSION_REWARD) : 0;
    r.missionReward += missionReward;
    // v3.3: XP (first try / fixed), a mastered word's trophy (+ Week Champion), the mission's crate + streak day
    const eng = r.eng;
    if (res.firstTry) gainXp(eng, XP.firstTry); else if (res.fixed) gainXp(eng, XP.fixed);
    if (rec.newlyMastered) masteredWord(eng, pick.word, rec.listId);
    if (rec.missionJustDone) { gainXp(eng, XP.mission); eng.crates += earnCrate(save); dayDone(eng, now); }
    app.persist(); app.persistWords();
    refreshCash();
    labSummary();
    achievements.spell({ firstTry: res.firstTry, streak: rec.streak, newlyMastered: rec.newlyMastered });
    return { word: pick.word, firstTry: res.firstTry, fixed: res.fixed, misses: res.misses, bonus, streak: rec.streak };
  }

  // the set is done: power from the set, the ring word, hand the car to the child
  function spelled(r, done) {
    if (run !== r || r.ended || !done.length) return;
    const n = done.length;
    const c = done.filter((w) => w.firstTry).length;
    const { powerScale, nitroScale } = WS.setLaunch(c, n);
    // letter rings: the missed word (the last one if several were missed), else the last word asked
    const missed = done.filter((w) => !w.firstTry);
    const ringWord = (missed.length ? missed[missed.length - 1] : done[n - 1]).word;
    const letters = ringLetters(ringWord);
    if (letters.join('') !== r.letters.join('') && r.startCfg) {
      // the engine takes the ring letters in start(): restart the still-parked run (same seed, same layout)
      try {
        r.startCfg = { ...r.startCfg, letters, powerScale, nitroScale };
        game.start(r.startCfg);
        game.setInput({ gas: false, brake: false, nitro: false });
      } catch (e) { console.warn('[SpellJump] restart with the ring word failed', e); }
    }
    r.letters = letters;
    const last = done[n - 1];
    r.spell = {
      words: done, word: ringWord, correct: c, total: n,
      firstTry: c === n, fixed: c < n && done.every((w) => w.firstTry || w.fixed), misses: done.reduce((a, w) => a + (w.misses || 0), 0),
      bonus: done.reduce((a, w) => a + w.bonus, 0), streak: last.streak, powerScale, nitroScale,
    };
    try { if (typeof game.setLaunchPower === 'function') game.setLaunchPower(powerScale, nitroScale); } catch (e) { console.warn('[SpellJump] setLaunchPower failed', e); }
    r.spelling = false;
    setSpelling(false);
    hud.word(null);           // R1: the HUD letter strip appears only once the car is airborne (launch event)
    if (r.missionReward) { hud.banner('mission', 'Mission complete!'); setTimeout(() => Audio.missionComplete(), 200); }
    if (!save.seen.coach) showCoach();
    else if (!paused) controls.enable(true);
  }

  // ---------- v4.0: the Spell Boost (the Sky Era's second jump you earn by spelling) ----------
  // The engine has frozen the simulation at the Spell Boost gate (nothing ticks: no timer, no countdown) and emitted `spellBoost`. The next
  // word is picked exactly like a launch word (same scheduler), spelled in the same panel (audio first, compare / fix / cover-copy-compare),
  // banked per word (mission, Leitner record, cash, XP) and then the second jump goes: first try = power 1, fixed after a miss = 0.5.
  // The engine draws the word's letters as rings along the new arc AFTER the spelling (game.boost({ power, word })), so no word is shown first.
  function unfreeze() { try { if (typeof game.freeze === 'function') game.freeze(false); } catch (e) { console.warn('[SpellJump] freeze(false)', e); } }
  async function spellBoost(r, evt) {
    if (!r || run !== r || r.ended || r.boosting) return;
    const pick = r.boostOn && words ? WS.nextWord(words, Date.now(), session, opts()) : null;
    if (!pick) { unfreeze(); return; }                                  // spell boost off for this child / no words: the flight goes on
    r.boosting = true; r.boostUsed = true;
    r.spelling = true;
    setSpelling(true);
    controls.enable(false);
    try { game.setInput({ gas: false, brake: false, nitro: false }); } catch (_) { /* ignore */ }
    Audio.engine(-1); Audio.nitro(false);
    let banked = null;
    const res = await spellPanel.run(pick, {
      onResult: (out) => { if (run === r && !r.ended) banked = recordWord(r, pick, out); },
      coinMult: r.stats.coinMult || 1, streakBefore: Math.min(WS.STREAK_CAP, words.streak),
      mission: WS.missionState(words, Date.now()), upper: opts().tileCase === 'upper', badge: 'Spell Boost',
    });
    if (!res || res.cancelled) return;                                  // quitRun ran (back button): an answered word is already banked
    if (run !== r || r.ended) return;
    const rec = banked || recordWord(r, pick, res);
    spellPanel.close();
    setSpelling(false);
    r.boosting = false; r.spelling = false;
    const power = res.firstTry ? 1 : 0.5;
    r.boosts.push({ word: pick.word, power, firstTry: !!res.firstTry, fixed: !!res.fixed, misses: res.misses || 0, bonus: rec.bonus || 0 });
    try { if (typeof game.boost === 'function') game.boost({ power, word: pick.word }); } catch (e) { console.warn('[SpellJump] game.boost', e); }
    unfreeze();
    if (coaching) return;
    if (!paused) controls.enable(true);
  }
  /** The second jump's distance in metres: the engine's summary.boost.distance (metres the boost added vs the unboosted arc) summed over the race's levels; null when no boost was used. */
  function boostMeters(r, summary) {
    const sums = [...r.levelDone.map((l) => l.summary), summary].filter(Boolean);
    let total = 0, any = false;
    for (const sm of sums) {
      const b = sm.boost;
      if (b && b.used && Number.isFinite(Number(b.distance))) { total += Number(b.distance); any = true; }
    }
    return any ? Math.max(0, Math.round(total)) : null;
  }

  // the HUD and the driving controls hide while the spell panel is up
  function setSpelling(on) { document.documentElement.classList.toggle('spelling', !!on); }

  // leave a run from the spell panel without jumping (nothing is recorded)
  function quitRun() {
    setSpelling(false);
    if (!run) return;
    clearTimeout(run.levelTimer);
    run.ended = true;
    run = null;
    runEarned = null;
    vtts.cancel();
    try { if (typeof game.freeze === 'function') game.freeze(false); } catch (_) { /* ignore */ }
    try { game.stop(); } catch (_) { /* ignore */ }
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false); Audio.duck(false);
    achievements.endRun();
    go('garage');
  }

  // ---------- keyboard hints (coach tips, pause menu) ----------
  // a keyboard is likely with a fine pointer that can hover (a computer), or once any key was pressed this session
  let keyPressed = false;
  const fineHover = (() => { try { return matchMedia('(hover: hover) and (pointer: fine)'); } catch (_) { return null; } })();
  function paintKbd() { document.documentElement.classList.toggle('kbd', keyPressed || !!(fineHover && fineHover.matches)); }
  paintKbd();
  if (fineHover && fineHover.addEventListener) fineHover.addEventListener('change', paintKbd);
  window.addEventListener('keydown', () => { if (!keyPressed) { keyPressed = true; paintKbd(); } }, { capture: true });

  // ---------- first-run coach ----------
  function showCoach() {
    coaching = true;
    try { game.pause(); } catch (_) {}
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
    if (run && !paused) {
      controls.enable(true);
      try { game.resume(); } catch (_) {}
    }
  }
  $('#coach').addEventListener('pointerdown', dismissCoach);

  function hudLoop() {
    if (!run) return;
    hudRaf = requestAnimationFrame(hudLoop);
    let s = null;
    try { s = game.getState(); } catch (_) { /* engine between runs */ }
    if (!s) return;
    hud.update(s);
    // BIG AIR: once per flight, when the current flight passes 3 s
    if (s.phase === 'air') {
      if (!run.flight) { run.flight = true; run.bigAir = false; }
      if (!run.bigAir && (s.airTime || 0) >= 3) { run.bigAir = true; hud.banner('bigair', 'Big air!'); }
    } else run.flight = false;
    achievements.state(s);
    if (!paused && !run.spelling) {
      Audio.engine(s.phase === 'done' ? -1 : Math.min(1, (s.speedKmh || 0) / 180));
      Audio.nitro(!!(input.nitro && s.nitro > 0.01 && s.phase !== 'done'));
    }
  }

  // the Lab's combo moment (five first-try words in a row): a gold flare on the launch, the name on the engine's banner, and the voice
  function perfectLaunch(r) {
    const name = r.labMoment;
    r.labMoment = '';
    let drawn = false;
    try { drawn = typeof game.moment === 'function' && game.moment(name) === true; } catch (_) { drawn = false; }
    if (!drawn) hud.banner('moment', `${name}!`);
    setTimeout(() => { try { if (tts.available && save.settings.sound) tts.say(`${name}!`); } catch (_) { /* ignore */ } }, 500);
  }

  function onEvent(evt) {
    if (!run || !evt) return;
    switch (evt.type) {
      case 'launch':
        Audio.whoosh(); hud.banner('launch', `Launch! ${Math.round(evt.speedKmh || 0)} km/h`);
        if (run.labMoment) perfectLaunch(run);
        if (run.letters.length && !run.lettersShown) { run.lettersShown = true; hud.word(run.letters); }
        break;
      case 'flip': Audio.flip(); break;
      case 'land':
        Audio.land(evt.quality);
        if (evt.quality === 'perfect') { setTimeout(() => Audio.cheer(0.6), 120); labBridge.report({ event: 'perfect', n: 1 }); }
        break;
      case 'smash': Audio.smash(); setTimeout(() => Audio.coin(), 60); break;
      case 'finishLine':
        // the engine draws FINISH LINE! itself; the HUD only adds what is new (an unlock)
        Audio.cheer(1.2); Audio.fireworks();
        if (!run.daily) {
          const n = nextTrackId(run.trackId);
          if (n && !isUnlocked(save, n)) hud.note(`Unlocked: ${trackById(n).name}`);
        }
        break;
      // ----- v2 -----
      case 'combo':
        Audio.comboUp(evt.count);
        hud.combo(evt);
        if ((evt.mult || 0) >= 4 && !run.rampage) { run.rampage = true; hud.banner('rampage', 'Super combo ×4'); }
        break;
      case 'comboEnd': hud.comboEnd(evt); run.rampage = false; break;
      case 'explosion': Audio.explosion(evt.chain || 0); break;
      case 'finaleWhine': Audio.whine(); break;                                      // Grand Finale: the car is about to go
      case 'finale': Audio.explosion(0); hud.banner('finale', 'Grand Finale!'); break;  // ... KABOOM (+cash into stunts)
      case 'airTarget':
        if (evt.kind === 'ring') { Audio.ring(); run.rings += 1; }
        else if (evt.kind === 'coin') Audio.coin();
        else Audio.pop();                            // balloon / blimp
        break;
      case 'orbit': Audio.orbit(); hud.banner('orbit', 'Orbit!'); break;
      case 'rejump': Audio.rejump(); Audio.whoosh(); hud.banner('rejump', (evt.count || 1) > 1 ? `Rejump ×${evt.count}` : 'Rejump!'); break;
      case 'record': Audio.fanfare(); break;    // the engine's in-world NEW RECORD flag banner owns this moment
      case 'damage': Audio.clank(); break;
      // ----- v3: letter rings say their letter (SOS), the whole word in order is a WORD COMPLETE -----
      case 'letterRing':
        Audio.ring();
        if (evt.letter) setTimeout(() => vtts.sayLetter(evt.letter), 140);
        if (!evt.boost) hud.letterHit(evt.index);       // the Spell Boost word's rings are in the world only: the HUD tiles are the launch word's
        break;
      case 'wordComplete':
        if (!evt.boost) hud.wordComplete();
        hud.banner('word', 'Word complete!');
        setTimeout(() => Audio.cash(), 380);
        break;
      // ----- v4.0 Sky Era: the engine froze the scene at the Spell Boost gate; the spell panel hands the second jump back -----
      case 'spellBoost': spellBoost(run, evt).catch((e) => { console.error('[SpellJump] spell boost', e); unfreeze(); }); break;
      case 'boost': Audio.rejump(); Audio.whoosh(); hud.banner('rejump', evt.power >= 1 ? 'SPELL BOOST!' : 'Boost hop!'); break;      // the second jump goes
      case 'boostRing': Audio.ring(); break;
      case 'gravityWell': if (evt.state === 'enter') Audio.orbit(); break;     // engine: { state: 'enter' | 'exit', phase, enter, x, y, ... }
      case 'cloudSplash': Audio.pop(); break;
      case 'islandLand': Audio.land(evt.quality || 'good'); break;
      case 'finish': endRun(evt.summary); return;
      default: break;
    }
    achievements.event(evt);
    for (const g of goalEvent(save, evt)) hud.note(`Goal done: ${goalText(g)}`);
  }

  function endRun(summary) {
    if (!run || run.ended) return;
    const r = run;
    // v3.6: the finish line of a level with more to come → next level instead of the results
    if (summary && summary.finishCrossed && r.level < r.levels && !r.quitting && !r.daily && !r.mega) { advanceLevel(r, summary); return; }
    r.ended = true;
    run = null;
    clearTimeout(stopFallback);
    clearTimeout(r.levelTimer);
    const boostM = boostMeters(r, summary);        // v4.0: "Spell Boost: +X m" (the engine's own number, summed over the levels)
    if (r.levelDone.length) {
      summary = aggregateLevels(r, [...r.levelDone.map((l) => l.summary), summary || {}]);
      r.spell = aggregateSpell(r);
    } else if (summary && r.levels > 1) summary = { ...summary, levels: { reached: 1, total: r.levels, cleared: [!!summary.finishCrossed], bonus: 0 } };
    if (spellPanel.isOpen) spellPanel.cancel();
    setSpelling(false);
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false); Audio.duck(false);
    summary = summary || {};
    if (summary.rings == null && r.rings) summary = { ...summary, rings: r.rings };   // engine without v2 summary fields
    const bank = bankRun(save, r.trackId, summary, { ranked: !r.daily });
    if (!r.daily) noteJump(save, summary.distance, Date.now());   // v3.3: best jump this week (family board)
    const rating = summary.rating || ratingFor(summary, trackById(r.trackId).finish);
    achievements.summary(summary, rating);
    achievements.endRun();
    for (const g of goalSummary(save, summary)) hud.note(`Goal done: ${goalText(g)}`);
    const goals = claimGoals(save);
    let dailyReward = 0, dailyAlreadyDone = false;
    if (r.daily) {
      refreshDaily(save);
      if (save.daily.done) dailyAlreadyDone = true;
      else if (r.def.check(summary)) { save.daily.done = true; dailyReward = earn(save, r.def.reward); }
    }
    app.persist();
    pingNow('run');
    labBridge.report({ event: 'run', n: 1 });
    labSummary();
    const result = lastResult = {
      trackId: r.trackId, daily: r.daily, carId: r.carId, stats: r.stats, summary, bank, goals,
      dailyReward, dailyAlreadyDone, dailyGoalText: r.def && r.def.goal.text, dailyValue: r.def && r.def.value(summary),
      rating, achievements: r.earned, boost: r.boosts.length ? { list: r.boosts.slice(), meters: boostM } : null,
      spell: r.spell, missionReward: r.missionReward, mega: r.mega, mission: words ? WS.missionState(words, Date.now()) : null,
      eng: r.eng,
    };
    setTimeout(() => {
      go('results', result);
      if (bank.newBest || dailyReward || goals.length || (r.spell && r.spell.bonus)) Audio.cash();
      if (r.missionReward) setTimeout(() => Audio.missionComplete(), 500);
    }, paused ? 0 : 900);
    paused = false;
  }

  // ---------- pause (settings live here; no reset in the kid-facing menus) ----------
  function pause() {
    if (!run || paused || coaching) return;   // the coach already holds the run
    if (run.spelling) { vtts.cancel(); return; } // the car is parked behind the spell panel anyway
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
    if (run.pendingLevel) { startLevel(run); return; }   // the Level k! moment ran out while paused
    controls.enable(true);
    try { game.resume(); } catch (_) {}
  }
  // the pause menu's shake slider is a plain element (role="slider"), not a native <input>: the only native
  // inputs in the app live in the Parent Zone
  const shakeInput = $('#pause-shake');
  let shakeVal = 100;
  const shakeOff = () => !!save.settings.reducedMotion;
  function paintShake(v) {
    shakeVal = v;
    shakeInput.setAttribute('aria-valuenow', String(v));
    shakeInput.style.setProperty('--pct', `${v}%`);
    shakeInput.style.setProperty('--p', String(v / 100));
    $('#pause-shake-val').textContent = `${v}%`;
  }
  let paintMusicBtn = null;
  function renderPauseToggles() {
    $('#pause-sound').textContent = `Sound: ${save.settings.sound ? 'On' : 'Off'}`;
    paintMusicBtn();   // family music switch: disabled + note
    $('#pause-motion').textContent = `Motion: ${save.settings.reducedMotion ? 'Calm' : 'Full'}`;
    paintShake(save.settings.shake);
    shakeInput.setAttribute('aria-disabled', String(shakeOff()));
    shakeInput.tabIndex = shakeOff() ? -1 : 0;
    shakeInput.closest('.row').classList.toggle('is-disabled', shakeOff());
  }
  // taps / drags anywhere on the track, snapped to 5 %
  const shakeFromPointer = (e) => {
    const rect = shakeInput.getBoundingClientRect();
    const v = Math.round((Math.max(0, Math.min(1, (e.clientX - rect.left - 15) / Math.max(1, rect.width - 30))) * 100) / 5) * 5;
    if (v !== shakeVal) { setShake(v, false); renderPauseToggles(); }
  };
  shakeInput.addEventListener('pointerdown', (e) => { if (shakeOff()) return; e.preventDefault(); try { shakeInput.setPointerCapture(e.pointerId); } catch (_) {} shakeFromPointer(e); });
  shakeInput.addEventListener('pointermove', (e) => { if (shakeInput.hasPointerCapture && shakeInput.hasPointerCapture(e.pointerId)) shakeFromPointer(e); });
  shakeInput.addEventListener('pointerup', (e) => { if (shakeInput.hasPointerCapture && shakeInput.hasPointerCapture(e.pointerId)) { shakeInput.releasePointerCapture(e.pointerId); setShake(shakeVal, true); } });
  shakeInput.addEventListener('keydown', (e) => {
    if (shakeOff()) return;
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, Home: -100, End: 100 }[e.key];
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    setShake(Math.max(0, Math.min(100, shakeVal + step)), true); renderPauseToggles();
  });
  $('#btn-pause').addEventListener('click', pause);
  $('#pause-resume').addEventListener('click', resume);
  $('#pause-sound').addEventListener('click', () => setSetting('sound', !save.settings.sound));
  $('#pause-music').addEventListener('click', () => setSetting('music', !save.settings.music));
  paintMusicBtn = bindMusicButton($('#pause-music'), () => save.settings.music);
  $('#pause-motion').addEventListener('click', () => setSetting('reducedMotion', !save.settings.reducedMotion));
  $('#pause-end').addEventListener('click', () => {
    if (!run) return;
    closePanel();
    const snap = (() => { try { return game.getState(); } catch (_) { return null; } })();
    const r = run;
    r.quitting = true;                 // v3.6: ending the run never starts the next level
    clearTimeout(r.levelTimer);
    try { game.resume(); game.stop(); } catch (e) { console.error(e); }
    // contract says stop() emits 'finish'; if an engine doesn't, bank what we have (only for THIS run: a quick
    // Retry may already have started the next one)
    clearTimeout(stopFallback);
    stopFallback = setTimeout(() => {
      if (!run || run !== r || r.ended) return;
      const s = snap || {};
      endRun({ distance: s.distance || 0, airTime: s.airTime || 0, flips: s.flips || 0, frontFlips: 0, backFlips: 0, smashed: s.smashed || 0,
        maxSpeedKmh: s.speedKmh || 0, landing: s.landing, finishCrossed: !!s.finishCrossed,
        cash: { distance: 0, stunts: 0, smash: 0, landing: 0, combo: 0, air: 0, total: Math.round(s.cash || 0) }, durationSec: 0 });
    }, 600);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); vtts.cancel(); Audio.suspend(); app.persist(); app.persistWords(); hero.setMode('off'); }
    else { Audio.resume(); hero.setMode(heroMode()); classListCheck('visible'); }   // v3.9.1: back to the front: maybe a new week
  });
  // iOS may kill a backgrounded Home Screen app without another event: pause and save on pagehide too
  window.addEventListener('pagehide', () => { pause(); vtts.cancel(); app.persist(); app.persistWords(); });
  window.addEventListener('keydown', (e) => {
    if (coaching && (e.code === 'Enter' || e.code === 'Space')) { dismissCoach(e); return; }
    if (e.code === 'Escape' || (e.code === 'KeyP' && run && !run.spelling)) {
      if (coaching) { dismissCoach(e); return; }
      if (pz.isOpen) { pz.close(); return; }
      if (run && !run.spelling) { paused ? resume() : pause(); e.preventDefault(); }
      else if (!$$('.modal').every((m) => m.hidden)) closePanel();
    }
  });

  // ---------- navigation wiring ----------
  $('#btn-play').addEventListener('click', () => { if (words && WS.qualifierDue(words)) startTest('qualifier'); else go('garage'); });
  $('#btn-friday').addEventListener('click', () => startTest('friday'));
  $('#btn-parents').addEventListener('click', () => pz.open(currentPlayerId));
  $('#btn-sky').addEventListener('click', () => { if (currentPlayerId && screen === 'title' && !sky.isOpen) playSky({ kind: 'full', step: skyRoadSteps(save) }); });
  $('#btn-player').addEventListener('click', () => go('players'));
  $('#btn-streak').addEventListener('click', () => openPanel('streak'));
  $('#btn-crates').addEventListener('click', () => { if (!crates.busy) crates.open(() => { refreshEngagement(); refreshCash(); }); });
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  for (const b of $$('[data-open]')) b.addEventListener('click', () => openPanel(b.dataset.open));
  for (const b of $$('[data-close]')) b.addEventListener('click', closePanel);
  for (const m of $$('.modal')) m.addEventListener('click', (e) => { if (e.target === m && m.dataset.panel !== 'pause') closePanel(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) Audio.click(); });

  // ---------- audio + speech unlock (first gesture anywhere) ----------
  Audio.setSound(save.settings.sound);
  const unlock = () => {
    Audio.unlock();
    tts.unlock();                 // iOS: the first speak must happen inside a tap
    Audio.setSound(save.settings.sound);
    if (!save.settings.music) Audio.music(false);
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  // ---------- iOS gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.pz textarea, .pz input, .pz pre')) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .garage-body, .tracks-body, .results-body, .pz-table-wrap, .pz-players, .tm-card, .pz textarea')) e.preventDefault();
  }, { passive: false });

  go('players');
  // self-update: reload only on a menu screen with nothing in progress; afterwards come back to the same player
  updateHooks.isSafe = () => safeToReload({ screen, running: !!run, spelling: spellPanel.isOpen, testing: screen === 'test', parentZone: pz.isOpen }) && !coaching && !sky.isOpen;
  updateHooks.notify = () => {        // above the spell panel and the Parent Zone too (plain toasts sit under them)
    const t = h('div', { class: 'toast update-note', id: 'update-note', role: 'status' }, UPDATE_NOTICE);
    $('#app').append(t);
    setTimeout(() => t.remove(), 4000);
  };
  updateHooks.beforeReload = () => {
    app.persist(); app.persistWords();
    try { if (currentPlayerId && screen !== 'players') sessionStorage.setItem(RESUME_KEY, currentPlayerId); } catch (_) { /* ignore */ }
  };
  let resumeId = null;
  try { resumeId = sessionStorage.getItem(RESUME_KEY); sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
  if (resumeId && Profiles.playerById(family, resumeId)) selectPlayer(resumeId);
  sync.start();                        // first pull after the picker is on screen (never blocks it)
  pingNow('day');                      // v3.7.2: once per device per UTC day (fire and forget)
  window.__spellJump = window.__rampRage = {
    app, hud, hero, spellPanel, testScreen, pz, tts, voice, sync, sky,
    get game() { return game; }, get run() { return run; }, get lastResult() { return lastResult; }, get coaching() { return coaching; },
    get words() { return words; }, get session() { return session; }, get screen() { return screen; }, get era() { return currentEra(save); },
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
      // hand the SW every same-origin file this page actually loaded (catches engine modules too)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[SpellJump] service worker registration failed', e));
  } catch (e) {
    console.warn('[SpellJump] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[SpellJump] boot failed', e));
