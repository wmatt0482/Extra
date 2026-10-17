// Trail Blazer trails (SPEC §3). Procedural, seeded per trail so a trail can be learned.
// Shape: { id, name, blurb, length (m), grip, theme { sky[2], far, mid, ground, groundDark, accent, trail, night?, planet? },
//          style, terrain { amplitude, wavelength, roughness, hills, steep: [start, end] }, props: [...kinds],
//          water, bridges, kickers, gates, patches: [...surface kinds], seed }
// The course generator (src/game/course.js) fills the trail with hills: each hill's height grows from
// 0.3 x amplitude to amplitude (m) and its uphill pitch from steep[0] to steep[1] (rise / run) with distance, so
// the climbs get harder the further you go. roughness = small bumps on the hills. hills / wavelength describe the
// result (number of hills, average pitch in m) for the UI (trail cards); the generator does not read them.
// Additions to the SPEC shape: theme.trail (the dirt band colour), terrain.steep, patches (mud / sand / ice
// stretches), seed (the default ride seed). gates defaults to Math.round(length / 140) (game.start({ gates })
// overrides it, 0 = no gates); the course places up to that many on flat ground (getState().gatesTotal = actual).
//
// Reach probe (hold GAS only, no boost, gates 0, all upgrades at the same level; tools: matrix probe in the
// engine report): stock stalls on Pine Ridge at ~380 m; finishes Pine at lvl 2, Granite 3, Lake 4, Snow 4,
// Desert 6, Night 6.

export const TRAILS = [
  {
    id: 'pine-ridge',
    name: 'Pine Ridge',
    blurb: 'Rolling forest hills, a creek bridge and a couple of jumps.',
    length: 600,
    grip: 1.0,
    style: 'forest',
    theme: { sky: ['#6cc4ff', '#dff4ff'], far: '#6b9c7a', mid: '#3c7a4c', ground: '#5cae48', groundDark: '#7a5233', accent: '#ff8a1f', trail: '#b98a57' },
    terrain: { amplitude: 28, wavelength: 144, roughness: 0.35, hills: 4, steep: [0.34, 0.6] },
    props: ['log', 'rock', 'cone', 'sign', 'stump', 'puddle'],
    patches: ['mud'],
    water: 0, bridges: 1, kickers: 2,
    seed: 1101,
  },
  {
    id: 'granite-gap',
    name: 'Granite Gap',
    blurb: 'Granite domes, big boulders and two gaps to bridge.',
    length: 900,
    grip: 1.0,
    style: 'granite',
    theme: { sky: ['#86c2ff', '#f3eadb'], far: '#a9abb8', mid: '#868a97', ground: '#9cb35e', groundDark: '#6e6a70', accent: '#ff8a1f', trail: '#c4a882' },
    terrain: { amplitude: 26, wavelength: 146, roughness: 0.5, hills: 6, steep: [0.32, 0.7] },
    props: ['rock', 'boulder', 'log', 'cone', 'sign'],
    patches: ['mud'],
    water: 0, bridges: 2, kickers: 3,
    seed: 2202,
  },
  {
    id: 'lake-loop',
    name: 'Lake Loop',
    blurb: 'Splash through creek crossings around the big lake.',
    length: 1200,
    grip: 1.0,
    style: 'lake',
    theme: { sky: ['#62bcff', '#e6f7ff'], far: '#7397bb', mid: '#467f55', ground: '#63b04e', groundDark: '#6d4d33', accent: '#ff8a1f', trail: '#c09060' },
    terrain: { amplitude: 26, wavelength: 147, roughness: 0.35, hills: 8, steep: [0.32, 0.74] },
    props: ['log', 'puddle', 'cone', 'sign', 'rock'],
    patches: ['mud', 'sand'],
    water: 4, bridges: 2, kickers: 2,
    seed: 3303,
  },
  {
    id: 'snow-pass',
    name: 'Snow Pass',
    blurb: 'Icy climbs over the pass: smooth on the gas!',
    length: 1500,
    grip: 0.6,
    style: 'snow',
    theme: { sky: ['#93ccff', '#f4fbff'], far: '#b6c7df', mid: '#8aa3c2', ground: '#f4f8ff', groundDark: '#8496b0', accent: '#ff8a1f', trail: '#dde7f4' },
    terrain: { amplitude: 30, wavelength: 134, roughness: 0.3, hills: 11, steep: [0.3, 0.72] },
    props: ['snowman', 'sign', 'rock', 'cone', 'log'],
    patches: ['ice'],
    water: 0, bridges: 2, kickers: 3,
    seed: 4404,
  },
  {
    id: 'desert-wash',
    name: 'Desert Wash',
    blurb: 'Sand, cactus and dunes under a hot sun.',
    length: 1800,
    grip: 0.8,
    style: 'desert',
    theme: { sky: ['#ffb36b', '#ffeccb'], far: '#dc9660', mid: '#c27242', ground: '#e8c27d', groundDark: '#b9824a', accent: '#ff8a1f', trail: '#d9a965' },
    terrain: { amplitude: 36, wavelength: 136, roughness: 0.4, hills: 13, steep: [0.36, 0.98] },
    props: ['cactus', 'tumbleweed', 'rock', 'cone', 'sign'],
    patches: ['sand'],
    water: 1, bridges: 1, kickers: 4,
    seed: 5505,
  },
  {
    id: 'night-ride',
    name: 'Night Ride',
    blurb: 'Headlights on! Fireflies, moonlight and the longest trail.',
    length: 2200,
    grip: 0.95,
    style: 'night',
    theme: { sky: ['#0a1133', '#2b3168'], far: '#1e2b4c', mid: '#15263b', ground: '#2f5c3c', groundDark: '#2a2030', accent: '#ffb347', trail: '#6e5c49', night: true, planet: 'moon' },
    terrain: { amplitude: 46, wavelength: 167, roughness: 0.4, hills: 13, steep: [0.4, 0.95] },
    props: ['log', 'pumpkin', 'sign', 'rock', 'cone'],
    patches: ['mud'],
    water: 2, bridges: 2, kickers: 3,
    seed: 6606,
  },
];
for (const t of TRAILS) if (t.gates == null) t.gates = Math.round(t.length / 140);

export const TRAIL_BY_ID = Object.fromEntries(TRAILS.map((t) => [t.id, t]));

// Number of gates for a ride: an explicit count (0 = none) or the trail's default.
export function trailGates(trail, override) {
  const n = Number(override);
  if (override != null && override !== '' && Number.isFinite(n)) return Math.max(0, Math.min(20, Math.round(n)));
  return trail.gates != null ? trail.gates : Math.round(trail.length / 140);
}

// Smashable props: w/h (m), mass (slows the vehicle a little), cash ($ before coinMult), colour.
// flat: no body (driven through: a splash), drawn on the ground.
export const OBSTACLE_KINDS = {
  log:        { w: 1.7, h: 0.55, mass: 0.25, cash: 40,  color: '#8b5a2b', label: 'Log' },
  rock:       { w: 0.9, h: 0.6,  mass: 0.3,  cash: 30,  color: '#9a9aa4', label: 'Rock' },
  boulder:    { w: 1.5, h: 1.2,  mass: 0.45, cash: 80,  color: '#8d8d96', label: 'Boulder' },
  cone:       { w: 0.55, h: 0.8, mass: 0.05, cash: 20,  color: '#ff7a1a', label: 'Cone' },
  sign:       { w: 0.9, h: 1.5,  mass: 0.12, cash: 50,  color: '#c98d4f', label: 'Trail sign' },
  stump:      { w: 0.8, h: 0.6,  mass: 0.2,  cash: 35,  color: '#9b6a3c', label: 'Stump' },
  snowman:    { w: 1.0, h: 1.7,  mass: 0.1,  cash: 60,  color: '#ffffff', label: 'Snowman' },
  cactus:     { w: 0.7, h: 1.8,  mass: 0.12, cash: 45,  color: '#4f9d4a', label: 'Cactus' },
  tumbleweed: { w: 0.9, h: 0.9,  mass: 0.03, cash: 25,  color: '#b8925a', label: 'Tumbleweed' },
  pumpkin:    { w: 0.8, h: 0.65, mass: 0.1,  cash: 40,  color: '#ff8a1f', label: 'Pumpkin' },
  puddle:     { w: 2.6, h: 0.12, mass: 0.0,  cash: 20,  color: '#6fb6e8', label: 'Puddle', flat: true },
  crate:      { w: 0.9, h: 0.9,  mass: 0.15, cash: 30,  color: '#d1a054', label: 'Crate' },
};

// Ground surface patches: grip multiplier, extra rolling drag (m/s^2), colours.
export const SURFACES = {
  dirt:  { grip: 1.0,  drag: 0,   label: 'Dirt' },
  mud:   { grip: 0.5,  drag: 1.4, color: '#5a3b22', label: 'Mud' },
  sand:  { grip: 0.75, drag: 1.0, color: '#e9cf8f', label: 'Sand' },
  ice:   { grip: 0.55, drag: 0,   color: '#bfe6ff', label: 'Ice' },
  water: { grip: 0.8,  drag: 2.6, color: '#3d8fd6', label: 'Water' },
};
