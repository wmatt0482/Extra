// TEST FIXTURE: the ui-smoke serves this file in place of src/content/index.js, so the test does not depend on the final cases (same shape as SPEC section 5)
// Shape (SPEC §5). The app reads this only through src/logic/caseModel.js, which tolerates the usual spellings of each field.
//   CITIES: { id, name, x, y (0..1 on the NY map), facts: [{ text, source }], sign: 'ERIE CANAL', clues: ['line that points TO this city', ...] }
//   GANG:   { id, name, animal, reason }
//   CASES:  { id, title, sign, route: [cityIds, last = the hideout city], leader: gangId, briefing: [lines],
//             witnesses: [[{ name, role, clue? }, { name, role, clue? }] per route city], hideout: { description }, postcard: { facts: [text, text] } }
//   ARCS:   { id, title, blurb, cases: [caseIds] }
export const CITIES = [
  { id: 'rochester', name: 'Rochester', x: 0.45, y: 0.36, sign: 'GENESEE FALLS', facts: [
    { text: 'Rochester sits on the shore of Lake Ontario.', source: 'https://www.cityofrochester.gov/' }, { text: 'The Genesee River runs through the middle of the city.', source: 'https://www.cityofrochester.gov/' }, { text: 'Rochester is nicknamed the Flour City.', source: 'https://www.cityofrochester.gov/' }],
    clues: ['They bought tickets to the Flour City on Lake Ontario.', 'Someone saw them heading to the city on the Genesee River.', 'A sign pointed toward the city nicknamed the Flour City.', 'They asked the way to the lakeside city with the Genesee River.', 'The note says: follow the river to the Flour City.', 'They hopped a bus for the city beside Lake Ontario.'] },
  { id: 'buffalo', name: 'Buffalo', x: 0.12, y: 0.46, sign: 'CANAL HARBOR', facts: [
    { text: 'Buffalo sits at the eastern end of Lake Erie.', source: 'https://www.buffalony.gov/' }, { text: 'Buffalo is home to the Buffalo Bills football team.', source: 'https://www.buffalony.gov/' }, { text: 'The Erie Canal once ended at Buffalo.', source: 'https://www.buffalony.gov/' }],
    clues: ['They packed their bags for the city at the end of the Erie Canal.', 'Someone saw them go to the city at the east end of Lake Erie.', 'A fan in a football jersey said they asked for the city of the Bills.', 'They are on a train to the big city on Lake Erie.', 'The note says: the canal ends in Buffalo.', 'They cheered and headed for the city of the Buffalo Bills.'] },
  { id: 'niagara-falls', name: 'Niagara Falls', x: 0.2, y: 0.18, sign: 'FALLS VIEW', facts: [
    { text: 'Niagara Falls is made of three waterfalls.', source: 'https://www.niagarafallsusa.com/' }, { text: 'The falls sit on the border with Canada.', source: 'https://www.niagarafallsusa.com/' }, { text: 'Millions of gallons of water pour over the falls every minute.', source: 'https://www.niagarafallsusa.com/' }],
    clues: ['They said they wanted to see a roaring waterfall on the Canadian border.', 'A tourist heard them ask for the city with three famous waterfalls.', 'The note says: the mist is the giveaway, find the falls.', 'They bought raincoats for a boat ride beneath the falls.', 'Someone saw them heading to the border city with the thundering water.', 'They packed ponchos for a trip to Niagara Falls.'] },
  { id: 'syracuse', name: 'Syracuse', x: 0.58, y: 0.42, sign: 'SALT CITY', facts: [
    { text: 'Syracuse is nicknamed the Salt City.', source: 'https://www.syr.gov/' }, { text: 'Syracuse is home to the Great New York State Fair.', source: 'https://www.syr.gov/' }, { text: 'Onondaga Lake lies just north of the city.', source: 'https://www.syr.gov/' }],
    clues: ['They asked for the Salt City.', 'A farmer said they were off to the home of the state fair.', 'They took a bus to the city beside Onondaga Lake.', 'The note says: the Salt City is next.', 'They said they craved a state fair snack and left for Syracuse.', 'Someone saw them boarding for the Salt City.'] },
  // ----- the USA Tour fixtures: New York City is on both maps; the others are US-only (coords: null, usCoords) -----
  { id: 'new-york-city', name: 'New York City', x: 0.9, y: 0.9, usCoords: { x: 0.88, y: 0.34 }, sign: 'BIG APPLE', facts: [
    { text: 'New York City is made of five boroughs.', source: 'https://www.nyc.gov/' }, { text: 'The Statue of Liberty stands in New York Harbor.', source: 'https://www.nps.gov/' }],
    clues: ['They said they wanted to see the lady with the torch in the harbor.', 'A taxi driver heard them ask for the city of five boroughs.', 'The note says: the city that never sleeps is next.', 'They packed for the biggest city on the East Coast.', 'Someone saw them heading to the Big Apple.', 'They asked for the skyline with a harbor and a green lady.'] },
  { id: 'boston', name: 'Boston', x: 0, y: 0, coords: null, usCoords: { x: 0.92, y: 0.27 }, sign: 'FREEDOM TRAIL', facts: [
    { text: 'Boston is the capital of Massachusetts.', source: 'https://www.boston.gov/' }, { text: 'The Freedom Trail is a red line through the old city.', source: 'https://www.nps.gov/' }],
    clues: ['They followed a red brick line through the capital of Massachusetts.', 'A tour guide said they asked for the old harbor city of the Freedom Trail.', 'The note says: the tea party city is next.', 'They bought a ticket to the city of the Boston Tea Party.', 'Someone saw them heading for the capital of Massachusetts.', 'They asked where the Freedom Trail starts.'] },
  { id: 'chicago', name: 'Chicago', x: 0, y: 0, coords: null, usCoords: { x: 0.58, y: 0.36 }, sign: 'WINDY CITY', facts: [
    { text: 'Chicago sits on the shore of Lake Michigan.', source: 'https://www.chicago.gov/' }, { text: 'Chicago is nicknamed the Windy City.', source: 'https://www.chicago.gov/' }],
    clues: ['They hopped on a plane to the Windy City.', 'A pilot heard them ask for the big city on Lake Michigan.', 'The note says: bring a scarf for the Windy City.', 'They asked for a deep dish pizza in the city on Lake Michigan.', 'Someone saw them boarding for the largest city in Illinois.', 'They said the wind would blow their hats off at the lake.'] },
  { id: 'denver', name: 'Denver', x: 0, y: 0, coords: null, usCoords: { x: 0.4, y: 0.48 }, sign: 'MILE HIGH', facts: [
    { text: 'Denver is called the Mile High City.', source: 'https://www.denvergov.org/' }, { text: 'Denver is the capital of Colorado.', source: 'https://www.denvergov.org/' }],
    clues: ['They took a plane to the Mile High City.', 'A pilot heard them ask for the capital of Colorado.', 'The note says: the Rocky Mountains are right behind it.', 'They packed snow boots for the city a mile above the sea.', 'Someone saw them heading to the mountain capital of Colorado.', 'They asked which gate flies to the Mile High City.'] },
];
export const GANG = [
  { id: 'scrabble', name: 'Scrabble', animal: 'squirrel', reason: 'Scrabble loves collecting letters for silly words.' },
  { id: 'rascal', name: 'Rascal', animal: 'raccoon', reason: 'Rascal likes anything that glitters.' },
  { id: 'cawdy', name: 'Cawdy', animal: 'crow', reason: 'Cawdy collects shiny letters.' },
  { id: 'posy', name: 'Posy', animal: 'possum', reason: 'Posy naps in the middle of the sign.' },
  { id: 'billy', name: 'Billy', animal: 'goat', reason: 'Billy eats only vowels.' },
];
export const CASES = [
  { id: 'ny-01', title: 'The Case of the Missing Falls', sign: 'NIAGARA FALLS', leader: 'billy', route: ['rochester', 'buffalo', 'niagara-falls'],
    briefing: ['Somebody swiped letters off the big sign at Niagara Falls.', 'Billy the goat took the vowels. Follow the trail, stop by stop.', 'Your first stop: Rochester.'],
    witnesses: [
      [{ name: 'Mrs. Alvarez', role: 'bakery owner' }, { name: 'Mr. Kim', role: 'bus driver' }],
      [{ name: 'Dot', role: 'ticket seller' }, { name: 'Mr. Okafor', role: 'museum guide' }],
      [{ name: 'Ms. Reyes', role: 'boat captain', clue: 'A goat in a poncho climbed behind the thundering water.' }, { name: 'Sam', role: 'souvenir seller', clue: 'I heard munching from the cave under the falls.' }]],
    hideout: { description: 'Behind the roaring water, in a damp cave, the gang is munching on the stolen letters.' },
    postcard: { facts: ['Niagara Falls is made of three waterfalls.', 'The falls sit on the border with Canada.'] } },
  { id: 'ny-02', title: 'The Salt City Switcheroo', sign: 'SALT CITY WELCOME', leader: 'rascal', route: ['syracuse', 'rochester', 'buffalo'],
    briefing: ['Rascal the raccoon swiped shiny letters from the welcome sign in Syracuse.', 'Start your search right where the sign stands.'],
    witnesses: [
      [{ name: 'Mr. Lopez', role: 'farmer' }, { name: 'Gwen', role: 'fair worker' }],
      [{ name: 'Ms. Park', role: 'baker' }, { name: 'Ty', role: 'paper boy' }],
      [{ name: 'Mr. Dube', role: 'ticket taker', clue: 'A raccoon in sunglasses hopped into the old harbor warehouse.' }, { name: 'Lena', role: 'fisher', clue: 'I smelled the gang snacking by the canal.' }]],
    hideout: { description: 'In a dusty harbor warehouse, Rascal sorts the letters into a shiny pile.' },
    postcard: { facts: ['Buffalo sits at the eastern end of Lake Erie.', 'The Erie Canal once ended at Buffalo.'] } },
];
CASES.push(
  { id: 'usa-01', title: 'The Case of the Windy Welcome', sign: 'WINDY CITY WELCOME', leader: 'scrabble', route: ['boston', 'chicago', 'denver'],
    briefing: ['Scrabble just bought a map of the whole country and swiped letters from a sign.', 'Start in Boston and follow the trail across the map.'],
    witnesses: [
      [{ name: 'Ms. Hale', role: 'tour guide' }, { name: 'Mr. Ortiz', role: 'ferry captain' }],
      [{ name: 'Pat', role: 'pilot' }, { name: 'Ms. Wu', role: 'baker' }],
      [{ name: 'Rosa', role: 'ski guide', clue: 'A squirrel with a big map hid in the lodge by the mountain.' }, { name: 'Ben', role: 'bus driver', clue: 'I saw the gang munching letters near the mountains.' }]],
    hideout: { description: 'In a cozy mountain lodge, Scrabble spreads the whole country map across the floor.' },
    postcard: { facts: ['Denver is called the Mile High City.', 'Denver is the capital of Colorado.'] } },
  { id: 'usa-02', title: 'The Big Apple Boomerang', sign: 'BIG APPLE', leader: 'rascal', route: ['denver', 'chicago', 'new-york-city'],
    briefing: ['Rascal swiped shiny letters again.', 'Start in Denver.'],
    witnesses: [
      [{ name: 'Gus', role: 'hiker' }, { name: 'Ana', role: 'barista' }],
      [{ name: 'Lou', role: 'pilot' }, { name: 'Kim', role: 'cook' }],
      [{ name: 'Joy', role: 'ferry captain', clue: 'A raccoon with a camera hid by the harbor.' }, { name: 'Sid', role: 'vendor', clue: 'I heard crunching near the green lady.' }]],
    hideout: { description: 'Near the harbor, Rascal sorts shiny letters into five piles, one for each borough.' },
    postcard: { facts: ['New York City is made of five boroughs.', 'The Statue of Liberty stands in New York Harbor.'] } },
);
export const ARCS = [
  { id: 'ny', title: 'The New York tour', blurb: 'Chase the Scribble Gang across New York State.', map: 'ny', cases: ['ny-01', 'ny-02'] },
  { id: 'usa', title: 'The USA tour', blurb: 'Scrabble just bought a map of the whole country.', map: 'usa', cases: ['usa-01', 'usa-02'] },
];
