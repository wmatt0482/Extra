# Trail Blazer

Learning Lab's second game, at **learninglab.fun/trail-blazer/**. A **motocross-style race** in the **Ranger 150**, a
kid-size sage-green side-by-side (v1.5: one of 8 vehicles), against three rivals on six tracks (Pine Ridge, Granite
Gap, Lake Loop, Snow Pass, Desert Wash, Night Ride; v1.5: 18 trails in 3 cups; v1.7: 30 in 5). A 3-2-1 gate drop starts each race; in the air BRAKE is a backflip and GAS a
front flip; land on the downslope for a PERFECT; a crash respawns at the last checkpoint. Finishing 3rd or better
opens the next track; medals follow the place (1st gold, 2nd silver, 3rd bronze; beating a track's target time can
only raise it, so a 2nd under the gold time is gold); cash buys Engine, Tires, Suspension and Boost
upgrades (10 levels each); finished tracks and medals unlock paints, flips / a long race / a win unlock decals.

**v1.2 adds the Grade 4 math-facts layer** (`SPEC.md` §4-§5 and "v1.2"): every race has **Math Gates** (3 / 4 / 6,
default 4). At a gate the whole race freezes (rivals, clock, everything) and a fact appears in big type and is read
aloud ("seven times eight"). The child types the answer on a numpad: right within 3 s is **⚡ Quick** (a big boost
and +$200), right is +$120 and a smaller boost; a miss shows the whole fact with its answer and a strategy hint (read
aloud), covers it after 2.5 s and has the child type it from memory (cover-copy-compare), then opens the gate with
no boost while the rivals get a 1.5 s head start. Facts are scheduled with Leitner boxes and incremental rehearsal,
come back over days, and turn **Mastered** (box 3, right on 2+ days, 3 first-try answers) and **Fluent** (mastered and
quick on 2 days). The **Fact Grid** (title → Facts) shows every fact's status; 12 gate answers a day is the daily
mission ($400 and +100 XP, once). Why each piece is there, with sources: `docs/LEARNING-DESIGN.md`.

**v1.3 makes it adaptive**: after the first finished race the results offer a short **Pit Crew Check** (an adaptive
staircase over the tables, about 20 facts, ending on a **Start line** screen), and **Auto mode** (the default) then
practices two families up the ladder (the lowest unfinished tier first, the weakest within it), mixed with known ones (60 / 30 / 10), moves on at 90 % mastered /
70 % fluent, re-checks mastered facts every 15 races or 7 days, and reads each miss for its error pattern (the hint
and the Parent Zone Report use it).

**v1.4 finds where they are, fast**: the Pit Crew Check runs before the first race ("Race first" works twice, then the card
has only Start and the way out of the check leads to the title; a finished check resets that), locates from ×6 ×9 and zooms in; a family the child answers right and quick moves on
the same day ("secure"); one scout gate a race reaches a tier ahead (3 quick scouts vouch a family); re-checks offer
themselves after 14 days or when the placement looks stale; and a difficulty governor keeps the gates at the learning
level ("Right now: on target (10 of 12 right)"), stepping back to an easier family when it is a bit hard.

**v1.5 "The Season" adds the long runway** (`SPEC.md` "v1.5"): **8 vehicles** (Ranger 150, Dune Quad, Dirt Bike 85,
Rock Bawler, Mud Monster, Turbo RZR-X, Thunder Rail, Moon Rover; each with its own feel and special, bought with race
cash in the garage's Vehicles row, upgrades per vehicle at its tier's cost), **18 trails in 3 cups** (Rookie, Pro,
Legend: each pays more, ×1 / ×2 / ×4; the next cup opens with a trophy from the cup's weekend AND stars: "Pro Cup: a
Rookie trophy + 12 ★", Legend 30 ★), **championship
weekends** (3 races on the cup's last 3 trails once all are open, points 10 / 6 / 3 / 1, standings between races, a
podium with the trophy and a cash bonus), **stars** (3 a trail: 1st, every gate right, the trail's stunt), **crates**
(bronze / silver / gold, opened with a tap on the results or the **Garage Wall**: helmets, suits, horns, boost trails,
flags, paints, decals, a set bonus paint for each completed set), **rivals** (the trio on the grid; beat the leader 3
times and they retire to the Hall of Rivals), the **ghost** of the best run, the **streak** (Spell Jump's, with the
weekly shield) and the daily **Pit Challenge** (one trail + one twist, double cash, a bronze crate). The math is never
behind a reward: every race has its gates whatever the child owns (`docs/LEARNING-DESIGN.md` row 21).

The runway, from `node trail-blazer/tools/economy-sim.mjs` (40 simulated 4th graders: 12-minute sessions of ~6 races,
3rd or better by the 3rd try, 70 % of gates right, half of them quick; prices and multipliers in `src/data/runway.js`):

| Milestone | Price / rule | Races | Hours | Target |
|---|---|---|---|---|
| Dune Quad | $170,000 | 24 | 0.8 h | ~1 h |
| Dirt Bike 85 | $700,000 | 54 | 1.8 h |  |
| Rock Bawler | $2,400,000 | 111 | 3.7 h |  |
| Mud Monster | $5,500,000 | 190 | 6.3 h | ~7 h |
| Turbo RZR-X | $15,000,000 | 333 | 11.1 h |  |
| Thunder Rail | $22,000,000 | 446 | 14.9 h | ~15 h |
| Moon Rover | $56,000,000 | 682 | 22.7 h | ~23 h |
| Pro Cup open | a Rookie trophy + 12 ★ | 24 | 0.8 h | ~1 h |
| Legend Cup open | a Pro trophy + 30 ★ | 89 | 3.0 h | ~3 h |
| Champion Cup open | a Legend trophy + 50 ★ | 255 | 8.5 h | ~9 h |
| Masters Cup open | a Champion trophy + 70 ★ | 347 | 11.6 h | ~12 h |
| 12 stars |  | 22 | 0.7 h |  |
| 30 stars |  | 83 | 2.8 h |  |
| 54 stars |  | 192 | 6.4 h |  |
| 70 stars |  | 321 | 10.7 h |  |
| 90 stars |  | 425 | 14.2 h |  |

Crates: 1.29 a race in the first 60 races (one every 0.8), 0.76 a race in races 600-900.
Longest stretch with nothing new (a vehicle, an upgrade, a crate, a star, a trail): 5 races (target < 10).
Upgrade multiplier per tier: 1 / 1.6 / 2.5 / 4 / 7 / 12 / 20 / 35 · cup cash: ×1 / ×2 / ×4 / ×7 / ×10
Hill Climb: $25138 a race on average (with the cup multiplier), a summit in 78 % of climbs.

**v1.6 syncs Trail Blazer across the family's devices** (`SPEC.md` "v1.6"): the family code a parent already uses for
Spell Jump (Parents → Family code) now carries each child's Trail Blazer save (`<id>.tb`: cash, vehicles, upgrades,
medals, stars, cups, gear, ghosts) and math facts (`<id>.facts`) through the same Netlify Function. Trail Blazer
registers both kinds with Spell Jump's sync client (`src/meta/sync.js`, which holds the merge rules: purchases, fact
records and practice days are never lost when two devices played offline; a reset on one device wins). The facts are
stored compactly (day lists capped at 12, default fields dropped: a mature store of 222 facts after 30 days is about
135 KB instead of 363 KB) and the ghosts packed (about 11 KB a trail), so both fit a sync request. Newer data from
another device loads when it arrives, never in the middle of a race. Tests: `tools/facts-tests.mjs` (merge rules, caps,
size) and `tools/sync-smoke.mjs` (two devices on one in-memory server, plus Spell Jump on the same code).

**v1.6.2:** Parents → Report opens with each child's week ("Ladder: 58 % of families secure", a bar, and "This week: 91 % right at the gates (42 of 46) · moved up: ×6 ×9"; `src/facts/progress.js`), and the Family code tab shows a strip per child ("Math this week · 58 % of the ladder · 91 % right"). Parent-facing only, never on the kid's screens.

**v1.7 "Hill Climb" (Matt, Oct 30: "ran out of races, it's still kinda easy for them; add a bonus round with a hill
climb")** (`SPEC.md` "v1.7"): after every **finished** race the steep wall past the finish is a **mountain**: five
flags, a snow line, a summit with a cairn. There is no gas up there: the vehicle climbs on **bursts**, one per fact. At
every hold the Gate panel asks a fact (in hill mode: "Hill Climb · Burst 3 of 10"); a right answer is a full burst (quick
or not: nothing on the hill is timed), a slow right answer climbs a little less, a miss gets the fix-it hint and the
vehicle slides back to the last flag. Each flag pays $150 × its number × the cup, the summit $1,000 × the cup (a gold
crate too, and a summit badge on the trail card); the climb ends on the summit or after 10 facts, and the results show a
"Hill Climb" row under the race's total. The hill's facts are the climb's own mix (`hillFacts`): about 40 % the
frontier, 40 % the scout family, 20 % a **stretch** into the tier above, so a child who is secure everywhere meets the
new tiers here first. **Three tiers above ÷12** (4th-grade CCSS 4.NBT.5–6): T8 tens × ones and their ÷ twins (20 × 3,
60 ÷ 20), T9 teens × ones (14 × 6, split the tens), T10 big × (23 × 4) and two-digit quotients (84 ÷ 7), each with its
hint pattern, on the ladder, in the scouts and in the Parent Zone. **Two more cups** (12 new trails on the 18 render
styles): the **Champion Cup** (×7 cash: Sunset Pines, Crimson Canyon, Frost Lake, Thunder Beach, Ember Vent, Mirror
Swamp; a Legend trophy + 50 ★) and the **Masters Cup** (×10: Midnight City, Fossil Flats, Cloud Nine, Pumpkin Hollow,
Far Side, Prism Peak; a Champion trophy + 70 ★): **30 trails in 5 cups, 90 stars**. Parents → Options → "Hill Climb"
turns the climb off; the Report counts climbs, summits, flags and the best height. **v1.7.1 (the throttle; Matt: "there
should be a way for them to control the throttle or it seems disconnected")**: a right answer now **charges** the
rocket and the kid **holds GAS to climb** (BRAKE and BOOST hide on the hill; the tank shows the charge); let go and the
vehicle stops and holds where it is, GAS again carries on; a charge left alone fires by itself after 6 s so nobody is
stranded; "Hold GAS to climb!" once, the first time. The climb distance per answer is unchanged.
**v1.8 (Parent Zone charts)**: the Report opens with "Progress over time" (2 / 4 / 12 weeks): gates answered each day
(bars), facts mastered and fluent (lines), the share right at the gates and the ladder's secure share (dashed, right
axis), from a per-day snapshot the facts store writes with every answer (`progress`, 90 days, synced by per-day max). The economy table below is the
v1.7 one (the hill roughly doubles a race's cash, the two cups end the runway at ~12 h; `tools/economy-sim.mjs
--no-hill` prints it without the climb).

**v1.6.3:** the anonymous lights-on counter (Spell Jump's `src/meta/pings.js`): a `day` ping once per device per UTC day, a `race` ping per finished race and a `check` ping per Pit Crew Check, carrying only `{ game, v, kind, fam }` (no names, no ids; see Spell Jump's README, "Usage counter").

Same house style and kid-proofing as Spell Jump: no external links, no native text inputs outside the Parent Zone,
no ads, no accounts, no lives, works offline after the first load, updates itself on a safe screen, and plays in
landscape or portrait, with touch or a keyboard (→ / Space = GAS / front flip, ← = BRAKE / backflip, ↑ / Shift =
BOOST, Esc / P = pause).

## Run it

Serve the **repo root** (Trail Blazer imports a few Spell Jump modules from `../spell-jump/`, and the repo has a dev
symlink `spell-jump -> car-jump` so that path works locally):

```
cd /path/to/repo && python3 -m http.server 8080
open http://localhost:8080/trail-blazer/
```

URL flags: `?mock=1` runs the scripted mock engine (`src/meta/mockEngine.js`) instead of the physics engine,
`?nosw=1` skips the service worker (development).

Tests:

```
node trail-blazer/tools/facts-tests.mjs    # facts, parser, hints, scheduler, store, placement, auto mode, scouts, governor, patterns (81 checks)
node trail-blazer/tools/ui-smoke.mjs       # Playwright, both orientations, on the mock engine (serves the repo root itself;
                                           # ONLY=landscape|portrait runs one, SHOTS_DIR=… keeps the screenshots)
node trail-blazer/tools/engine-smoke.mjs   # the engine (engine-owned; ONLY=v19 runs the Ghost Chase part)
node trail-blazer/tools/lab-tests.mjs      # the Lab integration, no browser: economy snapshot, looks, ghosts
node trail-blazer/tools/lab-checks.mjs     # the Lab integration in the browser (ui-smoke runs it too)
node trail-blazer/tools/make-icons.mjs     # regenerates icons/*.png
```

`bash build.sh` at the repo root copies `trail-blazer/` to `dist/trail-blazer/` (without `tools/`, `docs/`,
`dev.html`, `SPEC.md`), next to `dist/spell-jump/`.

## 1.10.0 (cohesion: one Lab chip, named money)

Stage 2 of the Lab cohesion round (`lab/docs/COHESION.md`). The game, its economy and its saves are unchanged.

- **One Lab chip** (`lab.mountChip`, top-left of the title, compact under 520 px) replaces "The Lab" menu button and the title's flame chip: the one
  header flame is the Lab streak. The rider chip and the cup sit under it; the days-in-a-row count stays on the results and in the Parents report.
- **"The Lab" on Who's riding?** (`lab.mountPickerButton`, under the cards); the "Also play: Spell Jump" link is gone (the chip's Games panel is the nav).
- **Rider LV n** on the title chip and the picker tiles (never a bare "LV"). **Trail cash** names the money on every balance pill.
- **`lab.summary('tb', ...)`**: "Rider LV n", "N of 30 trails", "Today: x / 12 math gates", when the title shows and after every race.
- **The `race` event only counts a crossed finish line** (`summary.finishCrossed`): a race quit on the trail reports nothing for "Finish a race".
  `win`, `ghostBeat`, `star` and `day` are unchanged. VERSION 1.10.0; the service worker is `trail-blazer-v1.10.0`.

## 1.9.1 (a race does not depend on the device's speed)

`tools/ui-smoke.mjs` failed now and then in a queue on a loaded machine: race 1, scripted to finish 2nd, finished 3rd.
Two causes, both measured (CDP CPU throttling at 4x / 6x and requestAnimationFrame jitter, the riders' positions logged per frame):

- **The mock engine stepped on the frame's dt** (clamped to 50 ms). Each of the player's discrete changes (the slow launch, a gate
  stop, the fixed gate's hold, the jumps, the crash and its respawn) landed on a frame boundary and cost up to a frame, while the AI
  riders' x is a closed-form function of the race clock. The race-1 script lands jump 1 and stops at gate 2 right at the 300 m
  checkpoint: anywhere from 296 to 303 m with the frame rate (301 m at a steady 60 fps). Short of 300 m the crash respawned at the
  200 m checkpoint: +1.1 s, 10.0 s instead of 8.9 s, 3rd behind Blaze (9.6 s). The same script gave 8.90 s at 120 fps, 9.10 s at
  20 fps and 10.0 s with 400 ms stalls. **Fix**: `src/meta/mockEngine.js` runs fixed 1/60 s steps (at most 8 per frame; a longer
  stall slows the whole race, every rider alike), as the real engine does: 8.93 s at every frame rate tested.
- **The answers are timed in wall-clock time, by design**: a right answer within 3 s (`QUICK_MS`) is quick (a 1.2 s push, on the
  Turbo gate a 3 s one). The test's taps take ~0.2 s unloaded, 2.2-2.4 s with a second ui-smoke running; past 3 s gates 3-4 are
  not quick and the race takes 9.53 s, 0.07 s from 3rd. That is the game working, so the test now pins the rivals' times for race 1
  (`aiTimes: [7.0, 11.5, 12.5]`): 2nd for any answer speed (8.93 / 9.53 / 10.62 s).
- **The real engine** (`src/game/engine.js`) was already right: a fixed 1/60 s step with every rider (player and AI) in the same
  step, a seeded AI and the clock in sim time; the same race gives the same order and times to the hundredth at 1x and at 6x + jitter.
- Regression check (`tools/frame-rate-check.mjs`): the same race at 1x CPU and at 6x CPU throttle (also with 0-90 ms frame jitter)
  must give the same finishing order, time and place: the mock race in `ui-smoke.mjs` (race 1's script; `ONLY=framerate` runs it
  alone), the real engine in `engine-smoke.mjs`. VERSION 1.9.1; the service worker is `trail-blazer-v1.9.1`.

## 1.9.0 (The Lab)

Trail Blazer joins **The Lab**, the meta-game across the five games (`lab/SPEC.md`; this game is §4.2). The Lab is optional and
lazy: `src/meta/labBridge.js` imports `/lab/src/index.js` on demand, and with `/lab/` missing, blocked or offline the game boots and
plays exactly as before (no Lab button, no pill, no strip; tested with every `/lab/` request blocked).

- **Reports** (once each, never per frame): `fact` (gates and the Hill Climb; `firstTry` = the answer was right on the first try),
  `race` (finished or ended), `win` (1st; never in a chase), `perfect` (the engine's perfect landing), `ghostBeat`, `summit`, `star`
  (one per new star), `day` (the finished race that counts the streak day). Lab coins and XP never touch Trail Blazer's cash or
  save; nothing in the economy changed (`tools/lab-tests.mjs` compares every exported constant and the economy functions' results
  with a snapshot taken before this version).
- **Showing it**: the XP pill in the HUD (`#hud-lab`, right of the speed readout), the Lab strip on the results (`#res-lab`), "The Lab"
  on the title, a "The Lab" row in Parents → Options (the Grown-ups panel, already unlocked). The combo moment is **Perfect Landing**
  (the fifth first-try fact of a round): a banner with rings, the cheer and the voice line.
- **Lab looks** (`src/meta/labLooks.js`, 16 items): paint (6), decal (4), rim (2) and ghost look (4). They are laid over the child's
  own look by `vehiclePreview.js playerLook` (the garage, the title, the race and the podium), so the garage's own paint and decal stay
  what the child chose; the garage says "Lab looks on: Ocean paint, Neon rims". Engine additions: `RIMS` and the `rim` look field,
  the `bolt` and `edge` (checker edge) decals, and ghost looks (`src/data/ghostLooks.js`).
- **Ghost Chase** (`src/meta/ghosts.js`, `src/ui/chasePicker.js`, engine `chase`): an open trail with a ghost gets a "Chase a ghost"
  button; the picker offers "My best" and each family member's ghost (read from their save, which the family sync already mirrors;
  nothing new is synced and nothing is written). A solo time attack: the vehicle waits on the line and the race and the ghost start on
  the first GAS; **no race clock, facts counter, gap chip, position badge or countdown** (the ghost is the clock). The Math Gates
  freeze the ghost too. A chase banks the ride's cash, best time, ghost and the gate / stunt stars, but no place: no win, podium,
  best place, unlock, rival move or place bonus. The results say "You beat Ben's ghost by 1.3 s!" / "Ben's ghost was 1.3 s ahead.
  Nice chase!".
- **Voice**: the moment, the chase intro and result lines, and the Lab's fixed lines are said through the existing voice and prepared
  with the natural voice's clips (`labVoiceTexts`).
- Tests: `tools/lab-tests.mjs` (node: economy snapshot, looks, ghosts), `tools/lab-checks.mjs` (browser, called by `ui-smoke.mjs`:
  the bridge with `/lab/` blocked, reports reaching the Lab, the pill and strip, the moment, the looks, Ghost Chase with its picker),
  Part 5 of `tools/engine-smoke.mjs` (the chase on the real engine), and a Ghost Chase section in `tools/sync-smoke.mjs` (a sibling's
  ghost arrives with the family sync). VERSION 1.9.0; the service worker is `trail-blazer-v1.9.0`.

## 1.8.1 (a wrong-product report)

Owner: "the math game says 9x12 is 96" (seen in Wagon West). Every answer, spoken sentence, strategy hint and pattern hint of
every a × b (0 … 12), ÷ and related fact is now swept by `tools/facts-tests.mjs`, and `tools/ui-smoke.mjs` drives 60 gates
(race, turbo, hill) asserting the question on screen, the spoken question, the graded and revealed answer and the recorded fact
agree. Nothing wrong was found in those. Wording that read like a false equation is fixed: the Report's pattern lines said
"(like 9 × 12 → 96)" where 96 is what the child TYPED, now "(like 9 × 12: answered 96)"; a two-step pattern hint said
"take away 2 × 12 is 108", now "take away 2 × 12 (24) is 108". VERSION 1.8.1; the service worker is `trail-blazer-v1.8.1`.

## For parents

Trail Blazer uses **the same family as Spell Jump**: the same players, the same parent PIN and the same family code.
Nothing has to be set up twice.

- **Parents** (top-right on the player screen, or on the title) opens the Parent Zone with the family PIN. On a new
  device without a PIN you choose one; "Forgot PIN?" works like Spell Jump's (hold 3 s, then a grown-up
  multiplication).
- **Family code**: create a family or join one with the code from Spell Jump (Parents → Family code). Players made
  in either game show up in both, on every device in the family.
- **Facts this week** (per player): **Auto (recommended)** shows what the game is working on and why ("×7 and ×8: 5
  misses this week"), "Where Mia is" (tier, frontier, placed, re-check in N days, families vouched by scouts), the dial ("Right now: on target"), every family's place on the ladder (secure, vouched, scouting) and **Check now**; **Pick
  families** = the ×2 … ×12 toggles (stock: ×2 … ×9); **Custom list** = only your own problems, one per line (`7 x 8`,
  `56 / 7`, `34 + 19`, `80 - 46`; up to 60; answers are worked out for you; a bad line is reported by its number).
  "÷ too" and "+ and − within 20" decide which operations are allowed in every mode.
- **Options**: per player: math gates per race (3 / 4 / 6), new facts per day (3 / 5 / 8 / All), facts aloud (the
  voice itself is set in Spell Jump → Parents → Options, natural voice included); for this device: sound, music,
  reduced motion, screen shake; change the PIN.
- **Report** (per player): each operation's facts by status (New / Learning / Almost / Mastered / Fluent), the
  **Patterns** in plain words ("Division is weaker than multiplication"), **Moved up** ("×8 ×11 → ×8 ×12: 3 quick scouts in
  ×11"), the dial race by race, what auto mode is working on, the slowest
  facts, this week's races (right / quick / fixed), and **Copy report** (plain text for a teacher).
- **Players**: rename, reset a player's facts data, reset their Trail Blazer progress on this device, or remove a
  player (removes them from the family in every game).

Trail Blazer's own progress is stored per device: `trailBlazer.<playerId>.save` (cash, upgrades, medals, best times,
paint) and `trailBlazer.<playerId>.facts` (this week's set, every fact's record, today's mission, XP, the math
options, recent races); syncing them is a later phase.

## How it is built

- Plain ES modules, no build step; Matter.js (`../spell-jump/vendor/matter.min.js`) for the physics.
- Shared with Spell Jump at runtime, never copied or modified: `spelling/profiles.js` (family, players, PIN),
  `sync/client.js` (family sync), `audio.js` (sound effects and music), `ui/dom.js`, `ui/icons.js`,
  `ui/controls.js` (the multi-touch GAS / BRAKE / BOOST buttons), `spelling/tts.js` + `spelling/cloudVoice.js`
  (reading facts aloud with the player's Spell Jump voice, the natural cloud voice when the family has a code).
- The math layer is pure modules (`src/facts/*`, no DOM, no storage, `now` passed in) under `tools/facts-tests.mjs`;
  `main.js` asks `nextFact()` on the engine's `gate` event, shows the Gate panel, `recordAnswer()`s the result and
  calls `game.openGate({ correct, quick, fixed })`.
- localStorage: `trailBlazer.<playerId>.save` (the save), `trailBlazer.<playerId>.facts` (math facts),
  `trailBlazer.settings` (device settings). The family keys
  (`spellJump.family`, `spellJump.sync`) are only touched through `profiles.js` and the sync client.
- The service worker (`sw.js`) caches the app shell and the shared Spell Jump files it loads; index.html and
  `src/main.js` are network-first, the rest cache-first with a background refresh. Bump `VERSION` on every deploy.

## Files

```
trail-blazer/
  index.html              app shell: every screen and all CSS (forest chrome, blaze-orange accent)
  manifest.webmanifest, sw.js, icons/
  SPEC.md                 the build spec (v1 phasing note at the top; §4-§5 + "v1.2" = the math layer)
  docs/LEARNING-DESIGN.md every learning technique → its source → where it is in the game
  src/main.js             boot, players, screens, the race lifecycle (countdown, banners, Math Gates, podium), pause,
                          voice, sync, self-update
  src/facts/facts.js      fact strings ("7x8", "56/7", "19+34", "80-46"): parse, answer, text, speech, families,
                          difficulty order, this week's set, the custom-problem parser (errors by line)
  src/facts/spoken.js     numbers and operators in words ("fifty-six", "divided by")
  src/facts/hints.js      the strategy hint for every fact (×9 "10 × 7 is 70, take away 7", ÷ "7 × ? = 56", make ten …)
  src/facts/scheduler.js  Leitner boxes, mastery / fluency, the session (re-queue, incremental rehearsal), pickNext
  src/facts/store.js      the per-player facts store: set, records, today's mission, XP / levels, report, normalize
  src/facts/placement.js  the Pit Crew Check staircase, the placement, seeding the records, the Start line
  src/facts/adaptive.js   auto mode: the frontier, advancement / re-entry, the 60 / 30 / 10 gate mix, the retention probe
  src/facts/patterns.js   error patterns: classify a miss, pattern-shaped hints, the Report's Patterns
  src/facts/scouts.js     scout gates (family, fact, vouching) and the re-check triggers
  src/facts/governor.js   the difficulty governor: the dial over the last 12 gates, the race quota, step-back
  src/sfx.js              Trail Blazer-only sounds (countdown beeps, gate drop, finish cowbell, splash, gate creak,
                          v1.5: horns, the star chime, a crate's rattle and burst)
  src/data/upgrades.js    the 4 upgrades, costs (300 × 1.45^level), resolveStats()
  src/data/paints.js      paints (finished tracks, medals) and decals (a 250 m race, 10 / 50 flips, a win)
  src/data/medals.js      medal times (MEDAL_TIMES from data/trails.js, with a fallback), raceMedal (place, then time), formatting
  src/data/fallbackTrails.js  the 6 trails for the menus if data/trails.js fails to load
  src/data/fallbackVehicles.js  the 8 vehicles for the menus if data/vehicles.js fails to load
  src/data/runway.js      the economy knobs (vehicle prices, tier multipliers, cup cash, weekend bonus, stars to open a
                          cup, daily ×2), tuned with tools/economy-sim.mjs
  src/data/cups.js        the 5 cups (v1.7), points 10 / 6 / 3 / 1, trophies, cupOf / cupMult
  src/data/cosmetics.js   rider gear (12 helmets, 8 suits, 6 horns, 8 boost trails, 6 flags) + paints / decals as
                          Garage Wall items, crate tiers, set bonuses, streak rewards
  src/data/rivals.js      the 8 rivals (paint, helmet, taunt, cheer), the trio, retiring the leader
  src/data/trails.js, vehicles.js, mutators.js  the 30 trails (v1.7), 8 vehicles and 7 Pit Challenge twists
  src/game/*              the engine, course, renderer, vehicle art (engine-owned)
  src/meta/save.js        save + device settings, normalize + versioning
  src/meta/economy.js     upgrades, unlock chain (3rd or better), banking a race (place, time, medal), cash rows that
                          add up, paints / decals owned
  src/meta/selfUpdate.js  reload-on-a-safe-screen guard for new versions
  src/meta/mockEngine.js  scripted race with the same contract (?mock=1, tests, fallback)
  src/meta/crates.js      earning, rolling (weighted, pity, cash when nothing is new) and opening crates; the Garage Wall
  src/meta/season.js      stars, the streak (Spell Jump's engagement.js), the daily Pit Challenge, weekends, the play log
  src/meta/sync.js        the family-sync kinds <id>.tb and <id>.facts and their merge rules (v1.6)
  src/ui/players.js       player picker + new player (on-screen keyboard)
  src/ui/keyboard.js      the on-screen keyboard (same as Spell Jump's)
  src/ui/garage.js        the Vehicles row (buy / select), per-vehicle upgrades, Paint / Decal / rider gear strip
  src/ui/trails.js        the Cups screen (3 tabs, trail cards with stars / medal / best time, Race the cup)
  src/ui/wall.js          the Garage Wall (every set "7 / 12", set bonuses, wear an item, open crates)
  src/ui/crate.js         the crate moment (tap: shake, burst, NEW! or +$)
  src/ui/items.js         small pictures of every collectible
  src/ui/hud.js           race HUD (position badge, timer, track bar with every rider, speed, boost gauge, banners)
  src/ui/results.js       results (podium, time + medal + best, the race's facts ⚡ ✓ ↻, cash rows, mastered / mission /
                          XP / unlock callouts, level-up stamp)
  src/ui/gatePanel.js     the Math Gate panel (ask → right / quick, or wrong → fact + answer + hint → covered → copy)
  src/ui/numpad.js        the 0-9 ⌫ GO numpad (touch and keyboard)
  src/ui/grid.js          the Fact Grid (× and ÷ views, status colors, tap to hear)
  src/ui/pitCheck.js      the Pit Crew Check card before a race, the check run in the gate panel, the Start line screen
  src/ui/parentZone.js    Parent Zone (PIN, Family code, Facts this week, Options, Report, Players)
  src/ui/vehiclePreview.js  vehicle previews with the rider's gear (the engine's art, with a built-in Ranger fallback)
  src/ui/tbIcons.js       extra icons (tire, trail, flask, ghost) on top of Spell Jump's set
  src/meta/labBridge.js   the one file that knows the Lab: lazy import, queued calls, inert when /lab/ is missing (v1.9)
  src/meta/labLooks.js    the 16 Lab items Trail Blazer draws (paint, decal, rim, ghost look) and their shop previews (v1.9)
  src/meta/ghosts.js      Ghost Chase's ghosts: your best and a family member's (read-only), the result lines (v1.9)
  src/data/ghostLooks.js  how a ghost rider is dressed (outline, opacity, trail) (v1.9)
  src/ui/chasePicker.js   the "Chase a ghost" picker (v1.9)
  tools/ui-smoke.mjs      UI smoke test; tools/facts-tests.mjs math-layer tests; tools/make-icons.mjs icon renderer
  tools/economy-sim.mjs   the economy simulator (the runway table above)
  tools/sync-smoke.mjs    family sync end to end (two devices, one server, Spell Jump on the same code)
```
