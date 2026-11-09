// Sky Era renderer (v4.0): dusk-to-day sky, sun and rays, cloud-sea parallax, floating islands (grass, soil, rock undersides,
// glowing crystals), boost rings, gravity wells, the Spell Boost gate. The palette follows src/ui/skyTeaser.js so the real era
// matches the teaser. Everything is cheap: sprites (a puff, a glow) are made once and drawn with drawImage; paths only for what is
// in view; the same devicePixelRatio caps as the rest of the engine (the engine owns the canvas size).
//
// Two coordinate systems: the background and the cloud sea are drawn in SCREEN space (cam + parallax by hand), the islands, wells,
// rings and the gate in WORLD space (metres, +y up, under R.worldTransform).

import { TAU, mulberry32, hash2, clamp, lerp, mix, shade, withAlpha, hexToRgb, smoothstep } from './util.js';

const OUT = '#1d1b26';
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const P = 2600; // parallax layer period (m)

// ---------- sprites ----------
const SPR = new Map();
function sprite(key, size, paint) {
  let c = SPR.get(key);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  if (SPR.size > 160) SPR.clear();
  c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  SPR.set(key, c);
  return c;
}
// a soft cloud puff: lit top, shaded bottom, soft edge. The disc has radius 0.47 of the sprite
function puffSpr(top, bottom) {
  return sprite(`puff|${top}|${bottom}`, 128, (g, s) => {
    const r = s * 0.47, c = s / 2;
    const lg = g.createLinearGradient(0, c - r, 0, c + r);
    lg.addColorStop(0, top); lg.addColorStop(0.5, top); lg.addColorStop(1, bottom);
    g.fillStyle = lg; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
    const hl = g.createRadialGradient(c - r * 0.35, c - r * 0.45, 2, c - r * 0.2, c - r * 0.3, r * 0.9);
    hl.addColorStop(0, 'rgba(255,255,255,.6)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(c, c, r * 0.78, c, c, r);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, s, s);
  });
}
function glowSpr(color) {
  return sprite(`glow|${color}`, 128, (g, s) => {
    const c = hexToRgb(color);
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, rgb(c, 1)); rg.addColorStop(0.25, rgb(c, 0.55)); rg.addColorStop(0.6, rgb(c, 0.14)); rg.addColorStop(1, rgb(c, 0));
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
  });
}
function sparkSpr() {
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

// ---------- palette over the run ----------
// The sky at progress p (0 = the lip, 1 = the finish): three stops, dusk -> day (or day -> night on the last tracks)
function skyAt(theme, p) {
  const k = smoothstep(0, 1, p);
  const from = theme.skyDusk.map(hexToRgb), to = theme.sky.map(hexToRgb);
  return from.map((c, i) => mixRgb(c, to[i], k));
}

// ---------- backdrop data (once per run; no DOM here, so the headless sims can build it) ----------
export function createSkyBackdrop(track, seed) {
  const rand = mulberry32((seed * 29 + 11) >>> 0);
  const theme = track.theme;
  const isles = Array.from({ length: 10 }, (_, i) => ({ x: (i / 10) * P + rand() * 180, y: 6 + rand() * 38, w: 40 + rand() * 90, p: 0.2 + rand() * 0.22, seed: rand() * 100 }));
  const rings = Array.from({ length: 6 }, (_, i) => ({ x: (i / 6) * P + rand() * 260, y: 10 + rand() * 40, r: 6 + rand() * 5, p: 0.3 + rand() * 0.15, ph: rand() * TAU }));
  const stars = Array.from({ length: 110 }, () => ({ x: rand(), y: rand() * 0.8, s: 0.7 + rand() * 1.7, p: rand() * TAU }));
  const bolts = Array.from({ length: 5 }, () => Array.from({ length: 7 }, () => rand()));
  return {
    style: 'sky', sky: true, night: false, planet: 'none', P, far: [], mid: [], farW: [], midW: [], clouds: [], stars, theme,
    isles, rings, bolts, sea: (track.sky && track.sky.sea) || 0,
    starK: theme.stars || 0, storm: !!theme.storm, rainbow: !!theme.rainbow,
  };
}

// ---------- background (screen space) ----------
// prog 0..1 along the run, space 0..1 (the existing orbit darkening, flights above 45 m)
export function drawSkyBackground(ctx, view, cam, bd, t, prog, space = 0) {
  const { W, H } = view;
  view.t = t;
  const th = bd.theme, z = cam.z;
  const sk = skyAt(th, prog);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(sk[0])); g.addColorStop(0.5, rgb(sk[1])); g.addColorStop(1, rgb(sk[2]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // seen from high up the blue deepens toward space
  if (space > 0.01) {
    ctx.globalAlpha = Math.min(0.85, space * 0.85);
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, '#04051a'); sg.addColorStop(0.6, '#0e1650'); sg.addColorStop(1, '#2e4f9a');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  const su = Math.min(W, H);
  // stars (night tracks fade them in along the run, a flight high up shows them everywhere)
  const starA = Math.max(bd.starK * smoothstep(0.3, 0.95, prog), space * 0.9);
  if (starA > 0.02) {
    for (let i = 0; i < bd.stars.length; i++) {
      const s = bd.stars[i];
      const x = (((s.x * W * 1.3 - cam.x * z * 0.01) % (W * 1.3)) + W * 1.3) % (W * 1.3);
      ctx.fillStyle = `rgba(255,255,255,${(starA * (0.55 + 0.45 * Math.sin(t * 2 + s.p))).toFixed(2)})`;
      ctx.fillRect(x, s.y * H, s.s, s.s);
    }
  }
  // the sun sinks and warms toward dusk; on the night track it sets and a moon rises in its place
  const setting = bd.starK >= 0.9 ? smoothstep(0.45, 0.9, prog) : 0;
  const dusk = 1 - smoothstep(0, 0.55, prog); // 1 at the lip when the track starts at dusk
  const duskTrack = th.skyDusk[2] && hexToRgb(th.skyDusk[2])[0] > 230 && hexToRgb(th.skyDusk[0])[2] < 160 ? 1 : 0;
  const sx = W * 0.7, sy = H * (0.22 + 0.2 * dusk * duskTrack + 0.55 * setting), sr = su * (0.065 + 0.02 * dusk * duskTrack);
  const sunA = (1 - space) * (1 - setting);
  if (sunA > 0.02) {
    const warm = dusk * duskTrack;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = sunA;
    for (let i = 0; i < 12; i++) {
      const a = t * 0.05 + (i * TAU) / 12, w = 0.06 + 0.025 * Math.sin(i * 2.1);
      ctx.globalAlpha = sunA * (0.045 + 0.03 * Math.sin(t * 0.8 + i) ** 2);
      ctx.fillStyle = warm > 0.3 ? '#ffd9a8' : '#fff6dc';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, Math.max(W, H) * 1.3, a - w, a + w); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = sunA * 0.9;
    const gs = su * (0.55 + 0.1 * warm);
    ctx.drawImage(glowSpr(warm > 0.3 ? '#ffb070' : '#fff4d0'), sx - gs / 2, sy - gs / 2, gs, gs);
    ctx.restore();
    ctx.globalAlpha = sunA;
    ctx.fillStyle = warm > 0.3 ? '#ffe3b0' : '#fffdf2';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (setting > 0.05) {
    ctx.globalAlpha = setting * (1 - space * 0.5);
    ctx.fillStyle = '#f6f0ff';
    const mx = W * 0.7, my = H * 0.22, mr = su * 0.06;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,100,180,.22)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.32, 0.12, 0.16], [-0.05, 0.42, 0.12]]) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // a rainbow over Rainbow Reef
  if (bd.rainbow) {
    const cx = W * 0.32 - cam.x * z * 0.004, cy = H * 1.12, R0 = Math.max(W * 0.62, H * 0.95);
    const cols = ['#ff5a5a', '#ffa24a', '#ffe14a', '#6fe07a', '#4ac8ff', '#7a7aff', '#b46cff'];
    ctx.lineWidth = Math.max(5, W * 0.011);
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = withAlpha(cols[i], 0.42);
      ctx.beginPath(); ctx.arc(cx, cy, R0 - i * ctx.lineWidth * 0.95, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
  }
  // storm: a flash and a jagged bolt far away, every few seconds
  if (bd.storm) {
    const cyc = 7.3, ph = t % cyc, n = Math.floor(t / cyc);
    const flash = ph < 0.5 ? Math.max(0, Math.sin(ph * 26)) * (1 - ph * 2) : 0;
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(235,225,255,${(0.2 * flash).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      const b = bd.bolts[n % bd.bolts.length];
      let x = W * (0.15 + 0.7 * ((n * 0.37) % 1)), y = 0;
      ctx.strokeStyle = `rgba(255,248,200,${(0.8 * flash).toFixed(3)})`; ctx.lineWidth = Math.max(2, su * 0.006); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) { x += (b[i] - 0.5) * su * 0.12; y += H * 0.1; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  // far, hazy islands and ghost rings, parallax 0.2-0.45
  const horizon = H / 2 + (cam.y - bd.sea) * z * 0.5;
  const haze = skyAt(th, prog)[2];
  const farCol = mixRgb(hexToRgb(th.far), haze, 0.5);
  for (const is of bd.isles) {
    const s = lerp(0.45, 0.8, is.p / 0.42);
    let wx = (((is.x - cam.x * is.p) % P) + P) % P - P / 2;
    const sxp = W / 2 + wx * z * s, w = is.w * z * s * 0.5, syp = H / 2 - (is.y - cam.y * is.p) * z * s;
    if (sxp + w < -20 || sxp - w > W + 20) continue;
    hazyIsland(ctx, sxp, syp, w, is.w * 0.32 * z * s, farCol, is.seed, 0.62);
  }
  for (const r of bd.rings) {
    const s = 0.7;
    const wx = (((r.x - cam.x * r.p) % P) + P) % P - P / 2;
    const sxp = W / 2 + wx * z * s, syp = H / 2 - (r.y - cam.y * r.p) * z * s + Math.sin(t * 1.2 + r.ph) * 4, rr = r.r * z * s;
    if (sxp + rr < -20 || sxp - rr > W + 20) continue;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = Math.max(2, rr * 0.16); ctx.strokeStyle = th.glow || '#7fe8ff';
    ctx.beginPath(); ctx.ellipse(sxp, syp, rr * 0.4, rr, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // distant cloud-sea layers (the near layer is drawn over the islands by drawSeaNear)
  seaLayer(ctx, view, cam, bd, prog, 0.3, 0.5, 12, 7, 12, 0);
  seaLayer(ctx, view, cam, bd, prog, 0.55, 0.72, 7, 5, 9, 1);
  seaLayer(ctx, view, cam, bd, prog, 0.8, 0.88, 3, 4, 7, 2);
  void horizon;
}

// a faint island silhouette: flat top, jagged underside; sx, sy = centre of the top edge (screen px)
function hazyIsland(ctx, sx, sy, hw, depth, col, seed, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy);
  const n = 8;
  for (let i = 1; i < n; i++) {
    const u = i / n, d = Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(seed * 7 + i * 1.9));
    ctx.lineTo(sx - hw + 2 * hw * u, sy + depth * d);
  }
  ctx.lineTo(sx + hw, sy);
  ctx.quadraticCurveTo(sx, sy - depth * 0.28, sx - hw, sy);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- cloud sea (screen space) ----------
// Puffs in cells (position from a hash of the cell index, so nothing is stored): layer factors p (parallax), s (scale),
// dy (world offset of the layer's cloud line above the sea), r0..r1 puff radius (m), sp = cell width (m)
function seaTint(bd, prog, shadeK) {
  const sk = skyAt(bd.theme, prog);
  const q = Math.round(prog * 8) / 8;
  const lum = (sk[1][0] * 0.3 + sk[1][1] * 0.59 + sk[1][2] * 0.11) / 255; // night skies darken the clouds
  const dark = clamp(1 - lum * 1.9, 0, 0.75);
  const top = rgb(mixRgb(mixRgb([255, 255, 255], sk[2], 0.3 + 0.25 * shadeK), [40, 30, 90], dark * 0.8));
  const bot = rgb(mixRgb(mixRgb(sk[1], [150, 165, 235], 0.45), [20, 14, 60], dark * 0.7));
  return { key: q, top, bot };
}
let tintCache = { id: '', q: -1, t: null };
function seaSprite(bd, prog, shadeK, id) {
  const q = Math.round(prog * 8);
  const key = `${bd.theme.sky[0]}${bd.theme.skyDusk[0]}|${id}|${q}`;
  if (tintCache.id === key && tintCache.sp) return tintCache.sp;
  const tt = seaTint(bd, q / 8, shadeK);
  const sp = puffSpr(tt.top, tt.bot);
  tintCache = { id: key, sp };
  return sp;
}
const layerSprites = new Map();
function layerSprite(bd, prog, shadeK, id) {
  const q = Math.round(prog * 8);
  const key = `${bd.theme.skyDusk[0]}${bd.theme.sky[0]}|${id}|${q}`;
  let sp = layerSprites.get(key);
  if (sp) return sp;
  if (layerSprites.size > 60) layerSprites.clear();
  const tt = seaTint(bd, q / 8, shadeK);
  sp = puffSpr(tt.top, tt.bot);
  if (sp) layerSprites.set(key, sp);
  return sp;
}

function seaLayer(ctx, view, cam, bd, prog, p, s, dy, r0, r1, id) {
  const { W, H } = view, z = cam.z;
  const spr = layerSprite(bd, prog, 1 - id / 3, id);
  if (!spr) return;
  const k = z * s;
  const sp = r0 * 1.15; // cell width (m)
  const base = bd.sea + dy;
  const x0 = cam.x * p - (W / 2) / k - r1, x1 = cam.x * p + (W / 2) / k + r1;
  const c0 = Math.floor(x0 / sp), c1 = Math.ceil(x1 / sp);
  const t = view.t || 0;
  const syBase = H / 2 - (base - cam.y * p) * k; // screen y of the cloud line
  if (syBase > H + r1 * k * 2) return;
  // a solid body below the tops, so the cells never show sky between them
  const tc = layerBodyColor(bd, prog, id);
  ctx.fillStyle = tc;
  ctx.fillRect(0, Math.max(0, syBase + r0 * k * 0.1), W, H);
  for (let c = c0; c <= c1; c++) {
    const h1 = hash2(c, 17 + id * 101) / 4294967296, h2 = hash2(c, 91 + id * 53) / 4294967296;
    const r = r0 + (r1 - r0) * h1;
    const wx = c * sp + h2 * sp * 0.8 + Math.sin(t * 0.15 + c) * 0.6;
    if (id < 3 && h2 < 0.2) continue; // gaps in the far banks: the sky shows between them
    const wy = base + (h1 - 0.5) * r0 * 1.3 - r * 0.2;
    const sx = W / 2 + (wx - cam.x * p) * k, sy = H / 2 - (wy - cam.y * p) * k, rr = r * k * 1.07;
    ctx.drawImage(spr, sx - rr, sy - rr, rr * 2, rr * 2);
  }
}
const bodyCache = new Map();
function layerBodyColor(bd, prog, id) {
  const q = Math.round(prog * 8);
  const key = `${bd.theme.skyDusk[0]}${bd.theme.sky[0]}|b${id}|${q}`;
  let c = bodyCache.get(key);
  if (c) return c;
  if (bodyCache.size > 80) bodyCache.clear();
  const tt = seaTint(bd, q / 8, 1 - id / 3);
  c = tt.bot;
  bodyCache.set(key, c);
  return c;
}

// the near cloud sea, drawn over the island undersides (screen space; the caller restores the world transform)
export function drawSeaNear(ctx, view, cam, bd, t, prog) {
  view.t = t;
  seaLayer(ctx, view, cam, bd, prog, 1, 1, 0, 3, 5.5, 3);
}

// ---------- islands (world space) ----------
function depthAt(x, I, top, sea) {
  const u = clamp((x - I.x0) / (I.x1 - I.x0), 0, 1);
  const e = Math.pow(Math.sin(Math.PI * u), 0.7);
  const jag = 0.86 + 0.14 * Math.sin(x * 0.7 + I.ph * 3) + 0.06 * Math.sin(x * 2.3 + I.ph);
  const dmax = I.launch ? Math.max(14, top - sea + 9) : clamp((I.x1 - I.x0) * 0.2 + 4, 7, 17);
  return Math.max(0.6, dmax * e * jag);
}

export function drawSkyWorld(ctx, course, bd, vis, lw, cam, t) {
  const th = bd.theme, sea = course.sky.sea;
  const launch = { x0: course.sky.launchX0, x1: course.xL, ph: 1.3, launch: true };
  if (launch.x1 > vis.x0 - 3 && launch.x0 < vis.x1 + 3) drawIsland(ctx, course, launch, vis, lw, cam, th, sea, t, true);
  const isl = course.islands;
  // first island whose far edge is in view (islands are sorted)
  let k = course.islIdx(vis.x0);
  if (k < 0) { const nx = course.islAfter(vis.x0); k = nx ? nx.i : isl.length; }
  for (; k < isl.length && isl[k].x0 < vis.x1 + 3; k++) drawIsland(ctx, course, isl[k], vis, lw, cam, th, sea, t, false);
}

function drawIsland(ctx, course, I, vis, lw, cam, th, sea, t, isLaunch) {
  const z = cam.z;
  const a = Math.max(I.x0, vis.x0 - 3), b = Math.min(I.x1, vis.x1 + 3);
  if (b <= a) return;
  const step = Math.max(0.5, 2.4 / z);
  const topOf = isLaunch ? course.launchTop : (x) => course.islandTop(I, x);
  const xs = [];
  for (let x = a; x < b; x += step) xs.push(x);
  xs.push(b);
  const n = xs.length;
  const ty = new Array(n), dp = new Array(n);
  for (let i = 0; i < n; i++) { ty[i] = isLaunch && xs[i] <= 0 ? course.plateau : topOf(xs[i]); dp[i] = depthAt(xs[i], I, ty[i], sea); }
  const rock = th.groundDark, rockLo = shade(th.groundDark, -0.3), soil = mix(th.ground, th.groundDark, 0.55), grass = th.ground;
  // rock underside
  ctx.beginPath();
  ctx.moveTo(xs[0], ty[0]);
  for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ty[i]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], ty[i] - dp[i]);
  ctx.closePath();
  ctx.fillStyle = rock;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // the lower half darker, with a few strata
  ctx.beginPath();
  ctx.moveTo(xs[0], ty[0] - dp[0] * 0.5);
  for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ty[i] - dp[i] * 0.5);
  ctx.lineTo(xs[n - 1], ty[n - 1] - 80);
  ctx.lineTo(xs[0], ty[0] - 80);
  ctx.closePath();
  ctx.fillStyle = rockLo;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 0.22;
  for (let q = 0; q < 2; q++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const y = ty[i] - dp[i] * (0.28 + q * 0.2) - 1.2 * Math.sin(xs[i] * 0.2 + q); if (i === 0) ctx.moveTo(xs[i], y); else ctx.lineTo(xs[i], y); }
    ctx.stroke();
  }
  // soil band and grass on top
  ctx.beginPath();
  ctx.moveTo(xs[0], ty[0]);
  for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ty[i]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], ty[i] - (1.7 + 0.5 * Math.sin(xs[i] * 0.9 + I.ph)) * (0.4 + 0.6 * Math.min(1, dp[i] / 3)));
  ctx.closePath();
  ctx.fillStyle = soil;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xs[0], ty[0]);
  for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ty[i]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], ty[i] - 0.85 - 0.25 * Math.sin(xs[i] * 1.3));
  ctx.closePath();
  ctx.fillStyle = grass;
  ctx.fill();
  ctx.restore();
  // glowing crystals hanging under the island
  const nc = Math.max(1, Math.round((I.x1 - I.x0) / 34));
  const cr = hash2(Math.round(I.x0), 5);
  for (let c = 0; c < nc; c++) {
    const u = (c + 0.5 + ((cr >> (c % 8)) & 3) * 0.08) / nc, cx = I.x0 + (I.x1 - I.x0) * u;
    if (cx < vis.x0 - 3 || cx > vis.x1 + 3) continue;
    const top = isLaunch && cx <= 0 ? course.plateau : topOf(cx), d = depthAt(cx, I, top, sea);
    if (d < 4) continue;
    const by = top - d * 0.92, h = 1.4 + d * 0.16, w = 0.5 + d * 0.035;
    ctx.beginPath();
    ctx.moveTo(cx - w, by + 0.4); ctx.lineTo(cx, by - h); ctx.lineTo(cx + w, by + 0.4); ctx.lineTo(cx, by + h * 0.25); ctx.closePath();
    ctx.fillStyle = th.glow || '#7fe8ff';
    ctx.fill();
    ctx.lineWidth = lw * 0.8; ctx.strokeStyle = OUT; ctx.stroke();
    const gs = h * 4.2;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2 + c);
    const gsp = glowSpr(th.glow || '#7fe8ff');
    if (gsp) ctx.drawImage(gsp, cx - gs / 2, by - h * 0.4 - gs / 2, gs, gs);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // outline + lit lip
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const y = ty[i] - lw * 1.4; if (i === 0) ctx.moveTo(xs[i], y); else ctx.lineTo(xs[i], y); }
  ctx.strokeStyle = shade(grass, 0.32); ctx.lineWidth = lw * 1.7; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(xs[0], ty[0]);
  for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ty[i]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], ty[i] - dp[i]);
  ctx.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  // little things on top: tufts, flowers
  if (cam.z > 5.5) {
    const s0 = Math.floor(a / 3.1);
    for (let s = s0; s * 3.1 < b; s++) {
      const h = hash2(s, 313) / 4294967296;
      if (h < 0.5) continue;
      const x = s * 3.1 + h * 2.2;
      if (x < I.x0 + 2 || x > I.x1 - 2 || (isLaunch && x < course.sky.launchX0 + 2)) continue;
      const y = isLaunch && x <= 0 ? course.plateau : topOf(x);
      if (isLaunch && x < 6 && x > course.rampStart - 4) continue; // the ramp's feet
      if (h < 0.82) {
        ctx.fillStyle = shade(grass, -0.18);
        ctx.beginPath(); ctx.ellipse(x, y + 0.05, 0.3 + h * 0.25, 0.2 + h * 0.1, 0, 0, Math.PI); ctx.fill();
      } else {
        ctx.strokeStyle = shade(grass, -0.3); ctx.lineWidth = lw * 0.7;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 0.55); ctx.stroke();
        ctx.fillStyle = h > 0.92 ? th.accent : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y + 0.62, 0.17, 0, TAU); ctx.fill();
      }
    }
  }
}

// ---------- gravity well (world space) ----------
export function drawWell(ctx, w, t, lw) {
  const { x, y, R } = w;
  const gl = glowSpr('#8f6bff'), gl2 = glowSpr('#e9d9ff');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.65;
  if (gl) ctx.drawImage(gl, x - R * 1.25, y - R * 1.25, R * 2.5, R * 2.5);
  ctx.lineCap = 'round';
  const rot = t * 2.2;
  for (let arm = 0; arm < 4; arm++) {
    for (let s = 0; s < 12; s++) {
      const u0 = s / 12, u1 = (s + 1) / 12;
      const r0 = lerp(R * 0.95, R * 0.07, u0), r1 = lerp(R * 0.95, R * 0.07, u1);
      const a0 = rot + (arm * Math.PI) / 2 + u0 * 4.2, a1 = rot + (arm * Math.PI) / 2 + u1 * 4.2;
      ctx.strokeStyle = arm % 2 ? `rgba(127,232,255,${(0.1 + 0.55 * u0).toFixed(2)})` : `rgba(200,150,255,${(0.1 + 0.55 * u0).toFixed(2)})`;
      ctx.lineWidth = R * (0.014 + 0.045 * (1 - u0));
      ctx.beginPath(); ctx.moveTo(x + r0 * Math.cos(a0), y + r0 * Math.sin(a0)); ctx.lineTo(x + r1 * Math.cos(a1), y + r1 * Math.sin(a1)); ctx.stroke();
    }
  }
  const spk = sparkSpr();
  if (spk) {
    for (let i = 0; i < 18; i++) {
      const ph = (i / 18 + t * 0.32) % 1;
      const rr = R * 1.0 * Math.pow(1 - ph, 1.25) + R * 0.07, an = i * 2.39 + ph * 7 + rot * 0.4;
      ctx.globalAlpha = clamp(ph * (1 - ph) * 4, 0, 1);
      const sz = R * (0.07 + 0.06 * (1 - ph));
      ctx.drawImage(spk, x + rr * Math.cos(an) - sz / 2, y + rr * Math.sin(an) - sz / 2, sz, sz);
    }
  }
  ctx.globalAlpha = 0.9;
  if (gl2) ctx.drawImage(gl2, x - R * 0.34, y - R * 0.34, R * 0.68, R * 0.68);
  ctx.restore();
  ctx.fillStyle = '#120a33';
  ctx.beginPath(); ctx.arc(x, y, R * 0.075, 0, TAU); ctx.fill();
  ctx.lineWidth = lw * 1.2; ctx.strokeStyle = 'rgba(220,190,255,.95)'; ctx.stroke();
}

// ---------- boost ring (world space; half 'back' under the car, 'front' over it) ----------
export function drawBoostRing(ctx, a, t, half, lw, k) {
  const rx = a.r * 0.36 * (1 + k * 0.8), ry = a.r * (1 + k * 0.45);
  const a0 = half === 'back' ? Math.PI / 2 : -Math.PI / 2;
  ctx.globalAlpha = 1 - k;
  if (half === 'back') {
    const gl = glowSpr('#22d3ff');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - k) * (0.55 + 0.12 * Math.sin(t * 5 + a.id));
    if (gl) ctx.drawImage(gl, a.x - ry * 1.9, a.y - ry * 1.9, ry * 3.8, ry * 3.8);
    ctx.restore();
    ctx.globalAlpha = 1 - k;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = 'rgba(34,211,255,0.12)'; ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, rx, ry, 0, a0, a0 + Math.PI);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 0.62 + lw * 1.5;
  ctx.stroke();
  ctx.strokeStyle = half === 'back' ? '#1aa9d6' : '#22d3ff';
  ctx.lineWidth = 0.62;
  ctx.stroke();
  ctx.strokeStyle = half === 'back' ? 'rgba(180,240,255,.7)' : 'rgba(240,253,255,.95)';
  ctx.lineWidth = 0.17;
  ctx.stroke();
  // chevrons running around the hoop
  if (half === 'front') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const ang = (((i / 6 + t * 0.55 + a.id * 0.13) % 1) * Math.PI) - Math.PI / 2;
      ctx.beginPath(); ctx.arc(a.x + Math.cos(ang) * rx, a.y + Math.sin(ang) * ry, 0.2, 0, TAU); ctx.fill();
    }
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

// ---------- Spell Boost gate (world space; letters never shown: a star and sparkles only) ----------
export function drawGate(ctx, gt, t, half, lw, k, frozen) {
  const rx = gt.r * 0.55, ry = gt.r * 1.45;
  const a0 = half === 'back' ? Math.PI / 2 : -Math.PI / 2;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
  ctx.globalAlpha = 1 - k;
  if (half === 'back') {
    const gl = glowSpr('#ffcf1a'), gv = glowSpr('#b58cff');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - k) * (0.5 + 0.2 * pulse + (frozen ? 0.2 : 0));
    if (gv) ctx.drawImage(gv, gt.x - ry * 1.6, gt.y - ry * 1.6, ry * 3.2, ry * 3.2);
    ctx.globalAlpha = (1 - k) * 0.4;
    if (gl) ctx.drawImage(gl, gt.x - ry * 1.1, gt.y - ry * 1.1, ry * 2.2, ry * 2.2);
    ctx.restore();
    ctx.globalAlpha = 1 - k;
    // the portal: a violet-to-gold pane
    const pg = ctx.createLinearGradient(gt.x, gt.y - ry, gt.x, gt.y + ry);
    pg.addColorStop(0, 'rgba(181,140,255,0.38)'); pg.addColorStop(1, 'rgba(255,207,26,0.3)');
    ctx.beginPath(); ctx.ellipse(gt.x, gt.y, rx, ry, 0, 0, TAU); ctx.fillStyle = pg; ctx.fill();
    // a four-point star in the middle
    ctx.save();
    ctx.translate(gt.x, gt.y);
    ctx.rotate(t * 0.6);
    const s0 = ry * 0.34 * (0.9 + 0.12 * pulse);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s0 * 0.32 : s0, ang = (i * Math.PI) / 4; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
    ctx.closePath();
    ctx.fillStyle = '#fff6c9'; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(gt.x, gt.y, rx, ry, 0, a0, a0 + Math.PI);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.9 + lw * 1.6; ctx.stroke();
  ctx.strokeStyle = half === 'back' ? '#d99a1e' : '#ffcf1a'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = half === 'back' ? 'rgba(255,240,190,.7)' : 'rgba(255,252,225,.95)'; ctx.lineWidth = 0.2; ctx.stroke();
  if (half === 'front') {
    const spk = sparkSpr();
    if (spk) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const ang = t * 0.9 + (i * TAU) / 9, rr = 1 + 0.12 * Math.sin(t * 2 + i);
        const sz = 1.1 + 0.5 * Math.sin(t * 3 + i * 2);
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.drawImage(spk, gt.x + Math.cos(ang) * rx * rr - sz / 2, gt.y + Math.sin(ang) * ry * rr - sz / 2, sz, sz);
      }
      ctx.restore();
    }
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

// soft glow behind the hovering car while the run is frozen at the gate
export function drawIdleGlow(ctx, x, y, t, r) {
  const gl = glowSpr('#ffe9a8'), gv = glowSpr('#b58cff');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 2.4);
  if (gv) ctx.drawImage(gv, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 2.4 + 1);
  if (gl) ctx.drawImage(gl, x - r * 1.5, y - r * 1.5, r * 3, r * 3);
  const spk = sparkSpr();
  if (spk) {
    for (let i = 0; i < 7; i++) {
      const ang = t * 0.7 + (i * TAU) / 7, rr = r * (1.25 + 0.2 * Math.sin(t * 1.7 + i));
      const sz = r * (0.28 + 0.14 * Math.sin(t * 3 + i * 1.7));
      ctx.globalAlpha = 0.9;
      ctx.drawImage(spk, x + Math.cos(ang) * rr - sz / 2, y + Math.sin(ang) * rr * 0.8 - sz / 2, sz, sz);
    }
  }
  ctx.restore();
}
