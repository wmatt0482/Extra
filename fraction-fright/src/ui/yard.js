// The yard (SPEC §7, §13.5): grenade types, goo colours, fences and yard extras (the dog by the ½ post, the gate
// lantern), bought with the cash from cured neighbours. Cosmetics only: nothing here changes the aim or what the road
// shows. The preview shows the fence, the goo, the grenade, the extras and the pumpkins planted.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COIN } from '../../../spell-jump/src/ui/icons.js';
import { EXTRAS, FENCES, GOO, GRENADES, itemOf } from '../data/looks.js';
import { buyYard, owns } from '../meta/economy.js';

function preview(save) {
  const goo = itemOf('goo', save.yard.goo), fence = itemOf('fence', save.yard.fence), gren = itemOf('grenade', save.yard.grenade) || GRENADES[0];
  let s = '<rect width="400" height="220" fill="#16151a"/><rect y="150" width="400" height="70" fill="#26252a"/><circle cx="330" cy="40" r="22" fill="#d9d8b0"/>';
  if (fence.id === 'stone') {
    for (let row = 0; row < 4; row++) for (let x = (row % 2 ? -14 : 0); x < 400; x += 28) s += `<rect x="${x + 1}" y="${100 + row * 15}" width="26" height="13" rx="2" fill="${row % 2 ? '#6f6a66' : '#7d7773'}" stroke="#3a3734" stroke-width="1.5"/>`;
  } else {
    for (let x = 6; x < 400; x += 26) {
      s += fence.id === 'iron' ? `<rect x="${x}" y="96" width="5" height="64" fill="${fence.color}"/><path d="M${x - 3} 98 L${x + 2.5} 86 L${x + 8} 98 Z" fill="${fence.color}"/>`
        : `<path d="M${x} 160 V104 L${x + 8} 94 L${x + 16} 104 V160 Z" fill="#b7b0a1" stroke="#4a463f" stroke-width="1.5"/>`;
    }
    s += `<rect y="${fence.id === 'iron' ? 112 : 120}" width="400" height="7" fill="${fence.color}"/>`;
  }
  if (save.yard.lantern) s += '<rect x="372" y="70" width="6" height="90" fill="#2a2730"/><rect x="364" y="60" width="22" height="26" rx="3" fill="#3a3530" stroke="#111" stroke-width="2"/><rect x="368" y="65" width="14" height="16" fill="#ffd25a"/><circle cx="375" cy="73" r="30" fill="#ffd25a" opacity=".18"/>';
  s += `<ellipse cx="120" cy="186" rx="44" ry="13" fill="${goo.color}"/><ellipse cx="168" cy="196" rx="14" ry="6" fill="${goo.color}"/><circle cx="96" cy="176" r="5" fill="${goo.color}"/>`;
  // the grenade in the grass
  s += `<circle cx="40" cy="190" r="13" fill="${gren.color}" stroke="#111" stroke-width="2"/><rect x="36" y="172" width="8" height="7" rx="1.5" fill="#444" stroke="#111" stroke-width="1.5"/><path d="M30 184 q10 -8 20 0" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/>`;
  if (save.yard.dog) s += '<g><ellipse cx="215" cy="190" rx="22" ry="12" fill="#c9a36b" stroke="#3a2a14" stroke-width="2"/><circle cx="236" cy="178" r="10" fill="#c9a36b" stroke="#3a2a14" stroke-width="2"/><path d="M228 170 l-4 -9 l9 5 Z M242 170 l4 -9 l-9 5 Z" fill="#8a6a3a" stroke="#3a2a14" stroke-width="1.5"/><circle cx="240" cy="178" r="1.8" fill="#111"/><circle cx="246" cy="181" r="2.5" fill="#111"/><path d="M195 186 q-10 -14 2 -20" stroke="#c9a36b" stroke-width="4" fill="none" stroke-linecap="round"/></g>';
  for (let i = 0; i < Math.min(6, save.pumpkins); i++) s += `<ellipse cx="${270 + i * 20}" cy="196" rx="11" ry="9" fill="#c8551b"/><path d="M${264 + i * 20} 194 l3 -4 l3 4 Z M${270 + i * 20} 194 l3 -4 l3 4 Z" fill="#ffd25a"/><rect x="${268 + i * 20}" y="184" width="4" height="5" fill="#3d4a1a"/>`;
  return s;
}

export function createYard(app) {
  const side = $('#yard-side'), pv = $('#yard-preview');
  function row(kind, it) {
    const save = app.save;
    const extra = kind === 'extra';
    const mine = owns(save, kind, it.id), on = extra ? !!save.yard[it.id] : save.yard[kind] === it.id;
    const label = extra ? (mine ? (on ? 'On' : 'Off') : null) : on ? 'Using' : mine ? 'Use' : null;
    const disabled = extra ? (!mine && save.cash < it.price) : (on || (!mine && save.cash < it.price));
    const btn = h('button', { class: `btn btn-sm ${extra && mine ? (on ? 'btn-slime' : '') : on ? '' : mine ? 'btn-slime' : 'btn-pumpkin'}`, 'data-buy': `${kind}:${it.id}`, 'data-sfx': '', disabled: disabled ? true : null },
      ...(label ? [label] : [h('span', { html: COIN }), money(it.price)]));
    btn.addEventListener('click', () => {
      const r = buyYard(app.save, kind, it.id);
      if (r === 'bought') { app.audio.cash(); app.toast(`${it.name}!`); }
      else if (r === 'poor') { app.audio.error(); return; }
      app.persist(); app.refreshCash(); show();
    });
    const sw = kind === 'fence' ? h('span', { class: 'yi-sw', style: { background: `repeating-linear-gradient(90deg, ${it.color} 0 6px, transparent 6px 11px), #2a2140` } })
      : kind === 'grenade' ? h('span', { class: 'yi-sw yi-gren', style: { background: `radial-gradient(circle at 40% 35%, #fff6 0 18%, transparent 20%), radial-gradient(circle, ${it.color} 0 46%, transparent 48%), #1b1a20` } })
        : h('span', { class: 'yi-sw', style: { background: it.color } });
    const sub = extra ? (mine ? it.sub : it.sub) : it.price ? (mine ? 'Yours' : it.sub || 'Cosmetic: looks only') : it.sub || 'Free';
    return h('div', { class: `card yard-item${on ? ' on' : ''}`, 'data-item': `${kind}:${it.id}`, 'data-on': String(on) }, sw,
      h('div', {}, h('div', { class: 'yi-name' }, it.name), h('div', { class: 'yi-sub' }, sub)), btn);
  }
  function show() {
    pv.innerHTML = preview(app.save);
    side.replaceChildren(
      h('div', { class: 'yard-sec' }, 'Grenades'), ...GRENADES.map((g) => row('grenade', g)),
      h('div', { class: 'yard-sec' }, 'Goo colours'), ...GOO.map((g) => row('goo', g)),
      h('div', { class: 'yard-sec' }, 'Fences'), ...FENCES.map((f) => row('fence', f)),
      h('div', { class: 'yard-sec' }, 'Yard extras'), ...EXTRAS.map((x) => row('extra', x)),
      h('div', { class: 'yard-note' }, `Jack-o'-lanterns: ${app.save.pumpkins}. Clear a street's final wave for another one. Everything here is for looks: the road and the aim never change.`));
  }
  return { show, hide() {} };
}
