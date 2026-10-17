// Results: distance + NEW BEST, the rating stamp (S..D), stat tiles, a cash breakdown whose rows always add up to the
// total that was banked (the engine's parts; whatever the total holds beyond them shows as a Bonus row), a count-up
// on the total, and callouts for what the ride unlocked (the next trail, a paint, a decal).
// Buttons: Garage / Ride again / Next trail.
// TODO (math phase, SPEC §2.6): the ride's facts (✓ / ⚡ / ↻), "N facts mastered", the mission and the level stamp.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { icon } from './tbIcons.js';

const LABEL = { distance: 'Distance', air: 'Air time', smash: 'Smashes', coins: 'Trail coins', gates: 'Gates', quick: 'Quick answers', finish: 'Finish bonus', bonus: 'Bonus' };
const COUNT_MS = 1100;
const fmt1 = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);

export function createResults(app) {
  const el = {
    title: $('#res-title'), dist: $('#res-distance'), record: $('#res-record'), sub: $('#res-sub'), stats: $('#res-stats'), pay: $('#res-pay'),
    callouts: $('#res-callouts'), stamp: $('#res-stamp'), stampLetter: $('#res-stamp-letter'), again: $('#res-again'), garage: $('#res-garage'), next: $('#res-next'),
  };
  let last = null, countRaf = 0, stampTimer = 0;

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
  function stamp(rating) {
    clearTimeout(stampTimer);
    el.stamp.hidden = true;
    if (!rating) return;
    el.stamp.className = 'stamp r-' + rating;
    el.stampLetter.textContent = rating;
    el.stamp.setAttribute('aria-label', `Rank ${rating}`);
    stampTimer = setTimeout(() => { el.stamp.hidden = false; void el.stamp.offsetWidth; el.stamp.classList.add('slam'); app.audio.land('perfect'); }, app.settings.reducedMotion ? 0 : 500);
  }
  const tile = (value, unit, label, key) => h('div', { class: 'stat', 'data-stat': key }, h('b', {}, value, unit ? h('small', {}, unit) : null), h('span', {}, label));

  function show(r) {
    last = r;
    const s = r.summary;
    el.title.textContent = s.finishCrossed ? (r.bank.firstFinish ? `${r.trail.name} finished!` : 'Trail finished!') : 'Ride over';
    el.dist.textContent = money(Math.floor(s.distance || 0));
    el.record.hidden = !r.bank.newBest || !r.bank.prevBest;
    el.sub.textContent = `${r.trail.name} · ${money(r.trail.length || 0)} m trail · best ${money(app.save.best[r.trail.id] || 0)} m`;
    el.stats.replaceChildren(
      tile(String(Math.round(s.maxSpeedKmh || 0)), 'km/h', 'Top speed', 'speed'),
      tile(fmt1(s.airTime), 's', 'Air time', 'air'),
      tile(String(s.flips || 0), '', 'Flips', 'flips'),
      tile(String(s.smashed || 0), '', 'Smashes', 'smashed'),
      tile(String(s.coins || 0), '', 'Coins', 'coins'),
      tile(String(s.winches || 0), '', 'Winches', 'winches'));
    const hints = { distance: `${money(Math.floor(s.distance || 0))} m`, air: `${fmt1(s.airTime)} s`, smash: `${s.smashed || 0}×`, coins: `${s.coins || 0}×` };
    const rows = r.rows.map((row) => h('tr', { 'data-row': row.key },
      h('td', {}, LABEL[row.key] || row.key, hints[row.key] ? h('span', { class: 'hint' }, ` · ${hints[row.key]}`) : null),
      h('td', { 'data-value': String(row.value) }, '$' + money(row.value))));
    const totalTd = h('td', { id: 'res-total' });
    el.pay.replaceChildren(h('tbody', {}, ...rows, h('tr', { class: 'total' }, h('td', {}, 'Total'), totalTd)));
    countUp(totalTd, r.total);
    const call = [];
    if (r.unlocked) call.push(h('span', { class: 'callout', 'data-callout': 'unlock' }, h('span', { html: icon('trail') }), `Unlocked: ${r.unlocked.name}`));
    for (const p of r.bank.paints) call.push(h('span', { class: 'callout', 'data-callout': 'paint', 'data-paint': p.id }, h('i', { class: 'sw', style: { background: p.body } }), `New paint: ${p.name}`));
    if (r.bank.decals.length) call.push(h('span', { class: 'callout', 'data-callout': 'decal', 'data-decals': r.bank.decals.map((d) => d.id).join(' ') }, `New decal${r.bank.decals.length > 1 ? 's' : ''}: ${r.bank.decals.map((d) => d.name).join(', ')}`));
    el.callouts.replaceChildren(...call);
    el.next.hidden = !r.next;
    stamp(r.rating);
  }
  return { show, hide() { clearTimeout(stampTimer); cancelAnimationFrame(countRaf); } };
}
