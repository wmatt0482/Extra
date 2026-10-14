# Spell Jump

A 4th-grade spelling trainer that is a car-jumping game, built as a static web app (PWA) for iPhone Safari with
no build step. Every jump starts with a word spoken aloud and spelled from memory on a big on-screen keyboard;
spelling it right is what gives the car full launch power. Then the car rolls down a giant ramp, flies through
rings that carry the word's letters, flips, lands and smashes props for cash to spend on 6 cars × 4 upgrades
across 5 stages. No ads, no IAP, no energy timer, no external links.

The learning design (and the evidence behind each mechanic) is in [`docs/LEARNING-DESIGN.md`](docs/LEARNING-DESIGN.md);
the build contract is the "Spelling edition (v3)" section of `SPEC.md`. The pure car game is tagged `ramp-rage-v2`.

## How a week works

1. A parent opens **Parents** (PIN), types this week's words (one per line, optionally
   `neighbor | neigh/bor | My neighbor has a dog.`) and an optional pattern of the week (`ough`, `-tion`).
2. The next **Play** starts with the **Qualifier** (pretest): every word once, audio only, $100 per known word.
   Known words skip ahead (box 2), missed words become **Focus Words**.
3. Every run starts with the **Spell panel**. The title shows the daily mission, **Today: n / 8 words**; the 8th
   word pays $500 and a "Mission complete" banner, then play continues as free practice.
4. **Friday Test** (title button, any day): all words, no hints. Then one **Mega Run** with launch power
   `60 % + 40 % × score` and $150 per correct word. The parent **Report** shows pretest vs test.

Until a parent saves a list, a 15-word **Sample list** (with syllables and sentences) is active and labeled on the
title and in the Parent Zone.

## The spell panel ("Spell to Launch")

The run starts with the car parked at the top of the ramp (`game.start` with the word's `letters` and power 1),
the panel over it, the scene dimmed and blurred behind:

- **New word** (or a Focus word not yet studied): Look (4 s: tiles with the pattern chunk highlighted and syllable
  breaks marked while the word is said and spelled) → Cover → Write → Check.
- **First try right**: PERFECT SPELL, bonus `$400 × (1 + 0.1 × streak)` × coinMult (streak = previous consecutive
  first-try words, cap 10), launch power 100 %, nitro 125 %.
- **A miss** → Cover-Copy-Compare: Compare (the attempt with differing positions in red and a gap where a letter is
  missing, the word above in green spelled aloud letter by letter with each tile lighting; the attempt is cleared
  after 2.8 s) → Copy (only the matching next letter is accepted, LAUNCH only on a match) → Cover (from memory).
  Right → 65 % power. Wrong → once more; a second miss goes at 65 % anyway and the word comes back later in the
  session after at least 2 other words.
- Each typed letter is spoken by name; the letter rings say their letter when hit and a whole word in order is
  "WORD COMPLETE". Results gain a **Spelling** row and "Today n / 8".

Speech uses the device's `speechSynthesis` (en-US, a natural voice when present, slow / normal rate). If a device
has none, the panel says so once and shows each word for 3 s before the child spells it.

### The learning rules in code

| Rule | Where it is enforced |
| --- | --- |
| R1 word never visible while spelling from memory | `spellPanel.js` removes the model tiles from the DOM (`hideModel`) in Write and Cover; the HUD word strip is only filled after the panel closes; the scene behind the panel is blurred; tests check the visible text |
| R2 only the child's own misspelling, ≤ 3 s, marked | `diffAttempt` (words.js) marks the attempt; `COMPARE_MS = 2800` then the row is cleared; Copy refuses wrong letters; no multiple choice anywhere |
| R3 every miss corrected by the child | the Cover-Copy-Compare loop in `spellPanel.js` |
| R4 spacing, re-queue, mastery | `scheduler.js`: intervals 0 / 1 / 2 / 4 days, `REQUEUE_GAP = 2`, `isMastered` needs box 3, 3 first-try successes and 2 distinct days |
| R5 ≤ N new words a day, mission ≈ 8 | `buildMission` / `pickNext` cap new words with `today.newCount` (3 / 5 / 8 option), `MISSION_SIZE = 8` |
| R6 letters spoken by name, on device | `keyboard.js` → `tts.sayLetter` on every letter; `tts.spell` for SOS; letter rings call `sayLetter` |

## Players and saves

The first screen is the player picker (up to 4 players, "+ New player" with the on-screen keyboard and a car-color
avatar). Storage (every access in try/catch; a corrupt key is backed up to `<key>.corrupt` and replaced by defaults
without touching other players):

| Key | Contents |
| --- | --- |
| `spellJump.family` | `{ v, players: [{id, name, color, createdAt}], pinHash, options: {playerId: {rate, newPerDay, includeReview, tileCase}}, migrated, lastPlayer }` (rebuilt from the per-player keys if corrupt) |
| `spellJump.<id>.save` | the full game save (`src/meta/save.js`, schema v2: cash, cars, upgrades, records, goals, settings incl. sound / music / reduced motion / shake, achievements) |
| `spellJump.<id>.words` | `{ v, lists: [{id, name, createdAt, archivedAt, pattern, sample, words: [{word, syllables, sentence}]}], activeId, records: {word: {box, due, attempts, firstTry, seenCount, lastSeen, daysCorrect, daysSeen, focus, studied, reviewsDone, misses, listId}}, tests: [{kind, listId, at, correct, total, missed}], qualifierPending, today: {date, count, newCount, missionPaid}, streak, bestStreak, perfectTotal }` |

An existing single-player `rampRage.save.v1` is copied into the first player created (the old key is left alone).

## Parent Zone

Title → **Parents**. First open sets a 4-digit PIN (twice, stored hashed); later it asks for it (it stays open for
5 minutes). **Forgot PIN?**: press and hold for 3 s, answer a 2-digit × 2-digit multiplication, set a new PIN.
Per player:

- **Words of the week**: the text area (the one place a native keyboard is used: parents type there; the sheet is
  sized to the visual viewport so the iOS keyboard never hides it), pattern of the week, validation (letters,
  apostrophes, hyphens, spaces; case-insensitive; duplicates removed; max 40 words; syllables that don't spell the
  word are dropped with a note). Save makes a dated list active and archives the previous one (view / restore /
  delete), "Copy this list to <player>".
- **Report**: Qualifier vs latest Friday Test, a per-word table (status New / Focus / Learning / Almost / Mastered,
  attempts, first-try %, last practiced, days practiced), test history, **Copy report** (clipboard, or the text shown
  selected when the clipboard is unavailable), and **Why this works** (the LEARNING-DESIGN table, in the app).
- **Options**: speech rate, new words per day (3 / 5 / 8), past-list review words, tile case (abc / ABC), sound,
  music, reduced motion, screen shake, reset spelling data, reset game save, remove player, change PIN.

Kid-proofing: no external links, no native text inputs in the kid-facing UI, the pause menu (sound, music, motion,
shake) has no reset, and only the Parent Zone deletes anything.

## Game features (from v2)

Combo chains with a HUD badge, explosions, formations, air targets, kickers, cinematics, a results rating stamp,
fireworks on a new record, and 12 badges. v3 replaced three badges with spelling ones:

| Badge | How |
| --- | --- |
| Head Over Wheels | land your first flip |
| Butter | a perfect landing |
| Triple Threat | 3 flips in one flight |
| **Perfect Speller** | spell a word right on the first try |
| Kaboom | blow up a fuel drum or TNT crate |
| **On a Roll** | 10 words in a row on the first try |
| Ring Collector | fly through 10 gold rings (lifetime) |
| Orbit | fly 45 m above the ground |
| Checkered Flag | cross a finish line |
| **Word Master** | your first Mastered word |
| Full Garage | own all 6 cars (the last one is the **Rhino**) |
| S Rank | an S rating on a run |

Audio is synthesized (WebAudio): v3 adds a soft key click, a bright rising triad for a correct word, a gentle
(not punishing) "oops", and a mission fanfare; music ducks hard and effects soften while the voice speaks.

## Run locally

```sh
cd car-jump
python3 -m http.server 8080      # or: npx serve
```

Open <http://localhost:8080/>. URL flags: `?mock=1` (scripted mock engine, `src/meta/mockEngine.js`: parks until
GAS, flies through one letter ring per letter in order, emits `letterRing` / `wordComplete`), `?nosw=1` (no service
worker). Keyboard on desktop: letters, `'`, `-`, Space, Backspace and Enter (LAUNCH) on the spell keyboard;
← brake, → / Space gas, Shift nitro, Esc / P pause while driving.

### Tests and tools

```sh
node tools/spelling-tests.mjs   # Node unit tests: intervals, mastery (2 distinct days), mission order, new-word cap,
                                # re-queue distance, never twice in a row, archived review at 2 / 4 weeks, parser
                                # edge cases, attempt alignment, word store, report
node tools/ui-smoke.mjs         # Playwright, 844×390 + 390×844, mock engine + fake speechSynthesis: players, PIN,
                                # word list, Qualifier, every spell-panel path, mission, Friday Test + Mega Run,
                                # report, persistence; asserts R1 / R2 / R6, key sizes, layout, no console errors
node tools/engine-smoke.mjs     # real engine in dev.html
node tools/integration-smoke.mjs  # the full app on the real engine
node tools/economy-sim.mjs      # headless economy simulation
node tools/make-icons.mjs       # re-renders icons/*.png (a car jumping over letter tiles)
```

`SHOTS_DIR=/some/dir` sets where the Playwright tools write screenshots; `ONLY=landscape|portrait|corrupt` runs one
part of `ui-smoke.mjs`. `tts.js` uses `window.__ttsBackend` instead of `speechSynthesis` when a test sets it.

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
  sw.js                   cache-first app shell (+ background refresh), versioned (spell-jump-v3.x)
  icons/                  icon-192/512, apple-touch-icon (180), favicon (64), generated by tools/make-icons.mjs
  docs/LEARNING-DESIGN.md the evidence behind every learning mechanic
  vendor/matter.min.js    Matter.js 0.20.0 (physics, used by the engine)
  src/
    main.js               boot: players, saves, audio + speech, engine loading, navigation, spelling flow, runs
    audio.js              WebAudio synth (engine, smashes, music, …, v3: letter click, correct, oops, mission, ducking)
    data/                 cars, tracks, upgrades, rating
    game/                 the physics engine (createGame contract in SPEC.md)
    spelling/
      words.js            list parser, normalizing, pattern / syllable helpers, attempt alignment, sample list
      scheduler.js        Leitner boxes, mastery, mission, free-play pick, re-queue (pure, `now` passed in)
      wordStore.js        per-player spelling data: lists + archive, records, tests, mission, report text
      profiles.js         players, family record, per-player storage keys, PIN, legacy-save migration
      tts.js              speechSynthesis wrapper (voice pick, chunking, unlock, letter names, test hook)
      keyboard.js         on-screen QWERTY keyboard
      spellPanel.js       Spell to Launch panel (Look-Say-Cover-Write-Check, Cover-Copy-Compare)
      testMode.js         Qualifier / Friday Test screen
      why.js              "Why this works" table (copy of docs/LEARNING-DESIGN.md)
    meta/                 save, economy, goals, achievements, daily, rng, mockEngine
    ui/                   players (picker + new player), parentZone, garage, tracks, results, panels (badges),
                          HUD, controls, icons, car preview, title hero, fireworks
  dev.html                engine harness (keyboard + on-screen buttons, no meta)
  tools/                  spelling-tests, ui-smoke, engine-smoke, integration-smoke, economy-sim, make-icons
```

## Wrap as a native App Store build (Capacitor)

1. Install Node and Xcode, plus an Apple Developer account.
2. In a new folder: `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios`.
3. `npx cap init "Spell Jump" com.yourname.spelljump --web-dir=www`, then copy the contents of
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
