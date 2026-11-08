// The "Case closed" screen: the brass CASE CLOSED stamp slams down with a thump (the screen jolts once, a ring of dust, a short burst of
// confetti, a jingle through the shared audio module, which the sound setting silences), the reward in plain sight ("+40 Lab coins ·
// +55 XP", read from the Lab's receipt, never hard-coded), the Chief's closing line (voiced), the arc's knowledge card (one fact
// learned), tomorrow's teaser, and "See you tomorrow, Detective." Nothing here starts the next case (SPEC §1). Calm motion (the Parent
// Zone switch or the OS setting): no confetti, no jolt, the stamp just fades in.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon, COIN } from '../../../spell-jump/src/ui/icons.js';
import { LINES } from '../logic/lines.js';
import { portrait } from './art.js';

const CONFETTI_COLORS = ['#f2c64f', '#2fd1c0', '#e0463f', '#fbf3dc', '#52c2f0', '#ffdf8a', '#ff8a6b'];
const calm = (app) => !!app.settings.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** "+40 Lab coins · +55 XP" from the Lab's receipt ({ ok, coins, xp }); '' when nothing was paid. */
export function payoutText(payout) {
  const coins = payout && payout.ok ? Math.max(0, payout.coins | 0) : 0, xp = payout && payout.ok ? Math.max(0, payout.xp | 0) : 0;
  if (!coins && !xp) return '';
  return [coins ? `+${coins} Lab coins` : '', xp ? `+${xp} XP` : ''].filter(Boolean).join(' · ');
}

/** The reward ribbon: coin, "+40 Lab coins · +55 XP". Idempotent: call again if the receipt arrives later. */
export function fillPayout(pay, payout) {
  const coins = payout && payout.ok ? payout.coins | 0 : 0;
  pay.dataset.coins = String(coins);
  pay.dataset.xp = String(payout && payout.ok ? payout.xp | 0 : 0);
  const text = payoutText(payout);
  pay.replaceChildren();
  if (!text) { pay.hidden = true; return; }
  pay.hidden = false;
  pay.append(h('span', { class: 'pay-coin', html: COIN, 'aria-hidden': 'true' }), h('span', { class: 'pay-text' }, text));
  pay.setAttribute('aria-label', `${text}. Reward for closing the case.`);
}

/**
 * The celebration on an element (the closed screen): the stamp slams, the screen thumps, confetti falls, the jingle plays.
 * el: the screen's body (it holds the .big-stamp); payout: the Lab receipt; app: { audio, settings }.
 */
export function celebrate(el, payout, app) {
  const screen = el.closest('.screen') || el;
  const stamp = el.querySelector('.big-stamp');
  const pay = el.querySelector('#payout');
  if (pay) fillPayout(pay, payout);
  const still = calm(app);
  el.classList.toggle('celebrating', !still);
  el.classList.toggle('calm', still);
  if (stamp) { stamp.classList.remove('slam', 'fade'); void stamp.offsetWidth; stamp.classList.add(still ? 'fade' : 'slam'); }
  for (const old of screen.querySelectorAll('.confetti')) old.remove();
  if (!still) {
    const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
    const n = 44;
    for (let i = 0; i < n; i++) {
      const r = (a) => Math.random() * a;
      box.append(h('i', { style: { '--x': `${(r(100)).toFixed(1)}%`, '--dx': `${((r(2) - 1) * 90).toFixed(0)}px`, '--rot': `${(360 + r(540)).toFixed(0)}deg`, '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        '--d': `${(1.7 + r(1.3)).toFixed(2)}s`, '--dl': `${(0.34 + r(0.55)).toFixed(2)}s`, '--w': `${(7 + r(7)).toFixed(0)}px`, '--h': `${(10 + r(10)).toFixed(0)}px` }, class: i % 3 === 0 ? 'dot' : '' }));
    }
    screen.append(box);
    setTimeout(() => box.remove(), 3800);                           // the burst is short
    setTimeout(() => { el.classList.remove('celebrating'); }, 1400);
  }
  // the jingle lands with the stamp (the shared audio module; it stays quiet when sound is off)
  const au = app.audio;
  if (au) setTimeout(() => { try { if (still) au.cash(); else (au.missionComplete || au.fanfare).call(au); } catch (_) { /* ignore */ } }, still ? 200 : 300);
}

export function createClosed(app) {
  const body = $('#closed-body');
  function show({ kase, receipt } = {}) {
    if (!kase) return;
    $('#closed-title').textContent = kase.title;
    const closing = kase.closing || { who: 'chief', text: 'Case closed.' };
    const stamp = h('div', { class: 'big-stamp', id: 'big-stamp', role: 'img', 'aria-label': 'Case closed' }, 'Case closed');
    const hero = h('div', { class: 'closed-hero' },
      h('span', { class: 'face f-pip', 'aria-hidden': 'true', html: portrait('partner', 'cheer') }),
      h('div', { class: 'stamp-wrap' }, stamp, h('i', { class: 'shock', 'aria-hidden': 'true' })),
      h('span', { class: 'face f-chief', 'aria-hidden': 'true', html: portrait('chief', 'happy') }));
    const say1 = h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Hear it again', html: icon('sound') });
    say1.addEventListener('click', () => app.speak(closing.text));
    const who = closing.who === 'partner' ? 'partner' : 'chief';
    const chief = h('div', { class: `bubble ${who}`, id: 'closing-line' },
      h('span', { class: 'who', 'data-art': who, 'aria-hidden': 'true', html: portrait(who, 'happy') }),
      h('p', {}, h('span', { class: 'who-name' }, who === 'partner' ? 'Pip' : 'The Chief'), closing.text), say1);
    const fact = h('div', { class: 'fact-card', id: 'knowledge-card' }, h('span', { class: 'label-type', style: { color: '#8a5a2a' } }, 'Knowledge card · one fact you learned'), h('p', {}, kase.knowledge));
    const pay = h('div', { class: 'payout', id: 'payout', role: 'status' });
    const kids = [hero, pay, chief, fact];
    if (kase.teaser) kids.push(h('p', { class: 'teaser', id: 'teaser' }, kase.teaser));
    kids.push(h('div', { class: 'lab-slot lab-slot-strip', id: 'lab-slot-closed' }));
    kids.push(h('p', { class: 'see-you', id: 'see-you' }, 'Case closed. See you tomorrow, Detective.'));
    const back = h('button', { class: 'btn btn-teal btn-big', id: 'closed-home', type: 'button', 'data-sfx': '' }, 'Back to the agency');
    back.addEventListener('click', () => app.go('home'));
    kids.push(back);
    body.replaceChildren(...kids);
    body.scrollTop = 0;
    celebrate(body, receipt, app);
    setTimeout(() => app.speak([closing.text, LINES.seeYou]), 700);
  }
  return { show, hide() { app.speech.cancel(); for (const c of document.querySelectorAll('#screen-closed .confetti')) c.remove(); } };
}
