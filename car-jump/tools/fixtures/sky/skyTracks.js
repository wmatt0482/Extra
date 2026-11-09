// STAND-IN sky tracks for the app's tests (?mock=1&skyfixture=1). The real ones are src/data/skyTracks.js (the engine side). Same shape as
// src/data/tracks.js plus era: 'sky'; the first has no unlockedBy, the next is unlocked by finishing it.
export const SKY_TRACKS = [
  {
    id: 'sky-1', era: 'sky', name: 'Cloud Hop', blurb: 'Floating islands over a sea of cloud.', finish: 600, gravity: 0.6,
    ramp: { height: 70, length: 120 }, terrain: { amplitude: 1.5, wavelength: 70, roughness: 0.2 },
    obstacles: { density: 0.6, start: 25, kinds: ['crate', 'barrel'] },
    theme: { sky: ['#2a64d8', '#fff1d2'], far: '#9fc4f2', mid: '#cfe2f7', ground: '#f4f8ff', groundDark: '#9fb8e8', accent: '#ffcf1a' },
    style: 'clouds', unlockedBy: null,
  },
  {
    id: 'sky-2', era: 'sky', name: 'Sun Ring Run', blurb: 'Boost rings and a gravity well to slingshot.', finish: 900, gravity: 0.55,
    ramp: { height: 80, length: 130 }, terrain: { amplitude: 1.5, wavelength: 70, roughness: 0.2 },
    obstacles: { density: 0.6, start: 25, kinds: ['crate', 'barrel'] },
    theme: { sky: ['#3d2a94', '#ffc2b0'], far: '#b78bd8', mid: '#e5a8c8', ground: '#fff3e6', groundDark: '#d9a6c2', accent: '#7fe8ff' },
    style: 'clouds', unlockedBy: 'sky-1',
  },
];
