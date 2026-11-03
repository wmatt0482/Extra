// The weekly family goals (lab/SPEC.md §2.6). PURE DATA: no imports.
// `field` = the weekly counter summed over the family (core/family.js weekNumbers); `perPlayer` x contributors, rounded to `step`.
// perPlayer was tuned with tools/economy-sim.mjs --calibrate (a family of three, 12 weeks) so a goal is met in roughly 70 % of the weeks; the spec's first numbers (250 / 30 / 120 / 6 / 8 / 300) were out of reach.
// `games` = the goal is only offered when someone played one of these games in the last 14 days (null = always).
// `contrib`: 'games' = the target counts the players who played one of `games` on at least two of the last 14 days (a habit, not one visit); 'all' = every player.
export const FAMILY_GOALS = [
  { id: 'zap', field: 'zap', perPlayer: 40, step: 10, games: ['ff'], contrib: 'games', text: 'Our family zapped {n} zombies', gentle: 'Our family helped {n} neighbors home' },
  { id: 'race', field: 'race', perPlayer: 15, step: 5, games: ['tb'], contrib: 'games', text: 'Our family finished {n} races', gentle: 'Our family finished {n} races' },
  { id: 'word', field: 'word', perPlayer: 70, step: 10, games: ['sj', 'ww'], contrib: 'games', text: 'Our family spelled {n} words', gentle: 'Our family spelled {n} words' },
  { id: 'leg', field: 'leg', perPlayer: 6, step: 1, games: ['ww'], contrib: 'games', text: 'Our wagons rolled through {n} legs of the trail', gentle: 'Our wagons rolled through {n} legs of the trail' },
  { id: 'job', field: 'job', perPlayer: 8, step: 1, games: ['bc'], contrib: 'games', text: 'Our family finished {n} building jobs', gentle: 'Our family finished {n} building jobs' },
  { id: 'ft', field: 'ft', perPlayer: 150, step: 10, games: null, contrib: 'all', text: 'Our family got {n} answers right on the first try', gentle: 'Our family got {n} answers right on the first try' },
  { id: 'explore', field: 'explore', perPlayer: 3, step: 1, games: null, contrib: 'all', minPlayers: 2, text: 'Everyone in our family tried {n} different games', gentle: 'Everyone in our family tried {n} different games' },
];
export const GOAL_CLAIM_WINDOW = 4;          // this week's goal and the three before stay claimable
export const FAMILY_BANNERS = ['home.banner.f1', 'home.banner.f2', 'home.banner.f3', 'home.banner.f4', 'home.banner.f5', 'home.banner.f6'];
export const GOAL_COINS_AFTER_ALL = 600;
