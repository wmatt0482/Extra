// Machine sounds: a low engine tone whose pitch is set per machine and rises with driving, a hydraulic whine while a
// tool moves, short low thunks for impacts scaled by contact force, the roof horn (a stock air horn or the brass bell
// horn) and the horn fanfare that opens the job-complete show. UI effects (coins, clicks) come from the shared
// Spell Jump Audio module instead. Nothing plays until the first gesture unlocks the AudioContext.
let ctx,
  bus,
  engine,
  eg,
  hyd,
  hg,
  allowed = true,
  lastImpact = 0;
/** Each machine's idle engine pitch in Hz; heavier machines sit lower. */
const freq = { skid: 68, excavator: 49, crane: 39 };
export const Sound = {
  unlock() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      bus = ctx.createGain();
      bus.connect(ctx.destination);
      engine = ctx.createOscillator();
      engine.type = 'triangle';
      eg = ctx.createGain();
      eg.gain.value = 0;
      engine.connect(eg).connect(bus);
      engine.start();
      hyd = ctx.createOscillator();
      hyd.type = 'sine';
      hg = ctx.createGain();
      hg.gain.value = 0;
      hyd.connect(hg).connect(bus);
      hyd.start();
    }
    ctx.resume().catch(() => {});
    this.on(allowed);
  },
  on(v) {
    allowed = v;
    if (bus) bus.gain.setTargetAtTime(v ? 0.3 : 0, ctx.currentTime, 0.06);
  },
  // Called every frame with the active machine's kind, drive axis and tool movement; silent while not actively playing.
  update(kind, drive, arm, active) {
    if (!ctx) return;
    const t = ctx.currentTime;
    engine.frequency.setTargetAtTime((freq[kind] || 60) + Math.abs(drive) * 60, t, 0.09);
    eg.gain.setTargetAtTime(active ? 0.045 + Math.abs(drive) * 0.06 : 0, t, 0.1);
    hyd.frequency.setTargetAtTime(310 + Math.abs(arm) * 220, t, 0.08);
    hg.gain.setTargetAtTime(active && Math.abs(arm) > 0.1 ? 0.024 : 0, t, 0.05);
  },
  // At most one thunk every 0.16 s, so a toppling stack does not roar.
  impact(force) {
    if (!ctx || ctx.state !== 'running' || ctx.currentTime - lastImpact < 0.16) return;
    lastImpact = ctx.currentTime;
    this.note(70, 0.15, Math.min(0.5, force / 30000));
  },
  // A falling one-shot tone, used by impacts and the horn.
  note(f, d = 0.2, v = 0.3) {
    if (!ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      t = ctx.currentTime;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus);
    o.start();
    o.stop(t + d + 0.02);
  },
  // One brass-like horn voice: two slightly detuned saws through a low-pass filter that opens as the note swells. Used
  // by the horn and the fanfare.
  brass(f, start, dur, vol = 0.1, bright = 1) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + start,
      filter = ctx.createBiquadFilter(),
      g = ctx.createGain();
    filter.type = 'lowpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(f * 1.5, t);
    filter.frequency.linearRampToValueAtTime(f * (3.5 + bright * 2), t + Math.min(0.12, dur * 0.4));
    filter.frequency.linearRampToValueAtTime(f * 2.4, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.035);
    g.gain.setValueAtTime(vol, t + Math.max(0.04, dur - 0.14));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    filter.connect(g).connect(bus);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
  },
  // A struck-bell ring: a sine with two inharmonic partials that die away slowly.
  ring(f, start, dur, vol = 0.1) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + start;
    for (const [mult, share] of [[1, 1], [2.76, 0.45], [5.4, 0.2]]) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(vol * share, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (mult > 1 ? 1.8 : 1));
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
  },
  // The roof horn. Stock is a deep two-tone air horn (a minor third apart); the bell horn earned at job 7 is a higher
  // brass chord with a bell ring on top.
  horn(bell) {
    if (bell) {
      for (const f of [392, 494, 587]) this.brass(f, 0, 0.7, 0.07, 1.4);
      this.ring(1175, 0.02, 1.1, 0.05);
    } else {
      for (const f of [147, 175]) this.brass(f, 0, 0.7, 0.11, 0.6);
    }
  },
  // The job-complete fanfare, in the key of the music (C): two short calls, then a long open chord. The bell horn
  // plays it an octave higher with bell rings.
  fanfare(bell) {
    const o = bell ? 2 : 1,
      calls = [
        [196, 0, 0.17],
        [262, 0.2, 0.17],
      ];
    for (const [f, at, d] of calls) this.brass(f * o, at, d, bell ? 0.07 : 0.1);
    for (const f of [262, 330, 392, 523]) this.brass(f * o, 0.42, 1.25, bell ? 0.05 : 0.07, 1.2);
    if (bell) for (const [f, at] of [[1047, 0.44], [1319, 0.6], [1568, 0.76]]) this.ring(f, at, 1, 0.04);
  },
  suspend() {
    ctx?.suspend().catch(() => {});
  },
  resume() {
    ctx?.resume().catch(() => {});
  },
};
