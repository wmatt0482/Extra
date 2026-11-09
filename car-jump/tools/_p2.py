p='src/game/engine.js'
s=open(p).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (s.count(a), a[:80])
    s=s.replace(a,b)

rep("""      landing: r.firstLanding,
      finishCrossed: r.finishCrossed,""","""      landing: r.firstLanding || (r.splashes ? 'good' : null), // v4.0: a run that only ever splashed still lands softly
      finishCrossed: r.finishCrossed,""")
rep("""    summary.ratingScore = ratingScore({ ...summary, cleanFlips: r.cleanFlips }, r.course.finish);""","""    if (r.sky) {
      // v4.0 Sky Era extras (absent on Earth tracks)
      summary.sky = { splashes: r.splashes, islandLands: r.islandLands, boostRings: r.boostRings, slingshots: r.slingshots, glideSec: Math.round(r.glideT * 10) / 10 };
      summary.boost = { used: !!r.bw || r.boostPower > 0, power: r.boostPower, collected: r.bw ? r.bw.n : 0, total: r.bw ? r.bw.letters.length : 0, inOrder: !!(r.bw && r.bw.done) };
    }
    summary.ratingScore = ratingScore({ ...summary, cleanFlips: r.cleanFlips }, r.course.finish);""")

# start tick: pending skip of the gate
rep("""  function tick() {
    const r = run;""","""  function tick() {
    const r = run;
    if (r.boostSkip === 1) { r.boostSkip = 2; r.boostUsed = true; } // freeze(false) without boost(): the gate is spent a step later""")

# frame loop
rep("""    if (r && !paused) {
      acc += dt * simSpeed;
      let n = 0;
      const maxSteps = MAX_STEPS_PER_FRAME * Math.ceil(simSpeed);
      while (acc >= STEP && n < maxSteps && run === r) {""","""    if (r && !paused) {
      if (r.frozen) acc = 0; else acc += dt * simSpeed; // v4.0: frozen at the Spell Boost gate: nothing simulates, the scene idles
      let n = 0;
      const maxSteps = MAX_STEPS_PER_FRAME * Math.ceil(simSpeed);
      while (acc >= STEP && n < maxSteps && run === r && !r.frozen) {""")

# getState
rep("""      return { phase: 'done', distance: 0, speedKmh: 0, nitro: 0, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false, landing: null,
        altitude: 0, combo: { count: 0, mult: 1, timer01: 0 }, rejumps: 0, letters: { collected: 0, total: 0 } };""","""      return { phase: 'done', distance: 0, speedKmh: 0, nitro: 0, airTime: 0, flips: 0, smashed: 0, cash: 0, finishCrossed: false, landing: null,
        altitude: 0, combo: { count: 0, mult: 1, timer01: 0 }, rejumps: 0, letters: { collected: 0, total: 0 },
        frozen: false, boostReady: false, boostUsed: false, boostLetters: { collected: 0, total: 0 }, gliding: false, inWell: false };""")
rep("""      letters: { collected: r.lettersCollected, total: r.lettersRevealed ? r.letters.length : 0 },
    };
  }""","""      letters: { collected: r.lettersCollected, total: r.lettersRevealed ? r.letters.length : 0 },
      // v4.0 Sky Era (all false / zero on Earth tracks). boostReady: a Spell Boost gate is in the world (past the apex) and not yet
      // spent; frozen: the car is parked at the gate (or the app froze the run); boostUsed: boost() was called or the gate was skipped
      frozen: r.frozen,
      boostReady: !!(r.gate && !r.boostUsed),
      boostUsed: r.boostUsed,
      boostLetters: { collected: r.bw ? r.bw.n : 0, total: r.bw ? r.bw.letters.length : 0 },
      gliding: r.gliding,
      inWell: !!r.well,
    };
  }""")

# API methods: freeze/boost, before 'pause() { paused = true; },'
rep("""    pause() { paused = true; },""","""    // v4.0 Sky Era. freeze(true): stop the simulation (no timers tick; the scene idles: clouds drift, the car hovers with a glow).
    // freeze(false): resume. Returns true if the state changed. The Spell Boost gate freezes the run by itself (event 'spellBoost').
    freeze(on = true) {
      const r = run;
      if (!r || r.phase === 'done') return false;
      if (on) { if (r.frozen) return false; r.frozen = true; return true; }
      if (!r.frozen) return false;
      r.frozen = false;
      acc = 0; last = performance.now();
      if (r.gate && r.gate.hit && !r.boostUsed && !r.bw && r.boostSkip === 0) r.boostSkip = 1; // resumed without boost(): spent next step
      return true;
    },
    // The second jump you earn by spelling. Only while the car is parked at the gate (after the 'spellBoost' event), once per run.
    // power 1.0 = a big second jump (up + forward), 0.5 = a smaller hop (scaled by the ride's boostMul, 0..1.25). `word` (string or letters)
    // spawns the letter rings along the new arc (events letterRing / wordComplete carry boost: true). Does not unfreeze: call freeze(false).
    boost(o = {}) {
      const r = run;
      if (!r || r.phase === 'done' || !r.gate || !r.gate.hit || r.boostUsed || r.bw) return false;
      const power = clamp(o.power == null || o.power === '' || !Number.isFinite(Number(o.power)) ? 1 : Number(o.power), 0, 1.25);
      applyBoost(r, power, lettersArg(o.word != null ? o.word : o.letters));
      return true;
    },
    // alias of getState() (the HUD's name for it in SPEC.md)
    getHudState() { return getState(); },
    pause() { paused = true; },""")
# debugStep respects frozen
rep("""      for (let i = 0; i < n && run; i++) { tick(); run && (run.realT += STEP, updateFx(run, STEP), updateCamera(run, STEP, false)); }""","""      for (let i = 0; i < n && run; i++) {
        if (run.frozen) { run.realT += STEP; updateFx(run, STEP); updateCamera(run, STEP, false); continue; } // frozen: only the idle scene moves
        tick(); run && (run.realT += STEP, updateFx(run, STEP), updateCamera(run, STEP, false));
      }""")
open(p,'w').write(s)
