// The voice of Wagon West (v1.3.2): ONE place where every spoken line goes through, so that
//   1. the natural voice never hands a line to the device ("robot") voice: a line is played straight from its clip
//      (cloud.play, not tts.say: tts.say gives a clip that is slow to load, 4 s, to the device voice), and a line whose clip
//      could not be made in time is skipped (its words are on screen), never read by the device;
//   2. speech is serialized: one utterance at a time. A line the screen itself reads (a card, a letter line, a panel's
//      question: `say`) replaces what is playing; the lines of toasts and pops (`later`) never cut anything: they wait for
//      the voice to be idle, and for the panels / the dictation / a card to be closed (`hold()`), and are dropped when stale;
//   3. a line that is about to be said is asked for first and waited for (`ready`, up to WAIT_MS, asking again quietly),
//      while the clips of the whole game are prepared in the background in SMALL batches (BATCH) in the order the child will
//      need them (this leg first), stepping aside whenever a line is waiting for its own clip. (cloudVoice.prepare runs one
//      request per voice at a time: a just-in-time line used to queue behind an 80-text background request, miss the 2.5 s
//      wait and be read by the device voice: v1.3.1's "old robot voices".)
// The device voice speaks only when the natural voice is not in use at all: no family code, a device voice picked, or a
// server that has no key / does not accept the family (`naturalVoice()`).
// Same design as Build Crew's voice.js (bc-voice).

export const CLIP_MAX = 200;
/** How long a line waits for its clip (the server making it, then loading it) before it is skipped. */
export const WAIT_MS = 9000;
/** The blocking wait of a screen that wants the clips "a moment before" it opens (the speech itself waits longer). */
export const HEAD_START_MS = 2500;
/** Clips asked for per background request: small enough that a waiting line never queues behind a long one. */
export const BATCH = 8;
/** A toast's / pop's line starts only after the voice has been idle this long (a screen reading line by line is not interrupted). */
export const AMBIENT_GAP_MS = 900;
/** A toast's / pop's line that waited longer than this is dropped: the moment has passed. */
export const AMBIENT_MAX_AGE_MS = 20000;
const POLL_MS = 150;

/** A line cut into pieces the natural voice can say (≤ 200 characters, at sentence breaks, else at commas / spaces). */
export function splitSay(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length <= CLIP_MAX) return [t];
  const out = [];
  let cur = '';
  const push = (piece) => {
    if (piece.length > CLIP_MAX) { for (const w of piece.split(/(?<=,)\s+|\s+/)) push(w); return; }
    if (!cur) cur = piece; else if (cur.length + 1 + piece.length <= CLIP_MAX) cur += ' ' + piece; else { out.push(cur); cur = piece; }
  };
  for (const sentence of t.split(/(?<=[.!?])\s+/)) push(sentence);
  if (cur) out.push(cur);
  return out;
}
/** Several lines as the unique clip-sized pieces, in order. */
export const speechChunks = (texts) => [...new Set((texts || []).flatMap((t) => splitSay(t)))];

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * deps: { tts, cloud, duck(on) (the music / effects duck while a clip plays), hold() → true while a panel, the dictation,
 *         a card or a mini-game is open (toast lines wait), sleep?, now? }
 */
export function createSpeech({ tts, cloud, duck = () => {}, hold = () => false, sleep = defaultSleep, now = Date.now }) {
  let epoch = 0;             // bumped by every line the screen reads and by cancel(): what is playing / waiting for its clip stops
  let waiting = 0;           // lines waiting for their clip: the background preparation pauses while this is above zero
  let pump = 0;              // identifies the running background preparation (a newer list replaces it)
  let fgBusy = 0;            // lines the screen reads that are in progress
  let current = Promise.resolve();   // whatever is playing now (a new line starts after it has been cut)
  let curActive = 0;                 // lines in progress (the screen's and the toasts')
  let lastEnd = 0;
  let engine = '';
  let slowUntil = 0;         // after a line missed its clip, the next ones do not each wait the full time
  const ambient = [];        // toast / pop lines in turn
  let worker = false, ambPlaying = false;
  const stats = { spoken: 0, silent: 0, cut: 0, device: 0, cloud: 0, dropped: 0 };
  const events = [];         // (tests) what the voice did: { text, how: 'cloud'|'device'|'silent'|'cut'|'dropped' }
  const note = (text, how) => { stats[how] = (stats[how] || 0) + 1; events.push({ text, how, at: now() }); if (events.length > 200) events.shift(); };

  // ---- the voice in use ----
  /** Is the natural voice the voice right now? Chosen, in a family, and the server can make clips (it has a key and accepts the family). */
  function naturalVoice() {
    return !!(cloud && cloud.active && cloud.server.key !== false && cloud.server.error !== 'forbidden');
  }
  const hardStop = () => { try { tts.cancel(); } catch (_) { /* ignore */ } };

  // ---- the clips ----
  const missing = (list) => list.filter((t) => !cloud.has(t));
  /** Resolves true once the clips of `texts` are ready, or false after `ms` (asking again, quietly, until then). True at
   *  once without a natural voice. A line waiting for its clip never queues behind the background preparation. */
  async function ready(texts, ms = WAIT_MS, stale = () => false) {
    if (!naturalVoice()) return true;
    const list = speechChunks(texts);
    if (!missing(list).length) return true;
    if (now() < slowUntil) ms = Math.min(ms, HEAD_START_MS);
    waiting++;
    try {
      const end = now() + ms;
      while (missing(list).length && now() < end && !stale()) {
        const res = await Promise.race([cloud.prepare(missing(list)).catch(() => null), sleep(Math.max(0, end - now())).then(() => 'late')]);
        if (res === 'late' || (res && ['no-key', 'forbidden', 'daily-limit', 'no-voice', 'no-code'].includes(res.error))) break;
        if (missing(list).length) await sleep(700);
      }
      const ok = !missing(list).length;
      slowUntil = ok ? 0 : now() + 30000;
      return ok;
    } finally { waiting--; }
  }
  /** Prepare these lines in the background, in this order, a small batch at a time. A newer call replaces the one running. */
  function prepareBulk(texts) {
    if (!cloud || !cloud.active) return Promise.resolve();
    const mine = ++pump;
    const todo = speechChunks(texts).filter((t) => !cloud.has(t));
    return (async () => {
      for (let i = 0; i < todo.length && mine === pump; i += BATCH) {
        while (waiting > 0 && mine === pump) await sleep(120);
        if (mine !== pump) return;
        const batch = todo.slice(i, i + BATCH).filter((t) => !cloud.has(t));
        if (!batch.length) continue;
        const res = await cloud.prepare(batch).catch(() => null);
        if (!res || (!res.ok && res.error !== 'no-voice')) await sleep(1500);      // offline, limit: do not hammer the service
        if (res && ['no-key', 'forbidden', 'daily-limit', 'no-code'].includes(res.error)) return;
      }
    })();
  }

  // ---- playing ----
  // Clips follow each other and a newer one cuts the older: the music comes back up only when none is playing.
  let playing = 0, duckTimer = 0;
  function duckBy(d) {
    const was = playing;
    playing = Math.max(0, playing + d);
    if (!was && playing) { clearTimeout(duckTimer); duck(true); }
    if (was && !playing) { clearTimeout(duckTimer); duckTimer = setTimeout(() => { if (!playing) duck(false); }, 180); }
  }
  /** Plays the clip for `text`, trying again when it is slow to load. true: it played to the end. */
  async function playClip(text, mine) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (mine !== epoch || (typeof document !== 'undefined' && document.hidden)) return false;
      duckBy(1);
      let res;
      try { res = await cloud.play(text); } finally { duckBy(-1); }
      if (res === 'ok') return true;
      if (res === 'cancel') return false;
      await sleep(300);
    }
    return false;
  }
  /** One line (its pieces) to the end: true spoken · false silent (no clip in time / nothing to speak with) · null cut off. */
  async function speakChunks(chunks, mine) {
    const text = chunks.join(' ');
    if (!chunks.length || mine !== epoch) return null;
    if (naturalVoice()) {
      const ok = await ready(chunks, WAIT_MS, () => mine !== epoch);
      if (mine !== epoch) { note(text, 'cut'); return null; }
      if (naturalVoice()) {
        if (!ok) { note(text, 'silent'); return false; }                // the words are on screen: never the device voice
        for (const c of chunks) {
          if (mine !== epoch) { note(text, 'cut'); return null; }
          if (!(await playClip(c, mine))) { if (mine !== epoch) { note(text, 'cut'); return null; } note(text, 'silent'); return false; }
        }
        engine = 'cloud'; note(text, 'cloud');
        return true;
      }
    }
    if (!tts.available) return false;
    let r = true;
    for (const c of chunks) {
      if (mine !== epoch) { note(text, 'cut'); return null; }
      try { r = await tts.say(c); } catch (_) { r = null; }
      if (r === null) { note(text, 'cut'); return null; }
    }
    engine = 'device'; note(text, 'device');
    return r !== false;
  }

  // ---- the lines the screen reads ----
  /** Read a line (or lines) now: replaces what is playing. Resolves true spoken · false silent · null cut off. */
  function say(textOrList) {
    const chunks = speechChunks(Array.isArray(textOrList) ? textOrList : [textOrList]);
    if (!chunks.length || !(tts.available || (cloud && cloud.active))) return Promise.resolve(null);
    const mine = ++epoch;
    hardStop();
    fgBusy++;
    const prev = current, idle = !curActive;
    // (nothing playing: the line starts in this very call, as a tap on Hear it expects; else it follows what is being cut off)
    const p = idle ? speakChunks(chunks, mine) : (async () => { await prev.catch(() => {}); return speakChunks(chunks, mine); })();
    curActive++;
    current = p.catch(() => {});
    p.then(() => {}, () => {}).then(() => { fgBusy--; curActive--; lastEnd = now(); });
    return p.catch(() => null);
  }
  /** Stop speaking now (a panel closing, the app going to the background). Lines of toasts keep their turn. */
  function cancel() {
    epoch++;
    hardStop();
    lastEnd = now();
  }

  // ---- the lines of toasts and pops ----
  /** Queue a line behind whatever is playing; it never cuts anything. Resolves like say(), or null when it went stale. */
  function later(text, { maxAgeMs = AMBIENT_MAX_AGE_MS } = {}) {
    const chunks = speechChunks([text]);
    if (!chunks.length || !(tts.available || (cloud && cloud.active))) return Promise.resolve(null);
    if (ambient.some((a) => a.key === chunks.join(' '))) return Promise.resolve(null);
    return new Promise((resolve) => {
      const it = { key: chunks.join(' '), chunks, born: now(), maxAgeMs, resolve, ready: null };
      it.ready = naturalVoice() ? ready(chunks, WAIT_MS, () => false) : Promise.resolve(true);        // the clip is asked for at once
      ambient.push(it);
      run();
    });
  }
  async function run() {
    if (worker) return;
    worker = true;
    try {
      while (ambient.length) {
        const it = ambient[0];
        if (now() - it.born > it.maxAgeMs) { ambient.shift(); stats.dropped++; note(it.key, 'dropped'); it.resolve(null); continue; }
        if (fgBusy || hold() || now() - lastEnd < AMBIENT_GAP_MS) { await sleep(POLL_MS); continue; }
        await it.ready;
        if (fgBusy || hold()) continue;                                      // something opened while its clip was made: it waits its turn again
        ambient.shift();
        const mine = epoch;                                                  // a line the screen reads cuts it (the epoch moves on)
        fgBusy++; curActive++; ambPlaying = true;
        const p = speakChunks(it.chunks, mine).catch(() => null);
        current = p.then(() => {});
        const r = await p;
        fgBusy--; curActive--; ambPlaying = false; lastEnd = now();
        it.resolve(r);
      }
    } finally { worker = false; }
  }

  return {
    say, cancel, later, ready, prepareBulk, naturalVoice,
    get engine() { return engine; },
    get busy() { return fgBusy > 0 || playing > 0; },
    /** Is a toast / pop line waiting or playing? (the toast layer shows the next spoken toast only after it) */
    get ambientPending() { return ambient.length > 0 || ambPlaying; },
    get waiting() { return waiting; },
    get stats() { return { ...stats }; },
    get events() { return events.slice(); },
  };
}
