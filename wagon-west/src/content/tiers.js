// The three tiers (SPEC v1.5 §2.6): the names and the words. The numbers are the journey's (journey/economy.js TIER_FX, §3.2).
// `legacy` is the 1.3 season id the tier replaces (an old J.season 's1850' is a Veteran journey); `opens` says how a locked
// tier is earned (Trail Blazer's cups pattern: a trophy opens the next cup, and Rookie never closes). Kid rules: the harder
// tiers change prices, weather and rewards, never a fail state.
export const TIERS = [
  { id: 'rookie', name: 'Rookie', emoji: '🌱', legacy: 's1847', blurb: 'The trail as it is: fair prices, kind weather.', trophy: 'bronze' },
  { id: 'veteran', name: 'Veteran', emoji: '🧭', legacy: 's1850', blurb: 'Less cash, more storms and broken wheels, and more cards and gold.', trophy: 'silver', opens: 'Finish any journey.' },
  { id: 'pioneer', name: 'Pioneer', emoji: '⛰️', legacy: 's1853', blurb: 'A lean purse, snow on every mountain, and the biggest rewards.', trophy: 'gold', opens: 'Finish a Veteran journey.' },
];
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));
