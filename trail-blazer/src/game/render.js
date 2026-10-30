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

// v1.5: the 18 render styles. Each has its own far / mid layers (buildLayer), near decor (drawDecor), ground
// treatment (drawTerrain), sky extras (drawBackground) and weather (drawWeather).
const TUFT = { snow: 'lump', glacier: 'lump', desert: 'lump', canyon: 'lump', beach: 'lump', dino: 'lump', moon: 'pebble', volcano: 'pebble', neon: 'none', sky: 'none', rainbow: 'grass', jungle: 'grass', swamp: 'grass', haunted: 'grass' };
const WATER_COL = { desert: '#58a8c8', canyon: '#58a8c8', swamp: '#5b7a4a', volcano: '#ff6a1a', beach: '#2fb6e8', jungle: '#3f8f7a', rainbow: '#4dd2ff', moon: '#6f7f9a', neon: '#3a6fd6', haunted: '#2a3f5a' };
export function createBackdrop(trail, seed) {
  const theme = trail.theme;
  const style = trail.style || 'forest';
  const night = !!theme.night || luminance(theme.sky[0]) < 0.2;
  const rand = mulberry32((seed * 31 + 7) >>> 0);
  const clouds = [];
  const nClouds = style === 'sky' ? 10 : style === 'volcano' || style === 'moon' || style === 'neon' ? 0 : 6;
  for (let i = 0; i < nClouds; i++) clouds.push({ x: rand() * 2400, y: 0.06 + rand() * 0.24, s: 0.55 + rand() * 0.7, k: 0.02 + rand() * 0.04 });
  const stars = [];
  for (let i = 0; i < (style === 'moon' ? 170 : 110); i++) stars.push({ x: rand(), y: rand() * (style === 'moon' ? 0.9 : 0.7), s: 0.6 + rand() * 1.7, p: rand() * TAU });
  const weather = trail.weather || (style === 'snow' ? 'snow' : null);
  const flakes = [];
  if (weather === 'snow' || weather === 'ash') for (let i = 0; i < 70; i++) flakes.push({ x: rand(), y: rand(), s: 1.2 + rand() * 2.6, v: 0.05 + rand() * 0.09, w: rand() * TAU, ember: weather === 'ash' && rand() < 0.25 });
  const flies = [];
  if (style === 'night' || style === 'haunted' || style === 'swamp') for (let i = 0; i < 26; i++) flies.push({ x: rand(), y: 0.45 + rand() * 0.45, p: rand() * TAU, s: 1.5 + rand() * 1.8 });
  const fliers = []; // parrots / bats / confetti (screen-space, stateless in t)
  if (weather === 'parrots' || weather === 'bats') for (let i = 0; i < (weather === 'bats' ? 9 : 5); i++) fliers.push({ y: 0.08 + rand() * 0.35, v: 0.05 + rand() * 0.06, p: rand() * TAU, s: 0.8 + rand() * 0.6, c: ['#ff4d4d', '#ffd23f', '#3ddc84', '#4dd2ff', '#ff7ad1'][i % 5] });
  if (weather === 'confetti') for (let i = 0; i < 60; i++) flakes.push({ x: rand(), y: rand(), s: 2 + rand() * 3, v: 0.04 + rand() * 0.07, w: rand() * TAU, c: ['#ff5d5d', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff', '#ff7ad1'][i % 6] });
  const fogPuffs = [];
  for (let i = 0; i < 9; i++) fogPuffs.push({ x: rand(), y: 0.35 + rand() * 0.6, s: 0.8 + rand() * 1.4, v: 0.01 + rand() * 0.02, p: rand() * TAU });
  return {
    style, night, theme, seed, clouds, stars, flakes, flies, fliers, fogPuffs, weather, layers: null,
    planet: theme.planet || (night ? 'moon' : 'sun'),
    tuftKind: TUFT[style] || 'grass',
    tuft: style === 'snow' || style === 'glacier' ? '#ffffff' : style === 'desert' ? '#a87d4a' : shade(theme.ground, -0.18),
    lip: shade(theme.trail || theme.ground, 0.25), grassLine: shade(theme.ground, -0.25),
    dust: shade(theme.trail || theme.ground, style === 'snow' || style === 'glacier' ? 0.3 : 0.12),
    farLine: mix(theme.far, '#05081a', 0.3), midLine: mix(theme.mid, '#05081a', 0.35),
    haze: withAlpha(theme.sky[1], style === 'swamp' || style === 'haunted' ? 0.45 : 0.28),
    water: WATER_COL[style] || (night ? '#2a4f8a' : '#3d9be0'),
    fogColor: night ? (style === 'haunted' ? '#5a4a7a' : '#2a3350') : style === 'swamp' ? '#b9c7ad' : '#dfe6ee',
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

// a palm: trunk + 5 fronds
function palm(c, x, y, h, trunk, leaf) {
  c.strokeStyle = trunk; c.lineWidth = 6;
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + h * 0.15, y - h * 0.5, x + h * 0.1, y - h); c.stroke();
  c.fillStyle = leaf;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI * 0.1 - k * 0.5, L = h * 0.5;
    c.beginPath(); c.moveTo(x + h * 0.1, y - h);
    c.quadraticCurveTo(x + h * 0.1 + Math.cos(a) * L * 0.6, y - h + Math.sin(a) * L * 0.6 - 10, x + h * 0.1 + Math.cos(a) * L, y - h + Math.sin(a) * L + 14);
    c.quadraticCurveTo(x + h * 0.1 + Math.cos(a) * L * 0.5, y - h + Math.sin(a) * L * 0.5 + 6, x + h * 0.1, y - h);
    c.fill();
  }
}
// a bare / dead tree silhouette
function deadTree(c, x, y, h, col) {
  c.strokeStyle = col; c.lineCap = 'round';
  c.lineWidth = 7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y - h * 0.6); c.stroke();
  c.lineWidth = 4;
  c.beginPath(); c.moveTo(x + 2, y - h * 0.4); c.lineTo(x - h * 0.25, y - h * 0.75); c.moveTo(x + 4, y - h * 0.6); c.lineTo(x + h * 0.3, y - h * 0.95); c.moveTo(x + 4, y - h * 0.6); c.lineTo(x - h * 0.05, y - h); c.stroke();
  c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x - h * 0.12, y - h * 0.58); c.lineTo(x - h * 0.3, y - h * 0.5); c.moveTo(x + h * 0.18, y - h * 0.8); c.lineTo(x + h * 0.4, y - h * 0.78); c.stroke();
}
function building(c, x, y, w, h, fill, line, lit, rand) {
  c.fillStyle = fill; c.strokeStyle = line; c.lineWidth = 2.5;
  c.beginPath(); c.rect(x, y - h, w, h); c.fill(); c.stroke();
  const cw = 9, ch = 12;
  for (let yy = y - h + 8; yy < y - 14; yy += ch + 6) for (let xx = x + 6; xx < x + w - 10; xx += cw + 6) {
    if (rand() < 0.45) continue;
    c.fillStyle = lit[Math.floor(rand() * lit.length)];
    c.fillRect(xx, yy, cw, ch);
  }
}
const LAYER_STYLES = {
  jungle(c, P, H, base, far, fill, line, rand, twice) {
    rollingHills(c, P, H, base, far ? 80 : 40, rand, fill, line);
    if (far) {
      c.fillStyle = shade(fill, -0.1); c.strokeStyle = line; c.lineWidth = 2.5;
      for (let i = 0; i < 40; i++) { const x = (i + rand()) * (P / 40), w = 60 + rand() * 60, h = 40 + rand() * 50; twice((o) => { c.beginPath(); c.ellipse(x + o, base - 40 - rand() * 30, w / 2, h, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke(); }); }
    } else {
      for (let i = 0; i < 16; i++) { const x = (i + rand() * 0.8) * (P / 16), h = 110 + rand() * 80; twice((o) => palm(c, x + o, base - 10, h, '#4a3a22', '#2c8a4a')); }
      // hanging vines
      c.strokeStyle = '#1e6a3a'; c.lineWidth = 3.5;
      for (let i = 0; i < 24; i++) { const x = rand() * P, len = 60 + rand() * 120; twice((o) => { c.beginPath(); c.moveTo(x + o, 0); c.quadraticCurveTo(x + o + 14, len * 0.5, x + o - 6, len); c.stroke(); }); }
      c.fillStyle = '#ff5a8a';
      for (let i = 0; i < 12; i++) { const x = rand() * P, y = base - 30 - rand() * 60; twice((o) => { c.beginPath(); c.arc(x + o, y, 5, 0, TAU); c.fill(); }); }
    }
  },
  canyon(c, P, H, base, far, fill, line, rand, twice) {
    if (far) {
      rollingHills(c, P, H, base, 30, rand, shade(fill, 0.08), line);
      for (let i = 0; i < 5; i++) {
        const x = (i + rand() * 0.5) * (P / 5), w = 200 + rand() * 220, h = 110 + rand() * 110;
        twice((o) => {
          c.beginPath(); c.moveTo(x + o, base); c.lineTo(x + o + w * 0.08, base - h * 0.5); c.lineTo(x + o + w * 0.14, base - h); c.lineTo(x + o + w * 0.86, base - h); c.lineTo(x + o + w * 0.92, base - h * 0.55); c.lineTo(x + o + w, base); c.closePath();
          c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
          c.strokeStyle = 'rgba(255,200,120,0.25)'; c.lineWidth = 5;
          c.beginPath(); for (let k = 1; k < 4; k++) { const yy = base - h + (h * k) / 4.2; c.moveTo(x + o + w * 0.12, yy); c.lineTo(x + o + w * 0.88, yy); } c.stroke();
        });
      }
    } else {
      rollingHills(c, P, H, base, 36, rand, fill, line);
      // hoodoos: tall rock columns with a cap
      for (let i = 0; i < 14; i++) {
        const x = (i + rand()) * (P / 14), w = 22 + rand() * 26, h = 60 + rand() * 90;
        twice((o) => {
          c.fillStyle = shade(fill, 0.1 * (i % 3)); c.strokeStyle = line; c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(x + o - w / 2, base - 20); c.lineTo(x + o - w * 0.35, base - 20 - h); c.lineTo(x + o + w * 0.35, base - 20 - h); c.lineTo(x + o + w / 2, base - 20); c.closePath(); c.fill(); c.stroke();
          c.fillStyle = shade(fill, -0.15); c.beginPath(); c.ellipse(x + o, base - 20 - h, w * 0.55, 9, 0, 0, TAU); c.fill(); c.stroke();
        });
      }
    }
  },
  beach(c, P, H, base, far, fill, line, rand, twice) {
    if (far) {
      // distant islands on the sea line (the sea itself is drawn in drawBackground)
      c.fillStyle = '#2f7a55'; c.strokeStyle = line; c.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) { const x = (i + rand() * 0.6) * (P / 4), w = 120 + rand() * 160, h = 30 + rand() * 40; twice((o) => { c.beginPath(); c.ellipse(x + o, base, w / 2, h, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke(); }); }
    } else {
      rollingHills(c, P, H, base, 18, rand, '#f2d98b', '#b99a52');
      for (let i = 0; i < 12; i++) { const x = (i + rand() * 0.8) * (P / 12), h = 90 + rand() * 70; twice((o) => palm(c, x + o, base - 8, h, '#8a5a32', '#3aa36f')); }
      // beach umbrellas
      for (let i = 0; i < 6; i++) {
        const x = rand() * P, col = ['#ff4d6d', '#ffd23f', '#22b8ff'][i % 3];
        twice((o) => { c.strokeStyle = '#444'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + o, base - 8); c.lineTo(x + o, base - 50); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(x + o, base - 50, 26, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke(); });
      }
    }
  },
  volcano(c, P, H, base, far, fill, line, rand, twice) {
    if (far) {
      rollingHills(c, P, H, base, 40, rand, shade(fill, -0.1), line);
      for (let i = 0; i < 3; i++) {
        const x = (i + 0.5) * (P / 3), w = 420 + rand() * 200, h = 170 + rand() * 60;
        twice((o) => {
          c.beginPath(); c.moveTo(x + o - w / 2, base); c.lineTo(x + o - w * 0.08, base - h); c.lineTo(x + o + w * 0.08, base - h); c.lineTo(x + o + w / 2, base); c.closePath();
          c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
          // glowing crater + lava streams
          c.fillStyle = '#ff7a1a'; c.beginPath(); c.ellipse(x + o, base - h, w * 0.09, 7, 0, 0, TAU); c.fill();
          c.strokeStyle = '#ff5a1f'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + o - w * 0.05, base - h); c.quadraticCurveTo(x + o - w * 0.15, base - h * 0.6, x + o - w * 0.22, base - h * 0.3); c.moveTo(x + o + w * 0.04, base - h); c.quadraticCurveTo(x + o + w * 0.1, base - h * 0.5, x + o + w * 0.25, base - h * 0.2); c.stroke();
          c.fillStyle = 'rgba(255,120,40,0.35)'; c.beginPath(); c.ellipse(x + o, base - h, w * 0.2, 30, 0, 0, TAU); c.fill();
        });
      }
    } else {
      rollingHills(c, P, H, base, 34, rand, fill, line);
      for (let i = 0; i < 18; i++) {
        const x = (i + rand()) * (P / 18), w = 30 + rand() * 50, h = 30 + rand() * 60;
        twice((o) => { c.fillStyle = shade(fill, 0.08 * (i % 3)); c.strokeStyle = line; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + o - w / 2, base - 20); c.lineTo(x + o - w * 0.2, base - 20 - h); c.lineTo(x + o + w * 0.15, base - 20 - h * 0.7); c.lineTo(x + o + w / 2, base - 20); c.closePath(); c.fill(); c.stroke(); });
      }
      c.strokeStyle = '#ff6a1a'; c.lineWidth = 5;
      c.beginPath(); for (let x = 0; x < P; x += 6) { const y = base - 34 + 6 * Math.sin(x * 0.03) + 3 * Math.sin(x * 0.11); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 1.5; c.stroke();
    }
  },
  swamp(c, P, H, base, far, fill, line, rand, twice) {
    rollingHills(c, P, H, base, far ? 50 : 26, rand, fill, line);
    const n = far ? 30 : 14;
    for (let i = 0; i < n; i++) { const x = (i + rand() * 0.8) * (P / n), h = (far ? 70 : 120) + rand() * (far ? 50 : 80); twice((o) => deadTree(c, x + o, base - (far ? 30 : 14), h, far ? shade(fill, -0.25) : '#2d2a22')); }
    if (!far) {
      // moss drapes + cattails
      c.strokeStyle = '#7fa35a'; c.lineWidth = 3;
      for (let i = 0; i < 30; i++) { const x = rand() * P, y = base - 80 - rand() * 90, len = 20 + rand() * 40; twice((o) => { c.beginPath(); c.moveTo(x + o, y); c.quadraticCurveTo(x + o + 4, y + len * 0.5, x + o - 2, y + len); c.stroke(); }); }
      for (let i = 0; i < 40; i++) { const x = rand() * P, h = 20 + rand() * 24; twice((o) => { c.strokeStyle = '#3f5a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + o, base - 10); c.lineTo(x + o + 2, base - 10 - h); c.stroke(); c.fillStyle = '#6b4a2a'; c.fillRect(x + o - 1, base - 10 - h, 5, 9); }); }
    }
  },
  glacier(c, P, H, base, far, fill, line, rand, twice) {
    if (far) {
      // ice walls: tall blocky cliffs with crevasse lines
      for (let i = 0; i < 7; i++) {
        const x = (i + rand() * 0.5) * (P / 7), w = 220 + rand() * 120, h = 130 + rand() * 90;
        twice((o) => {
          c.beginPath(); c.moveTo(x + o - w / 2, base); c.lineTo(x + o - w * 0.45, base - h * 0.8); c.lineTo(x + o - w * 0.2, base - h); c.lineTo(x + o + w * 0.3, base - h * 0.9); c.lineTo(x + o + w / 2, base - h * 0.5); c.lineTo(x + o + w * 0.55, base); c.closePath();
          c.fillStyle = shade(fill, (i % 2) * 0.08); c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
          c.strokeStyle = 'rgba(40,90,160,0.35)'; c.lineWidth = 3;
          c.beginPath(); for (let k = 0; k < 4; k++) { const sx = x + o - w * 0.3 + k * w * 0.16; c.moveTo(sx, base - h * 0.85 + k * 8); c.lineTo(sx + 10, base - 10); } c.stroke();
          c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + o - w * 0.45, base - h * 0.8); c.lineTo(x + o - w * 0.2, base - h); c.lineTo(x + o + w * 0.3, base - h * 0.9); c.lineTo(x + o + w * 0.25, base - h * 0.82); c.lineTo(x + o - w * 0.2, base - h * 0.9); c.closePath(); c.fill();
        });
      }
    } else {
      rollingHills(c, P, H, base, 30, rand, '#e9f3fb', line);
      for (let i = 0; i < 16; i++) {
        const x = (i + rand()) * (P / 16), w = 30 + rand() * 50, h = 24 + rand() * 40;
        twice((o) => { c.fillStyle = '#bfe3f7'; c.strokeStyle = '#5a8ebb'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + o - w / 2, base - 20); c.lineTo(x + o - w * 0.3, base - 20 - h); c.lineTo(x + o + w * 0.2, base - 20 - h * 0.85); c.lineTo(x + o + w / 2, base - 20); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(x + o - w * 0.3, base - 20 - h); c.lineTo(x + o + w * 0.2, base - 20 - h * 0.85); c.lineTo(x + o + w * 0.1, base - 20 - h * 0.6); c.closePath(); c.fill(); });
      }
    }
  },
  neon(c, P, H, base, far, fill, line, rand, twice) {
    const lit = far ? ['#ffe14a', '#ffffff', '#4dd2ff'] : ['#ffe14a', '#ff3cc7', '#4dd2ff', '#ffffff'];
    const n = far ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const w = (far ? 40 : 90) + rand() * (far ? 50 : 90), x = (i + rand() * 0.5) * (P / n), h = (far ? 90 : 60) + rand() * (far ? 170 : 150);
      twice((o) => {
        building(c, x + o, base, w, h, far ? fill : shade(fill, 0.1), line, lit, rand);
        if (!far) {
          // rooftop billboard + antenna
          if (rand() < 0.6) { const bw = w * 0.7, bh = 26; c.fillStyle = ['#ff3cc7', '#4dd2ff', '#ffe14a', '#3ddc84'][i % 4]; c.fillRect(x + o + w * 0.15, base - h - bh - 8, bw, bh); c.strokeStyle = line; c.lineWidth = 2; c.strokeRect(x + o + w * 0.15, base - h - bh - 8, bw, bh); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x + o + w * 0.2, base - h - bh + 2, bw * 0.5, 6); c.fillRect(x + o + w * 0.2, base - h - bh + 12, bw * 0.3, 6); }
          else { c.strokeStyle = '#9aa0aa'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + o + w / 2, base - h); c.lineTo(x + o + w / 2, base - h - 40); c.stroke(); c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(x + o + w / 2, base - h - 42, 4, 0, TAU); c.fill(); }
        }
      });
    }
  },
  dino(c, P, H, base, far, fill, line, rand, twice) {
    if (far) {
      rollingHills(c, P, H, base, 40, rand, shade(fill, 0.05), line);
      for (let i = 0; i < 4; i++) { const x = (i + rand() * 0.6) * (P / 4), w = 200 + rand() * 180, h = 90 + rand() * 90; twice((o) => { c.beginPath(); c.moveTo(x + o - w / 2, base); c.lineTo(x + o - w * 0.1, base - h); c.lineTo(x + o + w * 0.1, base - h); c.lineTo(x + o + w / 2, base); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke(); }); }
    } else {
      rollingHills(c, P, H, base, 30, rand, fill, line);
      for (let i = 0; i < 10; i++) { const x = (i + rand() * 0.8) * (P / 10), h = 90 + rand() * 70; twice((o) => palm(c, x + o, base - 12, h, '#6b4a2a', '#5f8f3a')); }
      // rib-cage arcs
      c.strokeStyle = '#f1ead6'; c.lineWidth = 6; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const x = rand() * P; twice((o) => { for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + o + k * 22, base - 14, 30 + k * 3, Math.PI, TAU); c.stroke(); } }); }
    }
  },
  sky(c, P, H, base, far, fill, line, rand, twice) {
    const n = far ? 10 : 7;
    for (let i = 0; i < n; i++) {
      const x = (i + rand() * 0.8) * (P / n), s = (far ? 1.6 : 2.6) + rand() * 1.2, y = base - (far ? 30 : 10) - rand() * 50;
      twice((o) => { puff(c, x + o, y, s); c.fillStyle = far ? '#ffffff' : '#eef5ff'; c.fill(); c.strokeStyle = 'rgba(90,120,180,0.4)'; c.lineWidth = 3; c.stroke(); });
    }
    if (!far) {
      // a floating island
      for (let i = 0; i < 2; i++) { const x = (i + 0.5) * (P / 2) + rand() * 100, w = 160, y = base - 120 - rand() * 40; twice((o) => { c.fillStyle = '#7a5233'; c.beginPath(); c.moveTo(x + o - w / 2, y); c.lineTo(x + o - w * 0.2, y + 50); c.lineTo(x + o + w * 0.3, y + 36); c.lineTo(x + o + w / 2, y); c.closePath(); c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke(); c.fillStyle = '#5cae48'; c.beginPath(); c.ellipse(x + o, y, w / 2, 12, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#3a7d48'; c.beginPath(); pinePath(c, x + o + 20, y - 4, 26, 50); c.fill(); c.stroke(); }); }
    }
  },
  haunted(c, P, H, base, far, fill, line, rand, twice) {
    rollingHills(c, P, H, base, far ? 70 : 36, rand, fill, line);
    const n = far ? 24 : 12;
    for (let i = 0; i < n; i++) { const x = (i + rand() * 0.8) * (P / n), h = (far ? 60 : 120) + rand() * (far ? 50 : 80); twice((o) => deadTree(c, x + o, base - (far ? 36 : 14), h, far ? shade(fill, -0.3) : '#120d1c')); }
    if (far) {
      // the haunted house on a hill
      const x = P * 0.5;
      twice((o) => { c.fillStyle = '#17112a'; c.strokeStyle = line; c.lineWidth = 2.5; c.beginPath(); c.rect(x + o - 60, base - 150, 120, 90); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x + o - 70, base - 150); c.lineTo(x + o, base - 210); c.lineTo(x + o + 70, base - 150); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.rect(x + o + 20, base - 215, 22, 70); c.fill(); c.stroke(); c.fillStyle = '#ffd23f'; c.fillRect(x + o - 40, base - 130, 16, 20); c.fillRect(x + o + 24, base - 130, 16, 20); c.fillRect(x + o - 8, base - 95, 16, 30); });
    } else {
      // a picket fence and gravestones
      c.fillStyle = '#4a3f5a'; c.strokeStyle = line; c.lineWidth = 2;
      for (let x = 0; x < P; x += 26) { c.beginPath(); c.rect(x, base - 42, 8, 32); c.fill(); c.stroke(); }
      c.fillRect(0, base - 34, P, 5); c.fillRect(0, base - 20, P, 5);
      for (let i = 0; i < 10; i++) { const x = rand() * P; twice((o) => { c.fillStyle = '#6e6e85'; c.beginPath(); c.moveTo(x + o - 14, base - 10); c.lineTo(x + o - 14, base - 40); c.arc(x + o, base - 40, 14, Math.PI, TAU); c.lineTo(x + o + 14, base - 10); c.closePath(); c.fill(); c.stroke(); }); }
    }
  },
  moon(c, P, H, base, far, fill, line, rand, twice) {
    rollingHills(c, P, H, base, far ? 60 : 30, rand, fill, line);
    // craters
    c.strokeStyle = shade(fill, -0.3); c.lineWidth = 2.5;
    for (let i = 0; i < (far ? 14 : 20); i++) { const x = rand() * P, y = base - rand() * (far ? 30 : 20), w = (far ? 20 : 30) + rand() * 40; twice((o) => { c.fillStyle = shade(fill, -0.15); c.beginPath(); c.ellipse(x + o, y, w / 2, w / 5, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = shade(fill, 0.12); c.beginPath(); c.ellipse(x + o, y - w / 10, w / 2, w / 7, 0, Math.PI, TAU); c.fill(); }); }
    if (far) {
      // the base: domes + a tower
      const x = P * 0.3;
      twice((o) => { c.fillStyle = '#c9ccd8'; c.strokeStyle = line; c.lineWidth = 2.5; for (const [dx, r] of [[0, 60], [90, 40], [-80, 36]]) { c.beginPath(); c.arc(x + o + dx, base - 20, r, Math.PI, TAU); c.closePath(); c.fill(); c.stroke(); } c.fillStyle = '#4dd2ff'; for (const [dx, r] of [[0, 60], [90, 40]]) c.fillRect(x + o + dx - r * 0.3, base - 20 - r * 0.6, r * 0.6, 8); c.strokeStyle = '#9aa0aa'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + o + 150, base - 20); c.lineTo(x + o + 150, base - 120); c.stroke(); c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(x + o + 150, base - 124, 5, 0, TAU); c.fill(); });
    } else {
      for (let i = 0; i < 4; i++) { const x = rand() * P; twice((o) => { c.strokeStyle = '#9aa0aa'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + o, base - 10); c.lineTo(x + o, base - 70); c.moveTo(x + o - 16, base - 55); c.lineTo(x + o + 16, base - 55); c.stroke(); c.fillStyle = '#e8ecf4'; c.beginPath(); c.ellipse(x + o + 10, base - 70, 14, 7, -0.6, 0, TAU); c.fill(); }); }
    }
  },
  rainbow(c, P, H, base, far, fill, line, rand, twice) {
    // striped pastel hills
    const cols = far ? ['#b9a6ff', '#ffb3d9', '#a6e3ff'] : ['#8ef0b2', '#ffe98a', '#ffb3b3'];
    const n1 = 3, p1 = rand() * TAU;
    for (let k = 0; k < 3; k++) {
      c.beginPath(); c.moveTo(0, H + 2);
      for (let x = 0; x <= P; x += 8) { const u = x / P; c.lineTo(x, base - (far ? 80 : 40) * (0.5 + 0.3 * Math.sin(u * TAU * n1 + p1 + k)) - k * 14); }
      c.lineTo(P, H + 2); c.closePath(); c.fillStyle = cols[k]; c.fill(); c.strokeStyle = line; c.lineWidth = 2.5; c.stroke();
    }
    if (!far) {
      // lollipop trees
      for (let i = 0; i < 14; i++) { const x = (i + rand()) * (P / 14), h = 50 + rand() * 50, col = ['#ff5d5d', '#ff9f1a', '#3ddc84', '#22b8ff', '#8f6bff'][i % 5]; twice((o) => { c.strokeStyle = '#8a5a32'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + o, base - 10); c.lineTo(x + o, base - 10 - h); c.stroke(); c.fillStyle = col; c.strokeStyle = line; c.lineWidth = 2.5; c.beginPath(); c.arc(x + o, base - 10 - h, 24, 0, TAU); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(x + o - 7, base - 18 - h, 8, 0, TAU); c.fill(); }); }
    }
  },
};

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
  if (LAYER_STYLES[st]) { LAYER_STYLES[st](c, P, H, base, far, fill, line, rand, twice, th); }
  else if (st === 'lake' && !far) {
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
  if (bd.style === 'rainbow') drawRainbowArc(ctx, W, H, horizon);
  if (bd.night) {
    if (bd.style !== 'volcano') for (let i = 0; i < bd.stars.length; i++) {
      const s = bd.stars[i];
      const x = (((s.x * W * 1.3 - cam.x * cam.z * 0.01) % (W * 1.3)) + W * 1.3) % (W * 1.3);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, s.y * H, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    if (bd.planet === 'earth') drawEarth(ctx, W * 0.78, H * 0.2, Math.min(W, H) * 0.09, t);
    else if (bd.planet === 'none') { /* no planet: a glow instead (volcano, neon) */
      const g = ctx.createLinearGradient(0, horizon - H * 0.35, 0, horizon);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, bd.style === 'neon' ? 'rgba(255,60,199,0.35)' : 'rgba(255,110,30,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, horizon - H * 0.35, W, H * 0.35);
    }
    // the moon
    const ex = W * 0.8, ey = H * 0.18, er = Math.min(W, H) * 0.075;
    if (bd.planet === 'moon') {
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
    }
  } else {
    const sx = W * 0.8, sy = H * 0.18, sr = Math.min(W, H) * 0.08;
    ctx.fillStyle = 'rgba(255,250,200,0.35)';
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = bd.style === 'desert' || bd.style === 'canyon' || bd.style === 'dino' ? '#fff0a0' : '#fff4a3';
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
  const sea = bd.style === 'lake' || bd.style === 'beach';
  const midBase = horizon + (sea ? 74 : 40) * zs;
  // far layer
  drawStrip(ctx, W, L.far, horizon, zs, cam.x * cam.z * 0.05);
  ctx.fillStyle = bd.style === 'sky' ? bd.theme.sky[1] : bd.theme.far;
  ctx.fillRect(0, horizon - 1, W, midBase - horizon + 6);
  if (bd.style === 'dino') drawTrex(ctx, W, H, horizon, zs, cam, t);
  if (sea || bd.style === 'forest' || bd.style === 'night') {
    // a lake / the sea between the far shore and the near trees, the far shore mirrored in it
    const lakeTop = horizon - 2, lakeH = (sea ? 70 : 16) * zs;
    ctx.fillStyle = bd.water;
    ctx.fillRect(0, lakeTop, W, lakeH + 4);
    if (sea) {
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
  if (!bd.night || bd.style === 'haunted') {
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

// v1.5 sky extras
function drawEarth(ctx, x, y, r, t) {
  ctx.fillStyle = 'rgba(120,180,255,0.14)';
  ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#2f7fd6'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.fillStyle = '#3f9a4a';
  const o = (t * 0.02) % 1 * 2 * r;
  for (const [cx, cy, w, h] of [[-0.3, -0.2, 0.5, 0.45], [0.35, 0.1, 0.4, 0.5], [-0.1, 0.45, 0.6, 0.3], [0.7, -0.5, 0.4, 0.3]]) {
    for (const k of [0, -2 * r]) { ctx.beginPath(); ctx.ellipse(x + cx * r - o + k * -1 + 2 * r * (k ? 1 : 0), y + cy * r, w * r * 0.5, h * r * 0.5, 0.4, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [cx, cy, w] of [[-0.5, 0.1, 0.5], [0.2, -0.45, 0.6], [0.4, 0.5, 0.45]]) { ctx.beginPath(); ctx.ellipse(x + cx * r, y + cy * r, w * r * 0.5, 0.08 * r, -0.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,30,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.1, r * 1.05, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}
function drawRainbowArc(ctx, W, H, horizon) {
  const cols = ['#ff5d5d', '#ff9f1a', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff'];
  const cx = W * 0.5, cy = horizon + H * 0.1, r0 = Math.max(W, H) * 0.55, bw = Math.max(6, H * 0.022);
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = bw;
  for (let i = 0; i < cols.length; i++) { ctx.strokeStyle = cols[i]; ctx.beginPath(); ctx.arc(cx, cy, r0 - i * bw, Math.PI, TAU); ctx.stroke(); }
  ctx.restore();
}
// Dino Dunes: a T-rex striding along the far layer
function drawTrex(ctx, W, H, horizon, zs, cam, t) {
  const span = W * 1.6;
  const x = ((((W * 0.6 - cam.x * cam.z * 0.05 - t * 9) % span) + span) % span) - W * 0.3;
  const s = 1.1 * zs, y = horizon + 2, bob = Math.sin(t * 4) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(s, s);
  ctx.fillStyle = '#3a4a2a'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-110, -30); ctx.quadraticCurveTo(-60, -60, -10, -58); ctx.lineTo(20, -70); ctx.lineTo(40, -98); ctx.lineTo(80, -100); ctx.lineTo(96, -88); ctx.lineTo(84, -72); ctx.lineTo(50, -70);
  ctx.lineTo(42, -56); ctx.lineTo(22, -40); ctx.lineTo(14, -10); ctx.lineTo(26, 0); ctx.lineTo(0, 0); ctx.lineTo(-6, -22); ctx.lineTo(-30, -24);
  ctx.lineTo(-34, -6); ctx.lineTo(-18, 0); ctx.lineTo(-48, 0); ctx.lineTo(-52, -30); ctx.lineTo(-110, -22); ctx.closePath();
  ctx.fill(); ctx.stroke();
  const leg = Math.sin(t * 8) * 8;
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-2 + leg, 0); ctx.lineTo(16 + leg, 0); ctx.lineTo(14, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(76, -90, 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(60 + k * 8, -74); ctx.lineTo(64 + k * 8, -66); ctx.lineTo(68 + k * 8, -74); } ctx.fill();
  ctx.restore();
}
// v1.5 Fog mutator / Haunted Hollow: a near-layer fog that hides the horizon and thins near the ground around you
let fogCache = { key: '', g1: null, g2: null };
export function drawFog(ctx, view, cam, bd, fog, playerY, t) {
  const { W, H } = view;
  const col = bd.fogColor;
  const key = col + '|' + H;
  if (fogCache.key !== key) {
    const g1 = ctx.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, withAlpha(col, 0.55)); g1.addColorStop(0.45, withAlpha(col, 0.92)); g1.addColorStop(0.62, withAlpha(col, 0.35)); g1.addColorStop(1, withAlpha(col, 0.15));
    fogCache = { key, g1 };
  }
  ctx.save();
  ctx.globalAlpha = fog;
  ctx.fillStyle = fogCache.g1;
  ctx.fillRect(0, 0, W, H);
  // drifting fog banks
  ctx.fillStyle = withAlpha(col, 0.5);
  for (const p of bd.fogPuffs) {
    const x = ((((p.x * W * 1.4 - cam.x * cam.z * 0.3 + t * 12 * p.v * 20) % (W * 1.4)) + W * 1.4) % (W * 1.4)) - W * 0.2;
    const y = p.y * H + Math.sin(t * 0.5 + p.p) * 10;
    ctx.beginPath(); ctx.ellipse(x, y, 110 * p.s, 26 * p.s, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// weather (screen space, stateless functions of t), drawn over the world: snow / ash / confetti flakes, parrots or
// bats flying across, wind streaks on Sky Bridge
export function drawWeather(ctx, view, cam, bd, t, wind = 0) {
  const { W, H } = view;
  if (bd.flakes.length) {
    const ash = bd.weather === 'ash', conf = bd.weather === 'confetti';
    ctx.fillStyle = ash ? 'rgba(170,160,160,0.75)' : 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    for (const f of bd.flakes) {
      if (f.ember || conf) continue;
      const x = ((((f.x * W + Math.sin(t * 0.8 + f.w) * 18 - cam.x * cam.z * 0.4) % W) + W) % W);
      const y = (((f.y + t * f.v) % 1) + 1) % 1 * H;
      ctx.moveTo(x + f.s, y);
      ctx.arc(x, y, f.s, 0, TAU);
    }
    ctx.fill();
    if (ash) {
      ctx.fillStyle = '#ff9a3a';
      ctx.beginPath();
      for (const f of bd.flakes) {
        if (!f.ember) continue;
        const x = ((((f.x * W + Math.sin(t * 1.3 + f.w) * 24 - cam.x * cam.z * 0.4) % W) + W) % W);
        const y = (((f.y - t * f.v * 0.6) % 1) + 1) % 1 * H;
        ctx.moveTo(x + f.s * 0.6, y); ctx.arc(x, y, f.s * 0.6, 0, TAU);
      }
      ctx.fill();
    }
    if (conf) {
      for (const f of bd.flakes) {
        const x = ((((f.x * W + Math.sin(t * 1.5 + f.w) * 30 - cam.x * cam.z * 0.4) % W) + W) % W);
        const y = (((f.y + t * f.v) % 1) + 1) % 1 * H;
        ctx.fillStyle = f.c;
        const w = f.s * 2 * Math.abs(Math.cos(t * 5 + f.w)) + 1;
        ctx.fillRect(x - w / 2, y - f.s / 2, w, f.s);
      }
    }
  }
  if (bd.fliers.length) {
    const bats = bd.weather === 'bats';
    for (const f of bd.fliers) {
      const x = ((((f.p * W + t * f.v * W * (bats ? -1.4 : 0.9) - cam.x * cam.z * 0.12) % (W * 1.3)) + W * 1.3) % (W * 1.3)) - W * 0.15;
      const y = f.y * H + Math.sin(t * 2 + f.p * 4) * 12;
      const flap = Math.sin(t * (bats ? 18 : 9) + f.p) * 8 * f.s;
      ctx.lineWidth = bats ? 2.5 : 3;
      ctx.strokeStyle = bats ? '#0c0814' : OUT;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 12 * f.s, y - flap); ctx.quadraticCurveTo(x - 5 * f.s, y + 2, x, y); ctx.quadraticCurveTo(x + 5 * f.s, y + 2, x + 12 * f.s, y - flap);
      ctx.stroke();
      if (!bats) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.ellipse(x, y + 1, 6 * f.s, 3.5 * f.s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x + 6 * f.s, y); ctx.lineTo(x + 11 * f.s, y + 1); ctx.lineTo(x + 6 * f.s, y + 3); ctx.fill(); }
      else { ctx.fillStyle = '#0c0814'; ctx.beginPath(); ctx.ellipse(x, y + 1, 3 * f.s, 2.5 * f.s, 0, 0, TAU); ctx.fill(); }
    }
  }
  if (Math.abs(wind) > 0.3) {
    ctx.globalAlpha = Math.min(0.5, Math.abs(wind) * 0.18);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = 10, dir = Math.sign(wind);
    for (let i = 0; i < n; i++) {
      const y = H * ((i * 0.37 + 0.05) % 1);
      const x = (((i * 173 + t * 420 * dir * Math.abs(wind) * 0.5) % (W + 160)) + W + 160) % (W + 160) - 80;
      ctx.moveTo(x, y); ctx.lineTo(x - dir * (40 + 30 * Math.abs(wind)), y + 3);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
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
    const hill = course.hill;
    if (hill && x > hill.xBase) { if (x > hill.snowX) continue; const f = clamp((course.terrainY(x) - hill.yBase) / Math.max(1, hill.height), 0, 1); if (r < 0.45 + 0.5 * f) continue; }
    const gy = course.terrainY(x) - 0.4;
    const k = 0.7 + rhash(s + 0.25) * 0.6;
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(k, k);
    if (DECOR_STYLES[st]) DECOR_STYLES[st](ctx, r, s);
    else if (st === 'desert') {
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

// v1.5 near decor per world (vehicle-scale, base at the origin, +y up; the outline is set by the caller)
const DECOR_STYLES = {
  jungle(ctx, r) {
    // big leaves / ferns
    ctx.fillStyle = r > 0.8 ? '#2c8a4a' : '#1f6e3c';
    for (let k = 0; k < 4; k++) { const a = -0.6 + k * 0.45, L = 2.2 + (k % 2) * 0.8; ctx.beginPath(); ctx.moveTo(0, 0.2); ctx.quadraticCurveTo(Math.cos(a) * L * 0.5 - 0.5, Math.sin(a) * L + 1.4, Math.cos(a) * L, Math.sin(a) * L + 1.8); ctx.quadraticCurveTo(Math.cos(a) * L * 0.5 + 0.4, Math.sin(a) * L * 0.5 + 0.8, 0, 0.2); ctx.fill(); ctx.stroke(); }
  },
  canyon(ctx, r) {
    ctx.fillStyle = r > 0.75 ? '#c25a3a' : '#9c4a30';
    ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(-0.9, 1.6); ctx.lineTo(-0.2, 2.1); ctx.lineTo(0.6, 1.5); ctx.lineTo(1.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,120,0.3)'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(-0.8, 0.6); ctx.lineTo(0.8, 0.5); ctx.moveTo(-0.7, 1.1); ctx.lineTo(0.5, 1.0); ctx.stroke();
  },
  beach(ctx, r) {
    if (r > 0.7) { ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.5, 2, 0.4, 3.6); ctx.stroke(); ctx.fillStyle = '#3aa36f'; for (let k = 0; k < 5; k++) { const a = -0.2 - k * 0.55; ctx.beginPath(); ctx.moveTo(0.4, 3.6); ctx.quadraticCurveTo(0.4 + Math.cos(a) * 0.9, 3.6 + Math.sin(a) * 0.9 + 0.5, 0.4 + Math.cos(a) * 1.7, 3.6 + Math.sin(a) * 1.7); ctx.quadraticCurveTo(0.4 + Math.cos(a) * 0.9, 3.6 + Math.sin(a) * 0.9 - 0.1, 0.4, 3.6); ctx.fill(); } ctx.lineWidth = 0.05; }
    else { ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.moveTo(-0.35, 0.3); ctx.quadraticCurveTo(0, 0.95, 0.4, 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, 0.3); ctx.lineTo(-0.15, 0.7); ctx.moveTo(0, 0.3); ctx.lineTo(0.15, 0.7); ctx.stroke(); }
  },
  volcano(ctx, r) {
    ctx.fillStyle = r > 0.75 ? '#3a2522' : '#2a1a18';
    ctx.beginPath(); ctx.moveTo(-1.3, 0); ctx.lineTo(-0.7, 1.4); ctx.lineTo(-0.1, 1.9); ctx.lineTo(0.5, 1.2); ctx.lineTo(1.2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(-0.5, 0.2); ctx.lineTo(-0.2, 0.9); ctx.moveTo(0.3, 0.1); ctx.lineTo(0.2, 0.7); ctx.stroke();
  },
  swamp(ctx, r) {
    if (r > 0.72) { ctx.strokeStyle = '#3a2e20'; ctx.lineCap = 'round'; ctx.lineWidth = 0.26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.1, 2.6); ctx.stroke(); ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(0.05, 1.6); ctx.lineTo(-0.9, 2.6); ctx.moveTo(0.1, 2.2); ctx.lineTo(0.9, 3.0); ctx.stroke(); ctx.strokeStyle = '#7fa35a'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(-0.5, 2.2); ctx.quadraticCurveTo(-0.45, 1.6, -0.6, 1.2); ctx.moveTo(0.6, 2.7); ctx.quadraticCurveTo(0.7, 2.2, 0.55, 1.7); ctx.stroke(); }
    else { ctx.strokeStyle = '#3f5a2a'; ctx.lineWidth = 0.07; ctx.beginPath(); for (const dx of [-0.4, 0, 0.35]) { ctx.moveTo(dx, 0); ctx.lineTo(dx + 0.1, 1.3 + Math.abs(dx)); } ctx.stroke(); ctx.fillStyle = '#6b4a2a'; for (const dx of [-0.4, 0, 0.35]) ctx.fillRect(dx + 0.03, 1.2 + Math.abs(dx), 0.14, 0.4); }
  },
  glacier(ctx, r) {
    ctx.fillStyle = r > 0.75 ? '#dff3ff' : '#bfe3f7';
    ctx.beginPath(); ctx.moveTo(-1.1, 0); ctx.lineTo(-0.6, 1.9); ctx.lineTo(-0.1, 1.3); ctx.lineTo(0.3, 2.4); ctx.lineTo(0.9, 0.4); ctx.lineTo(1.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(-0.6, 1.9); ctx.lineTo(-0.1, 1.3); ctx.lineTo(-0.3, 0.8); ctx.closePath(); ctx.fill();
  },
  neon(ctx, r) {
    // a street lamp
    ctx.strokeStyle = '#5b616d'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4.2); ctx.lineTo(0.9, 4.2); ctx.stroke();
    const col = r > 0.8 ? '#ff3cc7' : r > 0.65 ? '#4dd2ff' : '#ffe14a';
    ctx.fillStyle = withAlpha(col, 0.25); ctx.beginPath(); ctx.arc(0.9, 4.0, 0.9, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0.9, 4.05, 0.22, 0, TAU); ctx.fill(); ctx.stroke();
  },
  dino(ctx, r) {
    if (r > 0.75) { ctx.strokeStyle = '#f1ead6'; ctx.lineCap = 'round'; ctx.lineWidth = 0.16; ctx.beginPath(); for (let k = 0; k < 3; k++) ctx.arc(k * 0.7 - 0.7, 0, 1.0 + k * 0.1, Math.PI, TAU); ctx.stroke(); ctx.lineWidth = 0.05; }
    else { ctx.fillStyle = '#5f8f3a'; for (let k = 0; k < 5; k++) { const a = Math.PI * (0.2 + k * 0.15); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * 1.0 + 0.3, Math.sin(a) * 1.0, Math.cos(a) * 2.0, Math.sin(a) * 2.0); ctx.quadraticCurveTo(Math.cos(a) * 1.0 - 0.3, Math.sin(a) * 1.0, 0, 0); ctx.fill(); ctx.stroke(); } }
  },
  sky(ctx, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(-0.8, 0.3, 0.7, 0, TAU); ctx.arc(0.1, 0.6, 0.9, 0, TAU); ctx.arc(1.0, 0.3, 0.65, 0, TAU); ctx.fill();
  },
  haunted(ctx, r) {
    if (r > 0.7) { ctx.strokeStyle = '#120d1c'; ctx.lineCap = 'round'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.15, 2.8); ctx.stroke(); ctx.lineWidth = 0.16; ctx.beginPath(); ctx.moveTo(0.08, 1.7); ctx.lineTo(-1.0, 2.9); ctx.moveTo(0.15, 2.4); ctx.lineTo(1.1, 3.3); ctx.moveTo(0.15, 2.8); ctx.lineTo(-0.2, 3.8); ctx.stroke(); ctx.lineWidth = 0.05; }
    else { ctx.fillStyle = '#4a3f5a'; for (let k = -2; k <= 2; k++) { ctx.fillRect(k * 0.5 - 0.08, 0, 0.16, 1.1); } ctx.fillRect(-1.1, 0.5, 2.2, 0.12); ctx.fillRect(-1.1, 0.9, 2.2, 0.12); }
  },
  moon(ctx, r) {
    if (r > 0.7) { ctx.fillStyle = '#6e7082'; ctx.beginPath(); ctx.ellipse(0, 0.1, 1.6, 0.42, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b4b6c4'; ctx.beginPath(); ctx.ellipse(0, 0.3, 1.6, 0.3, 0, Math.PI, TAU); ctx.fill(); }
    else { ctx.fillStyle = '#8f91a3'; ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.quadraticCurveTo(-0.6, 0.9, 0, 0.9); ctx.quadraticCurveTo(0.7, 0.8, 0.7, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  },
  rainbow(ctx, r) {
    const col = ['#ff5d5d', '#ff9f1a', '#3ddc84', '#22b8ff', '#8f6bff'][Math.floor(r * 50) % 5];
    ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 2.4); ctx.stroke();
    ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0, 2.4, 1.0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(-0.3, 2.7, 0.3, 0, TAU); ctx.fill();
  },
};

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
  // strata (Sky Bridge: the girders under the road)
  ctx.strokeStyle = st === 'sky' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.13)';
  ctx.lineWidth = st === 'sky' ? 0.5 : 0.3;
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
  if (cam.z > 7 && bd.tuftKind !== 'none') {
    const tk = bd.tuftKind;
    ctx.fillStyle = bd.tuft;
    ctx.beginPath();
    const t0 = Math.floor(x0 / 1.9);
    for (let s = t0; s * 1.9 < x1; s++) {
      const r = rhash(s * 0.37);
      if (r < 0.5) continue;
      const x = s * 1.9 + r;
      if (course.waterAt(x) || course.bridgeAt(x)) continue;
      const y = g(x);
      if (tk === 'lump') { ctx.moveTo(x + 0.3, y); ctx.ellipse(x, y, 0.3, 0.14 + r * 0.06, 0, 0, Math.PI); }
      else if (tk === 'pebble') { ctx.moveTo(x + 0.14, y + 0.1); ctx.ellipse(x, y + 0.1, 0.14, 0.1, 0, 0, TAU); }
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
    case 'mushroom': {
      ctx.fillStyle = '#f3e6c8'; ctx.beginPath(); ctx.rect(-0.14, 0, 0.28, h * 0.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, h * 0.5, w / 2, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.2, h * 0.68, 0.08, 0, TAU); ctx.arc(0.12, h * 0.78, 0.07, 0, TAU); ctx.arc(0.25, h * 0.6, 0.05, 0, TAU); ctx.fill();
      break;
    }
    case 'barrel': {
      ctx.fillStyle = c; ctx.beginPath(); ctx.rect(-w / 2, 0, w, h); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-w / 2 + 0.06, h * 0.1, 0.1, h * 0.8);
      ctx.fillStyle = '#2b2b30'; ctx.fillRect(-w / 2 - 0.02, h * 0.28, w + 0.04, 0.07); ctx.fillRect(-w / 2 - 0.02, h * 0.68, w + 0.04, 0.07);
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-0.14, h * 0.4); ctx.lineTo(0.14, h * 0.4); ctx.lineTo(0, h * 0.62); ctx.closePath(); ctx.fill();
      break;
    }
    case 'crab': {
      ctx.strokeStyle = c; ctx.lineWidth = 0.07;
      ctx.beginPath(); for (let k = -1; k <= 1; k += 2) for (let j = 0; j < 3; j++) { const a = Math.PI * (0.15 + j * 0.2); ctx.moveTo(k * 0.2, 0.2); ctx.lineTo(k * (0.2 + Math.cos(a) * 0.3 + 0.1), 0.2 + Math.sin(a) * 0.1 - 0.15 + Math.sin(t * 8 + j) * 0.03); } ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw;
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0.25, w / 2 - 0.1, h / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-0.42, 0.45, 0.12, 0, TAU); ctx.arc(0.42, 0.45, 0.12, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.1, 0.42, 0.06, 0, TAU); ctx.arc(0.1, 0.42, 0.06, 0, TAU); ctx.fill();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-0.09, 0.42, 0.03, 0, TAU); ctx.arc(0.11, 0.42, 0.03, 0, TAU); ctx.fill();
      break;
    }
    case 'sandcastle': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.rect(-w / 2, 0, w, h * 0.45); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(-w * 0.3, h * 0.45, w * 0.6, h * 0.4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let k = -1; k <= 1; k++) ctx.rect(k * w * 0.2 - 0.06, h * 0.85, 0.12, 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(0, h * 0.97); ctx.lineTo(0, h * 0.97 + 0.3); ctx.lineTo(0.25, h * 0.97 + 0.22); ctx.lineTo(0, h * 0.97 + 0.14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.rect(-0.08, 0.02, 0.16, 0.25); ctx.stroke();
      break;
    }
    case 'beachball': {
      const r = w / 2;
      ctx.save(); ctx.translate(0, r); ctx.rotate(-t * 1.5 - id);
      const cols = [c, '#ffffff', '#ffd23f', '#22b8ff', '#3ddc84', '#ffffff'];
      for (let k = 0; k < 6; k++) { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, (k * TAU) / 6, ((k + 1) * TAU) / 6); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'lavarock': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.4, h * 0.7); ctx.lineTo(-0.1, h); ctx.lineTo(w * 0.35, h * 0.8); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      const gl = 0.6 + 0.4 * Math.sin(t * 4 + id);
      ctx.strokeStyle = `rgba(255,120,30,${gl})`; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(-0.3, 0.15); ctx.lineTo(-0.15, 0.6); ctx.lineTo(0.1, 0.5); ctx.moveTo(0.25, 0.1); ctx.lineTo(0.2, 0.55); ctx.stroke();
      ctx.fillStyle = `rgba(255,200,60,${gl})`; ctx.beginPath(); ctx.arc(-0.05, h * 0.75, 0.08, 0, TAU); ctx.fill();
      break;
    }
    case 'frog': {
      const hop = Math.max(0, Math.sin(t * 3 + id)) * 0.15;
      ctx.translate(0, hop);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, 0.22, w / 2, 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-0.3, 0.08, 0.16, 0.08, 0, 0, TAU); ctx.ellipse(0.3, 0.08, 0.16, 0.08, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-0.14, 0.44, 0.1, 0, TAU); ctx.arc(0.14, 0.44, 0.1, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.14, 0.45, 0.06, 0, TAU); ctx.arc(0.14, 0.45, 0.06, 0, TAU); ctx.fill();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-0.13, 0.45, 0.03, 0, TAU); ctx.arc(0.15, 0.45, 0.03, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0, 0.2, 0.18, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      break;
    }
    case 'iceblock': {
      ctx.fillStyle = withAlpha(c, 0.9);
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.45, h * 0.9); ctx.lineTo(w * 0.1, h); ctx.lineTo(w / 2, h * 0.7); ctx.lineTo(w * 0.45, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(-w * 0.45, h * 0.9); ctx.lineTo(w * 0.1, h); ctx.lineTo(-0.05, h * 0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(60,120,200,0.5)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.1, 0.1); ctx.lineTo(0.25, 0.5); ctx.lineTo(0.1, 0.7); ctx.stroke();
      break;
    }
    case 'barrier': {
      ctx.fillStyle = '#2b2b30'; ctx.fillRect(-w / 2, 0, 0.12, h); ctx.fillRect(w / 2 - 0.12, 0, 0.12, h);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.rect(-w / 2, h * 0.55, w, h * 0.35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-w / 2 + k * 0.35, h * 0.55); ctx.lineTo(-w / 2 + k * 0.35 + 0.17, h * 0.55); ctx.lineTo(-w / 2 + k * 0.35 + 0.35, h * 0.9); ctx.lineTo(-w / 2 + k * 0.35 + 0.18, h * 0.9); ctx.closePath(); ctx.fill(); }
      ctx.strokeRect(-w / 2, h * 0.55, w, h * 0.35);
      const bl = 0.5 + 0.5 * Math.sin(t * 6 + id);
      ctx.fillStyle = `rgba(255,220,60,${bl})`; ctx.beginPath(); ctx.arc(0, h + 0.1, 0.1, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    }
    case 'trashcan': {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.42, h * 0.9); ctx.lineTo(w * 0.42, h * 0.9); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(c, -0.2); ctx.beginPath(); ctx.rect(-w * 0.5, h * 0.9, w, 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.arc(0, h * 0.5, 0.12, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.2, 0.1); ctx.lineTo(-0.17, h * 0.85); ctx.moveTo(0.2, 0.1); ctx.lineTo(0.17, h * 0.85); ctx.stroke();
      break;
    }
    case 'bones': {
      ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = 0.13;
      ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.arc(-0.55 + k * 0.32, 0, 0.5 + k * 0.08, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.5;
      ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.arc(-0.55 + k * 0.32, 0, 0.5 + k * 0.08, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-0.9, 0); ctx.lineTo(-0.7, 0.55); ctx.lineTo(-0.3, 0.6); ctx.lineTo(0, 0.4); ctx.lineTo(-0.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-0.45, 0.35, 0.1, 0, TAU); ctx.fill();
      break;
    }
    case 'egg': {
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7dba4a'; ctx.beginPath(); ctx.arc(-0.12, h * 0.4, 0.08, 0, TAU); ctx.arc(0.15, h * 0.65, 0.06, 0, TAU); ctx.arc(0.05, h * 0.2, 0.05, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.2, h * 0.85); ctx.lineTo(-0.08, h * 0.72); ctx.lineTo(0.02, h * 0.86); ctx.lineTo(0.14, h * 0.74); ctx.stroke();
      break;
    }
    case 'balloon': {
      const sway = Math.sin(t * 2 + id) * 0.08;
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, h * 0.4, sway * 2, h * 0.62); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw;
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(sway * 2, h * 0.78, w / 2, h * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(sway * 2 - 0.15, h * 0.86, 0.1, 0.14, 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(sway * 2 - 0.06, h * 0.58); ctx.lineTo(sway * 2 + 0.06, h * 0.58); ctx.lineTo(sway * 2, h * 0.63); ctx.closePath(); ctx.fill();
      break;
    }
    case 'tombstone': {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, h - w / 2); ctx.arc(0, h - w / 2, w / 2, Math.PI, TAU); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a5a70'; ctx.fillRect(-0.06, h * 0.35, 0.12, 0.45); ctx.fillRect(-0.2, h * 0.6, 0.4, 0.1);
      ctx.fillStyle = '#4f7d2a'; ctx.beginPath(); ctx.ellipse(-0.3, 0.05, 0.25, 0.1, 0, 0, Math.PI); ctx.fill();
      break;
    }
    case 'skull': {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, h * 0.6, w / 2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(-0.2, 0, 0.4, h * 0.35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-0.13, h * 0.62, 0.09, 0, TAU); ctx.arc(0.13, h * 0.62, 0.09, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, h * 0.45); ctx.lineTo(-0.05, h * 0.35); ctx.lineTo(0.05, h * 0.35); ctx.closePath(); ctx.fill();
      ctx.fillRect(-0.12, 0.05, 0.03, 0.12); ctx.fillRect(-0.02, 0.05, 0.03, 0.12); ctx.fillRect(0.08, 0.05, 0.03, 0.12);
      break;
    }
    case 'moonrock': {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.35, h * 0.8); ctx.lineTo(0.1, h); ctx.lineTo(w * 0.4, h * 0.6); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(-0.15, h * 0.5, 0.12, 0.07, 0, 0, TAU); ctx.ellipse(0.2, h * 0.3, 0.08, 0.05, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(0.0, h * 0.8, 0.15, 0.05, -0.4, 0, TAU); ctx.fill();
      break;
    }
    case 'star': {
      const bob = Math.sin(t * 3 + id) * 0.06;
      ctx.fillStyle = c; ctx.beginPath();
      const ro = w / 2, ri = ro * 0.45, cx = 0, cy = h / 2 + bob;
      ctx.moveTo(cx, cy + ro);
      for (let i = 1; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? ri : ro; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-0.1, cy + 0.05, 0.04, 0, TAU); ctx.arc(0.1, cy + 0.05, 0.04, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0, cy - 0.05, 0.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
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

// ===================================== v1.7 Hill Climb =====================================
// the mountain's dressing (course.js createHill): clouds (behind the slope, and a few translucent ones in front),
// the snow line, the flag poles with their pennants and cash tags, the summit cairn, wind streaks near the top
function puffCloud(ctx, x, y, w, k, outline = false) {
  ctx.beginPath();
  for (const [dx, dy, rr] of [[-0.3, 0, 0.26 * k], [0, 0.12, 0.34 * k], [0.32, 0, 0.26 * k], [0, -0.08, 0.3]]) { ctx.moveTo(x + dx * w + rr * w, y + dy * w); ctx.arc(x + dx * w, y + dy * w, rr * w, 0, TAU); }
  if (outline) ctx.stroke();
  ctx.fill();
}
export function drawHillClouds(ctx, hill, vis, t, front) {
  for (const c of hill.clouds) {
    if (c.front !== front) continue;
    const x = c.x + Math.sin(t * 0.21 * c.drift) * 2.5 + (front ? -t * 0.3 * c.drift : 0);
    if (x + c.w < vis.x0 || x - c.w > vis.x1 || c.y + c.w < vis.y0 || c.y - c.w > vis.y1) continue;
    if (front) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; puffCloud(ctx, x, c.y, c.w * 0.9, c.k); continue; }
    // an outer outline only: the stroke goes under the white fill
    ctx.strokeStyle = 'rgba(120,140,175,0.6)';
    ctx.lineWidth = 0.3;
    ctx.fillStyle = '#ffffff';
    puffCloud(ctx, x, c.y, c.w, c.k, true);
  }
}
export function drawHillSnow(ctx, course, vis, lw) {
  const h = course.hill;
  const xa = Math.max(h.snowX - 14, vis.x0 - 2), xb = Math.min(h.xEnd, vis.x1 + 2);
  if (xb <= xa) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // the white band fades in over 14 m, then a solid cap with a soft lower edge
  for (let x = xa; x < xb; x += 2) {
    const x2 = Math.min(xb, x + 2);
    const a = clamp((x - (h.snowX - 14)) / 14, 0, 1);
    if (a <= 0) continue;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.95 * a).toFixed(3) + ')';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(x, course.terrainY(x) - 0.12);
    ctx.lineTo(x2, course.terrainY(x2) - 0.12);
    ctx.stroke();
  }
  // snow lumps along the band and a blue-white sheen below it
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const t0 = Math.floor(Math.max(xa, h.snowX) / 1.7);
  for (let s = t0; s * 1.7 < xb; s++) {
    const r = rhash(s * 0.53);
    if (r < 0.35) continue;
    const x = s * 1.7 + r, y = course.terrainY(x) + 0.05;
    ctx.moveTo(x + 0.36, y);
    ctx.ellipse(x, y, 0.36 + r * 0.2, 0.2 + r * 0.08, 0, 0, Math.PI);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,220,255,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = Math.max(xa, h.snowX); x <= xb; x += 1) { const y = course.terrainY(x) - 0.75; if (x === Math.max(xa, h.snowX)) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.lineCap = 'butt';
}
function flagPole(ctx, x, y, h, col, lw, t, wave, passed) {
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = '#e8e8ee';
  ctx.fillRect(x - 0.08, y, 0.16, h);
  ctx.strokeRect(x - 0.08, y, 0.16, h);
  ctx.fillStyle = col;
  const w = 0.25 * Math.sin(t * 4 + wave);
  ctx.beginPath();
  ctx.moveTo(x + 0.08, y + h);
  ctx.quadraticCurveTo(x + 0.9, y + h - 0.2 + w * 0.5, x + 1.7, y + h - 0.45 + w);
  ctx.lineTo(x + 0.08, y + h - 0.9);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  if (passed) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 0.75, y + h - 0.45 + w * 0.4, 0.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(x, y + h + 0.12, 0.16, 0, TAU); ctx.fill(); ctx.stroke();
}
function cashTag(ctx, x, y, text, lw) {
  // a small wooden sign beside the pole with the flag's cash
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(x - 0.07, y, 0.14, 1.3);
  ctx.strokeRect(x - 0.07, y, 0.14, 1.3);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(x - 0.95, y + 1.0); ctx.lineTo(x + 0.95, y + 1.0); ctx.lineTo(x + 0.95, y + 1.85); ctx.lineTo(x - 0.95, y + 1.85);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  worldText(ctx, text, 0.5, x, y + 1.43, '#1f4d2e', false);
}
export function drawHill(ctx, hill, vis, lw, t, passed, tags) {
  ctx.lineJoin = 'round';
  for (let k = 0; k <= hill.flags; k++) {
    const x = hill.flagX[k], y = hill.flagY[k];
    if (x < vis.x0 - 4 || x > vis.x1 + 4) continue;
    const summit = k === hill.flags;
    const done = k > 0 && k <= passed;
    const col = k === 0 ? '#ffffff' : summit ? '#ffd23f' : done ? '#7dff6b' : '#ff8a1f';
    // the flag line on the ground
    ctx.strokeStyle = summit ? 'rgba(255,210,63,0.8)' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.18;
    ctx.setLineDash([0.4, 0.3]);
    ctx.beginPath(); ctx.moveTo(x - 1.4, y + 0.05); ctx.lineTo(x + 1.4, y + 0.05); ctx.stroke();
    ctx.setLineDash([]);
    flagPole(ctx, x, y - 0.1, summit ? 5.6 : 4.2, col, lw, t, k * 1.3, done);
    if (k > 0 && tags && tags[k]) cashTag(ctx, x - 1.6, y - 0.1, tags[k], lw);
  }
  // the summit: the cairn (a stack of stones) with a tiny flag, on the plateau
  const cx = hill.cairnX;
  if (cx > vis.x0 - 6 && cx < vis.x1 + 6) {
    const y = hill.summitY;
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUT;
    const stones = [[0, 0.5, 1.6, 0.55, '#8d8f99'], [0.1, 1.35, 1.3, 0.5, '#a0a3ad'], [-0.05, 2.1, 1.05, 0.45, '#8d8f99'], [0.08, 2.75, 0.8, 0.38, '#b3b6bf'], [0, 3.3, 0.55, 0.3, '#a0a3ad']];
    for (const [dx, dy, w, h, c] of stones) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx + dx, y + dy, w, h, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const [dx, dy, w] of stones) { ctx.beginPath(); ctx.ellipse(cx + dx - w * 0.3, y + dy + 0.14, w * 0.35, 0.1, 0, 0, TAU); ctx.fill(); }
    flagPole(ctx, cx + 0.05, y + 3.4, 2.2, '#ffd23f', lw, t, 2.2, passed >= hill.flags);
    if (tags && tags[hill.flags + 1]) cashTag(ctx, cx + 2.4, y - 0.05, tags[hill.flags + 1], lw);
  }
}
export function drawHillWind(ctx, hill, vis, t) {
  const yLo = hill.flagY[Math.min(hill.flags, 3)];
  if (vis.y1 < yLo) return;
  const span = vis.x1 - vis.x0 + 30;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const r = rhash(i * 3.1 + 7);
    const y = yLo + r * (hill.summitY + 22 - yLo);
    if (y < vis.y0 - 1 || y > vis.y1 + 1) continue;
    const sp = 9 + 7 * rhash(i + 0.3);
    const x = vis.x1 + 15 - ((rhash(i + 0.7) * span + t * sp) % span);
    const len = 1.6 + 2.2 * rhash(i + 0.9);
    const a = 0.12 + 0.3 * clamp((y - yLo) / 50, 0, 1) * (0.6 + 0.4 * Math.sin(t * 2 + i));
    ctx.globalAlpha = a;
    ctx.lineWidth = 0.08 + 0.05 * r;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y + 0.08 * Math.sin(t * 3 + i)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}
