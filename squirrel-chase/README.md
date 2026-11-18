# Pip's Squirrel Chase

A spelling-geography chase, one case a day, served at `/squirrel-chase/`. Static ES modules, no build step. The contract is
`SPEC.md`; the v0.2 additions are in `docs/V0.2-USA.md`; the content rules are in `docs/CONTENT-GUIDE.md`.

## Tests

- `node tools/logic-tests.mjs` (pure logic, no browser)
- `node tools/content-tests.mjs` (the real content)
- `bash build.sh && (cd dist && python3 -m http.server 8811 &)` from the repo root, then
  `BASE_URL=http://localhost:8811 node squirrel-chase/tools/ui-smoke.mjs` and `.../sync-smoke.mjs`, one at a time.
  The UI smoke runs on `tools/fixtures/content.js` (a small NY arc and a small `usa` arc with `usCoords` cities).
- `tools/content-play.mjs` plays every real case (ny-01..06 and usa-01..06) and only passes once the real USA content and art are in.

## How tours (arcs) work

Each arc in `src/content/arcs.js` has a `map` (`'ny'` or `'usa'`; no `map` means `'ny'`). `src/logic/caseModel.js` is the one adapter:
cases play in arc order (New York tour, then USA tour), every map is drawn with the arc of the case in play and lists only that
map's cities (a city with `coords: null` is not on the NY map; a city without `usCoords` is not on the US map). A save that
closed the last case of a tour opens the first case of the next tour on the next local day; closed cases never re-lock.

## Changelog

- **0.2.0** The USA Tour (usa-01..06) is playable on the US map, after the New York tour. The case board shows both tours, the
  album is grouped by tour, travel between US cities is the plane, the Lab card says `NY tour: n / 6`, then `USA tour: n / 6`
  (never a countdown), and the Parent Zone progress line counts each tour.
- **0.1.0** The New York tour (ny-01..06).
