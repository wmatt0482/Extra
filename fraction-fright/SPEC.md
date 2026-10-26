# Fraction Fright — spec (v1.0, Oct 26 2026)

The third game on learninglab.fun: a kid-safe zombie "shooter" that teaches **fractions as numbers on a number line**
(Grade 4, CCSS 4.NF). Matt: "fractions - zombie shooting game"; "instead of a hose or stream make it a slime grenade
that makes a thunk when you hit the right spot and explodes." Cartoon zombies shuffle down a graveyard road toward
the kid's fence. The road IS a number line. A scout calls a fraction ("one at three quarters!"), it shows big, the kid
lobs a slime grenade to that spot. Land on it: THUNK, explosion, the zombie turns back into a goofy neighbour and
walks home. Miss: a plop, the true spot lights up with the fraction drawn as jumps, aim again. No one is ever hurt.

## 0. Non-negotiables
Kid rules from the other two games: no lives, no energy, no visible timers or countdowns, no pressure text, no
"kill / die / dead" words, no blood, nothing that punishes stopping, no external links, native inputs only in the
PIN-locked Parent Zone. Plus the rules the research fixed (sources in §12):
- **The aim point is the math.** Nothing else decides a hit (Habgood 2011; Cutting & Iacovides 2022).
- **After every throw the true spot is shown**, as a flag on the road and the fraction drawn as unit jumps (Fazio,
  Kennedy & Siegler 2016: practice without this feedback did not improve estimation).
- **0, ½ and 1 (and every whole on a 0–3 road) stay labelled always**; only finer ticks fade (Peeters 2017: labelled
  benchmarks help 3rd/4th graders, unlabelled ticks do not).
- **A short lesson comes before the first street** (Nuraydin et al. 2022: the same game without it did not transfer).
- **Accuracy, never speed**, is what is scored and adapted on (Siegler et al. 2011/2012; Fuchs 2014). Zombies are slow.
- **Big effects only on success** (Kao et al. 2024): the thunk, slow-mo and explosion belong to the right spot.
- **No progress meters, no side collectibles during a wave** (Lomas/UpGrade: a progress meter cut engagement ~15 %;
  Andersen 2011: optional collectibles reduced retention). The horde itself is the progress.
- **No streak in this game** (ICO Children's Code standard 13 lists streaks as a nudge; the other games keep theirs).
- **Pies are never the main picture**; the number line is (Hamdan & Gunderson 2017; IES 2010 Rec. 2).

## 1. Shared with Spell Jump / Trail Blazer (import at runtime, do not copy)
`../spell-jump/src/...`: spelling/profiles.js (family, players, PIN), sync/client.js + registerSyncKind (kinds `ff`
= save, `fracs` = skills), spelling/tts.js + cloudVoice.js (fraction names read aloud; ~120 texts, prepared as cloud
clips when the family has a code), audio.js, ui/dom.js, ui/icons.js, meta/pings.js (game 'fraction-fright', kinds
'day' | 'wave' | 'check' | 'lab'), meta/engagement.js (crates only; no streak). Matter.js is not needed (the throw is
a closed-form arc). Never modify car-jump/ or trail-blazer/; the sync registry already supports new kinds.

## 2. Screens
Players (shared picker) → **Title** (the yard at dusk: fence, pumpkins, the Cure Counter "Neighbours cured 37",
buttons STREETS · LAB · YARD · PARENTS) → **Zombie Lab** (the lesson, §4) → **Streets** (the tier picker, §6) →
**Wave** (the game) → **Results** → **Yard** (upgrades / cosmetics) → **Parent Zone** (Family code · Fractions ·
Options · Report · Players). Landscape and portrait, iPhone and iPad.

## 3. Engine contract (`src/game/engine.js`, the engine agent)
`createGame(canvas, { onEvent, reducedMotion })` → `start({ road: { from: 0, to: 1 | 2 | 3, labels: ['0','½','1'],
ticks: [{ at, label? }] (fades per item), landmarks }, wave: { street, number, zombies: [item...], big: bool, final:
bool }, look: { goo, fence, yard... }, stats: { radius (tolerance as a share of the road), power }, seed })`.
Each **item** = `{ id, kind: 'locate' | 'bounce' | 'compare' | 'equivalent' | 'sum' | 'decimal', say: 'three
quarters', show: '3/4', target: 0.75, jumps?: { unit: 0.25, count: 3 } (the bounce scaffold), options?: [...] (for
compare / equivalent), tolerance: 0.10, hints: ['arrow', 'ticks'] }`. The app generates items (§5); the engine only
runs them. Input: `setAim(x01)` (a finger drag along the road; the reticle shows on the road), `throw()`; or
`throwAt(x01)` for tests. The grenade flies a closed-form arc to the aimed x (the arc is the fun, the landing x is
exactly the aim), **bounces in unit jumps** when `item.jumps` is set (three visible hops of ¼ then the landing),
lands with a **thunk** whose size depends on the result, and explodes: `result = 'bull' (|err| ≤ 1.5 % of the
road) | 'hit' (≤ tolerance) | 'near' (≤ 2 × tolerance) | 'miss'`. Then the feedback beat: the true spot flag, the
fraction drawn as jumps, "92 % close" (always positive wording; never "wrong"). Zombies: 8–12 per wave, spawn on
progress (a cure spawns the next), shuffle slowly (≈ 20 s from spawn to the fence at the start of a street, never
faster than 14 s), a zombie that reaches the fence knocks politely, takes one pumpkin and shuffles off (`reached`
event; no other penalty). Mid-street "big wave" (3 at once) and a flagged "final wave", then a calm beat (plant a
pumpkin). Events: `aim`, `throw { item, aimed, err, result, pae }`, `cured { item, result }`, `reached { item }`,
`waveEnd { cured, reached, pae, results }`, `bigWave`, `finalWave`. `getState()` for the HUD. Juice: bull = 0.4 s
slow-mo + the big thunk + full splat + confetti + small shake; hit = thunk + splat; near = edge splat and a nudge
arrow toward the spot; miss = plop. Effects never cover the road or its labels. Summary at wave end: cured, reached,
mean PAE, per-item results, cash parts that add up (cure cash scaled by accuracy, bull bonus, effort bonus §8).
Perf ≤ 12 ms a frame on the test box; procedural art (no image assets), zombies with 6 silly looks and hats.

## 4. Zombie Lab (the lesson; app)
60–90 s, interactive, before the first street and replayable from the title. "A fraction is a number on the road."
Drag to cut the road 0→1 into 4 equal jumps; the game names them ¼, 2/4, ¾; tap where ¾ is; repeat with thirds;
then "½ is the same spot on every road" (benchmark). Max 8 words on screen at a time (Fan), animated arrows over
text. Ends with "+100 XP · Streets open". The Lab is required once; its three mini-tasks are the first three throws.

## 5. Items and the ladder (`src/skills/items.js`, pure, tested)
Denominators limited to CCSS grade 4: 2, 3, 4, 5, 6, 8, 10, 12, 100. Streets = tiers:
| Street | Tier | Kinds | Road |
|---|---|---|---|
| Maple Street | T1 halves, quarters | locate with the **bounce** scaffold, then locate | 0–1 |
| Oak Lane | T2 thirds, sixths, eighths (then fifths, tenths, twelfths) | bounce → locate | 0–1 |
| Twin Alley | T3 compare + equivalent | two zombies: zap the bigger first; "ammo" pick 2/4 for ½ | 0–1 |
| Sum Street | T4 add / subtract like denominators | aim at the sum; the road shows both addends after the throw | 0–1 |
| Decimal Drive | T5 tenths, hundredths, 0.62 | locate decimals; a decimal and a fraction twin | 0–1 |
| Pumpkin Hill | T6 improper + mixed | locate on 0–3 with every whole labelled; **bosses** = mixed numbers that take 3 hits (mixed, improper, decimal forms of the same spot) | 0–3 |
Rules: ≥ 30 % of T3 compare items are **incongruent** (⅓ vs ⅛, ¾ vs ⅜: "bigger number" aims wrong; Braithwaite &
Siegler 2018). Sums require an estimate-before-compute: the aim must be right of both addends or the hint says
"a sum is further along the road than either piece". Tolerance starts at 10 % of the road, 5 % when the tier is
"working", 3 % when secure (Battleship: a wide zone early keeps kids playing). Hint ladder after a miss on the same
item: an arrow toward the spot, then the denominator's ticks for one throw (Motion Math). Novelty across streets:
new zombies, landmarks, weather, hats; difficulty rises through the math, never through speed.

## 6. Adaptive layer (`src/skills/`: ladder, placement, frontier, governor, scouts; port Trail Blazer's shapes)
- **Lab Check** (placement) after the Lab: a staircase over T1–T5, 2 throws per tier, ≤ 16 throws, no score on
  screen; seeds the records; a **Start line** names Fluent / Working on / Up next streets. Re-checks after 14 days
  or when stale. "Race first" has no equivalent: the Lab Check is the Lab's last part (it is short).
- **Records** are per tier + kind: last 12 throws' PAE and results. **Secure** = ≥ 8 throws, hit rate ≥ 80 %, mean
  PAE ≤ tolerance / 2. A secure tier moves on the same sitting; a slip (two misses in a row) brings it back.
- **Governor** on the last 12 throws across streets: ≥ 92 % hits → tolerance tightens one step and a scout item from
  the next tier appears; 70–92 % → on target; < 70 % → tolerance widens one step, the bounce scaffold returns, no
  scouts, and the street steps back one tier. Re-evaluated after every throw.
- **Choice**: the kid picks the street among the unlocked ones (a ★ marks the recommended one); a harder street
  chosen by the kid is never auto-closed (Lomas 2017: self-chosen difficulty stays motivating). A street unlocks
  when the one before is "working" (not secure), so there is always a choice of two.

## 7. Waves, results, yard, Cure Counter
A street has 5 waves of 8–12 zombies; the 3rd is the big wave, the 5th the final wave, then the pumpkin-planting
beat. Results: neighbours cured, "accuracy 86 %" (positive), bulls, cash rows (cure, bull, effort, final-wave),
crates (earned: a podium-like rule = ≥ 80 % hits in the wave), and the Cure Counter growing the town (a new
neighbour drawn on the title's street for every 10 cures). Yard: goo colours, fence styles, pumpkins, a dog that
sits at the ½ mark, lanterns; cosmetics only, **never a "scope" that reveals ticks**. Cash: cure $120 × accuracy
factor (bull 1.5), effort bonus $40 when a near-miss is followed by a hit on the same item (Brain Points), final
wave ×2. Economy sim: a yard full in ~6 h; never 6 waves without something new.

## 8. Co-op nights (1.1)
Two kids alternate throws on one device (names on the grenades); a **Caller** mode where a parent reads the fraction
aloud and the kid aims (co-play with age-appropriate content is where the benefit is: Coyne 2011; Plass 2013).

## 9. Voice, data, sync, counter
Fractions read aloud with the shared TTS ("three quarters", "two and one half", "zero point six two"); items are a
finite set, so the natural voice clips are prepared on first use. Save `fractionFright.<id>.save` (cash, yard,
cures, streets, waves, crates), skills `fractionFright.<id>.skills` (records, placement, frontier, governor log);
both registered with registerSyncKind ('ff', 'fracs') with merge rules modelled on Trail Blazer's (purchases union,
records by later lastSeen, counts max, a reset wins); Parent Zone Family tab strip "Fractions this week · N % of the
ladder · N % accurate"; Report with the weekly %; pings 'day' / 'wave' / 'check' / 'lab'; the site's privacy line
already covers anonymous counts.

## 10. Files
fraction-fright/{index.html, manifest.webmanifest, sw.js (prefix 'fraction-fright-'), icons, src/main.js,
src/game/{engine,road,zombies,grenade,render,util}.js, src/skills/{items,ladder,placement,frontier,governor,
scouts,store,progress,sync}.js, src/ui/{title,lab,streets,hud,results,yard,parentZone,players}.js,
src/meta/{save,economy,selfUpdate,mockEngine}.js, src/data/{streets,looks,zombies}.js, docs/LEARNING-DESIGN.md,
README.md, tools/{skills-tests,engine-smoke,ui-smoke,sync-smoke,economy-sim}.mjs}. build.sh copies it to
dist/fraction-fright; netlify.toml adds the redirect, SW headers and the ignore path; site/index.html gets a third
card and the Why page a section; the dev symlink scheme stays (dev servers serve the repo root).

## 11. Phasing and definition of done
**1.0 (now):** the Lab, Maple Street + Oak Lane (locate with bounce → locate), waves with the big/final shape,
the full feedback beat and hint ladder, results, yard basics (3 goo colours, 2 fences), the Cure Counter, Parent
Zone with Report, sync of both keys, pings, tests (skills-tests, engine-smoke, ui-smoke both orientations,
sync-smoke), docs, site card. Kid-rule audit passes (no timer text, no lives, no "kill/die").
**1.1:** Twin Alley, Sum Street, Decimal Drive, Pumpkin Hill with bosses, the Lab Check, governor, scouts, crates,
co-op nights, economy sim.

## 12. Sources (consulted through abstracts and secondary summaries; see docs/LEARNING-DESIGN.md)
Siegler, Thompson & Schneider 2011 (Cognitive Psychology); Siegler et al. 2012 (Psychological Science); Schneider et
al. 2018 meta-analysis (Child Development); Jordan et al. 2013 (JECP); Hamdan & Gunderson 2017 (Developmental
Psychology); Gunderson et al. 2019 (JECP); Siegler et al. 2010 IES practice guide; Fazio, Kennedy & Siegler 2016
(PLOS ONE); Nuraydin, Stricker & Schneider 2022 (JECP); Fuchs et al. 2013/2014/2016 (JEP); Peeters et al. 2017
(Frontiers in Psychology); Braithwaite & Siegler 2018 (Developmental Science); Ni & Zhou 2005; Tian, Rahman &
Gunderson 2021; Resnick et al. 2016; Riconscente 2013 (Games and Culture); Lomas et al. 2013 CHI, 2017 CHI; Andersen
et al. 2011/2012 CHI; O'Rourke et al. 2014 CHI (Brain Points); Habgood & Ainsworth 2011 (JLS); Cutting & Iacovides
2022 (CHI PLAY); Ryan, Rigby & Przybylski 2006; Kao 2020; Kao, Ballou et al. 2024 CHI; Plass et al. 2013 (JEP);
Coyne et al. 2011; Weaver et al. 2011; ICO Children's Code; FTC 2022.
