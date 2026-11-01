// Fishing 2.0 (SPEC v1.4 §2.2): the rivers, the fish, the bait and the junk. Pure data; journey/fishing.js plans a session from
// it (species drawn by FISH[].waters[water] x the bait's weight; sizes with the bait's sizeBias) and the scene plays the fight.
//
// WATERS: leg id -> water id (the fishing on that leg); WATER_NAMES: water id -> what the summary card calls it. RIVER_STOPS:
// where the skipping stones are offered after the crossing. No trout is native to the Platte drainage (docs/SOURCES.md,
// "Fish of the trail"), so the trout start west of South Pass.
// FISH: `sizeIn` the inches the fish log shows and `lb` the food from one catch are game numbers, not facts read aloud;
// `fight` is the reel (journey/fishing.js createFight / fightStep: reelS seconds of holding to land it, pullPerS the progress it
// takes back while you let go, the line wobbles red every wobbleEvery seconds for wobbleS seconds); `help: true` = it takes two
// to land it (the sturgeon, once a session); `bait` = the weight of each bait; `card` = the species' card (cards.js, suit river);
// `land` = the card shown when it is landed. Every line is kid-safe: a fish that wiggles off is simply cast again.
export const WATERS = { 'kansas-river': 'kansas', 'fort-kearny': 'platte', 'chimney-rock': 'platte', 'fort-laramie': 'platte',
  'independence-rock': 'sweetwater', 'south-pass': 'sweetwater', 'fort-bridger': 'creek', 'fort-hall': 'bear', 'snake-river': 'snake',
  'blue-mountains': 'blue', 'the-dalles': 'columbia', 'willamette-valley': 'columbia' };
export const WATER_NAMES = { kansas: 'the Kansas River', platte: 'the Platte River', sweetwater: 'the Sweetwater River',
  creek: 'a cold mountain creek', bear: 'the Bear River', snake: 'the Snake River', blue: 'a Blue Mountains creek', columbia: 'the Columbia River' };
export const RIVER_STOPS = ['kansas-river', 'snake-river', 'the-dalles'];

export const FISH = [
  { id: 'channel-catfish', name: 'Channel catfish', emoji: '🐟', waters: { kansas: 1, platte: 1 },
    sizeIn: [12, 24], lb: [3, 6], fight: { reelS: 2.6, pullPerS: 0.10, wobbleEvery: [1.4, 2.2], wobbleS: 0.7 }, help: false,
    bait: { worms: 1, hoppers: 0.6, spoon: 0.4 }, card: 'channel-catfish',
    land: { text: 'A channel catfish!', say: 'A channel catfish!' } },
  { id: 'hornyhead-chub', name: 'Hornyhead chub', emoji: '🐟', waters: { sweetwater: 1 }, sizeIn: [4, 8], lb: [2, 4],
    fight: { reelS: 1.4, pullPerS: 0.08, wobbleEvery: [1.6, 2.4], wobbleS: 0.6 }, help: false,
    bait: { worms: 1, hoppers: 1.2, spoon: 0.3 }, card: 'hornyhead-chub',
    land: { text: 'A hornyhead chub!', say: 'A hornyhead chub!' } },
  { id: 'cutthroat-trout', name: 'Cutthroat trout', emoji: '🐟', waters: { creek: 1, bear: 1, snake: 0.6 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, help: false,
    bait: { worms: 0.7, hoppers: 1.2, spoon: 1 }, card: 'cutthroat-trout',
    land: { text: 'A cutthroat trout!', say: 'A cutthroat trout!' } },
  { id: 'white-sturgeon', name: 'White sturgeon', emoji: '🐟', waters: { snake: 0.25, columbia: 0.05 }, sizeIn: [48, 84], lb: [12, 16],
    fight: { reelS: 6.0, pullPerS: 0.06, wobbleEvery: [1.6, 2.4], wobbleS: 0.8 }, help: true, onePerSession: true,
    bait: { worms: 1, hoppers: 0.5, spoon: 0.5 }, card: 'white-sturgeon',
    land: { text: 'A white sturgeon! What a giant!', say: 'A white sturgeon! What a giant!' } },
  { id: 'redband-trout', name: 'Redband trout', emoji: '🐟', waters: { blue: 1 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, help: false,
    bait: { worms: 0.7, hoppers: 1.2, spoon: 1 }, card: 'redband-trout',
    land: { text: 'A redband trout!', say: 'A redband trout!' } },
  { id: 'chinook-salmon', name: 'Chinook salmon', emoji: '🐟', waters: { columbia: 1 }, sizeIn: [24, 40], lb: [5, 8],
    fight: { reelS: 3.2, pullPerS: 0.12, wobbleEvery: [1.2, 1.8], wobbleS: 0.7 }, help: false,
    bait: { worms: 0.4, hoppers: 0.3, spoon: 1.2 }, card: 'chinook-salmon',
    land: { text: 'A Chinook salmon!', say: 'A Chinook salmon!' } },
];
export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));

// Bait: worms (the default, never run out); grasshoppers (caught at camp, up to `max` in the tin, one used a cast: fish bite
// `biteSooner` sooner and run `sizeBias` bigger); the shiny spoon (bought once or found, never used up).
export const BAITS = [
  { id: 'worms', name: 'Worms', emoji: '🪱', text: 'Worms: the fish always like them.', say: 'Worms: the fish always like them.', unlimited: true },
  { id: 'hoppers', name: 'Grasshoppers', emoji: '🦗', text: 'Grasshoppers: trout and chubs bite sooner, and bigger ones.',
    say: 'Grasshoppers: trout and chubs bite sooner, and bigger ones.', max: 12, sizeBias: 0.15, biteSooner: 0.3 },
  { id: 'spoon', name: 'Shiny spoon', emoji: '🥄', text: 'The shiny spoon: big salmon and trout chase it.',
    say: 'The shiny spoon: big salmon and trout chase it.', keep: true, sizeBias: 0.25 },
];
export const BAIT_BY_ID = Object.fromEntries(BAITS.map((b) => [b.id, b]));

// Junk (10 % a cast): reels in with no wobbles. `waters: null` = any water; `release` = you let it go; `quest` = starts that quest
// (quests.js) while it is still to find this season.
export const JUNK = [
  { id: 'boot', name: 'An old boot', emoji: '🥾', waters: null,
    text: 'An old boot! Somebody walked on with one wet sock.', say: 'An old boot! Somebody walked on with one wet sock.' },
  { id: 'turtle', name: 'A snapping turtle', emoji: '🐢', waters: ['kansas', 'platte'], release: true,
    text: 'A snapping turtle on the line! It snaps at the air, so you let it go, and it paddles off with a splash.',
    say: 'A snapping turtle on the line! It snaps at the air, so you let it go, and it paddles off with a splash.',
    source: 'SOURCES.md#junk-snapping-turtle' },
  { id: 'bottle', name: 'A bottle with a note', emoji: '📜', waters: ['platte', 'sweetwater', 'creek'], quest: 'bottle-note',
    text: 'A glass bottle bobs up on the line, with a rolled-up note inside!',
    say: 'A glass bottle bobs up on the line, with a rolled-up note inside!' },
];
export const JUNK_BY_ID = Object.fromEntries(JUNK.map((j) => [j.id, j]));
