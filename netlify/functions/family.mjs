// Family sync for Spell Jump, Trail Blazer and Fraction Fright: one Netlify Function (Functions v2 API) over one Netlify Blobs store.
// All request handling lives in car-jump/src/sync/protocol.mjs (pure, unit-tested in tools/spelling-tests.mjs);
// this file only adapts the Blobs store and the Request/Response objects. Blob keys: `<CODE>/family`,
// `<CODE>/<playerId>.save` and `<CODE>/<playerId>.words` (Spell Jump), `<CODE>/<playerId>.tb` and
// `<CODE>/<playerId>.facts` (Trail Blazer's save and math facts, since v1.6), `<CODE>/<playerId>.ff` and
// `<CODE>/<playerId>.fracs` (Fraction Fright's save and fraction skills, since its 1.0), each holding
// { rev, updatedAt, deviceId, data }.
import { getStore } from '@netlify/blobs';
import { MAX_BODY, handle } from '../../car-jump/src/sync/protocol.mjs';

let warnedNoEtag = false;
function blobsStore() {
  // strong consistency: a read right after another device's write must see it, or the rev check would be wrong
  const blobs = getStore({ name: 'families', consistency: 'strong' });
  return {
    async get(key) {
      const r = await blobs.getWithMetadata(key, { type: 'json' });
      if (!r) return null;
      // Netlify's edge returns an ETag with every read; @netlify/blobs' local BlobsServer does not, and then the
      // write below falls back to an unconditional set (the rev check still runs, only a same-millisecond race
      // between two devices is no longer atomic)
      if (!r.etag && !warnedNoEtag) { warnedNoEtag = true; console.warn('[family] blob read returned no ETag: writes are not conditional'); }
      return { value: r.data, etag: r.etag || null };
    },
    // conditional writes ({ onlyIfNew } / { onlyIfMatch: etag }) make "rev = stored rev + 1" atomic
    set: (key, value, cond = {}) => blobs.setJSON(key, value, cond),
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const contentLength = req.headers.get('content-length');
  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD' && !(contentLength && Number(contentLength) > MAX_BODY)) {
    body = await req.text();
  }
  const res = await handle({
    method: req.method, path: url.pathname, contentType: req.headers.get('content-type'), contentLength, body,
  }, blobsStore());
  return new Response(res.body, { status: res.status, headers: res.headers });
};

export const config = {
  path: ['/api/family/:code', '/api/family/:code/:key'],
};
