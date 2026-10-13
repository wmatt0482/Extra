// Car geometry (precomputed once per run) and the procedural car renderer.
// Data polygons are in car-local meters, +x forward, +y UP.

import { shade, luminance } from './util.js';

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

export function carGeometry(car) {
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
  const dark = luminance(car.color) < 0.18;
  return {
    body, hull, centroid, minX, maxX, minY, maxY, beltY, win, winC,
    winBox: [wMinX, wMinY, wMaxX, wMaxY],
    headlight: [front[0] - 0.14, front[1] - 0.06],
    taillight: [rear[0] + 0.1, rear[1] - 0.04],
    exhaust: [minX + 0.05, minY + h * 0.18],
    color: car.color,
    accent: car.accent,
    dark,
    colorDark: shade(car.color, -0.35),
    colorLight: shade(car.color, 0.25),
    outline: dark ? '#000000' : '#1d1b26',
    wheels: car.wheels.map((w) => ({ ...w })),
  };
}

function pathPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// Draw the chassis in its local frame. Caller sets transform so that data coords map to world.
// lw = outline width in world units.
export function drawChassis(ctx, g, lw, t, nitroOn) {
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
  // flat shading: darker underside, lighter roof band
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(g.minX - 1, g.minY - 1, g.maxX - g.minX + 2, 1 + h * 0.3);
  ctx.fillStyle = g.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.22)';
  ctx.fillRect(g.minX - 1, g.beltY - 0.02, g.maxX - g.minX + 2, 0.12);
  // accent stripe
  ctx.fillStyle = g.accent;
  ctx.fillRect(g.minX - 1, g.minY + h * 0.36, g.maxX - g.minX + 2, Math.max(0.09, h * 0.08));
  // door seam
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = lw * 0.6;
  const dx = (g.winBox[0] + g.winBox[2]) * 0.5;
  ctx.beginPath();
  ctx.moveTo(dx, g.beltY);
  ctx.lineTo(dx + 0.05, g.minY + h * 0.12);
  ctx.stroke();
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
}

// Wheel at origin, rotation handled by caller. r in meters.
export function drawWheel(ctx, r, lw, accent) {
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
