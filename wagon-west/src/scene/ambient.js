// Wagon West v1.4 ambient trail-fact vignettes (SPEC §1.6 and §4.1, scene stream): scene.ambient(kind) plays a 5-6 s
// vignette over the trail, then emits { type: 'ambientEnd', kind }. They do not own the pointer; the app puts the fact
// on a card afterwards and plays the sound (Sfx.ambient) itself.
//   crack     a far tree line and a flock of birds lifting, three times; NOTHING else is drawn (no person, no weapon,
//             no smoke: only trees and birds, the smoke test checks the list of what was drawn)
//   grizzly   a small bear (<= 7 % of the height) on a far ridge, feet always above 45 % of the height, sniffing the
//             wind, then ambling off; never nearer. The wagon halts, the dog gives his woof and sits close.
//   wolves    dusk: the moon and three tiny howling silhouettes on a far ridge
//   fireglow  dusk: a soft orange band along the horizon, no flames
//   pronghorn three pronghorn run alongside the wagon, then zoom ahead and leave it in the dust
// The far ridge is painted by the vignette itself (a hazy line behind the near hills) so it reads on every biome.

import { TAU, OUT, clamp, lerp, ease, mulberry32 } from './util.js';
import { drawCritter } from './sprites.js';
import { drawBird, drawBear, drawWolf } from './sprites14.js';

export const AMBIENT_KINDS = ['crack', 'grizzly', 'wolves', 'fireglow', 'pronghorn'];
export const DUR = { crack: 5.5, grizzly: 6.2, wolves: 6, fireglow: 6, pronghorn: 5.8 };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the far ridge: 0.446 H at the very most (feet on it are always above 45 % of the height), a hump about 0.7 W
export function ridgeY(L, x) {
  const u = x / L.W;
  const bump = Math.exp(-(((u - 0.7) / 0.2) ** 2));
  return L.H * (0.58 - 0.134 * smooth(0.28, 0.58, u) - 0.026 * bump);
}
// the ridge fades in from nothing on its left so it never shows an edge (rgb: 'r,g,b')
function ridgePath(c, L, rgb, a) {
  c.beginPath(); c.moveTo(L.W * 0.26, L.H * 0.66);
  for (let x = L.W * 0.26; x <= L.W + 8; x += 8) c.lineTo(x, ridgeY(L, x));
  c.lineTo(L.W + 8, L.H * 0.66); c.closePath();
  const g = c.createLinearGradient(L.W * 0.26, 0, L.W * 0.55, 0);
  g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(1, 'rgba(' + rgb + ',' + a + ')');
  c.fillStyle = g; c.fill();
}

export function createAmbient(kindIn, emit, S, hooks) {
  const kind = AMBIENT_KINDS.includes(kindIn) ? kindIn : 'crack';
  const rand = mulberry32((0xa11b ^ (AMBIENT_KINDS.indexOf(kind) + 1) * 977) >>> 0);
  const M = { kind: 'ambient', what: kind, view: 'keep', input: false, done: false, t: 0, halt: kind === 'grizzly' || kind === 'wolves' || kind === 'fireglow', sent: false, drawn: [], bear: null, barked: false };
  const dur = DUR[kind];
  const add = (n) => { if (!M.drawn.includes(n)) M.drawn.push(n); };
  // the dog sits close during the grizzly (the woof is the engine's bark)
  M.dogPose = kind === 'grizzly' ? (L) => {
    const k = L.k;
    return { x: S.wagonX + 160 * k, y: L.gy + 30 * k, dir: 1, sit: M.t > 0.9, amp: M.t > 0.9 ? 0 : S.walkAmp > 0.05 ? 1 : 0, ph: null, sc: 1 };
  } : null;
  if (!M.dogPose) delete M.dogPose;

  // ---- crack: three flocks lift from a far tree line
  const flocks = [0.7, 1.9, 3.1].map((at, i) => ({ at, x: 0.58 + i * 0.12 + rand() * 0.04, n: S.rm ? 6 : 11 + (i % 2) * 3, birds: [] }));
  for (const f of flocks) for (let i = 0; i < f.n; i++) f.birds.push({ dx: (rand() - 0.5) * 0.07, v: 0.7 + rand() * 0.6, a: -0.9 - rand() * 0.9, ph: rand() * 6, d: rand() * 0.35 });
  const treeLine = (c, L) => {
    const k = L.k, y = L.H * 0.585;
    c.fillStyle = 'rgba(70,98,84,0.9)';
    c.beginPath();
    const r = mulberry32(51);
    for (let x = L.W * 0.5; x < L.W + 10; x += 9 * k) { const ramp = Math.min(1, (x - L.W * 0.5) / (L.W * 0.12)), h = (9 + r() * 9) * k * ramp, w = (6 + r() * 4) * k * Math.max(0.3, ramp); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.9, y - h, x, y - h * 1.15); c.quadraticCurveTo(x + w * 0.9, y - h, x + w, y); }
    c.fill();
    c.fillRect(L.W * 0.6, y - 1.5 * k, L.W * 0.42, 3 * k);
    add('trees');
  };

  // ---- the bear's walk along the ridge (feet on it); head 0..1 lifts the nose
  const bearPose = (L) => {
    const t = M.t, k = L.k;
    const s = (L.H * 0.06) / 34, x0 = L.W * 0.84, xs = L.W * 0.7, x1 = L.W + 60 * k;
    let x, dir, head = 0, walking = true, vis = 1;
    if (t < 1.1) { x = lerp(x0 + 80 * k, xs, ease(t / 1.1)); dir = -1; }
    else if (t < 4.0) { x = xs; dir = -1; head = ease(clamp((t - 1.1) / 0.5, 0, 1)) * (1 - ease(clamp((t - 3.7) / 0.3, 0, 1))); walking = false; }
    else { x = lerp(xs, x1, ease((t - 4.0) / 2.0)); dir = 1; }
    const y = ridgeY(L, clamp(x, 0, L.W));
    return { x, y, s, dir, head: head + (walking ? 0 : Math.sin(t * 3.2) * 0.1 * head), walking, vis };
  };

  M.drawSky = (c, L) => {
    if (kind === 'wolves') {
      const x = L.W * 0.64, y = L.H * 0.27, r = L.H * 0.075;
      c.beginPath(); c.arc(x, y, r * 1.9, 0, TAU); c.fillStyle = 'rgba(255,244,200,0.18)'; c.fill();
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#fff4cc'; c.fill();
      c.beginPath(); c.arc(x + r * 0.3, y - r * 0.2, r * 0.22, 0, TAU); c.arc(x - r * 0.35, y + r * 0.3, r * 0.15, 0, TAU); c.fillStyle = 'rgba(210,190,140,0.55)'; c.fill();
    }
  };
  M.drawFar = (c, L, t, rm) => {
    const k = L.k;
    if (kind === 'crack') {
      treeLine(c, L);
      for (const f of flocks) {
        const u = t - f.at;
        if (u < 0 || u > 3) continue;
        for (const b of f.birds) {
          const uu = u - b.d; if (uu < 0) continue;
          const x = (f.x + b.dx) * L.W + Math.cos(b.a) * 90 * k * uu * b.v, y = L.H * 0.57 + Math.sin(b.a) * 120 * k * uu * b.v + 6 * k * uu * uu * 4;
          c.globalAlpha = clamp(1 - uu / 2.6, 0, 1);
          drawBird(c, x, y, k * 0.85, (rm ? 0 : t * 14) + b.ph);
        }
        c.globalAlpha = 1; add('birds');
      }
    } else if (kind === 'grizzly' || kind === 'wolves') {
      const wolves = kind === 'wolves';
      ridgePath(c, L, wolves ? '38,42,78' : '104,126,116', wolves ? 0.95 : 0.9);
      c.beginPath(); c.moveTo(L.W * 0.3, ridgeY(L, L.W * 0.3));
      for (let x = L.W * 0.3; x <= L.W + 8; x += 8) c.lineTo(x, ridgeY(L, x));
      const lg = c.createLinearGradient(L.W * 0.3, 0, L.W * 0.58, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, wolves ? 'rgba(18,20,44,0.8)' : 'rgba(70,90,80,0.8)');
      c.lineWidth = 1.6 * k; c.strokeStyle = lg; c.stroke();
      if (wolves) {
        const s = (L.H * 0.05) / 26;
        [[0.58, 0], [0.655, 0.55], [0.73, 1.1]].forEach(([u, off], i) => {
          const x = u * L.W, h = ease(clamp((t - 0.5 - off) / 0.7, 0, 1)) * (1 - ease(clamp((t - 4.6 - off * 0.4) / 0.8, 0, 1)));
          drawWolf(c, x, ridgeY(L, x) + 1, s * (0.9 + (i % 2) * 0.12), h * (0.85 + 0.15 * Math.sin(t * 1.7 + i)));
        });
        add('wolves');
      } else {
        const b = bearPose(L);
        if (b.x < L.W + 60 * k) { drawBear(c, b.x, b.y, b.s, rm ? 0 : t * (b.walking ? 5 : 0), b.head, b.dir); }
        M.bear = { x0: b.x - 24 * b.s, x1: b.x + 38 * b.s, y1: b.y, y0: b.y - 36 * b.s };
        add('bear');
      }
    } else if (kind === 'fireglow') {
      // the orange band: brightest in the middle of the vignette, never any flame
      const a = Math.sin(clamp(t / dur, 0, 1) * Math.PI) * (rm ? 0.8 : 0.85 + 0.12 * Math.sin(t * 2.3));
      const y = L.H * 0.56;
      const g = c.createLinearGradient(0, y - L.H * 0.16, 0, y + L.H * 0.03);
      g.addColorStop(0, 'rgba(255,140,50,0)'); g.addColorStop(0.7, 'rgba(255,150,60,' + (0.6 * a) + ')'); g.addColorStop(1, 'rgba(255,110,40,' + (0.5 * a) + ')');
      c.fillStyle = g; c.fillRect(0, y - L.H * 0.16, L.W, L.H * 0.19);
      const rg = c.createRadialGradient(L.W * 0.78, y, 4 * k, L.W * 0.78, y, L.W * 0.3);
      rg.addColorStop(0, 'rgba(255,190,90,' + (0.5 * a) + ')'); rg.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = rg; c.fillRect(L.W * 0.4, y - L.H * 0.3, L.W * 0.6, L.H * 0.34);
      add('glow');
    }
  };

  // ---- pronghorn: three racers alongside, then ahead (in front of the party)
  const racers = [0, 1, 2].map((i) => ({ i, ph: rand() * 6, dy: (i - 1) * 9, dx: -i * 52 + rand() * 12 }));
  const dust = [];
  M.drawOver = kind === 'pronghorn' ? (c, L, t, rm) => {
    const k = L.k, hx = S.wagonX + 120 * k;
    for (const r of racers) {
      const u = t - r.i * 0.12;
      let x;
      if (u < 1.9) x = lerp(-140 * k, hx + r.dx * k, ease(clamp(u / 1.9, 0, 1)));
      else if (u < 3.3) x = hx + r.dx * k + (rm ? 0 : Math.sin(u * 5 + r.ph) * 5 * k) + (u - 1.9) * 16 * k;
      else x = hx + r.dx * k + 22 * k + (u - 3.3) * (u - 3.3) * 260 * k + (u - 3.3) * 140 * k;
      const y = L.gy + (14 + r.dy) * k;
      if (x > L.W + 140 * k) continue;
      if (!rm && (r.i + Math.floor(t * 14)) % 3 === 0 && dust.length < 60) dust.push({ x: x - 40 * k, y: y - 4 * k, t: 0 });
      drawCritter(c, 'pronghorn', x, y, k * 0.78, 1, (rm ? 0 : t * 11) + r.ph);
    }
    c.fillStyle = '#e8d4a8';
    for (const d of dust) { d.t += 1 / 60; c.globalAlpha = clamp(0.5 - d.t * 0.7, 0, 0.5); c.beginPath(); c.arc(d.x, d.y - d.t * 14 * k, (3 + d.t * 16) * k, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t > 0.8) dust.splice(i, 1);
    add('pronghorn');
  } : null;
  if (!M.drawOver) delete M.drawOver;

  M.update = (L, dt) => {
    M.t += dt;
    if (kind === 'grizzly') { const b = bearPose(L); M.bear = { x0: b.x - 24 * b.s, x1: b.x + 38 * b.s, y1: b.y, y0: b.y - 36 * b.s }; }
    if (kind === 'grizzly' && !M.barked && M.t >= 1.3) { M.barked = true; hooks.bark(); }
    if (!M.sent && M.t >= dur) { M.sent = true; M.done = true; emit({ type: 'ambientEnd', kind }); }
  };
  M.state = () => ({ kind: 'ambient', what: kind, phase: M.t < dur ? 'play' : 'end', t: Math.round(M.t * 100) / 100 });
  M.summary = () => ({ kind, finished: M.sent });
  M.debug = (L) => ({ ...M.state(), drawn: M.drawn.slice(), bear: M.bear ? { ...M.bear, hFrac: (M.bear.y1 - M.bear.y0) / L.H, feetFrac: M.bear.y1 / L.H } : null, H: L.H });
  void OUT;
  return M;
}
