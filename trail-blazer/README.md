# Trail Blazer

Learning Lab's second game, at **learninglab.fun/trail-blazer/**. A trail-riding game: the child drives the
**Ranger 150**, a kid-size sage-green side-by-side, over six procedural trails (Pine Ridge, Granite Gap, Lake Loop,
Snow Pass, Desert Wash, Night Ride). Finishing a trail opens the next one; cash from each ride buys Engine, Tires,
Suspension and Boost upgrades (10 levels each); finished trails unlock paints and long rides unlock decals.

**v1 has no math layer yet.** The game is built so the 4th-grade math-facts layer in `SPEC.md` §4-§5 (trail gates
answered on a numpad) can be added later without engine changes: rides start with `gates: 0`, boost fuel comes from
trail coins and good landings, and the Winch (shown when the Ranger is stuck or upside down) is free.

Same house style and kid-proofing as Spell Jump: no external links, no native text inputs outside the Parent Zone,
no ads, no accounts, no timers or lives, works offline after the first load, updates itself on a safe screen, and
plays in landscape or portrait, with touch or a keyboard (→ / Space = GAS, ← = BRAKE, ↑ / Shift = BOOST,
Esc / P = pause, Enter / W = winch when stuck).

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
node trail-blazer/tools/ui-smoke.mjs       # Playwright, both orientations, on the mock engine (serves the repo root itself)
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
- **Options**: sound, music, reduced motion and screen shake for this device; change the PIN.
- **Players**: rename, reset a player's Trail Blazer progress on this device, or remove a player (removes them from
  the family in both games).

Trail Blazer's own progress (cash, upgrades, finished trails, paint) is stored per device in v1
(`trailBlazer.<playerId>.save`); syncing it is a later phase.

## How it is built

- Plain ES modules, no build step; Matter.js (`../spell-jump/vendor/matter.min.js`) for the physics.
- Shared with Spell Jump at runtime, never copied or modified: `spelling/profiles.js` (family, players, PIN),
  `sync/client.js` (family sync), `audio.js` (sound effects and music), `ui/dom.js`, `ui/icons.js`,
  `ui/controls.js` (the multi-touch GAS / BRAKE / BOOST buttons).
- localStorage: `trailBlazer.<playerId>.save` (the save), `trailBlazer.settings` (device settings). The family keys
  (`spellJump.family`, `spellJump.sync`) are only touched through `profiles.js` and the sync client.
- The service worker (`sw.js`) caches the app shell and the shared Spell Jump files it loads; index.html and
  `src/main.js` are network-first, the rest cache-first with a background refresh. Bump `VERSION` on every deploy.

## Files

```
trail-blazer/
  index.html              app shell: every screen and all CSS (forest chrome, blaze-orange accent)
  manifest.webmanifest, sw.js, icons/
  SPEC.md                 the build spec (v1 phasing note at the top; §4-§5 = the later math phase)
  src/main.js             boot, players, screens, the ride lifecycle, winch, pause, sync wiring, self-update
  src/sfx.js              Trail Blazer-only sounds (winch, splash, gate creak)
  src/data/upgrades.js    the 4 upgrades, costs (300 × 1.45^level), resolveStats()
  src/data/paints.js      paints (one per finished trail) and decals (ride-distance milestones)
  src/data/fallbackTrails.js  the 6 trails for the menus if data/trails.js fails to load
  src/data/trails.js      the trails (engine-owned)
  src/game/*              the engine, course, renderer, vehicle art (engine-owned)
  src/meta/save.js        save + device settings, normalize + versioning
  src/meta/economy.js     upgrades, unlock chain, banking a ride, cash rows that add up, paints / decals owned
  src/meta/selfUpdate.js  reload-on-a-safe-screen guard for new versions
  src/meta/mockEngine.js  scripted engine with the same contract (?mock=1, tests, fallback)
  src/ui/players.js       player picker + new player (on-screen keyboard)
  src/ui/keyboard.js      the on-screen keyboard (same as Spell Jump's)
  src/ui/garage.js        upgrades, paint + decal strip, Ranger preview
  src/ui/trails.js        trail select (mini-landscape cards, lock state, best distance)
  src/ui/hud.js           ride HUD (distance + finish bar, cash, speed, boost gauge, banners)
  src/ui/results.js       results (rating, stats, cash rows, unlock callouts)
  src/ui/parentZone.js    Parent Zone (PIN, Family code, Options, Players)
  src/ui/vehiclePreview.js  Ranger previews (the engine's vehicle art, with a built-in fallback)
  src/ui/tbIcons.js       extra icons (tire, winch, trail) on top of Spell Jump's set
  tools/ui-smoke.mjs      UI smoke test; tools/make-icons.mjs icon renderer
```
