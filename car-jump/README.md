# Spell Jump

A 4th-grade spelling trainer that is a car-jumping game, built as a static web app (PWA) for iPhone Safari with
no build step. Every jump starts with a word spoken aloud and spelled from memory on a big on-screen keyboard;
spelling it right is what gives the car full launch power. Then the car rolls down a giant ramp, flies through
rings that carry the word's letters, flips, lands and smashes props for cash to spend on 6 cars × 4 upgrades
across 20 stages, 3 levels a race (cross the finish line to launch again for ×1.5, then ×2 cash), with 11 cars. No ads, no IAP, no energy timer, no external links.

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
   characters. Add a **Pattern of the week** if the list has one (`ough`, `-tion`, or several for a prefix week: `un- re- pre- mis-`): it is highlighted when a
   word is first shown. Up to 40 words; letters, apostrophes, hyphens and spaces. Tap **Save**. The old list is
   archived and comes back for review 2 and 4 weeks later.
3. **Check speech.** In **Options**, the Speech line says **Speech on** (with the voice it found) or **Speech off**.
   Tap **Test voice** to hear it. If it stays off (mute switch on, no voices installed, or a browser frame without
   sound), the game still works: each word is shown for 3 s and then covered before your child spells it.
   **If the voice is not working**, tap **Run speech check** (sound on): it says "The word is, neighbor." and lists,
   with timestamps, what the browser did (see [Speech check](#speech-check)); **Copy log** copies it for whoever
   helps. **Pick a clear voice** under **Voice**: every English voice on the device is listed, clearest first
   (on-device voices before online ones of the same quality, since they start at once); tap
   **▶ Test** to hear "The word is, neighbor. My neighbor has a dog. Neighbor." in that voice, tap the row to use it.
   **Use default system voice** sets no voice at all and lets the browser choose: try it if a picked voice stays silent.
   On iPhone or iPad, much clearer voices can be downloaded in Settings → Accessibility → Spoken Content → Voices →
   English (choose an Enhanced or Premium voice), then picked here. **Speech rate** is Very slow / Slow / Normal.
   **Natural voices (online)**, at the top of the Voice list, are much clearer than most device voices: once the
   family has a family code (and the site's admin has added the Google key, see [Natural voice](#natural-voice-v34)),
   **Ava** is picked automatically; ▶ **Test** any of them, tap one to use it, or tap a device voice to go back.
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

**This week (v3.7.1).** Parents → Report opens with each child's week on the active list ("This week: 60 % mastered", a bar, and "Right on last try 15 / 18 (83 %) · pretest 6 / 18 → now 15 / 18"; `weekProgress` in `src/spelling/wordStore.js`), and the Family code tab shows a strip per child ("Spelling this week · 60 % mastered"). Parent-facing only, never on the kid's screens.

### Class lists (v3.7)

The weekly spelling list from the class teacher ships inside the game for every family (`src/data/classLists.js`).
A player whose active list is the built-in list or a class list **follows the class lists**: when the game starts
(and after a sync), the newest class list becomes the active list on its own, with a toast "New class list: Week of
Oct 19 · prefixes", and last week's list goes to the archive for review (a new player starts on it at once). A family
that pasted its own list is never switched. **Parents → Words** shows the class list on top ("Class list · Week of
Oct 19 · prefixes · 18 words", the words small) with **Use for Mia** and **Use for everyone**; a player who follows
it sees "Following the class lists ✓" and a **Stop following** link that keeps the words but stops the weekly change.
The applied list has the class list's id on every device, so two devices applying the same week merge into one list.
**Adding a week:** one entry at the top of `WEEKS` in `src/data/classLists.js`: `id: 'class-2026-10-26'`, `name: 'Week
of Oct 26 · topic'`, `weekOf: '2026-10-26'`, an optional `pattern` (`'un- re- pre-'`, `'-tion'`) and the words in the
Parent Zone format, one per line: `word | syl/la/bles | a sentence`. It becomes the newest list two days before its
week starts, so it can ship over the weekend. Since v3.7.4 the class-list file is network-first in the service worker
(like `index.html` and `src/main.js`), so shipping a week needs **no version bump**: the next launch while online shows
it. **Parents → Options → Reload now** forces it on the spot (it saves, asks the worker for a newer version and
reloads); the Options tab also shows the version.

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
Within the same quality, on-device voices (`localService`) rank above online ones: they start at once, while an
online voice can take seconds the first time. **Use default system voice** stores no voice (the utterance gets
`lang = en-US` and no `voice`), so the browser picks.

#### Speech robustness (v3.2.1)

Speech is self-healing and never leaves a silent panel. The rules (all in `src/spelling/tts.js`):

- **Watchdog per utterance.** An utterance that has not fired `onstart` within **5 s** (the session's first utterance,
  and the first one in a newly used voice: Chrome's online voices such as "Google US English" can take 2-5 s to start
  the first time) or **3 s** (afterwards) counts as failed *for that word only*: the word is shown for 3 s ("Look,
  then spell it") and covered, with a small **Hear it** retry next to the message, and the next word tries speech again.
- **Off for the session only after 3 failures in a row.** Then `ready()` answers false at once and automatic speech
  (words, letters) is skipped, so nobody waits on the watchdog; a tap on **Hear it** (or Test voice / ▶ Test / Run
  speech check) re-probes: one attempt, and any utterance that starts turns speech back on.
- **No voices** (`getVoices()` still empty 1.5 s after asking, through `voiceschanged` or polling; some sandboxes
  never list any): the word is shown at once, and the app still tries to say it while it is shown, because some
  browsers speak with their default voice anyway. If that starts, speech is on for the next word.
- **Safari gesture rule.** The first `speak()` must happen inside a tap: `unlock()` runs on the pointerdown of Hear
  it, the retry, the Test buttons, Run speech check, when the spell panel opens and on the first tap anywhere, and
  speaks a very short real word ("ready" at volume 0.01, in the chosen voice, which also warms up a slow online
  voice), not a space. An `onerror` with `not-allowed` means the gesture rule was not met: the next tap unlocks
  again, and the panel shows the one-time hint "Tap Hear it to turn on the voice".
- **Chrome quirks.** Every utterance in flight is kept referenced (`activeUtterances`) until its `onend` /
  `onerror`, since Chrome garbage-collects unreferenced utterances and cuts them off. Before each phrase sequence the
  synth is cancelled, resumed when `paused` (tab switches, iOS interruptions), and cancelled again if `speaking` is
  still true 300 ms later. The word, the sentence and the repeated word stay separate short utterances; text longer
  than 140 characters is split; `onend` that never comes is covered by an estimated-duration timer.

- **Natural voice clips (v3.6.2).** A clip plays through WebAudio (`src/audio.js` `playVoice`). Two iPhone rules:
  on iOS 17+ the first tap sets the page's audio session to **playback** (`navigator.audioSession.type`), so the ring /
  silent switch no longer mutes the clips, the music and the effects while the device voice kept talking; and the
  **audio clock must move** while a clip plays: a context that reports *running* but whose clock stands still (after
  a call, Siri, an output change) is caught within 400 ms, the clip is abandoned (`done(false)`) and the device
  voice says the word; later clips fail at once until the clock moves again. The Speech check prints the audio
  output (state, sample rate, audio session type) and how far the clock moved during the test clip.

The one-time hint "Speech isn't available on this device, so you'll see each word first" (on the spell panel with the
tip about Enhanced / Premium voices on iPhone or iPad) still shows the first time a word falls back. The Qualifier and
Friday Test use the same per-word rule. Speech is cancelled when the panel or test closes and when the app is
hidden. Parents → Options shows **Speech on / off**, the voices found and why it is off (a failed last word, 3 in a
row, or "the browser blocked the voice until a tap").

#### Speech check

Parents → Options → **Run speech check** speaks `"The word is, neighbor."` inside the tap and logs each step with a
time since the tap, for example:

```
Speech check · 10/15/2026, 4:02:11 PM
Spell Jump 3.2.1 · Mozilla/5.0 (iPad; …)
[+0 ms] API present: yes (speechSynthesis: yes, SpeechSynthesisUtterance: yes)
[+1 ms] voices: 61 (24 English, 24 on-device)
[+1 ms] chosen voice: Samantha (Enhanced) · en-US · localService: true
[+1 ms] synth state: speaking false, pending false, paused false · health ok · gesture unlock done
[+2 ms] speak() called: "The word is, neighbor." (onstart watchdog 3000 ms)
[+212 ms] onstart after 210 ms
[+1630 ms] onend after 1628 ms
[+1630 ms] result: speech started, so the voice works here. Heard nothing? Check the volume, the mute switch and Bluetooth audio.
```

It also logs `onerror: <code>` (for example `not-allowed`, `synthesis-failed`, `audio-busy`), `watchdog fired: no
onstart after N ms`, and the last few speech events of the session (failed words, re-probes). The last log stays in
memory until the next check; **Copy log** puts it on the clipboard (or shows it selected when the clipboard is not
available).

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
| `spellJump.family` | `{ v, players: [{id, name, color, createdAt, updatedAt}], pinHash, pinUpdatedAt, options: {playerId: {rate, newPerDay, includeReview, tileCase, wordsPerRace, voiceName, voiceLang, cloudVoice?}}, optionsUpdatedAt: {playerId: ms}, removedPlayers: [id], migrated, lastPlayer }` (rebuilt from the per-player keys if corrupt; `migrated` / `lastPlayer` stay on the device, the rest is shared by family sync) |
| `spellJump.sync` | family sync state (only once a family is created or joined; see "Family sync") |
| `spellJump.cloudVoice` | natural voice clips this device knows: `{ v: 1, clips: { <voice id>: { <text>: <clip id> } } }` (per device, not synced; the MP3s themselves sit in the service worker's `spell-jump-tts-v1` cache) |
| `spellJump.<id>.save` | the full game save (`src/meta/save.js`, schema v2: cash, cars, upgrades, records, goals, settings incl. sound / music / reduced motion / shake, achievements; `resetAt` after a parent reset) |
| `spellJump.<id>.words` | `{ v, lists: [{id, name, createdAt, archivedAt, pattern, sample, words: [{word, syllables, sentence, sayAs?}]}], activeId, records: {word: {box, due, attempts, firstTry, seenCount, lastSeen, daysCorrect, daysSeen, focus, studied, reviewsDone, misses, listId}}, tests: [{kind, listId, at, correct, total, missed}], qualifierPending, today: {date, count, newCount, missionPaid}, streak, bestStreak, perfectTotal, activeAt?, deletedLists?, resetAt? }` (the last three only once used; family sync bookkeeping) |

An existing single-player `rampRage.save.v1` is copied into the first player created (the old key is left alone).

## Parent Zone

Title → **Parents**. First open sets a 4-digit PIN (twice, stored hashed); later it asks for it (it stays open for
5 minutes). **Forgot PIN?**: press and hold for 3 s, answer a 2-digit × 2-digit multiplication, set a new PIN.
Per player:

- **Progress over time (v3.8)**: the Report opens with a chart (2 / 4 / 12 weeks): words mastered (a line), words
  practiced each day (bars) and the share spelled right that day (dashed, right axis), plus a Test scores chart of
  the Qualifiers and Friday Tests. The data is a per-day snapshot the store writes with every spell or test
  (`progress` in `trailBlazer`-style day keys, the last 90 days, synced across devices by per-day max); the mastered
  line before the log began is back-filled from each word's `masteredAt`. The charts are inline SVG from
  `src/ui/chart.js` (no library, no network; Trail Blazer and Fraction Fright import the same module), drawn only
  inside the PIN-locked Parent Zone.

- **Words of the week**: the text area (the one place a native keyboard is used: parents type there; the sheet is
  sized to the visual viewport so the iOS keyboard never hides it), pattern of the week, validation (letters,
  apostrophes, hyphens, spaces; case-insensitive; duplicates removed; max 40 words; syllables that don't spell the
  word are dropped with a note). Save makes a dated list active and archives the previous one (view / restore /
  delete), "Copy this list to <player>".
- **Report**: Qualifier vs latest Friday Test, a per-word table (status New / Focus / Learning / Almost / Mastered,
  attempts, first-try %, last practiced, days practiced), test history, **Copy report** (clipboard, or the text shown
  selected when the clipboard is unavailable), and **Why this works** (the LEARNING-DESIGN table, in the app).
  v3.7.5: a **week picker** on top (This week · each archived week · All words): a past week shows that week's
  report, and **All words** is the running list of every word across every week with its status today (filters All /
  Needs work / Mastered, a word that repeats counted once under the newer week), with **Copy all words**.
- **Options**: speech on / off with **Test voice**, **Speech check** (timestamped log, **Copy log**; it says which
  engine played), speech rate (very slow / slow / normal), voice in two groups: **Natural voices (online)** (six
  Google voices with ▶ Test and a status line) and **Device voices** (Automatic, Use default system voice, or a
  ranked list with ▶ Test), words before each race
  (1-4, default 2), new words per day
  (3 / 5 / 8), past-list review words, tile case (abc / ABC), sound, music, reduced motion, screen shake, reset
  spelling data, reset game save, remove player, change PIN.

Kid-proofing: no external links, no `window.open`, no `alert` / `confirm` / `prompt`; the only native inputs (the
word text area, the pattern field, the shake slider in Options) are inside the PIN-gated Parent Zone. The pause menu
(sound, music, motion, a custom non-input shake slider, End run) has no reset, and only the Parent Zone deletes
anything. "Why this works" is plain text with no links.

## Family sync (v3.2)

By default everything lives on one device. **Parents → Family code** (the first tab, the one the Parent Zone opens
on) puts a family online so the same players,
word lists and progress show up on every device (a laptop for entering the words, an iPad for playing):

1. On the device that has the players: **Create family code**. The code (8 characters like `K7QX-M2PA`, no
   look-alike letters) is shown big, with **Copy**.
2. On each other device: **Join a family** and type the code. The player picker has its own **Parents** button
   (top-right, PIN-gated; the first use sets the PIN), so this works before anyone has typed a name.
   Players from both devices are kept (merged); the joining device adopts the family's parent PIN. A wrong code says
   "That code was not found".
3. From then on it is automatic: a change is uploaded 2 s later; the device checks for changes when the picker
   appears, when the app comes back to the screen, when the device comes back online and every 60 s while open.
   Offline play is never blocked: changes wait (they survive a restart) and go up when the connection returns.
   A line under the Parent Zone title (every tab; tap it to jump to Family code) says *Family code K7QX-M2PA ·
   synced 2 min ago*, *Not synced · tap to set up family sync*, the offline note or the problem. The picker shows a tiny muted *Synced · K7QX-M2PA* chip so you can tell which family a device is in.
4. **Leave family** stops syncing this device; nothing is deleted (the other devices keep the family).

**Trail Blazer on the same code (v3.6.3).** The sync client's key kinds are a registry (`registerSyncKind` in
`src/sync/client.js`): Spell Jump registers `<id>.save` and `<id>.words`; Trail Blazer adds `<id>.tb` (its save) and
`<id>.facts` (its math facts) with its own merge rules (`trail-blazer/src/meta/sync.js`), and the server stores and lists
all four (`GET` answers `players[id] = { save, words, tb, facts }`). Spell Jump keeps Trail Blazer's sync bookkeeping in
`spellJump.sync` untouched and never uploads it, so one family code syncs all four games: when Trail Blazer is used, the
child's Trail Blazer progress (cash, vehicles, medals, gear, math facts) is stored online under the code as well.

**Privacy.** What's stored online: player first names, word lists, spelling progress and the parent PIN (hashed).
No emails or accounts. Anyone with the family code can see and change these, so keep it private. Word lists and
sentences are sent to Google's text-to-speech service to make the voice clips; nothing about the kids is.
A daily anonymous count of devices, runs and races (no names, no ids) tells us the site is being used.

**When two devices changed the same thing** before syncing (`src/sync/merge.js`):

| Data | Rule |
| --- | --- |
| Family record | players = union by id, minus removed players (a removal is a tombstone in `removedPlayers`, so it spreads instead of the player coming back); a player edited on both sides: the later `updatedAt`; PIN: the later `pinUpdatedAt` (on Join: the family's); options: the later `optionsUpdatedAt`, per player |
| Words | lists = union by id minus deleted lists (`deletedLists` tombstones), the same list keeps its later created / archived state; the active list is the one chosen later (`activeAt`); word records: the later `lastSeen` (higher box on a tie); tests = union by date + score; today's mission and the streak from the doc changed later; a spelling reset (`resetAt`) drops older progress |
| Game save | the save changed later wins whole, except cash = the higher amount and owned cars / unlocked tracks = union (also the higher upgrade levels, best distances, records, and every earned badge), so nobody loses a car or a track; a "Reset game save" (`resetAt`) wins |
| v3.3 save fields | XP = the higher; daily streak: the side with the later streak day wins the count (best = the higher, shield days and counted days = union); skins / stickers owned = union, the equipped look from the save changed later; crates earned / opened = the higher of each; trophies and Week Champion lists = union; this week's best jump = the later week, else the farther jump |
| v3.3 word records | `masteredAt` (when a word became Mastered, for the family board) comes with the winning record, or from the other side when the winner is Mastered without one |

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

## Natural voice (v3.4)

Device voices are often hard to understand. The natural voice plays clips made on the server with **Google Cloud
Text-to-Speech** (Neural2 / Studio voices), kept in Netlify Blobs and on each device.

**What the parent sees.** Parents → Options → Voice has two groups. *Natural voices (online)*: Ava · warm female
(`en-US-Neural2-F`), Daniel · calm male (`-Neural2-D`), Clara · bright female (`-Neural2-C`), James · friendly male
(`-Neural2-J`), Olivia · studio female (`en-US-Studio-O`), Quinn · studio male (`-Studio-Q`), each with ▶ Test (asks
the server for the sample presentation in that voice and plays it). *Device voices*: the list from before. Under
the natural voices a status line says *Natural voice ready · 41 clips cached*, *Natural voice not set up on the
server yet (ask the admin to add the Google key)*, *No family code yet: natural voices need family sync* or
*Offline: using the device voice*. The first time a player's device is in a family whose server has the key, Ava is
picked for that player (stored as `cloudVoice` in the player's options, synced like the other options); tapping a
device voice stores `''` (device voice, not picked again automatically).

**What is spoken by clips.** For each word of the active list: "The word is, *word*." / the sentence / "*word*." /
"*word*. *word*." (Say it again) / the syllables; per voice, once: the 26 letters + apostrophe / hyphen / space (a
letter clip is the capital letter, "F", synthesized with SSML `<say-as interpret-as="characters">` so the voice says
"eff": sent as the device-voice spelling "ef" it was read as a word, v3.4),
the sample presentation and "Spell Jump is ready.". The parent's "say as" replaces the word as with the device
voice. Clips are requested when a list is saved, when a natural voice is picked, when a player is selected (only
texts this device has no clip for are sent), and lazily before a word whose clips are missing: the spell panel then
shows "Getting the voice ready…" for at most 3 s. A clip plays at Google's speaking rate 0.92; the Speech rate
setting lengthens the pauses between phrases instead (×1.5 slow, ×2 very slow).

**Fallback.** The natural voice is used when a natural voice is picked AND the device has a family code AND the clip
exists. Any missing clip sends that whole utterance to the device voice; a clip that does not load within 4 s or
does not play (no WebAudio, the audio context not running) sends the rest of it there. The device voice's watchdog
and "off for the session" rules are unchanged and apply only to it. Clips play through the game's WebAudio context
(`src/audio.js`, their own bus into the master), so the music ducks under them as under the device voice. On iPhone
/ iPad, WebAudio (the clips and the game sounds) follows the ring / silent switch. Offline: the service worker
serves every clip played before (cache-first, `/api/tts/clip/*` only, in a cache kept across app updates);
everything else uses the device voice.

**Setup (site admin, once).**

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one) with billing
   enabled. Google's free tier covers about 1 million Neural2 characters a month (Studio voices: far fewer, and
   about 10× the price per character beyond it); check Google's current pricing.
2. **APIs & Services → Library → Cloud Text-to-Speech API → Enable.**
3. **APIs & Services → Credentials → Create credentials → API key.** Edit the key: *API restrictions → Restrict
   key → Cloud Text-to-Speech API* only (the key is only ever used by the Netlify Function, never sent to browsers).
4. In Netlify: **Site configuration → Environment variables → Add a variable**: `GOOGLE_TTS_API_KEY` (recommended
   name) = the key, scope *Functions*. The function also accepts the name `TexttoVoice` (the name it was first
   created under on the live site); when both exist, `GOOGLE_TTS_API_KEY` wins. Redeploy (Deploys → Trigger deploy)
   so the function sees it. Without a key the app keeps the device voice and Options says it is not set up.

**Limits.** The server only makes clips for an existing family code (403 otherwise), only in the six voices above,
at most 80 texts per request and 200 characters per text, and at most **20,000 characters per family per day** (UTC;
already-made clips are free and do not count). Over the cap it answers 429 and new texts use the device voice until
the next day. A clip is content-addressed (`id` = the first 32 hex digits of sha256(voice + "\n" + text)), so the
same text in the same voice is made once for everyone.

### Natural voice API (Netlify Function + Netlify Blobs)

`netlify/functions/tts.mjs` (Functions v2) adapts the Blobs store `tts` (`tts/<id>`: MP3 + metadata `{ voice,
chars }`; `ttsUsage/<CODE>/<yyyy-mm-dd>`: `{ chars }`), the `families` store (is the code real?) and the Google REST
call (`POST https://texttospeech.googleapis.com/v1/text:synthesize?key=…`, `{ input: { text }, voice: { languageCode:
'en-US', name }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.92 } }`) to the pure handler in
`src/tts/server.mjs`.

| Request | Answer |
| --- | --- |
| `GET /api/tts/status` | 200 `{ ok, key: boolean, voices, dailyChars }` (no quota spent; the app's "set up?" check) |
| `POST /api/tts/prepare` `{ code, voice, items: [{ text }] }` | 200 `{ clips: { <text>: '/api/tts/clip/<id>' }, generated, cached, failed, charsToday }`; 400 bad input; 403 unknown family; 503 `{ error: 'no-key' }`; 429 `{ error: 'daily-limit', clips (the ones that exist) }`; 502 when every new clip failed at Google (the key never appears in a message) |
| `GET /api/tts/clip/:id` | 200 `audio/mpeg`, `Cache-Control: public, max-age=31536000, immutable`; 404 unknown |

JSON answers carry `Cache-Control: no-store`. The service worker sends `/api/tts/status` and `/api/tts/prepare` (and
`/api/family`) straight to the network and keeps clips cache-first.

## Usage counter (v3.7.2)

The "lights-on counter" tells us the site is being used, without knowing who uses it. Both games send small anonymous
pings (`src/meta/pings.js`, fire and forget, `fetch` with `keepalive`, errors swallowed) to `POST /api/stats/ping`;
`netlify/functions/stats.mjs` adds them up in the Blobs store `stats`, one JSON doc per UTC day (`day/<yyyy-mm-dd>`):
`{ sj: { devices, runs, tests, lists, versions }, tb: { devices, races, checks, versions }, fams: { sj: [hash], tb: [hash] } }`.
Counts are approximate by design: a write races another one with a conditional set on the ETag, up to 4 tries, then
the ping is dropped. All request handling is in `src/stats/server.mjs` (pure, unit-tested in `tools/spelling-tests.mjs`).

**The ping**, at most 1 KB: `{ game: 'spell-jump' | 'trail-blazer', v: '3.7.2', kind, fam }` → 204 (400 on bad input).

| kind | When |
| --- | --- |
| `day` | the first launch of the UTC day on this device, per game (`localStorage` `learningLab.ping.<game>` holds the day) |
| `run` · `test` · `list` | Spell Jump: a finished run · a Friday test · a list saved or copied, or a class list applied |
| `race` · `check` | Trail Blazer: a finished race · a Pit Crew Check |

`fam` is the first 8 hex digits of SHA-256(family code) when the device is in a family, `''` otherwise; it only lets
the page count "families active" (at most 500 a day per game). **Never sent or stored:** names, player ids, the family
code itself, words, answers, cookies, IP addresses, user agents. No ping leaves `localhost` / `127.0.0.1` unless the
URL has `?pings=1`; `window.__pings` records what would be sent (the ui-smokes check it).

**Reading the counts.** Set the key once in the Netlify UI: Site configuration → Environment variables → Add a
variable → `STATS_KEY` = a long random string (for example `openssl rand -hex 24`), scope Functions, then **redeploy**:
functions pick up a new or changed variable only on their next deploy (Deploys → Trigger deploy, or any push), so the
stats page says "not set up" until then.
Open `https://learninglab.fun/stats/` (linked from nowhere, `noindex`), paste the key (kept in that tab's
sessionStorage only) and tap Load: the last 30 days (devices SJ / TB, runs, races, checks, families active), 7- and
30-day totals, the number of family codes ever created and the version spread. The same as JSON:

```sh
curl -s "https://learninglab.fun/api/stats?key=$STATS_KEY&days=30"
# → { days: [{ day, sj, tb, famsSj, famsTb }], totals: { last7, last30 }, families: { total }, versions, generatedAt }
#   503 { error: 'no-key' } while STATS_KEY is unset · 403 for a wrong key · days 1-90 · Cache-Control: no-store
```

## Coming back every day (v3.3)

Six things that reward practice, never time spent: no lives, no energy, no countdowns, no purchases, no notifications.
Everything is per player, works offline and follows the player through family sync.

1. **Daily streak.** A day counts when the daily mission (8 words) or the Friday Test is finished. The flame next to
   the player's name on the title shows the streak; tapping it opens a month calendar (streak days, shield days,
   today), the best streak and the next milestone ("3 days to a crate"). **Streak shield:** one per week (Monday to
   Sunday) covers one missed day automatically, the next time the child opens the game; the calendar shows it.
   Missing two days in the same week starts a new streak. Milestones (3, 7, 14, 30, 60, 100 days) pay a mystery
   crate; 7 / 14 / 30 days also unlock a sticker / the Rainbow skin / the Streak Flame sticker.
2. **Family board.** Under the player tiles: this week's words mastered, current streak and best jump for every
   player on the device (synced players included), with medals, a crown on the leader's tile and one friendly line
   for the last player ("Mia is 2 words ahead" / "You're in the lead!"). It resets every Monday and is worked out on
   the device; nothing new is sent anywhere.
3. **Mystery crates.** Earned for finishing the daily mission, for streak milestones and for Week Champion. A crate
   drops on the results screen; tap to open: cash (60 %, $300-800 × the car's tier), a sticker (25 %), a car skin
   (12 %) or a jackpot (3 %, triple cash). Every 5th crate in a row without a sticker or skin is guaranteed to be one;
   duplicates roll again, then turn into cash. Unopened crates wait on the title ("1 crate").
4. **Trophies.** When a word becomes Mastered (box 3, three first-try spells on at least two days) the results
   screen celebrates it (WORD MASTERED). The Trophies button on the title shows this week's words as a shelf (gold
   = mastered) and past weeks below. Mastering every word of the week = **Week Champion**: a badge, fireworks, the
   Champion Chrome skin, the Trophy sticker, a crate, +300 XP and a crown on the family board for that week.
5. **Speller levels.** XP for learning only: +20 a first-try word, +8 a fixed word, +15 a right Friday Test word,
   +50 a mastered word, +100 the daily mission, +300 Week Champion. The level, its title ("Word Wrangler") and a
   progress bar sit under the player's name; the picker tiles show "Lv 4". A level-up gets a stamp and a fanfare on
   the results screen; levels 8 / 12 / 16 unlock the Galaxy skin, the Wizard Hat sticker and Solid Gold.
6. **Car style.** The garage has a Style row under the car: skins (paint + decal) and stickers (an emblem on the
   door). Owned ones are in color; locked ones are gray and say how to earn them ("Crate", "7-day streak",
   "Level 8", "Week Champion"). The look is chosen per car and shows in the garage, on the title and in the race.
   Cosmetics are earned, never bought with cash.

### Transfer progress (v3.3)

For a copy of the game that cannot use family sync (for example one opened from a link where the sync service is
blocked): **Parents → Family code → Transfer progress**. *Export* a player to get a code (Copy code), then on the
other device open **Parents → Family code**, paste it under **Import progress** and tap **Import**. A player with the
same name is merged with the same rules as family sync (the higher cash, every car and track, every word's progress,
the higher XP…) and the result says *Merged into Nathan: $12,400, 3 cars, 15 words*; otherwise the player is added
(*Added Nathan*). If the device is in a family, the imported data syncs on. A damaged or incomplete code is refused
with a message and changes nothing. (The code is the player's save and words as gzip-compressed JSON, base64url;
`src/meta/transfer.js`.)

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
`480 × 2.0^(tier−1) × 1.5^level`, cars $13k / $19k / $36k / $88k / $340k at the time), averaged over `--seed-jitter 0 / 0.4 / 0.8`:
first finish ~4 runs, Gravel Fox ~8, Thunderline ~20, Bigfoot Jr. ~41, Vantablack GT ~77, Rhino ~159 (see SPEC.md).
v3.3: the engine now also pays air time and Big Air on landing, which sped the early game up (jitter 0: first finish
run 2, Gravel Fox run 5, Rhino run 103), so Gravel Fox went to $16k and Rhino to $440k: Gravel Fox run 10,
Thunderline 19, Bigfoot Jr. 32, Vantablack GT 55, Rhino 120 (first 400 m finish stays at run 2: that is the track,
not the car prices). Crate cash ($300-800 × tier, about one crate a day) is not simulated.

## Run locally

```sh
cd car-jump
python3 -m http.server 8080      # or: npx serve
```

Open <http://localhost:8080/>. URL flags: `?mock=1` (scripted mock engine, `src/meta/mockEngine.js`: parks until
GAS, flies through one letter ring per letter in order, emits `letterRing` / `wordComplete`), `?nosw=1` (no service
worker). Keyboard on desktop: letters, `'`, `-`, Space, Backspace and Enter (LAUNCH) on the spell keyboard; while
driving:

| Key | Action |
| --- | --- |
| → or Space | GAS (front flip in the air) |
| ← | BRAKE (back flip in the air) |
| ↑ or Shift | NITRO |
| Esc or P | pause |

On a computer (a mouse / trackpad that can hover) or once a key has been pressed, the first-run "How to jump" tips
and the pause menu show these keys too.

### Tests and tools

```sh
node tools/spelling-tests.mjs   # Node unit tests: intervals, mastery (2 distinct days), mission order, new-word cap,
                                # re-queue distance, never twice in a row, archived review at 2 / 4 weeks, parser
                                # edge cases, attempt alignment, word store, report; speech: the 5 s / 3 s onstart
                                # watchdog, off only after 3 failures in a row, re-probe on a tap, the utterance
                                # reference list, stuck-synth re-cancel, not-allowed, unlock, voice ranking (local
                                # before online), system voice, the speech check log; family sync: the server
                                # protocol (create / get / put, rev checks, 409, validation, 512 KB cap) on an
                                # in-memory Map store, family codes, and every merge rule incl. both-changed cases;
                                # natural voice: the server (in-memory stores + fake synthesize: 403, allowlist,
                                # caching by id, 20k/day cap 429, no key 503, the TexttoVoice alias, clip 404 / 200),
                                # the client's texts / batches / status lines, the engine choice + fallback in tts.js;
                                # usage counter: /api/stats validation, counters, family hashes, ETag retry, key checks
node tools/ui-smoke.mjs         # Playwright, 844×390 + 390×844, mock engine + fake speechSynthesis: players, PIN,
                                # word list, Qualifier, every spell-panel path, mission, Friday Test + Mega Run,
                                # report, voices (incl. system default), Run speech check log + Copy log,
                                # persistence; natural voice (fake window.__cloudVoiceBackend): picked on its own,
                                # Options status lines, ▶ Test, Speech check engine, a word by clips only, a missing
                                # clip → device voice + "Getting the voice ready…"; asserts R1 / R2 / R6, key sizes,
                                # layout, no console errors
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
node tools/tts-function-check.mjs   # the real natural-voice function the same way, with fetch stubbed for Google
node tools/stats-function-check.mjs # the real usage-counter function the same way (pings, day doc, key checks)
node tools/economy-sim.mjs --speller 0.75   # headless economy simulation (75 % first-try speller, 8 runs a day)
node tools/make-icons.mjs       # re-renders icons/*.png (a car jumping over letter tiles)
```

`SHOTS_DIR=/some/dir` sets where the Playwright tools write screenshots; `ONLY=landscape|portrait|corrupt|cloud` runs one
part of `ui-smoke.mjs`, `ONLY=landscape|portrait|speech|perf` one part of `integration-smoke.mjs`. `tts.js` uses `window.__ttsBackend` instead of `speechSynthesis` when a test sets it, and `cloudVoice.js` uses `window.__cloudVoiceBackend` (status / prepare / load / play) instead of the network and WebAudio.

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

When you ship changes, bump `VERSION` in `sw.js` (and in `src/main.js`). The app updates itself: `index.html` and
`src/main.js` are network-first, everything else cache-first; the app checks for a new worker whenever it comes back
to the screen; the new worker takes over at once and the page reloads itself once, but only on the picker, the
title, the garage or track select (never during a run, the spell panel, a test or with the Parent Zone open; there
it shows *Update ready, restarting soon* and reloads on the next safe screen, back on the same player). See
`src/meta/selfUpdate.js`.

## File layout

```
car-jump/
  index.html              PWA document: meta tags, inline CSS (design tokens in :root), all screens as DOM
  manifest.webmanifest    name, standalone, landscape, icons
  sw.js                   offline app shell: network-first page + main.js, cache-first rest, versioned (spell-jump-v3.x)
  icons/                  icon-192/512, apple-touch-icon (180), favicon (64), generated by tools/make-icons.mjs
  docs/LEARNING-DESIGN.md the evidence behind every learning mechanic
  vendor/matter.min.js    Matter.js 0.20.0 (physics, used by the engine)
  src/
    main.js               boot: players, saves, audio + speech, engine loading, navigation, spelling flow, runs
    audio.js              WebAudio synth (engine, smashes, music, …, v3: letter click, correct, oops, mission, ducking)
    data/                 cars, tracks, upgrades, rating, cosmetics (skins, stickers, levels, XP, crate odds),
                          classLists (v3.7: the weekly class spelling lists, newest first)
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
      tts.js              speechSynthesis wrapper (voice pick, chunking, unlock, watchdog + health, speech check, test hook)
      keyboard.js         on-screen QWERTY keyboard
      spellPanel.js       Spell to Launch panel (Look-Say-Cover-Write-Check, Cover-Copy-Compare)
      testMode.js         Qualifier / Friday Test screen
      why.js              "Why this works" table (copy of docs/LEARNING-DESIGN.md)
    meta/                 save, economy, goals, achievements, daily, rng, mockEngine,
                          engagement (v3.3 streak / XP / crates / trophies / family board rules, pure),
                          transfer (progress transfer code), pings (the anonymous usage counter, v3.7.2)
    stats/server.mjs      the usage counter API as a pure request handler (used by netlify/functions/stats.mjs)
    ui/                   players (picker + family board), parentZone, garage (+ Style row), tracks, results,
                          panels (badges, streak, trophies), crates (crate opening), HUD, controls, icons,
                          car preview, title hero, fireworks
  dev.html                engine harness (keyboard + on-screen buttons, no meta)
  tools/                  spelling-tests, ui-smoke, engine-smoke, integration-smoke, sync-smoke,
                          sync-function-check, tts-function-check, stats-function-check, economy-sim, make-icons
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
