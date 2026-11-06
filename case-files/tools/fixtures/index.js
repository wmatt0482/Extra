// PLACEHOLDER: replaced by the content agent's index.js at merge. Exports exactly the SPEC §5 surface:
// TRAINING (one case), ARCS ([{ id, title, blurb, knowledge, cases }]) and CASE_BY_ID.
import training from './fixture/training.js';
import erie01 from './fixture/erie-01.js';
import erie02 from './fixture/erie-02.js';

export const TRAINING = training;
export const ARCS = [
  { id: 'erie', title: 'The Erie Canal Files', blurb: 'Rochester, New York, in the days of locks, packet boats and mules on the towpath.',
    knowledge: ['The Erie Canal opened in 1825 and ran 363 miles from Albany to Buffalo.'], cases: [erie01, erie02] },
];
export const CASE_BY_ID = Object.fromEntries([TRAINING, ...ARCS.flatMap((a) => a.cases)].map((c) => [c.id, c]));
