// The 6 zombie silhouettes and their matching hats (procedural; drawn by src/game/zombies.js). Halloween-cool for
// 9-10 year olds: lanky, hunched, torn jackets, mismatched boots, one glowing eye. Creepy-funny, never gore.
// A look: colours + the neighbour it turns back into (skin, jacket) after a cure. `hat` always matches the look.

export const LOOKS = [
  { id: 'punk', name: 'Spike', skin: '#8aa36b', skinDark: '#5f7a45', jacket: '#262630', shirt: '#c2185b', pants: '#3b3b47', boots: ['#5a3a2a', '#1f1f28'],
    hair: '#ff3cac', hat: 'mohawk', glow: '#9dff2e', prop: 'studs', neighbour: { skin: '#f1c7a3', jacket: '#2b2b36', shirt: '#ff4d8d' } },
  { id: 'chef', name: 'Gus', skin: '#9db37a', skinDark: '#6c8a4f', jacket: '#d9d4c4', shirt: '#8b2f2f', pants: '#2f2f3a', boots: ['#222229', '#8b5a2b'],
    hair: '#4a3222', hat: 'toque', glow: '#ffd23f', prop: 'spoon', neighbour: { skin: '#c68642', jacket: '#f4f0e4', shirt: '#b03a3a' } },
  { id: 'football', name: 'Brock', skin: '#7fa67e', skinDark: '#557a56', jacket: '#1e5aa8', shirt: '#ffffff', pants: '#d9d4c7', boots: ['#222229', '#f1f1f1'],
    hair: '#2a1a0e', hat: 'helmet', glow: '#4dd2ff', prop: 'pads', neighbour: { skin: '#8d5524', jacket: '#1e5aa8', shirt: '#ffffff' } },
  { id: 'hiker', name: 'Mabel', skin: '#8fb07e', skinDark: '#5e7f50', jacket: '#b8562a', shirt: '#2f3a2f', pants: '#4a5a3a', boots: ['#6b4a2a', '#3a3a3a'],
    hair: '#e0a040', hat: 'beanie', glow: '#ff8a1f', prop: 'pack', neighbour: { skin: '#f7d7bd', jacket: '#d2652f', shirt: '#2f3a2f' } },
  { id: 'scientist', name: 'Dr. Otis', skin: '#a6b98a', skinDark: '#75905d', jacket: '#dfe6ea', shirt: '#5bc0eb', pants: '#3a3a4a', boots: ['#333340', '#7a5230'],
    hair: '#cfcfd6', hat: 'goggles', glow: '#9dff2e', prop: 'badge', neighbour: { skin: '#e0ac69', jacket: '#f3f6f8', shirt: '#2f9fd8' } },
  { id: 'mailman', name: 'Wanda', skin: '#93ad79', skinDark: '#647f4f', jacket: '#3f5f8f', shirt: '#dfe6ea', pants: '#4b5a6b', boots: ['#2a2a2a', '#7a4a2a'],
    hair: '#5a2d1a', hat: 'cap', glow: '#ffd23f', prop: 'bag', neighbour: { skin: '#f1c27d', jacket: '#4a6fa5', shirt: '#ffffff' } },
];
export const LOOK_BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l]));

export const HATS = ['mohawk', 'toque', 'helmet', 'beanie', 'goggles', 'cap'];
export const HAT_COLORS = { mohawk: '#ff3cac', toque: '#eeeae0', helmet: '#1e5aa8', beanie: '#4c7a3a', goggles: '#8a5a2a', cap: '#3f5f8f' };
