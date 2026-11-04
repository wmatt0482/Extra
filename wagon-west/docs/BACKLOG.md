# Wagon West backlog (parked ideas)

Ideas Matt parked for later. Nothing here is scheduled; each line notes what already exists so the next build starts
from the right place.

## Parked Nov 4, 2026 (fishing and finds)

- **The fishing rod bends.** The rod should flex with the fight: a deeper bend when reeling, a wobble when the line
  goes yellow or red. Today the rod is a straight line in `src/scene/fishing2.js`.
- **Flip rocks to find bugs for bait.** A new way to get bait: tap rocks by the water to flip them and find worms,
  beetles or crickets. Today bait comes from worms (always there), grasshoppers caught at camp, and the store spoon
  (`src/content/fish.js` BAITS).
- **More kinds of fish.** Six species today: channel catfish, hornyhead chub, cutthroat trout, white sturgeon,
  redband trout, chinook salmon (`src/content/fish.js`). Candidates to source by river: northern pike-minnow, mountain
  whitefish, burbot, bluegill (check which are native to each river, as v1.4 did for the Platte).
- **A bear comes and scares the fish.** A bear wanders to the far bank while fishing; the fish scatter and the child
  waits or moves spots. Kid rules (SPEC §1): at a distance, nothing scary up close, nobody hurt. A grizzly already
  appears on a ridge as a trail fact (`src/content/trailFacts.js`, `src/scene/ambient.js`); this would bring a bear
  into the fishing scene.
- **Finding arrowheads when you…** (the note was cut off; ask Matt how the sentence ends). Today an arrowhead is one
  of Frodo's finds, sketched in the journal and left where it lay (`src/content/finds.js`).
