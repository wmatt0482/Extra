// The Native nations whose homelands the trail crosses, in trail order (SPEC §1, §9): trading partners and guides,
// named as living peoples. Each has the trading post's fact (true, kid-level, present tense where true today, sourced
// in docs/SOURCES.md) and a trade the problem generator scales by season. Content stream fills all 8:
// kansa, pawnee, lakota, shoshone, bannock, nez-perce, cayuse, chinook.
export const NATIONS = [
  { id: 'kansa', name: 'Kansa', also: 'Kaw Nation', legs: ['kansas-river'],
    fact: { text: 'The Kansa people lived along the Kansas River, which is named for them. Today the Kaw Nation is based in Oklahoma.',
      say: 'The Kansa people lived along the Kansas River, which is named for them. Today the Kaw Nation is based in Oklahoma.' },
    trade: { give: 'pelts', giveName: 'beaver pelts', get: 'flour', getName: 'sacks of flour', rate: [3, 2] },
    source: 'SOURCES.md#kansa' },
  { id: 'pawnee', name: 'Pawnee', legs: ['fort-kearny'],
    fact: { text: 'The Pawnee grew corn, beans and squash in villages along the Platte River and hunted bison on the plains.',
      say: 'The Pawnee grew corn, beans and squash in villages along the Platte River and hunted bison on the plains.' },
    trade: { give: 'blankets', giveName: 'blankets', get: 'corn', getName: 'bags of corn', rate: [1, 3] },
    source: 'SOURCES.md#pawnee' },
];
export const NATION_BY_ID = Object.fromEntries(NATIONS.map((n) => [n.id, n]));
