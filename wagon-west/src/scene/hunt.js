// Wagon West bow hunt (SPEC §1, §11 startHunt): animals cross a meadow in three lanes (rabbit, turkey, deer); a tap
// (or Space) looses an arrow from the child's spot at the bottom of the scene. Cartoon-clean: a hit animal flops onto
// its back with dizzy stars, a puff, and it is gone with "Got one!"; a miss is an arrow in the grass. No blood, no
// bodies left behind, no timer: animals keep coming until the shots are used (the app can leave with endMiniGame).
//
// Kid-friendly aiming: a hit is decided when the arrow is loosed, by the animal nearest the tap within a generous
// radius (the animal's size plus a fingertip), and the arrow then flies to where that animal will be. The keyboard
// shoots at the aim line (the pointer's last x on a laptop, the middle of the screen otherwise), so Space is a timing
// game: shoot when an animal crosses the line. Spawns come from the seed, so a seeded hunt replays the same.
//
// Events (via emit): { type: 'hunt', hit, animal, meatLb } when each arrow lands; { type: 'huntEnd', meatLb, hits,
// shots } once every shot has landed and the last animal has puffed away.

import { mulberry32, clamp, ease, drawText } from './util.js';
import { GAME_ANIMALS, drawGameAnimal, drawPuff, drawArrow, drawBow } from './sprites.js';

const LANES = [{ y: 0.705, s: 0.6 }, { y: 0.785, s: 0.8 }, { y: 0.875, s: 1 }];
const LANE_KINDS = { rabbit: [1, 2], turkey: [0, 1, 2], deer: [0, 1, 2] };
const FLIGHT = 0.3; // arrow flight, seconds
const MAX_ALIVE = 3;

export function createHunt(opts, emit) {
  const seed = (opts && Number.isFinite(+opts.seed) ? +opts.seed : 1) >>> 0;
  const shots = clamp(Math.round(opts && opts.shots != null ? +opts.shots : 5) || 5, 1, 20);
  const rand = mulberry32(seed || 1);
  const H = {
    kind: 'hunt', shots, left: shots, fired: 0, hits: 0, meatLb: 0,
    animals: [], arrows: [], stuck: [], puffs: [], texts: [],
    spawnT: 0.35, t: 0, endT: 0, ended: false, done: false,
    aimX: null, aimY: null, nock: 1, lastAim: -Math.PI / 2,
  };
  const dims = (L, a) => {
    const lane = LANES[a.lane], def = GAME_ANIMALS[a.kind], s = L.k * lane.s;
    const x = a.u * L.W, y = L.H * lane.y;
    return { x, y, s, r: def.r * s, cy: y - def.r * s * (a.kind === 'deer' ? 1.15 : 1) };
  };
  function spawn() {
    const p = rand();
    const kind = p < 0.4 ? 'rabbit' : p < 0.72 ? 'turkey' : 'deer';
    const lanes = LANE_KINDS[kind];
    const lane = lanes[Math.floor(rand() * lanes.length)];
    const dir = rand() < 0.5 ? 1 : -1;
    const speed = GAME_ANIMALS[kind].speed * (0.85 + rand() * 0.3);
    H.animals.push({ kind, lane, dir, u: dir > 0 ? -0.07 : 1.07, ph: rand() * 6, speed, state: 'run', flopT: 0, targeted: false });
  }
  function origin(L) { return { x: L.W * 0.5, y: L.H - 30 * L.k }; }

  function shoot(L, x, y, viaKey) {
    if (H.ended || H.left <= 0 || H.arrows.length) return false;
    const k = L.k;
    let best = null, bestD = Infinity;
    for (const a of H.animals) {
      if (a.state !== 'run' || a.targeted) continue;
      const d = dims(L, a);
      if (d.x < -d.r || d.x > L.W + d.r) continue;
      const rad = d.r + 26 * k;
      const dist = viaKey ? Math.abs(d.x - x) : Math.hypot(d.x - x, d.cy - y);
      if (dist < rad && dist / rad < bestD) { bestD = dist / rad; best = a; }
    }
    const o = origin(L);
    let tx = x, ty = y;
    if (best) {
      const d = dims(L, best);
      tx = d.x + best.dir * best.speed * d.s * FLIGHT; ty = d.cy;
      best.targeted = true;
    } else if (viaKey) ty = L.H * 0.78;
    H.arrows.push({ sx: o.x, sy: o.y, tx, ty, t: 0, animal: best });
    H.lastAim = Math.atan2(ty - o.y, tx - o.x);
    H.left--; H.fired++;
    H.nock = 0;
    return true;
  }

  H.pointer = (L, x, y) => shoot(L, x, y, false);
  H.key = (L) => shoot(L, H.aimX != null ? H.aimX : L.W * 0.5, L.H * 0.78, true);
  H.move = (L, x, y) => { H.aimX = x; H.aimY = y; };

  H.update = (L, dt) => {
    H.t += dt;
    H.nock = Math.min(1, H.nock + dt / 0.35);
    // spawns (none once the last shot is loosed)
    const alive = H.animals.reduce((n, a) => n + (a.state === 'run' ? 1 : 0), 0);
    if (H.left > 0 && alive < MAX_ALIVE) { H.spawnT -= dt; if (H.spawnT <= 0) { spawn(); H.spawnT = 0.9 + rand() * 1.3; } }
    for (const a of H.animals) {
      const lane = LANES[a.lane];
      if (a.state === 'run') { a.ph += dt * a.speed * 0.1; a.u += (a.dir * a.speed * L.k * lane.s * dt) / L.W; }
      else if (a.state === 'flop') {
        a.flopT += dt;
        if (a.flopT >= 0.95 && !a.puffed) { a.puffed = true; const d = dims(L, a); H.puffs.push({ x: d.x, y: d.y - d.r * 0.6, r: d.r * 1.6, t: 0 }); }
        if (a.flopT >= 1.1) a.state = 'gone';
      }
    }
    H.animals = H.animals.filter((a) => a.state !== 'gone' && a.u > -0.12 && a.u < 1.12);
    // arrows
    for (const ar of H.arrows) {
      ar.t += dt;
      if (ar.t >= FLIGHT && !ar.landed) {
        ar.landed = true;
        const a = ar.animal;
        if (a && a.state === 'run') {
          a.state = 'flop'; a.flopT = 0;
          const lb = GAME_ANIMALS[a.kind].meatLb;
          H.hits++; H.meatLb += lb;
          const d = dims(L, a);
          H.puffs.push({ x: ar.tx, y: ar.ty, r: 16 * L.k, t: 0 });
          H.texts.push({ text: 'GOT ONE!', sub: '+' + lb + ' LB', x: clamp(d.x, 90 * L.k, L.W - 90 * L.k), y: d.y - d.r * 2.6, t: 0 });
          emit({ type: 'hunt', hit: true, animal: a.kind, meatLb: lb });
        } else {
          H.stuck.push({ x: ar.tx, y: ar.ty, a: Math.atan2(ar.ty - ar.sy, ar.tx - ar.sx), t: 0 });
          H.puffs.push({ x: ar.tx, y: ar.ty, r: 8 * L.k, t: 0 });
          emit({ type: 'hunt', hit: false, animal: null, meatLb: 0 });
        }
      }
    }
    H.arrows = H.arrows.filter((ar) => !ar.landed);
    for (const s of H.stuck) s.t += dt;
    H.stuck = H.stuck.filter((s) => s.t < 1.2);
    for (const p of H.puffs) p.t += dt;
    H.puffs = H.puffs.filter((p) => p.t < 0.6);
    for (const tx of H.texts) tx.t += dt;
    H.texts = H.texts.filter((tx) => tx.t < 1.5);
    // the end: every shot landed, nothing still flopping, the last words read
    if (H.left <= 0 && !H.arrows.length && !H.animals.some((a) => a.state === 'flop')) {
      H.endT += dt;
      if (H.endT >= 1.1 && !H.ended) {
        H.ended = true; H.done = true;
        emit({ type: 'huntEnd', meatLb: H.meatLb, hits: H.hits, shots: H.fired });
      }
    }
  };

  H.draw = (c, L, t, rm) => {
    const k = L.k;
    // animals, far lane first
    for (let lane = 0; lane < LANES.length; lane++) {
      for (const a of H.animals) {
        if (a.lane !== lane) continue;
        const d = dims(L, a);
        const flop = a.state === 'flop' ? ease(a.flopT / 0.35) : 0;
        if (a.puffed && a.flopT > 1.02) continue; // gone inside the puff
        drawGameAnimal(c, a.kind, d.x, d.y, d.s, a.dir, a.ph, flop, t);
      }
    }
    for (const s of H.stuck) { c.globalAlpha = clamp(1.2 - s.t, 0, 1); drawArrow(c, s.x, s.y, s.a, 34 * k); }
    c.globalAlpha = 1;
    for (const ar of H.arrows) {
      const p = clamp(ar.t / FLIGHT, 0, 1);
      const lift = Math.hypot(ar.tx - ar.sx, ar.ty - ar.sy) * 0.12;
      const x = ar.sx + (ar.tx - ar.sx) * p, y = ar.sy + (ar.ty - ar.sy) * p - Math.sin(Math.PI * p) * lift;
      const dx = ar.tx - ar.sx, dy = ar.ty - ar.sy - Math.cos(Math.PI * p) * Math.PI * lift;
      drawArrow(c, x, y, Math.atan2(dy, dx), 34 * k);
    }
    for (const p of H.puffs) { c.globalAlpha = clamp(1 - p.t / 0.6, 0, 1); drawPuff(c, p.x, p.y, p.r, p.t / 0.6); }
    c.globalAlpha = 1;
    for (const tx of H.texts) {
      const a = clamp(tx.t < 1.1 ? 1 : (1.5 - tx.t) / 0.4, 0, 1), rise = rm ? 0 : tx.t * 18 * k;
      c.globalAlpha = a;
      drawText(c, tx.text, 24 * k, tx.x, tx.y - rise, '#ffd23f');
      drawText(c, tx.sub, 15 * k, tx.x, tx.y - rise + 24 * k, '#ffffff');
    }
    c.globalAlpha = 1;
    // the bow at the child's spot, turned toward the aim
    const o = origin(L);
    let aim = H.lastAim;
    if (H.aimX != null && H.aimY != null && !H.arrows.length) aim = Math.atan2(Math.min(H.aimY, o.y - 20) - o.y, H.aimX - o.x);
    aim = clamp(aim, -Math.PI + 0.25, -0.25);
    const ready = H.left > 0 && !H.arrows.length;
    drawBow(c, o.x, o.y + 8 * k, k * 1.1, aim, ready ? ease(H.nock) : 0, ready && H.nock > 0.3);
    // the quiver: one arrow per shot, used ones faded; the meat so far
    for (let i = 0; i < H.shots; i++) {
      c.globalAlpha = i < H.left ? 1 : 0.28;
      drawArrow(c, 22 * k + i * 13 * k, 46 * k, Math.PI / 2, 30 * k);
    }
    c.globalAlpha = 1;
    if (H.meatLb > 0) drawText(c, H.meatLb + ' LB', 14 * k, 22 * k + H.shots * 13 * k + 34 * k, 30 * k, '#ffffff');
    if (H.fired === 0) {
      c.globalAlpha = rm ? 0.95 : 0.75 + 0.25 * Math.sin(t * 4);
      drawText(c, 'TAP AN ANIMAL!', 18 * k, L.W * 0.5, 30 * k, '#ffffff');
      c.globalAlpha = 1;
    }
  };

  H.state = () => ({ kind: 'hunt', left: H.left, hits: H.hits, meatLb: H.meatLb, phase: H.ended ? 'end' : H.left > 0 ? 'aim' : 'landing' });
  H.summary = () => ({ meatLb: H.meatLb, hits: H.hits, shots: H.fired });
  H.debug = (L) => ({
    ...H.state(), arrows: H.arrows.length, origin: origin(L),
    animals: H.animals.map((a) => { const d = dims(L, a); return { kind: a.kind, lane: a.lane, state: a.state, x: d.x, y: d.cy, r: d.r, dir: a.dir, targeted: a.targeted }; }),
  });
  return H;
}
