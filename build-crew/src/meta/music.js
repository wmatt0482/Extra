// The title and job music: the opening theme of Scott Joplin's The Entertainer (1902, public domain), in Build Crew's
// own plucked-synth arrangement. Composition/score: https://www.loc.gov/item/2023864238/ . No recorded audio or modern
// arrangement is used. It starts only after a gesture (unlock), ducks under speech, pauses when the tab is hidden and
// follows the music setting.
/** The melody as [MIDI note, length in 145 ms ticks]. */
// prettier-ignore
const phrase = [
  [62, 1], [63, 1], [64, 1], [72, 2], [64, 1], [72, 2], [64, 1], [72, 6], [72, 1],
  [74, 1], [75, 1], [76, 1], [72, 1], [74, 1], [76, 2], [71, 1], [74, 2], [72, 5],
  [62, 1], [63, 1], [64, 1], [72, 2], [64, 1], [72, 2], [64, 1], [72, 6], [69, 1],
  [67, 1], [66, 1], [69, 1], [72, 1], [76, 2], [74, 1], [72, 1], [69, 1], [74, 5],
];
let ctx,
  bus,
  timer = null,
  index = 0,
  ticks = 0,
  allowed = true,
  ducked = false,
  playing = false,
  /** AudioContext time before which the tune stays silent, so the celebration stinger plays alone. */
  holdUntil = 0;
/** Plays one plucked note: a fast 8 ms attack, then an exponential fade over dur seconds. */
function tone(note, dur, gain, type = 'triangle', delay = 0) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.value = 440 * 2 ** ((note - 69) / 12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.03);
}
/** Applies the current state to the bus volume (ducked under speech) and starts the one sequencer timer. The timer
 *  keeps ticking while muted so the tune resumes cleanly; a bass note lands on every fourth melody note. */
function sync() {
  if (bus) bus.gain.setTargetAtTime(allowed && playing ? (ducked ? 0.025 : 0.08) : 0, ctx.currentTime, 0.12);
  if (ctx && !timer)
    timer = setInterval(() => {
      if (!allowed || !playing || ctx.state !== 'running' || ctx.currentTime < holdUntil) return;
      if (ticks === 0) {
        const [note, length] = phrase[index++ % phrase.length];
        tone(note, 0.13 * length, 0.48);
        tone(note + 12, 0.08, 0.06, 'sine');
        ticks = length;
      }
      if (index % 4 === 0 && ticks === 1) tone(index % 8 ? 43 : 48, 0.18, 0.32, 'sine');
      ticks--;
    }, 145);
}
/** The music controls the app uses: unlock after a gesture, on (the setting), play (title and jobs, not modals),
 *  duck (while the voice speaks), suspend/resume (tab visibility) and the celebration stinger. */
export const Music = {
  unlock() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(ctx.destination);
    }
    ctx.resume().catch(() => {});
    sync();
  },
  on(v) {
    allowed = v;
    sync();
  },
  play(v) {
    playing = v;
    sync();
  },
  duck(v) {
    ducked = v;
    sync();
  },
  suspend() {
    ctx?.suspend().catch(() => {});
  },
  resume() {
    if (playing) ctx?.resume().catch(() => {});
  },
  // The job-complete stinger, in the tune's key (C major): a rising run from C4 up to E5 that lands on a full C major
  // chord over a low C, lasting about 2 s. The tune rests while it plays and picks up where it left off.
  celebrate() {
    if (!ctx || ctx.state !== 'running') return;
    holdUntil = ctx.currentTime + 2.2;
    [60, 64, 67, 72, 76].forEach((n, i) => {
      tone(n, 0.3, 0.55, 'triangle', 0.35 + i * 0.1);
      tone(n + 12, 0.18, 0.1, 'sine', 0.35 + i * 0.1);
    });
    for (const n of [48, 64, 67, 72, 79]) tone(n, 1.4, n < 50 ? 0.7 : 0.4, n < 50 ? 'sine' : 'triangle', 0.95);
    tone(36, 1.5, 0.7, 'sine', 0.95);
  },
};
