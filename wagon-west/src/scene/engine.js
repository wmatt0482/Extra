// Wagon West scene engine (SPEC §11): a presentational 2D canvas the app drives. It draws a day on the trail (the
// biome's parallax, the weather, the covered wagon with its name, the team walking, three companions walking along,
// dust, critters to spot), the stop scenes (fort, river, landmark painting, camp, post office, valley homestead) and
// runs the two mini-games that own the pointer (the bow hunt and fishing). It holds no game rules: the app tells it
// where the party is (setTravel) and what to show; it tells the app what the child did in a mini-game (events).
//
// Contract (the app codes against this; names are fixed):
//   createScene(canvas, { onEvent, reducedMotion }) → scene      (starts playing at once; 'ready' after the first frame)
//   scene.setLeg({ id, biome, miles, stop, river? })   scene.setParty({ animal, companions: [{ id, hat, color }], wagon: { paint, flag, name } })
//   scene.setTravel({ milesDone, pace, rations, weather, mood, foodLow, moving })   (partial updates merge)
//   scene.setBackdrop('trail' | 'fort' | 'river' | 'landmark' | 'camp' | 'post' | 'valley')
//   scene.spotAnimal('bison' | 'pronghorn' | 'coyote' | 'eagle')   scene.celebrate('arrived' | 'river' | 'star')
//   scene.startHunt({ seed, shots: 5 })   scene.startFish({ seed, casts: 4 })   scene.endMiniGame() → summary | null
//   scene.play() / pause() / destroy() / resize()
//   scene.getState() → { backdrop, milesDone, weather, moving, mini: null | { kind, left, hits, ... }, ... }
// Events: onEvent({ type, ...payload }) (the house convention of the other games' engines):
//   { type: 'ready' } · { type: 'hunt', hit, animal, meatLb } · { type: 'huntEnd', meatLb, hits, shots }
//   { type: 'fish', size, lb } · { type: 'fishEnd', fishLb, caught, casts } · { type: 'animalSpotted', animal }
// v1.1 (SPEC v1.1 §3: Fort Derby and the dog):
//   setParty({ ..., dog: { name, coat: 'brown' | 'spotted' | 'black' } | null })  (no dog key = no dog, like the rest
//     of setParty, which replaces the whole party); the dog trots beside the wagon on the trail, sits by the fire at
//     camp, waits with the party at the fort / river / landmark / valley stops (never in the post office), and runs
//     with the wagon in the derby. It barks by itself when an animal is spotted while it is on screen.
//   scene.dogBark() → true (bark pose, a little "!", emits { type: 'bark' }) | false (no dog in the party)
//   scene.startDerby({ seed, length = 400 })  scene.derbyBurst(power 0..1) → true | false (only while held at a marker)
//   scene.endDerby() → the state so far | null (emits nothing; endMiniGame() ends a derby the same way)
//   getState().mini = { kind: 'derby', progress, mailProgress, left, phase, markers, bursts, won } while it runs
//   Events: { type: 'derbyMarker', n, of } (the race holds until derbyBurst) · { type: 'derbyEnd', won, margin,
//     markers, bursts } (confetti and a cheer; 2 s later the scene goes back to its backdrop) · { type: 'bark' }
// Additions beyond §11: setReducedMotion(on); getState() also carries biome, legId, pace, view, scroll (px rolled, the
// smoke test's "the wagon moved"), playing, reducedMotion, dog ({ name, coat } | null); endMiniGame() returns the
// summary so far (and emits nothing); debugStep(n), debugPerf(reset), debugInfo(), debugMini() for the dev page and
// the smoke test.
//
// Input: while the hunt or fishing runs, a pointerdown on the canvas shoots / hooks (the canvas gets touch-action:
// none for the duration) and Space does the same from the keyboard; otherwise the scene ignores input entirely (the
// derby included: the app's panel answers for it with derbyBurst).

import { clamp, approach, clearTextSprites } from './util.js';
import { buildLayers, biomeOf, BIOMES } from './biomes.js';
import { buildSetPiece, BACKDROPS, paintingFor } from './backdrops.js';
import { paintColor, flagColor, personLook, dogCoat } from './sprites.js';
import { createHunt } from './hunt.js';
import { createFish } from './fish.js';
import { createDerby } from './derby.js';
import { drawFrame, updateFx, createFx, burst, wxOf, WEATHERS } from './render.js';

const CRITTERS = {
  bison: { n: 5, dir: -1, speed: 34, gait: 4, sky: false },
  pronghorn: { n: 3, dir: -1, speed: 120, gait: 10, sky: false },
  coyote: { n: 1, dir: -1, speed: 70, gait: 9, sky: false },
  eagle: { n: 1, dir: 1, speed: 85, gait: 4, sky: true },
};
const DEFAULT_COMPANIONS = [{ id: 'blacksmith', hat: 'cap', color: '#d9534f' }, { id: 'scout', hat: 'wide', color: '#5b8c5a' }, { id: 'cook', hat: 'bonnet', color: '#f0a500' }];
const APPROACH_MILES = 40;

export function createScene(canvas, opts = {}) {
  const emitTo = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const emit = (evt) => { try { emitTo(evt); } catch (e) { console.error('[scene] onEvent handler threw', e); } };
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const S = {
    L: null, layers: null, piece: null, approachPiece: null,
    leg: { id: 'kansas-river', biome: 'prairie', miles: 150, stop: { kind: 'river' } }, biome: 'prairie',
    party: null, ferryman: personLook('ferryman', '#6a8ac0', 'straw'),
    travel: { milesDone: 0, pace: 'steady', rations: 'full', weather: 'clear', mood: 'fine', foodLow: false, moving: false },
    backdrop: 'trail', view: 'trail',
    scroll: 0, speed: 0, walkPh: 0, walkAmp: 0, wheelSpin: 0, wagonX: 0, partyPos: [{}, {}, {}],
    wxCur: 'clear', wxPrev: 'clear', wxMix: 1,
    critters: [], cheerT: 0, approach: 0, fade: 0,
    mini: null, t: 0, rm: !!opts.reducedMotion, fx: createFx(),
    dog: null, dogPos: { x: 0, y: 0, dir: 1, sit: false, amp: 0 }, dogPh: 0, dogBarkT: 0, barks: 0, lastBarkAt: -9,
  };
  let dirtyLayers = true, dirtyPiece = true, dirtyApproach = true;
  let playing = false, destroyed = false, raf = 0, last = 0, drawQueued = 0, readySent = false;
  const perf = { frames: 0, update: 0, draw: 0, max: 0, builds: 0 };

  // ---------------------------------------------------------------- sizing
  function layout() {
    const el = canvas.parentElement || canvas;
    const rect = el.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
    const H = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
    let dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (W * H * dpr * dpr > 3.2e6) dpr = Math.max(1, Math.sqrt(3.2e6 / (W * H)));
    const k = clamp(Math.min(H / 390, W / 430), 0.5, 1.6); // the train (wagon, team, party) spans ~390k px
    return {
      W, H, dpr, ldpr: dpr, k, gy: Math.round(H * 0.8), P: Math.max(W, 700),
      // tiles (bands) reach lower than their silhouettes' base so no sky shows between layers
      base: { far: H * 0.62, mid: H * 0.67, near: H * 0.71 },
      bands: { far: [H * 0.2, H * 0.69], mid: [H * 0.34, H * 0.72], near: [H * 0.46, H * 0.72], ground: [H * 0.7, H], props: [H * 0.84, H] },
    };
  }
  function resize() {
    if (destroyed) return;
    const L = layout(), old = S.L;
    const cw = Math.round(L.W * L.dpr), ch = Math.round(L.H * L.dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    if (!old || old.W !== L.W || old.H !== L.H || old.dpr !== L.dpr) {
      S.L = L; dirtyLayers = dirtyPiece = dirtyApproach = true;
      S.wagonX = wagonTarget();
      if (old && S.mini && S.mini.bg) S.mini.bg = null;
    }
    requestDraw();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(canvas.parentElement || canvas);
  const onWinResize = () => resize();
  globalThis.addEventListener && globalThis.addEventListener('resize', onWinResize);

  function rebuild() {
    const L = S.L;
    if (dirtyLayers) { S.layers = buildLayers(S.biome, L); dirtyLayers = false; perf.builds++; }
    if (dirtyPiece) { S.piece = S.backdrop === 'trail' ? null : buildSetPiece(S.backdrop, S.leg, L); dirtyPiece = false; perf.builds++; }
    if (dirtyApproach) {
      const kind = S.leg && S.leg.stop && S.leg.stop.kind;
      S.approachPiece = kind === 'landmark' || kind === 'fort' || kind === 'home' ? buildSetPiece('approach', S.leg, L) : null;
      dirtyApproach = false;
    }
  }

  // ---------------------------------------------------------------- the party
  function applyParty(p = {}) {
    const comps = Array.isArray(p.companions) && p.companions.length ? p.companions : DEFAULT_COMPANIONS;
    const w = p.wagon || {};
    S.party = {
      animal: p.animal === 'mules' ? 'mules' : 'oxen',
      looks: comps.slice(0, 3).map((c) => personLook(c && c.id, c && c.color, c && c.hat)),
      wagon: { box: paintColor(w.paint), wheel: '#7a4a26', cover: '#f6efdc', flag: flagColor(w.flag), name: String(w.name || '').trim().toUpperCase().slice(0, 18) },
    };
    const d = p.dog;
    S.dog = d && typeof d === 'object' ? { name: String(d.name || '').trim().slice(0, 24), coat: dogCoat(d.coat) } : null;
    if (!S.dog) S.dogBarkT = 0;
  }
  applyParty();

  function wagonTarget() {
    const L = S.L; if (!L) return 0;
    const k = L.k;
    if (S.view === 'stop' || S.view === 'hunt' || S.view === 'fish') return Math.max(112 * k, L.W * 0.3 - 86 * k);
    return L.W * 0.5 - 86 * k + (S.travel.pace === 'brisk' && S.travel.moving ? 14 * k : 0);
  }
  function placeParty() {
    const L = S.L, k = L.k, gy = L.gy, x = S.wagonX, P = S.partyPos;
    const set = (i, px, py, front, dir = 1) => { const p = P[i]; p.x = px; p.y = py; p.front = front; p.dir = dir; p.s = 1; };
    if (S.view === 'stop' && S.backdrop === 'camp' && S.piece) {
      const fx = S.piece.anchors.fireX;
      set(0, fx - 64 * k, gy + 16 * k, true, 1); set(1, fx + 64 * k, gy + 16 * k, true, -1); set(2, fx + 14 * k, gy - 4 * k, false, -1);
    } else if (S.view === 'stop') {
      // two chat in front of the lead pair, one waits by the tailgate
      set(0, x - 92 * k, gy + 14 * k, true, 1); set(1, x + 268 * k, gy + 15 * k, true, 1); set(2, x + 312 * k, gy + 17 * k, true, -1);
    } else {
      set(0, x - 92 * k, gy + 14 * k, true); set(1, x + 150 * k, gy - 7 * k, false); set(2, x + 262 * k, gy + 13 * k, true);
    }
    // the dog: by the fire at camp (sitting), with the party at a stop, trotting beside the team on the trail
    const D = S.dogPos;
    if (S.view === 'stop' && S.backdrop === 'camp' && S.piece) {
      D.x = S.piece.anchors.fireX - 120 * k; D.y = gy + 24 * k; D.dir = 1; D.sit = true; D.amp = 0;
    } else if (S.view === 'stop') {
      D.x = x + 206 * k; D.y = gy + 30 * k; D.dir = 1; D.sit = false; D.amp = 0;
    } else {
      const rolling = S.walkAmp > 0.05;
      D.x = x + 190 * k + (rolling && !S.rm ? Math.sin(S.t * 0.5) * 18 * k : 0); D.y = gy + 30 * k; D.dir = 1; D.sit = false; D.amp = rolling ? 1 : 0;
    }
  }
  // the dog is drawn on the trail, at the outdoor stops and in the derby (not in the post office, the hunt or fishing)
  function dogVisible() {
    if (!S.dog) return false;
    if (S.view === 'derby' || S.view === 'trail') return true;
    return S.view === 'stop' && S.backdrop !== 'post';
  }
  function bark() {
    S.dogBarkT = 0.7; S.barks++; S.lastBarkAt = S.t;
    emit({ type: 'bark' });
    requestDraw();
  }
  function spotted(c) {
    c.spotted = true;
    emit({ type: 'animalSpotted', animal: c.kind });
    if (dogVisible() && S.t - S.lastBarkAt > 1) bark();
  }

  // ---------------------------------------------------------------- per-frame update
  function update(dt) {
    const L = S.L, k = L.k, tr = S.travel;
    S.t += dt;
    if (S.wxMix < 1) S.wxMix = Math.min(1, S.wxMix + dt / (S.rm ? 0.5 : 1.5));
    S.fade = Math.max(0, S.fade - dt * (S.rm ? 4 : 2.5));
    // rolling
    const moving = S.view === 'trail' && !!tr.moving;
    const base = (tr.pace === 'brisk' ? 92 : 68) * (S.party.animal === 'mules' ? 1.1 : 1) * (tr.foodLow ? 0.7 : 1) * (tr.mood === 'tired' ? 0.85 : 1);
    S.speed = approach(S.speed, moving ? base * k : 0, 2.2, dt);
    if (!moving && S.speed < 0.5 * k) S.speed = 0;
    S.scroll += S.speed * dt;
    S.walkPh += (S.speed / k) * dt * 0.11;
    S.walkAmp = approach(S.walkAmp, S.speed > 3 * k ? 0.5 : 0, 6, dt);
    S.wheelSpin += (S.speed * dt) / (20 * k);
    S.wagonX = approach(S.wagonX, wagonTarget(), 2.5, dt);
    placeParty();
    // the stop on the horizon
    const kind = S.leg.stop && S.leg.stop.kind, miles = +S.leg.miles || 0;
    S.approach = (kind === 'landmark' || kind === 'fort' || kind === 'home') && miles > 0 ? clamp((tr.milesDone - (miles - APPROACH_MILES)) / APPROACH_MILES, 0, 1) : 0;
    // critters cross (the plain behind the trail drifts with the wagon at ~0.6 of the ground's speed)
    for (const c of S.critters) {
      c.x += c.dir * c.speed * k * dt - (c.sky ? 0 : S.speed * 0.6 * dt);
      c.ph += dt * c.gait * (S.rm ? 0.7 : 1);
      const mid = L.W * 0.5;
      if (!c.spotted && ((c.dir < 0 && c.x <= mid) || (c.dir > 0 && c.x >= mid))) spotted(c);
      const tail = c.x - c.dir * c.n * 46 * k;
      if ((c.dir < 0 && tail < -80 * k) || (c.dir > 0 && tail > L.W + 80 * k) || c.x < -900 * k || c.x > L.W + 900 * k) {
        c.gone = true;
        if (!c.spotted) spotted(c);
      }
    }
    if (S.critters.some((c) => c.gone)) S.critters = S.critters.filter((c) => !c.gone);
    S.cheerT = Math.max(0, S.cheerT - dt);
    S.dogBarkT = Math.max(0, S.dogBarkT - dt);
    S.dogPh += (S.speed / k) * dt * 0.085; // a two-frame trot: ~6 steps a second at the steady pace
    updateFx(S, dt);
    if (S.mini) {
      S.mini.update(L, dt);
      if (S.mini && S.mini.done) closeMini();
    }
  }

  // ---------------------------------------------------------------- loop
  function render() {
    if (!S.L || S.L.W < 2 || S.L.H < 2) return false;
    rebuild();
    drawFrame(ctx, S);
    if (!readySent) { readySent = true; queueMicrotask(() => { if (!destroyed) emit({ type: 'ready' }); }); }
    return true;
  }
  function frame(now) {
    if (!playing || destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    const t0 = performance.now();
    if (S.L) update(dt);
    const t1 = performance.now();
    render();
    const t2 = performance.now();
    perf.frames++; perf.update += t1 - t0; perf.draw += t2 - t1; perf.max = Math.max(perf.max, t2 - t0);
  }
  // when paused, changes still show (one draw on the next animation frame)
  function requestDraw() {
    if (playing || destroyed || drawQueued) return;
    drawQueued = requestAnimationFrame(() => { drawQueued = 0; if (!playing && !destroyed) { if (S.L) placeParty(); render(); } });
  }

  // ---------------------------------------------------------------- input (mini-games only)
  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * S.L.W) / Math.max(1, r.width), y: ((e.clientY - r.top) * S.L.H) / Math.max(1, r.height) };
  }
  const owns = () => !!S.mini && S.mini.input !== false;
  const onDown = (e) => {
    if (!owns() || !playing || destroyed) return;
    e.preventDefault();
    const p = toLocal(e);
    if (e.pointerType === 'mouse') S.mini.move(S.L, p.x, p.y); // the keyboard's aim line follows a mouse, not a finger
    S.mini.pointer(S.L, p.x, p.y);
  };
  const onMove = (e) => { if (owns() && playing && e.pointerType === 'mouse') { const p = toLocal(e); S.mini.move(S.L, p.x, p.y); } };
  const onKey = (e) => {
    if (!owns() || !playing || destroyed) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); if (!e.repeat) S.mini.key(S.L); }
  };
  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove);
  globalThis.addEventListener && globalThis.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- mini-games
  let savedTouch = '', touchTaken = false;
  function openMini(m) {
    if (S.mini) closeMini();
    S.mini = m;
    S.view = m.kind;
    S.fade = S.rm ? 0.5 : 1;
    S.wagonX = wagonTarget();
    if (m.input !== false) { savedTouch = canvas.style.touchAction; canvas.style.touchAction = 'none'; touchTaken = true; }
    requestDraw();
  }
  function closeMini() {
    S.mini = null;
    S.view = S.backdrop === 'trail' ? 'trail' : 'stop';
    S.fade = S.rm ? 0.5 : 1;
    S.wagonX = wagonTarget();
    if (touchTaken) { canvas.style.touchAction = savedTouch; touchTaken = false; }
    requestDraw();
  }
  const derbyHooks = { celebrate(kind) { if (S.L) { burst(S, kind); S.cheerT = 1.8; } } };

  // fonts may arrive after the first text sprites were cached (the wagon's name, the signs)
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (destroyed) return; clearTextSprites(); dirtyPiece = dirtyApproach = true; requestDraw(); }).catch(() => {});
  }

  // ---------------------------------------------------------------- the API
  const scene = {
    setLeg(leg) {
      if (!leg || typeof leg !== 'object') return;
      const biome = biomeOf(leg.biome);
      const stop = leg.stop && typeof leg.stop === 'object' ? leg.stop : { kind: leg.stop || 'landmark' };
      if (biome !== S.biome) dirtyLayers = true;
      S.leg = { id: String(leg.id || ''), biome, miles: +leg.miles || 0, stop, river: leg.river || null };
      S.biome = biome;
      dirtyPiece = dirtyApproach = true;
      requestDraw();
    },
    setParty(p) { applyParty(p || {}); requestDraw(); },
    setTravel(t) {
      if (!t || typeof t !== 'object') return;
      const tr = S.travel;
      if (t.milesDone != null && Number.isFinite(+t.milesDone)) tr.milesDone = +t.milesDone;
      if (t.pace) tr.pace = t.pace === 'brisk' ? 'brisk' : 'steady';
      if (t.rations) tr.rations = t.rations;
      if (t.mood) tr.mood = t.mood;
      if (t.foodLow != null) tr.foodLow = !!t.foodLow;
      if (t.moving != null) tr.moving = !!t.moving;
      if (t.weather) {
        const w = wxOf(t.weather);
        tr.weather = w;
        setVisualWeather();
      }
      requestDraw();
    },
    setBackdrop(b) {
      const next = BACKDROPS.includes(b) ? b : 'trail';
      if (next === S.backdrop) return;
      S.backdrop = next;
      if (!S.mini) { S.view = next === 'trail' ? 'trail' : 'stop'; S.fade = S.rm ? 0.5 : 1; S.wagonX = wagonTarget(); }
      dirtyPiece = true;
      setVisualWeather();
      requestDraw();
    },
    spotAnimal(kind) {
      const def = CRITTERS[kind];
      if (!def || !S.L) return false;
      const L = S.L, k = L.k;
      S.critters.push({
        kind, n: def.n, dir: def.dir, speed: def.speed, gait: def.gait, sky: def.sky, ph: Math.random() * 6, spotted: false,
        x: def.dir < 0 ? L.W + 60 * k : -60 * k,
        y: def.sky ? L.H * 0.24 : L.bands.ground[0] + L.H * 0.045, s: def.sky ? 0.9 * k : 0.62 * k,
      });
      return true;
    },
    celebrate(kind) {
      if (!S.L) return;
      const kd = kind === 'river' || kind === 'star' ? kind : 'arrived';
      burst(S, kd);
      S.cheerT = 1.8;
    },
    startHunt(o = {}) { openMini(createHunt(o, emit)); },
    startFish(o = {}) { openMini(createFish(o, emit, S.biome)); },
    endMiniGame() {
      if (!S.mini) return null;
      const sum = S.mini.summary();
      closeMini();
      return sum;
    },
    // ---- v1.1: Fort Derby
    startDerby(o = {}) { if (!destroyed) openMini(createDerby(o, emit, S, derbyHooks)); },
    derbyBurst(power) {
      if (!S.mini || S.mini.kind !== 'derby') return false;
      const ok = S.mini.burst(power);
      requestDraw();
      return ok;
    },
    endDerby() {
      if (!S.mini || S.mini.kind !== 'derby') return null;
      return scene.endMiniGame();
    },
    // ---- v1.1: the dog
    dogBark() {
      if (!S.dog || destroyed) return false;
      bark();
      return true;
    },
    play() {
      if (destroyed || playing) return;
      playing = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    pause() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    destroy() {
      if (destroyed) return;
      scene.pause();
      destroyed = true;
      if (drawQueued) cancelAnimationFrame(drawQueued);
      if (ro) ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      globalThis.removeEventListener && globalThis.removeEventListener('keydown', onKey);
      globalThis.removeEventListener && globalThis.removeEventListener('resize', onWinResize);
      if (S.mini && touchTaken) canvas.style.touchAction = savedTouch;
      S.mini = null; S.layers = null; S.piece = null; S.approachPiece = null;
    },
    resize,
    setReducedMotion(on) { S.rm = !!on; requestDraw(); },
    getState() {
      const tr = S.travel;
      return {
        backdrop: S.backdrop, milesDone: tr.milesDone, weather: tr.weather, moving: !!tr.moving,
        mini: S.mini ? S.mini.state() : null,
        biome: S.biome, legId: S.leg.id, pace: tr.pace, view: S.view, scroll: Math.round(S.scroll * 10) / 10,
        playing, reducedMotion: S.rm, dog: S.dog ? { name: S.dog.name, coat: S.dog.coat } : null,
      };
    },
    // ---- debug (not contract): the dev page and the smoke test
    debugStep(n = 1, draw = true) {
      if (!S.L || destroyed) return scene.getState();
      for (let i = 0; i < n; i++) update(1 / 60);
      if (draw) render();
      return scene.getState();
    },
    debugPerf(reset = false) {
      const out = { ...perf, avgUpdate: perf.update / Math.max(1, perf.frames), avgDraw: perf.draw / Math.max(1, perf.frames) };
      if (reset) { perf.frames = 0; perf.update = 0; perf.draw = 0; perf.max = 0; }
      return out;
    },
    debugInfo() {
      const L = S.L || {};
      return {
        W: L.W, H: L.H, dpr: L.dpr, k: L.k, canvasW: canvas.width, canvasH: canvas.height,
        speed: S.speed, wagonX: S.wagonX, wxCur: S.wxCur, wxMix: S.wxMix, critters: S.critters.map((c) => c.kind),
        piece: S.piece ? S.piece.kind : null, painting: S.piece && S.piece.painting ? S.piece.painting : null,
        paintingFor: paintingFor(S.leg.id), approach: S.approach, approachPainting: S.approachPiece ? S.approachPiece.painting : null,
        particles: { ...S.fx.drawn }, flashes: S.fx.flashes, layersBiome: S.layers ? S.layers.id : null, builds: perf.builds,
        party: S.party.looks.map((l) => l.hat), animal: S.party.animal, wagonName: S.party.wagon.name, fade: S.fade,
        dog: S.dog ? {
          ...S.dog, visible: dogVisible(), barking: S.dogBarkT > 0, barks: S.barks,
          x: S.view === 'derby' && S.mini ? S.mini.dogX : S.dogPos.x, y: S.view === 'derby' && S.mini ? S.mini.dogY : S.dogPos.y,
          pose: S.dogBarkT > 0 ? 'bark' : S.view === 'derby' ? 'run' : S.dogPos.sit ? 'sit' : S.dogPos.amp > 0 ? 'trot' : 'stand',
        } : null,
      };
    },
    debugMini() { return S.mini && S.L ? S.mini.debug(S.L) : null; },
  };
  function setVisualWeather() {
    let w = S.travel.weather;
    if (S.backdrop === 'camp' && w === 'clear') w = 'dusk'; // the camp is an evening scene
    if (w !== S.wxCur) {
      S.wxPrev = S.wxMix >= 0.5 ? S.wxCur : S.wxPrev;
      S.wxCur = w; S.wxMix = 0;
    }
  }

  resize();
  if (S.L) { S.wagonX = wagonTarget(); placeParty(); render(); }
  scene.play();
  return scene;
}

export { BACKDROPS, WEATHERS, BIOMES };
