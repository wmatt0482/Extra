// Case Files bootstrap: the family (Spell Jump's players, PIN and family code through profiles.js), family sync (the save is the
// 'cf' kind), the save, audio and the voice (natural cloud voice only, never the device voice), the screens and the case
// lifecycle. SPEC.md is the contract; §1 holds the rules nothing here may break: no timers, lives or pressure text, no authored
// wrong answers, no device voice, nothing punishes stopping, the next case never starts by itself, the child never sees an accuracy
// percentage or a grade.
// The Lab (src/meta/labBridge.js is the only file that knows it): one flat payment per closed case; the Lab's pill and results
// strip show on the agency home and the closed screen only, never during a case.

import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { $, $$, h } from '../../spell-jump/src/ui/dom.js';
import { hydrateIcons, icon } from '../../spell-jump/src/ui/icons.js';
import { createCloudVoice } from '../../spell-jump/src/spelling/cloudVoice.js';
import { createSpeech } from './meta/speech.js';
import { registerCaseFilesSync } from './meta/sync.js';
import { defaultSave, loadReplay, loadSave, loadSettings, loadWip, removeSave, writeReplay, writeSave, writeSettings, writeWip } from './meta/save.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { labBridge } from './meta/labBridge.js';
import { ARCS, CASE_BY_ID, TRAINING } from './content/index.js';
import { LINES } from './logic/lines.js';
import { allCoachLines } from './logic/coach.js';
import { dayKey, nextUnopened, rankLabel, refreshOpened } from './logic/pacing.js';
import { applyClose, applyReplay, closeRecord, newRun } from './logic/run.js';
import { closeReports } from './logic/payout.js';
import { caseVoiceTexts } from './meta/voiceTexts.js';
import { createPlayers } from './ui/players.js';
import { createHome } from './ui/home.js';
import { createCaseView } from './ui/caseView.js';
import { createClosed } from './ui/closed.js';
import { createFile } from './ui/file.js';
import { createModal } from './ui/modal.js';
import { createCoach } from './ui/coach.js';
import { createParentZone } from './ui/parentZone.js';
import { EXTRA_ICONS, drawBackdrop } from './ui/art.js';

const VERSION = '0.1.3';
const params = new URLSearchParams(location.search);
const RESUME_KEY = 'caseFiles.resumePlayer';   // sessionStorage: the player to come back to after an update reload
const swUsable = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw');
const nowMs = () => (typeof window.__caseFilesNow === 'function' ? window.__caseFilesNow() : Date.now());   // (a test hook: the smoke tests move the clock)

// ---------- self-update (see meta/selfUpdate.js) ----------
const updateHooks = { isSafe: () => true, notify: () => {}, beforeReload: () => {} };
const updater = createUpdateGuard({
  hadController: swUsable && !!navigator.serviceWorker.controller,
  isSafe: () => updateHooks.isSafe(),
  notify: () => updateHooks.notify(),
  reload: () => { try { updateHooks.beforeReload(); } catch (_) { /* ignore */ } location.reload(); },
});
if (swUsable) {
  window.__caseFilesUpdate = updater;
  navigator.serviceWorker.addEventListener('controllerchange', () => updater.onControllerChange());
}

async function boot() {
  hydrateIcons();
  $('.ico-archive').innerHTML = EXTRA_ICONS.archive;
  drawBackdrop($('#backdrop-svg'));
  const settings = loadSettings();
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  registerCaseFilesSync();               // <id>.cf, before the client exists
  const inUse = (k) => k === 'family' || (currentPlayerId && k === `${currentPlayerId}.cf`);
  const sync = createSyncClient({
    canApply: (k) => (inUse(k) ? screen !== 'case' : true),
    onApply: (k) => syncApplied(k),
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); },
  });
  const family = Profiles.loadFamily();
  const save = defaultSave();             // replaced in place when a player is picked (screens hold this reference)
  let currentPlayerId = null, screen = 'players', fileFrom = 'archive';
  const saveCache = new Map();            // other players' saves while the Parent Zone shows them
  const caseById = CASE_BY_ID;
  const toastsEl = $('#toasts');

  // ---------- the voice: natural cloud voice or silence ----------
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => [], audio: Audio });
  const speech = createSpeech({ cloud, duck: (on) => Audio.voice(on), enabled: () => settings.sound });
  const voiceReady = () => !!settings.sound && speech.naturalVoice();
  function applyVoice() {
    if (!currentPlayerId) return;
    cloud.setVoice(Profiles.playerOptions(family, currentPlayerId).cloudVoice || '');
  }

  const app = {
    save, settings, sync, audio: Audio, speech, cloud, icon, version: VERSION, caseById,
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get playerId() { return currentPlayerId; },
    get screen() { return screen; },
    currentPlayer: () => Profiles.playerById(family, currentPlayerId),
    today: () => dayKey(nowMs()),
    persist: () => writeSave(currentPlayerId, save),
    persistWip: (run) => (run && run.replay ? writeReplay(currentPlayerId, run) : writeWip(currentPlayerId, run)),   // a replay never overwrites the case in progress
    hasWip: (id) => { const w = loadWip(currentPlayerId); return !!w && w.caseId === id; },
    // ----- the voice -----
    voiceReady,
    // the "no voice yet" note is a partner popup (v0.1.2), not a toast
    voiceHint: () => { if (!app.modal.has('voice-hint')) app.feedback({ id: 'voice-hint', lines: [settings.sound ? LINES.noVoice : LINES.soundOff], button: 'Got it' }); },
    /** A feedback popup from the partner (v0.1.2): see src/ui/modal.js. Queued, one at a time. */
    feedback: (spec) => app.modal.show({ kind: 'feedback', who: 'partner', ...spec }),
    speak(text) { if (!voiceReady()) return Promise.resolve(null); return speech.say(text); },
    voiceStatus() {
      if (!settings.sound) return 'Sound is off on this device.';
      return cloud.active ? `Natural voice on for this player. ${cloud.statusText()}` : 'No natural voice is chosen for this player, or no family code yet. Case Files stays quiet and every word is on the screen. ' + cloud.statusText();
    },
    // ----- any player's data (picker, Parent Zone) -----
    saveOf(id) {
      if (id === currentPlayerId) return save;
      if (!saveCache.has(id)) saveCache.set(id, loadSave(id));
      return saveCache.get(id);
    },
    closedCount: (id) => Object.keys(app.saveOf(id).closed).length,
    rankFor: (id) => app.saveOf(id).rank,
    setRankFor(id, rank) { const s = app.saveOf(id); s.rank = rank; writeSave(id, s); },
    readModeFor: (id) => app.saveOf(id).readMode || 'auto',
    setReadModeFor(id, m) { const s = app.saveOf(id); s.readMode = m; writeSave(id, s); },
    readModeNow: () => (save && save.readMode) || 'auto',
    nextCaseTitleFor(id) { const n = nextUnopened(app.saveOf(id)); return n ? caseById[n].title : ''; },
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
    go, toast, selectPlayer, setSetting, openCase, openFile, finishCase, replayCase,
    onFamilyChanged() { if (screen === 'home') screens.home.show(); },
    onParentZoneClosed() {
      saveCache.clear();
      if (currentPlayerId) { applyVoice(); refreshOpened(save, app.today()); }
      if (!currentPlayerId || screen === 'players') go('players');
      else if (screen === 'home') screens.home.show();
      setTimeout(() => updater.check(), 0);
    },
    openLabHome: () => labBridge.openHome({}),
  };

  // ---------- UI ----------
  app.modal = createModal(app);
  app.coach = createCoach(app, app.modal);
  const playersUI = createPlayers(app);
  const homeUI = createHome(app);
  const caseView = createCaseView(app);
  const closedUI = createClosed(app);
  const fileUI = createFile(app);
  const screens = { players: playersUI.players, newplayer: playersUI.newplayer, home: homeUI.home, archive: homeUI.archive, file: fileUI, case: caseView, closed: closedUI };
  const pz = createParentZone(app);
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };

  // ---------- The Lab: the player, the pill (home), the results strip (closed). Never during a case. ----------
  let labPlayer = null, labMounts = [], labTimer = 0;
  function labAttach() {
    if (!currentPlayerId) return;
    const p = Profiles.playerById(family, currentPlayerId);
    if (!p) return;
    labPlayer = currentPlayerId;
    labBridge.attach({ playerId: p.id, name: p.name, color: p.color, gentle: false, reducedMotion: !!settings.reducedMotion, sound: !!settings.sound });
  }
  function labDetach() { if (labPlayer) { labPlayer = null; labBridge.detach(); } }
  const LAB_SLOTS = { home: [['hud', '#lab-slot-home', false]], closed: [['hud', '#lab-slot-closed-pill', true], ['results', '#lab-slot-closed', false]] };
  function labMount(name) {
    for (const m of labMounts.splice(0)) { try { m.destroy(); } catch (_) { /* ignore */ } }
    for (const el of $$('.lab-slot')) el.replaceChildren();
    if (!currentPlayerId || !LAB_SLOTS[name]) return;
    for (const [kind, sel, compact] of LAB_SLOTS[name]) {
      const mount = $(sel);
      if (mount) labMounts.push(kind === 'hud' ? labBridge.hud({ mount, compact }) : labBridge.results({ mount }));
    }
  }
  function showLabButton() {
    const btn = $('#btn-thelab');
    clearInterval(labTimer);
    btn.hidden = !labBridge.ready;
    if (!labBridge.ready) {
      let n = 0;
      labTimer = setInterval(() => { if (labBridge.ready) { btn.hidden = false; clearInterval(labTimer); } else if (++n > 100) clearInterval(labTimer); }, 120);
    }
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
    applyVoice();
    speech.prepareBulk(allCoachLines(save.readMode));       // the step coach cards are said in the natural voice too
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
    app.modal.clear();                                   // a popup never follows a screen change
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    document.documentElement.dataset.screen = name;
    if (name === 'players') labDetach();
    if (name === 'home') { refreshOpened(save, app.today()); app.persist(); const p = app.currentPlayer(); $('#home-player').textContent = p ? p.name : ''; showLabButton(); }
    if (screens[name]) screens[name].show(arg);
    if (name === 'home') app.coach.auto('home');          // the first time the agency home appears
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
    if (key === 'sound') { Audio.setSound(settings.sound); if (!settings.sound) speech.cancel(); drawCaseSound(); if (labPlayer) labAttach(); }
    if (key === 'reducedMotion') { document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion); if (labPlayer) labAttach(); }
  }
  function drawCaseSound() {
    const b = $('#case-sound');
    if (!b) return;
    b.innerHTML = settings.sound ? icon('sound') : EXTRA_ICONS.mute;
    b.setAttribute('aria-pressed', String(!!settings.sound));
    b.setAttribute('aria-label', settings.sound ? 'Sound on' : 'Sound off');
  }
  $('#case-sound').addEventListener('click', () => setSetting('sound', !settings.sound));

  // ---------- family sync: newer data from another device ----------
  function syncApplied(k) {
    const m = /^([a-z0-9_-]{1,32})\.cf$/.exec(k);
    if (m) {
      const id = m[1];
      saveCache.delete(id);
      if (id === currentPlayerId) {
        replaceInPlace(save, loadSave(id));
        if (refreshOpened(save, app.today()).length) app.persist();
        if (screen === 'home') screens.home.show(); else if (screen === 'archive') screens.archive.show();
      } else if (screen === 'players') screens.players.show();
      pz.onSyncApplied();
      return;
    }
    if (k !== 'family') return;
    replaceInPlace(family, Profiles.loadFamily());
    if (currentPlayerId && !Profiles.playerById(family, currentPlayerId)) {
      currentPlayerId = null; replaceInPlace(save, defaultSave());
      if (!pz.isOpen) go('players');
    } else if (screen === 'players') screens.players.show();
    else if (screen === 'home') screens.home.show();
    pz.onSyncApplied();
  }

  // ---------- a case ----------
  /** Open a case: a closed one is re-read (the file); an open one starts, or resumes where the child stopped. */
  function openCase(id) {
    const kase = caseById[id];
    if (!kase || !save.opened[id]) return;
    if (save.closed[id]) { openFile(id, 'home'); return; }
    let run = loadWip(currentPlayerId);
    if (!run || run.caseId !== id) { run = newRun(kase, save.rank); run.startedAt = nowMs(); writeWip(currentPlayerId, run); }
    // the voice for THIS case only (SPEC: never the whole game), in the order the child needs it
    speech.prepareBulk(caseVoiceTexts(kase, run.rank, save.readMode));
    go('case', { kase, run });
  }
  /** "Solve it again" on a closed case (v0.1.3): the full case as a fresh run (or the replay the child left half done). No payout, no record change. */
  function replayCase(id) {
    const kase = caseById[id];
    if (!kase || !save.closed[id]) return;
    let run = loadReplay(currentPlayerId);
    if (!run || run.caseId !== id) { run = newRun(kase, save.rank, true); run.startedAt = nowMs(); writeReplay(currentPlayerId, run); }
    speech.prepareBulk(caseVoiceTexts(kase, run.rank, save.readMode));
    go('case', { kase, run });
  }
  function openFile(id, from = 'archive') {
    const kase = caseById[id];
    if (!kase || !save.closed[id]) return;
    fileFrom = from;
    go('file', { kase, from });
  }
  /** The case is solved and the report filed: save it, tell the Lab (one flat payment), show the stamp. */
  function finishCase(kase, run, who) {
    if (run.replay) {
      // a replay: no Lab payout and no record change except `replays: n` on the closed record
      applyReplay(save, kase);
      app.persist();
      writeReplay(currentPlayerId, null);
      if (settings.reducedMotion) Audio.cash(); else Audio.fanfare();
      go('file', { kase, from: fileFrom, replayDone: true });
      return;
    }
    const today = app.today();
    const firstCaseToday = !Object.values(save.closed).some((r) => r.day === today);
    const rec = closeRecord(run, kase, who, nowMs(), today);
    applyClose(save, kase, rec, run.rank);
    app.persist();
    writeWip(currentPlayerId, null);
    let receipt = null;
    for (const ev of closeReports({ firstCaseToday })) { const rc = labBridge.report(ev); if (ev.event === 'case') receipt = rc; }
    go('closed', { kase, receipt });
  }

  // ---------- chrome ----------
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  $('#btn-player').addEventListener('click', () => go('players'));
  $('#btn-archive').addEventListener('click', () => go('archive'));
  $('#btn-parents').addEventListener('click', () => pz.open({ tab: 'det', player: currentPlayerId }));
  $('#btn-thelab').addEventListener('click', () => labBridge.openHome({ onClose: () => { if (screen === 'home') screens.home.show(); } }));
  $('#case-back').addEventListener('click', () => go('home'));
  $('#btn-help-home').addEventListener('click', () => app.coach.show('home'));
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
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.pz input, .pz textarea, .pz pre, .pz-report p')) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .modal-card, .doc-tabs, .pz-players, .pz-table-wrap, .pz input')) e.preventDefault();
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
  window.__caseFiles = {
    app, pz, sync, speech, cloud, caseView,
    get screen() { return screen; }, get save() { return save; }, get run() { return caseView.run; }, get fileFrom() { return fileFrom; },
    rankLabel, ARCS, TRAINING,
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
      // hand the SW every same-origin file this page loaded (the content modules, the shared Spell Jump modules, the Lab)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[CaseFiles] service worker registration failed', e));
  } catch (e) {
    console.warn('[CaseFiles] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[CaseFiles] boot failed', e));
