// Classroom subscriptions (v4.1; class lists since v3.7): the weekly spelling list from each child's class teacher, shipped
// inside the game for every family. Each child subscribes to ONE classroom (Parents -> Words -> Classroom, a synced per-child
// option `classroom`: 'labue' | 'lombardi' | null; null = custom words). A subscribed child gets that classroom's newest week
// on its own when the game starts / comes back to the front / once an hour (wordStore.js autoClassList). Custom words never switch.
//
// Adding a week (Matt): put one entry at the TOP of the right classroom's `weeks` (CLASSROOM_DEFS below) with
//   id 'class-YYYY-MM-DD' for Miss LaBue (her four old ids keep that form) or '<classroom>-YYYY-MM-DD' for the others, e.g.
//   'lombardi-2026-11-16' (the Monday of the week; it is also the list's id on every device, so two devices that apply the
//   same week merge into one list), name 'Week of Mon D · topic', weekOf 'YYYY-MM-DD', pattern (optional: one or more
//   spelling patterns, prefixes like 'un-' or suffixes like '-tion'), and the words in the Parent Zone's format, one per
//   line: word | syl/la/bles | a sentence (<= 200 characters).
// A week becomes "the newest" two days before its weekOf, so it can ship over the weekend.
// Adding a classroom: one more entry in CLASSROOM_DEFS with a short lowercase id and a name.
import { normalizePattern, parseList } from '../spelling/words.js';
import { dayKey } from '../spelling/scheduler.js';

const LABUE_WEEKS = [
  {
    id: 'class-2026-11-16',
    name: 'Week of Nov 16 · er, ir and ur',
    weekOf: '2026-11-16',
    pattern: 'er ir ur',
    words: `
person | per/son | Each person in line gets one ticket.
sternly | stern/ly | The coach spoke sternly when we forgot our gear.
worse | worse | The rain got worse, so we stayed inside.
pearl | pearl | The shiny pearl came from an oyster.
dirt | dirt | The dog dug a hole in the dirt.
birth | birth | My family celebrates the day of my birth every June.
shirt | shirt | I spilled juice on my clean shirt.
purse | purse | Grandma keeps her keys in her purse.
curl | curl | The cat likes to curl up by the fire.
curve | curve | Slow down when the road starts to curve.
hurl | hurl | The pitcher will hurl the ball toward home plate.
turkey | tur/key | We ate turkey and stuffing at Thanksgiving.
blurred | blurred | The picture was blurred because the camera moved.
guard | guard | The guard checked our tickets at the gate.
argue | ar/gue | Let's not argue about whose turn it is.
even | e/ven | Two, four and six are even numbers.
item | i/tem | Pick one item from the prize box.
evil | e/vil | The evil wizard in the story turned the frog green.
`,
  },
  {
    id: 'class-2026-11-09',
    name: 'Week of Nov 9 · ar and or',
    weekOf: '2026-11-09',
    pattern: 'ar or',
    words: `
dart | dart | The puppy likes to dart across the yard after the ball.
guard | guard | A crossing guard helps us cross the busy street.
award | a/ward | Our class won an award for the best science project.
backyard | back/yard | We built a snow fort in the backyard.
argue | ar/gue | My brother and I sometimes argue about who goes first.
spark | spark | A spark flew up from the campfire.
smart | smart | It was smart to bring an umbrella on a rainy day.
fort | fort | We made a blanket fort in the living room.
morning | morn/ing | I eat breakfast every morning before school.
cord | cord | Plug the cord into the wall to charge the tablet.
worn | worn | My old sneakers are worn out from running.
stormy | storm/y | It was too stormy to play outside today.
door | door | Please close the door when you come inside.
screech | screech | The bus brakes made a loud screech at the stop sign.
throat | throat | The singer drank water to rest her throat.
ready | read/y | Are you ready to go to the park?
side | side | The cat sleeps on the side of my bed.
change | change | The leaves change color in the fall.
`,
  },
  {
    id: 'class-2026-11-02',
    name: 'Week of Nov 2 · three-letter blends',
    weekOf: '2026-11-02',
    pattern: 'shr scr str spr thr',
    words: `
shred | shred | Dad will shred the old papers before recycling them.
shrimp | shrimp | We ate shrimp at the beach last summer.
shrink | shrink | Wool sweaters can shrink in a hot wash.
script | script | The actors read the script for the school play.
screw | screw | Turn the screw until the shelf is tight.
straps | straps | Pull the straps tight on your backpack.
strand | strand | A strand of hair fell across her face.
sprout | sprout | The bean seeds began to sprout in the garden.
sprawl | sprawl | The cat likes to sprawl across the couch.
thrill | thrill | The roller coaster ride was a thrill.
throb | throb | My thumb began to throb after I bumped it.
throat | throat | Warm tea helps a scratchy throat.
thrift | thrift | We found a cool jacket at the thrift store.
through | through | The train went through a long tunnel.
screech | screech | The owl let out a loud screech at night.
talk | talk | We can talk about it after lunch.
start | start | The race will start when the whistle blows.
stop | stop | Please stop at the corner and look both ways.
`,
  },
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

// Mr. Lombardi (Gabe's class). Newest week first; ids 'lombardi-YYYY-MM-DD'.
const LOMBARDI_WEEKS = [
  {
    id: 'lombardi-2026-11-16',
    name: 'Week of Nov 16 · vocabulary',
    weekOf: '2026-11-16',
    pattern: '',
    words: `
brittle | brit/tle | Dry leaves are brittle and crunch when you step on them.
creative | cre/a/tive | Maya made a creative costume out of cardboard boxes.
descriptive | de/scrip/tive | Use descriptive words to tell how the beach looked and sounded.
outstretched | out/stretched | The bird glided with its wings outstretched.
`,
  },
];

// Miss LaBue (Nathan's class) and Mr. Lombardi (Gabe's class). Newest week first.
const CLASSROOM_DEFS = [
  { id: 'labue', name: 'Miss LaBue', weeks: LABUE_WEEKS },
  { id: 'lombardi', name: 'Mr. Lombardi', weeks: LOMBARDI_WEEKS },
];

function buildWeek(classroom, w) {
  const parsed = parseList(w.words);
  if (!parsed.ok) throw new Error(`class list ${w.id}: ${parsed.errors.join('; ')}`);
  return Object.freeze({ id: w.id, name: w.name, weekOf: w.weekOf, pattern: normalizePattern(w.pattern), words: parsed.words, classroom });
}
const byNewest = (a, b) => (a.weekOf < b.weekOf ? 1 : a.weekOf > b.weekOf ? -1 : 0);

export const CLASSROOMS = Object.freeze(CLASSROOM_DEFS.map((c) =>
  Object.freeze({ id: c.id, name: c.name, weeks: Object.freeze(c.weeks.map((w) => buildWeek(c.id, w)).sort(byNewest)) })));
export const CLASSROOM_IDS = Object.freeze(CLASSROOMS.map((c) => c.id));
export const classroomById = (id) => CLASSROOMS.find((c) => c.id === id) || null;

/** Every week of every classroom, newest first (each tagged with its `classroom`). */
export const CLASS_LISTS = CLASSROOMS.flatMap((c) => c.weeks).sort(byNewest);
export const CLASS_LIST_BY_ID = Object.fromEntries(CLASS_LISTS.map((l) => [l.id, l]));

const DAY_MS = 86400000;
/** The newest class list of a classroom whose week has started (or starts within 2 days), or null (an unknown classroom,
 *  or none yet). Without a classroomId: the newest of all classrooms. */
export function newestClassList(now = Date.now(), classroomId = null) {
  const limit = dayKey(now + 2 * DAY_MS);
  const pool = classroomId ? (classroomById(classroomId) || { weeks: [] }).weeks : CLASS_LISTS;
  return pool.filter((l) => l.weekOf <= limit).sort(byNewest)[0] || null;
}
