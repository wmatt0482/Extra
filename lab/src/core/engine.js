// The engine (lab/SPEC.md §3.2): one game event in, one Receipt out. Pays coins and XP by the exchange table, steps the combo, applies the
// half-on-a-miss rule and the daily coin cap, moves the quests, counts the Lab streak day, earns crates, grants gifts. PURE: dates come in
// as ctx.now / ctx.day, nothing here reads a clock, storage or Math.random. It mutates the `lab` doc it is given; the caller (store.js) persists.
import { weekOfDay } from '../../../spell-jump/src/meta/engagement.js';
import { GAMES, cleanPieces, cleanTitle, creditEarned, devRow, totalXp, weekRow } from './model.js';
import { COMBO, DAILY_COIN_CAP, MOMENT, MOMENT_NAMES, eventDef, eventKey, payFor } from './events.js';
import { comboStep, newCombo } from './combo.js';
import { LEVEL_GIFTS, levelFor, levelProgress, titleFor } from './xp.js';
import { ITEM_BY_ID } from '../data/catalog.js';
import { QUEST_BY_ID, ensureToday, questEvent, questText, questView } from './quests.js';
import { earnCrate, unopened } from './crate.js';
import { grant } from './shop.js';
import { labDayDone, labStreakNow } from './streak.js';

/** The receipt returned whenever anything is off or fails (frozen, same shape, zeros). */
export const NOOP_RECEIPT = Object.freeze({
  ok: false, coins: 0, xp: 0, capped: false,
  combo: Object.freeze({ count: 0, boosted: false, moment: false, name: '' }),
  level: null, quests: Object.freeze([]), questsAllDone: false, crate: false, unlocks: Object.freeze([]),
  streak: null, day: '', bonus: Object.freeze({ coins: 0, xp: 0 }),
});

export function newSession(game) {
  return { game, combo: newCombo(), round: { coins: 0, xp: 0, events: 0, startedAt: 0 }, momentsThisRound: 0, questDay: '', lastAt: 0 };
}
/** A new run / race / wave / leg / job: zero the round tally and the combo. */
export function beginRound(session, now = 0) {
  session.combo = newCombo();
  session.round = { coins: 0, xp: 0, events: 0, startedAt: now };
  session.momentsThisRound = 0;
}

const stamp = (ctx) => Math.max(1, Math.floor(ctx.now) || 1);
function tierFromScore(n, of) { const r = of > 0 ? n / of : 0; return r >= 0.9 ? 'gold' : r >= 0.75 ? 'silver' : r >= 0.5 ? 'bronze' : 'brave'; }
const unlockRow = (id) => ({ id, name: (ITEM_BY_ID[id] || { name: id }).name });

/** Grant every level gift the child's level has reached (a catch-up also covers a merge that brought XP from another device). */
export function grantLevelGifts(lab, ctx, level) {
  const out = [];
  for (const l of Object.keys(LEVEL_GIFTS).map(Number).sort((a, b) => a - b)) if (l <= level && grant(lab, ctx, LEVEL_GIFTS[l], 'level')) out.push(unlockRow(LEVEL_GIFTS[l]));
  return out;
}

function addGallery(lab, ctx, ev, kind) {
  const m = ev.meta;
  if (!m || typeof m.id !== 'string' || !/^[A-Za-z0-9._-]{1,48}$/.test(m.id)) return;
  const row = { id: m.id, at: stamp(ctx), kind, title: cleanTitle(m.title), pieces: cleanPieces(m.pieces) };
  lab.gallery = [row, ...lab.gallery.filter((g) => g.id !== row.id)].slice(0, 12);
}

/** Apply one game event to the lab doc. ev = { game, event, n, firstTry, meta }. Returns the Receipt (a zero receipt for an unknown game or event). */
export function applyEvent(lab, ctx, ev) {
  const game = ev && ev.game;
  const def = GAMES.includes(game) ? eventDef(game, ev.event) : null;
  if (!def) return { ...NOOP_RECEIPT, combo: { ...NOOP_RECEIPT.combo }, quests: [], unlocks: [], bonus: { coins: 0, xp: 0 }, day: ctx.day };
  const session = ctx.session || (ctx.session = newSession(game));
  const day = ctx.day, wk = weekOfDay(day), now = stamp(ctx);
  const n = def.flat ? 1 : Math.max(1, Math.min(1000, Math.floor(Number(ev.n)) || 1));
  const xpBefore = totalXp(lab), levelBefore = levelFor(xpBefore);
  const unlocks = [];
  const key = eventKey(game, def);
  const isDay = def.event === 'day';

  // the first event from a game: its poster for the home wall
  if (lab.seen.games[game] === undefined) {
    lab.seen.games[game] = now;
    if (grant(lab, ctx, `home.poster.${game}`, 'first')) unlocks.push(unlockRow(`home.poster.${game}`));
  }
  const p = lab.play[day] || (lab.play[day] = Object.fromEntries(GAMES.map((g) => [g, 0])));
  p[game] += 1;
  if (lab.coinDay.day !== day) lab.coinDay = { day, n: 0, ev: {} };
  const cd = lab.coinDay;

  // ---- what the event pays
  const replay = game === 'bc' && def.event === 'job' && !!ev.meta && ev.meta.first === false;
  const full = payFor(def, { n, firstTry: ev.firstTry, replay });
  let coins = full.coins, xp = full.xp;
  const used = cd.ev[key] || 0;
  if (def.once && used >= 1) { coins = 0; xp = 0; }
  else if (def.limit) {
    const room = Math.max(0, def.limit - used);
    coins = room >= n ? full.coins : payFor(def, { n: room, firstTry: ev.firstTry, replay }).coins;
    if (room <= 0) coins = 0;
  }
  cd.ev[key] = used + (def.flat || def.once ? 1 : n);

  // ---- the combo (answers with a first-try signal; never the Friday Test or Build Crew)
  const combo = { count: session.combo.count, boosted: false, moment: false, name: '' };
  if (def.kind === 'answer' && game !== 'bc') {
    const step = comboStep(session.combo, { firstTry: ev.firstTry, assessment: !!def.assessment });
    combo.count = step.count; combo.boosted = step.boosted; combo.moment = step.moment;
    if (step.boosted) coins *= 2;
    if (step.moment) { coins += MOMENT.coins; xp += MOMENT.xp; combo.name = MOMENT_NAMES[game] || ''; }
    session.momentsThisRound = session.combo.moments;
    if (combo.count > lab.best[game]) lab.best[game] = combo.count;
  }

  // ---- the daily coin cap: coins pause, XP and quests go on
  const before = cd.n;
  let capped = false;
  if (coins > 0) {
    const room = Math.max(0, DAILY_COIN_CAP - cd.n);
    if (coins >= room) { capped = before < DAILY_COIN_CAP; coins = room; }
    cd.n += coins;
  }

  creditEarned(lab, ctx, { coins, xp });
  const w = weekRow(lab, wk, ctx.device);
  if (def.week && !(def.once && used >= 1)) w[def.week] += def.flat ? 1 : n;
  if (def.kind === 'answer' && ev.firstTry === true) w.ft += n;
  if (!w.g.includes(game)) { w.g.push(game); w.g.sort(); }

  // ---- gifts and records tied to one event
  if (game === 'sj' && def.event === 'test') {
    const meta = ev.meta || {};
    const of = Math.max(0, Math.floor(Number(meta.of)) || 0), right = Math.max(0, Math.floor(Number(ev.n)) || 0);
    const tier = ['gold', 'silver', 'bronze', 'brave'].includes(meta.tier) ? meta.tier : tierFromScore(right, of);
    lab.trophies = [{ game: 'sj', id: 'friday', tier, at: now, n: Math.min(999, right), of: Math.min(999, of) }, ...lab.trophies.filter((t) => !(t.game === 'sj' && t.id === 'friday' && t.at === now))].slice(0, 40);
    if (grant(lab, ctx, 'home.shelf.trophy', 'test')) unlocks.push(unlockRow('home.shelf.trophy'));
  }
  if (game === 'bc' && (def.event === 'job' || def.event === 'blueprint' || def.event === 'site')) addGallery(lab, ctx, ev, def.event === 'site' ? 'site' : def.event === 'blueprint' ? 'blueprint' : 'job');

  // ---- the Lab streak day, and the crate a milestone pays
  let crate = false;
  const streak = { counted: false, count: 0, bonusFreezeEarned: false };
  if (isDay && used < 1) {
    const r = labDayDone(lab, ctx);
    Object.assign(streak, { counted: r.counted, count: r.count });
    if (r.counted && r.milestone) {
      const k = lab.crates.earned[`streak:${r.milestone}`] === undefined ? `streak:${r.milestone}` : `streak:${r.milestone}:${day}`;
      if (earnCrate(lab, k, now)) crate = true;
    }
    if (r.counted && r.count >= 30 && grant(lab, ctx, 'pet.neck.medal', 'streak')) unlocks.push(unlockRow('pet.neck.medal'));
  } else streak.count = labStreakNow(lab, ctx.now);

  // ---- the quests
  const bonus = { coins: 0, xp: 0 };
  let questsAllDone = false;
  const quests = [];
  if (lab.opts.quests !== false) {
    for (const r of questEvent(lab, ctx, game, ev.event, { n, firstTry: ev.firstTry })) {
      bonus.coins += r.coins; bonus.xp += r.xp;
      if (r.allDone) {
        questsAllDone = true; bonus.coins += r.bonusCoins; bonus.xp += r.bonusXp;
        if (earnCrate(lab, r.crateKey, now)) crate = true;
        streak.bonusFreezeEarned = !!r.bonusFreeze;
      }
      const t = QUEST_BY_ID[r.id];
      quests.push({ id: r.id, text: t ? questText({ id: r.id, target: r.target }, !!ctx.gentle) : '', progress: r.progress, target: r.target, justDone: r.justDone });
    }
  }

  // ---- level and its gifts
  const xpAfter = totalXp(lab), levelAfter = levelFor(xpAfter);
  unlocks.push(...grantLevelGifts(lab, ctx, levelAfter));

  session.round.coins += coins + bonus.coins;
  session.round.xp += xp + bonus.xp;
  session.round.events += 1;
  session.lastAt = ctx.now;
  return {
    ok: true, coins, xp, capped, combo, level: { before: levelBefore, after: levelAfter, up: levelAfter > levelBefore, title: titleFor(levelAfter) },
    quests, questsAllDone, crate, unlocks, streak, day, bonus,
  };
}

/** The numbers a results strip needs: coins and XP this round, the level, XP to the next, the quests, a crate waiting. */
export function roundSummary(lab, ctx, session) {
  const s = session || ctx.session || newSession('');
  const lp = levelProgress(totalXp(lab));
  const qs = questView(lab, ctx);
  return { coins: s.round.coins, xp: s.round.xp, level: lp.level, title: lp.title, into: lp.into, need: lp.need, toNext: lp.toNext, next: lp.next, max: lp.max,
    quests: qs, questsDone: qs.filter((q) => q.done).length, crateWaiting: unopened(lab).length > 0 };
}
export { COMBO, DAILY_COIN_CAP, ensureToday, devRow };
