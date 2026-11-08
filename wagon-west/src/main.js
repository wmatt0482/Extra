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
// v1.2 (app part two, the "// ---- v1.2 (app two): ... ----" blocks): rivers as a choice (./ui/river.js: ford, float, ferry),
// the Columbia raft on the last leg, the buffalo stampede event, the people at the stops (./ui/people.js: the Talk row),
// deeds (./ui/deeds.js: checkDeeds after what can earn one, the pop, the Journal page, the results list), camp's arrows /
// wait-out. The scene's four mini-games run through playMini() / the scene event hook at the end of onSceneEvent.
// v1.4 (SPEC "v1.4", Frodo and the river; the "// ---- v1.4 ..." block): pure fun, nothing asks a question and nothing can be
// failed. The dog's nose on the trail (finds, a snake warning, the rabbit chase with the big name button, the berry patch and a
// quest item: afterDay's res.nose), the trail facts with their sounds and cards (res.fact; the Parent Zone can turn the far-off ones
// off), the dust devil (res.moment), the stampede's bison-thunder card, Fetch / Catch grasshoppers / Skip stones / Falling stars at
// camp, Fishing 2.0 (bait, a reel, the fish log; the summary card), skipping stones at the river stops, the dog joining at the
// Kansas River and the missing locket (the Talk row's quest people, the post office's mailed fallback), the journal's Finds and Fish
// log pages, the spoon and the horseshoes at the store. The journey decides everything (src/journey/{dog,fishing,quests,moments,
// collections}.js through sim.js); the scene draws it (the mock scene's hooks in tests); this file drives and speaks.
// v1.5 (SPEC "v1.5", The Long Trail; the "// ---- v1.5 ..." blocks): the trail is 20 legs and has forks (the fork panel at Fort Hall, South Pass and The
// Dalles: forkAt / chooseBranch), a toll (the Barlow Road: payToll), Laurel Hill (the rope slide: startSnub / applySnub), dry stretches (the water
// barrel), a second route (the Gold Road from the farm: the diggings, the pan and the cradle, the voyage home by sea) and a second trail's end
// (the Sacramento claim); every journey is a year (the ledger), starts from the last one (startSeason carries the cards, deeds, tokens, upgrades, the
// dog and v1.4's collections) and closes at its trail's end into the homestead (closeJourney: savings, Beaver money, the team); the homestead has its
// own screen (src/ui/homestead.js); card sets pay wagon decorations; the Pit Crew Check places the child on the first store or marker; word
// problems take the shape of the child's ladder (problemFor's tier). The journey decides, the scene draws, this file drives and speaks.
// v1.6 (The Lab, lab/SPEC.md §4.4; the "// ---- v1.6 (The Lab) ..." blocks): the game reports to the Lab through ./meta/labBridge.js ONLY (a marker, a trail problem, a river or
// letter word, a leg, a star, a choice, a farm piece, the day), never inside a frame and never able to break the game when /lab/ is missing; the Lab's XP pill sits in the trail
// HUD (#hud-lab) and its strip on the results (#res-lab); a combo moment is "Trail Cheer" (the party cheers); the Lab's wagon covers and the leader's outfits are drawn by the
// scene (cosmetics() is read at the start of every leg); the results end on a preview of the next stop (journey/preview.js) and, after the third leg of a local day, "That's a good
// place to stop for today."; and six choice moments (a shortcut that may soak a sack, a guide that saves a day: ./ui/choicePanel.js, journey/choices.js) are asked at their stops.
// No Lab call reads or writes cash, tokens or gold: the Lab's coins are the Lab's.

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
import { factAnswer, factParts, normFact } from '../../trail-blazer/src/facts/facts.js';
import { hintFor, spokenHint } from '../../trail-blazer/src/facts/hints.js';
import { cloudVoiceInfo } from '../../spell-jump/src/tts/voices.js';
import { loadSkills as loadFracSkills } from '../../fraction-fright/src/meta/save.js';
import { tierState } from '../../fraction-fright/src/skills/ladder.js';
import { fracName, fractionsOf, hashString, rngFrom, toleranceFor } from '../../fraction-fright/src/skills/items.js';
import * as Sim from './journey/sim.js';
import * as Problems from './journey/problems.js';
import * as Letters from './journey/letters.js';
import * as Economy from './journey/economy.js';
import { ANIMAL_BY_ID, ALL_LEGS, LEGS, LEG_BY_ID, GOODS } from './content/legs.js';
import { ROUTES, FORKS, SITES } from './content/routes.js';
import { TIERS, TIER_BY_ID } from './content/tiers.js';
import { FAMILIES } from './content/families.js';
import { PIECE_BY_ID } from './content/homestead.js';
import { CARD_SETS, DECOR_BY_ID } from './content/cards.js';
import { PERSON_BY_ID } from './content/people.js';
import { legList, routeStart, routeOfLeg, seasonOf as routeSeasonOf } from './journey/route.js';
import { checkAnswer, checkNext, checkProgress, applyCheck, createCheck } from '../../trail-blazer/src/facts/placement.js';
import { refreshFrontier } from '../../trail-blazer/src/facts/store.js';
import { COMPANION_BY_ID } from './content/companions.js';
import { CARDS, CARD_BY_ID } from './content/cards.js';
import { LOOKOUTS } from './content/lookouts.js';
import { EVENTS, EVENT_BY_ID } from './content/events.js';
import { NATIONS, NATION_BY_ID } from './content/nations.js';
import { FIND_BY_ID, WISH_BY_ID } from './content/finds.js';
import { RIVER_STOPS, FISH_BY_ID, BAIT_BY_ID, JUNK_BY_ID, WATER_NAMES } from './content/fish.js';
import { MOMENTS, DOG_LINES } from './content/moments.js';
import { QUEST_BY_ID } from './content/quests.js';
import { TRAIL_FACT_BY_ID } from './content/trailFacts.js';
import { Sfx } from './meta/sfx.js';
import { Music } from './meta/music.js';
import { registerWagonWestSync } from './meta/sync.js';
import { addLetter, dayKeyOf, defaultSave, loadSave, loadSettings, logKind, logPlay, removeSave, writeSave, writeSettings } from './meta/save.js';
import { UPDATE_NOTICE, createUpdateGuard, safeToReload } from './meta/selfUpdate.js';
import { STOCK, equipLook, grantLook, itemOf, rollCrate, wornDecor } from './ui/looks.js';
import { createPlayers } from './ui/players.js';
import { createTitle } from './ui/title.js';
import { companionSvg, createOutfit } from './ui/outfit.js';
import { createStore } from './ui/store.js';
import { createHud } from './ui/hud.js';
import { createWagonPanel, partySummary, skillOfCompanion } from './ui/wagonPanel.js';
import { createMarkerPanel, markerTexts } from './ui/markerPanel.js';
import { createProblemPanel, problemTexts } from './ui/problemPanel.js';
import { createCard } from './ui/card.js';
import { createRiver } from './ui/river.js';
import { createYearPicker } from './ui/yearPicker.js';
import { createForkPanel } from './ui/forkPanel.js';
import { createChoicePanel } from './ui/choicePanel.js';
import { CHOICE_LINES } from './content/choices.js';
import { labBridge } from './meta/labBridge.js';
import { createDiggings, pouchText, DIG_TEXT } from './ui/diggings.js';
import { createHomestead, workProblem, FARM_TEXT } from './ui/homestead.js';
// ---- v1.2 (app two): people and deeds ----
import { createPeople, START_STOP } from './ui/people.js';
import { createDeedPop } from './ui/deeds.js';
import { createCamp } from './ui/camp.js';
import { createCardPop, ownedCards, sayOf } from './ui/cards.js';
import { createToaster, popHeld } from './ui/toasts.js';
import { createPostOffice } from './ui/postOffice.js';
import { createJournal } from './ui/journal.js';
import { createFindPop, findLine } from './ui/finds.js';
import { createResults } from './ui/results.js';
import { createParentZone } from './ui/parentZone.js';
import { skinSpellPanel } from './ui/spellSkin.js';
import { createSpeech, splitSay, HEAD_START_MS } from './meta/speech.js';
import { FIXED_LINES, TEST_LINE, COACH_TEXT, CAMP_EVENING, DOG_OFFER, RAFT_INTRO, RIVER_ACROSS, HUNT_FISH_ONLY, HUNT_NO_ARROWS, COVER_LINE, spoken as spokenText, breakdownText, collectVoiceTexts, V15, dampLine as dampText } from './meta/voiceTexts.js';
import { listTexts, wordTexts, cloudLetterText } from '../../spell-jump/src/spelling/cloudVoice.js';

const VERSION = '1.8.0';
// the natural voice (src/meta/speech.js, src/meta/voiceTexts.js): the server makes clips of at most 200 characters, so a longer line
// is said (and prepared) a piece at a time; the fixed lines the screens say are in voiceTexts.js (FIXED_LINES)
const TUNES = ['susanna', 'buffalo', 'tucker'];
const DOG_COATS = ['brown', 'spotted', 'black'];   // the scene's three coats
const QD_TO = 7;                 // Quick Draw: first to 7 right facts
const DERBY_MARKERS = 4;         // Fort Derby: 400 m, a marker every 100 m from the start line = 4 facts
const DERBY_LENGTH = 400;
export { splitSay };
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
  // Toasts and pops wait while a panel, card, question or mini-game is open, and sit only where they touch nothing the
  // child reads or presses (src/ui/toasts.js; playtest 1.2 W3-W5). v2/mini/derby are declared further down: read lazily.
  let dayFlow = false;                    // a trail day's marker / event is about to open: its toasts wait for it (their lines would be cut by it)
  let vignetteOn = false;               // (v1.4 playtest: a trail fact's far-off scene plays with nothing on top of it: toasts wait, as they do for a mini-game)
  const readingOpen = () => { try { return !!(app.overlayOpen() || v2.play || v2.bar || mini || derby || dayFlow || vignetteOn); } catch (_) { return false; } };
  const toaster = createToaster(toastsEl, { blocked: readingOpen, say: (t) => speech.later(t), speaking: () => speech.ambientPending });
  const panelOpen = () => markerPanel.isOpen || problemPanel.isOpen || spellPanel.isOpen || card.isOpen || forkPanel.isOpen || choicePanel.isOpen || !!mini || !!derby;
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
    /** The legs of the journey in progress, in order (its plan: 20 on the Oregon Trail, 24 to California, 12 on the Gold Road); the default plan with no journey. */
    get legs() { return planLegs(save.journey); },
    legById: (id) => LEG_BY_ID[id] || null,
    beat,
    overlayOpen: () => panelOpen() || pz.isOpen || wagonPanel.isOpen || !$('#panel-pause').hidden,
    persist: () => { v2CheckDeeds(); writeSave(currentPlayerId, save); },   // (v1.2 app two: a deed is earned the moment its counter says so)
    saveOf: (id) => (id === currentPlayerId ? save : loadSave(id)),
    /** "Leg 3 of 20 · 1847" for the picker tile and the Parent Zone. */
    whereFor(id) {
      const s = app.saveOf(id), J = s.journey;
      if (!J) return 'Ready to pack the wagon';
      if (J.done) return `${J.route === 'gold-road' ? 'Home with gold' : 'In the valley'} · ${app.seasonOf(J).year}`;
      return `Leg ${(J.legIndex || 0) + 1} of ${(Array.isArray(J.plan) && J.plan.length) || LEGS.length} · ${app.seasonOf(J).year}`;
    },
    season: () => app.seasonOf(save.journey),
    /** A journey's tier as the screens read it: { id, name ('Rookie'), emoji, priceMult, numberMult, year }. */
    seasonOf: (J) => ({ ...routeSeasonOf(J ? J.tier || J.season : null), year: J && Number.isFinite(J.year) ? J.year : yearNow() }),
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
      await voiceFor([TEST_LINE], 9000);
      const r = await Promise.race([app.say(TEST_LINE), sleep(14000)]);
      const info = cloud.voice ? cloudVoiceInfo(cloud.voice) : null;
      return { engine: r ? speech.engine : '', name: info ? info.name : '' };
    },
    /** Read a line aloud (a voice available), a long one a piece at a time: it replaces what is playing. Returns the speech
     *  promise (true spoken · false silent: the natural voice could not make the clip in time · null cut off). */
    say(text) { return speech.say(text); },
    /** Several lines, one after the other (a newer speech cuts the rest off). */
    sayAll(list) { return speech.say((list || []).filter(Boolean)); },
    /** A toast's / pop's line: it waits for the voice to be idle and for the open panels, and never cuts anything. */
    sayLater(text) { return speech.later(text); },
    /** The natural voice, just in time: ask the server for these lines and wait (a moment) for them. */
    voiceFor,
    /** Say a line and wait for it (at most 25 s: the clip's wait and the line), and at least minMs. */
    sayWait(text, minMs = 0) { return Promise.all([Promise.race([app.say(text), sleep(25000)]), sleep(minMs)]); },
    /** A line as the voice says it ("$56" → "56 dollars"; no doubled full stop after a comma or a full stop). */
    spoken: spokenText,
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
    /** Parents → "Reset this journey only" (v1.5): the journey in progress starts over from mile 0 with the same wagon, team and party; the farm, the
     *  ledger, the cards, the sets and what a journey carries stay. The stamp makes the other devices drop their older copy of the journey. */
    resetJourneyFor(id) {
      const s = app.saveOf(id);
      const old = s.journey;
      if (old && !old.done) {
        let n = null;
        try { n = JA.startSeason(old, { route: old.route, tier: old.tier || 'rookie', family: old.family, animal: old.animal, companions: old.companions, wagonName: old.wagonName, hunting: old.opts && old.opts.hunting, ledger: s.ledger, farm: s.farm, seed: hashString(`${id}:reset:${Date.now()}`) }); } catch (e) { console.warn('[WagonWest] reset journey', e); }
        s.journey = n || null;
      }
      s.trip = null;
      s.journeyResetAt = Date.now();
      writeSave(id, s);
      if (id === currentPlayerId) { stopTravel(); if (s.journey) { ensureJ(); applySceneParty(); } refreshCash(); }
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
      try {
        const f = JA.foodToNextFort(J);
        if (!f || !f.lb) return '';
        // v1.7.1: the wagon carries LOAD.foodLb; a stretch that needs more than that is a rations (or a hunt) decision, and the hint says so
        const cap = foodCap();
        return f.lb > cap ? `You'll need about ${money(f.lb)} lb to reach ${f.stop}, but the wagon carries only ${money(cap)} lb: plenty rations or a hunt on the way will stretch it.`
          : `You'll need about ${money(f.lb)} lb to reach ${f.stop}${f.enough ? ': you have enough' : ''}.`;
      } catch (_) { return ''; }
    },
    /** v1.7.1: the wagon's food limit (LOAD.foodLb) and the room left under it, in pounds. */
    foodCap: () => foodCap(),
    foodRoom() { const J = save.journey; return J ? foodRoomOf(J) : 0; },
    /** v1.7.1: this stop's damp flour line ({ text, say }) for the store's side, or null. */
    dampNote() { const J = save.journey, d = J && J.trip && J.trip.damp; return d && num(d.lb) > 0 ? dampText(d) : null; },
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
    get ledger() { return save.ledger; },
    get farm() { return save.farm; },
    get cloud() { return cloud; },
    // ---- v1.6 (The Lab) ----
    labReady: () => labBridge.ready,
    labSummary: () => labSummary(),
    labPickerButton: (mount) => labBridge.mountPickerButton(mount),
    openLab: (o) => labBridge.openHome(o || {}),
    openLabParent: () => labBridge.openParent({ unlocked: true }),
    pendingChoice,
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
  // the panels read their questions through the same voice as everything else (src/meta/speech.js: one line at a time, a clip
  // or silence, never the device voice while the natural voice is in use); `speech` is made below, before any panel speaks
  const panelTts = { get available() { return tts.available; }, say: (t) => speech.say(t), cancel: () => speech.cancel(), unlock: () => tts.unlock(), reprobe: () => tts.reprobe() };
  const markerPanel = createMarkerPanel($('#panel-marker'), { tts: panelTts, audio: Audio, sfx: Sfx });
  const problemPanel = createProblemPanel($('#panel-problem'), { tts: panelTts, audio: Audio, sfx: Sfx });
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
    // ---- v1.5: the year picker and the homestead ----
    year: createYearPicker(app), farm: createHomestead(app),
  };
  const forkPanel = createForkPanel(app);
  const choicePanel = createChoicePanel(app);       // v1.6 (The Lab): the six choice moments
  const diggings = createDiggings(app);
  let findPop = null;                     // (v1.4: the dog's finds and the wishes pop in the same place as a card: one at a time, a card first)
  const cardPop = createCardPop($('#cardpop'), { sfx: Sfx, hold: (root) => popHeld(root, { blocked: readingOpen, hold: () => screen === 'results' }) || !!(findPop && findPop.visible) });
  // the voice: Spell Jump's tts, with the natural voice when the family has a code and the player picked one in Spell Jump
  const cloud = createCloudVoice({ getCode: () => sync.code, getWords: () => { try { return currentPlayerId ? WS.activeList(Profiles.loadWords(currentPlayerId)).words : []; } catch (_) { return []; } }, audio: Audio });
  tts.setCloud(cloud);
  // the voice ducks the trail's music (and softens Spell Jump's effects, as in the siblings)
  const duckMusic = (on) => { Audio.voice(on); try { Music.duck(on); } catch (_) { /* ignore */ } };
  tts.setOnSpeaking(duckMusic);
  // every line the game says goes through `speech` (SPEC v1.3.2): one at a time; toasts' and pops' lines wait for the panels,
  // the dictation and a card, and for the voice to be idle; a natural-voice line without its clip is skipped, not robot-read
  const speech = createSpeech({ tts, cloud, duck: duckMusic, hold: () => readingOpen() });
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
  /** Everything the game says that can be known ahead (src/meta/voiceTexts.js), asked for in the order it is needed and in
   *  small batches that step aside for a line waiting for its own clip (src/meta/speech.js): the dictation (the week's words
   *  and the letters of the alphabet), the fixed lines and the river, THIS leg (lookout, nation, people and their offers,
   *  letter), the child's mile-marker sentences, the next leg, then the rest of the trail. The server is asked only for what
   *  this device has no clip of. Called at player select, at a voice change and at every leg start. */
  function prepareVoice() {
    if (!currentPlayerId || !cloud.active) return;
    let words = [];
    try { words = WS.activeList(Profiles.loadWords(currentPlayerId)).words; } catch (_) { words = []; }
    const factTexts = [];
    try { if (facts) for (const f of activeFacts(facts)) for (const flip of [false, true]) factTexts.push(...markerTexts(f, flip)); } catch (e) { console.warn('[WagonWest] activeFacts', e); }
    const J = save.journey;
    const legId = (J && J.legId) || LEGS[0].id;
    const c = collectVoiceTexts({ legId, plan: J && Array.isArray(J.plan) ? J.plan.map((p) => p.id) : null, farmName: farmName(), factTexts, names: ((J && J.companions) || []).map((id) => (COMPANION_BY_ID[id] || {}).name).filter(Boolean), animal: J ? animalName() : '', playerName: (app.player && app.player.name) || '', dogName: (J && J.dog && J.dog.name) || '' });
    // Nov 3: only what this leg and the next can say. Preparing the whole trail (c.rest, ~82k characters) spent the
    // family's daily clip budget and pushed Spell Jump's new words into the device voice; the rest comes just in time.
    speech.prepareBulk([...listTexts(words), ...c.first, ...c.leg, ...c.facts, ...c.next]);
  }
  /** Just in time: the sentences about to be said (a generated problem, a letter, a riddle) as clips. Waits for them at most
   *  `ms` (the screen opens meanwhile: the speech itself waits for its clip); resolves at once when the device voice reads. */
  function voiceFor(texts, ms = HEAD_START_MS) { return speech.ready(texts, ms); }
  /** A trail card with its sentence ready in the natural voice. */
  async function showCard(opts) { await voiceFor([opts.say || opts.text]); if (findPop) findPop.suspend(); return card.show(opts); }      // (a find pop up over the card's place steps aside)
  const pz = createParentZone(app);

  function refreshCash() {
    const J = save.journey;
    // v1.8 (cohesion): story money is labelled "Wagon purse" (the Lab's coins are "Lab coins", never a "$")
    const amt = `$${money(J ? J.cash : 0)}`;
    const html = `${COIN}<span class="cp-txt"><small class="cp-label">Wagon purse</small><span>${amt}</span></span>`;
    for (const el of $$('.cash-pill')) { el.innerHTML = html; el.setAttribute('aria-label', `Wagon purse: ${amt}`); }
  }
  const replaceInPlace = (obj, fresh) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); };
  const partySize = (J) => { try { if (JA.partySize) return JA.partySize(J); } catch (_) { /* below */ } return ((J.party && J.party.length) || 3) + 1; };
  /** The leg the party is on: the journey's plan leg (a branch's own miles: Soda Springs is 50 on the Sublette Cutoff), not the content's default. */
  const curLeg = () => { const J = save.journey; if (!J) return null; try { if (JA.currentLeg) { const l = JA.currentLeg(J); if (l) return l; } } catch (_) { /* below */ } return LEG_BY_ID[J.legId] || null; };
  /** The legs of a journey in order: its plan installed as the module table (the sim does it at every entry point); the default plan with none. */
  function planLegs(J) {
    if (!J) return LEGS;
    try { JA.usePlan(J); const l = legList(); if (Array.isArray(l) && l.length) return l; } catch (_) { /* below */ }
    return LEGS;
  }

  // ---------- v1.2: the wagon's supplies, the skills, the forecast, the family map ----------
  const animalName = () => (save.journey && save.journey.animal === 'mules' ? 'mules' : 'oxen');
  /** Food by kind in lb: the journey's J.foods, else its single J.food split 50 / 30 / 20 (a save from before 1.2). */
  function foodKindsOf(J) {
    const f = J.foods && typeof J.foods === 'object' ? J.foods : null;
    if (f) return { flour: num(f.flour), bacon: num(f.bacon), beans: num(f.beans), other: num(f.other) };
    const t = Math.max(0, num(J.food)), a = Math.round(t * 0.5), b = Math.round(t * 0.3);
    return { flour: a, bacon: b, beans: t - a - b, other: 0 };
  }
  /** v1.7.1: the most food the wagon carries (the journey's LOAD.foodLb; an older journey module: no limit) and the room left under it. */
  const foodCap = () => (JA.LOAD && Number.isFinite(JA.LOAD.foodLb) ? JA.LOAD.foodLb : Infinity);
  const foodRoomOf = (J) => (typeof JA.foodRoom === 'function' ? JA.foodRoom(J) : Math.max(0, foodCap() - num(J.food)));
  /** Days of food at the current rations (the journey's foodDays(J), else worked out from foodNeeded). */
  function foodDaysOf(J) {
    try { if (typeof JA.foodDays === 'function') { const d = JA.foodDays(J); if (Number.isFinite(d)) return Math.max(0, Math.floor(d)); } } catch (e) { console.warn('[WagonWest] foodDays', e); }
    if (typeof JA.foodNeeded !== 'function') return null;
    try { const per = JA.foodNeeded(partySize(J), J.rations || 'plenty', 1, (ANIMAL_BY_ID[J.animal] || {}).feedLb || 0); return per > 0 ? Math.floor(num(J.food) / per) : null; } catch (_) { return null; }
  }
  const goodsOf = (J) => { const g = J.goods && typeof J.goods === 'object' ? J.goods : {}; return { parts: num(J.parts !== undefined ? J.parts : g.parts), rope: num(g.rope), blankets: num(g.blankets), arrows: num(g.arrows), pelts: num(g.pelts), yoke: num(g.yoke), spoon: num(g.spoon), horseshoes: num(g.horseshoes), hoppers: num(g.hoppers) }; };
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
      food: { kinds: foodKindsOf(J), days: foodDaysOf(J), stop, stopDays, lb: num(J.food), cap: foodCap() },      // (v1.7.1: lb and the wagon's limit, cap)
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
    if (screen === 'camp') t.dataset.scope = 'camp';          // (v1.5 playtest U1: a line made at camp goes with camp)
    else if (screen === 'stop') t.dataset.scope = 'stop';     // (v1.7.1, the 1.5 playtest's "ugly" 11: a stop's line, like a person's "Traded 12 trade tokens ...", goes when the stop's screens change)
    toaster.add(t, 4800, { say });          // (the line is said when the toast is shown, behind whatever is playing)
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
    if (screen === 'camp') t.dataset.scope = 'camp';
    toaster.add(t, 5200, { say: c && !line.startsWith(c.name) ? `${c.name}: ${line}` : line });
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
    labAttach();                                       // v1.6 (The Lab): the Lab knows who is playing
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
  function ensureJ() {
    const J = save.journey;
    if (J && typeof JA.ensureJourney === 'function') { try { JA.ensureJourney(J); } catch (e) { console.warn('[WagonWest] ensureJourney', e); } }
    // v1.4: the Parent Zone's "Far-off sounds on the trail" (this device's setting) is written onto the journey (J.opts.farSounds)
    if (J && typeof JA.setTrailSounds === 'function') { try { JA.setTrailSounds(J, settings.farSounds !== false); } catch (e) { console.warn('[WagonWest] setTrailSounds', e); } }
  }

  // Ghost-click guard (same as the other games): swallow a click that lands just after a screen change when its
  // pointerdown came before the change
  let lastGo = 0, lastDown = 0;
  document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, true);
  document.addEventListener('click', (e) => { const t = performance.now(); if (lastDown < lastGo && t - lastGo < 500) { e.preventDefault(); e.stopPropagation(); } }, true);

  const STAGE_SCREENS = ['trail', 'stop', 'store', 'river', 'post', 'results', 'home', 'camp', 'derby', 'dog', 'farm'];
  function go(name, arg) {
    lastGo = performance.now();
    closePause();
    if (wagonPanel.isOpen) wagonPanel.close();
    if (name !== 'trail' && T) stopTravel();
    if (!['stop', 'store', 'river', 'post', 'home', 'derby', 'dog', 'camp'].includes(name)) { if (store.isOpen) store.leave(); }
    if (name !== 'stop' && diggings.isOpen) diggings.hide();                  // (v1.5: leaving the creek)
    if (forkPanel.isOpen) forkPanel.hide();                                  // (v1.5: a fork left pending stays pending)
    if (choicePanel.isOpen) choicePanel.hide();                              // (v1.6: so does a choice moment)
    if (name === 'players' || name === 'newplayer') labDetach();             // (v1.6: back at the picker: the Lab forgets the player)
    const was = screen;
    if (name !== 'camp' && screens.camp && screens.camp.isOpen && !['dog'].includes(name)) screens.camp.leave();
    if (name !== 'derby' && derby) quitDerby();
    for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
    for (const [k, s] of Object.entries(screens)) if (k !== name && s.hide) s.hide();
    screen = name;
    document.documentElement.dataset.screen = name;
    toaster.clear();                      // (what showed on the screen left, and the plain lines that waited for it, are done; an effect line stays queued)
    if (was !== name) toaster.clearScope(was);      // (v1.5 playtest U1: an effect line that belonged to the screen left, like camp's "Three throws!", goes with it)
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
  const MOOD_BY_SCREEN = { trail: 'trail', derby: 'trail', camp: 'camp', results: 'camp', title: 'camp', stop: 'camp', store: 'camp', river: 'trail', journal: 'camp', outfit: 'camp', home: 'camp', dog: 'camp', post: 'post', year: 'camp', farm: 'camp' };
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
  function toast(text, say = '') {
    toaster.add(h('div', { class: 'toast' }, text), 2700, { say });
  }

  // ---------- settings (this device) ----------
  function setSetting(key, value) {
    settings[key] = !!value;
    writeSettings(settings);
    if (key === 'sound') { Audio.setSound(settings.sound); Sfx.setSound(settings.sound); }
    if (key === 'music') { Audio.music(false); try { Music.on(settings.music); } catch (_) { /* ignore */ } }
    if (key === 'hunting' && save.journey && typeof JA.setHunting === 'function') { try { JA.setHunting(save.journey, settings.hunting); app.persist(); } catch (_) { /* ignore */ } }
    if (key === 'farSounds' && save.journey && typeof JA.setTrailSounds === 'function') { try { JA.setTrailSounds(save.journey, settings.farSounds); app.persist(); } catch (_) { /* ignore */ } }
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

  // ---- v1.6 (The Lab): the bridge, the reports, Trail Cheer and the looks (lab/SPEC.md §4.4). Everything here is a no-op while /lab/ is missing. ----
  const labHud = labBridge.hud({ mount: $('#hud-lab'), compact: true });           // the XP pill in the trail HUD (a handle that mounts when the Lab has loaded)
  const labResults = labBridge.results({ mount: $('#res-lab') });                  // the strip under the results' pay lines
  let labAttached = null;
  function labAttach() {
    const p = app.player;
    if (!p) return;
    labAttached = p.id;
    labBridge.attach({ playerId: p.id, name: p.name, color: p.color, gentle: false, reducedMotion: !!settings.reducedMotion, sound: settings.sound !== false });
    try { labHud.update(); labResults.update(); } catch (_) { /* ignore */ }
  }
  function labDetach() { if (labAttached) { labAttached = null; labBridge.detach(); } }
  /** v1.8 (cohesion): this game's card on the Lab home: the last stop reached, "N of 20 stops", today's challenge. Plain text, no pressure words. */
  function labSummary() {
    if (!labAttached) return;
    try {
      const J = save.journey;
      const legs = planLegs(J), n = legs.length;
      let level = (legs[0] && legs[0].from) || 'Independence', line = `0 of ${n} stops`;
      if (J) {
        const idx = Math.max(0, Math.min(n, num(J.legIndex)));
        const prev = idx > 0 ? legs[idx - 1] : null;
        level = J.done ? (J.route === 'gold-road' ? 'Home with gold' : 'In the valley') : prev ? ((prev.stop && prev.stop.name) || prev.name || 'On the trail') : ((legs[0] && legs[0].from) || 'Independence');
        line = `${J.done ? n : idx} of ${n} stops`;
      }
      let today = '';
      try { const dc = dailyInfo(); if (dc) today = dc.done ? "Today's challenge is done" : "Today's challenge is open"; } catch (_) { /* none */ }
      labBridge.summary({ level, line, today });
    } catch (_) { /* never in the way */ }
  }
  // the Lab chip: top-left of the title, once per page; the phone variant under 520 px wide (re-mounted when the window crosses it)
  let chip = null, chipCompact = null;
  function mountLabChip() {
    const compact = window.innerWidth < 520;
    if (chip && chipCompact === compact) return;
    if (chip) chip.destroy();
    chipCompact = compact;
    chip = labBridge.mountChip($('#title-lab'), { compact, theme: 'dark', current: 'ww' });
  }
  mountLabChip();
  window.addEventListener('resize', () => { try { mountLabChip(); } catch (_) { /* ignore */ } });
  /** One event to the Lab (never in a frame loop, once per event); a combo moment (every fifth answer in a row without a miss) is Trail Cheer. Returns the receipt (EMPTY when the Lab is off). */
  function labReport(ev) {
    if (!labAttached) return null;
    let r = null;
    try { r = labBridge.report(ev); } catch (_) { r = null; }
    if (r && r.combo && r.combo.moment) labMoment(r.combo.name || 'Trail Cheer');
    return r;
  }
  /** Trail Cheer: the party cheers (about a second) and a toast names it, once the panel the answer came from has closed (the scene is behind it). */
  function labMoment(name) {
    let tries = 0;
    const go1 = () => {
      if (!labAttached) return;
      if ((app.overlayOpen() || !!mini || !!derby || !!v2.play) && tries++ < 50) { setTimeout(go1, 160); return; }       // (a panel, a card, a mini-game: wait; the day's own toasts do not hold the cheer)
      S('cheer'); try { Sfx.cheer(); } catch (_) { /* ignore */ }
      toast(`${name}!`);
      lastCheer = { name, at: Date.now() };
    };
    setTimeout(go1, 120);
  }
  let lastCheer = null;
  /** The Lab's looks for this round: { cover, outfit } as the slot values the Lab lists as ready ('ww.cover.stripes'), else null (the game's own look). Read at every leg start, not once. */
  function labLooks() {
    let c = null;
    try { c = labBridge.cosmetics(); } catch (_) { c = null; }
    const s = (c && c.slots) || {}, ready = (c && c.ready) || [];
    const ok = (v) => (typeof v === 'string' && ready.includes(v) ? v : null);
    return { cover: ok(s.cover), outfit: ok(s.outfit) };
  }
  labBridge.whenReady(() => { try { if (screen === 'title') screens.title.show(); } catch (_) { /* ignore */ } });   // (the title's Lab button and the Parent Zone's row show once the Lab is there)
  labBridge.onChange(() => { try { if (screen === 'title' || screen === 'results') { labHud.update(); labResults.update(); } } catch (_) { /* ignore */ } });

  // ---------- the scene's look ----------
  function applySceneParty() {
    const J = save.journey;
    if (!J) return;
    S('setParty', {
      animal: J.animal,
      companions: partyLook(),
      wagon: { paint: app.paintColor(), flag: save.cosmetics.equipped.flag, name: J.wagonName || '', decor: wornDecor(save.cosmetics), barrel: !!(J.upgrades && J.upgrades.barrel), cover: labLooks().cover },       // (v1.6: the Lab's cover, null = the canvas)
      dog: J.dog ? { name: J.dog.name, coat: J.dog.coat, muddy: !!J.dog.muddy } : null,
      packMules: J.route === 'gold-road',                      // (v1.5: two pack mules walk beside the wagon on the Gold Road)
    });
  }
  /** The party as the scene draws it: [{ id, hat, color }] (the first companion wears the hat the child equipped). */
  function partyLook() {
    const J = save.journey;
    if (!J) return [];
    const hat = save.cosmetics.equipped.hat;
    const ids = (J.companions && J.companions.length ? J.companions : (J.party || []).map((p) => p.id)).slice(0, 3);
    const outfit = labLooks().outfit;                         // v1.6 (The Lab): the leader's plain clothes (null = their own)
    return ids.map((id, i) => { const c = COMPANION_BY_ID[id] || { hat: 'wide', color: '#d9653b' }; return { id, hat: i === 0 && hat !== 'none' ? hat : c.hat, color: c.color, ...(i === 0 && outfit ? { outfit } : {}) }; });
  }
  const backdropFor = (leg) => ({ river: 'river', fort: 'fort', landmark: 'landmark', home: 'valley', gold: 'diggings' }[leg && leg.stop && leg.stop.kind] || 'landmark');

  // ---------- a new year → the outfit → the start store → the trail ----------
  // ---- v1.5: the year (the ledger), the picker, the outfit, startSeason ----
  const yearNow = () => (save.ledger && save.ledger.year) || 1847;
  const journeyN = () => ((save.ledger && save.ledger.journeys && save.ledger.journeys.length) || 0) + 1;
  let pendingNew = { route: 'emigrant', tier: 'rookie' };           // what the year picker chose, for the Outfit that follows
  /** What the year picker shows: the year, the routes with whether they are open (and why not), the tiers with how they open. */
  function yearInfo() {
    const L = save.ledger;
    const open = JA.tiersOpen(L);
    return {
      year: L.year, journeyN: journeyN(), chooseTier: settings.chooseTier !== false,
      routes: JA.routesOpen(L).map((x) => ({ id: x.id, name: (ROUTES[x.id] || {}).name || x.id, open: x.open, why: x.why })),
      tiers: TIERS.map((t) => ({ ...t, open: !!open[t.id] })),
    };
  }
  /** "A new year" (or the first pack of the wagon): the first journey ever goes straight to the Outfit (the emigrant trail at Rookie), later years pick where and how hard. */
  function beginYear() {
    const J = save.journey;
    if (J && J.done && !J.closed) closeFinished(J);
    pendingNew = { route: 'emigrant', tier: 'rookie' };
    if (!save.ledger.journeys.length && (!J || !J.done)) { go('outfit', { fresh: true, route: 'emigrant', tier: 'rookie' }); return; }
    go('year');
  }
  function startYear(pick) {
    const info = yearInfo();
    const route = (info.routes.find((x) => x.id === (pick && pick.route)) || {}).open ? pick.route : 'emigrant';
    const tier = (info.tiers.find((x) => x.id === (pick && pick.tier)) || {}).open && info.chooseTier ? pick.tier : 'rookie';
    pendingNew = { route, tier };
    go('outfit', { fresh: true, route, tier });
  }
  /** What the Outfit needs: whether it has a Family step (a relative's wagon comes west from the second emigrant journey), the year, the last journey's party. */
  function outfitContext(opts = {}) {
    const route = (opts && opts.route) || pendingNew.route || 'emigrant';
    const n = journeyN();
    const prev = save.journey;
    return { family: route === 'emigrant' && n >= 2, year: yearNow(), journeyN: n, route,
      familyDefault: route === 'emigrant' && n >= 2 ? FAMILIES[(n - 2) % FAMILIES.length].id : 'own',
      defaults: prev ? { wagonName: prev.wagonName || '', animal: prev.animal || 'oxen', companions: (prev.companions || []).slice(0, 3) } : null };
  }
  /** A finished journey that was never closed (a 1.3 save done in the valley): bank it into the farm and write the ledger. */
  function closeFinished(J) {
    let c = null;
    try { c = JA.closeJourney(J, save.ledger, save.farm, { at: Date.now() }); } catch (e) { console.warn('[WagonWest] closeJourney', e); }
    if (c && c.site && save.farm.sites[c.site] && save.farm.sites[c.site].name && c.site === 'willamette' && !save.homestead) save.homestead = save.farm.sites[c.site].name;
    app.persist();
    return c;
  }
  async function outfitDone(draft, { fresh }) {
    const old = save.journey;
    if (fresh || !old) {
      const prev = old;
      const common = { family: draft.family || 'own', animal: draft.animal, companions: draft.companions, wagonName: draft.wagonName, ledger: save.ledger, farm: save.farm, hunting: settings.hunting !== false, seed: hashString(`${currentPlayerId}:${Date.now()}`) };
      let n = null;
      try { n = JA.startSeason(prev || null, { route: pendingNew.route, tier: pendingNew.tier, ...common }); } catch (e) { console.warn('[WagonWest] startSeason', e); }
      if (!n) { try { n = JA.startSeason(prev || null, { route: 'emigrant', tier: 'rookie', ...common }); } catch (e) { console.warn('[WagonWest] startSeason', e); } }
      if (!n) n = JA.createJourney({ tier: 'rookie', wagonName: draft.wagonName, animal: draft.animal, companions: draft.companions, seed: common.seed });
      save.journey = n;
      pendingNew = { route: 'emigrant', tier: 'rookie' };
      carryOver(prev, save.journey);                         // (the cards, if startSeason was not the one to carry them)
      ensureJ();
      save.trip = null;
      if (typeof JA.setHunting === 'function') try { JA.setHunting(save.journey, settings.hunting !== false); } catch (_) { /* ignore */ }
      app.persist();
      applySceneParty();
      await startStore();
      return;
    }
    const J = old;
    const partyChanged = J.animal !== draft.animal || String(J.companions || []) !== String(draft.companions);
    if (partyChanged && app.partyEditable()) {
      // nothing has happened on the trail yet: the journey is made again with the new party (the store's buys kept)
      const keep = { cash: J.cash, parts: J.parts, goods: J.goods, foods: J.foods, animals: J.animals, tokens: J.tokens, cards: J.cards, deeds: J.deeds, upgrades: J.upgrades, challenges: J.challenges, dog: J.dog, farmGift: J.farmGift };
      if (!J.foods) keep.food = J.food;
      const n = JA.createJourney({ route: J.route, tier: J.tier || J.season, year: J.year, journeyN: J.journeyN, family: J.family, branches: J.branches, wagonName: draft.wagonName, animal: draft.animal, companions: draft.companions, seed: J.seed, hunting: J.opts && J.opts.hunting });
      for (const [k, v] of Object.entries(keep)) if (v !== undefined) n[k] = v;
      save.journey = n;
    } else J.wagonName = draft.wagonName;
    app.persist();
    applySceneParty();
    go('title');
  }
  /** What a new journey keeps from the old one: the trail cards (a collection across years). startSeason carries the rest (SPEC v1.5 §3.6: the cards, the deeds,
   *  the tokens, the upgrades, the challenges, the dog and v1.4's collections); the dog alone for a journey the 1.4 way. */
  function carryOver(prev, n) {
    if (!prev || !n) return;
    if (prev.cards && (!n.cards || (Array.isArray(n.cards) && !n.cards.length))) n.cards = JSON.parse(JSON.stringify(prev.cards));
  }
  /** The start of the route: Independence, or (the Gold Road) the farm and the news from California; its people, then the store, then the trail. */
  async function startStore() {
    const J = save.journey;
    const start = routeStart(J.route) || ROUTES.emigrant.start;
    S('setBackdrop', 'fort');
    if (J.route === 'gold-road') {
      go('stop');
      const look = LOOKOUTS['gold-news'];
      await showCard({ kicker: 'News from California!', title: 'Gold!', text: look ? look.text : '', say: look ? look.say : '', tone: 'lookout', button: 'To the store' });
      if (screen !== 'stop') return;
      dropCard('gold-news');
      if (num(J.farmGift) > 0) { const t = `The farm sends ${num(J.farmGift)} lb of food along.`; effectToast(t, t); }
    } else if (peopleUI.has(START_STOP)) {
      // v1.2 fix: the start town has people too (Mr. Hale, Clara, Amos): the same Talk row a fort has, then the store
      go('stop');
      const on = await peopleUI.visit(START_STOP);
      if (!on || screen !== 'stop') return;
    }
    let leg = null;
    try { leg = JA.storeLeg ? JA.storeLeg(J) : null; } catch (_) { leg = null; }
    await offerPlacement('store');                 // (v1.5: the Pit Crew Check, on the first store or marker; "Later" asks again at the next)
    if (screen === 'players') return;
    const ok = await store.open({ leg, place: (start.store && start.store.name) || (LEGS[0] && LEGS[0].from) || 'Independence', nextText: 'Hit the trail' });
    if (ok) hitTrail();
  }

  // ---------- the store ----------
  /** The shape the child's ladder gives a word problem (SPEC v1.5 §3.9b): 0 and 1 are 1.3.3's, 2 asks the ration and distance in two steps and the change on a buy. */
  const probTier = () => { try { return typeof JA.problemTierFor === 'function' ? JA.problemTierFor(facts, Date.now()) : 1; } catch (_) { return 1; } };
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
    // v1.3.3: what the problem REALLY asked (p.asked, from the numbers in its sentence), not the fact its numbers were drawn
    // from: a purse-capped "9 × 12" is a 9 × 6, a season-scaled price or a capped trade is another fact (or none)
    const k = p && typeof p.fact === 'string' ? (p.asked !== undefined ? (p.asked ? normFact(p.asked) : null) : normFact(p.fact)) : null;
    if (!k) return null;
    if (pick && normFact(pick.fact) === k) return k;
    const fp = factParts(k);
    if (!fp) return null;
    if (fp.op === 'x') return fp.a >= 1 && fp.b <= 12 && fp.a <= 12 ? k : null;
    if (fp.op === '/') return fp.b >= 1 && fp.b <= 12 && fp.a / fp.b <= 12 ? k : null;
    return null;
  }
  // ---- v1.5: the Pit Crew Check (SPEC v1.5 §3.9a): offered on the first store or mile marker while the child's ladder is untouched ----
  let placing = false;
  /** Offer the check ("Before you answer questions, the pit crew checks what you've got. About 15 quick facts." · Start · Later): never a gate, never a timer;
   *  "Later" asks again at the next store or marker, at most three times. Resolves true when the check was taken. */
  async function offerPlacement(where) {
    if (placing || !facts || !currentPlayerId) return false;
    let need = false;
    try { need = !!JA.needsPlacement(facts, { offered: num(save.seen.placeOffers) }); } catch (e) { console.warn('[WagonWest] needsPlacement', e); }
    if (!need) return false;
    placing = true;
    try {
      save.seen.placeOffers = num(save.seen.placeOffers) + 1;
      app.persist();
      lastPlacement = { where, took: false };
      const c = await showCard({ kicker: 'The pit crew', title: 'Pit Crew Check', text: V15.PLACE_OFFER, say: V15.PLACE_SAY, tone: 'coach', button: 'Start', alt: 'Later' });
      if (c !== true) return false;
      const done = await runPlacement();
      lastPlacement.took = done;
      return done;
    } finally { placing = false; }
  }
  let lastPlacement = null;
  /** The check itself: Trail Blazer's staircase (createCheck with the journey's placementSetup) on the marker panel in 'check' mode; the answers move the
   *  ladder (applyCheck writes the records, refreshFrontier moves the frontier) so the very next problem takes the child's shape. */
  async function runPlacement() {
    const d = facts;
    const setup = JA.placementSetup(d, Date.now());
    const st = createCheck({ tiers: setup.tiers, start: setup.start, division: setup.division }, Math.random);
    let it;
    while ((it = checkNext(st))) {
      await voiceFor(markerTexts(it.fact, !!it.flip));
      const res = await markerPanel.open({ fact: it.fact, flip: !!it.flip, index: st.items.length, mode: 'check', progress: checkProgress(st), title: 'Pit Crew Check', chipText: `Fact ${st.items.length + 1}`, exitText: 'Later' });
      if (!res || res.cancelled) return false;                 // the way out always works: nothing is kept, the check comes back at the next store or marker
      checkAnswer(st, res);
    }
    const now = Date.now();
    applyCheck(d, st, now);
    if (lastPlacement) lastPlacement.items = st.items.length;
    refreshFrontier(d, now, 'Pit Crew Check');
    try { writeFactsData(currentPlayerId, d); } catch (e) { console.warn('[WagonWest] writeFactsData', e); }
    effectToast(V15.PLACE_DONE, V15.PLACE_DONE);
    app.persist();
    return true;
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
    if (num(good.lb) > 0 && foodRoomOf(J) < num(good.lb)) return { ok: false, reason: 'full' };      // v1.7.1: the wagon carries LOAD.foodLb of food
    const wasLimp = !!J.limp;
    let r = { ok: false };
    try { r = JA.buy(J, { item, qty: 1, price }); } catch (e) { console.warn('[WagonWest] buy', e); }
    if (r && !r.ok && r.reason === 'full') return { ok: false, reason: 'full' };
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
      try { p = JA.problemFor({ kind, fact: pick ? pick.fact : null, leg, season: J.season, rand: Math.random, item, cash: num(J.cash), shelf: num(good.price), tier: probTier() }); } catch (e) { console.warn('[WagonWest] problemFor', e); p = null; }
      if (p && kind === 'buy' && num(p.answer) > num(J.cash)) p = null;
      // a divide must not ask about more money than the purse holds, nor about more sacks than the purse pays at the shelf's price
      // (a fact like 63 ÷ 9 cannot fit a purse a big "Work it out" already spent: the next try is a small one)
      if (p && kind === 'divide') { const m = p.meta || {}; if (num(m.total) + num(m.left) > num(J.cash) || num(m.qty) * num(good.price) > num(J.cash)) p = null; }
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
    // (the purse is checked again here: the child may have spent it while the panel was open, and the goods never cost more than the cash box holds)
    const canPay = price > 0 ? Math.floor(num(J.cash) / price) : qty;
    const unitLb = num(good.lb) > 0 && (meta.item || item) === (good.item || good.id) ? num(good.lb) : 0;
    const canCarry = unitLb > 0 ? Math.floor(foodRoomOf(J) / unitLb) : qty;      // v1.7.1: and never more food than the wagon carries
    const qtyPaid = Math.min(qty, canPay, canCarry);
    try { r = qtyPaid >= 1 ? JA.buy(J, { item: meta.item || item, qty: qtyPaid, price }) : { ok: false }; } catch (e) { console.warn('[WagonWest] buy', e); }
    const got = r && r.ok ? num(r.qty) || qtyPaid : 0;
    if (r && r.ok) { Audio.cash(); toast(got < qty && canCarry < canPay ? `The wagon can't carry more: ${got} × ${good.name} in the wagon` : `${got} × ${good.name} in the wagon`); }
    else toast(canCarry < 1 || (r && r.reason === 'full') ? "The wagon can't carry more food" : 'Not enough cash for that many: try another good');
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
    labReport({ event: 'problem', n: 1, firstTry: !!res.correct });                // v1.6 (The Lab)
    const lf = ladderFactOf(p, pick);
    // (the typed wrong answer goes on the fact's record only when the question's answer IS the fact's answer: a two-step ration or
    // repair asks for pounds left / good spokes, and "98 good bolts" is not a wrong answer to 9 × 12)
    if (lf) recordFact(lf, { correct: res.correct, quick: false, fixed: !res.correct && res.fixed, ms: res.ms, given: Number(p.answer) === factAnswer(lf) && !(Array.isArray(p.parts) && p.parts.length > 1) ? res.given : null }, pick && normFact(pick.fact) === lf ? pick : null);
    app.persist();
    checkDaily();
    return res;
  }
  async function runProblem(kind, { title, extra = {} } = {}) {
    const J = save.journey;
    const pick = kind === 'parts' ? null : ladderPick(kind === 'divide' || kind === 'distance' ? '/' : 'x');
    let p = null;
    try { p = JA.problemFor({ kind, fact: pick ? pick.fact : null, leg: curLeg(), season: J.season, rand: (T && T.rand) || Math.random, tier: probTier(), ...extra }); } catch (e) { console.warn('[WagonWest] problemFor', e); }
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
    if (journey) { try { JA.applyProblem(J, { kind: 'fact', correct: !!res.correct, firstTry: !!res.correct }); } catch (_) { /* ignore */ } labReport({ event: 'problem', n: 1, firstTry: !!res.correct }); }      // (v1.6: the Lab hears the journey's quick facts, not camp's own games)
    logKind(save, 'fact', !!res.correct);
    logPlay(save, { problems: 1, problemsRight: res.correct ? 1 : 0 });
    app.persist();
    return res;
  }
  async function runMarker(marker, opts = {}) {      // (v1.2 app two: opts.raft = a bend of the Columbia: its own panel title and chip)
    const J = save.journey;
    save.trip.markers += 1;
    const n = Math.max(1, Math.round(num(marker && marker.n) || save.trip.markers));
    const leg = curLeg();
    const of = Math.max(n, Math.round(num(marker && (marker.of || marker.total)) || Math.floor(((leg && leg.miles) || 150) / 30)));
    if (!opts.raft && !opts.sail) S('setTravel', { moving: false });
    await offerPlacement('marker');                    // ---- v1.5: the Pit Crew Check, on the first store or marker (Later asks again at the next) ----
    if (!T) return;
    const pick = ladderPick('any') || { fact: '6x7', flip: false };
    // Nora's tip (once a leg when the teacher is in the party): the strategy hint BEFORE the answer
    let tip = '';
    try { if (typeof JA.teacherTip === 'function' && JA.teacherTip(J)) tip = hintFor(pick.fact, !!pick.flip) || ''; } catch (e) { console.warn('[WagonWest] teacherTip', e); }
    if (tip) {
      const nora = (COMPANION_BY_ID.teacher || { name: 'Nora' }).name;
      await showCard({ kicker: `${nora}'s tip`, title: 'A tip before you answer', text: tip, say: spokenHint(tip), tone: 'lookout', button: 'Got it' });
      if (!T) return;
    }
    await voiceFor(markerTexts(pick.fact, !!pick.flip));
    const res = await markerPanel.open({ fact: pick.fact, flip: !!pick.flip, index: n - 1, total: of, ...(opts.raft ? { title: 'Down the Columbia', chipText: `Bend ${n} of ${of}` } : opts.sail ? { title: 'Up the coast', chipText: `Marker ${n} of ${of}` } : {}) });
    if (res.cancelled) return;
    recordFact(pick.fact, res, pick);
    try { const am = JA.applyMarker(J, { correct: !!res.correct, quick: !!res.quick }); if (am && am.skill) skillLine(am.skill); } catch (e) { console.warn('[WagonWest] applyMarker', e); }
    logPlay(save, { markers: 1, markersRight: res.correct ? 1 : 0 });
    labReport({ event: 'marker', n: 1, firstTry: !!res.correct });                  // v1.6 (The Lab): a mile-marker fact, right the first time or fixed
    app.persist();
    if (res.quick) toast(opts.raft ? 'A fast current!' : opts.sail ? 'A fair wind!' : 'A tailwind! A few free miles');
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
    // the dictation in the natural voice: the words' clips and their letters are ready before the panel opens (it would
    // hand a word without its clip to the device voice); a slow server delays the first word a little, never the voice
    if (cloud.active && list.length) {
      const dict = [];
      for (const p of list) {
        const info = { word: p.word, sentence: p.sentence, sayAs: p.sayAs, syllables: p.syllables };
        dict.push(...wordTexts(info), ...Array.from(String(p.word || '')).map(cloudLetterText));
      }
      await voiceFor(dict, 9000);
    }
    let asked = 0, right = 0;
    for (let i = 0; i < list.length; i++) {
      if (i > 0) { const ok = await spellPanel.beat('Next word!', beat(800)); if (!ok) return { cancelled: true, asked, right }; }
      const d = Profiles.loadWords(currentPlayerId);
      const res = await spellPanel.run(list[i], { streakBefore: Math.min(WS.STREAK_CAP, d.streak || 0), upper: opts.tileCase === 'upper', set: { index: i, count: list.length }, keepOpen: i < list.length - 1 });
      if (!res || res.cancelled) { spellPanel.close(); if (asked) { try { JA.applyWords(J, { asked, right }); } catch (_) { /* ignore */ } app.persist(); } return { cancelled: true, asked, right }; }
      try { WS.recordSpell(d, list[i].word, { firstTry: !!res.firstTry }, Date.now(), spellSession); Profiles.writeWords(currentPlayerId, d); } catch (e) { console.warn('[WagonWest] recordSpell', e); }
      asked += 1; if (res.firstTry) right += 1;
      logPlay(save, { words: 1, wordsRight: res.firstTry ? 1 : 0 });
      labReport({ event: 'word', n: 1, firstTry: !!res.firstTry });                // v1.6 (The Lab): a river word or a letter's word
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
    if (!J) { beginYear(); return; }
    if (J.done) { newSeason(); return; }
    const leg = curLeg();
    if (!leg) { go('title'); return; }
    if (!save.trip || save.trip.legId !== J.legId) {
      save.trip = { legId: J.legId, stage: 'trail', events: [], asked: { ration: 0, distance: 0 }, markers: 0, at: Date.now(), tokens0: num(J.tokens), gold0: num(J.gold), dig: { pans: 0, rocker: 0 } };
      app.persist();
      prepareVoice();                      // every leg start: the clips for this week's facts, words and lines
      labBridge.beginRound();              // v1.6 (The Lab): a leg is a round: the Lab's tally and combo start clean
    }
    applySceneParty();
    S('setLeg', { id: leg.id, biome: leg.biome, miles: leg.miles, stop: leg.stop, river: leg.river, painting: leg.painting, dry: leg.dry || null, voyage: !!leg.voyage });
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
    // ---- v1.2 (app two): the last leg of the Oregon Trail by the Columbia runs as the raft instead of the trail days; v1.5: the voyage home runs as a sail ----
    if (v2StartRaft(leg)) return;
    if (v2StartSail(leg)) return;
    const r = T;
    const tollNow = !!(leg.toll && tollDue(J));
    if (tollNow || !save.seen.coach) {
      T.busy = true;
      (async () => {
        if (tollNow) await runToll(leg);                   // ---- v1.5: the Barlow Road's gate, at the leg's start ----
        if (T !== r) return;
        if (!save.seen.coach) {
          await card.show({ kicker: 'How the trail works', title: 'Roll out!', tone: 'coach', button: "Let's roll", text: COACH_TEXT });      // (opens at once; its line waits for its clip)
          save.seen.coach = true; app.persist();
        }
        if (T === r) { r.busy = false; r.last = 0; }
      })().catch((e) => { console.error('[WagonWest] start of leg', e); if (T === r) { r.busy = false; r.last = 0; } });
    }
  }
  // ---- v1.5: the toll gate (the Barlow Road): $5 a wagon in 1846 money; a short purse gets an IOU, never a stranded wagon ----
  const tollDue = (J) => !!(J && J.trip && J.trip.toll && !J.trip.toll.paid && !J.trip.toll.iou);
  async function runToll(leg) {
    const J = save.journey;
    if (!tollDue(J)) return;
    const dollars = num(J.trip.toll.dollars);
    const short = num(J.cash) < dollars;
    const ask = `The Barlow Road is a toll road around Mount Hood. The toll keeper at the gate asks $${dollars} for the wagon.`;
    const askSay = `The Barlow Road is a toll road around Mount Hood. The toll keeper at the gate asks ${JA.dollarWords(dollars)} for the wagon.`;
    const text = short ? `${ask} ${V15.TOLL_SHORT}` : ask, say = short ? `${askSay} ${V15.TOLL_SHORT}` : askSay;
    await showCard({ kicker: 'The toll gate', title: short ? 'An IOU at the gate' : 'Pay the toll', text, say, tone: 'event', button: short ? V15.TOLL_IOU_BUTTON : 'Pay the toll' });
    if (!save.journey || save.journey !== J) return;
    let t = null;
    try { t = JA.payToll(J); } catch (e) { console.warn('[WagonWest] payToll', e); }
    app.persist(); refreshCash();
    if (t && t.paid) { Audio.cash(); effectToast(`The toll is paid: $${t.dollars}. The gate swings open.`, V15.TOLL_PAID); }
    else effectToast(V15.TOLL_IOU, V15.TOLL_IOU);
  }
  function stopTravel() {
    v2Abort();                          // ---- v1.2 (app two): leaving mid-raft / mid-stampede ends the mini-game ----
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
    S('setTravel', { milesDone: m, pace: J.pace, rations: J.rations, weather: r.weather, mood: J.mood, foodLow: !!r.day.res.foodLow, moving: k < 1, dry: r.day.res.dry ? { barrel: !!(J.upgrades && J.upgrades.barrel) } : false });     // (v1.5: a dry day draws the water barrel only when the wagon has one)
    hud.update(J, r.leg, { milesDone: m, foodLow: !!r.day.res.foodLow, ...hudExtra() });
    if (k >= 1) { const d = r.day; r.day = null; afterDay(r, d).catch((e) => console.error('[WagonWest] day', e)); }
  }
  async function afterDay(r, d) {
    r.busy = true;
    app.persist();                              // every day is saved: stopping anywhere loses nothing
    const J = save.journey;
    dayFlow = !!(d.res.marker || d.res.event || d.res.nose || d.res.fact || d.res.moment);  // (a day with a marker, an event or a moment: its effect toasts wait for that panel / card, which would cut their lines; a quiet day holds nothing)
    try {
      dayEffects(d.res, r);
      if (d.res.marker) await runMarker(d.res.marker);
      if (T !== r) return;
      if (d.res.event) await runEvent(d.res.event);
      if (T !== r) return;
      // ---- v1.4: one thing a day, after the marker and the event (the journey's order): the dog's nose, a trail fact, the dust devil ----
      if (d.res.nose) { await runNose(d.res.nose, r); if (T !== r) return; }
      if (d.res.fact) { await runFact(d.res.fact, r); if (T !== r) return; }
      if (d.res.moment && d.res.moment.kind === 'dustDevil') { await runDustDevil(r); if (T !== r) return; }
    } finally { dayFlow = false; }
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
    if (res.dry && !r.dryShown) { r.dryShown = true; const t = res.thirsty ? V15.DRY_THIRSTY : V15.DRY_BARREL; effectToast(t, t); }      // ---- v1.5: a dry stretch ----
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
  const EVENT_BUTTON = { problem: 'Fix it', hunt: 'Grab the bow', fish: 'Cast a line', trade: 'Trade', rest: 'Deal the cards', lookout: 'What a sight', bonus: 'Yum!', spring: 'A cool drink', snub: 'Hold the rope!' };
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
      text = noArrows && settings.hunting !== false ? HUNT_NO_ARROWS : HUNT_FISH_ONLY;
      sayText = text;
    }
    if (ev.covered) { const c = COVER_LINE; text = `${text || ''}${c}`; sayText = `${sayText || ev.text || ''}${c}`; }
    if (kind === 'lookout' && ev.animal !== null) { spotSure = true; S('spotAnimal', ev.animal || 'bison'); }       // (v1.5: ice and gold fever have no animal; the gold-fever card comes from the Nisenan guide at Coloma, not from this event)
    S('setTravel', { moving: false });
    if (kind === 'breakdown') { await runBreakdown(ev); return; }
    if (kind === 'stampede' && scene && typeof scene.startStampede === 'function') { await runStampede(ev); return; }   // ---- v1.2 (app two) ----
    if (kind === 'snub') { await runSnub(ev); return; }          // ---- v1.5: Laurel Hill ----
    await showCard({ kicker: 'On the trail', title: ev.name || 'On the trail', text, say: sayText, tone: kind, button: EVENT_BUTTON[kind] || 'Continue' });
    if (!T) return;
    if (kind === 'bonus' && /berr|plum/i.test(`${ev.id} ${ev.name || ''} ${ev.text || ''}`)) dropCard(plumCard());
    if (kind === 'problem') {
      if (ev.problem === 'parts') await runProblem('parts', { title: 'Wagon repair' });
      else await runFactPanel(ev.name || 'Quick fact');
    } else if (kind === 'rest') await runFactPanel('Card game');
    else if (kind === 'trade') await runTrade(ev);
    else if (kind === 'hunt') await runMini(kind);
    else if (kind === 'fish') await runFishing({ rescue: !!ev.rescue });         // (v1.4: Fishing 2.0; the safety net is a rescue session)
    else if (kind === 'spring' && T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });      // (v1.5: a hidden spring lifts the party; the sim did it)
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
    const text = breakdownText(ev, have, free);
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
    try { offer = JA.tradeOffer(J, { nation: ev.nation || (nation && nation.id) }); } catch (e) { console.warn('[WagonWest] tradeOffer', e); }
    // the guard only fires when the wagon holds nothing tradable at all (a fallback offer is always affordable)
    if (offer && offer.kind === 'full') { toast("The wagon can't carry more food: a friendly visit"); return; }      // (v1.7.1: goods to trade, no room for the food)
    if (!offer || offer.kind === 'none') { toast('Nothing to trade this time: a friendly visit'); return; }
    const pick = ladderPick('x');
    let p = null;
    try { p = JA.problemFor({ kind: 'trade', fact: pick ? pick.fact : null, leg: curLeg(), season: J.season, rand: T.rand, nation: ev.nation || (nation && nation.id), offer, have: offer.have }); } catch (e) { console.warn('[WagonWest] problemFor trade', e); }
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
      mini = { kind, lb: 0, hits: 0, leads: 0, resolve, done: false, card: false };
      $('#mini-text').textContent = kind === 'hunt' ? 'The bow: tap the animals' : 'The line: tap when it dips';
      $('#mini-done').textContent = kind === 'hunt' ? 'Done hunting' : 'Done fishing';
      $('#mini').hidden = false;
      // the scene owns the pointer (the canvas) and Space while it runs: no focused button may catch Space's keyup
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.documentElement.classList.add('in-mini');
      document.documentElement.classList.toggle('in-hunt', kind === 'hunt');       // (v1.4 playtest: the hunt's bar sits up in the hills, clear of the three lanes the animals cross in)
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
    document.documentElement.classList.remove('in-mini', 'in-hunt');
    const J = save.journey;
    const lb = Math.max(0, Math.round(total != null ? num(total) : m.lb));
    let r = null;
    try { r = m.kind === 'hunt' ? JA.applyHunt(J, { meatLb: lb }) : JA.applyFish(J, { fishLb: lb }); } catch (e) { console.warn('[WagonWest] apply mini', e); }
    app.persist();
    // v1.7.1: the wagon carries LOAD.foodLb of food; what does not fit is left on the trail ("leave the rest for the next party")
    const kept = r && Number.isFinite(r.foodLb) ? r.foodLb : lb;
    if (r && r.full) toast(kept ? `+${kept} lb of food for the wagon. The wagon can't carry more; leave the rest for the next party` : "The wagon can't carry more; leave the rest for the next party");
    else toast(lb ? `+${lb} lb of food for the wagon${m.leads ? ` (${m.leads === 1 ? 'a good lead' : m.leads + ' good leads'}!)` : ''}` : 'Nothing this time. The trail has more');
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
    if (evt.type === 'sfx') { sceneSfx(evt); return; }       // ---- v1.4: the scene names the cue (splash, reel { on }, wobble, skip, plunk, twinkle, whoosh, snap); the app plays it
    feedWaiters(evt);                   // ---- v1.4: a flow waiting for dogBack / chaseEnd / ambientEnd … (they never compete with playMini's own events)
    if (v2Event(evt)) return;           // ---- v1.2 (app two): the ford / float / raft / stampede events ----
    if (evt.type === 'hunt' && mini && mini.kind === 'hunt') {
      Sfx.twang();
      if (evt.hit) { mini.lb += num(evt.meatLb); mini.hits += 1; if (evt.lead) mini.leads += 1; toast(evt.lead ? 'Good lead! Got one!' : 'Got one!');   // (v1.4: a running animal needs a lead; no deed or token is named for it, so it is only recorded: the toast and the hunt's report line)
       if (!mini.card) { mini.card = true; dropCard(animalCard(evt.animal)); } }
    } else if (evt.type === 'huntEnd' && mini && mini.kind === 'hunt') finishMini(Number.isFinite(evt.meatLb) ? evt.meatLb : null);
    else if (evt.type === 'fish' && mini && mini.kind === 'fish') { Sfx.plop(); mini.lb += num(evt.lb); mini.hits += 1; toast(`A ${evt.size || ''} fish!`.replace('  ', ' ')); if (!mini.card) { mini.card = true; dropCard(animalCard(evt.animal || 'fish') || animalCard('salmon')); } }
    else if (evt.type === 'animalSpotted') onSpotted(evt.animal);
    else if (evt.type === 'homesteadTap') screens.farm.tap(evt);          // ---- v1.5: a tap on the farm in the scene
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
  /** The extra cards a stop of the Gold Road hands out (beside its landmark card). */
  const STOP_CARDS = { coloma: 'sutters-mill', 'sutters-fort': 'who-got-rich' };
  let stopTok = 0;                      // (a stop that was left, by "Stop for today" or a jump, never carries on into the next screens: each run holds its number)
  async function runStop(leg) {
    const tok = ++stopTok, stale = () => tok !== stopTok;
    const J = save.journey;
    S('setBackdrop', backdropFor(leg));
    go('stop');
    const kind = leg.stop && leg.stop.kind;
    const look = LOOKOUTS[leg.lookout] || null;
    if (!(save.trip && save.trip.look)) {            // (a stop revisited after a fork left pending shows its lookout once)
      await showCard({ kicker: 'You made it!', title: (leg.stop && leg.stop.name) || leg.name, text: look ? look.text : '', say: look ? look.say : '', sticker: leg.sticker, tone: 'lookout',
        button: peopleUI.has(leg) ? 'Look around' : kind === 'river' ? 'To the ferry' : kind === 'fort' ? 'Into the fort' : kind === 'home' ? 'Home at last' : kind === 'gold' ? 'To the creek' : 'Continue' });
      if (screen !== 'stop' || stale()) return;
      if (look || CARD_BY_ID[leg.id]) dropCard(leg.id);      // the lookout's landmark card
      if (STOP_CARDS[leg.id]) dropCard(STOP_CARDS[leg.id]);
      if (save.trip) { save.trip.look = true; app.persist(); }
    }
    // ---- v1.7.1: damp flour: a heavy wagon sets part of its pile aside as the stop opens (before the store, so the flour bought here stays dry) ----
    dampLine();
    // ---- v1.5: a fork, before the stop's other scenes: the explainer, the question, an equal button for every way (it also settles the food plan for the store) ----
    if (!(await askFork(leg)) || stale()) return;
    // ---- v1.6 (The Lab): a choice moment at this stop (a shortcut, a guide), asked like a fork; both ways arrive ----
    if (!(await askChoice(leg)) || stale()) return;
    // ---- v1.2 (app two): the "Talk" row of the people at this stop (its big button goes on to the ferry / the fort / home) ----
    if (peopleUI.has(leg)) { const on = await peopleUI.visit(leg); if (!on || screen !== 'stop' || stale()) return; }
    let dig = null;
    try { dig = typeof JA.goldAt === 'function' ? JA.goldAt(J) : null; } catch (_) { dig = null; }
    if (kind === 'river') {
      const rr = await river.run({ leg });
      if (stale()) return;
      if (rr.cancelled) { if (screen === 'river') go('title'); return; }
      // ---- v1.4: the far bank: the dog that has followed since the ferry (the Kansas River), then skipping stones ----
      go('stop');
      await offerDog(leg, { river: true, back: 'stop' });
      if (screen !== 'stop') return;
      if (RIVER_STOPS.includes(leg.id)) { await offerStones(leg); if (screen !== 'stop') return; await offerRocks(leg); if (screen !== 'stop') return; }
      if (dig) { if (!(await digHere(leg, dig))) return; }
    } else if (kind === 'fort') {
      let sl = leg;
      try { if (JA.storeLeg) sl = JA.storeLeg(J) || leg; } catch (_) { sl = leg; }
      const shop = store.open({ leg: sl, place: leg.stop.name, nextText: 'To the post office', derby: true });
      await offerDog(leg);
      const ok = await shop;
      if (!ok || stale()) return;
      const po = await postOffice.run({ leg });
      if (stale()) return;
      if (po.cancelled) { if (screen === 'post') go('title'); return; }
    } else {
      if (dig) { if (!(await digHere(leg, dig)) || stale()) return; }                 // ---- v1.5: the diggings (a landmark, Coloma, the Sacramento claim) ----
      if (leg.post) {                                                      // ---- v1.5: a letter is written at the stops that have a post (the ends of the trails, a few on the long stretches) ----
        const po = await postOffice.run({ leg });
        if (stale()) return;
        if (po.cancelled) { if (screen === 'post') go('title'); return; }
      }
    }
    // the evening of every arrival: camp before the results (never needed: "On to the results" goes straight on)
    if (kind !== 'home') {
      go('stop');
      const c = await showCard({ kicker: 'Evening', title: 'Make camp tonight?', text: 'Fishing, a card game, a story by the fire, or a good rest.', say: CAMP_EVENING, tone: 'camp', button: 'On to the results', alt: 'Make camp' });
      if (screen !== 'stop' || stale()) return;
      if (c === 'alt') {
        const how = await openCamp('arrival');
        if (how !== 'results' || stale()) return;
      }
    }
    return finishLeg(leg);
  }
  /** v1.7.1: the damp flour of this stop (journey dampAtStop, once a stop), as an effect line on the stop; the store repeats it beside the food. */
  function dampLine() {
    const J = save.journey;
    let d = null;
    try { d = typeof JA.dampAtStop === 'function' ? JA.dampAtStop(J) : null; } catch (e) { console.warn('[WagonWest] dampAtStop', e); }
    if (!d || !(num(d.lb) > 0) || (save.trip && save.trip.dampSaid)) return;      // (said once a stop: a stop opened again after "Stop for today" does not say it twice)
    if (save.trip) save.trip.dampSaid = true;
    app.persist(); refreshCash();
    const t = dampText(d);
    effectToast(t.text, t.say);
  }
  // ---- v1.5: the fork panel and the diggings, as the stop runs them ----
  /** The fork at this stop, if any: resolves false when the child left (the choice stays pending: the title says "A choice at Fort Hall"). */
  async function askFork(leg) {
    const J = save.journey;
    let fork = null;
    try { fork = JA.forkAt(J); } catch (e) { console.warn('[WagonWest] forkAt', e); }
    if (!fork) return true;
    const first = !save.seen.forks[fork.id];
    // (v1.5: the scene's signpost behind the panel: the arms carry the options' names)
    S('setFork', { id: fork.id, options: fork.options.map((o) => ({ id: o.id, name: o.name })) });
    S('setBackdrop', 'fork');
    const pick = await forkPanel.run(fork, { first });
    if (screen === 'stop' || pick != null) S('setBackdrop', backdropFor(leg));
    if (pick == null) { if (screen === 'stop') go('title'); return false; }
    let res = null;
    try { res = JA.chooseBranch(J, fork.id, pick); } catch (e) { console.warn('[WagonWest] chooseBranch', e); }
    save.seen.forks[fork.id] = true;
    app.persist();
    const opt = fork.options.find((o) => o.id === pick);
    if (res && res.ok && opt) toast(`${opt.name}!`);
    lastFork = { id: fork.id, pick, ok: !!(res && res.ok) };
    if (res && res.ok) labReport({ event: 'choice', n: 1 });          // v1.6 (The Lab): a fork taken
    prepareVoice();                          // the plan changed: the next legs' clips, this leg first
    return true;
  }
  // ---- v1.6 (The Lab): the six choice moments (journey/choices.js, ui/choicePanel.js) ----
  /** The choice waiting at this stop, if any: resolves false when the child left (it stays pending: the title says "A choice at Ash Hollow"; moving on takes the plain way). */
  async function askChoice(leg) {
    const J = save.journey;
    let c = null;
    try { c = JA.choiceAt(J); } catch (e) { console.warn('[WagonWest] choiceAt', e); }
    if (!c) return true;
    const pick = await choicePanel.run(c);
    if (pick == null) { if (screen === 'stop') go('title'); return false; }
    let r = null;
    try { r = JA.applyChoice(J, c.id, pick); } catch (e) { console.warn('[WagonWest] applyChoice', e); }
    if (r && !r.ok && r.why === 'cash') { try { r = JA.applyChoice(J, c.id, 'a'); } catch (_) { r = null; } }       // (the purse was spent while the card was open: the plain way)
    app.persist(); refreshCash();
    lastChoice = { id: c.id, pick, ok: !!(r && r.ok), result: r || null };
    if (r && r.ok) {
      labReport({ event: 'choice', n: 1 });
      if (r.option === 'b') {
        const line = r.kind === 'guide' ? CHOICE_LINES.guide : r.soaked ? CHOICE_LINES.shortcutSoaked : CHOICE_LINES.shortcutDry;
        effectToast(r.soaked ? `${line.text} (${r.soakedLb} lb of flour)` : line.text, line.say);
        if (r.fee) Audio.cash();
      }
    }
    return true;
  }
  let lastChoice = null;
  /** The choice waiting at the stop the party is at ({ id, at, name }), or null: the title says "A choice at Ash Hollow". */
  function pendingChoice() {
    const J = save.journey;
    if (!J || J.done || !save.trip || save.trip.stage !== 'stop') return null;
    let c = null;
    try { c = JA.choiceAt(J); } catch (_) { c = null; }
    if (!c) return null;
    const l = LEG_BY_ID[c.at] || {};
    return { id: c.id, at: c.at, name: (l.stop && l.stop.name) || l.name || 'the stop' };
  }
  let lastFork = null;
  /** The creek: panning (and the cradle at Coloma) with the gold pouch; when Parents turned panning off, the gold is given as a find with one card. */
  async function digHere(leg, dig) {
    const J = save.journey;
    if (screen !== 'stop') go('stop');
    if (settings.panning === false) {
      diggings.giveAsFind(dig);
      const t = `${DIG_TEXT.find} ${pouchText(JA.nuggetsOf, J.gold | 0)}.`;
      await showCard({ kicker: 'At the creek', title: 'Gold!', text: t, say: DIG_TEXT.find, tone: 'bonus', button: 'On we go' });
      return screen === 'stop';
    }
    S('setBackdrop', 'diggings');
    const res = await diggings.run({ leg, dig });
    if (screen === 'stop') S('setBackdrop', backdropFor(leg));
    return res === 'leave' && screen === 'stop';
  }
  async function finishLeg(leg) {
    const J = save.journey;
    const now = Date.now();
    let a = null;
    try { a = JA.arrive(J); } catch (e) { console.error('[WagonWest] arrive threw', e); }
    a = a || { stars: [true, false, false], cash: { arrival: 0, stars: 0, total: 0 }, sticker: leg.sticker, crate: null };
    // (v1.4: a quest item the nose never reached on this leg is found as the party arrives (arrive()'s result.quest): the dog trots back with it, the item card, before the results)
    const arrivedQuest = questIdOf(a.quest);
    if (arrivedQuest && J.dog) { try { await dogFetchesQuest(arrivedQuest); } catch (e) { console.warn('[WagonWest] arrival quest item', e); } if (save.journey !== J) return; }
    // the arrival's card (one of the leg's biome), and the daily challenge looks at the finished leg before it resets
    try { if (typeof JA.cardForLeg === 'function') dropCard(JA.cardForLeg(J, Math.random)); } catch (e) { console.warn('[WagonWest] cardForLeg', e); }
    // v1.5: the tier's bonus cards (Veteran on a 3-star leg, Pioneer every leg)
    const bonus = [];
    for (let i = 0; i < num(a.bonusCards); i++) { try { const r0 = dropCard(JA.cardForLeg(J, Math.random)); if (r0 && r0.id) bonus.push(r0.id); } catch (_) { /* ignore */ } }
    checkDaily();
    // (v1.4: the dog's leg count is the journey's: arrive() adds it, and a muddy dog gets its bath there)
    if (a.bath) { applySceneParty(); effectToast(MOMENTS.chase.bath.text, MOMENTS.chase.bath.say || MOMENTS.chase.bath.text); }
    const stats = { ...(J.legStats || {}) };
    const stars = (a.stars || []).slice(0, 3).map(Boolean);
    while (stars.length < 3) stars.push(false);
    const sticker = a.sticker || leg.sticker;
    if (sticker && sticker.id && !save.stickers.includes(sticker.id)) save.stickers.push(sticker.id);
    if (a.crate) { save.crates.queue.push(['bronze', 'silver', 'gold'].includes(a.crate) ? a.crate : 'bronze'); save.crates.earned += 1; }
    // the streak (Spell Jump's rule): a day counts once a leg is finished; a milestone adds a crate
    const proxy = { streak: save.streak, crates: { earned: 0, opened: 0 }, cosmetics: sjCosmetics(), xp: 0 };
    try { const out = completeDay(proxy, now); save.streak = proxy.streak; if (out.crates) { save.crates.queue.push('silver'); save.crates.earned += 1; toast(`${out.count}-day streak! A crate`); } } catch (e) { console.warn('[WagonWest] streak', e); }
    labReport({ event: 'day', n: 1 });                                               // v1.6 (The Lab): beside the day's streak
    logPlay(save, { legs: 1 }, now);
    labReport({ event: 'leg', n: 1 });
    setTimeout(() => labSummary(), 0);                                               // v1.8 (cohesion): the card after each leg                                               // v1.6 (The Lab): the arrival, and each star earned on the leg
    for (const lit of stars) if (lit) labReport({ event: 'star', n: 1 });
    save.legsLog = [...save.legsLog, { at: now, leg: leg.id, season: J.season, stars: stars.filter(Boolean).length, markers: num(stats.markers), markersRight: num(stats.markersRight), problems: num(stats.problems), problemsRight: num(stats.problemsRight), words: num(stats.words), wordsRight: num(stats.wordsRight) }].slice(-40);
    const tokens = Math.max(0, num(J.tokens) - num(save.trip && save.trip.tokens0));
    const goldGain = Math.max(0, num(J.gold) - num(save.trip && save.trip.gold0));
    const home = leg.stop && leg.stop.kind === 'home';
    let next = null;
    try { next = JA.nextLeg(J); } catch (e) { console.error('[WagonWest] nextLeg threw', e); }
    let done = !!J.done;
    if (!next && !done && a.end) { J.done = true; done = true; }
    if (done) save.seasonsDone += 1;
    // ---- v1.5: a trail's end banks the journey into the homestead there (the dollars left become savings, the gold Beaver money, the team the pasture) and turns the year ----
    let bank = null;
    if (done) {
      const c = closeFinished(J);
      if (c) bank = { savings: num(c.banked && c.banked.savings), flakes: num(c.banked && c.banked.flakes), animals: num(c.banked && c.banked.animals), trophy: c.trophy, site: c.site, firstHere: !!c.firstHere };
    }
    // ---- v1.2 (app two): the deeds this leg earned (the arrival counted) go on the results ----
    v2CheckDeeds();
    const legDeeds = (save.trip && Array.isArray(save.trip.deeds)) ? save.trip.deeds.slice() : [];
    const sets = legSets.splice(0);
    save.trip = null;
    app.persist();
    pingNow('leg');
    const result = { leg: leg.id, place: (leg.stop && leg.stop.name) || leg.name, stars, cash: { arrival: num(a.cash && a.cash.arrival), stars: num(a.cash && a.cash.stars), total: num(a.cash && a.cash.total) },
      tokens, sticker, crate: a.crate || null, stats, food: num(J.food), home: home || done };
    if (result.cash.total !== result.cash.arrival + result.cash.stars) result.cash.total = result.cash.arrival + result.cash.stars;
    result.deeds = legDeeds;               // (v1.2 app two)
    // v1.6 (The Lab): the cliffhanger: the stop the journey is on now (nextLeg moved it) with its painting, one true line and "Next time: …"; none at a trail's end. After the third leg
    // finished on a local day the card adds the gentle stop line (nothing is locked: "Next leg" stays).
    try { result.preview = done ? null : JA.nextStopPreview(J); } catch (e) { result.preview = null; console.warn('[WagonWest] nextStopPreview', e); }
    result.stopToday = !!result.preview && JA.stopToday(save.play, dayKeyOf(now));
    // v1.5: the tier's badge, the bonus cards, the gold found on a digging leg, the sets completed, the bank card
    result.tier = TIER_BY_ID[J.tier] || null; result.year = J.year;
    result.bonus = bonus; result.sets = sets;
    result.goldFound = goldGain > 0 ? { total: goldGain, text: pouchText(JA.nuggetsOf, goldGain) } : null;
    if (bank) {
      result.bank = bank; result.animalName = animalName(); result.nuggetsOf = JA.nuggetsOf;
      result.homeTitle = J.route === 'gold-road' ? 'Home with your gold!' : bank.site === 'sacramento' ? 'Your claim in California!' : 'Home in the valley!';
    }
    S('setBackdrop', home ? 'valley' : backdropFor(leg));
    go('results', result);
    Audio.cash();
    if (stars.every(Boolean)) setTimeout(() => Audio.fanfare(), 400);
    S('celebrate', 'star');
    if (bank) {                                // the bank card is said (it has numbers: just in time)
      const parts = bankSay(bank);
      if (parts) { app.voiceFor([parts], 4000); app.sayLater(parts); }
    }
  }
  /** The bank card, as it is said ("Seventy-four dollars into savings, six nuggets of Beaver money, and two oxen to the pasture."). */
  function bankSay(b) {
    const w = JA.numberWords, parts = [];
    if (b.savings > 0) parts.push(`${w(b.savings)} ${b.savings === 1 ? 'dollar' : 'dollars'} into savings`);
    if (b.flakes > 0) { const n = JA.nuggetsOf(b.flakes); parts.push(n.nuggets ? `${w(n.nuggets)} ${n.nuggets === 1 ? 'nugget' : 'nuggets'}${n.flakes ? ` and ${w(n.flakes)} ${n.flakes === 1 ? 'flake' : 'flakes'}` : ''} of Beaver money` : `${w(n.flakes)} ${n.flakes === 1 ? 'flake' : 'flakes'} of gold dust`); }
    if (b.animals > 0) parts.push(`${w(b.animals)} ${animalName()} to the pasture`);
    if (!parts.length) return '';
    return `Home! The wagon brings ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts[0]}.`;
  }
  /** "A new year": close the journey if it was not (a 1.3 save), then pick where and how hard (the first journey ever goes straight to the Outfit). */
  function newSeason() { beginYear(); }
  /** After the results of a trail's end: name the farm when it is new (1.0's homestead keyboard), then the homestead screen. */
  async function arriveFarm() {
    const J = save.journey;
    const c = J && J.closeResult;
    const siteId = (c && c.site) || null;
    if (!siteId || !save.farm.sites[siteId]) { newSeason(); return; }
    const s = save.farm.sites[siteId];
    if (!s.name) {
      const name = await homeUI.ask(siteId);
      if (name == null) return;
      JA.foundSite(save.farm, siteId, { name, year: J.year });
      if (siteId === 'willamette') save.homestead = name;
      app.persist();
    }
    go('farm', { site: siteId, fresh: true });
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
      ask(siteId = 'willamette') { name = ''; $('#home-title').textContent = siteId === 'sacramento' ? 'The Sacramento Valley' : 'The Willamette Valley'; return new Promise((resolve) => { waiter = resolve; go('home'); }); },
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
    if (r.new) checkSetsNow();
    app.persist(); refreshCash();
    return { ...r, id: cd.id };
  }
  // ---- v1.5: a card set completed pays its wagon decoration once (save.setsDone), worn at once while fewer than two are worn ----
  let legSets = [];
  function checkSetsNow() {
    const J = save.journey;
    if (!J || typeof JA.checkSets !== 'function') return [];
    let ids = [];
    try { ids = JA.checkSets(J, save.setsDone) || []; } catch (e) { console.warn('[WagonWest] checkSets', e); }
    for (const id of ids) {
      const st = CARD_SETS.find((x) => x.id === id);
      if (!st || save.setsDone.includes(id)) continue;
      save.setsDone.push(id);
      const dec = DECOR_BY_ID[st.decor];
      grantLook(save.cosmetics, 'decor', st.decor);
      if (wornDecor(save.cosmetics).length < 2) equipLook(save.cosmetics, 'decor', st.decor);
      legSets.push({ id, name: st.name, emoji: dec ? dec.emoji : '', decorName: dec ? dec.name : '' });
      effectToast(`A full set: ${st.name}!${dec ? ` The ${dec.name} is yours.` : ''}`, st.say);
      applySceneParty();
    }
    return ids;
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
    campVisit = { context, line: false, stars: false };
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
    if (['fetch', 'hoppers', 'stones', 'stars', 'rocks'].includes(kind)) { await funActivity(kind); try { screens.camp.refresh(); } catch (_) { /* ignore */ } return; }      // ---- v1.4: no day, no food ----
    const who = campCompanion();
    try {
      if (typeof JA.camp === 'function') {
        const cr = JA.camp(J, kind, { rand: Math.random });
        if (cr && cr.skill) skillLine(cr.skill);
        if (cr && cr.bath) { applySceneParty(); effectToast(MOMENTS.chase.bath.text, MOMENTS.chase.bath.say || MOMENTS.chase.bath.text); }       // ---- v1.4: the muddy dog's bath in the creek ----
      }
    } catch (e) { console.warn('[WagonWest] camp', e); }
    app.persist(); refreshCash(); screens.camp.refresh();
    if (kind === 'fish') { await runFishing(); companionLine(who, true); }
    else if (kind === 'hunt') { await runMini(kind); companionLine(who, true); }
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
    if (line) toast(`${c.name}: “${line}”`, speak ? line : '');
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
    const legs = planLegs(J).slice(0, Math.max(1, num(J.legIndex) + 1));
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

  // ---------- the dog (SPEC v1.1 §3, v1.4 §1.5): offered on the far bank of the Kansas River (and, for a child who said "Not now", at
  // every fort store), named on the keyboard; the journey's adoptDog makes it ----------
  /** Does a dog get offered at this leg's stop now? (the journey's dogOfferAt: no dog, and the Kansas River or a fort from the second leg) */
  function dogOfferHere(J, leg) {
    if (!J || J.dog || !leg) return false;
    try { if (typeof JA.dogOfferAt === 'function') return !!JA.dogOfferAt(J, leg); } catch (e) { console.warn('[WagonWest] dogOfferAt', e); }
    return leg.id === 'kansas-river' || (leg.stop && leg.stop.kind === 'fort' && num(leg.n) >= 2);
  }
  async function offerDog(leg, { river = false, back = 'store' } = {}) {
    const J = save.journey;
    if (!dogOfferHere(J, leg)) return;
    const offer = river ? MOMENTS.dogOffer : { text: DOG_OFFER, say: DOG_OFFER };
    const c = await showCard({ kicker: river ? 'On the far bank' : 'At the fort', title: 'A new friend', text: offer.text, say: offer.say || offer.text, tone: 'camp', button: 'Keep it!', alt: 'Not now' });
    if (c !== true || screen !== back || J !== save.journey) return;
    const got = await dogUI.ask();
    let quest = null;
    if (got && J === save.journey) {
      let a = null;
      try { a = typeof JA.adoptDog === 'function' ? JA.adoptDog(J, { name: got.name, coat: got.coat }) : null; } catch (e) { console.warn('[WagonWest] adoptDog', e); }
      if (!a || !J.dog) J.dog = { name: got.name, coat: got.coat, legs: 0, nextBerries: 1, treats: 0, muddy: false };
      quest = a && a.quest ? (typeof a.quest === 'string' ? a.quest : a.quest.id) : null;
      app.persist();
      applySceneParty();
      S('dogBark');
      const joined = dogLine(DOG_LINES.joins);
      toast(joined);
      speech.later(joined);               // (said at once, behind what is playing: the store and the stop have no clear spot for a toast to be shown, and its line is said only when it is)
      prepareVoice();                    // the dog's name is in a dozen lines now: their clips, this leg first
    }
    if (screen === 'dog') go(back);
    if (quest && J === save.journey && screen === back) await dogFetchesQuest(quest);
  }
  /** The dog trots back with a quest item (the locket at the Kansas River): the item's card, "Keep it safe". */
  async function dogFetchesQuest(questId) {
    const q = QUEST_BY_ID[questId], J = save.journey;
    if (!q || !J || !J.dog) return;
    S('dogRun', 'quest', { emoji: q.item.emoji });
    if (sceneHas('dogRun')) await waitScene('dogBack', 9000);
    await showCard({ kicker: `${J.dog.name} found something!`, title: q.item.name, text: q.item.text, say: q.item.say || q.item.text, sticker: { emoji: q.item.emoji, name: '' }, tone: 'camp', button: 'Keep it safe' });
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

  // ---- v1.2 (app two): the scene's rivers, the Columbia raft, the stampede, the people at the stops, deeds ----
  // The scene runs four mini-games that own the pointer (SPEC v1.2 §3-§4): startFord → 'ford' { good } / 'fordEnd'
  // { soaked }, startFloat → 'float' { bump } / 'floatEnd' { bumps }, startRaft → 'raftMarker' { n, of } (it waits for
  // scene.raftGo()) / 'raft' { bump } / 'raftEnd' { bumps, bends }, startStampede → 'stampede' { good } / 'stampedeEnd'
  // { held }. playMini() starts one and resolves with its end event (null when the child left; a quiet synthetic end when
  // the scene has no such mini-game, so the journey never stalls); onSceneEvent hands the events over through v2Event().
  const v2 = { play: null, raft: null, bar: null, sail: null };
  const peopleUI = createPeople(app);
  screens.stop = peopleUI;
  const deedPop = createDeedPop($('#deedpop'), { sfx: Sfx, say: (t) => { app.sayLater(t); }, waitFor: () => cardPop.showing || !!(findPop && findPop.visible), hold: (root) => popHeld(root, { blocked: readingOpen, hold: () => screen === 'results' }) });
  const RAFT_BENDS = 4;
  const seedFor = (tag) => { const J = save.journey; return hashString(`${currentPlayerId}:${J ? J.legId : ''}:${J ? num(J.day) : 0}:${J ? num(J.legStarts) : 0}:${tag}`); };
  // (v1.5: the pan, the cradle, Laurel Hill and the voyage draw their counters and hints along the top: the trail's top HUD steps aside while they run)
  const mini15 = (on, fn = '') => { document.documentElement.classList.toggle('in-mini15', !!on); document.documentElement.classList.toggle('in-mini15-top', !!on && /^start(Pan|Rocker)$/.test(fn)); };
  function playMini(fn, opts, { end, types = [], onEvent = null } = {}) {
    return new Promise((resolve) => {
      if (v2.play) endPlay();
      if (!scene || typeof scene[fn] !== 'function') { setTimeout(() => resolve({ type: end, unavailable: true }), 0); return; }
      const p = { fn, end, types, onEvent, resolve };
      v2.play = p;
      mini15(/^start(Pan|Rocker|Snub|Sail)$/.test(fn), fn);
      try { scene[fn](opts); } catch (e) { console.error(`[WagonWest] scene.${fn} threw`, e); v2.play = null; mini15(false); setTimeout(() => resolve({ type: end, unavailable: true }), 0); }
    });
  }
  /** End the mini-game running now. early = the child chose to finish: resolves a synthetic end with what the scene
   *  had so far (a stampede not held); else the child left and it resolves null. */
  function endPlay(early = false) {
    const p = v2.play;
    if (!p) return;
    v2.play = null; mini15(false);
    const sum = S('endMiniGame');
    p.resolve(early ? { type: p.end, early: true, ...(sum && typeof sum === 'object' ? sum : {}), held: false } : null);
  }
  function v2Event(evt) {
    const p = v2.play;
    if (!p) return false;
    if (evt.type === p.end) { v2.play = null; mini15(false); p.resolve(evt); return true; }
    if (p.types.includes(evt.type)) { if (p.onEvent) { try { p.onEvent(evt); } catch (e) { console.error('[WagonWest] mini event', e); } } return true; }
    return false;
  }
  /** The bar at the bottom while a mini-game runs on the trail screen (the hunt's bar, with its own text and button). */
  function showBar(text, button, act) {
    $('#mini-text').textContent = text;
    $('#mini-done').textContent = button;
    v2.bar = act;
    $('#mini').hidden = false;
    if (findPop) findPop.suspend();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    document.documentElement.classList.add('in-mini');
  }
  function hideBar() {
    v2.bar = null;
    $('#bait-row').hidden = true;
    if (mini) return;
    $('#mini').hidden = true;
    document.documentElement.classList.remove('in-mini');
  }
  $('#mini-done').addEventListener('click', () => { if (v2.bar && !mini) v2.bar(); });
  /** The trail was left (the title, camp, the pause menu): end the mini-game, leave the raft leg at mile 0. Nothing is lost. */
  function v2Abort() {
    if (v2.play) endPlay();
    if (v2.raft) {
      const J = save.journey, leg = v2.raft.leg;
      v2.raft = null;
      if (J && leg && J.legId === leg.id && !(J.trip && J.trip.arrived) && num(J.milesDone) < num(leg.miles)) J.milesDone = 0;
      try { markerPanel.cancel(); } catch (_) { /* ignore */ }
    }
    if (v2.sail) {
      const J = save.journey, leg = v2.sail.leg;
      v2.sail = null;
      if (J && leg && J.legId === leg.id && !(J.trip && J.trip.arrived) && num(J.milesDone) < num(leg.miles)) J.milesDone = 0;
      try { markerPanel.cancel(); } catch (_) { /* ignore */ }
    }
    if (v2.bar) hideBar();
  }

  // ----- the river: the journey's crossRiver, and what makes a float safe -----
  function v2Cross(how, args = {}) {
    const J = save.journey;
    let r = null;
    try { r = JA.crossRiver(J, { how, ...args }); } catch (e) { console.warn('[WagonWest] crossRiver', e); }
    if (!r) r = { how, soakedLb: 0, ropeUsed: false, skill: null, line: RIVER_ACROSS, say: RIVER_ACROSS };
    app.persist(); refreshCash();
    return r;
  }
  /** Is a bump on the float free (a coil of rope, or the carpenter)? { safe, why } for the choice card's note. */
  function v2FloatSafe() {
    const J = save.journey;
    let sk = null;
    try { sk = typeof JA.skillInfo === 'function' ? JA.skillInfo(J, 'carpentry') : null; } catch (_) { sk = null; }
    if (sk) { const c = COMPANION_BY_ID[sk.who] || COMPANION_BY_ID.carpenter; return { safe: true, why: `${c ? c.name : 'The carpenter'} steadies the raft: a bump costs nothing.` }; }
    if (goodsOf(J).rope > 0) return { safe: true, why: 'You have rope: a bump costs nothing.' };
    return { safe: false, why: '' };
  }

  // ----- the buffalo stampede (a 'stampede' event on the prairie / bluffs legs) -----
  async function runStampede(ev) {
    const J = save.journey;
    S('setTravel', { moving: false });
    const text = ev.text || 'The ground shakes. Bison!';
    await showCard({ kicker: 'On the trail', title: ev.name || 'A bison stampede', text, say: ev.say || text, tone: 'stampede', button: `Hold the ${animalName()}!` });
    if (!T) return;
    showBar('The herd is coming: tap BRAKE when the lead bull looms', 'Skip', () => endPlay(true));
    const end = await playMini('startStampede', { seed: seedFor('stampede') }, { end: 'stampedeEnd', types: ['stampede'], onEvent: (e) => { toast(e.good ? 'Good brake!' : 'The herd thunders past'); } });
    hideBar();
    if (!end || !T) return;
    const held = !!end.held;
    let pay = null;
    try { pay = JA.stampedePay(J, { held }); } catch (e) { console.warn('[WagonWest] stampedePay', e); }
    if (held && (!pay || pay.card)) dropCard((pay && pay.card) || 'bison');
    app.persist(); refreshCash();
    if (held) { effectToast(`You held them!${num(pay && pay.cash) ? ` $${pay.cash} for steady hands, and a bison card.` : ''}`, 'You held them!'); Audio.cash(); }
    else effectToast('Pfft, dust everywhere! The herd rumbles away and the wagon is fine.', 'Pfft, dust everywhere!');
    // v1.4: the first stampede of a season ends with the bison-thunder card (the rumble, the thousands, the wagon trains that waited)
    const fid = pay && pay.fact ? pay.fact : (typeof JA.stampedeFact === 'function' && !pay ? JA.stampedeFact(J) : null);
    if (fid && TRAIL_FACT_BY_ID[fid] && T) await runFact({ id: fid, night: false, ambient: null, sound: TRAIL_FACT_BY_ID[fid].sound }, T);
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });
  }

  // ----- Laurel Hill (v1.5, the Barlow Road): the wagon goes down the steep slope on a rope round a stump -----
  async function runSnub(ev) {
    const J = save.journey;
    const text = ev.text || 'Laurel Hill! The slope is very steep, so the wagon goes down on a rope round a stump. Hold the rope!';
    await showCard({ kicker: 'On the trail', title: ev.name || 'Laurel Hill', text, say: ev.say || text, tone: 'event', button: 'Hold the rope!' });
    if (!T) return;
    showBar('Press and hold to let the wagon slide, let go at each ledge', 'Skip', () => endPlay(true));
    app.sayAll([V15.CUE_ROPE, V15.CUE_LET]);
    const end = await playMini('startSnub', { seed: seedFor('snub'), drops: 3 }, { end: 'snubEnd', types: ['snub'], onEvent: (e) => { toast(e.good ? 'Smooth!' : 'Bump!'); } });
    hideBar();
    if (!end || !T) return;
    const smooth = !!end.smooth;
    let res = null;
    try { res = JA.applySnub(J, { smooth }); } catch (e) { console.warn('[WagonWest] applySnub', e); }
    if (res && res.card) { try { dropCard(JA.cardForLeg(J, Math.random)); } catch (_) { /* ignore */ } }
    app.persist(); refreshCash(); Audio.cash();
    const cash = num(res && res.cash);
    if (smooth) effectToast(`${V15.SNUB_SMOOTH}${cash ? ` $${cash} for steady hands.` : ''}`, V15.SNUB_SMOOTH);
    else effectToast(`${V15.SNUB_BUMPY}${cash ? ` $${cash} all the same.` : ''}`, V15.SNUB_BUMPY);
    if (T) hud.update(J, T.leg, { milesDone: num(J.milesDone), ...hudExtra() });
  }

  // ----- the voyage home (v1.5, the Gold Road's last leg): a schooner up the coast, four markers, the Columbia bar -----
  function v2StartSail(leg) {
    const r = T;
    if (!r || !leg || !leg.voyage) return false;
    cancelAnimationFrame(r.raf);
    r.busy = true; r.sail = true;
    runSail(leg, r).catch((e) => { console.error('[WagonWest] sail', e); if (T === r) r.busy = false; });
    return true;
  }
  const SAIL_MARKERS = 4;
  async function runSail(leg, r) {
    const J = save.journey;
    J.milesDone = 0;                         // a sail always starts from the top: leaving mid-way loses nothing
    S('setBackdrop', 'sea');
    await showCard({ kicker: 'Home by sea', title: 'Up the coast!', text: V15.SAIL_INTRO, say: V15.SAIL_INTRO, tone: 'lookout', button: 'Set sail!' });
    if (T !== r) return;
    if (!ownedCards(J).has('schooner-home')) dropCard('schooner-home');
    v2.sail = { leg, markers: 0 };
    showBar('Steer the schooner: drag, or use the arrow keys', 'Stop for today', () => go('title'));
    app.say(V15.CUE_COAST);
    let end = await playMini('startSail', { seed: seedFor('sail'), length: SAIL_MARKERS }, {
      end: 'sailEnd', types: ['sailMarker', 'sail'],
      onEvent: (e) => { if (e.type === 'sailMarker') sailMarker(e, leg, r).catch((x) => console.error('[WagonWest] marker', x)); else if (e.bump) toast('A big swell! Hold on'); },
    });
    hideBar();
    if (end && end.unavailable && T === r) {                    // no scene sail (an older scene): the four markers are asked all the same
      for (let n = 1; n <= SAIL_MARKERS && T === r; n++) { v2.sail = { leg, markers: n }; await runMarker({ n, of: SAIL_MARKERS }, { sail: true }); }
      end = { bumps: 0 };
    }
    v2.sail = null;
    if (!end || T !== r) return;
    const bumps = Math.max(0, Math.round(num(end.bumps)));
    let pay = null;
    try { pay = JA.sailPay(J, { bumps }); } catch (e) { console.warn('[WagonWest] sailPay', e); }
    J.milesDone = leg.miles;
    app.persist(); refreshCash(); Audio.cash();
    hud.update(J, leg, { milesDone: leg.miles, ...hudExtra() });
    effectToast(`Over the bar and into the Columbia!${num(pay && pay.cash) ? ` $${pay.cash} for the voyage.` : ''}`, V15.CUE_BAR);
    await sleep(beat(3400));                 // the green shore
    if (T !== r) return;
    await arrival(r);
  }
  /** A marker on the voyage: a fact on the marker panel (chip "Marker n of 4"), recorded like a mile marker; then the schooner sails on. */
  async function sailMarker(e, leg, r) {
    const J = save.journey;
    if (v2.sail) v2.sail.markers = num(e.n);
    const of = Math.max(1, num(e.of) || SAIL_MARKERS);
    hud.update(J, leg, { milesDone: Math.round(num(leg.miles) * Math.max(0, num(e.n) - 1) / of), ...hudExtra() });
    await runMarker({ n: num(e.n), of }, { sail: true });
    if (T !== r || !v2.play || !v2.sail) return;
    hud.update(J, leg, { milesDone: Math.round(num(leg.miles) * num(e.n) / of), ...hudExtra() });
    if (num(e.n) >= of) app.say(V15.CUE_BAR);              // the last stretch is the Columbia bar
    S('sailGo');
  }

  // ----- the Columbia raft: the last leg of the Oregon Trail by the river (the-dalles → willamette-valley) is a raft run, not trail days -----
  function v2StartRaft(leg) {
    const r = T;
    if (!r || !leg || leg.id !== 'willamette-valley' || !(leg.stop && leg.stop.kind === 'home') || !scene || typeof scene.startRaft !== 'function') return false;
    cancelAnimationFrame(r.raf);
    r.busy = true; r.raft = true;
    runRaft(leg, r).catch((e) => { console.error('[WagonWest] raft', e); if (T === r) r.busy = false; });
    return true;
  }
  async function runRaft(leg, r) {
    const J = save.journey;
    J.milesDone = 0;                         // a raft run always starts from the top: leaving mid-way loses nothing
    await showCard({ kicker: 'The last stretch', title: 'Down the Columbia!', text: RAFT_INTRO, say: RAFT_INTRO, tone: 'lookout', button: 'Push off!' });
    if (T !== r) return;
    v2.raft = { leg, bends: 0 };
    showBar('Steer the raft: drag, or use the arrow keys', 'Stop for today', () => go('title'));
    const end = await playMini('startRaft', { seed: seedFor('raft'), length: RAFT_BENDS }, {
      end: 'raftEnd', types: ['raftMarker', 'raft'],
      onEvent: (e) => { if (e.type === 'raftMarker') raftBend(e, leg, r).catch((x) => console.error('[WagonWest] bend', x)); else if (e.bump) toast('Bump! Hold on'); },
    });
    hideBar();
    v2.raft = null;
    if (!end || T !== r) return;
    const bumps = Math.max(0, Math.round(num(end.bumps)));
    let pay = null;
    try { pay = JA.raftPay(J, { bumps }); } catch (e) { console.warn('[WagonWest] raftPay', e); }
    J.milesDone = leg.miles;
    app.persist(); refreshCash(); Audio.cash();
    hud.update(J, leg, { milesDone: leg.miles, ...hudExtra() });
    effectToast(`The raft is across!${num(pay && pay.cash) ? ` $${pay.cash} for the run${bumps ? '' : ', and not a single bump'}.` : ''}`, 'The raft is across!');
    await sleep(beat(3400));                 // the vista: the party cheers in the valley
    if (T !== r) return;
    await arrival(r);
  }
  /** A bend of the river: a fact on the marker panel (chip "Bend n of 4"), recorded like a mile marker; then the raft runs on. */
  async function raftBend(e, leg, r) {
    const J = save.journey;
    if (v2.raft) v2.raft.bends = num(e.n);
    const of = Math.max(1, num(e.of) || RAFT_BENDS);
    hud.update(J, leg, { milesDone: Math.round(num(leg.miles) * Math.max(0, num(e.n) - 1) / of), ...hudExtra() });       // (shown only: the miles are set at the valley)
    await runMarker({ n: num(e.n), of }, { raft: true });
    if (T !== r || !v2.play || !v2.raft) return;
    hud.update(J, leg, { milesDone: Math.round(num(leg.miles) * num(e.n) / of), ...hudExtra() });
    S('raftGo');
  }

  // ----- deeds: checked after what can earn one (every save does it), popped like a card, listed on the results -----
  function v2CheckDeeds() {
    const J = save.journey;
    if (!J || typeof JA.checkDeeds !== 'function') return [];
    let ids = [];
    try { ids = JA.checkDeeds(J, save.ledger, save.farm) || []; } catch (e) { console.warn('[WagonWest] checkDeeds', e); }
    for (const id of ids) {
      if (save.trip) save.trip.deeds = [...(Array.isArray(save.trip.deeds) ? save.trip.deeds : []), id];
      deedPop.pop(id);
    }
    return ids;
  }
  Object.assign(app, {
    /** What the second app stream's screens borrow from the app (rivers, people, deeds). */
    v2: {
      JA, showCard, runProblem, runProblemPanel, ladderPick, dropCard, curLeg,
      playMini, endPlay: () => endPlay(), seed: seedFor, cross: v2Cross, floatSafe: v2FloatSafe,
      checkDeeds: () => { const ids = v2CheckDeeds(); if (ids.length) { app.persist(); refreshCash(); } return ids; },
    },
  });

  // ---- v1.4: Frodo and the river (SPEC v1.4 §5) ----
  // The journey decides (J.dog, the finds, the fish, the quests, the moments: src/journey/*), the scene draws (vignettes and
  // mini-games on the same playMini() / waitScene() rails as v1.2's), and this block drives and speaks. Every journey call is
  // guarded (typeof JA.x === 'function') so an older journey or scene never stops the trail; nothing here can be failed.
  const waiters = [];                       // { types, resolve, t }: a flow waiting for one scene event (dogBack, chaseEnd, ambientEnd …)
  const introSaid = new Set();              // a mini-game's intro line is spoken the first time only
  let chase = null;                         // the rabbit chase in progress: { called }
  let lastFishing = null;                   // (tests) the last fishing session: { lb, caught, junk, newSpecies, summary }
  const sceneHas = (fn) => !!scene && typeof scene[fn] === 'function';
  const dogOf = () => (save.journey && save.journey.dog) || null;
  /** A line that names the dog, with the dog's name ("The dog" before there is one). */
  function dogLine(t) { const d = dogOf(); return String(t).replace(/\{dog\}/g, d ? d.name : 'The dog'); }
  /** Wait for a scene event (or `ms`): resolves the event, or null. */
  function waitScene(types, ms = 9000) {
    return new Promise((resolve) => {
      if (!scene) { setTimeout(() => resolve(null), 0); return; }
      const w = { types: Array.isArray(types) ? types : [types], resolve, t: 0 };
      w.t = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); resolve(null); }, ms);
      waiters.push(w);
    });
  }
  function feedWaiters(evt) {
    for (let i = waiters.length - 1; i >= 0; i--) { const w = waiters[i]; if (w.types.includes(evt.type)) { waiters.splice(i, 1); clearTimeout(w.t); w.resolve(evt); } }
  }
  /** The scene's sound cues (it draws, the app plays: src/meta/sfx.js). */
  function sceneSfx(evt) {
    try {
      if (evt.cue === 'reel') Sfx.reel(!!evt.on);
      else if (typeof Sfx[evt.cue] === 'function' && evt.cue !== 'ambient') Sfx[evt.cue]();
    } catch (_) { /* a sound never stops the trail */ }
  }
  const barText = (t) => { $('#mini-text').textContent = t; };
  const introOnce = (key, line) => { if (line && !introSaid.has(key)) { introSaid.add(key); app.say(line.say || line.text); } };
  const questIdOf = (x) => (!x ? null : typeof x === 'string' ? x : x.id || (x.quest && (typeof x.quest === 'string' ? x.quest : x.quest.id)) || null);
  const hatsInPlay = () => partyLook().filter((p) => p.hat && p.hat !== 'none');
  /** A thing the dog brought back (a find the journey has recorded): the pop with its line read, a "New!" ribbon on a first one. */
  function popFind(f) {
    const find = f && FIND_BY_ID[f.id];
    if (!find || !findPop) return;
    findPop.pop({ id: find.id, emoji: find.emoji, name: find.name, text: find.text, say: findLine(find), first: !!f.first });
  }
  function onTrailRun(fn) {              // (tests) a flow on an idle (or held: holdTrail) trail, as the day loop would run it
    const r = T;
    if (!r || (r.busy && !r.held)) return false;
    const keep = !!r.held;
    r.busy = true;
    Promise.resolve().then(fn).catch((e) => console.error('[WagonWest] v1.4 flow', e)).finally(() => { if (T === r) { r.busy = keep; r.last = 0; } });
    return true;
  }

  // ----- the dog's nose (§1.1): a find, a snake warning, a rabbit chase, the berry patch, a quest item -----
  async function runNose(nose, r) {
    const J = save.journey;
    if (!nose || !J || !J.dog) return;
    if (nose.kind === 'find') return noseFind(nose);                       // (the day does not stop for a find)
    S('setTravel', { moving: false });
    if (nose.kind === 'berries') return noseBerries(nose);
    if (nose.kind === 'quest') return noseQuest(nose);
    if (nose.kind === 'snake') return noseSnake(nose);
    if (nose.kind === 'rabbit') return noseRabbit(r);
  }
  function noseFind(nose) {
    const f = nose.find;
    if (!f || !FIND_BY_ID[f.id]) return;
    S('dogRun', 'find', { emoji: FIND_BY_ID[f.id].emoji });
    const line = dogLine(DOG_LINES.found);
    effectToast(line, line);
    if (!sceneHas('dogRun')) { popFind(f); return; }
    // (the day does not stop for a find: the dog is back in a few seconds and the pop comes out then)
    waitScene('dogBack', 9000).then(() => { popFind(f); app.persist(); });
    if (f.effect && f.effect.spirit && T) hud.update(save.journey, T.leg, { milesDone: num(save.journey.milesDone), ...hudExtra() });
  }
  async function noseBerries(nose) {
    const J = save.journey, d = J.dog;
    S('dogRun', 'berries', { emoji: '🍑' });
    if (sceneHas('dogRun')) await waitScene('dogBack', 9000);
    S('dogBark');
    const lb = Number.isFinite(Number(nose.foodLb)) ? num(nose.foodLb) : 20;      // (v1.7.1: a full wagon took none of them)
    const text = `${d.name} runs off barking and comes back by a patch of wild plums. Everyone picks!`;
    await showCard({ kicker: 'On the trail', title: `${d.name} found berries!`, text, say: text, tone: 'bonus', button: 'Yum!' });
    toast(lb > 0 ? `+${lb} lb of plums for the wagon` : "The wagon can't carry more; leave the rest for the next party");
    dropCard(nose.card ? cardOf(nose.card) : plumCard());
    app.persist();
  }
  async function noseQuest(nose) {
    const id = questIdOf(nose.quest);
    if (id) await dogFetchesQuest(id);
    app.persist();
  }
  async function noseSnake(nose) {
    const J = save.journey, d = J.dog;
    S('dogWarn');
    Sfx.bark();
    if (sceneHas('dogWarn')) await waitScene('dogWarnEnd', 9000);
    await showCard({ kicker: 'On the trail', title: `${d.name} barks a warning!`, text: MOMENTS.snake.text, say: MOMENTS.snake.say || MOMENTS.snake.text, tone: 'lookout', button: 'Good dog!' });
    dropCard(nose && nose.card ? cardOf(nose.card) : animalCard('rattlesnake'));
    app.persist();
  }
  /** The rabbit chase: the dog's name is a big button; a tap in the first part of the run and he skids round and trots back. Late
   *  or never: he comes back muddy from nose to tail. That is the whole penalty (the journey's chaseResult). */
  async function noseRabbit() {
    const J = save.journey, d = J.dog;
    const btn = $('#dog-call');
    $('#dog-call-name').textContent = d.name;
    let end = null;
    if (sceneHas('startChase')) {
      chase = { called: false };
      btn.hidden = false;
      const line = dogLine(DOG_LINES.chase);
      effectToast(line, line);
      const endP = waitScene('chaseEnd', 16000);
      S('startChase', { seed: seedFor('chase') });
      end = await endP;
      btn.hidden = true;
      chase = null;
    }
    const called = end ? !!end.called : true;
    const dist = end && Number.isFinite(end.dist) ? end.dist : (end ? 1 : 0);
    let cr = null;
    try { cr = typeof JA.chaseResult === 'function' ? JA.chaseResult(J, { called, dist }) : null; } catch (e) { console.warn('[WagonWest] chaseResult', e); }
    cr = cr || { muddy: !called, line: called ? 'good' : 'muddy' };
    const m = MOMENTS.chase[cr.line === 'good' ? 'good' : 'muddy'];
    effectToast(m.text, m.say || m.text);
    applySceneParty();                                     // (muddy: the mud overlay until a stop or a camp)
    dropCard(cr.card ? cardOf(cr.card) : animalCard('jackrabbit'));
    app.persist(); refreshCash();
  }
  $('#dog-call').addEventListener('click', () => {
    if (!chase || chase.called) return;
    chase.called = true;
    const ok = S('chaseCall');
    if (ok !== false) $('#dog-call').hidden = true;
  });
  window.addEventListener('keydown', (e) => {                           // (a laptop keyboard: Space or Enter calls the dog while the button shows)
    if (!chase || chase.called || $('#dog-call').hidden || screen !== 'trail') return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); $('#dog-call').click(); }
  });

  // ----- trail facts (§1.6): a vignette with a sound, then a card with one true fact and its card for the album -----
  async function runFact(fact, r) {
    const J = save.journey, tf = fact && TRAIL_FACT_BY_ID[fact.id];
    if (!J || !tf) return;
    if (fact.night && r) {
      r.weather = 'dusk';
      S('setTravel', { milesDone: num(J.milesDone), pace: J.pace, rations: J.rations, weather: 'dusk', mood: J.mood, foodLow: false, moving: false });
    } else S('setTravel', { moving: false });
    if (fact.sound) Sfx.ambient(fact.sound);
    if (fact.ambient && sceneHas('ambient')) { vignetteOn = true; try { S('ambient', fact.ambient); await waitScene('ambientEnd', 12000); } finally { vignetteOn = false; } }
    if (T !== r && r) return;
    await showCard({ kicker: 'Along the trail', title: tf.title, text: tf.text, say: tf.say || tf.text, tone: 'lookout', button: 'Wow' });
    let hf = null;
    try { hf = typeof JA.heardFact === 'function' ? JA.heardFact(J, tf.id) : null; } catch (e) { console.warn('[WagonWest] heardFact', e); }
    dropCard((hf && hf.card) || tf.card);
    if (tf.id === 'grizzly-ridge' && J.dog) { const l = dogLine(DOG_LINES.grizzly); effectToast(l, l); }
    app.persist();
  }

  // ----- the dust devil (§1.4): the hats fly, tap to catch them -----
  async function runDustDevil(r) {
    const J = save.journey;
    const hats = hatsInPlay();
    if (!hats.length) return;
    S('setTravel', { moving: false });
    const intro = MOMENTS.dustDevil.intro;
    await showCard({ kicker: 'On the trail', title: 'A dust devil!', text: intro.text, say: intro.say || intro.text, tone: 'event', button: 'Tap the hats!' });
    if (T !== r) return;
    showBar('Tap the hats!', 'Skip', () => endPlay(true));
    const end = await playMini('startDustDevil', { seed: seedFor('dust'), hats }, { end: 'dustDevilEnd', types: ['hat'], onEvent: (e) => { if (e.caught) Sfx.chime(); } });
    hideBar();
    if (!end || T !== r) return;
    const of = Number.isFinite(end.of) && end.of > 0 ? end.of : hats.length;
    const caught = Math.max(0, Math.min(of, num(end.caught)));
    let res = null;
    try { res = typeof JA.dustDevilResult === 'function' ? JA.dustDevilResult(J, { caught, of }) : null; } catch (e) { console.warn('[WagonWest] dustDevilResult', e); }
    const all = res ? !!res.all : caught >= of;
    const m = all ? MOMENTS.dustDevil.all : MOMENTS.dustDevil.some;
    effectToast(m.text, m.say || m.text);
    if (all) { Audio.cash(); toast(`+${num(res && res.tokens) || 1} trade token`); }
    else if (J.dog) { const l = dogLine(DOG_LINES.hats); effectToast(l, l); }
    app.persist(); refreshCash();
  }

  // ----- skipping stones (§1.4): at the river stops after the crossing, and once a leg at a river camp -----
  /** Are the stones still to be skipped here? (the journey keeps one flag for the stop and one for the camp of the leg) */
  function stonesFree(J) {
    const t = J && J.trip;
    return !!t && typeof JA.stonesPlan === 'function' && !t[t.arrived ? 'stonesStop' : 'stones'];
  }
  async function offerStones(leg) {
    const J = save.journey;
    if (!J || !stonesFree(J)) return;
    const m = MOMENTS.stones.intro;
    const c = await showCard({ kicker: 'The river bank', title: 'Skip stones?', text: m.text, say: m.say || m.text, tone: 'camp', button: 'Skip stones', alt: 'On we go' });
    if (c !== true || screen !== 'stop') return;
    await runStones();
  }
  async function runStones() {
    const J = save.journey;
    let plan = { throws: 3, bonus: 0 };
    try { plan = JA.stonesPlan(J) || plan; } catch (e) { console.warn('[WagonWest] stonesPlan', e); }
    S('setBackdrop', 'river');
    showBar('Tap to throw, then tap as the stone touches the water', 'Done', () => endPlay(true));
    const got = [];
    const top = (JA.MOMENTS && JA.MOMENTS.stones && JA.MOMENTS.stones.maxSkips) || 12;
    const end = await playMini('startStones', { seed: seedFor('stones'), throws: plan.throws, bonus: plan.bonus }, { end: 'stonesEnd', types: ['skip', 'stone'],
      onEvent: (e) => {
        if (e.type === 'skip') { barText(`${e.n} skip${e.n === 1 ? '' : 's'}!`); return; }
        barText(`Throw ${num(e.throw)}: ${num(e.skips)} skip${num(e.skips) === 1 ? '' : 's'}`);
        got.push(num(e.skips));
        // (v1.5, playtest 1.4 U5: a stone that skips as far as a stone can ends the game there: twelve skips on every throw is not three throws, it is one)
        if (num(e.skips) >= top && num(e.throw) < plan.throws) { effectToast(`As far as a stone can skip: ${top} skips!`, V15.STONES_TOP); setTimeout(() => endPlay(true), beat(350)); }
      } });
    hideBar();
    if (!end) return;
    const throws = Array.isArray(end.throws) && end.throws.length ? end.throws.map((n) => num(n)) : got;
    if (!throws.length) return;
    let res = null;
    try { res = typeof JA.stonesResult === 'function' ? JA.stonesResult(J, { throws }) : null; } catch (e) { console.warn('[WagonWest] stonesResult', e); }
    const best = res ? num(res.best) : Math.max(0, ...throws);
    if (res && res.newBest) effectToast(MOMENTS.stones.best.text, MOMENTS.stones.best.say || MOMENTS.stones.best.text);
    else toast(`Best throw: ${best} skip${best === 1 ? '' : 's'}`);
    Audio.cash();
    app.persist();
  }

  // ----- camp's games (§1.2, §1.3, §1.4): none of them costs a day or food -----
  /** Which of camp's extra choices are on offer: 'fetch' | 'hoppers' | 'stones' | 'stars'. */
  function funCamp(context) {
    const J = save.journey;
    if (!J) return [];
    const out = [];
    if (J.dog) out.push('fetch');
    const max = (JA.FISHING && JA.FISHING.hopperMax) || 12;
    if (typeof JA.catchHoppers === 'function' && num(J.goods && J.goods.hoppers) < max) out.push('hoppers');
    let cw = null;
    try { cw = typeof JA.campWater === 'function' ? JA.campWater(J) : null; } catch (_) { cw = null; }
    if (cw && cw.river && stonesFree(J)) out.push('stones');
    try { if (typeof JA.rocksFree === 'function' && JA.rocksFree(J)) out.push('rocks'); } catch (_) { /* ignore */ }      // ---- v1.7: flip rocks for bait ----
    if (context === 'arrival' && campVisit && !campVisit.stars) {
      let tonight = false;
      try { tonight = typeof JA.meteorsTonight === 'function' && !!JA.meteorsTonight(J); } catch (_) { tonight = false; }
      if (tonight) out.push('stars');
    }
    return out;
  }
  async function funActivity(kind) {
    if (kind === 'fetch') await funFetch();
    else if (kind === 'hoppers') await funHoppers();
    else if (kind === 'stones') await runStones();
    else if (kind === 'stars') await funMeteors();
    else if (kind === 'rocks') await runRocks();
    if (screen === 'camp') S('setBackdrop', 'camp');
    app.persist(); refreshCash();
  }
  async function funFetch() {
    const J = save.journey;
    if (!J || !J.dog) return;
    introOnce('fetch', MOMENTS.fetch.intro);
    showBar(MOMENTS.fetch.intro.text, 'Done', () => endPlay(true));
    S('setBackdrop', 'camp');
    let thrown = 0;
    const end = await playMini('startFetch', { seed: seedFor('fetch'), throws: (JA.FETCH && JA.FETCH.throws) || 3 }, { end: 'fetchEnd', types: ['fetchThrow', 'fetchBack'],
      onEvent: (e) => {
        if (e.type !== 'fetchThrow') return;
        thrown += 1;
        let r = null;
        try { r = typeof JA.fetchThrow === 'function' ? JA.fetchThrow(J, { dist: num(e.dist), rand: Math.random }) : null; } catch (x) { console.warn('[WagonWest] fetchThrow', x); }
        r = r || { treats: 1, item: null };
        const item = r.item ? FIND_BY_ID[r.item] : null;
        const treats = Math.max(0, Math.min(3, Math.round(num(r.treats))));
        barText(item ? dogLine(DOG_LINES.fetchFind) : treats ? MOMENTS.fetch.treats[treats - 1] : 'Good throw!');
        if (item) popFind({ id: item.id, first: !!r.first });
        S('fetchBring', { item: item ? 'find' : 'stick', emoji: item ? item.emoji : '🪵' });
        app.persist();
      } });
    hideBar();
    if (end && !end.early && thrown) effectToast(MOMENTS.fetch.tired.text, MOMENTS.fetch.tired.say || MOMENTS.fetch.tired.text);
  }
  async function funHoppers() {
    const J = save.journey;
    introOnce('hoppers', MOMENTS.hoppers.intro);
    showBar(MOMENTS.hoppers.intro.text, 'Done', () => endPlay(true));
    S('setBackdrop', 'camp');
    const end = await playMini('startHoppers', { seed: seedFor('hoppers'), n: 6 }, { end: 'hoppersEnd', types: ['hopper'], onEvent: (e) => { if (e.caught) Sfx.plop(); } });
    hideBar();
    if (!end) return;
    let r = null;
    try { r = JA.catchHoppers(J, Math.max(0, Math.round(num(end.caught)))); } catch (e) { console.warn('[WagonWest] catchHoppers', e); }
    const have = r ? num(r.have) : 0, max = (JA.FISHING && JA.FISHING.hopperMax) || 12;
    if (have >= max) effectToast(MOMENTS.hoppers.full.text, MOMENTS.hoppers.full.say || MOMENTS.hoppers.full.text);
    else toast(`${have} grasshopper${have === 1 ? '' : 's'} in the bait tin`);
  }
  // ----- v1.7: flip rocks for bait (offered at the river stops after the crossing, and at camp): worms, beetles, crickets, crawdads, mud, and now and then an arrowhead -----
  async function offerRocks(leg) {
    const J = save.journey;
    if (!J || typeof JA.rocksFree !== 'function' || !JA.rocksFree(J) || !sceneHas('startRocks')) return;
    const m = MOMENTS.rocks;
    const c = await showCard({ kicker: 'The river bank', title: 'Flip some rocks?', text: m.intro.text, say: m.intro.say || m.intro.text, tone: 'camp', button: 'Flip rocks', alt: 'On we go' });
    if (c !== true || screen !== 'stop') return;
    await runRocks();
  }
  async function runRocks() {
    const J = save.journey;
    if (!J || typeof JA.rocksPlan !== 'function') return;
    let plan = null;
    try { plan = JA.rocksPlan(J); } catch (e) { console.warn('[WagonWest] rocksPlan', e); }
    if (!plan) return;
    const m = MOMENTS.rocks;
    introOnce('rocks', m.intro);
    showBar(m.intro.text, 'Done', () => endPlay(true));
    if (screen === 'camp') S('setBackdrop', 'camp'); else if (screen === 'stop') S('setBackdrop', 'river');
    const end = await playMini('startRocks', { seed: seedFor('rocks'), rocks: plan.rocks }, { end: 'rocksEnd', types: ['rock'],
      onEvent: (e) => {
        let r = null;
        try { r = JA.flipRock(J, plan, num(e.i)); } catch (x) { console.warn('[WagonWest] flipRock', x); }
        if (!r) return;
        if (r.kind === 'arrowhead') { barText(FIND_BY_ID.arrowhead.text); if (r.find) setTimeout(() => popFind({ id: 'arrowhead', first: !!r.find.first }), beat(700)); }
        else if (r.kind === 'mud') barText(m.mud.text);
        else if (r.full) { barText(m.full.text); effectToast(m.full.text, m.full.say || m.full.text); }
        else { barText((m[r.kind] || m.mud).text); Sfx.plop(); }
        app.persist();
      } });
    hideBar();
    let res = null;
    try { res = JA.endRocks(J, plan); } catch (e) { console.warn('[WagonWest] endRocks', e); }
    app.persist(); refreshCash();
    if (end && !end.early && res && res.flipped) effectToast(m.end.text, m.end.say || m.end.text);
  }
  async function funMeteors() {
    const J = save.journey;
    if (campVisit) campVisit.stars = true;
    const m = MOMENTS.meteors;
    introOnce('stars', m.intro);
    showBar(m.intro.text, 'Done', () => endPlay(true));
    S('setBackdrop', 'camp');
    let wishes = 0;
    const end = await playMini('startMeteors', { seed: seedFor('meteors'), n: (JA.MOMENTS && JA.MOMENTS.meteors && JA.MOMENTS.meteors.stars) || 8 }, { end: 'meteorsEnd', types: ['meteor'],
      onEvent: () => {
        let w = null;
        try { w = typeof JA.wishFor === 'function' ? JA.wishFor(J, Math.random) : null; } catch (x) { console.warn('[WagonWest] wishFor', x); }
        const wish = w && WISH_BY_ID[w.id];
        if (!wish) return;
        wishes += 1;
        findPop.pop({ id: wish.id, emoji: '🌠', name: w.first ? 'A new wish' : 'A wish', text: wish.text, first: !!w.first, live: true, quiet: true });
        app.persist();
      } });
    hideBar();
    if (end) effectToast(m.end.text, m.end.say || m.end.text);
  }

  // ----- Fishing 2.0 (§1.3): bait, the cast and the dip, the fight (hold to reel, let go on the red), the log -----
  function chooseBait(baits) {
    return new Promise((resolve) => {
      const row = $('#bait-row');
      row.replaceChildren(...baits.map((b) => {
        const def = BAIT_BY_ID[b.id] || { name: b.id, emoji: '🎣', text: '' };
        const sub = b.id === 'hoppers' || b.n !== undefined ? (b.n > 0 ? `${b.n} in the tin` : 'none yet') : b.id === 'spoon' ? (b.ok ? 'never used up' : 'at a fort store') : 'always there';
        const btn = h('button', { class: 'bait-btn', 'data-bait': b.id, 'data-sfx': '', disabled: b.ok === false, 'aria-label': `${def.name}: ${def.text || sub}` },
          h('span', { class: 'bait-emoji', 'aria-hidden': 'true' }, def.emoji), h('span', {}, def.name), h('small', {}, sub));
        btn.addEventListener('click', () => { row.hidden = true; resolve(b.id); });
        return btn;
      }));
      row.hidden = false;
      showBar('Pick your bait', 'Done fishing', () => { row.hidden = true; resolve(null); });
    });
  }
  /** One fishing session: the trail's fishing event (`rescue` for the safety net) or camp's Fishing. Resolves the pounds of fish. */
  async function runFishing({ rescue = false, bait: preset = null } = {}) {
    const J = save.journey;
    if (!J) return 0;
    if (typeof JA.fishingSession !== 'function' || !sceneHas('startFishing')) return runMini('fish');      // an older scene or journey: 1.0's cast and dip
    const baits = typeof JA.baitsAvailable === 'function' ? JA.baitsAvailable(J) : [{ id: 'worms', ok: true }];
    const bait = preset || await chooseBait(baits);
    if (!bait) {
      hideBar();
      if (rescue) {                                          // (the safety net never leaves the wagon without food: a child who skips the line still gets the minimum)
        try { const r0 = JA.endFishing(J, JA.fishingSession(J, { bait: 'worms', rescue: true })); app.persist(); if (r0 && num(r0.lb)) toast(`+${Math.round(num(r0.lb))} lb of fish for the wagon`); } catch (e) { console.warn('[WagonWest] rescue fishing', e); }
      }
      return 0;
    }
    let session = null;
    try { session = JA.fishingSession(J, { bait, rescue }); } catch (e) { console.warn('[WagonWest] fishingSession', e); }
    if (!session) { hideBar(); return 0; }
    app.persist();                                          // (the plan used the tin and the seed counter)
    const look = partyLook();
    const hid = campCompanion();
    const helperLook = look.find((l) => l.id === hid) || look[0] || null;
    const helperC = helperLook ? COMPANION_BY_ID[helperLook.id] : null;
    const m = MOMENTS.fishing;
    const got = { caught: [], cards: [], questId: null, newSpecies: [] };
    showBar(m.hint.text, 'Done fishing', () => endPlay(true));
    const end = await playMini('startFishing', { seed: seedFor('fishing'), water: session.water, bait, casts: session.casts, cameo: session.cameo || null, bear: session.bear || null, helper: helperLook, dog: !!J.dog },
      { end: 'fishingEnd', types: ['fishHook', 'fishMiss', 'fishPhase', 'fishWobble', 'fishHelp', 'fishHelped', 'fishOff', 'fishLand', 'fishCameo', 'fishBear'], onEvent: (e) => fishEvent(e, session, got, helperC, m) });
    hideBar();
    Sfx.reel(false);
    let r = null;
    try { r = JA.endFishing(J, session); } catch (e) { console.warn('[WagonWest] endFishing', e); }
    r = r || { lb: 0, caught: [], junk: [], newSpecies: [], best: false, summary: { text: m.none.text, say: m.none.say || m.none.text } };
    lastFishing = { lb: num(r.lb), caught: r.caught || [], junk: r.junk || [], newSpecies: r.newSpecies || [], best: !!r.best, summary: r.summary, bait };
    app.persist(); refreshCash();
    if (!end || screen === 'title' || screen === 'players') return num(r.lb);
    for (const sp of r.newSpecies || []) { const f = FISH_BY_ID[sp]; if (f && !got.cards.includes(f.card)) { got.cards.push(f.card); dropCard(f.card); } }
    const sum = r.summary || { text: m.none.text, say: m.none.say || m.none.text };
    await showCard({ kicker: 'Fishing', title: num(r.lb) ? 'A good catch!' : 'No bites this time', text: sum.text, say: sum.say || sum.text, tone: 'bonus', button: 'To the wagon' });
    if ((r.newSpecies || []).length) effectToast(m.newSpecies.text, m.newSpecies.say || m.newSpecies.text);
    if (num(r.lb)) toast(`+${Math.round(num(r.lb))} lb of fish for the wagon`);
    if (got.questId && QUEST_BY_ID[got.questId]) {
      const it = QUEST_BY_ID[got.questId].item;
      await showCard({ kicker: 'In the bottle', title: it.name, text: it.text, say: it.say || it.text, sticker: { emoji: it.emoji, name: '' }, tone: 'camp', button: 'Keep it safe' });
    }
    app.persist();
    return num(r.lb);
  }
  function fishEvent(e, session, got, helperC, m) {
    const J = save.journey;
    // (the reel, the wobble, the splash and the turtle's snap are the scene's cues: sceneSfx plays them)
    if (e.type === 'fishHook') { Sfx.plop(); barText(m.hint.text); }
    else if (e.type === 'fishMiss') barText(m.swam.text);
    else if (e.type === 'fishPhase') { if (e.phase !== 'reel') Sfx.reel(false); }
    else if (e.type === 'fishHelp') { barText(`${m.help.text}${helperC ? ` Tap ${helperC.name}.` : J.dog ? ` ${J.dog.name} is on the way.` : ''}`); }
    else if (e.type === 'fishHelped') barText(helperC && helperC.lines && helperC.lines.help ? `${helperC.name}: “${helperC.lines.help}”` : J.dog ? dogLine(DOG_LINES.help) : 'Two on the rod!');
    else if (e.type === 'fishOff') {
      Sfx.reel(false); barText(m.off.text);
      let co = null;
      try { co = JA.castOff(J, session, e.i); } catch (x) { console.warn('[WagonWest] castOff', x); }
      if (co && co.retry && co.fight) S('fishingRetry', e.i, co.fight);
    } else if (e.type === 'fishLand') {
      Sfx.reel(false);
      let lr = null;
      try { lr = JA.landCast(J, session, e.i); } catch (x) { console.warn('[WagonWest] landCast', x); }
      lr = lr || {};
      if (lr.kind === 'junk') {
        const jk = JUNK_BY_ID[lr.junk];
        barText(jk ? jk.text : 'Something odd on the line!');
        const qid = questIdOf(lr.quest);
        if (qid) got.questId = qid;
      } else {
        const f = FISH_BY_ID[lr.species];
        Sfx.chime();
        let t = f ? `${f.land.text} ${num(lr.lengthIn) ? `${Math.round(num(lr.lengthIn))} inches. ` : ''}` : 'Got one! ';
        if (lr.best) t += `${m.best.text} `;
        if (lr.firstSpecies) { t += m.newSpecies.text; got.newSpecies.push(lr.species); }
        barText(t.trim());
        if (f) got.caught.push(f.id);
        const card = lr.card || (lr.firstSpecies && f ? f.card : null);
        if (card && !got.cards.includes(card)) { got.cards.push(card); dropCard(card); }
      }
    } else if (e.type === 'fishCameo') barText(dogLine(e.kind === 'steal' ? DOG_LINES.steal : DOG_LINES.splash));
    else if (e.type === 'fishBear') bearEvent(e);
  }
  // ----- v1.7: a bear on the far bank of the fishing hole: the fish scatter; wait for it to leave, or try another spot (nobody is ever near it) -----
  function bearEvent(e) {
    const J = save.journey, b = MOMENTS.bear;
    if (e.stage === 'arrive') { barText(b.arrive.text); effectToast(b.arrive.text, b.arrive.say || b.arrive.text); }
    else if (e.stage === 'wait' || e.stage === 'move') { const row = $('#bait-row'); if (row && !row.hidden) { row.hidden = true; if (bearAsk) { bearAsk(null); bearAsk = null; } } }      // (answered from outside the panel)
    else if (e.stage === 'ask') {
      barText(b.ask.text);
      if (J && J.dog) effectToast(dogLine(DOG_LINES.bear), dogLine(DOG_LINES.bear));
      chooseBear().then((choice) => {
        if (!choice) return;
        try { JA.bearChoice(J, choice); } catch (x) { console.warn('[WagonWest] bearChoice', x); }
        S('fishingBear', choice);
        const w = e.kind === 'berries' ? b.waitingBerries : b.waitingFish;
        barText(choice === 'spot' ? b.moved.text : w.text);
        if (choice === 'wait') effectToast(w.text, w.say || w.text);
        app.persist();
      });
    } else if (e.stage === 'gone') {
      barText(e.moved ? b.moved.text : b.gone.text);
      effectToast(e.moved ? b.moved.text : b.gone.text, e.moved ? (b.moved.say || b.moved.text) : (b.gone.say || b.gone.text));
      effectToast(b.fact.text, b.fact.say || b.fact.text);
    }
  }
  let bearAsk = null;
  function chooseBear() {
    return new Promise((resolve) => {
      bearAsk = resolve;
      const row = $('#bait-row'), b = MOMENTS.bear;
      const mk = (id, emoji, label, note) => {
        const btn = h('button', { class: 'bait-btn', 'data-bear': id, 'data-sfx': '', 'aria-label': `${label}: ${note}` },
          h('span', { class: 'bait-emoji', 'aria-hidden': 'true' }, emoji), h('span', {}, label), h('small', {}, note));
        btn.addEventListener('click', () => { row.hidden = true; bearAsk = null; resolve(id); });
        return btn;
      };
      row.replaceChildren(mk('wait', '⏳', b.wait.text, 'it will wander off'), mk('spot', '🎣', b.spot.text, 'a new pool'));
      row.hidden = false;
    });
  }

  // ----- the old iron the dog brings (§1.1) and the store -----
  Object.assign(app, {
    /** Camp's extra choices (fetch, grasshoppers, stones, falling stars). */
    funCamp,
    /** What the wagon's old horseshoes sell for at a fort store: { n, cash } or null. */
    horseshoes() {
      const J = save.journey;
      const n = J ? num(J.goods && J.goods.horseshoes) : 0;
      if (!n) return null;
      const price = (JA.HORSESHOE && JA.HORSESHOE.price) || 1;
      return { n, cash: n * price * num(app.season().priceMult, 1) };
    },
    sellHorseshoes() {
      const J = save.journey;
      if (!J || typeof JA.sellHorseshoes !== 'function') return null;
      let r = null;
      try { r = JA.sellHorseshoes(J, { leg: curLeg() }); } catch (e) { console.warn('[WagonWest] sellHorseshoes', e); }
      if (r && r.n) {
        Audio.cash();
        const text = `The blacksmith buys ${r.n} old horseshoe${r.n === 1 ? '' : 's'} for $${r.cash}.`;
        effectToast(text);
        app.sayLater(app.spoken(text));          // (read at once, behind whatever is playing: the store has no clear spot for a toast, and the sale should be heard)
        app.persist(); refreshCash();
      }
      return r;
    },
    /** The post office: what was sent ahead to its owner (a quest walked past), one card each, before the letter. */
    async questMail(leg) {
      const J = save.journey;
      if (!J || typeof JA.questMail !== 'function') return;
      let list = [];
      try { list = JA.questMail(J, { leg }) || []; } catch (e) { console.warn('[WagonWest] questMail', e); }
      for (const m of list) {
        const q = QUEST_BY_ID[m.questId];
        await showCard({ kicker: 'Post office', title: q ? q.name : 'Sent ahead', text: m.text, say: m.text, sticker: q ? { emoji: q.item.emoji, name: '' } : null, tone: 'trade', button: 'Good' });
        if (m.card) dropCard(m.card);
      }
      if (list.length) { app.persist(); app.v2.checkDeeds(); }
    },
  });
  findPop = createFindPop($('#findpop'), { sfx: Sfx, say: (t) => speech.later(t), hold: (root) => popHeld(root, { blocked: readingOpen, hold: () => screen === 'results' }), waitFor: () => !$('#cardpop').hidden || !$('#deedpop').hidden });         // (a card or a deed pop that is DRAWN now: one that only waits its turn behind a toast must not hold this one back)

  // ----- test hooks (§5.11) -----
  function makeNose(kind, findId) {
    const J = save.journey, leg = curLeg();
    if (kind === 'find') {
      let id = findId;
      if (!id && typeof JA.drawFind === 'function') { try { id = JA.drawFind(J, leg, Math.random, {}); } catch (_) { id = null; } }
      id = id || 'pinecone';
      let rf = null;
      try { rf = typeof JA.recordFind === 'function' ? JA.recordFind(J, id) : null; } catch (e) { console.warn('[WagonWest] recordFind', e); }
      return { kind, find: rf || { id, first: true, n: 1 } };
    }
    if (kind === 'berries') {
      const lb = 20;
      if (typeof JA.addFoodKind === 'function') { try { JA.addFoodKind(J, 'other', lb); } catch (_) { J.food = num(J.food) + lb; } } else J.food = num(J.food) + lb;
      return { kind, foodLb: lb };
    }
    if (kind === 'quest') {
      let id = null, f = null;
      try { id = JA.questFindable(J, 'nose'); f = id ? JA.findQuestItem(J, id) : null; } catch (_) { id = null; }
      return f ? { kind, quest: { id: questIdOf(f.quest) || id, item: f.item } } : null;
    }
    return { kind };
  }
  Object.assign(app, {
    playNose: (kind, findId) => { if (!T || (T.busy && !T.held)) return false; const n = makeNose(kind, findId); return n ? onTrailRun(() => runNose(n, T)) : false; },   // (a busy trail refuses BEFORE makeNose records the find / adds the plums: a caller that retries, as the tests' hook() does, used to record it once per try)
    playFact(id) {
      const tf = TRAIL_FACT_BY_ID[id];
      return tf ? onTrailRun(() => runFact({ id, night: tf.when === 'night', ambient: tf.ambient || null, sound: tf.sound }, T)) : false;
    },
    playMoment: (kind) => (kind === 'dustDevil' ? onTrailRun(() => runDustDevil(T)) : false),
    /** A fishing session on an idle trail or at camp (`bait` skips the choice). Returns at once: the session plays on. */
    fishNow({ bait = null } = {}) {
      if (T && (!T.busy || T.held)) { const r = T, keep = !!r.held; r.busy = true; runFishing({ bait }).catch((e) => console.error(e)).finally(() => { if (T === r) { r.busy = keep; r.last = 0; } }); return true; }
      if (screen === 'camp' || screen === 'stop') { runFishing({ bait }).catch((e) => console.error(e)); return true; }
      return false;
    },
    /** Tests only: start leg `legId` at mile 0 and go to the trail (for the Snake's sturgeon and The Dalles' Sam). */
    jumpLeg(legId, { hold = false } = {}) {          // hold: the day loop is held still from the first frame (holdTrail), so nothing opens before a test acts
      const J = save.journey;
      if (!J || !LEG_BY_ID[legId] || typeof JA.startLeg !== 'function') return false;
      stopTravel();
      try { card.close(); } catch (_) { /* ignore */ }
      JA.startLeg(J, legId);
      J.milesDone = 0;
      if (J.trip) J.trip.tipUsed = true;
      save.trip = { legId, stage: 'trail', events: [], asked: { ration: 0, distance: 0 }, markers: 0, at: Date.now(), tokens0: num(J.tokens), gold0: num(J.gold), dig: { pans: 0, rocker: 0 } };
      app.persist();
      hitTrail();
      if (hold && T) { T.busy = true; T.held = true; }
      return true;
    },
  });

  // ---- v1.5: the year, the farm and the rest of what the screens ask of the app ----
  const runLine = () => {
    const J = save.journey;
    if (!J) return { year: yearNow(), tier: TIERS[0].name, route: ROUTES.emigrant.name };
    return { year: J.year || yearNow(), tier: (TIER_BY_ID[J.tier] || TIERS[0]).name, route: (ROUTES[J.route] || ROUTES.emigrant).name };
  };
  /** The fork waiting at the stop the party is at ({ id, at, name }), or null: the title says "A choice at Fort Hall". */
  function pendingFork() {
    const J = save.journey;
    if (!J || J.done || !save.trip || save.trip.stage !== 'stop') return null;
    let f = null;
    try { f = JA.forkAt(J); } catch (_) { f = null; }
    if (!f) return null;
    const l = LEG_BY_ID[f.at] || {};
    return { id: f.id, at: f.at, name: (l.stop && l.stop.name) || l.name || 'the fork' };
  }
  const hasFarm = () => !!(save.farm && save.farm.sites && Object.keys(save.farm.sites).length);
  /** The farm's name for the letters ("Dear everyone at Rose Hill,"): the Willamette farm's, else any named farm's; '' until a farm is named. */
  function farmName() {
    const sites = (save.farm && save.farm.sites) || {};
    return (sites.willamette && sites.willamette.name) || Object.values(sites).map((s) => s.name).find(Boolean) || save.homestead || '';
  }
  function openFarm(siteId) {
    if (!currentPlayerId) return;
    if (!save.farm.sites[siteId]) { toast('No farm there yet'); return; }
    if (!['title', 'journal', 'results', 'farm'].includes(screen)) return;
    go('farm', { site: siteId });
  }
  /** Draw the homestead of a site on the scene (pieces, the team, the dog, the decorations, the trophy plates). */
  function sceneFarm(siteId) {
    const s = save.farm.sites[siteId];
    if (!s) return;
    const J = save.journey;
    S('setBackdrop', 'homestead');
    const plates = (save.ledger.trophies || []).filter((t) => (siteId === 'sacramento' ? /:california$/ : /:(oregon|gold-road)$/).test(t)).map((t) => t.split(':')[0]);
    S('setHomestead', { site: siteId, name: s.name, pieces: { ...s.pieces }, animals: { ...save.farm.animals }, dog: J && J.dog ? { name: J.dog.name, coat: J.dog.coat } : null,
      decor: wornDecor(save.cosmetics), party: partyLook(), trophies: plates });
  }
  /** Build a piece at a farm: the journey pays and records it, the scene raises it, a deed may come. → buildPiece's result. */
  async function farmBuild(siteId, pieceId) {
    const J = save.journey;
    let res = null;
    try { res = JA.buildPiece(save.farm, siteId, pieceId, J); } catch (e) { console.warn('[WagonWest] buildPiece', e); }
    if (!res || !res.ok) { toast((res && res.why) || 'Not yet'); return res; }
    const p = PIECE_BY_ID[pieceId];
    app.persist(); refreshCash(); Audio.cash();
    lastBuild = { site: siteId, piece: pieceId, count: res.count, paid: res.paid };
    labReport({ event: 'farm', n: 1 });                                              // v1.6 (The Lab): a homestead piece built
    toast(`${p ? p.name : 'The piece'}: built!`);
    if (res.say) app.sayLater(res.say);
    if (pieceId === 'name-plate' && save.farm.sites[siteId].name) { const t = `${save.farm.sites[siteId].name}!`; app.voiceFor([t], 1500); app.sayLater(t); }
    sceneFarm(siteId);
    if (sceneHas('buildPiece')) { const done = waitScene('buildDone', 6000); S('buildPiece', pieceId); await done; }
    app.v2.checkDeeds();
    app.persist();
    return res;
  }
  let lastBuild = null;
  /** "Work it out" on a savings piece: how much is left in savings after it (a 'buy' problem for a token; once a piece). */
  async function farmWork(siteId, pieceId) {
    const piece = PIECE_BY_ID[pieceId];
    const cost = ((JA.HOMESTEAD_COST || {})[pieceId] || {}).savings | 0;
    const have = JA.farmBalance(save.farm).savings;
    if (!piece || !cost || have < cost) return null;
    const p = workProblem(piece, cost, have, JA.numberWords);
    save.seen.worked[`${siteId}:${pieceId}`] = true;
    app.persist();
    return runProblemPanel(p, { kind: 'buy', title: FARM_TEXT.workTitle, chipText: piece.name });
  }
  const placementLine = (id) => {
    let f = null;
    try { f = id === currentPlayerId ? facts : loadFactsData(id); } catch (_) { f = null; }
    const offered = num(app.saveOf(id).seen.placeOffers);
    if (f && f.placement) return 'Pit Crew Check: done (the problems fit the child’s Trail Blazer ladder)';
    if (JA.hasFactsHistory(f)) return 'Pit Crew Check: not needed (the child already has a Trail Blazer ladder)';
    return offered ? `Pit Crew Check: offered ${offered} time${offered === 1 ? '' : 's'}, not taken yet (it comes back at the next store or marker, up to three times)` : 'Pit Crew Check: will be offered at the first store or mile marker (about 15 quick facts; “Later” is always fine)';
  };
  Object.assign(app, {
    yearNow, journeyN, yearInfo, startYear, beginYear, outfitContext, runLine, pendingFork, hasFarm, farmName, openFarm, sceneFarm, farmBuild, farmWork, placementLine, arriveFarm,
    planLegs: () => planLegs(save.journey),
    cancelSpeech: () => speech.cancel(),
    sceneCall: (fn, ...a) => S(fn, ...a),
    sceneHas,
  });
  Object.assign(app.v2, {
    showBar, hideBar, rng: (tag) => rngFrom(seedFor(tag)),
  });

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
    if (document.hidden) { pause(); speech.cancel(); Audio.suspend(); Sfx.suspend(); if (currentPlayerId) app.persist(); } else { Audio.resume(); Sfx.resume(); }
  });
  window.addEventListener('pagehide', () => { pause(); speech.cancel(); if (currentPlayerId) app.persist(); });

  // ---------- navigation ----------
  $('#btn-trail').addEventListener('click', () => {
    const a = $('#btn-trail').dataset.action;
    if (a === 'outfit') go('outfit', { fresh: true }); else if (a === 'season') newSeason(); else hitTrail();
  });
  $('#btn-journal').addEventListener('click', () => go('journal'));
  $('#btn-farm').addEventListener('click', () => { const ids = SITES.map((s) => s.id).filter((id) => save.farm.sites[id]); if (ids.length) openFarm(screens.farm.site && save.farm.sites[screens.farm.site] ? screens.farm.site : ids[0]); });
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
  for (const id of ['panel-marker', 'panel-problem', 'panel-fork', 'spell', 'card', 'mini', 'panel-pause', 'panel-wagon', 'pz']) { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); }

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
    app, pz, sync, tts, speech, store, river, postOffice, results, hud, markerPanel, problemPanel, spellPanel, card, wagonPanel,
    get scene() { return scene; }, get screen() { return screen; }, get save() { return save; }, get facts() { return facts; },
    get reading() { return { overlay: app.overlayOpen(), play: !!v2.play, bar: !!v2.bar, mini: !!mini, derby: !!derby }; },   // (tests: what holds the toasts)
    holdTrail(on) { if (T) { T.busy = !!on; T.held = !!on; } return !!T; },   // (a test hook: the day loop waits, as it does under a scripted event)
    get travel() { return T ? { legId: T.leg.id, busy: T.busy, day: !!T.day } : null; }, get paused() { return paused; }, get mini() { return mini ? { kind: mini.kind, lb: mini.lb, leads: mini.leads || 0 } : null; },
    JA, cloud, Music, cardPop, toaster, camp: screens.camp,
    peopleUI, deedPop, get v2() { return { play: v2.play ? v2.play.fn : null, raft: v2.raft ? { ...v2.raft } : null, sail: v2.sail ? { ...v2.sail } : null }; },    // (v1.2 app two)
    // ---- v1.5 ----
    forkPanel, diggings, yearPicker: screens.year, farmUI: screens.farm,
    // ---- v1.6 (The Lab) ----
    choicePanel, labHud, labResults, labBridge, get lastChoice() { return lastChoice; }, get lastCheer() { return lastCheer; }, labLooks, labReport: (ev) => labReport(ev),
    get lastFork() { return lastFork; }, get lastBuild() { return lastBuild; }, get lastPlacement() { return lastPlacement; },
    /** Tests only: a new journey on a route / tier / branches at a year (the ledger's journey number), at mile 0 on its first leg. */
    newJourney({ route = 'emigrant', tier = 'rookie', branches = {}, year = null, journeyN: jn = null, companions = null, family = 'own' } = {}) {
      const prev = save.journey && !save.journey.done ? null : save.journey;
      const L = save.ledger;
      if (year != null) L.year = year;
      let n = null;
      try { n = JA.startSeason(prev, { route, tier, family, animal: 'oxen', companions: companions || ['blacksmith', 'scout', 'cook'], wagonName: 'Test Wagon', ledger: L, farm: save.farm, seed: hashString(`${currentPlayerId}:t:${Date.now()}`) }); } catch (e) { console.warn(e); }
      if (!n) return false;
      if (jn != null) n.journeyN = jn;
      for (const [f, o] of Object.entries(branches)) JA.chooseBranch(n, f, o);
      stopTravel();
      save.journey = n; save.trip = null;
      ensureJ(); app.persist(); applySceneParty();
      return true;
    },
    offerPlacement: (where) => offerPlacement(where || 'marker'), settle: () => { try { markerPanel.cancel(); problemPanel.cancel(); spellPanel.cancel(); card.close(); forkPanel.hide(); toaster.clear(true); if (findPop) findPop.clear(); } catch (_) { /* ignore */ } },
    checkSetsNow: () => checkSetsNow(), closeFinished: (Jn) => closeFinished(Jn || save.journey),
    get derby() { return derby ? { markers: derby.markers, bursts: derby.bursts.slice(), busy: derby.busy } : null; },
    get lastDerby() { return lastDerby; }, get lastQuickDraw() { return lastQuickDraw; }, get music() { return { ...musicState }; },
    dropCard: (id) => dropCard(id), checkDaily: () => checkDaily(), dogBerries: () => app.playNose('berries'),
    // ---- v1.4 test hooks (SPEC §5.11) ----
    playNose: (kind, findId) => app.playNose(kind, findId), playFact: (id) => app.playFact(id), playMoment: (kind) => app.playMoment(kind),
    fishNow: (opts) => app.fishNow(opts), jumpLeg: (id, opts) => app.jumpLeg(id, opts), findPop,
    get fun() { const Jn = save.journey || {}; return { dog: Jn.dog || null, finds: Jn.finds || {}, fishLog: Jn.fishLog || {}, quests: Jn.quests || {}, skips: Jn.skips || {}, wishes: Jn.wishes || [], factsHeard: Jn.factsHeard || [] }; },
    sceneEvent: (e) => onSceneEvent(e),              // (tests: a scene event, as the scene would send it)
    get lastFishing() { return lastFishing; }, get chase() { return chase ? { ...chase } : null; },
    // a test hook: fire a trail event by id (or kind) on an idle trail, as the day loop would
    playEvent(id) { const ev = EVENT_BY_ID[id] || EVENTS.find((e) => e.kind === id); if (!ev || !T || (T.busy && !T.held)) return false; const keep = !!T.held; T.busy = true; runEvent(ev).catch((e) => console.error(e)).finally(() => { if (T) { T.busy = keep; T.last = 0; } }); return true; },
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
