// Title hero: the player's car rolls down the backdrop's ramp, launches off the lip, back-flips in a
// big arc across the title with a speed trail, lands in a dust puff, rolls off, and the loop
// restarts. Drawn on a canvas laid over the backdrop SVG using the SVG's own coordinate system
// (viewBox 1600×900, xMidYMax slice), so the car rides the painted ramp exactly.
// Modes: 'anim' (title screen), 'static' (other menus / reduced motion: one mid-air pose), 'off'.
import { paintCar } from './carPreview.js';

const VB_W = 1600, VB_H = 900;
const PPM = 40;                       // viewBox units per meter of car
const T_ROLL = 1.25, T_FLY = 1.7, T_LAND = 0.22, T_OUT = 0.9, T_REST = 0.55;
const PERIOD = T_ROLL + T_FLY + T_LAND + T_OUT + T_REST;
const LIP = { x: 560, y: 678 };
const LAND_X = 1290, OUT_X = 1760, APEX = 400;

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};
const dbez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
};
// ramp: M-20 300 C 140 300, 330 520, 520 690 (then a short kicker up to the lip at 560,678)
const ramp = (t) => ({ x: bez(-20, 140, 330, 520, t), y: bez(300, 300, 520, 690, t), dx: dbez(-20, 140, 330, 520, t), dy: dbez(300, 300, 520, 690, t) });
// landing ground: M760 820 C 1000 790, 1250 800, 1600 780 (extended flat past 1600)
function groundAt(x) {
  if (x >= 1600) return { y: 780, slope: 0 };
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (bez(760, 1000, 1250, 1600, m) < x) lo = m; else hi = m; }
  const t = (lo + hi) / 2;
  return { y: bez(820, 790, 800, 780, t), slope: Math.atan2(dbez(820, 790, 800, 780, t), dbez(760, 1000, 1250, 1600, t)) };
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createTitleHero(canvas, getCar) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1, raf = 0, mode = 'off', t0 = 0, lastT = 0;
  let trail = [], dust = [], landedLoop = -1, frameCount = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (mode === 'static') drawStatic();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);

  const wheelDrop = (car) => -Math.min(...car.wheels.map((w) => w.y - w.r)) * PPM;   // origin height above the wheels' contact

  // Portrait: the painted ramp is off-screen (the SVG is sliced to its middle), so the car instead
  // jumps in from the left edge and arcs over the logo through the empty sky, in screen space.
  const portrait = () => H > W * 1.1;
  const P_FLY = 2.1, P_PERIOD = P_FLY + 0.9;
  function posePortrait(t) {
    if (t >= P_FLY) return null;
    const u = t / P_FLY;
    const k = W * 0.3 / (5 * PPM);       // must match screenView() below: positions are in scaled units
    const x = lerp(-W * 0.25, W * 1.25, u);
    const y = lerp(H * 0.36, H * 0.3, u) - 4 * H * 0.2 * u * (1 - u);
    const a = -0.4 + 0.75 * u - Math.PI * 2 * smooth(0.2, 0.8, u);
    return { x: x / k, y: y / k, a, alpha: 1, phase: 'fly', u };
  }

  // Car pose at loop time t (s): {x, y, a (rad, canvas: + = clockwise), alpha, phase}
  function pose(t, car) {
    const lift = wheelDrop(car);
    if (t < T_ROLL) {
      const p = Math.pow(t / T_ROLL, 1.7);
      const rt = lerp(0.06, 1, p);
      const r = ramp(rt);
      const a = Math.atan2(r.dy, r.dx);
      return { x: r.x + Math.sin(a) * lift, y: r.y - Math.cos(a) * lift, a, alpha: smooth(0, 0.18, t), phase: 'roll', speed: p };
    }
    t -= T_ROLL;
    const g0 = groundAt(LAND_X);
    const start = { x: LIP.x, y: LIP.y - lift }, end = { x: LAND_X, y: g0.y - lift };
    if (t < T_FLY) {
      const u = t / T_FLY;
      const x = lerp(start.x, end.x, u);
      const y = lerp(start.y, end.y, u) - 4 * APEX * u * (1 - u);
      const a = lerp(-0.32, g0.slope, smooth(0.6, 1, u)) - Math.PI * 2 * smooth(0.12, 0.82, u);
      return { x, y, a, alpha: 1, phase: 'fly', u };
    }
    t -= T_FLY;
    if (t < T_LAND) {
      const k = t / T_LAND;
      return { x: lerp(LAND_X, LAND_X + 40, k), y: end.y + Math.sin(k * Math.PI) * 9, a: g0.slope + Math.sin(k * Math.PI) * 0.05, alpha: 1, phase: 'land' };
    }
    t -= T_LAND;
    if (t < T_OUT) {
      const k = t / T_OUT;
      const x = lerp(LAND_X + 40, OUT_X, k * (1.4 - 0.4 * k));
      const g = groundAt(x);
      return { x, y: g.y - lift, a: g.slope, alpha: 1 - smooth(0.6, 1, k), phase: 'out' };
    }
    return null;
  }

  function puff(x, y, n, spread, color) {
    for (let i = 0; i < n; i++) {
      dust.push({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.35) * 160, vy: -Math.random() * 120 - 20,
        r: 8 + Math.random() * 16, life: 1, decay: 0.9 + Math.random() * 0.8, color });
    }
  }

  function setView() {
    const s = Math.max(W / VB_W, H / VB_H);
    const ox = (W - VB_W * s) / 2, oy = H - VB_H * s;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    return s;
  }

  function screenView(k) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.scale(k, k);
    return k;
  }

  function drawCarAt(p, car, s) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(PPM, -PPM);
    paintCar(ctx, car, 1.6 / (PPM * s), p.spin || 0);
    ctx.restore();
  }

  function drawTrail(s) {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const k = i / trail.length;
      ctx.strokeStyle = `rgba(255,244,214,${0.5 * k * k})`;
      ctx.lineWidth = (4 + 18 * k) / Math.max(0.6, s * 1.6);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpeedLines(p, n, len) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineCap = 'round'; ctx.lineWidth = 5;
    const dir = Math.atan2(p.vy || 0.35, p.vx || 1);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 26;
      const nx = -Math.sin(dir) * off, ny = Math.cos(dir) * off;
      const back = 95 + (i % 2) * 22;
      ctx.beginPath();
      ctx.moveTo(nx - Math.cos(dir) * back, ny - Math.sin(dir) * back);
      ctx.lineTo(nx - Math.cos(dir) * (back + len), ny - Math.sin(dir) * (back + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDust(dt) {
    dust = dust.filter((d) => {
      d.life -= d.decay * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 140 * dt; d.vx *= 1 - 1.5 * dt; d.r += 30 * dt;
      if (d.life <= 0) return false;
      ctx.globalAlpha = d.life * 0.55;
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawStatic() {
    const car = getCar();
    clear();
    if (!car) return;
    let p, s;
    if (portrait()) {
      p = posePortrait(P_FLY * 0.5); p.a = -0.12; p.vx = 1; p.vy = -0.05;
      s = screenView(W * 0.3 / (5 * PPM));
    } else {
      s = setView();
      p = { x: 1240, y: 640 - wheelDrop(car) * 0.2, a: 0.17, alpha: 1, vx: 1, vy: 0.2 };
    }
    drawSpeedLines(p, 3, 80);
    drawCarAt(p, car, s);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    const car = getCar();
    if (!car) return;
    const port = portrait();
    const period = port ? P_PERIOD : PERIOD;
    const loopT = ((now - t0) / 1000) % period;
    const loopN = Math.floor((now - t0) / 1000 / period);
    const p = port ? posePortrait(loopT) : pose(loopT, car);
    clear();
    // portrait works in screen pixels with the car ~30% of the width; landscape in SVG units
    const s = port ? screenView(W * 0.3 / (5 * PPM)) : setView();
    frameCount++;
    if (p) {
      p.spin = loopT * 14;
      const prev = trail[trail.length - 1];
      if (prev) { p.vx = p.x - prev.x; p.vy = p.y - prev.y; }
      if (p.phase === 'fly') trail.push({ x: p.x - Math.cos(p.a) * 60, y: p.y - Math.sin(p.a) * 60 + 18 });
      else if (trail.length) trail.shift();
      if (trail.length > 16) trail.shift();
      if (p.phase === 'roll' && p.speed > 0.25 && frameCount % 3 === 0) puff(p.x - Math.cos(p.a) * 70, p.y + 30, 1, 10, 'rgba(255,200,170,1)');
      if (p.phase === 'land' && landedLoop !== loopN) {
        landedLoop = loopN;
        puff(p.x - 40, p.y + 34, 14, 120, 'rgba(255,214,180,1)');
      }
      if (p.phase === 'out' && frameCount % 4 === 0) puff(p.x - 70, p.y + 30, 1, 10, 'rgba(255,210,180,1)');
      drawTrail(s);
      drawDust(dt);
      if (p.phase === 'fly' && p.vx) drawSpeedLines(p, 3, 60);
      drawCarAt(p, car, s);
    } else {
      trail = [];
      drawDust(dt);
    }
  }

  return {
    setMode(m) {
      if (m === mode) { if (m === 'static') drawStatic(); return; }
      mode = m;
      cancelAnimationFrame(raf); raf = 0;
      trail = []; dust = []; lastT = 0;
      if (m === 'anim') { resize(); t0 = performance.now(); raf = requestAnimationFrame(frame); }
      else if (m === 'static') { resize(); drawStatic(); }
      else clear();
    },
    get mode() { return mode; },
    redraw() { if (mode === 'static') drawStatic(); },
  };
}
