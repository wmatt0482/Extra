// The rivals (SPEC v1.5 §5): eight named riders, each with a paint, a helmet, a taunt and a cheer, kid tone, never
// mean. Three are on the grid (the current rival trio); beating the trio's leader 3 times retires them to the Hall of
// Rivals and brings the next one in, one tier faster (the engine's race.skill steps up).
export const RIVALS = [
  { id: 'dusty', name: 'Dusty', paint: 'granite', helmet: 'classic', suit: 'rookie', taunt: "Let's see what you've got!", cheer: 'Whoa, nice driving!' },
  { id: 'blaze', name: 'Blaze', paint: 'orange', helmet: 'flames', suit: 'racer', taunt: 'Catch me if you can!', cheer: 'Nice flips!' },
  { id: 'nitro', name: 'Nitro', paint: 'lakeblue', helmet: 'lightning', suit: 'neon', taunt: "I'm all boost today!", cheer: 'That boost was huge!' },
  { id: 'zed', name: 'Zed', paint: 'black', helmet: 'skull', suit: 'camo', taunt: 'Night rider, coming through!', cheer: "You're quick!" },
  { id: 'ace', name: 'Ace', paint: 'gold', helmet: 'stripe', suit: 'checker', taunt: 'Ace is in the race!', cheer: 'Great race, champ!' },
  { id: 'vex', name: 'Vex', paint: 'purple', helmet: 'galaxy', suit: 'galaxy', taunt: 'Ready for a real race?', cheer: 'Okay, that was awesome.' },
  { id: 'storm', name: 'Storm', paint: 'sky', helmet: 'shark', suit: 'stars', taunt: "Here comes the storm!", cheer: 'You rode that like thunder!' },
  { id: 'nova', name: 'Nova', paint: 'snow', helmet: 'astronaut', suit: 'gold', taunt: 'To the stars and past you!', cheer: 'Out of this world!' },
];
export const RIVAL_BY_ID = Object.fromEntries(RIVALS.map((r) => [r.id, r]));
export const TRIO = 3;
export const BEATS_TO_RETIRE = 3;
export const defaultRivals = () => ({ retired: [], tier: 0, beats: {} });
/** The rival trio on the grid now: the first three not retired (leader first). */
export function rivalTrio(state) {
  const retired = new Set((state && state.retired) || []);
  const left = RIVALS.filter((r) => !retired.has(r.id));
  const trio = left.slice(0, TRIO);
  // all retired: the trio comes back as legends (the Hall of Rivals keeps them)
  return trio.length ? trio : RIVALS.slice(-TRIO);
}
/** A race ended: did the player beat the trio's leader? 3 beats retire the leader. Returns { beat, retired }. */
export function noteRivalRace(state, standings = []) {
  const trio = rivalTrio(state);
  const leader = trio[0];
  const me = standings.find((x) => x.me);
  const them = standings.find((x) => x.rivalId === leader.id || x.name === leader.name);
  const beat = !!(me && them && me.place < them.place);
  let retired = null;
  if (beat) {
    state.beats[leader.id] = (state.beats[leader.id] || 0) + 1;
    if (state.beats[leader.id] >= BEATS_TO_RETIRE && !state.retired.includes(leader.id)) {
      state.retired.push(leader.id);
      state.tier = (state.tier || 0) + 1;
      retired = leader;
    }
  }
  return { beat, retired, leader };
}
export function normalizeRivals(raw) {
  const s = defaultRivals();
  if (!raw || typeof raw !== 'object') return s;
  s.retired = (Array.isArray(raw.retired) ? raw.retired : []).filter((id) => RIVAL_BY_ID[id]);
  s.tier = Math.max(0, Math.min(RIVALS.length, Math.floor(Number(raw.tier) || 0)));
  if (raw.beats && typeof raw.beats === 'object') for (const [k, v] of Object.entries(raw.beats)) if (RIVAL_BY_ID[k]) s.beats[k] = Math.max(0, Math.floor(Number(v) || 0));
  return s;
}
