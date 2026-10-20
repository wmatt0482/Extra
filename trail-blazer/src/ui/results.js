// Results → podium (SPEC v1.1 §5): the top three on a podium (each Ranger in its paint, with the rider's name; the
// player's step ringed), the race time with the medal it earned (Gold / Silver / Bronze from the track's target times)
// and the best time, stat tiles, a cash breakdown whose rows always add up to the total that was banked (distance, air,
// flips, perfect landings, coins, position bonus, finish bonus; whatever the total holds beyond the parts shows as a
// Bonus row), and callouts for what the race unlocked (the next track on 3rd or better, a medal, a paint, a decal).
// Title: "1st place!" / "Podium!" / "Race over". Buttons: Garage / Race again / Next track.
// v1.2 (math layer): the race's facts (✓ right first try, ⚡ quick, ↻ fixed), "N facts mastered!", the daily mission
// (its $400 shows as an extra row under the total: paid when it happened, not part of the race's cash), the XP and a
// level-up stamp. (v1.4: the Pit Crew Check comes before a race now, not on the results.)
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { MEDAL_LABEL, fmtTime, ordinal } from '../data/medals.js';
import { factAnswer, factText } from '../facts/facts.js';
import { icon } from './tbIcons.js';
import { drawPreview } from './vehiclePreview.js';

const LABEL = { distance: 'Distance', air: 'Air time', flips: 'Flips', perfect: 'Perfect landings', smash: 'Smashes', coins: 'Trail coins',
  place: 'Position bonus', finish: 'Finish bonus', gates: 'Gates', quick: 'Quick answers', bonus: 'Bonus' };
const COUNT_MS = 1100;
const fmt1 = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);

export function createResults(app) {
  const el = {
    title: $('#res-title'), podium: $('#res-podium'), time: $('#res-time'), medal: $('#res-medal'), record: $('#res-record'), sub: $('#res-sub'),
    facts: $('#res-facts'), moment: $('#res-moment'), pay: $('#res-pay'), callouts: $('#res-callouts'), again: $('#res-again'), garage: $('#res-garage'), next: $('#res-next'),
  };
  let last = null, countRaf = 0, medalTimer = 0, momentTimers = [];
  const clearMoment = () => { momentTimers.forEach(clearTimeout); momentTimers = []; el.moment.hidden = true; el.moment.replaceChildren(); };
  function levelUp(level) {
    el.moment.replaceChildren(h('div', { class: 'lvl-stamp', id: 'res-levelup', role: 'img', 'aria-label': `Level ${level}` }, h('div', {}, h('small', {}, 'Level'), h('b', {}, String(level)))));
    el.moment.hidden = false;
    app.audio.levelUp();
    momentTimers.push(setTimeout(clearMoment, app.settings.reducedMotion ? 1200 : 2200));
  }

  el.again.addEventListener('click', () => last && app.startRide(last.trail.id));
  el.garage.addEventListener('click', () => app.go('garage'));
  el.next.addEventListener('click', () => { if (last && last.next) { app.save.selectedTrail = last.next.id; app.persist(); app.startRide(last.next.id); } });

  function countUp(td, value) {
    cancelAnimationFrame(countRaf);
    td.dataset.value = String(value);
    if (app.settings.reducedMotion || value <= 0) { td.textContent = '$' + money(value); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const a = Math.min(1, (now - t0) / COUNT_MS);
      td.textContent = '$' + money(Math.round(value * (1 - Math.pow(1 - a, 3))));
      if (a < 1) countRaf = requestAnimationFrame(tick);
    };
    td.textContent = '$0';
    countRaf = requestAnimationFrame(tick);
  }
  function factsRow(list) {
    if (!list || !list.length) { el.facts.replaceChildren(); el.facts.hidden = true; return; }
    el.facts.hidden = false;
    el.facts.replaceChildren(...list.map((f) => {
      const kind = f.quick ? 'quick' : f.correct ? 'ok' : 'fixed';
      const mark = f.quick ? '⚡' : f.correct ? '✓' : '↻';
      return h('span', { class: `rf ${kind}`, 'data-fact': f.fact, 'data-kind': kind, title: kind === 'quick' ? 'Quick!' : kind === 'ok' ? 'Right first try' : 'Fixed' },
        h('b', {}, `${factText(f.fact, f.flip)} = ${factAnswer(f.fact)}`), h('span', { class: 'mk', 'aria-label': kind }, mark));
    }));
  }

  // podium order on screen: 2nd, 1st, 3rd
  function podium(rows) {
    const top = [2, 1, 3].map((p) => rows.find((x) => x.place === p)).filter(Boolean);
    const cols = top.map((x) => {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      const col = h('div', { class: `pod p${x.place}${x.me ? ' me' : ''}`, 'data-place': String(x.place), 'data-name': x.name },
        cv, h('span', { class: 'pod-name' }, x.me ? `${x.name} (you)` : x.name), h('span', { class: 'pod-step' }, String(x.place)));
      requestAnimationFrame(() => drawPreview(cv, { paint: x.paint }, { floor: false }));
      return col;
    });
    el.podium.replaceChildren(...cols);
    el.podium.setAttribute('aria-label', `Podium: ${top.slice().sort((a, b) => a.place - b.place).map((x) => `${ordinal(x.place)} ${x.name}`).join(', ')}`);
  }

  function show(r) {
    last = r;
    const s = r.summary;
    const place = r.place;
    el.title.textContent = place === 1 ? '1st place!' : place && place <= 3 ? 'Podium!' : 'Race over';
    el.title.dataset.place = String(place || 0);
    podium(r.standings || []);
    el.time.textContent = s.finishCrossed ? fmtTime(r.timeSec) : 'DNF';
    clearTimeout(medalTimer);
    const m = r.bank.medal;
    el.medal.hidden = !m;
    if (m) {
      el.medal.className = `medal-badge m-${m}`;
      el.medal.dataset.medal = m;
      el.medal.textContent = MEDAL_LABEL[m];
      if (!app.settings.reducedMotion) medalTimer = setTimeout(() => { el.medal.classList.add('slam'); app.audio.land('perfect'); }, 450);
    }
    el.record.hidden = !(r.bank.newBestTime && r.bank.prevBestTime);
    const best = app.save.bestTime[r.trail.id];
    const t = r.medalTimes || {};
    el.sub.textContent = `${r.trail.name} · ${place ? `${ordinal(place)} of ${(r.standings || []).length || 4}` : 'not finished'}${best ? ` · best ${fmtTime(best)}` : ''}${t.gold ? ` · 1st = gold · or beat ${fmtTime(t.gold)}` : ''}`;
    el.sub.textContent += ` · ${s.flips || 0} flip${s.flips === 1 ? '' : 's'} · ${fmt1(s.airTime)} s air${s.crashes ? ` · ${s.crashes} crash${s.crashes === 1 ? '' : 'es'}` : ''}`;
    const math = r.math;
    factsRow(math && math.facts);
    const hints = { distance: `${money(Math.floor(s.distance || 0))} m`, air: `${fmt1(s.airTime)} s`, flips: `${s.flips || 0}×`, coins: `${s.coins || 0}×`, place: place ? ordinal(place) : '' };
    const rows = r.rows.map((row) => h('tr', { 'data-row': row.key },
      h('td', {}, LABEL[row.key] || row.key, hints[row.key] ? h('span', { class: 'hint' }, ` · ${hints[row.key]}`) : null),
      h('td', { 'data-value': String(row.value) }, '$' + money(row.value))));
    const totalTd = h('td', { id: 'res-total' });
    const extra = math && math.missionPaid ? [h('tr', { class: 'extra', 'data-extra': 'mission' }, h('td', {}, 'Daily mission', h('span', { class: 'hint' }, ' · paid on the 12th gate')), h('td', {}, '+$' + money(math.missionPaid)))] : [];
    el.pay.replaceChildren(h('tbody', {}, ...rows, h('tr', { class: 'total' }, h('td', {}, 'Total'), totalTd), ...extra));
    countUp(totalTd, r.total);
    const call = [];
    if (math && math.mastered.length) call.push(h('span', { class: 'callout mastered', 'data-callout': 'mastered' }, `${math.mastered.length} fact${math.mastered.length > 1 ? 's' : ''} mastered!`));
    if (math && math.missionPaid) call.push(h('span', { class: 'callout orange', 'data-callout': 'mission' }, `Mission complete! +$${money(math.missionPaid)}`));
    else if (math && math.facts.length) call.push(h('span', { class: 'callout', 'data-callout': 'mission-progress' }, math.mission.done ? 'Mission done today' : `Today ${math.mission.count} / ${math.mission.size} gates`));
    if (math && math.xp) call.push(h('span', { class: 'callout xp', 'data-callout': 'xp' }, `+${math.xp} XP`));
    if (r.bank.newMedal) call.push(h('span', { class: 'callout orange', 'data-callout': 'medal', 'data-medal': m }, `${MEDAL_LABEL[m]} medal!`));
    if (r.unlocked) call.push(h('span', { class: 'callout', 'data-callout': 'unlock', 'data-trail': r.unlocked.id }, h('span', { html: icon('trail') }), `Unlocked: ${r.unlocked.name}`));
    const ps = r.bank.paints;
    if (ps.length) call.push(h('span', { class: 'callout', 'data-callout': 'paint', 'data-paint': ps.map((p) => p.id).join(' ') },
      ...ps.map((p) => h('i', { class: 'sw', style: { background: p.swatch || p.body } })), `New paint${ps.length > 1 ? 's' : ''}: ${ps.map((p) => p.name).join(', ')}`));
    if (r.bank.decals.length) call.push(h('span', { class: 'callout', 'data-callout': 'decal', 'data-decals': r.bank.decals.map((d) => d.id).join(' ') }, `New decal${r.bank.decals.length > 1 ? 's' : ''}: ${r.bank.decals.map((d) => d.name).join(', ')}`));
    if (s.finishCrossed && place > 3 && !r.next) call.push(h('span', { class: 'callout orange', 'data-callout': 'need-podium' }, 'Finish 3rd or better to open the next track'));
    el.callouts.replaceChildren(...call);
    el.next.hidden = !r.next;
    clearMoment();
    const leveled = math && math.levelAfter > math.levelBefore;
    if (leveled) momentTimers.push(setTimeout(() => levelUp(math.levelAfter), app.settings.reducedMotion ? 200 : 1300));
  }
  return { show, hide() { clearTimeout(medalTimer); cancelAnimationFrame(countRaf); clearMoment(); } };
}
