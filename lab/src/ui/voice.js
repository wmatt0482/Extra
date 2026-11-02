// The Lab's voice: the natural-voice pattern the games use (wagon-west/src/meta/speech.js), in the small:
//   1. when the player picked a natural voice in a family (a code), a line is played straight from its clip; a line whose clip could not be made in
//      time is SKIPPED (its words are on screen), never read by the device voice;
//   2. the device voice speaks only when the natural voice is not in use at all (no family code, or a device voice picked);
//   3. one line at a time: a new line cuts the old one; the lines of banners (`later`) wait for the voice to be idle and never cut anything;
//   4. the Lab's lines (LAB_LINES, the quests, the item names) are prepared in the background in small batches (`prepare`), in the order needed.
// It uses Spell Jump's tts, cloudVoice and audio (the same module instances every game page already has), and the player's own voice options.
import { tts } from '../../../spell-jump/src/spelling/tts.js';
import { createCloudVoice } from '../../../spell-jump/src/spelling/cloudVoice.js';
import { Audio } from '../../../spell-jump/src/audio.js';
import { SYNC_KEY } from '../../../spell-jump/src/sync/client.js';
import { loadFamily, playerOptions } from '../../../spell-jump/src/spelling/profiles.js';

export const CLIP_MAX = 200, WAIT_MS = 9000, BATCH = 8, AMBIENT_GAP_MS = 700, AMBIENT_MAX_AGE_MS = 12000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A line cut into pieces the natural voice can say (<= 200 characters, at sentence breaks). */
export function splitSay(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length <= CLIP_MAX) return [t];
  const out = []; let cur = '';
  const push = (p) => {
    if (p.length > CLIP_MAX) {
      const words = p.split(/\s+/);
      if (words.length > 1) { for (const w of words) push(w); return; }
      for (let i = 0; i < p.length; i += CLIP_MAX) push(p.slice(i, i + CLIP_MAX));
      return;
    }
    if (!cur) cur = p; else if (cur.length + 1 + p.length <= CLIP_MAX) cur += ' ' + p; else { out.push(cur); cur = p; }
  };
  for (const s of t.split(/(?<=[.!?])\s+/)) push(s);
  if (cur) out.push(cur);
  return out;
}
/** The line as it is said: the middle dots of a strip become pauses and a plus sign is spoken as "plus". */
export const spoken = (t) => String(t == null ? '' : t).replace(/\s*·\s*/g, '. ').replace(/\+(\d)/g, 'plus $1');

/** The family code, read the way the sync client stores it (a game page and /lab/ share it). */
export function syncCode() {
  try { const raw = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); return raw && typeof raw.code === 'string' ? raw.code : null; } catch (_) { return null; }
}

export function createVoice({ enabled = () => true } = {}) {
  const cloud = createCloudVoice({ getCode: syncCode, audio: Audio });
  let epoch = 0, waiting = 0, pump = 0, lastEnd = 0, playerId = '';
  const ambient = []; let worker = false;
  const log = [];                                                  // (tests) what the voice did
  const note = (text, how) => { log.push({ text, how }); if (log.length > 100) log.shift(); };

  /** Apply the player's own voice options (their device voice and natural voice from Spell Jump's options). */
  function setPlayer(id) {
    playerId = id || '';
    try {
      const o = playerOptions(loadFamily(), playerId);
      tts.setRate(o.rate);
      tts.setVoice(o.voiceName ? { name: o.voiceName, lang: o.voiceLang } : null);
      cloud.setVoice(o.cloudVoice || '');
    } catch (_) { /* a family record that cannot be read: the defaults */ }
  }
  const natural = () => !!(cloud.active && cloud.server.key !== false && cloud.server.error !== 'forbidden');
  const missing = (list) => list.filter((t) => !cloud.has(t));
  async function ready(list, ms, stale) {
    if (!natural()) return true;
    if (!missing(list).length) return true;
    waiting++;
    try {
      const end = Date.now() + ms;
      while (missing(list).length && Date.now() < end && !stale()) {
        const res = await Promise.race([cloud.prepare(missing(list)).catch(() => null), sleep(Math.max(0, end - Date.now())).then(() => 'late')]);
        if (res === 'late' || (res && ['no-key', 'forbidden', 'daily-limit', 'no-voice', 'no-code'].includes(res.error))) break;
        if (missing(list).length) await sleep(600);
      }
      return !missing(list).length;
    } finally { waiting--; }
  }
  /** Prepare these lines in the background in small batches (a line that is waiting for its clip goes first). */
  function prepare(texts) {
    if (!cloud.active) return Promise.resolve();
    const mine = ++pump;
    const todo = [...new Set((texts || []).flatMap((t) => splitSay(spoken(t))))].filter((t) => !cloud.has(t));
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
  async function speak(chunks, mine) {
    const text = chunks.join(' ');
    if (!chunks.length || mine !== epoch) return null;
    if (natural()) {
      const ok = await ready(chunks, WAIT_MS, () => mine !== epoch);
      if (mine !== epoch) { note(text, 'cut'); return null; }
      if (natural()) {
        if (!ok) { note(text, 'silent'); return false; }
        for (const c of chunks) {
          if (mine !== epoch) { note(text, 'cut'); return null; }
          Audio.voice(true);
          let res; try { res = await cloud.play(c); } finally { Audio.voice(false); }
          if (res !== 'ok') { note(text, mine !== epoch ? 'cut' : 'silent'); return mine !== epoch ? null : false; }
        }
        note(text, 'cloud');
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
    note(text, 'device');
    return r !== false;
  }
  /** Read a line now: replaces what is playing. Resolves true spoken, false silent, null cut off. */
  function say(text) {
    if (!enabled()) return Promise.resolve(null);
    const chunks = splitSay(spoken(text));
    if (!chunks.length || !(tts.available || cloud.active)) return Promise.resolve(null);
    const mine = ++epoch;
    try { tts.cancel(); } catch (_) { /* ignore */ }
    const p = speak(chunks, mine).catch(() => null);
    p.then(() => { lastEnd = Date.now(); });
    return p;
  }
  /** A banner's line: waits for the voice to be idle, never cuts anything, dropped when stale. */
  function later(text) {
    if (!enabled()) return Promise.resolve(null);
    const chunks = splitSay(spoken(text));
    if (!chunks.length || !(tts.available || cloud.active)) return Promise.resolve(null);
    const key = chunks.join(' ');
    if (ambient.some((a) => a.key === key)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const it = { key, chunks, born: Date.now(), resolve, ready: natural() ? ready(chunks, WAIT_MS, () => false) : Promise.resolve(true) };
      ambient.push(it); run();
    });
  }
  async function run() {
    if (worker) return;
    worker = true;
    try {
      while (ambient.length) {
        const it = ambient[0];
        if (Date.now() - it.born > AMBIENT_MAX_AGE_MS) { ambient.shift(); note(it.key, 'dropped'); it.resolve(null); continue; }
        if (Date.now() - lastEnd < AMBIENT_GAP_MS) { await sleep(150); continue; }
        await it.ready;
        ambient.shift();
        const r = await speak(it.chunks, epoch).catch(() => null);
        lastEnd = Date.now();
        it.resolve(r);
      }
    } finally { worker = false; }
  }
  function cancel() { epoch++; try { tts.cancel(); } catch (_) { /* ignore */ } }
  return { say, later, prepare, cancel, setPlayer, cloud, get natural() { return natural(); }, get log() { return log.slice(); }, get playerId() { return playerId; } };
}

let shared = null;
/** The one voice of the page (the Lab page and the overlay in a game share it). */
export function sharedVoice() { return shared || (shared = createVoice()); }
