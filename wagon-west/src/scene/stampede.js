// Wagon West buffalo stampede (SPEC v1.2 §4, scene stream): the wagon rolls along the trail on the prairie / bluffs and
// the bison herd THUNDERS across behind it, in three waves: first a rumble and a cloud of dust on the horizon, then
// the herd (galloping bison in three rows) with a big dark lead bull out in front that grows as it comes. When the lead
// bull looms, a big BRAKE sign pulses over the wagon (a visible cue, no timer drawn); the child taps the canvas (or
// presses Space, B or the left arrow) to haul the team to a halt. A good brake: the team stops, the bull skids to a
// halt in a spray of dust, "WHOA!", the herd parts and thunders round. A miss: the herd roars past, dust in everyone's
// face, a laugh line ("PFFT!"); the wagon is always fine. A tap before the sign shows is free ("WAIT FOR THE BRAKE!").
//
// The BRAKE window opens when the bull is 12 % of the width inside the right edge and stays open 1.6 s (then the wave
// counts as a miss). Same seed, same herds. Reduced motion: no shaking, thinner dust, a steady sign.
//
// Events (via emit): { type: 'stampede', good } at each wave's decision (the tap, or the window closing) ·
// { type: 'stampedeEnd', held } when the third herd has gone (held = at least 2 good); the dust then settles for 2.2 s
// before the scene goes back (or at once on endMiniGame()).

import { TAU, OUT, mulberry32, clamp, lerp, ease, approach, drawText } from './util.js';
import { drawBison, warmBison } from './sprites12.js';
import { drawPuff } from './sprites.js';

export const HERD = {
  waves: 3,
  warn: 1.2, // s of rumble and dust before a herd shows
  speed: 230, // herd speed, css px per s per unit of k
  cueX: 0.88, // the BRAKE sign shows when the bull is left of this fraction of the width
  cueLen: 1.6, // s the sign stays up
  early: 0.15, // s of grace for a tap just before the sign
  trail: 62, // the wagon's roll, px/s per unit of k
  brake: 1.5, // s the team stands after a good brake
  settle: 2.2,
  sizes: [8, 11, 14],
};
const ROWS = [{ y: 0.735, s: 0.5 }, { y: 0.76, s: 0.58 }, { y: 0.785, s: 0.66 }];
const BULL_Y = 0.79;

export function createStampede(opts, emit, S, hooks) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const rand = mulberry32((seed ^ 0x57a3) || 1);
  warmBison();
  const D = {
    kind: 'stampede', waves: [], made: 0, resolved: 0, good: 0, results: [], phase: 'intro', t: 0, introT: 0, gapT: 0, endT: 0,
    nextAt: 0, ended: false, done: false, held: null, v: 0, dist: 0, spin: 0, walkPh: 0, scroll0: S.scroll, brakeT: 0, haze: 0,
    shake: 0, texts: [], hintT: 0, dust: Array.from({ length: 80 }, () => ({ on: false, x: 0, y: 0, r: 0, life: 0, max: 1, vx: 0, vy: 0, a: 0.4 })),
    spawnAcc: 0, rings: 0,
  };

  function newWave(L) {
    const i = D.made++, n = HERD.sizes[Math.min(i, HERD.sizes.length - 1)], k = L.k;
    const members = [];
    for (let j = 0; j < n; j++) {
      const row = j % 3;
      members.push({ off: (70 + (j / n) * 360 + rand() * 40) * k, row, ph: rand() * 6, sc: 0.9 + rand() * 0.22, dy: (rand() - 0.5) * 0.012 });
    }
    members.sort((a, b) => a.row - b.row);
    const w = {
      i, tw: 0, members, offMax: Math.max(...members.map((m) => m.off)),
      bull: { x: L.W + 120 * k, vx: 0, ph: rand() * 6, braked: false, stopT: 0, away: false },
      cue: false, cueStart: -1, resolved: false, good: null, passed: false, brakeAt: -1,
    };
    D.waves.push(w);
    return w;
  }

  // ---- geometry ----
  const vh = (L) => HERD.speed * L.k;
  const front = (L, w) => L.W + 120 * L.k - vh(L) * (w.tw - HERD.warn); // the herd's front edge
  const bullScale = (L, x) => L.k * lerp(1.0, 1.8, ease((L.W + 120 * L.k - x) / (0.55 * L.W + 120 * L.k)));

  function text(L, s, x, y, col = '#ffffff', sub = '') { D.texts.push({ text: s, sub, x: clamp(x, 100 * L.k, L.W - 100 * L.k), y, col, t: 0 }); }
  function puffs(L, x, y, n, big, a = 0.45) {
    for (let i = 0; i < n; i++) {
      const p = D.dust.find((q) => !q.on); if (!p) return;
      p.on = true; p.life = 0; p.max = 0.8 + rand() * 0.7; p.x = x + (rand() - 0.5) * 40 * L.k; p.y = y - rand() * 14 * L.k;
      p.r = (big ? 9 + rand() * 9 : 4 + rand() * 4) * L.k; p.vx = (rand() - 0.5) * 70 * L.k - (big ? 20 * L.k : 40 * L.k); p.vy = -(10 + rand() * 25) * L.k; p.a = a;
    }
  }

  // ---- input ----
  function brake(L) {
    if (D.ended) return false;
    const w = D.waves.find((q) => !q.resolved && q.cue);
    const soon = D.waves.find((q) => !q.resolved && !q.cue && q.tw >= HERD.warn && q.bull.x <= L.W * HERD.cueX + vh(L) * HERD.early);
    const hit = w || soon;
    if (hit) {
      hit.cue = true; if (hit.cueStart < 0) hit.cueStart = hit.tw;
      hit.resolved = true; hit.good = true; hit.brakeAt = hit.tw;
      D.resolved++; D.good++; D.results.push(true);
      hit.bull.braked = true; hit.bull.stopT = 0;
      D.brakeT = HERD.brake;
      puffs(L, hit.bull.x - 20 * L.k, L.H * BULL_Y, 16, true, 0.55);
      puffs(L, S.wagonX + 20 * L.k, L.gy, 10, false, 0.4);
      text(L, 'WHOA!', L.W * 0.5, L.H * 0.3, '#ffd23f');
      emit({ type: 'stampede', good: true });
      return true;
    }
    if (D.hintT <= 0 && D.waves.some((q) => !q.resolved)) { text(L, 'WAIT FOR THE BRAKE!', L.W * 0.5, L.H * 0.36, '#ffffff'); D.hintT = 1.4; }
    return false;
  }
  D.pointer = (L) => brake(L);
  D.key = (L) => brake(L);
  D.keyDown = (L, name, repeat) => { if (name === 'left' || name === 'brake') { if (!repeat) brake(L); return true; } return false; };
  D.keyUp = () => {};
  D.move = () => {};

  // ---- update ----
  D.update = (L, dt) => {
    const k = L.k, rm = S.rm;
    D.t += dt; D.hintT = Math.max(0, D.hintT - dt);
    if (D.phase === 'intro') { D.introT += dt; if (D.introT >= 0.5) { D.phase = 'waves'; newWave(L); } }
    for (const w of D.waves) {
      w.tw += dt;
      const b = w.bull, V = vh(L);
      if (w.tw >= HERD.warn) {
        if (b.braked) {
          b.stopT += dt;
          b.vx = approach(b.vx, 0, 9, dt);
          if (b.stopT > 2.4) b.away = true;
          if (b.away) b.vx = -V * 0.45;
          b.x += b.vx * dt;
        } else { b.vx = -V; b.x += b.vx * dt; }
        b.ph += dt * 17;
        // the sign comes up when the bull is inside the right edge
        if (!w.cue && b.x <= L.W * HERD.cueX) { w.cue = true; w.cueStart = w.tw; }
        if (w.cue && !w.resolved && w.tw - w.cueStart >= HERD.cueLen) {
          w.resolved = true; w.good = false; D.resolved++; D.results.push(false);
          D.haze = Math.min(0.62, D.haze + 0.55);
          puffs(L, S.wagonX + 60 * k, L.gy - 20 * k, 24, true, 0.5);
          puffs(L, S.wagonX + 230 * k, L.gy - 20 * k, 14, true, 0.5);
          text(L, 'PFFT!', S.wagonX + 80 * k, L.gy - 150 * k, '#ffd23f', 'DUST IN EVERYONE\'S FACE!');
          emit({ type: 'stampede', good: false });
        }
        const fx = front(L, w);
        if (!w.passed && fx + w.offMax < -90 * k && b.x < -120 * k) w.passed = true;
        if (b.braked && !b.away && fx + w.offMax < -90 * k && b.stopT > 0.8) b.stopT = Math.max(b.stopT, 2.4); // the herd is by: the bull trots off
        // dust kicked up by the hooves
        if (!rm || rand() < 0.35) {
          for (const m of w.members) {
            const x = fx + m.off;
            if (x < -40 * k || x > L.W + 40 * k) continue;
            if (rand() < dt * 2.4) puffs(L, x + 30 * k, L.H * (ROWS[m.row].y) - 2 * k, 1, false, 0.28);
          }
        }
      }
    }
    // a herd that has run off is forgotten; the next one starts when the one before has crossed the middle of the screen
    D.waves = D.waves.filter((w) => !w.passed);
    if (D.phase === 'waves' && D.made < HERD.waves) {
      const last = D.waves[D.waves.length - 1];
      const clear = !last || (last.resolved && last.tw >= HERD.warn && front(L, last) + last.offMax < L.W * 0.3 && (!last.bull.braked || last.bull.away || last.bull.x < L.W * 0.3));
      if (clear) { D.gapT += dt; if (D.gapT >= 0.5) { newWave(L); D.gapT = 0; } } else D.gapT = 0;
    }
    // everything has run by
    if (!D.ended && D.phase === 'waves' && D.made >= HERD.waves && D.waves.length === 0 && D.resolved >= HERD.waves) {
      D.ended = true; D.phase = 'settle'; D.endT = 0; D.held = D.good >= 2;
      emit({ type: 'stampedeEnd', held: D.held });
      if (D.held) { text(L, 'THE WAGON HELD!', L.W * 0.5, L.H * 0.3, '#ffd23f'); if (hooks && hooks.celebrate) hooks.celebrate('star'); }
      else text(L, 'WHAT A DUSTY HERD!', L.W * 0.5, L.H * 0.3, '#ffffff');
    } else if (D.phase === 'settle') {
      D.endT += dt;
      if (D.endT >= HERD.settle) D.done = true;
    }
    // the wagon rolls; a good brake stops the team for a moment
    D.brakeT = Math.max(0, D.brakeT - dt);
    const vt = D.brakeT > 0 ? 0 : HERD.trail * k;
    D.v = approach(D.v, vt, D.brakeT > 0 ? 7 : 2.5, dt);
    if (D.v < 0.4 * k && vt === 0) D.v = 0;
    D.dist += D.v * dt; D.spin += (D.v * dt) / (20 * k); D.walkPh += (D.v / k) * dt * 0.11;
    S.scroll = D.scroll0 + D.dist; S.speed = D.v; S.walkPh = D.walkPh; S.wheelSpin = D.spin; S.walkAmp = D.v > 3 * k ? 0.5 : 0;
    // the ground shakes a little while a herd is on the screen
    let on = false;
    for (const w of D.waves) if (w.tw >= HERD.warn) { const fx = front(L, w); if (fx < L.W + 40 * k && fx + w.offMax > -40 * k) on = true; }
    const rumble = D.waves.some((w) => w.tw < HERD.warn && w.tw > 0.2);
    D.shake = rm ? 0 : on ? Math.sin(D.t * 53) * 1.7 * k : rumble ? Math.sin(D.t * 47) * 0.8 * k : 0;
    // dust and words
    D.haze = Math.max(0, D.haze - dt * (D.ended ? 0.28 : 0.22));
    for (const p of D.dust) if (p.on) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 11 * k; if (p.life >= p.max) p.on = false; }
    for (const tx of D.texts) tx.t += dt;
    D.texts = D.texts.filter((tx) => tx.t < 1.7);
  };

  // ---- draw: the herd behind the wagon (drawBack), the wagon is drawn by the engine, then drawFront ----
  D.drawBack = (c, L, t, rm) => {
    const k = L.k;
    // the dust cloud on the horizon while the first rumble builds
    for (const w of D.waves) {
      if (w.tw < HERD.warn) {
        const p = clamp(w.tw / HERD.warn, 0, 1);
        c.globalAlpha = 0.5 * p;
        c.fillStyle = '#d8bf8e';
        c.beginPath();
        for (let i = 0; i < 6; i++) { const cx = L.W * (1.02 - i * 0.045) , cy = L.H * (0.7 - (i % 2) * 0.03) - p * 14 * k; c.moveTo(cx + 34 * k, cy); c.arc(cx, cy, (24 + (i % 3) * 8) * k * (0.5 + p * 0.6), 0, TAU); }
        c.fill(); c.globalAlpha = 1;
        continue;
      }
      const fx = front(L, w);
      for (const m of w.members) {
        const x = fx + m.off, row = ROWS[m.row], s = k * row.s * m.sc, y = L.H * (row.y + m.dy);
        if (x < -80 * k || x > L.W + 80 * k) continue;
        c.beginPath(); c.ellipse(x - 4 * k, y + 1, 30 * s, 4.5 * s, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.2)'; c.fill();
        drawBison(c, x, y, s, -1, rm ? m.ph : m.ph + t * 17, false);
      }
      const b = w.bull, bs = bullScale(L, b.x), by = L.H * BULL_Y;
      if (b.x > -140 * k && b.x < L.W + 160 * k) {
        c.beginPath(); c.ellipse(b.x - 4 * k, by + 1, 30 * bs, 4.8 * bs, 0, 0, TAU); c.fillStyle = 'rgba(40,25,10,0.24)'; c.fill();
        const standing = b.braked && Math.abs(b.vx) < 8 * k;
        drawBison(c, b.x, by, bs, -1, standing ? 0 : rm ? b.ph : b.ph, true);
        if (standing && !rm && Math.sin(t * 6) > 0.3) drawPuff(c, b.x - 40 * bs, by - 22 * bs, 9 * bs, (t * 3) % 1);
      }
    }
  };
  D.drawFront = (c, L, t, rm) => {
    const { W, H, k } = L;
    // dust
    let n = 0;
    c.fillStyle = 'rgb(222,200,160)';
    for (const p of D.dust) {
      if (!p.on) continue;
      n++;
      c.globalAlpha = p.a * (1 - p.life / p.max);
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    D.dustDrawn = n;
    if (D.haze > 0.01) {
      c.globalAlpha = Math.min(0.62, D.haze);
      c.fillStyle = 'rgb(214,184,132)'; c.fillRect(0, H * 0.3, W, H * 0.7);
      c.globalAlpha = Math.min(0.62, D.haze) * 0.5; c.fillRect(0, 0, W, H * 0.3);
      c.globalAlpha = 1;
    }
    // the BRAKE sign over the wagon while a wave waits for it
    const w = D.waves.find((q) => q.cue && !q.resolved);
    if (w) {
      const cx = clamp(S.wagonX + 70 * k, 70 * k, W - 70 * k), cy = Math.max(H * 0.2, 70 * k), r = 40 * k;
      const ph = rm ? 0 : (t * 1.8) % 1;
      if (!rm) for (let i = 0; i < 2; i++) { const q = (ph + i * 0.5) % 1; c.globalAlpha = (1 - q) * 0.7; c.beginPath(); c.arc(cx, cy, r * (1 + q * 0.9), 0, TAU); c.lineWidth = 4 * k; c.strokeStyle = '#ffffff'; c.stroke(); }
      c.globalAlpha = 1;
      const pul = rm ? 1 : 1 + 0.08 * Math.sin(t * 12);
      c.save(); c.translate(cx, cy); c.scale(pul, pul);
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; c.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); } c.closePath();
      c.fillStyle = '#e2402a'; c.fill(); c.lineWidth = 4.5 * k; c.strokeStyle = '#ffffff'; c.stroke(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
      drawText(c, 'BRAKE!', 17 * k, 0, -2 * k, '#ffffff', OUT, r * 1.7);
      drawText(c, 'TAP!', 11 * k, 0, 17 * k, '#ffe14a', OUT, r * 0.9);
      c.restore();
    }
    // the three waves (a hoof print each: gold when the wagon held, tan when the dust won)
    for (let i = 0; i < HERD.waves; i++) {
      const x = 24 * k + i * 26 * k, y = 24 * k, res = D.results[i];
      c.beginPath(); c.arc(x, y, 10 * k, 0, TAU);
      c.fillStyle = res === true ? '#ffd23f' : res === false ? '#cfae7a' : 'rgba(255,246,230,0.25)'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(x - 4 * k, y - 4 * k); c.lineTo(x - 5 * k, y + 4 * k); c.moveTo(x + 4 * k, y - 4 * k); c.lineTo(x + 5 * k, y + 4 * k);
      c.lineWidth = 2.6 * k; c.strokeStyle = 'rgba(43,29,20,0.75)'; c.stroke();
    }
    if (D.phase === 'intro' || (D.waves.length && D.waves.every((q) => q.tw < HERD.warn + 0.3 && q.i === 0))) {
      c.globalAlpha = rm ? 0.95 : 0.78 + 0.22 * Math.sin(t * 6);
      drawText(c, 'HERD COMING!', 22 * k, W * 0.5, 30 * k, '#ffffff');
      c.globalAlpha = 1;
    }
    for (const tx of D.texts) {
      const a = clamp(tx.t < 1.4 ? 1 : (1.7 - tx.t) / 0.3, 0, 1), rise = rm ? 0 : tx.t * 14 * k;
      c.globalAlpha = a;
      drawText(c, tx.text, 28 * k, tx.x, tx.y - rise, tx.col);
      if (tx.sub) drawText(c, tx.sub, 13 * k, tx.x, tx.y - rise + 26 * k, '#ffffff');
    }
    c.globalAlpha = 1;
  };

  // ---- state ----
  D.state = () => {
    const w = D.waves.find((q) => !q.resolved) || D.waves[D.waves.length - 1];
    const phase = D.ended ? 'settle' : D.phase === 'intro' ? 'warn' : w ? (w.resolved ? (w.good ? 'brake' : 'dust') : w.cue ? 'cue' : w.tw < HERD.warn ? 'warn' : 'run') : 'warn';
    return { kind: 'stampede', wave: Math.min(HERD.waves, Math.max(1, D.resolved + (D.resolved < HERD.waves ? 1 : 0))), waves: HERD.waves, left: HERD.waves - D.resolved, good: D.good, hits: D.good, phase, held: D.held };
  };
  D.summary = () => ({ ...D.state(), finished: D.ended });
  D.debug = (L) => ({
    ...D.state(), t: D.t, made: D.made, resolved: D.resolved, results: D.results.slice(), v: D.v, brakeT: D.brakeT, shake: D.shake, haze: D.haze,
    cue: D.waves.some((q) => q.cue && !q.resolved), dust: D.dust.filter((p) => p.on).length,
    waves: D.waves.map((q) => ({ i: q.i, tw: q.tw, cue: q.cue, resolved: q.resolved, good: q.good, bullX: q.bull.x, front: front(L, q), passed: q.passed, bullVx: q.bull.vx })),
  });
  return D;
}
