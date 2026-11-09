// The Lab's economy simulation (lab/SPEC.md §7.2): node lab/tools/economy-sim.mjs [--check] [--verbose] [--seeds N]
// The pure core, a seeded clock, no browser. Part A measures coins and XP an hour per game and accuracy. Part B plays Ben for a full week.
// Part C plays three kids (Ava 90 % / 45 min, Ben 70 % / 30 min, Cal 45 % / 20 min) for 12 weeks, with off days, busy and quiet weeks,
// quests that point at games, crates, the shop, the family board and the weekly goal. Part D runs the long runway (52 weeks).
// `--check` exits 1 when a target of the spec is missed. Everything the kids do is a stated assumption below (RATES, KIDS, BEHAVIOUR): the
// core is the real core (applyEvent, quests, crates, family), nothing is mocked.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, weekOfDay } from '../../car-jump/src/meta/engagement.js';
import { GAMES, defaultLab, owns, totalXp, wallet, weekShift } from '../src/core/model.js';
import { applyEvent, newSession, beginRound } from '../src/core/engine.js';
import { QUEST_BY_ID, ensureToday, playedDays } from '../src/core/quests.js';
import { labRefresh } from '../src/core/streak.js';
import { openCrate, unopened } from '../src/core/crate.js';
import { buy } from '../src/core/shop.js';
import { boardFor, ensureGoalPick, goalFor, settleCrowns } from '../src/core/family.js';
import { levelFor } from '../src/core/xp.js';
import { slotOpen } from '../src/core/xp.js';
import { ITEMS } from '../src/data/catalog.js';
import { FAMILY_GOALS } from '../src/data/goals.js';
import { DAILY_COIN_CAP } from '../src/core/events.js';

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check'), VERBOSE = argv.includes('--verbose');
const SEEDS = argv.includes('--seeds') ? Math.max(1, Number(argv[argv.indexOf('--seeds') + 1]) || 20) : 20;
const START = '2026-11-02';                 // a Monday: week 1 = 2026-W45
const READY = ITEMS.filter((i) => !i.soon).map((i) => i.id);

// ---------- assumptions ----------
// Per hour of play (SPEC §2.2): the events of one ROUND (a run / race / wave / leg / job) and how many rounds an hour holds.
const RATES = {
  // Spell Jump's round is a mission / Mega Run (8 words, ~2.5 runs): the combo lives for a round, so the game calls beginRound per mission, not per 3-word race
  sj: { rph: 10, answers: [['word', 8]], units: [['run', 2.5], ['perfect', 0.8], ['mastered', 0.3]] },
  tb: { rph: 30, answers: [['fact', 150 / 30]], units: [['race', 1], ['win', 8 / 30], ['perfect', 12 / 30], ['ghostBeat', 3 / 30], ['star', 0.03], ['summit', 0.01]] },
  ff: { rph: 16, answers: [['zap', 150 / 16]], units: [['wave', 1], ['bull', 20 / 16], ['boss', 3 / 16]] },
  ww: { rph: 6.5, answers: [['marker', 13.08 * 0.45], ['problem', 13.08 * 0.35], ['word', 13.08 * 0.2]], units: [['leg', 1], ['star', 2], ['farm', 0.1]] },
  bc: { rph: 6, answers: [], units: [['job', 1], ['piece', 1, 5], ['challenge', 0.5], ['blueprint', 1 / 6], ['site', 1 / 6]] },
  // Case Files: one case is about 25 minutes of reading (the game opens one new case a day), one flat payment per closed case
  cf: { rph: 2.4, answers: [], units: [['case', 1]] },
  // Pip's Squirrel Chase: one case a day (about 20 minutes of spelling and map play), one flat payment per closed case; its words bank to Spell Jump
  sq: { rph: 3, answers: [], units: [['case', 1]] },
};
// A week's swing is the share of the usual minutes a kid plays that week (school weeks, sports, a cold): the younger the kid, the bigger the swing.
const KIDS = [
  { id: 'ava', name: 'Ava', acc: 0.9, minutes: 45, games: ['sj', 'tb', 'ww'], pPlay: 0.8, weekVar: [0.7, 1.3] },
  { id: 'ben', name: 'Ben', acc: 0.7, minutes: 30, games: ['tb', 'ff', 'bc'], pPlay: 0.85, weekVar: [0.5, 1.5] },
  { id: 'cal', name: 'Cal', acc: 0.45, minutes: 20, games: ['sj', 'ww'], pPlay: 0.8, weekVar: [0.2, 2.4] },
];
// How kids use the quests: on most days they go straight for the three quests (their games first, the nudge last) until each is done or the time runs out, then play a favourite; on the other days they just play what they like.
const BEHAVIOUR = { questMinded: 0.85, jitter: 0.25 };      // the share of play days a child heads for the day's quests first

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const stoch = (x, r) => Math.floor(x) + (r() < x - Math.floor(x) ? 1 : 0);
const noonOf = (day, minute = 0) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, 16, 0, 0).getTime() + minute * 60000; };

// one round of a game: the events, in order
function roundEvents(game, acc, r) {
  const spec = RATES[game], out = [];
  for (const [event, mean] of spec.answers) for (let i = 0, k = stoch(mean, r); i < k; i++) out.push({ game, event, n: 1, firstTry: r() < acc });
  for (const [event, mean, n] of spec.units) for (let i = 0, k = stoch(mean, r); i < k; i++) out.push({ game, event, n: n || 1, firstTry: null, meta: event === 'job' ? { first: true } : null });
  return out;
}
// play `minutes` of a game: rounds, each begun with a fresh combo. Returns the coins / XP the table paid (receipts) and the last receipt.
function playGame(lab, base, game, minutes, acc, r, t0, sessions) {
  const spec = RATES[game], session = sessions[game] || (sessions[game] = newSession(game));
  const rounds = stoch((minutes * spec.rph) / 60, r);
  let coins = 0, xp = 0, t = t0;
  for (let i = 0; i < rounds; i++) {
    beginRound(session, t);
    for (const ev of roundEvents(game, acc, r)) {
      t += (60000 * 60) / (spec.rph * 12);
      const rc = applyEvent(lab, { ...base, now: t, game, session }, ev);
      coins += rc.coins; xp += rc.xp;
    }
  }
  return { coins, xp, t };
}

// ================= A: coins and XP an hour =================
// the five games played by the hour; Case Files opens one case a day (a flat payment per closed case), so it has no hourly spec
const HOURLY = GAMES.filter((g) => g !== 'cf' && g !== 'sq');
const SPEC_TABLE = { 0.45: { sj: 451, tb: 453, ff: 463, ww: 490, bc: 540 }, 0.7: { sj: 563, tb: 558, ff: 606, ww: 609, bc: 540 }, 0.9: { sj: 724, tb: 709, ff: 814, ww: 779, bc: 540 } };
function perHour(game, acc, hours, seed) {
  const r = rng(seed), lab = defaultLab(); lab.opts.quests = false;
  let coins = 0, xp = 0;
  for (let h = 0; h < hours; h++) {                                   // every hour is its own day (the daily limits are per day)
    const day = addDays(START, h), base = { playerId: 'sim', device: 'dev001', day, gentle: false };
    const p = playGame(lab, base, game, 60, acc, r, noonOf(day), {});
    coins += p.coins; xp += p.xp;
  }
  return { coins: coins / hours, xp: xp / hours };
}

// ================= C: the family =================
function newKid(k, seed) { return { ...k, lab: defaultLab(), r: rng(seed * 101 + k.id.charCodeAt(0)), sessions: {}, log: [], opened: [], boughtAll: 0, earnedDay: [] }; }
const shelfItems = ITEMS.filter((i) => ['both', 'coins'].includes(i.source) && !i.soon);
function shopAll(kid) {                       // cheapest first, everything the child can afford; every item is "ready"
  const lab = kid.lab, level = levelFor(totalXp(lab));
  for (;;) {
    const c = shelfItems.filter((i) => !owns(lab, i.id) && slotOpen(level, i.key) && i.price <= wallet(lab).coins).sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : 1))[0];
    if (!c) return;
    if (!buy(lab, { now: kid.t, device: 'dev001' }, c.id, { ready: READY }).ok) return;
  }
}
const shelfDone = (lab) => shelfItems.every((i) => owns(lab, i.id));

function simulateFamily({ seed, weeks, full = false, kids = KIDS, shop = true, noPlay = false }) {
  const fam = kids.map((k) => newKid(k, seed));
  const players = fam.map((k) => ({ id: k.id, name: k.name, color: '', lab: k.lab }));
  const weekly = [], weekMult = {};
  const out = { fam, weekly };
  for (let d = 0; d < weeks * 7; d++) {
    const day = addDays(START, d), wk = weekOfDay(day);
    for (const k of fam) {
      if (d % 7 === 0) { const [lo, hi] = k.weekVar; weekMult[k.id] = full ? 1 : lo + (hi - lo) * k.r(); }
      const plays = !noPlay && (full || k.r() < k.pPlay);
      if (!plays) continue;
      const lab = k.lab, r = k.r;
      const fav = k.games.slice().sort(() => r() - 0.5);
      let t = noonOf(day);
      const first = d === 0 ? k.games[0] : fav[0];
      const base = { playerId: k.id, device: 'dev001', day, gentle: false };
      const ctx0 = { ...base, now: t, game: first, session: newSession(first) };
      const playedBefore = playedDays(lab, day);                          // what the draw sees: the games played in the last 14 days
      labRefresh(lab, t); ensureToday(lab, ctx0);
      ensureGoalPick(lab, ctx0, players); settleCrowns(lab, ctx0, players, k.id);
      const q = lab.quests[day];
      let left = Math.max(8, k.minutes * weekMult[k.id] * (1 + (r() * 2 - 1) * BEHAVIOUR.jitter));
      const minutesToday = left;    // minutes today: the child's usual, a busy or quiet week, +-25 % a day
      const coins0 = wallet(lab).earned, sessions = {}, visited = new Set();
      const visit = (g, minutes) => {                                   // free play: whole rounds for `minutes`
        const p = playGame(lab, base, g, minutes, k.acc, r, t, sessions); t = p.t; left -= minutes; visited.add(g);
      };
      const round = (g, stopWhen) => {                                  // one round of a game, stopping as soon as `stopWhen()` says the child is done; returns the minutes it took
        const spec = RATES[g], session = sessions[g] || (sessions[g] = newSession(g));
        beginRound(session, t);
        const evs = roundEvents(g, k.acc, r);
        let used = 0;
        for (const ev of evs) { t += 60000 * 60 / (spec.rph * 12); used += 1; applyEvent(lab, { ...base, now: t, game: g, session }, ev); if (stopWhen && stopWhen()) break; }
        visited.add(g);
        return (60 / spec.rph) * (used / Math.max(1, evs.length));
      };
      const done = (id) => q.done[id] !== undefined;
      if (d === 0) {                                                    // a new child tries every game of theirs
        for (const g of k.games) visit(g, left / k.games.length);
      } else if (r() < BEHAVIOUR.questMinded) {                         // heads for the quests first, in order, until each is done or the time is
        q.ids.forEach((id, i) => {
          if (done(id) || left < 2) return;
          let g = QUEST_BY_ID[id].game;
          if (g === 'any') { if (visited.size >= 2) return; g = HOURLY.filter((x) => !visited.has(x))[Math.floor(r() * (HOURLY.length - visited.size))]; }
          let guard = 0;
          while (left > 0 && !done(id) && guard++ < 60) { const m = round(g, () => done(id)); left -= m; if (QUEST_BY_ID[id].explore && visited.size >= 2) break; }
        });
        if (left > 2) visit(fav[0], left);                              // what is left of the time: a favourite
      } else {                                                          // just plays what they like
        visit(fav[0], left * (r() < 0.3 ? 0.65 : 1));
        if (left > 2) visit(fav[1] || fav[0], left);
      }
      for (const g of visited) { t += 30000; applyEvent(lab, { ...base, now: t, game: g, session: sessions[g] }, { game: g, event: 'day' }); }
      k.t = t;
      const allDone = q.ids.every((id) => done(id));
      const crateToday = lab.crates.earned[`quest:${day}`] !== undefined;
      const inHome = q.ids.filter((id) => k.games.includes(QUEST_BY_ID[id].game)).length;
      const inPlayed = q.ids.filter((id) => playedBefore[QUEST_BY_ID[id].game] > 0).length;
      k.log.push({ day, wk, d, allDone, crateToday, inHome, inPlayed, minutes: Math.round(minutesToday),  nudgeId: q.ids[2], ids: q.ids.slice(), coinsToday: wallet(lab).earned - coins0, capped: lab.coinDay.n >= DAILY_COIN_CAP, level: levelFor(totalXp(lab)) });
      // crates are opened at the end of the day; the child shops
      for (const key of unopened(lab)) { const res = openCrate(lab, { ...base, now: t }, key, { ready: READY }); k.opened.push({ key, r: res.rarity, pity: res.pity, id: res.id, d }); }
      if (shop) shopAll(k);
      if (!k.shelfWeek && shelfDone(lab)) k.shelfWeek = Math.floor(d / 7) + 1;
    }
    for (const k of fam) k.earnedDay[d] = wallet(k.lab).earned;
    if (d % 7 === 6) {                                                  // the week ends: the board and the goal
      const g = goalFor(players, wk, { day });
      const b = boardFor(players, wk, noonOf(day));
      weekly.push({ wk, goal: g, improved: b.improvedId, most: b.mostId, xp: Object.fromEntries(b.rows.map((x) => [x.id, x.xp])), nums: players.map((p) => ({ id: p.id, w: weekNumbersOf(p.lab, wk) })) });
    }
  }
  return out;
}
import { weekNumbers as weekNumbersOf } from '../src/core/family.js';

// ================= run =================
// minutes of play a quest takes, by template and tier, at a first-try rate (informational: `--quests`)
function questMinutes(id, tier, acc, trials = 60) {
  const t = QUEST_BY_ID[id], r = rng(77 + id.length), target = t[tier]; let total = 0;
  if (t.explore) return 2 * 3;
  for (let i = 0; i < trials; i++) {
    const lab = defaultLab(), day = START, session = newSession(t.game); let minutes = 0, got = 0;
    for (let guard = 0; guard < 400 && got < target; guard++) {
      beginRound(session, 0);
      for (const ev of roundEvents(t.game, acc, r)) { const n = ev.n || 1; if (t.events.includes(ev.event) && (!t.firstTry || ev.firstTry === true)) got += n; }
      minutes += 60 / RATES[t.game].rph;
    }
    total += minutes; void lab; void day;
  }
  return total / trials;
}
if (argv.includes('--quests')) {
  console.log('Minutes of play a quest takes (whole rounds, 70 % first-try):');
  for (const q of Object.values(QUEST_BY_ID)) console.log('  ' + q.id.padEnd(13) + ['easy', 'mid', 'hard'].map((tr) => `${tr} ${q[tr]} = ${questMinutes(q.id, tr, 0.7).toFixed(1)} min`.padEnd(22)).join(''));
  process.exit(0);
}
if (argv.includes('--calibrate')) {                // the weekly family production per goal counter, for choosing perPlayer
  const fs = []; for (let i = 0; i < 20; i++) fs.push(simulateFamily({ seed: 3000 + i, weeks: 12 }));
  const rows = fs.flatMap((f) => f.weekly.slice(1));
  const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
  console.log('Weekly production of the three kids together (weeks 2 to 12, 20 families): p10 / p25 / median / p75 / p90, and per player (Ava, Ben, Cal medians)');
  for (const f of ['zap', 'race', 'word', 'leg', 'job', 'ft']) {
    const tot = rows.map((w) => w.nums.reduce((a, n) => a + n.w[f], 0));
    console.log('  ' + f.padEnd(6) + [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => String(q(tot, p)).padStart(6)).join('') + '   ' + KIDS.map((k) => `${k.name} ${q(rows.map((w) => w.nums.find((n) => n.id === k.id).w[f]), 0.5)}`).join(' · '));
  }
  console.log('  explore ' + [0.1, 0.5, 0.9].map((p) => q(rows.map((w) => w.nums.reduce((a, n) => a + Math.min(3, n.w.g.length), 0)), p)).join(' / ') + ' (of 9)');
  process.exit(0);
}
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const t0 = performance.now();
console.log('The Lab economy simulation (lab/SPEC.md §7.2)\n');

console.log('A. Lab coins an hour by game and first-try rate (the exchange table, combos, moments and daily limits all live)');
const rate = {};
console.log('   acc   ' + HOURLY.map((g) => g.padStart(12)).join(''));
for (const acc of [0.45, 0.7, 0.9]) {
  rate[acc] = {};
  for (const g of HOURLY) rate[acc][g] = perHour(g, acc, 70, 7 + g.charCodeAt(0));
  console.log(`   ${pct(acc).padEnd(5)} ` + HOURLY.map((g) => `${rate[acc][g].coins.toFixed(0)} (${SPEC_TABLE[acc][g]})`.padStart(12)).join(''));
}
console.log('   XP/h  ' + HOURLY.map((g) => `${rate[0.7][g].xp.toFixed(0)}`.padStart(12)).join('') + '   (at 70 %)');
for (const g of HOURLY) {
  const c70 = rate[0.7][g].coins;
  check(`coins/hour at 70 % in ${g}: ${c70.toFixed(0)} within 570 +-15 % (485 to 655)`, c70 >= 570 * 0.85 && c70 <= 570 * 1.15);
  for (const acc of [0.45, 0.9]) { const v = rate[acc][g].coins, s = SPEC_TABLE[acc][g]; check(`coins/hour at ${pct(acc)} in ${g}: ${v.toFixed(0)} within the spec table ${s} +-10 %`, Math.abs(v - s) <= s * 0.1); }
  check(`${g}: a 90 % child earns at most 1.8x a 45 % child in the same hour (${(rate[0.9][g].coins / rate[0.45][g].coins).toFixed(2)}x)`, rate[0.9][g].coins <= 1.8 * rate[0.45][g].coins);
  check(`${g}: a 45 % child earns at least 75 % of the 70 % baseline (${pct(rate[0.45][g].coins / c70)})`, rate[0.45][g].coins >= 0.75 * c70);
}
check(`XP an hour at 70 % in the answer games is 650 to 900 (the spec says 700 to 800 before combo moments, which add about 5 %) (${['sj', 'tb', 'ff', 'ww'].map((g) => rate[0.7][g].xp.toFixed(0)).join(', ')}); Build Crew about 600 (${rate[0.7].bc.xp.toFixed(0)})`,
  ['sj', 'tb', 'ff', 'ww'].every((g) => rate[0.7][g].xp >= 650 && rate[0.7][g].xp <= 900) && rate[0.7].bc.xp >= 500 && rate[0.7].bc.xp <= 700);

console.log('\nB. Ben, a full week of play (7 days, 30 minutes), ' + SEEDS + ' seeded weeks');
const benWeeks = [];
for (let s = 0; s < SEEDS; s++) benWeeks.push(simulateFamily({ seed: 500 + s, weeks: 3, full: true, kids: [KIDS[1]], shop: false }).fam[0]);
const w1 = benWeeks.map((b) => b.earnedDay[6]), day1 = benWeeks.map((b) => b.earnedDay[0]), day3 = benWeeks.map((b) => b.earnedDay[2]), day21 = benWeeks.map((b) => b.earnedDay[20]);
console.log(`   week 1 coins: mean ${mean(w1).toFixed(0)} (min ${Math.min(...w1)}, max ${Math.max(...w1)}) · day 1 ${mean(day1).toFixed(0)} · day 3 ${mean(day3).toFixed(0)} · by day 21 ${mean(day21).toFixed(0)}`);
check(`Ben's week: mean ${mean(w1).toFixed(0)} coins including quests and crates, within 3,200 to 5,600 (every seed ${Math.min(...w1)} to ${Math.max(...w1)})`, mean(w1) >= 3200 && mean(w1) <= 5600 && w1.every((x) => x >= 3000 && x <= 5800));
check(`a first common item (300) is affordable on day 1 in ${pct(day1.filter((x) => x >= 300).length / SEEDS)} of weeks (need 80 %)`, day1.filter((x) => x >= 300).length / SEEDS >= 0.8);
check(`a rare (1,200) is affordable within the first 3 days in ${pct(day3.filter((x) => x >= 1200).length / SEEDS)} of weeks (need 80 %)`, day3.filter((x) => x >= 1200).length / SEEDS >= 0.8);
check(`the dump truck (8,000) is affordable within 3 weeks of full play in ${pct(day21.filter((x) => x >= 8000).length / SEEDS)} of runs (need 90 %)`, day21.filter((x) => x >= 8000).length / SEEDS >= 0.9);

console.log('\nC. Three kids, 12 weeks, ' + SEEDS + ' seeded families');
const fams = [];
for (let s = 0; s < SEEDS; s++) fams.push(simulateFamily({ seed: 1000 + s, weeks: 12 }));
const kidDays = fams.flatMap((f) => f.fam.flatMap((k) => k.log.map((e) => ({ kid: k.id, ...e, kidGames: k.games }))));
const homeOk = kidDays.filter((e) => e.inPlayed >= 2).length / kidDays.length, profileOk = kidDays.filter((e) => e.inHome >= 2).length / kidDays.length;
const allDone = kidDays.filter((e) => e.allDone).length / kidDays.length, crateDay = kidDays.filter((e) => e.crateToday).length / kidDays.length;
const byKid = Object.fromEntries(KIDS.map((k) => [k.id, kidDays.filter((e) => e.kid === k.id)]));
console.log(`   kid-days ${kidDays.length}: quests in games played in the last 14 days >= 2 of 3 on ${pct(homeOk)} (in the kid's usual games: ${pct(profileOk)}) · all three done on ${pct(allDone)} (${KIDS.map((k) => `${k.name} ${pct(byKid[k.id].filter((e) => e.allDone).length / byKid[k.id].length)}`).join(', ')}) · a crate on ${pct(crateDay)}`);
check(`quests: >= 2 of 3 are in games the kid actually plays (played in the last 14 days) on ${pct(homeOk)} of play days (need 98 %)`, homeOk >= 0.98);
check(`quests: the third is always the nudge (an easy quest from the least-played game, or Play different games)`, kidDays.every((e) => e.ids.length === 3 && QUEST_BY_ID[e.nudgeId].nudge));
check(`quests: a day's set is completed on ${pct(allDone)} of play days (need 55 to 80 %)`, allDone >= 0.55 && allDone <= 0.8);
check(`quests: a crate on ${pct(crateDay)} of play days (need 40 to 70 %)`, crateDay >= 0.4 && crateDay <= 0.7);
const opened = fams.flatMap((f) => f.fam.map((k) => k.opened.slice().sort((a, b) => a.d - b.d)));
let longest = 0, nRare = 0, nCrates = 0;
for (const seq of opened) { let run = 0; for (const c of seq) { nCrates++; if (c.r === 'c') { run++; longest = Math.max(longest, run); } else { nRare++; run = 0; } } }
console.log(`   crates opened ${nCrates}: a rare-or-better every ${(nCrates / nRare).toFixed(2)} crates · longest run of commons ${longest}`);
check(`crates: no 7 in a row without a rare or better (longest run of commons ${longest})`, longest <= 6);
check(`crates: a rare-or-better every ${(nCrates / nRare).toFixed(2)} crates (need 3.5 to 6)`, nCrates / nRare >= 3.5 && nCrates / nRare <= 6);
const capDays = kidDays.filter((e) => e.capped).length / kidDays.length;
check(`the daily coin cap is reached on ${pct(capDays)} of kid-days (need <= 2 %)`, capDays <= 0.02);
const weeklyAll = fams.flatMap((f) => f.weekly);
const metShare = weeklyAll.filter((w) => w.goal.met).length / weeklyAll.length;
const byGoal = {}; for (const w of weeklyAll) { const x = (byGoal[w.goal.id] = byGoal[w.goal.id] || [0, 0]); x[0]++; if (w.goal.met) x[1]++; }
console.log(`   family goal met in ${pct(metShare)} of weeks (${Object.entries(byGoal).map(([id, [n, m]]) => `${id} ${m}/${n}`).join(' · ')})`);
check(`family goal: reached in ${pct(metShare)} of the weeks (need 50 to 85 %)`, metShare >= 0.5 && metShare <= 0.85);
const idle = simulateFamily({ seed: 9, weeks: 3, noPlay: true });
check('family goal: never met in a week without play', idle.weekly.every((w) => !w.goal.met && w.goal.progress === 0));
const firstWeek = fams.map((f) => f.weekly[0]);
check(`family goal: week 1 is met only with play (${pct(firstWeek.filter((w) => w.goal.met).length / SEEDS)} of the weeks, always with progress)`, firstWeek.every((w) => !w.goal.met || w.goal.progress >= w.goal.target));
const wonBy = { ava: 0, ben: 0, cal: 0, none: 0 }; for (const w of weeklyAll) wonBy[w.improved || 'none']++;
const calShare = wonBy.cal / weeklyAll.length, topShare = Math.max(wonBy.ava, wonBy.ben, wonBy.cal) / weeklyAll.length;
console.log(`   Most improved: Ava ${pct(wonBy.ava / weeklyAll.length)} · Ben ${pct(wonBy.ben / weeklyAll.length)} · Cal ${pct(calShare)} · nobody ${pct(wonBy.none / weeklyAll.length)}`);
check(`Most improved goes to Cal in ${pct(calShare)} of weeks (need >= 25 %)`, calShare >= 0.25);
check(`Most improved goes to the same kid in at most ${pct(topShare)} of weeks (need < 70 %)`, topShare < 0.7);
console.log('   weekly XP (mean): ' + KIDS.map((k) => `${k.name} ${mean(weeklyAll.map((w) => w.xp[k.id])).toFixed(0)}`).join(' · ') + ' · coins earned in 12 weeks: ' + KIDS.map((k) => `${k.name} ${mean(fams.map((f) => wallet(f.fam.find((x) => x.id === k.id).lab).earned)).toFixed(0)}`).join(' · '));

console.log('\nD. The long runway (52 weeks of 12-week behaviour, cheapest-first shopping)');
const long = [];
for (let s = 0; s < Math.max(3, Math.ceil(SEEDS / 4)); s++) long.push(simulateFamily({ seed: 2000 + s, weeks: 52, kids: [KIDS[0], KIDS[1]] }));
const avaDone = long.map((f) => f.fam[0].shelfWeek || 99), benDone = long.map((f) => f.fam[1].shelfWeek || 99);
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`   the whole shelf (106 items, 140,300 coins) is owned by week: Ava ${avaDone.join(', ')} · Ben ${benDone.join(', ')}  (99 = not within 52 weeks)`);
check(`runway: Ava (the heaviest) owns the whole shelf in week ${med(avaDone)} (need 20 to 40)`, med(avaDone) >= 20 && med(avaDone) <= 40);
check(`runway: Ben has not bought the whole shelf by week 26 (done in week ${med(benDone)})`, med(benDone) > 26);

console.log('\nE. Independence');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const srcRoot = new URL('../src', import.meta.url).pathname;
const bad = walk(srcRoot).filter((f) => f.endsWith('.js')).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((i) => /(trail-blazer|fraction-fright|wagon-west|build-crew)\//.test(i) || /(economy|save|engine)\.m?js$/.test(i) && !/lab\/src|\.\/core\/engine\.js|\.\/engine\.js/.test(i) && /spell-jump|car-jump/.test(i)).map((i) => `${f}: ${i}`));
check(`lab/src imports no game economy, save or engine module${bad.length ? ': ' + bad.join(', ') : ''}`, bad.length === 0);

console.log('\nTargets (' + ((performance.now() - t0) / 1000).toFixed(1) + ' s)');
let missed = 0;
for (const c of checks) { if (!c.ok) missed++; if (!c.ok || VERBOSE) console.log(`  ${c.ok ? 'ok  ' : 'MISS'} ${c.name}`); }
console.log(`${checks.length - missed} of ${checks.length} targets met`);
if (CHECK && missed) { console.log(`economy-sim --check: ${missed} target(s) missed`); process.exit(1); }
if (CHECK) console.log('economy-sim --check: all targets met');
void existsSync; void FAMILY_GOALS; void weekShift;
