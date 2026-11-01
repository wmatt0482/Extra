// Wagon West gold panning and the rocker (SPEC v1.5 §4.3, scene stream). Pure fun, no fail: the scene never decides how much gold a pan
// holds, it reports how well the child swirled (the app asks journey/gold.js panOutcome / rockerOutcome) and shows what comes back.
//
// startPan({ seed, pans, rich: [i…] })  per pan, a close-up of the pan in the creek over whatever the scene shows:
//   scoop (tap) → swirl (drag circles round the pan, either way; or tap on the beat of the pulsing ring; the meter fills) → tip (tap when
//   the rim glows: the light sand washes over the lip) → { type: 'panSwirled', n, quality 0..1 } and the scene WAITS for scene.panReveal({
//   flakes, nugget }) → the water clears, the flakes glint in the pan (a nugget rises with a sparkle) → { type: 'pan', n, flakes, nugget } →
//   after the last: { type: 'panEnd', pans }, a cheer, and the scene goes back to its backdrop. Rich pans (the `rich` indexes, 0-based) glint
//   in the water before the scoop (a hint, never a timer). Nothing breaks, nothing is lost; a pan left alone just waits.
// startRocker({ seed, rounds })  a cradle on a creek bank: rock it left and right ON THE BEAT (a bouncing ball between two pegs; tap, or ← →)
//   while the water pours; 8 beats a round → { type: 'rockerRound', n, beats 0..1 } (the share of on-beat rocks) and the scene waits for
//   scene.rockerReveal({ flakes }) → { type: 'rockerEnd', rounds } after the last round's reveal.
// Both read the pointer and Space while they run (the engine's mini contract) and ask for the wagon to halt. getState().mini =
//   pan: { kind: 'pan', phase: 'scoop' | 'scooping' | 'swirl' | 'tip' | 'tipping' | 'swirled' | 'reveal' | 'end', n, pans, meter, rich, quality, flakes }
//   rocker: { kind: 'rocker', phase: 'ready' | 'rock' | 'swirled' | 'reveal' | 'end', n, rounds, beat, beats, flakes }
import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, rgba, drawText, rrect } from './util.js';
import { drawFlake, drawNugget } from './sprites15.js';

export const PAN = {
  revs: 3, // revolutions that fill the meter
  vGood: [1.4, 8.5], // rad/s of a good swirl
  beat: 0.8, // s per beat of the tap mode
  beatWin: 0.26, // s either side of a beat that counts
  scoopT: 0.6, tipT: 0.9, revealT: 2.3, linger: 2.2,
  glow: 1.5, // s per pulse of the rim
  rMin: 0.1, rMax: 2.4, // how far from the pan's centre (in pan radii) a finger still swirls
};
export const ROCK = { beat: 0.8, win: 0.24, beats: 8, lead: 1.3, tail: 0.7, revealT: 2.2, linger: 2.2 };

const num = (v, d) => (Number.isFinite(+v) ? +v : d);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

// ---------------------------------------------------------------- the pan
function drawCreek(c, cx, cy, rx, ry, t, rm, k) {
  c.beginPath(); c.ellipse(cx, cy + ry * 0.18, rx * 1.32, ry * 1.4, 0, 0, TAU); c.fillStyle = '#4f9cc6'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.ellipse(cx, cy + ry * 0.18, rx * 1.24, ry * 1.28, 0, 0, TAU); c.fillStyle = '#69b6dc'; c.fill();
  c.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + (rm ? 0 : t * 0.25), rr = 1.02 + (i % 3) * 0.08;
    c.moveTo(cx + Math.cos(a) * rx * rr + 18 * k, cy + ry * 0.18 + Math.sin(a) * ry * rr * 0.92); c.arc(cx + Math.cos(a) * rx * rr, cy + ry * 0.18 + Math.sin(a) * ry * rr * 0.92, 18 * k, 0, 1.2);
  }
  c.lineWidth = 2.2 * k; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
}
const PEBBLES = (() => { const r = mulberry32(99); return Array.from({ length: 26 }, () => { const a = r() * TAU, d = Math.sqrt(r()); return { a, d, s: 0.05 + r() * 0.06, col: ['#7a6a5a', '#9a8a74', '#5f564e', '#b4a48a', '#6a6a70'][Math.floor(r() * 5)], ph: r() * TAU }; }); })();
// st: { water 0..1 (the muddy water's alpha), pile 0..1, rot, glow 0..1, tilt 0..1, clear 0..1 (the water clearing), flakes: [{ a, d, ph }], nugget 0..1, sand 0..1 (the washing sand) }
function drawPan(c, cx, cy, rx, ry, st, t, rm, k) {
  c.save();
  c.translate(cx, cy); c.rotate(st.tilt * 0.1); c.translate(-cx, -cy);
  const sy = 1 - st.tilt * 0.16;
  c.beginPath(); c.ellipse(cx + 6 * k, cy + ry * 0.2, rx * 1.02, ry * 1.04, 0, 0, TAU); c.fillStyle = 'rgba(30,50,70,0.32)'; c.fill();
  c.beginPath(); c.ellipse(cx, cy, rx, ry * sy, 0, 0, TAU); c.fillStyle = '#59616b'; c.fill(); c.lineWidth = 3.4 * k; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.ellipse(cx, cy, rx * 0.96, ry * sy * 0.94, 0, 0, TAU); c.lineWidth = 6 * k; c.strokeStyle = '#b8c0c8'; c.stroke();
  c.beginPath(); c.ellipse(cx, cy - ry * 0.02, rx * 0.86, ry * sy * 0.82, 0, 0, TAU); c.fillStyle = '#8e969f'; c.fill();
  c.beginPath(); c.ellipse(cx, cy - ry * 0.02, rx * 0.66, ry * sy * 0.62, 0, 0, TAU); c.fillStyle = '#7b838d'; c.fill();
  c.save(); c.beginPath(); c.ellipse(cx, cy - ry * 0.02, rx * 0.84, ry * sy * 0.8, 0, 0, TAU); c.clip();
  // the muddy water
  const wa = clamp(st.water * (1 - st.clear * 0.92), 0, 1);
  if (wa > 0.01) {
    c.fillStyle = `rgba(150,112,64,${0.82 * wa})`; c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const s = 0.3 + i * 0.22, a0 = st.rot + i * 2.1;
      c.beginPath(); c.ellipse(cx, cy, rx * s, ry * s * sy, 0, a0, a0 + 2.0); c.lineWidth = (3.2 - i * 0.5) * k; c.strokeStyle = `rgba(255,236,190,${0.55 * wa})`; c.stroke();
    }
    c.lineCap = 'butt';
  }
  // the gravel, swirling round as it washes away
  if (st.pile > 0.02) {
    for (const p of PEBBLES) {
      const a = p.a + st.rot * (0.5 + p.d * 0.3), d = p.d * (0.5 + 0.4 * st.pile) * st.pile + 0.04;
      const x = cx + Math.cos(a) * rx * 0.62 * d * 1.1, y = cy + Math.sin(a) * ry * sy * 0.58 * d * 1.1;
      c.beginPath(); c.ellipse(x, y, rx * p.s * st.pile * 0.9, ry * p.s * st.pile * 0.7, a, 0, TAU); c.fillStyle = p.col; c.fill();
    }
  }
  // the light sand washing over the lip while it tips
  if (st.sand > 0) {
    c.beginPath(); for (let i = 0; i < 7; i++) { const x = cx + (i - 3) * rx * 0.14; c.moveTo(x, cy + ry * 0.2); c.lineTo(x + (i - 3) * 2 * k, cy + ry * 0.8 * sy); }
    c.lineWidth = 7 * k; c.strokeStyle = `rgba(214,184,130,${0.7 * st.sand})`; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
  }
  // the black sand and the gold itself
  if (st.clear > 0.2) {
    c.beginPath(); c.ellipse(cx, cy + ry * 0.12, rx * 0.34, ry * 0.2, 0, 0, TAU); c.fillStyle = `rgba(40,36,40,${0.5 * st.clear})`; c.fill();
    for (const f of st.flakes) {
      const x = cx + Math.cos(f.a) * rx * 0.5 * f.d, y = cy + ry * 0.1 + Math.sin(f.a) * ry * 0.34 * f.d, tw = rm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5 + f.ph);
      c.globalAlpha = clamp((st.clear - 0.25) * 3, 0, 1);
      drawFlake(c, x, y, Math.max(4.6, 6.4 * k), tw * 0.8);
    }
    c.globalAlpha = 1;
  }
  c.restore();
  // the lip of the rim glows when it is time to tip
  if (st.glow > 0.02) {
    c.beginPath(); c.ellipse(cx, cy, rx * 0.97, ry * sy * 0.95, 0, 0.18 * Math.PI, 0.82 * Math.PI); c.lineWidth = 9 * k; c.strokeStyle = `rgba(255,226,90,${0.95 * st.glow})`; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
    c.beginPath(); c.ellipse(cx, cy, rx * 0.97, ry * sy * 0.95, 0, 0.18 * Math.PI, 0.82 * Math.PI); c.lineWidth = 20 * k; c.strokeStyle = `rgba(255,226,90,${0.28 * st.glow})`; c.stroke();
  }
  c.restore();
  if (st.nugget > 0.01) drawNugget(c, cx, cy - ry * (0.15 + 0.5 * ease(st.nugget)), Math.max(14, 24 * k) * (0.6 + 0.4 * ease(st.nugget)), st.nuggetSp);
}

export function createPan(opts, emit, S, hooks) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const pans = clamp(Math.round(num(o.pans, 3)), 1, 8);
  const rich = new Set((Array.isArray(o.rich) ? o.rich : []).map((i) => i | 0));
  const rand = mulberry32((seed ^ 0x601d) || 1);
  const D = {
    kind: 'pan', view: 'keep', input: true, halt: true, done: false, ended: false,
    phase: 'scoop', n: 1, pans, t: 0, pt: 0, meter: 0, rot: 0, tilt: 0, glow: 0, water: 0, pile: 0, clear: 0, sand: 0, nuggetT: 0, nuggetSp: 0,
    quality: 0, swirlQ: 0, tipQ: 0, flakes: 0, nugget: false, gTotal: 0, gGood: 0, spark: [], floats: [], flakeList: [],
    dragging: false, lastA: null, accA: 0, lastPtr: null, shownFlakes: 0, results: [], texts: [], revealed: 0,
  };
  const isRich = () => rich.has(D.n - 1);
  const geo = (L) => {
    const { W, H, k } = L;
    const rx = Math.max(60, Math.min(W * 0.36, H * 0.3, 240 * k)), ry = rx * 0.64;
    return { cx: W / 2, cy: H * 0.6, rx, ry, k };
  };
  const text = (L, s, x, y, col = '#ffffff', size = 26) => D.texts.push({ s, x, y, col, size: size * L.k, t: 0 });
  const set = (ph) => { D.phase = ph; D.pt = 0; };

  function startPan() {
    D.meter = 0; D.rot = 0; D.tilt = 0; D.glow = 0; D.water = 0; D.pile = 0; D.clear = 0; D.sand = 0; D.nuggetT = 0; D.nugget = false; D.flakes = 0;
    D.gTotal = 0; D.gGood = 0; D.flakeList = []; D.shownFlakes = 0; D.dragging = false; D.lastA = null; D.accA = 0;
    set('scoop');
  }
  // ---- input
  const angleOf = (L, x, y) => { const g = geo(L); return { a: Math.atan2((y - g.cy) / g.ry, (x - g.cx) / g.rx), r: Math.hypot((x - g.cx) / g.rx, (y - g.cy) / g.ry) }; };
  function tapBeat(L) {
    // a tap on the beat of the pulsing ring (the tap mode of the swirl)
    const ph = (D.pt % PAN.beat), d = Math.min(ph, PAN.beat - ph);
    const on = d <= PAN.beatWin;
    D.gTotal += 1; D.gGood += on ? 1 : 0.4; D.meter = Math.min(1, D.meter + (on ? 0.25 : 0.1));
    D.rot += on ? 1.1 : 0.6;
    const g = geo(L); D.floats.push({ x: g.cx + (rand() - 0.5) * g.rx, y: g.cy - g.ry * 0.9, s: on ? 'NICE!' : 'OK', t: 0, col: on ? '#9be86a' : '#fff6d8' });
    if (hooks && hooks.sfx) hooks.sfx('splash');
  }
  function press(L, x, y) {
    if (D.ended) return false;
    if (D.phase === 'scoop') { set('scooping'); text(L, 'SCOOP!', L.W / 2, geo(L).cy - geo(L).ry * 1.3, '#ffd23f', 34); if (hooks && hooks.sfx) hooks.sfx('splash'); return true; }
    if (D.phase === 'swirl') {
      const p = angleOf(L, x, y);
      if (p.r >= PAN.rMin && p.r <= PAN.rMax) { D.dragging = true; D.lastA = p.a; D.accA = 0; }
      tapBeat(L);
      return true;
    }
    if (D.phase === 'tip') {
      const on = D.glow > 0.45;
      D.tipQ = on ? 1 : 0.5; set('tipping');
      if (hooks && hooks.sfx) hooks.sfx('whoosh');
      return true;
    }
    return false;
  }
  D.pointer = (L, x, y) => press(L, x, y);
  D.move = () => {};
  D.drag = (L, x, y) => {
    if (D.phase !== 'swirl' || !D.dragging) return;
    const p = angleOf(L, x, y);
    if (p.r < PAN.rMin || p.r > PAN.rMax) { D.lastA = null; return; }
    if (D.lastA != null) D.accA += angDiff(p.a, D.lastA);
    D.lastA = p.a;
  };
  D.release = () => { D.dragging = false; D.lastA = null; };
  D.key = (L) => { const g = geo(L); return press(L, g.cx, g.cy - g.ry * 0.5); };

  D.reveal = (r) => {
    if (D.phase !== 'swirled') return false;
    const f = Math.max(1, Math.floor(num(r && r.flakes, 1)));
    D.flakes = f; D.nugget = !!(r && r.nugget);
    D.flakeList = Array.from({ length: Math.min(f, 22) }, () => ({ a: rand() * TAU, d: 0.15 + rand() * 0.85, ph: rand() * TAU }));
    set('reveal'); D.nuggetT = 0; D.revealed++;
    emit({ type: 'pan', n: D.n, flakes: f, nugget: D.nugget });
    if (hooks && hooks.sfx) hooks.sfx('twinkle');
    return true;
  };

  D.update = (L, dt) => {
    D.t += dt; D.pt += dt;
    const g = geo(L);
    for (const f of D.floats) f.t += dt; D.floats = D.floats.filter((f) => f.t < 1);
    for (const x of D.texts) x.t += dt; D.texts = D.texts.filter((x) => x.t < 1.4);
    if (D.phase === 'scoop') { D.water = approachTo(D.water, 0.0, dt); D.pile = 0; D.clear = 0; D.tilt = 0; D.glow = 0; }
    else if (D.phase === 'scooping') {
      const u = clamp(D.pt / PAN.scoopT, 0, 1); D.pile = ease(u); D.water = ease(u);
      if (u >= 1) { set('swirl'); text(L, 'SWIRL, SWIRL!', g.cx, g.cy - g.ry * 1.35, '#ffffff', 30); }
    } else if (D.phase === 'swirl') {
      D.pile = clamp(1 - D.meter * 0.55, 0.3, 1);
      // the finger's angle this frame: the speed decides how well it counts
      const da = Math.abs(D.accA), v = dt > 0 ? da / dt : 0;
      if (da > 0.001) {
        const sf = v >= PAN.vGood[0] && v <= PAN.vGood[1] ? 1 : v >= PAN.vGood[0] * 0.5 && v <= PAN.vGood[1] * 1.7 ? 0.5 : 0.2;
        D.gTotal += da; D.gGood += da * sf;
        D.meter = Math.min(1, D.meter + (da / (TAU * PAN.revs)) * (0.6 + 0.4 * sf));
        D.rot += D.accA * 0.9;
        D.accA = 0;
      } else if (!D.dragging) D.rot += dt * 0.5 * (1 - D.meter); // the water slows by itself
      if (D.meter >= 1) {
        D.swirlQ = D.gTotal > 0 ? clamp(D.gGood / D.gTotal, 0, 1) : 0;
        D.dragging = false; set('tip'); text(L, 'TIP IT!', g.cx, g.cy - g.ry * 1.35, '#ffd23f', 34);
      }
    } else if (D.phase === 'tip') {
      D.pile = clamp(1 - D.meter * 0.55, 0.3, 1); D.rot += dt * 0.4;
      D.glow = 0.5 + 0.5 * Math.sin((D.pt / PAN.glow) * TAU - Math.PI / 2);
    } else if (D.phase === 'tipping') {
      const u = clamp(D.pt / PAN.tipT, 0, 1);
      D.tilt = Math.sin(u * Math.PI); D.sand = Math.sin(clamp(u * 1.4, 0, 1) * Math.PI); D.glow = 0; D.pile = lerp(0.45, 0.05, u); D.clear = u * 0.6; D.water = 1;
      if (u >= 1) {
        D.tilt = 0; D.sand = 0;
        D.quality = clamp(D.swirlQ * 0.82 + D.tipQ * 0.18, 0, 1);
        set('swirled');
        emit({ type: 'panSwirled', n: D.n, quality: Math.round(D.quality * 1000) / 1000 }); // the app answers with scene.panReveal (before or after this call returns)
      }
    } else if (D.phase === 'swirled') {
      D.clear = approachTo(D.clear, 0.6, dt); D.glow = 0; D.pile = 0.05;
    } else if (D.phase === 'reveal') {
      const u = clamp(D.pt / 0.8, 0, 1);
      D.clear = lerp(0.6, 1, ease(u)); D.pile = 0; D.water = 1;
      if (D.nugget) { D.nuggetT = clamp(D.pt / 0.9, 0, 1); D.nuggetSp = 0.5 + 0.5 * Math.sin(D.pt * 7); }
      if (D.pt > 0.5 && !D.revealText) { D.revealText = true; text(L, `${D.flakes} FLAKE${D.flakes === 1 ? '' : 'S'}!`, g.cx, g.cy - g.ry * 1.35, '#ffd23f', 34); if (D.nugget) text(L, 'A NUGGET!', g.cx, g.cy + g.ry * 1.55, '#fff2a8', 30); }
      if (D.pt >= PAN.revealT) {
        D.revealText = false;
        if (D.n >= pans) {
          D.ended = true; set('end'); D.glow = 0;
          emit({ type: 'panEnd', pans });
          if (hooks && hooks.celebrate) hooks.celebrate('star', g.cx, g.cy - g.ry);
        } else { D.n++; startPan(); }
      }
    } else if (D.phase === 'end') {
      if (D.pt >= PAN.linger) D.done = true;
    }
  };
  const approachTo = (v, to, dt) => v + (to - v) * (1 - Math.exp(-6 * dt));

  // ---- drawing: a dim over the scene, the creek, the pan, the meter and the words
  D.drawOver = (c, L, t, rm) => {
    const { W, H, k } = L, g = geo(L);
    c.fillStyle = 'rgba(30,22,14,0.46)'; c.fillRect(0, 0, W, H);
    drawCreek(c, g.cx, g.cy, g.rx, g.ry, t, rm, k);
    // a rich pan glints in the water before the scoop (a hint, not a timer)
    if (D.phase === 'scoop' && isRich()) {
      for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.5, tw = rm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 3 + i * 1.9); drawFlake(c, g.cx + Math.cos(a) * g.rx * 1.15, g.cy + g.ry * 0.3 + Math.sin(a) * g.ry * 0.9, Math.max(3, 4.4 * k), tw); }
    }
    // the beat's pulsing ring (the tap mode) around the pan while swirling
    if (D.phase === 'swirl') {
      const ph = (D.pt % PAN.beat) / PAN.beat, pulse = 1 + 0.07 * Math.sin(ph * TAU * 1) * (rm ? 0.4 : 1);
      c.beginPath(); c.ellipse(g.cx, g.cy, g.rx * 1.12 * pulse, g.ry * 1.12 * pulse, 0, 0, TAU); c.lineWidth = 4 * k; c.strokeStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.max(0, 1 - ph * 4)})`; c.setLineDash([14 * k, 10 * k]); c.lineDashOffset = -(rm ? 0 : t * 30); c.stroke(); c.setLineDash([]);
      // the arrow that says "round and round"
      const aa = (rm ? 0.6 : t * 1.6) % TAU, ax = g.cx + Math.cos(aa) * g.rx * 1.12, ay = g.cy + Math.sin(aa) * g.ry * 1.12;
      c.beginPath(); c.arc(ax, ay, 8 * k, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    }
    drawPan(c, g.cx, g.cy, g.rx, g.ry, { water: D.water, pile: D.pile, rot: D.rot, glow: D.glow, tilt: D.tilt, clear: D.clear, flakes: D.flakeList, nugget: D.nuggetT, nuggetSp: D.nuggetSp, sand: D.sand }, t, rm, k);
    // the swirl meter
    if (D.phase === 'swirl' || D.phase === 'tip') {
      const mw = Math.min(W * 0.7, g.rx * 1.6), mh = 16 * k, mx = g.cx - mw / 2, my = g.cy - g.ry * 1.75;
      c.beginPath(); rrect(c, mx, my, mw, mh, mh / 2); c.fillStyle = 'rgba(255,255,255,0.28)'; c.fill(); c.lineWidth = 2.6 * k; c.strokeStyle = OUT; c.stroke();
      if (D.meter > 0.01) { c.beginPath(); rrect(c, mx + 2, my + 2, Math.max(mh - 4, (mw - 4) * D.meter), mh - 4, (mh - 4) / 2); c.fillStyle = D.meter >= 1 ? '#ffd23f' : '#7fd25a'; c.fill(); }
    }
    // the pan's number
    c.beginPath(); rrect(c, 12 * k, 12 * k, 78 * k, 28 * k, 10 * k); c.fillStyle = 'rgba(30,22,14,0.65)'; c.fill();
    drawText(c, `PAN ${D.n} OF ${pans}`, 12 * k, 51 * k, 26 * k, '#fff6d8', null, 70 * k);
    // the hint for what to do now
    const hint = D.phase === 'scoop' ? 'TAP TO SCOOP' : D.phase === 'swirl' ? 'SWIRL THE PAN' : D.phase === 'tip' ? 'TAP WHEN THE RIM GLOWS' : '';
    if (hint) drawText(c, hint, 17 * k, g.cx, g.cy + g.ry * 1.62, '#ffffff', OUT, W * 0.9);
    for (const x of D.texts) { const u = clamp(x.t / 1.2, 0, 1); c.globalAlpha = clamp(2.4 - u * 2.4, 0, 1); drawText(c, x.s, x.size, x.x, x.y - u * 16 * k, x.col, OUT, W * 0.9); }
    for (const f of D.floats) { const u = f.t; c.globalAlpha = 1 - u; drawText(c, f.s, 15 * k, f.x, f.y - u * 24 * k, f.col, OUT, 120 * k); }
    c.globalAlpha = 1;
  };
  D.state = () => ({ kind: 'pan', phase: D.phase, n: D.n, pans, meter: Math.round(D.meter * 1000) / 1000, rich: isRich(), quality: Math.round(D.quality * 1000) / 1000, flakes: D.flakes, nugget: D.nugget });
  D.summary = () => ({ pans: D.revealed, finished: D.phase === 'end' });
  D.debug = (L) => ({ kind: 'pan', ...geo(L), phase: D.phase, beat: PAN.beat, pt: D.pt });
  startPan();
  return D;
}

// ---------------------------------------------------------------- the rocker
function drawRocker(c, cx, cy, s, ang, st, t, rm) {
  // a wooden cradle on two curved rockers, rocking about its feet; hopper and sieve at the high end, riffles along the sloping bed
  c.save(); c.translate(cx, cy); c.scale(s, s); c.rotate(ang);
  c.beginPath(); c.moveTo(-96, 6); c.quadraticCurveTo(0, 30, 96, 6); c.lineWidth = 9; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#8a5a2e'; c.stroke();
  c.beginPath(); c.moveTo(-92, -2); c.lineTo(-84, -44); c.lineTo(74, -26); c.lineTo(88, -2); c.closePath(); c.fillStyle = '#b98a54'; c.fill(); c.lineWidth = 3.4; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(-86, -34); c.lineTo(78, -18); c.lineWidth = 2; c.strokeStyle = '#7a4a26'; c.stroke();
  // the riffles (little bars across the bed) where the gold settles
  c.beginPath(); for (let i = 0; i < 5; i++) { const x = -52 + i * 26, y = -34 + (i + 2) * 3.4; c.moveTo(x, y); c.lineTo(x + 2, y + 15); }
  c.lineWidth = 3.2; c.strokeStyle = '#6a3f22'; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
  // the hopper with its sieve
  c.beginPath(); c.moveTo(-92, -44); c.lineTo(-84, -86); c.lineTo(-30, -82); c.lineTo(-22, -40); c.closePath(); c.fillStyle = '#c89a62'; c.fill(); c.lineWidth = 3.2; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.ellipse(-57, -82, 28, 6, 0, 0, TAU); c.fillStyle = '#5a6a78'; c.fill(); c.lineWidth = 2.4; c.stroke();
  c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(-57 + i * 9, -86); c.lineTo(-57 + i * 9, -78); } c.lineWidth = 1.2; c.strokeStyle = '#2a3a48'; c.stroke();
  // the handle
  c.beginPath(); c.moveTo(78, -26); c.lineTo(116, -64); c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = '#a8703e'; c.stroke();
  c.beginPath(); c.arc(118, -66, 6, 0, TAU); c.fillStyle = '#c89a62'; c.fill(); c.lineWidth = 2.2; c.stroke();
  // the gold caught in the riffles
  for (let i = 0; i < st.caught; i++) { const x = -52 + (i % 5) * 26 + 6, y = -34 + ((i % 5) + 2) * 3.4 + 10 - Math.floor(i / 5) * 3; const tw = rm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 4 + i * 1.3); drawFlake(c, x, y, 3.2, tw * 0.7); }
  c.restore();
}

export function createRocker(opts, emit, S, hooks) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const rounds = clamp(Math.round(num(o.rounds, 3)), 1, 6);
  const rand = mulberry32((seed ^ 0x70c4) || 1);
  const D = {
    kind: 'rocker', view: 'keep', input: true, halt: true, done: false, ended: false,
    phase: 'ready', n: 1, rounds, t: 0, rt: 0, pt: 0, hit: new Array(ROCK.beats).fill(false), hits: 0, ang: 0, angT: 0, last: 0, flakes: 0, caught: 0, floats: [], texts: [], poured: 0,
    beatsPlayed: 0,
  };
  const set = (ph) => { D.phase = ph; D.pt = 0; };
  const beatP = () => (D.rt - ROCK.lead) / ROCK.beat; // beats elapsed (fractional); beat i falls at integer i
  function startRound() { D.rt = 0; D.hit.fill(false); D.hits = 0; D.caught = 0; D.beatsPlayed = 0; set('ready'); }
  function tap(L, dir) { // dir: -1 left, 1 right, 0 any
    if (D.ended) return false;
    if (D.phase === 'ready' && D.rt < ROCK.lead - 0.4) { /* getting ready: a tap just rocks it */ }
    if (D.phase !== 'ready' && D.phase !== 'rock') return false;
    const p = beatP(), b = Math.round(p), d = Math.abs(p - b) * ROCK.beat;
    const side = b % 2 === 0 ? -1 : 1;
    const g = geo(L);
    if (b >= 0 && b < ROCK.beats && d <= ROCK.win && !D.hit[b] && (dir === 0 || dir === side)) {
      D.hit[b] = true; D.hits++; D.caught = Math.min(10, D.caught + 1);
      D.ang = side * 0.13; D.angT = 0; D.last = side;
      D.floats.push({ x: g.cx + side * g.s * 80, y: g.cy - g.s * 120, s: 'ON THE BEAT!', t: 0, col: '#9be86a' });
      if (hooks && hooks.sfx) hooks.sfx('splash');
    } else {
      const s2 = dir !== 0 ? dir : -D.last || 1;
      D.ang = s2 * 0.1; D.angT = 0; D.last = s2;
    }
    return true;
  }
  const geo = (L) => { const { W, H, k } = L; const s = Math.max(0.5, Math.min(W / 560, H / 430, 1.3 * k)); return { cx: W / 2, cy: H * 0.7, s, pegL: W / 2 - Math.min(W * 0.34, 190 * s), pegR: W / 2 + Math.min(W * 0.34, 190 * s), ty: H * 0.15 }; };
  D.pointer = (L, x) => tap(L, 0);
  D.move = () => {};
  D.key = (L) => tap(L, 0);
  D.keyDown = (L, name) => { if (name === 'left') return tap(L, -1) || true; if (name === 'right') return tap(L, 1) || true; return false; };
  D.keyUp = () => {};
  D.reveal = (r) => {
    if (D.phase !== 'swirled') return false;
    D.flakes = Math.max(2, Math.floor(num(r && r.flakes, 2)));
    set('reveal'); D.revealText = false;
    if (hooks && hooks.sfx) hooks.sfx('twinkle');
    return true;
  };
  D.update = (L, dt) => {
    D.t += dt; D.pt += dt; D.angT += dt;
    D.ang *= Math.exp(-3.2 * dt); // the cradle settles back
    for (const f of D.floats) f.t += dt; D.floats = D.floats.filter((f) => f.t < 1);
    for (const x of D.texts) x.t += dt; D.texts = D.texts.filter((x) => x.t < 1.4);
    const g = geo(L);
    if (D.phase === 'ready' || D.phase === 'rock') {
      D.rt += dt;
      if (D.phase === 'ready' && D.rt >= ROCK.lead) { set('rock'); D.texts.push({ s: 'ROCK IT!', x: g.cx, y: g.ty + g.s * 40, col: '#ffd23f', size: 30 * L.k, t: 0 }); }
      if (D.rt >= ROCK.lead + ROCK.beat * (ROCK.beats - 1) + ROCK.tail) {
        D.phase = 'swirled'; D.pt = 0;
        emit({ type: 'rockerRound', n: D.n, beats: Math.round((D.hits / ROCK.beats) * 1000) / 1000 }); // then scene.rockerReveal({ flakes })
      }
    } else if (D.phase === 'reveal') {
      if (D.pt > 0.4 && !D.revealText) { D.revealText = true; D.texts.push({ s: `${D.flakes} FLAKES!`, x: g.cx, y: g.ty + g.s * 40, col: '#ffd23f', size: 34 * L.k, t: 0 }); }
      D.caught = 10;
      if (D.pt >= ROCK.revealT) {
        if (D.n >= rounds) { D.ended = true; set('end'); emit({ type: 'rockerEnd', rounds }); if (hooks && hooks.celebrate) hooks.celebrate('star', g.cx, g.cy - 80 * g.s); }
        else { D.n++; startRound(); }
      }
    } else if (D.phase === 'end') { if (D.pt >= ROCK.linger) D.done = true; }
  };
  D.drawOver = (c, L, t, rm) => {
    const { W, H, k } = L, g = geo(L);
    c.fillStyle = 'rgba(30,22,14,0.42)'; c.fillRect(0, 0, W, H);
    // the creek bank: water and gravel under the rocker
    c.beginPath(); c.ellipse(g.cx, g.cy + 26 * g.s, 250 * g.s, 52 * g.s, 0, 0, TAU); c.fillStyle = '#5aa6d0'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); for (let i = 0; i < 7; i++) { const x = g.cx - 200 * g.s + i * 66 * g.s + (rm ? 0 : (t * 14) % 20), y = g.cy + (30 + (i % 3) * 12) * g.s; c.moveTo(x, y); c.lineTo(x + 28 * g.s, y); }
    c.lineWidth = 2 * k; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
    // the bucket pouring water into the hopper
    const bx = g.cx - 150 * g.s, by = g.cy - 190 * g.s;
    c.save(); c.translate(bx, by); c.rotate(0.5); c.beginPath(); c.moveTo(-18 * g.s, -14 * g.s); c.lineTo(18 * g.s, -14 * g.s); c.lineTo(14 * g.s, 20 * g.s); c.lineTo(-14 * g.s, 20 * g.s); c.closePath(); c.fillStyle = '#9aa2ab'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); c.restore();
    c.beginPath(); c.moveTo(bx + 16 * g.s, by + 16 * g.s); c.lineTo(g.cx - 62 * g.s, g.cy - 100 * g.s); c.lineWidth = 6 * g.s; c.strokeStyle = 'rgba(120,200,240,0.85)'; c.setLineDash([10 * g.s, 7 * g.s]); c.lineDashOffset = -(rm ? 0 : t * 60); c.stroke(); c.setLineDash([]);
    drawRocker(c, g.cx, g.cy, g.s, D.ang, { caught: D.caught }, t, rm);
    // the beat: a ball between two pegs
    const tw = g.pegR - g.pegL, ty = g.ty;
    c.beginPath(); c.moveTo(g.pegL, ty); c.lineTo(g.pegR, ty); c.lineWidth = 6 * k; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke(); c.lineWidth = 3 * k; c.strokeStyle = '#d8b878'; c.stroke(); c.lineCap = 'butt';
    for (const [px, i] of [[g.pegL, 0], [g.pegR, 1]]) {
      const lit = D.phase === 'rock' && Math.abs(((beatP() % 2) + 2) % 2 - (i ? 1 : 0)) < 0.16;
      c.beginPath(); c.arc(px, ty, (lit ? 22 : 17) * k, 0, TAU); c.fillStyle = lit ? 'rgba(255,226,90,0.9)' : 'rgba(255,255,255,0.35)'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = OUT; c.stroke();
    }
    const p = beatP(), q = p <= 0 ? 0 : 1 - Math.abs((((p % 2) + 2) % 2) - 1), bxp = lerp(g.pegL, g.pegR, D.phase === 'ready' || D.phase === 'rock' ? q : 0);
    c.beginPath(); c.arc(bxp, ty, 12 * k, 0, TAU); c.fillStyle = '#ff7a3a'; c.fill(); c.lineWidth = 2.6 * k; c.strokeStyle = OUT; c.stroke();
    // the round's beats so far
    for (let i = 0; i < ROCK.beats; i++) { c.beginPath(); c.arc(g.cx + (i - 3.5) * 22 * k, ty + 34 * k, 6 * k, 0, TAU); c.fillStyle = D.hit[i] ? '#7fd25a' : 'rgba(255,255,255,0.35)'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke(); }
    c.beginPath(); rrect(c, 12 * k, 12 * k, 104 * k, 28 * k, 10 * k); c.fillStyle = 'rgba(30,22,14,0.65)'; c.fill();
    drawText(c, `ROUND ${D.n} OF ${rounds}`, 12 * k, 64 * k, 26 * k, '#fff6d8', null, 94 * k);
    if (D.phase === 'ready' || D.phase === 'rock') drawText(c, 'TAP ON THE BEAT', 17 * k, g.cx, H * 0.94, '#ffffff', OUT, W * 0.9);
    for (const x of D.texts) { const u = clamp(x.t / 1.2, 0, 1); c.globalAlpha = clamp(2.4 - u * 2.4, 0, 1); drawText(c, x.s, x.size, x.x, x.y - u * 14 * k, x.col, OUT, W * 0.9); }
    for (const f of D.floats) { c.globalAlpha = 1 - f.t; drawText(c, f.s, 14 * k, f.x, f.y - f.t * 22 * k, f.col, OUT, 160 * k); }
    c.globalAlpha = 1;
  };
  D.state = () => ({ kind: 'rocker', phase: D.phase, n: D.n, rounds, beat: Math.max(0, Math.round(beatP() * 100) / 100), beats: Math.round((D.hits / ROCK.beats) * 1000) / 1000, flakes: D.flakes });
  D.summary = () => ({ rounds: D.phase === 'end' ? rounds : D.n - 1, finished: D.phase === 'end' });
  D.debug = (L) => ({ kind: 'rocker', ...geo(L), phase: D.phase, rt: D.rt, lead: ROCK.lead, period: ROCK.beat, win: ROCK.win });
  startRound();
  return D;
}
