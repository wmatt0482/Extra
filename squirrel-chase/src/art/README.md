# Squirrel Chase art

Hand-built vector SVG (no raster files), pure functions, no globals. The app imports one module: `src/art/index.js`.
Review everything on one page: serve the repo root (`python3 -m http.server 8812`) and open `/squirrel-chase/tools/art-gallery.html`.

Look: sunny road-trip / travel-poster (warm sky, map paper, stamps, postcards), bold flat shapes, no outlines on characters (same family style as Case Files).
Portraits are round badges, `viewBox 0 0 100 100`, `aria-hidden` (the name and text next to them carry the meaning); pass `{ ring: false }` for no badge.

## Exports

| Export | What it does |
| --- | --- |
| `drawMap(el, { cities, highlight, visited, arc = 'ny', usRoute })` | Fills `el` with the responsive map SVG: `arc: 'ny'` (default, the NY map) or `arc: 'usa'` (the US map). Returns `{ svg, pins, update }`. |
| `mapSvg(opts)` | Same map as a string (no handlers). |
| `US_BOX` | `{ west: -125.0, east: -66.5, north: 49.6, south: 24.2, aspect: 1.83, width: 720, height: 393.4 }` (the US map box, same numbers as `US_MAP_BOUNDS`). |
| `MAP_BOX` | `{ lonMin: -79.8, lonMax: -71.8, latMin: 40.45, latMax: 45.05, width: 720, height: 560 }` |
| `gangPortrait(memberId, mood, opts?)` | `memberId`: `squirrel｜raccoon｜crow｜possum｜goat`; `mood`: `smug｜surprised｜sorry｜laughing`. |
| `GANG_IDS`, `GANG_MOODS`, `GANG_LOOK` | Ids, moods, and `{ name, animal, color, tint, prop }` per member (names come from the content: Scrabble, Sudsy, Glint, Snoozy, Bleatrice; a content id such as `sudsy` is accepted as a member id). |
| `witnessPortrait(seed, opts?)` | Deterministic townsperson (any string/number seed): ages, skin tones, hair, head coverings, glasses, beards, outfits. |
| `signSvg(text, missingIdx = [], opts?)` | Landmark sign, variant `wood｜metal｜neon` picked from the text (or `opts.variant`). Indexes in `missingIdx` are indexes into `text` (spaces count) and show as empty slots. Long texts wrap to two lines at a space. |
| `animateLetterIn(el, idx)` | `el` = the sign svg or a container. Flies the missing letter at `idx` into its slot (rotating drop-in, bounce, sparkles). Reduced motion: a plain 260 ms fade. Returns a Promise (resolves `true` when it landed, `false` if already filled / not found). |
| `fillLetter(el, idx)` | Fill a slot instantly (restoring a closed case). |
| `postcardSvg(city, opts?)` | `city = { id, name, scene? }`: "Greetings from" postcard 600x400 with scene, perforated stamp and postmark. The 11 USA Tour scenes say U.S.A. / USA TOUR; the NY ones say NEW YORK / NY TOUR. `opts.tour: 'usa' \| 'ny'` forces the wording (e.g. New York City closing the USA tour). |
| `sceneKey(city)` | Which scene a city gets (`rochester buffalo niagara syracuse albany cooperstown corning lakeplacid saratoga ithaca nyc generic` plus the USA Tour `boston philadelphia washington capecanaveral neworleans sanantonio stlouis chicago denver seattle sanfrancisco`). A `city.scene` that is itself a scene key wins (prose in `scene` is ignored), else matched from id/name; USA cities are matched first (`new-orleans` is `neworleans`, never `nyc`). |
| `pipPortrait(mood)`, `chiefPortrait()`, `wenPortrait()` | Copies of Case Files' cast (`cast.js`, same shapes), sunny ring fills. Pip moods: `happy｜thinking｜surprised｜cheer`. |
| `travelSvg(mode)` | `plane｜train｜car` (160x80, facing right; flip with `transform: scaleX(-1)`). `.sq-trail` is the puff / speed-line group. |
| `SIGN_VARIANTS` | `['wood','metal','neon']`. |

## Map

Bounding box (city `coords` are `{ x, y }` in 0..1 over this box): longitude -79.8 .. -71.8 (west to east), latitude 45.05 .. 40.5 (north to south).
`x = (lon + 79.8) / 8`, `y = (45.05 - lat) / 4.6`. Example Rochester (-77.61, 43.16) is `{ x: 0.274, y: 0.411 }`.

- Pins: each is `<g class="sqm-pin" data-city="id" role="button" tabindex="0" aria-label="Name">`. Attach click handlers to `pins[id]` (or delegate on `[data-city]`).
  Enter / Space on a focused pin fires a click. The transparent hit target is about 48 px on a 390 px phone (it shrinks toward half the distance to the nearest other pin when cities are very close).
- `highlight: 'syracuse'` = glowing pin; `visited: ['rochester']` = green stamped pins. `update({ highlight, visited })` toggles both without redrawing (handlers stay).
- Labels are placed automatically around each pin (long names wrap to two lines, a dotted leader line joins a label that cannot sit beside its pin). A city may force a side with `label: 'r'|'l'|'tr'|'tl'|'br'|'bl'|'b'|'t'`.
- Inset (top-left, NY map only): a small U.S.A. map with New York marked. `usRoute: [[lon, lat], ...]` draws a dashed route on it.
- `arc: 'ny'` skips cities whose `coords` is `null`; `arc: 'usa'` skips cities without `usCoords`.
- Styles are scoped inside the svg (`sqm-*` classes). Animations stop under `prefers-reduced-motion`.

## Notes

- Fonts: headings use `Alfa Slab One` with a Georgia / serif fallback, labels use `Baloo 2` / system sans. Nothing is loaded by the art; if the app loads those fonts the art picks them up.
- Every svg that needs gradients / clip paths gets unique ids per call, so many can sit on one page.
- Sizes: gang portrait about 5 KB, witness 3 KB, a sign 4-7 KB, a postcard 8-12 KB, the map about 25 KB.

## USA map (`arc: 'usa'`)

Box: the contract's `US_MAP_BOUNDS` (west -125.0, east -66.5, north 49.6, south 24.2, aspect 1.83), drawn at 720 x 393.4 (`US_BOX`). A city's `usCoords` `{ x, y }` (0..1, from `toUsMap`) times 720 / 393.4 is the pin tip. No inset, compass bottom-left.

- Drawn: contiguous 48 states, light dashed state lines, Great Lakes (and Okeechobee, Great Salt Lake, Champlain, Lake of the Woods), Pacific / Atlantic / Gulf, Canada and Mexico as dim land, rivers (Mississippi, Missouri, Ohio, Arkansas, Colorado, Columbia, Snake, Rio Grande), mountain ranges (Rockies, Cascades, Sierra, Appalachians, Ozarks), New York State in gold as the home state.
- Outline source: Natural Earth 1:50m admin-1 states, lakes and land (public domain), clipped to the box, Douglas-Peucker simplified (0.55 units) and pre-projected by a throwaway script (deleted), stored as path strings in `usdata.js` (about 28 KB; regenerate it only if the bounds change). `usmap.js` draws the layers. Pin accuracy was checked by point-in-polygon: every pin sits inside its own state, within 2 units (about 1 px on a phone) of the coast / river / lake edge it belongs to (Chicago on Lake Michigan's SW shore, Seattle on Puget Sound, New Orleans at the delta, Cape Canaveral on Florida's east coast).
- Bounds are a local copy in `usmap.js` (`US_BOX`); when `src/content/geo.js` exports `US_MAP_BOUNDS`, import it there instead (the numbers are identical).
- Pins and labels use the NY map's code at 0.85 scale. The north-east corridor (Boston / New York City / Philadelphia / Washington) uses fixed label spots in `US_HINTS` in `map.js` (Boston above, NYC up-left, Washington left, Philadelphia out in the Atlantic on a dotted stake) so labels never meet; a city's own `label` wins. The pins themselves are less than a thumb apart on a phone, so the app's close-pins zoom-in list (`closeTo` in caseView, 50 px) still applies; every other pin has a 43-51 px hit target at 390 px.
- A hint may also be `{ a: 'start' | 'end', dx, dy }`: the label box's left (start) or right (end) top corner relative to the pin tip (dotted leader added automatically).

## USA Tour postcards

11 scenes (`boston philadelphia washington capecanaveral neworleans sanantonio stlouis chicago denver seattle sanfrancisco`), same flat style, generic landmarks only (golden-domed hall, hall with a clock tower and a cracked bell, white domed capitol, rocket on a pad, balconies and a paddle steamer, mission and river walk, a silver arch, skyline and a mirrored blob, snowy peaks, a slim saucer tower, a red suspension bridge and pastel houses); no text, logos or brands.

## Travel

`travelSvg('plane')` is an airliner with a contrail and reads at any hop length (it is the same icon whether it crosses the state or the country; the app animates its travel).
