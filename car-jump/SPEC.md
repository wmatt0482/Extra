# Ramp Rage — game spec and module contract

A one-thumb(ish) car-jumping game for iPhone, built as a static web app (PWA) with no build step.
Genre reference: BoomBit's *Ramp Car Jumping* / *Mega Ramp Car Jumping*, *Mega Ramp - Car Jump 2020*,
and the Hill Climb Racing meta loop. Feature list below is what those App Store titles ship and what
this game must match.

## Feature list (matches the App Store genre)

Core run loop
1. Each run starts at the top of a giant ramp. Hold GAS to roll down and build speed. At the lip the car launches; the
   engine stat adds a launch kick ("boost at the end of the ramp").
2. In the air: hold BRAKE = back flip (full torque), hold GAS = front flip (~60% torque, lower spin cap, and a
   landing-timing assist near touchdown so a GAS held all run still comes down wheels-first), no flip input = the car
   auto-levels toward the slope it will land on. Every hold ramps its torque in over 0.25 s so a thumb still on GAS
   from the ramp doesn't snap the car round. Hold NITRO = thrust along the car's nose (limited tank, refills a bit
   each run from the nitro stat). Flips are counted per full 360° (a flip landed wheels-down within ~57° of 360°
   also counts, since the lip kicks up and landings are downhill) and award points. Brief slow-motion (0.35x for
   ~0.4s) at the lip and at a perfect landing for drama.
3. Landing: if the car lands wheels-down with low angle and the impact is below the suspension threshold → "Perfect
   landing" (bonus) or "Good landing". Otherwise the car tumbles (it keeps going but loses speed, parts/sparks fly).
   A landing on the roof is a crash: the run keeps going as a tumble until the car stops.
4. After landing the car keeps rolling over bumpy terrain and through destructible props (crates, barrels, glass,
   walls, parked cars, billboards, …). Smashing each one pops cash. GAS/BRAKE on the ground accelerate/brake so the
   player can keep momentum. NITRO works on the ground too.
5. The run ends when the car's speed stays under 0.6 m/s for 1.2 s, or it flips onto its roof and stops, or it
   crosses the finish line and then stops. Result = distance (m from lip), air time, flips, props smashed, best
   speed, and the cash breakdown: distance cash + stunt cash + smash cash + landing bonus, all × coinMult.
6. Crossing the finish line of a track unlocks the next track.

Meta
7. Garage: 6 vehicles (see `src/data/cars.js`), bought with cash. Each car has 4 upgrade tracks × 10 levels
   (`src/data/upgrades.js`): Engine, Nitro, Suspension, Bonus. Costs scale with car tier and level.
8. Tracks: 5 themed stages (`src/data/tracks.js`), each with its own ramp size, terrain, gravity, props, finish line.
9. Daily challenge: one seeded run per calendar day (fixed car + track + a goal such as "reach 350 m" or "do 3 back
   flips"), pays a one-time cash reward. Three rotating "Goals" (e.g. smash 10 crates, land perfectly twice, hit
   120 km/h) with cash rewards; completing one rolls a new one.
10. Records: best distance per track, best score, total smashes, total flips, lifetime cash. Shown on the results
    screen ("NEW RECORD" callout) and in a Records panel.
11. Settings: sound on/off, music on/off, reduced motion (no screen shake), reset progress (with in-page confirm).
12. Juice: screen shake on landing/smash, dust/debris/spark particles, floating "+$25" and "BACKFLIP!" popups, speed
    lines at high speed, nitro flame, engine sound whose pitch follows speed, whoosh at launch, crunch on smash,
    coin ding, crowd-free (no ads, no IAP, no energy/fuel gate: unlimited plays).

Platform
13. Runs in iOS Safari and as a Home Screen PWA (manifest, apple-touch-icon, standalone, black-translucent status
    bar, `viewport-fit=cover`, safe-area insets respected). Works offline after first load (service worker).
14. Landscape is the primary orientation (buttons bottom-left: BRAKE/FLIP, bottom-right: GAS, NITRO above GAS).
    Portrait must still work: same controls, camera zoomed out a bit more.
15. No scroll bounce, no double-tap zoom, no text selection, no long-press callouts. `touch-action: none` on the game.
    Multi-touch: holding GAS and NITRO at once must work (track touches by identifier).
16. 60 fps target on an iPhone 12-class device: canvas 2D, devicePixelRatio capped at 2, fixed-step physics at 60 Hz
    with the accumulator capped (no spiral of death after a tab switch), objects outside the camera skipped when
    drawing, props spawned lazily ahead of the car and removed behind.
17. Audio is synthesized with WebAudio (no audio files). It is unlocked by the first touch (resume AudioContext
    inside the touch handler).
18. Keyboard works on desktop for testing: ← = BRAKE/FLIP, → or Space = GAS, Shift = NITRO.

## Directory layout

```
car-jump/
  index.html                full PWA document (meta agent)
  manifest.webmanifest, sw.js, icons/   (meta agent)
  vendor/matter.min.js      Matter.js 0.20.0 (vendored; loaded with a classic <script>, exposes global `Matter`)
  src/data/cars.js, tracks.js, upgrades.js    shared data (already written; both agents import, neither rewrites
                                              the schema — tuning numbers is fine, say so in your report)
  src/game/**               engine agent owns everything here; entry is src/game/engine.js
  src/ui/**, src/meta/**, src/audio.js, src/main.js    meta agent owns these
  dev.html                  engine agent's standalone harness (keyboard + on-screen buttons, no meta)
  tools/                    test scripts (Playwright) — each agent adds its own under tools/
```

All source is ES modules (`<script type="module">`), so serve over HTTP for testing:
`cd car-jump && python3 -m http.server 8080` (or `npx serve`). Playwright 1.56 is installed globally with Chromium
at `/opt/pw-browsers`; set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (already in env).

## The contract: `src/game/engine.js`

```js
import { createGame } from './game/engine.js';

const game = createGame(canvas, {
  onEvent: (evt) => { /* see events */ },
  reducedMotion: false,          // disables screen shake + slow-mo
});

game.start({
  car,          // a CARS entry (src/data/cars.js)
  stats,        // resolveStats(car, levels) from src/data/upgrades.js
  track,        // a TRACKS entry
  seed,         // integer; same seed => same terrain + prop layout (daily challenge relies on this)
});
game.setInput({ gas: bool, brake: bool, nitro: bool });   // called by UI on every touch change
game.pause(); game.resume();     // pause freezes physics and the engine sound
game.stop();                     // ends the run immediately, emits 'finish', tears down bodies
game.destroy();                  // remove listeners, rAF, ResizeObserver
game.getState();                 // snapshot, cheap, call per frame from the HUD:
// {
//   phase: 'ramp' | 'air' | 'ground' | 'done',
//   distance,        // meters past the lip (0 while on ramp, never negative)
//   speedKmh,        // |velocity| in km/h
//   nitro,           // 0..1 fraction remaining
//   airTime,         // seconds of the current/last flight
//   flips,           // completed flips this run
//   smashed,         // props smashed this run
//   cash,            // running cash total this run (already × coinMult)
//   finishCrossed,   // bool
//   landing,         // null | 'perfect' | 'good' | 'rough' | 'crash' (last landing)
// }
```

Events delivered to `onEvent(evt)` (all objects have `type`):
- `{type:'launch', speedKmh}` — car left the lip.
- `{type:'flip', dir:'front'|'back', count}` — a full rotation completed in the air.
- `{type:'land', quality:'perfect'|'good'|'rough'|'crash', impact}` — first ground contact after flight.
- `{type:'smash', kind, cash, x, y}` — a prop was destroyed (cash already × coinMult).
- `{type:'finishLine'}` — crossed the track's finish distance.
- `{type:'speed', kmh}` — emitted at most once per 10 km/h new max.
- `{type:'finish', summary}` — run over. `summary` =
  `{ distance, airTime, flips, frontFlips, backFlips, smashed, maxSpeedKmh, landing, finishCrossed,
     cash: { distance, stunts, smash, landing, total }, durationSec }`.
  `cash.total` already includes `coinMult`.

Cash formula (engine computes it; keep these numbers so the economy agent can balance against them):
- distance: `2 × meters`
- stunts: `150` per flip, +`50` per extra consecutive flip in the same flight capped at +`250` (flip k pays
  `150 + min(250, 50·(k−1))`), air time `10/s`
- smash: per-prop `cash` from `OBSTACLE_KINDS` (a multi-segment wall/billboard pays once)
- landing: for the jump's landing only (the run's first landing, = `summary.landing`): perfect `300`, good `100`,
  rough `0`, crash `0`. Later hops over crests pay nothing.
- all × `stats.coinMult`, rounded.

Rendering is entirely the engine's job (background parallax, terrain, ramp, props, car, particles, popups, slow-mo
tint). The UI layers HTML on top for HUD and buttons. The engine must not add its own touch handlers to the canvas
(dev.html may add them for the harness). The canvas fills its parent; the engine owns `ResizeObserver` and DPR.

## Physics notes for the engine agent

- Matter.js 0.20.0 via global `Matter` (vendored, loaded before the module scripts). Scale: 1 m = 30 px in physics
  space is a good range for Matter stability; the renderer applies camera zoom on top.
- Car = chassis polygon body (from `car.body`, note +y is UP in the data, flip for Matter) + wheel circles joined with
  stiff constraints (two per wheel for a rigid axle, slight softness for "suspension"). Spin wheels via angular
  velocity for GAS/BRAKE on ground; in the air apply torque to the chassis for flips (limit angular velocity).
  Nitro = force along chassis heading. Launch kick = velocity scaled by `launchBoost` as the car leaves the lip.
- Ramp: a curved quarter-pipe-ish slope built from static segments (height/length from the track), ending in a lip
  with a small up-kick (about 15°). Terrain after the gap: height-map polyline from the track's terrain params and
  seed, generated lazily ahead of the car as static edge bodies (chain of thin rectangles or `Bodies.fromVertices`).
- Props: Matter bodies placed on terrain starting at `obstacles.start` meters, spacing driven by `density` and seed.
  `segments` splits walls/billboards into stacked pieces. A prop is "smashed" when hit above a speed threshold; it
  then becomes debris (scattered small bodies with a short lifetime) and pays cash.
- Flip counting: integrate chassis rotation while airborne; each ±2π completes a flip; sign gives front/back.
- Landing quality: at first contact after `phase==='air'`, read impact (speed into the ground) and angle against the
  ground normal. Threshold `thr = 12 m/s × stats.suspension`: angle < 20° and impact < thr → perfect; angle < 35° and
  impact < 1.5·thr → good; upright but hard → rough; upside-down (or > 70° without wheels down) → crash.
- Run end: speed < 0.6 m/s for 1.2 s, or airborne but upside-down & resting, or fell out of world. Also a hard cap
  at 120 s.
- Camera: follows car with lookahead in the velocity direction; zoom out with speed and altitude so the ground is
  always visible during flight. Clamp so the ramp top looks good at the start.
- Determinism: all randomness from a seeded PRNG (mulberry32) seeded by `seed`.

## UI/meta notes for the meta agent

- Screens: Title → Garage (car carousel + 4 upgrade bars + buy/select) → Track select (5 cards, locked/unlocked,
  best distance) → Run (HUD: distance, speed, nitro bar, cash this run, flip/landing popups come from the engine) →
  Results (breakdown, NEW RECORD, buttons: Retry / Garage / Next track) ; plus Daily, Goals, Records, Settings panels.
- Save (localStorage, key `rampRage.save.v1`, wrapped in try/catch): cash, owned cars, selected car, per-car upgrade
  levels, unlocked tracks, best distance per track, best score, lifetime stats, daily challenge state (date string +
  done flag), active goals, settings. A corrupt save must not break boot (fall back to defaults).
- Starting cash: 0. Economy target: the first track's finish (400 m) should be reachable after ~6-10 runs of upgrades
  on the starter car; the last car should take a few hours of play, not days. Tune costs in upgrades.js if needed.
  Tuned with `tools/economy-sim.mjs` (real engine, scripted player): upgrade cost = `200 × 2.15^(tier−1) × 1.55^level`
  (rounded), car prices 7.5k / 18k / 24k / 75k / 280k → first 400 m finish ≈ run 6-10, Gravel Fox ≈ 12, Thunderline
  ≈ 30, Bigfoot ≈ 60, Vantablack ≈ 120, Warthog ≈ 240. (v1 numbers; v2 re-tuned them, see "v2 economy" below.)
- First run: a one-time coach overlay (three tips) holds the run until tapped; `save.seen.coach` remembers it.
- Until the real engine lands, build against `src/meta/mockEngine.js` that implements the contract with a fake
  run (emits plausible events over ~6 s) so every screen can be exercised. `src/main.js` must import the real
  `./game/engine.js`, with the mock only used when `?mock=1` is in the URL.
- Audio in `src/audio.js`: an `Audio` object with `unlock()`, `engine(speed01)`, `whoosh()`, `smash()`, `coin()`,
  `flip()`, `land(quality)`, `nitro(on)`, `music(on)`. Synthesized; keep it tasteful and short.
- Index.html is a full document with `<!doctype html>`, manifest link, apple meta tags, inline CSS, and
  `<script src="vendor/matter.min.js"></script>` before `<script type="module" src="src/main.js"></script>`.
  Design tokens in `:root`; the game is single-theme (bright arcade) by choice, with explicit backgrounds.
- Icons: generate `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` (180) with Playwright
  (render an inline SVG/canvas and screenshot it) — no binary assets checked in by hand.

## Epic update (v2): contract additions

The goal of v2 is spectacle: chained destruction, things to hit in the air, second jumps, cinematic
camera moments, and celebrations. Everything below is additive; nothing in the v1 contract changes.

### New `game.start` fields
- `bestDistance` (number|null): the player's best on this track. The engine draws a "BEST" flag at that x.
- `shake` (0..1, default 1): screen-shake intensity from settings (0 disables; `reducedMotion` still wins).

### New gameplay
1. **Combo chain.** Each smash within 1.5 s of the previous one extends a chain. Multiplier
   `mult = min(4, 1 + 0.25 × (count − 1))` applies to that smash's cash. Breaking the chain (timer runs out, run
   ends) emits `comboEnd`. The extra cash earned from multipliers is tracked separately as `cash.combo`.
   **Cap (tuning pass):** per run, `cash.combo ≤ cash.smash` (`TUNING.comboCap = 1`): the multiplier extra can at
   most match what the props themselves paid, so one 30-hit depot chain can never outpay the rest of the run.
   `smash.cash` stays base × coinMult; the in-world running popup and `comboEnd.cash` show what was actually paid.
2. **Explosive props.** New kinds in `OBSTACLE_KINDS`: `fuel` (red drum with a flame decal, cash 150) and `tnt`
   (crate with TNT label, cash 200). On smash they explode: radial impulse on everything within 6 m (props,
   debris, and the car, which gets a modest kick), a flash, a shockwave ring, fire/smoke particles, and any
   explosive prop in the radius detonates 120 ms later (chain reaction). Explosions count as smashes for the
   combo and emit `explosion`.
3. **Formations.** Props are placed as structures, not only singles: crate pyramids (3-6 wide), glass towers
   (3-5 panes stacked), scaffold bridges (two uprights plus a deck the car can land on and collapse), barrel
   rows, and a fuel depot (4-8 fuel drums tight together). At least one formation per 60 m after
   `obstacles.start`; density still scales with `obstacles.density`.
4. **Air targets.** Placed along the expected flight arc for the track (seeded): gold `ring` (pass through:
   $150 and +25% nitro), `coin` arcs (5-9 coins, $20 each), `balloon` ($200, pops), and on city/moon a `blimp`
   ($500, deflates). Rings/coins are sensors (no physics); balloons/blimps are light bodies the car bats aside.
   Emit `airTarget` per hit. Cash goes to `cash.air`.
5. **Kicker ramps.** 1-3 seeded kickers in the landing zone (after 40 m) sized to relaunch a car at speed.
   A kicker launch starts a new flight: flips count again, landing quality is scored again (bonus pays half),
   and `rejump` is emitted. Air targets are also placed over kickers.
6. **Altitude.** `getState().altitude` = meters above terrain. Above 45 m emit `orbit` once per flight: the sky
   darkens toward space, stars fade in, and an "ORBIT!" popup shows. Cash: `$5 × peak altitude` into `cash.air`.
7. **Car damage.** A crash landing or an explosion kick knocks parts off (bumper, a door panel, a hubcap as
   debris bodies) and starts a smoke trail. Cosmetic only; the run continues.
8. **Cinematics.** Launch: 0.5 s slow-mo at 0.3x with letterbox bars sliding in and the camera pulling back,
   then snapping to the chase. Perfect landing: 0.4 s slow-mo with a radial flash. Finish line: confetti burst and
   3-4 fireworks over the banner; the camera eases out so the banner and the car are both in frame. New record:
   when the car passes the BEST flag the flag waves and a "NEW RECORD" banner pops in the world.
9. **Rating.** `summary.rating` ∈ `S|A|B|C|D`, computed in the engine from a 0-110 score
   (`summary.ratingScore`, formula in `src/data/rating.js`, shared with the mock engine and the meta fallback).
   It scores what the player did on this track, not what the upgrades pay (v2's first draft used
   `cash.total / (finish × 4)`, which rated almost every mid-tier run S and rose with the Bonus upgrade):

   | part | points |
   | --- | --- |
   | reach | `35 × min(1, distance / track.finish)` |
   | finish line crossed | +10 |
   | the jump's landing (`summary.landing`) | perfect 20 · good 12 · rough 4 · crash 0 |
   | flips landed (flights that ended in a crash don't count), max 3 | 6 each (18) |
   | best combo multiplier `min(4, 1 + 0.25 × (bestCombo − 1))` | `6 × (mult − 1)`: ×3 → 12, ×4 → 18 |
   | gold rings, max 3 | 3 each (9) |

   **S ≥ 88 · A ≥ 60 · B ≥ 40 · C ≥ 10 · D below.** Anchors (measured with the previous-tier car on each track):
   S is a near-max run, e.g. finish crossed + perfect landing + 2 flips + a ×3 combo = 89 (or the equivalent
   from more flips, a longer chain, rings); a clean run (good landing, a flip, most of the way) is B; a clean run
   with a combo chain and a couple of rings is A; a sloppy one (crash or rough landing, part of the way) is C;
   D is a crash that barely gets going. The results screen stamps it (the stamp's tooltip shows the score).

### New events
- `{type:'combo', count, mult}` on every smash with `count ≥ 2`.
- `{type:'comboEnd', count, mult, cash}` when a chain of `count ≥ 3` ends (`cash` = extra from multipliers).
- `{type:'explosion', x, y, cash, chain}` (`chain` = index in a chain reaction, 0 for the first).
- `{type:'airTarget', kind:'ring'|'coin'|'balloon'|'blimp', cash, nitroRefill}`.
- `{type:'rejump', count, speedKmh}` on a kicker launch (count = secondary flights this run).
- `{type:'orbit', altitude}` once per flight above 45 m.
- `{type:'record'}` when the car passes `bestDistance` (only if `bestDistance > 0`).
- `{type:'damage', part}` when a part is knocked off.

### Summary additions
`summary` gains `rating`, `ratingScore`, `maxAltitude`, `bestCombo`, `explosions`, `rings`, `coins`, `airTargets`, `rejumps`,
and `cash` gains `combo` and `air` (so `cash = {distance, stunts, smash, landing, combo, air, total}`).
`getState()` gains `altitude`, `combo: {count, mult, timer01}`, `rejumps`.

### Who draws which big text (one per moment)
The engine draws its own texts on the canvas; the HUD layers banners and toasts in the DOM. Each moment has
exactly one big text, and the two layers use different bands of the screen so they never overlap (the camera
keeps the car at ~43-51 % of the height):
- **HUD banners** (band under the top bar: top 18 % landscape / 30 % portrait): `LAUNCH! 141 KM/H` (launch),
  `BIG AIR!` (a flight passes 3 s), `ORBIT!`, `REJUMP!` / `REJUMP ×2` (kicker), `RAMPAGE ×4`. One at a time.
- **HUD message lane** (same band, never while a banner is up; a banner cuts a message and it comes back
  later if it was cut early): achievement toasts, `Goal done: …`, `Unlocked: <next track>`.
- **HUD combo badge:** the running chain (hit count, `×3.25`, drain ring, `+$N combo bonus` when it ends). The
  engine no longer draws a running combo popup in the world (it could drift up under the badge).
- **Engine, in the world, next to the action:** `+$150` cash popups (a single smash / air target),
  `+25% NITRO`, and the waving NEW RECORD flag banner (drawn at least ~200 px wide).
- **Engine, screen lane at ~60 % (cash line at ~70 %):** flip names (`DOUBLE BACKFLIP!` + `+$350`), landing
  quality (`PERFECT LANDING!` + bonus, `CRASH!`, `CLEAN HOP`), `FINISH LINE!`, `BLIMP!`, `NEW MAX 150 km/h`.
- Gone (duplicates): the engine's `LAUNCH!`, `KICKER!` and `ORBIT!` texts, the HUD's NEW RECORD banner, and the
  HUD's "Finish line!" toast (the engine already says it; the HUD only adds the unlock).

### v2 economy (tuning pass)
v2 runs pay ~2.5× v1 early on (combos, air targets, kickers), so prices were scaled to put progression back on
the v1 curve (`node tools/economy-sim.mjs`, three runs: `--seed-jitter 0 / 0.4 / 0.8`, averaged):
upgrade cost = `480 × 2.15^(tier−1) × 1.5^level` (rounded; `COST` in `src/data/upgrades.js`), car prices
13k / 25k / 42k / 100k / 400k (`src/data/cars.js`), the per-run combo cap above, and the "Earn $N in one run"
goal targets ×2.5 (`src/meta/goals.js`). Daily-challenge and other goal rewards are unchanged.

| milestone (runs) | v1 target | v2 before tuning | v2 tuned, avg of 3 | v2 tuned, jitter 0 |
| --- | --- | --- | --- | --- |
| first 400 m finish | 6-12 | 5 | 7 | 10 |
| Gravel Fox | ~12 | 6 | 12 | 14 |
| Thunderline | ~30 | 13 | 30 | 32 |
| Bigfoot Jr. | ~60 | 20 | 63 | 64 |
| Vantablack GT | ~120 | 53 | 121 | 140 |
| Warthog | ~240 | 126 | 241 | 262 |

(The jitter-0 run is pinned to one deterministic outcome; there Bigfoot Jr. at Engine 6 / Nitro 6 flips onto its
roof on a crate pyramid at 281 m on Glacier Gap twenty-odd runs in a row, which delays Vantablack. Any start
variance avoids it.)

### UI/meta additions (meta agent)
- HUD: combo badge (count + multiplier, pulses on each hit, drains with `timer01`), altitude readout during
  flight, "BIG AIR" / "ORBIT" / "RAMPAGE ×4" banners, cash ticker that counts up.
- Results: rating stamp animation (S in gold with rays), fireworks on NEW RECORD, cash count-up, new rows for
  Combo and Air.
- Achievements panel: 12 badges (first flip, first perfect landing, 3-flip flight, combo ×4 (kept at ×4: a
  Thunderline-level player reaches it in ~60 % of runs, see README), first explosion,
  chain of 3 explosions, ring collector ×10, orbit, first finish, 1 km run, own all cars, S rating) with toasts
  when earned, stored in the save.
- Title screen: an animated hero (a car launching off a ramp and arcing across, looping) instead of a static car.
- Settings: screen shake slider (0-100).
- Audio additions: `explosion()`, `ring()`, `comboUp(count)`, `cheer()` (filtered-noise crowd swell at finish
  line and perfect landing), `fireworks()`, `orbit()` (airy pad swell), `rejump()`, nitro afterburner layer.

## Spelling edition (v3): "Spell Jump"

The game becomes a 4th-grade spelling trainer built on evidence-based techniques; see
`docs/LEARNING-DESIGN.md` for the rationale behind every rule here. Principle: the learning action IS the game
action. Every jump starts with a word spelled from memory; spelling it right is what gives the car full
launch power. The pure car game is tagged `ramp-rage-v2` in git. The app is renamed **Spell Jump** (title,
manifest, SW cache name, README). Cartoon explosions stay; copy is kid-friendly everywhere (no "rage",
no "kill"; rename the Warthog to "Rhino").

### Non-negotiable learning rules
R1. A word is never visible while the child is spelling it from memory (retrieval, not copying).
R2. The game never displays a misspelling except the child's own attempt, for at most 3 s, with differing
    letter positions marked; then it is cleared. No multiple-choice between spellings anywhere.
R3. Every miss is corrected immediately, by the child, with Cover-Copy-Compare (see Spell panel step 5).
R4. Spacing: a word's next due time grows with its box; a missed word returns later in the same session after
    at least 2 other words. Mastery needs 3 first-try successes on ≥ 2 distinct days.
R5. At most 5 new words introduced per day per player. Daily mission ≈ 8 retrievals.
R6. Letters are spoken by name as they are typed (SOS). Speech is synthesized on device.

### Players (profiles)
- Up to 4 players, each with a name and a car-color avatar. A player picker is the first screen (big tiles,
  "+ New player" with a name field and a big on-screen keyboard, never the native keyboard).
- Each player has their own full game save under `spellJump.<playerId>.save` and spelling data under
  `spellJump.<playerId>.words`. A family record `spellJump.family` holds the player list, the parent PIN and
  parent options. All localStorage access stays wrapped in try/catch. An existing `rampRage.save.v1` is
  migrated into the first created player.
- Family sync (v3.2, optional, Parents → Family sync): a family code shares the family record and every player's
  save and words across devices through one Netlify Function over Netlify Blobs (`/api/family/:code[/:key]`,
  rev-checked writes, 409 + merge on conflict). Players are removed by tombstone (`removedPlayers`). See README
  "Family sync" for the API, the merge rules and the privacy note.

### Parent Zone (title button, PIN-gated)
- First open: set a 4-digit PIN (entered twice). Later: enter PIN. "Forgot PIN": press-and-hold 3 s, then a
  2-digit × 2-digit multiplication; correct → set a new PIN.
- Per player tabs:
  - **Words of the week**: a text area, one word per line. Optional parts after the word, separated by ` | `:
    `neighbor | neigh/bor | My neighbor has a dog.` = word | syllables (slash-separated) | sentence, plus an
    optional 4th part **say as** (v3.1): `read | | I read a book. | reed` makes the voice say "reed" wherever it
    would say the word; never shown to the child (tiles still show "read"); letters, apostrophes, hyphens, spaces,
    ≤ 40 characters, an invalid one is refused with the line number; more than 4 parts is refused. A separate
    "Pattern of the week" field (e.g. `ough` or `-tion`), optional. Save creates a dated list and makes it
    active; the previous list goes to the archive (view / restore / delete). "Copy to <other player>". Max 40
    words; letters, apostrophes, hyphens, spaces allowed; case-insensitive; trimmed; duplicates removed.
  - **Report**: Qualifier (pretest) score vs latest Friday Test score for the active list; per-word table:
    word, status (New / Focus / Learning / Almost / Mastered), attempts, first-try %, last practiced, days
    practiced; test history (date, score, missed words); "Copy report" (clipboard with select-text fallback).
    A "Why this works" link opens an in-app page with the table from `docs/LEARNING-DESIGN.md` (plain text,
    no external links).
  - **Options**: speech rate (very slow 0.5 / slow 0.6 / normal 0.85), voice (see "Speech clarity"), words before
    each race (1-4, default 2, see "Spell to Launch" 8), new words
    per day (3 / 5 / 8), include past-list review words (on), tile case (lowercase default), reset this player's
    spelling data, reset this player's game save.
- A sample list ships so the game is playable immediately, labeled "Sample list" in the Parent Zone and on the
  title until replaced: `because, beautiful, favorite, friend, neighbor, enough, through, thought, weather,
  whether, library, different, question, straight, especially`. Pattern: none. Include syllables for each.

### The weekly cycle
1. **Qualifier** (pretest). The first time a player plays after a new list is saved: a quick screen, all words
   once in random order, audio only, one attempt each, immediate check. A miss shows the comparison per R2 and
   the correct word spelled aloud, no copy step (keep it quick). Pays $100 per correct word. Correct → box 2
   ("Almost"); missed → box 0 and flagged **Focus**. Stored as the pretest score.
2. **Daily missions** (any day). Title shows "Today: 3 / 8 words". The scheduler fills the mission from due
   words (see scheduler), Focus words first, then up to N new words (option, default 5), then review words from
   past lists that are due (2 and 4 weeks after their list was retired). Completing the mission pays $500 and a
   "Mission complete" banner; play continues with free retrieval runs (words picked by the same weights).
3. **Friday Test** (title button, available any day, intended for Thursday/Friday). All active words, random,
   audio only, no hints, no retries, one screen with a progress bar. A miss shows the comparison per R2 and the
   correct spelling aloud (test still counts as a miss). Score = correct / total. Then one **Mega Run** with
   launch power `60% + 40% × score` and `$150 × correct`. Stored in test history; missed words drop to box 0.

### Spell to Launch (every run)
1. The run begins with the car parked at the top of the ramp (phase 'ramp', no input). A **Spell panel**
   overlays the scene: speaker button "Hear it" (presents the word, see "Speech clarity" below; Web Speech API
   `speechSynthesis`, English voice, rate per option; the first `speak` call happens inside a tap), "Say it
   again", "Sentence" (if provided), "Syllables" (if provided), a row of
   letter tiles that fills as the child types, and a big on-screen QWERTY keyboard with apostrophe, hyphen,
   space, backspace and a wide LAUNCH key. Each typed letter is spoken by name (R6). Never the native keyboard.
   If `speechSynthesis` is unavailable, the panel says so once and uses a "Look for 3 s, then spell" fallback.
   **Speech robustness (QA pass):** speech counts as unavailable for an attempt when the API is missing, when
   `getVoices()` is still empty 1.5 s after asking (`voiceschanged` + polling), or when the spoken word has not fired
   `onstart` 1.5 s after `speak()`. Then the word is shown for 3 s ("Look, then spell it") and covered; the one-time
   hint reads "Speech isn't available on this device, so you'll see each word first". The Qualifier and Friday Test
   use the same per-word fallback. Every tap calls `speechSynthesis.resume()` if the synth is `paused` (iOS);
   speech is cancelled when the panel / test closes and when the app is hidden. Parents → Options shows
   "Speech on / off" with the number of voices detected and a "Test voice" button.
   **Speech clarity (v3.1).** A parent reported that the bare word was not enunciated enough to understand: browser
   TTS clips a short word spoken on its own. So a word is *presented* like a spelling test, as separate utterances
   with ~280 ms of silence between them (no SSML in browsers; commas / periods make the pauses):
   `"The word is, <word>."` → the sentence if there is one → `"<word>."` (`tts.buildPresentation`, pure). This
   is used in Look (new word), when Write opens for a word without Look (once per presentation, never on a
   re-render), in Cover (carrier + word, no sentence), in the Qualifier / Friday Test, and by **Hear it**, which
   cancels any speech in progress first. **Say it again** says `"<word>. <word>."` at the slow rate. **Syllables**
   (shown next to "Sentence" only when the list gives syllables) says them slowly with pauses: `"neigh, bor."`
   (the syllables as written; the say-as text is not split). The say-as text replaces the word in every one of
   these; letters are still spelled by name. Rates: normal 0.85, slow 0.6, very slow 0.5 (the slow buttons use
   min(slow, current)); pitch 1.0. The 1.5 s watchdog applies to `onstart` of each utterance, not its duration.
   **Voice**: Parents → Options lists every English voice ranked by likely quality (`tts.rankVoices`, pure):
   Apple Premium / Enhanced (also Ava, Zoe, Evan, Allison, Samantha, Tom) → Microsoft Natural (Aria, Jenny, Guy,
   Ana, Michelle, …) → Google US English → other en-US → other English; novelty / low-quality voices (Fred,
   Zarvox, Albert, Bad News, Bahh, Bells, Boing, Bubbles, Cellos, Deranged, Good News, Hysterical, Jester, Organ,
   Trinoids, Whisper, Wobble, Junior, Ralph, Kathy, Flo, Grandma, Grandpa, Rocko, Sandy, Shelley, Eddy, Reed,
   compact, eSpeak) last. Each row has ▶ Test ("The word is, neighbor. My neighbor has a dog. Neighbor." in that
   voice) and can be chosen; "Automatic" = the top-ranked voice. The choice is stored as `voiceName` + `voiceLang`
   in that player's options; a device without that voice uses the ranked default. The voice in use is shown. A tip
   under the list: "On iPhone or iPad, clearer voices can be downloaded in Settings → Accessibility → Spoken
   Content → Voices → English (choose an Enhanced or Premium voice), then pick it here." The same tip appears on
   the child's spell panel only inside the one-time no-speech hint.
2. **New word** (first encounter ever for this player): Look-Say-Cover-Write-Check. Look: the word is shown
   for 4 s in tiles with the pattern chunk highlighted (if a pattern is set) and syllable breaks marked (if
   given), while the audio says the word and then spells it. Cover: tiles hide. Write: the child spells it.
   Check: immediate.
3. **Correct on first try**: tiles flash green, "PERFECT SPELL!", the word is said once more, spelling bonus
   `$400 × (1 + 0.1 × streak)` (streak = consecutive first-try words, cap 10) × coinMult, launch power 100%,
   nitro 125%. Panel closes; the child drives (hold GAS).
4. **Correct but not first try this run** (after a fix): launch power 65%, nitro 100%, no bonus.
5. **Wrong** → Cover-Copy-Compare, all inside the panel:
   - Compare (≤ 3 s): the attempt stays with differing positions marked red; the correct word appears above in
     green tiles while it is spelled aloud letter by letter with each tile lighting (SOS). Then the attempt row
     clears (R2).
   - Copy: the correct word stays visible; the child types it; LAUNCH enables only when it matches.
   - Cover: the model hides; the child types it once more from memory. Match → go (step 4 power). Miss →
     show the model again and repeat Copy + Cover once; after a second miss the run goes at 65% anyway and the
     word is re-queued for later in this session (R4).
6. **Letter rings**: the air rings carry the word's letters in order along the arc (engine gets
   `letters: [...]`). Passing through one says the letter name and pays $40; all in order pays a
   "WORD COMPLETE" $200. Extra rings stay plain.
7. Results gains a **Spelling** row (word, first try or fixed, bonus, streak) and "Today: n / 8".
8. **Words before each race** (v3.1, Parents → Options, per player: 1 / 2 / 3 / 4, default 2, also for existing
   players; `wordsPerRace` in the family options). The panel runs that many words back to back before the car
   launches: "Word 1 of 2" on the chip, each word drawn from the scheduler as before (mission counter, scheduler
   update, spelling bonus and streak per word; a missed word still goes through Compare → Copy → Cover and can be
   re-queued later in the session). Between words the panel stays open with a ~0.8 s "Next word!" beat; the car
   stays parked. Launch from the set (`setLaunch(c, n)` in `wordStore.js`, c = first-try words, n = words
   asked): powerScale = 0.65 + 0.35 × c/n, nitroScale = 1 + 0.25 × c/n; `game.setLaunchPower` is called once after
   the last word. Letter rings: the missed word if exactly one was missed, the last missed word if several, else
   the last word asked (the engine takes letters only in `start()`, so the still-parked run is restarted with the
   same seed and the ring word's letters when it differs from the first word). Results: the Spelling row lists every
   word with ✓ (first try) or ↻ (fixed / practiced again) and the total bonus; the HUD letter strip shows the ring
   word. The Qualifier, Friday Test and Mega Run are unchanged.

### Scheduler (per player, in `src/spelling/scheduler.js`, pure functions, unit-testable in Node)
- Per word: `box` 0..3, `due` (timestamp), `attempts`, `firstTry`, `seenCount`, `lastSeen`, `daysCorrect`
  (set of ISO dates with a first-try success), `focus` (bool from the Qualifier), `listId`.
- Intervals by box: 0 → same session (after ≥ 2 other words), 1 → +1 day, 2 → +2 days, 3 → +4 days.
  First-try success → `box = min(3, box+1)`, `due = now + interval(box)`; a miss → `box = 0`.
- Status: New (seenCount 0) · Focus (flag and box < 2) · Learning (box 0-1) · Almost (box 2) · Mastered
  (box 3 and `daysCorrect.size ≥ 2` and `firstTry ≥ 3`).
- Mission order: due Focus words → other due words → new words (cap N/day) → due review words from archived
  lists → if still short of 8, the lowest-box active words. Never the same word twice in a row while > 1
  word exists; a missed word returns after ≥ 2 others (same session queue).
- Free play after the mission: weighted pick, box 0 ×4, box 1 ×3, box 2 ×2, box 3 ×1, 20% chance of a
  non-mastered archived word.
- All date logic takes `now` as a parameter so tests can simulate days.

### Engine contract additions (engine agent)
- `game.start({..., letters: string[] | null, powerScale: 0..1.25, nitroScale: 0..1.5 })`: `powerScale`
  multiplies ramp/ground acceleration and the launch kick; `nitroScale` multiplies the starting tank.
- `game.setLaunchPower(powerScale, nitroScale)`: allowed while phase is 'ramp' and the car has not moved
  (the UI calls `start` first so the scene shows behind the panel, then this when the panel resolves).
- Letter rings: when `letters` is non-empty, the first `letters.length` rings along the main arc (by x) carry
  the letters in order, drawn inside the ring, legible on a phone. Hitting one emits
  `{type:'letterRing', letter, index, inOrder}` (no `airTarget` for it), pays $40 into `cash.air`, refills 25%
  nitro; collecting the last letter with `inOrder` emits `{type:'wordComplete', cash:200}` (into `cash.air`).
  If a track has fewer rings than letters, add rings along the arc. The engine never speaks.
- **R1 in the engine (QA pass):** the rings are placed at `start()` (so the preview arc shows behind the panel) but
  draw a `?` instead of their letter until the car leaves the lip (`launch`, phase `'air'`); no letter glyph is ever
  drawn in phase `'ramp'`. `getState().letters` is `{collected: 0, total: 0}` until then, and the HUD letter strip
  fills on the `launch` event. `debugInfo()` exposes `lettersRevealed` and `glyphLeaks` (letter glyphs drawn while
  hidden, always 0) for the smoke tests.
- `summary.letters = {collected, total, inOrder}`; `getState().letters = {collected, total}`.
- The engine never auto-starts: with no input the car sits parked at the ramp top indefinitely.

### Economy
- Spelling bonus is the main income. Keep the run economy. The QA agent re-runs `tools/economy-sim.mjs` with
  a simulated 75%-first-try speller and the mission reward; aim for milestones about 1.5× faster than v2
  (first finish ~5 runs, second car ~8, last car ~160) so a child sees a new car within a few sessions.
- **Tuned (QA pass):** `node tools/economy-sim.mjs --speller 0.75` (75 % first try with the $400 × streak bonus,
  100 % / 65 % launch power, letter rings, 8 runs a day, $500 mission once a day; Qualifier / Friday Test pay-outs
  not simulated), averaged over `--seed-jitter 0 / 0.4 / 0.8`. Upgrade cost `480 × 2.0^(tier−1) × 1.5^level`
  (tier multiplier was 2.15); cars $13k / $19k / $36k / $88k / $340k (were 13k / 25k / 42k / 100k / 400k).
  On-screen bonus numbers unchanged.

  | milestone (runs) | target | v3 before tuning (avg; j0 / j0.4 / j0.8) | v3 tuned (avg; j0 / j0.4 / j0.8) |
  | --- | --- | --- | --- |
  | first 400 m finish | ~5 | 4.3 (4 / 4 / 5) | 4.3 (4 / 4 / 5) |
  | Gravel Fox | ~8 | 8.3 (8 / 8 / 9) | 8.3 (8 / 8 / 9) |
  | Thunderline | ~20 | 25.3 (20 / 27 / 29) | 20 (13 / 23 / 24) |
  | Bigfoot Jr. | ~40 | 49.7 (45 / 56 / 48) | 41 (35 / 43 / 45) |
  | Vantablack GT | ~80 | 93 (85 / 95 / 99) | 77.3 (69 / 83 / 80) |
  | Rhino | ~160 | 185 (172 / 190 / 193) | 158.7 (133 / 176 / 167) |

  Note: with the on-screen numbers kept as specified, the spelling bonus + mission is ~11 % of the cash earned
  before the second car and ~3-4 % of lifetime cash, so it is not "the main income"; the launch power it sets
  (100 % vs 65 %) matters more to progress than the bonus itself.

### Kid-proofing
- No external links anywhere in the kid-facing UI. No native text inputs. The pause menu has no reset. Only
  the Parent Zone deletes anything. (QA pass: the pause menu's shake slider is a `role="slider"` element, not an
  `<input>`, so every native input lives in the PIN-gated Parent Zone.) Title: PLAY, FRIDAY TEST, BADGES, PARENTS (settings live in the pause menu
  and the Parent Zone).

## Engagement update (v3.3): streaks, family board, crates, trophies, levels, cosmetics

Goal: make the kids want to come back, with mechanics that reward practice and never punish or exploit.
No lives, no energy, no timers that nag, no rewards for time spent. Data in `src/data/cosmetics.js`.

### Save additions (per player, all sync-merged)
- `xp` (number, merge: max), `streak: {count, best, lastDay (ISO), shieldAvailableWeek (ISO week), shieldUsedDays: []}`
  (merge: the doc with the later `lastDay` wins `count`/`lastDay`; `best` = max; shields: union of used days),
- `cosmetics: {skins: [ids], stickers: [ids], equipped: {carId: {skin, sticker}}}` (merge: union; equipped LWW),
- `crates: {earned, opened, sinceCosmetic}` (monotonic counters; unopened = earned − opened; merge: max each),
- `trophies: {listId: [mastered word, …]}` and `champion: [listId, …]` (merge: union).

### 1. Daily streak
- A day counts once the daily mission (8 words) is complete. Title screen shows a flame with the count next to
  the player chip; tapping it opens the Streak panel: current / best, a month calendar with filled days,
  shield days marked, and the next milestone ("3 days to a crate").
- Streak shield: one per ISO week, applied automatically to the first missed day (the day after a miss, the
  streak continues and the calendar shows a shield on the gap). Missing two days in a week breaks it.
- Milestones in `STREAK_MILESTONES` pay a crate; 7 / 14 / 30 days also unlock the named cosmetics.

### 2. Family board (player picker)
- Below the tiles, a weekly board (ISO week, resets Monday) for every player on the device/family: words
  mastered this week, current streak, best jump this week (m). Rank medals; the weekly leader's tile gets a
  crown. A one-line nudge under the board for the selected/last player: "Mia is 2 words ahead" or "You're in
  the lead!" With one player, the board shows that player's own numbers and no nudge.
- Derived locally from the synced saves/words; nothing new on the server.

### 3. Mystery crate
- Earned on mission completion, streak milestones and Week Champion. A crate drops on the results screen
  with a shake; tap to open: cash 60% ($300-800 scaled ×tier of the selected car), sticker 25%, skin 12%,
  jackpot 3% (cash × 3). Pity: every 5th crate without a cosmetic guarantees one. Duplicates of cosmetics
  roll again (if all crate cosmetics are owned, cosmetics convert to cash). Unopened crates wait on the
  title ("1 crate" button with a bounce); opening is a short animation with a reveal card.

### 4. Mastery trophies
- When a word becomes Mastered (existing rule: box 3, 3 first-try successes on ≥2 days), the results screen
  shows a "WORD MASTERED" moment: the word's tiles go gold and smash into a trophy that flies to a shelf
  icon. A Trophies panel (title button) shows this week's words as a shelf: gray slots for unmastered words,
  gold trophies for mastered ones, past weeks below.
- Week Champion: every word of the active list mastered → badge, fireworks, the Champion Chrome skin +
  Trophy sticker, a crate, and +300 XP. Shown on the Family board as a crown next to the name for the week.

### 5. Speller levels
- XP per `XP` in cosmetics.js. Level and title shown on the title under the player chip with a progress
  bar, and on the picker tile ("Lv 4"). Level-up: fanfare + full-screen "LEVEL 5 · Word Wrangler" stamp on the
  results screen; level cosmetics unlock at their levels.

### 6. Skins and stickers
- Garage gains a "Style" row under the car: skin chips (owned ones in color, locked ones gray with how to
  earn: "crate", "7-day streak", "Level 8", "Week Champion") and sticker chips. Equipping is per car.
- Engine: `game.start({ ..., skin: {body, accent, decal} | null, sticker: {glyph, color} | null })`; the car
  renderer (shared by the game, the garage preview and the title hero) paints the skin and draws the decal
  (`fade`, `stripes`, `flames`, `dots`, `camo`, `bolt`, `checker`, `stars`, `shine`, `rainbow`, `crown`) and
  the sticker on the door. Decals are simple canvas shapes, no images.

### Not doing (on purpose)
No lives/energy, no countdown nags, no purchases, no rewards tied to minutes played, no notifications.
