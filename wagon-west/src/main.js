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
// v1.1 (SPEC "v1.1"): the natural voice really plays (prepareVoice at player select / voice change / leg start, and
// app.voiceFor(texts) just in time before a generated sentence is said: a clip exists only for a text the server was
// asked for); the trail's own music (./meta/music.js: Music.on / tune by leg / mood by screen, ducked by the voice;
// Spell Jump's Audio.music() loop is never started here); Camp (./ui/camp.js: fishing, hunting, Quick Draw, Campfire
// tales, rest, each a day through the Journey stream's camp()); trail cards (J.cards through awardCard; the pop and
// the album in ./ui/cards.js); Fort Derby (the scene's startDerby / derbyBurst, a fact at each marker, derbyPay); the
// dog (named on the keyboard at Fort Kearny, J.dog, setParty({ dog }), the bark, a berry patch every other leg); the
// daily trail challenge (dailyChallenge / claimChallenge: a token and a card); the wagon upgrades (UPGRADES /
// buyUpgrade, Outfit → Look → Wagon).
// v1.2 (SPEC "v1.2", app part one): the Wagon panel (./ui/wagonPanel.js: food by kind as stacks, the goods, the animals,
// the companions and their skills, "Ask Eli: how many days?"), the HUD's forecast chip and effect toasts / cards (a
// breakdown with or without a part, a cold night, tired animals, no arrows, a skill firing: app.effectToast /
// app.skillLine, both streams use them), the store without a gate (a tap buys at the listed price, "Work it out" is the
// optional problem for a token), rations / distance questions only when the child asks Eli, camp's app.waitOut(), and
// the family map on the title (app.familyWagons).

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
import { activeFacts } from '../../trail-blazer/src/facts/store.js';
import { factParts, normFact } from '../../trail-blazer/src/facts/facts.js';
import { hintFor, spokenHint } from '../../trail-blazer/src/facts/hints.js';
import { cloudVoiceInfo } from '../../spell-jump/src/tts/voices.js';
import { loadSkills as loadFracSkills } from '../../fraction-fright/src/meta/save.js';
import { tierState } from '../../fraction-fright/src/skills/ladder.js';
import { fracName, fractionsOf, hashString, rngFrom, toleranceFor } from '../../fraction-fright/src/skills/items.js';
import * as Sim from './journey/sim.js';
import * as Problems from './journey/problems.js';
import * as Letters from './journey/letters.js';
import * as Economy from './journey/economy.js';
import { ANIMAL_BY_ID, LEGS, LEG_BY_ID, SEASONS, SEASON_BY_ID, GOODS } from './content/legs.js';
import { COMPANIONS, COMPANION_BY_ID } from './content/companions.js';
import { CARDS, CARD_BY_ID } from './content/cards.js';
import { LOOKOUTS } from './content/lookouts.js';
import { EVENTS, EVENT_BY_ID } from './content/events.js';
import { NATIONS, NATION_BY_ID } from './content/nations.js';
import { Sfx } from './meta/sfx.js';
import { Music } from './meta/music.js';
import { registerWagonWestSync } from './meta/sync.js';
import { addLetter, dayKeyOf, defaultSave, loadSave, loadSettings, logKind, logPlay, removeSave, writeSave, writeSettings } from './meta/save.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { STOCK, equipLook, grantLook, itemOf, rollCrate } from './ui/looks.js';
import { createPlayers } from './ui/players.js';
import { createTitle } from './ui/title.js';
import { companionSvg, createOutfit } from './ui/outfit.js';
import { createStore } from './ui/store.js';
import { createHud } from './ui/hud.js';
import { createWagonPanel, partySummary, skillOfCompanion } from './ui/wagonPanel.js';
import { createMarkerPanel, markerTexts } from './ui/markerPanel.js';
import { createProblemPanel, problemTexts, spokenLine } from './ui/problemPanel.js';
import { createCard } from './ui/card.js';
import { createRiver, riverTexts } from './ui/river.js';
import { createCamp } from './ui/camp.js';
import { createCardPop, ownedCards, sayOf } from './ui/cards.js';
import { PS_INTRO, READ_BACK } from './ui/postOffice.js';
import { createPostOffice } from './ui/postOffice.js';
import { createJournal } from './ui/journal.js';
import { createResults } from './ui/results.js';
import { createParentZone } from './ui/parentZone.js';
import { skinSpellPanel } from './ui/spellSkin.js';

const VERSION = '1.2.0';
// the natural voice: the server makes clips of at most 200 characters, so a longer line is said (and prepared) a
// sentence or two at a time; the line "Say a test line" speaks in the Parent Zone
const CLIP_MAX = 200;
const VOICE_WAIT_MS = 2500;
const TEST_LINE = 'Wagon West is ready to roll.';
const FIXED_LINES = ['Now you: type the answer', 'Now you: type the answer from memory', 'Fixed it!', PS_INTRO, READ_BACK, TEST_LINE,
  'Make camp tonight? Fishing, a card game, a story by the fire, or a good rest.', 'A dog has been following the wagon. Keep it?'];
// v1.2: the lines the effects say aloud (prepared with the rest, so the natural voice plays them)
FIXED_LINES.push('A cold night. There are not enough blankets, so the party rests a day.', 'The oxen need a rest, so we go steady today.', 'The mules need a rest, so we go steady today.',
  'The wagon limps along slowly to the next fort.', 'A spare part is used.', 'The new part mends the wagon. No more limping.');
const TUNES = ['susanna', 'buffalo', 'tucker'];
const DOG_COATS = ['brown', 'spotted', 'black'];   // the scene's three coats
const QD_TO = 7;                 // Quick Draw: first to 7 right facts
const DERBY_MARKERS = 4;         // Fort Derby: 400 m, a marker every 100 m from the start line = 4 facts
const DERBY_LENGTH = 400;
/** A line cut into pieces the natural voice can say (≤ 200 characters, at sentence breaks, else at commas / spaces). */
export function splitSay(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length <= CLIP_MAX) return [t];
  const out = [];
  let cur = '';
  const push = (piece) => {
    if (piece.length > CLIP_MAX) { for (const w of piece.split(/(?<=,)\s+|\s+/)) push(w); return; }
    if (!cur) cur = piece; else if (cur.length + 1 + piece.length <= CLIP_MAX) cur += ' ' + piece; else { out.push(cur); cur = piece; }
  };
  for (const sentence of t.split(/(?<=[.!?])\s+/)) push(sentence);
  if (cur) out.push(cur);
  return out;
}
// Campfire riddles: a fact in disguise, in trail words (the answer is the fact's; the numbers are shown as digits)
const RIDDLES = {
  x: [(a, b) => `${a} wagons, with ${b} oxen pulling each one. How many oxen in all?`,
    (a, b) => `${a} campfires, ${b} sticks on each fire. How many sticks?`,
    (a, b) => `${a} sacks of beans, ${b} pounds in every sack. How many pounds of beans?`,
    (a, b) => `${a} rows of tents, ${b} tents in each row. How many tents?`],
  '/': [(a, b) => `${a} biscuits shared by ${b} friends, the same for each. How many biscuits each?`,
    (a, b) => `${a} miles in ${b} days, the same every day. How many miles a day?`,
    (a, b) => `${a} apples packed in bags of ${b}. How many bags?`],
  '+': [(a, b) => `${a} geese on the river, and ${b} more fly in. How many geese now?`],
  '-': [(a, b) => `${a} pancakes on the plate, and the party eats ${b}. How many are left?`],
};
/** A riddle for a fact ({ text, say }), or null when the fact cannot be read. */
export function riddleFor(fact, flip = false, rand = Math.random) {
  const p = factParts(fact);
  if (!p || !RIDDLES[p.op]) return null;
  const [a, b] = flip && (p.op === 'x' || p.op === '+') ? [p.b, p.a] : [p.a, p.b];
  const list = RIDDLES[p.op];
  const text = list[Math.floor(rand() * list.length) % list.length](a, b);
  return { text, say: text };
}
const speechChunks = (texts) => [...new Set((texts || []).flatMap((t) => splitSay(t)))];
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
  const panelOpen = () => markerPanel.isOpen || problemPanel.isOpen || spellPanel.isOpen || card.isOpen || !!mini || !!derby;
  let derby = null;                       // Fort Derby in progress: { leg, markers, bursts, resolve }
  let campVisit = null;                   // this camp visit: { context, line (a companion spoke: their card) }
  let lastQuickDraw = null, lastDerby = null;   // (tests)
  const musicState = { tune: '', mood: '' };
  const inUse = (k) => k === 'family' || (currentPlayerId && [`${currentPlayerId}.ww`, `${currentPlayerId}.facts`, `${currentPlayerId}.words`].includes(k));
  const sync = createSyncClient({
    canApply: (k) => (inUse(k) ? !T && !panelOpen() && !['store', 'river', 'post', 'stop', 'home', 'camp', 'derby', 'dog'].includes(screen) : true),
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
    overlayOpen: () => panelOpen() || pz.isOpen || wagonPanel.isOpen || !$('#panel-pause').hidden,
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
      return { rate: o.rate, voiceName: o.voiceName || '', cloudVoice: o.cloudVoice || '', synced: !!sync.code, available: tts.available, clips: o.cloudVoice ? cloud.count(o.cloudVoice) : 0 };
    },
    /** Parents → Options "Say a test line": speak it, report the engine that spoke ('cloud' | 'device' | ''). */
    async testVoice() {
      if (currentPlayerId) applyVoice({ prepare: false });
      await voiceFor([TEST_LINE]);
      const r = await Promise.race([app.say(TEST_LINE), sleep(8000)]);
      const info = cloud.voice ? cloudVoiceInfo(cloud.voice) : null;
      return { engine: r ? tts.engine : '', name: info ? info.name : '' };
    },
    /** Read a line aloud (a voice available), a long one a sentence or two at a time. Returns the speech promise. */
    say(text) {
      if (!tts.available || !text) return Promise.resolve(null);
      const parts = splitSay(text);
      try { tts.cancel(); } catch (_) { /* ignore */ }
      if (parts.length <= 1) { try { return Promise.resolve(tts.say(parts[0] || text)).catch(() => null); } catch (_) { return Promise.resolve(null); } }
      return app.sayAll(parts, { cancel: false });
    },
    /** Several lines, one utterance each, in turn (a newer speech cuts the rest off). */
    async sayAll(list, { cancel = true } = {}) {
      const L = speechChunks(list);
      if (!tts.available || !L.length) return null;
      if (cancel) { try { tts.cancel(); } catch (_) { /* ignore */ } }
      let r = null;
      for (const t of L) { try { r = await tts.say(t); } catch (_) { r = null; } if (r === null) return null; }
      return r;
    },
    /** The natural voice, just in time: ask the server for these lines (at most 2.5 s; nothing when the device voice reads). */
    voiceFor,
    /** Say a line and wait for it (at most 8 s), and at least minMs. */
    sayWait(text, minMs = 0) { return Promise.all([Promise.race([app.say(text), sleep(8000)]), sleep(minMs)]); },
    /** A line as the voice says it ("$56" → "56 dollars"; no doubled full stop after a comma or a full stop). */
    spoken: (text) => spokenLine(text).replace(/([.!?])\.$/, '$1').replace(/[,;:]\.$/, '.'),
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
    // ----- v1.1: camp, cards, the derby, the daily challenge, the wagon upgrades -----
    campCompanion, campActivity, runDerby,
    derbyReady: () => !!(save.trip && !save.trip.derby && typeof JA.derbyPay === 'function'),
    daily: dailyInfo,
    upgrades: upgradeList,
    buyUpgrade,
    get cards() { return ownedCards(save.journey); },
    get music() { return { ...musicState }; },
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
    storeBuy, storeTap,
    foodDays() { const J = save.journey; return J ? foodDaysOf(J) : null; },
    foodHint() {
      const J = save.journey;
      if (!J || !JA.foodToNextFort) return '';
      try { const f = JA.foodToNextFort(J); return f && f.lb ? `You'll need about ${money(f.lb)} lb to reach ${f.stop}${f.enough ? ': you have enough' : ''}.` : ''; } catch (_) { return ''; }
    },
    /** How many units of a store good the wagon holds: { n, lb } (food in sacks / sides / bags by their pounds). */
    have: haveOf,
    // ----- v1.2: supplies, skills, the forecast, the family map (SPEC "v1.2" §1, §2, §4, §5) -----
    /** What the Wagon panel draws (see ./ui/wagonPanel.js). */
    wagonInfo,
    openWagon: () => wagonPanel.open(),
    get wagon() { return wagonPanel; },
    /** "Ask Eli: how many days?": a 'distance' then a 'ration' problem for a token, each once a leg. */
    askEli, eliLeft,
    /** A line the child sees for an effect (a cold night, tired animals, a soaked sack, a limp): a toast that stays a
     *  little longer, and read aloud when `say` is given (the spoken form; pass the text again to say it as written). */
    effectToast,
    /** A companion's skill firing: their portrait and line as a toast, read aloud. skill = { id, name, text, who } as the
     *  journey's tickDay / repair / camp results carry it. Returns the toast element (or null). */
    skillLine,
    /** Camp's "Wait out the storm": the journey's waitOut(J) (a rest day, the storm then costs nothing), saved. */
    waitOut,
    /** The weather ahead for the HUD chip: { next: 'clear' | 'rain' | 'storm' | 'snow', inDays, words } or null. */
    forecast: forecastNow,
    /** The party on the title and in the Outfit: "Ada fixes wheels · Eli scouts · Rosa stretches the food". */
    partyLine: (ids) => partySummary(ids),
    skillOf: (id) => skillOfCompanion(id),
    /** The other players of the family with a journey, for the title map's small wagons: [{ id, name, color, J, inLeg }]. */
    familyWagons,
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
    get cloud() { return cloud; },
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
  const hud = createHud({ onPace, onRations, onWagon: () => openWagonFromHud(), onEli: () => { askEli().catch((e) => console.error('[WagonWest] ask Eli', e)); } });
  const markerPanel = createMarkerPanel($('#panel-marker'), { tts, audio: Audio, sfx: Sfx });
  const problemPanel = createProblemPanel($('#panel-problem'), { tts, audio: Audio, sfx: Sfx });
  const card = createCard($('#card'), { say: (t) => app.say(t), canSay: () => tts.available });
  const spellRoot = $('#spell');
  const spellPanel = createSpellPanel(spellRoot, { tts, audio: Audio, onCancel: () => {} });
  const spellSkin = skinSpellPanel(spellRoot);
  const store = createStore(app);
  const wagonPanel = createWagonPanel(app);
  const river = createRiver(app);
  const postOffice = createPostOffice(app);
  const results = createResults(app);
  const homeUI = createHome();
  const dogUI = createDogNamer();
  const screens = {
    players: playersUI.players, newplayer: playersUI.newplayer, title: createTitle(app), outfit: createOutfit(app), store,
    trail: { show() {}, hide() {} }, stop: { show() {}, hide() {} }, river, post: postOffice, journal: createJournal(app), results, home: homeUI,
    camp: createCamp(app), derby: { show() {}, hide() {} }, dog: dogUI,
  };
  const cardPop = createCardPop($('#cardpop'), { sfx: Sfx });
  // the voice: Spell Jump's tts, with the natural voice when the family has a code and the player picked one in Spell Jump
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => { try { return currentPlayerId ? WS.activeList(Profiles.loadWords(currentPlayerId)).words : []; } catch (_) { return []; } }, audio: Audio });
  tts.setCloud(cloud);
  // the voice ducks the trail's music (and softens Spell Jump's effects, as in the siblings)
  tts.setOnSpeaking((on) => { Audio.voice(on); try { Music.duck(on); } catch (_) { /* ignore */ } });
  let voiceKey = '';
  function applyVoice({ prepare = true } = {}) {
    if (!currentPlayerId) return;
    const o = Profiles.playerOptions(family, currentPlayerId);
    tts.setRate(o.rate);
    tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
    cloud.setVoice(o.cloudVoice || '');
    // the clips for this player's voice: at player select and whenever the voice (or the family code) changes
    const key = `${currentPlayerId}|${cloud.voice}|${sync.code || ''}`;
    if (prepare && key !== voiceKey) { voiceKey = key; prepareVoice(); }
  }
  /** Everything the game says that can be known ahead (SPEC v1.1 §1): the week's words (Spell Jump's list), the
   *  child's active facts (the question, the full sentence and the hint, both ways round), every lookout, nation fact,
   *  event, companion line and trail card, the fixed lines of the panels, the river's landing sentences for the
   *  fractions in play. The server is asked only for what this device has no clip of. */
  function prepareVoice() {
    if (!currentPlayerId || !cloud.active) return;
    cloud.prepareList().catch(() => {});
    const texts = [];
    try { if (facts) for (const f of activeFacts(facts)) for (const flip of [false, true]) texts.push(...markerTexts(f, flip)); } catch (e) { console.warn('[WagonWest] activeFacts', e); }
    for (const l of Object.values(LOOKOUTS)) if (l) texts.push(l.say || l.text);
    for (const n of NATIONS) if (n.fact) texts.push(n.fact.say || n.fact.text);
    for (const e of EVENTS) texts.push(e.say || e.text);
    for (const c of COMPANIONS) { const L = c.lines || {}; texts.push(...(L.trail || []), L.tired, L.happy); }
    for (const c of CARDS) texts.push(sayOf(c));
    texts.push(...FIXED_LINES);
    for (const tier of ['T1', 'T2']) { try { for (const f of fractionsOf(tier)) texts.push(...riverTexts(fracName(f.n, f.d))); } catch (_) { /* ignore */ } }
    cloud.prepare(speechChunks(texts.filter(Boolean))).catch(() => {});
  }
  /** Just in time: the sentences about to be said (a generated problem, a letter, a riddle) as clips, waiting at most
   *  2.5 s; resolves at once when the device voice reads (no natural voice, or no family code). */
  function voiceFor(texts) {
    if (!cloud.active) return Promise.resolve();
    const list = speechChunks(texts).filter((t) => !cloud.has(t));
    if (!list.length) return Promise.resolve();
    return Promise.race([cloud.prepare(list).catch(() => null), sleep(VOICE_WAIT_MS)]);
  }
  /** A trail card with its sentence ready in the natural voice. */
  async function showCard(opts) { await voiceFor([opts.say || opts.text]); return card.show(opts); }
  const pz = createParentZone(app);

  function refreshCash() {
    const J = save.journey;
    const html = `${COIN}<span>$${money(J ? J.cash : 0)}</span>`;
    for (const el of $$('[data-cash]')) el.innerHTML = html;
  }
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };
  const partySize = (J) => { try { if (JA.partySize) return JA.partySize(J); } catch (_) { /* below */ } return ((J.party && J.party.length) || 3) + 1; };
  const curLeg = () => { const J = save.journey; if (!J) return null; try { if (JA.currentLeg) { const l = JA.currentLeg(J); if (l) return LEG_BY_ID[l.id] || l; } } catch (_) { /* below */ } return LEG_BY_ID[J.legId] || LEGS[num(J.legIndex)] || null; };

  // ---------- v1.2: the wagon's supplies, the skills, the forecast, the family map ----------
  const animalName = () => (save.journey && save.journey.animal === 'mules' ? 'mules' : 'oxen');
  /** Food by kind in lb: the journey's J.foods, else its single J.food split 50 / 30 / 20 (a save from before 1.2). */
  function foodKindsOf(J) {
    const f = J.foods && typeof J.foods === 'object' ? J.foods : null;
    if (f) return { flour: num(f.flour), bacon: num(f.bacon), beans: num(f.beans), other: num(f.other) };
    const t = Math.max(0, num(J.food)), a = Math.round(t * 0.5), b = Math.round(t * 0.3);
    return { flour: a, bacon: b, beans: t - a - b, other: 0 };
  }
  /** Days of food at the current rations (the journey's foodDays(J), else worked out from foodNeeded). */
  function foodDaysOf(J) {
    try { if (typeof JA.foodDays === 'function') { const d = JA.foodDays(J); if (Number.isFinite(d)) return Math.max(0, Math.floor(d)); } } catch (e) { console.warn('[WagonWest] foodDays', e); }
    if (typeof JA.foodNeeded !== 'function') return null;
    try { const per = JA.foodNeeded(partySize(J), J.rations || 'plenty', 1, (ANIMAL_BY_ID[J.animal] || {}).feedLb || 0); return per > 0 ? Math.floor(num(J.food) / per) : null; } catch (_) { return null; }
  }
  const goodsOf = (J) => { const g = J.goods && typeof J.goods === 'object' ? J.goods : {}; return { parts: num(J.parts !== undefined ? J.parts : g.parts), rope: num(g.rope), blankets: num(g.blankets), arrows: num(g.arrows), pelts: num(g.pelts), yoke: num(g.yoke) }; };
  const animalsOf = (J) => { const a = J.animals && typeof J.animals === 'object' ? J.animals : {}; return { n: num(a.n, 2), tired: num(a.tired) }; };
  const animalsTiredNow = (J) => !!J && animalsOf(J).tired > 70;
  function blanketsOf(J) {
    const have = goodsOf(J).blankets;
    try { if (typeof JA.needsBlankets === 'function') { const b = JA.needsBlankets(J); if (b && Number.isFinite(b.need)) return { need: num(b.need), have: Number.isFinite(b.have) ? b.have : have, short: num(b.short), cold: b.cold !== false }; } } catch (_) { /* below */ }
    const need = Math.ceil(partySize(J) / 2);
    return { need, have, short: Math.max(0, need - have), cold: true };
  }
  /** How many units of a store good the wagon holds: { n, lb } (food by its pounds in whole units). */
  function haveOf(item) {
    const J = save.journey;
    if (!J) return { n: 0, lb: 0 };
    const food = GOODS.find((g) => g.id === item && g.lb);
    if (food) { const lb = foodKindsOf(J)[item] || 0; return { n: lb > 0 ? Math.ceil(lb / food.lb) : 0, lb }; }
    if (item === 'yoke') return { n: animalsOf(J).n >= 4 ? 1 : 0, lb: 0 };
    return { n: goodsOf(J)[item] || 0, lb: 0 };
  }
  /** Asks Eli may still answer this leg: a 'distance' and a 'ration' problem, each once a leg (a token on a right first try). */
  function eliLeft() {
    const a = save.trip && save.trip.asked;
    if (!a || !save.journey || screen === 'players') return 0;
    return (a.distance ? 0 : 1) + (a.ration ? 0 : 1);
  }
  async function askEli() {
    const J = save.journey;
    if (!J || !save.trip || !eliLeft() || panelOpen() || (T && T.busy)) return null;       // not over a card or a marker
    const a = save.trip.asked;
    const kind = !a.distance ? 'distance' : 'ration';
    a[kind] += 1;
    app.persist();
    const leg = curLeg();
    const res = kind === 'distance'
      ? await runProblem('distance', { title: 'Ask Eli: how far?', extra: { dest: leg ? (leg.stop ? leg.stop.name : leg.name) : '' } })
      : await runProblem('ration', { title: 'Ask Eli: the food' });
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });
    return res;
  }
  /** What the Wagon panel draws. */
  function wagonInfo() {
    const J = save.journey;
    if (!J) return null;
    const leg = curLeg();
    const stop = leg ? (leg.stop ? leg.stop.name : leg.name) : '';
    let stopDays = 0;
    if (leg) {
      const left = Math.max(0, num(leg.miles) - num(J.milesDone));
      try { stopDays = JA.etaDays(left, J.pace, J.animal, typeof JA.speedBonus === 'function' ? JA.speedBonus(J) : 0); } catch (_) { stopDays = Math.ceil(left / 15); }
    }
    const A = animalsOf(J);
    const party = Array.isArray(J.party) && J.party.length ? J.party : (J.companions || []).map((id) => ({ id, mood: J.mood }));
    return {
      wagonName: J.wagonName || '',
      food: { kinds: foodKindsOf(J), days: foodDaysOf(J), stop, stopDays },
      goods: goodsOf(J), blankets: blanketsOf(J), limp: !!J.limp,
      animals: { name: animalName(), n: A.n, tired: A.tired, isTired: A.tired > 70 },
      companions: party.map((p) => ({ id: p.id, mood: p.mood || J.mood || 'happy' })),
      eli: { left: eliLeft() },
    };
  }
  function openWagonFromHud() {
    if (screen !== 'trail' || !T || T.busy || panelOpen() || wagonPanel.isOpen) return;
    wagonPanel.open();
  }
  const FC_WORDS = { clear: 'clear skies', rain: 'rain soon', storm: 'storm soon', snow: 'snow soon' };
  /** The weather ahead for the HUD chip: { next, inDays, words } or null. */
  function forecastNow() {
    const J = save.journey;
    if (!J || typeof JA.forecast !== 'function') return null;
    try {
      let f = JA.forecast(J);
      if (typeof f === 'string') f = { next: f.split(' ')[0], inDays: 1 };
      return f && FC_WORDS[f.next] ? { next: f.next, inDays: num(f.inDays, 1), words: FC_WORDS[f.next] } : null;
    } catch (_) { return null; }
  }
  const hudExtra = () => ({ forecast: forecastNow(), animalsTired: animalsTiredNow(save.journey), eli: eliLeft() > 0 });
  /** An effect the child sees (SPEC v1.2 §1: never a silent number): a toast that stays a little longer; `say` is read. */
  function effectToast(text, say) {
    if (!text) return null;
    const t = h('div', { class: 'toast fx', role: 'status' }, text);
    toastsEl.append(t);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
    setTimeout(() => t.remove(), 4800);
    if (say) app.say(say);
    return t;
  }
  /** A companion's skill firing: their portrait and the line as a toast, read aloud. skill = { id, name, text, who }. */
  function skillLine(skill) {
    if (!skill) return null;
    const J = save.journey;
    const ids = J ? (J.companions && J.companions.length ? J.companions : (J.party || []).map((p) => p.id)) : [];
    const who = (skill.who && COMPANION_BY_ID[skill.who] ? skill.who : null)
      || ids.find((id) => { const s = skillOfCompanion(id); return s && s.id === skill.id; })
      || (COMPANION_BY_ID[skill.id] ? skill.id : null);
    const c = who ? COMPANION_BY_ID[who] : null;
    const line = skill.text || skill.name || '';
    if (!line) return null;
    const t = h('div', { class: 'toast fx skill', role: 'status', 'data-skill': skill.id || '', 'data-who': who || '' },
      c ? h('span', { class: 'sk-face', html: companionSvg(c), 'aria-hidden': 'true' }) : null,
      h('span', { class: 'sk-text' }, c ? h('b', {}, c.name) : null, h('span', {}, line)));
    toastsEl.append(t);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
    setTimeout(() => t.remove(), 5200);
    app.say(c && !line.startsWith(c.name) ? `${c.name}: ${line}` : line);
    return t;
  }
  /** Camp's "Wait out the storm" (second app stream's screen): the journey's waitOut(J), saved; null without it. */
  function waitOut() {
    const J = save.journey;
    if (!J || typeof JA.waitOut !== 'function') return null;
    let r = null;
    try { r = JA.waitOut(J, { rand: Math.random }); } catch (e) { console.warn('[WagonWest] waitOut', e); }
    if (r && r.skill) skillLine(r.skill);
    app.persist(); refreshCash();
    try { if (screens.camp && screens.camp.isOpen) screens.camp.refresh(); } catch (_) { /* ignore */ }
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });
    return r;
  }
  /** The other players of the family who have a journey, for the title map: [{ id, name, color, J, inLeg }]. */
  function familyWagons() {
    const out = [];
    for (const p of family.players || []) {
      if (p.id === currentPlayerId) continue;
      let s = null;
      try { s = loadSave(p.id); } catch (_) { s = null; }
      const Jp = s && s.journey;
      if (!Jp) continue;
      out.push({ id: p.id, name: p.name, color: p.color, J: Jp, inLeg: !!(s.trip && s.trip.legId === Jp.legId) });
    }
    return out;
  }

  // ---------- players ----------
  function selectPlayer(id) {
    if (!Profiles.playerById(family, id)) return;
    stopTravel();
    currentPlayerId = id;
    replaceInPlace(save, loadSave(id));
    ensureJ();
    facts = loadFactsData(id);
    factSession = createFactSession();
    spellSession = createSpellSession();
    refreshStreak(save, Date.now());
    family.lastPlayer = id;
    Profiles.writeFamily(family);
    app.persist();
    voiceKey = '';
    applyVoice();
    applySceneParty();
    go('title');
  }
  /** The Journey stream fills the 1.1 fields (cards, upgrades, challenges) on a journey saved by 1.0. */
  function ensureJ() { const J = save.journey; if (J && typeof JA.ensureJourney === 'function') { try { JA.ensureJourney(J); } catch (e) { console.warn('[WagonWest] ensureJourney', e); } } }

  // Ghost-click guard (same as the other games): swallow a click that lands just after a screen change when its
  // pointerdown came before the change
  let lastGo = 0, lastDown = 0;
  document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, true);
  document.addEventListener('click', (e) => { const t = performance.now(); if (lastDown < lastGo && t - lastGo < 500) { e.preventDefault(); e.stopPropagation(); } }, true);

  const STAGE_SCREENS = ['trail', 'stop', 'store', 'river', 'post', 'results', 'home', 'camp', 'derby', 'dog'];
  function go(name, arg) {
    lastGo = performance.now();
    closePause();
    if (wagonPanel.isOpen) wagonPanel.close();
    if (name !== 'trail' && T) stopTravel();
    if (!['stop', 'store', 'river', 'post', 'home', 'derby', 'dog', 'camp'].includes(name)) { if (store.isOpen) store.leave(); }
    if (name !== 'camp' && screens.camp && screens.camp.isOpen && !['dog'].includes(name)) screens.camp.leave();
    if (name !== 'derby' && derby) quitDerby();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    document.documentElement.dataset.screen = name;
    if (name === 'trail' || name === 'results') toastsEl.replaceChildren();
    $('#stage').hidden = !STAGE_SCREENS.includes(name);
    $('#backdrop').hidden = STAGE_SCREENS.includes(name);
    if (STAGE_SCREENS.includes(name)) { S('resize'); S('play'); } else S('pause');
    if (name === 'title') checkDaily();
    if (screens[name]) screens[name].show(arg);
    refreshCash();
    syncMusic();
    setTimeout(() => updater.check(), 0);
  }
  // ---------- the trail's music (./meta/music.js): the tune by leg, the mood by screen, off while a panel is open ----------
  const MOOD_BY_SCREEN = { trail: 'trail', derby: 'trail', camp: 'camp', results: 'camp', title: 'camp', stop: 'camp', store: 'camp', river: 'trail', journal: 'camp', outfit: 'camp', home: 'camp', dog: 'camp', post: 'post' };
  function syncMusic() {
    const J = save.journey;
    const tune = TUNES[Math.max(0, num(J && J.legIndex)) % TUNES.length];
    const open = panelOpen() || pz.isOpen || wagonPanel.isOpen || !$('#panel-pause').hidden;
    const mood = open ? 'off' : (MOOD_BY_SCREEN[screen] || 'off');
    try {
      if (tune !== musicState.tune) { musicState.tune = tune; Music.tune(tune); }
      if (mood !== musicState.mood) { musicState.mood = mood; Music.mood(mood); }
    } catch (e) { console.warn('[WagonWest] music', e); }
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
    if (key === 'music') { Audio.music(false); try { Music.on(settings.music); } catch (_) { /* ignore */ } }
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
        if (kind === 'ww') { replaceInPlace(save, loadSave(id)); ensureJ(); refreshCash(); applySceneParty(); if (['title', 'journal'].includes(screen)) screens[screen].show(); }
        if (kind === 'facts') { facts = loadFactsData(id); prepareVoice(); }
      } else if (screen === 'players') screens.players.show();
      else if (screen === 'title' && kind === 'ww') screens.title.show();
      pz.onSyncApplied();
      return;
    }
    if (k !== 'family') return;
    replaceInPlace(family, Profiles.loadFamily());
    if (currentPlayerId) applyVoice();
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
      dog: J.dog ? { name: J.dog.name, coat: J.dog.coat } : null,
    });
  }
  const backdropFor = (leg) => ({ river: 'river', fort: 'fort', landmark: 'landmark', home: 'valley' }[leg && leg.stop && leg.stop.kind] || 'landmark');

  // ---------- outfit → the Independence store → the trail ----------
  async function outfitDone(draft, { fresh }) {
    const old = save.journey;
    if (fresh || !old) {
      const season = (old && old.done && pendingSeasonId()) || (old ? old.season : SEASONS[0].id);
      const prev = old;
      save.journey = JA.createJourney({ season, wagonName: draft.wagonName, animal: draft.animal, companions: draft.companions, seed: hashString(`${currentPlayerId}:${Date.now()}`) });
      carryOver(prev, save.journey);
      ensureJ();
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
      const keep = { cash: J.cash, parts: J.parts, goods: J.goods, foods: J.foods, animals: J.animals, tokens: J.tokens, cards: J.cards, upgrades: J.upgrades, challenges: J.challenges, dog: J.dog };
      if (!J.foods) keep.food = J.food;
      const n = JA.createJourney({ season: J.season, wagonName: draft.wagonName, animal: draft.animal, companions: draft.companions, seed: J.seed });
      for (const [k, v] of Object.entries(keep)) if (v !== undefined) n[k] = v;
      save.journey = n;
    } else J.wagonName = draft.wagonName;
    app.persist();
    applySceneParty();
    go('title');
  }
  /** What a new journey keeps from the old one: the trail cards (a collection across seasons) and the dog. */
  function carryOver(prev, n) {
    if (!prev || !n) return;
    if (prev.cards && (!n.cards || (Array.isArray(n.cards) && !n.cards.length))) n.cards = JSON.parse(JSON.stringify(prev.cards));
    if (prev.dog && !n.dog) n.dog = { ...prev.dog };
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
  /** A tap on a good (SPEC v1.2 §5: the store without a gate): one unit at the listed price, no question. Returns
   *  { ok } or { ok: false, reason: 'poor' (need: dollars short) | 'have' }. */
  function storeTap(good) {
    const J = save.journey;
    if (!J) return { ok: false };
    const item = good.item || good.id;
    const price = Math.max(1, Math.round(num(good.price) || 1));
    if (item === 'yoke' && animalsOf(J).n >= 4) return { ok: false, reason: 'have' };
    if (num(J.cash) < price) return { ok: false, reason: 'poor', need: price - Math.floor(num(J.cash)) };
    const wasLimp = !!J.limp;
    let r = { ok: false };
    try { r = JA.buy(J, { item, qty: 1, price }); } catch (e) { console.warn('[WagonWest] buy', e); }
    if (r && r.ok) {
      Audio.cash();
      if (wasLimp && !J.limp) effectToast('The new part mends the wagon: no more limping.', 'The new part mends the wagon. No more limping.');
      app.persist(); refreshCash();
      return { ok: true };
    }
    return { ok: false, reason: 'poor', need: price };
  }
  /** "Work it out" on a good (optional): the shopkeeper's 'buy' / 'divide' problem; the goods come at the fair price
   *  whatever the answer, and a right first answer earns a trade token. */
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
    if (!p) { toast(num(J.cash) < 1 ? 'The cash box is empty right now' : 'No question for that one: just tap to buy it'); return; }
    const res = await runProblemPanel(p, { kind, title: 'General Store', chipText: good.name, pick });
    if (res.cancelled) return;
    // the goods at the fair price, whatever the answer (the math earns the token, never the supplies)
    const meta = p.meta || {};
    const qty = Math.max(1, Math.round(num(meta.qty) || num(p.qty) || (kind === 'divide' ? num(p.answer) : num((factParts(p.fact) || {}).b)) || 1));
    let price = (meta.item || item) === (good.item || good.id) && num(good.price) > 0 ? num(good.price) : null;     // the price the shelf shows
    if (price == null) { try { price = JA.priceAt ? JA.priceAt(meta.item || item, JA.storeLeg ? JA.storeLeg(J) : leg, J.season) : null; } catch (_) { price = null; } }
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
    await voiceFor(problemTexts(p));
    const res = await problemPanel.open({ problem: p, title, chipText });
    if (res.cancelled) return res;
    try { JA.applyProblem(J, { kind, correct: !!res.correct, firstTry: !!res.correct }); } catch (e) { console.warn('[WagonWest] applyProblem', e); }
    logKind(save, kind, !!res.correct);
    logPlay(save, { problems: 1, problemsRight: res.correct ? 1 : 0 });
    const lf = ladderFactOf(p, pick);
    if (lf) recordFact(lf, { correct: res.correct, quick: false, fixed: !res.correct && res.fixed, ms: res.ms, given: res.given }, pick);
    app.persist();
    checkDaily();
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
  async function runFactPanel(title, { chipText = 'Quick fact', riddle = null, pick: given = null, journey = true } = {}) {
    const J = save.journey;
    const pick = given || ladderPick('any') || { fact: '6x7', flip: false };
    await voiceFor([...markerTexts(pick.fact, !!pick.flip), riddle ? riddle.say || riddle.text : '']);
    const res = await markerPanel.open({ fact: pick.fact, flip: !!pick.flip, title, chipText, riddle });
    if (res.cancelled) return res;
    recordFact(pick.fact, res, pick);
    // (camp's games pay their own token: their facts move the ladder and the log, not the leg's problem tally)
    if (journey) { try { JA.applyProblem(J, { kind: 'fact', correct: !!res.correct, firstTry: !!res.correct }); } catch (_) { /* ignore */ } }
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
    // Nora's tip (once a leg when the teacher is in the party): the strategy hint BEFORE the answer
    let tip = '';
    try { if (typeof JA.teacherTip === 'function' && JA.teacherTip(J)) tip = hintFor(pick.fact, !!pick.flip) || ''; } catch (e) { console.warn('[WagonWest] teacherTip', e); }
    if (tip) {
      const nora = (COMPANION_BY_ID.teacher || { name: 'Nora' }).name;
      await showCard({ kicker: `${nora}'s tip`, title: 'A tip before you answer', text: tip, say: spokenHint(tip), tone: 'lookout', button: 'Got it' });
      if (!T) return;
    }
    await voiceFor(markerTexts(pick.fact, !!pick.flip));
    const res = await markerPanel.open({ fact: pick.fact, flip: !!pick.flip, index: n - 1, total: of });
    if (res.cancelled) return;
    recordFact(pick.fact, res, pick);
    try { const am = JA.applyMarker(J, { correct: !!res.correct, quick: !!res.quick }); if (am && am.skill) skillLine(am.skill); } catch (e) { console.warn('[WagonWest] applyMarker', e); }
    logPlay(save, { markers: 1, markersRight: res.correct ? 1 : 0 });
    app.persist();
    if (res.quick) toast('A tailwind! A few free miles');
    else if (!res.correct) toast('Fixed it. The wagon rolls on');
    checkDaily();
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
    checkDaily();
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
      prepareVoice();                      // every leg start: the clips for this week's facts, words and lines
    }
    applySceneParty();
    S('setLeg', { id: leg.id, biome: leg.biome, miles: leg.miles, stop: leg.stop, river: leg.river });
    if (save.trip.stage === 'stop') { runStop(leg).catch((e) => console.error('[WagonWest] stop', e)); return; }
    try { Music.tune(TUNES[num(J.legIndex) % TUNES.length]); musicState.tune = TUNES[num(J.legIndex) % TUNES.length]; } catch (_) { /* ignore */ }
    S('setBackdrop', 'trail');
    go('trail');
    hud.reset();
    hud.update(J, leg, { milesDone: J.milesDone, ...hudExtra() });
    S('setTravel', { milesDone: num(J.milesDone), pace: J.pace, rations: J.rations, weather: 'clear', mood: J.mood, foodLow: false, moving: false });
    const bugle = save.cosmetics.equipped.bugle;
    if (bugle && bugle !== 'none') Sfx.bugle(bugle);
    T = { leg, day: null, acc: 0, busy: false, last: 0, raf: 0, weather: 'clear', rand: rngFrom(hashString(`${currentPlayerId}:${J.legId}:${J.seed}:${J.day}`)) };
    T.raf = requestAnimationFrame(travelFrame);
    if (!save.seen.coach) {
      T.busy = true;
      const r = T;
      card.show({ kicker: 'How the trail works', title: 'Roll out!', tone: 'coach', button: "Let's roll",
        text: 'The wagon rolls on its own. Pace and rations are your two dials. At each mile marker, type one fact. Tap the food box to look in the wagon. Stop any time: the journey waits right here.' })
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
    hud.update(J, r.leg, { milesDone: m, foodLow: !!r.day.res.foodLow, ...hudExtra() });
    if (k >= 1) { const d = r.day; r.day = null; afterDay(r, d).catch((e) => console.error('[WagonWest] day', e)); }
  }
  async function afterDay(r, d) {
    r.busy = true;
    app.persist();                              // every day is saved: stopping anywhere loses nothing
    const J = save.journey;
    dayEffects(d.res, r);
    if (d.res.marker) await runMarker(d.res.marker);
    if (T !== r) return;
    if (d.res.event) await runEvent(d.res.event);
    if (T !== r) return;
    if (!d.res.event && !d.res.marker && dogBerriesDue(r)) { await dogBerries(); if (T !== r) return; }
    hud.update(J, r.leg, { milesDone: num(J.milesDone), foodLow: !!d.res.foodLow, ...hudExtra() });
    if (d.res.arrived || num(J.milesDone) >= r.leg.miles) { await arrival(r); return; }
    r.busy = false; r.last = 0;
  }
  /** The day's effects as lines the child sees: a skill firing, a cold night, tired animals (SPEC v1.2 §1, §2). */
  function dayEffects(res, r) {
    if (!res) return;
    const skills = [...(Array.isArray(res.skills) ? res.skills : []), ...(res.skill ? [res.skill] : [])].filter((k, i, a) => k && a.findIndex((x) => x && x.id === k.id) === i);
    for (const k of skills) skillLine(k);
    if (res.spotted && res.spotted.card) { const n = res.spotted.name || res.spotted.animal || 'an animal'; effectToast(`A ${n} on the ridge! A new card for the album.`); dropCard(res.spotted.card); }
    if (res.coldNight) effectToast('A cold night. There are not enough blankets, so the party rests a day. Blankets at the next fort will help.', 'A cold night. There are not enough blankets, so the party rests a day.');
    if (res.animalsTired) {
      if (!r.tiredShown) { r.tiredShown = true; effectToast(`The ${animalName()} need a rest, so we go steady today.`, `The ${animalName()} need a rest, so we go steady today.`); }
    } else r.tiredShown = false;
  }
  function onPace(id) {
    const J = save.journey;
    if (!J) return;
    if (id === 'brisk' && animalsTiredNow(J)) { effectToast(`The ${animalName()} need a rest first. Steady pace for now.`); if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() }); return; }
    try { if (JA.setPace) JA.setPace(J, id); else J.pace = id; } catch (_) { J.pace = id; }
    app.persist();
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });
  }
  async function onRations(id) {
    const J = save.journey;
    if (!J) return;
    try { if (JA.setRations) JA.setRations(J, id); else J.rations = id; } catch (_) { J.rations = id; }
    app.persist();
    const r = T;
    if (r) hud.update(J, r.leg, { milesDone: num(J.milesDone), ...hudExtra() });
    // (the rations question is no longer forced: the child asks Eli, SPEC v1.2 §5)
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
    const noArrows = kind === 'hunt' && (ev.canHunt === false || (typeof JA.huntAllowed === 'function' && !JA.huntAllowed(J)));
    if (kind === 'hunt' && (settings.hunting === false || noArrows)) {
      kind = 'fish';
      text = noArrows && settings.hunting !== false ? 'Fresh tracks by the trail, but the quiver is empty. A creek runs right beside them: fishing only today. Arrows at the next fort!' : 'Fresh tracks by the trail, and a stream beside them. Get the fishing line out.';
      sayText = text;
    }
    if (ev.covered) { const c = ' The canvas cover keeps everyone dry and cheerful.'; text = `${text || ''}${c}`; sayText = `${sayText || ev.text || ''}${c}`; }
    if (kind === 'lookout') { spotSure = true; S('spotAnimal', ev.animal || 'bison'); }
    S('setTravel', { moving: false });
    if (kind === 'breakdown') { await runBreakdown(ev); return; }
    await showCard({ kicker: 'On the trail', title: ev.name || 'On the trail', text, say: sayText, tone: kind, button: EVENT_BUTTON[kind] || 'Continue' });
    if (!T) return;
    if (kind === 'bonus' && /berr|plum/i.test(`${ev.id} ${ev.name || ''} ${ev.text || ''}`)) dropCard(plumCard());
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
  /** A breakdown (a wheel, axle or tongue): with a spare part (or Ada) the card offers "Fix it" and "Work it out for a
   *  token" (the 'parts' problem is optional); without, the wagon limps to the next fort. The journey's repair(J)
   *  decides and returns { fixed, usedPart, skill, limp }. */
  async function runBreakdown(ev) {
    const J = save.journey;
    const have = typeof ev.havePart === 'boolean' ? ev.havePart : goodsOf(J).parts > 0;
    const free = ev.freeFix || (typeof ev.havePart !== 'boolean' && (J.companions || []).includes('blacksmith') ? 'forge' : '');   // 'forge' (Ada) | 'half' (Tomas)
    const canFix = have || !!free;
    const what = ev.part || 'wheel';
    const trick = free === 'half' ? 'Tomas can make a part last twice as long.' : 'Ada knows a trick or two.';
    const text = `${ev.text || `Bump! The ${what} breaks.`} ${free === 'forge' && !have ? `There is no spare part, but ${trick}` : have ? `There is a spare part in the wagon.${free ? ` ${trick}` : ''}` : free ? `There is no spare part, but ${trick}` : 'There is no spare part in the wagon, so the wagon limps to the next fort.'}`;
    const c = await showCard({ kicker: 'Breakdown', title: ev.name || `A ${what} breaks`, text, say: text, tone: 'problem', button: canFix ? 'Fix it' : 'Limp along', alt: canFix ? 'Work it out for a token' : undefined });
    if (!T) return;
    let workedOut = false;
    if (c === 'alt') {
      const res = await runProblem('parts', { title: 'Wagon repair' });
      if (!T) return;
      workedOut = !!res.correct;
    }
    let r = null;
    try { r = typeof JA.repair === 'function' ? JA.repair(J, { workedOut }) : null; } catch (e) { console.warn('[WagonWest] repair', e); }
    r = r || { fixed: canFix, usedPart: have };
    app.persist();
    if (r.skill) skillLine(r.skill);
    if (r.fixed) {
      toast(ev.fix || 'A quick fix and we roll on!');
      if (r.usedPart) effectToast('A spare part is used. Spares are sold at the forts.', 'A spare part is used.');
    } else effectToast('The wagon limps along slowly to the next fort. A spare part would mend it.', 'The wagon limps along slowly to the next fort.');
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });
  }
  async function runTrade(ev) {
    const J = save.journey;
    const nation = NATION_BY_ID[ev.nation] || NATION_BY_ID[(curLeg() || {}).nation] || NATIONS[0];
    if (nation && nation.fact) await showCard({ kicker: 'Trading post', title: `The ${nation.name} people`, text: nation.fact.text, say: nation.fact.say, tone: 'trade', button: 'Trade' });
    if (!T) return;
    if (nation) dropCard(nation.id);
    let offer = null;
    try { offer = JA.tradeOffer ? JA.tradeOffer(J) : null; } catch (_) { offer = null; }
    const rate = (offer && offer.rate) || (nation && nation.trade && nation.trade.rate) || [3, 2];
    if (offer && num(offer.have) < rate[0]) { toast('Nothing to trade this time: a friendly visit'); return; }
    const pick = ladderPick('x');
    let p = null;
    try { p = JA.problemFor({ kind: 'trade', fact: pick ? pick.fact : null, leg: curLeg(), season: J.season, rand: T.rand, nation: ev.nation || (nation && nation.id), have: offer ? offer.have : undefined }); } catch (e) { console.warn('[WagonWest] problemFor trade', e); }
    if (!p) return;
    await voiceFor(problemTexts(p));       // the trade problem in the natural voice (runProblemPanel asks again: a no-op then)
    const res = await runProblemPanel(p, { kind: 'trade', title: 'Trading post', chipText: nation ? nation.name : '', pick });
    if (res.cancelled) return;
    try { JA.applyTrade(J, p.meta || { giveN: num(p.giveN), getN: num(p.getN) || num(p.answer) }); } catch (e) { console.warn('[WagonWest] applyTrade', e); }
    app.persist();
  }
  /** The bow or the fishing line: the scene runs it (it owns the pointer), the app adds the food. */
  function runMini(kind) {
    return new Promise((resolve) => {
      const J = save.journey;
      mini = { kind, lb: 0, hits: 0, resolve, done: false, card: false };
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
      if (evt.hit) { mini.lb += num(evt.meatLb); mini.hits += 1; toast('Got one!'); if (!mini.card) { mini.card = true; dropCard(animalCard(evt.animal)); } }
    } else if (evt.type === 'huntEnd' && mini && mini.kind === 'hunt') finishMini(Number.isFinite(evt.meatLb) ? evt.meatLb : null);
    else if (evt.type === 'fish' && mini && mini.kind === 'fish') { Sfx.plop(); mini.lb += num(evt.lb); mini.hits += 1; toast(`A ${evt.size || ''} fish!`.replace('  ', ' ')); if (!mini.card) { mini.card = true; dropCard(animalCard(evt.animal || 'fish') || animalCard('salmon')); } }
    else if (evt.type === 'animalSpotted') onSpotted(evt.animal);
    else if (evt.type === 'bark') Sfx.bark();
    else if (evt.type === 'derbyMarker') onDerbyMarker(evt);
    else if (evt.type === 'derbyEnd') onDerbyEnd(evt);
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
    await showCard({ kicker: 'You made it!', title: (leg.stop && leg.stop.name) || leg.name, text: look ? look.text : '', say: look ? look.say : '', sticker: leg.sticker, tone: 'lookout',
      button: kind === 'river' ? 'To the ferry' : kind === 'fort' ? 'Into the fort' : kind === 'home' ? 'Home at last' : 'Continue' });
    if (screen !== 'stop') return;
    if (look || CARD_BY_ID[leg.id]) dropCard(leg.id);      // the lookout's landmark card
    if (kind === 'river') {
      const rr = await river.run({ leg });
      if (rr.cancelled) { if (screen === 'river') go('title'); return; }
    } else if (kind === 'fort') {
      let sl = leg;
      try { if (JA.storeLeg) sl = JA.storeLeg(J) || leg; } catch (_) { sl = leg; }
      const shop = store.open({ leg: sl, place: leg.stop.name, nextText: 'To the post office', derby: true });
      await offerDog(leg);
      const ok = await shop;
      if (!ok) return;
      const po = await postOffice.run({ leg });
      if (po.cancelled) { if (screen === 'post') go('title'); return; }
    } else if (kind === 'home') {
      const name = await homeUI.ask();
      if (name == null) return;
      save.homestead = name;
    }
    // the evening of every arrival: camp before the results (never needed: "On to the results" goes straight on)
    if (kind !== 'home') {
      go('stop');
      const c = await showCard({ kicker: 'Evening', title: 'Make camp tonight?', text: 'Fishing, a card game, a story by the fire, or a good rest.', say: FIXED_LINES[6], tone: 'camp', button: 'On to the results', alt: 'Make camp' });
      if (screen !== 'stop') return;
      if (c === 'alt') {
        const how = await openCamp('arrival');
        if (how !== 'results') return;
      }
    }
    finishLeg(leg);
  }
  function finishLeg(leg) {
    const J = save.journey;
    const now = Date.now();
    let a = null;
    try { a = JA.arrive(J); } catch (e) { console.error('[WagonWest] arrive threw', e); }
    a = a || { stars: [true, false, false], cash: { arrival: 0, stars: 0, total: 0 }, sticker: leg.sticker, crate: null };
    // the arrival's card (one of the leg's biome), and the daily challenge looks at the finished leg before it resets
    try { if (typeof JA.cardForLeg === 'function') dropCard(JA.cardForLeg(J, Math.random)); } catch (e) { console.warn('[WagonWest] cardForLeg', e); }
    checkDaily();
    if (J.dog) J.dog.legs = num(J.dog.legs) + 1;
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
    carryOver(J, n);
    save.journey = n;
    ensureJ();
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

  // ---------- trail cards (SPEC v1.1 §3): drops, the pop, a full suit's gold crate ----------
  let spotSure = false;                   // a lookout event's animal: its card always drops
  const cardOf = (c) => (!c ? null : typeof c === 'string' ? CARD_BY_ID[c] || null : CARD_BY_ID[c.id] || (c.id && c.suit ? c : null));
  function animalCard(animal) {
    if (!animal || typeof JA.cardForAnimal !== 'function') return null;
    try { return cardOf(JA.cardForAnimal(animal)); } catch (_) { return null; }
  }
  const plumCard = () => animalCard('berries') || animalCard('plum') || CARDS.find((c) => c.suit === 'wild' && /plum/i.test(`${c.id} ${c.name}`)) || null;
  /** A card for the collection (awardCard: a duplicate becomes a token); the pop shows it; a full suit pays a golden
   *  crate once. Returns awardCard's result or null. */
  function dropCard(c) {
    const J = save.journey;
    const cd = cardOf(c);
    if (!J || !cd || typeof JA.awardCard !== 'function') return null;
    let r = null;
    try { r = JA.awardCard(J, cd.id); } catch (e) { console.warn('[WagonWest] awardCard', e); return null; }
    if (!r) return null;
    const suit = r.suit || cd.suit;
    let full = !!r.suitComplete;
    if (r.new && r.suitComplete === undefined && typeof JA.suitComplete === 'function') { try { full = !!JA.suitComplete(J, suit); } catch (_) { full = false; } }
    if (full && !save.suitsDone.includes(suit)) {
      save.suitsDone.push(suit);
      save.crates.queue.push('gold'); save.crates.earned += 1;
      toast('A full suit! A golden crate');
    }
    cardPop.pop(cd, { dup: !r.new, suitDone: full });
    app.persist(); refreshCash();
    return r;
  }
  function onSpotted(animal) {
    const J = save.journey;
    if (!J) return;
    // (the scene barks by itself after a spotted animal when the dog is on screen: the 'bark' event plays the sound)
    const sure = spotSure;
    spotSure = false;
    if (sure || Math.random() < (J.dog ? 0.8 : 0.4)) dropCard(animalCard(animal));   // the dog doubles the chance
  }

  // ---------- Camp (SPEC v1.1 §3): a real place; every activity is a day (camp(J, kind)) ----------
  function campCompanion() {
    const J = save.journey;
    const ids = J ? (J.companions && J.companions.length ? J.companions : (J.party || []).map((p) => p.id)) : [];
    return ids.length ? ids[num(J.day) % ids.length] : 'scout';
  }
  /** Open Camp ('trail': from the trail or the pause menu; 'arrival': the evening of an arrival). Resolves how it was left. */
  async function openCamp(context = 'trail') {
    if (!save.journey) return null;
    campVisit = { context, line: false };
    S('setBackdrop', 'camp');
    S('setTravel', { moving: false });
    const how = await screens.camp.open({ context });
    campVisit = null;
    if (how === 'trail') hitTrail();
    else if (how === 'stop') go('title');
    return how;
  }
  async function campActivity(kind) {
    const J = save.journey;
    if (!J) return;
    const who = campCompanion();
    try { if (typeof JA.camp === 'function') { const cr = JA.camp(J, kind, { rand: Math.random }); if (cr && cr.skill) skillLine(cr.skill); } } catch (e) { console.warn('[WagonWest] camp', e); }
    app.persist(); refreshCash(); screens.camp.refresh();
    if (kind === 'fish' || kind === 'hunt') { await runMini(kind); companionLine(who, true); }
    else if (kind === 'cards') { await quickDraw(who); companionLine(who, false); }
    else if (kind === 'tales') { await campfireTale(); companionLine(who, true); }
    else { toast('A good rest. Everyone feels better'); companionLine(who, true, 'happy'); }
    checkDaily();
    app.persist(); refreshCash();
  }
  /** A companion's line at camp (once a visit): said and shown, and their trail card drops. */
  function companionLine(who, speak, which = 'trail') {
    if (!campVisit || campVisit.line || screen !== 'camp') return;
    campVisit.line = true;
    const c = COMPANION_BY_ID[who];
    if (!c) return;
    const L = c.lines || {};
    const line = which === 'happy' && L.happy ? L.happy : (L.trail || [])[num(save.journey && save.journey.day) % Math.max(1, (L.trail || []).length)] || L.happy || '';
    if (line) { toast(`${c.name}: “${line}”`); if (speak) app.say(line); }
    dropCard(who);
  }
  /** Quick Draw: first to 7 right facts on the marker panel; the companion "draws" after every answer. A token on a
   *  win; always a good-game line, never a losing one. No clock anywhere. */
  async function quickDraw(who) {
    const J = save.journey;
    const c = COMPANION_BY_ID[who] || { name: 'Eli', lines: {} };
    const lines = (c.lines && c.lines.trail) || [];
    const rand = rngFrom(hashString(`${currentPlayerId}:qd:${J.day}:${Date.now()}`));
    let me = 0, them = 0, round = 0;
    while (me < QD_TO && them < QD_TO) {
      round += 1;
      const res = await runFactPanel('Quick Draw', { chipText: `You ${me} · ${c.name} ${them}`, journey: false });
      if (res.cancelled || screen !== 'camp') return;
      if (res.correct) me += 1;
      if (me >= QD_TO) break;
      if (rand() < 0.45) them += 1;        // the companion draws a card every time the child answers
      const line = lines.length ? lines[(round - 1) % lines.length] : 'Your turn!';
      toast(`${c.name} draws: “${line}”`);
      await sleep(beat(250));
    }
    const won = me >= QD_TO;
    if (won) { J.tokens = num(J.tokens) + 1; Audio.cash(); }
    const happy = (c.lines && c.lines.happy) || 'Good game!';
    lastQuickDraw = { won, me, them };
    await showCard({ kicker: 'Quick Draw', title: won ? 'You won the Quick Draw!' : 'Good game!', tone: 'camp', button: 'Back to camp',
      text: `${c.name}: “${happy}” ${won ? 'A trade token for you.' : `${c.name} wants a rematch tomorrow.`}`, say: happy });
  }
  /** Campfire tales: a landmark or nation the trail has passed, read aloud, then a riddle (a fact in disguise): a token. */
  async function campfireTale() {
    const J = save.journey;
    const legs = LEGS.slice(0, Math.max(1, num(J.legIndex) + 1));
    const pool = [...new Set(legs.flatMap((l) => [l.id, l.nation]).filter(Boolean))].map((id) => CARD_BY_ID[id]).filter(Boolean);
    const tale = pool[Math.floor(Math.random() * pool.length)];
    if (tale) await showCard({ kicker: 'Campfire tales', title: tale.name, text: factOfCard(tale), say: sayOf(tale), sticker: { emoji: tale.emoji, name: tale.name }, tone: 'camp', button: 'A riddle!' });
    if (screen !== 'camp') return;
    const pick = ladderPick('any') || { fact: '6x7', flip: false };
    const riddle = riddleFor(pick.fact, !!pick.flip, Math.random);
    const res = await runFactPanel('Campfire riddle', { chipText: 'A riddle', riddle, pick, journey: false });
    if (res.cancelled) return;
    if (res.correct) { J.tokens = num(J.tokens) + 1; Audio.cash(); toast('Riddle solved! A trade token'); } else toast('Riddle solved together. Good thinking');
  }
  const factOfCard = (c) => (typeof c.fact === 'string' ? c.fact : (c.fact && c.fact.text) || '');

  // ---------- Fort Derby (SPEC v1.1 §3): the race on the scene, a fact at each marker ----------
  async function runDerby(leg) {
    const J = save.journey;
    if (!J || !save.trip || save.trip.derby) return;
    save.trip.derby = true;
    app.persist();
    S('setBackdrop', 'trail');
    go('derby');
    $('#derby-line').textContent = 'Race the mail wagon to the flag';
    const res = await new Promise((resolve) => {
      derby = { leg, markers: 0, bursts: [], resolve, busy: false };
      S('startDerby', { seed: hashString(`${currentPlayerId}:${leg ? leg.id : ''}:${J.day}`), length: DERBY_LENGTH });
      if (!scene) { derby = null; resolve(null); }
    });
    S('setBackdrop', 'fort');
    if (!res) { if (screen === 'derby') go('store'); return; }
    let pay = null;
    try { pay = JA.derbyPay(J, { won: !!res.won, margin: num(res.margin) }); } catch (e) { console.warn('[WagonWest] derbyPay', e); }
    const cash = num(pay && pay.cash);
    if (res.won) { try { dropCard(JA.cardForLeg(J, Math.random)); } catch (_) { /* ignore */ } }
    app.persist(); refreshCash(); Audio.cash();
    lastDerby = { ...res, cash };
    go('store');
    const m = Math.round(num(res.margin));
    const title = res.won ? `You beat the mail wagon by ${m} m!` : 'The mail wagon got there first. Good race!';
    const text = res.won ? `The whole fort cheers. $${cash} for the race, and a trail card.` : `What a race! $${cash} for a good try.`;
    await showCard({ kicker: 'Fort Derby', title, text, say: `${title} ${text}`, tone: 'camp', button: 'Back to the store' });
    checkDaily();
  }
  async function onDerbyMarker(evt) {
    const d = derby;
    if (!d || d.busy) return;
    d.busy = true;
    d.markers += 1;
    const of = Math.max(1, Math.round(num(evt.of) || DERBY_MARKERS));
    const n = Math.max(1, Math.round(num(evt.n) || d.markers));
    $('#derby-line').textContent = `Marker ${n} of ${of}`;
    const pick = ladderPick('any') || { fact: '6x7', flip: false };
    await voiceFor(markerTexts(pick.fact, !!pick.flip));
    const res = derby === d ? await markerPanel.open({ fact: pick.fact, flip: !!pick.flip, index: n - 1, total: of, title: 'Fort Derby', chipText: `Marker ${n} of ${of}` }) : { cancelled: true };
    d.busy = false;
    if (derby !== d) return;
    if (res.cancelled) { quitDerby(); return; }
    recordFact(pick.fact, res, pick);
    logKind(save, 'fact', !!res.correct);
    logPlay(save, { problems: 1, problemsRight: res.correct ? 1 : 0 });
    app.persist();
    const power = res.quick ? 1 : res.correct ? 0.6 : 0;
    d.bursts.push(power);
    S('derbyBurst', power);
    if (power) toast(res.quick ? 'A big burst of speed!' : 'A burst of speed!');
  }
  function onDerbyEnd(evt) { const d = derby; if (!d) return; derby = null; d.resolve({ won: !!evt.won, margin: num(evt.margin), markers: num(evt.markers), bursts: num(evt.bursts) }); }
  function quitDerby() { const d = derby; if (!d) return; derby = null; S('endDerby'); markerPanel.cancel(); d.resolve(null); }

  // ---------- the dog (SPEC v1.1 §3): offered at Fort Kearny's store, named on the keyboard ----------
  const KEARNY = Math.max(0, LEGS.findIndex((l) => l.id === 'fort-kearny'));
  async function offerDog(leg) {
    const J = save.journey;
    if (!J || J.dog || LEGS.indexOf(leg) < KEARNY) return;
    const c = await showCard({ kicker: 'At the fort', title: 'A new friend', text: FIXED_LINES[7], say: FIXED_LINES[7], tone: 'camp', button: 'Keep it!', alt: 'Not now' });
    if (c !== true || screen !== 'store' || J !== save.journey) return;
    const got = await dogUI.ask();
    if (got && J === save.journey) {
      J.dog = { name: got.name, coat: got.coat, legs: 0, nextBerries: 1 };
      app.persist();
      applySceneParty();
      S('dogBark');
      toast(`${got.name} joins the party!`);
    }
    if (screen === 'dog') go('store');
  }
  function dogBerriesDue(r) {
    const J = save.journey;
    return !!(J && J.dog && save.trip && !save.trip.berries && num(J.dog.legs) >= num(J.dog.nextBerries) && num(J.milesDone) >= r.leg.miles * 0.35 && num(J.milesDone) < r.leg.miles);
  }
  /** The dog's berry patch (the 'berries' bonus, fired by the app every other leg, with the dog's name in it). */
  async function dogBerries() {
    const J = save.journey;
    const ev = EVENT_BY_ID.berries || { id: 'berries', kind: 'bonus', foodLb: 20, name: 'Wild berries' };
    save.trip.berries = true;
    save.trip.events = [...save.trip.events, 'berries'].slice(0, 8);
    J.dog.nextBerries = num(J.dog.legs) + 2;
    const lb = num(ev.foodLb) || 20;
    J.food = num(J.food) + lb;
    if (J.trip && Array.isArray(J.trip.happened) && !J.trip.happened.includes('berries')) J.trip.happened.push('berries');
    app.persist();
    S('dogBark');
    S('setTravel', { moving: false });
    const text = `${J.dog.name} runs off barking and comes back by a patch of wild plums. Everyone picks!`;
    await showCard({ kicker: 'On the trail', title: `${J.dog.name} found berries!`, text, say: text, tone: 'bonus', button: 'Yum!' });
    toast(`+${lb} lb of plums for the wagon`);
    dropCard(plumCard());
  }
  function createDogNamer() {
    let name = '', coat = DOG_COATS[0], waiter = null;
    const field = $('#dog-name');
    const coats = $('#dog-coats');
    const kb = createKeyboard({
      id: 'dog-keyboard', enterLabel: 'Done',
      onKey: (ch) => { if (name.length >= 12 || (ch === ' ' && (!name || name.endsWith(' ')))) return; name += ch; Audio.letter(); paint(); },
      onBackspace: () => { name = name.slice(0, -1); Audio.letter(true); paint(); },
      onEnter: () => { const n = clean(name); if (!n || !waiter) return; const w = waiter; waiter = null; kb.setActive(false); w({ name: n, coat }); },
    });
    $('#dog-kb').append(kb.el);
    const clean = (x) => x.replace(/\s+/g, ' ').trim().replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    const COAT = { brown: '#9a6a3a', spotted: '#e8e0d0', black: '#2e2622' };
    function paint() {
      field.replaceChildren(name ? h('span', {}, clean(name) || ' ') : h('span', { class: 'ph' }, 'Name your dog'), h('i', { class: 'caret' }));
      kb.setEnterEnabled(!!clean(name));
      coats.replaceChildren(...DOG_COATS.map((c) => {
        const b = h('button', { class: 'swatch' + (c === coat ? ' on' : ''), role: 'radio', 'aria-checked': String(c === coat), 'aria-label': `A ${c} coat`, 'data-coat': c, 'data-sfx': '', style: { '--c': COAT[c] } });
        b.addEventListener('click', () => { coat = c; paint(); });
        return b;
      }));
    }
    return {
      show() { paint(); kb.setEnabled(true); kb.setActive(true); },
      hide() { kb.setActive(false); if (waiter) { const w = waiter; waiter = null; w(null); } },
      ask() { name = ''; coat = DOG_COATS[Math.floor(Math.random() * DOG_COATS.length)]; return new Promise((resolve) => { waiter = resolve; go('dog'); }); },
    };
  }

  // ---------- the daily trail challenge (SPEC v1.1 §3): one a day, a token and a card ----------
  function dailyObj() {
    const J = save.journey;
    if (!J || J.done || typeof JA.dailyChallenge !== 'function') return null;
    try { return JA.dailyChallenge(J, dayKeyOf(Date.now())) || null; } catch (e) { console.warn('[WagonWest] dailyChallenge', e); return null; }
  }
  function dailyInfo() {
    const dc = dailyObj();
    if (!dc) return null;
    const d = save.daily;
    const claimed = d.key === dayKeyOf(Date.now()) && d.id === dc.id && d.claimed;
    return { id: dc.id, text: dc.text, say: dc.say || dc.text, done: claimed || !!dc.done, claimed };
  }
  /** After every action that could finish today's challenge: claim it the moment it is done (once a day). */
  function checkDaily() {
    const J = save.journey;
    const dc = dailyObj();
    if (!dc) return;
    const key = dayKeyOf(Date.now());
    if (save.daily.key !== key || save.daily.id !== dc.id) save.daily = { key, id: dc.id, claimed: false };
    if (save.daily.claimed) return;
    let ok = false;
    try { ok = !!dc.check(J); } catch (e) { console.warn('[WagonWest] challenge check', e); }
    if (!ok) return;
    const t0 = num(J.tokens);
    let r = null;
    try { r = JA.claimChallenge(J, dc.id); } catch (e) { console.warn('[WagonWest] claimChallenge', e); }
    save.daily.claimed = true;
    if (r && r.ok === false) { app.persist(); return; }       // already claimed (on another device)
    const reward = (r && Number.isFinite(r.tokens) ? r.tokens : dc.reward && Number.isFinite(dc.reward.tokens) ? dc.reward.tokens : 1);
    if (num(J.tokens) === t0 && reward) J.tokens = t0 + reward;
    if ((r && r.card) || (dc.reward && dc.reward.card)) { try { dropCard(JA.cardForLeg(J, Math.random)); } catch (_) { /* ignore */ } }
    toast("Today's challenge: done! A token and a card");
    Audio.cash();
    app.persist(); refreshCash();
  }

  // ---------- the wagon upgrades (Outfit → Look → Wagon): the token and cash sink ----------
  const UP_EFFECT = { cover: '+1 day of weather protection: rain and frost leave the mood alone', tires: '+2 miles a day', barrel: 'Lean rations feel like plenty' };
  function ownsUpgrade(J, id) {
    if (!J) return false;
    try { if (typeof JA.upgradesOwned === 'function') { const o = JA.upgradesOwned(J); if (Array.isArray(o)) return o.includes(id); } } catch (_) { /* below */ }
    const u = J.upgrades;
    return Array.isArray(u) ? u.includes(id) : !!(u && u[id]);
  }
  function upgradeList() {
    const J = save.journey;
    const list = Array.isArray(JA.UPGRADES) ? JA.UPGRADES : [];
    return list.map((u) => {
      let cost = { tokens: u.tokens, cash: u.cash };
      try { if (J && typeof JA.upgradeCost === 'function') cost = JA.upgradeCost(J, u.id) || cost; } catch (_) { /* the list's price */ }
      return { id: u.id, name: u.name, tokens: num(cost.tokens, NaN), cash: num(cost.cash, NaN), effect: u.effect || u.text || u.blurb || UP_EFFECT[u.id] || '', owned: ownsUpgrade(J, u.id) };
    });
  }
  function buyUpgrade(id, how) {
    const J = save.journey;
    if (!J || typeof JA.buyUpgrade !== 'function') return false;
    let ok = false;
    try { ok = !!JA.buyUpgrade(J, id, how === 'cash' ? { cash: true } : { tokens: true }); } catch (e) { console.warn('[WagonWest] buyUpgrade', e); }
    if (ok) {
      const u = (JA.UPGRADES || []).find((x) => x.id === id);
      app.persist(); refreshCash(); Audio.cash();
      toast(`${u ? u.name : 'The upgrade'}: on the wagon!`);
    }
    return ok;
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
  $('#pause-wagon').addEventListener('click', () => { closePause(); if (screen === 'trail' && T) wagonPanel.open(); });
  $('#pause-camp').addEventListener('click', () => { closePause(); openCamp('trail').catch((e) => console.error('[WagonWest] camp', e)); });
  $('#btn-camp').addEventListener('click', () => {
    if (screen !== 'trail' || !T || T.busy || panelOpen() || paused) return;
    openCamp('trail').catch((e) => console.error('[WagonWest] camp', e));
  });

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
  // the shared Audio.music() loop is never started in this game: the trail has its own tunes (./meta/music.js)
  Audio.setSound(settings.sound); Audio.music(false); Sfx.setSound(settings.sound);
  try { Music.on(settings.music); } catch (_) { /* ignore */ }
  const unlock = () => { Audio.unlock(); Sfx.unlock(); tts.unlock(); Audio.setSound(settings.sound); try { Music.unlock(); } catch (_) { /* ignore */ } syncMusic(); };
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

  // the music goes quiet while a panel, the pause sheet or the Parent Zone is open, and comes back after
  const mo = new MutationObserver(() => syncMusic());
  for (const id of ['panel-marker', 'panel-problem', 'spell', 'card', 'mini', 'panel-pause', 'panel-wagon', 'pz']) { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); }

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
    app, pz, sync, tts, store, river, postOffice, results, hud, markerPanel, problemPanel, spellPanel, card, wagonPanel,
    get scene() { return scene; }, get screen() { return screen; }, get save() { return save; }, get facts() { return facts; },
    get travel() { return T ? { legId: T.leg.id, busy: T.busy, day: !!T.day } : null; }, get paused() { return paused; }, get mini() { return mini ? { kind: mini.kind, lb: mini.lb } : null; },
    JA, cloud, Music, cardPop, camp: screens.camp,
    get derby() { return derby ? { markers: derby.markers, bursts: derby.bursts.slice(), busy: derby.busy } : null; },
    get lastDerby() { return lastDerby; }, get lastQuickDraw() { return lastQuickDraw; }, get music() { return { ...musicState }; },
    dropCard: (id) => dropCard(id), checkDaily: () => checkDaily(), dogBerries: () => (T && !T.busy && save.journey && save.journey.dog ? (T.busy = true, dogBerries().finally(() => { if (T) { T.busy = false; T.last = 0; } }), true) : false),
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
