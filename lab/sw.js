// The Lab's service worker (lab/SPEC.md §5.1; the same pattern as Wagon West's wagon-west/sw.js): the page works offline after the first load.
// index.html (every navigation) and src/main.js are network-first (3 s, then the cache), so a launch while online picks up a new version at once.
// Every other same-origin file is cache-first and refreshed in the background (stale-while-revalidate): lab/src/** and the shared modules this page
// imports from /spell-jump/src/... (a worker sees every request of the pages it controls, also outside its /lab/ scope). Bump VERSION on every deploy:
// the new worker installs, takes over at once (skipWaiting + clients.claim) and the page reloads itself on the next safe screen.
// /api/... (family sync, voice prepare / status) is network only; natural-voice clips (/api/tts/clip/<id>) are content-addressed and cache-first in
// Spell Jump's clip cache (TTS_CACHE, shared on this origin). Caches are per origin, shared with the games' workers: this worker only ever deletes its
// own ('lab-...'). If another worker removed this cache, the next online launch puts the shell back (ensureShell).
const VERSION = 'lab-v1.0.0';
const PREFIX = 'lab-';
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
  'src/index.js',
  'src/store.js',
  'src/sync.js',
  'src/core/combo.js',
  'src/core/crate.js',
  'src/core/engine.js',
  'src/core/events.js',
  'src/core/family.js',
  'src/core/merge.js',
  'src/core/model.js',
  'src/core/quests.js',
  'src/core/shop.js',
  'src/core/streak.js',
  'src/core/view.js',
  'src/core/xp.js',
  'src/data/catalog.js',
  'src/data/crate.js',
  'src/data/events.js',
  'src/data/goals.js',
  'src/data/quests.js',
  'src/ui/app.js',
  'src/ui/avatar.js',
  'src/ui/board.js',
  'src/ui/crate.js',
  'src/ui/gallery.js',
  'src/ui/glyph.js',
  'src/ui/home.js',
  'src/ui/hud.js',
  'src/ui/index.js',
  'src/ui/items.js',
  'src/ui/me.js',
  'src/ui/overlay.js',
  'src/ui/page.js',
  'src/ui/parent.js',
  'src/ui/pet.js',
  'src/ui/quests.js',
  'src/ui/results.js',
  'src/ui/scene.js',
  'src/ui/shop.js',
  'src/ui/styles.js',
  'src/ui/util.js',
  'src/ui/voice.js',
];
// The shared modules of Spell Jump (and what they import) and the games' looks modules: cached when present; the page also posts every module it
// actually loaded (see 'cache-urls' below).
const OPTIONAL = [
  '../spell-jump/src/audio.js',
  '../spell-jump/src/ui/dom.js',
  '../spell-jump/src/ui/icons.js',
  '../spell-jump/src/spelling/profiles.js',
  '../spell-jump/src/spelling/keyboard.js',
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
  '../spell-jump/src/meta/rng.js',
  '../spell-jump/src/meta/engagement.js',
  '../spell-jump/src/meta/save.js',
  '../spell-jump/src/data/cosmetics.js',
  '../spell-jump/src/data/classLists.js',
  '../spell-jump/src/meta/labLooks.js',
  '../trail-blazer/src/meta/labLooks.js',
  '../fraction-fright/src/meta/labLooks.js',
  '../wagon-west/src/meta/labLooks.js',
  '../build-crew/src/meta/labLooks.js',
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
      if (!(await cache.match('index.html', { ignoreSearch: true })) || !(await cache.match('src/index.js'))) await fill(cache);
    })().catch(() => {}).finally(() => { healing = null; });
  }
  return healing;
}

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
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = isPage(req, url) ? 'index.html' : req;   // every navigation is the one page
    const refresh = (opts) => fetch(opts && req.mode === 'navigate' ? url.href : req, opts).then((res) => {
      if (res && res.redirected && req.mode === 'navigate') res = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
      if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
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
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) { event.waitUntil(refresh().catch(() => {})); return cached; }
    try { return await refresh(); } catch (e) { return Response.error(); }
  })());
});
