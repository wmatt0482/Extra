// Family sync API, as pure request handling (no Netlify, no network): netlify/functions/family.mjs adapts a Netlify
// Blobs store to the `store` interface below and forwards each request here; tools/spelling-tests.mjs drives it with
// an in-memory Map store.
//
//   GET  /api/family/:code        → 200 { family: doc|null, players: { id: { save, words, tb, facts, ff, fracs } } } (each
//                                   doc|null; 404 when the family does not exist; removed players are not listed;
//                                   older clients simply ignore the fields they do not know)
//   POST /api/family/:code        body = doc (rev 1) → 201 { ok, rev, updatedAt }; 409 { error: 'exists' }
//   PUT  /api/family/:code/:key   key = family | <playerId>.save | <playerId>.words | <playerId>.tb (the Trail Blazer
//                                   save) | <playerId>.facts (Trail Blazer's math facts) | <playerId>.ff (the Fraction
//                                   Fright save) | <playerId>.fracs (Fraction Fright's skills), body = doc
//                                   → 200 { ok, rev, updatedAt } when rev = stored rev + 1 (or the key is new and
//                                   rev = 1); otherwise 409 { error: 'conflict', doc: <stored doc|null> }
//   doc = { rev, updatedAt, deviceId, data }
// Players are never deleted: the family doc keeps a `removedPlayers` tombstone list (DELETE answers 405).
//
// store: { get(key) → Promise<{ value, etag } | null>,
//          set(key, value, { onlyIfNew?: true } | { onlyIfMatch: etag } | {}) → Promise<{ modified: boolean }> }
// The conditional set makes the rev check atomic on Netlify Blobs (a racing writer gets a 409, never a lost update).

export const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
export const PLAYER_ID_RE = /^[a-z0-9_-]{1,32}$/;
export const MAX_BODY = 512 * 1024;
const PREFIX = '/api/family/';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (status, body) => ({ status, headers: { ...HEADERS }, body: JSON.stringify(body) });
const bad = (msg) => reply(400, { error: 'bad-request', message: msg });
const tooLarge = () => reply(400, { error: 'too-large', message: `body over ${MAX_BODY / 1024} KB` });

/** The per-player document kinds: Spell Jump's save and words, Trail Blazer's save (tb) and math facts (facts),
 *  Fraction Fright's save (ff) and fraction skills (fracs). */
export const PLAYER_KINDS = ['save', 'words', 'tb', 'facts', 'ff', 'fracs', 'ww'];   // ww: Wagon West (1.0)

export function parseKey(key) {
  if (key === 'family') return { kind: 'family' };
  const m = /^(.+)\.(save|words|tb|facts|ff|fracs|ww)$/.exec(key || '');
  if (!m || !PLAYER_ID_RE.test(m[1])) return null;
  return { kind: m[2], playerId: m[1] };
}

const blobKey = (code, key) => `${code}/${key}`;

// the stored document, validated on the way in
function readDoc(body, { contentType }) {
  if (!/^application\/json\b/i.test(contentType || '')) return { error: 'Content-Type must be application/json' };
  if (typeof body !== 'string') return { error: 'missing body' };
  if (new TextEncoder().encode(body).length > MAX_BODY) return { tooLarge: true };
  let doc;
  try { doc = JSON.parse(body); } catch (_) { return { error: 'body is not valid JSON' }; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { error: 'body must be a JSON object' };
  if (!Number.isInteger(doc.rev) || doc.rev < 1) return { error: 'rev must be a positive integer' };
  if (typeof doc.updatedAt !== 'number' || !Number.isFinite(doc.updatedAt) || doc.updatedAt < 0) return { error: 'updatedAt must be a timestamp (ms)' };
  if (typeof doc.deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(doc.deviceId)) return { error: 'deviceId must be 1-64 letters, digits, _ or -' };
  if (!doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) return { error: 'data must be a JSON object' };
  return { doc: { rev: doc.rev, updatedAt: doc.updatedAt, deviceId: doc.deviceId, data: doc.data } };
}

const removedSet = (familyDoc) => new Set(familyDoc && familyDoc.data && Array.isArray(familyDoc.data.removedPlayers) ? familyDoc.data.removedPlayers : []);
function playerIds(familyDoc) {
  const players = familyDoc && familyDoc.data && Array.isArray(familyDoc.data.players) ? familyDoc.data.players : [];
  const removed = removedSet(familyDoc);
  const ids = [];
  for (const p of players) if (p && typeof p.id === 'string' && PLAYER_ID_RE.test(p.id) && !removed.has(p.id) && !ids.includes(p.id)) ids.push(p.id);
  return ids.slice(0, 16);
}

/**
 * Handle one request. req = { method, path (URL pathname), contentType, body (string | null), contentLength? }.
 * Returns { status, headers, body (JSON string) }. Never throws for bad input; a store failure becomes a 500.
 */
export async function handle(req, store) {
  try {
    return await route(req, store);
  } catch (e) {
    return reply(500, { error: 'server', message: 'storage error' });
  }
}

async function route(req, store) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '');
  if (!path.startsWith(PREFIX)) return reply(404, { error: 'not-found' });
  let rest = path.slice(PREFIX.length);
  if (rest.endsWith('/')) rest = rest.slice(0, -1);
  const parts = rest.split('/').map((s) => { try { return decodeURIComponent(s); } catch (_) { return '\u0000'; } });
  if (parts.length < 1 || parts.length > 2 || parts.some((s) => s === '')) return reply(404, { error: 'not-found' });
  const [code, key] = parts;
  if (!CODE_RE.test(code)) return bad('family code must look like ABCD-2345');
  if (req.contentLength != null && Number(req.contentLength) > MAX_BODY) return tooLarge();

  if (parts.length === 1) {
    if (method === 'GET') return getFamily(code, store);
    if (method === 'POST') return createFamily(code, req, store);
    return { ...reply(405, { error: 'method-not-allowed' }), headers: { ...HEADERS, allow: 'GET, POST' } };
  }
  const k = parseKey(key);
  if (!k) return bad('key must be family or <playerId>.save | .words | .tb | .facts | .ff | .fracs (player id: a-z 0-9 _ -, up to 32)');
  if (method !== 'PUT') return { ...reply(405, { error: 'method-not-allowed', message: 'players are removed through the removedPlayers list in the family doc' }), headers: { ...HEADERS, allow: 'PUT' } };
  return putKey(code, key, req, store);
}

async function getFamily(code, store) {
  const fam = await store.get(blobKey(code, 'family'));
  if (!fam) return reply(404, { error: 'not-found', message: 'no family with this code' });
  const players = {};
  const ids = playerIds(fam.value);
  const n = PLAYER_KINDS.length;
  const docs = await Promise.all(ids.flatMap((id) => PLAYER_KINDS.map((kind) => store.get(blobKey(code, `${id}.${kind}`)))));
  ids.forEach((id, i) => { players[id] = Object.fromEntries(PLAYER_KINDS.map((kind, j) => [kind, docs[n * i + j] ? docs[n * i + j].value : null])); });
  return reply(200, { family: fam.value, players });
}

async function createFamily(code, req, store) {
  const r = readDoc(req.body, req);
  if (r.tooLarge) return tooLarge();
  if (r.error) return bad(r.error);
  if (r.doc.rev !== 1) return bad('a new family starts at rev 1');
  const res = await store.set(blobKey(code, 'family'), r.doc, { onlyIfNew: true });
  if (!res || !res.modified) return reply(409, { error: 'exists', message: 'a family with this code already exists' });
  return reply(201, { ok: true, rev: r.doc.rev, updatedAt: r.doc.updatedAt });
}

async function putKey(code, key, req, store) {
  const r = readDoc(req.body, req);
  if (r.tooLarge) return tooLarge();
  if (r.error) return bad(r.error);
  if (key !== 'family') {
    const fam = await store.get(blobKey(code, 'family'));
    if (!fam) return reply(404, { error: 'not-found', message: 'no family with this code' });
  }
  const bk = blobKey(code, key);
  const cur = await store.get(bk);
  const conflict = () => reply(409, { error: 'conflict', doc: cur ? cur.value : null });
  if (!cur) {
    if (r.doc.rev !== 1) return conflict();
    const res = await store.set(bk, r.doc, { onlyIfNew: true });
    if (!res || !res.modified) return reply(409, { error: 'conflict', doc: ((await store.get(bk)) || { value: null }).value });
  } else {
    const stored = cur.value && Number.isInteger(cur.value.rev) ? cur.value.rev : 0;
    if (r.doc.rev !== stored + 1) return conflict();
    const res = await store.set(bk, r.doc, cur.etag != null ? { onlyIfMatch: cur.etag } : {});
    if (!res || !res.modified) return reply(409, { error: 'conflict', doc: ((await store.get(bk)) || { value: null }).value });
  }
  return reply(200, { ok: true, rev: r.doc.rev, updatedAt: r.doc.updatedAt });
}

/** In-memory store with the same conditional-write semantics (tests, local dev). */
export function memoryStore(map = new Map()) {
  let n = 0;
  return {
    map,
    async get(key) { const e = map.get(key); return e ? { value: JSON.parse(e.text), etag: e.etag } : null; },
    async set(key, value, cond = {}) {
      const e = map.get(key);
      if (cond.onlyIfNew && e) return { modified: false };
      if (cond.onlyIfMatch != null && (!e || e.etag !== cond.onlyIfMatch)) return { modified: false };
      const etag = `"m${++n}"`;
      map.set(key, { text: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
  };
}
