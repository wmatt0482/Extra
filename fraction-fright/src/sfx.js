// Fraction Fright's own sound effects, synthesized with WebAudio like Trail Blazer's sfx.js; Spell Jump's audio.js owns
// the rest (music, clicks, cash, fanfare). The engine says what happened with 'sound' { name, vol } events and the app
// plays them here (play(name, vol)): toss, boing (a bounce-scaffold hop), thunkBig / thunk / thunkSmall (the landing:
// bull / hit / near), plop (a miss), splat, cure, knock (a zombie at the fence), pumpkin (it takes one), bigWave,
// finalWave, calm (the calm beat: plant a pumpkin), waveEnd. Its own small context, created and resumed inside the
// first user gesture (iOS); every call is a safe no-op before that or with sound off.
// Big sounds only on success (SPEC §0, Kao 2024): the thunk's size follows the result; a miss is a soft plop.
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
  return {
    unlock() { if (!init()) return; if (ctx.state !== 'running') ctx.resume().catch(() => {}); },
    setSound(v) { on = !!v; if (out) out.gain.value = on ? 0.8 : 0; },
    /** the lob: a short rising whistle */
    lob(v = 1) { if (ready()) { tone('sine', 500, 1100, 0.3, 0.05 * v); noise('bandpass', 1200, 2400, 3, 0.25, 0.04 * v); } },
    /** a hop of the bounce scaffold (higher each hop) */
    boing(v = 1) { if (ready()) tone('sine', 300 * v, 620 * v, 0.14, 0.09); },
    /** the THUNK: size 2 = a bull (thunk + boom + sparkle), 1 = a hit, 0 = a near (small) */
    thunk(size = 1) {
      if (!ready()) return;
      tone('sine', size === 2 ? 120 : size === 1 ? 150 : 220, 40, size === 2 ? 0.45 : size === 1 ? 0.3 : 0.15, size === 2 ? 0.5 : size === 1 ? 0.38 : 0.14);
      if (size) noise('lowpass', 900, 120, 0.7, size === 2 ? 0.6 : 0.35, size === 2 ? 0.45 : 0.3, 0.02);
      if (size === 2) { tone('triangle', 784, 1568, 0.3, 0.07, 0.15); tone('triangle', 1047, 2093, 0.35, 0.06, 0.25); }
    },
    splat(v = 1) { if (ready()) noise('bandpass', 1800, 600, 2, 0.25, 0.18 * v, 0.05); },
    plop() { if (ready()) { tone('sine', 420, 180, 0.14, 0.12); noise('lowpass', 700, 200, 1, 0.12, 0.06); } },
    /** the landing by result (the Lab, which has no engine): bull / hit / near / miss */
    land(result) {
      if (result === 'bull') { this.thunk(2); this.splat(); } else if (result === 'hit') { this.thunk(1); this.splat(0.8); }
      else if (result === 'near') this.thunk(0); else this.plop();
    },
    /** a zombie took a pumpkin (a soft, silly pop) */
    pumpkin() { if (ready()) { tone('triangle', 520, 380, 0.18, 0.06); noise('bandpass', 900, 600, 4, 0.1, 0.05); } },
    /** a cured neighbour's happy two notes */
    cure() { if (ready()) { tone('triangle', 659, 659, 0.14, 0.08, 0.1); tone('triangle', 880, 880, 0.22, 0.08, 0.24); } },
    /** knock knock at the fence (a zombie arrived, takes a pumpkin, shuffles off) */
    knock() { if (ready()) for (const at of [0, 0.16]) { noise('bandpass', 380, 300, 6, 0.08, 0.3, at); tone('sine', 180, 120, 0.06, 0.12, at); } },
    /** the calm beat: a pumpkin goes in the ground */
    plant() { if (ready()) { noise('lowpass', 500, 150, 0.8, 0.3, 0.2); tone('triangle', 523, 784, 0.4, 0.06, 0.25); } },
    /** the big / final wave arriving: a spooky (silly) horn */
    horde() { if (ready()) { tone('sawtooth', 196, 185, 0.5, 0.05); tone('sawtooth', 147, 139, 0.6, 0.05, 0.1); } },
    /** play an engine 'sound' event by name */
    play(name, vol = 1) {
      const v = Math.max(0.1, Math.min(1.5, Number(vol) || 1));
      switch (name) {
        case 'toss': this.lob(v); break;
        case 'boing': this.boing(v); break;
        case 'thunkBig': this.thunk(2); break;
        case 'thunk': this.thunk(1); break;
        case 'thunkSmall': this.thunk(0); break;
        case 'plop': this.plop(); break;
        case 'splat': this.splat(v); break;
        case 'cure': this.cure(); break;
        case 'knock': this.knock(); break;
        case 'pumpkin': this.pumpkin(); break;
        case 'bigWave': case 'finalWave': this.horde(); break;
        case 'calm': this.plant(); break;
        default: break;
      }
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended' && on) ctx.resume().catch(() => {}); },
  };
}
export const Sfx = createSfx();
