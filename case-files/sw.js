// Case Files service worker (same pattern as Fraction Fright's and Trail Blazer's): the game works offline after the
// first load. index.html (every navigation) and src/main.js are network-first (3 s timeout, then the cache), so a launch
// while online picks up a new version at once. Every other same-origin file is cache-first and refreshed in the
// background (stale-while-revalidate). That includes the shared Spell Jump modules this page imports from
// /spell-jump/src/... (a worker sees every request of the pages it controls, also outside its /case-files/
// scope). Bump VERSION on every deploy: the new worker installs, takes over at once (skipWaiting + clients.claim) and
// the page reloads itself on the next safe screen (src/meta/selfUpdate.js).
// /api/... (family sync, voice prepare / status, the usage counter) is network only. Natural-voice clips
// (/api/tts/clip/<id>) are content-addressed: cache-first in Spell Jump's clip cache (TTS_CACHE, shared on this origin).
// Caches are per origin, shared with the other games' workers: this worker only ever deletes its own
// ('case-files-…'). If another worker removed this cache, the next online launch puts the shell back (ensureShell).
const VERSION = 'case-files-v0.1.2';
const PREFIX = 'case-files-';
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
  'src/logic/answers.js',
  'src/logic/coach.js',
  'src/logic/lines.js',
  'src/logic/pacing.js',
  'src/logic/payout.js',
  'src/logic/run.js',
  'src/meta/labBridge.js',
  'src/meta/labLooks.js',
  'src/meta/save.js',
  'src/meta/selfUpdate.js',
  'src/meta/speech.js',
  'src/meta/sync.js',
  'src/meta/voiceTexts.js',
  'src/ui/art.js',
  'src/ui/board.js',
  'src/ui/caseView.js',
  'src/ui/closed.js',
  'src/ui/coach.js',
  'src/ui/coachArt.js',
  'src/ui/file.js',
  'src/ui/home.js',
  'src/ui/modal.js',
  'src/ui/parentZone.js',
  'src/ui/players.js',
  'src/ui/reader.js',
];
// The case content (src/content/**: whatever cases exist), The Lab and the shared Spell Jump modules (+ their imports): cached when
// present; the page also posts every module it actually loaded (see 'cache-urls' below), which is how the content files get in.
const OPTIONAL = [
  'src/content/index.js',
  '../lab/src/index.js',       // The Lab (lab/SPEC.md §3.6): optional, so a game never fails to start without it; the page posts the Lab modules it loaded
  '../spell-jump/src/audio.js',
  '../spell-jump/src/ui/dom.js',
  '../spell-jump/src/ui/icons.js',
  '../spell-jump/src/spelling/profiles.js',
  '../spell-jump/src/spelling/keyboard.js',
  '../spell-jump/src/spelling/tts.js',
  '../spell-jump/src/spelling/cloudVoice.js',
  '../spell-jump/src/spelling/words.js',
  '../spell-jump/src/sync/client.js',
  '../spell-jump/src/sync/merge.js',
  '../spell-jump/src/sync/codes.js',
  '../spell-jump/src/sync/notify.js',
  '../spell-jump/src/tts/voices.js',
  '../spell-jump/src/meta/engagement.js',
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
      if (!(await cache.match('index.html', { ignoreSearch: true })) || !(await cache.match('src/main.js'))) await fill(cache);
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
