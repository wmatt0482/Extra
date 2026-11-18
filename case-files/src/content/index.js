import TRAINING from './training.js';
import erie01 from './erie/erie-01.js';
import erie02 from './erie/erie-02.js';
import erie03 from './erie/erie-03.js';
import erie04 from './erie/erie-04.js';
import erie05 from './erie/erie-05.js';

import genesee01 from './genesee/genesee-01.js';
import genesee02 from './genesee/genesee-02.js';
import genesee03 from './genesee/genesee-03.js';
import genesee04 from './genesee/genesee-04.js';
import genesee05 from './genesee/genesee-05.js';

export { TRAINING };

const erieCases = [erie01, erie02, erie03, erie04, erie05];
const geneseeCases = [genesee01, genesee02, genesee03, genesee04, genesee05];

export const ARCS = [
  {
    id: 'erie',
    map: 'erie',
    title: 'The Erie Canal',
    blurb: 'Rochester, New York, along the great canal. Locks, mules, toll collectors and a river crossed by a bridge of water.',
    knowledge: erieCases.map((c) => c.knowledge),
    // Words each met at least 12 times across the arc's documents, briefings and closing lines (checked by tools/content-tests.mjs).
    targetWords: [
      { word: 'lock', forms: ['lock', 'locks'] },
      { word: 'aqueduct', forms: ['aqueduct', 'aqueducts'] },
      { word: 'toll', forms: ['toll', 'tolls'] },
      { word: 'cargo', forms: ['cargo'] },
      { word: 'towpath', forms: ['towpath'] },
      { word: 'packet', forms: ['packet', 'packets'] },
      { word: 'waybill', forms: ['waybill', 'waybills'] },
      { word: 'hoggee', forms: ['hoggee', 'hoggees'] },
      { word: 'channel', forms: ['channel'] },
      { word: 'merchant', forms: ['merchant', 'merchants'] },
    ],
    cases: erieCases,
  },
  {
    id: 'genesee',
    map: 'genesee',
    title: 'The Genesee Valley',
    blurb: 'Rochester and the Genesee River valley, from Ganondagan to Letchworth to the lighthouse at Charlotte. Gardens, newspapers, waterfalls and a lamp on the lake.',
    knowledge: geneseeCases.map((c) => c.knowledge),
    // Words each met at least 12 times across the arc's documents, briefings and closing lines (checked by tools/content-tests.mjs).
    targetWords: [
      { word: 'river', forms: ['river', 'rivers'] },
      { word: 'valley', forms: ['valley', 'valleys'] },
      { word: 'falls', forms: ['falls', 'waterfall', 'waterfalls'] },
      { word: 'gorge', forms: ['gorge'] },
      { word: 'current', forms: ['current'] },
      { word: 'nation', forms: ['nation', 'nations'] },
      { word: 'editor', forms: ['editor'] },
      { word: 'mill', forms: ['mill', 'mills'] },
    ],
    cases: geneseeCases,
  },
];

export const CASE_BY_ID = Object.fromEntries([TRAINING, ...ARCS.flatMap((a) => a.cases)].map((c) => [c.id, c]));
