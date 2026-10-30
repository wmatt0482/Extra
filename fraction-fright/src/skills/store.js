// A player's fraction skills (SPEC §6, §9): `fractionFright.<id>.skills`. Pure functions over a plain object; the save
// module reads / writes it and the sync registers it as the `fracs` kind (src/skills/sync.js).
//   { v, updatedAt, xp,
//     lab: { done: at | 0, runs },                 the Zombie Lab (required once, replayable)
//     opened: { T2: at },                          streets opened (an opened street is never closed again)
//     records: { 'T1.bounce': [[at, pae, code]] }, per tier + kind, the last 12 throws (code b / h / n / m)
//     fracs: { '3/4': { n, hits, bulls, pae, last } }   per fraction: throws, hits, bulls, PAE sum, last throw at
//     days: { 'YYYY-MM-DD': { throws, hits, bulls, pae, secure } }   the last 90 days (the Report's week and its charts;
//                                                   secure = streets secure at the day's last throw, v1.5)
//     waves: [{ at, street, number, cured, reached, throws, hits, bulls, pae, stopped? }]   the last 40 waves
//     moves: [{ at, tier, from, to }]               tier state changes (the Report's "moved up")
//     opts: { aloud, updatedAt }, pace: { think (s, an EMA of the think time per throw), n, updatedAt } (§16), resetAt? }
// Accuracy, never speed, is recorded (SPEC §0): no times are kept.
import { PLAYABLE, TIER_BY_ID, closeText, isHit, parseFrac } from './items.js';
import { RECORD_KEPT, STATES, ladderView, reviewTierOf, tierState, tierStats } from './ladder.js';
import { updateThink } from './pace.js';

export const SKILLS_VERSION = 1;
export const skillsKey = (playerId) => `fractionFright.${playerId}.skills`;
export const DAYS_KEPT = 90;      // v1.5: 90 (was 21) for the Parent Zone charts
export const WAVES_KEPT = 40;
export const MOVES_KEPT = 20;
export const LAB_XP = 100;
export const XP_FOR = Object.freeze({ bull: 3, hit: 2, near: 1, miss: 1 });
const CODES = { bull: 'b', hit: 'h', near: 'n', miss: 'm' };
// 'seen': a throw at a zombie that had stepped out of the fog (SPEC §13.1): recorded, never counted toward secure
const KINDS = ['bounce', 'locate', 'seen', 'compare', 'equivalent', 'sum', 'decimal'];

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const r1 = (x) => Math.round(num(x) * 10) / 10;
const pad = (n) => String(n).padStart(2, '0');
/** The local calendar day of a time ('2026-10-26'). */
export const dayKey = (ms) => { const t = new Date(ms); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const DAY_RE = /^\d{4}-\d\d-\d\d$/;

export function defaultSkills() {
  return { v: SKILLS_VERSION, updatedAt: 0, xp: 0, lab: { done: 0, runs: 0 }, opened: {}, records: {}, fracs: {}, days: {}, waves: [], moves: [], opts: { aloud: true, updatedAt: 0 }, pace: { think: 0, n: 0, updatedAt: 0 } };
}

/** Coerce whatever was read into valid skills (unknown fields dropped, lists capped). */
export function normalizeSkills(raw) {
  const d = defaultSkills();
  if (!raw || typeof raw !== 'object') return d;
  d.updatedAt = Math.max(0, num(raw.updatedAt));
  d.xp = Math.max(0, Math.floor(num(raw.xp)));
  const lab = raw.lab && typeof raw.lab === 'object' ? raw.lab : {};
  d.lab = { done: Math.max(0, num(lab.done)), runs: Math.max(0, Math.floor(num(lab.runs))) };
  if (raw.opened && typeof raw.opened === 'object') for (const [t, at] of Object.entries(raw.opened)) if (PLAYABLE.includes(t) && num(at) > 0) d.opened[t] = num(at);
  if (raw.records && typeof raw.records === 'object') {
    for (const [key, list] of Object.entries(raw.records)) {
      const [t, kind] = key.split('.');
      if (!TIER_BY_ID[t] || !KINDS.includes(kind) || !Array.isArray(list)) continue;
      const ok = list.filter((x) => Array.isArray(x) && num(x[0]) > 0 && Number.isFinite(x[1]) && ['b', 'h', 'n', 'm'].includes(x[2]))
        .map((x) => [num(x[0]), Math.max(0, Math.min(100, r1(x[1]))), x[2]]).sort((a, b) => a[0] - b[0]).slice(-RECORD_KEPT);
      if (ok.length) d.records[key] = ok;
    }
  }
  if (raw.fracs && typeof raw.fracs === 'object') {
    for (const [k, v] of Object.entries(raw.fracs)) {
      if (!parseFrac(k) || !v || typeof v !== 'object') continue;
      const n = Math.max(0, Math.floor(num(v.n)));
      if (!n) continue;
      d.fracs[k] = { n, hits: Math.min(n, Math.max(0, Math.floor(num(v.hits)))), bulls: Math.min(n, Math.max(0, Math.floor(num(v.bulls)))), pae: Math.max(0, r1(v.pae)), last: Math.max(0, num(v.last)) };
    }
  }
  if (raw.days && typeof raw.days === 'object') {
    for (const [k, v] of Object.entries(raw.days).sort().slice(-DAYS_KEPT)) {
      if (!DAY_RE.test(k) || !v || typeof v !== 'object') continue;
      const throws = Math.max(0, Math.floor(num(v.throws)));
      d.days[k] = { throws, hits: Math.min(throws, Math.max(0, Math.floor(num(v.hits)))), bulls: Math.min(throws, Math.max(0, Math.floor(num(v.bulls)))), pae: Math.max(0, r1(v.pae)) };
      if (num(v.secure) > 0) d.days[k].secure = Math.max(0, Math.floor(num(v.secure)));
    }
  }
  if (Array.isArray(raw.waves)) {
    d.waves = raw.waves.filter((w) => w && typeof w === 'object' && num(w.at) > 0).map((w) => {
      const x = { at: num(w.at), street: String(w.street || '').slice(0, 16), number: Math.max(1, Math.min(5, Math.floor(num(w.number, 1)))) };
      for (const k of ['cured', 'reached', 'throws', 'hits', 'bulls']) x[k] = Math.max(0, Math.floor(num(w[k])));
      x.pae = Math.max(0, r1(w.pae));
      if (w.stopped) x.stopped = true;
      return x;
    }).sort((a, b) => a.at - b.at).slice(-WAVES_KEPT);
  }
  if (Array.isArray(raw.moves)) {
    d.moves = raw.moves.filter((m) => m && num(m.at) > 0 && TIER_BY_ID[m.tier] && STATES.includes(m.from) && STATES.includes(m.to))
      .map((m) => ({ at: num(m.at), tier: m.tier, from: m.from, to: m.to })).sort((a, b) => a.at - b.at).slice(-MOVES_KEPT);
  }
  const o = raw.opts && typeof raw.opts === 'object' ? raw.opts : {};
  d.opts = { aloud: typeof o.aloud === 'boolean' ? o.aloud : true, updatedAt: Math.max(0, num(o.updatedAt)) };
  const pc = raw.pace && typeof raw.pace === 'object' ? raw.pace : {};
  d.pace = { think: Math.max(0, Math.min(40, r1(num(pc.think)))), n: Math.max(0, Math.floor(num(pc.n))), updatedAt: Math.max(0, num(pc.updatedAt)) };
  if (num(raw.resetAt) > 0) d.resetAt = num(raw.resetAt);
  return d;
}

const rank = (st) => STATES.indexOf(st);
/** Open every street whose street before works (kept open from then on). */
function openStreets(d, now) {
  const opened = [];
  for (let i = 1; i < PLAYABLE.length; i++) {
    const t = PLAYABLE[i];
    if (!d.opened[t] && d.lab.done && rank(tierState(d, PLAYABLE[i - 1])) >= rank('working')) { d.opened[t] = now; opened.push(t); }
  }
  return opened;
}

/**
 * One throw: { tier, kind, show, pae, result, at, seen }. A seen throw (the zombie was out of the fog) is kept under
 * kind 'seen', which the ladder's secure rule ignores. Updates the records, the fraction's stats, the day, the XP, the
 * tier state (a move up or back is logged) and the streets that open. → { before, after, movedUp, opened, xp }.
 */
export function recordThrow(d, { tier, kind = 'locate', show = '', pae = 0, result = 'miss', at = Date.now(), seen = false }) {
  if (!TIER_BY_ID[tier]) return { before: 'new', after: 'new', movedUp: false, opened: [], xp: 0 };
  const before = tierState(d, tier);
  const key = `${tier}.${seen ? 'seen' : KINDS.includes(kind) ? kind : 'locate'}`;
  const code = CODES[result] || 'm';
  const p = Math.max(0, Math.min(100, r1(pae)));
  d.records[key] = [...(d.records[key] || []), [at, p, code]].slice(-RECORD_KEPT);
  if (parseFrac(show)) {
    const f = d.fracs[show] || { n: 0, hits: 0, bulls: 0, pae: 0, last: 0 };
    d.fracs[show] = { n: f.n + 1, hits: f.hits + (isHit(result) ? 1 : 0), bulls: f.bulls + (result === 'bull' ? 1 : 0), pae: r1(f.pae + p), last: at };
  }
  const k = dayKey(at);
  const day = d.days[k] || { throws: 0, hits: 0, bulls: 0, pae: 0 };
  const xp = XP_FOR[result] || 1;
  d.xp += xp;
  const after = tierState(d, tier);
  d.days[k] = { throws: day.throws + 1, hits: day.hits + (isHit(result) ? 1 : 0), bulls: day.bulls + (result === 'bull' ? 1 : 0), pae: r1(day.pae + p), secure: secureCount(d) };
  const keys = Object.keys(d.days).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - DAYS_KEPT))) delete d.days[old];
  if (after !== before) d.moves = [...d.moves, { at, tier, from: before, to: after }].slice(-MOVES_KEPT);
  const opened = openStreets(d, at);
  d.updatedAt = at;
  return { before, after, movedUp: rank(after) > rank(before), opened, xp };
}

/** Streets secure now (the ladder's state), for the day log. */
export const secureCount = (d) => PLAYABLE.filter((t) => tierState(d, t) === 'secure').length;
/**
 * v1.5: the chart's data for the last n days: { days, throws, hitPct, bullPct, pae (mean), secure (carried across days
 * without play once logged) } from the day log.
 */
export function progressSeries(d, now = Date.now(), n = 28) {
  const days = [];
  const t = new Date(now); t.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) days.push(dayKey(t.getTime() - i * 86400000));
  const log = d.days || {};
  const firstLog = Object.keys(log).filter((k) => log[k].secure != null).sort()[0] || '';
  const secure = days.map((day) => (log[day] && log[day].secure != null ? log[day].secure : null));
  for (let i = 1; i < secure.length; i++) if (secure[i] == null && secure[i - 1] != null && firstLog && days[i] >= firstLog) secure[i] = secure[i - 1];
  const at = (day, f) => (log[day] ? log[day][f] : 0);
  return { days, throws: days.map((day) => at(day, 'throws')),
    hitPct: days.map((day) => (at(day, 'throws') > 0 ? Math.round((100 * at(day, 'hits')) / at(day, 'throws')) : null)),
    bullPct: days.map((day) => (at(day, 'throws') > 0 ? Math.round((100 * at(day, 'bulls')) / at(day, 'throws')) : null)),
    pae: days.map((day) => (at(day, 'throws') > 0 ? Math.round((10 * at(day, 'pae')) / at(day, 'throws')) / 10 : null)),
    secure, streets: PLAYABLE.length };
}

/** The Zombie Lab finished: +100 XP the first time, Maple Street opens. → { first, xp }. */
export function finishLab(d, at = Date.now()) {
  const first = !d.lab.done;
  d.lab = { done: d.lab.done || at, runs: d.lab.runs + 1 };
  if (first) d.xp += LAB_XP;
  openStreets(d, at);
  d.updatedAt = at;
  return { first, xp: first ? LAB_XP : 0 };
}

/** A wave ended (stopped early too: nothing is lost by stopping). */
/** §16: one measured think time (seconds from the call to the throw) folded into the player's pace record. */
export function notePace(d, seconds, at = Date.now()) {
  d.pace = updateThink(d.pace, seconds, at);
  d.updatedAt = Math.max(d.updatedAt, at);
  return d.pace;
}
export function noteWave(d, w) {
  const x = normalizeSkills({ waves: [w] }).waves[0];
  if (!x) return;
  d.waves = [...d.waves, x].slice(-WAVES_KEPT);
  d.updatedAt = Math.max(d.updatedAt, x.at);
}

/** Back to the start (Parents → Players): the options stay; resetAt makes the reset win the sync merge. */
export function resetSkills(d, at = Date.now()) {
  const opts = { ...d.opts };
  for (const k of Object.keys(d)) delete d[k];
  Object.assign(d, defaultSkills(), { opts, resetAt: at, updatedAt: at });
  return d;
}

/** The kid's level from XP (shown on the title and the picker): 1 + one level per 250 XP. */
export const levelFor = (xp) => 1 + Math.floor(Math.max(0, num(xp)) / 250);

const meanPae = (f) => (f.n ? f.pae / f.n : null);
/** The Report's data. */
export function report(d, now = Date.now()) {
  const tiers = ladderView(d).map((t) => ({ ...t, stats: t.playable ? tierStats(d, t.id) : null }));
  const fr = Object.entries(d.fracs).map(([show, f]) => ({ show, n: f.n, hits: f.hits, bulls: f.bulls, mean: meanPae(f) }));
  const ranked = fr.filter((x) => x.n >= 2).sort((a, b) => a.mean - b.mean);
  const weekAgo = now - 7 * 86400000;
  return {
    tiers, xp: d.xp, lab: d.lab,
    // the closest half (up to 4) and the trickiest of the rest (up to 4, trickiest first)
    closest: ranked.slice(0, Math.min(4, Math.ceil(ranked.length / 2))), hardest: ranked.slice(Math.min(4, Math.ceil(ranked.length / 2))).slice(-4).reverse(),
    waves: d.waves.filter((w) => w.at >= weekAgo),
    moves: d.moves.filter((m) => m.at >= now - 14 * 86400000),
    fractions: fr.length,
  };
}
const STATE_WORD = { new: 'not started', practice: 'practicing', working: 'working', secure: 'secure', later: 'coming later' };
export const stateWord = (st) => STATE_WORD[st] || st;
export const moveText = (m) => `${TIER_BY_ID[m.tier].name}: ${stateWord(m.from)} → ${stateWord(m.to)}`;
/** The plain-text report (Copy report). */
export function reportText(d, name, now = Date.now()) {
  const r = report(d, now);
  const lines = [`Fraction Fright report for ${name} (${new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`];
  lines.push(`Zombie Lab: ${r.lab.done ? `done (${r.lab.runs} time${r.lab.runs === 1 ? '' : 's'})` : 'not done yet'} · ${r.xp} XP`);
  lines.push('', 'Streets');
  for (const t of r.tiers.filter((x) => x.playable)) {
    const s = t.stats;
    lines.push(`${t.name} (${t.what}): ${stateWord(t.state)}${s.n ? ` · last ${s.n} throws: ${Math.round(s.rate * 100)} % on target, ${closeText(s.pae)} on average` : ''}`);
  }
  if (r.closest.length) lines.push('', `Closest: ${r.closest.map((x) => `${x.show} (${closeText(x.mean)})`).join(', ')}`);
  if (r.hardest.length) lines.push(`Still tricky: ${r.hardest.map((x) => `${x.show} (${closeText(x.mean)})`).join(', ')}`);
  if (r.moves.length) lines.push('', 'Moved', ...r.moves.map(moveText));
  if (r.waves.length) lines.push('', "This week's waves", ...r.waves.map((w) => `${new Date(w.at).toLocaleDateString('en-US', { weekday: 'short' })} ${streetName(w.street)} wave ${w.number}: ${w.cured} cured, ${w.hits} of ${w.throws} throws on target${w.stopped ? ' (stopped early)' : ''}`));
  return lines.join('\n');
}
const streetName = (id) => (Object.values(TIER_BY_ID).find((t) => t.street === id) || { name: id }).name;
export { reviewTierOf };
