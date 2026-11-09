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
- `docs/COHESION.md`: the contract for the cohesion round (the Lab chip, the Games panel, the picker button, `lab.summary`, the Lab coin icon, the quest events, the Case Files item data). The games' stage-2 wiring follows it exactly.

## Tests (from the repo root)

```
node lab/tools/core-tests.mjs          # pure core: model, events, combo, xp (the XP bar), quests (titles, events), summaries, crate, shop, streak, family, engine, view
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

- **1.3.0** (service worker `lab-v1.3.0`; the data version `LAB_VERSION` stays 1)
  - Grown-ups → **All games → Background music in all games** (On / Off, behind the PIN, the same switch as Parents → Options in every game): the family-wide
    music switch kept in Spell Jump's family record (`musicOff` + `musicOffAt`, synced, the later change wins). Off: the shared audio module never starts the
    music loop (`Audio.lockMusic`) and stops it at once, also when a sync or another tab brings the change in; effects and the voice stay on. The Lab has no
    music toggle of its own, so there is no button to disable. Test: `tools/ui-smoke.mjs` (Grown-ups; the native-input count is now 5).

- **1.2.0** (service worker `lab-v1.2.0`; the data version `LAB_VERSION` stays 1: the lab doc gained one additive map, `sum`, which an older build simply drops)
  - The Lab holds the six games together: `lab.mountChip(container?, opts)` (the same avatar, "Lab LV n", Lab coins and the Lab streak flame in every game, tap = The Lab), the Games panel (`lab.openGames()`, all six games, The Lab and Home with the current one highlighted), `lab.mountPickerButton(container)` and `lab.summary(game, { level, line, today, lastPlayed })`, kept per child per game and merged by family sync (the later `lastPlayed` wins).
  - The Lab home shows six progress cards (one per game; a game not played yet says "Try it"); Grown-ups shows the same six as "Progress at a glance" with where the family code is.
  - Lab coins have their own coin (teal with a flask, `lab.coinIcon()`), used everywhere in the Lab in place of the gold "$" coin; amounts in text say "Lab coins".
  - The shop has a Case Files tab (detective cap, deerstalker, magnifier and gold badges, tweed and trench coats; `cf.*` items, listed in `case-files/src/meta/labLooks.js`); the Lab avatar wears them.
  - Quest titles name their game and what counts ("Finish a Trail Blazer race (any place)", "Close a Case Files case"). The playtest's "Win a race" counts first place only and "Finish 2 runs" was Spell Jump's.
  - The XP bar is the share of the current level (XP into the level over what it takes) with "N XP to Lab LV M"; every level label says "Lab LV". Titles change at Lab levels 1, 5, 10, 20, 30, 40, 50, 65, 80, 95.
  - A shop item the child cannot afford yet shows the gap in words ("130 more Lab coins"), still in full colour. A game's coin-only prices come from its `labLooks.js` (`LOOKS_PRICES`), see docs/COHESION.md.
  - A lighter, warmer Lab: a sky behind the screens, a warm plaster room with a sunny window, plants and the pet's bed; the panels and the top bar stay deep navy for contrast.

- **1.1.0** (service worker `lab-v1.1.0`; the data version `LAB_VERSION` stays 1, nothing in the saved profile changed)
  - "Play N different games" counts the distinct games that reported at least one event today (an answer, a run, a race, a delivered block, a closed case); opening a game or sitting on its title screen does not count. The card now says so. It is read live from today's play (a swap into it, or play from another device, shows at once) and counts across midnight for a session held past it. Note: a Spell Jump Qualifier reports its words when the whole test is finished, so starting one does not move the card until it ends.
  - The Lab modal fits the viewport at every size (the overlay used a grid whose percent height fell back to the content height on short and wide screens): fixed header and nav, the content scrolls inside.
  - Locked Shop items show in full colour with a small lock badge, the price and "Opens at level N". The closed crate and closed slots are no longer greyed.
  - A level-up moment inside the Lab: badge burst, "Level N", the new title and what opened, the shared level-up sound and voice line; reduced motion fades only.
  - Names wrap to two lines instead of truncating (player tiles, top chip, pet name).
- **1.0.1** and earlier: the first releases.
