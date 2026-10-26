// The yard (SPEC §7, 1.0 basics): goo colours and fences, bought with the cash from cured neighbours. Cosmetics only:
// nothing here changes the aim or what the road shows. The preview shows the fence, the goo, and the pumpkins planted.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COIN } from '../../../spell-jump/src/ui/icons.js';
import { FENCES, GOO, itemOf } from '../data/looks.js';
import { buyYard, owns } from '../meta/economy.js';

function preview(save) {
  const goo = itemOf('goo', save.yard.goo), fence = itemOf('fence', save.yard.fence);
  let s = '<rect width="400" height="220" fill="#16151a"/><rect y="150" width="400" height="70" fill="#26252a"/><circle cx="330" cy="40" r="22" fill="#d9d8b0"/>';
  for (let x = 6; x < 400; x += 26) {
    s += fence.id === 'iron' ? `<rect x="${x}" y="96" width="5" height="64" fill="${fence.color}"/><path d="M${x - 3} 98 L${x + 2.5} 86 L${x + 8} 98 Z" fill="${fence.color}"/>`
      : `<path d="M${x} 160 V104 L${x + 8} 94 L${x + 16} 104 V160 Z" fill="#b7b0a1" stroke="#4a463f" stroke-width="1.5"/>`;
  }
  s += `<rect y="${fence.id === 'iron' ? 112 : 120}" width="400" height="7" fill="${fence.color}"/>`;
  s += `<ellipse cx="120" cy="186" rx="44" ry="13" fill="${goo.color}"/><ellipse cx="168" cy="196" rx="14" ry="6" fill="${goo.color}"/><circle cx="96" cy="176" r="5" fill="${goo.color}"/>`;
  for (let i = 0; i < Math.min(6, save.pumpkins); i++) s += `<ellipse cx="${250 + i * 24}" cy="196" rx="11" ry="9" fill="#c8551b"/><path d="M${244 + i * 24} 194 l3 -4 l3 4 Z M${250 + i * 24} 194 l3 -4 l3 4 Z" fill="#ffd25a"/><rect x="${248 + i * 24}" y="184" width="4" height="5" fill="#3d4a1a"/>`;
  return s;
}

export function createYard(app) {
  const side = $('#yard-side'), pv = $('#yard-preview');
  function row(kind, it) {
    const save = app.save;
    const mine = owns(save, kind, it.id), on = save.yard[kind] === it.id;
    const label = on ? 'Using' : mine ? 'Use' : null;
    const btn = h('button', { class: `btn btn-sm ${on ? '' : mine ? 'btn-slime' : 'btn-pumpkin'}`, 'data-buy': `${kind}:${it.id}`, 'data-sfx': '', disabled: on || (!mine && save.cash < it.price) ? true : null },
      ...(label ? [label] : [h('span', { html: COIN }), money(it.price)]));
    btn.addEventListener('click', () => {
      const r = buyYard(app.save, kind, it.id);
      if (r === 'bought') { app.audio.cash(); app.toast(`${it.name}!`); }
      else if (r === 'poor') { app.audio.error(); return; }
      app.persist(); app.refreshCash(); show();
    });
    const sw = kind === 'goo' ? h('span', { class: 'yi-sw', style: { background: it.color } }) : h('span', { class: 'yi-sw', style: { background: `repeating-linear-gradient(90deg, ${it.color} 0 6px, transparent 6px 11px), #2a2140` } });
    return h('div', { class: `card yard-item${on ? ' on' : ''}`, 'data-item': `${kind}:${it.id}` }, sw,
      h('div', {}, h('div', { class: 'yi-name' }, it.name), h('div', { class: 'yi-sub' }, it.price ? (mine ? 'Yours' : 'Cosmetic: looks only') : 'Free')), btn);
  }
  function show() {
    pv.innerHTML = preview(app.save);
    side.replaceChildren(
      h('div', { class: 'yard-sec' }, 'Goo colours'), ...GOO.map((g) => row('goo', g)),
      h('div', { class: 'yard-sec' }, 'Fences'), ...FENCES.map((f) => row('fence', f)),
      h('div', { class: 'yard-note' }, `Jack-o'-lanterns: ${app.save.pumpkins}. Clear a street's final wave for another one.`));
  }
  return { show, hide() {} };
}
