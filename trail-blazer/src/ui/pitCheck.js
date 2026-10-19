// The Pit Crew Check (SPEC v1.3 §1), kid-framed (never "test" or "grade"): the offer card on the results screen after
// a finished race while the player has no placement (Start / Later; offered after up to 3 races, then only from
// Parents → Facts → "Run the check again"), the check itself (the gate panel in 'check' mode over an empty screen:
// the fact, the numpad, the voice, a thin progress bar, no clock, "Later" to stop), and the Start line screen:
// "Fluent: ×2 ×5 ×10 · Working on: ×3 ×4 · Up next: ×6 ×9", a pit note from the error patterns, +100 XP.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { famLabel } from '../facts/facts.js';
import { applyCheck, checkAnswer, checkNext, checkProgress, createCheck, startLine, tiersFor } from '../facts/placement.js';
import { patternSummary } from '../facts/patterns.js';
import { levelFor, refreshFrontier } from '../facts/store.js';

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
  const offerEl = $('#pit-offer');
  const el = { fluent: $('#sl-fluent'), working: $('#sl-working'), next: $('#sl-next'), note: $('#sl-note'), xp: $('#sl-xp'), sub: $('#sl-sub'), moment: $('#sl-moment') };
  let running = false, momentTimer = 0, lastOut = null;

  function showOffer() { if (app.screen !== 'results') return; offerEl.hidden = false; app.audio.missionComplete && app.audio.missionComplete(); }
  function hideOffer() { offerEl.hidden = true; }
  $('#pit-start').addEventListener('click', () => { hideOffer(); run(); });
  $('#pit-later').addEventListener('click', () => { hideOffer(); app.toast('OK! Your crew will ask after the next race'); });
  $('#sl-done').addEventListener('click', () => app.go('title'));
  $('#sl-race').addEventListener('click', () => app.startRide(app.save.selectedTrail));

  async function run() {
    const d = app.facts;
    if (!d || running) return;
    running = true;
    app.unlockVoice();
    app.go('check');
    const st = createCheck({ tiers: tiersFor(d.sets) }, Math.random);
    let it;
    while ((it = checkNext(st))) {
      const res = await gatePanel.open({ fact: it.fact, flip: it.flip, index: st.items.length, mode: 'check', progress: checkProgress(st) });
      if (!res || res.cancelled) {                  // "Later" (or left): nothing is kept, it is offered again
        running = false;
        if (app.screen === 'check') app.go('title');
        return;
      }
      checkAnswer(st, res);
    }
    const now = Date.now();
    const levelBefore = levelFor(d.xp);
    const placement = applyCheck(d, st, now);
    refreshFrontier(d, now);
    app.persistFacts();
    running = false;
    lastOut = { placement, items: st.items.length, right: st.items.filter((x) => x.correct).length, levelBefore, levelAfter: levelFor(d.xp) };
    app.onCheckDone && app.onCheckDone(lastOut);
    app.go('startline', lastOut);
  }

  const chips = (box, fams) => { box.replaceChildren(...fams.map((f) => h('span', { class: 'sl-chip', 'data-family': f }, famLabel(f)))); box.parentElement.hidden = !fams.length; };
  const startlineScreen = {
    show(out) {
      const d = app.facts;
      if (!d) return;
      const line = startLine(d);
      chips(el.fluent, line.fluent);
      chips(el.working, line.working);
      chips(el.next, line.next);
      el.sub.textContent = out && out.items ? `${out.items} facts in the pit. Your crew knows what you've got!` : "Your crew knows what you've got!";
      el.note.textContent = kidNote(patternSummary(d, Date.now()));
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

  return { run, showOffer, hideOffer, get running() { return running; }, get last() { return lastOut; }, startlineScreen, checkScreen };
}
