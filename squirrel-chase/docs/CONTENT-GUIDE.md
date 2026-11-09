# Pip's Squirrel Chase: content guide and data contract

The content lives in `src/content/` and is plain, deep-frozen data. The app and art code read it only through
`src/content/index.js`. The shapes below are a **stable contract**: fields may be added, but none are renamed or removed
without updating the app. Run `node squirrel-chase/tools/content-tests.mjs` after every change; it must pass.

All text in this folder is **read silently** (SPEC §2). Nothing here is voiced. The only voiced lines are the child's
spelling words, their sentences, the letters and the hideout sentence, and those come from the word store, not from here.

## Exports (`src/content/index.js`)

| Export | Type | What it is |
|---|---|---|
| `CITIES` | `City[]` | 13 cities: the 11 tour cities + Watkins Glen + Binghamton |
| `CASES` | `Case[]` | `ny-01` … `ny-06`, in play order |
| `GANG` | `GangMember[]` | Scrabble (leader), Sudsy, Glint, Snoozy, Bleatrice |
| `ARCS` | `Arc[]` | `ny` (6 cases) and the `usa` placeholder (no cases) |
| `HIDEOUT_TEMPLATES` | `HideoutTemplate[]` | 10 fallback password sentences |
| `CITY_BY_ID`, `CASE_BY_ID`, `GANG_BY_ID`, `CLUE_BY_ID` | lookups by id | `CLUE_BY_ID[id].city` is the city the clue points to |
| `MAP_BOUNDS`, `toMap(lat, lng)` | map projection | see "Map coordinates" |

## Shapes

```js
City = {
  id: 'cooperstown',                  // kebab-case, stable (saved in the album)
  name: 'Cooperstown',
  latLng: { lat: 42.700, lng: -74.924 },
  coords: { x: 0.609, y: 0.511 },     // 0..1 on the New York map box, = toMap(latLng)
  facts: [ { text, source } ],        // 3-4 kid-friendly facts; source is an http(s) URL (never shown to kids)
  sign: 'HALL OF FAME',               // capital letters and spaces; the landmark sign the gang swipes from
  scene: '…',                         // 1-2 lines for the art agent
  clues: [ { id: 'cooperstown-c1', text: '…', fact: 0 } ],   // 6+; point TO this city; `fact` or own `source`
}

GangMember = {
  id: 'glint', name: 'Glint', animal: 'crow', pronoun: 'she', role: 'member' | 'leader',
  personality, reason,                // one line each: who they are, why they swipe letters
  catchphrase, apology,               // apology = how they say sorry at the hideout
  colour: { name: 'midnight purple', hex: '#4B3B78' }, look: '…',   // for the art agent
}

Case = {
  id: 'ny-04', arc: 'ny', order: 4, title: 'The Case of the Vowel Snacker',
  lead: 'bleatrice',                  // gang id leading this case
  crew: ['bleatrice'],                // gang ids at the hideout (the finale has all five)
  sign: {
    city: 'cooperstown', text: 'HALL OF FAME',
    swiped: [1, 5, 9, 11],            // indexes into text, IN RECOVERY ORDER
    letters: 'AOAE',                  // the swiped letters, same order
    word: null,                       // the silly word they spell, or null (the goat only wanted vowels)
    gaps: 'H_LL _F F_M_',             // text with '_' at each swiped index (ready to draw)
  },
  briefing: [ { who: 'chief' | 'pip' | 'wen', text } ],   // 2-4 lines
  route: ['cooperstown', 'binghamton', 'corning', 'watkins-glen'],   // 3-4 city ids
  stops: [ { city, witnesses: [Witness, Witness] } ],                // stops[i].city === route[i]
  hideout: { city, place, description, gangLines: [ { who: gangId, text } ] },
  postcard: { city, facts: [ { text, source }, { text, source } ] }, // the hideout city + 2 of its facts
  teaser: '…',                        // one line about the next case
}

Witness = { name, role, line, clueId, note }
// line   = what the witness says before the sealed note (frames it)
// note   = the text revealed after the child spells the word
// clueId = the clue id at a travel stop (note === that clue's text); null at the hideout city

Arc = { id: 'ny', title, blurb, cases: ['ny-01', …] }
HideoutTemplate = { id: 't01', text: 'Glint hid the {w} next to the {w}.', slots: ['noun', 'noun'] }
```

## How the app plays a case (what the data assumes)

1. **Briefing**: show `briefing` lines (text). Draw `sign.gaps` on the sign (it is in `route[0]`).
2. **Stops**: for each `stops[i]`, the child opens the two witnesses' sealed notes (one spelling word each), so a case
   is 6 or 8 words. At a travel stop (`i < route.length - 1`) each `note` is a clue to `route[i + 1]`. The child then taps
   the next city on the map. Right city: travel, and the letter at `sign.swiped[i]` flies back onto the sign.
3. **Hideout city** (the last stop): the two notes lead to `hideout.place`. Then the hideout password sentence, then
   `hideout.description` and `gangLines`; the remaining letters (`sign.swiped` from index `route.length - 1` on) come
   back, the sign is whole, and the `postcard` goes into the album.
4. **Wrong city tap**: not in the data. Use the SPEC line ("The trail is cold here — check your clues").

There are always more swiped letters than travel legs, so at least one letter comes back at the hideout.

## The cases at a glance

| Case | Lead | Sign (city) | Swiped → word | Route (hideout last) |
|---|---|---|---|---|
| ny-01 The Top Squirrel | Scrabble | STATE CAPITOL (Albany) | T O P → TOP | Albany → Saratoga Springs → Lake Placid |
| ny-02 The Glam Crow | Glint | MUSEUM OF GLASS (Corning) | G L A M → GLAM | Corning → Watkins Glen → Ithaca → Syracuse |
| ny-03 The Squeaky-Clean Letters | Sudsy | ERIE CANAL (Buffalo) | C L E A N → CLEAN | Buffalo → Niagara Falls → Rochester → Ithaca |
| ny-04 The Vowel Snacker | Bleatrice | HALL OF FAME (Cooperstown) | A O A E (vowels only) | Cooperstown → Binghamton → Corning → Watkins Glen |
| ny-05 The Sleepy Sign | Snoozy | MINERAL SPRINGS (Saratoga Springs) | N A P S → NAPS | Saratoga Springs → Lake Placid → Syracuse → Buffalo |
| ny-06 The Pecan Party (finale) | Scrabble + all | CENTRAL PARK (New York City) | P E C A N → PECAN | New York City → Cooperstown → Syracuse → Niagara Falls |

Every city appears in at least one route; every case has a different sign and a different hideout city; no clue is
used twice across the tour. Running gag: the Chief gets the gang's name wrong in every briefing (Squiggle, Doodle,
Scrubble, Nibble, Snoozle), Pip corrects it, and in the finale the Chief finally gets it right.

## Map coordinates

`coords` come from `toMap(lat, lng)` in `src/content/geo.js`, a plain equirectangular box:

- west edge `x = 0` at longitude −79.8, east edge `x = 1` at −71.8;
- north edge `y = 0` at latitude 45.05, south edge `y = 1` at 40.45.

The box holds all of New York State with a little margin (Lake Erie shore to Montauk, Canada line to Staten Island).
For a true-shape map draw the state into a box about **1.27 times wider than tall** (`MAP_BOUNDS.aspect`). The art
agent should trace the state outline into the same box so the dots land on the right places. Close pairs to keep
tappable: Buffalo / Niagara Falls (about 0.05 apart), Corning / Watkins Glen / Ithaca (the Finger Lakes cluster),
Albany / Saratoga Springs.

## Hideout password templates

The game builds the hideout sentence from the child's own list sentences when it can (SPEC §4). When it cannot, it uses
a `HIDEOUT_TEMPLATES` entry: replace each `{w}` with a list word, in order.

- `'noun'` slots come right after "the", so they read right only with a noun.
- `'any'` slots sit inside quotation marks, so any word works ("Scrabble wrote "because" and "quickly" on a leaf.").

Pick a template whose noun slots you can fill with words known to be nouns (for example, the list sentence uses the
word after a/an/the); otherwise use an all-`any` template (t02, t04, t09). Capitals and punctuation are forgiven when
the child types the sentence, so quotation marks never cost points.

## Writing more content (house style)

1. **Facts.** Three or four per city, each one short, true and fun for a 9 to 10 year old, with a reliable source
   (state and city government, NPS, museums, Britannica, visitor bureaus). Add every claim to `docs/SOURCES.md`; the test
   fails if a fact's URL is not listed there. If you cannot verify it, leave it out. Mark thin sources **spot-check**.
2. **Clues.** Six or more per city. A clue is the gang's plan as a witness overheard it ("They wanted to…"), built on one
   verified fact. It must never name the city, and it must point to exactly one tour city: add its key phrase to
   `tools/content/signatures.mjs` and make sure no other city's clue uses it. Waterfalls, lakes, halls of fame, the Erie
   Canal and "oldest" claims are shared by several cities, so always add the detail that makes it unique (96-foot,
   19 waterfalls, toys vs baseball, western end).
3. **Signs.** Generic landmark words in capitals: no logos, brands or company names.
4. **Cases.** A different lead and a different sign each time, 3-4 stops, two townsfolk witnesses per stop with a
   varied, respectful cast (the animals are never witnesses). Use the `w()` and `hw()` helpers in
   `src/content/helpers.js` so the note text is copied from the clue, and `sign()` and `postcard()` so indexes are
   counted for you.
5. **The gang.** Silly and a bit vain, never mean or scary. They "swipe", "take" or "borrow"; at the hideout they hand
   everything back, a little embarrassed, and the lead says sorry.
6. **Reading level.** Grade 3 to 5: short sentences (the test warns above 20 words), everyday words. The readability
   warnings are mostly proper nouns (Susquehanna, Adirondack); read each one and simplify when it is not.

## Kid rules the test enforces

No "kill, die, dead, death, lost, lives, gun, blood, jail, arrest, punish, steal, stole, thief" (plus weapon, shoot,
prison, cop) anywhere, and no pressure words (hurry, countdown, game over, fail). No links in kid-facing text (URLs live
only in `source` fields and are never shown). Wrong taps are never written as failure.
