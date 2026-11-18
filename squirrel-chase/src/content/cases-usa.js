// The six USA Tour cases (docs/V0.2-USA.md; shapes in docs/CONTENT-GUIDE.md). All text is read silently.
// Same recipe as the New York tour. Running gag: the Chief gets the gang's name wrong in every briefing and Pip fixes it;
// in the finale he gets it right. Witnesses are townsfolk (never the gang's animals). Each witness note at a travel stop is
// one of the NEXT city's clues; at the hideout city the two notes lead to the hideout spot. Distances are big now, so the
// Chief sends Pip on planes.
import { sign, w, hw, postcard } from './helpers.js';

export const USA_CASES = [
  // ------------------------------------------------------------------ usa-01: Scrabble, New York City -> Washington -> Cape Canaveral
  {
    id: 'usa-01',
    arc: 'usa',
    order: 1,
    title: 'The Case of the Flying Squirrel',
    lead: 'scrabble',
    crew: ['scrabble'],
    sign: sign('new-york-city', 'FLY', 'FLY', 'STATUE OF LIBERTY'),
    briefing: [
      { who: 'chief', text: 'Pip, the Squabble Gang hit the Statue of Liberty sign in New York City!' },
      { who: 'pip', text: 'The Scribble Gang, Chief.' },
      { who: 'chief', text: 'Right. Three letters are gone. Mr. Wen found a map of the whole country with a big paw print on it.' },
      { who: 'chief', text: 'This trail is too long to walk, Pip. Grab your ticket. We start in New York City, and then we fly.' },
    ],
    route: ['new-york-city', 'washington-dc', 'cape-canaveral'],
    stops: [
      { city: 'new-york-city', witnesses: [
        w('Marisol Vega', 'harbor ferry deckhand', 'A squirrel in a tiny cap asked me how fast the ferry goes. Then she dropped this.', 'washington-dc-c1'),
        w('Mr. Tanaka', 'pretzel cart owner', 'Someone with a bushy tail paid me with an acorn. This napkin was left behind.', 'washington-dc-c3'),
      ] },
      { city: 'washington-dc', witnesses: [
        w('Dr. Imani Brooks', 'museum guide', 'A squirrel stood under an old airplane and flapped her arms. Then she left this.', 'cape-canaveral-c1'),
        w('Walt Pruitt', 'park ranger on the big lawn', 'A squirrel jumped off a bench with a paper wing. This fell out of her bag.', 'cape-canaveral-c3'),
      ] },
      { city: 'cape-canaveral', witnesses: [
        hw('Joyce Lindqvist', 'visitor bus driver', 'A squirrel was staring at the launch pads from my bus window.', 'Check the picnic tables by the water. Someone has built something with a pointy top.'),
        hw('Mr. Barros', 'fishing boat captain', 'I heard a tiny voice shouting across the marsh.', 'It said, "Letters for later! Today, I fly!" Then it climbed into a cardboard rocket.'),
      ] },
    ],
    hideout: {
      city: 'cape-canaveral',
      place: 'A cardboard rocket on a picnic table by the water',
      description: 'Scrabble is sitting in a rocket made of cardboard boxes. It has paper wings, and three letters are stuck on the side.',
      gangLines: [
        { who: 'scrabble', text: 'Pip! Hello! I was just... testing my flying machine.' },
        { who: 'scrabble', text: 'Squirrels glide, but I wanted to fly all the way up. Letters for later! F, L and Y!' },
        { who: 'scrabble', text: 'Fine, fine. Here are the F, the L and the Y. Sorry, Pip. Have an acorn.' },
      ],
    },
    postcard: postcard('cape-canaveral', 0, 1),
    teaser: 'Next case: a crow in a foggy city has gold on her mind.',
  },

  // ------------------------------------------------------------------ usa-02: Glint, San Francisco -> Denver -> Philadelphia
  {
    id: 'usa-02',
    arc: 'usa',
    order: 2,
    title: 'The Case of the Golden Crow',
    lead: 'glint',
    crew: ['glint'],
    sign: sign('san-francisco', 'GOLD'),
    briefing: [
      { who: 'chief', text: 'The Scramble Gang hit the Golden Gate sign in San Francisco!' },
      { who: 'pip', text: 'Scribble Gang, Chief. Scribble.' },
      { who: 'chief', text: 'Yes, yes. Four letters are gone, and one black feather was left in the fog.' },
      { who: 'chief', text: 'Start in San Francisco and follow the notes.' },
    ],
    route: ['san-francisco', 'denver', 'philadelphia'],
    stops: [
      { city: 'san-francisco', witnesses: [
        w('Lena Park', 'cable car conductor', 'A crow rode my cable car and posed at every stop. She left this on the seat.', 'denver-c7'),
        w('Mr. Alvarez', 'bridge painter', 'A crow circled my bridge, hunting for something shiny. This note floated down.', 'denver-c8'),
      ] },
      { city: 'denver', witnesses: [
        w('Tessa Whitehorse', 'mountain hiking guide', 'A crow sat on a red rock and admired her own shine. She dropped this.', 'philadelphia-c5'),
        w('Mr. Hollis', 'ice cream truck driver', 'A crow bought a cone and paid with bottle caps. This was in the cup.', 'philadelphia-c6'),
      ] },
      { city: 'philadelphia', witnesses: [
        hw('Nora Feldman', 'museum guard', 'Something is sparkling in a tree near the old brick hall.', 'Look up in the big tree near the old brick hall. A shiny nest is hiding in the branches.'),
        hw('Gus Pellegrino', 'soft pretzel baker', 'A crow asked me for something golden to eat.', 'She said, "Darlings, soon everything will be GOLD!" Then she flew up into the tree.'),
      ] },
    ],
    hideout: {
      city: 'philadelphia',
      place: 'A shiny nest in a tree near Independence Hall',
      description: 'Glint has covered her nest with gold foil and chocolate coins. She is wearing a paper crown, and four shiny letters hang from a branch.',
      gangLines: [
        { who: 'glint', text: 'Darlings! Welcome to my golden palace! The letters say GOLD!' },
        { who: 'glint', text: 'I just wanted everything to be golden. Is that so wrong?' },
        { who: 'glint', text: 'All right. Here are the G, the O, the L and the D. Sorry! Please take a chocolate coin too.' },
      ],
    },
    postcard: postcard('philadelphia', 0, 2),
    teaser: 'Next case: someone has found a very long river, and a very big bubble bath.',
  },

  // ------------------------------------------------------------------ usa-03: Sudsy, San Antonio -> New Orleans -> St. Louis -> Chicago
  {
    id: 'usa-03',
    arc: 'usa',
    order: 3,
    title: 'The Case of the Bubble Bath Lake',
    lead: 'sudsy',
    crew: ['sudsy'],
    sign: sign('san-antonio', 'LAKE'),
    briefing: [
      { who: 'chief', text: 'Pip! The Scribbly Gang hit the River Walk sign in San Antonio.' },
      { who: 'pip', text: 'Scribble Gang, Chief.' },
      { who: 'chief', text: 'Whatever they are called, soap bubbles are floating down the river. Four letters are missing.' },
      { who: 'chief', text: 'Start at the river, and keep following the water.' },
    ],
    route: ['san-antonio', 'new-orleans', 'st-louis', 'chicago'],
    stops: [
      { city: 'san-antonio', witnesses: [
        w('Carmen Salinas', 'river barge pilot', 'A raccoon in a tiny apron scrubbed my boat. Then he left this.', 'new-orleans-c5'),
        w('Mr. Dwyer', 'taco truck owner', 'A raccoon paid for his tacos with a soapy dollar. This was in the napkin.', 'new-orleans-c6'),
      ] },
      { city: 'new-orleans', witnesses: [
        w('Mrs. Boudreaux', 'streetcar driver', 'A raccoon rode my streetcar and washed all the windows. He left this behind.', 'st-louis-c1'),
        w('Theo Landry', 'street trumpet player', 'A raccoon splashed in the puddles and hummed along with my tune. Then he dropped this.', 'st-louis-c2'),
      ] },
      { city: 'st-louis', witnesses: [
        w('Gwen Hoffman', 'park ranger', 'A raccoon rubbed the big arch with a sponge. He left this on the grass.', 'chicago-c3'),
        w('Mr. Eze', 'zoo gate worker', 'A raccoon hosed down the sidewalk by the gate. This note was stuck to the hose.', 'chicago-c4'),
      ] },
      { city: 'chicago', witnesses: [
        hw('Priya Raman', 'beach lifeguard', 'Soap bubbles are drifting out over the water!', 'Follow the bubbles to the sandy beach by the lake. Look for a tiny blue tent.'),
        hw('Mr. Kowalczyk', 'sailing teacher', 'I heard singing near the sand. It sounded like scrubbing.', 'They sing "Scrub-a-dub-letters!" The song comes from a tiny blue tent on the sand.'),
      ] },
    ],
    hideout: {
      city: 'chicago',
      place: 'A tiny blue tent on a sandy beach by the lake',
      description: 'Sudsy is giving four letters a bubble bath in a bucket. A little towel is drying on a stick.',
      gangLines: [
        { who: 'sudsy', text: 'Oh! Hello! These letters were SO dusty. They needed a lake bath.' },
        { who: 'sudsy', text: 'See? They spell LAKE. We washed them in a lake. Get it?' },
        { who: 'sudsy', text: 'Okay, okay. Here are the L, the A, the K and the E, folded in a towel. Sorry. But look how they shine!' },
      ],
    },
    postcard: postcard('chicago', 0, 1),
    teaser: 'Next case: something is snoring, and it is very high up.',
  },

  // ------------------------------------------------------------------ usa-04: Snoozy, Denver -> San Antonio -> San Francisco -> Seattle
  {
    id: 'usa-04',
    arc: 'usa',
    order: 4,
    title: 'The Case of the Mile-High Snooze',
    lead: 'snoozy',
    crew: ['snoozy'],
    sign: sign('denver', 'SLEEP'),
    briefing: [
      { who: 'chief', text: 'The Dribble Gang swiped five letters from the Mile High Step sign in Denver.' },
      { who: 'pip', text: 'It is the Scribble Gang, Chief.' },
      { who: 'chief', text: 'Hmm. Well, someone left a tiny pillow and a very big yawn.' },
      { who: 'chief', text: 'Start on the steps. The air is thin up here, so take it slowly.' },
    ],
    route: ['denver', 'san-antonio', 'san-francisco', 'seattle'],
    stops: [
      { city: 'denver', witnesses: [
        w('Mr. Whitaker', 'tour guide at the golden dome', 'A possum fell asleep on my steps. When he woke up, he left this.', 'san-antonio-c1'),
        w('Rosa Ortega', 'bike shop owner', 'A possum napped in my bike basket. This was under his pillow.', 'san-antonio-c2'),
      ] },
      { city: 'san-antonio', witnesses: [
        w('Mr. Delgado', 'river boat guide', 'A possum slept through three bridges on my boat. He left this.', 'san-francisco-c5'),
        w('Haley Cruz', 'bakery clerk', 'A possum asked for a roll shaped like a pillow. He paid with this note.', 'san-francisco-c6'),
      ] },
      { city: 'san-francisco', witnesses: [
        w('Mei Chen', 'ferry deckhand', 'A possum rode my ferry across the bay and snored the whole way. He dropped this.', 'seattle-c7'),
        w('Mr. Sullivan', 'photographer by the bridge', 'A possum was napping in the fog. This fell out of his nightcap.', 'seattle-c8'),
      ] },
      { city: 'seattle', witnesses: [
        hw('Captain Dahl', 'kayak guide', 'I heard snoring coming from one of the houses on the water.', 'Paddle past the floating homes. One of them has a pillow on the roof.'),
        hw('Ingrid Solberg', 'houseboat neighbor', 'A possum asked to borrow my doormat.', 'He said, "Five more minutes," and climbed into the floating home with a striped roof.'),
      ] },
    ],
    hideout: {
      city: 'seattle',
      place: 'A floating home with a pillow on the roof',
      description: 'Snoozy is curled up on a bed of letters inside a floating home. The letters spell SLEEP.',
      gangLines: [
        { who: 'snoozy', text: 'Zzz... five more minutes... Oh! Visitors!' },
        { who: 'snoozy', text: 'These letters made the comfiest bed. S, L, E, E, P. Sleep!' },
        { who: 'snoozy', text: 'Oh, were they yours? Sorry. Here you go. They are still warm.' },
      ],
    },
    postcard: postcard('seattle', 0, 3),
    teaser: 'Next case: a very hungry goat has a new snack plan.',
  },

  // ------------------------------------------------------------------ usa-05: Bleatrice, Boston -> Washington -> New Orleans -> Denver
  {
    id: 'usa-05',
    arc: 'usa',
    order: 5,
    title: 'The Case of the Mountain Goat',
    lead: 'bleatrice',
    crew: ['bleatrice'],
    sign: sign('boston', 'EEOAI', null), // only the vowels: Bleatrice's snack, not a word
    briefing: [
      { who: 'chief', text: 'The Wobble Gang struck the Freedom Trail sign in Boston!' },
      { who: 'pip', text: 'Scribble Gang, Chief.' },
      { who: 'chief', text: 'Are you sure? Something nibbled every vowel off that sign. E, E, O, A and I are all gone.' },
      { who: 'pip', text: 'Only the vowels? I know that appetite. Let\'s start in Boston.' },
    ],
    route: ['boston', 'washington-dc', 'new-orleans', 'denver'],
    stops: [
      { city: 'boston', witnesses: [
        w('Mr. Hartigan', 'swan boat pedaler', 'A goat hopped on my boat and munched my lettuce. She left this.', 'washington-dc-c5'),
        w('Ms. Pereira', 'park gardener', 'A goat nibbled my daisies and crunched on something else. She dropped this.', 'washington-dc-c7'),
      ] },
      { city: 'washington-dc', witnesses: [
        w('Aaron Whitfield', 'cherry tree gardener', 'A goat sniffed every blossom and said, "Not crunchy." She left this.', 'new-orleans-c7'),
        w('Mrs. Okonkwo', 'memorial volunteer', 'A goat climbed the steps between the tall columns. This fell out of her lunchbox.', 'new-orleans-c8'),
      ] },
      { city: 'new-orleans', witnesses: [
        w('Mr. Fontenot', 'pastry baker', 'A goat licked all the sugar off my counter. She left this.', 'denver-c3'),
        w('Odette Marchand', 'jazz singer', 'A goat bleated along with my song, and it sounded pretty good. She dropped this.', 'denver-c5'),
      ] },
      { city: 'denver', witnesses: [
        hw('Cole Redfeather', 'foothills trail guide', 'I heard loud crunching high up on the red rocks.', 'Look up! Something is standing on a ledge above the big outdoor stage.'),
        hw('Pilar Gutierrez', 'concert hall helper', 'I saw a goat with a lunchbox walking between the seats.', 'The goat is on a high ledge of red rock, above the very last row of seats.'),
      ] },
    ],
    hideout: {
      city: 'denver',
      place: 'A high ledge of red rock above the outdoor stage',
      description: 'Bleatrice is sitting on a ledge with a lunchbox on her lap. Inside are five shiny vowels.',
      gangLines: [
        { who: 'bleatrice', text: 'Mmm, vowels! E, E, O, A and I. The crunchiest letters there are!' },
        { who: 'bleatrice', text: 'I was saving them for dessert. The view up here is great.' },
        { who: 'bleatrice', text: 'Sorry, Pip. Here they are. I did not take one bite. Well, maybe one tiny lick.' },
      ],
    },
    postcard: postcard('denver', 0, 1),
    teaser: 'Next case: the whole gang is on the move. They are going somewhere you know well.',
  },

  // ------------------------------------------------------------------ usa-06 (finale): Scrabble + the whole gang, Cape Canaveral -> Chicago -> Boston -> New York City
  {
    id: 'usa-06',
    arc: 'usa',
    order: 6,
    title: 'The Case of the Great Race',
    lead: 'scrabble',
    crew: ['scrabble', 'glint', 'sudsy', 'bleatrice', 'snoozy'],
    sign: sign('cape-canaveral', 'RACE'),
    briefing: [
      { who: 'chief', text: 'Pip, this is the big one. The Scribble Gang took four letters from the Space Center sign in Florida.' },
      { who: 'pip', text: 'Chief! You said Scribble again! You got it right!' },
      { who: 'chief', text: 'I wrote it on my hand. And this time, the whole gang was seen heading north in one little cart.' },
      { who: 'chief', text: 'Start at the Space Center. I have a feeling they are going home.' },
    ],
    route: ['cape-canaveral', 'chicago', 'boston', 'new-york-city'],
    stops: [
      { city: 'cape-canaveral', witnesses: [
        w('Dr. Nadia Rahman', 'launch viewing guide', 'A squirrel, a raccoon, a crow, a possum and a goat zoomed off in one little cart. They left this.', 'chicago-c1'),
        w('Mr. Bellamy', 'tour bus driver', 'They all asked for a map and a snack. This note was on the map.', 'chicago-c5'),
      ] },
      { city: 'chicago', witnesses: [
        w('Jordan Vasquez', 'pizza shop cook', 'Five animals shared one pie. They paid with this note.', 'boston-c2'),
        w('Captain Ruth Kim', 'lake boat captain', 'They all sat on my boat and sang. The squirrel left this note.', 'boston-c7'),
      ] },
      { city: 'boston', witnesses: [
        w('Ms. Quinn', 'park gardener', 'The gang ran past my flowers in matching sneakers. This dropped out of the squirrel\'s hat.', 'new-york-city-c1'),
        w('Mr. Oyelaran', 'trail guide in a three-cornered hat', 'They asked me which way is home. They left this on the trail.', 'new-york-city-c4'),
      ] },
      { city: 'new-york-city', witnesses: [
        hw('Ms. Castellano', 'ferry captain', 'I saw ribbons tied along a fence by the water!', 'Follow the ribbons to the big lawn by the harbor. A finish line is there.'),
        hw('Mr. Abioye', 'street musician', 'Somebody is cheering by the harbor, and it sounds like five voices.', 'The whole gang is on the lawn. The squirrel is holding a trophy shaped like an acorn.'),
      ] },
    ],
    hideout: {
      city: 'new-york-city',
      place: 'A finish line on the big lawn by the harbor',
      description: 'A ribbon finish line stretches across the grass. The whole gang is there. A banner says RACE, and a trophy shaped like an acorn sits on a table.',
      gangLines: [
        { who: 'scrabble', text: 'Surprise! You found us! We needed a banner for the Great Race home.' },
        { who: 'glint', text: 'I picked the shiniest letters, darlings!' },
        { who: 'sudsy', text: 'And I gave every one a bubble bath.' },
        { who: 'bleatrice', text: 'I did not nibble the A or the E. I promise.' },
        { who: 'snoozy', text: 'I... took a nap at the starting line.' },
        { who: 'scrabble', text: 'Sorry, Pip. Sorry, Chief. Here are the R, the A, the C and the E. Who wants to race?' },
      ],
    },
    postcard: postcard('new-york-city', 0, 2),
    teaser: 'The USA tour is done, and the gang is home! But Scrabble just found a map of the whole world...',
  },
];
