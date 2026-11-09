// Clue ambiguity guard for content-tests.mjs.
// SIGNATURES: phrases that identify ONE tour city. Every clue must hit at least one phrase of its own city and none
// of any other city's, so a clue can only point to one place on the map. When you add a clue with a new landmark,
// add its phrase here (and make sure no other city's clue already uses it).
// GIVEAWAYS: words a clue must never contain because they name a city outright.

export const SIGNATURES = {
  rochester: [/96-foot/i, /toys?\b/i, /North Star/i, /Frederick Douglass/i, /lilac/i, /Susan B\. Anthony/i],
  buffalo: [/western end of the Erie Canal/i, /shore of Lake Erie/i, /grain elevator/i, /grain out of boats/i, /chicken wings/i, /28th floor/i, /Canalside/i, /canal ended at the lake/i],
  'niagara-falls': [/Horseshoe Falls/i, /Bridal Veil/i, /American Falls/i, /Lake Erie to Lake Ontario/i, /oldest state park/i, /Canada/i],
  syracuse: [/Salt City/i, /Onondaga/i, /Weighlock/i, /weighed/i, /state fair/i],
  albany: [/capital city/i, /capital of New York/i, /capitol/i, /mastodon/i, /tulip/i, /1836/, /lawmakers/i],
  cooperstown: [/baseball/i, /Glimmerglass/i, /Otsego/i, /William Cooper/i, /Cardiff Giant/i],
  corning: [/\bglass/i, /Crystal City/i, /telescope/i],
  'lake-placid': [/Winter Olympics/i, /Olympic/i, /Miracle on Ice/i, /ski jump/i, /Adirondack/i],
  'saratoga-springs': [/mineral springs/i, /racetrack/i, /1777/, /American Revolution/i, /battlefield/i],
  ithaca: [/150 waterfalls/i, /is Gorges/i, /Cayuga/i, /Cornell/i, /Taughannock/i, /college town full of gorges/i],
  'new-york-city': [/Statue of Liberty/i, /France/i, /five boroughs/i, /Central Park/i, /Ellis Island/i, /more people than any other city/i],
  'watkins-glen': [/19 waterfalls/i, /Seneca Lake/i, /deepest Finger Lake/i, /1948/, /behind a waterfall/i, /400 feet/i],
  binghamton: [/carousel/i, /Edwin Link/i, /flight trainer/i, /Chenango/i, /Susquehanna/i],
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
};
