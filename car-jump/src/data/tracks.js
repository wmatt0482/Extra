// Track / stage definitions. Distances in meters measured from the ramp lip (x = 0 at the lip).
// `finish` is where the finish line stands; crossing it unlocks the next track.
// `gravity` is a multiplier on Earth gravity. `theme` colors are used by the renderer.
// Obstacle fields tune how many destructibles spawn after the landing zone.

export const TRACKS = [
  {
    id: 'canyon',
    name: 'Climb Canyon',
    blurb: 'Red rock, long shadows, a ramp the size of a dam.',
    finish: 400,
    gravity: 1.0,
    ramp: { height: 60, length: 110 },      // ramp drop (m) and horizontal run (m); lip ends at x=0
    terrain: { amplitude: 2.5, wavelength: 60, roughness: 0.3 },
    obstacles: { density: 0.9, start: 20, kinds: ['crate', 'barrel', 'wall', 'cactus'] },
    theme: { sky: ['#9fd8ff', '#f6e3b4'], far: '#c97a4a', mid: '#a85a35', ground: '#c98c4e', groundDark: '#8f5a2c', accent: '#ff7a3d' },
    unlockedBy: null,
  },
  {
    id: 'city',
    name: 'Downtown Drop',
    blurb: 'Launch off the parking garage. Mind the billboards.',
    finish: 650,
    gravity: 1.0,
    ramp: { height: 75, length: 130 },
    terrain: { amplitude: 1.5, wavelength: 80, roughness: 0.15 },
    obstacles: { density: 1.2, start: 15, kinds: ['crate', 'glass', 'car', 'wall', 'billboard'] },
    theme: { sky: ['#6fb3f2', '#d6ecff'], far: '#5c6f8a', mid: '#8495ad', ground: '#8a8f99', groundDark: '#5b5f66', accent: '#ffd23f' },
    unlockedBy: 'canyon',
  },
  {
    id: 'desert',
    name: 'Dune Rocket',
    blurb: 'Soft sand, hard bounces, no shade.',
    finish: 900,
    gravity: 1.0,
    ramp: { height: 90, length: 150 },
    terrain: { amplitude: 5, wavelength: 45, roughness: 0.5 },
    obstacles: { density: 1.0, start: 25, kinds: ['barrel', 'crate', 'cactus', 'wall', 'car'] },
    theme: { sky: ['#ffb36b', '#ffe8c2'], far: '#e39a5c', mid: '#f2b56f', ground: '#f0c276', groundDark: '#c48e45', accent: '#ff5e3a' },
    unlockedBy: 'city',
  },
  {
    id: 'arctic',
    name: 'Glacier Gap',
    blurb: 'Ice has no grip. Plan your landing early.',
    finish: 1200,
    gravity: 1.0,
    ramp: { height: 110, length: 170 },
    terrain: { amplitude: 3, wavelength: 70, roughness: 0.25 },
    obstacles: { density: 1.3, start: 20, kinds: ['crate', 'glass', 'wall', 'snowman', 'barrel'] },
    theme: { sky: ['#5f86c7', '#dff1ff'], far: '#aac5e3', mid: '#cfe3f5', ground: '#eef7ff', groundDark: '#a9c3dc', accent: '#52d6ff' },
    grip: 0.55, // ground friction multiplier
    unlockedBy: 'desert',
  },
  {
    id: 'moon',
    name: 'Mare Mayhem',
    blurb: 'One-sixth gravity. Flips are cheap. Landings are not.',
    finish: 2000,
    gravity: 0.3,
    ramp: { height: 120, length: 180 },
    terrain: { amplitude: 6, wavelength: 90, roughness: 0.4 },
    obstacles: { density: 1.1, start: 30, kinds: ['crate', 'barrel', 'dome', 'wall', 'rover'] },
    theme: { sky: ['#07070f', '#1d1b3a'], far: '#2d2b4a', mid: '#55536e', ground: '#b9b7c4', groundDark: '#6e6c7a', accent: '#c8ff5e' },
    unlockedBy: 'arctic',
  },
];

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

// Destructible object catalogue: size (m), mass, cash reward, and how much it slows the car.
export const OBSTACLE_KINDS = {
  crate:     { w: 1.2, h: 1.2, mass: 0.15, cash: 25,  color: '#d1a054', label: 'Crate' },
  barrel:    { w: 0.9, h: 1.3, mass: 0.2,  cash: 40,  color: '#d64545', label: 'Barrel' },
  glass:     { w: 0.2, h: 3.0, mass: 0.05, cash: 60,  color: '#9fe3ff', label: 'Glass pane' },
  wall:      { w: 0.6, h: 2.4, mass: 0.6,  cash: 120, color: '#b9b2a8', label: 'Wall', segments: 4 },
  cactus:    { w: 0.5, h: 2.0, mass: 0.1,  cash: 35,  color: '#4f9d4a', label: 'Cactus' },
  car:       { w: 3.6, h: 1.3, mass: 1.0,  cash: 250, color: '#5f7fd1', label: 'Parked car' },
  billboard: { w: 0.4, h: 4.0, mass: 0.4,  cash: 200, color: '#ffd23f', label: 'Billboard', segments: 3 },
  snowman:   { w: 1.2, h: 2.0, mass: 0.1,  cash: 50,  color: '#ffffff', label: 'Snowman' },
  dome:      { w: 2.5, h: 1.8, mass: 0.3,  cash: 180, color: '#a9d7ff', label: 'Habitat dome' },
  rover:     { w: 2.6, h: 1.2, mass: 0.7,  cash: 300, color: '#d9d9d9', label: 'Rover' },
};
