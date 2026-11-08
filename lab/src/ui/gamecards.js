// The six progress cards (one per game): icon, the level label, the one-line progress, today's target and "last played" as a friendly day word.
// A game the child has not played shows "Try it" and a one-line pitch. Used by the Lab home (each card opens its game) and by Grown-ups
// ("Progress at a glance", read only). The numbers come from lab.summary(...) through the view's `games` (core/summary.js).
import { h } from '../../../spell-jump/src/ui/dom.js';
import { gameBadge } from './glyph.js';

/** "Played today", "Played yesterday", "Last played Tuesday", "Last played last week". */
export function lastPlayedText(label) {
  if (!label) return '';
  if (label === 'Today') return 'Played today';
  if (label === 'Yesterday') return 'Played yesterday';
  return `Last played ${/^(Last week|A while ago)$/.test(label) ? label.toLowerCase() : label}`;
}

/** One card. o = { link: true } makes it a same-origin link to the game. */
export function gameCard(g, { link = false } = {}) {
  const body = [h('div', { class: 'lab-gcard-name' }, g.name)];
  if (g.played) {
    if (g.level) body.push(h('div', { class: 'lab-gcard-level' }, g.level));
    if (g.line) body.push(h('div', { class: 'lab-gcard-line' }, g.line));
    if (g.today) body.push(h('div', { class: 'lab-gcard-today' }, g.today));
    body.push(h('div', { class: 'lab-gcard-last' }, lastPlayedText(g.lastLabel) || 'Played before'));
  } else {
    body.push(h('div', { class: 'lab-gcard-try' }, 'Try it'), h('div', { class: 'lab-gcard-line' }, g.pitch));
  }
  const attrs = { class: `lab-gcard g-${g.game}` + (g.played ? '' : ' fresh'), 'data-game': g.game, 'data-played': String(!!g.played) };
  const badge = h('span', { class: 'lab-gcard-badge', html: gameBadge(g.game, 44) });
  if (link) return h('a', { ...attrs, href: g.path, 'aria-label': `${g.name}. ${g.played ? [g.level, g.line, g.today].filter(Boolean).join('. ') : 'Try it. ' + g.pitch}` }, badge, h('div', { class: 'lab-gcard-body' }, ...body));
  return h('div', attrs, badge, h('div', { class: 'lab-gcard-body' }, ...body));
}

/** The grid of all six. */
export function gameCards(games, o = {}) {
  return h('div', { class: 'lab-gcards' }, ...games.map((g) => gameCard(g, o)));
}
