// Runs the real Netlify Function (netlify/functions/family.mjs) and the real @netlify/blobs client against
// @netlify/blobs' local BlobsServer (files in a temp dir), outside Netlify. Needs the root dependencies:
//   cd <repo root> && npm install && node car-jump/tools/sync-function-check.mjs
// Checks the Functions v2 export shape (default handler + config.path), create / get / put with rev checks,
// 409s, validation, Cache-Control: no-store, and that strong-consistency reads see the previous write.
// (The local BlobsServer returns no ETag on reads, so the conditional onlyIfMatch write is exercised only on
// Netlify; onlyIfNew, used by create and a player's first save, is exercised here.)
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { BlobsServer } = await import('@netlify/blobs/server');
const dir = mkdtempSync(path.join(os.tmpdir(), 'spell-jump-blobs-'));
const token = 'local-check', port = 18000 + Math.floor(Math.random() * 1000);
const server = new BlobsServer({ directory: dir, port, token });
await server.start();
const url = `http://localhost:${port}`;
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, token, siteID: 'local-site' })).toString('base64');

const fn = await import('../../netlify/functions/family.mjs');
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };
try {
  ok(typeof fn.default === 'function', 'default export is the v2 handler');
  ok(JSON.stringify(fn.config.path) === JSON.stringify(['/api/family/:code', '/api/family/:code/:key']), 'config.path routes /api/family/:code and /api/family/:code/:key');
  const call = async (method, p, body, ct = 'application/json') => {
    const res = await fn.default(new Request('https://spell-jump.example' + p, { method, headers: body ? { 'content-type': ct } : {}, body: body ? JSON.stringify(body) : undefined }), { params: {} });
    return { status: res.status, cc: res.headers.get('cache-control'), json: await res.json() };
  };
  const C = 'K7QX-M2PA';
  const doc = (rev, data) => ({ rev, updatedAt: Date.now(), deviceId: 'dcheck', data });
  let r = await call('GET', `/api/family/${C}`); ok(r.status === 404 && r.cc === 'no-store', 'GET unknown family → 404, no-store');
  r = await call('POST', `/api/family/${C}`, doc(1, { players: [{ id: 'pmia', name: 'Mia' }], removedPlayers: [] })); ok(r.status === 201, 'POST creates the family → 201');
  r = await call('POST', `/api/family/${C}`, doc(1, { players: [] })); ok(r.status === 409, 'POST again → 409');
  r = await call('PUT', `/api/family/${C}/pmia.save`, doc(1, { cash: 10 })); ok(r.status === 200, 'PUT a new key at rev 1 → 200');
  r = await call('PUT', `/api/family/${C}/pmia.save`, doc(1, { cash: 11 })); ok(r.status === 409 && r.json.doc.data.cash === 10, 'PUT a stale rev → 409 with the stored doc');
  r = await call('PUT', `/api/family/${C}/pmia.save`, doc(2, { cash: 12 })); ok(r.status === 200, 'PUT rev + 1 → 200');
  r = await call('GET', `/api/family/${C}`); ok(r.status === 200 && r.json.players.pmia.save.rev === 2 && r.json.players.pmia.save.data.cash === 12, 'GET sees the latest write (strong consistency)');
  r = await call('PUT', `/api/family/${C}/pmia.save`, doc(3, {}), 'text/plain'); ok(r.status === 400, 'non-JSON body → 400');
  r = await call('GET', '/api/family/abcd-efgh'); ok(r.status === 400, 'bad code → 400');
  r = await call('DELETE', `/api/family/${C}/pmia.save`); ok(r.status === 405, 'DELETE → 405 (players are tombstoned, never deleted)');
} finally {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed. NETLIFY FUNCTION CHECK PASSED`);
