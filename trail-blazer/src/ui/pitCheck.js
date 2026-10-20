// The Pit Crew Check (SPEC v1.3 §1, v1.4 §1-§2, §5-§6), kid-framed (never "test" or "grade"):
// - the card BEFORE a race: a player with no placement gets it when they tap a track to race ("Before your first
//   race, the pit crew checks what you've got. About 15 quick facts." · Start · Race first); "Race first" runs the race
//   and the card comes back before the next one, every time, until the check is done (no cap, never mid-race, never a
//   lock). A stale placement brings the same card as a re-check ("Pit Crew re-check: let's see how far you've come").
// - the check itself: the gate panel in 'check' mode (the fact, the numpad, the voice, a thin progress bar, no clock,
//   a "Race first" / "Later" way out that always works), the locate → zoom → twins staircase (placement.js);
// - the Start line: "Fluent: … · Working on: … · Up next: <the scout family>", a pit note from the error patterns,
//   "Your crew will keep checking as you race.", the governor's dial, +100 XP.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { famLabel } from '../facts/facts.js';
import { applyCheck, checkAnswer, checkNext, checkProgress, createCheck, startLine, tiersFor } from '../facts/placement.js';
import { patternSummary } from '../facts/patterns.js';
import { levelFor, noteCheckOffer, refreshFrontier } from '../facts/store.js';
import { recheckStart, scoutFamily } from '../facts/scouts.js';
import { dial, dialText } from '../facts/governor.js';

export const CARD_TEXT = {
  first: "Before your first race, the pit crew checks what you've got. About 15 quick facts.",
  recheck: "Pit Crew re-check: let's see how far you've come. About 15 quick facts.",
};

/** A pit note for the child from the strongest pattern (plain, encouraging). */
export function kidNote(patterns) {
  const p = patterns && patterns[0];
  if (!p) return 'Pit note: answer quick at the gates for a big boost!';
  if (p.kind === 'cluster') return `Pit note: ${p.families.map(famLabel).join(' and ')} ${p.families.length > 1 ? 'need' : 'needs'} some laps. You'll see ${p.families.length > 1 ? 'them' : 'it'} at the gates.`;
  if (p.kind === 'division') return 'Pit note: ÷ needs more laps than ×. Every ÷ fact is a × fact backwards!';
  if (p.kind === 'slow-big') return 'Pit note: the big ones (like 6 × 7) will get quicker with laps.';
  if (p.kind === 'reversed') return 'Pit note: watch the order of the digits, tens first.';
  if (p.kind === 'adjacent' || p.kind === 'off-by-operand') return 'Pit note: count the groups. One more or one less changes the answer.';
  if (p.kind === 'operation') return 'Pit note: look at the sign first: ×, ÷, + or −.';
  return 'Pit note: answer quick at the gates for a big boost!';
}

export function createPitCheck(app, gatePanel) {
  const card = $('#pit-offer');
  const el = { fluent: $('#sl-fluent'), working: $('#sl-working'), next: $('#sl-next'), note: $('#sl-note'), dial: $('#sl-dial'), xp: $('#sl-xp'), sub: $('#sl-sub'), moment: $('#sl-moment') };
  let running = false, momentTimer = 0, lastOut = null, pending = null, st = null;

  /** The card before a race: due = checkDue(d) ({ kind: 'first' | 'recheck' }). */
  function showCard(trailId, due = { kind: 'first' }) {
    pending = { trailId, kind: due.kind || 'first' };
    card.dataset.kind = pending.kind;
    $('#pit-offer-title').textContent = pending.kind === 'recheck' ? 'Pit Crew re-check' : 'Pit Crew Check';
    $('#pit-offer-text').textContent = CARD_TEXT[pending.kind] || CARD_TEXT.first;
    card.hidden = false;
    if (app.facts) { noteCheckOffer(app.facts); app.persistFacts(); }
  }
  function hideCard() { card.hidden = true; }
  $('#pit-start').addEventListener('click', () => { hideCard(); run(pending || {}); });
  // "Race first" always works: the race runs, the card comes back before the next one
  $('#pit-later').addEventListener('click', () => { hideCard(); const p = pending; pending = null; app.startRide(p && p.trailId, { skipCheck: true }); });
  $('#sl-done').addEventListener('click', () => app.go('title'));
  $('#sl-race').addEventListener('click', () => app.startRide((lastOut && lastOut.trailId) || app.save.selectedTrail, { skipCheck: true }));

  /** Run the check. opts: { trailId (race afterwards), kind ('first' | 'recheck') }. */
  async function run(opts = {}) {
    const d = app.facts;
    if (!d || running) return;
    running = true;
    hideCard();
    app.unlockVoice();
    app.go('check');
    const recheck = !!d.placement || opts.kind === 'recheck';
    st = createCheck({ tiers: tiersFor(d.sets), start: recheck ? recheckStart(d) : 'T3', division: d.sets.division !== false }, Math.random);
    let it;
    while ((it = checkNext(st))) {
      const res = await gatePanel.open({ fact: it.fact, flip: it.flip, index: st.items.length, mode: 'check', progress: checkProgress(st), exitText: opts.trailId ? 'Race first' : 'Later' });
      if (!res || res.cancelled) {                  // the way out always works: nothing is kept, the card comes back
        running = false; st = null;
        if (app.screen === 'check') { if (opts.trailId) app.startRide(opts.trailId, { skipCheck: true }); else app.go('title'); }
        return;
      }
      checkAnswer(st, res);
    }
    const now = Date.now();
    const levelBefore = levelFor(d.xp);
    const placement = applyCheck(d, st, now);
    refreshFrontier(d, now, recheck ? 'Pit Crew re-check' : 'Pit Crew Check');
    app.persistFacts();
    running = false;
    lastOut = { placement, items: st.items.length, levelBefore, levelAfter: levelFor(d.xp), trailId: opts.trailId || null, recheck };
    st = null;
    app.onCheckDone && app.onCheckDone(lastOut);
    app.go('startline', lastOut);
  }

  const chips = (box, fams) => { box.replaceChildren(...fams.map((f) => h('span', { class: 'sl-chip', 'data-family': f }, famLabel(f)))); box.parentElement.hidden = !fams.length; };
  const startlineScreen = {
    show(out) {
      const d = app.facts;
      if (!d) return;
      const line = startLine(d, { scout: scoutFamily(d, Date.now()) });
      chips(el.fluent, line.fluent);
      chips(el.working, line.working);
      chips(el.next, line.next);
      el.sub.textContent = `${out && out.items ? `${out.items} facts in the pit. ` : ''}Your crew will keep checking as you race.`;
      el.note.textContent = kidNote(patternSummary(d, Date.now()));
      el.dial.textContent = dialText(dial(d));
      el.xp.hidden = !out;
      clearTimeout(momentTimer);
      el.moment.hidden = true;
      if (out && out.levelAfter > out.levelBefore) {
        momentTimer = setTimeout(() => {
          el.moment.replaceChildren(h('div', { class: 'lvl-stamp', role: 'img', 'aria-label': `Level ${out.levelAfter}` }, h('div', {}, h('small', {}, 'Level'), h('b', {}, String(out.levelAfter)))));
          el.moment.hidden = false; app.audio.levelUp();
          momentTimer = setTimeout(() => { el.moment.hidden = true; }, app.settings.reducedMotion ? 1200 : 2000);
        }, 700);
      }
      app.audio.fanfare && setTimeout(() => app.audio.fanfare(), 200);
    },
    hide() { clearTimeout(momentTimer); el.moment.hidden = true; },
  };
  const checkScreen = { show() {}, hide() {} };

  return {
    run, showCard, hideCard, startlineScreen, checkScreen,
    get running() { return running; }, get last() { return lastOut; }, get cardOpen() { return !card.hidden; },
    /** the current check item (tests): { fact, family, tier, phase } */
    get item() { return st && st.current ? { ...st.current } : null; },
  };
}
