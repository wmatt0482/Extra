// The vehicle preview (garage, title hero, player avatars, podiums): any vehicle, paint and rider gear (v1.5). The engine agent's src/game/vehicle.js
// (`drawVehicle(ctx, look, state)`, `PAINTS`, `DECALS`, `VEHICLE`) is the real art, shared with the ride; it is loaded
// with a guarded dynamic import, and until it exists (or if it throws) drawRanger() below draws a simpler Ranger:
// sage-green body, black roll cage, orange stripe + "150", knobby tires, cargo bed, mesh door.
// look: { paint: paint id (src/data/paints.js) | color: '#hex' (a player's color), decal: decal id }.
import { PAINT_BY_ID } from '../data/paints.js';

let vehicleMod = null, vehicleTried = null;
/** Resolves the engine's vehicle module (or null). Called once at boot; previews redraw when it arrives. */
export function loadVehicle() {
  if (!vehicleTried) {
    vehicleTried = import('../game/vehicle.js')
      .then((m) => { vehicleMod = m && typeof m.drawVehicle === 'function' ? m : null; return vehicleMod; })
      .catch(() => { vehicleMod = null; return null; });
  }
  return vehicleTried;
}
export const vehicleModule = () => vehicleMod;
let realFailed = false;

const shade = (hex, f) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

/** Draws the fallback Ranger with its wheels' bottom at (0, 0), facing right, `width` px wide. */
export function drawRanger(ctx, look = {}, { width = 160, t = 0, speed = 0 } = {}) {
  const p = PAINT_BY_ID[look.paint] || null;
  const body = look.color || (p ? p.body : '#6d8a5a');
  const trim = look.color ? shade(look.color, 0.62) : p ? p.trim : '#4f6a40';
  const s = width / 200;
  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // roll cage (behind the body)
  ctx.strokeStyle = '#111416'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-34, -66); ctx.lineTo(-30, -122); ctx.lineTo(30, -122); ctx.lineTo(54, -66); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-30, -122); ctx.lineTo(10, -70); ctx.moveTo(-32, -96); ctx.lineTo(42, -96); ctx.stroke();
  // seat
  ctx.fillStyle = '#2a2f33';
  ctx.beginPath(); ctx.moveTo(-26, -70); ctx.lineTo(-24, -104); ctx.lineTo(-14, -104); ctx.lineTo(-10, -72); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-98, -40); ctx.lineTo(-98, -72); ctx.lineTo(-38, -72); ctx.lineTo(-32, -62); ctx.lineTo(46, -62); ctx.lineTo(80, -68); ctx.lineTo(98, -56); ctx.lineTo(98, -40); ctx.closePath();
  ctx.fill();
  // cargo bed rim + tailgate
  ctx.fillStyle = trim; ctx.fillRect(-98, -76, 62, 7); ctx.fillRect(-100, -74, 6, 34);
  // orange stripe + "150"
  ctx.fillStyle = '#ff8a1f'; ctx.fillRect(-98, -58, 196, 6);
  // decals
  const decal = look.decal || 'none';
  if (decal === 'mud') {
    ctx.fillStyle = 'rgba(107,70,38,.85)';
    for (const [x, y, r] of [[-70, -47, 6], [-56, -44, 4], [-20, -46, 5], [64, -46, 6], [78, -50, 3.5], [8, -44, 3]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  } else if (decal === 'flames') {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(96, -44); ctx.lineTo(40, -50); ctx.lineTo(54, -44); ctx.lineTo(20, -46); ctx.lineTo(36, -40); ctx.lineTo(96, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e2453c';
    ctx.beginPath(); ctx.moveTo(96, -42); ctx.lineTo(56, -46); ctx.lineTo(66, -41); ctx.lineTo(96, -40); ctx.closePath(); ctx.fill();
  } else if (decal === 'stars') {
    ctx.fillStyle = '#ffd23a';
    for (const [x, y, r] of [[-72, -47, 6], [-50, -45, 4], [62, -47, 6], [80, -45, 4]]) star(ctx, x, y, r);
  } else if (decal === 'checkers') {
    for (let i = 0; i < 24; i++) { ctx.fillStyle = (i % 2) ? '#111' : '#fff'; ctx.fillRect(-96 + i * 8, -46 + ((i % 2) ? 0 : 0), 8, 6); }
  }
  ctx.fillStyle = '#fff'; ctx.font = '900 15px "Arial Black", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('150', 64, -44);
  // mesh door
  ctx.strokeStyle = '#111416'; ctx.lineWidth = 3;
  ctx.strokeRect(-26, -90, 52, 28);
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(17,20,22,.8)';
  ctx.beginPath();
  for (let x = -22; x < 26; x += 6) { ctx.moveTo(x, -90); ctx.lineTo(x + 4, -62); }
  for (let y = -84; y < -62; y += 6) { ctx.moveTo(-26, y); ctx.lineTo(26, y); }
  ctx.stroke();
  // lights + skid plate
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(90, -62, 8, 6);
  ctx.fillStyle = '#e2453c'; ctx.fillRect(-100, -70, 4, 8);
  ctx.fillStyle = '#1b1f22'; ctx.fillRect(-90, -42, 180, 6);
  // fenders (wheel arches)
  ctx.fillStyle = '#111416';
  for (const wx of [-58, 62]) { ctx.beginPath(); ctx.arc(wx, -26, 33, Math.PI, 0); ctx.fill(); }
  // knobby tires
  const spin = t * (2 + speed / 6);
  for (const wx of [-58, 62]) {
    ctx.save(); ctx.translate(wx, -26); ctx.rotate(spin);
    ctx.fillStyle = '#16191b'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(-4, -29, 8, 6); }
    ctx.fillStyle = '#3a4045'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa3a8'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a4045'; for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.arc(0, -6, 1.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

const boundsCache = new Map();
/** The vehicle's drawn box in vehicle-local meters (hull + wheels, and the flag when it has one). */
function boundsOf(real, look) {
  const key = `${look.vehicle || ''}|${look.flag && look.flag !== 'none' ? 1 : 0}`;
  if (boundsCache.has(key)) return boundsCache.get(key);
  let b = real.VEHICLE ? { minX: real.VEHICLE.minX, maxX: real.VEHICLE.maxX, maxY: real.VEHICLE.maxY } : { minX: -1.36, maxX: 1.47, maxY: 2.08 };
  const def = look.vehicle && typeof real.vehicleDef === 'function' ? real.vehicleDef(look.vehicle) : null;
  if (def && Array.isArray(def.hull) && def.hull.length) {
    const xs = def.hull.map((p) => p[0]), ys = def.hull.map((p) => p[1]);
    for (const w of def.wheels || []) { xs.push(w.x - w.r, w.x + w.r); ys.push(w.y + w.r); }
    if (Array.isArray(def.seat)) ys.push(def.seat[1] + 0.95);   // the rider's helmet on the open vehicles
    b = { minX: Math.min(...xs), maxX: Math.max(...xs), maxY: Math.max(...ys) + 0.1 };
  }
  if (look.flag && look.flag !== 'none') {
    const fp = (def && def.flagPost) || [-0.58, 2.0];
    b = { ...b, minX: Math.min(b.minX, fp[0] - 0.7), maxY: Math.max(b.maxY, fp[1] + 0.75) };
  }
  boundsCache.set(key, b);
  return b;
}
/** A paint for the engine: its own id when the engine draws it, else the app's colours as an object. */
export function enginePaint(id) {
  const m = vehicleMod;
  if (m && m.PAINT_BY_ID && m.PAINT_BY_ID[id]) return id;
  const p = PAINT_BY_ID[id];
  return p ? { id: p.id, name: p.name, body: p.body, stripe: p.trim } : id;
}
/** The player's whole look (vehicle, paint, decal and the rider gear) from the save. */
export function playerLook(save) {
  const eq = (save.cosmetics && save.cosmetics.equipped) || {};
  return { vehicle: save.vehicle, paint: save.paint, decal: save.decal, helmet: eq.helmet, suit: eq.suit, flag: eq.flag && eq.flag !== 'none' ? eq.flag : null, trail: eq.trail };
}

/** Draw the Ranger into a canvas, centered, sized to fit. opts: { t, bob, floor (ground line + shadow), dx, alpha } */
export function drawPreview(canvas, look = {}, { t = 0, bob = 0, floor = true, dx = 0, alpha = 1 } = {}) {
  const r = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const width = Math.min(W * 0.9, (H * (floor ? 0.84 : 0.94)) / 0.62);
  const gy = floor ? H * 0.9 : H - 1;
  ctx.globalAlpha = alpha;
  if (floor) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(W / 2 + dx, gy, width * 0.5, width * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(W / 2 + dx, gy + bob);
  const real = vehicleMod && !realFailed && typeof vehicleMod.drawVehiclePreview === 'function' ? vehicleMod : null;
  let drawn = false;
  if (real) {
    // the engine's art: vehicle-local meters, (0, 0) = the ground under its centre; sized to the vehicle's own box
    const V = boundsOf(real, look);
    const scale = Math.min((W * 0.9) / (V.maxX - V.minX + 0.1), (H * (floor ? 0.84 : 0.94)) / (V.maxY + 0.05));
    const paint = look.color ? { id: 'player', body: look.color, stripe: '#ff8a1f' } : enginePaint(look.paint);
    try {
      real.drawVehiclePreview(ctx, { ...look, paint, decal: look.decal }, { x: -((V.maxX + V.minX) / 2) * scale, y: 0, scale, t, speed: 0 });
      drawn = true;
    } catch (e) { realFailed = true; console.warn('[vehiclePreview] drawVehiclePreview failed, using the built-in Ranger', e); }
  }
  if (!drawn) drawRanger(ctx, look, { width, t });
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** A player's avatar: the Ranger painted in the player's color. */
export function drawAvatar(canvas, color) {
  requestAnimationFrame(() => drawPreview(canvas, { color }, { floor: false }));
}
