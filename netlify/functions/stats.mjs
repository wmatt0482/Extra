// The "lights-on counter" (anonymous daily usage counts for learninglab.fun): one Netlify Function (Functions v2 API)
// over one Netlify Blobs store. All request handling lives in car-jump/src/stats/server.mjs (pure, unit-tested in
// tools/spelling-tests.mjs); this file only adapts the Blobs stores, the STATS_KEY environment variable (set in the
// Netlify UI, never in this file) and the Request/Response objects. It never reads cookies, the client's IP address
// or its user agent.
// Blob store `stats`: `day/<yyyy-mm-dd>` (one JSON doc per UTC day). The family total counts the `<CODE>/family`
// keys of the `families` store that netlify/functions/family.mjs writes (read on every request, nothing cached).
import { getStore } from '@netlify/blobs';
import { MAX_BODY, handleStats } from '../../car-jump/src/stats/server.mjs';

const FAMILY_KEY_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}\/family$/;

function statsStore() {
  const blobs = getStore({ name: 'stats', consistency: 'strong' });
  return {
    async getJSON(key) {
      const r = await blobs.getWithMetadata(key, { type: 'json' });
      return r ? { value: r.data, etag: r.etag || null } : null;
    },
    setJSON: (key, value, cond = {}) => blobs.setJSON(key, value, cond),
  };
}
function familiesCounter() {
  const blobs = getStore({ name: 'families', consistency: 'strong' });
  return {
    async count() {
      let n = 0;
      for await (const page of blobs.list({ paginate: true })) {
        for (const b of page.blobs) if (FAMILY_KEY_RE.test(b.key)) n++;
      }
      return n;
    },
  };
}
const env = (name) => (typeof Netlify !== 'undefined' && Netlify.env && Netlify.env.get(name)) || process.env[name] || '';

export default async (req) => {
  try { return await serve(req); } catch (_) {
    // e.g. Blobs not configured: a ping is never an error for the game; the stats page sees a 500
    const isPing = (() => { try { return new URL(req.url).pathname.startsWith('/api/stats/ping'); } catch (__) { return false; } })();
    return isPing ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
      : new Response(JSON.stringify({ error: 'server-error' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
};

async function serve(req) {
  const url = new URL(req.url);
  const contentLength = req.headers.get('content-length');
  let body = null;
  try {
    if (req.method === 'POST' && !(contentLength && Number(contentLength) > MAX_BODY)) body = await req.text();
  } catch (_) { body = null; }
  const res = await handleStats({ method: req.method, path: url.pathname, search: url.search, contentLength, body },
    { store: statsStore(), families: familiesCounter(), key: String(env('STATS_KEY')).trim() });
  return new Response(res.body, { status: res.status, headers: res.headers });
}

export const config = {
  path: ['/api/stats', '/api/stats/ping'],
};
