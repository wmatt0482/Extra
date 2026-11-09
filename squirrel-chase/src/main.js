// Pip's Squirrel Chase bootstrap: the family (Spell Jump's players, PIN and family code through profiles.js), family sync (the save is the 'sq' kind),
// the save, audio and the voice (natural cloud voice only, never the device voice), the shared Spell Jump spelling panel and word store, the screens
// and the case lifecycle. SPEC.md is the contract; §1 holds the rules nothing here may break: no timers, lives or pressure text, no multiple choice, no
// device voice, nothing punishes stopping, the next case never starts by itself.
// WORDS: exactly the Wagon West pattern. A sealed note asks the scheduler (wordStore.nextWord) for the next word of the child's ACTIVE list, runs it
// on Spell Jump's createSpellPanel (audio first, the word never shown before it is spelled, compare <= 3 s, fix / cover-copy-compare, letters spoken as
// typed) and banks it at once with wordStore.recordSpell into the child's own word records (profiles.writeWords), which is also the 8-word daily
// mission Spell Jump counts. The hideout sentence's list words bank the same way. The Lab only hears one flat 'case' event per closed case.
import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import * as WS from '../../spell-jump/src/spelling/wordStore.js';
import { createSession as createSpellSession } from '../../spell-jump/src/spelling/scheduler.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { $, $$, h } from '../../spell-jump/src/ui/dom.js';
import { hydrateIcons, icon } from '../../spell-jump/src/ui/icons.js';
import { createCloudVoice, cloudLetterText, sharedTexts, wordTexts } from '../../spell-jump/src/spelling/cloudVoice.js';
import { createSpellPanel } from '../../spell-jump/src/spelling/spellPanel.js';
import { createSpeech } from './meta/speech.js';
import { createQuietTts } from './meta/quietTts.js';
import { registerSquirrelChaseSync } from './meta/sync.js';
import { defaultSave, loadSave, loadSettings, loadWip, removeSave, writeSave, writeSettings, writeWip } from './meta/save.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { labBridge } from './meta/labBridge.js';
import { CASE_BY_ID, HIDEOUT_TEMPLATE_LIST, TOUR_TOTAL } from './logic/caseModel.js';
import { dayKey, nextUnopened, refreshOpened, waitingState } from './logic/pacing.js';
import { applyClose, closeRecord, newRun, reviveRun } from './logic/run.js';
import { closeReports } from './logic/payout.js';
import { buildHideout } from './logic/hideout.js';
import { activeEntries, pickMany, pickWord, recordWord } from './logic/words.js';
import { createPlayers } from './ui/players.js';
import { createHome } from './ui/home.js';
import { createAlbum } from './ui/album.js';
import { createCaseView } from './ui/caseView.js';
import { createClosed } from './ui/closed.js';
import { createParentZone } from './ui/parentZone.js';
import { skinSpellPanel } from './ui/spellSkin.js';

const VERSION = '0.1.0';
const params = new URLSearchParams(location.search);
const RESUME_KEY = 'squirrelChase.resumePlayer';   // sessionStorage: the player to come back to after an update reload
const swUsable = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw');
const nowMs = () => (typeof window.__squirrelNow === 'function' ? window.__squirrelNow() : Date.now());   // (a test hook: the smoke tests move the clock)
const MUTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

// ---------- self-update (see meta/selfUpdate.js) ----------
const updateHooks = { isSafe: () => true, notify: () => {}, beforeReload: () => {} };
const updater = createUpdateGuard({
  hadController: swUsable && !!navigator.serviceWorker.controller,
  isSafe: () => updateHooks.isSafe(),
  notify: () => updateHooks.notify(),
  reload: () => { try { updateHooks.beforeReload(); } catch (_) { /* ignore */ } location.reload(); },
});
if (swUsable) {
  window.__squirrelChaseUpdate = updater;
  navigator.serviceWorker.addEventListener('controllerchange', () => updater.onControllerChange());
}

async function boot() {
  hydrateIcons();
  const settings = loadSettings();
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  registerSquirrelChaseSync();           // <id>.sq, before the client exists
  const inUse = (k) => k === 'family' || (currentPlayerId && k === `${currentPlayerId}.sq`);
  const sync = createSyncClient({
    canApply: (k) => (inUse(k) ? screen !== 'case' : true),
    onApply: (k) => syncApplied(k),
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); },
  });
  const family = Profiles.loadFamily();
  const save = defaultSave();             // replaced in place when a player is picked (screens hold this reference)
  let currentPlayerId = null, screen = 'players';
  const saveCache = new Map();            // other players' saves while the Parent Zone shows them
  const toastsEl = $('#toasts');
  let spellSession = createSpellSession(), lastWord = '';

  // ---------- the voice: natural cloud voice or silence (never the device voice) ----------
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => { try { return currentPlayerId ? activeEntries(Profiles.loadWords(currentPlayerId)) : []; } catch (_) { return []; } }, audio: Audio });
  const tts = createQuietTts();
  tts.setCloud(cloud);
  const duck = (on) => Audio.voice(on);
  tts.setOnSpeaking(duck);
  const speech = createSpeech({ cloud, duck, enabled: () => settings.sound });
  const voiceReady = () => !!settings.sound && speech.naturalVoice();
  function applyVoice() {
    if (!currentPlayerId) return;
    const o = Profiles.playerOptions(family, currentPlayerId);
    tts.setRate(o.rate);
    cloud.setVoice(settings.sound ? (o.cloudVoice || '') : '');       // sound off: no clips, so the panel shows each word for a moment instead
  }

  // ---------- the shared spelling panel (Spell Jump's), in this game's colours ----------
  const spellRoot = $('#spell');
  const spellPanel = createSpellPanel(spellRoot, { tts, audio: Audio, onCancel: () => {} });
  skinSpellPanel(spellRoot);

  const letterTexts = (word) => Array.from(String(word || '')).map(cloudLetterText);
  /** The next list word for a sealed note, spelled on Spell Jump's panel and banked at once. Resolves { word, firstTry }, or null when the child left the panel. */
  async function askNote() {
    if (!currentPlayerId) return null;
    const d = Profiles.loadWords(currentPlayerId);
    const o = Profiles.playerOptions(family, currentPlayerId);
    const p = pickWord(d, Date.now(), spellSession, o, lastWord);
    if (!p) { toast('Ask a grown-up to add a word list in Spell Jump.'); return null; }
    if (cloud.active) await speech.ready([...wordTexts({ word: p.word, sentence: p.sentence, sayAs: p.sayAs, syllables: p.syllables }), ...letterTexts(p.word)], 9000);   // the clips are ready before the panel opens
    const res = await spellPanel.run(p, { streakBefore: Math.min(WS.STREAK_CAP, d.streak || 0), upper: o.tileCase === 'upper', mission: WS.missionState(d, Date.now()) });
    if (!res || res.cancelled) { spellPanel.close(); return null; }
    bankWord(p.word, !!res.firstTry);
    lastWord = p.word;
    spellPanel.close();
    return { word: p.word, firstTry: !!res.firstTry };
  }
  /** One retrieval into the child's own word records (the same call Spell Jump makes), and the shared daily mission with it. */
  function bankWord(word, firstTry) {
    try {
      const d = Profiles.loadWords(currentPlayerId);
      const r = recordWord(d, word, firstTry, Date.now(), spellSession);
      Profiles.writeWords(currentPlayerId, d);
      if (r && r.missionJustDone) toast("Today's 8-word spelling mission is done!");
      return r;
    } catch (e) { console.warn('[SquirrelChase] recordSpell', e); return null; }
  }
  /** The dictation for the hideout: 2 or 3 of the active list's words, in a sentence from the list or a template. */
  function planHideout(run) {
    const d = Profiles.loadWords(currentPlayerId);
    const o = Profiles.playerOptions(family, currentPlayerId);
    const picks = pickMany(d, Date.now(), spellSession, o, 3, run.words || []);
    return buildHideout(picks, activeEntries(d), HIDEOUT_TEMPLATE_LIST);
  }
  async function bankHideout(perWord) {
    for (const { word, ok } of perWord) { bankWord(word, ok); lastWord = word; }
  }
  /** The clips this case will need first, asked for in small batches (never the whole list): the next few words and the letters. */
  function prepareCaseVoice() {
    if (!currentPlayerId || !cloud.active) return;
    try {
      const d = Profiles.loadWords(currentPlayerId);
      const picks = pickMany(d, Date.now(), spellSession, Profiles.playerOptions(family, currentPlayerId), 6);
      speech.prepareBulk([...sharedTexts().filter((t) => /^[A-Z]$/.test(t)), ...picks.flatMap((p) => wordTexts({ word: p.word, sentence: p.sentence, sayAs: p.sayAs, syllables: p.syllables }))]);
    } catch (e) { console.warn('[SquirrelChase] prepareCaseVoice', e); }
  }

  const app = {
    save, settings, sync, audio: Audio, speech, cloud, tts, icon, version: VERSION, caseById: CASE_BY_ID,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get playerId() { return currentPlayerId; },
    get screen() { return screen; },
    currentPlayer: () => Profiles.playerById(family, currentPlayerId),
    today: () => dayKey(nowMs()),
    persist: () => writeSave(currentPlayerId, save),
    persistWip: (run) => writeWip(currentPlayerId, run),
    hasWip: (id) => { const w = loadWip(currentPlayerId); return !!w && w.caseId === id && w.phase !== 'brief'; },
    voiceReady,
    /** The words: the sealed notes' spelling, the hideout plan and its banking (all through Spell Jump's store). */
    words: { askNote, planHideout, bankHideout },
    speakHideout: (sentence) => (voiceReady() ? speech.say(sentence) : Promise.resolve(null)),
    prepareHideoutVoice: (sentence) => { if (cloud.active) speech.prepareBulk([sentence, ...sharedTexts().filter((t) => /^[A-Z]$/.test(t))]); },
    voiceStatus() {
      if (!settings.sound) return 'Sound is off on this device.';
      return cloud.active ? `Natural voice on for this player. ${cloud.statusText()}` : 'No natural voice is chosen for this player, or no family code yet. Squirrel Chase stays quiet: each word is shown for a moment, then covered. ' + cloud.statusText();
    },
    // ----- any player's data (picker, Parent Zone) -----
    saveOf(id) {
      if (id === currentPlayerId) return save;
      if (!saveCache.has(id)) saveCache.set(id, loadSave(id));
      return saveCache.get(id);
    },
    closedCount: (id) => Object.keys(app.saveOf(id).closed).length,
    nextCaseTitleFor(id) { const n = nextUnopened(app.saveOf(id)); return n ? CASE_BY_ID[n].title : ''; },
    openNextNow(id) {
      const s = app.saveOf(id);
      s.nextEarly = true; refreshOpened(s, app.today()); writeSave(id, s);
    },
    removePlayer(id) {
      Profiles.removePlayer(family, id); removeSave(id); saveCache.delete(id);
      if (id === currentPlayerId) { currentPlayerId = null; replaceInPlace(save, defaultSave()); }
    },
    createPlayer: (name, color) => Profiles.createPlayer(family, name, color),
    openParents: (opts) => pz.open(opts),
    go, toast, selectPlayer, setSetting, openCase, finishCase,
    onFamilyChanged() { if (screen === 'home') screens.home.show(); },
    onParentZoneClosed() {
      saveCache.clear();
      if (currentPlayerId) { applyVoice(); refreshOpened(save, app.today()); }
      if (!currentPlayerId || screen === 'players') go('players');
      else if (screen === 'home') screens.home.show();
      setTimeout(() => updater.check(), 0);
    },
    labPickerButton: (mount) => labBridge.mountPickerButton(mount),
  };

  // ---------- UI ----------
  const playersUI = createPlayers(app);
  const homeUI = createHome(app);
  const albumUI = createAlbum(app);
  const caseView = createCaseView(app);
  const closedUI = createClosed(app);
  const screens = { players: playersUI.players, newplayer: playersUI.newplayer, home: homeUI.home, album: albumUI.album, case: caseView, closed: closedUI };
  const pz = createParentZone(app);
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };

  // ---------- The Lab: the player, the chip (home), the XP pill (closed; the Lab's results strip is left out: it speaks its own lines, and here only the spelling words and the hideout sentence are spoken). Never during a case. ----------
  let labPlayer = null, labMounts = [];
  function labAttach() {
    if (!currentPlayerId) return;
    const p = Profiles.playerById(family, currentPlayerId);
    if (!p) return;
    labPlayer = currentPlayerId;
    labBridge.attach({ playerId: p.id, name: p.name, color: p.color, gentle: false, reducedMotion: !!settings.reducedMotion, sound: !!settings.sound });
  }
  function labDetach() { if (labPlayer) { labPlayer = null; labBridge.detach(); } }
  const LAB_SLOTS = { home: [['chip', '#lab-slot-home', false]], closed: [['hud', '#lab-slot-closed-pill', true]] };
  function labMount(name) {
    for (const m of labMounts.splice(0)) { try { m.destroy(); } catch (_) { /* ignore */ } }
    for (const el of $$('.lab-slot')) el.replaceChildren();
    if (!currentPlayerId || !LAB_SLOTS[name]) return;
    for (const [kind, sel, compact] of LAB_SLOTS[name]) {
      const mount = $(sel);
      if (!mount) continue;
      if (kind === 'chip') labMounts.push(labBridge.mountChip(mount, { compact: window.innerWidth < 520, theme: 'dark', current: 'sq' }));
      else labMounts.push(kind === 'hud' ? labBridge.hud({ mount, compact }) : labBridge.results({ mount }));
    }
  }
  /** This game's card on the Lab home: "Chaser: n cases", "NY tour: n / 6", today's case ("New case ready" / "Next case tomorrow"). */
  function labSummary() {
    if (!labPlayer) return;
    try {
      const n = Object.keys(save.closed || {}).length;
      const w = waitingState(save);
      labBridge.summary({ level: `Chaser: ${n} ${n === 1 ? 'case' : 'cases'}`, line: `NY tour: ${n} / ${TOUR_TOTAL}`,
        today: w === 'open' ? 'New case ready' : w === 'tomorrow' ? 'Next case tomorrow' : 'All cases closed' });
    } catch (_) { /* never in the way */ }
  }

  // ---------- players ----------
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    currentPlayerId = id;
    replaceInPlace(save, loadSave(id));
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    refreshOpened(save, app.today());
    app.persist();
    spellSession = createSpellSession(); lastWord = '';
    applyVoice();
    labAttach();
    go('home');
  }

  // Ghost-click guard (same as the other games): swallow a click that lands just after a screen change when its pointerdown came before it
  let lastGo = 0, lastDown = 0;
  document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, true);
  document.addEventListener('click', (e) => { const t = performance.now(); if (lastDown < lastGo && t - lastGo < 500) { e.preventDefault(); e.stopPropagation(); } }, true);

  function go(name, arg) {
    lastGo = performance.now();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    document.documentElement.dataset.screen = name;
    if (name === 'players') labDetach();
    if (name === 'home') { refreshOpened(save, app.today()); app.persist(); const p = app.currentPlayer(); $('#home-player').textContent = p ? p.name : ''; labSummary(); }
    if (screens[name]) screens[name].show(arg);
    labMount(name);
    drawCaseSound();
    setTimeout(() => updater.check(), 0);
  }
  function toast(text) {
    const t = h('div', { class: 'toast' }, text);
    toastsEl.append(t);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
    setTimeout(() => t.remove(), 2900);
  }

  // ---------- settings (this device) ----------
  function setSetting(key, value) {
    settings[key] = !!value;
    writeSettings(settings);
    if (key === 'sound') { Audio.setSound(settings.sound); if (!settings.sound) speech.cancel(); applyVoice(); drawCaseSound(); if (labPlayer) labAttach(); }
    if (key === 'reducedMotion') { document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion); if (labPlayer) labAttach(); }
  }
  function drawCaseSound() {
    const b = $('#case-sound');
    if (!b) return;
    b.innerHTML = settings.sound ? icon('sound') : MUTE_ICON;
    b.setAttribute('aria-pressed', String(!!settings.sound));
    b.setAttribute('aria-label', settings.sound ? 'Sound on' : 'Sound off');
  }
  $('#case-sound').addEventListener('click', () => setSetting('sound', !settings.sound));

  // ---------- family sync: newer data from another device ----------
  function syncApplied(k) {
    const m = /^([a-z0-9_-]{1,32})\.sq$/.exec(k);
    if (m) {
      const id = m[1];
      saveCache.delete(id);
      if (id === currentPlayerId) {
        replaceInPlace(save, loadSave(id));
        if (refreshOpened(save, app.today()).length) app.persist();
        if (screen === 'home') screens.home.show(); else if (screen === 'album') screens.album.show();
      } else if (screen === 'players') screens.players.show();
      pz.onSyncApplied();
      return;
    }
    if (k !== 'family') return;
    Audio.syncFamilyMusic();
    replaceInPlace(family, Profiles.loadFamily());
    if (currentPlayerId && !Profiles.playerById(family, currentPlayerId)) {
      currentPlayerId = null; replaceInPlace(save, defaultSave());
      if (!pz.isOpen) go('players');
    } else if (screen === 'players') screens.players.show();
    else if (screen === 'home') screens.home.show();
    pz.onSyncApplied();
  }

  // ---------- a case ----------
  /** Open today's case: a closed one opens the album; an open one starts, or resumes at the stop where the child left off. */
  function openCase(id) {
    const kase = CASE_BY_ID[id];
    if (!kase || !save.opened[id]) return;
    if (save.closed[id]) { go('album'); return; }
    let run = reviveRun(loadWip(currentPlayerId), kase);
    if (!run) { run = newRun(kase, nowMs()); writeWip(currentPlayerId, run); }
    prepareCaseVoice();
    go('case', { kase, run });
  }
  /** The hideout is done: save it, tell the Lab (one flat payment), show the stamp. */
  function finishCase(kase, run, result) {
    const today = app.today();
    const firstCaseToday = !Object.values(save.closed).some((r) => r.day === today);
    applyClose(save, kase, closeRecord(run, result, nowMs(), today));
    app.persist();
    writeWip(currentPlayerId, null);
    let receipt = null;
    for (const ev of closeReports({ firstCaseToday })) { const rc = labBridge.report(ev); if (ev.event === 'case') receipt = rc; }
    labSummary();
    go('closed', { kase, receipt });
  }

  // ---------- chrome ----------
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  $('#btn-player').addEventListener('click', () => go('players'));
  $('#btn-parents').addEventListener('click', () => pz.open({ tab: 'det', player: currentPlayerId }));
  $('#case-back').addEventListener('click', () => go('home'));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) Audio.click(); });

  // ---------- audio unlock (first gesture anywhere): WebAudio only, never the device speech engine ----------
  Audio.setSound(settings.sound); Audio.music(false);
  const unlock = () => { Audio.unlock(); Audio.setSound(settings.sound); Audio.music(false); };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) speech.cancel(); });

  // ---------- iOS gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.pz input, .pz textarea, .pz pre')) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .pz-players, .pz-table-wrap, .pz input')) e.preventDefault();
  }, { passive: false });

  go('players');
  updateHooks.isSafe = () => safeToReload({ screen, parentZone: pz.isOpen });
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
  sync.start();                        // first pull after the picker is on screen (never blocks it)
  window.__squirrelChase = {
    app, pz, sync, speech, cloud, tts, caseView, spellPanel,
    get screen() { return screen; }, get save() { return save; }, get run() { return caseView.run; }, get session() { return spellSession; },
  };                                   // debugging / smoke tests
  registerSW();
}

function registerSW() {
  try {
    if (!swUsable) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      return navigator.serviceWorker.ready;
    }).then((reg) => {
      // hand the SW every same-origin file this page loaded (the content modules, the shared Spell Jump modules, the Lab)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[SquirrelChase] service worker registration failed', e));
  } catch (e) {
    console.warn('[SquirrelChase] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[SquirrelChase] boot failed', e));
