// Map projection for the New York State map (docs/CONTENT-GUIDE.md, "Map coordinates").
// A plain equirectangular box: x grows west -> east, y grows north -> south, both 0..1.
// The art agent draws the state outline into this same box so city dots land on the right spot.

export const MAP_BOUNDS = Object.freeze({
  west: -79.8,  // longitude at x = 0 (a little west of the Lake Erie shore near the Pennsylvania line)
  east: -71.8,  // longitude at x = 1 (a little east of Montauk Point)
  north: 45.05, // latitude at y = 0 (a little north of the Canada line)
  south: 40.45, // latitude at y = 1 (a little south of Staten Island)
  // The box is 8.0 degrees wide and 4.6 degrees tall. At New York's latitude a degree of longitude is about 0.73 of a
  // degree of latitude, so a true-shape map of this box is about 1.27 times wider than tall (for example 1270 x 1000).
  aspect: 1.27,
});

const round3 = (n) => Math.round(n * 1000) / 1000;

/** Latitude/longitude (degrees) -> { x, y } in 0..1 on the New York map box. */
export function toMap(lat, lng) {
  const { west, east, north, south } = MAP_BOUNDS;
  return { x: round3((lng - west) / (east - west)), y: round3((north - lat) / (north - south)) };
}

// Map projection for the USA Tour map (docs/V0.2-USA.md). Same idea as toMap: a plain equirectangular box, x west -> east,
// y north -> south, both 0..1. The art agent draws the 48 contiguous states into this box at aspect 1.83.
export const US_MAP_BOUNDS = Object.freeze({
  west: -125.0,
  east: -66.5,
  north: 49.6,
  south: 24.2,
  // 58.5 degrees wide x 25.4 degrees tall; a degree of longitude is about 0.79 of a degree of latitude at 37.5 N,
  // so the true shape is about 1.83 : 1.
  aspect: 1.83,
});

/** Latitude/longitude (degrees) -> { x, y } in 0..1 on the USA map box (same formula and rounding as toMap). */
export function toUsMap(lat, lng) {
  const { west, east, north, south } = US_MAP_BOUNDS;
  return { x: round3((lng - west) / (east - west)), y: round3((north - lat) / (north - south)) };
}
