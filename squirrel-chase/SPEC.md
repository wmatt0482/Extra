# Pip's Squirrel Chase: build contract (v0.1 — the New York tour)

A spelling chase game for the learninglab.fun family (Spell Jump, Trail Blazer, Fraction Fright, Wagon West, Build Crew,
Case Files, The Lab). Folder `squirrel-chase/`, served at `/squirrel-chase/`, name **Pip's Squirrel Chase**, version **0.1.0**,
family sync kind **`sq`**. Audience: Matt's 4th graders.

**Story.** The Scribble Gang — led by **Scrabble the squirrel**, with a raccoon, a crow, a possum and a goat, each with a
silly reason (the crow collects shiny letters, the goat eats only vowels…) — swipes letters off signs at famous places
around New York and America to spell silly words. Pip's Detective Agency (Pip, the Chief and Mr. Wen from Case Files) chases
them stop by stop. Nobody is arrested: at the hideout the gang hands the letters back (a bit embarrassed) and the sign is fixed.
Original world and characters only; no resemblance to any existing chase game's names, characters or look.

## 1. Kid rules (non-negotiable; same as every game here)
No timers, countdowns, pressure text, lives, energy or fail states; nothing punishes stopping. No "kill/die/dead/lost/lives/gun/
blood/jail/arrest/steal… punish" wording toward kids beyond the gentle "swiped/took/borrowed" for the gang. No multiple choice
(tapping a real city on the map is allowed: every option is a real place, nothing false is offered). No external links. Native
inputs only in the PIN-locked Parent Zone (kids type on the in-game keyboard). Voice = natural cloud clips or silence, never the
device voice. Wrong taps are a normal part of the story ("The trail is cold here — check your clues"), no buzzer, no penalty.

## 2. What is spoken and what is read
- **Spoken (natural voice):** ONLY the spelling words and their sentences, exactly as Spell Jump does it (word — sentence — word,
  "Hear it" / "Say it again" any number of times), plus the hideout's dictation sentence. Letters are spoken as they are typed
  (as in Spell Jump).
- **Read silently (text only, never voiced):** briefings, witness lines, clues, postcards, city facts, every other line.

## 3. Words (learning rules from car-jump/docs/LEARNING-DESIGN.md)
- Words come ONLY from the child's current active Spell Jump list (class list or parent-pasted list) via the shared word store
  (`/spell-jump/src/spelling/wordStore.js`, `scheduler.js`) — the same way Wagon West does it (study `wagon-west/src/main.js` and
  `wagon-west/src/ui/spellSkin.js`). Pick order inside the list follows the scheduler's priorities (focus / due words first).
- Every spelled word is a normal retrieval: banks immediately (word record, Leitner box, today's mission count — the 8-word daily
  mission is shared with Spell Jump), audio-first, the word never shown before it is spelled, compare ≤ 3 s with differences marked,
  then fix / cover-copy-compare (reuse `createSpellPanel` from Spell Jump with this game's skin).
- About 8 words per case (2 witnesses × 3–4 stops) + the hideout sentence. If the list has fewer unique words than needed, words repeat
  (never twice in a row).

## 4. The loop — one case per day
- Home → the case board: a map of New York (big) with a small US map; today's case glows; closed cases show a postcard stamp; the next
  case opens the next local day ("Next case tomorrow", no countdown). A parent can open the next case early in Parents.
- **Briefing** (text): the Chief: which sign was hit, which letters are missing (shown as gaps on the sign), first city.
- **Stop** (3–4 per case): a city scene with 2 witnesses (the gang's animals are never witnesses; witnesses are townsfolk). Each
  witness's clue is a sealed note: tap → the spell panel opens with the next list word (spoken) → spelled right (or fixed) → the note
  opens (text clue about where the gang went next, e.g. "They bought tickets to the city that's home to the Baseball Hall of Fame").
  After both notes: **travel** — tap the next city on the map; right city → the plane/train animation + one recovered letter flies
  onto the sign; wrong city → "The trail is cold here — check your clues" (no penalty, try again).
- **Hideout** (last stop): the gang's password is a short sentence containing 2–3 of the week's words (built from the list's own
  sentences when available, or a template sentence). The voice reads it; the child types the whole sentence from memory (punctuation
  and capitals forgiven; each list word in it is scored as a retrieval; other words are not scored). Then the gang returns the letters,
  the sign is whole, a city **postcard** (illustration + 2 facts) is added to the album, flat Lab payout, "Case closed — see you tomorrow".
- Never auto-start another case.

## 5. Content — v0.1 "New York tour" (6 cases), `squirrel-chase/src/content/`
Cities: Rochester, Buffalo, Niagara Falls, Syracuse, Albany, Cooperstown, Corning, Lake Placid, Saratoga Springs, Ithaca, New York City
(+ 1–2 others if useful). Each city: id, name, map coords (NY map, relative 0–1), 3–4 kid-friendly facts with `source` URLs (reliable
sources only; leave out anything unverified), a landmark sign (text whose letters the gang swipes, e.g. "ERIE CANAL", "HALL OF FAME"
— generic landmark names, no logos/trademarks), and 6+ clue lines that point TO this city from elsewhere (so clues can be composed).
Cases: id `ny-01…ny-06`, title, the sign hit, route (3–4 cities ending at the hideout city), which gang member leads the case, briefing
lines, witness names/roles per stop, the hideout description, the postcard facts. `index.js` exports `CITIES`, `CASES`, `GANG`, `ARCS`.
`tools/content-tests.mjs` validates schema, routes, clue→destination consistency (each clue points to exactly the next city), sources,
banned words.

## 6. Look
Family shell like the other games (top bar: Lab chip top-left via `lab.mountChip`, "🔒 Parents" chip; picker "Who's on the chase?" with
`lab.mountPickerButton`; chunky buttons). Theme: a sunny road-trip / travel-poster style (warm sky, map paper, stamps, postcards), older-kid
bold and clean, illustrated gang characters (SVG), Pip and the Chief reused from Case Files' art if practical. Map: an illustrated New York
State map (clean, recognizable outline, the Finger Lakes, the Erie Canal line, Adirondacks) + inset US map for later arcs. Readable text
≥ 18px phones. Portrait/landscape phones + desktop, no horizontal scroll.

## 7. Platform
PWA (sw.js cache `squirrel-chase-v0.1.0`, manifest, icons), `build.sh` copy to `dist/squirrel-chase/`, `netlify.toml` redirect + headers +
ignore path, home-page card in `site/index.html`, Games menu entry (Lab `games` list / paths), sync kind `sq` in
`car-jump/src/sync/protocol.mjs` PLAYER_KINDS (+ key regex; netlify function and every sync test still pass), Lab registration like Case
Files (GAMES, names, glyph, events row `sq.case` flat payout, quest "Close a Squirrel Chase case", looks optional), `lab.summary('sq',
{ level: 'Chaser: n cases', line: 'NY tour: n / 6', today })`. Family music switch respected (shared audio module). Save `sq`:
`{ v:1, opened:{caseId:day}, closed:{caseId:{day, at, words:[...], hideout:{correct,total}}}, album:[cityIds], nextEarly, updatedAt }`
(normalize + merge: union, earliest `at`, later updatedAt for flags). Parent Zone: cases closed, postcards, words practiced (same records as
Spell Jump), open next case now, music switch.

## 8. Tests
`content-tests.mjs`, `logic-tests.mjs` (word picking from the active list only, banking/mission counting via the shared store, pacing,
save merge, hideout scoring), `ui-smoke.mjs` (Playwright; Chromium preinstalled — `require('playwright')`, never `playwright install`;
mock the natural voice like Spell Jump's ui-smoke): a full case at 390×844 and 844×390 — briefing, sealed notes with spoken words, a miss +
fix, a wrong city, right cities, letters onto the sign, the hideout dictation, postcard, closed screen; the only spoken texts are the words,
their sentences, letters and the hideout sentence; device voice never used; no console errors; no horizontal scroll. Plus Spell Jump's
`spelling-tests`/`sync-smoke`, Lab `core-tests`/`ui-smoke`/`e2e-cross` still pass.
