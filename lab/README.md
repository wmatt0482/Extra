# The Lab

The meta-game across the five Learning Lab games, at `learninglab.fun/lab/` (open it with the trailing slash). One Lab profile per child,
one coin purse, a level bar, an avatar and a pet, three daily quests, a surprise crate, a shop of looks, and a family board and goal.
The design and the build contract are in [SPEC.md](SPEC.md); the games talk to it only through `lab/src/index.js` (the facade) and
their own `src/meta/labBridge.js`.

Static ES modules, no build step. `bash build.sh` copies this folder to `dist/lab/` (the `tools`, `docs`, `SPEC.md` and `package.json`
are left out).

## Layout

- `src/core/*`, `src/data/*`: the pure rules (events and the exchange table, combo, XP and levels, quests, crate, shop, streak, family board and goal, merge). No DOM, no clock, no storage.
- `src/store.js`, `src/sync.js`: the per-device store over `localStorage` and the `lab` sync kind.
- `src/index.js`: the facade a game calls (`attach`, `report`, `hud`, `results`, `cosmetics`, `openHome`, ...). Every call is safe to make when anything is off.
- `src/ui/*`: the page and the overlays (home, quests, crate, shop, me, family, gallery, Grown-ups), the avatar, pet and glyph painters, the HUD pill and the results strip.
- `index.html`, `sw.js`, `manifest.webmanifest`, `icons/*`: the PWA.

## Tests (from the repo root)

```
node lab/tools/core-tests.mjs          # pure core: model, events, combo, xp, quests, crate, shop, streak, family, engine, view
node lab/tools/sync-tests.mjs          # merge laws, transport, store
node lab/tools/rules-audit.mjs         # kid rules over every kid-visible file (EXTRA_PATHS lists the games' Lab files)
node lab/tools/economy-sim.mjs --check # the weekly economy, quests, crate cadence, family goal
python3 -m http.server 8130 --directory . &
BASE_URL=http://localhost:8130 node lab/tools/ui-smoke.mjs     # Playwright, desktop, phone portrait, landscape
BASE_URL=http://localhost:8130 node lab/tools/e2e-cross.mjs    # the cross-game flow against the real games (SPEC 7.4)
```

`SHOTS=<dir>` sets where the screenshots go. `/lab/?labtest` (on localhost) exposes `window.__lab` (`grantCoins`, `setQuests`, `setLooks`,
`advanceDay`, `reset`); `?nosw` skips the service worker; `?player=<id>` opens that player.

## Changelog

- **1.1.0** (service worker `lab-v1.1.0`; the data version `LAB_VERSION` stays 1, nothing in the saved profile changed)
  - "Play N different games" counts the distinct games that reported at least one event today (an answer, a run, a race, a delivered block, a closed case); opening a game or sitting on its title screen does not count. The card now says so. It is read live from today's play (a swap into it, or play from another device, shows at once) and counts across midnight for a session held past it. Note: a Spell Jump Qualifier reports its words when the whole test is finished, so starting one does not move the card until it ends.
  - The Lab modal fits the viewport at every size (the overlay used a grid whose percent height fell back to the content height on short and wide screens): fixed header and nav, the content scrolls inside.
  - Locked Shop items show in full colour with a small lock badge, the price and "Opens at level N". The closed crate and closed slots are no longer greyed.
  - A level-up moment inside the Lab: badge burst, "Level N", the new title and what opened, the shared level-up sound and voice line; reduced motion fades only.
  - Names wrap to two lines instead of truncating (player tiles, top chip, pet name).
- **1.0.1** and earlier: the first releases.
