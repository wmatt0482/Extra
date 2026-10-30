// The eight stock companions (SPEC §3): a child picks three. Each has a hat (the crate cosmetics reuse the kinds), a
// colour and a few lines (trail chatter, and one each for tired / happy). Content stream fills all 8:
// blacksmith, teacher, fiddler, scout, cook, doctor, carpenter, storyteller.
export const COMPANIONS = [
  { id: 'blacksmith', name: 'Ada', role: 'the blacksmith', hat: 'cap', color: '#d9534f',
    lines: { trail: ['I can fix any wheel on this trail.', 'Hear that squeak? Needs grease.'], tired: 'My arms are tired. A rest would help.', happy: 'Best wagon west of Missouri!' } },
  { id: 'scout', name: 'Eli', role: 'the scout', hat: 'wide', color: '#5b8c5a',
    lines: { trail: ['The river is just past that rise.', 'Pronghorn, two o\'clock.'], tired: 'Let\'s make camp early tonight.', happy: 'Clear skies all the way to the pass!' } },
  { id: 'cook', name: 'Rosa', role: 'the cook', hat: 'bonnet', color: '#f0a500',
    lines: { trail: ['Beans and bacon tonight!', 'Who wants the last biscuit?'], tired: 'I could use a day by the fire.', happy: 'Berries for dessert!' } },
];
export const COMPANION_BY_ID = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));
