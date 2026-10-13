// Mock engine: implements the src/game/engine.js contract (see SPEC.md) with a scripted ~6 s run so
// every meta screen can be exercised without physics. Loaded only with ?mock=1, or as a fallback
// when the real engine fails to import. Cash math follows the SPEC formula exactly.

import { OBSTACLE_KINDS } from '../data/tracks.js';
import { mulberry32 } from './rng.js';

const RAMP_T = 1.2;   // seconds rolling down the ramp
const AIR_T = 2.0;    // seconds airborne
const RUN_T = 6.0;    // total scripted run length

export function createGame(canvas, opts = {}) {
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const reducedMotion = !!opts.reducedMotion;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  let raf = 0, last = 0, paused = false, run = null;
  const input = { gas: false, brake: false, nitro: false };

  function resize() {
    const p = canvas.parentElement || canvas;
    const r = p.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas.parentElement || canvas);
  resize();

  function emit(evt) {
    try { onEvent(evt); } catch (e) { console.error('[mockEngine] onEvent threw', e); }
  }

  function start({ car, stats, track, seed = 1 }) {
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    const g = Math.max(0.2, track.gravity || 1);
    const target = (250 + 110 * stats.power * stats.launchBoost + rnd() * 40) / Math.pow(g, 0.3);
    const flips = 1 + Math.floor(rnd() * 2) + (g < 0.5 ? 1 : 0);
    const quality = rnd() < 0.5 * Math.min(1.6, stats.suspension) ? 'perfect' : rnd() < 0.7 ? 'good' : 'rough';
    const kinds = track.obstacles.kinds;
    const smashes = [];
    const nSmash = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < nSmash; i++) smashes.push({ t: RAMP_T + AIR_T + 0.3 + (i * (RUN_T - RAMP_T - AIR_T - 0.6)) / nSmash, kind: kinds[Math.floor(rnd() * kinds.length)] });
    run = {
      car, stats, track, target, flipsPlanned: flips, quality, smashes,
      t: 0, phase: 'ramp', distance: 0, speedKmh: 0, maxSpeed: 0, nextSpeedEvt: 10,
      nitro: 1, airTime: 0, flips: 0, front: 0, back: 0, smashed: 0, smashCash: 0,
      landing: null, finishCrossed: false, launched: false, landed: false, ended: false,
      popups: [], shake: 0, rot: 0, bonus: 0,
    };
    paused = false;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function stuntCash(r) {
    // Flip k of a flight pays 150 + 50·(k-1) (same reading as the real engine); one flight in the mock; 10/s air.
    const f = r.flips;
    return f * 150 + 25 * f * Math.max(0, f - 1) + r.airTime * 10;
  }
  function cashParts(r) {
    const m = r.stats.coinMult;
    const landing = r.landing === 'perfect' ? 300 : r.landing === 'good' ? 100 : 0;
    const parts = {
      distance: Math.round(2 * Math.floor(r.distance) * m),
      stunts: Math.round(stuntCash(r) * m),
      smash: r.smashCash,                       // already × coinMult per smash event
      landing: Math.round(landing * m),
    };
    parts.total = parts.distance + parts.stunts + parts.smash + parts.landing;
    return parts;
  }

  function finish() {
    const r = run;
    if (!r || r.ended) return;
    r.ended = true; r.phase = 'done';
    const summary = {
      distance: Math.floor(r.distance), airTime: Math.round(r.airTime * 100) / 100, flips: r.flips,
      frontFlips: r.front, backFlips: r.back, smashed: r.smashed, maxSpeedKmh: Math.round(r.maxSpeed),
      landing: r.landing, finishCrossed: r.finishCrossed, cash: cashParts(r), durationSec: Math.round(r.t * 10) / 10,
    };
    emit({ type: 'finish', summary });
  }

  function popup(text, color = '#fff') { if (run) run.popups.push({ text, color, life: 1.2 }); }

  function step(dt) {
    const r = run;
    if (!r || r.ended) return;
    r.t += dt;
    const nitroOn = input.nitro && r.nitro > 0 && r.phase !== 'done';
    if (nitroOn) { r.nitro = Math.max(0, r.nitro - dt / (1.2 * r.stats.nitroCapacity)); r.bonus += dt * 12 * r.stats.nitroPower; }
    if (input.gas && r.phase === 'ground') r.bonus += dt * 6;
    const lip = 0.55 * r.target;
    const launchKmh = 95 + 25 * r.stats.power * r.stats.launchBoost;
    if (r.t < RAMP_T) {
      r.phase = 'ramp';
      r.speedKmh = launchKmh * (r.t / RAMP_T);
      r.rot = -0.5;
    } else if (r.t < RAMP_T + AIR_T) {
      if (!r.launched) { r.launched = true; emit({ type: 'launch', speedKmh: Math.round(launchKmh) }); popup('LAUNCH!', '#ffd23f'); }
      r.phase = 'air';
      const a = (r.t - RAMP_T) / AIR_T;
      r.airTime = r.t - RAMP_T;
      r.distance = lip * a + r.bonus;
      r.speedKmh = launchKmh * (1 + 0.15 * Math.sin(a * Math.PI));
      const dir = input.brake ? -1 : 1;
      r.rot = -0.2 + dir * Math.min(1, a * 1.2) * r.flipsPlanned * Math.PI * 2;
      const due = Math.min(r.flipsPlanned, Math.floor(a * r.flipsPlanned * 1.2));
      while (r.flips < due) {
        r.flips++;
        if (dir > 0) r.front++; else r.back++;
        const d = dir > 0 ? 'front' : 'back';
        emit({ type: 'flip', dir: d, count: r.flips });
        popup(d === 'front' ? 'FRONT FLIP!' : 'BACKFLIP!', '#52d6ff');
      }
    } else {
      if (!r.landed) {
        r.landed = true; r.landing = r.quality; r.airTime = AIR_T;
        emit({ type: 'land', quality: r.quality, impact: r.quality === 'perfect' ? 4 : 9 });
        popup(r.quality === 'perfect' ? 'PERFECT LANDING!' : r.quality === 'good' ? 'GOOD LANDING' : 'ROUGH LANDING', '#c8ff5e');
        if (!reducedMotion) r.shake = 0.35;
      }
      r.phase = 'ground';
      r.rot = 0;
      const a = Math.min(1, (r.t - RAMP_T - AIR_T) / (RUN_T - RAMP_T - AIR_T));
      const ease = 1 - (1 - a) * (1 - a);
      r.distance = lip + (r.target - lip) * ease + r.bonus;
      r.speedKmh = launchKmh * 0.8 * (1 - a) + 2;
      while (r.smashes.length && r.smashes[0].t <= r.t) {
        const s = r.smashes.shift();
        const cash = Math.round((OBSTACLE_KINDS[s.kind] ? OBSTACLE_KINDS[s.kind].cash : 20) * r.stats.coinMult);
        r.smashed++; r.smashCash += cash;
        emit({ type: 'smash', kind: s.kind, cash, x: r.distance, y: 0 });
        popup('+$' + cash, '#ffd23f');
        if (!reducedMotion) r.shake = Math.max(r.shake, 0.15);
      }
    }
    if (r.speedKmh > r.maxSpeed) r.maxSpeed = r.speedKmh;
    while (r.maxSpeed >= r.nextSpeedEvt) { emit({ type: 'speed', kmh: r.nextSpeedEvt }); r.nextSpeedEvt += 10; }
    if (!r.finishCrossed && r.distance >= r.track.finish) { r.finishCrossed = true; emit({ type: 'finishLine' }); popup('FINISH LINE!', '#ffffff'); }
    for (const p of r.popups) p.life -= dt;
    r.popups = r.popups.filter((p) => p.life > 0);
    r.shake = Math.max(0, r.shake - dt);
    if (r.t >= RUN_T) finish();
  }

  // ---- crude but readable rendering ----
  function terrainY(x) { return Math.sin(x / 9) * 0.6 + Math.sin(x / 23) * 1.2; }
  function draw() {
    const r = run;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = r ? r.track.theme : { sky: ['#6fb3f2', '#d6ecff'], ground: '#8a8f99', groundDark: '#5b5f66', far: '#5c6f8a', accent: '#ffd23f' };
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (!r) return;
    const ppm = Math.max(6, Math.min(W, H) / 30);
    // car world position (m): ramp is x<0, ground at y=0
    let cx, cy;
    const rampLen = 60, rampH = 25;
    if (r.phase === 'ramp') { const a = r.t / RAMP_T; cx = -rampLen * (1 - a); cy = rampH * (1 - a) * (1 - a) + 2; }
    else if (r.phase === 'air') { const a = (r.t - RAMP_T) / AIR_T; cx = r.distance; cy = 2 + 30 * a * (1 - a) * 2 + (1 - a) * 2; }
    else { cx = r.distance; cy = terrainY(cx) + 0.8; }
    const camX = cx + 8, camY = Math.max(cy * 0.6, 4);
    const sx = (x) => W / 2 + (x - camX) * ppm;
    const sy = (y) => H * 0.62 - (y - camY) * ppm;
    ctx.save();
    if (r.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * r.shake, (Math.random() - 0.5) * 10 * r.shake);
    // far hills
    ctx.fillStyle = th.far;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let i = 0; i <= 20; i++) { const px = (i / 20) * W; ctx.lineTo(px, H * 0.55 - Math.sin(i * 1.3 + camX * 0.01) * 30 - 20); }
    ctx.lineTo(W, H); ctx.fill();
    // ramp
    ctx.fillStyle = th.groundDark;
    ctx.beginPath(); ctx.moveTo(sx(-rampLen - 20), sy(-10));
    for (let x = -rampLen - 20; x <= 0; x += 2) { const a = Math.max(0, (x + rampLen) / rampLen); ctx.lineTo(sx(x), sy(x < -rampLen ? rampH + 2 : rampH * (1 - a) * (1 - a) + 1.2)); }
    ctx.lineTo(sx(0), sy(-10)); ctx.fill();
    // ground
    ctx.fillStyle = th.ground;
    ctx.beginPath(); ctx.moveTo(sx(8), H + 10);
    const x0 = Math.max(8, camX - W / ppm), x1 = camX + W / ppm;
    for (let x = x0; x <= x1; x += 1) ctx.lineTo(sx(x), sy(terrainY(x)));
    ctx.lineTo(sx(x1), H + 10); ctx.fill();
    // finish line
    const fx = sx(r.track.finish);
    if (fx > -20 && fx < W + 20) { ctx.fillStyle = '#fff'; ctx.fillRect(fx - 3, sy(terrainY(r.track.finish)) - 6 * ppm, 6, 6 * ppm); }
    // car
    ctx.save();
    ctx.translate(sx(cx), sy(cy));
    ctx.rotate(-r.rot);
    ctx.scale(ppm, -ppm);
    ctx.fillStyle = r.car.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.08;
    ctx.beginPath(); r.car.body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16161c';
    for (const w of r.car.wheels) { ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill(); }
    if (input.nitro && r.nitro > 0) { ctx.fillStyle = '#52d6ff'; ctx.beginPath(); ctx.moveTo(-2, 0.1); ctx.lineTo(-3.4, 0.25); ctx.lineTo(-2, 0.4); ctx.fill(); }
    ctx.restore();
    ctx.restore();
    // popups
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(Math.min(W, H) / 14)}px Bungee, Impact, sans-serif`;
    r.popups.forEach((p, i) => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = '#000'; ctx.fillText(p.text, W / 2 + 3, H * 0.34 - i * 40 - (1.2 - p.life) * 30 + 3);
      ctx.fillStyle = p.color; ctx.fillText(p.text, W / 2, H * 0.34 - i * 40 - (1.2 - p.life) * 30);
    });
    ctx.globalAlpha = 1;
    ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillText('MOCK ENGINE', 12, H - 8);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) step(dt);
    draw();
  }

  return {
    start,
    setInput(i) { if (i) { input.gas = !!i.gas; input.brake = !!i.brake; input.nitro = !!i.nitro; } },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    stop() { if (run && !run.ended) finish(); },
    destroy() { cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); run = null; },
    getState() {
      const r = run;
      if (!r) return { phase: 'done', distance: 0, speedKmh: 0, nitro: 1, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false, landing: null };
      return {
        phase: r.phase, distance: Math.max(0, r.distance), speedKmh: r.speedKmh, nitro: r.nitro, airTime: r.airTime,
        flips: r.flips, smashed: r.smashed, cash: cashParts(r).total, finishCrossed: r.finishCrossed, landing: r.landing,
      };
    },
  };
}
