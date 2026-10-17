// Mock engine: implements the src/game/engine.js contract (SPEC §3) with a scripted ~7 s ride, so every screen can be
// exercised without physics (tools/ui-smoke.mjs runs on it with ?mock=1). Loaded with ?mock=1, or as a fallback when
// the real engine fails to load. Cash follows SPEC §6: distance $2/m, air $30/s, smashes, coins $10, finish $300,
// gates $120 (+$80 quick, $40 fixed), all × stats.coinMult, each part a whole number so the parts add up to the total.
// The Ranger stays parked at the trail head until GAS is first pressed ('launch'); after that the ride plays on its
// own timeline (GAS / BRAKE / BOOST still move the gauges). Gates (cfg.gates > 0) park it and wait for openGate().
// Test hooks: window.__mockScript = { stuck: true } (the Ranger gets stuck once, mid-ride, until winch(true)),
// { short: true } (the ride ends at 60 % without crossing the finish).
import { drawRanger } from '../ui/vehiclePreview.js';

const RIDE_T = 7;            // seconds of riding from launch to the finish flag
const FINISH_DELAY = 0.8;    // finishLine → finish
const COIN_T = [0.6, 1.1, 1.6, 2.2, 3.6, 4.4, 5.6, 6.3];
const STUCK_T = 4.8;

export function createGame(canvas, opts = {}) {
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 1, H = 1, raf = 0, last = 0, paused = false, run = null;
  const input = { gas: false, brake: false, boost: false };

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
  const emit = (evt) => { try { onEvent(evt); } catch (e) { console.error('[mockEngine] onEvent threw', e); } };

  function start(cfg = {}) {
    const trail = cfg.trail || { id: 'trail', length: 600, style: 'forest', theme: {} };
    const stats = cfg.stats || {};
    const script = (typeof window !== 'undefined' && window.__mockScript) || {};
    const gates = Math.max(0, Math.floor(cfg.gates || 0));
    run = {
      cfg, trail, stats, mult: stats.coinMult || 1, length: trail.length || 600, short: !!script.short,
      stuckPlanned: !!script.stuck, stuckDone: false,
      gateAt: Array.from({ length: gates }, (_, i) => ((i + 1) / (gates + 1)) * RIDE_T), gateIndex: 0,
      gates: { answered: 0, correct: 0, quick: 0, fixed: 0 }, gateCash: 0, quickCash: 0,
      phase: 'parked', t: 0, launched: false, distance: 0, speedKmh: 0, maxSpeed: 0, boost: 0.5, boosting: false,
      airTime: 0, flightT: 0, inAir: false, flips: 0, smashed: 0, smashCash: 0, coins: 0, coinCash: 0, airCash: 0,
      winches: 0, finishCrossed: false, finishAt: null, ended: false, upsideDown: false, popups: [], startedAt: 0,
      nextCoin: 0, flipped: false, landed: false, smashedOnce: false, splashed: false,
    };
    paused = false;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function cashNow(r) {
    const m = r.mult;
    const distance = Math.round(Math.floor(r.distance) * 2 * m);
    const air = Math.round(r.airCash * m);
    const smash = Math.round(r.smashCash * m);
    const coins = Math.round(r.coinCash * m);
    const gates = Math.round(r.gateCash * m);
    const quick = Math.round(r.quickCash * m);
    const finish = r.finishCrossed ? Math.round(300 * m) : 0;
    return { distance, air, smash, coins, gates, quick, finish, total: distance + air + smash + coins + gates + quick + finish };
  }

  function step(dt) {
    const r = run;
    if (!r || r.ended) return;
    if (r.phase === 'parked') {
      if (input.gas) { r.phase = 'ride'; r.launched = true; r.startedAt = performance.now(); emit({ type: 'launch' }); }
      return;
    }
    if (r.phase === 'done') {
      if (r.finishAt != null && r.t >= r.finishAt) end();
      r.t += dt;
      return;
    }
    if (r.phase === 'gate' || r.phase === 'stuck') { r.speedKmh = 0; return; }
    // boost burns while held
    const wantBoost = input.boost && r.boost > 0.01;
    if (wantBoost !== r.boosting) { r.boosting = wantBoost; emit({ type: 'boost', on: wantBoost }); }
    if (r.boosting) r.boost = Math.max(0, r.boost - dt * 0.4);
    r.t += dt * (r.boosting ? 1.25 : 1);
    const k = Math.min(1, r.t / RIDE_T);
    const endK = r.short ? 0.6 : 1;
    r.distance = r.length * Math.min(k, endK);
    r.speedKmh = 28 + 18 * Math.sin(r.t * 1.7) * 0.5 + (r.boosting ? 22 : 0) + (r.stats.power || 1) * 6;
    r.maxSpeed = Math.max(r.maxSpeed, r.speedKmh);
    // gates
    if (r.gateIndex < r.gateAt.length && r.t >= r.gateAt[r.gateIndex]) {
      r.phase = 'gate';
      emit({ type: 'gate', index: r.gateIndex, x: r.distance + 3 });
      return;
    }
    // coins
    while (r.nextCoin < COIN_T.length && r.t >= COIN_T[r.nextCoin]) {
      r.nextCoin++; r.coins++; r.coinCash += 10; r.boost = Math.min(1, r.boost + 0.08);
      emit({ type: 'coin', cash: Math.round(10 * r.mult) });
      r.popups.push({ text: '+$' + Math.round(10 * r.mult), t: 0.8 });
    }
    // one jump: airborne 2.0 → 3.2 s, a back flip, a perfect landing (+ boost)
    if (!r.inAir && !r.landed && r.t >= 2.0) { r.inAir = true; r.flightT = 0; }
    if (r.inAir) {
      r.flightT += dt;
      if (!r.flipped && r.t >= 2.6) { r.flipped = true; r.flips++; emit({ type: 'flip', direction: 'back' }); }
      if (r.t >= 3.2) {
        r.inAir = false; r.landed = true; r.airTime += r.flightT; r.airCash += 30 * r.flightT;
        emit({ type: 'air', airTime: Math.round(r.flightT * 100) / 100 });
        emit({ type: 'land', quality: 'perfect' });
        r.boost = Math.min(1, r.boost + 0.25);
        r.popups.push({ text: 'PERFECT!', t: 1 });
      }
    }
    if (!r.smashedOnce && r.t >= 4.0) { r.smashedOnce = true; r.smashed++; r.smashCash += 40; emit({ type: 'smash', kind: 'log', cash: Math.round(40 * r.mult) }); }
    if (!r.splashed && r.trail.style === 'lake' && r.t >= 4.4) { r.splashed = true; emit({ type: 'splash' }); }
    if (r.stuckPlanned && !r.stuckDone && r.t >= STUCK_T) {
      r.stuckDone = true; r.phase = 'stuck'; r.upsideDown = true; r.speedKmh = 0;
      emit({ type: 'stuck' });
      return;
    }
    if (k >= endK) {
      if (!r.short) { r.finishCrossed = true; emit({ type: 'finishLine' }); r.popups.push({ text: 'FINISH!', t: 1.2 }); }
      r.phase = 'done'; r.finishAt = r.t + FINISH_DELAY;
    }
  }

  function summary() {
    const r = run;
    const cash = cashNow(r);
    const reach = Math.min(1, r.distance / r.length);
    const ratingScore = Math.round(reach * 60 + (r.finishCrossed ? 20 : 0) + r.flips * 5 + Math.min(10, r.airTime * 2) - r.winches * 3);
    const rating = ratingScore >= 88 ? 'S' : ratingScore >= 70 ? 'A' : ratingScore >= 50 ? 'B' : ratingScore >= 25 ? 'C' : 'D';
    return {
      distance: Math.floor(r.distance), durationSec: Math.round(r.t * 10) / 10, airTime: Math.round(r.airTime * 100) / 100, flips: r.flips,
      smashed: r.smashed, coins: r.coins, maxSpeedKmh: Math.round(r.maxSpeed), gates: { ...r.gates }, winches: r.winches,
      finishCrossed: r.finishCrossed, cash, rating, ratingScore,
    };
  }
  function end() {
    const r = run;
    if (!r || r.ended) return;
    r.ended = true; r.phase = 'done';
    if (r.boosting) { r.boosting = false; emit({ type: 'boost', on: false }); }
    emit({ type: 'finish', summary: summary() });
  }

  function draw() {
    const r = run;
    const th = (r && r.trail.theme) || {};
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = th.sky || ['#7cc4e8', '#d8f0e0'];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const off = r ? r.distance * 8 : 0;
    const groundY = (x) => H * 0.68 + Math.sin((x + off) / 140) * 18 + Math.sin((x + off) / 47) * 5;
    ctx.fillStyle = th.far || '#5f8f7a';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.5 + Math.sin((x + off * 0.3) / 90) * 30);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = th.ground || '#6b4a2b';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, groundY(x));
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = th.groundDark || '#3f2a17';
    ctx.fillRect(0, H * 0.86, W, H * 0.14);
    if (!r) return;
    const vx = W * 0.32;
    const lift = r.inAir ? Math.sin(Math.min(1, r.flightT / 1.2) * Math.PI) * H * 0.18 : 0;
    const vy = groundY(vx) - lift;
    const ang = r.phase === 'stuck' ? Math.PI : r.inAir ? -Math.min(1, r.flightT / 1.2) * Math.PI * 2 : Math.atan2(groundY(vx + 10) - groundY(vx - 10), 20);
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(ang);
    drawRanger(ctx, { paint: r.cfg.paint, decal: r.cfg.decal }, { width: Math.min(150, W * 0.18), t: performance.now() / 1000, speed: r.speedKmh });
    ctx.restore();
    if (r.phase === 'gate') {
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(vx + 90, groundY(vx + 90) - 80, 10, 80); ctx.fillRect(vx + 70, groundY(vx + 90) - 76, 60, 26);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('GATE', vx + 80, groundY(vx + 90) - 58);
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(H * 0.07)}px Bungee, "Arial Black", sans-serif`;
    for (const p of r.popups) ctx.fillText(p.text, W / 2, H * 0.42 - (1 - p.t) * 20);
    ctx.textAlign = 'left';
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused && run) {
      step(dt);
      for (const p of run.popups) p.t -= dt;
      run.popups = run.popups.filter((p) => p.t > 0);
    }
    draw();
  }

  return {
    start,
    setInput(i = {}) { input.gas = !!i.gas; input.brake = !!i.brake; input.boost = !!(i.boost || i.nitro); },
    openGate(result = {}) {
      const r = run;
      if (!r || r.phase !== 'gate') return false;
      r.gates.answered++;
      if (result.correct) { r.gates.correct++; r.gateCash += 120; r.boost = Math.min(1, r.boost + 0.4); }
      if (result.quick) { r.gates.quick++; r.quickCash += 80; r.boost = Math.min(1, r.boost + 0.2); }
      if (result.fixed) { r.gates.fixed++; r.gateCash += 40; r.boost = Math.min(1, r.boost + 0.15); }
      r.gateIndex++; r.phase = 'ride';
      emit({ type: 'gateOpen', index: r.gateIndex - 1 });
      return true;
    },
    winch(ok) {
      const r = run;
      if (!ok || !r || r.phase !== 'stuck') return false;
      r.winches++; r.phase = 'ride'; r.upsideDown = false;
      emit({ type: 'winched' });
      return true;
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    stop() { if (run && !run.ended) end(); },
    destroy() { cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); run = null; },
    getState() {
      const r = run;
      if (!r) return null;
      return {
        phase: r.phase, distance: r.distance, speedKmh: r.speedKmh, boost: r.boost, airTime: r.inAir ? r.flightT : 0, flips: r.flips, smashed: r.smashed,
        cash: cashNow(r).total, finishCrossed: r.finishCrossed, gateIndex: r.gateIndex, gatesTotal: r.gateAt.length,
        stuck: r.phase === 'stuck', upsideDown: r.upsideDown,
      };
    },
  };
}
