# Build Crew — first flight

## 0. Purpose and scope

A quiet construction yard full of heavy toys, built for free play. Depth matters: a beam can bridge a gap, a load can tip, and a crane can reach over a wall. There are no spelling or math gates. Children discover how weight, reach and balance work by moving things.

Name options: **Build Crew** (clear, friendly, working name), **Siteworks** (a direct construction identity), **Heavy Shift** (broader than construction). Keep Build Crew for this flight so URLs and saves stay predictable.

First flight ships one yard, three machines, ten jobs, free play, one yard save per profile, a profile picker, shared Parent Zone, music, voice, effects, celebrations and offline caching. The remaining twenty jobs and additional machines below are design only. No empty machine buttons or unfinished site screens ship.

Kid rules: no lives, energy, timers, countdowns, pressure text or fail screen. Retry and reset blocks are always available. No people in the yard, no violent language or gore, no external links in the game, no multiple choice questions. Controls and creative choices are buttons; native inputs appear only inside the PIN-locked shared Parent Zone. Spoken instructions use the shared natural voice preparation pipeline, with its existing offline device fallback. Stopping is fine. A fallen or misplaced block can always be recovered or reset.

## 1. Machines and controls

Drive with WASD; steer is relative to the chassis. Drag empty world space to orbit the follow camera; wheel or two-finger pinch zooms. Space grabs/releases when the tool is physically near a block. E hops to the nearest other available machine; machine cards also select directly, including when the nearest is inconvenient. R rights the current machine. Escape opens the pause sheet. A one-line contextual hint introduces one control at a time.

Touch: left stick drives, right stick operates the tool, large Grab/Release button, machine cards to hop. Dedicated Swing and Tilt buttons expose joints beyond the right stick's two axes. Keyboard Shift with left/right swings the excavator cab. A connected standard gamepad uses its left/right sticks, A for grab, Y to hop and B to reset; dead zones and disconnect clear the input.

| Machine | Feel and working joints | Tool controls | Release |
|---|---|---|---|
| SS-01, skid steer | Fast turn in place, short reach, no swing joint; physical bucket floor/back/sloped side colliders push and scoop | Up/down or I/K lifts, left/right or J/L tilts | First flight, from start |
| EX-02, excavator | Slower tracks; cab swings independently; boom, stick and curling bucket | Up/down or I/K boom; left/right or J/L stick; Shift+left/right cab; Tilt buttons or U/O bucket | First flight, after job 2 |
| CR-03, mobile crane | Slow heavy carrier; slewing boom; extending reach; hanging magnet | Up/down or I/K hoist; left/right or J/L slew; U/O extends boom | First flight, after job 5 |
| Dump truck | Long stopping distance; tipping bed hauls many loose blocks | Lift tips bed | Later, harbor |
| Forklift | Rear steer, narrow forks need pallet approach; mast lift and tilt | Lift + mast tilt | Later, harbor |
| Wheel loader | Articulated steering, wide high capacity bucket | Lift + tilt | Later, hillside |
| Bulldozer | Steady tracks, wide blade pushes loose fill | Blade raise + angle | Later, hillside |
| Telehandler | Telescoping arm; limited high reach with supported loads | Extend + lift + tilt | Later, downtown |

Drive bodies and tools are position-based kinematic bodies with colliders; toys are dynamic. Tool joints determine the actual pickup point; grabbing requires proximity. A bounded spring applies forces to the held body, so it retains mass and collides with the environment. A skid bucket can also push loose toys without grabbing. Machines remain upright as a deliberate child-friendly assistance. A single held block per tool prevents accidental tangled chains. Reset releases it before recovering the machine.

## 2. Toys and physics

| Toy | Shape and use | Relative mass |
|---|---|---|
| Cube | Rounded-looking painted building block; full cuboid collider | 1 |
| Beam | Long solid piece for spans and walls | 2.3 |
| Slab | Wide shallow piece for floors | 2.8 |
| Pallet | Wood slats on two runners, compound collider with fork space | 1.4 |
| Barrel | Cylinder; rolls and tips | 1.2 |
| SS-01e | Open-looking low-poly tube, solid cylinder collider in this flight | 1.6 |
| Glass | Translucent pane; hard impact becomes harmless glitter and a replacement pane | 0.6 |

Choose **Rapier 3D compat 0.17.3**, vendored with its WASM embedded in the ESM distribution. **Three.js 0.170.0** is also vendored. No runtime CDN, npm, bundler or build step. Retain licenses and hashes in vendor/. Rapier runs the same simulation in Node and browsers. Fixed 1/60 s steps, bounded catch-up, CCD on toys, high friction, damping, extra solver iterations and automatic sleep support stacks. Cannon-es is simpler to load and has no WASM initialization, but its iterative JS solver needs careful stack tuning too. A reproducible headless comparison records both solvers' stack drift; the decision rests on our actual stacking regression. The 20-second eight-cube comparison measured 0.00037 m maximum horizontal drift with Rapier and 0.1434 m with cannon-es (0.20.0). Both retained their height; cannon ran faster in this small fixture. Rapier gave the quieter stack. Damping implementations differ; this is evidence for our settings, not a general ranking. Results and the reproducible script are in docs/stack-comparison.json and tools/stack-compare.mjs. See [Rapier JavaScript guide](https://rapier.rs/docs/user_guides/javascript/getting_started_js/) and [cannon-es source](https://github.com/pmndrs/cannon-es).

Completion checks run on real settled poses. Delivery requires every requested block wholly inside the pad, unheld and slow. Blueprint jobs require a distinct matching block per ghost, close position, upright/appropriate orientation, low velocity and a sustained settled interval. Never count a held load. Lost toys return to their starting spot; glass replacement makes every job recoverable. One button resets blocks and machines without erasing earned progress.

## 3. Thirty jobs

First ten are the playable yard flight. Later rows describe future design and may change after playtesting. Rewards are earned once per job, replay remains available. Round progression is sequential; sandbox is always open with the machines earned so far. A parent can unlock every implemented machine immediately.

| # | Site | Machines | Goal | Twist | Reward |
|---|---|---|---|---|---|
| 1 | Yard | Skid | Move 3 red cubes to the blue pad | Wide pad, learn driving and bucket | Cream paint |
| 2 | Yard | Skid | Move 6 red cubes to the blue pad | More scoops, no rush | Excavator |
| 3 | Yard | Excavator | Place 3 blocks on ghost bases | Reach with boom and stick | Leaf paint |
| 4 | Yard | Excavator | Build a 4-block wall | Two layers, generous placement | Star decal |
| 5 | Yard | Skid, excavator | Build a low bridge | Two supports and a long beam | Crane |
| 6 | Yard | Crane | Place 3 cubes on a raised platform | Only crane reaches the height | Sky paint |
| 7 | Yard | Crane, skid | Move 4 blocks from behind a wall | Slew over the wall | Bell horn |
| 8 | Yard | Excavator | Stack 4 blocks to the flag | Balance and a taller stack | Stripe decal |
| 9 | Yard | Crane, excavator | Build a portal frame | Two legs and a lintel | Sunset paint |
| 10 | Yard | All three | Raise a toy water tower | Four base blocks and a tank slab | Yard badge + wrecking ball |
| 11 | Harbor | Dump truck, skid | Load and deliver 8 blocks | Loose cargo and bed tilt | Dump truck |
| 12 | Harbor | Forklift | Move 3 loaded pallets | Clean approach under runners | Forklift |
| 13 | Harbor | Crane, truck | Deliver cargo across a wall | Handoff between tools | Harbor blue |
| 14 | Harbor | Forklift, crane | Stack warehouse shelves | Slabs on tall supports | Anchor decal |
| 15 | Harbor | Truck, crane | Build a dock | Long beams over water | Ferry horn |
| 16 | Hillside | Wheel loader | Move fill to a ramp | Broad bucket on slopes | Wheel loader |
| 17 | Hillside | Bulldozer | Shape a pass through soil | Blade angle and mud | Bulldozer |
| 18 | Hillside | Excavator, truck | Dig and haul from a second pad | Long haul uphill | Rust paint |
| 19 | Hillside | Loader, crane | Bridge the ravine for a toy car | Unstable supports | Mountain decal |
| 20 | Hillside | All earned | Build the lookout | Sloping ground | Steam horn |
| 21 | Downtown | Telehandler | Deliver slabs to a roof | Limited reach and load balance | Telehandler |
| 22 | Downtown | Crane, forklift | Fit a glass shop front | Gentle placement; glitter resets | Mint paint |
| 23 | Downtown | Truck, loader | Deliver without touching grass | Marked paved route; recoverable | Road decal |
| 24 | Downtown | Excavator, crane | Build a courtyard arch | Narrow working room | Chord horn |
| 25 | Downtown | All earned | Raise the city tower | Multi-stage blueprint | City badge |
| 26 | Moon base | Skid, crane | Build a landing pad | Lower gravity | Moon white |
| 27 | Moon base | Truck, telehandler | Carry pipes over a crater | Rolling cargo | Rocket decal |
| 28 | Moon base | Excavator, crane | Assemble an observatory | Fragile dome; gentle hoist | Space chime |
| 29 | Moon base | Loader, telehandler | Build a rover bridge | Long spans in low gravity | Aurora paint |
| 30 | Moon base | All | Complete the moon base | Combine every skill | All machines + moon badge |

## 4. Sandbox

Open from the title at any time. Spawn tray offers every toy in several colors; pressing a toy button creates it in a clear marked spawn bay. There is unlimited replenishment, with a simultaneous-body cap of 64: explain that a full yard can be cleared or saved, never silently delete someone's build. Clear site asks first: one tap turns the button into "Yes, clear" (it resets itself after four seconds, with no timer shown), a second tap clears. Daylight is a custom button/drag slider, not a native input. Terrain stamps create physical hills, pits, ramps and a shallow blue water area; choose a stamp, then tap the ground to place it. A pit is a recessed terrain patch with edges, not an invisible collider under a painted hole. The water is decorative shallow water with a solid bed.

One **Save site** slot per profile includes toy poses, machine poses and joints, stamps, daylight, and a small rendered thumbnail. **My yard** on the title restores it after closing the tab. Storage failures show a readable message; the previous good save stays intact. A wrecking ball is a heavy colliding sphere on the crane, earned at job 10 or by the parent unlock. Later versions may add more save slots; none are presented as empty placeholders now.

## 5. Look, camera and sound

Construction sandbox for tweens: gravel and weathered steel, industrial amber equipment, tinted cab glass, red framed loads, muted trees and corrugated workshops. A steel fence frames the site. Equipment has hydraulic parts, safety frames, ventilation, lights and unit IDs; no machine faces or character names. Crisp slate control panels use direct job language.

Soft directional shadows and contact discs ground the toys. Instanced blocks and repeated props, low-poly trees, bounded dust, exhaust wisps and pooled tire marks. Future site palettes: harbor uses seafoam, rust-orange cranes and a pale coastal sky; hillside uses sage grass, terracotta soil and amber light; downtown uses warm concrete, coral accents and clear blue; moon base uses lavender dust, indigo sky and an Earth backdrop. These are design stubs only.

No postprocessing. Smooth follow camera with an orbit drag; a gentler wide sweep celebrates a completed job. Reduced motion removes the sweep, particles and camera interpolation. Confetti, a short tune and a useful reward close each job. Controls stay large and readable against the world.

Sound: shared synthesized UI effects, separate low engine tones per machine, hydraulic whine while tools move, collision thunks scaled to impulse, a placement chime. Own Web Audio arrangement of the public-domain melody **The Entertainer (Scott Joplin, 1902)** with plucked synth notes, bass and gentle percussion. It starts only after a gesture, ducks for speech, pauses when hidden and follows the sound/music settings. Natural voice: prepare known job/hint/reward phrases on player pick and round start; await voiceFor before new speech. Use cloud status/default selection exactly as wagon-west does. No API key in source, storage, logs or tests.

## 6. Performance budget

Target physical iPad and modest laptop at 60 fps; actual device validation must be reported separately from SwiftShader. Resolution cap 1.5 DPR, adaptive through 1 / 0.75 / 0.6 DPR after sustained slow wall-frame intervals; shadows 1024² (512² in the lowest tiers), one shadow-casting directional light; ≤64 dynamic toy bodies, ≤3 machines, ≤12 terrain stamps, ≤120 particles and 72 instanced tire marks, ≤150 draw calls and ≤120k triangles. Physics steps are bounded to 3 per rendered frame. Sleeping far toys are left asleep; never cull a body out of an active stack. Release all GPU and WASM resources between jobs.

After the quality controller settles, record median/p95 frame intervals, CPU update cost, render calls and triangles in a repeatable browser test with environment details. SwiftShader is a correctness baseline with a separate 350 ms p95 wall-frame ceiling, calibrated from the observed 150–233 ms runner range. CPU update p95 must remain below 16.7 ms; geometry and draw-call caps apply independently. It cannot certify iPad GPU performance. No unverified 60 fps claim in the PR.

## 7. Saves, shared services, recovery and verification

Shared modules are imported from /spell-jump/src/ at runtime, never copied: profiles/PIN, sync/client and notify, tts/cloudVoice, ui/dom, icons, chart, meta/pings, selfUpdate, engagement, audio effects. Use the shared Parent Zone itself, with an adapter that adds Build Crew report/options to its unlocked Report/Options views. The shared zone retains family sync and voice selection. Build report uses shared dayChart for rounds done and minutes played per local calendar day. The child never sees play-time numbers. Only visible active play counts, with time flushed before pagehide and profile changes.

Save key: buildCrew.<playerId>.save; sync kind **bc**. Completed job IDs and cosmetics union on merge. Per-day counters merge by maximum, consistent with sibling games, so simultaneous play may undercount. The yard snapshot is last writer wins with a deterministic tie break. A newer resetAt wins the entire document. Settings are device local except parent unlock, which belongs to each player's save and follows the later document. Thumbnail stays device-local to keep sync docs small. Siblings' progress and yard slots remain separate. A corrupt save is backed up and replaced safely. localWrite marks every successful save for sync. Mid-job sync is deferred, then refreshed at the title.

Required checks before PR: Node headless Rapier stack/mission/grab/reset tests and merge tests; shared spelling/sync protocol tests; Playwright Chromium with SwiftShader, loading all ten rounds, selecting every available machine, driving a scripted solution through production controls with real physics and asserting settled completion. Test hooks may advance fixed simulation time and inspect poses; they must not teleport toys, change completion flags, or bypass mission checks. Screenshots of every round are inspected and saved to SHOTS_DIR (not committed) for PR attachment. Browser checks cover profile isolation, touch, parent PIN/report, sandbox save/reload, offline reload, console errors and native-input/link audit. Run a frame-time sample. Serve repo root with python3 -m http.server 8080 and BASE_URL=http://localhost:8080. Document exact commands and any unavailable verification.

## 8. Module map and ownership

Single implementation owner: Codex. Existing game folders remain untouched except the expressly authorized sync protocol and its tests. Root/site integration edits are authorized by the brief. No new runtime package.json.

### Module map

| Files | Responsibility |
|---|---|
| SPEC.md | Design and contract; committed separately before code |
| index.html, style.css, icons/*, manifest.webmanifest | Accessible shell, title, HUD, touch UI, install metadata |
| src/main.js | Composer: creates the shared services in order (sync, pings, voice, controls, Parent Zone), wires buttons and page lifecycle, boots physics, scene, title yard, loop and service worker; test hooks |
| src/app/state.js | The shared `app` state, device settings, persist, active-play accounting |
| src/app/title.js | Title, builder profiles and new-builder keyboard, looks, job board, back to title |
| src/app/hud.js | Toasts, hint line, modal sheet, progress and Grab button, machine cards; `MACHINE_UI` table |
| src/app/rounds.js | Yard creation, job start, one physics step with mission check and hints, actions, pause, completion, rewards, celebration |
| src/app/tray.js | Sandbox tray, terrain stamps, daylight slider, wrecking ball, clear site, save site |
| src/app/voice.js | Natural voice: prepareVoice / voiceFor / say, as Wagon West |
| src/app/parent.js | Shared Parent Zone adapter, Build Crew report and options |
| src/app/loop.js | Fixed-step game loop (max 3 steps a frame), one pose read per frame, frame samples |
| src/content.mjs | Ten jobs, toy types, machine metadata, rewards and known spoken phrases |
| src/terrain.mjs | Terrain stamp shapes shared by physics and scene (the hill mound's profile and height, the ramp wedge's corners and faces, recess depths) |
| src/physics.mjs | Rapier world, bodies, fixed step, machines and joints (`MACHINE` table), physical grab/release, terrain, snapshot |
| src/missions.mjs | Pure pose/velocity/ghost matching and settled completion |
| src/scene/scene.js | Scene façade the app uses: renderer, round set-up, per-frame draw, thumbnail, disposal |
| src/scene/kit.js | Shared material cache, unit geometries, box/cylinder/ball helpers, static batching |
| src/scene/environment.js | Site theme (`YARD_THEME`): fog, lights, sky, gravel floor, stamps, scenery features, daylight |
| src/scene/toys.js | Instanced toys and edge frames, pallet slats, pad, ghost outlines, props, job markers |
| src/scene/machines.js | Machine models and per-frame pose (`MACHINE` table), paints, wrecking-ball mesh |
| src/scene/effects.js | Contact discs, tire marks, pooled dust/exhaust/glitter/confetti particles |
| src/scene/camera.js | Overview and follow camera, orbit, zoom, celebration sweep |
| src/scene/quality.js | `BUDGET` caps, the device tier (phone, tablet, desktop), the first-second benchmark and the adaptive pixel-ratio and shadow controller |
| src/scene/interp.js | Interpolation between the last two physics steps for drawing |
| src/controls.js | Keyboard, touch sticks, orbit, pinch and standard gamepad input |
| src/meta/save.mjs, sync.js | Normalization, storage, per-profile history and deterministic merge |
| src/meta/music.js, sound.js | Original arrangement, engine/hydraulic/impact effects with gesture unlock |
| sw.js, offline.js | Versioned offline shell (offline.js is generated by tools/prepare-offline.mjs), shared imports and voice clips; API requests remain network only |
| vendor/* | Pinned unmodified dependencies, licenses and SHA256 manifest |
| tools/* | Headless physics/mission/merge and mobile tests, natural-voice trace (voice-check), browser smoke/perf/screenshots, offline check; runner.mjs finds Playwright and RESULTS_DIR |
| README.md, docs/* | Running, verification, visual QA evidence, implementation assumptions |
| ../car-jump/src/sync/protocol.mjs | Add bc to PLAYER_KINDS, parseKey and API contract message |
| ../car-jump/tools/spelling-tests.mjs | Update kind assertions and bc transport coverage |
| ../build.sh, ../netlify.toml | Static copying, integrity checks, redirect and cache headers |
| ../site/index.html, ../site/why/index.html | Fifth-game entry and honest pure-play description |

**Machine tables.** Each layer keeps one table keyed by machine kind instead of branching on kinds: `MACHINES` in content.mjs (unit ID, label, paint, speed, turn, height and reach ranges, first hint); `MACHINE` in physics.mjs (tool colliders, tool orientation, the joint the right stick's J/L axis drives and its rate, the U/O extend joint, whether it can carry the wrecking ball; the grab point is always `reach` ahead along the boom at the lift height); `MACHINE` in scene/machines.js (wheels or tracks, arm count, bucket or magnet, whether the cab swings, scoop dust, boom lattice, and the pose function for its arms); and `MACHINE_UI` in app/hud.js (tool-stick label, extra joint buttons, card art, release hint). A fourth machine is a row in each of these, its engine pitch in meta/sound.js, and its reward id in the ROUNDS unlocks and save.mjs's reward list.

**Sites.** The scenery is built from a theme object; `YARD_THEME` lists the palette, fog, lights, sky, daylight colors, sign and the ordered scenery features. A second site is a new theme. The environment is built once per page, so switching site between jobs still needs the scene to rebuild its environment when `round.site` changes.

**Offline updates.** sw.js fetches main.js network-first and every other module cache-first. The first load after a deploy can therefore pair a new main.js (and any new module) with older cached modules. Keep the existing modules' exports backward compatible for a release, run tools/prepare-offline.mjs after changing imports, and bump VERSION in sw.js.

Branch: codex/build-crew from claude/extra-v0. Open PR against claude/extra-v0 only after required checks pass. Never push the base branch. PR lists assumptions, exact verification commands, observed performance and limitations, and embeds all ten screenshots.

## Tween visual direction (0.2)

For ages roughly 10–13: industrial slate panels, amber controls, direct job language and equipment identifiers (SS-01, EX-02, CR-03). Machines have tinted cabs, safety frames, hydraulic parts and work lights; no faces or character names. The site uses gravel, steel fencing, loading markings and corrugated workshops. A closer camera puts the player behind the equipment. Keep the open-ended, unhurried rules and readable touch targets. The own synthesized arrangement uses the opening theme of Joplin’s public-domain 1902 composition; score provenance: https://www.loc.gov/item/2023864238/.

## v0.4 (machines, voice, phone)

Three streams, each with a findings note; the look stays the 0.2 tween direction.

- **Machines** (`docs/v0.4-machines.md`): the skid steer, excavator and crawler crane are separate models with their own cab, tracks or wheels, hydraulic cylinders that follow the joints, a sprung body and a merged-mesh budget (96 draw calls in the sandbox with all three). Physics: `SKID_BUCKET` outline with sloped side-plate hull colliders; the skid steer has no swing joint (Shift+J/L no longer orbits its bucket). Reach, height and tilt ranges and the grab-point rule are unchanged.
- **Voice** (`docs/v0.4-voice.md`): the natural voice always, the robot voice never when the natural voice is in use. The spoken set is static in `content.mjs`, prepared at builder select; hints (keyboard and touch wording), toasts and the tray tip are read the first time a builder meets them; the job intro and reward line are read as a job starts and finishes. `tools/voice-check.mjs` traces every spoken moment per scenario and checks the screen strings against the prepared set.
- **Phone** (`docs/v0.4-mobile.md`): a device tier with a cheaper phone render path, interpolated drawing at 60 Hz physics, a damped follow camera, a touch layout under `html.touch` (sticks in the lower corners, one-line top bar, hint strip, side tools and cards, bottom-sheet tray), touch wording for every hint, haptics where available, and a Parent Zone "Picture quality on this device" panel. Phone physics is capped at 2 steps a picture (3 elsewhere, §6). `tools/mobile-tests.mjs`, the smoke's phone stages and `frame-check.mjs`'s phone profile check it. Real-phone frame rates are not measured.

Version 0.4.0: `VERSION` in `src/content.mjs`, cache `build-crew-v0.4.0` in `sw.js`, offline list regenerated for the new `interp.js` module.

## Lab integration (v1) and version 0.5.0

Build Crew is the payoff of the Lab (`lab/SPEC.md` section 4.5; findings, numbers and deviations in `docs/v0.5-vehicles.md`).
`src/meta/labBridge.js` loads `/lab/` lazily and never breaks the game when it is missing or blocked; `src/meta/labLooks.js`
lists what the Lab shop may sell (`LOOKS_READY`) and draws the Lab's paints and decals through the whole-body paint and decal
pipeline. The Lab's coins buy two machines and four blueprints, all new, all hidden without the Lab; nothing already playable
(the ten jobs, the sandbox, SS-01, EX-02, CR-03) is behind it. Machine tables gain a row each: **DT-04 dump truck** (the bed is
the tool: lift tips it, loose blocks ride and pour out, long stopping distance, rear-axle steering) and **FL-05 forklift** (rear
steer about the front axle, mast lift and tilt, narrow tines that only a low, level, centred approach slips under a pallet).
Jobs 101 to 104 (Lighthouse, Windmill, Castle gate, Stone arch) are ghost-outline blueprints with a target and never a clock:
"Grabs n · par p" or "Height h m · target t m", and a "Neat build!" badge when met. Version 0.5.0: `VERSION` in
`src/content.mjs`, cache `build-crew-v0.5.0` in `sw.js`, `offline.js` regenerated with its optional Lab list.
