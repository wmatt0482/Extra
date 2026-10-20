// The Season's loops (SPEC v1.5 §3, §5, §6): stars, the streak, the daily Pit Challenge, championship weekends and the
// per-day play log. Pure functions over the save (dates come in as `now`); the caller persists.
//   STARS: 3 per trail: ★ finish 1st · ★ every gate right (first try) · ★ the trail's stunt ("2 flips", "5 s of air",
//     "no crashes", "beat the gold time"). All three on a trail is a star set: a gold crate.
//   STREAK: Spell Jump's streak with the weekly shield (engagement.js by import, a day counts on the first finished
//     race); milestones 3 / 7 / 14 / 30 pay crates (src/data/cosmetics.js STREAK_REWARDS), 14 the Streak paint, 30 the
//     Lightning helmet. Missing days never take anything away (a shield covers one a week; then it simply restarts).
//   DAILY: one trail + one mutator a day, seeded by the date; double cash and a bronze crate once a day.
//   WEEKEND: 3 races in a row on the cup's unlocked trails; points [10, 6, 3, 1]; a trophy for the top 3.
import { completeDay, defaultCosmetics as sjCosmetics, refreshStreak, streakNow } from '../../../spell-jump/src/meta/engagement.js';
import { dayKey } from '../facts/scheduler.js';
import { STREAK_REWARDS } from '../data/cosmetics.js';
import { CUP_BY_ID, POINTS, WEEKEND_RACES, pointsFor, trailsOfCup, trophyFor, weekendBonus } from '../data/cups.js';
import { earnCrate } from './crates.js';
import { hashString, isUnlocked } from './economy.js';

// ---------- stars ----------
export const STUNTS = [
  { id: 'flips2', text: '2 flips', ok: (s) => (s.flips || 0) >= 2 },
  { id: 'air5', text: '5 s of air', ok: (s) => (s.airTime || 0) >= 5 },
  { id: 'nocrash', text: 'No crashes', ok: (s) => !s.crashes },
  { id: 'gold', text: 'Beat the gold time', ok: (s, t) => !!(t && t.gold && s.timeSec > 0 && s.timeSec <= t.gold) },
];
/** The trail's stunt star: its own `stunt` id, else by position on the ladder. */
export function stuntOf(trail, trails = []) {
  const own = STUNTS.find((x) => trail && x.id === trail.stunt);
  if (own) return own;
  const i = Math.max(0, trails.findIndex((t) => t.id === (trail && trail.id)));
  return STUNTS[i % STUNTS.length];
}
export const starLabels = (trail, trails) => ['Finish 1st', 'Every gate right', stuntOf(trail, trails).text];
/**
 * A finished race: which stars it earns now. gates: { asked, right } (first-try right answers). Returns { got: [3
 * bools, the earned ones], fresh: [indices new], set: bool (all 3 now, newly) }; saves the stars and the set crate.
 */
export function awardStars(save, trail, trails, summary = {}, gates = { asked: 0, right: 0 }, medalTimes = null) {
  const had = (save.stars[trail.id] || [false, false, false]).slice();
  const finished = !!summary.finishCrossed;
  const got = [
    finished && Number(summary.place) === 1,
    finished && gates.asked > 0 && gates.right === gates.asked,
    finished && stuntOf(trail, trails).ok(summary, medalTimes),
  ];
  const now = had.map((h, i) => h || got[i]);
  const fresh = [0, 1, 2].filter((i) => !had[i] && now[i]);
  save.stars[trail.id] = now;
  const set = fresh.length > 0 && now.every(Boolean);
  if (set) earnCrate(save, 'gold');
  return { got, fresh, set, stars: now };
}

// ---------- streak (Spell Jump's, by import) ----------
const shim = (save) => ({ streak: save.streak, crates: { earned: 0 }, cosmetics: sjCosmetics(), xp: 0 });
export const streakDays = (save, now = Date.now()) => streakNow(save.streak, now);
export function openStreak(save, now = Date.now()) { return refreshStreak(shim(save), now); }
/** The first finished race of a day counts it; a milestone pays its rewards. Returns { counted, count, milestone, rewards }. */
export function raceDayDone(save, now = Date.now()) {
  const out = completeDay(shim(save), now);
  const rewards = [];
  if (out.counted && out.milestone && STREAK_REWARDS[out.milestone]) {
    const r = STREAK_REWARDS[out.milestone];
    if (r.crate) { earnCrate(save, r.crate); rewards.push({ crate: r.crate }); }
    if (r.paint && !save.cosmetics.owned.paint.includes(r.paint)) { save.cosmetics.owned.paint.push(r.paint); rewards.push({ kind: 'paint', id: r.paint }); }
    if (r.helmet && !save.cosmetics.owned.helmet.includes(r.helmet)) { save.cosmetics.owned.helmet.push(r.helmet); rewards.push({ kind: 'helmet', id: r.helmet }); }
  }
  return { ...out, rewards };
}

// ---------- the daily Pit Challenge ----------
/** Today's challenge: an unlocked trail and a mutator, seeded by the date (the same for the whole day). */
export function dailyFor(save, trails, mutators, now = Date.now()) {
  const day = dayKey(now);
  if (save.daily.day === day && save.daily.trailId && trails.some((t) => t.id === save.daily.trailId)) return save.daily;
  const open = trails.filter((t) => isUnlocked(save, trails, t.id));
  const list = (mutators || []).filter((m) => m && m.id);
  const h = hashString('daily:' + day);
  const trail = open.length ? open[h % open.length] : trails[0];
  const mut = list.length ? list[(h >>> 8) % list.length] : null;
  save.daily = { day, trailId: trail ? trail.id : null, mutator: mut ? mut.id : null, done: false };
  return save.daily;
}
/** The daily race was finished: double cash was paid by the coinMult; this pays the bronze crate once. */
export function dailyDone(save, now = Date.now()) {
  if (save.daily.done || save.daily.day !== dayKey(now)) return false;
  save.daily.done = true;
  earnCrate(save, 'bronze');
  return true;
}

// ---------- championship weekends ----------
/** Start a weekend in a cup: the player's pick order of its unlocked trails (3; repeats when fewer are open). */
export function startWeekend(save, cupId, trails, pick = null) {
  const open = trailsOfCup(cupId, trails).filter((t) => isUnlocked(save, trails, t.id)).map((t) => t.id);
  if (!open.length) return null;
  const order = (pick && pick.length ? pick : open).filter((id) => open.includes(id));
  const list = Array.from({ length: WEEKEND_RACES }, (_, i) => order[i % order.length]);
  save.weekend = { cup: cupId, trails: list, results: [], points: {}, trio: null };
  return save.weekend;
}
/** A weekend race ended: add its points. standings: [{ name, place, me }]. Returns the standings table. */
export function weekendRace(save, trailId, standings) {
  const w = save.weekend;
  if (!w) return null;
  const rows = standings.map((x) => ({ name: x.name, place: x.place, points: pointsFor(x.place), me: !!x.me }));
  w.results.push({ trailId, standings: rows });
  for (const r of rows) w.points[r.name] = (w.points[r.name] || 0) + r.points;
  return weekendTable(save);
}
/** The standings now: [{ name, points, me }] best first (ties: the player first). */
export function weekendTable(save) {
  const w = save.weekend;
  if (!w) return [];
  const me = new Set();
  for (const r of w.results) for (const x of r.standings) if (x.me) me.add(x.name);
  return Object.entries(w.points).map(([name, points]) => ({ name, points, me: me.has(name) })).sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
}
export const weekendDone = (save) => !!(save.weekend && save.weekend.results.length >= save.weekend.trails.length);
export const weekendNext = (save) => (save.weekend && !weekendDone(save) ? save.weekend.trails[save.weekend.results.length] : null);
/** Close a finished weekend: the trophy for the player's place (top 3), the bonus cash, a gold crate for a trophy. */
export function finishWeekend(save) {
  const w = save.weekend;
  if (!w || !weekendDone(save)) return null;
  const table = weekendTable(save);
  const place = table.findIndex((x) => x.me) + 1;
  const trophy = trophyFor(place);
  const prev = save.cups[w.cup] || { best: 0, trophy: null, weekends: 0 };
  const rank = { gold: 3, silver: 2, bronze: 1 };
  const mine = table.find((x) => x.me);
  save.cups[w.cup] = { best: Math.max(prev.best, mine ? mine.points : 0), trophy: (rank[trophy] || 0) > (rank[prev.trophy] || 0) ? trophy : prev.trophy, weekends: prev.weekends + 1 };
  const bonus = trophy ? weekendBonus(w.cup, trophy) : 0;
  if (bonus) { save.cash += bonus; save.records.lifetimeCash += bonus; }
  if (trophy) earnCrate(save, 'gold');
  const out = { cup: w.cup, cupName: CUP_BY_ID[w.cup].name, place, trophy, newTrophy: !!trophy && trophy !== prev.trophy && (rank[trophy] || 0) > (rank[prev.trophy] || 0), bonus, table };
  save.weekend = null;
  return out;
}
export { POINTS };

// ---------- the play log (Parent Zone → Report: "Play: 6 races · 2 stars · 1 crate · streak 4 days") ----------
export function playLines(save) {
  return Object.keys(save.play || {}).sort().reverse().slice(0, 7).map((day) => {
    const p = save.play[day];
    const n = (k, one, many) => `${p[k] || 0} ${(p[k] || 0) === 1 ? one : many}`;
    return { day, text: `Play: ${n('races', 'race', 'races')} · ${n('stars', 'star', 'stars')} · ${n('crates', 'crate', 'crates')}${p.streak ? ` · streak ${p.streak} day${p.streak === 1 ? '' : 's'}` : ''}` };
  });
}
export function notePlay(save, now = Date.now(), { races = 0, stars = 0, crates = 0, streak = 0 } = {}) {
  const k = dayKey(now);
  const p = save.play[k] || (save.play[k] = { races: 0, stars: 0, crates: 0 });
  p.races += races; p.stars += stars; p.crates += crates;
  if (streak) p.streak = Math.max(p.streak || 0, streak);
  const keys = Object.keys(save.play).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 14))) delete save.play[old];
  return p;
}
