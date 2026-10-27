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

## 13. v1.1 "The Horde" — the fun overhaul (Oct 26 2026)
Matt: "The zombie game is kind of boring." Playtest diagnosis: one zombie at a time on a 20 s shuffle, the grenade
lands on an abstract spot while the zombie walks sideways somewhere else (a goo bolt bridges the gap), every zombie is
identical, nothing to choose, nothing escalates but the math, five things to buy. The fix keeps every §0 rule and
makes the fraction the enemy's position.

### 13.1 Zombies come at you down the number line
- A zombie rises out of the graveyard fog **at its fraction's spot** (x = road.toPx(item.target)) and shuffles straight
  toward the road and the fence (p 0 → 1 along a column; drawn with depth: small and high near the horizon, full size
  at the lane in front of the road). While p < EMERGE (0.6) it is **hidden in the fog** (nothing drawn; the fog band
  is opaque there). At EMERGE it steps out, visible at its spot; it keeps coming (p = 1: knock, pumpkin, shuffles off
  sideways, as before). A grenade on its spot explodes under it: the cure is a real hit (hat flies, launch, lands as
  the neighbour, "Thanks!", walks home into the fog). No goo bolt any more.
- **One zombie per spot**: a zombie only rises onto a spot no live zombie stands on (Maple Street has three spots; with
  duplicates one throw cured a pile and a 10-zombie wave was over in 5 throws); a designated twin is the exception; a
  blocked item waits for the next free slot. Co-cure is by the same spot (the bull band), not by tolerance.
- **2–4 live at once**: wave.live (app: [2, 2, 4, 3, 3] for waves 1–5; the big wave is 4, the final wave 3 + the
  boss). fillSpawns keeps the live count up with a p stagger of 0.12 so they emerge one after another. Walk time
  unchanged (20 s, −1.5 s a wave, never under 14 s; the boss 45 s).
- **Focus** (the called zombie): the engine's default is the live zombie nearest the fence (largest p) that is not
  resolved; `setFocus(itemId)` switches it (the HUD card stack, §13.5); the `target` event fires on every change. The
  crow calls the focused fraction.
- **Throw resolution** against every live zombie, not only the focused one: best = the live zombie with the smallest
  |aimed − target|; the throw resolves against best when its share ≤ 2 × tol(best) (near or better), else against the
  focused item (a miss). Result bands and PAE are measured against the resolved item. **Every** live zombie whose
  share ≤ its own tolerance is cured by the same throw (twins, §13.2); each cure emits `cured`.
- Science: the aim point is still the math (an unseen zombie can only be found with the number); emergence is the
  true-spot feedback arriving on its own. A throw whose resolved zombie was visible when the grenade left the hand is
  `seen: true`: the app records it under kind 'seen', which never counts toward a secure tier (like the bounce
  scaffold); cash for a cure in the fog gets the Sharpshooter bonus. Hidden zombies never hurry anyone: no timer, no
  text, the walk is the same slow walk.

### 13.2 Kinds of zombies
- **Shuffler**: as before, 6 looks, hats per street.
- **Twins**: two zombies with equivalent fractions (1/2 and 2/4 in T1; 1/3 and 2/6, 2/3 and 4/6 in T2; app-made,
  adjacent slots, `twin: <other id>` on both, from wave 2 on, one pair a wave) rise at the same spot; one grenade cures
  both (the resolution rule); the engine pops "TWINS! 2/4 = 1/2" (both `show`s). Twin Alley's first lesson.
- **Boss** on the final wave (`kind: 'boss'`, `name`, `hits: 3`, `forms: [{ show, say }, …]`): 1.6× tall, a sash,
  a top hat, a name plate; walks 45 s; emerges at 0.5. Each hit (bull/hit on its spot) knocks it back (p −0.15, a
  1 s dizzy wobble) and the card shows the **next form of the same number** (symbol → words → unit sum: "3/4",
  "three quarters", "¼+¼+¼"); events `bossHit { item, left }` and `target` with the new show/say; the third hit cures
  it with the big launch. Names: Maple "Mayor Mumbles", Oak "Coach Groan" (from the item).

### 13.3 Juice, combo, chatter, finale
- **Combo**: consecutive successful throws (bull/hit) count; a miss resets, a near keeps. From ×2 a popup "COMBO ×2",
  bigger bursts; at ×4 and up the **mega splat** (a screen-wide goo wave + flash, 0.3 s). Event `combo { n }`;
  getState().combo; `throw` carries `combo`. (An in-wave combo is not a daily streak; §0's "no streak" stands.)
- **Pace**: beatSec 0.9; the phase returns to 'wave' as soon as the grenade lands (the feedback flag and jumps keep
  drawing for 1.6 s underneath); one grenade in flight at a time.
- **Chatter**: visible zombies mutter every 5–9 s (short, silly, kid-safe: "braaains… I mean maaath", "is it
  Tuesday?", "where's my hat?", "nice fence", "one more step", "I smell slime"); cured neighbours say one of
  "Thanks!", "I'm late for bingo!", "Was I asleep?", "Nice throw!". The BANNED list in tools/ui-smoke.mjs applies.
- **Grenade types** (look.grenade: 'slime' | 'lava' | 'frost' | 'disco'; cosmetic): slime = today's goo; lava =
  orange burst, ember sparks, a scorch ring; frost = blue crystals, the zombie freezes into an ice block for 0.5 s then
  shatters into the neighbour; disco = rainbow confetti and the neighbour dances home. Sound names: lava, frost,
  shatter, disco (the app owns audio). The grenade's own look changes with the type.
- **Finale**: on a final wave, when the last zombie is cured: phase 'finale' (2.5 s) before 'calm': fireworks over the
  graveyard, the wave's cured neighbours line up along the fence waving, the kid cheers; event `finale`, sound
  'fireworks'. Then the calm beat and waveEnd as before.
- **Yard in the world**: look.dog (a dog sits by the fence at the ¼ mark, since the kid stands at ½ in landscape, and
  barks at a bull), look.lantern (a lantern on the gate).
- Effects still never cover the number line or its labels; reducedMotion still means no shake / slow-mo / fewer
  particles; perf ≤ 12 ms a frame on the test box.

### 13.4 Engine contract additions (src/game/engine.js)
start(cfg): `wave.live` (max live, default 2; 4 on big; 3 on final), items may be `kind: 'boss'` (with `name`,
`hits`, `forms`) or carry `twin`; `look.grenade`, `look.dog`, `look.lantern`. New API: `setFocus(itemId) → bool`.
Events added: `throw` gains `seen`, `combo`, `cures: [ids]`, `fog` (= success && !seen); `combo { n }`;
`bossHit { item, left }`; `finale`. getState() adds `combo`, `live[].x01` / `.seen` / `.target` / `.focus` /
`.boss` / `.hitsLeft`. Sounds added: lava, frost, shatter, disco, combo, mega, bossStomp, bossHit, fireworks, mutter,
bark. Everything in §3 that is not changed here still holds (bounce hops, hint ladder, flag + jumps + "N % close",
reached/knock, stop()).

### 13.5 App additions
- items.js: WAVE_LIVE, twin pairs (`twinPairs(tier)`), `makeBoss(frac, tier, name)` with the three forms, bosses on
  the final wave only; sayTexts covers the forms' words.
- store.js: recordThrow({ seen }) → kind 'seen' (XP and the per-fraction stats still count; the ladder ignores it).
- economy.js rows: Cured, Bullseye, Close-then-cured, **Sharpshooter** (+$50 per cure in the fog), **Combo** (+$30 ×
  (combo − 1) per hit from ×2), **Twins** (+$80 per extra cure), **Boss** (+$300), Final wave ×2; still add up.
- hud.js: the card stack — the focused fraction big (today's card, tap = hear it), the other live zombies' fractions
  as small cards beside it (tap = focus + hear it); a "COMBO ×N" chip that only shows from ×2 and fades on a miss.
- results.js: the new rows, "Best combo ×N", callouts for twins and the boss.
- Yard (looks.js, yard.js): grenades (slime free, lava $2,500, frost $5,000, disco $9,000), fences (+ stone wall
  $4,000, iron $4,500), goo $1,500 / $3,500, the dog $4,000, the lantern $1,500 (≈ $35k in all); a Yard preview that shows them. Economy: still "never 6 waves without
  something new"; the combo row is capped at ×6 (+$100 a hit). Integration playtest (perfect throws): a wave pays
  $2.2–3.4k, the final wave ≈ $6k, so a flawless street ≈ $17k; a real kid at ~70 % hits earns roughly half, so the yard
  fills in a few hours of play, not 8. More yard items are the next runway step (see README).
- sfx.js: the new sound names; the mock engine (meta/mockEngine.js) supports setFocus, seen, twins, boss, finale so
  the UI smoke test can drive them; ui-smoke covers the card stack, the combo chip, the new rows and yard items, the
  chatter words in the kid-rule audit; engine-smoke covers columns, fog, multi-live resolution, twins, boss, combo,
  grenade types, finale; VERSION 1.1.0, README, docs/LEARNING-DESIGN.md (the fog as delayed feedback; seen throws
  outside the secure rule), the Why page's Fraction Fright section (one line on the horde).

## 14. v1.2 "Critter Stampede" — the bonus round (Oct 27 2026)
Matt: "a bonus round where you can basically machine gun zombie animals or something as a super fun reward."
A short, pure-arcade reward that the math earns. Kid rules hold: no kill / die / dead, no blood, no visible timer or
countdown, no ammo or energy gauge, no pressure text. The round ends when the stampede has passed.

### 14.1 When
After a wave that was not stopped early, when the wave's hit rate was ≥ 80 % (the crate rule), and always after the
final wave when the boss was cured. Parents → Options has "Bonus round: On / Off" (on by default; per player, in the
save's settings). The bonus plays between the engine's waveEnd and the Results screen; its cash is a separate row.

### 14.2 What (src/game/bonus.js, the bonus agent; its own canvas `#bonus-stage` above the game canvas)
`createBonus(canvas, { onEvent, reducedMotion, simSpeed })` → `{ start(cfg), aim(x, y), fire(on), stop(), destroy(),
getState(), debugStep(n) }`.
- start({ look: { goo, fence, fenceColor, sky, grenade, kid }, seed, stampede: { count (default 30), goldAt (0.6) },
  street: { id, name } }): the same yard at night (reuse render.js: backdrop, fence, kid, particles, spriteText),
  an intro banner "BONUS ROUND" / "CRITTER STAMPEDE!" (1.2 s), then the stampede: critters run across the yard
  between the road and the fence and along the lane behind the road, left→right and right→left, bats and crows in
  arcs through the air; 2–5 on screen at once, the whole herd in ≈ 20 s; one **golden critter** (goldAt = share of
  the herd) worth more; then the outro "STAMPEDE OVER" with the tally (1.6 s), `bonusEnd`.
- Critters (procedural, 6 kinds, zombie look = green-grey with one glowing eye and a limp; cured look = natural
  colours, a little party hat, runs off happily): squirrel, raccoon, bunny, chicken, bat, crow.
- The **Slime Sprayer**: `aim(x, y)` in css px (the finger), `fire(true)` while the finger is down: a stream of goo
  pellets from the kid's cannon toward the aim point, ≈ 12 pellets/s, slight spread, muzzle pulse, the cannon tracks
  the aim; `fire(false)` on release. A pellet that touches a zombie critter cures it: a pop, a small goo burst, the
  critter flips to its cured look and scampers off (it never stops the stampede); misses leave small splats that fade.
  Cash: $15 a cure, the golden critter $150; getState().combo = cures without a stray pellet in between (cosmetic:
  "×5" popups from ×3; no cash). Big effects only on success: pops, confetti on the golden one, a small shake there.
- Events: `bonusStart`, `cure { kind, gold, cash, combo, cured, total }`, `bonusEnd { cured, total, cash, gold (bool),
  bestCombo, durationSec, stopped }`, `sound { name, vol }` with names spray (looped while firing: emit `sprayOn` /
  `sprayOff` instead), pop, gold, stampede, bonusEnd, bonusStart.
- getState(): { phase: 'idle'|'intro'|'run'|'outro'|'done', cured, total, passed, cash, gold, combo, bestCombo,
  firing, aim: { x, y } | null, timeSec, critters: [{ kind, x, y, zombie }] }.
- reducedMotion: fewer particles, no shake. Perf ≤ 8 ms a frame on the test box. Portrait and landscape.
- Harness `bonus-dev.html?seed=&count=&rm=1&sim=` and `tools/bonus-smoke.mjs`: the phases, a cure by a pellet,
  the golden critter, bonusEnd's tally and cash (15 × cures + 150 × gold), stop(), reduced motion, perf, portrait.

### 14.3 App
main.js: after waveEnd (not stopped, bonus on, hit rate ≥ 80 % or the boss cured) → `go('bonus')`: the bonus canvas
shows, pointerdown/move = aim + fire(true), pointerup = fire(false); on bonusEnd the cash is banked (save.cash +=
cash; save.bonus = { rounds, cured, gold }), the pending results gain `bonus { cured, total, cash, gold }`, a cash row
"Bonus round" (the rows still add up: the wave total + the bonus), then `go('results')`. The Results screen shows a
callout "Critter Stampede: N cured" (and "the golden one!"), the row, and the total. HUD: the bonus draws its own
banner and tally; the fraction HUD is hidden. Pause: a tap on the pause button stops the bonus (stop() → bonusEnd with
what was cured). sfx.js: spray loop (sprayOn/sprayOff), pop, gold, stampede, bonusStart/bonusEnd. Parent Zone:
the Bonus round toggle under Options. Pings: the bonus counts inside the wave ping (no new kind). Docs: README,
LEARNING-DESIGN (a reward earned by accuracy, short, success-dependent juice; not a loop a child can grind:
it only follows a wave), SPEC; VERSION 1.2.0; ui-smoke: the mock engine wave with every throw a bull → the bonus
opens, a scripted spray cures critters, the results row adds up, the Options toggle off → no bonus.

## 15. v1.3 "Blast" — zombies get blasted, with a Gentle mode (Oct 27 2026)
Matt: "The curing thing is less satisfying than killing zombies." The cure was our reading of the kid rules, not a
rule; the rules that stay: no blood, no bones, no gore, never the words kill / die / dead / death on screen. Cartoon
destruction in green goo (the Plants-vs-Zombies line) is the default; **Gentle mode** (Parents → Options, this device)
brings the cure back.

### 15.1 Blast (the default; `look.gentle: false`)
- **Zombie**: a hit **blasts it apart**: a fat squelch + a low thump, the body pops (0.12 s squash then burst), its
  hat, both boots, both arms and the head fly off as separate cartoon parts with spin and gravity, bounce once on the
  lane and fade; a shower of goo blobs and a goo ring; the torso lands in a heap and **melts into a steaming puddle**
  (1.2 s, wisps) that stays on the lane for the wave (at most 8 puddles, oldest fades). Screen shake (0.5; none with
  reducedMotion), a flash on a bull. The **boss**: each hit knocks off a part (hat, then an arm, then the sash) with
  the dizzy wobble; the third hit is the full blast at 1.6× with a longer shake and a bigger puddle. Twins blast
  together. The **finale**: the lane is a goo lake with hats floating in it; fireworks; the kid cheers (no
  neighbours line-up). Sounds: `blast` (replaces `cure`), `blastBig` (the boss / a bull), `melt`, `part` (a part
  landing). Words on screen: "ZAPPED!", "SPLAT!", "BLASTED!" — never kill / die / dead / death.
- **Critters** (the bonus): a hit **pops** them into a goo burst plus a puff of fur or feathers (kind-coloured),
  a cartoon "POP!" ring, the part that is left (a bunny ear, a chicken comb, a bat wing) spins off; no party hat, no
  cured critter running away. The golden one bursts into gold confetti. Sounds: `pop` as now, `poof`.
- Engine events keep their names (`cured`, `cure` in the bonus, cash rows unchanged): the app's **verb** changes the
  words: Blast = "Zombies zapped", "zapped" / "blasted", "Critter Stampede: N popped"; Gentle = today's "cured".
  `look.gentle` on `start()` of both the engine and the bonus picks the animations; the engine's `getState()` echoes
  `gentle`.

### 15.2 Gentle mode (`look.gentle: true`)
Today's cure: the launch, "Thanks!", the neighbour walks home, the finale line-up, the party hats; the Cure Counter
words. Parents → Options → "Gentle mode" (off by default; this device's setting like reduced motion), with the sub
"Zombies are cured and walk home instead of being blasted".

### 15.3 App
settings.gentle (default false); `look.gentle` passed to the engine and the bonus; `app.verb` → the title's counter
("ZAPPED 37" / "CURED 37"), the results ("8 zapped", "Zombies zapped: 47", "Critter Stampede: 24 popped"), the cash
row labels ("Zombies zapped" / "Neighbours cured"), the coach card and the Lab's last line ("the zombie gets
blasted" / "turns back into a neighbour"); the Why page and the README say both modes exist and what the default
is; the kid-rule audit (ui-smoke BANNED) still passes in both modes; engine-smoke / bonus-smoke run both modes.
