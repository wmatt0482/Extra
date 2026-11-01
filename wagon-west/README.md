# Wagon West

Learning Lab's fourth game (`learninglab.fun/wagon-west/`): a covered wagon travels the 2,000 miles from Independence,
Missouri to the Willamette Valley, one landmark a session, and the learning is both 4th-grade math and the week's
spelling words, in the places a real journey needed them. `SPEC.md` is the design (§0–§7) and the build contract
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
BASE_URL=http://localhost:8095 node wagon-west/tools/ui-smoke.mjs     # both layouts on the mock scene (ONLY=landscape|portrait; VOICE_ONLY=1)
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
- VERSION 1.4.0; the service worker is `wagon-west-v1.4.0`.

## Data and sync

One family code syncs all four games. Wagon West adds the per-player kind `ww` (the save) and registers Trail
Blazer's kinds (`tb`, `facts`) so the facts the mile markers record sync from here too; Spell Jump's `words` kind is
built in. Merge: a reset wins; the journey is the later doc's (cash and tokens the max; the trail cards the union; v1.4: the
dog's finds, the fish log, the skipping stones, the wishes and the quests by the journey's `merge14`);
stickers,
letters, looks and the leg log are unions; the per-day log and the per-kind tallies take the max; crates keep the longer
queue; the streak follows Spell Jump's rule. The family server must list `ww` among its kinds
(`car-jump/src/sync/protocol.mjs`).
