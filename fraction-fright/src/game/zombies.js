// Zombies: the slow lurchers that rise out of the graveyard fog at their fraction's spot and shuffle straight toward
// the road (SPEC §13.1), and the neighbours they turn back into.
// Entity logic (spawn hidden, the column walk with a limp, emergence from the fog, the polite knock at the fence,
// taking a jack-o'-lantern, shuffling off sideways; the cure under the grenade: a launch with a spin, the hat flies,
// a shocked face and a line, then the walk home into the fog; frost freezes first, disco dances home; the boss takes
// 3 hits with a dizzy stagger) and the procedural drawing of the 6 silhouettes (punk, chef, football player, hiker,
// scientist, mailman): lanky, hunched, torn jackets, mismatched boots, one glowing eye, a dangling arm. Creepy-funny
// like a Halloween decoration, never gore. No images.
// Column coordinates: p = 0 (far, in the fog at the hill line) .. 1 (the lane in front of the road); the engine maps p
// to a y and a scale, x is the fraction's spot. Drawing is in css px at the zombie's feet; `h` is its height.

import { TAU, clamp, shade, withAlpha, easeInOut, popScale } from './util.js';
import { LOOKS, LOOK_BY_ID, HATS, HAT_COLORS } from '../data/zombies.js';
import { OUT, spriteText, textWidth, drawPumpkin } from './render.js';
import { roundRect } from './road.js';

export const ZT = {
  knockSec: 1.1, takeSec: 0.7, leaveSec: 1.4, cureSec: 0.55, thanksSec: 1.1, homeSec: 3.0, freezeSec: 0.5, spawnStagger: 0.55,
  fadeP: 0.08, homeSpeed: 0.28, leaveSpeed: 70,
};
// kid-safe chatter (SPEC §13.3): short, silly, never the banned words
export const MUTTERS = ['braaains... I mean maaath', 'is it Tuesday?', "where's my hat?", 'nice fence', 'one more step', 'I smell slime', 'mooon', 'shoe untied', 'nap time', 'is that a dog?'];
export const THANKS = ['Thanks!', "I'm late for bingo!", 'Was I asleep?', 'Nice throw!', 'My hat!', 'Smells like lime'];
export const BOSS_LINES = ['Mumble grumble', 'Same number!', 'Not again!', 'I am the mayor'];
const EXTRA_HAT_COLORS = { top: '#1b1a24', party: '#ffd23f' };
let thanksIdx = 0;

// ---------- entities ----------
export function makeZombie(item, index, rand, opts = {}) {
  const look = opts.look || LOOKS[Math.floor(rand() * LOOKS.length)];
  const hats = Array.isArray(opts.hats) && opts.hats.length ? opts.hats : null;
  return {
    id: 'z' + index, item, index, look, hat: opts.boss ? 'top' : hats && rand() < 0.5 ? hats[index % hats.length] : look.hat,
    state: 'walk', // walk | knock | take | leave | freeze | cure | thanks | home | gone
    p: -0.02, t: 0, dx: 0,
    walkSec: opts.walkSec || 20,
    emerge: Number.isFinite(opts.emerge) ? opts.emerge : 0.6,
    boss: !!opts.boss, dizzyT: 0,
    wobble: rand() * TAU, bob: 0.9 + rand() * 0.25, gait: 0.85 + rand() * 0.3, limp: rand() < 0.5 ? 1 : -1,
    tookPumpkin: false, pumpkin: null,
    hatFly: null, say: null, nextMutter: null, line: null, dance: false, big: false,
    face: 1, leaveDir: index % 2 ? 1 : -1,
    alive: true, resolved: false, cured: false, reached: false, arrivedAt: 0,
  };
}
export function stepZombie(z, dt) {
  z.t += dt;
  switch (z.state) {
    case 'walk': {
      if (z.dizzyT > 0) { z.dizzyT -= dt; return null; }
      z.p += dt / z.walkSec;
      if (z.p >= 1) { z.p = 1; z.state = 'knock'; z.t = 0; return 'arrive'; }
      return null;
    }
    case 'knock':
      if (z.t >= ZT.knockSec) { z.state = 'take'; z.t = 0; }
      return null;
    case 'take':
      if (z.t >= ZT.takeSec) { z.state = 'leave'; z.t = 0; z.alive = false; z.reached = true; z.resolved = true; z.face = z.leaveDir; return 'reached'; }
      return null;
    case 'leave':
      z.dx += dt * ZT.leaveSpeed * z.leaveDir;
      if (z.t >= ZT.leaveSec) { z.state = 'gone'; return 'gone'; }
      return null;
    case 'freeze':
      if (z.t >= ZT.freezeSec) { z.state = 'cure'; z.t = 0; z.hatFly = z.hatPending; z.hatPending = null; return 'shatter'; }
      return null;
    case 'cure':
      flyHat(z, dt);
      if (z.t >= ZT.cureSec) { z.state = 'thanks'; z.t = 0; }
      return null;
    case 'thanks':
      flyHat(z, dt);
      if (z.t >= ZT.thanksSec) { z.state = 'home'; z.t = 0; return 'home'; }
      return null;
    case 'home':
      z.p -= dt * ZT.homeSpeed;
      if (z.p <= z.emerge - 0.03 || z.t >= ZT.homeSec) { z.state = 'gone'; return 'gone'; }
      return null;
    default:
      return null;
  }
}
function flyHat(z, dt) { const f = z.hatFly; if (!f) return; f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
// the cure: frost freezes the zombie 0.5 s first (the hat flies at the shatter); disco dances home; big = the boss
export function cureZombie(z, hatFrom, opts = {}) {
  if (!z.alive) return false;
  z.alive = false; z.cured = true; z.resolved = true;
  z.t = 0; z.say = null; z.dizzyT = 0;
  z.dance = !!opts.dance; z.big = !!opts.big;
  z.line = THANKS[thanksIdx++ % THANKS.length];
  const hat = { x: hatFrom.x, y: hatFrom.y, vx: 90, vy: -380, rot: 0, vr: 7 };
  if (opts.freeze) { z.state = 'freeze'; z.hatPending = hat; } else { z.state = 'cure'; z.hatFly = hat; }
  return true;
}
// 0 while hidden in the fog (p < emerge), fading in over fadeP; out again when leaving or walking home into the fog
export function zombieAlpha(z) {
  if (z.state === 'leave') return 1 - easeInOut(clamp(z.t / ZT.leaveSec, 0, 1));
  if (z.state === 'home') return clamp((z.p - (z.emerge - 0.03)) / 0.12, 0, 1);
  if (z.state === 'gone') return 0;
  if (z.state === 'walk' || z.state === 'knock' || z.state === 'take') return clamp((z.p - z.emerge) / ZT.fadeP, 0, 1);
  return 1;
}

// ---------- drawing ----------
// draw at feet (x, y), height h, facing z.face; t = animation time.
export function drawZombie(ctx, z, x, y, h, t, lw) {
  const look = z.look;
  const cured = z.cured;
  const walking = z.state === 'walk' || z.state === 'leave' || z.state === 'home';
  const home = z.state === 'home';
  const ph = z.wobble + t * (home ? 9 : 3.6 * z.gait);
  const step = walking ? Math.sin(ph) : 0;
  // the lurch: a drop on the bad leg's step
  const lurch = walking && !home ? Math.max(0, -Math.sin(ph)) * h * 0.05 : walking ? Math.abs(Math.cos(ph)) * h * 0.03 : 0;
  const pop = z.state === 'cure' ? popScale(clamp(z.t / ZT.cureSec, 0, 1)) : 1;
  const skin = cured ? look.neighbour.skin : look.skin;
  const jacket = cured ? look.neighbour.jacket : look.jacket;
  const shirt = cured ? look.neighbour.shirt : look.shirt;
  const alpha = zombieAlpha(z);
  if (alpha <= 0.01) return;
  const u = h / 60;
  ctx.save();
  ctx.globalAlpha = alpha;
  // the launch: a hop up with a full spin (bigger for the boss); the dance: a bounce and a sway on the way home
  const ck = z.state === 'cure' ? clamp(z.t / ZT.cureSec, 0, 1) : 0;
  const hop = ck ? Math.sin(ck * Math.PI) * h * (z.big ? 1.2 : 0.8) : 0;
  const danceHop = home && z.dance ? Math.abs(Math.sin(t * 9)) * h * 0.14 : 0;
  // shadow stays on the ground
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = withAlpha('#000000', 0.3 * (1 - 0.6 * clamp(hop / h, 0, 1)));
  ctx.beginPath(); ctx.ellipse(2 * u, 2 * u, 15 * u * (1 - 0.3 * clamp(hop / h, 0, 1)), 4 * u, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.translate(x, y + lurch - hop - danceHop);
  ctx.scale(z.face, 1);
  if (ck) { ctx.translate(0, -27 * u); ctx.rotate(ck * TAU); ctx.translate(0, 27 * u); }
  if (z.dizzyT > 0) ctx.rotate(Math.sin(t * 14) * 0.12);
  if (home && z.dance) ctx.rotate(Math.sin(t * 9) * 0.18);
  if (z.state === 'cure') ctx.scale(0.75 + 0.25 * pop, 1.25 - 0.25 * pop);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT;
  // ---- legs: long and thin; one steps, the other drags (limp). Mismatched boots. ----
  const good = step * 5 * u, drag = cured ? -step * 5 * u : -3 * u + Math.min(0, step) * 3 * u;
  const hipY = -27 * u;
  ctx.fillStyle = look.pants;
  // back (dragging) leg, slightly bent
  ctx.save(); ctx.translate(-2 * u + drag, hipY); ctx.rotate(cured ? 0 : 0.12);
  roundRect(ctx, -3.5 * u, 0, 7 * u, 27 * u, 2.5 * u); ctx.fill(); ctx.stroke(); ctx.restore();
  // front (good) leg
  ctx.save(); ctx.translate(5 * u + good, hipY); ctx.rotate(cured ? 0 : -0.06);
  roundRect(ctx, -3.5 * u, 0, 7 * u, 27 * u, 2.5 * u); ctx.fill(); ctx.stroke(); ctx.restore();
  if (!cured) { ctx.fillStyle = shade(look.pants, -0.35); ctx.fillRect(4 * u + good, -8 * u, 5 * u, 2 * u); ctx.fillRect(-5 * u + drag, -14 * u, 4 * u, 2 * u); } // patches
  // boots (mismatched): a tall boot and a sneaker
  ctx.fillStyle = look.boots[0]; roundRect(ctx, -7 * u + drag, -6 * u, 11 * u, 7 * u, 2 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = look.boots[1]; roundRect(ctx, 1 * u + good, -4 * u, 12 * u, 5 * u, 2 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8e4dc'; ctx.fillRect(3 * u + good, -3 * u, 8 * u, 1.5 * u);
  // ---- torso: hunched forward (zombie) or upright (neighbour) ----
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(cured ? 0 : 0.3 + (walking && !home ? Math.sin(ph) * 0.04 : 0));
  // jacket with a torn hem
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(-9 * u, -30 * u); ctx.lineTo(9 * u, -30 * u); ctx.lineTo(10 * u, -2 * u);
  if (cured) ctx.lineTo(-10 * u, -2 * u);
  else { ctx.lineTo(6 * u, 1 * u); ctx.lineTo(3 * u, -3 * u); ctx.lineTo(-1 * u, 2 * u); ctx.lineTo(-5 * u, -2 * u); ctx.lineTo(-10 * u, 0); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // shirt in the open jacket + lapels
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.moveTo(-3 * u, -30 * u); ctx.lineTo(3 * u, -30 * u); ctx.lineTo(2 * u, -10 * u); ctx.lineTo(-2 * u, -10 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade(jacket, -0.25); ctx.beginPath(); ctx.moveTo(-3 * u, -30 * u); ctx.lineTo(-5 * u, -22 * u); ctx.lineTo(-3 * u, -20 * u); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(3 * u, -30 * u); ctx.lineTo(5 * u, -22 * u); ctx.lineTo(3 * u, -20 * u); ctx.closePath(); ctx.fill();
  if (z.boss) { // the mayor's sash
    ctx.fillStyle = '#c9201f'; ctx.beginPath(); ctx.moveTo(-9 * u, -28 * u); ctx.lineTo(-4 * u, -30 * u); ctx.lineTo(10 * u, -6 * u); ctx.lineTo(6 * u, -2 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(7 * u, -7 * u, 3 * u, 0, TAU); ctx.fill(); ctx.stroke();
  }
  drawProp(ctx, look.prop, u, lw, jacket, cured);
  // ---- arms ----
  ctx.fillStyle = cured ? jacket : jacket;
  if (cured) {
    // both hands up in surprise
    const w = z.state === 'home' && !z.dance ? Math.sin(ph) * 0.4 : z.wave ? Math.sin(t * 9 + z.wobble) * 0.35 : Math.sin(t * 10) * 0.08;
    const up = z.state !== 'home' || z.dance;
    arm(ctx, -8 * u, -27 * u, up ? 2.6 + w : 0.3 + w, 0.5, u, lw, jacket, skin, false);
    arm(ctx, 8 * u, -27 * u, up ? -2.6 - w : -0.3 - w, -0.5, u, lw, jacket, skin, false);
  } else if (z.state === 'knock') {
    const k = Math.max(0, Math.sin(z.t * 17));
    arm(ctx, -8 * u, -27 * u, 0.25, 0.1, u, lw, jacket, skin, true); // the dangling one
    arm(ctx, 8 * u, -27 * u, -1.9 + k * 0.5, -0.9 + k * 0.6, u, lw, jacket, skin, false, true);
  } else {
    // one arm reaches forward (upper arm then forearm), the other dangles and sways
    const sway = Math.sin(t * 2.2 + z.wobble) * 0.12;
    arm(ctx, -8 * u, -27 * u, 0.22 + sway, 0.08, u, lw, jacket, skin, true);
    const reach = Math.sin(t * 3 + z.wobble) * 0.1;
    arm(ctx, 8 * u, -27 * u, -1.35 + reach, -0.25, u, lw, jacket, skin, false, true);
    if (z.pumpkin) { ctx.save(); ctx.translate(26 * u, -22 * u); drawPumpkin(ctx, 0, 0, 6 * u, lw, 0.6, t); ctx.restore(); }
  }
  // ---- head on a thin neck, pushed forward ----
  ctx.fillStyle = skin;
  ctx.fillRect(1 * u, -36 * u, 5 * u, 7 * u); ctx.strokeRect(1 * u, -36 * u, 5 * u, 7 * u);
  ctx.save(); ctx.translate(cured ? 1 * u : 5 * u, -44 * u); ctx.rotate(cured ? 0 : 0.1 + 0.08 * Math.sin(t * 2 + z.wobble));
  ctx.fillStyle = skin;
  // skull: wider at the brow, narrower jaw
  ctx.beginPath(); ctx.moveTo(-11 * u, -6 * u); ctx.quadraticCurveTo(-11 * u, -14 * u, 0, -14 * u); ctx.quadraticCurveTo(11 * u, -14 * u, 11 * u, -6 * u); ctx.lineTo(9 * u, 6 * u); ctx.quadraticCurveTo(7 * u, 11 * u, 0, 11 * u); ctx.quadraticCurveTo(-7 * u, 11 * u, -9 * u, 6 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (!cured) {
    ctx.fillStyle = look.skinDark; ctx.beginPath(); ctx.arc(-5 * u, 4 * u, 3.5 * u, 0, TAU); ctx.fill();
    ctx.lineWidth = lw * 0.9; ctx.beginPath(); ctx.moveTo(-9 * u, -8 * u); ctx.lineTo(-2 * u, -10 * u); ctx.moveTo(-7.5 * u, -10 * u); ctx.lineTo(-7 * u, -6.5 * u); ctx.moveTo(-4.5 * u, -11 * u); ctx.lineTo(-4 * u, -7.5 * u); ctx.stroke(); ctx.lineWidth = lw * 1.3;
    // a small bolt / patch at the temple for the scientist look
  } else { ctx.fillStyle = withAlpha('#ff6b8a', 0.4); ctx.beginPath(); ctx.arc(-6 * u, 4 * u, 2.6 * u, 0, TAU); ctx.arc(8 * u, 4 * u, 2.6 * u, 0, TAU); ctx.fill(); }
  // ear
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-10 * u, -1 * u, 2.4 * u, 0, TAU); ctx.fill(); ctx.stroke();
  drawFace(ctx, look, cured, u, t, lw, z);
  // hair / hat (unless it flew)
  if (!z.hatFly) drawHat(ctx, z.hat, 0, -13 * u, u, lw, t, look);
  else { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.moveTo(-8 * u, -12 * u); ctx.lineTo(-5 * u, -17 * u); ctx.lineTo(-1 * u, -13 * u); ctx.lineTo(3 * u, -18 * u); ctx.lineTo(6 * u, -12 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.restore(); // torso
  if (z.state === 'freeze') { // frost: an ice block around the zombie
    const k = clamp(z.t / 0.12, 0, 1);
    ctx.fillStyle = withAlpha('#9fe8ff', 0.55 * k); ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = lw * 1.6;
    roundRect(ctx, -17 * u, -62 * u, 34 * u, 64 * u, 5 * u); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = withAlpha('#ffffff', 0.8 * k); ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(-12 * u, -50 * u); ctx.lineTo(-4 * u, -38 * u); ctx.lineTo(-9 * u, -24 * u); ctx.moveTo(8 * u, -56 * u); ctx.lineTo(12 * u, -44 * u); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3;
  }
  ctx.restore();
  if (z.boss && !cured && z.item && z.item.name) { // the name plate above the boss
    const fz = Math.max(10, h * 0.16), text = z.item.name.toUpperCase();
    const w = textWidth(text, fz) + fz * 1.2, ph2 = fz * 1.4, py = Math.max(fz, y - h - fz * 1.9);
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
    ctx.fillStyle = '#5a3a1e'; roundRect(ctx, x - w / 2, py - ph2 / 2, w, ph2, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2410'; ctx.fillRect(x - w / 2 + 3, py - ph2 / 2 + 3, w - 6, 2);
    spriteText(ctx, text, fz, x, py, '#ffd23f', true);
    ctx.restore();
  }
  if (z.hatFly) {
    const f = z.hatFly;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
    drawHat(ctx, z.hat, 0, 0, u, lw, t, z.look); ctx.restore();
  }
}
// an arm: upper from the shoulder at angle a1 (0 = straight down), forearm bent by a2; a sleeve, then a hand
function arm(ctx, sx, sy, a1, a2, u, lw, sleeve, skin, dangle, open = false) {
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(a1);
  ctx.fillStyle = sleeve; roundRect(ctx, -3 * u, 0, 6 * u, 12 * u, 2.5 * u); ctx.fill(); ctx.stroke();
  ctx.translate(0, 12 * u); ctx.rotate(a2);
  ctx.fillStyle = sleeve; roundRect(ctx, -2.8 * u, 0, 5.6 * u, 10 * u, 2 * u); ctx.fill(); ctx.stroke();
  // a torn cuff
  ctx.fillStyle = shade(sleeve, -0.3); ctx.beginPath(); ctx.moveTo(-2.8 * u, 9 * u); ctx.lineTo(-1 * u, 11 * u); ctx.lineTo(0.5 * u, 9 * u); ctx.lineTo(2 * u, 11 * u); ctx.lineTo(2.8 * u, 9 * u); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin;
  if (open) { // reaching hand: palm + spread fingers
    roundRect(ctx, -3 * u, 10 * u, 6 * u, 5 * u, 2 * u); ctx.fill(); ctx.stroke();
    for (let i = -1; i <= 1; i++) { roundRect(ctx, i * 2.2 * u - 1 * u, 14 * u, 2 * u, 4.5 * u, u); ctx.fill(); ctx.stroke(); }
  } else { roundRect(ctx, -3 * u, 10 * u, 6 * u, 6 * u, 2.5 * u); ctx.fill(); ctx.stroke(); if (dangle) { roundRect(ctx, -1 * u, 15 * u, 2 * u, 3 * u, u); ctx.fill(); ctx.stroke(); } }
  ctx.restore();
}
function drawProp(ctx, prop, u, lw, jacket, cured) {
  if (prop === 'studs') { ctx.fillStyle = '#c8ccd6'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-7 * u + i * 2.3 * u, -28 * u, 0.9 * u, 0, TAU); ctx.fill(); } }
  else if (prop === 'pads') { ctx.fillStyle = shade(jacket, 0.15); roundRect(ctx, -13 * u, -32 * u, 9 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke(); roundRect(ctx, 4 * u, -32 * u, 9 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke(); spriteText(ctx, '8', 7 * u, 0, -17 * u, '#ffffff', true); }
  else if (prop === 'pack') { ctx.fillStyle = '#4a5a3a'; roundRect(ctx, -14 * u, -29 * u, 8 * u, 16 * u, 2.5 * u); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2f3a2f'; ctx.fillRect(-14 * u, -22 * u, 8 * u, 2 * u); }
  else if (prop === 'bag') { ctx.fillStyle = '#7a4a2a'; roundRect(ctx, 5 * u, -16 * u, 9 * u, 9 * u, 1.5 * u); ctx.fill(); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-6 * u, -30 * u); ctx.lineTo(8 * u, -16 * u); ctx.stroke(); ctx.lineWidth = lw * 1.3; }
  else if (prop === 'badge') { ctx.fillStyle = '#ffffff'; roundRect(ctx, 4 * u, -26 * u, 4.5 * u, 3 * u, 0.5 * u); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5bc0eb'; ctx.fillRect(4.6 * u, -25.4 * u, 1.6 * u, 1.8 * u); }
  else if (prop === 'spoon' && !cured) { ctx.fillStyle = '#9aa0ad'; ctx.fillRect(-8 * u, -24 * u, 1.6 * u, 9 * u); ctx.strokeRect(-8 * u, -24 * u, 1.6 * u, 9 * u); ctx.beginPath(); ctx.ellipse(-7.2 * u, -26 * u, 2.2 * u, 3 * u, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
}
function drawFace(ctx, look, cured, u, t, lw, z) {
  ctx.lineWidth = lw * 1.1; ctx.strokeStyle = OUT;
  if (cured) {
    // shocked: wide eyes with small pupils, raised brows, an O mouth
    for (const ex of [-4 * u, 5 * u]) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, -1 * u, 3.6 * u, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(ex + 0.5 * u, -0.5 * u, 1.3 * u, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-7 * u, -7 * u); ctx.quadraticCurveTo(-4 * u, -9.5 * u, -1 * u, -7.5 * u); ctx.moveTo(2 * u, -7.5 * u); ctx.quadraticCurveTo(5 * u, -9.5 * u, 8 * u, -7 * u); ctx.stroke();
    ctx.fillStyle = '#3a1f2a'; ctx.beginPath(); ctx.ellipse(1 * u, 6 * u, 2.6 * u, 3.4 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
    return;
  }
  // one glowing eye (with a halo), the other squinted shut
  const g = 0.8 + 0.2 * Math.sin(t * 6 + z.wobble);
  ctx.fillStyle = withAlpha(look.glow, 0.25 * g); ctx.beginPath(); ctx.arc(5 * u, -1 * u, 6 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = look.glow; ctx.beginPath(); ctx.arc(5 * u, -1 * u, 3.4 * u, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(5.6 * u + Math.sin(t * 1.7) * 0.6 * u, -1 * u, 1.3 * u, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7 * u, -1 * u); ctx.lineTo(-2 * u, -0.5 * u); ctx.stroke(); // the squint
  ctx.beginPath(); ctx.moveTo(-8 * u, -5 * u); ctx.lineTo(-2 * u, -4 * u); ctx.moveTo(2 * u, -6 * u); ctx.lineTo(9 * u, -5 * u); ctx.stroke(); // angled brows
  // crooked grin with gap teeth
  ctx.fillStyle = '#2a1520';
  ctx.beginPath(); ctx.moveTo(-6 * u, 5 * u); ctx.quadraticCurveTo(0, 10 * u, 8 * u, 4 * u); ctx.quadraticCurveTo(2 * u, 7 * u, -6 * u, 5 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4f0e4'; ctx.fillRect(-3 * u, 5.2 * u, 2 * u, 2 * u); ctx.fillRect(2 * u, 4.8 * u, 2 * u, 2.2 * u); ctx.fillRect(5 * u, 4.6 * u, 1.6 * u, 1.6 * u);
}
// hats/hair that match the look; (x, y) is the top of the head, u = unit
export function drawHat(ctx, kind, x, y, u, lw, t = 0, look = null) {
  const c = HAT_COLORS[kind] || EXTRA_HAT_COLORS[kind] || '#4a5a7a';
  ctx.fillStyle = c; ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3; ctx.lineJoin = 'round';
  switch (kind) {
    case 'mohawk':
      ctx.beginPath(); ctx.moveTo(-9 * u, y + 2 * u);
      for (let i = 0; i < 6; i++) { ctx.lineTo(-8 * u + i * 3.2 * u, y - (8 + (i % 2) * 6 + (i === 3 ? 4 : 0)) * u); ctx.lineTo(-6.5 * u + i * 3.2 * u, y - 2 * u); }
      ctx.lineTo(10 * u, y + 2 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8ccd6'; ctx.beginPath(); ctx.arc(-10 * u, y + 8 * u, 1.4 * u, 0, TAU); ctx.fill(); ctx.stroke(); // an earring
      break;
    case 'toque':
      roundRect(ctx, -10 * u, y - 4 * u, 20 * u, 6 * u, 2 * u); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10 * u, y - 4 * u); ctx.quadraticCurveTo(-13 * u, y - 18 * u, -4 * u, y - 19 * u); ctx.quadraticCurveTo(0, y - 24 * u, 5 * u, y - 19 * u); ctx.quadraticCurveTo(14 * u, y - 18 * u, 10 * u, y - 4 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = withAlpha('#8b2f2f', 0.5); ctx.beginPath(); ctx.ellipse(4 * u, y - 12 * u, 3 * u, 2 * u, 0.4, 0, TAU); ctx.fill(); // a stain
      break;
    case 'helmet':
      ctx.beginPath(); ctx.moveTo(-12 * u, y + 6 * u); ctx.lineTo(-12 * u, y - 4 * u); ctx.quadraticCurveTo(-11 * u, y - 16 * u, 0, y - 16 * u); ctx.quadraticCurveTo(12 * u, y - 16 * u, 12 * u, y - 4 * u); ctx.lineTo(12 * u, y + 2 * u); ctx.lineTo(8 * u, y + 2 * u); ctx.lineTo(8 * u, y - 2 * u); ctx.lineTo(-8 * u, y - 2 * u); ctx.lineTo(-8 * u, y + 6 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-2 * u, y - 16 * u, 4 * u, 14 * u); ctx.strokeRect(-2 * u, y - 16 * u, 4 * u, 14 * u);
      ctx.strokeStyle = '#c8ccd6'; ctx.lineWidth = lw * 1.1; ctx.beginPath(); ctx.moveTo(8 * u, y + 4 * u); ctx.lineTo(16 * u, y + 5 * u); ctx.moveTo(8 * u, y + 8 * u); ctx.lineTo(15 * u, y + 9 * u); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3; // face guard
      break;
    case 'beanie':
      ctx.beginPath(); ctx.moveTo(-12 * u, y + 2 * u); ctx.quadraticCurveTo(-4 * u, y - 19 * u, 12 * u, y + 2 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c0612b'; ctx.beginPath(); ctx.moveTo(-8 * u, y - 6 * u); ctx.quadraticCurveTo(0, y - 11 * u, 9 * u, y - 5 * u); ctx.lineTo(10 * u, y - 2 * u); ctx.quadraticCurveTo(0, y - 8 * u, -9 * u, y - 3 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, -0.25); roundRect(ctx, -12 * u, y - 2 * u, 24 * u, 5 * u, 2 * u); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.arc(2 * u, y - 17 * u, 3.2 * u, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    case 'goggles':
      ctx.fillStyle = look ? look.hair : '#cfcfd6';
      ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; ctx.lineTo(Math.cos(a) * 11 * u, y + 2 * u + Math.sin(a) * (10 + (i % 2) * 5) * u); } ctx.closePath(); ctx.fill(); ctx.stroke(); // wild hair
      ctx.fillStyle = '#4a4658'; roundRect(ctx, -11 * u, y - 3 * u, 22 * u, 3.5 * u, 1.5 * u); ctx.fill(); ctx.stroke();
      for (const gx of [-5 * u, 5 * u]) { ctx.fillStyle = '#5a5a6a'; ctx.beginPath(); ctx.arc(gx, y - 3 * u, 4 * u, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = withAlpha('#9dff2e', 0.75); ctx.beginPath(); ctx.arc(gx, y - 3 * u, 2.6 * u, 0, TAU); ctx.fill(); }
      break;
    case 'cap':
      ctx.beginPath(); ctx.moveTo(-11 * u, y + 2 * u); ctx.lineTo(-10 * u, y - 7 * u); ctx.quadraticCurveTo(0, y - 13 * u, 10 * u, y - 7 * u); ctx.lineTo(11 * u, y + 2 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundRect(ctx, 6 * u, y - 1 * u, 13 * u, 4 * u, 2 * u); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(2 * u, y - 5 * u, 2.2 * u, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    case 'top': // the mayor's top hat with a gold band
      ctx.fillStyle = EXTRA_HAT_COLORS.top;
      roundRect(ctx, -13 * u, y - 3 * u, 26 * u, 4 * u, 1.5 * u); ctx.fill(); ctx.stroke();
      roundRect(ctx, -9 * u, y - 22 * u, 18 * u, 20 * u, 2 * u); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-9 * u, y - 8 * u, 18 * u, 3.5 * u); ctx.strokeRect(-9 * u, y - 8 * u, 18 * u, 3.5 * u);
      break;
    case 'party': // a crooked party cone
      ctx.fillStyle = EXTRA_HAT_COLORS.party;
      ctx.save(); ctx.rotate(-0.25);
      ctx.beginPath(); ctx.moveTo(-8 * u, y + 1 * u); ctx.lineTo(0, y - 20 * u); ctx.lineTo(8 * u, y + 1 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff3cac'; ctx.beginPath(); ctx.moveTo(-5 * u, y - 6 * u); ctx.lineTo(5 * u, y - 6 * u); ctx.lineTo(3 * u, y - 11 * u); ctx.lineTo(-3 * u, y - 11 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4dd2ff'; ctx.beginPath(); ctx.arc(0, y - 20 * u, 2.5 * u, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      break;
    default:
      roundRect(ctx, -12 * u, y - 10 * u, 24 * u, 11 * u, 3 * u); ctx.fill(); ctx.stroke();
  }
}
// the "called" marker: a bouncing arrow above the current zombie
export function drawCallMarker(ctx, x, y, t, lw, color) {
  const bob = Math.sin(t * 6) * 4;
  const s = 7;
  ctx.lineJoin = 'round'; ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - s, y - 10 + bob); ctx.lineTo(x + s, y - 10 + bob); ctx.lineTo(x, y + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
}
// a speech bubble ("knock knock", "Thanks!") above (x, y); k = 0..1 pop; kept inside maxX
export function drawBubble(ctx, text, x, y, fz, k, lw, maxX = Infinity) {
  const s = popScale(clamp(k, 0, 1));
  if (s <= 0.05) return;
  const w = (fz * 0.6 * text.length + fz * 1.1) * s, h = fz * 1.6 * s;
  const tipX = x;
  x = clamp(x, w / 2 + 4, maxX - w / 2 - 4);
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.fillStyle = '#f4f0e4'; ctx.lineJoin = 'round';
  roundRect(ctx, x - w / 2, y - h, w, h, 4); ctx.fill(); ctx.stroke();
  const tx = clamp(tipX, x - w / 2 + 10, x + w / 2 - 10);
  ctx.beginPath(); ctx.moveTo(tx - 5 * s, y - 1); ctx.lineTo(tx, y + 7 * s); ctx.lineTo(tx + 6 * s, y - 1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(tx - 5 * s, y); ctx.lineTo(tx, y + 7 * s); ctx.lineTo(tx + 6 * s, y); ctx.stroke();
  if (s > 0.5) spriteText(ctx, text, fz * s, x, y - h / 2, OUT, false);
}
export { LOOKS, LOOK_BY_ID, HATS };
export function pickLooks(rand, n) {
  const order = LOOKS.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const out = [];
  for (let i = 0; i < n; i++) out.push(order[i % order.length]);
  return out;
}
export function lookOf(id) { return LOOK_BY_ID[id] || null; }
