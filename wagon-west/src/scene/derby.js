// Wagon West Fort Derby (SPEC v1.1 §3, scene stream): a side-scroll race at a fort, the family's wagon against the
// mail wagon, on two lanes over the current biome. Not a mini-game that owns the pointer: the app drives it. The
// child's wagon rolls slowly on its own; every ~100 m (and once at the start line) the race HOLDS (both wagons) and the
// scene emits a marker; the app asks a fact and answers with derbyBurst(power): a quick right answer is power 1, a
// slow right one 0.6, a wrong one 0 (a stumble and no burst; the wagon rolls on). At the line: derbyEnd, confetti, the
// companions cheer by the finish post, and after 2 s the scene goes back to the backdrop it came from.
//
// No clock and no countdown are drawn ("GO!" when the race starts, "YOU WON!" / "GOOD RACE!" at the line), and the
// race is turn-based: nothing moves while the app is asking, so a slow reader is never behind for reading slowly.
//
// The mail wagon's pace (seeded): a gentle wave around an average speed chosen so that its finishing time falls
// between the child's time with all-but-one good bursts and with all-but-two (computed by the same integration the
// race uses). With the default 400 m (4 markers: 0, 100, 200, 300 m): 3 or 4 quick bursts win (so do 4 slow ones),
// 1 or 2 lose. Same seed and same powers => the same race.
//
// Events (via emit): { type: 'derbyMarker', n, of } (n = 1..of, the race holds) ·
//   { type: 'derbyEnd', won, margin, markers, bursts } (margin: metres between the wagons when the first crossed)

import { TAU, OUT, mulberry32, clamp, lerp, ease, drawText, rrect } from './util.js';
import { drawWagon, drawTeam, drawPerson, drawMailTrain, drawDog, drawPuff, MAIL_NOSE, TRAIN_NOSE } from './sprites.js';

export const DERBY = {
  base: 10, // m/s: the child's wagon rolling on its own
  burst: 50, // m/s of extra speed at power 1 (decays)
  decay: 0.9, // 1/s
  stumble: 0.7, // s at stumbleSpeed x base after a wrong answer
  stumbleSpeed: 0.35,
  seg: 100, // m between markers
  ready: 0.6, // s at the start line before the first marker
  linger: 2, // s after the line before the scene goes back
};
const effOf = (p) => { p = clamp(+p || 0, 0, 1); return p > 0 ? 0.25 + 0.75 * p : 0; };

// the child's race time (s) for one power per marker, integrated at 60 Hz exactly as the live race steps it
export function raceTime(powers, length, of) {
  const dt = 1 / 60;
  let x = 0, t = 0;
  for (let i = 0; i < of; i++) {
    const end = i < of - 1 ? ((i + 1) * length) / of : length;
    const eff = effOf(powers[i]);
    let boost = DERBY.burst * eff, st = eff > 0 ? 0 : DERBY.stumble;
    while (x < end) {
      const v = DERBY.base * (st > 0 ? DERBY.stumbleSpeed : 1) + boost;
      boost *= Math.exp(-DERBY.decay * dt); st = Math.max(0, st - dt);
      x += v * dt; t += dt;
    }
    x = Math.min(x, end);
  }
  return t;
}

// S: the engine's state (read only: party, dog, cheerT, rm, t) ; hooks.celebrate(kind) bursts confetti and cheers
export function createDerby(opts, emit, S, hooks) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const length = clamp(Math.round(o.length != null && Number.isFinite(+o.length) ? +o.length : 400), 50, 3000);
  const of = Math.max(1, Math.round(length / DERBY.seg));
  const markerPos = Array.from({ length: of }, (_, i) => (i * length) / of);
  const rand = mulberry32((seed ^ 0xd3b7) || 1);
  // the mail wagon's pace curve
  const good = (n) => Array.from({ length: of }, (_, i) => (i < n ? 1 : 0));
  const tLo = raceTime(good(of - 1), length, of);
  const tHi = raceTime(good(Math.max(0, of - 2)), length, of);
  const target = of >= 2 ? lerp(tLo, tHi, 0.3 + 0.3 * rand()) : lerp(raceTime([1], length, 1), raceTime([0], length, 1), 0.5);
  const wAmp = 0.1 + 0.1 * rand(), wLen = 110 + 70 * rand(), wPh = rand() * TAU;
  const pace = (x) => 1 + wAmp * Math.sin((TAU * x) / wLen + wPh);
  let inv = 0;
  for (let i = 0, n = 600; i < n; i++) inv += length / n / pace(((i + 0.5) * length) / n);
  const vAvg = inv / target;

  const dust = Array.from({ length: 26 }, () => ({ on: false, w: 0, lane: 0, r: 0, life: 0, max: 1, vw: 0, vy: 0, big: false }));
  const D = {
    kind: 'derby', input: false, length, of, markerPos, seed,
    child: 0, mail: 0, prevChild: 0, vChild: 0, vMail: 0, boost: 0, stumbleT: 0,
    phase: 'ready', readyT: 0, next: 0, markers: 0, bursts: 0, powers: [],
    goT: 0, endT: 0, won: null, margin: 0, decided: false, mailDone: false, childDone: false, done: false,
    t: 0, ph: 0, mph: 0, spin: 0, mspin: 0, dogPh: 0, dustAcc: 0, mdustAcc: 0, scroll0: S.scroll, sumAt: null,
  };

  function reachMarker() {
    D.phase = 'wait';
    D.boost = 0; D.stumbleT = 0;
    D.markers++; D.next++;
    emit({ type: 'derbyMarker', n: D.markers, of });
  }
  function spawnDust(w, lane, vw, big) {
    const p = dust.find((q) => !q.on);
    if (!p) return;
    p.on = true; p.w = w; p.lane = lane; p.life = 0; p.big = big;
    p.max = big ? 0.8 : 0.55 + rand() * 0.4; p.r = big ? 9 + rand() * 5 : 3 + rand() * 3;
    p.vw = vw; p.vy = -(6 + rand() * 10);
  }

  D.burst = (power) => {
    if (D.phase !== 'wait') return false;
    const eff = effOf(power);
    D.powers.push(clamp(+power || 0, 0, 1));
    D.boost = DERBY.burst * eff;
    if (eff > 0) D.bursts++;
    else { D.stumbleT = DERBY.stumble; for (let i = 0; i < 5; i++) spawnDust(D.child - 4 - i * 3, 0, 0, true); }
    if (D.markers === 1) D.goT = 1.4;
    D.phase = 'run';
    return true;
  };

  D.update = (L, dt) => {
    D.t += dt;
    D.goT = Math.max(0, D.goT - dt);
    let vc = 0, vm = 0;
    if (D.phase === 'ready') {
      D.readyT += dt;
      if (D.readyT >= DERBY.ready) reachMarker();
    } else if (D.phase === 'run') {
      vc = DERBY.base * (D.stumbleT > 0 ? DERBY.stumbleSpeed : 1) + D.boost;
      D.boost *= Math.exp(-DERBY.decay * dt);
      D.stumbleT = Math.max(0, D.stumbleT - dt);
      vm = D.mailDone ? D.vMail * Math.exp(-1.6 * dt) : vAvg * pace(D.mail);
      const c0 = D.child, m0 = D.mail;
      let c1 = c0 + vc * dt;
      const m1 = m0 + vm * dt;
      // who reaches the line first (inside this step, by the fraction of the step)
      const fc = c1 >= length ? (length - c0) / Math.max(1e-6, c1 - c0) : Infinity;
      const fm = !D.mailDone && m1 >= length ? (length - m0) / Math.max(1e-6, m1 - m0) : Infinity;
      if (!D.decided && (fc < Infinity || fm < Infinity)) {
        D.decided = true;
        if (fc <= fm) { D.won = true; D.margin = length - lerp(m0, m1, Math.min(1, fc)); }
        else { D.won = false; D.margin = length - lerp(c0, c1, Math.min(1, fm)); }
      }
      if (fm < Infinity) D.mailDone = true;
      // the next marker holds the race (never the start one: that was passed in 'ready')
      if (D.next < of && c1 >= markerPos[D.next] && c1 < length) {
        c1 = markerPos[D.next];
        D.child = c1; D.mail = m1; D.vChild = vc; D.vMail = vm;
        reachMarker();
      } else {
        D.child = c1; D.mail = m1; D.vChild = vc; D.vMail = vm;
        if (c1 >= length) {
          D.childDone = true; D.phase = 'finish';
          const margin = Math.max(0, Math.round(D.margin));
          D.margin = margin;
          emit({ type: 'derbyEnd', won: !!D.won, margin, markers: D.markers, bursts: D.bursts });
          if (hooks && hooks.celebrate) hooks.celebrate('arrived'); // confetti either way: a race is a party
        }
      }
    } else if (D.phase === 'finish') {
      // both roll on past the line and pull up
      D.vChild *= Math.exp(-1.8 * dt);
      vc = D.vChild; D.child += vc * dt;
      if (!D.mailDone) {
        vm = vAvg * pace(D.mail); D.mail += vm * dt; D.vMail = vm;
        if (D.mail >= length) D.mailDone = true;
      } else { D.vMail *= Math.exp(-1.6 * dt); vm = D.vMail; D.mail += vm * dt; }
      D.endT += dt;
      if (D.endT >= DERBY.linger) D.done = true;
    }
    if (D.phase === 'wait') { D.vChild = 0; D.vMail = 0; }
    // animation phases (legs capped so a burst does not blur them)
    const k = L.k;
    D.ph += Math.min(vc, 24) * dt * 0.55;
    D.mph += Math.min(vm, 24) * dt * 0.7;
    D.dogPh += Math.min(Math.max(vc, 0), 30) * dt * 0.9;
    const ppm = ppmOf(L);
    D.spin += (vc * ppm * dt) / (20 * laneScale(L, 1));
    D.mspin += (vm * ppm * dt) / (15 * laneScale(L, 0));
    // dust from both trains' back wheels
    D.dustAcc += dt * Math.min(vc, 40) * 0.5 * (S.rm ? 0.3 : 1);
    while (D.dustAcc >= 1) { D.dustAcc -= 1; spawnDust(D.child - (TRAIN_NOSE + 34) * laneScale(L, 1) / ppm, 1, vc * 0.15, false); }
    D.mdustAcc += dt * Math.min(vm, 40) * 0.4 * (S.rm ? 0.3 : 1);
    while (D.mdustAcc >= 1) { D.mdustAcc -= 1; spawnDust(D.mail - (MAIL_NOSE + 28) * laneScale(L, 0) / ppm, 0, vm * 0.15, false); }
    for (const p of dust) if (p.on) { p.life += dt; p.w += p.vw * dt * 0.2; p.r += dt * 8; if (p.life >= p.max) p.on = false; }
    // the scenery scrolls with the camera (the camera follows the child's wagon)
    S.scroll = D.scroll0 + D.child * ppm;
  };

  // ---- geometry (css px) ----
  function ppmOf(L) { return 5 * L.k; }
  // lane 1 = the child's (near), lane 0 = the mail wagon's (far)
  function laneScale(L, lane) {
    const fit = (L.W * 0.62) / (TRAIN_NOSE + 80); // the family's train fits in ~62 % of the width (portrait)
    return lane ? Math.min(0.62 * L.k, fit) : Math.min(0.58 * L.k, fit * 0.93);
  }
  const laneY = (L, lane) => (lane ? L.H * 0.905 : L.H * 0.79);
  const anchor = (L) => L.W * 0.6;
  const sx = (L, w) => anchor(L) + (w - D.child) * ppmOf(L);

  function drawGate(c, L, w, finish) {
    const k = L.k, x = sx(L, w);
    if (x < -90 * k || x > L.W + 90 * k) return;
    const yBack = L.H * 0.745, yFront = L.H * 0.985, top = L.H * 0.42;
    // the line across both lanes (a skewed band)
    const bw = 12 * k, rows = 10;
    for (let i = 0; i < rows; i++) {
      const t0 = i / rows, t1 = (i + 1) / rows;
      const xa = lerp(x + 10 * k, x - 8 * k, t0), xb = lerp(x + 10 * k, x - 8 * k, t1);
      const ya = lerp(yBack, yFront, t0), yb = lerp(yBack, yFront, t1);
      for (let j = 0; j < 2; j++) {
        c.beginPath(); c.moveTo(xa + (j * bw) / 2, ya); c.lineTo(xa + ((j + 1) * bw) / 2, ya); c.lineTo(xb + ((j + 1) * bw) / 2, yb); c.lineTo(xb + (j * bw) / 2, yb); c.closePath();
        c.fillStyle = finish ? ((i + j) % 2 ? '#2b1d14' : '#ffffff') : '#ffffff'; c.fill();
      }
    }
    // the back pole
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + 14 * k, yBack); c.lineTo(x + 14 * k, top); c.lineWidth = 6 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.4 * k; c.strokeStyle = '#8a5a2e'; c.stroke();
    c.lineCap = 'butt';
  }
  function drawGateFront(c, L, w, finish) {
    const k = L.k, x = sx(L, w);
    if (x < -90 * k || x > L.W + 90 * k) return;
    const yFront = L.H * 0.985, top = L.H * 0.42;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 8 * k, yFront); c.lineTo(x - 8 * k, top + 8 * k); c.lineWidth = 7 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4 * k; c.strokeStyle = '#9a6a3c'; c.stroke();
    c.lineCap = 'butt';
    // the sign over the track, with bunting
    const sw = 118 * k, sh = 28 * k, cx = x + 3 * k, cy = top - 2 * k;
    c.beginPath(); rrect(c, cx - sw / 2, cy - sh / 2, sw, sh, 5 * k);
    c.fillStyle = finish ? '#f4ead0' : '#3f8a4b'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = OUT; c.stroke();
    if (finish) {
      for (const ex of [cx - sw / 2 + 4 * k, cx + sw / 2 - 16 * k]) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        if ((i + j) % 2) continue;
        c.fillStyle = '#2b1d14'; c.fillRect(ex + j * 6 * k, cy - sh / 2 + 5 * k + i * 6 * k, 6 * k, 6 * k);
      }
    }
    drawText(c, finish ? 'FINISH' : 'START', 14 * k, cx, cy + 1 * k, finish ? '#8a2b1b' : '#ffffff', finish ? null : OUT, sw * 0.62);
    c.beginPath();
    const cols = ['#ff5d5d', '#ffe14a', '#22b8ff', '#3ddc84'];
    for (let i = 0; i < 6; i++) {
      const bx = cx - sw / 2 + 6 * k + i * (sw - 12 * k) / 6, by = cy + sh / 2;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 14 * k, by); c.lineTo(bx + 7 * k, by + 10 * k); c.closePath(); c.fillStyle = cols[i % 4]; c.fill();
    }
  }
  function drawMarkerFlag(c, L, i) {
    const k = L.k, x = sx(L, markerPos[i]);
    if (x < -30 * k || x > L.W + 30 * k) return;
    const y = L.H * 0.85, h = 40 * k;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.lineWidth = 4 * k; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2 * k; c.strokeStyle = '#d8c7a0'; c.stroke();
    const wv = S.rm ? 0 : Math.sin(D.t * 5 + i) * 2 * k;
    c.beginPath(); c.moveTo(x, y - h); c.quadraticCurveTo(x + 10 * k, y - h - 2 * k + wv, x + 22 * k, y - h + 6 * k + wv); c.lineTo(x, y - h + 14 * k); c.closePath();
    c.fillStyle = ['#ffd23f', '#3ddc84', '#22b8ff', '#ff7ad1'][i % 4]; c.fill(); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
  }

  D.draw = (c, L, t, rm) => {
    const k = L.k;
    drawGate(c, L, 0, false);
    drawGate(c, L, length, true);
    // the companions watch from beside the finish post and cheer when the child's wagon comes in
    const P = S.party;
    if (P && P.looks) {
      const cheer = S.cheerT > 0 ? 1.8 - S.cheerT : 0;
      for (let i = 0; i < P.looks.length && i < 3; i++) {
        const x = sx(L, length + 14 + i * 7);
        if (x < -30 * k || x > L.W + 30 * k) continue;
        drawPerson(c, x, L.H * 0.735, k * 0.62, P.looks[i], 0, 0, cheer > 0 ? cheer + i * 0.12 : 0, -1);
      }
    }
    // dust behind the far lane
    let n = 0;
    c.fillStyle = 'rgba(232,214,180,1)';
    for (const p of dust) {
      if (!p.on) continue;
      const x = sx(L, p.w), y = laneY(L, p.lane) - 2 * k + p.vy * p.life * k;
      c.globalAlpha = (p.big ? 0.75 : 0.5) * (1 - p.life / p.max);
      c.beginPath(); c.arc(x, y, p.r * k, 0, TAU); c.fill();
      n++;
    }
    c.globalAlpha = 1;
    D.dustDrawn = n;
    // the mail wagon (far lane); far ahead, it waits peeking in at the right edge
    const sm = laneScale(L, 0), ym = laneY(L, 0);
    let mNose = sx(L, D.mail);
    mNose = Math.min(mNose, L.W + MAIL_NOSE * sm * 0.25);
    const mMoving = D.phase === 'run' || (D.phase === 'finish' && D.vMail > 1);
    const mBob = mMoving && !rm ? Math.abs(Math.sin(D.mph * 2)) * 1.6 : 0;
    drawMailTrain(c, mNose - MAIL_NOSE * sm, ym, sm, D.mspin, D.mph, mMoving ? 0.55 : 0, mBob);
    D.mNose = mNose;
    for (let i = 1; i < of; i++) drawMarkerFlag(c, L, i);
    // the family's wagon (near lane)
    const s = laneScale(L, 1), y = laneY(L, 1), nose = sx(L, D.child), wx = nose - TRAIN_NOSE * s;
    const moving = D.phase === 'run' || (D.phase === 'finish' && D.vChild > 1);
    // speed lines while a burst is on
    if (D.boost > 6 && !rm) {
      c.globalAlpha = clamp(D.boost / 40, 0, 0.8);
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const ly = y - (20 + i * 15) * s, lx = wx - 80 * s - ((D.t * 400 + i * 37) % 60) * k;
        c.moveTo(lx, ly); c.lineTo(lx - (40 + (i % 3) * 18) * k, ly);
      }
      c.lineWidth = 3 * k; c.strokeStyle = '#fffaf0'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
      c.globalAlpha = 1;
    }
    const wob = D.stumbleT > 0 ? Math.sin(D.stumbleT * 30) * 0.06 * (D.stumbleT / DERBY.stumble) : 0;
    c.save();
    if (wob) { c.translate(wx + 100 * s, y); c.rotate(wob); c.translate(-(wx + 100 * s), -y); }
    const bob = moving && !rm ? Math.abs(Math.sin(D.ph * 2)) * 1.4 : 0;
    drawTeam(c, wx + 96 * s, y, s, P ? P.animal : 'oxen', D.ph, moving ? (D.stumbleT > 0 ? 0.15 : 0.55) : 0, false);
    drawWagon(c, wx, y, s, P ? P.wagon : { box: '#a0612b', wheel: '#7a4a26', cover: '#f6efdc', flag: null, name: '' }, D.spin, bob, t);
    c.restore();
    if (D.stumbleT > 0) {
      const p = 1 - D.stumbleT / DERBY.stumble;
      c.globalAlpha = clamp(1 - p, 0, 1);
      drawPuff(c, wx + 170 * s, y - 6 * k, 22 * k, p);
      c.globalAlpha = 1;
    }
    D.nose = nose;
    // the dog runs alongside, just ahead of the team
    if (S.dog) {
      const dx = nose + 26 * k, dy = y + 4 * k;
      drawDog(c, dx, dy, k * 0.95, S.dog.coat, D.dogPh, moving ? 1 : 0, t, S.dogBarkT > 0 ? S.dogBarkT / 0.7 : 0, 1, false);
      D.dogX = dx; D.dogY = dy;
    }
    drawGateFront(c, L, 0, false);
    drawGateFront(c, L, length, true);
    // words: GO! when the race starts; at the line, a cheer for either result
    if (D.goT > 0) {
      const a = clamp(D.goT / 0.4, 0, 1), pop = rm ? 1 : 1 + 0.25 * ease(clamp((D.goT - 1.0) / 0.4, 0, 1));
      c.globalAlpha = a;
      drawText(c, 'GO!', 46 * k * pop, L.W * 0.5, L.H * 0.24, '#ffd23f');
      c.globalAlpha = 1;
    }
    if (D.phase === 'finish') {
      const a = clamp(D.endT / 0.25, 0, 1);
      c.globalAlpha = a;
      drawText(c, D.won ? 'YOU WON!' : 'GOOD RACE!', 34 * k, L.W * 0.5, L.H * 0.22, '#ffd23f');
      c.globalAlpha = 1;
    }
  };

  const r3 = (v) => Math.round(clamp(v, 0, 1) * 1000) / 1000;
  D.state = () => ({
    kind: 'derby', progress: r3(D.child / length), mailProgress: r3(D.mail / length), left: of - D.markers,
    phase: D.phase, markers: D.markers, bursts: D.bursts, won: D.childDone ? !!D.won : null,
  });
  D.summary = () => ({ ...D.state(), finished: D.childDone, margin: D.childDone ? D.margin : null });
  D.debug = (L) => ({
    ...D.state(), child: D.child, mail: D.mail, length, of, markerPos, boost: D.boost, stumbleT: D.stumbleT,
    vAvg, target, tLo, tHi, powers: D.powers.slice(), nose: D.nose, mailNose: D.mNose, dogX: D.dogX, dogY: D.dogY,
    laneY: [laneY(L, 0), laneY(L, 1)], scale: [laneScale(L, 0), laneScale(L, 1)], dust: D.dustDrawn || 0,
  });
  // the derby never takes the pointer or the keyboard (the app's panel answers for it)
  D.pointer = () => false;
  D.key = () => false;
  D.move = () => {};
  return D;
}
