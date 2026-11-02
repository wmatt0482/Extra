// Tiny test harness and fixtures shared by the Lab's Node tools (no framework, plain asserts).
export const results = { passed: 0, failed: [] };
export function test(name, fn) {
  try { fn(); results.passed++; console.log('  ok  ' + name); } catch (e) { results.failed.push(name); console.log('  FAIL ' + name + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n      ')); }
}
export async function atest(name, fn) {
  try { await fn(); results.passed++; console.log('  ok  ' + name); } catch (e) { results.failed.push(name); console.log('  FAIL ' + name + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n      ')); }
}
export const section = (s) => console.log('\n' + s);
export function finish(label) {
  console.log(`\n${results.passed} passed, ${results.failed.length} failed`);
  if (results.failed.length) { console.log('FAILED:\n- ' + results.failed.join('\n- ')); process.exit(1); }
  console.log(`ALL ${label} PASSED`);
}
export const DAY_MS = 86400000;
export const T0 = new Date(2026, 10, 2, 16, 0, 0).getTime();       // Mon Nov 2 2026, 4 pm local (ISO week 2026-W45)
export const at = (n, h = 0) => T0 + n * DAY_MS + h * 3600000;
export function pad(n) { return String(n).padStart(2, '0'); }
export function dayOf(t) { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/** A seeded random source (mulberry32) for property tests. */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  const s = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, map: m };
  return s;
}
