// Routes, forks and plans (SPEC v1.5 §2.3). A route is an ordered list of steps; a step is a leg id, { leg, miles?, from?, to? }
// (the same leg with this branch's miles) or { fork } (a choice the child makes at a stop). The journey (journey/route.js) flattens
// a route into a plan. The first option of a fork is the default (the plan uses it until the child chooses).
//
// Each option's `line` is the one true sentence its explainer says (a person at the stop: people.js); the lines say what is true of
// each way and nothing more. They carry no mileage, because docs/SOURCES.md ("Things v1.5 deliberately does not say") keeps the
// miles a shortcut saves out of anything read aloud; `say` is the spoken form (numbers in words). `lean: 'oregon'` decides only the
// first trip's order and focus, never the size of a button. `fromJourney`: the first journey (ledger journeyN) the fork is offered;
// `fromYear`: the year a way opened (the Sublette Cutoff 1844, the Barlow Road 1846, the Gold Road 1848, the Lander Road 1858).
const line = (text, say) => ({ text, say: say || text });

export const ROUTES = {
  emigrant: { id: 'emigrant', name: 'The emigrant trail', fromYear: 1843,
    start: { id: 'independence', name: 'Independence, Missouri', store: { name: 'Independence', prices: 1.0 }, lookout: 'independence', map: [940, 330] },
    steps: ['kansas-river', 'alcove-spring', 'fort-kearny', 'ash-hollow', 'chimney-rock', 'scotts-bluff', 'fort-laramie',
      'north-platte', 'independence-rock', 'ice-slough', 'south-pass', { fork: 'south-pass' }, { fork: 'fort-hall' }] },
  'gold-road': { id: 'gold-road', name: 'The Gold Road', fromYear: 1848, needs: { site: 'willamette' },
    start: { id: 'farm-willamette', name: 'your farm in the Willamette Valley', store: { name: 'Oregon City', prices: 1.3 }, lookout: 'gold-news', map: [80, 120] },
    steps: ['calapooya-mountains', 'umpqua-river', 'canyon-creek', 'rogue-river', 'siskiyou-pass', 'mount-shasta', 'castle-crags',
      'clear-creek', 'feather-river', 'sutters-fort', 'coloma', 'home-by-sea'] },
};

export const FORKS = {
  'south-pass': { id: 'south-pass', at: 'south-pass', fromJourney: 2, explainer: 'nell', options: [
    { id: 'main', name: 'By Fort Bridger', steps: ['green-river', 'fort-bridger', 'soda-springs', 'fort-hall'],
      line: line('The road by Fort Bridger is the longer way, but it passes a trading post where wagons could be mended and supplies bought.') },
    { id: 'sublette', name: 'The Sublette Cutoff', fromYear: 1844,
      steps: ['sublette-cutoff', 'bear-river', { leg: 'soda-springs', miles: 50, from: 'the Bear River' }, 'fort-hall'],
      line: line('The Sublette Cutoff is shorter, but it crosses a long dry stretch with no water, and it skips Fort Bridger.') },
    { id: 'lander', name: 'The Lander Road', fromYear: 1858,
      steps: ['lander-road', { leg: 'fort-hall', miles: 140, from: 'the Lander Road' }],
      line: line('The Lander Road is a newer road the government built for emigrants, shorter than the old trail and with grass and water, and it skips Fort Bridger and Soda Springs.') },
  ] },
  'fort-hall': { id: 'fort-hall', at: 'fort-hall', fromJourney: 1, explainer: 'agnes', lean: 'oregon', options: [
    { id: 'oregon', name: 'On to Oregon',
      steps: ['snake-river', 'farewell-bend', 'blue-mountains', 'the-dalles', { fork: 'the-dalles' }],
      line: line('West along the Snake River and over the Blue Mountains lies the Willamette Valley, with its rich farmland.') },
    { id: 'california', name: 'South to California',
      steps: ['raft-river', 'city-of-rocks', 'humboldt-wells', 'humboldt-river', 'big-meadows', 'forty-mile-desert', 'truckee-river', 'sierra-summit', 'sacramento-valley'],
      line: line('South at the Raft River, the California Trail follows the Humboldt River, crosses a desert with no water, and climbs over the Sierra Nevada to the Sacramento Valley.'),
      lineFrom1849: line('Many wagons this year are bound for the gold fields of California.') },
  ], leanLine: line('Your family planned on Oregon. You can still change your mind.') },
  'the-dalles': { id: 'the-dalles', at: 'the-dalles', fromJourney: 1, explainer: 'barlow-kid', options: [
    { id: 'columbia', name: 'Raft the Columbia', steps: ['willamette-valley'],
      line: line('The raft carries the wagon down the Columbia River to the valley, and the river runs fast, so steer well.') },
    { id: 'barlow', name: 'The Barlow Road', fromYear: 1846, steps: ['barlow-road'],
      line: line('The Barlow Road is a toll road over the shoulder of Mount Hood, five dollars a wagon, and at steep Laurel Hill the wagons are let down on ropes.',
        'The Barlow Road is a toll road over the shoulder of Mount Hood, five dollars a wagon, and at steep Laurel Hill the wagons are let down on ropes.') },
  ] },
};

// The 1.3 trail: twelve legs with their 1.3 miles, names and starting points, as overrides of the legs above. A 1.3 journey in
// progress keeps this plan to the end ("an unfinished 1.3 journey ends as it began"); the 1.3 miles sum to 2,000.
export const LEGACY_PLAN_12 = [
  { leg: 'kansas-river', miles: 150, from: 'Independence', to: 'the Kansas River crossing' },
  { leg: 'fort-kearny', miles: 170, from: 'the Kansas River', to: 'Fort Kearny' },
  { leg: 'chimney-rock', miles: 160, from: 'Fort Kearny', to: 'Chimney Rock' },
  { leg: 'fort-laramie', miles: 140, from: 'Chimney Rock', to: 'Fort Laramie' },
  { leg: 'independence-rock', miles: 190, from: 'Fort Laramie', to: 'Independence Rock' },
  { leg: 'south-pass', miles: 140, from: 'Independence Rock', to: 'South Pass' },
  { leg: 'fort-bridger', miles: 140, from: 'South Pass', to: 'Fort Bridger' },
  { leg: 'fort-hall', miles: 210, from: 'Fort Bridger', to: 'Fort Hall, by way of Soda Springs' },
  { leg: 'snake-river', miles: 180, from: 'Fort Hall', to: 'the Snake River crossing' },
  { leg: 'blue-mountains', miles: 200, from: 'the Snake River', to: 'the Blue Mountains' },
  { leg: 'the-dalles', miles: 160, from: 'the Blue Mountains', to: 'The Dalles on the Columbia River' },
  { leg: 'willamette-valley', miles: 160, from: 'The Dalles', to: 'the Willamette Valley' },
];

// The two places a trail ends and a farm grows (SPEC §2.7, §3.5). `ends`: the legs that found it.
export const SITES = [
  { id: 'willamette', name: 'Willamette Valley farm', ends: ['willamette-valley', 'barlow-road', 'home-by-sea'], map: [70, 110] },
  { id: 'sacramento', name: 'Sacramento Valley claim', ends: ['sacramento-valley'], map: [150, 470] },
];
export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));
