// The relatives' wagons (SPEC v1.5 §2.6): the first journey is the child's own family (family id 'own'); every later emigrant-trail
// journey is another branch of the family coming west to join the farm ("Uncle Theo's wagon, 1849"), so the letters go home to the
// people at the farm. Flavour only: no stats. The people are invented story people; `from` is only the state they set out from.
export const FAMILIES = [
  { id: 'uncle-theo', name: "Uncle Theo's wagon", emoji: '🧔', from: 'Ohio' },
  { id: 'aunt-june', name: "Aunt June's wagon", emoji: '👩', from: 'Illinois' },
  { id: 'cousin-ruth', name: "Cousin Ruth's wagon", emoji: '👧', from: 'Kentucky' },
  { id: 'grandpa-grandma', name: "Grandpa and Grandma's wagon", emoji: '👴', from: 'Tennessee' },
  { id: 'okafor-cousins', name: "The Okafor cousins' wagon", emoji: '🧑', from: 'Indiana' },
  { id: 'larsen-cousins', name: "The Larsen cousins' wagon", emoji: '🧒', from: 'Wisconsin' },
];
export const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
/** The first journey's wagon: the child's own family (not one of the relatives above). */
export const OWN_FAMILY = { id: 'own', name: 'Your family’s wagon', emoji: '🏠' };
