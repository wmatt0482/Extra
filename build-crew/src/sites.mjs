// The three work sites (SPEC §3): the yard (jobs 1 to 10 and the sandbox), the harbor (jobs 11 to 15) and the hillside
// (jobs 16 to 20). This is the ground every layer agrees on: physics.mjs builds the colliders and the machines' ride
// height from it, scene/environment.js draws the same shapes, missions.mjs reads the grass for the "off the grass" rule
// and the scripted solution reads the bounds. Pure numbers and functions, no Three.js or Rapier, so Node and the browser
// read the same data. The yard is unchanged from the first flight: flat 4 m floor tiles and the sandbox's stamps.

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const inRect = (r, x, z) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];

/** The harbor's quay, water, moored barge and the old dock piles (metres; the quay top is y = 0). */
export const HARBOR = {
  /** The quay ends at this x; beyond it is the harbor water. */
  edge: 10,
  water: { level: -1.0, bed: -3.6 },
  /** The moored barge: its deck (top y) and the low gunwale round the deck edge (`rim` above the deck, `rimW` wide). */
  barge: { x: [11, 16.4], z: [-5, 11], deck: -0.25, rim: 0.35, rimW: 0.3 },
  /** Two old piles standing in the water south of the barge, their caps flush with the quay. */
  piles: [
    { x: 11.6, z: -11.4, size: 1.0 },
    { x: 11.6, z: -8.6, size: 1.0 },
  ],
  /** The quay's edge kerb (a low concrete upstand along the water), stopping short of the old dock piles. */
  kerb: { x: 9.9, w: 0.2, h: 0.22, z: [-6.5, 17] },
};

/** The hillside: a lower yard (y = 0) south of z = -3, a gentle haul slope up to an upper terrace (y = 2) north of z = 6,
 *  a steep rock shoulder in the east, and a ravine cut into the upper terrace. */
export const HILL = {
  /** The slope runs from `z0` to `z1` and climbs `rise` metres: 2 m in 9 m is 12.5 degrees. */
  slope: { z0: -3, z1: 6, rise: 2 },
  /** The rock shoulder in the east: it climbs `rise` metres over `run` metres from `x0` (31 degrees). */
  shoulder: { x0: 10.5, run: 3.6, rise: 2.2 },
  /** The ravine: a trench `depth` deep centred on x = `x`, `top` wide at its rims and `floor` wide at the bottom,
   *  starting at z = `z0` (its end wall slopes over `end` metres) and running out through the north fence. */
  ravine: { x: 6, top: 2.8, floor: 1.6, depth: 2.3, z0: 9.2, end: 0.8 },
  /** The heightfield: a square `size` metres across centred on the site, sampled every `cell` metres. */
  grid: { size: 40, cell: 0.5 },
  /** Wet ground that slows wheels (and tracks a little). */
  mud: [
    { x: [0.5, 7.5], z: [-11, -5.4] },
    { x: [-13, -9], z: [-2.2, 1.4] },
  ],
  /** The gravel: the work areas and the haul road. Everything else on the site is grass (or rock where it is steep). */
  gravel: [
    { x: [-16, -4.5], z: [-16, -3.4] },
    { x: [-1.5, 10.5], z: [-16, -3.4] },
    { x: [-12, -4], z: [-3.4, 6.6] },
    { x: [-16, 4.2], z: [6.4, 16] },
    { x: [7.8, 10.5], z: [6.4, 16] },
  ],
};

/** The hillside's ground height at (x, z): the slope, the shoulder, minus the ravine. */
export function hillsideHeight(x, z) {
  const s = HILL.slope,
    sh = HILL.shoulder,
    rv = HILL.ravine;
  let h = s.rise * clamp01((z - s.z0) / (s.z1 - s.z0));
  h += sh.rise * clamp01((x - sh.x0) / sh.run);
  if (z > rv.z0) {
    const across = clamp01((rv.top / 2 - Math.abs(x - rv.x)) / ((rv.top - rv.floor) / 2)),
      along = clamp01((z - rv.z0) / rv.end);
    h -= rv.depth * across * along;
  }
  return h;
}

/** The surface at (x, z) on the hillside: 'mud', 'gravel', 'rock' (steeper than 25 degrees) or 'grass'. */
export function hillsideSurface(x, z) {
  if (HILL.mud.some((r) => inRect(r, x, z))) return 'mud';
  const e = 0.25,
    gx = (hillsideHeight(x + e, z) - hillsideHeight(x - e, z)) / (2 * e),
    gz = (hillsideHeight(x, z + e) - hillsideHeight(x, z - e)) / (2 * e);
  if (Math.hypot(gx, gz) > 0.47) return 'rock';
  return HILL.gravel.some((r) => inRect(r, x, z)) ? 'gravel' : 'grass';
}

/** The harbor ground at (x, z): the quay, the barge deck, or the water's surface. */
export function harborHeight(x, z) {
  const b = HARBOR.barge;
  if (x >= b.x[0] && x <= b.x[1] && z >= b.z[0] && z <= b.z[1]) return b.deck;
  return x > HARBOR.edge ? HARBOR.water.level : 0;
}

/** True when (x, z) is open harbor water (not the quay, not the barge). */
export function inWater(x, z) {
  const b = HARBOR.barge;
  return x > HARBOR.edge && !(x >= b.x[0] && x <= b.x[1] && z >= b.z[0] && z <= b.z[1]);
}

/** Each site: its name and the code on the job board ("THE HARBOR / JOB 12"), the drivable box for a machine's centre
 *  (before each machine's own margin), the fence walls ([x, z, size] boxes, a tall `fenceH` where the ground climbs),
 *  and the ground. `terrain` sites have real slopes the machines pitch and roll on, and their tools work relative to
 *  the ground under the machine; the flat yard keeps the first flight's absolute tool heights. */
export const SITES = {
  yard: {
    id: 'yard',
    name: 'Yard',
    code: 'THE YARD',
    bounds: { x: [-14, 14], z: [-14, 14] },
    floor: 'tiles',
    terrain: false,
    height: () => 0,
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor',
    code: 'THE HARBOR',
    // the machines keep a clear metre and a half from the quay edge
    bounds: { x: [-14, 8.6], z: [-14, 14] },
    floor: 'quay',
    terrain: false,
    height: harborHeight,
    fence: [
      [-17, 0, [1, 3, 35]],
      [-3.5, -17, [28, 3, 1]],
      [-3.5, 17, [28, 3, 1]],
    ],
  },
  hillside: {
    id: 'hillside',
    name: 'Hillside',
    code: 'THE HILLSIDE',
    bounds: { x: [-14, 14], z: [-14, 14] },
    floor: 'terrain',
    terrain: true,
    height: hillsideHeight,
    surface: hillsideSurface,
    fence: [
      [-17, 0, [1, 12, 35]],
      [17, 0, [1, 12, 35]],
      [0, -17, [35, 12, 1]],
      [0, 17, [35, 12, 1]],
    ],
  },
};
export const SITE_ORDER = ['yard', 'harbor', 'hillside'];
export const siteOf = (round) => SITES[round?.site] || SITES.yard;

/** The mud patch under (x, z) on a site, or null. */
export function mudAt(site, x, z) {
  if (site.id !== 'hillside') return null;
  return HILL.mud.find((r) => inRect(r, x, z)) || null;
}

/** True when (x, z) is grass on this site (only the hillside has grass inside the fence). */
export const isGrass = (site, x, z) => site.id === 'hillside' && hillsideSurface(x, z) === 'grass';

/** The heightfield samples of a terrain site: (n + 1) x (n + 1) heights for n cells, in Rapier's layout (index
 *  row + col * (n + 1), rows along z and columns along x, from -size/2 to +size/2), plus a sample function. */
export function terrainGrid(site = SITES.hillside) {
  const { size, cell } = HILL.grid,
    n = Math.round(size / cell),
    heights = new Float32Array((n + 1) * (n + 1));
  for (let col = 0; col <= n; col++) {
    for (let row = 0; row <= n; row++) heights[row + col * (n + 1)] = site.height(-size / 2 + col * cell, -size / 2 + row * cell);
  }
  return { n, size, cell, heights };
}
