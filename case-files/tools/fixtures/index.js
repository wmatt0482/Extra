// PLACEHOLDER: replaced by the content agent's index.js at merge. Exports exactly the SPEC §5 surface:
// TRAINING (one case), ARCS ([{ id, title, blurb, knowledge, cases }]) and CASE_BY_ID.
import training from './fixture/training.js';
import erie01 from './fixture/erie-01.js';
import erie02 from './fixture/erie-02.js';
import genesee01 from './fixture/genesee-01.js';
import genesee02 from './fixture/genesee-02.js';
import genesee03 from './fixture/genesee-03.js';
import genesee04 from './fixture/genesee-04.js';
import genesee05 from './fixture/genesee-05.js';

export const TRAINING = training;
export const ARCS = [
  { id: 'erie', title: 'The Erie Canal Files', blurb: 'Rochester, New York, in the days of locks, packet boats and mules on the towpath.',
    knowledge: ['The Erie Canal opened in 1825 and ran 363 miles from Albany to Buffalo.'], cases: [erie01, erie02], map: 'erie' },
  { id: 'genesee', title: 'The Genesee Valley', blurb: 'Rochester and the river valley: falls, mills, gardens and a lighthouse on the lake.',
    knowledge: ['The Genesee River flows north through Rochester into Lake Ontario.'], cases: [genesee01, genesee02, genesee03, genesee04, genesee05], map: 'genesee' },
];
export const CASE_BY_ID = Object.fromEntries([TRAINING, ...ARCS.flatMap((a) => a.cases)].map((c) => [c.id, c]));
