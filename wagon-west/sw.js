// Wagon West service worker (the same pattern as Fraction Fright's fraction-fright/sw.js): the game works offline after
// the first load. index.html (every navigation) and src/main.js are network-first (3 s timeout, then the cache), so a
// launch while online picks up a new version at once. Every other same-origin file is cache-first and refreshed in the
// background (stale-while-revalidate). That includes the shared modules this page imports from /spell-jump/src/...,
// /trail-blazer/src/... and /fraction-fright/src/... (a worker sees every request of the pages it controls, also
// outside its /wagon-west/ scope). Bump VERSION on every deploy: the new worker installs, takes over at once
// (skipWaiting + clients.claim) and the page reloads itself on the next safe screen (src/meta/selfUpdate.js).
// /api/... (family sync, voice prepare / status, the usage counter) is network only. Natural-voice clips
// (/api/tts/clip/<id>) are content-addressed: cache-first in Spell Jump's clip cache (TTS_CACHE, shared on this origin).
// Caches are per origin, shared with the other games' workers: this worker only ever deletes its own ('wagon-west-…').
// If another worker removed this cache, the next online launch puts the shell back (ensureShell).
// v1.1 adds the trail's music (src/meta/music.js), the trail cards (src/content/cards.js, src/ui/cards.js) and Camp.
// v1.2 adds the Wagon panel (src/ui/wagonPanel.js); the other streams' v1.2 modules (people, deeds, the mini-games) are in
// OPTIONAL below: cached when present.
// v1.4 (Frodo and the river) adds src/ui/finds.js and src/ui/fishLog.js (the journal's Finds and Fish log pages, the find pop) to the
// shell; the Content and Journey streams' new modules (finds, fish, moments, quests, trailFacts; dog, fishing, quests, moments,
// collections) and the scene's new files are OPTIONAL like v1.2's (the page also posts every module it loaded).
// v1.5 (The Long Trail) adds the year picker, the fork panel, the diggings and the homestead (src/ui/yearPicker.js, forkPanel.js, diggings.js,
// homestead.js) to the shell; the content and journey modules that came with it (routes, tiers, families, homestead; seasons, homestead, gold,
// adaptive) and Trail Blazer's placement staircase are OPTIONAL like v1.2's (the page also posts every module it loaded).
// v1.6 (The Lab, lab/SPEC.md §4.4) adds the Lab bridge (src/meta/labBridge.js: it loads /lab/src/index.js on its own, so a missing, blocked or old Lab never stops the game), the choice
// panel and its words (src/ui/choicePanel.js, src/content/choices.js) to the shell; the choice and preview journey modules, the Lab looks (src/meta/labLooks.js, src/scene/looks16.js)
// and the Lab's own entry (/lab/src/index.js, outside this scope) are OPTIONAL: cached when present, and the page posts every Lab module it loaded.
const VERSION = 'wagon-west-v1.8.0';
const PREFIX = 'wagon-west-';
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
  'src/meta/save.js',
  'src/meta/sync.js',
  'src/meta/sfx.js',
  'src/meta/selfUpdate.js',
  'src/meta/mockScene.js',
  'src/meta/music.js',
  'src/meta/speech.js',
  'src/meta/voiceTexts.js',
  'src/content/legs.js',
  'src/content/companions.js',
  'src/content/events.js',
  'src/content/letters.js',
  'src/content/lookouts.js',
  'src/content/nations.js',
  'src/content/cards.js',
  'src/ui/players.js',
  'src/ui/title.js',
  'src/ui/map.js',
  'src/ui/outfit.js',
  'src/ui/looks.js',
  'src/ui/store.js',
  'src/ui/hud.js',
  'src/ui/card.js',
  'src/ui/markerPanel.js',
  'src/ui/problemPanel.js',
  'src/ui/river.js',
  'src/ui/postOffice.js',
  'src/ui/journal.js',
  'src/ui/results.js',
  'src/ui/parentZone.js',
  'src/ui/spellSkin.js',
  'src/ui/camp.js',
  'src/ui/cards.js',
  'src/ui/wagonPanel.js',
  'src/ui/finds.js',
  'src/ui/fishLog.js',
  'src/ui/yearPicker.js',
  'src/ui/forkPanel.js',
  'src/ui/diggings.js',
  'src/ui/homestead.js',
  'src/ui/choicePanel.js',
  'src/meta/labBridge.js',
  'src/content/choices.js',
  'src/content/routes.js',
  'src/content/tiers.js',
  'src/content/families.js',
  'src/content/homestead.js',
];
// The scene and the journey (the other streams' modules) and the shared modules of the other games (+ their imports):
// cached when present; the page also posts every module it actually loaded (see 'cache-urls' below).
const OPTIONAL = [
  'src/journey/sim.js',
  'src/journey/problems.js',
  'src/journey/letters.js',
  'src/journey/economy.js',
  'src/journey/events.js',
  'src/journey/stars.js',
  'src/journey/route.js',
  'src/journey/rng.js',
  'src/journey/challenge.js',
  'src/journey/deeds.js',
  'src/content/people.js',
  'src/content/finds.js',
  'src/content/fish.js',
  'src/content/moments.js',
  'src/content/quests.js',
  'src/content/trailFacts.js',
  'src/journey/dog.js',
  'src/journey/fishing.js',
  'src/journey/quests.js',
  'src/journey/moments.js',
  'src/journey/collections.js',
  'src/journey/seasons.js',
  'src/journey/homestead.js',
  'src/journey/gold.js',
  'src/journey/adaptive.js',
  'src/journey/choices.js',
  'src/journey/preview.js',
  'src/meta/labLooks.js',
  'src/scene/looks16.js',
  '../lab/src/index.js',
  'src/journey/supplies.js',
  'src/journey/skills.js',
  'src/scene/dog14.js',
  'src/scene/fishing2.js',
  'src/scene/camp14.js',
  'src/scene/rocks17.js',
  'src/scene/sprites17.js',
  'src/journey/rocks.js',
  'src/scene/ambient.js',
  'src/ui/people.js',
  'src/ui/deeds.js',
  'src/scene/derby.js',
  'src/scene/ford.js',
  'src/scene/rafting.js',
  'src/scene/stampede.js',
  'src/scene/sprites12.js',
  'src/scene/util.js',
  'src/scene/backdrops.js',
  'src/scene/engine.js',
  'src/scene/render.js',
  'src/scene/sprites.js',
  'src/scene/biomes.js',
  'src/scene/hunt.js',
  'src/scene/fish.js',
  'src/scene/homestead.js',
  'src/scene/gold.js',
  'src/scene/snub.js',
  'src/scene/sail.js',
  '../spell-jump/src/audio.js',
  '../spell-jump/src/ui/dom.js',
  '../spell-jump/src/ui/icons.js',
  '../spell-jump/src/ui/chart.js',
  '../spell-jump/src/spelling/profiles.js',
  '../spell-jump/src/spelling/keyboard.js',
  '../spell-jump/src/spelling/tts.js',
  '../spell-jump/src/spelling/cloudVoice.js',
  '../spell-jump/src/spelling/spellPanel.js',
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
  '../spell-jump/src/meta/pings.js',
  '../spell-jump/src/data/cosmetics.js',
  '../spell-jump/src/data/classLists.js',
  '../trail-blazer/src/ui/numpad.js',
  '../trail-blazer/src/facts/facts.js',
  '../trail-blazer/src/facts/hints.js',
  '../trail-blazer/src/facts/scheduler.js',
  '../trail-blazer/src/facts/store.js',
  '../trail-blazer/src/facts/placement.js',
  '../trail-blazer/src/facts/adaptive.js',
  '../trail-blazer/src/facts/scouts.js',
  '../trail-blazer/src/meta/save.js',
  '../trail-blazer/src/meta/sync.js',
  '../fraction-fright/src/meta/save.js',
  '../fraction-fright/src/skills/items.js',
  '../fraction-fright/src/skills/ladder.js',
  '../fraction-fright/src/skills/store.js',
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
      if (!(await cache.match('index.html', { ignoreSearch: true })) || !(await cache.match('src/meta/sfx.js'))) await fill(cache);
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
