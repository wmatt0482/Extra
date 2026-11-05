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
export const WATERS = { 'kansas-river': 'kansas', 'alcove-spring': 'bigblue', 'fort-kearny': 'platte', 'ash-hollow': 'platte', 'chimney-rock': 'platte',
  'scotts-bluff': 'platte', 'fort-laramie': 'platte', 'north-platte': 'platte', 'independence-rock': 'sweetwater', 'ice-slough': 'sweetwater',
  'south-pass': 'sweetwater', 'green-river': 'green', 'fort-bridger': 'creek', 'soda-springs': 'bear', 'fort-hall': 'bear', 'snake-river': 'snake',
  'farewell-bend': 'snake', 'blue-mountains': 'blue', 'the-dalles': 'columbia', 'willamette-valley': 'columbia',
  // v1.5 branches: the cutoff's stop is the Green River; the Lander Road follows mountain creeks; the Barlow Road ends at Oregon City
  'sublette-cutoff': 'green', 'bear-river': 'bear', 'lander-road': 'creek', 'barlow-road': 'columbia',
  // v1.5 California Trail (trout in the cold creeks and the Humboldt and Truckee; salmon and sturgeon in the Sacramento)
  'raft-river': 'creek', 'city-of-rocks': 'creek', 'humboldt-wells': 'creek', 'humboldt-river': 'humboldt', 'big-meadows': 'humboldt',
  'forty-mile-desert': 'humboldt', 'truckee-river': 'truckee', 'sierra-summit': 'creek', 'sacramento-valley': 'sacramento',
  // v1.5 Gold Road (salmon in the big rivers, trout in the creeks)
  'calapooya-mountains': 'willamette', 'umpqua-river': 'umpqua', 'canyon-creek': 'creek', 'rogue-river': 'rogue', 'siskiyou-pass': 'creek',
  'mount-shasta': 'creek', 'castle-crags': 'sacramento', 'clear-creek': 'creek', 'feather-river': 'sacramento', 'sutters-fort': 'sacramento',
  'coloma': 'creek', 'home-by-sea': 'columbia' };
export const WATER_NAMES = { kansas: 'the Kansas River', platte: 'the Platte River', sweetwater: 'the Sweetwater River',
  creek: 'a cold mountain creek', bear: 'the Bear River', snake: 'the Snake River', blue: 'a Blue Mountains creek', columbia: 'the Columbia River',
  bigblue: 'the Big Blue River', green: 'the Green River', humboldt: 'the Humboldt River', truckee: 'the Truckee River',
  sacramento: 'the Sacramento River', willamette: 'the Willamette River', umpqua: 'the Umpqua River', rogue: 'the Rogue River' };
export const RIVER_STOPS = ['kansas-river', 'north-platte', 'green-river', 'sublette-cutoff', 'snake-river', 'the-dalles', 'humboldt-river', 'truckee-river',
  'umpqua-river', 'rogue-river', 'feather-river'];

export const FISH = [
  { id: 'channel-catfish', name: 'Channel catfish', emoji: '🐟', waters: { kansas: 1, platte: 1, bigblue: 1, sacramento: 0.4 },
    sizeIn: [12, 24], lb: [3, 6], fight: { reelS: 2.6, pullPerS: 0.10, wobbleEvery: [1.4, 2.2], wobbleS: 0.7 }, help: false,
    bait: { worms: 1, hoppers: 0.6, spoon: 0.4 , fatworms: 1.4, beetles: 0.5, crickets: 0.4, crawdads: 1.2 }, card: 'channel-catfish',
    land: { text: 'A channel catfish!', say: 'A channel catfish!' } },
  { id: 'hornyhead-chub', name: 'Hornyhead chub', emoji: '🐟', waters: { sweetwater: 1 }, sizeIn: [4, 8], lb: [2, 4],
    fight: { reelS: 1.4, pullPerS: 0.08, wobbleEvery: [1.6, 2.4], wobbleS: 0.6 }, help: false,
    bait: { worms: 1, hoppers: 1.2, spoon: 0.3 , fatworms: 0.8, beetles: 1.2, crickets: 1.7, crawdads: 0.5 }, card: 'hornyhead-chub',
    land: { text: 'A hornyhead chub!', say: 'A hornyhead chub!' } },
  { id: 'cutthroat-trout', name: 'Cutthroat trout', emoji: '🐟', waters: { creek: 1, bear: 1, snake: 0.6, green: 1, humboldt: 0.8, truckee: 1, willamette: 0.8, umpqua: 0.6, rogue: 0.3 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, help: false,
    bait: { worms: 0.7, hoppers: 1.2, spoon: 1 , fatworms: 0.5, beetles: 1.5, crickets: 0.6, crawdads: 0.6 }, card: 'cutthroat-trout',
    land: { text: 'A cutthroat trout!', say: 'A cutthroat trout!' } },
  { id: 'white-sturgeon', name: 'White sturgeon', emoji: '🐟', waters: { snake: 0.25, columbia: 0.05, sacramento: 0.05 }, sizeIn: [48, 84], lb: [12, 16],
    fight: { reelS: 6.0, pullPerS: 0.06, wobbleEvery: [1.6, 2.4], wobbleS: 0.8 }, help: true, onePerSession: true,
    bait: { worms: 1, hoppers: 0.5, spoon: 0.5 , fatworms: 1.2, beetles: 0.3, crickets: 0.2, crawdads: 0.8 }, card: 'white-sturgeon',
    land: { text: 'A white sturgeon! What a giant!', say: 'A white sturgeon! What a giant!' } },
  { id: 'redband-trout', name: 'Redband trout', emoji: '🐟', waters: { blue: 1 }, sizeIn: [8, 16], lb: [3, 5],
    fight: { reelS: 2.0, pullPerS: 0.12, wobbleEvery: [1.0, 1.6], wobbleS: 0.6 }, help: false,
    bait: { worms: 0.7, hoppers: 1.2, spoon: 1 , fatworms: 0.5, beetles: 1.5, crickets: 0.6, crawdads: 0.6 }, card: 'redband-trout',
    land: { text: 'A redband trout!', say: 'A redband trout!' } },
  { id: 'chinook-salmon', name: 'Chinook salmon', emoji: '🐟', waters: { columbia: 1, willamette: 0.5, umpqua: 0.8, rogue: 1, sacramento: 0.8 }, sizeIn: [24, 40], lb: [5, 8],
    fight: { reelS: 3.2, pullPerS: 0.12, wobbleEvery: [1.2, 1.8], wobbleS: 0.7 }, help: false,
    bait: { worms: 0.4, hoppers: 0.3, spoon: 1.2 , fatworms: 0.3, beetles: 0.3, crickets: 0.2, crawdads: 0.4 }, card: 'chinook-salmon',
    land: { text: 'A Chinook salmon!', say: 'A Chinook salmon!' } },
  // v1.7 (SPEC v1.7 §3): five more fish, each native to the waters named here (docs/SOURCES.md, "Fish of the trail"). No burbot: it is native
  // to the Wind and Bighorn drainages and the Kootenai, not to a river on the trail (it is an illegal introduction in the Green River).
  { id: 'mountain-whitefish', name: 'Mountain whitefish', emoji: '🐟', waters: { bear: 0.7, snake: 0.7, columbia: 0.5, willamette: 0.5, truckee: 0.6 },
    sizeIn: [10, 20], lb: [4, 5], fight: { reelS: 1.8, pullPerS: 0.10, wobbleEvery: [1.2, 1.9], wobbleS: 0.6 }, help: false,
    bait: { worms: 0.8, hoppers: 1.1, spoon: 0.5, fatworms: 0.9, beetles: 1.6, crickets: 0.7, crawdads: 0.5 }, card: 'mountain-whitefish',
    land: { text: 'A mountain whitefish!', say: 'A mountain whitefish!' } },
  { id: 'northern-pikeminnow', name: 'Northern pikeminnow', emoji: '🐟', waters: { columbia: 0.5, willamette: 0.4 },
    sizeIn: [10, 24], lb: [5, 6], fight: { reelS: 2.4, pullPerS: 0.11, wobbleEvery: [1.3, 2.0], wobbleS: 0.7 }, help: false,
    bait: { worms: 0.8, hoppers: 0.4, spoon: 0.8, fatworms: 0.8, beetles: 0.6, crickets: 0.5, crawdads: 1.8 }, card: 'northern-pikeminnow',
    land: { text: 'A northern pikeminnow!', say: 'A northern pikeminnow!' } },
  { id: 'largescale-sucker', name: 'Largescale sucker', emoji: '🐟', waters: { columbia: 0.35, willamette: 0.45 },
    sizeIn: [12, 24], lb: [4, 5], fight: { reelS: 2.2, pullPerS: 0.10, wobbleEvery: [1.5, 2.2], wobbleS: 0.7 }, help: false,
    bait: { worms: 1, hoppers: 0.3, spoon: 0.2, fatworms: 1.5, beetles: 0.6, crickets: 0.5, crawdads: 0.7 }, card: 'largescale-sucker',
    land: { text: 'A largescale sucker!', say: 'A largescale sucker!' } },
  { id: 'green-sunfish', name: 'Green sunfish', emoji: '🐟', waters: { kansas: 0.3, bigblue: 0.3, platte: 0.25 },
    sizeIn: [3, 8], lb: [3, 4], fight: { reelS: 1.2, pullPerS: 0.08, wobbleEvery: [1.6, 2.4], wobbleS: 0.6 }, help: false,
    bait: { worms: 1, hoppers: 1.2, spoon: 0.4, fatworms: 1, beetles: 1.4, crickets: 1.6, crawdads: 0.4 }, card: 'green-sunfish',
    land: { text: 'A green sunfish!', say: 'A green sunfish!' } },
  { id: 'sacramento-perch', name: 'Sacramento perch', emoji: '🐟', waters: { sacramento: 0.8 },
    sizeIn: [6, 12], lb: [4, 5], fight: { reelS: 1.6, pullPerS: 0.09, wobbleEvery: [1.4, 2.1], wobbleS: 0.6 }, help: false,
    bait: { worms: 1, hoppers: 1.1, spoon: 0.4, fatworms: 1, beetles: 1.2, crickets: 1.5, crawdads: 0.6 }, card: 'sacramento-perch',
    land: { text: 'A Sacramento perch!', say: 'A Sacramento perch!' } },
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
  // v1.7: critters from under the rocks (the rock-flip game). A tin of each holds at most `max`; one is used a cast; each has its own favourites
  // (the species' `bait` weights), so no bait is the best everywhere: fat worms for catfish and suckers, beetles for trout and whitefish and sunfish,
  // crickets for the quick-biting small fish, crawdads for the big hunters (pikeminnow, catfish).
  { id: 'fatworms', name: 'Fat worms', emoji: '🪱', text: 'Fat worms: catfish, suckers and sturgeon love them, and they bring bigger fish.',
    say: 'Fat worms: catfish, suckers and sturgeon love them, and they bring bigger fish.', max: 8, sizeBias: 0.12, rock: true, critter: 'worm' },
  { id: 'beetles', name: 'Beetles', emoji: '🪲', text: 'Beetles: trout, whitefish and sunfish rise for them.',
    say: 'Beetles: trout, whitefish and sunfish rise for them.', max: 8, sizeBias: 0.15, biteSooner: 0.34, rock: true, critter: 'beetle' },
  { id: 'crickets', name: 'Crickets', emoji: '🦗', text: 'Crickets: small fish bite sooner.',
    say: 'Crickets: small fish bite sooner.', max: 8, sizeBias: 0.08, biteSooner: 0.5, rock: true, critter: 'cricket' },
  { id: 'crawdads', name: 'Crawdads', emoji: '🦞', text: 'Crawdads: the big hunters of the river come for them.',
    say: 'Crawdads: the big hunters of the river come for them.', max: 8, sizeBias: 0.15, rock: true, critter: 'crawdad' },
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
  { id: 'bottle', name: 'A bottle with a note', emoji: '📜', waters: ['platte', 'sweetwater', 'creek', 'green'], quest: 'bottle-note',
    text: 'A glass bottle bobs up on the line, with a rolled-up note inside!',
    say: 'A glass bottle bobs up on the line, with a rolled-up note inside!' },
];
export const JUNK_BY_ID = Object.fromEntries(JUNK.map((j) => [j.id, j]));
