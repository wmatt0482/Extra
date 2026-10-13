// Modal panels: Daily challenge, Goals, Records, Settings (+ in-page reset confirm).
import { CAR_BY_ID } from '../data/cars.js';
import { TRACKS, TRACK_BY_ID } from '../data/tracks.js';
import { dailyFor, msUntilReset, refreshDaily, todayKey } from '../meta/daily.js';
import { ensureGoals, goalIcon, goalText } from '../meta/goals.js';
import { drawCar } from './carPreview.js';
import { $, h, money, fmt1 } from './dom.js';
import { COIN, icon } from './icons.js';

function toggleRow(label, sub, on, onToggle, id) {
  const t = h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, id });
  t.addEventListener('click', () => {
    const v = t.getAttribute('aria-checked') !== 'true';
    t.setAttribute('aria-checked', String(v));
    onToggle(v);
  });
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, label), sub ? h('div', { class: 'sub' }, sub) : null), t);
}

function countdown(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function createPanels(app) {
  const bodies = { daily: $('#daily-body'), goals: $('#goals-body'), records: $('#records-body'), settings: $('#settings-body') };

  function daily() {
    const b = bodies.daily;
    refreshDaily(app.save);
    const d = dailyFor(todayKey());
    const car = CAR_BY_ID[d.carId], track = TRACK_BY_ID[d.trackId];
    const cv = h('canvas', { 'aria-label': car.name });
    const done = app.save.daily.done;
    const play = h('button', { class: 'btn btn-yellow', id: 'daily-play', 'data-sfx': '' }, done ? 'Play again' : 'Play daily');
    play.addEventListener('click', () => { app.closePanel(); app.startRun({ trackId: d.trackId, daily: true }); });
    b.replaceChildren(
      h('div', { class: 'daily-hero' }, cv,
        h('div', {},
          h('div', { class: 'daily-goal' }, d.goal.text),
          h('div', { class: 'daily-meta' },
            h('div', {}, 'Track ', h('b', {}, track.name), ' · Car ', h('b', {}, car.name)),
            h('div', {}, `Loaner tune: all upgrades Lv ${d.loanLevel} · attempts today: ${app.save.daily.attempts}`)))),
      h('div', { class: 'daily-foot' },
        done ? h('span', { class: 'done-chip' }, 'Done today ✓') : h('span', { class: 'reward', html: `Reward ${COIN} ${money(d.reward)}` }),
        h('span', { class: 'muted', style: 'font-size:13px;font-weight:700' }, `New challenge in ${countdown(msUntilReset())}`),
        play));
    requestAnimationFrame(() => drawCar(cv, car, {}));
  }

  function goals() {
    ensureGoals(app.save);
    const list = h('div', {});
    for (const g of app.save.goals.list) {
      const pct = Math.min(100, (g.progress / g.target) * 100);
      const prog = g.type === 'airTime' ? `${fmt1(g.progress)} / ${fmt1(g.target)} s` : `${money(g.progress)} / ${money(g.target)}`;
      list.append(h('div', { class: 'row', 'data-goal': g.type },
        h('div', { class: 'goal-icon', html: icon(goalIcon(g)) }),
        h('div', { class: 'grow' }, h('div', { class: 'label' }, goalText(g)), h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } })), h('div', { class: 'sub' }, prog)),
        h('span', { class: 'reward', html: `${COIN} ${money(g.reward)}` })));
    }
    bodies.goals.replaceChildren(list, h('div', { class: 'sub muted', style: 'font-size:12px;font-weight:700;margin-top:8px' },
      'Finished goals pay out on the results screen and a new goal rolls in. "In one run" goals keep your best attempt.'));
  }

  function records() {
    const s = app.save, r = s.records;
    const rows = TRACKS.map((t) => {
      const unlocked = s.unlocked.includes(t.id);
      const best = s.best[t.id] || 0;
      return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, t.name), h('div', { class: 'sub' }, unlocked ? `Finish at ${money(t.finish)} m` : 'Locked')),
        h('div', { class: 'val' }, best ? `${money(best)} m` : '—'));
    });
    const life = [
      ['Best score', '$' + money(r.bestScore)], ['Lifetime cash', '$' + money(r.lifetimeCash)], ['Total smashes', money(r.totalSmashes)],
      ['Total flips', money(r.totalFlips)], ['Perfect landings', money(r.perfectLandings)], ['Top speed', `${money(r.maxSpeedKmh)} km/h`],
      ['Longest air', `${fmt1(r.longestAir)} s`], ['Runs', money(r.runs)],
    ].map(([k, v]) => h('div', { class: 'row' }, h('div', { class: 'grow label' }, k), h('div', { class: 'val' }, v)));
    bodies.records.replaceChildren(h('div', { class: 'hud-label', style: 'margin-top:4px' }, 'BEST DISTANCE'), ...rows,
      h('div', { class: 'hud-label', style: 'margin-top:14px' }, 'LIFETIME'), ...life);
  }

  function settings() {
    const st = app.save.settings;
    const confirmBox = h('div', { class: 'confirm', id: 'reset-confirm', hidden: true },
      h('p', {}, 'Wipe all cash, cars, upgrades, records and goals? This cannot be undone.'),
      h('div', { class: 'btns' },
        h('button', { class: 'btn btn-sm', id: 'reset-cancel', onclick: () => { confirmBox.hidden = true; } }, 'Keep my stuff'),
        h('button', { class: 'btn btn-sm btn-hot', id: 'reset-yes', onclick: () => { app.resetProgress(); confirmBox.hidden = true; settings(); app.toast('Progress reset'); } }, 'Reset everything')));
    const reset = h('button', { class: 'btn btn-sm btn-hot', id: 'reset-open', onclick: () => { confirmBox.hidden = false; confirmBox.scrollIntoView({ block: 'nearest' }); } }, 'Reset');
    bodies.settings.replaceChildren(
      toggleRow('Sound effects', 'Engine, crashes, coins', st.sound, (v) => app.setSetting('sound', v), 'set-sound'),
      toggleRow('Music', 'Chiptune loop', st.music, (v) => app.setSetting('music', v), 'set-music'),
      toggleRow('Reduced motion', 'No screen shake or slow-mo', st.reducedMotion, (v) => app.setSetting('reducedMotion', v), 'set-motion'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Reset progress'), h('div', { class: 'sub' }, 'Start over from zero')), reset),
      confirmBox,
      h('div', { class: 'ver' }, `Ramp Rage ${app.version}${app.engineName ? ' · ' + app.engineName : ''} · keyboard: ← brake, → / Space gas, Shift nitro, Esc pause`));
  }

  const renderers = { daily, goals, records, settings };
  return { render(name) { if (renderers[name]) renderers[name](); } };
}
