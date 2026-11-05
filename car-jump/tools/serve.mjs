// The static server for Spell Jump's browser tools (ui-smoke, sync-smoke, integration-smoke, engine-smoke; lab-smoke
// serves in-process and uses the cleanup and the watchdog only).
//
// v3.9.1: a tool used to leave its `python3 -m http.server 8080` running when it stopped early (an exception before its
// try/finally, `await browser.close()` throwing first, Ctrl-C, or an outer timeout killing node), and the next suite then
// ran against that orphan or could not start its own. Now:
//   - a server this process STARTED is stopped by its own pid (process.kill(child.pid)), never by name or pattern, on
//     success, on failure, on an uncaught error, on SIGINT / SIGTERM / SIGHUP (an outer timeout) and on the tool's own
//     watchdog (SMOKE_TIMEOUT_MS, default 30 min);
//   - a server that was ALREADY on the port (someone else's) is used if it serves Spell Jump and is never stopped; one that
//     serves something else is an error (the tool does not test the wrong app, and does not touch that process);
//   - if our server does not come up, it is stopped before the error is thrown.
import { spawn } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanups = new Set();          // sync functions run once on any exit path
let hooked = false;

function runCleanupsSync() {
  for (const fn of [...cleanups]) { cleanups.delete(fn); try { fn(); } catch (_) { /* keep going */ } }
}
function hook() {
  if (hooked) return;
  hooked = true;
  process.on('exit', runCleanupsSync);
  const codes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  for (const [sig, code] of Object.entries(codes)) {
    process.on(sig, () => { console.error(`\n[serve] ${sig}: stopping what this tool started`); runCleanupsSync(); process.exit(code); });
  }
  const crash = (e) => { console.error(e); runCleanupsSync(); process.exit(1); };
  process.on('uncaughtException', crash);
  process.on('unhandledRejection', crash);
}

/** Run fn (sync) on every way out of this process: normal exit, process.exit, a crash, a signal, the watchdog. Returns
 *  a function that removes it again. */
export function onCleanup(fn) {
  hook();
  cleanups.add(fn);
  return () => cleanups.delete(fn);
}

const alive = (child) => child && child.exitCode === null && child.signalCode === null;
function signalChild(child, sig) {
  if (!alive(child)) return;
  try { process.kill(child.pid, sig); } catch (_) { /* already gone */ }
}

/** Stop a server this process started: SIGTERM to its pid, SIGKILL if it is still there after `graceMs`. */
export async function stopChild(child, graceMs = 3000) {
  if (!alive(child)) return;
  const gone = new Promise((r) => child.once('exit', r));
  signalChild(child, 'SIGTERM');
  if (await Promise.race([gone.then(() => true), sleep(graceMs).then(() => false)])) return;
  signalChild(child, 'SIGKILL');
  await Promise.race([gone, sleep(graceMs)]);
}

/** Exit with an error after `ms` (env SMOKE_TIMEOUT_MS overrides), stopping what this tool started. Never keeps node alive. */
export function watchdog(name, ms = Number(process.env.SMOKE_TIMEOUT_MS) || 30 * 60 * 1000) {
  hook();
  const t = setTimeout(() => {
    console.error(`\n[serve] ${name}: timed out after ${Math.round(ms / 1000)} s: stopping what this tool started`);
    runCleanupsSync();
    process.exit(124);
  }, ms);
  t.unref();
  return t;
}

/** Spell Jump's index.html and its word store are there: the server on the port serves this app. */
export async function servesSpellJump(base) {
  try {
    const [a, b] = await Promise.all([fetch(base + '/index.html'), fetch(base + '/src/spelling/wordStore.js')]);
    return a.ok && b.ok && /Spell Jump/i.test(await a.text());
  } catch (_) { return false; }
}

/**
 * Serve `cwd` with python3 -m http.server on `port`. Returns { base, child, reused, stop }:
 *   reused  a Spell Jump server was already there (someone else's): used, never stopped (child null, stop() does nothing)
 *   stop()  stops the server this call started, by its pid (also run automatically on every way out)
 */
export async function startStaticServer({ cwd, port = 8080, waitMs = 8000, check = servesSpellJump } = {}) {
  hook();
  const base = `http://localhost:${port}`;
  const up = async () => { try { return (await fetch(base + '/index.html')).ok; } catch (_) { return false; } };
  const reuse = async () => {
    if (!(await check(base))) throw new Error(`port ${port} is held by another server that does not serve Spell Jump; this tool did not start it and will not stop it (free the port and run again)`);
    console.log(`[serve] using the server already on port ${port} (not started here, so not stopped here)`);
    return { base, child: null, reused: true, stop: async () => {} };
  };
  if (await up()) return reuse();
  const child = spawn('python3', ['-m', 'http.server', String(port)], { cwd, stdio: 'ignore' });
  let spawnError = null;
  child.once('error', (e) => { spawnError = e; });
  const off = onCleanup(() => signalChild(child, 'SIGTERM'));
  child.once('exit', off);
  const stop = async () => { off(); await stopChild(child); };
  const t0 = Date.now();
  while (Date.now() - t0 < waitMs) {
    if (spawnError || !alive(child)) break;
    if (await up()) break;
    await sleep(100);
  }
  if (spawnError) { await stop(); throw new Error(`could not start python3 -m http.server ${port}: ${spawnError.message}`); }
  if (!alive(child)) {
    // ours could not bind: someone else took the port meanwhile
    if (await up()) return reuse();
    throw new Error(`python3 -m http.server ${port} exited at once (code ${child.exitCode})`);
  }
  if (!(await up())) { await stop(); throw new Error(`python3 -m http.server ${port} did not answer within ${waitMs} ms (stopped it)`); }
  console.log(`[serve] started python3 -m http.server ${port} (pid ${child.pid}); it stops with this tool`);
  return { base, child, reused: false, stop };
}
