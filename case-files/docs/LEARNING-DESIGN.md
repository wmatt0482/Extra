# Case Files: learning design

Condensed from the research report (`reports/Detective reading game research.md`, plan section). Each row is a technique the game
uses, the evidence it rests on, and where it lives in the code. Effect sizes are the report's; the report says where a figure is
secondhand or from older learners. Nothing here claims the game itself has been tested: no controlled study has tested detective
framing for reading comprehension (the report's own caveat), so v0.1 logs first-tap accuracy privately and lets a parent read the
child's reports.

## What the game does, and why

| Technique | Evidence (from the report) | Where it lives |
|---|---|---|
| **The reading is the detective work** (intrinsic integration): every beat is a comprehension act; nothing is solvable from the title | Children aged 7-11 chose to play about 7 times longer when learning was the core mechanic than when a quiz unlocked rewards (Habgood and Ainsworth); games beat non-game instruction at g = 0.33, with design driving the spread (Clark et al. 2016) | `src/ui/caseView.js` (five beats); SPEC §4, §5 |
| **Tap the sentence that proves it**: cite the evidence, locate and refer to details (NYS 4R1) | Inference instruction d = 0.58 on general and 0.68 on inferential comprehension (Elleman 2017); inference work does not have to wait for literal mastery | `src/logic/answers.js` `checkTap`; `src/logic/run.js` `pinTap`; `src/ui/reader.js` pick mode |
| **No authored wrong answers**: every tappable option is a true sentence from the document; no multiple choice | House rule; the risk is blind guessing, closed by the three rules below | `src/ui/caseView.js` (Pin it), SPEC §1 |
| **Three-tier hints, never a penalty**: (1) the partner asks a guiding question, (2) the right paragraph lights up, (3) the partner models the reasoning, then the child taps the sentence | Elaborated feedback ES = 0.49 beats showing the answer (0.32) and right/wrong (0.05) (Van der Kleij et al. 2015); a red X teaches almost nothing | `src/logic/run.js` `pinTap`/`requestHint`; `src/ui/caseView.js` `showTier`; the authored `hint` and `model` in each case |
| **A wrong tap goes straight to the next hint tier** (no blind re-tapping) | Closes the "tap until something works" risk; a wrong tap turns the paragraph highlight on instead of allowing another blind tap | `pinTap` returns the new tier; Pin it stays disabled until a new tap |
| **"Why it proves it" line after pinning** | Explanatory feedback; the report's second rule against guessing | each question's `why`, shown in the notebook |
| **First-tap accuracy, logged privately** | Drives adaptation (v0.2) and the parent's skill map; never shown to the child | `closed[id].firstTap`; `accuracyByStandard`; Parent Zone → Detectives |
| **Timeline / cause-and-effect rebuilt from memory**, half-filled | Filling in a partly completed concept map from memory beat free recall and re-reading for about 4th graders (Karpicke et al. 2014); ITSS text-structure tutoring +0.15 to +0.20 (WWC-reviewed grade 4 trial); NYS 4R3 | `src/ui/caseView.js` `renderRebuild` (tap card then slot, or drag); "Check the documents" drawer |
| **One-sentence case report** with a quoted clue (claim plus evidence) | Writing about what was read ES = 0.40, 0.79 for elementary comprehension (Graham and Hebert); NYS 4R2/4R1 | `renderReport`; `becauseStep` (3 words, ask once for what the clue shows, accept the next) |
| **Pre-teach 2-3 case words with an active task** | Teaching word meanings improves comprehension of passages containing them; active processing beats dictionary definitions (Wright and Cervetti 2017); words met 12 times are much more likely to be learned | `renderBrief` / `wordCard` (tap the word in its sentence, hear its meaning); `wordsMet` counts; the arc's 8-10 target words |
| **Topic arcs for knowledge building** (Erie Canal, about 5 cases) | Topic knowledge beats general skill (baseball study; Smith et al. 2021); MORE trial ES = .11-.12 on general comprehension from built knowledge | `ARCS` in `src/content/index.js`; each arc's `knowledge` card shown on the closed screen |
| **Voiced briefings and partner lines; silent-read core documents with per-paragraph listen; the stretch document reads aloud by default** | By grade 4 listening comprehension explains about 21% of reading-comprehension variance vs 13% for word recognition (LARRC 2015); text-to-speech d = 0.35 for readers with disabilities (Wood et al. 2018); no shown benefit for on-level readers, so core documents stay silent | `src/meta/speech.js` (natural voice or silence, never the device voice); `src/ui/reader.js` (listen buttons, sentence highlight, "Read it to me"); `readAloudDefault` |
| **Detective Rank sets supports, not a gate** (starting point chosen by a parent; labelled as approximate) | "Level U" is a teacher estimate, about a year ahead of a typical 4th grader; evidence for strict level-matching is weak and scaffolded harder text works (Shanahan) | `src/logic/pacing.js` `supportsFor`, `RANK_LABELS`; Parent Zone → Detectives |
| **A stretch document per case** (harder text) with audio | Scaffolding lets students read frustration-level text successfully (Shanahan's synthesis) | `docs[].stretch` in the case data; "Stretch" tag and read-aloud on at ranks 1-4 |
| **Strategy toolkit taught once**, in a short training case: ask a question, check it makes sense, picture the scene, sum it up | Strategy instruction d = .19 standardized / .43 researcher tests; 10 sessions about as good as 50 (Okkinga 2018; Willingham and Lovette, contested by Shanahan) | `TRAINING` case, "Detective Training" folder on the home board |
| **A specific objective in every briefing** | Goal-setting is a moderator of strategy effects (Okkinga) | `kase.objective`, the Objective card |
| **One new case per day; "Case closed. See you tomorrow, Detective."; the next case never auto-starts** | Missing a day barely matters (Lally 2010); the ICO code endorses a clear stopping point; no countdowns, no "one more for a bonus" | `refreshOpened`/`waitingState` in `src/logic/pacing.js`; `src/ui/closed.js`; the parent's "Open the next case now" |
| **Flat Lab payment per closed case; nothing per answer; no streak pressure; no crate tie-ins** | Expected, tangible rewards contingent on an already-interesting task undermine later interest (Deci, Koestner and Ryan 1999); paying per correct answer turns every tap into a wage | `src/logic/payout.js` (takes no accuracy); `lab/src/data/events.js` (`cf.case`, one row); no `cf` crate keys |
| **No timers, lives, fail states, pressure text; no accuracy shown to the child** | Radesky 2022: about 80% of apps used by 3-5 year olds had manipulative features (countdowns, sad characters, lures); the report's "what not to do" list | SPEC §1; `tools/ui-smoke.mjs` kid-rule audit; the partner is never sad or disappointed |
| **Lean world**: a partner, a Chief, documents; no explorable map; most of the time is on the text | Crystal Island: a narrative game taught less than a slideshow on retention and transfer; simpler visuals were as effective or more so | `src/ui/*` (no world to explore); passage-first layout |
| **Curiosity gap + resolution in-session** | Curiosity is a felt gap in knowledge; the passage is the incidental material that gets remembered (Gruber et al. 2014) | each case resolves the same day; the teaser names tomorrow's puzzle but unlocks nothing |
| **Detective identity that survives mistakes** ("Good detectives check again") | "Be a helper" framing helps but can backfire after setbacks (Bryan et al. 2014; Foster-Hanson follow-up) | `LINES.checkAgain`; wrong names and wrong cards are a normal part of the story |
| **Cooperative, private recognition**: reports read in the Parent Zone; no sibling ranking | Leaderboards can harm; cooperation and recognition are interpersonal motivators (Malone and Lepper) | Parent Zone → Detectives → Case reports; the Lab family board (cooperative totals) |
| **Generous local scoring of typed answers** | LLM scoring reaches kappa 0.70 vs 0.75 human, only fit for low-stakes coaching; COPPA limits sending children's data to third parties | `matchSolution` (case, "the", variants, edit distance <= 2 for names); `becauseStep`; nothing leaves the device but the family sync |
| **"Talking with school" card** | F&P letters, i-Ready scale scores and Lexile are different measures; one reading is not a reliable level | Parent Zone → School |

## Standards the questions cover

`std` on each question names the New York Next Generation grade 4 standard it practices: 4R1 (locate and refer to relevant details
and evidence, make logical inferences), 4R2 (central idea and summary), 4R3 (what happened and why: events, ideas, cause and effect)
and 4R4 (word meaning from context). The report marks 4R4, 4R6 and 4R9 wording as unverified; the Parent Zone shows the tag only.

## What v0.1 leaves for later (from the report's phases)

Hidden difficulty dial and rolling-window adaptation, text variants per rank, cold-case reviews, the alibi board and clue sort, more
arcs and a season mystery, case-partner co-op mode, skill titles and an agency-office collection, and optional coaching-only LLM
feedback with a no-retention API. The Lab's existing crates are not touched by this game; the report's recommendation to convert
them to deterministic reveals is a Lab decision.
