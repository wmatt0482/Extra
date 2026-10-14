// Results: distance + NEW RECORD (with fireworks), rating stamp (S/A/B/C/D), stat tiles, a cash
// breakdown that always adds up to the total (v2 adds Combo and Air rows), a count-up on the total,
// plus goal / daily / unlock / achievement callouts. Buttons: Garage / Retry / Next track.
import { CAR_BY_ID } from '../data/cars.js';
import { TRACK_BY_ID } from '../data/tracks.js';
import { isUnlocked, nextTrackId, ratingFor } from '../meta/economy.js';
import { $, h, money, fmt1 } from './dom.js';
import { createFireworks } from './fireworks.js';
import { icon } from './icons.js';

const LANDING = { perfect: 'Perfect', good: 'Good', rough: 'Rough', crash: 'Crash' };
const LANDING_PAY = { perfect: 300, good: 100, rough: 0, crash: 0 };
const COUNT_MS = 1200;

// The landing bonus is paid for the jump's landing (summary.landing) plus half for kicker landings
// (v2); label the row from the cash actually paid so a mismatched engine can never show "Crash · $100".
function landingHint(cash, mult, first, rejumps) {
  const base = Math.round((cash || 0) / mult);
  const firstPay = LANDING_PAY[first];
  if (rejumps > 0 && firstPay != null && base > firstPay + 5) return `${LANDING[first]} + rejump`;
  if (base >= 250) return 'Perfect';
  if (base >= 80) return 'Good';
  return LANDING[first] || 'none';
}

export function createResults(app) {
  const el = {
    screen: $('#screen-results'), title: $('#res-title'), dist: $('#res-distance'), record: $('#res-record'), sub: $('#res-sub'),
    stats: $('#res-stats'), pay: $('#res-pay'), callouts: $('#res-callouts'), stamp: $('#res-stamp'), stampLetter: $('#res-stamp-letter'),
    retry: $('#res-retry'), garage: $('#res-garage'), next: $('#res-next'),
  };
  const fx = createFireworks($('#res-fx'));
  let last = null, countRaf = 0, stampTimer = 0;

  el.retry.addEventListener('click', () => last && app.startRun({ trackId: last.trackId, daily: last.daily }));
  el.garage.addEventListener('click', () => app.go('garage'));
  el.next.addEventListener('click', () => {
    const n = last && nextTrackId(last.trackId);
    if (n && isUnlocked(app.save, n)) { app.save.selectedTrack = n; app.persist(); app.startRun({ trackId: n }); }
  });

  function countUp(td, value) {
    cancelAnimationFrame(countRaf);
    const reduced = app.save.settings.reducedMotion;
    td.dataset.value = String(value);
    if (reduced || value <= 0) { td.textContent = '$' + money(value); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const a = Math.min(1, (now - t0) / COUNT_MS);
      const e = 1 - Math.pow(1 - a, 3);
      td.textContent = '$' + money(Math.round(value * e));
      if (a < 1) countRaf = requestAnimationFrame(tick);
      else td.classList.add('landed');
    };
    td.textContent = '$0';
    countRaf = requestAnimationFrame(tick);
  }

  function stamp(rating) {
    clearTimeout(stampTimer);
    el.stamp.hidden = true;
    if (!rating) return;
    el.stamp.className = 'stamp r-' + rating;
    el.stamp.dataset.rating = rating;
    el.stampLetter.textContent = rating;
    el.stamp.setAttribute('aria-label', `Rating ${rating}`);
    // slam in once the panel has landed
    stampTimer = setTimeout(() => {
      el.stamp.hidden = false;
      void el.stamp.offsetWidth;
      el.stamp.classList.add('slam');
      setTimeout(() => app.audio.land(rating === 'S' ? 'perfect' : 'good'), 260);
    }, app.save.settings.reducedMotion ? 0 : 450);
  }

  function statTiles(s) {
    const base = [
      ['air', 'Air time', fmt1(s.airTime), 's'], ['flips', 'Flips', String(s.flips || 0)], ['smashed', 'Smashed', String(s.smashed || 0)],
      ['speed', 'Top speed', String(Math.round(s.maxSpeedKmh || 0)), 'km/h'], ['landing', 'Landing', LANDING[s.landing] || '—'], ['time', 'Time', fmt1(s.durationSec), 's'],
    ];
    const targets = s.airTargets || s.rings || 0;
    const extras = [
      s.bestCombo >= 2 && ['combo', 'Combo', `${s.bestCombo}`, 'hits'],
      s.maxAltitude >= 1 && ['altitude', 'Altitude', String(Math.round(s.maxAltitude)), 'm'],
      targets > 0 && ['targets', s.airTargets ? 'Targets' : 'Rings', String(targets)],
      s.rejumps > 0 && ['rejumps', 'Rejumps', String(s.rejumps)],
    ].filter(Boolean);
    // keep the grid tidy: at most 8 tiles (2 rows), 3 columns for ≤ 6, 4 columns for 8
    let tiles = [...base, ...extras];
    for (const id of ['time', 'landing']) {
      if (tiles.length > 8 || tiles.length === 7) tiles = tiles.filter((t) => t[0] !== id);
    }
    const four = tiles.length > 6;
    el.stats.classList.toggle('cols-4', four);
    el.stats.innerHTML = '';
    for (const [id, k0, v, unit] of tiles) {
      const k = four && id === 'speed' ? 'Speed' : k0;
      el.stats.append(h('div', { class: 'stat', 'data-stat': id }, h('b', {}, v, unit ? h('small', {}, unit) : null), h('span', {}, k)));
    }
  }

  function show(r) {
    if (!r) r = last;
    if (!r) return;
    last = r;
    const { summary: s, bank, trackId } = r;
    const track = TRACK_BY_ID[trackId];
    const car = CAR_BY_ID[r.carId];
    const mult = r.stats.coinMult || 1;
    el.title.textContent = r.daily ? 'Daily challenge' : s.finishCrossed ? 'Finish line!' : s.landing === 'crash' ? 'Wrecked!' : 'Run over';
    el.dist.textContent = money(Math.floor(s.distance || 0));
    const record = !!(bank.newBest && !r.daily);
    el.record.hidden = !record;
    let sub = `${track.name} · ${car.name}`;
    if (!r.daily) {
      if (bank.newBest && bank.prevBest > 0) sub += ` · +${money(Math.floor(s.distance) - bank.prevBest)} m over best`;
      else if (!bank.newBest) sub += ` · best ${money(app.save.best[trackId] || 0)} m`;
      if (!s.finishCrossed) sub += ` · finish ${money(track.finish)} m`;
    } else sub += ' · loaner car';
    el.sub.textContent = sub;
    statTiles(s);

    // payout table — rows sum exactly to cash.total; any rounding/multiplier difference gets its own row
    const c = s.cash || { distance: 0, stunts: 0, smash: 0, landing: 0, total: 0 };
    const extraTargets = Math.max(0, (s.airTargets || 0) - (s.rings || 0));
    const rows = [
      ['Distance', `${money(Math.floor(s.distance || 0))} m`, c.distance],
      ['Stunts', `${s.flips || 0} flip${s.flips === 1 ? '' : 's'} · ${fmt1(s.airTime)} s air`, c.stunts],
      ['Smashes', `${s.smashed || 0} prop${s.smashed === 1 ? '' : 's'}${s.explosions ? ` · ${s.explosions} boom${s.explosions === 1 ? '' : 's'}` : ''}`, c.smash],
      ['Combo', s.bestCombo ? `best chain ${s.bestCombo} hits` : 'chain multiplier', c.combo || 0, true],
      ['Air', [s.rings ? `${s.rings} ring${s.rings === 1 ? '' : 's'}` : '', extraTargets ? `${extraTargets} target${extraTargets === 1 ? '' : 's'}` : '', s.maxAltitude >= 45 ? `${Math.round(s.maxAltitude)} m orbit` : ''].filter(Boolean).join(' · ') || 'air targets', c.air || 0, true],
      ['Landing', landingHint(c.landing, mult, s.landing, s.rejumps || 0), c.landing],
    ].filter((row) => !(row[3] && !row[2]));     // hide Combo / Air when they paid nothing
    const sum = rows.reduce((a, row) => a + (row[2] || 0), 0);
    const diff = Math.round((c.total || 0) - sum);
    if (diff !== 0) rows.push(['Bonus', `×${mult.toFixed(2)} cash multiplier`, diff]);
    el.pay.innerHTML = '';
    for (const [k, hint, v] of rows) {
      el.pay.append(h('tr', { 'data-pay': k.toLowerCase() }, h('td', {}, k, ' ', h('span', { class: 'hint' }, hint)), h('td', { 'data-value': String(v || 0) }, '$' + money(v))));
    }
    const totalTd = h('td', {});
    el.pay.append(h('tr', { class: 'total', 'data-pay': 'total' }, h('td', { class: 'display' }, 'Run total', ' ', h('span', { class: 'hint' }, `incl. ×${mult.toFixed(2)}`)), totalTd));
    countUp(totalTd, Math.round(c.total || 0));
    for (const g of r.goals) el.pay.append(h('tr', { class: 'extra', 'data-pay': 'goal' }, h('td', {}, 'Goal ', h('span', { class: 'hint' }, g.text)), h('td', { 'data-value': String(g.reward) }, '+$' + money(g.reward))));
    if (r.dailyReward) el.pay.append(h('tr', { class: 'extra', 'data-pay': 'daily' }, h('td', {}, 'Daily ', h('span', { class: 'hint' }, 'challenge complete')), h('td', { 'data-value': String(r.dailyReward) }, '+$' + money(r.dailyReward))));

    el.callouts.innerHTML = '';
    if (bank.unlocked) el.callouts.append(h('span', { class: 'callout' }, `Unlocked: ${TRACK_BY_ID[bank.unlocked].name}!`));
    if (bank.newBestScore) el.callouts.append(h('span', { class: 'callout cyan' }, 'Best score!'));
    // the run's new achievements: one compact chip (medals + name, or a count when several)
    const achs = r.achievements || [];
    if (achs.length) {
      el.callouts.append(h('span', { class: `callout ach-callout tone-${achs.length === 1 ? achs[0].tone || 'gold' : 'gold'}`, title: achs.map((a) => a.name).join(', ') },
        h('span', { class: 'medals' }, achs.slice(0, 4).map((a, i) => h('i', { class: `tone-${a.tone || 'gold'}`, 'data-ach': a.id, style: { animationDelay: `${0.45 + i * 0.1}s` }, html: icon(a.icon) }))),
        achs.length === 1 ? achs[0].name : `${achs.length} new badges`));
    }
    if (r.daily) {
      if (r.dailyReward) el.callouts.append(h('span', { class: 'callout' }, 'Daily complete!'));
      else if (r.dailyAlreadyDone) el.callouts.append(h('span', { class: 'callout cyan' }, 'Daily already claimed today'));
      else el.callouts.append(h('span', { class: 'callout cyan' }, `Daily: ${r.dailyGoalText} (got ${r.dailyValue})`));
    }

    stamp(s.rating || ratingFor(c.total, track.finish));
    fx.stop();
    if (record) {
      if (!app.save.settings.reducedMotion) fx.start(2800);
      setTimeout(() => app.audio.fireworks(), 150);
    }

    const n = nextTrackId(trackId);
    el.next.hidden = r.daily || !n;
    el.next.disabled = !(n && isUnlocked(app.save, n));
    el.next.title = n ? (isUnlocked(app.save, n) ? TRACK_BY_ID[n].name : `Cross ${track.name}'s finish to unlock`) : '';
    app.refreshCash();
  }
  return {
    show,
    hide() { fx.stop(); cancelAnimationFrame(countRaf); clearTimeout(stampTimer); },
  };
}
