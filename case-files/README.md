# Case Files

A detective reading-comprehension game, the newest game in the learninglab.fun family (Spell Jump, Trail Blazer, Fraction Fright, Wagon
West, Build Crew, The Lab). Made for strong 4th-grade readers (about a year ahead, levels selectable). **The reading is the detective
work**: a case can only be solved by reading the documents, pinning the sentence that proves each point, rebuilding the timeline from
memory and writing a one-sentence case report. One new case opens each day; the game never starts the next one by itself.

- Contract: [`SPEC.md`](SPEC.md) (kid rules, site registration, look, screens and flow, data format, save and sync, tests).
- Learning design (technique, evidence, where it lives): [`docs/LEARNING-DESIGN.md`](docs/LEARNING-DESIGN.md).
- Content (written to the SPEC section 5 format by the content agent): `src/content/`, `docs/CONTENT-GUIDE.md`, `docs/SOURCES.md`.

Served at `/case-files/` (a PWA: `sw.js`, cache `case-files-v0.1.0`, manifest, icons). Version **0.1.0**.

## The flow

Picker ("Who's on the case?") → agency home (a cork board: Detective Training, then the Erie Canal folder; closed cases carry a CASE
CLOSED stamp and stay re-readable in the Archive) → a case:

1. **Briefing**: the Chief (voiced) states the objective; 2-3 case words are pre-taught with a tap-the-word task.
2. **Investigate**: the desk of documents; each opens in a reader (silent, a listen button per paragraph with the sentence highlighted;
   "Read it to me" is on by default for the stretch document and, at ranks 1-3, for every document).
3. **Pin evidence**: the partner's notebook asks one question at a time; tap the sentence, then Pin it (it flies to the cork board).
   A wrong tap goes straight to the next hint tier (guiding question, the paragraph lights up, the partner models it); then a "why" line.
4. **Reconstruct**: a half-filled timeline; tap a card then a slot (or drag); a misplaced card slides back with "Check the logbook".
5. **Close the case**: the answer on the in-game keyboard (generous match), attach a pinned clue that proves it, then the sentence-frame
   case report ("___ did it because ___. The clue that proves it is ___.").

Then the CASE CLOSED stamp, the Chief's closing line, a knowledge card, tomorrow's teaser, the flat Lab payout and "See you tomorrow".

Parent Zone (the family's PIN): family code, Detective Rank (1-6, with the approximate level label), "Open the next case now", every case
report the child wrote, first-tap accuracy per standard, hints, listens, words met, and a "Talking with school" card.

## Layout of the code

```
index.html            the shell and all CSS (family look in a detective-agency theme)
src/main.js           boot: family, sync, voice, screens, case lifecycle, Lab
src/content/          the cases (SPEC section 5): index.js exports TRAINING, ARCS, CASE_BY_ID
src/logic/            pure: answers.js (matching), pacing.js (one a day, rank supports), run.js (a case's state and moves),
                      lines.js (fixed partner lines), payout.js (what the Lab is told)
src/meta/             save.js (+ normalize), sync.js (the cf merge), speech.js (natural voice or silence), voiceTexts.js (one case's
                      lines), labBridge.js / labLooks.js (the only Lab files), selfUpdate.js
src/ui/               players, home (+ archive), caseView (the five beats), reader, board, closed, file, parentZone, art
sw.js, manifest.webmanifest, icons/    the PWA
tools/                logic-tests.mjs, ui-smoke.mjs, sync-smoke.mjs, make-icons.mjs, fixtures/ (test copy of the content format)
```

## Tests

Everything runs from the repo root. The browser tests need the dist layout (the shared Spell Jump modules are imported at runtime from
`/spell-jump/src/...`):

```
node case-files/tools/logic-tests.mjs                 # pure logic: answers, pacing, rank supports, save + merge, a whole case, voice, payout
bash build.sh && (cd dist && python3 -m http.server 8741 &)     # remember the PID; kill it by PID when done
BASE_URL=http://localhost:8741 node case-files/tools/ui-smoke.mjs      # Playwright: training + Erie 1, 390x844 and 844x390, offline
BASE_URL=http://localhost:8741 node case-files/tools/sync-smoke.mjs    # two devices on one in-memory sync server
BASE_URL=http://localhost:8741 node case-files/tools/content-play.mjs  # the REAL content: every case played end to end with its own answer key
node case-files/tools/make-icons.mjs                  # regenerates icons/*.png
node case-files/tools/content-tests.mjs               # (content agent) schema, ids, banned words, readability, word counts
```

`content-play.mjs` plays Training and Erie 1-5 on the real content (all six at 390x844, Training + Erie 1 at 844x390; `ALL_LANDSCAPE=1` for all six; `CASE_IDS=erie-03` to pick cases; `SHOTS_DIR=` keeps screenshots): wrong pin and wrong accusation, the proof clue, the report, Case Closed, no horizontal scroll, the kid-rule word audit, the device voice never used.

`ui-smoke.mjs` serves `tools/fixtures/` in place of `src/content/` (a Playwright route), so it does not depend on the final cases.
It mocks the voice backend (`window.__cloudVoiceBackend`, as Spell Jump's test does) and puts a spy on the device voice
(`window.__ttsBackend`): the device voice must never speak. Run browser suites one at a time. `SHOTS_DIR=... ` keeps the screenshots
(deviceScaleFactor 2).

The registration changes also touch Spell Jump's `sync-smoke`, `lab-smoke`, `lab-tests`, `sync-function-check` and the Lab's own
tools (`lab/tools/*`); they must all still pass.

## Save, sync and the Lab

Per player, `caseFiles.<id>.save` (sync kind `cf`): `{ v: 1, rank, opened, closed, nextEarly, wordsMet, updatedAt }` (SPEC section 6).
Merge: union of opened and closed (the earliest `at` wins a case record), max of counters, rank from the later `updatedAt`. The case in
progress is kept device-locally at `caseFiles.<id>.wip` so stopping mid-case loses nothing. Device settings (sound, calm motion) are
`caseFiles.settings`. The Lab gets one flat `case` event per closed case (plus its once-a-day `day`); no per-answer events, no crates.

## Voice

Natural cloud voice only (a clip, or silence), via the shared `cloudVoice` module: a player needs a family code and a natural voice
picked in Spell Jump. Only the current case's lines are prepared. The device voice is never used; with no natural voice the words are
on the screen and the listen buttons stay quiet (with a gentle note). The sound setting silences everything.

## Changelog

### 0.1.0
- First version: Detective Training and the Erie Canal arc, the five-beat case loop, the cork board, the archive, one case a day with
  parent early-open, rank-based supports, Parent Zone v0, the flat Lab payout, family sync kind `cf`, PWA with offline play.
