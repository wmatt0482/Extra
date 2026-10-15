// Spell Jump natural voice: one Netlify Function (Functions v2 API) that makes word-list voice clips with Google Cloud
// Text-to-Speech and keeps them in Netlify Blobs. All request handling lives in car-jump/src/tts/server.mjs (pure,
// unit-tested in tools/spelling-tests.mjs); this file only adapts the Blobs stores, the Google call (API key from the
// GOOGLE_TTS_API_KEY environment variable, or its alias TexttoVoice) and the Request/Response objects.
// Blob store `tts`: `tts/<id>` (MP3 bytes, metadata { voice, chars }) and `ttsUsage/<CODE>/<yyyy-mm-dd>` ({ chars }).
// Family codes are checked against the `families` store that netlify/functions/family.mjs writes.
import { getStore } from '@netlify/blobs';
import { MAX_BODY, apiKeyFrom, googleSynthesizer, handleTts } from '../../car-jump/src/tts/server.mjs';

function ttsStore() {
  const blobs = getStore({ name: 'tts', consistency: 'strong' });
  return {
    has: async (key) => (await blobs.getMetadata(key)) != null,
    async getBytes(key) {
      const r = await blobs.getWithMetadata(key, { type: 'arrayBuffer' });
      return r && r.data ? { bytes: new Uint8Array(r.data), metadata: r.metadata || {} } : null;
    },
    setBytes: (key, bytes, metadata) => blobs.set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { metadata }),
    async getJSON(key) {
      const r = await blobs.getWithMetadata(key, { type: 'json' });
      return r ? { value: r.data, etag: r.etag || null } : null;
    },
    setJSON: (key, value, cond = {}) => blobs.setJSON(key, value, cond),
  };
}
function familiesStore() {
  const blobs = getStore({ name: 'families', consistency: 'strong' });
  return { exists: async (code) => (await blobs.getMetadata(`${code}/family`)) != null };
}

export default async (req) => {
  const url = new URL(req.url);
  const contentLength = req.headers.get('content-length');
  let body = null;
  if (req.method === 'POST' && !(contentLength && Number(contentLength) > MAX_BODY)) body = await req.text();
  // GOOGLE_TTS_API_KEY (recommended) or TexttoVoice (src/tts/server.mjs KEY_VARS)
  const key = apiKeyFrom((name) => (typeof Netlify !== 'undefined' && Netlify.env && Netlify.env.get(name)) || process.env[name] || '');
  const res = await handleTts({
    method: req.method, path: url.pathname, contentType: req.headers.get('content-type'), contentLength, body,
  }, { store: ttsStore(), families: familiesStore(), synthesize: key ? googleSynthesizer(key) : null });
  return new Response(res.body, { status: res.status, headers: res.headers });
};

export const config = {
  path: ['/api/tts/status', '/api/tts/prepare', '/api/tts/clip/:id'],
};
