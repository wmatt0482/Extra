// Natural (cloud) voice for Spell Jump: word-list clips made on the server with Google Cloud Text-to-Speech
// (netlify/functions/tts.mjs → src/tts/server.mjs), played with WebAudio through src/audio.js (so the music still
// ducks under the voice). tts.js uses it as its `cloud` engine when the player's options pick a natural voice AND the
// device is in a family (a family code: the server only makes clips for families) AND the clip exists; anything else
// (no clip, a clip that fails to load or play) falls back to the device voice for that utterance.
//
// Texts: for each word "The word is, <word>." / the sentence / "<word>." (the presentation, tts.buildPresentation),
// "<word>. <word>." (Say it again), the syllables phrase (if any); the parent's "say as" replaces the word. Shared per
// voice: the 26 letters as single capitals "A".."Z" (the server says them as spelled-out characters; see
// cloudLetterText) + apostrophe / hyphen / space (spell-outs and typed letters), the Parent Zone sample presentation
// and "Spell Jump is ready." (Test voice / Speech check).
// prepare(): POST /api/tts/prepare with the texts this device has no clip for (≤ 80 per request); the answer maps each
// text to its content-addressed clip URL. That map is kept per voice in localStorage (`spellJump.cloudVoice`), so a
// reload (or a device offline) knows its clips; the service worker keeps fetched clips (cache-first), so they play
// offline after the first time. Decoded clips are kept in memory (LRU).
// Test hook: `window.__cloudVoiceBackend` = { status() → {key}, prepare({code, voice, texts}) → {status, body},
// load(url, text) → buffer, play(buffer, text) → Promise<boolean>, stop() } replaces the network and WebAudio
// (tools/ui-smoke.mjs); any method left out uses the real one.
import { buildPresentation, buildRepeat, buildSyllables, CHECK_PHRASE, SAMPLE_PRESENTATION } from './tts.js';
import { LETTER_NAMES, letterName } from './words.js';
import { DEFAULT_CLOUD_VOICE, cloudVoiceInfo, isCloudVoice } from '../tts/voices.js';

export const STORE_KEY = 'spellJump.cloudVoice';
export const API = '/api/tts/';
export const MAX_ITEMS = 80;
export const MAX_TEXT = 200;
export const READY_WAIT_MS = 3000;     // the spell panel waits at most this long for a lazy prepare
export const LOAD_TIMEOUT_MS = 4000;   // a clip that is not fetched + decoded by then: the device voice says it
const STATUS_TTL_MS = 5 * 60000;
const RETRY_MISSING_MS = 10 * 60000;   // a text the server did not return is not asked for again for 10 min
const MAX_PER_VOICE = 4000;
const MAX_DECODED = 160;
export const READY_PHRASE = 'Spell Jump is ready.';

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const fits = (t) => !!t && t.length <= MAX_TEXT;

/** The clip text for one spelled / typed character in a natural voice: the capital letter itself ("F"), which the
 *  server synthesizes as a spelled-out character (SSML say-as characters) so Google says the letter's name, "eff".
 *  The device voices keep letterName() ("ef"), spelled phonetically because they say "capital F" for a bare "F";
 *  sent to Google as text, "ef" came out as a word (v3.4). Apostrophe / hyphen / space keep their words. */
export function cloudLetterText(ch) {
  const k = String(ch == null ? '' : ch).toLowerCase();
  return LETTER_NAMES[k] ? k.toUpperCase() : letterName(ch);
}
// device letter name → cloud clip text ("ef" → "F", "a" → "A"), so tts.js can ask for a letter by either name
const CLOUD_KEY_BY_NAME = Object.fromEntries(Object.entries(LETTER_NAMES).map(([k, name]) => [name, k.toUpperCase()]));

/** The texts one word needs (presentation, Say it again, syllables), in order, no duplicates. */
export function wordTexts(entry = {}) {
  const out = [...buildPresentation(entry), buildRepeat(entry), buildSyllables(entry.syllables)].map(clean).filter(fits);
  return [...new Set(out)];
}
/** Texts shared by every word in a voice: the 26 letters as capitals (+ apostrophe, hyphen, space), the sample
 *  presentation, the Test voice phrase. */
export function sharedTexts() {
  const letters = [...Object.keys(LETTER_NAMES), "'", '-', ' '].map(cloudLetterText);
  return [...new Set([...letters, ...buildPresentation(SAMPLE_PRESENTATION), CHECK_PHRASE, READY_PHRASE].map(clean).filter(fits))];
}
/** Every text a list needs (its words, then the shared ones), no duplicates. */
export function listTexts(words = []) {
  const out = [];
  for (const w of Array.isArray(words) ? words : []) out.push(...wordTexts(w));
  out.push(...sharedTexts());
  return [...new Set(out)];
}

function readStore() {
  try { const t = localStorage.getItem(STORE_KEY); const v = t ? JSON.parse(t) : null; if (v && v.v === 1 && v.clips && typeof v.clips === 'object') return v; } catch (_) { /* ignore */ }
  return { v: 1, clips: {} };
}
function writeStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (_) { /* full / blocked: memory only */ } }

/**
 * deps: { getCode() → family code | null, getWords() → the current player's active list words, audio (src/audio.js),
 *         fetch?, onChange?(state) }
 */
export function createCloudVoice(deps = {}) {
  const g = typeof window !== 'undefined' ? window : globalThis;
  const hook = () => g.__cloudVoiceBackend || null;
  const doFetch = deps.fetch || ((...a) => g.fetch(...a));
  const getCode = () => { try { return deps.getCode ? deps.getCode() : null; } catch (_) { return null; } };
  const getWords = () => { try { return (deps.getWords && deps.getWords()) || []; } catch (_) { return []; } };
  const audio = deps.audio || null;
  let voice = '';
  let store = readStore();
  // server state: key null = unknown; error '' | 'offline' | 'daily-limit' | 'server' | 'forbidden'
  const server = { key: null, checkedAt: 0, error: '', message: '', charsToday: 0, checking: null };
  const decoded = new Map();            // url → AudioBuffer (insertion order = LRU)
  const loading = new Map();            // url → Promise<AudioBuffer>
  const asked = new Map();              // voice\ntext → when the server was asked and did not return it
  const inflight = new Map();           // voice → Promise of the running prepare
  let current = null;                   // { stop, cancelled } of the clip playing now
  const listeners = new Set();
  const emit = () => { const s = api.state(); for (const fn of listeners) { try { fn(s); } catch (_) { /* ignore */ } } try { deps.onChange && deps.onChange(s); } catch (_) { /* ignore */ } };

  const clipsOf = (v) => store.clips[v] || (store.clips[v] = {});
  const urlFor = (text, v = voice) => { const id = v && store.clips[v] && store.clips[v][text]; return id ? API + 'clip/' + id : null; };
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

  function remember(v, clips) {
    const m = clipsOf(v);
    let changed = false;
    for (const [text, url] of Object.entries(clips || {})) {
      const id = typeof url === 'string' && /\/([0-9a-f]{32})$/.exec(url);
      if (id && m[text] !== id[1]) { m[text] = id[1]; changed = true; asked.delete(`${v}\n${text}`); }
    }
    if (Object.keys(m).length > MAX_PER_VOICE) store.clips[v] = {};
    if (changed) writeStore(store);
    return changed;
  }

  async function getStatus(force = false) {
    if (!force && server.key != null && Date.now() - server.checkedAt < STATUS_TTL_MS) return server.key;
    if (server.checking) return server.checking;
    server.checking = (async () => {
      try {
        const h = hook();
        let body;
        if (h && h.status) body = await h.status();
        else {
          const res = await doFetch(API + 'status', { cache: 'no-store', credentials: 'same-origin' });
          body = res.ok ? await res.json() : null;
        }
        if (!body || typeof body.key !== 'boolean') { server.error = 'server'; server.message = 'the voice server did not answer'; return server.key; }
        server.key = body.key; server.checkedAt = Date.now();
        if (server.error === 'offline' || server.error === 'server') server.error = '';
        return server.key;
      } catch (_) {
        server.error = 'offline';
        return server.key;
      } finally { server.checking = null; emit(); }
    })();
    return server.checking;
  }

  // POST one batch; returns { status, body } (status 0: offline)
  async function post(code, v, texts) {
    const h = hook();
    if (h && h.prepare) return h.prepare({ code, voice: v, texts: texts.slice() });
    try {
      const res = await doFetch(API + 'prepare', {
        method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, voice: v, items: texts.map((text) => ({ text })) }),
      });
      let body = null;
      try { body = await res.json(); } catch (_) { /* empty */ }
      return { status: res.status, body };
    } catch (_) { return { status: 0, body: null }; }
  }

  /** Ask the server for clips of these texts in voice v (only the ones this device has no clip for; ≤ 80 per
   *  request). Resolves { ok, error, generated, cached, missing: [text] }. */
  function prepare(textsIn, v = voice) {
    const code = getCode();
    if (!isCloudVoice(v)) return Promise.resolve({ ok: false, error: 'no-voice', missing: [] });
    if (!code) return Promise.resolve({ ok: false, error: 'no-code', missing: [] });
    const run = async () => {
      const m = clipsOf(v);
      const texts = [...new Set((textsIn || []).map(clean).filter(fits))].filter((t) => !m[t]);
      const out = { ok: true, error: '', generated: 0, cached: 0, missing: [] };
      for (let i = 0; i < texts.length; i += MAX_ITEMS) {
        const batch = texts.slice(i, i + MAX_ITEMS);
        const res = await post(code, v, batch);
        const b = res.body || {};
        if (b.clips) remember(v, b.clips);
        if (typeof b.charsToday === 'number') server.charsToday = b.charsToday;
        if (res.status === 200) {
          out.generated += b.generated || 0; out.cached += b.cached || 0;
          server.key = true; server.checkedAt = Date.now(); server.error = ''; server.message = '';
          continue;
        }
        out.ok = false;
        if (res.status === 0) server.error = 'offline';
        else if (res.status === 503) { server.key = false; server.checkedAt = Date.now(); server.error = ''; }
        else if (res.status === 429) { server.error = 'daily-limit'; server.key = true; }
        else if (res.status === 403) server.error = 'forbidden';
        else { server.error = 'server'; server.message = (b && b.message) || `the voice server answered ${res.status}`; }
        out.error = server.error || 'no-key';
        break;
      }
      const now = Date.now();
      for (const t of texts) if (!clipsOf(v)[t]) { out.missing.push(t); asked.set(`${v}\n${t}`, now); }
      emit();
      return out;
    };
    // one prepare per voice at a time: a second call waits for the first, then asks only for what is still missing
    const prev = inflight.get(v) || Promise.resolve();
    const p = prev.then(run, run);
    inflight.set(v, p);
    p.finally(() => { if (inflight.get(v) === p) inflight.delete(v); });
    return p;
  }

  async function load(url, text) {
    if (decoded.has(url)) { const b = decoded.get(url); decoded.delete(url); decoded.set(url, b); return b; }
    if (loading.has(url)) return loading.get(url);
    const p = (async () => {
      const h = hook();
      let buf;
      if (h && h.load) buf = await h.load(url, text);
      else {
        const res = await doFetch(url, { credentials: 'same-origin' });
        if (!res.ok) { if (res.status === 404) forget(url); throw new Error(`clip ${res.status}`); }
        if (!audio || !audio.decodeVoice) throw new Error('no WebAudio');
        buf = await audio.decodeVoice(await res.arrayBuffer());
      }
      if (!buf) throw new Error('no audio');
      decoded.set(url, buf);
      while (decoded.size > MAX_DECODED) decoded.delete(decoded.keys().next().value);
      return buf;
    })();
    loading.set(url, p);
    p.then(() => loading.delete(url), () => loading.delete(url));
    return p;
  }
  // a clip the server no longer has: drop it from the map (the next prepare makes it again)
  function forget(url) {
    const id = url.slice(url.lastIndexOf('/') + 1);
    for (const m of Object.values(store.clips)) for (const [t, x] of Object.entries(m)) if (x === id) delete m[t];
    writeStore(store);
  }
  const withTimeout = (p, ms) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); }); });

  const api = {
    get voice() { return voice; },
    setVoice(v) { const nv = isCloudVoice(v) ? v : ''; if (nv !== voice) { voice = nv; emit(); } },
    /** a natural voice is picked and the device is in a family */
    get active() { return !!voice && !!getCode(); },
    get code() { return getCode(); },
    /** the clip key for `text` in voice v: the text itself (a device letter name like "ef" maps to its letter clip
     *  "F"), or with a full stop added (a bare sentence), or null */
    resolve(text, v = voice) {
      const t = clean(text);
      if (!v || !t) return null;
      const m = store.clips[v];
      if (!m) return null;
      const letter = CLOUD_KEY_BY_NAME[t];
      if (letter && m[letter]) return letter;
      if (m[t]) return t;
      const stop = /[.!?]$/.test(t) ? t : t + '.';
      return m[stop] ? stop : null;
    },
    has(text, v = voice) { return api.resolve(text, v) != null; },
    count(v = voice) { return v && store.clips[v] ? Object.keys(store.clips[v]).length : 0; },
    missing(texts, v = voice) { return (texts || []).map(clean).filter(fits).filter((t) => !api.has(t, v)); },
    /** Missing texts of this word worth asking the server for now (not asked in the last 10 min). */
    wanted(entry, v = voice) {
      const now = Date.now();
      return api.missing([...wordTexts(entry), ...sharedTexts()], v).filter((t) => !(now - (asked.get(`${v}\n${t}`) || -Infinity) < RETRY_MISSING_MS));
    },
    status: getStatus,
    get server() { return { key: server.key, error: server.error, message: server.message, charsToday: server.charsToday, checkedAt: server.checkedAt }; },
    prepare,
    /** Everything the current player's list needs in voice v (+ the shared texts). */
    prepareList(words = getWords(), v = voice) { return prepare(listTexts(words), v); },
    /** Before a word: when some of its clips are missing (and were not asked for lately), ask for the whole list +
     *  this word. Resolves when done ({ ok } or null when nothing was needed). */
    needsPrepare(entry, v = voice) { return api.active && online() && api.wanted(entry, v).length > 0; },
    /** fetch + decode one word's clips (its texts and its letters) in the background */
    warmWord(entry, v = voice) {
      const letters = Array.from(String((entry && entry.word) || '')).map(cloudLetterText);
      api.warm([...wordTexts(entry), ...new Set(letters)], v);
    },
    ensureWord(entry, v = voice) {
      if (!api.active || !online()) return Promise.resolve(null);
      if (!api.wanted(entry, v).length) return Promise.resolve(null);
      return prepare([...wordTexts(entry), ...listTexts(getWords())], v);
    },
    /** fetch + decode the clips of these texts in the background (first play starts at once) */
    warm(texts, v = voice) {
      for (const t of texts || []) { const k = api.resolve(t, v); const url = k && urlFor(k, v); if (url) load(url, k).catch(() => {}); }
    },
    /** Play the clip for `text` in voice v. Resolves 'ok' (played to the end), 'cancel' (stop() / newer speech) or
     *  'fail' (no clip, it did not load within 4 s, or WebAudio could not play it). */
    async play(text, { voice: v = voice } = {}) {
      const k = api.resolve(text, v);
      const url = k && urlFor(k, v);
      if (!url) return 'fail';
      api.stop();
      const me = { cancelled: false, stop: () => {} };
      current = me;
      let buf;
      try { buf = await withTimeout(load(url, k), LOAD_TIMEOUT_MS); } catch (_) { if (current === me) current = null; return me.cancelled ? 'cancel' : 'fail'; }
      if (me.cancelled) return 'cancel';
      const h = hook();
      let ok;
      if (h && h.play) {
        me.stop = () => { try { h.stop && h.stop(); } catch (_) { /* ignore */ } };
        try { ok = await h.play(buf, k); } catch (_) { ok = false; }
      } else {
        if (!audio || !audio.playVoice) { current = null; return 'fail'; }
        const pv = audio.playVoice(buf);
        me.stop = () => pv.stop();
        ok = await pv.done;
      }
      if (current === me) current = null;
      return me.cancelled ? 'cancel' : ok ? 'ok' : 'fail';
    },
    stop() { const c = current; current = null; if (c) { c.cancelled = true; try { c.stop(); } catch (_) { /* ignore */ } } },
    get playing() { return !!current; },
    /** The status line under "Natural voices" in Parents → Options. */
    statusText(v = voice) {
      if (!getCode()) return 'No family code yet: natural voices need family sync';
      if (!online() || server.error === 'offline') {
        const n = api.count(v);
        return `Offline: using the device voice${v && n ? ` (${n} clips saved on this device still play)` : ''}`;
      }
      if (server.key === false) return 'Natural voice not set up on the server yet (ask the admin to add the Google key)';
      if (server.key == null) return server.error === 'server' ? `The natural voice server had a problem (${server.message}): using the device voice` : 'Checking the natural voice…';
      if (server.error === 'daily-limit') return "Today's natural-voice limit is used up: new clips wait until tomorrow (saved clips still play)";
      if (server.error === 'forbidden') return 'The server did not accept this family code: natural voices need family sync';
      if (server.error === 'server') return `The natural voice server had a problem (${server.message}): using the device voice`;
      if (!v) return 'Natural voices are ready to use: tap one to pick it';
      return `Natural voice ready · ${api.count(v)} clips cached`;
    },
    state() { return { voice, active: api.active, count: api.count(), key: server.key, error: server.error }; },
    /** the audio output's state for the Speech check (src/audio.js diagnostics), or null */
    diagnostics() { try { return audio && audio.diagnostics ? audio.diagnostics() : null; } catch (_) { return null; } },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    info: cloudVoiceInfo,
    DEFAULT: DEFAULT_CLOUD_VOICE,
  };
  return api;
}
