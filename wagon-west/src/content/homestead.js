// The homestead (SPEC v1.5 §2.7): the pieces a farm is built from, with their words and the slot the scene draws them in. The costs are
// the journey's (journey/economy.js HOMESTEAD_COST); this file is names, emoji, rules of placement and lines.
//   { id, name, emoji, pay, slot, needs, sites, max, say, fact? }
//   pay    'tokens' | 'savings' | 'gold' (which purse prices it) | 'free' (comes with another piece)
//   slot   where the scene draws it (HOMESTEAD_SLOTS, left to right)
//   needs  piece ids that must be built first; `needsCount` (optional) asks for more than one of a needed piece: the orchard needs three
//          apple trees, so it has needs ['apple-tree'] and needsCount { 'apple-tree': 3 }
//   sites  null = both homesteads, else the site ids it can be built at ('willamette' | 'sacramento')
//   max    how many can be built (rows, trees)
//   say    the line when it is built (numbers as words)
//   fact   an optional true line, with its source
// Kid rules: nothing decays, nothing is lost, nothing has a timer; a piece is never worn or empty.
const P = (id, name, emoji, pay, slot, needs, sites, max, say, extra = {}) => ({ id, name, emoji, pay, slot, needs, sites, max, say, ...extra });

export const HOMESTEAD_PIECES = [
  P('cabin', 'Log cabin', '🛖', 'savings', 'house', [], null, 1, 'A cabin of your own!'),
  P('trophy-shelf', 'Trophy shelf', '🏆', 'free', 'house', ['cabin'], null, 1, 'The trophies shine on their shelf.'),
  P('name-plate', 'Name plate at the gate', '🪧', 'savings', 'gate', ['cabin'], null, 1, 'The farm has its name on the gate!'),
  P('well', 'Well', '🪣', 'savings', 'yard', ['cabin'], null, 1, 'Cool, clear water from your own well!'),
  P('fence', 'Split-rail fence', '🪵', 'savings', 'pasture', ['cabin'], null, 1, 'A fence around the pasture!'),
  P('corral', 'Corral', '🐂', 'savings', 'pasture', ['fence'], null, 1, 'The team has a corral of its own.'),
  P('cow', 'A milk cow', '🐄', 'savings', 'pasture', ['corral'], null, 1, 'Moo! Fresh milk for everyone.'),
  P('garden', 'Garden row', '🥕', 'tokens', 'garden', ['cabin'], null, 4, 'A new row of vegetables!'),
  P('flowers', 'Flower bed', '🌷', 'tokens', 'yard', ['cabin'], null, 3, 'Flowers by the door!'),
  P('mailbox', 'Mailbox', '📮', 'tokens', 'gate', ['name-plate'], null, 1, 'Your letters have a mailbox of their own.'),
  P('bench', 'Porch bench', '🪑', 'tokens', 'house', ['cabin'], null, 1, 'A bench on the porch for the whole crew.'),
  P('coop', 'Chicken coop', '🐔', 'tokens', 'yard', ['cabin'], null, 1, 'Cluck, cluck! Fresh eggs.'),
  P('apple-tree', 'Apple tree', '🍎', 'tokens', 'orchard', ['cabin'], ['willamette'], 6, 'An apple tree takes root.',
    { fact: { text: 'In 1847 a farmer named Henderson Luelling brought a wagon full of young fruit trees west from Iowa to Oregon, and his nursery helped start the orchards of the Pacific Northwest.',
      say: 'In eighteen forty-seven a farmer named Henderson Luelling brought a wagon full of young fruit trees west from Iowa to Oregon, and his nursery helped start the orchards of the Pacific Northwest.',
      source: 'SOURCES.md#apple-tree' } }),
  P('barn', 'Barn', '🏠', 'gold', 'barn', ['cabin', 'fence'], null, 1, 'The whole crew raises the barn!'),
  P('orchard', 'Orchard', '🍐', 'gold', 'orchard', ['apple-tree'], ['willamette'], 1, 'Rows and rows of fruit trees!', { needsCount: { 'apple-tree': 3 } }),
  P('frame-house', 'Frame house', '🏡', 'gold', 'house', ['cabin', 'barn'], null, 1, 'A real house with a painted front door!'),
  P('mill', 'Grist mill', '⚙️', 'gold', 'creek', ['barn'], ['willamette'], 1, 'The mill wheel turns by the creek.'),
  P('vineyard', 'Vineyard', '🍇', 'gold', 'orchard', ['barn'], ['sacramento'], 1, 'Grapevines climb the hillside.'),
  P('windmill', 'Windmill', '🌬️', 'gold', 'yard', ['well', 'barn'], ['sacramento'], 1, 'The windmill spins in the breeze.'),
  P('schoolhouse', 'Schoolhouse', '🏫', 'gold', 'edge', ['frame-house'], null, 1, 'A schoolhouse for the whole valley!'),
];
export const PIECE_BY_ID = Object.fromEntries(HOMESTEAD_PIECES.map((p) => [p.id, p]));
/** The slots the scene draws, left to right. */
export const HOMESTEAD_SLOTS = ['edge', 'orchard', 'barn', 'house', 'yard', 'garden', 'creek', 'pasture', 'gate'];
