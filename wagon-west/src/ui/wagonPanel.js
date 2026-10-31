// The Wagon panel (SPEC v1.2 §1): what the wagon carries, drawn so a child can read it. Opened from the trail HUD's food
// box and from the pause sheet's "Wagon" button; closes back to the trail. Food by kind as stacks that shrink as the
// party eats (sacks of flour, sides of bacon, bags of beans, a basket of wild food), "Food for 6 days · Fort Laramie in
// 9 days" in plain words (never a score), the other goods with counts (spare parts, rope, blankets, arrows, pelts, the
// second yoke), the animals ("the oxen are fresh / tired"), the companions with their mood faces and what each one is
// good at, and "Ask Eli: how many days?" (a 'distance' or 'ration' problem for a token, once a leg each: main.js
// app.askEli). The panel owns no data: main.js hands it app.wagonInfo() and it draws that.
// Also here: the one-line skills of the companions (the Outfit's cards, the title's party line, the HUD's skill toast
// use them): the content stream's COMPANIONS[].skill = { id, name, text } when it exists, else the lines below.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { companionSvg } from './outfit.js';
import { moodFace } from './title.js';

export const FOOD_KINDS = Object.freeze([
  { id: 'flour', name: 'Flour', unit: 'sack', plural: 'sacks', lb: 50, emoji: '🌾' },
  { id: 'bacon', name: 'Bacon', unit: 'side', plural: 'sides', lb: 20, emoji: '🥓' },
  { id: 'beans', name: 'Beans', unit: 'bag', plural: 'bags', lb: 25, emoji: '🫘' },
  { id: 'other', name: 'Wild food', unit: 'basket', plural: 'baskets', lb: 10, emoji: '🧺' },
]);
const MAX_BLOCKS = 14;

// what each companion is good at: a few words for the party line ("Ada fixes wheels") and a full line for their card
const SKILL_SHORT = { blacksmith: 'fixes wheels', teacher: 'gives tips', fiddler: 'lifts spirits', scout: 'scouts', cook: 'stretches the food', doctor: 'rests the tired', carpenter: 'saves parts', storyteller: 'finds cards' };
const SKILL_LINE = {
  blacksmith: 'Fixes one breakdown a leg without a spare part.',
  teacher: 'Shows a tip before the answer, once a leg.',
  fiddler: 'Plays by the fire: everyone is happier after a night at camp.',
  scout: 'Spots an extra animal a leg and sees the weather a day early.',
  cook: 'The food lasts longer and the berries come twice as often.',
  doctor: 'A tired friend is rested again in one day.',
  carpenter: 'Floats a river without rope and saves spare parts.',
  storyteller: 'A campfire tale always drops a card, and lookouts drop two.',
};
/** The skill of a companion id as { id, name, text }: from the content when it has one, else the lines above. */
export function skillOfCompanion(id) {
  const c = COMPANION_BY_ID[id];
  if (!c) return null;
  const s = c.skill && typeof c.skill === 'object' ? c.skill : null;
  return { id: (s && s.id) || id, name: (s && s.name) || SKILL_SHORT[id] || '', text: (s && s.text) || SKILL_LINE[id] || '', short: SKILL_SHORT[id] || (s && s.name ? String(s.name).toLowerCase() : '') };
}
/** "Ada fixes wheels · Eli scouts · Rosa stretches the food" for companion ids. */
export function partySummary(ids) {
  return (ids || []).map((id) => { const c = COMPANION_BY_ID[id], s = skillOfCompanion(id); return c && s && s.short ? `${c.name} ${s.short}` : null; }).filter(Boolean).join(' · ');
}
/** The food stacks for a journey's foods: [{ id, name, unit, plural, emoji, lb, units, shown }] (units = whole units, a
 *  part of one counts as one). */
export function foodStacks(foods) {
  return FOOD_KINDS.map((k) => {
    const lb = Math.max(0, Math.round(Number(foods && foods[k.id]) || 0));
    const units = lb > 0 ? Math.ceil(lb / k.lb) : 0;
    return { ...k, lb, units, shown: Math.min(units, MAX_BLOCKS) };
  }).filter((s) => s.id !== 'other' || s.lb > 0);
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function createWagonPanel(app) {
  const root = $('#panel-wagon');
  const body = $('#wg-body');
  const title = $('#wg-title');
  const closeBtn = $('#wg-close');
  let open = false, waiter = null;

  function stack(s) {
    const blocks = [];
    for (let i = 0; i < s.shown; i++) blocks.push(h('span', { class: `wg-item k-${s.id}`, 'aria-hidden': 'true' }, s.emoji));
    const label = s.units === 0 ? `${s.name}: none left` : `${s.name} · ${plural(s.units, s.unit, s.plural)}`;
    return h('div', { class: 'wg-stack', 'data-food': s.id, 'data-units': String(s.units), role: 'img', 'aria-label': label },
      h('div', { class: 'wg-pile' }, ...(blocks.length ? blocks : [h('span', { class: 'wg-empty' }, 'empty')])),
      h('div', { class: 'wg-stack-label' }, label));
  }
  function goodRow(emoji, name, text, id, dim = false) {
    return h('div', { class: 'wg-good' + (dim ? ' dim' : ''), 'data-good': id },
      h('span', { class: 'wg-g-emoji', 'aria-hidden': 'true' }, emoji), h('b', {}, name), h('span', { class: 'wg-g-text' }, text));
  }
  function render() {
    const I = app.wagonInfo();
    if (!I) return;
    title.textContent = I.wagonName ? `${I.wagonName}'s wagon` : 'The wagon';
    const f = I.food;
    // ----- food -----
    const days = f.days;
    let words;
    if (days == null) words = 'Look in the sacks and count the days.';
    else words = `Food for ${days < 1 ? 'less than a day' : plural(days, 'day', 'days')}${f.stop ? ` · ${f.stop} in ${plural(f.stopDays, 'day', 'days')}` : ''}`;
    const enough = days != null && f.stop && days >= f.stopDays;
    const foodSec = h('section', { class: 'wg-sec wg-food' },
      h('div', { class: 'wg-sec-h' }, 'Food'),
      h('p', { class: 'wg-days', id: 'wg-days' }, words),
      f.stop && days != null && !enough ? h('p', { class: 'wg-note', id: 'wg-short' }, 'Not quite enough yet. Fishing, hunting, trading or the next fort will help.') : null,
      h('div', { class: 'wg-stacks' }, ...foodStacks(f.kinds).map(stack)));
    // ----- the other goods -----
    const G = I.goods, B = I.blankets;
    const goods = [
      goodRow('⚙️', 'Spare parts', G.parts > 0 ? `${G.parts}: for a wheel, axle or tongue` : 'none: the wagon would limp to the next fort', 'parts', G.parts <= 0),
      goodRow('🪢', 'Rope', G.rope > 0 ? `${G.rope}: keeps the sacks dry on a raft` : 'none: a raft can soak a sack', 'rope', G.rope <= 0),
      goodRow('🧣', 'Blankets', B.short > 0 ? `${B.have}: ${B.short} more keeps everyone warm on cold nights` : `${B.have}: enough for cold nights`, 'blankets', B.short > 0),
      goodRow('🏹', 'Arrows', G.arrows > 0 ? `${G.arrows}: a hunt uses 5` : 'none: fishing only', 'arrows', G.arrows <= 0),
      goodRow('🦫', 'Pelts', G.pelts > 0 ? `${G.pelts}: good for trading` : 'none yet', 'pelts', G.pelts <= 0),
      goodRow('🐂', 'Second yoke', I.animals.n >= 4 ? 'on the wagon: four pull, and they tire slower' : 'not yet: the fort store sells one', 'yoke', I.animals.n < 4),
    ];
    const goodsSec = h('section', { class: 'wg-sec' }, h('div', { class: 'wg-sec-h' }, 'Goods'), h('div', { class: 'wg-goods' }, ...goods),
      I.limp ? h('p', { class: 'wg-note warn', id: 'wg-limp' }, 'The wagon limps. A spare part or the next fort will mend it.') : null);
    // ----- animals -----
    const A = I.animals;
    const animalSec = h('section', { class: 'wg-sec wg-animals' }, h('div', { class: 'wg-sec-h' }, 'The team'),
      h('p', { class: 'wg-animal', id: 'wg-animals', 'data-tired': String(!!A.isTired) },
        h('span', { 'aria-hidden': 'true' }, A.isTired ? '😮‍💨' : '🐂'),
        ` ${A.n >= 4 ? `Four ${A.name}` : `Two ${A.name}`}: the ${A.name} are ${A.isTired ? 'tired. They need a rest, so the pace stays steady.' : 'fresh.'}`));
    // ----- the party -----
    const comps = I.companions.map((p) => {
      const c = COMPANION_BY_ID[p.id] || { name: p.id, role: '', color: '#d9653b', hat: 'wide' };
      const s = skillOfCompanion(p.id) || { name: '', text: '' };
      return h('div', { class: 'wg-comp', 'data-companion': p.id, style: { '--c': c.color } },
        h('span', { class: 'wg-c-face', html: companionSvg(c) }),
        h('span', { class: 'wg-c-text' }, h('b', {}, c.name), h('small', {}, `${c.role || ''}`), h('i', {}, `${s.name ? `${s.name}. ` : ''}${s.text}`.trim())),
        h('span', { class: 'wg-c-mood', 'data-mood': p.mood }, moodFace(p.mood, c.color), h('small', {}, p.mood)));
    });
    const partySec = h('section', { class: 'wg-sec' }, h('div', { class: 'wg-sec-h' }, 'The party'), h('div', { class: 'wg-comps' }, ...comps));
    // ----- Ask Eli -----
    const E = I.eli;
    const eli = h('button', { class: 'btn btn-gold wg-eli', id: 'wg-eli', 'data-sfx': '', disabled: !E.left }, h('span', { 'aria-hidden': 'true' }, '🧭'), E.left ? 'Ask Eli: how many days?' : 'Eli has helped enough for this leg');
    eli.addEventListener('click', async () => { if (!E.left) return; eli.disabled = true; try { await app.askEli(); } finally { if (open) render(); } });
    const eliSec = h('section', { class: 'wg-sec wg-eli-sec' }, eli, h('p', { class: 'wg-note' }, 'A right first answer earns a trade token.'));
    body.replaceChildren(foodSec, animalSec, goodsSec, partySec, eliSec);
  }
  function close(value = true) {
    if (!open) return;
    open = false;
    root.hidden = true;
    const w = waiter; waiter = null;
    if (w) w(value);
  }
  closeBtn.addEventListener('click', () => close(true));
  root.addEventListener('click', (e) => { if (e.target === root) close(true); });
  window.addEventListener('keydown', (e) => { if (open && e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }, true);
  return {
    /** Open the panel over the trail; resolves when the child closes it ("Back to the trail"). */
    open() {
      if (open) return Promise.resolve(true);
      open = true;
      render();
      root.hidden = false;
      body.scrollTop = 0;
      return new Promise((resolve) => { waiter = resolve; });
    },
    close,
    refresh() { if (open) render(); },
    get isOpen() { return open; },
  };
}
