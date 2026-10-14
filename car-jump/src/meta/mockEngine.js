// Mock engine: implements the src/game/engine.js contract (see SPEC.md, v1 + v2) with a scripted ~9 s run so
// every meta screen can be exercised without physics. Loaded only with ?mock=1, or as a fallback
// when the real engine fails to import. Cash math follows the SPEC formula exactly.

import { OBSTACLE_KINDS } from '../data/tracks.js';
import { mulberry32 } from './rng.js';

// Scripted timeline (seconds). v2: first flight with air targets (ring, coin arc, balloon), a smash
// chain of 4 that includes a 2-blast explosion chain, a kicker rejump with a second flip + landing,
// orbit when the flight peaks above 45 m (moon), and 'record' when the car passes bestDistance.
const RAMP_T = 1.2;           // rolling down the ramp
const AIR_T = 3.2;            // first flight (≥ 3 s → the HUD's BIG AIR banner)
const LAND_T = RAMP_T + AIR_T;
const KICK_T = LAND_T + 1.4;  // kicker relaunch
const AIR2_T = 1.2;           // second flight
const LAND2_T = KICK_T + AIR2_T;
const RUN_T = LAND2_T + 1.4;  // total scripted run length (~9.2 s)
const COMBO_WINDOW = 1.5;
const EXPLOSIVE = { fuel: 150, tnt: 200 };   // fallback cash until OBSTACLE_KINDS has them
const AIR_CASH = { ring: 150, coin: 20, balloon: 200, blimp: 500 };

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
  const kindCash = (kind) => (OBSTACLE_KINDS[kind] ? OBSTACLE_KINDS[kind].cash : EXPLOSIVE[kind] || 20);

  function start({ car, stats, track, seed = 1, bestDistance = null, shake = 1 }) {
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    const g = Math.max(0.2, track.gravity || 1);
    const target = (250 + 110 * stats.power * stats.launchBoost + rnd() * 40) / Math.pow(g, 0.3);
    const flips = 1 + Math.floor(rnd() * 2) + (g < 0.5 ? 1 : 0);
    const quality = rnd() < 0.5 * Math.min(1.6, stats.suspension) ? 'perfect' : rnd() < 0.7 ? 'good' : 'rough';
    const kinds = track.obstacles.kinds;
    const pick = () => kinds[Math.floor(rnd() * kinds.length)];
    // ground events after the first landing: a chain of 4 (2 props, then fuel → tnt chain reaction),
    // then a lone prop after the second landing (outside the combo window).
    const timeline = [
      { t: LAND_T + 0.25, ev: 'smash', kind: pick() },
      { t: LAND_T + 0.55, ev: 'smash', kind: pick() },
      { t: LAND_T + 0.75, ev: 'smash', kind: 'fuel', explode: 0 },
      { t: LAND_T + 0.87, ev: 'smash', kind: 'tnt', explode: 1 },
      { t: LAND_T + 0.95, ev: 'damage', part: 'bumper' },
      { t: LAND2_T + 0.5, ev: 'smash', kind: pick() },
    ];
    // test hook (ui-smoke): window.__mockScript = { rampage: true } extends the chain to 13 hits (×4)
    const script = (typeof window !== 'undefined' && window.__mockScript) || {};
    if (script.rampage) {
      for (let i = 0; i < 9; i++) timeline.push({ t: LAND_T + 1.0 + i * 0.1, ev: 'smash', kind: i === 4 ? 'tnt' : pick(), explode: i === 4 ? 0 : undefined });
      timeline.sort((a, b) => a.t - b.t);
    }
    // air targets on the first flight (a = fraction of the flight), one ring over the kicker
    const air = [
      { a: 0.22, kind: 'ring' },
      ...[0.4, 0.43, 0.46, 0.49, 0.52].map((a) => ({ a, kind: 'coin' })),
      { a: 0.7, kind: track.id === 'city' || track.id === 'moon' ? 'blimp' : 'balloon' },
    ];
    run = {
      car, stats, track, target, flipsPlanned: flips, quality, timeline, air, air2: [{ a: 0.5, kind: 'ring' }],
      bestDistance: bestDistance > 0 ? bestDistance : null, shakeAmt: reducedMotion ? 0 : Math.max(0, Math.min(1, shake == null ? 1 : shake)),
      peakAlt: (28 + rnd() * 6) / Math.pow(g, 0.6), peakAlt2: 9,
      t: 0, phase: 'ramp', distance: 0, speedKmh: 0, maxSpeed: 0, nextSpeedEvt: 10,
      nitro: 1, airTime: 0, flightT: 0, altitude: 0, maxAltitude: 0, orbited: false,
      flips: 0, flightFlips: 0, front: 0, back: 0, stuntCash: 0,
      smashed: 0, smashCash: 0, comboCash: 0, airCash: 0, landingCash: 0,
      combo: { count: 0, mult: 1, last: -9, extra: 0 }, bestCombo: 0, explosions: 0,
      rings: 0, coins: 0, airTargets: 0, rejumps: 0,
      landing: null, finishCrossed: false, launched: false, landed: false, kicked: false, landed2: false, recorded: false, ended: false,
      popups: [], shake: 0, rot: 0, bonus: 0,
    };
    paused = false;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // SPEC cash formula (each part × coinMult and rounded):
  //   stunts = flip k of a flight pays 150 + min(250, 50·(k−1)), + 10/s air time
  //   smash = per-prop cash; combo = extra from the chain multiplier; landing = 300/100 for the jump's
  //   landing, half for kicker landings; air = rings $150, coins $20, balloon $200, blimp $500, + $5 × peak
  //   altitude on an orbit flight.
  function cashParts(r) {
    const m = r.stats.coinMult;
    const parts = {
      distance: Math.round(2 * Math.floor(r.distance) * m),
      stunts: Math.round((r.stuntCash + r.airTime * 10) * m),
      smash: r.smashCash,
      landing: r.landingCash,
      combo: r.comboCash,
      air: r.airCash,
    };
    parts.total = parts.distance + parts.stunts + parts.smash + parts.landing + parts.combo + parts.air;
    return parts;
  }
  function rating(total, finish) {
    const x = total / (finish * 4);
    return x >= 1.5 ? 'S' : x >= 1.0 ? 'A' : x >= 0.6 ? 'B' : x >= 0.3 ? 'C' : 'D';
  }

  function endCombo(r) {
    const c = r.combo;
    if (c.count >= 3) emit({ type: 'comboEnd', count: c.count, mult: c.mult, cash: c.extra });
    r.combo = { count: 0, mult: 1, last: -9, extra: 0 };
  }

  function finish() {
    const r = run;
    if (!r || r.ended) return;
    endCombo(r);
    r.ended = true; r.phase = 'done';
    const cash = cashParts(r);
    const summary = {
      distance: Math.floor(r.distance), airTime: Math.round(r.airTime * 100) / 100, flips: r.flips,
      frontFlips: r.front, backFlips: r.back, smashed: r.smashed, maxSpeedKmh: Math.round(r.maxSpeed),
      landing: r.landing, finishCrossed: r.finishCrossed, cash, durationSec: Math.round(r.t * 10) / 10,
      rating: rating(cash.total, r.track.finish), maxAltitude: Math.round(r.maxAltitude * 10) / 10, bestCombo: r.bestCombo,
      explosions: r.explosions, rings: r.rings, coins: r.coins, airTargets: r.airTargets, rejumps: r.rejumps,
    };
    emit({ type: 'finish', summary });
  }

  function popup(text, color = '#fff') { if (run) run.popups.push({ text, color, life: 1.2 }); }
  function kick(r, amt) { r.shake = Math.max(r.shake, amt * r.shakeAmt); }

  function smash(r, e) {
    const m = r.stats.coinMult;
    const base = Math.round(kindCash(e.kind) * m);
    const c = r.combo;
    if (r.t - c.last <= COMBO_WINDOW) c.count += 1; else { endCombo(r); r.combo.count = 1; }
    const cc = r.combo;
    cc.last = r.t;
    cc.mult = Math.min(4, 1 + 0.25 * (cc.count - 1));
    const extra = Math.round(base * (cc.mult - 1));
    cc.extra += extra;
    r.bestCombo = Math.max(r.bestCombo, cc.count);
    r.smashed++; r.smashCash += base; r.comboCash += extra;
    emit({ type: 'smash', kind: e.kind, cash: base + extra, x: r.distance, y: 0 });
    if (cc.count >= 2) emit({ type: 'combo', count: cc.count, mult: cc.mult });
    popup('+$' + (base + extra), '#ffd23f');
    if (e.explode != null) {
      r.explosions++;
      emit({ type: 'explosion', x: r.distance, y: 0, cash: base, chain: e.explode });
      popup('BOOM!', '#ff5a3d');
      kick(r, 0.5);
    } else kick(r, 0.15);
  }

  function hitAir(r, kind) {
    const cash = Math.round(AIR_CASH[kind] * r.stats.coinMult);
    const nitroRefill = kind === 'ring' ? 0.25 : 0;
    r.airCash += cash; r.airTargets++;
    if (kind === 'ring') r.rings++;
    if (kind === 'coin') r.coins++;
    r.nitro = Math.min(1, r.nitro + nitroRefill);
    emit({ type: 'airTarget', kind, cash, nitroRefill });
    popup(kind === 'ring' ? 'RING +$' + cash : '+$' + cash, '#ffd23f');
  }

  function flipsDue(r, a, planned) {
    const dir = input.brake ? -1 : 1;
    const due = Math.min(planned, Math.floor(a * planned * 1.2));
    while (r.flightFlips < due) {
      r.flightFlips++; r.flips++;
      r.stuntCash += 150 + Math.min(250, 50 * (r.flightFlips - 1));
      if (dir > 0) r.front++; else r.back++;
      const d = dir > 0 ? 'front' : 'back';
      emit({ type: 'flip', dir: d, count: r.flips });
      popup(d === 'front' ? 'FRONT FLIP!' : 'BACKFLIP!', '#52d6ff');
    }
    return dir;
  }

  function land(r, quality, second) {
    const m = r.stats.coinMult;
    const pay = quality === 'perfect' ? 300 : quality === 'good' ? 100 : 0;
    r.landingCash += Math.round((second ? pay / 2 : pay) * m);
    if (!second) r.landing = quality;
    emit({ type: 'land', quality, impact: quality === 'perfect' ? 4 : 9 });
    popup(quality === 'perfect' ? 'PERFECT LANDING!' : quality === 'good' ? 'GOOD LANDING' : 'ROUGH LANDING', '#c8ff5e');
    kick(r, 0.35);
    r.flightFlips = 0;
  }

  function step(dt) {
    const r = run;
    if (!r || r.ended) return;
    r.t += dt;
    const nitroOn = input.nitro && r.nitro > 0 && r.phase !== 'done';
    if (nitroOn) { r.nitro = Math.max(0, r.nitro - dt / (1.2 * r.stats.nitroCapacity)); r.bonus += dt * 12 * r.stats.nitroPower; }
    if (input.gas && r.phase === 'ground') r.bonus += dt * 6;
    const d1 = 0.45 * r.target, d2 = 0.62 * r.target, d3 = 0.78 * r.target;
    const launchKmh = 95 + 25 * r.stats.power * r.stats.launchBoost;
    if (r.t < RAMP_T) {
      r.phase = 'ramp';
      r.speedKmh = launchKmh * (r.t / RAMP_T);
      r.rot = -0.5;
      r.altitude = 0;
    } else if (r.t < LAND_T) {
      if (!r.launched) { r.launched = true; r.flightFlips = 0; emit({ type: 'launch', speedKmh: Math.round(launchKmh) }); popup('LAUNCH!', '#ffd23f'); }
      r.phase = 'air';
      const a = (r.t - RAMP_T) / AIR_T;
      r.flightT = r.t - RAMP_T;
      r.airTime = r.flightT;
      r.distance = d1 * a + r.bonus;
      r.altitude = 4 * r.peakAlt * a * (1 - a);
      r.speedKmh = launchKmh * (1 + 0.15 * Math.sin(a * Math.PI));
      const dir = flipsDue(r, a, r.flipsPlanned);
      r.rot = -0.2 + dir * Math.min(1, a * 1.2) * r.flipsPlanned * Math.PI * 2;
      while (r.air.length && r.air[0].a <= a) hitAir(r, r.air.shift().kind);
      if (!r.orbited && r.altitude > 45) { r.orbited = true; emit({ type: 'orbit', altitude: Math.round(r.altitude) }); popup('ORBIT!', '#c9a8ff'); }
    } else if (r.t < KICK_T || (r.t >= LAND2_T)) {
      if (!r.landed) {
        r.landed = true; r.airTime = AIR_T;
        if (r.orbited) r.airCash += Math.round(5 * r.peakAlt * r.stats.coinMult);
        land(r, r.quality, false);
      }
      if (r.t >= LAND2_T && !r.landed2) {
        r.landed2 = true; r.airTime = AIR_T + AIR2_T;
        land(r, r.quality === 'rough' ? 'good' : 'perfect', true);
      }
      r.phase = 'ground';
      r.rot = 0; r.altitude = 0;
      if (r.t < KICK_T) {
        const a = (r.t - LAND_T) / (KICK_T - LAND_T);
        r.distance = d1 + (d2 - d1) * a + r.bonus;
        r.speedKmh = launchKmh * (0.8 - 0.1 * a);
      } else {
        const a = Math.min(1, (r.t - LAND2_T) / (RUN_T - LAND2_T));
        const ease = 1 - (1 - a) * (1 - a);
        r.distance = d3 + (r.target - d3) * ease + r.bonus;
        r.speedKmh = launchKmh * 0.6 * (1 - a) + 2;
      }
    } else {
      // kicker flight
      if (!r.kicked) {
        r.kicked = true; r.rejumps++; r.flightFlips = 0;
        emit({ type: 'rejump', count: r.rejumps, speedKmh: Math.round(launchKmh * 0.7) });
        popup('REJUMP!', '#2fd36b');
      }
      r.phase = 'air';
      const a = (r.t - KICK_T) / AIR2_T;
      r.flightT = r.t - KICK_T;
      r.airTime = AIR_T + r.flightT;
      r.distance = d2 + (d3 - d2) * a + r.bonus;
      r.altitude = 4 * r.peakAlt2 * a * (1 - a);
      r.speedKmh = launchKmh * 0.7;
      const dir = flipsDue(r, a, 1);
      r.rot = dir * Math.min(1, a * 1.2) * Math.PI * 2;
      while (r.air2.length && r.air2[0].a <= a) hitAir(r, r.air2.shift().kind);
    }
    r.maxAltitude = Math.max(r.maxAltitude, r.altitude);
    while (r.timeline.length && r.timeline[0].t <= r.t) {
      const e = r.timeline.shift();
      if (e.ev === 'smash') smash(r, e);
      else if (e.ev === 'damage') emit({ type: 'damage', part: e.part });
    }
    if (r.combo.count > 0 && r.t - r.combo.last > COMBO_WINDOW) endCombo(r);
    if (r.speedKmh > r.maxSpeed) r.maxSpeed = r.speedKmh;
    while (r.maxSpeed >= r.nextSpeedEvt) { emit({ type: 'speed', kmh: r.nextSpeedEvt }); r.nextSpeedEvt += 10; }
    if (r.bestDistance && !r.recorded && r.distance > r.bestDistance) { r.recorded = true; emit({ type: 'record' }); popup('NEW RECORD!', '#ff3b5c'); }
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
    else if (r.phase === 'air') { cx = r.distance; cy = terrainY(cx) + 0.8 + r.altitude; }
    else { cx = r.distance; cy = terrainY(cx) + 0.8; }
    const camX = cx + 8, camY = Math.max(cy * 0.75 - 4, 4);
    if (r.altitude > 30) { ctx.fillStyle = `rgba(4,4,20,${Math.min(0.7, (r.altitude - 30) / 30)})`; ctx.fillRect(0, 0, W, H); }
    const sx = (x) => W / 2 + (x - camX) * ppm;
    const sy = (y) => H * 0.62 - (y - camY) * ppm;
    ctx.save();
    if (r.shake > 0 && r.shakeAmt > 0) ctx.translate((Math.random() - 0.5) * 10 * r.shake, (Math.random() - 0.5) * 10 * r.shake);
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
      if (!r) return { phase: 'done', distance: 0, speedKmh: 0, nitro: 1, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false, landing: null,
        altitude: 0, combo: { count: 0, mult: 1, timer01: 0 }, rejumps: 0 };
      const c = r.combo;
      const timer01 = c.count > 0 && !r.ended ? Math.max(0, 1 - (r.t - c.last) / COMBO_WINDOW) : 0;
      return {
        phase: r.phase, distance: Math.max(0, r.distance), speedKmh: r.speedKmh, nitro: r.nitro, airTime: r.flightT,
        flips: r.flips, smashed: r.smashed, cash: cashParts(r).total, finishCrossed: r.finishCrossed, landing: r.landing,
        altitude: r.phase === 'air' ? r.altitude : 0, combo: { count: c.count, mult: c.mult, timer01 }, rejumps: r.rejumps,
      };
    },
  };
}
