// Modal panels. Spell Jump (v3) keeps only Badges here: the title has PLAY, FRIDAY TEST, BADGES, PARENTS;
// sound / music / motion / shake moved to the pause menu and the Parent Zone (src/ui/parentZone.js), and
// resets live only in the Parent Zone. (The v2 Daily / Goals / Records panels were retired from the UI;
// goals still pay out on the results screen.)
import { ACHIEVEMENTS, achievementProgress } from '../meta/achievements.js';
import { $, h } from './dom.js';
import { icon } from './icons.js';

export function createPanels(app) {
  const bodies = { achievements: $('#achievements-body') };

  function achievements() {
    const s = app.save;
    const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
    $('#ach-count').textContent = `${earned} / ${ACHIEVEMENTS.length}`;
    const grid = h('div', { class: 'ach-grid' });
    for (const a of ACHIEVEMENTS) {
      const t = s.achievements[a.id];
      const prog = !t && achievementProgress(s, a.id);
      grid.append(h('div', { class: `ach-card tone-${a.tone}${t ? ' earned' : ' locked'}`, 'data-ach': a.id, 'aria-label': `${a.name}: ${t ? 'earned' : 'locked'}. ${a.hint}` },
        h('div', { class: 'ach-badge', html: icon(a.icon) + (t ? '' : `<span class="ach-lock">${icon('lock')}</span>`) }),
        h('div', { class: 'ach-name' }, a.name),
        h('div', { class: 'ach-hint' }, a.hint),
        t ? h('div', { class: 'ach-date' }, new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))
          : prog ? h('div', { class: 'progress' }, h('i', { style: { width: Math.round((prog[0] / prog[1]) * 100) + '%' } })) : null,
        !t && prog ? h('div', { class: 'ach-date' }, `${prog[0]} / ${prog[1]}`) : null));
    }
    bodies.achievements.replaceChildren(grid);
  }

  const renderers = { achievements };
  return { render(name) { if (renderers[name]) renderers[name](); } };
}
