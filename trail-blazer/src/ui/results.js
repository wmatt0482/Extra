// Results → podium (SPEC v1.1 §5): the top three on a podium (each Ranger in its paint, with the rider's name; the
// player's step ringed), the race time with the medal it earned (Gold / Silver / Bronze from the track's target times)
// and the best time, stat tiles, a cash breakdown whose rows always add up to the total that was banked (distance, air,
// flips, perfect landings, coins, position bonus, finish bonus; whatever the total holds beyond the parts shows as a
// Bonus row), and callouts for what the race unlocked (the next track on 3rd or better, a medal, a paint, a decal).
// Title: "1st place!" / "Podium!" / "Race over". Buttons: Garage / Race again / Next track.
// v1.2 (math layer): the race's facts (✓ right first try, ⚡ quick, ↻ fixed), "N facts mastered!", the daily mission
// (its $400 shows as an extra row under the total: paid when it happened, not part of the race's cash), the XP and a
// level-up stamp. (v1.4: the Pit Crew Check comes before a race now, not on the results.)
// v1.5 (The Season): the trail's 3 stars (new ones pop in with a chime each), the combo / ghost / rival / streak /
// Pit Challenge lines, the crate button (its own moment: src/ui/crate.js), the cup multiplier on the total row
// ("Pro Cup ×2"), the weekend standings between races ("You 16 · Blaze 13 · …") with "Next race", and after a
// weekend's last race the cup podium with the trophy.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { MEDAL_LABEL, fmtTime, ordinal } from '../data/medals.js';
import { factAnswer, factText } from '../facts/facts.js';
import { icon } from './tbIcons.js';
import { drawPreview } from './vehiclePreview.js';
import { CRATE_TIERS } from '../data/cosmetics.js';
import { PAINT_BY_ID } from '../data/paints.js';

const LABEL = { distance: 'Distance', air: 'Air time', flips: 'Flips', perfect: 'Perfect landings', smash: 'Smashes', coins: 'Trail coins',
  place: 'Position bonus', finish: 'Finish bonus', gates: 'Gates', quick: 'Quick answers', combo: 'Combos', turbo: 'Turbo', bonus: 'Bonus' };
const COUNT_MS = 1100;
const fmt1 = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);

export function createResults(app, crates) {
  const el = {
    stars: $('#res-stars'), lines: $('#res-lines'), weekend: $('#res-weekend'), crate: $('#res-crate'), final: $('#cup-final'), nextText: $('#res-next-text'),
    title: $('#res-title'), podium: $('#res-podium'), time: $('#res-time'), medal: $('#res-medal'), record: $('#res-record'), sub: $('#res-sub'),
    facts: $('#res-facts'), moment: $('#res-moment'), pay: $('#res-pay'), callouts: $('#res-callouts'), again: $('#res-again'), garage: $('#res-garage'), next: $('#res-next'),
  };
  let last = null, countRaf = 0, medalTimer = 0, momentTimers = [], starTimers = [];
  const clearMoment = () => { momentTimers.forEach(clearTimeout); momentTimers = []; el.moment.hidden = true; el.moment.replaceChildren(); };
  function levelUp(level) {
    el.moment.replaceChildren(h('div', { class: 'lvl-stamp', id: 'res-levelup', role: 'img', 'aria-label': `Level ${level}` }, h('div', {}, h('small', {}, 'Level'), h('b', {}, String(level)))));
    el.moment.hidden = false;
    app.audio.levelUp();
    momentTimers.push(setTimeout(clearMoment, app.settings.reducedMotion ? 1200 : 2200));
  }

  el.again.addEventListener('click', () => last && app.startRide(last.trail.id));
  el.garage.addEventListener('click', () => app.go('garage'));
  el.next.addEventListener('click', () => {
    if (!last) return;
    if (last.weekendNext) { app.startRide(last.weekendNext, { weekend: true }); return; }
    if (last.next) { app.save.selectedTrail = last.next.id; app.persist(); app.startRide(last.next.id); }
  });
  el.crate.addEventListener('click', () => crates.open(() => crateBtn()));
  /** the crate button: the oldest waiting crate's tier, pulsing; hidden when none wait */
  function crateBtn() {
    const q = app.save.crates.queue;
    el.crate.hidden = !q.length;
    if (!q.length) return;
    el.crate.dataset.tier = q[0];
    el.crate.className = `crate-btn t-${q[0]}`;
    el.crate.replaceChildren(h('i', { class: 'crate-box mini t-' + q[0], 'aria-hidden': 'true' }, h('i', { class: 'cb-lid' }), h('i', { class: 'cb-band' })),
      h('span', {}, h('b', {}, `${CRATE_TIERS[q[0]].name}!`), h('small', {}, q.length > 1 ? `${q.length} waiting · tap to open` : 'Tap to open')));
  }
  function starsRow(st) {
    starTimers.forEach(clearTimeout); starTimers = [];
    if (!st) { el.stars.hidden = true; return; }
    el.stars.hidden = false;
    const fresh = new Set(st.fresh);
    const cells = [0, 1, 2].map((i) => h('span', { class: `rs-star${st.stars[i] && !fresh.has(i) ? ' on' : ''}`, 'data-star': String(i), 'data-on': String(!!st.stars[i]) },
      h('i', { html: icon('star') }), h('small', {}, st.labels[i])));
    el.stars.replaceChildren(...cells);
    st.fresh.forEach((i, k) => starTimers.push(setTimeout(() => { cells[i].classList.add('on', 'pop'); app.sfx.chime(k); }, (app.settings.reducedMotion ? 300 : 900) + k * 420)));
  }
  function line(kind, text) { return h('span', { class: `res-line l-${kind}`, 'data-line': kind }, text); }
  function linesRow(r) {
    const out = [];
    const ss = r.season || {};
    const s = r.summary;
    const combo = Number(s.maxCombo || s.comboMax || 0);
    if (combo >= 2) out.push(line('combo', `Combo ×${combo}!`));
    else if ((s.cash && s.cash.combo) > 0) out.push(line('combo', 'Combo bonus!'));
    if (ss.ghost && ss.ghost.beat && ss.ghost.by > 0) out.push(line('ghost', `Beat your ghost by ${ss.ghost.by.toFixed(1)} s!`));
    else if (ss.ghost && ss.ghost.beat === false && ss.ghost.by > 0) out.push(line('ghost', `Your ghost was ${ss.ghost.by.toFixed(1)} s ahead`));
    if (ss.turbo) out.push(line('turbo', 'TURBO gate!'));
    const rv = ss.rival;
    if (rv && rv.retired) out.push(line('rival', `${rv.retired.name} retires to the Hall of Rivals! Next up: ${rv.next ? rv.next.name : 'legends'}`));
    else if (rv && rv.beat) out.push(line('rival', `You beat ${rv.leader.name}! (${rv.beats} / 3)`));
    else if (rv && rv.leader && s.finishCrossed) out.push(line('rival', `${rv.leader.name}: “${rv.leader.cheer}”`));
    if (ss.streak && ss.streak.counted) out.push(line('streak', `Streak: ${ss.streak.count} day${ss.streak.count === 1 ? '' : 's'}!`));
    for (const w of (ss.streak && ss.streak.rewards) || []) {
      if (w.crate) out.push(line('streak', `Streak reward: ${CRATE_TIERS[w.crate].name}`));
      else out.push(line('streak', `Streak reward: ${w.kind === 'paint' ? `${(PAINT_BY_ID[w.id] || {}).name || w.id} paint` : 'Lightning helmet'}`));
    }
    if (ss.dailyDone) out.push(line('daily', 'Pit Challenge done! Bronze crate'));
    for (const c of ss.crates || []) out.push(line('crate', `${CRATE_TIERS[c.tier].name}: ${c.why}`));
    el.lines.replaceChildren(...out);
  }
  function weekendRow(r) {
    const w = r.season && r.season.weekend;
    if (!w) { el.weekend.hidden = true; return; }
    el.weekend.hidden = false;
    el.weekend.replaceChildren(h('b', {}, `${w.cupName} · race ${w.race} of ${w.of}`),
      h('span', { class: 'wk-table', 'data-table': w.table.map((x) => `${x.name}:${x.points}`).join(',') },
        ...w.table.map((x) => h('span', { class: 'wk-row' + (x.me ? ' me' : '') }, `${x.me ? 'You' : x.name} ${x.points}`))));
  }
  function cupFinal(f) {
    const top = [2, 1, 3].map((p) => f.table[p - 1] ? { ...f.table[p - 1], place: p } : null).filter(Boolean);
    const cols = top.map((x) => {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      requestAnimationFrame(() => drawPreview(cv, x.look || { paint: x.paint }, { floor: false }));
      return h('div', { class: `pod p${x.place}${x.me ? ' me' : ''}`, 'data-place': String(x.place), 'data-name': x.name },
        x.place === 1 ? h('span', { class: `cf-trophy m-gold`, html: icon('trophy') }) : null,
        cv, h('span', { class: 'pod-name' }, x.me ? `${x.name} (you)` : x.name), h('span', { class: 'pod-step' }, `${x.points}`));
    });
    const title = f.place === 1 ? `${f.cupName} champion!` : f.trophy ? `${ordinal(f.place)} in the ${f.cupName}!` : `${ordinal(f.place)} in the ${f.cupName}`;
    const done = h('button', { class: 'btn btn-orange', id: 'cup-final-ok', 'data-sfx': '' }, f.trophy ? 'Hooray!' : 'OK');
    done.addEventListener('click', () => { el.final.hidden = true; el.final.replaceChildren(); });
    el.final.replaceChildren(h('div', { class: 'card cf-card', 'data-trophy': f.trophy || 'none' },
      h('h3', {}, title),
      f.trophy ? h('span', { class: `medal-badge m-${f.trophy}` }, `${f.trophy} trophy`) : h('p', { class: 'cf-sub' }, 'Race the cup again any time.'),
      h('div', { class: 'podium cf-podium' }, ...cols),
      h('p', { class: 'cf-sub' }, f.table.map((x) => `${x.me ? 'You' : x.name} ${x.points}`).join(' · ')),
      f.bonus ? h('p', { class: 'cf-bonus' }, `Cup bonus +$${money(f.bonus)}${f.trophy ? ' · Gold crate!' : ''}`) : null,
      done));
    el.final.hidden = false;
    if (f.trophy) { app.audio.trophy(); setTimeout(() => app.audio.fireworks(), 300); }
    crateBtn();
  }

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
      requestAnimationFrame(() => drawPreview(cv, x.look || { paint: x.paint }, { floor: false }));
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
    const ss = r.season || {};
    const mults = [ss.cup && ss.cup.mult > 1 ? `${ss.cup.name} ×${ss.cup.mult}` : '', ss.daily ? 'Pit Challenge ×2' : ''].filter(Boolean);
    el.pay.replaceChildren(h('tbody', {}, ...rows, h('tr', { class: 'total' }, h('td', {}, 'Total', mults.length ? h('span', { class: 'hint mult', 'data-mult': mults.join(' ') }, ` · ${mults.join(' · ')}`) : null), totalTd), ...extra));
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
    if (s.finishCrossed && place > 3 && !r.next) call.push(h('span', { class: 'callout orange', 'data-callout': 'need-podium' }, 'Finish 3rd or better to open the next trail'));
    el.callouts.replaceChildren(...call);
    el.next.hidden = !r.next && !r.weekendNext;
    el.nextText.textContent = r.weekendNext ? 'Next race' : 'Next trail';
    starsRow(ss.stars);
    linesRow(r);
    weekendRow(r);
    crateBtn();
    el.final.hidden = true;
    clearMoment();
    if (ss.weekendFinal) momentTimers.push(setTimeout(() => cupFinal(ss.weekendFinal), app.settings.reducedMotion ? 300 : 1800));
    const leveled = math && math.levelAfter > math.levelBefore;
    if (leveled) momentTimers.push(setTimeout(() => levelUp(math.levelAfter), app.settings.reducedMotion ? 200 : 1300));
  }
  return { show, hide() { clearTimeout(medalTimer); cancelAnimationFrame(countRaf); clearMoment(); starTimers.forEach(clearTimeout); el.final.hidden = true; } };
}
