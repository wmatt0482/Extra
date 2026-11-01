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
## v1.5 — The Long Trail (owner, Nov 1: his son finished all twelve legs, Independence to the Willamette, in about two hours: "Need to scale this much better"; and, while this was written: "Maybe they can choose where to go also")
> v1.4 ("Frodo and the river": the dog's finds, fishing 2.0, trail moments, the locket quest, trail facts) is written in its
> own branch and sits above this section. v1.5 does not redesign any of it; where v1.5 needs v1.4's tables or save fields
> (the dog, its finds, the fish log, the locket, the trail moments and trail facts), it uses them by the names v1.4 §2 gives.
> The orchestrator fills those names into the two marked lists below (§3.6 `CARRY_V14`, §5.6 the merge) at integration.

The fix is not slower legs. It is **more trail** (12 legs become 20 on the same 2,000 miles, with the real landmarks the game
skipped), **a choice of where to go** (Oregon or California at Fort Hall, the Sublette Cutoff, the Lander Road, the Barlow
Road), **a second story route** (the Gold Road south from the Willamette farm in the gold rush of 1848–49), **years that change
the game** (Rookie, Veteran, Pioneer), **an endgame that grows** (the homestead, built from what each journey brings home) and
**collections with long tails** (about 110 trail cards in sets that unlock wagon decorations, and 45 deeds). The kid rules of
§1 stand everywhere, and the learning spine (4–6 mile markers a leg, three spelling words at every letter or ferry) does not
change: more trail means more of it, at the same small size per session.

### 1. Design, and what the child sees

**A year is a journey.** The title says "A new year" once a journey is done. The child picks **where** (the emigrant trail
from Independence, or, once a Willamette farm exists, the Gold Road south from it), **how hard** (Rookie, Veteran, Pioneer:
§2.6, §3.2) and **who** (which relatives' wagon comes west this year, the animals, three companions). The calendar moves one
year a journey: the first trip is 1847, the next 1848, and so on (`ledger.year`); a route or a fork exists only from the year
it really opened (the Sublette Cutoff 1844, the Barlow Road 1846, the Gold Road 1848, the Lander Road 1858).

**The story of the years.** The first wagon is the child's own family. Every later emigrant-trail journey is another branch
of the family coming west to join the homestead ("Uncle Theo's wagon, 1849"), so the letters go home to the people at the
farm, and what the wagon brings builds the farm. The Gold Road is the child setting out from the farm when the news of gold
reaches the valley; its letters go back to the family in Oregon.

**The emigrant trail, 20 legs.** Independence to the Willamette Valley is still 2,000 miles; it now also stops at Alcove
Spring, Ash Hollow, Scotts Bluff, the North Platte ferry, Ice Slough, the Green River, Soda Springs (its own stop now) and
Farewell Bend (§2.2). The five stores are where they were, at the same miles (Independence; Fort Kearny at mile 320, Fort
Laramie at 620, Fort Bridger at 1,090, Fort Hall at 1,300), so the 1.3 food and money plan holds. Legs are 60 to 160 miles
(100 on average, was 167): a leg has fewer travel days but the same marker count (4–6), its one or two events, its stop and
its people, so a leg is still one session.

**Choosing where to go.** Three forks. Each is a card at the stop with a person who explains both ways in one true line
each, and two (or three) equal buttons, all read aloud; a choice is never hidden:
- **Fort Hall: Oregon or California** (every journey, the first included). Agnes, the clerk at Fort Hall, explains: west
  along the Snake River to the Willamette's farmland, or south at the Raft River along the Humboldt, across the Forty-Mile
  Desert and over the Sierra Nevada to the Sacramento Valley. On the first trip the card leans toward Oregon ("Your family
  planned on Oregon. You can still change your mind."; "On to Oregon" is first and has the focus) but both buttons are the
  same size. From 1849 on Agnes adds that most wagons this year are bound for the California gold fields (true for 1849–50).
- **The Dalles: the Columbia raft or the Barlow Road** (every journey). The raft is 1.2's raft run; the Barlow Road is a
  mountain leg over the shoulder of Mount Hood with a toll gate ($5 a wagon in 1846, the real toll) and Laurel Hill, where
  wagons were let down the steep slope on ropes (a new timing mini-game, §4.3). Note for the record: the 1.3 code has only
  the raft; the Barlow Road is new here.
- **South Pass: by Fort Bridger, the Sublette Cutoff, or the Lander Road** (from the second journey). The cutoff is about 40
  miles shorter but crosses some 50 miles with no water and skips the Fort Bridger store; the Lander Road (from 1858,
  one of the first roads the federal government built for emigrants) is about 60 miles shorter, with grass and water, and skips Fort
  Bridger and Soda Springs.
Both trail ends are a homestead, the **Willamette farm** or the **Sacramento Valley claim and cabin**, on the same homestead
model.

**The California Trail, 24 legs, about 2,150 miles.** The first fifteen legs are the Oregon Trail's; from Fort Hall: the
Raft River (the Parting of the Ways), City of Rocks (names in axle grease), the head of the Humboldt, the Humboldt River,
the Big Meadows (the last good grass), the Forty-Mile Desert (no water: fill every barrel first), the Truckee River (named
for the Northern Paiute guide who showed the 1844 wagons the way), the Sierra summit, and the Sacramento Valley. The route
over the Sierra is the Truckee route (the main route from 1844 and the only one before 1849; §8 asks about the Carson route).
There is no store after Fort Hall, as on the Oregon side, but it is 850 miles instead of 700: California is the harder road,
and the economy targets say so (§7.2).

**The Gold Road, 12 legs.** Unlocked by arriving in the Willamette Valley. On January 24, 1848 James Marshall found gold
flakes in the tailrace of John Sutter's sawmill at Coloma; the news reached Oregon by ship that summer, and thousands of
Oregon settlers went south in 1848–49, by the old Siskiyou Trail and the Applegate road: up the Willamette, over the Calapooya
Mountains, through the Umpqua and Rogue valleys, over the Siskiyou pass, past Mount Shasta and Castle Crags, down the
Sacramento Valley to Sutter's Fort and the diggings at Coloma. A few wagons crossed the Siskiyous in those years; most
travelers went with pack mules (the lookout says so; the game keeps the wagon, with two pack mules walking beside it). The road
pans for gold at Clear Creek (Reading's Bar, 1848), the Feather River (Bidwell's Bar, July 1848) and Coloma, and comes home
**by sea**: a schooner from San Francisco up the coast and over the Columbia River bar, which is how many Oregonians came back
with their gold. At home the gold becomes **Beaver money**, the five- and ten-dollar coins an Oregon City company struck from
California gold dust in 1849, and Beaver money buys the farm's big pieces. The gold rush is told as a journey and a craze
("gold fever"); a true card says who got rich, in kid words: most miners found only a little gold, and many of the people who
got rich were the storekeepers who sold them shovels, pans, flour and boots.

**Gold panning** (pure fun, no fail). At a digging the child scoops gravel (a tap), swirls the pan (circles with a finger, or
taps on the beat; the swirl meter fills), tips it to wash the light sand over the lip when the rim glows, and the last swirl
shows the flakes; now and then a nugget. Every pan gives at least one flake; a good swirl gives more. At Coloma there is also
the **rocker** (the cradle the forty-niners rocked): rock it on the beat while the water pours, three rounds. Gold is counted
in flakes, and ten flakes make a nugget (shown both ways: place value, 4.NBT). Gold never buys store goods: it goes home.

**The homestead is the endgame.** Arriving at a trail's end founds the homestead there (the child names it, as 1.0 already
asks). Then it grows. Every journey banks what it brings: the dollars left in the purse become the farm's **savings**, the
gold becomes **Beaver money**, the team joins the pasture. Pieces are bought with what fits them: small pieces with **trade
tokens** (garden rows, a mailbox, a bench, flower beds, apple trees, a chicken coop: the token sink 1.3 asked for), middle
pieces with **savings** (the cabin first, then the well, the fence, the corral, the name plate with the farm's name), the big
pieces with **Beaver money** (the barn, the orchard, the frame house, the mill, the schoolhouse). The farm shows in the
journal, on the title map as a small cabin that grows, and in its own scene, where the party, the dog and the animals are at
home. **Nothing decays, nothing is lost, nothing has a timer**: a farm left alone for a month is exactly as it was. The
Willamette farm feeds the Gold Road (its garden and orchard send food along at the start). The loop is "go again and bring
back more", never "come back or lose it".

**Collections.** Trail cards go from 40 to about 110 (every new landmark and nation, sixteen new plants and animals, two new
companions, a gold-rush suit), grouped into sixteen **sets** that cut across the suits ("The Platte River road", "Over the
Divide", "The California Trail", "Nations of the Gold Road", "Gold fever", …); a full set unlocks a **wagon decoration** (a
pennant, a lantern, a brass bell, gold-leaf trim, a weathervane that also turns on the farm), worn in Outfit → Look. Deeds go
from 20 to 45 (each route and fork, each tier, the first flake and the first nugget, raising the barn, homesteads at both
ends, …). Everything collected carries from year to year: cards, deeds, decorations, tokens, the wagon upgrades, the dog and
v1.4's finds, fish log and locket, the farm.

**How long it takes now.** A leg is still one session, 8–10 minutes on the economy sim's clock (1.3 measured 8.3; the owner's
son's real pace was about 10), never more than 14. A year on the Oregon side is 20 sessions (about 3 hours), on the
California side 24 (about 3½), the Gold Road 12 (about 2). Seeing all of it at Rookie (Oregon, the Gold Road, California, the
Barlow Road, the Sublette Cutoff) is five or six years of play, 15–17 hours; the tiers, the Lander Road (1858), the two farms
and the sets take it past 30. **The shared streak** keeps its rule (a day counts once a leg is finished; building the farm or
opening cards does not count, so the habit stays the learning one). At a leg a day, a year is three to four weeks of streak:
the season is now as long as the habit it feeds.

### 2. Content schema (`src/content/*`; the Content stream fills, everyone imports)

#### 2.1 Legs become a pool; routes put them in order
`LEGS` stays an export (the default emigrant plan: 20 legs by Fort Bridger, Oregon and the Columbia raft) so the 1.3 code
paths keep working; every leg of every route is in `ALL_LEGS` / `LEG_BY_ID`. A leg keeps 1.3's fields and gains:
```js
{ id, name, from, to, miles, biome, stop: { kind, name }, river?, fort?, nation?, lookout, sticker,
  painting: 'ash-hollow',          // NEW: the scene's set piece id (§4.2); the loose paintingFor(id) match stays the fallback
  map: [x, y],                     // NEW: the stop on the title map, in a 1000 × 600 box (x east, y south), Independence ≈ [940, 330]
  post: true,                      // NEW: a letter is written here (every fort; a few stops on the long stretches without one)
  dry: { from: 0.1, to: 0.7 },     // NEW, optional: the share of the leg with no water (the Sublette Cutoff, the Forty-Mile Desert)
  cold: true,                      // NEW, optional: replaces economy.COLD_LEGS (south-pass, blue-mountains, lander-road, siskiyou-pass, sierra-summit)
  gold: { pans: 3, rich: 1, rocker: 0 },  // NEW, optional: a digging (Clear Creek, the Feather River, Coloma; the Sacramento claim from 1848)
  toll: 5,                         // NEW, optional: a toll in 1846 dollars, paid at the start of the leg (the Barlow Road)
  voyage: true,                    // NEW, optional: the leg runs as a sail (no trail days), like the Columbia raft
  ferry: false,                    // NEW, optional: a river with no ferry (the Humboldt): ford or float only
  fromYear: 1858 }                 // NEW, optional: the leg exists from this year on (the Lander Road)
// stop.kind gains 'gold' (the diggings at Coloma: panning and the rocker, then the road goes on).
// biome gains 'basin' | 'sierra' | 'siskiyou' | 'goldcountry' | 'sea' (§4.1).
```
Miles are the game's: the real distances rounded and evened out so each leg is 60–160 miles, within about 15 % of what the
sources give where they agree. They are never read aloud ("Things we deliberately did not say" stands).

#### 2.2 The emigrant trail: the 20-leg Oregon line (default branches) and its branches
`*` = a store. Cumulative miles in brackets; the four forts keep 1.3's (320 / 620 / 1,090 / 1,300).

| n | id | stop (kind) | biome | miles [cum] | nation | the lookout's true fact (one line here; full `text` and `say` by Content) |
|---|---|---|---|---|---|---|
| 1 | kansas-river | Kansas River (river, wide) | prairie | 110 [110] | kansa | 1.3's (families ran ferries for a fee) |
| 2 | alcove-spring | Alcove Spring (landmark) | prairie | 90 [200] | — | a spring falls over a rock ledge into a pool near the Big Blue River; travelers camped here waiting to cross, carved their names in the rock, and some carvings from 1846 can still be seen |
| 3 | fort-kearny | Fort Kearny* (fort 1.2) | prairie | 120 [320] | pawnee | 1.3's |
| 4 | ash-hollow | Ash Hollow (landmark) | bluffs | 120 [440] | lakota | wagons came down steep Windlass Hill, some eased down on ropes, into a shady hollow named for its ash trees, with a sweet spring; the wagon swales can still be seen |
| 5 | chimney-rock | Chimney Rock (landmark) | bluffs | 60 [500] | lakota | 1.3's |
| 6 | scotts-bluff | Scotts Bluff (landmark) | bluffs | 60 [560] | lakota | the bluffs tower about 800 feet over the North Platte; wagons went through Mitchell Pass beside them, and a stretch of the old road is a walking trail today |
| 7 | fort-laramie | Fort Laramie* (fort 1.6) | bluffs | 60 [620] | lakota | 1.3's |
| 8 | north-platte | North Platte River (river, wide) | highdesert | 120 [740] | lakota | in June 1847 Mormon pioneers built a ferry near present-day Casper, Wyoming, and carried emigrant wagons over the high river for a fee |
| 9 | independence-rock | Independence Rock (landmark) | highdesert | 60 [800] | shoshone | 1.3's |
| 10 | ice-slough | Ice Slough (landmark) | highdesert | 80 [880] | shoshone | under the boggy grass, travelers dug down about a foot and found clear ice, even in July |
| 11 | south-pass | South Pass (landmark, cold) | mountains | 70 [950] | shoshone | 1.3's |
| 12 | green-river | Green River (river, wide) | mountains | 70 [1,020] | shoshone | fording the Green River was risky, so most travelers paid one of the ferries to carry the wagons over |
| 13 | fort-bridger | Fort Bridger* (fort 1.9) | mountains | 70 [1,090] | shoshone | 1.3's |
| 14 | soda-springs | Soda Springs (landmark) | highdesert | 140 [1,230] | bannock | the fizzy springs (1.3 folded this into Fort Hall's lookout; it gets its own stop and keeps the line) |
| 15 | fort-hall | Fort Hall* (fort 2.2) | highdesert | 70 [1,300] | bannock | 1.3's second sentence; the first now: wagons bound for Oregon and for California shared the road as far as the Raft River |
| 16 | snake-river | Snake River, Three Island Crossing (river, wide) | highdesert | 160 [1,460] | bannock | 1.3's |
| 17 | farewell-bend | Farewell Bend (landmark) | highdesert | 110 [1,570] | — | the last camp on the Snake River after following it for more than 300 miles; then the trail turned overland |
| 18 | blue-mountains | Blue Mountains (landmark, cold) | mountains | 130 [1,700] | nez-perce, cayuse | 1.3's |
| 19 | the-dalles | The Dalles (river, narrow) | gorge | 140 [1,840] | chinook | 1.3's (the raft or the Barlow Road: now a real fork) |
| 20 | willamette-valley | Willamette Valley (home) | valley | 160 [2,000] | chinook | 1.3's (runs as the Columbia raft) |

Branches (fork → option → its legs; a leg named again with other miles is an override in the plan, §2.3):

| fork | option | legs (miles) | to the rejoin | notes |
|---|---|---|---|---|
| south-pass (from journey 2) | **main** (default) | green-river 70, fort-bridger 70, soda-springs 140, fort-hall 70 | 350 to Fort Hall | the 1.3 stores |
| | **sublette** (from 1844) | sublette-cutoff 100 (river: the Green River on the cutoff; `dry: { from: 0.1, to: 0.7 }`), bear-river 90 (landmark: the trails meet again in the Bear River valley), soda-springs 50 (override), fort-hall 70 | 310 (40 shorter) | no Fort Bridger store; the water barrel matters |
| | **lander** (from 1858) | lander-road 150 (landmark, cold: the government's new road through the mountains, with grass and water), fort-hall 140 (override) | 290 (60 shorter) | no Fort Bridger store, no Soda Springs |
| fort-hall (every journey) | **oregon** (default) | snake-river, farewell-bend, blue-mountains, the-dalles, then the fork at the-dalles | 700 to the valley | |
| | **california** | the nine legs below | 850 to the claim | |
| the-dalles (every journey) | **columbia** (default) | willamette-valley 160 (the raft) | | 1.2's raft |
| | **barlow** (from 1846) | barlow-road 160 (home: Oregon City by the Barlow Road; `toll: 5`; biome mountains; Laurel Hill) | | when the purse is short the toll keeper takes an IOU (true: many could not pay) |

The California Trail from Fort Hall (cumulative miles on the default south-pass branch):

| n | id | stop (kind) | biome | miles [cum] | nation | the lookout's true fact |
|---|---|---|---|---|---|---|
| 16 | raft-river | the Raft River, the Parting of the Ways (landmark) | highdesert | 60 [1,360] | bannock | on a bluff above the Raft River the trails parted: Oregon wagons kept west, California wagons turned south |
| 17 | city-of-rocks | City of Rocks (landmark) | highdesert | 70 [1,430] | bannock | a valley of giant granite spires where travelers camped and wrote their names in axle grease; some names from 1849 can still be read on Register Rock |
| 18 | humboldt-wells | Humboldt Wells (landmark) | basin | 120 [1,550] | newe | springs at the head of the Humboldt River, the river the trail followed across what is now Nevada |
| 19 | humboldt-river | the Humboldt River (river, narrow, `ferry: false`) | basin | 150 [1,700] | newe | the Humboldt gave the wagons water, grass and willow wood across the Great Basin, though many diaries grumbled about it |
| 20 | big-meadows | the Big Meadows (landmark, `post`) | basin | 150 [1,850] | numu | travelers named this green valley the Big Meadows and stopped for water and grass before the desert |
| 21 | forty-mile-desert | the Forty-Mile Desert (landmark, `dry: { from: 0, to: 1 }`) | basin | 60 [1,910] | numu | past the Humboldt Sink there was no water for about forty miles, so wagon parties filled every barrel before they set out |
| 22 | truckee-river | the Truckee River (river, narrow) | basin | 60 [1,970] | numu | in 1844 a Northern Paiute guide the travelers called Truckee showed a wagon party the way to this river, and they named it for him |
| 23 | sierra-summit | the Sierra summit (landmark, cold) | sierra | 80 [2,050] | washoe | in 1844 the first wagons crossed the Sierra Nevada, high in the granite, and reached the Sacramento Valley before winter |
| 24 | sacramento-valley | the Sacramento Valley claim (home; `gold: { pans: 2, rich: 1 }` from 1848) | goldcountry | 100 [2,150] | nisenan | John Sutter's settlement, begun in 1839, drew wagon parties down out of the mountains; settlers came for the farmland before anyone found gold |

#### 2.3 Routes, forks and plans (`src/content/routes.js`, new)
```js
export const ROUTES = {
  emigrant: { id: 'emigrant', name: 'The emigrant trail', fromYear: 1843,
    start: { id: 'independence', name: 'Independence, Missouri', store: { name: 'Independence', prices: 1.0 }, lookout: 'independence', map: [940, 330] },
    steps: ['kansas-river', 'alcove-spring', 'fort-kearny', 'ash-hollow', 'chimney-rock', 'scotts-bluff', 'fort-laramie',
            'north-platte', 'independence-rock', 'ice-slough', 'south-pass', { fork: 'south-pass' }, { fork: 'fort-hall' }] },
  'gold-road': { id: 'gold-road', name: 'The Gold Road', fromYear: 1848, needs: { site: 'willamette' },
    start: { id: 'farm-willamette', name: 'your farm in the Willamette Valley', store: { name: 'Oregon City', prices: 1.3 }, lookout: 'gold-news', map: [80, 120] },
    steps: ['calapooya-mountains', 'umpqua-river', 'canyon-creek', 'rogue-river', 'siskiyou-pass', 'mount-shasta', 'castle-crags',
            'clear-creek', 'feather-river', 'sutters-fort', 'coloma', 'home-by-sea'] },
};
export const FORKS = {
  'south-pass': { id: 'south-pass', at: 'south-pass', fromJourney: 2, explainer: 'nell', options: [
    { id: 'main', name: 'By Fort Bridger', steps: ['green-river', 'fort-bridger', 'soda-springs', 'fort-hall'], line: { text, say } },
    { id: 'sublette', name: 'The Sublette Cutoff', fromYear: 1844, steps: ['sublette-cutoff', 'bear-river', { leg: 'soda-springs', miles: 50, from: 'the Bear River' }, 'fort-hall'], line },
    { id: 'lander', name: 'The Lander Road', fromYear: 1858, steps: ['lander-road', { leg: 'fort-hall', miles: 140, from: 'the Lander Road' }], line } ] },
  'fort-hall': { id: 'fort-hall', at: 'fort-hall', fromJourney: 1, explainer: 'agnes', lean: 'oregon', options: [
    { id: 'oregon', name: 'On to Oregon', steps: ['snake-river', 'farewell-bend', 'blue-mountains', 'the-dalles', { fork: 'the-dalles' }], line },
    { id: 'california', name: 'South to California', steps: ['raft-river', 'city-of-rocks', 'humboldt-wells', 'humboldt-river',
      'big-meadows', 'forty-mile-desert', 'truckee-river', 'sierra-summit', 'sacramento-valley'], line, lineFrom1849: { text, say } } ] },
  'the-dalles': { id: 'the-dalles', at: 'the-dalles', fromJourney: 1, explainer: 'barlow-kid', options: [
    { id: 'columbia', name: 'Raft the Columbia', steps: ['willamette-valley'], line },
    { id: 'barlow', name: 'The Barlow Road', fromYear: 1846, steps: ['barlow-road'], line } ] },
};
// A step is a leg id, { leg, miles?, from?, to? } (the same leg with this branch's miles), or { fork }. The first option is the
// default (the plan uses it until the child chooses). Each option's `line` is the one true sentence its explainer says.
export const LEGACY_PLAN_12 = [/* the 1.3 twelve legs with their 1.3 miles as overrides: an unfinished 1.3 journey ends as it began */];
export const SITES = [
  { id: 'willamette', name: 'Willamette Valley farm', ends: ['willamette-valley', 'barlow-road', 'home-by-sea'], map: [70, 110] },
  { id: 'sacramento', name: 'Sacramento Valley claim', ends: ['sacramento-valley'], map: [150, 470] } ];
```
The explainers are `PEOPLE` at those stops (story characters with invented names: **Agnes**, a new clerk at Fort Hall; Nell
already stands at South Pass; Ben, the toll keeper's son, already at The Dalles). Their lines say what is true of each way and
nothing more. `lean: 'oregon'` decides only the first trip's order and focus, never the size of a button.

#### 2.4 The Gold Road (12 legs: about 770 trail miles, then the voyage)

| n | id | stop (kind) | biome | miles | nation | the lookout's true fact |
|---|---|---|---|---|---|---|
| start | (farm-willamette) | your farm; the Oregon City store (prices 1.3) | valley | | kalapuya | `gold-news`: in the summer of 1848 a ship brought word to Oregon that gold had been found in California, and thousands of settlers headed south |
| 1 | calapooya-mountains | the Calapooya Mountains (landmark) | valley | 100 | kalapuya | the mountains between the Willamette and Umpqua valleys are named for the Kalapuya people |
| 2 | umpqua-river | the Umpqua River (river, wide) | siskiyou | 60 | umpqua | the trail south, the Siskiyou Trail, grew out of Native footpaths through the river valleys, the Umpqua among them |
| 3 | canyon-creek | Canyon Creek (landmark, `post`) | siskiyou | 60 | umpqua | the canyon is so narrow and steep that in 1846 wagons were often taken apart and let down on ropes |
| 4 | rogue-river | the Rogue River (river, wide) | siskiyou | 70 | takelma | the Table Rocks stand above the Rogue River valley, the heart of the Takelma homeland |
| 5 | siskiyou-pass | the Siskiyou pass (landmark, cold, `post`) | siskiyou | 60 | shasta | Hudson's Bay Company trappers crossed this pass in 1827; a few wagons crossed in 1848–51, but most travelers used mule trains |
| 6 | mount-shasta | Mount Shasta (landmark) | siskiyou | 60 | shasta | Mount Shasta is a volcano more than 14,000 feet tall, and its snowy top can be seen for days of travel |
| 7 | castle-crags | Castle Crags (landmark) | sierra | 60 | wintu | granite spires like a castle's towers rise beside the upper Sacramento River, on the old trail south |
| 8 | clear-creek | Clear Creek, Reading's Bar (landmark, `gold: { pans: 3, rich: 1 }`, `post`) | goldcountry | 70 | wintu | in 1848 Pierson Reading and the Native workers with him washed the first gold out of Clear Creek, far north of Coloma |
| 9 | feather-river | the Feather River, Bidwell's Bar (river, wide, `gold: { pans: 4, rich: 1 }`) | goldcountry | 100 | maidu | John Bidwell found gold on the Feather River on July 4, 1848 |
| 10 | sutters-fort | Sutter's Fort* (fort 3.0, `painting: 'adobe-fort'`) | goldcountry | 80 | nisenan | thousands of miners came through Sutter's Fort to buy supplies from its stores; prices in the gold country were very high (no prices read aloud) |
| 11 | coloma | Coloma, the diggings (gold, `gold: { pans: 5, rich: 2, rocker: 3 }`, `post`) | goldcountry | 50 | nisenan, miwok | on January 24, 1848 James Marshall saw gold flakes in the water channel of Sutter's sawmill here; the Nisenan call this valley Cullumah |
| 12 | home-by-sea | home by sea (home, `voyage`) | sea | 600 sea miles | chinook | many Oregonians sailed home from San Francisco with their gold, and in 1849 a company in Oregon City made it into five- and ten-dollar coins with a beaver on them, called Beaver money |

The voyage ticks no trail days (like the raft): `scene.startSail` runs it, with four "Up the coast" markers (the learning
spine) and the Columbia bar at the end (§4.3). Stores: the Oregon City store at the start and Sutter's Fort; the farm's garden
and orchard send food along (§3.5). Letters: at the four `post` stops and Sutter's Fort, to the family at the farm.

#### 2.5 Nations of the new country (`nations.js`, 11 new; the same shape, with `trades` in the goods of the place)
Named as they name themselves; trading partners and guides; a present-tense fact where true. A parent's read is asked for
(§1, §8). Sources and verdicts: SOURCES.md, "The Long Trail (v1.5)".

| id | name (`also`) | legs | fact (two sentences at most) | trade get |
|---|---|---|---|---|
| kalapuya | Kalapuya (Confederated Tribes of Grand Ronde; Confederated Tribes of Siletz Indians) | Gold Road start, calapooya-mountains | The Kalapuya people have lived in the Willamette Valley for thousands of years, and they cared for its prairies with fire so that camas and other foods grew well. Today Kalapuya people are part of the Confederated Tribes of Grand Ronde and the Confederated Tribes of Siletz Indians. | camas |
| umpqua | Umpqua (Cow Creek Band of Umpqua Tribe of Indians) | umpqua-river, canyon-creek | The Cow Creek Band of Umpqua Tribe of Indians takes its name from Cow Creek, which runs into the South Umpqua River. Today the tribe is based in Roseburg, Oregon, in its homeland. | salmon |
| takelma | Takelma (Siletz; Grand Ronde) | rogue-river | Takelma means those who live along the river, and the Rogue River valley and the Table Rocks are the heart of the Takelma homeland. Today Takelma people belong to the Confederated Tribes of Siletz Indians and the Confederated Tribes of Grand Ronde. | acorns |
| shasta | Shasta | siskiyou-pass, mount-shasta | The Shasta homeland is along the Klamath River and in the valleys at the foot of Mount Shasta. Shasta people still live in this country today. | salmon |
| wintu | Wintu | castle-crags, clear-creek | The Wintu homeland is along the upper Sacramento and McCloud rivers, and salmon are at the heart of Wintu life. Today Wintu people are helping bring salmon back to the McCloud River. | salmon |
| maidu | Maidu (Mechoopda Indian Tribe of Chico Rancheria; Berry Creek Rancheria of Maidu Indians) | feather-river | The Maidu homeland includes the Feather River country. Today Maidu tribes include the Mechoopda Indian Tribe of Chico Rancheria and the Berry Creek Rancheria of Maidu Indians. | acorns |
| nisenan | Nisenan (Shingle Springs Band of Miwok Indians; Nevada City Rancheria Nisenan Tribe) | sutters-fort, coloma, sacramento-valley | The Nisenan homeland is along the American, Yuba and Feather rivers, and the Nisenan call the valley at Coloma Cullumah. Today Nisenan people belong to the Shingle Springs Band of Miwok Indians and the Nevada City Rancheria Nisenan Tribe. | acorns |
| miwok | Miwok (Shingle Springs Band of Miwok Indians) | coloma | Miwok homelands reach along the Sierra foothills south of the American River. Today the Shingle Springs Band of Miwok Indians, whose people are Miwok and Nisenan, is based in El Dorado County, the county where Coloma is. | acorns |
| newe | Western Shoshone (Newe; Te-Moak Tribe of Western Shoshone) | humboldt-wells, humboldt-river | The Western Shoshone call themselves Newe. Today the Te-Moak Tribe of Western Shoshone has its headquarters in Elko, Nevada, and one of its bands lives at Wells, near the head of the Humboldt River. | pinenuts |
| numu | Northern Paiute (Numu; Pyramid Lake Paiute Tribe) | big-meadows, forty-mile-desert, truckee-river | The Northern Paiute homeland includes Pyramid Lake and the Truckee River. Today the Pyramid Lake Paiute Tribe's reservation takes in the whole lake and the lower Truckee River. | trout |
| washoe | Washoe (Wašiw; Washoe Tribe of Nevada and California) | sierra-summit | Lake Tahoe, high in the Sierra Nevada, is the heart of the Washoe homeland. Today the Washoe Tribe of Nevada and California is based in Gardnerville, Nevada. | pinenuts |

The California side's first two legs reuse `bannock` (the Shoshone-Bannock Tribes); alcove-spring and farewell-bend have no
trading post (`nation` omitted: the sources at hand do not settle whose homeland each was in the 1840s, so the game makes no
claim). `TRADE_GOOD_NAMES` and economy `TRADE_LB` gain `acorns` (bags of acorn meal, 20 lb), `pinenuts` (bags of pine nuts,
10 lb) and `trout` (strings of dried trout, 10 lb). "Cullumah" rests on a California State Parks brochure; its meaning
("beautiful valley") is on a secondary page only, so it is not said. "Numu" is in `also` only (§8 asks a parent's read).

#### 2.6 Tiers (`src/content/tiers.js`, new: the names and words; the numbers are the journey's, §3.2)
```js
export const TIERS = [
  { id: 'rookie', name: 'Rookie', emoji: '🌱', legacy: 's1847', blurb: 'The trail as it is: fair prices, kind weather.', trophy: 'bronze' },
  { id: 'veteran', name: 'Veteran', emoji: '🧭', legacy: 's1850', blurb: 'Less cash, more storms and broken wheels, and more cards and gold.', trophy: 'silver', opens: 'Finish any journey.' },
  { id: 'pioneer', name: 'Pioneer', emoji: '⛰️', legacy: 's1853', blurb: 'A lean purse, snow on every mountain, and the biggest rewards.', trophy: 'gold', opens: 'Finish a Veteran journey.' } ];
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));
// SEASONS / SEASON_BY_ID stay exported from legs.js; route.seasonOf maps both ids onto TIERS (an old J.season 's1850' is a Veteran journey).
```
`FAMILIES` (new, `src/content/families.js`): the relatives' wagons for the years after the first (the first is the child's
own): `{ id: 'uncle-theo', name: "Uncle Theo's wagon", emoji: '🧔', from: 'Ohio' }` and Aunt June, Cousin Ruth, Grandpa and
Grandma, the Okafor cousins, the Larsen cousins. Flavour only, no stats. `LETTER_OPEN` gains `'Dear everyone at {farm},'`
once a farm exists; the Gold Road opens `'Dear family at {farm},'`.

#### 2.7 The homestead (`src/content/homestead.js`, new: words and art slots; the costs are the journey's, §3.5)
```js
export const HOMESTEAD_PIECES = [
  // id, name, emoji, pay: 'tokens' | 'savings' | 'gold' (which purse prices it), slot (where the scene draws it), needs (pieces
  // first), sites (null = both), max (how many: rows, trees), say (the line when it is built), fact? (a true line, sourced)
  { id: 'cabin', name: 'Log cabin', emoji: '🛖', pay: 'savings', slot: 'house', needs: [], sites: null, max: 1, say: 'A cabin of your own!' },
  … ];
export const HOMESTEAD_SLOTS = ['edge', 'orchard', 'barn', 'house', 'yard', 'garden', 'creek', 'pasture', 'gate'];   // left to right in the scene
```
| id | name | pay | slot | needs | sites | max | note |
|---|---|---|---|---|---|---|---|
| cabin | Log cabin | savings | house | — | both | 1 | the first piece; until it is built the farm is a tent and a campfire |
| trophy-shelf | Trophy shelf | free | house | cabin | both | 1 | comes with the cabin; holds the tier trophies (bronze / silver / gold plates by route) |
| name-plate | Name plate at the gate | savings | gate | cabin | both | 1 | shows the farm's name |
| well | Well | savings | yard | cabin | both | 1 | |
| fence | Split-rail fence | savings | pasture | cabin | both | 1 | |
| corral | Corral | savings | pasture | fence | both | 1 | the banked team stands here (up to eight animals drawn) |
| cow | A milk cow | savings | pasture | corral | both | 1 | |
| garden | Garden row | tokens | garden | cabin | both | 4 | each row sends 20 lb along on a Gold Road start |
| flowers | Flower bed | tokens | yard | cabin | both | 3 | |
| mailbox | Mailbox | tokens | gate | name-plate | both | 1 | the journal's letters show beside it |
| bench | Porch bench | tokens | house | cabin | both | 1 | the companions sit here at home |
| coop | Chicken coop | tokens | yard | cabin | both | 1 | |
| apple-tree | Apple tree | tokens | orchard | cabin | willamette | 6 | fact: grafted fruit trees came to the Willamette Valley by wagon in 1847 (secondary sources: SOURCES) |
| barn | Barn | gold | barn | cabin, fence | both | 1 | the barn-raising scene |
| orchard | Orchard | gold | orchard | apple-tree × 3 | willamette | 1 | sends 40 lb along on a Gold Road start |
| frame-house | Frame house | gold | house | cabin, barn | both | 1 | replaces the cabin's art (the cabin stays built) |
| mill | Grist mill | gold | creek | barn | willamette | 1 | |
| vineyard | Vineyard | gold | orchard | barn | sacramento | 1 | |
| windmill | Windmill | gold | yard | well, barn | sacramento | 1 | |
| schoolhouse | Schoolhouse | gold | edge | frame-house | both | 1 | the last piece of a site |

#### 2.8 Trail cards and sets (`cards.js`: about 110 cards in five suits; `CARD_SETS`, new)
Suits: `landmark` (45: the 20 Oregon legs, the 4 branch legs sublette-cutoff, bear-river, lander-road and barlow-road, the 9
California legs, the 12 Gold Road legs; id = the leg id, so a lookout drops its own card), `nation` (19: the 8 and the 11
new), `wild` (28: the 12 and 16 new, each with `biomes`: beaver, sage-grouse, western-meadowlark, pinyon-pine,
cutthroat-trout, tule-elk, valley-oak (its acorns), sugar-pine, california-poppy, manzanita, osprey, pika, oregon-grape,
river-otter, mountain-quail, quaking-aspen), `companion` (10: the 8 and the two new, §2.9) and `gold` (10, a new suit: the
gold pan, the rocker, a flake, a nugget, Sutter's mill, gold fever, "Who got rich?" (the storekeepers), the news reaches
Oregon, the schooner home, Beaver money). Every card is one true, sourced line, or a plain description of a tool ("A gold pan
works because gold is heavier than sand: swirl it, and the gold sinks to the bottom"). v1.4's cards, if its trail facts are
cards, are counted by v1.4, not here. `SUITS` gains 'gold'; `SUIT_NAMES.gold = 'The gold rush'`.
```js
export const CARD_SETS = [
  // id, name, cards: [ids] (any suits), decor: the decoration it unlocks (looks.js kind 'decor'), say: the line when it is complete
  { id: 'platte-road', name: 'The Platte River road', cards: ['ash-hollow', 'chimney-rock', 'scotts-bluff', 'fort-laramie', 'north-platte', 'lakota'], decor: 'pennant-chimney', say },
  … ];
export const DECOR = [{ id: 'pennant-chimney', name: 'Chimney Rock pennant', emoji: '🚩', at: 'wagon' | 'farm' | 'both' }, …];
```
| set | cards | decoration |
|---|---|---|
| jumping-off "Jumping off" | kansas-river, alcove-spring, fort-kearny, kansa, pawnee, wild-plum | a sunflower on the wagon cover |
| platte-road "The Platte River road" | ash-hollow, chimney-rock, scotts-bluff, fort-laramie, north-platte, lakota | Chimney Rock pennant |
| divide "Over the Divide" | independence-rock, ice-slough, south-pass, green-river, fort-bridger, shoshone | Continental Divide flag |
| snake-country "Snake River country" | soda-springs, fort-hall, snake-river, farewell-bend, bannock, salmon | salmon weathervane (wagon and farm) |
| columbia "To the Columbia" | blue-mountains, the-dalles, willamette-valley, nez-perce, cayuse, chinook | a canoe paddle on the tailgate |
| shortcuts "Shortcuts" | sublette-cutoff, bear-river, lander-road, barlow-road | trailblazer's compass |
| california-trail "The California Trail" | the 9 California legs | Sierra lantern |
| basin "Nations of the Great Basin" | newe, numu, washoe, bannock, pinyon-pine, cutthroat-trout | a guide's map painted on the cover |
| gold-road "The Gold Road" | the 12 Gold Road legs | gold-leaf wheel trim |
| gold-nations "Nations of the Gold Road" | kalapuya, umpqua, takelma, shasta, wintu, maidu, nisenan, miwok | a map of the valleys painted on the cover |
| gold-fever "Gold fever" | the 10 gold cards | a brass bell |
| plains-wild "Plains wildlife" | bison, pronghorn, prairie-dog, coyote, jackrabbit, western-meadowlark | a meadowlark on the seat back |
| mountain-wild "Mountains and high desert" | mule-deer, bald-eagle, sage-grouse, pika, sagebrush, quaking-aspen | aspen leaves on the cover |
| river-wild "Rivers" | salmon, beaver, river-otter, osprey, camas, oregon-grape | a beaver on the tailgate |
| california-wild "California hills" | tule-elk, valley-oak, sugar-pine, california-poppy, manzanita, mountain-quail | poppies on the cover |
| crew "The whole crew" | the 10 companions | a brass name plate on the wagon |

Sixteen sets; a card may sit in more than one. A set pays its decoration once (`save.setsDone`, like `suitsDone`); two
decorations are worn at a time (`cosmetics.equipped.decor: [id, id]`). No decoration copies a sacred or ceremonial object of
any nation (the nation sets give painted maps, not regalia).

#### 2.9 People, letters, companions, events
- **People**: two or three at every new stop (33 stops, about 80 people) in the 1.2 shape and rules (invented names; the
  nations' guides named for their nation and saying only the nation's facts; gifts are game rules), plus the explainer
  Agnes at Fort Hall. Sourced at `SOURCES.md#people-<stop>`.
- **Letters**: `LETTER_LINES['stop:<legId>']` (two or three a stop: "We camped by a spring that fell over a rock ledge like a
  little waterfall."), and new keys `fork-oregon`, `fork-california`, `sublette`, `lander`, `barlow`, `toll`, `laurel-hill`,
  `dry`, `pan`, `nugget`, `rocker`, `sail`, `bar`. A letter tells the legs since the last letter (§3.7). `LETTER_CLOSE` gains
  'See you at {farm},' and, on the Gold Road, 'Home soon, with gold!'.
- **Companions**: two new, offered from the second journey: **Mateo the mule packer** (hat 'wide', skill `packing`: food goes
  a twentieth further, and he starts each journey with one more spare part) and **Hattie the prospector** (hat 'bonnet',
  skill `prospecting`: a good swirl finds one more flake, and she reads the creek: one pan at each digging is rich). Lines
  in the 1.0 style; the eight stay as they are.
- **Events** (`events.js`): `spring` (bonus, `dry` legs only: a hidden spring; the safety net on a dry stretch instead of a
  fishing hole), `laurel-hill` (kind `snub`, the Barlow Road only: the rope mini-game), `ice` (lookout, ice-slough's leg
  only: the party digs ice; a card chance), `gold-fever` (lookout, Gold Road only: miners hurry past with gold fever; a laugh
  and the gold-fever card), `swell` (rest, sea only: becalmed, the crew fishes off the side). The toll is not an event: the
  gate is at the start of the Barlow leg. Breakdowns, storms and snow get tier weights (§3.2), not new text.
- **v1.4's per-leg tables** (trail moments, trail facts, the dog's find spots, fishing waters) need entries for every new leg,
  in v1.4's schema; the Content stream adds them. Register Cliff (12 miles past Fort Laramie) and Devil's Gate (5 miles past
  Independence Rock) are too close to a stop to be legs; they are good trail moments.

### 3. Journey contract (`src/journey/*`: pure, no DOM, no clock, no storage)

#### 3.1 Plans and forks (`route.js`)
A journey carries its own plan: `J.route` ('emigrant' | 'gold-road'), `J.branches` ({ [forkId]: optionId } chosen so far) and
`J.plan` (the resolved steps, `[{ id, miles, from, to, n }]`, the defaults filled in past the next unchosen fork). Every
module still reads legs through `legList()` / `legAt(i)`; the sim calls `usePlan(J)` at every entry point (inside
`ensureJourney`), so the module table is the journey's plan. `useLegs(list)` stays for tools.
```js
planRoute(routeId, branches = {}, { year, journeyN }) → plan       // flattens ROUTES[routeId].steps; at each { fork } takes branches[fork]
                                                                   // if open, else the first open option; applies { leg, miles, from } overrides;
                                                                   // numbers n from 1; options not open in that year / journey are skipped
usePlan(J) → legs                                                  // resolves J.plan against LEG_BY_ID (a missing plan = LEGACY_PLAN_12 for a 1.3
                                                                   // journey with legIndex > 0, else the default emigrant plan) and installs it
forkAt(J) → null | { id, at, explainer, lean, options: [{ id, name, line, open, why, legs: n, miles, stores: n }] }
                                                                   // offered when the party has arrived at fork.at, the fork is open for
                                                                   // ledger journeyN (J.journeyN) and not yet in J.branches; `why` says why an
                                                                   // option is closed ("The Lander Road opens in 1858."); a fork with one open
                                                                   // option is never offered (the default is taken silently)
chooseBranch(J, forkId, optionId) → { ok, plan }                   // records J.branches[forkId], replans the rest after the current leg; refused
                                                                   // (ok false) for a closed option or a fork already passed; idempotent
routesOpen(ledger) → [{ id, open, why }]                           // 'emigrant' always; 'gold-road' once ledger has an arrival at 'willamette'
siteOfLeg(legId) → 'willamette' | 'sacramento' | null              // SITES[].ends
planMiles(plan) → n · planStores(plan) → [legId]                   // the trail miles (a voyage leg's sea miles are not trail miles); the forts
```
`legOf`, `nationFor`, `goodOf`, `animalOf` are unchanged; `seasonOf(x)` accepts a tier id, a legacy season id or an object,
and returns the tier with its `priceMult` / `numberMult` (1 / 2 / 4), so `priceAt`, `payFor` and the problems keep working.
`storeLeg(J)` returns, before the first mile, a stand-in for the route's start store (`{ id: start.id, n: 0, fort: { prices:
start.store.prices }, stop: { kind: 'fort', name: start.store.name } }`) so the Oregon City store charges its level 1.3.

#### 3.2 Tiers (`economy.js` numbers, `seasons.js` rules)
```js
export const TIER_FX = {   // Rookie keeps every 1.3 number; the sim tunes Veteran and Pioneer inside these first-pass values
  rookie:  { priceMult: 1, numberMult: 1, startCash: 45,  payFactor: 1.0, startFood: 300, startParts: 1, secondEvent: 0.30,
             breakdownW: 1.0, weatherW: 1.0, extraCold: 'none', animalTire: 1.0, bonusCards: 'none', firstTryTokens: 1, gold: 1.0 },
  veteran: { priceMult: 2, numberMult: 2, startCash: 80,  payFactor: 0.9, startFood: 260, startParts: 1, secondEvent: 0.45,
             breakdownW: 1.5, weatherW: 1.5, extraCold: 'one', animalTire: 1.15, bonusCards: 'perfect', firstTryTokens: 1, gold: 1.25 },
  pioneer: { priceMult: 4, numberMult: 4, startCash: 145, payFactor: 0.8, startFood: 220, startParts: 0, secondEvent: 0.60,
             breakdownW: 2.0, weatherW: 2.0, extraCold: 'all', animalTire: 1.3,  bonusCards: 'every', firstTryTokens: 2, gold: 1.5 } };
```
| | Rookie | Veteran | Pioneer |
|---|---|---|---|
| prices, pay and problem numbers | × 1 | × 2 | × 4 (as 1.3's seasons) |
| start cash | $45 | $80 (× 2 less a tenth) | $145 (× 4 less a fifth) |
| pay on top of the price level | × 1 | × 0.9 | × 0.8 |
| start food / spare parts | 300 lb / 1 | 260 lb / 1 | 220 lb / 0 |
| chance of a second event in a leg | 0.30 | 0.45 | 0.60 |
| breakdown and weather (storm, frost, snow, rain) weights | × 1 | × 1.5 | × 2 |
| cold legs | the `cold` legs | + one more mountain leg a journey (seeded) | every mountains and sierra leg |
| animals tire | × 1 | × 1.15 | × 1.3 |
| bonus cards | — | +1 card on a 3-star leg | +1 card every leg |
| trade tokens for a first-try problem | 1 | 1 | 2 |
| gold found | × 1 | × 1.25 | × 1.5 |
| trophy (the farm's shelf) | bronze | silver | gold |
| learning spine (markers 4–6, three words at a letter or ferry) | unchanged | unchanged | unchanged |
The kid rules hold at every tier: no fail state, every leg arrives, the crawl is still the only penalty for an empty wagon.
`tiersOpen(ledger)` → `{ rookie: true, veteran: ledger has ≥ 1 finished journey, pioneer: ledger has a finished Veteran
journey }` (Trail Blazer's cups pattern: a trophy opens the next cup; Rookie never closes).

#### 3.3 The sim, changed (`sim.js`)
- `createJourney({ route = 'emigrant', tier = 'rookie', year = 1847, journeyN = 1, family = 'own', branches = {}, …1.3 })`:
  `J.season = tier` (the id; legacy 's18xx' still read), `J.tier`, `J.year`, `J.journeyN`, `J.family`, `J.route`,
  `J.branches`, `J.plan = planRoute(…)`, `J.gold = 0` (flakes this journey), `J.letterFrom = 0`; start cash, food and parts
  from `TIER_FX`. `newSeason(J, overrides)` stays, as a thin wrapper over `seasons.startSeason`.
- **Pay follows the miles** (so 20 legs pay what 12 did): `payFor(stars, season, leg)` multiplies 1.3's `PAY` by
  `leg.miles / PAY.refMiles` (`refMiles: 167`, the 1.3 mean leg) and by the tier's `payFactor`; arrival pay is never under
  $1. A voyage leg pays like the raft (`sailPay`). Because a 100-mile leg has 4 markers where 1.3's had 5–6, every-marker-right
  is lit more often; the sim tunes `PAY.star[2]` (first pass 12, was 14) to hold the 1.3 TARGETS.
- **Events**: `planEvents(leg, rand, { hunting, cook, tier, dry })`: the second event's chance is the tier's; breakdown and
  weather kinds weigh `breakdownW` / `weatherW`; on a `dry` stretch no fish, hunt or berries are planned and the safety net is
  the 1.0 "foraged" share (Eli's pemmican) instead of a fishing hole; `spring`, `ice`, `gold-fever`, `laurel-hill`, `swell`
  fire only where §2.9 puts them.
- `tickDay(J, { rand })` returns everything it returned in 1.2 / 1.3 and, new in 1.5: `dry` (true on a day inside the leg's
  `dry` share), `thirsty` (a dry day without the water barrel: −4 spirit, the animals tire × 1.5; with the barrel neither
  happens; never a lost day), `cold` now driven by `leg.cold` and the tier's `extraCold`, and `event.kind` may be `'snub'`
  (the app runs `startSnub`, then `applySnub`) or `'spring'` (spirit +10, nothing else). A voyage leg does not tick: the app
  runs the sail like the raft and sets the miles from the scene.
- `startLeg(J, legId?)` also returns `toll: { dollars, due }` on a `toll` leg (`dollars` = toll × priceMult); the app calls
  `payToll(J)` → `{ paid, iou }` (cash covers it: paid; else `iou: true`, nothing taken, a letter line; never stranded).
- `arrive(J)` returns 1.3's result and, new: `fork` (= `forkAt(J)`, the app asks before anything else), `gold` (`{ pans,
  rich: [indices], rocker }` at a digging, from `goldAt(J)`; the Sacramento claim only from 1848), `post` (a letter is
  written here), `end` (the site id when this was the plan's last leg), `bonusCards` (the tier's), `tierTrophy` on the last leg.
- `foodToNextFort(J)` walks the plan (a store is a `fort` stop; the start store counts at mile 0).
- New: `payToll(J)`, `applySnub(J, { smooth })` (a card chance and a counter for the deed; nothing lost when not smooth),
  `sailPay(J, { bumps })` (`SAIL = { base: 24, perBump: 6, min: 6 }` × priceMult), `isDryDay(J)`.

#### 3.4 Gold (`gold.js`, new; numbers in `economy.js` `GOLD`)
```js
export const GOLD = { flakesPerNugget: 10, panBase: 1, panQuality: 3, richBonus: 2, prospectorBonus: 1, nuggetChance: { rich: 0.35, plain: 0.05 },
                      rocker: { base: 2, perBeat: 4 }, gardenLb: 20, orchardLb: 40 };
goldAt(J) → null | { pans, rich: [i…], rocker }    // the arrived leg's `gold` (Hattie makes one more pan rich); rich indices seeded per leg
panOutcome({ quality, rich, tier, prospector, rand }) → { flakes, nugget }
   // quality 0..1 from the scene's swirl; flakes = round((panBase + round(quality × panQuality) + (rich ? richBonus : 0)
   //   + (prospector && quality ≥ 0.6 ? 1 : 0)) × TIER_FX[tier].gold), never under 1; nugget = rand() < nuggetChance[rich ? 'rich' : 'plain']
rockerOutcome({ beats, tier }) → { flakes }        // beats 0..1 (the share of on-beat rocks); flakes = round((2 + round(beats × 4)) × gold), ≥ 2
applyGold(J, { flakes = 0, nugget = false }) → { flakes: J.gold, nuggets: nuggetsOf(J.gold) }   // a nugget adds flakesPerNugget flakes
nuggetsOf(flakes) → { nuggets, flakes }            // 57 flakes → 5 nuggets and 7 flakes (the pouch shows both)
```
Pure and seeded: the same journey, quality and seed give the same gold. A Rookie Gold Road finds about 50–80 flakes (5–8
nuggets), the California claim about one nugget (§7.2).

#### 3.5 The homestead (`homestead.js`, new; costs in `economy.js` `HOMESTEAD_COST`)
```js
export const HOMESTEAD_COST = {   // Rookie dollars (savings), trade tokens, nuggets (gold); first pass, the sim checks the pacing (§7.2)
  cabin: { savings: 60 }, 'name-plate': { savings: 10 }, well: { savings: 25 }, fence: { savings: 30 }, corral: { savings: 35 }, cow: { savings: 20 },
  garden: { tokens: 4 }, flowers: { tokens: 3 }, mailbox: { tokens: 2 }, bench: { tokens: 3 }, coop: { tokens: 6 }, 'apple-tree': { tokens: 5 },
  barn: { nuggets: 5 }, orchard: { nuggets: 4 }, 'frame-house': { nuggets: 8 }, mill: { nuggets: 6 }, vineyard: { nuggets: 6 }, windmill: { nuggets: 5 },
  schoolhouse: { nuggets: 10 }, 'trophy-shelf': {} };
newFarm() → { sites: {}, savingsIn: 0, savingsOut: 0, goldIn: 0, goldOut: 0, animals: { oxen: 0, mules: 0 }, log: [] }
foundSite(farm, siteId, { name, year }) → site     // { name, founded, pieces: { [id]: count } }; idempotent (the name only fills if empty)
farmBalance(farm) → { savings, flakes, nuggets }    // savings = savingsIn − savingsOut; gold the same, in flakes
canBuild(farm, siteId, pieceId, J) → { ok, why }    // why: 'needs the cabin first' | 'needs 3 more tokens' | 'only at the Willamette farm' | 'built'
buildPiece(farm, siteId, pieceId, J) → { ok, paid: { tokens, savings, nuggets }, count, say }
   // tokens come from J.tokens (the carried purse), savings and gold from the farm (savingsOut / goldOut grow); no decay, no undo needed
bankJourney(farm, J, siteId) → { savings, flakes, animals }   // once per journey (J.banked): savingsIn += floor(J.cash / priceMult) (Rookie dollars,
   // so a Pioneer purse does not inflate the farm), goldIn += J.gold, the team joins the pasture (animals.oxen / mules += J.animals.n)
farmGifts(farm, siteId) → { foodLb }                // garden rows × 20 + orchard 40: added to J.foods.other when a Gold Road starts at that site
homesteadView(farm, siteId) → { name, slots: { [slot]: [{ id, count, art }] }, animals, built: n, of: n, complete, next: [{ id, cost, ok }] }
```
No function reads the clock; nothing in the farm ever goes down except the `…Out` counters that pay for a piece. A farm with
no cabin is a tent and a fire; the game never shows an empty field as a loss.

#### 3.6 Years and carry-over (`seasons.js`, new)
```js
export const CARRY = ['cards', 'deeds', 'tokens', 'upgrades', 'challenges', 'dog'];
export const CARRY_V14 = ['finds', 'fishLog', 'fishJunk', 'fishBest', 'skips', 'wishes', 'questsDone', 'treatsBest', 'goods.spoon', 'opts.farSounds'];
// (the dog itself is in CARRY; collections.js `carry14` does the copying. v1.4's own rule resets what is per season: `quests` in progress, `factsHeard` and `moments`)
newLedger() → { year: 1847, journeys: [], routesDone: [], branchesDone: [], tiersDone: { rookie: 0, veteran: 0, pioneer: 0 },
                trophies: [], lifetime: { legs: 0, miles: 0, flakes: 0, peopleMet: 0 } }
startSeason(prevJ | null, { route, tier, family, animal, companions, seed, ledger, farm }) → J
   // the year is ledger.year, journeyN = ledger.journeys.length + 1; CARRY and CARRY_V14 are copied from prevJ (cards and deeds as
   // lists, the rest as they are); a Gold Road start adds farmGifts; refused (null) for a closed route or tier
closeJourney(J, ledger, farm, { at }) → { site, banked, trophy, firstHere, newRoutes }   // once (J.closed): bankJourney; ledger.journeys.push({ id,
   // at (the app passes the time: the module reads no clock), route, branches, tier, year, end, stars, legs }); routesDone, branchesDone,
   // tiersDone, trophies, lifetime; ledger.year += 1; founds the site if new (the app then asks the name)
unlocksFor(ledger) → { goldRoad, veteran, pioneer, forks: { 'south-pass': journeyN ≥ 2 }, companions: ['packer', 'prospector'] when journeyN ≥ 2 }
```
Carried: the trail cards, the deeds, the trade tokens, the wagon upgrades, the challenge claims, the dog, v1.4's collections,
and (save-level, never on J) the farm, the ledger, the stickers, the letters, the cosmetics and decorations, the sets.
Not carried: cash (banked into the farm's savings), food, goods, the animals' tiredness, the people met (their count goes to
`ledger.lifetime.peopleMet`), the per-journey totals (summed into `ledger.lifetime`).

#### 3.7 Letters, deeds, the rest
- `composeLetter(J, legEvents, words)` tells the legs since the last letter (`J.letterFrom` → the current leg; it picks
  the three liveliest lines across them: a fork, a digging, a river, a stop line `stop:<legId>`), then sets `J.letterFrom`.
  The opening uses `{farm}` when the ledger has a site.
- `DEEDS` grows to 45; `checkDeeds(J, ledger = null, farm = null)` (the old call with J alone still works; the new deeds read
  the ledger and the farm). The 25 new ones:

| id | how |
|---|---|
| long-trail | reach the Willamette Valley on the 20-leg trail |
| california-bound | reach the Sacramento Valley claim |
| barlow | take the Barlow Road (toll paid or owed) |
| laurel-hill | let the wagon down Laurel Hill smoothly |
| shortcut | take the Sublette Cutoff |
| lander | take the Lander Road |
| dry-drive | cross a dry stretch with the water barrel on board |
| ice-in-july | dig ice at Ice Slough |
| axle-grease | write the wagon's name at City of Rocks (the stop's people offer it) |
| gold-road | reach Coloma |
| first-flake | find your first gold |
| nugget | find a nugget |
| gold-fever | bring home 10 nuggets in all |
| rocker | rock the cradle on the beat for a whole round |
| home-by-sea | sail home over the Columbia bar |
| beaver-money | bring gold home to be made into Beaver money |
| every-way | reach both homesteads and Coloma |
| veteran | finish a Veteran journey |
| pioneer | finish a Pioneer journey |
| cabin | build a cabin |
| barn-raising | raise a barn |
| name-plate | hang the name plate with the farm's name |
| full-farm | build every piece at one homestead |
| two-homes | have a homestead at both ends of the trail |
| set-collector | complete three card sets |
- `checkSets(J, setsDone)` → the newly complete set ids (the app pays the decoration and records `save.setsDone`).
- `dailyChallenge` learns the new kinds ("Pan three flakes at Clear Creek", "Cross the Forty-Mile Desert with the barrel").

#### 3.8 Save fields (`save.js`; app-owned, listed here because the journey's functions read them)
The save stays `v: 1` (an older build must not read a newer save as corrupt), and gains, all normalized (normalize drops
what it does not know, so each field below is added to `defaultSave` and `normalize`):
- `ledger` (§3.6), `farm` (§3.5), `setsDone: [setId]`, `cosmetics.owned.decor: [id]` and `cosmetics.equipped.decor: [id, id]`,
  `seen.forks: { [forkId]: true }` (the first-time explanation shown), `journeyResetAt` (§5.6).
- `homestead` (the 1.0 name) migrates into `farm.sites.willamette.name` when a 1.3 save is done in the valley (and stays
  readable for an older build).
- `journey` gains `route`, `tier`, `year`, `journeyN`, `family`, `branches`, `plan`, `gold`, `letterFrom`, `banked`, `closed`.

#### 3.9 Adaptive math (`adaptive.js`, new; the owner's two additions, Nov 1)
Wagon West reads the child's Trail Blazer facts store (`facts`, the shared fact ladder: `trailBlazer.<id>.facts`, or null), and imports the ladder's own
functions (`tierOf`, `tiersFor`, `START_TIER`, `recheckStart`) from `trail-blazer/src/facts/*`, never copies them. Pure: no DOM, no clock.
- **(a) Placement on the first store or marker.** When the ladder is untouched the app offers the Pit Crew Check (`trail-blazer/src/ui/pitCheck.js`) before
  the first store or the first mile marker, whichever comes first, as "Before you answer questions, the pit crew checks what you've got. About 15 quick facts."
  with Start and Later (never a gate, never a timer; "Later" asks again at the next store or marker, at most `PLACEMENT.maxOffers` = 3 times).
  ```js
  needsPlacement(facts, { offered = 0 } = {}) → bool     // true: a store exists, no placement, and no facts history
  hasFactsHistory(facts) → bool                           // any record, any race, any XP, any gate answer, or a placement
  placementSetup(facts, now) → { tiers, start, division } // what Trail Blazer's createCheck needs: tiersFor(facts.sets, facts, now), 'T3' for a first check
                                                          // (recheckStart(facts) for a re-check), whether the ÷ twins are asked
  PLACEMENT = { maxOffers: 3 }
  ```
  The app shows the check through whatever Trail Blazer screen hook it has (`createPitCheck(app, gatePanel).run({ kind: 'first' })`, or its own panel
  over `createCheck` with `placementSetup`); the answers go through `recordAnswer` like every other fact, so the frontier, and with it the next decision (b),
  moves at once. `needsPlacement(null)` is false (no store to read, nothing to offer).
- **(b) Problem shape scales with the ladder.** `problemFor({ …, tier })` takes `tier` 0 | 1 | 2 from `problemTierFor(facts)`, the highest tier of the
  child's frontier (`facts.frontier.families`, ÷ families counted at their × family, so ÷2 is not "big numbers"):
  | tier | frontier | shapes |
  |---|---|---|
  | 0 | through ×5 (+ −, ×2 ×5 ×10, ×3 ×4) | exactly the 1.3.3 shapes |
  | 1 | ×6 to ×9 (T3, T4) | exactly the 1.3.3 shapes |
  | 2 | above (×11 ×12, tens, teens, big numbers) | **ration** and **distance** become two steps asked in turn (`parts`, `answers`): the pounds eaten on the way (the fact) and the pounds left; the miles left (a subtraction) and the days (the fact ÷), or the miles gone (the fact ×) and the miles still to go. A **buy** adds a change-back step: "You pay with a $50 bill. How much is that, and how much change do you get back?" (the bill is the smallest of 5, 10, 20, 50, 100, 200, 500 over the total that the purse can hold; none fits: the one-step buy). |
  The other kinds (divide with its remainder, parts, trade) are the same at every tier. `problemTierFor(null)` is 1 (the shapes of 1.3.3); a fresh ladder (the
  first families on the frontier) is 0. For a two-step problem `answer` is the answer of the **step that holds the fact** (so a wrong answer is still recorded
  against the right fact), `answers` are all of them in order, `parts` is the panel's `[{ text, say, answer, unit }]` (the panel already asks `parts` in turn), and
  **`asked` keeps reporting the fact the sentence really asks** (1.3.3): the × of the two numbers the fact step names, or the ÷ with its total. The numbers
  stay whole and under 1,000; `say` and every part's `say` have no digits.
- Tests: `needsPlacement` (fresh, played, placed, XP, null, three offers), `problemTierFor` for every family, tiers 0 and 1 byte-equal to the untiered call
  over every kind, tier 2's shapes, `asked`, the purse cap, determinism. The sim kids carry a ladder tier by profile (strong 2, average 1, weak 0): a two-step
  problem costs a little more time (`SEC.problemStep`).

#### 3.10 Journey stream notes: what was built, and where it differs from §3 (for the integrator)
- **Deeds: 53, not 45.** §3.7's "45" is 20 + 25 and pre-dates v1.4's eight; the 25 new ones are as the table, so `DEEDS.length` is 53 (20 + 8 + 25). The Journal's "Deeds (45)" is `DEEDS.length`.
- **A due event may share a marker day, and the dog's nose too** (`tickDay`). On a 60-110 mile leg with 5-6 markers almost every travel day is a marker day: the SPEC's "an event only on a day without a marker" fired
  only 46 % of the planned events (none on the 60-mile legs, so Ice Slough's ice never fired). Now a due event fires after the marker (the app asks the marker first, as for the safety net, v1.2), the nose
  may share a marker day (and, past the leg's half with nothing yet, an event day), while the trail fact and the dust devil still need a day with nothing else. `planEvents` no longer nudges an event off a marker
  mile where the markers are closer than 24 miles; a fort leg plans one event (its session is the store, the post office and the derby). **The App must play `res.marker`, then `res.event` / `res.nose`, in that order on one day.**
- **Markers: `MARKERS = { spacing: 24, min: 5, max: 6 }`** (was 30 / 4 / 6): a 60-144 mile leg has 5, a longer one 6. Why: legs are 100 miles on average now, and the 1.3 four-to-six had become four on every leg.
- **Pay**: `PAY = { arrival: 4, star: [1, 3, 14], refMiles: 167 }`: the SPEC's first pass star[2] 12 held the 1.3 money targets but left the strong kid short of the yoke; 14 is 1.3's own number.
  `payFor` of a voyage leg is that of a 100-mile leg; the sail pays `sailPay`.
- **Laurel Hill pays** (`SNUB = { cardChance: 0.5, smooth: 20, bumpy: 10 }` × the price level, in `applySnub` → `{ smooth, card, cash }`): the Barlow Road has no raft, and §7.2's "end cash within $10 of the raft's minus the toll" needs the slide to pay what the raft pays.
- **Tiers**: Veteran `breakdownW` 1.4 and Pioneer 1.7 (the SPEC's 1.5 and 2.0 gave the Pioneer more than two limps a journey on the 850-mile California stretch with no store). Everything else is §3.2 as written.
- **Homestead costs tuned** (`HOMESTEAD_COST`, §7.2 `--homestead`): cabin $40; token pieces 15-50 tokens (garden 30, flowers 20, mailbox 15, bench 20, coop 50, apple tree 45: the tokens' sink, about half of a farm-building kid's tokens);
  gold pieces barn 5, orchard 4, frame house 7, mill 5, schoolhouse 8 nuggets (29 in all; vineyard 6, windmill 5). Result: cabin after journey 1 for every kid, the average kid's barn at journey 2.3, every Willamette piece at journey 7.2 (7-9), the strong kid's at 5.2 (5-6).
- **Small additions** the SPEC does not name: `writeOnRock(J)` (City of Rocks, counts the 'axle-grease' deed), `applyGold(J, { flakes, nugget, rocker })` with a `rocker` beats value counts a round (and an on-the-beat one for the 'rocker' deed), `mergeWw15`, `mergeLedger`, `mergeFarm`, `normalizeLedger`, `normalizeFarm`
  (the App's save.js / sync.js may call these instead of rewriting them), `J.tale` / `J.letterMemo` (so a letter can tell the legs since the last one and composing twice gives the same text), `J.xcold` (the Veteran's extra cold leg), `legacyTrail()` (the 1.3 twelve legs as leg objects),
  `completedSets`, `homesteadView(farm, site, J)` takes the journey for the tokens and returns `next: [{ id, cost, ok, why }]`, `canBuild` also returns `code`.
- `syntheticTrail(n)` stays the 1.3 twelve-leg helper (the long trail's other routes are the real content now); the 1.3 / 1.4 tests run on `legacyTrail()`, which is also what a 1.3 journey in progress keeps (`LEGACY_PLAN_12`, `planLocked`).

### 4. Scene contract (`src/scene/*`)

#### 4.1 Five new biomes (`biomes.js`: `BIOME_IDS` gains them; palettes and the five layer painters, painted once per size)
| id | where | far / mid / near / ground / props |
|---|---|---|
| basin | the Humboldt, the Big Meadows, the Forty-Mile Desert | pale blue ranges / alkali flats and low gray hills / greasewood and sage / white-crusted sand with ruts / willow clumps by the river (none on a dry day: `setTravel({ dry })` hides the water) |
| sierra | the Sierra summit, Castle Crags | granite domes with snow / dark fir ridges / tall pines and boulders / granite slabs / a snowbank, a cold stream |
| siskiyou | the Umpqua, Canyon Creek, the Rogue, the Siskiyou pass, Mount Shasta | blue ridges (Mount Shasta's cone on the Shasta legs) / oak and madrone hills / Douglas firs / river gravel and ferns / blackberry tangles |
| goldcountry | the Sacramento Valley, the diggings | low foothills / golden grass and valley oaks / oak trees / red earth / miners' tents, sluice boxes, a rocker by the creek (friendly figures waving; no fights, no weapons) |
| sea | the voyage home | the coast far off / long swells / the schooner's rail / the deck / gulls, a seal on a rock, the Columbia's mouth at the end |

#### 4.2 Paintings and backdrops (`backdrops.js`)
`PAINTINGS` gains a painting for every new landmark (`leg.painting` names it; the loose `paintingFor` match stays the
fallback, so a leg with no painting gets the generic butte, never an error): alcove-spring (a ledge waterfall), ash-hollow
(the hollow and Windlass Hill), scotts-bluff, ice-slough (a marsh with a spade and blocks of ice), farewell-bend (the river's
bend), sublette-cutoff (empty sage flats), bear-river, lander-road (a new road through aspen), barlow-road (Mount Hood and a
toll gate), raft-river (a signpost on a bluff), city-of-rocks (granite spires), humboldt-wells (springs in the grass),
big-meadows, forty-mile-desert (a white flat, water barrels on the wagon), sierra-summit (a granite pass), calapooya-mountains,
canyon-creek (a narrow creek canyon), table-rocks (the Rogue leg's approach), siskiyou-pass, mount-shasta, castle-crags,
clear-creek (miners at a gravel bar), adobe-fort (Sutter's Fort: white adobe walls and a central building), coloma (the
sawmill and its water channel), home-by-sea (a schooner), sacramento-claim (a cabin among valley oaks). New backdrops:
`BACKDROPS` gains `'homestead'` (§4.4), `'diggings'` (a creek bank with the pan close-up layer for panning) and `'sea'` (the
schooner's deck for the voyage). Sutter's Fort uses the fort backdrop with `fortStyle: 'adobe'` (set from the leg's painting).

#### 4.3 New mini-games (each ends with `endMiniGame()`, each emits per-step and end events; cartoon-clean, nothing breaks)
```js
scene.startPan({ seed, pans, rich: [i…] })   // per pan: scoop (tap), swirl (circle drag fills the meter; or taps on the beat), tip (tap when the
   // rim glows: the light sand washes over the lip), then 'panSwirled' { n, quality 0..1 }; the scene waits for scene.panReveal({ flakes,
   // nugget }) (the app asks gold.panOutcome) and shows the flakes glinting in the pan, a nugget with a sparkle; 'pan' { n, flakes, nugget };
   // after the last, 'panEnd' { pans }. Rich pans glint before the scoop (a hint, not a timer).
scene.startRocker({ seed, rounds })          // rock left / right on the beat while water pours (taps or ← →); 'rockerRound' { n, beats 0..1 };
   // waits for scene.rockerReveal({ flakes }); 'rockerEnd' { rounds }
scene.startSnub({ seed, drops: 3 })          // Laurel Hill: the wagon on a rope round a stump; HOLD (press, or Space) to let it slide on the smooth
   // stretches, let go at each ledge marker; 'snub' { good } per drop, 'snubEnd' { smooth }; not smooth = the wagon bumps down in a
   // cloud of dust and everyone laughs: it never breaks or runs away
scene.startSail({ seed, length })            // the voyage: steer the schooner through swells (drag or ← →); 'sailMarker' { n, of } at four points
   // "Up the coast" (it waits for scene.sailGo()); 'sail' { bump }; the last stretch is the Columbia bar (bigger swells, then calm
   // water and Oregon's green shore); 'sailEnd' { bumps }
```
Also: `setParty({ …, wagon: { …, decor: [id, id] }, packMules: true })` (decorations drawn on the wagon; two pack mules walk
beside it on the Gold Road), `setTravel({ …, dry })` (a dry day: heat shimmer, no water in the props), `spotAnimal` learns the
new wild cards' animals (beaver, sage grouse, meadowlark, tule elk, osprey, pika, river otter, mountain quail).

#### 4.4 The homestead scene
```js
scene.setBackdrop('homestead')
scene.setHomestead({ site: 'willamette' | 'sacramento', name, pieces: { [id]: count }, animals: { oxen, mules }, dog, decor: [ids],
                     party: [{ id, hat, color }], trophies: ['bronze', …] })
scene.buildPiece(id)        // the raising: for the barn and the houses a frame goes up in three beats while the companions hammer, then a cheer
                            // and confetti; small pieces pop in with a puff; 'buildDone' { id }
// events: 'homesteadTap' { slot, piece | null } (the app shows that piece, or what can go there)
```
Drawing: `HOMESTEAD_SLOTS` left to right (edge, orchard, barn, house, yard, garden, creek, pasture, gate) on the valley (or
goldcountry) biome's layers; each piece has sprites for each count (up to six apple trees, four garden rows, eight animals in
the corral, the dog on the porch). Before the cabin: a tent and the campfire. The frame house replaces the cabin's art. The name
plate draws the farm's name (drawText). The trophy shelf shows the plates on the porch. Painted once per (site, pieces hash,
size) like the set pieces; the animals, smoke, chickens and the weathervane animate. No piece ever looks worn or empty.

#### 4.5 Tests and the dev page
`dev.html`: `?biome=basin|sierra|siskiyou|goldcountry|sea`, `?backdrop=homestead&site=willamette&pieces=cabin,barn,apple-tree:3`,
`?pan=1`, `?rocker=1`, `?snub=1`, `?sail=1`, `?decor=pennant-chimney,brass-bell`. `tools/scene-smoke.mjs`: every new biome and
backdrop renders with no errors (screenshots); every leg id of every plan resolves to a painting other than 'generic'; the
homestead at both sites with no pieces, some, and all (screenshots), and `buildPiece` for the barn emits `buildDone`; the pan,
the rocker, the snub and the sail each run to their end with scripted input, good and poor (the poor run still ends, with at
least one flake from the app's stub), perf under the 1.0 budget with the homestead and the sea.

### 5. App contract (`src/main.js`, `src/ui/*`, `src/meta/*`)

#### 5.1 The title and the map
`drawMap` draws from the legs' `map` points: the emigrant trunk, the three forks (each option as its own line), the Gold Road
south from the Willamette farm to Coloma, and the voyage as a dotted line up the coast. Lines travelled (`ledger.branchesDone`,
`routesDone`, and the current journey so far) are inked in the wagon's paint colour; lines not yet travelled are drawn faint
and dashed but always visible (the choice is never hidden; a closed option, like the Lander Road before 1858, has a small
lock and "1858"). The farms show as small cabins at their `map` points that grow with `homesteadView().built` (tent, cabin,
farm with barn, full farm); tapping one opens the homestead. The family's wagons stay as in 1.2. The buttons: **Hit the
trail** / **Keep going** (in a journey), **A new year** (no journey, or done), **The farm** (once a site exists), Journal,
Outfit, Parents; the line under the map names the year, the tier and the route ("1849 · Veteran · The emigrant trail").

#### 5.2 A new year (`src/ui/yearPicker.js`, new screen `#year`)
Three steps, each one tap and a Back: **Where**: two cards, "The emigrant trail" (from Independence: "Oregon or California:
you choose at Fort Hall") and "The Gold Road" (from your farm; while locked: "Reach the Willamette Valley to hear the news");
**How hard**: three tier cards (Trail Blazer's cup cards: the name, the blurb, the changes in plain words from §3.2, locked
cards say how they open; Parent Zone can keep it to Rookie); **Who**: Outfit (the family wagon from the second journey on, the
animals, three companions; Mateo and Hattie from the second journey). The first ever journey skips Where and How hard (it is
the emigrant trail at Rookie), so a new child is on the trail as fast as 1.3.

#### 5.3 On the trail
- **Fork panel** (`src/ui/forkPanel.js`): opens on `arrive().fork`, before the stop's other scenes; the explainer's portrait
  and name, the question ("Which way from Fort Hall?"), one card per option (name, its one line, "legs · stores" in words: "9
  more stops · no store"), each with a button of the same size and a Hear it; the first journey reads the lean line and focuses
  the lean option; a closed option shows why. Leaving keeps the fork pending (the title says "A choice at Fort Hall"). The
  choice is a toast and a letter line.
- **Toll** (Barlow): a card at the leg's start, "Pay the toll" (or, when short, "The toll keeper writes an IOU").
- **Diggings** (`src/ui/diggings.js`): on `arrive().gold`, the `diggings` backdrop and the pan (and the rocker at Coloma),
  with the gold pouch in the corner ("3 nuggets · 7 flakes"); each reveal is said ("Five flakes!"); the child can stop and come
  back to the creek while still at the stop; when the Parent Zone turns panning off, the gold is given as a find with one card.
- **The voyage** runs like the raft (`runSail`, the four markers on the marker panel titled "Up the coast").
- **Arriving home**: results ("Home!"), then the bank card ("+$74 in savings · 6 nuggets of Beaver money · 2 oxen to the
  pasture"), then naming the farm when it is new (1.0's homestead keyboard), then the homestead screen.

#### 5.4 The homestead (`src/ui/homestead.js`, new screen `#farm`)
The scene's homestead backdrop with a build tray: the three purses (trade tokens · savings · Beaver money), the pieces grouped
by purse with their cost and what they need, **Build** (a tap; greyed when short, with the reason), and on savings pieces an
optional **Work it out** ("The well costs $25 and the farm has $63. How much is left?": a 'buy' problem for a token, the 1.2
store rule); a site switcher when there are two; a tapped piece says its line and its fact. Building plays `buildPiece` and
may earn a deed. No timers, no "come back tomorrow", no notifications.

#### 5.5 The journal, Outfit, results
- **Journal** (six pages): Letters; Stickers (tabs by route: Oregon, California, Gold Road, Shortcuts); Map (every route, the
  farms); Cards (suits, and a Sets tab with each set's progress and its decoration); Deeds (45, grouped: the trail, the
  routes, gold, the farm, collections); **Farm** (new: each site's pieces, the farm log, "1848: raised the barn with gold
  from Coloma", the trophy shelf, the gold pouch with Beaver coins).
- **Outfit**: the family wagon (journey 2+), the two new companions, Look: the `decor` kind with two slots.
- **Results**: the tier's badge, the bonus cards, the gold found on a digging leg, a set completed (its decoration).

#### 5.6 Save and sync (`src/meta/save.js`, `src/meta/sync.js`)
Save fields as §3.8. The `ww` merge (`mergeWw`) adds, and every rule is a union or a max so that a doc written by an older
build (which drops the new fields) never erases them:
- `ledger`: `journeys` union by id (the journey's season + seed), the newest 60 kept; `year` max; `routesDone`,
  `branchesDone`, `trophies` union; `tiersDone` per tier max; `lifetime` per field max.
- `farm`: `sites` union by id; per site the name is the later doc's, else the other's; `founded` min; `pieces` per id max
  count (a piece built on either device stays built); `savingsIn`, `savingsOut`, `goldIn`, `goldOut` each max (so a balance
  is never conjured from nothing, and a spend on one device and an earning on the other both survive); `animals` per kind max;
  `log` union, the newest 30.
- `setsDone` union; `cosmetics.owned.decor` union; `equipped.decor` the later doc's (owned only); `seen.forks` OR.
- `journey`: 1.3's rules (the later doc's journey; cash and tokens max on the same journey; cards, deeds, met unions); on the
  same journey `gold` max and `branches` union (a fork chosen on either device is kept; the plan is rebuilt by `usePlan`).
- v1.4's fields: `merge14(s.journey, o.journey)` (collections.js, v1.4 §3.7): `finds` per id max · `fishLog` per species n max with the bigger `bestIn` and its lb / leg · `fishJunk` per kind max · `fishBest` the bigger · `skips.best`, `skips.throws` max, `byRiver` per key max · `wishes` and `questsDone` union · `treatsBest` max · `dog` the later doc's, `treats` max · and on the same journey `quests` per id the further state, `factsHeard` union, `goods.spoon` max. The Journey stream's `mergeWw15(s, o)` (seasons.js) does every rule of this list in one pure call (and calls `merge14`); `mergeLedger` and `mergeFarm` are its two parts.
- `resetAt` still wins whole. Parent Zone's new "Reset this journey only" stamps `journeyResetAt` and keeps the farm, the
  ledger, the cards and the sets (a merge drops the other side's journey when it is older than the stamp).

#### 5.7 Parent Zone touch points
Journey: the route, the tier, the year, the forks chosen, a table of journeys finished (year · route · tier · stars), the
farm in one line ("Willamette farm: 9 of 18 pieces"), "Reset this journey only" and the full reset (which now says it
clears the farm too). Options: "Let the child choose how hard" (on; off = Rookie only), "Gold panning" (on; off = the gold
as a find). Report: legs by route; the learning tallies unchanged; Copy report adds the route and the tier.

#### 5.8 Voice (the 1.3.2 `speech` rules: a clip or silence, never the device voice while the natural voice is in use)
`collectVoiceTexts` adds every new lookout, nation fact, person line and gift, every fork line (every option, the lean line,
`lineFrom1849`), the tier blurbs, the family names, the piece names, says and facts, the set names and says, the decoration
names, the gold cards, and the fixed mini-game lines ("Scoop!", "Swirl, swirl!", "Tip it now!", "Look at that gold!", "A
nugget!", "Rock it!", "Hold the rope!", "Let go!", "Up the coast!", "Over the bar!"). Prepared ahead in 1.3.2's order, with
**the fork's lines in the leg before a fork** and the diggings' lines in the leg before a digging. Said just in time (never
ahead): the flake counts ("Seven flakes!"), the bank line, the farm's name plate line, the toll with its amount. Mini-game cue
lines are short `say` lines and must be in the prepared list (a cue that waits for a clip is worse than none);
`tools/content-audit.mjs` checks them like every other spoken string.

#### 5.9 App stream notes: what was built, and where it differs from §5 (for the integrator)
- **Built**: the title map with every route, fork, farm and the lines travelled (`src/ui/map.js`); the year picker (`yearPicker.js`); the Outfit's Family step, Mateo and Hattie and
  the decor kind in Look (`outfit.js`, `looks.js`: `LOOK_KINDS` gains `'decor'`, `equipped.decor` is a list of two); the fork panel (`forkPanel.js`); the Barlow toll with the IOU,
  Laurel Hill (`startSnub` / `applySnub`), dry-stretch lines, the Humboldt without a ferry; the Gold Road start (the news card, the farm's food, the Oregon City store), the diggings
  (`diggings.js`: the pan, the cradle, the pouch), the voyage (`startSail`, four "Up the coast" markers, `sailPay`); the bank card on the results, the farm's name on the 1.0
  keyboard and the homestead screen (`homestead.js`); carry-over through `startSeason` / `closeJourney`; the journal's pages (Stickers by route, Map with the roads travelled,
  Cards → Sets, Deeds (53) in five groups, Farm); the Parent Zone touch points; the Pit Crew Check; tiered problems; `voiceTexts.js` for every new line; `save.js` / `sync.js` for the
  new fields and `mergeWw15`; `VERSION` '1.5.0', `sw.js` `wagon-west-v1.5.0`, the README.
- **Deviations from §5**: (1) the Pit Crew Check runs on Wagon West's own marker panel in a new `mode: 'check'` over Trail Blazer's `createCheck` / `checkNext` / `checkAnswer` /
  `applyCheck` (`pitCheck.js` is married to Trail Blazer's DOM); the offer is the `needsPlacement` card ("Start" / "Later", three times at most, counted in `save.seen.placeOffers`).
  (2) The fork panel opens after the stop's lookout card (not before it), still before the Talk row, the river, the store and the post office; the fork is read with `forkAt(J)`, not
  `arrive().fork` (`arrive()` pays the leg, and the cash must not reach the fort's store before the results do). (3) "Reset this journey only" starts the same journey over (a fresh
  `startSeason` from the old one: same wagon, team and party, mile 0, what is carried kept) and stamps `journeyResetAt`; it does not leave the child with no journey. (4) "Let the child
  choose how hard" and "Gold panning" are device settings like Hunting (`settings.chooseTier`, `settings.panning`), not synced. (5) The journal has eight pages, not six: v1.4's Finds
  and Fish log stay. (6) The "Gold fever" card is handed out by the Nisenan guide at Coloma (a card the guide shows with its own words); the comic gold-fever event hands out nothing
  (and the lookout events with `animal: null` spot no animal). (7) The farm's "Work it out" (a 'buy' problem: what is left in savings) is offered once per piece (`save.seen.worked`),
  so a token cannot be farmed. (8) The bank card sits in the results' left card (the right one scrolls on a short screen), with the trophy plate. (9) Playtest 1.4 U5 (twelve skips on
  every throw): the stones game ends at the first throw that skips as far as a stone can (`MOMENTS.stones.maxSkips`); the window itself is the scene's (±180 ms).
- **Needs integration with the real scene** (the mock scene runs all of it; names as §4): `setBackdrop('diggings' | 'sea' | 'homestead')`, `setLeg({ painting, dry, voyage })`,
  `setParty({ wagon: { decor }, packMules })`, `setTravel({ dry })`, `setHomestead({ site, name, pieces, animals, dog, decor, party, trophies })`, `buildPiece(id)` → `buildDone`,
  the events `homesteadTap { slot, piece }`, `panSwirled { n, quality }` (the app answers `panReveal({ flakes, nugget })`) / `pan` / `panEnd`, `rockerRound { n, beats }` (the app
  answers `rockerReveal({ flakes })`) / `rockerEnd`, `snub { good }` / `snubEnd { smooth }`, `sailMarker { n, of }` (the app answers `sailGo()`) / `sail { bump }` / `sailEnd { bumps }`.
  The app says the cue lines itself ("Scoop!", "Swirl, swirl!", "Tip it now!", "Look at that gold!", "Rock it!", "Hold the rope!", "Let go!", "Up the coast!", "Over the bar!").
- **For the journey stream** (not fixed here, files not ours): `LETTER_CLOSE` holds 'Home soon, with gold!' and `withFarm` only drops the `{farm}` lines, so an emigrant letter can close with it; §5's comment says it belongs to the way home on the Gold Road only (LETTER_GOLD.close).
- **App robustness added in the integration pass**: each `runStop` holds a run number (a stop that was left, by "Stop for today" or a jump, never carries on into the store, the post office or the results); a card pop that a toast overlaps in the instant it was drawn steps back (cards.js); a pop waits for a clear place only on the camp and store screens (toasts.js `POP_CLEAR_SCREENS`), as the trail's HUD is laid out around pops.
- **Tests**: `tools/ui-smoke.mjs` (`LT_ONLY=1` for the v1.5 sections, `LT_SECTIONS=…`), `tools/sync-smoke.mjs` (the farm merge scenario), `tools/content-audit.mjs` (all 45 legs, the new texts).

### 6. Streams and file ownership (four Sonnet agents, from the same commit after v1.4 is merged; the orchestrator integrates)
Never touch another stream's files; never touch `car-jump/`, `trail-blazer/`, `fraction-fright/`, `spell-jump/`, `site/`,
`build.sh`, `netlify.toml`. Each stream codes against the shapes in §2–§5; until Content lands, the journey and the tools run
on `route.syntheticTrail()` grown to every route (the Journey stream extends it).

| Stream | Owns | Delivers (exact exported names) |
|---|---|---|
| **Content** | `src/content/*` (legs.js, routes.js new, tiers.js new, families.js new, homestead.js new, lookouts.js, nations.js, people.js, letters.js, cards.js, companions.js, events.js), `docs/SOURCES.md`, `docs/LEARNING-DESIGN.md` | legs.js: `LEGS` (the 20-leg default plan), `ALL_LEGS`, `LEG_BY_ID`, `TOTAL_MILES` (of `LEGS`), `SEASONS`, `SEASON_BY_ID`, `ANIMALS`, `ANIMAL_BY_ID`, `GOODS`, `GOOD_BY_ID` · routes.js: `ROUTES`, `FORKS`, `LEGACY_PLAN_12`, `SITES`, `SITE_BY_ID` · tiers.js: `TIERS`, `TIER_BY_ID` · families.js: `FAMILIES`, `FAMILY_BY_ID` · homestead.js: `HOMESTEAD_PIECES`, `PIECE_BY_ID`, `HOMESTEAD_SLOTS` · lookouts.js: `LOOKOUTS` (+ the 33 new ids and `gold-news`) · nations.js: `NATIONS` (+11), `NATION_BY_ID`, `TRADE_GOOD_NAMES` (+acorns, pinenuts, trout), `FALLBACK_TRADES` · people.js: `PEOPLE` (+~80 and Agnes), `PERSON_BY_ID`, `PEOPLE_BY_STOP` · letters.js: `LETTER_LINES` (+`stop:<id>` and the §2.9 keys), `LETTER_OPEN`, `LETTER_CLOSE`, `LETTER_PS` · cards.js: `SUITS` (+'gold'), `SUIT_NAMES`, `CARDS` (~110), `CARD_BY_ID`, `cardsOf`, `CARD_SETS`, `SET_BY_ID`, `DECOR`, `DECOR_BY_ID` · companions.js: `COMPANIONS` (+packer, prospector with `fromJourney: 2`), `COMPANION_BY_ID`, `SKILL_BY_COMPANION` · events.js: `EVENTS` (+spring, laurel-hill, ice, gold-fever, swell), `EVENT_BY_ID` · v1.4's per-leg tables for every new leg · SOURCES for every new fact and person · LEARNING-DESIGN rows for the forks (agency), the farm (progress the child sees) and gold's place value |
| **Journey** | `src/journey/*` (route.js, sim.js, economy.js, events.js, letters.js, deeds.js, stars.js, challenge.js, skills.js, supplies.js; new: seasons.js, homestead.js, gold.js), `tools/journey-tests.mjs`, `tools/economy-sim.mjs` | route.js: `planRoute`, `usePlan`, `forkAt`, `chooseBranch`, `routesOpen`, `siteOfLeg`, `planMiles`, `planStores`, and 1.3's `useLegs`, `legList`, `legAt`, `legIndexOf`, `legOf`, `seasonOf`, `tierOf`, `nextSeasonId`, `animalOf`, `goodOf`, `nationFor`, `syntheticTrail` · economy.js: `PAY` (+`refMiles`), `TIER_FX`, `GOLD`, `SAIL`, `HOMESTEAD_COST`, `payFor(stars, season, leg)` and every 1.3 export · sim.js: 1.3's exports (createJourney, tickDay, … newSeason) changed as §3.3, plus `payToll`, `applySnub`, `sailPay`, `isDryDay`, and re-exports of the new modules · seasons.js: `CARRY`, `CARRY_V14`, `newLedger`, `startSeason`, `closeJourney`, `tiersOpen`, `unlocksFor`, `yearOf` · homestead.js: `newFarm`, `foundSite`, `farmBalance`, `canBuild`, `buildPiece`, `bankJourney`, `farmGifts`, `homesteadView` · gold.js: `goldAt`, `panOutcome`, `rockerOutcome`, `applyGold`, `nuggetsOf` · deeds.js: `DEEDS` (45), `DEED_BY_ID`, `checkDeeds(J, ledger, farm)`, `deedMet`, `checkSets` · letters.js: `composeLetter` (since the last letter), `keepLetter` |
| **Scene** | `src/scene/*` (biomes.js, backdrops.js, engine.js, render.js, sprites*.js, rafting.js; new: homestead.js, gold.js (pan and rocker), snub.js, sail.js), `dev.html`, `tools/scene-smoke.mjs` | `BIOME_IDS` (+5), `BACKDROPS` (+homestead, diggings, sea), `PAINTING_IDS` (+27), `paintingFor` (reads `leg.painting` first); scene methods `startPan`, `panReveal`, `startRocker`, `rockerReveal`, `startSnub`, `startSail`, `sailGo`, `setHomestead`, `buildPiece`, `endMiniGame` (ends any of them); `setParty({ wagon: { decor }, packMules })`, `setTravel({ dry })`; events `panSwirled`, `pan`, `panEnd`, `rockerRound`, `rockerEnd`, `snub`, `snubEnd`, `sailMarker`, `sail`, `sailEnd`, `homesteadTap`, `buildDone`; `getState().mini.kind` gains 'pan', 'rocker', 'snub', 'sail' |
| **App** | `index.html`, `src/main.js`, `src/ui/*` (title.js, map.js, outfit.js, results.js, journal.js, cards.js, deeds.js, looks.js, parentZone.js, store.js, river.js; new: yearPicker.js, forkPanel.js, diggings.js, homestead.js), `src/meta/*` (save.js, sync.js, mockScene.js, voiceTexts.js; speech.js unchanged), `sw.js`, `manifest.webmanifest`, `tools/ui-smoke.mjs`, `tools/sync-smoke.mjs`, `tools/content-audit.mjs`, `tools/playtest-full.mjs`, `README.md` | `createYearPicker`, `createForkPanel`, `createDiggings`, `createHomestead` (each `{ show, hide }` like the other screens); save.js: `defaultSave` / `normalize` with §3.8's fields, `normalizeLedger`, `normalizeFarm`; sync.js: `mergeWw` with §5.6, `mergeLedger`, `mergeFarm`; looks.js: `LOOK_KINDS` (+'decor'); mockScene.js: the §4 methods scripted (`?mockPan=0.8`, `?mockSnub=1`, instant), `__mock.lastHomestead`; voiceTexts.js: `collectVoiceTexts` with §5.8; VERSION '1.5.0', sw `wagon-west-v1.5.0`, README "1.5" |

Order: Content and Journey first (in parallel; Journey on the synthetic trail), then Scene and App (in parallel, App on the mock
scene). The orchestrator merges, wires the real scene, fills `CARRY_V14` and the v1.4 merge line, runs every suite, plays
the two-route playtest at iPhone size, commits "Wagon West 1.5: The Long Trail", and holds the push for the owner.

### 7. Tests and acceptance

#### 7.1 Journey tests (`tools/journey-tests.mjs`, node)
- Plans: the default emigrant plan is 20 legs and 2,000 miles; the four forts sit at cumulative 320 / 620 / 1,090 / 1,300;
  every option combination resolves (3 × 2 × 2 = 12 emigrant plans, the Gold Road), every leg 60–160 trail miles (the voyage
  excepted), every leg id in `LEG_BY_ID`, every `nation` in `NATION_BY_ID`, every `lookout` in `LOOKOUTS`, every leg a card.
  California is 24 legs and about 2,150 miles; the sublette plan is 40 shorter, the lander plan 60 shorter.
- Forks: `forkAt` is null before the stop and after a choice; the first journey never offers south-pass; the Lander Road is
  closed before 1858 and open from it; `chooseBranch` replans only after the current leg and refuses a closed option; a 1.3
  journey in progress keeps its twelve legs (`LEGACY_PLAN_12`) to the end.
- A full journey on every plan and tier with always-right and always-wrong answers arrives (no fail state); food never
  negative; markers 4–6 every leg; events never repeat a kind in a leg; dry days only on `dry` shares; no fish, hunt or
  berries planned on a dry stretch; the toll never takes cash below $0 (an IOU instead).
- Tiers: the §3.2 numbers are applied (start cash, food, parts, pay factor, weights, cold legs, bonus cards, tokens, gold);
  `tiersOpen` per the ledger; `seasonOf('s1850')` is Veteran.
- Gold: `panOutcome` is ≥ 1 flake for every quality and tier, deterministic for a seed, never NaN; `rockerOutcome` ≥ 2;
  `nuggetsOf(57)` is 5 and 7; the Sacramento claim digs only from 1848.
- Homestead: costs and `needs`; a site-only piece refused at the other site; `buildPiece` pays from the right purse and never
  below zero; `bankJourney` and `closeJourney` are idempotent; savings banked in Rookie dollars; `farmBalance` is in − out;
  nothing in `farm` depends on time (the same calls a month apart give the same farm).
- Carry-over: `startSeason` keeps `CARRY` and `CARRY_V14`, resets cash, food, goods, people met; the year moves by one; the
  Gold Road start adds `farmGifts`.
- Deeds and sets: all 45 deeds reachable on some plan (each test passes in the sim); `checkDeeds(J)` without a ledger still
  works for the 20 old ones; `checkSets` once per set; the letter tells only legs since the last letter.

#### 7.2 Economy sim (`tools/economy-sim.mjs`; `--route emigrant:oregon:main:columbia | …:california | …:sublette | …:lander |
…:barlow | gold-road`, `--tier rookie|veteran|pioneer`, `--homestead`; `--check` runs the matrix)
| cell | targets (--check) |
|---|---|
| Rookie, Oregon by Fort Bridger and the raft (the 1.3 trail grown to 20 legs) | **the 1.3 TARGETS unchanged** (end cash by eye strong $70–150 / average $40–100 / weak $25–80, the gaps, no kid over $220, fort cash at Kearny, Laramie, Bridger, Hall, choices of 5 stores, the yoke rules, the weak player lean and finishing); sessions 20 ± 2 (was 12 ± 2; a leg a session); leg minutes mean 8–10, max ≤ 14; soaked sacks < 1 a leg; limps < 1 a season; tokens 60–140 a journey (was 3–10 a leg) |
| Rookie, Barlow Road | as above, end cash within $10 of the raft's minus the toll |
| Rookie, Sublette Cutoff | fort cash at Kearny, Laramie and Hall as above (Bridger skipped), choices of 4 stores; no kid more than 3 days in a row with no food; the water barrel owned by ≥ half the strong kids by South Pass |
| Rookie, California | end cash strong $50–140 / average $25–90 / weak $15–70; no kid more than 3 days in a row with no food, at most 3 such days a journey; sessions 24 ± 2 |
| Rookie, Gold Road | weak finishes (crawl run ≤ 3); gold strong 7–12 nuggets / average 6–10 / weak 5–8; end cash ≥ $0 always; sessions 12 ± 1 |
| Veteran, Pioneer (every route) | end cash ÷ priceMult within 0.6–1.2 × the Rookie range of the same route; limps a season < 1.5 (Veteran) / < 2 (Pioneer); soaked < 1 a leg; crawl run ≤ 3; gold × 1.25 / × 1.5 of Rookie ± 15 % |
| `--homestead` (a kid's whole history: Rookie Oregon, Gold Road, then the route the profile prefers, tiers as they open) | the cabin after journey 1 for every profile; the barn by journey 3 for the average kid; every Willamette piece in 5–9 journeys for the average kid, never fewer than 4 for the strong; tokens spent on the farm ≥ half of those earned (the token sink works); the sim tunes `HOMESTEAD_COST`, not the pay, to hit these |

#### 7.3 Scene smoke: §4.5.

#### 7.4 UI smoke (`tools/ui-smoke.mjs`, both layouts, the mock scene) — new sections
"a new year" (the picker: the first journey skips to Outfit; the second shows Where and How hard with Veteran open and
Pioneer locked with its reason; the Gold Road card locked until a Willamette arrival); "the Fort Hall fork" (first journey:
Agnes's card, both buttons the same size, Oregon focused and read first, both lines spoken; choosing California replans and
the map inks the branch); "the Dalles fork and the toll" (Barlow: the toll card, an IOU when the purse is short, Laurel Hill on
the mock); "the Gold Road" (starts at the farm with the garden's food, a digging with three scripted pans and the pouch count,
Coloma's rocker, Sutter's Fort store at its level, the voyage's four markers, the bank card, Beaver money in the farm);
"the homestead" (build the cabin with savings, a garden row with tokens, the barn with gold; a greyed piece shows its reason;
Work it out on the well; the scene's `buildDone`; the farm on the title map grows); "sets and decorations" (complete a set on a
seeded save, the decoration appears in Look, two worn, drawn by the mock); the Journal's six pages; Parent Zone (journeys
table, "Reset this journey only" keeps the farm, Rookie-only option hides the tier step, panning off gives the gold as a find);
the voice (the fork lines and a digging's cue lines come from the prepared list; zero device-voice utterances with the fake
cloud backend, as 1.3.2); the screen audit (no off-origin links, no native inputs outside the Parent Zone, targets ≥ 44 px,
no overflow). `tools/sync-smoke.mjs`: two devices build different pieces offline and both stay built; a spend on one and a
bank on the other both survive; an older-build doc without `farm` / `ledger` merges without erasing them; "reset this
journey" keeps the farm on both. `tools/content-audit.mjs`: every new spoken string is in `collectVoiceTexts`; no digits in
any `say`; no word from the kid-rules list (§1) in any new text.

#### 7.5 The full two-route playtest (`tools/playtest-full.mjs`, then a person at iPhone size)
A scripted child, 70 % right, on the real sim and the mock scene: Rookie Oregon by the raft (20 legs) → names the farm,
builds the cabin → the Gold Road (12 legs, the diggings, the voyage) → raises the barn with Beaver money → Veteran, the
emigrant trail with the Sublette Cutoff and California at Fort Hall (24 legs) → founds the Sacramento claim → back to the
Willamette by the Barlow Road at Rookie. Checked: no stuck state, no fail, every screen reached, the cards, deeds, decorations,
tokens and the dog carried through all four years, the ledger and both farms right, total sessions and minutes per year
printed (Oregon ≈ 20 / 3 h, Gold Road ≈ 12 / 2 h, California ≈ 24 / 3½ h). Then the orchestrator plays one Oregon year and one
Gold Road year on the real scene at iPhone size and writes `docs/PLAYTEST-1.5.md` with screenshots.

### 8. Open questions for the owner (short)
1. **The California route over the Sierra**: the game uses the Truckee route (true for every year from 1844; the pass is
   called Donner Pass today, and the game never tells that story, it calls the stop "the Sierra summit"). The Carson route is
   only true from 1849. Truckee for all years, or Carson from 1849?
2. **The calendar**: one year per journey (1847, 1848, …), so the Lander Road (1858) opens on the twelfth journey. Keep it true
   to the year, or open it at the Pioneer tier whatever the year?
3. **Each later year is a relative's wagon coming west to join the farm** (Uncle Theo, Cousin Ruth…). Is that the right story
   for "a different family", or should it be the child's own family every time?
4. **Whitman Mission is left out** (its story ends in the violence of 1847, which the kid rules keep out). Agree?
5. **A line about what the gold rush did to California's nations.** The rush filled Nisenan, Miwok, Maidu and Wintu homelands
   and brought very hard times to them. Proposed for the "Gold fever" card, after the merchants: "The miners rushed onto the
   homelands of California's Native nations, and it was a very hard time for them. Those nations are still here today." In,
   out, or reworded? (Your read on all eleven new nation facts is wanted, as in §1.)
6. **Two homesteads** (the Willamette farm and the Sacramento claim), each built on its own, sharing the savings and the gold.
   Fine, or one homestead that the second ending moves?
7. **Gold only builds the farm**, never buys store goods (so the trail economy of 1.3 is untouched). Agree?
8. **Both first-trip forks** (Fort Hall and The Dalles) are on the very first journey, leaning Oregon and the raft; the South
   Pass fork waits for the second. Right amount of choice for a first trip?
