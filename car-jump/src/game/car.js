// Car geometry (precomputed once per run) and the procedural car renderer.
// Data polygons are in car-local meters, +x forward, +y UP.

import { shade, luminance, mix, withAlpha, mulberry32 } from './util.js';
import { SKIN_BY_ID, STICKER_BY_ID } from '../data/cosmetics.js';

function polyCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper); // counter-clockwise in y-up space
}

// Keep the part of a polygon with y >= yc (Sutherland-Hodgman against one horizontal edge).
function clipAbove(poly, yc) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ina = a[1] >= yc, inb = b[1] >= yc;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (yc - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, yc]);
    }
  }
  return out;
}

// Cosmetics: `equipped` is {skin, sticker} given as ids ('flames', 'star') or as the cosmetics.js
// entries themselves; a per-car map {carId: {skin, sticker}} also works. Returns
// {skin: SKINS entry | null, sticker: STICKERS entry | null}; stock / 'none' / unknown ids -> null.
export function resolveLook(car, equipped) {
  let e = equipped || {};
  if (car && !('skin' in e) && !('sticker' in e) && e[car.id] && typeof e[car.id] === 'object') e = e[car.id];
  const sk = typeof e.skin === 'string' ? SKIN_BY_ID[e.skin] : e.skin;
  const st = typeof e.sticker === 'string' ? STICKER_BY_ID[e.sticker] : e.sticker;
  return {
    skin: sk && (sk.body || sk.accent || sk.decal) ? sk : null,
    sticker: st && st.glyph ? st : null,
  };
}

export function carGeometry(car, look = {}) {
  const { skin, sticker } = resolveLook(car, look);
  const color = (skin && skin.body) || car.color;
  const accent = (skin && skin.accent) || car.accent;
  const body = car.body.map((p) => [p[0], p[1]]);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of body) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const hull = convexHull(body);
  const centroid = polyCentroid(hull);
  const h = maxY - minY;
  const beltY = minY + h * 0.55;
  let win = clipAbove(body, beltY + 0.04);
  let winC = win.length >= 3 ? polyCentroid(win) : [0, maxY - 0.2];
  // inset the window toward its centroid
  win = win.map(([x, y]) => [winC[0] + (x - winC[0]) * 0.8, winC[1] + (y - winC[1]) * 0.72]);
  let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
  for (const [x, y] of win) {
    wMinX = Math.min(wMinX, x); wMaxX = Math.max(wMaxX, x);
    wMinY = Math.min(wMinY, y); wMaxY = Math.max(wMaxY, y);
  }
  // front-most / rear-most vertices for lights
  let front = body[0], rear = body[0];
  for (const p of body) {
    if (p[0] > front[0] || (p[0] === front[0] && p[1] > front[1])) front = p;
    if (p[0] < rear[0] || (p[0] === rear[0] && p[1] > rear[1])) rear = p;
  }
  const dark = luminance(color) < 0.18;
  return {
    body, hull, centroid, minX, maxX, minY, maxY, beltY, win, winC,
    winBox: [wMinX, wMinY, wMaxX, wMaxY],
    headlight: [front[0] - 0.14, front[1] - 0.06],
    taillight: [rear[0] + 0.1, rear[1] - 0.04],
    exhaust: [minX + 0.05, minY + h * 0.18],
    color,
    accent,
    dark,
    colorDark: shade(color, -0.35),
    colorLight: shade(color, 0.25),
    outline: dark ? '#000000' : '#1d1b26',
    wheels: car.wheels.map((w) => ({ ...w })),
    decal: (skin && skin.decal) || null,
    sticker: sticker || null,
    fx: null, // lazily built decal paths / gradients (per canvas context)
  };
}

// ---------- Grand Finale: the body cut into panels ----------
// Sutherland-Hodgman clip of a (possibly concave) polygon to an axis-aligned box.
function clipBox(poly, x0, y0, x1, y1) {
  let p = poly;
  for (const [ax, v, sg] of [[0, x0, 1], [0, x1, -1], [1, y0, 1], [1, y1, -1]]) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const ia = sg * (a[ax] - v) >= 0, ib = sg * (b[ax] - v) >= 0;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[ax]) / (b[ax] - a[ax]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    p = out;
    if (p.length < 3) return [];
  }
  return p;
}
function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return Math.abs(a) / 2;
}
// The chassis as 7 chunky pieces (trunk, door, hood, bumper, roof halves with their glass, engine block), in
// car-local metres. Each: { part, poly (relative to cx, cy), cx, cy, w, h, color, stripe?, glass? }.
// Cached on the geometry; drawn by render.js drawCarPiece.
export function carPieces(g) {
  if (g.pieces) return g.pieces;
  const L = g.maxX - g.minX, h = g.maxY - g.minY;
  const xa = g.minX + 0.3 * L, xb = g.minX + 0.64 * L, xr = g.winC[0];
  const yS = g.minY + 0.28 * h, yB = g.beltY;
  const sy0 = g.minY + h * 0.36, sy1 = sy0 + Math.max(0.09, h * 0.08);
  const cells = [
    ['trunk', g.minX - 1, g.minY - 1, xa, yB, g.color, true],
    ['door', xa, g.minY - 1, xb, yB, g.color, true],
    ['hood', xb, yS, g.maxX + 1, yB, g.color, true],
    ['bumper', xb, g.minY - 1, g.maxX + 1, yS, '#9aa0aa', false],
    ['roof', g.minX - 1, yB, xr, g.maxY + 1, g.color, false],
    ['screen', xr, yB, g.maxX + 1, g.maxY + 1, g.color, false],
  ];
  const out = [];
  for (const [part, x0, y0, x1, y1, color, stripe] of cells) {
    const poly = clipBox(g.body, x0, y0, x1, y1);
    if (poly.length < 3 || polyArea(poly) < 0.06) continue;
    let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
    for (const [x, y] of poly) { px0 = Math.min(px0, x); px1 = Math.max(px1, x); py0 = Math.min(py0, y); py1 = Math.max(py1, y); }
    const cx = (px0 + px1) / 2, cy = (py0 + py1) / 2;
    const rel = (pts) => pts.map(([x, y]) => [x - cx, y - cy]);
    const piece = { part, poly: rel(poly), cx, cy, w: Math.max(0.2, px1 - px0), h: Math.max(0.15, py1 - py0), color, outline: g.outline };
    if (stripe) {
      const st = clipBox(poly, x0, sy0, x1, sy1);
      if (st.length >= 3) piece.stripe = { poly: rel(st), color: g.accent };
    }
    if (part === 'roof' || part === 'screen') {
      const gl = clipBox(g.win, x0, y0, x1, y1);
      if (gl.length >= 3 && polyArea(gl) > 0.02) piece.glass = rel(gl);
    }
    out.push(piece);
  }
  // and the engine block from inside, a dark chunky slab
  const ew = Math.min(0.9, L * 0.2), eh = Math.min(0.5, h * 0.4);
  const ecx = g.minX + 0.72 * L, ecy = g.minY + h * 0.45;
  out.push({ part: 'engine', poly: [[-ew / 2, -eh / 2], [ew / 2, -eh / 2], [ew / 2, eh / 2 - 0.08], [ew / 2 - 0.12, eh / 2], [-ew / 2, eh / 2]],
    cx: ecx, cy: ecy, w: ew, h: eh, color: '#4a4752', outline: g.outline, stripe: { poly: [[-ew / 2 + 0.08, eh / 2 - 0.16], [ew / 2 - 0.1, eh / 2 - 0.16], [ew / 2 - 0.1, eh / 2 - 0.08], [-ew / 2 + 0.08, eh / 2 - 0.08]], color: '#8a8f9c' } });
  g.pieces = out;
  return out;
}

function pathPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// Draw the chassis in its local frame. Caller sets transform so that data coords map to world.
// lw = outline width in world units.
export function drawChassis(ctx, g, lw, t, nitroOn, lost = null) {
  // nitro flame (behind body)
  if (nitroOn) {
    const [ex, ey] = g.exhaust;
    const f = 0.85 + 0.35 * Math.sin(t * 61) + 0.2 * Math.sin(t * 37);
    const len = 1.5 * f;
    ctx.beginPath();
    ctx.moveTo(ex + 0.1, ey + 0.3);
    ctx.quadraticCurveTo(ex - len * 0.6, ey + 0.35, ex - len, ey);
    ctx.quadraticCurveTo(ex - len * 0.6, ey - 0.35, ex + 0.1, ey - 0.3);
    ctx.closePath();
    ctx.fillStyle = '#ff6a1a';
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = '#7a1d00';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + 0.05, ey + 0.17);
    ctx.quadraticCurveTo(ex - len * 0.4, ey + 0.18, ex - len * 0.62, ey);
    ctx.quadraticCurveTo(ex - len * 0.4, ey - 0.18, ex + 0.05, ey - 0.17);
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ex - 0.08, ey, 0.22, 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9fe8ff';
    ctx.fill();
  }

  // light rim so dark cars read on night skies
  if (g.rim) {
    pathPoly(ctx, g.body);
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 3.2;
    ctx.strokeStyle = g.rim;
    ctx.stroke();
  }
  // body base
  pathPoly(ctx, g.body);
  ctx.fillStyle = g.color;
  ctx.fill();

  ctx.save();
  pathPoly(ctx, g.body);
  ctx.clip();
  const h = g.maxY - g.minY;
  if (g.decal) drawDecal(ctx, g, lw);
  // flat shading: darker underside, lighter roof band
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(g.minX - 1, g.minY - 1, g.maxX - g.minX + 2, 1 + h * 0.3);
  ctx.fillStyle = g.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.22)';
  ctx.fillRect(g.minX - 1, g.beltY - 0.02, g.maxX - g.minX + 2, 0.12);
  // accent stripe (a skin's decal replaces it)
  if (!g.decal) {
    ctx.fillStyle = g.accent;
    ctx.fillRect(g.minX - 1, g.minY + h * 0.36, g.maxX - g.minX + 2, Math.max(0.09, h * 0.08));
  }
  // door seam
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = lw * 0.6;
  const dx = (g.winBox[0] + g.winBox[2]) * 0.5;
  ctx.beginPath();
  ctx.moveTo(dx, g.beltY);
  ctx.lineTo(dx + 0.05, g.minY + h * 0.12);
  ctx.stroke();
  if (g.sticker) drawSticker(ctx, g, lw);
  // v2 damage: missing door panel / bumper show the dark shell underneath
  if (lost) {
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#111';
    if (lost.door) {
      const x0 = g.winBox[0] + 0.05, x1 = dx;
      ctx.fillStyle = '#3a3640';
      ctx.beginPath();
      ctx.moveTo(x0, g.beltY - 0.02); ctx.lineTo(x1, g.beltY - 0.02); ctx.lineTo(x1 + 0.04, g.minY + h * 0.14);
      ctx.lineTo(x0 + 0.12, g.minY + h * 0.1); ctx.lineTo(x0 - 0.04, g.minY + h * 0.3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5c5662';
      ctx.fillRect(x0 + 0.1, g.minY + h * 0.3, x1 - x0 - 0.2, 0.06);
    }
    if (lost.bumper) {
      ctx.fillStyle = '#2b2830';
      ctx.beginPath();
      ctx.moveTo(g.maxX + 0.1, g.minY - 0.1); ctx.lineTo(g.maxX - 0.75, g.minY - 0.1); ctx.lineTo(g.maxX - 0.6, g.minY + 0.14);
      ctx.lineTo(g.maxX - 0.35, g.minY + 0.08); ctx.lineTo(g.maxX - 0.15, g.minY + 0.22); ctx.lineTo(g.maxX + 0.1, g.minY + 0.18);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();

  // window + driver
  if (g.win.length >= 3) {
    ctx.save();
    pathPoly(ctx, g.win);
    ctx.fillStyle = '#bfe9ff';
    ctx.fill();
    ctx.clip();
    const [wx0, wy0, wx1, wy1] = g.winBox;
    const ww = wx1 - wx0, wh = wy1 - wy0;
    const hr = Math.min(0.2, wh * 0.36, ww * 0.18);
    const hx = g.winC[0] - ww * 0.05;
    const hy = wy0 + wh * 0.42;
    // shoulders
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.ellipse(hx - hr * 0.2, wy0, hr * 1.5, hr * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    // helmet
    ctx.beginPath();
    ctx.arc(hx, hy + hr * 0.4, hr, 0, Math.PI * 2);
    ctx.fillStyle = g.accent;
    ctx.fill();
    ctx.fillStyle = '#20202a';
    ctx.fillRect(hx + hr * 0.15, hy + hr * 0.25, hr * 0.9, hr * 0.42);
    // glass shine
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(wx0 + ww * 0.55, wy1 + 0.1);
    ctx.lineTo(wx0 + ww * 0.72, wy1 + 0.1);
    ctx.lineTo(wx0 + ww * 0.45, wy0 - 0.1);
    ctx.lineTo(wx0 + ww * 0.28, wy0 - 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    pathPoly(ctx, g.win);
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = g.outline;
    ctx.stroke();
  }

  // lights
  ctx.fillStyle = '#fff6a8';
  ctx.beginPath();
  ctx.ellipse(g.headlight[0], g.headlight[1], 0.13, 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = g.outline;
  ctx.stroke();
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(g.taillight[0] - 0.06, g.taillight[1] - 0.08, 0.12, 0.16);

  // outline
  pathPoly(ctx, g.body);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = g.outline;
  ctx.stroke();
  if (g.decal === 'crown') drawRoofEmblem(ctx, g, lw);
}

// Wheel at origin, rotation handled by caller. r in meters.
export function drawWheel(ctx, r, lw, accent, noHub = false) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#23222b';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#0c0c10';
  ctx.stroke();
  // tread hint
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx.strokeStyle = '#3a3946';
  ctx.lineWidth = lw * 0.5;
  ctx.stroke();
  if (noHub) {
    // hubcap knocked off: bare dark rim and lug nuts
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#4a4752';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#2a2830';
    ctx.stroke();
    ctx.fillStyle = '#8a8f9c';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * r * 0.24 - 0.03, Math.sin(a) * r * 0.24 - 0.03, 0.06, 0.06);
    }
    return;
  }
  // hub
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = '#d7dbe3';
  ctx.fill();
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = '#555a66';
  ctx.stroke();
  // spokes
  ctx.strokeStyle = accent;
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
    ctx.lineTo(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#555a66';
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------
// Cosmetics: skin decals, door sticker, roof emblem. Everything is drawn in car-local meters
// (+y up) inside the caller's transform. Paths are built once per geometry object and gradients
// once per (geometry, canvas context), so a frame costs only a handful of fill() calls.

const RAINBOW = ['#ff9f1a', '#ffe14a', '#3ddc84', '#22d3ff', '#8f6bff'];

// Decal frame: the painted lower body (below the window belt) plus the wheel stations.
function decalFrame(g) {
  const ws = g.wheels.slice().sort((a, b) => a.x - b.x);
  const rear = ws[0], front = ws[ws.length - 1];
  const h = g.maxY - g.minY, L = g.maxX - g.minX;
  return { h, L, rear, front, y0: g.minY + h * 0.1, y1: g.beltY - 0.02 };
}

function star(p, cx, cy, ro, ri, rot = -Math.PI / 2) {
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
    if (i) p.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); else p.moveTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r);
  }
  p.closePath();
}

function blob(p, rand, cx, cy, r) {
  const n = 7, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.4;
    const rr = r * (0.65 + rand() * 0.55);
    pts.push([cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr]);
  }
  const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  p.closePath();
}

// Flame tongues licking forward from the rear wheel arch. k scales the tongue lengths (inner flame).
function flamePath(g, f, k, inset) {
  const p = new Path2D();
  const xb = f.rear.x - f.rear.r * 0.6;
  const y0 = f.y0 + inset, y1 = f.y1 + f.h * 0.04 - inset;
  const lens = [0.3, 0.42, 0.27].map((v) => v * f.L * k);
  const n = lens.length, tw = (y1 - y0) / n;
  const xRear = g.minX - 0.5;
  p.moveTo(xRear, y0);
  p.lineTo(xb, y0);
  for (let i = 0; i < n; i++) {
    const len = lens[i], yb = y0 + i * tw, yt = yb + tw;
    const tipX = xb + len, tipY = yb + tw * 1.05;   // tips flick upward
    p.bezierCurveTo(xb + len * 0.45, yb - tw * 0.35, xb + len * 0.8, yb + tw * 0.1, tipX, tipY);
    const nl = i + 1 < n ? Math.min(len, lens[i + 1]) * 0.35 : 0;
    p.bezierCurveTo(xb + len * 0.75, yt - tw * 0.05, xb + len * 0.5, yt + tw * 0.25, xb + nl, yt);
  }
  p.lineTo(xRear, y1);
  p.closePath();
  return p;
}

// Returns a list of draw ops: {path, fill, stroke?, lw?} (lw = multiple of the outline width).
function buildDecal(ctx, g) {
  const f = decalFrame(g), ops = [];
  const { h, L } = f;
  const bx = g.minX - 1, bw = L + 2, by = g.minY - 1, bh = h + 2;
  const full = new Path2D(); full.rect(bx, by, bw, bh);
  const vgrad = (stops, yTop = g.maxY, yBot = g.minY) => {
    const gr = ctx.createLinearGradient(0, yTop, 0, yBot);
    for (const [t, c] of stops) gr.addColorStop(t, c);
    return gr;
  };
  switch (g.decal) {
    case 'fade': {
      ops.push({ path: full, fill: vgrad([[0, g.color], [0.3, g.color], [0.85, g.accent], [1, g.accent]]) });
      break;
    }
    case 'stripes': {
      const p = new Path2D(), t = h * 0.12, gap = h * 0.07, ya = f.y0 + h * 0.1;
      p.rect(bx, ya, bw, t); p.rect(bx, ya + t + gap, bw, t);
      ops.push({ path: p, fill: g.accent });
      break;
    }
    case 'flames': {
      ops.push({ path: flamePath(g, f, 1, 0), fill: g.accent, stroke: shade(g.accent, -0.45), lw: 0.7 });
      ops.push({ path: flamePath(g, f, 0.62, h * 0.07), fill: mix(g.accent, '#fff27a', 0.7) });
      break;
    }
    case 'dots': {
      const p = new Path2D(), sp = 0.44, r = 0.13;
      let row = 0;
      for (let y = g.minY + 0.16; y < g.maxY + sp; y += sp * 0.82, row++) {
        for (let x = g.minX + (row % 2 ? sp / 2 : 0) - 0.05; x < g.maxX + sp; x += sp) { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); }
      }
      ops.push({ path: p, fill: g.accent });
      break;
    }
    case 'camo': {
      const rand = mulberry32(1337);
      const a = new Path2D(), b = new Path2D();
      let i = 0;
      for (let y = g.minY + 0.1; y < g.maxY + 0.3; y += 0.42) {
        for (let x = g.minX - 0.1; x < g.maxX + 0.4; x += 0.5, i++) {
          blob(i % 2 ? a : b, rand, x + (rand() - 0.5) * 0.3, y + (rand() - 0.5) * 0.2, 0.17 + rand() * 0.06);
        }
      }
      ops.push({ path: b, fill: mix(g.color, '#c9b26b', 0.6) });
      ops.push({ path: a, fill: g.accent });
      break;
    }
    case 'bolt': {
      // one big Z-shaped bolt laid on its side, pointing forward; u along the length, v up the band
      const pts = [[0, 0.12], [0, 0.48], [0.4, 1.0], [0.35, 0.58], [1, 0.98], [0.31, 0.0], [0.36, 0.42]];
      const x0 = g.minX + L * 0.04, x1 = g.maxX - L * 0.04, ya = g.minY + h * 0.03, yb = g.beltY + h * 0.02;
      const p = new Path2D();
      pts.forEach(([u, v], i) => (i ? p.lineTo : p.moveTo).call(p, x0 + (x1 - x0) * u, ya + (yb - ya) * v));
      p.closePath();
      ops.push({ path: p, fill: g.accent, stroke: shade(g.accent, -0.55), lw: 0.8 });
      break;
    }
    case 'checker': {
      const sq = Math.min(0.26, (f.y1 - f.y0) * 0.42), ya = f.y0 + h * 0.03;
      const p = new Path2D();
      for (let r = 0; r < 2; r++) {
        for (let c = 0, x = g.minX - 0.3; x < g.maxX + 0.3; c++, x += sq) if ((c + r) % 2 === 0) p.rect(x, ya + r * sq, sq, sq);
      }
      const edge = new Path2D();
      edge.rect(bx, ya - sq * 0.28, bw, sq * 0.12);
      edge.rect(bx, ya + 2 * sq + sq * 0.16, bw, sq * 0.12);
      ops.push({ path: p, fill: g.accent });
      ops.push({ path: edge, fill: g.accent });
      break;
    }
    case 'stars': {
      const neb = new Path2D(), core = new Path2D();
      const cx = (g.minX + g.maxX) / 2, cy = (f.y0 + f.y1) / 2 + h * 0.08;
      neb.ellipse(cx, cy, L * 0.42, h * 0.2, 0.2, 0, Math.PI * 2);
      core.ellipse(cx + L * 0.04, cy + h * 0.02, L * 0.26, h * 0.075, 0.2, 0, Math.PI * 2);
      ops.push({ path: neb, fill: withAlphaAny(mix(g.color, '#ff7ad9', 0.55), 0.55) });
      ops.push({ path: core, fill: withAlphaAny(mix(g.color, '#ffffff', 0.55), 0.6) });
      const s = new Path2D();
      const spots = [[0.12, 0.62], [0.3, 0.2], [0.47, 0.75], [0.66, 0.3], [0.84, 0.66], [0.22, 1.05], [0.56, 1.2], [0.92, 0.18]];
      spots.forEach(([u, v], i) => star(s, g.minX + L * u, f.y0 + (f.y1 - f.y0) * v, i % 3 === 1 ? 0.2 : 0.15, i % 3 === 1 ? 0.085 : 0.065));
      ops.push({ path: s, fill: g.accent });
      const d = new Path2D();
      for (const [u, v] of [[0.06, 0.25], [0.2, 0.4], [0.38, 0.5], [0.58, 0.55], [0.76, 0.12], [0.95, 0.45], [0.42, 0.05]]) {
        const x = g.minX + L * u, y = f.y0 + (f.y1 - f.y0) * v; d.moveTo(x + 0.05, y); d.arc(x, y, 0.05, 0, Math.PI * 2);
      }
      ops.push({ path: d, fill: '#ffffff' });
      break;
    }
    case 'shine': {
      ops.push({ path: full, fill: vgrad([[0, shade(g.color, 0.45)], [0.35, g.color], [0.7, g.color], [1, g.accent]]) });
      const p = new Path2D();
      const band = (xc, w) => {
        const sk = h * 0.55;
        p.moveTo(xc - w / 2 + sk, g.maxY + 0.1); p.lineTo(xc + w / 2 + sk, g.maxY + 0.1);
        p.lineTo(xc + w / 2 - sk, g.minY - 0.1); p.lineTo(xc - w / 2 - sk, g.minY - 0.1); p.closePath();
      };
      band(g.minX + L * 0.3, 0.34); band(g.minX + L * 0.42, 0.12); band(g.minX + L * 0.74, 0.22);
      ops.push({ path: p, fill: 'rgba(255,255,255,0.5)' });
      break;
    }
    case 'rainbow': {
      const t = Math.min(0.12, (f.y1 - f.y0) / 5.4), ya = f.y0 + h * 0.03;
      RAINBOW.forEach((c, i) => {
        const p = new Path2D(); p.rect(bx, ya + (RAINBOW.length - 1 - i) * t, bw, t + 0.004);
        ops.push({ path: p, fill: c });
      });
      break;
    }
    case 'crown': {
      ops.push({ path: full, fill: vgrad([[0, '#ffffff'], [0.3, g.color], [0.5, shade(g.color, -0.32)], [0.56, '#f8fbff'],
        [0.78, shade(g.color, -0.12)], [1, shade(g.color, -0.45)]]) });
      break;
    }
    default: break;
  }
  return ops;
}

// rgb()/hex colour + alpha (mix() returns rgb(...))
function withAlphaAny(c, a) {
  if (c[0] === '#') return withAlpha(c, a);
  return c.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `,${a})`);
}

function fxFor(ctx, g) {
  let fx = g.fx;
  if (!fx || fx.ctx !== ctx) fx = g.fx = { ctx, ops: g.decal ? buildDecal(ctx, g) : [], crown: null, sticker: null, stickerLayout: null };
  return fx;
}

// Decal over the base paint. Caller has already clipped to the body polygon.
export function drawDecal(ctx, g, lw) {
  const fx = fxFor(ctx, g);
  for (const op of fx.ops) {
    ctx.fillStyle = op.fill;
    ctx.fill(op.path);
    if (op.stroke) { ctx.lineWidth = lw * op.lw; ctx.strokeStyle = op.stroke; ctx.lineJoin = 'round'; ctx.stroke(op.path); }
  }
}

const EMOJI_RE = /\p{Emoji_Presentation}/u;
const STICKER_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols",system-ui,sans-serif';

// Sticker on the door: between the wheels, halfway up the lower body. Caller has clipped to the body.
export function drawSticker(ctx, g, lw) {
  const st = g.sticker;
  if (!st || !st.glyph) return;
  const fx = fxFor(ctx, g);
  let L = fx.stickerLayout;
  if (!L) {
    const f = decalFrame(g), emoji = EMOJI_RE.test(st.glyph);
    L = fx.stickerLayout = {
      cx: (f.rear.x + f.front.x) / 2, cy: (g.minY + g.beltY) / 2 + f.h * 0.02,
      R: Math.min(f.h * 0.25, (g.beltY - g.minY) * 0.47),
      bg: shade(g.color, g.dark ? 0.16 : -0.24), rim: withAlphaAny(st.color || '#ffffff', 0.85),
      // text glyphs get U+FE0E (text presentation) so they take the sticker colour
      emoji, text: emoji ? st.glyph : st.glyph + '\uFE0E', size: f.h * 0.35 * (emoji ? 1 : 1.15),
    };
  }
  const { cx, cy, R, emoji, text, size } = L;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = L.bg;
  ctx.fill();
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = L.rim;
  ctx.stroke();
  // glyph: drawn at 100 px and scaled into car meters (tiny font sizes rasterise badly)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, -size / 100);
  ctx.font = `${emoji ? 400 : 900} 100px ${STICKER_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let m = fx.sticker;
  if (!m || m.text !== text) {
    const mt = ctx.measureText(text);
    m = fx.sticker = { text, ox: (mt.actualBoundingBoxLeft - mt.actualBoundingBoxRight) / 2, oy: (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2 };
  }
  if (!emoji) {
    ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, m.ox, m.oy);
  }
  ctx.fillStyle = st.color || '#ffffff';
  ctx.fillText(text, m.ox, m.oy);
  ctx.restore();
}

// Crown emblem sitting on the roof (Champion Chrome). Drawn after the outline, unclipped.
export function drawRoofEmblem(ctx, g, lw) {
  const fx = fxFor(ctx, g);
  if (!fx.crown) {
    const top = g.body.slice().sort((a, b) => b[1] - a[1]).slice(0, 2);
    const cx = (top[0][0] + top[1][0]) / 2, by = (top[0][1] + top[1][1]) / 2 - 0.03;
    const w = 0.66, hb = 0.12, hs = 0.42;
    const p = new Path2D();
    p.moveTo(cx - w / 2, by); p.lineTo(cx + w / 2, by); p.lineTo(cx + w / 2, by + hs);
    p.lineTo(cx + w / 4, by + hb + 0.1); p.lineTo(cx, by + hs + 0.06); p.lineTo(cx - w / 4, by + hb + 0.1);
    p.lineTo(cx - w / 2, by + hs); p.closePath();
    const j = new Path2D();
    for (const [x, y] of [[cx - w / 2, by + hs], [cx, by + hs + 0.06], [cx + w / 2, by + hs]]) { j.moveTo(x + 0.065, y); j.arc(x, y, 0.065, 0, Math.PI * 2); }
    const band = new Path2D(); band.rect(cx - w / 2, by + 0.03, w, 0.07);
    fx.crown = { p, j, band };
  }
  const c = fx.crown;
  ctx.fillStyle = g.accent; ctx.fill(c.p);
  ctx.fillStyle = c.bandColor || (c.bandColor = shade(g.accent, -0.3)); ctx.fill(c.band);
  ctx.lineWidth = lw * 0.8; ctx.strokeStyle = g.outline; ctx.lineJoin = 'round'; ctx.stroke(c.p);
  ctx.fillStyle = '#ff3b5c'; ctx.fill(c.j);
  ctx.lineWidth = lw * 0.5; ctx.stroke(c.j);
}
