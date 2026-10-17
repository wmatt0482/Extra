// Trail Blazer canvas renderer: bright flat cartoon style with bold outlines (the Spell Jump house style).
// World coordinates are meters with +y UP; the camera maps them to CSS pixels. Backdrop layers are rendered
// once per run into bitmaps and scrolled (cheap on software-rasterised canvases); text is drawn from cached
// sprites; nothing in the per-frame paths allocates more than a few small objects.

import { TAU, mulberry32, clamp, mix, shade, withAlpha, luminance, hash2 } from './util.js';
import { OBSTACLE_KINDS, SURFACES } from '../data/trails.js';
import { KICK } from './course.js';

export const OUT = '#1d1b26';
const FONT = '900 {S}px "Arial Black", "Helvetica Neue", system-ui, -apple-system, sans-serif';
const font = (s) => FONT.replace('{S}', Math.round(s));

// ---------- text sprites ----------
const sprites = new Map();
let probe = null;
function mkCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
}
function textSprite(text, fill, px, lw) {
  const key = px + '|' + lw + '|' + fill + '|' + text;
  let sp = sprites.get(key);
  if (sp) return sp;
  if (sprites.size > 200) sprites.clear();
  if (!probe) probe = mkCanvas(4, 4).getContext('2d');
  probe.font = font(px);
  const w = Math.ceil(probe.measureText(text).width + lw * 2 + 8), h = Math.ceil(px * 1.35 + lw * 2 + 4);
  const cv = mkCanvas(w, h);
  const c = cv.getContext('2d');
  c.font = font(px);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (lw > 0) { c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = OUT; c.strokeText(text, w / 2, h / 2); }
  c.fillStyle = fill;
  c.fillText(text, w / 2, h / 2);
  sp = { cv, w, h, px };
  sprites.set(key, sp);
  return sp;
}
// draw `text` centred at (x, y), font size `size` in current units; y-up world callers flip first
export function spriteText(ctx, text, size, x, y, fill, outline = true) {
  const PX = 64, k = size / PX;
  const sp = textSprite(text, fill, PX, outline ? 12 : 0);
  ctx.drawImage(sp.cv, x - (sp.w * k) / 2, y - (sp.h * k) / 2, sp.w * k, sp.h * k);
}
function worldText(ctx, text, size, x, y, fill, outline = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, -1);
  spriteText(ctx, text, size, 0, 0, fill, outline);
  ctx.restore();
}

// ---------- backdrop ----------
const LAYER_P = 1600, LAYER_H = 300, LAYER_RS = 2; // period (css px), height, render scale

export function createBackdrop(trail, seed) {
  const theme = trail.theme;
  const style = trail.style || 'forest';
  const night = !!theme.night || luminance(theme.sky[0]) < 0.2;
  const rand = mulberry32((seed * 31 + 7) >>> 0);
  const clouds = [];
  for (let i = 0; i < 6; i++) clouds.push({ x: rand() * 2400, y: 0.06 + rand() * 0.24, s: 0.55 + rand() * 0.7, k: 0.02 + rand() * 0.04 });
  const stars = [];
  for (let i = 0; i < 110; i++) stars.push({ x: rand(), y: rand() * 0.7, s: 0.6 + rand() * 1.7, p: rand() * TAU });
  const flakes = [];
  if (style === 'snow') for (let i = 0; i < 70; i++) flakes.push({ x: rand(), y: rand(), s: 1.2 + rand() * 2.6, v: 0.05 + rand() * 0.09, w: rand() * TAU });
  const flies = [];
  if (style === 'night') for (let i = 0; i < 26; i++) flies.push({ x: rand(), y: 0.45 + rand() * 0.45, p: rand() * TAU, s: 1.5 + rand() * 1.8 });
  return {
    style, night, theme, seed, clouds, stars, flakes, flies, layers: null,
    planet: theme.planet || (night ? 'moon' : 'sun'),
    tuft: shade(theme.ground, -0.18), lip: shade(theme.trail || theme.ground, 0.25), grassLine: shade(theme.ground, -0.25),
    dust: shade(theme.trail || theme.ground, style === 'snow' ? 0.3 : 0.12),
    farLine: mix(theme.far, '#05081a', 0.3), midLine: mix(theme.mid, '#05081a', 0.35),
    haze: withAlpha(theme.sky[1], 0.28),
    water: night ? '#2a4f8a' : style === 'desert' ? '#58a8c8' : '#3d9be0',
  };
}

// pine silhouette in canvas px (y down), base at (x, y)
function pinePath(c, x, y, w, h) {
  c.moveTo(x - w * 0.08, y);
  c.lineTo(x - w * 0.08, y - h * 0.12);
  c.lineTo(x - w * 0.5, y - h * 0.12);
  c.lineTo(x - w * 0.22, y - h * 0.42);
  c.lineTo(x - w * 0.4, y - h * 0.42);
  c.lineTo(x - w * 0.14, y - h * 0.7);
  c.lineTo(x - w * 0.28, y - h * 0.7);
  c.lineTo(x, y - h);
  c.lineTo(x + w * 0.28, y - h * 0.7);
  c.lineTo(x + w * 0.14, y - h * 0.7);
  c.lineTo(x + w * 0.4, y - h * 0.42);
  c.lineTo(x + w * 0.22, y - h * 0.42);
  c.lineTo(x + w * 0.5, y - h * 0.12);
  c.lineTo(x + w * 0.08, y - h * 0.12);
  c.lineTo(x + w * 0.08, y);
  c.closePath();
}
function rollingHills(c, P, H, base, amp, rand, fill, line) {
  const n1 = 2 + Math.floor(rand() * 3), n2 = 5 + Math.floor(rand() * 4), p1 = rand() * TAU, p2 = rand() * TAU;
  c.beginPath();
  c.moveTo(0, H + 2);
  for (let x = 0; x <= P; x += 8) {
    const u = x / P;
    c.lineTo(x, base - amp * (0.6 + 0.3 * Math.sin(u * TAU * n1 + p1) + 0.12 * Math.sin(u * TAU * n2 + p2)));
  }
  c.lineTo(P, H + 2);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
}

function buildLayer(bd, which) {
  const P = LAYER_P, H = LAYER_H, rs = LAYER_RS;
  const cv = mkCanvas(P * rs, H * rs);
  const c = cv.getContext('2d');
  c.scale(rs, rs);
  c.lineJoin = 'round';
  const th = bd.theme, st = bd.style;
  const rand = mulberry32(hash2(bd.seed, which === 'far' ? 11 : 23));
  const far = which === 'far';
  const fill = far ? th.far : th.mid, line = far ? bd.farLine : bd.midLine;
  const base = H; // ground line at the bottom of the layer
  // draw a periodic set: shapes near the edges are drawn twice (shifted by P) so the strip tiles seamlessly
  const twice = (fn) => { fn(0); fn(-P); fn(P); };
  if (st === 'lake' && !far) {
    // the near shore: a low bank with reeds and a few pines (the lake stays in view)
    rollingHills(c, P, H, base, 22, rand, fill, line);
    c.fillStyle = shade(fill, -0.06); c.strokeStyle = line; c.lineWidth = 3;
    for (let i = 0; i < 7; i++) { const x = (i + rand() * 0.7) * (P / 7), w = 46 + rand() * 24, h = 90 + rand() * 60; twice((o) => { c.beginPath(); pinePath(c, x + o, base - 12, w, h); c.fill(); c.stroke(); }); }
    c.strokeStyle = '#2f6a35'; c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < 60; i++) { const x = rand() * P, hh = 14 + rand() * 16; c.moveTo(x, base - 20); c.lineTo(x + 3, base - 20 - hh); }
    c.stroke();
  } else if (st === 'forest' || st === 'lake' || st === 'night') {
    rollingHills(c, P, H, base, far ? 90 : 46, rand, fill, line);
    const n = far ? 70 : 26;
    const trees = [];
    for (let i = 0; i < n; i++) trees.push({ x: (i + rand() * 0.8) * (P / n), w: (far ? 26 : 50) + rand() * (far ? 16 : 30), h: (far ? 60 : 110) + rand() * (far ? 50 : 80) });
    c.fillStyle = far ? shade(fill, -0.08) : shade(fill, -0.06);
    c.strokeStyle = line; c.lineWidth = far ? 2 : 3;
    for (const t of trees) twice((o) => { c.beginPath(); pinePath(c, t.x + o, base - (far ? 40 : 18) - rand() * 6, t.w, t.h); c.fill(); c.stroke(); });
    if (st === 'night') {
      c.fillStyle = 'rgba(255,230,140,0.0)';
    }
  } else if (st === 'granite') {
    if (far) {
      // granite domes: a rounded dome with a sheer face, streaks
      rollingHills(c, P, H, base, 40, rand, shade(fill, -0.05), line);
      for (let i = 0; i < 6; i++) {
        const x = (i + rand() * 0.6) * (P / 6), w = 200 + rand() * 160, h = 120 + rand() * 120;
        twice((o) => {
          c.beginPath();
          c.moveTo(x + o - w / 2, base);
          c.bezierCurveTo(x + o - w / 2, base - h * 1.05, x + o + w * 0.2, base - h * 1.15, x + o + w * 0.28, base - h * 0.7);
          c.lineTo(x + o + w * 0.3, base);
          c.closePath();
          c.fillStyle = shade(fill, 0.06 * (i % 2)); c.fill();
          c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
          c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 3;
          c.beginPath();
          for (let k = 0; k < 4; k++) { const sx = x + o - w * 0.3 + k * w * 0.14; c.moveTo(sx, base - h * (0.75 - k * 0.08)); c.lineTo(sx + 8, base - 10); }
          c.stroke();
        });
      }
    } else {
      rollingHills(c, P, H, base, 30, rand, fill, line);
      for (let i = 0; i < 16; i++) {
        const x = (i + rand()) * (P / 16), w = 40 + rand() * 70, h = 26 + rand() * 40;
        twice((o) => {
          c.beginPath();
          c.ellipse(x + o, base - 26, w / 2, h, 0, Math.PI, TAU);
          c.closePath();
          c.fillStyle = shade(fill, (i % 3) * 0.05); c.fill();
          c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
        });
      }
      c.fillStyle = shade('#3c7a4c', -0.1); c.strokeStyle = '#1d3a26'; c.lineWidth = 2.5;
      for (let i = 0; i < 9; i++) { const x = rand() * P, w = 40 + rand() * 20, h = 90 + rand() * 60; twice((o) => { c.beginPath(); pinePath(c, x + o, base - 22, w, h); c.fill(); c.stroke(); }); }
    }
  } else if (st === 'snow') {
    if (far) {
      for (let i = 0; i < 9; i++) {
        const x = (i + rand() * 0.6) * (P / 9), w = 260 + rand() * 220, h = 140 + rand() * 130;
        twice((o) => {
          c.beginPath();
          c.moveTo(x + o - w / 2, base); c.lineTo(x + o, base - h); c.lineTo(x + o + w / 2, base); c.closePath();
          c.fillStyle = shade(fill, (i % 2) * -0.06); c.fill();
          c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
          c.beginPath();
          c.moveTo(x + o, base - h);
          c.lineTo(x + o - w * 0.17, base - h * 0.66); c.lineTo(x + o - w * 0.06, base - h * 0.72);
          c.lineTo(x + o + w * 0.02, base - h * 0.62); c.lineTo(x + o + w * 0.17, base - h * 0.66);
          c.closePath();
          c.fillStyle = '#ffffff'; c.fill(); c.stroke();
        });
      }
    } else {
      rollingHills(c, P, H, base, 40, rand, '#e9f0fa', line);
      for (let i = 0; i < 22; i++) {
        const x = (i + rand() * 0.8) * (P / 22), w = 44 + rand() * 26, h = 90 + rand() * 70;
        twice((o) => {
          c.beginPath(); pinePath(c, x + o, base - 20, w, h);
          c.fillStyle = '#4f7d68'; c.fill(); c.strokeStyle = '#25443a'; c.lineWidth = 2.5; c.stroke();
          c.beginPath();
          c.moveTo(x + o, base - 20 - h); c.lineTo(x + o - w * 0.2, base - 20 - h * 0.66); c.lineTo(x + o + w * 0.2, base - 20 - h * 0.66); c.closePath();
          c.moveTo(x + o - w * 0.36, base - 20 - h * 0.4); c.lineTo(x + o + w * 0.36, base - 20 - h * 0.4); c.lineTo(x + o + w * 0.12, base - 20 - h * 0.55); c.lineTo(x + o - w * 0.12, base - 20 - h * 0.55); c.closePath();
          c.fillStyle = '#ffffff'; c.fill();
        });
      }
    }
  } else if (st === 'desert') {
    if (far) {
      rollingHills(c, P, H, base, 30, rand, shade(fill, 0.05), line);
      for (let i = 0; i < 6; i++) {
        const x = (i + rand() * 0.5) * (P / 6), w = 160 + rand() * 200, h = 80 + rand() * 90;
        twice((o) => {
          c.beginPath();
          c.moveTo(x + o, base); c.lineTo(x + o + w * 0.1, base - h * 0.55); c.lineTo(x + o + w * 0.16, base - h);
          c.lineTo(x + o + w * 0.84, base - h); c.lineTo(x + o + w * 0.9, base - h * 0.6); c.lineTo(x + o + w, base);
          c.closePath();
          c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
          c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 4;
          c.beginPath();
          for (let k = 1; k < 3; k++) { const yy = base - h + (h * k) / 3.2; c.moveTo(x + o + w * 0.14, yy); c.lineTo(x + o + w * 0.86, yy); }
          c.stroke();
        });
      }
    } else {
      rollingHills(c, P, H, base, 36, rand, fill, line);
      for (let i = 0; i < 12; i++) {
        const x = (i + rand()) * (P / 12), h = 50 + rand() * 50;
        twice((o) => {
          const bx = x + o, by = base - 24;
          c.fillStyle = '#4f9d4a'; c.strokeStyle = '#24461f'; c.lineWidth = 2.5;
          c.beginPath();
          c.rect(bx - 6, by - h, 12, h);
          c.rect(bx - 20, by - h * 0.7, 9, h * 0.35); c.rect(bx - 20, by - h * 0.42, 16, 7);
          c.rect(bx + 11, by - h * 0.8, 9, h * 0.38); c.rect(bx + 4, by - h * 0.48, 16, 7);
          c.fill(); c.stroke();
        });
      }
    }
  }
  return { cv, w: P, h: H };
}

let skyCache = { key: '', g: null };
function drawSky(ctx, W, H, theme) {
  const key = theme.sky[0] + theme.sky[1] + H;
  if (skyCache.key !== key) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    skyCache = { key, g };
  }
  ctx.fillStyle = skyCache.g;
  ctx.fillRect(0, 0, W, H);
}
function puff(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 24 * s, y - 16 * s, 24 * s, Math.PI, Math.PI * 1.85);
  ctx.arc(x + 56 * s, y - 10 * s, 20 * s, Math.PI * 1.2, Math.PI * 1.95);
  ctx.arc(x + 74 * s, y, 18 * s, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
}
function drawStrip(ctx, W, layer, base, zs, off) {
  const w = layer.w * zs, h = layer.h * zs;
  let start = -(((off % w) + w) % w);
  for (let k = start; k < W; k += w) ctx.drawImage(layer.cv, k, base - h, w + 0.5, h);
}

export function drawBackground(ctx, view, cam, bd, t) {
  const { W, H } = view;
  const theme = bd.theme;
  drawSky(ctx, W, H, theme);
  if (!bd.layers) bd.layers = { far: buildLayer(bd, 'far'), mid: buildLayer(bd, 'mid') };
  const horizon = clamp(H * 0.58 + clamp(cam.y * cam.z * 0.12, -H * 0.15, H * 0.3), H * 0.32, H * 0.95);
  const zs = clamp(Math.pow(cam.z / 22, 0.35), 0.62, 1.2);
  if (bd.night) {
    for (let i = 0; i < bd.stars.length; i++) {
      const s = bd.stars[i];
      const x = (((s.x * W * 1.3 - cam.x * cam.z * 0.01) % (W * 1.3)) + W * 1.3) % (W * 1.3);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, s.y * H, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // the moon
    const ex = W * 0.8, ey = H * 0.18, er = Math.min(W, H) * 0.075;
    ctx.fillStyle = 'rgba(255,245,200,0.12)';
    ctx.beginPath(); ctx.arc(ex, ey, er * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4ecc8';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,40,0.13)';
    ctx.beginPath();
    ctx.arc(ex - er * 0.35, ey - er * 0.2, er * 0.22, 0, TAU);
    ctx.moveTo(ex + er * 0.46, ey + er * 0.1); ctx.arc(ex + er * 0.3, ey + er * 0.1, er * 0.16, 0, TAU);
    ctx.moveTo(ex + er * 0.07, ey + er * 0.45); ctx.arc(ex - er * 0.05, ey + er * 0.45, er * 0.12, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
  } else {
    const sx = W * 0.8, sy = H * 0.18, sr = Math.min(W, H) * 0.08;
    ctx.fillStyle = 'rgba(255,250,200,0.35)';
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = bd.style === 'desert' ? '#fff0a0' : '#fff4a3';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f2b13a'; ctx.stroke();
    ctx.lineWidth = 3;
    for (const c of bd.clouds) {
      const span = W + 300;
      const x = ((((c.x - cam.x * cam.z * c.k - t * 5 * c.s) % span) + span) % span) - 150;
      puff(ctx, x, c.y * H, c.s * zs);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,110,160,0.35)';
      ctx.stroke();
    }
  }
  const L = bd.layers;
  const midBase = horizon + (bd.style === 'lake' ? 74 : 40) * zs;
  // far layer
  drawStrip(ctx, W, L.far, horizon, zs, cam.x * cam.z * 0.05);
  ctx.fillStyle = bd.theme.far;
  ctx.fillRect(0, horizon - 1, W, midBase - horizon + 6);
  if (bd.style === 'lake' || bd.style === 'forest' || bd.style === 'night') {
    // a lake between the far shore and the near trees, the far shore mirrored in it
    const lakeTop = horizon - 2, lakeH = (bd.style === 'lake' ? 70 : 16) * zs;
    ctx.fillStyle = bd.water;
    ctx.fillRect(0, lakeTop, W, lakeH + 4);
    if (bd.style === 'lake') {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, lakeTop, W, lakeH + 4); ctx.clip();
      ctx.globalAlpha = 0.28;
      ctx.translate(0, lakeTop * 2);
      ctx.scale(1, -1);
      drawStrip(ctx, W, L.far, lakeTop, zs, cam.x * cam.z * 0.05);
      ctx.restore();
    }
    ctx.strokeStyle = bd.night ? 'rgba(220,230,255,0.35)' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const off = (cam.x * cam.z * 0.08) % 90;
    for (let k = 0; k < 3; k++) {
      const yy = lakeTop + lakeH * (0.3 + k * 0.25);
      for (let x = -off + k * 40; x < W; x += 90) { ctx.moveTo(x, yy); ctx.lineTo(x + 26 * zs, yy); }
    }
    ctx.stroke();
  }
  if (!bd.night) {
    ctx.fillStyle = bd.haze;
    ctx.fillRect(0, horizon - 60 * zs, W, midBase - horizon + 60 * zs);
  }
  drawStrip(ctx, W, L.mid, midBase, zs * 1.1, cam.x * cam.z * 0.15);
  ctx.fillStyle = bd.theme.mid;
  ctx.fillRect(0, midBase - 1, W, H - midBase + 2);
  // fireflies over the trees (behind the trail)
  if (bd.flies.length) {
    for (const f of bd.flies) {
      const a = 0.5 + 0.5 * Math.sin(t * 2.2 + f.p * 3);
      if (a < 0.15) continue;
      const x = ((((f.x * W * 1.2 + Math.sin(t * 0.7 + f.p) * 30 - cam.x * cam.z * 0.6) % (W * 1.2)) + W * 1.2) % (W * 1.2));
      const y = f.y * H + Math.sin(t * 1.1 + f.p * 2) * 14;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = '#d8ff7a';
      ctx.beginPath(); ctx.arc(x, y, f.s * 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#f4ffb8';
      ctx.beginPath(); ctx.arc(x, y, f.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// falling snow / fireflies (screen space, stateless functions of t), drawn over the world
export function drawWeather(ctx, view, cam, bd, t) {
  const { W, H } = view;
  if (bd.flakes.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    for (const f of bd.flakes) {
      const x = ((((f.x * W + Math.sin(t * 0.8 + f.w) * 18 - cam.x * cam.z * 0.4) % W) + W) % W);
      const y = (((f.y + t * f.v) % 1) + 1) % 1 * H;
      ctx.moveTo(x + f.s, y);
      ctx.arc(x, y, f.s, 0, TAU);
    }
    ctx.fill();
  }
}

// ---------- world ----------
export function worldTransform(ctx, view, cam) {
  const d = view.dpr, z = cam.z;
  ctx.setTransform(d * z, 0, 0, -d * z, d * (view.W / 2 - cam.x * z + cam.sx), d * (view.H / 2 + cam.y * z + cam.sy));
}

// trees / rocks standing just behind the trail (drawn before the terrain, so their feet are hidden)
const rhash = (s) => { const h = Math.sin(s * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
export function drawDecor(ctx, course, bd, vis, lw) {
  const st = bd.style;
  const cell = 7;
  const s0 = Math.floor(vis.x0 / cell) - 1, s1 = Math.ceil(vis.x1 / cell) + 1;
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  for (let s = s0; s <= s1; s++) {
    const r = rhash(s);
    if (r < 0.45) continue;
    const x = s * cell + rhash(s + 0.5) * 4;
    if (course.inZone(x, 2) && course.inZone(x, 2).type === 'bridge') continue;
    const gy = course.terrainY(x) - 0.4;
    const k = 0.7 + rhash(s + 0.25) * 0.6;
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(k, k);
    if (st === 'desert') {
      if (r > 0.75) {
        ctx.fillStyle = '#5aa74f';
        ctx.beginPath();
        ctx.rect(-0.22, 0, 0.44, 2.6);
        ctx.rect(-0.85, 1.2, 0.34, 0.9); ctx.rect(-0.85, 1.2, 0.8, 0.3);
        ctx.rect(0.5, 1.5, 0.34, 0.9); ctx.rect(0.1, 1.5, 0.74, 0.3);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#c99a62';
        ctx.beginPath(); ctx.ellipse(0, 0.2, 0.9, 0.55, 0, Math.PI, TAU); ctx.ellipse(0, 0.2, 0.9, 0.55, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
      }
    } else if (st === 'granite' && r < 0.7) {
      ctx.fillStyle = r < 0.58 ? '#a7a6ab' : '#93929a';
      ctx.beginPath();
      ctx.moveTo(-1.3, 0); ctx.quadraticCurveTo(-1.4, 1.4, -0.2, 1.6); ctx.quadraticCurveTo(1.1, 1.6, 1.3, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      // a pine (snowy on the pass, dark at night)
      const h = 4.2 + rhash(s + 0.75) * 2.5, w = 2.4;
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(-0.16, 0, 0.32, h * 0.2);
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, h * 0.15); ctx.lineTo(-w * 0.2, h * 0.42); ctx.lineTo(-w * 0.38, h * 0.42);
      ctx.lineTo(-w * 0.12, h * 0.7); ctx.lineTo(-w * 0.26, h * 0.7); ctx.lineTo(0, h);
      ctx.lineTo(w * 0.26, h * 0.7); ctx.lineTo(w * 0.12, h * 0.7); ctx.lineTo(w * 0.38, h * 0.42);
      ctx.lineTo(w * 0.2, h * 0.42); ctx.lineTo(w * 0.5, h * 0.15);
      ctx.closePath();
      ctx.fillStyle = st === 'night' ? '#1d3b2c' : st === 'snow' ? '#3f6e5a' : r > 0.8 ? '#2f6b3e' : '#3a7d48';
      ctx.fill(); ctx.stroke();
      if (st === 'snow') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, h); ctx.lineTo(-w * 0.18, h * 0.76); ctx.lineTo(w * 0.18, h * 0.76); ctx.closePath();
        ctx.moveTo(-w * 0.34, h * 0.46); ctx.lineTo(w * 0.34, h * 0.46); ctx.lineTo(w * 0.1, h * 0.58); ctx.lineTo(-w * 0.1, h * 0.58); ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

let tbuf = new Float64Array(2048);
export function drawTerrain(ctx, course, bd, vis, lw, cam) {
  const theme = bd.theme, st = bd.style;
  const x0 = vis.x0 - 2, x1 = vis.x1 + 2;
  const bottom = vis.y0 - 5;
  const step = Math.max(0.25, 4 / cam.z);
  const g = course.terrainY;
  const need = 2 * (Math.ceil((x1 + step - x0) / step) + 2);
  if (tbuf.length < need) tbuf = new Float64Array(need * 2);
  const pts = tbuf;
  let np = 0;
  for (let x = x0; x <= x1 + step; x += step) { pts[np++] = x; pts[np++] = g(x); }
  // deep earth
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let i = 0; i < np; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineTo(pts[np - 2], bottom);
  ctx.closePath();
  ctx.fillStyle = theme.groundDark;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // strata
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 0.3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i < np; i += 2) {
      const y = pts[i + 1] - 3.6 - k * 2.8 - 0.6 * Math.sin(pts[i] * (0.13 + k * 0.05) + k);
      if (i === 0) ctx.moveTo(pts[i], y); else ctx.lineTo(pts[i], y);
    }
    ctx.stroke();
  }
  // pebbles in the earth
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  const c0 = Math.floor(x0 / 3.3);
  for (let s = c0; s * 3.3 < x1; s++) {
    const r = rhash(s * 1.7);
    if (r < 0.5) continue;
    const px = s * 3.3 + r * 2, py = g(px) - 1.9 - rhash(s * 2.3) * 4;
    ctx.moveTo(px + 0.3, py);
    ctx.ellipse(px, py, 0.18 + r * 0.25, 0.12 + r * 0.12, 0, 0, TAU);
  }
  ctx.fill();
  // grass / snow / sand top band (wavy lower edge)
  ctx.beginPath();
  for (let i = 0; i < np; i += 2) { if (i === 0) ctx.moveTo(pts[i], pts[i + 1] + 1); else ctx.lineTo(pts[i], pts[i + 1] + 1); }
  for (let i = np - 2; i >= 0; i -= 2) ctx.lineTo(pts[i], pts[i + 1] - 1.05 - 0.22 * Math.sin(pts[i] * 1.7));
  ctx.closePath();
  ctx.fillStyle = theme.ground;
  ctx.fill();
  ctx.strokeStyle = bd.grassLine;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  ctx.restore();

  // the dirt trail band on top
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < np; i += 2) { const y = pts[i + 1] - 0.2; if (i === 0) ctx.moveTo(pts[i], y); else ctx.lineTo(pts[i], y); }
  ctx.strokeStyle = theme.trail || theme.ground;
  ctx.lineWidth = 0.42;
  ctx.stroke();
  // surface patches on the trail band
  for (const p of course.patches) {
    if (p.x1 < x0 || p.x0 > x1) continue;
    const S = SURFACES[p.kind];
    ctx.beginPath();
    for (let x = Math.max(p.x0, x0); x <= Math.min(p.x1, x1); x += 0.5) { const y = course.groundY(x) - 0.22; if (x === Math.max(p.x0, x0)) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = S.color;
    ctx.lineWidth = p.kind === 'mud' ? 0.55 : 0.46;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = p.kind === 'mud' ? '#3e2814' : p.kind === 'ice' ? 'rgba(255,255,255,0.85)' : '#c9a865';
    ctx.beginPath();
    for (let x = p.x0 + 0.6; x < p.x1 - 0.4; x += 1.1) {
      if (x < x0 || x > x1) continue;
      const y = course.groundY(x);
      if (p.kind === 'ice') { ctx.moveTo(x, y - 0.06); ctx.rect(x, y - 0.1, 0.5, 0.05); } else { ctx.moveTo(x + 0.14, y - 0.18); ctx.ellipse(x, y - 0.18 - rhash(x) * 0.1, 0.14, 0.07, 0, 0, TAU); }
    }
    ctx.fill();
  }
  // lip highlight + bold outline
  ctx.beginPath();
  for (let i = 0; i < np; i += 2) { const y = pts[i + 1] - lw * 1.2; if (i === 0) ctx.moveTo(pts[i], y); else ctx.lineTo(pts[i], y); }
  ctx.strokeStyle = bd.lip;
  ctx.lineWidth = lw * 1.3;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < np; i += 2) { if (i === 0) ctx.moveTo(pts[i], pts[i + 1]); else ctx.lineTo(pts[i], pts[i + 1]); }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw;
  ctx.stroke();
  // tufts beside the trail (grass blades, snow lumps, pebbles)
  if (cam.z > 7) {
    ctx.fillStyle = st === 'snow' ? '#ffffff' : st === 'desert' ? '#a87d4a' : bd.tuft;
    ctx.beginPath();
    const t0 = Math.floor(x0 / 1.9);
    for (let s = t0; s * 1.9 < x1; s++) {
      const r = rhash(s * 0.37);
      if (r < 0.5) continue;
      const x = s * 1.9 + r;
      if (course.waterAt(x) || course.bridgeAt(x)) continue;
      const y = g(x);
      if (st === 'snow' || st === 'desert') { ctx.moveTo(x + 0.3, y); ctx.ellipse(x, y, 0.3, 0.14 + r * 0.06, 0, 0, Math.PI); }
      else {
        ctx.moveTo(x - 0.22, y);
        ctx.lineTo(x - 0.16, y + 0.32 + r * 0.2); ctx.lineTo(x - 0.06, y + 0.06);
        ctx.lineTo(x + 0.02, y + 0.42 + r * 0.2); ctx.lineTo(x + 0.08, y + 0.06);
        ctx.lineTo(x + 0.18, y + 0.3 + r * 0.15); ctx.lineTo(x + 0.22, y);
        ctx.closePath();
      }
    }
    ctx.fill();
  }
}

// creek at the bottom of each bridge ravine (drawn right after the terrain)
export function drawRavines(ctx, course, bd, vis, lw) {
  for (const b of course.bridges) {
    if (b.x1 < vis.x0 - 2 || b.x0 > vis.x1 + 2) continue;
    const yb = b.y - b.depth + 0.6;
    ctx.fillStyle = withAlpha(bd.water, 0.85);
    ctx.beginPath();
    let first = true;
    for (let x = b.x0; x <= b.x1; x += 0.4) {
      const ty = course.terrainY(x);
      if (ty > yb) continue;
      if (first) { ctx.moveTo(x, yb); first = false; }
      ctx.lineTo(x, yb);
    }
    for (let x = b.x1; x >= b.x0; x -= 0.4) { const ty = course.terrainY(x); if (ty <= yb) ctx.lineTo(x, ty); }
    ctx.closePath();
    ctx.fill();
  }
}

export function drawBridges(ctx, course, vis, lw) {
  for (const b of course.bridges) {
    if (b.x1 < vis.x0 - 3 || b.x0 > vis.x1 + 3) continue;
    const y = b.y, xa = b.x0 - 1.2, xb = b.x1 + 1.2;
    ctx.lineJoin = 'round';
    // trestles
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    for (const px of [b.x0 + 2, b.x1 - 2, (b.x0 + b.x1) / 2]) {
      const by = course.terrainY(px);
      ctx.moveTo(px - 0.6, y - 0.3); ctx.lineTo(px - 1.0, by);
      ctx.moveTo(px + 0.6, y - 0.3); ctx.lineTo(px + 1.0, by);
      ctx.moveTo(px - 0.8, (y + by) / 2); ctx.lineTo(px + 0.8, (y + by) / 2);
    }
    ctx.stroke();
    // deck beam + planks
    ctx.fillStyle = '#8a5a32';
    ctx.fillRect(xa, y - 0.42, xb - xa, 0.42);
    ctx.fillStyle = '#b07a46';
    ctx.fillRect(xa, y - 0.2, xb - xa, 0.2);
    ctx.strokeStyle = 'rgba(40,20,5,0.55)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let x = xa + 0.45; x < xb; x += 0.45) { ctx.moveTo(x, y); ctx.lineTo(x, y - 0.2); }
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUT;
    ctx.strokeRect(xa, y - 0.42, xb - xa, 0.42);
    // rail behind the deck
    ctx.strokeStyle = '#6b4424';
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    for (let x = xa + 0.2; x <= xb; x += 2) { ctx.moveTo(x, y); ctx.lineTo(x, y + 1.0); }
    ctx.moveTo(xa + 0.2, y + 0.95); ctx.lineTo(xb - 0.2, y + 0.95);
    ctx.moveTo(xa + 0.2, y + 0.5); ctx.lineTo(xb - 0.2, y + 0.5);
    ctx.stroke();
  }
}

// water: drawn translucent over the vehicle (it rides through it)
export function drawWater(ctx, course, bd, vis, lw, t) {
  for (const w of course.waters) {
    if (w.x1 < vis.x0 - 1 || w.x0 > vis.x1 + 1) continue;
    // where the dip is below the water level
    let a = w.x0, b = w.x1;
    for (let x = w.x0; x < w.x1; x += 0.1) if (course.groundY(x) < w.level) { a = x; break; }
    for (let x = w.x1; x > w.x0; x -= 0.1) if (course.groundY(x) < w.level) { b = x; break; }
    ctx.beginPath();
    for (let x = a; x <= b + 1e-6; x += 0.35) {
      const y = w.level + 0.06 * Math.sin(x * 2.4 + t * 3.1) + 0.04 * Math.sin(x * 4.1 - t * 2.3);
      if (x === a) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let x = b; x >= a; x -= 0.35) ctx.lineTo(x, course.groundY(x));
    ctx.closePath();
    ctx.fillStyle = withAlpha(bd.water, 0.62);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    for (let x = a; x <= b + 1e-6; x += 0.35) {
      const y = w.level + 0.06 * Math.sin(x * 2.4 + t * 3.1) + 0.04 * Math.sin(x * 4.1 - t * 2.3);
      if (x === a) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // reeds at the banks
    ctx.strokeStyle = '#3f7d3a';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    for (const rx of [a - 0.6, a - 0.3, b + 0.3, b + 0.7]) {
      const ry = course.groundY(rx);
      ctx.moveTo(rx, ry); ctx.lineTo(rx + 0.08, ry + 0.9);
      ctx.moveTo(rx + 0.12, ry); ctx.lineTo(rx + 0.26, ry + 0.7);
    }
    ctx.stroke();
  }
}

export function drawKickers(ctx, course, vis, lw) {
  for (const k of course.kickers) {
    if (k.x2 < vis.x0 - 2 || k.x0 > vis.x1 + 2) continue;
    const by = (x) => course.baseY(x);
    ctx.beginPath();
    ctx.moveTo(k.x0, by(k.x0));
    for (let x = k.x0; x <= k.x1; x += 0.3) ctx.lineTo(x, course.groundY(x));
    ctx.lineTo(k.x1, course.groundY(k.x1 - 0.01));
    ctx.lineTo(k.x1 + 0.15, by(k.x1) - 0.05);
    ctx.closePath();
    ctx.fillStyle = '#c48a4e';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(60,30,10,0.45)';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    for (let x = k.x0 + 0.5; x < k.x1; x += 0.55) { ctx.moveTo(x, by(x) - 0.1); ctx.lineTo(x, course.groundY(x) + 0.1); }
    ctx.stroke();
    ctx.restore();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    // orange lip stripe
    ctx.strokeStyle = '#ff8a1f';
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(k.x1 - 0.9, course.groundY(k.x1 - 0.9) - 0.05);
    ctx.lineTo(k.x1, course.groundY(k.x1 - 0.01) - 0.05);
    ctx.stroke();
  }
}

// gate: a wooden farm gate between two posts with a sign on top; `open` 0..1 swings it toward the viewer
const easeOutBack = (k) => { const c = 1.7; const u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
export function drawGate(ctx, gate, y, lw, open, t, night) {
  const x = gate.x;
  const W = 2.4, H = 1.55;
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  // back post
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(x + W - 0.12, y - 0.3, 0.26, 2.3);
  ctx.strokeRect(x + W - 0.12, y - 0.3, 0.26, 2.3);
  // the swinging gate (scaled along x as it swings)
  const k = clamp(open, 0, 1);
  const sw = Math.cos(easeOutBack(k) * Math.PI * 0.46);
  if (sw > 0.04 || k < 1) {
    ctx.save();
    ctx.translate(x + 0.1, y + 0.25);
    ctx.scale(Math.max(0.04, sw), 1);
    ctx.fillStyle = '#c9925a';
    ctx.strokeStyle = OUT;
    for (const by of [0.0, 0.5, 1.0]) { ctx.fillRect(0, by, W - 0.2, 0.22); ctx.strokeRect(0, by, W - 0.2, 0.22); }
    ctx.beginPath(); ctx.moveTo(0.1, 0.1); ctx.lineTo(W - 0.35, 1.15); ctx.lineWidth = 0.16; ctx.strokeStyle = '#9c6a3a'; ctx.stroke();
    ctx.fillRect(W - 0.45, 0, 0.2, 1.22);
    ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.strokeRect(W - 0.45, 0, 0.2, 1.22);
    // orange reflector
    ctx.fillStyle = '#ff8a1f';
    ctx.fillRect(W * 0.45, 0.52, 0.3, 0.18);
    ctx.restore();
  }
  // front post + sign board
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(x - 0.13, y - 0.3, 0.26, 2.6);
  ctx.strokeRect(x - 0.13, y - 0.3, 0.26, 2.6);
  const sx = x + W / 2, sy = y + 2.55;
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(x + 0.05, y + 1.95, W - 0.1, 0.12);
  ctx.fillStyle = night ? '#e8c38a' : '#f0cf94';
  ctx.beginPath();
  ctx.rect(sx - 1.45, sy - 0.48, 2.9, 0.96);
  ctx.fill();
  ctx.stroke();
  worldText(ctx, 'GATE ' + (gate.index + 1), 0.52, sx, sy, k > 0.5 ? '#7dff6b' : '#ff8a1f');
}

export function drawFinish(ctx, course, lw, t) {
  const F = course.finishX;
  const gy = course.groundY(F);
  const top = gy + 6;
  const cs = 0.5;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      const x = F - 1 + i * cs;
      ctx.fillRect(x, course.groundY(x) - (j + 1) * cs + 0.02, cs, cs);
    }
  }
  for (const px of [F - 2.4, F + 2.4]) {
    const by = course.groundY(px) - 0.4;
    ctx.fillStyle = '#7a4f2a';
    ctx.fillRect(px - 0.17, by, 0.34, top - by);
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = OUT;
    ctx.strokeRect(px - 0.17, by, 0.34, top - by);
  }
  const bx = F - 2.8, bw = 5.6, by = top - 1.6, bh = 1.6;
  const n = 14, m = 4;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111118' : '#ffffff';
      ctx.fillRect(bx + (i * bw) / n, by + (j * bh) / m, bw / n + 0.01, bh / m + 0.01);
    }
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.strokeRect(bx, by, bw, bh);
  worldText(ctx, 'FINISH', 0.9, F, top + 0.7, '#ffd23f');
  // a waving flag on the right post
  const fx = F + 2.4, fy = top + 0.1;
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath();
  ctx.moveTo(fx, fy + 1.6);
  ctx.quadraticCurveTo(fx + 0.7, fy + 1.6 + 0.2 * Math.sin(t * 5), fx + 1.4, fy + 1.4 + 0.15 * Math.sin(t * 5 + 1));
  ctx.lineTo(fx + 1.4, fy + 0.7 + 0.15 * Math.sin(t * 5 + 1));
  ctx.quadraticCurveTo(fx + 0.7, fy + 0.9 + 0.2 * Math.sin(t * 5), fx, fy + 0.9);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(fx - 0.06, top - 0.5, 0.12, 2.3);
}

export function drawStartSign(ctx, course, trail, lw) {
  const x = -5.5, gy = course.groundY(x);
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = '#7a4f2a';
  for (const px of [x - 1.9, x + 1.9]) { ctx.fillRect(px - 0.13, gy - 0.3, 0.26, 2.9); ctx.strokeRect(px - 0.13, gy - 0.3, 0.26, 2.9); }
  ctx.fillStyle = '#e9c28a';
  ctx.fillRect(x - 2.3, gy + 1.7, 4.6, 1.0);
  ctx.strokeRect(x - 2.3, gy + 1.7, 4.6, 1.0);
  worldText(ctx, trail.name.toUpperCase(), 0.48, x, gy + 2.2, '#1f4d2e', false);
}

export function drawBestFlag(ctx, course, x, lw, passed) {
  const gy = course.groundY(x);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw * 0.8;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 0.06, gy, 0.12, 2.6);
  ctx.fillStyle = passed ? '#7dff6b' : '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(x + 0.06, gy + 2.6); ctx.lineTo(x + 1.2, gy + 2.25); ctx.lineTo(x + 0.06, gy + 1.9);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  worldText(ctx, 'BEST', 0.32, x, gy + 3.0, '#ffffff');
}

export function drawCoin(ctx, c, t, lw) {
  const sx = Math.max(0.15, Math.abs(Math.cos(t * 3.2 + c.id * 0.7)));
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, TAU);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.lineWidth = lw / sx;
  ctx.strokeStyle = '#a8740f';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, c.r * 0.58, 0, TAU);
  ctx.strokeStyle = '#e5a91c';
  ctx.lineWidth = 0.06 / sx;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(-c.r * 0.45, c.r * 0.1, c.r * 0.22, c.r * 0.32);
  ctx.restore();
}

// props: drawn with their base at (0, 0), +y up, already rotated to the ground slope
export function drawProp(ctx, kind, lw, t, id) {
  const def = OBSTACLE_KINDS[kind];
  const w = def.w, h = def.h, c = def.color;
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  switch (kind) {
    case 'log': {
      const r = h / 2;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.rect(-w / 2, 0, w, h);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,20,5,0.4)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 0.2, r * 0.6); ctx.lineTo(w / 2 - 0.4, r * 0.7); ctx.moveTo(-w / 2 + 0.4, r * 1.4); ctx.lineTo(w / 2 - 0.3, r * 1.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w / 2, r, r * 0.55, r, 0, 0, TAU);
      ctx.fillStyle = '#d8a86a'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w / 2, r, r * 0.28, r * 0.5, 0, 0, TAU); ctx.strokeStyle = '#a0703c'; ctx.lineWidth = 0.04; ctx.stroke();
      break;
    }
    case 'rock': case 'boulder': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(-w * 0.55, h * 0.8, -w * 0.1, h);
      ctx.quadraticCurveTo(w * 0.45, h * 1.02, w / 2, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(-w * 0.15, h * 0.7, w * 0.16, h * 0.1, -0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.5); ctx.lineTo(w * 0.25, h * 0.2); ctx.stroke();
      break;
    }
    case 'cone': {
      ctx.fillStyle = '#2b2b30';
      ctx.fillRect(-w / 2 - 0.05, 0, w + 0.1, 0.08);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, 0.08); ctx.lineTo(-0.06, h); ctx.lineTo(0.06, h); ctx.lineTo(w / 2, 0.08); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-w * 0.34, h * 0.32); ctx.lineTo(-w * 0.2, h * 0.58); ctx.lineTo(w * 0.2, h * 0.58); ctx.lineTo(w * 0.34, h * 0.32); ctx.closePath(); ctx.fill();
      break;
    }
    case 'sign': {
      ctx.fillStyle = '#7a4f2a';
      ctx.fillRect(-0.07, 0, 0.14, h);
      ctx.strokeRect(-0.07, 0, 0.14, h);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, h - 0.55); ctx.lineTo(w / 2 - 0.15, h - 0.55); ctx.lineTo(w / 2 + 0.1, h - 0.33); ctx.lineTo(w / 2 - 0.15, h - 0.1); ctx.lineTo(-w / 2, h - 0.1); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-w * 0.3, h - 0.38); ctx.lineTo(w * 0.15, h - 0.38); ctx.lineTo(w * 0.15, h - 0.46); ctx.lineTo(w * 0.3, h - 0.33); ctx.lineTo(w * 0.15, h - 0.2); ctx.lineTo(w * 0.15, h - 0.28); ctx.lineTo(-w * 0.3, h - 0.28); ctx.closePath(); ctx.fill();
      break;
    }
    case 'stump': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2 - 0.1, 0); ctx.lineTo(-w / 2, h); ctx.lineTo(w / 2, h); ctx.lineTo(w / 2 + 0.1, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, h, w / 2, 0.12, 0, 0, TAU); ctx.fillStyle = '#e0b276'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'snowman': {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0.42, 0.45, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 1.05, 0.33, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 1.5, 0.23, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath(); ctx.moveTo(0.18, 1.52); ctx.lineTo(0.5, 1.48); ctx.lineTo(0.18, 1.44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.fillRect(0.02, 1.56, 0.06, 0.06); ctx.fillRect(0, 1.0, 0.07, 0.07); ctx.fillRect(0, 1.17, 0.07, 0.07);
      ctx.fillStyle = '#e2453a';
      ctx.fillRect(-0.26, 1.28, 0.52, 0.1);
      break;
    }
    case 'cactus': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-0.17, 0); ctx.lineTo(-0.17, h - 0.17); ctx.arc(0, h - 0.17, 0.17, Math.PI, 0, true); ctx.lineTo(0.17, 0); ctx.closePath();
      ctx.moveTo(-0.17, h * 0.45); ctx.lineTo(-0.42, h * 0.45); ctx.lineTo(-0.42, h * 0.75); ctx.arc(-0.34, h * 0.75, 0.08, Math.PI, 0, true); ctx.lineTo(-0.26, h * 0.55); ctx.lineTo(-0.17, h * 0.55);
      ctx.moveTo(0.17, h * 0.55); ctx.lineTo(0.4, h * 0.55); ctx.lineTo(0.4, h * 0.82); ctx.arc(0.32, h * 0.82, 0.08, 0, Math.PI, true); ctx.lineTo(0.24, h * 0.64); ctx.lineTo(0.17, h * 0.64);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff7eb6';
      ctx.beginPath(); ctx.arc(0, h + 0.02, 0.09, 0, TAU); ctx.fill();
      break;
    }
    case 'tumbleweed': {
      const r = w / 2;
      ctx.save();
      ctx.translate(0, r);
      ctx.rotate(-t * 2 - id);
      ctx.strokeStyle = c;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.quadraticCurveTo(Math.cos(a + 2) * r * 0.2, Math.sin(a + 2) * r * 0.2, Math.cos(a + 3) * r, Math.sin(a + 3) * r); }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.restore();
      break;
    }
    case 'pumpkin': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,50,0,0.6)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.ellipse(0, h / 2, w * 0.2, h / 2, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#4f7d2a'; ctx.fillRect(-0.05, h - 0.02, 0.1, 0.14);
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath(); ctx.moveTo(-0.22, h * 0.6); ctx.lineTo(-0.1, h * 0.72); ctx.lineTo(-0.02, h * 0.58); ctx.closePath();
      ctx.moveTo(0.22, h * 0.6); ctx.lineTo(0.1, h * 0.72); ctx.lineTo(0.02, h * 0.58); ctx.closePath();
      ctx.moveTo(-0.2, h * 0.32); ctx.lineTo(0.2, h * 0.32); ctx.lineTo(0, h * 0.2); ctx.closePath();
      ctx.fill();
      break;
    }
    case 'puddle': {
      ctx.fillStyle = withAlpha(c, 0.8);
      ctx.beginPath(); ctx.ellipse(0, 0.02, w / 2, 0.1, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(-w * 0.2, 0.06); ctx.lineTo(w * 0.05, 0.06); ctx.stroke();
      break;
    }
    default: {
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, 0, w, h);
      ctx.strokeRect(-w / 2, 0, w, h);
      ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(-w / 2, h); ctx.lineTo(w / 2, 0); ctx.stroke();
    }
  }
}

// winch: a post with a pulley up-trail and the cable to the vehicle's hook
export function drawWinch(ctx, ax, ay, hx, hy, lw, k) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(ax - 0.17, ay - 0.4, 0.34, 2.4);
  ctx.strokeRect(ax - 0.17, ay - 0.4, 0.34, 2.4);
  ctx.fillStyle = '#ff8a1f';
  ctx.fillRect(ax - 0.17, ay + 1.6, 0.34, 0.2);
  ctx.beginPath(); ctx.arc(ax - 0.2, ay + 1.75, 0.2, 0, TAU); ctx.fillStyle = '#b9bec8'; ctx.fill(); ctx.stroke();
  if (k > 0) {
    // the cable sags a little until it is pulled tight
    const mx = (ax + hx) / 2, my = (ay + 1.75 + hy) / 2 - 0.5 * (1 - k);
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(ax - 0.2, ay + 1.75);
    ctx.quadraticCurveTo(mx, my, hx, hy);
    ctx.stroke();
  }
}

// ---------- particles / popups / overlays ----------
export function drawParticles(ctx, parts, n, vis) {
  for (let i = 0; i < n; i++) {
    const p = parts[i];
    if (p.x < vis.x0 - 2 || p.x > vis.x1 + 2 || p.y < vis.y0 - 2 || p.y > vis.y1 + 2) continue;
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 1.6) * p.alpha;
    ctx.fillStyle = p.color;
    if (p.type === 4) { // chunk (debris)
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
      ctx.lineWidth = 0.04; ctx.strokeStyle = OUT; ctx.strokeRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
      ctx.restore();
    } else if (p.type === 5) { // confetti
      const w = p.size * 2 * Math.abs(Math.cos(p.a)) + 0.03;
      ctx.fillRect(p.x - w / 2, p.y - p.size / 2, w, p.size);
    } else if (p.type === 6) { // spark
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
    } else if (p.type === 7) { // ring
      const u = 1 - k;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.08 + 0.3 * k;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size + p.extra * u, 0, TAU); ctx.stroke();
    } else {
      // dust / mud / snow / splash puffs: grow as they fade (mud + splash stay small and solid)
      const grow = p.type === 0 ? 1.7 - k * 0.7 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * grow, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx, popups, toScreen, view) {
  const base = Math.max(18, Math.min(38, Math.min(view.W, view.H) * 0.07));
  for (const p of popups) {
    const k = p.t / p.life;
    let x, y;
    if (p.world) { const s = toScreen(p.x, p.y); x = s[0]; y = s[1]; } else { x = p.x * view.W; y = p.y * view.H; }
    y -= k * (p.world ? 40 : 18);
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
    ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    spriteText(ctx, p.text, base * (p.scale || 1) * pop, x, y, p.color || '#ffffff', true);
  }
  ctx.globalAlpha = 1;
}

export function drawSpeedLines(ctx, view, lines, intensity, dirX, dirY) {
  if (intensity <= 0.01) return;
  ctx.globalAlpha = 0.5 * intensity;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (const l of lines) {
    const x = l.x * view.W, y = l.y * view.H;
    const dx = x - view.W / 2, dy = y - view.H / 2;
    if (Math.abs(dx) < view.W * 0.22 && Math.abs(dy) < view.H * 0.25) continue;
    const len = l.len * (40 + 80 * intensity);
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dirX * len, y + dirY * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

// night: headlight cone from (hx, hy) along angle `ang` (world), plus a light pool on the trail ahead
export function drawHeadlights(ctx, course, hx, hy, ang, on) {
  if (!on) return;
  const len = 15, spread = 0.3;
  const a0 = ang - 0.1 - spread, a1 = ang - 0.1 + spread;
  ctx.save();
  // only the air above the trail is lit (the cone never shines through the ground)
  ctx.beginPath();
  const xa = hx - 1.5, xb = hx + len + 2;
  ctx.moveTo(xa, hy + len);
  for (let x = xa; x <= xb; x += 0.8) ctx.lineTo(x, course.groundY(x));
  ctx.lineTo(xb, hy + len);
  ctx.closePath();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(hx, hy, hx + Math.cos(ang) * len, hy + Math.sin(ang) * len);
  g.addColorStop(0, 'rgba(255,236,170,0.36)');
  g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(a0) * len, hy + Math.sin(a0) * len);
  ctx.lineTo(hx + Math.cos(a1) * len, hy + Math.sin(a1) * len);
  ctx.closePath();
  ctx.fill();
  // where the cone meets the ground: a warm strip along the trail surface
  ctx.strokeStyle = 'rgba(255,220,140,0.28)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  let started = false;
  for (let d = 2; d < 13; d += 0.6) {
    const x = hx + Math.cos(ang) * d;
    const y = course.groundY(x) - 0.1;
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawFlash(ctx, view, a, col) {
  if (a <= 0.01) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, view.W, view.H);
  ctx.globalAlpha = 1;
}

// ---------- v1.1 race mode ----------
export function drawNameTag(ctx, name, x, y, color) {
  worldText(ctx, String(name).toUpperCase(), 0.48, x, y, color || '#ffffff');
}

// berm: a banked turn drawn as a dirt wall behind the track (the ground under it stays flat)
export function drawBerms(ctx, course, vis, lw) {
  for (const b of course.berms || []) {
    if (b.x1 < vis.x0 - 2 || b.x0 > vis.x1 + 2) continue;
    const len = b.x1 - b.x0, y = b.y;
    ctx.beginPath();
    ctx.moveTo(b.x0 - 1, y - 0.5);
    ctx.quadraticCurveTo(b.x0 + len * 0.55, y + 0.6, b.x1 - 1.5, y + 3.2);
    ctx.lineTo(b.x1 + 0.5, y + 3.0);
    ctx.quadraticCurveTo(b.x1 + 1.5, y + 1.2, b.x1 + 2, y - 0.5);
    ctx.closePath();
    ctx.fillStyle = '#a77845';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,35,15,0.35)';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    for (let k = 1; k <= 3; k++) {
      ctx.moveTo(b.x0 + len * 0.2, y - 0.2 + k * 0.15);
      ctx.quadraticCurveTo(b.x0 + len * 0.6, y + 0.3 + k * 0.5, b.x1 - 1.2, y + 0.4 + k * 0.8);
    }
    ctx.stroke();
    // marker poles along the top
    ctx.fillStyle = '#ff8a1f';
    for (let k = 0; k < 3; k++) { const px = b.x1 - 4 + k * 1.6; ctx.fillRect(px, y + 2.2 + k * 0.25, 0.12, 1.1); }
  }
}

export function drawCheckpoints(ctx, course, vis, lw, passed) {
  for (const cp of course.checkpoints || []) {
    if (!cp.index || cp.x < vis.x0 - 2 || cp.x > vis.x1 + 2) continue;
    const y = course.groundY(cp.x);
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = OUT;
    ctx.fillStyle = '#e8e8ee';
    ctx.fillRect(cp.x - 0.07, y, 0.14, 3.2);
    ctx.strokeRect(cp.x - 0.07, y, 0.14, 3.2);
    ctx.fillStyle = cp.index <= passed ? '#7dff6b' : '#ff8a1f';
    ctx.beginPath();
    ctx.moveTo(cp.x + 0.07, y + 3.2); ctx.lineTo(cp.x + 1.5, y + 2.85); ctx.lineTo(cp.x + 0.07, y + 2.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}

// the start: a drop gate in front of the riders (drop 0..1 swings it down flat) under a START banner
export function drawStartGate(ctx, course, lw, drop) {
  const x = course.startGateX || 3.3, y = course.groundY(x);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  // banner posts + banner
  ctx.fillStyle = '#9aa0aa';
  ctx.fillRect(x - 6.2, y - 0.3, 0.22, 4.6); ctx.strokeRect(x - 6.2, y - 0.3, 0.22, 4.6);
  ctx.fillRect(x + 0.9, y - 0.3, 0.22, 4.6); ctx.strokeRect(x + 0.9, y - 0.3, 0.22, 4.6);
  ctx.fillStyle = '#ff8a1f';
  ctx.fillRect(x - 6.3, y + 3.5, 7.5, 0.9); ctx.strokeRect(x - 6.3, y + 3.5, 7.5, 0.9);
  worldText(ctx, 'START', 0.62, x - 2.55, y + 3.95, '#ffffff');
  // the gate plate pivots at its foot and falls forward
  const a = (Math.PI / 2) * (1 - Math.min(1, drop) * (1 + 0.15 * Math.sin(Math.min(1, drop) * Math.PI)));
  ctx.save();
  ctx.translate(x, y + 0.05);
  ctx.rotate(-(Math.PI / 2 - a));
  ctx.fillStyle = '#c9ced6';
  ctx.fillRect(-0.08, 0, 0.16, 0.95);
  ctx.strokeRect(-0.08, 0, 0.16, 0.95);
  ctx.fillStyle = '#ff8a1f';
  ctx.fillRect(-0.08, 0.6, 0.16, 0.22);
  ctx.restore();
  ctx.fillStyle = '#5b616d';
  ctx.fillRect(x - 0.3, y - 0.1, 0.6, 0.2);
}
