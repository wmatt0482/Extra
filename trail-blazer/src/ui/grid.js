// Fact Grid (SPEC §2.7, v1.2 §7): the kid-facing progress screen (Fuchs & Fuchs: progress the learner can see).
// × view: the 12 × 12 multiplication table; ÷ view: rows are the divisor, columns the quotient (the cell is n·q ÷ n).
// Each cell is colored by status (New / Learning / Almost / Mastered / Fluent); practiced cells show their answer, new
// ones stay blank; cells outside this week's set are faded. Tap a cell to see the fact with its answer and hear it.
import { $, $$, h } from '../../../spell-jump/src/ui/dom.js';
import { factAnswer, factKey, factText, fullSentence } from '../facts/facts.js';
import { STATUSES, status } from '../facts/scheduler.js';
import { activeFacts } from '../facts/store.js';

const STATUS_TEXT = { New: 'New: not asked yet', Learning: 'Learning: keep practicing', Almost: 'Almost: a few more right days', Mastered: 'Mastered!', Fluent: 'Fluent: mastered and quick!' };

export function createGrid(app) {
  const grid = $('#fgrid');
  const info = { fact: $('#gi-fact'), status: $('#gi-status') };
  let view = 'x', selected = null;

  for (const b of $$('.grid-seg [data-view]')) {
    b.addEventListener('click', () => {
      view = b.dataset.view;
      for (const x of $$('.grid-seg [data-view]')) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); }
      selected = null;
      resetInfo();
      render();
    });
  }
  $('#grid-legend').replaceChildren(...STATUSES.map((st) => h('span', { class: `lg st-${st}` }, h('i'), st)));

  function resetInfo() {
    info.fact.textContent = 'Tap a fact';
    delete info.fact.dataset.fact;
    info.status.textContent = 'to hear it and see how far it has come';
    delete info.status.dataset.status;
  }
  const factFor = (r, c) => (view === 'x' ? factKey(r, 'x', c) : `${r * c}/${r}`);
  function pickCell(fact, cell) {
    selected = fact;
    for (const x of grid.querySelectorAll('.fg-cell.sel')) x.classList.remove('sel');
    if (cell) cell.classList.add('sel');
    const d = app.facts;
    const st = d ? status(d.records[fact]) : 'New';
    info.fact.textContent = `${factText(fact)} = ${factAnswer(fact)}`;
    info.fact.dataset.fact = fact;
    info.status.textContent = STATUS_TEXT[st];
    info.status.dataset.status = st;
    app.say(fullSentence(fact));
  }

  function render() {
    const d = app.facts;
    if (!d) return;
    const active = new Set(activeFacts(d));
    const kids = [h('span', { class: 'fg-h corner' }, view === 'x' ? '×' : '÷')];
    for (let c = 1; c <= 12; c++) kids.push(h('span', { class: 'fg-h col' }, String(c)));
    const counts = Object.fromEntries(STATUSES.map((x) => [x, 0]));
    for (let r = 1; r <= 12; r++) {
      kids.push(h('span', { class: 'fg-h row' }, view === 'x' ? String(r) : `÷${r}`));
      for (let c = 1; c <= 12; c++) {
        const fact = factFor(r, c);
        const st = status(d.records[fact]);
        const on = active.has(fact);
        if (on && (view === 'd' || r <= c)) counts[st] += 1;
        const label = st === 'New' ? '' : String(view === 'x' ? factAnswer(fact) : r * c);
        const b = h('button', { class: `fg-cell st-${st}${on ? '' : ' off'}${fact === selected ? ' sel' : ''}`, 'data-fact': fact, 'data-status': st,
          'aria-label': `${factText(fact)}, ${st}` }, label);
        b.addEventListener('pointerdown', () => app.unlockVoice());
        b.addEventListener('click', () => pickCell(fact, b));
        kids.push(b);
      }
    }
    grid.replaceChildren(...kids);
    $('#grid-count').textContent = `This week (${view === 'x' ? '×' : '÷'}): ${STATUSES.map((x) => `${counts[x]} ${x.toLowerCase()}`).join(' · ')}`;
  }
  return { show() { selected = null; resetInfo(); render(); }, hide() {}, render, get view() { return view; } };
}
