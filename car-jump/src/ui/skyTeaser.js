// The Sky Era teaser (v3.10): a full-screen canvas overlay that shows a 9-10 year old what is coming next and how to get
// there. Nothing in it is a promise with a date, a timer or a countdown; skipping it costs nothing.
//
// Full version (~25 s, 3 beats; every scene is a pure function of the time t, so seek(t) can draw any moment):
//   Beat 1 "Hook"   0-6 s   the title's own scene (index.html #backdrop, redrawn with Path2D in its viewBox units) and the
//                           player's car (paintCar + the equipped look): it rolls down the ramp, launches, and keeps rising
//                           past the top; the camera follows, the dusk sky deepens, the cloud layer tears open in light.
//   Beat 2 "Reveal" 6-18 s  the bright sky world above the clouds: floating islands with track pieces, boost rings, a
//                           gravity well that slingshots the car, a second mid-air jump through rings that light up the
//                           child's first name letter by letter, then three dark silhouettes of new rides glide past the sun.
//   Beat 3 "Road"   18-25 s a cloud curtain, then the camera pulls back to the Sky Road: 15 cloud stepping-stones rising to
//                           a gate; the steps walked so far glow and the car sits on its real step; "Sky Road: N / 15".
// Milestone clip (~5.4 s; 7 s at the gate): only the road; the car hops up to its new step with a sparkle.
// Reduced motion: three still frames (one for a clip) with their captions; a tap goes to the next one.
// Spoken lines go through deps.speak(text) (natural-voice clips only; main.js never falls back to the device voice
// here) and every line is also a big caption. Skip: a tap anywhere after 0.5 s, the Skip button, Escape / Enter / Space.
// The rAF loop stops on close; nothing is left running.
import { paintCar } from './carPreview.js';
import { SKY_LINES, SKY_ROAD_STEPS, MILESTONES, roadText, stepLine } from '../meta/skyRoad.js';

const PPM = 40;                          // world units per meter of car (as titleHero)
const DPR_CAP = 1.5;                     // as titleHero
export const FULL_LEN = 25;
export const CLIP_LEN = 5.4;
export const GATE_LEN = 7;
const B2 = 6, B3 = 18;                   // beat starts
const TAU = Math.PI * 2;
const TAP_GRACE = 0.5;                   // a tap in the first half second does not skip (the tap that opened the title)

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbStr = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- sprites (made once, reused: drawImage is far cheaper than a gradient per puff) ----------
const SPRITES = new Map();
function sprite(key, size, paint) {
  let c = SPRITES.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = size;
    paint(c.getContext('2d'), size);
    SPRITES.set(key, c);
  }
  return c;
}
// a soft cloud puff lit from `top` with a `bottom` shade; the circle has radius 0.47 of the sprite
function puffSprite(top, bottom, rim = 'rgba(255,255,255,.55)', soft = 0.8) {
  return sprite(`puff|${top}|${bottom}|${rim}|${soft}`, 128, (g, s) => {
    const r = s * 0.47, c = s / 2;
    const lg = g.createLinearGradient(0, c - r, 0, c + r);
    lg.addColorStop(0, top); lg.addColorStop(0.55, top); lg.addColorStop(1, bottom);
    g.fillStyle = lg; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
    const hl = g.createRadialGradient(c - r * 0.35, c - r * 0.45, 2, c - r * 0.2, c - r * 0.3, r * 0.9);
    hl.addColorStop(0, rim); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(c, c, r * soft, c, c, r);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, s, s);
  });
}
function glowSprite(color) {
  return sprite(`glow|${color}`, 128, (g, s) => {
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    const c = hexRgb(color);
    rg.addColorStop(0, rgbStr(c, 1)); rg.addColorStop(0.25, rgbStr(c, 0.55)); rg.addColorStop(0.6, rgbStr(c, 0.14)); rg.addColorStop(1, rgbStr(c, 0));
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
  });
}
function sparkSprite() {
  return sprite('spark', 64, (g, s) => {
    const c = s / 2;
    const rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,250,220,.9)'); rg.addColorStop(0.45, 'rgba(255,220,140,.25)'); rg.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath(); g.moveTo(c, 2); g.lineTo(c + 2.2, c); g.lineTo(c, s - 2); g.lineTo(c - 2.2, c); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(2, c); g.lineTo(c, c - 2.2); g.lineTo(s - 2, c); g.lineTo(c, c + 2.2); g.closePath(); g.fill();
  });
}

// ---------- the title scene (index.html #backdrop, viewBox 1600×900), extended sideways and down ----------
let TITLE = null;
function titlePaths() {
  if (TITLE || typeof Path2D === 'undefined') return TITLE;
  TITLE = {
    sunClip: (() => { const p = new Path2D(); p.arc(1080, 560, 230, 0, TAU); return p; })(),
    far: new Path2D('M-900 650 L-760 600 L-620 670 L-470 610 L-320 690 L-160 630 L0 700 L120 610 L230 660 L360 560 L470 640 L600 590 L760 680 L900 620 L1040 690 L1200 600 L1340 660 L1480 590 L1600 640 L1740 600 L1880 680 L2030 610 L2180 660 L2330 590 L2500 650 L2500 1500 L-900 1500 Z'),
    near: new Path2D('M-900 740 L-720 700 L-540 750 L-360 705 L-180 760 L0 760 L180 700 L340 740 L520 690 L700 750 L880 715 L1060 770 L1260 720 L1440 760 L1600 730 L1780 700 L1960 760 L2140 715 L2320 750 L2500 720 L2500 1500 L-900 1500 Z'),
    ramp: new Path2D('M-20 300 C 140 300, 330 520, 520 690 L 560 678 L 560 1500 L -20 1500 Z'),
    rampEdge: new Path2D('M-20 300 C 140 300, 330 520, 520 690 L 560 678'),
    land: new Path2D('M760 820 C 1000 790, 1250 800, 1600 780 L 2500 780 L 2500 1500 L 760 1500 Z'),
  };
  return TITLE;
}
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
const dbez = (p0, p1, p2, p3, t) => { const u = 1 - t; return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2); };
const rampAt = (t) => ({ x: bez(-20, 140, 330, 520, t), y: bez(300, 300, 520, 690, t), dx: dbez(-20, 140, 330, 520, t), dy: dbez(300, 300, 520, 690, t) });

// world y → the dusk-to-day sky of beat 1 (y down: 900 is the title's horizon, -3000 is above the clouds)
const SKY1 = [[900, '#ffb13d'], [660, '#ff4f6d'], [460, '#7b2a8c'], [160, '#2a1d78'], [-500, '#2b2286'], [-1100, '#3d2a94'], [-1650, '#5f3499'],
  [-2050, '#9c4b9f'], [-2350, '#e57fa6'], [-2650, '#ffc2b0'], [-2950, '#ffeedd'], [-3600, '#a6dcff'], [-5000, '#5fb4ff']].map(([y, c]) => [y, hexRgb(c)]);
function skyColor(stops, y) {
  if (y >= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y >= stops[i][0]) { const [y0, c0] = stops[i - 1], [y1, c1] = stops[i]; return mixRgb(c0, c1, (y0 - y) / (y0 - y1)); }
  }
  return stops[stops.length - 1][1];
}

// ---------- a time-keyed path (Catmull-Rom through [t, x, y] keys): position and velocity at any t ----------
function makePath(keys) {
  const n = keys.length;
  const tan = keys.map((k, i) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
    const dt = b[0] - a[0] || 1;
    return [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
  });
  return (t) => {
    if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2], vx: tan[0][0], vy: tan[0][1] };
    if (t >= keys[n - 1][0]) return { x: keys[n - 1][1], y: keys[n - 1][2], vx: 0, vy: 0 };
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const [t0, x0, y0] = keys[i], [t1, x1, y1] = keys[i + 1];
    const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
    const [m0x, m0y] = tan[i], [m1x, m1y] = tan[i + 1];
    return {
      x: h00 * x0 + h10 * h * m0x + h01 * x1 + h11 * h * m1x,
      y: h00 * y0 + h10 * h * m0y + h01 * y1 + h11 * h * m1y,
      vx: (d00 * x0 + d10 * h * m0x + d01 * x1 + d11 * h * m1x) / h,
      vy: (d00 * y0 + d10 * h * m0y + d01 * y1 + d11 * h * m1y) / h,
    };
  };
}

function carDims(car) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of car.body) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (const w of car.wheels) { minX = Math.min(minX, w.x - w.r); maxX = Math.max(maxX, w.x + w.r); minY = Math.min(minY, w.y - w.r); maxY = Math.max(maxY, w.y + w.r); }
  return { len: maxX - minX, lift: -Math.min(...car.wheels.map((w) => w.y - w.r)), h: maxY - minY };
}

/**
 * root: the overlay element (index.html #sky-teaser). deps: { audio (src/audio.js), speak(text) → Promise | null (natural
 * voice only; null = no clip: stay silent), stopSpeech(), onClose?(reason) }.
 */
export function createSkyTeaser(root, deps = {}) {
  const audio = deps.audio || null;
  const canvas = document.createElement('canvas');
  canvas.className = 'st-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const skip = document.createElement('button');
  skip.className = 'btn btn-sm st-skip'; skip.id = 'st-skip'; skip.type = 'button'; skip.textContent = 'Skip';
  const badge = document.createElement('div');
  badge.className = 'st-road'; badge.id = 'st-road'; badge.hidden = true;
  const caption = document.createElement('div');
  caption.className = 'st-caption'; caption.id = 'st-caption'; caption.setAttribute('aria-live', 'polite');
  const tapHint = document.createElement('div');
  tapHint.className = 'st-tap'; tapHint.id = 'st-tap'; tapHint.hidden = true; tapHint.textContent = 'Tap to continue';
  const bottom = document.createElement('div');
  bottom.className = 'st-bottom';
  bottom.append(caption, tapHint);
  root.append(canvas, badge, bottom, skip);
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'The Sky Era is coming');
  const ctx = canvas.getContext('2d');

  let W = 1, H = 1, dpr = 1, raf = 0, last = 0, open = false, paused = false, ro = null;
  let t = 0, prevT = 0, len = FULL_LEN, openedAt = 0, frameIdx = 0;
  let P = null;                          // the play's parameters
  let parts = [];                        // particles (world coords of the current scene)
  let partScene = '';
  let shownCaption = null, shownBadge = null;
  let resolveDone = null, speechToken = 0;
  let curScale = 1;                      // world→css scale of the current camera (for line widths)

  // ---------- sizing ----------
  function measure() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function resize() {
    if (!open || !P) return;
    const r = root.getBoundingClientRect();
    if (Math.abs(r.width - W) < 0.5 && Math.abs(r.height - H) < 0.5 && canvas.width > 1) return;
    measure();
    makeBeat2(); layoutRoad();          // both depend on the orientation
    if (paused || P.reduced) draw();
  }
  const portrait = () => H > W * 1.1;
  function cam(cx, cy, sc) {
    curScale = sc;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (W / 2 - cx * sc), dpr * (H / 2 - cy * sc));
  }
  const screen = () => { curScale = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };

  // ---------- particles ----------
  function emit(scene, p) {
    if (partScene !== scene) { parts = []; partScene = scene; }
    if (parts.length < 420) parts.push(p);
  }
  function sparkle(scene, x, y, opt = {}) {
    const a = Math.random() * TAU, sp = (opt.speed || 60) * (0.4 + Math.random());
    emit(scene, { x, y, vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp + (opt.vy || 0), life: 1, decay: opt.decay || (0.9 + Math.random() * 0.8),
      size: (opt.size || 26) * (0.6 + Math.random() * 0.8), g: opt.g == null ? 40 : opt.g, color: opt.color || null, spin: Math.random() * TAU });
  }
  function burst(scene, x, y, n, opt = {}) { for (let i = 0; i < n; i++) sparkle(scene, x, y, opt); }
  function stepParts(dt) {
    for (const p of parts) { p.life -= p.decay * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - 1.2 * dt; }
    parts = parts.filter((p) => p.life > 0);
  }
  function drawParts(scene) {
    if (partScene !== scene || !parts.length) return;
    const spk = sparkSprite();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const s = p.size * (0.5 + 0.5 * p.life);
      ctx.globalAlpha = clamp(p.life * 1.3);
      if (p.color) ctx.drawImage(glowSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
      ctx.drawImage(spk, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }

  // ---------- the car ----------
  function drawCar(x, y, a, k, { spin = 0, alpha = 1, squash = 1, glow = 0 } = {}) {
    if (!P.car) return;
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow;
      const g = P.dims.len * PPM * k * 1.25;
      ctx.drawImage(glowSprite('#7fe8ff'), x - g, y - g * 0.75, g * 2, g * 1.5);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.rotate(a); ctx.scale(PPM * k, -PPM * k * squash);
    try { paintCar(ctx, P.car, 1.6 / (PPM * k * curScale), spin, P.look); } catch (_) { /* a look the painter does not know: stock paint next time */ }
    ctx.restore();
  }

  // ================= Beat 1: the hook =================
  const T_ROLL = 1.25;
  function b1Car(tt) {
    const lift = P.dims.lift * PPM;
    if (tt < T_ROLL) {
      const p = Math.pow(clamp(tt / T_ROLL), 1.7);
      const r = rampAt(lerp(0.06, 1, p));
      const a = Math.atan2(r.dy, r.dx);
      return { x: r.x + Math.sin(a) * lift, y: r.y - Math.cos(a) * lift, a, air: false };
    }
    const u = tt - T_ROLL;
    const x = 560 + 650 * (1 - Math.exp(-1.3 * u));
    const y = 678 - lift - (300 * u + 190 * u * u);
    const a = -0.32 - TAU * smooth(0.15, 1.35, u) - 0.38 * smooth(1.35, 2.4, u);
    return { x, y, a, air: true, vx: 845 * Math.exp(-1.3 * u), vy: -(300 + 380 * u) };
  }
  const b1Scale = () => (portrait() ? W / 1000 : Math.min(W / 1600, H / 740));
  function b1Cam(tt) {
    const s0 = b1Scale();
    const sc = s0 * lerp(1, 1.32, smooth(1.4, 4.2, tt));
    const cx0 = portrait() ? 700 : 800;
    const bottom = (s) => 930 - (H / 2) / s;            // the ground stays at the bottom edge (like xMidYMax slice)
    const c = b1Car(tt);
    const f = smooth(1.15, 2.5, tt);
    const cx = lerp(cx0, lerp(cx0, c.x, 0.7), f);
    const follow = c.y + (H * 0.1) / sc;
    const cy = Math.min(bottom(sc), lerp(bottom(s0), follow, f));
    return { cx, cy, sc, cx0, cy0: bottom(s0) };
  }
  // the cloud band the car breaks through
  let band = null;
  function makeBand() {
    const r = rng(7), back = [], front = [];
    for (let x = -1400; x < 3000; x += 120 + r() * 70) back.push({ x, y: -2680 + r() * 160, r: 150 + r() * 120 });
    for (let x = -1400; x < 3000; x += 150 + r() * 80) front.push({ x, y: -2440 + r() * 150, r: 170 + r() * 140 });
    for (let x = -1400; x < 3000; x += 210 + r() * 90) front.push({ x, y: -2300 + r() * 90, r: 130 + r() * 90 });
    front.sort((a, b) => a.y - b.y);
    const stars = Array.from({ length: 110 }, () => ({ x: -900 + r() * 3400, y: -2300 + r() * 2500, s: 1 + r() * 2.2, ph: r() * TAU }));
    const wisps = Array.from({ length: 26 }, () => ({ x: -700 + r() * 3000, y: -2150 + r() * 1750, w: 260 + r() * 520, h: 46 + r() * 50, p: 0.8 + r() * 0.35, a: 0.35 + r() * 0.35 }))
      .sort((a, b) => a.p - b.p);
    band = { back, front, stars, wisps };
  }
  function drawBeat1(tt) {
    const T = titlePaths();
    const v = b1Cam(tt);
    const layer = (p) => cam(v.cx0 + (v.cx - v.cx0) * p, v.cy0 + (v.cy - v.cy0) * p, v.sc);
    // sky (screen space, sampled by world y)
    cam(v.cx, v.cy, v.sc);
    const yTop = v.cy - H / 2 / v.sc, yBot = v.cy + H / 2 / v.sc;
    screen();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, rgbStr(skyColor(SKY1, lerp(yTop, yBot, i / 8))));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stars, a faint parallax
    layer(0.82);
    const starA = smooth(250, -700, v.cy) * (1 - smooth(-1700, -2300, v.cy));
    if (starA > 0.01) {
      ctx.fillStyle = '#fff';
      for (const s of band.stars) {
        ctx.globalAlpha = starA * (0.45 + 0.55 * Math.sin(tt * 3 + s.ph) ** 2);
        ctx.fillRect(s.x, s.y, s.s / v.sc * 1.2, s.s / v.sc * 1.2);
      }
      ctx.globalAlpha = 1;
    }
    // thin clouds slipping past on the way up (they tell the eye how fast the car climbs)
    const wispA = smooth(1.0, 1.9, tt);
    if (wispA > 0) {
      const ws = puffSprite('#c9a6e6', '#ff9fae', 'rgba(255,235,245,.5)', 0.15);
      for (const w of band.wisps) {
        layer(w.p);
        const ey = v.cy0 + (v.cy - v.cy0) * w.p;
        if (Math.abs(w.y - ey) > H / v.sc) continue;
        ctx.globalAlpha = wispA * w.a * 0.8;
        for (let k = 0; k < 4; k++) {
          const pw = w.w * (0.42 + 0.12 * ((k * 7) % 3)), ph = w.h * (1.3 - 0.25 * Math.abs(k - 1.5));
          ctx.drawImage(ws, w.x - w.w / 2 + (w.w - pw) * (k / 3), w.y - ph / 2 - (k % 2) * w.h * 0.25, pw, ph);
        }
      }
      ctx.globalAlpha = 1;
    }
    // the title's sun and hills (slower layers), the ramp and the landing ground
    if (T && v.cy - H / 2 / v.sc < 1000 && v.cy + H / 2 / v.sc > 250) {
      layer(0.55);
      ctx.save(); ctx.clip(T.sunClip);
      const sg = ctx.createLinearGradient(0, 320, 0, 800); sg.addColorStop(0, '#fff27a'); sg.addColorStop(1, '#ff7a3d');
      ctx.fillStyle = sg; ctx.fillRect(840, 320, 480, 480);
      ctx.fillStyle = 'rgba(255,90,106,.9)';
      for (const [y, h] of [[610, 12], [650, 18], [696, 24], [748, 30]]) ctx.fillRect(840, y, 480, h);
      ctx.restore();
      layer(0.8); ctx.globalAlpha = 0.85; ctx.fillStyle = '#43206e'; ctx.fill(T.far); ctx.globalAlpha = 1;
      layer(0.9); ctx.fillStyle = '#2a1757'; ctx.fill(T.near);
      layer(1);
      ctx.fillStyle = '#0d1230'; ctx.fill(T.ramp);
      ctx.strokeStyle = '#ffcf1a'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke(T.rampEdge);
      ctx.strokeStyle = '#1b2357'; ctx.lineWidth = 10;
      for (const [x, y] of [[80, 330], [220, 410], [360, 540], [480, 650]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, 1500); ctx.stroke(); }
      ctx.fillStyle = '#0d1230'; ctx.fill(T.land);
    }
    // the cloud band: back puffs, light rays through the tear, the car, front puffs
    const c = b1Car(tt);
    const tearX = b1Car(B2 - 1.4).x;
    const open = smooth(4.15, 5.35, tt);
    const shift = (p) => { const d = p.x - tearX; const w = 1 - smooth(500, 1500, Math.abs(d)); return p.x + Math.sign(d || 1) * open * w * (380 + 0.35 * Math.abs(d)); };
    const duskBack = puffSprite('#b58fd6', '#ff9a8a', 'rgba(255,230,240,.5)');
    const duskFront = puffSprite('#d9b5ee', '#ffb08f', 'rgba(255,240,245,.65)');
    const inView = (x, y, r) => x + r > v.cx - W / 2 / v.sc - 50 && x - r < v.cx + W / 2 / v.sc + 50 && y + r > yTop - 50 && y - r < yBot + 50;
    if (yTop < -1900) {
      layer(0.92);
      for (const p of band.back) { const x = shift(p); if (inView(x, p.y, p.r * 1.1)) ctx.drawImage(duskBack, x - p.r * 1.07, p.y - p.r * 1.07, p.r * 2.14, p.r * 2.14); }
    }
    layer(1);
    if (open > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const top = -3500;
      for (let i = 0; i < 9; i++) {
        const ang = (i - 4) * 0.085 + Math.sin(tt * 0.7 + i) * 0.02;
        const w0 = 30 + 40 * open, len = 2600;
        const x0 = tearX + (i - 4) * 40;
        ctx.globalAlpha = open * (0.16 + 0.1 * Math.sin(tt * 2 + i * 1.7) ** 2);
        const rg = ctx.createLinearGradient(x0, top, x0 + Math.sin(ang) * len, top + len);
        rg.addColorStop(0, 'rgba(255,250,225,1)'); rg.addColorStop(1, 'rgba(255,250,225,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.moveTo(x0 - w0 * 0.3, top); ctx.lineTo(x0 + w0 * 0.3, top);
        ctx.lineTo(x0 + Math.sin(ang) * len + w0 * 2.2, top + len); ctx.lineTo(x0 + Math.sin(ang) * len - w0 * 2.2, top + len); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = open;
      const gs = 900 + 700 * open;
      ctx.drawImage(glowSprite('#fff4d6'), tearX - gs, -2620 - gs, gs * 2, gs * 2);
      ctx.restore();
    }
    // wind streaks while rising fast (screen space)
    const wind = smooth(1.9, 2.7, tt) * (1 - smooth(4.9, 5.4, tt));
    if (wind > 0) {
      screen();
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const x = ((i * 0.618 + 0.13) % 1) * W, sp = 900 + (i % 5) * 220, ln = 50 + (i % 4) * 30;
        const y = ((tt * sp + i * 157) % (H + ln * 2)) - ln;
        ctx.globalAlpha = wind * (0.5 + (i % 3) * 0.25); ctx.lineWidth = 1.5 + (i % 3);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + ln); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    layer(1);
    drawParts('b1');
    const glow = c.air ? 0.35 * smooth(1.3, 2.2, tt) : 0;
    drawCar(c.x, c.y, c.a, 1, { spin: tt * 14, glow });
    if (yTop < -1700) {
      layer(1.06);
      for (const p of band.front) { const x = shift(p); if (inView(x, p.y, p.r * 1.1)) ctx.drawImage(duskFront, x - p.r * 1.07, p.y - p.r * 1.07, p.r * 2.14, p.r * 2.14); }
    }
    // vignette (the title's) fading as we rise, then the white burst into beat 2
    screen();
    const vig = 1 - smooth(0.6, 2.4, tt);
    if (vig > 0) {
      const vg = ctx.createRadialGradient(W / 2, H * 0.4, Math.min(W, H) * 0.3, W / 2, H * 0.4, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(8,10,35,0)'); vg.addColorStop(1, `rgba(8,10,35,${0.5 * vig})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    const white = smooth(5.1, 5.95, tt);
    if (white > 0) { ctx.fillStyle = `rgba(255,252,240,${white})`; ctx.fillRect(0, 0, W, H); }
  }
  function updateBeat1(tt, dt) {
    if (tt < T_ROLL + 0.05 || tt > 5.7) return;
    const c = b1Car(tt);
    const n = Math.random() < dt * 55 ? 1 : 0;
    for (let i = 0; i < n + (Math.random() < dt * 30 ? 1 : 0); i++) {
      sparkle('b1', c.x - Math.cos(c.a) * 60 + (Math.random() - 0.5) * 50, c.y + 40, { speed: 50, vy: 260, g: 60, size: 30, color: i ? '#ffcf1a' : '#7fe8ff' });
    }
  }

  // ================= Beat 2: the reveal =================
  let b2 = null;
  function makeBeat2() {
    const lift = P.dims.lift * PPM;
    const TA = 420, TC = 470;                   // track surfaces of island A and island C
    const W0 = { x: 2250, y: 260 };            // the gravity well
    const keys = [[0, 300, 1150], [0.4, 390, 720], [0.85, 520, 360], [1.32, 680, TA - lift - 4], [1.6, 820, TA - lift], [2.15, 1150, TA - lift], [2.62, 1480, TA - lift - 6],
      [2.95, 1760, 450], [3.2, 2010, 560]];
    const th0 = 0.5 * Math.PI, sweep = 2.25 * Math.PI;
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, w = Math.pow(u, 1.3);
      const th = th0 - sweep * w, r = lerp(360, 230, u);
      keys.push([3.45 + 1.45 * u, W0.x + r * Math.cos(th), W0.y + r * Math.sin(th)]);
    }
    keys.push([5.2, 2690, 150], [5.55, 2950, 30], [5.92, 3180, 20], [6.35, 3420, -130], [6.85, 3700, -205], [7.35, 3980, -215], [7.85, 4250, -150],
      [8.3, 4470, 60], [8.75, 4640, TC - lift - 4], [9.3, 4860, TC - lift], [9.9, 4975, TC - lift], [12.5, 4990, TC - lift]);
    const path = makePath(keys);
    // the name rings: evenly by arc length along the second jump's arc, centered on it
    const arc = [];
    let L = 0, prev = path(6.1);
    for (let tt = 6.1; tt <= 7.95; tt += 0.01) { const p = path(tt); L += Math.hypot(p.x - prev.x, p.y - prev.y); arc.push({ tt, L }); prev = p; }
    const n = P.name.length;
    const spacing = Math.min(portrait() ? 135 : 175, (L * 0.9) / Math.max(1, n - 1));
    const used = spacing * (n - 1), startL = (L - used) / 2;
    const rings = [];
    for (let i = 0; i < n; i++) {
      const want = startL + i * spacing;
      const a = arc.find((q) => q.L >= want) || arc[arc.length - 1];
      const p = path(a.tt);
      rings.push({ x: p.x, y: p.y, tt: a.tt, ch: P.name[i] });
    }
    const ringR = clamp(spacing * 0.44, 46, 96);
    const r = rng(11);
    const sea = [0, 1, 2].map((layer) => {
      const out = [];
      for (let x = -1500; x < 7000; x += (layer === 2 ? 210 : 150) + r() * 90) out.push({ x, y: 900 + layer * 110 + r() * 60, r: (layer === 2 ? 210 : 140 + layer * 30) + r() * 90 });
      return out;
    });
    const isles = Array.from({ length: 9 }, (_, i) => ({ x: -200 + i * 760 + r() * 260, y: 120 + r() * 380, w: 140 + r() * 220, p: 0.32 + r() * 0.22 }));
    const bgRings = Array.from({ length: 7 }, (_, i) => ({ x: 300 + i * 820 + r() * 300, y: -80 + r() * 380, r: 50 + r() * 30, p: 0.55 + r() * 0.15, ph: r() * TAU }));
    b2 = { path, rings, ringR, TA, TC, W0, sea, isles, bgRings, lift, ringPass: 2.15 };
  }
  function b2Car(tau) {
    const p = b2.path(tau);
    const ground = smooth(1.25, 1.36, tau) * (1 - smooth(2.58, 2.7, tau)) + smooth(8.68, 8.8, tau);
    const orbit = smooth(3.3, 3.5, tau) * (1 - smooth(4.85, 5.1, tau));
    const va = Math.atan2(p.vy, p.vx);
    let a = lerp(0.55 * va, va, orbit);
    a = lerp(a, 0, clamp(ground));
    a += TAU * smooth(6.0, 7.05, tau);                       // the second jump: a front flip
    if (tau > 8.75) a = Math.sin(clamp((tau - 8.75) / 0.35) * Math.PI) * 0.06;   // landing bob
    return { x: p.x, y: p.y, a, vx: p.vx, vy: p.vy, ground: ground > 0.5 };
  }
  function b2Scale() { return portrait() ? W / 820 : Math.min(W / 1500, H / 850); }
  function b2Cam(tau) {
    const s0 = b2Scale();
    // follow with a little lag (an average of the path just behind), then frame the name rings, then a wide shot for the rides
    let x = 0, y = 0;
    for (let j = 0; j < 8; j++) { const p = b2.path(Math.max(0, tau - j * 0.07)); x += p.x; y += p.y; }
    x /= 8; y /= 8;
    let cx = x, cy = y - 40, z = 1 - 0.14 * smooth(3.0, 3.6, tau) * (1 - smooth(4.9, 5.6, tau));
    const rs = b2.rings, ringsW = rs[rs.length - 1].x - rs[0].x + b2.ringR * 2 + 160;
    const gx = (rs[0].x + rs[rs.length - 1].x) / 2, gy = rs.reduce((s, q) => s + q.y, 0) / rs.length;
    const fitZ = Math.min(1, (W / s0) / ringsW);
    const nameF = smooth(5.7, 6.3, tau) * (1 - smooth(8.3, 8.9, tau));
    cx = lerp(cx, gx, nameF); cy = lerp(cy, gy + 40, nameF); z = lerp(z, Math.max(0.6, fitZ), nameF);
    const wide = smooth(8.7, 9.6, tau);
    cx = lerp(cx, (portrait() ? 4990 : 5250) + (tau - 9) * 22, wide); cy = lerp(cy, 230, wide); z = lerp(z, portrait() ? 0.82 : 0.88, wide);
    const sc = s0 * z;
    cy = Math.min(cy, 1040 - (H / 2) / sc);                  // keep the cloud sea at the bottom edge
    return { cx, cy, sc };
  }
  const SKY2 = [[0, '#2a64d8'], [0.45, '#5fb2fa'], [0.78, '#bfe6ff'], [1, '#fff1d2']];
  function drawIsland(x0, x1, top, { tip = 0.55, track = true, alpha = 1, hazy = 0, seed = 1 } = {}) {
    const r = rng(seed), w = x1 - x0, bottom = top + w * tip, k = clamp(w / 1000, 0.18, 1);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(x0, top);
    const n = 9;
    for (let i = 1; i < n; i++) {
      const u = i / n, x = x0 + w * u, d = Math.sin(u * Math.PI);
      ctx.lineTo(x + (r() - 0.5) * w * 0.05, top + (bottom - top) * d * (0.55 + r() * 0.5) * (u > 0.4 && u < 0.6 ? 1.15 : 1));
    }
    ctx.lineTo(x1, top); ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    const c1 = mixRgb(hexRgb('#7a63e0'), hexRgb('#b9d8ff'), hazy), c2 = mixRgb(hexRgb('#241a63'), hexRgb('#8fb6ec'), hazy);
    g.addColorStop(0, rgbStr(c1)); g.addColorStop(1, rgbStr(c2));
    ctx.fillStyle = g; ctx.fill();
    // a lit top band and crystals underneath
    ctx.fillStyle = rgbStr(mixRgb(hexRgb('#45e6c4'), hexRgb('#d6f6ff'), hazy)); ctx.fillRect(x0, top - 6 * k, w, 16 * k);
    ctx.fillStyle = rgbStr(mixRgb(hexRgb('#2bb8a6'), hexRgb('#c3e6f5'), hazy)); ctx.fillRect(x0, top + 10 * k, w, 6 * k);
    if (!hazy) {
      for (let i = 0; i < 4; i++) {
        const cx = x0 + w * (0.25 + i * 0.17), cy = top + (bottom - top) * (0.35 + (i % 2) * 0.18);
        ctx.fillStyle = 'rgba(127,232,255,.85)';
        ctx.beginPath(); ctx.moveTo(cx, cy - 26 * k); ctx.lineTo(cx + 11 * k, cy); ctx.lineTo(cx, cy + 20 * k); ctx.lineTo(cx - 11 * k, cy); ctx.closePath(); ctx.fill();
      }
    }
    if (track) {
      ctx.fillStyle = '#151a44'; ctx.fillRect(x0 + 10 * k, top - 22 * k, w - 20 * k, 22 * k);
      ctx.fillStyle = '#ffcf1a'; ctx.fillRect(x0 + 10 * k, top - 26 * k, w - 20 * k, 6 * k);
      ctx.fillStyle = 'rgba(127,232,255,.9)';
      for (let x = x0 + 30 * k; x < x1 - 40 * k; x += 70 * k) ctx.fillRect(x, top - 13 * k, 34 * k, 4 * k);
    }
    ctx.restore();
  }
  function drawRingShape(x, y, r, { lit = 0, color = '#7fe8ff', width = 14, half = 0 } = {}) {
    // half: 0 = whole ring, 1 = back half (behind the car), 2 = front half
    const col = lit > 0 ? mixRgb(hexRgb(color), hexRgb('#ffcf1a'), lit) : hexRgb(color);
    if (half !== 2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.65 * lit;
      const gs = r * (2.1 + lit * 0.6);
      ctx.drawImage(glowSprite(lit > 0.5 ? '#ffcf1a' : color), x - gs, y - gs, gs * 2, gs * 2);
      ctx.restore();
    }
    ctx.lineWidth = width; ctx.strokeStyle = rgbStr(col);
    ctx.beginPath();
    if (half === 0) ctx.arc(x, y, r, 0, TAU);
    else if (half === 1) ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
    else ctx.arc(x, y, r, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.lineWidth = width * 0.35; ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.stroke();
  }
  function drawWell(tau) {
    const { x, y } = b2.W0, R = 420;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7; ctx.drawImage(glowSprite('#8f6bff'), x - R * 1.4, y - R * 1.4, R * 2.8, R * 2.8);
    ctx.lineCap = 'round';
    const rot = tau * 2.2;
    for (let k = 0; k < 4; k++) {
      for (let s = 0; s < 22; s++) {
        const u0 = s / 22, u1 = (s + 1) / 22;
        const r0 = lerp(R * 0.95, 30, u0), r1 = lerp(R * 0.95, 30, u1);
        const a0 = rot + k * Math.PI / 2 + u0 * 4.2, a1 = rot + k * Math.PI / 2 + u1 * 4.2;
        ctx.strokeStyle = k % 2 ? `rgba(127,232,255,${0.08 + 0.5 * u0})` : `rgba(200,150,255,${0.08 + 0.5 * u0})`;
        ctx.lineWidth = 6 + 14 * (1 - u0);
        ctx.beginPath(); ctx.moveTo(x + r0 * Math.cos(a0), y + r0 * Math.sin(a0)); ctx.lineTo(x + r1 * Math.cos(a1), y + r1 * Math.sin(a1)); ctx.stroke();
      }
    }
    const spk = sparkSprite();
    for (let i = 0; i < 46; i++) {
      const ph = (i / 46 + tau * 0.32) % 1;
      const rr = (R * 1.05) * Math.pow(1 - ph, 1.25) + 26, an = i * 2.39 + ph * 7 + rot * 0.4;
      ctx.globalAlpha = clamp(ph * (1 - ph) * 4);
      const s = 18 + 16 * (1 - ph);
      ctx.drawImage(spk, x + rr * Math.cos(an) - s / 2, y + rr * Math.sin(an) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(glowSprite('#e9d9ff'), x - 150, y - 150, 300, 300);
    ctx.restore();
    ctx.fillStyle = '#120a33'; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(220,190,255,.95)'; ctx.stroke();
  }
  // the three new rides, as dark shapes with a rim of sunlight; positions are in screen units (u = min(W, H))
  function drawRide(kind, x, y, u, tt) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(u, u);
    const fill = 'rgba(10,12,40,.94)', rim = 'rgba(255,236,190,.85)';
    ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 0.012; ctx.lineJoin = 'round';
    const shape = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const [a, b] of pts.slice(1)) ctx.lineTo(a, b); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    if (kind === 'bike') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(tt * 18);
      ctx.drawImage(glowSprite('#7fe8ff'), -0.24, 0.02, 0.2, 0.12); ctx.drawImage(glowSprite('#7fe8ff'), 0.06, 0.02, 0.2, 0.12);
      ctx.restore();
      shape([[-0.28, 0.0], [-0.2, -0.045], [-0.02, -0.06], [0.08, -0.1], [0.15, -0.1], [0.17, -0.06], [0.3, -0.02], [0.27, 0.03], [0.08, 0.05], [-0.14, 0.045]]);
      shape([[-0.1, -0.05], [-0.06, -0.12], [0.04, -0.15], [0.11, -0.12], [0.06, -0.06]]);         // the rider, crouched
      ctx.beginPath(); ctx.arc(0.1, -0.165, 0.035, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (kind === 'rocket') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fl = 0.22 + 0.05 * Math.sin(tt * 30);
      const g = ctx.createLinearGradient(-0.32 - fl, 0, -0.3, 0); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, 'rgba(255,200,120,.95)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.3, -0.05); ctx.lineTo(-0.32 - fl, 0); ctx.lineTo(-0.3, 0.04); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = fill;
      shape([[-0.3, -0.06], [-0.24, -0.1], [-0.05, -0.12], [0.08, -0.16], [0.18, -0.11], [0.36, -0.03], [0.36, 0.02], [-0.3, 0.05]]);
      shape([[-0.28, -0.08], [-0.34, -0.2], [-0.24, -0.2], [-0.16, -0.1]]);                        // the fin
      for (const wx of [-0.17, 0.2]) { ctx.beginPath(); ctx.arc(wx, 0.05, 0.055, 0, TAU); ctx.fill(); ctx.stroke(); }
    } else {
      // the mech walker: a cabin on two jointed legs, walking
      const st = Math.sin(tt * 3.2);
      const leg = (side) => {
        const ph = side ? st : -st;
        const hip = [side ? 0.06 : -0.06, 0.02], knee = [hip[0] + 0.1 + ph * 0.06, 0.2 - Math.abs(ph) * 0.03], foot = [hip[0] + ph * 0.12, 0.38 - Math.max(0, ph) * 0.04];
        ctx.lineWidth = 0.045; ctx.strokeStyle = fill; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(...hip); ctx.lineTo(...knee); ctx.lineTo(...foot); ctx.stroke();
        ctx.lineWidth = 0.01; ctx.strokeStyle = rim;
        ctx.beginPath(); ctx.moveTo(hip[0] + 0.02, hip[1]); ctx.lineTo(knee[0] + 0.02, knee[1]); ctx.stroke();
        ctx.fillStyle = fill; ctx.fillRect(foot[0] - 0.06, foot[1] - 0.015, 0.12, 0.03);
      };
      leg(0);
      ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 0.012;
      shape([[-0.16, -0.02], [-0.13, -0.16], [0.08, -0.2], [0.2, -0.12], [0.18, 0.04], [-0.12, 0.06]]);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
      ctx.drawImage(glowSprite('#ff5a6a'), 0.06, -0.15, 0.14, 0.08);
      ctx.restore();
      leg(1);
    }
    ctx.restore();
  }
  function drawBeat2(tau, opt = {}) {
    const v = b2Cam(tau);
    const ref = { cx: 2000, cy: 300 };
    const layer = (p) => cam(ref.cx + (v.cx - ref.cx) * p, ref.cy + (v.cy - ref.cy) * p, v.sc);
    screen();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (const [o, c] of SKY2) g.addColorStop(o, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // the sun and its rays (screen space)
    const sx = W * (portrait() ? 0.62 : 0.66), sy = H * (portrait() ? 0.27 : 0.3), su = Math.min(W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const a = tau * 0.06 + i * TAU / 12, w = 0.07 + 0.03 * Math.sin(i * 2.1);
      ctx.globalAlpha = 0.07 + 0.04 * Math.sin(tau * 0.8 + i) ** 2;
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, Math.max(W, H) * 1.2, a - w, a + w); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowSprite('#fff4d0'), sx - su * 0.42, sy - su * 0.42, su * 0.84, su * 0.84);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = '#fffdf2'; ctx.beginPath(); ctx.arc(sx, sy, su * 0.055, 0, TAU); ctx.fill();
    // far: hazy islands, background rings, a floating track ribbon
    for (const is of b2.isles) { layer(is.p); drawIsland(is.x - is.w / 2, is.x + is.w / 2, is.y, { track: false, hazy: 0.65, alpha: 0.8, seed: Math.round(is.x), tip: 0.7 }); }
    layer(0.5);
    ctx.save(); ctx.globalAlpha = 0.75;
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(40,52,120,.55)'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-200, 120); ctx.bezierCurveTo(500, -260, 900, 360, 1500, 40); ctx.bezierCurveTo(2000, -220, 2400, 260, 3200, -60); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,207,26,.6)'; ctx.stroke();
    ctx.restore();
    for (const r of b2.bgRings) { layer(r.p); ctx.globalAlpha = 0.55; drawRingShape(r.x, r.y + Math.sin(tau * 1.3 + r.ph) * 14, r.r, { width: 9 }); ctx.globalAlpha = 1; }
    // the cloud sea, back layers
    const seaTop = puffSprite('#ffffff', '#b9d6f5', 'rgba(255,255,255,.7)');
    const seaFar = puffSprite('#f4f9ff', '#a8c6ea', 'rgba(255,255,255,.5)');
    const drift = tau * 18;
    const seaLayer = (pts, p, spr) => {
      layer(p);
      const x0 = ref.cx + (v.cx - ref.cx) * p - W / 2 / v.sc - 300, x1 = x0 + W / v.sc + 600;
      for (const q of pts) { const x = q.x - drift * p; if (x > x0 && x < x1) ctx.drawImage(spr, x - q.r * 1.07, q.y - q.r * 1.07, q.r * 2.14, q.r * 2.14); }
    };
    seaLayer(b2.sea[0], 0.55, seaFar);
    seaLayer(b2.sea[1], 0.78, seaFar);
    // near: the well, the islands, the boost ring, the name rings, the car
    layer(1);
    drawWell(tau);
    drawIsland(560, 1560, b2.TA, { seed: 3 });
    drawIsland(4500, 5400, b2.TC, { seed: 5 });
    const ringX = 1150, ringY = b2.TA - 105, flash = Math.max(0, 1 - Math.abs(tau - b2.ringPass - 0.1) * 3);
    drawRingShape(ringX, ringY, 105, { lit: flash, width: 16, half: 1, color: '#22d3ff' });
    // name rings (back halves)
    const ringsLit = b2.rings.map((q) => (opt.allLit ? 1 : smooth(q.tt - 0.02, q.tt + 0.1, tau)));
    for (let i = 0; i < b2.rings.length; i++) { const q = b2.rings[i]; drawRingShape(q.x, q.y, b2.ringR, { lit: ringsLit[i], width: 12, half: 1, color: '#8fd8ff' }); }
    drawParts('b2');
    // the second jump: a shock ring under the car
    const sj = (tau - 5.95) / 0.6;
    if (sj > 0 && sj < 1) {
      const p = b2.path(5.95);
      ctx.save(); ctx.globalAlpha = 1 - sj; ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 10 * (1 - sj) + 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 60, 60 + 260 * easeOut(sj), 18 + 60 * easeOut(sj), 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (!opt.noCar) {
      const c = b2Car(tau);
      drawCar(c.x, c.y, c.a, 1, { spin: tau * 16, glow: c.ground ? 0.15 : 0.4 });
    }
    drawRingShape(ringX, ringY, 105, { lit: flash, width: 16, half: 2, color: '#22d3ff' });
    for (let i = 0; i < b2.rings.length; i++) {
      const q = b2.rings[i], lit = ringsLit[i];
      drawRingShape(q.x, q.y, b2.ringR, { lit, width: 12, half: 2, color: '#8fd8ff' });
      const pop = 1 + 0.35 * Math.max(0, 1 - Math.abs(tau - q.tt - 0.12) * 5) * (opt.allLit ? 0 : 1);
      const fs = b2.ringR * 1.05 * pop;
      ctx.save();
      ctx.font = `400 ${Math.round(fs)}px Bungee, "Arial Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (lit > 0.05) { ctx.shadowColor = 'rgba(255,190,40,.95)'; ctx.shadowBlur = 28 * lit * curScale; }
      ctx.fillStyle = lit > 0.05 ? rgbStr(mixRgb([200, 230, 255], [255, 255, 255], lit), 0.35 + 0.65 * lit) : 'rgba(220,240,255,.38)';
      ctx.fillText(q.ch, q.x, q.y + fs * 0.06);
      if (lit > 0.5) { ctx.shadowBlur = 0; ctx.lineWidth = 3 / curScale; ctx.strokeStyle = 'rgba(160,90,0,.55)'; ctx.strokeText(q.ch, q.x, q.y + fs * 0.06); }
      ctx.restore();
    }
    // the new rides glide past the sun (screen space), dark and nameless, one after another
    const rides = opt.rides != null ? opt.rides : tau - 9.05;
    const rk = (a, b) => clamp((rides - a) / (b - a));
    const mech = opt.rides != null ? 0.42 : rk(0.2, 3.4);
    if (rides > 0 && mech > 0 && mech < 1) {
      screen();
      drawRide('mech', lerp(W + 0.2 * su, -0.2 * su, mech), H * (portrait() ? 0.66 : 0.6), su * (portrait() ? 0.42 : 0.4), tau);
    }
    seaLayer(b2.sea[2], 1.12, seaTop);
    if (rides > 0) {
      screen();
      const rocket = opt.rides != null ? 0.8 : rk(0.05, 1.25), bike = opt.rides != null ? 0.28 : rk(0.9, 2.7);
      if (rocket > 0 && rocket < 1) drawRide('rocket', lerp(-0.35 * su, W + 0.35 * su, rocket), sy + su * 0.03, su * 0.55, tau);
      if (bike > 0 && bike < 1) drawRide('bike', lerp(-0.25 * su, W + 0.25 * su, bike), H * (portrait() ? 0.42 : 0.17) + Math.sin(rides * 2.4) * su * 0.015, su * 0.48, tau);
    }
    // the white burst fading out at the start
    screen();
    const white = 1 - smooth(0, 0.75, tau);
    if (white > 0) { ctx.fillStyle = `rgba(255,252,240,${white})`; ctx.fillRect(0, 0, W, H); }
  }
  function updateBeat2(tau, dt, from, live) {
    const c = b2Car(tau);
    if (!c.ground && tau < 8.8 && Math.random() < dt * 50) sparkle('b2', c.x - Math.cos(c.a) * 50, c.y + 30, { speed: 40, vy: 60, g: 30, size: 28, color: Math.random() < 0.5 ? '#ffcf1a' : '#7fe8ff' });
    if (c.ground && Math.random() < dt * 20) sparkle('b2', c.x - 80, c.y + 40, { speed: 30, vy: -20, g: -10, size: 20 });
    if (from < b2.ringPass + 0.05 && tau >= b2.ringPass + 0.05) { burst('b2', 1150, b2.TA - 105, 26, { speed: 260, g: 0, size: 34, color: '#22d3ff' }); if (live) sfx('ring'); }
    if (from < 5.95 && tau >= 5.95) { const p = b2.path(5.95); burst('b2', p.x, p.y + 50, 30, { speed: 300, g: 0, size: 30, color: '#bff4ff' }); if (live) sfx('rejump'); }
    b2.rings.forEach((q, i) => {
      if (from < q.tt + 0.03 && tau >= q.tt + 0.03) { burst('b2', q.x, q.y, 16, { speed: 220, g: 0, size: 30, color: '#ffcf1a' }); if (live) sfx('chime', i); }
    });
  }

  // ================= Beat 3: the Sky Road =================
  let road = null;
  // The road winds up the screen like a switchback (3 rows on a landscape screen, 5 on a portrait one), so 15 stones fit
  // with room between them and the car stays big enough to see. Stones sit at equal distances along the curve.
  const ROAD_PTS = {
    land: [[0.09, 0.67], [0.3, 0.69], [0.55, 0.67], [0.8, 0.64], [0.9, 0.56], [0.82, 0.47], [0.58, 0.46], [0.33, 0.45], [0.13, 0.4], [0.1, 0.31], [0.24, 0.25], [0.45, 0.25], [0.6, 0.24], [0.71, 0.24]],
    port: [[0.2, 0.766], [0.5, 0.775], [0.8, 0.738], [0.86, 0.682], [0.62, 0.645], [0.3, 0.636], [0.14, 0.58], [0.3, 0.524], [0.62, 0.515], [0.84, 0.469], [0.66, 0.404], [0.34, 0.394], [0.16, 0.348], [0.32, 0.283], [0.5, 0.255]],
  };
  function layoutRoad() {
    if (!P) return;
    const BH = 1000, BW = 1000 * W / H, port = portrait();
    const pts = (port ? ROAD_PTS.port : ROAD_PTS.land).map(([x, y], i) => [i, x * BW, y * BH]);
    const curve = makePath(pts);
    const dense = [];
    let L = 0, prev = curve(0);
    for (let q = 0; q <= (pts.length - 1) * 40; q++) {
      const c = curve(q / 40);
      L += Math.hypot(c.x - prev.x, c.y - prev.y); prev = c;
      dense.push({ x: c.x, y: c.y, L });
    }
    const at = (want) => { const d = dense.find((o) => o.L >= want) || dense[dense.length - 1]; return d; };
    const d = L / (SKY_ROAD_STEPS + 1.1);
    const capR = port ? BW * 0.12 : BH * 0.07;
    const y0 = dense[0].y, y1 = dense[dense.length - 1].y;
    const stones = [];
    for (let i = 1; i <= SKY_ROAD_STEPS; i++) {
      const p = at(d * i);
      const k = lerp(1.06, 0.86, clamp((y0 - p.y) / (y0 - y1)));
      stones.push({ i, x: p.x, y: p.y, L: d * i, r: Math.min(d * 0.27, capR) * k, seed: i * 17 });
    }
    const R0 = stones[0].r;
    const st = dense[0], gt = dense[dense.length - 1];
    road = { BW, BH, stones, dense, at, start: { x: st.x, y: st.y, r: R0 * 1.15, L: 0 }, gate: { x: gt.x, y: gt.y - BH * 0.03, s: port ? BW * 0.17 : BH * 0.12, L },
      carK: (R0 * 2.35) / (P.dims.len * PPM), port };
    const r = rng(23);
    road.sea = [0, 1].map((l) => { const o = []; for (let x = -BW * 0.3; x < BW * 1.3; x += BH * (0.09 + l * 0.03) + r() * BH * 0.05) o.push({ x, y: BH * (0.9 + l * 0.07) + r() * BH * 0.03, r: BH * (0.08 + l * 0.04) + r() * BH * 0.04 }); return o; });
    road.stars = Array.from({ length: 70 }, () => ({ x: r() * BW, y: r() * BH * 0.45 - BH * 0.1, s: 1 + r() * 1.8, ph: r() * TAU }));
  }
  const stoneTop = (s) => (s === road.start ? s.y - s.r * 0.2 : s.y - s.r * 0.32);
  function carSpot(step) {
    const s = step <= 0 ? road.start : road.stones[Math.min(SKY_ROAD_STEPS, step) - 1];
    return { x: s.x, y: stoneTop(s) - P.dims.lift * PPM * road.carK };
  }
  function drawStone(s, lit, current, rt) {
    const R = s.r, r = rng(s.seed);
    const glow = lit;
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * glow * (0.85 + 0.15 * Math.sin(rt * 2.4 + s.i));
      ctx.drawImage(glowSprite('#ffc93d'), s.x - R * 2.6, s.y - R * 1.8, R * 5.2, R * 3.6);
      ctx.restore();
    }
    const spr = glow > 0.5 ? puffSprite('#fffbe8', '#ffbf4d', 'rgba(255,255,255,.8)') : puffSprite('#f2f7ff', '#9fb8e8', 'rgba(255,255,255,.6)');
    ctx.save(); ctx.globalAlpha = glow > 0.5 ? 1 : 0.72;
    const puffs = [[-0.75, 0.12, 0.62], [0.75, 0.12, 0.6], [-0.3, -0.05, 0.78], [0.32, -0.02, 0.74], [0, 0.18, 0.7]];
    for (const [dx, dy, rr] of puffs) { const pr = R * rr * (0.92 + r() * 0.16); ctx.drawImage(spr, s.x + dx * R - pr * 1.07, s.y + dy * R - pr * 1.07, pr * 2.14, pr * 2.14); }
    ctx.restore();
    if (current) {
      ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.3 * Math.sin(rt * 4) ** 2})`; ctx.lineWidth = Math.max(2, R * 0.08);
      ctx.beginPath(); ctx.ellipse(s.x, s.y + R * 0.2, R * 1.35, R * 0.42, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (MILESTONES.includes(s.i) && s.i < SKY_ROAD_STEPS) {
      const sz = R * 0.42, sx = s.x + R * 1.0, sy = s.y - R * 0.75;
      ctx.save(); ctx.translate(sx, sy);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? sz * 0.45 : sz; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
      if (glow > 0.5) { ctx.fillStyle = '#ffcf1a'; ctx.shadowColor = 'rgba(255,200,40,.9)'; ctx.shadowBlur = 12; ctx.fill(); }
      else { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); ctx.lineWidth = Math.max(1.5, sz * 0.12); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke(); }
      ctx.restore();
    }
  }
  function drawGate(gateOn, rt) {
    const g = road.gate, S = g.s, x = g.x, y = g.y;
    ctx.save();
    // rays and glow
    ctx.globalCompositeOperation = 'lighter';
    const rays = 0.18 + 0.82 * gateOn;
    for (let i = 0; i < 14; i++) {
      const a = rt * (0.12 + 0.2 * gateOn) + i * TAU / 14, w = 0.06 + 0.02 * Math.sin(i * 1.7);
      ctx.globalAlpha = rays * (0.08 + 0.06 * Math.sin(rt * 1.5 + i) ** 2);
      ctx.fillStyle = '#fff2c4';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, S * (3 + 2.5 * gateOn), a - w, a + w); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 0.35 + 0.65 * gateOn;
    ctx.drawImage(glowSprite('#ffe08a'), x - S * 2.2, y - S * 2.2, S * 4.4, S * 4.4);
    ctx.restore();
    // the arch: two crystal pillars and a ring of light, the portal inside
    ctx.save();
    const pw = S * 0.16, ph = S * 1.25, gap = S * 0.62;
    const pillar = (px) => {
      const gr = ctx.createLinearGradient(px - pw, 0, px + pw, 0);
      gr.addColorStop(0, gateOn > 0.5 ? '#fff3c4' : '#c9d8ff'); gr.addColorStop(1, gateOn > 0.5 ? '#ffb02e' : '#6f86d8');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(px - pw, y + ph * 0.5); ctx.lineTo(px - pw * 0.8, y - ph * 0.42); ctx.lineTo(px, y - ph * 0.55); ctx.lineTo(px + pw * 0.8, y - ph * 0.42); ctx.lineTo(px + pw, y + ph * 0.5); ctx.closePath(); ctx.fill();
    };
    const portal = ctx.createRadialGradient(x, y, 0, x, y, gap);
    portal.addColorStop(0, gateOn > 0.5 ? 'rgba(255,255,255,.95)' : 'rgba(220,235,255,.55)'); portal.addColorStop(0.6, gateOn > 0.5 ? 'rgba(255,214,110,.75)' : 'rgba(140,170,255,.35)'); portal.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = portal; ctx.beginPath(); ctx.ellipse(x, y, gap, ph * 0.5, 0, 0, TAU); ctx.fill();
    pillar(x - gap); pillar(x + gap);
    ctx.lineWidth = pw * 0.7; ctx.strokeStyle = gateOn > 0.5 ? '#ffe28a' : 'rgba(200,215,255,.9)';
    ctx.beginPath(); ctx.arc(x, y - ph * 0.48, gap, Math.PI, 0); ctx.stroke();
    // the portal's swirl
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1.5, S * 0.03);
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.35 * gateOn})`;
      ctx.beginPath(); ctx.ellipse(x, y, gap * (0.35 + k * 0.2), ph * 0.5 * (0.35 + k * 0.2), 0, rt * (0.8 + k * 0.3), rt * (0.8 + k * 0.3) + 4); ctx.stroke();
    }
    ctx.restore();
  }
  // rt: road time (s); o: { from, to, hop: [t0, t1] | null, gateAt, zoom: [{t, z, fx}], ... }
  function drawRoad(rt, o) {
    const R = road;
    // camera
    const fullC = { cx: R.BW / 2, cy: R.BH / 2 - R.BH * 0.02, sc: H / R.BH };
    const hopK = o.hop ? clamp((rt - o.hop[0]) / (o.hop[1] - o.hop[0])) : 1;
    const step = o.hop && hopK < 1 ? o.from : o.to;
    const a = carSpot(o.from), b = carSpot(o.to);
    let car = { x: b.x, y: b.y, a: 0, squash: 1 };
    if (o.hop && rt < o.hop[1]) {
      if (rt < o.hop[0]) {
        const pre = smooth(o.hop[0] - 0.25, o.hop[0], rt);
        car = { x: a.x, y: a.y, a: 0, squash: 1 - 0.18 * pre };
      } else {
        const k = easeInOut(hopK);
        const hgt = Math.max(R.stones[0].r * 3.2, Math.abs(b.y - a.y) + R.stones[0].r * 2.2);
        car = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - Math.sin(Math.PI * hopK) * hgt, a: TAU * easeInOut(hopK), squash: 1 + 0.12 * Math.sin(Math.PI * hopK) };
      }
    } else if (o.hop && rt < o.hop[1] + 0.3) car.squash = 1 - 0.16 * Math.sin(Math.PI * clamp((rt - o.hop[1]) / 0.3));
    const pull = o.pull ? easeInOut(clamp((rt - o.pull[0]) / (o.pull[1] - o.pull[0]))) : 1;
    const zIn = o.zoomIn || 2.3;
    const z = lerp(zIn, o.endZoom || 1, pull);
    const focus = { x: lerp(b.x, fullC.cx, pull), y: lerp(b.y, fullC.cy, pull) };
    let cx = focus.x, cy = focus.y, sc = fullC.sc * z;
    if (o.lean) { const l = smooth(o.lean[0], o.lean[1], rt) * 0.14; cx = lerp(cx, car.x, l); cy = lerp(cy, car.y, l); sc *= 1 + 0.5 * l; }
    // the sky (screen space): night at the top, day below, warm at the horizon
    screen();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#11185a'); g.addColorStop(0.42, '#3c5fca'); g.addColorStop(0.78, '#94d2ff'); g.addColorStop(1, '#ffe2b4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const layer = (p) => cam(fullC.cx + (cx - fullC.cx) * p, fullC.cy + (cy - fullC.cy) * p, fullC.sc + (sc - fullC.sc) * p);
    layer(0.35);
    ctx.fillStyle = '#fff';
    for (const s of R.stars) { ctx.globalAlpha = 0.25 + 0.6 * Math.sin(rt * 2 + s.ph) ** 2; ctx.fillRect(s.x, s.y, s.s / curScale, s.s / curScale); }
    ctx.globalAlpha = 1;
    const sea = puffSprite('#ffffff', '#c2d7f2', 'rgba(255,255,255,.6)');
    const seaWarm = puffSprite('#fff6e6', '#f2c79a', 'rgba(255,255,255,.6)');
    layer(0.6);
    for (const q of R.sea[0]) ctx.drawImage(seaWarm, q.x - q.r * 1.07 + Math.sin(rt * 0.3) * 10, q.y - q.r * 1.07, q.r * 2.14, q.r * 2.14);
    layer(1);
    const lit = Math.min(SKY_ROAD_STEPS, step);
    const gateOn = o.gateAt != null ? smooth(o.gateAt, o.gateAt + 0.9, rt) : 0;
    drawGate(gateOn, rt);
    // the dotted light along the road (gold where it is walked)
    const dotR = Math.max(1.5, R.stones[0].r * 0.075);
    const nodes = [R.start, ...R.stones, R.gate];
    for (let i = 1; i < nodes.length; i++) {
      const a0 = nodes[i - 1], a1 = nodes[i];
      const on = i < nodes.length - 1 ? a1.i <= lit : lit >= SKY_ROAD_STEPS;
      const gap0 = (i === 1 ? R.start.r * 1.4 : a0.r * 1.45), gap1 = i < nodes.length - 1 ? a1.r * 1.45 : R.gate.s * 0.75;
      const span = a1.L - a0.L - gap0 - gap1;
      const n = Math.max(1, Math.round(span / (dotR * 7)));
      for (let k = 0; k <= n; k++) {
        const q = R.at(a0.L + gap0 + span * (k / Math.max(1, n)));
        ctx.fillStyle = on ? `rgba(255,214,90,${0.7 + 0.3 * Math.sin(rt * 5 - i - k * 0.6)})` : 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(q.x, q.y - R.stones[0].r * 0.25, dotR, 0, TAU); ctx.fill();
      }
    }
    // the start: a little floating island with a strip of track
    const sp = R.start;
    drawIsland(sp.x - sp.r * 1.4, sp.x + sp.r * 1.4, sp.y - sp.r * 0.2, { tip: 0.5, seed: 9 });
    // stones, far first
    for (let i = R.stones.length - 1; i >= 0; i--) {
      const s = R.stones[i];
      let l = s.i <= lit ? 1 : 0;
      if (o.hop && s.i === o.to && o.to > o.from) l = smooth(o.hop[1] - 0.05, o.hop[1] + 0.25, rt);
      drawStone(s, l, s.i === step && step > 0, rt);
    }
    drawParts('road');
    drawCar(car.x, car.y, car.a, R.carK, { squash: car.squash, glow: 0.25 });
    layer(1.25);
    for (const q of R.sea[1]) ctx.drawImage(sea, q.x - q.r * 1.07 - Math.sin(rt * 0.25) * 16, q.y - q.r * 1.07, q.r * 2.14, q.r * 2.14);
    return { car };
  }
  function updateRoad(rt, dt, from, live, o) {
    const lit = Math.min(SKY_ROAD_STEPS, o.hop && rt < o.hop[1] ? o.from : o.to);
    for (const s of road.stones) if (s.i <= lit && Math.random() < dt * 1.6) sparkle('road', s.x + (Math.random() - 0.5) * s.r * 2, s.y - s.r * 0.2, { speed: 12, vy: -s.r * 1.1, g: 0, size: s.r * 0.55, decay: 0.7 });
    if (o.hop && from < o.hop[1] && rt >= o.hop[1]) {
      const s = carSpot(o.to);
      burst('road', s.x, s.y, 34, { speed: road.stones[0].r * 6, g: road.stones[0].r * 2, size: road.stones[0].r * 0.9, color: '#ffcf1a' });
      if (live) sfx('land');
    }
    if (o.hop && from < o.hop[0] && rt >= o.hop[0] && live) sfx('hop');
    if (o.gateAt != null) {
      if (from < o.gateAt && rt >= o.gateAt) { burst('road', road.gate.x, road.gate.y, 40, { speed: road.gate.s * 3, g: 0, size: road.gate.s * 0.35, color: '#ffe08a' }); if (live) sfx('gate'); }
      if (rt > o.gateAt && Math.random() < dt * 14) sparkle('road', road.gate.x + (Math.random() - 0.5) * road.gate.s, road.gate.y + road.gate.s * 0.3, { speed: 20, vy: -road.gate.s * 0.9, g: 0, size: road.gate.s * 0.3, decay: 0.8 });
    }
  }

  // ---------- the cloud curtain between beat 2 and 3 ----------
  function drawCurtain(k) {
    if (k <= 0) return;
    screen();
    const spr = puffSprite('#ffffff', '#cfe2f7', 'rgba(255,255,255,.7)');
    const u = Math.max(W, H);
    ctx.fillStyle = `rgba(245,250,255,${smooth(0.45, 0.9, k)})`; ctx.fillRect(0, 0, W, H);
    const r = rng(31);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = H * (1.25 - 1.6 * k) + r() * H * 0.9, rr = u * (0.16 + r() * 0.16) * (0.5 + k);
      ctx.drawImage(spr, x - rr, y - rr, rr * 2, rr * 2);
    }
  }

  // ---------- the play: scenes, captions, cues ----------
  function roadOpts() {
    if (P.kind === 'clip') {
      const gate = P.step >= SKY_ROAD_STEPS;
      return { from: Math.max(0, P.steps - 1), to: P.steps, hop: P.steps > 0 ? [1.0, 1.7] : null, gateAt: gate ? 2.2 : null, zoomIn: 1, endZoom: 1, pull: [-1, 0], lean: [0.3, 2.2] };
    }
    return { from: P.steps, to: P.steps, hop: null, gateAt: P.steps >= SKY_ROAD_STEPS ? 3.6 : null, zoomIn: 2.4, endZoom: 1, pull: [0.2, 2.9] };
  }
  function captionAt(tt) {
    let text = '';
    for (const c of P.captions) if (tt >= c.t) text = c.text;
    return text;
  }
  function badgeAt(tt) {
    if (P.kind === 'clip') return tt < 1.7 || !(P.steps > 0) ? (tt < 0.15 ? null : roadText(Math.max(0, P.steps - 1))) : roadText(P.steps);
    return tt >= B3 + 0.7 ? roadText(P.steps) : null;
  }
  function buildCues() {
    const caps = [], cues = [];
    const line = (t, text, voice = true) => { caps.push({ t, text }); if (voice) cues.push({ t, say: text }); };
    if (P.kind === 'full') {
      line(0.25, SKY_LINES.hook);
      cues.push({ t: 1.22, fx: 'whoosh' }, { t: 1.7, fx: 'rise' }, { t: 4.3, fx: 'burst' }, { t: 6.05, fx: 'reveal' }, { t: B2 + 2.62, fx: 'whoosh' }, { t: B2 + 3.4, fx: 'orbit' },
        { t: B2 + 9.2, fx: 'pass' }, { t: B2 + 9.75, fx: 'pass' }, { t: 17.3, fx: 'whoosh' }, { t: B3 + 0.3, fx: 'reveal' });
      line(B2 + 0.35, SKY_LINES.era);
      line(B2 + 3.0, SKY_LINES.rides);
      line(B2 + 5.95, SKY_LINES.jump);
      caps.push({ t: 17.25, text: '' });
      line(B3 + 0.55, SKY_LINES.road);
      if (P.steps >= SKY_ROAD_STEPS) line(B3 + 4.0, SKY_LINES.gate);
    } else if (P.step >= SKY_ROAD_STEPS) {
      line(2.4, SKY_LINES.gate);
    } else {
      line(1.85, stepLine(P.steps), P.steps === P.step);    // spoken only when the clip matches the real step (4 / 8 / 12 are pre-made)
    }
    P.captions = caps.sort((a, b) => a.t - b.t);
    P.cues = cues.sort((a, b) => a.t - b.t);
  }
  function sceneAt(tt) {
    if (P.kind !== 'full') return 'road';
    if (tt < B2) return 'b1';
    if (tt < B3) return 'b2';
    return 'road';
  }
  function draw() {
    if (!open || !P) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (P.reduced) { drawStill(frameIdx); return; }
    const sc = sceneAt(t);
    if (sc === 'b1') drawBeat1(t);
    else if (sc === 'b2') { drawBeat2(t - B2); drawCurtain(smooth(17.15, 17.95, t)); }
    else {
      const rt = P.kind === 'full' ? t - B3 : t;
      drawRoad(rt, roadOpts());
      if (P.kind === 'full') drawCurtain(1 - smooth(0, 0.75, rt));
    }
    syncDom(t);
  }
  function syncDom(tt) {
    const cap = P.reduced ? stillCaption(frameIdx) : captionAt(tt);
    if (cap !== shownCaption) {
      shownCaption = cap;
      caption.textContent = cap;
      caption.hidden = !cap;
      caption.classList.remove('in'); void caption.offsetWidth; caption.classList.add('in');
    }
    const b = P.reduced ? (stillScene(frameIdx) === 'road' ? roadText(P.steps) : null) : badgeAt(tt);
    if (b !== shownBadge) {
      shownBadge = b;
      badge.hidden = !b;
      if (b) { badge.textContent = b; badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
    }
  }
  function update(dt, live) {
    const from = prevT;
    const sc = sceneAt(t);
    if (sc === 'b1') updateBeat1(t, dt);
    else if (sc === 'b2') updateBeat2(t - B2, dt, Math.max(0, from - B2), live);
    else { const off = P.kind === 'full' ? B3 : 0; updateRoad(t - off, dt, from - off, live, roadOpts()); }
    stepParts(dt);
    if (live) for (const c of P.cues) if (from < c.t && t >= c.t) { if (c.say) say(c.say); else sfx(c.fx); }
    prevT = t;
  }

  // ---------- reduced motion: still frames ----------
  const STILLS_FULL = ['b1', 'b2', 'road'];
  const stillScene = (i) => (P.kind === 'full' ? STILLS_FULL[i] : 'road');
  const stillCount = () => (P.kind === 'full' ? 3 : 1);
  function stillLines(i) {
    const s = stillScene(i);
    if (s === 'b1') return [SKY_LINES.hook];
    if (s === 'b2') return [SKY_LINES.era, SKY_LINES.rides, SKY_LINES.jump];
    if (P.kind === 'clip') return [P.step >= SKY_ROAD_STEPS ? SKY_LINES.gate : stepLine(P.steps)];
    return P.steps >= SKY_ROAD_STEPS ? [SKY_LINES.road, SKY_LINES.gate] : [SKY_LINES.road];
  }
  const stillCaption = (i) => stillLines(i).join(' ');
  function drawStill(i) {
    const s = stillScene(i);
    parts = []; partScene = '';
    if (s === 'b1') drawBeat1(4.7);
    else if (s === 'b2') drawBeat2(8.3, { allLit: true, rides: 1.2, noCar: true });
    else drawRoad(5, { from: P.steps, to: P.steps, hop: null, gateAt: P.steps >= SKY_ROAD_STEPS ? 0 : null, zoomIn: 1, endZoom: 1, pull: [0, 0.001] });
    syncDom(0);
  }
  function showStill(i) {
    frameIdx = i;
    tapHint.hidden = false;
    tapHint.textContent = i < stillCount() - 1 ? 'Tap for more' : 'Tap to close';
    draw();
    const lines = stillLines(i), token = ++speechToken;
    (async () => {
      for (const l of lines) {
        if (token !== speechToken || !open) return;
        const p = say(l);
        if (!p) return;                          // no clip: the caption stays, no voice
        await p;
      }
    })();
  }

  // ---------- sound ----------
  function say(text) {
    if (!deps.speak) return null;
    try { return deps.speak(text) || null; } catch (_) { return null; }
  }
  function sfx(kind, i = 0) {
    if (!audio || !P || !P.sound) return;
    try {
      if (kind === 'whoosh') audio.whoosh && audio.whoosh();
      else if (kind === 'rise') audio.skyRise && audio.skyRise();
      else if (kind === 'burst') audio.skyBurst && audio.skyBurst();
      else if (kind === 'reveal') audio.skyReveal && audio.skyReveal();
      else if (kind === 'orbit') audio.orbit && audio.orbit();
      else if (kind === 'ring') audio.ring && audio.ring();
      else if (kind === 'rejump') audio.rejump && audio.rejump();
      else if (kind === 'chime') audio.skyChime && audio.skyChime(i);
      else if (kind === 'pass') audio.skyPass && audio.skyPass();
      else if (kind === 'hop') audio.pop && audio.pop();
      else if (kind === 'land') audio.skyChime && (audio.skyChime(2), audio.skyChime(4));
      else if (kind === 'gate') audio.skyGate && audio.skyGate();
    } catch (_) { /* sound is a nicety */ }
  }

  // ---------- loop + input ----------
  function frame(now) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!paused) {
      t = Math.min(len, t + dt * (window.__skyTeaserSpeed || 1));
      update(dt, true);
    }
    draw();
    if (!paused && t >= len) close('end');
  }
  function onPointer(e) {
    if (!open) return;
    if (e.target === skip || (e.target.closest && e.target.closest('.st-skip'))) return;
    e.preventDefault(); e.stopPropagation();
    if ((performance.now() - openedAt) / 1000 < TAP_GRACE) return;
    if (P.reduced) { if (frameIdx < stillCount() - 1) showStill(frameIdx + 1); else close('tap'); }
    else close('tap');
  }
  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close('key'); return; }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      e.preventDefault(); e.stopPropagation();
      if (P.reduced && frameIdx < stillCount() - 1) showStill(frameIdx + 1); else close('key');
    }
  }
  const onSkip = (e) => { e.preventDefault(); e.stopPropagation(); close('skip'); };
  skip.addEventListener('click', onSkip);

  function close(reason = 'skip') {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf); raf = 0;
    speechToken++;
    try { deps.stopSpeech && deps.stopSpeech(); } catch (_) { /* ignore */ }
    root.removeEventListener('pointerdown', onPointer, true);
    window.removeEventListener('keydown', onKey, true);
    if (ro) { ro.disconnect(); ro = null; }
    window.removeEventListener('resize', resize);
    parts = []; partScene = ''; band = null; b2 = null; road = null;
    root.classList.remove('on');
    root.hidden = true;
    canvas.width = 1; canvas.height = 1;            // let the big backing store go
    const r = resolveDone; resolveDone = null;
    const info = { reason, kind: P && P.kind, t };
    P = null;
    try { deps.onClose && deps.onClose(info); } catch (_) { /* ignore */ }
    if (r) r(info);
  }

  return {
    /** opts: { kind: 'full' | 'clip', step (the milestone for a clip), steps (the road's steps), car, look, name (A-Z, from
     *  skyName), reduced, sound }. Resolves { reason, kind } when it closes. */
    play(opts) {
      if (open) close('replaced');
      const car = opts.car || null;
      P = {
        kind: opts.kind === 'clip' ? 'clip' : 'full', step: Number(opts.step) || 0, steps: clamp(Math.floor(Number(opts.steps) || 0), 0, SKY_ROAD_STEPS),
        car, look: opts.look || null, name: String(opts.name || 'SKY').slice(0, 8) || 'SKY', reduced: !!opts.reduced, sound: opts.sound !== false,
        dims: car ? carDims(car) : { len: 4.4, lift: 0.6, h: 1.6 },
      };
      len = P.kind === 'full' ? FULL_LEN : (P.step >= SKY_ROAD_STEPS ? GATE_LEN : CLIP_LEN);
      buildCues();
      open = true; paused = false; t = 0; prevT = 0; last = 0; frameIdx = 0; parts = []; partScene = '';
      shownCaption = null; shownBadge = null;
      caption.textContent = ''; caption.hidden = true; badge.hidden = true; tapHint.hidden = true;
      root.hidden = false;
      root.classList.toggle('reduced', P.reduced);
      requestAnimationFrame(() => { if (open) root.classList.add('on'); });
      openedAt = performance.now();
      measure();
      makeBand(); makeBeat2(); layoutRoad();
      root.addEventListener('pointerdown', onPointer, true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', resize);
      if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(root); }
      const done = new Promise((r) => { resolveDone = r; });
      if (P.reduced) showStill(0);
      else raf = requestAnimationFrame(frame);
      return done;
    },
    close,
    get isOpen() { return open; },
    /** For the smoke tests and screenshots. */
    get state() {
      return open && P ? { kind: P.kind, step: P.step, steps: P.steps, reduced: P.reduced, t, len, frame: frameIdx, frames: stillCount(), scene: P.reduced ? stillScene(frameIdx) : sceneAt(t),
        caption: caption.hidden ? '' : caption.textContent, badge: badge.hidden ? '' : badge.textContent, name: P.name } : null;
    },
    /** Pause at time tt and draw it (the particles of the second before are simulated so sparkles show). */
    seek(tt) {
      if (!open || P.reduced) return;
      paused = true;
      const target = clamp(tt, 0, len - 0.001);
      parts = []; partScene = '';
      t = Math.max(0, target - 1.2); prevT = t;
      while (t < target) { t = Math.min(target, t + 1 / 30); update(1 / 30, false); }
      draw();
    },
    resume() { paused = false; last = 0; },
  };
}
