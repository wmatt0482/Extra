// Progress transfer code (Parent Zone → Family code → Transfer progress): carries one player's game save + words
// from a device that cannot sync (e.g. a copy of the game where /api is blocked) to another device.
//
// code = base64url( gzip( JSON ) )   — gzip via CompressionStream('gzip') when the browser has it, else the plain
//        JSON bytes. Decoding tells them apart by the gzip magic bytes (1f 8b), so both kinds always import.
// JSON = { v: 1, exportedAt (ms), player: {name, color}, save, words }
//
// Import: a player with the same name (case-insensitive) on this device → merged with the family-sync merge rules
// (src/sync/merge.js: cash = max, cars / tracks = union, word records by the later practice, xp max, …);
// otherwise a new player is added with the imported save and words. Nothing here throws: every failure comes back as
// {ok: false, error} with a message for the parent.
import { mergeSave, mergeWords } from '../sync/merge.js';
import { normalize as normalizeSave } from './save.js';
import { normalizeWordsData } from '../spelling/wordStore.js';

export const TRANSFER_VERSION = 1;
export const MAX_CODE = 400000;         // characters; a real code is a few KB

// ---------- base64url ----------
export function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64Url(text) {
  const s = String(text || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!s || !/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) return null;
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, Stream, format) {
  const s = new Blob([bytes]).stream().pipeThrough(new Stream(format));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const isGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

/** Build the transfer code. opts.CompressionStream overrides the global (tests pass null for the plain path). */
export async function encodeTransfer({ player, save, words }, { now = Date.now(), CompressionStream: CS = globalThis.CompressionStream } = {}) {
  const doc = { v: TRANSFER_VERSION, exportedAt: now, player: { name: player.name, color: player.color }, save, words };
  const raw = new TextEncoder().encode(JSON.stringify(doc));
  let bytes = raw;
  if (typeof CS === 'function') { try { bytes = await pipe(raw, CS, 'gzip'); } catch (_) { bytes = raw; } }
  return toBase64Url(bytes);
}

/** Read a transfer code. Returns {ok: true, data, gzip} or {ok: false, error}. Never throws. */
export async function decodeTransfer(code, { DecompressionStream: DS = globalThis.DecompressionStream } = {}) {
  const bad = (error) => ({ ok: false, error });
  try {
    const text = String(code || '').trim();
    if (!text) return bad('Paste a transfer code first.');
    if (text.length > MAX_CODE) return bad('That code is too long. Copy it again from the other device.');
    const bytes = fromBase64Url(text);
    if (!bytes || !bytes.length) return bad("That doesn't look like a transfer code. Copy the whole code and try again.");
    let json;
    if (isGzip(bytes)) {
      if (typeof DS !== 'function') return bad('This browser cannot open that code. Update the browser, or export again from the other device.');
      try { json = new TextDecoder().decode(await pipe(bytes, DS, 'gzip')); } catch (_) { return bad('That code is damaged (part of it is missing). Copy the whole code again.'); }
    } else json = new TextDecoder().decode(bytes);
    let data;
    try { data = JSON.parse(json); } catch (_) { return bad('That code is damaged (part of it is missing). Copy the whole code again.'); }
    const v = validateTransfer(data);
    if (!v.ok) return v;
    return { ok: true, data: v.data, gzip: isGzip(bytes) };
  } catch (e) {
    return bad("That doesn't look like a transfer code. Copy the whole code and try again.");
  }
}

/** Shape check + normalization of a decoded transfer document. */
export function validateTransfer(d) {
  const bad = (error) => ({ ok: false, error });
  if (!d || typeof d !== 'object' || Array.isArray(d)) return bad("That doesn't look like a transfer code.");
  if (d.v !== TRANSFER_VERSION) return bad(typeof d.v === 'number' && d.v > TRANSFER_VERSION ? 'That code comes from a newer version of Spell Jump. Update this one first.' : "That doesn't look like a transfer code.");
  const p = d.player;
  const name = p && typeof p.name === 'string' ? p.name.replace(/[^A-Za-z' -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12) : '';
  if (!name) return bad('That code has no player name.');
  if (!d.save || typeof d.save !== 'object' || Array.isArray(d.save)) return bad('That code has no game progress in it.');
  if (!d.words || typeof d.words !== 'object' || !Array.isArray(d.words.lists)) return bad('That code has no word lists in it.');
  const now = Date.now();
  return {
    ok: true,
    data: {
      v: TRANSFER_VERSION, exportedAt: typeof d.exportedAt === 'number' && d.exportedAt > 0 ? Math.min(d.exportedAt, now) : now,
      player: { name, color: typeof p.color === 'string' ? p.color : '' },
      save: normalizeSave(d.save), words: normalizeWordsData(d.words, now),
    },
  };
}

/**
 * Apply an imported (validated) document to this device's family. deps: {createPlayer(family, name, color) → player |
 * null, loadSave(id), loadWords(id), writeSave(id, save), writeWords(id, words)}. Writes go through the app's normal
 * save / profiles writers, so family sync marks the keys dirty and pushes them.
 * Returns {ok, mode: 'merge'|'add', player, save, words, message} or {ok: false, error}.
 */
export function applyImport(family, data, deps, now = Date.now()) {
  try {
    const name = data.player.name;
    const same = family.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (same) {
      const save = mergeSave({ updatedAt: now, data: deps.loadSave(same.id) }, { updatedAt: data.exportedAt, data: data.save });
      const words = mergeWords({ updatedAt: now, data: deps.loadWords(same.id) }, { updatedAt: data.exportedAt, data: data.words }, now);
      deps.writeSave(same.id, save);
      deps.writeWords(same.id, words);
      const n = Object.keys(words.records || {}).length;
      return { ok: true, mode: 'merge', player: same, save, words,
        message: `Merged into ${same.name}: $${Math.round(save.cash).toLocaleString('en-US')}, ${save.owned.length} car${save.owned.length === 1 ? '' : 's'}, ${n} word${n === 1 ? '' : 's'}` };
    }
    const p = deps.createPlayer(family, name, data.player.color);
    if (!p) return { ok: false, error: 'This device already has 4 players. Remove one in Options, or import into a player with the same name.' };
    deps.writeSave(p.id, data.save);
    deps.writeWords(p.id, data.words);
    return { ok: true, mode: 'add', player: p, save: data.save, words: data.words, message: `Added ${p.name}` };
  } catch (e) {
    return { ok: false, error: 'Import failed: nothing was changed.' };
  }
}
