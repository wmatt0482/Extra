// The eight stock companions (SPEC §3): a child picks three. Each has a hat (the crate cosmetics reuse the kinds: cap,
// wide, bonnet, straw, bowler, hood, kerchief, none), a colour (all eight differ) and a few lines: trail chatter, and
// one each for tired / happy. Warm and a little funny, never scary: nobody is ever sick or hurt, only tired.
// v1.2 (SPEC v1.2 §2): every companion has one `skill = { id, name, text }` the journey sim acts on (src/journey/sim.js,
// skills.js: skillOf(J, id) → the companion who has it). `text` is the one line the Outfit screen and the Wagon panel show;
// `id` is stable (the sim and the tests key on it), `name` is the badge on the card the app shows when the skill fires.
export const COMPANIONS = [
  { id: 'blacksmith', name: 'Ada', role: 'the blacksmith', hat: 'cap', color: '#d9534f',
    skill: { id: 'forge', name: 'Forge', text: 'Mends one wagon breakdown a leg without a spare part.' },
    lines: { trail: ['I can fix any wheel on this trail.', 'Hear that squeak? Needs grease.', 'Give me a hammer and a campfire and I can fix anything.'],
      tired: 'My arms are tired. A rest would help.', happy: 'Best wagon west of Missouri!' } },
  { id: 'teacher', name: 'Nora', role: 'the schoolteacher', hat: 'bowler', color: '#4a6fa5',
    skill: { id: 'tips', name: "Nora's tip", text: 'Shows the strategy hint before you answer, once a leg.' },
    lines: { trail: ['Spelling quiz while we walk! How do you spell prairie?', 'If we walk fifteen miles a day, how many days to the next fort? Think it over while we walk.', 'That cloud looks like a hat. Write it in your journal!'],
      tired: 'Even teachers need a recess.', happy: 'Gold star for everybody!' } },
  { id: 'fiddler', name: 'Jasper', role: 'the fiddler', hat: 'straw', color: '#8e5ea2',
    skill: { id: 'fiddle', name: 'Fiddle tunes', text: 'Four extra cheer points on a night at camp, and Quick Draw runs slower.' },
    lines: { trail: ['This song has forty-two verses. Want to hear them all?', 'The oxen walk faster when I play. I have tested it.', 'Clap along, and mind the bumps!'],
      tired: 'My fiddle needs a nap, and so do I.', happy: 'Time for a song around the fire!' } },
  { id: 'scout', name: 'Eli', role: 'the scout', hat: 'wide', color: '#5b8c5a',
    skill: { id: 'scouting', name: 'Scouting', text: 'Spots one more animal a leg, and sees the weather two days ahead.' },
    lines: { trail: ['The river is just past that rise.', 'Pronghorn, two o\'clock.', 'I will ride ahead and look for the easy way around.'],
      tired: 'Let\'s make camp early tonight.', happy: 'Clear skies all the way to the pass!' } },
  { id: 'cook', name: 'Rosa', role: 'the cook', hat: 'bonnet', color: '#f0a500',
    skill: { id: 'good-cooking', name: 'Good cooking', text: 'Food lasts a tenth longer, and wild berries turn up twice as often.' },
    lines: { trail: ['Beans and bacon tonight!', 'Who wants the last biscuit?', 'The secret ingredient is always more butter.'],
      tired: 'I could use a day by the fire.', happy: 'Berries for dessert!' } },
  { id: 'doctor', name: 'Mabel', role: 'the doctor', hat: 'hood', color: '#2a9d8f',
    skill: { id: 'peppermints', name: 'Peppermint drops', text: 'A tired friend is rested again in one day.' },
    lines: { trail: ['My medicine bag is mostly peppermint drops and good advice.', 'Drink some water and wear your hat. That is the whole secret.', 'I know every bird on this trail by its song.'],
      tired: 'Even the doctor needs a nap. Doctor\'s orders!', happy: 'Everyone is in fine shape. Peppermints all round!' } },
  { id: 'carpenter', name: 'Tomas', role: 'the carpenter', hat: 'kerchief', color: '#a0522d',
    skill: { id: 'carpentry', name: 'Carpentry', text: 'The raft is safe without rope, and every second repair needs no part.' },
    lines: { trail: ['Measure twice, cut once.', 'I could build a bridge, a barn, or a bench. Which one is it today?', 'Nice wagon. I would add a porch.'],
      tired: 'My saw is dull and so am I. Let\'s rest.', happy: 'Everything is level and square!' } },
  { id: 'storyteller', name: 'Ines', role: 'the storyteller', hat: 'none', color: '#c94f8a',
    skill: { id: 'tales', name: 'Tall tales', text: 'A campfire tale always brings a card, and a lookout brings two.' },
    lines: { trail: ['Did I ever tell you about the giant jackrabbit? No? Gather round.', 'Every rock out here has a story. Let me find this one\'s.', 'Once upon a time there was a wagon just like ours.'],
      tired: 'I am too sleepy to tell a story, and that never happens.', happy: 'This is the best chapter yet!' } },
];
export const COMPANION_BY_ID = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));
/** The skill ids, one per companion (the sim's keys). */
export const SKILL_BY_COMPANION = Object.fromEntries(COMPANIONS.map((c) => [c.id, c.skill.id]));
