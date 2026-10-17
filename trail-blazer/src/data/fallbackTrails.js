// The six trails (SPEC §2.4) as a fallback list for the menus while src/data/trails.js (the engine agent's, the real
// source) is missing or fails to load: ids, names, lengths, styles and a theme for the trail cards. main.js prefers
// ./trails.js whenever it imports.
export const FALLBACK_TRAILS = [
  { id: 'pine-ridge', name: 'Pine Ridge', blurb: 'Forest trail with roots and logs.', length: 600, grip: 1, style: 'forest',
    theme: { sky: ['#7cc4e8', '#d8f0e0'], far: '#5f8f7a', mid: '#2f6b44', ground: '#6b4a2b', groundDark: '#3f2a17', accent: '#ff8a1f' } },
  { id: 'granite-gap', name: 'Granite Gap', blurb: 'Rocky climbs between boulders.', length: 900, grip: 1, style: 'granite',
    theme: { sky: ['#8fb8d8', '#e6eef2'], far: '#9aa3ab', mid: '#6d767e', ground: '#7a756c', groundDark: '#4a463f', accent: '#ffd23a' } },
  { id: 'lake-loop', name: 'Lake Loop', blurb: 'Water crossings and wooden bridges.', length: 1200, grip: 0.95, style: 'lake',
    theme: { sky: ['#5fb0e8', '#cfeaf6'], far: '#4f8fa8', mid: '#2e6f5a', ground: '#5d4a33', groundDark: '#33281b', accent: '#22d3ff' } },
  { id: 'snow-pass', name: 'Snow Pass', blurb: 'Icy switchbacks: easy on the gas.', length: 1500, grip: 0.6, style: 'snow',
    theme: { sky: ['#a9c8e6', '#f2f7fb'], far: '#c9d6e2', mid: '#8fa7bd', ground: '#e8f0f5', groundDark: '#9fb3c4', accent: '#ff3b5c' } },
  { id: 'desert-wash', name: 'Desert Wash', blurb: 'Sand, cactus and big dunes.', length: 1800, grip: 0.8, style: 'desert',
    theme: { sky: ['#f6b26b', '#fde3b8'], far: '#d98c5a', mid: '#b8683e', ground: '#e0b070', groundDark: '#a7743a', accent: '#2fd36b' } },
  { id: 'night-ride', name: 'Night Ride', blurb: 'Headlights on, fireflies out.', length: 2200, grip: 1, style: 'night',
    theme: { sky: ['#0b1030', '#24305e'], far: '#1c2650', mid: '#152a2a', ground: '#2a2a22', groundDark: '#121510', accent: '#ffd23a', night: true } },
];
