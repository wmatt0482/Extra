// Class lists (v3.7): the weekly spelling list from the class teacher, shipped inside the game for every family.
// A family whose active list is the built-in sample or a class list "follows the class lists": each new week applies
// on its own when the game starts (wordStore.js autoClassList); a family with a pasted list is never switched (Parents
// → Words → "Use for …" applies a class list by hand). Newest first.
//
// Adding a week (Matt): put one entry at the TOP of WEEKS with
//   id 'class-YYYY-MM-DD' (the Monday of the week; it is also the list's id on every device, so two devices that
//   apply the same week merge into one list), name 'Week of Mon D · topic', weekOf 'YYYY-MM-DD', pattern (optional:
//   one or more spelling patterns, prefixes like 'un-' or suffixes like '-tion'), and the words in the Parent Zone's
//   format, one per line: word | syl/la/bles | a sentence (≤ 200 characters).
// A week becomes "the newest" two days before its weekOf, so it can ship over the weekend.
import { normalizePattern, parseList } from '../spelling/words.js';
import { dayKey } from '../spelling/scheduler.js';

const WEEKS = [
  {
    id: 'class-2026-10-26',
    name: 'Week of Oct 26 · digraphs',
    weekOf: '2026-10-26',
    pattern: 'tch ch th sh wh ph',
    words: `
thirty | thir/ty | My aunt turned thirty last week.
width | width | Measure the width of the table.
fifth | fifth | She finished in fifth place.
choose | choose | You can choose any book you like.
touch | touch | Please don't touch the wet paint.
chef | chef | The chef made a giant pizza.
chance | chance | Give me one more chance to try.
pitcher | pitch/er | The pitcher threw a fast ball.
kitchen | kitch/en | We baked cookies in the kitchen.
snatch | snatch | The seagull tried to snatch my sandwich.
stretch | stretch | Stretch your legs before the race.
rush | rush | Don't rush, we have plenty of time.
whine | whine | The puppy began to whine at the door.
whirl | whirl | The leaves whirl in the wind.
graph | graph | We made a graph of our favorite fruits.
ground | ground | The ball rolled across the ground.
fall | fall | Leaves fall from the trees in October.
music | mu/sic | We played music at the party.
`,
  },
  {
    id: 'class-2026-10-19',
    name: 'Week of Oct 19 · prefixes',
    weekOf: '2026-10-19',
    pattern: 'un- re- im- in- pre- mis- dis- over-',
    words: `
unblock | un/block | Please unblock the door so we can get in.
unload | un/load | We unload the car after a long trip.
relearn | re/learn | I had to relearn the song after summer.
resell | re/sell | He will resell his old bike.
rewash | re/wash | Mom asked me to rewash the muddy dish.
imperfect | im/per/fect | The cookie was imperfect but still tasty.
indirect | in/di/rect | We took an indirect path to the park.
incorrect | in/cor/rect | My first answer was incorrect.
preheat | pre/heat | Preheat the oven before you bake.
preview | pre/view | We watched a preview of the movie.
misplace | mis/place | Try not to misplace your library book.
misbehave | mis/be/have | The puppy likes to misbehave at dinner.
displeased | dis/pleased | The coach was displeased with the late start.
dishonest | dis/hon/est | It is dishonest to copy someone's answers.
overheat | o/ver/heat | The engine can overheat on a hot day.
happened | hap/pened | Something funny happened at recess.
became | be/came | The caterpillar became a butterfly.
course | course | We ran the whole course in gym class.
`,
  },
];

export const CLASS_LISTS = WEEKS.map((w) => {
  const parsed = parseList(w.words);
  if (!parsed.ok) throw new Error(`class list ${w.id}: ${parsed.errors.join('; ')}`);
  return Object.freeze({ id: w.id, name: w.name, weekOf: w.weekOf, pattern: normalizePattern(w.pattern), words: parsed.words });
});
export const CLASS_LIST_BY_ID = Object.fromEntries(CLASS_LISTS.map((l) => [l.id, l]));

const DAY_MS = 86400000;
/** The newest class list whose week has started (or starts within 2 days), or null. */
export function newestClassList(now = Date.now()) {
  const limit = dayKey(now + 2 * DAY_MS);
  return CLASS_LISTS.filter((l) => l.weekOf <= limit).sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1))[0] || null;
}
