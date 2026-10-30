// Wagon West's own sound effects, synthesized with WebAudio like Fraction Fright's src/sfx.js; Spell Jump's audio.js
// owns the rest (music, clicks, letters, cash, fanfare, correct / oops). Its own small context, created and resumed
// inside the first user gesture (iOS); every call is a safe no-op before that or with sound off.
// Big sounds only on success: a right answer gets a bright two-note chime ("Nice!"), a quick one a whoosh on top, a
// miss only a soft low bump; the rope toss whistles, lands with a thunk on the landing or a small splash beside it;
// the bow twangs, the fishing line plops; the bugle calls (a crate look) play when the wagon leaves camp.
// v1.1: a trail card arrives with a three-note chime; the dog barks twice (a short "wuf-wuf": a low square-ish
// tone that drops in pitch, with a breathy noise on top).
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
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out); src.start(t); src.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, peak, at = 0) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  const BUGLES = {
    reveille: [[392, 0.12], [523, 0.12], [659, 0.12], [523, 0.12], [659, 0.12], [784, 0.36]],
    fanfare: [[523, 0.1], [523, 0.1], [523, 0.1], [659, 0.3], [523, 0.14], [784, 0.42]],
  };
  return {
    unlock() { if (!init()) return; if (ctx.state !== 'running') ctx.resume().catch(() => {}); },
    setSound(v) { on = !!v; if (out) out.gain.value = on ? 0.8 : 0; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); },
    /** a right answer: two bright notes */
    nice() { if (ready()) { tone('triangle', 784, 784, 0.12, 0.09); tone('triangle', 1047, 1047, 0.22, 0.09, 0.1); } },
    /** quick: a tailwind whoosh */
    quick() { if (ready()) noise('bandpass', 600, 2400, 1.4, 0.45, 0.12); },
    /** a miss: a soft low bump, nothing loud */
    soft() { if (ready()) tone('sine', 300, 200, 0.16, 0.08); },
    /** the rope leaves the hand */
    toss() { if (ready()) { tone('sine', 420, 980, 0.32, 0.05); noise('bandpass', 1400, 2600, 3, 0.28, 0.04); } },
    /** the rope lands on the landing */
    thunk() { if (ready()) { tone('sine', 150, 50, 0.3, 0.32); noise('lowpass', 800, 120, 0.7, 0.3, 0.2, 0.02); } },
    /** the rope lands in the water beside it */
    splash() { if (ready()) { noise('bandpass', 2200, 500, 1.2, 0.4, 0.16); tone('sine', 520, 220, 0.18, 0.05); } },
    /** the bow string */
    twang() { if (ready()) { tone('triangle', 220, 140, 0.18, 0.1); noise('highpass', 3000, 1500, 0.8, 0.08, 0.05); } },
    /** the bobber */
    plop() { if (ready()) { tone('sine', 620, 240, 0.12, 0.1); noise('lowpass', 900, 300, 1, 0.1, 0.05); } },
    /** the party cheers (a river crossed, a leg arrived) */
    cheer() { if (ready()) { for (let i = 0; i < 4; i++) noise('bandpass', 900 + i * 300, 1400 + i * 200, 2, 0.5, 0.05, i * 0.06); tone('triangle', 659, 988, 0.4, 0.05, 0.1); } },
    /** a trail card drops: a bright three-note chime */
    chime() { if (ready()) { tone('triangle', 1047, 1047, 0.14, 0.07); tone('triangle', 1319, 1319, 0.14, 0.07, 0.09); tone('sine', 1568, 1568, 0.32, 0.07, 0.18); } },
    /** the dog: two short barks */
    bark() {
      if (!ready()) return;
      for (const at of [0, 0.2]) { tone('square', 520, 260, 0.11, 0.05, at); tone('triangle', 380, 190, 0.12, 0.08, at); noise('bandpass', 1400, 700, 1.5, 0.1, 0.05, at); }
    },
    /** a bugle call (the crate look): plays when the wagon leaves camp */
    bugle(id = 'reveille') {
      const notes = BUGLES[id];
      if (!ready() || !notes) return;
      let at = 0;
      for (const [f, d] of notes) { tone('sawtooth', f, f, d, 0.05, at); tone('triangle', f * 2, f * 2, d, 0.03, at); at += d + 0.03; }
    },
  };
}

export const Sfx = createSfx();
export default Sfx;
