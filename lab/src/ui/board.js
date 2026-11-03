// Family (lab/SPEC.md §5.3, §2.6): this week's family goal meter (in the family's colours) with Claim when it is met and "Next week: ..." under it,
// then the board: a card per child in the picker's fixed order with a bar of this week's XP, a crown for Most and a star for Most improved
// ("+45 % on your usual"), and last week's crowns as stickers. No rank numbers, no "last", no countdown. First names only.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { FAMILY_GOALS, goalFor, weekNumbers } from '../core/family.js';
import { weekShift } from '../core/model.js';
import { drawPortrait } from './avatar.js';
import { glyph } from './glyph.js';

const wornSlots = (lab) => {
  const out = {};
  if (!lab) return out;
  for (const s of ['hat', 'shirt', 'back', 'face', 'aura']) { const e = lab.equipped && lab.equipped[`av.${s}`]; out[s] = e && e[0] ? e[0] : null; }
  return out;
};
const contribution = (goal, lab, wk) => {
  const g = FAMILY_GOALS.find((x) => x.id === goal.id), n = weekNumbers(lab, wk);
  return g ? (g.id === 'explore' ? Math.min(3, n.g.length) : n[g.field] || 0) : 0;
};

export function mountFamily(ctx) {
  const { store } = ctx;
  let msg = '';
  const goalCard = h('section', { class: 'lab-card lab-goal', 'aria-label': 'Family goal' });
  const boardEl = h('section', { class: 'lab-board', 'aria-label': 'This week' });
  const el = h('div', { class: 'lab-family' }, goalCard, boardEl);

  function renderGoal(v, fam) {
    if (v.opts.goal === false) { goalCard.hidden = true; return; }
    goalCard.hidden = false;
    const g = fam.goal, p = g.target ? Math.min(1, g.progress / g.target) : 0;
    const segs = fam.players.map((pl) => ({ pl, n: contribution(g, pl.lab, fam.week) })).filter((s) => s.n > 0);
    const total = segs.reduce((a, s) => a + s.n, 0) || 1;
    const meter = h('div', { class: 'lab-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(g.target), 'aria-valuenow': String(Math.min(g.progress, g.target)), 'aria-label': g.text },
      h('div', { class: 'lab-meter-fill', style: { width: `${Math.round(p * 100)}%` } }, ...segs.map((s) => h('i', { style: { flex: String(s.n / total), background: s.pl.color || '#37e0c0' }, title: s.pl.name }))));
    const next = goalFor(fam.players, weekShift(fam.week, 1), { day: undefined, gentle: false });
    const kids = [h('h3', { class: 'lab-h' }, 'This week'), h('p', { class: 'lab-goal-text', id: 'goal-text' }, g.text), meter,
      h('div', { class: 'lab-goal-n', id: 'goal-n' }, `${ctx.num(Math.min(g.progress, 1e9))} / ${ctx.num(g.target)}`)];
    if (fam.claimable && fam.claimable.length) {
      const c = fam.claimable[0];
      const b = h('button', { class: 'lab-btn lab-btn-go lab-claim', type: 'button', id: 'goal-claim' }, h('span', { html: glyph('trophy') }), 'Claim');
      b.addEventListener('click', () => {
        const r = store.claimGoal(c.wk);
        if (r.ok) { msg = r.item ? 'A new banner for your room!' : `+${ctx.num(r.coins)} coins for the family`; ctx.sfx('levelUp'); ctx.toast(msg, { say: true }); }
        update();
      });
      kids.push(b);
    } else if (fam.claimed) kids.push(h('p', { class: 'lab-note-ok' }, h('span', { html: glyph('check') }), 'Claimed. Nice teamwork!'));
    kids.push(h('p', { class: 'lab-small', id: 'goal-next' }, `Next week: ${next.text}`));
    goalCard.replaceChildren(...kids);
  }
  function renderBoard(v, fam) {
    if (v.opts.board === false) { boardEl.hidden = true; return; }
    boardEl.hidden = false;
    const rows = fam.board.rows, top = Math.max(300, ...rows.map((r) => r.xp));
    const cards = rows.map((r) => {
      const pl = fam.players.find((x) => x.id === r.id) || {};
      const cv = h('canvas', { class: 'lab-board-cv', width: 96, height: 96, 'aria-hidden': 'true' });
      const crowns = (pl.lab && pl.lab.crowns ? pl.lab.crowns : []).slice(-4);
      const card = h('article', { class: 'lab-card lab-person' + (r.crown ? ' has-crown' : ''), 'data-player': r.id, style: { '--c': r.color || '#37e0c0' } },
        cv,
        h('div', { class: 'lab-person-body' },
          h('div', { class: 'lab-person-name' }, r.name,
            r.crown ? h('span', { class: 'lab-badge-crown', title: 'Most this week', 'aria-label': 'Most this week', html: glyph('crown') }) : null,
            r.improved ? h('span', { class: 'lab-badge-star', title: 'Most improved', 'aria-label': 'Most improved', html: glyph('star') }) : null),
          h('div', { class: 'lab-person-bar' }, h('span', { class: 'lab-bar' }, h('i', { style: { width: `${Math.round((100 * r.xp) / top)}%` } })), h('span', { class: 'lab-person-xp' }, `${ctx.num(r.xp)} XP`)),
          r.improved ? h('div', { class: 'lab-improved' }, `Most improved: +${Math.max(0, r.gainPct)} % on your usual`) : null,
          crowns.length ? h('div', { class: 'lab-stickers', 'aria-label': 'Last week' }, ...crowns.map((c) => h('span', { class: 'lab-sticker ' + (c.endsWith('improved') ? 'imp' : 'most'), title: c.endsWith('improved') ? 'Most improved' : 'Most', html: glyph(c.endsWith('improved') ? 'star' : 'crown') }))) : null));
      requestAnimationFrame(() => drawPortrait(cv, { color: r.color, slots: wornSlots(pl.lab) }));
      return card;
    });
    boardEl.replaceChildren(h('h3', { class: 'lab-h' }, 'The family: XP this week'), h('div', { class: 'lab-board-grid' }, ...cards),
      h('p', { class: 'lab-small' }, 'A crown for the most XP this week. A star for the biggest step up on your own usual.'));
  }
  function update() {
    const v = store.view(); const fam = store.family(); if (!v || !fam) return;
    renderGoal(v, fam); renderBoard(v, fam);
  }
  update();
  return { el, update, destroy() {} };
}
