# Writing a Case Files case

Follow SPEC §5 for the data format. This is the house style, so new arcs match the Erie Canal arc. Run
`node case-files/tools/content-tests.mjs` after every change; it must pass.

## Recipe

1. **Pick one real object, job or place, and one honest puzzle.** Mix-up, missing object, misread rule, or a science/history
   riddle. Nothing violent, nothing scary. Aim for a real "aha" a 10-year-old can say out loud ("the mule was wearing the hat!").
2. **Cast.** Recurring: the Chief (voiced, states the objective and closes the case), Pip the partner (hints; models the four
   moves: ask a question, check it makes sense, picture the scene, sum it up), the Archivist (case words). Case characters are
   fictional, varied and respectful. Real people appear only in `facts`-backed history (for example, DeWitt Clinton as governor).
3. **Docs (2 to 4, 600 to 1,200 words in all).** Core docs read at about grade 5 (short plain sentences, modern English). Exactly
   one `stretch: true` doc at a harder level: longer sentences, richer words, period-style voice (a letter or notice), but its
   Flesch-Kincaid grade stays at or below 9 (`content-tests` fails above that; v0.1.3). The stretch doc is optional reading ("Bonus ·
   harder") unless a question's `answer` or the solution `proof` points into it; then the desk says it is needed, so prefer keeping
   answers and proof in the core docs. Every sentence is its own `{id, text}`; write one sentence per tap, under about 40 words.
   **Prompts**: blind-solve each one. Read only the prompt and ask which sentence a 9-year-old would tap; if a sentence that is not
   the key fits as well (it names the same people or things, or also gives a time, a reason, a place), reword the prompt (name the
   document, use the key's own words such as "every time", "which means", "cannot tell") or reword the other sentence.
4. **A red herring that the text itself rules out.** Never an authored false option on screen. A suspect gets a sentence that
   clears them (a clerk "has not stirred from his desk"); a tempting idea gets a sentence that defeats it (a trial where the
   sign was covered).
5. **Questions (4 to 6).** Mix `evidence`, `inference`, `word`, `main`; tag `4R1` (evidence and inferences), `4R2` (central
   idea and summary), `4R3` (what happened and why), `4R4` (word meaning). Each has exactly one best proving sentence set.
   Write `hint` as a guiding question (and name a move), `model` as the partner thinking aloud, `why` as one line explaining
   why that sentence proves the point.
   **Report lead (v0.1.3).** `report.lead` is the start of the case-report sentence with one `___` for the answer, for example
   `The waybill was with ___` or `___ moved the lunchbox`. The game adds ` because ___.` and `The clue that proves it is: “…”`.
   Where a person did it write `___ <verb>…`; for an animal, object or cause use a neutral lead (`The hole … was dug by a ___`).
   Without a lead the report reads `The answer is ___ because ___.`
6. **Timeline (5 to 7 items, 2 given).** Sequence or cause-and-effect. Do not name the solution in a timeline card; the cards
   are shown before the case is closed.
7. **Solution.** Reachable only by reading, never guessable from the title. List generous `answers` variants. `proof` holds the
   sentences that together show it.
8. **Closing, knowledge, teaser.** Closing is one warm voiced line that credits the child's reading. Knowledge is one
   verified fact. Teaser is one line about tomorrow's case (the arc finale hints at the next arc, no dates).
9. **Target words.** Pick 8 to 10 per arc and weave each into docs, briefings and closing lines until it is met 12 or more
   times across the arc. The test counts only docs, briefing lines and closing lines.

## Authoring tools

`src/content/helpers.js`: `doc(id, meta, paragraphs)` numbers sentences `d<doc>s<n>` and lets you tag a sentence with
`'@name Sentence text.'`. `handles(...)` merges tags so questions, timelines and solutions refer to `S.name` instead of
hand-counted ids; an unknown name throws. Case files still export plain §5 objects.

## Kid rules the test enforces

No "kill, die, dead, death, lost, lives, gun, blood, weapon, shoot" in any string (write "missing", "misplaced", "went away").
No pressure words in briefings or teasers (hurry, countdown). No multiple choice and no authored wrong answers. Every `facts`
entry needs an http(s) source, and the same claim goes in `docs/SOURCES.md`. If a detail cannot be verified, leave it out.

## Blind-solve self-check (do this by hand for every question)

Cover the key and re-read all docs for the prompt. Does exactly one sentence (or the listed set) prove it? If a second
sentence is as good, reword the prompt (name the document: "in the notice"), or reword the other sentence so it states
less. The test prints possible overlaps as warnings; read each one.
