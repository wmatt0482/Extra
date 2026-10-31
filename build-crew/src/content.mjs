// Build Crew's first-flight data: toys, machines, the ten yard jobs, the sandbox, hints and every phrase the voice
// may speak. It is plain data with no imports, so physics, missions, the scene, the app and the Node tests all read the
// same numbers. The later sites and machines described in SPEC.md are deliberately absent until they are built.
/** The game version reported by pings and the Parent Zone (the service worker has its own cache version). */
export const VERSION = '0.3.0';
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
};
// Small builders for the job table: a toy resting just above the ground, a ghost outline to fill, and a supply of
// toys laid out in rows of three in the loading area, clear of the pad.
const toy = (x, z, type = 'cube', color = COLORS[0]) => ({ type, color, x, y: TOYS[type].size[1] / 2 + 0.08, z });
const ghost = (x, y, z, type = 'cube') => ({ x, y, z, type });
const supply = (n, type = 'cube') =>
  Array.from({ length: n }, (_, i) => toy(-6 + (i % 3) * 2.7, 3 + Math.floor(i / 3) * 3, type));
// Every first-flight job is in the yard and shares the blue delivery pad (centre x/z, width w, depth d).
const base = { site: 'yard', pad: { x: 5, z: 5, w: 8, d: 8 }, props: [] };
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
];
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
};
export const HINTS = [HINT.drive, HINT.lift, HINT.grab, HINT.release, HINT.look, HINT.hop, HINT.reset];
/** The sandbox's four terrain stamps and the hint shown after one is chosen (tray.js builds the same sentence). */
export const STAMPS = ['hill', 'pit', 'ramp', 'water'];
export const STAMP_HINT = (kind) => `Tap a clear patch of ground for your ${kind}.`;
/** The tip under the materials tray (also printed in index.html), read the first time a builder opens the tray. */
export const TRAY_TIP = 'New materials arrive at the striped bay. Terrain: pick a stamp, then tap the ground.';
/** Toasts the voice reads aloud (the others are only shown): short, calm confirmations and the two "why not" notes. */
export const SPOKEN_TOASTS = [
  'Back on steady ground.',
  'Site saved.',
  'Site cleared.',
  'A star for your crew!',
  'Racing stripes!',
  'Material limit reached. Save the site or clear room for more.',
  'Try a clear patch. There is room for twelve terrain pieces.',
];

// ---- What the voice says -------------------------------------------------------------------------------------------
// Everything below is plain strings so the natural voice can make a clip of each one ahead of time (a clip exists only
// for an exact text) and so the Node tests can check the whole set. The screen copy is unchanged; these are the same
// words written the way a person would read them out: numbers as words, unit codes never read as codes.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
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
};
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
export const jobIntro = (r) => speakable(r.id ? `Job ${NUMBER_WORDS[r.id]}. ${r.title}. ${r.goal}` : `${r.title}. ${r.goal}`);
/** Said when the reward sheet opens. */
export const jobDoneLine = (r) => `Job complete. You unlocked ${REWARD_SAY[r.unlock]}.`;
/** Said by the "read the job aloud" button. */
export const jobGoalLine = (r) => speakable(r.goal);

/** The first hint of each machine, as said. */
const machineHints = Object.values(MACHINES).map((m) => speakable(m.hint));
/** Every line the voice may say, in the order a new builder needs them: the first job, the fixed lines, then the rest.
 *  voice.js prepares these at builder select. A runtime-built line must be assembled from these or prepared first. */
export const SPOKEN = {
  /** Lines for job `r`: the intro, the plain goal (repeat button) and the reward line. */
  job: (r) => [jobIntro(r), jobGoalLine(r), ...(r.unlock ? [jobDoneLine(r)] : [])],
  fixed: [
    ...machineHints,
    ...[HINT.drive, HINT.lift, HINT.grab, HINT.carry, HINT.raise, HINT.tilt, HINT.resume].map(speakable),
    ...STAMPS.map((k) => STAMP_HINT(k)),
    TRAY_TIP,
    ...SPOKEN_TOASTS,
    jobIntro(SANDBOX),
    jobGoalLine(SANDBOX),
  ],
};
/** Every spoken line (no duplicates). */
export const VOICE_LINES = [...new Set([...ROUNDS.flatMap(SPOKEN.job), ...SPOKEN.fixed])];
