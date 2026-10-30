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
turns the climb off; the Report counts climbs, summits, flags and the best height. The economy table below is the
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
node trail-blazer/tools/engine-smoke.mjs   # the engine (engine-owned)
node trail-blazer/tools/make-icons.mjs     # regenerates icons/*.png
```

`bash build.sh` at the repo root copies `trail-blazer/` to `dist/trail-blazer/` (without `tools/`, `docs/`,
`dev.html`, `SPEC.md`), next to `dist/spell-jump/`.

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
  src/ui/tbIcons.js       extra icons (tire, trail) on top of Spell Jump's set
  tools/ui-smoke.mjs      UI smoke test; tools/facts-tests.mjs math-layer tests; tools/make-icons.mjs icon renderer
  tools/economy-sim.mjs   the economy simulator (the runway table above)
  tools/sync-smoke.mjs    family sync end to end (two devices, one server, Spell Jump on the same code)
```
