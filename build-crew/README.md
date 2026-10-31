# Build Crew

A static 3D toy construction yard for Learning Lab. Ten jobs, a skid steer, an excavator, a crane, and a free-play yard with one save slot per family profile. The thirty-job roadmap is in [SPEC.md](SPEC.md).

From the repository root:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/build-crew/. The existing `spell-jump -> car-jump` symlink supplies the shared modules locally. Netlify's `bash build.sh` copies the correct folders into `dist/`; there is no game package.json or bundler. Three.js 0.170.0 and Rapier 3D compat 0.17.3 (embedded WASM) are pinned in `vendor/`, with licenses and SHA256 hashes. Play does not fetch a CDN.

Drive with WASD; I/K lifts. J/L tilts Pip's bucket, extends Digger's stick or swings Sky's boom. Shift+J/L swings Digger's cab. U/O extends/retracts Sky's boom. Space grabs or releases when the tool is close to a toy, E hops to the nearest other machine, R resets a stuck machine, H sounds the horn, Escape pauses. Machine cards and all extra joints have buttons. Touch sticks and a standard gamepad are supported. Drag to orbit; scroll or pinch to zoom.

The shared Parent Zone uses the existing family PIN, sync and voice picker. Build Crew's Report shows jobs completed and active minutes per day. Options adds a per-builder free-play unlock for the three implemented machines and the wrecking ball. Play-time is never shown to the child. The other sites and machines in the spec are future work, without code placeholders.

Free play: open the toy box, spawn toys into the striped bay, choose terrain then tap the ground, and drag the daylight control. Save my yard stores poses, machines, joints, stamps and daylight. My saved yard restores it after closing the browser. Thumbnail storage is local to the device; the small build snapshot syncs. Maximum simultaneous toys: 64. A full tray explains how to clear room rather than deleting someone's build. Parent unlock or job ten enables the crane's wrecking ball.

## Verification

```sh
node build-crew/tools/physics-tests.mjs
node car-jump/tools/spelling-tests.mjs
bash build.sh
```

Install test-only Playwright outside the repo (the game itself needs no installation):

```sh
npm install --prefix /tmp/build-crew-tools playwright@1.58.2
/tmp/build-crew-tools/node_modules/.bin/playwright install --with-deps chromium
export PLAYWRIGHT_MODULE=/tmp/build-crew-tools/node_modules/playwright/index.mjs
export BASE_URL=http://localhost:8080
node build-crew/tools/browser-smoke.mjs
node build-crew/tools/frame-check.mjs
```

Run the server in another terminal. `CHROMIUM_PATH` optionally selects an installed browser for the smoke. `SHOTS_DIR` changes its screenshot destination. The smoke uses real WebGL and Rapier; `?test=1` exposes only production axes, action buttons, fixed-step advancement and round loading. The solver never teleports toys, changes mission checks or awards completion. It drives every available machine and completes all ten jobs after the loads settle. Additional checks cover profiles, PIN/report, free play, save/reload, touch-stick input, keyboard, layout, offline navigation and natural-voice clip preparation through a fake transport.

`.github/workflows/build-crew.yml` runs these commands on the feature branch before PR creation and uploads evidence. A physical iPad, gamepad hardware, and production Google TTS remain manual checks. SwiftShader has an explicit software-frame threshold; its results do not establish physical-device 60 fps.

Voice preparation follows Wagon West: prepare known lines on player/round changes, await voiceFor before new speech, and duck music during speech. The Google key remains in Netlify's environment. Existing shared pings are called, but the current shared stats allowlist does not accept Build Crew; changing another existing game module was outside the authorized files.

`node build-crew/tools/prepare-offline.mjs` refreshes the committed offline list after changing imports. The optional stacking comparison runs with `CANNON_MODULE=file:///absolute/path/to/cannon-es/dist/cannon-es.js node build-crew/tools/stack-compare.mjs`; cannon-es is a test-only external installation.

Bump both VERSION in `src/content.mjs` and the service-worker cache version on releases. Offline caches include all transitive shared imports and the embedded WASM; APIs stay network only and prepared voice clips use the shared voice cache.
