// The "lights-on counter" client (Spell Jump 3.7.2, Trail Blazer 1.6.3 imports it from /spell-jump/src/meta/pings.js):
// fire-and-forget anonymous pings to /api/stats/ping (car-jump/src/stats/server.mjs) so we can tell the site is used.
// A ping carries only { game, v, kind, fam }: no names, no player ids, no cookies. `fam` is the first 8 hex digits of
// SHA-256(family code) when the device has joined a family, '' otherwise.
//   'day'   at most once per device per game per UTC day (localStorage learningLab.ping.<game> = that day)
//   'run'   a finished Spell Jump run · 'test' a Friday test · 'list' a list saved or a class list applied
//   'race'  a finished Trail Blazer race · 'check' a Pit Crew Check
// Quiet on localhost / 127.0.0.1 (dev servers, the smoke suites) unless the page URL has ?pings=1. window.__pings
// records every ping that would be sent (always on a quiet host; elsewhere only when a test set it to an array).
export const PING_URL = '/api/stats/ping';
export const DAY_KEY_PREFIX = 'learningLab.ping.';

const utcDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

function quietHost() {
  try {
    const host = location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return false;
    return new URLSearchParams(location.search).get('pings') !== '1';
  } catch (_) { return true; }
}

const hashCache = new Map();
/** The 8-hex pseudonym of a family code ('' without one, or where crypto.subtle is missing). */
export async function famHash(code) {
  if (!code || typeof code !== 'string') return '';
  if (hashCache.has(code)) return hashCache.get(code);
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const h = Array.from(new Uint8Array(d).slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
    hashCache.set(code, h);
    return h;
  } catch (_) { return ''; }
}

/** 'day' once per UTC day: true when this call claims today (and remembers it). */
function claimDay(game, now) {
  const key = DAY_KEY_PREFIX + game;
  const today = utcDay(now);
  try {
    if (localStorage.getItem(key) === today) return false;
    localStorage.setItem(key, today);
  } catch (_) { /* no storage: at most once per page load instead */
    claimDay.mem = claimDay.mem || {};
    if (claimDay.mem[key] === today) return false;
    claimDay.mem[key] = today;
  }
  return true;
}

/** Sends one ping without waiting for it; never throws. famHash: a string or a promise of one (or a family code via
 *  `code`). Returns a promise for tests; callers never await it. */
export function ping(game, kind, { version = '', famHash: fh = '', code = '' } = {}) {
  try {
    if (kind === 'day' && !claimDay(game, Date.now())) return Promise.resolve(false);
  } catch (_) { return Promise.resolve(false); }
  return (async () => {
    try {
      const fam = (await (fh || (code ? famHash(code) : ''))) || '';
      const body = { game, v: String(version), kind, fam };
      const quiet = quietHost();
      if (quiet && !Array.isArray(window.__pings)) window.__pings = [];
      if (Array.isArray(window.__pings)) window.__pings.push(body);
      if (quiet) return false;
      fetch(PING_URL, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
      return true;
    } catch (_) { return false; }
  })();
}

/** One game's pinger: app.ping(kind) also sends today's 'day' ping first (a page left open past midnight counts). */
export function createPinger(game, { version, getCode }) {
  const send = (kind) => ping(game, kind, { version, code: (getCode && getCode()) || '' });
  return (kind = 'day') => {
    try {
      send('day');
      if (kind !== 'day') send(kind);
    } catch (_) { /* never in the way of the game */ }
  };
}
