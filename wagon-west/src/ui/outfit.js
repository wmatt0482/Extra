// Outfit (SPEC §3 "The party", §12): name the wagon (Spell Jump's on-screen keyboard, never the native one), pick the
// draft animal (oxen: strong and slow, they eat grass; mules: faster and hungrier, a choice with arithmetic in it, so
// both show their miles a day and their feed), pick three companions from the stock characters (a line from each),
// and the looks from crates and trade tokens (paint, flag, bugle call, a companion's hat). Four tabs; a new journey
// walks them in order (the keyboard's Enter is "Next" on the name) and ends at the General Store in Independence. Once
// the first leg is under way the animal and the party are set for the season (they are the journey); the name and the
// looks can change any time.
import { createKeyboard } from '../../../spell-jump/src/spelling/keyboard.js';
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { ANIMALS } from '../content/legs.js';
import { COMPANIONS } from '../content/companions.js';
import { KIND_NAME, LOOKS, LOOK_KINDS, STOCK, owns } from './looks.js';

export const MAX_WAGON_NAME = 16;
const TABS = [['name', 'Name'], ['animal', 'Animal'], ['party', 'Party'], ['look', 'Look']];

/** A companion's little portrait (inline SVG): the face, the colour, the hat by kind. */
export function companionSvg(c, hatOverride = null) {
  const hat = hatOverride || c.hat;
  const hc = hatOverride ? '#3b2c22' : c.color;
  const hats = {
    cap: `<path d="M9 13q7-9 14 0z" fill="${hc}"/><rect x="18" y="12" width="9" height="2.6" rx="1.3" fill="${hc}"/>`,
    wide: `<ellipse cx="16" cy="12.5" rx="12" ry="2.6" fill="${hc}"/><path d="M10 12.5q6-10 12 0z" fill="${hc}"/>`,
    bonnet: `<path d="M7 17q0-12 9-12t9 12q-2-6-9-6t-9 6z" fill="${hc}"/>`,
    straw: '<ellipse cx="16" cy="12.5" rx="12" ry="2.6" fill="#e7c66b"/><path d="M10 12.5q6-9 12 0z" fill="#e7c66b"/>',
    bowler: '<ellipse cx="16" cy="12.5" rx="9" ry="2" fill="#3b2c22"/><path d="M10.5 12.5q5.5-10 11 0z" fill="#3b2c22"/>',
    feather: '<path d="M9 13q7-9 14 0z" fill="#7fb85a"/><path d="M22 10q6-6 5-9" stroke="#d9653b" stroke-width="2" fill="none"/>',
    top: '<rect x="11" y="3" width="10" height="10" fill="#2a2230"/><rect x="8" y="12" width="16" height="2.6" fill="#2a2230"/>',
  };
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 32q0-10 11-10t11 10z" fill="${c.color}"/><circle cx="16" cy="17" r="7" fill="#e8b98f"/>`
    + `<circle cx="13.5" cy="17" r="1.1" fill="#3a2416"/><circle cx="18.5" cy="17" r="1.1" fill="#3a2416"/>${hats[hat] || hats.wide}</svg>`;
}

export function createOutfit(app) {
  const root = $('#screen-outfit');
  const tabsEl = $('#ow-tabs');
  const body = $('#ow-body');
  const foot = $('#ow-foot');
  let tab = 'name', draft = null, fresh = false;

  const kb = createKeyboard({
    id: 'ow-keyboard', enterLabel: 'Next',
    onKey: (ch) => {
      if (draft.wagonName.length >= MAX_WAGON_NAME || (ch === ' ' && (!draft.wagonName || draft.wagonName.endsWith(' ')))) return;
      draft.wagonName += ch; app.audio.letter(); paintName();
    },
    onBackspace: () => { if (!draft.wagonName) return; draft.wagonName = draft.wagonName.slice(0, -1); app.audio.letter(true); paintName(); },
    onEnter: () => { if (cleanWagon(draft.wagonName)) next(); },
  });
  const cleanWagon = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/(^|[ '-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).slice(0, MAX_WAGON_NAME);
  const nameEl = h('div', { class: 'np-name ow-name', id: 'ow-name', 'aria-live': 'polite' });
  function paintName() {
    nameEl.replaceChildren(draft.wagonName ? h('span', {}, cleanWagon(draft.wagonName) || ' ') : h('span', { class: 'ph' }, 'Name your wagon'), h('i', { class: 'caret' }));
    kb.setEnterEnabled(!!cleanWagon(draft.wagonName));
  }
  const locked = () => !fresh && !app.partyEditable();

  function renderTabs() {
    tabsEl.replaceChildren(...TABS.map(([id, text]) => {
      const b = h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id, 'data-sfx': '' }, text);
      b.addEventListener('click', () => setTab(id));
      return b;
    }));
  }
  function setTab(id) { tab = id; render(); }
  function next() {
    const i = TABS.findIndex(([id]) => id === tab);
    if (i < TABS.length - 1) setTab(TABS[i + 1][0]); else done();
  }
  function done() {
    draft.wagonName = cleanWagon(draft.wagonName) || 'Prairie Rose';
    if (draft.companions.length !== 3) { setTab('party'); app.toast('Pick three companions'); return; }
    app.outfitDone({ ...draft }, { fresh });
  }
  function footButtons(nextText = 'Next', enabled = true) {
    const b = h('button', { class: 'btn btn-go', id: 'ow-next', 'data-sfx': '', disabled: !enabled }, nextText, h('span', { html: app.icon('right') }));
    b.addEventListener('click', () => { if (tab === 'look') done(); else next(); });
    foot.replaceChildren(b);
  }

  function nameTab() {
    paintName();
    kb.setEnabled(true);
    kb.setActive(true);
    body.replaceChildren(h('div', { class: 'ow-namerow' }, h('span', { class: 'ow-label' }, 'Wagon'), nameEl), h('div', { class: 'np-kb ow-kb' }, kb.el));
    foot.replaceChildren();
  }
  function animalTab() {
    const lock = locked();
    body.replaceChildren(h('div', { class: 'ow-animals' }, ...ANIMALS.map((a) => {
      const on = draft.animal === a.id;
      const b = h('button', { class: 'card ow-animal' + (on ? ' on' : ''), 'data-animal': a.id, 'aria-pressed': String(on), 'data-sfx': '', disabled: lock && !on },
        h('span', { class: 'ow-a-name' }, a.name),
        h('span', { class: 'ow-a-blurb' }, a.blurb || ''),
        h('span', { class: 'ow-a-stats' }, `${a.milesPerDay.steady} mi a day · ${a.milesPerDay.brisk} brisk`),
        h('span', { class: 'ow-a-stats' }, a.feedLb ? `Eats ${a.feedLb} lb of feed a day` : 'Eats prairie grass'));
      b.addEventListener('click', () => { if (lock) return; draft.animal = a.id; animalTab(); });
      return b;
    })), lock ? h('p', { class: 'ow-note' }, 'The team is set for this season.') : null);
    footButtons();
  }
  function partyTab() {
    const lock = locked();
    const n = draft.companions.length;
    body.replaceChildren(
      h('p', { class: 'ow-note', id: 'ow-party-count' }, lock ? 'The party is set for this season.' : `${n} of 3 chosen`),
      h('div', { class: 'ow-party scroll' }, ...COMPANIONS.map((c) => {
        const on = draft.companions.includes(c.id);
        const b = h('button', { class: 'card ow-comp' + (on ? ' on' : ''), 'data-companion': c.id, 'aria-pressed': String(on), 'data-sfx': '', style: { '--c': c.color }, disabled: lock && !on },
          h('span', { class: 'ow-c-face', html: companionSvg(c) }),
          h('span', { class: 'ow-c-text' }, h('b', {}, c.name), h('small', {}, c.role || ''), h('i', {}, `“${(c.lines && c.lines.trail && c.lines.trail[0]) || ''}”`)));
        b.addEventListener('click', () => {
          if (lock) return;
          if (on) draft.companions = draft.companions.filter((x) => x !== c.id);
          else if (draft.companions.length >= 3) { app.toast('Three companions fit in the wagon'); return; }
          else draft.companions = [...draft.companions, c.id];
          partyTab();
        });
        return b;
      })));
    footButtons('Next', draft.companions.length === 3);
  }
  function lookTab() {
    const cos = app.save.cosmetics;
    const tokens = app.tokens();
    const sections = LOOK_KINDS.map((kind) => {
      const items = LOOKS[kind].filter((x) => owns(cos, kind, x.id) || x.tokens);
      return h('div', { class: 'ow-look' },
        h('div', { class: 'ow-sec' }, KIND_NAME[kind]),
        h('div', { class: 'ow-items' }, ...items.map((x) => {
          const have = owns(cos, kind, x.id), on = cos.equipped[kind] === x.id;
          const b = h('button', { class: 'ow-item' + (on ? ' on' : '') + (have ? '' : ' shop'), 'data-look': `${kind}:${x.id}`, 'data-sfx': '', 'aria-pressed': String(on) },
            x.color && x.color !== 'transparent' ? h('i', { class: 'sw', style: { '--c': x.color } }) : null,
            h('span', {}, x.name), have ? null : h('small', {}, `${x.tokens} tokens`));
          b.addEventListener('click', () => {
            if (have) { app.equipLook(kind, x.id); lookTab(); return; }
            if (tokens < x.tokens) { app.toast(`${x.tokens} trade tokens buy this. Right answers at the store earn them.`); return; }
            app.buyLook(kind, x.id, x.tokens); lookTab();
          });
          return b;
        })));
    });
    body.replaceChildren(h('p', { class: 'ow-note', id: 'ow-tokens' }, `Trade tokens: ${tokens} · crates bring more looks`), h('div', { class: 'ow-looks scroll' }, ...sections));
    footButtons(fresh ? 'To the store' : 'Done');
  }
  function render() {
    renderTabs();
    if (tab !== 'name') kb.setActive(false);
    root.dataset.tab = tab;
    if (tab === 'name') nameTab(); else if (tab === 'animal') animalTab(); else if (tab === 'party') partyTab(); else lookTab();
  }
  return {
    show(opts = {}) {
      const J = app.save.journey;
      fresh = !J || !!opts.fresh;
      draft = fresh ? { wagonName: '', animal: 'oxen', companions: [] }
        : { wagonName: J.wagonName || '', animal: J.animal || 'oxen', companions: (J.companions || (J.party || []).map((p) => p.id)).slice(0, 3) };
      tab = opts.tab || 'name';
      render();
    },
    hide() { kb.setActive(false); },
    get tab() { return tab; },
    get draft() { return draft; },
    STOCK,
  };
}
