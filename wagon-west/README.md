# Wagon West

Learning Lab's fourth game (`learninglab.fun/wagon-west/`): a covered wagon travels the 2,000 miles from Independence,
Missouri to Oregon (or, from Fort Hall, California; or, from the Willamette farm, south on the Gold Road), one landmark a
session, and the learning is both 4th-grade math and the week's spelling words, in the places a real journey needed them. `SPEC.md` is the design (§0–§7) and the build contract
(§8–§13); this file is how the app is put together and how to run it.

## Run it

Serve the **repo root** (the games import each other's shared modules by URL: `/spell-jump/` is a symlink to
`car-jump/` in dev):

```sh
python3 -m http.server 8095            # from the repo root
open http://localhost:8095/wagon-west/           # the real scene (falls back to the mock if it is missing)
open http://localhost:8095/wagon-west/?mock=1    # the mock scene (what the UI tests use)
```

`?nosw=1` skips the service worker; `?pings=1` sends the usage pings from localhost.

## How a session goes

Players (the family's, shared with the other games) → the title (the map, "Hit the trail") → the first time, **Outfit**
(name the wagon on the on-screen keyboard, oxen or mules, three companions) and the **General Store** in Independence
→ **the trail**: the scene with the HUD ("Day 23 · Fort Laramie in 41 mi", food, mood faces, the pace and rations
dials, pause). A day is about 6 s. On the way:

- **Mile markers** (4–6 a leg): one fact from the child's Trail Blazer ladder (`nextFact` / `recordAnswer` on
  `trailBlazer.<id>.facts`) on the marker panel (`src/ui/markerPanel.js`, the shared numpad). Right → "Nice!", within
  3 s → "Quick!" (a few free miles); a miss → the fact with its answer, read aloud, then typed once from a cover.
- **Problems** on the problem panel (`src/ui/problemPanel.js`): the store's buys, the rations question (the first dial
  change in a leg), the distance question, repairs, trades. A miss shows the work line by line (read aloud), then the
  answer is typed once. The goods always come at the fair price; a right first answer earns a trade token.
- **Events**: a card, then a problem, a quick fact, the bow hunt or fishing (the scene runs them), or just the news.
- **The stop**: the lookout fact and the sticker; a **river** (three words on Spell Jump's spell panel, recorded with
  `recordSpell` in `spellJump.<id>.words`, then the rope toss on a number line with Fraction Fright's tolerance for the
  child's tier), a **fort** (the store, then the **Post Office**: a letter home whose P.S. words are dictated on the
  spell panel, read back and kept in the journal), a landmark, or home (the child names the homestead).
- **Results**: three stars, cash rows, tokens, the sticker, a crate (paints, flags, bugle calls, hats).

Stopping is always fine: every day is saved and "Make camp" leaves the journey where it is.

## Files (the App stream's)

| File | What |
|---|---|
| `index.html` | markup and all CSS (house structure, warm palette, both orientations, safe areas) |
| `src/main.js` | boot, sync, voice, the scene (real or mock), the screens, the leg lifecycle |
| `src/meta/save.js` · `sync.js` | the save (`wagonWest.<id>.save`, settings `wagonWest.settings`) and the `ww` sync kind with its merge |
| `src/meta/mockScene.js` | the scene API (§11) as a placeholder drawing with scripted hunting / fishing (`?mock=1`) |
| `src/meta/sfx.js` · `selfUpdate.js` | sound effects; reload on a safe screen after an update |
| `src/ui/*` | players, title + map, outfit + looks, store, HUD, trail card, marker / problem panels, river, post office, journal, results, Parent Zone, the spell panel's re-wording; v1.1 camp (`camp.js`) and trail cards (`cards.js`); v1.2 the Wagon panel (`wagonPanel.js`); v1.4 the find pop and the Finds page (`finds.js`) and the Fish log page (`fishLog.js`) |
| `sw.js` · `manifest.webmanifest` · `icons/` | the PWA (`tools/make-icons.mjs` draws the wagon icon) |

The journey (`src/journey/*`), the scene (`src/scene/*`) and the content (`src/content/*`) are the other streams'.

## Tests

```sh
BASE_URL=http://localhost:8095 node wagon-west/tools/ui-smoke.mjs     # both layouts on the mock scene (ONLY=landscape|portrait; VOICE_ONLY=1; LAB_ONLY=1 for v1.6)
BASE_URL=http://localhost:8095 node wagon-west/tools/sync-smoke.mjs   # two devices, one in-memory family server
node wagon-west/tools/make-icons.mjs                                  # redraw the icons
```

## 1.1

The natural voice, the trail's own music, and side games (SPEC "v1.1"):

- **The natural voice really plays.** Spell Jump's `tts.js` uses a natural-voice clip only when one exists for the
  exact sentence, so the app asks for them: `prepareVoice()` at player select, at a voice / family-code change and at
  every leg start (the week's words through `cloud.prepareList()`, the child's active facts both ways round with their
  hints, every lookout, nation fact, event, companion line and trail card, the panels' fixed lines and the river's
  landing sentences for the T1 / T2 fractions), and `app.voiceFor(texts)` just in time (at most 2.5 s) before a
  generated problem, the letter, a riddle or a marker's hint is said. Lines longer than a clip (200 characters) are said
  a sentence or two at a time. Parents → Options shows "Natural voice: Ava · N clips ready" (or "Device voice") and
  "Say a test line" reports which engine spoke (`tts.engine`).
- **Music** (`src/meta/music.js`, the Music stream's): `Music.on` from the settings toggles, the tune by leg
  (Oh! Susanna, Buffalo Gals, Old Dan Tucker), the mood by screen (trail, camp, post) and `off` under any panel, the
  pause sheet or the Parent Zone; the voice ducks it. Spell Jump's `Audio.music()` loop is never started here.
- **Camp** (`src/ui/camp.js`): "Camp" on the trail HUD, Make camp in the pause menu, and the evening of every arrival
  ("Make camp tonight?" / "On to the results"). Fishing, Hunting (when on), Quick Draw (facts against a companion on
  the marker panel, first to 7, a token on a win, always a good-game line), Campfire tales (a lookout or nation story,
  then a riddle: a fact in disguise, a token), Rest. Each one is a day (`camp(J, kind)`). "Back to the trail" / "Stop
  for today".
- **Trail cards** (`src/ui/cards.js`, the content in `src/content/cards.js`): 40 cards in four suits, dropped by
  lookouts (the landmark), trading posts (the nation), spotted animals, hunts and catches (the animal or plant), the
  berries (wild plum), a companion's line at camp (their card) and every arrival (`cardForLeg`); a duplicate is a token,
  a full suit a golden crate. The pop flips in near the top with a chime; the Journal's fourth page is the album.
  The cards are the journey's (`J.cards`); the sync merge keeps the union.
- **Fort Derby**: "Race the mail wagon" in a fort's store (once a visit): the scene's race, a fact at each marker
  (quick → a big burst, right → a burst, a miss → a stumble), `derbyPay`, a card on a win, never a losing message.
- **The dog**: offered at Fort Kearny's store, named on the on-screen keyboard (one of three coats), kept as `J.dog`
  (the app stores it on the journey), in the scene's party, barking (the `bark` event), and finding a berry patch
  every other leg.
- **The daily challenge** on the title (`dailyChallenge` / `claimChallenge`): a token and a card, a check mark once done.
- **Wagon upgrades** in Outfit → Look → Wagon (`UPGRADES` / `buyUpgrade`, tokens or cash), and every look can now be
  bought with tokens.

## 1.2

The trail is the game (SPEC "v1.2"). App part one (this stream) puts the supplies, the skills, the weather and the family
on screen; the journey, scene, people / deeds and rivers are the other streams' (`J.foods`, `repair`, `forecast` … come
from `src/journey/sim.js`, the mini-games from the scene).

- **The Wagon panel** (`src/ui/wagonPanel.js`): tap the HUD's food box (or "The wagon" in the pause sheet). Food by kind
  as stacks that shrink (sacks of flour, sides of bacon, bags of beans, a basket of wild food from `J.foods`), "Food for
  6 days · Fort Laramie in 9 days", the goods with counts (spare parts, rope, blankets against what the party needs,
  arrows, pelts, the second yoke), the team ("the oxen are fresh / tired"), the companions with their mood faces and
  their skills, and **"Ask Eli: how many days?"** (a 'distance' then a 'ration' problem for a token, once a leg each;
  also on the HUD while Eli has one left). The rations and distance questions are no longer forced.
- **The HUD**: a forecast chip beside the food box (sun / cloud / rain / storm / snow and "rain soon", from
  `forecast(J)`); tired animals show Steady on the pace dial and grey Brisk. Every effect is a line the child sees:
  `app.effectToast(text, say)` (a cold night, tired animals, a soaked sack, a limp, a part used),
  `app.skillLine(skill)` (the companion's portrait and line, read aloud; also from `tickDay` / `repair` / `camp` /
  `applyMarker` results), the breakdown card ("Fix it" / "Work it out for a token", or "the wagon limps to the next
  fort" without a part; `repair(J, { workedOut })` decides), the hunt card that says "fishing only" without arrows, and
  Nora's tip (a card before the marker's answer, `teacherTip(J)`).
- **The store without a gate**: a tap buys one at the listed price (the cash box in view; a good the box cannot cover is
  greyed: "Earn $N more"); each row says what the good does and has **"Work it out"** (the 'buy' / 'divide' problem
  for a trade token on a first-try right; the goods then come at the fair price). "You'll need about N lb to reach
  <stop>" is always shown. The second yoke is a one-time row.
- **Outfit and the title**: each companion's card says what they are good at; the Party step and the title (under the
  wagon's name) sum it up: "Ada fixes wheels · Eli scouts · Rosa stretches the food".
- **The family map**: the other players of the family with a journey are small wagons in their colour at their stops on
  the title's map (read with `loadSave(id)`); a tap tells whose; no names or scores otherwise.
- **For the second app stream**: `app.effectToast(text, say)`, `app.skillLine(skill)`, `app.waitOut()` (camp's "Wait out
  the storm"), `app.wagonInfo()`, `app.forecast()`, `app.openWagon()`, and the mock scene's `startFord` / `startFloat` /
  `startRaft` + `raftGo()` / `startStampede` with scripted events (`__mockScript.ford = 'soaked'`, `.bumps`,
  `.stampede = [bool, bool, bool]`).
- `ensureJourney(J)` runs after every save load; VERSION 1.2.0 (1.3.0 now, see below); the service worker was `wagon-west-v1.2.0`.
- Tests: `tools/ui-smoke.mjs` covers all of it on the mock scene (`QUICK=1` runs just the v1.2 sections; those that need
  the journey's v1.2 API print SKIP until it is in the tree).

## 1.3

Money is a choice (SPEC "v1.3"): start cash $45, pay follows the markers, the raft pays $24 / $6 / $6, the second yoke is
$42 and sold from Fort Kearny on. Prices and pay live in `src/journey/economy.js`; the app reads them (the raft line is
`raftPay(J)`'s cash, never a typed figure). The store's "Work it out" problems get `cash` and the shelf price from the
app, so they never ask for more sacks than the purse covers (a smaller multiple of the same fact stands in). A Talk row at
Independence, a true-to-period ferry picture and fact-checked lookouts come with it.

- VERSION 1.3.0; the service worker is `wagon-west-v1.3.0`.

## 1.3.1

Trade offers the wagon can make (a nation's post or a person's trade asks `tradeOffer(J, { nation, trades })`, and the
card text, the spoken line and the multiplication all come from that offer; "Nothing to trade this time" only when the
wagon holds nothing tradable), toasts that wait for what the child is reading (`src/ui/toasts.js`), no stray "null", the
ford's prompt in a slim top strip, a river crossing's soaked-sack and used-coil lines inside the river panel, and a
store "Work it out" divide that never asks about more money than the purse holds.

- VERSION 1.3.1; the service worker is `wagon-west-v1.3.1`.

## 1.3.2

The voice, fixed (owner, Oct 31, from a real device: "glitchy voices reading the letters; the old robot voices are back").
Causes: (1) the cloud engine's `prepare` runs one request per voice at a time and `prepareVoice` queued 80-text
requests for the whole game, so a line prepared just in time (a lookout, a person, the trade, the letter's lines) waited
behind them, missed the 2.5 s wait and was read by the device voice, and the letter then switched voices mid-way as the
clips arrived; a few lines were never prepared at all (the first-run "How the trail works" card, people's lines); (2) a
toast's or a deed's line was said the moment it was queued, cutting the line being read (the river's result, the
dictation, the letter's read-back) and, held by the 1.3.1 toast queue, again when it was released.
`src/meta/speech.js` is now the one voice: lines play straight from their clip (never the device voice while the natural
voice is in use: a line without its clip in 9 s is skipped, its words are on screen), one at a time, toasts' and pops'
lines wait for the voice, the panels, the dictation and cards; the whole game is prepared ahead in batches of 8, this leg
first (`src/meta/voiceTexts.js`), stepping aside for any line waiting for its clip. `tools/content-audit.mjs` checks every
spoken string against that list; ui-smoke plays the letter with instrumented engines.

- VERSION 1.3.2; the service worker is `wagon-west-v1.3.2`.

## 1.3.3

Owner report: "the math game says 9x12 is 96". The shown text, spoken text, worked lines and graded answer of every problem
agree with the true arithmetic for every ladder fact, kind, season and purse (`tools/journey-tests.mjs` sweep, ~9000 problems),
so no wrong product was ever printed. The real fault found here: a problem the purse cap, a season's scaling or a trade's
limit had changed (a "9 × 12" drawn from the ladder but asked as 9 × 3) was still recorded on the ladder as the drawn fact.
`problemFor` now returns `asked`, the fact its sentence really asks (null for ×1 / ×0 or the no-fact ration), and the app
records `asked`, passes the typed wrong answer only when the question's answer is the fact's answer (a two-step ration or
repair is not), and counts a scout only for the fact that was scouted.

- (VERSION 1.3.3 and `wagon-west-v1.3.3`, superseded by 1.4.0 below.)

## 1.4

Frodo and the river (SPEC "v1.4", owner, Nov 1: "Frodo only interacts with wild plums it seems. Need more fun things that
happen on the route. Fishing could also be more fun. Think of more side quests." and facts along the trail). Pure fun:
nothing asks a question, gates anything or can be failed; the mile markers and the letter's words are untouched. The
journey decides everything (`src/journey/{dog,fishing,quests,moments,collections}.js`, through `sim.js`), the scene draws
it (the mock scene's new hooks in tests), the content is `src/content/{finds,fish,moments,quests,trailFacts}.js`; the app
(`src/main.js`, the "v1.4" block, `src/ui/finds.js`, `src/ui/fishLog.js`) drives and speaks.

- **Frodo's nose** (afterDay's `res.nose`): a find (the dog dashes off and trots back; a pop with the find's line read, a
  "New!" ribbon on a first one, into the journal's Finds page; the arrowhead is sketched and left where it lay), a snake
  warning (a card, the rattlesnake card), a rabbit chase (the dog's name is a 64 px button: called in time he skids round,
  late or never he is muddy until the next stop or camp, that is all), the berry patch (now a nose slot of the journey's),
  and a quest item. **Fetch** at camp (three throws, treats by distance, now and then a find), **Catch grasshoppers**
  (bait), **Skip stones** (at the river stops after the crossing, and once a leg at a river camp), **Falling stars** (the
  evening of an arrival on a clear night: a wish for every star tapped). None of the camp games costs a day or food.
- **Fishing 2.0** (the trail's fishing events and camp's Fishing): pick bait (worms, grasshoppers from the tin, the shiny
  spoon from a fort store), cast and dip as before, then the fight: hold to reel, let go on the red, the sturgeon takes
  two. Junk (a boot, a snapping turtle, a bottle with a note). The fish log, personal bests and the Family records board
  are journal pages (Fish log). One spoken summary card ends a session.
- **Trail facts** (`res.fact`): a short vignette with a sound, then a card with one true fact and its card for the album
  (the new suits "Fish of the trail" and "Trail tales": 54 cards in six suits). The four far-off ones (rifles beyond the
  ridge, wolves, a grizzly on a far ridge, a prairie fire) can be turned off: **Parents → Options → Far-off sounds on the
  trail**. The dust devil (tap the hats) and the stampede's "Bison thunder" card.
- **The missing locket**: the dog joins on the far bank of the Kansas River (not at Fort Kearny), brings back a silver locket;
  people in the Talk row (❓ clues, a 💛 owner) lead to Molly Rowe at Fort Laramie. A child who walks past gets the card from
  the post office. The bottle note (fished up) leads to Sam at The Dalles. A new quest is one entry in `QUESTS`.
- **Voice**: every new spoken string is in `voiceTexts.js` (`momentTexts`, `dogTexts`, `questTexts`, `factTexts`,
  `funTexts`); the fishing summary, a catch with its inches, the treat counts, the skip count and the horseshoe sale are
  prepared just in time. `tools/content-audit.mjs` also checks the weapon words (`WEAPONS`; only the two exact phrases of
  the far-off rifles fact, `WEAPON_ALLOW`, may use one).
- **Save and sync**: no new top-level field (everything is on `J`, filled by `ensureJourney`); `mergeWw` ends with the
  journey's `merge14`. `settings.farSounds` is this device's.
- Test hooks on `window.__wagonWest`: `playNose(kind, findId?)`, `playFact(id)`, `playMoment('dustDevil')`,
  `fishNow({ bait })`, `jumpLeg(legId)`, `fun`, `sceneEvent(evt)`. `FUN_ONLY=1 node wagon-west/tools/ui-smoke.mjs` runs
  just the v1.4 sections (they print SKIP until the journey's and the mock scene's 1.4 hooks are in the tree).
- Integration (all four streams on one tree): the scene's fight stepper is the journey's (`src/journey/fishing.js`), the mock scene's 'late'
  chase ends `chaseEnd { called: false }`, `arrive()`'s `result.quest` is shown as the item card before the results, the hunt event's
  `lead` flag is shown ("Good lead!") and counted in the hunt's line, pronghorn (12 lb) and bison (24 lb) are hunt animals (the mean hunt
  stays within 10 % of 1.3's; `tools/economy-sim.mjs` models them). `tools/v14-stubs.mjs` is gone: the tests run on the real content.
  ui-smoke empties the leg's v1.4 plan while it drives the 1.0-1.3 sections (`QUIET_14`) so a dog's find does not crowd their toasts.
- VERSION 1.4.0; the service worker is `wagon-west-v1.4.0`.

## 1.5

The Long Trail (SPEC "v1.5", owner, Nov 1: "Need to scale this much better" and "Maybe they can choose where to go also"). The
trail is 20 legs of 60-160 miles on the same 2,000 (a leg is still one session), with three forks, a second route, years, tiers,
a homestead that grows, and collections with long tails. The journey stream decides (`src/journey/{route,seasons,homestead,gold,
adaptive,sim,...}.js`), the content stream writes the legs, routes, people, cards and sets (`src/content/*`), the scene draws
(`?mock=1` uses `src/meta/mockScene.js`'s scripted pan / rocker / snub / sail / homestead); this stream drives and speaks.

- **The title** draws every route on `src/ui/map.js` (the emigrant trunk, the forks as their own lines, the Gold Road, the voyage as a
  dotted line up the coast). The lines travelled (the ledger's journeys and the journey in progress) are inked in the wagon's paint on
  a dark outline, the rest faint and dashed but always visible; a way not open yet has a lock and its year ("1858"); a fork waiting is
  circled and the title says "A choice at Fort Hall". The farms are small cabins that grow (tent, cabin, farm with a barn, full farm);
  a tap opens the farm. The line under the logo is "1849 · Veteran · The emigrant trail". Buttons: **Hit the trail** / **Keep going** /
  **A new year**, Journal, Outfit, Parents, and **The farm** once there is one.
- **A new year** (`src/ui/yearPicker.js`, screen `#year`): the first journey ever goes straight to the Outfit (emigrant trail, Rookie).
  Later years pick **where** (The emigrant trail; The Gold Road, locked with "Reach the Willamette Valley to hear the news" until a
  journey ended in the Willamette) and **how hard** (Rookie, Veteran, Pioneer: blurbs, what changes, how a locked tier opens; Parents →
  Options → "Let the child choose how hard" off = Rookie only and the step is skipped), then the Outfit is **who** (a Family step from the
  second emigrant journey: "Uncle Theo's wagon, 1849", flavour only; Mateo and Hattie among the companions). `startSeason` makes the
  journey (the ledger's year and journey number; cards, deeds, tokens, upgrades, challenges, the dog and v1.4's collections carried).
- **Forks** (`src/ui/forkPanel.js`): on arriving at Fort Hall (Oregon or California), South Pass (by Fort Bridger, the Sublette Cutoff,
  the Lander Road: from the second journey) and The Dalles (the Columbia raft or the Barlow Road), before the stop's other scenes: the
  explainer's portrait, the question, one card per way (its name, ONE true line, "9 more stops · no store"), buttons of the same size and a
  Hear it each; everything read in order. The first trip leans toward Oregon (first, focused, "Your family planned on Oregon. You can still
  change your mind."); from 1849 Agnes adds the gold-fields line; a closed way shows why. "Decide later" keeps it pending.
- **The Barlow Road**: a toll card at the leg's start (`payToll`: $5 × the price level, or an IOU when the purse is short, never a
  stranded wagon) and Laurel Hill (a `snub` event: `startSnub`, `applySnub`). **Dry stretches** (the Sublette Cutoff, the Forty-Mile
  Desert): a line says whether the water barrel is aboard. The Humboldt has no ferry (ford or float only).
- **The Gold Road**: starts at the farm with the news (the lookout card) and the garden's food, an Oregon City store at 1.3 prices;
  **the diggings** (`src/ui/diggings.js`: Clear Creek, the Feather River, Coloma, the Sacramento claim from 1848) with the gold pouch
  ("3 nuggets · 7 flakes", ten flakes a nugget), the **pan** (`startPan`, the journey's `panOutcome`, `panReveal`, "Five flakes!") and, at
  Coloma, the **rocker**; leaving the creek and coming back loses nothing; **Parents → Options → Gold panning** off gives the gold as a
  find with a card. **The voyage home** is a sail with four "Up the coast" markers and the Columbia bar. The Nisenan guide at Coloma hands
  out the "Gold fever" card (the owner's call; the comic gold-fever event hands out nothing).
- **The homestead**: arriving at a trail's end closes the journey (`closeJourney`: savings, Beaver money, the team banked into the farm,
  the ledger written, the year turned), the results show the bank card ("+$74 in savings · 6 nuggets of Beaver money · 2 oxen to the
  pasture"), the child names a new farm on the 1.0 keyboard, and the farm screen opens (`src/ui/homestead.js`): the three purses, the
  pieces grouped by the purse that prices them, **Build** (greyed with its reason), **Work it out** on a savings piece (a token, once a
  piece), a tapped piece's line and fact, a site switcher with two farms, the scene's `buildPiece`. Nothing decays, nothing is lost.
- **The journal** has nine pages: Letters; Stickers (tabs by route); Map (every road, the roads travelled, the farms, people met);
  Cards (and a **Sets** tab: 16 sets and their wagon decorations, worn two at a time in Outfit → Look); **Deeds (53)** in groups;
  **Farm**; Finds; Fish log.
- **Letters** tell the legs since the last post and open "Dear everyone at {farm}," only once the farm is named (`app.farmName()`).
- **Adaptive math**: the Pit Crew Check (Trail Blazer's staircase through the journey's `placementSetup`, on the marker panel in
  `check` mode) is offered on the first store or mile marker while the child's ladder is untouched ("Later" asks again, at most three
  times); `problemFor` takes `tier: problemTierFor(facts)` (two-step rations and distances and a change-back buy at the top tier).
- **Parents**: Journey shows the route, tier, year, forks chosen, the journeys finished (year · route · tier · stars), the farms, whether
  the Pit Crew Check was offered, **Reset this journey only** (the farm, the ledger, the cards and the sets stay) and the full reset (the
  farm too); Options has the two new switches; Report adds the legs by route, and Copy report the route and the tier.
- **Save and sync** (`v: 1`, new fields normalized): `ledger`, `farm`, `setsDone`, `cosmetics.*.decor`, `seen.forks / placeOffers /
  worked`, `journeyResetAt`, `trip.dig / look`; `mergeWw` runs the journey stream's `mergeWw15` (every rule a union or a max, so an older
  build's doc never erases them) and drops a journey last written before another device's journey reset.
- **Playtest 1.4 fixes**: a camp effect line goes with camp (`toaster.clearScope`), a card / deed / find pop waits where it would sit on a
  control or a line the child reads (`popHeld` + `readingBoxes`), the camp's bar sits under the title bar so it no longer covers the dog,
  and a stone that skips twelve ends the game there (one top throw instead of three).
- Test hooks: `newJourney({ route, tier, branches, year, journeyN })`, `closeFinished()`, `checkSetsNow()`, `forkPanel`, `diggings`,
  `lastFork`, `lastBuild`, `lastPlacement`; the mock scene: `?mockPan=0.8`, `?mockSnub=0|1`, `__mockScript.{pan,rocker,snub,bumps}`,
  `window.__mock.lastHomestead / builds`.
- VERSION 1.5.0; the service worker is `wagon-west-v1.5.0`.

## 1.6 · Lab integration (v1)

The game's part of **The Lab** (`learninglab.fun/lab/`, the layer across the five games; `lab/SPEC.md` §4.4 is the contract, `SPEC.md` "v1.6" here the
build notes). The Lab only listens and decorates: **no Lab call reads or writes the dollars, trade tokens or gold, and `journey/economy.js` is unchanged**
(a journey test holds a snapshot of its exports).

- **The bridge** (`src/meta/labBridge.js`, the one file that knows the Lab): loads `/lab/src/index.js` lazily, queues calls (at most 100) until it
  has, and is a no-op returning an empty receipt when `/lab/` is missing, blocked or old. `attach` at the player pick, `detach` at the picker. A test
  boots the game with every `/lab/` request blocked.
- **Reports** (`labReport` in `main.js`, never in a frame): `marker` (after `applyMarker`, `firstTry` = the answer was right), `problem` (the two
  `applyProblem` sites), `word` (each river or letter word), `leg` and one `star` per star (the arrival), `choice` (a fork or a choice moment), `farm`
  (a piece built), `day` (beside the streak), and `beginRound` at every leg start. A combo moment is **Trail Cheer**: after the panel closes the
  party cheers about 1.2 s (`scene.cheer()`) and a toast names it.
- **Looks** (`src/meta/labLooks.js` lists 14 ids; the drawing is `src/scene/looks16.js` in `drawWagon` / `drawPerson`): seven wagon **covers**
  (stripes, patchwork, sunflower, riverblue, starquilt, nightsky, goldthread) and seven **outfits** for the party leader, the first companion
  (bonnet, strawhat, vest, redscarf, spectacles, plumehat, cloak). `cosmetics()` is read when a leg starts (`applySceneParty`); `null` is the game's own
  canvas and clothes. No cover or outfit imitates any nation's dress or designs.
- **On screen**: the Lab's XP pill (`#hud-lab`, under the trail HUD's top row, at the right), its strip under the results' pay lines (`#res-lab`),
  a "The Lab" button on the title (shown once the Lab has loaded) and a "The Lab" row in Parents → Options (`openParent({ unlocked: true })`).
- **The cliffhanger** (`journey/preview.js` `nextStopPreview(J)`, `ui/results.js`): every leg's results end on a card with the next stop's painting
  (`scene/backdrops.js` `drawStopCard`), one true line (the first sentence of its lookout) and "Next time: the ferry at the Kansas River" (a river
  with a ferry; "the crossing at …" for the others; a fort or landmark by name). Nothing is locked. After the third leg finished on a local day the
  card adds "That's a good place to stop for today." No card at a trail's end.
- **Six choice moments**, two on each route, asked at the stop like a fork (`content/choices.js`, `journey/choices.js`, `ui/choicePanel.js`; a person says
  one true line per way, two equal buttons, read aloud, "Decide later" keeps it pending, moving on takes the plain way): a **shortcut** (the creek bottom
  at Ash Hollow, the Humboldt's bends, the Rogue River's gravel bar: the leg after is 15 miles shorter, 1 time in 4 a sack of flour is soaked, up to
  50 lb) or a **guide** (Ice Slough, the Big Meadows, Siskiyou Pass: $2 × the price level, a day saved, the party's spirit up, and the Forty-Mile
  Desert crossed without thirst). A leg a choice shortens pays and keeps its markers as the full leg; the day the shorter leg does not save by
  itself is saved on the arrival (the arrival day's food stays in the wagon). `J.choices` is merged as a union by id. `choice` pays Lab XP only.
- **Economy**: `node wagon-west/tools/economy-sim.mjs --check --homestead` passes with the 1.5 targets unchanged; its new **choice moments** table
  runs 360 Rookie kids a cell with always the plain way, only the shortcuts, only the guides and always the second way: the mean end cash is within $2
  of always-the-plain-way on every route (limit $3), the sessions stay a leg a session.
- Tests: `journey-tests.mjs` (the choices, the preview, the economy snapshot), `economy-sim.mjs`, `content-audit.mjs` (every new spoken line is in
  `voiceTexts.js`), `ui-smoke.mjs` (`LAB_ONLY=1`: the bridge, the HUD pill, a marker reaching the Lab, Trail Cheer, the looks, the preview and the stop
  line, each of the six choices, the game with `/lab/` blocked), `scene-smoke.mjs` (`V16_ONLY=1`: the covers, outfits, cheer and previews) and
  `sync-smoke.mjs` (the choices across two devices).
- VERSION 1.6.0; the service worker is `wagon-west-v1.6.0` (the bridge, the choice panel and its words are in the shell; the Lab's own modules are cached
  as the page loads them).

## 1.7 · the water: a bending rod, rocks to flip, more fish, a bear

- **The rod bends** (`src/scene/fishing2.js`): a curve with a spring: gentle at rest, deep while reeling (more for a bigger fish), a tremble on the yellow, a quiver on the red, a spring back when the fish lands or
  wiggles off; the line runs from the bent tip.
- **Flip rocks** (`src/journey/rocks.js`, `src/scene/rocks17.js`, `src/scene/sprites17.js`): five rocks by the water at camp and at the river stops; worms, beetles, crickets and crawdads fill four new bait tins
  (`BAITS` in `src/content/fish.js`; no bait is best everywhere), or it is just mud, and now and then a stone arrowhead (the existing find: sketched in the journal and left where it lay).
- **Five more fish**: mountain whitefish, northern pikeminnow, largescale sucker, green sunfish and Sacramento perch, each only where it is native (`docs/SOURCES.md`; no burbot on the trail), with sprites, cards
  and fish-log tiles. The free fishing session still brings home about 1.3's food (the sim: −3.7 %).
- **A bear at the fishing hole** about one session in eight (never twice in a row): far bank only, the fish scatter, the dog barks, wait for it to leave or try another spot, then a true fact about bears and salmon.
- Tests: `journey-tests.mjs`, `economy-sim.mjs --check --homestead`, `content-audit.mjs`, `scene-smoke.mjs` (`V17_ONLY=1`), `ui-smoke.mjs` (`FUN_ONLY=1 FUN_SECTIONS=rocks`).
- VERSION 1.7.0; the service worker is `wagon-west-v1.7.0` (the three new files are cached as the page loads them).

## 1.7.1 · polish: food matters again, and four layout fixes from the 1.5 playtest

- **The wagon carries 600 lb of food** (`LOAD` in `src/journey/economy.js`, `foodRoom` / `addFoodKind` in `src/journey/supplies.js`): no store, hunt, catch, trade, gift or find puts more in. The store greys
  the food it has no room for ("The wagon is full") and says the room left, a hunt or a catch that does not fit says "The wagon can't carry more; leave the rest for the next party", a trade asks only
  the trades whose food fits. Fort Hall to Sacramento needs a little more than 600 lb at full rations: the store's hint says so (plenty rations or a hunt on the way).
- **Damp flour** (`DAMP`, `dampAtStop`): as a stop opens (before its store), a wagon over 400 lb sets aside a quarter of what it holds beyond the road ahead's needs ("The flour got damp under the heavy
  load, so 30 lb was set aside"); never the food the road ahead needs, never at a trail's end. The sim's food targets (`TARGETS.food`): the limit holds, the strong player arrives with 200-600 lb, the weak
  player is fed as 1.3 allows; a "forager" kid (the playtest bot's play) is in the table.
- The results' **bank card** leads the left card (on a landscape phone the stats go in one row: seen without a scroll); Laurel Hill's **HOLD AGAIN** keeps clear of the LEDGE counter and the hint line; a
  **stop's line** (a person's "Traded …") goes when the stop's screen changes; the Lab pill's HUD row lets taps beside the pill through.
- VERSION 1.7.1; the service worker is `wagon-west-v1.7.1`.

## 1.8.0 · the Lab cohesion round (stage 2)

- **One Lab chip, top-left of the title** (`labBridge.mountChip`, `compact` under 520 px; themed to the wagon's browns): the avatar, "Lab LV n", Lab coins, the Lab streak flame and the Games button
  (the six-game nav). It replaces the title's small "The Lab" button; the title's own streak flame is gone (the chip's flame is the only one in a header; the game's own streak stays on its panels).
- **The picker's Lab button** ("Who's going west?", `labBridge.mountPickerButton`, last in the players' block).
- **Summaries** (`labBridge.summary`, `labSummary()` in `main.js`): the last stop reached ("Fort Laramie"), "N of 20 stops", and "Today's challenge is open / done"; on every title show and after each leg.
- **Money**: the story money keeps its "$" and is labelled "Wagon purse" on every cash pill (aria-label too); Lab coins are only ever in the Lab's own pieces (chip, pill, results strip) with its coin icon.
- Tests: the old `#btn-lab` / `#title-streak-n` checks are now the chip, the Games panel, the picker button, the summary, the purse label and "one flame".
- VERSION 1.8.0; the service worker is `wagon-west-v1.8.0`.

## 1.9.0 · a grown-up can turn the music off for every game

- **Parents → Options → All games → Background music in all games** (On / Off, behind the PIN): the family-wide switch kept in Spell Jump's family record
  (`musicOff` + `musicOffAt`, synced, the later change wins). Off: the trail's banjo tunes (`Music.lock(true)`, driven by Spell Jump's `Audio.onMusicLock`)
  never start and stop at once, also when a sync brings the change in; effects and the voice stay on. The pause menu's Music button reads Off, disabled,
  "Music is off (set by a grown-up)"; turning it back on restores the child's own Music setting. Test: `tools/ui-smoke.mjs` (`ONLY=musicoff`).
- VERSION 1.9.0; the service worker is `wagon-west-v1.9.0`.

## Data and sync

One family code syncs all four games. Wagon West adds the per-player kind `ww` (the save) and registers Trail
Blazer's kinds (`tb`, `facts`) so the facts the mile markers record sync from here too; Spell Jump's `words` kind is
built in. Merge: a reset wins; the journey is the later doc's (cash and tokens the max; the trail cards the union; v1.4: the
dog's finds, the fish log, the skipping stones, the wishes and the quests by the journey's `merge14`);
stickers,
letters, looks and the leg log are unions (v1.5: the ledger, the farm and the card sets by `mergeWw15`); the per-day log and the per-kind tallies take the max; crates keep the longer
queue; the streak follows Spell Jump's rule. The family server must list `ww` among its kinds
(`car-jump/src/sync/protocol.mjs`).
