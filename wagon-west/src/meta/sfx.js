// Wagon West's own sound effects, synthesized with WebAudio like Fraction Fright's src/sfx.js; Spell Jump's audio.js
// owns the rest (music, clicks, letters, cash, fanfare, correct / oops). Its own small context, created and resumed
// inside the first user gesture (iOS); every call is a safe no-op before that or with sound off.
// Big sounds only on success: a right answer gets a bright two-note chime ("Nice!"), a quick one a whoosh on top, a
// miss only a soft low bump; the rope toss whistles, lands with a thunk on the landing or a small splash beside it;
// the bow twangs, the fishing line plops; the bugle calls (a crate look) play when the wagon leaves camp.
// v1.1: a trail card arrives with a three-note chime; the dog barks twice (a short "wuf-wuf": a low square-ish
// tone that drops in pitch, with a breathy noise on top).
// v1.4: the far-off sounds of the trail facts (Sfx.ambient: 'crack' three soft, far, low-passed cracks with a long echo (quieter
// than the bugle), 'rumble', 'howl' (three overlapping sine glides, far), 'wind', 'hooves') and the fishing, stones, wishes and
// dust devil: reel(on) (a soft click loop while the line is reeled in), wobble, skip, plunk, twinkle, whoosh, snap (the turtle's
// cartoon clack). splash() is the rope toss's, shared. All of it is quiet next to a cheer, and Sound off silences every one.
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

function createSfx() {
  let ctx = null, out = null, noiseBuf = null, on = true, reelTimer = 0;
  const stopReel = () => { if (reelTimer) { clearInterval(reelTimer); reelTimer = 0; } };
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
    setSound(v) { on = !!v; if (out) out.gain.value = on ? 0.8 : 0; if (!on) stopReel(); },
    suspend() { stopReel(); if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
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
    /** The far-off sounds of the trail facts: 'crack' | 'rumble' | 'howl' | 'wind' | 'hooves' (soft, long, never sudden). */
    ambient(kind) {
      if (!ready()) return;
      if (kind === 'crack') {
        for (const at of [0, 0.55, 1.1]) for (const [d, g] of [[0, 0.05], [0.4, 0.024], [0.85, 0.012]]) noise('lowpass', 1900, 380, 0.7, 0.2, g, at + d);
      } else if (kind === 'rumble') {
        noise('lowpass', 160, 50, 0.9, 2.6, 0.1); tone('sine', 62, 44, 2.4, 0.06);
      } else if (kind === 'howl') {
        [[0, 392, 587], [0.5, 440, 659], [1.0, 349, 523]].forEach(([at, a, b]) => { tone('sine', a, b, 1.3, 0.028, at); tone('sine', b, a * 0.9, 1.1, 0.028, at + 1.25); });
      } else if (kind === 'wind') {
        noise('bandpass', 260, 640, 0.8, 2.2, 0.05); noise('bandpass', 700, 300, 1.2, 1.6, 0.025, 0.5);
      } else if (kind === 'hooves') {
        for (let i = 0; i < 10; i++) { noise('lowpass', 520, 110, 0.8, 0.09, 0.07, i * 0.1); tone('sine', 96, 60, 0.08, 0.05, i * 0.1); }
      }
    },
    /** The reel: a soft click loop while on (the scene says when the finger is down); off stops it. */
    reel(isOn) {
      stopReel();
      if (!isOn || !ready()) return;
      const click = () => { if (!ready()) { stopReel(); return; } tone('square', 900, 620, 0.025, 0.02); };
      click(); reelTimer = setInterval(click, 95);
      setTimeout(() => { if (reelTimer) stopReel(); }, 20000);        // (never left running)
    },
    /** The line shakes red. */
    wobble() { if (ready()) { tone('sawtooth', 210, 150, 0.2, 0.04); tone('sawtooth', 220, 160, 0.2, 0.03, 0.1); } },
    /** A stone kisses the water. */
    skip() { if (ready()) { tone('sine', 760, 1180, 0.09, 0.06); noise('bandpass', 2600, 1400, 2, 0.06, 0.04); } },
    /** A stone sinks. */
    plunk() { if (ready()) { tone('sine', 420, 110, 0.24, 0.1); noise('lowpass', 900, 200, 1, 0.18, 0.06); } },
    /** A wish on a falling star. */
    twinkle() { if (ready()) { [1568, 1976, 2349, 3136].forEach((f, i) => tone('sine', f, f * 1.01, 0.22, 0.03, i * 0.09)); } },
    /** The dust devil. */
    whoosh() { if (ready()) { noise('bandpass', 400, 2200, 1.1, 0.8, 0.1); noise('bandpass', 1800, 500, 1.4, 0.7, 0.05, 0.3); } },
    /** The turtle's cartoon clack. */
    snap() { if (ready()) { tone('square', 1300, 320, 0.05, 0.06); noise('highpass', 3000, 2000, 0.8, 0.05, 0.05); tone('square', 1100, 300, 0.05, 0.05, 0.12); } },
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
