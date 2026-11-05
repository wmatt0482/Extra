// Wagon West Laurel Hill (SPEC v1.5 §4.3, scene stream): on the Barlow Road the steep slope was too much for the brakes, so wagons were let down
// on ropes snubbed round a stump (the real way). The child lowers the wagon: HOLD (press anywhere, or Space) to let the rope pay out and the wagon
// slide, LET GO at each ledge. Three drops (`drops`), each ending on a flat ledge:
//   let go so the wagon rests ON the ledge  → good ("SMOOTH!")
//   let go too early                         → it just waits on the slope, hold again (no penalty, nothing is counted)
//   hold on past the ledge's end             → the wagon bumps down in a cloud of dust and everyone laughs ("BUMP!"): not good
// It never breaks and never runs away; every drop ends, and the game always ends (no fail).
// Events: { type: 'snub', good } per drop · { type: 'snubEnd', smooth, good, drops } (smooth = every drop was good) after the last drop and its cheer.
// getState().mini = { kind: 'snub', phase: 'wait' | 'slide' | 'skid' | 'settle' | 'end', drop (1-based), drops, good, bumps, s, held }
import { TAU, OUT, mulberry32, clamp, lerp, shade, drawText, rrect } from './util.js';
import { BIOMES, paint } from './biomes.js';
import { drawWagon, drawPerson } from './sprites.js';

export const SNUB_RUN = {
  vmax: 0.2, // path fractions per second while held
  accel: 0.55, decel: 0.35, // per second²
  settle: 1.5, // s on the ledge before the next drop
  linger: 2.2,
};
// the path, in the play box (fractions of its width and height): start flat, then three (slope, flat) pairs; drops < 3 use fewer pairs
const SHAPE = [[0.02, 0], [0.17, 0], [0.35, 0.34], [0.52, 0.34], [0.68, 0.67], [0.85, 0.67], [0.96, 1], [1.02, 1]];

export function createSnub(opts, emit, S, hooks) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const drops = clamp(Math.round(Number.isFinite(+o.drops) ? +o.drops : 3), 1, 3);
  const rand = mulberry32((seed ^ 0x5b0b) || 1);
  const D = {
    kind: 'snub', view: 'snub', input: true, done: false, ended: false,
    phase: 'wait', drop: 1, drops, good: 0, bumps: 0, s: 0, v: 0, held: false, pt: 0, t: 0, dust: [], texts: [], ph: 0, bumpT: 0, shake: 0, cheer: 0, hint: 0,
    jit: Array.from({ length: 4 }, () => (rand() - 0.5) * 0.06), geoKey: '', path: null,
  };
  // the path as a polyline in screen px, with the arclength param s (0..1); the ledges are the flat parts
  function geo(L) {
    const key = L.W + 'x' + L.H;
    if (D.geoKey === key && D.path) return D.path;
    const { W, H, k } = L;
    const bx = W * 0.06, bw = W * 0.88, by = H * 0.3, bh = H * 0.42;
    const pts = SHAPE.map(([u, v]) => ({ x: bx + u * bw, y: by + v * bh }));
    const segs = []; let tot = 0;
    for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push({ a: i, l, s0: tot }); tot += l; }
    for (const sg of segs) { sg.s0 /= tot; sg.s1 = sg.s0 + sg.l / tot; }
    // the ledge for drop n (1-based): the flat segment 2n (after the n-th slope); it ends the drop
    const ledges = [];
    for (let n = 1; n <= 3; n++) { const sg = segs[2 * n]; ledges.push({ s0: sg.s0, s1: sg.s1, x0: pts[sg.a].x, x1: pts[sg.a + 1].x, y: pts[sg.a].y }); }
    const sw = clamp(Math.min(W * 0.0013, ((ledges[0].x1 - ledges[0].x0) * 0.95) / 130), 0.3, 1.25 * k) * 1.0;
    D.path = { pts, segs, tot, ledges, sw, bx, bw, by, bh, k };
    D.geoKey = key;
    return D.path;
  }
  const at = (G, s) => {
    s = clamp(s, 0, 1);
    for (const sg of G.segs) if (s <= sg.s1 + 1e-9) { const u = sg.s1 > sg.s0 ? (s - sg.s0) / (sg.s1 - sg.s0) : 0, a = G.pts[sg.a], b = G.pts[sg.a + 1]; return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
    const e = G.pts[G.pts.length - 1]; return { x: e.x, y: e.y, ang: 0 };
  };
  const li = () => D.drop - 1 + (3 - drops); // the ledge this drop ends on (fewer drops skip the upper ledges; the last drop always ends on the bottom one)
  const text = (L, s, x, y, col, size = 30) => D.texts.push({ s, x, y, col, size: size * L.k, t: 0 });
  // v1.7.1 (the 1.5 playtest's "ugly" 10): the floating words keep below the top band, where the LEDGE counter (12k..40k) and the hint line (H × 0.14) sit
  const topBand = (L) => Math.max(40 * L.k, L.H * 0.14 + 10 * L.k);

  // ---- input: hold to slide, let go to stop
  const hold = (on) => {
    if (D.ended) return false;
    if (on) {
      if (D.phase === 'wait' || D.phase === 'skid') { D.held = true; D.phase = 'slide'; D.pt = 0; D.hint = 0; return true; }
      return D.phase === 'slide';
    }
    D.held = false;
    if (D.phase === 'slide') { D.phase = 'skid'; D.pt = 0; }
    return true;
  };
  D.pointer = () => hold(true);
  D.drag = () => {};
  D.release = () => hold(false);
  D.move = () => {};
  D.key = () => hold(true);
  D.keyUp = (L, name) => { if (name === 'space') hold(false); };

  function finishDrop(L, good) {
    D.phase = 'settle'; D.pt = 0; D.v = 0; D.held = false;
    if (good) D.good++; else { D.bumps++; D.shake = 0.6; D.bumpT = 0; }
    const G = geo(L), p = at(G, D.s);
    if (good) { text(L, 'SMOOTH!', p.x, p.y - 90 * G.sw, '#9be86a', 32); if (hooks && hooks.sfx) hooks.sfx('twinkle'); }
    else { text(L, 'BUMP!', p.x, p.y - 90 * G.sw, '#ffd23f', 34); text(L, 'HA HA!', p.x - 70 * G.sw, p.y - 130 * G.sw, '#ffffff', 22); for (let i = 0; i < 9; i++) D.dust.push({ x: p.x - 30 * G.sw + rand() * 70 * G.sw, y: p.y - 6 * G.sw, r: (8 + rand() * 12) * G.sw, t: -rand() * 0.2, vx: (rand() - 0.2) * 40 * G.sw, vy: -(20 + rand() * 30) * G.sw }); if (hooks && hooks.sfx) hooks.sfx('whoosh'); }
    emit({ type: 'snub', good });
  }

  D.update = (L, dt) => {
    D.t += dt; D.pt += dt; D.ph += dt * (D.phase === 'slide' ? 5 : 0);
    D.shake = Math.max(0, D.shake - dt); D.bumpT += dt;
    for (const x of D.texts) x.t += dt; D.texts = D.texts.filter((x) => x.t < 1.5);
    for (const d of D.dust) { d.t += dt; if (d.t > 0) { d.x += d.vx * dt; d.y += d.vy * dt; d.r += dt * 14; } } D.dust = D.dust.filter((d) => d.t < 1.1);
    const G = geo(L), L1 = G.ledges[li()];
    if (D.phase === 'wait') { D.hint += dt; D.v = 0; }
    else if (D.phase === 'slide' || D.phase === 'skid') {
      if (D.phase === 'slide') D.v = Math.min(SNUB_RUN.vmax, D.v + SNUB_RUN.accel * dt);
      else D.v = Math.max(0, D.v - SNUB_RUN.decel * dt);
      D.s += D.v * dt;
      if (D.s >= L1.s1 - 1e-6) { D.s = Math.min(L1.s1 + 0.012, 1); finishDrop(L, false); return; } // held on past the ledge: the bump
      if (D.phase === 'skid' && D.v <= 0.0005) {
        D.v = 0;
        if (D.s >= L1.s0) finishDrop(L, true);
        else {   // let go early: it waits, no penalty. "HOLD AGAIN" floats above the wagon when there is room under the top band, else on the slope below it (v1.7.1: it sat on the LEDGE counter)
          D.phase = 'wait'; D.pt = 0; D.hint = 0;
          const p = at(G, D.s), size = 22 * L.k, above = p.y - 80 * G.sw;
          text(L, 'HOLD AGAIN', p.x, above - size * 0.6 - 18 * L.k >= topBand(L) ? above : p.y + 34 * G.sw + size * 0.6, '#ffffff', 22);
        }
      }
    } else if (D.phase === 'settle') {
      if (D.pt >= SNUB_RUN.settle) {
        if (D.drop >= drops) {
          D.ended = true; D.phase = 'end'; D.pt = 0;
          emit({ type: 'snubEnd', smooth: D.bumps === 0, good: D.good, drops });
          if (hooks && hooks.celebrate) hooks.celebrate('arrived');
        } else { D.drop++; D.phase = 'wait'; D.pt = 0; D.hint = 0; }
      }
    } else if (D.phase === 'end') { D.cheer += dt; if (D.pt >= SNUB_RUN.linger) D.done = true; }
  };

  // ---- the hillside (painted every frame: it is a handful of paths)
  D.drawBackground = (c, L, t, rm) => {
    const G = geo(L), { W, H, k } = L, pal = BIOMES.mountains;
    // the slope as a filled polygon under the path
    c.beginPath(); c.moveTo(G.pts[0].x - 40 * k, G.pts[0].y); for (const p of G.pts) c.lineTo(p.x, p.y); c.lineTo(W + 40 * k, G.pts[G.pts.length - 1].y); c.lineTo(W + 40 * k, H + 4); c.lineTo(-4, H + 4); c.lineTo(-4, G.pts[0].y); c.closePath();
    c.fillStyle = shade(pal.ground, -0.05); c.fill(); c.lineWidth = 3 * k; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
    // a darker earth band under the grass and a dirt track along the path
    c.beginPath(); c.moveTo(G.pts[0].x, G.pts[0].y + 6 * k); for (const p of G.pts) c.lineTo(p.x, p.y + 6 * k); c.lineWidth = 14 * k; c.lineCap = 'round'; c.strokeStyle = shade(pal.trail, 0.04); c.stroke(); c.lineCap = 'butt';
    // firs behind and below the slope, boulders on it
    const r = mulberry32(seed ^ 0x77);
    for (let i = 0; i < 16; i++) { const u = i / 15, x = lerp(G.bx, G.bx + G.bw, u) + (r() - 0.5) * 30 * k, p = at(G, clamp(u * 0.98, 0, 1)), h = (46 + r() * 36) * k; paint.pine(c, x, p.y - 22 * k - r() * 24 * k, h * 0.46, h, shade(pal.near, -r() * 0.1), OUT, 1.6); }
    for (let i = 0; i < 6; i++) { const u = 0.1 + i * 0.16 + (r() - 0.5) * 0.05; const p = at(G, u); paint.rock(c, p.x + (r() - 0.5) * 20 * k, p.y + (22 + r() * 36) * k, (8 + r() * 7) * k, '#9a9aa4', '#30303a', 1.6); }
    for (let i = 0; i < 20; i++) { const p = at(G, r()); paint.grass(c, p.x, p.y + (14 + r() * (H - p.y - 20)) , 14 * k, '#4a7a3a', 2 * k); }
    // the ledges: a flat plank landing with a post and a pennant, glowing when the wagon nears
    G.ledges.slice(0, 3).forEach((lg, i) => {
      const near = !D.ended && (D.phase === 'slide' || D.phase === 'skid' || D.phase === 'wait') && i === li() && D.s > lg.s0 - 0.22;
      const pulse = rm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 6);
      c.beginPath(); rrect(c, lg.x0, lg.y - 3 * k, lg.x1 - lg.x0, 10 * k, 3 * k); c.fillStyle = near ? `rgb(${Math.round(170 + 60 * pulse)},${Math.round(200 + 40 * pulse)},90)` : '#b98a54'; c.fill(); c.lineWidth = 2.2 * k; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); for (let x = lg.x0 + 10 * k; x < lg.x1; x += 14 * k) { c.moveTo(x, lg.y - 3 * k); c.lineTo(x, lg.y + 7 * k); } c.lineWidth = 1.2 * k; c.strokeStyle = '#7a4a26'; c.stroke();
      const px = lg.x1 - 8 * k;
      c.beginPath(); c.moveTo(px, lg.y - 3 * k); c.lineTo(px, lg.y - 46 * k); c.lineWidth = 3.2 * k; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(px, lg.y - 46 * k); c.lineTo(px - 24 * k, lg.y - 40 * k + (rm ? 0 : Math.sin(t * 5 + i) * 2 * k)); c.lineTo(px, lg.y - 33 * k); c.closePath(); c.fillStyle = near ? '#ffd23f' : '#d9534f'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
    });
    // the stump the rope is snubbed round, at the top
    const sx = G.pts[1].x - 20 * k, sy = G.pts[1].y, sk = G.sw * 1.6;
    c.beginPath(); c.moveTo(sx - 20 * sk, sy); c.lineTo(sx - 17 * sk, sy - 34 * sk); c.lineTo(sx + 17 * sk, sy - 34 * sk); c.lineTo(sx + 20 * sk, sy); c.closePath(); c.fillStyle = '#8a5a30'; c.fill(); c.lineWidth = 2.6 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.ellipse(sx, sy - 34 * sk, 17 * sk, 6 * sk, 0, 0, TAU); c.fillStyle = '#d8a868'; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(sx, sy - 34 * sk, 10 * sk, 3.4 * sk, 0, 0, TAU); c.lineWidth = 1.4; c.strokeStyle = '#8a5a30'; c.stroke();
    D.stump = { x: sx, y: sy - 30 * sk, sk };
  };

  D.draw = (c, L, t, rm) => {
    const G = geo(L), { W, H, k } = L, sw = G.sw, p = at(G, D.s);
    const looks = S.party.looks;
    // the rope: wagon tail → round the stump → back to the crew
    const st = D.stump || { x: G.pts[1].x, y: G.pts[1].y - 40 * sw, sk: sw };
    const wy = p.y - 36 * sw, wx = p.x - 52 * sw * Math.cos(Math.min(0.6, p.ang));
    c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo((wx + st.x) / 2, (wy + st.y) / 2 + (D.phase === 'slide' ? 2 : 10) * sw, st.x + 8 * st.sk, st.y);
    c.lineWidth = 4.4 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.4 * k; c.strokeStyle = '#d8c08a'; c.stroke();
    c.beginPath(); c.moveTo(st.x - 8 * st.sk, st.y); c.lineTo(st.x - 70 * sw, st.y + 20 * sw); c.lineWidth = 4.4 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.4 * k; c.strokeStyle = '#d8c08a'; c.stroke();
    // the crew leaning on the rope behind the stump (they pay it out while it slides), the third waits by the last ledge
    const lean = D.phase === 'slide' ? 1 : 0, ph = D.ph;
    const happy = D.shake > 0 || D.phase === 'settle' || D.phase === 'end';
    const cheer = D.phase === 'end' ? clamp(D.cheer / 1.6, 0, 1) * 0.9 : D.shake > 0 ? 0.3 + (0.6 - D.shake) * 0.5 : 0;
    drawPerson(c, st.x - 84 * sw, st.y + 26 * sw, sw * 0.95, looks[0], ph, lean * 0.4, cheer, 1);
    drawPerson(c, st.x - 126 * sw, st.y + 28 * sw, sw * 0.95, looks[1], ph + 1.7, lean * 0.4, cheer, 1);
    { const lg = G.ledges[2]; drawPerson(c, lg.x1 + 36 * sw, lg.y + 4, sw * 0.95, looks[2], 0, 0, happy ? 0.3 + 0.3 * Math.sin(t * 6) : 0, -1); }
    // the wagon, tilted to the slope, shaking a little when it bumps
    const ang = Math.min(0.55, p.ang), shake = D.shake > 0 && !rm ? Math.sin(D.bumpT * 40) * 3 * sw * (D.shake / 0.6) : 0;
    c.save(); c.translate(p.x, p.y + shake); c.rotate(ang);
    drawWagon(c, 0, 0, sw, S.party.wagon, (D.s * G.tot) / (20 * sw), D.phase === 'slide' && !rm ? Math.abs(Math.sin(t * 22)) * 1.5 : 0, t);
    c.restore();
    for (const d of D.dust) { if (d.t < 0) continue; c.globalAlpha = 0.6 * (1 - d.t / 1.1); c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fillStyle = '#e8d8b0'; c.fill(); } c.globalAlpha = 1;
    // the hint
    if (D.phase === 'wait') { const a = clamp(D.hint * 2, 0, 1); c.globalAlpha = a; drawText(c, D.drop === 1 && D.s === 0 ? 'HOLD TO LET THE WAGON DOWN' : 'HOLD TO SLIDE', 14 * k, W / 2, H * 0.14, '#ffffff', OUT, W * 0.92); c.globalAlpha = 1; }
    else if (D.phase === 'slide') drawText(c, 'LET GO AT THE LEDGE!', 15 * k, W / 2, H * 0.14, '#ffd23f', OUT, W * 0.92);
    c.beginPath(); rrect(c, 12 * k, 12 * k, 96 * k, 28 * k, 10 * k); c.fillStyle = 'rgba(30,22,14,0.65)'; c.fill();
    drawText(c, `LEDGE ${Math.min(D.drop, drops)} OF ${drops}`, 12 * k, 60 * k, 26 * k, '#fff6d8', null, 90 * k);
    const band = topBand(L);
    for (const x of D.texts) { const u = clamp(x.t / 1.3, 0, 1); c.globalAlpha = clamp(2.4 - u * 2.4, 0, 1); drawText(c, x.s, x.size, clamp(x.x, 80 * k, W - 80 * k), Math.max(x.y - u * 18 * k, band + x.size * 0.6), x.col, OUT, W * 0.9); } c.globalAlpha = 1;
  };
  D.state = () => ({ kind: 'snub', phase: D.phase, drop: Math.min(D.drop, drops), drops, good: D.good, bumps: D.bumps, s: Math.round(D.s * 1000) / 1000, held: D.held });
  D.summary = () => ({ smooth: D.ended && D.bumps === 0, good: D.good, drops, finished: D.ended });
  D.debug = (L) => { const G = geo(L); const lg = G.ledges[Math.min(2, li())]; return { kind: 'snub', s: D.s, v: D.v, ledge: { s0: lg.s0, s1: lg.s1 }, phase: D.phase, vmax: SNUB_RUN.vmax, decel: SNUB_RUN.decel, tot: G.tot }; };
  return D;
}
