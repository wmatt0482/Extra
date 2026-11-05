// Build Crew's data: toys, machines, the twenty jobs across three sites (the yard, the harbor and the hillside), the Lab
// blueprints, the sandbox, hints and every phrase the voice may speak. It is plain data (the ground of each site comes
// from sites.mjs), so physics, missions, the scene, the app and the Node tests all read the same numbers. The downtown
// and moon base sites and the machines SPEC.md lists for them are deliberately absent until they are built.
import { SITES } from './sites.mjs';
/** The game version reported by pings and the Parent Zone (the service worker has its own cache version). */
export const VERSION = '0.6.0';
/** The five paint colors for loads: red first, because the jobs say "red loads"; also the confetti colors. */
export const COLORS = ['#c6412f', '#e9aa26', '#287da5', '#64816b', '#87909c'];
/** Toy shapes. size is [width, height, depth] in metres (a cylinder uses width as its diameter), mass in kilograms.
 *  round toys get a cylinder collider; fragile glass turns to glitter on a hard hit and returns to its start. */
export const TOYS = {
  cube: { name: 'Cube', size: [1.2, 1.2, 1.2], mass: 24 },
  beam: { name: 'Beam', size: [4, 0.65, 1.15], mass: 55 },
  slab: { name: 'Slab', size: [3.7, 0.55, 3.7], mass: 67 },
  pallet: { name: 'Pallet', size: [2, 0.45, 1.8], mass: 34 },
  barrel: { name: 'Barrel', size: [1.1, 1.5, 1.1], mass: 29, round: true },
  pipe: { name: 'Pipe', size: [1, 2.2, 1], mass: 38, round: true },
  glass: { name: 'Glass', size: [2, 1.8, 0.25], mass: 14, fragile: true },
};
/** Machine metadata shared by every layer: the unit ID and label on cards, the paint, drive speed (m/s), turn rate
 *  (rad/s), the tool's height range and reach range in metres, and the first hint shown when the machine is chosen.
 *  The MACHINE tables in physics.mjs, scene/machines.js and app/hud.js add each layer's own parts by kind. */
export const MACHINES = {
  skid: {
    name: 'SS-01',
    label: 'Skid steer',
    color: '#e9aa26',
    speed: 3.1,
    turn: 1.6,
    height: [0.7, 3.8],
    reach: [2.7, 2.7],
    hint: 'WASD or the left stick drives. This skid steer turns on the spot.',
  },
  excavator: {
    name: 'EX-02',
    label: 'Excavator',
    color: '#d75a29',
    speed: 2.1,
    turn: 1.1,
    height: [0.7, 6.2],
    reach: [2.6, 6],
    hint: 'Lift with I or the right stick. J and L reach out and in.',
  },
  crane: {
    name: 'CR-03',
    label: 'Crane',
    color: '#d5dce2',
    speed: 1.8,
    turn: 0.85,
    height: [0.7, 10],
    reach: [3.5, 9],
    hint: 'I and K lift the magnet. J and L swing the boom.',
  },
  // WL-06 (0.6): a free machine like the first three, earned at job 16 and used on the hillside. It steers by bending in
  // the middle, so it turns slowly on the spot; the lift is the bucket's height, which rises on the arms' arc (the reach
  // range is where that arc puts the bucket).
  loader: {
    name: 'WL-06',
    label: 'Wheel loader',
    color: '#d9a21b',
    speed: 3.4,
    turn: 0.95,
    height: [0.7, 4.4],
    reach: [2.8, 3.8],
    hint: 'The wheel loader bends in the middle to steer. I and K lift the bucket, J and L tilt it.',
  },
  // The two Lab machines (0.5): bought with Lab coins, so availableMachines() (app/rounds.js) only lists them for a
  // builder who owns bc.veh.<kind>. The jobs never use them; they work in the sandbox. Their physics, model and card
  // rows are in physics.mjs, scene/machines.js and app/hud.js.
  dump: {
    name: 'DT-04',
    label: 'Dump truck',
    color: '#e1b21c',
    speed: 3.3,
    turn: 0.8,
    // The lift joint is the bed's tip: 0.7 is flat, the top of the range is fully tipped (physics.mjs DUMP).
    height: [0.7, 2.5],
    reach: [0, 0],
    lab: true,
    hint: 'Raise the lift to tip the bed. Load it first, then roll forward as the blocks pour out.',
  },
  fork: {
    name: 'FL-05',
    label: 'Forklift',
    color: '#ee7d1a',
    speed: 2.6,
    turn: 1.5,
    // The lift joint is the height of the fork tops above the floor.
    height: [0.1, 3.3],
    reach: [0, 0],
    lab: true,
    hint: 'Lower the forks, line up with a pallet opening and drive in slowly. Then lift.',
  },
};
/** The Lab machines, in card order, and the Lab item id that unlocks each. */
export const LAB_MACHINES = ['dump', 'fork'];
export const labVehicleId = (kind) => `bc.veh.${kind}`;
// Small builders for the job table: a toy resting just above the ground, a ghost outline to fill, and a supply of
// toys laid out in rows of three in the loading area, clear of the pad.
const toy = (x, z, type = 'cube', color = COLORS[0]) => ({ type, color, x, y: TOYS[type].size[1] / 2 + 0.08, z });
const ghost = (x, y, z, type = 'cube') => ({ x, y, z, type });
const supply = (n, type = 'cube') =>
  Array.from({ length: n }, (_, i) => toy(-6 + (i % 3) * 2.7, 3 + Math.floor(i / 3) * 3, type));
// Every first-flight job is in the yard and shares the blue delivery pad (centre x/z, width w, depth d).
const base = { site: 'yard', pad: { x: 5, z: 5, w: 8, d: 8 }, props: [] };
// The harbor and hillside jobs (0.6) bring their own pads. On the hillside a toy or a ghost sits on the ground under it
// (the terrace is 2 m up): `on` rests a toy on the site's ground, `ghostOn` puts a ghost's centre `h` above it.
const harbor = { site: 'harbor', props: [] };
const hillside = { site: 'hillside', props: [] };
const on = (site, x, z, type = 'cube', color = COLORS[0]) => ({
  type,
  color,
  x,
  y: +(SITES[site].height(x, z) + TOYS[type].size[1] / 2 + 0.08).toFixed(3),
  z,
});
const ghostOn = (site, x, h, z, type = 'cube') => ({ x, y: +(SITES[site].height(x, z) + h).toFixed(3), z, type });
/** The colour of the hillside's spoil and fill blocks: the site's terracotta soil. */
const SPOIL = '#a5643e';
/** The ten jobs, in order. A job with ghosts is a blueprint (one matching toy per ghost); a job without ghosts is a
 *  delivery (every toy wholly inside the pad). props are fixed colliders such as the raised platform and the wall.
 *  flag, when present, is a height flag {x, z, height} drawn as a pole and pennant. reward is what the child is told;
 *  unlock is the save's reward id (a paint, decal, horn or machine kind). */
export const ROUNDS = [
  {
    ...base,
    id: 1,
    title: 'Cargo transfer',
    goal: 'Transfer three red loads to the blue delivery zone.',
    machines: ['skid'],
    toys: supply(3),
    reward: 'Limestone paint',
    unlock: 'cream',
  },
  {
    ...base,
    id: 2,
    title: 'Bulk handling',
    goal: 'Transfer all six red loads to the blue delivery zone.',
    machines: ['skid'],
    toys: supply(6),
    reward: 'EX-02 excavator',
    unlock: 'excavator',
  },
  {
    ...base,
    id: 3,
    title: 'Foundation grid',
    goal: 'Place the three blocks on their glowing outlines.',
    machines: ['excavator'],
    toys: supply(3),
    ghosts: [ghost(3, 0.6, 5), ghost(5, 0.6, 5), ghost(7, 0.6, 5)],
    reward: 'Forest paint',
    unlock: 'leaf',
  },
  {
    ...base,
    id: 4,
    title: 'Wall assembly',
    goal: 'Assemble a two-layer wall on the blueprint.',
    machines: ['excavator'],
    toys: supply(4),
    ghosts: [ghost(3, 0.6, 5), ghost(4.25, 0.6, 5), ghost(3, 1.8, 5), ghost(4.25, 1.8, 5)],
    reward: 'Star decal',
    unlock: 'star',
  },
  {
    ...base,
    id: 5,
    title: 'Bridge span',
    goal: 'Place two supports and a beam to make a bridge.',
    machines: ['skid', 'excavator'],
    toys: [toy(-6, 3), toy(-3, 3), toy(-5, 7, 'beam')],
    ghosts: [ghost(2, 0.6, 5), ghost(5, 0.6, 5), ghost(3.5, 1.525, 5, 'beam')],
    reward: 'CR-03 crane',
    unlock: 'crane',
  },
  {
    ...base,
    id: 6,
    title: 'High lift',
    goal: 'Lift three blocks onto the high blue platform.',
    machines: ['crane'],
    toys: supply(3),
    ghosts: [ghost(2, 4.6, 5), ghost(4, 4.6, 5), ghost(6, 4.6, 5)],
    props: [{ x: 4, y: 2, z: 5, size: [7, 4, 3.2], kind: 'platform' }],
    reward: 'Steel blue paint',
    unlock: 'sky',
  },
  {
    ...base,
    id: 7,
    title: 'Over the wall',
    goal: 'Lift four red loads over the barrier into the delivery zone.',
    machines: ['crane', 'skid'],
    toys: [toy(-5, 3), toy(-5, 6), toy(-8, 3), toy(-8, 6)],
    props: [{ x: -0.5, y: 1.6, z: 5, size: [0.6, 3.2, 11], kind: 'wall' }],
    reward: 'Bell horn',
    unlock: 'bell',
  },
  {
    ...base,
    id: 8,
    title: 'High stack',
    goal: 'Stack four blocks to reach the height marker.',
    flag: { x: 6, z: 5, height: 5 },
    machines: ['excavator'],
    toys: supply(4),
    ghosts: [0, 1, 2, 3].map((i) => ghost(4, 0.6 + 1.2 * i, 5)),
    reward: 'Stripe decal',
    unlock: 'stripe',
  },
  {
    ...base,
    id: 9,
    title: 'Portal frame',
    goal: 'Build two tall legs and rest the beam on top.',
    machines: ['crane', 'excavator'],
    toys: [...supply(4), toy(-5, 9, 'beam')],
    ghosts: [ghost(2, 0.6, 5), ghost(5, 0.6, 5), ghost(2, 1.8, 5), ghost(5, 1.8, 5), ghost(3.5, 2.725, 5, 'beam')],
    reward: 'Sunset paint',
    unlock: 'sunset',
  },
  {
    ...base,
    id: 10,
    title: 'Water tower',
    goal: 'Build four legs and lift the tank onto the top.',
    machines: ['skid', 'excavator', 'crane'],
    toys: [...supply(4), toy(-5, 9, 'slab')],
    ghosts: [
      ghost(2, 0.6, 4),
      ghost(4.5, 0.6, 4),
      ghost(2, 0.6, 6.5),
      ghost(4.5, 0.6, 6.5),
      ghost(3.25, 1.475, 5.25, 'slab'),
    ],
    reward: 'Yard badge and wrecking ball',
    unlock: 'wrecking',
  },
  // ---- The harbor (0.6): jobs 11 to 15 on the quay, beside the moored barge and the old dock piles ------------------
  // Every job is finished with the machines every builder has (the skid steer, excavator, crane and, from job 16, the
  // wheel loader). `optional` lists the Lab machines that join the job when this builder owns them: a quicker way that
  // is never needed. A pad with `mark: false` is not painted (it lies over the water or across a ravine).
  {
    ...harbor,
    id: 11,
    title: 'Quay transfer',
    goal: 'Move all eight red loads into the blue loading bay.',
    machines: ['skid'],
    optional: ['dump'],
    pad: { x: 5, z: 4.5, w: 8.5, d: 10 },
    toys: supply(8),
    reward: 'Chevron decal',
    unlock: 'chevron',
  },
  {
    ...harbor,
    id: 12,
    title: 'Pallet bay',
    goal: 'Move the three pallets and their loads into the blue pallet bay.',
    machines: ['crane', 'skid'],
    optional: ['fork'],
    pad: { x: 5, z: 5, w: 9, d: 9 },
    // the loads first (they ride on the pallets), then the pallets under them
    toys: [
      ...[-6, -3.3, -0.6].map((x) => ({ type: 'cube', color: COLORS[1], x, y: 1.15, z: 3 })),
      ...[-6, -3.3, -0.6].map((x) => toy(x, 3, 'pallet')),
    ],
    reward: 'Graphite paint',
    unlock: 'graphite',
  },
  {
    ...harbor,
    id: 13,
    title: 'Barge loading',
    goal: 'Lift four red loads over the quay barrier onto the barge.',
    machines: ['crane', 'skid'],
    optional: ['dump'],
    pad: { x: 13.6, z: 3, w: 4.4, d: 7 },
    toys: supply(4),
    props: [{ x: 9.6, y: 0.55, z: 3, size: [0.4, 1.1, 9], kind: 'barrier' }],
    reward: 'Harbor blue paint',
    unlock: 'harbor',
  },
  {
    ...harbor,
    id: 14,
    title: 'Warehouse shelf',
    goal: 'Build the shelf: four steel posts, the slab across them and a crate on top.',
    machines: ['crane', 'excavator'],
    toys: [
      ...[
        [-6, 3],
        [-3.3, 3],
        [-0.6, 3],
        [-6, 6],
      ].map(([x, z]) => toy(x, z, 'pipe', COLORS[4])),
      toy(-2.5, 9.6, 'slab', COLORS[2]),
      toy(-0.6, 6.2, 'cube', COLORS[1]),
    ],
    ghosts: [
      ghost(3.7, 1.1, 3.7, 'pipe'),
      ghost(6.3, 1.1, 3.7, 'pipe'),
      ghost(3.7, 1.1, 6.3, 'pipe'),
      ghost(6.3, 1.1, 6.3, 'pipe'),
      ghost(5, 2.475, 5, 'slab'),
      ghost(5, 3.35, 5),
    ],
    reward: 'Anchor decal',
    unlock: 'anchor',
  },
  {
    ...harbor,
    id: 15,
    title: 'Dock build',
    goal: 'Build the dock: two beams from the quay out to the piles, then the deck slab on top.',
    machines: ['crane', 'skid'],
    optional: ['dump'],
    pad: { x: 10.2, z: -10, w: 5, d: 5, mark: false },
    toys: [toy(-6, 5.5, 'beam', COLORS[1]), toy(-6, 2.5, 'beam', COLORS[1]), toy(-0.8, 6.5, 'slab', COLORS[4])],
    ghosts: [ghost(10, 0.325, -11.4, 'beam'), ghost(10, 0.325, -8.6, 'beam'), ghost(10.4, 0.925, -10, 'slab')],
    reward: 'Ferry horn',
    unlock: 'ferry',
  },
  // ---- The hillside (0.6): jobs 16 to 20 on real slopes, with mud, grass, a ravine and a terrace -------------------
  {
    ...hillside,
    id: 16,
    title: 'Haul road',
    goal: 'Haul four loads of fill up the haul road to the blue pad at the top.',
    machines: ['loader'],
    pad: { x: -8, z: 10.5, w: 8, d: 6 },
    toys: [1, 3.6, 6.2, 8.8].map((x) => on('hillside', x, -7, 'cube', SPOIL)),
    reward: 'WL-06 wheel loader',
    unlock: 'loader',
  },
  {
    ...hillside,
    id: 17,
    title: 'Mud pass',
    goal: 'Clear the mud pass: carry the five spoil blocks to the blue pad. Keep every block off the grass.',
    machines: ['loader', 'skid'],
    rules: ['noGrass'],
    pad: { x: -9.5, z: -6.5, w: 8, d: 7 },
    toys: [
      [1.5, -7],
      [4.5, -7],
      [7.5, -7],
      [3, -4.8],
      [6, -4.8],
    ].map(([x, z]) => on('hillside', x, z, 'cube', SPOIL)),
    reward: 'Sage paint',
    unlock: 'sage',
  },
  {
    ...hillside,
    id: 18,
    title: 'Borrow pit',
    goal: 'Haul the four loads from the orange pit pad up to the blue pad on the terrace.',
    machines: ['excavator', 'loader'],
    optional: ['dump'],
    source: { x: 5.25, z: -7, w: 10, d: 3 },
    pad: { x: -3.7, z: 10.5, w: 6, d: 6 },
    toys: [
      on('hillside', 1.5, -7),
      on('hillside', 4, -7, 'barrel', COLORS[2]),
      on('hillside', 6.5, -7),
      on('hillside', 9, -7, 'barrel', COLORS[2]),
    ],
    reward: 'Rust paint',
    unlock: 'rust',
  },
  {
    ...hillside,
    id: 19,
    title: 'Ravine bridge',
    goal: 'Bridge the ravine for the toy car: stand a barrel on each side, then lay the beam across.',
    machines: ['loader', 'crane'],
    pad: { x: 6, z: 13, w: 7, d: 3, mark: false },
    toys: [
      on('hillside', -9, 13, 'barrel', COLORS[2]),
      on('hillside', -6.6, 13, 'barrel', COLORS[2]),
      on('hillside', -12.5, 15, 'beam', COLORS[1]),
    ],
    ghosts: [
      ghostOn('hillside', 4, 0.75, 13, 'barrel'),
      ghostOn('hillside', 8, 0.75, 13, 'barrel'),
      // over the ravine: the beam rests on the barrel tops, 1.5 m above the terrace (2 m)
      ghost(6, 3.825, 13, 'beam'),
    ],
    // the toy car waits at the west end and drives across once the bridge stands (scene only, no collider)
    decor: [{ kind: 'car', x: 2.1, z: 13 }],
    reward: 'Mountain decal',
    unlock: 'mountain',
  },
  {
    ...hillside,
    id: 20,
    title: 'Lookout',
    goal: 'Build the lookout at the top of the slope: four legs, the deck slab and the beacon on top.',
    machines: ['skid', 'excavator', 'crane', 'loader'],
    pad: { x: -7.5, z: 10, w: 5, d: 5 },
    toys: [
      ...[-3.4, -0.8, 1.8, 4].map((x) => on('hillside', x, 14.5)),
      on('hillside', -11.5, 14.4, 'slab', COLORS[4]),
      on('hillside', -13.8, 13, 'barrel', COLORS[1]),
    ],
    ghosts: [
      ghostOn('hillside', -8.75, 0.6, 8.75),
      ghostOn('hillside', -6.25, 0.6, 8.75),
      ghostOn('hillside', -8.75, 0.6, 11.25),
      ghostOn('hillside', -6.25, 0.6, 11.25),
      ghostOn('hillside', -7.5, 1.475, 10, 'slab'),
      ghostOn('hillside', -7.5, 2.5, 10, 'barrel'),
    ],
    reward: 'Steam horn',
    unlock: 'steam',
  },
];
// ---- The four Lab blueprints (0.5): jobs 101 to 104 ----------------------------------------------------------------
// Ghost-outline builds like jobs 3 and 4, with new ids so jobs 1 to 10 are untouched. They are unlocked with Lab coins
// (bc.bp.<key>, see app/title.js and labBridge.owns) and use only the three machines everyone has, so a builder who
// has bought a blueprint can always finish it. Each carries a build challenge with a target, never a clock:
//   { kind: 'grabs',  par: n }       grab-and-release moves from the start of the job; "Grabs 4 · par 9"
//   { kind: 'height', metres: m }    the tallest settled block top reaches m at some point; "Height 3.6 m · target 6 m"
// Meeting it adds a "Neat build!" badge to the finished sheet and a `challenge` event to the Lab; missing it changes
// nothing and says nothing. A blueprint's `price` mirrors the Lab catalogue (a Node test compares them).
const bp = (id, key, price, rest) => ({ ...base, id, blueprint: key, price, lab: `bc.bp.${key}`, ...rest });
export const BLUEPRINTS = [
  bp(101, 'lighthouse', 2400, {
    title: 'Lighthouse',
    goal: 'Build the lighthouse on its blueprint: a slab, three blocks and a barrel for the lamp.',
    machines: ['crane'],
    toys: [
      toy(-5, 9.5, 'slab'),
      toy(-6, 3),
      toy(-3.3, 3),
      toy(-0.6, 3),
      toy(-0.6, 6, 'barrel', COLORS[2]),
      toy(-6, 6),
      toy(-3.3, 6),
    ],
    ghosts: [
      ghost(4, 0.275, 5, 'slab'),
      ghost(4, 1.15, 5),
      ghost(4, 2.35, 5),
      ghost(4, 3.55, 5),
      ghost(4, 4.9, 5, 'barrel'),
    ],
    flag: { x: 6.6, z: 5, height: 6.4 },
    challenge: { kind: 'height', metres: 6.4 },
    reward: 'Blueprint complete',
  }),
  bp(102, 'windmill', 2400, {
    title: 'Windmill',
    goal: 'Build the windmill: a three-block tower, a beam across the top for the sails and a door.',
    machines: ['excavator'],
    toys: [toy(-6, 3), toy(-3.3, 3), toy(-0.6, 3), toy(-6, 6), toy(-5, 9, 'beam')],
    ghosts: [
      ghost(4, 0.6, 5),
      ghost(4, 1.8, 5),
      ghost(4, 3.0, 5),
      ghost(4, 0.6, 3.75),
      ghost(4, 3.925, 5, 'beam'),
    ],
    challenge: { kind: 'grabs', par: 8 },
    reward: 'Blueprint complete',
  }),
  bp(103, 'castlegate', 3600, {
    title: 'Castle gate',
    goal: 'Build the gate: two towers, a beam across them and a block on each end.',
    machines: ['excavator', 'crane'],
    toys: [
      ...supply(6),
      toy(-5, 9, 'beam'),
    ],
    ghosts: [
      ghost(2, 0.6, 5),
      ghost(5, 0.6, 5),
      ghost(2, 1.8, 5),
      ghost(5, 1.8, 5),
      ghost(3.5, 2.725, 5, 'beam'),
      ghost(2, 3.65, 5),
      ghost(5, 3.65, 5),
    ],
    challenge: { kind: 'grabs', par: 10 },
    reward: 'Blueprint complete',
  }),
  bp(104, 'arch', 3600, {
    title: 'Stone arch',
    goal: 'Build the arch: two barrel-and-block columns, a beam and a keystone on top.',
    machines: ['excavator'],
    toys: [
      toy(-6, 3, 'barrel', COLORS[2]),
      toy(-3.3, 3, 'barrel', COLORS[2]),
      toy(-0.6, 3),
      toy(-6, 6),
      toy(-3.3, 6),
      toy(-0.6, 6),
      toy(-5, 9, 'beam'),
    ],
    ghosts: [
      ghost(2, 0.75, 5, 'barrel'),
      ghost(5, 0.75, 5, 'barrel'),
      ghost(2, 2.1, 5),
      ghost(5, 2.1, 5),
      ghost(3.5, 3.025, 5, 'beam'),
      ghost(3.5, 3.95, 5),
    ],
    flag: { x: 7, z: 5, height: 5.6 },
    challenge: { kind: 'height', metres: 5.6 },
    reward: 'Blueprint complete',
  }),
];
/** The twenty jobs and the four blueprints, by id. */
export const ALL_JOBS = [...ROUNDS, ...BLUEPRINTS];
/** The number of jobs on the board (the blueprints are extra and never count). */
export const JOB_COUNT = ROUNDS.length;
/** The jobs of each site, in board order. */
export const SITE_JOBS = ['yard', 'harbor', 'hillside'].map((site) => ({
  site,
  name: SITES[site].name,
  code: SITES[site].code,
  jobs: ROUNDS.filter((r) => r.site === site),
}));
export const findJob = (id) => ALL_JOBS.find((r) => r.id === id) || null;
/** True for the Lab blueprint jobs (ids 101 to 104). */
export const isBlueprint = (r) => !!r?.blueprint;

/** The free-play yard. The app replaces machines with the ones this builder has earned. */
export const SANDBOX = {
  ...base,
  id: 0,
  title: 'Open site',
  goal: 'Build, reshape the terrain, and test your own structures.',
  machines: ['skid'],
  // The machines (however many are earned) stand apart in a row facing the striped spawn bay (x -12..-4, z 8..12);
  // the starter toys sit between the row and the bay.
  spawns: [
    [-10, 2],
    [-3, 2],
    [4, 2],
  ],
  toys: [toy(-7, 6.5), toy(-2, 6.5, 'beam'), toy(3.5, 6.5, 'barrel', COLORS[2])],
};
/** Where the Lab machines start in the sandbox (the three originals keep SANDBOX.spawns): in a row behind the others,
 *  facing the striped bay. The truck is long, so it starts further back. */
export const LAB_SPAWNS = { dump: [-9, -8], fork: [-2, -8] };
/** The wheel loader (0.6) is earned, not bought, but the three original spots are taken: it starts in the back row too,
 *  east of the Lab machines. */
LAB_SPAWNS.loader = [5.5, -8];
/** The sandbox start positions for `machines` (kinds in card order): the originals by position in the list as always,
 *  each Lab machine at its own place. */
export const sandboxSpawns = (machines) => {
  let base = 0;
  return machines.map((k) => LAB_SPAWNS[k] || SANDBOX.spawns[base++]);
};

/** One-line hints, introduced one control at a time (the HUD shows them; the voice reads each the first time a builder
 *  sees it). Every hint the game shows is named here so the voice can have a clip ready for its exact text; release,
 *  look, hop and reset are the later hints of the introduction order and are not shown yet, so they are not prepared. */
export const HINT = {
  drive: 'Try W or the left stick to drive.',
  lift: 'Try I and K, or the right stick, to lift your tool.',
  grab: 'Bring the tool close to a block, then press Grab.',
  carry: 'Carry it to the outline, then release.',
  raise: 'Raise the load clear of the ground, then move to the outline.',
  tilt: 'Tilt the bucket forward to pour your block out.',
  release: 'Release over the blue square. Let the block settle.',
  look: 'Drag the yard to look around.',
  hop: 'Press E to hop into another machine.',
  reset: 'You can reset the blocks whenever you like.',
  resume: 'All set. Resume!',
  // Coaching for the two Lab machines (app/rounds.js coach()): each is shown at most once a job or sandbox visit.
  forkLower: 'Lower the forks to the floor before you drive in.',
  forkAlign: 'Line the forks up with the openings in the pallet.',
  forkIn: 'The forks are in. Lift gently, and tilt back to hold the load.',
  bedLoaded: 'Raise the lift to tip the bed, and roll forward as the load pours out.',
  // The harbor and the hillside (0.6), each shown at most once a visit.
  steep: 'Too steep for this machine. Find a gentler way up.',
  mud: 'Mud slows the wheels. Tracks keep moving.',
  grass: 'Keep the blocks off the grass. Carry them over it.',
  optional: 'Your Lab machine is here too, if you want a faster way.',
};
export const HINTS =[HINT.drive, HINT.lift, HINT.grab, HINT.release, HINT.look, HINT.hop, HINT.reset];
/** The sandbox's four terrain stamps and the hint shown after one is chosen (tray.js builds the same sentence). */
export const STAMPS = ['hill', 'pit', 'ramp', 'water'];
export const STAMP_HINT = (kind) => `Tap a clear patch of ground for your ${kind}.`;
/** The tip under the materials tray (also printed in index.html), read the first time a builder opens the tray. */
export const TRAY_TIP = 'New materials arrive at the striped bay. Terrain: pick a stamp, then tap the ground.';
/** The wording of the hints on a touch screen (a phone has no keys): drag a stick or tap a button. hud.js shows these
 *  through `touchHint`, and the voice prepares the same words, so the hint a phone shows is the line it hears. */
export const TOUCH_TEXT = {
  [MACHINES.skid.hint]: 'Drag the left stick to drive. This skid steer turns on the spot.',
  [MACHINES.excavator.hint]: 'Drag the right stick up to lift. Left and right reach out and in.',
  [MACHINES.crane.hint]: 'Drag the right stick up and down to lift the magnet. Left and right swings the boom.',
  [MACHINES.dump.hint]: 'Drag the right stick up to tip the bed. Load it first, then roll forward as the blocks pour out.',
  [MACHINES.fork.hint]: 'Lower the forks, line up with a pallet opening and drive in slowly. Then drag the right stick up.',
  [MACHINES.loader.hint]: 'The wheel loader bends in the middle to steer. Drag the right stick up to lift, sideways to tilt.',
  [HINT.bedLoaded]: 'Drag the right stick up to tip the bed, and roll forward as the load pours out.',
  [HINT.drive]: 'Try dragging the left stick to drive.',
  [HINT.lift]: 'Try dragging the right stick to lift your tool.',
  [HINT.hop]: 'Tap Hop to jump into another machine.',
};
/** A hint as a touch screen shows it: the touch wording, and "press Grab" becomes "tap Grab". */
export const touchHint = (text) => (text && (TOUCH_TEXT[text] || text.replace(/\bpress Grab\b/, 'tap Grab'))) || text;

/** Toasts the voice reads aloud (the others are only shown): short, calm confirmations and the two "why not" notes. */
export const SPOKEN_TOASTS = [
  'Back on steady ground.',
  'Site saved.',
  'Site cleared.',
  'A star for your crew!',
  'Racing stripes!',
  'Material limit reached. Save the site or clear room for more.',
  'Try a clear patch. There is room for twelve terrain pieces.',
  'Neat build!',
  // the harbor and the hillside (0.6): a load that falls in the water or rests on the grass goes back to its start,
  // and the new decals say what they are when they are put on
  'Splash. That load is back on the quay.',
  'That block touched the grass. It is back at the start.',
  'Chevron decal on.',
  'Anchor decal on.',
  'Mountain decal on.',
];

// ---- What the voice says -------------------------------------------------------------------------------------------
// Everything below is plain strings so the natural voice can make a clip of each one ahead of time (a clip exists only
// for an exact text) and so the Node tests can check the whole set. The screen copy is unchanged; these are the same
// words written the way a person would read them out: numbers as words, unit codes never read as codes.
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];
/** The reward as it is said ("Limestone paint" is the label on screen; the unit codes EX-02 and CR-03 are not read). */
export const REWARD_SAY = {
  cream: 'the Limestone paint',
  excavator: 'the excavator',
  leaf: 'the Forest paint',
  star: 'the Star decal',
  crane: 'the crane',
  sky: 'the Steel blue paint',
  bell: 'the Bell horn',
  stripe: 'the Stripe decal',
  sunset: 'the Sunset paint',
  wrecking: 'the yard badge and the wrecking ball',
  chevron: 'the Chevron decal',
  graphite: 'the Graphite paint',
  harbor: 'the Harbor blue paint',
  anchor: 'the Anchor decal',
  ferry: 'the Ferry horn',
  loader: 'the wheel loader',
  sage: 'the Sage paint',
  rust: 'the Rust paint',
  mountain: 'the Mountain decal',
  steam: 'the Steam horn',
};
/** The reward kinds of the harbor and hillside jobs (paints are in scene/machines.js PAINTS). */
export const DECALS = ['star', 'stripe', 'chevron', 'anchor', 'mountain'];
export const HORNS = ['bell', 'ferry', 'steam'];
/** Every reward id a save may hold, in job order. */
export const REWARDS = ROUNDS.map((r) => r.unlock);
/** Reads a text the way the voice should say it: "WASD" as four letters and any unit code such as SS-01 as its
 *  letters and digit words ("S S zero one"). Plain sentences pass through unchanged. */
export function speakable(text) {
  return String(text ?? '')
    .replace(/\bWASD\b/g, 'W A S D')
    .replace(/\b([A-Z])([A-Z])-(\d)(\d)\b/g, (_, a, b, c, d) => `${a} ${b} ${NUMBER_WORDS[+c]} ${NUMBER_WORDS[+d]}`)
    .replace(/\s+/g, ' ')
    .trim();
}
/** Said when a job (or the sandbox, id 0) starts: "Job three. Foundation grid. Place the three blocks on ..." */
export const jobIntro = (r) =>
  speakable(
    r.blueprint ? `Blueprint. ${r.title}. ${r.goal}` : r.id ? `Job ${NUMBER_WORDS[r.id]}. ${r.title}. ${r.goal}` : `${r.title}. ${r.goal}`,
  );
/** Said when the reward sheet opens. */
export const jobDoneLine = (r) =>
  r.blueprint ? 'Blueprint complete. Well built!' : `Job complete. You unlocked ${REWARD_SAY[r.unlock]}.`;
/** Said instead when a blueprint's build challenge was met. */
export const NEAT_LINE = 'Blueprint complete. Neat build!';
/** Said by the "read the job aloud" button. */
export const jobGoalLine = (r) => speakable(r.goal);

/** The first hint of each machine, as said. */
const machineHints = Object.values(MACHINES).map((m) => speakable(m.hint));
/** Every line the voice may say, in the order a new builder needs them: the first job, the fixed lines, then the rest.
 *  voice.js prepares these at builder select. A runtime-built line must be assembled from these or prepared first. */
export const SPOKEN = {
  /** Lines for job `r`: the intro, the plain goal (repeat button) and the reward line. */
  job: (r) => [jobIntro(r), jobGoalLine(r), ...(r.unlock || r.blueprint ? [jobDoneLine(r)] : [])],
  fixed: [
    ...machineHints,
    ...[HINT.drive, HINT.lift, HINT.grab, HINT.carry, HINT.raise, HINT.tilt, HINT.resume].map(speakable),
    // the same hints worded for a touch screen (see touchHint): a phone shows these, so a phone hears these
    ...Object.values(TOUCH_TEXT).map(speakable),
    speakable(touchHint(HINT.grab)),
    ...STAMPS.map((k) => STAMP_HINT(k)),
    TRAY_TIP,
    ...SPOKEN_TOASTS,
    jobIntro(SANDBOX),
    jobGoalLine(SANDBOX),
    // the Lab machines and blueprints
    ...[HINT.forkLower, HINT.forkAlign, HINT.forkIn, HINT.bedLoaded].map(speakable),
    NEAT_LINE,
    // the harbor and the hillside
    ...[HINT.steep, HINT.mud, HINT.grass, HINT.optional].map(speakable),
  ],
};
/** Every spoken line (no duplicates). */
export const VOICE_LINES = [...new Set([...ALL_JOBS.flatMap(SPOKEN.job), ...SPOKEN.fixed])];
