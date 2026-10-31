// Wagon West's own trail music (SPEC v1.1 §2): three songs the emigrants actually sang, all public domain, played on
// a plucked banjo-like Web Audio synth: "Oh! Susanna" (Stephen Foster, 1848), "Buffalo Gals" (1844) and "Old Dan
// Tucker" (1843). Not Spell Jump's loop: the shared Audio.music() is never started in this game; the settings toggle
// drives Music.on(bool). Like src/meta/sfx.js it owns a small AudioContext of its own, created and resumed inside the
// first user gesture (Music.unlock(), called from the app's first-tap handler; iOS Safari). No files, no fetch, no libraries.
//
//   Music.unlock()        create / resume the context (safe to call on every tap); starts the music if on(true) was asked
//   Music.on(bool)        start / stop; the choice is remembered (also if asked before the first tap)
//   Music.tune(id)        'susanna' | 'buffalo' | 'tucker': switches at the next bar (restarts that tune from bar 1)
//   Music.mood(m)         'trail' (104 bpm, banjo + bass + shaker) | 'camp' (76 bpm, quieter, melody + soft bass) |
//                         'post' (= camp) | 'off' (silence now: a panel is open); trail / camp / post switch at the next bar
//   Music.duck(bool)      the voice is speaking: -12 dB with a 150 ms ramp
//   Music.setVolume(v)    0..1 (default 1), on top of the -14 dBFS master
//   Music.isPlaying       true while the scheduler runs and the mood is not 'off'
//   Music.current         { tune, mood } as last asked
//
// A tune is { id, name, bpm, key, bars: [{ melody: [[midi|0, beats], ...], bass: [[midi|0, beats], ...] }, ...] }:
// 0 is a rest, every bar of both voices sums to 4 beats (4/4, an eighth note = 0.5 beat), 16 bars. The old 2/4 sheet
// music is written two measures to a bar, and the 8-bar song is played twice round before the loop restarts.
// Each song's pickup (the "I come" before "from Alabama") sits at the end of the last bar, so the loop is seamless.
// tools/music-check.mjs verifies the bars, the range and that the three differ.
//
// Sound: melody = a triangle oscillator through a closing low-pass, ~0.25 s exponential decay, plus a tiny filtered
// noise "pick" on each note; bass = a soft sine, 0.4 s decay; shaker = filtered-noise bursts on the off-beats, trail
// only. Everything: voices -> mood fade -> duck -> volume -> master (-14 dBFS). Scheduling like car-jump's audio.js:
// a 25 ms timer keeps the next 0.1 s of notes handed to the audio clock, so the bar clock never drifts and the loop
// restarts seamlessly.

const AC0 = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

// ---------- the songs, as note lists ----------
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error('bad note name ' + name);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
/** 'G4/1 r/2 A4/4' -> [[67, 0.5], [0, 1], [69, 2]]  (the number after the slash counts eighth notes) */
function line(str) {
  return str.trim().split(/\s+/).map((tok) => {
    const [n, d] = tok.split('/');
    return [n === 'r' ? 0 : midiOf(n), Number(d) / 2];
  });
}
// root-fifth walking bass: a chord per half bar, root then fifth on the quarter notes
const CHORD = { G: ['G2', 'D3'], D: ['D3', 'A2'], C: ['C3', 'G2'], A: ['A2', 'E3'] };
function walk(spec) {
  return spec.split(' ').flatMap((c) => [[midiOf(CHORD[c][0]), 1], [midiOf(CHORD[c][1]), 1]]);
}
function makeTune(id, name, bpm, key, rows) {
  const bars = rows.map(([m, b]) => ({ melody: line(m), bass: walk(b) }));
  return { id, name, bpm, key, bars: bars.concat(bars.map((b) => ({ melody: b.melody.map((n) => n.slice()), bass: b.bass.map((n) => n.slice()) }))) };
}

// Oh! Susanna (Foster, 1848), G major. Verse: "I come from Alabama with my banjo on my knee, I'm going to Louisiana,
// my true love for to see"; chorus: "Oh! Susanna, oh don't you cry for me, for I come from Alabama ..."
// (scale degrees 1 2 3 5 5 6 5 3 | 1 2 3 3 2 1 2 | 1 2 3 5 5 6 5 3 | 1 2 3 3 2 2 1 | 4 4 6 6 6 5 5 3 1 2 | 1 2 3 5 ...)
const SUSANNA = makeTune('susanna', 'Oh! Susanna', 104, 'G', [
  ['B4/1 D5/1 D5/1 E5/1 D5/1 B4/1 G4/1 A4/1', 'G G'],
  ['B4/1 B4/1 A4/1 G4/1 A4/2 G4/1 A4/1', 'G D'],
  ['B4/1 D5/1 D5/1 E5/1 D5/1 B4/1 G4/1 A4/1', 'G G'],
  ['B4/1 B4/1 A4/1 A4/1 G4/4', 'D G'],
  ['C5/1 C5/1 E5/1 E5/1 E5/1 D5/1 D5/1 B4/1', 'C G'],
  ['G4/1 A4/1 G4/1 A4/1 B4/1 D5/1 D5/1 E5/1', 'G G'],
  ['D5/1 B4/1 G4/1 A4/1 B4/1 B4/1 A4/1 A4/1', 'G D'],
  ['G4/6 G4/1 A4/1', 'G G'],
]);

// Buffalo Gals (John Hodges, 1844, "Lubly Fan, Will You Cum Out To-night?"), the chorus in G major: "Buffalo gals, won't
// you come out tonight, come out tonight, come out tonight; Buffalo gals, won't you come out tonight and dance by the
// light of the moon". Checked note by note against a transcription of the 1844 sheet (key of C there, here moved up a
// fifth to G; the reference is recorded in tools/music-check.mjs). The earlier table here was wrong: it began on the
// fifth (5 5 3 5 6 5 3 1); the tune begins on the key note, three times (1 1 1 3 5 5 | 6 5 5 3 3 3 | 5 4 4 2 2 2 | 6 5 5 3).
// Rhythm is the sheet's: eighths and quarters (/1 and /2). The last bar's rest and pickup note lead into the verse in the
// sheet music; here they bring the loop back round to the chorus.
const BUFFALO = makeTune('buffalo', 'Buffalo Gals', 104, 'G', [
  ['G4/1 G4/1 G4/2 B4/2 D5/1 D5/1', 'G G'],
  ['E5/1 D5/2 D5/1 B4/2 B4/1 B4/1', 'C G'],
  ['D5/1 C5/2 C5/1 A4/2 A4/1 A4/1', 'D D'],
  ['E5/1 D5/2 D5/1 B4/4', 'C G'],
  ['G4/1 G4/1 G4/2 B4/2 D5/1 D5/1', 'G G'],
  ['E5/1 D5/2 D5/1 B4/2 B4/2', 'C G'],
  ['D5/2 C5/1 C5/1 B4/2 A4/1 A4/1', 'D D'],
  ['G4/4 r/2 D5/2', 'G G'],
]);

// Old Dan Tucker (Dan Emmett, 1843), D major: "Old Dan Tucker was a fine old man, washed his face in a frying pan, combed
// his hair with a wagon wheel, died with a toothache in his heel"; chorus: "Get out the way, Old Dan Tucker, you're
// too late to come to supper." From a 19th-century fife-and-drum setting (American Veteran Fifer, no. 112; the reference
// is recorded in tools/music-check.mjs): the first strain opens on the key note three times, then drops to the fifth
// below (1 1 1 5 | 1 1 1 5 | 1 1 2 3 | 5 5 6 7); the chorus climbs back up. The fife's quick sixteenth pairs are
// played as single eighths. The earlier table here opened on the wrong notes (5 5 5 3 | 5 5 5 2).
const TUCKER = makeTune('tucker', 'Old Dan Tucker', 104, 'D', [
  ['D5/1 D5/1 D5/1 A4/1 D5/1 D5/1 D5/1 A4/1', 'D D'],
  ['D5/1 D5/1 E5/1 F#5/1 A4/1 A4/1 B4/1 C#5/1', 'D A'],
  ['D5/1 D5/1 D5/1 A4/1 D5/1 D5/1 D5/1 A4/1', 'D D'],
  ['D5/1 D5/1 E5/1 F#5/1 A4/1 A4/1 B4/1 D5/1', 'D A'],
  ['F#5/1 F#5/1 F#5/2 E5/1 D5/1 B4/1 D5/1', 'D G'],
  ['E5/1 E5/1 E5/1 F#5/1 A4/1 A4/1 B4/1 D5/1', 'A G'],
  ['F#5/1 F#5/1 A5/2 F#5/1 D5/1 B4/1 D5/1', 'D G'],
  ['E5/1 E5/1 E5/1 F#5/1 A4/1 C#5/1 D5/2', 'A D'],
]);

export const TUNES = { susanna: SUSANNA, buffalo: BUFFALO, tucker: TUCKER };

// ---------- moods ----------
// bpm; the level of the banjo, the bass and the shaker (0 = not played)
const MOODS = {
  trail: { bpm: 104, mel: 1, bass: 1, shaker: 1 },
  camp: { bpm: 76, mel: 0.6, bass: 0.55, shaker: 0 },
  post: { bpm: 76, mel: 0.6, bass: 0.55, shaker: 0 },
};
const MASTER_DB = -14, DUCK_DB = -12, DUCK_RAMP = 0.15;
const db = (x) => Math.pow(10, x / 20);
const TICK_MS = 25, AHEAD = 0.1;

function createMusic() {
  let AC = AC0;
  let ctx = null, master = null, vol = null, duckG = null, moodG = null, noiseBuf = null;
  let enabled = false;            // Music.on(...): the child's choice
  let tuneId = 'susanna', moodName = 'trail', volume = 1, ducked = false;
  let pendingTune = null, pendingMood = null;
  let timer = 0;
  let barIdx = 0, barT = 0, cur = null;   // cur = the bar being handed to the audio clock

  function init() {
    if (ctx) return true;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (_) { try { ctx = new AC(); } catch (e) { ctx = null; return false; } }
    try {
      master = ctx.createGain(); master.gain.value = db(MASTER_DB); master.connect(ctx.destination);
      vol = ctx.createGain(); vol.gain.value = volume; vol.connect(master);
      duckG = ctx.createGain(); duckG.gain.value = ducked ? db(DUCK_DB) : 1; duckG.connect(vol);
      moodG = ctx.createGain(); moodG.gain.value = 0;   // sync() fades it up when the music starts moodG.connect(duckG);
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; return false; }
    return true;
  }

  // ---------- voices ----------
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function noiseBurst(t, dur, peak, type, f, q, attack = 0.002) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(moodG);
    src.start(t, Math.random() * 0.3, dur + 0.02);
  }
  /** the banjo: a triangle with a fast exponential decay (~0.25 s) through a closing low-pass, plus a tiny pick */
  function pluck(midi, t, vel) {
    const f = hz(midi);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(Math.min(9000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.2), t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(lp); lp.connect(g); g.connect(moodG);
    o.start(t); o.stop(t + 0.3);
    noiseBurst(t, 0.03, 0.12 * vel, 'highpass', 1800, 0.7, 0.001);
  }
  /** the bass: a soft sine, 0.4 s decay */
  function thump(midi, t, vel) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hz(midi), t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(moodG);
    o.start(t); o.stop(t + 0.45);
  }
  /** the shaker: a short filtered-noise burst */
  function shake(t, vel) { noiseBurst(t, 0.06, 0.1 * vel, 'bandpass', 6500, 0.8, 0.003); }

  // ---------- the bar clock ----------
  /** every event of one bar: { pos (beats from the bar line), kind, midi, vel } sorted by time */
  function barEvents(bar, mood) {
    const ev = [];
    let p = 0;
    for (const [m, b] of bar.melody) { if (m) ev.push({ pos: p, kind: 'mel', midi: m, vel: (Number.isInteger(p) ? 1 : 0.8) * mood.mel }); p += b; }
    p = 0;
    for (const [m, b] of bar.bass) { if (m) ev.push({ pos: p, kind: 'bass', midi: m, vel: mood.bass }); p += b; }
    if (mood.shaker) for (let k = 0; k < 4; k++) ev.push({ pos: k + 0.5, kind: 'shk', vel: mood.shaker });
    return ev.sort((a, b) => a.pos - b.pos);
  }
  function beginBar() {
    // tune and mood changes land on the bar line
    if (pendingTune) { tuneId = pendingTune; pendingTune = null; barIdx = 0; }
    if (pendingMood) { moodName = pendingMood; pendingMood = null; }
    const tune = TUNES[tuneId];
    const mood = MOODS[moodName] || MOODS.trail;
    if (barIdx >= tune.bars.length) barIdx = 0;
    cur = { spb: 60 / mood.bpm, ev: barEvents(tune.bars[barIdx], mood), i: 0 };
  }
  function pump() {
    if (!ctx || !enabled || moodName === 'off') return;
    if (ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* needs a gesture */ } return; }
    const now = ctx.currentTime;
    // the page slept (a throttled background timer): start over cleanly rather than racing to catch up
    if (barT + (cur ? 4 * cur.spb : 0) < now - 0.5) { barT = now + 0.05; cur = null; }
    const horizon = now + AHEAD;
    for (let guard = 0; guard < 400; guard++) {
      if (!cur) { if (barT > horizon) break; beginBar(); }
      const e = cur.ev[cur.i];
      if (!e) { barT += 4 * cur.spb; cur = null; barIdx++; continue; }
      const t = barT + e.pos * cur.spb;
      if (t > horizon) break;
      cur.i++;
      if (t < now - 0.02) continue;     // already past: skip, never play late
      const at = Math.max(t, now);
      if (e.kind === 'mel') pluck(e.midi, at, e.vel);
      else if (e.kind === 'bass') thump(e.midi, at, e.vel);
      else shake(at, e.vel);
    }
  }
  function startTimer() { if (!timer) timer = setInterval(pump, TICK_MS); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }
  /** restart the bar clock on the next audio tick (after being off / stopped) */
  function restartClock() { cur = null; barT = ctx ? ctx.currentTime + 0.06 : 0; }
  function ramp(param, to, secs) {
    const t = ctx.currentTime;
    try { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + secs); } catch (_) { param.value = to; }
  }
  /** start or stop the scheduler to match the choice, the context and the mood */
  function sync() {
    const run = !!(ctx && enabled && moodName !== 'off');
    if (run && !timer) { restartClock(); ramp(moodG.gain, 1, 0.03); startTimer(); pump(); }
    else if (!run && timer) { stopTimer(); if (ctx) ramp(moodG.gain, 0, 0.08); cur = null; }
  }

  // visibility: a hidden page stops the audio clock (battery, and iOS kills it anyway); coming back resumes it
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); }
      else if (ctx.state !== 'running') ctx.resume().catch(() => {});
    });
  }

  const api = {
    /** Create / resume the AudioContext; call it from a user gesture (every tap is fine). */
    unlock() {
      if (!AC) return false;
      try {
        const as = typeof navigator !== 'undefined' ? navigator.audioSession : null;
        if (as && typeof as.type === 'string' && as.type === 'auto') as.type = 'playback';   // iOS 17: play on silent
      } catch (_) { /* older engines */ }
      if (!init()) return false;
      if (ctx.state !== 'running') {
        try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ }
        try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (_) { /* ignore */ }
      }
      sync();
      return true;
    },
    /** Start / stop the music. Remembered: on(true) before the first tap starts it at unlock(). */
    on(v) { enabled = !!v; sync(); },
    /** 'susanna' | 'buffalo' | 'tucker': switches at the next bar (immediately when nothing is playing). */
    tune(id) {
      if (!TUNES[id]) return;
      if (timer) { pendingTune = id === tuneId ? null : id; return; }   // playing: wait for the bar line
      if (id !== tuneId) { tuneId = id; barIdx = 0; }
      pendingTune = null; cur = null;
    },
    /** 'trail' | 'camp' | 'post' | 'off'. 'off' is silent at once; the others change at the next bar. */
    mood(m) {
      if (m !== 'off' && !MOODS[m]) return;
      if (m === 'off') { pendingMood = null; moodName = 'off'; sync(); return; }
      if (moodName === 'off') { moodName = m; pendingMood = null; sync(); return; }   // coming back: restart on the spot
      if (timer) pendingMood = m; else moodName = m;
    },
    /** The voice is speaking: -12 dB with a 150 ms ramp (and back). */
    duck(v) {
      ducked = !!v;
      if (ctx) ramp(duckG.gain, ducked ? db(DUCK_DB) : 1, DUCK_RAMP);
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
      if (ctx) { try { vol.gain.setTargetAtTime(volume, ctx.currentTime, 0.03); } catch (_) { vol.gain.value = volume; } }
    },
    get isPlaying() { return !!timer && moodName !== 'off'; },
    get enabled() { return enabled; },
    get volume() { return volume; },
    get ducked() { return ducked; },
    get current() { return { tune: pendingTune || tuneId, mood: pendingMood || moodName }; },
    // test hooks (tools/music-check.mjs drives the module with a fake AudioContext)
    _useContext(cls) { AC = cls; },
    _pump: pump,
    _state() { return { barIdx, barT, tuneId, moodName, pendingTune, pendingMood, timer: !!timer }; },
  };
  return api;
}

export const Music = createMusic();
export default Music;
