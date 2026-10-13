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
  ≈ 30, Bigfoot ≈ 60, Vantablack ≈ 120, Warthog ≈ 240.
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
