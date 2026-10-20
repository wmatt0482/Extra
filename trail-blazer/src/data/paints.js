// Paints and decals for every vehicle (SPEC §2.3, v1.1; v1.5 adds crate drops, the streak paint and the Garage Wall
// set bonuses, and any racing paint / decal can also drop from a crate). They come from racing, never from cash:
//   paints: Sage Green is stock; finishing a track unlocks its paint (keyed by the track's style, so it works with any
//           track ids), and medals unlock more (any bronze → Pine, any silver → Sky, any gold → Gold, 3 golds → Purple,
//           gold on every track → Rainbow). The math phase can add more later.
//   decals: Mud Splats for a 250 m race, Flames for 10 landed flips, Stars for 50, Checkers for a 1st place.
// The engine's src/game/vehicle.js draws them (same ids and body colors as its PAINTS / DECALS); these ids are what
// main.js passes to game.start() as `paint` / `decal`. COLOR_BY_PAINT also colors the AI riders' dots on the HUD.

export const PAINTS = [
  { id: 'sage', name: 'Sage Green', body: '#7c9a63', trim: '#4f6a40', unlock: null },
  { id: 'orange', name: 'Blaze Orange', body: '#ff8a1f', trim: '#b35400', unlock: { finish: 'forest' } },
  { id: 'granite', name: 'Granite Gray', body: '#8f949c', trim: '#5c6268', unlock: { finish: 'granite' } },
  { id: 'lakeblue', name: 'Lake Blue', body: '#2f8bd6', trim: '#1c4f86', unlock: { finish: 'lake' } },
  { id: 'snow', name: 'Snow White', body: '#f1f4f8', trim: '#b9c6cf', unlock: { finish: 'snow' } },
  { id: 'sunset', name: 'Sunset Red', body: '#e2453a', trim: '#9c2620', unlock: { finish: 'desert' } },
  { id: 'black', name: 'Black', body: '#2b2d33', trim: '#0d0f11', unlock: { finish: 'night' } },
  { id: 'pine', name: 'Pine', body: '#24583a', trim: '#123220', unlock: { medal: 'bronze', count: 1 } },
  { id: 'sky', name: 'Sky', body: '#66c9ff', trim: '#2f8bd6', unlock: { medal: 'silver', count: 1 } },
  { id: 'gold', name: 'Gold', body: '#f2c230', trim: '#a8820f', unlock: { medal: 'gold', count: 1 } },
  { id: 'purple', name: 'Purple', body: '#8a56d6', trim: '#55309a', unlock: { medal: 'gold', count: 3 } },
  { id: 'rainbow', name: 'Rainbow', body: '#ff5d5d', trim: '#8f6bff', unlock: { medal: 'gold', count: 'all' },
    swatch: 'linear-gradient(135deg, #ff5d5d, #ff9f1a, #ffe14a, #3ddc84, #22b8ff, #8f6bff)' },
  // v1.5: crate drops, the 14-day streak paint and the set bonuses (complete a set on the Garage Wall)
  { id: 'lime', name: 'Lime', body: '#9be03a', trim: '#5d8f1c', unlock: { crate: true } },
  { id: 'teal', name: 'Teal', body: '#1fb5a8', trim: '#0f6f67', unlock: { crate: true } },
  { id: 'magenta', name: 'Magenta', body: '#e0389b', trim: '#8f1d61', unlock: { crate: true } },
  { id: 'copper', name: 'Copper', body: '#c8763c', trim: '#7f4520', unlock: { crate: true } },
  { id: 'streak', name: 'Streak', body: '#ff4d2e', trim: '#ffe14a', unlock: { streak: 14 },
    swatch: 'linear-gradient(135deg, #ffd23a, #ff6a2a 55%, #c8261c)' },
  { id: 'chrome', name: 'Chrome', body: '#c9d3dc', trim: '#7d8b98', unlock: { set: 'helmet' }, swatch: 'linear-gradient(135deg, #f4f8fb, #9aa7b3 50%, #e6edf2)' },
  { id: 'neon', name: 'Neon', body: '#1a1a2e', trim: '#3cff9d', unlock: { set: 'suit' }, swatch: 'linear-gradient(135deg, #1a1a2e 0 62%, #3cff9d 62%)' },
  { id: 'candy', name: 'Candy', body: '#ff7ad1', trim: '#ffffff', unlock: { set: 'horn' }, swatch: 'repeating-linear-gradient(135deg, #ff7aa8 0 6px, #fff 6px 12px)' },
  { id: 'aurora', name: 'Aurora', body: '#3ddc84', trim: '#8f6bff', unlock: { set: 'trail' }, swatch: 'linear-gradient(135deg, #3ddc84, #22b8ff, #8f6bff)' },
  { id: 'moon', name: 'Moon Dust', body: '#c9ccd8', trim: '#4dd2ff', unlock: { set: 'flag' }, swatch: 'radial-gradient(circle at 70% 35%, #9da1b3 0 3px, transparent 4px), linear-gradient(135deg, #e3e5ee, #b6b9c8)' },
  { id: 'midnight', name: 'Midnight Stars', body: '#141a3a', trim: '#8f6bff', unlock: { set: 'decal' }, swatch: 'radial-gradient(circle at 30% 30%, #fff 0 1px, transparent 2px), #141a3a' },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map((p) => [p.id, p]));
export const COLOR_BY_PAINT = Object.fromEntries(PAINTS.map((p) => [p.id, p.body]));

export const DECALS = [
  { id: 'none', name: 'No decal', unlock: null },
  { id: 'mud', name: 'Mud Splats', unlock: { distance: 250 } },
  { id: 'flames', name: 'Flames', unlock: { flips: 10 } },
  { id: 'stars', name: 'Stars', unlock: { flips: 50 } },
  { id: 'checkers', name: 'Checkers', unlock: { wins: 1 } },
];
export const DECAL_BY_ID = Object.fromEntries(DECALS.map((d) => [d.id, d]));

const MEDAL_NAME = { gold: 'gold', silver: 'silver', bronze: 'bronze' };
/** How a locked paint is earned (shown on its chip). */
export function paintHint(p, trails) {
  const u = p.unlock || {};
  if (u.finish) { const t = (trails || []).find((x) => x.style === u.finish); return t ? `Finish ${t.name}` : 'Coming soon'; }
  if (u.medal) return u.count === 'all' ? 'Gold on every track' : u.count > 1 ? `${u.count} ${MEDAL_NAME[u.medal]} medals` : `Win a ${MEDAL_NAME[u.medal]} medal`;
  if (u.crate) return 'Crate';
  if (u.streak) return `${u.streak}-day streak`;
  if (u.set) return `Complete the ${u.set} set`;
  return '';
}
export function decalHint(d) {
  const u = d.unlock || {};
  if (u.distance) return `Race ${u.distance.toLocaleString('en-US')} m`;
  if (u.flips) return `Land ${u.flips} flips`;
  if (u.wins) return 'Win a race';
  if (u.crate) return 'Crate';
  return '';
}
