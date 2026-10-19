# Trail Blazer: learning design

Trail Blazer teaches the **Grade 4 math facts**: the × table to 12 × 12 and the ÷ facts that undo it (the stock set
is ×2 … ×9 with ÷), plus + and − within 20 and a parent's own problems. Families pick the set each week; the goal
is facts that are **known and fast**, so the working memory is free for multi-digit work. This page maps each
technique to its source and to the place in the game and the code where it lives. `SPEC.md` §4 has the requirements;
the "v1.2" section adapts them to race mode.

| # | Technique | Source | Where in the game | Code |
|---|-----------|--------|-------------------|------|
| 1 | **Retrieval, not recognition**: the answer is typed from memory, never picked from choices | Roediger & Karpicke 2006; Codding, Burns & Lukito 2011 (meta-analysis of fact-fluency interventions) | Every Math Gate: the fact in big type, a 0-9 numpad, GO. No multiple choice anywhere | `src/ui/gatePanel.js`, `src/ui/numpad.js` |
| 2 | **Spaced practice** with Leitner boxes (0 / 1 / 2 / 4 days) | Cepeda et al. 2006 (distributed practice meta-analysis); the same box rules as Spell Jump | A right answer moves a fact up one box, **once a day**, so a box means days, not repeats in one sitting. A miss sends it to box 0; the re-queue answered right the same day leaves it in box 0, due tomorrow. Due facts are asked first | `src/facts/scheduler.js` `applyAnswer`, `pickNext` |
| 3 | **Mastery that needs time**: box 3 + right on 2 different days + 3 first-try answers | Spell Jump's mastery rule (spacing as above) | "N facts mastered!" on the results; Mastered on the Fact Grid and in the Report | `isMastered` |
| 4 | **Fluency / automaticity**: a right answer in ≤ 3 s from the fact appearing is *quick*; Fluent = mastered + quick on 2 different days | Hasselbring, Goin & Bransford 1988; Woodward 2006 | ⚡ "Quick!": a bigger boost and +$200. The child never sees a clock; the only trace of time is the ⚡ | `QUICK_MS`, `isFluent`; timer starts when the fact appears (`gatePanel.open`) |
| 5 | **Incremental rehearsal**: a new fact comes back after 1, then 2, then 3 known facts; at most 2 new facts in rehearsal at once; a daily cap on new facts (Parent option, default All) | Burns 2005; Nist & Joseph 2008 | The next gates in the same race or session. With fewer than 3 known facts (a new player, a brand-new list) there is nothing to rehearse among: every gate brings a new fact while the cap allows (a first race is 4 different facts), the gaps count any other fact, and only a missed new fact is rehearsed (back after 1 other fact) | `createSession`, `noteAnswered`, `pickNext` (`REHEARSAL_GAPS`, `MAX_REHEARSING`, `SPARSE_KNOWN`) |
| 6 | **Easiest new facts first**: ×0/×1, ×10, ×2, ×5, ×11, ×9, ×4, ×3, ×6, ×12, ×8, ×7; + and − before ×; a ÷ fact after its × fact | Strategy-based fact instruction (Woodward 2006): facts that follow a rule unlock the harder ones | The first gates of a brand-new player ask 10 × 3, 5 × 10 … not 108 ÷ 9 | `facts.js` `difficulty`, `EASY_ORDER` |
| 7 | **Cover-copy-compare with a strategy hint** on a miss | Skinner, McLaughlin & Logan 1997; Codding et al. 2011 | A wrong answer shakes away within half a second; the whole fact with its answer and a hint is shown **and read aloud** for 2.5 s; then the answer is covered and the child types it from memory. A match opens the gate ("Fixed it!"); a wrong copy clears within 1 s and the fact shows again. A wrong answer is never left on screen | `gatePanel.js` (states ask → bad → show → copy → fixed), `src/facts/hints.js` |
| 8 | **Re-queue in the same sitting**: a missed fact comes back after 2 other facts, at most twice | Spell Jump's re-queue rule; Burns 2005 | A later gate in the same race (or the next race) | `REQUEUE_GAP`, `REQUEUE_MAX` |
| 9 | **Interleaving**: once a family is past New, its facts mix with the other chosen families and operations in one ride | Rohrer & Taylor 2007 | Gates mix ×, ÷, +, − and custom problems instead of blocking by family | `pickNext` (weighted free picks across the whole set) |
| 10 | **Immediate, specific feedback** | Hattie & Timperley 2007 | Right / wrong within the same second, always with the correct fact; the hint says *how* (×9: "10 × 7 is 70, take away 7"; ÷: "7 × ? = 56"; make ten; count up) | `gatePanel.js`, `hints.js` |
| 11 | **Progress the child can see** | Fuchs & Fuchs 1986 (systematic formative evaluation) | The Fact Grid (title → Facts): every × and ÷ fact colored New / Learning / Almost / Mastered / Fluent, tap to hear it; the results' facts list (⚡ ✓ ↻), "N facts mastered!", the daily mission, XP and levels. Parents get the Report (per operation, slowest facts, this week's races, Copy report) | `src/ui/grid.js`, `src/ui/results.js`, `parentZone.js` `reportTab`, `store.js` `report` |
| 12 | **Intrinsic integration**: the math is the game mechanic, not a quiz in front of it | Habgood & Ainsworth 2011 | Facts open the gates and fill the boost tank; a quick answer is pure race time gained, a fixed answer gives the rivals a 1.5 s head start. The race clock is frozen during a question, so medals reward fast *answers*, never reading speed | `main.js` `askGate` → `game.openGate({ correct, quick, fixed })` |
| 13 | **Dual coding / reading support**: the fact is read aloud as it appears ("seven times eight"), the fix-it fact and hint too | Spell Jump's voice stack | Spell Jump's `tts` with the player's voice (the natural cloud voice when the family has a code); "Hear it" on the panel; Parents → Options "Facts aloud" turns it off (shown only) | `spelling/tts.js`, `spelling/cloudVoice.js`, `facts/spoken.js` |
| 14 | **A small daily goal** | Spell Jump's daily mission | 12 gate answers a day → $400 and +100 XP, once; "Today: 8 / 12 math gates" on the title and HUD | `store.js` `missionState`, `MISSION_SIZE` |
| 15 | **Placement and adaptive sequencing**: start where the child is, then move on by mastery | Vygotsky's zone of proximal development, put into practice as mastery-based progression; Fuchs & Fuchs 1986 (progress monitoring); Codding, Burns & Lukito 2011 (interventions matched to the learner's phase, acquisition or fluency, work best) | The **Pit Crew Check** after the first finished race (Start / Later, offered after up to 3 races, re-run from Parents → Facts): an adaptive staircase from ×3 ×4 up through ×7 ×8 and ÷, ≤ 24 facts, no clock on screen, ending on the **Start line** ("Fluent: … · Working on: … · Up next: …", +100 XP). **Auto mode** (the default) then works on two families by the ladder: the lowest unfinished tier first (shaky ×6 ×9 always before ×7 ×8), the weakest within a tier (misses, then slowness), never above an untested gap, mixed with known families: about 60 % of gates on the frontier (acquisition), 30 % known (spacing, fluency), 10 % mastered (retention). A family moves on at 90 % mastered and 70 % fluent and comes back when two facts slip in a week | `src/facts/placement.js`, `src/facts/adaptive.js`, `src/ui/pitCheck.js` |
| 16 | **Retention checks** | Spacing (Cepeda et al. 2006) and progress monitoring (Fuchs & Fuchs 1986) | Every 15 finished races or 7 days, 6 mastered facts are mixed into the next race's gates; a miss brings that family back into the frontier | `adaptive.js` `probeDue`, `startProbe`, `noteProbe` |
| 17 | **Error-pattern analysis** | Ashlock, *Error Patterns in Computation* (systematic errors tell you what to teach) | Every miss is classified: neighbouring fact, one group off, digits swapped, the other operation, ÷ missed while its × is known, big numbers, or slow but right. The kind of miss picks the hint ("7 × 7 is 49, then one more 7 is 56"; "you know 7 × 8 = 56, so 56 ÷ 7 = 8"); a cluster of ÷ misses brings the ÷ twin two gates after its × fact; the Report's **Patterns** say it in plain words ("Misses cluster in ×7 and ×8", "Division is weaker than multiplication", "Slow on big numbers: 6 × 7, 8 × 9") and the Start line turns it into a pit note | `src/facts/patterns.js`, `gatePanel.js` (hint provider) |

## How the Pit Crew Check works (v1.3)

Tiers: T0 + − within 20 (only when the parent allows them) · T1 ×2 ×5 ×10 · T2 ×3 ×4 · T3 ×6 ×9 · T4 ×7 ×8 · T5 ×11
×12 · T6 ÷ of T1-T2 · T7 ÷ of T3-T5 (÷ only with "÷ too"). It starts at T2 with 3 facts from different families
(other number 3 … 9). 2 of 3 right **and quick** → the next tier; 2 of 3 right but slow → 3 more in that tier, then
stop; 1 or 0 right → one tier down and 3 there (a tier already passed is not asked again), then stop, or down again
(two drops end it). It also ends when the top tier passes or at 24 facts. A fluent child climbs to ÷ in 18 facts.
Every family it touched gets **fluent** (all right, all quick), **known** (right, slow), **shaky** (a miss) or
**untested**; tiers below a passed tier count as known. The answers seed the records (quick right → box 2 and a
first-try, slow right → box 1, a miss → box 0 and first among due facts), so the next race starts in the right place.
The child never sees a score or a wrong count: right answers flash "56!" (⚡ when quick), a miss shows the fact with its
answer for a moment, read aloud.

## What the game never does

- No timers on screen, no countdown on a question, no penalty for being slow (slow and right still opens the gate
  with a boost).
- No wrong answer stays visible; no score of wrong answers is shown to the child.
- No streak that can be broken, no lives.
- No external links, no ads, no accounts; native text inputs only inside the PIN-locked Parent Zone.

## The numbers

| Setting | Value | Where |
|---|---|---|
| Quick | ≤ 3 s from the fact appearing | `scheduler.js` `QUICK_MS` |
| Leitner intervals | box 0 / 1 / 2 / 3 → 0 / 1 / 2 / 4 days, one promotion a day | `INTERVAL_DAYS` |
| Mastered | box 3, right on ≥ 2 days, ≥ 3 first-try answers | `isMastered` |
| Fluent | mastered + quick on ≥ 2 days | `isFluent` |
| Re-queue | after 2 other facts, at most twice a session | `REQUEUE_GAP`, `REQUEUE_MAX` |
| Incremental rehearsal | back after 1, 2, 3 known facts; ≤ 2 new facts in rehearsal (with fewer than 3 known facts: any other fact counts, no limit) | `REHEARSAL_GAPS`, `MAX_REHEARSING`, `SPARSE_KNOWN` |
| Cover-copy-compare | fact + answer + hint for 2.5 s, then covered | `gatePanel.js` `SHOW_MS` |
| Gates per race | 3 / 4 / 6 (default 4) | Parents → Options |
| New facts per day | 3 / 5 / 8 / All (default All) | Parents → Options |
| Daily mission | 12 gate answers → $400, +100 XP, once a day | `store.js` |
| XP | right 15, quick +5, fixed 5, newly mastered +50, mission +100 | `store.js` `XP` |
| Gate cash | quick $200 (+60 % tank, 1.2 s push), right $120 (+40 %), fixed $40 (rivals +1.5 s) | engine `openGate` |
| Pit Crew Check | start T2, blocks of 3, advance on ≥ 2 quick, probe on 2 slow, drop on ≤ 1 right, ≤ 24 facts, +100 XP | `placement.js` |
| Auto frontier | 2 families, lowest unfinished tier first, weakest within it; gates 60 / 30 / 10 frontier / known / mastered; advance at 90 % mastered + 70 % fluent; re-enter on 2 facts at box 0 in a week | `adaptive.js` |
| Retention probe | 6 mastered facts every 15 finished races or 7 days, every other gate | `adaptive.js` `PROBE` |

## Sources

- Burns, M. K. (2005). Using incremental rehearsal to increase fluency of single-digit multiplication facts with
  children identified as learning disabled in mathematics computation. *Education and Treatment of Children*, 28(3).
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall
  tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3).
- Codding, R. S., Burns, M. K., & Lukito, G. (2011). Meta-analysis of mathematic basic-fact fluency interventions:
  A component analysis. *Learning Disabilities Research & Practice*, 26(1).
- Fuchs, L. S., & Fuchs, D. (1986). Effects of systematic formative evaluation: A meta-analysis. *Exceptional
  Children*, 53(3).
- Habgood, M. P. J., & Ainsworth, S. E. (2011). Motivating children to learn effectively: Exploring the value of
  intrinsic integration in educational games. *Journal of the Learning Sciences*, 20(2).
- Hasselbring, T. S., Goin, L. I., & Bransford, J. D. (1988). Developing math automaticity in learning handicapped
  children: The role of computerized drill and practice. *Focus on Exceptional Children*, 20(6).
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1).
- Nist, L., & Joseph, L. M. (2008). Effectiveness and efficiency of flashcard drill instructional methods on urban
  first-graders' word recognition, acquisition, maintenance, and generalization. *School Psychology Review*, 37(3).
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term
  retention. *Psychological Science*, 17(3).
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional
  Science*, 35(6).
- Skinner, C. H., McLaughlin, T. F., & Logan, P. (1997). Cover, copy, and compare: A self-managed academic
  intervention effective across skills, students, and settings. *Journal of Behavioral Education*, 7(3).
- Ashlock, R. B. (2010). *Error Patterns in Computation: Using Error Patterns to Help Each Student Learn* (10th ed.).
  Allyn & Bacon.
- Vygotsky, L. S. (1978). *Mind in Society: The Development of Higher Psychological Processes*. Harvard University
  Press (the zone of proximal development).
- Woodward, J. (2006). Developing automaticity in multiplication facts: Integrating strategy instruction with timed
  practice drills. *Learning Disability Quarterly*, 29(4).
