// Mock engine: implements the src/game/engine.js contract (SPEC §3 + v1.1 race mode §6) with a scripted race, so every
// screen can be exercised without physics (tools/ui-smoke.mjs runs on it with ?mock=1). Loaded with ?mock=1, or as a
// fallback when the real engine fails to load.
// The race: a 3-2-1 countdown ('countdown' {n}), the gate drop ('go'; GAS held before it = a bogged start), then the
// player's Ranger rides on its own timeline against three AI riders (Max, Zoe, Kai): a slow launch, one jump with a
// backflip ('bigAir', 'flip' {kind, count}, a PERFECT landing), one CRASH ('crash', 1.5 s, 'respawn' at the last
// checkpoint), checkpoints every 100 m, trail coins, 'position' {place} whenever the order changes, 'finishLine', and
// 'finish' {summary} 0.8 s later. getState().riders and summary.riders list every rider, the player included (me: true). Cash (× stats.coinMult, each part a whole number so the parts add up to the total):
// distance $2/m, air $30/s, flips $150, perfect landings $100, coins $10, place 1st $500 / 2nd $300 / 3rd $150, finish
// $300 (and gates $120 / quick $80 / fixed $40 when a ride has gates: the math phase).
// Math Gates (v1.2): cfg.gates signs spread along the track; at each one the player is parked and the WHOLE race
// freezes (riders, clock) with phase 'gate' + event 'gate' {index, x} until openGate({ correct, quick, fixed, holdSec }):
// quick → +60 % boost and a 1.2 s push, correct → +40 %, fixed → no boost and the rivals run on for holdSec (1.5 s)
// while the player waits at the line. Gate cash: $120 a right answer (+$80 quick), $40 fixed (cash.gates / cash.quick).
// v1.5: race.riders may be a list ({ name, paint, vehicle, ... }: the rival trio; their names and paints are used); the
// backflip is a 'combo' {count: 2} (+$50 combo cash); openGate({ turbo: true }) fires 'turbo' and a 3 s push; the run
// is sampled every 0.1 s into summary.ghostTrace [[t, x, 0]]; with cfg.ghost, getState().ghostGap and
// summary.beatGhost compare the run with it.
// v1.7: the Hill Climb (SPEC v1.7 §1) after a finished race: startHill({ flags: 5, questions: 10, seed, cupMult }) →
// 'hillStart', then 'hillHold' {heightM, flag} 0.6 s later; hillBoost({ power, quick }) climbs one 60 m section (quick),
// 0.7 of one (slow) or slides back to the last flag line (power 0) over a 0.8 s burst, then holds again; crossing a
// flag line → 'hillFlag' {n, heightM, cash: 150 × n × cupMult}; 300 m → 'hillSummit' {heightM, cash: 1000 × cupMult}
// and the climb ends; `questions` answers without the summit end it at the next hold; endHill() ends it; the end emits
// 'hillEnd' {heightM, flags, summit, answers, cash: {flags, summit, total}, bestHeightM}. getState().hill mirrors it.
// Test hooks: window.__mockScript = { aiTimes: [s, s, s] (the AI riders' race times; default 7.0, 9.6, 10.4: the
//   player, ~8.8 s, finishes 2nd), noCrash: true }.
import { drawRanger } from '../ui/vehiclePreview.js';

const CD_STEP = 0.7;          // seconds between 3, 2, 1, GO
const PLAYER_T = 6.5;         // a clean race at full speed (race seconds)
const LAUNCH_T = 0.8;         // slow launch off the gate (60 % speed)
const JUMP1 = [1.6, 3.2];     // take-off, landing (race seconds): big air + backflip + perfect
const JUMP2 = [3.6, 4.2];     // take-off, landing: crash
const CRASH_T = 1.5;
const FINISH_DELAY = 0.8;
const COIN_RT = [0.5, 1.0, 1.4, 3.4, 5.0, 5.6, 6.2, 7.0];
const AI = [{ name: 'Max' }, { name: 'Zoe' }, { name: 'Kai' }];
const AI_PAINTS = ['lakeblue', 'sunset', 'gold', 'sky', 'purple', 'black'];
const PLACE_CASH = { 1: 500, 2: 300, 3: 150 };
const HILL_SECTION_M = 60;    // one flag section (a full quick burst)
const HILL_BURST_S = 0.8;
const HILL_FLAG_CASH = 150, HILL_SUMMIT_CASH = 1000;

export function createGame(canvas, opts = {}) {
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 1, H = 1, raf = 0, last = 0, paused = false, run = null, hill = null;
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
    const trail = cfg.trail || { id: 'track', length: 600, style: 'forest', theme: {} };
    const script = (typeof window !== 'undefined' && window.__mockScript) || {};
    const times = Array.isArray(script.aiTimes) && script.aiTimes.length === 3 ? script.aiTimes : [7.0, 9.6, 10.4];
    const paints = AI_PAINTS.filter((p) => p !== cfg.paint).slice(0, 3);
    const list = cfg.race && Array.isArray(cfg.race.riders) ? cfg.race.riders.slice(0, 3) : null;
    const nRiders = list ? list.length : cfg.race && Number.isFinite(cfg.race.riders) ? Math.max(0, Math.min(3, cfg.race.riders)) : 3;
    const length = trail.length || 600;
    run = {
      cfg, trail, length, mult: (cfg.stats && cfg.stats.coinMult) || 1, crashPlanned: !script.noCrash,
      riders: (list || AI.slice(0, nRiders)).map((a, i) => ({ name: a.name || AI[i].name, paint: (list && typeof a.paint === 'string' && a.paint) || paints[i], finishT: times[i], x: 0 })),
      ghost: Array.isArray(cfg.ghost) && cfg.ghost.length > 1 ? cfg.ghost : null, trace: [], nextSample: 0, comboCash: 0, maxCombo: 0,
      phase: 'countdown', t: 0, cd: 3, goT: 3 * CD_STEP, bogged: false, rt: 0, distance: 0, checkpoint: 0, place: nRiders + 1,
      speedKmh: 0, maxSpeed: 0, boost: 0.4, boosting: false, inAir: false, flightT: 0, airTime: 0, airCash: 0, bigAir: false,
      flips: 0, flipCash: 0, perfect: 0, perfectCash: 0, crashes: 0, crashT: 0, coins: 0, coinCash: 0, nextCoin: 0,
      jump1: false, jump2: false, finishCrossed: false, timeSec: 0, finishAt: null, ended: false, popups: [],
      gates: { answered: 0, correct: 0, quick: 0, fixed: 0 }, gateCash: 0, quickCash: 0,
      gateX: Array.from({ length: Math.max(0, Math.floor(cfg.gates || 0)) }, (_, i) => Math.round((length * (i + 1)) / (Math.floor(cfg.gates) + 1))),
      gateIndex: 0, frozen: 0, holdUntil: 0, pushUntil: 0,
    };
    hill = null;
    emit({ type: 'countdown', n: 3 });
    paused = false;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function placeCash(r) { return r.finishCrossed && PLACE_CASH[r.place] ? PLACE_CASH[r.place] : 0; }
  function cashNow(r) {
    const m = r.mult, k = (v) => Math.round(v * m);
    const c = {
      distance: k(Math.floor(r.distance) * 2), air: k(r.airCash), flips: k(r.flipCash), perfect: k(r.perfectCash), coins: k(r.coinCash),
      place: k(placeCash(r)), finish: r.finishCrossed ? k(300) : 0, gates: k(r.gateCash), quick: k(r.quickCash), combo: k(r.comboCash),
    };
    c.total = Object.values(c).reduce((a, v) => a + v, 0);
    return c;
  }
  // seconds behind (+) / ahead (-) of the ghost at the player's distance
  function ghostGap(r) {
    const g = r.ghost;
    const i = g.findIndex((p) => p[1] >= r.distance);
    const t = i < 0 ? g[g.length - 1][0] : g[i][0];
    return Math.round((Math.max(0, r.rt) - t) * 10) / 10;
  }
  function currentPlace(r) {
    const me = r.finishCrossed ? r.timeSec : null;
    let ahead = 0;
    for (const a of r.riders) {
      if (me != null) { if (a.finishT < me) ahead++; } else if (a.x > r.distance) ahead++;
    }
    return ahead + 1;
  }

  // ---- the Hill Climb (after the race's end) ----
  function hillCash(h) {
    const flags = Math.round(HILL_FLAG_CASH * h.cupMult * (h.flag * (h.flag + 1)) / 2);
    const summit = h.summit ? Math.round(HILL_SUMMIT_CASH * h.cupMult) : 0;
    return { flags, summit, total: flags + summit };
  }
  function hillEndNow() {
    const h = hill;
    if (!h || !h.active) return;
    h.active = false; h.holding = false; h.burst = 0;
    h.bestHeightM = Math.max(h.bestHeightM, Math.round(h.heightM));
    emit({ type: 'hillEnd', heightM: Math.round(h.heightM), flags: h.flag, summit: h.summit, answers: h.answers, cash: hillCash(h), bestHeightM: h.bestHeightM });
  }
  function hillStep(dt) {
    const h = hill;
    if (!h || !h.active) return;
    h.t += dt;
    if (h.pendingHold && h.t >= h.pendingHold) { h.pendingHold = 0; h.holding = true; emit({ type: 'hillHold', heightM: Math.round(h.heightM), flag: h.flag }); return; }
    if (h.burst > 0) {
      const k = Math.min(1, dt / h.burst);
      h.heightM += (h.target - h.heightM) * k;
      h.burst = Math.max(0, h.burst - dt);
      if (h.burst > 0) return;
      h.heightM = h.target;
      // flag lines crossed on the way up
      while (h.flag < h.flags && h.heightM >= HILL_SECTION_M * (h.flag + 1) - 0.01) {
        h.flag++;
        emit({ type: 'hillFlag', n: h.flag, heightM: Math.round(h.heightM), cash: Math.round(HILL_FLAG_CASH * h.flag * h.cupMult) });
      }
      if (h.flag >= h.flags) {
        h.summit = true; h.heightM = HILL_SECTION_M * h.flags;
        emit({ type: 'hillSummit', heightM: Math.round(h.heightM), cash: Math.round(HILL_SUMMIT_CASH * h.cupMult) });
        hillEndNow();
        return;
      }
      if (h.answers >= h.questions) { hillEndNow(); return; }
      h.holding = true;
      emit({ type: 'hillHold', heightM: Math.round(h.heightM), flag: h.flag });
    }
  }

  function step(dt) {
    hillStep(dt);
    const r = run;
    if (!r || r.ended) return;
    r.t += dt;
    if (r.phase === 'countdown') {
      if (input.gas && !r.bogged) { r.bogged = true; emit({ type: 'bogged' }); }
      const n = 3 - Math.floor(r.t / CD_STEP);
      if (n < r.cd && n >= 1) { r.cd = n; emit({ type: 'countdown', n }); }
      if (r.t >= r.goT) { r.phase = 'ride'; r.rt = r.bogged ? -0.4 : 0; emit({ type: 'go', bogged: r.bogged }); }
      return;
    }
    // a Math Gate: everything waits (the clock, every rider) until openGate()
    if (r.phase === 'gate') { r.frozen += dt; r.speedKmh = 0; return; }
    // the AI keeps riding until the summary is out
    const raceT = Math.max(0, r.t - r.goT - r.frozen);
    for (const a of r.riders) a.x = Math.min(r.length + 30, r.length * Math.pow(Math.min(1.2, raceT / a.finishT), 0.95));
    if (r.phase === 'done') {
      if (r.finishAt != null && r.t >= r.finishAt) end();
      return;
    }
    const wantBoost = input.boost && r.boost > 0.01 && r.phase === 'ride';
    if (wantBoost !== r.boosting) { r.boosting = wantBoost; emit({ type: 'boost', on: wantBoost }); }
    if (r.boosting) r.boost = Math.max(0, r.boost - dt * 0.4);
    r.rt += dt;
    if (r.rt < 0) return;   // bogged start
    while (r.rt >= r.nextSample && r.trace.length < 1500) { r.trace.push([Math.round(r.nextSample * 10) / 10, Math.round(r.distance * 10) / 10, 0]); r.nextSample += 0.1; }
    if (r.phase === 'crash') {
      r.speedKmh = 0;
      if (r.rt >= r.crashT + CRASH_T) {
        r.phase = 'ride'; r.distance = r.checkpoint;
        emit({ type: 'respawn', x: r.distance });
      }
      return;
    }
    if (r.rt < r.holdUntil) { r.speedKmh = 0; return; }     // held at the gate while the rivals get their head start
    const v = (r.length / PLAYER_T) * (r.rt < LAUNCH_T ? 0.6 : 1) * (r.boosting ? 1.25 : 1) * (r.rt < r.pushUntil ? 1.3 : 1);
    const gx = r.gateX[r.gateIndex];
    if (gx != null && !r.inAir && r.distance + v * dt >= gx - 3) {
      r.distance = Math.max(r.distance, gx - 3); r.phase = 'gate'; r.speedKmh = 0;
      if (r.boosting) { r.boosting = false; emit({ type: 'boost', on: false }); }
      emit({ type: 'gate', index: r.gateIndex, x: gx });
      return;
    }
    r.distance = Math.min(r.length, r.distance + v * dt);
    r.speedKmh = (r.rt < LAUNCH_T ? 48 : 88) + (r.boosting ? 22 : 0);
    r.maxSpeed = Math.max(r.maxSpeed, r.speedKmh);
    // checkpoints every 100 m
    const cp = Math.floor(r.distance / 100) * 100;
    if (cp > r.checkpoint) { r.checkpoint = cp; emit({ type: 'checkpoint', index: cp / 100 }); }
    // coins
    while (r.nextCoin < COIN_RT.length && r.rt >= COIN_RT[r.nextCoin]) {
      r.nextCoin++; r.coins++; r.coinCash += 10; r.boost = Math.min(1, r.boost + 0.06);
      emit({ type: 'coin', cash: Math.round(10 * r.mult) });
    }
    // jump 1: big air, a backflip, a perfect landing
    if (!r.jump1 && r.rt >= JUMP1[0]) { r.jump1 = true; r.inAir = true; r.flightT = 0; r.bigAir = false; r.flipped = false; }
    if (!r.jump2 && r.rt >= JUMP2[0] && r.crashPlanned) { r.jump2 = true; r.inAir = true; r.flightT = 0; r.bigAir = true; r.crashing = true; }
    if (r.inAir) {
      r.flightT += dt;
      if (!r.bigAir && r.flightT >= 1.5) { r.bigAir = true; emit({ type: 'bigAir', airTime: Math.round(r.flightT * 10) / 10 }); }
      const landAt = r.crashing ? JUMP2[1] : JUMP1[1];
      if (r.rt >= landAt) {
        r.inAir = false; r.airTime += r.flightT; r.airCash += 30 * r.flightT;
        emit({ type: 'air', airTime: Math.round(r.flightT * 100) / 100 });
        if (r.crashing) {
          r.crashing = false; r.crashes++; r.phase = 'crash'; r.crashT = r.rt; r.speedKmh = 0;
          emit({ type: 'land', quality: 'crash' });
          emit({ type: 'crash' });
        } else {
          r.flips++; r.flipCash += 150; r.perfect++; r.perfectCash += 100; r.boost = Math.min(1, r.boost + 0.3);
          emit({ type: 'flip', kind: 'back', count: 1, direction: 'back' });
          r.comboCash += 50; r.maxCombo = 2;
          emit({ type: 'combo', count: 2 });
          emit({ type: 'land', quality: 'perfect' });
        }
      }
    }
    const place = currentPlace(r);
    if (place !== r.place) { r.place = place; emit({ type: 'position', place }); }
    if (r.distance >= r.length) {
      r.finishCrossed = true; r.timeSec = Math.round(r.rt * 100) / 100;
      r.place = currentPlace(r);
      emit({ type: 'finishLine', place: r.place, timeSec: r.timeSec });
      emit({ type: 'lap', timeSec: r.timeSec });
      r.popups.push({ text: 'FINISH!', t: 1.2 });
      r.phase = 'done'; r.finishAt = r.t + FINISH_DELAY;
    }
  }

  // every rider, the player included ({ me: true }), with a place: the engine's getState().riders / summary.riders
  function ridersOut(r) {
    const name = (r.cfg.race && r.cfg.race.name) || 'You';
    const list = [{ name, paint: r.cfg.paint, x: r.distance, me: true, finished: r.finishCrossed, timeSec: r.finishCrossed ? r.timeSec : null },
      ...r.riders.map((a) => ({ name: a.name, paint: a.paint, x: a.x, me: false, finished: a.x >= r.length, timeSec: a.x >= r.length ? a.finishT : null }))];
    const key = (x) => (x.finished ? -1e6 + x.timeSec : -x.x);
    list.slice().sort((a, b) => key(a) - key(b)).forEach((x, i) => { x.place = i + 1; });
    return list;
  }
  function summary() {
    const r = run;
    const cash = cashNow(r);
    const reach = Math.min(1, r.distance / r.length);
    const ratingScore = Math.round(reach * 50 + (r.finishCrossed ? 20 : 0) + (r.finishCrossed ? (5 - r.place) * 8 : 0) + r.flips * 4 - r.crashes * 4);
    const rating = ratingScore >= 88 ? 'S' : ratingScore >= 70 ? 'A' : ratingScore >= 50 ? 'B' : ratingScore >= 25 ? 'C' : 'D';
    return {
      distance: Math.floor(r.distance), durationSec: Math.round(r.t * 10) / 10, timeSec: r.finishCrossed ? r.timeSec : Math.round(Math.max(0, r.rt) * 100) / 100, maxCombo: r.maxCombo,
      ghostTrace: r.trace.slice(), beatGhost: r.ghost && r.finishCrossed ? r.timeSec < r.ghost[r.ghost.length - 1][0] : null,
      airTime: Math.round(r.airTime * 100) / 100, flips: r.flips, crashes: r.crashes, perfect: r.perfect, smashed: 0, coins: r.coins,
      maxSpeedKmh: Math.round(r.maxSpeed), place: r.finishCrossed ? r.place : null, gates: { ...r.gates }, winches: 0,
      finishCrossed: r.finishCrossed, cash, rating, ratingScore, riders: ridersOut(r),
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
    const groundY = (x) => H * 0.7 + Math.sin((x + off) / 140) * 16 + Math.sin((x + off) / 47) * 5;
    ctx.fillStyle = th.far || '#5f8f7a';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.5 + Math.sin((x + off * 0.3) / 90) * 30);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = th.ground || '#6b4a2b';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, groundY(x));
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = th.groundDark || '#3f2a17';
    ctx.fillRect(0, H * 0.88, W, H * 0.12);
    if (!r) return;
    const vx = W * 0.34, size = Math.min(140, W * 0.17);
    // the AI riders, ahead of / behind the player by their gap (8 px per m), drawn first
    ctx.globalAlpha = 0.8;
    for (const a of r.riders) {
      const ax = vx + (a.x - r.distance) * 8;
      if (ax < -size || ax > W + size) continue;
      ctx.save(); ctx.translate(ax, groundY(ax)); drawRanger(ctx, { paint: a.paint }, { width: size * 0.9, t: performance.now() / 1000, speed: 40 }); ctx.restore();
    }
    ctx.globalAlpha = 1;
    const lift = r.inAir ? Math.sin(Math.min(1, r.flightT / 1.6) * Math.PI) * H * 0.18 : 0;
    const ang = r.phase === 'crash' ? Math.PI * 0.9 : r.inAir && !r.crashing ? -Math.min(1, r.flightT / 1.6) * Math.PI * 2 : Math.atan2(groundY(vx + 10) - groundY(vx - 10), 20);
    ctx.save(); ctx.translate(vx, groundY(vx) - lift); ctx.rotate(ang);
    drawRanger(ctx, { paint: r.cfg.paint, decal: r.cfg.decal }, { width: size, t: performance.now() / 1000, speed: r.speedKmh });
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(H * 0.07)}px Bungee, "Arial Black", sans-serif`;
    for (const p of r.popups) ctx.fillText(p.text, W / 2, H * 0.46 - (1 - p.t) * 20);
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
      const quick = !!result.quick && !!result.correct, correct = !!result.correct, fixed = !!result.fixed && !correct;
      r.gates.answered++;
      if (correct) { r.gates.correct++; r.gateCash += 120; r.boost = Math.min(1, r.boost + (quick ? 0.6 : 0.4)); }
      if (quick) { r.gates.quick++; r.quickCash += 80; r.pushUntil = r.rt + 1.2; }
      if (quick && result.turbo) { r.boost = 1; r.pushUntil = r.rt + 3; emit({ type: 'turbo' }); }
      if (fixed) { r.gates.fixed++; r.gateCash += 40; r.holdUntil = r.rt + (Number.isFinite(result.holdSec) ? result.holdSec : 1.5); }
      r.gateIndex++; r.phase = 'ride';
      emit({ type: 'gateOpen', index: r.gateIndex - 1, correct, quick, fixed });
      return true;
    },
    startHill(cfg = {}) {
      const r = run;
      if (!r || !r.ended || !r.finishCrossed || (hill && hill.active)) return false;
      hill = { active: true, t: 0, flags: Math.max(1, Math.floor(cfg.flags || 5)), questions: Math.max(1, Math.floor(cfg.questions || 10)), cupMult: Number.isFinite(cfg.cupMult) && cfg.cupMult > 0 ? cfg.cupMult : 1,
        heightM: 0, target: 0, flag: 0, holding: false, burst: 0, answers: 0, summit: false, bestHeightM: hill ? hill.bestHeightM : 0, pendingHold: 0.6 };
      r.popups.push({ text: 'HILL CLIMB!', t: 1.5 });
      emit({ type: 'hillStart', flags: hill.flags, questions: hill.questions });
      return true;
    },
    hillBoost(result = {}) {
      const h = hill;
      if (!h || !h.active || !h.holding) return false;
      const power = Math.max(0, Math.min(1, Number(result.power) || 0));
      h.answers++; h.holding = false; h.burst = HILL_BURST_S;
      if (power > 0) h.target = Math.min(HILL_SECTION_M * h.flags, h.heightM + HILL_SECTION_M * power * (result.quick ? 1 : 0.7));
      else h.target = HILL_SECTION_M * h.flag;        // a sputter: slide back to the last flag line (never below the base)
      return true;
    },
    endHill() { hillEndNow(); },
    winch() { return false; },                 // no winch in race mode: a crash respawns at the last checkpoint
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    stop() { if (run && !run.ended) end(); },
    destroy() { cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); run = null; hill = null; },
    getState() {
      const r = run;
      if (!r) return null;
      return {
        phase: r.phase, distance: r.distance, speedKmh: r.speedKmh, boost: r.boost, airTime: r.inAir ? r.flightT : 0, flips: r.flips, smashed: 0,
        cash: cashNow(r).total, finishCrossed: r.finishCrossed, gateIndex: r.gateIndex, gatesTotal: r.gateX.length, stuck: false, upsideDown: r.phase === 'crash',
        place: r.place, timeSec: r.phase === 'countdown' ? 0 : r.finishCrossed ? r.timeSec : Math.max(0, r.rt),
        riders: ridersOut(r), ghostGap: r.ghost ? ghostGap(r) : undefined,
        hill: hill ? { active: hill.active, heightM: Math.round(hill.heightM), flag: hill.flag, flags: hill.flags, progress: Math.min(1, hill.heightM / (HILL_SECTION_M * hill.flags)), holding: hill.holding, burst: hill.burst, answers: hill.answers } : null,
      };
    },
  };
}
