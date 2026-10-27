# Fraction Fright: learning design

Fraction Fright teaches **fractions as numbers on a number line** (Grade 4, CCSS 4.NF): a fraction has one place
between 0 and 1, the place is set by equal jumps of 1/d, and ½ sits in the same spot whatever the road is cut into.
Version 1.0 plays the Zombie Lab and the first two streets: Maple Street (halves, quarters) and Oak Lane (thirds,
sixths, eighths, then fifths, tenths, twelfths). This page maps each technique to its source and to the place in the
game and the code where it lives. `SPEC.md` §0 holds the non-negotiables; §5–§7 the rules; §12 the sources. The
sources were consulted through abstracts and secondary summaries: the game is our reading of them, not a tested
intervention.

| # | Technique | Source | Where in the game | Code |
|---|-----------|--------|-------------------|------|
| 1 | **The number line is the picture**; pies never are | Siegler, Thompson & Schneider 2011; Siegler et al. 2012; Schneider et al. 2018 (meta-analysis); Hamdan & Gunderson 2017; IES practice guide (Siegler et al. 2010, Rec. 2) | The road the zombies shuffle down is a number line from 0 to 1; every throw is a placement on it | `src/skills/items.js` `roadFor`; the engine's road (`src/game/road.js`) |
| 2 | **The aim point is the math** (intrinsic integration): nothing but where the slime lands decides a hit | Habgood & Ainsworth 2011; Cutting & Iacovides 2022 | Drag along the road, let go: bull ≤ 1.5 % of the road, hit ≤ the zone, near ≤ 2 × the zone, else a miss. Since 1.1 the zombie *stands at* its fraction, but hidden in the fog for the first 60 % of its walk: the answer cannot be read off the zombie, only found with the number. Once it steps out of the fog a throw at it is recorded as **seen** (kind `seen`) and never counts toward a secure street; a cure in the fog pays the Sharpshooter bonus | `items.js` `classify`, `paeOf`; `main.js` pointer → `setAim` / `throw`; `store.js` `recordThrow({ seen })`; `ladder.js` (secure counts `locate` only) |
| 3 | **The true spot after every throw**: the flag, the fraction drawn as unit jumps from 0, "N % close" | Fazio, Kennedy & Siegler 2016 (estimation practice without this feedback did not improve) | Every throw, hit or not: the flag at the fraction, n jumps of 1/d from 0, "92 % close" (always positive; never "wrong"). Since 1.1 the fog adds a second, delayed form of the same feedback: a zombie that is not cured steps out of the fog at its true spot | the engine's feedback beat; the Lab's `landed()` in `src/ui/lab.js`; `items.js` `closeText` |
| 4 | **Labelled benchmarks**: 0, ½ and 1 always named; finer ticks fade | Peeters et al. 2017 | 0, ½, 1 are labelled on every road, in the game and the Lab; the denominator's ticks appear only as a hint | `roadFor` (labels, no ticks); the hint ladder |
| 5 | **A lesson before the game** | Nuraydin, Stricker & Schneider 2022 (the same game without it did not transfer) | The Zombie Lab (≈ 60–90 s, required once, replayable): a fraction is a number on the road; drag to cut 0→1 into 4 equal jumps (named ¼, 2/4, ¾); lob at ¾; thirds; ½ is the same spot on every road (2/4, 3/6, 4/8 line up); lob at 4/8. At most 8 words on screen, read aloud. Its three throws are the first throws in the records | `src/ui/lab.js`, `store.js` `finishLab` |
| 6 | **Accuracy, never speed** | Siegler et al. 2011/2012; Fuchs et al. 2013/2014/2016 | No timer, no countdown; zombies take ≈ 20 s to the fence. Only closeness is scored and adapted on; the store keeps no times | `store.js` (records: time of throw, PAE, result only) |
| 7 | **The hint ladder** after a miss on the same zombie: an arrow toward the spot, then the denominator's ticks for one throw | Motion Math (Riconscente 2013) | Item `hints: ['arrow', 'ticks']`; the engine runs them | `items.js` `HINTS`, `makeItem` |
| 8 | **Scaffold, then fade**: the bounce scaffold (the slime hops in unit jumps before landing) | Equal-partition jumps as in number-line instruction (IES practice guide, Siegler et al. 2010); the fading schedule is our design choice | About 70 % of items bounce while a street is new, 30 % once it works, none when secure | `items.js` `bounceShare`, `item.jumps` |
| 9 | **A wide zone early, narrowing with skill** (10 % → 5 % → 3 % of the road) | Lomas et al. 2013 (Battleship Numberline: a wide target early keeps kids playing) | Each street plays at its state's zone: ±10 % to start, ±5 % working, ±3 % secure | `items.js` `TOL_STEPS`, `toleranceFor`; `ladder.js` `tierState` |
| 10 | **Move on by evidence; come back after a slip** | Mastery-based progression; Fuchs et al. (progress monitoring) | Records per street + kind (last 12 throws). Working = ≥ 6 throws, ≥ 60 % on target; secure = ≥ 8 plain throws, ≥ 80 % on target, mean PAE ≤ 2.5 % (half the working zone), and no slip (two plain misses in a row bring it back to working). A move is logged for the Report | `src/skills/ladder.js`, `store.js` `recordThrow` (`moves`) |
| 11 | **The child chooses the street** (a ★ suggests one; a chosen street is never closed again) | Lomas et al. 2017 (self-chosen difficulty stays motivating) | Maple Street opens with the Lab; Oak Lane when Maple Street works (so there is always a choice of two); the ★ is the lowest open street not yet secure | `ladder.js` `isUnlocked`, `recommended`; `src/ui/streets.js` |
| 12 | **Spaced review across streets** | Cepeda et al. 2006 (distributed practice) | From wave 2 on, about 20 % of an Oak Lane wave are Maple Street fractions, at their own zone | `items.js` `buildWave` (`REVIEW_SHARE`) |
| 13 | **Big effects only on success** | Kao et al. 2024 | Bull: slow-mo, the big THUNK, confetti; hit: thunk + splat; near: edge splat + nudge; miss: a soft plop | the engine; `src/sfx.js` (sizes by result) |
| 14 | **Effort counts** ("Brain Points") | O'Rourke et al. 2014 | A near followed by a cure on the same zombie pays +$40 ("Close, then cured") | `src/meta/economy.js` `waveCash` |
| 15 | **No progress meters, no side collectibles in a wave; no streak** | Lomas / UpGrade (a progress meter cut engagement ~15 %); Andersen et al. 2011; ICO Children's Code std. 13 (streaks as nudges) | The HUD has the called fraction, the other live zombies' small cards, the street and pause: no timer, bar or counter (the horde is the progress). The in-wave COMBO chip (consecutive hits, from ×2; gone on a miss) is not a daily streak: it never asks for a return visit and resets every wave. Between waves: results, the Cure Counter tally (a new neighbour on the title's street per 10 cures), the yard | `src/ui/hud.js`, `results.js`, `title.js` |
| 16 | **Hearing the fraction** | A design choice (reading support), like the other games | The scout's fraction is read aloud ("three quarters") through Spell Jump's voice; the natural voice's clips are prepared once (a finite set of ~40 names); "Hear it" repeats it | `items.js` `fracName`, `sayTexts`; `main.js` `applyVoice` |
| 17 | **Nothing punishes stopping** | Kid rules shared with the other games | A zombie at the fence knocks, takes a pumpkin and shuffles off (no lives, no game over). Stopping a wave keeps the cash and the cures; the street picks up at the same wave | `economy.js` `bankWave` (`stopped`) |

## What 1.1 "The Horde" changed (SPEC §13)

The fun overhaul kept every rule above and moved the fraction into the enemy: a zombie rises out of the fog *at its
spot* (hidden for the first 60 % of its walk), 2–4 are live at once and the kid may call any of them (the card stack:
Lomas 2017's self-chosen difficulty, in miniature), **twins** are two spellings of one number at one spot cured by one
grenade (Twin Alley's first lesson: equivalent fractions share a place), and the final wave's **boss** shows the same
number three ways (symbol, words, unit sum) over its three hits. The combo, the grenade types, the chatter and the
finale are juice; big effects still only follow success (technique 13). Throws at a zombie already out of the fog are
kept apart as `seen` and never count toward a secure street (technique 2).

## The bonus round (1.2, SPEC §14)

The Critter Stampede is pure arcade, on purpose: a short reward the math earns, never a loop a child can grind. It
only follows a wave, and only a wave with ≥ 80 % hits (or a cured boss), so the big effects still belong to success
(technique 13; Kao et al. 2024). It is ≈ 20 s against ≈ 2–3 minutes of fraction practice a wave, it never changes the
aim, the zone or the records, and it has no timer, countdown, ammo or energy on screen (the kid rules in SPEC §0): the
round ends when the stampede has passed. Parents can turn it off (Options → Bonus round).

## Blast and Gentle mode (1.3, SPEC §15)

1.0 "cured" zombies because we read the kid rules as "nothing is destroyed". Playtesting with a 9-year-old said the
cure was the least satisfying part of the game. The rules that matter for other families are narrower and they
stay: no blood, no bones, no gore, never the words kill / die / dead / death on screen. So the default is now the
Plants-vs-Zombies line: a hit blasts the zombie apart into cartoon parts and green goo and the rest melts into a
puddle; critters pop into goo and fur. **Gentle mode** (Parents → Options) restores the cure, the neighbours and the
party hats for a parent who prefers them. The learning layer is untouched: the aim, the zone, the feedback flag and
the records are the same in both modes.

## What comes next (SPEC §11)

Twin Alley (compare and equivalent, ≥ 30 % incongruent pairs: Braithwaite & Siegler 2018), Sum Street (estimate before
compute), Decimal Drive, Pumpkin Hill (0–3 with every whole labelled, mixed-number bosses), the Lab Check (placement),
the governor (≥ 92 % → tighter zone + a scout from the next tier; < 70 % → wider zone, the bounce back, a step back),
scouts, crates, co-op nights and the economy simulation.
