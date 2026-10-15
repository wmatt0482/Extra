// Family sync client. Off until a parent creates or joins a family in Parents → Family sync; then every synced key
// (the family record, each player's game save, each player's words) is pushed after a local change and pulled from
// the server, so the same players and progress show up on every device in the family.
//
// Local state lives in `spellJump.sync`:
//   { v, code, deviceId, keys: { family | <id>.save | <id>.words: { rev, updatedAt, dirty, hash } }, lastSync, lastError }
// rev       the server revision this device last saw or wrote for the key
// dirty     the local copy changed since then (persisted, so changes made offline are pushed later)
// hash      hash of the content at that revision (a write that changes nothing does not mark the key dirty)
//
// Push: a local write marks its key dirty; 2 s later every dirty key is PUT with rev + 1. A 409 hands back the server
//   doc: it is merged into the local copy (src/sync/merge.js), then the PUT is retried once with the new rev.
// Pull: after the player picker shows, when the app becomes visible, when the device comes back online and every 60 s
//   while visible: GET the family and apply every key whose rev is newer than ours (merged when ours is dirty).
// Nothing here blocks play: every network call is async and failures only end up in `lastError` (Parent Zone).
import { FAMILY_KEY, loadFamily, normalizeFamily, defaultFamily, saveKey, wordsKey } from '../spelling/profiles.js';
import { hashString } from '../meta/rng.js';
import { onLocalWrite } from './notify.js';
import { generateCode, newDeviceId, normalizeCode } from './codes.js';
import { familySyncData, mergeFamily, mergeKey } from './merge.js';

export const SYNC_KEY = 'spellJump.sync';
export const API_BASE = '/api/family/';
export const PUSH_DELAY_MS = 2000;
export const POLL_MS = 60000;
const RETRY_MS = 15000;

const OFFLINE = 'offline';

function readJSON(key) {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (_) { return null; }
}
function writeRaw(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.warn('[sync] could not write', key, e); return false; }
}
function removeRaw(key) { try { localStorage.removeItem(key); } catch (_) { /* ignore */ } }

const hashOf = (data) => { const s = JSON.stringify(data ?? null); return hashString(s).toString(36) + ':' + s.length; };

export const syncKeyFor = (storageKey) => {
  if (storageKey === FAMILY_KEY) return 'family';
  const m = /^spellJump\.([a-z0-9_-]{1,32})\.(save|words)$/i.exec(storageKey || '');
  return m ? `${m[1]}.${m[2]}` : null;
};
const storageKeyFor = (k) => (k === 'family' ? FAMILY_KEY : k.endsWith('.save') ? saveKey(k.slice(0, -5)) : wordsKey(k.slice(0, -6)));
const playerOf = (k) => (k === 'family' ? null : k.replace(/\.(save|words)$/, ''));

// the shared part of a family record, as it would read back after a load (normalized)
const canonFamily = (data) => familySyncData(normalizeFamily(data) || defaultFamily());
const canon = (k, data) => (k === 'family' ? canonFamily(data) : data);

function agoText(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/**
 * hooks (all optional):
 *   canApply(key)   false while that data is in use (a run in progress): the pull skips it until next time
 *   onApply(key)    local storage for `key` was replaced with newer data: reload what is in memory
 *   onStatus(state) the status changed (Parent Zone line, picker chip)
 * opts.fetch replaces window.fetch (tests).
 */
export function createSyncClient(hooks = {}, opts = {}) {
  const doFetch = opts.fetch || ((...a) => fetch(...a));
  let state = load();
  let applying = 0;
  let pushTimer = 0, pollTimer = 0, retryTimer = 0;
  let chain = Promise.resolve();
  let started = false;
  const listeners = new Set();

  function load() {
    const raw = readJSON(SYNC_KEY);
    const s = { v: 1, code: null, deviceId: null, keys: {}, lastSync: 0, lastError: '' };
    if (raw && typeof raw === 'object') {
      if (typeof raw.code === 'string' && normalizeCode(raw.code) === raw.code) s.code = raw.code;
      if (typeof raw.deviceId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.deviceId)) s.deviceId = raw.deviceId;
      if (raw.keys && typeof raw.keys === 'object') {
        for (const [k, m] of Object.entries(raw.keys)) {
          if (!m || typeof m !== 'object' || !(k === 'family' || /^[a-z0-9_-]{1,32}\.(save|words)$/i.test(k))) continue;
          s.keys[k] = { rev: Number.isInteger(m.rev) && m.rev > 0 ? m.rev : 0, updatedAt: Number(m.updatedAt) || 0, dirty: !!m.dirty, hash: typeof m.hash === 'string' ? m.hash : '' };
        }
      }
      s.lastSync = Number(raw.lastSync) || 0;
      s.lastError = typeof raw.lastError === 'string' ? raw.lastError : '';
    }
    return s;
  }
  function persist() { if (state.code || state.deviceId) writeRaw(SYNC_KEY, state); }
  function deviceId() { if (!state.deviceId) state.deviceId = newDeviceId(); return state.deviceId; }
  function emit() {
    const s = api.status();
    try { hooks.onStatus && hooks.onStatus(s); } catch (e) { console.warn('[sync] status hook failed', e); }
    for (const fn of listeners) { try { fn(s); } catch (_) { /* ignore */ } }
  }
  function setError(msg) {
    if (state.lastError !== msg) { state.lastError = msg; persist(); emit(); }
    if (msg && state.code) { clearTimeout(retryTimer); retryTimer = setTimeout(() => { if (state.code && isVisible()) api.syncNow(); }, RETRY_MS); }
  }
  const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const exclusive = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  // ---------- local data ----------
  function familyIds() { return new Set(loadFamily().players.map((p) => p.id)); }
  function readLocal(k) {
    if (k === 'family') return familySyncData(loadFamily());
    return readJSON(storageKeyFor(k));
  }
  function writeLocal(k, data) {
    applying++;
    try {
      if (k === 'family') {
        const cur = loadFamily();
        const fam = canonFamily(data);
        const record = { ...fam, migrated: cur.migrated, lastPlayer: fam.players.some((p) => p.id === cur.lastPlayer) ? cur.lastPlayer : null };
        writeRaw(FAMILY_KEY, record);
        // removed players: their data goes on every device
        for (const id of fam.removedPlayers) {
          removeRaw(saveKey(id)); removeRaw(wordsKey(id));
          delete state.keys[`${id}.save`]; delete state.keys[`${id}.words`];
        }
      } else writeRaw(storageKeyFor(k), data);
    } finally { applying--; }
  }
  function meta(k) { return state.keys[k] || (state.keys[k] = { rev: 0, updatedAt: 0, dirty: false, hash: '' }); }

  // a write from the app (profiles.js / save.js)
  function onWrite(storageKey) {
    if (!state.code || applying) return;
    const k = syncKeyFor(storageKey);
    if (!k) return;
    const data = readLocal(k);
    if (data == null) return;
    const m = meta(k);
    const dirty = hashOf(data) !== m.hash;
    if (dirty) m.updatedAt = Date.now();
    if (dirty !== m.dirty || dirty) { m.dirty = dirty; persist(); }
    if (dirty) schedulePush();
  }
  onLocalWrite(onWrite);

  function schedulePush(ms = PUSH_DELAY_MS) {
    if (!state.code) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { exclusive(pushAll).catch(() => {}); }, ms);
  }

  // ---------- network ----------
  async function request(method, path, body) {
    let res;
    try {
      res = await doFetch(API_BASE + path, {
        method, cache: 'no-store', credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return { status: 0, body: null, offline: true };
    }
    let json = null;
    try { json = await res.json(); } catch (_) { /* empty body */ }
    return { status: res.status, body: json };
  }
  function httpError(res, what) {
    if (res.offline) return OFFLINE;
    if (res.status === 404) return 'This family code was not found on the server. Leave the family and join again.';
    if (res.status === 400) return `The server refused the ${what} (${(res.body && res.body.message) || 'bad request'}).`;
    return `Sync problem: the server answered ${res.status} for the ${what}.`;
  }

  // ---------- merge / apply ----------
  // ours is dirty and the server has something newer: merge, keep our key dirty when the result differs
  function mergeIntoLocal(k, doc, mergeOpts) {
    const m = meta(k);
    const local = { updatedAt: m.updatedAt, data: readLocal(k) };
    const remote = { updatedAt: Number(doc.updatedAt) || 0, data: doc.data };
    const merged = k === 'family' ? mergeFamily(local.data, remote.data, mergeOpts) : mergeKey(k, local, remote);
    writeLocal(k, merged);
    m.rev = doc.rev;
    m.hash = hashOf(canon(k, doc.data));
    m.dirty = hashOf(readLocal(k)) !== m.hash;
    if (m.dirty) m.updatedAt = Date.now();
    else m.updatedAt = remote.updatedAt;
    return m.dirty;
  }
  function replaceLocal(k, doc) {
    const m = meta(k);
    writeLocal(k, doc.data);
    m.rev = doc.rev;
    m.updatedAt = Number(doc.updatedAt) || 0;
    m.hash = hashOf(canon(k, doc.data));
    m.dirty = hashOf(readLocal(k)) !== m.hash;
  }
  function notifyApplied(k) { try { hooks.onApply && hooks.onApply(k); } catch (e) { console.warn('[sync] apply hook failed', e); } }

  // one remote doc from a GET: newer than ours → replace (clean) or merge (dirty). Returns true when applied.
  function applyRemote(k, doc) {
    if (!doc || !Number.isInteger(doc.rev) || !doc.data) return false;
    const m = state.keys[k];
    if (m && doc.rev <= m.rev) return false;
    if (k !== 'family' && !familyIds().has(playerOf(k))) return false;
    try { if (hooks.canApply && !hooks.canApply(k)) return false; } catch (_) { /* apply */ }
    if (m && m.dirty) mergeIntoLocal(k, doc);
    else replaceLocal(k, doc);
    notifyApplied(k);
    return true;
  }

  // ---------- push ----------
  async function pushKey(k, retry = true) {
    const m = state.keys[k];
    if (!m || !m.dirty || !state.code) return true;
    const data = readLocal(k);
    if (data == null) { m.dirty = false; return true; }
    const h = hashOf(data);
    const doc = { rev: m.rev + 1, updatedAt: m.updatedAt || Date.now(), deviceId: deviceId(), data };
    const res = await request('PUT', `${state.code}/${encodeURIComponent(k)}`, doc);
    if (res.status === 200) {
      m.rev = doc.rev;
      m.hash = h;
      m.dirty = hashOf(readLocal(k)) !== h;      // changed again while the request was out: stays dirty
      return true;
    }
    if (res.status === 409 && res.body) {
      const srv = res.body.doc;
      if (srv && Number.isInteger(srv.rev) && srv.data) {
        try { if (hooks.canApply && !hooks.canApply(k)) return false; } catch (_) { /* merge */ }   // in use: next time
        mergeIntoLocal(k, srv);
        notifyApplied(k);
      } else m.rev = 0;
      if (retry && m.dirty) return pushKey(k, false);
      return !m.dirty;
    }
    setError(httpError(res, 'upload'));
    return false;
  }
  async function pushAll() {
    if (!state.code) return true;
    const ids = familyIds();
    for (const k of Object.keys(state.keys)) if (k !== 'family' && !ids.has(playerOf(k))) delete state.keys[k];
    const keys = Object.keys(state.keys).filter((k) => state.keys[k].dirty).sort((a, b) => (a === 'family' ? -1 : b === 'family' ? 1 : a < b ? -1 : 1));
    let ok = true;
    for (const k of keys) {
      const done = await pushKey(k);
      if (!done) { ok = false; if (state.lastError === OFFLINE) break; }
    }
    if (ok && keys.length) { state.lastSync = Date.now(); if (state.lastError) state.lastError = ''; }
    persist();
    emit();
    return ok;
  }

  // ---------- pull ----------
  async function pull() {
    if (!state.code) return false;
    const res = await request('GET', state.code);
    if (res.status !== 200 || !res.body) { setError(httpError(res, 'download')); return false; }
    const { family, players } = res.body;
    applyRemote('family', family);
    for (const [id, docs] of Object.entries(players || {})) {
      if (!docs) continue;
      applyRemote(`${id}.save`, docs.save);
      applyRemote(`${id}.words`, docs.words);
    }
    state.lastSync = Date.now();
    state.lastError = '';
    persist();
    emit();
    return true;
  }

  async function syncCycle() {
    if (!state.code) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setError(OFFLINE); return false; }
    const pushed = await pushAll();
    if (!pushed && state.lastError === OFFLINE) return false;
    const pulled = await pull();
    if (pulled && Object.values(state.keys).some((m) => m.dirty)) await pushAll();
    return pulled;
  }

  // ---------- lifecycle ----------
  function onVisible() { if (state.code && isVisible()) api.syncNow(); }
  function onOnline() { if (state.code) api.syncNow(); }
  function startTimers() {
    clearInterval(pollTimer);
    if (!state.code) return;
    pollTimer = setInterval(() => { if (isVisible()) api.syncNow(); }, POLL_MS);
  }

  const api = {
    get code() { return state.code; },
    get deviceId() { return state.deviceId; },
    get state() { return JSON.parse(JSON.stringify(state)); },
    /** Begin syncing (boot calls this after the player picker shows; it never blocks it). */
    start() {
      if (started) return;
      started = true;
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
      if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
      startTimers();
      if (state.code) setTimeout(() => api.syncNow(), 0);
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    status() {
      const pending = Object.values(state.keys).filter((m) => m.dirty).length;
      return { synced: !!state.code, code: state.code, lastSync: state.lastSync, lastError: state.lastError, offline: state.lastError === OFFLINE, pending };
    },
    statusText(now = Date.now()) {
      const s = api.status();
      if (!s.synced) return 'Not synced. Players and words stay on this device.';
      if (s.offline) return `Offline, will sync when back online${s.pending ? ` (${s.pending} change${s.pending === 1 ? '' : 's'} waiting)` : ''}`;
      if (s.lastError) return s.lastError;
      if (!s.lastSync) return `Synced as ${s.code} · syncing…`;
      return `Synced as ${s.code} · last sync ${agoText(now - s.lastSync)}`;
    },
    /** Push everything dirty, then pull. Resolves to true when the server answered. */
    syncNow() { return exclusive(syncCycle).catch((e) => { console.warn('[sync] sync failed', e); setError('Sync problem: ' + (e && e.message || 'unknown error')); return false; }); },
    pullNow() { return exclusive(async () => { if (!state.code) return false; const ok = await pull(); if (ok && Object.values(state.keys).some((m) => m.dirty)) await pushAll(); return ok; }).catch(() => false); },
    pushNow() { clearTimeout(pushTimer); return exclusive(pushAll).catch(() => false); },

    /** Create a family on the server from this device's data. Resolves { ok, code } or { ok: false, error }. */
    create() {
      return exclusive(async () => {
        if (state.code) return { ok: true, code: state.code };
        deviceId();
        const fam = familySyncData(loadFamily());
        const now = Date.now();
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = generateCode();
          const res = await request('POST', code, { rev: 1, updatedAt: now, deviceId: state.deviceId, data: fam });
          if (res.status === 409) continue;          // that code is taken: draw another
          if (res.status !== 201) {
            const error = res.offline ? 'Could not reach the sync server. Check the internet connection and try again.' : httpError(res, 'new family');
            return { ok: false, error };
          }
          state.code = code;
          state.keys = { family: { rev: 1, updatedAt: now, dirty: false, hash: hashOf(fam) } };
          for (const p of fam.players) {
            for (const k of [`${p.id}.save`, `${p.id}.words`]) {
              if (readLocal(k) != null) state.keys[k] = { rev: 0, updatedAt: now, dirty: true, hash: '' };
            }
          }
          state.lastError = '';
          persist();
          startTimers();
          await pushAll();
          state.lastSync = Date.now();
          persist();
          emit();
          return { ok: true, code };
        }
        return { ok: false, error: 'Could not find a free family code. Try again.' };
      });
    },

    /** Join an existing family: merge it into this device, push this device's own players. */
    join(text) {
      return exclusive(async () => {
        const code = normalizeCode(text);
        if (!code) return { ok: false, error: 'Type the 8-character family code, like K7QX-M2PA.' };
        const res = await request('GET', code);
        if (res.status === 404) return { ok: false, error: 'That code was not found' };
        if (res.status !== 200 || !res.body || !res.body.family) {
          return { ok: false, error: res.offline ? 'Could not reach the sync server. Check the internet connection and try again.' : httpError(res, 'family') };
        }
        deviceId();
        state.code = code;
        state.keys = {};
        state.lastError = '';
        const { family, players } = res.body;
        // the family: union of players, the family's PIN (this device adopts it)
        mergeIntoLocal('family', family, { preferRemotePin: true });
        const ids = familyIds();
        for (const [id, docs] of Object.entries(players || {})) {
          if (!ids.has(id) || !docs) continue;
          for (const kind of ['save', 'words']) {
            const doc = docs[kind], k = `${id}.${kind}`;
            if (!doc || !Number.isInteger(doc.rev) || !doc.data) continue;
            if (readLocal(k) != null) { meta(k).updatedAt = 0; mergeIntoLocal(k, doc); } else replaceLocal(k, doc);
          }
        }
        // players only this device had: upload them
        const now = Date.now();
        for (const id of ids) {
          for (const k of [`${id}.save`, `${id}.words`]) {
            if (!state.keys[k] && readLocal(k) != null) state.keys[k] = { rev: 0, updatedAt: now, dirty: true, hash: '' };
          }
        }
        persist();
        notifyApplied('family');
        for (const k of Object.keys(state.keys)) if (k !== 'family') notifyApplied(k);
        startTimers();
        await pushAll();
        state.lastSync = Date.now();
        persist();
        emit();
        return { ok: true, code, players: loadFamily().players.map((p) => ({ id: p.id, name: p.name, color: p.color })) };
      });
    },

    /** Stop syncing. Everything stays on this device; the family stays on the server for the other devices. */
    leave() {
      clearTimeout(pushTimer); clearInterval(pollTimer); clearTimeout(retryTimer);
      state = { v: 1, code: null, deviceId: state.deviceId, keys: {}, lastSync: 0, lastError: '' };
      persist();
      emit();
    },
  };
  return api;
}
