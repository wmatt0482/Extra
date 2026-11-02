// The six choice moments (The Lab, lab/SPEC.md §4.4; Wagon West v1.6): two on each route, small decisions at a stop that bear on the leg
// that follows. Each has a person who says one true line per way, and two equal buttons; BOTH WAYS ARRIVE, neither is a mistake, nothing is
// hidden and nothing is locked behind a score. The numbers (miles, the chance of a soaked sack, the guide's fee, the spirit) are the journey's,
// in src/journey/choices.js; this file is the words and the places. `who` is a stock person of src/content/people.js (the panel shows their
// portrait, name and role); the lines are advice in their voices, as everywhere in the game: they claim nothing the sources do not (the miles
// a shortcut saves are never read aloud, SOURCES.md "Things we deliberately did not say"), and none holds a digit.
//
//   { id, route: 'emigrant' | 'california' | 'gold-road', at: legId, kind: 'shortcut' | 'guide', who: personId, question,
//     options: [{ id: 'a', name, line: { text, say } }, { id: 'b', name, line }] }
// `at` is the stop where the question is asked (the arrival, after any fork and before the stop's other scenes); it settles the leg that follows.
const line = (text, say) => ({ text, say: say || text });

export const CHOICES = [
  // ---- the emigrant trail (it is also the first fifteen legs of the California Trail) ----
  { id: 'ash-creek', route: 'emigrant', at: 'ash-hollow', kind: 'shortcut', who: 'wendell', question: 'How do you leave Ash Hollow?', options: [
    { id: 'a', name: 'Stay on the road', line: line('The wagon road leads on along the river, worn smooth by the wagons that came before you.') },
    { id: 'b', name: 'Cut across the creek bottom', line: line('A path across the creek bottom is shorter, but the ground is soft and wet, and a splash could soak a sack of flour.') },
  ] },
  { id: 'ice-guide', route: 'emigrant', at: 'ice-slough', kind: 'guide', who: 'pascal', question: 'High, dry country ahead. Hire a guide?', options: [
    { id: 'a', name: 'Go on your own', line: line('Many parties found the way themselves, following the wagon ruts that were there before them.') },
    { id: 'b', name: 'Pay a guide', line: line('Some parties paid a guide who knew where the water and the grass were, and the party traveled easier.') },
  ] },
  // ---- the California Trail ----
  { id: 'humboldt-bends', route: 'california', at: 'humboldt-river', kind: 'shortcut', who: 'tad', question: 'The river bends back and forth. What now?', options: [
    { id: 'a', name: 'Stay on the trail', line: line('The trail follows the river, bend after bend, with water and grass all the way.') },
    { id: 'b', name: 'Cut across the bends', line: line('Cutting across the bends saves steps, but the low ground is soft and wet, and a splash could soak a sack of flour.') },
  ] },
  { id: 'meadows-guide', route: 'california', at: 'big-meadows', kind: 'guide', who: 'pascal', question: 'The desert is next. Hire a guide?', options: [
    { id: 'a', name: 'Go on your own', line: line('Wagon parties filled every barrel before they set out for the other side of the desert.') },
    { id: 'b', name: 'Pay a guide', line: line('A guide who knows the desert helps the party keep its water and its spirits up.') },
  ] },
  // ---- the Gold Road ----
  { id: 'rogue-bar', route: 'gold-road', at: 'rogue-river', kind: 'shortcut', who: 'ned', question: 'How do you cross the Rogue River?', options: [
    { id: 'a', name: 'The usual ford', line: line('Most travelers cross where the water is shallow, the way everyone does.') },
    { id: 'b', name: 'Cross at the gravel bar', line: line('A gravel bar is a shorter way across, but the stones are slippery, and a splash could soak a sack of flour.') },
  ] },
  { id: 'siskiyou-packer', route: 'gold-road', at: 'siskiyou-pass', kind: 'guide', who: 'calvin', question: 'The pass is narrow. Hire a packer?', options: [
    { id: 'a', name: 'Go on your own', line: line('The pass is narrow and steep, but wagons have crossed it in the years of the gold rush.') },
    { id: 'b', name: 'Hire a packer', line: line('A pack-train driver who knows the pass can lead the way, and the party travels easier.') },
  ] },
];
export const CHOICE_BY_ID = Object.fromEntries(CHOICES.map((c) => [c.id, c]));

/** What the child sees and hears once a way is taken (the journey's numbers decide which line; `text` is shown, `say` is read). */
export const CHOICE_LINES = {
  a: line('You stay on the trail, and the wagon rolls on.'),
  shortcutDry: line('Across the soft ground and out the other side: a day saved on the trail!'),
  shortcutSoaked: line('Splash! A sack of flour got soaked, but the wagon is a day ahead.'),
  guide: line('The guide knows the way: a day saved, and everyone is cheerful.'),
  /** "The guide asks two dollars." (the fee in words is made at run time: see feeSay) */
  feeAsk: 'The guide asks',
  cash: line('The cash box is a little short for a guide right now. The other way is open.'),
  later: 'Decide later',
};
/** The question for the card's header and its spoken form ("Pay a guide, two dollars."): the fee is the journey's. */
export const feeText = (fee) => `$${fee}`;
export const feeLine = (fee, words) => ({ text: `${CHOICE_LINES.feeAsk} $${fee}.`, say: `${CHOICE_LINES.feeAsk} ${words}.` });
