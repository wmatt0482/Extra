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
