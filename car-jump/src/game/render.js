// Canvas 2D renderer: bright flat cartoon style with bold outlines.
// World coordinates are meters with +y UP; the camera maps them to CSS pixels.

import { TAU, mulberry32, clamp, mix, shade, withAlpha, luminance } from './util.js';
import { drawChassis, drawWheel } from './car.js';

export const OUT = '#1d1b26';
const FONT = '900 {S}px "Arial Black", "Helvetica Neue", system-ui, -apple-system, sans-serif';
const font = (s) => FONT.replace('{S}', Math.round(s));

const STYLE_BY_TRACK = { canyon: 'mesa', city: 'city', desert: 'dunes', arctic: 'peaks', moon: 'lunar' };

// ---------- backdrop (parallax layers), generated once per run ----------
export function createBackdrop(track, seed) {
  const rand = mulberry32((seed * 31 + 7) >>> 0);
  const theme = track.theme;
  const style = STYLE_BY_TRACK[track.id] || 'hills';
  const night = luminance(theme.sky[0]) < 0.22;
  const P = 2400; // layer period in px
  const far = [], mid = [];
  const waves = (n) => Array.from({ length: n }, (_, i) => ({ n: 1 + Math.floor(rand() * (3 + i * 3)), a: rand(), p: rand() * TAU }));
  if (style === 'mesa') {
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
  return { style, night, P, far, mid, farW: waves(4), midW: waves(4), clouds, stars, theme };
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

function drawLayer(ctx, W, H, bd, shapes, waves, baseY, scale, off, fill, line, lw, isMid, t) {
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
  // flat ground under shapes
  ctx.fillRect(0, baseY, W, H - baseY + 2);
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
      }
      ctx.fill();
      ctx.stroke();
      // details
      if (style === 'peaks') {
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
        ctx.strokeStyle = withAlpha('#000000', 0.12);
        ctx.lineWidth = 3 * scale;
        for (let j = 1; j < 3; j++) {
          const yy = baseY - h + (h * j) / 3.2;
          ctx.beginPath();
          ctx.moveTo(x + w * 0.14, yy);
          ctx.lineTo(x + w * 0.88, yy);
          ctx.stroke();
        }
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

export function drawBackground(ctx, view, cam, bd, t) {
  const { W, H } = view;
  const theme = bd.theme;
  drawSky(ctx, W, H, theme);
  // horizon drifts down as the camera climbs so altitude reads on screen
  // and sinks toward the terrain baseline when zoomed far out over it
  const baseScreen = H / 2 + (cam.y - bd.baseY) * cam.z;
  const horizon = clamp(Math.max(H * 0.6 + clamp((cam.y - bd.baseY) * cam.z * 0.1, -H * 0.2, H * 0.42), baseScreen - H * 0.22), H * 0.3, H * 1.02);
  const zs = clamp(Math.pow(cam.z / 16, 0.35), 0.7, 1.25);

  if (bd.night) {
    for (let i = 0; i < bd.stars.length; i++) {
      const s = bd.stars[i];
      const x = (((s.x * W * 1.3 - cam.x * cam.z * 0.01) % (W * 1.3)) + W * 1.3) % (W * 1.3);
      const a = 0.55 + 0.45 * Math.sin(t * 2 + s.p);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(x, s.y * H, s.s, s.s);
    }
    // a big Earth (moon track) / moon
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
  } else {
    const sx = W * 0.78, sy = H * 0.2, sr = Math.min(W, H) * 0.085;
    ctx.fillStyle = 'rgba(255,250,200,0.35)';
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,200,0.45)';
    ctx.beginPath(); ctx.arc(sx, sy, sr * 1.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4a3';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f2b13a'; ctx.stroke();
    // clouds
    ctx.lineWidth = 3;
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
  }

  const farFill = theme.far, midFill = theme.mid;
  drawLayer(ctx, W, H, bd, bd.far, bd.farW, horizon, zs, cam.x * cam.z * 0.05, farFill, mix(farFill, '#000000', 0.25), 2.5, false, t);
  // atmospheric haze between layers
  if (!bd.night) {
    ctx.fillStyle = withAlpha(theme.sky[1], 0.25);
    ctx.fillRect(0, horizon - 40, W, H);
  }
  drawLayer(ctx, W, H, bd, bd.mid, bd.midW, horizon + 34 * zs, zs * 1.15, cam.x * cam.z * 0.16, midFill, mix(midFill, '#000000', 0.35), 3, true, t);
}

// ---------- world ----------
export function worldTransform(ctx, view, cam) {
  const d = view.dpr, z = cam.z;
  ctx.setTransform(d * z, 0, 0, -d * z, d * (view.W / 2 - cam.x * z + cam.sx), d * (view.H / 2 + cam.y * z + cam.sy));
}

export function drawTerrain(ctx, course, bd, vis, lw, cam) {
  const theme = bd.theme;
  const x0 = Math.max(vis.x0 - 2, course.rampStart - 400), x1 = vis.x1 + 2;
  const bottom = vis.y0 - 5;
  const step = Math.max(0.25, 5 / cam.z);
  const g = course.groundY;
  const pts = [];
  for (let x = x0; x <= x1 + step; x += step) pts.push(x, g(x));
  // body
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineTo(pts[pts.length - 2], bottom);
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
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] - 2.2 - 0.4 * Math.sin(pts[i] * 0.31));
  ctx.lineTo(pts[pts.length - 2], bottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha('#000000', 0.12);
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
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
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i], pts[i + 1] - 0.8); else ctx.lineTo(pts[i], pts[i + 1] - 0.8);
    }
    ctx.stroke();
    ctx.setLineDash([2, 2.5]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = bd.theme.accent;
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (style === 'lunar') {
    ctx.fillStyle = withAlpha('#000000', 0.16);
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
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(pts[i], pts[i + 1] - lw * 1.6); else ctx.lineTo(pts[i], pts[i + 1] - lw * 1.6);
  }
  ctx.strokeStyle = shade(theme.ground, 0.3);
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
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
      ctx.fillStyle = style === 'peaks' ? '#ffffff' : shade(theme.groundDark, -0.1);
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
  ctx.font = font(0.95);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 0.22;
  ctx.strokeStyle = OUT;
  ctx.strokeText('FINISH', 0, 0);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('FINISH', 0, 0);
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
export function drawPropPiece(ctx, kind, def, w, h, seg, segs, lw) {
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
        ctx.font = font(0.6);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = OUT;
        ctx.fillText('JUMP!', 0, 0);
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
    default: {
      ctx.fillStyle = c;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
  }
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
  for (const p of popups) {
    const k = p.t / p.life;
    let x, y;
    if (p.world) { const s = toScreen(p.x, p.y); x = s[0]; y = s[1]; } else { x = p.x * view.W; y = p.y * view.H; }
    y -= k * 46;
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
    const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const size = base * (p.scale || 1) * pop;
    ctx.globalAlpha = a;
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.strokeStyle = OUT;
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
