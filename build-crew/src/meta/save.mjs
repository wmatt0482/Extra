// Build Crew's per-builder save: one document per shared family profile, under buildCrew.<playerId>.save. Everything
// read from storage or sync passes through normalize(), which bounds every number and list, so a damaged or hostile
// document cannot break the game. Yard snapshots stay small; thumbnails stay on this device and never sync.
import { defaultStreak, defaultCosmetics, defaultCrates } from '../../../spell-jump/src/meta/engagement.js';
import { mergeStreak } from '../../../spell-jump/src/sync/merge.js';
import { TOYS, MACHINES } from '../content.mjs';
export const saveKey = (id) => `buildCrew.${id}.save`;
/** A fresh builder: no jobs done, stock look, no saved yard, and the shared streak/cosmetics/crates defaults. */
export const defaultSave = () => ({
  v: 1,
  done: [],
  rewards: [],
  play: {},
  yard: null,
  resetAt: 0,
  unlockAll: false,
  paint: 'stock',
  decal: 'none',
  horn: 'stock',
  streak: defaultStreak(),
  cosmetics: defaultCosmetics(),
  crates: defaultCrates(),
});
// Any non-finite or non-number value reads as 0; clamp() bounds after that.
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, n(v)));
/** A unit quaternion from saved data, or the identity when it is missing, non-finite or zero length. */
function quaternion(q) {
  if (!q || !['x', 'y', 'z', 'w'].every((k) => Number.isFinite(q[k]))) return { x: 0, y: 0, z: 0, w: 1 };
  const l = Math.hypot(q.x, q.y, q.z, q.w);
  return l > 1e-6 ? { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l } : { x: 0, y: 0, z: 0, w: 1 };
}
/** A bounded sandbox snapshot: at most 64 known toys, 3 machines and 12 terrain stamps, all inside the yard. */
export function normalizeYard(raw) {
  if (!raw || !Array.isArray(raw.toys)) return null;
  return {
    v: 1,
    daylight: clamp(raw.daylight ?? 0.7, 0, 1),
    toys: raw.toys
      .slice(0, 64)
      .filter((t) => TOYS[t.type])
      .map((t) => ({
        type: t.type,
        color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#e65e4b',
        x: clamp(t.x, -16, 16),
        y: clamp(t.y, -1, 15),
        z: clamp(t.z, -16, 16),
        rotation: quaternion(t.rotation),
      })),
    machines: (raw.machines || [])
      .slice(0, 3)
      .filter((m) => MACHINES[m.kind])
      .map((m) => ({
        kind: m.kind,
        x: clamp(m.x, -14, 14),
        z: clamp(m.z, -14, 14),
        yaw: clamp(m.yaw, -1000, 1000),
        swing: clamp(m.swing, -1000, 1000),
        lift: clamp(m.lift, ...MACHINES[m.kind].height),
        reach: clamp(m.reach, ...MACHINES[m.kind].reach),
        tilt: clamp(m.tilt, -0.7, 0.7),
      })),
    stamps: (raw.stamps || [])
      .slice(0, 12)
      .filter((s) => ['hill', 'pit', 'ramp', 'water'].includes(s.kind))
      .map((s) => ({ kind: s.kind, x: clamp(s.x, -14, 14), z: clamp(s.z, -14, 14) })),
  };
}
/** A complete, bounded save from anything. Unknown rewards, paints and decals are dropped; play history keeps the
 *  last 365 days. */
export function normalize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== 'object') return out;
  out.done = [
    ...new Set((Array.isArray(raw.done) ? raw.done : []).filter((v) => Number.isInteger(v) && v >= 1 && v <= 10)),
  ].sort((a, b) => a - b);
  const rewards = ['cream', 'excavator', 'leaf', 'star', 'crane', 'sky', 'bell', 'stripe', 'sunset', 'wrecking'];
  out.rewards = [...new Set((Array.isArray(raw.rewards) ? raw.rewards : []).filter((r) => rewards.includes(r)))];
  out.resetAt = Math.max(0, n(raw.resetAt));
  out.unlockAll = !!raw.unlockAll;
  out.yard = normalizeYard(raw.yard);
  for (const day of Object.keys(raw.play || {})
    .sort()
    .slice(-365))
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const p = raw.play[day];
      out.play[day] = { rounds: clamp(p?.rounds, 0, 10000), seconds: clamp(p?.seconds, 0, 86400) };
    }
  out.paint = ['stock', ...rewards].includes(raw.paint) ? raw.paint : 'stock';
  out.decal = ['none', 'star', 'stripe'].includes(raw.decal) ? raw.decal : 'none';
  out.horn = raw.horn === 'bell' ? 'bell' : 'stock';
  // Reuse shared streak merging to normalize its persisted schema and preserve earned cosmetics.
  if (raw.streak && Array.isArray(raw.streak.days)) {
    out.streak = {
      ...out.streak,
      ...raw.streak,
      days: raw.streak.days.slice(-120),
      shieldUsedDays: (raw.streak.shieldUsedDays || []).slice(-60),
    };
  }
  if (raw.cosmetics) out.cosmetics = { ...out.cosmetics, ...raw.cosmetics };
  if (raw.crates) out.crates = { ...out.crates, ...raw.crates };
  return out;
}
/** The sync merge (SPEC §7). A newer resetAt wins the whole document. Otherwise the later document wins (ties broken
 *  deterministically by comparing the JSON), completed jobs and rewards are unioned, streaks use the shared merge, and
 *  per-day counters take the maximum, so the merge is commutative. */
export function mergeBc(local, remote) {
  if (!local?.data) return normalize(remote?.data);
  if (!remote?.data) return normalize(local?.data);
  const a = normalize(local.data),
    b = normalize(remote.data);
  if (a.resetAt !== b.resetAt) return a.resetAt > b.resetAt ? a : b;
  const later =
    n(local.updatedAt) === n(remote.updatedAt)
      ? JSON.stringify(a) >= JSON.stringify(b)
        ? a
        : b
      : n(local.updatedAt) > n(remote.updatedAt)
        ? a
        : b;
  const out = normalize(later);
  out.done = [...new Set([...a.done, ...b.done])].sort((a, b) => a - b);
  out.rewards = [...new Set([...a.rewards, ...b.rewards])].sort();
  out.streak = mergeStreak(a.streak, b.streak);
  for (const day of new Set([...Object.keys(a.play), ...Object.keys(b.play)]))
    out.play[day] = {
      rounds: Math.max(a.play[day]?.rounds || 0, b.play[day]?.rounds || 0),
      seconds: Math.max(a.play[day]?.seconds || 0, b.play[day]?.seconds || 0),
    };
  return out;
}
/** Reads a builder's save. A corrupt document is backed up under .corrupt and replaced by a fresh save. */
export function loadSave(id) {
  try {
    const text = localStorage.getItem(saveKey(id));
    if (!text) return defaultSave();
    try {
      return normalize(JSON.parse(text));
    } catch {
      localStorage.setItem(saveKey(id) + '.corrupt', text);
      return defaultSave();
    }
  } catch {
    return defaultSave();
  }
}
