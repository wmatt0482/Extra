# Wagon West backlog (parked ideas)

Ideas Matt parked for later. Nothing here is scheduled; each line notes what already exists so the next build starts
from the right place.

## Parked Nov 4, 2026 (fishing and finds): all five DONE in Wagon West 1.7 (SPEC v1.7)

- [x] **The fishing rod bends.** DONE (1.7): the rod is a curve with a spring in `src/scene/fishing2.js`: a gentle bend at
  rest, deep while reeling (more for a bigger fish), a tremble on the yellow, a hard quiver on the red, a spring back
  when the fish lands or wiggles off; the line runs from the bent tip.
- [x] **Flip rocks to find bugs for bait.** DONE (1.7): "Flip rocks" at camp and at the river stops
  (`src/journey/rocks.js`, `src/scene/rocks17.js`); worms, beetles, crickets and crawdads become four new baits in
  `src/content/fish.js` BAITS, each with its own fish, and no bait is best everywhere.
- [x] **More kinds of fish.** DONE (1.7): mountain whitefish, northern pikeminnow, largescale sucker, green sunfish and
  Sacramento perch, each only where it is native (`docs/SOURCES.md`). Burbot was checked and left out (it is native to
  none of the trail's rivers); bluegill was not added (its native range on the Platte was not checked; the green sunfish
  stands in for the plains' sunfish).
- [x] **A bear comes and scares the fish.** DONE (1.7): about one session in eight, never twice in a row; far bank
  only; wait for it to leave or try another spot (`src/journey/fishing.js` `planBear`, `src/scene/fishing2.js`).
- [x] **Finding arrowheads when you…** DONE (1.7), built as "now and then a flipped rock hides a stone arrowhead": the
  existing find, sketched in the journal and left where it lay, counted on the Finds page. (The owner's note was cut
  off; if it was meant to end differently, say how.)
