// Wagon West bootstrap (SPEC §12): the family (Spell Jump's players, PIN and family code through profiles.js), family
// sync (the save as the 'ww' kind, plus Trail Blazer's kinds so the mile markers' facts sync from here), the save,
// audio and the voice, the scene (real or mock), the screens and the leg lifecycle. SPEC.md §0–§7 is the design and §1
// holds the rules nothing here may break: nobody dies, no lives / timers / countdowns / pressure text, nothing
// punishes stopping (the journey waits at the last day), no multiple choice (every answer typed: numbers on the
// numpad, words on the keyboard), a miss shows the work and the right answer, never a wrong one left on screen.
// The scene lives at ./scene/engine.js (the Scene stream's, §11); it is imported dynamically so the app keeps working on
// the mock scene (./meta/mockScene.js) if it is missing or broken (?mock=1 forces the mock). The journey is the
// Journey stream's pure modules (§10: ./journey/sim.js, problems.js, letters.js, economy.js); the app drives them:
// tickDay once a day (a day ≈ 6 s), the marker panel on a marker (a fact from the child's Trail Blazer ladder:
// nextFact / recordAnswer on trailBlazer.<id>.facts), events, the problems (problemFor on the problem panel), the stop
// (the lookout, the river words and rope toss, the fort's store and post office), arrive / nextLeg, the results.
// Spelling goes through Spell Jump's own spell panel and word store (recordSpell on spellJump.<id>.words).

import * as Profiles from '../../spell-jump/src/spelling/profiles.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { createPinger } from '../../spell-jump/src/meta/pings.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { $, $$, h, money } from '../../spell-jump/src/ui/dom.js';
import { COIN, hydrateIcons, icon } from '../../spell-jump/src/ui/icons.js';
import { tts } from '../../spell-jump/src/spelling/tts.js';
import { createCloudVoice } from '../../spell-jump/src/spelling/cloudVoice.js';
import { createSpellPanel } from '../../spell-jump/src/spelling/spellPanel.js';
import { createKeyboard } from '../../spell-jump/src/spelling/keyboard.js';
import * as WS from '../../spell-jump/src/spelling/wordStore.js';
import { createSession as createSpellSession, noteSpelled } from '../../spell-jump/src/spelling/scheduler.js';
import { completeDay, defaultCosmetics as sjCosmetics, refreshStreak } from '../../spell-jump/src/meta/engagement.js';
import { loadFactsData, writeFactsData } from '../../trail-blazer/src/meta/save.js';
import { nextFact, recordAnswer } from '../../trail-blazer/src/facts/store.js';
import { createSession as createFactSession } from '../../trail-blazer/src/facts/scheduler.js';
import { factParts, normFact } from '../../trail-blazer/src/facts/facts.js';
import { loadSkills as loadFracSkills } from '../../fraction-fright/src/meta/save.js';
import { tierState } from '../../fraction-fright/src/skills/ladder.js';
import { fracName, fractionsOf, hashString, rngFrom, toleranceFor } from '../../fraction-fright/src/skills/items.js';
import * as Sim from './journey/sim.js';
import * as Problems from './journey/problems.js';
import * as Letters from './journey/letters.js';
import * as Economy from './journey/economy.js';
import { LEGS, LEG_BY_ID, SEASONS, SEASON_BY_ID, GOODS } from './content/legs.js';
import { COMPANION_BY_ID } from './content/companions.js';
import { LOOKOUTS } from './content/lookouts.js';
import { EVENTS, EVENT_BY_ID } from './content/events.js';
import { NATIONS, NATION_BY_ID } from './content/nations.js';
import { Sfx } from './meta/sfx.js';
import { registerWagonWestSync } from './meta/sync.js';
import { addLetter, defaultSave, loadSave, loadSettings, logKind, logPlay, removeSave, writeSave, writeSettings } from './meta/save.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { STOCK, equipLook, grantLook, itemOf, rollCrate } from './ui/looks.js';
import { createPlayers } from './ui/players.js';
import { createTitle } from './ui/title.js';
import { createOutfit } from './ui/outfit.js';
import { createStore } from './ui/store.js';
import { createHud } from './ui/hud.js';
import { createMarkerPanel } from './ui/markerPanel.js';
import { createProblemPanel, spokenLine } from './ui/problemPanel.js';
import { createCard } from './ui/card.js';
import { createRiver } from './ui/river.js';
import { createPostOffice } from './ui/postOffice.js';
import { createJournal } from './ui/journal.js';
import { createResults } from './ui/results.js';
import { createParentZone } from './ui/parentZone.js';
import { skinSpellPanel } from './ui/spellSkin.js';

const VERSION = '1.0.0';
const GAME = 'wagon-west';
const params = new URLSearchParams(location.search);
const RESUME_KEY = 'wagonWest.resumePlayer';   // sessionStorage: the player to come back to after an update reload
const swUsable = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw');
// the journey API (§10): every module's exports in one place (sim.js wins a name it shares with economy.js)
const JA = { ...Economy, ...Letters, ...Problems, ...Sim };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
// tests: window.__wwScript = { daySec, beat } (a day is ~6 s; beat scales the short pauses between steps)
const script = () => window.__wwScript || {};
const dayMs = () => Math.max(40, (Number(script().daySec) || 6) * 1000);
const beat = (ms) => Math.round(ms * (Number.isFinite(Number(script().beat)) ? Number(script().beat) : 1));

// ---------- self-update (see meta/selfUpdate.js) ----------
const updateHooks = { isSafe: () => true, notify: () => {}, beforeReload: () => {} };
const updater = createUpdateGuard({
  hadController: swUsable && !!navigator.serviceWorker.controller,
  isSafe: () => updateHooks.isSafe(),
  notify: () => updateHooks.notify(),
  reload: () => { try { updateHooks.beforeReload(); } catch (_) { /* ignore */ } location.reload(); },
});
if (swUsable) {
  window.__wagonWestUpdate = updater;   // tells the index.html safety net that this module loaded
  navigator.serviceWorker.addEventListener('controllerchange', () => updater.onControllerChange());
}

async function loadScene() {
  if (params.get('mock') === '1') {
    const m = await import('./meta/mockScene.js');
    return { createScene: m.createScene, name: 'mock scene' };
  }
  try {
    const m = await import('./scene/engine.js');
    if (typeof m.createScene !== 'function') throw new Error('engine.js has no createScene export');
    return { createScene: m.createScene, name: '' };
  } catch (e) {
    console.warn('[WagonWest] Real scene (src/scene/engine.js) failed to load: using the MOCK scene.', e);
    const m = await import('./meta/mockScene.js');
    return { createScene: m.createScene, name: 'mock scene (fallback)' };
  }
}

async function boot() {
  hydrateIcons();
  const settings = loadSettings();
  document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  registerWagonWestSync();                // <id>.ww (+ Trail Blazer's <id>.tb / <id>.facts), before the client exists
  const family = Profiles.loadFamily();
  const save = defaultSave();             // replaced in place when a player is picked (screens hold this reference)
  let currentPlayerId = null;
  let facts = null;                       // the current player's Trail Blazer facts store (loaded at pick, refreshed on sync)
  let factSession = createFactSession();
  let spellSession = createSpellSession();
  let screen = 'players', paused = false, T = null, mini = null, storeKinds = 0, pendingDone = null;
  const toastsEl = $('#toasts');
  const panelOpen = () => markerPanel.isOpen || problemPanel.isOpen || spellPanel.isOpen || card.isOpen || !!mini;
  const inUse = (k) => k === 'family' || (currentPlayerId && [`${currentPlayerId}.ww`, `${currentPlayerId}.facts`, `${currentPlayerId}.words`].includes(k));
  const sync = createSyncClient({
    canApply: (k) => (inUse(k) ? !T && !panelOpen() && !['store', 'river', 'post', 'stop', 'home'].includes(screen) : true),
    onApply: (k) => syncApplied(k),
    onStatus: () => { playersUI.refreshSyncChip(); pz.onSyncStatus(); },
  });
  // the anonymous lights-on counter (Spell Jump's src/meta/pings.js): 'day' / 'leg', no names or ids
  const pingNow = createPinger(GAME, { version: VERSION, getCode: () => sync.code });
  const canvas = $('#scene');
  const sceneMod = await loadScene();
  let scene = null;

  const app = {
    save, settings, sync,
    audio: Audio, sfx: Sfx, tts, icon,
    version: VERSION,
    ping: pingNow,
    get sceneName() { return sceneMod.name; },
    /** What the screens may ask of the scene (guarded: a scene error never stops the journey). */
    get scene() { return { setBackdrop: (b) => S('setBackdrop', b), celebrate: (k) => S('celebrate', k) }; },
    get family() { return family; },
    get currentPlayerId() { return currentPlayerId; },
    get player() { return Profiles.playerById(family, currentPlayerId); },
    get screen() { return screen; },
    legs: LEGS,
    legById: (id) => LEG_BY_ID[id] || null,
    beat,
    overlayOpen: () => panelOpen() || pz.isOpen || !$('#panel-pause').hidden,
    persist: () => writeSave(currentPlayerId, save),
    saveOf: (id) => (id === currentPlayerId ? save : loadSave(id)),
    /** "Leg 3 of 12 · 1847" for the picker tile and the Parent Zone. */
    whereFor(id) {
      const s = app.saveOf(id), J = s.journey;
      if (!J) return 'Ready to pack the wagon';
      if (J.done) return `In the valley · ${app.seasonOf(J).year}`;
      return `Leg ${(J.legIndex || 0) + 1} of ${LEGS.length} · ${app.seasonOf(J).year}`;
    },
    season: () => app.seasonOf(save.journey),
    seasonOf: (J) => SEASON_BY_ID[J && J.season] || SEASONS[0],
    paintColor: () => (itemOf('paint', save.cosmetics.equipped.paint) || itemOf('paint', STOCK.paint)).color,
    weekWords() { if (!currentPlayerId) return 0; try { return WS.activeList(Profiles.loadWords(currentPlayerId)).words.length; } catch (_) { return 0; } },
    tokens: () => num(save.journey && save.journey.tokens),
    partyEditable() { const J = save.journey; return !!J && !J.done && !num(J.legIndex) && !num(J.milesDone) && !num(J.day) && !save.trip; },
    voiceInfo(id) {
      const o = Profiles.playerOptions(family, id);
      return { rate: o.rate, voiceName: o.voiceName || '', cloudVoice: o.cloudVoice || '', synced: !!sync.code, available: tts.available };
    },
    /** Read a line aloud (a voice available). Returns the speech promise. */
    say(text) { if (!tts.available || !text) return Promise.resolve(null); try { tts.cancel(); return Promise.resolve(tts.say(text)).catch(() => null); } catch (_) { return Promise.resolve(null); } },
    /** Say a line and wait for it (at most 8 s), and at least minMs. */
    sayWait(text, minMs = 0) { return Promise.all([Promise.race([app.say(text), sleep(8000)]), sleep(minMs)]); },
    spoken: (text) => spokenLine(text),
    go, toast, refreshCash, selectPlayer, setSetting, hitTrail, newSeason,
    createPlayer: (name, color) => Profiles.createPlayer(family, name, color),
    openParents: (opts) => pz.open(opts),
    removePlayer(id) {
      Profiles.removePlayer(family, id);      // tombstoned in the family record: removed on every device, every game
      removeSave(id);
      if (id === currentPlayerId) { currentPlayerId = null; replaceInPlace(save, defaultSave()); }
    },
    resetSaveFor(id) {
      const fresh = defaultSave();
      fresh.resetAt = Date.now();             // a stamped fresh save, so the reset wins the sync merge everywhere
      writeSave(id, fresh);
      if (id === currentPlayerId) { stopTravel(); replaceInPlace(save, loadSave(id)); refreshCash(); }
    },
    resetJourneyFor(id) {
      const s = app.saveOf(id);
      s.journey = null; s.trip = null;
      writeSave(id, s);
      if (id === currentPlayerId) { stopTravel(); refreshCash(); }
    },
    onFamilyChanged() { if (screen === 'title') screens.title.show(); },
    onParentZoneClosed() {
      if (currentPlayerId) applyVoice();
      if (!currentPlayerId || screen === 'players') go('players');
      else if (screen === 'title') screens.title.show();
      setTimeout(() => updater.check(), 0);
    },
    // ----- outfit -----
    outfitDone,
    equipLook(kind, id) { if (equipLook(save.cosmetics, kind, id)) { app.persist(); applySceneParty(); if (kind === 'bugle' && id !== 'none') Sfx.bugle(id); } },
    buyLook(kind, id, price) {
      const J = save.journey;
      if (!J || num(J.tokens) < price || !grantLook(save.cosmetics, kind, id)) return false;
      J.tokens -= price;
      equipLook(save.cosmetics, kind, id);
      app.persist(); applySceneParty(); Audio.cash();
      toast(`${itemOf(kind, id).name}: yours!`);
      return true;
    },
    // ----- store -----
    storeGoods(leg) {
      const J = save.journey;
      try { const l = JA.storeList ? JA.storeList(leg, J.season) : null; if (Array.isArray(l) && l.length) return l; } catch (e) { console.warn('[WagonWest] storeList', e); }
      return GOODS.map((g) => ({ ...g, item: g.id }));
    },
    storeBuy,
    foodDays() {
      const J = save.journey;
      if (!J || !JA.foodNeeded) return null;
      try { const per = JA.foodNeeded(partySize(J), J.rations || 'plenty', 1); return per > 0 ? Math.floor(num(J.food) / per) : null; } catch (_) { return null; }
    },
    foodHint() {
      const J = save.journey;
      if (!J || !JA.foodToNextFort) return '';
      try { const f = JA.foodToNextFort(J); return f && f.lb ? `About ${money(f.lb)} lb gets the party to ${f.stop}${f.enough ? ': you have enough' : ''}.` : ''; } catch (_) { return ''; }
    },
    // ----- words (Spell Jump's store) -----
    pickWords, spellWords,
    legEvents: () => (save.trip ? save.trip.events.map((id) => ({ id })) : []),
    saveLetter(text, leg, letter) {
      const J = save.journey;
      addLetter(save, { at: Date.now(), leg: leg ? leg.id : J && J.legId, season: J ? J.season : '', text });
      if (J && letter && typeof JA.keepLetter === 'function') { try { JA.keepLetter(J, letter); } catch (e) { console.warn('[WagonWest] keepLetter', e); } }
      app.persist();
    },
    ropeFraction,
    openCrate,
    get panels() { return { marker: markerPanel, problem: problemPanel, spell: spellPanel, card }; },
  };

  // ---------- scene ----------
  function makeScene() {
    try { scene = sceneMod.createScene(canvas, { onEvent: onSceneEvent, reducedMotion: settings.reducedMotion }); } catch (e) { console.error('[WagonWest] createScene threw', e); scene = null; }
  }
  makeScene();
  if (!scene && sceneMod.name === '') {
    console.warn('[WagonWest] Real scene threw on create: using the MOCK scene.');
    const m = await import('./meta/mockScene.js');
    sceneMod.createScene = m.createScene; sceneMod.name = 'mock scene (fallback)';
    makeScene();
  }
  // every scene call is guarded: a scene error never stops the journey
  function S(fn, ...a) { if (!scene || typeof scene[fn] !== 'function') return undefined; try { return scene[fn](...a); } catch (e) { console.error(`[WagonWest] scene.${fn} threw`, e); return undefined; } }

  // ---------- UI ----------
  const playersUI = createPlayers(app);
  const hud = createHud({ onPace, onRations });
  const markerPanel = createMarkerPanel($('#panel-marker'), { tts, audio: Audio, sfx: Sfx });
  const problemPanel = createProblemPanel($('#panel-problem'), { tts, audio: Audio, sfx: Sfx });
  const card = createCard($('#card'), { say: (t) => app.say(t), canSay: () => tts.available });
  const spellRoot = $('#spell');
  const spellPanel = createSpellPanel(spellRoot, { tts, audio: Audio, onCancel: () => {} });
  const spellSkin = skinSpellPanel(spellRoot);
  const store = createStore(app);
  const river = createRiver(app);
  const postOffice = createPostOffice(app);
  const results = createResults(app);
  const homeUI = createHome();
  const screens = {
    players: playersUI.players, newplayer: playersUI.newplayer, title: createTitle(app), outfit: createOutfit(app), store,
    trail: { show() {}, hide() {} }, stop: { show() {}, hide() {} }, river, post: postOffice, journal: createJournal(app), results, home: homeUI,
  };
  // the voice: Spell Jump's tts, with the natural voice when the family has a code and the player picked one in Spell Jump
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => { try { return currentPlayerId ? WS.activeList(Profiles.loadWords(currentPlayerId)).words : []; } catch (_) { return []; } }, audio: Audio });
  tts.setCloud(cloud);
  tts.setOnSpeaking((on) => Audio.voice(on));
  function applyVoice() {
    if (!currentPlayerId) return;
    const o = Profiles.playerOptions(family, currentPlayerId);
    tts.setRate(o.rate);
    tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
    cloud.setVoice(o.cloudVoice || '');
  }
  const pz = createParentZone(app);

  function refreshCash() {
    const J = save.journey;
    const html = `${COIN}<span>$${money(J ? J.cash : 0)}</span>`;
    for (const el of $$('[data-cash]')) el.innerHTML = html;
  }
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };
  const partySize = (J) => { try { if (JA.partySize) return JA.partySize(J); } catch (_) { /* below */ } return ((J.party && J.party.length) || 3) + 1; };
  const curLeg = () => { const J = save.journey; if (!J) return null; try { if (JA.currentLeg) { const l = JA.currentLeg(J); if (l) return LEG_BY_ID[l.id] || l; } } catch (_) { /* below */ } return LEG_BY_ID[J.legId] || LEGS[num(J.legIndex)] || null; };

  // ---------- players ----------
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    stopTravel();
    currentPlayerId = id;
    replaceInPlace(save, loadSave(id));
    facts = loadFactsData(id);
    factSession = createFactSession();
    spellSession = createSpellSession();
    refreshStreak(save, Date.now());
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    app.persist();
    applyVoice();
    applySceneParty();
    go('title');
  }

  // Ghost-click guard (same as the other games): swallow a click that lands just after a screen change when its
  // pointerdown came before the change
  let lastGo = 0, lastDown = 0;
  document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, true);
  document.addEventListener('click', (e) => { const t = performance.now(); if (lastDown < lastGo && t - lastGo < 500) { e.preventDefault(); e.stopPropagation(); } }, true);

  const STAGE_SCREENS = ['trail', 'stop', 'store', 'river', 'post', 'results', 'home'];
  function go(name, arg) {
    lastGo = performance.now();
    closePause();
    if (name !== 'trail' && T) stopTravel();
    if (!['stop', 'store', 'river', 'post', 'home'].includes(name)) { if (store.isOpen) store.leave(); }
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    document.documentElement.dataset.screen = name;
    if (name === 'trail' || name === 'results') toastsEl.replaceChildren();
    $('#stage').hidden = !STAGE_SCREENS.includes(name);
    $('#backdrop').hidden = STAGE_SCREENS.includes(name);
    if (STAGE_SCREENS.includes(name)) { S('resize'); S('play'); } else S('pause');
    if (screens[name]) screens[name].show(arg);
    refreshCash();
    setTimeout(() => updater.check(), 0);
  }
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
    if (key === 'hunting' && save.journey && typeof JA.setHunting === 'function') { try { JA.setHunting(save.journey, settings.hunting); app.persist(); } catch (_) { /* ignore */ } }
    if (key === 'reducedMotion') {
      document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
      if (scene && typeof scene.setReducedMotion === 'function') S('setReducedMotion', settings.reducedMotion);
      else if (!T && !mini) { S('destroy'); makeScene(); applySceneParty(); }
    }
    renderPauseToggles();
  }

  // ---------- family sync: newer data from another device ----------
  function syncApplied(k) {
    const m = /^([a-z0-9_-]{1,32})\.([a-z]+)$/.exec(k);
    if (m) {
      const [, id, kind] = m;
      if (id === currentPlayerId) {
        if (kind === 'ww') { replaceInPlace(save, loadSave(id)); refreshCash(); applySceneParty(); if (['title', 'journal'].includes(screen)) screens[screen].show(); }
        if (kind === 'facts') facts = loadFactsData(id);
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
    else if (screen === 'title') screens.title.show();
    pz.onSyncApplied();
  }

  // ---------- the scene's look ----------
  function applySceneParty() {
    const J = save.journey;
    if (!J) return;
    const hat = save.cosmetics.equipped.hat;
    const ids = (J.companions && J.companions.length ? J.companions : (J.party || []).map((p) => p.id)).slice(0, 3);
    S('setParty', {
      animal: J.animal,
      companions: ids.map((id, i) => { const c = COMPANION_BY_ID[id] || { hat: 'wide', color: '#d9653b' }; return { id, hat: i === 0 && hat !== 'none' ? hat : c.hat, color: c.color }; }),
      wagon: { paint: app.paintColor(), flag: save.cosmetics.equipped.flag, name: J.wagonName || '' },
    });
  }
  const backdropFor = (leg) => ({ river: 'river', fort: 'fort', landmark: 'landmark', home: 'valley' }[leg && leg.stop && leg.stop.kind] || 'landmark');

  // ---------- outfit → the Independence store → the trail ----------
  async function outfitDone(draft, { fresh }) {
    const old = save.journey;
    if (fresh || !old) {
      const season = (old && old.done && pendingSeasonId()) || (old ? old.season : SEASONS[0].id);
      save.journey = JA.createJourney({ season, wagonName: draft.wagonName, animal: draft.animal, companions: draft.companions, seed: hashString(`${currentPlayerId}:${Date.now()}`) });
      save.trip = null;
      if (typeof JA.setHunting === 'function') try { JA.setHunting(save.journey, settings.hunting !== false); } catch (_) { /* ignore */ }
      app.persist();
      applySceneParty();
      await independenceStore();
      return;
    }
    const J = old;
    const partyChanged = J.animal !== draft.animal || String(J.companions || []) !== String(draft.companions);
    if (partyChanged && app.partyEditable()) {
      // nothing has happened on the trail yet: the journey is made again with the new party (the store's buys kept)
      const keep = { cash: J.cash, food: J.food, parts: J.parts, goods: J.goods, tokens: J.tokens };
      const n = JA.createJourney({ season: J.season, wagonName: draft.wagonName, animal: draft.animal, companions: draft.companions, seed: J.seed });
      for (const [k, v] of Object.entries(keep)) if (v !== undefined) n[k] = v;
      save.journey = n;
    } else J.wagonName = draft.wagonName;
    app.persist();
    applySceneParty();
    go('title');
  }
  function pendingSeasonId() {
    const J = save.journey;
    const i = SEASONS.findIndex((s) => s.id === (J && J.season));
    return SEASONS[Math.min(SEASONS.length - 1, i + 1)].id;
  }
  async function independenceStore() {
    const J = save.journey;
    S('setBackdrop', 'fort');
    let leg = null;
    try { leg = JA.storeLeg ? JA.storeLeg(J) : null; } catch (_) { leg = null; }
    const ok = await store.open({ leg, place: (LEGS[0] && LEGS[0].from) || 'Independence', nextText: 'Hit the trail' });
    if (ok) hitTrail();
  }

  // ---------- the store ----------
  /** A fact from the child's ladder with the operation a problem needs ('x' or '/'), or null (problemFor picks). */
  function ladderPick(op = 'any') {
    if (!facts) return null;
    let p = null;
    try { p = nextFact(facts, Date.now(), factSession); } catch (e) { console.warn('[WagonWest] nextFact', e); p = null; }
    if (!p || !p.fact) return null;
    if (op === 'any') return p;
    const fp = factParts(p.fact);
    if (!fp) return null;
    if (fp.op === op) return p;
    if (fp.op === 'x' && op === '/') return { ...p, fact: `${fp.a * fp.b}/${fp.b}`, converted: true };
    if (fp.op === '/' && op === 'x') return { ...p, fact: `${fp.b}x${fp.a / fp.b}`, converted: true };
    return null;
  }
  /** Record an answer in the child's Trail Blazer facts store (the shared ladder). */
  function recordFact(fact, res, pick = null) {
    if (!facts || !fact) return;
    try {
      recordAnswer(facts, fact, { correct: !!res.correct, quick: !!res.quick, fixed: !!res.fixed, ms: num(res.ms), given: res.given ?? null, scout: pick && pick.reason === 'scout' ? pick.family : undefined }, Date.now(), factSession);
      writeFactsData(currentPlayerId, facts);
    } catch (e) { console.warn('[WagonWest] recordAnswer', e); }
  }
  /** The problem's fact when it is one the ladder knows (a table fact, or the ladder's own pick), canonical; else null. */
  function ladderFactOf(p, pick) {
    const k = p && typeof p.fact === 'string' ? normFact(p.fact) : null;
    if (!k) return null;
    if (pick && normFact(pick.fact) === k) return k;
    const fp = factParts(k);
    if (!fp) return null;
    if (fp.op === 'x') return fp.a >= 1 && fp.b <= 12 && fp.a <= 12 ? k : null;
    if (fp.op === '/') return fp.b >= 1 && fp.b <= 12 && fp.a / fp.b <= 12 ? k : null;
    return null;
  }
  async function storeBuy(good, leg) {
    const J = save.journey;
    if (!J) return;
    const item = good.item || good.id;
    const kind = storeKinds++ % 2 === 0 ? 'buy' : 'divide';
    let p = null, pick = null;
    for (let tries = 0; tries < 3 && !p; tries++) {
      pick = tries < 2 ? ladderPick(kind === 'buy' ? 'x' : '/') : null;
      try { p = JA.problemFor({ kind, fact: pick ? pick.fact : null, leg, season: J.season, rand: Math.random, item }); } catch (e) { console.warn('[WagonWest] problemFor', e); p = null; }
      if (p && kind === 'buy' && num(p.answer) > num(J.cash)) p = null;
    }
    if (!p) { toast('That costs more than the cash box holds right now'); return; }
    const res = await runProblemPanel(p, { kind, title: 'General Store', chipText: good.name, pick });
    if (res.cancelled) return;
    // the goods at the fair price, whatever the answer (the math earns the token, never the supplies)
    const meta = p.meta || {};
    const qty = Math.max(1, Math.round(num(meta.qty) || num(p.qty) || (kind === 'divide' ? num(p.answer) : num((factParts(p.fact) || {}).b)) || 1));
    let price = null;
    try { price = JA.priceAt ? JA.priceAt(meta.item || item, JA.storeLeg ? JA.storeLeg(J) : leg, J.season) : null; } catch (_) { price = null; }
    if (!Number.isFinite(price) || price <= 0) price = num(meta.price) || num(good.price) || 1;
    let r = { ok: false };
    try { r = JA.buy(J, { item: meta.item || item, qty, price }); } catch (e) { console.warn('[WagonWest] buy', e); }
    if (r && r.ok) { Audio.cash(); toast(`${qty} × ${good.name} in the wagon`); } else toast('Not enough cash for that many: try another good');
    app.persist(); refreshCash();
  }

  // ---------- problems and facts on the panels ----------
  /** One problem on the problem panel, recorded everywhere (journey, report, the ladder when it holds a fact). */
  async function runProblemPanel(p, { kind, title, chipText = '', pick = null }) {
    const J = save.journey;
    const res = await problemPanel.open({ problem: p, title, chipText });
    if (res.cancelled) return res;
    try { JA.applyProblem(J, { kind, correct: !!res.correct, firstTry: !!res.correct }); } catch (e) { console.warn('[WagonWest] applyProblem', e); }
    logKind(save, kind, !!res.correct);
    logPlay(save, { problems: 1, problemsRight: res.correct ? 1 : 0 });
    const lf = ladderFactOf(p, pick);
    if (lf) recordFact(lf, { correct: res.correct, quick: false, fixed: !res.correct && res.fixed, ms: res.ms, given: res.given }, pick);
    app.persist();
    return res;
  }
  async function runProblem(kind, { title, extra = {} } = {}) {
    const J = save.journey;
    const pick = kind === 'parts' ? null : ladderPick(kind === 'divide' || kind === 'distance' ? '/' : 'x');
    let p = null;
    try { p = JA.problemFor({ kind, fact: pick ? pick.fact : null, leg: curLeg(), season: J.season, rand: (T && T.rand) || Math.random, ...extra }); } catch (e) { console.warn('[WagonWest] problemFor', e); }
    if (!p) return { cancelled: true };
    const res = await runProblemPanel(p, { kind, title, pick });
    return { ...res, problem: p };
  }
  /** A quick fact on the marker panel outside a marker (the storm's card game, the mud hole, a riddle). */
  async function runFactPanel(title) {
    const J = save.journey;
    const pick = ladderPick('any') || { fact: '6x7', flip: false };
    const res = await markerPanel.open({ fact: pick.fact, flip: !!pick.flip, title, chipText: 'Quick fact' });
    if (res.cancelled) return res;
    recordFact(pick.fact, res, pick);
    try { JA.applyProblem(J, { kind: 'fact', correct: !!res.correct, firstTry: !!res.correct }); } catch (_) { /* ignore */ }
    logKind(save, 'fact', !!res.correct);
    logPlay(save, { problems: 1, problemsRight: res.correct ? 1 : 0 });
    app.persist();
    return res;
  }
  async function runMarker(marker) {
    const J = save.journey;
    save.trip.markers += 1;
    const n = Math.max(1, Math.round(num(marker && marker.n) || save.trip.markers));
    const leg = curLeg();
    const of = Math.max(n, Math.round(num(marker && (marker.of || marker.total)) || Math.floor(((leg && leg.miles) || 150) / 30)));
    const pick = ladderPick('any') || { fact: '6x7', flip: false };
    S('setTravel', { moving: false });
    const res = await markerPanel.open({ fact: pick.fact, flip: !!pick.flip, index: n - 1, total: of });
    if (res.cancelled) return;
    recordFact(pick.fact, res, pick);
    try { JA.applyMarker(J, { correct: !!res.correct, quick: !!res.quick }); } catch (e) { console.warn('[WagonWest] applyMarker', e); }
    logPlay(save, { markers: 1, markersRight: res.correct ? 1 : 0 });
    app.persist();
    if (res.quick) toast('A tailwind! A few free miles');
    else if (!res.correct) toast('Fixed it. The wagon rolls on');
  }

  // ---------- words (Spell Jump's store, Spell Jump's panel) ----------
  /** n different words from the child's list (the river's or the letter's), picked without recording. */
  function pickWords(n) {
    if (!currentPlayerId) return [];
    const d = Profiles.loadWords(currentPlayerId);
    const opts = Profiles.playerOptions(family, currentPlayerId);
    const tmp = JSON.parse(JSON.stringify(spellSession));
    const out = [];
    for (let i = 0; i < n * 6 && out.length < n; i++) {
      let p = null;
      try { p = WS.nextWord(d, Date.now(), tmp, opts); } catch (e) { console.warn('[WagonWest] nextWord', e); }
      if (!p) break;
      noteSpelled(tmp, p.word, false);
      if (!out.some((x) => x.word === p.word)) out.push(p);
    }
    return out;
  }
  /** Run words on the spell panel, recording each (recordSpell) in the child's own word store. */
  async function spellWords(n, { picks = null, context = 'river', onWord = null } = {}) {
    const J = save.journey;
    const list = picks || pickWords(n);
    spellSkin.setContext(context);
    const opts = Profiles.playerOptions(family, currentPlayerId);
    let asked = 0, right = 0;
    for (let i = 0; i < list.length; i++) {
      if (i > 0) { const ok = await spellPanel.beat('Next word!', beat(800)); if (!ok) return { cancelled: true, asked, right }; }
      const d = Profiles.loadWords(currentPlayerId);
      const res = await spellPanel.run(list[i], { streakBefore: Math.min(WS.STREAK_CAP, d.streak || 0), upper: opts.tileCase === 'upper', set: { index: i, count: list.length }, keepOpen: i < list.length - 1 });
      if (!res || res.cancelled) { spellPanel.close(); if (asked) { try { JA.applyWords(J, { asked, right }); } catch (_) { /* ignore */ } app.persist(); } return { cancelled: true, asked, right }; }
      try { WS.recordSpell(d, list[i].word, { firstTry: !!res.firstTry }, Date.now(), spellSession); Profiles.writeWords(currentPlayerId, d); } catch (e) { console.warn('[WagonWest] recordSpell', e); }
      asked += 1; if (res.firstTry) right += 1;
      logPlay(save, { words: 1, wordsRight: res.firstTry ? 1 : 0 });
      if (onWord) try { onWord(i, res); } catch (_) { /* ignore */ }
    }
    spellPanel.close();
    try { JA.applyWords(J, { asked, right }); } catch (e) { console.warn('[WagonWest] applyWords', e); }
    app.persist();
    return { asked, right };
  }

  // ---------- the rope toss: the landing fraction and Fraction Fright's tolerance for the child's tier ----------
  function ropeFraction() {
    let skills = null;
    try { skills = loadFracSkills(currentPlayerId); } catch (_) { skills = null; }
    let t1 = 'new', t2 = 'new';
    try { if (skills) { t1 = tierState(skills, 'T1'); t2 = tierState(skills, 'T2'); } } catch (_) { /* new */ }
    const tier = t1 === 'secure' ? 'T2' : 'T1';
    const state = tier === 'T2' ? t2 : t1;
    const pool = fractionsOf(tier).filter((f) => !(f.n * 2 === f.d));     // never ½ (the line labels it already)
    const rand = rngFrom(hashString(`${currentPlayerId}:${save.journey && save.journey.legId}:${Date.now()}`));
    const f = pool[Math.floor(rand() * pool.length) % pool.length] || { n: 3, d: 4 };
    return { n: f.n, d: f.d, tol: toleranceFor(state), tier, state, say: fracName(f.n, f.d) };
  }

  // ---------- crates ----------
  function openCrate() {
    const tier = save.crates.queue.shift();
    if (!tier) return null;
    save.crates.opened += 1;
    const r = rollCrate(save.cosmetics, tier);
    if (r.kind) grantLook(save.cosmetics, r.kind, r.id);
    else if (save.journey) save.journey.cash = num(save.journey.cash) + r.cash;
    try { Audio.crateOpen(); } catch (_) { /* ignore */ }
    app.persist();
    return r;
  }

  // ---------- the trail ----------
  function hitTrail() {
    if (!currentPlayerId) { go('players'); return; }
    const J = save.journey;
    if (!J) { go('outfit', { fresh: true }); return; }
    if (J.done) { newSeason(); return; }
    const leg = curLeg();
    if (!leg) { go('title'); return; }
    if (!save.trip || save.trip.legId !== J.legId) {
      save.trip = { legId: J.legId, stage: 'trail', events: [], asked: { ration: 0, distance: 0 }, markers: 0, at: Date.now(), tokens0: num(J.tokens) };
      app.persist();
    }
    applySceneParty();
    S('setLeg', { id: leg.id, biome: leg.biome, miles: leg.miles, stop: leg.stop, river: leg.river });
    if (save.trip.stage === 'stop') { runStop(leg).catch((e) => console.error('[WagonWest] stop', e)); return; }
    S('setBackdrop', 'trail');
    go('trail');
    hud.reset();
    hud.update(J, leg, { milesDone: J.milesDone });
    S('setTravel', { milesDone: num(J.milesDone), pace: J.pace, rations: J.rations, weather: 'clear', mood: J.mood, foodLow: false, moving: false });
    const bugle = save.cosmetics.equipped.bugle;
    if (bugle && bugle !== 'none') Sfx.bugle(bugle);
    T = { leg, day: null, acc: 0, busy: false, last: 0, raf: 0, weather: 'clear', rand: rngFrom(hashString(`${currentPlayerId}:${J.legId}:${J.seed}:${J.day}`)) };
    T.raf = requestAnimationFrame(travelFrame);
    if (!save.seen.coach) {
      T.busy = true;
      const r = T;
      card.show({ kicker: 'How the trail works', title: 'Roll out!', tone: 'coach', button: "Let's roll",
        text: 'The wagon rolls on its own. Pace and rations are your two dials. At each mile marker, type one fact. Stop any time: the journey waits right here.' })
        .then(() => { save.seen.coach = true; app.persist(); if (T === r) { r.busy = false; r.last = 0; } });
    }
  }
  function stopTravel() {
    if (!T) return;
    cancelAnimationFrame(T.raf);
    T = null;
    S('setTravel', { moving: false });
    if (currentPlayerId) app.persist();
  }
  function travelFrame(ts) {
    const r = T;
    if (!r) return;
    r.raf = requestAnimationFrame(travelFrame);
    const dt = r.last ? Math.min(100, ts - r.last) : 16;
    r.last = ts;
    if (paused || r.busy || screen !== 'trail' || app.overlayOpen()) return;
    const J = save.journey;
    if (!r.day) {
      const from = num(J.milesDone);
      let res = null;
      try { res = JA.tickDay(J, { rand: r.rand }); } catch (e) { console.error('[WagonWest] tickDay threw', e); res = { arrived: num(J.milesDone) >= r.leg.miles }; }
      res = res || {};
      if (res.event && (res.event.kind === 'rest' || res.event.id === 'storm')) r.weather = 'storm';
      else if (r.weather === 'storm') r.weather = 'clear';
      else r.weather = r.rand() < 0.08 ? 'rain' : (num(J.day) % 6 === 5 ? 'dusk' : (r.leg.biome === 'mountains' && r.rand() < 0.15 ? 'snow' : 'clear'));
      if (r.rand() < 0.16) S('spotAnimal', ['prairie', 'bluffs'].includes(r.leg.biome) ? (r.rand() < 0.5 ? 'bison' : 'pronghorn') : (r.rand() < 0.5 ? 'eagle' : 'coyote'));
      r.day = { from, to: num(J.milesDone), res };
      r.acc = 0;
    }
    r.acc += dt;
    const k = Math.min(1, r.acc / dayMs());
    const m = r.day.from + (r.day.to - r.day.from) * k;
    S('setTravel', { milesDone: m, pace: J.pace, rations: J.rations, weather: r.weather, mood: J.mood, foodLow: !!r.day.res.foodLow, moving: k < 1 });
    hud.update(J, r.leg, { milesDone: m, foodLow: !!r.day.res.foodLow });
    if (k >= 1) { const d = r.day; r.day = null; afterDay(r, d).catch((e) => console.error('[WagonWest] day', e)); }
  }
  async function afterDay(r, d) {
    r.busy = true;
    app.persist();                              // every day is saved: stopping anywhere loses nothing
    const J = save.journey;
    if (d.res.marker) await runMarker(d.res.marker);
    if (T !== r) return;
    if (d.res.event) await runEvent(d.res.event);
    if (T !== r) return;
    const left = r.leg.miles - num(J.milesDone);
    if (!d.res.arrived && !save.trip.asked.distance && left <= r.leg.miles * 0.6 && left > 25) {
      save.trip.asked.distance += 1;
      await runProblem('distance', { title: 'How far?', extra: { dest: r.leg.stop ? r.leg.stop.name : r.leg.name } });
      if (T !== r) return;
    }
    hud.update(J, r.leg, { milesDone: num(J.milesDone), foodLow: !!d.res.foodLow });
    if (d.res.arrived || num(J.milesDone) >= r.leg.miles) { await arrival(r); return; }
    r.busy = false; r.last = 0;
  }
  function onPace(id) {
    const J = save.journey;
    if (!J) return;
    try { if (JA.setPace) JA.setPace(J, id); else J.pace = id; } catch (_) { J.pace = id; }
    app.persist();
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone) });
  }
  async function onRations(id) {
    const J = save.journey;
    if (!J) return;
    try { if (JA.setRations) JA.setRations(J, id); else J.rations = id; } catch (_) { J.rations = id; }
    app.persist();
    const r = T;
    if (r) hud.update(J, r.leg, { milesDone: num(J.milesDone) });
    // the first change of a leg asks the rations question (SPEC §3)
    if (r && !r.busy && save.trip && !save.trip.asked.ration) {
      save.trip.asked.ration += 1;
      r.busy = true;
      S('setTravel', { moving: false });
      await runProblem('ration', { title: `${id[0].toUpperCase()}${id.slice(1)} rations` });
      if (T === r) { r.busy = false; r.last = 0; }
    }
  }

  // ---------- events ----------
  const EVENT_BUTTON = { problem: 'Fix it', hunt: 'Grab the bow', fish: 'Cast a line', trade: 'Trade', rest: 'Deal the cards', lookout: 'What a sight', bonus: 'Yum!' };
  async function runEvent(ev) {
    const J = save.journey;
    if (!ev) return;
    save.trip.events = [...save.trip.events, String(ev.id || ev.kind)].slice(0, 8);
    app.persist();
    let kind = ev.kind;
    let text = ev.text, sayText = ev.say;
    if (kind === 'hunt' && settings.hunting === false) { kind = 'fish'; text = 'Fresh tracks by the trail, and a stream beside them. Get the fishing line out.'; sayText = text; }
    if (kind === 'lookout') S('spotAnimal', ev.animal || 'bison');
    S('setTravel', { moving: false });
    await card.show({ kicker: 'On the trail', title: ev.name || 'On the trail', text, say: sayText, tone: kind, button: EVENT_BUTTON[kind] || 'Continue' });
    if (!T) return;
    if (kind === 'problem') {
      if (ev.problem === 'parts') await runProblem('parts', { title: 'Wagon repair' });
      else await runFactPanel(ev.name || 'Quick fact');
    } else if (kind === 'rest') await runFactPanel('Card game');
    else if (kind === 'trade') await runTrade(ev);
    else if (kind === 'hunt' || kind === 'fish') await runMini(kind);
    if (!T) return;
    if (ev.fix) toast(ev.fix);
    app.persist();
  }
  async function runTrade(ev) {
    const J = save.journey;
    const nation = NATION_BY_ID[ev.nation] || NATION_BY_ID[(curLeg() || {}).nation] || NATIONS[0];
    if (nation && nation.fact) await card.show({ kicker: 'Trading post', title: `The ${nation.name} people`, text: nation.fact.text, say: nation.fact.say, tone: 'trade', button: 'Trade' });
    if (!T) return;
    let offer = null;
    try { offer = JA.tradeOffer ? JA.tradeOffer(J) : null; } catch (_) { offer = null; }
    const rate = (offer && offer.rate) || (nation && nation.trade && nation.trade.rate) || [3, 2];
    if (offer && num(offer.have) < rate[0]) { toast('Nothing to trade this time: a friendly visit'); return; }
    const pick = ladderPick('x');
    let p = null;
    try { p = JA.problemFor({ kind: 'trade', fact: pick ? pick.fact : null, leg: curLeg(), season: J.season, rand: T.rand, nation: ev.nation || (nation && nation.id), have: offer ? offer.have : undefined }); } catch (e) { console.warn('[WagonWest] problemFor trade', e); }
    if (!p) return;
    const res = await runProblemPanel(p, { kind: 'trade', title: 'Trading post', chipText: nation ? nation.name : '', pick });
    if (res.cancelled) return;
    try { JA.applyTrade(J, p.meta || { giveN: num(p.giveN), getN: num(p.getN) || num(p.answer) }); } catch (e) { console.warn('[WagonWest] applyTrade', e); }
    app.persist();
  }
  /** The bow or the fishing line: the scene runs it (it owns the pointer), the app adds the food. */
  function runMini(kind) {
    return new Promise((resolve) => {
      const J = save.journey;
      mini = { kind, lb: 0, hits: 0, resolve, done: false };
      $('#mini-text').textContent = kind === 'hunt' ? 'The bow: tap the animals' : 'The line: tap when it dips';
      $('#mini-done').textContent = kind === 'hunt' ? 'Done hunting' : 'Done fishing';
      $('#mini').hidden = false;
      // the scene owns the pointer (the canvas) and Space while it runs: no focused button may catch Space's keyup
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.documentElement.classList.add('in-mini');
      const seed = hashString(`${currentPlayerId}:${J.legId}:${J.day}`);
      if (kind === 'hunt') S('startHunt', { seed, shots: 5 }); else S('startFish', { seed, casts: 4 });
      if (!scene) finishMini();
    });
  }
  function finishMini(total = null) {
    const m = mini;
    if (!m || m.done) return;
    m.done = true;
    mini = null;
    $('#mini').hidden = true;
    document.documentElement.classList.remove('in-mini');
    const J = save.journey;
    const lb = Math.max(0, Math.round(total != null ? num(total) : m.lb));
    try { if (m.kind === 'hunt') JA.applyHunt(J, { meatLb: lb }); else JA.applyFish(J, { fishLb: lb }); } catch (e) { console.warn('[WagonWest] apply mini', e); }
    app.persist();
    toast(lb ? `+${lb} lb of food for the wagon` : 'Nothing this time. The trail has more');
    m.resolve(lb);
  }
  $('#mini-done').addEventListener('click', () => {
    if (!mini) return;
    // the scene emits nothing on endMiniGame(): it returns the summary so far
    const sum = S('endMiniGame');
    const lb = sum ? (mini.kind === 'hunt' ? sum.meatLb : sum.fishLb) : null;
    finishMini(Number.isFinite(lb) ? lb : null);
  });
  function onSceneEvent(evt) {
    if (!evt) return;
    if (evt.type === 'hunt' && mini && mini.kind === 'hunt') {
      Sfx.twang();
      if (evt.hit) { mini.lb += num(evt.meatLb); mini.hits += 1; toast('Got one!'); }
    } else if (evt.type === 'huntEnd' && mini && mini.kind === 'hunt') finishMini(Number.isFinite(evt.meatLb) ? evt.meatLb : null);
    else if (evt.type === 'fish' && mini && mini.kind === 'fish') { Sfx.plop(); mini.lb += num(evt.lb); mini.hits += 1; toast(`A ${evt.size || ''} fish!`.replace('  ', ' ')); }
    else if (evt.type === 'fishEnd' && mini && mini.kind === 'fish') finishMini(Number.isFinite(evt.fishLb) ? evt.fishLb : null);
  }

  // ---------- arriving: the stop, then the results ----------
  async function arrival(r) {
    const leg = r.leg;
    stopTravel();
    save.trip.stage = 'stop';
    app.persist();
    S('setTravel', { milesDone: leg.miles, moving: false });
    S('celebrate', 'arrived');
    Sfx.cheer();
    await runStop(leg);
  }
  async function runStop(leg) {
    const J = save.journey;
    S('setBackdrop', backdropFor(leg));
    go('stop');
    const kind = leg.stop && leg.stop.kind;
    const look = LOOKOUTS[leg.lookout] || null;
    await card.show({ kicker: 'You made it!', title: (leg.stop && leg.stop.name) || leg.name, text: look ? look.text : '', say: look ? look.say : '', sticker: leg.sticker, tone: 'lookout',
      button: kind === 'river' ? 'To the ferry' : kind === 'fort' ? 'Into the fort' : kind === 'home' ? 'Home at last' : 'Continue' });
    if (screen !== 'stop') return;
    if (kind === 'river') {
      const rr = await river.run({ leg });
      if (rr.cancelled) { if (screen === 'river') go('title'); return; }
    } else if (kind === 'fort') {
      let sl = leg;
      try { if (JA.storeLeg) sl = JA.storeLeg(J) || leg; } catch (_) { sl = leg; }
      const ok = await store.open({ leg: sl, place: leg.stop.name, nextText: 'To the post office' });
      if (!ok) return;
      const po = await postOffice.run({ leg });
      if (po.cancelled) { if (screen === 'post') go('title'); return; }
    } else if (kind === 'home') {
      const name = await homeUI.ask();
      if (name == null) return;
      save.homestead = name;
    }
    finishLeg(leg);
  }
  function finishLeg(leg) {
    const J = save.journey;
    const now = Date.now();
    let a = null;
    try { a = JA.arrive(J); } catch (e) { console.error('[WagonWest] arrive threw', e); }
    a = a || { stars: [true, false, false], cash: { arrival: 0, stars: 0, total: 0 }, sticker: leg.sticker, crate: null };
    const stats = { ...(J.legStats || {}) };
    const stars = (a.stars || []).slice(0, 3).map(Boolean);
    while (stars.length < 3) stars.push(false);
    const sticker = a.sticker || leg.sticker;
    if (sticker && sticker.id && !save.stickers.includes(sticker.id)) save.stickers.push(sticker.id);
    if (a.crate) { save.crates.queue.push(['bronze', 'silver', 'gold'].includes(a.crate) ? a.crate : 'bronze'); save.crates.earned += 1; }
    // the streak (Spell Jump's rule): a day counts once a leg is finished; a milestone adds a crate
    const proxy = { streak: save.streak, crates: { earned: 0, opened: 0 }, cosmetics: sjCosmetics(), xp: 0 };
    try { const out = completeDay(proxy, now); save.streak = proxy.streak; if (out.crates) { save.crates.queue.push('silver'); save.crates.earned += 1; toast(`${out.count}-day streak! A crate`); } } catch (e) { console.warn('[WagonWest] streak', e); }
    logPlay(save, { legs: 1 }, now);
    save.legsLog = [...save.legsLog, { at: now, leg: leg.id, season: J.season, stars: stars.filter(Boolean).length, markers: num(stats.markers), markersRight: num(stats.markersRight), problems: num(stats.problems), problemsRight: num(stats.problemsRight), words: num(stats.words), wordsRight: num(stats.wordsRight) }].slice(-40);
    const tokens = Math.max(0, num(J.tokens) - num(save.trip && save.trip.tokens0));
    const home = leg.stop && leg.stop.kind === 'home';
    let next = null;
    try { next = JA.nextLeg(J); } catch (e) { console.error('[WagonWest] nextLeg threw', e); }
    let done = !!J.done;
    if (!next && !done && leg === LEGS[LEGS.length - 1]) { J.done = true; done = true; }
    if (done) save.seasonsDone += 1;
    save.trip = null;
    app.persist();
    pingNow('leg');
    const result = { leg: leg.id, place: (leg.stop && leg.stop.name) || leg.name, stars, cash: { arrival: num(a.cash && a.cash.arrival), stars: num(a.cash && a.cash.stars), total: num(a.cash && a.cash.total) },
      tokens, sticker, crate: a.crate || null, stats, food: num(J.food), home: home || done };
    if (result.cash.total !== result.cash.arrival + result.cash.stars) result.cash.total = result.cash.arrival + result.cash.stars;
    S('setBackdrop', home ? 'valley' : backdropFor(leg));
    go('results', result);
    Audio.cash();
    if (stars.every(Boolean)) setTimeout(() => Audio.fanfare(), 400);
    S('celebrate', 'star');
  }
  function newSeason() {
    const J = save.journey;
    if (!J) { go('outfit', { fresh: true }); return; }
    let n = null;
    try { n = JA.newSeason ? JA.newSeason(J) : null; } catch (e) { console.warn('[WagonWest] newSeason', e); }
    if (!n || !Number.isFinite(n.legIndex)) { go('outfit', { fresh: true }); return; }
    save.journey = n;
    save.trip = null;
    if (typeof JA.setHunting === 'function') try { JA.setHunting(n, settings.hunting !== false); } catch (_) { /* ignore */ }
    app.persist();
    toast(`${app.season().year}: ${app.season().name}`);
    go('title');
  }

  // ---------- the valley: the homestead the child names (the on-screen keyboard) ----------
  function createHome() {
    let name = '', waiter = null;
    const field = $('#hs-name');
    const kb = createKeyboard({
      id: 'hs-keyboard', enterLabel: 'Done',
      onKey: (ch) => { if (name.length >= 18 || (ch === ' ' && (!name || name.endsWith(' ')))) return; name += ch; Audio.letter(); paint(); },
      onBackspace: () => { name = name.slice(0, -1); Audio.letter(true); paint(); },
      onEnter: () => { const n = clean(name); if (!n || !waiter) return; const w = waiter; waiter = null; kb.setActive(false); w(n); },
    });
    $('#hs-kb').append(kb.el);
    const clean = (s) => s.replace(/\s+/g, ' ').trim().replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    function paint() { field.replaceChildren(name ? h('span', {}, clean(name) || ' ') : h('span', { class: 'ph' }, 'Name your homestead'), h('i', { class: 'caret' })); kb.setEnterEnabled(!!clean(name)); }
    return {
      show() { paint(); kb.setEnabled(true); kb.setActive(true); },
      hide() { kb.setActive(false); if (waiter) { const w = waiter; waiter = null; w(null); } },
      ask() { name = ''; return new Promise((resolve) => { waiter = resolve; go('home'); }); },
    };
  }

  // ---------- pause ----------
  function pause() {
    if (screen !== 'trail' || !T || paused) return;
    if (panelOpen()) return;
    paused = true;
    S('pause');
    renderPauseToggles();
    $('#panel-pause').hidden = false;
  }
  function resume() {
    if (!paused) return;
    paused = false;
    $('#panel-pause').hidden = true;
    S('play');
    if (T) T.last = 0;
  }
  function closePause() { if (paused) { paused = false; S('play'); } $('#panel-pause').hidden = true; }
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
  $('#pause-camp').addEventListener('click', () => { closePause(); go('title'); });

  // ---------- keyboard: Esc pauses (or closes the Parent Zone); the panels own digits / letters / Enter ----------
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (pz.isOpen) { pz.close(); return; }
    if (paused) { resume(); e.preventDefault(); return; }
    if (screen === 'trail' && T) { pause(); e.preventDefault(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); tts.cancel(); Audio.suspend(); Sfx.suspend(); if (currentPlayerId) app.persist(); } else { Audio.resume(); Sfx.resume(); }
  });
  window.addEventListener('pagehide', () => { pause(); tts.cancel(); if (currentPlayerId) app.persist(); });

  // ---------- navigation ----------
  $('#btn-trail').addEventListener('click', () => {
    const a = $('#btn-trail').dataset.action;
    if (a === 'outfit') go('outfit', { fresh: true }); else if (a === 'season') newSeason(); else hitTrail();
  });
  $('#btn-journal').addEventListener('click', () => go('journal'));
  $('#btn-outfit').addEventListener('click', () => go('outfit', save.journey ? { tab: 'look' } : { fresh: true }));
  $('#btn-parents').addEventListener('click', () => pz.open({ tab: 'sync' }));
  $('#btn-player').addEventListener('click', () => go('players'));
  for (const b of $$('[data-back]')) b.addEventListener('click', () => go(b.dataset.back));
  for (const b of $$('[data-camp]')) b.addEventListener('click', () => { spellPanel.cancel(); go('title'); });
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
    if (!e.target.closest('.scroll, .pz input, .pz textarea')) e.preventDefault();
  }, { passive: false });

  go('players');
  updateHooks.isSafe = () => safeToReload({ screen, busy: !!T || panelOpen(), parentZone: pz.isOpen });
  updateHooks.notify = () => {
    const t = h('div', { class: 'toast update-note', id: 'update-note', role: 'status' }, UPDATE_NOTICE);
    $('#app').append(t);
    setTimeout(() => t.remove(), 4000);
  };
  updateHooks.beforeReload = () => {
    if (currentPlayerId) app.persist();
    try { if (currentPlayerId && screen !== 'players') sessionStorage.setItem(RESUME_KEY, currentPlayerId); } catch (_) { /* ignore */ }
  };
  let resumeId = null;
  try { resumeId = sessionStorage.getItem(RESUME_KEY); sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
  if (resumeId && Profiles.playerById(family, resumeId)) selectPlayer(resumeId);
  sync.start();                        // first pull after the picker is on screen (never blocks it)
  pingNow('day');                      // once per device per UTC day (fire and forget)
  window.__wagonWest = {
    app, pz, sync, tts, store, river, postOffice, results, hud, markerPanel, problemPanel, spellPanel, card,
    get scene() { return scene; }, get screen() { return screen; }, get save() { return save; }, get facts() { return facts; },
    get travel() { return T ? { legId: T.leg.id, busy: T.busy, day: !!T.day } : null; }, get paused() { return paused; }, get mini() { return mini ? { kind: mini.kind, lb: mini.lb } : null; },
    JA,
    // a test hook: fire a trail event by id (or kind) on an idle trail, as the day loop would
    playEvent(id) { const ev = EVENT_BY_ID[id] || EVENTS.find((e) => e.kind === id); if (!ev || !T || T.busy) return false; T.busy = true; runEvent(ev).catch((e) => console.error(e)).finally(() => { if (T) { T.busy = false; T.last = 0; } }); return true; },
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
      // hand the SW every same-origin file this page loaded (the scene's modules, the shared modules of the other games)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[WagonWest] service worker registration failed', e));
  } catch (e) {
    console.warn('[WagonWest] service worker unavailable', e);
  }
}

boot().catch((e) => console.error('[WagonWest] boot failed', e));
