# Ramp Rage

A one-thumb car-jumping game for iPhone, built as a static web app (PWA) with no build step.
Roll down a giant ramp, launch off the lip, flip in the air, stick the landing, and smash props for
cash. Spend it in the garage on 6 cars × 4 upgrade tracks, unlock 5 stages, chase the daily
challenge and three rotating goals. No ads, no IAP, no energy timer.

## v2 "epic update" features (UI / meta)

- **Combo badge**: chained smashes (each within 1.5 s) show a badge with the hit count in a ring that drains
  with the combo timer and the multiplier (`×1.25` … `×4`). It pulses on every hit, flashes red-gold at ×4
  ("RAMPAGE"), and shows the combo bonus (`+$235`) for a moment when the chain ends.
- **Altitude** readout while airborne (glows violet above 45 m, the "orbit" height).
- **Banners**: big centered BIG AIR (a flight longer than 3 s), ORBIT!, RAMPAGE ×4, REJUMP! and NEW RECORD
  slide in for ~1.2 s. Only one is ever on screen; a newer one replaces the current one after 0.65 s.
- **Run-cash ticker** counts up smoothly instead of jumping.
- **Results**: rating stamp (S/A/B/C/D, `cash.total / (finish × 4)`: S ≥ 1.5, A ≥ 1, B ≥ 0.6, C ≥ 0.3) slams in,
  S in gold with spinning rays; the run total counts up over 1.2 s; Combo and Air rows join the breakdown (hidden
  when they paid nothing; rows always add up to the total); extra stat tiles for best combo, altitude, air
  targets and rejumps (only when non-zero, 6 or 8 tiles); fireworks on a NEW RECORD.
- **Title hero**: the selected car rolls down the backdrop's ramp, launches, back-flips across the title with
  a speed trail, lands in a dust puff and loops (portrait: it arcs over the logo). Static pose with Reduced motion.
- **Audio**: explosion (boom + noise + sub thump, chained blasts attenuated), ring chime, balloon pop, combo
  riser pitched by count, crowd cheer (finish line; short one on a perfect landing), fireworks, orbit pad swell,
  rejump zap, part-knocked-off clank, and a nitro afterburner layer. A limiter on the master bus keeps stacked
  explosions from clipping.

### Achievements

Twelve badges, shown in the **Badges** panel on the title (locked ones are dimmed with a hint; counted ones
show progress). Earning one pops a toast during the run (queued, one at a time, never over a banner) and the
results screen lists the run's new badges. The title button shows how many are unseen.

| Badge | How |
| --- | --- |
| Head Over Wheels | land your first flip |
| Butter | a perfect landing |
| Triple Threat | 3 flips in one flight |
| Rampage | reach the ×4 combo multiplier |
| Kaboom | blow up a fuel drum or TNT crate |
| Chain Reaction | 3 explosions in one chain |
| Ring Collector | fly through 10 gold rings (lifetime) |
| Orbit | fly 45 m above the ground |
| Checkered Flag | cross a finish line |
| Kilometer Club | 1,000 m in one run |
| Full Garage | own all 6 cars |
| S Rank | an S rating on a run |

### Settings

Sound effects, Music, Reduced motion (no shake, no slow-mo, static title hero, no fireworks), **Screen shake**
slider (0-100 %, passed to the engine as `shake` 0..1; Reduced motion forces 0), and Reset progress.

### Save format

`localStorage['rampRage.save.v1']` (the key name is historical), schema `v: 2`. v2 added `achievements`
(`{id: earned timestamp ms}`), `settings.shake` (0-100, default 100), `seen.ach` (badges already seen), and
`records.bestCombo / maxAltitude / rings / explosions / rejumps`. v1 saves load in place: missing fields get
defaults, nothing else changes shape. A corrupt save is backed up to `rampRage.save.v1.corrupt` and the game
starts fresh.

## Run locally

All code is ES modules, so it has to be served over HTTP (opening the file directly will not work):

```sh
cd car-jump
python3 -m http.server 8080      # or: npx serve
```

Open <http://localhost:8080/>. Useful URL flags:

| Flag | Effect |
| --- | --- |
| `?mock=1` | Use the scripted mock engine (`src/meta/mockEngine.js`) instead of the real physics engine. |
| `?nosw=1` | Do not register the service worker (handy while editing files). |

The mock engine plays a scripted ~9 s run that emits every v2 event: launch, flips, a ring, a coin arc and a
balloon (a blimp on city/moon), a 4-hit combo that includes a fuel → TNT explosion chain, a knocked-off part, a
kicker rejump with a second flip and landing, orbit on the moon, and `record` when it passes `bestDistance`. Its
summary/getState carry the v2 fields and its cash follows the SPEC formula, so the results math checks out.

### Controls

| Button | On the ramp / ground | In the air |
| --- | --- | --- |
| **GAS** (bottom right) | accelerate | front flip (milder; times the spin so a held GAS still lands on the wheels) |
| **BRAKE** (bottom left) | brake | back flip (full torque, crisp) |
| **NITRO** (above GAS) | thrust | thrust along the nose |
| *nothing held* | coast | the car levels out for the landing |

Each flip input ramps in over a quarter second, so a thumb left on GAS from the ramp doesn't flip the car
instantly. Release a flip early and the auto-level finishes it wheels-down. GAS and NITRO can be held at the same
time (separate touches). The first run shows a one-time "How to jump" coach; tap to start.

Keyboard for desktop testing: **←** brake / back flip, **→** or **Space** gas / front flip,
**Shift** nitro, **Esc** or **P** pause (**Enter**/**Space** also dismisses the coach).

If `src/game/engine.js` is missing or fails to load, the shell logs a console warning and falls back
to the mock engine, so the menus always work.

### Tests and tools

```sh
node tools/ui-smoke.mjs      # walks every screen at 844×390 and 390×844 (mock engine), checks cash math + layout,
                             # v2 HUD/banners/toasts, results rows + stamp + fireworks, achievements, shake slider
node tools/engine-smoke.mjs  # real engine in dev.html: hold-GAS first run, back flip, pause/stop, maxed moon run
node tools/economy-sim.mjs   # plays the real engine headlessly (Node, no browser) through the whole meta game
node tools/make-icons.mjs    # re-renders icons/*.png from the inline SVG
```

`economy-sim.mjs` options: `--runs N`, `--verbose` (one line per run: distance, landing, cash, purchases),
`--seed-jitter S` (random start delay for human-like variance), `--policy flip|hold` (scripted back flip + release,
or GAS held the whole run). It reports runs-to-first-finish per track and runs-to-own per car; re-run it after
changing prices in `src/data/*.js` or cash/physics tuning in `src/game/engine.js` (`TUNING`).

Both use the globally installed Playwright (Chromium in `/opt/pw-browsers`). The smoke test starts
`python3 -m http.server 8080` itself if nothing is listening, and writes screenshots to
`$SHOTS_DIR` (default: a temp folder).

## Add to the iPhone Home Screen

1. Serve the folder over **HTTPS** (any static host below; Safari requires HTTPS for the service
   worker, except on `localhost`).
2. Open the URL in Safari, tap **Share → Add to Home Screen**.
3. Launch it from the icon: it runs full screen, landscape, with no Safari chrome, and works offline
   after the first load.

Note: iOS mutes WebAudio when the ring/silent switch is on silent.

## Deploy

It is plain static files: upload the `car-jump/` folder as-is to any static host (GitHub Pages,
Netlify, Cloudflare Pages, Vercel, S3 + CloudFront, nginx). No build, no server code. Make sure
`.webmanifest` is served as `application/manifest+json` (most hosts already do).

When you ship changes, bump `VERSION` in `sw.js` so installed copies drop the old cache. Without a
bump, players still get updates: the service worker serves the cached copy and refreshes it in the
background, so changes show up on the following launch.

## File layout

```
car-jump/
  index.html              PWA document: meta tags, inline CSS (design tokens in :root), all screens as DOM
  manifest.webmanifest    name, standalone, landscape, icons
  sw.js                   cache-first app shell (+ background refresh), versioned
  icons/                  icon-192/512, apple-touch-icon (180), favicon (64), generated by tools/make-icons.mjs
  vendor/matter.min.js    Matter.js 0.20.0 (physics, used by the engine)
  src/
    main.js               boot: save, audio, engine loading (real or mock), navigation, run lifecycle
    audio.js              WebAudio synth: engine hum, whoosh, smash, coin, flip, landing, nitro + afterburner, music
                          loop, explosion, ring, pop, combo riser, cheer, fireworks, orbit pad, rejump, clank
    data/                 cars, tracks, upgrades (shared tuning data)
    game/                 the physics engine (createGame contract in SPEC.md)
    meta/
      save.js             localStorage save (rampRage.save.v1), schema version, corrupt-save fallback
      economy.js          buy car / upgrade, stats, banking a run (records, unlocks)
      goals.js            3 rotating goals, progress from live events and run summaries
      achievements.js     12 badges from live events, per-frame state, run summaries and the save
      daily.js            date-seeded daily challenge
      rng.js              FNV hash + mulberry32
      mockEngine.js       contract-compatible fake engine (~9 s scripted run, full v2 event set)
    ui/                   garage, tracks, results, panels, HUD, controls, icons, car preview drawing,
                          titleHero.js (animated title car), fireworks.js (results overlay)
  dev.html                engine harness (keyboard + on-screen buttons, no meta)
  package.json            marks the ES modules for the Node tools only (no dependencies, no build)
  tools/
    ui-smoke.mjs          Playwright UI walk-through + layout audit
    engine-smoke.mjs      Playwright run of the real engine through dev.html
    economy-sim.mjs       headless real-engine economy simulation (Node)
    make-icons.mjs        icon renderer
```

## Wrap as a native App Store build (Capacitor)

1. Install Node and Xcode, plus an Apple Developer account.
2. In a new folder: `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios`.
3. `npx cap init "Ramp Rage" com.yourname.ramprage --web-dir=www`, then copy the contents of
   `car-jump/` into `www/`.
4. `npx cap add ios`, then `npx cap open ios` to open the project in Xcode.
5. In Xcode: set your team and bundle id, set orientation to Landscape Left/Right (portrait
   optional), add the 1024×1024 app icon (render it with `tools/make-icons.mjs` at 1024), and enable
   full screen / hide the status bar.
6. Nothing to change for offline: the files ship inside the app, and `main.js` only registers the
   service worker on http(s), so it is skipped under Capacitor's `capacitor://` scheme.
7. Test on a device, then **Product → Archive** and upload through Xcode Organizer to App Store
   Connect / TestFlight.
8. After every web change: copy files into `www/` again and run `npx cap copy ios`.
