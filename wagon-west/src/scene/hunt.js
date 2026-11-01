// Wagon West bow hunt (SPEC §1, §11 startHunt): animals cross a meadow in three lanes; a tap (or Space) looses an arrow
// from the child's spot at the bottom of the scene. Cartoon-clean: a hit animal flops onto its back with dizzy stars, a
// puff, and it is gone with "Got one!"; a miss is an arrow in the grass. No blood, no bodies left behind, no timer:
// animals keep coming until the shots are used (the app can leave with endMiniGame).
//
// v1.4 (owner: "make hunting a little harder, like in Oregon Trail: you had to lead the animals to hit them if they
// were running, but not if they are still"): the arrow has real flight time (0.5-0.8 s, longer for a farther target)
// and comes down where the child TAPPED. Animals alternate between grazing still (aim at the animal) and running
// across (aim ahead of it by its speed x the flight time). The mix is by animal: rabbits and pronghorn mostly run,
// deer are half and half, bison mostly stand about and amble off after a near miss. The first arrow of a hunt shows
// a faint dotted path, never again. A miss is a thunk in the grass and the animal keeps going. A hit is the same puff
// and flop as ever. The hunt event gains lead: true when the animal was moving at the hit; the yields are the same
// (rabbit 10, turkey 15, deer 40; the pronghorn is 20 lb and the bison 40, the journey just adds whatever comes).
// The keyboard shoots at the aim line (the pointer's last x on a laptop, the middle otherwise): Space is a timing game.
// Spawns come from the seed, so a seeded hunt replays the same.
//
// Events (via emit): { type: 'hunt', hit, animal, meatLb, lead } when each arrow lands; { type: 'huntEnd', meatLb, hits,
// shots } once every shot has landed and the last animal has puffed away.

import { TAU, mulberry32, clamp, ease, drawText } from './util.js';
import { GAME_ANIMALS, drawGameAnimal, drawCritter, dizzy, drawPuff, drawArrow, drawBow } from './sprites.js';

const LANES = [{ y: 0.705, s: 0.6 }, { y: 0.785, s: 0.8 }, { y: 0.875, s: 1 }];
const LANE_KINDS = { rabbit: [1, 2], turkey: [0, 1, 2], deer: [0, 1, 2], pronghorn: [0, 1], bison: [0, 1] };
// run: the chance an animal crosses at a run (a lead shot) instead of walking in, grazing still, then moving off
// mul: how much faster than its walk the species RUNS (a runner's lead must be bigger than a fingertip)
const PROFILE = { rabbit: { run: 0.78, mul: 1.2 }, pronghorn: { run: 0.82, mul: 1.15 }, turkey: { run: 0.5, mul: 1.3 }, deer: { run: 0.5, mul: 1.25 }, bison: { run: 0.2, mul: 2, startles: true } };
const SPAWN = [['rabbit', 0.3], ['turkey', 0.52], ['deer', 0.77], ['pronghorn', 0.9], ['bison', 1]];
export const FLIGHT_MIN = 0.5, FLIGHT_MAX = 0.8; // arrow flight, seconds, by distance
const MAX_ALIVE = 3;
const WALK = 0.4; // walking-in speed as a share of the species' run speed
const LEAD_TAP = 14, STILL_TAP = 20; // fingertip allowances (css px x k) around the animal's body

// flight time from the bow to a target: 0.5 s close by, 0.8 s at the far end of the far lane
export function flightTime(L, tx, ty) {
  const ox = L.W * 0.5, oy = L.H - 30 * L.k;
  const far = Math.hypot(L.W * 0.5, oy - L.H * LANES[0].y);
  return FLIGHT_MIN + (FLIGHT_MAX - FLIGHT_MIN) * clamp(Math.hypot(tx - ox, ty - oy) / far, 0, 1);
}

export function createHunt(opts, emit) {
  const seed = (opts && Number.isFinite(+opts.seed) ? +opts.seed : 1) >>> 0;
  const shots = clamp(Math.round(opts && opts.shots != null ? +opts.shots : 5) || 5, 1, 20);
  const rand = mulberry32(seed || 1);
  const H = {
    kind: 'hunt', shots, left: shots, fired: 0, hits: 0, leadHits: 0, meatLb: 0,
    n: 0, animals: [], arrows: [], stuck: [], puffs: [], texts: [], guide: null,
    spawnT: 0.35, t: 0, endT: 0, ended: false, done: false,
    aimX: null, aimY: null, nock: 1, lastAim: -Math.PI / 2,
  };
  const dims = (L, a) => {
    const lane = LANES[a.lane], def = GAME_ANIMALS[a.kind], s = L.k * lane.s;
    const x = a.u * L.W, y = L.H * lane.y;
    return { x, y, s, r: def.r * s, cy: y - def.r * s * (a.kind === 'deer' ? 1.15 : 1) };
  };
  // "moving" is walking or running; only a RUNNING animal (mode run / flee) needs a lead and reports lead: true
  const isRun = (a) => a.mode === 'run' || a.mode === 'flee';
  const speedOf = (a) => (isRun(a) ? a.speed * PROFILE[a.kind].mul : a.mode === 'walk' ? a.speed * WALK : 0);
  const pxSpeed = (L, a) => a.dir * speedOf(a) * L.k * LANES[a.lane].s; // css px per second (signed)
  function spawn() {
    const p = rand();
    const kind = SPAWN.find(([, hi]) => p < hi)[0];
    const lanes = LANE_KINDS[kind];
    const lane = lanes[Math.floor(rand() * lanes.length)];
    const dir = rand() < 0.5 ? 1 : -1;
    const speed = GAME_ANIMALS[kind].speed * (0.85 + rand() * 0.3);
    const cross = rand() < PROFILE[kind].run;
    H.animals.push({
      id: ++H.n, cross, kind, lane, dir, u: dir > 0 ? -0.07 : 1.07, ph: rand() * 6, speed, state: 'alive', mode: cross ? 'run' : 'walk',
      stopU: 0.2 + rand() * 0.6, grazeT: 2.6 + rand() * 2.2, startleT: -1, flopT: 0,
    });
  }
  function origin(L) { return { x: L.W * 0.5, y: L.H - 30 * L.k }; }

  function shoot(L, x, y, viaKey) {
    if (H.ended || H.left <= 0 || H.arrows.length) return false;
    const o = origin(L);
    const ty = viaKey ? y : clamp(y, L.H * 0.69, L.H * 0.93); // an arrow always comes down in the grass
    const flight = flightTime(L, x, ty);
    H.arrows.push({ sx: o.x, sy: o.y, tx: x, ty, t: 0, flight, viaKey });
    if (H.fired === 0) H.guide = { sx: o.x, sy: o.y, tx: x, ty, t: 0, flight };
    H.lastAim = Math.atan2(ty - o.y, x - o.x);
    H.left--; H.fired++;
    H.nock = 0;
    return true;
  }

  H.pointer = (L, x, y) => shoot(L, x, y, false);
  H.key = (L) => shoot(L, H.aimX != null ? H.aimX : L.W * 0.5, L.H * 0.78, true);
  H.move = (L, x, y) => { H.aimX = x; H.aimY = y; };

  // the animal the arrow found when it came down at (tx, ty), if any: the nearest inside its body + a fingertip
  function struck(L, ar) {
    let best = null, bestD = Infinity;
    for (const a of H.animals) {
      if (a.state !== 'alive') continue;
      const d = dims(L, a);
      if (d.x < -d.r || d.x > L.W + d.r) continue;
      const rad = d.r + (isRun(a) ? LEAD_TAP : STILL_TAP) * L.k;
      const dist = ar.viaKey ? Math.abs(d.x - ar.tx) : Math.hypot(d.x - ar.tx, d.cy - ar.ty);
      if (dist < rad && dist / rad < bestD) { bestD = dist / rad; best = a; }
    }
    return best;
  }

  H.update = (L, dt) => {
    H.t += dt;
    H.nock = Math.min(1, H.nock + dt / 0.35);
    // spawns (none once the last shot is loosed)
    const alive = H.animals.reduce((n, a) => n + (a.state === 'alive' ? 1 : 0), 0);
    if (H.left > 0 && alive < MAX_ALIVE) { H.spawnT -= dt; if (H.spawnT <= 0) { spawn(); H.spawnT = 0.9 + rand() * 1.3; } }
    for (const a of H.animals) {
      const lane = LANES[a.lane];
      if (a.state === 'alive') {
        if (a.mode === 'walk' && (a.dir > 0 ? a.u >= a.stopU : a.u <= a.stopU)) a.mode = 'graze';
        else if (a.mode === 'graze') { a.grazeT -= dt; if (a.grazeT <= 0) a.mode = 'run'; }
        if (a.startleT >= 0) { a.startleT -= dt; if (a.startleT < 0) { a.startleT = -1; if (a.mode !== 'run') a.mode = 'flee'; } }
        const v = speedOf(a);
        if (v > 0) { a.ph += dt * v * 0.1; a.u += (a.dir * v * L.k * lane.s * dt) / L.W; }
      } else if (a.state === 'flop') {
        a.flopT += dt;
        if (a.flopT >= 0.95 && !a.puffed) { a.puffed = true; const d = dims(L, a); H.puffs.push({ x: d.x, y: d.y - d.r * 0.6, r: d.r * 1.6, t: 0 }); }
        if (a.flopT >= 1.1) a.state = 'gone';
      }
    }
    H.animals = H.animals.filter((a) => a.state !== 'gone' && a.u > -0.12 && a.u < 1.12);
    // arrows fly for their flight time, then come down where the child tapped
    for (const ar of H.arrows) {
      ar.t += dt;
      if (ar.t >= ar.flight && !ar.landed) {
        ar.landed = true;
        const a = struck(L, ar);
        if (a) {
          const lead = isRun(a);
          a.state = 'flop'; a.flopT = 0;
          const lb = GAME_ANIMALS[a.kind].meatLb;
          H.hits++; H.meatLb += lb; if (lead) H.leadHits++;
          const d = dims(L, a);
          H.puffs.push({ x: ar.tx, y: ar.ty, r: 16 * L.k, t: 0 });
          H.texts.push({ text: lead ? 'GOOD LEAD!' : 'GOT ONE!', sub: '+' + lb + ' LB', x: clamp(d.x, 90 * L.k, L.W - 90 * L.k), y: d.y - d.r * 2.6, t: 0 });
          emit({ type: 'hunt', hit: true, animal: a.kind, meatLb: lb, lead });
        } else {
          H.stuck.push({ x: ar.tx, y: ar.ty, a: Math.atan2(ar.ty - ar.sy, ar.tx - ar.sx), t: 0 });
          H.puffs.push({ x: ar.tx, y: ar.ty, r: 8 * L.k, t: 0 });
          // a near miss startles a bison that was standing about: it ambles off
          for (const b of H.animals) {
            if (b.state === 'alive' && PROFILE[b.kind].startles && (b.mode === 'graze' || b.mode === 'walk') && b.startleT < 0) {
              const d = dims(L, b);
              if (Math.hypot(d.x - ar.tx, d.cy - ar.ty) < d.r + 130 * L.k) b.startleT = 0.35;
            }
          }
          emit({ type: 'hunt', hit: false, animal: null, meatLb: 0, lead: false });
        }
      }
    }
    if (H.guide) H.guide.t += dt;
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

  // one animal (the pronghorn and the bison come from the critter sprites; they flop onto their backs the same way)
  function drawAnimal(c, a, d, flop, t) {
    if (a.kind !== 'pronghorn' && a.kind !== 'bison') { drawGameAnimal(c, a.kind, d.x, d.y, d.s, a.dir, a.ph, flop, t); return; }
    const cyU = a.kind === 'bison' ? 22 : 30; // body centre height in sprite units
    c.save();
    if (flop > 0) {
      const py = d.y - cyU * d.s;
      c.translate(d.x, py); c.rotate(flop * Math.PI * a.dir); c.translate(-d.x, -py + flop * cyU * 0.45 * d.s);
    }
    drawCritter(c, a.kind, d.x, d.y, d.s, a.dir, flop > 0 ? 0 : a.ph);
    c.restore();
    if (flop > 0.55) { c.save(); c.translate(d.x, d.y); c.scale(d.s, d.s); dizzy(c, 0, -(cyU + 22), t); c.restore(); }
  }
  // the dotted arrow path (the first arrow of a hunt only; a mouse also sees it before the first shot)
  function dots(c, L, sx, sy, tx, ty, upto, alpha) {
    const lift = Math.hypot(tx - sx, ty - sy) * 0.12, n = 16;
    c.fillStyle = '#ffffff';
    for (let i = 1; i <= n; i++) {
      const p = i / n;
      if (p > upto) break;
      c.globalAlpha = alpha * (0.35 + 0.65 * p);
      c.beginPath(); c.arc(sx + (tx - sx) * p, sy + (ty - sy) * p - Math.sin(Math.PI * p) * lift, (1.6 + p * 1.2) * L.k, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  H.draw = (c, L, t, rm) => {
    const k = L.k;
    // animals, far lane first
    for (let lane = 0; lane < LANES.length; lane++) {
      for (const a of H.animals) {
        if (a.lane !== lane) continue;
        const d = dims(L, a);
        const flop = a.state === 'flop' ? ease(a.flopT / 0.35) : 0;
        if (a.puffed && a.flopT > 1.02) continue; // gone inside the puff
        drawAnimal(c, a, d, flop, t);
      }
    }
    for (const s of H.stuck) { c.globalAlpha = clamp(1.2 - s.t, 0, 1); drawArrow(c, s.x, s.y, s.a, 34 * k); }
    c.globalAlpha = 1;
    // the first arrow's dotted path (faint; it fades a moment after the arrow lands)
    if (H.guide && H.guide.t < H.guide.flight + 0.9) {
      const g = H.guide;
      dots(c, L, g.sx, g.sy, g.tx, g.ty, 1, 0.5 * clamp((g.flight + 0.9 - g.t) / 0.9, 0, 1));
    } else if (H.fired === 0 && H.aimX != null && H.aimY != null && !rm) {
      const o = origin(L);
      dots(c, L, o.x, o.y, H.aimX, clamp(H.aimY, L.H * 0.69, L.H * 0.93), 1, 0.4);
    }
    for (const ar of H.arrows) {
      const p = clamp(ar.t / ar.flight, 0, 1);
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
      const runner = H.animals.some((a) => a.state === 'alive' && isRun(a));
      c.globalAlpha = rm ? 0.95 : 0.75 + 0.25 * Math.sin(t * 4);
      drawText(c, runner ? 'AIM AHEAD OF RUNNERS!' : 'TAP AN ANIMAL!', 18 * k, L.W * 0.5, 30 * k, '#ffffff', undefined, L.W - 24 * k);
      c.globalAlpha = 1;
    }
  };

  H.state = () => ({ kind: 'hunt', left: H.left, hits: H.hits, leadHits: H.leadHits, meatLb: H.meatLb, phase: H.ended ? 'end' : H.left > 0 ? 'aim' : 'landing' });
  H.summary = () => ({ meatLb: H.meatLb, hits: H.hits, shots: H.fired });
  // an animal's intercept point: where to tap so the arrow (flying `flight` s to the tap) meets it (solved by iteration)
  function intercept(L, a) {
    const d = dims(L, a), vx = pxSpeed(L, a);
    let x = d.x, f = flightTime(L, x, d.cy);
    for (let i = 0; i < 8; i++) { x = d.x + vx * f; f = flightTime(L, x, d.cy); }
    return { x, y: d.cy, flight: f };
  }
  H.debug = (L) => ({
    ...H.state(), arrows: H.arrows.length, origin: origin(L), flightMin: FLIGHT_MIN, flightMax: FLIGHT_MAX,
    animals: H.animals.map((a) => {
      const d = dims(L, a), ic = intercept(L, a);
      return { id: a.id, cross: a.cross, kind: a.kind, lane: a.lane, state: a.state, mode: a.mode, moving: speedOf(a) > 0, running: isRun(a), vx: pxSpeed(L, a), x: d.x, y: d.cy, r: d.r, dir: a.dir, aim: { x: ic.x, y: ic.y }, flight: ic.flight };
    }),
  });
  return H;
}
