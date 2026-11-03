// The family board and the family goal (lab/SPEC.md §2.6), derived on the device from the family's mirrored lab docs. PURE.
// `players` = [{ id, name, color, lab }] in the picker's fixed order; lab is a normalized lab doc (or null for a child who has none yet).
// The board is never ranked: it names Most (the highest XP this week) and Most improved (a week beating one's own usual), nothing else.
import { addDays, weekOfDay } from '../../../spell-jump/src/meta/engagement.js';
import { hashString, mulberry32 } from '../../../spell-jump/src/meta/rng.js';
import { FAMILY_BANNERS, FAMILY_GOALS, GOAL_CLAIM_WINDOW, GOAL_COINS_AFTER_ALL } from '../data/goals.js';
import { GAMES, WEEK_FIELDS, creditEarned, mondayOfWeek, owns, weekShift } from './model.js';
import { playedDays } from './quests.js';
import { grant } from './shop.js';

export { FAMILY_GOALS };
export const MOST_MIN_XP = 100;
export const USUAL_FLOOR = 300;
export const IMPROVED_MIN_GAIN = 0.25;

const ZERO = () => ({ xp: 0, coins: 0, zap: 0, race: 0, word: 0, ft: 0, leg: 0, job: 0, g: [] });
/** One child's numbers for an ISO week: the sum over their device keys of weeks[wk][device]; g = the games played, merged. */
export function weekNumbers(lab, wk) {
  const out = ZERO();
  const w = lab && lab.weeks && lab.weeks[wk];
  if (!w) return out;
  const g = new Set();
  for (const dk of Object.keys(w)) {
    for (const f of WEEK_FIELDS) out[f] += w[dk][f] || 0;
    for (const x of w[dk].g || []) g.add(x);
  }
  out.g = GAMES.filter((x) => g.has(x));
  return out;
}

/** The Lab board for a week: rows in the input order with xp, crown (Most), improved (Most improved), gain. */
export function boardFor(players, wk, now) {
  const rows = players.map((p) => {
    const xp = weekNumbers(p.lab, wk).xp;
    const prev = [1, 2, 3].map((i) => weekNumbers(p.lab, weekShift(wk, -i)).xp).filter((x) => x > 0);
    const usual = prev.length ? Math.max(USUAL_FLOOR, Math.round(prev.reduce((a, b) => a + b, 0) / prev.length)) : USUAL_FLOOR;
    const gain = (xp - usual) / usual;
    return { id: p.id, name: p.name, color: p.color, xp, usual, gain: Math.round(gain * 100) / 100, gainPct: Math.round(gain * 100), crown: false, improved: false };
  });
  const top = Math.max(0, ...rows.map((r) => r.xp));
  let mostId = '';
  if (top >= MOST_MIN_XP) for (const r of rows) if (r.xp === top) { r.crown = true; if (!mostId) mostId = r.id; }
  let improvedId = '';
  const best = rows.filter((r) => r.xp >= MOST_MIN_XP && r.gain >= IMPROVED_MIN_GAIN).sort((a, b) => b.gain - a.gain || rows.indexOf(a) - rows.indexOf(b))[0];
  if (best) { best.improved = true; improvedId = best.id; }
  return { rows, mostId, improvedId, week: wk };
}

// ---------- the goal ----------
const lastDayOfWeek = (wk) => addDays(mondayOfWeek(wk), 6);
function activity(players, day, games) {          // total play-days in the last 14 days, over these games, over all players
  let n = 0;
  for (const p of players) { const d = playedDays(p.lab || { play: {} }, day); for (const g of games) n += d[g] || 0; }
  return n;
}
const contributors = (goal, players, day) => (goal.contrib === 'all' ? players.length
  : Math.max(1, players.filter((p) => { const d = playedDays(p.lab || { play: {} }, day); return goal.games.reduce((a, g) => a + (d[g] || 0), 0) >= 2; }).length));
const goalById = (id) => FAMILY_GOALS.find((g) => g.id === id) || null;
function eligible(goal, players, day) {
  if (goal.minPlayers && players.length < goal.minPlayers) return false;
  return !goal.games || activity(players, day, goal.games) > 0;
}
/** The goal's target for these players: perPlayer x contributors, rounded to the goal's step (never below one step); "explore" is exact. */
export function goalTarget(goal, players, day) {
  const c = contributors(goal, players, day);
  const raw = goal.perPlayer * c;
  return Math.max(goal.step, Math.round(raw / goal.step) * goal.step);
}
/** The week's goal id: a seeded draw over the goals this family can play, weighted by their game activity in the 14 days up to `day`. */
export function pickGoal(players, wk, day = mondayOfWeek(wk)) {
  const ids = players.map((p) => p.id).sort().join(',');
  const rng = mulberry32(hashString(`${ids}|${wk}`));
  const total = activity(players, day, GAMES);
  const options = FAMILY_GOALS.filter((g) => eligible(g, players, day)).map((g) => ({
    g, w: g.games ? 1 + activity(players, day, g.games) : g.id === 'explore' ? 2 : 2 + total / 5,
  }));
  let r = rng() * options.reduce((a, o) => a + o.w, 0);
  for (const o of options) { r -= o.w; if (r < 0) return o.g.id; }
  return options.length ? options[options.length - 1].g.id : 'ft';
}

// the pick recorded in the docs: the earliest `at` among everyone's picks[wk] wins, so every device shows the same goal
function recordedPick(players, wk) {
  let best = null;
  for (const p of players) {
    const row = p.lab && p.lab.picks && p.lab.picks[wk];
    if (row && goalById(row[0]) && (!best || row[1] < best[1] || (row[1] === best[1] && row[0] < best[0]))) best = row;
  }
  return best;
}
/** The family goal for an ISO week: { id, text, target, progress, met, perPlayer, wk, recorded }. Reads the recorded pick; draws one when nothing is recorded yet. */
export function goalFor(players, wk, { day, gentle = false } = {}) {
  const at = day || lastDayOfWeek(wk);
  const rec = recordedPick(players, wk);
  const id = rec ? rec[0] : pickGoal(players, wk, day || undefined);
  const goal = goalById(id) || goalById('ft');
  const target = rec && rec[2] > 0 ? rec[2] : goalTarget(goal, players, at);
  const nums = players.map((p) => weekNumbers(p.lab, wk));
  const progress = goal.id === 'explore' ? nums.reduce((a, n) => a + Math.min(3, n.g.length), 0) : nums.reduce((a, n) => a + (n[goal.field] || 0), 0);
  const nText = goal.id === 'explore' ? goal.perPlayer : target;
  return { id: goal.id, text: (gentle ? goal.gentle : goal.text).replace('{n}', String(nText)), target, progress: Math.min(progress, 1e9), met: target > 0 && progress >= target, perPlayer: goal.perPlayer, wk, recorded: !!rec };
}
/** Record this week's pick in the child's own doc (once; the earliest pick in the family stands). Returns the pick row. */
export function ensureGoalPick(lab, ctx, players) {
  const wk = weekOfDay(ctx.day);
  const rec = recordedPick(players, wk);
  if (rec) { if (!lab.picks[wk]) lab.picks[wk] = rec.slice(); lab.fam = { week: wk, goal: rec[0], at: rec[1] }; return rec; }
  const id = pickGoal(players, wk, ctx.day);
  const row = [id, Math.max(1, Math.floor(ctx.now) || 1), goalTarget(goalById(id), players, ctx.day)];
  lab.picks[wk] = row;
  lab.fam = { week: wk, goal: id, at: row[1] };
  return row;
}

/** Claim a met goal (this week's or one of the three before): the next family banner, or 600 coins once all six are owned. { ok, item, coins, reason }. */
export function claimGoal(lab, ctx, wk, players) {
  if (lab.opts.goal === false) return { ok: false, item: null, coins: 0, reason: 'off' };
  const cur = weekOfDay(ctx.day);
  if (wk > cur || wk < weekShift(cur, -(GOAL_CLAIM_WINDOW - 1))) return { ok: false, item: null, coins: 0, reason: 'window' };
  const key = `fam:${wk}`;
  if (lab.claimed[key] !== undefined) return { ok: false, item: null, coins: 0, reason: 'claimed' };
  if (!goalFor(players, wk, { day: ctx.day }).met) return { ok: false, item: null, coins: 0, reason: 'unmet' };
  lab.claimed[key] = Math.max(1, Math.floor(ctx.now) || 1);
  const banner = FAMILY_BANNERS.find((id) => !owns(lab, id));
  if (banner) { grant(lab, ctx, banner, 'goal'); return { ok: true, item: banner, coins: 0, reason: '' }; }
  creditEarned(lab, ctx, { coins: GOAL_COINS_AFTER_ALL });
  return { ok: true, item: null, coins: GOAL_COINS_AFTER_ALL, reason: '' };
}

/** Last week's crowns become stickers in the winner's own doc. Returns the crowns added ('2026-W44:most' | ':improved'). */
export function settleCrowns(lab, ctx, players, id) {
  const prev = weekShift(weekOfDay(ctx.day), -1);
  const b = boardFor(players, prev, ctx.now);
  const mine = b.rows.find((r) => r.id === id);
  const add = [];
  if (mine && mine.crown) add.push(`${prev}:most`);
  if (mine && mine.improved) add.push(`${prev}:improved`);
  const fresh = add.filter((c) => !lab.crowns.includes(c));
  if (fresh.length) lab.crowns = [...lab.crowns, ...fresh].sort().slice(-12);
  return fresh;
}
