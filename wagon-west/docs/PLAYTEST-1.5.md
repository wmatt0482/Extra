# Wagon West 1.5 "The Long Trail": the real-scene playtest

Played by `tools/playtest-full.mjs` (rewritten for the long trail) in headless Chromium, 844 x 390 landscape with iPhone insets, **the real scene**
(no `?mock=1`; the run checks `app.sceneName` is empty), a fresh profile ("Ava"), a trail day of 2 s (`DAY_SEC=2`, the game's own is 6 s), the fake natural-voice
backend. The bot taps and drags the real canvas (pan, cradle, rope, schooner, bow, line, ford, raft), types every answer on the on-screen numpad and keyboard,
answers about 70 % right (a deliberate miss every fifth marker, two spelling misses, an early let-go on Laurel Hill, a pan or two left to the creek's rich ones),
and writes findings (layout audit, kid-rule words, console errors, stalls, canvas hit tests) to `findings.json`.
Screenshots of every new screen: `wagon-west/docs/playtest-1.5-shots/` (149 small JPEGs, named `<seq>-J<journey>L<leg>-v15-<what>.jpg`).

The run was split across several browser sessions (each finished leg saves the browser state; a session is resumed from the last one), because it is hours of play:
journey 1 legs 1-19, then 20 and the farm; journey 2 legs 1-11, then 12; journey 3 legs 1-24. After each fix below the affected screens were played again on the real scene.

## What was played

| | route | what happened |
|---|---|---|
| **J1** 1847, Rookie | the default 20-leg Oregon trail, 2,000 miles | Pit Crew Check on the first store (16 facts), Frodo adopted at the Kansas River, the 1.4 moments all still fire (fishing 2.0 with the bait row, the sturgeon's helper tap, a junk catch, the wiggle-off, noses: find, snake, a late rabbit chase, berries; the trail facts; the dust devil; camp games), **Fort Hall fork card** (Agnes: Oregon, both buttons the same size, Oregon focused and read first), **The Dalles fork: the Barlow Road** (Ben), **toll card ($5)**, **Laurel Hill** (the rope, an early let-go, three smooth ledges), arrival: "Home in the valley!", the bank card (+$126 savings, 2 oxen, a bronze plate), the farm named "Sunny Acres", the **cabin raised** (the frame goes up while the companions hammer), name plate, fence, a garden row (tokens), flowers, a well; a tap on the scene (`homesteadTap`), a piece's line. 20 sessions. |
| **J2** 1848, Rookie | the Gold Road, 12 legs | "A new year" -> Where (the Gold Road card open) -> How hard -> Outfit (Mateo and Hattie), the news card at the farm, the Oregon City store, pack mules beside the wagon, **panning at Clear Creek, the Feather River and Coloma** (3 / 4 / 5 pans), the **rocker** at Coloma (3 rounds, 6 of 8 beats on the beat), Sutter's Fort store, **the voyage home** (four "Up the coast" markers, the Columbia bar, Oregon's green shore), the bank card (**10 nuggets and 7 flakes of Beaver money**, +$170, 4 oxen), the sets "The Gold Road" and "Gold fever" complete (gold-leaf wheel trim, brass bell), a **barn raised** with Beaver money, a corral. 12 sessions. |
| **J3** 1849, Veteran | emigrant trail, South Pass fork (main), Fort Hall: **California**, 24 legs, 2,150 miles | "A new year" -> Where -> How hard (Veteran open, Pioneer locked) -> the Family step ("Uncle Theo's wagon, 1849") -> Outfit, the **South Pass fork** (Nell; three ways, the Lander Road locked "opens in 1858"), the **Fort Hall fork** (Agnes, "many wagons this year are bound for the gold fields"), the Raft River, City of Rocks, Humboldt Wells and River (no ferry: ford or float), the Big Meadows, **the Forty-Mile Desert dry stretch** (heat shimmer, "thirsty" without the barrel), the Truckee, **the Sierra summit**, the **Sacramento Valley claim** (a pan at the claim from 1848: 2 nuggets and 6 flakes), results "Your claim in California!", the claim named "Golden Claim", the cabin raised there, the title map showing both farms. 24 sessions. |

Bot clock (2 s days, with the bot's detours): J1 about 33 minutes (mean 99 s a leg, longest 210 s), J2 about 16 (mean 79 s), J3 about 23 (mean 58 s). Not comparable to a child's minutes
(the economy sim's clock says 8-10 minutes a leg; its check passes: first season 20.0 sessions, soaked sacks 0.05 a leg, limps 0.33 a season).
Carry-over, checked in the saves: cards 59 after J1, 91 after J2, 105 after J3; deeds 24, 37, 43; the dog Frodo, the tokens and the farm carry; the title map after J3 shows
`willamette:2` and `sacramento:1`; the Parent Zone's journeys table and the journal's Farm page open.

## Follow-ups from the streams, against the real scene

| follow-up | result |
|---|---|
| `setBackdrop('diggings' / 'sea' / 'homestead' / 'fork')` | all four seen on the real scene. **'fork' was never called by the app** (the signpost backdrop existed in the scene only): wired (`setFork({ id, options })` then `setBackdrop('fork')` while the panel is open, the stop's own backdrop after); the playtest records `getState().backdrop === 'fork'` and the arms' names at every fork. |
| `setLeg({ painting, dry, voyage })`, `setParty({ wagon: { decor }, packMules })` | the paintings of the new landmarks show on the stop screens, the pack mules walk beside the wagon on the Gold Road, the decor shows (gold-leaf trim, brass bell). |
| `setTravel({ dry })` | the real scene takes `dry: true | { barrel }`; the app sent a bare `true`, which **draws the water barrel on a wagon that has none**. Fixed: `dry: { barrel: <J.upgrades.barrel> }` and `wagon.barrel`. Played: "dry=true, barrel drawn=false, wagon has barrel=false" on the Forty-Mile Desert. |
| `setHomestead` / `buildPiece` -> `buildDone`, `homesteadTap` | at both sites; a build waits for `buildDone` (the cabin and the barn raising are shot), `homesteadTap` shows the piece's line. |
| `setFork` | see above. |
| `panSwirled` / `pan` / `panEnd`, `panReveal` | the real scene emits `pan` the moment `panReveal` is taken, the mock one `shotMs` later. The app only acts on `panSwirled` (it answers `panReveal` inside that event, which the real scene allows) and lists `pan` as an observed type, so both orders work. 14 pans played on the real scene (12 on the Gold Road, 2 at the Sacramento claim) (swirl by dragging circles at about 4 rad/s, a tap on the glowing rim). |
| `rockerRound` / `rockerReveal` / `rockerEnd` | 3 rounds at Coloma, taps on the beat. |
| `snub` / `snubEnd` | Laurel Hill: an early let-go (waits, "HOLD AGAIN", no penalty), three ledges, smooth. |
| `sailMarker` -> `sailGo`, `sail`, `sailEnd` | the voyage: four markers answered on the marker panel titled "Up the coast", the ship waits at each, then the bar and the green shore. |
| the scene's mini `debugMini()` | the pan, rocker, snub and sail debug objects had no `kind` (every older mini has). Added, so a test can tell them apart. |
| **Journey: `LETTER_CLOSE` and "Home soon, with gold!"** | fixed in `journey/letters.js` (`goldWayHome`): the Gold Road's closing is used only on the Gold Road once gold is in the pouch or the party is at Coloma or later. Journey test: never on an emigrant letter (60 seeds, with and without a farm), not on the road out, possible with gold and at Coloma (it fails without the fix). |
| **marker, then event, then nose on one day, on 60-mile legs** | the app's `afterDay` runs `runMarker`, then `runEvent`, then `runNose / runFact / runDustDevil`. Sim over 120 seeds on every leg of 70 miles or less (960 legs, 5,979 days): 5 markers on every leg, an event on every leg, an event always on a marker day, the nose on a marker day (2,402 days), event and nose never on the same day. On the real scene, chimney-rock and scotts-bluff (60 miles) and fort-laramie, with a watcher on the open panels: every observed day with two things was in order (marker, then the dog: "marker > nose > Frodo found berries!" at South Pass and Coloma); the watcher's other flags were its own artefacts (a find's dog still running into the next day, the nose's own card, a cue card before the voyage's marker). **I did not catch a day with all three on the real scene**; the order is shown by the code and the sim, not by a real three-thing day. |
| **the Pit Crew Check, once for real, on a fresh profile** | before: a fresh ladder, frontier `x2, x5`, `problemTierFor` 0, offered 0 times. The card "Pit Crew Check" (Start / Later) appeared at Independence before the first store, 16 facts were asked on the marker panel in `check` mode ("Fact 1" ... "Fact 16": ×, then the ×11, ×12, then ÷ twins), all answered right; after: placed, history, offered once, **frontier moved to `d2, d5` but `problemTierFor` was still 0**: a bug (below). With the fix: tier 2, and the same three calls change shape: the ration from one step ("how many pounds will be left") to two steps (the pounds eaten, then left; answers 56 and 15), the distance to two steps, the buy to "You buy 12 bags and pay with a $50 bill. How much is that, and how much change do you get back?" (answers 48 and 2). |

## Bugs, by severity

### Blocks play (fixed)
1. **The diggings card covered the pan and the cradle.** The creek's card ("The creek ... Pan for gold") stayed on screen while the scene ran the pan, over the lower half of the pan, and a tap on the pan landed on the card: the pan could not be played by touch. Found by the bot's canvas hit test on J2 leg 8. Fixed: `diggings.js` hides the card while a pan or the cradle runs, and shows it again after.

### Wrong (fixed)
2. **`problemTierFor` read an ace child as the lowest tier.** Trail Blazer's frontier moves on to the ÷ twins once the × families are known, and the spec's rule counts ÷ at its × family, so a child who aced the check through ×12 sat on `d2 d5` = tier 0 and got the smallest shapes. `adaptive.js`: the tier is the higher of the frontier's and the highest × / tens / teens family the ladder counts as known (`famInfo(...).known`). The app passes the time. Journey test added (check ace -> 2, check miss -> 0, fresh -> 0, no store -> 1); the ui-smoke test that forced the frontier on a freshly placed child now starts from a clean ladder.
3. **"Home soon, with gold!" could close an emigrant letter.** Fixed (above).
4. **Snow over the Forty-Mile Desert.** The basin borrows the high desert's weather and with it snow: on 9 of 60 Veteran seeds the HUD said "snow soon" over the heat shimmer of the dry stretch. `events.js`: no snow event on a dry leg. Journey test added (48 snow plans in 300 seeds without the fix, 0 with).
5. **The fork's buttons were not the same size.** The three-way South Pass fork gave 48 and 53 px high buttons (wrapped names), and the cards' buttons did not line up. Fixed: equal-height cards, the buttons at the foot, a fixed button height, a smaller type for three ways. Played again: every way 91 x 52 (three ways) and 213 x 52 (two ways).
6. **The trail HUD and the app's bar covered the new minis' own words.** On Laurel Hill the HUD hid "LEDGE 1 OF 3" and "HOLD TO LET THE WAGON DOWN"; on the pan and the cradle the bar covered "SWIRL THE PAN" and "TAP ON THE BEAT". Fixed: the top HUD steps aside while the pan, cradle, rope and voyage run; the bar of the pan and the cradle goes to the top between their counters, the rope's and the schooner's stays at the foot.
7. **The water barrel was drawn on a wagon without one** (above), and **the fork's signpost was never shown** (above).

### Ugly (not fixed)
8. The results screen's bank card ("+$126 in savings, 2 oxen to the pasture, a bronze plate") sits below the fold of the left card at 844 x 390; it needs a scroll (the shot shows it cut off). The farm button is not hidden by it.
9. Food piles up: the wagon ends J1 with 2,198 lb, J3 with 2,718 lb (the bot hunts, fishes and trades at every chance; nothing uses the surplus), and the store says "about 157 days at plenty rations". Harmless, and a question for the owner (a wagon's capacity, or a cap on what a hunt adds).
10. On Laurel Hill "HOLD AGAIN" lands on the "LEDGE 1 OF 3" counter for a moment.
11. A stop's toast ("Traded 12 trade tokens ...") was still up 7 s later on the post office screen (the v1.2 toast layer; found once).
12. Perf: `scene-smoke` "the farm at full build with a raising and the weather" is borderline at 4x CPU throttle: 10.65 ms in the first full run, 13.6 and 8.8 ms alone, 5.85 ms inside the v1.5 group, and it passed in the final full run (budget 8; 531 checks passed). The case rebuilds the whole farm every 4 s; every other v1.5 case is 3 to 5.4 ms. Left as a watch item.
13. The Veteran bot ends J3 with $456 (the bot buys food and spare parts only, and there is no store after Fort Hall); the economy sim's Veteran kids spend more and sit inside their range, so this is the bot, not the money.

### Bot-side, not game bugs
- The new minis' `debugMini()` had no `kind`, so the first Laurel Hill run stalled (the bot never held the rope); fixed in the scene and in the bot.
- Two stalls at the v1.4 camp-fish and Columbia sturgeon detours (the bot did not tap "Done fishing" after the summary): not reproduced as a game fault, not investigated further.
- A numpad race on the voyage's first marker ("GO" disabled while the digits were still going in): the bot now retries.

### Not verified
- Portrait was not played on the real scene (ui-smoke covers both layouts on the mock scene).
- A real day with a marker, an event and the dog's nose together (see above).
- A child's real minutes per leg (the bot's clock is not one).
- The Lander Road (1858), the Sublette Cutoff's dry stretch and the Pioneer tier were not played; they are in the journey tests and the sim.
