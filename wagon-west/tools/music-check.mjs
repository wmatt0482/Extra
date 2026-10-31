// Wagon West music check (SPEC v1.1 §2), node, no browser:   node wagon-west/tools/music-check.mjs
// The note lists: every bar of every tune sums to 4 beats in both voices, midi notes within 40-84, 16-32 bars, the three
// melodies differ; the first phrase of each tune is checked against a public-domain reference; the module imports without a window; and the engine is driven with a fake AudioContext to check the
// scheduling (the loop is seamless, tunes and moods switch on the bar line, 'off' is silent, the voice duck ramps).
import { Music, TUNES } from '../src/meta/music.js';

let failed = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failed++; console.error('FAIL: ' + msg); } };
const sum = (l) => l.reduce((a, [, b]) => a + b, 0);
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---- the note lists ----
const IDS = ['susanna', 'buffalo', 'tucker'];
ok(Object.keys(TUNES).length === 3 && IDS.every((id) => TUNES[id]), 'TUNES has susanna, buffalo, tucker');
for (const id of IDS) {
  const t = TUNES[id];
  ok(t.id === id, id + ': id');
  ok(typeof t.name === 'string' && t.name.length > 3, id + ': name');
  ok(Number.isFinite(t.bpm) && t.bpm >= 60 && t.bpm <= 140, id + ': bpm');
  ok(['G', 'D'].includes(t.key), id + ': key is G or D (' + t.key + ')');
  ok(Array.isArray(t.bars) && t.bars.length >= 16 && t.bars.length <= 32, id + ': 16-32 bars (' + (t.bars && t.bars.length) + ')');
  t.bars.forEach((bar, i) => {
    for (const voice of ['melody', 'bass']) {
      const l = bar[voice];
      ok(Array.isArray(l) && l.length > 0, `${id} bar ${i + 1} ${voice}: a list`);
      ok(near(sum(l), 4), `${id} bar ${i + 1} ${voice}: sums to ${sum(l)} beats, not 4`);
      for (const [m, b] of l) {
        ok(Number.isInteger(m) && (m === 0 || (m >= 40 && m <= 84)), `${id} bar ${i + 1} ${voice}: midi ${m} outside 40-84`);
        ok(b > 0 && near(b * 2, Math.round(b * 2)), `${id} bar ${i + 1} ${voice}: a length of ${b} beats is not a multiple of an eighth`);
      }
    }
    ok(bar.melody.some(([m]) => m), `${id} bar ${i + 1}: the melody is not all rests`);
  });
  // each tune comes home to its key note in the last bar
  const tonic = { G: 7, D: 2 }[t.key];
  ok(t.bars[t.bars.length - 1].melody.some(([m, b]) => m && m % 12 === tonic && b >= 0.5), id + ': the last bar reaches the key note');
}
const pitches = (t) => t.bars.flatMap((b) => b.melody.filter(([m]) => m).map(([m]) => m));
const similarity = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) if (a[i] === b[i]) s++; return s / n; };
for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) {
  const sim = similarity(pitches(TUNES[IDS[i]]), pitches(TUNES[IDS[j]]));
  ok(sim < 0.5, `${IDS[i]} and ${IDS[j]} melodies differ (${Math.round(sim * 100)}% of notes equal)`);
  ok(JSON.stringify(TUNES[IDS[i]].bars.map((b) => b.melody)) !== JSON.stringify(TUNES[IDS[j]].bars.map((b) => b.melody)), `${IDS[i]} vs ${IDS[j]}: not identical`);
}

// ---- the first phrase of each tune against a reference melody (public domain), note by note ----
// A reference is written in the SOURCE's own key as semitones above its tonic, with the source's octave kept (so
// "C4 E4 G4" in a C-major sheet is 0 4 7). The game's table is in G (or D) and may sit in another octave, so each
// tune names `tonic`, the midi note that stands for 0. `dur` is the sheet's rhythm in eighth notes where the table keeps
// it (Buffalo Gals); for the other two the table plays straight eighths, so only the pitches are compared.
//
//   Oh! Susanna, Stephen Foster, 1848. A piano setting in D major (ABC, github.com/baobach/abc_search,
//     database/abc/QmWY8qwejrP1LFbKn5yFXZAyCX3abvncsjQJxLCcaeekTt.abc), words under the notes:
//     "Oh, I | come from A- la- | ba- ma with a | ban- jo on my | knee!" = pickup D E | F A A B | A F D E | F F E D | E (6) D E.
//     Table pitches (pickup left for the end of the last bar): F# A A B A F# D E | F# F# E D E D E  = 4 7 7 9 7 4 0 2 | 4 4 2 0 2 0 2.
//   Buffalo Gals, John Hodges ("Cool White"), 1844, "Lubly Fan, Will You Cum Out To-night?". The chorus, vocal line of a
//     transcription of the 1844 sheet in C major, 2/2 (ABC, "John Hodges (1844)": github.com/oriolcolomefont/The-Sound-of-AI-workshop,
//     wikifonia-dataset/original-abc/JohnHodgesBuffaloGals.abc), words under the notes:
//     C CC2 E2 GG | A G2 G E2 EE | G F2 F D2 DD | A G2 G E4 : "Buf- fa- lo gals, won't ya | come out to- night, won't ya | come out
//     to- night, won't ya | come out to- night?" Two other ABC transcriptions (Bayard-style "Traditional" in G; Viola Ruth,
//     Pioneer Western Folk Tunes, 1948) agree from "come out tonight" on (A G G E | G F F D | A G G E) and differ only on the
//     first four syllables, which they sing as a rising 1 3 5 5; the 1844 sheet is the older source, so it is the reference.
//     The 1844 scan itself (IMSLP, "Lubly Fan Will You Cum Out To Night? (Hodges, John)") could not be opened from the build
//     machine; the transcription above is the stand-in.
//   Old Dan Tucker, Dan Emmett, 1843. "American Veteran Fifer", no. 112 (ABC, github.com/syntithenai/abc2book,
//     abcresources/jc/abc_tune_jc_201319413.abc), D major, 2/4, first strain:
//     (A B c#) | d d d A | d d d A/A/ | d d e f# | A A B c# | ...  The two sixteenth A's of bar 2 are one eighth in the table.
const REF = {
  susanna: { tonic: 67, pitches: [4, 7, 7, 9, 7, 4, 0, 2, 4, 4, 2, 0, 2, 0, 2] },
  buffalo: {
    tonic: 67,
    // Buf fa lo gals won't ya | come out to night won't ya | come out to night won't ya | come out to night
    pitches: [0, 0, 0, 4, 7, 7, 9, 7, 7, 4, 4, 4, 7, 5, 5, 2, 2, 2, 9, 7, 7, 4],
    dur: [1, 1, 2, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 4],
  },
  tucker: { tonic: 74, pitches: [0, 0, 0, -5, 0, 0, 0, -5, 0, 0, 2, 4, -5, -5, -3, -1] },
};
for (const id of IDS) {
  const ref = REF[id];
  const notes = TUNES[id].bars.flatMap((b) => b.melody).filter(([m]) => m);
  const got = notes.slice(0, ref.pitches.length).map(([m]) => m - ref.tonic);
  ok(JSON.stringify(got) === JSON.stringify(ref.pitches), `${id}: the first phrase is the reference melody (table ${got.join(' ')} vs reference ${ref.pitches.join(' ')})`);
  if (ref.dur) {
    const d = notes.slice(0, ref.dur.length).map(([, b]) => b * 2);
    ok(JSON.stringify(d) === JSON.stringify(ref.dur), `${id}: the first phrase has the sheet's rhythm (${d.join(' ')} vs ${ref.dur.join(' ')} eighths)`);
  }
}
// a guard for the mistake that was in the Buffalo Gals table: it must open on the key note, not the fifth
ok(TUNES.buffalo.bars[0].melody[0][0] % 12 === 7, 'Buffalo Gals opens on the key note (G)');

// ---- the module in node (no window, no AudioContext) ----
ok(typeof window === 'undefined', 'this run has no window');
for (const fn of ['unlock', 'on', 'tune', 'mood', 'duck', 'setVolume']) ok(typeof Music[fn] === 'function', 'Music.' + fn + ' is a function');
ok(Music.isPlaying === false, 'not playing at the start');
ok(JSON.stringify(Music.current) === JSON.stringify({ tune: 'susanna', mood: 'trail' }), 'current starts as susanna / trail');
ok(Music.unlock() === false, 'unlock() without WebAudio returns false and does not throw');
Music.on(true); Music.tune('buffalo'); Music.mood('camp'); Music.duck(true); Music.setVolume(0.5); Music.duck(false); Music.tune('nope'); Music.mood('nope');
ok(Music.current.tune === 'buffalo' && Music.current.mood === 'camp', 'tune() / mood() are remembered without a context; bad ids ignored');
ok(Music.isPlaying === false, 'nothing plays without a context');
Music.on(false); Music.tune('susanna'); Music.mood('trail'); Music.setVolume(1);

// ---- the engine, on a fake AudioContext ----
class Param {
  constructor(v = 1) { this.value = v; this.log = []; }
  setValueAtTime(v, t) { this.log.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v, t) { this.log.push(['lin', v, t]); this.value = v; return this; }
  exponentialRampToValueAtTime(v, t) { this.log.push(['exp', v, t]); this.value = v; return this; }
  setTargetAtTime(v, t, k) { this.log.push(['target', v, t, k]); this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
class Node { constructor() { this.out = []; } connect(n) { this.out.push(n); return n; } }
let fake = null;
class FakeCtx {
  constructor() {
    fake = this; this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 8000;
    this.destination = new Node(); this.notes = []; this.shakes = 0; this.noise = 0; this.gains = [];
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { const n = new Node(); n.gain = new Param(1); this.gains.push(n); return n; }
  createBiquadFilter() { const n = new Node(); n.frequency = new Param(1000); n.Q = new Param(1); n.type = ''; return n; }
  createBuffer(c, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  createOscillator() {
    const n = new Node(); n.type = ''; n.frequency = new Param(440); const ctx = this;
    n.start = (t) => { n.t0 = t; ctx.notes.push(n); }; n.stop = (t) => { n.t1 = t; };
    return n;
  }
  createBufferSource() {
    const n = new Node(); const ctx = this;
    n.start = (t, off, dur) => { n.t0 = t; ctx.noise++; (ctx.noiseBursts ||= []).push({ t, dur, via: n }); }; n.stop = () => {};
    return n;
  }
}
Music._useContext(FakeCtx);
ok(Music.unlock() === true && fake && fake.state === 'running', 'unlock() creates and resumes the fake context');
ok(Math.abs(fake.gains[0].gain.value - Math.pow(10, -14 / 20)) < 1e-6, 'master gain is -14 dB');

const freqToMidi = (f) => Math.round(69 + 12 * Math.log2(f / 440));
function run(seconds, step = 0.025) {
  const end = fake.currentTime + seconds;
  while (fake.currentTime < end) { fake.currentTime += step; Music._pump(); }
}
const melodyNotes = () => fake.notes.filter((n) => n.type === 'triangle');
const bassNotes = () => fake.notes.filter((n) => n.type === 'sine');

Music.on(true);
ok(Music.isPlaying === true, 'isPlaying after on(true)');
run(8);
let mel = melodyNotes(), bas = bassNotes();
ok(mel.length > 20 && bas.length > 10, 'notes are scheduled (melody ' + mel.length + ', bass ' + bas.length + ')');
ok(fake.noise > mel.length, 'a noise pluck per note plus shaker bursts');
// the first bar of Susanna as played: pitches in order, at 104 bpm
const spb = 60 / 104;
const firstBar = TUNES.susanna.bars[0].melody.filter(([m]) => m).map(([m]) => m);
ok(mel.slice(0, firstBar.length).every((n, i) => freqToMidi(n.frequency.log[0][1]) === firstBar[i]), 'the first bar plays the first bar of Oh! Susanna');
const t0 = mel[0].t0;
ok(near(mel[4].t0 - t0, 4 * 0.5 * spb) || Math.abs(mel[4].t0 - t0 - 2 * spb) < 1e-6, 'eighth notes are half a beat apart');
// trail has the shaker on the off-beats
const shakerSeen = fake.noiseBursts.filter((b) => b.dur > 0.07).length;
ok(shakerSeen >= 4, 'trail: the shaker plays (' + shakerSeen + ' bursts)');

// the loop is seamless: over 2 loops the bars arrive on a steady grid, no gap and no overlap
{
  const bar = 4 * spb, loop = TUNES.susanna.bars.length * bar;
  run(loop + 2);
  mel = melodyNotes();
  const lastStart = mel[mel.length - 1].t0;
  ok(lastStart > t0 + loop, 'the tune loops (notes continue past one full pass)');
  const bs = Music._state();
  ok(Math.abs(((bs.barT - t0) / bar) - Math.round((bs.barT - t0) / bar)) < 1e-6, 'bar lines stay on the grid across the loop');
  // the first note of the second pass lands exactly one loop after the first note of the first pass
  const again = mel.find((n) => n.t0 > t0 + loop - 1e-6);
  ok(again && Math.abs(again.t0 - (t0 + loop)) < 1e-6, 'the loop restarts on the bar line, seamlessly');
}

// switching tune: lands on a bar line, restarts the new tune from bar 1
{
  run(0.7); // mid-bar
  const before = melodyNotes().length;
  Music.tune('tucker');
  ok(Music.current.tune === 'tucker', 'current reports the asked tune');
  ok(Music._state().tuneId === 'susanna', 'the switch waits for the bar line');
  run(3);
  ok(Music._state().tuneId === 'tucker', 'the tune switched');
  const added = melodyNotes().slice(before);
  const tuckerFirst = TUNES.tucker.bars[0].melody.filter(([m]) => m).map(([m]) => m);
  // find the start of tucker's bar 1 among the notes added: its first pitches in order
  const seq = added.map((n) => freqToMidi(n.frequency.log[0][1]));
  const at = seq.findIndex((_, i) => tuckerFirst.every((m, k) => seq[i + k] === m));
  ok(at >= 0, 'the new tune starts from its first bar');
  if (at >= 0) {
    const bar = 4 * spb, startT = added[at].t0, prevBarT = Music._state().barT;
    ok(Math.abs((startT - t0) / bar - Math.round((startT - t0) / bar)) < 1e-6, 'and on a bar line of the old grid');
    void prevBarT;
  }
}

// switching mood: camp is 76 bpm, melody + bass, no shaker; off is silence at once
{
  Music.mood('camp');
  ok(Music._state().moodName === 'trail' && Music.current.mood === 'camp', 'the mood waits for the bar line');
  run(3);
  ok(Music._state().moodName === 'camp', 'camp took over');
  const nBefore = fake.noiseBursts.length;
  const mBefore = melodyNotes().length;
  run(2 * 4 * 60 / 76);
  const newBursts = fake.noiseBursts.slice(nBefore);
  const newMel = melodyNotes().slice(mBefore);
  ok(newMel.length > 8, 'camp keeps playing the melody');
  ok(newBursts.every((b) => b.dur < 0.07), 'camp: no shaker bursts');
  const g = newMel[1].out[0].out[0].gain.log; // pluck -> gain
  void g;
  const gaps = newMel.slice(1).map((n, i) => n.t0 - newMel[i].t0).filter((d) => d > 0.01);
  ok(Math.abs(Math.min(...gaps) - 0.5 * 60 / 76) < 1e-6, 'camp tempo is 76 bpm (an eighth is ' + Math.min(...gaps).toFixed(4) + ' s)');

  Music.mood('off');
  ok(Music.isPlaying === false && Music.current.mood === 'off', 'off: not playing');
  const n1 = fake.notes.length, nz1 = fake.noise;
  run(5);
  ok(fake.notes.length === n1 && fake.noise === nz1, 'off: no notes while a panel is open');
  Music.mood('post');
  ok(Music.isPlaying === true && Music.current.mood === 'post', 'post resumes the music at once');
  run(2);
  ok(fake.notes.length > n1, 'post plays after off');
  Music.mood('trail'); run(4);
  ok(Music._state().moodName === 'trail', 'back to trail');
}

// duck: -12 dB over 150 ms, and back
{
  const duckGain = fake.gains[2].gain;
  Music.duck(true);
  const last = duckGain.log[duckGain.log.length - 1];
  ok(last[0] === 'lin' && Math.abs(last[1] - Math.pow(10, -12 / 20)) < 1e-6 && Math.abs(last[2] - (fake.currentTime + 0.15)) < 1e-9, 'duck(true): -12 dB linear ramp over 150 ms');
  Music.duck(false);
  const l2 = duckGain.log[duckGain.log.length - 1];
  ok(l2[1] === 1 && Math.abs(l2[2] - (fake.currentTime + 0.15)) < 1e-9, 'duck(false): back to 0 dB over 150 ms');
}

// volume and stopping
{
  Music.setVolume(0.3);
  ok(Math.abs(fake.gains[1].gain.value - 0.3) < 1e-9, 'setVolume sets the volume gain');
  Music.setVolume(7); ok(fake.gains[1].gain.value === 1, 'setVolume clamps to 1');
  Music.on(false);
  ok(Music.isPlaying === false, 'on(false) stops');
  const n = fake.notes.length; run(3);
  ok(fake.notes.length === n, 'nothing scheduled after on(false)');
  Music.on(true); run(1);
  ok(fake.notes.length > n && Music.isPlaying, 'on(true) again plays (the choice is remembered, the clock restarts)');
  Music.on(false);
}

if (failed) { console.error(`\n${failed} of ${checks} music checks FAILED`); process.exit(1); }
console.log(`${checks} checks`);
for (const id of IDS) {
  const t = TUNES[id];
  console.log(`  ${t.name}: key ${t.key}, ${t.bars.length} bars, ${pitches(t).length} melody notes, range ${Math.min(...pitches(t))}-${Math.max(...pitches(t))}`);
}
console.log('ALL MUSIC CHECKS PASSED');
