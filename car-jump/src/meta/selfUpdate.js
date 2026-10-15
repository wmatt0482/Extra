// Self-updating app: when a new service worker (new VERSION) takes control of the page, reload once, but only
// when nothing is in progress. Safe: the player picker, the title, the garage and track select, with no run, no
// spell panel, no test and the Parent Zone closed. Anywhere else the app shows "Update ready, restarting soon"
// (once) and reloads as soon as it is back on a safe screen. Pure logic (no DOM), so tools/spelling-tests.mjs
// covers it; src/main.js wires it to navigator.serviceWorker 'controllerchange'.

export const SAFE_SCREENS = Object.freeze(['players', 'title', 'garage', 'tracks']);
export const UPDATE_NOTICE = 'Update ready, restarting soon';

/** True when a reload would not interrupt anything. */
export function safeToReload({ screen, running = false, spelling = false, testing = false, parentZone = false } = {}) {
  return SAFE_SCREENS.includes(screen) && !running && !spelling && !testing && !parentZone;
}

/**
 * Reload-at-most-once guard.
 *   hadController  a service worker controlled the page when it loaded. The very first install also fires
 *                  'controllerchange' (clients.claim()); that one is not an update and never reloads.
 *   isSafe()       safeToReload(...) for the app's current state
 *   reload()       location.reload() (after saving)
 *   notify()       the non-blocking "restarting soon" toast (shown once)
 * Call onControllerChange() from the event and check() whenever the app may have reached a safe screen.
 */
export function createUpdateGuard({ hadController = false, isSafe = () => true, reload, notify = () => {} }) {
  let controlled = !!hadController, pending = false, done = false, notified = false;
  const api = {
    get pending() { return pending; },
    get reloaded() { return done; },
    onControllerChange() {
      if (!controlled) { controlled = true; return false; }
      if (done) return false;
      pending = true;
      return api.check();
    },
    check() {
      if (!pending || done) return false;
      let safe = false;
      try { safe = !!isSafe(); } catch (_) { safe = false; }
      if (!safe) {
        if (!notified) { notified = true; try { notify(); } catch (_) { /* ignore */ } }
        return false;
      }
      done = true; pending = false;
      reload();
      return true;
    },
  };
  return api;
}
