# Spell Jump

A 4th-grade spelling trainer that is a car-jumping game, built as a static web app (PWA) for iPhone Safari with
no build step. Every jump starts with a word spoken aloud and spelled from memory on a big on-screen keyboard;
spelling it right is what gives the car full launch power. Then the car rolls down a giant ramp, flies through
rings that carry the word's letters, flips, lands and smashes props for cash to spend on 6 cars × 4 upgrades
across 5 stages. No ads, no IAP, no energy timer, no external links.

The learning design (and the evidence behind each mechanic) is in [`docs/LEARNING-DESIGN.md`](docs/LEARNING-DESIGN.md);
the build contract is the "Spelling edition (v3)" section of `SPEC.md`. The pure car game is tagged `ramp-rage-v2`.

## Parent quick start

1. **Add your child.** Open the app, tap **+ New player**, type a name on the big keyboard, pick a car color.
2. **Enter this week's words.** On the title screen tap **Parents**, choose a 4-digit PIN (you type it twice; if
   you forget it, tap "Forgot PIN?", hold the button for 3 s and answer a multiplication). In **Words of the
   week** type one word per line. Optional extras go after the word, separated by ` | `:

   ```
   neighbor | neigh/bor | My neighbor has a dog.
   enough | e/nough
   through | | We walked through the park.
   read | | I read a book yesterday. | red
   ```

   That is word | syllables (slash-separated, shown as breaks on the tiles and read aloud by the **Syllables**
   button) | a sentence (read aloud with the word and when your child taps "Sentence") | **say as**: how the voice
   should pronounce the word, for when it says it wrong (`read | | I read a book yesterday. | red`). The say-as text
   is never shown to your child (the tiles still show "read"); letters, apostrophes, hyphens and spaces, up to 40
   characters. Add a **Pattern of the week** if the list has one (`ough`, `-tion`): it is highlighted when a
   word is first shown. Up to 40 words; letters, apostrophes, hyphens and spaces. Tap **Save**. The old list is
   archived and comes back for review 2 and 4 weeks later.
3. **Check speech.** In **Options**, the Speech line says **Speech on** (with the voice it found) or **Speech off**.
   Tap **Test voice** to hear it. If it stays off (mute switch on, no voices installed, or a browser frame without
   sound), the game still works: each word is shown for 3 s and then covered before your child spells it.
   **Pick a clear voice** under **Voice**: every English voice on the device is listed, clearest first; tap
   **▶ Test** to hear "The word is, neighbor. My neighbor has a dog. Neighbor." in that voice, tap the row to use it.
   On iPhone or iPad, much clearer voices can be downloaded in Settings → Accessibility → Spoken Content → Voices →
   English (choose an Enhanced or Premium voice), then picked here. **Speech rate** is Very slow / Slow / Normal.
4. **Hand it over.** Your child just plays. About 8 words a day (8 to 10 minutes) is the daily mission.

**The weekly cycle.** Day 1: the first **Play** after you save a list is a quick **Qualifier** (pretest): every word
once, by ear. Words your child already knows skip ahead; missed words become **Focus Words** and get most of the
practice. Every day: each run starts with one word to spell from memory; spelling it right on the first try gives
full launch power and a cash bonus, a miss is fixed right away (compare, copy, cover) and the word comes back later.
Thursday or Friday: tap **Friday Test** on the title: all words, no hints, then a **Mega Run** powered by the score.

**What the report means** (Parents → Report). *Pretest* is the Qualifier score for this list; *Latest Friday Test*
is the most recent test: the gap between them is what this week's practice did. Each word has a status: **New**
(not seen yet), **Focus** (missed in the pretest, still being learned), **Learning** (recently missed or just
started), **Almost** (spelled right from memory, waiting for spaced review), **Mastered** (right on the first try at
least 3 times, on at least 2 different days). *1st try* is the share of attempts spelled right before any help;
*Days* is how many different days the word was practiced (spacing matters more than repetitions). **Copy report**
puts it all on the clipboard for a teacher. **Why this works** lists the research behind each part.

## How a week works

1. A parent opens **Parents** (PIN), types this week's words (one per line, optionally
   `neighbor | neigh/bor | My neighbor has a dog.`) and an optional pattern of the week (`ough`, `-tion`).
2. The next **Play** starts with the **Qualifier** (pretest): every word once, audio only, $100 per known word.
   Known words skip ahead (box 2), missed words become **Focus Words**.
3. Every run starts with the **Spell panel**: 2 words back to back by default (**Words before each race** in
   Parents → Options: 1, 2, 3 or 4). The title shows the daily mission, **Today: n / 8 words**; the 8th
   word pays $500 and a "Mission complete" banner, then play continues as free practice.
4. **Friday Test** (title button, any day): all words, no hints. Then one **Mega Run** with launch power
   `60 % + 40 % × score` and $150 per correct word. The parent **Report** shows pretest vs test.

Until a parent saves a list, a 15-word **built-in list** (this week's long-o words, with sentences) is active and labeled on the
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
- **Words before each race** (Parents → Options, per player: 1 / 2 / 3 / 4, default 2, existing players too): the
  panel runs that many words back to back ("Word 1 of 2" on the chip, a short "Next word!" between them) while the
  car stays parked. Each word is recorded on its own (scheduler, mission counter, bonus, streak, re-queue) and a
  missed one still goes through Compare → Copy → Cover. The launch comes from the whole set: with c words right on
  the first try out of n, power = `0.65 + 0.35 × c/n` and nitro = `1 + 0.25 × c/n` (`setLaunch` in
  `wordStore.js`; 1 word gives the 100 % / 125 % vs 65 % / 100 % above), set once after the last word. The letter
  rings carry the missed word (the last missed one if several), else the last word asked; the run is restarted
  while still parked when that differs from the word it was started with. The results **Spelling** row lists every
  word with ✓ (first try) or ↻ (practiced again) and the total bonus. The Qualifier, Friday Test and Mega Run are
  unchanged.

Speech uses the device's `speechSynthesis`. Browser voices clip a short word said on its own, so a word is presented
like a spelling test, as separate utterances with a short pause between them: `"The word is, neighbor."` → the
sentence (if any) → `"neighbor."` (once per word: in Look for a new word, else when Write opens; again on **Hear
it**, which first stops any speech in progress). **Say it again** says `"neighbor. neighbor."` at the slow rate;
**Syllables** (only when the list gives them) says `"neigh, bor."` slowly. A parent's "say as" text replaces the word
in all of these. Rates: normal 0.85, slow 0.6, very slow 0.5; pitch 1.0. The voice is the one picked in Parents →
Options (stored by name + language in that player's options; a device without it uses the default), else the best
ranked English voice: Apple Premium / Enhanced (and Ava, Zoe, Evan, Allison, Samantha, Tom) → Microsoft Natural →
Google US English → other en-US → other English; novelty voices (Fred, Zarvox, Bad News, …, compact, eSpeak) last.
Speech counts
as unavailable for an attempt when the API is missing, when `getVoices()` is still empty 1.5 s after asking
(`voiceschanged` or polling), or when the spoken word has not fired `onstart` 1.5 s after `speak()` (iOS before a
tap, a muted browser frame, a stuck synth). Then the word is shown for 3 s ("Look, then spell it") and covered, with a
one-time hint "Speech isn't available on this device, so you'll see each word first" (on the spell panel only, with
the tip about downloading Enhanced / Premium voices on iPhone or iPad); the Qualifier and Friday Test
do the same per word. The child never waits on a silent panel with no word. Every tap resumes an iOS synth left
`paused`; speech is cancelled when the panel or test closes and when the app is hidden. Parents → Options shows
**Speech on / off** with the number of voices found.

### The learning rules in code

| Rule | Where it is enforced |
| --- | --- |
| R1 word never visible while spelling from memory | `spellPanel.js` / `testMode.js` remove the model tiles from the DOM (`hideModel`) in Write and Cover; the engine draws the letter rings with a `?` and reports `getState().letters.total = 0` until the car is airborne (`debugInfo().lettersRevealed`, `glyphLeaks`); the HUD word strip fills on the `launch` event; tests check the visible text, the canvas text calls and `lettersRevealed` |
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
| `spellJump.family` | `{ v, players: [{id, name, color, createdAt, updatedAt}], pinHash, pinUpdatedAt, options: {playerId: {rate, newPerDay, includeReview, tileCase, wordsPerRace, voiceName, voiceLang}}, optionsUpdatedAt: {playerId: ms}, removedPlayers: [id], migrated, lastPlayer }` (rebuilt from the per-player keys if corrupt; `migrated` / `lastPlayer` stay on the device, the rest is shared by family sync) |
| `spellJump.sync` | family sync state (only once a family is created or joined; see "Family sync") |
| `spellJump.<id>.save` | the full game save (`src/meta/save.js`, schema v2: cash, cars, upgrades, records, goals, settings incl. sound / music / reduced motion / shake, achievements; `resetAt` after a parent reset) |
| `spellJump.<id>.words` | `{ v, lists: [{id, name, createdAt, archivedAt, pattern, sample, words: [{word, syllables, sentence, sayAs?}]}], activeId, records: {word: {box, due, attempts, firstTry, seenCount, lastSeen, daysCorrect, daysSeen, focus, studied, reviewsDone, misses, listId}}, tests: [{kind, listId, at, correct, total, missed}], qualifierPending, today: {date, count, newCount, missionPaid}, streak, bestStreak, perfectTotal, activeAt?, deletedLists?, resetAt? }` (the last three only once used; family sync bookkeeping) |

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
- **Options**: speech rate (very slow / slow / normal), voice (ranked list with ▶ Test), words before each race
  (1-4, default 2), new words per day
  (3 / 5 / 8), past-list review words, tile case (abc / ABC), sound, music, reduced motion, screen shake, reset
  spelling data, reset game save, remove player, change PIN.

Kid-proofing: no external links, no `window.open`, no `alert` / `confirm` / `prompt`; the only native inputs (the
word text area, the pattern field, the shake slider in Options) are inside the PIN-gated Parent Zone. The pause menu
(sound, music, motion, a custom non-input shake slider, End run) has no reset, and only the Parent Zone deletes
anything. "Why this works" is plain text with no links.

## Family sync (v3.2)

By default everything lives on one device. **Parents → Family sync** puts a family online so the same players,
word lists and progress show up on every device (a laptop for entering the words, an iPad for playing):

1. On the device that has the players: **Create family code**. The code (8 characters like `K7QX-M2PA`, no
   look-alike letters) is shown big, with **Copy**.
2. On each other device: **Join a family** and type the code. On a device with no players yet, the Parent Zone is
   reached from the small **Family sync** chip on the player picker (the title's Parents button needs a player).
   Players from both devices are kept (merged); the joining device adopts the family's parent PIN. A wrong code says
   "That code was not found".
3. From then on it is automatic: a change is uploaded 2 s later; the device checks for changes when the picker
   appears, when the app comes back to the screen, when the device comes back online and every 60 s while open.
   Offline play is never blocked: changes wait (they survive a restart) and go up when the connection returns.
   The status line says *Synced as K7QX-M2PA · last sync 2 min ago*, *Offline, will sync when back online*, or the
   problem. The picker shows a tiny muted *Synced · K7QX-M2PA* chip so you can tell which family a device is in.
4. **Leave family** stops syncing this device; nothing is deleted (the other devices keep the family).

**Privacy.** What's stored online: player first names, word lists, spelling progress and the parent PIN (hashed).
No emails or accounts. Anyone with the family code can see and change these, so keep it private.

**When two devices changed the same thing** before syncing (`src/sync/merge.js`):

| Data | Rule |
| --- | --- |
| Family record | players = union by id, minus removed players (a removal is a tombstone in `removedPlayers`, so it spreads instead of the player coming back); a player edited on both sides: the later `updatedAt`; PIN: the later `pinUpdatedAt` (on Join: the family's); options: the later `optionsUpdatedAt`, per player |
| Words | lists = union by id minus deleted lists (`deletedLists` tombstones), the same list keeps its later created / archived state; the active list is the one chosen later (`activeAt`); word records: the later `lastSeen` (higher box on a tie); tests = union by date + score; today's mission and the streak from the doc changed later; a spelling reset (`resetAt`) drops older progress |
| Game save | the save changed later wins whole, except cash = the higher amount and owned cars / unlocked tracks = union (also the higher upgrade levels, best distances, records, and every earned badge), so nobody loses a car or a track; a "Reset game save" (`resetAt`) wins |

**How it works.** Local state is `spellJump.sync` = `{ code, deviceId, keys: { family | <id>.save | <id>.words:
{ rev, updatedAt, dirty, hash } }, lastSync, lastError }`. Each synced key is a server document
`{ rev, updatedAt, deviceId, data }`; a device writes rev + 1 and the server refuses anything else with a 409 that
carries the stored document, which the device merges before retrying once. The current player's data is never
swapped out under a run, a test or the spell panel (the next pull applies it). The service worker never caches
`/api/`.

### Sync API (Netlify Function + Netlify Blobs)

`netlify/functions/family.mjs` (repo root, Functions v2, routes in its `config.path`) adapts a Netlify Blobs store
(`getStore({ name: 'families', consistency: 'strong' })`, keys `<CODE>/family`, `<CODE>/<playerId>.save`,
`<CODE>/<playerId>.words`) to the pure handler in `src/sync/protocol.mjs`. Every response is JSON with
`Cache-Control: no-store`; same origin, no CORS.

| Request | Answer |
| --- | --- |
| `GET /api/family/:code` | 200 `{ family: doc, players: { <id>: { save: doc\|null, words: doc\|null } } }` (removed players are not listed); 404 when there is no such family |
| `POST /api/family/:code` (body: doc with rev 1) | 201 `{ ok, rev, updatedAt }`; 409 when the code exists |
| `PUT /api/family/:code/:key` (key `family`, `<id>.save` or `<id>.words`; body: doc) | 200 `{ ok, rev, updatedAt }` when `rev` = stored rev + 1 (or the key is new and rev = 1); else 409 `{ error: 'conflict', doc: <stored doc\|null> }`; 404 when the family does not exist |
| anything else (`DELETE` included: players are tombstoned) | 405 / 404 |

400 for a code not matching `^[A-Z2-9]{4}-[A-Z2-9]{4}$`, a player id not matching `^[a-z0-9_-]{1,32}$`, a body that
is not `application/json`, not valid JSON, missing `rev` / `updatedAt` / `deviceId` / `data`, or over 512 KB. The
rev check uses Blobs' conditional writes (`onlyIfNew`, `onlyIfMatch: etag`), so two devices racing for the same rev
cannot both win.

Netlify installs the root `package.json` dependencies (`@netlify/blobs`) so the function can be bundled with esbuild;
the Next.js app at the root is not built (`NETLIFY_NEXT_PLUGIN_SKIP`).

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

## Economy

The spelling bonus and the daily mission sit on top of the v2 run economy. `node tools/economy-sim.mjs --speller 0.75`
plays the real engine headlessly as a child who spells 75 % of words right on the first try (bonus, full power) and
fixes the rest (65 % power), 8 runs a day with the $500 mission once a day. Re-tuned for v3 (upgrade cost
`480 × 2.0^(tier−1) × 1.5^level`, cars $13k / $19k / $36k / $88k / $340k), averaged over `--seed-jitter 0 / 0.4 / 0.8`:
first finish ~4 runs, Gravel Fox ~8, Thunderline ~20, Bigfoot Jr. ~41, Vantablack GT ~77, Rhino ~159 (see SPEC.md).

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
                                # edge cases, attempt alignment, word store, report; family sync: the server
                                # protocol (create / get / put, rev checks, 409, validation, 512 KB cap) on an
                                # in-memory Map store, family codes, and every merge rule incl. both-changed cases
node tools/ui-smoke.mjs         # Playwright, 844×390 + 390×844, mock engine + fake speechSynthesis: players, PIN,
                                # word list, Qualifier, every spell-panel path, mission, Friday Test + Mega Run,
                                # report, persistence; asserts R1 / R2 / R6, key sizes, layout, no console errors
node tools/engine-smoke.mjs     # real engine in dev.html (incl. R1: no letter glyph rasterized before launch)
node tools/integration-smoke.mjs  # the full app on the REAL engine with real touches, 844×390 + 390×844: picker →
                                # player → spell paths A (first try, letter rings, bonus) / B (miss → CCC → 65 %,
                                # slower launch) / C (Look), mission $500 once, Parent Zone (PIN, list, wrong PIN,
                                # forgot PIN), Qualifier, Friday Test + Mega Run, report, 2nd player, reload; speech
                                # fallback with speechSynthesis deleted / no voices / never starting; perf at 4x
node tools/sync-smoke.mjs       # family sync end to end: two Playwright contexts ("laptop" 1280×800, "ipad" 1024×768)
                                # whose /api/family requests are answered by ONE in-memory server (the real
                                # protocol handler): create, join, list, cash, offline queue, remove a player,
                                # offline edits on both devices merged with no record lost; screenshots
node tools/sync-function-check.mjs  # the real Netlify Function + @netlify/blobs against Blobs' local server
                                # (needs `npm install` at the repo root)
node tools/economy-sim.mjs --speller 0.75   # headless economy simulation (75 % first-try speller, 8 runs a day)
node tools/make-icons.mjs       # re-renders icons/*.png (a car jumping over letter tiles)
```

`SHOTS_DIR=/some/dir` sets where the Playwright tools write screenshots; `ONLY=landscape|portrait|corrupt` runs one
part of `ui-smoke.mjs`, `ONLY=landscape|portrait|speech|perf` one part of `integration-smoke.mjs`. `tts.js` uses `window.__ttsBackend` instead of `speechSynthesis` when a test sets it.

## Add to the iPhone Home Screen

1. Serve the folder over **HTTPS** (any static host below; Safari requires HTTPS for the service
   worker, except on `localhost`).
2. Open the URL in Safari, tap **Share → Add to Home Screen**.
3. Launch it from the icon: it runs full screen, landscape, with no Safari chrome, and works offline
   after the first load.

Note: iOS mutes WebAudio when the ring/silent switch is on silent.

## Deploy

It is plain static files: upload the `car-jump/` folder as-is to any static host (GitHub Pages,
Netlify, Cloudflare Pages, Vercel, S3 + CloudFront, nginx). No build. The only server code is the optional family
sync function: this repo deploys on Netlify (`netlify.toml` at the repo root publishes `car-jump/` and bundles
`netlify/functions/family.mjs`); on another host the game works as before and Family sync reports that the server
cannot be reached. Make sure
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
    sync/
      client.js           family sync: dirty tracking, debounced push, pull (boot / visible / online / 60 s), join
      merge.js            merge rules for the family record, words and game save (pure)
      codes.js            family code generator / normalizer, device id
      notify.js           local-write hook (profiles.js and save.js call it after every write)
      protocol.mjs        the sync API as a pure request handler (used by netlify/functions/family.mjs)
      tts.js              speechSynthesis wrapper (voice pick, chunking, unlock, letter names, test hook)
      keyboard.js         on-screen QWERTY keyboard
      spellPanel.js       Spell to Launch panel (Look-Say-Cover-Write-Check, Cover-Copy-Compare)
      testMode.js         Qualifier / Friday Test screen
      why.js              "Why this works" table (copy of docs/LEARNING-DESIGN.md)
    meta/                 save, economy, goals, achievements, daily, rng, mockEngine
    ui/                   players (picker + new player), parentZone, garage, tracks, results, panels (badges),
                          HUD, controls, icons, car preview, title hero, fireworks
  dev.html                engine harness (keyboard + on-screen buttons, no meta)
  tools/                  spelling-tests, ui-smoke, engine-smoke, integration-smoke, sync-smoke,
                          sync-function-check, economy-sim, make-icons
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
