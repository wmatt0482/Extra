// Vehicles: geometry for the physics (src/data/vehicles.js) + the procedural drawing shared by the engine and the
// garage preview. Vehicle-local meters, +x forward, +y UP, y = 0 at the ground under the wheels.
//
//   drawVehicle(ctx, look, { t, nitroOn, speed, lw, wheels?, lights?, rim?, noDriver?, turbo? })
//     ctx is already in vehicle-local meters with +y up (the engine's world transform + the chassis pose).
//     look = { vehicle?: id | def (default the Ranger), paint: id | PAINTS entry, decal: id,
//              helmet?: helmet id (HELMETS) | css colour (a plain helmet in that colour), suit?: suit id (SUITS),
//              flag?: flag id (FLAGS) | null, trail?: boost trail id (TRAIL_FX) | css colour }.
//     wheels (optional) = [{ x, y, a }] wheel centres in vehicle-local meters + spin angle (rad); default: at
//     rest, spinning with t * speed.
//   drawVehiclePreview(ctx, look, { x, y, scale, t, speed, lw? }) for a y-down canvas (garage, picker tiles):
//     (x, y) = the screen point on the ground under the vehicle's centre, scale = px per meter.
//   drawRider(ctx, look, lw?, helmet?) draws the rider figure (helmet + suit) at the origin, +y up: the thrown
//     driver in a crash, or a rider portrait (garage wall / cosmetics cards; ~1.1 m tall, scale to taste).
//   drawHelmet(ctx, look, lw, x, y, r?) draws just the helmet (12 designs, readable at 40 px).
//   HELMETS / SUITS / FLAGS / TRAIL_FX: the cosmetic ids the engine can draw (the app's cosmetics.js uses these ids).
//
// The Ranger's geometry is also exported as VEHICLE (v1 name) for older callers.

import { TAU, shade, withAlpha, luminance } from './util.js';
import { VEHICLES, VEHICLE_BY_ID, vehicleDef } from '../data/vehicles.js';

const OUTLINE = '#1d1b26';

// ---------- per-vehicle art (painted body polygon, cage tubes, trims); physics comes from vehicles.js ----------
const ART = {
  ranger150: {
    kind: 'utv',
    body: [[-1.36, 0.5], [1.3, 0.5], [1.46, 0.6], [1.44, 0.9], [1.3, 1.02], [0.66, 1.16], [0.56, 1.12], [-0.56, 1.12], [-0.6, 1.27], [-1.36, 1.27]],
    cage: [[0.66, 1.16, 0.46, 2.0], [-0.58, 1.12, -0.56, 2.0], [-0.62, 2.0, 0.56, 2.0], [-0.56, 1.9, -1.12, 1.27], [0.46, 2.0, 0.98, 1.09]],
    farCage: [[0.5, 1.16, 0.36, 1.98], [-0.66, 1.14, -0.64, 1.98]],
    roof: { x0: -0.72, x1: 0.64, y0: 1.97, y1: 2.08 },
    door: { x0: -0.5, x1: 0.5, y0: 1.12, y1: 1.46 },
    bed: { x0: -1.36, x1: -0.62, y0: 0.98, y1: 1.27 },
    taillight: [-1.33, 1.13], stripe: [0.7, 0.82], badge: '150', badgeAt: [0.02, 0.97, 0.52],
    bumper: true, bbox: [-1.36, 1.46, 0.5, 1.27],
  },
  quad: {
    kind: 'quad',
    body: [[-1.0, 0.5], [1.0, 0.5], [1.15, 0.62], [1.05, 0.9], [0.5, 1.0], [-0.2, 1.08], [-0.95, 1.12], [-1.08, 0.9]],
    cage: [], farCage: [],
    taillight: [-1.02, 0.95], stripe: [0.62, 0.72], badge: 'DQ', badgeAt: [0.15, 0.82, 0.4],
    bumper: true, bbox: [-1.08, 1.15, 0.5, 1.1],
    // handlebars from the body to the grips
    bars: [[0.55, 0.98], [0.42, 1.42]],
  },
  dirtbike: {
    kind: 'bike',
    body: [[-0.55, 0.95], [0.2, 0.9], [0.7, 1.0], [0.95, 1.2], [0.75, 1.32], [0.15, 1.3], [-0.5, 1.22], [-0.9, 1.1]],
    cage: [], farCage: [],
    taillight: [-0.85, 1.12], stripe: [1.02, 1.12], badge: '85', badgeAt: [0.5, 1.15, 0.3],
    bumper: false, bbox: [-0.9, 0.95, 0.9, 1.32],
    bars: [[0.72, 1.32], [0.6, 1.75]],
  },
  buggy: {
    kind: 'buggy',
    body: [[-1.4, 0.55], [1.35, 0.55], [1.58, 0.8], [1.4, 1.15], [0.75, 1.25], [0.55, 1.2], [-0.55, 1.2], [-0.75, 1.3], [-1.48, 1.35]],
    cage: [[0.72, 1.25, 0.52, 2.08], [-0.62, 1.2, -0.62, 2.1], [-0.72, 2.1, 0.62, 2.08], [0.52, 2.08, 1.3, 1.15], [-0.62, 2.0, -1.42, 1.35], [-0.1, 2.09, 0.2, 1.2]],
    farCage: [[0.56, 1.25, 0.4, 2.06], [-0.72, 1.2, -0.72, 2.08]],
    roof: { x0: -0.8, x1: 0.7, y0: 2.05, y1: 2.2 },
    door: { x0: -0.5, x1: 0.5, y0: 1.2, y1: 1.5 },
    taillight: [-1.44, 1.2], stripe: [0.78, 0.9], badge: 'RB', badgeAt: [0.0, 1.0, 0.48],
    bumper: true, bbox: [-1.48, 1.58, 0.55, 1.35],
  },
  mudtruck: {
    kind: 'truck',
    body: [[-1.5, 0.95], [1.5, 0.95], [1.68, 1.2], [1.6, 1.62], [1.3, 1.7], [0.55, 1.8], [0.35, 2.5], [-0.9, 2.55], [-1.0, 1.8], [-1.5, 1.8]],
    cage: [], farCage: [],
    door: { x0: -0.8, x1: 0.3, y0: 1.85, y1: 2.42 },
    bed: { x0: -1.5, x1: -1.02, y0: 1.5, y1: 1.8 },
    taillight: [-1.47, 1.65], stripe: [1.25, 1.4], badge: 'MUD', badgeAt: [0.6, 1.4, 0.62],
    bumper: true, bbox: [-1.5, 1.68, 0.95, 2.55],
    stack: [-1.1, 1.8],
  },
  turbo: {
    kind: 'utv',
    body: [[-1.45, 0.45], [1.45, 0.45], [1.62, 0.62], [1.5, 0.98], [0.9, 1.12], [0.62, 1.06], [-0.62, 1.06], [-0.7, 1.22], [-1.45, 1.22]],
    cage: [[0.66, 1.1, 0.5, 1.98], [-0.64, 1.06, -0.62, 1.98], [-0.72, 1.98, 0.6, 1.98], [-0.62, 1.9, -1.2, 1.22], [0.5, 1.98, 1.1, 1.05]],
    farCage: [[0.52, 1.1, 0.4, 1.96], [-0.72, 1.08, -0.7, 1.96]],
    roof: { x0: -0.8, x1: 0.68, y0: 1.95, y1: 2.05 },
    door: { x0: -0.52, x1: 0.52, y0: 1.06, y1: 1.4 },
    taillight: [-1.42, 1.08], stripe: [0.62, 0.76], badge: 'RZR', badgeAt: [0.1, 0.9, 0.5],
    bumper: true, bbox: [-1.45, 1.62, 0.45, 1.22],
    wing: { x0: -1.5, x1: -0.7, y: 1.55 },
  },
  rail: {
    kind: 'rail',
    body: [[-1.6, 0.5], [1.85, 0.3], [2.05, 0.55], [1.7, 0.72], [1.1, 0.8], [0.6, 0.95], [0.5, 1.0], [-0.5, 1.0], [-0.6, 1.15], [-1.65, 1.15]],
    cage: [[0.55, 1.0, 0.4, 1.95], [-0.55, 1.0, -0.6, 1.95], [-0.7, 1.95, 0.5, 1.95], [-0.6, 1.85, -1.3, 1.15], [0.4, 1.95, 0.95, 0.85]],
    farCage: [[0.42, 1.0, 0.28, 1.93], [-0.68, 1.0, -0.72, 1.93]],
    roof: { x0: -0.78, x1: 0.58, y0: 1.92, y1: 2.02 },
    door: { x0: -0.45, x1: 0.45, y0: 1.0, y1: 1.32 },
    taillight: [-1.62, 1.02], stripe: [0.6, 0.72], badge: 'TR', badgeAt: [1.3, 0.6, 0.4],
    bumper: false, bbox: [-1.65, 2.05, 0.3, 1.15],
    wing: { x0: -1.75, x1: -0.9, y: 1.5 }, nose: true,
  },
  rover: {
    kind: 'rover',
    body: [[-1.4, 0.6], [1.4, 0.6], [1.55, 0.85], [1.45, 1.55], [0.95, 1.6], [0.95, 1.95], [-0.95, 2.35], [-1.45, 1.55]],
    cage: [], farCage: [],
    door: { x0: -0.6, x1: 0.6, y0: 1.65, y1: 2.05 },
    taillight: [-1.4, 1.1], stripe: [0.95, 1.1], badge: 'MR', badgeAt: [0.0, 1.3, 0.5],
    bumper: false, bbox: [-1.45, 1.55, 0.6, 2.35],
    dish: [-0.6, 2.35], panel: { x0: -0.9, x1: 0.9, y: 2.0 },
  },
};
const artFor = (def) => ART[def.id] || ART.ranger150;

// the Ranger's geometry under its v1 name (engine helpers + the garage fallback still read it)
export const VEHICLE = {
  ...VEHICLE_BY_ID.ranger150, body: ART.ranger150.body, cage: ART.ranger150.cage, roof: ART.ranger150.roof, door: ART.ranger150.door,
  bed: ART.ranger150.bed, taillight: ART.ranger150.taillight, winchHook: [1.47, 0.62], stripe: ART.ranger150.stripe,
  minX: -1.36, maxX: 1.47, minY: 0.0, maxY: 2.08,
};

export const PAINTS = [
  { id: 'sage', name: 'Sage Green', body: '#86a86b', stripe: '#ff8a1f' },
  { id: 'orange', name: 'Blaze Orange', body: '#ff8a1f', stripe: '#1f4d2e' },
  { id: 'lakeblue', name: 'Lake Blue', body: '#2f8bd6', stripe: '#ff8a1f' },
  { id: 'granite', name: 'Granite Gray', body: '#8f949c', stripe: '#ff8a1f' },
  { id: 'snow', name: 'Snow White', body: '#f1f4f8', stripe: '#ff8a1f' },
  { id: 'sunset', name: 'Sunset Red', body: '#e2453a', stripe: '#ffd23f' },
  { id: 'pine', name: 'Pine', body: '#24583a', stripe: '#ff8a1f' },
  { id: 'sky', name: 'Sky', body: '#66c9ff', stripe: '#ff8a1f' },
  { id: 'gold', name: 'Gold', body: '#f2c230', stripe: '#1f4d2e' },
  { id: 'purple', name: 'Purple', body: '#8a56d6', stripe: '#ffd23f' },
  { id: 'black', name: 'Black', body: '#2b2d33', stripe: '#ff8a1f' },
  { id: 'rainbow', name: 'Rainbow', body: '#ff5d5d', stripe: '#ffffff', rainbow: ['#ff5d5d', '#ff9f1a', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff'] },
  // v1.5 set-bonus / streak paints (the app decides how they are earned)
  { id: 'streak', name: 'Streak', body: '#ff4d2e', stripe: '#ffe14a' },
  { id: 'neon', name: 'Neon', body: '#1a1a2e', stripe: '#3cff9d' },
  { id: 'candy', name: 'Candy', body: '#ff7ad1', stripe: '#ffffff' },
  { id: 'moon', name: 'Moon Dust', body: '#c9ccd8', stripe: '#4dd2ff' },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map((p) => [p.id, p]));

export const DECALS = [
  { id: 'none', name: 'None' },
  { id: 'mud', name: 'Mud Splats' },
  { id: 'flames', name: 'Flames' },
  { id: 'stars', name: 'Stars' },
  { id: 'checkers', name: 'Checkers' },
];
export const DECAL_BY_ID = Object.fromEntries(DECALS.map((d) => [d.id, d]));

// ---------- rider cosmetics (SPEC v1.5 §4): ids the engine draws ----------
export const HELMETS = [
  { id: 'classic', name: 'Classic', color: '#ff8a1f' },
  { id: 'stripe', name: 'Stripe', color: '#f4f6fa' },
  { id: 'flames', name: 'Flames', color: '#e2453a' },
  { id: 'skull', name: 'Skull', color: '#23242b' },
  { id: 'dino', name: 'Dino', color: '#4fb84a' },
  { id: 'astronaut', name: 'Astronaut', color: '#f6f7fb' },
  { id: 'shark', name: 'Shark', color: '#7f9bb5' },
  { id: 'rainbow', name: 'Rainbow', color: '#ff5d5d' },
  { id: 'chrome', name: 'Chrome', color: '#d9dde6' },
  { id: 'galaxy', name: 'Galaxy', color: '#3b2a7a' },
  { id: 'lightning', name: 'Lightning', color: '#ffd23f' },
  { id: 'crown', name: 'Crown', color: '#f2c230' },
];
export const HELMET_BY_ID = Object.fromEntries(HELMETS.map((h) => [h.id, h]));
export const SUITS = [
  { id: 'rookie', name: 'Rookie Blue', body: '#3f5a8a', trim: '#ffffff', pattern: 'none' },
  { id: 'racer', name: 'Racer Red', body: '#d9382f', trim: '#ffffff', pattern: 'stripe' },
  { id: 'neon', name: 'Neon Night', body: '#1d1d2a', trim: '#3cff9d', pattern: 'stripe' },
  { id: 'camo', name: 'Camo', body: '#5f7a45', trim: '#3a4a2a', pattern: 'blobs' },
  { id: 'stars', name: 'Star Captain', body: '#243a6e', trim: '#ffe14a', pattern: 'dots' },
  { id: 'checker', name: 'Checker Flag', body: '#f4f4f4', trim: '#1d1b26', pattern: 'checks' },
  { id: 'gold', name: 'Gold Rush', body: '#e8b52e', trim: '#8a5a10', pattern: 'stripe' },
  { id: 'galaxy', name: 'Galaxy', body: '#4a2a8a', trim: '#ff7ad1', pattern: 'dots' },
];
export const SUIT_BY_ID = Object.fromEntries(SUITS.map((s) => [s.id, s]));
export const FLAGS = [
  { id: 'checker', name: 'Checker', colors: ['#111111', '#ffffff'], pattern: 'checks' },
  { id: 'star', name: 'Star', colors: ['#2f6bd6', '#ffe14a'], pattern: 'star' },
  { id: 'skull', name: 'Skull', colors: ['#23242b', '#ffffff'], pattern: 'skull' },
  { id: 'rainbow', name: 'Rainbow', colors: ['#ff5d5d', '#ffe14a', '#3ddc84', '#22b8ff'], pattern: 'bands' },
  { id: 'lightning', name: 'Lightning', colors: ['#ffd23f', '#1d1b26'], pattern: 'bolt' },
  { id: 'heart', name: 'Heart', colors: ['#ff4d8d', '#ffffff'], pattern: 'heart' },
];
export const FLAG_BY_ID = Object.fromEntries(FLAGS.map((f) => [f.id, f]));
export const TRAIL_FX = [
  { id: 'orange', name: 'Ember', colors: ['#ff6a1a', '#ffe14a'] },
  { id: 'blue', name: 'Ice Blue', colors: ['#4dd2ff', '#dff6ff'] },
  { id: 'green', name: 'Slime', colors: ['#7dff6b', '#d6ff8a'] },
  { id: 'pink', name: 'Bubblegum', colors: ['#ff5ec4', '#ffc2ea'] },
  { id: 'purple', name: 'Plasma', colors: ['#8f6bff', '#d9c8ff'] },
  { id: 'gold', name: 'Gold Dust', colors: ['#f2c230', '#fff3a0'] },
  { id: 'ice', name: 'Frost', colors: ['#ffffff', '#bfe8ff'] },
  { id: 'rainbow', name: 'Rainbow', colors: ['#ff5d5d', '#ff9f1a', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff'] },
];
export const TRAIL_FX_BY_ID = Object.fromEntries(TRAIL_FX.map((f) => [f.id, f]));

const isCss = (s) => typeof s === 'string' && (s[0] === '#' || s.startsWith('rgb') || s.startsWith('hsl'));

// look -> resolved paint/decal/vehicle/cosmetics + derived colours (cached per look key)
const lookCache = new Map();
export function resolveLook(look = {}) {
  const def = vehicleDef(look.vehicle);
  const pid = typeof look.paint === 'string' ? look.paint : look.paint && look.paint.id;
  const paint = (typeof look.paint === 'object' && look.paint && look.paint.body ? look.paint : PAINT_BY_ID[pid]) || PAINT_BY_ID[def.look.paint] || PAINT_BY_ID.sage;
  const decal = DECAL_BY_ID[look.decal] ? look.decal : 'none';
  let helmetId = 'classic', helmetColor = paint.id === 'orange' ? '#ffd23f' : '#ff8a1f';
  if (HELMET_BY_ID[look.helmet]) { helmetId = look.helmet; helmetColor = HELMET_BY_ID[look.helmet].color; }
  else if (isCss(look.helmet)) helmetColor = look.helmet;
  const suit = SUIT_BY_ID[look.suit] || SUITS[0];
  const flag = FLAG_BY_ID[look.flag] || null;
  const trailFx = TRAIL_FX_BY_ID[look.trail] || (isCss(look.trail) ? { id: 'custom', colors: [look.trail, look.trail] } : TRAIL_FX[0]);
  const key = def.id + '|' + paint.id + '|' + paint.body + '|' + decal + '|' + helmetId + '|' + helmetColor + '|' + suit.id + '|' + (flag ? flag.id : '') + '|' + trailFx.id + (trailFx.id === 'custom' ? trailFx.colors[0] : '');
  let r = lookCache.get(key);
  if (r) return r;
  const dark = luminance(paint.body) < 0.2;
  r = {
    key, vehicle: def, art: artFor(def), paint, decal, helmet: helmetColor, helmetId, suit, flag, trailFx, body: paint.body, stripe: paint.stripe,
    bodyDark: shade(paint.body, -0.3), bodyLight: shade(paint.body, 0.22), dark,
    under: withAlpha('#000000', dark ? 0.3 : 0.22),
  };
  if (lookCache.size > 300) lookCache.clear();
  lookCache.set(key, r);
  return r;
}
/** The boost trail colour for a look at time t (rainbow trails cycle). */
export function trailColor(look, t = 0, k = 0) {
  const L = look && look.key ? look : resolveLook(look);
  const cols = L.trailFx.colors;
  if (cols.length > 2) return cols[(Math.floor(t * 6) + k) % cols.length];
  return cols[k % 2];
}

// ---------- small canvas helpers ----------
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function mkCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}
const badges = new Map(); // the "150" / "RZR" ... decals, rendered once each
function badgeSprite(text) {
  let b = badges.get(text);
  if (b !== undefined) return b;
  const cv = mkCanvas(132, 64);
  if (!cv) { badges.set(text, false); return false; }
  const c = cv.getContext('2d');
  c.font = '900 50px "Arial Black", "Helvetica Neue", system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 10;
  c.strokeStyle = '#ffffff';
  c.strokeText(text, 66, 34);
  c.fillStyle = '#15161a';
  c.fillText(text, 66, 34);
  badges.set(text, cv);
  return cv;
}

// fixed decal layouts in Ranger body space (x -1.36..1.46, y 0.5..1.27), mapped onto each vehicle's body box
const MUD_BLOBS = [[-1.1, 0.62, 0.16], [-0.7, 0.56, 0.1], [-0.2, 0.66, 0.13], [0.25, 0.58, 0.09], [0.7, 0.64, 0.14], [1.15, 0.6, 0.11], [-1.25, 0.95, 0.08], [1.3, 0.82, 0.07], [0.0, 0.9, 0.06]];
const STARS = [[-1.05, 1.0, 0.13], [-0.25, 0.88, 0.1], [0.42, 0.62, 0.12], [1.12, 0.66, 0.1], [-0.8, 0.6, 0.08]];
function starPath(ctx, cx, cy, ro) {
  const ri = ro * 0.45;
  ctx.moveTo(cx, cy + ro);
  for (let i = 1; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawWheel(ctx, w, a, lw, hub, big) {
  const r = w.r;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(a);
  // knobs
  ctx.fillStyle = '#17171c';
  ctx.beginPath();
  const nk = big ? 18 : 14;
  for (let i = 0; i < nk; i++) {
    const t = (i / nk) * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    const k = 0.075 * (r / 0.42);
    const x0 = c * (r * 0.9), y0 = s * (r * 0.9);
    const d = 0.09 * (r / 0.42);
    ctx.moveTo(x0 - s * k, y0 + c * k);
    ctx.lineTo(x0 - s * k + c * d, y0 + c * k + s * d);
    ctx.lineTo(x0 + s * k + c * d, y0 - c * k + s * d);
    ctx.lineTo(x0 + s * k, y0 - c * k);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, 0, TAU);
  ctx.fillStyle = '#23232a';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#0b0b0e';
  ctx.stroke();
  // sidewall ring
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.74, 0, TAU);
  ctx.strokeStyle = '#3b3b46';
  ctx.lineWidth = r * 0.08;
  ctx.stroke();
  // rim
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, TAU);
  ctx.fillStyle = '#c9ced6';
  ctx.fill();
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = '#4a4f5a';
  ctx.stroke();
  ctx.fillStyle = '#7b818d';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * TAU;
    ctx.moveTo(Math.cos(t) * r * 0.3 + 0.035, Math.sin(t) * r * 0.3);
    ctx.arc(Math.cos(t) * r * 0.3, Math.sin(t) * r * 0.3, 0.035 * (r / 0.42), 0, TAU);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.17, 0, TAU);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.lineWidth = lw * 0.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}

// ---------- rider (seated or standing) ----------
function suitPattern(ctx, S, x0, y0, w, h) {
  if (S.pattern === 'stripe') { ctx.fillStyle = S.trim; ctx.fillRect(x0 + w * 0.42, y0, w * 0.16, h); }
  else if (S.pattern === 'dots') { ctx.fillStyle = S.trim; ctx.beginPath(); for (let i = 0; i < 4; i++) { const px = x0 + w * (0.2 + 0.2 * i), py = y0 + h * (0.3 + 0.35 * (i % 2)); ctx.moveTo(px + 0.03, py); ctx.arc(px, py, 0.03, 0, TAU); } ctx.fill(); }
  else if (S.pattern === 'blobs') { ctx.fillStyle = S.trim; ctx.beginPath(); for (let i = 0; i < 3; i++) { const px = x0 + w * (0.25 + 0.25 * i), py = y0 + h * (0.25 + 0.4 * (i % 2)); ctx.moveTo(px + 0.06, py); ctx.ellipse(px, py, 0.07, 0.045, 0.4, 0, TAU); } ctx.fill(); }
  else if (S.pattern === 'checks') { const cs = Math.min(w, h) / 3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) { ctx.fillStyle = S.trim; ctx.fillRect(x0 + i * cs, y0 + j * cs, cs + 0.004, cs + 0.004); } }
}
// the driver in a cab: torso leaning forward, one arm to the wheel; sx, sy = the seat
function drawCabDriver(ctx, L, sx, sy, lw, barX, barY) {
  const S = L.suit;
  ctx.fillStyle = S.body;
  ctx.beginPath();
  ctx.moveTo(sx - 0.24, sy); ctx.lineTo(sx + 0.2, sy); ctx.lineTo(sx + 0.16, sy + 0.38); ctx.quadraticCurveTo(sx - 0.02, sy + 0.48, sx - 0.2, sy + 0.4);
  ctx.closePath();
  ctx.save(); ctx.clip(); suitPattern(ctx, S, sx - 0.24, sy, 0.44, 0.46); ctx.restore();
  ctx.lineWidth = lw * 0.7;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // arm to the wheel
  ctx.strokeStyle = S.body;
  ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.moveTo(sx + 0.04, sy + 0.32); ctx.lineTo(barX, barY); ctx.stroke();
  ctx.strokeStyle = S.trim; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(sx + 0.04, sy + 0.32); ctx.lineTo(barX, barY); ctx.stroke();
  drawHelmet(ctx, L, lw, sx, sy + 0.6, 0.2);
}
// a rider on top (quad / bike): legs down the sides, arms to the handlebar grips
function drawTopRider(ctx, L, sx, sy, lw, gx, gy, standing) {
  const S = L.suit;
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = S.body;
  ctx.lineWidth = 0.13;
  ctx.beginPath();
  ctx.moveTo(sx - 0.05, sy + 0.1); ctx.lineTo(sx - 0.22, sy - 0.25); ctx.lineTo(sx - 0.1, sy - 0.5);
  ctx.stroke();
  // torso
  ctx.fillStyle = S.body;
  ctx.beginPath();
  const lean = standing ? 0.12 : 0.08;
  ctx.moveTo(sx - 0.2, sy); ctx.lineTo(sx + 0.18, sy); ctx.lineTo(sx + 0.2 + lean, sy + 0.5); ctx.quadraticCurveTo(sx + lean, sy + 0.62, sx - 0.16 + lean, sy + 0.52);
  ctx.closePath();
  ctx.save(); ctx.clip(); suitPattern(ctx, S, sx - 0.2, sy, 0.44, 0.6); ctx.restore();
  ctx.lineWidth = lw * 0.7;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // arms to the grips
  ctx.strokeStyle = S.body;
  ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.moveTo(sx + 0.12 + lean, sy + 0.42); ctx.lineTo(gx, gy); ctx.stroke();
  ctx.strokeStyle = S.trim; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(sx + 0.12 + lean, sy + 0.42); ctx.lineTo(gx, gy); ctx.stroke();
  // boot
  ctx.fillStyle = '#23242b';
  ctx.beginPath(); ctx.ellipse(sx - 0.06, sy - 0.52, 0.12, 0.06, 0, 0, TAU); ctx.fill();
  drawHelmet(ctx, L, lw, sx + 0.04 + lean, sy + 0.74, 0.2);
}

// ---------- helmets: 12 designs, bold and readable at 40 px ----------
export function drawHelmet(ctx, look, lw = 0.05, x = 0, y = 0, r = 0.2) {
  const L = look && look.key ? look : resolveLook(look);
  const id = L.helmetId, k = r / 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const R = 0.2;
  ctx.lineJoin = 'round';
  // shell
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = id === 'chrome' ? '#c9ced8' : L.helmet;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (id === 'stripe') { ctx.fillStyle = '#2f6bd6'; ctx.fillRect(-0.05, -R, 0.1, 2 * R); ctx.fillStyle = '#e2453a'; ctx.fillRect(-0.09, -R, 0.03, 2 * R); ctx.fillRect(0.06, -R, 0.03, 2 * R); }
  else if (id === 'flames') { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-R, -0.02); ctx.quadraticCurveTo(-0.1, 0.0, -0.02, 0.07); ctx.quadraticCurveTo(-0.08, -0.05, -0.0, -0.12); ctx.quadraticCurveTo(-0.14, -0.12, -R, -0.18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(-R, -0.05); ctx.quadraticCurveTo(-0.12, -0.03, -0.08, 0.02); ctx.quadraticCurveTo(-0.12, -0.08, -R, -0.14); ctx.closePath(); ctx.fill(); }
  else if (id === 'skull') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.05, 0.02, 0.095, 0, TAU); ctx.fill(); ctx.fillRect(-0.09, -0.1, 0.08, 0.05); ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.arc(-0.085, 0.035, 0.03, 0, TAU); ctx.arc(-0.015, 0.035, 0.03, 0, TAU); ctx.fill(); ctx.fillRect(-0.07, -0.09, 0.012, 0.04); ctx.fillRect(-0.045, -0.09, 0.012, 0.04); }
  else if (id === 'dino') { ctx.fillStyle = '#2f7d3a'; ctx.beginPath(); ctx.arc(-0.02, -0.02, 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(-0.06, 0.03, 0.035, 0, TAU); ctx.fill(); }
  else if (id === 'astronaut') { ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(0.03, 0.0, 0.13, 0.11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(0.0, 0.04, 0.06, 0.03, -0.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#e2453a'; ctx.fillRect(-0.2, -0.04, 0.06, 0.03); }
  else if (id === 'shark') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0.06, -0.08); for (let i = 0; i < 4; i++) { ctx.lineTo(0.08 + i * 0.035, -0.17); ctx.lineTo(0.1 + i * 0.035, -0.08); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#5a7a95'; ctx.fillRect(-R, -R, 0.4, 0.1); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0.04, 0.03, 0.03, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0.05, 0.03, 0.014, 0, TAU); ctx.fill(); }
  else if (id === 'rainbow') { const cols = ['#ff5d5d', '#ff9f1a', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff']; for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(-R, R - (i + 1) * (2 * R / 6), 2 * R, 2 * R / 6 + 0.005); } }
  else if (id === 'chrome') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-0.05, 0.08, 0.1, 0.045, -0.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0.04, -0.1, 0.14, 0.06, -0.3, 0, TAU); ctx.fill(); }
  else if (id === 'galaxy') { ctx.fillStyle = '#7a3fd6'; ctx.beginPath(); ctx.ellipse(-0.04, 0.02, 0.14, 0.07, 0.6, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; for (const [sx, sy] of [[-0.1, 0.1], [0.02, 0.1], [-0.13, -0.06], [0.06, -0.1], [-0.02, 0.0]]) ctx.fillRect(sx, sy, 0.022, 0.022); }
  else if (id === 'lightning') { ctx.fillStyle = '#1d1b26'; ctx.beginPath(); ctx.moveTo(-0.02, 0.17); ctx.lineTo(-0.13, 0.0); ctx.lineTo(-0.05, 0.0); ctx.lineTo(-0.12, -0.16); ctx.lineTo(0.03, 0.02); ctx.lineTo(-0.05, 0.02); ctx.closePath(); ctx.fill(); }
  else if (id === 'crown') { ctx.fillStyle = '#b8860b'; ctx.fillRect(-R, -0.02, 0.4, 0.05); }
  ctx.restore();
  // extras outside the shell
  if (id === 'dino') { ctx.fillStyle = '#ffe14a'; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = Math.PI * (0.35 + i * 0.16); const cx = Math.cos(a) * R, cy = Math.sin(a) * R; ctx.moveTo(cx - 0.04, cy - 0.01); ctx.lineTo(cx * 1.45, cy * 1.45); ctx.lineTo(cx + 0.04, cy + 0.01); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw * 0.6; ctx.stroke(); }
  if (id === 'shark') { ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.moveTo(-0.09, 0.17); ctx.lineTo(-0.04, 0.34); ctx.lineTo(0.08, 0.17); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw * 0.7; ctx.stroke(); }
  if (id === 'crown') { ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(-0.16, 0.12); ctx.lineTo(-0.14, 0.3); ctx.lineTo(-0.07, 0.19); ctx.lineTo(0.0, 0.33); ctx.lineTo(0.07, 0.19); ctx.lineTo(0.14, 0.3); ctx.lineTo(0.16, 0.12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw * 0.7; ctx.stroke(); ctx.fillStyle = '#e2453a'; ctx.beginPath(); ctx.arc(0, 0.22, 0.025, 0, TAU); ctx.fill(); }
  if (id === 'astronaut') { ctx.lineWidth = lw * 0.8; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.arc(0, 0, R * 1.08, 0, TAU); ctx.stroke(); }
  // outline + visor
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  if (id !== 'astronaut') {
    ctx.fillStyle = id === 'chrome' ? '#5fd3ff' : '#1a1d26';
    ctx.beginPath();
    ctx.moveTo(0.08, 0.07); ctx.lineTo(0.21, 0.05); ctx.quadraticCurveTo(0.23, -0.05, 0.16, -0.1); ctx.lineTo(0.06, -0.07);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-0.1, 0.07, 0.08, 0.05);
  }
  ctx.restore();
}

// a flag on a whip antenna from (px, py), waving with t
function drawFlag(ctx, F, px, py, t, lw) {
  if (!F) return;
  const h = 0.9, top = py + h, w = 0.5, fh = 0.32;
  const sway = Math.sin(t * 7) * 0.06;
  ctx.strokeStyle = '#1d1b26';
  ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - 0.05, py + h * 0.6, px - 0.1 + sway, top); ctx.stroke();
  const fx = px - 0.1 + sway, fy = top;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-w * 0.5, -0.08 + sway, -w, sway * 1.5); ctx.lineTo(-w, -fh + sway * 1.5); ctx.quadraticCurveTo(-w * 0.5, -fh - 0.08 + sway, 0, -fh);
  ctx.closePath();
  ctx.fillStyle = F.colors[0];
  ctx.fill();
  ctx.save();
  ctx.clip();
  const c1 = F.colors[1] || '#fff';
  if (F.pattern === 'checks') { const cs = fh / 2; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) { ctx.fillStyle = c1; ctx.fillRect(-w + i * cs, -fh + j * cs, cs + 0.004, cs + 0.004); } }
  else if (F.pattern === 'bands') { const n = F.colors.length; for (let i = 0; i < n; i++) { ctx.fillStyle = F.colors[i]; ctx.fillRect(-w, -fh + (i * fh) / n, w, fh / n + 0.004); } }
  else if (F.pattern === 'star') { ctx.fillStyle = c1; ctx.beginPath(); starPath(ctx, -w / 2, -fh / 2, 0.12); ctx.fill(); }
  else if (F.pattern === 'skull') { ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(-w / 2, -fh / 2 + 0.03, 0.08, 0, TAU); ctx.fill(); ctx.fillRect(-w / 2 - 0.05, -fh / 2 - 0.1, 0.1, 0.06); ctx.fillStyle = F.colors[0]; ctx.beginPath(); ctx.arc(-w / 2 - 0.03, -fh / 2 + 0.04, 0.025, 0, TAU); ctx.arc(-w / 2 + 0.03, -fh / 2 + 0.04, 0.025, 0, TAU); ctx.fill(); }
  else if (F.pattern === 'bolt') { ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(-w / 2 + 0.03, -0.02); ctx.lineTo(-w / 2 - 0.08, -fh / 2 + 0.02); ctx.lineTo(-w / 2 - 0.01, -fh / 2 + 0.02); ctx.lineTo(-w / 2 - 0.06, -fh + 0.02); ctx.lineTo(-w / 2 + 0.08, -fh / 2 - 0.02); ctx.lineTo(-w / 2 + 0.01, -fh / 2 - 0.02); ctx.closePath(); ctx.fill(); }
  else if (F.pattern === 'heart') { ctx.fillStyle = c1; ctx.beginPath(); const hx = -w / 2, hy = -fh / 2; ctx.moveTo(hx, hy - 0.1); ctx.bezierCurveTo(hx - 0.16, hy + 0.02, hx - 0.06, hy + 0.14, hx, hy + 0.05); ctx.bezierCurveTo(hx + 0.06, hy + 0.14, hx + 0.16, hy + 0.02, hx, hy - 0.1); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}

const restWheels = [{ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }];

export function drawVehicle(ctx, look, state = {}) {
  const L = look && look.key ? look : resolveLook(look);
  const V = L.vehicle, A = L.art;
  const lw = state.lw || 0.06;
  const t = state.t || 0;
  let wheels = state.wheels;
  if (!wheels) {
    const a = -(t * (state.speed || 0)) / V.wheels[0].r;
    for (let i = 0; i < 2; i++) { restWheels[i].x = V.wheels[i].x; restWheels[i].y = V.wheels[i].y; restWheels[i].a = a; }
    wheels = restWheels;
  }
  const wr = state.wheelMul || 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // boost flame (behind everything)
  if (state.nitroOn) {
    const [ex, ey] = V.exhaust;
    const f = (0.85 + 0.3 * Math.sin(t * 57) + 0.18 * Math.sin(t * 31)) * (state.turbo ? 1.6 : 1);
    const len = 1.35 * f;
    const cols = L.trailFx.colors;
    const c0 = cols.length > 2 ? cols[Math.floor(t * 6) % cols.length] : cols[0], c1 = cols.length > 2 ? '#ffffff' : cols[1];
    ctx.beginPath();
    ctx.moveTo(ex + 0.1, ey + 0.24);
    ctx.quadraticCurveTo(ex - len * 0.6, ey + 0.3, ex - len, ey);
    ctx.quadraticCurveTo(ex - len * 0.6, ey - 0.3, ex + 0.1, ey - 0.24);
    ctx.closePath();
    ctx.fillStyle = c0;
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = shade(c0, -0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + 0.05, ey + 0.13);
    ctx.quadraticCurveTo(ex - len * 0.4, ey + 0.15, ex - len * 0.6, ey);
    ctx.quadraticCurveTo(ex - len * 0.4, ey - 0.15, ex + 0.05, ey - 0.13);
    ctx.closePath();
    ctx.fillStyle = c1;
    ctx.fill();
  }
  if (state.rim) {
    poly(ctx, V.hull);
    ctx.lineWidth = lw * 2.2;
    ctx.strokeStyle = state.rim;
    ctx.stroke();
  }

  const kind = A.kind;
  const topRider = kind === 'quad' || kind === 'bike';
  // far-side cage tubes
  if (A.farCage.length) {
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    for (const c of A.farCage) { ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); }
    ctx.stroke();
  }
  // wing / dish / stack behind the body
  if (A.wing) {
    const W = A.wing;
    ctx.fillStyle = '#26292f';
    ctx.beginPath(); ctx.moveTo(W.x0, W.y); ctx.lineTo(W.x1, W.y + 0.08); ctx.lineTo(W.x1, W.y + 0.22); ctx.lineTo(W.x0, W.y + 0.16); ctx.closePath(); ctx.fill();
    ctx.lineWidth = lw * 0.7; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(W.x0 + 0.15, W.y); ctx.lineTo(W.x0 + 0.25, V.hull[V.hull.length - 1][1]); ctx.moveTo(W.x1 - 0.1, W.y + 0.08); ctx.lineTo(W.x1 - 0.05, V.hull[V.hull.length - 1][1]); ctx.stroke();
    ctx.fillStyle = L.stripe; ctx.fillRect(W.x0 + 0.05, W.y + 0.1, W.x1 - W.x0 - 0.1, 0.03);
  }
  if (A.dish) {
    const [dx, dy] = A.dish;
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 0.1, dy + 0.45); ctx.stroke();
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath(); ctx.ellipse(dx + 0.18, dy + 0.55, 0.32, 0.14, -0.9, 0, TAU); ctx.fill();
    ctx.lineWidth = lw * 0.7; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(dx + 0.26, dy + 0.62, 0.04, 0, TAU); ctx.fill();
  }
  if (A.stack) {
    const [sx, sy] = A.stack;
    ctx.fillStyle = '#5b616d';
    ctx.fillRect(sx - 0.07, sy, 0.14, 0.9);
    ctx.lineWidth = lw * 0.7; ctx.strokeStyle = OUTLINE; ctx.strokeRect(sx - 0.07, sy, 0.14, 0.9);
    ctx.fillStyle = '#2a2c33'; ctx.fillRect(sx - 0.1, sy + 0.86, 0.2, 0.08);
  }

  // the rider in a cab is drawn before the body (the door covers the legs); on a quad / bike after it
  const seatX = V.seat[0], seatY = V.seat[1];
  if (!topRider) {
    // seat back
    ctx.fillStyle = '#2a2c33';
    ctx.beginPath();
    ctx.moveTo(seatX - 0.4, seatY); ctx.lineTo(seatX - 0.24, seatY); ctx.lineTo(seatX - 0.2, seatY + 0.58); ctx.lineTo(seatX - 0.36, seatY + 0.62);
    ctx.closePath();
    ctx.fill();
    // steering wheel + column
    const colX = seatX + 0.62, colY = seatY + 0.04;
    ctx.strokeStyle = '#1b1c20';
    ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(colX, colY); ctx.lineTo(colX - 0.16, colY + 0.2); ctx.stroke();
    ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.ellipse(colX - 0.17, colY + 0.22, 0.04, 0.13, -0.5, 0, TAU); ctx.stroke();
    if (!state.noDriver) drawCabDriver(ctx, L, seatX, seatY, lw, colX - 0.26, colY + 0.2);
  }

  // ---- body ----
  poly(ctx, A.body);
  ctx.fillStyle = L.body;
  ctx.fill();
  ctx.save();
  poly(ctx, A.body);
  ctx.clip();
  const [bx0, bx1, by0, by1] = A.bbox;
  const bw = bx1 - bx0, bh = by1 - by0;
  if (L.paint.rainbow) {
    const cols = L.paint.rainbow, n = cols.length, h = bh / n;
    for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(bx0 - 0.2, by0 + (n - 1 - i) * h, bw + 0.4, h + 0.01); }
  }
  // cargo bed (darker inner wall + ribs)
  if (A.bed) {
    const B = A.bed;
    ctx.fillStyle = L.bodyDark;
    ctx.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    for (let x = B.x0 + 0.16; x < B.x1 - 0.05; x += 0.18) { ctx.moveTo(x, B.y0 + 0.04); ctx.lineTo(x, B.y1 - 0.02); }
    ctx.stroke();
  }
  // underside shade + top highlight
  ctx.fillStyle = L.under;
  ctx.fillRect(bx0 - 0.2, by0 - 0.05, bw + 0.4, 0.13);
  ctx.fillStyle = L.dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)';
  ctx.fillRect(bx0 + bw * 0.55, by1 - 0.07 * bh - 0.04, bw * 0.4, 0.05);
  // decal (layouts in Ranger body space, mapped onto this body's box)
  const d = L.decal;
  const mx = (x) => bx0 + ((x + 1.36) / 2.82) * bw, my = (y) => by0 + ((y - 0.5) / 0.77) * bh, ms = Math.min(bw / 2.82, bh / 0.77);
  if (d === 'mud') {
    ctx.fillStyle = 'rgba(92,60,34,0.85)';
    ctx.beginPath();
    for (const [x, y, r] of MUD_BLOBS) { ctx.moveTo(mx(x) + r * ms, my(y)); ctx.ellipse(mx(x), my(y), r * 1.3 * ms, r * ms, 0.3, 0, TAU); }
    ctx.fill();
  } else if (d === 'flames') {
    ctx.save();
    ctx.translate(bx0, by0); ctx.scale(bw / 2.82, bh / 0.77); ctx.translate(1.36, -0.5);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(1.46, 0.5); ctx.lineTo(1.46, 0.92);
    ctx.quadraticCurveTo(0.9, 0.95, 0.55, 0.86); ctx.quadraticCurveTo(0.8, 0.82, 0.92, 0.78);
    ctx.quadraticCurveTo(0.3, 0.8, -0.1, 0.68); ctx.quadraticCurveTo(0.3, 0.64, 0.5, 0.6);
    ctx.quadraticCurveTo(0.0, 0.58, -0.4, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5a1f';
    ctx.beginPath();
    ctx.moveTo(1.46, 0.5); ctx.lineTo(1.46, 0.8);
    ctx.quadraticCurveTo(1.0, 0.82, 0.78, 0.76); ctx.quadraticCurveTo(0.9, 0.7, 1.0, 0.67);
    ctx.quadraticCurveTo(0.6, 0.64, 0.3, 0.56); ctx.quadraticCurveTo(0.6, 0.54, 0.7, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (d === 'stars') {
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath();
    for (const [x, y, r] of STARS) starPath(ctx, mx(x), my(y), r * ms);
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
  }
  // stripe (checkers replace it)
  const [s0, s1] = A.stripe;
  if (d === 'checkers') {
    const cs = 0.09;
    for (let i = 0; i * cs < bw + 0.3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#15161a' : '#ffffff';
        ctx.fillRect(bx0 - 0.1 + i * cs, s0 - 0.02 + j * cs, cs + 0.005, cs + 0.005);
      }
    }
  } else {
    ctx.fillStyle = L.stripe;
    ctx.fillRect(bx0 - 0.1, s0, bw + 0.2, s1 - s0);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx0 - 0.1, s0, bw + 0.2, 0.018);
  }
  // panel seams (cab edges)
  if (A.door) {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = lw * 0.5;
    ctx.beginPath();
    ctx.moveTo(A.door.x1 + 0.08, A.door.y0); ctx.lineTo(A.door.x1 + 0.1, by0 + 0.02);
    ctx.moveTo(A.door.x0 - 0.08, A.door.y0); ctx.lineTo(A.door.x0 - 0.1, by0 + 0.02);
    ctx.stroke();
  }
  ctx.restore();

  // badge on the side
  const bs = badgeSprite(A.badge);
  if (bs) {
    const [ax, ay, aw] = A.badgeAt;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(1, -1);
    ctx.drawImage(bs, -aw / 2, -aw * 0.24, aw, aw * 0.48);
    ctx.restore();
  }
  // lights
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.ellipse(V.headlight[0], V.headlight[1], 0.07, 0.09, 0, 0, TAU);
  ctx.fillStyle = state.lights ? '#fffbe0' : '#fff2a0';
  ctx.fill();
  ctx.stroke();
  if (state.lights) {
    ctx.fillStyle = 'rgba(255,245,190,0.35)';
    ctx.beginPath(); ctx.arc(V.headlight[0], V.headlight[1], 0.22, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(A.taillight[0] - 0.035, A.taillight[1] - 0.07, 0.07, 0.14);
  // bumper / skid plate
  if (A.bumper) {
    ctx.fillStyle = '#24272c';
    const fx = bx1, fy = by0;
    ctx.beginPath();
    ctx.moveTo(fx - 0.14, fy); ctx.lineTo(fx + 0.04, fy + 0.06); ctx.lineTo(fx + 0.04, fy + 0.16); ctx.lineTo(fx - 0.06, fy + 0.16); ctx.lineTo(fx - 0.16, fy + 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(bx0 - 0.06, fy, 0.16, 0.14);
  }
  if (A.nose) {
    ctx.fillStyle = L.stripe;
    ctx.beginPath(); ctx.moveTo(1.85, 0.3); ctx.lineTo(2.05, 0.55); ctx.lineTo(1.7, 0.72); ctx.lineTo(1.6, 0.5); ctx.closePath(); ctx.fill();
  }
  // body outline
  poly(ctx, A.body);
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // mesh door / cab window
  if (A.door) {
    const D = A.door;
    const window = kind === 'truck' || kind === 'rover';
    ctx.fillStyle = window ? (kind === 'rover' ? 'rgba(120,200,255,0.55)' : 'rgba(170,215,255,0.5)') : 'rgba(20,22,26,0.18)';
    ctx.fillRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
    if (!window) {
      ctx.strokeStyle = 'rgba(20,22,26,0.55)';
      ctx.lineWidth = 0.016;
      ctx.save();
      ctx.beginPath();
      ctx.rect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
      ctx.clip();
      ctx.beginPath();
      for (let k = -0.6; k < 1.2; k += 0.09) {
        ctx.moveTo(D.x0 + k, D.y0); ctx.lineTo(D.x0 + k + 0.38, D.y1);
        ctx.moveTo(D.x0 + k + 0.38, D.y0); ctx.lineTo(D.x0 + k, D.y1);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(D.x0 + 0.08, D.y1 - 0.14, (D.x1 - D.x0) * 0.4, 0.05);
    }
    ctx.strokeStyle = '#1b1d22';
    ctx.lineWidth = 0.06;
    ctx.strokeRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
  }
  if (A.panel) {
    const P = A.panel;
    ctx.fillStyle = '#2a3b7a';
    ctx.beginPath(); ctx.moveTo(P.x0, P.y); ctx.lineTo(P.x1, P.y - 0.3); ctx.lineTo(P.x1, P.y - 0.18); ctx.lineTo(P.x0, P.y + 0.12); ctx.closePath(); ctx.fill();
    ctx.lineWidth = lw * 0.7; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.02;
    ctx.beginPath(); for (let k = 1; k < 5; k++) { const x = P.x0 + ((P.x1 - P.x0) * k) / 5; ctx.moveTo(x, P.y - 0.3 * (k / 5)); ctx.lineTo(x, P.y - 0.3 * (k / 5) + 0.12); } ctx.stroke();
  }

  // roll cage (near side) + flat roof
  if (A.cage.length) {
    ctx.strokeStyle = '#1a1c20';
    ctx.lineWidth = 0.085;
    ctx.beginPath();
    for (const c of A.cage) { ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (const c of A.cage.slice(0, 2)) { ctx.moveTo(c[0] - 0.02, c[1] + 0.04); ctx.lineTo(c[2] - 0.02, c[3] - 0.04); }
    ctx.stroke();
  }
  if (A.roof) {
    const R = A.roof;
    ctx.fillStyle = '#26292f';
    ctx.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    ctx.fillStyle = L.stripe;
    ctx.fillRect(R.x0 + 0.08, R.y1 - 0.035, R.x1 - R.x0 - 0.16, 0.025);
  }
  // bike frame / handlebars (top riders)
  if (kind === 'bike') {
    ctx.strokeStyle = L.bodyDark;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(-0.72, 0.5); ctx.lineTo(-0.3, 1.0); ctx.moveTo(-0.72, 0.5); ctx.lineTo(0.1, 0.92);
    ctx.moveTo(0.72, 0.5); ctx.lineTo(0.78, 1.3);
    ctx.stroke();
    ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(0.7, 0.55); ctx.lineTo(0.76, 1.25); ctx.stroke();
    // engine block
    ctx.fillStyle = '#5b616d';
    ctx.fillRect(-0.3, 0.6, 0.5, 0.36);
    ctx.lineWidth = lw * 0.7; ctx.strokeStyle = OUTLINE; ctx.strokeRect(-0.3, 0.6, 0.5, 0.36);
    ctx.fillStyle = '#2a2c33'; ctx.fillRect(-0.55, 0.82, 0.3, 0.14);
  }
  if (A.bars) {
    const [[bx, byy], [gx, gy]] = A.bars;
    ctx.strokeStyle = '#1a1c20';
    ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(gx, gy); ctx.moveTo(gx - 0.18, gy - 0.02); ctx.lineTo(gx + 0.12, gy + 0.02); ctx.stroke();
    ctx.fillStyle = L.stripe;
    ctx.fillRect(gx - 0.2, gy - 0.05, 0.12, 0.08);
    if (kind === 'bike') { ctx.fillStyle = L.body; ctx.fillRect(gx - 0.1, gy - 0.1, 0.35, 0.16); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = OUTLINE; ctx.strokeRect(gx - 0.1, gy - 0.1, 0.35, 0.16); }
  }

  // wheels + fenders
  const hub = L.stripe;
  for (let i = 0; i < 2; i++) drawWheel(ctx, { x: wheels[i].x, y: wheels[i].y, r: V.wheels[i].r * wr }, wheels[i].a || 0, lw, hub, V.wheels[i].r * wr > 0.5);
  ctx.strokeStyle = '#1f2226';
  ctx.lineWidth = kind === 'truck' ? 0.2 : 0.15;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 2; i++) {
    const w = V.wheels[i];
    if (kind === 'bike' && i === 0) continue;
    ctx.beginPath();
    ctx.arc(w.x, w.y + 0.02, w.r * wr + 0.08, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  ctx.lineCap = 'round';

  if (topRider && !state.noDriver) {
    const [[, ], [gx, gy]] = A.bars;
    drawTopRider(ctx, L, seatX, seatY, lw, gx - 0.12, gy, kind === 'bike');
  }
  // the flag on the roll cage / rack
  if (L.flag && !state.noFlag) drawFlag(ctx, L.flag, V.flagPost[0], V.flagPost[1], t, lw);
}

// Garage / tile preview on a y-down canvas.
export function drawVehiclePreview(ctx, look, o = {}) {
  const scale = o.scale || 60;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  ctx.scale(scale, -scale);
  drawVehicle(ctx, look, { t: o.t || 0, speed: o.speed || 0, lw: o.lw || 2.2 / scale, nitroOn: !!o.nitroOn, lights: !!o.lights });
  ctx.restore();
}

// The rider figure: thrown clear in a crash (race mode) or a portrait. At the origin, +y up, rotated by the caller.
export function drawRider(ctx, look, lw = 0.05, helmet = true) {
  const L = look && look.key ? look : resolveLook(look);
  const S = L.suit;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(S.body, -0.25);
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-0.22, -0.45); ctx.moveTo(0, 0); ctx.lineTo(0.2, -0.42); // legs
  ctx.moveTo(0, 0.42); ctx.lineTo(-0.3, 0.2); ctx.moveTo(0, 0.42); ctx.lineTo(0.32, 0.6); // arms
  ctx.stroke();
  ctx.fillStyle = '#23242b';
  ctx.beginPath(); ctx.ellipse(-0.24, -0.48, 0.09, 0.05, 0.3, 0, TAU); ctx.ellipse(0.22, -0.45, 0.09, 0.05, -0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = S.body;
  ctx.beginPath();
  ctx.ellipse(0, 0.25, 0.16, 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.save(); ctx.clip(); suitPattern(ctx, S, -0.16, -0.05, 0.32, 0.6); ctx.restore();
  ctx.lineWidth = lw * 0.7;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (helmet) drawHelmet(ctx, L, lw, 0, 0.72);
  else {
    ctx.fillStyle = '#f1c7a1';
    ctx.beginPath(); ctx.arc(0, 0.68, 0.15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.arc(0, 0.74, 0.13, 0.2, Math.PI - 0.2); ctx.fill();
  }
}

export { VEHICLES, VEHICLE_BY_ID, vehicleDef };
