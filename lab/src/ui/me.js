// Me (lab/SPEC.md §5.3): slot rows for the avatar (hat, shirt, back, face, aura) and the pet (neck, toy, hat) with the items owned and the level
// a closed slot opens at; the pet's species and its name (typed on the shared on-screen keyboard, never the native one).
import { h } from '../../../spell-jump/src/ui/dom.js';
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { ITEMS } from '../data/catalog.js';
import { cleanPetName, PET_SPECIES } from '../core/model.js';
import { owns } from '../core/model.js';
import { drawAvatar } from './avatar.js';
import { drawPet, PET_NAMES } from './pet.js';
import { glyph } from './glyph.js';
import { itemPreview } from './items.js';

const AV = [['hat', 'Hat'], ['shirt', 'Shirt'], ['back', 'Back'], ['face', 'Face'], ['aura', 'Aura']];
const PET = [['neck', 'Neck'], ['toy', 'Toy'], ['hat', 'Hat']];
const display = (s) => String(s).replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

export function mountMe(ctx) {
  const { store } = ctx;
  let naming = false, draft = '', kb = null, raf = 0, dead = false, t0 = performance.now();
  const stage = h('canvas', { class: 'lab-me-cv', width: 640, height: 400, 'aria-label': 'You and your pet' });
  const rows = h('div', { class: 'lab-me-rows' });
  const petBox = h('section', { class: 'lab-card lab-pet-box' });
  const namer = h('section', { class: 'lab-card lab-namer', hidden: true });
  const scrim = h('div', { class: 'lab-namer-scrim', hidden: true });
  const el = h('div', { class: 'lab-me' }, h('div', { class: 'lab-me-top' }, h('div', { class: 'lab-card lab-me-stage' }, stage), petBox), scrim, namer, rows);

  function draw(now) {
    raf = 0; if (dead) return;
    const v = store.view(); if (!v) return;
    const c = stage.getContext('2d'); const t = ctx.reduced ? 0 : (now - t0) / 1000;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 640, 400);
    const g = c.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#24307a'); g.addColorStop(1, '#151c45'); c.fillStyle = g; c.fillRect(0, 0, 640, 400);
    c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.ellipse(320, 372, 250, 26, 0, 0, 7); c.fill();
    const slots = {}; for (const [k, s] of Object.entries(v.avatar.slots)) slots[k] = s.id;
    const ps = {}; for (const [k, s] of Object.entries(v.pet.slots)) ps[k] = s.id;
    drawAvatar(c, { x: 215, y: 366, s: 2.9, color: v.player.color || '#3b7dd9', slots, frame: v.avatar.frame, mood: v.pet.mood, t });
    drawPet(c, { x: 470, y: 368, s: 2.9, species: v.pet.species, stage: v.pet.stage, slots: ps, mood: v.pet.mood, t });
    if (!ctx.reduced && !document.hidden) raf = requestAnimationFrame(draw);
  }
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(draw); };

  function ownedFor(slotKey) { const d = store.doc(); return ITEMS.filter((i) => i.key === slotKey && owns(d, i.id)); }
  function slotRow(owner, label, name, v) {
    const info = (owner === 'av' ? v.avatar : v.pet).slots[name];
    const slotKey = `${owner}.${name}`;
    const row = h('section', { class: 'lab-card lab-slot-row' + (info.open ? '' : ' closed'), 'data-slot': slotKey },
      h('div', { class: 'lab-slot-title' }, h('b', {}, `${owner === 'pet' ? 'Pet ' : ''}${owner === 'pet' ? label.toLowerCase() : label}`), info.open ? null : h('span', { class: 'lab-state locked' }, h('span', { html: glyph('lock') }), `Opens at level ${info.opensAt}`)));
    if (info.open) {
      const items = ownedFor(slotKey);
      const chips = h('div', { class: 'lab-chips' });
      const none = h('button', { class: 'lab-chip-btn' + (!info.id ? ' on' : ''), type: 'button', 'aria-pressed': String(!info.id), 'aria-label': `No ${label.toLowerCase()}`, 'data-item': '' }, h('span', { class: 'lab-none' }, 'None'));
      none.addEventListener('click', () => { if (info.id) { store.equip(slotKey, null); ctx.sfx('click'); } });
      chips.append(none);
      for (const it of items) {
        const b = h('button', { class: 'lab-chip-btn' + (info.id === it.id ? ' on' : ''), type: 'button', 'aria-pressed': String(info.id === it.id), 'aria-label': it.name, 'data-item': it.id }, itemPreview(it, 52, { color: v.player.color, species: v.pet.species }));
        b.addEventListener('click', () => { store.equip(slotKey, info.id === it.id ? null : it.id); ctx.sfx('correct'); ctx.later(it.name); });
        chips.append(b);
      }
      row.append(chips);
      if (!items.length) row.append(h('p', { class: 'lab-small' }, 'Nothing yet. Look in the Shop or open a crate.'));
    }
    return row;
  }
  function renderPet(v) {
    const buttons = PET_SPECIES.map((sp) => {
      const cv = h('canvas', { width: 96, height: 96, class: 'lab-species-cv', 'aria-hidden': 'true' });
      const c = cv.getContext('2d'); drawPet(c, { x: 48, y: 88, s: 1.55, species: sp, stage: Math.max(2, v.pet.stage), mood: 'happy' });
      const b = h('button', { class: 'lab-species' + (v.pet.species === sp ? ' on' : ''), type: 'button', 'aria-pressed': String(v.pet.species === sp), 'data-species': sp, 'aria-label': PET_NAMES[sp] }, cv, h('span', {}, PET_NAMES[sp]));
      b.addEventListener('click', () => { if (v.pet.species !== sp) { store.setPet({ species: sp }); ctx.sfx('correct'); } });
      return b;
    });
    const rename = h('button', { class: 'lab-btn lab-btn-sm', type: 'button', id: 'pet-rename' }, h('span', { html: glyph('style') }), 'Rename');
    rename.addEventListener('click', () => { naming = true; draft = ''; renderNamer(); });
    petBox.replaceChildren(h('h3', { class: 'lab-h' }, 'Your pet'), h('div', { class: 'lab-species-row' }, ...buttons),
      h('div', { class: 'lab-petname-row' }, h('span', { class: 'lab-petname', id: 'pet-name' }, v.pet.name), rename));
  }
  function renderNamer() {
    namer.hidden = !naming; scrim.hidden = !naming;
    if (!naming) { if (kb) kb.setActive(false); namer.replaceChildren(); return; }
    const nameBox = h('div', { class: 'lab-namebox', id: 'pet-namebox' });
    const paint = () => { nameBox.replaceChildren(draft ? h('span', {}, display(draft)) : h('span', { class: 'ph' }, 'Type a name'), h('i', { class: 'caret' })); if (kb) kb.setEnterEnabled(!!cleanPetName(draft)); };
    kb = createKeyboard({
      id: 'pet-keyboard', enterLabel: 'Done',
      onKey: (ch) => { if (draft.length >= 10 || (ch === ' ' && (!draft || draft.endsWith(' ')))) return; draft += ch; ctx.sfx('click'); paint(); },
      onBackspace: () => { draft = draft.slice(0, -1); paint(); },
      onEnter: () => { const n = cleanPetName(display(draft)); if (!n) return; store.setPet({ name: n }); ctx.sfx('cash'); ctx.say(`Hello, ${n}`); naming = false; renderNamer(); },
    });
    const cancel = h('button', { class: 'lab-btn lab-btn-sm', type: 'button', id: 'pet-name-cancel' }, 'Cancel');
    cancel.addEventListener('click', () => { naming = false; renderNamer(); });
    namer.replaceChildren(h('div', { class: 'lab-namer-top' }, h('b', {}, 'Name your pet'), cancel), nameBox, h('div', { class: 'lab-namer-kb' }, kb.el));
    paint(); kb.setEnabled(true); kb.setActive(true);
  }
  function update() {
    const v = store.view(); if (!v) return;
    renderPet(v);
    rows.replaceChildren(
      h('h3', { class: 'lab-h' }, 'What I wear'), ...AV.map(([n, l]) => slotRow('av', l, n, v)),
      h('h3', { class: 'lab-h' }, 'What my pet wears'), ...PET.map(([n, l]) => slotRow('pet', l, n, v)));
    kick();
  }
  update();
  return { el, update, destroy() { dead = true; cancelAnimationFrame(raf); if (kb) kb.setActive(false); } };
}
