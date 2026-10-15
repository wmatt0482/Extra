// Family codes and device ids. A family code is 8 characters from an alphabet without look-alikes
// (no I, O, 0, 1), shown as XXXX-XXXX; it is generated on this device when a parent taps "Create family code".
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

function randomInts(n) {
  const out = new Uint32Array(n);
  try { globalThis.crypto.getRandomValues(out); return Array.from(out); } catch (_) {
    return Array.from({ length: n }, () => Math.floor(Math.random() * 2 ** 32));
  }
}

/** A new family code, e.g. "K7QX-M2PA". rand (optional, for tests) returns integers. */
export function generateCode(ints = randomInts(8)) {
  const c = ints.slice(0, 8).map((v) => CODE_ALPHABET[v % CODE_ALPHABET.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** What a parent typed → "XXXX-XXXX" (uppercase, spaces / dashes ignored), or null when it can't be a code. */
export function normalizeCode(text) {
  const raw = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 8) return null;
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return CODE_RE.test(code) ? code : null;
}

export function newDeviceId() {
  return 'd' + randomInts(4).map((v) => v.toString(36)).join('').slice(0, 20);
}
