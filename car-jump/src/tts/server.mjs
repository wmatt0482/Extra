// Natural voice API, as pure request handling (no Netlify, no network of its own): netlify/functions/tts.mjs adapts
// Netlify Blobs and the Google Cloud Text-to-Speech REST call to the `deps` below and forwards each request here;
// tools/spelling-tests.mjs drives it with in-memory stores and a fake synthesize().
//
//   GET  /api/tts/status         → 200 { ok, key: boolean, voices: [id], dailyChars }   (always 200: the app asks it
//                                  to know whether the natural voice is set up, without spending anything)
//   POST /api/tts/prepare        body { code, voice, items: [{ text }] }
//                                → 200 { clips: { [text]: '/api/tts/clip/<id>' }, generated, cached, failed, charsToday }
//                                  400 bad input · 403 unknown family code (strangers cannot spend the quota)
//                                  503 { error: 'no-key' } (GOOGLE_TTS_API_KEY / TexttoVoice not set) · 429 { error: 'daily-limit' }
//                                  (the family's 20,000 characters for today would be exceeded; the clips that already
//                                  exist are still returned) · 502 every new clip failed at Google
//   GET  /api/tts/clip/:id       → 200 audio/mpeg, Cache-Control: public, max-age=31536000, immutable · 404
// A clip is content-addressed: id = first 32 hex digits of sha256(voice + '\n' + text), stored at `tts/<id>` with
// metadata { voice, chars }. Characters sent to Google count against `ttsUsage/<code>/<yyyy-mm-dd>` (UTC day).
//
// deps: { store, families, synthesize, now?, dailyChars?, concurrency? }
//   store:      { has(key) → bool, getBytes(key) → { bytes: Uint8Array, metadata } | null,
//                 setBytes(key, bytes, metadata), getJSON(key) → { value, etag } | null,
//                 setJSON(key, value, { onlyIfNew } | { onlyIfMatch } | {}) → { modified } }
//   families:   { exists(code) → bool }
//   synthesize: async (text, voice) → Uint8Array (MP3 bytes), or null when no API key is configured
import { CODE_RE } from '../sync/protocol.mjs';
import { CLOUD_VOICE_IDS } from './voices.js';

export const MAX_ITEMS = 80;
export const MAX_TEXT = 200;
export const DAILY_CHARS = 20000;
export const SPEAKING_RATE = 0.92;
export const MAX_BODY = 64 * 1024;
export const CONCURRENCY = 8;
export const GOOGLE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
export const CLIP_PREFIX = '/api/tts/clip/';
export const ID_RE = /^[0-9a-f]{32}$/;
const PREFIX = '/api/tts/';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (status, body, extra = {}) => ({ status, headers: { ...JSON_HEADERS, ...extra }, body: JSON.stringify(body) });
const bad = (message) => reply(400, { error: 'bad-request', message });

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
/** The clip id for a voice + text: the first 32 hex digits of sha256(voice + '\n' + text). */
export async function clipId(voice, text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voice}\n${text}`));
  return hex(digest).slice(0, 32);
}
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const usageKey = (code, ms) => `ttsUsage/${code}/${dayKey(ms)}`;
export const clipKey = (id) => `tts/${id}`;

// The Netlify environment variable that holds the Google API key: GOOGLE_TTS_API_KEY (recommended), or TexttoVoice (the
// name it was first created under on the live site). `get(name)` reads one variable (Netlify.env.get / process.env).
export const KEY_VARS = ['GOOGLE_TTS_API_KEY', 'TexttoVoice'];
export function apiKeyFrom(get) {
  for (const name of KEY_VARS) {
    let v = '';
    try { v = get(name); } catch (_) { v = ''; }
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** A single capital letter is a spelled-out letter (the app's letter clips, src/spelling/cloudVoice.js
 *  cloudLetterText): it goes to Google as SSML <say-as interpret-as="characters">, so the voice says the letter's
 *  name ("eff", "ay", "double-u") instead of reading a word. */
export const LETTER_RE = /^[A-Z]$/;
export const letterSsml = (ch) => `<speak><say-as interpret-as="characters">${ch}</say-as></speak>`;
/** The Google Cloud Text-to-Speech request body for one clip (plain = true: never SSML, the retry path). */
export const googleRequest = (text, voice, { plain = false } = {}) => ({
  input: !plain && LETTER_RE.test(text) ? { ssml: letterSsml(text) } : { text },
  voice: { languageCode: 'en-US', name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: SPEAKING_RATE },
});
function base64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
/** synthesize(text, voice) over the Google REST API with an API key (the key never appears in an error message). */
export function googleSynthesizer(apiKey, fetchImpl = (...a) => globalThis.fetch(...a)) {
  const scrub = (s) => String(s || '').split(apiKey).join('[key]').slice(0, 300);
  const call = async (body) => {
    const res = await fetchImpl(`${GOOGLE_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch (_) { /* not JSON */ }
    if (!res.ok) {
      const e = new Error(scrub((json && json.error && json.error.message) || `Google answered ${res.status}`));
      e.status = res.status;
      throw e;
    }
    if (!json || typeof json.audioContent !== 'string' || !json.audioContent) throw new Error('Google sent no audio');
    return base64ToBytes(json.audioContent);
  };
  return async (text, voice) => {
    const req = googleRequest(text, voice);
    try { return await call(req); } catch (e) {
      // a voice that rejects the SSML (400): say the letter as plain text, "F."
      if (req.input.ssml && e && e.status === 400) return call(googleRequest(`${text}.`, voice, { plain: true }));
      throw e;
    }
  };
}

/**
 * Handle one request. req = { method, path (URL pathname), contentType, contentLength?, body (string | null) }.
 * Returns { status, headers, body (JSON string, or Uint8Array for a clip) }. Never throws.
 */
export async function handleTts(req, deps) {
  try {
    return await route(req || {}, deps || {});
  } catch (e) {
    return reply(500, { error: 'server', message: 'storage error' });
  }
}

async function route(req, deps) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '');
  if (!path.startsWith(PREFIX)) return reply(404, { error: 'not-found' });
  const rest = path.slice(PREFIX.length).replace(/\/$/, '');
  if (rest === 'status') {
    if (method !== 'GET') return reply(405, { error: 'method-not-allowed' }, { allow: 'GET' });
    return reply(200, { ok: true, key: typeof deps.synthesize === 'function', voices: CLOUD_VOICE_IDS, dailyChars: deps.dailyChars || DAILY_CHARS });
  }
  if (rest === 'prepare') {
    if (method !== 'POST') return reply(405, { error: 'method-not-allowed' }, { allow: 'POST' });
    return prepare(req, deps);
  }
  const m = /^clip\/([^/]+)$/.exec(rest);
  if (m) {
    if (method !== 'GET' && method !== 'HEAD') return reply(405, { error: 'method-not-allowed' }, { allow: 'GET' });
    return clip(m[1], deps, method === 'HEAD');
  }
  return reply(404, { error: 'not-found' });
}

async function clip(id, deps, head) {
  if (!ID_RE.test(id)) return reply(404, { error: 'not-found' });
  const r = await deps.store.getBytes(clipKey(id));
  if (!r || !r.bytes || !r.bytes.byteLength) return reply(404, { error: 'not-found' });
  const bytes = r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes);
  return {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable', 'content-length': String(bytes.byteLength) },
    body: head ? '' : bytes,
  };
}

// the validated request: { code, voice, texts } or { error }
function readPrepare(req) {
  if (!/^application\/json\b/i.test(req.contentType || '')) return { error: 'Content-Type must be application/json' };
  if (typeof req.body !== 'string' || !req.body) return { error: 'missing body' };
  if (new TextEncoder().encode(req.body).length > MAX_BODY) return { error: `body over ${MAX_BODY / 1024} KB` };
  let b;
  try { b = JSON.parse(req.body); } catch (_) { return { error: 'body is not valid JSON' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'body must be a JSON object' };
  if (typeof b.code !== 'string' || !CODE_RE.test(b.code)) return { error: 'code must be a family code like ABCD-2345' };
  if (typeof b.voice !== 'string' || !CLOUD_VOICE_IDS.includes(b.voice)) return { error: `voice must be one of ${CLOUD_VOICE_IDS.join(', ')}` };
  if (!Array.isArray(b.items) || !b.items.length) return { error: 'items must be a non-empty list' };
  if (b.items.length > MAX_ITEMS) return { error: `at most ${MAX_ITEMS} items per request` };
  const texts = [];
  for (let i = 0; i < b.items.length; i++) {
    const it = b.items[i];
    if (!it || typeof it !== 'object' || typeof it.text !== 'string') return { error: `items[${i}].text must be a string` };
    const t = it.text.trim();
    if (!t) return { error: `items[${i}].text is empty` };
    if (t.length > MAX_TEXT) return { error: `items[${i}].text is over ${MAX_TEXT} characters` };
    if (/[\u0000-\u001f\u007f]/.test(t)) return { error: `items[${i}].text has control characters` };
    if (!texts.includes(t)) texts.push(t);
  }
  return { code: b.code, voice: b.voice, texts };
}

// add `delta` characters to today's counter (conditional write, a few retries on a race). Returns the new total, or
// { over: currentTotal } when the limit would be passed (only checked for delta > 0).
async function bumpUsage(store, key, delta, limit, now) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await store.getJSON(key);
    const used = cur && cur.value && Number.isFinite(cur.value.chars) ? cur.value.chars : 0;
    const next = Math.max(0, used + delta);
    if (delta > 0 && next > limit) return { over: used };
    const cond = cur ? (cur.etag != null ? { onlyIfMatch: cur.etag } : {}) : { onlyIfNew: true };
    const res = await store.setJSON(key, { chars: next, updatedAt: now }, cond);
    if (res && res.modified) return { total: next };
  }
  throw new Error('usage counter busy');
}

async function pool(items, n, fn) {
  let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

async function prepare(req, deps) {
  const r = readPrepare(req);
  if (r.error) return bad(r.error);
  const { store, families } = deps;
  if (!(await families.exists(r.code))) return reply(403, { error: 'unknown-family', message: 'no family with this code' });
  if (typeof deps.synthesize !== 'function') return reply(503, { error: 'no-key', message: 'the natural voice is not set up on the server (GOOGLE_TTS_API_KEY)' });
  const now = deps.now ? deps.now() : Date.now();
  const limit = deps.dailyChars || DAILY_CHARS;
  const items = await Promise.all(r.texts.map(async (text) => {
    const id = await clipId(r.voice, text);
    return { text, id, exists: !!(await store.has(clipKey(id))) };
  }));
  const clips = {};
  for (const it of items) if (it.exists) clips[it.text] = CLIP_PREFIX + it.id;
  const missing = items.filter((it) => !it.exists);
  const cached = items.length - missing.length;
  const uKey = usageKey(r.code, now);
  const need = missing.reduce((s, it) => s + it.text.length, 0);
  if (!need) {
    const cur = await store.getJSON(uKey);
    return reply(200, { clips, generated: 0, cached, failed: 0, charsToday: cur && cur.value && Number.isFinite(cur.value.chars) ? cur.value.chars : 0 });
  }
  // reserve today's characters first, so two requests at once cannot both pass the limit
  const u = await bumpUsage(store, uKey, need, limit, now);
  if (u.over != null) {
    return reply(429, { error: 'daily-limit', message: `this family's ${limit.toLocaleString('en-US')} characters for today are used up`, limit, charsToday: u.over, clips, generated: 0, cached });
  }
  let generated = 0, failedChars = 0, lastError = null;
  await pool(missing, deps.concurrency || CONCURRENCY, async (it) => {
    try {
      const bytes = await deps.synthesize(it.text, r.voice);
      if (!bytes || !bytes.byteLength) throw new Error('empty audio');
      await store.setBytes(clipKey(it.id), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { voice: r.voice, chars: it.text.length });
      clips[it.text] = CLIP_PREFIX + it.id;
      generated++;
    } catch (e) {
      failedChars += it.text.length;
      lastError = e;
    }
  });
  let charsToday = u.total;
  if (failedChars) {          // give back what Google did not turn into clips (best effort)
    try { const back = await bumpUsage(store, uKey, -failedChars, limit, now); charsToday = back.total; } catch (_) { /* keep the reservation */ }
  }
  const failed = missing.length - generated;
  if (!generated && failed) {
    return reply(502, {
      error: 'synthesis-failed', message: String((lastError && lastError.message) || 'Google did not return audio').slice(0, 300),
      googleStatus: lastError && lastError.status ? lastError.status : undefined, clips, generated, cached, failed, charsToday,
    });
  }
  return reply(200, { clips, generated, cached, failed, charsToday });
}

/** In-memory store with the same interface and conditional-write semantics (tests, local dev). */
export function memoryTtsStore(map = new Map()) {
  let n = 0;
  return {
    map,
    writes: 0,
    async has(key) { return map.has(key); },
    async getBytes(key) { const e = map.get(key); return e && e.bytes ? { bytes: e.bytes, metadata: e.metadata } : null; },
    async setBytes(key, bytes, metadata = {}) { this.writes++; map.set(key, { bytes: new Uint8Array(bytes), metadata: { ...metadata }, etag: `"m${++n}"` }); },
    async getJSON(key) { const e = map.get(key); return e && e.text != null ? { value: JSON.parse(e.text), etag: e.etag } : null; },
    async setJSON(key, value, cond = {}) {
      const e = map.get(key);
      if (cond.onlyIfNew && e) return { modified: false };
      if (cond.onlyIfMatch != null && (!e || e.etag !== cond.onlyIfMatch)) return { modified: false };
      map.set(key, { text: JSON.stringify(value), etag: `"m${++n}"` });
      return { modified: true };
    },
  };
}
/** Families lookup over a set of codes (tests). */
export const memoryFamilies = (codes = []) => ({ async exists(code) { return new Set(codes).has(code); } });
