# Case Files: build contract (v0.1 MVP)

A detective reading-comprehension game for the learninglab.fun family (Spell Jump, Trail Blazer, Fraction Fright,
Wagon West, Build Crew, The Lab). Audience: Matt's 4th graders, one reading around F&P level U (about a year ahead),
levels selectable. Research basis: `reports/Detective reading game research.md` at the repo root (read its plan section;
`case-files/docs/LEARNING-DESIGN.md` will condense it).

Core idea: **the reading is the detective work.** A case can only be solved by reading the documents, pinning the sentence
that proves each point, rebuilding the timeline from memory, and writing a one-sentence case report.

## 1. Kid rules (non-negotiable, same as every game here)

- No visible timers, countdowns, pressure text ("hurry", "only N left", "don't lose"), lives, energy or fail states.
  Nothing punishes stopping. No "kill / die / dead / lost / lives / gun / blood"; writers use "missing", "misplaced".
- No authored wrong answers on screen, ever. No multiple choice. "Tap the sentence that proves it" is allowed because every
  tappable option is a true sentence from the case document.
- No external links. Native `<input>`/`<textarea>` only inside the PIN-locked Parent Zone; kids type on the in-game keyboard.
- Voice: natural cloud-voice clips or silence. Never the device/robot voice for kids.
- Wrong taps/answers are a normal part of the story ("Good detectives check again"), with no "wrong" buzzer, no red X, no lost coins. Since 0.1.2
  they show as the partner's popup (§4a), never a small inline line.
- Never auto-start the next case. After closing a case: "Case closed. See you tomorrow, Detective." screen.
- Never show the child accuracy percentages or grades (Parent Zone only).

## 2. Place in the site

- Folder `case-files/`, served at `/case-files/`, name **Case Files**, version **0.1.0** (now 0.1.2, see README changelog), PWA with its own `sw.js` (cache
  name `case-files-v<version>`), `manifest.webmanifest`, icons (make them with a `tools/make-icons.mjs` like other games).
- `build.sh` copies it to `dist/case-files/` (same excludes as the other games). `netlify.toml`: add the redirect
  `/case-files` → `/case-files/`, the sw.js/manifest headers, and `case-files` to the build `ignore` path list.
- Home page `site/index.html`: a Case Files card like the others.
- Family sync: new player kind **`cf`** added to `PLAYER_KINDS` in `car-jump/src/sync/protocol.mjs` (shared by the server
  function; check `netlify/functions/*` and every game's sync tests still pass). Shared modules are imported at runtime from
  `/spell-jump/src/...` the same way Fraction Fright / Wagon West do (profiles, sync client, cloudVoice/tts, keyboard,
  engagement where useful). Do not edit other games' files except the registration points named here.
- The Lab: register `cf` as a game the same way `ff` / `ww` / `bc` are (lab/src/core/model.js GAMES, lab/src/index.js looks
  map, `case-files/src/meta/labBridge.js` + `labLooks.js` modeled on Fraction Fright's). Report a **flat** payout per closed
  case (same amount whatever the accuracy; nothing per correct answer, no multi-case bonus). The Lab's existing tests must
  still pass.

## 3. Look

Same family shell as the 2D games (copy their CSS patterns from `fraction-fright/index.html` / `wagon-west/index.html`):
top bar with "◀ Learning Lab" chip (left) and "🔒 Parents" chip (right); a centered display heading **"Who's on the case?"**;
player cards + dashed "New player" card (shared profiles flow; players from other games appear); chunky beveled buttons;
Lab pill and toasts where the others put them. Theme: a friendly detective agency at dusk: deep navy and teal, manila
folders, red string on a cork evidence board, brass stamps ("CASE CLOSED"). Older-kid look: bold and clean, not cartoony.
Fonts from Google Fonts like the others (e.g. a bold display face plus a highly readable body face for passages; passage
text ≥ 18px on phones, line-height ≥ 1.5, max ~65 characters per line). Portrait and landscape phones and desktop.

## 4. Screens and flow

1. **Picker** → 2. **Agency home**: the case board: Detective Training (first), then the **Erie Canal** arc folder with
   5 case files. Closed cases get a "CASE CLOSED" stamp and stay re-readable from the **Archive** anytime.
   - **Pacing: one new case per day.** Day 1 opens Training and Erie case 1. After a case is closed, the next one opens
     on the next local day ("Next case arrives tomorrow"). No countdown is shown. A parent can open the next case early in
     the Parent Zone. Re-reading closed cases is always allowed.
3. **Case**, five beats (each beat is a comprehension act):
   1. **Briefing**: the Chief (voiced) states the objective ("Find out who moved the canal map and when.") and pre-teaches
      2–3 case words with a quick active task (tap the word in a sentence where it appears, hear its meaning).
   2. **Investigate**: the child picks which of 2–4 documents to open first (witness statement, logbook page, letter,
      museum placard, newspaper notice). Documents read silently; each paragraph has a 🔊 listen button that plays the
      paragraph's sentences with the current sentence highlighted. The **stretch** document (one per case, harder text)
      shows "Read it to me" switched on by default.
   3. **Pin evidence**: questions appear in the partner detective's notebook one at a time; the child answers by tapping the
      sentence that proves it, then "Pin it" → the sentence card flies to the cork board. Hints, three tiers, never a
      penalty: (1) the partner asks a guiding question (authored), (2) the right paragraph is highlighted, (3) the partner
      models the reasoning (authored) and the child taps the sentence themselves. A wrong tap goes straight to the next
      hint tier (no blind re-tapping). After pinning: an elaborated "why it proves it" line (authored).
   4. **Reconstruct**: a half-filled timeline (or cause → effect chain): some cards are placed, the rest sit in a tray; the
      child taps a card then a slot (drag also works). Done from memory first; a "Check the documents" button reopens the
      document drawer. A misplaced card slides back with "Check the logbook" (no penalty).
   5. **Close the case**: the child types the solution (who/what) on the in-game keyboard (generous match: case-insensitive,
      ignores "the", accepts listed variants, edit distance ≤ 2 for names) and attaches at least one pinned clue that is in
      the solution's proof set. Wrong name → "Good detectives check again" + the next hint tier. Then the **case report**:
      the sentence frame "___ did it because ___. The clue that proves it is ___." Blank 1 is pre-filled from the solution,
      blank 2 is typed (accepted if ≥ 3 words; if it contains none of the case's report keywords, the partner asks once
      "Can you add what the clue shows?" then accepts whatever comes next), blank 3 is filled by tapping a pinned clue.
   Then: CASE CLOSED stamp, the Chief's closing line (voiced), the arc's knowledge card (one fact learned), the teaser for
   tomorrow, the flat Lab payout, and the "See you tomorrow" screen. Never auto-start the next case.
4a. **Step coach and feedback popups (0.1.2).** One modal component (centered manila card on a dimmed screen, `role=dialog aria-modal`, the
   screens behind `inert`, focus on the big button and back to where it was, Enter / Escape / button close it, one at a time with a queue).
   - **Coach cards**: one per step (1 Brief, 2 Read, 3 Pin, 4 Order, 5 Close) and one for the agency home. The Chief or the partner, a short
     title, 2-3 short sentences (grade 3-4), a small picture of the action (still under calm motion / `prefers-reduced-motion`), "Got it".
     Shown automatically the first time a player reaches the step (any case) and from the round "?" button (aria-label "How this step
     works"), which is on the home screen and on every step. Spoken with the natural voice or silence; the lines are in the voice list.
   - **Feedback popups** replace every inline "not quite" line: a wrong pin (and the hint tier it brings), a misplaced timeline card, a wrong
     accusation, a clue that is not in the proof set, a report that is too short, "add what the clue shows", a report with no clue, the
     "no voice on this device" note. The partner's face, the message large and voiced, one big button ("Try again" / "Show me" / "Got it").
     A hint highlight, the document drawer / evidence board or the clue picker that the step leads to appears after the popup closes.
     Kind, story-like wording; no "wrong", no red X, no penalty. Correct answers (the "why it proves it" line, progress) stay inline.
5. **Parent Zone** (PIN-locked, shared PIN like the other games):
   - Starting **Detective Rank** select (1–6), shown with approximate labels: "Rank 4 · grade 5 feel · roughly comparable
     to F&P S–U / about 830–1010L (approximate; not affiliated with or leveled by Fountas & Pinnell, Heinemann or
     MetaMetrics)". In v0.1 every case is written at one level (core documents about grade 5 / S–T feel, stretch document
     about U–V); the rank sets **supports**: Rank 1–3: every document has "Read it to me" on, 3 pre-taught words, hint tier
     1 offered automatically after 20 s idle (no visible timer); Rank 4: core documents silent with listen buttons, stretch
     read-aloud on; Rank 5–6: stretch read-aloud off by default too, 2 pre-taught words. (Text variants per rank are v0.2.)
   - Case reports the child wrote (read them all), first-tap evidence accuracy per standard tag (4R1/4R2/4R3...), hints used,
     listen-button use per document, words met.
   - "Open the next case now" button.
   - A short "Talking with school" card: ask whether "U" came from the F&P Benchmark Assessment and whether it's the
     instructional or independent level; i-Ready reports a scale score, placement and a Lexile range, not F&P letters; one
     reading isn't a reliable level.

## 5. Case data format (content lives in `case-files/src/content/`)

`src/content/index.js` exports `TRAINING` (one case), `ARCS` (`[{ id, title, blurb, knowledge: [...], cases: [case...] }]`),
and `CASE_BY_ID`. Each case is a plain object, one file per case (`src/content/erie/erie-01.js` etc.):

```js
export default {
  id: 'erie-01', arc: 'erie', order: 1,
  title: 'The Case of the Missing Toll Ticket',
  setting: 'Rochester, New York · spring 1826',
  objective: 'Find out who has the missing toll ticket, and when it went missing.',
  words: [ { word: 'aqueduct', meaning: 'a bridge that carries water over a river or valley', sentenceId: 'd2s3' } ],  // 2–3
  briefing: [ { who: 'chief', text: '...' }, { who: 'partner', text: '...' } ],        // voiced, ≤ 6 short lines
  docs: [
    { id: 'd1', kind: 'logbook', title: 'Lock 66 Logbook', from: 'Lock tender Ada Brooks', stretch: false,
      paragraphs: [ [ { id: 'd1s1', text: 'One sentence.' }, { id: 'd1s2', text: 'Another.' } ], [ ... ] ] },
  ],
  questions: [   // 4–6; types: 'evidence' (explicit), 'inference', 'word' (meaning from context), 'main' (central idea)
    { id: 'q1', type: 'inference', std: '4R1', prompt: 'Which sentence shows the boat left before noon?',
      answer: ['d1s4'],                  // sentence ids that fully prove it (usually 1)
      hint: 'What time did the lock tender write down?', model: 'The logbook says ... so ...',
      why: 'That line gives the time the boat passed the lock, so it must have left before noon.' },
  ],
  timeline: { kind: 'sequence' /* or 'cause' */, prompt: 'Put the morning in order.',
    items: [ { id: 't1', text: '...', proof: 'd1s2' }, ... ],   // correct order, 5–7 items
    given: [0, 3] },                                                // indexes pre-placed
  solution: { prompt: 'Who has the toll ticket?', answers: ['Tom Fisk', 'Tom', 'Fisk'], proof: ['d2s5', 'd3s2'] },
  report: { keywords: ['ticket', 'pocket', 'coat'] },
  closing: { who: 'chief', text: '...' },
  knowledge: 'The Erie Canal opened in 1825 and ran 363 miles from Albany to Buffalo.',
  teaser: 'Tomorrow: a mule driver swears his mule can read. Can it?',
  facts: [ { claim: '...', source: 'https://...' } ],     // every real-history claim used in the case, with a source
};
```

Rules: sentence ids are unique within a case (`d<doc>s<n>`); every `answer`, `proof`, `sentenceId` and timeline `proof`
exists; each question has exactly one best proving sentence set (a second equally good sentence is a bug); the solution is
only reachable by reading (not guessable from the title); 2–4 docs, about 600–1,200 words per case in total; one `stretch`
doc per case. Characters are fictional; places, dates, objects and jobs are real and sourced. Non-violent mysteries
(mix-ups, missing objects, misread instructions, history/science puzzles). Representation: varied, respectful cast.

**Content for v0.1:** `TRAINING` ("Detective Training: The Case of the Moved Lunchbox", a modern school setting, teaches the
moves: ask a question, check it makes sense, picture the scene, sum it up; shorter, ~400 words) plus the **Erie Canal arc**
(5 cases, Rochester-area, 1820s–1840s: locks and lock tenders, the Rochester aqueduct over the Genesee, packet boats, mules
and the young mule drivers ("hoggees"), toll collectors, the Lockport flight of locks, "Clinton's Ditch", the 1825 opening).
The arc has 8–10 target words, each met ≥ 12 times across the arc (track counts in `tools/content-tests.mjs`).

## 6. Save and sync

Per player, kind `cf`: `{ v: 1, rank: 4, readMode: 'auto' | 'tap' | 'off', seenHelp: { home, brief, read, pin, order, close: bool }, opened: { [caseId]: 'YYYY-MM-DD' }, closed: { [caseId]: { day, at, firstTap:
{ [qId]: true|false }, hints: { [qId]: 0..3 }, timelineTries, report: { who, because, clueId }, listens: { [docId]: n } } },
nextEarly: false, wordsMet: { [word]: n }, updatedAt }`. Merge across devices: union of opened/closed (earliest `at` wins for
a case's record), max of counters, rank from the later `updatedAt`, `seenHelp` = OR per card (default all false; a card seen on any device stays
seen). Unit-tested.

## 7. Tests (`case-files/tools/`)

- `content-tests.mjs`: schema, id integrity, banned words (reuse the family's banned list), word counts per case, an open
  readability formula (Flesch-Kincaid grade) per document reported (core docs should sit about grade 4–6, stretch higher),
  target-word encounter counts, every `facts` entry has a source.
- `logic-tests.mjs`: answer matching, pacing (one new case per day, parent early-open), adaptation of supports by rank,
  save normalize + merge, Lab payout is flat.
- `ui-smoke.mjs` (Playwright, Chromium preinstalled: `require('playwright')`; never `playwright install`): play the Training
  case and Erie case 1 end to end at 390×844 and 844×390 with a mocked voice backend (as Spell Jump's ui-smoke mocks
  `window.__cloudVoiceBackend`), including a wrong tap → hint tiers, a misplaced timeline card, a wrong accusation, the case
  report, the closed screen; the device voice is never used; no console errors; layout has no horizontal scroll.
- Other games' suites that touch sync/Lab must still pass (Spell Jump `sync-smoke`, `lab-smoke`, `lab-tests`; Lab's tools).
  Run browser suites one at a time.
