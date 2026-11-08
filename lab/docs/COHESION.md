# Lab cohesion contract (stage 1 built, stage 2 wires)

The Lab is the thing that holds the six games together. Stage 1 (this folder) built the shared pieces; stage 2 puts them in each game's
`src/meta/labBridge.js` and screens. Everything below is exact: follow it as written. Nothing here needs a game to change its own economy,
saves or engine.

Facade: `import('/lab/src/index.js')` gives `{ lab }`. Every call is safe when anything is off (no Lab, no player, offline), and every UI call is
lazy. Each game's `labBridge.js` should pass these through the same way it passes `hud()` and `results()` (a `lazy()` handle that is usable at
once and mounts when the Lab has loaded).

## 1. The Lab chip (`lab.mountChip`)

```js
const chip = lab.mountChip(container /* Element, optional */, opts /* optional */);
// -> { el, update(), destroy() }       (el is null until the Lab's UI has loaded; the handle works at once)
```

`opts`:

| option | default | meaning |
| --- | --- | --- |
| `game` | the attached game | which game is hosting (`'sj' 'tb' 'ff' 'ww' 'bc' 'cf'`), used to highlight the Games panel and open the Lab from that game |
| `current` | from the page address | override for the highlighted entry in the Games panel (`'lab'`, `'home'` or a game id) |
| `compact` | `false` | the phone variant: smaller avatar and type, no "Games" caption (the grid icon stays, 44 px) |
| `theme` | `'dark'` | `'dark'` or `'light'` colour preset (below) |
| `fixed` | `false` | force the fixed top-left mount even when a container is passed |
| `onOpen` | opens The Lab | replace what a tap on the chip does (a game should not normally pass this) |

`mountChip(opts)` (an options object as the only argument) also works.

What it shows, always the same: the player's Lab avatar (the same render as the Lab room), `Lab LV n`, a thin bar of the level, the Lab coin
icon and the Lab coin balance, and the Lab streak flame with its number. Tap the chip: The Lab opens (`lab.openHome()`). Tap the grid button:
the Games panel. It updates itself on every report, sync, equip, buy and attach. It hides the chip (not the Games button) while no player is
attached, so mount it once per page, not per player.

- **No container**: it is a fixed element, `top: max(8px, env(safe-area-inset-top))`, `left: max(8px, env(safe-area-inset-left))`, `z-index: 9000`
  (below the Lab overlay at 99999, below the Games panel at 100001).
- **With a container**: it is an inline-flex child of that element; position it yourself.
- **Size**: the chip button is at least 44 x 44 px, the Games button is 46 x 44 (44 x 44 compact). Use `compact: true` on phones (width < 520 px).
- **Colour**: CSS variables on the chip element (`.lab-chipx`), so a game can tune them to its theme without touching the Lab:
  `--labchip-bg` (plate), `--labchip-fg` (text), `--labchip-muted`, `--labchip-edge` (border), `--labchip-accent` (coin amount),
  `--labchip-flame`, `--labchip-bar`, `--labchip-bartrack`, `--labchip-shadow`, `--labchip-cv` (behind the avatar). `theme: 'light'` sets a
  white plate with dark text for light game screens; the default is a deep-navy plate with white text for dark ones.
- Taps on the chip never reach the game behind it.

**Where each game mounts it**: the game's home / title screen, top-left corner, one chip per page, `compact` on phones. On screens where the
game already has its own top-left control (a back button, a player name), move that control right by the chip's width (or put the chip in the
header row) rather than hiding the chip. Do not put it inside a play screen (race, wave, trail, build, case): there the existing `lab.hud()` pill
stays as it is.

## 2. The Games nav (`lab.openGames`)

```js
lab.openGames({ current /* optional id */, onClose /* optional */ });
```

A slide-out panel from the left, the same everywhere: Home (`/`), The Lab (`/lab/`), then the six games in this order with their icon and
colour and the player's one-line progress: Spell Jump `/spell-jump/`, Trail Blazer `/trail-blazer/`, Fraction Fright `/fraction-fright/`, Wagon
West `/wagon-west/`, Build Crew `/build-crew/`, Case Files `/case-files/`. Same-origin relative links only. The current entry is highlighted
and says "You are here" (tapping it just closes the panel); it is detected from the page address, `current` is the fallback. The grid button
on the chip calls this; a game never needs to call it itself, but the Lab shell's own top bar also has the button. Escape, the scrim and the
close button shut it. `lab.games` is the list `[{ id, name, path }]` and `lab.paths` the map, if a game wants to draw its own link.

The progress line is `level · line` from `lab.summary` (section 4); a game with no summary yet shows "Try it".

## 3. The picker button (`lab.mountPickerButton`)

```js
const btn = lab.mountPickerButton(container /* Element */, { onOpen /* optional */ });   // -> { el, update(), destroy() }
```

A teal "The Lab" button (flask icon, "Avatar, pet, quests, shop"), 64 px high, drawn in the Lab's own style so it is identical in every game.
Mount it on each game's "Who's playing?" screen, in the same row or block as the family's player buttons, last. A tap opens the Lab's Family
view when a player is picked (`lab.openHome({ view: 'family' })`), else it goes to the Lab page (`/lab/`, where the family picker is).

## 4. Per-game summaries (`lab.summary`)

```js
lab.summary(game, { level: 'Speller LV 3', line: '24 words mastered', today: 'Today: 3 / 8 words', lastPlayed: Date.now() });   // -> true when it changed
```

Stored per player per game in the child's lab doc (`lab.sum[game]`), merged by family sync, so every device shows the same cards. Rules:

- `level` (28 characters), `line` (44) and `today` (44) are plain text. Letters, digits, spaces and `' . , ! : / % + & ( ) -` only; anything else is
  stripped and the text is cut. Any of the three may be empty. `lastPlayed` is a time in ms; leave it out and the Lab uses now.
- Merge: the row with the later `lastPlayed` wins per game (a tie is broken the same way on every device). Calling it with an older `lastPlayed`
  than the stored one changes nothing. Calling it twice with the same text is a no-op.
- Kid rules apply to the text: no "lost", "lives", timers, countdowns, rank numerals (1st, 2nd), "last place", or pressure words. `today` is a
  target ("Today: 3 / 8 words") and never says what is missing or running out. Never include a score someone could feel bad about.
- **When to call it**: once when the game's home or title screen shows for the chosen player (so a child who opens a game sees the Lab update),
  and once after each round, run, race, wave, leg, job or case ends. Not inside a frame loop and not per answer. It needs a player attached
  (`lab.attach(...)` first); before that it returns false.
- The Lab home shows six cards from these (icon, `level`, `line`, `today`, "Played today / yesterday / Last played Tuesday / Last played last week"
  from `lastPlayed`), each card a link to its game; a never-played game shows "Try it" and a one-line pitch. Grown-ups shows the same six cards
  as "Progress at a glance" with the line "Family code: open Parents in any game → Family code".

What each game sends (the nouns keep the six games distinct from the Lab's own "Lab LV"):

| game id | `level` | `line` | `today` |
| --- | --- | --- | --- |
| `sj` Spell Jump | `Speller LV n` (the game's own level) | `24 words mastered` | `Today: 3 / 8 words` (the daily goal) |
| `tb` Trail Blazer | `Rider LV n` | `14 miles ridden` (total distance, "miles") | `Today: 1 / 3 races` (the daily goal, or races today) |
| `ff` Fraction Fright | `Cure LV n`, or `n cured` when the game counts neighbours helped | `32 fractions cured` (gentle mode: `32 neighbors helped`) | `Today: 4 / 10 waves` or the daily goal in its own words |
| `ww` Wagon West | `Trail LV n`, or the leg name when there is no level | `Leg 3 of 9, 420 miles` | `Today: 2 / 5 trail problems` |
| `bc` Build Crew | `Builder LV n` | `12 jobs finished` | `Today: 1 / 2 jobs` |
| `cf` Case Files | `Detective: n cases` | `n cases closed` | `Today's case is open` or `Today's case is done` (a case opens once a day) |

Use each game's own numbers; only the nouns above are fixed. If a game has no daily target, send `today: ''`.

## 5. The Lab coin icon (`lab.coinIcon`)

```js
const svg = lab.coinIcon();        // an SVG string, class "coin lab-coin" (24 x 24 viewBox, scales with font-size or CSS width/height)
const small = lab.coinIcon(18);    // the same with width and height set in px
```

A teal coin with a brass rim and a flask mark. Rules:

- **Lab coins always use this icon, never a "$"** and never a game's own money icon. Every Lab price in a game (Build Crew sells blueprints
  and machines for Lab coins) shows the icon beside the number, and says "Lab coins" in words wherever an amount sits in a sentence
  ("12,000 Lab coins", "Need 400 more Lab coins"). The icon has `role="img"` and `aria-label="Lab coins"`; if you put it in a button whose text
  already says the price, set `aria-hidden="true"` on it or give the button an `aria-label` that says "Lab coins".
- Each game's own money keeps its own name and icon (Spell Jump's coins, Trail Blazer's cash, ...). The two are never added together or shown
  with the same icon. A game screen that shows both should label each ("Cash" and "Lab coins").
- The Lab itself uses the same icon in the purse, the chip, the shop, crates and receipts.

## 6. The one-flame rule

**One flame in a game header = the Lab streak** (the number on the Lab chip). A game's own streak (days played in a row in that game, a
perfect-run streak, a combo) lives only on that game's own panels (its Parents panel, its results screen, its stats) with its own icon or
wording; it never uses the flame glyph in a header or beside the chip. The only other flame is the combo flame in the `lab.hud()` pill during
play, which is not a streak and fades by itself.

## 7. The Case Files shop tab and the item data contract

The shop has a **Case Files** tab of detective looks (owner `cf`). The Lab paints the previews and its own avatar itself; the game draws the
same three slots on its player card.

| slot key | slot | items (id, name, rarity, Lab coins) |
| --- | --- | --- |
| `cf.hat` | Hat | `cf.hat.detcap` Detective cap (common, 300), `cf.hat.deerstalker` Deerstalker (rare, 1,200) |
| `cf.badge` | Badges | `cf.badge.magnifier` Magnifier badge (common, 300), `cf.badge.goldbadge` Gold badge (rare, 1,200) |
| `cf.coat` | Coats | `cf.coat.tweed` Tweed jacket (common, 300), `cf.coat.trench` Trench coat (rare, 1,200) |

- An item is listed and dropped from crates only if its id is in `LOOKS_READY` in `case-files/src/meta/labLooks.js` (all six are).
- `lab.cosmetics('cf')` returns `{ slots: { hat, badge, coat }, owns(id), ready }`; each slot is an item id or `null` (null = the game's own look).
  `lab.cosmeticsOf(playerId, 'cf')` gives another family member's. Case Files stage 2 draws: a cap on the detective portrait for `hat`
  (`detcap` a flat green cap with a short brim, `deerstalker` a tan checked cap with front and back peaks and ear flaps), a small brass or gold
  pin on the lapel for `badge` (`magnifier` a brass magnifier, `goldbadge` a gold shield with a star), and a coat over the shirt for `coat`
  (`tweed` a brown jacket, `trench` a tan belted trench coat). The Lab's own drawing in `lab/src/ui/avatar.js` (`COAT`, `BADGE`, `DETHAT`)
  is the reference for shapes and colours.
- To add a look later: add one row to `TABLE` in `lab/src/data/catalog.js` (slot, tokens by rarity), give the token a name in `NAMES`, add its
  painter to `avatar.js`, and list its id in the game's `LOOKS_READY`.

## 7b. Prices: the game's labLooks is the source of truth

A game that sells coin-only items in the Lab shop (Build Crew's machines and blueprints) exports their prices from its own `labLooks.js`:

```js
export const LOOKS_PRICES = { 'bc.bp.lighthouse': 1800, 'bc.bp.windmill': 2400, 'bc.bp.castlegate': 3000, 'bc.bp.arch': 3400, 'bc.veh.dump': 8000, 'bc.veh.fork': 12000 };
```

The Lab reads it when it loads the module (`lab/src/index.js` and `ui/items.js`) and uses it for the shelf, the Buy button, the price check, `paid` and
the receipt; the game's own job board must read the same object. Common, rare and epic items of the Lab's own (and the rarity-priced looks of
each game) keep the Lab's price table (300 / 1,200 / 3,000), they are not in `LOOKS_PRICES`. Nothing else in `lab/` carries a game's price.
**Known leftover:** `COIN_ONLY` in `lab/src/data/catalog.js` still holds the old Build Crew numbers (2,400 and 3,600 for the blueprints) as a
stand-in used only when a game's `labLooks` exports no price for that item. Build Crew does not export `LOOKS_PRICES` yet; once it does the stand-in
never shows, and the numbers should be deleted from `catalog.js` (give those items `price: 0`).

Shop copy for an item the child cannot afford yet: the price stays in full colour and a line says the gap in words ("130 more Lab coins"); an
item whose slot is level-locked says "Opens at level N" instead.

## 8. Quests: titles, what counts, and the events games must send

Every quest title names its game and what counts. A quest moves only when its **game** sends one of its **events** (`lab.report({ game, event, n, firstTry })`
through the bridge, which fills in `game`). `n` defaults to 1; an answer event carries `firstTry: true` for a right-first-time answer.

| quest id | title (n by Lab level) | game | event(s) that count |
| --- | --- | --- | --- |
| `sj-words` | Spell {n} words in Spell Jump | `sj` | `word` |
| `sj-first` | Spell {n} Spell Jump words on the first try | `sj` | `word` with `firstTry: true` |
| `sj-runs` | Finish {n} Spell Jump runs / Finish a Spell Jump run | `sj` | `run` |
| `sj-perfect` | Stick {n} perfect landings in Spell Jump | `sj` | `perfect` |
| `tb-races` | Finish {n} Trail Blazer races (any place) / Finish a Trail Blazer race (any place) | `tb` | `race` |
| `tb-win` | Win a Trail Blazer race (come in first) | `tb` | `win` (first place only) |
| `tb-facts` | Answer {n} gate facts in Trail Blazer | `tb` | `fact` |
| `ff-zap` | Zap {n} fractions in Fraction Fright (gentle: Help {n} neighbors home in Fraction Fright) | `ff` | `zap` |
| `ff-bull` | Hit {n} bullseyes in Fraction Fright | `ff` | `bull` |
| `ff-waves` | Finish {n} Fraction Fright waves | `ff` | `wave` |
| `ww-leg` | Finish {n} legs of the Wagon West trail | `ww` | `leg` |
| `ww-problems` | Solve {n} trail problems in Wagon West | `ww` | `problem`, `marker` |
| `ww-words` | Spell {n} river or letter words in Wagon West | `ww` | `word` |
| `ww-stars` | Earn {n} stars on the Wagon West trail | `ww` | `star` |
| `bc-job` | Finish {n} Build Crew jobs | `bc` | `job` |
| `bc-pieces` | Deliver {n} blocks in Build Crew | `bc` | `piece` (n = blocks) |
| `bc-challenge` | Meet {n} Build Crew challenges | `bc` | `challenge` |
| `cf-case` | Close {n} Case Files cases / Close a Case Files case | `cf` | `case` |
| `any-explore` | Play {n} different games | any | counts the distinct games that reported at least one event today |

Quest cards also carry a one-line hint where a title needs it (the race quests say "any place counts" and "only coming in first counts").

**Why the playtest's quests stayed at 0** (a full Trail Blazer race, 4th of 4):

1. "Win a race" was `tb-win`, which counts the `win` event. Trail Blazer sends `win` only for a finished race in first place, never in a chase,
   so a 4th-place finish correctly leaves it at 0. The title did not say so. It now reads "Win a Trail Blazer race (come in first)", and the
   separate "Finish a Trail Blazer race (any place)" (`tb-races`, event `race`) counts every finished race.
2. "Finish 2 runs" was `sj-runs`, a **Spell Jump** quest (event `run`, sent only by Spell Jump at the end of a run). A Trail Blazer race never moves
   it. Every title now names its game ("Finish 2 Spell Jump runs").

No quest relies on an event a game does not send: every event in the table above is already reported by its game today (checked in the six
`main.js` / `rounds.js` files). One thing for the Trail Blazer stage-2 agent: `labAfterRace` reports `race` for **every** race that ends,
including one the child quit before the line. The title says "Finish", so send `race` only when `summary.finishCrossed` is true (keep `win`,
`ghostBeat`, `star` and `day` as they are). There is no "Finish in the top 3" quest: it would need a new event
(`lab.report({ event: 'podium' })` from Trail Blazer for a finished, non-chase race in place 1 to 3, plus an exchange-table row and a quest
template); say so if you want it and it will be added with that exact label.

## 9. XP bar and titles

The Lab level bar everywhere shows progress **inside the current level**: fill = XP into the level / XP the level takes, label `258 XP to Lab LV 4`
(`xpBar()` in `core/xp.js`; screen readers get `aria-valuenow` = XP into the level, `aria-valuemax` = the level's span and a text such as
"Lab LV 3: 42 of 300 XP. 258 XP to Lab LV 4"). Every label says **Lab LV** (the chip, the top bar, the pill, the results strip, level-up
banner, player tiles), so it never collides with a game's own `Speller LV`, `Rider LV` and so on. Titles change at Lab levels
1 Cadet, 5 Scout, 10 Ranger, 20 Captain, 30 Pioneer, 40 Inventor, 50 Commander, 65 Master, 80 Legend, 95 Lab Legend.

## 10. Checklist for stage 2

1. `labBridge.js`: add `mountChip`, `mountPickerButton`, `openGames`, `summary`, `coinIcon` as pass-throughs (lazy handles for the two mounts;
   `summary` queued like `report`; `coinIcon` returns `''` until the Lab has loaded, so draw Lab-coin prices after `labBridge.ready`).
2. Mount the chip top-left on the home or title screen, `compact` on phones; mount the picker button on "Who's playing?".
3. Call `summary` as in section 4 with the noun table.
4. Lab-coin prices in a game (Build Crew) use `coinIcon()` and say "Lab coins"; the game's own money keeps its own icon and name.
5. Header flames: only the Lab streak (the chip). Move a game's own streak flame to its own panel.
6. Trail Blazer: gate `race` on `finishCrossed`. Case Files: draw `cf.hat`, `cf.badge`, `cf.coat` on the player card from `lab.cosmetics('cf')`.
7. Games that show text from the Lab (results strip, banner) get "Lab LV" and "Lab coins" automatically; do not re-word them.
