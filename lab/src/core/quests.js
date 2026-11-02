// Daily quests (lab/SPEC.md §2.4): the draw (weighted by recent play, one nudge toward a game the child has not touched lately), progress,
// rewards, the once-a-day swap, and the view. PURE: dates come in as ctx.now / ctx.day, every roll is seeded by hashString(playerId|day).
import { addDays, dayDiff } from '../../../spell-jump/src/meta/engagement.js';
import { hashString, mulberry32 } from '../../../spell-jump/src/meta/rng.js';
import { ALL_DONE_REWARD, NUDGE_REWARD, QUESTS, QUEST_REWARD } from '../data/quests.js';
import { GAMES, creditEarned, totalXp } from './model.js';
import { levelFor } from './xp.js';
import { earnLabBonusFreeze } from './streak.js';

export { QUESTS };
export const QUEST_BY_ID = Object.freeze(Object.fromEntries(QUESTS.map((q) => [q.id, q])));
const FIXED_ORDER = ['sj', 'tb', 'ww', 'ff', 'bc'];
const NUDGE_SLOT = 2;
const SESSION_HOLD_MS = 3 * 3600000;       // a session that rolls past midnight keeps the day's quests this long after its last event

/** easy below Lab level 5, mid below 20, hard from 20. */
export const tierFor = (level) => (level < 5 ? 'easy' : level < 20 ? 'mid' : 'hard');
export const targetFor = (id, tier, index) => { const q = QUEST_BY_ID[id]; return q ? q[index === NUDGE_SLOT ? 'easy' : tier] : 0; };
/** The quest text for a template (or { id, target }): `{n}` filled in; gentle mode uses the gentle wording where there is one. */
export function questText(q, gentle = false, n) {
  const t = QUEST_BY_ID[q && q.id] || q;
  if (!t || !t.text) return '';
  const count = n != null ? n : q.target != null ? q.target : q.n != null ? q.n : t.easy;
  const base = count === 1 && t.one ? t.one : gentle && t.gentle ? t.gentle : t.text;
  return base.replace('{n}', String(count));
}

/** { sj: n, tb: n, … }: on how many of the last `span` days (ending at `day`) each game had any event. */
export function playedDays(lab, day, span = 14) {
  const out = Object.fromEntries(GAMES.map((g) => [g, 0]));
  for (let i = 0; i < span; i++) {
    const p = lab.play[addDays(day, -i)];
    if (p) for (const g of GAMES) if (p[g] > 0) out[g] += 1;
  }
  return out;
}

const pickOne = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
// weighted by recent play, squared: a habit game outweighs a one-off visit (a nudge visit does not turn into a "home" game), while a new child's days of 1 weigh the same
function pickWeighted(rng, games, days) {
  const w = (g) => Math.max(0, days[g]) ** 2;
  const total = games.reduce((a, g) => a + w(g), 0);
  if (total <= 0) return pickOne(rng, games);
  let r = rng() * total;
  for (const g of games) { r -= w(g); if (r < 0) return g; }
  return games[games.length - 1];
}
const homeTemplates = (g, exclude) => QUESTS.filter((q) => q.game === g && !q.nudgeOnly && !exclude.includes(q.id));
const nudgeTemplates = (g, exclude) => QUESTS.filter((q) => q.game === g && q.nudge && !q.nudgeOnly && !exclude.includes(q.id));

// the nudge: the least-played game that is not already a home game, its nudge-eligible template (any-explore when at most one game is played)
function drawNudge(rng, days, homeGames, exclude) {
  const played = GAMES.filter((g) => days[g] > 0);
  if (played.length <= 1 && !exclude.includes('any-explore')) return 'any-explore';
  const cands = GAMES.filter((g) => !homeGames.includes(g) && nudgeTemplates(g, exclude).length);
  if (!cands.length) return null;
  const low = Math.min(...cands.map((g) => days[g]));
  const g = pickOne(rng, cands.filter((x) => days[x] === low));
  return pickOne(rng, nudgeTemplates(g, exclude)).id;
}

/** The three quest ids for ctx.day: two in games the child plays (weighted by how often), one nudge. Deterministic per (player, day). */
export function drawQuests(lab, ctx) {
  const rng = mulberry32(hashString(`${ctx.playerId}|${ctx.day}`));
  const days = playedDays(lab, ctx.day);
  // a child with no play history yet: the game they opened counts as played (so their first quests include it)
  if (GAMES.every((g) => days[g] === 0) && GAMES.includes(ctx.game)) days[ctx.game] = 1;
  const played = GAMES.filter((g) => days[g] > 0);
  const home = [];
  let pool = played.slice();
  while (home.length < 2 && pool.length) { const g = pickWeighted(rng, pool, days); home.push(g); pool = pool.filter((x) => x !== g); }
  if (home.length < 2) {
    const rot = Math.floor(rng() * FIXED_ORDER.length) % FIXED_ORDER.length;
    for (let i = 0; i < FIXED_ORDER.length && home.length < 2; i++) { const g = FIXED_ORDER[(i + rot) % FIXED_ORDER.length]; if (!home.includes(g)) home.push(g); }
  }
  const ids = [];
  for (const g of home) ids.push(pickOne(rng, homeTemplates(g, ids)).id);
  ids.push(drawNudge(rng, days, home, ids));
  return ids.filter(Boolean);
}

/** Which day's quests this session is working on: today's, or yesterday's while a session that began before midnight is still finishing them. */
export function questDayFor(lab, ctx) {
  const s = ctx.session;
  if (s && s.questDay && s.questDay !== ctx.day && s.lastAt && ctx.now - s.lastAt < SESSION_HOLD_MS) {
    const q = lab.quests[s.questDay];
    if (q && dayDiff(s.questDay, ctx.day) === 1 && q.ids.some((id) => !q.done[id])) return s.questDay;
  }
  return ctx.day;
}

/** Draw today's three once and store them (quests[day]); returns the day's record, or null when the Parent Zone switch is off. */
export function ensureToday(lab, ctx) {
  if (lab.opts.quests === false) return null;
  const day = questDayFor(lab, ctx);
  if (ctx.session) { ctx.session.questDay = day; ctx.session.lastAt = ctx.now; }
  let q = lab.quests[day];
  if (!q) {
    const ids = drawQuests(lab, { ...ctx, day });
    q = lab.quests[day] = { ids, drawnAt: Math.max(1, Math.floor(ctx.now) || 1), rr: 0, tier: tierFor(levelFor(totalXp(lab))), p: {}, done: {} };
    for (const d of Object.keys(lab.quests).sort().slice(0, Math.max(0, Object.keys(lab.quests).length - 14))) delete lab.quests[d];
  }
  return q;
}

const rewardOf = (index) => (index === NUDGE_SLOT ? NUDGE_REWARD : QUEST_REWARD);
const stampOf = (ctx) => Math.max(1, Math.floor(ctx.now) || 1);

/** An event happened: move the matching quests and pay the ones that just finished. Returns a row per quest it touched:
 *  { id, progress, target, justDone, coins, xp }; the row that finished the third quest also has allDone: true, bonusCoins, bonusXp, crateKey, bonusFreeze. */
export function questEvent(lab, ctx, game, event, { n = 1, firstTry = null } = {}) {
  const q = ensureToday(lab, ctx);
  if (!q) return [];
  const rows = [];
  const step = Math.max(1, Math.floor(n) || 1);
  q.ids.forEach((id, index) => {
    const t = QUEST_BY_ID[id];
    if (!t || q.done[id]) return;
    let progress;
    const target = targetFor(id, q.tier, index);
    if (t.explore) {
      const today = lab.play[ctx.day] || {};
      progress = Math.min(target, GAMES.filter((g) => today[g] > 0).length);
      if (progress === (q.p[id] || 0)) return;
    } else {
      if ((t.game !== game && t.game !== 'any') || !t.events.includes(event) || (t.firstTry && firstTry !== true)) return;
      progress = Math.min(target, (q.p[id] || 0) + step);
    }
    q.p[id] = progress;
    const row = { id, progress, target, justDone: false, coins: 0, xp: 0 };
    if (progress >= target) {
      q.done[id] = stampOf(ctx);
      const r = rewardOf(index);
      Object.assign(row, { justDone: true, coins: r.coins, xp: r.xp });
      creditEarned(lab, ctx, r);
    }
    rows.push(row);
  });
  const finished = rows.filter((r) => r.justDone);
  if (finished.length && q.ids.length === 3 && q.ids.every((id) => q.done[id])) {
    const day = ctx.session && ctx.session.questDay ? ctx.session.questDay : ctx.day;
    const key = `quest:${day}`;
    const last = finished[finished.length - 1];
    creditEarned(lab, ctx, ALL_DONE_REWARD);
    Object.assign(last, { allDone: true, bonusCoins: ALL_DONE_REWARD.coins, bonusXp: ALL_DONE_REWARD.xp, crateKey: key, bonusFreeze: earnLabBonusFreeze(lab, ctx.now) });
  }
  return rows;
}

/** Swap one unfinished quest for another, once a day. { ok, reason: ''|'off'|'none'|'used'|'done'|'bad' }. */
export function rerollQuest(lab, ctx, index) {
  if (lab.opts.quests === false) return { ok: false, reason: 'off' };
  const day = questDayFor(lab, ctx);
  const q = lab.quests[day];
  if (!q) return { ok: false, reason: 'none' };
  if (q.rr >= 1) return { ok: false, reason: 'used' };
  if (!Number.isInteger(index) || index < 0 || index >= q.ids.length) return { ok: false, reason: 'bad' };
  if (q.done[q.ids[index]]) return { ok: false, reason: 'done' };
  const rng = mulberry32(hashString(`${ctx.playerId}|${day}|rr${q.rr + 1}`));
  const days = playedDays(lab, day);
  const old = q.ids[index];
  const others = q.ids.filter((_, i) => i !== index);
  const exclude = [...q.ids];
  let id = null;
  if (index === NUDGE_SLOT) {
    const homeGames = others.map((x) => (QUEST_BY_ID[x] || {}).game);
    id = drawNudge(rng, days, homeGames, exclude);
  } else {
    const played = GAMES.filter((g) => days[g] > 0);
    const otherGame = (QUEST_BY_ID[others[0]] || {}).game;
    let games = (played.length >= 2 ? played : GAMES).filter((g) => g !== otherGame && homeTemplates(g, exclude).length);
    if (!games.length) games = GAMES.filter((g) => homeTemplates(g, exclude).length);
    if (games.length) { const g = pickWeighted(rng, games, days); id = pickOne(rng, homeTemplates(g, exclude)).id; }
  }
  if (!id || id === old) return { ok: false, reason: 'bad' };
  q.ids[index] = id;
  delete q.p[old];
  q.rr += 1;
  return { ok: true, reason: '', id };
}

/** The day's quests for a screen: [{ id, index, game, text, progress, target, done, coins, xp, nudge }] ([] when quests are off or not drawn). */
export function questView(lab, ctx) {
  if (lab.opts.quests === false) return [];
  const q = lab.quests[questDayFor(lab, ctx)];
  if (!q) return [];
  const out = [];
  q.ids.forEach((id, index) => {
    const t = QUEST_BY_ID[id];
    if (!t) return;
    const target = targetFor(id, q.tier, index), done = q.done[id] !== undefined;
    const r = rewardOf(index);
    out.push({ id, index, game: t.game, text: questText({ id, target }, !!ctx.gentle), progress: done ? target : Math.min(target, q.p[id] || 0), target, done, coins: r.coins, xp: r.xp, nudge: index === NUDGE_SLOT });
  });
  return out;
}
