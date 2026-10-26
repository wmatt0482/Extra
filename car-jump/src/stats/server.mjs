// The "lights-on counter": an anonymous daily usage count for learninglab.fun, as pure request handling (no Netlify,
// no network of its own). netlify/functions/stats.mjs adapts Netlify Blobs to the `deps` below and forwards each
// request here; tools/spelling-tests.mjs drives it with in-memory stores.
//
//   POST /api/stats/ping   body { game: 'spell-jump' | 'trail-blazer' | 'fraction-fright', v: '3.7.2', kind, fam: '' | 8 hex } (≤ 1 KB)
//                          kind: 'day' (once per device per game per UTC day) · Spell Jump: 'run' | 'test' | 'list' ·
//                          Trail Blazer: 'race' | 'check' · Fraction Fright: 'wave' | 'lab' | 'check'
//                          → 204 (also when the store is busy or down: counts are approximate by design) · 400 bad input
//   GET  /api/stats?key=<STATS_KEY>&days=30
//                          → 200 { days: [{ day, sj, tb, ff, famsSj, famsTb, famsFf }] (newest first), totals: { last7, last30 },
//                                  families: { total }, versions: { sj: { v: n }, tb: { v: n }, ff: { v: n } }, generatedAt }
//                            503 { error: 'no-key' } (STATS_KEY not set) · 403 wrong key (constant-time compare)
// One JSON doc per UTC day at `day/<yyyy-mm-dd>`:
//   { sj: { devices, runs, tests, lists, versions: { v: n } }, tb: { devices, races, checks, versions: { v: n } },
//     ff: { devices, waves, labs, checks, versions: { v: n } }, fams: { sj: [hash], tb: [hash], ff: [hash] } }
//   (at most FAMS_CAP hashes per game per day; a doc written before Fraction Fright reads with an empty ff block)
// Never stored or accepted: names, player ids, cookies, IP addresses, user agents. The only pseudonymous value is
// `fam`: the first 8 hex digits of SHA-256(family code), so "families active today" can be counted; '' without a code.
//
// deps: { store, families, key, now? }
//   store:    { getJSON(key) → { value, etag } | null, setJSON(key, value, { onlyIfNew } | { onlyIfMatch } | {}) → { modified } }
//   families: { count() → number of `<CODE>/family` keys in the `families` store }
//   key:      the STATS_KEY environment variable ('' when unset)
export const MAX_BODY = 1024;
export const FAMS_CAP = 500;
export const VERSIONS_CAP = 40;
export const RETRIES = 4;
export const MAX_DAYS = 90;
export const GAMES = { 'spell-jump': 'sj', 'trail-blazer': 'tb', 'fraction-fright': 'ff' };
export const GAME_KEYS = Object.freeze(['sj', 'tb', 'ff']);
// kind → the counter it bumps, per game ('day' bumps `devices` and the version spread)
export const KINDS = {
  sj: { day: 'devices', run: 'runs', test: 'tests', list: 'lists' },
  tb: { day: 'devices', race: 'races', check: 'checks' },
  ff: { day: 'devices', wave: 'waves', lab: 'labs', check: 'checks' },
};
export const FAM_RE = /^[0-9a-f]{8}$/;
export const VERSION_RE = /^\d{1,3}(\.\d{1,3}){0,3}$/;
export const DAY_MS = 86400000;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (status, body) => ({ status, headers: { ...JSON_HEADERS }, body: JSON.stringify(body) });
const bad = (message) => reply(400, { error: 'bad-request', message });
const noContent = () => ({ status: 204, headers: { 'cache-control': 'no-store' }, body: null });

export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const docKey = (day) => `day/${day}`;
export const emptyDay = () => ({
  sj: { devices: 0, runs: 0, tests: 0, lists: 0, versions: {} },
  tb: { devices: 0, races: 0, checks: 0, versions: {} },
  ff: { devices: 0, waves: 0, labs: 0, checks: 0, versions: {} },
  fams: { sj: [], tb: [], ff: [] },
});
const num = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
/** A stored day doc, cleaned up into the full shape (missing or odd fields → 0 / {} / []). */
export function normalizeDay(v) {
  const d = emptyDay();
  if (!v || typeof v !== 'object') return d;
  for (const g of GAME_KEYS) {
    const src = v[g] && typeof v[g] === 'object' ? v[g] : {};
    for (const c of Object.keys(d[g])) if (c !== 'versions') d[g][c] = num(src[c]);
    const vs = src.versions && typeof src.versions === 'object' ? src.versions : {};
    for (const [k, n] of Object.entries(vs)) if (VERSION_RE.test(k) && num(n)) d[g].versions[k] = num(n);
    const fams = v.fams && Array.isArray(v.fams[g]) ? v.fams[g] : [];
    d.fams[g] = [...new Set(fams.filter((x) => typeof x === 'string' && FAM_RE.test(x)))].slice(0, FAMS_CAP);
  }
  return d;
}

const byteLength = (s) => new TextEncoder().encode(s).length;
/** Validates a ping body (a string). → { game: 'sj' | 'tb' | 'ff', kind, counter, v, fam } or { error }. */
export function readPing(body) {
  if (typeof body !== 'string' || !body) return { error: 'empty body' };
  if (byteLength(body) > MAX_BODY) return { error: `body over ${MAX_BODY} bytes` };
  let b;
  try { b = JSON.parse(body); } catch (_) { return { error: 'body is not JSON' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'body must be an object' };
  const g = GAMES[b.game];
  if (!g) return { error: 'game must be spell-jump or trail-blazer' };
  const counter = typeof b.kind === 'string' && Object.prototype.hasOwnProperty.call(KINDS[g], b.kind) ? KINDS[g][b.kind] : null;
  if (!counter) return { error: `kind must be one of ${Object.keys(KINDS[g]).join(', ')} for ${b.game}` };
  if (typeof b.v !== 'string' || !VERSION_RE.test(b.v)) return { error: 'v must be a version like 3.7.2' };
  const fam = b.fam == null ? '' : b.fam;
  if (fam !== '' && !(typeof fam === 'string' && FAM_RE.test(fam))) return { error: "fam must be '' or 8 hex digits" };
  return { game: g, kind: b.kind, counter, v: b.v, fam };
}

/** Applies one ping to a day doc (in place). */
export function applyPing(doc, p) {
  const g = doc[p.game];
  g[p.counter] = num(g[p.counter]) + 1;
  if (p.kind === 'day') {
    if (g.versions[p.v] || Object.keys(g.versions).length < VERSIONS_CAP) g.versions[p.v] = num(g.versions[p.v]) + 1;
  }
  if (p.fam && !doc.fams[p.game].includes(p.fam) && doc.fams[p.game].length < FAMS_CAP) doc.fams[p.game].push(p.fam);
  return doc;
}

// read → modify → conditional set on the etag; up to RETRIES attempts, then give up silently
async function bump(store, key, p) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const cur = await store.getJSON(key);
    const doc = applyPing(normalizeDay(cur && cur.value), p);
    const cond = cur ? (cur.etag != null ? { onlyIfMatch: cur.etag } : {}) : { onlyIfNew: true };
    const res = await store.setJSON(key, doc, cond);
    if (res && res.modified) return true;
  }
  return false;
}

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
/** Constant-time comparison of two strings (both hashed first, so neither the length nor a prefix leaks). */
export async function sameKey(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
/** The 8-hex pseudonym of a family code (the same as the client's src/meta/pings.js famHash). */
export const famHashOf = async (code) => hex(await sha256(String(code))).slice(0, 8);

const sumInto = (acc, d) => {
  for (const g of GAME_KEYS) for (const [c, n] of Object.entries(d[g])) if (c !== 'versions') acc[g][c] += n;
  for (const g of GAME_KEYS) for (const f of d.fams[g]) acc.famSets[g].add(f);
  return acc;
};
function totalsOf(days) {
  const acc = days.reduce(sumInto, { sj: { devices: 0, runs: 0, tests: 0, lists: 0 }, tb: { devices: 0, races: 0, checks: 0 }, ff: { devices: 0, waves: 0, labs: 0, checks: 0 },
    famSets: { sj: new Set(), tb: new Set(), ff: new Set() } });
  const all = new Set([...acc.famSets.sj, ...acc.famSets.tb, ...acc.famSets.ff]);
  // devices are device-days (a device counts once per day per game); families are distinct over the window
  return { sj: acc.sj, tb: acc.tb, ff: acc.ff, famsSj: acc.famSets.sj.size, famsTb: acc.famSets.tb.size, famsFf: acc.famSets.ff.size, families: all.size };
}

async function read(req, deps) {
  const q = new URLSearchParams(req.search || '');
  if (!deps.key) return reply(503, { error: 'no-key', message: 'the stats page is not set up on the server (STATS_KEY)' });
  if (!(await sameKey(q.get('key') || '', deps.key))) return reply(403, { error: 'forbidden', message: 'wrong key' });
  let n = Math.floor(Number(q.get('days') || 30));
  if (!Number.isFinite(n) || n < 1) n = 30;
  n = Math.min(n, MAX_DAYS);
  const now = deps.now ? deps.now() : Date.now();
  const span = Math.max(n, 30);
  const keys = Array.from({ length: span }, (_, i) => dayKey(now - i * DAY_MS));
  const docs = await Promise.all(keys.map(async (day) => {
    const r = await deps.store.getJSON(docKey(day));
    return { day, doc: normalizeDay(r && r.value) };
  }));
  const days = docs.slice(0, n).map(({ day, doc }) => ({ day, sj: doc.sj, tb: doc.tb, ff: doc.ff, famsSj: doc.fams.sj.length, famsTb: doc.fams.tb.length, famsFf: doc.fams.ff.length }));
  const versions = { sj: {}, tb: {}, ff: {} };
  for (const { doc } of docs.slice(0, n)) for (const g of GAME_KEYS) for (const [v, c] of Object.entries(doc[g].versions)) versions[g][v] = (versions[g][v] || 0) + c;
  let total = null;
  try { total = await deps.families.count(); } catch (_) { total = null; }
  return reply(200, {
    days,
    totals: { last7: totalsOf(docs.slice(0, 7).map((x) => x.doc)), last30: totalsOf(docs.slice(0, 30).map((x) => x.doc)) },
    families: { total },
    versions,
    generatedAt: new Date(now).toISOString(),
  });
}

async function ping(req, deps) {
  if (req.contentLength != null && req.contentLength !== '' && Number(req.contentLength) > MAX_BODY) return bad(`body over ${MAX_BODY} bytes`);
  const p = readPing(req.body);
  if (p.error) return bad(p.error);
  const now = deps.now ? deps.now() : Date.now();
  try { await bump(deps.store, docKey(dayKey(now)), p); } catch (_) { /* the store is down: this ping is not counted */ }
  return noContent();
}

/** The whole API: never throws (a failure inside is a 500 for GET and an uncounted 204 for a ping). */
export async function handleStats(req, deps) {
  try {
    const path = String((req && req.path) || '').replace(/\/+$/, '');
    if (path === '/api/stats/ping') return req.method === 'POST' ? await ping(req, deps) : reply(405, { error: 'method-not-allowed' });
    if (path === '/api/stats') return req.method === 'GET' ? await read(req, deps) : reply(405, { error: 'method-not-allowed' });
    return reply(404, { error: 'not-found' });
  } catch (e) {
    return reply(500, { error: 'server-error' });
  }
}

/** In-memory store with the same interface and conditional-write semantics (tests, local dev). */
export function memoryStatsStore(map = new Map()) {
  let n = 0;
  return {
    map,
    sets: 0,
    async getJSON(key) { const e = map.get(key); return e ? { value: JSON.parse(e.text), etag: e.etag } : null; },
    async setJSON(key, value, cond = {}) {
      this.sets++;
      const e = map.get(key);
      if (cond.onlyIfNew && e) return { modified: false };
      if (cond.onlyIfMatch != null && (!e || e.etag !== cond.onlyIfMatch)) return { modified: false };
      map.set(key, { text: JSON.stringify(value), etag: `"s${++n}"` });
      return { modified: true };
    },
  };
}
/** A families counter over a fixed number (tests). */
export const memoryFamilyCount = (n = 0) => ({ async count() { return n; } });
