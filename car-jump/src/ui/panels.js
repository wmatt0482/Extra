// Modal panels. Spell Jump (v3) keeps only Badges here: the title has PLAY, FRIDAY TEST, BADGES, PARENTS;
// sound / music / motion / shake moved to the pause menu and the Parent Zone (src/ui/parentZone.js), and
// resets live only in the Parent Zone. (The v2 Daily / Goals / Records panels were retired from the UI;
// goals still pay out on the results screen.)
// v3.3: Streak (the title's flame: current / best, a month calendar with counted days and shield days, the next
// milestone) and Trophies (this week's words as a shelf, past weeks below).
import { ACHIEVEMENTS, achievementProgress } from '../meta/achievements.js';
import { addDays, dayDiff, isDayKey, isoWeek, nextMilestone, streakNow, streakRewards, trophyShelf, weekOfDay } from '../meta/engagement.js';
import { dayKey } from '../spelling/scheduler.js';
import { $, h } from './dom.js';
import { icon } from './icons.js';

export function createPanels(app) {
  const bodies = { achievements: $('#achievements-body'), streak: $('#streak-body'), trophies: $('#trophies-body') };

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

  // ---------- Streak ----------
  function streak(now = Date.now()) {
    const st = app.save.streak;
    const cur = streakNow(st, now);
    const today = dayKey(now);
    const next = nextMilestone(cur);
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    let nextText = '';
    if (next) {
      const extra = streakRewards(next).map((r) => r.name);
      nextText = `${plural(next - cur, 'day')} to a crate${extra.length ? ' + ' + extra.join(' + ') : ''}`;
    }
    // month calendar (Monday first)
    const d0 = new Date(now);
    const first = new Date(d0.getFullYear(), d0.getMonth(), 1);
    const firstKey = dayKey(first.getTime());
    const nDays = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const played = new Set(st.days), shields = new Set(st.shieldUsedDays);
    const grid = h('div', { class: 'cal-grid', role: 'grid' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => h('span', { class: 'cal-dow', 'aria-hidden': 'true' }, x)));
    for (let i = 0; i < lead; i++) grid.append(h('span', { class: 'cal-day blank' }));
    for (let i = 0; i < nDays; i++) {
      const k = addDays(firstKey, i);
      const cls = ['cal-day', played.has(k) && 'played', shields.has(k) && 'shield', k === today && 'today', dayDiff(today, k) > 0 && 'future'].filter(Boolean).join(' ');
      const lbl = `${i + 1}${played.has(k) ? ', streak day' : shields.has(k) ? ', saved by a shield' : ''}`;
      grid.append(h('span', { class: cls, 'data-day': k, 'aria-label': lbl, html: shields.has(k) && !played.has(k) ? icon('shield') : played.has(k) ? icon('flame') : '' }, h('b', {}, String(i + 1))));
    }
    const wk = isoWeek(now);
    const shieldUsed = st.shieldUsedDays.some((k) => isDayKey(k) && weekOfDay(k) === wk);
    bodies.streak.replaceChildren(
      h('div', { class: 'streak-hero' + (cur ? '' : ' cold') },
        h('span', { class: 'streak-flame', html: icon('flame') }),
        h('div', { class: 'streak-nums' }, h('div', { class: 'streak-cur', id: 'streak-cur' }, h('b', {}, String(cur)), ` day${cur === 1 ? '' : 's'}`), h('div', { class: 'streak-best' }, `Best ${Math.max(st.best, cur)}`))),
      h('p', { class: 'streak-how' }, cur ? 'Finish the daily mission (8 words) or the Friday Test each day to keep it going.' : 'Finish the daily mission (8 words) to start a streak.'),
      nextText ? h('p', { class: 'streak-next', id: 'streak-next' }, h('span', { html: icon('crate') }), nextText) : null,
      h('div', { class: 'cal' }, h('div', { class: 'cal-head' }, d0.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })), grid),
      h('p', { class: 'shield-line' + (shieldUsed ? ' used' : ''), id: 'shield-line' }, h('span', { html: icon('shield') }),
        shieldUsed ? "This week's shield is used. Next one on Monday!" : 'Shield ready: it saves your streak if you miss one day this week.'));
  }

  // ---------- Trophies ----------
  function trophies() {
    const w = app.words;
    if (!w) { bodies.trophies.replaceChildren(); return; }
    const shelf = trophyShelf(app.save, w);
    const cur = shelf.current;
    const slot = (x, big) => h('div', { class: `tr-slot${x.mastered ? ' gold' : ''}${big ? '' : ' mini'}`, 'data-word': x.word, 'aria-label': `${x.word}: ${x.mastered ? 'mastered' : 'not yet'}` },
      h('span', { class: 'tr-cup', html: icon('trophy') }), h('span', { class: 'tr-word' }, x.word));
    const won = cur ? cur.slots.filter((x) => x.mastered).length : 0;
    $('#trophy-count').textContent = cur ? `${won} / ${cur.slots.length}` : '';
    const parts = [];
    if (cur) {
      parts.push(h('div', { class: 'tr-week' },
        h('div', { class: 'tr-title' }, h('span', {}, cur.sample ? "This week's words" : cur.name), cur.champion ? h('span', { class: 'champ-chip', id: 'tr-champion' }, h('span', { html: icon('crown') }), 'Week Champion') : null),
        h('div', { class: 'shelf', id: 'tr-shelf' }, cur.slots.map((x) => slot(x, true))),
        h('p', { class: 'tr-help' }, won === cur.slots.length ? 'Every word mastered. Champion!' : 'A word is mastered after 3 first-try spells on 2 different days.')));
    }
    const past = shelf.past.filter((p) => p.slots.length);
    if (past.length) {
      parts.push(h('h4', { class: 'tr-past-h' }, 'Past weeks'));
      for (const p of past) {
        const n = p.slots.filter((x) => x.mastered).length;
        parts.push(h('div', { class: 'tr-past', 'data-list': p.id },
          h('div', { class: 'tr-title' }, h('span', {}, p.name), h('small', {}, `${n} / ${p.slots.length}`), p.champion ? h('span', { class: 'champ-chip' }, h('span', { html: icon('crown') }), 'Champion') : null),
          h('div', { class: 'shelf' }, p.slots.map((x) => slot(x, false)))));
      }
    }
    bodies.trophies.replaceChildren(...parts);
  }

  const renderers = { achievements, streak, trophies };
  return { render(name) { if (renderers[name]) renderers[name](); } };
}
