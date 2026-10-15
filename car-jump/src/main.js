// Spell Jump bootstrap: players, saves, audio + speech, engine (real or mock), screens, the spelling layer
// (spell panel before every run, Qualifier, Friday Test + Mega Run, daily mission) and the run lifecycle.
// The real engine lives at ./game/engine.js (built separately against the SPEC contract). It is imported
// dynamically so the shell keeps working — on the mock — if it is missing or broken.

import { CAR_BY_ID } from './data/cars.js';
import { TRACK_BY_ID } from './data/tracks.js';
import { resolveStats } from './data/upgrades.js';
import { Audio } from './audio.js';
import { defaultSave, loadSave, setSaveKey, wipeSave, writeSave } from './meta/save.js';
import { bankRun, earn, isUnlocked, nextTrackId, ratingFor, statsFor } from './meta/economy.js';
import { ACHIEVEMENTS, createAchievements } from './meta/achievements.js';
import { claimGoals, ensureGoals, goalEvent, goalSummary, goalText } from './meta/goals.js';
import { dailyFor, refreshDaily, todayKey } from './meta/daily.js';
import { hashString } from './meta/rng.js';
import { tts } from './spelling/tts.js';
import { createSpellPanel } from './spelling/spellPanel.js';
import { createTestScreen } from './spelling/testMode.js';
import { createSession } from './spelling/scheduler.js';
import { ringLetters } from './spelling/words.js';
import * as WS from './spelling/wordStore.js';
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
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { createSyncClient } from './sync/client.js';

const VERSION = '3.2.2';
const params = new URLSearchParams(location.search);
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
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); },
  });
  const family = Profiles.loadFamily();
  const save = defaultSave();          // replaced in place when a player is picked (screens hold this reference)
  let words = null;                    // the current player's spelling data
  let session = createSession();       // same-session re-queue (R4)
  let currentPlayerId = null;
  const wordsCache = new Map();        // other players' spelling data while the Parent Zone edits them

  const canvas = $('#game');
  const engineMod = await loadEngine();
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

  const app = {
    save,
    audio: Audio,
    tts,
    sync,
    version: VERSION,
    engineName: engineMod.name,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get words() { return words; },
    persist: () => writeSave(save),
    persistWords: () => { if (currentPlayerId && words) Profiles.writeWords(currentPlayerId, words); },
    persistFamily: () => Profiles.writeFamily(family),
    go,
    toast,
    refreshCash,
    startRun,
    closePanel,
    setSetting,
    setShake,
    resetProgress,
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
      game = engineMod.createGame(canvas, { onEvent, reducedMotion: save.settings.reducedMotion });
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
  const hero = createTitleHero($('#hero'), () => CAR_BY_ID[save.selectedCar]);
  const spellPanel = createSpellPanel($('#spell'), { tts, audio: Audio, onCancel: () => quitRun() });
  const testScreen = createTestScreen($('#screen-test'), { tts, audio: Audio });
  const pz = createParentZone(app);
  tts.setOnSpeaking((on) => Audio.voice(on));

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
    const html = `${COIN}<span>${money(save.cash)}</span>`;
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
    document.documentElement.classList.toggle('tiles-upper', o.tileCase === 'upper');
  }
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    const prevMotion = save.settings.reducedMotion;
    currentPlayerId = id;
    setSaveKey(Profiles.saveKey(id));
    replaceSave(loadSave());
    refreshDaily(save); ensureGoals(save);
    words = Profiles.loadWords(id);
    WS.rollToday(words, Date.now());
    session = createSession();
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    applyPlayerOptions();
    Audio.setSound(save.settings.sound);
    if (Audio.unlocked) Audio.music(save.settings.music);
    document.documentElement.classList.toggle('reduced-motion', save.settings.reducedMotion);
    if (prevMotion !== save.settings.reducedMotion) { try { game && game.destroy(); } catch (_) {} makeGame(); }
    achievements.checkSave();
    refreshAchBadge();
    hero.redraw();
    app.persist();
    app.persistWords();
    go('title');
  }

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
  }

  function go(name, arg) {
    closePanel();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
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
    hero.setMode(heroMode());
    refreshCash();
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
    if (key === 'sound') Audio.setSound(value);
    if (key === 'music') Audio.music(value);
    if (key === 'reducedMotion') {
      document.documentElement.classList.toggle('reduced-motion', !!value);
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
      if (id !== currentPlayerId) return;
      replaceSave(loadSave());
      refreshCash();
      refreshAchBadge();
      hero.redraw();
    } else {
      const fresh = Profiles.loadWords(id);
      if (id === currentPlayerId && words) {
        replaceInPlace(words, fresh);
        WS.rollToday(words, Date.now());
        session = createSession();
        if (screen === 'title') refreshTitle();
      }
      if (wordsCache.has(id) && wordsCache.get(id) !== words) replaceInPlace(wordsCache.get(id), fresh);
    }
    pz.onSyncApplied();
  }

  // ---------- Qualifier / Friday Test ----------
  function startTest(kind) {
    if (!words) return;
    const list = WS.activeList(words);
    const n = list.words.length;
    go('test');
    const upper = opts().tileCase === 'upper';
    const q = kind === 'qualifier';
    testScreen.run({
      kind, title: q ? 'Qualifier' : 'Friday Test', upper,
      words: list.words.map((w) => ({ word: w.word, sentence: w.sentence, sayAs: w.sayAs || '' })),
      intro: q
        ? { heading: 'New words!', lines: [`A quick check of this week's ${n} words: listen, then spell each one once.`, `Words you already know skip ahead. $${QUALIFIER_PAY} for each one you get right.`], button: 'Start' }
        : { heading: 'Friday Test', lines: [`All ${n} words. Listen and spell. No hints!`, 'Your score powers the MEGA RUN.'], button: 'Start' },
      summary(results) {
        const now = Date.now();
        const correct = results.filter((r) => r.correct).length;
        const total = results.length;
        const missed = total - correct;
        if (q) {
          WS.recordQualifier(words, results, now);
          const paid = earn(save, correct * QUALIFIER_PAY);
          app.persist(); app.persistWords();
          if (paid) Audio.cash();
          return {
            heading: correct === total ? 'You knew them all!' : 'Qualifier done!',
            lines: [h('div', { class: 'big-score', id: 'tm-score' }, `${correct} / ${total}`), `+$${money(paid)}`,
              missed ? `${missed} Focus Word${missed === 1 ? '' : 's'} to practice. Each run starts with a word!` : 'Every word skips ahead. Keep them fresh in your runs!'],
            button: "Let's go",
          };
        }
        WS.recordFriday(words, results, now);
        const score = total ? correct / total : 0;
        const paid = earn(save, correct * MEGA_PAY);
        app.persist(); app.persistWords();
        lastTest = { correct, total, score, paid };
        if (score >= 0.8) Audio.fanfare(); else Audio.cash();
        return {
          heading: score === 1 ? 'Perfect test!' : 'Test done!',
          lines: [h('div', { class: 'big-score', id: 'tm-score' }, `${correct} / ${total}`),
            `+$${money(paid)} ($${MEGA_PAY} a word) · Mega Run power ${Math.round((0.6 + 0.4 * score) * 100)}%`],
          button: 'Mega Run!',
        };
      },
    }).then(({ cancelled }) => {
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
    trackId = daily ? dailyFor(todayKey()).trackId : (TRACK_BY_ID[trackId] && isUnlocked(save, trackId) ? trackId : 'canyon');
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
    // every normal run starts with a set of words spelled from memory ("Words before each race", 1-4; the Mega
    // Run's power comes from the test). The rings get the first word's letters for now; spelledSet() restarts the
    // parked run with the ring word's letters if the set picks another one.
    const pick = !daily && !mega && words ? WS.nextWord(words, Date.now(), session, opts()) : null;
    const letters = pick ? ringLetters(pick.word) : null;
    const setSize = WS.WORDS_PER_RACE.includes(opts().wordsPerRace) ? opts().wordsPerRace : 2;
    const powerScale = mega ? 0.6 + 0.4 * mega.score : 1;
    clearTimeout(stopFallback);
    runEarned = [];
    run = {
      trackId, daily, def, carId: car.id, stats, ended: false, goalToasts: [], earned: runEarned, flight: false, bigAir: false, rampage: false, rings: 0,
      spelling: !!pick, pick, letters: letters || [], spell: null, mega, missionReward: 0, setSize, startCfg: null,
    };
    achievements.beginRun();
    go('run');
    hud.reset(track);
    hud.word(null);
    controls.reset();
    controls.enable(!pick);
    Audio.duck(true);
    try {
      // start first so the parked car is on screen behind the spell panel; the launch power is set after
      run.startCfg = {
        car, stats, track, seed,
        shake: save.settings.reducedMotion ? 0 : save.settings.shake / 100,
        bestDistance: daily ? null : (save.best[trackId] || null),
        letters, powerScale, nitroScale: 1,
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
      const res = await spellPanel.run(pick, {
        coinMult: r.stats.coinMult || 1, streakBefore: Math.min(WS.STREAK_CAP, words.streak),
        mission: WS.missionState(words, Date.now()), upper: opts().tileCase === 'upper',
        set: { index: i, count: n }, keepOpen: i < n - 1,
      });
      if (run !== r || r.ended) return;
      if (!res || res.cancelled) return;      // quitRun already ran (back button)
      done.push(recordWord(r, pick, res));
      if (i < n - 1) pick = WS.nextWord(words, Date.now(), session, opts());
    }
    spellPanel.close();
    spelled(r, done);
  }

  // one word of the set: record it, pay its bonus (and the mission reward when it completes the mission)
  function recordWord(r, pick, res) {
    const now = Date.now();
    const rec = WS.recordSpell(words, pick.word, { firstTry: res.firstTry }, now, session);
    const bonus = res.firstTry ? earn(save, res.bonus) : 0;
    const missionReward = rec.missionJustDone ? earn(save, MISSION_REWARD) : 0;
    r.missionReward += missionReward;
    app.persist(); app.persistWords();
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

  // the HUD and the driving controls hide while the spell panel is up
  function setSpelling(on) { document.documentElement.classList.toggle('spelling', !!on); }

  // leave a run from the spell panel without jumping (nothing is recorded)
  function quitRun() {
    setSpelling(false);
    if (!run) return;
    run.ended = true;
    run = null;
    runEarned = null;
    tts.cancel();
    try { game.stop(); } catch (_) { /* ignore */ }
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false); Audio.duck(false);
    achievements.endRun();
    go('garage');
  }

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

  function onEvent(evt) {
    if (!run || !evt) return;
    switch (evt.type) {
      case 'launch':
        Audio.whoosh(); hud.banner('launch', `Launch! ${Math.round(evt.speedKmh || 0)} km/h`);
        if (run.letters.length && !run.lettersShown) { run.lettersShown = true; hud.word(run.letters); }
        break;
      case 'flip': Audio.flip(); break;
      case 'land':
        Audio.land(evt.quality);
        if (evt.quality === 'perfect') setTimeout(() => Audio.cheer(0.6), 120);
        break;
      case 'smash': Audio.smash(); setTimeout(() => Audio.coin(), 60); break;
      case 'finishLine':
        // the engine draws FINISH LINE! itself; the HUD only adds what is new (an unlock)
        Audio.cheer(1.2); Audio.fireworks();
        if (!run.daily) {
          const n = nextTrackId(run.trackId);
          if (n && !isUnlocked(save, n)) hud.note(`Unlocked: ${TRACK_BY_ID[n].name}`);
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
        if (evt.letter) setTimeout(() => tts.sayLetter(evt.letter), 140);
        hud.letterHit(evt.index);
        break;
      case 'wordComplete':
        hud.wordComplete();
        hud.banner('word', 'Word complete!');
        setTimeout(() => Audio.cash(), 380);
        break;
      case 'finish': endRun(evt.summary); return;
      default: break;
    }
    achievements.event(evt);
    for (const g of goalEvent(save, evt)) hud.note(`Goal done: ${goalText(g)}`);
  }

  function endRun(summary) {
    if (!run || run.ended) return;
    const r = run;
    r.ended = true;
    run = null;
    clearTimeout(stopFallback);
    if (spellPanel.isOpen) spellPanel.cancel();
    setSpelling(false);
    controls.enable(false);
    Audio.engine(-1); Audio.nitro(false); Audio.duck(false);
    summary = summary || {};
    if (summary.rings == null && r.rings) summary = { ...summary, rings: r.rings };   // engine without v2 summary fields
    const bank = bankRun(save, r.trackId, summary, { ranked: !r.daily });
    const rating = summary.rating || ratingFor(summary, TRACK_BY_ID[r.trackId].finish);
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
    const result = lastResult = {
      trackId: r.trackId, daily: r.daily, carId: r.carId, stats: r.stats, summary, bank, goals,
      dailyReward, dailyAlreadyDone, dailyGoalText: r.def && r.def.goal.text, dailyValue: r.def && r.def.value(summary),
      rating, achievements: r.earned,
      spell: r.spell, missionReward: r.missionReward, mega: r.mega, mission: words ? WS.missionState(words, Date.now()) : null,
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
    if (run.spelling) { tts.cancel(); return; } // the car is parked behind the spell panel anyway
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
  function renderPauseToggles() {
    $('#pause-sound').textContent = `Sound: ${save.settings.sound ? 'On' : 'Off'}`;
    $('#pause-music').textContent = `Music: ${save.settings.music ? 'On' : 'Off'}`;
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
  $('#pause-motion').addEventListener('click', () => setSetting('reducedMotion', !save.settings.reducedMotion));
  $('#pause-end').addEventListener('click', () => {
    if (!run) return;
    closePanel();
    const snap = (() => { try { return game.getState(); } catch (_) { return null; } })();
    const r = run;
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
    if (document.hidden) { pause(); tts.cancel(); Audio.suspend(); app.persist(); app.persistWords(); hero.setMode('off'); } else { Audio.resume(); hero.setMode(heroMode()); }
  });
  // iOS may kill a backgrounded Home Screen app without another event: pause and save on pagehide too
  window.addEventListener('pagehide', () => { pause(); tts.cancel(); app.persist(); app.persistWords(); });
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
  $('#btn-player').addEventListener('click', () => go('players'));
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
  updateHooks.isSafe = () => safeToReload({ screen, running: !!run, spelling: spellPanel.isOpen, testing: screen === 'test', parentZone: pz.isOpen }) && !coaching;
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
  window.__spellJump = window.__rampRage = {
    app, hud, hero, spellPanel, testScreen, pz, tts, sync,
    get game() { return game; }, get run() { return run; }, get lastResult() { return lastResult; }, get coaching() { return coaching; },
    get words() { return words; }, get session() { return session; }, get screen() { return screen; },
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
