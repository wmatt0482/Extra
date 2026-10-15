// Canvas 2D renderer: bright flat cartoon style with bold outlines.
// World coordinates are meters with +y UP; the camera maps them to CSS pixels.

import { TAU, mulberry32, clamp, mix, shade, withAlpha, luminance } from './util.js';
import { drawChassis, drawWheel } from './car.js';

export const OUT = '#1d1b26';
const FONT = '900 {S}px "Arial Black", "Helvetica Neue", system-ui, -apple-system, sans-serif';
// world-space labels use sub-pixel sizes (0.42 m): only round screen-space sizes
const font = (s) => FONT.replace('{S}', s >= 6 ? Math.round(s) : Math.round(s * 100) / 100);

// ---------- text sprites ----------
// Text is the most expensive thing this renderer draws on a software-rasterised canvas, and every new
// on-screen size (zoom changes, popups popping in) misses the glyph cache. So each label is rendered once
// into a small bitmap at a fixed size and drawn with drawImage, scaled by the current transform.
const sprites = new Map();
let probe = null;
function mkCanvas(w, h) {
  // a plain <canvas> (same backing as the game canvas): an OffscreenCanvas can be GPU-backed while the
  // game canvas is not, and then every drawImage from it is a readback
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}
// px: sprite font size; lw: outline width in sprite px (0 = no outline)
function textSprite(text, fill, px, lw, scale) {
  const key = `${px}|${lw}|${scale}|${fill}|${text}`;
  let sp = sprites.get(key);
  if (sp) return sp;
  if (sprites.size > 160) sprites.clear();
  if (!probe) probe = mkCanvas(4, 4).getContext('2d');
  probe.font = font(px);
  const w = Math.ceil(probe.measureText(text).width + lw * 2 + 6), h = Math.ceil(px * 1.3 + lw * 2 + 4);
  const cv = mkCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  const c = cv.getContext('2d');
  c.scale(scale, scale);
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
// draw `text` centred at (x, y) with font size `size` in the current units (outline `lw` in the same units)
function spriteText(ctx, text, size, x, y, fill, lw = 0) {
  try {
    const PX = 64, k = size / PX;
    const sp = textSprite(text, fill, PX, lw > 0 ? Math.max(1, Math.round(lw / k)) : 0, 1);
    ctx.drawImage(sp.cv, x - (sp.w * k) / 2, y - (sp.h * k) / 2, sp.w * k, sp.h * k);
  } catch (_) {
    ctx.font = font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.strokeText(text, x, y); }
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
}

const STYLE_BY_TRACK = { canyon: 'mesa', city: 'city', desert: 'dunes', arctic: 'peaks', moon: 'lunar' };

// ---------- backdrop (parallax layers), generated once per run ----------
export function createBackdrop(track, seed) {
  const rand = mulberry32((seed * 31 + 7) >>> 0);
  const theme = track.theme;
  const style = track.style || STYLE_BY_TRACK[track.id] || 'hills';
  const night = luminance(theme.sky[0]) < 0.22;
  const planet = track.planet || (night ? 'earth' : 'none');
  const P = 2400; // layer period in px
  const far = [], mid = [];
  const waves = (n) => Array.from({ length: n }, (_, i) => ({ n: 1 + Math.floor(rand() * (3 + i * 3)), a: rand(), p: rand() * TAU }));
  if (style === 'forest') {
    // tree line: far = tall conifers, mid = round canopies on trunks
    for (let x = 0; x < P; ) { const w = 40 + rand() * 50; far.push({ x, w, h: 90 + rand() * 110 }); x += w * (0.55 + rand() * 0.4); }
    for (let x = 0; x < P; ) { const w = 50 + rand() * 60; mid.push({ x, w, h: 50 + rand() * 60, seed: rand() }); x += w * (0.8 + rand() * 0.6); }
  } else if (style === 'volcano') {
    for (let x = 0; x < P; ) { const w = 260 + rand() * 300; far.push({ x, w, h: 120 + rand() * 120, glow: rand() < 0.5 }); x += w * (0.5 + rand() * 0.3); }
    for (let x = 0; x < P; ) { const w = 120 + rand() * 180; mid.push({ x, w, h: 40 + rand() * 60 }); x += w * (0.7 + rand() * 0.5); }
  } else if (style === 'castle') {
    for (let x = -100; x < P; ) { const w = 220 + rand() * 260; far.push({ x, w, h: 70 + rand() * 90 }); x += w * (0.5 + rand() * 0.3); }
    for (let x = 0; x < P; ) { const w = 60 + rand() * 50; mid.push({ x, w, h: 60 + rand() * 90, flag: rand() < 0.5 }); x += w + 60 + rand() * 260; }
  } else if (style === 'candy') {
    for (let x = 0; x < P; ) { const w = 160 + rand() * 220; far.push({ x, w, h: 60 + rand() * 80 }); x += w * (0.6 + rand() * 0.4); }
    for (let x = 0; x < P; ) { const w = 36 + rand() * 30; mid.push({ x, w, h: 70 + rand() * 90, hue: rand() }); x += w + 60 + rand() * 160; }
  } else if (style === 'clouds') {
    for (let x = 0; x < P; ) { const w = 200 + rand() * 260; far.push({ x, w, h: 40 + rand() * 50 }); x += w * (0.7 + rand() * 0.5); }
    for (let x = 0; x < P; ) { const w = 140 + rand() * 180; mid.push({ x, w, h: 30 + rand() * 40, tower: rand() < 0.35 }); x += w * (0.9 + rand() * 0.6); }
  } else if (style === 'mesa') {
    for (let x = 0; x < P; ) { const w = 160 + rand() * 260; far.push({ x, w, h: 70 + rand() * 90 }); x += w + 40 + rand() * 200; }
    for (let x = 0; x < P; ) { const w = 120 + rand() * 200; mid.push({ x, w, h: 40 + rand() * 70 }); x += w + 80 + rand() * 260; }
  } else if (style === 'city') {
    for (let x = 0; x < P; ) { const w = 50 + rand() * 70; far.push({ x, w, h: 80 + rand() * 150, ant: rand() < 0.25 }); x += w + 4 + rand() * 18; }
    for (let x = 0; x < P; ) { const w = 60 + rand() * 90; mid.push({ x, w, h: 45 + rand() * 110, seed: rand() }); x += w + 10 + rand() * 40; }
  } else if (style === 'peaks') {
    for (let x = -100; x < P; ) { const w = 220 + rand() * 260; far.push({ x, w, h: 110 + rand() * 120 }); x += w * (0.45 + rand() * 0.3); }
    for (let x = -100; x < P; ) { const w = 160 + rand() * 200; mid.push({ x, w, h: 60 + rand() * 70 }); x += w * (0.5 + rand() * 0.4); }
  } else if (style === 'lunar') {
    for (let x = 0; x < P; ) { const w = 200 + rand() * 300; far.push({ x, w, h: 50 + rand() * 80 }); x += w * (0.6 + rand() * 0.4); }
    for (let x = 0; x < P; ) { const w = 120 + rand() * 200; mid.push({ x, w, h: 25 + rand() * 45, cr: rand() }); x += w * (0.7 + rand() * 0.5); }
  }
  const clouds = [];
  for (let i = 0; i < 7; i++) clouds.push({ x: rand() * P, y: 0.06 + rand() * 0.3, s: 0.6 + rand() * 0.8, k: 0.02 + rand() * 0.05 });
  const stars = [];
  for (let i = 0; i < 90; i++) stars.push({ x: rand(), y: rand() * 0.75, s: 0.6 + rand() * 1.6, p: rand() * TAU });
  return { style, night, planet, P, far, mid, farW: waves(4), midW: waves(4), clouds, stars, theme };
}

// ---------- background (screen space) ----------
let skyCache = { key: '', g: null };
function drawSky(ctx, W, H, theme) {
  const key = theme.sky.join() + H;
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

function periodicHeight(u, waves, P) {
  let s = 0;
  for (const w of waves) s += Math.sin((u / P) * TAU * w.n + w.p) * (0.4 + w.a * 0.6) / w.n;
  return s;
}

function drawLayer(ctx, W, H, bd, shapes, waves, baseY, scale, off, fill, line, lw, isMid, t, fillTo = H + 2) {
  const P = bd.P * scale;
  const start = -(((off % P) + P) % P);
  ctx.fillStyle = fill;
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  const style = bd.style;
  if (style === 'dunes' || style === 'hills') {
    ctx.beginPath();
    ctx.moveTo(0, H + 2);
    const amp = (isMid ? 38 : 60) * scale;
    for (let x = 0; x <= W + 8; x += 8) {
      const u = (x - start) / scale;
      ctx.lineTo(x, baseY - amp * (1.1 + periodicHeight(u, waves, bd.P)));
    }
    ctx.lineTo(W + 8, H + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  // flat ground under shapes (only down to where the next layer's ground takes over: the canvas is
  // rasterised in software on many devices, so every full-height fill costs)
  ctx.fillRect(0, baseY, W, Math.max(0, fillTo - baseY));
  for (let k = start; k < W; k += P) {
    for (const s of shapes) {
      const x = k + s.x * scale, w = s.w * scale, h = s.h * scale;
      if (x > W || x + w < 0) continue;
      ctx.beginPath();
      if (style === 'mesa') {
        ctx.moveTo(x, baseY + 2);
        ctx.lineTo(x + w * 0.1, baseY - h * 0.55);
        ctx.lineTo(x + w * 0.16, baseY - h);
        ctx.lineTo(x + w * 0.86, baseY - h);
        ctx.lineTo(x + w * 0.9, baseY - h * 0.6);
        ctx.lineTo(x + w, baseY + 2);
      } else if (style === 'city') {
        ctx.rect(x, baseY - h, w, h + 2);
      } else if (style === 'peaks') {
        ctx.moveTo(x, baseY + 2);
        ctx.lineTo(x + w * 0.5, baseY - h);
        ctx.lineTo(x + w, baseY + 2);
      } else if (style === 'lunar') {
        ctx.ellipse(x + w / 2, baseY + 2, w / 2, h, 0, Math.PI, TAU);
      } else if (style === 'forest') {
        if (isMid) {
          // trunk + round canopy
          ctx.rect(x + w * 0.42, baseY - h * 0.45, w * 0.16, h * 0.45 + 2);
          ctx.moveTo(x + w, baseY - h * 0.65);
          ctx.arc(x + w / 2, baseY - h * 0.65, w / 2, 0, TAU);
        } else {
          // conifer: three stacked triangles
          ctx.moveTo(x, baseY + 2);
          ctx.lineTo(x + w * 0.1, baseY - h * 0.35); ctx.lineTo(x + w * 0.2, baseY - h * 0.35);
          ctx.lineTo(x + w * 0.3, baseY - h * 0.68); ctx.lineTo(x + w * 0.38, baseY - h * 0.68);
          ctx.lineTo(x + w * 0.5, baseY - h);
          ctx.lineTo(x + w * 0.62, baseY - h * 0.68); ctx.lineTo(x + w * 0.7, baseY - h * 0.68);
          ctx.lineTo(x + w * 0.8, baseY - h * 0.35); ctx.lineTo(x + w * 0.9, baseY - h * 0.35);
          ctx.lineTo(x + w, baseY + 2);
        }
      } else if (style === 'volcano') {
        // a cone with a flat crater
        ctx.moveTo(x, baseY + 2);
        ctx.lineTo(x + w * 0.42, baseY - h);
        ctx.lineTo(x + w * 0.58, baseY - h);
        ctx.lineTo(x + w, baseY + 2);
      } else if (style === 'castle') {
        if (isMid) {
          // a tower with crenellations
          ctx.moveTo(x, baseY + 2);
          ctx.lineTo(x, baseY - h);
          const n = 4, cw = w / (n * 2 - 1);
          for (let i = 0; i < n; i++) {
            ctx.lineTo(x + cw * (i * 2), baseY - h - cw);
            ctx.lineTo(x + cw * (i * 2 + 1), baseY - h - cw);
            ctx.lineTo(x + cw * (i * 2 + 1), baseY - h);
            if (i < n - 1) ctx.lineTo(x + cw * (i * 2 + 2), baseY - h);
          }
          ctx.lineTo(x + w, baseY + 2);
        } else {
          // rolling hills behind the castle
          ctx.moveTo(x, baseY + 2);
          ctx.quadraticCurveTo(x + w / 2, baseY - h * 2, x + w, baseY + 2);
        }
      } else if (style === 'candy') {
        if (isMid) {
          // a lollipop: stick + disc
          ctx.rect(x + w * 0.42, baseY - h * 0.6, w * 0.16, h * 0.6 + 2);
          ctx.moveTo(x + w, baseY - h * 0.7);
          ctx.arc(x + w / 2, baseY - h * 0.7, w / 2, 0, TAU);
        } else {
          // gumdrop hills
          ctx.moveTo(x, baseY + 2);
          ctx.quadraticCurveTo(x + w * 0.05, baseY - h, x + w / 2, baseY - h);
          ctx.quadraticCurveTo(x + w * 0.95, baseY - h, x + w, baseY + 2);
        }
      } else if (style === 'clouds') {
        // a puffy cloud bank (three arcs), with a little tower on some mid ones
        ctx.moveTo(x, baseY + 2);
        ctx.arc(x + w * 0.25, baseY - h * 0.35, w * 0.25, Math.PI, Math.PI * 1.6);
        ctx.arc(x + w * 0.55, baseY - h * 0.55, w * 0.3, Math.PI * 1.15, Math.PI * 1.9);
        ctx.arc(x + w * 0.8, baseY - h * 0.3, w * 0.2, Math.PI * 1.3, TAU);
        ctx.lineTo(x + w, baseY + 2);
      }
      ctx.fill();
      ctx.stroke();
      // details
      if (style === 'volcano' && !isMid && s.glow) {
        ctx.save();
        ctx.fillStyle = `rgba(255,120,30,${(0.55 + 0.25 * Math.sin(t * 2 + x)).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(x + w * 0.5, baseY - h, w * 0.08, 4 * scale, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,20,0.6)'; ctx.lineWidth = 2.5 * scale;
        ctx.beginPath(); ctx.moveTo(x + w * 0.5, baseY - h); ctx.lineTo(x + w * 0.36, baseY - h * 0.45); ctx.stroke();
        ctx.restore();
      } else if (style === 'castle' && isMid && s.flag) {
        ctx.save();
        ctx.strokeStyle = line; ctx.lineWidth = 2 * scale;
        ctx.beginPath(); ctx.moveTo(x + w / 2, baseY - h); ctx.lineTo(x + w / 2, baseY - h - 26 * scale); ctx.stroke();
        ctx.fillStyle = bd.theme.accent;
        ctx.beginPath(); ctx.moveTo(x + w / 2, baseY - h - 26 * scale); ctx.lineTo(x + w / 2 + 16 * scale, baseY - h - 21 * scale); ctx.lineTo(x + w / 2, baseY - h - 16 * scale); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (style === 'candy' && isMid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * scale;
        ctx.beginPath(); ctx.arc(x + w / 2, baseY - h * 0.7, w * 0.3, 0.3, 2.2); ctx.stroke();
        ctx.restore();
      } else if (style === 'clouds' && isMid && s.tower) {
        ctx.save();
        ctx.fillStyle = mix(fill, '#ffffff', 0.4);
        ctx.fillRect(x + w * 0.45, baseY - h * 0.85 - 30 * scale, w * 0.12, 30 * scale);
        ctx.strokeRect(x + w * 0.45, baseY - h * 0.85 - 30 * scale, w * 0.12, 30 * scale);
        ctx.fillStyle = bd.theme.accent;
        ctx.beginPath(); ctx.moveTo(x + w * 0.43, baseY - h * 0.85 - 30 * scale); ctx.lineTo(x + w * 0.51, baseY - h * 0.85 - 46 * scale); ctx.lineTo(x + w * 0.59, baseY - h * 0.85 - 30 * scale); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (style === 'peaks') {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, baseY - h);
        ctx.lineTo(x + w * 0.5 - w * 0.16, baseY - h * 0.68);
        ctx.lineTo(x + w * 0.45, baseY - h * 0.74);
        ctx.lineTo(x + w * 0.52, baseY - h * 0.66);
        ctx.lineTo(x + w * 0.5 + w * 0.16, baseY - h * 0.68);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (style === 'mesa') {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        for (let j = 1; j < 3; j++) {
          const yy = baseY - h + (h * j) / 3.2;
          ctx.moveTo(x + w * 0.14, yy);
          ctx.lineTo(x + w * 0.88, yy);
        }
        ctx.stroke();
        ctx.restore();
      } else if (style === 'city') {
        ctx.save();
        ctx.fillStyle = isMid ? 'rgba(255,240,170,0.55)' : 'rgba(255,255,255,0.18)';
        const cw = 7 * scale, chh = 9 * scale;
        for (let wy = baseY - h + 10 * scale; wy < baseY - 12 * scale; wy += 18 * scale) {
          for (let wx = x + 7 * scale; wx < x + w - 10 * scale; wx += 15 * scale) {
            if (((wx * 7 + wy * 3) | 0) % 5 === 0) continue;
            ctx.fillRect(wx, wy, cw, chh);
          }
        }
        if (s.ant) {
          ctx.strokeStyle = line;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, baseY - h);
          ctx.lineTo(x + w / 2, baseY - h - 30 * scale);
          ctx.stroke();
          ctx.fillStyle = (Math.sin(t * 3) > 0) ? '#ff4040' : '#802020';
          ctx.beginPath();
          ctx.arc(x + w / 2, baseY - h - 30 * scale, 3 * scale, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      } else if (style === 'lunar' && isMid && s.cr > 0.35) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(x + w * 0.5, baseY - h * 0.45, w * 0.14, h * 0.12, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

let spaceCache = { H: 0, g: null };
function drawSun(ctx, W, H, space) {
  const sx = W * 0.78, sy = H * 0.2, sr = Math.min(W, H) * 0.085;
  const glow = 1 - space;
  if (glow > 0.02) {
    ctx.fillStyle = `rgba(255,250,200,${(0.35 * glow).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,250,200,${(0.45 * glow).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.3, 0, TAU); ctx.fill();
  }
  // in space the sun is a hard white disc with a thin corona
  ctx.fillStyle = space > 0.02 ? mix('#fff4a3', '#ffffff', space) : '#fff4a3';
  ctx.beginPath(); ctx.arc(sx, sy, sr * (1 - 0.25 * space), 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = space > 0.02 ? mix('#f2b13a', '#cfe0ff', space) : '#f2b13a'; ctx.stroke();
  if (space > 0.05) {
    ctx.strokeStyle = `rgba(200,220,255,${(0.35 * space).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.15, 0, TAU); ctx.stroke();
  }
}

export function drawBackground(ctx, view, cam, bd, t, space = 0) {
  const { W, H } = view;
  const theme = bd.theme;
  drawSky(ctx, W, H, theme);
  if (space > 0.01) {
    // ORBIT: the sky darkens toward space
    if (spaceCache.H !== H) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#02030c');
      g.addColorStop(0.55, '#0a0f2e');
      g.addColorStop(1, '#25407a');
      spaceCache = { H, g };
    }
    ctx.globalAlpha = Math.min(1, space * (bd.night ? 0.6 : 1));
    ctx.fillStyle = spaceCache.g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  // horizon drifts down as the camera climbs so altitude reads on screen
  // and sinks toward the terrain baseline when zoomed far out over it
  const baseScreen = H / 2 + (cam.y - bd.baseY) * cam.z;
  const horizon = clamp(Math.max(H * 0.6 + clamp((cam.y - bd.baseY) * cam.z * 0.1, -H * 0.2, H * 0.42), baseScreen - H * 0.22), H * 0.3, H * 1.02);
  const zs = clamp(Math.pow(cam.z / 16, 0.35), 0.7, 1.25);

  if (bd.night || space > 0.05) {
    const sa = bd.night ? 1 : space;
    for (let i = 0; i < bd.stars.length; i++) {
      const s = bd.stars[i];
      const x = (((s.x * W * 1.3 - cam.x * cam.z * 0.01) % (W * 1.3)) + W * 1.3) % (W * 1.3);
      const a = (0.55 + 0.45 * Math.sin(t * 2 + s.p)) * sa;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(x, s.y * H, s.s, s.s);
    }
  }
  if (bd.night && bd.planet === 'moon') {
    // a pale moon with a few craters
    const ex = W * 0.8, ey = H * 0.2, er = Math.min(W, H) * 0.08;
    ctx.fillStyle = 'rgba(255,245,200,0.12)';
    ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4ecc8';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,40,0.14)';
    for (const [dx, dy, r] of [[-0.35, -0.2, 0.22], [0.3, 0.1, 0.16], [-0.05, 0.45, 0.12], [0.1, -0.5, 0.1]]) { ctx.beginPath(); ctx.arc(ex + dx * er, ey + dy * er, r * er, 0, TAU); ctx.fill(); }
    ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
  } else if (bd.night && bd.planet === 'earth') {
    // a big Earth (moon / asteroid tracks)
    const ex = W * 0.8, ey = H * 0.2, er = Math.min(W, H) * 0.11;
    ctx.fillStyle = 'rgba(120,180,255,0.15)';
    ctx.beginPath(); ctx.arc(ex, ey, er * 1.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU);
    ctx.fillStyle = '#3d7bd9'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#4fbf6a';
    ctx.beginPath(); ctx.ellipse(ex - er * 0.3, ey - er * 0.2, er * 0.45, er * 0.3, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ex + er * 0.45, ey + er * 0.35, er * 0.3, er * 0.45, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(ex + er * 0.1, ey - er * 0.75, er * 0.5, er * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,20,0.35)';
    ctx.beginPath(); ctx.arc(ex + er * 0.45, ey + er * 0.2, er, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
  } else if (bd.night) {
    // 'none': an empty night (a faint nebula glow in the accent colour)
    const ex = W * 0.78, ey = H * 0.22, er = Math.min(W, H) * 0.2;
    ctx.fillStyle = withAlpha(bd.theme.accent, 0.08);
    ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.6, er, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = withAlpha(bd.theme.accent, 0.1);
    ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.9, er * 0.5, -0.4, 0, TAU); ctx.fill();
  } else {
    drawSun(ctx, W, H, space);
    // clouds
    ctx.lineWidth = 3;
    ctx.globalAlpha = Math.max(0, 1 - 1.7 * space);
    for (const c of bd.clouds) {
      const span = W + 300;
      const x = ((((c.x - cam.x * cam.z * c.k - t * 6 * c.s) % span) + span) % span) - 150;
      const y = c.y * H + clamp((cam.y - bd.baseY) * cam.z * 0.03, -40, 80);
      puff(ctx, x, y, c.s * zs);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,110,160,0.35)';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // seen from orbit the landscape sinks into a deep blue haze
  const hz = bd.night ? 0 : space * 0.55;
  // colours only change in orbit: cache the ground-level ones on the backdrop (no strings per frame)
  const hzOn = hz > 0.01;
  const cc = bd.layerCols || (bd.layerCols = { farLine: mix(theme.far, '#05081a', 0.25), midLine: mix(theme.mid, '#05081a', 0.35), haze: withAlpha(theme.sky[1], 0.25) });
  const farFill = hzOn ? mix(theme.far, '#101a40', hz) : theme.far;
  const midFill = hzOn ? mix(theme.mid, '#101a40', hz * 0.8) : theme.mid;
  const midBase = horizon + 34 * zs;
  drawLayer(ctx, W, H, bd, bd.far, bd.farW, horizon, zs, cam.x * cam.z * 0.05, farFill, hzOn ? mix(theme.far, '#05081a', 0.25 + hz * 0.5) : cc.farLine, 2.5, false, t, midBase + 4);
  // atmospheric haze between layers
  if (!bd.night && space < 0.98) {
    ctx.fillStyle = space > 0.005 ? withAlpha(theme.sky[1], 0.25 * (1 - space)) : cc.haze;
    ctx.fillRect(0, horizon - 40, W, bd.style === 'dunes' || bd.style === 'hills' ? H : midBase + 4 - (horizon - 40));
  }
  drawLayer(ctx, W, H, bd, bd.mid, bd.midW, midBase, zs * 1.15, cam.x * cam.z * 0.16, midFill, hzOn ? mix(theme.mid, '#05081a', 0.35 + hz * 0.4) : cc.midLine, 3, true, t);
}

// ---------- world ----------
export function worldTransform(ctx, view, cam) {
  const d = view.dpr, z = cam.z;
  ctx.setTransform(d * z, 0, 0, -d * z, d * (view.W / 2 - cam.x * z + cam.sx), d * (view.H / 2 + cam.y * z + cam.sy));
}

let terrainBuf = new Float64Array(1024);
export function drawTerrain(ctx, course, bd, vis, lw, cam) {
  const theme = bd.theme;
  const x0 = Math.max(vis.x0 - 2, course.rampStart - 400), x1 = vis.x1 + 2;
  const bottom = vis.y0 - 5;
  const step = Math.max(0.25, 5 / cam.z);
  const g = course.baseY || course.groundY;
  // reused buffer: no per-frame garbage (the explosion-heavy frames are the ones a GC pause hurts most)
  const need = 2 * (Math.ceil((x1 + step - x0) / step) + 2);
  if (terrainBuf.length < need) terrainBuf = new Float64Array(need * 2);
  const pts = terrainBuf;
  let np = 0;
  for (let x = x0; x <= x1 + step; x += step) { pts[np++] = x; pts[np++] = g(x); }
  // body
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let i = 0; i < np; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineTo(pts[np - 2], bottom);
  ctx.closePath();
  ctx.fillStyle = theme.ground;
  ctx.fill();

  // deep layer + strata
  const style = bd.style;
  ctx.save();
  ctx.clip();
  ctx.fillStyle = theme.groundDark;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let i = 0; i < np; i += 2) ctx.lineTo(pts[i], pts[i + 1] - 2.2 - 0.4 * Math.sin(pts[i] * 0.31));
  ctx.lineTo(pts[np - 2], bottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i < np; i += 2) {
      const y = pts[i + 1] - 4.2 - k * 3.1 - 0.7 * Math.sin(pts[i] * (0.11 + k * 0.05) + k);
      if (i === 0) ctx.moveTo(pts[i], y); else ctx.lineTo(pts[i], y);
    }
    ctx.stroke();
  }
  if (style === 'city') {
    // asphalt band + dashed center line
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4b4f57';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < np; i += 2) {
      if (i === 0) ctx.moveTo(pts[i], pts[i + 1] - 0.8); else ctx.lineTo(pts[i], pts[i + 1] - 0.8);
    }
    ctx.stroke();
    ctx.setLineDash([2, 2.5]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = bd.theme.accent;
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (style === 'volcano' || style === 'candy') {
    // glowing cracks (volcano) / sprinkles (candy) in the deep layer
    const s0 = Math.floor(x0 / 7);
    for (let s = s0; s * 7 < x1; s++) {
      const hh = Math.sin(s * 12.9898) * 43758.5453;
      const r = hh - Math.floor(hh);
      if (r < 0.4) continue;
      const cx = s * 7 + r * 3, cy = g(cx) - 1.6 - r * 3;
      if (style === 'volcano') {
        ctx.strokeStyle = `rgba(255,${Math.round(110 + r * 60)},20,0.7)`; ctx.lineWidth = 0.14;
        ctx.beginPath(); ctx.moveTo(cx - 1.2, cy); ctx.lineTo(cx - 0.3, cy - 0.5 + r); ctx.lineTo(cx + 0.5, cy - 0.2); ctx.lineTo(cx + 1.4, cy + 0.6 - r); ctx.stroke();
      } else {
        ctx.fillStyle = ['#5ee0ff', '#ffe066', '#7ce36a', '#ffffff'][s & 3];
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(r * 3); ctx.fillRect(-0.3, -0.08, 0.6, 0.16); ctx.restore();
      }
    }
  } else if (style === 'lunar') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    const s0 = Math.floor(x0 / 9);
    for (let s = s0; s * 9 < x1; s++) {
      const h = Math.sin(s * 12.9898) * 43758.5453;
      const r = h - Math.floor(h);
      if (r < 0.45) continue;
      const cx = s * 9 + r * 4;
      ctx.beginPath();
      ctx.ellipse(cx, g(cx) - 1.2 - r * 2, 0.8 + r * 1.4, 0.35 + r * 0.4, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // highlight lip + bold outline
  ctx.beginPath();
  for (let i = 0; i < np; i += 2) {
    if (i === 0) ctx.moveTo(pts[i], pts[i + 1] - lw * 1.6); else ctx.lineTo(pts[i], pts[i + 1] - lw * 1.6);
  }
  ctx.strokeStyle = bd.groundLip || (bd.groundLip = shade(theme.ground, 0.3));
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < np; i += 2) {
    if (i === 0) ctx.moveTo(pts[i], pts[i + 1]); else ctx.lineTo(pts[i], pts[i + 1]);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw;
  ctx.stroke();

  // tufts / rocks for texture
  if (cam.z > 6) {
    const s0 = Math.floor(x0 / 3.7);
    for (let s = s0; s * 3.7 < x1; s++) {
      const h = Math.sin(s * 78.233) * 43758.5453;
      const r = h - Math.floor(h);
      if (r < 0.55) continue;
      const x = s * 3.7 + r * 2;
      const y = g(x);
      if (style === 'city' || style === 'lunar') continue;
      ctx.fillStyle = style === 'peaks' ? '#ffffff' : bd.tuftCol || (bd.tuftCol = shade(theme.groundDark, -0.1));
      ctx.beginPath();
      ctx.ellipse(x, y + 0.08, 0.25 + r * 0.3, 0.16 + r * 0.12, 0, 0, Math.PI);
      ctx.fill();
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    }
  }
}

export function drawRamp(ctx, course, bd, vis, lw) {
  if (vis.x0 > 2 || vis.x1 < course.rampStart - 3) return;
  const theme = bd.theme;
  const metal = bd.style === 'city' || bd.style === 'lunar' || bd.style === 'peaks';
  const postCol = metal ? '#59606e' : '#6b4a33';
  const braceCol = metal ? '#7b8394' : '#8a6446';
  const pl = course.plateau;
  // supports
  const xs = [];
  for (let x = course.rampStart + 1; x < -0.5; x += 6) xs.push(x);
  xs.push(-0.6);
  ctx.lineWidth = 0.28;
  ctx.strokeStyle = braceCol;
  ctx.beginPath();
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    const ya = course.rampY(a) - 1, yb = course.rampY(b) - 1;
    if (b < vis.x0 - 6 || a > vis.x1 + 6) continue;
    ctx.moveTo(a, ya); ctx.lineTo(b, pl);
    ctx.moveTo(b, yb); ctx.lineTo(a, pl);
    for (let y = pl + 6; y < Math.min(ya, yb); y += 8) { ctx.moveTo(a, y); ctx.lineTo(b, y); }
  }
  ctx.stroke();
  for (const x of xs) {
    if (x < vis.x0 - 2 || x > vis.x1 + 2) continue;
    const top = course.rampY(x) - 0.8;
    ctx.fillStyle = postCol;
    ctx.fillRect(x - 0.3, pl - 0.5, 0.6, top - pl + 0.5);
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = OUT;
    ctx.strokeRect(x - 0.3, pl - 0.5, 0.6, top - pl + 0.5);
  }
  // deck
  const pts = course.rampPts;
  const deck = 1.3;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] - 1, pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(0, pts[pts.length - 1][1] - deck - 0.8);
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] - deck);
  ctx.lineTo(pts[0][0] - 1, pts[0][1] - deck);
  ctx.closePath();
  ctx.fillStyle = metal ? '#d9dde6' : '#f1e3c8';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // side panel stripes
  ctx.save();
  ctx.clip();
  ctx.fillStyle = withAlpha(theme.accent, 0.85);
  for (let x = course.rampStart; x < 0; x += 4) {
    if (x < vis.x0 - 4 || x > vis.x1 + 4) continue;
    const y = course.rampY(x);
    ctx.beginPath();
    ctx.moveTo(x, y - 0.35);
    ctx.lineTo(x + 1.6, course.rampY(x + 1.6) - 0.35);
    ctx.lineTo(x + 0.9, course.rampY(x + 0.9) - deck);
    ctx.lineTo(x - 0.7, course.rampY(x - 0.7) - deck);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // running surface
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i][0], pts[i][1] - 0.12); else ctx.lineTo(pts[i][0], pts[i][1] - 0.12);
  }
  ctx.strokeStyle = metal ? '#3d424d' : '#5a4636';
  ctx.lineWidth = 0.24;
  ctx.stroke();
  // lip hazard stripes
  const ly = course.rampY(0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-0.9, ly - deck - 0.8, 0.9, deck + 0.8);
  ctx.clip();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-0.9, ly - deck - 0.8, 0.9, deck + 0.8);
  ctx.fillStyle = '#1d1b26';
  for (let k = -3; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(-0.9, ly - deck - 0.8 + k * 0.5);
    ctx.lineTo(0, ly - deck - 0.8 + k * 0.5 + 0.5);
    ctx.lineTo(0, ly - deck - 0.8 + k * 0.5 + 0.75);
    ctx.lineTo(-0.9, ly - deck - 0.8 + k * 0.5 + 0.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // start backstop + flag
  const sx = course.rampStart, sy = course.topY;
  ctx.fillStyle = postCol;
  ctx.fillRect(sx - 1.2, sy - deck, 1.2, deck + 1.6);
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUT;
  ctx.strokeRect(sx - 1.2, sy - deck, 1.2, deck + 1.6);
  ctx.fillStyle = '#e8e8ee';
  ctx.fillRect(sx - 0.8, sy, 0.22, 7);
  ctx.strokeRect(sx - 0.8, sy, 0.22, 7);
  ctx.beginPath();
  ctx.moveTo(sx - 0.58, sy + 7);
  ctx.lineTo(sx + 2.6, sy + 6.2);
  ctx.lineTo(sx - 0.58, sy + 5.2);
  ctx.closePath();
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.stroke();
}

export function drawFinish(ctx, course, vis, lw) {
  const F = course.finish;
  if (F < vis.x0 - 8 || F > vis.x1 + 8) return;
  const gy = Math.min(course.groundY(F - 2.4), course.groundY(F + 2.4));
  const top = gy + 7.5;
  // ground strip
  const cs = 0.5;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      const x = F - 1 + i * cs;
      ctx.fillRect(x, course.groundY(x) - (j + 1) * cs + 0.02, cs, cs);
    }
  }
  for (const px of [F - 2.4, F + 2.4]) {
    const by = course.groundY(px) - 0.5;
    ctx.fillStyle = '#e8e8ee';
    ctx.fillRect(px - 0.18, by, 0.36, top - by);
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = OUT;
    ctx.strokeRect(px - 0.18, by, 0.36, top - by);
  }
  // checkered banner
  const bx = F - 2.8, bw = 5.6, by = top - 1.8, bh = 1.8;
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
  ctx.save();
  ctx.translate(F, top + 0.75);
  ctx.scale(1, -1);
  spriteText(ctx, 'FINISH', 0.95, 0, 0, '#ffd23f', 0.22);
  ctx.restore();
}

// ---------- props ----------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draw one prop piece centred at origin (y up). seg / segs for stacked kinds.
export function drawPropPiece(ctx, kind, def, w, h, seg, segs, lw, role) {
  const c = def.color;
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  switch (kind) {
    case 'crate': {
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = shade(c, -0.4);
      ctx.lineWidth = lw * 0.8;
      ctx.strokeRect(-w / 2 + 0.12, -h / 2 + 0.12, w - 0.24, h - 0.24);
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 0.12, -h / 2 + 0.12); ctx.lineTo(w / 2 - 0.12, h / 2 - 0.12);
      ctx.moveTo(-w / 2 + 0.12, h / 2 - 0.12); ctx.lineTo(w / 2 - 0.12, -h / 2 + 0.12);
      ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'barrel': {
      rr(ctx, -w / 2, -h / 2, w, h, 0.18);
      ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = shade(c, -0.3);
      ctx.fillRect(-w / 2, -h * 0.22, w, 0.1);
      ctx.fillRect(-w / 2, h * 0.18, w, 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-w * 0.32, -h / 2 + 0.1, 0.12, h - 0.2);
      rr(ctx, -w / 2, -h / 2, w, h, 0.18);
      ctx.stroke();
      break;
    }
    case 'glass': {
      if (w > 0.6) { drawGlassBlock(ctx, w, h, lw); break; }
      ctx.fillStyle = withAlpha(c, 0.55);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h * 0.1); ctx.lineTo(w / 2, h * 0.3);
      ctx.moveTo(-w / 2, -h * 0.2); ctx.lineTo(w / 2, -h * 0.05);
      ctx.stroke();
      ctx.strokeStyle = '#4b6b80'; ctx.lineWidth = lw;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'wall': {
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = shade(c, -0.3);
      ctx.lineWidth = lw * 0.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
      ctx.moveTo(seg % 2 ? -w * 0.1 : w * 0.15, -h / 2); ctx.lineTo(seg % 2 ? -w * 0.1 : w * 0.15, 0);
      ctx.moveTo(seg % 2 ? w * 0.2 : -w * 0.2, 0); ctx.lineTo(seg % 2 ? w * 0.2 : -w * 0.2, h / 2);
      ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'cactus': {
      ctx.fillStyle = c;
      rr(ctx, -w / 2, -h / 2, w, h, w / 2); ctx.fill(); ctx.stroke();
      rr(ctx, -w / 2 - 0.45, -h * 0.05, 0.32, h * 0.38, 0.16); ctx.fill(); ctx.stroke();
      rr(ctx, -w / 2 - 0.45, -h * 0.05, 0.6, 0.3, 0.15); ctx.fill();
      rr(ctx, w / 2 + 0.13, h * 0.02, 0.32, h * 0.3, 0.16); ctx.fill(); ctx.stroke();
      rr(ctx, w / 2 - 0.15, h * 0.02, 0.6, 0.28, 0.14); ctx.fill();
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.5;
      ctx.beginPath(); ctx.moveTo(0, -h / 2 + 0.2); ctx.lineTo(0, h / 2 - 0.2); ctx.stroke();
      break;
    }
    case 'car': {
      ctx.fillStyle = c;
      rr(ctx, -w / 2, -h / 2 + 0.3, w, h * 0.5, 0.15); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, -h / 2 + 0.3 + h * 0.5);
      ctx.lineTo(-w * 0.2, h / 2);
      ctx.lineTo(w * 0.18, h / 2);
      ctx.lineTo(w * 0.32, -h / 2 + 0.3 + h * 0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, -h / 2 + 0.36 + h * 0.5);
      ctx.lineTo(-w * 0.17, h / 2 - 0.08);
      ctx.lineTo(w * 0.15, h / 2 - 0.08);
      ctx.lineTo(w * 0.25, -h / 2 + 0.36 + h * 0.5);
      ctx.closePath(); ctx.fill();
      for (const wx of [-w * 0.3, w * 0.3]) {
        ctx.beginPath(); ctx.arc(wx, -h / 2 + 0.3, 0.32, 0, TAU);
        ctx.fillStyle = '#23222b'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(wx, -h / 2 + 0.3, 0.14, 0, TAU);
        ctx.fillStyle = '#ccc'; ctx.fill();
      }
      break;
    }
    case 'billboard': {
      if (seg < segs - 1) {
        ctx.fillStyle = '#6b6f7a';
        ctx.fillRect(-0.12, -h / 2, 0.24, h);
        ctx.strokeRect(-0.12, -h / 2, 0.24, h);
      } else {
        ctx.fillStyle = '#6b6f7a';
        ctx.fillRect(-0.12, -h / 2, 0.24, h * 0.3);
        ctx.fillStyle = c;
        rr(ctx, -1.6, -h / 2 + h * 0.25, 3.2, h * 0.8, 0.1); ctx.fill(); ctx.stroke();
        ctx.save();
        ctx.translate(0, -h / 2 + h * 0.65);
        ctx.scale(1, -1);
        spriteText(ctx, 'JUMP!', 0.6, 0, 0, OUT);
        ctx.restore();
      }
      break;
    }
    case 'snowman': {
      const r1 = w * 0.5, r2 = w * 0.36, r3 = w * 0.25;
      const y1 = -h / 2 + r1, y2 = y1 + r1 + r2 * 0.7, y3 = y2 + r2 + r3 * 0.7;
      ctx.fillStyle = c;
      for (const [y, r] of [[y1, r1], [y2, r2], [y3, r3]]) { ctx.beginPath(); ctx.arc(0, y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath(); ctx.moveTo(r3 * 0.6, y3); ctx.lineTo(r3 * 1.6, y3 - 0.04); ctx.lineTo(r3 * 0.6, y3 - 0.1); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.fillRect(-r3 * 0.9, y3 + r3 * 0.7, r3 * 1.8, 0.08);
      ctx.fillRect(-r3 * 0.6, y3 + r3 * 0.7, r3 * 1.2, r3 * 0.8);
      break;
    }
    case 'dome': {
      ctx.fillStyle = '#b8bcc8';
      ctx.fillRect(-w / 2, -h / 2, w, 0.3);
      ctx.strokeRect(-w / 2, -h / 2, w, 0.3);
      ctx.beginPath();
      ctx.ellipse(0, -h / 2 + 0.3, w / 2 - 0.05, h - 0.3, 0, 0, Math.PI);
      ctx.fillStyle = withAlpha(c, 0.75); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = lw * 0.6;
      ctx.beginPath();
      ctx.ellipse(0, -h / 2 + 0.3, w * 0.25, h - 0.35, 0, 0, Math.PI);
      ctx.moveTo(-w / 2 + 0.2, 0.1); ctx.lineTo(w / 2 - 0.2, 0.1);
      ctx.stroke();
      break;
    }
    case 'rover': {
      ctx.fillStyle = c;
      rr(ctx, -w / 2, -h / 2 + 0.35, w, h * 0.45, 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a5bd9';
      ctx.fillRect(-w * 0.45, h / 2 - 0.25, w * 0.6, 0.18); ctx.strokeRect(-w * 0.45, h / 2 - 0.25, w * 0.6, 0.18);
      ctx.beginPath(); ctx.moveTo(w * 0.3, -h / 2 + 0.35 + h * 0.45); ctx.lineTo(w * 0.35, h / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w * 0.35, h / 2, 0.1, 0, TAU); ctx.fillStyle = '#ff4040'; ctx.fill();
      for (const wx of [-w * 0.35, 0, w * 0.35]) {
        ctx.beginPath(); ctx.arc(wx, -h / 2 + 0.25, 0.25, 0, TAU); ctx.fillStyle = '#4a4a55'; ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'fuel': {
      rr(ctx, -w / 2, -h / 2, w, h, 0.14);
      ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = shade(c, -0.35);
      ctx.fillRect(-w / 2, -h * 0.3, w, 0.09);
      ctx.fillRect(-w / 2, h * 0.26, w, 0.09);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-w * 0.36, -h / 2 + 0.1, 0.1, h - 0.2);
      // hazard diamond with a flame
      ctx.save();
      ctx.translate(0.04, -0.02);
      ctx.beginPath();
      ctx.moveTo(0, 0.3); ctx.lineTo(0.3, 0); ctx.lineTo(0, -0.3); ctx.lineTo(-0.3, 0); ctx.closePath();
      ctx.fillStyle = '#ffd23f'; ctx.fill();
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0.19);
      ctx.quadraticCurveTo(0.14, 0.02, 0.07, -0.13);
      ctx.lineTo(-0.07, -0.13);
      ctx.quadraticCurveTo(-0.13, 0.0, 0, 0.19);
      ctx.fillStyle = '#e0322b'; ctx.fill();
      ctx.restore();
      ctx.lineWidth = lw;
      rr(ctx, -w / 2, -h / 2, w, h, 0.14);
      ctx.stroke();
      ctx.fillStyle = shade(c, -0.2);
      ctx.fillRect(-w * 0.15, h / 2 - 0.02, w * 0.3, 0.08);
      break;
    }
    case 'tnt': {
      ctx.fillStyle = '#b5482c';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      // dynamite sticks peeking out of the top
      ctx.fillStyle = '#e0322b';
      for (const sx of [-0.3, 0, 0.3]) { ctx.fillRect(sx - 0.1, h / 2 - 0.05, 0.2, 0.22); ctx.strokeRect(sx - 0.1, h / 2 - 0.05, 0.2, 0.22); }
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(0, h / 2 + 0.17); ctx.quadraticCurveTo(0.12, h / 2 + 0.42, 0.24, h / 2 + 0.36); ctx.stroke();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = lw;
      ctx.fillStyle = '#f4ead0';
      ctx.fillRect(-w / 2, -0.24, w, 0.48);
      ctx.save();
      ctx.scale(1, -1);
      spriteText(ctx, 'TNT', 0.42, 0, 0.02, '#c9302c');
      ctx.restore();
      ctx.strokeStyle = shade('#b5482c', -0.4);
      ctx.lineWidth = lw * 0.7;
      ctx.strokeRect(-w / 2 + 0.1, -h / 2 + 0.1, w - 0.2, h - 0.2);
      ctx.strokeStyle = OUT; ctx.lineWidth = lw;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case 'scaffold': {
      if (role === 'deck') {
        ctx.fillStyle = '#8a6446';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.save();
        ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
        ctx.fillStyle = '#ffd23f';
        for (let x = -w / 2; x < w / 2; x += 0.9) {
          ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x + 0.45, -h / 2); ctx.lineTo(x + 0.75, h / 2); ctx.lineTo(x + 0.3, h / 2); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        // railing
        ctx.strokeStyle = '#c0c6d0';
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 0.2, h / 2 + 0.7); ctx.lineTo(w / 2 - 0.2, h / 2 + 0.7);
        for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += 1.2) { ctx.moveTo(x, h / 2); ctx.lineTo(x, h / 2 + 0.7); }
        ctx.stroke();
      } else {
        // a scaffold tower: two poles, rungs and cross braces
        const px = w / 2 - 0.07;
        ctx.strokeStyle = '#7b8394';
        ctx.lineWidth = 0.07;
        ctx.beginPath();
        for (let y = -h / 2 + 0.55; y < h / 2 - 0.1; y += 0.8) {
          ctx.moveTo(-px, y); ctx.lineTo(px, y);
          ctx.moveTo(-px, y - 0.8 < -h / 2 ? -h / 2 : y - 0.8); ctx.lineTo(px, y);
        }
        ctx.stroke();
        ctx.fillStyle = c;
        for (const x of [-px, px]) { ctx.fillRect(x - 0.07, -h / 2, 0.14, h); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = OUT; ctx.strokeRect(x - 0.07, -h / 2, 0.14, h); }
        ctx.fillStyle = '#59606e';
        ctx.fillRect(-w / 2 - 0.08, -h / 2, w + 0.16, 0.12);
      }
      break;
    }
    // ---- v3.5 stage 6-20 props ----
    case 'log': {
      ctx.fillStyle = c;
      rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, h * 0.15); ctx.lineTo(w * 0.25, h * 0.15);
      ctx.moveTo(-w * 0.2, -h * 0.2); ctx.lineTo(w * 0.35, -h * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#e0b377';
      ctx.beginPath(); ctx.ellipse(w / 2 - h * 0.1, 0, h * 0.28, h * 0.42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.4;
      ctx.beginPath(); ctx.ellipse(w / 2 - h * 0.1, 0, h * 0.14, h * 0.21, 0, 0, TAU); ctx.stroke();
      break;
    }
    case 'totem': {
      const cols = ['#c0392b', '#e8a33d', '#2e86c1'];
      ctx.fillStyle = cols[seg % cols.length];
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-w * 0.22, h * 0.1, w * 0.13, 0, TAU); ctx.arc(w * 0.22, h * 0.1, w * 0.13, 0, TAU); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(-w * 0.22, h * 0.1, w * 0.06, 0, TAU); ctx.arc(w * 0.22, h * 0.1, w * 0.06, 0, TAU); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.6, h * 0.12);
      if (seg === segs - 1) {
        ctx.fillStyle = '#e8a33d';
        ctx.beginPath(); ctx.moveTo(-w * 0.9, h / 2); ctx.lineTo(-w * 0.5, h / 2 + 0.5); ctx.lineTo(-w * 0.5, h / 2); ctx.moveTo(w * 0.9, h / 2); ctx.lineTo(w * 0.5, h / 2 + 0.5); ctx.lineTo(w * 0.5, h / 2); ctx.fill();
      }
      break;
    }
    case 'sandcastle': {
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.55); ctx.strokeRect(-w / 2, -h / 2, w, h * 0.55);
      for (const tx of [-w * 0.3, w * 0.3]) {
        ctx.fillRect(tx - w * 0.14, -h / 2 + h * 0.5, w * 0.28, h * 0.4); ctx.strokeRect(tx - w * 0.14, -h / 2 + h * 0.5, w * 0.28, h * 0.4);
        ctx.fillStyle = '#ff6f61';
        ctx.beginPath(); ctx.moveTo(tx, h / 2 - 0.1); ctx.lineTo(tx, h / 2 + 0.35); ctx.lineTo(tx + 0.3, h / 2 + 0.25); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c;
      }
      ctx.fillStyle = shade(c, -0.35);
      ctx.beginPath(); ctx.arc(0, -h / 2 + h * 0.2, w * 0.1, 0, Math.PI); ctx.fill();
      break;
    }
    case 'magma': {
      ctx.fillStyle = '#3a2424';
      rr(ctx, -w / 2, -h / 2, w, h, 0.3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = lw * 0.9;
      ctx.beginPath();
      ctx.moveTo(-w * 0.35, -h * 0.3); ctx.lineTo(-w * 0.05, 0); ctx.lineTo(-w * 0.2, h * 0.35);
      ctx.moveTo(w * 0.1, -h * 0.4); ctx.lineTo(w * 0.3, h * 0.05); ctx.lineTo(w * 0.05, h * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(-w * 0.05, 0, 0.09, 0, TAU); ctx.arc(w * 0.3, h * 0.05, 0.07, 0, TAU); ctx.fill();
      break;
    }
    case 'boulder': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h * 0.1); ctx.lineTo(-w * 0.3, h / 2); ctx.lineTo(w * 0.25, h / 2); ctx.lineTo(w / 2, h * 0.05); ctx.lineTo(w * 0.35, -h / 2); ctx.lineTo(-w * 0.4, -h / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.5;
      ctx.beginPath(); ctx.moveTo(-w * 0.3, h * 0.45); ctx.lineTo(-w * 0.05, -h * 0.1); ctx.lineTo(w * 0.3, h * 0.0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.ellipse(-w * 0.15, h * 0.2, w * 0.15, h * 0.1, -0.4, 0, TAU); ctx.fill();
      break;
    }
    case 'hay': {
      ctx.fillStyle = c;
      rr(ctx, -w / 2, -h / 2, w, h, 0.18); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = lw * 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const y = -h / 2 + 0.15 + i * (h - 0.3) / 5; ctx.moveTo(-w / 2 + 0.1, y); ctx.lineTo(w / 2 - 0.1, y + (i % 2 ? 0.08 : -0.08)); }
      ctx.stroke();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.moveTo(-w * 0.2, -h / 2); ctx.lineTo(-w * 0.2, h / 2); ctx.moveTo(w * 0.2, -h / 2); ctx.lineTo(w * 0.2, h / 2); ctx.stroke();
      break;
    }
    case 'knight': {
      // armour body, helmet with a plume, a shield
      ctx.fillStyle = c;
      rr(ctx, -w / 2, -h / 2, w, h * 0.62, 0.15); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h / 2 - w * 0.45, w * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.fillRect(-w * 0.3, h / 2 - w * 0.5, w * 0.6, 0.1);
      ctx.fillStyle = '#d8262c';
      ctx.beginPath(); ctx.moveTo(-w * 0.1, h / 2 - 0.05); ctx.quadraticCurveTo(w * 0.1, h / 2 + 0.5, w * 0.45, h / 2 + 0.25); ctx.quadraticCurveTo(w * 0.15, h / 2 + 0.2, w * 0.1, h / 2 - 0.05); ctx.fill();
      ctx.fillStyle = '#2e5fc9';
      ctx.beginPath(); ctx.moveTo(-w * 0.85, h * 0.1); ctx.lineTo(-w * 0.3, h * 0.1); ctx.lineTo(-w * 0.3, -h * 0.25); ctx.quadraticCurveTo(-w * 0.57, -h * 0.5, -w * 0.85, -h * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * 0.62, -h * 0.12, w * 0.1, h * 0.18);
      break;
    }
    case 'treasure': {
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.6); ctx.strokeRect(-w / 2, -h / 2, w, h * 0.6);
      rr(ctx, -w / 2, -h / 2 + h * 0.55, w, h * 0.45, 0.25); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, -h / 2 + h * 0.5, w, 0.12);
      ctx.fillRect(-w * 0.12, -h / 2 + h * 0.4, w * 0.24, h * 0.3); ctx.strokeRect(-w * 0.12, -h / 2 + h * 0.4, w * 0.24, h * 0.3);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(-w * 0.28, h * 0.22, 0.1, 0, TAU); ctx.arc(w * 0.3, h * 0.2, 0.08, 0, TAU); ctx.fill();
      break;
    }
    case 'cone': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w * 0.12, h / 2); ctx.lineTo(-w * 0.12, h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-w * 0.33, -h * 0.1); ctx.lineTo(w * 0.33, -h * 0.1); ctx.lineTo(w * 0.27, h * 0.12); ctx.lineTo(-w * 0.27, h * 0.12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = OUT; ctx.fillRect(-w * 0.55, -h / 2 - 0.05, w * 1.1, 0.1);
      break;
    }
    case 'lollipop': {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-0.09, -h / 2, 0.18, h * 0.62); ctx.strokeRect(-0.09, -h / 2, 0.18, h * 0.62);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, h / 2 - w / 2, w / 2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); for (let a = 0; a < TAU * 2; a += 0.2) { const r = (w / 2 - 0.08) * a / (TAU * 2); ctx.lineTo(Math.cos(a) * r, h / 2 - w / 2 + Math.sin(a) * r); } ctx.stroke();
      break;
    }
    case 'gumdrop': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.quadraticCurveTo(w / 2, h / 2, 0, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, -h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-w * 0.35 + (i * 0.37) % (w * 0.7), -h * 0.3 + (i * 0.53) % (h * 0.65), 0.05, 0, TAU); ctx.fill(); }
      break;
    }
    case 'mushroom': {
      ctx.fillStyle = '#f3e6c8';
      rr(ctx, -w * 0.22, -h / 2, w * 0.44, h * 0.6, 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.05); ctx.quadraticCurveTo(-w / 2, h / 2, 0, h / 2); ctx.quadraticCurveTo(w / 2, h / 2, w / 2, h * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const [dx, dy, r] of [[-0.25, 0.25, 0.1], [0.15, 0.3, 0.12], [0.35, 0.15, 0.07]]) { ctx.beginPath(); ctx.arc(dx * w, dy * h, r, 0, TAU); ctx.fill(); }
      break;
    }
    case 'egg': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.05, w / 2, h / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7fa35a';
      for (const [dx, dy, r] of [[-0.2, 0.15, 0.09], [0.22, -0.1, 0.11], [-0.05, -0.3, 0.07], [0.1, 0.3, 0.06]]) { ctx.beginPath(); ctx.arc(dx * w, dy * h, r, 0, TAU); ctx.fill(); }
      break;
    }
    case 'puff': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(-w * 0.28, -h * 0.1, h * 0.38, 0, TAU); ctx.arc(w * 0.05, h * 0.05, h * 0.48, 0, TAU); ctx.arc(w * 0.33, -h * 0.12, h * 0.34, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,110,160,0.5)'; ctx.lineWidth = lw * 0.8;
      ctx.beginPath(); ctx.arc(-w * 0.28, -h * 0.1, h * 0.38, Math.PI * 0.6, Math.PI * 1.5); ctx.arc(w * 0.05, h * 0.05, h * 0.48, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(w * 0.33, -h * 0.12, h * 0.34, Math.PI * 1.4, Math.PI * 0.4); ctx.stroke();
      break;
    }
    case 'pumpkin': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.05, w / 2, h * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.5;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.05, w * 0.22, h * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#3f8f3a'; ctx.fillRect(-0.08, h * 0.35, 0.16, 0.25); ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.7; ctx.strokeRect(-0.08, h * 0.35, 0.16, 0.25);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.moveTo(-w * 0.3, 0.05); ctx.lineTo(-w * 0.15, h * 0.2); ctx.lineTo(-w * 0.05, 0.05); ctx.closePath();
      ctx.moveTo(w * 0.3, 0.05); ctx.lineTo(w * 0.15, h * 0.2); ctx.lineTo(w * 0.05, 0.05); ctx.closePath();
      ctx.moveTo(-w * 0.3, -h * 0.15); ctx.lineTo(w * 0.3, -h * 0.15); ctx.lineTo(w * 0.15, -h * 0.3); ctx.lineTo(0, -h * 0.2); ctx.lineTo(-w * 0.15, -h * 0.3); ctx.closePath();
      ctx.fill();
      break;
    }
    case 'gravestone': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2 - w / 2); ctx.arc(0, h / 2 - w / 2, w / 2, Math.PI, TAU); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(c, -0.45);
      ctx.fillRect(-w * 0.08, -h * 0.1, w * 0.16, h * 0.45); ctx.fillRect(-w * 0.26, h * 0.12, w * 0.52, h * 0.12);
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.4;
      ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.25); ctx.lineTo(w * 0.3, -h * 0.25); ctx.moveTo(-w * 0.3, -h * 0.38); ctx.lineTo(w * 0.1, -h * 0.38); ctx.stroke();
      break;
    }
    case 'coral': {
      ctx.fillStyle = c;
      ctx.lineJoin = 'round';
      for (const [dx, hh, ww] of [[-0.3, 0.75, 0.22], [0, 1.0, 0.26], [0.3, 0.8, 0.2]]) {
        rr(ctx, dx * w - ww * w / 2, -h / 2, ww * w, hh * h, ww * w / 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(dx * w - ww * w * 0.9, -h / 2 + hh * h * 0.55, ww * w * 0.45, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(-w * 0.32, h * 0.05, 0.06, 0, TAU); ctx.arc(w * 0.02, h * 0.3, 0.07, 0, TAU); ctx.fill();
      break;
    }
    case 'crystal': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w * 0.35, h * 0.2); ctx.lineTo(0, h / 2); ctx.lineTo(-w * 0.35, h * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(-w * 0.3, -h / 2 + 0.1); ctx.lineTo(-w * 0.1, -h / 2 + 0.1); ctx.lineTo(-w * 0.1, h * 0.25); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = lw * 0.4;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(0, -h / 2); ctx.stroke();
      break;
    }
    case 'satellite': {
      // body with a dish, solar panels either side
      ctx.fillStyle = '#2e5fc9';
      ctx.fillRect(-w / 2, -h * 0.25, w * 0.3, h * 0.5); ctx.strokeRect(-w / 2, -h * 0.25, w * 0.3, h * 0.5);
      ctx.fillRect(w * 0.2, -h * 0.25, w * 0.3, h * 0.5); ctx.strokeRect(w * 0.2, -h * 0.25, w * 0.3, h * 0.5);
      ctx.strokeStyle = '#9fd0ff'; ctx.lineWidth = lw * 0.4;
      ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(-w / 2 + i * w * 0.075, -h * 0.25); ctx.lineTo(-w / 2 + i * w * 0.075, h * 0.25); ctx.moveTo(w * 0.2 + i * w * 0.075, -h * 0.25); ctx.lineTo(w * 0.2 + i * w * 0.075, h * 0.25); } ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw;
      ctx.fillStyle = c;
      rr(ctx, -w * 0.18, -h / 2, w * 0.36, h, 0.12); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h / 2 + 0.05, w * 0.16, 0, Math.PI); ctx.fillStyle = '#e8eef7'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, TAU); ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
  }
}

function drawGlassBlock(ctx, w, h, lw) {
  ctx.fillStyle = 'rgba(150,215,245,0.62)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h / 2); ctx.lineTo(-w * 0.05, h / 2); ctx.lineTo(-w * 0.4, -h / 2); ctx.lineTo(-w * 0.5, -h / 2); ctx.lineTo(-w * 0.5, -h * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4b6b80';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
  ctx.fillStyle = '#5d7484';
  ctx.fillRect(-w / 2, h / 2 - 0.14, w, 0.14);
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#2c3e4c';
  ctx.strokeRect(-w / 2, -h / 2, w, h);
}

// ---------- v2 world structures ----------
// Formation footprint decor (never destroyed): fuel-depot pad + sign, pallets, plinths.
export function drawFormationBase(ctx, f, lw, t) {
  const fr = f.frame;
  ctx.save();
  ctx.translate(fr.x0, fr.y0);
  ctx.rotate(fr.ang);
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  if (f.type === 'depot') {
    ctx.fillStyle = '#9a9ca3';
    ctx.fillRect(-0.5, -0.3, f.width + 1, 0.3);
    ctx.save();
    ctx.beginPath(); ctx.rect(-0.5, -0.3, f.width + 1, 0.3); ctx.clip();
    ctx.fillStyle = '#ffd23f';
    for (let x = -0.5; x < f.width + 0.5; x += 0.6) { ctx.beginPath(); ctx.moveTo(x, -0.3); ctx.lineTo(x + 0.3, -0.3); ctx.lineTo(x + 0.6, 0); ctx.lineTo(x + 0.3, 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.strokeRect(-0.5, -0.3, f.width + 1, 0.3);
    // warning sign
    const sx = -1.3;
    ctx.fillStyle = '#6b6f7a';
    ctx.fillRect(sx - 0.06, -0.3, 0.12, 2.4);
    ctx.save();
    ctx.translate(sx, 2.3);
    ctx.beginPath(); ctx.moveTo(0, 0.55); ctx.lineTo(0.55, 0); ctx.lineTo(0, -0.55); ctx.lineTo(-0.55, 0); ctx.closePath();
    ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
    ctx.scale(1, -1);
    spriteText(ctx, '!', 0.5, 0, 0.03, OUT);
    ctx.restore();
  } else if (f.type === 'pyramid') {
    ctx.fillStyle = '#a77b47';
    ctx.fillRect(-0.15, -0.16, f.width + 0.2, 0.16);
    ctx.strokeRect(-0.15, -0.16, f.width + 0.2, 0.16);
  } else if (f.type === 'tower') {
    ctx.fillStyle = '#6b7380';
    ctx.fillRect(-0.3, -0.25, f.width + 0.6, 0.25);
    ctx.strokeRect(-0.3, -0.25, f.width + 0.6, 0.25);
  } else if (f.type === 'bridge') {
    for (const x of [0.25, f.width - 0.25]) { ctx.fillStyle = '#59606e'; ctx.fillRect(x - 0.45, -0.2, 0.9, 0.2); ctx.strokeRect(x - 0.45, -0.2, 0.9, 0.2); }
  }
  ctx.restore();
}

// Kicker ramp: a timber/steel structure sitting on the base terrain (physics uses groundY).
export function drawKicker(ctx, course, k, lw, bd) {
  const metal = bd.style === 'city' || bd.style === 'lunar' || bd.style === 'peaks';
  const deck = 0.38;
  const by = course.baseY;
  // supports
  ctx.lineWidth = lw * 0.7;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = metal ? '#59606e' : '#6b4a33';
  for (let x = k.x0 + 2.2; x <= k.x1 + 0.01; x += 2.05) {
    const xx = Math.min(x, k.x1 - 0.15);
    const top = course.groundY(xx) - deck;
    const bot = by(xx) - 0.3;
    if (top - bot < 0.15) continue;
    ctx.fillRect(xx - 0.13, bot, 0.26, top - bot);
    ctx.strokeRect(xx - 0.13, bot, 0.26, top - bot);
  }
  ctx.strokeStyle = metal ? '#7b8394' : '#8a6446';
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  for (let x = k.x0 + 2.2; x + 2.05 <= k.x1 + 0.01; x += 2.05) {
    ctx.moveTo(x, by(x)); ctx.lineTo(Math.min(x + 2.05, k.x1 - 0.15), course.groundY(Math.min(x + 2.05, k.x1 - 0.15)) - deck);
  }
  ctx.stroke();
  // deck band
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) { const x = k.x0 + ((k.x1 - k.x0) * i) / n; const y = course.groundY(x); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  for (let i = n; i >= 0; i--) { const x = k.x0 + ((k.x1 - k.x0) * i) / n; ctx.lineTo(x, course.groundY(x) - deck); }
  ctx.closePath();
  ctx.fillStyle = metal ? '#d9dde6' : '#f1e3c8';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = withAlpha(bd.theme.accent, 0.9);
  for (let x = k.x0 + 1; x < k.x1; x += 1.6) {
    const y = course.groundY(x);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.5, y); ctx.lineTo(x + 0.9, y - deck); ctx.lineTo(x + 0.4, y - deck); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // lip: hazard plate
  const ly = course.groundY(k.x1);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(k.x1 - 0.3, ly - deck - 0.3, 0.3, deck + 0.3);
  ctx.fillStyle = OUT;
  ctx.fillRect(k.x1 - 0.3, ly - deck * 0.55 - 0.15, 0.3, 0.15);
  ctx.strokeRect(k.x1 - 0.3, ly - deck - 0.3, 0.3, deck + 0.3);
}

// ---------- v2 air targets ----------
export function drawRing(ctx, a, t, half, lw, k) {
  // k: 0 = live, 0..1 = collected (expands and fades)
  const rx = 0.62 * (1 + k * 0.8), ry = a.r * (1 + k * 0.5);
  const a0 = half === 'back' ? Math.PI / 2 : -Math.PI / 2;
  ctx.globalAlpha = 1 - k;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, rx, ry, 0, a0, a0 + Math.PI);
  if (half === 'back') {
    ctx.strokeStyle = 'rgba(255,214,90,0.28)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 0.42 + lw * 1.4;
  ctx.stroke();
  ctx.strokeStyle = half === 'back' ? '#d99a1e' : '#ffc93c';
  ctx.lineWidth = 0.42;
  ctx.stroke();
  if (half === 'front') {
    ctx.strokeStyle = 'rgba(255,250,210,0.9)';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.ellipse(a.x + 0.05, a.y, rx, ry, 0, -Math.PI * 0.35, Math.PI * 0.15);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

// ---- v3 letter rings (Spell Jump): a rounder cyan hoop seen nearly face-on with the letter inside ----
// The letter is a cached sprite in a bold rounded face with a dark outline, scaled so its glyph box fills
// ~0.9 of the hoop's inner diameter (width-limited for wide glyphs), so it reads at phone size.
const LETTER_FONT = '900 {S}px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Varela Round", "Arial Black", system-ui, sans-serif';
const letterSprites = new Map();
function letterSprite(ch, fill) {
  const key = fill + '|' + ch;
  let sp = letterSprites.get(key);
  if (sp) return sp;
  if (letterSprites.size > 120) letterSprites.clear();
  const PX = 160, LW = 20;
  const text = /^\s+$/.test(ch) ? '_' : ch;
  const f = LETTER_FONT.replace('{S}', PX);
  if (!probe) probe = mkCanvas(4, 4).getContext('2d');
  probe.font = f;
  const m = probe.measureText(text);
  const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : m.width / 2;
  const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : m.width / 2;
  const asc = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : PX * 0.72;
  const desc = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : 0;
  const gw = Math.max(1, left + right), gh = Math.max(1, asc + desc);
  const pad = LW / 2 + 4;
  const w = Math.ceil(gw + pad * 2), h = Math.ceil(gh + pad * 2);
  const cv = mkCanvas(w, h);
  const c = cv.getContext('2d');
  c.font = f;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineWidth = LW;
  c.strokeStyle = OUT;
  c.strokeText(text, pad + left, pad + asc);
  c.fillStyle = fill;
  c.fillText(text, pad + left, pad + asc);
  sp = { cv, w, h, gw, gh, PX, LW, cx: pad + gw / 2, cy: pad + gh / 2 };
  letterSprites.set(key, sp);
  return sp;
}

// a: { x, y, r, letter }; half 'back' (hoop's far half + glass + letter, under the car) or 'front';
// k: 0 = live, 0..1 = collected (expands and fades); next: the next letter to collect (pulses)
// reveal: false (R1, before the car is airborne) draws a '?' instead of the letter. Returns true when a real
// letter glyph was drawn (the engine counts any drawn while hidden as a leak for the smoke tests).
export function drawLetterRing(ctx, a, t, half, lw, k, next, reveal = true) {
  let drew = false;
  const ry = a.r * (1 + k * 0.5), rx = ry * 0.9;
  const band = 0.5;
  const a0 = half === 'back' ? Math.PI / 2 : -Math.PI / 2;
  ctx.globalAlpha = 1 - k;
  if (half === 'back') {
    // tinted glass behind the letter: keeps it readable over sky, terrain or space
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, rx - band / 2, ry - band / 2, 0, 0, TAU);
    ctx.fillStyle = 'rgba(16,22,52,0.34)';
    ctx.fill();
    if (next && !k) {
      ctx.beginPath();
      ctx.ellipse(a.x, a.y, rx, ry, 0, 0, TAU);
      ctx.strokeStyle = `rgba(120,236,255,${(0.28 + 0.18 * Math.sin(t * 7)).toFixed(3)})`;
      ctx.lineWidth = band + 0.7 + 0.2 * Math.sin(t * 7);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, rx, ry, 0, a0, a0 + Math.PI);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = band + lw * 1.6;
  ctx.stroke();
  ctx.strokeStyle = half === 'back' ? '#25a9d6' : '#6ee7ff';
  ctx.lineWidth = band;
  ctx.stroke();
  if (half === 'front') {
    ctx.strokeStyle = 'rgba(235,252,255,0.95)';
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.ellipse(a.x + 0.06, a.y, rx, ry, 0, -Math.PI * 0.4, Math.PI * 0.12);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  if (half === 'back' && a.letter != null) {
    try {
      const sp = reveal ? letterSprite(String(a.letter), '#ffffff') : letterSprite('?', '#9fdcf0');
      drew = !!reveal;
      const iw = 2 * (rx - band / 2) * 0.9, ih = 2 * (ry - band / 2) * 0.9;
      // glyph + its outline fit the box (tiny glyphs like '-' or "'" are not blown up)
      const s = Math.min(ih / (Math.max(sp.gh, sp.PX * 0.5) + sp.LW), iw / (Math.max(sp.gw, sp.PX * 0.3) + sp.LW)) * (1 + k * 0.6);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.scale(s, -s); // world is +y up; the sprite is y-down
      ctx.drawImage(sp.cv, -sp.cx, -sp.cy);
      ctx.restore();
    } catch (_) { /* no 2D text in this context */ }
  }
  ctx.globalAlpha = 1;
  return drew;
}

export function drawCoin(ctx, a, t, lw) {
  const sx = Math.max(0.12, Math.abs(Math.cos(t * 3.2 + a.id * 0.7)));
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.arc(0, 0, a.r, 0, TAU);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.lineWidth = lw / sx;
  ctx.strokeStyle = '#a8740f';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, a.r * 0.6, 0, TAU);
  ctx.strokeStyle = '#e5a91c';
  ctx.lineWidth = 0.08 / sx;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(-a.r * 0.45, a.r * 0.15, a.r * 0.25, a.r * 0.3);
  ctx.restore();
}

export function drawBalloon(ctx, x, y, a, col, lw, t) {
  // string
  ctx.strokeStyle = 'rgba(40,40,50,0.8)';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(x, y - a.r * 1.1);
  ctx.quadraticCurveTo(x + 0.3 * Math.sin(t * 2 + a.id), y - a.r * 1.1 - 1.0, x - 0.1, y - a.r * 1.1 - 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, a.r * 0.88, a.r * 1.05, 0, 0, TAU);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - a.r * 1.02); ctx.lineTo(x + 0.16, y - a.r * 1.2); ctx.lineTo(x - 0.16, y - a.r * 1.2); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - a.r * 0.35, y + a.r * 0.35, a.r * 0.18, a.r * 0.3, -0.5, 0, TAU);
  ctx.fill();
}

export function drawBlimp(ctx, a, lw, t, k, label) {
  // k: 0 = flying, 0..1 = deflating after the car batted it
  const x = a.x + a.ox, y = a.y + a.oy;
  const L = a.r * (1 - 0.25 * k), Hh = a.rh * (1 - 0.6 * k);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a.rot + (k > 0 ? Math.sin(t * 9) * 0.06 * k : Math.sin(t * 0.7) * 0.02));
  ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
  // fins
  ctx.fillStyle = '#d64545';
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.beginPath(); ctx.moveTo(-L * 0.78, 0.2); ctx.lineTo(-L * 1.08, Hh * 0.95); ctx.lineTo(-L * 1.02, 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-L * 0.78, -0.2); ctx.lineTo(-L * 1.08, -Hh * 0.95); ctx.lineTo(-L * 1.02, -0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  // gondola
  ctx.fillStyle = '#3b3f4a';
  rr(ctx, -L * 0.18, -Hh - 0.55, L * 0.36, 0.7, 0.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#bfe9ff';
  for (let i = 0; i < 3; i++) ctx.fillRect(-L * 0.13 + i * L * 0.1, -Hh - 0.35, L * 0.06, 0.3);
  // envelope
  ctx.beginPath();
  if (k > 0) {
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) * TAU;
      const wob = 1 + 0.07 * k * Math.sin(u * 5 + t * 12);
      const px = Math.cos(u) * L * wob, py = Math.sin(u) * Hh * wob;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
  ctx.fillStyle = '#e8e9ef';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#c9cbd6';
  ctx.fillRect(-L, -Hh, L * 2, Hh * 0.55);
  ctx.fillStyle = '#d64545';
  ctx.fillRect(-L, -Hh * 0.18, L * 2, Hh * 0.36);
  ctx.restore();
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  if (k < 0.5) {
    ctx.scale(1, -1);
    spriteText(ctx, label, Hh * 0.42, 0, 0.04, '#ffffff');
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// BEST flag at the player's record distance; waves harder (and turns gold) once passed.
export function drawBestFlag(ctx, course, x, t, passed, popK, lw, z = 10) {
  const gy = course.groundY(x);
  const top = gy + 6.2;
  ctx.fillStyle = '#e8e8ee';
  ctx.fillRect(x - 0.1, gy - 0.3, 0.2, top - gy + 0.3);
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUT;
  ctx.strokeRect(x - 0.1, gy - 0.3, 0.2, top - gy + 0.3);
  ctx.beginPath(); ctx.arc(x, top + 0.12, 0.18, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
  // cloth: a waving strip
  const amp = passed ? 0.32 : 0.14, sp = passed ? 9 : 3.5;
  const L = 3.2, Hc = 1.7;
  ctx.beginPath();
  const n = 10;
  for (let i = 0; i <= n; i++) { const u = i / n; ctx.lineTo(x + 0.1 + u * L, top - 0.05 + Math.sin(u * 4 - t * sp) * amp * u); }
  for (let i = n; i >= 0; i--) { const u = i / n; ctx.lineTo(x + 0.1 + u * L, top - Hc + Math.sin(u * 4 - t * sp + 0.4) * amp * u + u * 0.15); }
  ctx.closePath();
  ctx.fillStyle = passed ? '#ffd23f' : '#2fbfff';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.save();
  ctx.translate(x + 0.1 + L * 0.48, top - Hc / 2 + Math.sin(2 - t * sp) * amp * 0.5);
  ctx.scale(1, -1);
  spriteText(ctx, 'BEST', 0.8, 0, 0.02, passed ? OUT : '#ffffff');
  ctx.restore();
  if (popK > 0) {
    // the in-world NEW RECORD banner pops in above the flag
    // this banner is the record moment's one big text: keep it at least ~200 px wide however far the camera pulls out
    const s = (popK < 0.6 ? (popK / 0.6) * 1.15 : 1.15 - Math.min(0.15, (popK - 0.6) * 0.75)) * Math.max(1, 200 / (10.4 * z));
    ctx.save();
    // it grows to the right of the pole, over the road the car is driving on, not back off-screen
    ctx.translate(x + 0.2 + 5.2 * s, top + 1.6 + s + Math.sin(t * 2) * 0.15);
    ctx.scale(s, s);
    ctx.fillStyle = '#ff3d6e';
    ctx.beginPath();
    ctx.moveTo(-5.2, -0.9); ctx.lineTo(5.2, -0.9); ctx.lineTo(4.6, 0); ctx.lineTo(5.2, 0.9); ctx.lineTo(-5.2, 0.9); ctx.lineTo(-4.6, 0); ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 0.14; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.scale(1, -1);
    spriteText(ctx, 'NEW RECORD!', 1.05, 0, 0.05, '#ffe14a', 0.25);
    ctx.restore();
  }
}

// ---------- v2 screen overlays ----------
export function drawLetterbox(ctx, view, k) {
  if (k < 0.01) return;
  const h = view.H * 0.115 * k;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, view.W, h);
  ctx.fillRect(0, view.H - h, view.W, h);
}
export function drawFlash(ctx, view, a, col) {
  if (a < 0.03) return; // a full-screen blend: skip the invisible tail
  ctx.fillStyle = `rgba(${col},${Math.min(0.85, a).toFixed(3)})`;
  ctx.fillRect(0, 0, view.W, view.H);
}
export function drawRadialFlash(ctx, view, x, y, a) {
  if (a < 0.01) return;
  const R = Math.max(view.W, view.H) * 0.7;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(255,255,240,${(0.85 * a).toFixed(3)})`);
  g.addColorStop(0.25, `rgba(190,255,190,${(0.35 * a).toFixed(3)})`);
  g.addColorStop(1, 'rgba(190,255,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.W, view.H);
}

// ---------- Grand Finale ----------
function polyPath(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
// One flying car panel (car.js carPieces), local frame centred on the piece. burn 0..1 chars it a little.
export function drawCarPiece(ctx, p, g, lw, burn = 0) {
  ctx.beginPath();
  polyPath(ctx, p.poly);
  ctx.fillStyle = p.color;
  ctx.fill();
  if (p.stripe) {
    ctx.beginPath();
    polyPath(ctx, p.stripe.poly);
    ctx.fillStyle = p.stripe.color;
    ctx.fill();
  }
  if (p.glass) {
    ctx.beginPath();
    polyPath(ctx, p.glass);
    ctx.fillStyle = '#bfe9ff';
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = p.outline || OUT;
    ctx.stroke();
  }
  // scorch: darken toward soot as it flies
  const sc = 0.06 + 0.3 * burn;
  ctx.beginPath();
  polyPath(ctx, p.poly);
  ctx.fillStyle = `rgba(30,20,20,${sc.toFixed(3)})`;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = p.outline || OUT;
  ctx.stroke();
}

const easeOutBack = (k) => { const c = 1.9; const u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
// Cartoon fireball u s after the boom: a comic burst star, then three lobed cloud layers (orange with a
// dark outline, yellow, a white-hot core) that pop out, swell, cool to red and soot, rise and fade.
export function drawFinaleBoom(ctx, x, y, u, lobes, spikes, lw) {
  if (u > 1.25 || !lobes) return;
  const grow = u < 0.18 ? easeOutBack(u / 0.18) : 1;
  const R = 4.3 * grow * (1 + 0.18 * Math.min(1, u / 1.1));
  const cool = clamp((u - 0.38) / 0.62, 0, 1);
  const fade = 1 - clamp((u - 0.8) / 0.45, 0, 1);
  const cy = y + cool * cool * 3.2;
  ctx.lineJoin = 'round';
  // comic burst star (behind, first ~0.3 s)
  if (u < 0.34 && spikes) {
    const k = u / 0.34;
    const Rs = 9.5 * Math.min(1, u / 0.07 + 0.25);
    ctx.globalAlpha = 1 - k * k;
    for (const [sc, col] of [[1, '#ffe14a'], [0.62, '#fffbe6']]) {
      ctx.beginPath();
      const n = spikes.length;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * TAU + 0.2;
        const rr = (i % 2 ? Rs * 0.5 : Rs * spikes[i >> 1]) * sc;
        if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      if (sc === 1) { ctx.lineWidth = lw * 1.4; ctx.strokeStyle = '#ff9b2e'; ctx.stroke(); }
    }
  }
  if (fade <= 0) { ctx.globalAlpha = 1; return; }
  ctx.globalAlpha = fade;
  const layers = [
    { s: 1, c0: '#ff7a1a', c1: '#c8371c', c2: '#4a424c', shrink: 0 },
    { s: 0.7, c0: '#ffc93c', c1: '#ff7a1a', c2: '#7a5a50', shrink: 0.75 },
    { s: 0.4, c0: '#fffbe6', c1: '#ffd23f', c2: '#ff9b2e', shrink: 1 },
  ];
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const s = L.s * (1 - L.shrink * cool) * (0.65 + 0.35 * fade);
    if (s < 0.04) continue;
    const col = cool < 0.5 ? mix(L.c0, L.c1, cool * 2) : mix(L.c1, L.c2, (cool - 0.5) * 2);
    const Rl = R * s;
    const lb = lobes[li] || lobes[0];
    ctx.beginPath();
    ctx.moveTo(x + Rl * 0.66, cy);
    ctx.arc(x, cy, Rl * 0.66, 0, TAU);
    for (const o of lb) {
      const lx = x + Math.cos(o.a) * o.d * Rl, ly = cy + Math.sin(o.a) * o.d * Rl * 0.9;
      ctx.moveTo(lx + o.r * Rl, ly);
      ctx.arc(lx, ly, o.r * Rl, 0, TAU);
    }
    if (li === 0 && fade > 0.999) { // a translucent fill would show the per-lobe strokes inside it
      ctx.lineWidth = lw * 2.2;
      ctx.strokeStyle = cool < 0.6 ? '#7a1f0a' : OUT;
      ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.fill('nonzero');
  }
  ctx.globalAlpha = 1;
}

// The tiny driver: thrown clear tumbling, then floating down under a red/white canopy; after landing the
// canopy lies on the ground and the driver waves. d = engine finale driver { x, y, open, rot, landed, landT }.
export function drawParachuter(ctx, d, lw, t, helmet = '#ffd23f') {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(1.3, 1.3);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lwd = lw / 1.3;
  if (d.landed) {
    // collapsed canopy draped behind
    const k = 1 - d.open;
    ctx.beginPath();
    ctx.ellipse(-1.05, -0.38, 0.95, 0.12 + 0.5 * (1 - k), 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#ff4d6d';
    ctx.fill();
    ctx.lineWidth = lwd;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-1.05, -0.38, 0.35, 0.1 + 0.4 * (1 - k), 0, 0, Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    const sway = 0.15 * Math.sin(t * 2.4) * d.open;
    ctx.rotate(d.rot * (1 - d.open) + sway);
    if (d.open > 0.02) {
      const k = easeOutBack(Math.min(1, d.open));
      const cw = 1.6 * k, chh = 1.15 * Math.min(1, d.open * 1.4), cy = 2.0;
      // lines
      ctx.beginPath();
      for (const fx of [-1, -0.4, 0.4, 1]) { ctx.moveTo(fx * cw, cy); ctx.lineTo(fx > 0 ? 0.16 : -0.16, 0.42); }
      ctx.lineWidth = lwd * 0.5;
      ctx.strokeStyle = '#3a3a44';
      ctx.stroke();
      // gores, alternating red / white
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(0, cy - 0.2 * k);
        ctx.ellipse(0, cy, cw, chh, 0, a0, a1);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? '#ffffff' : '#ff4d6d';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0, cy, cw, chh, 0, 0, Math.PI);
      // scalloped hem
      for (let i = n; i > 0; i--) {
        const xa = cw * Math.cos(((i - 1) / n) * Math.PI);
        const xm = (cw * Math.cos((i / n) * Math.PI) + xa) / 2;
        ctx.quadraticCurveTo(xm, cy - 0.28 * k, xa, cy);
      }
      ctx.closePath();
      ctx.lineWidth = lwd;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    }
  }
  // driver: legs, suit, arms (up to the lines, flailing while tumbling, waving once down), helmet
  const suit = '#2b2d42';
  ctx.strokeStyle = suit;
  ctx.lineWidth = 0.13;
  ctx.beginPath();
  const kick = d.landed ? 0 : 0.08 * Math.sin(t * 9);
  ctx.moveTo(-0.08, -0.05); ctx.lineTo(-0.12 - kick, -0.5);
  ctx.moveTo(0.08, -0.05); ctx.lineTo(0.12 + kick, -0.5);
  ctx.stroke();
  ctx.beginPath();
  if (d.landed) {
    const wave = Math.sin(t * 9) * 0.25;
    ctx.moveTo(-0.15, 0.24); ctx.lineTo(-0.34, -0.02);
    ctx.moveTo(0.15, 0.26); ctx.lineTo(0.36 + wave * 0.3, 0.66);
  } else if (d.open > 0.5) {
    ctx.moveTo(-0.15, 0.26); ctx.lineTo(-0.2, 0.52);
    ctx.moveTo(0.15, 0.26); ctx.lineTo(0.2, 0.52);
  } else {
    const fl = Math.sin(t * 20) * 0.15;
    ctx.moveTo(-0.15, 0.24); ctx.lineTo(-0.48, 0.3 + fl);
    ctx.moveTo(0.15, 0.24); ctx.lineTo(0.48, 0.3 - fl);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0.12, 0.2, 0.27, 0, 0, TAU);
  ctx.fillStyle = suit;
  ctx.fill();
  ctx.lineWidth = lwd * 0.7;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0.56, 0.21, 0, TAU);
  ctx.fillStyle = helmet;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#20202a';
  ctx.fillRect(0.02, 0.5, 0.18, 0.1);
  ctx.restore();
  ctx.lineCap = 'butt';
}

// ---------- particles / popups / overlays ----------
export function drawParticles(ctx, parts, vis) {
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.x < vis.x0 - 2 || p.x > vis.x1 + 2 || p.y < vis.y0 - 2 || p.y > vis.y1 + 2) continue;
    const k = p.life / p.max;
    if (p.type === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      ctx.stroke();
    } else if (p.type === 'fire') {
      // fireball blob: white-hot -> yellow -> orange -> red -> soot as it burns out
      const u = 1 - k;
      const rad = p.size * (0.55 + u * 1.1);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.fillStyle = p.color || (k > 0.78 ? '#fff1a0' : k > 0.55 ? '#ffc13a' : k > 0.35 ? '#ff7a1f' : k > 0.18 ? '#d9401c' : '#5a2a22');
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, TAU);
      ctx.fill();
    } else if (p.type === 'smoke') {
      const a = Math.min(1, k * 1.4) * (p.alpha || 0.6);
      if (a < 0.03) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - k) * 1.4), 0, TAU);
      ctx.fill();
    } else if (p.type === 'ring') {
      const u = 1 - k;
      const rad = p.size + (p.extra - p.size) * (1 - (1 - u) * (1 - u) * (1 - u));
      ctx.globalAlpha = k * (p.alpha || 1);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.08 + 0.4 * k;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, TAU);
      ctx.stroke();
    } else if (p.type === 'confetti') {
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.fillStyle = p.color;
      const w = p.size * 2 * Math.abs(Math.cos(p.a)) + 0.03;
      ctx.fillRect(p.x - w / 2, p.y - p.size / 2, w, p.size);
    } else if (p.type === 'fw' || p.type === 'rocket') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      ctx.stroke();
    } else if (p.type === 'shard') {
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size * 0.6);
      ctx.lineTo(p.size, 0);
      ctx.lineTo(-p.size * 0.3, p.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // dust / smoke puff
      ctx.globalAlpha = k * (p.alpha || 0.6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx, popups, toScreen, view) {
  const base = Math.max(16, Math.min(34, Math.min(view.W, view.H) * 0.065));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  for (const p of popups) {
    const k = p.t / p.life;
    let x, y;
    if (p.world) { const s = toScreen(p.x, p.y); x = s[0]; y = s[1]; } else { x = p.x * view.W; y = p.y * view.H; }
    y -= k * (p.world ? 46 : 24); // screen-lane texts drift less so they stay in their band
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
    const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    // the pop-in steps through a few sizes (3 px apart) instead of a new size every frame: each new
    // size is a glyph-cache miss, and a combo re-pops its text on every hit
    const size = Math.max(6, Math.round((base * (p.scale || 1) * pop) / 3) * 3);
    ctx.globalAlpha = a;
    ctx.font = font(size);
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.strokeText(p.text, x, y);
    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillText(p.text, x, y);
  }
  ctx.globalAlpha = 1;
}

export function drawSpeedLines(ctx, view, lines, intensity, dirX, dirY) {
  if (intensity <= 0.01) return;
  ctx.strokeStyle = `rgba(255,255,255,${(0.55 * intensity).toFixed(3)})`;
  ctx.lineCap = 'round';
  for (const l of lines) {
    const x = l.x * view.W, y = l.y * view.H;
    // keep the centre clear
    const dx = x - view.W / 2, dy = y - view.H / 2;
    if (Math.abs(dx) < view.W * 0.22 && Math.abs(dy) < view.H * 0.25) continue;
    const len = l.len * (40 + 90 * intensity);
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dirX * len, y + dirY * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

export function drawVignette(ctx, view, amount) {
  if (amount <= 0.01) return;
  const { W, H } = view;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(60,20,120,0)');
  g.addColorStop(1, `rgba(60,20,120,${(0.5 * amount).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(120,200,255,${(0.08 * amount).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

export { drawChassis, drawWheel, font };
