// Achievements: 12 one-time badges, evaluated from live engine events, per-frame state, run
// summaries, and the save (own all cars). Earned badges live in save.achievements as
// {id: timestamp ms}; the caller persists after anything is earned (onEarn fires once per badge).

import { CARS } from '../data/cars.js';

export const RING_TARGET = 10;

export const ACHIEVEMENTS = [
  { id: 'firstFlip', name: 'Head Over Wheels', hint: 'Land your first flip', icon: 'flip', tone: 'cyan' },
  { id: 'firstPerfect', name: 'Butter', hint: 'Stick a perfect landing', icon: 'land', tone: 'go' },
  { id: 'tripleFlip', name: 'Triple Threat', hint: 'Do 3 flips in one flight', icon: 'flip', tone: 'violet' },
  { id: 'rampage', name: 'Rampage', hint: 'Reach the ×4 combo multiplier', icon: 'smash', tone: 'hot' },
  { id: 'firstBoom', name: 'Kaboom', hint: 'Blow up a fuel drum or TNT crate', icon: 'boom', tone: 'hot' },
  { id: 'chain3', name: 'Chain Reaction', hint: 'Set off 3 explosions in one chain', icon: 'boom', tone: 'gold' },
  { id: 'rings10', name: 'Ring Collector', hint: `Fly through ${RING_TARGET} gold rings`, icon: 'ring', tone: 'gold' },
  { id: 'orbit', name: 'Orbit', hint: 'Fly 45 m above the ground', icon: 'rocket', tone: 'violet' },
  { id: 'firstFinish', name: 'Checkered Flag', hint: 'Cross a finish line', icon: 'flag', tone: 'go' },
  { id: 'km', name: 'Kilometer Club', hint: 'Go 1,000 m in one run', icon: 'speed', tone: 'cyan' },
  { id: 'allCars', name: 'Full Garage', hint: `Own all ${CARS.length} cars`, icon: 'wrench', tone: 'gold' },
  { id: 'rankS', name: 'S Rank', hint: 'Earn an S rating on a run', icon: 'star', tone: 'gold' },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Progress hints for the counted badges ([value, target]) or null.
export function achievementProgress(save, id, live = 0) {
  if (id === 'rings10') return [Math.min(RING_TARGET, (save.records.rings || 0) + live), RING_TARGET];
  if (id === 'allCars') return [CARS.filter((c) => save.owned.includes(c.id)).length, CARS.length];
  return null;
}

export function createAchievements(save, { onEarn = () => {} } = {}) {
  if (!save.achievements || typeof save.achievements !== 'object') save.achievements = {};
  let run = null;

  function earn(id) {
    if (!ACH_BY_ID[id] || save.achievements[id]) return null;
    save.achievements[id] = Date.now();
    const a = ACH_BY_ID[id];
    try { onEarn(a); } catch (e) { console.error('[achievements] onEarn threw', e); }
    return a;
  }

  return {
    earn,
    isEarned: (id) => !!save.achievements[id],
    count: () => ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length,
    liveRings: () => (run ? run.rings : 0),

    beginRun() { run = { flightFlips: 0, rings: 0 }; },
    endRun() { run = null; },

    // Live engine event.
    event(evt) {
      if (!evt || !run) return;
      switch (evt.type) {
        case 'launch': case 'rejump': run.flightFlips = 0; break;
        case 'land':
          if (evt.quality === 'perfect') earn('firstPerfect');
          run.flightFlips = 0;
          break;
        case 'flip':
          run.flightFlips += 1;
          earn('firstFlip');
          if (run.flightFlips >= 3) earn('tripleFlip');
          break;
        case 'combo': if ((evt.mult || 0) >= 4) earn('rampage'); break;
        case 'explosion':
          earn('firstBoom');
          if ((evt.chain || 0) >= 2) earn('chain3');
          break;
        case 'airTarget':
          if (evt.kind === 'ring') {
            run.rings += 1;
            if ((save.records.rings || 0) + run.rings >= RING_TARGET) earn('rings10');
          }
          break;
        case 'orbit': earn('orbit'); break;
        case 'finishLine': earn('firstFinish'); break;
        default: break;
      }
    },

    // Per-frame engine state (cheap: only distance is looked at).
    state(s) {
      if (run && s && s.distance >= 1000) earn('km');
    },

    // Finished run (after bankRun, so records already include this run). rating: 'S'..'D'.
    summary(summary, rating) {
      const s = summary || {};
      if (s.flips > 0) earn('firstFlip');
      if (s.landing === 'perfect') earn('firstPerfect');
      if ((s.distance || 0) >= 1000) earn('km');
      if (s.finishCrossed) earn('firstFinish');
      if ((s.maxAltitude || 0) >= 45) earn('orbit');
      if ((s.explosions || 0) > 0) earn('firstBoom');
      if ((save.records.rings || 0) >= RING_TARGET) earn('rings10');
      if (rating === 'S') earn('rankS');
      this.checkSave();
    },

    // Save-derived badges (call after buying a car, and at boot).
    checkSave() {
      if (CARS.every((c) => save.owned.includes(c.id))) earn('allCars');
    },
  };
}
