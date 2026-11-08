// The yard (SPEC §7, §13.5): grenade types, goo colours, fences and yard extras (the dog by the ½ post, the gate
// lantern), bought with the cash from cured neighbours. Cosmetics only: nothing here changes the aim or what the road
// shows. The preview shows the fence, the goo, the grenade, the extras and the pumpkins planted.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COIN } from '../../../spell-jump/src/ui/icons.js';
import { EXTRAS, FENCES, GOO, GRENADES, TOWERS, itemOf, towerBefore } from '../data/looks.js';
import { buyYard, owns } from '../meta/economy.js';
import { finishPrims, toSvg, topperPrims, towerPrims } from '../meta/yardArt.js';

const TOWER_STAGE = { lookout: 1, watchtower: 2, beacon: 3 };
/** The cheapest thing the kid does not own yet and may buy now (a tower only in order): { kind, item } or null. */
export function nextUp(save) {
  const all = [...GRENADES.map((x) => ['grenade', x]), ...GOO.map((x) => ['goo', x]), ...FENCES.map((x) => ['fence', x]), ...TOWERS.map((x) => ['tower', x]), ...EXTRAS.map((x) => ['extra', x])]
    .filter(([kind, x]) => x.price > 0 && !owns(save, kind, x.id) && !(kind === 'tower' && towerBefore(x.id) && !owns(save, 'tower', towerBefore(x.id).id)));
  all.sort((a, b) => a[1].price - b[1].price);
  return all.length ? { kind: all[0][0], item: all[0][1] } : null;
}

function preview(save, looks = {}) {
  const goo = itemOf('goo', save.yard.goo), fence = itemOf('fence', save.yard.fence), gren = itemOf('grenade', save.yard.grenade) || GRENADES[0];
  let s = '<rect width="400" height="220" fill="#16151a"/><rect y="150" width="400" height="70" fill="#26252a"/><circle cx="330" cy="40" r="22" fill="#d9d8b0"/>';
  if (fence.id === 'stone') {
    for (let row = 0; row < 4; row++) for (let x = (row % 2 ? -14 : 0); x < 400; x += 28) s += `<rect x="${x + 1}" y="${100 + row * 15}" width="26" height="13" rx="2" fill="${row % 2 ? '#6f6a66' : '#7d7773'}" stroke="#3a3734" stroke-width="1.5"/>`;
  } else if (fence.id === 'brick') {
    s += `<rect y="94" width="400" height="66" fill="${fence.color}" stroke="#3a1f18" stroke-width="2"/>`;
    for (let row = 0; row < 4; row++) { s += `<path d="M0 ${94 + row * 16.5} H400" stroke="#e9dcc6" stroke-width="1.5" opacity=".5"/>`; for (let x = (row % 2 ? 13 : 0); x < 400; x += 26) s += `<path d="M${x} ${94 + row * 16.5} v16.5" stroke="#e9dcc6" stroke-width="1.5" opacity=".5"/>`; }
    s += '<rect x="-2" y="88" width="404" height="8" rx="2" fill="#7d7773" stroke="#3a3734" stroke-width="1.5"/>';
  } else if (fence.id === 'castle') {
    s += `<rect y="98" width="400" height="62" fill="${fence.color}" stroke="#3a3734" stroke-width="2"/>`;
    for (let x = 4; x < 400; x += 30) s += `<rect x="${x}" y="84" width="18" height="15" fill="${fence.color}" stroke="#3a3734" stroke-width="1.8"/>`;
    for (let x = 28; x < 400; x += 90) s += '<rect x="' + x + '" y="112" width="4" height="26" fill="#1b1a24"/>';
    for (let x = 70; x < 400; x += 140) s += `<path d="M${x} 99 h16 v38 l-8 -9 l-8 9 Z" fill="#7b3fe4" stroke="#3a3734" stroke-width="1.6"/><rect x="${x}" y="99" width="16" height="3" fill="#ffd23f"/>`;
  } else {
    for (let x = 6; x < 400; x += 26) {
      s += fence.id === 'iron' ? `<rect x="${x}" y="96" width="5" height="64" fill="${fence.color}"/><path d="M${x - 3} 98 L${x + 2.5} 86 L${x + 8} 98 Z" fill="${fence.color}"/>`
        : `<path d="M${x} 160 V104 L${x + 8} 94 L${x + 16} 104 V160 Z" fill="#b7b0a1" stroke="#4a463f" stroke-width="1.5"/>`;
    }
    s += `<rect y="${fence.id === 'iron' ? 112 : 120}" width="400" height="7" fill="${fence.color}"/>`;
  }
 if (looks.fence) s += toSvg(finishPrims(looks.fence, 400, 62), 0, 96, 1, 'lab-fence');
  const stage = TOWER_STAGE[save.yard.tower] || 0;
  if (stage) { const tw = towerPrims(stage), k = [0, 0.6, 0.5, 0.42][stage]; s += `<g class="tower" data-stage="${stage}">${toSvg(tw.prims, 298, 172, k)}${looks.tower ? toSvg(topperPrims(looks.tower, tw), 298, 172, k, 'lab-tower') : ''}</g>`; }
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
    const prev = kind === 'tower' ? towerBefore(it.id) : null;
    const locked = !!prev && !owns(save, 'tower', prev.id);     // the tower is built one stage at a time
    const disabled = extra ? (!mine && save.cash < it.price) : (on || locked || (!mine && save.cash < it.price));
    const btn = h('button', { class: `btn btn-sm ${extra && mine ? (on ? 'btn-slime' : '') : on ? '' : mine ? 'btn-slime' : 'btn-pumpkin'}`, 'data-buy': `${kind}:${it.id}`, 'data-sfx': '', disabled: disabled ? true : null },
      ...(label ? [label] : locked ? ['Not yet'] : [h('span', { html: COIN }), money(it.price)]));
    btn.addEventListener('click', () => {
      const r = buyYard(app.save, kind, it.id);
      if (r === 'bought') { app.audio.cash(); app.toast(`${it.name}!`); app.yardBought(kind, it); }
      else if (r === 'poor' || r === 'locked') { app.audio.error(); return; }
      app.persist(); app.refreshCash(); show();
    });
    const sw = kind === 'fence' ? h('span', { class: 'yi-sw', style: { background: `repeating-linear-gradient(90deg, ${it.color} 0 6px, transparent 6px 11px), #2a2140` } })
      : kind === 'tower' ? h('span', { class: 'yi-sw yi-tower', style: { background: `linear-gradient(0deg, ${it.color || '#2a2140'} 0 ${14 + 24 * (it.stage || 0)}px, transparent ${14 + 24 * (it.stage || 0)}px), #2a2140` } })
      : kind === 'grenade' ? h('span', { class: 'yi-sw yi-gren', style: { background: `radial-gradient(circle at 40% 35%, #fff6 0 18%, transparent 20%), radial-gradient(circle, ${it.color} 0 46%, transparent 48%), #1b1a20` } })
        : h('span', { class: 'yi-sw', style: { background: it.color } });
    const sub = locked ? `Build the ${prev.name} first` : extra ? (mine ? it.sub : it.sub) : it.price ? (mine ? 'Yours' : it.sub || 'Cosmetic: looks only') : it.sub || 'Free';
    return h('div', { class: `card yard-item${on ? ' on' : ''}`, 'data-item': `${kind}:${it.id}`, 'data-on': String(on) }, sw,
      h('div', {}, h('div', { class: 'yi-name' }, it.name), h('div', { class: 'yi-sub' }, sub)), btn);
  }
  function show() {
    pv.innerHTML = preview(app.save, app.labLooks());
    const nu = nextUp(app.save);
    const towers = TOWERS.filter((x) => x.id !== 'none' || (app.save.yard.owned.tower || []).length);
    side.replaceChildren(
      ...(nu ? [h('div', { class: 'yard-next', id: 'yard-next', 'data-next': `${nu.kind}:${nu.item.id}` }, `Next up: ${nu.item.name} · ${money(nu.item.price)}`)] : [h('div', { class: 'yard-next', id: 'yard-next', 'data-next': '' }, 'Your yard has everything. Nice work!')]),
      h('div', { class: 'yard-sec' }, 'Grenades'), ...GRENADES.map((g) => row('grenade', g)),
      h('div', { class: 'yard-sec' }, 'Goo colours'), ...GOO.map((g) => row('goo', g)),
      h('div', { class: 'yard-sec' }, 'Fences'), ...FENCES.map((f) => row('fence', f)),
      h('div', { class: 'yard-sec' }, 'Tower'), ...towers.map((x) => row('tower', x)),
      h('div', { class: 'yard-sec' }, 'Yard extras'), ...EXTRAS.map((x) => row('extra', x)),
      ...(app.labReady() ? [h('div', { class: 'yard-sec' }, 'From The Lab')] : []),
      ...(app.labReady() ? [h('div', { class: 'card yard-lab' }, h('div', {}, h('div', { class: 'yi-name' }, 'Fence and tower looks'), h('div', { class: 'yi-sub' }, 'Paint the fence and dress the tower with Lab coins. Lab coins are earned in every game and spent in The Lab.')),
        h('button', { class: 'btn btn-sm', id: 'yard-lab-shop', 'data-sfx': '', onclick: () => app.openLabShop() }, 'Lab shop'))] : []),
      h('div', { class: 'yard-note' }, `Jack-o'-lanterns: ${app.save.pumpkins}. Clear a street's final wave for another one. Everything here is for looks: the road and the aim never change.`));
  }
  return { show, hide() {} };
}
