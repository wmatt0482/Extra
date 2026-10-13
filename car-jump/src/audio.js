// Ramp Rage audio: everything synthesized with WebAudio, no files. The AudioContext is created and
// resumed inside the first user gesture (iOS requirement). All calls are safe before unlock (no-ops).

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

function createAudio() {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let soundOn = true, musicOn = true, ducked = false, unlocked = false;
  let eng = null, nitroNode = null, musicTimer = 0, musicStep = 0, nextNoteAt = 0, lead, bass, leadGain, bassGain;

  function init() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { try { ctx = new AC(); } catch (e) { return false; } }
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  const now = () => ctx.currentTime;
  const ready = () => ctx && unlocked && ctx.state === 'running';

  function env(gainNode, t, peak, attack, decay) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(type, f0, f1, dur, peak, dest = sfxBus, at = 0) {
    const t = now() + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, peak, 0.005, dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(filterType, f0, f1, q, dur, peak, at = 0) {
    const t = now() + at;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); env(g, t, peak, Math.min(0.04, dur * 0.3), dur);
    s.connect(f).connect(g).connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---------- music: two persistent oscillators, a 4-bar loop in A minor (Am F C G) ----------
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1];
  const RHY = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]; // lead gate per 16th
  const BPM = 128, SIX = 60 / BPM / 4;

  function startMusic() {
    if (!ready() || musicTimer) return;
    lead = ctx.createOscillator(); lead.type = 'square';
    bass = ctx.createOscillator(); bass.type = 'triangle';
    leadGain = ctx.createGain(); leadGain.gain.value = 0;
    bassGain = ctx.createGain(); bassGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    lead.connect(leadGain).connect(lp).connect(musicBus);
    bass.connect(bassGain).connect(musicBus);
    lead.start(); bass.start();
    nextNoteAt = now() + 0.1;
    musicBus.gain.setTargetAtTime(ducked ? 0.35 : 0.7, now(), 0.3);
    musicTimer = setInterval(scheduleMusic, 40);
    scheduleMusic();
  }
  function stopMusic() {
    if (!musicTimer) return;
    clearInterval(musicTimer); musicTimer = 0;
    const t = now();
    musicBus.gain.setTargetAtTime(0, t, 0.08);
    const l = lead, b = bass;
    setTimeout(() => { try { l.stop(); b.stop(); } catch (_) {} }, 400);
  }
  function scheduleMusic() {
    if (!ctx) return;
    while (nextNoteAt < now() + 0.25) {
      const step = musicStep % 16, bar = Math.floor(musicStep / 16) % 4, loop = Math.floor(musicStep / 64);
      const chord = CHORDS[bar];
      const t = nextNoteAt;
      if (RHY[step]) {
        const oct = (loop % 2 && step >= 12) ? 24 : 12;
        lead.frequency.setValueAtTime(N(chord[ARP[step]] + oct), t);
        leadGain.gain.setValueAtTime(0.045, t);
        leadGain.gain.setTargetAtTime(0.0001, t + SIX * 0.45, 0.02);
      }
      if (step % 2 === 0) {
        const root = chord[0] - 24 + (step % 8 === 4 ? 12 : 0);
        bass.frequency.setValueAtTime(N(root), t);
        bassGain.gain.setValueAtTime(0.16, t);
        bassGain.gain.setTargetAtTime(0.0001, t + SIX * 1.4, 0.04);
      }
      musicStep++; nextNoteAt += SIX;
    }
  }

  // ---------- engine hum: saw + square through a lowpass, pitch follows speed ----------
  function ensureEngine() {
    if (eng || !ready()) return eng;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    a.type = 'sawtooth'; b.type = 'square'; b.detune.value = -1200 + 7;
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 3;
    g.gain.value = 0;
    a.connect(lp); b.connect(lp); lp.connect(g).connect(sfxBus);
    a.start(); b.start();
    eng = { a, b, lp, g, on: false };
    return eng;
  }

  const api = {
    get unlocked() { return unlocked; },
    unlock() {
      if (!AC) return;
      if (!init()) return;
      // called on every pointerdown: cheap once running; also recovers iOS's 'interrupted' state
      // (call, Siri, app switch), which can only be resumed from inside a gesture
      if (unlocked && ctx.state === 'running') return;
      try {
        if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
        // a 1-sample silent buffer started inside the gesture fully unlocks iOS
        const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
      } catch (_) { /* ignore */ }
      unlocked = true;
      const kick = () => { if (musicOn) startMusic(); };
      if (ctx.state === 'running') kick(); else ctx.resume().then(kick).catch(() => {});
    },
    setSound(on) {
      soundOn = !!on;
      if (ctx) sfxBus.gain.setTargetAtTime(soundOn ? 1 : 0, now(), 0.03);
    },
    music(on) {
      musicOn = !!on;
      if (!ctx) return;
      if (musicOn) startMusic(); else stopMusic();
    },
    duck(on) {
      ducked = !!on;
      if (ctx && musicTimer) musicBus.gain.setTargetAtTime(ducked ? 0.35 : 0.7, now(), 0.4);
    },
    // speed01: 0..1 (null or negative = engine off)
    engine(speed01) {
      if (!ready()) return;
      if (speed01 == null || speed01 < 0) {
        if (eng && eng.on) { eng.g.gain.setTargetAtTime(0, now(), 0.08); eng.on = false; }
        return;
      }
      const e = ensureEngine(); if (!e) return;
      const s = Math.max(0, Math.min(1, speed01));
      const t = now();
      e.a.frequency.setTargetAtTime(48 + s * 150, t, 0.06);
      e.b.frequency.setTargetAtTime(48 + s * 150, t, 0.06);
      e.lp.frequency.setTargetAtTime(380 + s * 1500, t, 0.08);
      e.g.gain.setTargetAtTime(0.05 + s * 0.06, t, 0.08);
      e.on = true;
    },
    whoosh() { if (ready()) { noise('bandpass', 300, 2600, 1.2, 0.55, 0.5); tone('sine', 220, 90, 0.5, 0.12); } },
    smash() {
      if (!ready()) return;
      noise('lowpass', 3200, 300, 0.7, 0.22, 0.7);
      noise('bandpass', 1800, 900, 4, 0.12, 0.35, 0.02);
      tone('sine', 140, 45, 0.18, 0.5);
    },
    coin() { if (ready()) { tone('square', 988, 988, 0.07, 0.12); tone('square', 1319, 1319, 0.2, 0.12, sfxBus, 0.07); } },
    flip() { if (ready()) { noise('highpass', 900, 4200, 0.8, 0.28, 0.35); tone('triangle', 330, 880, 0.22, 0.12); } },
    land(quality) {
      if (!ready()) return;
      tone('sine', 110, 38, 0.28, 0.9);
      noise('lowpass', 900, 120, 0.7, 0.2, 0.5);
      if (quality === 'crash') { noise('bandpass', 2400, 600, 2, 0.35, 0.6, 0.03); tone('sawtooth', 160, 60, 0.3, 0.2, sfxBus, 0.02); }
      if (quality === 'perfect') { tone('triangle', 784, 784, 0.12, 0.14, sfxBus, 0.08); tone('triangle', 1175, 1175, 0.25, 0.14, sfxBus, 0.18); }
    },
    nitro(on) {
      if (!ready()) return;
      if (on && !nitroNode) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
        const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.22, now(), 0.04);
        s.connect(f).connect(g).connect(sfxBus); s.start();
        nitroNode = { s, g };
      } else if (!on && nitroNode) {
        const n = nitroNode; nitroNode = null;
        n.g.gain.setTargetAtTime(0, now(), 0.05);
        setTimeout(() => { try { n.s.stop(); } catch (_) {} }, 300);
      }
    },
    click() { if (ready()) tone('square', 660, 520, 0.05, 0.06); },
    cash() { if (ready()) { [0, 0.06, 0.12].forEach((at, i) => tone('square', 988 * (1 + i * 0.26), 988 * (1 + i * 0.26), 0.08, 0.1, sfxBus, at)); } },
    error() { if (ready()) tone('square', 180, 140, 0.15, 0.08); },
    fanfare() { if (ready()) [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i === 3 ? 0.4 : 0.1, 0.09, sfxBus, i * 0.1)); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && unlocked && ctx.state !== 'running') ctx.resume().catch(() => {}); },
  };
  return api;
}

export const Audio = createAudio();
export default Audio;
