# Wagon West — design spec (v0, for Matt's review before any build)

> Matt, Oct 30: "For the next game, I'm thinking something like Oregon Trail. Maybe it incorporates math and spelling?"
> This is the design to react to. Nothing is built. The name is a working title: "The Oregon Trail" is a registered
> game title (Houghton Mifflin Harcourt / Gameloft), so the game is *about* the Oregon Trail without using it as its
> name. Working alternatives: **Wagon West**, Westward, Trail to Oregon.

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
  math problem frees it), food runs **low** (the next fort or a fishing stop fixes it). No dysentery, no snakebite,
  no graves, no gunplay. Hunting is **fishing and foraging** (berries, fish, a wild-onion patch).
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
hungrier, a choice with arithmetic in it) and **three companions**. Companions can be the other players in the
family (their Spell Jump avatars; the party rides together) or stock characters. Each has a mood (happy / fine /
tired), never a health bar.

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
