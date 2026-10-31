// Build Crew's service worker. It precaches the shell listed in offline.js (the game, the shared Spell Jump modules
// it imports and the vendored Three.js and Rapier), so the yard reloads offline. Only this game's caches are retired on
// upgrade. Family and voice APIs stay network-only; prepared natural-voice clips share Spell Jump's clip cache.
// Bump VERSION whenever the shell's file list or contents change, so returning players get a fresh cache.
const VERSION = 'build-crew-v0.3.0',
  PREFIX = 'build-crew-',
  TTS_CACHE = 'spell-jump-tts-v1';
importScripts('./offline.js');
// Install: fetch the whole shell, bypassing the HTTP cache, then take over without waiting for old tabs.
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  ),
);
// Activate: delete older Build Crew caches only, then control open pages.
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);
// The page posts the URLs it actually loaded, so anything the shell list missed is cached too (same origin, no APIs).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'cache-urls')
    event.waitUntil(
      (async () => {
        const cache = await caches.open(VERSION);
        await Promise.allSettled(
          event.data.urls
            .filter((u) => {
              const url = new URL(u, self.location.href);
              return url.origin === self.location.origin && !url.pathname.startsWith('/api/');
            })
            .map((u) => cache.add(new Request(u, { cache: 'reload' }))),
        );
      })(),
    );
});
// Voice clips are cache-first in the shared clip cache. Navigations and main.js are network-first with a 3 s offline
// fallback, so an update is picked up promptly; everything else is cache-first and refreshed in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/tts/clip/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TTS_CACHE),
          hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  const navigation = req.mode === 'navigate',
    fresh = navigation || url.pathname.endsWith('/src/main.js');
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION),
        key = navigation ? new Request(new URL('./', self.location.href)) : req,
        hit = await cache.match(key);
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
      if (fresh) {
        try {
          return await Promise.race([
            network,
            new Promise((_, reject) => setTimeout(() => reject(Error('offline')), 3000)),
          ]);
        } catch {
          if (hit) return hit;
          throw Error('not cached');
        }
      }
      if (hit) {
        event.waitUntil(network.catch(() => {}));
        return hit;
      }
      return network;
    })(),
  );
});
