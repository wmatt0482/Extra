// Paints and decals for the Ranger (SPEC §2.3). In v1 (no math layer yet) they come from trail progress, never cash:
//   paint: Sage Green is stock; finishing a trail unlocks one paint (keyed by the trail's style, so it works with any
//          trail ids); the math phase adds the rest (one per mastered fact family).
//   decal: best-distance milestones on a single ride (the longest ride on any trail).
// The engine's src/game/vehicle.js draws them (same ids and body colors as its PAINTS / DECALS); these ids are what
// main.js passes to game.start() as `paint` / `decal`.

export const PAINTS = [
  { id: 'sage', name: 'Sage Green', body: '#7c9a63', trim: '#4f6a40', style: null },
  { id: 'orange', name: 'Blaze Orange', body: '#ff8a1f', trim: '#b35400', style: 'forest' },
  { id: 'granite', name: 'Granite Gray', body: '#8f949c', trim: '#5c6268', style: 'granite' },
  { id: 'lakeblue', name: 'Lake Blue', body: '#2f8bd6', trim: '#1c4f86', style: 'lake' },
  { id: 'snow', name: 'Snow White', body: '#f1f4f8', trim: '#b9c6cf', style: 'snow' },
  { id: 'sunset', name: 'Sunset Red', body: '#e2453a', trim: '#9c2620', style: 'desert' },
  { id: 'black', name: 'Black', body: '#2b2d33', trim: '#0d0f11', style: 'night' },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map((p) => [p.id, p]));

export const DECALS = [
  { id: 'none', name: 'No decal', color: '#b2d3c2', distance: 0 },
  { id: 'mud', name: 'Mud Splats', color: '#8a5a32', distance: 250 },
  { id: 'flames', name: 'Flames', color: '#ff8a1f', distance: 500 },
  { id: 'stars', name: 'Stars', color: '#ffd23a', distance: 1000 },
  { id: 'checkers', name: 'Checkers', color: '#ffffff', distance: 1800 },
];
export const DECAL_BY_ID = Object.fromEntries(DECALS.map((d) => [d.id, d]));

/** How a locked paint / decal is earned (shown on its chip). */
export function paintHint(p, trails) {
  const t = (trails || []).find((x) => x.style === p.style);
  return t ? `Finish ${t.name}` : 'Coming soon';
}
export const decalHint = (d) => `Ride ${d.distance.toLocaleString('en-US')} m`;
