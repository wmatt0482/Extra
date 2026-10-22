// Runs the real lights-on counter Netlify Function (netlify/functions/stats.mjs) and the real @netlify/blobs client
// against @netlify/blobs' local BlobsServer (files in a temp dir), outside Netlify. Needs the root dependencies:
//   cd <repo root> && npm install && node car-jump/tools/stats-function-check.mjs
// Checks the Functions v2 export shape (default handler + config.path), pings → 204 and the day doc in the `stats`
// store (counters, version spread, family hashes), bad input → 400, the stats read: 503 without STATS_KEY, 403 for a
// wrong key, 200 with the right one (days, totals, the `<CODE>/family` count from the `families` store, no-store).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { BlobsServer } = await import('@netlify/blobs/server');
const { getStore } = await import('@netlify/blobs');
const dir = mkdtempSync(path.join(os.tmpdir(), 'learning-lab-stats-blobs-'));
const token = 'local-check', port = 19000 + Math.floor(Math.random() * 1000);
const server = new BlobsServer({ directory: dir, port, token });
await server.start();
const url = `http://localhost:${port}`;
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, token, siteID: 'local-site' })).toString('base64');

const fn = await import('../../netlify/functions/stats.mjs');
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };
try {
  ok(typeof fn.default === 'function', 'default export is the v2 handler');
  ok(JSON.stringify(fn.config.path) === JSON.stringify(['/api/stats', '/api/stats/ping']), 'config.path routes /api/stats and /api/stats/ping');
  const call = async (method, p, body) => {
    const raw = typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;
    const res = await fn.default(new Request('https://learninglab.example' + p, { method, headers: raw ? { 'content-type': 'application/json' } : {}, body: raw }), { params: {} });
    const text = await res.text();
    return { status: res.status, cc: res.headers.get('cache-control'), text, json: text && (res.headers.get('content-type') || '').startsWith('application/json') ? JSON.parse(text) : null };
  };
  const fam = createHash('sha256').update('K7QX-M2PA').digest('hex').slice(0, 8);
  let r = await call('POST', '/api/stats/ping', { game: 'spell-jump', v: '3.7.2', kind: 'day', fam });
  ok(r.status === 204 && r.text === '', 'a day ping → 204, no body');
  await call('POST', '/api/stats/ping', { game: 'spell-jump', v: '3.7.2', kind: 'run', fam });
  await call('POST', '/api/stats/ping', { game: 'trail-blazer', v: '1.6.3', kind: 'day', fam: '' });
  await call('POST', '/api/stats/ping', { game: 'trail-blazer', v: '1.6.3', kind: 'race', fam: '' });
  const today = new Date().toISOString().slice(0, 10);
  const doc = await getStore({ name: 'stats', consistency: 'strong' }).get(`day/${today}`, { type: 'json' });
  ok(doc && doc.sj.devices === 1 && doc.sj.runs === 1 && doc.sj.versions['3.7.2'] === 1 && doc.tb.devices === 1 && doc.tb.races === 1,
    `day/${today} counts devices, runs and races (${JSON.stringify({ sj: doc && doc.sj, tb: doc && doc.tb })})`);
  ok(JSON.stringify(doc.fams) === JSON.stringify({ sj: [fam], tb: [] }), 'the family hash is kept once, under Spell Jump');
  r = await call('POST', '/api/stats/ping', { game: 'spell-jump', v: '3.7.2', kind: 'race', fam: '' }); ok(r.status === 400, 'a Trail Blazer kind from Spell Jump → 400');
  r = await call('POST', '/api/stats/ping', JSON.stringify({ game: 'spell-jump', v: '3.7.2', kind: 'day', pad: 'x'.repeat(2000) })); ok(r.status === 400, 'a body over 1 KB → 400');
  delete process.env.STATS_KEY;
  r = await call('GET', '/api/stats?key=anything'); ok(r.status === 503 && r.json.error === 'no-key', 'GET without STATS_KEY → 503 no-key');
  process.env.STATS_KEY = 'check-key';
  r = await call('GET', '/api/stats?key=wrong'); ok(r.status === 403, 'a wrong key → 403');
  const families = getStore({ name: 'families', consistency: 'strong' });
  for (const c of ['K7QX-M2PA', 'ABCD-2345']) await families.setJSON(`${c}/family`, { rev: 1, updatedAt: Date.now(), deviceId: 'dcheck', data: { players: [] } });
  await families.setJSON('K7QX-M2PA/pmia.save', { rev: 1, updatedAt: Date.now(), deviceId: 'dcheck', data: {} });
  r = await call('GET', '/api/stats?key=check-key&days=30');
  ok(r.status === 200 && r.cc === 'no-store' && r.json.days.length === 30 && r.json.days[0].day === today, 'the right key → 200, 30 days newest first, no-store');
  ok(r.json.days[0].sj.devices === 1 && r.json.days[0].famsSj === 1 && r.json.totals.last7.tb.races === 1 && r.json.totals.last30.families === 1, 'days and totals carry the counts');
  ok(r.json.families.total === 2, `families total counts the <CODE>/family keys (${r.json.families.total})`);
  ok(r.json.versions.sj['3.7.2'] === 1 && r.json.versions.tb['1.6.3'] === 1, 'the version spread');
} finally {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed. STATS FUNCTION CHECK PASSED`);
