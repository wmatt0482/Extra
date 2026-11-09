// The voice of Squirrel Chase: ONE place every spoken line goes through. Natural cloud voice only (SPEC §1): a line is played
// from its clip, and a line whose clip could not be made in time is SILENT (its words are on screen). The device ("robot")
// voice is never used: this module does not even import it.
//   - speech is serialized: one utterance at a time; a new line (or cancel()) cuts what is playing;
//   - a line about to be said is asked for first and waited for (ready, up to WAIT_MS), while the clips of the current case
//     are prepared in the background in SMALL batches in the order the child needs them, stepping aside whenever a line
//     is waiting for its own clip (the design of Wagon West's speech.js);
//   - readEach(sentences, onIndex) plays a paragraph sentence by sentence and tells the screen which one is playing (the
//     highlight); stopping it (cancel, a newer line) ends it at the next sentence;
//   - the sound setting (deps.enabled) silences everything.
// deps: { cloud (createCloudVoice), duck(on), enabled() → bool, sleep?, now? }

export const CLIP_MAX = 200;
export const WAIT_MS = 9000;
export const BATCH = 8;
const GAP_MS = 140;           // a breath between the sentences of a paragraph

/** A line cut into pieces the natural voice can say (<= 200 characters, at sentence breaks, else at commas / spaces). */
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

export function createSpeech({ cloud, duck = () => {}, enabled = () => true, sleep = defaultSleep, now = Date.now } = {}) {
  let epoch = 0;             // bumped by every line and by cancel(): what is playing / waiting for its clip stops
  let waiting = 0;           // lines waiting for their clip: the background preparation pauses while this is above zero
  let pump = 0;              // identifies the running background preparation (a newer list replaces it)
  let slowUntil = 0;
  let playing = 0, duckTimer = 0;
  const stats = { cloud: 0, silent: 0, cut: 0, device: 0 };   // device stays 0: it is there for the tests to assert
  const events = [];
  const note = (text, how) => { stats[how] = (stats[how] || 0) + 1; events.push({ text, how, at: now() }); if (events.length > 300) events.shift(); };

  /** Is the natural voice available right now? Picked, in a family, the sound on, and the server can make clips. */
  const naturalVoice = () => !!(cloud && cloud.active && cloud.server.key !== false && cloud.server.error !== 'forbidden');
  const on = () => { try { return !!enabled(); } catch (_) { return true; } };
  const missing = (list) => list.filter((t) => !cloud.has(t));

  async function ready(texts, ms = WAIT_MS, stale = () => false) {
    if (!naturalVoice()) return true;
    const list = speechChunks(texts);
    if (!missing(list).length) return true;
    if (now() < slowUntil) ms = Math.min(ms, 2500);
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
        if (!res || (!res.ok && res.error !== 'no-voice')) await sleep(1500);
        if (res && ['no-key', 'forbidden', 'daily-limit', 'no-code'].includes(res.error)) return;
      }
    })();
  }

  function duckBy(d) {
    const was = playing;
    playing = Math.max(0, playing + d);
    if (!was && playing) { clearTimeout(duckTimer); duck(true); }
    if (was && !playing) { clearTimeout(duckTimer); duckTimer = setTimeout(() => { if (!playing) duck(false); }, 180); }
  }
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
  /** One line (its pieces) to the end: true spoken · false silent (no clip in time, no voice) · null cut off. Never the device voice. */
  async function speakChunks(chunks, mine) {
    const text = chunks.join(' ');
    if (!chunks.length || mine !== epoch) return null;
    if (!on() || !naturalVoice()) { note(text, 'silent'); return false; }
    const ok = await ready(chunks, WAIT_MS, () => mine !== epoch);
    if (mine !== epoch) { note(text, 'cut'); return null; }
    if (!ok || !naturalVoice()) { note(text, 'silent'); return false; }
    for (const c of chunks) {
      if (mine !== epoch) { note(text, 'cut'); return null; }
      if (!(await playClip(c, mine))) { if (mine !== epoch) { note(text, 'cut'); return null; } note(text, 'silent'); return false; }
    }
    note(text, 'cloud');
    return true;
  }

  /** Read a line (or lines) now: replaces what is playing. Resolves true spoken · false silent · null cut off. */
  function say(textOrList) {
    const chunks = speechChunks(Array.isArray(textOrList) ? textOrList : [textOrList]);
    const mine = ++epoch;
    try { cloud && cloud.stop(); } catch (_) { /* ignore */ }
    if (!chunks.length) return Promise.resolve(null);
    return speakChunks(chunks, mine).catch(() => null);
  }
  /**
   * Read sentences one after another (a paragraph, a whole document): onIndex(i) when sentence i starts (null at the end).
   * Resolves { spoken, total, cut }: how many were really voiced, and whether something newer cut it off.
   */
  async function readEach(sentences, onIndex = () => {}) {
    const mine = ++epoch;
    try { cloud && cloud.stop(); } catch (_) { /* ignore */ }
    let spoken = 0, cut = false;
    for (let i = 0; i < sentences.length; i++) {
      if (mine !== epoch) { cut = true; break; }
      try { onIndex(i); } catch (_) { /* ignore */ }
      const r = await speakChunks(splitSay(sentences[i]), mine).catch(() => null);
      if (r === null) { cut = true; break; }
      if (r) spoken++;
      if (i + 1 < sentences.length && mine === epoch) await sleep(GAP_MS);
    }
    if (mine === epoch) { try { onIndex(null); } catch (_) { /* ignore */ } }
    return { spoken, total: sentences.length, cut };
  }
  /** Stop speaking now (a screen closing, the app going to the background). */
  function cancel() { epoch++; try { cloud && cloud.stop(); } catch (_) { /* ignore */ } }

  return {
    say, readEach, cancel, ready, prepareBulk, naturalVoice,
    get busy() { return playing > 0; },
    get waiting() { return waiting; },
    get stats() { return { ...stats }; },
    get events() { return events.slice(); },
  };
}
