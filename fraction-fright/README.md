# Fraction Fright

The third game on [learninglab.fun](https://learninglab.fun/) (after Spell Jump and Trail Blazer): a kid-safe zombie
"shooter" that teaches **fractions as numbers on a number line** (Grade 4, CCSS 4.NF). Lanky, creepy-funny zombies
rise out of the graveyard fog **at their fraction's spot** and shuffle toward the kid's fence, and the road is the
number line. The scout calls a fraction ("three quarters!"); the kid drags along the road and lobs a slime grenade. On
the spot: THUNK, the zombie hiding there is **blasted into goo** (hat, boots and arms fly, the rest melts into a
steaming puddle; cartoon green goo, never blood, never the words kill / die / dead). **Gentle mode** (Parents →
Options) turns that into the 1.0 cure: the zombie turns back into a slightly embarrassed neighbour and walks home.
Off the spot: a plop, and the true spot lights up with the fraction drawn as jumps from 0. No lives, no timers.

`SPEC.md` is the design (§0 holds the non-negotiables from the research); `docs/LEARNING-DESIGN.md` maps every
technique to its source and its code. Version **1.0** = the Zombie Lab, Maple Street and Oak Lane, waves, results, the
yard basics, the Cure Counter, the Parent Zone with the weekly %, family sync, pings and the voice. Version **1.1 "The
Horde"** (SPEC §13) = zombies in the fog at their spot, 2–4 at once with a card stack to call any of them, twins
(two spellings of one number at one spot, one grenade cures both), a boss on every final wave (3 hits, the same number
three ways), the combo, chatter, grenade types, the finale, a yard dog and a gate lantern, and the new cash rows.
Version **1.2 "Critter Stampede"** (SPEC §14) = a bonus round the math earns: after a wave with ≥ 80 % hits (or the
boss cured), ≈ 24 zombie critters (squirrels, raccoons, bunnies, chickens, bats, crows) pour across the yard for about
20 seconds and the kid holds a finger down to spray slime at them (the **Slime Sprayer**, ≈ 12 pellets a second); a hit
pops a critter into goo and a puff of fur or feathers (in Gentle mode it gets a party hat and scampers off), $15 each,
the one **golden critter** $150 instead, a combo popup from ×3.
No timer, countdown, ammo or energy on screen: the round ends when the stampede has passed; a tap on pause ends it with
what was cured. Its cash is a separate "Bonus round" row on the Results (the rows still add up) and a callout
"Critter Stampede: N cured". Parents → Options → **Bonus round** turns it off. The module is `src/game/bonus.js` (its
own canvas `#bonus-stage`, harness `bonus-dev.html`, test `tools/bonus-smoke.mjs`); a missing or broken module only
means no bonus rounds. Version **1.3 "Blast"** (SPEC §15) = zombies are blasted into goo by default, **Gentle mode**
(Parents → Options) keeps the cure. Version **1.4 "Pace Director"** (SPEC §16) = the horde follows the kid: each
throw's think time (the call → the throw) sets how many zombies walk at once and how slowly (about 2.2 × think + 2 s
per zombie; a new player meets one at a time; under 70 % hits the horde thins and slows), zombies dawdle in the last
stretch, a reached fence buys a pause; Parents → Options → **Pace** (Auto · Calm · Quick); Parents → Fractions shows
the measured pace. No clock, bar or pace is ever shown to the kid.

## Run it

Serve the **repo root** (the game imports Spell Jump's shared modules from `/spell-jump/`, the dev symlink to
`car-jump/`) and open `/fraction-fright/`:

```sh
python3 -m http.server 8080          # from the repo root
open http://localhost:8080/fraction-fright/            # the real engine (src/game/engine.js)
open http://localhost:8080/fraction-fright/?mock=1     # the mock engine (src/meta/mockEngine.js)
```

`?nosw=1` skips the service worker. On the site it is deployed by `build.sh` to `dist/fraction-fright/`.

## For parents

- **Parents** (the same PIN as the other games): Family code (one code syncs all three games; a strip per child
  "Fractions this week · N % of the ladder · N % accurate") · **Fractions** ("Where Mia is", the ladder of streets
  with each one's state and aiming zone, play the Zombie Lab again) · Options (fractions aloud; sound, music, motion;
  the voice as set in Spell Jump) · **Report** (this week's %, each street, closest and trickiest fractions, moves,
  this week's waves, play by day, Copy report) · Players (rename, reset skills, reset progress, remove).
- The weekly %: *of the ladder* counts 3 steps per street (started, working, secure); *accurate* is this week's throws
  on target. Parent-facing only, never on the kid's screens.

## How it plays

- **Title**: the yard at dusk, the street of neighbours the kid has cured (one per 10 cures: the Cure Counter, a tally
  board), the fence, the jack-o'-lanterns. DEFEND THE FENCE · LAB · YARD · PARENTS. Before the Lab the big button is the
  Zombie Lab.
- **Zombie Lab** (`src/ui/lab.js`): about a minute; a fraction is a number on the road, cut it into equal jumps, lob at
  ¾ and ⅔, ½ in the same spot on every road, lob at 4/8. +100 XP · Streets open.
- **Streets** (`src/ui/streets.js`): street names on rusted signs; the ★ suggests one, the kid picks among the open ones.
- **A wave**: 5 waves per street (8, 9, 10, 10, 12 zombies, plus the boss on the 5th); 2, 2, 4, 3, 3 live at once;
  the 3rd is the big wave, the 5th the final wave (pays ×2, ends with the finale), then a calm beat plants a
  jack-o'-lantern. Each zombie rises out of the fog at its fraction's spot and is hidden until it has walked 60 % of
  the way; a throw at a zombie already out of the fog is recorded as "seen" (it never counts toward a secure street).
  From wave 2 a twin pair (1/2 and 2/4; 1/3 and 2/6, 2/3 and 4/6) rises at one spot: one grenade cures both. The HUD
  shows the called fraction (big, read aloud, "Hear it"), the other live zombies' fractions as small cards (tap one to
  call it), the COMBO chip from ×2 (consecutive hits; a miss resets it), the street and pause. Nothing else: no timer,
  no bar, no counter. The final wave's boss (Mayor Mumbles on Maple Street, Coach Groan on Oak Lane) takes 3 hits and
  shows its number three ways (3/4 → "three quarters" → ¼+¼+¼); its card shows its name and hits left as dots.
- **Results**: cured, accuracy (mean closeness), bullseyes, best combo, cash rows that add up (cure $120, bullseye
  +$60, close-then-cured +$40, sharpshooter +$50 per cure in the fog, combo +$20 × (combo − 1) per hit from ×2 (capped at ×6), twins
  +$80 per extra cure, boss +$300, final wave ×2), the wave's fractions (twins and the boss marked), the tally board.
- **Yard**: 4 grenade types (slime, lava, frost, disco), 3 goo colours, 3 fences, a yard dog and a gate lantern,
  cosmetics only (never a "scope" that shows ticks); about $35k in all, a few hours of play. More yard items are the next
  runway step.

## How it is built

The app owns the math; the engine (`src/game/*`, the engine agent's) only runs items (SPEC §3 + the header of
`src/game/engine.js`). `main.js` builds each wave's items (`src/skills/items.js`), maps the finger on the road to
`setAim(x01)` using `getState().roadPx`, throws on release, speaks the called item ('target'), records every 'throw'
event in the skills store, plays the engine's 'sound' events through `src/sfx.js`, and computes the cash from the throws
(`src/meta/economy.js`). `?mock=1` (or a broken engine) runs the mock engine, which implements the same contract.

- `src/skills/items.js`: denominators (2, 3, 4, 5, 6, 8, 10, 12, 100), spoken names, items, result bands, PAE,
  "N % close", tolerance steps 10 / 5 / 3 %, waves, the finite set of voice texts.
- `src/skills/ladder.js`: tier states (new / practice / working / secure, the slip), the unlock rule, the ★.
- `src/skills/store.js`: the skills (`fractionFright.<id>.skills`): records, per-fraction stats, days, waves, moves, the
  Lab, opened streets, normalize, the report. `progress.js`: the week's %. `sync.js`: the merge rules.
- `src/meta/save.js` (`fractionFright.<id>.save`, settings), `economy.js` (cash rows, banking a wave, the yard),
  `selfUpdate.js`, `mockEngine.js`; `src/data/streets.js`, `looks.js`.
- `src/ui/`: players (the hoodie-and-goggles avatar), title (the yard scene, the tally), lab, streets, hud, results,
  yard, parentZone.
- Shared at runtime from Spell Jump: profiles (family, players, PIN), the sync client + `registerSyncKind`, tts and the
  natural voice, audio, dom, icons, the on-screen keyboard, pings.

**Family sync**: `<id>.ff` (the save) and `<id>.fracs` (the skills) are kinds registered with Spell Jump's sync client;
the family function (`car-jump/src/sync/protocol.mjs`) stores and lists them. Merge rules (`src/skills/sync.js`): a
reset wins whole; counts max; yard purchases union; records by throw time (the last 12 per street + kind); per
fraction the side with more throws; waves and moves union by time; the Lab and opened streets by the earliest; opts by
the later. **Pings** (anonymous, `meta/pings.js`): 'day', 'wave' after each wave, 'lab' when the Lab ends; counted
under `ff` by the stats function. Privacy: no names or ids leave the device in a ping.

## Tests

```sh
node fraction-fright/tools/skills-tests.mjs   # items, bands, zones, the ladder and unlocks, the store, the week, cash, the yard, merges
node fraction-fright/tools/ui-smoke.mjs       # Playwright, 844×390 + 390×844 on the mock (ONLY=landscape|portrait|real),
                                              # the kid-rule text audit, then one playtest on the real engine
node fraction-fright/tools/sync-smoke.mjs     # two devices on one in-memory family server (car-jump/src/sync/protocol.mjs)
node fraction-fright/tools/engine-smoke.mjs   # the engine agent's
node fraction-fright/tools/make-icons.mjs     # re-renders icons/*.png
```

## Kid rules

No lives, energy, timers or countdowns; no "kill / die / dead" words, no blood; nothing punishes stopping (a stopped
wave keeps its cash); no external links; native text inputs only in the PIN-locked Parent Zone; no streak in this game.
The tone is dry and a bit cheeky ("Zombies incoming. They're mostly harmless."), never babyish, never scary for real.
