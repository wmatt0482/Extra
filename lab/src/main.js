// The /lab/ page controller (lab/SPEC.md §5.1): the Lab store and its family sync client, the Players screen, then the shared shell.
// Options (for tests and links): ?player=<id> opens that player, #quests (or shop, family, ...) opens that view, ?nosw skips the service worker.
import { lab } from './index.js';
import { registerLabSync } from './sync.js';
import { createSyncClient } from '../../spell-jump/src/sync/client.js';
import { Audio } from '../../spell-jump/src/audio.js';
import { installStyles, renderPage } from './ui/index.js';

const params = new URLSearchParams(location.search);
const swUsable = 'serviceWorker' in navigator && !params.has('nosw') && !params.has('labtest');

async function boot() {
  installStyles();
  registerLabSync();
  const store = lab.store;
  let page = null;
  const sync = createSyncClient({
    canApply: () => true,
    onApply: () => { if (page) page.onSync(); },
    onStatus: () => { if (page && page.screen === 'players') page.onSync(); },
  });
  const root = document.getElementById('app');
  page = renderPage(root, store, { sync, player: params.get('player') || '' });
  // test hooks, on localhost only (like window.__lab)
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { window.__labPage = page; window.__labSync = sync; }
  // the first tap unlocks the sounds, as in the games
  window.addEventListener('pointerdown', () => { try { Audio.unlock(); } catch (_) { /* ignore */ } }, { passive: true });
  sync.start();                              // first pull after the picker is on screen (never blocks it)
  if (swUsable) registerSW();
}

function registerSW() {
  try {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      return navigator.serviceWorker.ready;
    }).then((reg) => {
      // hand the worker every same-origin file this page loaded (the shared modules of the games, the games' labLooks modules)
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      if (reg.active) reg.active.postMessage({ type: 'cache-urls', urls: [location.href.split('?')[0], ...urls] });
    }).catch((e) => console.warn('[Lab] service worker not registered', e));
  } catch (e) { console.warn('[Lab] service worker unavailable', e); }
}

boot().catch((e) => {
  console.error('[Lab] could not start', e);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'The Lab could not start. Try again.';
});
