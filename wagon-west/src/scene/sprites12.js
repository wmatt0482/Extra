// Wagon West v1.2 sprites: the river (rocks in two sizes, an eddy's swirl, splashes, the raft with the wagon on it) and
// the galloping buffalo (a two-frame gallop, and the big lead bull). Same house style as sprites.js: flat warm fills,
// one chunky dark outline, every sprite drawn in its own units around a ground point and scaled by `s`.
// Kid rules: nothing here shows an injury; a "bump" is a splash and a rocking raft.

import { TAU, OUT, shade, rrect, mkCanvas } from './util.js';
import { drawWagon } from './sprites.js';

function outlineFill(c, fill, lw = 2.4) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }

// ---------------------------------------------------------------- the river
// A rock in the water, seen from a little above: (x, y) is the middle of its waterline. Two sizes (big: unit radius 30,
// small: 18); `s` css px per unit. A foam ring, a wake trailing downstream (down the screen), a lit top face.
export const ROCK_R = [18, 30];
export function drawRock(c, x, y, s, big, ph = 0) {
  const r = ROCK_R[big ? 1 : 0];
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-r * 0.95, r * 0.35); c.quadraticCurveTo(-r * 1.1, r * 0.9, -r * 0.8, r * 1.35 + Math.sin(ph) * 1.5);
  c.moveTo(r * 0.95, r * 0.35); c.quadraticCurveTo(r * 1.1, r * 0.9, r * 0.8, r * 1.35 + Math.sin(ph + 1) * 1.5);
  c.lineWidth = 2.6; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.stroke();
  c.lineCap = 'butt';
  c.beginPath(); c.ellipse(0, r * 0.18, r * (1.32 + Math.sin(ph) * 0.04), r * 0.66, 0, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.34)'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();
  c.beginPath();
  c.moveTo(-r, 0); c.bezierCurveTo(-r * 1.05, -r * 0.78, -r * 0.45, -r * 1.08, r * 0.05, -r * 1.04);
  c.bezierCurveTo(r * 0.7, -r * 1.02, r * 1.08, -r * 0.55, r, 0); c.quadraticCurveTo(0, r * 0.4, -r, 0); c.closePath();
  outlineFill(c, '#8f9096', 2.8);
  c.beginPath(); c.moveTo(-r * 0.2, 0.2 * r); c.quadraticCurveTo(r * 0.6, r * 0.3, r, 0); c.quadraticCurveTo(r * 0.7, -r * 0.5, r * 0.45, -r * 0.8); c.quadraticCurveTo(r * 0.95, -r * 0.5, r, 0);
  c.fillStyle = 'rgba(40,40,60,0.22)'; c.fill();
  c.beginPath(); c.ellipse(-r * 0.25, -r * 0.62, r * 0.42, r * 0.2, -0.3, 0, TAU); c.fillStyle = '#b8b9bf'; c.fill();
  c.beginPath(); c.moveTo(-r * 0.1, -r * 0.2); c.lineTo(r * 0.12, -r * 0.5); c.lineTo(r * 0.02, -r * 0.7); c.lineWidth = 1.8; c.strokeStyle = 'rgba(43,29,20,0.5)'; c.stroke();
  if (big) { c.beginPath(); c.ellipse(r * 0.45, -r * 0.2, r * 0.22, r * 0.12, 0.3, 0, TAU); c.fillStyle = '#6f9a58'; c.fill(); }
  c.restore();
}

// an eddy: spiral arcs squashed for the viewpoint; r = radius in css px, ph = the turning angle, dir = +1 / -1
export function drawEddy(c, x, y, r, ph, dir = 1) {
  c.save(); c.translate(x, y); c.scale(1, 0.66);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = 'rgba(20,50,90,0.16)'; c.fill();
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const rr = r * (0.3 + i * 0.28), a0 = ph * dir + i * 2.1;
    c.beginPath(); c.arc(0, 0, rr, a0, a0 + 3.5);
    c.lineWidth = Math.max(2, r * 0.07); c.strokeStyle = i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'; c.stroke();
  }
  c.beginPath(); c.arc(0, 0, r * 0.12, 0, TAU); c.fillStyle = 'rgba(20,40,70,0.35)'; c.fill();
  c.lineCap = 'butt';
  c.restore();
}

// a splash: k = 0..1 over its life (alpha is the caller's); drops arc up and fall, a ring spreads; r = size in css px
export function drawSplash(c, x, y, r, k) {
  c.beginPath(); c.ellipse(x, y, r * (0.4 + k * 1.1), r * (0.16 + k * 0.4), 0, 0, TAU);
  c.lineWidth = Math.max(1.5, r * 0.09); c.strokeStyle = '#ffffff'; c.stroke();
  c.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.12 + 0.76 * (i / 6)), v = r * (1.1 + 0.25 * ((i * 7) % 3));
    const px = x + Math.cos(a) * v * k * 0.9, py = y + Math.sin(a) * v * k * 1.3 + k * k * r * 1.1;
    const dr = Math.max(1.2, r * 0.13 * (1 - k * 0.5));
    c.moveTo(px + dr, py); c.arc(px, py, dr, 0, TAU);
  }
  c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = 'rgba(40,90,140,0.7)'; c.stroke();
}

// the raft: six logs lashed with rope, the covered wagon standing on it. (x, y) = the raft's middle on the water.
// s: css px per unit (the raft is 132 units wide, 96 long); ang: the platform's turn in the water plane (an eddy
// spins it); tilt: rocking (radians, side to side); bob: lift in units; w: the wagon's look (as drawWagon)
export function drawRaft(c, x, y, s, w, ang, tilt, bob, t, spin = 0) {
  const SQ = 0.62; // the viewpoint's squash
  c.save(); c.translate(x, y); if (tilt) c.rotate(tilt);
  for (let pass = 0; pass < 2; pass++) { // the dark underside (the logs' thickness), then the top
    c.save();
    c.translate(0, pass === 0 ? 8 * s : -bob * s * 0.25);
    c.scale(s, s * SQ); c.rotate(ang);
    for (let i = 0; i < 6; i++) {
      const lx = -66 + i * 22, base = i % 2 ? '#a8703e' : '#b9814a';
      c.beginPath(); rrect(c, lx + 1, -48, 20, 96, 9);
      c.fillStyle = pass === 0 ? shade(base, -0.4) : base; c.fill();
      if (pass) {
        c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
        c.beginPath(); c.moveTo(lx + 8, -34); c.lineTo(lx + 9, -8); c.moveTo(lx + 13, 8); c.lineTo(lx + 12, 34);
        c.lineWidth = 1.6; c.strokeStyle = shade(base, -0.28); c.stroke();
      }
    }
    if (pass) {
      for (const ly of [-30, 30]) { // the lashings
        c.beginPath(); c.rect(-68, ly - 4, 136, 8); c.fillStyle = '#e0cf9a'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
        c.beginPath(); for (let i = 0; i < 7; i++) { c.moveTo(-60 + i * 20, ly - 4); c.lineTo(-56 + i * 20, ly + 4); }
        c.lineWidth = 1.4; c.strokeStyle = '#a68c52'; c.stroke();
      }
    }
    c.restore();
  }
  // the wagon: upright, it turns to face the way the raft turns (a billboard on a spinning platform)
  const face = Math.cos(ang), sx = (face < 0 ? -1 : 1) * (0.4 + 0.6 * Math.abs(face));
  c.save(); c.translate(0, -2 * s - bob * s);
  c.scale(sx, 1);
  drawWagon(c, 0, 12 * s, s * 0.9, w, spin, 0, t);
  c.restore();
  c.restore();
}

// ---------------------------------------------------------------- the buffalo (a galloping two-frame)
// drawBison(c, x, y, s, dir, ph, lead): a herd bison, (x, y) at its hooves; dir +1 faces right; ph runs the gallop
// (one stride per 2*PI: two frames, gathered and stretched); lead = the big dark bull. Cached sprites, blitted.
const BISON_R = 4; // raster px per unit
const bisonCache = {};
function bisonBody(c, frame, lead) {
  const b = lead ? '#4a2f1b' : '#5a3a22', d = lead ? '#2f1c10' : '#3e2716';
  const lift = frame ? 3 : 8; // the body rises when the legs are gathered
  const leg = (hx, p, col) => { // hip, then the knee and the hoof as offsets
    c.beginPath(); c.moveTo(hx, -16 - lift);
    c.lineTo(hx + p[0], -16 - lift + p[1]); c.lineTo(hx + p[2], p[3]);
    c.lineWidth = 8; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = col; c.stroke();
  };
  c.lineCap = 'round';
  if (frame) { // stretched: the front legs reach forward, the back legs kick behind
    leg(-16, [-5, 7, -18, -1], d); leg(-9, [-3, 8, -12, -2], d); leg(14, [5, 7, 19, -1], d); leg(20, [6, 6, 24, -6], d);
  } else { // gathered: the feet tucked under the belly
    leg(-16, [2, 8, -2, -2], d); leg(-9, [4, 8, 5, -1], d); leg(12, [-2, 8, 4, -2], d); leg(18, [-1, 7, 10, -1], d);
  }
  c.lineCap = 'butt';
  c.save(); c.translate(0, -lift * 0.9);
  c.beginPath(); c.moveTo(-24, -26); c.quadraticCurveTo(-34, frame ? -40 : -34, -30, frame ? -44 : -38); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.arc(-30, frame ? -45 : -39, 3.2, 0, TAU); c.fillStyle = d; c.fill(); // the tail's tuft, up
  c.beginPath(); rrect(c, -26, -34, 40, 22, 10); outlineFill(c, b);
  c.beginPath(); c.ellipse(12, -34, lead ? 18 : 16, lead ? 18 : 16, 0, 0, TAU); outlineFill(c, d); // hump and shaggy shoulders
  c.beginPath(); rrect(c, 20, -30, 15, 19, 6); outlineFill(c, d); // the head, held low
  if (lead) { c.beginPath(); c.moveTo(21, -17); c.quadraticCurveTo(26, -8, 32, -11); c.lineWidth = 3; c.strokeStyle = shade(d, 0.1); c.stroke(); } // a beard
  c.beginPath(); c.moveTo(25, -30); c.quadraticCurveTo(23, lead ? -44 : -40, 29, lead ? -43 : -39); c.lineWidth = lead ? 3.4 : 2.8; c.strokeStyle = '#efe4c8'; c.stroke();
  c.beginPath(); c.arc(30, -24, 1.6, 0, TAU); c.fillStyle = '#f4e9d0'; c.fill();
  c.restore();
}
function bisonSprite(frame, lead) {
  const key = frame + (lead ? 'L' : 'N');
  let sp = bisonCache[key];
  if (sp) return sp;
  const ox = 46, oy = 62, w = 112, h = 70;
  const cv = mkCanvas(w * BISON_R, h * BISON_R), c = cv.getContext('2d');
  c.setTransform(BISON_R, 0, 0, BISON_R, ox * BISON_R, oy * BISON_R);
  bisonBody(c, frame, lead);
  sp = bisonCache[key] = { cv, ox, oy, w, h };
  return sp;
}
// paint the four cached sprites ahead of the first frame that needs them
export function warmBison() { for (const lead of [false, true]) for (const f of [0, 1]) bisonSprite(f, lead); }
export function drawBison(c, x, y, s, dir, ph, lead = false) {
  const f = Math.sin(ph) > 0 ? 1 : 0, sp = bisonSprite(f, lead);
  const bob = (f ? 1.5 : -1.5) * s * 0.5;
  c.save(); c.translate(x, y + bob); c.scale(s * dir, s);
  c.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h);
  c.restore();
}
