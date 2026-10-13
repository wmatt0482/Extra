// Daily challenge: one seeded run per local calendar day. The date string seeds everything, so every
// player gets the same car, track, terrain and goal on the same day. Pays once per day.

import { CARS } from '../data/cars.js';
import { TRACKS } from '../data/tracks.js';
import { UPGRADES } from '../data/upgrades.js';
import { hashString, mulberry32, pick } from './rng.js';

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function msUntilReset(d = new Date()) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next - d;
}

const GOALS = [
  { type: 'distance', make: (r, t) => Math.round((t.finish * pick(r, [0.5, 0.6, 0.7, 0.8])) / 10) * 10,
    text: (n) => `Reach ${n} m`, check: (s, n) => (s.distance || 0) >= n, value: (s) => Math.floor(s.distance || 0), unit: 'm' },
  { type: 'backFlips', make: (r) => pick(r, [2, 3, 4]),
    text: (n) => `Do ${n} back flips in one run`, check: (s, n) => (s.backFlips || 0) >= n, value: (s) => s.backFlips || 0, unit: '' },
  { type: 'frontFlips', make: (r) => pick(r, [2, 3, 4]),
    text: (n) => `Do ${n} front flips in one run`, check: (s, n) => (s.frontFlips || 0) >= n, value: (s) => s.frontFlips || 0, unit: '' },
  { type: 'smashed', make: (r) => pick(r, [8, 10, 12, 15]),
    text: (n) => `Smash ${n} props in one run`, check: (s, n) => (s.smashed || 0) >= n, value: (s) => s.smashed || 0, unit: '' },
  { type: 'speed', make: (r) => pick(r, [110, 120, 130, 140]),
    text: (n) => `Hit ${n} km/h`, check: (s, n) => (s.maxSpeedKmh || 0) >= n, value: (s) => Math.floor(s.maxSpeedKmh || 0), unit: 'km/h' },
  { type: 'airTime', make: (r) => pick(r, [3, 4, 5]),
    text: (n) => `Stay airborne ${n} s`, check: (s, n) => (s.airTime || 0) >= n, value: (s) => Math.round((s.airTime || 0) * 10) / 10, unit: 's' },
];

export function dailyFor(dateKey = todayKey()) {
  const seed = hashString('daily:' + dateKey);
  const r = mulberry32(seed);
  const track = pick(r, TRACKS);
  const car = pick(r, CARS);
  const g = pick(r, GOALS);
  const target = g.make(r, track);
  const loanLevel = 3 + Math.floor(r() * 3); // loaner car comes pre-tuned (3..5 on every upgrade)
  const levels = Object.fromEntries(UPGRADES.map((u) => [u.id, loanLevel]));
  const ti = TRACKS.indexOf(track);
  const reward = Math.round((600 + ti * 450 + car.tier * 150) / 50) * 50;
  return {
    date: dateKey, seed, trackId: track.id, carId: car.id, levels, loanLevel,
    goal: { type: g.type, target, text: g.text(target), unit: g.unit },
    reward,
    check: (summary) => g.check(summary, target),
    value: (summary) => g.value(summary),
  };
}

// Reset the per-day state when the calendar day rolls over.
export function refreshDaily(save, dateKey = todayKey()) {
  if (save.daily.date !== dateKey) save.daily = { date: dateKey, done: false, attempts: 0 };
  return save.daily;
}
