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
  puff and "Got one!", no blood; **fishing** is a timing tap at a river or a lake.
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
- Starting cash $400 (1847); a leg pays $60 arrival + $20 a star + tokens; prices scale by season ×2 / ×4.
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
