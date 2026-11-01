// Wagon West the voyage home (SPEC v1.5 §4.3, scene stream): the schooner from San Francisco up the coast and over the Columbia River bar,
// seen from behind, sailing up the screen. Long swells roll toward the ship in rows; each row has a calm gap (pale, smooth water): steer the
// schooner through it (drag left and right, or ← →). A swell that is hit is a thump, a splash and a rocking deck, never a loss ("sail" bump).
//
// startSail({ seed, length = 4 })  `length` markers ("Up the coast": a buoy floats up, the ship waits in calm water and emits
//   { type: 'sailMarker', n, of } until scene.sailGo()) then the Columbia bar (bigger swells, a narrower gap), then calm water and Oregon's green
//   shore (the party cheers) → { type: 'sailEnd', bumps }. { type: 'sail', bump: true } per swell hit.
//   Every run is built from the seed with the first row's gap away from the middle, so a ship left alone bumps at least once and one steered
//   through the gaps never does. No clock and no score are drawn.
// getState().mini = { kind: 'sail', phase: 'ready' | 'sail' | 'marker' | 'bar' | 'calm' | 'end', n, of, bumps, u, waiting, progress }
import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, rgba, drawText, rrect } from './util.js';
import { BIOMES } from './biomes.js';
import { drawHat } from './sprites.js';

export const SAIL = {
  rate: 0.26, // swell depth per second (0 horizon .. zs the ship)
  zs: 0.748, // where the ship is
  steer: 0.75, // channel widths per second
  ready: 1.0, calm: 3.2, linger: 2.4,
  coast: { n: 3, space: 1.75, gap: 0.42, h: 1 }, // swells in a stretch up the coast
  bar: { n: 4, space: 1.9, gap: 0.3, h: 1.9 }, // swells over the Columbia bar
};
const yh = (L) => L.H * 0.3; // the horizon
const yAt = (L, z) => yh(L) + (L.H * 0.985 - yh(L)) * Math.pow(clamp(z, 0, 1.2), 1.5);

export function createSail(opts, emit, S, hooks) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const length = clamp(Math.round(Number.isFinite(+o.length) ? +o.length : 4), 1, 8);
  const rand = mulberry32((seed ^ 0x5a11) || 1);
  const D = {
    kind: 'sail', view: 'sail', input: true, done: false, ended: false,
    phase: 'ready', stretch: 0, sT: 0, pt: 0, t: 0, bumps: 0, u: 0.5, tu: null, dragging: false, keyDir: 0, vel: 0, roll: 0, pitch: 0, waiting: false,
    swells: [], plan: [], planI: 0, lastG: 0.5, spray: [], texts: [], wake: [], shore: 0, buoyT: 0, cheer: 0, markerSent: false, stretchDone: false,
    foam: Array.from({ length: 46 }, () => ({ u: rand(), z: rand(), l: 0.04 + rand() * 0.07, v: 0.7 + rand() * 0.6 })),
    gulls: Array.from({ length: 4 }, (_, i) => ({ x: rand(), y: 0.06 + rand() * 0.16, v: 0.01 + rand() * 0.02, ph: rand() * TAU + i })),
  };
  const bar = () => D.stretch >= length;
  const text = (L, s, x, y, col = '#ffffff', size = 28) => D.texts.push({ s, x, y, col, size: size * L.k, t: 0 });
  // the swells of one stretch: gap centres walk by at most 0.3, the first one away from the middle (so a ship left alone bumps)
  function planStretch() {
    const cfg = bar() ? SAIL.bar : SAIL.coast, out = [];
    let g = D.stretch === 0 ? (rand() < 0.5 ? 0.24 : 0.76) : D.lastG;
    for (let i = 0; i < cfg.n; i++) {
      if (!(D.stretch === 0 && i === 0)) g = clamp(g + (rand() < 0.5 ? -1 : 1) * (0.14 + rand() * 0.16), 0.22, 0.78);
      if (i === 0 && D.stretch > 0) g = clamp(0.5 + (g < 0.5 ? 1 : -1) * (0.12 + rand() * 0.14), 0.22, 0.78);
      out.push({ at: 0.5 + i * cfg.space, g, gw: cfg.gap, h: cfg.h, ph: rand() * TAU });
    }
    D.lastG = g;
    D.plan = out; D.planI = 0; D.sT = 0; D.stretchDone = false;
  }
  const hull = (L) => 40 * sc(L);
  function sc(L) { return clamp(Math.min(L.H / 380, L.W / 420), 0.55, 1.6); }

  // ---- input (drag steers; ← → too)
  D.pointer = (L, x) => { if (D.ended) return false; D.dragging = true; D.tu = clamp(x / L.W, 0.1, 0.9); return true; };
  D.drag = (L, x) => { D.tu = clamp(x / L.W, 0.1, 0.9); };
  D.release = () => { D.dragging = false; D.tu = null; };
  D.move = () => {};
  D.key = () => false;
  D.keyDown = (L, name) => { if (name === 'left') { D.keyDir = -1; return true; } if (name === 'right') { D.keyDir = 1; return true; } return false; };
  D.keyUp = (L, name) => { if ((name === 'left' && D.keyDir < 0) || (name === 'right' && D.keyDir > 0)) D.keyDir = 0; };
  D.go = () => {
    if (!D.waiting) return false;
    D.waiting = false; D.stretch++; D.phase = bar() ? 'bar' : 'sail'; D.pt = 0; planStretch();
    if (bar()) text(S.L, 'OVER THE BAR!', S.L.W / 2, S.L.H * 0.2, '#ffd23f', 34);
    return true;
  };

  D.update = (L, dt) => {
    D.t += dt; D.pt += dt;
    const W = L.W;
    for (const x of D.texts) x.t += dt; D.texts = D.texts.filter((x) => x.t < 1.6);
    for (const p of D.spray) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; } D.spray = D.spray.filter((p) => p.t < 0.9);
    // steering
    const want = D.keyDir ? clamp(D.u + D.keyDir * 0.3, 0.1, 0.9) : D.tu != null ? D.tu : D.u;
    const dv = clamp(want - D.u, -SAIL.steer * dt, SAIL.steer * dt);
    D.u += dv; D.vel = dt > 0 ? dv / dt : 0;
    D.roll = lerp(D.roll, clamp(-D.vel * 0.22, -0.2, 0.2), 1 - Math.exp(-6 * dt));
    D.pitch = Math.max(0, D.pitch - dt * 1.5);
    for (const f of D.foam) { f.z += dt * SAIL.rate * f.v * (0.4 + f.z); if (f.z > 1.02) { f.z = 0.01; f.u = rand(); } }
    for (const g of D.gulls) g.x = (g.x + g.v * dt + 1) % 1;
    if (D.phase === 'ready') {
      if (D.pt >= SAIL.ready) { D.phase = 'sail'; D.pt = 0; planStretch(); text(L, 'STEER THROUGH THE CALM WATER', L.W / 2, L.H * 0.2, '#ffffff', 22); }
      return;
    }
    if (D.phase === 'sail' || D.phase === 'bar') {
      D.sT += dt;
      while (D.planI < D.plan.length && D.sT >= D.plan[D.planI].at) { const p = D.plan[D.planI++]; D.swells.push({ z: 0, g: p.g, gw: p.gw, h: p.h, ph: p.ph, hit: false }); }
      for (const s of D.swells) {
        const z0 = s.z; s.z += SAIL.rate * dt * (D.phase === 'bar' ? 0.92 : 1);
        if (!s.hit && z0 < SAIL.zs && s.z >= SAIL.zs) {
          const hh = hull(L) / L.W * 0.8;
          if (D.u - hh < s.g - s.gw / 2 || D.u + hh > s.g + s.gw / 2) { s.hit = true; D.bumps++; D.pitch = 1; thump(L); emit({ type: 'sail', bump: true }); }
        }
      }
      D.swells = D.swells.filter((s) => s.z < 1.15);
      if (D.planI >= D.plan.length && D.swells.every((s) => s.z > SAIL.zs + 0.14) && !D.stretchDone) {
        D.stretchDone = true;
        if (!bar()) { D.phase = 'marker'; D.pt = 0; D.waiting = true; D.buoyT = 0; emit({ type: 'sailMarker', n: D.stretch + 1, of: length }); }
        else { D.phase = 'calm'; D.pt = 0; D.swells.length = 0; }
      }
    } else if (D.phase === 'marker') { D.buoyT += dt; }
    else if (D.phase === 'calm') {
      D.shore = ease(clamp(D.pt / SAIL.calm, 0, 1));
      if (D.pt >= SAIL.calm) { D.phase = 'end'; D.pt = 0; D.ended = true; emit({ type: 'sailEnd', bumps: D.bumps }); if (hooks && hooks.celebrate) hooks.celebrate('arrived'); text(L, 'OREGON!', L.W / 2, L.H * 0.22, '#ffd23f', 40); }
    } else if (D.phase === 'end') { D.shore = 1; D.cheer += dt; if (D.pt >= SAIL.linger) D.done = true; }
    void W;
  };
  function thump(L) {
    const x = D.u * L.W, y = yAt(L, SAIL.zs) - 10 * sc(L);
    for (let i = 0; i < 14; i++) D.spray.push({ x: x + (rand() - 0.5) * 80 * sc(L), y, vx: (rand() - 0.5) * 120, vy: -(80 + rand() * 120), t: 0, r: (2 + rand() * 3) * sc(L) });
    D.texts.push({ s: 'WHUMP!', x, y: y - 90 * sc(L), col: '#ffffff', size: 24 * L.k, t: 0 });
    if (hooks && hooks.sfx) hooks.sfx('splash');
  }

  // ---------------------------------------------------------------- drawing: the whole frame (no layers)
  function ship(c, L, x, y, s, rm) {
    const roll = D.roll + (D.pitch > 0 && !rm ? Math.sin(D.t * 22) * 0.04 * D.pitch : 0), bob = (rm ? 0 : Math.sin(D.t * 1.6) * 2 * s) - D.pitch * 6 * s;
    c.save(); c.translate(x, y + bob); c.rotate(roll); c.scale(s, s);
    // the wake: two soft lines behind (toward the horizon)
    // the foremast and sail (further away, so smaller and higher)
    c.beginPath(); c.moveTo(0, -130); c.lineTo(0, -34); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = '#a8703e'; c.stroke();
    c.beginPath(); c.moveTo(-34, -48); c.quadraticCurveTo(-46, -88, -22, -124); c.lineTo(26, -118); c.quadraticCurveTo(46, -86, 36, -48); c.closePath(); c.fillStyle = '#fbf4e2'; c.fill(); c.lineWidth = 2.8; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
    c.beginPath(); c.moveTo(-26, -66); c.quadraticCurveTo(0, -60, 30, -68); c.moveTo(-30, -88); c.quadraticCurveTo(0, -82, 34, -92); c.lineWidth = 1.4; c.strokeStyle = '#d8c9a8'; c.stroke();
    // the main sail in front
    c.beginPath(); c.moveTo(-8, -142); c.lineTo(-8, -34); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#b97e48'; c.stroke();
    c.beginPath(); c.moveTo(-6, -138); c.quadraticCurveTo(52, -112, 50, -44); c.lineTo(-6, -40); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(-6, -112); c.quadraticCurveTo(24, -100, 48, -96); c.moveTo(-6, -84); c.quadraticCurveTo(26, -76, 50, -72); c.moveTo(-6, -60); c.quadraticCurveTo(24, -54, 50, -52); c.lineWidth = 1.4; c.strokeStyle = '#d0c4a8'; c.stroke();
    // the pennant
    c.beginPath(); c.moveTo(-8, -142); c.lineTo(-8, -154); c.lineTo(14 + Math.sin(D.t * 6) * 3, -150); c.lineTo(-8, -146); c.closePath(); c.fillStyle = '#d9534f'; c.fill(); c.lineWidth = 1.6; c.stroke();
    // the hull, from behind: a round stern with a window and a gilt line, the crew's hats over the rail
    c.beginPath(); c.moveTo(-56, -34); c.quadraticCurveTo(-60, -4, -34, 8); c.lineTo(34, 8); c.quadraticCurveTo(60, -4, 56, -34); c.closePath(); c.fillStyle = '#7a4a26'; c.fill(); c.lineWidth = 3.4; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(-58, -34); c.lineTo(58, -34); c.lineWidth = 6; c.strokeStyle = '#e8d8b0'; c.stroke();
    c.beginPath(); c.moveTo(-54, -22); c.quadraticCurveTo(0, -16, 54, -22); c.lineWidth = 2.4; c.strokeStyle = '#e0b84a'; c.stroke();
    c.beginPath(); rrect(c, -20, -20, 40, 15, 4); c.fillStyle = '#ffe9a8'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -5); c.lineWidth = 1.6; c.stroke();
    const looks = S.party.looks;
    for (let i = 0; i < 3; i++) {
      const x0 = (i - 1) * 24, l = looks[i];
      c.beginPath(); c.arc(x0, -42, 8.4, 0, TAU); c.fillStyle = l.skin; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(x0, -43, 8.4, Math.PI * 1.05, Math.PI * 1.95); c.fillStyle = l.hair; c.fill();
      if (D.phase === 'end') { const a = Math.sin(D.cheer * 9 + i) * 0.5; c.beginPath(); c.moveTo(x0 + 8, -36); c.lineTo(x0 + 16, -52 + a * 6); c.lineWidth = 3.2; c.strokeStyle = l.color; c.stroke(); }
      drawHat(c, l.hat, x0, -41, 0.8, l.hatColor || l.color);
    }
    c.restore();
  }
  function swellPath(c, L, s) {
    const { W, k } = L, y = yAt(L, s.z), z = clamp(s.z, 0.02, 1.1), hgt = (7 + 40 * z) * s.h * L.k * 0.8;
    const edge = 0.07;
    const hAt = (u) => { const d = Math.abs(u - s.g); const m = clamp((d - s.gw / 2) / edge + 1, 0, 1); return hgt * m * (0.9 + 0.1 * Math.sin(u * 30 + s.ph)); };
    c.beginPath();
    for (let x = -10; x <= W + 10; x += 14) { const u = x / W, yy = y - hAt(u) * (0.7 + 0.3 * Math.sin(u * 9 + s.ph)); if (x === -10) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.lineTo(W + 10, y + (4 + 14 * z) * s.h * k); c.lineTo(-10, y + (4 + 14 * z) * s.h * k); c.closePath();
    return { y, hgt };
  }
  D.draw = (c, L, t, rm) => {
    const { W, H, k } = L, pal = BIOMES.sea, y0 = yh(L), s = sc(L);
    // sky
    const g = c.createLinearGradient(0, 0, 0, y0); g.addColorStop(0, pal.sky[0]); g.addColorStop(1, pal.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, y0 + 1);
    c.beginPath(); c.arc(W * 0.8, y0 * 0.4, 20 * k, 0, TAU); c.fillStyle = '#ffe36a'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#f0b400'; c.stroke();
    for (const [cx, cy, cs] of [[0.18, 0.28, 1], [0.52, 0.18, 0.8], [0.86, 0.42, 0.7]]) { c.beginPath(); for (const [ox, oy, r] of [[-26, 6, 18], [0, -4, 24], [26, 4, 20], [48, 10, 14]]) { c.moveTo(cx * W + (ox + r) * cs * k, cy * y0 + oy * cs * k); c.arc(cx * W + ox * cs * k, cy * y0 + oy * cs * k, r * cs * k, 0, TAU); } c.fillStyle = '#ffffff'; c.fill(); }
    // gulls
    c.beginPath(); for (const gu of D.gulls) { const x = gu.x * W, y = gu.y * y0 * 4 * 0.5 + 8 * k, fl = rm ? 0.5 : Math.sin(t * 4 + gu.ph); c.moveTo(x - 8 * k, y + fl * 3 * k); c.quadraticCurveTo(x - 3 * k, y - 4 * k, x, y); c.quadraticCurveTo(x + 3 * k, y - 4 * k, x + 8 * k, y + fl * 3 * k); }
    c.lineWidth = 2 * k; c.strokeStyle = '#ffffff'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
    // the coast on the left, and Oregon's green shore across the horizon at the end
    c.beginPath(); c.moveTo(0, y0 + 2); for (let x = 0; x <= W * 0.5; x += 12) c.lineTo(x, y0 - (10 + 14 * Math.sin(x * 0.02 + 1) + 8 * Math.sin(x * 0.05)) * k * (1 - x / (W * 0.62))); c.lineTo(W * 0.5, y0 + 2); c.closePath(); c.fillStyle = '#7fa890'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#3a5a52'; c.stroke();
    if (D.shore > 0) {
      const hs = D.shore * 54 * k;
      c.beginPath(); c.moveTo(-4, y0 + 2); for (let x = -4; x <= W + 4; x += 10) c.lineTo(x, y0 - hs * (0.55 + 0.35 * Math.sin(x * 0.015 + 2) + 0.1 * Math.sin(x * 0.06))); c.lineTo(W + 4, y0 + 2); c.closePath(); c.fillStyle = '#4f9a3e'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      for (let x = 14 * k; x < W; x += 34 * k) { const h = hs * (0.5 + 0.3 * Math.sin(x * 0.7)), by = y0 - hs * 0.4 * (0.9 + 0.2 * Math.sin(x * 0.015 + 2)); c.beginPath(); c.moveTo(x, by + 2); c.lineTo(x - 5 * k, by + 2); c.lineTo(x, by - h * 0.7); c.lineTo(x + 5 * k, by + 2); c.closePath(); c.fillStyle = '#2f6a3a'; c.fill(); }
      c.beginPath(); c.moveTo(-4, y0 + 3); c.lineTo(W + 4, y0 + 3); c.lineWidth = 3 * k * D.shore; c.strokeStyle = '#f4e6b8'; c.stroke();
    }
    // the sea: pale at the horizon, deeper toward us
    const sg = c.createLinearGradient(0, y0, 0, H); sg.addColorStop(0, '#8fd0dc'); sg.addColorStop(0.35, '#3fa0c8'); sg.addColorStop(1, '#1f6f9c'); c.fillStyle = sg; c.fillRect(0, y0, W, H - y0);
    // the calm lane through each swell: a pale strip of smooth water (drawn first, under the swells)
    for (const sw of D.swells) {
      const y = yAt(L, sw.z), w = sw.gw * W * (0.35 + 0.65 * Math.min(1, sw.z)), x = sw.g * W;
      c.beginPath(); c.ellipse(x, y + 4 * k, w * 0.5, (4 + 10 * sw.z) * k, 0, 0, TAU); c.fillStyle = 'rgba(214,246,255,0.35)'; c.fill();
    }
    // foam streaks drifting toward us
    c.beginPath();
    for (const f of D.foam) { const y = yAt(L, f.z), len = f.l * W * (0.3 + f.z), x = f.u * W; c.moveTo(x, y); c.lineTo(x + len, y); }
    c.lineWidth = 1.8 * k; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.stroke();
    // the swells, far to near, and the ship between them at its depth
    const list = D.swells.slice().sort((a, b) => a.z - b.z);
    let shipDrawn = false;
    const drawShip = () => { ship(c, L, D.u * W, yAt(L, SAIL.zs), s, rm); };
    for (const sw of list) {
      if (!shipDrawn && sw.z > SAIL.zs) { drawShip(); shipDrawn = true; }
      const { y, hgt } = swellPath(c, L, sw);
      c.fillStyle = bar() ? '#1a6a98' : '#2a84b4'; c.fill();
      c.lineWidth = 1.6 * k; c.strokeStyle = 'rgba(14,50,90,0.5)'; c.stroke();
      // the crest: a white line along the top, where the swell is tall
      c.beginPath(); let on = false;
      for (let x = -10; x <= W + 10; x += 14) { const u = x / W, d = Math.abs(u - sw.g), m = clamp((d - sw.gw / 2) / 0.07 + 1, 0, 1), yy = y - hgt * m * (0.9 + 0.1 * Math.sin(u * 30 + sw.ph)) * (0.7 + 0.3 * Math.sin(u * 9 + sw.ph)); if (m > 0.15) { if (!on) { c.moveTo(x, yy); on = true; } else c.lineTo(x, yy); } else on = false; }
      c.lineWidth = (2 + 3 * Math.min(1, sw.z)) * k; c.strokeStyle = '#ffffff'; c.lineJoin = 'round'; c.stroke();
    }
    if (!shipDrawn) drawShip();
    // the buoy of a marker, beside the ship in the calm water
    if (D.phase === 'marker' || (D.waiting && D.phase !== 'ready')) {
      const a = clamp(D.buoyT * 2, 0, 1), bx = D.u < 0.5 ? W * 0.82 : W * 0.18, by = yAt(L, SAIL.zs) + 2 * k, bob = rm ? 0 : Math.sin(t * 2.2) * 2 * k;
      c.globalAlpha = a;
      c.beginPath(); c.moveTo(bx - 14 * s, by - 8 * s + bob); c.lineTo(bx + 14 * s, by - 8 * s + bob); c.lineTo(bx + 9 * s, by - 34 * s + bob); c.lineTo(bx - 9 * s, by - 34 * s + bob); c.closePath(); c.fillStyle = '#d9534f'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(bx - 12 * s, by - 20 * s + bob); c.lineTo(bx + 12 * s, by - 20 * s + bob); c.lineWidth = 5 * s; c.strokeStyle = '#ffffff'; c.stroke();
      c.beginPath(); c.moveTo(bx, by - 34 * s + bob); c.lineTo(bx, by - 62 * s + bob); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.rect(bx, by - 62 * s + bob, 26 * s, 14 * s); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 2; c.stroke();
      drawText(c, String(D.stretch + 1), 11 * s, bx + 13 * s, by - 55 * s + bob, '#6a2a1a', null, 20 * s);
      c.beginPath(); c.ellipse(bx, by + 2 * s, 24 * s, 5 * s, 0, 0, TAU); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.stroke();
      c.globalAlpha = 1;
    }
    // the spray of a thump
    for (const p of D.spray) { c.globalAlpha = 1 - p.t / 0.9; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); } c.globalAlpha = 1;
    // the words
    c.beginPath(); rrect(c, 12 * k, 12 * k, 116 * k, 28 * k, 10 * k); c.fillStyle = 'rgba(30,22,14,0.55)'; c.fill();
    drawText(c, bar() ? 'THE COLUMBIA BAR' : `UP THE COAST ${Math.min(D.stretch + 1, length)} OF ${length}`, 11 * k, 70 * k, 26 * k, '#fff6d8', null, 108 * k);
    for (const x of D.texts) { const u = clamp(x.t / 1.5, 0, 1); c.globalAlpha = clamp(2.4 - u * 2.2, 0, 1); drawText(c, x.s, x.size, clamp(x.x, 90 * k, W - 90 * k), x.y - u * 16 * k, x.col, OUT, W * 0.92); } c.globalAlpha = 1;
  };
  D.state = () => ({ kind: 'sail', phase: D.phase, n: Math.min(D.stretch + 1, length), of: length, bumps: D.bumps, u: Math.round(D.u * 1000) / 1000, waiting: D.waiting, progress: Math.round(((D.stretch + (D.planI + 0) / Math.max(1, D.plan.length)) / (length + 1)) * 1000) / 1000 });
  D.summary = () => ({ bumps: D.bumps, markers: D.stretch, finished: D.ended });
  D.debug = (L) => ({ kind: 'sail', u: D.u, zs: SAIL.zs, hull: hull(L) / L.W * 0.8, swells: D.swells.map((s) => ({ z: Math.round(s.z * 1000) / 1000, g: s.g, gw: s.gw, hit: s.hit })), plan: D.plan.map((p) => ({ at: p.at, g: p.g })), phase: D.phase, stretch: D.stretch, shore: D.shore });
  return D;
}
