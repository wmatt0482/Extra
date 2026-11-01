# Wagon West 1.4 "Frodo and the river": full-journey playtest

Played Independence to the Willamette Valley on the **real scene** (no `?mock=1`; `app.sceneName` is empty), all 12 legs,
on the integrated 1.4 tree (content + journey + scene + app streams, plus the 1.3.3 problem-ladder fix), as a 4th grader would,
at 844x390 landscape with iPhone insets and the game's own pacing (3 s trail days to keep the run short; mini-games, vignettes
and everything the child taps are real time).

- Script: `wagon-west/tools/playtest-full.mjs` (the 1.2 script, extended). The bot taps, drags and holds the real canvas
  (touch taps for hunts, stones, hoppers, stars, hats and the sturgeon's helper; mouse down / up for the fishing reel and the
  fetch drag), reads the scene's debug state only to know where to tap, types every answer, and snapshots every distinct
  screen. It writes `v14-summary.json` (what it saw; copied into the shots folder), `findings.json`, `texts.json`,
  `spoken.json`, `console-errors.json`.
- To make sure each new thing is met on a run of twelve legs, the script *steers luck* in two places and nowhere else: it
  calls the journey's `fishingSession` on a copy of the save to choose the seed counter of the next fishing session (so the
  Snake and Columbia sessions hold a sturgeon, the Sweetwater one holds the bottle, the Kansas one a turtle), and it fires
  the dog's find / snake / rabbit, the trail facts and the dust devil through the app's test hooks on chosen legs. Every
  game event after that is played with real input. Natural nose moments, facts, hunts and camps also happened on their own.
- Deliberate "kid" behaviour (kept from 1.2): every 5th mile marker missed, two spelling misses, a wrong first rope throw,
  two bad ford taps, a skipped stampede wave, an early tap while fishing, a wild tap at the sky while hunting. New in 1.4:
  the first rabbit chase called **late** (muddy), the first fight held straight through the red (the fish wiggles off), the
  first dust devil's last hat left in the sagebrush, the third stone of the first throw left to sink.
- Screenshots (JPEG, 600 px wide, 144 files) are in `wagon-west/docs/playtest-1.4-shots/`; the new screens are named
  `NNN-Lnn-v14-<what>.jpg` (NNN is the order, Lnn the leg). `v14-summary.json` is next to them.
- Not covered here: the **family** parts (the Fish log's "Family records" and the skipping-stones board need a second player's
  synced save: ui-smoke's v1.4 sections and `sync-smoke` cover them), the natural voice (a fake device voice was used), the
  service worker (`nosw=1`), portrait (a 1.2 run covered it; the v1.4 UI's layout audit runs in both layouts in ui-smoke).

## Result in one paragraph

The journey is **completable and nothing blocks play on the tree as it now stands**: 12 legs, 132 days, 58 mile markers,
3 rivers, 2 stampedes, 35 people met, 20 deeds, 45 of 54 cards, no console errors, no failed requests, no native input or
off-origin link outside the Parent Zone, and the layout audit found nothing on several hundred distinct states. Everything
the owner asked for was played and looks right: Frodo joins at the Kansas River and brings the silver locket, the nose
(finds with a pop, the snake, the rabbit called late and **washed at camp**), fetch, grasshoppers, skipping stones (12 skips
at the Kansas, the Snake and The Dalles), falling stars and the wishes, the dust devil, fishing 2.0 at all eight kinds of
water with the bait row, the sturgeon's helper tap (twice), an old boot, a snapping turtle and the bottle, the locket from the
Kansas River to Molly at Fort Laramie, Sam at The Dalles, six trail facts, the leading hunt, the journal's Finds and Fish
log pages and the Parent Zone's far-off switch. The playtest found **one thing that really blocked play** (skipping stones
could not be played by touch), four "wrong" things in the new UI and one wrong counter; all six are fixed on this branch.

## What was played (from `v14-summary.json`)

| The thing | Where | What the bot saw |
|---|---|---|
| The dog joins | Kansas River, far bank | "A new friend", named Frodo on the keyboard, then the dog dashes off and brings the **silver locket** ("Keep it safe") |
| Nose: a find | Fort Kearny leg and 3 more | the dog dashes off, "Frodo found something!", comes back with the thing in a bubble, the pop with a "New!" ribbon on a first find; 8 of 9 kinds found (no spoon), the arrowhead sketched and left |
| Nose: the snake | Fort Kearny leg | the dog plants his feet and barks twice, the wagon halts, a cartoon rattlesnake slides away, "Good dog!" card |
| Nose: the rabbit chase, called **late** | Fort Kearny leg | the big "Frodo!" button, tapped at 86 % of the run; "Back at last, and muddy from nose to tail!"; the dog is muddy until camp; **washed at camp** ("A splash in the creek, and the dog is clean again."), clean at the results |
| Fetch | arrival camps (2) | the drag from the stick with the dotted arc, three throws, "Three treats!", the dog flops by the fire; 16 treats |
| Grasshoppers, skipping stones, falling stars | Kansas River camp / banks of the Kansas, Snake and Columbia | 6 hoppers in the tin, 12 skips (and one plunk), 8 falling stars tapped, 8 wishes (the Finds page lists them), "Skipper" and "Wish maker" deeds |
| Dust devil | Chimney Rock leg | hats fly, 2 of 3 caught ("GOT IT!"), the third lands in the sagebrush |
| Fishing 2.0 | Kansas (catfish, turtle, boot), Platte (catfish), Sweetwater x2 (hornyhead chub, **the bottle**), the Fort Bridger creek and the Bear River (cutthroat), the Snake (**white sturgeon**), the Blue Mountains (redband), the Columbia (**sturgeon** and Chinook) | the bait row (worms, grasshoppers, the spoon bought at Fort Kearny), the yellow shiver then the red wobble, **held through a wobble: "It wiggled off! Cast again."**, the sturgeon's "It takes two!" portrait tapped (Jasper, "Hold on, I have got the rod!"), the summary card and "A new fish for the log!" |
| The locket quest | Kansas River to Fort Laramie | the item at the Kansas River; Mrs. Platt (Fort Kearny), Josh (Chimney Rock), Molly Rowe at Fort Laramie ("My locket!", the card in the Trail tales suit, a token, 10 lb of apples, the "Keeper" deed) |
| The bottle note | Independence Rock leg to The Dalles | fished up at Independence Rock, Ruby (Fort Bridger) and Mr. Pete (Fort Hall) point the way, Sam at The Dalles gives his best marble |
| Trail facts | Kansas, Fort Kearny, Chimney Rock, Fort Laramie, South Pass and Fort Hall legs | the prairie glow, **Far-off rifles** (twice), the bison thunder after a stampede, the wolves, the **grizzly on the ridge** (stays on the far ridge, the dog woofs once), the pronghorn race; each with its sound, its card and its album card |
| Leading hunt | Fort Kearny and Chimney Rock legs, 3 hunts | a LEAD shot at a running pronghorn, rabbit or turkey ("GOOD LEAD!"), a still shot at a grazing animal ("GOT ONE!"), a wild tap at the sky; 2-3 lead hits a hunt; the dotted guide on the first arrow |
| Store | Fort Kearny, Fort Laramie, Fort Bridger | the shiny spoon row ("$4 a spoon"), bought; "Sell old horseshoes to the blacksmith: $1" |
| Journal | after legs 2, 5, 9 and the end | seven tabs; the Finds page (nine drawings, the treat jar, the wishes, the quests of the trail) and the Fish log (six species with the biggest and where first caught, the personal best crown, River oddities, Skipping stones) |
| Parent Zone | at the end | "Far-off sounds on the trail" is on by default, flips off (the setting and the journey's `opts.farSounds`) and back on |

Weapon words: the only places "rifles" appears on screen or in the voice are the one fact (the card "Far-off rifles", its
text and its album card). Nothing is drawn but birds lifting from a far line of trees.

## Counts

| severity | count | of which fixed on this branch |
|---|---|---|
| blocks play | 1 | 1 |
| wrong | 5 | 5 |
| ugly | 5 | 0 (listed) |
| nit | 3 | 0 (listed) |

## Bug list

Format: screen / what I did / what happened / what should happen / fix.

### Blocks play

**B1. Skipping stones cannot be played by touch at the river banks.** Kansas River far bank, "Skip stones?" -> "Skip
stones". The scene is up with "TAP TO THROW!", but no tap does anything and the bot stalled for 50 s. The stop screen
(`#screen-stop`, a full-size layer above the canvas that holds the Talk row) swallowed every pointer event; no other
mini-game is played on that screen, and ui-smoke plays on the mock scene (scripted, no pointer), so nothing had ever hit it. Fixed in
`index.html`: `#screen-stop { pointer-events: none }` and only `.stop-wrap` (the Talk panel) takes taps. Re-played afterwards: 12 skips
at the Kansas, the Snake and The Dalles. (`fixed-B1-stones-play-by-touch.jpg`; the blocked screenshot was not kept.)

### Wrong

**W1. The hunt bar sits on the near lane.** Hunting (the hunts on the Fort Kearny to Fort Laramie legs, and at The Dalles). An animal in the lowest of the
three lanes passes behind the "The bow: tap the animals / Done hunting" bar (bottom centre) and a tap on it lands on the
button, not the canvas: the arrow is never loosed (`880-L11-hunt-blocked-tap.jpg`). Worse now that the arrow must be led.
Fixed: while a hunt runs the bar sits up in the hills (`.in-hunt #mini`, `src/main.js` + `index.html`), clear of the lanes and the bow (`fixed-W1-hunt-bar-in-the-hills.jpg`).

**W2. A deed pop could stay drawn for good and starve the find pop.** Found by ui-smoke, not by the bot: with two deeds
queued and a card pop waiting, the first deed stayed on screen while the next waited for the card pop, and the find pop
waited for the deed pop to be hidden (the dog's find never showed). Fixed in `src/ui/deeds.js` and `src/ui/finds.js`: a pop
that has to wait is cleared from the screen while it waits.

**W3. A find pop pops up over a bait row or a person's card.** The pop (top 38 %) covers "Grasshoppers" on the bait row and
the first lines of Josh's card (`350-L04-v14-bait-row-fort-laramie.jpg`, `335-L03-v14-find-pop-new-a-magpie-feather.jpg`):
it was already showing when the bar or card opened, and a pop only asks "may I show?" when it starts. Fixed: `findPop.suspend()`
on every card and bar (`src/ui/finds.js`, `showCard` / `showBar` in `src/main.js`): the pop steps aside, back to the front of the
queue, and comes out when clear (`fixed-W3-bait-row-clear.jpg`).

**W4. Toasts bury the far-off trail-fact scenes.** The far-off rifles, the wolves and the prairie glow play under a stack of
two or three toasts at the top of the screen (the birds lifting and the ridge are drawn exactly there)
(`154-L02-v14-ambient-crack.jpg`, `189-L02-v14-ambient-wolves.jpg`). Fixed: toasts wait while a fact's vignette plays, as they do
for a mini-game (`vignetteOn` in `src/main.js`). Toasts that were already up still finish (`fixed-W4-wolves-no-toasts.jpg`).

**W5. `totals.dustDevils` was never counted.** A dust devil with two hats caught left `dustDevils: 0` and `hatsCaught: 2` in the
journey's totals. Fixed in `src/journey/moments.js` (`dustDevilResult`).

### Ugly (not fixed)

- **U1. Toasts outlive their screen and stack.** "Three throws! The dog flops down by the fire, happy." (from camp) is still up
  7 s later on the trail and again on the next screens (`134-L02-stale-toast-trail.jpg`); toasts from the store sit over the dog's
  name field. The 1.2 toast rules hold them behind the voice, which is long in a game with a dog this chatty.
- **U2. Deed pops draw over the camp cards, the store rows and the grasshopper instruction** ("Skipper", "Wish maker", "Keeper"):
  readable for 3.4 s, then gone, but they sit on the choices a child is about to make.
- **U3. The camp's bottom bar ("Three treats! / Done") covers the dog** where he flops down by the fire after the last throw
  (`125-L01-v14-fetch-dog-flops-by-the-fire.jpg`).
- **U4. The bait row is drawn over the wagon**, so the wagon and the party show through the ghosted (disabled) buttons.
- **U5. Twelve skips on every throw.** A bot that taps at the beat gets 12 skips every time; for a child with a finger the 180 ms
  window is generous, but the personal best is reached at once. The cap and the window are the spec's (SPEC v1.4 §1.4).

### Nit

- **N1.** The Finds page's treat jar says "longest throw: 98 in 100" (the fetch distance as a fraction); a child reads it as a score
  out of a hundred, which is fine, but "98 %" or a distance would read better.
- **N2.** The playtest's "pressure?" word list flags Eli's "Pronghorn, two o'clock" (the word "clock"); it is a compass bearing, not a timer.
- **N3.** The spoon never turned up among the dog's finds in 19 finds (it is 0.3 weight, rare by design), so "8 of 9 finds" is a
  complete journal for this run.

### Script problems (not game bugs, fixed in the script)

- The bot's fishing loop kept polling after the last cast, while the summary card was waiting for a tap: a 50 s "stall" at The Dalles.
  It now hands over to the card.
- A lead-shot aim point beyond the screen edge was tapped (reported as "lands on nothing"); the bot now skips such animals.

The fixes were re-checked with a second run of legs 1-5 (514 shots, fresh save): no "blocks play", the same new screens, no console errors.

## Fun

The new things are a relief after 1.2: the dog now does something on every leg (a find, a warning, a chase, a patch of berries) and
the camp has five things to try before the results. Fishing at 75 s a session is the best of the new games: the yellow shiver
then red wobble is readable at once, the "wiggled off" retry is gentle, and the sturgeon's "takes two" is a good moment (the
companion who answers is the one the child picked). The leading hunt is harder and visibly so (the dotted guide on the first
arrow, "GOOD LEAD!"). The trail facts land as ten-second postcards; the grizzly and the far-off rifles are the memorable two.
The locket is a real thread through five stops and the bottle a second one that wraps up at the end. Remaining softness: the
rewards for fetch and finds are small (a token or a few dollars) and nothing asks the child to choose between them.
