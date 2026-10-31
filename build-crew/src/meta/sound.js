// Machine sounds: a low engine tone whose pitch is set per machine and rises with driving, a hydraulic whine while a
// tool moves, and short low thunks for impacts scaled by contact force. UI effects (coins, clicks) come from the shared
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
  // The stock horn, or the bell horn earned at job 7.
  horn(bell) {
    this.note(bell ? 660 : 180, 0.65, 0.25);
  },
  suspend() {
    ctx?.suspend().catch(() => {});
  },
  resume() {
    ctx?.resume().catch(() => {});
  },
};
