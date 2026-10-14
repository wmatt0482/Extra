// Spell Jump service worker: cache-first app shell so the game works offline after the first load.
// Same-origin files are served from cache and refreshed in the background (stale-while-revalidate),
// so a deploy shows up on the next launch. Bump VERSION to force a clean cache.
const VERSION = 'spell-jump-v3.0.1';
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
  'src/meta/save.js',
  'src/meta/economy.js',
  'src/meta/goals.js',
  'src/meta/daily.js',
  'src/meta/rng.js',
  'src/meta/mockEngine.js',
  'src/meta/achievements.js',
  'src/ui/dom.js',
  'src/ui/icons.js',
  'src/ui/controls.js',
  'src/ui/hud.js',
  'src/ui/garage.js',
  'src/ui/tracks.js',
  'src/ui/results.js',
  'src/ui/panels.js',
  'src/ui/carPreview.js',
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
];
// The engine is built separately and may be split into several modules: cache the entry if present;
// the page also posts every module it actually loaded (see 'cache-urls' below).
const OPTIONAL = ['src/game/engine.js'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    await Promise.allSettled(OPTIONAL.map((u) => cache.add(u)));
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
      .filter((u) => typeof u === 'string' && u.startsWith(self.location.origin))
      .map(async (u) => { if (!(await cache.match(u, { ignoreSearch: true }))) await cache.add(u); }));
  })());
});

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isFont(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const nav = req.mode === 'navigate';
    const cached = await cache.match(nav ? 'index.html' : req, { ignoreSearch: nav || sameOrigin });
    const refresh = () => fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(nav ? 'index.html' : req, res.clone()).catch(() => {});
      return res;
    });
    if (cached) {
      if (sameOrigin) event.waitUntil(refresh().catch(() => {})); // refresh in the background
      return cached;
    }
    try {
      return await refresh();
    } catch (e) {
      return nav ? (await cache.match('index.html')) || Response.error() : Response.error();
    }
  })());
});
