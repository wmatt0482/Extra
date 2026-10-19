# Trail Blazer

Learning Lab's second game, at **learninglab.fun/trail-blazer/**. A **motocross-style race** in the **Ranger 150**, a
kid-size sage-green side-by-side, against three rivals (Max, Zoe, Kai) on six tracks (Pine Ridge, Granite Gap, Lake
Loop, Snow Pass, Desert Wash, Night Ride). A 3-2-1 gate drop starts each race; in the air BRAKE is a backflip and GAS a
front flip; land on the downslope for a PERFECT; a crash respawns at the last checkpoint. Finishing 3rd or better
opens the next track; race times earn Gold / Silver / Bronze medals; cash buys Engine, Tires, Suspension and Boost
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
node trail-blazer/tools/facts-tests.mjs    # facts, parser, hints, scheduler, store (46 checks, no browser)
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
- **Facts this week** (per player): the ×2 … ×12 families (stock: ×2 … ×9), "÷ too" (the division facts that undo
  them), "+ and − within 20", and **custom problems**, one per line (`7 x 8`, `56 / 7`, `34 + 19`, `80 - 46`; up to
  60; answers are worked out for you). A line that is not a problem is reported by its number and skipped.
- **Options**: per player: math gates per race (3 / 4 / 6), new facts per day (3 / 5 / 8 / All), facts aloud (the
  voice itself is set in Spell Jump → Parents → Options, natural voice included); for this device: sound, music,
  reduced motion, screen shake; change the PIN.
- **Report** (per player): each operation's facts by status (New / Learning / Almost / Mastered / Fluent), the
  slowest facts, this week's races (right / quick / fixed), and **Copy report** (plain text for a teacher).
- **Players**: rename, reset a player's facts data, reset their Trail Blazer progress on this device, or remove a
  player (removes them from the family in both games).

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
  src/sfx.js              Trail Blazer-only sounds (countdown beeps, gate drop, finish cowbell, splash, gate creak)
  src/data/upgrades.js    the 4 upgrades, costs (300 × 1.45^level), resolveStats()
  src/data/paints.js      paints (finished tracks, medals) and decals (a 250 m race, 10 / 50 flips, a win)
  src/data/medals.js      medal times (MEDAL_TIMES from data/trails.js, with a fallback), place / time formatting
  src/data/fallbackTrails.js  the 6 trails for the menus if data/trails.js fails to load
  src/data/trails.js      the trails (engine-owned)
  src/game/*              the engine, course, renderer, vehicle art (engine-owned)
  src/meta/save.js        save + device settings, normalize + versioning
  src/meta/economy.js     upgrades, unlock chain (3rd or better), banking a race (place, time, medal), cash rows that
                          add up, paints / decals owned
  src/meta/selfUpdate.js  reload-on-a-safe-screen guard for new versions
  src/meta/mockEngine.js  scripted race with the same contract (?mock=1, tests, fallback)
  src/ui/players.js       player picker + new player (on-screen keyboard)
  src/ui/keyboard.js      the on-screen keyboard (same as Spell Jump's)
  src/ui/garage.js        upgrades, paint + decal strip, Ranger preview
  src/ui/trails.js        track select (mini-landscape cards, lock state, medal, best time)
  src/ui/hud.js           race HUD (position badge, timer, track bar with every rider, speed, boost gauge, banners)
  src/ui/results.js       results (podium, time + medal + best, the race's facts ⚡ ✓ ↻, cash rows, mastered / mission /
                          XP / unlock callouts, level-up stamp)
  src/ui/gatePanel.js     the Math Gate panel (ask → right / quick, or wrong → fact + answer + hint → covered → copy)
  src/ui/numpad.js        the 0-9 ⌫ GO numpad (touch and keyboard)
  src/ui/grid.js          the Fact Grid (× and ÷ views, status colors, tap to hear)
  src/ui/parentZone.js    Parent Zone (PIN, Family code, Facts this week, Options, Report, Players)
  src/ui/vehiclePreview.js  Ranger previews (the engine's vehicle art, with a built-in fallback)
  src/ui/tbIcons.js       extra icons (tire, trail) on top of Spell Jump's set
  tools/ui-smoke.mjs      UI smoke test; tools/facts-tests.mjs math-layer tests; tools/make-icons.mjs icon renderer
```
