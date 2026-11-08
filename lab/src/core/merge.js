// The merge rules of the `lab` doc (lab/SPEC.md §2.8). PURE. Every rule is a union, a max, a min or a later-`at`, so mergeLabData is
// commutative, associative and idempotent, and a doc from an older build (without a field) never erases it. The one non-lattice step is the
// forgiveness after a sync merge (mergeLab): a purchase made on two offline devices can overspend the wallet; the local device's counter is
// raised so the wallet reads exactly 0 (never charged back).
import { weekOfDay } from '../../../spell-jump/src/meta/engagement.js';
import { mergeStreak } from '../../../spell-jump/src/sync/merge.js';
import { laterSummary } from './summary.js';
import { GAMES, WEEK_FIELDS, deviceKeyOk, normalizeLab, wallet } from './model.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const str = (x) => JSON.stringify(x);
const maxOf = (a, b) => (a > b ? a : b);
const keys = (...os) => [...new Set(os.flatMap((o) => Object.keys(o || {})))].sort();
const jsonLater = (a, b) => (str(a) >= str(b) ? a : b);
const jsonEarlier = (a, b) => (str(a) <= str(b) ? a : b);
// the later of two {at}-stamped values; a tie goes to the larger JSON so both devices pick the same one
const laterAt = (a, ta, b, tb) => (ta !== tb ? (ta > tb ? a : b) : jsonLater(a, b));
const minPos = (a, b) => (a > 0 && b > 0 ? Math.min(a, b) : a > 0 ? a : b > 0 ? b : 0);

function mergeQuestDay(a, b) {
  if (!a) return clone(b);
  if (!b) return clone(a);
  const key = (q) => [q.drawnAt, -q.rr, str({ i: q.ids, t: q.tier })];
  const less = (x, y) => { const kx = key(x), ky = key(y); for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return kx[i] < ky[i]; return false; };
  const base = less(b, a) ? b : a;
  const p = {}, done = {};
  for (const k of keys(a.p, b.p)) p[k] = Math.max(a.p[k] || 0, b.p[k] || 0);
  for (const k of keys(a.done, b.done)) done[k] = minPos(a.done[k] || 0, b.done[k] || 0) || 1;
  return { ids: base.ids.slice(), drawnAt: base.drawnAt, rr: base.rr, tier: base.tier, p, done };
}

/** The pure join of two lab docs (both normalized first). A reset (the larger resetAt) wins whole. */
export function mergeLabData(rawA, rawB) {
  const a = normalizeLab(rawA, 0), b = normalizeLab(rawB, 0);
  if (a.resetAt !== b.resetAt) return clone(a.resetAt > b.resetAt ? a : b);
  const o = {};
  o.v = Math.max(a.v, b.v);
  o.resetAt = a.resetAt;
  o.dev = {};
  for (const k of keys(a.dev, b.dev)) o.dev[k] = { c: Math.max((a.dev[k] || {}).c || 0, (b.dev[k] || {}).c || 0), x: Math.max((a.dev[k] || {}).x || 0, (b.dev[k] || {}).x || 0) };
  o.paid = {}; for (const k of keys(a.paid, b.paid)) o.paid[k] = Math.max(a.paid[k] || 0, b.paid[k] || 0);
  o.owned = {}; for (const k of keys(a.owned, b.owned)) o.owned[k] = minPos(a.owned[k] || 0, b.owned[k] || 0) || 1;
  o.equipped = {};
  for (const k of keys(a.equipped, b.equipped)) {
    const x = a.equipped[k], y = b.equipped[k];
    o.equipped[k] = !x ? y.slice() : !y ? x.slice() : laterAt(x, x[1], y, y[1]).slice();
  }
  o.pet = clone(laterAt(a.pet, a.pet.at, b.pet, b.pet.at));
  o.streak = mergeStreak(a.streak, b.streak);
  // the shield-week stamp is informational (freezeView reads the used days); derive it from the merged state so it never depends on which side "won"
  { const st = o.streak, wk = st.lastDay ? weekOfDay(st.lastDay) : '';
    st.shieldAvailableWeek = wk && !st.shieldUsedDays.some((d) => weekOfDay(d) === wk) ? wk : ''; }
  o.quests = {}; for (const d of keys(a.quests, b.quests)) o.quests[d] = mergeQuestDay(a.quests[d], b.quests[d]);
  o.crates = { earned: {}, opened: {} };
  for (const k of keys(a.crates.earned, b.crates.earned)) o.crates.earned[k] = minPos(a.crates.earned[k] || 0, b.crates.earned[k] || 0) || 1;
  for (const k of keys(a.crates.opened, b.crates.opened)) {
    const x = a.crates.opened[k], y = b.crates.opened[k];
    o.crates.opened[k] = clone(!x ? y : !y ? x : x.at !== y.at ? (x.at < y.at ? x : y) : jsonEarlier(x, y));
  }
  o.play = {};
  for (const d of keys(a.play, b.play)) { o.play[d] = {}; for (const g of GAMES) o.play[d][g] = Math.max((a.play[d] || {})[g] || 0, (b.play[d] || {})[g] || 0); }
  o.weeks = {};
  for (const w of keys(a.weeks, b.weeks)) {
    o.weeks[w] = {};
    for (const dk of keys((a.weeks[w] || {}), (b.weeks[w] || {}))) {
      const x = (a.weeks[w] || {})[dk] || {}, y = (b.weeks[w] || {})[dk] || {}, r = {};
      for (const f of WEEK_FIELDS) r[f] = Math.max(x[f] || 0, y[f] || 0);
      r.g = [...new Set([...(x.g || []), ...(y.g || [])])].sort();
      o.weeks[w][dk] = r;
    }
  }
  const fa = a.fam, fb = b.fam;
  o.fam = clone(fa.week !== fb.week ? (fa.week > fb.week ? fa : fb) : fa.at !== fb.at ? (fa.at && (!fb.at || fa.at < fb.at) ? fa : fb) : jsonEarlier(fa, fb));
  o.picks = {};
  for (const w of keys(a.picks, b.picks)) {
    const x = a.picks[w], y = b.picks[w];
    o.picks[w] = (!x ? y : !y ? x : x[1] !== y[1] ? (x[1] < y[1] ? x : y) : jsonEarlier(x, y)).slice();
  }
  o.claimed = {}; for (const k of keys(a.claimed, b.claimed)) o.claimed[k] = minPos(a.claimed[k] || 0, b.claimed[k] || 0) || 1;
  o.crowns = [...new Set([...a.crowns, ...b.crowns])];
  o.trophies = [...a.trophies, ...b.trophies];
  o.gallery = [...a.gallery, ...b.gallery];
  o.best = Object.fromEntries(GAMES.map((g) => [g, Math.max(a.best[g], b.best[g])]));
  o.opts = clone(laterAt(a.opts, a.opts.at, b.opts, b.opts.at));
  o.seen = { games: {}, welcome: minPos(a.seen.welcome, b.seen.welcome) };
  for (const g of keys(a.seen.games, b.seen.games)) o.seen.games[g] = minPos(a.seen.games[g] || 0, b.seen.games[g] || 0);
  o.sum = {}; for (const g of keys(a.sum, b.sum)) o.sum[g] = clone(laterSummary(a.sum[g], b.sum[g]));
  const ca = a.coinDay, cb = b.coinDay;
  if (ca.day === cb.day) { o.coinDay = { day: ca.day, n: Math.max(ca.n, cb.n), ev: {} }; for (const k of keys(ca.ev, cb.ev)) o.coinDay.ev[k] = Math.max(ca.ev[k] || 0, cb.ev[k] || 0); }
  else o.coinDay = clone(ca.day > cb.day ? ca : cb);
  return normalizeLab(o, 0);
}

/** If everything bought is more than everything earned (two offline devices spent the same coins), raise this device's counter so the wallet is 0. Returns the coins forgiven. */
export function forgive(lab, device) {
  const w = wallet(lab);
  const deficit = w.paid - w.earned;
  if (deficit <= 0) return 0;
  const k = deviceKeyOk(device) ? device : '_';
  if (!lab.dev[k]) lab.dev[k] = { c: 0, x: 0 };
  lab.dev[k].c += deficit;
  return deficit;
}

let LOCAL_DEVICE = '_';
/** The sync registry does not pass the device key: the store tells this module which device it is. */
export function setLocalDevice(key) { LOCAL_DEVICE = deviceKeyOk(key) ? key : '_'; }
export const localDevice = () => LOCAL_DEVICE;

/** The sync registry's merge: local / remote = { updatedAt, data }. Returns the merged data (the join, then forgiveness for this device). */
export function mergeLab(local, remote, opts = {}) {
  const has = (x) => !!x && !!x.data && typeof x.data === 'object';
  if (!has(local) && !has(remote)) return normalizeLab(null, 0);
  const merged = !has(local) ? normalizeLab(remote.data, 0) : !has(remote) ? normalizeLab(local.data, 0) : mergeLabData(local.data, remote.data);
  forgive(merged, opts.device || LOCAL_DEVICE);
  return normalizeLab(merged, 0);
}
