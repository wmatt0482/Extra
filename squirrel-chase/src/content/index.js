// PLACEHOLDER: replaced by the content agent at merge
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
];
export const ARCS = [{ id: 'ny', title: 'The New York tour', blurb: 'Chase the Scribble Gang across New York State.', cases: ['ny-01'] }];
