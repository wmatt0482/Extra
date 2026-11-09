// Sky Era tracks (v4.0 Phase 1: five of ten). Same shape as src/data/tracks.js plus `era: 'sky'` and a `sky` block; they have their
// own unlock chain (sky-1 is open once the Sky Era is). Distances are metres from the ramp lip, tuned with tools/economy-sim.mjs --sky.
//
// A sky course is a launch ramp on a floating start island, then a chain of floating islands over a cloud sea:
//   sky.sea      cloud-sea surface height (m); a car that drops below it is lifted by a soft "cloud splash" (never a crash)
//   sky.floor    island top height (m above the sea) where the landing slope ends
//   sky.plateau  height of the start island under the ramp (m)
//   sky.isle     [min, max] island length (m), sky.gap [min, max] gap between islands (m), sky.gapGrow = extra gap per 1000 m
//   sky.rings    boost rings over the gaps: one every N gaps; sky.wells gravity wells: one every N gaps (+ a few on the first arcs)
//   theme.skyDusk / theme.sky   the sky at the lip -> the sky at the finish (3 stops: top, middle, horizon), `stars` > 0 fades stars in
// Gravity 0.6-1.0. The scripted player in the economy sim reaches (maxed Rhino) sky-1 and sky-2; 3-5 want the Sky rides.

export const SKY_TRACKS = [
  {
    id: 'sky-1',
    era: 'sky',
    name: 'Sunrise Shelf',
    blurb: 'Launch at dusk, land in daylight. The first islands are close together.',
    finish: 1500,
    gravity: 0.95,
    ramp: { height: 70, length: 120 },
    terrain: { amplitude: 1.6, wavelength: 55, roughness: 0.2 },
    obstacles: { density: 0.55, start: 50, kinds: ['puff', 'crystal', 'puff'] },
    theme: {
      skyDusk: ['#4b2f8f', '#e0568f', '#ffc07a'], sky: ['#4aa6ff', '#9bd8ff', '#fff0cf'], stars: 0,
      far: '#c9b6f2', mid: '#a9d3ff', ground: '#6fd36a', groundDark: '#7a5fb0', accent: '#ffcf1a', glow: '#7fe8ff',
    },
    style: 'sky',
    sky: { sea: 0, floor: 10, plateau: 30, isle: [56, 96], gap: [12, 22], gapGrow: 5, rings: 2, wells: 5 },
    unlockedBy: null,
  },
  {
    id: 'sky-2',
    era: 'sky',
    name: 'Marshmallow Mile',
    blurb: 'Soft pink islands and long soft gaps. Fly the rings to keep your speed.',
    finish: 2600,
    gravity: 0.85,
    ramp: { height: 85, length: 135 },
    terrain: { amplitude: 2.2, wavelength: 60, roughness: 0.25 },
    obstacles: { density: 0.6, start: 60, kinds: ['puff', 'mushroom', 'crystal'] },
    theme: {
      skyDusk: ['#7a5ad8', '#ff9fc4', '#ffe0b0'], sky: ['#5fb8ff', '#c9e9ff', '#fff6e0'], stars: 0,
      far: '#f3c6e8', mid: '#ffd9ee', ground: '#9be86f', groundDark: '#c067b8', accent: '#ff5fa8', glow: '#ffb3e0',
    },
    style: 'sky',
    sky: { sea: 0, floor: 10, plateau: 32, isle: [60, 104], gap: [14, 28], gapGrow: 6, rings: 2, wells: 4 },
    unlockedBy: 'sky-1',
  },
  {
    id: 'sky-3',
    era: 'sky',
    name: 'Rainbow Reef',
    blurb: 'Coral islands under a bright rainbow. Gaps this wide want a glide.',
    finish: 3800,
    gravity: 0.8,
    ramp: { height: 100, length: 150 },
    terrain: { amplitude: 2.8, wavelength: 55, roughness: 0.3 },
    obstacles: { density: 0.65, start: 60, kinds: ['puff', 'crystal', 'mushroom', 'gumdrop'] },
    theme: {
      skyDusk: ['#2f5fd8', '#8fb8ff', '#ffe3a8'], sky: ['#3d9bff', '#8fe3ff', '#fff3c4'], stars: 0, rainbow: true,
      far: '#9fe0e8', mid: '#c4f2f0', ground: '#58dba0', groundDark: '#e0707a', accent: '#ffd23f', glow: '#a5ffef',
    },
    style: 'sky',
    sky: { sea: 0, floor: 11, plateau: 36, isle: [60, 110], gap: [16, 32], gapGrow: 7, rings: 2, wells: 4 },
    unlockedBy: 'sky-2',
  },
  {
    id: 'sky-4',
    era: 'sky',
    name: 'Thunder Isles',
    blurb: 'Storm clouds underneath, lightning in the distance. Wells everywhere.',
    finish: 5200,
    gravity: 0.7,
    ramp: { height: 115, length: 165 },
    terrain: { amplitude: 3.2, wavelength: 65, roughness: 0.35 },
    obstacles: { density: 0.7, start: 70, kinds: ['crystal', 'puff', 'boulder'] },
    theme: {
      skyDusk: ['#1b1a5c', '#7a3fb0', '#f08a7a'], sky: ['#3a3fa8', '#7a7fe0', '#d6c4ff'], stars: 0.25, storm: true,
      far: '#7a6cc8', mid: '#9a8ee0', ground: '#5ed8b6', groundDark: '#51468e', accent: '#ffe14a', glow: '#b9a5ff',
    },
    style: 'sky',
    sky: { sea: 0, floor: 11, plateau: 40, isle: [64, 116], gap: [18, 36], gapGrow: 8, rings: 2, wells: 3 },
    unlockedBy: 'sky-3',
  },
  {
    id: 'sky-5',
    era: 'sky',
    name: 'Starlight Summit',
    blurb: 'The top of the sky. Day fades to night and the stars come out.',
    finish: 7000,
    gravity: 0.6,
    ramp: { height: 130, length: 180 },
    terrain: { amplitude: 3.6, wavelength: 70, roughness: 0.35 },
    obstacles: { density: 0.75, start: 70, kinds: ['crystal', 'puff', 'satellite'] },
    theme: {
      skyDusk: ['#3d8fe8', '#9fd0ff', '#fff0d0'], sky: ['#06061c', '#2a1c6e', '#c25a9f'], stars: 1,
      far: '#4a3a9c', mid: '#6a56c4', ground: '#8ff0d0', groundDark: '#3a2f78', accent: '#ff7ad9', glow: '#d9c8ff',
    },
    style: 'sky',
    sky: { sea: 0, floor: 12, plateau: 44, isle: [66, 124], gap: [20, 40], gapGrow: 9, rings: 2, wells: 3 },
    unlockedBy: 'sky-4',
  },
];

export const SKY_TRACK_BY_ID = Object.fromEntries(SKY_TRACKS.map((t) => [t.id, t]));
