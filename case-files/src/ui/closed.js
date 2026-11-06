// The "Case closed" screen: the brass CASE CLOSED stamp, the Chief's closing line (voiced), the arc's knowledge card (one fact
// learned), tomorrow's teaser, the flat Lab payout, and "See you tomorrow, Detective." Nothing here starts the next case (SPEC §1).
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon, COIN } from '../../../spell-jump/src/ui/icons.js';
import { LINES } from '../logic/lines.js';

export function createClosed(app) {
  const body = $('#closed-body');
  function show({ kase, receipt } = {}) {
    if (!kase) return;
    $('#closed-title').textContent = kase.title;
    const stamp = h('div', { class: 'big-stamp' + (app.settings.reducedMotion ? '' : ' slam'), id: 'big-stamp', role: 'img', 'aria-label': 'Case closed' }, 'Case closed');
    const say1 = h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear it again', html: icon('sound') });
    const closing = kase.closing || { who: 'chief', text: 'Case closed.' };
    say1.addEventListener('click', () => app.speak(closing.text));
    const chief = h('div', { class: `bubble ${closing.who === 'partner' ? 'partner' : 'chief'}`, id: 'closing-line', style: { width: 'min(100%, 680px)' } },
      h('span', { class: 'who' }, closing.who === 'partner' ? 'PT' : 'CH'), h('p', {}, h('span', { class: 'who-name' }, closing.who === 'partner' ? 'Your partner' : 'The Chief'), closing.text), say1);
    const fact = h('div', { class: 'fact-card', id: 'knowledge-card', style: { width: 'min(100%, 680px)' } }, h('span', { class: 'label-type', style: { color: '#8a5a2a' } }, 'Knowledge card · one fact you learned'), h('p', {}, kase.knowledge));
    const kids = [stamp, chief, fact];
    if (kase.teaser) kids.push(h('p', { class: 'teaser', id: 'teaser', style: { width: 'min(100%, 680px)' } }, kase.teaser));
    const coins = receipt && receipt.ok ? receipt.coins : 0;
    const pay = h('div', { class: 'payout', id: 'payout', 'data-coins': String(coins) });
    if (coins > 0) pay.append(h('span', { html: COIN }), `+${coins} Lab coins for closing the case`);
    kids.push(pay);
    kids.push(h('div', { class: 'lab-slot lab-slot-strip', id: 'lab-slot-closed' }));
    kids.push(h('p', { class: 'see-you', id: 'see-you' }, 'Case closed. See you tomorrow, Detective.'));
    const back = h('button', { class: 'btn btn-teal btn-big', id: 'closed-home', type: 'button', 'data-sfx': '' }, 'Back to the agency');
    back.addEventListener('click', () => app.go('home'));
    kids.push(back);
    body.replaceChildren(...kids.map((k) => k));
    body.scrollTop = 0;
    if (!app.settings.reducedMotion) app.audio.fanfare(); else app.audio.cash();
    setTimeout(() => app.speak([closing.text, LINES.seeYou]), 700);
  }
  return { show, hide() { app.speech.cancel(); } };
}
