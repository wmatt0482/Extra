// Mock engine: implements the src/game/engine.js contract (SPEC §3 + §13.4) with simple canvas art and no physics, so
// every screen can be exercised before (or without) the real engine; tools/ui-smoke.mjs runs on it with ?mock=1.
// Loaded with ?mock=1, or as a fallback when the real engine fails to load.
//   createGame(canvas, { onEvent, reducedMotion }) → { start(cfg), setAim(x01), throw(), throwAt(x01), setFocus(id),
//   getState(), pause(), resume(), stop(), destroy() }
// The wave (SPEC §13.1): cfg.wave.zombies (items) rise out of the fog at their fraction's spot (x = the target on the
// road) and walk toward the road in walkSec (20 s); wave.live of them at once (a cure or a zombie at the fence spawns
// the next). Hidden while p < EMERGE (0.6), then visible at the spot. The focus (the called one) is the live zombie
// nearest the fence; setFocus(id) switches it. A throw flies a closed-form arc to the aimed spot and is judged against
// the live zombie closest to the landing (near or better), else against the focused one: bull (≤ 1.5 % of the road) |
// hit (≤ tolerance) | near (≤ 2 ×) | miss; every live zombie within its own tolerance of the landing is cured (twins).
// A boss item (kind 'boss', hits, forms) takes 3 hits, showing the next form after each (bossHit + target). Consecutive
// hits count a combo (a miss resets, a near keeps; event combo { n }). Then the feedback beat: the true spot's flag,
// the fraction drawn as unit jumps from 0, and "N % close". After a miss on the same item the next aim shows the hint
// ladder: an arrow toward the spot, then the denominator's ticks for one throw. A zombie at the fence knocks, takes a
// pumpkin and shuffles off ('reached'). The final wave ends with the finale (fireworks) and a calm beat. Events: aim,
// toss, throw { item, aimed, err, result, pae, seen, combo, cures, fog }, cured { item, result }, reached { item },
// target { item }, combo { n }, bossHit { item, left }, bigWave, finalWave, finale, calm, waveEnd { cured, reached,
// pae, results, stopped? }. getState(): { phase: 'wave' | 'flight' | 'beat' | 'finale' | 'calm' | 'done', target, aim,
// combo, live: [{ id, item, show, say, x01, p, seen, target, focus, boss, hitsLeft, name, state, cured }], zombies
// (the live ones; kept for 1.0 callers), cured, reached, left, total, hint, last, roadPx }. Like the real engine it
// plays nothing itself: it emits 'sound' { name, vol } events. Test hooks: window.__mockScript = { walkSec, beatSec,
// flightSec, calmSec, finaleSec } (seconds).
import { BULL, classify, closeText, isHit, paeOf } from '../skills/items.js';

const HATS = ['cap', 'beanie', 'top', 'party', 'bow', 'none'];
const SKINS = ['#7f9a6a', '#6f8c80', '#8a9a5a', '#6a8494', '#8a7fa0', '#7a9a72'];
const HUMAN = ['#f2c29b', '#d9a07a', '#a8714f', '#f5d0b5', '#c98e6b', '#e7b48f'];
export const EMERGE = 0.6;
const GRENADE_COLORS = { slime: null, lava: '#ff7a1a', frost: '#7fe7ff', disco: '#ff5fd2' };

export function createGame(canvas, opts = {}) {
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 1, H = 1, raf = 0, last = 0, paused = false, run = null;
  const reduced = !!opts.reducedMotion;

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
  const script = () => (typeof window !== 'undefined' && window.__mockScript) || {};
  const sec = (k, d) => (Number(script()[k]) > 0 ? Number(script()[k]) : d);
  const roadPx = () => { const m = Math.max(44, W * 0.08); return { left: m, right: W - m, y: Math.round(H * (H > W ? 0.66 : 0.72)) }; };
  const x01Of = (v) => (run ? (v - run.road.from) / (run.road.to - run.road.from) : v);

  function start(cfg = {}) {
    const wave = cfg.wave || { zombies: [] };
    const road = cfg.road || { from: 0, to: 1, labels: ['0', '½', '1'] };
    const look = cfg.look || {};
    const live = Math.max(1, Math.min(6, Math.floor(Number(wave.live)) || (wave.big ? 4 : 2)));
    run = {
      cfg, road, wave, queue: (wave.zombies || []).slice(), active: [], total: (wave.zombies || []).length, maxActive: live,
      t: 0, phase: 'wave', aim: 0.5, cured: 0, reached: 0, throws: [], perItem: {}, flight: null, beat: null, calm: 0, finale: 0, ended: false,
      targetId: null, focusId: null, combo: 0, confetti: [], walkSec: sec('walkSec', Number(wave.shuffleSec) > 0 ? Math.max(10, Math.min(90, Number(wave.shuffleSec))) : 20),   // the test script's walkSec wins; else the app's plan (§16); else 20 spawned: 0, pumpkins: Math.max(3, Math.min(12, Number(look.pumpkins) || 5)),
      goo: (typeof look.goo === 'string' && look.goo.startsWith('#') ? look.goo : '#a6ff2e'), grenade: GRENADE_COLORS[look.grenade] || null, dog: !!look.dog, lantern: !!look.lantern,
      banner: null, fence: look.fenceColor || '#f4efe2', sky: look.sky || ['#0c0b14', '#3a2430', '#8a3a14'],
    };
    if (wave.big) { emit({ type: 'bigWave', count: live }); emit({ type: 'sound', name: 'bigWave', vol: 1 }); run.banner = { text: 'BIG WAVE!', t0: 0 }; }
    if (wave.final) { emit({ type: 'finalWave' }); emit({ type: 'sound', name: 'finalWave', vol: 1 }); run.banner = { text: 'FINAL WAVE!', t0: 0 }; }
    spawn();
    paused = false;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  const liveList = () => run.active.filter((z) => !z.leaving && !z.reachedAt);
  function spawn() {
    const r = run;
    while (liveList().length < r.maxActive && r.queue.length) {
      const item = r.queue.shift();
      const k = r.spawned++;
      const boss = item.kind === 'boss';
      r.active.push({ item, progress: -0.12 * liveList().length, x01: x01Of(item.target), look: k % 6, leaving: 0, boss, hitsLeft: boss ? Math.max(1, Number(item.hits) || 3) : 1, form: 0, dizzy: 0 });
      if (boss) { emit({ type: 'sound', name: 'bossStomp', vol: 1 }); r.banner = { text: item.name || 'THE BOSS', t0: r.t }; }
    }
    checkTarget();
  }
  function target() {
    if (!run) return null;
    const list = liveList();
    const f = run.focusId ? list.find((z) => z.item.id === run.focusId) : null;
    if (f) return f;
    let best = null;
    for (const z of list) if (!best || z.progress > best.progress) best = z;
    return best;
  }
  const seenOf = (z) => z.progress >= EMERGE;
  const formOf = (z) => (z.boss && Array.isArray(z.item.forms) && z.item.forms[z.form] ? z.item.forms[z.form] : null);
  const itemOut = (z) => { const f = formOf(z); return f ? { ...z.item, show: f.show, say: f.say, hitsLeft: z.hitsLeft } : { ...z.item }; };
  function checkTarget(force = false) {
    const z = target();
    const id = z ? `${z.item.id}:${z.form}` : null;
    if (id !== run.targetId || force) { run.targetId = id; if (z) emit({ type: 'target', item: itemOut(z) }); }
  }
  const valueAt = (x01) => run.road.from + x01 * (run.road.to - run.road.from);

  function setAim(x) {
    if (!run || run.ended) return;
    const v = Math.max(0, Math.min(1, Number(x) || 0));
    if (v !== run.aim) { run.aim = v; emit({ type: 'aim', x: v }); }
  }
  function setFocus(id) {
    if (!run || run.ended) return false;
    const z = liveList().find((x) => x.item.id === String(id));
    if (!z) return false;
    run.focusId = z.item.id;
    checkTarget();
    return true;
  }
  function doThrow() {
    const r = run;
    if (!r || r.ended || r.phase !== 'wave' || paused) return false;
    const z = target();
    if (!z) return false;
    r.flight = { z, x: r.aim, t0: r.t, dur: sec('flightSec', 0.45), seen: seenOf(z) };
    r.phase = 'flight';
    emit({ type: 'toss', item: itemOut(z), aimed: valueAt(r.aim), aimed01: r.aim });
    emit({ type: 'sound', name: 'toss', vol: 0.7 });
    return true;
  }
  function land() {
    const r = run, f = r.flight;
    r.flight = null;
    const aimed = valueAt(f.x);
    const span = r.road.to - r.road.from;
    // resolve against the live zombie closest to the landing (near or better), else the focused one
    let z = f.z;
    let bestD = Infinity, best = null;
    for (const c of liveList()) { const d = Math.abs(aimed - c.item.target) / span; if (d < bestD) { bestD = d; best = c; } }
    if (best && best !== z && bestD <= 2 * (best.item.tolerance || 0.1) + 1e-9) z = best;
    const seen = z === f.z ? f.seen : seenOf(z);
    const item = z.item;
    const pae = paeOf(aimed, item.target, r.road);
    const err = (aimed - item.target) / span;
    const result = classify(err, item.tolerance || 0.1);
    const st = r.perItem[item.id] || (r.perItem[item.id] = { throws: 0, misses: 0, best: null, hits: 0 });
    st.throws++;
    const hit = isHit(result);
    if (hit) r.combo++; else if (result === 'miss') r.combo = 0;
    r.throws.push({ item, aimed, result, pae });
    emit({ type: 'sound', name: { bull: 'thunkBig', hit: 'thunk', near: 'thunkSmall', miss: 'plop' }[result], vol: 1 });
    if (hit) emit({ type: 'sound', name: 'splat', vol: result === 'bull' ? 1 : 0.8 });
    if (hit && r.grenade) emit({ type: 'sound', name: Object.keys(GRENADE_COLORS).find((k) => GRENADE_COLORS[k] === r.grenade), vol: 1 });
    // every live zombie within its own tolerance of the landing is cured by this throw (twins); the boss takes a hit
    const cures = [];
    const curedNow = [];
    if (hit) {
      for (const c of liveList()) {
        const d = Math.abs(aimed - c.item.target) / span;
        if (d > (c.item.tolerance || 0.1) + 1e-9) continue;
        if (c.boss) {
          if (c !== z) continue;
          c.hitsLeft--;
          if (c.hitsLeft > 0) { c.form = Math.min(c.form + 1, (c.item.forms || []).length - 1); c.progress = Math.max(0, c.progress - 0.15); c.dizzy = r.t; emit({ type: 'sound', name: 'bossHit', vol: 1 }); emit({ type: 'bossHit', item: itemOut(c), left: c.hitsLeft }); continue; }
        }
        cures.push(c.item.id); curedNow.push(c);
      }
    }
    const showFlag = { ...itemOut(z) };
    emit({ type: 'throw', item: showFlag, aimed, err, result, pae, close: Math.max(0, Math.round(100 - pae)), tolerance: item.tolerance || 0.1, attempt: st.throws, seen, combo: r.combo, cures, fog: hit && !seen });
    if (hit && r.combo >= 2) { emit({ type: 'combo', n: r.combo }); emit({ type: 'sound', name: 'combo', vol: r.combo / 10 }); if (r.combo >= 4) emit({ type: 'sound', name: 'mega', vol: 1 }); }
    r.beat = { z, item, x: f.x, result, pae, t0: r.t, dur: sec('beatSec', 1.4) * (result === 'bull' && !reduced ? 1.3 : 1), show: showFlag.show, cures: cures.length };
    r.phase = 'beat';
    for (const c of curedNow) {
      r.cured++; c.leaving = r.t; c.cure = c === z ? result : 'hit';
      const cs = r.perItem[c.item.id] || (r.perItem[c.item.id] = { throws: 0, misses: 0, best: null, hits: 0 });
      cs.best = c.cure;
      emit({ type: 'cured', item: itemOut(c), result: c.cure, pae: c === z ? pae : paeOf(aimed, c.item.target, r.road) });
      emit({ type: 'sound', name: 'cure', vol: 1 });
      if (result === 'bull' && !reduced) for (let i = 0; i < 40; i++) r.confetti.push({ x: f.x, a: Math.random() * Math.PI * 2, v: 80 + Math.random() * 160, c: ['#ffd23a', '#8dff3a', '#ff7ad1', '#22d3ff'][i % 4], t0: r.t });
    }
    if (curedNow.length > 1) r.banner = { text: `TWINS! ${curedNow.map((c) => c.item.show).join(' = ')}`, t0: r.t };
    if (!hit) {
      st.misses++;
      z.hint = st.misses % 2 === 1 ? 'arrow' : 'ticks';
      z.lastX = f.x;
    }
    if (r.focusId && !liveList().some((c) => c.item.id === r.focusId)) r.focusId = null;
    checkTarget(true);
  }
  function finish(stopped) {
    const r = run;
    if (!r || r.ended) return;
    r.ended = true; r.phase = 'done';
    const results = [];
    for (const z of [...r.active, ...r.queue.map((item) => ({ item }))]) if (!r.perItem[z.item.id] || !r.perItem[z.item.id].best) results.push({ id: z.item.id, show: z.item.show, outcome: stopped ? 'stopped' : 'left', throws: (r.perItem[z.item.id] || {}).throws || 0 });
    for (const [id, s] of Object.entries(r.perItem)) if (s.best || s.reached) results.push({ id, outcome: s.best ? 'cured' : 'reached', result: s.best, throws: s.throws });
    const pae = r.throws.length ? Math.round((r.throws.reduce((a, t) => a + t.pae, 0) / r.throws.length) * 10) / 10 : null;
    emit({ type: 'sound', name: 'waveEnd', vol: 1 });
    emit({ type: 'waveEnd', cured: r.cured, reached: r.reached, pae, results, throws: r.throws.length, ...(stopped ? { stopped: true } : {}) });
  }

  function update(dt) {
    const r = run;
    if (!r || r.ended) return;
    r.t += dt;
    if (r.phase === 'flight' && r.t - r.flight.t0 >= r.flight.dur) land();
    if (r.phase === 'beat' && r.t - r.beat.t0 >= r.beat.dur) { r.beat = null; r.phase = 'wave'; }
    if (r.phase === 'finale') { if (r.t - r.finale >= sec('finaleSec', 2.5)) { r.phase = 'calm'; r.calm = r.t; emit({ type: 'calm' }); emit({ type: 'sound', name: 'calm', vol: 1 }); } return; }
    if (r.phase === 'calm') { if (r.t - r.calm >= sec('calmSec', 1.5)) finish(false); return; }
    // cured neighbours walk home; zombies shuffle (they wait while a throw is in the air and during the beat)
    for (const z of r.active.slice()) {
      if (z.leaving) { if (r.t - z.leaving > 1.2) r.active.splice(r.active.indexOf(z), 1); continue; }
      if (r.phase !== 'wave') continue;
      z.progress += dt / (r.walkSec * (z.boss ? 2.2 : 1));
      if (z.progress >= 1) {
        r.reached++; r.pumpkins = Math.max(0, r.pumpkins - 1);
        const st = r.perItem[z.item.id] || (r.perItem[z.item.id] = { throws: 0, misses: 0, best: null, hits: 0 });
        st.reached = true;
        r.active.splice(r.active.indexOf(z), 1);
        if (r.focusId === z.item.id) r.focusId = null;
        emit({ type: 'knock', item: itemOut(z) }); emit({ type: 'sound', name: 'knock', vol: 1 }); emit({ type: 'sound', name: 'pumpkin', vol: 1 });
        emit({ type: 'reached', item: itemOut(z), pumpkins: r.pumpkins });
      }
    }
    if (r.phase === 'wave' || r.phase === 'beat') spawn();
    if (r.phase === 'wave' && !r.queue.length && !liveList().length) {
      if (r.wave.final) { r.phase = 'finale'; r.finale = r.t; emit({ type: 'finale' }); emit({ type: 'sound', name: 'fireworks', vol: 1 }); } else finish(false);
    }
    r.confetti = r.confetti.filter((c) => r.t - c.t0 < 1.4);
  }

  // ---------- drawing ----------
  function drawZombie(z, x, y, s) {
    const cured = !!z.leaving;
    const skin = cured ? HUMAN[z.look] : SKINS[z.look];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = cured ? '#4b7bd9' : z.boss ? '#5a2a4e' : '#5a4b6e';
    ctx.fillRect(-12, -6, 24, 30);                      // body
    ctx.fillStyle = skin;
    ctx.fillRect(-26, -2, 14, 7); ctx.fillRect(12, -2, 14, 7);   // arms out (a goofy shuffle)
    ctx.beginPath(); ctx.arc(0, -20, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -22, 4, 0, 7); ctx.arc(6, -21, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-5, -22, 1.8, 0, 7); ctx.arc(7, -21, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath();
    if (cured) ctx.arc(0, -15, 6, 0.2, Math.PI - 0.2); else { ctx.moveTo(-6, -11); ctx.lineTo(6, -12); }
    ctx.stroke();
    const hat = z.boss ? 'top' : HATS[z.look];
    ctx.fillStyle = z.boss ? '#111' : ['#ff3b5c', '#22d3ff', '#222', '#ffd23a', '#ff7ad1', '#000'][z.look];
    if (hat === 'cap') { ctx.fillRect(-14, -36, 28, 8); ctx.fillRect(4, -30, 16, 3); }
    else if (hat === 'beanie') { ctx.beginPath(); ctx.arc(0, -31, 13, Math.PI, 0); ctx.fill(); }
    else if (hat === 'top') { ctx.fillRect(-10, -50, 20, 18); ctx.fillRect(-15, -34, 30, 4); }
    else if (hat === 'party') { ctx.beginPath(); ctx.moveTo(-9, -33); ctx.lineTo(9, -33); ctx.lineTo(0, -54); ctx.fill(); }
    else if (hat === 'bow') { ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-10, -40); ctx.lineTo(-10, -28); ctx.moveTo(0, -34); ctx.lineTo(10, -40); ctx.lineTo(10, -28); ctx.fill(); }
    if (z.boss) { ctx.fillStyle = '#ff8a1f'; ctx.fillRect(-12, -2, 24, 6); }   // the mayor's sash
    ctx.restore();
  }
  function label(text, x, y, size, color = '#fff', align = 'center') {
    ctx.font = `400 ${size}px Anton, Impact, 'Arial Narrow', sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = 'rgba(10,8,24,.85)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = run;
    const sky = r ? r.sky : ['#0c0b14', '#3a2430', '#8a3a14'];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(0.45, sky[1]); g.addColorStop(0.62, sky[2]); g.addColorStop(0.62, '#1a191d'); g.addColorStop(1, '#0e0d10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // moon + graveyard silhouettes
    ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.16, Math.min(W, H) * 0.06, 0, 7); ctx.fill();
    ctx.fillStyle = '#0d0c10';
    for (let i = 0; i < 9; i++) { const x = (i + 0.5) * (W / 9); ctx.fillRect(x - 9, H * 0.58, 18, H * 0.04); ctx.beginPath(); ctx.arc(x, H * 0.58, 9, Math.PI, 0); ctx.fill(); }
    if (!r) return;
    const rp = roadPx();
    const X = (x01) => rp.left + x01 * (rp.right - rp.left);
    // the road (the number line)
    ctx.fillStyle = '#2c2b31'; ctx.fillRect(rp.left - 24, rp.y - 16, rp.right - rp.left + 48, 32);
    ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rp.left, rp.y); ctx.lineTo(rp.right, rp.y); ctx.stroke();
    const z = target();
    // the hint ladder: the denominator's ticks for one throw
    if (z && z.hint === 'ticks' && r.phase === 'wave') {
      ctx.strokeStyle = 'rgba(255,243,214,.8)'; ctx.lineWidth = 2;
      for (let k = 1; k < z.item.d; k++) { const x = X(k / z.item.d); ctx.beginPath(); ctx.moveTo(x, rp.y - 12); ctx.lineTo(x, rp.y + 12); ctx.stroke(); }
    }
    // 0, ½ and 1 stay labelled, always
    const raw = Array.isArray(r.road.labels) && r.road.labels.length ? r.road.labels : ['0', '½', '1'];
    const labels = raw.map((t, i) => (typeof t === 'string' ? { at: r.road.from + (i * (r.road.to - r.road.from)) / Math.max(1, raw.length - 1), text: t } : t));
    for (const t of labels) {
      const x = X((t.at - r.road.from) / (r.road.to - r.road.from));
      ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, rp.y - 16); ctx.lineTo(x, rp.y + 16); ctx.stroke();
      if (t.text) label(t.text, x, rp.y + 36, 26);
    }
    // the fence and pumpkins
    const fy = H * 0.9;
    ctx.fillStyle = r.fence;
    for (let x = 6; x < W; x += 22) { ctx.fillRect(x, fy - 26, 12, 40); }
    ctx.fillRect(0, fy - 16, W, 6);
    for (let i = 0; i < r.pumpkins; i++) { ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.ellipse(W * 0.06 + i * 30, fy + 22, 12, 9, 0, 0, 7); ctx.fill(); }
    if (r.lantern) { ctx.fillStyle = '#ffd25a'; ctx.fillRect(W - 30, H * 0.3, 14, 18); }
    if (r.dog) { ctx.fillStyle = '#c9a36b'; ctx.beginPath(); ctx.ellipse(X(0.5), fy + 18, 18, 10, 0, 0, 7); ctx.fill(); }
    // zombies rise out of the fog at their fraction's spot (y0, hidden while p < EMERGE) and walk to the road (y1)
    const y0 = H * 0.42, y1 = rp.y - 22;
    const sorted = r.active.slice().sort((a, b) => a.progress - b.progress);
    for (const zz of sorted) {
      const p = Math.max(0, zz.progress);
      if (!zz.leaving && p < EMERGE) continue;      // in the fog: nothing drawn
      let x = X(zz.x01), y = y0 + (y1 - y0) * p;
      if (zz.leaving) { y = y1; x += (r.t - zz.leaving) * W * 0.4 * (zz.x01 < 0.5 ? -1 : 1); }
      const s = (0.55 + p * 0.65) * (zz.boss ? 1.6 : 1);
      const wob = zz.dizzy && r.t - zz.dizzy < 1 ? Math.sin((r.t - zz.dizzy) * 20) * 6 : 0;
      drawZombie(zz, x + Math.sin(r.t * 3 + zz.look) * 3 + wob, y, s);
      if (!zz.leaving && !zz.reachedAt) {
        const on = zz === z;
        const show = (formOf(zz) || zz.item).show;
        ctx.fillStyle = on ? '#ffd23a' : '#f4efe2';
        const w = Math.max(60, show.length * 11) * s;
        ctx.fillRect(x - w / 2, y - 70 * s, w, 26 * s);
        label(show, x, y - 57 * s, Math.round(16 * s), on ? '#2a1a00' : '#3b2f4a');
        if (zz.boss) label(zz.item.name || 'BOSS', x, y - 86 * s, Math.round(13 * s), '#ff8a1f');
      }
    }
    // the fog band over the far graveyard
    const fg = ctx.createLinearGradient(0, y0 - 30, 0, y0 + (y1 - y0) * EMERGE);
    fg.addColorStop(0, 'rgba(190,190,210,.55)'); fg.addColorStop(1, 'rgba(190,190,210,0)');
    ctx.fillStyle = fg; ctx.fillRect(0, y0 - 30, W, (y1 - y0) * EMERGE + 30);
    // reticle + the hint arrow toward the spot
    if (r.phase === 'wave' && z) {
      const ax = X(r.aim);
      ctx.strokeStyle = r.goo; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ax, rp.y, 16, 0, 7); ctx.stroke();
      ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(ax, rp.y - 60); ctx.lineTo(ax, rp.y + 16); ctx.stroke(); ctx.setLineDash([]);
      if (z.hint && z.lastX != null) {
        const tx = X((z.item.target - r.road.from) / (r.road.to - r.road.from));
        const dir = Math.sign(tx - X(z.lastX)) || 1;
        const sx = X(z.lastX);
        ctx.fillStyle = '#ffd23a';
        ctx.beginPath(); ctx.moveTo(sx + dir * 46, rp.y - 44); ctx.lineTo(sx + dir * 20, rp.y - 56); ctx.lineTo(sx + dir * 20, rp.y - 32); ctx.fill();
        ctx.fillRect(Math.min(sx, sx + dir * 20), rp.y - 48, 20, 8);
      }
    }
    // the grenade in flight: a closed-form arc from the fence to the aim
    if (r.phase === 'flight' && r.flight) {
      const f = r.flight, k = Math.min(1, (r.t - f.t0) / f.dur);
      const sx = W / 2, sy = fy, tx = X(f.x), ty = rp.y;
      const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k - Math.sin(Math.PI * k) * H * 0.3;
      ctx.fillStyle = r.grenade || r.goo; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1d3b10'; ctx.lineWidth = 2; ctx.stroke();
    }
    // the feedback beat: the flag at the true spot, the fraction as unit jumps from 0, "N % close"
    if (r.beat) {
      const b = r.beat, it = b.item;
      const tx = X((it.target - r.road.from) / (r.road.to - r.road.from)), ax = X(b.x);
      const unit = (rp.right - rp.left) / it.d;
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 3;
      for (let k = 0; k < it.n; k++) { const x0 = rp.left + k * unit; ctx.beginPath(); ctx.arc(x0 + unit / 2, rp.y - 2, unit / 2, Math.PI, 0); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.fillRect(tx - 2, rp.y - 64, 4, 64);
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(tx + 2, rp.y - 64); ctx.lineTo(tx + 40, rp.y - 54); ctx.lineTo(tx + 2, rp.y - 44); ctx.fill();
      label(b.show || it.show, tx + 22, rp.y - 78, 18, '#ffd23a');
      const big = b.result === 'bull' ? 46 : b.result === 'hit' ? 34 : b.result === 'near' ? 20 : 12;
      ctx.fillStyle = b.result === 'miss' ? 'rgba(141,255,58,.5)' : (r.grenade || r.goo);
      ctx.beginPath(); ctx.ellipse(ax, rp.y, big, big * 0.45, 0, 0, 7); ctx.fill();
      const words = b.result === 'bull' ? 'BULLSEYE!' : b.result === 'hit' ? (b.cures > 1 ? 'TWINS!' : 'THUNK! Cured!') : b.result === 'near' ? 'So close!' : 'Plop!';
      const ty = Math.max(H * 0.36, 130);           // below the HUD's fraction card; never over the road
      label(words, W / 2, ty, Math.round(Math.min(W, H) * 0.08), b.result === 'bull' ? '#ffd23a' : '#fff');
      label(closeText(b.pae), W / 2, ty + Math.min(W, H) * 0.08, Math.round(Math.min(W, H) * 0.05), '#8dff3a');
    }
    for (const c of r.confetti) {
      const k = r.t - c.t0, x = X(c.x) + Math.cos(c.a) * c.v * k, y = rp.y - 20 + Math.sin(c.a) * c.v * k + 120 * k * k;
      ctx.fillStyle = c.c; ctx.fillRect(x, y, 6, 6);
    }
    if (r.banner && r.t - r.banner.t0 < 2) label(r.banner.text, W / 2, Math.max(H * 0.36, 130), Math.round(Math.min(W, H) * 0.09), r.banner.text.startsWith('FINAL') ? '#ff8a1f' : '#c77dff');
    if (r.phase === 'finale') { label('FIREWORKS!', W / 2, H * 0.3, Math.round(Math.min(W, H) * 0.08), '#ffd23a'); for (let i = 0; i < 12; i++) { ctx.fillStyle = ['#ffd23a', '#8dff3a', '#ff7ad1', '#22d3ff'][i % 4]; ctx.beginPath(); ctx.arc(W * (0.2 + (i * 0.37) % 0.6), H * 0.2 + Math.sin(r.t * 3 + i) * 30, 5, 0, 7); ctx.fill(); } }
    if (r.phase === 'calm') { label('A calm night', W / 2, H * 0.3, Math.round(Math.min(W, H) * 0.07), '#ffd23a'); label('Plant a pumpkin', W / 2, H * 0.3 + 40, 20); }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) update(dt);
    draw();
  }

  return {
    start,
    setAim,
    setFocus,
    setPace({ live, walkSec } = {}) { if (!run) return false; if (Number.isFinite(Number(live))) run.maxActive = Math.max(1, Math.min(6, Math.round(Number(live)))); if (Number(walkSec) > 0) run.walkSec = Math.max(10, Math.min(90, Number(walkSec))); spawn(); return true; },
    throw: doThrow,
    throwAt(x) { setAim(x); return doThrow(); },
    getState() {
      const r = run;
      if (!r) return null;
      const z = target();
      const live = r.active.map((x) => ({ id: x.item.id, item: x.item.id, show: (formOf(x) || x.item).show, say: (formOf(x) || x.item).say, x01: x.x01, p: Math.round(x.progress * 1000) / 1000, seen: seenOf(x),
        target: x.item.target, focus: x === z, boss: x.boss, hitsLeft: x.hitsLeft, name: x.item.name || null, state: x.leaving ? 'home' : 'walk', cured: !!x.leaving, resolved: !!x.leaving }));
      return {
        phase: r.phase, target: z ? itemOut(z) : null, aim: r.aim, combo: r.combo, cured: r.cured, reached: r.reached, total: r.total,
        left: r.queue.length + liveList().length, hint: z ? z.hint || null : null,
        live, zombies: live.filter((x) => !x.cured), pace: { live: r.maxActive, walkSec: r.walkSec },
        last: r.throws.length ? { ...r.throws[r.throws.length - 1], item: undefined, show: r.throws[r.throws.length - 1].item.show } : null,
        roadPx: roadPx(), bull: BULL,
      };
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    stop() { finish(true); },
    destroy() { cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); run = null; },
    resize,
  };
}
