// The homestead (SPEC v1.5 §5.4, §3.5, §4.4; screen #farm): the scene's homestead backdrop with a build tray at the side. The three purses are
// shown at the top (trade tokens · savings · Beaver money in nuggets and flakes) and the pieces are grouped by the purse that prices them: small
// pieces with tokens (garden rows, flower beds, a mailbox, a bench, a chicken coop, apple trees), middle pieces with savings (the cabin first, then
// the well, the fence, the corral, the cow, the name plate with the farm's name), the big pieces with Beaver money (the barn, the orchard, the frame
// house, the mill, the schoolhouse). "Build" is a tap, greyed when short and saying why ("needs 3 more tokens"); on a savings piece an optional
// "Work it out" ("The well costs $25 and the farm has $63. How much is left?": a 'buy' problem for a token). A tapped piece says its line and its
// fact. A site switcher shows when there are two farms. Building plays scene.buildPiece (the barn goes up in three beats while the companions
// hammer) and may earn a deed. Nothing decays, nothing is lost, there is no timer and no "come back tomorrow". The module draws; the journey's
// homestead.js owns the costs and the rules (canBuild / buildPiece / homesteadView), main.js app.farm* does the building.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { HOMESTEAD_PIECES, PIECE_BY_ID } from '../content/homestead.js';
import { SITES } from '../content/routes.js';
import { HOMESTEAD_COST } from '../journey/economy.js';

export const PURSES = Object.freeze([
  { id: 'tokens', name: 'Garden and yard', emoji: '🪙', sub: 'trade tokens' },
  { id: 'savings', name: 'The farm', emoji: '💵', sub: 'savings' },
  { id: 'gold', name: 'Big pieces', emoji: '🦫', sub: 'Beaver money' },
]);
export const FARM_TEXT = Object.freeze({ empty: 'A tent and a campfire for now. Build the cabin first!', pick: 'Tap a piece to hear about it.', first: 'Your farm! Tap a piece to build it.', workTitle: 'The farm' });
const SITE_NAME = Object.fromEntries(SITES.map((s) => [s.id, s.name]));
/** The cost of a piece in words ("6 tokens", "$40", "5 nuggets"). */
export function costText(id) {
  const c = HOMESTEAD_COST[id] || {};
  if (c.tokens) return `${c.tokens} token${c.tokens === 1 ? '' : 's'}`;
  if (c.savings) return `$${money(c.savings)}`;
  if (c.nuggets) return `${c.nuggets} nugget${c.nuggets === 1 ? '' : 's'}`;
  return 'free';
}
/** Every line the farm may say that is known ahead (piece names, says and facts; the work-it-out intro), for the natural voice to prepare. */
export function farmTexts() {
  const out = [FARM_TEXT.empty, FARM_TEXT.pick, FARM_TEXT.first];
  for (const p of HOMESTEAD_PIECES) { out.push(p.name, p.say); if (p.fact) out.push(p.fact.say || p.fact.text); }
  return out;
}
/** The 'buy' problem on a savings piece: what it costs, what the farm has, what is left (Rookie dollars, a subtraction a 4th grader does). */
export function workProblem(piece, cost, have, words) {
  const left = have - cost;
  const text = `The ${piece.name.toLowerCase()} costs $${cost} and the farm has $${have}. How much is left?`;
  const say = `The ${piece.name.toLowerCase()} costs ${words(cost)} ${cost === 1 ? 'dollar' : 'dollars'} and the farm has ${words(have)} ${have === 1 ? 'dollar' : 'dollars'}. How much is left?`;
  return { kind: 'buy', fact: null, text, say, answer: left, unit: '$', work: [`$${have} − $${cost}`, `${have} − ${cost} = ${left}`, `$${left} is left in savings`] };
}

export function createHomestead(app) {
  const root = $('#screen-farm');
  const title = $('#farm-title');
  const sitesEl = $('#farm-sites');
  const pursesEl = $('#farm-purses');
  const detail = $('#farm-detail');
  const tray = $('#farm-tray');
  let site = 'willamette', selected = null, busy = false;
  const next = $('#farm-next');
  next.addEventListener('click', () => { if (!busy) app.newSeason(); });
  const JA = () => app.v2.JA;
  const farm = () => app.save.farm;

  function siteList() { return SITES.filter((s) => farm().sites && farm().sites[s.id]); }
  function setSite(id) { site = id; selected = null; paint(); app.sceneFarm(site); }

  function purseBox(p, bal, tokens) {
    const loose = bal.flakes % 10;
    const label = p.id === 'tokens' ? String(tokens) : p.id === 'savings' ? `$${money(bal.savings)}` : `${bal.nuggets} nugget${bal.nuggets === 1 ? '' : 's'}`;
    const aria = p.id === 'gold' ? `${p.sub}: ${label} and ${loose} flake${loose === 1 ? '' : 's'}` : `${p.sub}: ${label}`;
    return h('div', { class: 'farm-purse', 'data-purse': p.id, 'aria-label': aria }, h('span', { class: 'fp-emoji', 'aria-hidden': 'true' }, p.emoji),
      h('span', { class: 'fp-text' }, h('small', {}, p.id === 'tokens' ? 'tokens' : p.id === 'savings' ? 'savings' : 'Beaver money'), h('b', {}, label), p.id === 'gold' ? h('i', { class: 'fp-flakes' }, `${loose} flake${loose === 1 ? '' : 's'}`) : null));
  }
  function row(piece, view) {
    const J = app.save.journey;
    const s = farm().sites[site];
    const count = (s.pieces[piece.id] | 0), max = piece.max || 1;
    const can = JA().canBuild(farm(), site, piece.id, J);
    const built = count >= max;
    const free = piece.pay === 'free';
    const status = built ? (max > 1 ? `built ${count} of ${max}` : 'built') : can.ok ? 'ready to build' : can.why;
    const left = h('button', { class: 'fm-info', 'data-piece-info': piece.id, 'data-sfx': '', 'aria-label': `${piece.name}: ${status}` },
      h('span', { class: 'fm-emoji', 'aria-hidden': 'true' }, piece.emoji),
      h('span', { class: 'fm-text' }, h('b', {}, piece.name, max > 1 ? h('i', {}, ` ${count}/${max}`) : null), h('small', { class: 'fm-status' }, free ? 'comes with the cabin' : status)));
    left.addEventListener('click', () => select(piece.id));
    const kids = [left];
    if (!free) {
      const cost = h('span', { class: 'fm-cost' }, costText(piece.id));
      kids.push(cost);
      const b = h('button', { class: 'btn btn-sm fm-build ' + (can.ok ? 'btn-go' : ''), 'data-build': piece.id, 'data-sfx': '', disabled: !can.ok || busy, 'aria-label': can.ok ? `Build the ${piece.name}` : `${piece.name}: ${can.why}`, title: can.ok ? '' : can.why }, built ? 'Built' : 'Build');
      b.addEventListener('click', () => build(piece.id));
      kids.push(b);
      if (piece.pay === 'savings' && can.ok && !app.save.seen.worked[`${site}:${piece.id}`]) {
        const w = h('button', { class: 'btn btn-sm fm-work', 'data-work': piece.id, 'data-sfx': '', disabled: busy }, 'Work it out');
        w.setAttribute('aria-label', `Work it out: how much is left after the ${piece.name.toLowerCase()}, for a trade token`);
        w.addEventListener('click', () => workItOut(piece.id));
        kids.push(w);
      }
    }
    return h('div', { class: 'fm-row' + (built ? ' built' : '') + (can.ok ? ' ready' : '') + (selected === piece.id ? ' sel' : ''), 'data-piece': piece.id, 'data-code': can.code || '' }, ...kids);
  }
  function paint() {
    const J = app.save.journey;
    const s = farm().sites[site];
    if (!s) { tray.replaceChildren(); return; }
    const view = JA().homesteadView(farm(), site, J);
    const bal = JA().farmBalance(farm());
    const name = s.name || SITE_NAME[site];
    title.textContent = name;
    $('#farm-sub').textContent = `${SITE_NAME[site]}${s.founded ? ` · founded ${s.founded}` : ''} · ${view.built} of ${view.of} pieces`;
    const sl = siteList();
    sitesEl.hidden = sl.length < 2;
    sitesEl.replaceChildren(...sl.map((x) => {
      const b = h('button', { class: 'seg-btn' + (x.id === site ? ' on' : ''), role: 'tab', 'aria-selected': String(x.id === site), 'data-site': x.id, 'data-sfx': '' }, farm().sites[x.id].name || x.name.replace(' Valley', ''));
      b.addEventListener('click', () => setSite(x.id));
      return b;
    }));
    pursesEl.replaceChildren(...PURSES.map((p) => purseBox(p, bal, (J && J.tokens) | 0)));
    const pieces = HOMESTEAD_PIECES.filter((p) => !Array.isArray(p.sites) || p.sites.includes(site));
    tray.replaceChildren(...[PURSES[1], PURSES[0], PURSES[2]].map((p) => {            // (the cabin is the first piece: the savings group first, then the garden and yard, then the big pieces)
      const mine = pieces.filter((x) => x.pay === p.id || (p.id === 'savings' && x.pay === 'free'));
      return h('section', { class: 'fm-group', 'data-group': p.id }, h('div', { class: 'fm-head' }, h('span', { 'aria-hidden': 'true' }, p.emoji), h('b', {}, p.name), h('small', {}, p.sub)), ...mine.map((x) => row(x, view)));
    }));
    const pc = selected && PIECE_BY_ID[selected];
    detail.hidden = !pc;
    if (pc) {
      const built = (s.pieces[pc.id] | 0) > 0;
      detail.replaceChildren(h('b', {}, `${pc.emoji} ${pc.name}`), h('p', {}, built ? pc.say : `${pc.say} ${costText(pc.id) !== 'free' ? `It costs ${costText(pc.id)}.` : ''}`.trim()), pc.fact ? h('p', { class: 'fm-fact' }, pc.fact.text) : null);
    }
    next.hidden = !(J && J.done);
    $('#farm-empty').hidden = !!(s.pieces.cabin);
    $('#farm-empty').textContent = FARM_TEXT.empty;
  }
  function select(id) {
    selected = id; paint();
    const pc = PIECE_BY_ID[id];
    if (pc) app.sayAll([pc.name, pc.say, ...(pc.fact && (farm().sites[site].pieces[id] | 0) > 0 ? [pc.fact.say || pc.fact.text] : [])]);
  }
  async function build(id) {
    if (busy) return;
    busy = true; paint();
    try { await app.farmBuild(site, id); } finally { busy = false; if (app.screen === 'farm') paint(); }
  }
  async function workItOut(id) {
    if (busy) return;
    busy = true; paint();
    try { await app.farmWork(site, id); } finally { busy = false; if (app.screen === 'farm') paint(); }
  }
  return {
    /** Open the farm of a site (opts.site; else the last one looked at, else the first). */
    show(opts = {}) {
      const list = siteList();
      if (!list.length) { app.go('title'); return; }
      site = opts.site && farm().sites[opts.site] ? opts.site : list.some((s) => s.id === site) ? site : list[0].id;
      selected = opts.piece || null;
      busy = false;
      paint();
      app.sceneFarm(site);
      if (opts.fresh) app.say(FARM_TEXT.first);
    },
    hide() { busy = false; },
    refresh() { if (app.screen === 'farm') { paint(); app.sceneFarm(site); } },
    /** The scene's tap on the homestead: { slot, piece | null }. */
    tap(e) { if (e && e.piece && PIECE_BY_ID[e.piece]) select(e.piece); else app.toast('Something good can go here'); },
    get site() { return site; },
    get busy() { return busy; },
    get selected() { return selected; },
  };
}
