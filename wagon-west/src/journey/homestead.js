// The homestead (SPEC v1.5 §3.5): the endgame that grows. Arriving at a trail's end founds a homestead there (the Willamette farm or the Sacramento claim);
// every journey banks what it brings: the dollars left in the purse become the farm's SAVINGS, the gold becomes BEAVER MONEY (flakes), the team joins the
// pasture. Pieces are bought with what fits them: small pieces with trade TOKENS (the carried purse, J.tokens), middle pieces with savings, big pieces with gold.
// NOTHING DECAYS, NOTHING IS LOST, NOTHING HAS A TIMER: no function here reads the clock; nothing in the farm ever goes down except the `…Out` counters that
// pay for a piece. The currencies are earned / spent counters (savingsIn / savingsOut, goldIn / goldOut) so that the family-sync merge is a plain max of each
// (a spend on one device and an earning on the other both survive). Pure: no DOM, no clock, no storage.
import { PIECE_BY_ID, HOMESTEAD_PIECES, HOMESTEAD_SLOTS } from '../content/homestead.js';
import { SITES } from '../content/routes.js';
import { HOMESTEAD_COST, GOLD } from './economy.js';
import { seasonOf, siteOfLeg, legList } from './route.js';

const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const clone = (x) => JSON.parse(JSON.stringify(x));
/** The most animals of one kind the pasture keeps (the scene draws up to eight). */
export const ANIMAL_CAP = 12;
export const LOG_KEPT = 30;

/** A new, empty farm. */
export const newFarm = () => ({ sites: {}, savingsIn: 0, savingsOut: 0, goldIn: 0, goldOut: 0, animals: { oxen: 0, mules: 0 }, log: [] });

/** A farm from anything (a save): every field present and sane, unknown fields dropped. */
export function normalizeFarm(raw) {
  const f = newFarm();
  if (!isObj(raw)) return f;
  for (const k of ['savingsIn', 'savingsOut', 'goldIn', 'goldOut']) f[k] = num(raw[k]);
  if (isObj(raw.animals)) for (const k of ['oxen', 'mules']) f.animals[k] = Math.min(ANIMAL_CAP, num(raw.animals[k]));
  if (isObj(raw.sites)) {
    for (const [id, s] of Object.entries(raw.sites)) {
      if (!isObj(s)) continue;
      const pieces = {};
      if (isObj(s.pieces)) for (const [pid, c] of Object.entries(s.pieces)) if (num(c) > 0) pieces[pid] = num(c);
      f.sites[id] = { name: typeof s.name === 'string' ? s.name.slice(0, 40) : '', founded: Number.isFinite(s.founded) ? s.founded : null, pieces };
    }
  }
  if (Array.isArray(raw.log)) f.log = raw.log.filter((e) => isObj(e) && typeof e.id === 'string').slice(-LOG_KEPT).map((e) => ({ ...e }));
  return f;
}

/** Found a homestead at a site (idempotent; the name only fills in when it is still empty). → the site { name, founded, pieces }, null for an unknown site. */
export function foundSite(farm, siteId, { name = '', year = null } = {}) {
  if (!farm || !SITE_BY_ID[siteId]) return null;
  if (!isObj(farm.sites)) farm.sites = {};
  let s = farm.sites[siteId];
  if (!s) s = farm.sites[siteId] = { name: '', founded: Number.isFinite(year) ? year : null, pieces: {} };
  if (!s.name && name) s.name = String(name).slice(0, 40);
  if (s.founded == null && Number.isFinite(year)) s.founded = year;
  return s;
}

/** The farm's purses: savings = savingsIn − savingsOut (Rookie dollars), flakes = goldIn − goldOut, nuggets = whole nuggets of those flakes. */
export function farmBalance(farm) {
  const savings = Math.max(0, num(farm && farm.savingsIn) - num(farm && farm.savingsOut));
  const flakes = Math.max(0, num(farm && farm.goldIn) - num(farm && farm.goldOut));
  return { savings, flakes, nuggets: Math.floor(flakes / GOLD.flakesPerNugget) };
}

// a piece's `needs` in any of the shapes: ['cabin'], ['apple-tree', 'apple-tree', 'apple-tree'], 'apple-tree × 3', { id, count } → [{ id, count }]
function needsOf(piece) {
  const out = [];
  const add = (id, count = 1) => { const e = out.find((x) => x.id === id); if (e) e.count = Math.max(e.count, count); else out.push({ id, count }); };
  for (const n of Array.isArray(piece.needs) ? piece.needs : piece.needs ? [piece.needs] : []) {
    if (typeof n === 'string') { const m = /^\s*([\w-]+)\s*(?:[×x*]\s*(\d+))?\s*$/.exec(n); if (m) add(m[1], m[2] ? Number(m[2]) : 1); }
    else if (n && n.id) add(n.id, n.count || n.n || 1);
  }
  if (piece.needsCount && typeof piece.needsCount === 'object') for (const [id, c] of Object.entries(piece.needsCount)) add(id, Number(c) || 1);   // the content's `needsCount` { 'apple-tree': 3 }
  return out;
}
const shortName = (siteId) => (SITE_BY_ID[siteId] ? SITE_BY_ID[siteId].name.replace(' Valley', '') : siteId);
const words = (id) => String(id).replace(/-/g, ' ');
const plural = (n, one, many) => (n === 1 ? one : many);

/** Can this piece be built now? → { ok, why, code }. code: 'ok' | 'built' | 'needs' | 'purse' | 'site' | 'free' | 'nosite' | 'nopiece'. why: 'built' | 'needs the cabin first' | 'needs 3 more tokens' | 'only at the Willamette farm' | 'needs $12 more in savings' |
 *  'needs 2 more nuggets' | 'comes with the cabin' | 'no homestead there yet'. `J` is the journey whose tokens are the carried purse (none = no tokens). */
export function canBuild(farm, siteId, pieceId, J = null) {
  const piece = PIECE_BY_ID[pieceId];
  const site = farm && farm.sites && farm.sites[siteId];
  if (!piece) return { ok: false, why: 'no such piece', code: 'nopiece' };
  if (!site) return { ok: false, why: 'no homestead there yet', code: 'nosite' };
  if (Array.isArray(piece.sites) && !piece.sites.includes(siteId)) return { ok: false, why: `only at the ${shortName(piece.sites[0])}`, code: 'site' };
  const have = num(site.pieces[pieceId]);
  if (have >= (piece.max || 1)) return { ok: false, why: 'built', code: 'built' };
  if (piece.pay === 'free' || (HOMESTEAD_COST[pieceId] && !Object.keys(HOMESTEAD_COST[pieceId]).length)) return { ok: false, why: 'comes with the cabin', code: 'free' };
  for (const n of needsOf(piece)) {
    const got = num(site.pieces[n.id]);
    if (got < n.count) return { ok: false, code: 'needs', why: n.count > 1 ? `needs ${n.count - got} more ${words(n.id)}${n.count - got === 1 ? '' : 's'} first` : `needs the ${words(n.id)} first` };
  }
  const cost = HOMESTEAD_COST[pieceId] || {};
  const bal = farmBalance(farm);
  if (cost.tokens && num(J && J.tokens) < cost.tokens) { const n = cost.tokens - num(J && J.tokens); return { ok: false, why: `needs ${n} more ${plural(n, 'token', 'tokens')}`, code: 'purse' }; }
  if (cost.savings && bal.savings < cost.savings) return { ok: false, why: `needs $${cost.savings - bal.savings} more in savings`, code: 'purse' };
  if (cost.nuggets && bal.nuggets < cost.nuggets) { const n = cost.nuggets - bal.nuggets; return { ok: false, why: `needs ${n} more ${plural(n, 'nugget', 'nuggets')}`, code: 'purse' }; }
  return { ok: true, why: '', code: 'ok' };
}

/** Build a piece: tokens come out of J.tokens (the carried purse), savings and gold out of the farm (savingsOut / goldOut grow); nothing is ever undone.
 *  → { ok, why?, paid: { tokens, savings, nuggets }, count, say }. The cabin brings the trophy shelf with it. */
export function buildPiece(farm, siteId, pieceId, J = null) {
  const can = canBuild(farm, siteId, pieceId, J);
  const none = { tokens: 0, savings: 0, nuggets: 0 };
  const piece = PIECE_BY_ID[pieceId];
  if (!can.ok) return { ok: false, why: can.why, paid: none, count: num(farm && farm.sites && farm.sites[siteId] && farm.sites[siteId].pieces[pieceId]), say: '' };
  const site = farm.sites[siteId], cost = HOMESTEAD_COST[pieceId] || {};
  const paid = { tokens: cost.tokens || 0, savings: cost.savings || 0, nuggets: cost.nuggets || 0 };
  if (paid.tokens) J.tokens = Math.max(0, num(J.tokens) - paid.tokens);
  farm.savingsOut = num(farm.savingsOut) + paid.savings;
  farm.goldOut = num(farm.goldOut) + paid.nuggets * GOLD.flakesPerNugget;
  const count = num(site.pieces[pieceId]) + 1;
  site.pieces[pieceId] = count;
  if (pieceId === 'cabin' && PIECE_BY_ID['trophy-shelf']) site.pieces['trophy-shelf'] = 1;
  if (!Array.isArray(farm.log)) farm.log = [];
  farm.log.push({ id: `${siteId}:${pieceId}:${count}`, year: J && Number.isFinite(J.year) ? J.year : null, site: siteId, piece: pieceId, count, paid });
  if (farm.log.length > LOG_KEPT * 2) farm.log.splice(0, farm.log.length - LOG_KEPT * 2);
  return { ok: true, paid, count, say: (piece && piece.say) || '' };
}

/** Bank a journey at a homestead, once (J.banked): savingsIn += floor(J.cash / priceMult) (Rookie dollars, so a Pioneer purse does not inflate the farm), goldIn += J.gold
 *  (flakes), the team joins the pasture (animals.oxen / mules += J.animals.n, at most ANIMAL_CAP). → { savings, flakes, animals }; a second call returns the first's. */
export function bankJourney(farm, J, siteId) {
  if (!farm || !J) return { savings: 0, flakes: 0, animals: 0 };
  if (J.banked) return J.bank || { savings: 0, flakes: 0, animals: 0 };
  const mult = seasonOf(J.season).priceMult || 1;
  const savings = Math.max(0, Math.floor((Number(J.cash) || 0) / mult));
  const flakes = Math.max(0, Math.floor(Number(J.gold) || 0));
  const kind = J.animal === 'mules' ? 'mules' : 'oxen';
  const animals = Math.max(0, (J.animals && J.animals.n) | 0);
  farm.savingsIn = num(farm.savingsIn) + savings;
  farm.goldIn = num(farm.goldIn) + flakes;
  if (!isObj(farm.animals)) farm.animals = { oxen: 0, mules: 0 };
  farm.animals[kind] = Math.min(ANIMAL_CAP, num(farm.animals[kind]) + animals);
  J.banked = true;
  J.bank = { savings, flakes, animals, site: siteId || null };
  return J.bank;
}

/** What a farm sends along on a Gold Road start: each garden row 20 lb, the orchard 40 lb. → { foodLb }. */
export function farmGifts(farm, siteId) {
  const s = farm && farm.sites && farm.sites[siteId];
  if (!s) return { foodLb: 0 };
  return { foodLb: num(s.pieces.garden) * GOLD.gardenLb + (num(s.pieces.orchard) > 0 ? GOLD.orchardLb : 0) };
}

/** The pieces a site can have (its `sites` allows it). */
export const piecesAt = (siteId) => HOMESTEAD_PIECES.filter((p) => !Array.isArray(p.sites) || p.sites.includes(siteId));

/** The scene's and the tray's view of a site: { name, slots: { [slot]: [{ id, count, art }] }, animals, built, of, complete, next: [{ id, cost, ok, why }] } (`next`: the pieces whose
 *  needs are met and that are not built to their max, with the purse they cost and whether it is affordable now; `J` gives the tokens). built / of count the kinds of piece. */
export function homesteadView(farm, siteId, J = null) {
  const site = farm && farm.sites && farm.sites[siteId];
  const slots = Object.fromEntries(HOMESTEAD_SLOTS.map((s) => [s, []]));
  const all = piecesAt(siteId);
  if (!site) return { name: '', slots, animals: { oxen: 0, mules: 0 }, built: 0, of: all.length, complete: false, next: [] };
  let built = 0, complete = true;
  for (const p of all) {
    const c = num(site.pieces[p.id]);
    if (c > 0) { built++; (slots[p.slot] || (slots[p.slot] = [])).push({ id: p.id, count: c, art: c > 1 ? `${p.id}-${c}` : p.id }); }
    if (c < (p.max || 1)) complete = false;
  }
  const next = [];
  for (const p of all) {
    if (num(site.pieces[p.id]) >= (p.max || 1)) continue;
    const c = canBuild(farm, siteId, p.id, J);
    if (c.ok || c.code === 'purse') next.push({ id: p.id, cost: { ...(HOMESTEAD_COST[p.id] || {}) }, ok: c.ok, why: c.why });
  }
  return { name: site.name, slots, animals: { ...(farm.animals || { oxen: 0, mules: 0 }) }, built, of: all.length, complete, next };
}

/** The family-sync merge of two farms (SPEC v1.5 §5.6): `s` is the later doc. sites union by id; per site the name is the later doc's, else the other's; `founded` min;
 *  `pieces` per id the larger count (a piece built on either device stays built); savingsIn / savingsOut / goldIn / goldOut each the larger (a balance is never
 *  conjured from nothing, and a spend on one device and an earning on the other both survive); animals per kind max; log union by id, the newest 30. Returns a new farm. */
export function mergeFarm(s, o) {
  const a = normalizeFarm(s), b = normalizeFarm(o);
  const out = newFarm();
  for (const k of ['savingsIn', 'savingsOut', 'goldIn', 'goldOut']) out[k] = Math.max(a[k], b[k]);
  for (const k of ['oxen', 'mules']) out.animals[k] = Math.max(a.animals[k], b.animals[k]);
  for (const id of new Set([...Object.keys(a.sites), ...Object.keys(b.sites)])) {
    const x = a.sites[id], y = b.sites[id];
    if (!x || !y) { out.sites[id] = clone(x || y); continue; }
    const pieces = { ...y.pieces };
    for (const [pid, c] of Object.entries(x.pieces)) pieces[pid] = Math.max(num(pieces[pid]), c);
    const founded = [x.founded, y.founded].filter((v) => Number.isFinite(v));
    out.sites[id] = { name: x.name || y.name, founded: founded.length ? Math.min(...founded) : null, pieces };
  }
  const seen = new Set(), log = [];
  for (const e of [...b.log, ...a.log]) if (!seen.has(e.id)) { seen.add(e.id); log.push(e); }
  out.log = log.map((e, i) => [e, i]).sort((p, q) => (Number(p[0].year) || 0) - (Number(q[0].year) || 0) || p[1] - q[1]).map((x) => x[0]).slice(-LOG_KEPT);
  return out;
}

/** The site a finished journey ends at (the plan's last leg), or null. */
export function endSiteOf(J) {
  const plan = Array.isArray(J && J.plan) && J.plan.length ? J.plan : legList();
  const last = plan[plan.length - 1];
  return last ? siteOfLeg(last.id) : null;
}
