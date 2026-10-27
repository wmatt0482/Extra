// Critter Stampede (SPEC §14): the six critters of the bonus round and their procedural art. A critter runs across the
// yard (ground: the lane behind the road or the grass in front of the fence; air: bats and crows in arcs). Zombie look:
// green-grey fur, one glowing eye, a limp in the run. Cured look: natural colours, a party hat, a happy scamper off.
// The golden critter is the same shape in gold with a sparkle. Halloween-cool, never gore. No images.
// Drawing is in css px at the critter's feet (ground) or body centre (air), size s = the body length; `dir` = +1 runs
// right, -1 runs left; `ph` = the run phase (radians); `zombie` picks the look.

import { TAU, clamp, shade, withAlpha, popScale } from './util.js';
import { OUT } from './render.js';
import { roundRect } from './road.js';

export const KINDS = Object.freeze(['squirrel', 'raccoon', 'bunny', 'chicken', 'bat', 'crow']);
export const AIR = Object.freeze({ bat: true, crow: true });

// natural (cured) colours per kind; the zombie look derives from these (desaturated, green-grey)
const COLORS = {
  squirrel: { body: '#b5652c', belly: '#e9c9a2', dark: '#7a4218', eye: '#1b1b22' },
  raccoon: { body: '#7d7f8c', belly: '#d8d9e0', dark: '#2a2a33', eye: '#1b1b22' },
  bunny: { body: '#d9d2c8', belly: '#f5efe8', dark: '#9c8f84', eye: '#1b1b22' },
  chicken: { body: '#f2ede2', belly: '#ffffff', dark: '#c9b48a', eye: '#1b1b22', comb: '#e23b3b', beak: '#f3b02e' },
  bat: { body: '#4a3f63', belly: '#6b5c8a', dark: '#2a2338', eye: '#1b1b22' },
  crow: { body: '#262633', belly: '#3a3a4c', dark: '#141420', eye: '#1b1b22', beak: '#c9b48a' },
};
const ZOMBIE = { body: '#7f9a6c', belly: '#a9bc8f', dark: '#4f6a45', glow: '#9dff2e' };
const GOLD = { body: '#f2c231', belly: '#ffe48a', dark: '#b8860b', glow: '#fff4b0' };
const HAT_COLORS = ['#ff3cac', '#4dd2ff', '#ffd23f', '#9dff2e', '#c77dff'];

export function paletteFor(kind, { zombie, gold }) {
  const c = COLORS[kind] || COLORS.squirrel;
  if (gold && zombie) return { ...c, ...GOLD };
  if (zombie) return { ...c, body: ZOMBIE.body, belly: ZOMBIE.belly, dark: ZOMBIE.dark, glow: ZOMBIE.glow };
  return c;
}

/** Hit radius (css px) for a critter of size s. */
export const hitRadius = (kind, s) => (AIR[kind] ? s * 0.42 : s * 0.5);

// ---------- drawing ----------
// draw at (x, y): feet for ground critters, body centre for air ones. k = the cure pop (0..1) when just cured.
export function drawCritter(ctx, c, x, y, s, t, lw) {
  const pal = paletteFor(c.kind, { zombie: c.zombie, gold: c.gold });
  const ph = c.ph;
  const pop = c.popT < 0.4 ? popScale(clamp(c.popT / 0.4, 0, 1)) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(c.dir, 1);
  if (c.popT < 0.4) ctx.scale(0.8 + 0.2 * pop, 1.2 - 0.2 * pop);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = lw * 1.2; ctx.strokeStyle = OUT;
  if (c.gold && c.zombie) { ctx.fillStyle = withAlpha('#ffe48a', 0.18 + 0.08 * Math.sin(t * 8)); ctx.beginPath(); ctx.arc(0, AIR[c.kind] ? 0 : -s * 0.35, s * 0.95, 0, TAU); ctx.fill(); }
  if (!AIR[c.kind]) { ctx.fillStyle = withAlpha('#000000', 0.28); ctx.beginPath(); ctx.ellipse(0, 1, s * 0.5, s * 0.12, 0, 0, TAU); ctx.fill(); }
  switch (c.kind) {
    case 'squirrel': squirrel(ctx, pal, s, ph, t, lw, c); break;
    case 'raccoon': raccoon(ctx, pal, s, ph, t, lw, c); break;
    case 'bunny': bunny(ctx, pal, s, ph, t, lw, c); break;
    case 'chicken': chicken(ctx, pal, s, ph, t, lw, c); break;
    case 'bat': bat(ctx, pal, s, ph, t, lw, c); break;
    default: crow(ctx, pal, s, ph, t, lw, c); break;
  }
  ctx.restore();
}

// the zombie eye: one glowing eye with a halo; cured: a round eye with a shine
function eye(ctx, pal, x, y, r, t, c) {
  if (c.zombie) {
    const g = 0.75 + 0.25 * Math.sin(t * 7 + c.seed);
    ctx.fillStyle = withAlpha(pal.glow, 0.3 * g); ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.4, 0, TAU); ctx.fill();
    // the other eye squinted shut
    ctx.beginPath(); ctx.moveTo(x - r * 3.2, y - r * 0.2); ctx.lineTo(x - r * 1.7, y); ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.eye; ctx.beginPath(); ctx.arc(x + r * 0.3, y, r * 0.45, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.3, r * 0.15, 0, TAU); ctx.fill();
  }
}
// the party hat on a cured critter: a cone with a pompom, at (x, y) = the top of the head
function partyHat(ctx, x, y, s, c, lw) {
  const col = HAT_COLORS[c.seed % HAT_COLORS.length];
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2);
  ctx.fillStyle = col; ctx.lineWidth = lw * 1.1;
  ctx.beginPath(); ctx.moveTo(-s * 0.22, 0); ctx.lineTo(0, -s * 0.5); ctx.lineTo(s * 0.22, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-s * 0.15, -s * 0.2, s * 0.3, s * 0.05);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -s * 0.52, s * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// a stitched patch on zombie fur
function patch(ctx, pal, x, y, s, lw) {
  ctx.fillStyle = shade(pal.body, -0.25); ctx.fillRect(x, y, s * 0.16, s * 0.12);
  ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(x, y + s * 0.03); ctx.lineTo(x + s * 0.16, y + s * 0.03); ctx.moveTo(x, y + s * 0.09); ctx.lineTo(x + s * 0.16, y + s * 0.09); ctx.stroke(); ctx.lineWidth = lw * 1.2;
}
// legs: two running legs with a limp when zombie (the back leg drags)
function legs(ctx, pal, s, ph, c, lw, back = -0.2, front = 0.2, len = 0.22) {
  const z = c.zombie;
  const a1 = Math.sin(ph) * 0.6, a2 = -Math.sin(ph) * 0.6;
  ctx.fillStyle = pal.dark;
  ctx.save(); ctx.translate(back * s, -s * 0.1); ctx.rotate(z ? 0.5 + a1 * 0.3 : a1); roundRect(ctx, -s * 0.05, 0, s * 0.1, s * len, s * 0.04); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(front * s, -s * 0.1); ctx.rotate(a2); roundRect(ctx, -s * 0.05, 0, s * 0.1, s * len, s * 0.04); ctx.fill(); ctx.stroke(); ctx.restore();
}

function squirrel(ctx, pal, s, ph, t, lw, c) {
  const bob = Math.abs(Math.sin(ph)) * s * (c.zombie ? 0.05 : 0.12);
  ctx.translate(0, -bob);
  // the big tail curling up behind
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2); ctx.quadraticCurveTo(-s * 0.75, -s * 0.3, -s * 0.6, -s * 0.75); ctx.quadraticCurveTo(-s * 0.45, -s * 1.0, -s * 0.2, -s * 0.8); ctx.quadraticCurveTo(-s * 0.3, -s * 0.55, -s * 0.22, -s * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (c.zombie) { ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.5); ctx.lineTo(-s * 0.7, -s * 0.62); ctx.lineTo(-s * 0.56, -s * 0.6); ctx.closePath(); ctx.fill(); }
  legs(ctx, pal, s, ph, c, lw, -0.18, 0.18, 0.2);
  // body
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(0, -s * 0.3, s * 0.36, s * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.24, s * 0.2, s * 0.12, 0, 0, TAU); ctx.fill();
  if (c.zombie) patch(ctx, pal, -s * 0.2, -s * 0.42, s, lw);
  // head with ears
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.moveTo(s * 0.26, -s * 0.62); ctx.lineTo(s * 0.3, -s * 0.8); ctx.lineTo(s * 0.4, -s * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.36, -s * 0.5, s * 0.18, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.44, s * 0.07, 0, TAU); ctx.fill();
  eye(ctx, pal, s * 0.42, -s * 0.54, s * 0.05, t, c);
  if (!c.zombie) partyHat(ctx, s * 0.36, -s * 0.68, s, c, lw);
}
function raccoon(ctx, pal, s, ph, t, lw, c) {
  const bob = Math.abs(Math.sin(ph)) * s * (c.zombie ? 0.04 : 0.08);
  ctx.translate(0, -bob);
  // striped tail
  ctx.fillStyle = pal.body;
  ctx.save(); ctx.translate(-s * 0.36, -s * 0.3); ctx.rotate(-0.5 + Math.sin(ph) * 0.1);
  roundRect(ctx, -s * 0.45, -s * 0.09, s * 0.5, s * 0.18, s * 0.09); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.dark; for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.4 + i * s * 0.14, -s * 0.07, s * 0.06, s * 0.14);
  ctx.restore();
  legs(ctx, pal, s, ph, c, lw, -0.2, 0.2, 0.2);
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.4, s * 0.26, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.ellipse(s * 0.04, -s * 0.24, s * 0.22, s * 0.12, 0, 0, TAU); ctx.fill();
  if (c.zombie) patch(ctx, pal, -s * 0.25, -s * 0.45, s, lw);
  // head: round with small ears and the bandit mask
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.66, s * 0.08, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.66, s * 0.08, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.38, -s * 0.52, s * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(s * 0.4, -s * 0.54, s * 0.19, s * 0.07, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.ellipse(s * 0.5, -s * 0.44, s * 0.08, s * 0.05, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(s * 0.57, -s * 0.45, s * 0.03, 0, TAU); ctx.fill();
  eye(ctx, pal, s * 0.46, -s * 0.55, s * 0.045, t, c);
  if (!c.zombie) partyHat(ctx, s * 0.38, -s * 0.7, s, c, lw);
}
function bunny(ctx, pal, s, ph, t, lw, c) {
  // hops: a big bounce on the run phase
  const hop = Math.max(0, Math.sin(ph)) * s * (c.zombie ? 0.08 : 0.22);
  ctx.translate(0, -hop);
  legs(ctx, pal, s, ph, c, lw, -0.14, 0.16, 0.16);
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(0, -s * 0.3, s * 0.34, s * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.32, s * 0.09, 0, TAU); ctx.fill(); ctx.stroke(); // cotton tail
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.ellipse(s * 0.04, -s * 0.22, s * 0.18, s * 0.1, 0, 0, TAU); ctx.fill();
  if (c.zombie) patch(ctx, pal, -s * 0.15, -s * 0.42, s, lw);
  // head + long ears (one flops when zombie)
  ctx.fillStyle = pal.body;
  ctx.save(); ctx.translate(s * 0.28, -s * 0.62); ctx.rotate(c.zombie ? 0.9 : -0.25); roundRect(ctx, -s * 0.06, -s * 0.42, s * 0.12, s * 0.44, s * 0.06); ctx.fill(); ctx.stroke(); ctx.fillStyle = withAlpha('#ff9fb6', 0.6); roundRect(ctx, -s * 0.03, -s * 0.36, s * 0.06, s * 0.3, s * 0.03); ctx.fill(); ctx.restore();
  ctx.fillStyle = pal.body;
  ctx.save(); ctx.translate(s * 0.38, -s * 0.62); ctx.rotate(0.15); roundRect(ctx, -s * 0.06, -s * 0.42, s * 0.12, s * 0.44, s * 0.06); ctx.fill(); ctx.stroke(); ctx.fillStyle = withAlpha('#ff9fb6', 0.6); roundRect(ctx, -s * 0.03, -s * 0.36, s * 0.06, s * 0.3, s * 0.03); ctx.fill(); ctx.restore();
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.arc(s * 0.34, -s * 0.52, s * 0.19, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9fb6'; ctx.beginPath(); ctx.arc(s * 0.52, -s * 0.48, s * 0.03, 0, TAU); ctx.fill();
  // buck teeth
  ctx.fillStyle = '#ffffff'; ctx.fillRect(s * 0.44, -s * 0.42, s * 0.05, s * 0.06); ctx.strokeRect(s * 0.44, -s * 0.42, s * 0.05, s * 0.06);
  eye(ctx, pal, s * 0.42, -s * 0.56, s * 0.045, t, c);
  if (!c.zombie) partyHat(ctx, s * 0.2, -s * 0.72, s * 0.8, c, lw);
}
function chicken(ctx, pal, s, ph, t, lw, c) {
  const bob = Math.abs(Math.sin(ph * 1.3)) * s * (c.zombie ? 0.04 : 0.09);
  ctx.translate(0, -bob);
  // stick legs
  ctx.strokeStyle = '#f3b02e'; ctx.lineWidth = lw * 1.6;
  for (const [bx, a] of [[-s * 0.08, Math.sin(ph) * 0.6 + (c.zombie ? 0.4 : 0)], [s * 0.1, -Math.sin(ph) * 0.6]]) {
    ctx.save(); ctx.translate(bx, -s * 0.16); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.18); ctx.moveTo(-s * 0.06, s * 0.18); ctx.lineTo(s * 0.07, s * 0.18); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.2;
  // body + tail feathers
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.4); ctx.lineTo(-s * 0.5, -s * 0.62); ctx.lineTo(-s * 0.36, -s * 0.36); ctx.lineTo(-s * 0.52, -s * 0.48); ctx.lineTo(-s * 0.3, -s * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -s * 0.36, s * 0.34, s * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // wing (flaps a little)
  ctx.fillStyle = pal.dark; ctx.save(); ctx.translate(-s * 0.02, -s * 0.42); ctx.rotate(Math.sin(ph * 2) * 0.15); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.2, s * 0.1, 0.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  if (c.zombie) patch(ctx, pal, s * 0.05, -s * 0.5, s, lw);
  // neck + head
  ctx.fillStyle = pal.body; roundRect(ctx, s * 0.22, -s * 0.78, s * 0.16, s * 0.4, s * 0.07); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.32, -s * 0.76, s * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.comb || '#e23b3b'; ctx.beginPath(); ctx.moveTo(s * 0.22, -s * 0.86); ctx.lineTo(s * 0.26, -s * 1.0); ctx.lineTo(s * 0.32, -s * 0.9); ctx.lineTo(s * 0.37, -s * 1.02); ctx.lineTo(s * 0.42, -s * 0.86); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.beak || '#f3b02e'; ctx.beginPath(); ctx.moveTo(s * 0.45, -s * 0.78); ctx.lineTo(s * 0.62, -s * 0.72); ctx.lineTo(s * 0.45, -s * 0.66); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e23b3b'; ctx.beginPath(); ctx.ellipse(s * 0.44, -s * 0.62, s * 0.04, s * 0.06, 0, 0, TAU); ctx.fill();
  eye(ctx, pal, s * 0.36, -s * 0.8, s * 0.04, t, c);
  if (!c.zombie) partyHat(ctx, s * 0.32, -s * 0.98, s * 0.7, c, lw);
}
function bat(ctx, pal, s, ph, t, lw, c) {
  const flap = Math.sin(ph * 2.2) * (c.zombie ? 0.45 : 0.6);
  // wings
  ctx.fillStyle = pal.body;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1); ctx.translate(s * 0.12, -s * 0.05); ctx.rotate(-flap * 0.6);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.5, -s * 0.28); ctx.lineTo(s * 0.68, -s * 0.05); ctx.lineTo(s * 0.5, s * 0.1); ctx.lineTo(s * 0.32, s * 0.02); ctx.lineTo(s * 0.18, s * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (c.zombie && side === -1) { ctx.fillStyle = withAlpha(OUT, 0.5); ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.05, s * 0.06, 0, TAU); ctx.fill(); ctx.fillStyle = pal.body; } // a hole in the wing
    ctx.restore();
  }
  // body + ears
  ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16, s * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.16); ctx.lineTo(-s * 0.14, -s * 0.36); ctx.lineTo(-s * 0.02, -s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.16); ctx.lineTo(s * 0.14, -s * 0.36); ctx.lineTo(s * 0.02, -s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.13, 0, TAU); ctx.fill(); ctx.stroke();
  // fangs
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.02); ctx.lineTo(-s * 0.03, s * 0.05); ctx.lineTo(-s * 0.01, -s * 0.02); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.02); ctx.lineTo(s * 0.03, s * 0.05); ctx.lineTo(s * 0.01, -s * 0.02); ctx.closePath(); ctx.fill();
  eye(ctx, pal, s * 0.05, -s * 0.12, s * 0.035, t, c);
  if (!c.zombie) partyHat(ctx, 0, -s * 0.24, s * 0.6, c, lw);
}
function crow(ctx, pal, s, ph, t, lw, c) {
  const flap = Math.sin(ph * 2) * (c.zombie ? 0.4 : 0.55);
  // tail
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.5, -s * 0.1); ctx.lineTo(-s * 0.5, s * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  // wings
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(-s * 0.02, -s * 0.02); ctx.rotate(flap * side * 0.8);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.1, -s * 0.4 * side, -s * 0.05, -s * 0.5 * side); ctx.lineTo(s * 0.22, -s * 0.46 * side); ctx.quadraticCurveTo(s * 0.18, -s * 0.2 * side, s * 0.2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (c.zombie && side === 1) { ctx.fillStyle = pal.dark; ctx.fillRect(s * 0.02, -s * 0.3, s * 0.08, s * 0.06); ctx.fillStyle = pal.body; }
    ctx.restore();
  }
  // body + head + beak
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.28, s * 0.16, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.26, -s * 0.1, s * 0.13, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.beak || '#c9b48a'; ctx.beginPath(); ctx.moveTo(s * 0.36, -s * 0.12); ctx.lineTo(s * 0.58, -s * 0.06); ctx.lineTo(s * 0.36, -s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
  eye(ctx, pal, s * 0.28, -s * 0.13, s * 0.035, t, c);
  if (!c.zombie) partyHat(ctx, s * 0.26, -s * 0.24, s * 0.6, c, lw);
}
