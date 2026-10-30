# Trail Blazer — build spec (v1)

> **Phasing (Matt, Oct 17):** v1 ships the trail-riding game WITHOUT the educational content: no gates, no gate panel,
> no Fact Grid, no facts tabs in the Parent Zone. Boost fuel comes from trail coins and good landings; the winch is
> free. The engine keeps the gate mechanics (started with `gates: 0`) so the math layer in §4-§5 can be added in a
> later phase without engine changes. Sections 4, 5 and the facts parts of 2 and 7 describe that later phase.

Learning Lab's second game, at **learninglab.fun/trail-blazer/** (folder `trail-blazer/`, deployed by `build.sh` next to
Spell Jump at `/spell-jump/`). A trail-riding game in a kid-size side-by-side (the sage-green **Ranger 150**: black
roll cage, orange stripe + "150" decal, knobby tires, cargo bed, mesh doors) where the learning layer is **4th-grade
math facts**: multiplication and division fluency (the grade's core fluency target), with addition / subtraction and
custom problems available to parents. Same house style, same kid-proofing and the same family as Spell Jump.

Audience: 4th graders (9-10) on an iPhone in landscape, also portrait, iPad, laptop. Parents set things up once a week.

## 0. Non-negotiables (from Spell Jump, same reasons)

- Kid-proof: no external links, no native text inputs outside the Parent Zone (numbers are typed on an on-screen
  numpad), no lives / energy / countdown timers visible to the child, no ads, no accounts.
- The learning IS the game (intrinsic integration): a right answer is what opens the trail gate and fills the boost
  tank; there is no "do math, then play".
- Never show a wrong answer as something to pick from (no multiple choice); a wrong typed answer is cleared within
  seconds and the correct fact is shown instead.
- Everything works offline after the first load (service worker, same pattern as `car-jump/sw.js`), self-updates on
  safe screens (`car-jump/src/meta/selfUpdate.js` pattern).
- Works with the keyboard on a laptop (→ / Space = GAS, ← = BRAKE, ↑ = BOOST, digits + Enter on the gate panel).

## 1. Shared with Spell Jump (import at runtime, do not copy)

Both games are deployed on the same origin; `trail-blazer/` imports a few Spell Jump modules by relative URL
`../spell-jump/src/...` (the repo has a dev symlink `spell-jump -> car-jump` so the same path works locally with
`python3 -m http.server` from the repo root). Only these modules, nothing else:

| Module | Used for |
|---|---|
| `../spell-jump/src/spelling/profiles.js` | the family record (`spellJump.family`: players, PIN, options, lastPlayer), `loadFamily`, `createPlayer`, `checkPin`, `setPin`, `playerOptions` (voice rate, voice name, cloudVoice), `playerById`. The **same players, PIN and family code** as Spell Jump: nothing to set up twice. |
| `../spell-jump/src/sync/client.js` (+ its deps) | family sync, so a player created here shows up in Spell Jump on every device. Started the same way (`createSyncClient({...})`, `start()`); it syncs the family record and Spell Jump's keys. **Trail Blazer's own save is per device in v1** (key `trailBlazer.<playerId>.save`); syncing it is a later phase that extends `car-jump/src/sync/protocol.mjs` + `netlify/functions/family.mjs` with a `trail` key kind. |
| `../spell-jump/src/spelling/tts.js` (`createTTS`), `cloudVoice.js` (`createCloudVoice`), `../spell-jump/src/tts/voices.js` | the voice: `tts.say('seven times eight')` reads each fact aloud (device voice; the natural Google voice when the family has a code and the player's Spell Jump voice option picked one — clips come from the same `/api/tts/prepare` API, texts are plain sentences like "seven times eight.", "fifty-six."). Use `tts.setVoice`, `setRate`, `setCloud`, `unlock()` inside taps, `cancel()` exactly as Spell Jump's main.js does. |
| `../spell-jump/src/audio.js` (`Audio`) | sound effects + music bus + voice ducking (`engine(speed01)`, `nitro(on)`, `land`, `smash`, `coin`, `correct`, `oops`, `cash`, `fanfare`, `cheer`, `click`, `error`, `unlock()`, `setSound`, `music`, `duck`, `suspend/resume`). Add no new sounds there; Trail Blazer-only sounds (winch, splash, gate creak) go in `trail-blazer/src/sfx.js` using the same WebAudio context pattern. |
| `../spell-jump/src/ui/dom.js` (`$`, `h`, `money`), `icons.js` (`icon`, `hydrateIcons`), `controls.js` (`createControls`) | DOM helpers, the icon set, the multi-touch GAS / BRAKE / BOOST buttons (the third control is labelled BOOST here; keys ↑ / Shift). |
| `../spell-jump/vendor/matter.min.js` | physics (loaded with a `<script>` tag, global `Matter`). |

Everything else is Trail Blazer's own (`trail-blazer/src/...`). Spell Jump's files are **never modified** for this game
(except `build.sh`, `netlify.toml`, `site/index.html` at the repo root). Spell Jump's tests must still pass.

localStorage keys: `trailBlazer.<playerId>.save` (game save), `trailBlazer.<playerId>.facts` (the math data),
`trailBlazer.settings` (device: sound, music, reduced motion, shake). Family / players / PIN / voice options / family
code: Spell Jump's keys through `profiles.js` (read + the same write helpers; never write those keys directly).

## 2. Screens

Same house style as Spell Jump: copy its CSS custom properties (`:root` block of `car-jump/index.html`), fonts
(Bungee display + Rubik body from Google Fonts), the button / card / topbar / panel / toast patterns, safe-area
padding, landscape-first with a portrait layout. Trail Blazer's accent is forest + orange: `--accent: #ff8a1f`
(blaze orange, `--accent-edge: #b35400`, `--accent-ink: #2a1400`), with sage `#6d8a5a` and pine `#1f4d2e` in the art.

1. **Player picker** (first screen): the family's players as tiles (name, color, Ranger avatar painted in the
   player's color, level), "+ New player" (on-screen keyboard for the name, as Spell Jump), **Parents** button
   top-right (PIN-gated Parent Zone, same PIN as Spell Jump), "Synced · CODE" chip when the device is in a family,
   and a small **Learning Lab** home link (`../`) + a **Spell Jump** link (`../spell-jump/`) in the picker only
   (both same-origin, so the no-external-links rule holds).
2. **Title**: logo "TRAIL BLAZER", the Ranger idling, RIDE (big), Garage, Fact Grid, Daily (mission state), Parents.
3. **Garage**: the Ranger (procedural preview, `drawVehicle`), 4 upgrades × 10 levels bought with cash (Engine: power
   and top speed; Tires: grip + mud/snow handling; Suspension: bump tolerance before a stall / flip, air control;
   Boost: tank size + thrust), paint colors (Sage Green stock, then one per mastered fact family: Blaze Orange ×2,
   Lake Blue ×3, Granite Gray ×4, Snow White ×5, Sunset Red ×6, Pine ×7, Sky ×8, Gold ×9, Purple ×10, Black ×11,
   Rainbow ×12; division families unlock decals: mud splats, flames, stars, checkers).
4. **Trail select**: 6 trails with a mini-landscape card, length, best distance, lock state (finish one to unlock
   the next): Pine Ridge (forest, 600 m), Granite Gap (rocks, boulders, 900 m), Lake Loop (water crossings, bridges,
   1,200 m), Snow Pass (ice grip 0.6, 1,500 m), Desert Wash (sand, cactus, dunes, 1,800 m), Night Ride (dark sky,
   headlights, fireflies, 2,200 m). Procedural, seeded per trail so a trail can be learned.
5. **Ride** (the run): HUD with distance + progress to the finish flag, cash, boost gauge, facts counter
   ("Facts 3 / 12" toward today's mission); GAS / BRAKE / BOOST buttons; pause (sound, music, motion, shake, end ride).
   **Trail Gate** every ~110-150 m (seeded): a wooden trail sign across the trail; the Ranger stops in front of it
   (the engine parks it: see §3) and the **Gate panel** opens (§4). Answer → the gate swings open, the Ranger gets
   boost fuel (+ a burst) and cash, and rides on. **Stuck** (speed ≈ 0 for 2.5 s on a slope, or upside down): a
   "Winch" button appears; the winch asks one fact (a Gate panel in winch mode); a right answer pulls the Ranger
   upright and 6 m up the trail. **Finish flag** at the trail's end; the ride ends there (or when the Ranger falls off
   the world / after a long stall with no winch answer).
6. **Results**: distance, cash breakdown (distance, air, smashes, gate bonuses, quick-answer bonuses), facts this ride
   (each fact with ✓ / ⚡ quick / ↻ fixed), "N facts mastered!", daily mission state, buttons Garage / Ride again /
   Next trail.
7. **Fact Grid**: the mastery grid: a 12 × 12 multiplication table (and a ÷ view) where each cell is colored by
   status (New / Learning / Almost / Mastered / Fluent); the child taps a cell to hear and see the fact. Also the
   kid-facing progress screen (Fuchs: progress monitoring that the learner can see).
8. **Parent Zone** (PIN): tabs Family code (same as Spell Jump, opens first) · Facts this week · Options · Report ·
   Players. Facts this week: toggles for the ×2 … ×12 families, "÷ too" (the inverse facts of the chosen families),
   "+ and − within 20", and a **Custom problems** textarea, one per line (`7 x 8`, `56 / 7`, `34 + 19`, `80 - 46`;
   answers are computed, integers only; a bad line is reported with its line number). Options: new facts per day
   (3 / 5 / 8 / All), gates per ride (4 / 6 / 8), voice (reuses the player's Spell Jump voice options: rate + chosen
   voice, read-only here with a note "set in Spell Jump → Parents → Options"), facts aloud on/off. Report: per
   operation the grid with counts (New / Learning / Almost / Mastered / Fluent), slowest facts, this week's rides, a
   "Copy report" text. Players: rename / remove (same as Spell Jump), reset facts data.

## 3. Engine contract (`trail-blazer/src/game/engine.js`, the engine agent)

Matter.js, canvas 2D, meters, +y up in the world (flip for canvas as Spell Jump does). Same architecture as
`car-jump/src/game/engine.js` (fixed step, interpolated draw, pooled bodies, chunked terrain) but a **hill-climb
driving model**, not a ramp jump:

```js
const game = createGame(canvas, { onEvent });   // onEvent(evt) for every event below
game.start({ trail, stats, seed, paint, decal, bestDistance, gates });  // parked at the trail head, engine idling
game.setInput({ gas, brake, boost });            // held buttons (booleans), every frame or on change
game.openGate(result);   // after the gate panel: result = { correct: bool, quick: bool, fixed: bool }
                         // → the gate opens, boost fuel is added (correct: +40 % tank, quick: +60 %, fixed: +15 %),
                         //   cash is paid (gate: $120 × coinMult, quick +$80, fixed $40), the run continues
game.winch(ok);          // ok=true: the vehicle is righted and pulled 6 m up-trail (event 'winched'); false: nothing
game.pause(); game.resume(); game.stop(); game.destroy();
game.getState() → { phase: 'parked'|'ride'|'gate'|'stuck'|'done', distance, speedKmh, boost (0..1), airTime, flips,
                    smashed, cash, finishCrossed, gateIndex, gatesTotal, stuck: bool, upsideDown: bool }
```

Events: `launch` (first GAS), `gate` `{ index, x }` (the vehicle is parked at a gate; main.js opens the panel),
`gateOpen`, `air` `{ airTime }` on landing with air time, `land` `{ quality: 'perfect'|'good'|'hard'|'crash' }`,
`flip` `{ direction }`, `smash` `{ kind, cash }` (logs, rocks, cones, signs, snowmen, cacti, tumbleweeds...), `splash`
(water crossing), `stuck`, `winched`, `boost` `{ on }`, `coin` `{ cash }` (trail coins), `finishLine`,
`finish { summary }` with
`summary = { distance, durationSec, airTime, flips, smashed, coins, maxSpeedKmh, gates: { answered, correct, quick, fixed },
  winches, finishCrossed, cash: { distance, air, smash, gates, quick, coins, total }, rating: 'S'..'D', ratingScore }`.
The engine pays cash itself (so the summary's parts add up to the total) and multiplies by `stats.coinMult`.

Vehicle: chassis polygon + 2 wheels (Matter constraints as springs), rear-wheel drive with `stats.power`, brake /
reverse on BRAKE, in-air tilt (GAS = nose up, BRAKE = nose down), BOOST = thrust from the tank while it lasts
(`stats.boostPower`, `stats.boostCapacity`), grip from `stats.grip × trail.grip` (ice 0.6, sand 0.8, mud patches 0.5).
A hard landing / rollover with low suspension = "hard" (speed loss, shake), never a game over: the winch covers it.
Stuck detection: speed < 0.6 m/s for 2.5 s while GAS is held on a slope, or upside down for 1.5 s → `phase 'stuck'`
+ event `stuck` (main.js shows the Winch button). Gates: the engine builds a gate body at each gate x; when the
front wheel reaches x − 3 m the engine brakes the vehicle to a stop in front of the sign (≤ 1.5 s), sets
`phase 'gate'` and emits `gate`; `openGate()` removes the sign (it swings open) and resumes `phase 'ride'`.

Trails (`trail-blazer/src/data/trails.js`): `{ id, name, blurb, length (m), grip, theme { sky[2], far, mid, ground,
groundDark, accent, night?, planet? }, style ('forest'|'granite'|'lake'|'snow'|'desert'|'night'), terrain { amplitude,
wavelength, roughness, hills: n }, props: ['log','rock','cone','sign','snowman','cactus','tumbleweed','puddle',...],
water: n crossings, bridges: n, kickers: n, gates: n (default by length) }`. The engine draws parallax backdrops per
style (pines, granite domes, a lake with a reflection, snowy peaks, mesas, a night sky with fireflies + headlight
cones), terrain with ground texture, props with their own art, trail coins along the path, the gate signs, the
finish flag, the Ranger (`src/game/vehicle.js`: `drawVehicle(ctx, look, state)` shared with the garage preview;
paints + decals), dust / mud / snow / water particles, speed lines, a big "GATE!" / "PERFECT!" popup layer.

A `dev.html` (like `car-jump/dev.html`) that starts the engine with URL params (`trail`, `lvl`, `seed`, `sim`) and a
`tools/engine-smoke.mjs` (Playwright, Chromium at `/opt/pw-browsers/chromium`) that drives it headless: a hold-GAS
ride reaches the first gate and parks (`gate` event), `openGate({correct:true})` resumes, the ride reaches the finish
with upgrades, stuck + winch works, cash adds up, no console errors.

## 4. The math layer (`trail-blazer/src/facts/`, the facts/UI agent)

Facts are strings `"7x8"`, `"56/7"`, `"34+19"`, `"80-46"` (`parseFact`, `factAnswer`, `factText` → "7 × 8",
`factSpoken` → "seven times eight", `factFamily` → `x7` / `d7` / `add` / `sub`). The week's set comes from the
Parent Zone (families + custom lines); the stock set is **×2 … ×9 with ÷** (a sensible default for a 4th grader).
Commutative pairs are one fact (7×8 and 8×7 are both `"7x8"`; shown either way, at random).

Learning design (also written up in `trail-blazer/docs/LEARNING-DESIGN.md` with sources):

1. **Retrieval, not recognition**: the child types the answer on a numpad; no choices to pick from (Roediger &
   Karpicke 2006; Codding, Burns & Lukito 2011 meta-analysis: practice with retrieval beats drill-and-recognize).
2. **Spacing with Leitner boxes**: per fact `box 0..3`, intervals 0 / 1 / 2 / 4 days (same scheduler semantics as
   `car-jump/src/spelling/scheduler.js`: port it to `src/facts/scheduler.js`, keyed by the fact string; pure
   functions taking `now`). Mastered = box 3 + correct on 2 different days + 3 first-try retrievals.
3. **Fluency**: a correct answer in **≤ 3 s** from the fact appearing is *quick* (automaticity threshold, Hasselbring
   et al. 1988; Woodward 2006). `fluent` = mastered + quick on 2 different days. The child never sees a clock; the
   only trace of time is the ⚡ "Quick!" bonus.
4. **Incremental rehearsal** (Burns 2005; Nist & Joseph 2008): a *new* fact is rehearsed among *known* ones with an
   expanding gap: it comes back after 1, then 2, then 3 known facts in the same ride / session before it counts as
   learned. The session queue (`createSession`, `noteAnswered`, `pickNext`) implements this; at most 2 new facts
   are "in rehearsal" at once; the daily cap for new facts is the Parent option (default All).
5. **Cover-Copy-Compare for facts** (Skinner, McLaughlin & Logan 1997; Codding 2011): on a miss the panel shows the
   whole fact with its answer and a **strategy hint** (`src/facts/hints.js`: ×9 → "10 × 7 is 70, take away 7";
   ×5 → "half of 10 × 7"; ×4 → "double, then double again"; ×6 → "5 × 7 is 35, plus one more 7"; ×2 → "double";
   ×3 → "double, plus one more"; ×7, ×8 → the nearest known square or ×10 fact; division → "7 × ? = 56"; add → make
   ten; sub → count up), reads it aloud, then **covers** it after 2.5 s and the child types the answer from memory
   (Copy); a match opens the gate (no boost); the fact is re-queued for this ride (after 2 other facts, max twice)
   and goes to box 0 for tomorrow. Never a second wrong answer on screen: a wrong Copy clears in 1 s and the fact
   shows again.
6. **Interleaving** (Rohrer & Taylor 2007): once a family is past New, its facts mix with the other chosen families
   and operations in one ride rather than blocked by family.
7. **Immediate feedback** (Hattie & Timperley 2007): right / wrong is shown within the same second, with the correct
   fact, never a delayed score.
8. **Progress the child can see** (Fuchs & Fuchs 1986): the Fact Grid and the results' "facts mastered" line.
9. **Intrinsic integration** (Habgood & Ainsworth 2011): facts open gates and fill the boost tank.

Daily mission: 12 gate answers a day (`today`), paid $400 once; new facts per day cap; streak is not duplicated here
(Spell Jump owns the family streak board). XP / levels: a simple XP per answer (first try 15, quick +5, fixed 5,
mastered 50) with the same level thresholds as Spell Jump's `cosmetics.js` (copy the table), shown as "Lv n" on the
picker tile and a level-up stamp on results.

Facts store (`src/facts/store.js`, like `wordStore.js`): `{ v, sets: { families: ['x2',...], division: bool, addSub:
bool, custom: [facts] }, records: { fact: rec }, today: { date, count, newCount, missionPaid }, xp }`, with
`activeFacts(d)` (the current week's set, custom included), `nextFact(d, now, session, opts)`, `recordAnswer(d,
fact, { correct, quick, fixed }, now, session)` → `{ newlyMastered, newlyFluent, missionJustDone, status }`,
`report(d)`, `resetFacts(d)`. Pure, unit-tested in `tools/facts-tests.mjs` (Node, `node --test` style asserts like
`car-jump/tools/spelling-tests.mjs`): parsing (every operator form: `x`, `×`, `*`, `/`, `÷`, `+`, `-`, spaces or
not), answers, families, spoken forms ("fifty-six", "one hundred eight"), hints for every family, scheduler boxes
and intervals, incremental-rehearsal order, requeue rules, mastery / fluency, mission counting, report counts.

## 5. Gate panel (`src/ui/gatePanel.js`)

Over the ride (the Ranger parked at the sign behind it, same as the spell panel sits over the parked car):
the fact in big display type ("7 × 8"), read aloud as it appears ("seven times eight"; voice off → shown only);
a numpad 0-9 + ⌫ + GO (≥ 44 px keys, keyboard digits / Backspace / Enter), the typed answer in big tiles, a "Hear
it" button. States: `ask` → `right` (green flash, "56! ⚡ Quick!" or "56!", 0.9 s, then `openGate`) | `wrong`
(the fact + answer + hint shown, read aloud, 2.5 s, then `copy`: the answer hidden, type it; a match → `openGate
({ fixed: true })`). Winch mode: same panel with a "Winch" header; right → `winch(true)`, a miss goes through the
same show → copy and then winches. Timing for `quick` is measured from the moment the fact appears (voice or not).
The panel owns no data: main.js records each answer with the facts store and keeps the ride's fact list for results.

## 6. Economy (first pass, tune with `tools/economy-sim.mjs` later)

Cash: distance $2/m, air $30/s, smashes $20-120, gate $120 (+$80 quick, $40 fixed), coins $10, finish bonus $300,
all × coinMult (Boost upgrade also raises coinMult 1.0 → 1.5 at level 10). Upgrades cost
`300 × 1.45^level` (rounded to 10s), 4 upgrades × 10 levels ≈ $90k to max; finishing Night Ride wants ~level 6-7.
No cars to buy (one Ranger); paint and decals come from mastery, never cash.

## 7. Files

```
trail-blazer/
  index.html            app shell (all screens, CSS), loads ../spell-jump/vendor/matter.min.js and src/main.js
  manifest.webmanifest, sw.js, icons/ (make icons with a small canvas script like car-jump/tools/make-icons.mjs)
  dev.html              engine playground (engine agent)
  src/main.js           app: screens, run lifecycle, gate flow, records, sync + voice wiring (facts/UI agent)
  src/game/{engine,course,render,vehicle,util}.js      (engine agent)
  src/data/{trails,upgrades,paints}.js                   (engine agent owns trails.js; facts/UI agent owns the rest)
  src/facts/{facts,scheduler,hints,store,spoken}.js     (facts/UI agent)
  src/ui/{players,title,garage,trails,hud,gatePanel,numpad,results,grid,parentZone,panels,vehiclePreview}.js
  src/meta/{save,economy,selfUpdate}.js, src/sfx.js
  docs/LEARNING-DESIGN.md, README.md
  tools/{facts-tests.mjs, engine-smoke.mjs, ui-smoke.mjs, make-icons.mjs}
```

Root: `build.sh` copies `trail-blazer/` → `dist/trail-blazer/` (same excludes), `netlify.toml` gets the redirect +
sw.js / manifest headers for `/trail-blazer/`, `site/index.html` gets a second game card ("Game two · Trail Blazer ·
Grade 4 math facts") and the quick start mentions both games share the family code.

## 8. Definition of done (integration agent)

- `python3 -m http.server 8080` from the repo root: `/trail-blazer/` plays end to end on an 844×390 touch
  viewport and 390×844: pick player → RIDE → Pine Ridge → gate → type the answer → gate opens → … → finish →
  results → garage upgrade → Fact Grid shows the facts' status; Parent Zone PIN (shared), Facts this week, Report.
- `node trail-blazer/tools/facts-tests.mjs`, `node trail-blazer/tools/engine-smoke.mjs`,
  `node trail-blazer/tools/ui-smoke.mjs` pass; `bash build.sh` passes with the new required files; Spell Jump's
  suites still pass (`node car-jump/tools/spelling-tests.mjs`, `node car-jump/tools/ui-smoke.mjs`).
- No console errors; no external links; no native inputs outside the Parent Zone; keys ≥ 44 px.

## v1.1 — Race mode (Matt, Oct 17: "a bit boring, make it more like a motocross game")

The trail crawl becomes a **motocross race** in the same Ranger. Everything below replaces the v1 ride loop; the
screens, family, garage, paints and save stay.

1. **Tracks, not trails** (`data/trails.js` gains `kind: 'mx'` sections): each track is a rhythm of motocross
   features built for speed and air: start straight with a drop gate, **doubles** (gap jumps the stock vehicle just
   clears at full throttle), **tabletops**, **step-ups / step-downs**, **whoop sections** (6-10 small bumps), one
   **big jump** per track, a few flat sprints, **berms** drawn as banked turns (2D: a short speed-holding curve), and a
   finish line. No climbs that stall a stock vehicle: momentum is the game; a lost jump costs time, not the run.
   Lengths stay 600-2,200 m; themes stay (forest, granite, lake, snow, desert, night).
2. **Racing**: 3 **AI riders** (other Rangers in other paints, with names: Max, Zoe, Kai) on the same track, driven
   by the same physics with a scripted throttle/lean policy and a per-track skill (they clear the jumps they are
   tuned for, make small mistakes on landings). A **3-2-1 gate drop** start (GAS early = a bogged start). HUD shows
   **position (1st-4th)**, the **lap time**, and a thin track-progress bar with all four riders. The finish line
   gives a **podium** (results: position, time, medal: Gold / Silver / Bronze per track from target times, best time).
   AI speed scales with the player's upgrade total so a stock player can win Pine Ridge with clean riding and the
   later tracks want upgrades and good jumps.
3. **Stunts**: in the air, BRAKE = lean back (backflip), GAS = lean forward (front flip); a full rotation landed
   wheels-down scores **FLIP! +$150** (two in one jump ×2, combo chain), air ≥ 1.5 s = **BIG AIR**, a landing whose
   angle matches the downslope = **PERFECT** (+boost, +cash), nose-down or back-wheel-first over the limit =
   **CRASH**: the Ranger tumbles (driver flies off, helmet bounces), 1.5 s, then it respawns on its wheels at the last
   checkpoint (every ~100 m) with a short invulnerable push; a crash costs ~2 s against the AI, never the run.
   Boost refills from PERFECT landings, flips and coins (no winch, no stuck state in race mode).
4. **Speed feel**: top speed up (~95 km/h stock, 140 at level 10), engine pitch rises with speed, dust rooster
   tails on throttle, speed lines above 60 km/h, the camera leads further and zooms out with speed and in the air,
   a short slow-mo + zoom on a landed flip, screen shake on hard landings, a gate-drop sound and crowd/cowbell at
   the finish.
5. **Results**: position + podium, time + medal + best, cash rows (distance, air, flips, perfect landings, coins,
   position bonus: 1st $500, 2nd $300, 3rd $150; finish bonus), next track unlocks on **3rd or better**.
6. **Engine contract additions**: `start({ ..., race: { riders: 3, skill } })`, events `countdown {n}`, `go`,
   `checkpoint {index}`, `crash`, `respawn`, `flip {kind, count}`, `bigAir`, `position {place}`, `lap {timeSec}`;
   `getState()` adds `place`, `timeSec`, `riders: [{name, paint, x}]`; summary adds `place`, `timeSec`, `flips`,
   `crashes`, `cash.flips`, `cash.perfect`, `cash.place`. The gate mechanics stay dormant for the math phase.

## v1.2 — The math layer, in race mode (Matt, Oct 19: "Add the math layer now")

§4 and §5 apply as written (facts, scheduler, incremental rehearsal, fluency, cover-copy-compare with strategy hints,
interleaving, the Fact Grid, Parent Zone tabs, report, daily mission, XP, LEARNING-DESIGN.md), with these race
adaptations:

1. **Math Gates in a race.** The track keeps its motocross rhythm; `gates` (Parents → Options "Math gates per race":
   3 / 4 / 6, default 4) wooden gate signs stand on flat sections. Only the **player** stops at them (the AI riders
   are ghosts and pass through). When the player reaches a gate the engine parks the vehicle in front of the sign
   (≤ 1 s) and **freezes the whole race**: every rider, the clock, the particles (phase `gate`, event
   `gate {index, x}`), so time spent answering never counts. `openGate(result)` with `{ correct, quick, fixed }`:
   - **quick** (≤ 3 s): the gate drops, a big boost burst (+60 % tank and a 1.2 s push), "+$200 QUICK!", the race
     resumes for everyone at once;
   - **correct**: the gate drops, +40 % tank, "+$120", resumes for everyone;
   - **fixed** (after the cover-copy routine): the gate drops, no boost, the **rivals get a 1.5 s head start**
     (they run while the player is held at the line), "+$40".
   The engine also accepts `holdSec` in `result` to tune that head start. Gate cash goes in `cash.gates` /
   `cash.quick`; the summary keeps `gates: { answered, correct, quick, fixed }`.
2. **Winch mode is gone** (no stuck state in a race); the Gate panel has no winch header.
3. **Facts per race = gates per race** (default 4). The daily mission counts gate answers (12 a day → $400 once,
   +100 XP). Between races nothing is asked: every fact is asked at a gate, in the race.
4. **Results** add the facts list of the race (each fact with ✓ / ⚡ quick / ↻ fixed), "N facts mastered!",
   the mission state and the level-up stamp; the podium stays. Fast answers are what make the time: the medal
   targets (MEDAL_TIMES) are unchanged because the clock is frozen during a question, so a quick answer's boost is
   pure gain and a fixed answer's head start is pure loss.
5. **Voice**: the fact is read as it appears ("seven times eight") and, on a miss, the fact with its answer and
   the hint, through Spell Jump's tts (device voice; the natural Google voice when the family has a code and the
   player's Spell Jump voice option picked one). `tts.unlock()` inside the countdown tap / first GAS.
6. **Parent Zone**: Family code · Facts this week · Options (math gates per race, new facts per day, facts aloud;
   the voice is set in Spell Jump) · Report · Players. The stock set is ×2 … ×9 with ÷ (commutative pairs are one
   fact). Custom problems one per line (`7 x 8`, `56 / 7`, `34 + 19`, `80 - 46`), bad lines reported by number.
7. **Fact Grid** on the title ("Facts"): the 12 × 12 × grid and a ÷ view, cells colored by status, tap to hear.
8. **Home page**: the Trail Blazer card says "Grade 4 math facts" and the science section gets an "In Trail
   Blazer:" line per technique (retrieval = typed answers, spacing = facts return over days, self-correction =
   the fix-it routine with a strategy hint, no wrong answers shown, intrinsic = facts open the gates and win races)
   plus a sixth card, **Fluency**, for the ≤ 3 s quick answers (Hasselbring 1988 / Woodward 2006) and incremental
   rehearsal (Burns 2005). The Why page gets the math sources.

## v1.3 — Adaptive placement and difficulty (Matt, Oct 19: "adaptive, assess from what they get right and wrong,
## an assessment test at the end of the first race")

No engine changes. Everything lives in `src/facts/` + the gate panel + main.js + Parent Zone.

1. **Pit Crew Check (placement)**: offered on the results screen right after a player's **first finished race**
   (and from Parents → Facts → "Run the check again"): a big "Pit Crew Check" card, kid-framed ("Your crew needs to
   know what you've got. About 20 quick facts.") with Start / Later; "Later" offers it again after the next race (max
   3 times, then it only lives in the Parent Zone). The check runs in the gate panel's layout (fact, numpad, voice)
   without a gate, with a thin progress bar, no clock on screen; each item records correct + response time.
   **Adaptive staircase** over difficulty tiers, within the operations the parent allows (default × and ÷):
   T1 ×2 ×5 ×10 · T2 ×3 ×4 · T3 ×6 ×9 · T4 ×7 ×8 · T5 ×11 ×12 · T6 ÷ of T1-T2 families · T7 ÷ of T3-T5 (÷ tiers
   come after ×; + / − within 20 as T0 only when the parent enabled it). Start at T2: 3 items from the tier (distinct
   families, random operands 3..9 first); **advance** when ≥ 2 of 3 are correct and quick (≤ 3 s), **probe** (3 more
   items in that tier, then stop climbing) when 2 of 3 are correct but slow, **drop** one tier when ≤ 1 of 3 correct
   (and probe it). Stop after the top tier passes, after two drops, or at 24 items. Result = per family a
   placement `{ acc, medianMs }` → status **fluent** (≥ 2/2 quick) / **known** (correct, slow) / **shaky** (a miss)
   / **untested** (above the frontier). Facts answered in the check seed their records: a quick correct = box 2 and a
   first-try, a slow correct = box 1, a miss = box 0 + focus. Ends with the **Start line** screen: "Fluent: ×2 ×5
   ×10 · Working on: ×3 ×4 · Up next: ×6 ×9 …" and "+100 XP".
2. **Auto mode (default)**: `sets.mode = 'auto' | 'manual'`. In auto the active set = the **frontier**: the two
   weakest families that are not above an untested gap (so a kid never gets ×8 before ×3 is known), plus every
   *known/fluent* family for interleaving and rehearsal (gates: ~60 % frontier, 30 % known for spacing/retention,
   10 % mastered probes), plus the ÷ twin of any family once it is known. A family **advances** when ≥ 90 % of its
   facts are mastered and ≥ 70 % fluent (the next tier's families enter the frontier); a family **re-enters** the
   frontier when two of its facts drop to box 0 in a week. Manual mode = v1.2 behaviour (toggles / custom list); the
   Parent Zone shows "Auto (recommended)" / "Pick families" / "Custom list" and, in auto, the current frontier and a
   one-line reason ("×7 and ×8: 5 misses this week").
3. **Re-checks**: every 15 finished races (or 7 days, whichever first) the next race's gates include a 6-item
   **retention probe** from mastered families, mixed into the normal gates (no separate screen); a miss there pulls
   that family back in. The Pit Crew Check itself can be re-run from the Parent Zone.
4. **Error patterns** (`src/facts/patterns.js`): classify each miss: `adjacent` (answer is the neighbouring row /
   column, 7×8 → 49 or 64), `reversed` (digits reversed, 56 → 65), `off-by-operand` (±one operand, 7×8 → 48 or 63),
   `inverse` (division missed while its × twin is known), `big-operands` (both operands ≥ 6), `operation` (÷ vs ×
   gap, + vs −), `slow-only` (correct but never quick), `random`. Patterns feed (a) the **hint** on the next miss
   (adjacent → "7 × 7 is 49, then one more 7"; reversed → read the digits; inverse → "7 × ? = 56"), (b) the
   frontier (an `inverse` cluster brings ÷ twins into the next gates right after their × fact: ask 7×8 then 56÷7
   two gates later), (c) the Report: a "Patterns" section in plain words ("Misses cluster in ×7 and ×8", "Division
   is weaker than multiplication", "Slow on big numbers: 6 × 7, 8 × 9") and the Start line.
5. **Data**: `facts` store gains `placement: { at, tiers: [...], families: { x7: {acc, medianMs, status} } ,
   checks: n }`, `sets.mode`, `frontier: { families, since, reason }`, per-record `times: [ms...] (last 5)`,
   `patterns: [{ kind, at }] (last 10)`, `races` counter and `lastProbeAt`. Normalize old data (no placement →
   the check is offered after the next finished race; mode 'auto' when sets were never edited, else 'manual').
6. **Tests** (`tools/facts-tests.mjs`): the staircase (a fluent kid climbs to ÷ in ≤ 24 items; a kid who misses at
   T2 drops to T1 and stops), placement → records seeding, frontier selection and advancement/re-entry rules, gate
   mix proportions over 100 picks, retention probe cadence, every pattern classifier with examples, hints from
   patterns, normalize of old data. `tools/ui-smoke.mjs`: the check offered after the first finished race, Later →
   offered again, Start → ≥ 9 items → the Start line screen → XP; auto mode shows the frontier in Parents → Facts;
   switching to Pick families and back; the Report's Patterns section; a retention probe at race 15 (mock).
7. **Docs**: LEARNING-DESIGN.md gains Placement / adaptive sequencing (Vygotsky's ZPD via mastery-based progression;
   Fuchs & Fuchs progress monitoring; the Codding 2011 finding that interventions matched to the learner's phase
   (acquisition vs fluency) work best) and error-pattern analysis (Ashlock, error pattern analysis in arithmetic);
   README and the site's Fluency card get one sentence each.

## v1.4 — Find where they are, fast (Matt, Oct 19: "the math game needs to more aggressively see where the kids
## are currently")

No engine changes. The v1.3 pieces stay; these change *when* the game looks, *how wide* it looks, and *how fast* it
believes what it sees. A child who knows a family cold should be past it within a race or two, not after three days.

1. **The check comes first.** A player with no placement gets the Pit Crew Check when they tap **RACE** (before the
   first race), not on the results afterwards: a card "Before your first race, the pit crew checks what you've got.
   About 15 quick facts." with **Start** (primary) and a small **Race first**. "Race first" runs the race and the card
   comes back before the next race, every time, until the check is done (no cap, never nagging mid-race, never a lock).
   The results-screen offer goes away. Players placed under v1.3 keep their placement.
2. **A staircase that locates, then zooms.** Start at **T3** (×6 ×9), the middle of the Grade 4 ladder.
   *Locate*: 2 items per tier, one per family (operands 3..9 first); both right and quick → up a tier; any miss → down
   a tier; right but slow → stay and go to zoom. Bounded by the ladder ends; ≤ 10 items. *Zoom*: in the located tier
   and the tier above it, 2 more items per family (never a fact already asked), so every family there has ≥ 2–3
   answers and the result tells families apart (×6 fluent, ×9 shaky). *Twins*: for each family found fluent, one ÷
   item when ÷ is on (is division ready?). Cap 24 items in all; tiers below a passed tier are vouched for as in v1.3.
   No score, no wrong count on screen; the Start line as in v1.3, plus "Your crew will keep checking as you race."
3. **Advance on evidence, not on the calendar.** New family status **secure**: every fact in the family answered
   right at least once (a first-sight answer counts), ≥ 75 % of its answers quick, and no miss in its last 8
   answers. A secure family leaves the frontier at once (it moves to the known bucket, where spacing keeps revisiting
   it over days; mastery over days still governs the Grid's colours and the retention probes). The v1.3 rule (≥ 90 %
   mastered and ≥ 70 % fluent) stays as the other path. Families the check found fluent are secure from the start.
4. **Scout gates (placement that never stops).** In every race with ≥ 4 gates, one gate is a **scout**: a never-asked
   fact from the lowest untested or non-secure family *above* the frontier on the ladder (the next tier first). Three
   quick-right scouts in a family with no scout miss → the family is **vouched** (secure without ever being in the
   frontier; its ÷ twin joins the gates); a scout miss costs nothing beyond the normal fix-it and the family simply
   waits its turn. With 4 gates: 2 frontier, 1 known, 1 scout; the mastered probe (10 %) only when nothing is left to
   scout. Scouts count as first-sight answers in the records. A child who is ahead climbs a tier every few races.
5. **Re-checks on their own.** The Pit Crew Check offers itself again (the same card before a race, Start / Race
   first) after **14 days**, or sooner when the placement is stale: 5 finished races in a row with no misses, or the
   frontier two tiers above the placed tier ("Pit Crew re-check: let's see how far you've come"). Still available from
   Parents → Facts.
6. **Parent Zone and Start line.** Facts tab: a "Where Mia is" line ("Tier 4 · ×7 ×8 · placed Oct 19 · re-check in
   10 days" and the families vouched by scouts), the ladder with the new states (secure, vouched), **Check now**.
   Report: "Moved up" lines ("×6 ×9 → ×7 ×8 on Oct 21: 3 quick scouts"). Start line: "Up next" names the scout
   family.
7. **Data.** `placement` gains `tier` (the located tier) and `phase` counts; per family `scout: { asked, quick, miss }`;
   `frontier.history: [{ at, families, why }]` (last 10); `lastCheckOfferAt`. Normalize v1.3 data (no scouts, no
   history). Version 1.4.0, sw.js `trail-blazer-v1.4.0`.
8. **Tests.** `tools/facts-tests.mjs`: the staircase from T3 (a fluent kid reaches T5 and ÷ twins in ≤ 24; a kid who
   misses at T3 lands in T2 with every T2/T3 family having ≥ 2 answers; slow-but-right stays and zooms), the secure
   rule (an all-quick family advances in one sitting, one miss in the last 8 blocks it), scout selection (next tier
   first, never a seen fact), vouching after 3 quick scouts and not after a miss, re-check triggers (14 days, 5 clean
   races, two tiers above), normalize of v1.3 data. `tools/ui-smoke.mjs`: a new player tapping RACE gets the check
   first; "Race first" → the race runs and the card returns before the next race; Start → ≥ 9 items → Start line;
   with the mock engine a kid who answers everything quick has a vouched family within 3 races and the frontier
   moves; Parents → Facts shows "Where Mia is" and Check now; the Report's "Moved up" line.
9. **Docs.** LEARNING-DESIGN.md: continuous assessment / scouting (curriculum-based measurement and progress
   monitoring, Fuchs & Fuchs 1986; Deno 1985, curriculum-based measurement), evidence-based advancement vs calendar
   mastery; README; site Fluency card one phrase ("keeps checking as they race").
10. **Medals follow the place** (Matt, Oct 19: "you can get first but still only get silver"). `data/medals.js`
    `raceMedal(place, timeSec, times)`: 1st is gold, 2nd silver, 3rd bronze, and the target time can only improve it
    (a 2nd under the gold time is gold). Used by `economy.js` (the saved medal, the callout) and the engine's rating.
    Results subtitle: "1st = gold · or beat 0:30.0". Done in the tree already (medals.js, economy.js, engine.js,
    facts-tests); the subtitle wording and the README line remain.
11. **The difficulty governor** (Matt, Oct 19: "keep the math hardness in the level where the student is still
    learning all the time"). The gates must sit at the child's **instructional level**: mostly right, never all right,
    never a wall. Over the child's last **12 gate answers** (rolling, across races; scouts and probes included):
    - **≥ 92 % right and ≥ 70 % quick → too easy**: every family in the frontier is re-tested for *secure* at once
      and the secure ones leave; the scout tier climbs (2 scouts in the next race); the gate mix becomes 50 %
      frontier / 25 % known / 25 % scout. The frontier never stays on a family the child has beaten.
    - **70–92 % right → on target**: v1.4 as above (60 / 30 / 10 with one scout).
    - **< 70 % right → too hard**: the frontier narrows to **one** family (the weaker of the two); the mix becomes
      50 % frontier / 50 % known (confidence, spacing), **no scouts**; a family with ≥ 3 misses in its last 6 answers
      **steps back**: its lower neighbour on the ladder re-enters the frontier in its place and it waits (so a kid
      drowning in ×8 goes back to ×4 ×6 for a while, then ×8 returns when those are secure again).
    The governor re-evaluates after every gate, so the level moves within a race, not after it. Cold start (fewer
    than 6 answers): on target. The Start line and Parents → Facts show the dial in plain words: "Right now: on
    target (10 of 12 right)" / "a bit easy: moving up" / "a bit hard: stepping back"; the Report keeps a per-race
    history of the dial. Tests: the three bands from synthetic answer streams (all right + quick → secure + 2
    scouts; 5 of 12 → one family, no scouts, the lower neighbour re-enters; the band boundaries), and that no
    stream can leave the frontier empty.

## v1.5 — The Season (Matt, Oct 20: "super fun addictive elements and a longer runway for more play: car upgrades
## and tracks etc")

Two agents in parallel: the **engine agent** owns `src/game/*`, `src/data/trails.js`, `src/data/vehicles.js` (new),
`src/data/mutators.js` (new), `tools/engine-smoke.mjs`, `dev.html`; the **app agent** owns everything else (`src/ui/*`,
`src/meta/*`, `src/data/cups.js`, `src/data/cosmetics.js`, `src/data/rivals.js`, `src/main.js`, `index.html`, `sw.js`,
`tools/ui-smoke.mjs`, `tools/economy-sim.mjs` (new), docs, site card). Neither touches `car-jump/`. The math layer
(`src/facts/*`, gate panel, governor) is unchanged except where noted. Kid rules stand: no lives, no energy, no timers on
screen, no pressure text, nothing that punishes stopping; the loops below reward coming back, never leaving.

### 1. Vehicles (engine: physics + art; app: garage, buying, per-vehicle upgrades)
`src/data/vehicles.js` exports `VEHICLES` (ladder order) and `VEHICLE_BY_ID`; each `{ id, name, tier (1-8), price,
blurb, feel (one line for the card), hull (polygon, m), wheels [{ x, y, r }], seat, exhaust, mass, base: { power,
topSpeed, grip, suspension, boostPower, boostCapacity, weight }, special, look: { paint, trim } }`. The engine takes
`start({ vehicle: id, ... })` and builds the body from that definition (the Ranger is `VEHICLES[0]`, unchanged in
feel). `drawVehicle(ctx, look, state)` draws by `look.vehicle`. Lineup (names are ours, not brands):
| # | id | name | price | feel | special |
|---|----|------|-------|------|---------|
| 1 | ranger150 | Ranger 150 | $0 | the trusty one | — |
| 2 | quad | Dune Quad | $9,000 | light and flippy | +25 % flip rate, air control |
| 3 | dirtbike | Dirt Bike 85 | $25,000 | two wheels, huge air | longest air, wheelies on gas, falls easier |
| 4 | buggy | Rock Bawler | $70,000 | long-travel suspension | lands anything; hard landings never crash |
| 5 | mudtruck | Mud Monster | $180,000 | giant wheels | drives over logs, rocks and cones without slowing (smash cash still paid) |
| 6 | turbo | Turbo RZR-X | $450,000 | fast and loud | boost tank refills 2× faster from gates |
| 7 | rail | Thunder Rail | $1,100,000 | a rocket on wheels | top speed ×1.5; whoops bounce it hard |
| 8 | rover | Moon Rover | $3,000,000 | ultra low grip, big bounce | gravity 0.6 on every trail, coins ×2 |
Base stats climb ~12 % a tier (power, topSpeed, grip, suspension) so a new vehicle feels like a jump; the four
upgrades (`upgrades.js`) are **per vehicle** (`save.vehicles[id].levels`), costs `COST_BASE × 1.45^level × tierMul`
(tierMul 1, 1.6, 2.5, 4, 7, 12, 20, 35). Garage: a **Vehicles** row (cards: name, feel, price or Owned / Selected,
locked ones show the price and "Earn $X more"; tap a card to select), the upgrade list for the selected vehicle, then
Paint / Decal / Rider rows. The title hero draws the selected vehicle. The AI rivals drive the same lineup (a rival's
vehicle = the player's tier ± 1, never above tier 8) so a better vehicle is visible on the start grid.

### 2. Worlds: 18 trails in 3 cups (engine: terrain styles, props, art; app: cup screens, unlocks)
`trails.js` grows to 18 with `cup: 'rookie' | 'pro' | 'legend'`, `style`, `gravity?`, `grip?`, and new render styles
with their own sky, ground, far / mid layers, props and particles:
- **Rookie Cup** (as now): Pine Ridge, Granite Gap, Lake Loop, Snow Pass, Desert Wash, Night Ride.
- **Pro Cup**: Jungle Rumble (vines, mud, parrots), Canyon Run (red rock, long doubles), Beach Blast (sand, surf,
  crabs), Volcano Vent (ash, lava glow, rolling boulders), Swamp Stomp (soft ground, logs, frogs), Glacier Gorge (ice
  grip 0.7, snow ramps).
- **Legend Cup**: Neon City (night, rooftops, billboards), Dino Dunes (bones, eggs, a T-rex in the far layer), Sky
  Bridge (clouds, gaps, wind), Haunted Hollow (fog, pumpkins, bats), Moon Base (gravity 0.4, craters, Earth in the sky),
  Rainbow Ridge (everything at once, finale).
Lengths 600 → 4,000 m; MEDAL_TIMES for all; obstacle kinds per world. Unlock: 3rd or better on the previous trail
(as now) inside a cup; the **next cup** opens with the cup trophy (below) *or* 12 stars (§5). `trailGates` keeps ~1 per
140 m, capped by the parent's setting.

### 3. Cups and championship weekends (app; engine reports nothing new)
`src/data/cups.js`: the 3 cups, their trails, trophy, points `[10, 6, 3, 1]` by place. **Championship weekend**: from
the cup screen, "Race the cup": 3 races in a row on the cup's unlocked trails (the player's pick order), standings
between races ("You 16 · Blaze 13 · Dusty 9 · Nitro 4"), a podium at the end with the cup trophy on first (saved
`save.cups[id] = { best: points, trophy: 'gold' | 'silver' | 'bronze', weekends }`), cash bonus $2k / $1k / $500 ×
cup multiplier. Each cup pays more: cash multiplier ×1 / ×3 / ×8 on every race in it (the engine's `coinMult` input
× the cup multiplier; the results show "Pro Cup ×3" on the total row).

### 4. Crates, collections, rider gear (app)
Reuse Spell Jump's crate logic (`car-jump/src/meta/engagement.js`: `rollCrate` / `openCrate` with a pity counter)
by import, with Trail Blazer's own tables in `src/data/cosmetics.js`: **helmets** (12: Classic, Stripe, Flames, Skull,
Dino, Astronaut, Shark, Rainbow, Chrome, Galaxy, Lightning, Crown), **suits** (8), **horns** (6, a short sfx each),
**boost trails** (8: the particle colour behind the vehicle), **flags** (6, on a whip antenna), plus the existing
paints and decals as drops. A crate comes from: finishing on the podium with ≥ 3 gates right (bronze crate), every
gate quick that race (silver crate), a cup trophy or a star set (gold crate), every XP level (bronze), streak days
(§6). Crate tiers change the drop table (gold: a legendary at ≥ 20 %); cash fallback when nothing new. Open with a
tap: a shake, a burst, the item, "NEW!" or "+$". The **Garage Wall** screen: every item in sets with "7 / 12", a set
bonus (complete a set → a unique paint). The rider is drawn with helmet + suit (engine `drawRider` takes the look),
the flag on the roll cage, the boost trail colour from the look.

### 5. Stars, rivals, ghosts (engine: ghost replay + rival names on riders; app: stars, rivals' story)
**Stars**: 3 per trail, shown on its card: ★ finish 1st, ★ every gate right, ★ a trail-specific stunt ("2 flips",
"5 s of air", "no crashes", "beat the gold time"). 54 in all; 12 open the Pro Cup, 30 the Legend Cup; star sets
(all 3 on a trail) give a gold crate. **Rivals** (`src/data/rivals.js`): Dusty, Blaze, Nitro, Zed, Ace, Vex, Storm,
Nova, each with a paint, a helmet, a one-line taunt and a one-line cheer (HUD banner at the start and the finish, kid
tone, never mean: "Blaze: Catch me if you can!" / "Blaze: Nice flips!"). The three on the grid are the current
**rival trio**; beating the trio's leader 3 times retires them to the Hall of Rivals and brings the next one in, one
tier faster (`race.skill` steps up). **Ghost**: the engine takes `start({ ghost: [[t, x, angle] …] })` (the player's
best run on that trail, sampled every 0.1 s, kept in `save.ghosts[trailId]` ≤ 1,500 samples) and draws it as a
translucent copy of the vehicle; the HUD shows "vs your best" and the results "Beat your ghost by 1.3 s!". The engine's
summary gains `ghostTrace` (the sampled run) and `beatGhost: boolean | null`.

### 6. Daily loops (app)
- **Streak**: Spell Jump's streak with the weekly shield (`engagement.js` by import; `save.streak`): a day counts on
  the first finished race; the title shows the flame and days; rewards at 3 / 7 / 14 / 30 days (crates, then a
  Streak paint and the Lightning helmet).
- **Pit Challenge of the day** (`src/data/mutators.js`, engine-owned effects): one trail + one mutator a day
  (seeded by the date): *Moon Boots* (gravity 0.5), *Mega Boost* (tank ×3), *Fog* (near-layer fog, horizon hidden),
  *Giant Wheels* (wheel r ×1.6, crush everything), *Tailwind* (+20 % top speed), *Mirror* (the trail reversed),
  *Rubber* (bounce ×2). Double cash and a bronze crate; the card on the title "Today: Fog on Lake Loop · ×2 cash".
- **Turbo Gate**: the race's last gate is marked; a quick answer there fires a rocket boost to the finish (engine:
  `openGate({ turbo: true })` → 3 s full boost, the HUD "TURBO!"). Math is still the engine of the fun.
- **Combo meter** (engine): flips, big airs and perfect landings within 3 s chain into a combo ×2 … ×5 on their cash
  (`summary.cash.combo`, `combo` event with the count); the HUD shows "COMBO ×3".

### 7. Economy (app: `tools/economy-sim.mjs`, like Spell Jump's)
Simulate a decent 4th grader (3rd-or-better by the 3rd attempt on a trail, 70 % gates right, half quick, 12 min of
play = ~6 races) and print the runs / hours to each vehicle, each cup, each star count, and the crate flow. Targets:
Dune Quad in ~1 h, Pro Cup open by ~3 h, Mud Monster ~8 h, Legend Cup ~12 h, Thunder Rail ~25 h, Moon Rover ~50 h;
a crate every 2-3 races early, every race once quick answers are common; never a stretch of 10 races with nothing
new (a vehicle, an upgrade, a crate item, a star, a trail). Tune cup multipliers, prices and `tierMul` until it
holds, and write the table into README.

### 8. Screens and flow (app)
Title: hero vehicle, the daily Pit Challenge card, streak flame, cup progress ("Rookie Cup: 4 / 6 · 9 ★"). Tracks
screen becomes **Cups**: three tabs, trail cards with stars and medals, "Race the cup" per cup. Garage: vehicles,
upgrades, Paint / Decal / Rider rows, Garage Wall button. Results: combo and ghost lines, the crate (opens on the
results with its own moment), stars earned with a chime each, cup standings during a weekend, rival line. Parent
Zone unchanged except a **Report** line "Play: 6 races · 2 stars · 1 crate · streak 4 days" per day.

### 9. Data and tests
`save.v` 3: `vehicles: { [id]: { owned, levels } }`, `vehicle: id`, `cups`, `stars: { [trailId]: [bool×3] }`,
`crates`, `cosmetics` (owned + equipped: helmet, suit, horn, trail, flag), `streak`, `rivals: { retired: [], tier }`,
`ghosts`, `daily: { day, trailId, mutator, done }`; migrate v2 saves (Ranger owned with the old levels, everything
else empty). Engine-smoke: every vehicle finishes Pine Ridge with the AI; every trail finishes with a tier-matched
vehicle at upgrade 5; the ghost draws; each mutator runs; the turbo gate boosts; combos count; perf stays ≤ 12 ms.
UI-smoke: buy a vehicle, upgrades per vehicle, a crate opens on the results, Garage Wall counts, stars appear, a
championship weekend to the podium, the daily challenge card, the streak flame, migration of a v2 save. Facts-tests
unchanged + the economy-sim prints its table. Version 1.5.0, sw.js `trail-blazer-v1.5.0`. Docs: README (the runway
table), LEARNING-DESIGN (one row: rewards never gate the math, the math gates the rewards; the daily loop is a
habit cue, not a punishment), the site card ("18 worlds, 8 vehicles, cups").

## v1.6 — The sync engine (Matt, Oct 20: "we need to add the sync engine")

Trail Blazer's progress (the save and the math facts) syncs across a family's devices with the same family code
Spell Jump uses, through the same Netlify Function and Blobs store. The shared sync code lives in
`car-jump/src/sync/` (protocol, client, notify, merge); this version may change it, with every Spell Jump suite
kept green (spelling-tests, ui-smoke, sync-smoke) and no change to what Spell Jump's data does.

1. **Protocol** (`car-jump/src/sync/protocol.mjs`): keys are `family`, `<id>.save`, `<id>.words`, and now
   `<id>.tb` (the Trail Blazer save) and `<id>.facts` (the math facts). `parseKey` accepts the four kinds; the GET
   answer lists `players[id] = { save, words, tb, facts }` (null when a doc is missing). Old clients ignore the new
   fields. `MAX_BODY` stays 512 KB. The Netlify function (`netlify/functions/family.mjs`) only gets its comment updated.
2. **Client** (`car-jump/src/sync/client.js`): key kinds become a registry: `{ kind: { storageKey(id), merge(key,
   local, remote), canon? } }` with `save` and `words` registered by Spell Jump's modules as today, and
   `registerSyncKind(kind, def)` exported so Trail Blazer registers `tb` and `facts` from
   `trail-blazer/src/meta/sync.js` before it creates the client. `syncKeyFor(storageKey)` maps
   `trailBlazer.<id>.save` → `<id>.tb` and `trailBlazer.<id>.facts` → `<id>.facts` (via the registry's
   `storageKey` in reverse). `load()` keeps the metadata of any well-formed `<id>.<kind>` key even when the kind
   is not registered in this app (Spell Jump must not drop Trail Blazer's revs when it persists `spellJump.sync`), and
   push / pull act only on registered kinds. Everything else (push on write, 409 merge + retry, pull on show /
   visible / online / 60 s, removed players) applies to the new kinds unchanged.
3. **Notify**: `trail-blazer/src/meta/save.js` `writeSave` and `writeFactsData` call `localWrite(key)` from
   `../../spell-jump/src/sync/notify.js` after a successful write; `removeSave` / `removeFactsData` nothing (removed
   players are tombstoned in the family doc, as today).
4. **Merge rules** (`trail-blazer/src/meta/sync.js`, pure, tested): take the later doc as the base, then
   - **tb save**: cash max; vehicles: owned = union, levels = per-upgrade max; vehicle / paint / decal / cosmetics
     equipped = the later doc; cosmetics owned = union; best / records = max; finished = max; bestPlace = min;
     bestTime = min; medals = best rank; stars = per-trail OR; cups = best trophy, max points, max weekends; crates
     earned / opened / sinceCosmetic = max; streak = Spell Jump's rule (`mergeEngagement`); rivals = max tier, retired
     union; ghosts = the faster trace per trail; daily = the later doc; seen = OR; `resetAt` as in Spell Jump
     (a reset on one device wins).
   - **facts**: records merged per fact: base = the record with the later `lastSeen`; attempts / firstTry / quick /
     misses / fixed / seenCount / totalMs / answeredMs = max; box = the base's unless the other's `lastSeen` is within
     the same day and higher; daysSeen / daysCorrect / daysQuick = union, sorted, **capped at the last 12**; times
     = the base's; patterns = union by `at`, newest 6; recent = union by `at`, newest 8; missDay = the later.
     Store-level: xp max; placement = the later `at`; scouts = per-family max; vouched / stepped = union (earliest
     `at`); gateLog / dialHistory = union by `at`, capped (12 / 20); today = same day → max counts, else the later;
     sets = the doc with the later `sets.updatedAt` (add that stamp when sets change); frontier recomputed after a
     merge (`refreshFrontier`); `pulled` union. `FACTS_VERSION` 4 with those caps applied on normalize (old data
     trims on load).
5. **Size**: a mature store (222 facts, 30 days of play) must serialize under **150 KB**: the day lists capped at 12
   (mastery and fluency only need 2–3 days; keep `lastSeen`), patterns 6, recent 8, and default-valued record fields
   (`rehearsed: false`, `focus: false`, `missDay: ''`, empty arrays, zeros) dropped on write and restored on
   normalize. Measure with a script and print the KB in the tests.
6. **App**: `main.js` registers the kinds, creates the client as now, and on `onApply('<id>.tb' | '<id>.facts')` for
   the current player reloads the save / facts in memory (never during a race: `canApply` stays `!run` for those
   keys too) and refreshes the title, garage and grid. Parents → Family: the status line says "Synced · players, Spell
   Jump and Trail Blazer progress" when a code is set; the Family-code tab's blurb mentions both games. A device that
   joins a family with existing Trail Blazer data merges it (never loses purchases or facts).
7. **Tests**: `car-jump/tools/spelling-tests.mjs` protocol cases for the new keys and the GET shape; the client's
   registry (unknown kinds kept in `load()`, not pushed). `trail-blazer/tools/facts-tests.mjs`: merge rules for the
   tb save and the facts (purchases on two devices, a race on each, a facts record answered on both days, a reset,
   caps, the size check). `trail-blazer/tools/sync-smoke.mjs` modelled on `car-jump/tools/sync-smoke.mjs`: two
   browser contexts, one in-memory server through the real protocol: laptop buys the Dune Quad and answers gates →
   the iPad shows the quad and the facts; iPad races offline → cash waits, then syncs; both answer facts offline → no
   record lost after the 409 merge; Spell Jump on the same server still syncs its own keys. Both Spell Jump sync
   suites stay green. Version 1.6.0, sw.js `trail-blazer-v1.6.0`; Spell Jump 3.6.3 (client change), sw.js
   `spell-jump-v3.6.3`. README (both) one paragraph; the site's quick-start mentions that one code syncs both games.

## v1.6.1 — No endless "Race first" (Matt, Oct 20: "make it so that the kid can't just keep skipping the pit challenge")
"Race first" (on the card and as the way out of a running check) works **twice per check** (`scouts.js CHECK_SKIPS`,
counted in `facts.checkSkips`); after that the card shows only **Start** ("The crew needs this one before you race.
About 15 quick facts, then the track is yours!") and the way out of the check reads "Later" and leads to the title,
never to a race. A finished check (`applyCheck`) resets the budget, so a re-check gets two skips again. Never a lock:
the child can always leave to the title; they just cannot race past the check a third time.

## v1.7 — Hill Climb, harder facts, two more cups (Matt, Oct 30: "ran out of races, it's still kinda easy for them;
## add a bonus round with a hill climb, they love the mysterious huge hill at the end of the race; make it more fun
## while also enhancing learning")
Three streams: the **engine agent** owns `src/game/*`, `dev.html`, `tools/engine-smoke.mjs`; the **facts agent** owns
`src/facts/*`, `tools/facts-tests.mjs`; the **app** (orchestrator) owns everything else (`src/data/*` incl. trails.js
and cups.js, `src/ui/*`, `src/meta/*`, `src/main.js`, `index.html`, `sw.js`, `tools/ui-smoke.mjs`,
`tools/economy-sim.mjs`, `tools/sync-smoke.mjs`, docs, the site). Kid rules stand (no lives, energy, timers, pressure
text; nothing punishes stopping). Never touch `car-jump/`.

### 1. Hill Climb (engine): the wall past the finish becomes a mountain
The course already ends in a steep wall 90 m past the finish (course.js: y += 0.06 (x − finish − 90)²). After a
finished race the app may call `game.startHill(cfg)` on the same ride (the vehicle, look, trail style and camera carry
over; no reload): `cfg = { flags: 5, questions: 10, seed, cupMult }`.
- The **mountain**: a profile from the finish straight: a gentle run-in, then 5 steepening sections, one per **flag**
  (a pole with a pennant and a cash tag drawn on the ground at each flag line; no numbers that read as a score), the
  snow line after flag 3, the **summit** after flag 5 (a plateau with a trophy cairn and a flag; clouds below it).
  Total climb ≈ 5 × 60 m of slope; the slope angle rises 18° → 38°. Style: the trail's render style (sky, layers,
  props thin out with height; wind streaks near the top). Camera: follows the vehicle up; the HUD banner "HILL CLIMB!"
  for 1.5 s, then "the hill is yours" is NOT shown (no pressure text).
- **Physics**: the vehicle keeps its physics; there is **no gas**: it climbs only on bursts. `hillBoost({ power
  (0..1), quick })` fires a burst: a full-power quick burst carries the vehicle ≈ one flag section (tuned per vehicle
  so every vehicle can summit on 5 quick right answers; a slow right answer = 0.7 of a section; power 0 = a sputter,
  no climb); rocket flames, exhaust rings, a wheelie on launch. When the burst ends and the speed drops below 1 m/s
  the engine **holds** the vehicle (brake, no slide) and emits `hillHold { heightM, flag }`; the app asks the next
  question. On `power: 0` the vehicle **slides back** to the last flag line (dust, a wobble; never below the base)
  then holds again. A crash is impossible (the vehicle is kept upright on the hill).
- **Flags and the summit**: crossing a flag line emits `hillFlag { n (1..5), heightM, cash }` (a chime, confetti
  from the pole; cash = 150 × n × cupMult); reaching the summit emits `hillSummit { heightM, cash }` (fireworks, the
  vehicle parks by the cairn, "SUMMIT!" banner; cash 1000 × cupMult) and ends the climb.
- **End**: the climb ends on the summit, or after `questions` answers when the next hold comes, or on `endHill()`;
  the engine emits `hillEnd { heightM, flags, summit (bool), answers, cash: { flags, summit, total }, bestHeightM }`
  and freezes the scene (the results open over it). `getState().hill = { active, heightM, flag, flags, progress
  (0..1 of the summit), holding, burst (s left), answers }`. Summary of the race is unchanged (the hill is separate).
- dev.html: `hill=1` starts a race with 0 gates and a Hill Climb after the finish; keys 1 / 2 / 0 = quick / slow /
  wrong answer. engine-smoke: a climb to the summit on 5 quick answers with every vehicle tier (1, 4, 8); a slow
  answer climbs less; a wrong answer slides back to the last flag; 10 answers without the summit end with hillEnd;
  flag cash × cupMult adds up; perf ≤ 12 ms; screenshots of the base, a flag, the summit.

### 2. Harder facts (facts agent): three tiers above ÷12
The ladder ends at T7 (÷ 6 … ÷ 12): a kid secure everywhere has an empty frontier and only meets review facts ("still
kinda easy"). New families (4th grade CCSS 4.NBT.5–6; whole numbers, answers ≤ 9,999, exact division):
| Tier | Families | Facts | Hint pattern |
|---|---|---|---|
| T8 | `x10s` (tens × ones: 20 … 90 × 3, 4, 6, 7, 8), `d10s` (their ÷ twins: 60 ÷ 3, 60 ÷ 20) | 35 + 70 | "2 × 3 = 6, so 20 × 3 = 60" (the ×10 pattern) |
| T9 | `xteen` (12 … 19 × 3, 4, 6, 7, 8) | 40 | "14 × 6 = 10 × 6 + 4 × 6 = 60 + 24" (split the tens) |
| T10 | `xbig` (21 … 49 × 3, 4, 6, 7, 8, 9; the 24 facts in the list the agent fixes), `dbig` (two-digit quotients: (11 … 19) × d ÷ d, d 3 … 9) | 24 + 63 | "23 × 4 = 20 × 4 + 3 × 4"; "84 ÷ 7: 70 ÷ 7 = 10, 14 ÷ 7 = 2, so 12" |
`factFamilies` / `factFamily` / `missFamily` classify these facts (a × fact with a multiple of ten is `x10s`, with
12–19 `xteen`, with 21–49 `xbig`; a ÷ with a two-digit quotient is `dbig`, with a tens divisor or dividend `d10s`);
`familyMembers` lists them; `famLabel` ("×10s", "teens ×", "big ×", "big ÷"); `difficulty` places them after ÷12;
`hints.js` / `patterns.js` explain them in the hint and the error patterns; `spoken.js` reads them (numbers to
9,999 already). Placement: `TIERS` gains T8 T9 T10; `tiersFor` includes them once T5 is known (the staircase can
climb into them); the scouts' "next tier" after T7 is T8 → T9 → T10; the frontier advances into them by the same
SECURE rule; the Fact Grid stays 12 × 12 (the Parent Zone's ladder lists the new tiers with their state). The Pit
Crew Check's text for them: "tens", "teens", "big numbers". `store.js`: nothing structural (families are keys).
New export for the app: `hillFacts(d, n, now, rand)` → `[{ fact, flip, kind: 'frontier' | 'scout' | 'stretch' }]`:
n facts for a climb, ≈ 40 % frontier (nextFact), 40 % the scout family's facts, 20 % **stretch** (the tier after the
scout's, so a secure kid meets the hard tiers here first); `recordHillAnswer(d, pick, result, now)` records them
(frontier → recordAnswer; scout / stretch → noteScout for their family, so right-and-quick stretch answers move the
frontier up). facts-tests cover the new families, hints, classification, placement into T8–T10, hillFacts' mix.

### 3. Two more cups (app): 12 new trails, 90 stars
`trails.js` gains 12 trails that reuse the 18 render styles with new themes (sky / layer colours), terrain, props, mx
and medal times: **Champion Cup** (cup `champion`, ×7 cash): Sunset Pines (forest at dusk), Crimson Canyon (canyon,
red sky), Frost Lake (lake, ice patches, grip 0.8), Thunder Beach (beach, storm, rain), Ember Vent (volcano, night),
Mirror Swamp (swamp, reversed). **Masters Cup** (cup `masters`, ×10): Midnight City (neon, longer), Fossil Flats (dino,
wind), Cloud Nine (sky, gravity 0.8, gaps), Pumpkin Hollow (haunted, fog 0.5), Far Side (moon, gravity 0.35), Prism
Peak (rainbow, 4,500 m finale). `cups.js`: 5 cups; Champion opens with the Legend trophy or 50 stars, Masters with the
Champion trophy or 70 stars (runway.js STARS_TO_OPEN); points / weekends unchanged. Stars: 90. Vehicle tier hints
for the trail cards: champion 6-8, masters 7-8. The Cups screen gets five tabs (scrollable), the title's cup line
counts the new cups; the site card and README say "30 worlds, 5 cups".

### 4. The app: the climb after the race, the results, the Parent Zone
After a **finished** race (any place) when Parents → Options → "Hill Climb" is on (default on): the results wait;
the HUD shows "HILL CLIMB!"; `game.startHill({ flags: 5, questions: 10, seed, cupMult })`; on every `hillHold` the
Gate panel asks the next of `hillFacts(facts, 10)` (the same panel, the same numpad; the hint on a miss; a miss is
one question spent, the engine slides back); the answer → `hillBoost({ power: correct ? 1 : 0, quick })`; on
`hillEnd` the cash is banked (a separate "Hill Climb" row on the results: "3 flags · 310 m" / "SUMMIT!"), the
climb's answers are recorded (`recordHillAnswer`), `save.hill = { climbs, summits, bestHeightM, flags }`,
a **gold crate** on a summit, a star-like **summit badge** on the trail card (`save.summits[trailId]`), then the
results. The Parent Zone Report line gains "hill climbs · summits"; the Fact ladder shows T8–T10. Pings: a climb
counts inside the race ping. Sync: `save.hill`, `save.summits` (max / union). Economy sim: the climb adds ≈ $2,500 ×
cupMult a race at 70 % right (a summit on 5 quick answers pays $3,250 × cupMult: it roughly doubles a race's cash,
which is the point of a bonus round the kids asked for); the sim's targets move to the 30-trail shape (Thunder Rail
~15 h, Moon Rover ~23 h, Champion Cup ~9 h, Masters Cup ~12 h) rather than the hill being nerfed.
Tests: ui-smoke (mock engine gains startHill / hillBoost / endHill and the hill events: a climb to the summit with
quick answers, a wrong answer, the results row, the toggle off → no climb, the five cup tabs, a Champion trail
opens with 50 stars, migration of a 1.6 save), sync-smoke (hill fields merge), facts-tests, engine-smoke, economy
sim table. VERSION 1.7.0, sw.js `trail-blazer-v1.7.0`. Docs: README, LEARNING-DESIGN (the climb as retrieval
practice with a visible payoff and the stretch tier as the "next step up" the research asks for; nothing in the
climb is timed, a slow right answer still climbs), the Why page's Trail Blazer section (one line), the site card.

## v1.7.1 — the Hill Climb throttle (Matt, Oct 30: "there should be a way for them to control the throttle or it
## seems disconnected")
In 1.7 a right answer fired the burst by itself and the kid watched. Now the answer **charges the rocket** and the
kid **holds GAS to climb**; the climb distance per answer is unchanged, the hands are on the wheel. Engine stream
(`src/game/*`, `dev.html`, `tools/engine-smoke.mjs`); the app wires the controls, the HUD and the coach line.

### 1. Engine contract
- `hillBoost({ power, quick })` no longer fires: with `power > 0` it **charges** the rocket with `charge = power ×
  (quick ? 1 : 0.7)` sections of fuel (one section = the 1.7 quick-burst distance, closed-loop as before) and emits
  `hillCharge { power, quick, charge (0..1, sections), answers }`. `power: 0` is the 1.7 sputter + slide to the
  last flag, then `hillHold` as before (no charge).
- While `hill.charge > 0` and `setInput({ gas: true })`: the rocket is on (flames, rings, the launch wheelie on the
  first ignition of a charge) and the fuel burns as distance is covered; `charge` falls to 0 exactly where the 1.7
  burst would have stopped when GAS is held throughout. Release → rocket off; the vehicle coasts to a stop and the
  engine **holds** it there (brake, no slide, never below the last flag line... the brake holds wherever it stops) and
  emits `hillWait { charge, heightM }` once stopped; GAS again resumes the burn from a standing start on the slope
  (thrust always beats gravity on every section). Flag lines and the summit fire as in 1.7 whenever crossed.
- When the charge is spent and the vehicle has stopped → `hillHold { heightM, flag }` (the next question), as in 1.7.
- **Auto-fire**: `cfg.autoSec` (default 6; 0 = off): a charge untouched for that long, or a wait longer than that,
  burns by itself (the same as GAS held) so a child who never finds the button still climbs; emits
  `hillAuto { charge }` first. The app passes `autoSec: 6` (`settings.hillAuto` later, not now).
- `getState().hill` gains `charge (sections left, 0..1)`, `thrusting (bool)`, `waiting (bool: stopped with charge
  left)`. Everything else in the 1.7 contract stands (hillStart / hillFlag / hillSummit / hillEnd, cash, `endHill`,
  `stop()`).
- BRAKE and BOOST do nothing on the hill (BOOST may later dump the charge in one leap; not now).
- dev.html: `hill=1` keys 1 / 2 / 0 charge; GAS (→ / Space) climbs; `auto=1` answers quick AND holds GAS.
- engine-smoke (part 4 extended): a charge with GAS held climbs the same distance as the 1.7 burst (± 2 m) on tiers
  1 / 4 / 8; GAS released mid-burst → the vehicle stops within 1.5 s and `hillWait` with the charge left > 0, no
  slide (heightM does not fall); GAS again → it resumes and `hillHold` comes with the full distance covered; a
  charge left alone fires after `autoSec` (`hillAuto`), with `autoSec: 0` it never does; 5 quick answers with GAS
  held still summit on every tier; a sputter still slides to the last flag; perf unchanged.

### 2. The app
During the climb the controls are back on (GAS only: BRAKE and BOOST hidden by `html.hill`), the HUD's boost
tank shows the **rocket charge** (filling on `hillCharge`, draining while thrusting; the label "ROCKET"), a banner
"Hold GAS to climb!" at the first charge of a player's first climb (then "Hold GAS!" small banner on a `hillWait`
longer than 2 s), `hillAuto` → no banner (the rocket just goes). Keyboard: → / Space = GAS as in the race. The
first-climb coach line is in `save.seen.hillCoach`. The pause menu's "End ride" ends the climb (as 1.7). The mock
engine mirrors the contract (charge, gas input, auto-fire). ui-smoke: the climb needs GAS (the test holds it via
`setInput`), a released charge waits, auto-fire with `autoSec` small via the mock's `window.__mockScript.hillAutoSec`.
