// Wagon West fishing 2.0 (SPEC v1.4 §1.3 and §4.3, scene stream): the 1.0 cast-and-dip is the first half of each cast, then
// the FIGHT. A pool painted for the water (muddy brown for the Kansas and the Platte, clear for the creeks, blue-green
// for the Snake and the Columbia). Per cast: the cast, the wait (`cast.biteS`, sometimes a nibble first), the dip window
// (1.15 s, as 1.0): a tap hooks the fish, the line goes taut, and the fight is run by the JOURNEY's pure stepper: this
// file calls `fightStep(state, dtMs, down)` every frame with the pointer / Space state and draws what the state says (the
// line taut or calm, a yellow shiver when `state.warn`, a red wobble when `state.wobble`, the fish nearing the bank
// with `state.progress`, the reel turning while down). It never decides a fight itself. The sturgeon's `help` phase
// pops a companion's portrait (or the dog) by the bank; a tap on it, or Enter, calls `fightHelp`.
// `phase 'off'`: the fish flips and swims off ("IT WIGGLED OFF!"); the app asks castOff and calls scene.fishingRetry(i,
// fight) or not. `phase 'landed'`: it flops on the bank: "GOT ONE!" and the species. A junk cast has no wobbles: the boot
// dangles, the turtle snaps at the air and plops back, the bottle bobs up. The dog's cameo: a splash (the cast is reset)
// or a steal (after the landing: he runs off with the fish and brings it back, wet and proud).
// Nothing is ever lost and nothing snaps; no timer or countdown is drawn.
//
// Input (the mini-game owns the pointer and Space): a pointer down (or Space down) is "reel"; up is "let go".
// Events: { type: 'fishHook', i } · { type: 'fishMiss', i } · { type: 'fishPhase', i, phase } · { type: 'fishHelp', i } ·
// { type: 'fishHelped', i } · { type: 'fishOff', i } · { type: 'fishLand', i } · { type: 'fishCameo', i, kind } ·
// { type: 'fishingEnd', landed, casts }; sounds go out as { type: 'sfx', cue: 'splash' | 'reel' (on) | 'wobble' | 'snap' }.

// The fight stepper is the Journey stream's pure one (src/journey/fishing.js); this file only draws what its state says.
import { createFight, fightStep, fightHelp } from '../journey/fishing.js';
import { devSession } from './devSession.js';

import { TAU, OUT, mulberry32, clamp, lerp, ease, shade, mkCanvas, drawText, rrect } from './util.js';
import { BIOMES, biomeOf, paint } from './biomes.js';
import { drawPerson, personLook, drawDog } from './sprites.js';
import { drawSpecies, drawJunk, speciesOf, SPECIES, JUNK_NAMES, drawBear } from './sprites14.js';
import { drawSplash } from './sprites12.js';

// v1.7 the bear at the fishing hole: it walks in (T_BEAR_IN), the app asks, then it stays a while (T_BEAR_WAIT) and wanders off (T_BEAR_OUT); a new spot takes T_BEAR_MOVE
const T_BEAR_IN = 2.6, T_BEAR_WAIT = 3.4, T_BEAR_OUT = 2.4, T_BEAR_MOVE = 1.8, T_BEAR_AUTO = 25;
const T_CAST = 0.75, T_BITE = 1.15, T_LAND = 1.7, T_OFF = 1.5, T_AWAY = 1.0, T_SPLASH = 2.3, T_STEAL = 3.2, T_END = 1.0, T_HELP_AUTO = 9;
const WATER_LOOK = {
  kansas: { base: '#b79a68', mid: '#a98b5c', deep: '#97794d', ink: '#e8d6b0', clear: false },
  platte: { base: '#bba26f', mid: '#ad9363', deep: '#9a8156', ink: '#ecdcb8', clear: false },
  sweetwater: { base: '#6cb7a6', mid: '#5aa896', deep: '#4a9484', ink: '#d6f0e6', clear: true },
  creek: { base: '#62b8cc', mid: '#50a8be', deep: '#3f94ac', ink: '#dff6fb', clear: true },
  bear: { base: '#5cadc2', mid: '#4a9db4', deep: '#3a889f', ink: '#dbf3f9', clear: true },
  snake: { base: '#3797a2', mid: '#2c868f', deep: '#217480', ink: '#d2f0ee', clear: false },
  blue: { base: '#5db0bc', mid: '#4a9eab', deep: '#3a8b98', ink: '#dcf3f6', clear: true },
  columbia: { base: '#2f8aa0', mid: '#257890', deep: '#1c667c', ink: '#d0eaf0', clear: false },
  // v1.7: the v1.5 waters that had no look of their own (they fell back to the Kansas brown)
  bigblue: { base: '#b09a6c', mid: '#a28b5e', deep: '#907a4e', ink: '#e8d6b0', clear: false },
  green: { base: '#6bb4a2', mid: '#58a290', deep: '#47907e', ink: '#d9f1e8', clear: true },
  humboldt: { base: '#a9a070', mid: '#9a9264', deep: '#88804f', ink: '#e6e0b8', clear: false },
  truckee: { base: '#5fb2cc', mid: '#4ba2bc', deep: '#3a8ea8', ink: '#dff4fb', clear: true },
  sacramento: { base: '#6f9a78', mid: '#5f8a68', deep: '#4f7a58', ink: '#dbeedd', clear: false },
  willamette: { base: '#5a9c8c', mid: '#4a8c7c', deep: '#3a7a6a', ink: '#d6efe6', clear: false },
  umpqua: { base: '#58b0a4', mid: '#469e92', deep: '#388c80', ink: '#d8f3ee', clear: true },
  rogue: { base: '#4fb2b8', mid: '#3ea2a8', deep: '#2f9096', ink: '#d6f4f4', clear: true },
};
const BASE_S = { 'channel-catfish': 1.25, 'hornyhead-chub': 1.4, 'cutthroat-trout': 1.3, 'white-sturgeon': 1.2, 'redband-trout': 1.3, 'chinook-salmon': 1.32,
  'mountain-whitefish': 1.3, 'northern-pikeminnow': 1.25, 'largescale-sucker': 1.25, 'green-sunfish': 1.7, 'sacramento-perch': 1.6 };

export function createFishing(opts, emit, S, hooks, biomeId) {
  const o = opts || {};
  const seed = (Number.isFinite(+o.seed) ? +o.seed : 1) >>> 0;
  const water = WATER_LOOK[o.water] ? o.water : 'kansas';
  const look = WATER_LOOK[water];
  const sess = Array.isArray(o.casts) ? { casts: o.casts } : devSession({ seed, water, bait: o.bait || 'worms', casts: Math.max(1, Math.min(12, Math.round(+o.casts || 4))), junkAt: o.junkAt == null ? -1 : o.junkAt, forceSpecies: o.forceSpecies || null });
  const casts = sess.casts.slice(0, 24);
  const N = casts.length;
  const cameo = o.cameo && typeof o.cameo === 'object' ? { at: o.cameo.at | 0, kind: o.cameo.kind === 'steal' ? 'steal' : 'splash', done: false } : null;
  const helper = o.helper && typeof o.helper === 'object' ? o.helper : null;
  const bear = o.bear && typeof o.bear === 'object' ? { at: o.bear.at | 0, kind: o.bear.kind === 'berries' ? 'berries' : 'fishing', done: false } : null;
  const wantDog = !!o.dog && !!(hooks && hooks.hasDog && hooks.hasDog());
  const rand = mulberry32((seed ^ 0xf15c) >>> 0 || 1);
  const pal = BIOMES[biomeOf(biomeId)];
  const sfx = (cue, ex) => { if (hooks && hooks.sfx) hooks.sfx(cue, ex); };
  const helperLook = helper ? personLook(helper.id, helper.color, helper.hat) : null;

  const F = {
    kind: 'fishing', view: 'fish', showDog: false, N, ci: 0, phase: 'cast', pt: 0, t: 0, waitT: 2, nibbleAt: -1, nibbled: false,
    cur: null, fs: null, fight: null, ptr: false, keyDown: false, lastDown: false, lastFish: null,
    landed: 0, lb: 0, retried: {}, retryFight: null, helpT: 0, spin: 0, wobFlash: 0,
    texts: [], rings: [], splashes: [], hintCool: 0, firstFight: true, offPos: null, landPos: null,
    ended: false, done: false, bg: null, bgKey: '', cameoT: 0, cameoPhase: '',
    rod: { b: 0.22, v: 0 }, bearStage: null, bt: 0, barked: false, spot: 0, scatter: [],
  };
  const lenOf = (c) => { const sp = speciesOf(c.species); return sp; };

  function newCast(keepFight) {
    const c = casts[F.ci];
    const r = mulberry32((seed * 31 + F.ci * 977 + 5) >>> 0 || 1);
    F.cur = { c, u: 0.5 + r() * 0.28, v: 0.66 + r() * 0.14, fight: keepFight || c.fight };
    if (F.spot > 0) { F.cur.u = 0.34 + ((F.spot * 0.37 + r() * 0.1) % 0.4); F.cur.v = 0.68 + ((F.spot * 0.11) % 0.1); }      // a new pool (after the bear)
    F.waitT = Math.max(0.4, +c.biteS || 2);
    F.nibbleAt = r() < 0.6 ? F.waitT * (0.3 + r() * 0.35) : -1;
    F.nibbled = false; F.fs = null; F.phase = 'cast'; F.pt = 0; F.lastFish = null;
  }
  newCast();

  const tip = (L) => ({ x: L.W * 0.27, y: L.H * 0.36 });
  const bobPos = (L) => ({ x: F.cur.u * L.W, y: F.cur.v * L.H });
  const nearPos = (L) => ({ x: L.W * 0.31, y: L.H * 0.79 });
  const bankPos = (L) => ({ x: L.W * 0.18, y: L.H * 0.875 });
  const dogHome = (L) => ({ x: L.W * 0.315, y: L.H * 0.96 });
  const hasFight = () => F.phase === 'fight' && F.fs;

  function text(L, s, sub, x, y, col = '#ffd23f', sub2 = '') { F.texts.push({ text: s, sub, sub2, x: clamp(x, 110 * L.k, L.W - 110 * L.k), y, col, t: 0 }); }
  function ring(x, y, d = 0) { F.rings.push({ x, y, t: -d }); }
  function splash(x, y, r) { F.splashes.push({ x, y, r, t: 0 }); }
  function nextOrEnd() {
    F.ci++;
    if (F.ci >= N) { F.phase = 'end'; F.pt = 0; F.fs = null; } else newCast();
  }

  // ---- input
  function callHelp() {
    if (!hasFight() || F.fs.phase !== 'help') return false;
    F.fs = fightHelp(F.fs);
    emit({ type: 'fishHelped', i: F.ci });
    emit({ type: 'fishPhase', i: F.ci, phase: F.fs.phase });
    sfx('splash');
    return true;
  }
  function tap(L) {
    if (F.ended) return false;
    if (F.phase === 'bite') {
      F.phase = 'fight'; F.pt = 0; F.fs = createFight(F.cur.fight); F.fight = F.fs;
      const b = bobPos(L);
      ring(b.x, b.y); ring(b.x, b.y, 0.12); splash(b.x, b.y, 22 * L.k);
      sfx('splash');
      emit({ type: 'fishHook', i: F.ci });
      emit({ type: 'fishPhase', i: F.ci, phase: 'reel' });
      return true;
    }
    if (F.phase === 'fight') return F.fs.phase === 'help' ? callHelp() : false;
    if ((F.phase === 'wait' || F.phase === 'cast') && F.hintCool <= 0) {
      const b = bobPos(L);
      text(L, 'WAIT FOR THE DIP!', '', b.x, b.y - 60 * L.k, '#ffffff');
      F.hintCool = 1.2;
    }
    return false;
  }
  F.pointer = (L) => { F.ptr = true; return tap(L); };
  F.key = (L) => { F.keyDown = true; return tap(L); };
  F.keyUp = (L, name) => { if (name === 'space') F.keyDown = false; };
  F.enter = () => callHelp();
  F.drag = () => {};
  F.release = () => { F.ptr = false; F.keyDown = false; };
  F.move = () => {};
  F.callHelp = () => callHelp();
  // the app's answer to fishOff: the same cast again with a new fight (once a cast); true while the cast is waiting
  F.retry = (i, fight) => {
    if (F.phase !== 'off' || i !== F.ci || F.retried[i] || !fight) return false;
    F.retried[i] = true; F.retryFight = fight;
    return true;
  };

  // ---- the bear (v1.7): the app answers fishBear 'ask' with 'wait' or 'spot'
  F.bearChoice = (choice) => {
    if (F.phase !== 'bear' || F.bearStage !== 'ask') return false;
    F.bearStage = choice === 'spot' ? 'move' : 'wait'; F.bt = 0;
    emit({ type: 'fishBear', i: F.ci, stage: F.bearStage, kind: bear.kind });
    return true;
  };
  function bearResume(moved) {
    const kind = bear.kind;
    F.bearStage = null; F.bt = 0; F.scatter = [];
    if (moved) F.spot++;
    F.phase = 'cast'; newCast(F.cur.fight);
    emit({ type: 'fishBear', i: F.ci, stage: 'gone', moved: !!moved, kind });
  }
  // ---- the rod: how far it bends (0 straight … 1 deeply bent) for this moment
  function rodTarget() {
    const fs = F.fs, ph = F.phase;
    if (ph === 'fight' && fs) {
      const c = F.cur.c, frac = c.kind === 'fish' ? clamp(0.25 + (+c.lb || 3) / 16, 0.3, 1) : 0.3;      // a bigger fish bends it more
      const down = F.ptr || F.keyDown;
      return (down ? 0.56 + 0.4 * frac : 0.42 + 0.34 * frac) + (fs.wobble ? 0.07 : 0);
    }
    if (ph === 'bite') return 0.3;
    if (ph === 'land' || ph === 'off') return 0;                 // it springs back straight
    return 0.22;                                                  // a gentle bend at rest
  }
  const MAXA = 1.55;
  // the rod as a curve from the hand: an angle that grows along it (more bend toward the tip); a tremble (yellow) and a hard quiver (red) ride on top
  function rodShape(L, t, rm) {
    const k = L.k, hx = L.W * 0.06, hy = L.H + 6 * k, tp0 = tip(L);
    const len = Math.hypot(tp0.x - hx, tp0.y - hy), a0 = Math.atan2(tp0.y - hy, tp0.x - hx) - 0.22 * MAXA * 0.5;
    const fs = F.fs, hook = F.phase === 'fight' && fs;
    let shake = 0;
    if (!rm && hook) { if (fs.wobble) shake = Math.sin(t * 55) * 0.075 + Math.sin(t * 37) * 0.04; else if (fs.warn) shake = Math.sin(t * 46) * 0.022; }
    const bend = F.rod.b + shake, N = 20, pts = [{ x: hx, y: hy, s: 0 }];
    let x = hx, y = hy;
    for (let i = 1; i <= N; i++) {
      const s = i / N, a = a0 + bend * MAXA * Math.pow(s, 1.6) * 0.62;
      x += Math.cos(a) * (len / N); y += Math.sin(a) * (len / N); pts.push({ x, y, s });
    }
    return { pts, tip: { x, y }, hx, hy };
  }
  F.rodState = (L) => { const r = rodShape(L, F.t, S.rm); return { bend: F.rod.b, target: rodTarget(), tip: r.tip, rest: tip(L) }; };

  // ---- update
  function stepFight(L, dt) {
    const down = F.ptr || F.keyDown;
    if (down !== F.lastDown) { F.lastDown = down; sfx('reel', { on: down }); }
    const prev = F.fs;
    F.fs = fightStep(prev, dt * 1000, down);
    F.fight = F.fs;
    if (down && F.fs.phase === 'reel') F.spin += dt * 14;
    if (F.fs.wobble && !prev.wobble) { sfx('wobble'); F.wobFlash = 1; }
    if (F.fs.phase === 'help' && prev.phase !== 'help') {
      F.helpT = 0;
      emit({ type: 'fishPhase', i: F.ci, phase: 'help' });
      emit({ type: 'fishHelp', i: F.ci });
    }
    if (F.fs.phase === 'help') { F.helpT += dt; if (F.helpT > T_HELP_AUTO) callHelp(); }
    if (F.fs.phase === 'off' && prev.phase !== 'off') {
      const fp = fishPos(L);
      F.offPos = { x: fp.x, y: fp.y, rot: fp.rot };
      F.phase = 'off'; F.pt = 0; F.firstFight = false;
      splash(fp.x, fp.y, 26 * L.k); sfx('splash');
      text(L, 'IT WIGGLED OFF!', 'CAST AGAIN', L.W * 0.5, L.H * 0.4, '#ffffff');
      emit({ type: 'fishPhase', i: F.ci, phase: 'off' });
      emit({ type: 'fishOff', i: F.ci });
    } else if (F.fs.phase === 'landed' && prev.phase !== 'landed') {
      const fp = fishPos(L);
      F.landPos = { x: fp.x, y: fp.y };
      F.phase = 'land'; F.pt = 0; F.landed++; F.firstFight = false;
      const c = F.cur.c;
      if (c.kind === 'fish') F.lb += +c.lb || 0;
      splash(fp.x, fp.y, 26 * L.k); sfx('splash');
      const bk = bankPos(L);
      if (c.kind === 'junk') text(L, JUNK_NAMES[c.junk] || 'A SURPRISE!', c.junk === 'turtle' ? 'LET IT GO!' : 'A LAUGH!', L.W * 0.5, L.H * 0.36, '#ffd23f');
      else text(L, 'GOT ONE!', speciesOf(c.species).name, L.W * 0.5, L.H * 0.34, '#ffd23f', c.lengthIn ? c.lengthIn + ' INCHES' : '');
      void bk;
      emit({ type: 'fishPhase', i: F.ci, phase: 'landed' });
      emit({ type: 'fishLand', i: F.ci });
      if (c.junk === 'turtle') sfx('snap');
    }
  }
  F.update = (L, dt) => {
    F.t += dt; F.pt += dt; F.hintCool -= dt; F.wobFlash = Math.max(0, F.wobFlash - dt * 2.5);
    const b = bobPos(L);
    const ph = F.phase;
    if (ph === 'cast') {
      if (F.pt >= T_CAST) { F.phase = 'wait'; F.pt = 0; ring(b.x, b.y); }
    } else if (ph === 'wait') {
      if (F.nibbleAt > 0 && F.pt >= F.nibbleAt && !F.nibbled) { F.nibbled = true; ring(b.x, b.y); }
      if (bear && !bear.done && F.ci === bear.at && F.pt >= F.waitT * 0.4) {
        bear.done = true; F.phase = 'bear'; F.bt = 0; F.bearStage = 'arrive'; F.barked = false;
        const sp = speciesOf(F.cur.c.species), tp0 = bobPos(L); void sp;
        for (let i = 0; i < 5; i++) F.scatter.push({ x: tp0.x + (i - 2) * 14 * L.k, y: tp0.y + 6 * L.k, a: (i - 2) * 0.5 + (i % 2 ? 0.2 : -0.2), t: 0 });
        for (let i = 0; i < 3; i++) ring(tp0.x + (i - 1) * 10 * L.k, tp0.y, i * 0.1);
        text(L, 'A BEAR!', 'FAR ACROSS THE WATER', L.W * 0.5, L.H * 0.3, '#ffd23f');
        sfx('splash');
        emit({ type: 'fishBear', i: F.ci, stage: 'arrive', kind: bear.kind });
      } else if (cameo && !cameo.done && cameo.kind === 'splash' && wantDog && F.ci === cameo.at && F.pt >= F.waitT * 0.45) {
        cameo.done = true; F.phase = 'splash'; F.pt = 0;
        emit({ type: 'fishCameo', i: F.ci, kind: 'splash' });
      } else if (F.pt >= F.waitT) { F.phase = 'bite'; F.pt = 0; F.nibbled = false; ring(b.x, b.y); ring(b.x, b.y, 0.15); }
    } else if (ph === 'bear') {
      F.bt += dt;
      const st = F.bearStage;
      if (st === 'arrive') {
        if (F.bt >= 1.0 && !F.barked) { F.barked = true; if (wantDog) { if (hooks && hooks.bark) hooks.bark(); const dh = dogHome(L); text(L, 'WOOF!', '', dh.x + 30 * L.k, dh.y - 70 * L.k, '#ffffff'); } }
        if (F.bt >= T_BEAR_IN) { F.bearStage = 'ask'; F.bt = 0; emit({ type: 'fishBear', i: F.ci, stage: 'ask', kind: bear.kind }); }
      } else if (st === 'ask') { if (F.bt >= T_BEAR_AUTO) F.bearChoice('wait'); }
      else if (st === 'wait') { if (F.bt >= T_BEAR_WAIT) { F.bearStage = 'leave'; F.bt = 0; emit({ type: 'fishBear', i: F.ci, stage: 'leave', kind: bear.kind }); } }
      else if (st === 'leave') { if (F.bt >= T_BEAR_OUT) bearResume(false); }
      else if (st === 'move') { if (F.bt >= T_BEAR_MOVE) bearResume(true); }
    } else if (ph === 'splash') {
      if (F.pt >= 0.78 && !F.splashed) { F.splashed = true; splash(b.x, b.y, 34 * L.k); ring(b.x, b.y); ring(b.x, b.y, 0.2); sfx('splash'); text(L, 'SPLASH!', 'THE DOG JUMPED IN!', b.x, b.y - 70 * L.k, '#ffffff'); }
      if (F.pt >= T_SPLASH) { F.splashed = false; F.phase = 'cast'; F.pt = 0; }   // the cast is reset, free
    } else if (ph === 'bite') {
      if (F.pt >= T_BITE) {
        F.phase = 'away'; F.pt = 0;
        text(L, 'IT SWAM OFF!', 'NEXT CAST', b.x, b.y - 70 * L.k, '#ffffff');
        emit({ type: 'fishMiss', i: F.ci });
      }
    } else if (ph === 'fight') {
      stepFight(L, dt);
    } else if (ph === 'land') {
      const c = F.cur.c;
      if (F.pt >= T_LAND) {
        if (cameo && !cameo.done && cameo.kind === 'steal' && wantDog && F.ci === cameo.at && c.kind === 'fish') {
          cameo.done = true; F.phase = 'steal'; F.pt = 0;
          emit({ type: 'fishCameo', i: F.ci, kind: 'steal' });
        } else nextOrEnd();
      }
    } else if (ph === 'steal') {
      if (F.pt >= 2.05 && !F.stolen) { F.stolen = true; text(L, 'GOOD DOG!', 'THE FISH IS BACK, WET AND PROUD', L.W * 0.5, L.H * 0.4, '#ffd23f'); }
      if (F.pt >= T_STEAL) { F.stolen = false; nextOrEnd(); }
    } else if (ph === 'off') {
      if (F.pt >= T_OFF) {
        if (F.retryFight) { const f = F.retryFight; F.retryFight = null; newCast(f); } else nextOrEnd();
      }
    } else if (ph === 'away') {
      if (F.pt >= T_AWAY) nextOrEnd();
    } else if (ph === 'end' && F.pt >= T_END && !F.ended) {
      F.ended = true; F.done = true;
      emit({ type: 'fishingEnd', landed: F.landed, casts: N });
    }
    // the rod: a spring toward the bend the moment asks for; it overshoots a little when the fish lets go (a spring-back), none under reduced motion
    const rt = rodTarget();
    if (S.rm) { F.rod.b = rt; F.rod.v = 0; }
    else { const h2 = Math.min(dt, 0.03); F.rod.v += ((rt - F.rod.b) * 150 - F.rod.v * 8.5) * h2; F.rod.b += F.rod.v * h2; }
    for (const q of F.scatter) q.t += dt;
    F.scatter = F.scatter.filter((q) => q.t < 1.5);
    for (const r of F.rings) r.t += dt;
    F.rings = F.rings.filter((r) => r.t < 1);
    for (const s of F.splashes) s.t += dt;
    F.splashes = F.splashes.filter((s) => s.t < 0.9);
    for (const tx of F.texts) tx.t += dt;
    F.texts = F.texts.filter((tx) => tx.t < 1.9);
  };

  // ---- the fish's place while it fights: from the bobber toward the bank
  function fishScale(L, c) {
    const sp = speciesOf(c.species);
    const frac = clamp(c.lengthIn ? (c.lengthIn - sp.lo) / Math.max(1, sp.hi - sp.lo) : 0.5, 0, 1);
    return L.k * (0.8 + 0.45 * frac) * (BASE_S[c.species] || 1.25) * Math.min(1, (L.W * 0.5) / (sp.len * 1.6 * L.k * 1.25));
  }
  function fishPos(L) {
    const b = bobPos(L), n = nearPos(L), fs = F.fs, p = fs ? fs.progress : 0, k = L.k;
    const e = ease(clamp(p, 0, 1));
    const thr = fs && fs.wobble && !S.rm ? 1 : 0;
    const x = lerp(b.x, n.x, e) + Math.sin(F.t * 38) * 6 * k * thr + Math.sin(F.t * 2.1) * 6 * k * (1 - e);
    const y = lerp(b.y, n.y, e) + Math.sin(F.t * 3.3) * 4 * k + Math.cos(F.t * 31) * 3 * k * thr;
    return { x, y, rot: Math.sin(F.t * 29) * 0.38 * thr + Math.sin(F.t * 2.4) * 0.12 };
  }

  // ---- the pool (painted once per size and water)
  function background(L) {
    const key = L.W + 'x' + L.H + '@' + L.dpr + water;
    if (F.bg && F.bgKey === key) return F.bg;
    const { W, H, k, dpr } = L;
    const y0 = H * 0.52;
    const cv = mkCanvas(W * dpr, (H - y0 + 2) * dpr), c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, -y0 * dpr);
    c.fillStyle = look.base; c.fillRect(0, y0, W, H - y0);
    c.fillStyle = look.mid; c.fillRect(0, y0 + (H - y0) * 0.35, W, (H - y0) * 0.65);
    c.fillStyle = look.deep; c.fillRect(0, y0 + (H - y0) * 0.7, W, (H - y0) * 0.3);
    const r = mulberry32(99);
    c.beginPath(); for (let i = 0; i < 26; i++) { const x = r() * W, y = y0 + 10 * k + r() * (H - y0 - 20 * k); c.moveTo(x, y); c.lineTo(x + (10 + r() * 20) * k, y); }
    c.lineWidth = 2 * k; c.strokeStyle = shade(look.ink, -0.05); c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1;
    if (look.clear) { // stones on the bottom of a clear creek
      for (let i = 0; i < 9; i++) { const x = r() * W, y = y0 + (H - y0) * (0.45 + r() * 0.5); c.beginPath(); c.ellipse(x, y, (10 + r() * 14) * k, (5 + r() * 6) * k, 0, 0, TAU); c.fillStyle = shade(look.deep, 0.12); c.fill(); }
    }
    // far bank
    c.beginPath(); c.moveTo(0, y0 + 6 * k); for (let x = 0; x <= W; x += 10) c.lineTo(x, y0 + 4 * k + Math.sin(x * 0.03) * 3 * k); c.lineTo(W, y0 - 2); c.lineTo(0, y0 - 2); c.closePath();
    c.fillStyle = pal.near; c.fill(); c.lineWidth = 2; c.strokeStyle = shade(pal.near, -0.35); c.stroke();
    for (let i = 0; i < 12; i++) paint.grass(c, r() * W, y0 + 8 * k, (12 + r() * 10) * k, '#4f7a3a', 2.2 * k);
    if (['columbia', 'blue', 'creek', 'bear', 'green', 'truckee', 'willamette', 'umpqua', 'rogue'].includes(water)) for (let i = 0; i < 7; i++) paint.pine(c, (i + 0.5) * (W / 7) + (r() - 0.5) * 30 * k, y0 + 6 * k, (22 + r() * 8) * k, (34 + r() * 24) * k, '#2f6a3a', OUT, 2 * k);
    // the near bank (bottom left) and cattails
    c.beginPath(); c.moveTo(0, H + 2); c.lineTo(0, H * 0.8); c.quadraticCurveTo(W * 0.2, H * 0.78, W * 0.34, H + 2); c.closePath();
    c.fillStyle = pal.ground; c.fill(); c.lineWidth = 2.4; c.strokeStyle = shade(pal.ground, -0.4); c.stroke();
    for (let i = 0; i < 6; i++) {
      const x = W * (0.33 + i * 0.012) + (i % 2) * 6 * k, y = H - 4 * k, h = (46 + (i % 3) * 12) * k;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3 * k, y - h * 0.5, x + (i - 2) * 2 * k, y - h); c.lineWidth = 2.4 * k; c.strokeStyle = '#4f7a3a'; c.stroke();
      if (i % 2 === 0) { c.beginPath(); c.ellipse(x + (i - 2) * 2 * k, y - h + 6 * k, 3.2 * k, 8 * k, 0, 0, TAU); c.fillStyle = '#7a4a26'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke(); }
    }
    for (let i = 0; i < 4; i++) paint.grass(c, W * (0.04 + i * 0.07), H, 24 * k, shade(pal.near, 0.05), 3 * k);
    F.bg = { cv, y0 }; F.bgKey = key;
    return F.bg;
  }
  F.drawBackground = (c, L) => { const bg = background(L); c.drawImage(bg.cv, 0, bg.y0, L.W, L.H - bg.y0 + 2); };

  // ---- the helper's portrait (or the dog) by the bank: a 96 px target
  function helpSpot(L) { return { x: L.W * 0.17, y: L.H * 0.6, r: Math.max(48, 48 * L.k) }; }
  function drawPortrait(c, L, t, rm) {
    const hs = helpSpot(L), k = L.k, pop = ease(clamp(F.helpT / 0.35, 0, 1));
    const bob = rm ? 0 : Math.sin(t * 5) * 3 * k;
    const x = hs.x, y = hs.y + bob + (1 - pop) * 60 * k, r = hs.r * (0.6 + 0.4 * pop);
    // a pulsing ring says "tap me"
    if (!rm) { const q = (t * 1.6) % 1; c.globalAlpha = (1 - q) * 0.8; c.beginPath(); c.arc(x, y, r * (1.05 + q * 0.5), 0, TAU); c.lineWidth = 4 * k; c.strokeStyle = '#ffffff'; c.stroke(); c.globalAlpha = 1; }
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.fillStyle = '#ffe9b8'; c.fillRect(x - r, y - r, r * 2, r * 2);
    if (helperLook) drawPerson(c, x, y + r * 0.98, r / 40, helperLook, 0, 0, 0, 1);
    else drawDog(c, x - r * 0.1, y + r * 0.7, r / 24, S.dog ? S.dog.coat : 'brown', 0, 0, t, 0, 1, true, 0);
    c.restore();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.lineWidth = 4 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(x, y, r - 2 * k, 0, TAU); c.lineWidth = 2.4 * k; c.strokeStyle = '#ffffff'; c.stroke();
    drawText(c, 'A BIG ONE!', 17 * k, x, y - r - 22 * k, '#ffd23f', OUT, L.W * 0.4);
    drawText(c, helperLook ? 'TAP FOR HELP!' : 'TAP: THE DOG HELPS!', 13 * k, x, y + r + 20 * k, '#ffffff', OUT, L.W * 0.44);
  }

  // ---- the dog (cameos, and the help phase when there is no companion)
  function drawCameoDog(c, L, t) {
    if (!wantDog) return;
    const k = L.k, home = dogHome(L), ds = k * 1.2, coat = S.dog ? S.dog.coat : 'brown';
    const mud = S.dog && S.dog.muddy ? 1 : 0;
    let x = home.x, y = home.y, dir = -1, sit = true, amp = 0, ph = t * 7, fish = null, hide = false;
    if (F.phase === 'splash') {
      const b = bobPos(L), p = F.pt;
      if (p < 0.78) { const u = ease(p / 0.78); x = lerp(home.x, b.x, u); y = lerp(home.y, b.y, u) - Math.sin(Math.PI * u) * 90 * k; sit = false; amp = 1; dir = x < b.x ? 1 : -1; }
      else if (p < 1.5) { x = b.x + Math.sin(t * 6) * 2 * k; y = b.y + 8 * k; sit = false; amp = 0; dir = -1; }
      else if (p < T_SPLASH - 0.15) { const u = ease((p - 1.5) / (T_SPLASH - 1.65)); x = lerp(b.x, home.x, u); y = lerp(b.y + 8 * k, home.y, u); sit = false; amp = 1; dir = -1; }
    } else if (F.phase === 'steal') {
      const fp = bankPos(L), p = F.pt, off = L.W + 120 * k;
      sit = false; amp = 1;
      if (p < 0.6) { const u = ease(p / 0.6); x = lerp(home.x, fp.x + 40 * k, u); y = lerp(home.y, fp.y + 20 * k, u); dir = -1; }
      else if (p < 1.5) { const u = ease((p - 0.6) / 0.9); x = lerp(fp.x + 40 * k, off, u); y = fp.y + 20 * k; dir = 1; fish = true; }
      else if (p < 2.0) { x = off; y = fp.y + 20 * k; hide = true; }
      else if (p < 2.9) { const u = ease((p - 2.0) / 0.9); x = lerp(off, fp.x + 40 * k, u); y = fp.y + 20 * k; dir = -1; fish = true; }
      else { x = lerp(fp.x + 40 * k, home.x, ease((p - 2.9) / 0.3)); y = lerp(fp.y + 20 * k, home.y, ease((p - 2.9) / 0.3)); dir = -1; }
    } else if (F.phase === 'fight' && F.fs && F.fs.phase === 'help' && !helper) { hide = true; }
    if (hide) return;
    const wet = F.phase === 'splash' && F.pt >= 0.78;
    c.save();
    if (wet && F.pt < T_SPLASH - 0.15) { const b = bobPos(L); c.beginPath(); c.rect(0, 0, L.W, b.y + 10 * k); c.clip(); }   // swimming: the water hides his legs
    drawDog(c, x, y, ds, coat, ph, amp, t, F.phase === 'steal' && F.pt > 0.55 && F.pt < 0.7 ? 0.5 : 0, dir, sit, mud);
    if (fish) drawSpecies(c, F.cur.c.species, x + dir * 20 * ds, y - 20 * ds, fishScale(L, F.cur.c) * 0.35, dir > 0 ? 0.2 : -0.2, t * 12, -dir);
    c.restore();
    if (wet && F.phase === 'splash' && F.pt >= T_SPLASH - 0.15) { /* back on the bank */ }
  }

  F.draw = (c, L, t, rm) => {
    const k = L.k, b = bobPos(L), ph = F.phase;
    const rod = rodShape(L, t, rm), tp = rod.tip;                 // the line starts at the bent tip
    const fs = F.fs, hook = ph === 'fight' && fs;
    const cur = F.cur.c;
    // ripples and splashes
    for (const r of F.rings) {
      if (r.t < 0) continue;
      c.globalAlpha = clamp(1 - r.t, 0, 1) * 0.8;
      c.beginPath(); c.ellipse(r.x, r.y + 2 * k, (8 + r.t * 46) * k, (3 + r.t * 14) * k, 0, 0, TAU);
      c.lineWidth = 2 * k; c.strokeStyle = '#ffffff'; c.stroke();
    }
    for (const s of F.splashes) { c.globalAlpha = clamp(1 - s.t / 0.9, 0, 1); drawSplash(c, s.x, s.y, s.r, s.t / 0.9); }
    c.globalAlpha = 1;
    if (F.phase === 'bear') drawBearScene(c, L, t, rm);
    // where the bobber is this frame (the 1.0 look)
    let bx = b.x, by = b.y, under = 0;
    if (ph === 'cast') { const p = ease(F.pt / T_CAST); bx = tp.x + (b.x - tp.x) * p; by = tp.y + (b.y - tp.y) * p - Math.sin(Math.PI * p) * 70 * k; }
    else if (ph === 'wait' || ph === 'splash') { by += Math.sin(t * 3) * (rm ? 0.6 : 1.6) * k; if (F.nibbled && F.pt - F.nibbleAt < 0.3) by += 3 * k; }
    else if (ph === 'bite') { under = Math.min(1, F.pt / 0.12); by += under * 7 * k + Math.sin(t * 30) * (rm ? 0.5 : 1.5) * k; }
    else if (ph === 'away') by += Math.max(0, 1 - F.pt * 3) * 6 * k;
    const showBob = ph === 'cast' || ph === 'wait' || ph === 'bite' || ph === 'away' || ph === 'splash' || ph === 'bear';
    // the fish on the line (during the fight) and its state
    let fp = null, state = 'calm';
    if (hook) { fp = fishPos(L); state = fs.wobble ? 'wobble' : fs.warn ? 'warn' : 'calm'; }
    // the rod: a curve from the hand that bends with the fight (rodShape / rodTarget): a gentle bend at rest, deep while reeling a hooked fish (more for a
    // bigger one), a tremble on the yellow, a hard quiver on the red, and it springs back straight when the fish lands or wiggles off
    const bend = 0, down = F.ptr || F.keyDown;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const wAt = (sv) => (9.4 - 6.2 * sv) * k;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < rod.pts.length; i++) {
        const a = rod.pts[i - 1], q = rod.pts[i];
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(q.x, q.y);
        c.lineWidth = pass ? wAt(q.s) : wAt(q.s) + 3.4 * k; c.strokeStyle = pass ? (i % 5 === 0 ? '#c98a4a' : '#a0612b') : OUT; c.stroke();
      }
    }
    for (const sv of [0.4, 0.62, 0.84]) {                                  // the line guides
      const q = rod.pts[Math.round(sv * (rod.pts.length - 1))];
      c.beginPath(); c.arc(q.x, q.y - 3.4 * k, 2 * k, 0, TAU); c.lineWidth = 1.4 * k; c.strokeStyle = OUT; c.stroke();
    }
    // the reel (it turns while you hold)
    const rq = rod.pts[3], rx = rq.x, ry = rq.y;
    c.beginPath(); c.arc(rx, ry, 8 * k, 0, TAU); c.fillStyle = '#8f9aa6'; c.fill(); c.lineWidth = 1.8 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); for (let i = 0; i < 3; i++) { const a = F.spin + i * TAU / 3; c.moveTo(rx, ry); c.lineTo(rx + Math.cos(a) * 7 * k, ry + Math.sin(a) * 7 * k); } c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
    c.lineJoin = 'miter';
    // the line
    let ex = bx, ey = by;
    const lineCol = state === 'wobble' ? '#ff3b30' : state === 'warn' ? '#ffd23f' : 'rgba(255,255,255,0.92)';
    if (hook && fp) {
      const sp = speciesOf(cur.species), fsC = cur.kind === 'fish' ? fishScale(L, cur) : k * 1.3;
      const mouthX = fp.x - (cur.kind === 'fish' ? sp.len * 0.42 * fsC : 14 * k), mouthY = fp.y;
      const jit = state === 'wobble' && !rm ? 4 * k : state === 'warn' && !rm ? 2 * k : 0;
      const taut = down || state === 'wobble';
      const sag = taut ? 2 * k : 14 * k;
      const w = (state === 'wobble' ? 3.6 : state === 'warn' ? 2.6 : 1.8) * k;
      for (let pass = 0; pass < (jit ? 2 : 1); pass++) {
        const o2 = pass ? 1 : 0;
        c.beginPath(); c.moveTo(tp.x, tp.y + bend);
        c.quadraticCurveTo((tp.x + mouthX) / 2 + Math.sin(t * 44 + pass) * jit, (tp.y + mouthY) / 2 + sag + Math.cos(t * 37 + pass) * jit * 0.6, mouthX, mouthY);
        c.lineWidth = w + (pass ? 0 : 2.2 * k); c.strokeStyle = pass || !jit ? lineCol : 'rgba(43,29,20,0.55)'; c.stroke(); void o2;
      }
    } else if (ph === 'land' || ph === 'off') {
      // the line hangs slack from the rod tip
      c.beginPath(); c.moveTo(tp.x, tp.y + bend); c.quadraticCurveTo(tp.x + 6 * k, tp.y + 40 * k, tp.x + 2 * k, tp.y + 72 * k); c.lineWidth = 1.2 * k; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();
    } else if (showBob) {
      c.beginPath(); c.moveTo(tp.x, tp.y + bend); c.quadraticCurveTo((tp.x + ex) / 2, Math.max(tp.y, ey) + (ph === 'wait' ? 26 * k : 6 * k), ex, ey - 6 * k);
      c.lineWidth = 1.2 * k; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();
    }
    c.lineCap = 'butt';
    if (showBob) {
      c.beginPath(); c.arc(bx, by - 6 * k, 7 * k, Math.PI, 0); c.closePath(); c.fillStyle = '#e04a3a'; c.fill();
      c.beginPath(); c.arc(bx, by - 6 * k, 7 * k, 0, Math.PI); c.closePath(); c.fillStyle = '#ffffff'; c.fill();
      c.beginPath(); c.arc(bx, by - 6 * k, 7 * k, 0, TAU); c.lineWidth = 1.8 * k; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(bx, by - 13 * k); c.lineTo(bx, by - 18 * k); c.lineWidth = 2 * k; c.stroke();
      if (under > 0 || ph === 'wait' || ph === 'away') { c.beginPath(); c.ellipse(bx, by, 11 * k, 3.2 * k, 0, 0, TAU); c.fillStyle = shade(look.base, 0.1); c.fill(); }
      if (ph === 'bite') { const pop = rm ? 1 : 1 + 0.15 * Math.sin(t * 16); drawText(c, '!', 30 * k * pop, bx, by - 42 * k, '#ffd23f'); }
    }
    // the fish: in the water while it fights, flipping off, flopping on the bank
    if (hook && fp) {
      if (cur.kind === 'fish') drawSpecies(c, cur.species, fp.x, fp.y, fishScale(L, cur), fp.rot, t * (state === 'wobble' ? 30 : 8), -1);
      else junkOnLine(c, L, fp, t, state);
      if (state === 'wobble') { c.globalAlpha = 0.7; ring2(c, fp.x, fp.y, k, t); c.globalAlpha = 1; }
    } else if (ph === 'off' && F.offPos) {
      const u = clamp(F.pt / 1.0, 0, 1), s = fishScale(L, cur);
      c.globalAlpha = clamp(1 - u * 0.9, 0, 1);
      drawSpecies(c, cur.species, F.offPos.x + u * 120 * k, F.offPos.y - Math.sin(Math.PI * Math.min(1, u * 1.6)) * 46 * k, s, -0.5 + u * 2.2, t * 24, 1);
      c.globalAlpha = 1;
    } else if (ph === 'land' || (ph === 'steal' && !(F.pt > 0.55 && F.pt < 2.95))) {
      landedFish(c, L, t, rm);
    }
    // cameo dog, then the help portrait
    drawCameoDog(c, L, t);
    if (hook && fs.phase === 'help') drawPortrait(c, L, t, rm);
    // the creel at the bank with the catch count
    const bk = { x: L.W * 0.1, y: L.H - 20 * k };
    c.beginPath(); c.moveTo(bk.x - 22 * k, bk.y - 20 * k); c.lineTo(bk.x + 22 * k, bk.y - 20 * k); c.lineTo(bk.x + 18 * k, bk.y + 10 * k); c.lineTo(bk.x - 18 * k, bk.y + 10 * k); c.closePath();
    c.fillStyle = '#c8a060'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); for (let i = 1; i < 3; i++) { c.moveTo(bk.x - 21 * k, bk.y - 20 * k + i * 10 * k); c.lineTo(bk.x + 21 * k, bk.y - 20 * k + i * 10 * k); }
    c.lineWidth = 1.4 * k; c.strokeStyle = '#8a6030'; c.stroke();
    if (F.landed > 0) drawText(c, String(F.landed), 16 * k, bk.x, bk.y - 6 * k, '#ffffff');
    // casts left (bobber icons) and the pounds so far
    for (let i = 0; i < N; i++) {
      const x = 22 * k + i * 22 * k, y = 22 * k;
      c.globalAlpha = i >= F.ci && ph !== 'end' ? 1 : 0.28;
      c.beginPath(); c.arc(x, y, 7 * k, Math.PI, 0); c.closePath(); c.fillStyle = '#e04a3a'; c.fill();
      c.beginPath(); c.arc(x, y, 7 * k, 0, Math.PI); c.closePath(); c.fillStyle = '#ffffff'; c.fill();
      c.beginPath(); c.arc(x, y, 7 * k, 0, TAU); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
    }
    c.globalAlpha = 1;
    if (F.lb > 0) drawText(c, F.lb + ' LB', 14 * k, 22 * k + Math.min(N, 8) * 22 * k + 26 * k, 22 * k, '#ffffff');
    // the red wobble tints the whole picture a little (a quiet "now!" for a child who is watching the fish, not the bar)
    if (hook && state === 'wobble') { c.globalAlpha = rm ? 0.1 : 0.1 + 0.05 * Math.sin(t * 24); c.fillStyle = '#ff3b30'; c.fillRect(0, 0, L.W, L.H); c.globalAlpha = 1; }
    if (hook) drawFightBar(c, L, t, rm, state, down);
    if (F.ci === 0 && (ph === 'cast' || ph === 'wait')) {
      c.globalAlpha = rm ? 0.95 : 0.75 + 0.25 * Math.sin(t * 4);
      drawText(c, 'TAP WHEN IT DIPS!', 18 * k, L.W * 0.5, 30 * k, '#ffffff', OUT, L.W * 0.8);
      c.globalAlpha = 1;
    }
    for (const tx of F.texts) {
      const a = clamp(tx.t < 1.5 ? 1 : (1.9 - tx.t) / 0.4, 0, 1), rise = rm ? 0 : tx.t * 14 * k;
      c.globalAlpha = a;
      drawText(c, tx.text, 24 * k, tx.x, tx.y - rise, tx.col, OUT, L.W * 0.9);
      if (tx.sub) drawText(c, tx.sub, 15 * k, tx.x, tx.y - rise + 24 * k, '#ffffff', OUT, L.W * 0.9);
      if (tx.sub2) drawText(c, tx.sub2, 13 * k, tx.x, tx.y - rise + 44 * k, '#ffe9b0', OUT, L.W * 0.9);
    }
    c.globalAlpha = 1;
  };
  // ---- the bear at the fishing hole (v1.7): far bank only, small, fishing or eating berries; the fish dart away; it never comes near
  function bearPose(L) {
    const k = L.k, st = F.bearStage, bt = F.bt, W = L.W;
    const xs = bear && bear.kind === 'berries' ? W * 0.8 : W * 0.84, off = W + 70 * k;
    let x = xs, dir = -1, walk = false, vis = 1;
    if (st === 'arrive') { x = lerp(off, xs, ease(clamp(bt / T_BEAR_IN, 0, 1))); walk = bt < T_BEAR_IN - 0.3; }
    else if (st === 'leave') { x = lerp(xs, off, ease(clamp(bt / T_BEAR_OUT, 0, 1))); dir = 1; walk = true; }
    else if (st === 'move') { x = lerp(xs, off, ease(clamp(bt / T_BEAR_MOVE, 0, 1))); dir = 1; walk = true; }
    return { x, y: L.H * 0.52 + 9 * k, s: (L.H * 0.085) / 36, dir, walk, vis };
  }
  function drawBearScene(c, L, t, rm) {
    const k = L.k, b = bobPos(L), bp = bearPose(L), kind = bear ? bear.kind : 'fishing';
    // the fish dart away from the bobber
    for (const q of F.scatter) {
      const u = clamp(q.t / 1.3, 0, 1), dist = (30 + ease(u) * 120) * k;
      c.globalAlpha = clamp(1 - u, 0, 1) * 0.9;
      drawSpecies(c, F.cur.c.kind === 'fish' ? F.cur.c.species : 'channel-catfish', q.x + Math.cos(q.a) * dist * 1.4, q.y + Math.sin(q.a) * dist * 0.35, k * 0.42, q.a * 0.6, t * 22, Math.cos(q.a) < 0 ? -1 : 1);
    }
    c.globalAlpha = 1;
    if (kind === 'berries') {                                              // the berry bush the bear is eating from
      const bx = L.W * 0.8 - 46 * k * 1.2, by = bp.y + 2 * k;
      c.beginPath(); c.ellipse(bx, by - 14 * k, 30 * k, 18 * k, 0, 0, TAU); c.fillStyle = '#4f8a3e'; c.fill(); c.lineWidth = 2.2 * k; c.strokeStyle = OUT; c.stroke();
      for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(bx + Math.cos(i * 2.4) * 20 * k, by - 14 * k + Math.sin(i * 2.4) * 10 * k, 2.6 * k, 0, TAU); c.fillStyle = '#c0314a'; c.fill(); }
    }
    // ripples around its paws while it wades and fishes
    if (kind === 'fishing' && !bp.walk) for (let i = 0; i < 2; i++) { const q = ((t * 0.9 + i * 0.5) % 1); c.globalAlpha = (1 - q) * 0.7; c.beginPath(); c.ellipse(bp.x + 6 * k * bp.dir, bp.y + 7 * k, (10 + q * 26) * k, (2.4 + q * 6) * k, 0, 0, TAU); c.lineWidth = 1.8 * k; c.strokeStyle = '#ffffff'; c.stroke(); }
    c.globalAlpha = 1;
    // head: lowered to the water or the bush, with a slow dip every few seconds
    const dip = rm ? 0.5 : (Math.sin(t * 1.9) + 1) / 2;
    const head = bp.walk ? 0.1 : kind === 'berries' ? -0.55 : -0.2 - dip * 0.55;
    drawBear(c, bp.x, bp.y, bp.s, rm ? 0 : t * (bp.walk ? 5 : 0), head, bp.dir);
  }
  function ring2(c, x, y, k, t) {
    const q = (t * 3) % 1;
    c.beginPath(); c.ellipse(x, y + 10 * k, (20 + q * 40) * k, (6 + q * 12) * k, 0, 0, TAU); c.lineWidth = 2.4 * k; c.strokeStyle = '#ffffff'; c.stroke();
  }
  // a junk catch on the line (it reels in with no wobbles): the boot dangles, the turtle snaps at the air, the bottle bobs
  function junkOnLine(c, L, fp, t, state) {
    const cur = F.cur.c, k = L.k, id = cur.junk;
    if (id === 'turtle') drawJunk(c, id, fp.x, fp.y + 12 * k, 1.5 * k, 0, t * 6, Math.max(0, Math.sin(t * 5)));
    else if (id === 'bottle') drawJunk(c, id, fp.x, fp.y, 1.3 * k, 1.1 + Math.sin(t * 2) * 0.1);
    else drawJunk(c, id, fp.x, fp.y - 4 * k, 1.5 * k, Math.sin(t * 3) * 0.2);
    void state;
  }
  // the fish on the bank: it arcs out of the water and flops
  function landedFish(c, L, t, rm) {
    const cur = F.cur.c, k = L.k, bk = bankPos(L), from = F.landPos || nearPos(L);
    const T = F.phase === 'steal' ? T_LAND : F.pt;
    const u = clamp(T / 0.55, 0, 1), e = ease(u);
    const x = lerp(from.x, bk.x, e), y = lerp(from.y, bk.y, e) - Math.sin(Math.PI * u) * 70 * k;
    if (cur.kind === 'fish') {
      const flop = u >= 1 ? (rm ? 0 : Math.sin(Math.max(0, T - 0.55) * 14) * Math.max(0, 1 - (T - 0.55) / 1.1) * 0.35) : -0.3 + u * 1.4;
      drawSpecies(c, cur.species, x, y, fishScale(L, cur), flop, T * 16, -1);
    } else if (cur.junk === 'turtle') {
      // it snaps at the air, then plops back into the water with a splash and paddles off
      const back = T > 1.0;
      const tx = back ? lerp(bk.x, bk.x + 90 * k, ease((T - 1.0) / 0.7)) : x, ty = back ? lerp(bk.y, L.H * 0.7, ease((T - 1.0) / 0.7)) : y;
      c.globalAlpha = back ? clamp(1 - (T - 1.0) / 0.7, 0, 1) : 1;
      drawJunk(c, 'turtle', tx, ty, 1.5 * k, 0, t * 6, Math.max(0, Math.sin(T * 9)));
      c.globalAlpha = 1;
    } else if (cur.junk === 'bottle') drawJunk(c, 'bottle', x, y, 1.3 * k, 1.2 + (u >= 1 ? Math.sin(T * 4) * 0.08 : 0));
    else drawJunk(c, 'boot', x, y - 10 * k, 1.5 * k, u >= 1 ? Math.sin(T * 5) * 0.14 * Math.max(0, 1 - (T - 0.55) / 1.1) : 0.4 - u * 0.4);
  }

  // ---- the fight bar: the fish's way in to the bank, and the line's mood. Green = reel, yellow = get ready, red = let go.
  function drawFightBar(c, L, t, rm, state, down) {
    const k = L.k, fs = F.fs, W = L.W;
    const bw = Math.min(W * 0.64, 420 * k), bh = 28 * k, bx = W * 0.5 - bw / 2 + (W > 700 ? 0 : 0), by = 54 * k;
    const shake = state === 'wobble' && !rm ? Math.sin(t * 50) * 2.2 * k : 0;
    const col = state === 'wobble' ? '#ff3b30' : state === 'warn' ? '#ffd23f' : '#58c24a';
    c.save(); c.translate(shake, 0);
    c.beginPath(); rrect(c, bx - 4 * k, by - 4 * k, bw + 8 * k, bh + 8 * k, bh * 0.6); c.fillStyle = 'rgba(30,20,14,0.7)'; c.fill();
    c.beginPath(); rrect(c, bx, by, bw, bh, bh * 0.5); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    const fw = Math.max(bh, bw * clamp(fs.progress, 0, 1));
    c.beginPath(); rrect(c, bx, by, fw, bh, bh * 0.5); c.fillStyle = col; c.fill();
    c.beginPath(); rrect(c, bx + 3 * k, by + 3 * k, Math.max(0, fw - 6 * k), bh * 0.3, bh * 0.15); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
    const strain = fs.fight && fs.fight.strainMaxMs ? clamp(fs.strain / fs.fight.strainMaxMs, 0, 1) : 0;
    c.beginPath(); rrect(c, bx, by, bw, bh, bh * 0.5); c.lineWidth = 4 * k; c.strokeStyle = strain > 0.05 ? '#ff3b30' : state === 'warn' ? '#ffd23f' : '#ffffff'; c.stroke();
    c.beginPath(); rrect(c, bx, by, bw, bh, bh * 0.5); c.lineWidth = 1.6 * k; c.strokeStyle = OUT; c.stroke();
    // the bank (left) and the fish nosing in
    const cur = F.cur.c;
    if (cur.kind === 'fish') drawSpecies(c, cur.species, bx + fw - bh * 0.35, by + bh / 2, (bh * 0.9) / speciesOf(cur.species).len * 1.5, 0, t * 8, -1);
    else drawText(c, cur.junk === 'boot' ? '👢' : cur.junk === 'bottle' ? '🍾' : '🐢', bh * 0.8, bx + fw - bh * 0.4, by + bh / 2, '#ffffff');
    c.restore();
    // the word under the bar
    const pulse = rm ? 1 : 1 + 0.06 * Math.sin(t * (state === 'wobble' ? 18 : 8));
    let word, wcol, size = 22;
    if (fs.phase === 'help') { word = 'IT TAKES TWO!'; wcol = '#ffd23f'; }
    else if (state === 'wobble') { word = down ? 'LET GO!' : 'WAIT FOR IT...'; wcol = down ? '#ff6a5e' : '#ffffff'; size = down ? 30 : 20; }
    else if (state === 'warn') { word = down ? 'GET READY...' : 'HOLD AGAIN SOON...'; wcol = '#ffd23f'; size = 24; }
    else { word = down ? 'REEL!' : 'HOLD TO REEL!'; wcol = down ? '#8ef07a' : '#ffffff'; }
    drawText(c, word, size * k * pulse, W * 0.5, by + bh + 28 * k, wcol, OUT, W * 0.8);
    if (F.firstFight && F.ci === 0 && fs.phase === 'reel') drawText(c, 'LET GO WHEN THE LINE SHAKES RED', 12 * k, W * 0.5, by + bh + 54 * k, '#ffffff', OUT, W * 0.9);
  }

  // ---- state
  const fightPhase = () => (hasFight() ? F.fs.phase : null);
  F.state = () => ({
    kind: 'fishing', cast: Math.min(N, F.ci + 1), casts: N, left: Math.max(0, N - F.ci - (F.phase === 'end' ? 0 : 0)), landed: F.landed,
    phase: F.phase, fight: fightPhase(), progress: F.fs ? F.fs.progress : 0, wobble: !!(F.fs && F.fs.wobble), warn: !!(F.fs && F.fs.warn),
    species: F.cur && F.cur.c.species || null, junk: F.cur && F.cur.c.junk || null, bear: F.phase === 'bear' ? F.bearStage : null, spot: F.spot, rod: Math.round(F.rod.b * 1000) / 1000,
  });
  F.summary = () => ({ landed: F.landed, casts: Math.min(N, F.ci + (F.phase === 'end' ? 0 : 0)), lb: F.lb });
  F.debug = (L) => ({
    ...F.state(), bobber: bobPos(L), pt: F.pt, waitT: F.waitT, biteOpensIn: F.phase === 'wait' ? F.waitT - F.pt : F.phase === 'cast' ? F.waitT + T_CAST - F.pt : 0,
    biteLeft: F.phase === 'bite' ? T_BITE - F.pt : 0, down: !!(F.ptr || F.keyDown), strain: F.fs ? F.fs.strain : 0, t: F.fs ? F.fs.t : 0,
    wobbles: F.cur ? F.cur.fight.wobbles.slice(0, 40) : [], helpSpot: helpSpot(L), cameo: cameo ? { ...cameo } : null, canvasTexts: F.texts.map((x) => x.text),
  });
  void lenOf; void SPECIES; void T_END;
  return F;
}
