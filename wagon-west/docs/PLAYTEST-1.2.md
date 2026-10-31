# Wagon West 1.2: full-journey playtest

Played Independence to the Willamette Valley on the **real scene** (no `?mock=1`; `app.sceneName` is empty), all 12 legs,
as a 4th grader would: outfit, store, every mile marker, three rivers (ford, float, ferry), the Columbia raft, a stampede,
hunting, fishing, trading, camp (all five activities), trail cards, Fort Derby at every fort, the dog, the daily challenge,
an upgrade, deeds, a talk with every person at every stop, the letters home, the journal, the homestead, the results, a
second season and the Parent Zone report. Report only: nothing in `src/` was touched.

- Script: `wagon-west/tools/playtest-full.mjs` (Playwright, 844x390 landscape with iPhone insets; `PORTRAIT=1` for 390x844).
  It taps and drags the real canvas for the bow, the line, the ford, the BRAKE sign and the raft (it reads the scene's debug
  state only to know where to tap), types every answer on the on-screen numpad and keyboard, and keeps the game's own 6 s day
  (the first runs used 6 s days; the last full run used 4 s).
- Deliberate "kid" behaviour: every 5th mile marker missed (fix-it flow), two spelling misses, a wrong first rope throw, two
  bad ford taps (a soaked sack), a skipped stampede wave, an early tap while fishing, a wild tap at the sky while hunting.
- Screenshots of **every distinct screen state** (about 1,350 across the runs, 844x390 PNG) are in
  `/tmp/claude-0/-home-user-Extra/0887b907-788e-5c4e-a0e5-9e998f29e90b/scratchpad/` under `pt-full` (the full run, legs 1-11),
  `pt-full-end` (leg 12, the valley, the journal, the Parent Zone, resumed from the saved state), `pt-portrait` (legs 6-7 in
  390x844), `pt-full-aborted` and `pt-full-run2-aborted-leg8` (earlier runs with 6 s days, kept for comparison), plus
  `findings.json`, `texts.json` (the kid-visible text of each screen), `spoken.json` (everything the voice was asked to say).
- The **screenshots cited below** are committed in `wagon-west/docs/playtest-1.2-shots/` (JPEG copies).
- Not covered by this run (ui-smoke covers them on the mock): tired animals, a limp (the party always had a spare part), a
  cold night (blankets were bought), "Wait out the storm", the natural voice (a fake device voice was used), offline / service
  worker (`nosw=1`).
- Two stalls in the script itself (no handler for the homestead-naming screen; no handler for the title in mid-journey) were
  script bugs, fixed; they are not game bugs.

## Result in one paragraph

The journey is **completable and nothing blocks play**: 12 legs, 114 days, 56 mile markers, 3 rivers, the raft, 2 stampedes,
4 derby wins, 32 people met, 16 of 20 deeds, 31 of 40 cards, a second season starts. No console errors, no failed requests,
no native inputs or off-origin links outside the Parent Zone, and the layout audit (overflow, 44 px targets, insets) found
nothing on several hundred distinct states in both orientations. The scene costs 0.5-0.7 ms a frame of game code. The problems are
(1) two stray `null`s on screen, (2) one z-index decision (toasts and pops at the top of every screen) that covers the text
a kid is supposed to read, (3) two mini-games whose play surface is partly hidden by their own UI, and (4) the game being
too easy to have any tension (see "Fun").

## Counts

| severity | count |
|---|---|
| blocks play | 0 |
| wrong | 12 |
| ugly | 6 |
| nit | 6 |

Top five: **W1/W2** the literal word "null" on Outfit and on every Results screen with a crate; **W3-W5** toasts and pops
draw over the BRAKE sign, the question and the card text; **W6** the ford's river is hidden under its own status card;
**W9** the end of the journey is a normal leg result (no stats, no homestead, no season sticker); **W8** a trade is offered
for goods nobody can have.

## Bug list

Format: screen / what I did / what happened / what should happen / screenshot (in `playtest-1.2-shots/`).

### Wrong

**W1. Outfit, Animal tab shows the word "null".** Opened Outfit on a new player, tapped the Animal tab. Under the two cards
there is a plain "null" (`animalTab()` in `src/ui/outfit.js` ends `body.replaceChildren(..., lock ? h(...) : null)`; a
`null` argument to `replaceChildren` is written as the text "null"). Should be nothing. `01-outfit-null.jpg`.

**W2. Results screen shows "null" next to the crate button.** Every arrival that has one crate waiting (most legs). Same
cause in `src/ui/results.js:62` (`box.replaceChildren(b, queue.length > 1 ? h('small'...) : null)`). Should show nothing
(or "N more waiting" when there are several). `02-results-null-portrait.jpg` (landscape: the word is cut off at the panel edge).

**W3. The BRAKE sign is covered by a toast.** Stampede, wave 1, leg 1 (day 7). The red BRAKE octagon is the cue to tap; at that
moment Eli's skill line and the "A pronghorn on the ridge!" toast sit on top of it, and the wave counter pips (top left)
are under the HUD. Cause: `#toasts` is `z-index: 50`, above the cards (22), panels (20-25), modals (30), and sits 58 px
below the top, exactly where the scene draws its cues; each toast lives 4.8-5.2 s. Should be: no toast while a mini-game
runs (queue them until it ends), or the cue drawn clear of them. `03-stampede-brake-hidden-by-toast.jpg`.

**W4. The question or the instructions are under a toast.** "Ask Eli: how many days?" (distance problem): Rosa's skill toast
covers "Kansas River is 50 mi... How many days w..." for 5 s. The Wagon panel is covered the same way (its Food heading and
"The party" heading). Should be: toasts wait while a panel or card is open. `05-ask-eli-question-hidden-by-toast.jpg`,
`06-wagon-panel-under-skill-toast.jpg`, `32-wagon-panel-scrolled-skill-toast.jpg`, `26-trading-panel-under-toast.jpg`.

**W5. Event, person and arrival cards are partly covered by toasts and the "New card!" pop.** "Snow in the pass" is covered by
three toasts (its title reads "Snow in th..."); Lucy's speech at Independence Rock is covered by the Independence Rock card
pop. Should be: pops and toasts wait for the card to close. `04-snow-card-hidden-by-toasts.jpg`, `25-person-card-under-cardpop.jpg`.

**W6. The ford hides the river.** Leg 1, Ford. The only thing to read is "calm or wave", and the instruction is "Tap on the
calm water", but the "Ford the river / Tap on the calm water" status card is drawn over the whole river band at the bottom
of the scene; only a dark sliver shows. With the UI off (dev page) the river is a clear blue channel across the bottom third.
Should be: the card above the water (top of the screen) or smaller. `07-ford-river-hidden-by-card.jpg` (in game),
`08-ford-scene-alone-dev-page.jpg` (scene alone), `33-ford-soaked-result.jpg` (result card).

**W7. The hunt's bar sits on top of the bow and the nearest lane; the scene's own caption and counters are under the HUD.**
Hunting (leg 2, event "Tracks"): the "The bow: tap the animals | Done hunting" bar (x 260-580, y 305-360) is exactly over the
bow at the bottom centre and over the lowest animal lane (y = 0.875 of the height); a rabbit or deer there is under the
"Done hunting" button, so a tap on it ends the hunt instead of loosing an arrow (geometry only: my bot never landed on
the button, and its hit-test found no tap on the bar). The scene's own caption (top centre) and arrow counter (top left)
are hidden behind the HUD boxes (the same HUD-over-scene problem hides the stampede's wave pips; the ford's wheel counter sits under the back button).
Should be: bar moved off the play lanes (top, or a small corner button); HUD hidden while a mini-game runs.
`09-hunt-bar-over-bow.jpg`, `28-mini-bar-fish.jpg`.

**W8. A trade is offered for goods the child can never have.** Fort Kearny, the Pawnee guide: "a fair trade: one blanket for
three bags of corn". "Trade" then says "Nothing to trade this time: a friendly visit." (There is no corn in the game.) Many
offers are three pelts for flour, and pelts only come from hunting, so a child who does not hunt hears "Nothing to trade" at
most stops (about 8 times in this journey). Should be: only offer trades the wagon can do; or show "you need 3 pelts" and no
Trade button. `13-trade-offer-unplayable.jpg`.

**W9. The end of the journey is a normal leg result.** Leg 12, "Home in the valley!": three stars, "3/4 markers right",
"0/0 problems right", food, the deed pop. SPEC §3: "the journey's stats, the whole journal to read back, a season sticker".
Nothing here tells the child what they did in 114 days (legs, miles, markers, words, people, cards, deeds, fish and game);
the homestead name appears only under the title map afterwards. Should be a journey summary page (the stats are all in
`J.totals`). `15-final-results-no-journey-summary.jpg`.

**W10. The daily challenge names a stop the wagon has passed.** The title shows "Today's challenge: Cross the Kansas River
with every word right" on leg 2, leg 5, leg 8 and leg 9 of the same real day (it is fixed once a day by design). A child who plays a second
leg the same day is told to do something that can no longer be done at that place (it is in fact satisfied by any three
right words, e.g. the letter's). Should be: re-aimed at the current leg when the party moves on, or worded without the place.
`17-daily-challenge-stale.jpg`.

**W11. Camp, "Stop for today" did nothing once (intermittent, not reproduced).** Leg 8 (day 81), Camp opened from the HUD's
Camp button, tapped "Stop for today": stayed on Camp for 5 s (a DOM `click()` from the script; in the next full run, leg 8 again, a real pointer click on it went
to the title as it should). Probably a click arriving while `leave()` was guarded (`busy`/`ctx`), but I could not make it
happen again. `21-camp-stop-did-nothing.jpg`.

**W12. Kid-rule word "lost" on Mr. Dell's card (Snake River).** "A wet sack of flour is a lost sack." The repo's own banned
list (ui-smoke) has `lost`; this content (people.js) is not in its text audit. It is spoken too. Should be e.g. "A wet sack
of flour is a ruined sack" / "is no good". `18-lost-sack-card.jpg`.

### Ugly

**U1. Map labels collide.** Journal → Map: "Snake River" / "Fort Hall", "South Pass" / "Independence Rock", "Chimney Rock" /
"Fort Kearny" and "Willamette Valley" / "The Dalles" print on top of each other and "Willamette Valley" is cut off at the left
edge ("illamette Valley"). On the title map the "Kansas River" label runs under the wagon icon. `11-journal-map-labels-collide.jpg`,
`12-title-map-label-on-wagon.jpg`.

**U2. Outfit's party skills are cut off.** The one line that says why a companion matters ("Mends one wagon breakdown ...",
"Spots one more animal a leg, a...") is truncated with an ellipsis on the card, and the last row (Tomas, Ines) is cut off by the
Next button's bar. The full text shows only on the Wagon panel on the trail. `14-outfit-skills-truncated.jpg`.

**U3. Arrival pops cover the results.** Each Results screen opens with the card pop ("Again! +1 token" or "New card!") and a
deed pop over the middle of the star row and the pay table for 1.5 s+, stacking when there are several. `10-results-pops-over-table.jpg`,
`27-results-pops-over-table.jpg`.

**U4. Portrait: the store title is truncated and the first row hidden.** "General Store · F..." and a toast over the Flour row.
`22-portrait-store-title-truncated.jpg`.

**U5. Toasts outlive the screen that made them.** `#toasts` is only cleared when entering the trail or results, so a 5 s toast
follows the child to the title (Rosa's line over the "Wagon West" logo), the derby ("2 x Beans in the wagon" over the race),
the river choice and the dog-naming keyboard. Worst when playing fast; at a calm pace most expire first. `17-daily-challenge-stale.jpg`.

**U6. The float's "STEER!" is half under the screen title.** `24-float-steer-text-under-title.jpg`.

### Nit

**N1. A miss leaves the wrong number on screen for a beat.** Mile marker, "3 x 2 = 7": the 7 stays in a red tile with "Here
it is:" before it clears and the work shows. SPEC §1: "a wrong answer clears and the right one is shown". `19-marker-miss-wrong-number-red.jpg`.

**N2. "Quick!" next to a right answer** ("8! Quick!") when the child answers fast: praise for speed on every marker. It is the
tailwind rule from SPEC §3, but it reads as a timer to a child who is slower. `20-marker-quick-praise.jpg`.

**N3. "1 seasons finished"** in the Parent Zone report and Journey tab (`parentZone.js:263`).

**N4. The Talk row covers the party** at every stop (bottom half of the scene), so the wagon and the dog are hidden while the
child talks. `23-stop-talk-row-covers-party.jpg`.

**N5. After the journey the title map has the wagon back at Independence** under "Sunny Acres · You made it to the valley!".
`16-title-after-journey-wagon-at-start.jpg`.

**N6. SPEC parts not present:** the Fort Bridger / Sublette cutoff choice (§3), and "a new season: a different party, a harder
route" (the second season is 1850 with the same party and route and $800 carried over).

## Kid rules (SPEC §1), checked on every screen

| rule | result |
|---|---|
| nobody dies, nobody is sick, no graves, no guns | pass: every kid-visible string and every spoken line (526) searched for kill / die / dead / death / grave / blood / gun / shoot / sick / hurt / drown / cholera / snake: none; the bow is cartoon (the animal flops, "Got one!"). Also searched `src/content/*.js`: clean |
| banned words (the ui-smoke list) | **one hit: "lost sack" (W12)** |
| no lives / energy / timers / countdowns / pressure text | pass on timers and countdowns (no clock, no "N left"; the HUD says "Day 12" and miles). Watch: "Quick!" (N2); the stampede and ford are timing taps by design but have no clock on screen |
| stopping is always fine | pass: Stop for today, Camp > Stop, the raft's "Stop for today" and Esc all leave and "Keep going" resumes at the same mile (W11 is the one exception, intermittent) |
| no external links | pass (the only `<a>` is the same-origin "Learning Lab") |
| no native inputs outside the Parent Zone | pass on every state (wagon name, player name, dog, homestead and every answer use the on-screen keyboard / numpad) |
| no multiple choice | pass: the only buttons on question panels are Hear it / Say it again / Sentence / Syllables (the river "Ford / Float / Ferry" and the trade "Trade / No thanks" are choices of action, not answers) |
| a miss clears and shows the work | pass with N1: the work, then "Now you: type the answer from memory"; spelling shows the red tiles and a cover-copy |
| Native nations as partners, correct names | pass in what was read: Kansa, Pawnee, Lakota, Shoshone, Bannock, Nez Perce, Cayuse, Chinook guides are friendly traders with a "today" line |

## Fun (flat or confusing from a kid's side), with suggestions

1. **Nothing is ever at stake.** After leg 3 the wagon had 850+ lb of food and $666; at the valley 1,133 lb, **$1,525 and 74 trade
   tokens unspent**. The stats say it: 0 limps, 0 crawl days, 0 cold nights, 1 soaked sack (25 lb) in 114 days. I bought food
   once (the first store) and never needed to again (hunting 170 lb, fishing 56 lb, gifts and berries did it); every fort said
   "you have enough". The store, the dials (pace, rations) and the breakdown card ("There is a spare part in the wagon") have no
   consequence to weigh. Suggestions: start with less food and cash; raise forts' prices with the season so $ matters; make the
   dials move something the child sees (miles a day, mood) within a leg; sell something at the end worth the cash (the homestead:
   land, a cow, a house, so the cash turns into the ending); let tokens buy a few real things (a rope bridge for a river, a guide).
2. **The facts barely move.** 56 markers in the journey, almost all x2 (2x2, 3x2, 10x2, 11x2, 12x2) with some x3, x5 and x10:
   the same fact several times a leg (5 x 5 eight times in legs 10-12; 11 x 2 three times in leg 8); the first ÷ fact appears in
   the last leg. A 4th grader who answers right is bored by leg 3. Suggest a placement (start the markers at the child's Trail
   Blazer frontier, or three quick probes at Independence) and faster promotion on streaks; vary the shape (missing factor, word
   form) so markers are not always "a x b =".
3. **The days are passive.** Between markers nothing asks for anything; the pace and rations dials were never needed after the first
   leg, and the only things that happen are events. Suggest small recurring choices (take the creek route or the ridge, camp now
   or push on to the water) that use the dials and the companions' skills.
4. **Who you picked still hardly shows.** A skill is announced by one toast (5 s) per leg and spoken in full each time ("Rosa: Food
   lasts a tenth longer, and wild berries turn up twice as often" was spoken 10 times). Not once did a companion change a
   decision. Suggest: a short portrait bubble when the skill actually fires (Ada fixing the wheel, Eli pointing at the
   herd), shorter after the first time, and companion-specific lines at stops.
5. **Rewards arrive in piles.** Each arrival throws a lookout card, a "New card!" pop, a duplicate "Again! +1 token" pop, a deed pop,
   toasts and the results all within a few seconds, over each other (W5, U3). Fewer, bigger, one at a time.
6. **Trading is a dead end** (W8): the nations are the heart of the content, and trade usually ends "Nothing to trade this time".
   Let a first trade be offered with a gift of pelts, or turn the trade into the fact/riddle for a card.
7. **The letters do not connect to the spelling.** The three words sit in a "P.S. My spelling words this week: lower, blown and
   quote." line, every letter has the same shape, and the same words come back (lower, shadow). The body lines are lovely and
   use what happened that leg (the stampede, the hunt, the sand). Weave one word into a body sentence the child writes into, as
   the spec says.
8. **Derby has no race.** The 30 s race is four full-screen fact panels with a glimpse of the road between; I won 4 of 4 by 120-140
   m. Nothing to cheer. Let the wagon be seen while the fact is up (a half-height panel) and let the mail wagon win sometimes.
9. **The river is the best part.** Float (rope toss then raft) and the Columbia raft are readable and fun; the ford is the only river
   where the child cannot see what to react to (W6). The ferry is "the spelling one", so a child who hates spelling never meets
   it: make that a feature or rotate it.
10. **The ending is a leg result** (W9): the strongest chance for a "we did it" moment (the homestead name, the 114 days, the
    letters read back, "Sunny Acres" on the map) is a screen that looks like leg 3's.
11. **Small delights to keep:** the dog walking beside the wagon and joining the derby, the cartoon bow ("Got one!"), the fishing line
    (the dip is easy to read), the letters quoting the stampede, the hint line "Double 3: 3 + 3 = 6" on a miss, Wagon panel stacks.

## What worked well (so nobody undoes it)

- Layout audit clean in landscape and portrait (insets faked), no console errors, scene frame cost 0.5-0.7 ms, worst frame 30 ms once.
- Every flow that is a player's choice (river, camp, people, trade, store, derby) is reachable with taps; every mini-game is
  playable by touch (the canvas receives the taps: checked with `elementFromPoint` at each tap, except W7's geometry).
- A miss is handled kindly everywhere (work shown, "Now you: type the answer from memory", the fix-it spelling tiles, the rope's
  "A wet boot... one more throw", the soaked sack, the stampede "Pfft, dust everywhere!").
- Saves, resume and `Keep going` worked across 12 stored states; a second season starts cleanly.
