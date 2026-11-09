// The six New York tour cases (SPEC §4–5; shapes in docs/CONTENT-GUIDE.md). All text is read silently.
// Running gag: the Chief gets the gang's name wrong in every briefing, Pip fixes it, and in the finale the Chief gets it right.
// Witnesses are townsfolk (never the gang's animals). Each witness note at a travel stop is one of the NEXT city's clues;
// at the hideout city the two notes lead to the hideout spot.
import { sign, w, hw, postcard } from './helpers.js';

export const CASES = [
  // ------------------------------------------------------------------ ny-01: Scrabble, Albany -> Saratoga Springs -> Lake Placid
  {
    id: 'ny-01',
    arc: 'ny',
    order: 1,
    title: 'The Case of the Top Squirrel',
    lead: 'scrabble',
    crew: ['scrabble'],
    sign: sign('albany', 'TOP'),
    briefing: [
      { who: 'chief', text: 'Pip, the Squiggle Gang hit the State Capitol sign in Albany!' },
      { who: 'pip', text: 'The Scribble Gang, Chief.' },
      { who: 'chief', text: 'Right. Three letters are missing, and Mr. Wen found an acorn on the steps.' },
      { who: 'chief', text: 'Start in Albany. Ask around and follow the notes.' },
    ],
    route: ['albany', 'saratoga-springs', 'lake-placid'],
    stops: [
      { city: 'albany', witnesses: [
        w('Rosa Delgado', 'Capitol tour guide', 'A squirrel ran up the big stairs with a letter T. It dropped this note on the way down.', 'saratoga-springs-c1'),
        w('Mr. Okafor', 'pretzel cart owner', 'Someone with a bushy tail bought a pretzel and left this napkin behind.', 'saratoga-springs-c3'),
      ] },
      { city: 'saratoga-springs', witnesses: [
        w('Hannah Kowalski', 'stable helper at the racetrack', 'A squirrel was chatting with the horses. It left this note in the hay.', 'lake-placid-c1'),
        w('Dev Patel', 'spring water fan', 'I was filling my cup at a spring when this note floated by.', 'lake-placid-c3'),
      ] },
      { city: 'lake-placid', witnesses: [
        hw('Coach Lena Berg', 'ski jump coach', 'Someone has been stacking pine cones near the lake.', 'Look inside the hollow pine tree by the lake. Something in there is humming.'),
        hw('Sam Mitchell', 'canoe rental owner', 'A squirrel borrowed my pen for a minute. Here is what it wrote.', '"Meet at the hollow pine. Bring the T, the O and the P. I will be the TOP squirrel!"'),
      ] },
    ],
    hideout: {
      city: 'lake-placid',
      place: 'A hollow pine tree by the lake',
      description: 'Inside the tree, Scrabble has nailed up a tiny wooden sign. It says TOP, in letters from the Capitol.',
      gangLines: [
        { who: 'scrabble', text: 'Oh! Pip! Hello! I was just... decorating.' },
        { who: 'scrabble', text: 'I wanted everyone to know I am the TOP squirrel. Letters for later!' },
        { who: 'scrabble', text: 'Fine, fine. Here are the T, the O and the P. Sorry, Pip. Have an acorn.' },
      ],
    },
    postcard: postcard('lake-placid', 0, 3),
    teaser: 'Next case: a crow, a museum, and a whole lot of shine.',
  },

  // ------------------------------------------------------------------ ny-02: Glint, Corning -> Watkins Glen -> Ithaca -> Syracuse
  {
    id: 'ny-02',
    arc: 'ny',
    order: 2,
    title: 'The Case of the Glam Crow',
    lead: 'glint',
    crew: ['glint'],
    sign: sign('corning', 'GLAM'),
    briefing: [
      { who: 'chief', text: 'The Doodle Gang hit the Museum of Glass sign in Corning!' },
      { who: 'pip', text: 'Scribble Gang, Chief. Scribble.' },
      { who: 'chief', text: 'Yes, yes. Four letters are gone, and a black feather was left behind.' },
      { who: 'chief', text: 'Start in Corning and follow the notes.' },
    ],
    route: ['corning', 'watkins-glen', 'ithaca', 'syracuse'],
    stops: [
      { city: 'corning', witnesses: [
        w('Ana Ferreira', 'glassblower', 'A crow watched my hot glass show. It said, "Ooh, shiny!" and dropped this.', 'watkins-glen-c1'),
        w('Mr. Brooks', 'museum guard', 'I found this note taped to a glass case.', 'watkins-glen-c3'),
      ] },
      { city: 'watkins-glen', witnesses: [
        w('Ranger Kim', 'state park ranger', 'A crow flew right through the waterfall spray. It left this note on a stone step.', 'ithaca-c1'),
        w('Maya Johnson', 'race fan in a checkered cap', 'A bird swooped down, took my shiny sticker, and left this note instead.', 'ithaca-c3'),
      ] },
      { city: 'ithaca', witnesses: [
        w('Professor Liu', 'college science teacher', 'A crow tapped on my classroom window. It was holding this.', 'syracuse-c1'),
        w('Jamal Wright', 'bike messenger', 'A crow raced my bike over a stone bridge. This fell from its beak.', 'syracuse-c2'),
      ] },
      { city: 'syracuse', witnesses: [
        hw('Grandma Pearl', 'knitter on a park bench', 'A crow flew over me, humming a song about shiny things.', 'Try the roof of the old canal building. Something up there is sparkling.'),
        hw('Tomás Rivera', 'canal museum volunteer', 'I saw letters glittering on a rooftop!', 'There is a nest of shiny things on the roof of the Weighlock Building.'),
      ] },
    ],
    hideout: {
      city: 'syracuse',
      place: 'A rooftop nest on the old Weighlock Building',
      description: 'Glint has built a nest of bottle caps, foil and four shiny letters. She is posing like a movie star.',
      gangLines: [
        { who: 'glint', text: 'Darlings! Do you like my new look? The letters say GLAM!' },
        { who: 'glint', text: 'Ooh, they were just so shiny. I could not help it.' },
        { who: 'glint', text: 'All right. Here are the G, the L, the A and the M. Sorry! Please take this bottle cap too.' },
      ],
    },
    postcard: postcard('syracuse', 0, 2),
    teaser: 'Next case: someone is giving the Erie Canal sign a bubble bath.',
  },

  // ------------------------------------------------------------------ ny-03: Sudsy, Buffalo -> Niagara Falls -> Rochester -> Ithaca
  {
    id: 'ny-03',
    arc: 'ny',
    order: 3,
    title: 'The Case of the Squeaky-Clean Letters',
    lead: 'sudsy',
    crew: ['sudsy'],
    sign: sign('buffalo', 'CLEAN'),
    briefing: [
      { who: 'chief', text: 'Pip! The Scrubble Gang hit the Erie Canal sign in Buffalo.' },
      { who: 'pip', text: 'Scribble Gang, Chief.' },
      { who: 'chief', text: 'Whatever they are called, they left soap bubbles everywhere. Five letters are missing.' },
      { who: 'chief', text: 'Start at the canal in Buffalo.' },
    ],
    route: ['buffalo', 'niagara-falls', 'rochester', 'ithaca'],
    stops: [
      { city: 'buffalo', witnesses: [
        w('Captain Joe Benson', 'tour boat captain', 'A raccoon in a tiny apron scrubbed my boat rail. Then it left this.', 'niagara-falls-c1'),
        w('Fatima Hassan', 'kayak teacher', 'I found this note floating in a puddle of bubbles.', 'niagara-falls-c3'),
      ] },
      { city: 'niagara-falls', witnesses: [
        w('Lily Nguyen', 'gift shop clerk', 'A raccoon bought a bar of soap and paid with this note.', 'rochester-c1'),
        w('Mr. Castillo', 'photographer', 'I was taking a picture of the rainbow. A raccoon hopped in front of me and dropped this.', 'rochester-c4'),
      ] },
      { city: 'rochester', witnesses: [
        w('Ms. Abernathy', 'toy museum guide', 'A raccoon gave a teddy bear a bath in the fountain. It left this behind.', 'ithaca-c2'),
        w('Kenji Sato', 'park gardener', 'Bubbles drifted over the lilac bushes, and so did this note.', 'ithaca-c5'),
      ] },
      { city: 'ithaca', witnesses: [
        hw('Dr. Amara Okoye', 'waterfall scientist', 'There is soap foam floating down the creek!', 'Follow the bubbles up the gorge. They start at a waterfall with a flat rock beside it.'),
        hw('Ben Carter', 'trail volunteer', 'Someone is singing in the gorge. It sounds like scrubbing.', 'The song goes "Scrub-a-dub-letters!" It comes from the flat rock by the waterfall.'),
      ] },
    ],
    hideout: {
      city: 'ithaca',
      place: 'A flat rock beside a waterfall in a gorge',
      description: 'Sudsy is washing five letters under the waterfall. A tiny towel is drying on a stick.',
      gangLines: [
        { who: 'sudsy', text: 'Oh! Hello! These letters were SO dusty. They needed a bath.' },
        { who: 'sudsy', text: 'See? Now they spell CLEAN. Get it?' },
        { who: 'sudsy', text: 'Okay, okay. Here they are, folded in a towel. Sorry. But look how they shine!' },
      ],
    },
    postcard: postcard('ithaca', 0, 3),
    teaser: 'Next case: someone out there is very hungry for vowels.',
  },

  // ------------------------------------------------------------------ ny-04: Bleatrice, Cooperstown -> Binghamton -> Corning -> Watkins Glen
  {
    id: 'ny-04',
    arc: 'ny',
    order: 4,
    title: 'The Case of the Vowel Snacker',
    lead: 'bleatrice',
    crew: ['bleatrice'],
    sign: sign('cooperstown', 'AOAE', null), // only the vowels: Bleatrice's snack, not a word
    briefing: [
      { who: 'chief', text: 'The Nibble Gang struck the Hall of Fame sign in Cooperstown!' },
      { who: 'pip', text: 'Scribble Gang, Chief.' },
      { who: 'chief', text: 'Are you sure? Something nibbled every vowel off that sign. A, O, A and E are all gone.' },
      { who: 'pip', text: 'Only the vowels? I have a hunch. Let\'s start in Cooperstown.' },
    ],
    route: ['cooperstown', 'binghamton', 'corning', 'watkins-glen'],
    stops: [
      { city: 'cooperstown', witnesses: [
        w('Mrs. Abbott', 'baseball museum volunteer', 'A goat trotted past the museum. It was crunching on something.', 'binghamton-c1'),
        w('Luis Ortega', 'farmer at the Farmers\' Museum', 'A goat tried to trade me this note for a carrot.', 'binghamton-c3'),
      ] },
      { city: 'binghamton', witnesses: [
        w('Greta Olsen', 'carousel operator', 'A goat rode my carousel three times. It left this on a painted horse.', 'corning-c1'),
        w('Marcus Bell', 'fisher on the riverbank', 'A goat looked for vowels in my tackle box. It dropped this.', 'corning-c3'),
      ] },
      { city: 'corning', witnesses: [
        w('Priya Shah', 'museum gift shop clerk', 'A goat asked me if glass letters taste good. I said no. It left this.', 'watkins-glen-c2'),
        w('Ed Fontaine', 'mail carrier', 'This note was in a mailbox, with a goat hair stuck to it.', 'watkins-glen-c5'),
      ] },
      { city: 'watkins-glen', witnesses: [
        hw('Rachel Stein', 'hiking guide', 'I heard munching up on the cliffs.', 'Look up! Something is standing on a high ledge above the stone stairs.'),
        hw('Omar Haddad', 'lake boat captain', 'From my boat, I saw a goat with a lunchbox high up in the gorge.', 'The goat is on a ledge near the waterfall you can walk behind.'),
      ] },
    ],
    hideout: {
      city: 'watkins-glen',
      place: 'A high rocky ledge above the gorge trail',
      description: 'Bleatrice is sitting on a ledge with a lunchbox on her lap. Inside are four shiny vowels.',
      gangLines: [
        { who: 'bleatrice', text: 'Mmm, vowels! A, O, A and E. The crunchiest letters there are!' },
        { who: 'bleatrice', text: 'I was saving them for dessert.' },
        { who: 'bleatrice', text: 'Sorry, Pip. Here they are. I did not take one bite. Well, maybe one tiny lick.' },
      ],
    },
    postcard: postcard('watkins-glen', 0, 1),
    teaser: 'Next case: who is snoring by the mineral springs?',
  },

  // ------------------------------------------------------------------ ny-05: Snoozy, Saratoga Springs -> Lake Placid -> Syracuse -> Buffalo
  {
    id: 'ny-05',
    arc: 'ny',
    order: 5,
    title: 'The Case of the Sleepy Sign',
    lead: 'snoozy',
    crew: ['snoozy'],
    sign: sign('saratoga-springs', 'NAPS'),
    briefing: [
      { who: 'chief', text: 'The Snoozle Gang swiped four letters from the Mineral Springs sign in Saratoga Springs.' },
      { who: 'pip', text: 'It is the Scribble Gang, Chief.' },
      { who: 'chief', text: 'Hmm. Well, someone left a tiny pillow and a lot of yawns.' },
      { who: 'chief', text: 'Start at the springs.' },
    ],
    route: ['saratoga-springs', 'lake-placid', 'syracuse', 'buffalo'],
    stops: [
      { city: 'saratoga-springs', witnesses: [
        w('Jasmine Moore', 'horse groom', 'A possum was napping in my horse\'s hay. When it woke up, it left this.', 'lake-placid-c4'),
        w('Mr. Pellegrino', 'park gardener', 'I found this note tucked in a pillowcase by the springs.', 'lake-placid-c5'),
      ] },
      { city: 'lake-placid', witnesses: [
        w('Hiro Tanaka', 'ice skating teacher', 'A possum fell asleep on the bench by the ice. When it rolled over, this fell out.', 'syracuse-c3'),
        w('Bridget O\'Malley', 'hotel desk clerk', 'A sleepy possum asked for a wake-up call. It left this note.', 'syracuse-c5'),
      ] },
      { city: 'syracuse', witnesses: [
        w('Carlos Mendez', 'Ferris wheel operator', 'A possum rode my Ferris wheel and slept the whole time. It dropped this.', 'buffalo-c1'),
        w('Aisha Bello', 'librarian', 'Someone was snoring in the reading corner. They left this bookmark.', 'buffalo-c5'),
      ] },
      { city: 'buffalo', witnesses: [
        hw('Pete Kowal', 'grain elevator tour guide', 'Something up high is going "Zzz... zzz..."', 'Look on top of the old grain elevator by the river. There is a pillow fort up there.'),
        hw('Keisha Davis', 'crossing guard', 'I saw a possum carry four letters up a ladder. It was yawning.', 'It said, "Five more minutes," and climbed to the roof of the tallest grain elevator.'),
      ] },
    ],
    hideout: {
      city: 'buffalo',
      place: 'A pillow fort on top of an old grain elevator',
      description: 'Snoozy is curled up on a bed of letters. The letters spell NAPS.',
      gangLines: [
        { who: 'snoozy', text: 'Zzz... five more minutes... Oh! Visitors!' },
        { who: 'snoozy', text: 'These letters made the comfiest pillow. N, A, P, S. Naps!' },
        { who: 'snoozy', text: 'Oh, were they yours? Sorry. Here you go. They are still warm.' },
      ],
    },
    postcard: postcard('buffalo', 0, 1),
    teaser: 'Next case: the whole gang is planning something big. Very big. And a little bit nutty.',
  },

  // ------------------------------------------------------------------ ny-06 (finale): Scrabble + the whole gang, New York City -> Cooperstown -> Syracuse -> Niagara Falls
  {
    id: 'ny-06',
    arc: 'ny',
    order: 6,
    title: 'The Case of the Pecan Party',
    lead: 'scrabble',
    crew: ['scrabble', 'glint', 'sudsy', 'bleatrice', 'snoozy'],
    sign: sign('new-york-city', 'PECAN'),
    briefing: [
      { who: 'chief', text: 'Pip, this is the big one. The Scribble Gang swiped five letters from the Central Park sign in New York City.' },
      { who: 'pip', text: 'Chief! You said Scribble! You got it right!' },
      { who: 'chief', text: 'I have been practicing. And this time, the whole gang was seen.' },
      { who: 'chief', text: 'Start in New York City.' },
    ],
    route: ['new-york-city', 'cooperstown', 'syracuse', 'niagara-falls'],
    stops: [
      { city: 'new-york-city', witnesses: [
        w('Ms. Washington', 'ferry ticket seller', 'A squirrel, a raccoon, a crow, a possum and a goat shared one ticket. They left this.', 'cooperstown-c1'),
        w('Rafael Cruz', 'street musician', 'The gang danced to my song. Then the squirrel dropped this in my hat.', 'cooperstown-c3'),
      ] },
      { city: 'cooperstown', witnesses: [
        w('Coach Ellie Park', 'Little League coach', 'A squirrel caught a fly ball and left this note in my glove.', 'syracuse-c4'),
        w('Mr. Henderson', 'ice cream shop owner', 'Five animals shared one big sundae. They paid with this note.', 'syracuse-c6'),
      ] },
      { city: 'syracuse', witnesses: [
        w('Natalie Gomez', 'museum teacher', 'The gang was looking at old canal boats. They left this on a bench.', 'niagara-falls-c2'),
        w('Victor Popescu', 'food truck cook', 'They ordered five lunches to go. This was written on the napkin.', 'niagara-falls-c5'),
      ] },
      { city: 'niagara-falls', witnesses: [
        hw('Ranger Delia Torres', 'state park ranger', 'I saw balloons tied to the railing by the falls!', 'Follow the balloons to the picnic tables near the American Falls.'),
        hw('Arjun Mehta', 'boat deckhand', 'Somebody is having a party by the falls. It smells like pecan pie.', 'The whole gang is at a long picnic table by the railing. The squirrel is holding a giant pie.'),
      ] },
    ],
    hideout: {
      city: 'niagara-falls',
      place: 'A long picnic table near the American Falls',
      description: 'The whole gang is having a party. A banner says PECAN, and there is a giant pecan pie in the middle of the table.',
      gangLines: [
        { who: 'scrabble', text: 'Surprise! You found us! We needed a banner for our pecan pie party.' },
        { who: 'glint', text: 'I picked the shiniest letters, darlings!' },
        { who: 'sudsy', text: 'And I washed every one of them.' },
        { who: 'bleatrice', text: 'I did not eat the E or the A. I promise.' },
        { who: 'snoozy', text: 'I... took a nap.' },
        { who: 'scrabble', text: 'Sorry, Pip. Sorry, Chief. Here are the P, E, C, A and N. Would you like some pie?' },
      ],
    },
    postcard: postcard('niagara-falls', 0, 2),
    teaser: 'The New York tour is done! But Scrabble just bought a map of the whole United States...',
  },
];
