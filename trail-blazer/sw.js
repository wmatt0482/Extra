// Trail Blazer service worker (same pattern as Spell Jump's car-jump/sw.js): the game works offline after the first
// load. index.html (every navigation) and src/main.js are network-first (3 s timeout, then the cache), so a launch
// while online picks up a new version at once. Every other same-origin file is cache-first and refreshed in the
// background (stale-while-revalidate). That includes the shared Spell Jump modules this page imports from
// /spell-jump/src/... and /spell-jump/vendor/... (a worker sees every request of the pages it controls, also outside
// its /trail-blazer/ scope). Bump VERSION on every deploy: the new worker installs, takes over at once (skipWaiting +
// clients.claim) and the page reloads itself on the next safe screen (src/meta/selfUpdate.js).
// /api/... (family sync, voice prepare / status) is network only. Natural-voice clips (/api/tts/clip/<id>) are
// content-addressed: cache-first in Spell Jump's clip cache (TTS_CACHE, shared on this origin).
// Caches are per origin, shared with Spell Jump's worker: this worker only ever deletes its own ('trail-blazer-…').
// If another worker removed this cache, the next online launch puts the shell back (ensureShell).
const VERSION = 'trail-blazer-v1.3.0';
const PREFIX = 'trail-blazer-';
const TTS_CACHE = 'spell-jump-tts-v1';
const NETWORK_TIMEOUT_MS = 3000;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'src/main.js',
  'src/sfx.js',
  'src/data/upgrades.js',
  'src/data/paints.js',
  'src/data/medals.js',
  'src/data/fallbackTrails.js',
  'src/meta/save.js',
  'src/meta/economy.js',
  'src/meta/selfUpdate.js',
  'src/meta/mockEngine.js',
  'src/ui/tbIcons.js',
  'src/ui/keyboard.js',
  'src/ui/players.js',
  'src/ui/garage.js',
  'src/ui/trails.js',
  'src/ui/hud.js',
  'src/ui/results.js',
  'src/ui/parentZone.js',
  'src/ui/vehiclePreview.js',
  'src/ui/numpad.js',
  'src/ui/gatePanel.js',
  'src/ui/grid.js',
  'src/facts/facts.js',
  'src/facts/spoken.js',
  'src/facts/hints.js',
  'src/facts/scheduler.js',
  'src/facts/store.js',
  'src/facts/patterns.js',
  'src/facts/placement.js',
  'src/facts/adaptive.js',
  'src/ui/pitCheck.js',
];
// The engine (built separately, may be split differently) and the shared Spell Jump modules (+ their imports):
// cached when present; the page also posts every module it actually loaded (see 'cache-urls' below).
const OPTIONAL = [
  'src/data/trails.js',
  'src/game/engine.js',
  'src/game/course.js',
  'src/game/render.js',
  'src/game/vehicle.js',
  'src/game/util.js',
  '../spell-jump/vendor/matter.min.js',
  '../spell-jump/src/audio.js',
  '../spell-jump/src/ui/dom.js',
  '../spell-jump/src/ui/icons.js',
  '../spell-jump/src/ui/controls.js',
  '../spell-jump/src/spelling/profiles.js',
  '../spell-jump/src/spelling/tts.js',
  '../spell-jump/src/spelling/cloudVoice.js',
  '../spell-jump/src/spelling/wordStore.js',
  '../spell-jump/src/spelling/scheduler.js',
  '../spell-jump/src/spelling/words.js',
  '../spell-jump/src/sync/client.js',
  '../spell-jump/src/sync/merge.js',
  '../spell-jump/src/sync/codes.js',
  '../spell-jump/src/sync/notify.js',
  '../spell-jump/src/tts/voices.js',
  '../spell-jump/src/meta/save.js',
  '../spell-jump/src/meta/rng.js',
  '../spell-jump/src/meta/engagement.js',
  '../spell-jump/src/data/cars.js',
  '../spell-jump/src/data/tracks.js',
  '../spell-jump/src/data/upgrades.js',
  '../spell-jump/src/data/cosmetics.js',
];

// straight from the server, not the HTTP cache (Netlify sends max-age=300): a new version caches new files
const fresh = (u) => new Request(u, { cache: 'reload' });
async function fill(cache) {
  await cache.addAll(SHELL.map(fresh));
  await Promise.allSettled(OPTIONAL.map((u) => cache.add(fresh(u))));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await fill(await caches.open(VERSION));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (!d || d.type !== 'cache-urls' || !Array.isArray(d.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(d.urls
      .filter((u) => typeof u === 'string' && u.startsWith(self.location.origin) && !isApi(new URL(u)))
      .map(async (u) => { if (!(await cache.match(u, { ignoreSearch: true }))) await cache.add(u); }));
  })());
});

let healing = null;
function ensureShell() {
  if (!healing) {
    healing = (async () => {
      const cache = await caches.open(VERSION);
      if (!(await cache.match('index.html', { ignoreSearch: true })) || !(await cache.match('src/sfx.js'))) await fill(cache);
    })().catch(() => {}).finally(() => { healing = null; });
  }
  return healing;
}

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
const isApi = (url) => url.origin === self.location.origin && url.pathname.startsWith('/api/');
const isClip = (url) => url.origin === self.location.origin && /^\/api\/tts\/clip\/[0-9a-f]{32}$/.test(url.pathname);

async function clip(req) {
  const cache = await caches.open(TTS_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200 && /^audio\//.test(res.headers.get('content-type') || '')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

// the page and its entry module are network-first; paths are relative to this worker's scope
const relPath = (url) => {
  const scope = new URL(self.registration.scope).pathname;
  return url.pathname.startsWith(scope) ? url.pathname.slice(scope.length) : null;
};
const isPage = (req, url) => req.mode === 'navigate' || (url.origin === self.location.origin && (relPath(url) === '' || relPath(url) === 'index.html'));
const isNetworkFirst = (req, url) => isPage(req, url) || (url.origin === self.location.origin && relPath(url) === 'src/main.js');
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'GET' && isClip(url)) { event.respondWith(clip(req).catch(() => Response.error())); return; }
  if (isApi(url)) return;                 // family sync, voice prepare / status: straight to the network (no cache)
  if (req.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isFont(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = isPage(req, url) ? 'index.html' : req;   // every navigation is the one page
    const refresh = (opts) => fetch(opts && req.mode === 'navigate' ? url.href : req, opts).then((res) => {
      if (res && res.redirected && req.mode === 'navigate') res = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()).catch(() => {});
      return res;
    });
    if (isNetworkFirst(req, url)) {
      const net = refresh({ cache: 'no-cache' });
      let res = null;
      try { res = await Promise.race([net, timeout(NETWORK_TIMEOUT_MS)]); } catch (_) { res = null; }
      if (res && res.ok) { if (isPage(req, url)) event.waitUntil(ensureShell()); return res; }
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
      try { return res || await net; } catch (_) { return Response.error(); }
    }
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    if (cached) {
      if (sameOrigin) event.waitUntil(refresh().catch(() => {}));
      return cached;
    }
    try { return await refresh(); } catch (e) { return Response.error(); }
  })());
});
