# The Lab: the meta-game across all five games, build spec (v1)

> Owner (Nov 2): "One meta-game across all five games: one Lab profile per child, one Lab coin wallet, a home base with an avatar
> and a pet that level up whichever game is played, Lab XP with a visible bar. A daily loop: three rotating quests across the
> games, finishing all three opens the Lab crate (variable rewards, a guaranteed rare at most every 7 crates, odds in the Parent
> Zone, cosmetics only, never bought with money), a streak freeze a week and a second one earned by finishing a day's quests.
> Competition: a weekly family leaderboard with 'most improved', a weekly family goal meter, ghost races in Trail Blazer.
> Juicier moments: combos in every game, an XP bar in every HUD and on every results screen, a Wagon West cliffhanger.
> Per-game quick wins: Spell Jump's Friday Test as a boss event with a certificate, Trail Blazer's Lab-coin cosmetics and ghost
> time attack, Fraction Fright's tower and fence upgrades and bosses, Build Crew as the payoff, Wagon West's choice moments."
> The orchestrator's decisions on the proposal are recorded in §1.2 (the proposal, the decision, the reason) so the owner can
> overrule any of them. §0 is the audit of what already exists (this spec builds on it, never duplicates it); §1–§2 are the
> design and the data; §3–§6 are the build contract the agents implement; §7 is the test plan; §8 is the short list of questions.

The Lab is a sixth place on learninglab.fun, at **learninglab.fun/lab/** (folder `lab/`; `build.sh` and `netlify.toml` will copy
it to `dist/lab/` like the games, see §6.2). It is **not a game**: it is the layer that sits across the five games (Spell Jump at
/spell-jump/, Trail Blazer, Fraction Fright, Wagon West, Build Crew) and gives a child one place that remembers everything they do,
one coin purse, one avatar and pet, a daily reason to open a game they skipped, and something to share with the family. The games
stay what they are: nothing a game teaches, scores or pays is touched; the Lab only listens (`lab.report`) and decorates
(`lab.cosmetics`). Static ES modules, no build step, shared modules imported at runtime from `/spell-jump/src/` as every game does.

Audience: 4th graders (9–10) and their younger and older siblings, an iPhone in landscape (also portrait, iPad, laptop), the same
family devices and the same family code as the five games.

## 0. Audit: what already exists (file references)

Everything the Lab needs that already exists is **reused by import, never copied**. The one-line verdict per row says what the Lab
does with it. Paths are from the repo root; `car-jump/` is served at `/spell-jump/` (the root symlink `spell-jump -> car-jump` is for
local dev servers only).

### 0.1 Profiles, saves and the family (reuse as is)

| Thing | Where | What it is | The Lab |
|---|---|---|---|
| **Profiles** | `car-jump/src/spelling/profiles.js` | One family record at `spellJump.family`: up to `MAX_PLAYERS` = 4 players `{id, name, color}` (first names only, `cleanName`: letters, apostrophe, hyphen, ≤ 12), the shared PIN (`checkPin`, `hasPin`), per-player options, `removedPlayers` tombstones. Every game reads it through this module (each has a thin `src/ui/players.js`). | **The Lab profile is this profile.** No new player list, no new PIN. A child's Lab data is one more per-player document next to their game saves. |
| **Game saves** | `car-jump/src/meta/save.js` (`spellJump.<id>.save`, `.words`), `trail-blazer/src/meta/save.js` (`trailBlazer.<id>.save`, `.facts`), `fraction-fright/src/meta/save.js` (`fractionFright.<id>.save`, `.skills`), `wagon-west/src/meta/save.js` (`wagonWest.<id>.save`), `build-crew/src/meta/save.mjs` (`buildCrew.<id>.save`) | Per-player `normalize()`d JSON; every access try/catch; a corrupt save is kept at `<key>.corrupt`; `resetAt` makes a Parents → Reset win a merge; writes call `localWrite(key)` (`car-jump/src/sync/notify.js`). | The Lab doc follows the same rules (§2.1, §3.4). The Lab **never reads or writes a game save**; games tell it what happened (`lab.report`). |
| **One origin** | all games are served from learninglab.fun | `localStorage` is shared by every game on a device. | The Lab doc is `learningLab.<id>.lab`, read and written by any game page and by `/lab/`. |

### 0.2 Family sync (extend by one kind)

| Thing | Where | What it is | The Lab |
|---|---|---|---|
| **Kinds** | `car-jump/src/sync/protocol.mjs` | `PLAYER_KINDS = ['save','words','tb','facts','ff','fracs','ww','bc']`; `parseKey` takes `<playerId>.<kind>`; `PUT` with `rev = stored + 1` or 409 with the stored doc; `GET /api/family/:code` returns every player's every kind; `MAX_BODY` 512 KB; blob key `<CODE>/<playerId>.<kind>`. (The file's header comment still lists six kinds: stale, fix it while adding `lab`.) | **New kind `lab`** (§2.1): one line in `PLAYER_KINDS`, one in the `parseKey` regex, the error text, the header comment. `netlify/functions/family.mjs` needs only its comment updated. |
| **Client** | `car-jump/src/sync/client.js` | `registerSyncKind(kind, {storageKey, merge, canon})` (line 53); a local write marks the key dirty, the push runs 2 s later; a pull runs on visible / online / every 60 s and **writes every registered kind of every family member into this device's `localStorage`**; a 409 or a pull while dirty runs the kind's `merge`; unknown kinds are kept in the metadata but not pushed. Registration after `createSyncClient` works (the registry is read on every call). | `registerLabSync()` is called by the Lab store on `attach`; then it calls `localWrite` for the family's existing lab docs so they are marked dirty. **No game's sync module changes.** Because every device mirrors every sibling's lab doc locally, **the family board and the family goal are computed on the device from local reads**: no new server endpoint, no data about other families (§1.2 D3, §8 Q1). |
| **Merge style** | `car-jump/src/sync/merge.js`; `wagon-west/src/meta/sync.js` (`mergeWw`, the farm: "savings / gold earned and spent counters each max"); `trail-blazer/src/meta/sync.js` | Pure `merge(local, remote) → merged`; unions and maxes; the later doc wins only for single-valued fields; a reset wins whole; `mergeStreak` (merge.js) is shared. | `mergeLab` (§2.8) follows it, with one improvement over plain max counters: per-device counters, so two offline devices never lose or double-count a coin (§1.2 D2). |
| **Family codes** | `car-jump/src/sync/codes.js` | 8 characters `XXXX-XXXX` from an alphabet without look-alikes; `deviceId`. | Unchanged. The Lab keeps its own short device key (§2.1 `dev`) because `deviceId` only exists once a device has joined a family. |
| **Stats pings** | `netlify/functions/stats.mjs`, `car-jump/src/stats/server.mjs`, `car-jump/src/meta/pings.js` | Anonymous counts; `GAMES = {spell-jump, trail-blazer, fraction-fright}`. **Finding:** Wagon West (`wagon-west/src/main.js:162`, game `'wagon-west'`) and Build Crew (`build-crew/src/main.js:62`, `'build-crew'`) send pings that the server answers 400 (unknown game), so they are silently uncounted today. | The Lab sends **no pings** (no new data leaves the device). The WW/BC finding is outside this spec: §8 Q9. |

### 0.3 The shared streak, XP, daily loop, crates and the family board (reuse the rules, extend the streak)

| Thing | Where | What it is | The Lab |
|---|---|---|---|
| **Shared streak** | `car-jump/src/meta/engagement.js` `refreshStreak`, `completeDay`, `streakNow`, `coverGap`, `STREAK_MILESTONES` (`[3,7,14,30,60,100]`, each pays a crate); merge `mergeStreak` in `merge.js` | A day counts once per game when that game's own daily thing is done; **one shield per ISO week** covers one missed day, applied when the game next opens; two misses in a week break it. Five saves hold it today, one per game: Spell Jump `save.streak` (main.js:419, the daily mission), Trail Blazer `season.js raceDayDone` (the first finished race), Wagon West `main.js:1620` (a finished leg), Build Crew `app/rounds.js:198` (a finished job); **Fraction Fright has none on purpose** (its SPEC §0: "No streak in this game", ICO Children's Code standard 13). Learning design rows 6 and 12 of `wagon-west/docs/LEARNING-DESIGN.md`: a habit cue, never a punishment, "never takes anything away". | **Extended, not paralleled** (§3.5): `engagement.js` gains an optional banked **bonus freeze** (earned by finishing a day's quests) honoured by `coverGap`; `mergeStreak` unions its two day lists. The weekly shield is **already** "one free per week for everyone"; the Lab surfaces it (§5). The Lab's own streak is one more instance of this same object (§1.2 D9). Per-game streaks and every game's streak code stay as they are. |
| **XP and levels** | `car-jump/src/data/cosmetics.js` (`LEVEL_XP`, 20 levels, `XP`), `engagement.js addXp`, `main.js:395` (title chip) | Speller XP, Spell Jump only. Trail Blazer keeps its own fact-ladder XP (`trail-blazer/src/facts/store.js XP`), Fraction Fright its skills XP (`skills/store.js`), Wagon West none. Three scales, none cross-game. | **Lab XP is new and separate** (§2.3). Speller XP and its level cosmetics stay in Spell Jump untouched (§1.2 D11). |
| **Daily loop** | `car-jump/src/meta/daily.js` (one seeded run a day), `goals.js` (3 rotating Spell Jump goals paid in $), `achievements.js` (12 badges); Trail Blazer `season.js dailyFor` (the Pit Challenge), Wagon West `journey/challenge.js` (the daily trail challenge) | All per game, all paid in that game's own currency. | **Lab quests are new and cross-game** (§2.4); the per-game dailies keep running. |
| **Crates and cosmetics** | Spell Jump: `engagement.js rollCrate / openCrate` + `data/cosmetics.js` (cash 60 / sticker 25 / skin 12 / jackpot 3, pity 5, **pays in $**), skins + stickers. Trail Blazer: `src/meta/crates.js` (3 tiers, rarity weights, pity, duplicates, the Garage Wall + set bonuses) + `data/cosmetics.js`, `data/paints.js`. Wagon West: `ui/looks.js` (paint / flag / bugle / hat / decor, bought with trade tokens 8 / 14 / 20 or dropped by crates). Fraction Fright: `data/looks.js`, **no crates in code** (specified in its SPEC §7, never built). Build Crew: `defaultCrates()` stub in `save.mjs`, no crate UI. | Four different crate implementations, each paying or granting in its own world. | The **Lab crate is a separate, sixth crate** (§2.5): cosmetics only, a different pity rule; the games' own crates are untouched. The Lab reuses their rolling idioms (weighted rarity, pity, duplicate rule) and `car-jump/src/meta/rng.js` (`hashString`, `mulberry32`). |
| **Family board** | `engagement.js weeklyBoard / boardNudge`, `car-jump/src/ui/players.js:87,107` | Spell Jump's weekly board on the player picker: words mastered, then streak, then best jump; ranked, medals and a crown; derived locally from the family's saves. | Unchanged. The **Lab board** (§2.6) is a different, cross-game, XP-based board in fixed order (no ranks). |

### 0.4 Each game's economy, spend loop, parent zone and rules (untouched; the Lab adds beside them)

| Game | Own currency and economy | Garage / upgrades / spend loop that exists | Parent Zone | Kid-rule exceptions already in the game |
|---|---|---|---|---|
| **Spell Jump** | `$` cash, `src/meta/economy.js` (cars, 5 upgrades), crate cash; `tools/economy-sim.mjs` | Garage: cars, upgrades, skins, stickers; Friday Test = `src/spelling/testMode.js` (all words once, audio only, one attempt each, no hints), trophies and Week Champion (`engagement.js addTrophy / checkChampion`) | `src/ui/parentZone.js` (tabs Family code · Words of the week · Report · Options) | "No lives/energy, no countdown nags, no purchases, **no rewards tied to minutes played**, no notifications" (SPEC "Not doing") |
| **Trail Blazer** | `$` cash, vehicles up to $56M, upgrades `300 × 1.45^level`, `src/data/runway.js`; `tools/economy-sim.mjs` targets | **Garage upgrades already fully exist**: 4 upgrades × 10 levels per vehicle (`data/upgrades.js`), 8+ vehicles (`data/vehicles.js`), paints, decals, rider gear (helmet, suit, horn, trail, flag), the Garage Wall. **Ghost already exists**: `save.ghosts[trailId]` = the best finished run sampled every 0.1 s, drawn translucent (`engine.js start({ghost})` accepts `[[t,x,y,a]…]` or `{trace, vehicle, paint}`), HUD "vs your best ±s", results "Beat your ghost by 1.3 s!"; ghosts sync inside the `tb` doc (`mergeTb`: the faster trace per trail), so **a sibling's ghost is already on this device after a sync**. | `src/ui/parentZone.js` | A visible race time (`#hud-time`), the gap chip (`#hud-ghost`) and a start countdown (`countdown {n}` events) exist in races. The Lab's time attack must show none of them (§4.2). |
| **Fraction Fright** | `$` cash from cures (`src/meta/economy.js`: cure $120, bull +60, combo, boss +300, final ×2) | **The spend loop exists**: the Yard (`data/looks.js`, `ui/yard.js`, `buyYard`): grenades, goo, fences (picket, stone $4,000, iron $4,500), the dog, the lantern, ≈ $35k in all, which a real kid empties in a few hours (README: "more yard items are the next runway step"). **Bosses already exist** (`kind:'boss'`, 3 hits, forms symbol → words → unit sum, on every street's final wave; Pumpkin Hill's are mixed numbers) and **twins** (equivalent fractions, one grenade cures both). | `src/ui/parentZone.js` | "**No progress meters, no side collectibles during a wave**" (SPEC §0, Lomas / UpGrade); "**no streak**" (§0); the HUD has no timer or counter, only the card stack and a combo chip from ×2. |
| **Wagon West** | `$` dollars + trade tokens; **tightly tuned**: `src/journey/economy.js` (`START` $45, `PAY`, `TOKENS`, `UPGRADES`), the 1.3 TARGETS and v1.5's `refMiles` re-tune, enforced by `tools/economy-sim.mjs --check` | Wagon upgrades (cover, tires, barrel: tokens or cash), looks (paint, flag, bugle, hat, decor), the homestead farm (`journey/homestead.js`), 126 trail cards + sets. **Choices already exist**: three forks (Fort Hall, The Dalles incl. the Barlow Road toll, South Pass incl. the Sublette dry cutoff), river crossings (ford / float / ferry with soaked sacks) | `src/ui/parentZone.js` | The canonical list is `wagon-west/SPEC.md` §1 (below). Rows 6 and 12 of `wagon-west/docs/LEARNING-DESIGN.md`. |
| **Build Crew** | None. Rewards are jobs → machines / paints / decals / horn (`save.rewards`), `unlockAll` Parent toggle | Ten jobs, three machines (skid steer, excavator after job 2, crane after job 5), the sandbox (64 bodies, terrain stamps), **one saved site per builder** (`save.yard`, bounded; the thumbnail stays on the device and never syncs). The dump truck, forklift, wheel loader, bulldozer and telehandler are **design only** (`build-crew/SPEC.md` §1) | `src/app/parent.js` (the shared zone) | Pure play: no spelling or math gates; "no timers, countdowns, pressure text or fail screen". |

**The canonical kid rules** (`wagon-west/SPEC.md` §1, restated in every game's SPEC): no lives, energy, visible timers, countdowns or
pressure text; no fail states (a miss costs a slow day or the fair price, never the leg); nothing punishes stopping; no
"kill / die / dead" (and no blood, no guns); no external links; **no multiple choice** (answers are typed); native inputs only inside
the PIN-locked Parent Zone (kids type on the shared on-screen keyboard `car-jump/src/spelling/keyboard.js`). Plus the two learning-design
rows the Lab is built around:
- **Row 6**: *rewards never gate the progress, and the math gates only the bonus* (Deci, Koestner & Ryan 1999: expected tangible
  rewards for doing a task undermine interest; Habgood & Ainsworth 2011: intrinsic integration). Everything the Lab gives is a
  cosmetic or a flourish; no game's content, level, route or ladder is ever behind a Lab item (§1.4).
- **Row 12**: *a habit cue, not a punishment* (Lally et al. 2010; Wood & Neal 2007): the pull is "what is new today", never "come
  back or lose it". Nothing in the Lab expires in a way the child sees as loss (§1.3).

### 0.5 Audit findings that change the proposal

1. **Trail Blazer's own-best ghost exists and its sibling data already syncs.** The new work is a time-attack mode and a ghost
   picker (mine / a sibling's), not ghost recording or a new sync kind.
2. **Fraction Fright's spend loop exists** (the Yard). The real gap is the runway: ≈ $35k is spent in a few hours, and there is no
   tower. Bosses (including mixed numbers) and twins also exist; the new boss is an *equivalence* boss on Twin Alley.
3. **Fraction Fright forbids progress meters during a wave and any streak.** The Lab's "XP bar in every HUD" cannot go into a wave
   HUD; it goes on the title, the streets screen, the results and the yard (§1.2 D5, §4.3).
4. **Trail Blazer's HUD shows a race clock and a gap chip and counts down at the start.** These are pre-existing exceptions; the time
   attack removes all three (§4.2).
5. **There are five streak instances, no cross-game one.** The Lab adds one cross-game instance of the same object and the bonus
   freeze to the shared rules; the games' own streaks are not changed.
6. **Three XP scales, no Lab XP; four crate systems, none cosmetics-only.** Both are new in the Lab.
7. **Build Crew has nothing to spend on and its extra machines are design only**: the Lab-coin "payoff" needs the BC stream to
   build the dump truck and the forklift (physics, scene, HUD rows) and four blueprints, or the shop would sell air (§4.5).
8. **`PLAYER_KINDS`' header comment is stale and WW / BC pings are rejected** (§0.2): housekeeping, not Lab work.

## 1. Design, and what the child sees

### 1.1 The idea in one paragraph

A child opens any game and plays it exactly as before. A small **Lab pill** (their level and an XP bar, a flame when they are on a
roll) sits in that game's HUD; at the end of a round the results screen adds one strip: *"+14 Lab coins · 40 XP to level 7 · 2 of 3
quests"*. Whatever they play fills the same purse (**Lab coins**) and the same bar (**Lab XP**), grows the same **avatar and pet** on
their **home base**, and moves three **daily quests** that point across the games (two in games they actually play, one at a game
they have not touched lately). Finishing all three opens the **Lab crate** (a surprise cosmetic). Coins are spent in the **Lab shop** on
looks that show up *inside the games* (a Spell Jump car skin, a Trail Blazer paint, a Wagon West wagon cover, a Fraction Fright tower
flag) and, as the big prizes, on **Build Crew's new vehicles and blueprints**. The family sees each other's week on a gentle board
and fills one **family goal meter** together. Nothing is a test, nothing runs out, and no game is harder or easier because of the Lab.

### 1.2 Decisions on the owner's proposal (the proposal, the decision, the reason: overrule any of these)

| # | Proposal | Decision | Reason |
|---|---|---|---|
| D1 | "One Lab coin wallet … spent on cosmetics across games." | **Lab coins are a separate currency**, earned in every game by an exchange table (§2.2) tuned so an hour in any game earns about the same (600 ± 15 % coins/hour at 70 % first-try; Build Crew a little less by design), and **spent only in the Lab shop**. Lab coins **never enter a game's own economy** (Spell Jump $, Trail Blazer cash, Fraction Fright cash, Wagon West dollars and tokens): no game imports the wallet, the Lab imports no game economy module, no price in a game changes. | The in-game economies are tuned (Wagon West's 1.3 TARGETS and v1.5 `refMiles` re-tune under `economy-sim --check`; Trail Blazer's runway to $56M; Spell Jump's car prices). A second source of money into any of them would silently break all of that, and would let a child buy a game's progress with another game's play (row 6). |
| D2 | "Sync as a new player kind `lab` with union/max merge rules (earned/spent counters merged by max, as Wagon West's farm does)." | New kind `lab`, **union / max everywhere**, but **earned is a per-device counter map** (`dev: {deviceKey: {c, x}}`, summed) and **spending is the `paid` map** (item → price paid, a union); the wallet is *earned − Σ paid*. | Plain max-merged `earned` and `spent` lose coins when two devices earn while offline (A: 100 → 150, B: 100 → 170, max = 170, A's 50 vanish) and double-spend when two devices buy different things from the same balance. Per-device counters (a grow-only counter, summed) lose nothing, `paid` charges every purchase, and a rare overspend across two offline devices is **forgiven** (the counter is raised so the wallet reads 0), never charged back. Still union/max, still commutative, still a one-line registration. |
| D3 | "Weekly family leaderboard by first name (resets Monday), 'most improved'; a weekly family goal meter that unlocks a Lab item for everyone." Classroom boards later. | **Family only.** The board and the goal are computed on the device from the family's own mirrored lab docs. **Classroom leaderboards and a class goal meter are not built**; they are a decision for the owner (§8 Q1). | A class board needs other families' children's first names and weekly numbers on the server. The current sync stores one blob per family code and never serves another family's data. Sharing across families is a **privacy decision** (consent, retention, who sees whose child), not a build detail. |
| D3b | (the board) | The board lists children in **a fixed order (the player picker's order), never ranked**, with crowns for *Most* and *Most improved* (and a family-goal bar above). | A ranked list always has a last place; a fixed order with crowns does not (row 12: no loss feeling). A younger sibling tops *Most improved* when their week beats their own usual by more than the others' (§2.6). |
| D4 | "Wagon West cliffhanger: lock the next stop until tomorrow." | **Do not lock.** End each leg's results on a **preview of the next stop** (its painting, one true line, "Next time: the ferry at the Kansas River") and, after three legs in a day, a gentle line: *"That's a good place to stop for today."* The Next-leg button stays. | A lock is a gate on play and punishes continuing; it contradicts "stopping is always fine and playing is never gated" and the v1.5 goal that kids have more to play. The preview is the habit cue (row 12) without the gate. |
| D5 | "A visible Lab XP bar in every game's HUD." | In every game's HUD **except Fraction Fright's wave HUD**; in Fraction Fright the bar is on the title, the streets screen, the results and the yard. | FF's SPEC §0: no progress meters or side counters during a wave (a progress meter cut engagement ~15 %, Lomas / UpGrade). The bar is on every *results screen* of all five, and on every HUD where the game allows a meter. |
| D6 | "Combo multipliers across all games." | Combos in **Spell Jump, Trail Blazer, Fraction Fright and Wagon West** (they have right and wrong answers). **Build Crew has no combo**: it has no answers, so it reports units, not first tries; its "moment" is a met build challenge. Combos never apply to the Friday Test or the Qualifier (they are assessments). | A combo needs a first-try signal. Pretending "first try" in a physics sandbox would invent a failure state ("you reset, so it broke") in the one game with none. A test must measure, not reward streaks. |
| D7 | "Lab coins on every answer." | Coins are **credited the moment they are earned** (a child who stops keeps everything) but are **shown only on results screens and in the Lab**, never as a per-answer popup in a HUD. The HUD shows XP and the flame only. A miss earns **half (rounded up)**, never zero. | Moment-to-moment coin popups make the reward the point of the answer; the testing-effect games must keep the answer the point. XP is competence feedback (informational); coins are shown in aggregate and late. (Deci, Koestner & Ryan 1999; this is the main design risk of the Lab, §1.5 and §8 Q4.) |
| D8 | (none) | A **daily coin cap of 1,800** (3 hours of play at the baseline). Past it, answers and units still earn XP and move quests; coins pause, and the Lab says once: *"Plenty of coins today. They're all safe; more tomorrow."* The cap is shown in the Parent Zone. | Protects the shop economy from a marathon or a bot and a child from a reason to play four hours. It never touches XP, quests, crates or any game. |
| D9 | "Streak freeze … carried in the shared streak (extend engagement.js rather than a parallel streak)." | The freeze is added **to `engagement.js`** (§3.5); the **Lab's cross-game streak is one more instance of the same streak object** (a day counts when any game reports its day, §4); the five existing instances are unchanged. The streak shown in the Lab is the Lab's; each game's title chip still shows its own. | There are already five instances (0.3). Replacing them would change eight things in five games for no gain; adding the freeze to the one shared engine gives every instance the same rule. Unifying what the games *display* is a follow-up (§8 Q2). |
| D10 | "Three rotating daily quests … finishing all three opens the Lab crate." | As proposed (§2.4–§2.5). Quests that are not finished **disappear quietly the next morning** (no "expired", no "failed", no red). One **swap** a day. No clock or "resets in" text anywhere. | Row 12; the canonical no-timers rule. |
| D11 | "Lab XP." | Lab XP is **a new number**; Spell Jump's speller XP, Trail Blazer's fact XP and Fraction Fright's skills XP are unchanged and keep their own displays. Spell Jump's title chip stays "Speller Lv 4"; the Lab pill says "Lab Lv 7". | Folding or renaming the old scales would change save semantics (`grantEarned` unlocks Spell Jump cosmetics by speller level) and confuse existing players. |
| D12 | "Rare at least every 7 crates." | Crate odds **common 86 / rare 12 / epic 2**; the **7th crate after the last rare-or-better is a guaranteed rare-or-better** (pity). Mean 4.7 crates per rare-or-better. Odds and the pity rule are shown in the Parent Zone (§5.3). Duplicates re-roll once, then pay back coins at half price. | Matches "common most days, rare sometimes"; the max gap of 7 holds (Monte Carlo, §2.5). Free, cosmetic, once a day, never bought with money. |
| D13 | "Fraction Fright: fence/tower upgrades bought with zapped-zombie coins (its missing spend loop)." | Fraction Fright keeps its own cash for **structures**: a new `tower` yard kind (3 levels) and two higher fences, bought in the existing Yard with cure cash. **Lab coins buy only the *looks* on top** (fence finishes, tower flags and lights). | The spend loop exists (0.4); the gap is runway. Two currencies on one object, one structural and one cosmetic, keeps D1 (no Lab coin in a game's economy). |
| D14 | "Build Crew becomes the payoff: new vehicles and blueprints unlock with Lab coins; the existing ten jobs and sandbox stay open." | As proposed: only **new** content is behind Lab coins (the dump truck, the forklift, four blueprints, paints); the ten jobs, the sandbox, the three machines and every existing reward stay exactly as they are and open to everyone. Items without an implementation are hidden, not sold (§3.3 `LOOKS_READY`). | "Nothing already playable gets locked." A shop that lists a vehicle the game cannot drive is a broken promise to a child. |
| D15 | "Ghost time attack with no visible timer (the ghost is the clock)." | As proposed, strictly: in the Chase mode there is **no race clock, no gap chip and no start countdown**; the car and the ghost both start on the child's first GAS press. The result line after the race may state the margin ("Mia's ghost was 1.3 s ahead. Nice chase!"). | Canonical rule: no visible timers or countdowns. A post-race result is not pressure; the existing results screens already print times. |
| D16 | "Friday Test as a boss event." | The test **mechanics are untouched** (audio only, one attempt, no hints, no combo, no coins-per-word beyond the normal table). The boss is the frame: a character that loses a wobble per right word, a **ceremony that every score gets** (Gold ≥ 90 %, Silver ≥ 75 %, Bronze ≥ 50 %, otherwise a "Brave Speller" ribbon), "Most improved" ribbon vs the Qualifier. A printable certificate from the Parent Zone. | A test must stay a valid measure (Spell Jump's R1–R2) and must have no fail state. |
| D17 | "Wagon West: add two more small choice moments per route." | **Six** choice moments (two on the emigrant trail, two on the California Trail, two on the Gold Road), each **expected-value neutral on cash and food** so `economy-sim --check` stays green with the 1.3 TARGETS untouched (§4.4). | The economy is the most tightly tuned thing in the repo; a choice must be a real choice, not a hidden tax or a free win. |

### 1.3 The kid's experience, in order

1. **First open of any game after the Lab ships.** Nothing changes until the first answer. The HUD gets the Lab pill ("Lv 1", a bar at 0).
   After the first round the results strip appears with "Welcome to the Lab" and a free poster for that game for the home wall
   (`home.poster.<game>`, a gift for **trying** a game: the first of five).
2. **During play.** The bar creeps up. Three first-try answers in a row light the **flame** (it appears small at 2 and shows "×2" from 3 on, because
   the next answer after three first-tries pays double coins); five make the game's **moment** ("Perfect Launch" in Spell Jump, "Perfect Landing"
   in Trail Blazer, "Bullseye Burst" in Fraction Fright, "Trail Cheer" in Wagon West): a ≤ 1.2 s flourish the game draws. A miss lets
   the flame fade on its own in ~1 s: **no message, no "lost", no counter dropping.** The combo is per round; the next round starts clean.
3. **Results.** The game's own results, then the Lab strip: coins this round, "40 XP to level 7", the quest chips (✓ done, ○ not yet),
   and, when all three are done, "Lab crate!" (tap to open). Level-ups get the same celebration in every game (a short banner and the
   shared sound; the new unlock named).
4. **The Lab (home).** Tap the pill anywhere, or open learninglab.fun/lab/. The home base: the child's avatar and pet, the wall (posters,
   trophies, the gallery frame), today's three quests, the crate, the shop, the family board and goal, the gallery. All of it reads in
   present tense: *what you have*, *what's new today*, never *what you missed*.
5. **Tomorrow.** New quests appear. Yesterday's unfinished ones are simply gone; the streak flame holds through one missed day a week
   (the weekly freeze, applied silently: "Your freeze kept your streak!") and through a second if a day's quests earned a spare. If a
   streak does end, the Lab shows **best streak** and "Day 1 today", nothing else.
6. **Stopping.** Always fine. Nothing is waiting except what the child earned.

### 1.4 What is never behind the Lab (so row 6 holds)

No game's questions, ladder, facts, words, levels, streets, trails, legs, jobs, machines (the three that exist), the sandbox, routes,
forks, the farm, or any score is ever locked, scaled or made easier by a Lab item, level or coin. Lab items are looks (skins, paints, stickers, covers,
flags, outfits, avatar, pet, wall), one kind of *content addition* in one game (Build Crew's **new** vehicles and blueprints), and
nothing else. A Lab item never changes a number the game computes (no "scope", no extra boost, no cheaper price). The Lab never
writes to a game save, never reads a game economy module, and a game keeps working with the Lab absent (§3.6).

### 1.5 Learning-design stance (what the Lab is and is not, for LEARNING-DESIGN.md)

| # | Technique | Source | Where | Honest limit |
|---|---|---|---|---|
| L1 | **Rewards are cosmetic, delayed, aggregated and partly unexpected**, so the answer stays the point | Deci, Koestner & Ryan 1999 (expected tangible rewards undermine interest; unexpected ones do not); Habgood & Ainsworth 2011; rows 6 and 21 | Coins shown on results only (D7); the crate is a surprise (variable); XP bar is informational; first-try pays about 2:1, a miss pays half rounded up (never zero); cosmetics never change play | The Lab is the most extrinsic-reward-heavy part of the repo. The mitigations reduce, not remove, the risk (§8 Q4). |
| L2 | **Competence feedback**: the visible bar, "40 XP to level 7", the flame | Ryan & Deci 2000 (self-determination: competence) | HUD pill, results strip | |
| L3 | **Choice and expression**: the child picks the avatar, the pet and its name, and what to buy | Cordova & Lepper 1996; Ryan & Deci 2000 | Avatar slots, shop, pet naming (on-screen keyboard) | |
| L4 | **Endowed progress**: a home that grows | Nunes & Dreze 2006 | Free poster for the first round in each game; level gifts every 3 levels | |
| L5 | **Habit cue, not punishment** | Lally et al. 2010; Wood & Neal 2007; row 12 | Quests vanish quietly; weekly freeze + earnable spare; best streak shown, never "lost"; no clocks | |
| L6 | **Relatedness, cooperative first**: the family goal is shared; the board is a fixed order with crowns | Ryan & Deci 2000 | §2.6 | |
| L7 | **Variety**: one quest nudges toward a skipped game | interleaving (Rohrer & Taylor 2007) across spelling, facts, fractions and application | §2.4 | A nudge technique (ICO Children's Code standard 13): it is the child's choice, has no penalty, and can be switched off (§5.3). |

## 2. Data model

Everything below is **pure data and pure rules** (`lab/src/core/*`, `lab/src/data/*`): every date comes in as `now` (ms) or a local
day key `YYYY-MM-DD`, every roll takes a seeded `rand`, nothing touches the DOM, storage, the clock or `Math.random`. Day and week helpers are
`engagement.js`'s (`dayKey` is `car-jump/src/spelling/scheduler.js`'s, `weekOfDay`, `isoWeek`, `mondayOf`, `addDays`, `dayDiff`).

### 2.1 The `lab` save (`learningLab.<playerId>.lab`, sync kind `lab`, schema `v: 1`)

One document per child, at `localStorage['learningLab.' + playerId + '.lab']`, normalized on every read and write (unknown fields
dropped, numbers clamped, lists bounded; a corrupt doc is kept at `<key>.corrupt` and replaced by a fresh one; a newer `v` is not
misread). Target size ≤ 40 KB (the sync cap is 512 KB).

```js
{
  v: 1,
  resetAt: 0,                    // Parents → Reset this child's Lab: a stamped fresh doc wins every merge
  dev: { '<deviceKey>': { c: 0, x: 0 } },           // lifetime coins and XP EARNED, one grow-only counter per device (summed); ≤ 12 keys, extras folded into '_'
  paid: { '<itemId>': 0 },                          // every purchase: item → coins paid (a gift or level reward is paid 0); union, per key max
  owned: { '<itemId>': 0 },                         // everything owned (bought, dropped, gifted, earned): item → first owned at (ms); union, per key min
  equipped: { '<slotKey>': ['<itemId>', 0] },       // slotKey = 'av.hat' | 'pet.neck' | 'home.wall' | 'sj.skin' | 'tb.ghost' …; [id|'' , at]; the later `at` wins per slot
  pet: { species: 'fox', name: 'Pip', at: 0 },      // species ∈ fox | owl | otter | dino; name ≤ 10 letters (on-screen keyboard); the later `at` wins
  streak: { /* engagement.js streak + bonusEarnedDays, bonusUsedDays (§3.5) */ },
  quests: { '<day>': { ids: ['sj-words', 'tb-races', 'ww-leg'], drawnAt: 0, rr: 0, p: { 'sj-words': 3 }, done: { 'sj-words': 0 } } },   // last 14 days
  crates: { earned: { '<key>': 0 }, opened: { '<key>': { at: 0, id: 'sj.skin.mint', coins: 0, r: 'c', pity: 0 } } },   // §2.5: key = 'quest:<day>' | 'streak:<n>' | …
  play: { '<day>': { sj: 0, tb: 0, ff: 0, ww: 0, bc: 0 } },       // events per game per day, last 28 days (the quest and goal mix)
  weeks: { '<ISO week>': { '<deviceKey>': { xp: 0, coins: 0, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: ['sj'] } } },   // last 6 weeks (§2.6)
  fam: { week: '2026-W45', goal: 'zap', at: 0 },    // this family's goal pick; the earliest `at` wins
  claimed: { 'fam:2026-W45': 0 },                   // family goals this child has claimed (at)
  crowns: ['2026-W44:most'],                        // last 12, union
  trophies: [{ game: 'sj', id: 'friday', tier: 'gold', at: 0, n: 18, of: 20 }],   // newest 40, union by game|id|at
  gallery: [{ id: 'bc.job3.2026-11-02', at: 0, kind: 'job', title: 'Low bridge', pieces: [[0, 1, 12, 34, 5]] }],   // newest 12, union by id (§4.5)
  best: { sj: 0, tb: 0, ff: 0, ww: 0 },             // best combo per game (max)
  opts: { quests: true, board: true, goal: true, at: 0 },   // Parent Zone switches; the later `at` wins
  seen: { games: { sj: 0 }, welcome: 0 },           // game → first event at (min); welcome shown at
  coinDay: { day: '', n: 0 },                       // coins earned today, for the daily cap (same day: max)
}
```

- **Wallet** = `Σ dev.c − Σ paid` (never below 0; see §2.8 forgiveness). **Lifetime XP** = `Σ dev.x`. **Level** = `levelFor(XP)`.
- **Device key**: 6 base-36 characters generated once per browser profile and kept at `localStorage['learningLab.device']` (shared by every
  game on the device); if storage is blocked, one per page load. It is not the sync `deviceId`.
- **Per-slot equip, not per-game**: the looks a child wears in the Lab are the looks the games draw (`lab.cosmetics(game)`, §3.3). A game's
  *own* equip (Trail Blazer's garage paint, Spell Jump's garage skin) still works; the Lab slot, when set, overrides it for that slot only.

### 2.2 The exchange table: events → coins and XP

A game reports `lab.report({ game, event, n, firstTry, meta })`. The table is **data** (`lab/src/data/events.js` `EVENTS`), one row
per `game.event`. **Answers** (`kind: 'answer'`) pay `ft` coins / XP when `firstTry` is true and the `fix` amount otherwise (a miss
fixed with the shared fix-it routine; never zero). **Units** pay a flat amount per `n`. Combo (§3.2) doubles an answer's coins, never its
XP. "Daily limit" = coins stop for that event after that many a day (XP and quests continue). `day` is reported by every game; the core pays it **once
per local day across all games** and counts the Lab streak day (§3.5).

| Game | Event | When the game reports it | Coins ft / fix (or flat) | XP ft / fix (or flat) | Daily limit |
|---|---|---|---|---|---|
| **sj** | `word` | a word spelled in a race or Mega Run (`recordSpell` result; `firstTry` = first try) | 4 / 2 | 4 / 2 | |
| | `testWord` | a Friday Test / Qualifier word (`firstTry` = right; **no combo**) | 4 / 2 | 6 / 3 | |
| | `run` | a run ended (finish line or the end of the run) | 6 | 12 | |
| | `perfect` | a perfect landing | 3 | 6 | |
| | `mastered` | a word became Mastered | 8 | 30 | |
| | `test` | a Friday Test finished (`meta.tier`, `n` = right, `meta.of` = words) | 40 | 80 | 1 |
| **tb** | `fact` | a Math Gate / Hill Climb fact (`firstTry` = `res.correct`) | 2 / 1 | 2 / 1 | |
| | `race` | a race ended (finished or ended) | 4 | 12 | |
| | `win` | finished 1st | 6 | 10 | |
| | `perfect` | a perfect landing | 2 | 5 | |
| | `ghostBeat` | beat a ghost (mine or a sibling's) | 8 | 15 | 3 |
| | `summit` | reached a Hill Climb summit | 15 | 30 | |
| | `star` | a trail star newly earned | 6 | 10 | |
| **ff** | `zap` | a zombie cured / zapped (`firstTry` = the first throw at it was a hit or a bull) | 3 / 2 | 3 / 2 | |
| | `wave` | a wave ended (banked) | 2 | 14 | |
| | `bull` | a bullseye | 0 | 3 | |
| | `boss` | a boss was cured | 10 | 20 | |
| | `street` | a street's final wave was played | 20 | 40 | |
| **ww** | `marker` | a mile-marker fact | 4 / 2 | 4 / 2 | |
| | `problem` | a trail word problem (store, rations, distance, event) | 4 / 2 | 4 / 2 | |
| | `word` | a river word or a letter blank | 4 / 2 | 4 / 2 | |
| | `leg` | a leg finished (arrived) | 24 | 45 | |
| | `star` | a leg star earned | 5 | 8 | |
| | `choice` | a choice moment or fork taken | 0 | 5 | |
| | `farm` | a homestead piece built | 5 | 10 | |
| **bc** | `job` | a job completed (`meta.first` false on a replay: **25 %** of the amounts) | 40 | 55 | |
| | `piece` | a block delivered to a pad or placed on a ghost (`n`) | 4 | 3 | 150 |
| | `challenge` | a build challenge met (par or height) | 40 | 45 | |
| | `blueprint` | a blueprint build finished | 30 | 30 | |
| | `site` | a site saved | 30 | 25 | 2 |
| **any** | `day` | the game counted its day (where it calls `completeDay` today) | 10 | 25 | 1 |

- **Combo moment bonus**: at combo 5, 10, 15 … (max 4 a round) the receipt carries `combo.moment: true` and the core pays +5 coins, +10 XP.
- **Quest and crate rewards** (§2.4–§2.5) and gifts do not count toward the daily coin cap; earned coins from the table do (cap **1,800**, D8).
- **Per-hour check** (the assumptions the Economy sim §7.2 enforces, "an hour in any game earns about the same"): answers an hour SJ 80, TB 150
  (gates + Hill Climb), FF 150 (zaps), WW 85; units an hour: SJ 25 runs, 8 perfect, 3 mastered; TB 30 races, 8 wins, 12 perfect, 3 ghost beats; FF
  16 waves, 20 bulls, 3 bosses; WW 6.5 legs, 13 stars; BC 6 jobs, 30 pieces, 3 challenges, 1 blueprint, 1 site. With combo (an answer is doubled
  with probability p³ when answers are independent):

| first-try rate | SJ | TB | FF | WW | BC |
|---|---|---|---|---|---|
| 45 % | 451 | 453 | 463 | 490 | 540 |
| **70 %** | **563** | **558** | **606** | **609** | **540** |
| 90 % | 724 | 709 | 814 | 779 | 540 |

  Coins an hour at the baseline: **≈ 560–610** in the four answer games (a spread under 10 %), **540** in Build Crew (no answers, so no accuracy
  effect). XP an hour at 70 %: 700–800 in the answer games, ~600 in Build Crew. A sandbox-only hour in Build Crew earns ~0: pure play pays no
  coins (Spell Jump's "no rewards tied to minutes played"); jobs, challenges, blueprints and saved sites do. A child at 90 % first-try earns about 1.6× (1.8× in Fraction Fright) a child at 45 % in the same hour, and a child at 45 % still earns
  about 80 % of the baseline: accuracy is rewarded, never the difference between a lot and nothing. The Economy sim tunes `EVENTS` inside ±15 % of 570.

### 2.3 Lab XP, levels, the avatar and the pet

**Curve** (`lab/src/core/xp.js`): XP to reach level `n` (cumulative; level 1 is 0, cap level **100**) is
`xpToReach(n) = round(100 × (n − 1)^1.6 / 50) × 50`. At ~700 XP an hour: level 2 in ~10 min, level 5 in ~1.3 h, level 10 in ~5 h, level 20
in ~16 h, level 50 in ~72 h, level 100 in ~220 h.

| Level | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| XP | 100 | 300 | 600 | 900 | 1,300 | 1,750 | 2,250 | 2,800 | 3,350 | 4,000 | 4,650 | 5,350 | 6,050 | 6,800 | 7,600 | 8,450 | 9,300 | 10,200 | 11,100 |

Then 25: 16,150 · 30: 21,850 · 40: 35,150 · 50: 50,600 · 60: 68,150 · 70: 87,550 · 80: 108,700 · 90: 131,550 · 100: 155,950.
`levelProgress(xp) → { level, title, into, need, toNext, next, max }`; the results strip says **"`toNext` XP to level `next`"** and the
HUD pill shows `Lv n` + a bar `into / need`.

**Titles** (every 10 levels): 1 Cadet · 10 Scout · 20 Ranger · 30 Captain · 40 Pioneer · 50 Commander · 60 Inventor · 70 Master · 80 Legend ·
90 Lab Legend. The avatar gets a **frame** at 10, 25, 50, 75 and 100.

**Avatar** (drawn by `lab/src/ui/avatar.js` on a canvas from the player's profile colour and the equipped slots): slots and the level that
opens each: hat 1 · shirt 1 · back 4 · face 8 · aura 15. The child's colour is the profile colour (`PLAYER_COLORS`).
**Pet** (`lab/src/ui/pet.js`): a species chosen once (fox · owl · otter · dino), named by the child on the shared on-screen keyboard (≤ 10 letters), stage by
Lab level: baby 1 · young 8 · grown 20 · big 40 · legend 70. Slots: neck 1 · toy 3 · hat 6. Mood is `happy` when the child has played anything today
and `content` otherwise (never sad, hungry or sleeping: row 12), `cheer` for a few seconds after a quest or a level-up. Tapping it pets it.
**Slots open by level; items in an open slot are bought.**

**Level gifts** (free, `paid` 0, shown as "New!" in the Lab, not sold): L3 `av.hat.cap` · L6 `av.shirt.stripes` · L9 `av.back.backpack` ·
L12 `av.face.shades` · L15 `pet.toy.ball` · L18 `home.wall.stars` · L21 `av.hat.beanie` · L25 `av.back.cape` · L30 `pet.hat.party` ·
L35 `home.shelf.globe` · L40 `av.shirt.labcoat` · L50 `av.aura.sparkle` · L60 `pet.neck.bowtie` · L70 `av.hat.wizard` · L80 `home.wall.space` ·
L90 `av.aura.rainbow` · L100 `av.hat.crown`. **First-round gifts**: the poster of each game on the first event from it (`home.poster.sj|tb|ff|ww|bc`),
`home.poster.lab` at level 2. **Other gifts**: `home.shelf.trophy` on the first Friday Test; `pet.neck.medal` at a 30-day Lab streak.

### 2.4 Daily quests

Three per local day, drawn **once** (the first time the day is needed) and stored in `quests[day]`; reward on completion, not on the day
ending. Templates (`lab/src/data/quests.js` `QUESTS`; `{n}` is the target by tier: **easy** below Lab level 5, **mid** below 20, **hard** from 20;
the nudge quest is always easy):

| id | Game | Counts (event, filter) | Text (`{n}`) | easy / mid / hard | Nudge-eligible |
|---|---|---|---|---|---|
| `sj-words` | sj | `word` | Spell {n} words | 4 / 8 / 12 | ✓ |
| `sj-first` | sj | `word`, firstTry | Spell {n} words on the first try | 3 / 5 / 8 | |
| `sj-runs` | sj | `run` | Finish {n} runs | 2 / 3 / 5 | ✓ |
| `sj-perfect` | sj | `perfect` | Stick {n} perfect landings | 1 / 2 / 4 | |
| `tb-races` | tb | `race` | Finish {n} races | 1 / 3 / 5 | ✓ |
| `tb-win` | tb | `win` | Win a race | 1 / 1 / 1 | |
| `tb-facts` | tb | `fact` | Answer {n} gate facts | 6 / 10 / 16 | |
| `ff-zap` | ff | `zap` | Zap {n} fractions (gentle: Help {n} neighbors home) | 6 / 10 / 16 | |
| `ff-bull` | ff | `bull` | Hit {n} bullseyes | 1 / 3 / 5 | |
| `ff-waves` | ff | `wave` | Finish {n} waves | 1 / 2 / 3 | ✓ |
| `ww-leg` | ww | `leg` | Finish {n} legs of the trail | 1 / 1 / 2 | ✓ |
| `ww-problems` | ww | `problem`, `marker` | Solve {n} trail problems | 3 / 5 / 8 | |
| `ww-words` | ww | `word` | Spell {n} river or letter words | 3 / 4 / 6 | |
| `ww-stars` | ww | `star` | Earn {n} stars on the trail | 1 / 2 / 3 | |
| `bc-job` | bc | `job` | Finish {n} jobs | 1 / 1 / 2 | ✓ |
| `bc-pieces` | bc | `piece` | Deliver {n} blocks | 4 / 8 / 14 | |
| `bc-challenge` | bc | `challenge` | Meet {n} build challenges | 1 / 1 / 2 | |
| `any-explore` | any | distinct games with any event today | Play {n} different games | 2 / 2 / 3 | ✓ (when the child played ≤ 1 game in 14 days) |

**The draw** (`drawQuests(lab, ctx)`, seeded by `hashString(playerId + '|' + day)`):
1. `days[g]` = number of days in the last 14 on which game `g` has any event (from `play`). A game with `days > 0` is **played**.
2. **Two home quests**: pick two *different* played games with probability ∝ `days[g]` (without replacement); for each, a template of that game not
   yet picked. If fewer than two games are played, fill from the games with `days = 0` in the fixed order sj, tb, ww, ff, bc rotated by the seed.
   So **at least two of the three quests are always in games the child actually plays** whenever they play two or more.
3. **One nudge quest**: the nudge-eligible template of the game with the **lowest** `days` that is not already in the pair (ties by seed;
   `days = 0` first; `any-explore` if the child played ≤ 1 game). Its coins are **+50 %** (120) as an "explorer" bonus.
4. Order: home, home, nudge. Targets by tier above.
5. A **swap**: once a day the child may replace one *unfinished* quest (`rr` counts it); the new one is drawn with seed `… + '|rr' + rr`, same rules.

**Rewards**: each quest **80 coins + 60 XP** (nudge **120 coins + 90 XP**); all three done: **60 coins + 100 XP + a Lab crate** (`quest:<day>`) and, if
the Lab streak has no banked bonus freeze and none was earned this ISO week, **a bonus freeze** (§3.5). Quest progress counts from any event reported
that local day by the games listed; a quest completes the moment its counter reaches the target (`done[id] = at`, paid once), also across a midnight
rollover within the same session (the quest keeps the day it was drawn). Quests are off (and the crate with them) when the Parent Zone switch is off.

### 2.5 The Lab crate

- **When**: one crate per day on which all three quests are done (`quest:<day>`); also on each Lab streak milestone (`streak:<n>` for `STREAK_MILESTONES` in
  `engagement.js`: 3, 7, 14, 30, 60, 100). Keys are in `crates.earned`; **unopened = earned − opened**.
- **Odds** (`CRATE_ODDS` in `lab/src/data/crate.js`, shown in the Parent Zone): **common 86 %, rare 12 %, epic 2 %**. **Pity**: if the last 6
  opened crates (by key order) were all common, the 7th is rare-or-better (rare 85 / epic 15). Result: a rare-or-better every 4.7 crates on
  average (Monte Carlo of 100,000 crates: 21.5 % rare-or-better, longest gap exactly 7, 34 % of rare-or-betters come from the pity).
- **Pool**: every item with source `both` (§2.7) of that rarity that the child **does not own**, weighted ×3 if its game (or avatar / pet / home) was
  played in the last 14 days, ×1 otherwise; Build Crew vehicles and blueprints are coin-only (never in the pool); items whose game does not list them in
  `LOOKS_READY` (§3.3) are excluded. A rarity with nothing left rolls down one rarity; with nothing at all it pays **coins at half the item price** (150 / 600 / 1,500).
- **Determinism**: the roll is seeded by `hashString(playerId + '|' + key + '|' + ownedCountOfPoolAtRoll)`, and the result is stored in `opened[key]`, so two devices that
  open the same crate before they sync get the same item; if they differ (different pity state) the earlier `at` is kept and both items stay owned (a
  gift, never a loss).
- **Cosmetics only**: items and coin refunds. Never anything that costs money, never a game's cash, never a boost.

### 2.6 The family board and the family goal

All of it is derived on the device from the family's mirrored lab docs (`lab/src/core/family.js`); nothing is sent anywhere.

**Weekly numbers**: for ISO week `wk` and player `P`, `week(P, wk)` = the sum over `P`'s device keys of `weeks[wk][dk]` (`xp`, `coins`, `zap`, `race`,
`word`, `ft`, `leg`, `job`, and `g` = the union of games played). `zap` = FF `zap`; `race` = TB `race`; `word` = SJ `word`/`testWord` + WW `word`; `ft` =
first-try answers in any game; `leg` = WW `leg`; `job` = BC `job`/`challenge`/`blueprint`.

**The board** (resets Monday with the ISO week):
- **Most**: the player with the highest `xp` this week, if ≥ 100 (ties share).
- **Most improved**: `usual` = the mean `xp` of that player's previous 3 weeks that had any (min 300); `gain = (xp − usual) / usual`; the highest gain wins if
  `gain ≥ 0.25` and `xp ≥ 100`. A new player's `usual` is 300. So a younger sibling who plays more than their own usual wins even when an older sibling
  has more XP.
- **Display**: players in the picker's fixed order, each with a bar of this week's XP, a crown for Most, a star for Most improved ("+45 % on your usual");
  never a rank number, never "last". Last week's crowns stay as stickers (`crowns`, 12).

**The family goal**: one a week, picked from `FAMILY_GOALS` (`lab/src/data/goals.js`), `target = round(perPlayer × players / 50) × 50`:

| id | Counts | perPlayer | Text | Played-game gate |
|---|---|---|---|---|
| `zap` | Σ `zap` | 250 | Our family zapped {n} zombies (gentle: helped {n} neighbors home) | someone played ff in 14 days |
| `race` | Σ `race` | 30 | Our family finished {n} races | tb |
| `word` | Σ `word` | 120 | Our family spelled {n} words | sj or ww |
| `leg` | Σ `leg` | 6 | Our wagons rolled through {n} legs of the trail | ww |
| `job` | Σ `job` | 8 | Our family finished {n} building jobs | bc |
| `ft` | Σ `ft` | 300 | Our family got {n} answers right on the first try | always |
| `explore` | Σ over players of games tried this week (cap 3 each) | 3 | Everyone in our family tried 3 different games | ≥ 2 players |

The pick is a seeded draw (`hashString(sortedPlayerIds + '|' + wk)`) weighted by the family's game activity in the last 14 days, **recorded in each
doc's `fam`**; the earliest `at` wins on merge, so every device converges. The meter shows `progress / target` for the week with the family's colours.
**Reward** when met: every player can **claim** (it does not lapse on Sunday night: this week's goal and the three before stay claimable) a home banner `home.banner.f1…f6` in
the order of the ISO week, then **600 coins** once all six are owned. An unmet goal simply rolls to next week's goal with "Next week: …"; no "missed", no red.

### 2.7 The cosmetics catalogue and the shop

Id = `<owner>.<slot>.<name>`; slot key = `<owner>.<slot>`. Price by rarity unless noted: **common 300 · rare 1,200 · epic 3,000** coins. Source:
**both** (default: shop and crate) · **gift** (level / first-play / streak / family goal, never sold) · **coins** (shop only). An item is only listed or dropped
when its owning game lists its id in `LOOKS_READY` (§3.3); the Lab (avatar, pet, home) lists its own.
`lab/src/data/catalog.js` is generated from these tables verbatim (`ITEMS`, `ITEM_BY_ID`, `itemsFor(owner)`, `SLOTS`).

| Owner | Slot (opens at level) | Common (300) | Rare (1,200) | Epic (3,000) | Gift / note |
|---|---|---|---|---|---|
| **av** avatar | hat (1) | sunhat, headband | propeller | | cap L3, beanie L21, wizard L70, crown L100 |
| | shirt (1) | hoodie, tee-star | jersey | hero | stripes L6, labcoat L40 |
| | back (4) | satchel | jetpack | wings | backpack L9, cape L25 |
| | face (8) | goggles | starshades | | shades L12 |
| | aura (15) | | glow | flame | sparkle L50, rainbow L90 |
| **pet** | neck (1) | collar, scarf | bell | | bowtie L60, medal (30-day streak) |
| | toy (3) | yarn | frisbee, drum | | ball L15 |
| | hat (6) | smallcap | propellerpet | crownpet | party L30 |
| **home** | wall (1) | blueprint, ocean | forest, sunset | | stars L18, space L80 |
| | floor (1) | grass, checker | rainbowrug | | wood (stock) |
| | poster (2, two hang) | robot, rocket | map | | sj, tb, ff, ww, bc (first round), lab (L2) |
| | shelf (5) | plant, lamp | | | globe L35, trophy (first Friday Test) |
| | banner (1) | | | | f1 … f6 (family goal) |
| **sj** Spell Jump | skin | mint, grape, lemon | tiger, pixel, sunrise | aurora, holo | drawn on the car by the existing skin renderer |
| | sticker | pencil, abc, bubble | medal, rocketlab | | door sticker |
| | trail | | confetti | stars | tire sparkle |
| **tb** Trail Blazer | paint | ocean, sunset, mint | bluechrome, purplehaze | goldleaf | vehicle paint |
| | decal | bolt, flames | stars, checkeredge | | |
| | rim | | neon | gold | |
| | ghost | | ice, flame | gold, rainbow | the ghost rider's look (own and siblings' ghosts) |
| **ff** Fraction Fright | fence | candy, moss | neon, goldtrim, frost | vines | a finish on whatever fence the yard has |
| | tower | flagred, flaglab, lanternblue | banner, glowtop | crowntop | shows once a tower is built (D13) |
| **ww** Wagon West | cover | stripes, patchwork, sunflower, riverblue | starquilt, nightsky | goldthread | the wagon's canvas |
| | outfit | bonnet, strawhat, vest | redscarf, spectacles, plumehat | cloak | the party leader's plain 1840s clothes; **no costume of any nation** |
| **bc** Build Crew | paint | teal, plum | safety, checker | gold | machine paint |
| | decal | labmark, flame | rivets | | |
| | veh (coins) | | | | `bc.veh.dump` **8,000**, `bc.veh.fork` **12,000**; *soon, hidden*: loader 16,000, dozer 20,000, telehandler 26,000 |
| | bp (coins) | | | | `bc.bp.lighthouse` **2,400**, `bc.bp.windmill` **2,400**, `bc.bp.castlegate` **3,600**, `bc.bp.arch` **3,600**; *soon*: suspension 4,800, towercrane 4,800 |

About 140 items (32 are gifts), **106 buyable with coins for ≈ 140,000 coins in all**. At a typical **4,400 coins a week** (35 min a day of play ≈ 330 coins + ~300 from quests, the all-three bonus and the day coins) a first
common is one session away, a rare 2 to 3 hours, an epic ~5 hours, the dump truck under two weeks, and the whole buyable shelf ~30 weeks (a school year);
the crate pays a free item in most weeks on top.

### 2.8 Merge rules (`mergeLab(local, remote)`, pure; both sides normalized first)

Every rule is a union, a max, a min or a later-`at`; the merge is **commutative, associative and idempotent**, and an older build's doc (without a field) never
erases it.
- `resetAt`: a reset on one side wins whole. `v`: max.
- `dev`: per device key, per field **max**. `weeks`: per week, per device key, per field max; `g` union. `play`: per day, per game max. `best`: per game max.
- `paid`: union, per key max. `owned`: union, per key min. **Forgiveness**: after merging, if `Σ paid > Σ dev.c` the local device's `c` is raised by the difference so
  the wallet is exactly 0 (a double-spend across two offline devices is forgiven, never charged back).
- `equipped`, `pet`, `opts`: per slot / per object, the later `at` (ties: the larger JSON). An equipped item the merged doc does not own is dropped.
- `streak`: `mergeStreak` (shared; §3.5). `crates.earned`: union. `crates.opened`: union, per key the earlier `at`. `claimed`: union (min). `crowns`: union (12).
  `trophies`, `gallery`: union by id, newest N. `seen.games`: per game min; `welcome`: min. `coinDay`: same day max, else the later day.
- `quests[day]`: `ids` and `drawnAt` from the side with the **earlier** `drawnAt`; `p` per quest max; `done` union (min). `fam`: the earlier `at`.
- Pruning on normalize: `quests` 14 days, `play` 28 days, `weeks` 6, `gallery` 12, `trophies` 40, `crowns` 12, `crates` keys older than 120 days **only if opened**.

## 3. The shared module contract (`lab/src/*`)

### 3.1 Layout

```
lab/
  SPEC.md                         this file
  index.html  manifest.webmanifest  sw.js  icons/*  README.md  docs/LEARNING-DESIGN.md        the Lab page (PWA shell), UI stream
  src/
    index.js                      the facade: `lab`, `NOOP_RECEIPT`, `GAME_MODULES`, `LAB_VERSION`                    CORE stream
    store.js                      createLabStore (storage + sync glue; the only module with localStorage)             CORE
    sync.js                       registerLabSync, labKey, re-export of mergeLab                                        CORE
    core/  PURE: no DOM, no storage, no clock, no Math.random: every date is `now`/`day` in, every roll takes `rand`   CORE
      model.js  events.js  xp.js  combo.js  quests.js  crate.js  shop.js  streak.js  family.js  engine.js  view.js  merge.js
    data/  PURE DATA                                                                                                   CORE
      events.js (EVENTS, §2.2)  quests.js (QUESTS, §2.4)  catalog.js (ITEMS, §2.7)  crate.js (CRATE_ODDS)  goals.js (FAMILY_GOALS)
    ui/    DOM                                                                                                         UI stream
      index.js  styles.css  hud.js  results.js  overlay.js  home.js  shop.js  quests.js  crate.js  board.js  goal.js  gallery.js
      parent.js  avatar.js  pet.js  glyph.js  page.js  players.js
    main.js                       the /lab/ page controller                                                            UI
  tools/  core-tests.mjs  economy-sim.mjs  sync-tests.mjs  rules-audit.mjs  ui-smoke.mjs  e2e-cross-game.mjs  make-icons.mjs
```

Dependencies (imports, all runtime ES modules): the Lab imports `/spell-jump/src/meta/engagement.js` (streak + week/day helpers),
`/spell-jump/src/meta/rng.js` (`hashString`, `mulberry32`, `pick`), `/spell-jump/src/spelling/profiles.js` (family, PIN, players),
`/spell-jump/src/sync/{client,merge,notify}.js`, `/spell-jump/src/spelling/keyboard.js` and `ui/dom.js`. **It imports no game's economy, save or engine module.**
Games import `/lab/src/index.js` **only through their own `src/meta/labBridge.js`** (§3.6).

### 3.2 The core (pure) API: exact exported names

Every function that changes a doc mutates the `lab` object it is given and returns a result; the caller persists (`store.js`). `ctx` =
`{ playerId, device, now, day, gentle, session }`; `day` is the local `YYYY-MM-DD` of `now`.

| Module | Exports |
|---|---|
| `model.js` | `LAB_VERSION = 1`, `GAMES = ['sj','tb','ff','ww','bc']`, `GAME_NAMES`, `labKey(playerId)` → `learningLab.<id>.lab`, `defaultLab()`, `normalizeLab(raw, now)` (§2.1, bounded, idempotent), `wallet(lab)` → `{ earned, paid, coins }`, `totalXp(lab)`, `owns(lab, id)`, `deviceKeyOk(k)` |
| `events.js` | `EVENTS` (§2.2), `eventDef(game, event)` → def or null (unknown events are ignored, never thrown), `payFor(def, { n, firstTry, replay })` → `{ coins, xp }`, `DAILY_COIN_CAP = 1800`, `MOMENT = { coins: 5, xp: 10 }`, `MOMENT_NAMES = { sj: 'Perfect Launch', tb: 'Perfect Landing', ff: 'Bullseye Burst', ww: 'Trail Cheer' }`, `COMBO = { boostAt: 3, momentEvery: 5, momentsPerRound: 4 }` |
| `xp.js` | `LEVEL_MAX = 100`, `xpToReach(level)`, `levelFor(xp)`, `levelProgress(xp)` → `{ level, title, into, need, toNext, next, max }`, `titleFor(level)`, `frameFor(level)`, `petStage(level)` → 1..5, `SLOT_LEVEL` (slotKey → level), `LEVEL_GIFTS` (level → itemId), `slotOpen(level, slotKey)` |
| `combo.js` | `newCombo()` → `{ count, moments }`; `comboStep(combo, { firstTry, assessment })` → `{ boosted, moment, count }` (mutates `combo`): the answer *after* three first-tries is boosted; a non-first-try answer sets `count` to 0; `assessment: true` leaves the combo alone and boosts nothing. **There is no "combo lost" value to display.** |
| `quests.js` | `QUESTS` (§2.4), `questText(q, gentle)`, `tierFor(level)`, `playedDays(lab, day, span = 14)` → `{ sj: n, … }`, `drawQuests(lab, ctx)` → `ids[3]` (§2.4 draw), `ensureToday(lab, ctx)` (draws once, stores `quests[day]`), `questEvent(lab, ctx, game, event, { n, firstTry })` → `[{ id, progress, target, justDone, coins, xp }]` (applies progress, pays on completion), `rerollQuest(lab, ctx, index)` → `{ ok, reason }`, `questView(lab, ctx)` → `[{ id, game, text, progress, target, done, coins }]` |
| `crate.js` | `CRATE_ODDS`, `rollCrate(lab, ctx, key, { ready })` → `{ id/null, coins, rarity: 'c'/'r'/'e', pity, converted }` (pure, seeded), `earnCrate(lab, key, now)`, `openCrate(lab, ctx, key, { ready })` → result or null (grants the item, pays duplicates in coins, records `opened[key]`), `unopened(lab)` → `[key]` oldest first, `crateOddsTable()` → rows for the Parent Zone (percent per rarity, the pity rule text) |
| `shop.js` | `priceOf(item)`, `canBuy(lab, id, { ready, level })` → `{ ok, reason: 'owned'/'coins'/'unknown'/'notready'/'gift', need }`, `buy(lab, ctx, id, { ready })` → `{ ok, spent, reason }` (adds `paid`/`owned`), `grant(lab, ctx, id, why)` → bool (free, `paid` 0), `equip(lab, ctx, slotKey, id/null)` → bool (owned, slot open, item belongs to the slot), `equippedIds(lab)`, `shelf(lab, { game, ready, level })` → items with `state: 'owned'/'buy'/'poor'/'gift'/'locked'` |
| `streak.js` | `labStreakNow(lab, now)`, `labRefresh(lab, now)` → newly shielded days, `labDayDone(lab, ctx)` → `{ counted, count, best, milestone, bonusFreezeEarned }` (wraps `engagement.js completeDay` on a shim like Trail Blazer's `season.js`; a milestone earns crate `streak:<n>`), `freezeView(lab, now)` → `{ weeklyReady, bonus }` |
| `family.js` | `weekNumbers(lab, wk)`, `boardFor(players, wk, now)` → `{ rows: [{ id, name, color, xp, crown, improved, gain }], mostId, improvedId }` (rows in the input order), `FAMILY_GOALS` (re-export of data/goals.js), `goalFor(players, wk)` → `{ id, text, target, progress, met, perPlayer }`, `pickGoal(players, wk)`, `claimGoal(lab, ctx, wk, players)` → `{ ok, item, coins }` |
| `engine.js` | `newSession(game)` → `{ game, combo, round: { coins, xp, events, startedAt }, momentsThisRound }`, `applyEvent(lab, ctx, ev)` → **Receipt**, `beginRound(session, now)`, `roundSummary(lab, ctx, session)` |
| `view.js` | `buildView(lab, ctx, { ready })` → **LabView** (§3.4) |
| `merge.js` | `mergeLabData(a, b)` → merged data (pure, §2.8, commutative / associative / idempotent), `mergeLab(local, remote)` for the sync registry (`{updatedAt, data}` each) |

**Receipt** (the only thing a game reads back from `lab.report`; all fields always present):

```js
{ ok: true,
  coins: 4, xp: 4,                             // paid for this event (0 / 0 when capped, ignored, or the Lab is off)
  capped: false,                               // true once when the daily coin cap is reached
  combo: { count: 3, boosted: false, moment: false, name: '' },   // moment true → draw the game's flourish; `name` = MOMENT_NAMES[game]
  level: { before: 6, after: 7, up: true, title: 'Cadet' },
  quests: [{ id: 'sj-words', text: 'Spell 8 words', progress: 3, target: 8, justDone: false }],   // only the quests this event touched
  questsAllDone: false,                        // true on the event that finished the third quest
  crate: false,                                // true when this event earned a crate
  unlocks: [{ id: 'av.hat.cap', name: 'Racing cap' }],   // gifts just granted (level, first-play, goal)
  streak: { counted: false, count: 4, bonusFreezeEarned: false },
  day: '2026-11-02' }
```
`NOOP_RECEIPT` (frozen, same shape, zeros) is returned whenever anything is off or fails.

### 3.3 The facade (`lab/src/index.js`): what a game calls

```js
import { lab } from '/lab/src/index.js'      // games do this ONLY inside labBridge.js (§3.6)

lab.attach({ game, playerId, name, color, gentle = false, reducedMotion = false, sound = true })
        // once per page after the player is chosen; idempotent. Loads the doc, registers the `lab` sync kind, draws today's quests,
        // refreshes the streak. `game` ∈ 'sj'|'tb'|'ff'|'ww'|'bc'. Switching player = attach again.
lab.detach()                                       // flush and forget the player (back to the picker)

lab.report({ game, event, n = 1, firstTry = null, meta = null })  → Receipt     // synchronous, never throws, ≤ 2 ms
lab.beginRound(game)                                // zero the round tally and the combo (a new run / race / wave / leg / job)
lab.roundSummary()  → { coins, xp, level, toNext, next, quests: [...], questsDone, crateWaiting }     // for a game's own results text

lab.hud({ mount, compact = false })  → { el, update(), destroy() }       // the XP pill (Lv n + bar, flame at combo ≥ 2); keeps itself updated
lab.results({ mount })               → { el, update(), destroy() }       // the results strip: "+14 coins · 40 XP to level 7 · 2 of 3 quests" + crate button
lab.cosmetics(game)  → { slots: { [slot]: itemId|null }, owns(id), ready: string[] }     // what to DRAW; null = use the game's own look
lab.cosmeticsOf(playerId, game) → { slots }        // another family member's equipped looks, read-only (a sibling's ghost look)
lab.owns(itemId) → boolean                          // e.g. 'bc.veh.dump' (unlock gate for Build Crew)
lab.wallet() → { coins }       lab.level() → levelProgress      lab.streak() → { count, best, weeklyReady, bonus }
lab.openShop({ game, onClose })   lab.openHome({ onClose })   lab.openParent({ unlocked, onClose })   // shared overlay; unlocked = the PIN was just entered
lab.onChange(fn) → off              // after any change (a report, a buy, a sync apply)
lab.flush()                         // write now (a game calls it on pagehide; the store also does)
lab.settings() → { quests, board, goal }    lab.gentle(on)
```
- `report` events and their `n`/`firstTry` are the §2.2 table; `meta` is optional and only these keys are read: `tier` (`test`), `of` (`test`), `first` (BC `job`),
  `id`, `title`, `pieces` (gallery, §4.5).
- **`LOOKS_READY`**: each game exports `LOOKS_READY` (ids it can draw or enforce) and an optional `paintPreview(ctx, item, w, h)` from its own
  `src/meta/labLooks.js`. The Lab loads them lazily by `GAME_MODULES = { sj: '/spell-jump/src/meta/labLooks.js', tb: '/trail-blazer/src/meta/labLooks.js', ff: '/fraction-fright/src/meta/labLooks.js', ww: '/wagon-west/src/meta/labLooks.js', bc: '/build-crew/src/meta/labLooks.js' }`.
  An item is shown in the shop and dropped by the crate **only if its owner's module loaded and lists its id**; a missing module hides that game's items (`ready` is `[]` for it). Avatar, pet and home items are always ready. A missing preview painter falls back to a colour swatch.
- Overlay (`openShop` / `openHome` / `openParent`) is the UI stream's `ui/overlay.js` mounted on `document.body`; it works inside any game page and is the same code the `/lab/` page uses.

### 3.4 The store (`lab/src/store.js`) and sync

`createLabStore({ storage = localStorage, now = Date.now, rand = Math.random, deviceKey, sync = true })` → the object the facade and the UI share:

```js
store.attach(info)  store.detach()  store.player → { id, name, color }
store.doc() → lab                  // the freshest merged doc (never stale, see below)
store.report(ev) → Receipt         store.beginRound(game)  store.roundSummary()
store.subscribe(fn) → off          // fn({ type: 'report'|'buy'|'equip'|'crate'|'sync'|'day', ... })
store.view() → LabView
store.buy(id)  store.equip(slotKey, id|null)  store.openCrate(key)  store.claimGoal()  store.rerollQuest(index)
store.setPet({ species, name })    store.setOpt(key, bool)    store.resetMe()         // Parent Zone
store.family() → { players: [{ id, name, color, lab }], week, board, goal }          // from the mirrored docs of every family member
store.flush()
```
**LabView** (`buildView`): `{ player, coins, level: levelProgress, streak: { count, best, weeklyReady, bonus }, quests: questView, questsDone, crates: { waiting, nextKey },
equipped, owned, avatar: { frame, title, slots: { hat: {open, id}, … } }, pet: { species, name, stage, mood }, trophies, gallery, opts, capped }`.

- **Freshness without a sync hook**: the store keeps the string it last wrote. Before every `report` / action it reads the raw doc; if it differs from the last written string
  (the sync client replaced it, or another tab wrote), it merges (`mergeLabData(memory, stored)`) before applying. So the Lab needs no `onApply` hook in any game.
- **Writes**: debounced 400 ms; immediate on `leg`, `job`, `test`, `day`, a level-up, a crate, a buy; on `visibilitychange` hidden and `pagehide`. Every write is followed by
  `localWrite(key)` (`sync/notify.js`) so the family sync marks the key dirty (a no-op when sync is off).
- **`sync.js` `registerLabSync()`**: `registerSyncKind('lab', { storageKey: labKey, merge: (k, local, remote) => mergeLab(local, remote), canon: (d) => normalizeLab(d, 0) })`,
  safe to call twice. `attach` calls it, then `localWrite` for every family member's existing lab doc, so a device that registered late (the sync client reads its registry on
  every call) still pushes. **Server side**: add `lab` to `PLAYER_KINDS` and to the `parseKey` regex and message in `car-jump/src/sync/protocol.mjs`; refresh the stale header comment.
- **No game page needs to create or change its sync client for the Lab.** The `/lab/` page creates its own client (`createSyncClient`) like the games.
- **Test hook** (`window.__lab`, only on `localhost` / `127.0.0.1`): `{ store, grantCoins(n), setQuests(ids), advanceDay(), reset() }`; absent on the live site.

### 3.5 The shared streak, extended (`car-jump/src/meta/engagement.js`, `car-jump/src/sync/merge.js`)

The weekly shield is already "one free freeze a week for everyone". The addition is the **second freeze, earned by finishing a day's quests**, as optional fields of the *same*
streak object, so it works for every instance and an old save is untouched:

```js
// st.bonusEarnedDays: [day]   the days on which a day's quests earned a spare freeze (≤ 60, sorted)
// st.bonusUsedDays:   [day]   the missed days a spare freeze covered (≤ 60, sorted)
export const bonusBanked = (st) => Math.max(0, len(st.bonusEarnedDays) − len(st.bonusUsedDays));
export function earnBonusFreeze(st, now)  // → boolean: false when one is already banked or one was earned in this ISO week; else pushes today
export function streakFreezes(st, now)    // → { weeklyReady: shieldFreeIn(used, isoWeek(now)), bonus: bonusBanked(st) }
// coverGap(st, from, to): for each missed day: already in shieldUsedDays or bonusUsedDays → covered; the weekly shield of that day's ISO week free → use it;
//   else a banked bonus freeze → use it (the day goes to `bonus`); else not ok. Returns { ok, shields, bonus }.
// refreshStreak / completeDay: bonus days are appended to st.bonusUsedDays (sorted, last 60) exactly like shields to shieldUsedDays; streakNow counts them as covered.
// normalizeStreak keeps the two lists only when present; defaultStreak() is UNCHANGED (so every existing deep-equality test still passes).
// merge.js mergeStreak: unions the two lists when either side has them; otherwise returns exactly what it returns today.
```
Compatibility rule (a test, §7.1): for any streak without the two fields, `refreshStreak`, `completeDay`, `streakNow`, `normalizeStreak` and `mergeStreak` return **byte-identical** results
to the current implementation (the test keeps a frozen copy of today's functions and compares them on a few thousand random histories). `spelling-tests.mjs` is extended, never edited.

### 3.6 `labBridge.js`: the one file in a game that knows the Lab (identical shape in all five games)

Each game adds `src/meta/labBridge.js` (game-owned). It loads the Lab lazily, so **a game never fails to start because `/lab/` is missing, old in the service-worker cache, or offline**;
calls made before the load finish are queued (≤ 100) and replayed, and if the load fails every call is a no-op returning `EMPTY`.

```js
// labBridge.js (a template; GAME is 'sj' | 'tb' | 'ff' | 'ww' | 'bc')
const GAME = 'tb';
const EMPTY = Object.freeze({ ok: false, coins: 0, xp: 0, capped: false, combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null, quests: Object.freeze([]), questsAllDone: false, crate: false, unlocks: Object.freeze([]), streak: null, day: '' });
let L = null, dead = false; const queue = [];
function load() {
  if (L || dead || load.p) return;
  load.p = import('../../../lab/src/index.js').then((m) => { L = m.lab; for (const f of queue.splice(0)) { try { f(L); } catch (e) { console.warn('[lab]', e); } } })
    .catch((e) => { dead = true; queue.length = 0; console.warn('[lab] unavailable', e); });
}
const later = (f) => {
  if (dead) return;
  if (L) { try { f(L); } catch (e) { console.warn('[lab]', e); } return; }
  if (queue.length < 100) queue.push(f);
  load();
};
function lazy(make) {          // a handle that is usable at once and mounts when the Lab has loaded
  let real = null, gone = false;
  later((l) => { if (!gone) real = make(l); });
  return { update() { if (real) real.update(); }, destroy() { gone = true; if (real) real.destroy(); } };
}
export const labBridge = {
  attach(info) { load(); later((l) => l.attach({ game: GAME, ...info })); },
  detach() { later((l) => l.detach()); },
  report(ev) { try { if (L) return L.report({ game: GAME, ...ev }) || EMPTY; later((l) => l.report({ game: GAME, ...ev })); } catch (e) { console.warn('[lab]', e); } return EMPTY; },   // a report before the load returns EMPTY, and is replayed
  beginRound() { later((l) => l.beginRound(GAME)); },
  hud(opts) { return lazy((l) => l.hud(opts)); },
  results(opts) { return lazy((l) => l.results(opts)); },
  cosmetics() { try { return L ? L.cosmetics(GAME) : { slots: {}, owns: () => false, ready: [] }; } catch (_) { return { slots: {}, owns: () => false, ready: [] }; } },
  owns(id) { try { return !!(L && L.owns(id)); } catch (_) { return false; } },
  openShop(o) { later((l) => l.openShop({ game: GAME, ...o })); },
  openHome(o) { later((l) => l.openHome(o)); },
  openParent(o) { later((l) => l.openParent(o)); },
  onChange(fn) { let off = () => {}; later((l) => { off = l.onChange(fn); }); return () => off(); },
  get ready() { return !!L; },
};
```
Rules for every game: (1) call `labBridge.attach` when the player is chosen and `detach` when they leave; (2) call `report` at the hooks in §4, **never inside an engine frame
loop**; (3) a Lab failure must never change what a game does or shows beyond the Lab's own pill and strip; (4) `hud` / `results` are mounted into an element the game provides (the handle works at once and mounts when the Lab has loaded) and
destroyed with the screen; `cosmetics()` is re-read at the start of every round, not once at boot; (5) the game's service worker lists `/lab/src/index.js` and the modules the page loaded as OPTIONAL (the page already posts every module it loaded).

## 4. Per-game integration contract

Each game stream adds three things: `src/meta/labBridge.js` (§3.6, verbatim with its `GAME`), `src/meta/labLooks.js` (`export const LOOKS_READY = [...]`, optional `export function paintPreview(ctx, item, w, h)`,
and its art tables), and the hooks below. **Common to all five**: (a) `labBridge.attach({ playerId, name, color })` when the player is chosen, `detach()` when they leave; (b) the Lab pill (`labBridge.hud`)
and the results strip (`labBridge.results`) mounted as stated; (c) a **"The Lab" button** on the title (opens `labBridge.openHome()`), and a **"The Lab" row in the game's Parent Zone** that opens
`labBridge.openParent({ unlocked: true })` (the PIN was just entered); (d) the service worker lists `/lab/src/index.js` as OPTIONAL and the version and cache name are bumped; (e) a **bridge-failure test**: with every `/lab/` request
blocked the game boots and plays normally; (f) the game's economy modules and constants are **not edited** (a test per game asserts the exported constants equal a snapshot taken before the change).
`report` is called from the places named here, once per event, never per frame.

### 4.1 Spell Jump (`sj`) — stream owns `car-jump/**` except the four `car-jump/` files listed for stream 1 in §6.1

| Event | Hook | `n` / `firstTry` |
|---|---|---|
| `word` | `src/main.js:788` right after `WS.recordSpell(...)` (race words and Mega Run) | 1 / `res.firstTry` |
| `testWord` + `test` | after the Friday Test / Qualifier screen resolves (`testMode.js run()` → results): one `testWord` per word in order, then `test` with `n` = right, `meta: { of, tier }` | 1 / the word's `correct` |
| `run` | the run's end (finish line or the end of the run), next to the existing run bookkeeping | 1 |
| `perfect` | the engine's `land` event with `quality: 'perfect'` (the one `goals.js` already listens for) | 1 |
| `mastered` | where `recordSpell` returns a newly Mastered word (the place that calls `addXp(…, XP.mastered)`) | 1 |
| `day` | beside `completeDay(save, now)` (main.js:419) | 1 |

- **HUD**: a new `#hud-lab` slot in the top band beside the cash chip, `labBridge.hud({ mount, compact: true })`. **Results**: `src/ui/results.js` gets a mount under the speller-XP line, `labBridge.results({ mount })`.
  **Title**: the speller chip stays "Lv n" (D11); add a Lab button next to the streak and crates chips. The moment is **"Perfect Launch"**: on `receipt.combo.moment` the car's launch shows a ≤ 1.2 s flare (a canvas ring + the name as the engine's own banner).
- **Cosmetics** (`labLooks.js`): `skin` → `{ body, accent, decal }` like `data/cosmetics.js SKINS` (the existing renderer paints it); `sticker` → `{ glyph, color }`; `trail` → tire-sparkle colours for the engine's particle spawner.
  The Lab slot overrides `lookFor(save, carId)` when set. The garage's own equip is unchanged.
- **Quick win: the Friday Test as a boss event** (new `src/ui/testBoss.js`, `src/ui/ceremony.js`; `testMode.js` is **not** changed, the boss wraps it):
  - The frame: a cartoon "Test Titan" (a stack of giant spelling blocks with a face) towering over the test screen. Each right word makes it wobble and shed a block; a miss makes it shrug (never a sad or angry face on the child's side, never a "lost"). **No hint, no combo, no coins popup, no timer, one attempt: the test is exactly the test.**
  - The ceremony (everyone gets one): Gold ≥ 90 %, Silver ≥ 75 %, Bronze ≥ 50 %, otherwise the **"Brave Speller" ribbon**; plus a **"Most improved" ribbon** when the score beats the Qualifier by ≥ 20 points; the Titan crumbles into a trophy that lands on the Lab shelf (`lab.report({ event:'test', … })` records `trophies`).
    Words missed are listed as "Words to practice this week" (the existing Report list). Confetti reuses `ui/fireworks.js`; sounds reuse `audio.js`; reduced-motion shows the ceremony as static cards.
  - **Certificate**: `car-jump/certificate.html` (+ `src/ui/certificate.js`), opened from **Parent Zone → Report → "Print certificate"** for the chosen test (`certificate.html?p=<playerId>&t=<testAt>`, same tab, no external link).
    It reads only local data, draws a print-styled A4/Letter page with system fonts only (no web fonts, no images off-origin): "Certificate of Achievement · {first name} spelled {k} of {n} words on the Friday Test · {date} · {list name}" plus the Qualifier-to-Friday improvement line when present and the tier;
    a Print button (hidden in print CSS) calls `window.print()`. Acceptance: a Playwright run records zero off-origin requests and the print stylesheet hides all buttons.

### 4.2 Trail Blazer (`tb`) — stream owns `trail-blazer/**`

| Event | Hook | `n` / `firstTry` |
|---|---|---|
| `fact` | `src/main.js:676` right after `recordAnswer(...)` (Math Gates and the Hill Climb's facts) | 1 / `!!res.correct` (a miss fixed with the fix-it routine is `false`) |
| `race` | `endRide(summary)` (main.js:717) | 1 |
| `win` | the same, `summary.place === 1` | 1 |
| `perfect` | the engine's perfect-landing event | 1 |
| `ghostBeat` | `summary.beatGhost === true` (own ghost or a sibling's) | 1 |
| `summit` | a Hill Climb summit | 1 |
| `star` | each newly earned trail star | 1 |
| `day` | beside `raceDayDone(save, now)` (`season.js:56`) | 1 |

- **HUD**: `#hud-lab` in the top band, right of the speed readout (≤ 120 px). The race clock, facts counter and gap chip keep their existing behaviour in normal races (pre-existing, §0.4); **Results**: `src/ui/results.js` mount under the lines list. Moment: **"Perfect Landing"**.
- **Cosmetics**: `paint` and `decal` override the vehicle's paint/decal passed to the engine and `vehiclePreview.js`; `rim` is a new engine option (wheel rim colours); `ghost` styles the ghost rider (a tint/trail for the translucent copy). The garage's own paints and the rider gear are unchanged and keep dropping from TB's crates.
- **Quick win: Lab-coin cosmetics** — `labLooks.js` art for the 16 `tb.*` items (§2.7) and the Trail Blazer shelf in the Lab shop.
- **Quick win: Ghost Chase (ghost time attack)**. The garage upgrades already exist (§0.4); nothing to add there.
  - **Entry**: the trail card gets a **"Chase a ghost"** button when at least one ghost exists for that trail (mine, or a family member's). It opens a chip row: **My best** and each sibling that has a ghost on this trail (their name, colour dot and vehicle). Siblings' ghosts need **no new sync**: they are in the `<id>.tb` docs the family sync already mirrors; a new read-only `src/meta/ghosts.js` `peekGhosts(familyPlayers, trailId)` → `[{ playerId, name, color, trace, vehicle, paint, look }]` reads each other player's `trailBlazer.<id>.save` (decoding the packed ghost with the existing `decodeGhost`) and never writes it. The ghost's `look` comes from `lab.cosmeticsOf(playerId, 'tb').slots.ghost`.
  - **Rules (D15)**: a solo run (`race: { riders: 0 }`, or one slow AI rider if the engine cannot run none); **no race clock, no facts counter, no gap chip, no position badge and no start countdown**: the vehicle waits on the line and **both start on the child's first GAS press**. The Math Gates stay (the clock freezes during a gate for the whole race, ghost included, so a chase is fair; the learning is intact). The ghost is the translucent copy the engine already draws, with a small name tag ("Mia") above it. The Lab pill and the flame stay (they are not a timer).
  - **Result line** (after the finish, in the existing results): "You beat Mia's ghost by 1.3 s!" / "Mia's ghost was 1.3 s ahead. Nice chase!" / "Your ghost was …" (existing wording). A chase that beats the child's own best replaces their ghost by the existing rule. `ghostBeat` pays its coins at most 3 times a day (§2.2).
  - Engine contract additions (stream owns the engine too): `start({ ghost: { trace, vehicle, paint, label, look }, chase: true })`; with `chase`, the engine emits no `countdown`, holds the start until the first throttle input, and the HUD module hides the time box, facts counter and gap chip.

### 4.3 Fraction Fright (`ff`) — stream owns `fraction-fright/**`

| Event | Hook | `n` / `firstTry` |
|---|---|---|
| `zap` | when a throw cures/zaps a zombie (`recordThrow`, main.js:515; the `cured` event) | 1 / the **first** throw at that zombie was a hit or a bull |
| `bull` | a bullseye result | 1 |
| `wave` | after `bankWave` (main.js:527), not for a stopped wave | 1 |
| `boss` | a boss's third hit | 1 |
| `street` | `bank.cleared` (a final wave played) | 1 |
| `day` | the first `wave` of a local day (**FF has no streak of its own**; the Lab's day counts FF play, §8 Q3) | 1 |

- **HUD (D5)**: **no Lab pill during a wave**: FF's SPEC §0 forbids meters and counters there. The pill and the strip appear on the **title, the streets screen, the results and the yard**.
  The combo flame is FF's own "COMBO ×N" chip (unchanged); `receipt.combo.moment` ("**Bullseye Burst**") is a ≤ 1.2 s splat flourish in the existing effects, shown **between throws**, never over the road. **Gentle mode**: all Lab text for FF uses the gentle variants ("Help {n} neighbors home"); `attach({ gentle })` follows the device setting.
- **Cosmetics**: `fence` (a finish painted over whichever fence the yard has: colour, edge, optional glow) and `tower` (flag/lantern/top on the tower) in `labLooks.js`, drawn by the wave scene (`game/render.js`) and the yard preview (`ui/yard.js`).
- **Quick win: tower and fence upgrades with cure cash (D13)** — the Yard's own economy, in `data/looks.js` / `meta/economy.js buyYard` / `ui/yard.js`: a new yard kind **`tower`** (`TOWERS`: `none` free · `lookout` $6,000 · `watchtower` $12,000 · `beacon` $20,000, bought in order, a drawn structure on the left of the road, cosmetic only: nothing changes the aim,
  the tolerance or the road) and two more **fences** (`brick` $7,000, `castle` $12,000). `YARD_KINDS` gains `tower`; `defaultSave` / `normalize` / the sync merge `mergeFf` handle it (**verify `mergeFf` unions every `YARD_KINDS` kind and does not hard-code three**; add a test). New sink ≈ $57k on top of the ≈ $35k yard.
  Target (a new `tools/yard-sim.mjs`, using `waveCash` on scripted throws at 70 % hits): the old yard stays ≈ 3–4 h; **the whole yard takes 9–12 hours**; never 6 waves without something new within reach (the cheapest unowned item is always ≤ 2 waves of cash). `waveCash` constants are unchanged.
- **Quick win: bosses for equivalence and mixed numbers** — bosses exist on every street's final wave (3 hits, forms symbol → words → unit sum) and Pumpkin Hill's are mixed numbers; **verify** that Pumpkin Hill's forms are mixed → improper → decimal. New: an **equivalence boss** on **Twin Alley's** final wave (`makeBoss(frac, tier, name)` gets `style: 'equivalent'`): its three forms are three equivalent fractions of one spot (¾ → 6/8 → 9/12), the card says "Same spot!", and each hit lands on the same x. Name plate from the street ("Mayor Mirror"). Cure cash and `boss` event as for every boss; `engine-smoke` covers the style.

### 4.4 Wagon West (`ww`) — stream owns `wagon-west/**`

| Event | Hook | `n` / `firstTry` |
|---|---|---|
| `marker` | `main.js:1105` after `JA.applyMarker` | 1 / `res.correct` |
| `problem` | `main.js:1048` and `:1077` after `JA.applyProblem` | 1 / `res.correct` |
| `word` | a river word / letter blank result from the spell panel | 1 / first try |
| `leg` | the arrival (the results screen is about to show) | 1 |
| `star` | each star earned on the leg | 1 |
| `choice` | a fork or a §4.4 choice taken | 1 |
| `farm` | `buildPiece` succeeded | 1 |
| `day` | beside the `completeDay(proxy, now)` call (main.js:1620) | 1 |

- **HUD**: `#hud-lab` at the top right of the trail HUD (`src/ui/hud.js`); **Results**: under the stars/pay lines in `src/ui/results.js`. Moment: **"Trail Cheer"** (the party cheers; the existing cheer sprite). **Economy untouched**: no Lab call reads or writes `J.cash`, `J.tokens` or any `economy.js` export; `economy.js`'s constants are frozen by a snapshot test; `tools/economy-sim.mjs --check` passes with the 1.3 TARGETS exactly as today.
- **Cosmetics**: `cover` (the wagon canvas pattern: `setParty({ wagon: { paint, cover } })` gets a `cover` id the scene draws) and `outfit` (the party leader's plain clothes, a sprite layer). The existing paint/flag/bugle/hat/decor looks are unchanged. **No outfit or cover imitates any nation's dress or designs** (the Content read in `docs/SOURCES.md`).
- **Quick win: the cliffhanger (D4)** — on every leg's results, a **preview card of the next stop** above the buttons: the next stop's painting (`paintingFor(leg)`), **one true line** (the first sentence of its `lookout` fact, or an optional `leg.teaser` override; nothing invented), and
  `Next time: <phrase>` built by a pure `nextStopPreview(J)` → `{ legId, name, kind, painting, line, phrase }` (a river stop with a ferry → "the ferry at the Kansas River", other rivers → "the crossing at the Snake River", a fort → "Fort Kearny", a landmark → "Chimney Rock").
  **Nothing is locked**: "Next leg" stays. After the **third leg finished on a local day** (`save.play[today].legs ≥ 3`), the card adds *"That's a good place to stop for today."* above the buttons. At a trail's end (home) there is no preview. Voice: the line is in `collectVoiceTexts`.
- **Quick win: six small choice moments, two per route**, in the existing journey model (a new `src/content/choices.js`, a pure `src/journey/choices.js` `choicesAt(plan, legId)` / `applyChoice(J, id, option, rng)`, a `src/ui/choicePanel.js` in the fork panel's style: a person says one true line per option, two equal buttons, read aloud; **both ways arrive**, no option is a mistake; resolved once, seeded by the leg, stored in `J.choices`, merged as a union in `mergeWw`).

| Route | At leg | Choice | Option A (the plain way) | Option B (the shortcut or the guide) |
|---|---|---|---|---|
| emigrant | `ash-hollow` | The creek-bottom shortcut | stay on the road | cut across: saves 15 miles (a day of food), **1 in 4** a sack of flour is soaked (−50 lb) |
| emigrant | `ice-slough` | A guide for the dry stretch | go on your own | pay a guide (initially **$2 × the year's price level**; the sim sets it): saves a day and lifts the party's spirit |
| California | `humboldt-river` | Cut the river's bends | stay on the trail | as the creek-bottom shortcut |
| California | `big-meadows` | A guide for the Forty-Mile Desert | go on your own | as the guide above (fee × price level, saves a day, the barrel stays full) |
| Gold Road | `rogue-river` | Cross at the gravel bar | the usual ford | as the shortcut |
| Gold Road | `siskiyou-pass` | A packer who knows the pass | go on your own | as the guide |

  **Why these are fair**: each B is **expected-value neutral** on food and cash against A (a day of food for four at full rations is 12 lb; 25 % × 50 lb = 12.5 lb; the guide fee is the Journey stream's to set from the sim so the Rookie mean end cash differs by ≤ $3 between always-A and always-B).
  The sim gains a `choices` cell; **the 1.3 TARGETS and the v1.5 matrix pass unchanged**; sessions a year stay 20 ± 2 (24 ± 2, 12 ± 1). The guide is a stock person from `people.js` (Content), and the wording gets the owner's read like the nations' facts. `choice` pays XP only (0 coins, §2.2).

### 4.5 Build Crew (`bc`) — stream owns `build-crew/**`

| Event | Hook | `n` / `firstTry` |
|---|---|---|
| `job` | `app/rounds.js win()` (line ~187); `meta: { first }` = the job was not in `save.done` before; a replay pays 25 % | 1 |
| `piece` | once at completion: `n` = blocks the job counted | n |
| `challenge` | at completion when the blueprint's par/height is met | 1 |
| `blueprint` | a blueprint job (101–104) completed | 1 |
| `site` | the tray's Save site (`app/tray.js`) | 1 |
| `day` | beside `completeDay(save, Date.now())` (rounds.js:198) | 1 |

- **No combo, no flame, no first-try** (D6). The Lab pill is in the top bar (`#hud` one-line bar on touch); the results strip goes in the job-complete sheet. Pure play keeps its rules: no timer, no countdown, no fail screen.
- **Cosmetics**: `paint` and `decal` override `save.paint` / `save.decal` for the machines (`scene/machines.js` paints). **Vehicles and blueprints are unlock gates, not looks**: `labBridge.owns('bc.veh.dump')` etc.
- **Payoff, part 1: two new vehicles** — the **dump truck** (SPEC §1: long stopping distance, a tipping bed that hauls many loose blocks; lift tips the bed) and the **forklift** (rear steer, narrow forks, mast lift and tilt; needs pallet approach). Each is a row in the four machine tables
  (`MACHINES` in `content.mjs`, `MACHINE` in `physics.mjs`, `MACHINE` in `scene/machines.js`, `MACHINE_UI` in `app/hud.js`) plus its engine pitch in `meta/sound.js`; `availableMachines()` (rounds.js:53) adds `|| labBridge.owns('bc.veh.' + kind)` for these two only.
  The three existing machines and their reward unlocks are **unchanged and open as today**; `unlockAll` does not cover Lab items. The wheel loader, bulldozer and telehandler stay `soon` (hidden). Findings go in `docs/v0.5-vehicles.md`.
- **Payoff, part 2: four blueprints** (`bc.bp.lighthouse`, `windmill`, `castlegate`, `arch`): jobs **101–104** in `content.mjs` / `missions.mjs` (ghost-outline builds like jobs 3–4, new ids so jobs 1–10 are untouched), a **Blueprints row** on the job board showing the lock and the price (a tap opens `labBridge.openShop({ game: 'bc' })`). Replay allowed.
- **Build challenges, no timer**: each blueprint carries `challenge: { kind: 'grabs', par: n }` (the number of grab-and-release moves; the HUD shows "Grabs 4 · par 9") or `{ kind: 'height', metres: m }` (the HUD shows the current height against the target). Meeting it adds a "Neat build!" badge and `challenge`; missing it still completes the job with no message. No clock appears anywhere.
- **Gallery**: on a job/blueprint completion and on Save site, the game passes `meta: { id, title, pieces }` where `pieces` is at most 48 settled toys as `[typeIndex, colorIndex, x×10, z×10, y×10]` (typeIndex into `Object.keys(TOYS)`, colorIndex into `COLORS`, 255 for a custom colour). The Lab stores the newest 12 (`gallery`) and **draws them as blueprint-style top/front views in SVG** (`ui/glyph.js`), so no thumbnail is ever synced (Build Crew's thumbnails stay on the device). Family-visible: a sibling's gallery is read from their mirrored doc. The BC title gets a **Gallery** button (`labBridge.openHome({ view: 'gallery' })`).
- Offline: regenerate `offline.js` with `tools/prepare-offline.mjs`; bump `VERSION` to 0.5.0 and the cache name; keep existing module exports backward compatible for a release (BC SPEC "Offline updates").

## 5. The Lab home page (`/lab/`) and the learninglab.fun entry

### 5.1 The page

A PWA at `learninglab.fun/lab/` (relative URLs, so it must be opened with the slash; `netlify.toml` gets the `/lab` → `/lab/` redirect), with its own `sw.js` (`lab-v1.0.0`, network-first for `index.html` and `src/main.js`, cache-first and
refreshed for the rest, the shared `/spell-jump/src/` modules included, `/api/` network-only; same pattern as Wagon West's), a manifest ("Learning Lab", standalone) and icons. It works offline after the first load. It creates its own family sync client
(`createSyncClient`) with `registerLabSync()` registered and calls `sync.start()` after the picker shows, like the games. Landscape and portrait, iPhone to laptop, targets ≥ 44 px, one scroll axis, the same dark palette and font stack as the games (a web-font stylesheet with system fallbacks, so it renders offline).

**Screens**: **Players** (the shared picker: the family's players with their colour, "+ New player" on the on-screen keyboard; with no players: "Add a player to start" and a same-origin link to Spell Jump's Parents → Family code) → **Home** → the panels below (each also opens as an overlay inside any game via `lab.openHome / openShop`).

### 5.2 Home (the home base)

- **Top bar**: avatar chip (tap = Me), `Lv 7 · Cadet` with the XP bar and **"40 XP to level 8"**, the **coin purse** (`1,240`), the **streak flame** with `3` and, beside it, the freeze icons (the weekly one *ready* or *used*, the spare *banked* or none; no text about loss). A back/exit to the Players screen.
- **The room** (canvas/SVG, 16:9, scales): wall, floor, the **avatar** (`ui/avatar.js`: profile colour, slots hat · shirt · back · face · aura, a frame at levels 10/25/50/75/100) and the **pet** (`ui/pet.js`: species, stage 1–5 by level, neck/toy/hat). Two posters on the wall (the five game posters appear as the child tries each game; the Lab poster), the **trophy shelf** (Friday Test trophies, the 30-day medal, family-goal banners hang on the wall), and a **gallery frame** that opens Gallery.
  Tapping the pet pets it (a small hop and a sound); tapping the avatar opens Me. Time of day only changes the window light.
- **Bottom row** of big buttons: **Quests** (a dot when something is waiting) · **Crate** (the count) · **Shop** · **Family** · **Gallery** · **Me** · **Grown-ups**.

### 5.3 Panels

| Panel | Contents | Rules |
|---|---|---|
| **Quests** | Today's three cards with the game's icon, the text, a progress bar `3 / 8`, the coins (80, nudge 120) and a ✓ when done; a **swap** button (once a day, on an unfinished quest); under them the crate sitting closed with three pips filling. The nudge card is tagged "Try something different" and nothing else. | No clock, no "resets in", no "expired". Yesterday's quests are not shown. A Parent Zone switch hides the whole panel and the crate. |
| **Crate** | Opening animation (shake, lid, item flies out; reduced motion = fade), the item name and rarity, "New!" or "You already had it: +150 coins". Unopened crates wait in a row. | Cosmetics and coin refunds only; no purchase of crates, no "buy a key". |
| **Shop** | Tabs: **Me** (avatar, pet), **Home**, **Spell Jump**, **Trail Blazer**, **Fraction Fright**, **Wagon West**, **Build Crew**. Item cards (preview painter or swatch, name, rarity chip, price, state). States: *Equip* / *Equipped* / **Buy** (two taps: the button becomes "Yes, buy" for four seconds with no timer shown, then resets itself) / *"Need 120 more"* (never "too expensive") / *Gift* (not sold, shows how it is earned: "Level 12", "First Friday Test") / *locked* ("Opens at level 8" for a slot). Build Crew's tab shows the vehicles and blueprints as the big shelf with "New in Build Crew" and a button *"See it in Build Crew"*. A game whose items are not ready (`LOOKS_READY` empty) shows no items for it. | Nothing here changes a game's difficulty or economy (§1.4). No sort that shames ("cheapest first" is fine, no "most expensive"). |
| **Me** | Slot rows for the avatar (hat, shirt, back, face, aura) and the pet (neck, toy, hat), each with the items owned and the level a closed slot opens at; the pet's species and **name** (typed on the on-screen keyboard). | Locked slots show the level, not a lock-out message. |
| **Family** | Week header ("This week"), the **family goal meter** (`640 / 1,000` and its text, the Claim button when met, "Next week: …" after), then **the board**: a card per child in the picker's order with a bar of this week's XP, a crown (Most) and a star (Most improved, "+45 % on your usual"), last week's crowns as stickers. | No rank numbers, no "last", no countdown. Hidden by the Parent switches (board / goal). First names only (the profile names). |
| **Gallery** | A grid of the family's Build Crew builds and saved sites, blueprint-style top/front SVG views with the builder's name and title; tap for large. | Family-visible only (their own mirrored docs); nothing leaves the family. |
| **Grown-ups** (PIN, `checkPin`) | **Odds** (`crateOddsTable()`: common 86 / rare 12 / epic 2, the 7-crate guarantee, duplicates convert to coins, "cosmetics only, never for sale for money"); **switches** per child (daily quests and crate · family board · family goal); the **daily coin cap** (1,800) and what the Lab stores; **Reset this child's Lab** (a confirm; stamps `resetAt`); the sync status line; a short "How the Lab works" (§1.4–§1.5). The one place with native inputs. | Reachable from the Lab, and from every game's Parent Zone ("The Lab" row, already unlocked). |

### 5.4 The learninglab.fun home page and the Why page (orchestrator, `site/`)

- **Hero**: a sixth button, **"Open The Lab"**, styled apart from the game buttons (a lab-flask glyph, the Lab accent), linking to `/lab/`.
- **A card above the games**: *kicker* "Your home base · all five games". Title **The Lab**. Body: "Whatever you play fills one purse of Lab coins and one level bar. Grow your avatar and pet, finish three quests, open a surprise crate, and spend your coins on looks for your car, bike, wagon and fence, or on new machines in Build Crew. Your family fills a goal together every week." Chips: "Free · no ads", "Cosmetics only", "Works with your family code". Art: the avatar and pet in the room (inline SVG, no external images).
- **Parents' quick start**: one more item: "Open **The Lab** to see your child's level, quests and family goal. In its Grown-ups panel you can see the crate odds, switch off quests, the board or the goal, and reset a child's Lab. It uses the same family code and PIN as the games."
- **Why page**: a short section "The Lab: what rewards are here, and what they are not": rewards are looks and surprises, never a way past a question; coins appear on results, not on every answer; nothing expires; the odds are shown; the family goal is a team goal, the board has crowns and no ranks. Cites Deci, Koestner & Ryan 1999 and Ryan & Deci 2000.

## 6. Streams, strict file ownership and build order

### 6.1 The streams

Eight streams (Sonnet), built in **two phases from the same commit**, then the orchestrator integrates. Never touch another stream's files. The exact exported names are in §3 and §4; until another stream lands, code against those shapes (the
core ships first, so every later stream codes against the real thing).

| # | Stream | Owns (exclusively) | Delivers |
|---|---|---|---|
| **1** | **CORE** (phase 1, alone) | `lab/src/core/*`, `lab/src/data/*`, `lab/src/store.js`, `lab/src/sync.js`, `lab/src/index.js`, a **stub** `lab/src/ui/index.js` (handed to stream 2), `lab/tools/core-tests.mjs`, `lab/tools/economy-sim.mjs`, `lab/tools/sync-tests.mjs`, `lab/tools/rules-audit.mjs`; and these **shared-file exceptions, additive only**: `car-jump/src/sync/protocol.mjs` (kind `lab`), `car-jump/src/meta/engagement.js` (the §3.5 streak additions only), `car-jump/src/sync/merge.js` (`mergeStreak` only), `car-jump/tools/spelling-tests.mjs` (append one marked block: the `lab` kind transport and the streak compatibility tests), `netlify/functions/family.mjs` (comment only) | Every export of §3.2–§3.4; the catalogue generated from §2.7; the exchange table, quests, crate, family rules; `mergeLab`; the facade (§3.3) whose UI calls are lazy (`import('./ui/index.js')`, no-ops when absent); `lab.__test` hook; all pure tests and the economy sim green |
| **2** | **UI** (phase 2) | `lab/index.html`, `lab/manifest.webmanifest`, `lab/sw.js`, `lab/icons/*`, `lab/src/main.js`, `lab/src/ui/*` (replaces the stub), `lab/tools/ui-smoke.mjs`, `lab/tools/e2e-cross-game.mjs`, `lab/tools/make-icons.mjs`, `lab/README.md`, `lab/docs/LEARNING-DESIGN.md` | `ui/index.js` exports `installStyles()`, `mountHud(host, store, { game, compact })`, `mountResults(host, store, { game })`, `openOverlay(store, { view: 'home'/'shop'/'quests'/'crate'/'family'/'gallery'/'parent', game, unlocked, onClose })`, `renderPage(root, store, { sync })`; the page (§5), the avatar, pet and glyph painters, the Grown-ups panel |
| **3** | **Spell Jump** | `car-jump/**` **except** the four `car-jump/` files listed for stream 1 | §4.1: bridge, looks, hooks, HUD/results mounts, Friday Test boss + ceremony + certificate, Parent Zone rows, tests (`ui-smoke`, `integration-smoke`), version + `sw.js` |
| **4** | **Trail Blazer** | `trail-blazer/**` | §4.2: bridge, looks, hooks, mounts, Ghost Chase (`ghosts.js`, engine `chase`), rim option, tests, version + `sw.js` |
| **5** | **Fraction Fright** | `fraction-fright/**` | §4.3: bridge, looks, hooks, mounts off-wave, tower + fences, equivalence boss, `tools/yard-sim.mjs`, tests, version + `sw.js` |
| **6** | **Wagon West** | `wagon-west/**` | §4.4: bridge, looks, hooks, mounts, cliffhanger + stop line, six choice moments (content, journey, panel), `economy-sim --check` green, tests, version + `sw.js` |
| **7** | **Build Crew** | `build-crew/**` | §4.5: bridge, looks, hooks, mounts, dump truck + forklift, four blueprints + challenges, gallery meta, `docs/v0.5-vehicles.md`, `offline.js`, version + `sw.js` |

(`lab/src/ui/index.js` is written twice on purpose: stream 1 commits a stub in phase 1 so the facade and the games can run; stream 2 overwrites it. Nobody edits it in parallel.)

### 6.2 Shared files and the orchestrator

Streams 3–7 never edit `car-jump/src/sync/*`, `car-jump/src/meta/engagement.js` (stream 3 included), `lab/**`, `site/`, `build.sh`, `netlify.toml` or `netlify/`. The **orchestrator** (after both phases):
1. **`build.sh`**: `copy_game "$root/lab" "$out/lab"` (the same excludes: `tools docs package.json dev.html SPEC.md`), `required` gains `lab/index.html lab/sw.js lab/manifest.webmanifest lab/icons/favicon.png lab/src/index.js lab/src/core/engine.js lab/src/ui/index.js`, and the header comment lists the Lab.
2. **`netlify.toml`**: the `/lab` → `/lab/` redirect, `Cache-Control: no-cache, no-store, must-revalidate` on `/lab/sw.js`, the manifest content type, `lab` in the `ignore` path list, the header comment.
3. **`site/index.html`** and **`site/why/index.html`** as in §5.4.
4. Merges the seven streams, runs every suite (§7), runs the cross-game flow, plays one session of each game and the Lab at iPhone size (landscape and portrait), writes `lab/docs/PLAYTEST-1.0.md` with screenshots, flips nothing to "ready" that a game's `LOOKS_READY` does not list, and holds the push for the owner.

### 6.3 Build order

1. **Phase 1: stream 1 alone** (the core, the facade with a stub UI, the shared-file edits). Done when `core-tests`, `sync-tests`, `economy-sim --check`, `rules-audit` and `spelling-tests.mjs` (with its new block) are green and `lab.report` works end to end from a Node harness with a fake storage.
2. **Phase 2: streams 2–7 in parallel** from the phase-1 commit. Each game stream's tests run against the real core with the stub UI; the UI stream tests against the real core with fake game pages; the games' `labLooks.js` are read by the UI at runtime and need no coordination.
3. **Phase 3: the orchestrator** (§6.2).

### 6.4 Per-stream definition of done

Existing suites of the stream's folder green (§7.5); new tests written; the kid-rule audit (`lab/tools/rules-audit.mjs`, extended per game for its new strings) clean; no game economy file changed
(snapshot test); the bridge-failure test passes; `README.md` and the game's `SPEC.md` get a short "Lab integration (v1)" section pointing to this file's §4.x; version and service-worker cache bumped.

## 7. Tests and acceptance

### 7.1 Core tests (`lab/tools/core-tests.mjs`, node, no browser)
- **Model**: `normalizeLab` is idempotent, bounds every list (§2.8), survives hostile input (non-objects, huge numbers, wrong types, prototype keys) and unknown future fields; `wallet` = Σ`dev.c` − Σ`paid`, never negative; two devices' counters sum.
- **Events**: every `game.event` has integer coins and XP ≥ 0; answers pay `fix` = ⌈`ft` / 2⌉ in coins and in XP, so never 0 for a miss; units pay flat; unknown events are ignored; daily limits and the 1,800 cap stop **coins only** (XP and quests continue; `capped` is true once); `day` pays once a local day across games; BC `job` replay pays 25 %.
- **Combo**: three first-tries then the next answer is boosted (coins ×2, XP not); a non-first-try sets the count to 0 with no event to display; the moment fires at 5, 10, 15 and at most 4 a round; `assessment` events never boost or count; `beginRound` clears.
- **XP**: `xpToReach` matches the §2.3 table; `levelFor` boundaries; `levelProgress` "toNext"; the cap at 100; titles; `petStage`; slot unlocks; `LEVEL_GIFTS` all reference real items and grant exactly once.
- **Quests**: `drawQuests` is deterministic for (player, day) and different across days; **with ≥ 2 played games, ≥ 2 of the 3 quests are in played games and exactly one is the nudge from the least-played game** (property test over random `play` histories); no duplicate template; the nudge is easy tier; tiers by level; a gentle text for ff; progress counts only matching events and filters (`firstTry`); completion pays once, in the same event; all three done → one crate key, a bonus freeze when allowed; the swap works once a day and not on a done quest; a midnight rollover mid-session keeps the day's quests.
- **Crate**: odds sum to 100; over 100,000 seeded crates rare-or-better ≈ 21.5 % and **the longest gap is exactly 7**; pity counts by opened order; duplicates re-roll once, then pay half the item price; the pool excludes gifts, coin-only items, items not in `ready` and owned items; the result is deterministic for (player, key, pool state); opening twice returns the stored result; a rarity with nothing left rolls down.
- **Shop**: `canBuy` reasons (`owned`, `coins`, `unknown`, `notready`, `gift`); `buy` charges the price and records `paid`; `equip` needs ownership, an open slot and the right slot for the item; buying `bc.veh.dump` makes `owns` true; equipped ids for unowned items are dropped by `normalizeLab`.
- **Streak** (the shared engine): all of §3.5's compatibility property test (old vs new on ≥ 3,000 random histories without the new fields: byte-identical); `earnBonusFreeze` once a week and only with none banked; the spare covers a second missed day in a week whose shield is spent; a third missed day breaks it; `mergeStreak` unions the two lists and is unchanged without them; Spell Jump's existing streak tests pass untouched.
- **Family**: `weekNumbers` sums device keys; `boardFor` keeps input order; Most needs ≥ 100 XP and shares ties; **a younger sibling with lower XP wins Most improved** (fixture); `usual` floor 300; `goalFor` target = perPlayer × players rounded to 50; `pickGoal` is deterministic and weighted by activity; `explore` only with ≥ 2 players; `claimGoal` once per player per week, a banner from the order, 600 coins after all six.
- **Merge laws** (`sync-tests.mjs`, random docs): `mergeLabData(a,b) = mergeLabData(b,a)`, associative, `merge(a,a) = a`; two offline devices each earn and each buy a different item: both purchases survive and both are charged; an overspend is forgiven to a wallet of 0; the earlier-`drawnAt` quest draw wins and progress merges by max; the same crate opened on two devices converges; `resetAt` wins whole; per-slot equip last-writer-wins; an older-build doc without new fields merges without erasing them; `normalizeLab(merge(...))` is stable.
- **Transport**: `protocol.mjs` accepts `PUT /api/family/:code/<id>.lab` with the rev rule and 409 handling (the existing `memoryStore`), `GET` returns `lab` for each player, `parseKey('x.lab')` works and `x.labs` is refused; the client registry round-trips `registerLabSync()` (called twice is safe), `syncKeyFor('learningLab.mia.lab')` → `mia.lab`; late registration marks existing docs dirty.
- **Store** (fake `localStorage`): `report` read-merge-writes (a doc replaced behind its back by the sync client is merged, not overwritten); debounced and immediate flushes; a blocked or throwing storage never throws out of `lab.report`; `NOOP_RECEIPT` on every failure; performance: 1,000 reports in under 1.5 s on the Node harness.
- **Rules audit** (`rules-audit.mjs`): scans `lab/src/**` and `lab/index.html` for banned words (`kill|die|dead|dies|death`, `lose|lost|expire|expired|missed|failed|fail|timer|countdown|hurry|last chance|ends in|resets in|left today`), `http(s)://` links off-origin, `<input|textarea|select|contenteditable>` outside `ui/parent.js`, "multiple choice" patterns, rank numerals in the board; extended by each game stream for its new strings.

### 7.2 Economy sim (`lab/tools/economy-sim.mjs`; `node lab/tools/economy-sim.mjs --check`)
Pure core, a seeded clock, no browser. Three simulated kids play a simulated week (7 days) of mixed play, then 12 weeks:
| Kid | Accuracy | Day | Games |
|---|---|---|---|
| Ava (11, strong) | 90 % first-try | 45 min | sj, tb, ww |
| Ben (9, average) | 70 % | 30 min | tb, ff, bc |
| Cal (7, young) | 45 % | 20 min | sj, ww |

The per-hour rates are the §2.2 assumptions. Checks (`--check` exits 1 on a miss):
- **Coins an hour** at 70 %: each game within **±15 % of 570** (Build Crew within ±15 %); at 45 % and 90 % within the §2.2 table ±10 %; a 90 % kid earns at most 1.8× a 45 % kid in the same game-hour, and a 45 % kid at least 75 % of the 70 % baseline.
- **A week** (Ben): 3,200–5,600 coins including quests and crate; the first common item affordable on day 1; a rare within the first 3 days; the dump truck within 3 weeks of normal play.
- **Quests**: for every kid-day, ≥ 2 of 3 are in games the kid plays (≥ 98 % of days) and one is a nudge; a quest set is completed on 55–80 % of the days a kid plays at their usual time (the targets are not trivial and not hard); a crate on 40–70 % of play days.
- **Crates**: over 12 weeks no 7 crates in a row without a rare-or-better; rare-or-better cadence 3.5–6 crates.
- **Family goal**: a family of the three reaches its weekly goal in **50–85 %** of the 12 weeks, never in week 1 without play; **Most improved** goes to Cal in ≥ 25 % of weeks (the young sibling can top it) and to the same kid fewer than 70 % of weeks.
- **Cap**: the daily coin cap is reached in ≤ 2 % of kid-days.
- **Runway**: Ben has not bought the whole shelf by week 26; the shelf is exhausted for Ava (heaviest) between weeks 20 and 40.
- **Independence**: a grep asserts `lab/src` imports no game economy/save/engine module, and the per-game snapshot tests (§4 (f)) assert each game's economy constants are unchanged.

### 7.3 UI smoke (`lab/tools/ui-smoke.mjs`, Playwright, both layouts, iPhone size and laptop)
Players → Home renders avatar and pet at each stage (seeded levels 1/8/20/40/70/100); Quests (three cards, progress moves with `__lab` events, swap once); Crate opens (reduced motion variant), duplicate text; Shop tabs, the two-tap Buy, "Need N more", gift/locked states, `LOOKS_READY` empty hides a game's items,
Build Crew shelf; Me (slot rows, pet rename on the on-screen keyboard); Family (board in fixed order with crowns, goal meter and Claim); Gallery draws seeded builds; Grown-ups (PIN, odds table equals `crateOddsTable()`, switches hide panels, reset); the screen audit (no off-origin links, **no native inputs outside Grown-ups**, targets ≥ 44 px, no overflow, no text from the rules audit list); the page works offline after the first load.

### 7.4 The cross-game flow (`lab/tools/e2e-cross-game.mjs`, Playwright against a static server at the repo root; the acceptance test of the whole feature)
1. Fresh profile "Mia" on a clean origin; `/lab/?labtest` seeds quests `tb-races`, `tb-facts`, `tb-win` for today through `__lab.setQuests`.
2. **Earn in Trail Blazer**: open `/trail-blazer/`, answer gates and finish and win a race (the mock engine); the **Lab pill shows XP rising**, the results strip shows coins and "XP to level 2", the three quest chips tick, the third completion shows **"Lab crate!"**.
3. **The crate opens** from the results strip: an item is granted (seeded to a known id), it appears in `lab.owns`.
4. `__lab.grantCoins(8000)`; open `/lab/`, **Build Crew tab → buy the Dump truck** (two taps); the wallet drops by 8,000.
5. Open `/build-crew/` as Mia: **the dump truck is in the machine list / tray and selectable**; a second profile "Ben" without the purchase does **not** see it, and **the three original machines and all ten jobs are open for both**.
6. Back in `/lab/`: the quests panel shows 3/3; the family board shows Mia's XP and Ben's in the picker's order with no ranks.
7. Two-device sync: with the sync server's in-memory store (`memoryStore`), device A earns while offline and device B buys, then both sync: the wallet and `owns` converge (nothing lost, nothing double-charged).
8. Block `/lab/` entirely: each of the five games boots, plays one round and shows no Lab UI and no errors beyond the bridge's one console warning.

### 7.5 Every existing suite stays green
Run (and keep green) the suites in each game's `tools/`: `car-jump/tools/{spelling-tests, engine-smoke, ui-smoke, sync-smoke, integration-smoke, sync-function-check, stats-function-check, economy-sim --check}`; `trail-blazer/tools/{facts-tests, gate-agreement, engine-smoke, ui-smoke, sync-smoke, economy-sim --check}`;
`fraction-fright/tools/{skills-tests, engine-smoke, bonus-smoke, ui-smoke, sync-smoke}`; `wagon-west/tools/{journey-tests, content-audit, economy-sim --check, scene-smoke, ui-smoke, sync-smoke, playtest-full}`; `build-crew/tools/{physics-tests, mobile-tests, browser-smoke, offline-check, voice-check}`.
Each game stream also adds its own new checks to those files' neighbours (never editing an existing assertion), and `build.sh` must still print `dist/ ready` with the Lab included.

## 8. Open questions for the owner (short; the defaults above ship if there is no answer)

1. **Classroom leaderboards and a class goal meter.** Not built (D3). They need the server to hold and show **other families' children's first names and weekly numbers** to a class, which today's sync (one blob per family code, never served to another family) deliberately never does. That is a privacy decision (parental opt-in per child, a class code, first names only or initials, retention, who may see, a teacher role), not a build detail. Recommendation: stay family-only until you have decided that, and then build it as a separate opt-in store with initials and weekly XP only. **Yes / no / later?**
2. **One streak on screen?** Each game's title chip shows that game's own streak and the Lab shows the Lab's (D9). Unify what is displayed (every chip shows the Lab streak, the per-game ones keep driving their own cosmetics) in a follow-up?
3. **Fraction Fright and the streak.** Its SPEC refuses a streak (ICO Children's Code standard 13, nudges). The Lab's day counts FF play, but FF itself shows no streak and no quests mid-wave. OK, or should FF play not count toward the Lab streak?
4. **The reward risk.** Coins plus crates are the most extrinsic-reward-heavy thing in the repo; §1.5 lists the mitigations (cosmetic only, coins shown late, a miss pays half, unexpected crates, a cap). Ship with coins, or ship cosmetics from quests and crates only (no coin shop) first and add coins after a few weeks of watching?
5. **The daily coin cap of 1,800** (D8) and the **once-a-day swap**: keep?
6. **Build Crew scope.** The payoff needs the BC stream to build the **dump truck, the forklift and four blueprints** (physics, models, HUD rows). That is the biggest single build here. Ship all six in v1, or the dump truck and two blueprints first and the rest `soon` (hidden, as designed)?
7. **Voice.** Should the Lab read quests and the crate result aloud with the natural voice? It needs the quest strings prepared as clips like the games' (a finite set); v1 as written is silent apart from the games' own voices.
8. **Friday Test ceremony.** Every score gets a ribbon (Gold / Silver / Bronze / Brave Speller) and the certificate prints the actual score. Right tone, and should the certificate show the score at all for a low result (an alternative is to print it only for Bronze and up)?
9. **Housekeeping found in the audit (not Lab work):** Wagon West's and Build Crew's usage pings are rejected by the stats server (`GAMES` has three games), so they are uncounted; `protocol.mjs`'s header comment is stale. Fix with the next stats change?
