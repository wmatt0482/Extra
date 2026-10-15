// Spell Jump service worker: the app works offline after the first load.
// index.html (every navigation) and src/main.js are network-first (3 s timeout, then the cache), so a launch
// while online picks up a new version at once. Every other same-origin file is cache-first and refreshed in the
// background (stale-while-revalidate). Bump VERSION on every deploy: the new worker installs, takes over at once
// (skipWaiting + clients.claim) and the page reloads itself on the next safe screen (src/meta/selfUpdate.js).
// The family sync API (/api/...) is network only: never cached, never answered from the cache.
const VERSION = 'spell-jump-v3.3.0';
const NETWORK_TIMEOUT_MS = 3000;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'vendor/matter.min.js',
  'src/main.js',
  'src/audio.js',
  'src/data/cars.js',
  'src/data/tracks.js',
  'src/data/upgrades.js',
  'src/data/rating.js',
  'src/data/cosmetics.js',
  'src/meta/save.js',
  'src/meta/economy.js',
  'src/meta/goals.js',
  'src/meta/daily.js',
  'src/meta/rng.js',
  'src/meta/mockEngine.js',
  'src/meta/achievements.js',
  'src/meta/selfUpdate.js',
  'src/meta/engagement.js',
  'src/meta/transfer.js',
  'src/ui/dom.js',
  'src/ui/icons.js',
  'src/ui/controls.js',
  'src/ui/hud.js',
  'src/ui/garage.js',
  'src/ui/tracks.js',
  'src/ui/results.js',
  'src/ui/panels.js',
  'src/ui/carPreview.js',
  'src/ui/crates.js',
  'src/game/car.js',
  'src/game/util.js',
  'src/ui/fireworks.js',
  'src/ui/titleHero.js',
  'src/ui/players.js',
  'src/ui/parentZone.js',
  'src/spelling/words.js',
  'src/spelling/scheduler.js',
  'src/spelling/wordStore.js',
  'src/spelling/profiles.js',
  'src/spelling/tts.js',
  'src/spelling/keyboard.js',
  'src/spelling/spellPanel.js',
  'src/spelling/testMode.js',
  'src/spelling/why.js',
  'src/sync/client.js',
  'src/sync/merge.js',
  'src/sync/codes.js',
  'src/sync/notify.js',
];
// The engine is built separately and may be split into several modules: cache the entry if present;
// the page also posts every module it actually loaded (see 'cache-urls' below).
const OPTIONAL = ['src/game/engine.js'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // straight from the server, not the HTTP cache (Netlify sends max-age=300): a new version caches new files
    const fresh = (u) => new Request(u, { cache: 'reload' });
    await cache.addAll(SHELL.map(fresh));
    await Promise.allSettled(OPTIONAL.map((u) => cache.add(fresh(u))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
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

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

const isApi = (url) => url.origin === self.location.origin && url.pathname.startsWith('/api/');

// the page and its entry module are network-first; paths are relative to this worker's scope
const relPath = (url) => {
  const scope = new URL(self.registration.scope).pathname;
  return url.pathname.startsWith(scope) ? url.pathname.slice(scope.length) : url.pathname;
};
const isPage = (req, url) => req.mode === 'navigate' || (url.origin === self.location.origin && (relPath(url) === '' || relPath(url) === 'index.html'));
const isNetworkFirst = (req, url) => isPage(req, url) || (url.origin === self.location.origin && relPath(url) === 'src/main.js');
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (isApi(url)) return;                 // family sync: straight to the network (no respondWith, no cache)
  if (req.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isFont(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = isPage(req, url) ? 'index.html' : req;   // every navigation is the one page
    // network-first requests skip the HTTP cache too (revalidate), so a new deploy shows up on the next launch
    // (a navigation is re-requested by URL: a 'navigate' Request cannot take options; a redirected answer is
    // re-wrapped, since a navigation may not be answered with one)
    const refresh = (opts) => fetch(opts && req.mode === 'navigate' ? url.href : req, opts).then((res) => {
      if (res && res.redirected && req.mode === 'navigate') res = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()).catch(() => {});
      return res;
    });
    if (isNetworkFirst(req, url)) {
      // the fresh copy when online (and cache it); the cached one when offline, slow (3 s) or failing
      const net = refresh({ cache: 'no-cache' });
      let res = null;
      try { res = await Promise.race([net, timeout(NETWORK_TIMEOUT_MS)]); } catch (_) { res = null; }
      if (res && res.ok) return res;
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
      try { return res || await net; } catch (_) { return Response.error(); }
    }
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    if (cached) {
      if (sameOrigin) event.waitUntil(refresh().catch(() => {})); // refresh in the background
      return cached;
    }
    try {
      return await refresh();
    } catch (e) {
      return Response.error();
    }
  })());
});
