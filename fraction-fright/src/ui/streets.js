// Streets (SPEC §6): the street picker. The kid chooses among the open streets (self-chosen difficulty stays
// motivating: Lomas 2017); a ★ marks the recommended one; a street the kid chose is never closed again. A locked
// street says what opens it, in kid words; the 1.1 streets show as "coming soon". No meters here either: a street
// shows its next wave and how many times it was cleared.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { STREETS } from '../data/streets.js';
import { PLAYABLE, TIER_BY_ID } from '../skills/items.js';
import { isUnlocked, recommended } from '../skills/ladder.js';
import { nextWaveOf } from '../meta/economy.js';

function art(street) {
  const [a, b, c] = street.sky || ['#0c0b14', '#3a2430', '#8a3a14'];
  const tree = street.look && street.look.landmark === 'oak'
    ? '<circle cx="150" cy="44" r="26" fill="#1d3a2a"/><rect x="146" y="60" width="8" height="26" fill="#2a1a10"/>'
    : '<path d="M150 22 l22 30 h-12 l14 20 h-48 l14 -20 h-12 z" fill="#8a2a1a"/><rect x="146" y="72" width="8" height="14" fill="#2a1a10"/>';
  return `<svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g-${street.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`
    + `<rect width="200" height="100" fill="url(#g-${street.id})"/><circle cx="168" cy="18" r="9" fill="#d9d8b0"/>${tree}`
    + '<rect x="20" y="52" width="40" height="34" fill="#24222b"/><path d="M14 52 l26 -18 l26 18 z" fill="#111014"/><rect x="34" y="62" width="10" height="9" fill="#d8b04a"/>'
    + '<rect x="0" y="86" width="200" height="14" fill="#2c2b31"/><line x1="12" y1="92" x2="188" y2="92" stroke="#fff3d6" stroke-width="2"/>'
    + '<line x1="12" y1="86" x2="12" y2="98" stroke="#fff3d6" stroke-width="2"/><line x1="100" y1="86" x2="100" y2="98" stroke="#fff3d6" stroke-width="2"/><line x1="188" y1="86" x2="188" y2="98" stroke="#fff3d6" stroke-width="2"/></svg>';
}

export function createStreets(app) {
  const grid = $('#street-grid');
  function show() {
    const sk = app.skills, save = app.save;
    const rec = recommended(sk);
    grid.replaceChildren();
    for (const st of STREETS.filter((s) => s.playable)) {
      const open = isUnlocked(sk, st.tier);
      const i = PLAYABLE.indexOf(st.tier);
      const before = i > 0 ? TIER_BY_ID[PLAYABLE[i - 1]].name : null;
      const ss = save.streets[st.id];
      const next = nextWaveOf(save, st.id);
      const card = h('button', { class: `card street-card${open ? '' : ' locked'}${st.tier === rec ? ' rec' : ''}`, 'data-street': st.id, 'data-open': String(open), 'data-sfx': '',
        'aria-label': `${st.name}: ${st.blurb}${open ? `, next wave ${next}` : ', locked'}${st.tier === rec ? ', recommended' : ''}` },
      h('div', { class: 'street-art', html: art(st) }),
      h('div', { class: 'street-info' }, h('div', { class: 'street-name' }, st.name), h('div', { class: 'street-blurb' }, st.blurb),
        open ? h('div', { class: 'street-next', 'data-wave': String(next) }, `Next: wave ${next}${next === 3 ? ' (big wave)' : next === 5 ? ' (final wave)' : ''}${ss && ss.cleared ? ` · cleared ×${ss.cleared}` : ''}`) : null),
      st.tier === rec ? h('span', { class: 'star', 'aria-hidden': 'true' }, '★ Try this') : null,
      open ? null : h('div', { class: 'lock', html: `${app.icon('lock')}<span>Opens when ${before || 'the Lab'} is going well</span>` }));
      card.addEventListener('click', () => { if (open) app.startWave(st.id); else { app.audio.error(); app.toast(`Play ${before} a bit more first`); } });
      grid.append(card);
    }
    const soon = STREETS.filter((s) => !s.playable);
    grid.append(h('div', { class: 'card street-card soon locked', id: 'streets-soon' },
      h('div', { class: 'street-info' }, h('div', { class: 'street-name' }, 'Coming soon'), h('div', { class: 'street-blurb' }, soon.map((s) => s.name).join(' · ')))));
  }
  return { show, hide() {} };
}
