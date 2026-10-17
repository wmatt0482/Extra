// The Ranger 150: a kid-size side-by-side (UTV). Geometry for the physics + the procedural drawing shared by the
// engine and the garage preview. Vehicle-local meters, +x forward, +y UP, y = 0 at the ground under the wheels.
//
//   drawVehicle(ctx, look, { t, nitroOn, speed, lw, wheels?, lights?, rim? })
//     ctx is already in vehicle-local meters with +y up (the engine's world transform + the chassis pose).
//     look = { paint: id | PAINTS entry, decal: id, helmet?: css colour }.
//     wheels (optional) = [{ x, y, a }] wheel centres in vehicle-local meters + spin angle (rad); default: at
//     rest, spinning with t * speed.
//   drawVehiclePreview(ctx, look, { x, y, scale, t, speed, lw? }) for a y-down canvas (garage, picker tiles):
//     (x, y) = the screen point on the ground under the vehicle's centre, scale = px per meter.

import { TAU, shade, withAlpha, luminance } from './util.js';

const OUTLINE = '#1d1b26';

export const VEHICLE = {
  id: 'ranger150',
  name: 'Ranger 150',
  // painted body (concave: cab cut-out between the hood and the cargo bed)
  body: [
    [-1.36, 0.5], [1.3, 0.5], [1.46, 0.6], [1.44, 0.9], [1.3, 1.02], [0.66, 1.16], [0.56, 1.12],
    [-0.56, 1.12], [-0.6, 1.27], [-1.36, 1.27],
  ],
  // physics hull (convex: the body plus the roll-cage roof, so a rollover lands on the roof)
  hull: [[-1.36, 0.5], [1.3, 0.5], [1.46, 0.6], [1.44, 0.9], [1.3, 1.02], [0.6, 2.06], [-0.66, 2.06], [-1.36, 1.27]],
  wheels: [{ x: -0.95, y: 0.42, r: 0.42 }, { x: 0.95, y: 0.42, r: 0.42 }], // rear, front
  // roll cage tubes [x0, y0, x1, y1]
  cage: [
    [0.66, 1.16, 0.46, 2.0], // A pillar
    [-0.58, 1.12, -0.56, 2.0], // rear hoop
    [-0.62, 2.0, 0.56, 2.0], // roof rail
    [-0.56, 1.9, -1.12, 1.27], // rear brace to the bed
    [0.46, 2.0, 0.98, 1.09], // hood brace
  ],
  roof: { x0: -0.72, x1: 0.64, y0: 1.97, y1: 2.08 },
  door: { x0: -0.5, x1: 0.5, y0: 1.12, y1: 1.46 },
  bed: { x0: -1.36, x1: -0.62, y0: 0.98, y1: 1.27 },
  headlight: [1.4, 0.84],
  taillight: [-1.33, 1.13],
  exhaust: [-1.4, 0.68],
  winchHook: [1.47, 0.62],
  stripe: [0.7, 0.82],
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

// look -> resolved paint/decal + derived colours (cached per look key)
const lookCache = new Map();
export function resolveLook(look = {}) {
  const pid = typeof look.paint === 'string' ? look.paint : look.paint && look.paint.id;
  const paint = (typeof look.paint === 'object' && look.paint && look.paint.body ? look.paint : PAINT_BY_ID[pid]) || PAINT_BY_ID.sage;
  const decal = DECAL_BY_ID[look.decal] ? look.decal : 'none';
  const helmet = look.helmet || (paint.id === 'orange' ? '#ffd23f' : '#ff8a1f');
  const key = paint.id + '|' + paint.body + '|' + decal + '|' + helmet;
  let r = lookCache.get(key);
  if (r) return r;
  const dark = luminance(paint.body) < 0.2;
  r = {
    key, paint, decal, helmet, body: paint.body, stripe: paint.stripe,
    bodyDark: shade(paint.body, -0.3), bodyLight: shade(paint.body, 0.22), dark,
    under: withAlpha('#000000', dark ? 0.3 : 0.22),
  };
  lookCache.set(key, r);
  return r;
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
let badge = null; // the "150" decal, rendered once
function badgeSprite() {
  if (badge !== null) return badge;
  const cv = mkCanvas(132, 64);
  if (!cv) { badge = false; return badge; }
  const c = cv.getContext('2d');
  c.font = '900 50px "Arial Black", "Helvetica Neue", system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 10;
  c.strokeStyle = '#ffffff';
  c.strokeText('150', 66, 34);
  c.fillStyle = '#15161a';
  c.fillText('150', 66, 34);
  badge = cv;
  return badge;
}

// fixed decal layouts (vehicle-local)
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

function drawWheel(ctx, w, a, lw, hub) {
  const r = w.r;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(a);
  // knobs
  ctx.fillStyle = '#17171c';
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    const k = 0.075;
    const x0 = c * (r * 0.9), y0 = s * (r * 0.9);
    ctx.moveTo(x0 - s * k + c * 0.0, y0 + c * k);
    ctx.lineTo(x0 - s * k + c * 0.09, y0 + c * k + s * 0.09);
    ctx.lineTo(x0 + s * k + c * 0.09, y0 - c * k + s * 0.09);
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
    ctx.arc(Math.cos(t) * r * 0.3, Math.sin(t) * r * 0.3, 0.035, 0, TAU);
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

const restWheels = VEHICLE.wheels.map((w) => ({ x: w.x, y: w.y, a: 0 }));

export function drawVehicle(ctx, look, state = {}) {
  const L = look && look.key ? look : resolveLook(look);
  const V = VEHICLE;
  const lw = state.lw || 0.06;
  const t = state.t || 0;
  let wheels = state.wheels;
  if (!wheels) {
    const a = -(t * (state.speed || 0)) / V.wheels[0].r;
    restWheels[0].a = a; restWheels[1].a = a;
    wheels = restWheels;
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // boost flame (behind everything)
  if (state.nitroOn) {
    const [ex, ey] = V.exhaust;
    const f = 0.85 + 0.3 * Math.sin(t * 57) + 0.18 * Math.sin(t * 31);
    const len = 1.35 * f;
    ctx.beginPath();
    ctx.moveTo(ex + 0.1, ey + 0.24);
    ctx.quadraticCurveTo(ex - len * 0.6, ey + 0.3, ex - len, ey);
    ctx.quadraticCurveTo(ex - len * 0.6, ey - 0.3, ex + 0.1, ey - 0.24);
    ctx.closePath();
    ctx.fillStyle = '#ff6a1a';
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = '#7a1d00';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + 0.05, ey + 0.13);
    ctx.quadraticCurveTo(ex - len * 0.4, ey + 0.15, ex - len * 0.6, ey);
    ctx.quadraticCurveTo(ex - len * 0.4, ey - 0.15, ex + 0.05, ey - 0.13);
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.fill();
  }
  if (state.rim) {
    // light rim so the vehicle reads on a night sky
    poly(ctx, V.hull);
    ctx.lineWidth = lw * 2.2;
    ctx.strokeStyle = state.rim;
    ctx.stroke();
  }

  // far-side cage tubes (darker, offset back a little)
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(0.5, 1.16); ctx.lineTo(0.36, 1.98);
  ctx.moveTo(-0.66, 1.14); ctx.lineTo(-0.64, 1.98);
  ctx.stroke();

  // seat + driver
  ctx.fillStyle = '#2a2c33';
  ctx.beginPath();
  ctx.moveTo(-0.46, 1.1); ctx.lineTo(-0.3, 1.1); ctx.lineTo(-0.26, 1.68); ctx.lineTo(-0.42, 1.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3f5a8a';
  ctx.beginPath();
  ctx.moveTo(-0.3, 1.1); ctx.lineTo(0.14, 1.1); ctx.lineTo(0.1, 1.48); ctx.quadraticCurveTo(-0.08, 1.58, -0.26, 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = lw * 0.7;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // arm to the wheel
  ctx.strokeStyle = '#3f5a8a';
  ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.moveTo(-0.02, 1.42); ctx.lineTo(0.3, 1.34); ctx.stroke();
  // steering wheel + column
  ctx.strokeStyle = '#1b1c20';
  ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.moveTo(0.56, 1.14); ctx.lineTo(0.4, 1.34); ctx.stroke();
  ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.ellipse(0.39, 1.36, 0.04, 0.13, -0.5, 0, TAU); ctx.stroke();
  // helmet
  ctx.beginPath();
  ctx.arc(-0.06, 1.7, 0.2, 0, TAU);
  ctx.fillStyle = L.helmet;
  ctx.fill();
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.fillStyle = '#1a1d26';
  ctx.beginPath();
  ctx.moveTo(0.02, 1.77); ctx.lineTo(0.15, 1.75); ctx.quadraticCurveTo(0.17, 1.65, 0.1, 1.6); ctx.lineTo(0.0, 1.63);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-0.16, 1.77, 0.08, 0.05);

  // ---- body ----
  poly(ctx, V.body);
  ctx.fillStyle = L.body;
  ctx.fill();
  ctx.save();
  poly(ctx, V.body);
  ctx.clip();
  if (L.paint.rainbow) {
    const cols = L.paint.rainbow, n = cols.length, y0 = 0.5, h = 0.7 / n;
    for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(-1.5, y0 + (n - 1 - i) * h, 3.1, h + 0.01); }
  }
  // cargo bed (darker inner wall + ribs)
  const B = V.bed;
  ctx.fillStyle = L.bodyDark;
  ctx.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  for (let x = B.x0 + 0.16; x < B.x1 - 0.05; x += 0.18) { ctx.moveTo(x, B.y0 + 0.04); ctx.lineTo(x, B.y1 - 0.02); }
  ctx.stroke();
  // underside shade + top highlight
  ctx.fillStyle = L.under;
  ctx.fillRect(-1.5, 0.45, 3.1, 0.13);
  ctx.fillStyle = L.dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(1.3, 0.99); ctx.lineTo(0.66, 1.13); ctx.lineTo(0.66, 1.07); ctx.lineTo(1.28, 0.94);
  ctx.closePath();
  ctx.fill();
  // decal
  const d = L.decal;
  if (d === 'mud') {
    ctx.fillStyle = 'rgba(92,60,34,0.85)';
    ctx.beginPath();
    for (const [x, y, r] of MUD_BLOBS) { ctx.moveTo(x + r, y); ctx.ellipse(x, y, r * 1.3, r, 0.3, 0, TAU); }
    ctx.fill();
  } else if (d === 'flames') {
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
  } else if (d === 'stars') {
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath();
    for (const [x, y, r] of STARS) starPath(ctx, x, y, r);
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
  }
  // stripe (checkers replace it)
  const [s0, s1] = V.stripe;
  if (d === 'checkers') {
    const cs = 0.09;
    for (let i = 0; i * cs < 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#15161a' : '#ffffff';
        ctx.fillRect(-1.4 + i * cs, s0 - 0.02 + j * cs, cs + 0.005, cs + 0.005);
      }
    }
  } else {
    ctx.fillStyle = L.stripe;
    ctx.fillRect(-1.4, s0, 2.9, s1 - s0);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-1.4, s0, 2.9, 0.018);
  }
  // panel seams
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = lw * 0.5;
  ctx.beginPath();
  ctx.moveTo(0.58, 1.12); ctx.lineTo(0.6, 0.52);
  ctx.moveTo(-0.58, 1.12); ctx.lineTo(-0.6, 0.52);
  ctx.stroke();
  ctx.restore();

  // "150" on the hood side
  const bs = badgeSprite();
  if (bs) {
    ctx.save();
    ctx.translate(0.02, 0.97);
    ctx.scale(1, -1);
    ctx.drawImage(bs, -0.26, -0.125, 0.52, 0.25);
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
  ctx.fillRect(V.taillight[0] - 0.035, V.taillight[1] - 0.07, 0.07, 0.14);
  // bumper / skid plate
  ctx.fillStyle = '#24272c';
  ctx.beginPath();
  ctx.moveTo(1.32, 0.5); ctx.lineTo(1.5, 0.56); ctx.lineTo(1.5, 0.66); ctx.lineTo(1.4, 0.66); ctx.lineTo(1.3, 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-1.42, 0.5, 0.16, 0.14);
  // body outline
  poly(ctx, V.body);
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // mesh door
  const D = V.door;
  ctx.fillStyle = 'rgba(20,22,26,0.18)';
  ctx.fillRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
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
  ctx.strokeStyle = '#1b1d22';
  ctx.lineWidth = 0.06;
  ctx.strokeRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);

  // roll cage (near side) + flat roof
  ctx.strokeStyle = '#1a1c20';
  ctx.lineWidth = 0.085;
  ctx.beginPath();
  for (const c of V.cage) { ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(0.64, 1.2); ctx.lineTo(0.45, 1.96);
  ctx.moveTo(-0.6, 1.16); ctx.lineTo(-0.58, 1.96);
  ctx.stroke();
  const R = V.roof;
  ctx.fillStyle = '#26292f';
  ctx.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
  ctx.fillStyle = L.stripe;
  ctx.fillRect(R.x0 + 0.08, R.y1 - 0.035, R.x1 - R.x0 - 0.16, 0.025);

  // wheels + fenders
  const hub = L.stripe;
  for (let i = 0; i < 2; i++) drawWheel(ctx, { x: wheels[i].x, y: wheels[i].y, r: V.wheels[i].r }, wheels[i].a || 0, lw, hub);
  ctx.strokeStyle = '#1f2226';
  ctx.lineWidth = 0.15;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 2; i++) {
    const w = V.wheels[i];
    ctx.beginPath();
    ctx.arc(w.x, w.y + 0.02, w.r + 0.08, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
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
