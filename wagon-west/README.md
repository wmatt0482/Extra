# Wagon West

Learning Lab's fourth game (`learninglab.fun/wagon-west/`): a covered wagon travels the 2,000 miles from Independence,
Missouri to the Willamette Valley, one landmark a session, and the learning is both 4th-grade math and the week's
spelling words, in the places a real journey needed them. `SPEC.md` is the design (§0–§7) and the build contract
(§8–§13); this file is how the app is put together and how to run it.

## Run it

Serve the **repo root** (the games import each other's shared modules by URL: `/spell-jump/` is a symlink to
`car-jump/` in dev):

```sh
python3 -m http.server 8095            # from the repo root
open http://localhost:8095/wagon-west/           # the real scene (falls back to the mock if it is missing)
open http://localhost:8095/wagon-west/?mock=1    # the mock scene (what the UI tests use)
```

`?nosw=1` skips the service worker; `?pings=1` sends the usage pings from localhost.

## How a session goes

Players (the family's, shared with the other games) → the title (the map, "Hit the trail") → the first time, **Outfit**
(name the wagon on the on-screen keyboard, oxen or mules, three companions) and the **General Store** in Independence
→ **the trail**: the scene with the HUD ("Day 23 · Fort Laramie in 41 mi", food, mood faces, the pace and rations
dials, pause). A day is about 6 s. On the way:

- **Mile markers** (4–6 a leg): one fact from the child's Trail Blazer ladder (`nextFact` / `recordAnswer` on
  `trailBlazer.<id>.facts`) on the marker panel (`src/ui/markerPanel.js`, the shared numpad). Right → "Nice!", within
  3 s → "Quick!" (a few free miles); a miss → the fact with its answer, read aloud, then typed once from a cover.
- **Problems** on the problem panel (`src/ui/problemPanel.js`): the store's buys, the rations question (the first dial
  change in a leg), the distance question, repairs, trades. A miss shows the work line by line (read aloud), then the
  answer is typed once. The goods always come at the fair price; a right first answer earns a trade token.
- **Events**: a card, then a problem, a quick fact, the bow hunt or fishing (the scene runs them), or just the news.
- **The stop**: the lookout fact and the sticker; a **river** (three words on Spell Jump's spell panel, recorded with
  `recordSpell` in `spellJump.<id>.words`, then the rope toss on a number line with Fraction Fright's tolerance for the
  child's tier), a **fort** (the store, then the **Post Office**: a letter home whose P.S. words are dictated on the
  spell panel, read back and kept in the journal), a landmark, or home (the child names the homestead).
- **Results**: three stars, cash rows, tokens, the sticker, a crate (paints, flags, bugle calls, hats).

Stopping is always fine: every day is saved and "Make camp" leaves the journey where it is.

## Files (the App stream's)

| File | What |
|---|---|
| `index.html` | markup and all CSS (house structure, warm palette, both orientations, safe areas) |
| `src/main.js` | boot, sync, voice, the scene (real or mock), the screens, the leg lifecycle |
| `src/meta/save.js` · `sync.js` | the save (`wagonWest.<id>.save`, settings `wagonWest.settings`) and the `ww` sync kind with its merge |
| `src/meta/mockScene.js` | the scene API (§11) as a placeholder drawing with scripted hunting / fishing (`?mock=1`) |
| `src/meta/sfx.js` · `selfUpdate.js` | sound effects; reload on a safe screen after an update |
| `src/ui/*` | players, title + map, outfit + looks, store, HUD, trail card, marker / problem panels, river, post office, journal, results, Parent Zone, the spell panel's re-wording; v1.1 camp (`camp.js`) and trail cards (`cards.js`) |
| `sw.js` · `manifest.webmanifest` · `icons/` | the PWA (`tools/make-icons.mjs` draws the wagon icon) |

The journey (`src/journey/*`), the scene (`src/scene/*`) and the content (`src/content/*`) are the other streams'.

## Tests

```sh
BASE_URL=http://localhost:8095 node wagon-west/tools/ui-smoke.mjs     # both layouts on the mock scene (ONLY=landscape|portrait; VOICE_ONLY=1)
BASE_URL=http://localhost:8095 node wagon-west/tools/sync-smoke.mjs   # two devices, one in-memory family server
node wagon-west/tools/make-icons.mjs                                  # redraw the icons
```

## 1.1

The natural voice, the trail's own music, and side games (SPEC "v1.1"):

- **The natural voice really plays.** Spell Jump's `tts.js` uses a natural-voice clip only when one exists for the
  exact sentence, so the app asks for them: `prepareVoice()` at player select, at a voice / family-code change and at
  every leg start (the week's words through `cloud.prepareList()`, the child's active facts both ways round with their
  hints, every lookout, nation fact, event, companion line and trail card, the panels' fixed lines and the river's
  landing sentences for the T1 / T2 fractions), and `app.voiceFor(texts)` just in time (at most 2.5 s) before a
  generated problem, the letter, a riddle or a marker's hint is said. Lines longer than a clip (200 characters) are said
  a sentence or two at a time. Parents → Options shows "Natural voice: Ava · N clips ready" (or "Device voice") and
  "Say a test line" reports which engine spoke (`tts.engine`).
- **Music** (`src/meta/music.js`, the Music stream's): `Music.on` from the settings toggles, the tune by leg
  (Oh! Susanna, Buffalo Gals, Old Dan Tucker), the mood by screen (trail, camp, post) and `off` under any panel, the
  pause sheet or the Parent Zone; the voice ducks it. Spell Jump's `Audio.music()` loop is never started here.
- **Camp** (`src/ui/camp.js`): "Camp" on the trail HUD, Make camp in the pause menu, and the evening of every arrival
  ("Make camp tonight?" / "On to the results"). Fishing, Hunting (when on), Quick Draw (facts against a companion on
  the marker panel, first to 7, a token on a win, always a good-game line), Campfire tales (a lookout or nation story,
  then a riddle: a fact in disguise, a token), Rest. Each one is a day (`camp(J, kind)`). "Back to the trail" / "Stop
  for today".
- **Trail cards** (`src/ui/cards.js`, the content in `src/content/cards.js`): 40 cards in four suits, dropped by
  lookouts (the landmark), trading posts (the nation), spotted animals, hunts and catches (the animal or plant), the
  berries (wild plum), a companion's line at camp (their card) and every arrival (`cardForLeg`); a duplicate is a token,
  a full suit a golden crate. The pop flips in near the top with a chime; the Journal's fourth page is the album.
  The cards are the journey's (`J.cards`); the sync merge keeps the union.
- **Fort Derby**: "Race the mail wagon" in a fort's store (once a visit): the scene's race, a fact at each marker
  (quick → a big burst, right → a burst, a miss → a stumble), `derbyPay`, a card on a win, never a losing message.
- **The dog**: offered at Fort Kearny's store, named on the on-screen keyboard (one of three coats), kept as `J.dog`
  (the app stores it on the journey), in the scene's party, barking (the `bark` event), and finding a berry patch
  every other leg.
- **The daily challenge** on the title (`dailyChallenge` / `claimChallenge`): a token and a card, a check mark once done.
- **Wagon upgrades** in Outfit → Look → Wagon (`UPGRADES` / `buyUpgrade`, tokens or cash), and every look can now be
  bought with tokens.

## Data and sync

One family code syncs all four games. Wagon West adds the per-player kind `ww` (the save) and registers Trail
Blazer's kinds (`tb`, `facts`) so the facts the mile markers record sync from here too; Spell Jump's `words` kind is
built in. Merge: a reset wins; the journey is the later doc's (cash and tokens the max; the trail cards the union);
stickers,
letters, looks and the leg log are unions; the per-day log and the per-kind tallies take the max; crates keep the longer
queue; the streak follows Spell Jump's rule. The family server must list `ww` among its kinds
(`car-jump/src/sync/protocol.mjs`).
