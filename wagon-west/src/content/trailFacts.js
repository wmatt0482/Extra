// Trail facts (SPEC v1.4 §2.5, the owner's addition): about once a leg, on a quiet day, a short vignette plays on the scene
// with a sound, then a card with one true, kid-level fact (and its own card for the album's "Trail tales" suit). Each is heard
// once a season and sourced in docs/SOURCES.md (anchor `fact-<id>`). The `title` and `text` below are VERBATIM from the spec.
//
//   { id, far, legs, when, ambient, sound, card, source, title, text, say }
//   far      true = turned off by the Parent Zone's "Far-off sounds on the trail" switch (default on)
//   legs     the legs it can happen on (null = after a stampede; the journey's stampedeFact asks for it)
//   when     'day' | 'night' (a night fact asks the app for a dusk sky) | 'stampede'
//   ambient  the scene's vignette kind (null = none: the stampede game is the scene)     sound  the sound effect name
//   say      the spoken form (no digit appears in any of the six, so it equals `text`)
//
// The one allowance of SPEC v1.4 §1.7: the fact `far-off-crack` (and its card) carries the two exact phrases the audits allow,
// the title and one sentence of the text, as a sound at a distance with the party safe. No other string in the game names it.
// The ids, the vignette and the sound are 'crack' words only, and nobody is drawn with anything.
export const TRAIL_FACTS = [
  { id: 'far-off-crack', far: true, legs: ['fort-kearny', 'chimney-rock', 'fort-laramie'], when: 'day', ambient: 'crack', sound: 'crack',
    card: 'far-off-crack', source: 'SOURCES.md#fact-far-off-crack', title: 'Far-off rifles',
    text: 'Crack! Crack! The far-off crack of rifles beyond the ridge. The wagon is safe and rolls on. Travelers and traders on this trail hunted bison for meat, and sometimes just for sport, and they often took far more than they could use.',
    say: 'Crack! Crack! The far-off crack of rifles beyond the ridge. The wagon is safe and rolls on. Travelers and traders on this trail hunted bison for meat, and sometimes just for sport, and they often took far more than they could use.' },
  { id: 'bison-thunder', far: false, legs: null, when: 'stampede', ambient: null, sound: 'rumble', card: 'bison-thunder', source: 'SOURCES.md#fact-bison-thunder',
    title: 'Bison thunder',
    text: 'A running bison herd makes the ground rumble like thunder. Along the Platte, bison herds numbered in the thousands, and one traveler wrote that they were thicker than the stars in the sky. Sometimes a wagon train had to stop and wait for a herd to go by.',
    say: 'A running bison herd makes the ground rumble like thunder. Along the Platte, bison herds numbered in the thousands, and one traveler wrote that they were thicker than the stars in the sky. Sometimes a wagon train had to stop and wait for a herd to go by.' },
  { id: 'grizzly-ridge', far: true, legs: ['south-pass', 'fort-bridger', 'fort-hall'], when: 'day', ambient: 'grizzly', sound: 'wind',
    card: 'grizzly-ridge', source: 'SOURCES.md#fact-grizzly-ridge', title: 'A grizzly on the ridge',
    text: 'Far up on a ridge, a grizzly bear lifts its nose to sniff the wind. The party stops, stays together and gives the bear plenty of room. After a while it ambles away over the hill, and the wagon rolls on.',
    say: 'Far up on a ridge, a grizzly bear lifts its nose to sniff the wind. The party stops, stays together and gives the bear plenty of room. After a while it ambles away over the hill, and the wagon rolls on.' },
  { id: 'wolf-song', far: true, legs: ['fort-kearny', 'chimney-rock', 'fort-laramie', 'independence-rock'], when: 'night', ambient: 'wolves', sound: 'howl',
    card: 'wolf-song', source: 'SOURCES.md#fact-wolf-song', title: 'Wolves singing',
    text: 'As the sun goes down, a chorus drifts across the plain from far away: wolves, singing to each other. Gray wolves once followed the bison herds across the plains.',
    say: 'As the sun goes down, a chorus drifts across the plain from far away: wolves, singing to each other. Gray wolves once followed the bison herds across the plains.' },
  { id: 'prairie-glow', far: true, legs: ['kansas-river', 'fort-kearny'], when: 'night', ambient: 'fireglow', sound: 'wind',
    card: 'prairie-glow', source: 'SOURCES.md#fact-prairie-glow', title: 'A glow on the prairie',
    text: 'After dark, an orange glow shines on the far edge of the sky: a prairie fire, many miles away. The party watches from camp, safe and snug.',
    say: 'After dark, an orange glow shines on the far edge of the sky: a prairie fire, many miles away. The party watches from camp, safe and snug.' },
  { id: 'pronghorn-race', far: false, legs: ['chimney-rock', 'fort-laramie', 'independence-rock', 'south-pass', 'fort-hall', 'snake-river'], when: 'day',
    ambient: 'pronghorn', sound: 'hooves', card: 'pronghorn-race', source: 'SOURCES.md#fact-pronghorn-race', title: 'A pronghorn race',
    text: 'A pronghorn races right alongside the wagon, then zooms ahead and leaves everyone in the dust!',
    say: 'A pronghorn races right alongside the wagon, then zooms ahead and leaves everyone in the dust!' },
];
export const TRAIL_FACT_BY_ID = Object.fromEntries(TRAIL_FACTS.map((f) => [f.id, f]));
