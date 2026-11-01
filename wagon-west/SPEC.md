# Wagon West — build spec (v1)

> Matt, Oct 30: "For the next game, I'm thinking something like Oregon Trail. Maybe it incorporates math and spelling?"
> Decisions (Matt, Oct 30): the name is **Wagon West**; companions are stock characters (siblings play separately);
> **fishing and hunting** (a bow, cartoon-clean: no blood, the animal flops and "Got one!"); **trading with Native
> nations, trading posts kept**; **both** spelling scenes (river words and letters); **build now**. §0–§7 are the
> design as reviewed; §8 onward is the build contract the agents implement.

Learning Lab's fourth game, at **learninglab.fun/wagon-west/** (folder `wagon-west/`, deployed by `build.sh` next to
the other three). A **journey game**: a kid-size wagon party travels the 2,000 miles from Independence, Missouri to
the Willamette Valley, one landmark at a time, and the learning layer is **both** 4th-grade math and the week's
spelling words, in the places where a real journey needed them: buying supplies, rationing, judging distances,
crossing rivers, writing letters home. Same house style, kid-proofing and family as the other games.

Audience: 4th graders (9–10) on an iPhone in landscape (also portrait, iPad, laptop), 12-minute sessions.

## 0. Why this game (what the other three cannot do)

- **One world, two subjects.** Spell Jump is spelling, Trail Blazer and Fraction Fright are math. A journey mixes
  them without feeling like a worksheet, because a trail genuinely needs both: arithmetic to outfit and ration a
  party, writing to send word home.
- **Application, not only fluency.** The math games drill facts (the research's strongest lever for fluency). What
  they do not do is make a child *use* a fact in a situation: "flour is $3 a sack and we need 7 sacks". Word problems
  in context are the transfer step the fact ladder is building toward (CCSS 4.OA.3: multi-step word problems with
  the four operations; 4.MD.2: money, distance, time).
- **A long runway that is a story.** Twelve landmarks, a party the child named, a letter from each fort: the pull is
  "what's at the next landmark", which is the healthiest kind of comeback cue (row 21 of the learning design: a
  habit cue, never a punishment).

## 1. Kid rules (non-negotiable, as everywhere)

- Nobody dies, nobody is sick in a scary way. The party gets **tired** (rests a day), the wagon gets **stuck** (a
  math problem frees it), food runs **low** (the next fort, a fishing stop or a hunt fixes it). No dysentery, no
  snakebite, no graves, no guns. **Hunting is a bow** (Matt's call): a cartoon scene, the animal flops over with a
  puff and "Got one!", no blood; **fishing** is a timing tap at a river or a lake. (v1.4, at Matt's request: one trail
  fact may say "the far-off crack of rifles beyond the ridge", a sound at a distance with the party safe; two exact
  phrases, nothing drawn, nobody in the party armed. See v1.4 §1.7; "gun" and every other banned word stay banned.)
- Native nations are **trading partners and guides**, named correctly for where the trail passes (Kansa, Pawnee,
  Lakota, Shoshone, Bannock, Nez Perce, Cayuse, Chinook) and never obstacles. A trading post scene is a math scene
  (trade is multiplication and fair exchange) and a short true fact about that nation is read aloud at it. This is
  the one place I'd want a parent's eye on the wording before it ships.
- No external links, no native inputs outside the Parent Zone (the on-screen keyboard and numpad the other games
  use), no lives / energy / timers / pressure text; stopping is always fine (the journey waits at the last landmark).
- No multiple choice. Every answer is typed (numbers on the numpad, words on the keyboard); a wrong answer clears
  and the right one is shown with the work (cover-copy-compare, as in Spell Jump and the gate panel).
- Offline after the first load (service worker), self-update on safe screens, works with a laptop keyboard.

## 2. Shared with the other games (import at runtime, never copy)

From `/spell-jump/src/`: `spelling/profiles.js` (the family, players, PIN), `sync/client.js` + `registerSyncKind`
(one family code syncs all four games), `spelling/tts.js` + `cloudVoice.js` (the natural voice), `spelling/wordStore.js`
(**the week's words**: the game reads the child's Spell Jump store and practices the same list; a spell here records
through `recordSpell`, so Spell Jump's report and chart count it), `spelling/spellPanel.js` (the Look → Cover → Write
panel with its fix-it routine; reused as is for river crossings and letters), `spelling/keyboard.js`, `ui/dom.js`,
`ui/icons.js`, `ui/chart.js`, `meta/pings.js`, `meta/selfUpdate.js`, `meta/engagement.js` (the streak).
From `/trail-blazer/src/`: `facts/*` (**the fact ladder**: `nextFact` / `recordAnswer` on the child's Trail Blazer
facts store, so mile-marker facts here move the same frontier the gates move; `hillFacts`-style mixes for stretch),
`ui/gatePanel.js` (the numpad panel; a new mode `'trail'` with the trail's title), `ui/numpad.js`.
From `/fraction-fright/src/`: `skills/items.js` (fraction parsing and the grade-4 denominators) for the river scene.
A new shared piece this game adds, for all four later: `wordProblems.js` (below), a generator of grade-4 word
problems from a fact or a skill, with the work shown step by step.

## 3. The journey

**The map.** 12 legs, each ~150–200 miles, one leg a session (10–14 minutes): Independence → Kansas River crossing →
Fort Kearny → Chimney Rock → Fort Laramie → Independence Rock → South Pass → Fort Bridger (or the Sublette cutoff,
a choice) → Soda Springs → Fort Hall → Snake River crossing → Blue Mountains → The Dalles → Willamette Valley. Forts
have the General Store and the Post Office; rivers have the ferry; landmarks have a lookout (a short real fact, read
aloud, and a sticker for the journal). The whole journey is 2–3 weeks of sessions; a finished journey opens the next
**season** (a new year with a different party, a harder route: the same 12 legs with higher prices and bigger
numbers, like Trail Blazer's cups: 1847 Rookie, 1850 Pioneer, 1853 Trailblazer).

**The party.** The child names their wagon, picks a draft animal (oxen are strong and slow, mules faster and
hungrier, a choice with arithmetic in it) and **three companions** from eight stock characters (a blacksmith, a
schoolteacher, a fiddler, a scout, a cook, a doctor, a carpenter, a storyteller: each with a line or two on the
trail and a hat for the crates). Each has a mood (happy / fine / tired), never a health bar.

**A day on the trail (the scene).** A parallax 2D canvas: the wagon rolling right, the terrain changing with the
leg (prairie, bluffs, high desert, mountains, the Columbia gorge), weather, animals to spot (bison, pronghorn, a
coyote at dusk), the party walking beside the wagon. The child sets the **pace** (steady / brisk) and **rations**
(full / plenty / lean) from two dials, the two decisions the real trail turned on, and both are arithmetic the game
asks about (below). Days tick by on screen ("Day 23 · Fort Laramie in 41 miles"); a day is ~6 real seconds. There is
no fail state: running out of food slows the party to a crawl until the next stop; that is the whole penalty.

**Mile markers (fluency, 4–6 per leg).** Every ~30 miles the wagon reaches a marker and the gate panel asks **one
fact from the child's ladder** (the Trail Blazer store's `nextFact`: frontier, scouts, probes, all of it). Right =
the party cheers and the pace holds; quick = a tailwind (a few free miles); a miss = the fix-it routine and the
wagon rolls on anyway (one slower day). This is the Math Gate, re-skinned, and it keeps the fact ladder moving on
days the child plays this game instead of Trail Blazer.

**The General Store (application, at every fort).** The shopkeeper's problems use real prices: "Flour is $4 a
sack. You buy 6 sacks. How much is that?" (× facts), "You have $36 for oxen at $9 each. How many can you buy?"
(÷ facts, and the remainder: "and how much is left?"), "Four people eat 3 pounds a day. How much food for 5 days?"
(two-step, 4.OA.3). The child types the number; a right answer gets the goods at the **fair price**; a miss shows the
work in three lines ("4 × 6: 4 × 5 = 20, and one more 4 = 24") and the goods cost the same (the math gates the
*bonus*, never the supplies: the party is never stranded by a wrong answer). A **right first try earns a trade
token**; tokens buy journal stickers, wagon paints and a bugle. Problems are generated from facts the child knows
(`wordProblems.js`: a fact → a problem family → a sentence with the numbers filled in; the fact ladder decides the
numbers, the fort decides the goods), so a child on ×3 gets $3 flour and a child on big × gets $23 wagon wheels.

**Rations and distance (application, on the trail).** When the child changes the rations dial: "Lean rations: 2
pounds a day for 4 people. How many pounds a day?"; when a landmark is sighted: "Chimney Rock is 60 miles away. The
wagon makes 15 miles a day. How many days?". Two or three a leg, same panel, same rules.

**River crossings (spelling + fractions).** Four rivers. The **ferryman asks for three words** from the week's list
(the spell panel, dictated by the voice; Look → Cover → Write; a miss gets the fix-it routine and the raft wobbles
but crosses). Then the **rope toss**: the far bank is marked on a number line ("the landing is 3/4 of the way
across"); the child drags the rope's aim to the fraction and throws (Fraction Fright's locate rule and tolerance for
the child's tier; a near miss = a wet boot and a second throw). Rivers are the set pieces of a leg: a short
celebration on the far bank.

**Letters home (spelling, at every fort).** The Post Office: a four-line letter with **three blanks**, each a word
from the week's list, dictated in a sentence that makes sense on the trail ("We saw a *buffalo* herd today" with the
week's words woven in where they fit; a list with no good fits gets "Today I learned to spell *enough*"). The letter
is read back aloud when finished and saved in the **journal** (the kid-facing record: letters, stickers, the map
with the trail drawn so far). Parents can read the letters in the Parent Zone; nothing is ever sent anywhere.

**Events (one or two a leg, never punishing).** A wheel comes off (a parts problem: "a wheel has 12 spokes and 3
are broken, how many good ones?"), a thunderstorm (rest a day, the party plays cards: a quick fact), wild berries
(bonus food), a lost ox found by a companion, a traveler's riddle (a fact in disguise), a bison herd crossing the
trail (watch; a free lookout fact), a trading post (a Native trading scene: "Three beaver pelts trade for 2 sacks of
flour; you have 9 pelts" and the nation's fact), a stuck wagon at a mud hole (a × fact pulls it out). Events are
seeded per leg so a replayed leg is fresh.

**Arriving.** Each landmark: the sticker, the fact, the journal page, cash (the stars of this game: **arrived**,
**everyone happy**, **every marker right**), a crate (reusing Trail Blazer's crate mechanic and cosmetics kinds:
wagon paint, a flag, a bugle call, a companion's hat). The Willamette Valley: a homestead the child names, the
journey's stats, the whole journal to read back, a season sticker.

## 4. The learning design, in one table

| Technique | Where |
|---|---|
| Retrieval practice, spaced, interleaved (rows 1, 2, 9 of Trail Blazer's design) | Mile markers on the shared fact ladder; river words on the shared word store |
| Transfer: facts applied in context (CCSS 4.OA.3, 4.MD.2) | The store, rations, distances, events: generated from facts the child already knows, so the arithmetic is the familiar part and the *reading* of the situation is what is new |
| Worked examples on a miss (Sweller) | The three-line work shown after a wrong store answer; the fix-it routine on words |
| Generative practice for spelling (dictation in a sentence) | Letters home; the words are read back in context |
| Intrinsic integration (Habgood & Ainsworth) | The math buys the supplies and frees the wagon; the spelling crosses the river; nothing is "do math then play" |
| Never gating progress on being right (row 21) | A miss costs a slow day or the fair price, never the leg; tokens and stars are what right answers earn |
| Agency (Hill Climb's lesson) | Pace and rations are the child's dials; the choice at Fort Bridger; the rope toss is aimed by hand |
| Progress the family can see | The journal (kid-facing), the Parent Zone Report with the shared chart module (legs, problems right by kind, words right, the fact ladder and the week's words via the two shared stores) |

## 5. The numbers (first pass; the economy sim will tune them)

- A leg: 150–200 miles; 15 miles a day steady, 20 brisk (mules +3); a day ≈ 6 s; a leg ≈ 10 days ≈ 60 s of travel
  plus 4–6 markers (≈ 15 s each), 2–3 trail problems, one event, the fort or river scene (≈ 3 min): 10–14 minutes.
- Food: 3 lb a person a day full, 2 plenty, 1 lean; a party of 4 eats 120 lb on a 10-day leg; flour $4 / 50 lb sack
  in 1847, rising by fort (the way it really did).
- Starting cash $45 (1847; v1.3, was $400); a leg pays $4 for arriving + $1 / $3 / $14 for the stars (arrived / everyone happy / every marker right) + tokens; prices and pay both scale by season ×2 / ×4. See "v1.3 — money is a choice" below.
- Problems per leg: ~5 facts (markers), ~4 applications (store, rations, distance, event), 3 words (river) or 3
  words (letter): ~12 learning moments a session, in line with the other games' 12-a-day missions.

## 6. Build plan (if you say go)

Three streams in worktrees, as before, with a SPEC contract per stream:
1. **Scene engine** (`src/scene/*`): the parallax trail, weather, animals, the wagon and party sprites, landmark
   art (12 landmarks, 5 biomes), the river and store scenes as canvas backdrops; a mock for the UI tests.
2. **Journey sim + content** (`src/journey/*`, `src/content/*`): pure functions for days, food, pace, rations,
   events (seeded), legs and seasons; `wordProblems.js` (fact → problem families with the work shown); the 12
   landmarks' facts and the 8 nations' facts (short, true, kid-level, sourced in `docs/SOURCES.md`); letter
   templates; unit tests and an economy sim.
3. **App** (`src/main.js`, `src/ui/*`, `index.html`): screens (players, title with the map, the trail, fort, river,
   post office, journal, results, Parent Zone with the chart), the panels reused from the other games, save /
   sync kind `ww`, pings, the service worker, ui-smoke and sync-smoke.
Then integration, QA at iPhone size, docs (`README.md`, `docs/LEARNING-DESIGN.md`), the site card and the Why
page section, and the Parent quick start line on the home page.

## 7. Open questions for Matt

1. **Name**: Wagon West / Westward / Trail to Oregon? (Not "Oregon Trail" as the title.)
2. **Companions = the family's other players?** Fun for siblings; it also means a child sees a sibling's avatar
   "tired" on their trail. I lean yes with stock characters as the default and family as an option.
3. **Fishing and foraging instead of hunting**: fine, or do you want a bow-and-arrow hunt (no guns) for the fun of
   it?
4. **The trading-post scenes with named Native nations**: keep (with your read of the wording), or leave the nations
   as named guides at landmarks only?
5. **How much spelling**: river words + letters (6 words a leg) or letters only?
6. **Build now or after a week of the Hill Climb in the wild?** A full build is a few hours of agent time and lands
   as one release.

---

## 8. Build contract: streams and file ownership

Four streams in worktrees, built from the same commit; the orchestrator integrates. Never touch another stream's
files; never touch `car-jump/`, `trail-blazer/`, `fraction-fright/`, `site/`, `build.sh`, `netlify.toml` (the
orchestrator does those). All code: plain ES modules, no build step, no dependencies, no network except the shared
sync and voice. Comments explain the why at the top of each module (the house style of the other games).

| Stream | Model | Owns |
|---|---|---|
| **Scene** | Opus | `wagon-west/src/scene/*` (engine.js, render.js, sprites.js, biomes.js, hunt.js, fish.js), `wagon-west/dev.html`, `wagon-west/tools/scene-smoke.mjs` |
| **Journey** | Opus | `wagon-west/src/journey/*` (sim.js, economy.js, events.js, problems.js, letters.js, stars.js), `wagon-west/tools/journey-tests.mjs`, `wagon-west/tools/economy-sim.mjs` |
| **App** | Opus | `wagon-west/index.html`, `wagon-west/src/main.js`, `wagon-west/src/ui/*`, `wagon-west/src/meta/*` (save.js, sync.js, mockScene.js, sfx.js), `wagon-west/sw.js`, `wagon-west/manifest.webmanifest`, `wagon-west/icons/*`, `wagon-west/tools/make-icons.mjs`, `wagon-west/tools/ui-smoke.mjs`, `wagon-west/tools/sync-smoke.mjs`, `wagon-west/README.md` |
| **Content** | Sonnet | `wagon-west/src/content/*` (legs.js, nations.js, companions.js, events.js, letters.js, lookouts.js), `wagon-west/docs/SOURCES.md`, `wagon-west/docs/LEARNING-DESIGN.md` |

The content files exist as **skeletons** (schema + two or three entries each) at the build commit so every stream
imports real shapes; the Content stream fills them in without changing the shapes.

## 9. Content schema (`src/content/*`, Content stream fills, everyone imports)

```js
// legs.js
export const LEGS = [{
  id: 'kansas-river', n: 1, name: 'Kansas River', from: 'Independence', to: 'Kansas River crossing',
  miles: 150, biome: 'prairie',                       // 'prairie' | 'bluffs' | 'highdesert' | 'mountains' | 'gorge' | 'valley'
  stop: { kind: 'river', name: 'Kansas River' },      // 'fort' | 'river' | 'landmark' | 'home'
  river: { width: 'wide' },                            // rivers only: 'narrow' | 'wide'
  fort: { prices: 1.0 },                               // forts only: the price level (×, rises along the trail)
  nation: 'kansa',                                     // the trading post's nation here (optional)
  lookout: 'kansas-river',                             // lookouts.js id (the fact read at the stop)
  sticker: { id: 'kansas-river', name: 'Kansas River', emoji: '🌊' },
}, …];                                                 // 12 legs in trail order; LEG_BY_ID
export const SEASONS = [{ id: 's1847', year: 1847, name: 'Rookie year', priceMult: 1, numberMult: 1 },
  { id: 's1850', year: 1850, name: 'Pioneer year', priceMult: 2, numberMult: 2 }, { id: 's1853', year: 1853, name: 'Trailblazer year', priceMult: 4, numberMult: 4 }];
export const ANIMALS = [{ id: 'oxen', name: 'Oxen', milesPerDay: { steady: 15, brisk: 19 }, feedLb: 0 }, { id: 'mules', name: 'Mules', milesPerDay: { steady: 18, brisk: 23 }, feedLb: 2 }];
// lookouts.js: the real fact read aloud at a stop (kid-level, one or two sentences, true; sourced in docs/SOURCES.md)
export const LOOKOUTS = { 'kansas-river': { text: '…', say: '…' }, … };
// nations.js: the nations the trail passes, in order; the trading post's fact and trade
export const NATIONS = [{ id: 'kansa', name: 'Kansa', legs: ['kansas-river'], fact: { text: '…', say: '…' },
  trade: { give: 'pelts', get: 'flour', rate: [3, 2] },  // 3 pelts for 2 sacks (the problem generator scales by season)
  source: 'SOURCES.md#kansa' }, …];                       // 8 nations
// companions.js: 8 stock characters
export const COMPANIONS = [{ id: 'blacksmith', name: 'Ada the blacksmith', hat: 'cap', color: '#…', lines: { trail: ['…'], tired: '…', happy: '…' } }, …];
// events.js: the trail events (text only; the journey stream decides when they fire)
export const EVENTS = [{ id: 'wheel', name: 'A wheel comes off', biomes: null, kind: 'problem', problem: 'parts', text: '…', say: '…', fix: 'A quick fix and we roll on!' },
  { id: 'storm', kind: 'rest', … }, { id: 'berries', kind: 'bonus', foodLb: 20, … }, { id: 'bison', kind: 'lookout', … }, { id: 'trade', kind: 'trade', … }, { id: 'hunt', kind: 'hunt', … }, { id: 'fish', kind: 'fish', … }, { id: 'mud', kind: 'problem', problem: 'fact', … }];
// letters.js: the letter's narrative lines by what happened (the journey stream picks three) + the P.S. frame
export const LETTER_LINES = { arrived: ['We made it to {stop} today.'], river: ['The {river} was {width} but we crossed it fine.'], hunt: [...], fish: [...], storm: [...], berries: [...], bison: [...], trade: [...], tired: [...], happy: [...] };
export const LETTER_PS = 'P.S. My spelling words this week: {w1}, {w2} and {w3}.';
export const LETTER_OPEN = ['Dear Grandma,', 'Dear Uncle Theo,', 'Dear Miss Carter,'];
```
Text rules: no death, illness, weapons beyond the bow, or alcohol; nations named as living peoples (present tense
where true today); every fact traceable to `docs/SOURCES.md` (National Park Service, the Oregon-California Trails
Association, tribal nations' own sites, state historical societies). Spoken text (`say`) spells out numbers and
avoids abbreviations.

## 10. Journey contract (`src/journey/*`, pure: no DOM, no clock, no storage)

```js
createJourney({ season: 's1847', wagonName, animal: 'oxen', companions: ['blacksmith','scout','cook'], seed }) → J
// J: { season, legIndex, legId, milesDone, day, cash, food (lb), parts, tokens, pace: 'steady'|'brisk',
//      rations: 'full'|'plenty'|'lean', mood: 'happy'|'fine'|'tired', party: [{ id, mood }], stickers: [], letters: [],
//      legStats: { markers, markersRight, problems, problemsRight, words, wordsRight, hunted, fished }, done: false }
startLeg(J, legId?)                              // the next leg by default; resets legStats; returns the leg
tickDay(J, { rand })                             // one day: miles by pace & animal, food eaten by rations & party,
                                                 // mood from food / rations / rest; returns { arrived, event | null, marker | null,
                                                 // foodLow, miles }; markers every ~30 mi (4–6 a leg); one or two events a leg
                                                 // (seeded, by biome, never two of the same kind in a leg)
applyMarker(J, { correct, quick })               // right: mood up a notch, quick: +3 free miles; miss: a slow day (the next tick is 60 %)
applyProblem(J, { kind, correct, firstTry })     // tokens +1 on a first-try right; stats
applyWords(J, { asked, right })                  // river words / letter words
applyHunt(J, { meatLb }) · applyFish(J, { fishLb })  // food added
applyTrade(J, { giveN, getN })                   // a trade's result
buy(J, { item: 'flour'|'parts'|'oxen'|'blankets'|'rope', qty, price }) → { ok, cost }   // never below $0: ok false
arrive(J) → { stars: [arrived, everyoneHappy, allMarkersRight], cash: { arrival, stars, total }, sticker, crate: tier | null }
nextLeg(J) / journeyDone(J) → the valley; newSeason(J)
foodNeeded(people, rations, days), etaDays(miles, pace, animal), priceAt(item, leg, season), storeList(leg, season)
// problems.js: a word problem from a fact the child knows (the app passes a fact from the ladder, or a skill)
problemFor({ kind: 'buy'|'divide'|'ration'|'distance'|'parts'|'trade', fact: '7x8' | '56/7' | null, leg, season, rand })
  → { text, say, answer (int), unit: '$'|'lb'|'days'|'', work: [line, line, line], kind, fact }
  // 'buy': "Flour is $7 a sack. You buy 8 sacks. How much is that?" (fact 7x8 → $56; work: "7 × 8 = 56" + a split
  //   if the fact is not yet fluent: "7 × 8: 7 × 4 = 28, doubled = 56"); 'divide': "$56 buys sacks at $7 each. How
  //   many?" (and the remainder variant "You have $60 …: how many, and what is left?" → two answers asked in turn);
  //   'ration': "3 pounds a day for 4 people, 5 days" (two steps, both shown); 'distance': "60 miles at 15 a day";
  //   'parts': "12 spokes, 3 broken"; 'trade': the nation's rate × the pelts you have. Numbers scale by season.numberMult.
// letters.js: composeLetter(J, legEvents, words: [w1,w2,w3]) → { opening, lines: [3], ps, text }
// stars.js: the star rules; economy.js: prices, pay, tokens, the crate rule (a gold crate on a 3-star leg)
```
Unit tests (`tools/journey-tests.mjs`, node, no DOM): a full 12-leg journey on seeded random with always-right
answers arrives with cash to spare and 36 stars; always-wrong still arrives (no fail state); food never negative;
pace / rations arithmetic; markers 4–6 a leg; events never repeat a kind in a leg; every problem kind for ×2…×12,
÷ and the big tiers produces an integer answer and ≥ 2 work lines, with `say` free of digits over 999 written as
digits; letters pick lines that happened; seasons scale. `tools/economy-sim.mjs`: 40 kids, a leg a session,
70 % right: hours to each season, tokens per leg, food margin.

## 11. Scene contract (`src/scene/*`: a presentational canvas; the app drives it)

```js
createScene(canvas, { onEvent, reducedMotion }) → scene
scene.setLeg({ id, biome, miles, stop })            // the backdrop set for the leg (parallax layers by biome)
scene.setParty({ animal, companions: [{ id, hat, color }], wagon: { paint, flag, name } })
scene.setTravel({ milesDone, pace, rations, weather: 'clear'|'rain'|'storm'|'dusk'|'snow', mood, foodLow, moving })
scene.setBackdrop('trail' | 'fort' | 'river' | 'landmark' | 'camp' | 'post' | 'valley')   // the stop scenes
scene.spotAnimal('bison' | 'pronghorn' | 'coyote' | 'eagle')  // a critter crosses the background (a lookout cue)
scene.celebrate('arrived' | 'river' | 'star')      // confetti / fireworks / the party cheers
scene.startHunt({ seed, shots: 5 })                // the bow scene: animals cross (rabbit, deer, turkey); the child
                                                   // taps / clicks to loose an arrow (the scene owns the pointer while a
                                                   // hunt runs); emits hunt {hit, animal, meatLb} per shot and huntEnd
                                                   // {meatLb, hits, shots}; cartoon-clean: a puff, a flop, "Got one!"
scene.startFish({ seed, casts: 4 })                // a bobber dips; tap in the window → fish {size, lb}; fishEnd {fishLb}
scene.endMiniGame()                                // (the app leaving early)
scene.play() / pause() / destroy() / resize()
scene.getState() → { backdrop, milesDone, weather, moving, mini: null | { kind, left, hits } }
// events: 'ready', 'hunt', 'huntEnd', 'fish', 'fishEnd', 'animalSpotted'
```
Rendering: 2D canvas, DPR-aware, 60 fps on a phone with ≤ 8 ms of game code per frame at 4× CPU throttle; the
wagon, the draft animals (oxen / mules) walking, 3 companions walking alongside (hats and colours), dust, weather;
six biomes with their own parallax (sky, far, mid, near, ground, props) and 12 landmark paintings (Chimney Rock,
Independence Rock, South Pass, the forts' palisades, the Columbia gorge, the valley's homestead). `dev.html`:
`?biome=…&backdrop=…&hunt=1&fish=1`, keys for weather and pace. `tools/scene-smoke.mjs` (Playwright): every biome
and backdrop renders without errors (screenshots), the hunt and the fishing run to their ends with scripted taps,
perf under the budget. Kid rules on the canvas: no blood, no corpses (the animal flops, a puff, it is gone).

## 12. App contract (`src/main.js`, `src/ui/*`, `src/meta/*`)

Screens: **players** (the shared picker: profiles.js), **title** (the map: the trail drawn to the party's position,
the next stop, "Hit the trail", Journal, Outfit, Parents; the streak flame and the week's words count), **outfit**
(name the wagon, pick the animal and three companions, paints / flags from crates), **store** (a fort: the goods
with prices, each purchase a 'buy' or 'divide' problem on the problem panel), **trail** (the scene + the HUD: "Day
23 · Fort Laramie in 41 mi", food, mood faces, the two dials (pace, rations) as big segmented buttons, pause), the
**marker** (Trail Blazer's gate panel in mode `'trail'`: title "Mile marker", chip "Marker 2 of 5"), the **problem
panel** (`src/ui/problemPanel.js`: the sentence in big type, read aloud, the numpad; a miss shows the three work
lines, then the answer is typed once (copy), as the gate panel's fix-it), **river** (three words on Spell Jump's
spell panel: `createSpellPanel(root, { tts, audio })` → `run({ word, syllables, sentence, sayAs, pattern, isNew, look })`
resolves `{ firstTry, fixed, cancelled }`; then the **rope toss**: an SVG number line 0…1 with the landing fraction
said and shown ("the landing is three quarters of the way across"), the child drags the aim and taps THROW; the
tolerance is Fraction Fright's for the child's tier (`toleranceFor` in `/fraction-fright/src/skills/items.js`) and a
near miss is a wet boot and one more throw), **post office** (the letter: the three narrative lines appear, then the
P.S. words are dictated one by one on the spell panel; the letter is read back and saved), **journal** (letters,
stickers, the map), **results** (the leg: stars, cash rows, tokens, the sticker, the crate button), **Parent Zone**
(the shared pattern: PIN, Family code, Journey (where they are, the party, reset), Options (sound, music, motion,
hunting on/off, "fractions at rivers" on/off, the voice as set in Spell Jump), Report (legs, markers right %,
problems right by kind, words right, the progress chart from `/spell-jump/src/ui/chart.js` with a per-day log,
Copy report), Players).

Data: `wagonWest.<id>.save` (`src/meta/save.js`: v1 { journey (the J object), seasonsDone, stickers, journal
letters (≤ 36, text only), cosmetics, crates, streak (engagement.js), play: per-day log { legs, markers, markersRight,
problems, problemsRight, words, wordsRight }, resetAt }; settings `wagonWest.settings`); sync kind `ww` via
`registerSyncKind('ww', { storageKey: saveKey, merge })` with merge rules: the journey = the later doc (a journey is
one device at a time; cash / tokens max), stickers / letters union, per-day log max, resetAt wins. The facts store
and the word store are Spell Jump's and Trail Blazer's own keys, written through their modules (`recordAnswer`,
`recordSpell`), never copied. Pings: `createPinger('wagon-west', …)` with kinds 'day', 'leg'.
Mock scene (`src/meta/mockScene.js`, `?mock=1`): the same API, scripted hunts / fishing, instant.
Tests: `tools/ui-smoke.mjs` (both layouts, the picker → outfit → a whole leg on the mock with markers answered
right and one wrong, a store problem right and one fixed, a river with three words and a rope toss, a letter, the
results, the journal, the Parent Zone tabs and chart, the audit of every screen: no links off-origin, no native
inputs outside the Parent Zone, targets ≥ 44 px, no overflow), `tools/sync-smoke.mjs` (two devices, as the other
games'). `sw.js` (`wagon-west-v1.0.0`, the other games' pattern with network-first index + main.js), manifest,
icons (make-icons.mjs draws a wagon). VERSION '1.0.0'.

## 13. Integration (orchestrator)

Cherry-pick the four streams, wire the real scene (`?mock=1` for tests), add `wagon-west` to `build.sh`,
`netlify.toml` (ignore rule and the trailing-slash redirect), the site card and the Why page section, the home
page's parent quick start, the stats function's game list if it has one; run every suite; playtest a leg on the
real scene at iPhone size; commit "Wagon West 1.0"; hold the push for Matt.

---

## v1.1 — the natural voice, the trail's own music, and side games (Matt, Oct 30: "Let's make a different
## background tune. Need to make it more addictive with opportunities for side games and stuff. The robotic voice is
## being used, not the cool Google voice")

### 1. The natural voice (bug)
Spell Jump's natural voice plays a phrase only when a clip for it exists on the device (`tts.js`: cloud engine when
`cloud.active` and every clip of the utterance is present, else the device voice). Wagon West 1.0 never prepares any
clip, so every line falls back. Fix (app stream, `src/main.js` + the panels):
- `prepareVoice()` on player select, voice change, and every leg start: `cloud.prepareList()` (the week's words:
  the spell panel's texts), the question and full sentences of the child's active facts (`activeFacts(facts)` →
  `questionSentence(f, flip)` both flips, like Trail Blazer's prepareVoice), every `say` in LOOKOUTS, NATIONS[].fact,
  EVENTS, the companions' lines if ever spoken, the fixed UI phrases the panels say ("Now you: type the answer",
  "Fixed it!", the card buttons' texts if spoken), and the river's landing sentences for the fractions in play
  (`say` of every T1 / T2 fraction).
- Generated sentences just in time: `app.voiceFor(texts)` → `cloud.active ? Promise.race([cloud.prepare(texts),
  sleep(2500)]) : Promise.resolve()`; awaited by `runProblem` before `problemPanel.open` (the problem's `say`, each
  `work` line's spoken form, each part's `say`), by the post office before the letter is read (the opening, the lines,
  the P.S. with the words, the closing) and before each dictated word (Spell Jump's `prepareList` covers the words),
  by `runTrade` (the trade problem) and by the marker panel's hint sentence (`fullSentence + spokenHint`) when a miss
  is shown (prepare at open so it is ready in time).
- Parent Zone → Options → the voice line shows "Natural voice: <name> · N clips ready" like Spell Jump's, and a
  "Say a test line" button that reports which engine spoke (tts.lastEngine).
- ui-smoke: with the fake cloud backend (`window.__cloudVoiceBackend` as Spell Jump's tests use it) and a family
  code, a leg's marker, problem, card, river sentence and letter are all spoken by the cloud engine (`tts.lastEngine
  === 'cloud'` after each), and a prepare request carries the leg's lookout and the problem's say.

### 2. The trail's own music (`src/meta/music.js`, app stream)
A period tune, not Spell Jump's loop: three **public-domain** songs the trail actually sang, on a plucked banjo-like
Web Audio synth (a short-decay triangle + a noise pluck, a walking bass, a light shaker): "Oh! Susanna" (Stephen
Foster, 1848), "Buffalo Gals" (1844) and "Old Dan Tucker" (1843), transcribed as note lists (melody + bass per bar),
one tune per leg rotating by leg index, a slower, quieter arrangement at camp and in the post office, silence on the
panels (the voice ducks it as in the siblings: `Audio.voice(on)` → the music bus). The shared `Audio.music()` loop
is never started in this game (`Audio.music(false)` always; the settings toggle drives `Music.on(bool)`). Tempo ~
104 bpm on the trail, 76 at camp; master gain −14 dB; starts after the first tap (the unlock). No external files.

### 3. Side games (the "addictive" layer; kid rules stand: no timers, no lives, nothing punishes stopping)
- **Make camp** is a real place, not a way out: on the trail, "Make camp" (and the evening of every arrival) opens
  the **Camp** screen (the scene's `camp` backdrop): **Fishing** (the scene's fishing, any time: food), **Hunting**
  (the bow, when hunting is on; food and a pelt), **Quick Draw** (a card game with a companion: a fact per card from
  the child's ladder on the marker panel, first to 7 right wins a trade token; no clock: the companion "draws" a
  card every time the child answers), **Campfire tales** (a lookout or nation fact read aloud + a riddle that is a
  fact in disguise: a token), **Rest** (a day: mood up). A camp activity costs a day of food (the sim's rest day);
  the party's mood goes up. Camp is where a child goes "to play a bit more": the trail never needs it.
- **Trail cards**: a collection in the Journal (a fourth page, "Cards"): 40 cards in four suits (12 landmarks, 8
  nations, 12 animals and plants, 8 companions), each with its picture (an emoji on a card face drawn by the UI,
  no new art needed) and its one-line fact (lookouts / nations / a new `src/content/cards.js` for the animals and
  plants, sourced). Cards drop from: a lookout at a stop (its landmark card), a trading post (the nation's card), a
  spotted animal (`animalSpotted`), a hunt or a catch, berries, a companion's line at camp (their card), every leg's
  arrival (one random card of the leg's biome). Duplicates become a token. The album shows the set per suit with
  "7 of 12" and a gold star for a full suit (a gold crate). Sync: `save.cards` union.
- **Fort Derby** (at every fort, optional, from the store screen's "Race the mail wagon"): a 30-second side-scroll
  wagon race against the mail wagon on the scene (`scene.startDerby({ seed, length })`: two wagons, the child's and
  the mail wagon; `scene.derbyBurst(power)`; events `derbyMarker` (ask a fact: the marker panel), `derbyEnd {won,
  margin}`); a right answer is a burst, quick a bigger one; winning pays $20 × priceMult and a card; losing pays a
  "good try" $5. No timer on screen: the race ends at the line. (Scene stream.)
- **The dog**: at Fort Kearny a dog joins the party (named by the child on the keyboard). It walks beside the wagon
  (scene: a small sprite, one of three coats), barks at animals (a card drop chance ×2 on lookouts), and finds a
  berry patch now and then (a bonus event). Pure delight; no mechanics beyond that. (Scene + app.)
- **Daily trail challenge** on the title: "Today's challenge: cross the Snake River with no misses" style goals
  generated from the current leg (one a day; a token and a card). (App + journey.)
Economy: tokens now buy the Outfit's paints, flags, bugles AND wagon upgrades that matter (a canvas cover: +1 day of
weather protection; iron tires: +2 miles a day; a water barrel: lean rations feel like plenty) so cash and tokens
both have a sink (the 1.0 note "cash piles up"). Economy sim re-run.

### 4. Streams
- **Scene** (Opus): `startDerby` / `derbyBurst` / `endDerby` + events, the mail wagon sprite, the dog (3 coats,
  walking, a bark pose), `setParty({ dog })`; scene-smoke checks; dev.html keys.
- **App** (Opus): §1 the voice, §3 Camp screen and activities, Quick Draw and Campfire tales on existing panels,
  Trail cards (album page, drops, sync), Fort Derby wiring, the dog's naming and party, the daily challenge, the
  token sink in Outfit, Parent Zone voice line, ui-smoke for all of it (the fake cloud backend), README.
- **Music** (Sonnet): `src/meta/music.js` per §2 with a `tools/music-check.mjs` (node: the note lists are in range,
  bars add up, the three tunes differ) and a dev page `music-dev.html`; the app stream wires `Music.on/off/tune`.
- **Journey + content** (Sonnet): `cards.js` content (the 40 cards with facts and sources), the camp activities'
  effects in the sim (`camp(J, kind)`: a day, mood, food), the derby's pay, the daily challenge generator
  (`dailyChallenge(J, day)` → { text, check(J) }), the upgrades (`UPGRADES`, `buyUpgrade`, their effects in
  tickDay), journey-tests, economy sim re-run.
VERSION 1.1.0, sw `wagon-west-v1.1.0`.

---

## v1.2 — the trail is the game (Matt, Oct 31: "All the supplies: are there breakdowns? Why does it matter who
## you picked? Those elements don't come through"; "there should be elements of the game that are fun and not
## necessarily educational"; "Go ahead, use sonnet agents")
The learning spine stays small and clear: the **mile markers** (4–6 facts a leg) and the **letter's three words** at
every fort are the only non-optional learning moments. Everything else becomes optional and rewarded (a token for
working a problem out, never a gate), and the trail gains play that has no question in it. Kid rules stand.

### 1. Supplies that do things (journey + app)
- **Food by kind**: `J.foods = { flour, bacon, beans }` in lb (J.food stays as their sum, computed; older saves split
  their J.food 50 / 30 / 20 %). A day eats from each kind in that ratio while it lasts, then from what is left; the
  store's `buy` adds to the kind. `foodDays(J)` → days left at the current rations. The **Wagon panel** (app, from
  the HUD's food box) draws the load: sacks / sides / bags as stacks that shrink, parts, rope, blankets, arrows with
  counts, "food for 6 days · Fort Laramie in 9 days" in plain words (no numbers that read as a score), the animals'
  state, the companions with their moods and skills.
- **Breakdowns**: `breakdown` events (wheel, axle, tongue; replaces the 1.1 'wheel' problem event) need a part:
  with one, a quick repair (a 'parts' problem is OPTIONAL: "Work it out" for a token, else a tap "Fix it") and the
  part is used; without, a lost day and a limp (60 % speed) until the next fort (`J.limp = true`, cleared by a fort or
  a part bought from a trader). `J.goods.parts` starts at 1; the store sells them.
- **Rope**: at a river, the float option is safe with rope (none: a sack of flour is soaked, 25 lb). **Blankets**: the
  cold legs (south-pass, blue-mountains, a snow event anywhere) need one per two people; short → a cold night: the
  party tired, a rest day. **Arrows**: a hunt uses 5 (`J.goods.arrows`, start 15); none → the camp offers fishing only.
- **Animals** tire: `J.animals = { n: 2, tired: 0..100 }`; brisk pace and mountain biomes tire them, a rest day or a
  stop restores; over 70 the pace is steady whatever the dial says ("the oxen need a rest"); a **second yoke**
  (`buy` item 'yoke', $42 × price level, sold from Fort Kearny on, v1.3) makes n = 4: +3 miles a day and slower tiring.
- Every effect above is a line the child sees (a card or a HUD toast), never a silent number.

### 2. Companion skills (content + journey + app)
`COMPANIONS[].skill = { id, name, text }` and in the sim `skillOf(J, id)`; one trigger each, announced with the
companion's line when it fires (`event.skill = { id, name, text }` on the tickDay result or the relevant call's result):
blacksmith (Ada) fixes one breakdown a leg without a part; scout (Eli) +1 animal spotted a leg (a card chance) and
the weather forecast a day early; cook (Rosa) food lasts 10 % longer, berries twice as often; doctor (Mabel) a
tired companion recovers in one day; carpenter (Tomas) the float is safe without rope and repairs use half a part
(every second repair free); fiddler (Jasper) +4 spirit a night at camp and Quick Draw's companion draws less often;
teacher (Nora) the marker panel shows the strategy hint BEFORE the answer once a leg (the child asks: "Nora's tip");
storyteller (Ines) a campfire tale always drops a card and lookouts drop two. The Outfit screen shows each skill in
one line; the party's three skills show on the Wagon panel.

### 3. Rivers are a choice (scene + app + journey)
At every river the child picks: **Ford** (free: a timing tap on the scene (`scene.startFord({ seed, width })`: the
current pulses, tap on the calm beat; events `ford { good }` per tap and `fordEnd { soaked }`; soaked = one sack of
flour wet, 25 lb, never more), **Float** (the rope toss for one fraction, then steering: `scene.startFloat({ seed,
width })`: drag or ← → to steer the raft past rocks down a short run; `floatEnd { bumps }`; with rope or the
carpenter a bump costs nothing, else one bump = a soaked sack), or **Ferry** (the ferryman asks the week's three
words as the fare; the words still record through Spell Jump). The crossing's story goes in the letter. `crossRiver
(J, { how: 'ford'|'float'|'ferry', soaked, bumps })` applies it.

### 4. Pure play (scene + app)
- **Rafting the Columbia**: the last leg (the-dalles → willamette-valley) runs as a raft: `scene.startRaft({ seed,
  length })`: a longer steering run down the gorge, rocks, calm lanes, eddies that spin you; `raftMarker { n, of }`
  at four bends (a mile marker's fact keeps the learning spine), `raftEnd { bumps, time }`; the party cheers at the
  valley. The leg's miles tick as the raft runs (no days).
- **Buffalo stampede**: a `stampede` event on the prairie / bluffs legs: `scene.startStampede({ seed })`: the herd
  thunders across; tap BRAKE on the beat when the lead bull looms (three waves); events `stampede { good }` and
  `stampedeEnd { held }`; held = the bison card + a lookout fact; not held = dust everywhere, the wagon fine, a laugh.
- **Talk to people** at every stop: `src/content/people.js`: 2–3 people per stop id (a trader, a soldier's child, a
  guide of the leg's nation, a returning mountain man, a ferry family, a missionary's daughter…) each with a name,
  an emoji portrait, 2 lines (true-to-period, kid-level, sourced where factual) and sometimes a `gift` (10 lb of
  beans, a card, a tip that is a 'parts' problem for a token) or a `trade` (as the posts). The stop screen gets a
  "Talk" row of portraits; a talked-to person is remembered (`J.met`) and the journal counts "people met".
- **Weather you see coming**: `forecast(J)` → 'clear' | 'rain soon' | 'storm soon' | 'snow soon' a day ahead (the scout
  gives it two days ahead); the HUD shows a small cloud icon with the words; the camp menu gains "Wait out the
  storm" (a rest day; the storm then costs nothing).
- **Deeds**: `DEEDS` (20) in `src/journey/deeds.js` with `checkDeeds(J)` → newly earned ids (e.g. 'dry-feet' every
  river of a season without a soaked sack, 'mail-beater' three derby wins, 'full-wagon' a leg with no food low,
  'card-shark' 20 cards, 'people-person' 12 people met, 'cold-proof' the Blue Mountains with blankets for all,
  'fixer' three repairs, 'angler' 50 lb of fish, 'archer' 100 lb of game, 'spelling-ferry' a ferry fare with no
  misses, 'marker-master' a leg with every marker right, 'summiteer' South Pass, 'homesteader' the valley, …); each a
  badge in the Journal's "Deeds" page with a one-line "how" and a token on earning; `J.deeds = [ids]`.
- **The family map**: on the title's map, every other player in the family shows as a small wagon at their stop
  (read with `loadSave(id)` for each family player; no names unless tapped; no scores). Siblings see each other's
  dust, as Matt asked ("siblings separate" stands: nothing shared but the map).

### 5. The store without a gate (app)
Goods are bought with a tap at the listed price (the cash box in view; a buy the box cannot cover is greyed). Each
good's row has **"Work it out"**: the 'buy' / 'divide' problem for a trade token on a first-try right (the 1.0 panel
and work lines unchanged). Rations and distance questions are no longer forced: the trail HUD's food box offers
"Ask Eli: how many days?" (a 'distance' or 'ration' problem for a token), at most once a leg each. The hint
"you'll need about N lb to reach <stop>" is always shown at the store (`foodToNextFort`).

### 6. Streams (all Sonnet)
- **Journey + content** owns `src/journey/*`, `src/content/companions.js` (skills), `src/content/people.js` (new),
  `src/content/events.js` (breakdown / stampede / snow events), `docs/SOURCES.md` (people), `tools/journey-tests.mjs`,
  `tools/economy-sim.mjs`: §1 foods / breakdowns / rope / blankets / arrows / animals / yoke, §2 skills, §3
  `crossRiver`, §4 `forecast`, `deeds.js`, `meetPerson(J, id)` / `J.met`, raft and stampede pay (`raftPay(J, {
  bumps })` $10–40 × price level, `stampedePay(J, { held })`), tests, the sim re-run (--check: nobody stuck, the
  first season 12 ± 2 sessions, soaked sacks < 1 a leg, limps < 1 a season, tokens 3–10 a leg).
- **Scene** owns `src/scene/*`, `dev.html`, `tools/scene-smoke.mjs`: `startFord`, `startFloat`, `startRaft`,
  `startStampede` with their events (and `endMiniGame()` ending any of them), the raft and the bison herd sprites,
  BRAKE as a tap or ← ; keys in dev.html; smoke checks for each (scripted taps win and lose), perf.
- **App part one** owns `src/main.js`, `src/ui/hud.js`, `src/ui/store.js`, `src/ui/outfit.js`, `src/ui/title.js`,
  `src/ui/map.js`, `src/ui/wagonPanel.js` (new), `src/meta/*`, `index.html`, `tools/ui-smoke.mjs`: §1's Wagon panel
  and effect cards / toasts, §2's skills in Outfit and the party, §5's store and "Ask Eli", §4's forecast on the
  HUD and "Wait out the storm" at camp, the family map, the breakdown flow with the optional problem, the mock
  scene's new mini-games (scripted), VERSION 1.2.0, sw `wagon-west-v1.2.0`, README "1.2"; ui-smoke for all of it.
- **App part two** (after the first three merge) owns `src/ui/river.js`, `src/ui/people.js` (new), `src/ui/deeds.js`
  (new), `src/ui/journal.js`, `src/ui/results.js`, `src/ui/camp.js`, plus the wiring lines in `src/main.js` for
  rivers / raft / stampede / people / deeds (small, marked blocks) and their ui-smoke sections.

## v1.3 — money is a choice (playtest, Oct 31: cash piled up to about $1,500 over twelve legs, the General Store stopped
## being a decision, and the second yoke was bought by everyone on leg 1)
The kid rules stand (no timers, lives or fail states; nothing punishes stopping). A child who answers well is comfortable
but still has to pick at the store; a child who misses a lot runs lean (slow days, a thin purse, the safety nets), and
every journey still finishes. `tools/economy-sim.mjs` runs three players (strong 90 % right, average 70 %, weak 45 %), each
shopping by eye and each with a "buys everything useful" policy, prints the cash on hand at every stop, and `--check`
enforces the TARGETS at the top of the file.
- **Pay** (`economy.js`, Rookie dollars; the later seasons are the same times 2 and 4, stars included): start cash $45
  (was $400), $4 for arriving, then $1 for the arrived star, $3 for everyone happy and $14 for every marker right (was a
  flat $60 + $20 a star, and the star pay did not scale with the season). The pay that depends on answers is the marker
  star, so the strong player earns about $16 a leg, the average about $10, the weak about $8: a bare arrival still pays.
  Fort Derby $8 for a win, $2 for a good try (was $20 / $5); the Columbia raft $24 less $6 a bump, never under $6 (was
  $40 / $10 / $10). The stampede ($15), the trade tokens, the camp games, the daily challenge and the deeds are unchanged.
- **The second yoke** costs $42 × the fort's price level (was $30) and is on the shelf from Fort Kearny on (`EXTRA_GOODS`
  `fromLeg: 2`; `storeList` leaves it out at Independence and the Kansas River, `buy` refuses it there). At Fort Kearny it
  is $50, at Fort Laramie $67, at Fort Bridger $80, at Fort Hall $92: it competes with the food and the blankets, and
  buying it early is worth more than buying it late.
- **Where the money goes**: food (Fort Hall's 700 miles is the big bill, about nine sacks at $9), blankets before South
  Pass, a second spare part, arrows, rope, the yoke. There is no store after Fort Hall, so what is earned in the last four
  legs and on the raft is the cushion at the end of the journey, not something to chase.
- **Unchanged** on purpose: the goods' base prices (flour $4 a sack, in the tests and the problems), the fort price
  levels, the wagon upgrades (6 / 8 / 6 trade tokens or $40 / $60 / $40, bought with tokens in practice), the hunt and
  fish yields, the food rules. Trade tokens still pile up (about 60 spare at the end of a Rookie journey): they want a
  sink, which is a UI decision.

## v1.3.2 — the voice (owner, Oct 31, real device: "There are glitchy voices reading the letters. Also the old robot voices are back.")
Rule (stands from v1.1 §1): the natural voice plays a phrase only from a clip made for that exact text; a phrase without its
clip is **not** handed to the device voice while the natural voice is in use (a family code, a natural voice picked, a server
with a key that accepts the family). The device voice speaks only when the natural voice is not in use at all.
- **One voice** (`src/meta/speech.js`, created in main.js; every `app.say` / `sayAll` / `sayWait`, the marker and problem panels
  (through a thin `tts` facade) and every toast / pop line go through it). A line the screen reads (`say`: a card, a letter
  line, a panel's question, Hear it) replaces what is playing. A toast's or a deed's line (`later`) never cuts anything: it is
  handed over when its toast is *shown*, waits while a panel, the dictation, a card, a mini-game or the pause sheet is open, and
  for the voice to be idle 0.9 s, plays one at a time, and is dropped after 20 s. Toasts with a line are released one at a time.
  A trail day's effect toasts wait for that day's marker / event (the panel would cut them).
- **Clips**: `ready(texts)` asks for the clips of a line and waits for them up to 9 s (asking again quietly); the line is then
  played with `cloud.play` (not `tts.say`, which gives a clip slower than 4 s to load to the device voice); a slow clip is
  retried, a missing one skipped. Screens that open a card or a panel wait at most 2.5 s for the clips ("a head start"), the
  speech itself waits longer; the Post Office waits 6 s before the letter, the dictation's words (and their letters) are ready
  before the spell panel opens.
- **Prepared ahead** (`prepareVoice` → `speech.prepareBulk`, small batches of 8, one at a time, stepping aside whenever a line
  is waiting for its own clip): the week's words and the alphabet, the fixed lines (including the first-run "How the trail
  works" card), the river, then **this leg** (lookout, nation fact, the people at the stop and their gifts and offers,
  the landmark card, every letter line the leg's letter can be made of), the child's mile-marker sentences, the next leg, then
  the rest. The list is `collectVoiceTexts` in `src/meta/voiceTexts.js`. Said just in time, never ahead: word problems and their
  work, the P.S. with the three words, the closing with the child's name, a letter line that tells pounds, the daily challenge,
  the Derby result, the dog's berries, riddles.
- **Tests**: `tools/content-audit.mjs` compares every string the UI can speak (the content walked independently and the string
  literals handed to the voice in `src/main.js` and `src/ui/*.js`) with that list; `tools/ui-smoke.mjs` "the letter home with
  instrumented engines" asserts zero device-voice utterances, zero overlapping or cancelled utterances, and that a toast line and
  a deed line fired during the dictation wait for it.

---

## v1.4 — Frodo and the river (Matt, Nov 1: "Frodo only interacts with wild plums it seems. Need more fun things that
## happen on the route. Fishing could also be more fun. Think of more side quests." and "also incorporate facts along the
## trail like hearing gunshots in the distance from buffalo hide hunters and buffalo stampedes, grizzly encounters etc")
Pure fun: nothing in 1.4 asks a question, gates anything or can be failed. The learning spine (the mile markers and the
letter's three words) is untouched. Every new thing is something the child watches, taps, drags or collects; the worst
outcome of anything here is a muddy dog, a fish that wiggles off (cast again), a hat in the sagebrush (the dog brings it
back) or a stone that sinks. Kid rules (SPEC §1) stand, with one narrow, owner-requested allowance for distant rifle
sounds in one trail fact (§1.7). Frodo is the owner's child's name for the dog: below, "the dog" means `J.dog`, with the
name the child gave it (`{dog}` in a template).

### 1. Design

**1.1 Frodo's nose (the trail, every leg once the dog has joined).** Two or three times a leg (seeded, even odds) the dog
bolts off the trail and comes back with something:
- **A find** (55 % of the slots left after the berry patch and a quest item): one of nine things of the leg's biome
  (`FINDS`, §2.1): an old horseshoe (a trade good: the blacksmith at any fort buys old iron, $1 × the season's price level
  each, from a row in the store), a tiny ox shoe, a magpie feather, a hawk feather, a stone arrowhead (sketched in the
  journal and **left where it lay**: it belongs to the history of the land, so the game never has a child keep a Native
  artifact), a dried buffalo chip (it warms tonight's campfire: spirit +5), a perfect flat skipping stone (+2 skips on the
  next throw), a pinecone, and rarely a shiny fishing spoon (the spoon bait, only while the wagon has none). The scene shows
  the dog dashing off-screen and trotting back with the thing in a little bubble; a pop (the trail-card pop's look) shows
  it and reads its line; it goes into a new **Finds** page of the journal (a sketchbook: one drawing per kind, "found 3
  times"). The day does not stop for a find.
- **A snake warning** (20 %, prairie / bluffs / high desert legs, at most one a leg): the dog plants its feet and barks; the
  wagon halts; a small cartoon rattlesnake sunning on the trail slides away into the grass. Nobody is hurt, the party feels
  looked after (spirit +5) and the rattlesnake card drops (its line stays "give it room"). A short card, one tap ("Good
  dog!").
- **A rabbit chase** (25 %, at most one a leg): the dog takes off after a jackrabbit toward the horizon, smaller and
  smaller, and a big button with the dog's name appears ("Frodo!"). Tapped in the first 80 % of the run (about 4 s, never
  shown as a countdown and never worded as one): he skids round and trots straight back. Tapped late or not at all: he comes
  back on his own, **muddy from nose to tail**, and stays muddy (a mud overlay on the sprite) until the next stop or camp
  ("a bath in the creek"). That is the whole penalty. Either way: a laugh, spirit +5 and the jackrabbit card.
- **The berry patch** (kept from 1.1: every other leg, 20 lb of wild plums and the wild plum card), now one of the nose
  slots and scheduled by the journey instead of the app (`dogBerriesDue` / `dogBerries` in main.js go).
- **A quest item** (§1.5): when a quest can start on this leg by the nose, the first nose slot is its item.
Pace: on days with no marker and no event, never in the last 8 % of a leg; 6–10 s each (a find does not stop the day at
all); about 20 s a leg on average.

**1.2 Fetch at camp (any camp, while the dog is in the party).** A new camp card, "Fetch". The camp at dusk, the dog
sitting up: the child drags back from the stick (a slingshot: the farther back, the farther the throw; a dotted ghost arc
shows where it will land) and lets go; the dog races out and back. Distance sets treats: 1, 2 or 3 (`FETCH.at`, a third
and two thirds of the field); the Finds page keeps the treat jar. Now and then (12 % a throw) he brings back something that
is not the stick: a find of the leg's biome (a new one while there is one), very rarely (2 %) the shiny spoon. Three throws
a visit, then "Frodo flops down by the fire". Fetch costs no day and no food (it is not one of `camp()`'s day activities).
Keyboard: hold Space to wind up, let go to throw.

**1.3 Fishing 2.0 (every fishing event and the camp's Fishing).** The 1.0 cast-and-dip is the first half of each cast; then:
- **Fish by river** (`WATERS`, `FISH`, §2.2): the Kansas River and the Platte give **channel catfish**; the Sweetwater
  (Independence Rock and South Pass legs) **hornyhead chubs**; the mountain creeks and the Bear River (Fort Bridger and
  Fort Hall legs) and the Snake **cutthroat trout**; the Snake River leg now and then a **white sturgeon**; the Blue
  Mountains' creeks **redband trout**; the Columbia (The Dalles, the valley) **Chinook salmon**, and rarely a sturgeon. The
  owner's "trout on the Platte" is not used: no trout is native to the Platte drainage (Wyoming Game and Fish; Behnke), so
  the trout start west of South Pass (§8).
- **The fight**: after the hook (the dip tapped in its window, as 1.0) the line goes taut. **Hold** (finger or mouse down,
  or Space held) to reel and the fish comes in; every second or two the line **wobbles red** (a yellow shiver 0.25 s
  before, so a child sees it coming); **let go** while it is red and hold again when it is calm. Held through half a
  second of one wobble, the fish **wiggles off the hook** ("It wiggled off! Cast again") and that cast is cast again once,
  so a session always has at least its four tries. The line never snaps and nothing is lost. Bigger fish reel longer and
  wobble more often. Missing the dip window is 1.0's "It swam off" and uses the cast.
- **The sturgeon takes two**: half way in, the reel holds and a companion's portrait pops up by the bank ("A big one! It
  takes two to land it."); a second tap on the portrait (or Enter) brings them to the rod with their `lines.help` line,
  and the two reel at double speed. No companion: the dog grabs the line.
- **Bait**: **worms** (the default, never run out); **grasshoppers** (caught first: a camp card "Catch grasshoppers", they
  hop through the grass and a tap catches one, up to 12 in the bait tin, one used a cast: trout and chubs bite sooner and
  run bigger); the **shiny spoon** (bought once at a fort store from Fort Kearny on, $3 × the price level, or found by the
  dog; never used up: salmon and trout run bigger). A row of three big bait buttons shows before the first cast.
- **Junk** (10 % a cast): an **old boot** (a laugh), a **snapping turtle** (the Kansas and the Platte only: you let it go and
  it paddles off), and once a season a **bottle with a note** (the note quest, §1.5). Junk reels in with no wobbles.
- **The dog's cameo** (30 % of sessions, at most one): he **splashes in** after the bobber (the cast is reset, free) or
  **grabs a fish off the bank** and runs, then brings it back, wet and proud (nothing is lost).
- **The fish log** (a new journal page): each species with how many, the biggest (inches) and where it was first caught,
  the personal best (the biggest of all, with a crown), "River oddities" (boot, turtle, bottle), and **Family records**:
  the biggest of each species in the family with the player's first name, read from each family player's synced save
  (the family map's `loadSave(id)` pattern; §8 asks about the names).
- **Food**: the catch is food as before (lb by species, §2.2), at most 24 lb a session; the journey's mean stays where 1.3
  has it (about 10 lb a session: the economy sim checks); a safety-net fishing hole still tops up to `RESCUE.minLb`.
- Toasts during a session are text only (the voice holds while a mini-game runs, v1.3.2); one spoken summary card ends it
  ("Two channel catfish and an old boot. Twelve pounds of fish for the wagon."), plus "A new fish for the log!" the first
  time a species is caught.
Pace: about 75 s a session (1.3: 45 s); fishing stays optional.

**1.4 Trail moments.**
- **Dust devil** (prairie, bluffs and high desert legs; 35 % of them, never two legs running; a quiet day): a swirling column
  of dust crosses the trail and the hats fly off (each companion's hat that is not 'none', plus the hat the child equipped);
  they tumble down along arcs; a tap catches one and it drops back on its owner's head. Every hat caught: "What a hat
  trick!" and a trade token; the rest land in the sagebrush and the dog brings them back (no dog: everyone finds their hat,
  dusty but fine). About 12 s.
- **Skipping stones** (at every river: offered on the far bank after each of the three river crossings, and once a leg at
  camp when the leg's water is a river): tap to throw, then tap each time the stone kisses the water (a ring flashes; a
  generous ±180 ms window) to keep it going; a missed kiss and it sinks with a plunk. Three throws, the best counts, 12 skips
  at most; the flat-stone find adds two to the next throw. Personal best and a **family leaderboard** (best skips, by
  player) on the Fish log page. About 25 s, optional.
- **Meteor shower** (the evening camp after an arrival, the forecast clear: half the eligible evenings, at most once every
  three legs, never in the valley): the camp at night, falling stars streak across (eight in about 20 s); a tap on one
  makes a wish: a **wish card** (`WISHES`, twelve, "I wish the oxen could fly.") kept on the Finds page. Nothing else; the
  word is "falling star" (see §1.7).

**1.5 Side quests: the missing locket, and the shape every quest reuses.** ("Lost" is a banned word, so the quest is "the
missing locket" and Molly "dropped" it.)
- **The dog joins at the Kansas River** (was Fort Kearny's store in 1.1): on the far bank after the crossing, "A dog has been
  following the wagon since the ferry. Keep it?", named on the keyboard as before. "Not now" is asked again at every fort
  store, as in 1.1. A journey that already has a dog keeps it; a new season keeps it (as 1.1).
- **The locket**: right after the dog is named at the Kansas River (or, when the dog came from an earlier season, as the
  first nose slot of the Kansas River, Fort Kearny or Chimney Rock leg) the dog trots back with a little silver locket. The
  clues: people in the stop's Talk row with a ❓ badge: at Fort Kearny Mrs. Platt (Molly's family camped here, bound for
  Fort Laramie), at Chimney Rock Josh (she dropped her grandma's locket at the Kansas River). At Fort Laramie Molly Rowe (a
  💛 badge) gets it back: her card in the new "Trail tales" suit, a trade token, a bag of dried apples (10 lb) and a line in
  the next letter home. Walking past her is fine: the next post office "sends the locket ahead to Fort Laramie, with a note
  for Molly" (the card still drops; no apples).
- **The bottle note** (fishing junk, the Fort Laramie to Fort Bridger legs): "Hello! My name is Sam. Our wagon is going all
  the way to The Dalles. If you find this, come and say hello!" Clues at Fort Bridger (Ruby) and Fort Hall (Mr. Pete); Sam
  is at The Dalles: his best marble (a card) and a token.
- **The shape** (`QUESTS`, §2.4; the machine, §3.4): an item; how it is found (`via` 'nose' | 'fish' | 'fetch', on which
  legs, optionally at a stop); clue steps (a person at a stop with two lines; steps whose stop is already behind are skipped,
  "heard on the way"); an owner (a person at a stop); a reward (a card, tokens, an optional food gift); the mailed fallback;
  a letter key. A lost glove found by fetch, a letter fished up or a toy found by the nose is one new `QUESTS` entry and its
  sources, nothing else. Each quest runs once a season; its card is new once ever (later returns pay the duplicate token,
  as every card does).

**1.6 Trail facts (ambient history, the owner's addition).** About once a leg, on a quiet day, a short vignette plays on the
scene with a sound, then a card with one true, kid-level fact and the fact's own card for the album (the new suit "Trail
tales"). Each is heard once a season and sourced in `docs/SOURCES.md`; §2.5 has the exact words.
- **Far-off rifles** (the Platte legs: Fort Kearny, Chimney Rock, Fort Laramie): three distant cracks and birds lifting from a
  far line of trees; nobody and no weapon is drawn. In 1847–1853 these are emigrants and traders hunting bison for meat and
  for sport, often far more than they could use; the card says the great hide-hunting years came later (the 1870s), the
  herds nearly vanished, and herds are growing again in parks and on tribal lands.
- **Bison thunder** (after the season's first 1.2 stampede): the rumble, herds in the thousands, "thicker than the stars in
  the sky", wagon trains that stopped and waited for a herd to go by.
- **A grizzly on the ridge** (South Pass, Fort Bridger, Fort Hall legs): a small bear far up on a ridge sniffs the wind; the
  dog gives one deep woof and sits close; the party stays together and gives it room; it ambles away. It never comes nearer
  than the far ridge (the scene smoke checks). Grizzlies once roamed the Great Plains; today, outside Alaska, they live
  mainly in the mountains of Wyoming, Montana, Idaho and Washington.
- **Wolves singing** (a dusk on the plains legs, Fort Kearny to Independence Rock): a far chorus, three tiny silhouettes on a
  ridge against the moon. Gray wolves once followed the bison herds; they were brought back to Yellowstone in 1995.
- **A glow on the prairie** (a dusk on the Kansas River and Fort Kearny legs): an orange band on the far horizon, the party
  snug at camp. Fire is part of the prairie; the deep-rooted grasses grow back green and fast.
- **A pronghorn race** (Chimney Rock to South Pass, Fort Hall, the Snake): three pronghorn run alongside the wagon and zoom
  ahead; they can keep up about forty miles an hour for a long way.
- Not used, on purpose: the Pony Express (1860–61, after the game's seasons); "a mile wide and an inch deep" for the Platte
  (its age could not be traced: Bill Nye printed a version in 1889); trout on the Platte (not native).
Pace: at most one a leg (70 % of the legs that have one left), about 10 s with the card. The four "far-off" facts (rifles,
wolves, the grizzly, the prairie glow) can be turned off by a parent: Parent Zone → Options → "Far-off sounds on the
trail", default on.

**1.7 The kid-rule allowance (recorded because the owner asked for it).** §1 says "no guns" and §9's text rules say "no
weapons beyond the bow". The owner explicitly asked for distant gunfire from bison hunters. The allowance is this and
nothing more: the trail fact `far-off-crack` (and its card) may contain the two exact phrases **`Far-off rifles`** (the
title and the card's name) and **`The far-off crack of rifles beyond the ridge.`** (one sentence of its text), as a sound at
a distance with the party safe. No gun is drawn on the canvas, named in the UI, a toast or a letter, or used by the party;
nobody in the game hunts with anything but the bow; the vignette shows birds lifting, never a shooter. "gun" stays banned
everywhere (and "gunshots" is not used, so no gap in the `\bgun\b` pattern is relied on). Every word of `BANNED` (kill, die,
dead, death, grave, blood, lost, lose, lives, hurry, …) stays banned everywhere, the trail facts included. Both audits gain a
`WEAPONS` check with an exact-phrase allowlist (§7). The meteor shower says "falling star", never "shooting star". Because
the audit walks every string (ids and anchors too), no id, key, anchor or sound name carries a weapon word: the fact is
`far-off-crack`, its vignette and sound `'crack'`. The Parent Zone's switch label (grown-up text, outside both audits, as
the Report is) may name what it turns off.

**1.8 The pace of a leg and the 1.3 economy.**

| New thing | How often | On screen | Optional? |
|---|---|---|---|
| Nose moments | 2–3 a leg, with the dog | a find 0 s stopped (a pop), snake / rabbit / berries ~8 s | no (ambient, ~20 s a leg) |
| Trail fact | ≤ 1 a leg, ~8 a season | ~10 s | no (~7 s a leg on average) |
| Dust devil | ~1 in 3 of the plains and desert legs | ~15 s | no (~3 s a leg on average) |
| Fishing 2.0 | as 1.3 (events, camp) | ~75 s a session (was 45) | yes |
| Fetch, grasshoppers, skipping stones, meteors | at camp and on the river bank | 15–30 s each | yes |
| Quest clues and returns | 5 talks a season | ~12 s each | yes (the Talk row) |

Mandatory additions average about 30 s a leg: a 10–13.5 minute leg in 1.3 is 10.5–14 in 1.4; the economy sim's `SEC`
gains these entries and the first season stays at 12 ± 2 sessions. Rewards, held against the 1.3 `TARGETS` (unchanged):
cash only from horseshoes (about $3 a journey) and the spoon is the one new thing to buy ($3); tokens from the dust devil
(+1, ~0.15 a leg), the two quests (+1 each) and eight new deeds (+1 each, once): under +1 a leg, inside the 3–10 band; food:
fishing's journey mean within 10 % of 1.3's, the berry patch unchanged, Molly's 10 lb once a season. Nothing new gates
anything; nothing can be failed.

### 2. Content schema (`src/content/*`, the Content stream writes; everyone imports)

Five new modules and additions to four. Every shape below is the contract; the Content stream may write more lines but not
change a field name. Rules as §9: `say` is the spoken form (numbers in words, no abbreviations, no digits), kid rules, no
banned word, no weapon word except the two allowed phrases (§1.7). Spoken lines never contain the dog's name: a line that
names the dog is a `DOG_LINES` template (`{dog}`), prepared once the dog is named (§5.6). Text marked **verbatim** is copied
exactly (its facts are sourced, and the audits' allowlist matches it).

**2.1 `src/content/finds.js`** — what the dog brings back, and the wishes.
```js
export const FINDS = [   // 9; `keep`: 'keep' (in the sketchbook and the wagon) | 'sketch' (drawn, left where it lay) | 'use' (used tonight) | 'bait'
  { id: 'horseshoe', name: 'An old horseshoe', emoji: '🐴', keep: 'keep', goods: 'horseshoes', biomes: null, weight: 3,
    text: 'An old horseshoe! The blacksmith at the next fort will buy the iron.', say: '…same…' },
  { id: 'ox-shoe', name: 'A tiny ox shoe', emoji: '🐂', keep: 'keep', biomes: ['prairie', 'bluffs', 'highdesert', 'mountains'], weight: 2,
    text: 'A tiny iron ox shoe. An ox has a split hoof, so it wears two little shoes on each foot.', source: 'SOURCES.md#find-ox-shoe' },   // verbatim
  { id: 'magpie-feather', name: 'A magpie feather', emoji: '🪶', keep: 'keep', biomes: ['bluffs', 'highdesert', 'mountains'], weight: 2,
    text: 'A long black-and-white magpie feather. Magpies are clever birds in the crow family.', source: 'SOURCES.md#find-magpie-feather' },   // verbatim
  { id: 'hawk-feather', name: 'A hawk feather', emoji: '🪶', keep: 'keep', biomes: ['prairie', 'bluffs', 'highdesert'], weight: 2,
    text: 'A soft brown hawk feather with stripes across it.' },
  { id: 'arrowhead', name: 'A stone arrowhead', emoji: '🔺', keep: 'sketch', biomes: ['prairie', 'bluffs', 'highdesert'], weight: 1,
    text: 'A stone arrowhead, shaped by hand long ago by Native people. The party sketches it in the journal and leaves it right where it lay: it belongs to the history of this land.',
    source: 'SOURCES.md#find-arrowhead' },   // verbatim
  { id: 'buffalo-chip', name: 'A buffalo chip', emoji: '🟤', keep: 'use', effect: { spirit: 5 }, biomes: ['prairie', 'bluffs'], weight: 2,
    text: 'A dried buffalo chip! Where there was no wood, travelers burned buffalo chips to cook supper. Tonight it warms the campfire.',
    source: 'SOURCES.md#find-buffalo-chip' },   // verbatim
  { id: 'flat-stone', name: 'A flat skipping stone', emoji: '🪨', keep: 'keep', effect: { skips: 2 }, biomes: null, weight: 2,
    text: 'A perfect flat stone, just right for skipping on the next river.' },
  { id: 'pinecone', name: 'A pinecone', emoji: '🌲', keep: 'keep', biomes: ['mountains', 'gorge', 'valley'], weight: 2,
    text: 'A big, sticky pinecone that smells like the forest.' },
  { id: 'spoon', name: 'A shiny fishing spoon', emoji: '🥄', keep: 'bait', goods: 'spoon', biomes: null, weight: 0.3, rare: true,
    text: 'A shiny fishing spoon! It flashes in the water, and big fish love to chase it.' },
];
export const FIND_BY_ID;
export const WISHES = [{ id: 'oxen-fly', text: 'I wish the oxen could fly.', say: '…' }, …];   // 12, kid-safe, funny; no wish
                                                                                                   // about people being ill, gone or hurt
export const WISH_BY_ID;
```
`biomes: null` means every biome; `weight` is the relative chance among the finds a biome allows (the journey draws); a
find with `goods` adds one to `J.goods[goods]` (the spoon only while `J.goods.spoon` is 0; it is never drawn once owned).

**2.2 `src/content/fish.js`** — the rivers, the fish, the bait and the junk.
```js
export const WATERS = { 'kansas-river': 'kansas', 'fort-kearny': 'platte', 'chimney-rock': 'platte', 'fort-laramie': 'platte',
  'independence-rock': 'sweetwater', 'south-pass': 'sweetwater', 'fort-bridger': 'creek', 'fort-hall': 'bear', 'snake-river': 'snake',
  'blue-mountains': 'blue', 'the-dalles': 'columbia', 'willamette-valley': 'columbia' };          // leg id → water id (the fishing on that leg)
export const WATER_NAMES = { kansas: 'the Kansas River', platte: 'the Platte River', sweetwater: 'the Sweetwater River',
  creek: 'a cold mountain creek', bear: 'the Bear River', snake: 'the Snake River', blue: 'a Blue Mountains creek', columbia: 'the Columbia River' };
export const RIVER_STOPS = ['kansas-river', 'snake-river', 'the-dalles'];   // where the skipping stones are offered after the crossing
export const FISH = [   // 6; sizeIn: the inches the log shows; lb: food from one catch; fight: the reel (see §3.3)
  { id: 'channel-catfish', name: 'Channel catfish', emoji: '🐟', waters: { kansas: 1, platte: 1 },
    sizeIn: [12, 24], lb: [3, 6], fight: { reelS: 2.6, pullPerS: 0.10, wobbleEvery: [1.4, 2.2], wobbleS: 0.7 }, help: false,
    bait: { worms: 1, hoppers: 0.6, spoon: 0.4 }, card: 'channel-catfish', land: { text: 'A channel catfish!', say: 'A channel catfish!' } },
  { id: 'hornyhead-chub', name: 'Hornyhead chub', waters: { sweetwater: 1 }, sizeIn: [4, 8], lb: [2, 4],
    fight: { reelS: 1.4, pullPerS: 0.08, wobbleEvery: [1.6, 2.4], wobbleS: 0.6 }, bait: { worms: 1, hoppers: 1.2, spoon: 0.3 }, card: 'hornyhead-chub', … },
  { id: 'cutthroat-trout', name: 'Cutthroat trout', waters: { creek: 1, bear: 1, snake: 0.6 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, bait: { worms: 0.7, hoppers: 1.2, spoon: 1 }, card: 'cutthroat-trout', … },
  { id: 'white-sturgeon', name: 'White sturgeon', waters: { snake: 0.25, columbia: 0.05 }, sizeIn: [48, 84], lb: [12, 16],
    fight: { reelS: 6.0, pullPerS: 0.06, wobbleEvery: [1.6, 2.4], wobbleS: 0.8 }, help: true, onePerSession: true,
    bait: { worms: 1, hoppers: 0.5, spoon: 0.5 }, card: 'white-sturgeon', … },
  { id: 'redband-trout', name: 'Redband trout', waters: { blue: 1 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, bait: { worms: 0.7, hoppers: 1.2, spoon: 1 }, card: 'redband-trout', … },
  { id: 'chinook-salmon', name: 'Chinook salmon', waters: { columbia: 1 }, sizeIn: [24, 40], lb: [5, 8],
    fight: { reelS: 3.2, pullPerS: 0.12, wobbleEvery: [1.2, 1.8], wobbleS: 0.7 }, bait: { worms: 0.4, hoppers: 0.3, spoon: 1.2 }, card: 'chinook-salmon', … },
];
export const FISH_BY_ID;
export const BAITS = [
  { id: 'worms', name: 'Worms', emoji: '🪱', text: 'Worms: the fish always like them.', unlimited: true },
  { id: 'hoppers', name: 'Grasshoppers', emoji: '🦗', text: 'Grasshoppers: trout and chubs bite sooner, and bigger ones.', max: 12, sizeBias: 0.15, biteSooner: 0.3 },
  { id: 'spoon', name: 'Shiny spoon', emoji: '🥄', text: 'The shiny spoon: big salmon and trout chase it.', keep: true, sizeBias: 0.25 },
];
export const BAIT_BY_ID;
export const JUNK = [   // reels in with no wobbles; `waters` null = any
  { id: 'boot', name: 'An old boot', emoji: '🥾', waters: null, text: 'An old boot! Somebody walked on with one wet sock.', say: '…' },
  { id: 'turtle', name: 'A snapping turtle', emoji: '🐢', waters: ['kansas', 'platte'], release: true,
    text: 'A snapping turtle on the line! It snaps at the air, so you let it go, and it paddles off with a splash.', source: 'SOURCES.md#junk-snapping-turtle' },
  { id: 'bottle', name: 'A bottle with a note', emoji: '📜', waters: ['platte', 'sweetwater', 'creek'], quest: 'bottle-note',
    text: 'A glass bottle bobs up on the line, with a rolled-up note inside!' },
];
export const JUNK_BY_ID;
```
The lb ranges are game numbers (food), tuned so a journey's mean session matches 1.3 (§3.3); the inches are plausible sizes,
not facts read aloud. Fish card facts are in §2.6.

**2.3 `src/content/moments.js`** — the fixed lines of the dog, fetch, fishing and the trail moments.
```js
export const MOMENTS = {
  snake: { text: 'A rattlesnake is sunning on the trail! The wagon stops, everyone gives it room, and it slides away into the grass.', say },
  chase: { good: { text: 'Good dog! Straight back to the wagon.', say }, muddy: { text: 'Back at last, and muddy from nose to tail!', say },
           bath: { text: 'A splash in the creek, and the dog is clean again.', say } },
  fetch: { intro: { text: 'Pull back the stick and let go to throw it.', say }, tired: { text: 'Three throws! The dog flops down by the fire, happy.', say },
           treats: ['One treat.', 'Two treats!', 'Three treats! What a throw!'] },
  hoppers: { intro: { text: 'Grasshoppers in the grass! Tap them to catch bait for fishing.', say }, full: { text: 'The bait tin is full.', say } },
  fishing: { intro, hint: { text: 'Hold to reel. Let go when the line shakes red.', say }, off: { text: 'It wiggled off the hook! Cast again.', say },
             swam: { text: 'It swam off. Next cast!', say }, help: { text: 'A big one! It takes two to land it.', say },
             newSpecies: { text: 'A new fish for the log!', say }, best: { text: 'Your biggest fish yet!', say }, none: { text: 'No bites this time. The river has more.', say } },
  dustDevil: { intro: { text: 'Whoosh! A dust devil spins across the trail, and the hats go flying! Tap the hats to catch them.', say },
               all: { text: 'Every hat caught! What a hat trick.', say }, some: { text: 'The rest of the hats land in the sagebrush, dusty but fine.', say } },
  stones: { intro: { text: 'Smooth water and flat stones: time to skip stones! Tap to throw, then tap each time the stone touches the water.', say },
            best: { text: 'Your best skip yet!', say } },
  meteors: { intro: { text: 'Falling stars! Tap one and make a wish.', say }, end: { text: 'The sky goes quiet. Sweet dreams.', say } },
  dogOffer: { text: 'A dog has been following the wagon since the ferry. Keep it?', say },
};
export const DOG_LINES = {   // templates with {dog}; prepared with the dog's name (§5.6); never contain a banned or weapon word
  found: '{dog} found something!', snake: '{dog} stops short and barks and barks.', chase: '{dog} takes off after a jackrabbit! Tap the name to call {dog} back.',
  fetchFind: '{dog} brings back something that is not the stick!', grizzly: '{dog} gives one deep woof and sits close.',
  splash: '{dog} jumps in after the bobber! Splash! Cast again.', steal: '{dog} grabs a fish off the bank and runs, then brings it back, proud and wet.',
  help: '{dog} grabs the line with both paws!', hats: '{dog} brings back the hats from the sagebrush.', joins: '{dog} joins the party!',
};
```

**2.4 `src/content/quests.js`** — the side quests (the person lines verbatim; they are invented story people, kid rules).
```js
export const QUESTS = [
  { id: 'locket', name: 'The missing locket', card: 'locket', letter: 'quest-locket',
    item: { id: 'locket', name: 'A silver locket', emoji: '📿',
      text: 'Something shiny in the grass by the river: a little silver locket! Inside is a tiny painting of a smiling grandmother, and two letters: M and R.' },
    find: { via: 'nose', legs: ['kansas-river', 'fort-kearny', 'chimney-rock'], atStop: 'kansas-river' },   // atStop: also found when the dog is named there
    steps: [
      { at: 'fort-kearny', person: { id: 'q-platt', name: 'Mrs. Platt', emoji: '👩', role: 'a traveler mending her wagon cover' },
        lines: ['A girl named Molly camped here with her family last week. She kept looking back down the trail, as if she missed something.',
                'They were bound for Fort Laramie. Maybe you will find them there.'] },
      { at: 'chimney-rock', person: { id: 'q-josh', name: 'Josh', emoji: '👦', role: 'a boy sketching the rock' },
        lines: ["Molly Rowe? She rode in the wagon with the blue cover. She told me she dropped her grandma's locket at the Kansas River.",
                'Her family is waiting at Fort Laramie for a new wagon wheel.'] },
    ],
    owner: { at: 'fort-laramie', person: { id: 'q-molly', name: 'Molly Rowe', emoji: '👧', role: 'a girl waiting for a wagon wheel' },
      lines: ['My locket! Grandma gave it to me the day we left home. I was sure it was gone for good.',
              'Thank you, and thank your dog too! Please take this bag of dried apples for the road.'] },
    reward: { tokens: 1, food: { what: 'dried apples', lb: 10 } },
    mailed: { text: 'The post office sends the locket ahead to Fort Laramie, with a note for Molly.' } },
  { id: 'bottle-note', name: 'The bottle note', card: 'marble', letter: 'quest-note',
    item: { id: 'bottle-note', name: 'A note in a bottle', emoji: '📜',
      text: 'The note says: Hello! My name is Sam. Our wagon is going all the way to The Dalles. If you find this, come and say hello!' },
    find: { via: 'fish', legs: ['fort-laramie', 'independence-rock', 'south-pass', 'fort-bridger'] },
    steps: [
      { at: 'fort-bridger', person: { id: 'q-ruby', name: 'Ruby', emoji: '👧', role: 'a girl at the trading post' },
        lines: ['Sam? The boy who plays the harmonica? His family bought flour here and rolled on west.', 'He said he dropped a bottle in the river for luck!'] },
      { at: 'fort-hall', person: { id: 'q-pete', name: 'Mr. Pete', emoji: '🧔', role: 'a wagon driver resting his mules' },
        lines: ['A boy named Sam played his harmonica for us every night by the springs.', 'His family was headed down the Snake River toward The Dalles.'] },
    ],
    owner: { at: 'the-dalles', person: { id: 'q-sam', name: 'Sam', emoji: '👦', role: 'a boy with a harmonica' },
      lines: ['You found my bottle? It floated all that way? That is the best thing ever!', 'I promised a prize in my note. Here is my best marble, the blue one.'] },
    reward: { tokens: 1 },
    mailed: { text: 'The post office sends the note on to The Dalles, with a hello for Sam.' } },
];
export const QUEST_BY_ID;
```
Each person line is spoken as written (no digits). `say` may be given beside `text` / `lines` where the spoken form differs.

**2.5 `src/content/trailFacts.js`** — the ambient history (all of `title`, `text` and the cards' facts **verbatim**).
```js
export const TRAIL_FACTS = [
  { id: 'far-off-crack', far: true, legs: ['fort-kearny', 'chimney-rock', 'fort-laramie'], when: 'day', ambient: 'crack', sound: 'crack',
    card: 'far-off-crack', source: 'SOURCES.md#fact-far-off-crack', title: 'Far-off rifles',
    text: 'Crack! Crack! The far-off crack of rifles beyond the ridge. The wagon is safe and rolls on. Travelers and traders on this trail hunted bison for meat, and sometimes just for sport, and they often took far more than they could use.' },
  { id: 'bison-thunder', far: false, legs: null, when: 'stampede', ambient: null, sound: 'rumble', card: 'bison-thunder', source: 'SOURCES.md#fact-bison-thunder',
    title: 'Bison thunder',
    text: 'A running bison herd makes the ground rumble like thunder. Along the Platte, bison herds numbered in the thousands, and one traveler wrote that they were thicker than the stars in the sky. Sometimes a wagon train had to stop and wait for a herd to go by.' },
  { id: 'grizzly-ridge', far: true, legs: ['south-pass', 'fort-bridger', 'fort-hall'], when: 'day', ambient: 'grizzly', sound: 'wind',
    card: 'grizzly-ridge', source: 'SOURCES.md#fact-grizzly-ridge', title: 'A grizzly on the ridge',
    text: 'Far up on a ridge, a grizzly bear lifts its nose to sniff the wind. The party stops, stays together and gives the bear plenty of room. After a while it ambles away over the hill, and the wagon rolls on.' },
  { id: 'wolf-song', far: true, legs: ['fort-kearny', 'chimney-rock', 'fort-laramie', 'independence-rock'], when: 'night', ambient: 'wolves', sound: 'howl',
    card: 'wolf-song', source: 'SOURCES.md#fact-wolf-song', title: 'Wolves singing',
    text: 'As the sun goes down, a chorus drifts across the plain from far away: wolves, singing to each other. Gray wolves once followed the bison herds across the plains.' },
  { id: 'prairie-glow', far: true, legs: ['kansas-river', 'fort-kearny'], when: 'night', ambient: 'fireglow', sound: 'wind',
    card: 'prairie-glow', source: 'SOURCES.md#fact-prairie-glow', title: 'A glow on the prairie',
    text: 'After dark, an orange glow shines on the far edge of the sky: a prairie fire, many miles away. The party watches from camp, safe and snug.' },
  { id: 'pronghorn-race', far: false, legs: ['chimney-rock', 'fort-laramie', 'independence-rock', 'south-pass', 'fort-hall', 'snake-river'], when: 'day',
    ambient: 'pronghorn', sound: 'hooves', card: 'pronghorn-race', source: 'SOURCES.md#fact-pronghorn-race', title: 'A pronghorn race',
    text: 'A pronghorn races right alongside the wagon, then zooms ahead and leaves everyone in the dust!' },
];   // `say` = text where no digits (all six); `far: true` = turned off by the Parent Zone's "Far-off sounds" switch
export const TRAIL_FACT_BY_ID;
```
`events.js`: the `stampede` event gains `fact: 'bison-thunder'`. Nothing else in `EVENTS` changes.

**2.6 `src/content/cards.js`** — two new suits, 14 cards (40 → 54). `SUITS = ['landmark', 'nation', 'wild', 'companion', 'river',
'tales']`, `SUIT_NAMES.river = 'Fish of the trail'`, `SUIT_NAMES.tales = 'Trail tales'`. A full suit pays its gold crate once, as
every suit. The facts, **verbatim** (`say` with numbers in words):
| id | suit | name | emoji | fact |
|---|---|---|---|---|
| channel-catfish | river | Channel catfish | 🐟 | Channel catfish have whiskers that help them find food in muddy water, and the channel catfish is the state fish of Kansas. |
| hornyhead-chub | river | Hornyhead chub | 🐟 | Hornyhead chubs swam in the Sweetwater River in wagon-train days. They disappeared from it for a long time, and in 2020 scientists brought them back. |
| cutthroat-trout | river | Cutthroat trout | 🐟 | Cutthroat trout are named for the red-orange mark under their jaw, and they are native to the mountain streams west of South Pass. |
| white-sturgeon | river | White sturgeon | 🐟 | The white sturgeon is the biggest freshwater fish in North America, and it can live for more than 100 years. |
| redband-trout | river | Redband trout | 🐟 | Redband trout are rainbow trout of the Columbia River country, with a rosy red stripe along each side. |
| chinook-salmon | river | Chinook salmon | 🐟 | Chinook salmon are the biggest of the Pacific salmon, and people also call them king salmon. |
| far-off-crack | tales | Far-off rifles | 🌄 | In the 1870s, hide hunters took so many bison that the great herds nearly vanished. Today bison herds are growing again in parks and on tribal lands. |
| bison-thunder | tales | Bison thunder | ⛈️ | Bison herds on the plains numbered in the thousands, and a running herd makes the ground rumble like thunder. |
| grizzly-ridge | tales | A grizzly on the ridge | 🐻 | Grizzly bears once roamed the Great Plains. Today, outside Alaska, most grizzlies in the United States live in the mountains of Wyoming, Montana, Idaho and Washington. |
| wolf-song | tales | Wolves singing | 🌕 | Gray wolves once roamed the plains near the bison herds. In 1995 wolves were brought back to Yellowstone National Park, and they live there today. |
| prairie-glow | tales | A glow on the prairie | 🌅 | Fire is part of the prairie. The grasses have deep roots, so after a fire they grow back green and fast. |
| pronghorn-race | tales | A pronghorn race | 💨 | Pronghorn are built for long races: they can keep running at about 40 miles an hour for a long way, not just for a quick dash. |
| locket | tales | Molly's locket | 📿 | You found Molly's locket by the Kansas River and gave it back to her at Fort Laramie. |
| marble | tales | Sam's marble | 🔵 | Sam's best blue marble, his thank-you for the note in a bottle. |
`source` on every river and fact card: `SOURCES.md#fish-<id>` / `SOURCES.md#fact-<id>`; the two quest cards are story cards (no
source). `cardForAnimal` learns `'channel-catfish'`… (each species id maps to its own card; `fish` still maps to `salmon`).

**2.7 Additions to existing modules.**
- `companions.js`: every companion gains `lines.help` (the sturgeon: "Hold on, I've got the rod!" style, one each, in their
  voice).
- `letters.js`: `LETTER_LINES` gains keys (3 lines each, no `{food}`, no weapon words): `nose` (a find), `chase`, `snake`,
  `fetch`, `sturgeon`, `fish-boot`, `quest-locket`, `quest-note`, `dust-devil`, `stones`, `meteors`, `grizzly-ridge`,
  `wolf-song`, `pronghorn-race`. (`far-off-crack` and `prairie-glow` get no letter line, on purpose.) `{dog}` is a new fill
  (the dog's name, journey `letters.js`), so a letter line can say "Frodo found an old horseshoe".
- `people.js`: unchanged (quest people live in `quests.js`, so "People met" still counts the 35).
- `docs/SOURCES.md`: the v1.4 section (written with this SPEC; the Content stream keeps every anchor above pointing at it).

### 3. Journey contract (`src/journey/*`: pure; no DOM, no clock, no storage, no Math.random)

Four new modules, all re-exported from `sim.js` (the app imports only `sim.js`, as today; the scene imports
`fishing.js` directly, §4.3). Randomness: the `rand` passed, else the seeded `J.trip.rng` (`drawFrom(t, 'rng')`), else a
`mulberry32(hashSeed(J.seed, …tag))` named below; the same seed and the same inputs replay the same leg.

**3.0 Constants (`economy.js`, the economy sim tunes them here).**
```js
export const NOSE = { perLeg: [2, 3], from: 0.15, to: 0.92, spacingMi: 25, weights: { find: 0.55, rabbit: 0.25, snake: 0.2 },
  snakeBiomes: ['prairie', 'bluffs', 'highdesert'], unseenBias: 0.7, spirit: 5, chaseLate: 0.8 };
export const FETCH = { throws: 3, at: [0.34, 0.67], treats: [1, 2, 3], itemChance: 0.12, spoonChance: 0.02 };
export const FISHING = { casts: 4, retriesPerCast: 1, strainMaxMs: 500, warnMs: 250, lbCap: 24, lbScale: 1, junkChance: 0.1,
  cameoChance: 0.3, bottleChance: 0.35, hopperMax: 12, helpAt: 0.5, helpSpeed: 2, biteS: [1.3, 3.5] };
export const MOMENTS = { dustDevil: { biomes: ['prairie', 'bluffs', 'highdesert'], chance: 0.35, gapLegs: 1, tokenAll: 1 },
  meteors: { chance: 0.5, gapLegs: 3, stars: 8 }, stones: { throws: 3, maxSkips: 12, startSkips: 1 },
  facts: { chance: 0.7, from: 0.3, to: 0.85 } };
export const HORSESHOE = { price: 1 };                      // × the season's priceMult, sold at any fort store
// EXTRA_GOODS gains { id: 'spoon', name: 'Shiny spoon', unit: 'spoon', emoji: '🥄', price: 3, fromLeg: 2, max: 1 }  (buy refuses a second)
```

**3.1 Save fields** (all on `J`; `ensureJourney` fills each on an older save and sets `J.rev = 14`; nothing in 1.3 moves).
```
J.dog        { name, coat, legs, nextBerries, treats: 0, muddy: false } | null      (1.1's shape + treats, muddy; the journey owns it now)
J.finds      { [findId]: n }                       how many times each find came back (the sketchbook)
J.goods      + horseshoes: n, hoppers: 0..12, spoon: 0 | 1
J.fishLog    { [speciesId]: { n, bestIn, bestLb, firstLeg, firstSeason } }        J.fishJunk { boot, turtle, bottle }   J.fishBest { species, in } | null
J.skips      { best, throws, byRiver: { [legId]: best } }
J.wishes     [wishId]                              J.treatsBest: n (the longest fetch, 0..1, for the Finds page)
J.quests     { [questId]: { state: 'none' | 'carried' | 'returned' | 'mailed', step, foundLeg, season } }      (this season)
J.questsDone [questId]                             ever (the journal's list)
J.factsHeard [factId]                              this season           J.opts.farSounds: true (setTrailSounds)
J.moments    { dustDevilLeg: -9, meteorsLeg: -9 }  the legIndex each last happened (gaps)
J.totals     + noseFinds, chases, chasesCalled, snakes, berries, fetchThrows, treats, fishCaught, fishOff, fishJunk, sturgeon,
               skipThrows, dustDevils, hatsCaught, hatsAll, meteorsTapped, questsDone, factsHeard   (numbers; V14_COUNTERS)
J.trip       + nose: [{ atMile, kind: 'find'|'rabbit'|'snake'|'berries'|'quest', quest?, fired }], fact: { id, atMile, fired } | null,
               dustDevil: { atMile, fired } | null, fishing: n (the sessions this leg, a seed counter), stones: false, meteors: null|bool,
               fetchThrows: 0 (this camp visit; reset by camp() and arrive()), skipBonus: 0 (the flat stone)
```
`newSeason` (through `carry14(prev, next)`, collections.js) keeps: `dog` (muddy cleared), `finds`, `fishLog`, `fishJunk`,
`fishBest`, `skips`, `wishes`, `questsDone`, `treatsBest`, `goods.spoon`, `opts.farSounds`; resets `quests`, `factsHeard`,
`moments` and the rest of `goods` as today. The app's own `carryOver` keeps doing the cards and stops copying the dog (the
journey does it).

**3.2 The dog (`dog.js`).**
```js
dogOfferAt(J, leg) → bool                // no dog, and leg is the Kansas River (the far bank) or a fort with leg.n ≥ 2
adoptDog(J, { name, coat }) → { dog, quest: questId | null }
                                         // J.dog = { name ≤ 12 chars, coat, legs: 0, nextBerries: 1, treats: 0, muddy: false };
                                         // quest: a quest whose find.atStop is this leg's stop and is findable: it is found now
                                         // (findQuestItem) and its item comes back to show the card
planNose(J, leg, rand) → [{ atMile, kind, quest? }]      // startLeg calls it when J.dog: perLeg 2 or 3 slots at evenly spread,
                                         // jittered miles in [from, to] × miles, ≥ spacingMi apart; slot 1 = 'quest' when
                                         // questFindable(J, 'nose') on this leg; one 'berries' slot when dog.legs ≥ nextBerries
                                         // (then nextBerries = legs + 2); the rest by NOSE.weights (snake only in snakeBiomes;
                                         // ≤ 1 rabbit, ≤ 1 snake). No dog: [].
drawFind(J, leg, rand, { fromFetch }) → findId       // weighted by FINDS[].weight among the leg's biome; unseen finds first
                                         // with unseenBias; the spoon only while goods.spoon is 0 (and only fromFetch at
                                         // FETCH.spoonChance or the nose's rare weight)
recordFind(J, findId) → { id, first: bool, n, goods?: { id, n }, effect?: { spirit?, skips? } }
                                         // J.finds[id]++, goods added, effects applied (spirit capped at MOOD.max; skips: J.trip.skipBonus)
chaseResult(J, { called, dist }) → { muddy, line: 'good' | 'muddy', card: 'jackrabbit' }
                                         // called && dist < NOSE.chaseLate → not muddy; else J.dog.muddy = true; spirit +NOSE.spirit
                                         // either way; totals.chases / chasesCalled
fetchThrow(J, { dist, rand }) → { treats, item: findId | null, first?: bool, spoon?: bool, left }
                                         // treats by FETCH.at; item at FETCH.itemChance (drawFind fromFetch, recordFind);
                                         // J.dog.treats += treats; J.treatsBest max dist; ≤ FETCH.throws a camp visit (then
                                         // { treats: 0, left: 0 } and nothing changes)
sellHorseshoes(J, { leg }) → { n, cash }  // at a fort: all J.goods.horseshoes for HORSESHOE.price × priceMult each
```
`arrive(J)` and `camp(J, …)` clear `J.dog.muddy` (and return `bath: true` when they did); `arrive` adds 1 to `J.dog.legs`
(the app's 1.1 increment in `finishLeg` goes).

**3.3 Fishing 2.0 (`fishing.js`, imported by the scene too: no imports beyond `../content/fish.js`, `../content/quests.js`,
`./rng.js`, `./economy.js`).**
```js
waterOf(legOrJ) → waterId                 // WATERS[leg.id], 'kansas' by default
baitsAvailable(J) → [{ id, n?, ok }]      // worms always; hoppers with n; spoon when owned
catchHoppers(J, n) → { added, have }      // the grasshopper game's catch, up to hopperMax
fishingSession(J, { bait = 'worms', rescue = false, rand } = {}) → session
// session = { id, water, waterName, bait, rescue, casts: [cast × FISHING.casts], cameo: { at, kind: 'splash'|'steal' } | null }
// cast = { i, kind: 'fish' | 'junk', species?, junk?, lengthIn?, lb?, biteS, fight: { reelMs, pullPerMs, wobbles: [[startMs, endMs]],
//          strainMaxMs, warnMs, help: bool, helpAt }, retries: 0 }
// Species drawn by FISH[].waters[water] × bait weight; the sturgeon at most once a session; junk at junkChance (the turtle only in
// its waters; the bottle when questFindable(J, 'fish') at bottleChance, else not); sizes with the bait's sizeBias; lb by species ×
// lbScale; hoppers consumed one a cast at plan time (casts beyond the tin fall back to worms); seeded by J.seed, the leg, the day
// and trip.fishing (incremented); wobbles laid out from the species' wobbleEvery / wobbleS over a generous horizon.
createFight(fight) → state                // { t: 0, progress: 0, strain: 0, phase: 'reel', wobble: false, warn: false, helped: false, ... }
fightStep(state, dtMs, down) → state      // pure, deterministic, returns a new state:
//   phase 'help' changes nothing until fightHelp; t += dt; wobble = t inside a wobble window; warn = a window starts within warnMs
//   down: progress += dt / reelMs (× helpSpeed once helped); in a wobble strain += dt, else strain = max(0, strain − dt / 2)
//   up:   progress = max(0, progress − pullPerMs × dt); strain = max(0, strain − dt)
//   strain > strainMaxMs → phase 'off' · help && !helped && progress ≥ helpAt → phase 'help' · progress ≥ 1 → phase 'landed'
//   there is no other phase: nothing snaps, nothing is ever lost
fightHelp(state) → state                  // 'help' → 'reel', helped true
castOff(J, session, i) → { retry, fight? } // a fish wiggled off: retry once a cast (cast.retries < retriesPerCast) with a fresh fight (for scene.fishingRetry)
landCast(J, session, i) → { kind, species?, junk?, lengthIn?, lb, firstSpecies, best, card?, quest?, released? }
// a fish: logged (fishLog n / bestIn / bestLb / firstLeg; fishBest), lb counted toward the session (the cap), totals.fishCaught,
// sturgeon; firstSpecies → card (the species' card id) for the app to award; junk: fishJunk++, the bottle → findQuestItem
endFishing(J, session) → { lb, topUp, caught: [{ species, lengthIn }], junk: [id], newSpecies: [id], best: bool, summary: { text, say } }
// applies the food once (applyFish with the session's lb, capped at lbCap; rescue tops up to RESCUE.minLb as today); idempotent
fightOutcome(fight, presses) → { phase, progress, ms }   // runs fightStep over [{ atMs, down }] — the tests' and the mock's helper
familyRecords(players) → { [speciesId]: { name, playerId, lengthIn } }, skipsBoard(players) → [{ name, playerId, best }]
// players = [{ playerId, name, J }] (the app reads the family's saves); pure; ties keep the earlier player
```
The summary's text is built from fixed parts so it can be prepared just in time (`summary.say`, §5.6).

**3.4 Quests (`quests.js`).** One state machine for every quest.
```
none --(found: the nose slot, adoptDog at find.atStop, a fishing junk 'bottle', a fetch item)--> carried (step = first step whose stop is ahead)
carried --(questTalk at a step's stop)--> carried (step + 1)        steps whose stop is behind are skipped ("heard on the way")
carried --(questTalk at the owner's stop, any step)--> returned     reward: tokens, food (addFoodKind 'other'), the card id for the app
carried --(questMail at a post office after the owner's stop)--> mailed   the card id; no tokens, no food
```
```js
useQuests(list) / questList()             // the table (tests inject a synthetic 'glove' quest found by fetch to prove the shape)
questFindable(J, via) → questId | null    // state 'none' this season, find.via === via, the current leg in find.legs, the owner's stop ahead
findQuestItem(J, id) → { quest, item } | null
questAt(J, stopId) → [{ questId, role: 'clue' | 'owner', person, lines, badge: '❓' | '💛' }]   // for the Talk row
questTalk(J, id) → { role, lines, step, of, done: bool, reward?: { tokens, food?, card } }       // advances; idempotent per step
questMail(J, { leg }) → [{ questId, text, card }]   // at a fort's post office: carried quests whose owner's stop is behind
questStatus(J) → [{ questId, name, state, item, step, of, owner }]   // the journal (this season) + questsDone
```
`happenedKeys` (journey `letters.js`) adds the quest's `letter` key on the leg it was returned or mailed.

**3.5 Trail moments and trail facts (`moments.js`).**
```js
setTrailSounds(J, on) → bool              // J.opts.farSounds; off: facts with far: true are never planned
factsFor(J, leg) → [factId]               // when 'day' | 'night', the leg in legs, not heard this season, allowed by farSounds
planFact(J, leg, rand) → { id, atMile, fired: false } | null    // startLeg: MOMENTS.facts.chance, the first of factsFor in content
                                                                 // order, at a mile in [from, to]
heardFact(J, id) → { card, first: bool }  // factsHeard, totals; the card id for the app (awardCard pays a dup token as usual)
stampedeFact(J) → factId | null           // 'bison-thunder' when not heard this season (stampedePay's result carries it as `fact`)
planDustDevil(J, leg, rand) → { atMile, fired } | null           // biomes, chance, not the leg right after the last one
dustDevilResult(J, { caught, of }) → { all, tokens }             // all caught (of ≥ 1): +tokenAll; totals; moments.dustDevilLeg
stonesPlan(J) → { throws, bonus }         // bonus = trip.skipBonus (the flat stone), then cleared
stonesResult(J, { throws: [skips…] }) → { best, newBest, byRiver }   // J.skips; at most once a stop / once a leg at camp (trip.stones)
campWater(J) → { water, name, river: bool }      // river true where the leg's water is a river (not the creeks): camp's stones card
meteorsTonight(J) → bool                  // the arrival evening only: clear forecast, chance, gapLegs, not the last leg; decided once
                                          // per arrival (trip.meteors)
wishFor(J, rand) → { id, first }          // a wish not yet in J.wishes (else a repeat, first false); J.wishes
```

**3.6 What `tickDay` emits (new fields; all others unchanged).**
```
{ …1.3 fields…, nose: null | { kind, find?: { id, first, n, goods?, effect? }, quest?: { id, item }, foodLb?, card? },
  fact: null | { id, night: bool, ambient, sound }, moment: null | { kind: 'dustDevil' } }
```
One thing a day, in this order: the marker, the event (planned or the safety net), then the first due nose slot, then the
fact, then the dust devil. A due thing that is blocked waits for the next free day; none fires on the arrival day or past
`NOSE.to` of the leg (an unfired one is dropped, never carried to the next leg). The nose is applied by `tickDay` itself
(a find recorded, berries' food added, the snake's spirit, the quest found) so a reload loses nothing; the rabbit's outcome
waits for `chaseResult`. A `night` fact asks the app for a dusk sky. The last leg (the raft) has no trail days, so none of
these. `stampedePay` returns `fact: 'bison-thunder' | null` beside its cash.

**3.7 Sync (`collections.js`: `merge14(s, o)`, called by the app's `mergeWw`).** Both sides normalized; `s` is the later doc.
When both have a journey: `finds` per id max · `fishLog` per species: n max, the bigger `bestIn` with its lb / leg · `fishJunk`
per kind max · `fishBest` the bigger · `skips.best`, `skips.throws` max, `byRiver` per key max · `wishes` and `questsDone`
union · `treatsBest` max · `dog`: 1.1's rule (the later doc's, else the other's), then `treats` max · and, when it is the same
journey (season + seed): `quests` per id the further state (none < carried < mailed < returned; `step` max), `factsHeard`
union, `goods.spoon` max. Everything else stays the later doc's, as 1.3.

**3.8 Deeds (`deeds.js`, +8, each +1 token once).** `good-nose` (the dog brings back six different finds), `fetch-champ` (25
treats), `big-one` (land a white sturgeon), `river-guide` (all six fish species), `skipper` (seven skips in one throw),
`keeper` (return a quest item to its owner), `wish-maker` (six wishes), `hat-trick` (catch every hat in a dust devil). Each
`{ id, name, emoji, how, say }` as 1.2; checked by `checkDeeds` from the counters above.

### 4. Scene contract (`src/scene/*` and `src/meta/mockScene.js`: presentational; the app drives, the journey decides)

Additions to the engine's API (names fixed; the 1.0–1.2 API is unchanged, `startFish` included, so nothing old breaks).
Mini-games own the pointer and Space while they run (as the hunt); vignettes do not (the day loop waits for them).
`endMiniGame()` ends any of the new mini-games (no event, the summary so far). Every new kind is in `getState().mini` with
`{ kind, phase, … }` while it runs. Reduced motion: no shake, fewer particles, steady signs; the timings stay the same.

**4.1 The dog on the trail (vignettes, ~2–6 s each).**
```
scene.setParty({ …, dog: { name, coat, muddy } | null })          muddy: the mud overlay (spots, a darker coat, a little drip)
scene.dogRun(kind = 'find' | 'berries' | 'quest', { emoji })      the dog dashes off-screen (left or right, seeded by the call
                                                                  count) and trots back with the emoji in a bubble → { type: 'dogBack', kind }
scene.dogWarn()                                                   the dog plants and barks (two barks), the wagon halts, a small
                                                                  cartoon snake (no fangs, no strike) slides off into the grass → 'dogWarnEnd'
scene.startChase({ seed })                                        the dog runs after a jackrabbit toward the horizon (4.5 s to a
                                                                  dot), the wagon rolling; no pointer
scene.chaseCall() → true | false                                  (the app's name button) the dog skids round and trots back
   events: { type: 'chase', dist } at the call · { type: 'chaseEnd', called, dist }  (dist 0..1 how far he had run; 1 = he came
   back on his own; the app then calls setParty with muddy when the journey says so)
scene.ambient(kind = 'crack' | 'grizzly' | 'wolves' | 'fireglow' | 'pronghorn')   a 5–6 s vignette over the trail → { type: 'ambientEnd', kind }
   crack: a far tree line, a flock of birds lifting; nothing else drawn · grizzly: a small bear silhouette (≤ 7 % of the
   height) on the far ridge band (its feet above 45 % of the height), sniffing, then ambling off the far side; never nearer;
   the dog's woof pose · wolves: dusk, the moon, three tiny howling silhouettes on a far ridge · fireglow: dusk, a soft orange
   band along the horizon, no flames · pronghorn: three pronghorn run alongside the wagon, then zoom ahead
```
**4.2 Camp and river mini-games.**
```
scene.startFetch({ seed, throws: 3 })          the camp at dusk; drag back from the stick (pointer down near it, drag, release),
                                               or hold Space to wind up; a dotted ghost arc while dragging
   → { type: 'fetchThrow', n, dist }           (0..1 of the field) the stick lands; the dog waits for:
scene.fetchBring({ item: 'stick' | 'find', emoji }) → true      the dog runs out and back (≤ 2.5 s) → { type: 'fetchBack', n }
   → { type: 'fetchEnd', throws, best }        after the last return, the dog flops down by the fire
scene.startHoppers({ seed, n: 6 })             grasshoppers hop through the grass, a few at a time; tap one to catch it; each
                                               hops off the far edge if not caught (no timer drawn) → { type: 'hopper', caught }
   → { type: 'hoppersEnd', caught }
scene.startStones({ seed, throws: 3, bonus: 0 })   the river backdrop, the far bank; tap to throw, then tap as the stone kisses
                                               the water (a ring flashes; the window ±180 ms) to keep it skipping; a missed
                                               kiss: it sinks with a plunk; starts with startSkips + bonus free skips
   → { type: 'skip', n } per skip · { type: 'stone', throw, skips } per throw · { type: 'stonesEnd', throws: [skips…], best }
scene.startMeteors({ seed, n: 8 })             the camp at night, a clear sky; falling stars streak across (slow, long trails,
                                               a generous hit box); tap one → { type: 'meteor', n }; → { type: 'meteorsEnd', tapped, of }
scene.startDustDevil({ seed, hats: [{ id, hat, color }] })      on the trail; a dust column crosses; the hats fly up and tumble
                                               down along seeded arcs (≥ 1.4 s each in reach); tap one → it drops back on its
                                               owner → { type: 'hat', id, caught: true }; one that lands → { type: 'hat', id,
                                               caught: false } → { type: 'dustDevilEnd', caught, of }
```
**4.3 Fishing 2.0.**
```
scene.startFishing({ seed, water, bait, casts: session.casts, cameo: session.cameo, helper: { id, hat, color } | null, dog: bool })
```
The pool painted for the water (muddy brown for the Kansas and the Platte, clear for the creeks, blue-green for the Snake and
the Columbia). Per cast: the 1.0 cast, the wait (`cast.biteS`), the dip window (1.15 s, as 1.0): tapped → **the fight**, run
by the journey's pure stepper: the scene imports `createFight`, `fightStep`, `fightHelp` from `../journey/fishing.js` and calls
`fightStep(state, dtMs, down)` every frame with the pointer / Space state (it never decides a fight itself). It draws the line
(taut, calm), the yellow shiver when `state.warn`, the red wobble when `state.wobble`, the fish nearing the bank with
`state.progress`, the reel turning while down; `phase 'help'`: the helper's portrait pops up by the bank (a 96 px target; a
tap or Enter → `fightHelp`) or the dog when `helper` is null; `phase 'off'`: the fish flips and swims off with a splash ("IT
WIGGLED OFF!"); `phase 'landed'`: it flops on the bank, "GOT ONE!" with the species' name. A junk cast's fight has no
wobbles: the boot dangles, the turtle snaps at the air and plops back, the bottle bobs up. The cameo at cast `cameo.at`: a
splash (the dog leaps in, the cast resets) or a steal (after the landing: the dog runs off with the fish and brings it back).
Events:
```
{ type: 'fishHook', i } · { type: 'fishMiss', i } (the dip missed: the cast is used) · { type: 'fishPhase', i, phase }
{ type: 'fishHelp', i } · { type: 'fishHelped', i } · { type: 'fishOff', i } (the app asks castOff → scene.fishingRetry(i, fight) or not)
{ type: 'fishLand', i } (the app asks landCast) · { type: 'fishCameo', i, kind } · { type: 'fishingEnd', landed, casts }
scene.fishingRetry(i, fight) → true          the same cast again with the new fight (from castOff's session)
scene.fishingHelp() → true | false           the help tap from outside the canvas (the keyboard, the app's test hook)
```
**4.4 Mock scene (`?mock=1`, `src/meta/mockScene.js`): the same API, scripted and instant-ish (every step `shotMs` apart),
driven by `window.__mockScript`:**
```
dogRun / dogWarn / ambient → their end events after shotMs (ambient: 2 × shotMs)
chase: 'call' (default: chaseEnd { called: true, dist } after the app's chaseCall(); with no call by 6 × shotMs, { called:
       false, dist: 1 }) | 'late' (the mock ignores chaseCall until 6 × shotMs, then { called: true, dist: 0.9 })
fetch: [0.2, 0.5, 0.9]   the throws' dists (default); each fetchThrow, then fetchBack after fetchBring, then fetchEnd
hoppers: 4               caught of n (default 4)
stones: [3, 5, 2]        skips per throw (default); a bonus adds to the first
meteors: 5               tapped of 8 (default 5)
hats: 'all' | n          caught (default 'all')
fishing: [{ hook: true, fight: 'land' | 'off' | 'help' }, …]   per cast (default: every cast hooked and landed); the mock runs
       the real fightStep with a scripted press pattern ('land' = held except during wobbles, 'off' = held throughout, 'help'
       = as 'land' and it waits at the help phase for fishingHelp()); cameo as the session says
```
`getState().mini` carries `{ kind, phase, … }` for each (fishing: `{ kind: 'fishing', cast, phase, progress, wobble, warn }`).
`dev.html`: `?fishing=snake&bait=spoon`, `?fetch=1`, `?stones=1`, `?meteors=1`, `?dust=1`, `?ambient=grizzly`, `?chase=1`; keys.

### 5. App contract (`src/main.js`, `src/ui/*`, `src/meta/{voiceTexts,sfx,save,sync}.js`, `index.html`, `sw.js`)

**5.1 The trail day.** `afterDay` handles, after the marker and the event: `res.nose` — 'find' / 'berries' / 'quest':
`S('dogRun', kind, { emoji })`, then on 'dogBack' the find pop (`ui/finds.js` `createFindPop`, the card pop's look, its
line said `later`, a "New!" ribbon on a first find; berries: 1.1's card text, now `MOMENTS` + the plum card; quest: the
item's card, kicker "<dog> found something!" (a title, not spoken), button "Keep it safe"); 'snake': `S('dogWarn')` + a card
(title "<dog> barks a warning!", text `MOMENTS.snake`, button "Good dog!") + the rattlesnake card; 'rabbit': the big name
button `#dog-call` (≥ 64 px, "🐕 Frodo!", the line `DOG_LINES.chase`), `S('startChase')`, a tap → `S('chaseCall')`, on
'chaseEnd' → `JA.chaseResult` → an effect toast (`MOMENTS.chase.good` / `.muddy`), `applySceneParty()` (muddy), the jackrabbit
card. `res.fact` → `S('ambient', fact.ambient)` with a dusk sky for a night fact, `Sfx.ambient(fact.sound)`, then on
'ambientEnd' a card (kicker "Along the trail", the fact's title and text, said; button "Wow"), `dropCard(JA.heardFact().card)`;
the grizzly adds `DOG_LINES.grizzly` as a toast when there is a dog. `res.moment` 'dustDevil' → an intro card, the mini bar
("Tap the hats!", "Skip"), `playMini('startDustDevil', { seed, hats })`, `JA.dustDevilResult`, the toast and, on all caught, the
token pop. The 1.1 `dogBerriesDue` / `dogBerries` and the `J.dog.legs` increment in `finishLeg` are removed (the journey does
both); `window.__wagonWest.dogBerries` becomes `playNose('berries')`.
**5.2 The stampede** ends (1.2 flow unchanged) with the 'bison-thunder' card when `stampedePay(...).fact` is set.
**5.3 The stops.** The Kansas River: after the crossing, `JA.dogOfferAt` → the dog offer (`MOMENTS.dogOffer`), the namer, then
`JA.adoptDog` (and the locket card when it returns a quest); the fort stores keep 1.1's offer for a child who said "Not now".
At every river stop (`RIVER_STOPS`), after the crossing: a card "Skip stones?" (button "Skip stones", alt "On we go") →
`playMini('startStones', JA.stonesPlan(J))` → `JA.stonesResult` → "Your best skip yet!" or the count. The Talk row
(`ui/people.js`) also shows `JA.questAt(J, stopId)` portraits with their badge; a tap runs `JA.questTalk` (a card with the
two lines, said; on 'returned' the reward: `dropCard`, the token pop, "+10 lb of dried apples"). The post office:
`JA.questMail(J, { leg })` → a card per mailed item before the letter. The store (`ui/store.js`): the spoon row (from Fort
Kearny, once) and, while `goods.horseshoes > 0`, "Sell old horseshoes to the blacksmith: $N" (`JA.sellHorseshoes`).
**5.4 Camp (`ui/camp.js`).** New cards: **Fetch** (with the dog; `playMini('startFetch')`, each 'fetchThrow' →
`JA.fetchThrow` → `S('fetchBring', …)`, the treat toast, a find pop for an item; no day), **Catch grasshoppers** (when fishing
is offered and the tin is not full; `startHoppers` → `JA.catchHoppers`; no day), **Skip stones** (once a leg, when
`JA.campWater(J).river`; no day), **Falling stars** (the arrival evening when `JA.meteorsTonight(J)`; `startMeteors`, each
'meteor' → `JA.wishFor` → a small wish card pop; no day). **Fishing** becomes Fishing 2.0 (a day, as 1.3): the bait row on the
mini bar (three big buttons, the counts), `JA.fishingSession`, `playMini('startFishing', …)` with the session, the events
routed to `castOff` / `landCast` (`scene.fishingRetry`), the bar's hint `MOMENTS.fishing.hint`, the helper's name on the bar
during 'fishHelp' (not spoken), text-only toasts in the session, then `JA.endFishing` → the spoken summary card, the species
card for a first catch, the deed check. The trail's fish events run the same session (`rescue` when the event is the safety
net). Camp's visit also clears the mud (`camp()` returns `bath`: `MOMENTS.chase.bath`).
**5.5 The journal (`ui/journal.js`, two new pages: 7 tabs, wrapping to two rows in portrait, no overflow).**
- **Finds** (`ui/finds.js` `findsPage(app)`): the dog's sketchbook (nine drawings, faint until found, "found 3 times", the
  arrowhead drawn with "left where it lay"), the treat jar, the wishes (cards with their text), the quests (`JA.questStatus`:
  "The missing locket: given back to Molly at Fort Laramie", "carried: a clue at the next fort", one line each).
- **Fish log** (`ui/fishLog.js` `fishLogPage(app)`): six species (faint until caught), each with n, the biggest, where first
  caught; the crown on the personal best; River oddities; **Family records** (`JA.familyRecords` over the family's saves,
  first names) and **Skipping stones** (`JA.skipsBoard`), both hidden for a family of one.
- The Cards page shows the two new suits like the others (the album's "7 of 12").
**5.6 The voice (v1.3.2 rules, `meta/voiceTexts.js`).** `collectVoiceTexts` gains `dogName` (`J.dog.name` when there is one)
and adds, in its groups: `first` — `MOMENTS`' lines, the bait lines, the fishing lines, `DOG_LINES` filled with the dog's name;
`leg` — this leg's quest people (`questTexts(stopId)`: every step's and the owner's lines, the item's text, the mailed line),
this leg's trail facts (`factTexts(legId)`), the finds of this leg's biome, the fish of this leg's water (their landing lines
and cards); `rest` — every `FINDS` / `JUNK` / `WISHES` / `TRAIL_FACTS` / new cards / new deeds / every quest's lines /
companions' `help` lines / the new letter lines. Just in time (listed in the header with the others): the fishing summary
(it has counts and pounds), a catch with its size in inches, the treat counts, the skip count, the horseshoe sale. The
content-audit's independent walk covers the new modules (§7.4).
**5.7 Sound (`meta/sfx.js`).** `Sfx.ambient(kind)` with 'crack' (three far, soft, low-passed cracks with a long echo: quieter
than the bugle), 'rumble', 'howl' (three overlapping sine glides, far), 'wind', 'hooves'; and `Sfx.splash()`, `Sfx.reel(on)`
(a soft click loop while reeling), `Sfx.wobble()`, `Sfx.skip()`, `Sfx.plunk()`, `Sfx.twinkle()` (a wish), `Sfx.whoosh()` (the
dust devil), `Sfx.snap()` (the turtle: a cartoon "clack"). All through the music duck; Sound off silences them.
**5.8 The Parent Zone.** Options: "Far-off sounds on the trail (rifles, wolves, a bear on a ridge, a prairie fire)": On / Off
(`settings.farSounds`, default on → `JA.setTrailSounds(J, on)` on load and on change). Report: one "Trail fun" line (finds of
nine, fish species of six, the biggest fish, best skips, quests given back) — parent-facing, no new chart. Journey → Reset
resets these with the journey.
**5.9 The family map** (title): unchanged except a small 🐕 beside a family wagon whose journey has a dog. The records boards
live in the journal (§5.5).
**5.10 Save and sync.** `save.js`: no new top-level fields (everything is on `J`); `normalize` keeps an older journey for
`ensureJourney` to fill. `sync.js` `mergeWw`: after its 1.3 rules, `merge14(s.journey, o.journey)` (journey `collections.js`).
`settings.farSounds` is device-local, like `hunting`.
**5.11 Test hooks (`window.__wagonWest`).** `playNose(kind, findId?)`, `playFact(id)`, `playMoment('dustDevil')`,
`fishNow({ bait, water? })` (a fishing session on an idle trail or camp), `jumpLeg(legId)` (tests only: start that leg, for the
Snake's sturgeon and The Dalles' Sam), `get fun()` → `{ dog, finds, fishLog, quests, skips, wishes, factsHeard }`;
`playEvent` unchanged. VERSION `1.4.0`, sw `wagon-west-v1.4.0`, README "1.4".

### 6. Streams and file ownership (four Sonnet agents, built at once from the same commit, no talking)

Never touch another stream's files; never touch `car-jump/`, `spell-jump/`, `trail-blazer/`, `fraction-fright/`,
`build-crew/`, `site/`, `build.sh`, `netlify.toml` (the orchestrator does those). The shapes in §2–§4 are the contract: code
against them, not against another stream's work in progress. Where a stream needs another's module before it exists, it
codes defensively (`typeof JA.x === 'function'`, as the 1.2 app did) and its tests SKIP with a line, never fail, on a missing
export.

| Stream | Owns | Provides (exact exported names) | Consumes |
|---|---|---|---|
| **Content** | `src/content/*` (new `finds.js`, `fish.js`, `moments.js`, `quests.js`, `trailFacts.js`; `cards.js`, `events.js`, `companions.js`, `letters.js`), `docs/SOURCES.md` (keeps the v1.4 anchors), `docs/LEARNING-DESIGN.md` (one paragraph: pure play, and why) | `FINDS`, `FIND_BY_ID`, `WISHES`, `WISH_BY_ID` · `WATERS`, `WATER_NAMES`, `RIVER_STOPS`, `FISH`, `FISH_BY_ID`, `BAITS`, `BAIT_BY_ID`, `JUNK`, `JUNK_BY_ID` · `MOMENTS`, `DOG_LINES` · `QUESTS`, `QUEST_BY_ID` · `TRAIL_FACTS`, `TRAIL_FACT_BY_ID` · `SUITS` (+ 'river', 'tales'), `SUIT_NAMES`, the 14 cards · `EVENT_BY_ID.stampede.fact` · `COMPANIONS[].lines.help` · the new `LETTER_LINES` keys | nothing (plain data) |
| **Journey** | `src/journey/*` (new `dog.js`, `fishing.js`, `quests.js`, `moments.js`, `collections.js`; `sim.js`, `economy.js`, `deeds.js`, `letters.js`, `events.js`), `tools/journey-tests.mjs`, `tools/economy-sim.mjs` | from `sim.js`: `dogOfferAt`, `adoptDog`, `planNose`, `drawFind`, `recordFind`, `chaseResult`, `fetchThrow`, `sellHorseshoes` · `waterOf`, `baitsAvailable`, `catchHoppers`, `fishingSession`, `createFight`, `fightStep`, `fightHelp`, `fightOutcome`, `castOff` (→ `{ retry, fight? }`), `landCast`, `endFishing`, `familyRecords`, `skipsBoard` · `useQuests`, `questList`, `questFindable`, `findQuestItem`, `questAt`, `questTalk`, `questMail`, `questStatus` · `setTrailSounds`, `factsFor`, `planFact`, `heardFact`, `stampedeFact`, `planDustDevil`, `dustDevilResult`, `stonesPlan`, `stonesResult`, `campWater`, `meteorsTonight`, `wishFor` · `carry14`, `merge14` · `NOSE`, `FETCH`, `FISHING`, `MOMENTS` (economy), `HORSESHOE` · `tickDay` (+ nose / fact / moment), `stampedePay` (+ fact), `arrive` / `camp` (+ bath), `newSeason` (carry14), `DEEDS` (+8); and `src/journey/fishing.js` importable on its own (the scene) | the content names above |
| **Scene** | `src/scene/*` (engine.js; new `dog14.js`, `fishing2.js`, `camp14.js`, `ambient.js` as it likes), `src/meta/mockScene.js`, `dev.html`, `tools/scene-smoke.mjs` | `setParty` (dog.muddy), `dogRun`, `dogWarn`, `startChase`, `chaseCall`, `ambient`, `startFetch`, `fetchBring`, `startHoppers`, `startStones`, `startMeteors`, `startDustDevil`, `startFishing`, `fishingRetry`, `fishingHelp`, `endMiniGame` (all new kinds), `getState().mini` kinds; events `dogBack`, `dogWarnEnd`, `chase`, `chaseEnd`, `ambientEnd`, `fetchThrow`, `fetchBack`, `fetchEnd`, `hopper`, `hoppersEnd`, `skip`, `stone`, `stonesEnd`, `meteor`, `meteorsEnd`, `hat`, `dustDevilEnd`, `fishHook`, `fishMiss`, `fishPhase`, `fishHelp`, `fishHelped`, `fishOff`, `fishLand`, `fishCameo`, `fishingEnd`; the mock's `__mockScript` keys (§4.4) | `createFight`, `fightStep`, `fightHelp` from `src/journey/fishing.js`; the session / cast shape (§3.3) as data |
| **App** | `src/main.js`, `src/ui/*` (new `finds.js`, `fishLog.js`), `src/meta/voiceTexts.js`, `src/meta/sfx.js`, `src/meta/save.js`, `src/meta/sync.js`, `index.html`, `sw.js`, `README.md`, `tools/ui-smoke.mjs`, `tools/sync-smoke.mjs`, `tools/content-audit.mjs` (the `WEAPONS` check, its allowlist, the voice walk of the new content) | the flows §5; `collectVoiceTexts({ …, dogName })`, `questTexts`, `factTexts`, `funTexts`, `dogTexts`; `Sfx.ambient` and the new sounds; `findsPage`, `createFindPop`, `fishLogPage`; the `window.__wagonWest` hooks (§5.11); VERSION 1.4.0 | everything above |

`src/meta/speech.js`, `src/meta/music.js`, `src/meta/selfUpdate.js` and `src/journey/problems.js` are not changed by anyone.
Merge order for the orchestrator: content, journey, scene, app (each one's suites pass on its own branch with SKIPs; all pass
together after the merge). Commit "Wagon West 1.4: Frodo and the river"; hold the push for Matt.

### 7. Tests and acceptance

**7.1 `tools/journey-tests.mjs` (node, no DOM)** proves: no dog → no nose slots, ever; with a dog, 2–3 slots a leg over
1,000 seeded legs (both counts occur), ≥ 25 miles apart, none past 92 % of the leg; across a journey, never two of
{marker, event, nose, fact, moment} on one day, and nothing on the arrival day; the berry patch on the first leg after the dog joins and every other leg after (1.1's
rhythm, now the journey's); ≤ 1 rabbit and ≤ 1 snake a leg, the snake only in its biomes; finds only of the
leg's biome, the spoon never while owned, the arrowhead `keep: 'sketch'` never adds goods; `chaseResult` never takes
anything away (food, cash, goods, cards equal before and after), muddy cleared by `arrive` and `camp`; `fetchThrow` treats
at the thresholds, ≤ 3 a visit, items ≈ 12 % over 10,000 throws, no day passes; fishing: species only from the water's table,
the sturgeon only on 'snake' / 'columbia' and ≤ 1 a session, the turtle only on 'kansas' / 'platte', the bottle once a season
and only while its quest is 'none'; `fightStep`: deterministic (same inputs, same states); holding through every wobble ends
'off'; releasing in every red window (pressing 100 ms after each window ends) ends 'landed'; never any phase but reel / help /
off / landed; a sturgeon stops at `helpAt` until `fightHelp`; an 'off' cast is retried once and only once; a session's food ≤
24 lb; a rescue session ≥ 30 lb; the economy kid's mean session food (60 % hooked, 85 % of fights landed) is within 10 % of
1.3's 9.6 lb; the log's personal best and `fishBest` follow the biggest inches; `familyRecords` / `skipsBoard` over three fake
players; quests: the locket found at the Kansas River by `adoptDog`, found by the nose on legs 2–3 for a dog from an earlier
season, never found past Chimney Rock; steps advance in order and a stop already passed is skipped; the owner returns it from
any step; `questMail` after the owner's stop; once a season; the card new once ever; a synthetic 'glove' quest (`useQuests`,
found by fetch) runs through the same functions untouched; trail facts: only on their legs, ≤ 1 a leg, never twice a season,
`setTrailSounds(false)` removes exactly the four `far` facts, the stampede's fact once a season; `dustDevilResult`'s token only
when every hat; stones once a stop; the meteors decided once an arrival and never on the last leg; `ensureJourney` turns a
1.3.2 save fixture into rev 14 with every field and changes nothing else; `newSeason` carries exactly §3.1's list; `merge14`
(each rule of §3.7 both ways); a 12-leg journey with a dog, every moment taken, still arrives with no fail state; the 8 new
deeds reachable.

**7.2 `tools/economy-sim.mjs --check`**: the kids of 1.3 plus 1.4's play (the dog kept 80 % of the time at the Kansas River,
the rabbit called back 70 %, fetch at every camp with the dog, stones at 60 % of river stops, meteors when offered, fishing
2.0 with 60 % hooks and 85 % of fights landed, grasshoppers caught at a third of the camps that fish, the spoon bought by a
quarter of the kids, every quest followed by 70 %). `SEC` gains `nose: { find: 0, berries: 8, snake: 8, rabbit: 8, quest: 15
}`, `fact: 10`, `dustDevil: 15`, `fetch: 30`, `hoppers: 15`, `stones: 25`, `meteors: 25`, `fish: 75`, `questTalk: 12`. Every
1.3 `TARGET` holds unchanged, plus new ones: the first season's mean sessions still 12 ± 2; the mandatory 1.4 seconds a leg
(nose + fact + dust devil) ≤ 60 on average; tokens a leg still 3–10; the session's food mean within 10 % of 1.3's; at least one
nose moment on 95 % of the legs with the dog; the locket returned or mailed by 100 % of the kids who keep the dog.

**7.3 `tools/scene-smoke.mjs` (Playwright, the real scene)**: each new mini-game runs to its end with scripted input through
`debugInput` (fetch: three drags of different lengths, `fetchBring` after each; stones: on-beat and off-beat taps; meteors:
taps on stars and on empty sky; dust devil: all hats caught and none caught; hoppers; fishing: a cast hooked and landed by
releasing on the red, a cast held through the red that goes 'off' and is retried, a sturgeon with the help tap, a missed dip, a
junk cast, a cameo); the chase called early and not at all (the muddy overlay drawn after `setParty({ dog: { muddy: true } })`);
every `ambient` kind renders and ends; **the grizzly stays on the far ridge band** (its box above 45 % of the height and under
7 % tall in every frame); nothing of the 'crack' vignette but birds and trees (no new sprite kind is drawn); reduced motion for
each; screenshots of each in both layouts; perf: the stones, the meteors and the dust devil at 4× CPU throttle keep ≤ 8 ms of
game code a frame. The mock's scripts (§4.4) produce the same event sequences (a mock section of the smoke).

**7.4 `tools/content-audit.mjs` (kid rules and the voice)**: it already walks every module in `src/content/*` and
`src/journey/*` (the new ones included, automatically) for `BANNED`; it gains **`WEAPONS`** =
`/\b(guns?|gunshots?|gunfire|rifles?|muskets?|pistols?|bullets?|shoot|shoots|shooting|shot)\b/i`, checked on every walked string
and every string literal after removing the exact phrases of **`WEAPON_ALLOW = ['Far-off rifles', 'The far-off crack of rifles
beyond the ridge.']`**; the audit fails when an allowlisted phrase occurs anywhere but `TRAIL_FACTS['far-off-crack']` and the
card `far-off-crack` (no stray allowance), and when `TRAIL_FACTS['far-off-crack']` no longer contains both phrases (the
allowlist and the content must agree). (`shots` as an object key in code is not a string and is not checked; the hunt's
`shots` option stays.) The ui-smoke's `BANNED` stays identical to the audit's (the drift check); ui-smoke gets the same
`WEAPONS` and `WEAPON_ALLOW` constants and the audit checks those two for drift as well. The voice coverage (§5 of the audit)
walks, independently of the collector: every `FINDS` / `JUNK` / `WISHES` / `MOMENTS` line, every quest's item, step, owner and
mailed line, every `TRAIL_FACTS` text, the 14 new cards, the 8 new deeds, every companion's `help`, the new letter templates,
and `DOG_LINES` filled with 'Frodo'; each must be reachable by `collectVoiceTexts({ legId, playerName: 'Mia', dogName: 'Frodo' })`
for some leg; the new call sites in `main.js` / `ui/*` are read as today.

**7.5 `tools/ui-smoke.mjs` (Playwright, the mock scene; `FUN_ONLY=1` runs only this part, on a journey of its own)**: the
Kansas River crossing → the dog offer → the namer → the locket card; Fort Kearny's Talk row has Mrs. Platt with ❓, Chimney
Rock Josh, Fort Laramie Molly with 💛 → returned: her card in the album, the token, +10 lb; a second journey that walks past
Molly gets the mailed card at the next post office; `playNose` for each kind (the find pop and the Finds page counts, the
snake card, the rabbit called (the name button) and late (`__mockScript.chase = 'late'`: the dog muddy in `getState()`, clean
after camp), the berries); fetch with three throws and an item; grasshoppers caught; Fishing 2.0 with each bait (worms,
grasshoppers from the tin, the spoon bought at Fort Kearny), a fight landed and one 'off' with its retry, a junk boot, the
bottle → the note quest started, the summary card spoken, a first species' card; `jumpLeg('snake-river')` → a sturgeon with the
helper's tap; stones at a river stop and at camp; meteors at an arrival evening (`__mockScript.meteors = 5` → 5 wishes); a
dust devil with all hats (the token) and with some; `playFact(id)` for each of the six (the card, the album's Trail tales), and
with "Far-off sounds" off the four far facts never planned (`fun.factsHeard` over a scripted leg); the journal's Finds and
Fish log pages with Family records from a second seeded player; the store's horseshoe sale; the layout audit on every new
screen and overlay (targets ≥ 44 px, the name button ≥ 64 px, no overflow, the seven journal tabs fit); the kid-rule text
audit (`BANNED` and `WEAPONS` with the allowlist) on every kid screen; the voice with instrumented engines: a find pop, a fact
card, the quest lines and the fishing summary all spoken by clips (`tts.lastEngine === 'cloud'`), zero device-voice
utterances, zero overlapping ones, the leg's prepare requests carrying "Frodo found something!" and the leg's trail fact; no
console errors. `tools/sync-smoke.mjs`: two devices, one catches a sturgeon and the other skips seven stones: both end with
both records and the union of finds.

**7.6 Acceptance (the orchestrator, on a real phone at iPhone size, the real scene).** A leg with the dog: two or three nose
moments, a trail fact, and the leg in 10–14 minutes; the locket from the Kansas River to Fort Laramie; a fishing session with a
fight that a 9-year-old can read without being told (the shiver before the red); the grizzly far away and calm; the rifles a
far sound, no shooter on screen; every suite green (`journey-tests`, `economy-sim --check`, `scene-smoke`, `ui-smoke`,
`sync-smoke`, `content-audit`, `music-check`).

### 8. Open questions for Matt (short; the defaults above ship if there is no answer)

1. **The dog now joins at the Kansas River** (not Fort Kearny), so the locket can be its first find. OK?
2. **Trout on the Platte**: no trout is native there, so the Platte gives catfish and the trout start at Fort Bridger. OK?
3. **The arrowhead is sketched and left where it lay**, not kept (respect for the history, and today's law on public land). OK?
4. **Far-off sounds** (rifles, wolves, the grizzly, the prairie glow) are on by default with a Parent Zone switch; is the
   prairie fire glow too scary to keep?
5. **Family records show first names** beside the biggest fish and the most skips (the family map shows no names). OK?
6. **The shiny spoon is sold at the fort stores** ($3) rather than at the trading-post events. OK?
