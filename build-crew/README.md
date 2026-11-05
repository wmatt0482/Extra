# Build Crew

A static 3D construction sandbox for tweens for Learning Lab. Twenty jobs on three work sites (ten in the yard, five at the harbor, five on the hillside), a skid steer, an excavator, a crane and a wheel loader, and a free-play yard with one save slot per family profile. The thirty-job roadmap is in [SPEC.md](SPEC.md); the harbor, the hillside and the wheel loader (0.6) are described in [docs/v0.6-sites.md](docs/v0.6-sites.md).

From the repository root:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/build-crew/. The existing `spell-jump -> car-jump` symlink supplies the shared modules locally. Netlify's `bash build.sh` copies the correct folders into `dist/`; there is no game package.json or bundler. Three.js 0.170.0 and Rapier 3D compat 0.17.3 (embedded WASM) are pinned in `vendor/`, with licenses and SHA256 hashes. Play does not fetch a CDN.

Drive with WASD; I/K lifts. J/L tilts SS-01's bucket, extends EX-02's stick or swings CR-03's boom. Shift+J/L swings EX-02's cab. The skid steer has no swing, so Shift+J/L does nothing to it (its bucket no longer orbits the chassis). U/O extends/retracts CR-03's boom and curls EX-02's bucket. Space grabs or releases when the tool is close to a toy, E hops to the nearest other machine, R resets a stuck machine, H sounds the horn, Escape pauses. Machine cards and all extra joints have buttons. A standard gamepad is supported. Drag to orbit; scroll or pinch to zoom.

On a touch screen (a phone or tablet; `?touch=1` or `?touch=0` forces it) the keyboard chips go away and the hints say what to touch: "Drag the left stick to drive", "Drag the right stick up to lift", "tap Grab", "Tap Hop to jump into another machine". Two translucent sticks sit in the lower corners with Grab, Hop, Recover and Horn between them; site tools are down the left edge and machine cards down the right; the tray is a bottom sheet (portrait) or a centre sheet (landscape). Pinch zooms with both thumbs still on the sticks. Where the device has it, a grab and a release buzz briefly (off in calm motion).

The shared Parent Zone uses the existing family PIN, sync and voice picker. Build Crew's Report shows jobs completed and active minutes per day, and a **Picture quality on this device** panel: the device tier (phone, tablet or desktop; `?tier=phone|tablet|desktop` forces one), the resolution the game started at and now uses, the shadows, the physics step budget, the first-second speed test and every automatic change with its reason. The game lowers detail by itself on a slow device and never raises it again until reload. Options adds a per-builder free-play unlock for the four implemented machines and the wrecking ball. Play-time is never shown to the child. The downtown and moon base sites and the other machines in the spec are future work, without code placeholders.

Free play: open the materials tray, spawn materials into the striped bay, choose terrain then tap the ground, and drag the daylight control. Save site stores poses, machines, joints, stamps and daylight. Load saved site restores it after closing the browser. Thumbnail storage is local to the device; the small build snapshot syncs. Maximum simultaneous toys: 64. A full tray explains how to clear room rather than deleting someone's build. Parent unlock or job ten enables the crane's wrecking ball.

## Verification

```sh
node build-crew/tools/physics-tests.mjs
node build-crew/tools/mobile-tests.mjs
node car-jump/tools/spelling-tests.mjs
bash build.sh
```

Install test-only Playwright outside the repo (the game itself needs no installation):

```sh
npm install --prefix /tmp/build-crew-tools playwright@1.58.2
/tmp/build-crew-tools/node_modules/.bin/playwright install --with-deps chromium
export PLAYWRIGHT_MODULE=/tmp/build-crew-tools/node_modules/playwright/index.mjs
export BASE_URL=http://localhost:8080
node build-crew/tools/offline-check.mjs
node build-crew/tools/voice-check.mjs
node build-crew/tools/browser-smoke.mjs
node build-crew/tools/frame-check.mjs
```

`mobile-tests.mjs` is headless (stick curve, interpolation, camera spring, device tier table). `voice-check.mjs` plays the game against a stubbed text-to-speech service and asserts every spoken moment is in the natural voice, never the device voice (set `ASSERT=0` for trace only; pass scenario names to run some). `frame-check.mjs` runs a desktop and a phone profile (390x844, touch, CPU throttled) in the sandbox, and both again on a harbor job and a hillside job. The smoke takes up to 40 minutes and includes phone layout and touch stages. Run the server in another terminal. Without `PLAYWRIGHT_MODULE` the tools fall back to `require('playwright')`. Result files (`physics-results.json`, `browser-results.json`, `offline-results.json`, `frame-results.json` and any failure report) go to `RESULTS_DIR`, which defaults to `<system temp>/build-crew-results` so a run never dirties the repository (see tools/runner.mjs). The smoke saves its screenshots (title, every job and its finished state, sandbox, parent report, iPad, portrait and small landscape) to `SHOTS_DIR`, default `<system temp>/build-crew-shots`; none are committed. `CHROMIUM_PATH` optionally selects an installed browser for the smoke. The smoke uses real WebGL and Rapier; `?test=1` exposes only production axes, action buttons, fixed-step advancement and round loading, and is honored only on `localhost`, `127.0.0.1`, `::1` and `.local` hosts, so it does nothing on the live site. The solver never teleports toys, changes mission checks or awards completion. It drives every available machine and completes all twenty jobs after the loads settle, checking that the scene moves to each job's site. Additional checks cover profiles, PIN/report, free play, save/reload, touch-stick input, keyboard, layout, offline navigation and natural-voice clip preparation through a fake transport.

Run these commands before a PR; there is no CI workflow for Build Crew yet. A physical iPad, gamepad hardware, and production Google TTS remain manual checks. SwiftShader has a 350 ms p95 software-frame ceiling to account for CI runner variance. CPU update p95 must stay below 16.7 ms, with at most 150 draw calls and 120,000 triangles. These checks do not establish physical-device 60 fps.

Voice (0.4): every spoken line is a fixed string (`VOICE_LINES` in `src/content.mjs`, including the touch wording of each hint), made once per voice at builder select. A line whose natural clip cannot be had is silent rather than given to the robot voice; the device voice speaks only when the natural voice is not in use. Hints, toasts and the tray tip are read the first time a builder meets them. Music ducks during speech. The Google key remains in Netlify's environment. Existing shared pings are called, but the current shared stats allowlist does not accept Build Crew; changing another existing game module was outside the authorized files.

`node build-crew/tools/prepare-offline.mjs` refreshes the committed offline list after changing imports. The optional stacking comparison runs with `CANNON_MODULE=file:///absolute/path/to/cannon-es/dist/cannon-es.js node build-crew/tools/stack-compare.mjs`; cannon-es is a test-only external installation.

Bump both VERSION in `src/content.mjs` and the service-worker cache version on releases. Offline caches include all transitive shared imports and the embedded WASM; APIs stay network only and prepared voice clips use the shared voice cache.

See `docs/v0.4-machines.md`, `docs/v0.4-voice.md` and `docs/v0.4-mobile.md` for the 0.4 machines, voice and phone work.

Sites (0.6): the job board lists the jobs site by site. Jobs 11 to 15 are at the harbor (a quay, the water, a moored barge, old dock piles) and 16 to 20 on the hillside (a real 12.5 degree haul slope up to a terrace, a 31 degree rock shoulder, a ravine, mud that slows wheels, grass that loads must stay off). The scene moves between sites without a reload and frees the old site's GPU resources. Machines pitch and roll on slopes, never slide on one they can climb, slow as they climb and stop at anything steeper than their limit. The WL-06 wheel loader (earned at job 16) bends in the middle to steer; I/K lift its bucket on the arms' arc and J/L tilt it. A load that falls in the harbor or rests on the grass goes back to its start; nothing is ever failed. Every job is finished with the four free machines; a builder who owns the Lab's dump truck or forklift finds it in the harbor and pit jobs as an optional extra. `node build-crew/tools/try-round.mjs 16 17` solves jobs headless while developing (`TRACE=1` prints each placement), and `SKIP_JOBS=1 node build-crew/tools/physics-tests.mjs` runs the physics checks without solving every job.

Lab (0.5): Build Crew is the payoff of the Lab (`lab/SPEC.md` section 4.5). Lab coins, earned in every game, buy the DT-04 dump truck, the FL-05 forklift and four blueprint jobs (101 to 104, each with a "Grabs n · par p" or "Height h m · target t m" challenge and never a clock). The Lab loads lazily through `src/meta/labBridge.js`; with `/lab/` missing or blocked the game, all twenty jobs and the sandbox play as before and every Lab item stays hidden (`tools/browser-smoke.mjs` runs that case). In tests (`localhost` only) `window.__lab.grantCoins(n)` and `window.__lab.store.buy('bc.veh.dump')` buy things. `offline.js` has a `SHELL` list and an `OPTIONAL` list for the Lab's modules. See `docs/v0.5-vehicles.md`.
