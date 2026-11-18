// Clue ambiguity guard for content-tests.mjs.
// SIGNATURES: phrases that identify ONE tour city. A clue is checked against the cities of its own tour (the New York
// tour, the USA tour); New York City is on both tours, so its clues are checked against both sets. Every clue must hit at least one phrase of its own city and none
// of any other city's, so a clue can only point to one place on the map. When you add a clue with a new landmark,
// add its phrase here (and make sure no other city's clue already uses it).
// GIVEAWAYS: words a clue must never contain because they name a city outright.

export const SIGNATURES = {
  rochester: [/Genesee River/i, /toys?\b/i, /North Star/i, /Frederick Douglass/i, /lilac/i, /Susan B\. Anthony/i],
  buffalo: [/western end of the Erie Canal/i, /shore of Lake Erie/i, /grain elevator/i, /grain out of boats/i, /chicken wings/i, /28th floor/i, /Canalside/i, /canal ended at the lake/i],
  'niagara-falls': [/Horseshoe Falls/i, /Bridal Veil/i, /American Falls/i, /Lake Erie to Lake Ontario/i, /oldest state park/i, /oldest in the country/i, /Canada/i],
  syracuse: [/Salt City/i, /Onondaga/i, /Weighlock/i, /weighed/i, /state fair/i],
  albany: [/capital city/i, /capital of New York/i, /capitol/i, /mastodon/i, /tulip/i, /1836/, /lawmakers/i],
  cooperstown: [/baseball/i, /Glimmerglass/i, /Otsego/i, /William Cooper/i, /Cardiff Giant/i],
  corning: [/\bglass/i, /Crystal City/i, /telescope/i],
  'lake-placid': [/Winter Olympics/i, /Olympic/i, /Miracle on Ice/i, /ski jump/i, /Adirondack/i],
  'saratoga-springs': [/mineral springs/i, /racetrack/i, /1777/, /American Revolution/i, /battlefield/i],
  ithaca: [/big university/i, /is Gorges/i, /Cayuga/i, /Cornell/i, /Taughannock/i, /college town full of gorges/i],
  'new-york-city': [/Statue of Liberty/i, /France/i, /five boroughs/i, /Central Park/i, /Ellis Island/i, /more people than any other city/i],
  'watkins-glen': [/19 waterfalls/i, /Seneca Lake/i, /deepest Finger Lake/i, /1948/, /behind a waterfall/i, /400 feet/i],
  binghamton: [/carousel/i, /Edwin Link/i, /flight trainer/i, /Chenango/i, /Susquehanna/i],
  // ---- USA Tour (docs/V0.2-USA.md). The northeast corridor shares a lot of history, so each clue holds a detail only its city has.
  boston: [/red line/i, /16 historic/i, /2\.5-mile/i, /\bcows\b/i, /Swan Boats?/i, /shaped like swans/i, /oldest navy ship/i, /Old Ironsides/i],
  philadelphia: [/Liberty Bell/i, /big bell/i, /Independence Hall/i, /Constitution was signed/i, /United States Mint/i, /half dimes/i, /first zoo/i, /1874/],
  'washington-dc': [/555/, /tallest building in the world/i, /Wright brothers/i, /Air and Space/i, /cherry trees/i, /Tidal Basin/i, /\b36\b.*columns/i],
  'cape-canaveral': [/Apollo/i, /first Moon trip/i, /\b525 feet/i, /rocket/i, /space shuttles?/i, /shuttles up/i, /alligators?/i, /wildlife refuge/i, /launch pads?/i],
  'new-orleans': [/1718/, /French Quarter/i, /\bjazz\b/i, /Congo Square/i, /streetcar/i, /beignets?/i, /state doughnut/i],
  'san-antonio': [/below the street/i, /13 miles/i, /Spanish missions/i, /only World Heritage Site in Texas/i, /Battle of Flowers/i, /flower parade/i, /750 feet/i, /1968/],
  'st-louis': [/630 feet/i, /stainless steel/i, /smallest national park/i, /91 acres/i, /does not charge/i, /zoo that is free/i, /birdcage/i, /flight cage/i],
  chicago: [/110-ton/i, /\bbean\b/i, /flows backward/i, /flow away from its lake/i, /Ferris wheel/i, /T\. rex/i],
  denver: [/one mile above sea level/i, /5,280/, /red rocks?/i, /9,525/, /blue bear/i, /bear, bright blue/i, /1858/, /Cherry Creek/i],
  seattle: [/605 feet/i, /saucer/i, /fish sellers/i, /1907/, /\btroll\b/i, /float on a lake/i, /floating homes?/i],
  'san-francisco': [/1937/, /4,200/, /International Orange/i, /orange color/i, /cable cars?/i, /eight sharp turns/i, /crooked street/i],
};

export const GIVEAWAYS = {
  rochester: [/Rochester/i],
  buffalo: [/Buffalo/i],
  'niagara-falls': [/Niagara/i],
  syracuse: [/Syracuse/i],
  albany: [/Albany/i],
  cooperstown: [/Cooperstown/i],
  corning: [/Corning/i],
  'lake-placid': [/Lake Placid/i, /Placid/i],
  'saratoga-springs': [/Saratoga/i],
  ithaca: [/Ithaca/i],
  'new-york-city': [/New York City/i, /Manhattan/i, /Big Apple/i],
  'watkins-glen': [/Watkins/i],
  binghamton: [/Binghamton/i],
  // ---- USA Tour
  boston: [/Boston/i],
  philadelphia: [/Philadelphia/i, /Philly/i],
  'washington-dc': [/Washington/i, /D\.C\./],
  'cape-canaveral': [/Canaveral/i],
  'new-orleans': [/Orleans/i],
  'san-antonio': [/San Antonio/i],
  'st-louis': [/St\.? Louis/i, /Saint Louis/i],
  chicago: [/Chicago/i],
  denver: [/Denver/i],
  seattle: [/Seattle/i],
  'san-francisco': [/San Francisco/i, /Frisco/i],
};
