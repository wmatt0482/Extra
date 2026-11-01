// Test-only stand-ins for the v1.4 content tables (SPEC v1.4 §2: finds, fish, quests, trailFacts), for a worktree where the Content stream's
// files are not there yet. Import this module FIRST (`await import('./v14-stubs.mjs')`) and then import the journey with a dynamic import:
// it registers a module-loader hook that answers `.../content/<name>.js` with the stub below ONLY when that file does not exist on disk,
// so once src/content/finds.js etc. are merged the real tables are used and this file does nothing. The stubs follow the §2 shapes (the
// tables copied from the spec, the lines shortened); nothing here is ever written into src/content/. `stubbed` lists what was replaced.
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/content/', import.meta.url));

const FINDS_SRC = `
export const FINDS = [
  { id: 'horseshoe', name: 'An old horseshoe', emoji: '🐴', keep: 'keep', goods: 'horseshoes', biomes: null, weight: 3, text: 'An old horseshoe!', say: 'An old horseshoe!' },
  { id: 'ox-shoe', name: 'A tiny ox shoe', emoji: '🐂', keep: 'keep', biomes: ['prairie', 'bluffs', 'highdesert', 'mountains'], weight: 2, text: 'A tiny iron ox shoe.' },
  { id: 'magpie-feather', name: 'A magpie feather', emoji: '🪶', keep: 'keep', biomes: ['bluffs', 'highdesert', 'mountains'], weight: 2, text: 'A magpie feather.' },
  { id: 'hawk-feather', name: 'A hawk feather', emoji: '🪶', keep: 'keep', biomes: ['prairie', 'bluffs', 'highdesert'], weight: 2, text: 'A hawk feather.' },
  { id: 'arrowhead', name: 'A stone arrowhead', emoji: '🔺', keep: 'sketch', biomes: ['prairie', 'bluffs', 'highdesert'], weight: 1, text: 'A stone arrowhead, left where it lay.' },
  { id: 'buffalo-chip', name: 'A buffalo chip', emoji: '🟤', keep: 'use', effect: { spirit: 5 }, biomes: ['prairie', 'bluffs'], weight: 2, text: 'A dried buffalo chip.' },
  { id: 'flat-stone', name: 'A flat skipping stone', emoji: '🪨', keep: 'keep', effect: { skips: 2 }, biomes: null, weight: 2, text: 'A perfect flat stone.' },
  { id: 'pinecone', name: 'A pinecone', emoji: '🌲', keep: 'keep', biomes: ['mountains', 'gorge', 'valley'], weight: 2, text: 'A big, sticky pinecone.' },
  { id: 'spoon', name: 'A shiny fishing spoon', emoji: '🥄', keep: 'bait', goods: 'spoon', biomes: null, weight: 0.3, rare: true, text: 'A shiny fishing spoon!' },
];
export const FIND_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));
export const WISHES = ['oxen-fly', 'bison-dance', 'pie-rain', 'wagon-sing', 'dog-talk', 'moon-cheese', 'frog-hat', 'cloud-bed', 'river-slide', 'star-soup', 'horse-wings', 'sunny-snow']
  .map((id) => ({ id, text: 'I wish for ' + id.replace(/-/g, ' ') + '.', say: 'I wish for ' + id.replace(/-/g, ' ') + '.' }));
export const WISH_BY_ID = Object.fromEntries(WISHES.map((w) => [w.id, w]));
`;

const FISH_SRC = `
export const WATERS = { 'kansas-river': 'kansas', 'fort-kearny': 'platte', 'chimney-rock': 'platte', 'fort-laramie': 'platte',
  'independence-rock': 'sweetwater', 'south-pass': 'sweetwater', 'fort-bridger': 'creek', 'fort-hall': 'bear', 'snake-river': 'snake',
  'blue-mountains': 'blue', 'the-dalles': 'columbia', 'willamette-valley': 'columbia' };
export const WATER_NAMES = { kansas: 'the Kansas River', platte: 'the Platte River', sweetwater: 'the Sweetwater River',
  creek: 'a cold mountain creek', bear: 'the Bear River', snake: 'the Snake River', blue: 'a Blue Mountains creek', columbia: 'the Columbia River' };
export const RIVER_STOPS = ['kansas-river', 'snake-river', 'the-dalles'];
const land = (n) => ({ text: n + '!', say: n + '!' });
export const FISH = [
  { id: 'channel-catfish', name: 'Channel catfish', emoji: '🐟', waters: { kansas: 1, platte: 1 }, sizeIn: [12, 24], lb: [3, 6],
    fight: { reelS: 2.6, pullPerS: 0.10, wobbleEvery: [1.4, 2.2], wobbleS: 0.7 }, help: false, bait: { worms: 1, hoppers: 0.6, spoon: 0.4 }, card: 'channel-catfish', land: land('A channel catfish') },
  { id: 'hornyhead-chub', name: 'Hornyhead chub', emoji: '🐟', waters: { sweetwater: 1 }, sizeIn: [4, 8], lb: [2, 4],
    fight: { reelS: 1.4, pullPerS: 0.08, wobbleEvery: [1.6, 2.4], wobbleS: 0.6 }, help: false, bait: { worms: 1, hoppers: 1.2, spoon: 0.3 }, card: 'hornyhead-chub', land: land('A hornyhead chub') },
  { id: 'cutthroat-trout', name: 'Cutthroat trout', emoji: '🐟', waters: { creek: 1, bear: 1, snake: 0.6 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, help: false, bait: { worms: 0.7, hoppers: 1.2, spoon: 1 }, card: 'cutthroat-trout', land: land('A cutthroat trout') },
  { id: 'white-sturgeon', name: 'White sturgeon', emoji: '🐟', waters: { snake: 0.25, columbia: 0.05 }, sizeIn: [48, 84], lb: [12, 16],
    fight: { reelS: 6.0, pullPerS: 0.06, wobbleEvery: [1.6, 2.4], wobbleS: 0.8 }, help: true, onePerSession: true, bait: { worms: 1, hoppers: 0.5, spoon: 0.5 }, card: 'white-sturgeon', land: land('A white sturgeon') },
  { id: 'redband-trout', name: 'Redband trout', emoji: '🐟', waters: { blue: 1 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, help: false, bait: { worms: 0.7, hoppers: 1.2, spoon: 1 }, card: 'redband-trout', land: land('A redband trout') },
  { id: 'chinook-salmon', name: 'Chinook salmon', emoji: '🐟', waters: { columbia: 1 }, sizeIn: [24, 40], lb: [5, 8],
    fight: { reelS: 3.2, pullPerS: 0.12, wobbleEvery: [1.2, 1.8], wobbleS: 0.7 }, help: false, bait: { worms: 0.4, hoppers: 0.3, spoon: 1.2 }, card: 'chinook-salmon', land: land('A Chinook salmon') },
];
export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));
export const BAITS = [
  { id: 'worms', name: 'Worms', emoji: '🪱', text: 'Worms: the fish always like them.', unlimited: true },
  { id: 'hoppers', name: 'Grasshoppers', emoji: '🦗', text: 'Grasshoppers.', max: 12, sizeBias: 0.15, biteSooner: 0.3 },
  { id: 'spoon', name: 'Shiny spoon', emoji: '🥄', text: 'The shiny spoon.', keep: true, sizeBias: 0.25 },
];
export const BAIT_BY_ID = Object.fromEntries(BAITS.map((b) => [b.id, b]));
export const JUNK = [
  { id: 'boot', name: 'An old boot', emoji: '🥾', waters: null, text: 'An old boot!', say: 'An old boot!' },
  { id: 'turtle', name: 'A snapping turtle', emoji: '🐢', waters: ['kansas', 'platte'], release: true, text: 'A snapping turtle on the line!' },
  { id: 'bottle', name: 'A bottle with a note', emoji: '📜', waters: ['platte', 'sweetwater', 'creek'], quest: 'bottle-note', text: 'A glass bottle bobs up on the line!' },
];
export const JUNK_BY_ID = Object.fromEntries(JUNK.map((j) => [j.id, j]));
`;

const QUESTS_SRC = `
const P = (id, name) => ({ id, name, emoji: '🙂', role: 'a traveler' });
export const QUESTS = [
  { id: 'locket', name: 'The missing locket', card: 'locket', letter: 'quest-locket',
    item: { id: 'locket', name: 'A silver locket', emoji: '📿', text: 'A little silver locket.' },
    find: { via: 'nose', legs: ['kansas-river', 'fort-kearny', 'chimney-rock'], atStop: 'kansas-river' },
    steps: [{ at: 'fort-kearny', person: P('q-platt', 'Mrs. Platt'), lines: ['Molly camped here.', 'Maybe you will find them at Fort Laramie.'] },
            { at: 'chimney-rock', person: P('q-josh', 'Josh'), lines: ['Molly Rowe? She dropped her locket.', 'Her family waits at Fort Laramie.'] }],
    owner: { at: 'fort-laramie', person: P('q-molly', 'Molly Rowe'), lines: ['My locket!', 'Please take these dried apples.'] },
    reward: { tokens: 1, food: { what: 'dried apples', lb: 10 } },
    mailed: { text: 'The post office sends the locket ahead to Fort Laramie, with a note for Molly.' } },
  { id: 'bottle-note', name: 'The bottle note', card: 'marble', letter: 'quest-note',
    item: { id: 'bottle-note', name: 'A note in a bottle', emoji: '📜', text: 'Hello! My name is Sam.' },
    find: { via: 'fish', legs: ['fort-laramie', 'independence-rock', 'south-pass', 'fort-bridger'] },
    steps: [{ at: 'fort-bridger', person: P('q-ruby', 'Ruby'), lines: ['Sam? He rolled on west.', 'He dropped a bottle in the river.'] },
            { at: 'fort-hall', person: P('q-pete', 'Mr. Pete'), lines: ['Sam played his harmonica.', 'His family went toward The Dalles.'] }],
    owner: { at: 'the-dalles', person: P('q-sam', 'Sam'), lines: ['You found my bottle?', 'Here is my best marble.'] },
    reward: { tokens: 1 }, mailed: { text: 'The post office sends the note on to The Dalles, with a hello for Sam.' } },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
`;

const FACTS_SRC = `
const F = (id, far, legs, when, ambient, sound, title) => ({ id, far, legs, when, ambient, sound, card: id, source: 'SOURCES.md#fact-' + id, title, text: title + '.', say: title + '.' });
export const TRAIL_FACTS = [
  F('far-off-crack', true, ['fort-kearny', 'chimney-rock', 'fort-laramie'], 'day', 'crack', 'crack', 'Far-off rifles'),
  F('bison-thunder', false, null, 'stampede', null, 'rumble', 'Bison thunder'),
  F('grizzly-ridge', true, ['south-pass', 'fort-bridger', 'fort-hall'], 'day', 'grizzly', 'wind', 'A grizzly on the ridge'),
  F('wolf-song', true, ['fort-kearny', 'chimney-rock', 'fort-laramie', 'independence-rock'], 'night', 'wolves', 'howl', 'Wolves singing'),
  F('prairie-glow', true, ['kansas-river', 'fort-kearny'], 'night', 'fireglow', 'wind', 'A glow on the prairie'),
  F('pronghorn-race', false, ['chimney-rock', 'fort-laramie', 'independence-rock', 'south-pass', 'fort-hall', 'snake-river'], 'day', 'pronghorn', 'hooves', 'A pronghorn race'),
];
export const TRAIL_FACT_BY_ID = Object.fromEntries(TRAIL_FACTS.map((f) => [f.id, f]));
`;

const SOURCES = { finds: FINDS_SRC, fish: FISH_SRC, quests: QUESTS_SRC, trailFacts: FACTS_SRC };
/** The content files that were not on disk and are answered by a stub here (empty once the Content stream's files are merged). */
export const stubbed = Object.keys(SOURCES).filter((k) => !existsSync(dir + k + '.js'));

const HOOKS = `
let table = {};
export function initialize(d) { table = d || {}; }
export async function resolve(spec, ctx, next) {
  const m = /\\/content\\/(finds|fish|quests|trailFacts)\\.js$/.exec(spec);
  if (m && table[m[1]]) return { url: 'wwstub:' + m[1], shortCircuit: true };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.startsWith('wwstub:')) return { format: 'module', source: table[url.slice(7)], shortCircuit: true };
  return next(url, ctx);
}
`;
if (stubbed.length) {
  register('data:text/javascript,' + encodeURIComponent(HOOKS), import.meta.url, { data: Object.fromEntries(stubbed.map((k) => [k, SOURCES[k]])) });
  console.log(`(v14-stubs: src/content/{${stubbed.join(', ')}}.js not found; using the test stand-ins from tools/v14-stubs.mjs)`);
}
