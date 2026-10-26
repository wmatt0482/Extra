// Fraction Fright canvas renderer: Halloween-cool cartoon (PvZ2 / Zombie Catchers vein), bold ink outlines, moody
// palette (ink blacks, bruise purples, toxic green slime, rust orange). Everything is procedural (no image assets).
// The backdrop (sky, big moon, hills, graves, the iron gate, the graveyard lane and the cracked asphalt road band)
// is drawn once per size into a bitmap; text comes from a sprite cache (condensed, gritty); per-frame layers are a
// low fog, moon wisps, puddle glints, the occasional lightning, and the actors.
// Layers (engine.js render()): backdrop -> storm/weather -> landmarks -> zombies (the lane behind the road) -> low
// fog -> splats and ground effects -> number line + markers -> jumps / nudge / reticle -> metal signs (always above
// effects) -> iron fence + jack-o'-lanterns -> kid with the slime cannon -> grenade -> airborne particles -> flag ->
// popups.

import { TAU, clamp, lerp, mulberry32, shade, withAlpha, popScale, hash2 } from './util.js';
import { roundRect, paintRoadBand } from './road.js';

export const OUT = '#120f18';
const FONT = '900 {S}px Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const font = (s) => FONT.replace('{S}', Math.round(s));
const COND = 0.86; // horizontal squeeze: a condensed slab feel whatever font the device has

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
  if (sprites.size > 240) sprites.clear();
  if (!probe) probe = mkCanvas(4, 4).getContext('2d');
  probe.font = font(px);
  const w = Math.ceil((probe.measureText(text).width + lw * 2 + 8) * COND), h = Math.ceil(px * 1.3 + lw * 2 + 4);
  const cv = mkCanvas(w, h);
  const c = cv.getContext('2d');
  c.scale(COND, 1);
  c.font = font(px);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const cx = w / 2 / COND, cy = h / 2;
  if (lw > 0) { c.lineJoin = 'miter'; c.miterLimit = 3; c.lineWidth = lw; c.strokeStyle = OUT; c.strokeText(text, cx, cy); }
  c.fillStyle = fill;
  c.fillText(text, cx, cy);
  // grit: a few dark speckles stamped only where the letters are
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = withAlpha(OUT, 0.28);
  const rand = mulberry32(hash2(text.length * 31 + px, lw));
  for (let i = 0; i < Math.max(6, text.length * 4); i++) { const x = rand() * w / COND, y = rand() * h; c.fillRect(x, y, 1.5 + rand() * 2.5, 1 + rand() * 1.5); }
  c.globalCompositeOperation = 'source-over';
  sp = { cv, w, h, px };
  sprites.set(key, sp);
  return sp;
}
// draw `text` centred at (x, y) at font size `size` css px (tilt in radians)
export function spriteText(ctx, text, size, x, y, fill, outline = true, tilt = 0) {
  const PX = 64, k = size / PX;
  const sp = textSprite(String(text), fill, PX, outline ? 12 : 0);
  if (tilt) { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.drawImage(sp.cv, -(sp.w * k) / 2, -(sp.h * k) / 2, sp.w * k, sp.h * k); ctx.restore(); return; }
  ctx.drawImage(sp.cv, x - (sp.w * k) / 2, y - (sp.h * k) / 2, sp.w * k, sp.h * k);
}
export function textWidth(text, size) {
  const sp = textSprite(String(text), '#fff', 64, 12);
  return (sp.w * size) / 64;
}

// ---------- palettes ----------
export const WEATHERS = ['clear', 'fog', 'bats', 'stars', 'rain'];
export function palette(look = {}) {
  const sky = look.sky || ['#06050d', '#1c1230', '#4a1f3f', '#8a3a1c'];
  return {
    sky, moon: '#efe3b4', moonDark: '#cdbf8c', hillFar: '#1a1228', hillNear: '#100b1b', grave: '#5d5a70', gate: '#1a1822',
    grass: look.grass || '#1f3326', grassDark: '#121f17', dirt: '#2a2420',
    fence: look.fenceColor || (look.fence === 'stone' ? '#4a4858' : look.fence === 'picket' ? '#8c8578' : '#1b1a24'),
    goo: look.goo || '#8cff1a', fog: '#8d82b0', rust: '#b8562a',
  };
}

// ---------- backdrop (cached bitmap) ----------
export function buildBackdrop(view, road, pal, seed, look = {}) {
  const W = view.W, H = view.H, dpr = view.dpr;
  const cv = mkCanvas(Math.round(W * dpr), Math.round(H * dpr));
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const rand = mulberry32((seed * 7 + 11) >>> 0);
  const horizon = road.y - road.band - Math.max(40, H * 0.16);
  // sky: ink -> bruise purple -> a rust glow at the horizon
  const g = c.createLinearGradient(0, 0, 0, horizon + 30);
  g.addColorStop(0, pal.sky[0]); g.addColorStop(0.5, pal.sky[1]); g.addColorStop(0.86, pal.sky[2]); g.addColorStop(1, pal.sky[3] || pal.sky[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // stars (dim)
  c.fillStyle = '#e9e2ff';
  for (let i = 0; i < 46; i++) { const x = rand() * W, y = rand() * horizon * 0.65, s = 0.6 + rand() * 1.2; c.globalAlpha = 0.25 + rand() * 0.45; c.fillRect(x, y, s, s); }
  c.globalAlpha = 1;
  // the big moon
  const mx = W * (road.portrait ? 0.74 : 0.8), mr = clamp(Math.min(W, H) * 0.11, 34, 72), my = Math.max(mr * 1.15, horizon * 0.34);
  for (let i = 3; i >= 1; i--) { c.fillStyle = withAlpha(pal.moon, 0.05 * i); c.beginPath(); c.arc(mx, my, mr * (1 + 0.28 * i), 0, TAU); c.fill(); }
  c.fillStyle = pal.moon; c.strokeStyle = OUT; c.lineWidth = 3.5;
  c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = withAlpha(pal.moonDark, 0.9);
  const craters = [[-0.35, -0.25, 0.2], [0.3, 0.25, 0.14], [0.1, -0.45, 0.1], [-0.1, 0.5, 0.08], [0.5, -0.15, 0.09], [-0.55, 0.2, 0.07]];
  for (const [kx, ky, kr] of craters) { c.beginPath(); c.arc(mx + kx * mr, my + ky * mr, kr * mr, 0, TAU); c.fill(); c.fillStyle = withAlpha(OUT, 0.12); c.beginPath(); c.arc(mx + kx * mr + kr * mr * 0.25, my + ky * mr + kr * mr * 0.25, kr * mr * 0.7, 0, TAU); c.fill(); c.fillStyle = withAlpha(pal.moonDark, 0.9); }
  c.fillStyle = withAlpha(OUT, 0.18); c.beginPath(); c.arc(mx + mr * 0.25, my + mr * 0.2, mr * 0.95, -0.9, 1.1); c.arc(mx, my, mr, 1.1, -0.9, true); c.closePath(); c.fill();
  // far hills + a crooked bare tree + graves on the hill line
  hills(c, W, horizon - 8, 52, rand, pal.hillFar);
  hills(c, W, horizon + 14, 32, rand, pal.hillNear);
  c.lineWidth = 2.5; c.strokeStyle = OUT; c.lineJoin = 'round';
  for (let i = 0; i < Math.max(6, Math.floor(W / 100)); i++) {
    const x = 20 + rand() * (W - 40), s = 11 + rand() * 13, y = horizon + 14 - rand() * 10, tilt = (rand() - 0.5) * 0.3;
    c.save(); c.translate(x, y); c.rotate(tilt);
    c.fillStyle = shade(pal.grave, -0.45);
    if (rand() < 0.35) { c.beginPath(); c.moveTo(-s * 0.45, 0); c.lineTo(-s * 0.45, -s * 0.9); c.lineTo(-s * 0.2, -s * 1.3); c.lineTo(s * 0.3, -s * 1.3); c.lineTo(s * 0.45, -s * 0.8); c.lineTo(s * 0.45, 0); c.closePath(); c.fill(); c.stroke(); }
    else { roundRect(c, -s * 0.4, -s * 1.15, s * 0.8, s * 1.15, s * 0.35); c.fill(); c.stroke(); }
    c.restore();
  }
  bareTree(c, W * 0.17, horizon + 16, Math.max(70, H * 0.26), rand);
  if (W > 700) bareTree(c, W * 0.58, horizon + 10, Math.max(50, H * 0.16), rand);
  // the graveyard lane: dark grass with dirt patches and dead leaves
  c.fillStyle = pal.grassDark; c.fillRect(0, horizon + 14, W, road.y - road.band - horizon - 14 + 2);
  c.fillStyle = pal.grass;
  c.beginPath(); c.moveTo(0, horizon + 28); for (let x = 0; x <= W; x += 24) c.lineTo(x, horizon + 24 + Math.sin(x * 0.07) * 4); c.lineTo(W, road.y - road.band + 2); c.lineTo(0, road.y - road.band + 2); c.closePath(); c.fill();
  c.fillStyle = pal.dirt;
  for (let i = 0; i < W / 160; i++) { const x = rand() * W, y = horizon + 40 + rand() * (road.y - road.band - horizon - 50); c.beginPath(); c.ellipse(x, y, 30 + rand() * 40, 7 + rand() * 6, 0, 0, TAU); c.fill(); }
  c.strokeStyle = pal.grassDark; c.lineWidth = 2;
  for (let i = 0; i < W / 12; i++) { const x = rand() * W, y = horizon + 32 + rand() * (road.y - road.band - horizon - 36); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6); c.moveTo(x + 3, y); c.lineTo(x + 6, y - 6); c.stroke(); }
  c.fillStyle = '#5a3a1e';
  for (let i = 0; i < W / 60; i++) { const x = rand() * W, y = horizon + 40 + rand() * (road.y - road.band - horizon - 44); c.beginPath(); c.ellipse(x, y, 4, 2.2, rand() * 3, 0, TAU); c.fill(); }
  // the iron graveyard gate at the left: stone pillars, a spiked arch
  const gx = Math.max(14, road.x0 * 0.5), gy = road.y - road.band - 2, gh = clamp(H * 0.22, 54, 104);
  c.strokeStyle = OUT; c.lineWidth = 2.5;
  for (const px of [gx - 8, gx + 24]) { c.fillStyle = '#3a3646'; roundRect(c, px, gy - gh, 12, gh, 2); c.fill(); c.stroke(); c.fillStyle = '#4a4658'; c.fillRect(px + 2, gy - gh + 6, 3, gh - 12); c.fillStyle = '#2a2734'; roundRect(c, px - 3, gy - gh - 6, 18, 7, 2); c.fill(); c.stroke(); }
  c.fillStyle = pal.gate;
  c.beginPath(); c.moveTo(gx - 10, gy - gh + 2); c.quadraticCurveTo(gx + 13, gy - gh - 26, gx + 38, gy - gh + 2); c.lineTo(gx + 38, gy - gh + 9); c.quadraticCurveTo(gx + 13, gy - gh - 14, gx - 10, gy - gh + 9); c.closePath(); c.fill(); c.stroke();
  for (let i = 0; i < 5; i++) { const x = gx + 3 + i * 5.5; c.lineWidth = 2; c.beginPath(); c.moveTo(x, gy - gh * 0.78); c.lineTo(x, gy); c.stroke(); c.fillStyle = pal.gate; c.beginPath(); c.moveTo(x - 2.5, gy - gh * 0.78); c.lineTo(x, gy - gh * 0.86); c.lineTo(x + 2.5, gy - gh * 0.78); c.closePath(); c.fill(); }
  c.lineWidth = 2.5;
  // the road band (cracked asphalt, tar lines, manhole, puddles) is baked here too
  paintRoadBand(c, road, W, rand);
  // the yard below the road
  c.fillStyle = pal.grassDark; c.fillRect(0, road.y + road.band, W, H - road.y - road.band);
  c.fillStyle = shade(pal.grass, -0.2); c.fillRect(0, road.y + road.band + 44 + road.fontPx * 1.2, W, H);
  c.fillStyle = pal.dirt;
  for (let i = 0; i < W / 140; i++) { const x = rand() * W, y = road.y + road.band + 60 + road.fontPx * 1.2 + rand() * Math.max(10, H - road.y - road.band - 80); c.beginPath(); c.ellipse(x, y, 26 + rand() * 30, 6 + rand() * 5, 0, 0, TAU); c.fill(); }
  return { cv, horizon, gate: { x: gx + 13, y: gy, h: gh }, moon: { x: mx, y: my, r: mr }, puddles: road.puddles || [] };
}
function hills(c, W, base, amp, rand, fill) {
  const p1 = rand() * TAU, p2 = rand() * TAU, k1 = 1 + Math.floor(rand() * 2), k2 = 3 + Math.floor(rand() * 3);
  c.fillStyle = fill;
  c.beginPath(); c.moveTo(0, base + 60);
  for (let x = 0; x <= W; x += 10) {
    const u = x / W;
    const y = base - amp * (0.5 + 0.5 * Math.sin(u * TAU * k1 + p1)) * 0.7 - amp * 0.3 * Math.sin(u * TAU * k2 + p2);
    c.lineTo(x, y);
  }
  c.lineTo(W, base + 60); c.closePath(); c.fill();
}
function bareTree(c, x, y, h, rand) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  const branch = (x0, y0, ang, len, w, depth) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    c.lineWidth = w + 3; c.strokeStyle = OUT; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.lineWidth = w; c.strokeStyle = '#2a1d2e'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (depth > 0) { branch(x1, y1, ang - 0.5 - rand() * 0.4, len * 0.68, w * 0.6, depth - 1); branch(x1, y1, ang + 0.4 + rand() * 0.4, len * 0.62, w * 0.6, depth - 1); if (rand() < 0.5) branch(x1, y1, ang + (rand() - 0.5) * 0.3, len * 0.5, w * 0.5, depth - 1); }
  };
  branch(x, y, -Math.PI / 2 + (rand() - 0.5) * 0.3, h * 0.42, Math.max(5, h * 0.08), 3);
}
export function drawBackdrop(ctx, bd, view) {
  ctx.drawImage(bd.cv, 0, 0, view.W, view.H);
}
// per-frame sky life: cloud wisps over the moon, a thin fog bank at the hill line, the odd lightning (brief, soft)
export function drawStorm(ctx, view, bd, t, pal) {
  const m = bd.moon;
  ctx.fillStyle = withAlpha('#1a1230', 0.5);
  for (let i = 0; i < 3; i++) {
    const w = m.r * (1.6 + i * 0.5), x = ((t * (6 + i * 3) + i * 170) % (view.W + w * 2)) - w;
    ctx.beginPath(); ctx.ellipse(x, m.y + (i - 1) * m.r * 0.45, w, m.r * 0.13, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = withAlpha(pal.fog, 0.08);
  for (let i = 0; i < 4; i++) {
    const x = ((t * 9 * (0.6 + i * 0.25) + i * 260) % (view.W + 320)) - 160;
    ctx.beginPath(); ctx.ellipse(x, bd.horizon + 22 + i * 7, 170, 12 + i * 3, 0, 0, TAU); ctx.fill();
  }
  // lightning every ~13 s: two flickers and a jagged bolt on the far hills
  const P = 13, ph = t % P, n = Math.floor(t / P);
  const a = ph < 0.07 ? 0.3 : ph < 0.13 ? 0.06 : ph < 0.22 ? 0.22 * (1 - (ph - 0.13) / 0.09) : 0;
  if (a > 0) {
    ctx.fillStyle = withAlpha('#cdbfff', a); ctx.fillRect(0, 0, view.W, bd.horizon + 20);
    const rand = mulberry32(n * 977 + 13);
    let x = view.W * (0.1 + rand() * 0.8), y = 0;
    ctx.strokeStyle = withAlpha('#f3ecff', Math.min(1, a * 3)); ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    while (y < bd.horizon - 10) { x += (rand() - 0.5) * 40; y += 14 + rand() * 20; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}
// the thin low fog that lies along the road (in front of the zombies' feet)
export function drawLowFog(ctx, view, road, t, pal) {
  const y = road.y - road.band - 4;
  ctx.fillStyle = withAlpha(pal.fog, 0.1);
  for (let i = 0; i < 6; i++) {
    const w = 120 + (i % 3) * 50;
    const x = ((t * (7 + i * 2.5) + i * 190) % (view.W + w * 2)) - w;
    ctx.beginPath(); ctx.ellipse(x, y + (i % 2) * 5, w, 9 + (i % 2) * 4, 0, 0, TAU); ctx.fill();
  }
}
// puddles catch the moon (a slow shimmer)
export function drawPuddleGlints(ctx, puddles, t) {
  for (let i = 0; i < puddles.length; i++) {
    const p = puddles[i];
    const k = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2);
    ctx.fillStyle = withAlpha('#efe3b4', 0.1 + 0.1 * k);
    ctx.beginPath(); ctx.ellipse(p.x + p.rx * 0.25, p.y - p.ry * 0.2, p.rx * 0.4, p.ry * 0.3, 0, 0, TAU); ctx.fill();
  }
}

// ---------- fence, jack-o'-lanterns, kid ----------
export function fenceLayout(view, road) {
  const y0 = road.y + road.band + road.fontPx * 1.9 + 12; // below the metal signs
  const h = clamp(view.H * 0.09, 26, 48);
  const pumpkinR = clamp(h * 0.34, 9, 16);
  const gateX = clamp(Math.max(road.x1 + road.fontPx * 1.1 + 10, view.W - 26), 0, view.W - 9);
  return { y0, h, gateX, laneEnd: gateX - 14, postX: gateX, pumpkinR, bottom: y0 + h };
}
export function drawFence(ctx, view, road, fl, pal, style, pumpkins, lw, t, glow) {
  const { y0, h } = fl;
  ctx.lineJoin = 'round'; ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT;
  if (style === 'stone') {
    ctx.fillStyle = pal.fence;
    roundRect(ctx, -4, y0, view.W + 8, h, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = withAlpha(OUT, 0.5); ctx.lineWidth = lw;
    for (let x = 0; x < view.W; x += 34) { ctx.strokeRect(x + ((Math.floor(x / 34) % 2) ? 10 : 0), y0 + 4, 30, h * 0.4); ctx.strokeRect(x, y0 + h * 0.55, 30, h * 0.4); }
  } else if (style === 'picket') {
    ctx.fillStyle = pal.fence;
    const pw = 11, gap = 9;
    for (let x = 6; x < view.W; x += pw + gap) {
      const lean = ((x * 7) % 5) - 2;
      ctx.beginPath(); ctx.moveTo(x, y0 + 6); ctx.lineTo(x + pw / 2 + lean, y0 - 3); ctx.lineTo(x + pw, y0 + 6); ctx.lineTo(x + pw, y0 + h); ctx.lineTo(x, y0 + h); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillRect(0, y0 + h * 0.3, view.W, 5); ctx.strokeRect(-2, y0 + h * 0.3, view.W + 4, 5);
    ctx.fillRect(0, y0 + h * 0.7, view.W, 5); ctx.strokeRect(-2, y0 + h * 0.7, view.W + 4, 5);
  } else {
    // wrought iron: a stone curb, two rails, spear-tipped bars, and a wooden repair patch
    ctx.fillStyle = '#2e2b3a'; roundRect(ctx, -4, y0 + h - 6, view.W + 8, 8, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.fence;
    for (let x = 8; x < view.W; x += 15) {
      const lean = ((x * 13) % 7 === 0) ? 1.5 : 0;
      ctx.fillRect(x - 1.5, y0 + 2, 3, h - 6); ctx.strokeRect(x - 1.5 + lean, y0 + 2, 3, h - 6);
      ctx.beginPath(); ctx.moveTo(x - 4, y0 + 4); ctx.lineTo(x, y0 - 7); ctx.lineTo(x + 4, y0 + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillRect(0, y0 + h * 0.28, view.W, 4); ctx.strokeRect(-2, y0 + h * 0.28, view.W + 4, 4);
    ctx.fillRect(0, y0 + h * 0.72, view.W, 4); ctx.strokeRect(-2, y0 + h * 0.72, view.W + 4, 4);
    ctx.fillStyle = '#3f3c4e'; for (let x = 8; x < view.W; x += 15) ctx.fillRect(x - 0.5, y0 + 4, 1, h - 10);
    // the repair patch: planks nailed over a gap
    const px = view.W * 0.3;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(px + i * 15, y0 + h * 0.5); ctx.rotate((i % 2 ? 1 : -1) * 0.05);
      ctx.fillStyle = i % 2 ? '#6b4a2a' : '#7a5633'; roundRect(ctx, -6, -h * 0.52, 12, h * 1.04, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, -h * 0.35, 1.5, 0, TAU); ctx.arc(0, h * 0.35, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#5a4020'; ctx.fillRect(px - 10, y0 + h * 0.3, 66, 4); ctx.strokeRect(px - 10, y0 + h * 0.3, 66, 4);
  }
  // the gate pillar at the lane's end with an iron lantern
  const px = fl.postX, top = road.y - road.band - 6;
  ctx.fillStyle = '#3a3646'; ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT;
  roundRect(ctx, px - 8, top - 30, 16, y0 + h - top + 30, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a4658'; ctx.fillRect(px - 6, top - 26, 3, y0 + h - top + 22);
  ctx.fillStyle = '#2a2734'; roundRect(ctx, px - 11, top - 36, 22, 7, 2); ctx.fill(); ctx.stroke();
  const g = 0.75 + 0.25 * Math.sin(t * 7 + Math.sin(t * 13));
  ctx.fillStyle = withAlpha('#ff9a2e', 0.2 * g); ctx.beginPath(); ctx.arc(px, top - 50, 30, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1b1a24'; roundRect(ctx, px - 7, top - 62, 14, 22, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = withAlpha('#ffb13b', 0.85 * g); roundRect(ctx, px - 4, top - 58, 8, 14, 1); ctx.fill();
  ctx.fillStyle = OUT; roundRect(ctx, px - 9, top - 66, 18, 5, 2); ctx.fill(); ctx.fillRect(px - 1.5, top - 70, 3, 5);
  // jack-o'-lanterns on the ground in front of the fence
  const r = fl.pumpkinR;
  for (let i = 0; i < pumpkins; i++) drawPumpkin(ctx, px - 22 - i * (r * 2.9), y0 + h + r * 0.95, r, lw, 0.45 + 0.55 * glow, t + i);
}
export function drawPumpkin(ctx, x, y, r, lw, glow = 0.5, t = 0) {
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  const fl = 0.8 + 0.2 * Math.sin(t * 9 + Math.sin(t * 17));
  if (glow > 0) { ctx.fillStyle = withAlpha('#ff9a2e', 0.22 * glow * fl); ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#e8731f';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.18, r, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = withAlpha(OUT, 0.4); ctx.lineWidth = lw * 0.9;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.5, r * 0.96, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.98, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3;
  ctx.fillStyle = '#3f6a2a'; roundRect(ctx, x - r * 0.16, y - r * 1.38, r * 0.32, r * 0.5, r * 0.1); ctx.fill(); ctx.stroke();
  // the carved face glows
  ctx.fillStyle = `rgba(255,${200 + Math.round(40 * fl)},90,${0.75 + 0.25 * glow})`;
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, y - r * 0.15); ctx.lineTo(x - r * 0.2, y - r * 0.1); ctx.lineTo(x - r * 0.45, y - r * 0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 0.15); ctx.lineTo(x + r * 0.2, y - r * 0.1); ctx.lineTo(x + r * 0.45, y - r * 0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.2); ctx.lineTo(x - r * 0.35, y + r * 0.42); ctx.lineTo(x - r * 0.2, y + r * 0.22); ctx.lineTo(x, y + r * 0.5); ctx.lineTo(x + r * 0.2, y + r * 0.22); ctx.lineTo(x + r * 0.4, y + r * 0.44); ctx.lineTo(x + r * 0.6, y + r * 0.2); ctx.closePath(); ctx.fill();
}
// the kid: a 9-year-old in a hoodie, goggles pushed up, fingerless gloves, a backpack slime tank with a hose to the
// shoulder cannon. Back three-quarter view, feet at (x, y), height h. armK 0..1 = the shot recoil.
export function kidMuzzle(kid) {
  const u = kid.h / 60;
  return { x: kid.x + 24 * u, y: kid.y - 62 * u };
}
export function drawKid(ctx, x, y, h, lw, armK, t, look = {}, goo = '#8cff1a') {
  const u = h / 60;
  const hood = look.shirt || '#4d4470', hoodLight = shade(hood, 0.22);
  const recoil = armK > 0 ? Math.sin(Math.min(1, armK) * Math.PI) : 0;
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT;
  ctx.fillStyle = withAlpha('#000000', 0.25); ctx.beginPath(); ctx.ellipse(2 * u, 1 * u, 17 * u, 4 * u, 0, 0, TAU); ctx.fill();
  // planted stance: legs apart, sneakers
  ctx.fillStyle = look.pants || '#2f3542';
  roundRect(ctx, -14 * u, -24 * u, 9 * u, 24 * u, 3 * u); ctx.fill(); ctx.stroke();
  roundRect(ctx, 5 * u, -24 * u, 9 * u, 24 * u, 3 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8e4dc'; roundRect(ctx, -16 * u, -5 * u, 12 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke(); roundRect(ctx, 4 * u, -5 * u, 12 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5d2e'; ctx.fillRect(-14 * u, -3 * u, 8 * u, 1.6 * u); ctx.fillRect(6 * u, -3 * u, 8 * u, 1.6 * u);
  // hoodie torso + arms
  ctx.fillStyle = hood;
  roundRect(ctx, -13 * u, -44 * u, 26 * u, 24 * u, 5 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hoodLight; roundRect(ctx, -9 * u, -44 * u, 18 * u, 7 * u, 3 * u); ctx.fill(); ctx.stroke(); // the hood bunched at the neck
  ctx.fillStyle = hood;
  ctx.save(); ctx.translate(-12 * u, -40 * u); ctx.rotate(0.35); roundRect(ctx, -3.5 * u, 0, 7 * u, 17 * u, 3 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2430'; roundRect(ctx, -3.5 * u, 15 * u, 7 * u, 5 * u, 2 * u); ctx.fill(); ctx.stroke(); // glove
  ctx.fillStyle = look.skin || '#f3c9a6'; roundRect(ctx, -3 * u, 19 * u, 6 * u, 3 * u, 1.5 * u); ctx.fill(); ctx.stroke(); ctx.restore();
  // backpack tank (on the back: we see the kid from behind)
  ctx.fillStyle = '#3a3a48'; roundRect(ctx, -11 * u, -46 * u, 22 * u, 26 * u, 4 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = withAlpha(goo, 0.9); roundRect(ctx, -8 * u, -43 * u, 16 * u, 20 * u, 3 * u); ctx.fill(); ctx.stroke();
  const sl = Math.sin(t * 2) * 1.5 * u;
  ctx.fillStyle = withAlpha('#ffffff', 0.35); roundRect(ctx, -6 * u, -41 * u + sl, 4 * u, 14 * u, 2 * u); ctx.fill();
  ctx.fillStyle = '#6a6a7a'; ctx.fillRect(-11 * u, -36 * u, 22 * u, 2.5 * u); ctx.fillRect(-11 * u, -28 * u, 22 * u, 2.5 * u);
  ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.arc(7 * u, -32 * u, 2.4 * u, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d63a2e'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(7 * u, -32 * u); ctx.lineTo(8.2 * u, -33.6 * u); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3;
  // right arm up on the cannon grip
  ctx.fillStyle = hood;
  ctx.save(); ctx.translate(12 * u, -40 * u); ctx.rotate(-1.9 + recoil * 0.25); roundRect(ctx, -3.5 * u, 0, 7 * u, 15 * u, 3 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2430'; roundRect(ctx, -3.5 * u, 13 * u, 7 * u, 5 * u, 2 * u); ctx.fill(); ctx.stroke(); ctx.restore();
  // head: hair + goggles pushed up
  ctx.fillStyle = look.hair || '#4a2e1a';
  ctx.beginPath(); ctx.arc(0, -52 * u, 11 * u, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = look.skin || '#f3c9a6'; ctx.beginPath(); ctx.arc(-9 * u, -50 * u, 2.6 * u, 0, TAU); ctx.fill(); ctx.stroke(); // an ear
  ctx.fillStyle = '#2a2430'; roundRect(ctx, -12 * u, -56 * u, 24 * u, 3.5 * u, 1.5 * u); ctx.fill(); ctx.stroke(); // strap
  ctx.fillStyle = '#4a4658'; roundRect(ctx, -8 * u, -62 * u, 7 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke(); roundRect(ctx, 1 * u, -62 * u, 7 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = withAlpha('#ffd23f', 0.7); ctx.fillRect(-6.5 * u, -60.5 * u, 4 * u, 3 * u); ctx.fillRect(2.5 * u, -60.5 * u, 4 * u, 3 * u);
  // the hose from the tank to the cannon
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8 * u, -46 * u); ctx.quadraticCurveTo(22 * u, -40 * u, 14 * u, -50 * u); ctx.stroke();
  ctx.strokeStyle = '#4e8a2a'; ctx.lineWidth = lw * 1.8; ctx.beginPath(); ctx.moveTo(8 * u, -46 * u); ctx.quadraticCurveTo(22 * u, -40 * u, 14 * u, -50 * u); ctx.stroke();
  // the slime cannon on the shoulder (a chunky tube, angled up toward the road)
  ctx.save(); ctx.translate(10 * u - recoil * 3 * u, -46 * u + recoil * 1.5 * u); ctx.rotate(-0.85);
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT;
  ctx.fillStyle = '#4a4658'; roundRect(ctx, -6 * u, -5 * u, 26 * u, 10 * u, 3 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2f2b3a'; roundRect(ctx, 14 * u, -6.5 * u, 8 * u, 13 * u, 2 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6a6a7a'; ctx.fillRect(-2 * u, -3 * u, 10 * u, 1.6 * u);
  ctx.fillStyle = withAlpha(goo, 0.9); roundRect(ctx, 2 * u, -2.2 * u, 9 * u, 4.4 * u, 1.5 * u); ctx.fill();
  ctx.fillStyle = withAlpha(goo, 0.35 + 0.5 * recoil); ctx.beginPath(); ctx.arc(22 * u, 0, (3 + 4 * recoil) * u, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}
// the slime grenade: a glass flask of sloshing goo with a metal cap and a blinking light
export function drawGrenade(ctx, x, y, r, rot, goo, lw, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.fillStyle = '#4a4658';
  roundRect(ctx, -r * 0.35, -r * 1.45, r * 0.7, r * 0.6, r * 0.12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = withAlpha('#9fd8ff', 0.35);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.fillStyle = goo; ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 1.1, r * 0.85, Math.sin(t * 5) * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(goo, -0.3); ctx.beginPath(); ctx.arc(r * 0.3, r * 0.45, r * 0.22, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = withAlpha('#ffffff', 0.5); ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.4, r * 0.25, r * 0.15, -0.7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6a6a7a'; ctx.fillRect(-r * 0.9, -r * 0.1, r * 1.8, r * 0.18);
  ctx.fillStyle = Math.sin(t * 20) > 0 ? '#ff5d2e' : '#7a2a1a'; ctx.beginPath(); ctx.arc(0, -r * 1.3, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}
export function drawArcPreview(ctx, pts, n, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 1; i < n; i += 2) { ctx.beginPath(); ctx.arc(pts[i * 2], pts[i * 2 + 1], 2.2, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ---------- splats (thick, gloopy, with drips; persist on the road and fade) ----------
// sp: { x, y, r, kind: 'full'|'edge'|'plop', seed, t, life, goo }
export function drawSplat(ctx, sp, lw) {
  const k = clamp(sp.t / sp.life, 0, 1);
  const grow = sp.kind === 'plop' ? 1 : popScale(clamp(sp.t / 0.25, 0, 1));
  const r = sp.r * grow;
  const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  if (alpha <= 0.01 || r <= 0) return;
  ctx.globalAlpha = alpha;
  const rand = mulberry32(sp.seed);
  const n = sp.kind === 'full' ? 9 : sp.kind === 'edge' ? 6 : 4;
  const rim = shade(sp.goo, -0.3);
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3; ctx.lineJoin = 'round';
  const lobes = [];
  for (let i = 0; i < n; i++) lobes.push(0.7 + rand() * 0.5);
  const blob = (scale) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, rr = r * scale * (sp.kind === 'edge' ? 0.5 + 0.5 * Math.abs(Math.cos(a)) : 1) * lobes[i % n];
      const px = sp.x + Math.cos(a) * rr * 1.5, py = sp.y + Math.sin(a) * rr * 0.55;
      if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(sp.x + Math.cos(a - TAU / n / 2) * rr * 1.95, sp.y + Math.sin(a - TAU / n / 2) * rr * 0.8, px, py);
    }
    ctx.closePath();
  };
  ctx.fillStyle = rim; blob(1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = sp.goo; blob(0.8); ctx.fill();
  // drips hang down over time
  const dripK = clamp(sp.t / 1.4, 0, 1);
  const nd = sp.kind === 'plop' ? 1 : 3;
  for (let i = 0; i < nd; i++) {
    const dx = sp.x + (rand() - 0.5) * r * 1.6, len = (r * 0.4 + rand() * r * 0.7) * dripK, w = 2 + rand() * 2.5;
    ctx.strokeStyle = OUT; ctx.lineWidth = w + lw * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dx, sp.y + r * 0.3); ctx.lineTo(dx, sp.y + r * 0.3 + len); ctx.stroke();
    ctx.strokeStyle = sp.goo; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(dx, sp.y + r * 0.3); ctx.lineTo(dx, sp.y + r * 0.3 + len); ctx.stroke();
    ctx.fillStyle = sp.goo; ctx.strokeStyle = OUT; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(dx, sp.y + r * 0.3 + len, w * 0.9, 0, TAU); ctx.fill(); ctx.stroke();
  }
  for (let i = 0; i < (sp.kind === 'plop' ? 2 : 4); i++) {
    const a = rand() * TAU, d = r * (1.5 + rand() * 0.8);
    ctx.fillStyle = sp.goo; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(sp.x + Math.cos(a) * d * 1.3, sp.y + Math.sin(a) * d * 0.5, r * (0.12 + rand() * 0.14), 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = withAlpha('#ffffff', 0.3);
  ctx.beginPath(); ctx.ellipse(sp.x - r * 0.45, sp.y - r * 0.18, r * 0.35, r * 0.12, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- particles ----------
export const P_GOO = 0, P_CONFETTI = 1, P_RING = 2, P_DUST = 3, P_SPARK = 4, P_STAR = 5, P_CRACK = 6;
export function makeParticles(max) {
  const parts = [];
  for (let i = 0; i < max; i++) parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', type: 0, a: 0, va: 0, g: 0, extra: 0, floor: 0 });
  return { parts, n: 0, max };
}
export function spawnParticle(ps, type, x, y, vx, vy, life, size, color, g = 900, floor = 1e9) {
  if (ps.n >= ps.max) return null;
  const p = ps.parts[ps.n++];
  p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color; p.a = Math.random() * TAU; p.va = (Math.random() - 0.5) * 12; p.g = g; p.extra = Math.random(); p.floor = floor;
  return p;
}
export function stepParticles(ps, dt) {
  let n = ps.n;
  for (let i = 0; i < n; i++) {
    const p = ps.parts[i];
    p.life -= dt;
    if (p.life <= 0) { ps.parts[i] = ps.parts[n - 1]; ps.parts[n - 1] = p; n--; i--; continue; }
    p.vy += p.g * dt;
    if (p.type === P_CONFETTI) { p.vx *= 1 - 1.8 * dt; p.vy = Math.min(p.vy, 140); }
    p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
    if (p.y > p.floor) { p.y = p.floor; p.vy = -Math.abs(p.vy) * 0.3; p.vx *= 0.6; }
  }
  ps.n = n;
}
export function drawParticles(ctx, ps, lw) {
  const parts = ps.parts;
  for (let i = 0; i < ps.n; i++) {
    const p = parts[i];
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 1.8);
    ctx.fillStyle = p.color;
    if (p.type === P_CONFETTI) {
      const w = p.size * 2 * Math.abs(Math.cos(p.a)) + 1;
      ctx.fillRect(p.x - w / 2, p.y - p.size / 2, w, p.size);
    } else if (p.type === P_RING) {
      // the crack ring: a jagged expanding ellipse
      const u = 1 - k, R = p.size * (0.3 + u);
      ctx.strokeStyle = p.color; ctx.lineWidth = lw * (0.6 + 2.4 * k); ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let j = 0; j <= 14; j++) { const a = (j / 14) * TAU, jit = 1 + ((j * 7919) % 5) * 0.03; const px = p.x + Math.cos(a) * R * jit, py = p.y + Math.sin(a) * R * 0.45 * jit; if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
    } else if (p.type === P_CRACK) {
      // asphalt cracks radiating from the thunk (fade slowly)
      ctx.strokeStyle = p.color; ctx.lineWidth = lw * 1.1; ctx.lineJoin = 'round';
      const a = p.a, L = p.size;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(a) * L * 0.4, p.y + Math.sin(a) * L * 0.18); ctx.lineTo(p.x + Math.cos(a + 0.3) * L * 0.7, p.y + Math.sin(a + 0.3) * L * 0.3); ctx.lineTo(p.x + Math.cos(a - 0.1) * L, p.y + Math.sin(a - 0.1) * L * 0.42);
      ctx.stroke();
    } else if (p.type === P_SPARK) {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
    } else if (p.type === P_STAR) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.beginPath(); for (let j = 0; j < 8; j++) { const r = j % 2 ? p.size * 0.4 : p.size; const a = (j / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.type === P_DUST) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - k * 0.8), 0, TAU); ctx.fill();
    } else {
      // a goo drop: teardrop with outline and a highlight
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      ctx.lineWidth = lw * 0.9; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = withAlpha('#ffffff', 0.35); ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- popups and banners ----------
// popups: [{ text, x, y, t, life, color, scale, rise, tilt }]
export function drawPopups(ctx, popups, base, W = Infinity) {
  for (let i = 0; i < popups.length; i++) {
    const p = popups[i];
    const k = p.t / p.life;
    const y = p.y - k * (p.rise == null ? 28 : p.rise);
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
    const size = base * (p.scale || 1) * pop;
    const half = textWidth(p.text, size) / 2 + 6;
    const x = W === Infinity ? p.x : clamp(p.x, half, W - half);
    ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    spriteText(ctx, p.text, size, x, y, p.color || '#ffffff', true, p.tilt || 0);
  }
  ctx.globalAlpha = 1;
}
export function drawBanner(ctx, text, view, k, color, sub) {
  const s = k < 0.15 ? popScale(k / 0.15) : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  if (s <= 0.01) return;
  const fz = clamp(Math.min(view.W, view.H) * 0.12, 28, 58) * s;
  const y = view.H * 0.22;
  ctx.globalAlpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  const w = textWidth(text, fz) + fz, h = fz * 1.5;
  ctx.save(); ctx.translate(view.W / 2, y); ctx.rotate(-0.04);
  ctx.fillStyle = withAlpha(OUT, 0.7);
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, 4); ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
  spriteText(ctx, text, fz, 0, 0, color, true);
  if (sub) spriteText(ctx, sub, fz * 0.42, 0, h * 0.78, '#ffffff', true);
  ctx.restore();
  ctx.globalAlpha = 1;
}
export function drawFlash(ctx, view, a, col) {
  if (a <= 0.01) return;
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, view.W, view.H); ctx.globalAlpha = 1;
}
// weather: thicker fog / bats / rain / twinkling stars (cheap, stateless in t)
export function drawWeather(ctx, kind, view, bd, t) {
  if (kind === 'fog') {
    ctx.fillStyle = withAlpha('#8d82b0', 0.12);
    for (let i = 0; i < 5; i++) {
      const x = ((t * 12 * (0.5 + i * 0.2) + i * 230) % (view.W + 300)) - 150;
      ctx.beginPath(); ctx.ellipse(x, bd.horizon + 40 + i * 12, 160, 18 + i * 3, 0, 0, TAU); ctx.fill();
    }
  } else if (kind === 'bats') {
    ctx.fillStyle = OUT;
    for (let i = 0; i < 6; i++) {
      const x = ((t * 60 * (0.6 + i * 0.1) + i * 170) % (view.W + 80)) - 40, y = bd.horizon * (0.2 + 0.1 * i) + Math.sin(t * 3 + i) * 10;
      const f = Math.sin(t * 14 + i) * 5;
      ctx.beginPath(); ctx.moveTo(x - 10, y - f); ctx.quadraticCurveTo(x - 5, y + 2, x, y); ctx.quadraticCurveTo(x + 5, y + 2, x + 10, y - f); ctx.quadraticCurveTo(x + 5, y + 5, x, y + 4); ctx.quadraticCurveTo(x - 5, y + 5, x - 10, y - f); ctx.fill();
    }
  } else if (kind === 'rain') {
    ctx.strokeStyle = withAlpha('#cfe6ff', 0.3); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) { const x = (i * 97 + t * 40) % view.W, y = (i * 61 + t * 520) % view.H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); }
    ctx.stroke();
  } else if (kind === 'stars') {
    ctx.fillStyle = '#fff6d6';
    for (let i = 0; i < 12; i++) { const a = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7); ctx.globalAlpha = a; const x = (i * 131 + 40) % view.W, y = (i * 53 + 20) % (bd.horizon * 0.6); ctx.fillRect(x, y, 2.5, 2.5); }
    ctx.globalAlpha = 1;
  }
}
// the scout: a scruffy crow on the gate arch who calls the fraction
export function drawCrow(ctx, x, y, s, t, calling, lw) {
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineWidth = lw * 1.2; ctx.strokeStyle = OUT;
  ctx.fillStyle = '#1e1a2a';
  // ruffled body
  ctx.beginPath(); ctx.moveTo(-s * 0.85, -s * 0.45);
  for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; const rr = s * (i % 2 ? 0.78 : 0.62); ctx.lineTo(Math.cos(a) * rr * 1.05, -s * 0.5 + Math.sin(a) * rr * 0.75); }
  ctx.lineTo(s * 0.7, -s * 0.2); ctx.lineTo(-s * 1.2, -s * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); // tail
  ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.95, s * 0.32, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.35, -s * 1.2); ctx.lineTo(s * 0.3, -s * 1.45); ctx.lineTo(s * 0.5, -s * 1.25); ctx.lineTo(s * 0.55, -s * 1.5); ctx.lineTo(s * 0.68, -s * 1.22); ctx.closePath(); ctx.fill(); ctx.stroke(); // head tuft
  ctx.fillStyle = '#e0a030';
  const open = calling ? Math.abs(Math.sin(t * 12)) * s * 0.12 : 0;
  ctx.beginPath(); ctx.moveTo(s * 0.8, -s * 1.0); ctx.lineTo(s * 1.2, -s * 0.95 - open); ctx.lineTo(s * 0.8, -s * 0.86); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(s * 0.62, -s * 1.02, s * 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(s * 0.65, -s * 1.02, s * 0.05, 0, TAU); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.9; ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 1.16); ctx.lineTo(s * 0.74, -s * 1.1); ctx.stroke(); // a mean brow
  ctx.strokeStyle = '#e0a030'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.1); ctx.lineTo(-s * 0.15, 0); ctx.moveTo(s * 0.15, -s * 0.1); ctx.lineTo(s * 0.15, 0); ctx.stroke();
  ctx.restore();
}
