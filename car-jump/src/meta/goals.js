// Three rotating goals. Cumulative goals (smash 10 crates, land perfectly twice) advance from live
// engine events; single-run goals (hit 120 km/h, reach 300 m) are checked against the run summary
// (and live 'speed' events). A finished goal is paid out on the results screen and replaced.

import { OBSTACLE_KINDS, TRACKS } from '../data/tracks.js';
import { earn } from './economy.js';
import { hashString, mulberry32, pick } from './rng.js';

export const GOAL_SLOTS = 3;

const plural = (n, one, many) => (n === 1 ? one : many);
const kindLabel = (kind, n) => {
  const l = (OBSTACLE_KINDS[kind] && OBSTACLE_KINDS[kind].label) || kind;
  if (n === 1) return l.toLowerCase();
  if (l.endsWith('s')) return l.toLowerCase() + 'es';
  return l.toLowerCase() + 's';
};

// scope: 'total' accumulates across runs, 'run' must happen within a single run.
const TEMPLATES = {
  smashKind: { scope: 'total', icon: 'smash',
    make: (r, p, ctx) => { const kind = pick(r, ctx.kinds); return { kind, target: pick(r, [6, 8, 10, 12]) + p * 2 }; },
    text: (g) => `Smash ${g.target} ${kindLabel(g.kind, g.target)}`, reward: (g) => 60 * g.target },
  smashAny: { scope: 'total', icon: 'smash',
    make: (r, p) => ({ target: pick(r, [20, 25, 30, 40]) + p * 10 }),
    text: (g) => `Smash ${g.target} props`, reward: (g) => 25 * g.target },
  frontFlips: { scope: 'total', icon: 'flip',
    make: (r, p) => ({ target: pick(r, [3, 4, 5]) + p }),
    text: (g) => `Land ${g.target} front ${plural(g.target, 'flip', 'flips')}`, reward: (g) => 140 * g.target },
  backFlips: { scope: 'total', icon: 'flip',
    make: (r, p) => ({ target: pick(r, [3, 4, 5]) + p }),
    text: (g) => `Land ${g.target} back ${plural(g.target, 'flip', 'flips')}`, reward: (g) => 140 * g.target },
  perfect: { scope: 'total', icon: 'land',
    make: (r, p) => ({ target: pick(r, [2, 3]) + Math.floor(p / 2) }),
    text: (g) => `Land perfectly ${g.target} ${plural(g.target, 'time', 'times')}`, reward: (g) => 250 * g.target },
  finishes: { scope: 'total', icon: 'flag',
    make: (r) => ({ target: pick(r, [1, 2, 3]) }),
    text: (g) => `Cross a finish line ${g.target === 1 ? 'once' : g.target + ' times'}`, reward: (g) => 400 * g.target },
  speed: { scope: 'run', icon: 'speed',
    make: (r, p) => ({ target: Math.round((pick(r, [90, 100, 110, 120]) + p * 20) / 5) * 5 }),
    text: (g) => `Hit ${g.target} km/h in one run`, reward: (g) => 5 * g.target },
  distance: { scope: 'run', icon: 'flag',
    make: (r, p) => ({ target: Math.round((TRACKS[p].finish * pick(r, [0.55, 0.7, 0.85])) / 10) * 10 }),
    text: (g) => `Reach ${g.target} m in one run`, reward: (g) => Math.round(g.target * 1.5) },
  airTime: { scope: 'run', icon: 'air',
    make: (r, p) => ({ target: pick(r, [2.5, 3, 3.5, 4]) + p * 0.5 }),
    text: (g) => `Stay airborne ${g.target} s in one run`, reward: (g) => Math.round(110 * g.target) },
  flipsRun: { scope: 'run', icon: 'flip',
    make: (r, p) => ({ target: pick(r, [2, 3]) + Math.floor(p / 2) }),
    text: (g) => `Do ${g.target} flips in one run`, reward: (g) => 220 * g.target },
  runCash: { scope: 'run', icon: 'cash',
    make: (r, p) => ({ target: Math.round((pick(r, [800, 1000, 1300]) * (1 + p * 0.9)) / 50) * 50 }),
    text: (g) => `Earn $${g.target.toLocaleString('en-US')} in one run`, reward: (g) => Math.round(g.target * 0.4) },
};

export function goalText(g) {
  const t = TEMPLATES[g.type];
  return t ? t.text(g) : g.type;
}
export function goalIcon(g) {
  return (TEMPLATES[g.type] && TEMPLATES[g.type].icon) || 'flag';
}
export function goalScope(g) {
  return (TEMPLATES[g.type] && TEMPLATES[g.type].scope) || 'total';
}

function context(save) {
  const p = Math.max(0, save.unlocked.length - 1);
  const kinds = Array.from(new Set(TRACKS.filter((t) => save.unlocked.includes(t.id)).flatMap((t) => t.obstacles.kinds)));
  return { p, kinds };
}

function makeGoal(save) {
  const ctx = context(save);
  const n = save.goals.rolled++;
  const r = mulberry32(hashString('goal:' + n));
  const taken = new Set(save.goals.list.map((g) => g.type));
  const types = Object.keys(TEMPLATES).filter((t) => !taken.has(t));
  const type = pick(r, types);
  const g = { id: 'g' + n, type, ...TEMPLATES[type].make(r, ctx.p, ctx), progress: 0, done: false };
  g.reward = Math.max(100, Math.round((TEMPLATES[type].reward(g) * (1 + ctx.p * 0.6)) / 10) * 10);
  return g;
}

export function ensureGoals(save) {
  save.goals.list = save.goals.list.filter((g) => TEMPLATES[g.type]);
  while (save.goals.list.length < GOAL_SLOTS) save.goals.list.push(makeGoal(save));
  return save.goals.list;
}

function bump(g, value, mode) {
  if (g.done) return false;
  g.progress = mode === 'max' ? Math.max(g.progress, value) : g.progress + value;
  if (g.progress >= g.target) { g.progress = g.target; g.done = true; return true; }
  return false;
}

// Live engine event → returns goals that just completed (for an in-run toast).
export function goalEvent(save, evt) {
  const done = [];
  for (const g of save.goals.list) {
    let hit = false;
    switch (g.type) {
      case 'smashKind': if (evt.type === 'smash' && evt.kind === g.kind) hit = bump(g, 1); break;
      case 'smashAny': if (evt.type === 'smash') hit = bump(g, 1); break;
      case 'frontFlips': if (evt.type === 'flip' && evt.dir === 'front') hit = bump(g, 1); break;
      case 'backFlips': if (evt.type === 'flip' && evt.dir === 'back') hit = bump(g, 1); break;
      case 'perfect': if (evt.type === 'land' && evt.quality === 'perfect') hit = bump(g, 1); break;
      case 'finishes': if (evt.type === 'finishLine') hit = bump(g, 1); break;
      case 'speed': if (evt.type === 'speed') hit = bump(g, Math.floor(evt.kmh || 0), 'max'); break;
      default: break;
    }
    if (hit) done.push(g);
  }
  return done;
}

// Single-run goals from the finish summary. Single-run progress shows the best attempt so far.
export function goalSummary(save, summary) {
  const done = [];
  for (const g of save.goals.list) {
    let hit = false;
    switch (g.type) {
      case 'speed': hit = bump(g, Math.floor(summary.maxSpeedKmh || 0), 'max'); break;
      case 'distance': hit = bump(g, Math.floor(summary.distance || 0), 'max'); break;
      case 'airTime': hit = bump(g, Math.round((summary.airTime || 0) * 10) / 10, 'max'); break;
      case 'flipsRun': hit = bump(g, summary.flips || 0, 'max'); break;
      case 'runCash': hit = bump(g, (summary.cash && summary.cash.total) || 0, 'max'); break;
      default: break;
    }
    if (hit) done.push(g);
  }
  return done;
}

// Pay out completed goals and roll replacements. Returns [{text, reward}].
export function claimGoals(save) {
  const claimed = [];
  save.goals.list = save.goals.list.filter((g) => {
    if (!g.done) return true;
    claimed.push({ text: goalText(g), reward: earn(save, g.reward) });
    return false;
  });
  ensureGoals(save);
  return claimed;
}
