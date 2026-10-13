// Results: distance + NEW RECORD, stat chips, a cash breakdown that always adds up to the total,
// plus goal / daily / unlock callouts. Buttons: Garage / Retry / Next track.
import { CAR_BY_ID } from '../data/cars.js';
import { TRACK_BY_ID } from '../data/tracks.js';
import { isUnlocked, nextTrackId } from '../meta/economy.js';
import { $, h, money, fmt1 } from './dom.js';

const LANDING = { perfect: 'Perfect', good: 'Good', rough: 'Rough', crash: 'Crash' };

// The bonus is paid for the first landing of the run, while summary.landing is the last one; label the
// row from the cash actually paid so "Crash · $100" never shows up.
function landingHint(cash, mult, last) {
  const base = Math.round((cash || 0) / mult);
  if (base >= 250) return 'Perfect';
  if (base >= 80) return 'Good';
  return LANDING[last] || 'none';
}

export function createResults(app) {
  const el = {
    title: $('#res-title'), dist: $('#res-distance'), record: $('#res-record'), sub: $('#res-sub'),
    stats: $('#res-stats'), pay: $('#res-pay'), callouts: $('#res-callouts'),
    retry: $('#res-retry'), garage: $('#res-garage'), next: $('#res-next'),
  };
  let last = null;

  el.retry.addEventListener('click', () => last && app.startRun({ trackId: last.trackId, daily: last.daily }));
  el.garage.addEventListener('click', () => app.go('garage'));
  el.next.addEventListener('click', () => {
    const n = last && nextTrackId(last.trackId);
    if (n && isUnlocked(app.save, n)) { app.save.selectedTrack = n; app.persist(); app.startRun({ trackId: n }); }
  });

  function show(r) {
    if (!r) r = last;
    if (!r) return;
    last = r;
    const { summary: s, bank, trackId } = r;
    const track = TRACK_BY_ID[trackId];
    const car = CAR_BY_ID[r.carId];
    el.title.textContent = r.daily ? 'Daily challenge' : s.finishCrossed ? 'Finish line!' : s.landing === 'crash' ? 'Wrecked!' : 'Run over';
    el.dist.textContent = money(Math.floor(s.distance || 0));
    el.record.hidden = !(bank.newBest && !r.daily);
    let sub = `${track.name} · ${car.name}`;
    if (!r.daily) {
      if (bank.newBest && bank.prevBest > 0) sub += ` · +${money(Math.floor(s.distance) - bank.prevBest)} m over best`;
      else if (!bank.newBest) sub += ` · best ${money(app.save.best[trackId] || 0)} m`;
      sub += ` · finish ${money(track.finish)} m`;
    } else sub += ' · loaner car';
    el.sub.textContent = sub;

    el.stats.innerHTML = '';
    const chips = [
      ['Air time', fmt1(s.airTime), 's'], ['Flips', String(s.flips || 0)], ['Smashed', String(s.smashed || 0)],
      ['Top speed', String(Math.round(s.maxSpeedKmh || 0)), 'km/h'], ['Landing', LANDING[s.landing] || '—'], ['Time', fmt1(s.durationSec), 's'],
    ];
    for (const [k, v, unit] of chips) el.stats.append(h('div', { class: 'stat' }, h('b', {}, v, unit ? h('small', {}, unit) : null), h('span', {}, k)));

    // payout table — rows sum exactly to cash.total; any rounding/multiplier difference gets its own row
    const c = s.cash || { distance: 0, stunts: 0, smash: 0, landing: 0, total: 0 };
    const rows = [
      ['Distance', `${money(Math.floor(s.distance || 0))} m`, c.distance],
      ['Stunts', `${s.flips || 0} flip${s.flips === 1 ? '' : 's'} · ${fmt1(s.airTime)} s air`, c.stunts],
      ['Smashes', `${s.smashed || 0} prop${s.smashed === 1 ? '' : 's'}`, c.smash],
      ['Landing', landingHint(c.landing, r.stats.coinMult || 1, s.landing), c.landing],
    ];
    const sum = rows.reduce((a, r) => a + (r[2] || 0), 0);
    const diff = Math.round((c.total || 0) - sum);
    if (diff !== 0) rows.push(['Bonus', `×${(r.stats.coinMult || 1).toFixed(2)} cash multiplier`, diff]);
    el.pay.innerHTML = '';
    for (const [k, hint, v] of rows) {
      el.pay.append(h('tr', { 'data-pay': k.toLowerCase() }, h('td', {}, k, ' ', h('span', { class: 'hint' }, hint)), h('td', {}, '$' + money(v))));
    }
    el.pay.append(h('tr', { class: 'total', 'data-pay': 'total' }, h('td', { class: 'display' }, 'Run total', ' ', h('span', { class: 'hint' }, `incl. ×${(r.stats.coinMult || 1).toFixed(2)}`)), h('td', {}, '$' + money(c.total))));
    for (const g of r.goals) el.pay.append(h('tr', { class: 'extra', 'data-pay': 'goal' }, h('td', {}, 'Goal ', h('span', { class: 'hint' }, g.text)), h('td', {}, '+$' + money(g.reward))));
    if (r.dailyReward) el.pay.append(h('tr', { class: 'extra', 'data-pay': 'daily' }, h('td', {}, 'Daily ', h('span', { class: 'hint' }, 'challenge complete')), h('td', {}, '+$' + money(r.dailyReward))));

    el.callouts.innerHTML = '';
    if (bank.unlocked) el.callouts.append(h('span', { class: 'callout' }, `Unlocked: ${TRACK_BY_ID[bank.unlocked].name}!`));
    if (bank.newBestScore) el.callouts.append(h('span', { class: 'callout cyan' }, 'Best score!'));
    if (r.daily) {
      if (r.dailyReward) el.callouts.append(h('span', { class: 'callout' }, 'Daily complete!'));
      else if (r.dailyAlreadyDone) el.callouts.append(h('span', { class: 'callout cyan' }, 'Daily already claimed today'));
      else el.callouts.append(h('span', { class: 'callout cyan' }, `Daily: ${r.dailyGoalText} (got ${r.dailyValue})`));
    }

    const n = nextTrackId(trackId);
    el.next.hidden = r.daily || !n;
    el.next.disabled = !(n && isUnlocked(app.save, n));
    el.next.title = n ? (isUnlocked(app.save, n) ? TRACK_BY_ID[n].name : `Cross ${track.name}'s finish to unlock`) : '';
    app.refreshCash();
  }
  return { show, hide() {} };
}
