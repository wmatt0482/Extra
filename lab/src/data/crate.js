// The Lab crate (lab/SPEC.md §2.5): odds shown in the Parent Zone. PURE DATA: no imports.
export const CRATE_ODDS = { c: 86, r: 12, e: 2 };            // percent per rarity; sums to 100
export const PITY_ODDS = { c: 0, r: 85, e: 15 };             // the 7th crate after the last rare-or-better
export const PITY_AFTER = 6;                                 // this many commons in a row, then the next is rare-or-better
export const RARITY_NAMES = { c: 'Common', r: 'Rare', e: 'Epic' };
export const RARITY_ORDER = ['c', 'r', 'e'];
export const DUPLICATE_REFUND = { c: 150, r: 600, e: 1500 };   // half the item price
export const POOL_WEIGHT = { played: 3, other: 1 };           // an item of a game played in the last 14 days is three times as likely
