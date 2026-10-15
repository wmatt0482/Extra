// Runs the real natural-voice Netlify Function (netlify/functions/tts.mjs) and the real @netlify/blobs client against
// @netlify/blobs' local BlobsServer (files in a temp dir), outside Netlify, with `fetch` stubbed for the Google
// Text-to-Speech endpoint (no key, no network). Needs the root dependencies:
//   cd <repo root> && npm install && node car-jump/tools/tts-function-check.mjs
// Checks the Functions v2 export shape (default handler + config.path), status without / with a key, prepare: 503
// without a key, 403 for an unknown family, 400 for a voice off the allowlist, a clip generated once (the Google
// request body, the key in the URL) and cached afterwards, the per-family daily counter in the `tts` store, the clip
// served as audio/mpeg with an immutable Cache-Control, 404 for an unknown clip, and a Google error → 502 without the
// key in the message.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { BlobsServer } = await import('@netlify/blobs/server');
const { getStore } = await import('@netlify/blobs');
const dir = mkdtempSync(path.join(os.tmpdir(), 'spell-jump-tts-blobs-'));
const token = 'local-check', port = 19000 + Math.floor(Math.random() * 1000);
const server = new BlobsServer({ directory: dir, port, token });
await server.start();
const url = `http://localhost:${port}`;
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, token, siteID: 'local-site' })).toString('base64');

// fetch stub: Google's endpoint answers with fake MP3 bytes (or an error); everything else (the Blobs server) is real
const realFetch = globalThis.fetch;
const google = { calls: [], fail: null };
const KEY = 'test-key-123';
globalThis.fetch = async (input, init = {}) => {
  const u = String(typeof input === 'string' ? input : input.url);
  if (u.startsWith('https://texttospeech.googleapis.com/')) {
    const body = JSON.parse(init.body);
    google.calls.push({ url: u, body });
    if (google.fail) return new Response(JSON.stringify({ error: { code: google.fail, message: `API key not valid: ${KEY}` } }), { status: google.fail, headers: { 'content-type': 'application/json' } });
    const mp3 = Buffer.concat([Buffer.from([0xff, 0xf3, 0x44, 0xc4]), Buffer.from(`${body.voice.name}:${body.input.text}`)]);
    return new Response(JSON.stringify({ audioContent: mp3.toString('base64') }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};

const fn = await import('../../netlify/functions/tts.mjs');
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };
try {
  ok(typeof fn.default === 'function', 'default export is the v2 handler');
  ok(JSON.stringify(fn.config.path) === JSON.stringify(['/api/tts/status', '/api/tts/prepare', '/api/tts/clip/:id']), 'config.path routes /api/tts/status, /api/tts/prepare and /api/tts/clip/:id');
  const call = async (method, p, body) => {
    const res = await fn.default(new Request('https://spell-jump.example' + p, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }), { params: {} });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, cc: res.headers.get('cache-control'), ct, json: ct.startsWith('application/json') ? await res.json() : null, bytes: ct.startsWith('audio/') ? Buffer.from(await res.arrayBuffer()) : null };
  };
  const C = 'K7QX-M2PA';
  const items = ['The word is, neighbor.', 'neighbor.', 'bee'].map((text) => ({ text }));
  delete process.env.GOOGLE_TTS_API_KEY;
  let r = await call('GET', '/api/tts/status'); ok(r.status === 200 && r.json.key === false && r.cc === 'no-store', 'status without GOOGLE_TTS_API_KEY → 200 { key: false }');
  // the family exists in the `families` store (written the way family.mjs writes it)
  await getStore({ name: 'families', consistency: 'strong' }).setJSON(`${C}/family`, { rev: 1, updatedAt: Date.now(), deviceId: 'dcheck', data: { players: [] } });
  r = await call('POST', '/api/tts/prepare', { code: C, voice: 'en-US-Neural2-F', items }); ok(r.status === 503 && r.json.error === 'no-key', 'prepare without a key → 503 no-key');
  process.env.TexttoVoice = 'alias-key';
  r = await call('GET', '/api/tts/status'); ok(r.status === 200 && r.json.key === true, 'the key under its alias TexttoVoice → { key: true }');
  delete process.env.TexttoVoice;
  process.env.GOOGLE_TTS_API_KEY = KEY;
  r = await call('GET', '/api/tts/status'); ok(r.status === 200 && r.json.key === true, 'status with the key → { key: true }');
  r = await call('POST', '/api/tts/prepare', { code: 'ZZZZ-2222', voice: 'en-US-Neural2-F', items }); ok(r.status === 403 && google.calls.length === 0, 'unknown family code → 403, Google not called');
  r = await call('POST', '/api/tts/prepare', { code: C, voice: 'en-US-Wavenet-A', items }); ok(r.status === 400, 'voice off the allowlist → 400');
  r = await call('POST', '/api/tts/prepare', { code: C, voice: 'en-US-Neural2-F', items });
  ok(r.status === 200 && r.json.generated === 3 && r.json.cached === 0 && Object.keys(r.json.clips).length === 3 && r.json.charsToday === 'The word is, neighbor.neighbor.bee'.length, `prepare generates 3 clips (charsToday ${r.json.charsToday})`);
  const g0 = google.calls[0];
  ok(g0.url === `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}` && g0.body.voice.languageCode === 'en-US' && g0.body.voice.name === 'en-US-Neural2-F'
    && g0.body.audioConfig.audioEncoding === 'MP3' && g0.body.audioConfig.speakingRate === 0.92, 'Google request: key in the URL, en-US voice, MP3 at speaking rate 0.92');
  const clipUrl = r.json.clips['neighbor.'];
  ok(/^\/api\/tts\/clip\/[0-9a-f]{32}$/.test(clipUrl), `clip URL is content-addressed (${clipUrl})`);
  r = await call('POST', '/api/tts/prepare', { code: C, voice: 'en-US-Neural2-F', items });
  ok(r.status === 200 && r.json.generated === 0 && r.json.cached === 3 && google.calls.length === 3 && r.json.clips['neighbor.'] === clipUrl, 'the same texts again: all cached, Google not called again');
  const usage = await getStore({ name: 'tts', consistency: 'strong' }).get(`ttsUsage/${C}/${new Date().toISOString().slice(0, 10)}`, { type: 'json' });
  ok(usage && usage.chars === 34, `daily counter ttsUsage/${C}/<today> = ${usage && usage.chars} chars`);
  const meta = await getStore({ name: 'tts', consistency: 'strong' }).getMetadata(`tts/${clipUrl.split('/').pop()}`);
  ok(meta && meta.metadata.voice === 'en-US-Neural2-F' && meta.metadata.chars === 9, 'clip blob metadata { voice, chars }');
  r = await call('GET', clipUrl);
  ok(r.status === 200 && r.ct === 'audio/mpeg' && r.cc === 'public, max-age=31536000, immutable' && r.bytes.subarray(4).toString() === 'en-US-Neural2-F:neighbor.', 'GET the clip → the MP3 bytes, audio/mpeg, immutable');
  r = await call('GET', '/api/tts/clip/' + '0'.repeat(32)); ok(r.status === 404, 'unknown clip → 404');
  r = await call('GET', '/api/tts/clip/not-an-id'); ok(r.status === 404, 'malformed clip id → 404');
  google.fail = 403;
  r = await call('POST', '/api/tts/prepare', { code: C, voice: 'en-US-Neural2-D', items: [{ text: 'enough.' }] });
  ok(r.status === 502 && r.json.error === 'synthesis-failed' && !JSON.stringify(r.json).includes(KEY) && r.json.charsToday === 34, `Google error → 502, the key scrubbed from "${r.json.message}", the characters given back`);
  google.fail = null;
  r = await call('DELETE', '/api/tts/prepare'); ok(r.status === 405, 'DELETE → 405');
} finally {
  globalThis.fetch = realFetch;
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed. TTS FUNCTION CHECK PASSED`);
