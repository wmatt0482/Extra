// Spell Jump audio: everything synthesized with WebAudio, no files (except the natural voice's clips, v3.4: decoded
// with decodeVoice() and played with playVoice() on their own bus straight into the master, so the music ducks
// under them exactly like under the device voice). The AudioContext is created and resumed inside the first user
// gesture (iOS requirement). All calls are safe before unlock (no-ops).

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

function createAudio() {
  let ctx = null, master, sfxBus, musicBus, voiceBus, noiseBuf;
  let soundOn = true, musicOn = true, ducked = false, unlocked = false, voiceOn = false;
  let eng = null, nitroNode = null, musicTimer = 0, musicStep = 0, nextNoteAt = 0, lead, bass, leadGain, bassGain;

  function init() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { try { ctx = new AC(); } catch (e) { return false; } }
    master = ctx.createGain(); master.gain.value = 0.9;
    // master bus: a gentle glue compressor, then a fast limiter so stacked explosions never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.knee.value = 12; comp.attack.value = 0.004; comp.release.value = 0.2;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.1;
    master.connect(comp).connect(limit).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(master);   // the natural voice (not muted with effects)
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
  function noise(filterType, f0, f1, q, dur, peak, at = 0, attack = Math.min(0.04, dur * 0.3)) {
    const t = now() + at;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); env(g, t, peak, attack, dur);
    s.connect(f).connect(g).connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // crowd: three bandpassed noise layers with a slow swell and a jittery "voices" tremolo
  function crowd(dur, peak, at = 0) {
    const t = now() + at;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);
    out.gain.setTargetAtTime(0.0001, t + dur * 0.55, dur * 0.18);
    const trem = ctx.createGain(); trem.gain.value = 0.75;
    const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 6 + Math.random() * 3;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.25;
    lfo.connect(lfoAmt).connect(trem.gain);
    trem.connect(out).connect(sfxBus);
    for (const [f, q, g] of [[650, 0.9, 1], [1300, 1.2, 0.7], [2600, 1.6, 0.35]]) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.9 + Math.random() * 0.2;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.value = f;
      bp.frequency.setValueAtTime(f * 0.8, t); bp.frequency.linearRampToValueAtTime(f * 1.1, t + dur);
      const lg = ctx.createGain(); lg.gain.value = g;
      s.connect(bp).connect(lg).connect(trem);
      s.start(t, Math.random()); s.stop(t + dur * 1.6 + 0.1);
    }
    lfo.start(t); lfo.stop(t + dur * 1.6 + 0.1);
  }
  let lastBoomAt = -1;

  // ---------- music: two persistent oscillators, a 4-bar loop in A minor (Am F C G) ----------
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1];
  const RHY = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]; // lead gate per 16th
  const BPM = 128, SIX = 60 / BPM / 4;

  // music sits under the speech voice: ducked hard while the voice talks, a bit during a run
  const musicLevel = () => (voiceOn ? 0.1 : ducked ? 0.35 : 0.7);
  const sfxLevel = () => (soundOn ? (voiceOn ? 0.6 : 1) : 0);

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
    musicBus.gain.setTargetAtTime(musicLevel(), now(), 0.3);
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
      if (ctx) sfxBus.gain.setTargetAtTime(sfxLevel(), now(), 0.03);
    },
    music(on) {
      musicOn = !!on;
      if (!ctx) return;
      if (musicOn) startMusic(); else stopMusic();
    },
    duck(on) {
      ducked = !!on;
      if (ctx && musicTimer) musicBus.gain.setTargetAtTime(musicLevel(), now(), 0.4);
    },
    // speech is playing (TTS): duck the music hard and soften effects so the voice is never talked over
    voice(on) {
      voiceOn = !!on;
      if (!ctx) return;
      if (musicTimer) musicBus.gain.setTargetAtTime(musicLevel(), now(), voiceOn ? 0.05 : 0.35);
      sfxBus.gain.setTargetAtTime(sfxLevel(), now(), 0.05);
    },
    get speaking() { return voiceOn; },
    // ---- natural voice clips (src/spelling/cloudVoice.js) ----
    /** Decode an MP3 (ArrayBuffer) into an AudioBuffer (the callback form too, for older Safari). */
    decodeVoice(data) {
      if (!init()) return Promise.reject(new Error('no WebAudio'));
      return new Promise((resolve, reject) => {
        try { const p = ctx.decodeAudioData(data, resolve, reject); if (p && typeof p.then === 'function') p.then(resolve, reject); } catch (e) { reject(e); }
      });
    },
    /** Play a decoded clip on the voice bus. { done: Promise<boolean> (true: played to the end), stop() }. A context
     *  that is not running (no tap yet, iOS interruption) and does not resume within 800 ms → done(false), so the
     *  caller can fall back to the device voice. */
    playVoice(buffer) {
      let settled = false, src = null, timer = 0, resolveDone;
      const done = new Promise((r) => { resolveDone = r; });
      const finish = (ok) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        try { if (src) { src.onended = null; src.disconnect(); } } catch (_) { /* ignore */ }
        resolveDone(ok);
      };
      const start = () => {
        if (settled) return;
        clearTimeout(timer);
        try {
          src = ctx.createBufferSource(); src.buffer = buffer; src.connect(voiceBus);
          src.onended = () => finish(true);
          src.start();
        } catch (_) { finish(false); return; }
        timer = setTimeout(() => finish(true), (buffer.duration || 0) * 1000 + 1500);   // onended can be dropped
      };
      if (!buffer || !init()) finish(false);
      else if (ctx.state === 'running') start();
      else {
        timer = setTimeout(() => finish(false), 800);
        try { ctx.resume().then(() => { if (ctx.state === 'running') start(); else finish(false); }, () => finish(false)); } catch (_) { finish(false); }
      }
      return { done, stop() { try { if (src) src.stop(); } catch (_) { /* ignore */ } finish(false); } };
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
    // nitro: a hiss layer plus an afterburner roar (noise through a bandpass that opens up while held)
    nitro(on) {
      if (!ready()) return;
      if (on && !nitroNode) {
        const t = now();
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
        const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.16, t, 0.04);
        s.connect(f).connect(g).connect(sfxBus); s.start();
        const ab = ctx.createBufferSource(); ab.buffer = noiseBuf; ab.loop = true; ab.playbackRate.value = 0.6;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(220, t); bp.frequency.setTargetAtTime(1400, t, 0.35);
        const ag = ctx.createGain(); ag.gain.value = 0; ag.gain.setTargetAtTime(0.3, t, 0.06);
        ab.connect(bp).connect(ag).connect(sfxBus); ab.start();
        nitroNode = { s, g, ab, bp, ag };
      } else if (!on && nitroNode) {
        const n = nitroNode; nitroNode = null;
        const t = now();
        n.g.gain.setTargetAtTime(0, t, 0.05);
        n.bp.frequency.setTargetAtTime(200, t, 0.08);
        n.ag.gain.setTargetAtTime(0, t, 0.09);
        setTimeout(() => { try { n.s.stop(); n.ab.stop(); } catch (_) {} }, 500);
      }
    },
    // low boom + noise burst + sub thump; chained blasts are attenuated so a fuel depot doesn't pile up
    explosion(chain = 0) {
      if (!ready()) return;
      const t = now();
      const close = t - lastBoomAt < 0.35;
      lastBoomAt = t;
      const k = close ? 0.6 : 1;
      tone('sine', 95 - Math.min(3, chain) * 6, 32, 0.9, 0.55 * k);
      tone('sine', 58, 26, 0.45, 0.6 * k, sfxBus, 0.01);
      noise('lowpass', 2400, 140, 0.8, 0.95, 0.6 * k);
      noise('bandpass', 900, 220, 1.4, 0.4, 0.35 * k, 0.03);
      noise('highpass', 3000, 1200, 0.7, 0.25, 0.12 * k, 0.12);
    },
    ring() { if (ready()) { tone('triangle', 1568, 1568, 0.12, 0.13); tone('sine', 2093, 2093, 0.4, 0.13, sfxBus, 0.09); tone('sine', 3136, 3136, 0.25, 0.04, sfxBus, 0.09); } },
    pop() { if (ready()) { noise('highpass', 2600, 900, 0.8, 0.1, 0.22); tone('sine', 620, 180, 0.12, 0.12); } },
    comboUp(count = 2) {
      if (!ready()) return;
      const n = Math.max(0, Math.min(14, count - 2));
      const f = 330 * Math.pow(2, n / 12 * 1.5);
      tone('sawtooth', f, f * 1.5, 0.13, 0.05);
      tone('triangle', f * 2, f * 3, 0.13, 0.07);
    },
    cheer(dur = 1.2) { if (ready()) crowd(dur, dur < 0.9 ? 0.16 : 0.24); },
    fireworks() {
      if (!ready()) return;
      for (let r = 0; r < 3; r++) {
        const at = r * 0.32;
        tone('sine', 1300 + r * 200, 2500 + r * 300, 0.5, 0.035, sfxBus, at);          // whistle
        tone('sine', 120, 42, 0.35, 0.3, sfxBus, at + 0.52);                             // pop
        noise('lowpass', 2600, 300, 0.7, 0.3, 0.25, at + 0.52);
        for (let i = 0; i < 9; i++) noise('highpass', 5000, 3000, 0.7, 0.03, 0.07 + Math.random() * 0.06, at + 0.6 + Math.random() * 0.6, 0.002); // crackle
      }
    },
    orbit() {
      if (!ready()) return;
      const t = now();
      const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.05, t + 0.9); out.gain.setTargetAtTime(0.0001, t + 1.4, 0.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(2800, t + 1.2);
      lp.connect(out).connect(sfxBus);
      for (const [m, d] of [[57, -6], [64, 5], [69, -4], [73, 7], [76, 0]]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = N(m); o.detune.value = d;
        o.connect(lp); o.start(t); o.stop(t + 3.6);
      }
      noise('bandpass', 800, 3200, 0.6, 2.2, 0.06, 0, 0.9);
    },
    rejump() { if (ready()) { tone('square', 196, 784, 0.22, 0.05); tone('triangle', 392, 1568, 0.25, 0.09, sfxBus, 0.03); } },
    clank() { if (ready()) { tone('square', 820, 610, 0.06, 0.04); noise('bandpass', 3200, 1800, 6, 0.12, 0.18); } },
    click() { if (ready()) tone('square', 660, 520, 0.05, 0.06); },
    // ---- v3 spelling ----
    // soft key click (a lower tick for backspace)
    letter(back = false) { if (ready()) { tone('triangle', back ? 520 : 880, back ? 420 : 760, 0.035, 0.07); noise('highpass', 4000, 2500, 0.7, 0.02, 0.03, 0, 0.002); } },
    // bright rising major triad (a gentler two-note version for a fixed word)
    correct(soft = false) {
      if (!ready()) return;
      const notes = soft ? [659, 988] : [523, 659, 784, 1047];
      notes.forEach((f, i) => { tone('triangle', f, f, i === notes.length - 1 ? 0.32 : 0.12, soft ? 0.1 : 0.13, sfxBus, i * 0.075); tone('sine', f * 2, f * 2, 0.1, 0.03, sfxBus, i * 0.075); });
    },
    // soft, not punishing: a low two-note "hm-mm" (quieter still for a rejected Copy letter)
    oops(light = false) {
      if (!ready()) return;
      const p = light ? 0.05 : 0.1;
      tone('sine', 392, 370, 0.14, p); tone('sine', 330, 311, 0.2, p, sfxBus, 0.13);
    },
    missionComplete() {
      if (!ready()) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, i === 4 ? 0.5 : 0.12, 0.08, sfxBus, i * 0.09));
      [262, 392, 523].forEach((f) => tone('triangle', f, f, 0.9, 0.08, sfxBus, 0.45));
      setTimeout(() => api.cheer && api.cheer(1), 380);
    },
    cash() { if (ready()) { [0, 0.06, 0.12].forEach((at, i) => tone('square', 988 * (1 + i * 0.26), 988 * (1 + i * 0.26), 0.08, 0.1, sfxBus, at)); } },
    error() { if (ready()) tone('square', 180, 140, 0.15, 0.08); },
    fanfare() { if (ready()) [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i === 3 ? 0.4 : 0.1, 0.09, sfxBus, i * 0.1)); },
    // v3.3: mystery crate — a wooden rattle (the shake), then a sparkly reveal chime
    crateOpen() {
      if (!ready()) return;
      [0, 0.11, 0.22, 0.33].forEach((at) => noise('bandpass', 700, 420, 3, 0.07, 0.22, at, 0.003));
      [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.45 : 0.12, 0.1, sfxBus, 0.62 + i * 0.06));
      tone('sine', 3136, 3136, 0.35, 0.035, sfxBus, 0.8);
    },
    // v3.3: speller level-up — a short brass-like fanfare ending on a held chord
    levelUp() {
      if (!ready()) return;
      [392, 523, 659, 784].forEach((f, i) => tone('square', f, f, 0.1, 0.075, sfxBus, i * 0.09));
      [523, 659, 784, 1047].forEach((f) => tone('triangle', f, f, 0.7, 0.07, sfxBus, 0.4));
      tone('sine', 2093, 2093, 0.5, 0.03, sfxBus, 0.42);
    },
    // v3.3: word mastered / trophy — two soft bell strikes
    trophy() {
      if (!ready()) return;
      for (const [f, at] of [[1047, 0], [1568, 0.14]]) { tone('sine', f, f, 0.8, 0.11, sfxBus, at); tone('sine', f * 2.76, f * 2.76, 0.35, 0.025, sfxBus, at); }
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && unlocked && ctx.state !== 'running') ctx.resume().catch(() => {}); },
  };
  return api;
}

export const Audio = createAudio();
export default Audio;
