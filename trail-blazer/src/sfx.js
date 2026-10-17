// Trail Blazer-only sound effects (countdown beeps, the start gate dropping, the finish cowbell, a water splash, a gate
// creak), synthesized with WebAudio like Spell
// Jump's audio.js (which owns everything else: engine, boost, landings, coins, music). Its own small context, created
// and resumed inside the first user gesture (iOS); every call is a safe no-op before that or with sound off.
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

function createSfx() {
  let ctx = null, out = null, noiseBuf = null, on = true;
  function init() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { try { ctx = new AC(); } catch (e) { return false; } }
    out = ctx.createGain(); out.gain.value = on ? 0.8 : 0; out.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const ready = () => ctx && ctx.state === 'running' && on;
  function noise(type, f0, f1, q, dur, peak, at = 0) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out); src.start(t); src.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, peak, at = 0) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    unlock() { if (!init()) return; if (ctx.state !== 'running') ctx.resume().catch(() => {}); },
    setSound(v) { on = !!v; if (out) out.gain.value = on ? 0.8 : 0; },
    /** the countdown: a short beep for 3-2-1, a long higher one for GO */
    beep(go = false) { if (ready()) tone('square', go ? 1320 : 660, go ? 1320 : 660, go ? 0.45 : 0.16, 0.07); },
    /** the start gate slamming down */
    gateDrop() { if (ready()) { noise('lowpass', 1800, 200, 0.8, 0.3, 0.35, 0.02); tone('triangle', 220, 70, 0.25, 0.12, 0.02); } },
    /** the finish: a cowbell over the crowd (Spell Jump's audio.cheer) */
    cowbell() {
      if (!ready()) return;
      for (const at of [0, 0.22, 0.44]) { tone('square', 800, 790, 0.22, 0.05, at); tone('square', 540, 535, 0.22, 0.05, at); }
    },
    splash() { if (ready()) { noise('lowpass', 2400, 300, 0.7, 0.6, 0.3); noise('bandpass', 900, 3000, 2, 0.25, 0.15, 0.05); } },
    creak() { if (ready()) { tone('square', 180, 120, 0.35, 0.03); noise('bandpass', 700, 500, 12, 0.35, 0.08); } },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); },
  };
}
export const Sfx = createSfx();
