// Wagon West frame composition: the sky (by biome and weather, with the sun, stars and clouds), the parallax layers,
// the stop set piece, the critters, the wagon and the party, dust, the weather (rain, storm with lightning, snow,
// the dusk tint), the celebrations, the mini-games and the view fade. Engine state goes in (engine.js owns it); this
// module only draws, plus the per-frame upkeep of its own particle pools (fixed arrays, nothing allocated per frame).
//
// Budget (SPEC §11): <= 8 ms of game code per frame at 4x CPU throttle on a phone-sized canvas. What keeps it there:
// the landscape and every set piece are pre-rendered tiles (a frame blits ~6 images), particles are batched into one
// path per kind, sky gradients and cloud sprites are cached, and reducedMotion thins every particle system.

import { TAU, OUT, clamp, lerp, ease, mix, shade, rgba, mkCanvas, mulberry32, drawText } from './util.js';
import { BIOMES, SPEED } from './biomes.js';
import { drawWagon, drawTeam, drawPerson, drawCritter, drawCampfire, drawDog } from './sprites.js';

// ---------------------------------------------------------------- weather looks
export const WEATHERS = ['clear', 'rain', 'storm', 'dusk', 'snow'];
const WX = {
  clear: { sky: null, tint: null, tintA: 0, rain: 0, snow: 0, clouds: 4, cloud: 'white', sun: 'day', dust: 1 },
  rain: { sky: ['#6f7f94', '#b9c3cc'], tint: '#28405a', tintA: 0.16, rain: 80, snow: 0, clouds: 6, cloud: 'grey', sun: null, dust: 0.25 },
  storm: { sky: ['#343c50', '#69707f'], tint: '#141a32', tintA: 0.32, rain: 140, snow: 0, clouds: 7, cloud: 'dark', sun: null, dust: 0.15 },
  dusk: { sky: ['#3a3474', '#f59a5c'], tint: '#ff6a28', tintA: 0.12, rain: 0, snow: 0, clouds: 3, cloud: 'pink', sun: 'dusk', dust: 0.8 },
  snow: { sky: ['#a7b5c6', '#e8edf3'], tint: '#e6eeff', tintA: 0.16, rain: 0, snow: 90, clouds: 6, cloud: 'grey', sun: 'pale', dust: 0.2 },
};
export const wxOf = (w) => (WX[w] ? w : 'clear');
const CLOUD_TONES = { white: ['#ffffff', '#dfe9f2'], grey: ['#d4d9e0', '#aab3be'], dark: ['#6a7080', '#4c5262'], pink: ['#ffd2c0', '#e8a0a0'] };

const cloudSprites = {};
function cloudSprite(tone) {
  if (cloudSprites[tone]) return cloudSprites[tone];
  const [fill, under] = CLOUD_TONES[tone];
  const w = 240, h = 110, cv = mkCanvas(w, h), c = cv.getContext('2d');
  const blobs = [[60, 70, 34], [100, 52, 44], [148, 58, 38], [184, 74, 28], [40, 82, 22]];
  c.beginPath(); for (const [x, y, r] of blobs) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  c.rect(30, 74, 170, 24);
  c.fillStyle = fill; c.fill();
  c.lineWidth = 5; c.strokeStyle = rgba(OUT, 0.18); c.stroke();
  c.fillStyle = fill; c.fill();
  c.fillStyle = under; c.fillRect(30, 88, 170, 10);
  cloudSprites[tone] = cv;
  return cv;
}
const CLOUDS = (() => { const r = mulberry32(31); return Array.from({ length: 8 }, () => ({ x: r(), y: 0.04 + r() * 0.2, s: 0.5 + r() * 0.6, v: 0.004 + r() * 0.008 })); })();
const STARS = (() => { const r = mulberry32(5); return Array.from({ length: 40 }, () => ({ x: r(), y: r() * 0.4, s: 0.8 + r() * 1.6, p: r() * TAU })); })();

// ---------------------------------------------------------------- particle pools (created once per scene)
export function createFx() {
  const r = mulberry32(77);
  return {
    rain: Array.from({ length: 140 }, () => ({ x: r(), y: r(), v: 0.9 + r() * 0.5 })),
    snow: Array.from({ length: 90 }, () => ({ x: r(), y: r(), v: 0.05 + r() * 0.07, w: r() * TAU, s: 1.5 + r() * 2.5 })),
    dust: Array.from({ length: 28 }, () => ({ on: false, x: 0, y: 0, r: 0, life: 0, max: 1, vx: 0, vy: 0 })),
    conf: Array.from({ length: 160 }, () => ({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, life: 0, max: 1, col: '#fff', s: 4 })),
    dustAcc: 0, nextBolt: 4, flash: 0, bolt: 0, boltX: 0.5, flashes: 0, rand: r,
    drawn: { rain: 0, snow: 0, dust: 0, conf: 0 },
  };
}
const CONF_COLS = ['#ff5d5d', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff', '#ff7ad1', '#ffffff'];

// x, y: where a 'star' goes off (default the wagon on the trail); the other kinds fill the screen
export function burst(S, kind, bx, by) {
  const fx = S.fx, r = fx.rand, L = S.L, k = L.k, rm = S.rm;
  const want = kind === 'arrived' ? (rm ? 40 : 150) : kind === 'river' ? (rm ? 30 : 120) : (rm ? 14 : 40);
  let n = 0;
  const spawn = (fn) => { for (const p of fx.conf) { if (p.on) continue; p.on = true; fn(p); if (++n >= want) return; } };
  if (kind === 'arrived') {
    spawn((p) => { p.kind = 0; p.x = r() * L.W; p.y = -10 - r() * L.H * 0.4; p.vx = (r() - 0.5) * 40 * k; p.vy = (60 + r() * 80) * k; p.a = r() * TAU; p.va = (r() - 0.5) * 10; p.life = 0; p.max = 2.6 + r(); p.col = CONF_COLS[Math.floor(r() * CONF_COLS.length)]; p.s = (4 + r() * 4) * k; });
  } else if (kind === 'river') { // fireworks: three bursts over the far bank
    for (let b = 0; b < 3; b++) {
      const cx = L.W * (0.3 + b * 0.22 + r() * 0.06), cy = L.H * (0.16 + r() * 0.12), col = CONF_COLS[b * 2 % CONF_COLS.length], delay = b * 0.35;
      let m = 0;
      spawn((p) => { const a = r() * TAU, sp = (60 + r() * 90) * k; p.kind = 1; p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.life = -delay; p.max = 1.3 + r() * 0.4; p.col = col; p.s = (2.5 + r() * 1.5) * k; m++; });
      if (n >= want) break;
    }
  } else { // star: sparkles around the wagon
    const cx = bx != null ? bx : S.wagonX, cy = by != null ? by : L.gy - 70 * k;
    spawn((p) => { const a = r() * TAU, sp = (50 + r() * 110) * k; p.kind = 2; p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 40 * k; p.a = r() * TAU; p.va = (r() - 0.5) * 6; p.life = 0; p.max = 1.1 + r() * 0.5; p.col = r() < 0.7 ? '#ffd23f' : '#ffffff'; p.s = (5 + r() * 5) * k; });
  }
}

// ---------------------------------------------------------------- upkeep (dt in seconds)
export function updateFx(S, dt) {
  const fx = S.fx, L = S.L, k = L.k, rm = S.rm;
  const w = WX[S.wxCur];
  // rain falls (fractions of the screen per second), snow drifts
  const rv = S.wxCur === 'storm' ? 1.5 : 1.1;
  for (const d of fx.rain) { d.y += d.v * rv * dt * (rm ? 0.6 : 1); d.x -= 0.12 * dt; if (d.y > 1.05) { d.y -= 1.1; d.x = fx.rand(); } if (d.x < -0.05) d.x += 1.1; }
  for (const f of fx.snow) { f.y += f.v * dt * (rm ? 0.6 : 1); f.w += dt * 1.3; if (f.y > 1.03) { f.y -= 1.06; f.x = fx.rand(); } }
  // lightning (never with reduced motion)
  fx.flash = Math.max(0, fx.flash - dt * 3.2); fx.bolt = Math.max(0, fx.bolt - dt);
  if (S.wxCur === 'storm' && !rm && S.view !== 'post') {
    fx.nextBolt -= dt;
    if (fx.nextBolt <= 0) { fx.flash = 0.55; fx.bolt = 0.16; fx.boltX = 0.15 + fx.rand() * 0.7; fx.nextBolt = 3.5 + fx.rand() * 4.5; fx.flashes++; }
  }
  // dust behind the wheels and hooves while rolling
  const speed = S.speed;
  if (S.view === 'trail' && speed > 4 * k) {
    fx.dustAcc += dt * (speed / (60 * k)) * 9 * w.dust * (rm ? 0.3 : 1) * (S.biome === 'gorge' || S.biome === 'valley' ? 0.6 : 1);
    while (fx.dustAcc >= 1) {
      fx.dustAcc -= 1;
      const p = fx.dust.find((q) => !q.on);
      if (!p) break;
      const fromWheel = fx.rand() < 0.55;
      p.on = true; p.life = 0; p.max = 0.7 + fx.rand() * 0.6;
      p.x = fromWheel ? S.wagonX - 40 * k : S.wagonX + (110 + fx.rand() * 130) * k;
      p.y = L.gy - 2 * k + fx.rand() * 4 * k;
      p.r = (4 + fx.rand() * 4) * k; p.vx = -speed * (0.3 + fx.rand() * 0.3); p.vy = -(8 + fx.rand() * 12) * k;
    }
  }
  for (const p of fx.dust) if (p.on) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 9 * k; if (p.life >= p.max) p.on = false; }
  // confetti / sparks
  for (const p of fx.conf) {
    if (!p.on) continue;
    p.life += dt;
    if (p.life < 0) continue;
    if (p.kind === 0) { p.vy = Math.min(p.vy + 30 * k * dt, 140 * k); p.x += (p.vx + Math.sin(p.life * 3 + p.a) * 30 * k) * dt; p.y += p.vy * dt; p.a += p.va * dt; }
    else if (p.kind === 1) { p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 40 * k * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    else { p.vx *= 1 - 2 * dt; p.vy = p.vy * (1 - 2 * dt) + 30 * k * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; }
    if (p.life >= p.max || p.y > L.H + 20) p.on = false;
  }
}

// ---------------------------------------------------------------- sky
const gradCache = new Map();
function skyGrad(ctx, top, bottom, H) {
  const key = top + bottom + H;
  let g = gradCache.get(key);
  if (!g) {
    if (gradCache.size > 24) gradCache.clear();
    g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    gradCache.set(key, g);
  }
  return g;
}
export function skyColors(biome, wx) {
  const pal = BIOMES[biome] || BIOMES.prairie;
  const w = WX[wx];
  if (!w.sky) return pal.sky;
  if (wx === 'rain' || wx === 'snow') return [mix(pal.sky[0], w.sky[0], 0.75), mix(pal.sky[1], w.sky[1], 0.75)];
  return w.sky;
}
function drawSky(ctx, S) {
  const L = S.L, W = L.W, H = L.H, k = L.k;
  const prev = S.wxPrev, cur = S.wxCur, m = S.wxMix;
  if (m < 1) { const c0 = skyColors(S.biome, prev); ctx.fillStyle = skyGrad(ctx, c0[0], c0[1], H); ctx.fillRect(0, 0, W, H * 0.75); }
  ctx.globalAlpha = m;
  const c1 = skyColors(S.biome, cur); ctx.fillStyle = skyGrad(ctx, c1[0], c1[1], H); ctx.fillRect(0, 0, W, H * 0.75);
  ctx.globalAlpha = 1;
  const w = WX[cur];
  // stars at dusk
  if (cur === 'dusk') {
    ctx.fillStyle = '#fff6d8';
    for (const s of STARS) { ctx.globalAlpha = m * (0.5 + 0.5 * Math.sin(S.t * (S.rm ? 0 : 2) + s.p)); ctx.fillRect(s.x * W, s.y * H * 0.6, s.s * k, s.s * k); }
    ctx.globalAlpha = 1;
  }
  // the sun
  if (w.sun) {
    ctx.globalAlpha = m;
    if (w.sun === 'day') {
      const x = W * 0.84, y = H * 0.15, r = 22 * k;
      ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, TAU); ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#ffe36a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f0b400'; ctx.stroke();
    } else if (w.sun === 'dusk') {
      const x = W * 0.76, y = H * 0.55, r = 40 * k;
      ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fillStyle = 'rgba(255,170,90,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#ff9a3a'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.16, 18 * k, 0, TAU); ctx.fillStyle = 'rgba(255,255,240,0.7)'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // clouds drift with time and a little with the trail
  const sp = cloudSprite(w.cloud), n = w.clouds;
  for (let i = 0; i < n; i++) {
    const c = CLOUDS[i], cw = 150 * k * c.s, ch = cw * (110 / 240);
    const span = W + cw;
    let x = ((c.x * span - S.t * c.v * W * (S.rm ? 0.3 : 1) - S.scroll * 0.02) % span + span) % span - cw;
    ctx.globalAlpha = i < 4 ? m : m * 0.9;
    ctx.drawImage(sp, x, c.y * H * (cur === 'storm' ? 0.7 : 1), cw, ch);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- layers
function blitLayer(ctx, S, layer, speed) {
  const L = S.L, P = L.P, d = L.ldpr;
  let off = (S.scroll * speed) % P; if (off < 0) off += P;
  off = Math.round(off * L.dpr) / L.dpr;
  const sw = layer.cv.width, sh = layer.cv.height;
  for (let x = -off; x < L.W; x += P) ctx.drawImage(layer.cv, 0, 0, sw, sh, x, layer.y0, P, layer.h);
  void d;
}
function blitPiece(ctx, p, x, y, s) {
  if (s === 1) ctx.drawImage(p.cv, p.x0, p.y0, p.w, p.h);
  else ctx.drawImage(p.cv, x, y, p.w * s, p.h * s);
}

// ---------------------------------------------------------------- the party
function drawParty(ctx, S, front) {
  const L = S.L, k = L.k, gy = L.gy, P = S.party;
  const amp = S.walkAmp, ph = S.walkPh;
  const cheer = S.cheerT > 0 ? 1.8 - S.cheerT : 0;
  const looks = P.looks;
  const pos = S.partyPos;
  for (let i = 0; i < looks.length && i < 3; i++) {
    const p = pos[i];
    if (!!p.front !== front) continue;
    drawPerson(ctx, p.x, p.y, k * (p.s || 1), looks[i], ph + i * 1.9, amp * (i === 2 ? 0.9 : 1), cheer > 0 ? cheer + i * 0.12 : 0, p.dir || 1);
  }
  void gy;
}
function drawTrain(ctx, S) {
  const L = S.L, k = L.k, gy = L.gy;
  const bob = S.walkAmp > 0.05 && !S.rm ? Math.abs(Math.sin(S.walkPh * 2)) * 1.4 : 0;
  drawTeam(ctx, S.wagonX + 96 * k, gy, k, S.party.animal, S.walkPh * 0.9, S.walkAmp * 0.9, S.view === 'stop' && S.backdrop === 'camp');
  drawWagon(ctx, S.wagonX, gy, k, S.party.wagon, S.wheelSpin, bob, S.t);
}

// the party's dog (v1.1), placed by the engine (S.dogPos); the derby draws its own running dog
function drawPartyDog(ctx, S) {
  const D = S.dogPos, k = S.L.k;
  drawDog(ctx, D.x, D.y, k * 1.05, S.dog.coat, S.dogPh, D.amp * (S.rm ? 0.6 : 1), S.t, S.dogBarkT > 0 ? S.dogBarkT / 0.7 : 0, D.dir, D.sit);
}

// ---------------------------------------------------------------- critters
function drawCritters(ctx, S, sky) {
  const L = S.L, k = L.k;
  for (const c of S.critters) {
    const isSky = c.kind === 'eagle';
    if (isSky !== sky) continue;
    for (let j = 0; j < c.n; j++) {
      const x = c.x - c.dir * j * 46 * k * (c.kind === 'bison' ? 1 : 0.8), y = c.y + (j % 2) * 5 * k;
      drawCritter(ctx, c.kind, x, y, c.s, c.dir, c.ph + j * 1.3);
    }
  }
}

// ---------------------------------------------------------------- weather on top
function drawWeather(ctx, S) {
  const L = S.L, W = L.W, H = L.H, k = L.k, fx = S.fx, rm = S.rm;
  const m = S.wxMix, cur = WX[S.wxCur], prev = WX[S.wxPrev];
  // tint
  if (prev.tint && m < 1) { ctx.globalAlpha = prev.tintA * (1 - m); ctx.fillStyle = prev.tint; ctx.fillRect(0, 0, W, H); }
  if (cur.tint) { ctx.globalAlpha = cur.tintA * m; ctx.fillStyle = cur.tint; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = 1;
  // rain
  const nRain = Math.round((cur.rain * m + prev.rain * (1 - m)) * (rm ? 0.35 : 1));
  if (nRain > 0) {
    const len = (S.wxCur === 'storm' ? 18 : 13) * k, sl = 4 * k;
    ctx.beginPath();
    for (let i = 0; i < nRain; i++) { const d = fx.rain[i], x = d.x * (W + 40) - 20, y = d.y * H; ctx.moveTo(x, y); ctx.lineTo(x - sl, y + len); }
    ctx.lineWidth = 1.6 * Math.max(1, k * 0.9); ctx.strokeStyle = 'rgba(220,235,255,0.55)'; ctx.stroke();
  }
  fx.drawn.rain = nRain;
  // snow
  const nSnow = Math.round((cur.snow * m + prev.snow * (1 - m)) * (rm ? 0.35 : 1));
  if (nSnow > 0) {
    ctx.beginPath();
    for (let i = 0; i < nSnow; i++) { const f = fx.snow[i], x = f.x * W + Math.sin(f.w) * 10 * k, y = f.y * H, s = f.s * k; ctx.rect(x, y, s, s); }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  }
  fx.drawn.snow = nSnow;
  // lightning
  if (fx.bolt > 0) {
    const x = fx.boltX * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 14 * k, H * 0.12); ctx.lineTo(x + 6 * k, H * 0.14); ctx.lineTo(x - 10 * k, H * 0.3); ctx.lineTo(x + 2 * k, H * 0.32); ctx.lineTo(x - 6 * k, H * 0.45);
    ctx.lineWidth = 3.5 * k; ctx.strokeStyle = '#fffbe0'; ctx.stroke();
  }
  if (fx.flash > 0) { ctx.globalAlpha = fx.flash * 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function drawDust(ctx, S) {
  const fx = S.fx, col = BIOMES[S.biome].trail;
  let n = 0;
  ctx.fillStyle = shade(col, 0.25);
  for (const p of fx.dust) {
    if (!p.on) continue;
    ctx.globalAlpha = 0.5 * (1 - p.life / p.max);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    n++;
  }
  ctx.globalAlpha = 1;
  fx.drawn.dust = n;
}
function drawConfetti(ctx, S) {
  const fx = S.fx, k = S.L.k, d = S.L.dpr;
  let n = 0;
  for (const p of fx.conf) {
    if (!p.on || p.life < 0) continue;
    n++;
    const a = clamp(1.4 - p.life / p.max * 1.4 + 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    if (p.kind === 0) { const ca = Math.cos(p.a) * d, sa = Math.sin(p.a) * d; ctx.setTransform(ca, sa, -sa, ca, p.x * d, p.y * d); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.setTransform(d, 0, 0, d, 0, 0); }
    else if (p.kind === 1) { ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    else {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const b = p.a + (i * TAU) / 4; ctx.lineTo(p.x + Math.cos(b) * p.s, p.y + Math.sin(b) * p.s); const b2 = b + TAU / 8; ctx.lineTo(p.x + Math.cos(b2) * p.s * 0.35, p.y + Math.sin(b2) * p.s * 0.35); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  fx.drawn.conf = n;
  void k;
}

// ---------------------------------------------------------------- stop extras (animated bits of a set piece)
function drawStopLife(ctx, S) {
  const L = S.L, k = L.k, t = S.t, sp = S.piece, rm = S.rm;
  if (!sp) return;
  const a = sp.anchors || {};
  if (sp.kind === 'river') {
    // ripples drift; the raft bobs with its ferryman
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const y = a.y0 + ((i + 0.5) / 10) * (a.y1 - a.y0), x = ((i * 137 + t * (rm ? 6 : 18) * (1 + (i % 3))) % (L.W + 60)) - 30;
      ctx.moveTo(x, y); ctx.lineTo(x + 18 * k, y);
    }
    ctx.lineWidth = 2 * k; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
    const bob = rm ? 0 : Math.sin(t * 1.8) * 2 * k, rx = a.raftX, ry = a.raftY + bob, rw = 120 * k;
    ctx.beginPath(); ctx.moveTo(rx, ry - 30 * k); ctx.lineTo(lerp(a.post1[0], a.post2[0], 0.5), lerp(a.post1[1], a.post2[1], 0.5) - 27 * k);
    ctx.lineWidth = 1.4 * k; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const lx = rx - rw / 2 + i * (rw / 8); ctx.moveTo(lx + rw / 8, ry); ctx.rect(lx, ry - 8 * k, rw / 8 - 1, 12 * k); }
    ctx.fillStyle = '#a8703e'; ctx.fill(); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(rx, ry + 5 * k, rw * 0.55, 4 * k, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5 * k; ctx.stroke();
    drawPerson(ctx, rx + rw * 0.25, ry - 6 * k, k * 0.9, S.ferryman, 0, 0, 0, -1);
    ctx.beginPath(); ctx.moveTo(rx + rw * 0.18, ry - 70 * k); ctx.lineTo(rx + rw * 0.05, ry + 14 * k); ctx.lineWidth = 3 * k; ctx.strokeStyle = '#6a4a2a'; ctx.stroke();
  } else if (sp.kind === 'valley' && a.smokeX) {
    ctx.fillStyle = 'rgba(240,240,240,0.7)';
    for (let i = 0; i < 4; i++) {
      const p = ((t * (rm ? 0.12 : 0.35) + i / 4) % 1);
      ctx.globalAlpha = 0.7 * (1 - p);
      ctx.beginPath(); ctx.arc(a.smokeX + Math.sin(p * 5 + i) * 6 * k + p * 20 * k, a.smokeY - p * 70 * k, (5 + p * 12) * k, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
function drawCampLight(ctx, S) {
  const L = S.L, k = L.k, a = S.piece.anchors;
  drawCampfire(ctx, a.fireX, a.fireY, k, S.t, S.rm);
  // a warm pool of light (cached gradient)
  const key = 'fire' + L.W + 'x' + L.H;
  let g = gradCache.get(key);
  if (!g) { g = ctx.createRadialGradient(a.fireX, a.fireY - 20 * k, 10 * k, a.fireX, a.fireY - 20 * k, 220 * k); g.addColorStop(0, 'rgba(255,190,90,0.32)'); g.addColorStop(1, 'rgba(255,190,90,0)'); gradCache.set(key, g); }
  ctx.fillStyle = g; ctx.fillRect(a.fireX - 230 * k, a.fireY - 250 * k, 460 * k, 330 * k);
}

// ---------------------------------------------------------------- the frame
export function drawFrame(ctx, S) {
  const L = S.L, W = L.W, H = L.H, ly = S.layers;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const view = S.view;
  if (view === 'stop' && S.piece && S.piece.z === 'cover') {
    blitPiece(ctx, S.piece, 0, 0, 1);
    drawConfetti(ctx, S);
  } else if ((view === 'fish' || view === 'ford') && S.mini) {
    drawSky(ctx, S);
    blitLayer(ctx, S, ly.far, SPEED.far);
    blitLayer(ctx, S, ly.mid, SPEED.mid);
    S.mini.drawBackground(ctx, L, S.t, S.rm);
    S.mini.draw(ctx, L, S.t, S.rm);
    drawWeather(ctx, S);
    if (view === 'ford') drawConfetti(ctx, S);
  } else if ((view === 'float' || view === 'raft') && S.mini) {
    // a river seen from above, painted by the mini-game itself (no sky, no parallax)
    S.mini.draw(ctx, L, S.t, S.rm);
    drawWeather(ctx, S);
    drawConfetti(ctx, S);
  } else {
    drawSky(ctx, S);
    drawCritters(ctx, S, true);
    const shake = view === 'stampede' && S.mini ? S.mini.shake : 0; // the ground shakes a little under the herd
    if (shake) ctx.translate(0, shake);
    blitLayer(ctx, S, ly.far, SPEED.far);
    // the stop ahead, rising over the horizon while the wagon approaches it
    if (view === 'trail' && S.approach > 0 && S.approachPiece) {
      const p = S.approachPiece, s = 0.5, e = ease(S.approach);
      const x = lerp(W + 10, W * 0.8 - p.w * s * 0.5, e), y = L.bands.far[1] - p.h * s + 4 * L.k;
      blitPiece(ctx, p, x, y, s);
    }
    blitLayer(ctx, S, ly.mid, SPEED.mid);
    if (view === 'stop' && S.piece && S.piece.z === 'mid') blitPiece(ctx, S.piece, 0, 0, 1);
    blitLayer(ctx, S, ly.near, SPEED.near);
    blitLayer(ctx, S, ly.ground, SPEED.ground);
    if (S.wxCur === 'snow' || S.wxPrev === 'snow') {
      ctx.globalAlpha = 0.45 * (S.wxCur === 'snow' ? S.wxMix : 1 - S.wxMix);
      ctx.fillStyle = '#f4f8ff'; ctx.fillRect(0, L.bands.ground[0], W, H - L.bands.ground[0]);
      ctx.globalAlpha = 1;
    }
    if ((view === 'hunt' || view === 'derby') && S.mini) {
      S.mini.draw(ctx, L, S.t, S.rm);
    } else if (view === 'stampede' && S.mini) {
      S.mini.drawBack(ctx, L, S.t, S.rm); // the herd, behind the wagon
      drawParty(ctx, S, false);
      drawTrain(ctx, S);
      if (S.dog) drawPartyDog(ctx, S);
      drawParty(ctx, S, true);
      blitLayer(ctx, S, ly.props, SPEED.props);
    } else {
      if (view === 'stop' && S.piece && S.piece.z === 'ground') blitPiece(ctx, S.piece, 0, 0, 1);
      if (view === 'stop') drawStopLife(ctx, S);
      drawCritters(ctx, S, false);
      drawDust(ctx, S);
      drawParty(ctx, S, false);
      drawTrain(ctx, S);
      if (view === 'stop' && S.backdrop === 'camp' && S.piece) drawCampLight(ctx, S);
      if (S.dog && (view === 'trail' || view === 'stop')) drawPartyDog(ctx, S);
      drawParty(ctx, S, true);
      blitLayer(ctx, S, ly.props, SPEED.props);
    }
    if (shake) ctx.translate(0, -shake);
    if (view === 'stampede' && S.mini) S.mini.drawFront(ctx, L, S.t, S.rm); // dust, the BRAKE sign, the words
    drawWeather(ctx, S);
    drawConfetti(ctx, S);
  }
  if (S.fade > 0) { ctx.globalAlpha = S.fade; ctx.fillStyle = '#fff4dc'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
export { drawText };
