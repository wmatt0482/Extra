# Squirrel Chase art

Hand-built vector SVG (no raster files), pure functions, no globals. The app imports one module: `src/art/index.js`.
Review everything on one page: serve the repo root (`python3 -m http.server 8812`) and open `/squirrel-chase/tools/art-gallery.html`.

Look: sunny road-trip / travel-poster (warm sky, map paper, stamps, postcards), bold flat shapes, no outlines on characters (same family style as Case Files).
Portraits are round badges, `viewBox 0 0 100 100`, `aria-hidden` (the name and text next to them carry the meaning); pass `{ ring: false }` for no badge.

## Exports

| Export | What it does |
| --- | --- |
| `drawMap(el, { cities, highlight, visited, arc = 'ny', usRoute })` | Fills `el` with the responsive NY map SVG. Returns `{ svg, pins, update }`. |
| `mapSvg(opts)` | Same map as a string (no handlers). |
| `MAP_BOX` | `{ lonMin: -79.8, lonMax: -71.8, latMin: 40.5, latMax: 45.05, width: 720, height: 560 }` |
| `gangPortrait(memberId, mood, opts?)` | `memberId`: `squirrel｜raccoon｜crow｜possum｜goat`; `mood`: `smug｜surprised｜sorry｜laughing`. |
| `GANG_IDS`, `GANG_MOODS`, `GANG_LOOK` | Ids, moods, and `{ name, animal, color, tint, prop }` per member (Scrabble, Bandit, Glint, Snooze, Munch; names are art-side suggestions only). |
| `witnessPortrait(seed, opts?)` | Deterministic townsperson (any string/number seed): ages, skin tones, hair, head coverings, glasses, beards, outfits. |
| `signSvg(text, missingIdx = [], opts?)` | Landmark sign, variant `wood｜metal｜neon` picked from the text (or `opts.variant`). Indexes in `missingIdx` are indexes into `text` (spaces count) and show as empty slots. Long texts wrap to two lines at a space. |
| `animateLetterIn(el, idx)` | `el` = the sign svg or a container. Flies the missing letter at `idx` into its slot (rotating drop-in, bounce, sparkles). Reduced motion: a plain 260 ms fade. Returns a Promise (resolves `true` when it landed, `false` if already filled / not found). |
| `fillLetter(el, idx)` | Fill a slot instantly (restoring a closed case). |
| `postcardSvg(city, opts?)` | `city = { id, name, scene? }`: "Greetings from" postcard 600x400 with scene, perforated stamp and postmark. |
| `sceneKey(city)` | Which scene a city gets (`rochester buffalo niagara syracuse albany cooperstown corning lakeplacid saratoga ithaca nyc generic`). `city.scene` wins, else matched from id/name. |
| `pipPortrait(mood)`, `chiefPortrait()`, `wenPortrait()` | Copies of Case Files' cast (`cast.js`, same shapes), sunny ring fills. Pip moods: `happy｜thinking｜surprised｜cheer`. |
| `travelSvg(mode)` | `plane｜train｜car` (160x80, facing right; flip with `transform: scaleX(-1)`). `.sq-trail` is the puff / speed-line group. |
| `SIGN_VARIANTS` | `['wood','metal','neon']`. |

## Map

Bounding box (city `coords` are `{ x, y }` in 0..1 over this box): longitude -79.8 .. -71.8 (west to east), latitude 45.05 .. 40.5 (north to south).
`x = (lon + 79.8) / 8`, `y = (45.05 - lat) / 4.55`. Example Rochester (-77.61, 43.16) is `{ x: 0.274, y: 0.416 }`.

- Pins: each is `<g class="sqm-pin" data-city="id" role="button" tabindex="0" aria-label="Name">`. Attach click handlers to `pins[id]` (or delegate on `[data-city]`).
  Enter / Space on a focused pin fires a click. The transparent hit target is about 48 px on a 390 px phone (it shrinks toward half the distance to the nearest other pin when cities are very close).
- `highlight: 'syracuse'` = glowing pin; `visited: ['rochester']` = green stamped pins. `update({ highlight, visited })` toggles both without redrawing (handlers stay).
- Labels are placed automatically around each pin (long names wrap to two lines, a dotted leader line joins a label that cannot sit beside its pin). A city may force a side with `label: 'r'|'l'|'tr'|'tl'|'br'|'bl'|'b'|'t'`.
- Inset (top-left): a small U.S.A. map with New York marked. `usRoute: [[lon, lat], ...]` draws a dashed route on it for later US arcs. `arc` other than `'ny'` currently reuses the NY map.
- Styles are scoped inside the svg (`sqm-*` classes). Animations stop under `prefers-reduced-motion`.

## Notes

- Fonts: headings use `Alfa Slab One` with a Georgia / serif fallback, labels use `Baloo 2` / system sans. Nothing is loaded by the art; if the app loads those fonts the art picks them up.
- Every svg that needs gradients / clip paths gets unique ids per call, so many can sit on one page.
- Sizes: gang portrait about 5 KB, witness 3 KB, a sign 4-7 KB, a postcard 8-12 KB, the map about 25 KB.
