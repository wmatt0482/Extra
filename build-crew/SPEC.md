# Build Crew — first flight

## 0. Purpose and scope

A quiet construction yard full of heavy toys, built for free play. Depth matters: a beam can bridge a gap, a load can tip, and a crane can reach over a wall. There are no spelling or math gates. Children discover how weight, reach and balance work by moving things.

Name options: **Build Crew** (clear, friendly, working name), **Little Big Yard** (stronger sense of toy scale), **Mighty Makers** (broader than construction). Keep Build Crew for this flight so URLs and saves stay predictable.

First flight ships one yard, three machines, ten jobs, free play, one yard save per profile, a profile picker, shared Parent Zone, music, voice, effects, celebrations and offline caching. The remaining twenty jobs and additional machines below are design only. No empty machine buttons or unfinished site screens ship.

Kid rules: no lives, energy, timers, countdowns, pressure text or fail screen. Retry and reset blocks are always available. No people in the yard, no violent language or gore, no external links in the game, no multiple choice questions. Controls and creative choices are buttons; native inputs appear only inside the PIN-locked shared Parent Zone. Spoken instructions use the shared natural voice preparation pipeline, with its existing offline device fallback. Stopping is fine. A fallen or misplaced block can always be recovered or reset.

## 1. Machines and controls

Drive with WASD; steer is relative to the chassis. Drag empty world space to orbit the follow camera; wheel or two-finger pinch zooms. Space grabs/releases when the tool is physically near a block. E hops to the nearest other available machine; machine cards also select directly, including when the nearest is inconvenient. R rights the current machine. Escape opens the pause sheet. A one-line contextual hint introduces one control at a time.

Touch: left stick drives, right stick operates the tool, large Grab/Release button, machine cards to hop. Dedicated Swing and Tilt buttons expose joints beyond the right stick's two axes. Keyboard Shift with left/right swings the excavator cab. A connected standard gamepad uses its left/right sticks, A for grab, Y to hop and B to reset; dead zones and disconnect clear the input.

| Machine | Feel and working joints | Tool controls | Release |
|---|---|---|---|
| Pip, skid steer | Fast turn in place, short reach; physical bucket floor/back/side colliders push and scoop | Up/down or I/K lifts, left/right or J/L tilts | First flight, from start |
| Digger, excavator | Slower tracks; cab swings independently; boom, stick and curling bucket | Up/down or I/K boom; left/right or J/L stick; Shift+left/right cab; Tilt buttons or U/O bucket | First flight, after job 2 |
| Sky, mobile crane | Slow heavy carrier; slewing boom; extending reach; hanging magnet | Up/down or I/K hoist; left/right or J/L slew; U/O extends boom | First flight, after job 5 |
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
| Pipe | Open-looking low-poly tube, solid cylinder collider in this flight | 1.6 |
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
| 9 | Yard | Crane, excavator | Build a little gateway | Two legs and a lintel | Sunset paint |
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

Open from the title at any time. Spawn tray offers every toy in several colors; pressing a toy button creates it in a clear marked spawn bay. There is unlimited replenishment, with a simultaneous-body cap of 64: explain that a full yard can be cleared or saved, never silently delete someone's build. Daylight is a custom button/drag slider, not a native input. Terrain stamps create physical hills, pits, ramps and a shallow blue water area; choose a stamp, then tap the ground to place it. A pit is a recessed terrain patch with edges, not an invisible collider under a painted hole. The water is decorative shallow water with a solid bed.

One **Save my yard** slot per profile includes toy poses, machine poses and joints, stamps, daylight, and a small rendered thumbnail. **My yard** on the title restores it after closing the tab. Storage failures show a readable message; the previous good save stays intact. A wrecking ball is a heavy colliding sphere on the crane, earned at job 10 or by the parent unlock. Later versions may add more save slots; none are presented as empty placeholders now.

## 5. Look, camera and sound

Toy diorama: warm ochre soil, butter-yellow machines, teal glass, red building toys, sage trees, cream industrial sheds and a peach-blue gradient sky. A fence frames the playable site, distant hills soften the horizon. No people. Machines have expressive windscreen eyes and individual names. Hazard stripes, bolts, buckets and articulated hydraulic arms should read clearly at toy scale.

Soft directional shadows and contact discs ground the toys. Instanced blocks and repeated props, low-poly trees, bounded dust, exhaust wisps and pooled tire marks. Future site palettes: harbor uses seafoam, rust-orange cranes and a pale coastal sky; hillside uses sage grass, terracotta soil and amber light; downtown uses warm concrete, coral accents and clear blue; moon base uses lavender dust, indigo sky and an Earth backdrop. These are design stubs only.

No postprocessing. Smooth follow camera with an orbit drag; a gentler wide sweep celebrates a completed job. Reduced motion removes the sweep, particles and camera interpolation. Confetti, a little tune and a useful reward close each job. Controls stay large and readable against the world.

Sound: shared synthesized UI effects, separate low engine tones per machine, hydraulic whine while tools move, collision thunks scaled to impulse, a placement chime. Own Web Audio arrangement of the public-domain melody **Frère Jacques** with marimba-like notes, bass and gentle percussion. It starts only after a gesture, ducks for speech, pauses when hidden and follows the sound/music settings. Natural voice: prepare known job/hint/reward phrases on player pick and round start; await voiceFor before new speech. Use cloud status/default selection exactly as wagon-west does. No API key in source, storage, logs or tests.

## 6. Performance budget

Target physical iPad and modest laptop at 60 fps; actual device validation must be reported separately from SwiftShader. Resolution cap 1.5 DPR, adaptive toward 1 DPR when render cost is high; shadows 1024², one shadow-casting directional light; ≤64 dynamic toy bodies, ≤3 machines, ≤12 terrain stamps, ≤120 pooled particles/marks, ≤150 draw calls and ≤120k triangles. Physics steps are bounded to 3 per rendered frame. Sleeping far toys are left asleep; never cull a body out of an active stack. Release all GPU and WASM resources between jobs.

Record median/p95 frame intervals, CPU update cost, render calls and triangles in a repeatable browser test with environment details. SwiftShader is a correctness baseline and has a separate generous wall-frame threshold; it cannot certify iPad GPU performance. No unverified 60 fps claim in the PR.

## 7. Saves, shared services, recovery and verification

Shared modules are imported from /spell-jump/src/ at runtime, never copied: profiles/PIN, sync/client and notify, tts/cloudVoice, ui/dom, icons, chart, meta/pings, selfUpdate, engagement, audio effects. Use the shared Parent Zone itself, with an adapter that adds Build Crew report/options to its unlocked Report/Options views. The shared zone retains family sync and voice selection. Build report uses shared dayChart for rounds done and minutes played per local calendar day. The child never sees play-time numbers. Only visible active play counts, with time flushed before pagehide and profile changes.

Save key: buildCrew.<playerId>.save; sync kind **bc**. Completed job IDs and cosmetics union on merge. Per-day counters merge by maximum, consistent with sibling games, so simultaneous play may undercount. The yard snapshot is last writer wins with a deterministic tie break. A newer resetAt wins the entire document. Settings are device local except parent unlock, which belongs to each player's save and follows the later document. Thumbnail stays device-local to keep sync docs small. Siblings' progress and yard slots remain separate. A corrupt save is backed up and replaced safely. localWrite marks every successful save for sync. Mid-job sync is deferred, then refreshed at the title.

Required checks before PR: Node headless Rapier stack/mission/grab/reset tests and merge tests; shared spelling/sync protocol tests; Playwright Chromium with SwiftShader, loading all ten rounds, selecting every available machine, driving a scripted solution through production controls with real physics and asserting settled completion. Test hooks may advance fixed simulation time and inspect poses; they must not teleport toys, change completion flags, or bypass mission checks. Screenshots of every round are inspected and committed under docs/screenshots for PR attachment. Browser checks cover profile isolation, touch, parent PIN/report, sandbox save/reload, offline reload, console errors and native-input/link audit. Run a frame-time sample. Serve repo root with python3 -m http.server 8080 and BASE_URL=http://localhost:8080. Document exact commands and any unavailable verification.

## 8. Module map and ownership

Single implementation owner: Codex. Existing game folders remain untouched except the expressly authorized sync protocol and its tests. Root/site integration edits are authorized by the brief. No new runtime package.json.

| Files | Responsibility |
|---|---|
| SPEC.md | Design and contract; committed separately before code |
| index.html, style.css, icons/*, manifest.webmanifest | Accessible shell, title, HUD, touch UI, install metadata |
| src/main.js | App lifecycle, shared adapters, prepared speech, profiles, Parent Zone extension, navigation |
| src/content.mjs | Ten jobs, toy types, machine metadata, rewards and known spoken phrases |
| src/physics.mjs | Rapier init/world, bodies, fixed step, machines/joints, physical grab/release, terrain, snapshot |
| src/missions.mjs | Pure pose/velocity/ghost matching and settled completion |
| src/scene.js | Three renderer, diorama, instancing, articulated machine meshes, camera, particles, disposal |
| src/controls.js | Keyboard, touch sticks, orbit, pinch and standard gamepad input |
| src/meta/save.mjs, sync.js | Normalization, storage, per-profile history and deterministic merge |
| src/meta/music.js, sound.js | Original arrangement, engine/hydraulic/impact effects with gesture unlock |
| sw.js | Versioned offline shell, shared imports and voice clips; API requests remain network only |
| vendor/* | Pinned unmodified dependencies, licenses and SHA256 manifest |
| tools/* | Headless physics/mission/merge tests, browser smoke/perf/screenshots, icon generation |
| README.md, docs/* | Running, verification, visual QA evidence, implementation assumptions |
| ../car-jump/src/sync/protocol.mjs | Add bc to PLAYER_KINDS, parseKey and API contract message |
| ../car-jump/tools/spelling-tests.mjs | Update kind assertions and bc transport coverage |
| ../.github/workflows/build-crew.yml | Linux Chromium/SwiftShader checks when local macOS execution is restricted |
| ../build.sh, ../netlify.toml | Static copying, integrity checks, redirect and cache headers |
| ../site/index.html, ../site/why/index.html | Fifth-game entry and honest pure-play description |

Branch: codex/build-crew from claude/extra-v0. Open PR against claude/extra-v0 only after required checks pass. Never push the base branch. PR lists assumptions, exact verification commands, observed performance and limitations, and embeds all ten screenshots.
