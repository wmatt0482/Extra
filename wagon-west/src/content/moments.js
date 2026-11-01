// The fixed lines of the dog, fetch, fishing 2.0 and the trail moments (SPEC v1.4 §2.3). Every entry is { text, say } (say =
// the spoken form: numbers in words, no abbreviations, no digits) except `fetch.treats`, a list of short lines with none.
// Spoken lines never contain the dog's name: a line that names the dog is a DOG_LINES template (below), prepared once the
// dog is named. Kid rules (SPEC §1): a muddy dog, a fish that wiggles off, a hat in the sagebrush are the worst that happens.
const L = (text, say) => ({ text, say: say || text });

export const MOMENTS = {
  snake: L('A rattlesnake is sunning on the trail! The wagon stops, everyone gives it room, and it slides away into the grass.'),
  chase: {
    good: L('Good dog! Straight back to the wagon.'),
    muddy: L('Back at last, and muddy from nose to tail!'),
    bath: L('A splash in the creek, and the dog is clean again.'),
  },
  fetch: {
    intro: L('Pull back the stick and let go to throw it.'),
    tired: L('Three throws! The dog flops down by the fire, happy.'),
    treats: ['One treat.', 'Two treats!', 'Three treats! What a throw!'],
  },
  hoppers: {
    intro: L('Grasshoppers in the grass! Tap them to catch bait for fishing.'),
    full: L('The bait tin is full.'),
  },
  fishing: {
    intro: L('Pick your bait, then cast the line. Tap when the bobber dips.'),
    hint: L('Hold to reel. Let go when the line shakes red.'),
    off: L('It wiggled off the hook! Cast again.'),
    swam: L('It swam off. Next cast!'),
    help: L('A big one! It takes two to land it.'),
    newSpecies: L('A new fish for the log!'),
    best: L('Your biggest fish yet!'),
    none: L('No bites this time. The river has more.'),
  },
  dustDevil: {
    intro: L('Whoosh! A dust devil spins across the trail, and the hats go flying! Tap the hats to catch them.'),
    all: L('Every hat caught! What a hat trick.'),
    some: L('The rest of the hats land in the sagebrush, dusty but fine.'),
  },
  stones: {
    intro: L('Smooth water and flat stones: time to skip stones! Tap to throw, then tap each time the stone touches the water.'),
    best: L('Your best skip yet!'),
  },
  meteors: {
    intro: L('Falling stars! Tap one and make a wish.'),
    end: L('The sky goes quiet. Sweet dreams.'),
  },
  dogOffer: L('A dog has been following the wagon since the ferry. Keep it?'),
};

// Templates with {dog}; prepared with the dog's name once it is named (SPEC v1.4 §5.6). No banned or weapon word.
export const DOG_LINES = {
  found: '{dog} found something!',
  snake: '{dog} stops short and barks and barks.',
  chase: '{dog} takes off after a jackrabbit! Tap the name to call {dog} back.',
  fetchFind: '{dog} brings back something that is not the stick!',
  grizzly: '{dog} gives one deep woof and sits close.',
  splash: '{dog} jumps in after the bobber! Splash! Cast again.',
  steal: '{dog} grabs a fish off the bank and runs, then brings it back, proud and wet.',
  help: '{dog} grabs the line with both paws!',
  hats: '{dog} brings back the hats from the sagebrush.',
  joins: '{dog} joins the party!',
};
