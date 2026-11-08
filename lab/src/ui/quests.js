// Quests (lab/SPEC.md §5.3): today's three cards (the game's badge, the text, a progress bar, the coins, a check when done), one swap a day on an
// unfinished card, and the crate sitting closed with three pips filling. No clock, no "resets in", nothing about yesterday.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { LAB_LINES } from '../core/view.js';
import { CRATE_ART, COIN, gameBadge, glyph } from './glyph.js';

export function mountQuests(ctx) {
  const { store } = ctx;
  let swapMsg = '';
  const list = h('div', { class: 'lab-quest-list' });
  const crate = h('div', { class: 'lab-card lab-quest-crate' });
  const el = h('div', { class: 'lab-quests' }, list, crate);

  function swapUsed(v) { try { const d = store.doc(); const day = Object.keys(d.quests).sort().pop(); return !!(day && d.quests[day].rr >= 1); } catch (_) { return false; } }

  function update() {
    const v = store.view(); if (!v) return;
    if (v.opts.quests === false) { list.replaceChildren(h('p', { class: 'lab-empty' }, 'Quests are resting. A grown-up can turn them on.')); crate.replaceChildren(); return; }
    const used = swapUsed(v);
    list.replaceChildren(...v.quests.map((q) => {
      const p = q.target ? Math.round((100 * q.progress) / q.target) : 0;
      const card = h('article', { class: 'lab-card lab-quest' + (q.done ? ' done' : '') + (q.nudge ? ' nudge' : ''), 'data-quest': q.id },
        h('button', { class: 'lab-quest-main', type: 'button', 'aria-label': `Hear: ${q.text}` },
          h('span', { class: 'lab-quest-badge', html: gameBadge(q.game, 40) }),
          h('span', { class: 'lab-quest-body' },
            q.nudge ? h('span', { class: 'lab-tag' }, 'Try something different') : null,
            h('span', { class: 'lab-quest-tx' }, q.text),
            q.hint ? h('span', { class: 'lab-quest-hint' }, q.hint) : null,
            h('span', { class: 'lab-bar lab-bar-q', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(q.target), 'aria-valuenow': String(q.progress) }, h('i', { style: { width: `${p}%` } })),
            h('span', { class: 'lab-quest-n' }, q.done ? 'Done' : `${q.progress} / ${q.target}`))),
        h('span', { class: 'lab-quest-reward' }, q.done ? h('span', { class: 'lab-check big', html: glyph('check'), 'aria-label': 'Done' }) : h('span', { html: COIN }), h('b', {}, `+${q.coins}`)));
      card.querySelector('.lab-quest-main').addEventListener('click', () => ctx.say(q.text));
      if (!q.done && !used) {
        const sw = h('button', { class: 'lab-btn lab-btn-sm lab-swap', type: 'button', 'data-index': String(q.index) }, h('span', { html: glyph('swap') }), 'Swap');
        sw.addEventListener('click', () => {
          const r = store.rerollQuest(q.index);
          swapMsg = r.ok ? '' : 'One swap a day. This one stays today.';
          if (r.ok) ctx.sfx('correct');
          update();
        });
        card.append(sw);
      }
      return card;
    }));
    if (swapMsg) list.append(h('p', { class: 'lab-small', role: 'status' }, swapMsg));
    const n = v.quests.length, done = v.questsDone;
    const open = v.crates.waiting > 0;
    const btn = h('button', { class: 'lab-btn lab-btn-gold', type: 'button', id: 'quests-crate' }, open ? `${LAB_LINES.crate} Open it` : 'See the crate');
    btn.addEventListener('click', () => ctx.go('crate'));
    crate.replaceChildren(
      h('div', { class: 'lab-qc-art' + (open ? ' ready' : ''), html: CRATE_ART }),
      h('div', { class: 'lab-qc-body' },
        h('div', { class: 'lab-pips big', 'aria-label': `${done} of ${n} quests done` }, ...v.quests.map((q) => h('i', { class: q.done ? 'on' : '' }))),
        h('p', { class: 'lab-qc-tx' }, open ? LAB_LINES.crate : `${done} of ${n} quests make a crate`),
        btn));
  }
  update();
  return { el, update, destroy() {} };
}
