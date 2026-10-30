// Wagon West stop scenes (SPEC §11 setBackdrop): the fort (a palisade and the General Store), the river (the water
// and the ferry's rope), the landmark paintings (the leg's id picks Chimney Rock, Independence Rock, South Pass, Soda
// Springs, the Blue Mountains, the Columbia gorge, a fort, a river, the homestead; anything else gets a generic butte),
// the camp (a tent; the fire itself is animated by render.js), the post office (an interior) and the valley homestead.
// Like the biome layers, each set piece is painted ONCE per (backdrop, leg, size) into an off-screen canvas sized to
// its bounding box; a frame only blits it. `z` says where render.js slots it: 'mid' (behind the near bushes), 'ground'
// (on the ground, before the wagon) or 'cover' (the whole screen: the post office interior). `anchors` are the spots
// the animated parts use (the fire, the chimney's smoke, the raft, the water band).

import { TAU, OUT, mulberry32, hashStr, shade, mix, mkCanvas, rrect, drawText } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawPerson, personLook } from './sprites.js';

export const BACKDROPS = ['trail', 'fort', 'river', 'landmark', 'camp', 'post', 'valley'];

// which painting a leg id gets (matched loosely so the Content stream's exact ids do not have to be known here)
export function paintingFor(legId) {
  const id = String(legId || '').toLowerCase();
  if (id.includes('chimney')) return 'chimney';
  if (id.includes('independence') && id.includes('rock')) return 'independence';
  if (id.includes('south-pass') || id.includes('southpass') || /(^|-)pass($|-)/.test(id)) return 'southpass';
  if (id.includes('soda')) return 'soda';
  if (id.includes('blue')) return 'bluemtns';
  if (id.includes('dalles') || id.includes('gorge') || id.includes('columbia') || id.includes('hood')) return 'gorge';
  if (id.includes('willamette') || id.includes('valley') || id.includes('oregon-city') || id.includes('home')) return 'homestead';
  if (id.includes('fort')) return 'fort';
  if (id.includes('river') || id.includes('kansas') || id.includes('snake') || id.includes('platte') || id.includes('crossing')) return 'river';
  return 'generic';
}

const fillOut = (c, fill, lw) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); };

// ---------------------------------------------------------------- pieces shared by several scenes
function palisade(c, x0, x1, base, h, k, withTower, flagCol) {
  const lw = 2 * k, logW = 13 * k;
  c.beginPath();
  for (let x = x0; x < x1; x += logW) {
    const hh = h * (0.94 + ((x * 7.3) % 10) / 160);
    c.moveTo(x, base); c.lineTo(x, base - hh); c.lineTo(x + logW / 2, base - hh - 9 * k); c.lineTo(x + logW, base - hh); c.lineTo(x + logW, base);
  }
  fillOut(c, '#b07a48', lw);
  c.beginPath(); c.moveTo(x0, base - h * 0.3); c.lineTo(x1, base - h * 0.3); c.moveTo(x0, base - h * 0.75); c.lineTo(x1, base - h * 0.75);
  c.lineWidth = 3 * k; c.strokeStyle = '#7a4f2a'; c.stroke();
  if (withTower) {
    const tx = x0 + 10 * k, tw = 56 * k, th = h * 1.55;
    c.beginPath(); c.rect(tx, base - th, tw, th); fillOut(c, '#9a6a3c', lw);
    c.beginPath(); c.moveTo(tx - 8 * k, base - th); c.lineTo(tx + tw / 2, base - th - 26 * k); c.lineTo(tx + tw + 8 * k, base - th); c.closePath(); fillOut(c, '#7a3f2a', lw);
    c.beginPath(); c.rect(tx + tw * 0.3, base - th * 0.72, tw * 0.4, 9 * k); fillOut(c, '#2b1d14', 1);
    c.beginPath(); for (let y = base - th + 10 * k; y < base; y += 11 * k) { c.moveTo(tx + 2, y); c.lineTo(tx + tw - 2, y); }
    c.lineWidth = 1.2 * k; c.strokeStyle = '#7a4f2a'; c.stroke();
    // flag on the tower
    const fx = tx + tw / 2, fy = base - th - 26 * k;
    c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 40 * k); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(fx, fy - 40 * k); c.quadraticCurveTo(fx + 14 * k, fy - 44 * k, fx + 30 * k, fy - 38 * k); c.lineTo(fx + 30 * k, fy - 24 * k); c.quadraticCurveTo(fx + 14 * k, fy - 30 * k, fx, fy - 26 * k); c.closePath();
    fillOut(c, flagCol || '#d9534f', 1.6 * k);
    c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(fx, fy - 40 * k + i * 3.5 * k); c.quadraticCurveTo(fx + 14 * k, fy - 44 * k + i * 3.5 * k, fx + 30 * k, fy - 38 * k + i * 3.5 * k); }
    c.lineWidth = 1.4 * k; c.strokeStyle = '#ffffff'; c.stroke();
  }
}
function gate(c, x, base, w, h, k) {
  c.beginPath(); c.rect(x, base - h, w, h); fillOut(c, '#3a2618', 2 * k);
  c.beginPath(); c.moveTo(x, base); c.lineTo(x - w * 0.35, base + 4 * k); c.lineTo(x - w * 0.35, base - h + 6 * k); c.lineTo(x, base - h); c.closePath(); fillOut(c, '#a0703e', 2 * k);
  c.beginPath(); c.moveTo(x + w, base); c.lineTo(x + w * 1.35, base + 4 * k); c.lineTo(x + w * 1.35, base - h + 6 * k); c.lineTo(x + w, base - h); c.closePath(); fillOut(c, '#a0703e', 2 * k);
}
function storeFront(c, x, base, k, title, signCol) {
  const w = 150 * k, h = 66 * k, fh = 96 * k, lw = 2.2 * k;
  // false front
  c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - fh); c.lineTo(x + w * 0.2, base - fh); c.lineTo(x + w * 0.2, base - fh - 8 * k); c.lineTo(x + w * 0.8, base - fh - 8 * k); c.lineTo(x + w * 0.8, base - fh); c.lineTo(x + w, base - fh); c.lineTo(x + w, base); c.closePath();
  fillOut(c, '#c8955a', lw);
  c.beginPath(); for (let y = base - fh + 9 * k; y < base; y += 9 * k) { c.moveTo(x + 2, y); c.lineTo(x + w - 2, y); }
  c.lineWidth = 1.2 * k; c.strokeStyle = '#9a6a3c'; c.stroke();
  // sign
  c.beginPath(); rrect(c, x + w * 0.08, base - fh - 2 * k, w * 0.84, 24 * k, 4 * k); fillOut(c, signCol || '#f4ead0', lw);
  drawText(c, title, 12 * k, x + w / 2, base - fh + 10 * k, '#8a2b1b', null, w * 0.78);
  // porch roof
  c.beginPath(); c.moveTo(x - 8 * k, base - h + 6 * k); c.lineTo(x + w + 8 * k, base - h + 6 * k); c.lineTo(x + w + 2 * k, base - h + 16 * k); c.lineTo(x - 2 * k, base - h + 16 * k); c.closePath(); fillOut(c, '#7a3f2a', lw);
  c.beginPath(); c.moveTo(x + 2 * k, base - h + 16 * k); c.lineTo(x + 2 * k, base); c.moveTo(x + w - 2 * k, base - h + 16 * k); c.lineTo(x + w - 2 * k, base);
  c.lineWidth = 4 * k; c.strokeStyle = '#6a3f22'; c.stroke();
  // door and windows with goods
  c.beginPath(); c.rect(x + w * 0.42, base - 40 * k, w * 0.16, 40 * k); fillOut(c, '#5a3a22', lw);
  for (const wx of [x + w * 0.12, x + w * 0.66]) {
    c.beginPath(); c.rect(wx, base - 36 * k, w * 0.22, 22 * k); fillOut(c, '#fff1c2', lw);
    c.beginPath(); c.rect(wx + 4 * k, base - 22 * k, 7 * k, 8 * k); c.rect(wx + 13 * k, base - 25 * k, 6 * k, 11 * k); c.rect(wx + 21 * k, base - 21 * k, 8 * k, 7 * k);
    c.fillStyle = '#c94a3a'; c.fill();
  }
  // barrels and crates
  for (const [bx, col] of [[x - 18 * k, '#9a6a3c'], [x + w + 6 * k, '#8a5a2e']]) {
    c.beginPath(); rrect(c, bx, base - 24 * k, 16 * k, 24 * k, 5 * k); fillOut(c, col, lw);
    c.beginPath(); c.moveTo(bx, base - 17 * k); c.lineTo(bx + 16 * k, base - 17 * k); c.moveTo(bx, base - 7 * k); c.lineTo(bx + 16 * k, base - 7 * k); c.lineWidth = 2 * k; c.strokeStyle = '#4a4a52'; c.stroke();
  }
  c.beginPath(); c.rect(x + w + 24 * k, base - 18 * k, 20 * k, 18 * k); fillOut(c, '#c8a060', lw);
  c.beginPath(); c.moveTo(x + w + 24 * k, base - 18 * k); c.lineTo(x + w + 44 * k, base); c.moveTo(x + w + 44 * k, base - 18 * k); c.lineTo(x + w + 24 * k, base); c.lineWidth = 1.4 * k; c.strokeStyle = '#8a6030'; c.stroke();
}
function cabin(c, x, base, k) {
  const w = 130 * k, h = 62 * k, lw = 2.2 * k;
  // chimney (stone) behind the roof edge
  c.beginPath(); c.rect(x + w * 0.72, base - h - 46 * k, 18 * k, 50 * k); fillOut(c, '#9a948a', lw);
  // logs
  c.beginPath(); c.rect(x, base - h, w, h); fillOut(c, '#a8703e', lw);
  c.beginPath(); for (let y = base - h + 8 * k; y < base; y += 8 * k) { c.moveTo(x, y); c.lineTo(x + w, y); }
  c.lineWidth = 1.6 * k; c.strokeStyle = '#7a4a26'; c.stroke();
  c.beginPath(); for (let y = base - h + 4 * k; y < base; y += 8 * k) { c.moveTo(x - 4 * k + 4 * k, y); c.arc(x - 1 * k, y, 3 * k, 0, TAU); c.moveTo(x + w + 4 * k, y); c.arc(x + w + 1 * k, y, 3 * k, 0, TAU); }
  c.fillStyle = '#c8955a'; c.fill();
  // roof
  c.beginPath(); c.moveTo(x - 12 * k, base - h + 2 * k); c.lineTo(x + w / 2, base - h - 40 * k); c.lineTo(x + w + 12 * k, base - h + 2 * k); c.closePath(); fillOut(c, '#6a4a3a', lw);
  c.beginPath(); for (let i = 1; i < 4; i++) { const t = i / 4; c.moveTo(x - 12 * k + (w / 2 + 12 * k) * t, base - h + 2 * k - 42 * k * t); c.lineTo(x + w + 12 * k - (w / 2 + 12 * k) * t, base - h + 2 * k - 42 * k * t); }
  c.lineWidth = 1.4 * k; c.strokeStyle = '#4a3226'; c.stroke();
  // door, window with flower box
  c.beginPath(); c.rect(x + w * 0.18, base - 40 * k, 24 * k, 40 * k); fillOut(c, '#5a3a22', lw);
  c.beginPath(); c.arc(x + w * 0.18 + 19 * k, base - 20 * k, 2 * k, 0, TAU); c.fillStyle = '#f0c040'; c.fill();
  c.beginPath(); c.rect(x + w * 0.56, base - 44 * k, 30 * k, 22 * k); fillOut(c, '#fff1c2', lw);
  c.beginPath(); c.moveTo(x + w * 0.56 + 15 * k, base - 44 * k); c.lineTo(x + w * 0.56 + 15 * k, base - 22 * k); c.moveTo(x + w * 0.56, base - 33 * k); c.lineTo(x + w * 0.56 + 30 * k, base - 33 * k);
  c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.rect(x + w * 0.55, base - 22 * k, 33 * k, 6 * k); fillOut(c, '#7a4a26', 1.4 * k);
  c.beginPath(); for (let i = 0; i < 5; i++) { const fx = x + w * 0.56 + 3 * k + i * 6.5 * k; c.moveTo(fx + 2.5 * k, base - 24 * k); c.arc(fx, base - 24 * k, 2.5 * k, 0, TAU); }
  c.fillStyle = '#ff7aa8'; c.fill();
  return { smokeX: x + w * 0.72 + 9 * k, smokeY: base - h - 46 * k };
}
function picketFence(c, x0, x1, base, h, k) {
  c.beginPath();
  for (let x = x0; x < x1; x += 12 * k) { c.moveTo(x, base); c.lineTo(x, base - h); c.lineTo(x + 3 * k, base - h - 5 * k); c.lineTo(x + 6 * k, base - h); c.lineTo(x + 6 * k, base); c.closePath(); }
  c.rect(x0, base - h * 0.75, x1 - x0, 3.5 * k); c.rect(x0, base - h * 0.3, x1 - x0, 3.5 * k);
  fillOut(c, '#f4ecd8', 1.4 * k);
}
function garden(c, x, base, w, k) {
  c.beginPath(); c.rect(x, base - 14 * k, w, 16 * k); c.fillStyle = '#7a5232'; c.fill();
  c.beginPath(); for (let i = 0; i < 3; i++) { const y = base - 11 * k + i * 5 * k; for (let gx = x + 6 * k; gx < x + w - 4 * k; gx += 11 * k) { c.moveTo(gx + 3.2 * k, y); c.arc(gx, y, 3.2 * k, 0, TAU); } }
  c.fillStyle = '#5fae3e'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#2f5a1e'; c.stroke();
}
function barn(c, x, base, k) {
  const w = 96 * k, h = 58 * k, lw = 2.2 * k;
  c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - h); c.lineTo(x + w * 0.2, base - h - 26 * k); c.lineTo(x + w * 0.8, base - h - 26 * k); c.lineTo(x + w, base - h); c.lineTo(x + w, base); c.closePath(); fillOut(c, '#c0473a', lw);
  c.beginPath(); c.rect(x + w * 0.3, base - 40 * k, w * 0.4, 40 * k); fillOut(c, '#8a2b22', lw);
  c.beginPath(); c.moveTo(x + w * 0.3, base - 40 * k); c.lineTo(x + w * 0.7, base); c.moveTo(x + w * 0.7, base - 40 * k); c.lineTo(x + w * 0.3, base);
  c.lineWidth = 2.4 * k; c.strokeStyle = '#f4ecd8'; c.stroke();
  c.beginPath(); c.rect(x + w * 0.4, base - h - 12 * k, w * 0.2, 14 * k); fillOut(c, '#fff1c2', lw);
}

// ---------------------------------------------------------------- landmark paintings (cx = centre, b = base line)
const PAINTINGS = {
  chimney(c, cx, b, s) {
    const lw = 2.4 * s;
    c.beginPath(); c.moveTo(cx - 14 * s, b - 90 * s); c.lineTo(cx - 10 * s, b - 170 * s); c.lineTo(cx - 6 * s, b - 196 * s); c.lineTo(cx + 5 * s, b - 200 * s); c.lineTo(cx + 9 * s, b - 172 * s); c.lineTo(cx + 15 * s, b - 90 * s); c.closePath();
    fillOut(c, '#e2b47a', lw);
    c.beginPath(); c.moveTo(cx - 6 * s, b - 196 * s); c.lineTo(cx + 5 * s, b - 200 * s); c.lineTo(cx + 7 * s, b - 186 * s); c.lineTo(cx - 8 * s, b - 182 * s); c.closePath(); c.fillStyle = '#f2e6cc'; c.fill();
    c.beginPath(); c.moveTo(cx - 130 * s, b); c.quadraticCurveTo(cx - 70 * s, b - 30 * s, cx - 34 * s, b - 88 * s); c.quadraticCurveTo(cx, b - 98 * s, cx + 30 * s, b - 88 * s); c.quadraticCurveTo(cx + 70 * s, b - 30 * s, cx + 130 * s, b); c.closePath();
    fillOut(c, '#d9a46c', lw);
    c.beginPath(); // strata
    for (let i = 1; i < 5; i++) { const y = b - i * 18 * s, half = 130 * s - i * 24 * s; c.moveTo(cx - half + 10 * s, y); c.lineTo(cx + half - 10 * s, y); }
    for (let i = 1; i < 6; i++) { const y = b - 92 * s - i * 16 * s; c.moveTo(cx - 12 * s, y); c.lineTo(cx + 12 * s, y); }
    c.lineWidth = 1.6 * s; c.strokeStyle = '#b07c48'; c.stroke();
    c.beginPath(); c.moveTo(cx + 2 * s, b - 92 * s); c.lineTo(cx + 15 * s, b - 92 * s); c.lineTo(cx + 9 * s, b - 172 * s); c.closePath(); c.fillStyle = 'rgba(120,70,30,0.18)'; c.fill();
  },
  independence(c, cx, b, s) {
    const lw = 2.4 * s;
    c.beginPath(); c.moveTo(cx - 170 * s, b); c.bezierCurveTo(cx - 160 * s, b - 70 * s, cx - 90 * s, b - 96 * s, cx - 10 * s, b - 96 * s); c.bezierCurveTo(cx + 80 * s, b - 96 * s, cx + 150 * s, b - 70 * s, cx + 170 * s, b); c.closePath();
    fillOut(c, '#a8a098', lw);
    c.beginPath(); c.moveTo(cx - 120 * s, b - 50 * s); c.bezierCurveTo(cx - 80 * s, b - 82 * s, cx - 20 * s, b - 88 * s, cx + 40 * s, b - 84 * s); c.lineWidth = 6 * s; c.strokeStyle = '#c4beb6'; c.stroke();
    c.beginPath(); c.moveTo(cx - 60 * s, b); c.quadraticCurveTo(cx - 50 * s, b - 40 * s, cx - 30 * s, b - 60 * s); c.moveTo(cx + 50 * s, b); c.quadraticCurveTo(cx + 60 * s, b - 30 * s, cx + 90 * s, b - 50 * s);
    c.lineWidth = 1.8 * s; c.strokeStyle = '#7a746c'; c.stroke();
    // the names travellers carved (little scratches)
    c.beginPath(); for (let i = 0; i < 9; i++) { const x = cx - 70 * s + i * 16 * s, y = b - 30 * s - (i % 3) * 8 * s; c.moveTo(x, y); c.lineTo(x + 9 * s, y); c.moveTo(x + 2 * s, y - 4 * s); c.lineTo(x + 2 * s, y + 2 * s); }
    c.lineWidth = 1.4 * s; c.strokeStyle = '#5a544c'; c.stroke();
    // the Sweetwater at its foot
    c.beginPath(); c.moveTo(cx - 200 * s, b + 2 * s); c.quadraticCurveTo(cx, b - 6 * s, cx + 200 * s, b + 2 * s); c.lineWidth = 6 * s; c.strokeStyle = '#5aa6d8'; c.stroke();
  },
  southpass(c, cx, b, s) {
    const lw = 2.2 * s;
    paint.peak(c, cx - 120 * s, b, 200 * s, 120 * s, '#7f90b4', '#ffffff', OUT, lw);
    paint.peak(c, cx - 190 * s, b, 140 * s, 80 * s, '#6f80a6', '#ffffff', OUT, lw);
    paint.peak(c, cx + 140 * s, b, 220 * s, 130 * s, '#7f90b4', '#ffffff', OUT, lw);
    // the wide, gentle saddle
    c.beginPath(); c.moveTo(cx - 200 * s, b); c.quadraticCurveTo(cx - 100 * s, b - 46 * s, cx, b - 40 * s); c.quadraticCurveTo(cx + 100 * s, b - 46 * s, cx + 220 * s, b); c.closePath(); fillOut(c, '#b8a46a', lw);
    // the marker
    c.beginPath(); c.rect(cx - 2.5 * s, b - 72 * s, 5 * s, 34 * s); fillOut(c, '#8a5a2e', 1.6 * s);
    c.beginPath(); rrect(c, cx - 34 * s, b - 82 * s, 68 * s, 18 * s, 3 * s); fillOut(c, '#f4ead0', 1.6 * s);
    drawText(c, 'SOUTH PASS', 9 * s, cx, b - 73 * s, '#6a3a1a', null, 60 * s);
  },
  soda(c, cx, b, s) {
    const lw = 2.2 * s;
    c.beginPath(); c.ellipse(cx, b - 6 * s, 150 * s, 18 * s, 0, 0, TAU); fillOut(c, '#7cc4d8', lw);
    for (const [mx, mw, mh] of [[-70, 60, 50], [10, 80, 70], [90, 50, 40]]) {
      c.beginPath(); c.moveTo(cx + (mx - mw / 2) * s, b - 6 * s); c.quadraticCurveTo(cx + (mx - mw * 0.2) * s, b - mh * s, cx + mx * s, b - mh * s); c.quadraticCurveTo(cx + (mx + mw * 0.2) * s, b - mh * s, cx + (mx + mw / 2) * s, b - 6 * s); c.closePath();
      fillOut(c, '#f0e2c4', lw);
      c.beginPath(); c.moveTo(cx + (mx - mw * 0.3) * s, b - mh * 0.5 * s); c.lineTo(cx + (mx + mw * 0.3) * s, b - mh * 0.5 * s); c.moveTo(cx + (mx - mw * 0.4) * s, b - mh * 0.25 * s); c.lineTo(cx + (mx + mw * 0.4) * s, b - mh * 0.25 * s);
      c.lineWidth = 3 * s; c.strokeStyle = '#e0a04a'; c.stroke();
      c.beginPath(); c.ellipse(cx + mx * s, b - mh * s, 8 * s, 3 * s, 0, 0, TAU); c.fillStyle = '#7cc4d8'; c.fill();
    }
    // steam and bubbles
    c.beginPath();
    for (const [px, py, r] of [[10, 86, 12], [18, 104, 15], [6, 124, 18], [-70, 62, 9], [-64, 76, 11]]) { c.moveTo(cx + (px + r) * s, b - py * s); c.arc(cx + px * s, b - py * s, r * s, 0, TAU); }
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
    c.beginPath(); for (let i = 0; i < 9; i++) { const x = cx + (-110 + i * 26) * s, y = b - (4 + (i % 3) * 3) * s; c.moveTo(x + 3 * s, y); c.arc(x, y, 3 * s, 0, TAU); }
    c.lineWidth = 1.4 * s; c.strokeStyle = '#ffffff'; c.stroke();
  },
  bluemtns(c, cx, b, s) {
    const lw = 2 * s;
    const ridges = [['#9fb4d8', 150, 2], ['#7b98c8', 115, 3], ['#5a7aac', 80, 4], ['#3f6a5a', 46, 5]];
    for (const [col, h, n] of ridges) {
      c.beginPath(); c.moveTo(cx - 220 * s, b);
      for (let x = -220; x <= 220; x += 8) {
        const env = Math.min(1, (220 - Math.abs(x)) / 70); // taper to the base at both ends
        c.lineTo(cx + x * s, b - h * s * env * (0.75 + 0.2 * Math.sin((x / 440) * TAU * (n * 0.5) + n) + 0.05 * Math.sin(x * 0.11)));
      }
      c.lineTo(cx + 220 * s, b); c.closePath(); fillOut(c, col, lw);
    }
    for (let i = 0; i < 16; i++) { const x = cx + (-200 + i * 26) * s, h = (26 + (i % 4) * 7) * s; paint.pine(c, x, b + 2 * s, h * 0.5, h, '#2f5a46', OUT, 1.2 * s); }
  },
  gorge(c, cx, b, s) {
    const lw = 2.2 * s;
    paint.peak(c, cx + 30 * s, b - 60 * s, 200 * s, 140 * s, '#9aa8c4', '#ffffff', OUT, lw);
    // the cliffs on both sides
    c.beginPath(); c.moveTo(cx - 248 * s, b); c.lineTo(cx - 222 * s, b - 150 * s); c.lineTo(cx - 150 * s, b - 140 * s); c.lineTo(cx - 110 * s, b - 120 * s); c.lineTo(cx - 70 * s, b - 20 * s); c.lineTo(cx - 60 * s, b); c.closePath(); fillOut(c, '#5c5a66', lw);
    c.beginPath(); c.moveTo(cx + 248 * s, b); c.lineTo(cx + 226 * s, b - 130 * s); c.lineTo(cx + 160 * s, b - 120 * s); c.lineTo(cx + 120 * s, b - 90 * s); c.lineTo(cx + 80 * s, b - 14 * s); c.lineTo(cx + 70 * s, b); c.closePath(); fillOut(c, '#66646e', lw);
    c.beginPath(); for (let x = -224; x < -80; x += 10) { c.moveTo(cx + x * s, b - 10 * s); c.lineTo(cx + x * s, b - (x < -110 ? 130 : 60) * s); } for (let x = 100; x < 226; x += 10) { c.moveTo(cx + x * s, b - 10 * s); c.lineTo(cx + x * s, b - (x > 130 ? 110 : 50) * s); }
    c.lineWidth = 1.4 * s; c.strokeStyle = '#4a4852'; c.stroke();
    // a tall waterfall on the left cliff
    c.beginPath(); c.rect(cx - 176 * s, b - 140 * s, 10 * s, 136 * s); fillOut(c, '#e8f6ff', 1.4 * s);
    c.beginPath(); c.ellipse(cx - 171 * s, b - 4 * s, 18 * s, 6 * s, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
    // fir tops along the rims
    for (let i = 0; i < 6; i++) paint.pine(c, cx + (-220 + i * 14) * s, b - (144 - i * 2) * s, 9 * s, 18 * s, '#2f5a46', null, 0);
    for (let i = 0; i < 5; i++) paint.pine(c, cx + (170 + i * 13) * s, b - (122 + i) * s, 9 * s, 18 * s, '#2f5a46', null, 0);
    // the Columbia
    c.beginPath(); c.moveTo(cx - 240 * s, b + 2 * s); c.lineTo(cx - 60 * s, b - 8 * s); c.lineTo(cx + 70 * s, b - 8 * s); c.lineTo(cx + 240 * s, b + 2 * s); c.closePath(); c.fillStyle = '#3f86b8'; c.fill();
  },
  fort(c, cx, b, s) {
    palisade(c, cx - 150 * s, cx + 150 * s, b, 70 * s, s, true, '#d9534f');
    gate(c, cx + 40 * s, b, 36 * s, 54 * s, s);
  },
  river(c, cx, b, s) {
    const lw = 2.2 * s;
    paint.mesa(c, cx - 110 * s, b - 20 * s, 160 * s, 80 * s, '#cfa47a', OUT, lw);
    paint.mesa(c, cx + 120 * s, b - 20 * s, 120 * s, 60 * s, '#c49a70', OUT, lw);
    c.beginPath(); c.moveTo(cx - 240 * s, b); c.quadraticCurveTo(cx, b - 34 * s, cx + 240 * s, b); c.closePath(); fillOut(c, '#4f9fd0', lw);
    c.beginPath(); for (let i = 0; i < 8; i++) { const x = cx + (-150 + i * 40) * s, y = b - (8 + (i % 3) * 6) * s; c.moveTo(x, y); c.lineTo(x + 20 * s, y); }
    c.lineWidth = 2 * s; c.strokeStyle = '#bfe4f8'; c.stroke();
    for (const x of [-180, -150, 160, 190]) paint.blobTree(c, cx + x * s, b - 4 * s, 50 * s, '#7a5a3a', '#5f9a3e', OUT, 1.6 * s);
  },
  homestead(c, cx, b, s) {
    cabin(c, cx - 70 * s, b, s);
    paint.blobTree(c, cx + 110 * s, b, 90 * s, '#6a4a2a', '#4f9a3e', OUT, 2 * s);
    picketFence(c, cx - 150 * s, cx + 160 * s, b + 4 * s, 18 * s, s);
  },
  generic(c, cx, b, s, pal) {
    paint.mesa(c, cx, b, 260 * s, 130 * s, mix(pal.far, '#d9a46c', 0.5), OUT, 2.4 * s);
    paint.mesa(c, cx + 150 * s, b, 120 * s, 70 * s, mix(pal.far, '#c99a63', 0.4), OUT, 2.2 * s);
  },
};
export const PAINTING_IDS = Object.keys(PAINTINGS);

// ---------------------------------------------------------------- the set pieces
// a canvas for the bbox [x0, y0, x1, y1] (css px) painted in screen coordinates
function canvasFor(L, x0, y0, x1, y1, fn) {
  const d = L.dpr;
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const cv = mkCanvas((x1 - x0) * d, (y1 - y0) * d);
  const c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, -x0 * d, -y0 * d);
  fn(c);
  return { cv, x0, y0, w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
}

// kind: a backdrop id (or 'approach' for the stop seen from the trail); returns null for 'trail'
export function buildSetPiece(kind, leg, L) {
  const { W, H, k } = L;
  const biome = biomeOf(leg && leg.biome), pal = BIOMES[biome];
  const legId = leg && leg.id;
  const base = L.bands.ground[0] + 0.03 * H; // where stop buildings stand (just on the ground, behind the trail)
  if (kind === 'fort') {
    const x0 = W * 0.46, sx = Math.max(W * 0.5, W - 210 * k);
    const out = canvasFor(L, x0 - 30 * k, base - 230 * k, W, base + 6 * k, (c) => {
      palisade(c, x0, W + 14 * k, base - 8 * k, 80 * k, k, true, '#d9534f');
      gate(c, Math.min(W - 60 * k, x0 + 200 * k), base - 8 * k, 40 * k, 62 * k, k);
      storeFront(c, sx, base + 4 * k, k, 'GENERAL STORE');
    });
    return { kind, z: 'ground', ...out, anchors: {} };
  }
  if (kind === 'river') {
    const wide = !(leg && leg.river && leg.river.width === 'narrow');
    const y0 = H * (wide ? 0.6 : 0.64), y1 = L.gy - 8 * k;
    const post1 = [W * 0.86, y1 + 6 * k], post2 = [W * 0.7, y0 + 4 * k];
    const out = canvasFor(L, 0, y0 - 40 * k, W, y1 + 16 * k, (c) => {
      // water with lighter bands toward the near bank
      c.fillStyle = pal.water; c.fillRect(0, y0, W, y1 - y0 + 4);
      c.fillStyle = shade(pal.water, 0.12); c.fillRect(0, y0 + (y1 - y0) * 0.45, W, (y1 - y0) * 0.55 + 4);
      // the far bank's edge
      c.beginPath(); c.moveTo(0, y0); for (let x = 0; x <= W; x += 10) c.lineTo(x, y0 + Math.sin(x * 0.05) * 2 * k + 3 * k); c.lineTo(W, y0 - 6 * k); c.lineTo(0, y0 - 6 * k); c.closePath();
      c.fillStyle = shade(pal.trail, -0.15); c.fill();
      // the near bank: a muddy lip and grass
      c.beginPath(); c.moveTo(0, y1 + 16 * k); c.lineTo(0, y1); for (let x = 0; x <= W; x += 10) c.lineTo(x, y1 - 3 * k + Math.sin(x * 0.07) * 3 * k); c.lineTo(W, y1 + 16 * k); c.closePath();
      c.fillStyle = shade(pal.trail, -0.1); c.fill(); c.lineWidth = 2; c.strokeStyle = shade(pal.trail, -0.4); c.stroke();
      // reeds
      for (let i = 0; i < 9; i++) paint.grass(c, (i + 0.5) * (W / 9) + Math.sin(i * 7) * 20 * k, y1 + 2 * k, 18 * k, '#4f7a3a', 2.4 * k);
      // the ferry rope between two posts
      c.beginPath(); c.moveTo(post1[0], post1[1] - 30 * k); c.lineTo(post2[0], post2[1] - 22 * k); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
      for (const [px, py, ph] of [[post1[0], post1[1], 34], [post2[0], post2[1], 24]]) { c.beginPath(); c.rect(px - 3 * k, py - ph * k, 6 * k, ph * k); fillOut(c, '#8a5a2e', 1.4 * k); }
    });
    return { kind, z: 'ground', ...out, anchors: { y0, y1, raftX: W * 0.74, raftY: (y0 + y1) / 2 + 4 * k, post1, post2 } };
  }
  if (kind === 'landmark' || kind === 'approach') {
    const id = kind === 'approach' ? approachPainting(leg) : paintingFor(legId);
    const s = Math.min(k * 1.15, (W * 0.5) / 240);
    const cx = W * 0.68, b = L.bands.mid[1] - 0.01 * H;
    const out = canvasFor(L, cx - 250 * s, b - 215 * s, cx + 250 * s, b + 12 * s, (c) => PAINTINGS[id](c, cx, b, s, pal));
    return { kind, z: 'mid', painting: id, ...out, anchors: { cx, base: b } };
  }
  if (kind === 'camp') {
    const tx = W * 0.8, tb = base + 6 * k;
    const out = canvasFor(L, tx - 70 * k, tb - 80 * k, Math.min(W, tx + 80 * k) + 1, tb + 6 * k, (c) => {
      c.beginPath(); c.moveTo(tx - 60 * k, tb); c.lineTo(tx, tb - 64 * k); c.lineTo(tx + 60 * k, tb); c.closePath(); fillOut(c, '#efe4c8', 2.2 * k);
      c.beginPath(); c.moveTo(tx, tb - 64 * k); c.lineTo(tx - 14 * k, tb); c.lineTo(tx + 14 * k, tb); c.closePath(); fillOut(c, '#5a4a3a', 1.8 * k);
      c.beginPath(); c.moveTo(tx, tb - 64 * k); c.lineTo(tx, tb - 74 * k); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
    });
    return { kind, z: 'ground', ...out, anchors: { fireX: W * 0.62, fireY: L.gy + 10 * k } };
  }
  if (kind === 'valley') {
    const cx = W * 0.6, b = base;
    let smoke = null;
    const out = canvasFor(L, cx - 160 * k, b - 150 * k, Math.min(W, cx + 280 * k) + 1, b + 12 * k, (c) => {
      if (W > 560 * k) barn(c, cx + 150 * k, b - 4 * k, k);
      smoke = cabin(c, cx - 70 * k, b, k);
      paint.blobTree(c, cx - 120 * k, b, 80 * k, '#6a4a2a', '#4f9a3e', OUT, 2 * k);
      garden(c, cx - 70 * k, b + 10 * k, 110 * k, k);
      picketFence(c, cx - 160 * k, cx + 50 * k, b + 10 * k, 16 * k, k);
    });
    return { kind, z: 'ground', ...out, anchors: smoke };
  }
  if (kind === 'post') return buildPost(leg, L, pal);
  return null;
}
// the stop the trail is heading for, seen on the horizon while approaching
function approachPainting(leg) {
  const kind = leg && leg.stop && leg.stop.kind;
  if (kind === 'fort') return 'fort';
  if (kind === 'home') return 'homestead';
  if (kind === 'river') return 'river';
  return paintingFor(leg && leg.id);
}

// the post office: an interior that covers the whole scene (the window shows the leg's sky)
function buildPost(leg, L, pal) {
  const { W, H, k } = L;
  const out = canvasFor(L, 0, 0, W, H, (c) => {
    // plank wall
    c.fillStyle = '#c8955a'; c.fillRect(0, 0, W, H);
    c.beginPath(); for (let x = 0; x < W; x += 34 * k) { c.moveTo(x, 0); c.lineTo(x, H); }
    c.lineWidth = 2 * k; c.strokeStyle = '#a8753e'; c.stroke();
    c.beginPath(); const r = mulberry32(hashStr('post')); for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H; c.moveTo(x + 3 * k, y); c.ellipse(x, y, 3 * k, 1.6 * k, 0, 0, TAU); }
    c.fillStyle = '#9a6a3c'; c.fill();
    // the window (left) with the leg's sky and hills
    const wx = W * 0.07, wy = H * 0.14, ww = Math.min(W * 0.22, 190 * k), wh = H * 0.36;
    const g = c.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, pal.sky[0]); g.addColorStop(1, pal.sky[1]);
    c.fillStyle = g; c.fillRect(wx, wy, ww, wh);
    c.beginPath(); c.moveTo(wx, wy + wh); c.quadraticCurveTo(wx + ww * 0.3, wy + wh * 0.55, wx + ww * 0.6, wy + wh * 0.72); c.quadraticCurveTo(wx + ww * 0.8, wy + wh * 0.6, wx + ww, wy + wh * 0.7); c.lineTo(wx + ww, wy + wh); c.closePath();
    c.fillStyle = pal.mid; c.fill();
    c.beginPath(); c.rect(wx, wy, ww, wh); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh / 2); c.lineTo(wx + ww, wy + wh / 2);
    c.lineWidth = 6 * k; c.strokeStyle = '#7a4a26'; c.stroke(); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.strokeRect(wx - 3 * k, wy - 3 * k, ww + 6 * k, wh + 6 * k);
    // the pigeonholes (mail slots) behind the counter
    const sx = W * 0.4, sy = H * 0.16, sw = Math.min(W * 0.5, 420 * k), sh = H * 0.4, cols = Math.max(4, Math.round(sw / (40 * k))), rows = 4;
    c.beginPath(); c.rect(sx, sy, sw, sh); fillOut(c, '#7a4a26', 2.4 * k);
    const cw = sw / cols, ch = sh / rows;
    const rr = mulberry32(7);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = sx + i * cw, y = sy + j * ch;
      c.fillStyle = '#4a2c16'; c.fillRect(x + 3 * k, y + 3 * k, cw - 6 * k, ch - 6 * k);
      if (rr() < 0.6) { c.beginPath(); c.rect(x + 6 * k, y + ch * 0.4, cw - 12 * k, ch * 0.5); fillOut(c, rr() < 0.5 ? '#f4ecd8' : '#e8d8b0', 1 * k); }
    }
    // the sign
    c.beginPath(); rrect(c, sx + sw / 2 - 90 * k, sy - 34 * k, 180 * k, 28 * k, 5 * k); fillOut(c, '#f4ead0', 2.2 * k);
    drawText(c, 'POST OFFICE', 15 * k, sx + sw / 2, sy - 20 * k, '#8a2b1b', null, 168 * k);
    // the clerk, behind the counter
    { const cs = k * 1.6, cTop = H * 0.66 - 12 * k; drawPerson(c, sx + sw * 0.25, cTop + 22 * cs, cs, personLook('clerk', '#5a7ab8', 'bowler'), 0, 0, 0, -1); }
    // a lamp
    const lx = W * 0.34, ly = H * 0.1;
    c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, ly); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(lx, ly + 18 * k, 34 * k, 0, TAU); c.fillStyle = 'rgba(255,220,120,0.25)'; c.fill();
    c.beginPath(); c.moveTo(lx - 12 * k, ly + 4 * k); c.lineTo(lx + 12 * k, ly + 4 * k); c.lineTo(lx + 8 * k, ly + 24 * k); c.lineTo(lx - 8 * k, ly + 24 * k); c.closePath(); fillOut(c, '#ffd86a', 1.8 * k);
    // the counter
    const cy = H * 0.66;
    c.beginPath(); c.rect(-4, cy, W + 8, H - cy + 4); fillOut(c, '#8a5a2e', 3 * k);
    c.beginPath(); c.rect(-4, cy - 12 * k, W + 8, 14 * k); fillOut(c, '#a8703e', 3 * k);
    c.beginPath(); for (let x = 40 * k; x < W; x += 120 * k) { c.rect(x, cy + 20 * k, 90 * k, H - cy - 34 * k); }
    c.lineWidth = 2.2 * k; c.strokeStyle = '#6a3f22'; c.stroke();
    // on the counter: a stack of letters, a parcel with string, a scale, an ink pot
    const top = cy - 12 * k;
    c.beginPath(); rrect(c, W * 0.18, top - 10 * k, 46 * k, 10 * k, 2 * k); fillOut(c, '#f4ecd8', 1.4 * k);
    c.beginPath(); rrect(c, W * 0.18 + 4 * k, top - 18 * k, 42 * k, 9 * k, 2 * k); fillOut(c, '#e8d8b0', 1.4 * k);
    c.beginPath(); c.moveTo(W * 0.18 + 10 * k, top - 14 * k); c.lineTo(W * 0.18 + 25 * k, top - 10 * k); c.lineTo(W * 0.18 + 40 * k, top - 14 * k); c.lineWidth = 1.2 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.rect(W * 0.6, top - 30 * k, 50 * k, 30 * k); fillOut(c, '#c8a060', 2 * k);
    c.beginPath(); c.moveTo(W * 0.6 + 25 * k, top - 30 * k); c.lineTo(W * 0.6 + 25 * k, top); c.moveTo(W * 0.6, top - 15 * k); c.lineTo(W * 0.6 + 50 * k, top - 15 * k); c.lineWidth = 1.6 * k; c.strokeStyle = '#d9534f'; c.stroke();
    const scx = W * 0.8;
    c.beginPath(); c.rect(scx - 3 * k, top - 34 * k, 6 * k, 34 * k); fillOut(c, '#c9a227', 1.4 * k);
    c.beginPath(); c.moveTo(scx - 30 * k, top - 34 * k); c.lineTo(scx + 30 * k, top - 34 * k); c.lineWidth = 3 * k; c.strokeStyle = OUT; c.stroke();
    for (const dx of [-26, 26]) { c.beginPath(); c.moveTo(scx + (dx - 10) * k, top - 26 * k); c.quadraticCurveTo(scx + dx * k, top - 18 * k, scx + (dx + 10) * k, top - 26 * k); c.closePath(); fillOut(c, '#e0b84a', 1.4 * k); }
    c.beginPath(); rrect(c, W * 0.44, top - 14 * k, 14 * k, 14 * k, 3 * k); fillOut(c, '#2e3a5a', 1.4 * k);
    c.beginPath(); c.moveTo(W * 0.44 + 7 * k, top - 14 * k); c.lineTo(W * 0.44 + 16 * k, top - 34 * k); c.lineWidth = 1.6 * k; c.strokeStyle = '#f4f4f4'; c.stroke();
  });
  return { kind: 'post', z: 'cover', ...out, anchors: {} };
}
