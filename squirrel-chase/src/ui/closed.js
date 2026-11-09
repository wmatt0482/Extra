// The "Case closed" screen: the stamp comes down, the sign is whole, the gang is a little embarrassed, the city's postcard is in the album, the Lab pays
// one flat amount (read from the Lab's receipt, never hard-coded) and the screen says "Case closed — see you tomorrow". Nothing here starts the next
// case (SPEC §1, §4). Calm motion (the Parent Zone switch or the OS setting): the stamp just fades in. Everything on this screen is silent text.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { labBridge } from '../meta/labBridge.js';
import { artCity, crewOf, gangArt, gangOf, hideoutOf, postcardOf, signOf, teaserOf } from '../logic/caseModel.js';
import { waitingState } from '../logic/pacing.js';
import { gangPortrait, pipPortrait, postcardSvg, signSvg } from '../art/index.js';
import { artBox } from './fx.js';

/** "+40 Lab coins · +55 XP" from the Lab's receipt ({ ok, coins, xp }); '' when nothing was paid. */
export function payoutText(payout) {
  const coins = payout && payout.ok ? Math.max(0, payout.coins | 0) : 0, xp = payout && payout.ok ? Math.max(0, payout.xp | 0) : 0;
  if (!coins && !xp) return '';
  return [coins ? `+${coins} Lab coins` : '', xp ? `+${xp} XP` : ''].filter(Boolean).join(' · ');
}
/** The reward ribbon: the Lab's coin and "+40 Lab coins · +55 XP". */
export function fillPayout(pay, payout) {
  const coins = payout && payout.ok ? payout.coins | 0 : 0;
  pay.dataset.coins = String(coins);
  pay.dataset.xp = String(payout && payout.ok ? payout.xp | 0 : 0);
  const text = payoutText(payout);
  pay.replaceChildren();
  if (!text) { pay.hidden = true; return; }
  pay.hidden = false;
  const coin = labBridge.coinIcon();
  pay.append(coin && coins ? h('span', { class: 'pay-coin', html: coin, 'aria-hidden': 'true' }) : null, h('span', { class: 'pay-text' }, text));
  pay.setAttribute('aria-label', `${text}. Reward for closing the case.`);
}

export function createClosed(app) {
  const body = $('#closed-body');
  function show({ kase, receipt } = {}) {
    if (!kase) return;
    $('#closed-title').textContent = kase.title;
    const gang = gangOf(kase), pc = postcardOf(kase);
    const calm = !!app.settings.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const stamp = h('div', { class: 'big-stamp ' + (calm ? 'fade' : 'slam'), id: 'big-stamp', role: 'img', 'aria-label': 'Case closed' }, 'Case closed');
    const hero = h('div', { class: 'closed-hero' }, artBox(gangPortrait(gangArt(gang), 'sorry'), 'face'), stamp, artBox(pipPortrait('cheer'), 'face'));
    const pay = h('div', { class: 'payout', id: 'payout', role: 'status' });
    fillPayout(pay, receipt);
    const hid = hideoutOf(kase), apology = hid.gangLines.length ? hid.gangLines[hid.gangLines.length - 1] : null;
    const sorry = h('p', { class: 'gang-line', id: 'gang-line' }, apology ? `${apology.who.name}: ${apology.text}` : `${gang.name} hands every letter back, a little embarrassed. The sign is whole again!`);
    const tease = teaserOf(kase);
    const card = h('article', { class: 'postcard paper closed-card', id: 'closed-postcard', 'data-city': pc.cityId },
      artBox(postcardSvg(artCity(pc.city)), 'pc-art', `Postcard of ${pc.city.name}`), h('h3', {}, `A postcard from ${pc.city.name}`), h('ul', {}, ...pc.facts.map((f) => h('li', {}, f))));
    const wait = waitingState(app.save);
    const seeYou = h('p', { class: 'see-you', id: 'see-you' }, wait === 'done' ? 'Case closed. Every case on the tour is closed!' : 'Case closed — see you tomorrow.');
    const album = h('button', { class: 'btn btn-paper', id: 'closed-album', type: 'button', 'data-sfx': '' }, 'Postcard album');
    album.addEventListener('click', () => app.go('album'));
    const back = h('button', { class: 'btn btn-sun btn-big', id: 'closed-home', type: 'button', 'data-sfx': '' }, 'Back to the board');
    back.addEventListener('click', () => app.go('home'));
    body.replaceChildren(hero, pay, artBox(signSvg(signOf(kase), []), 'sign-art sign-whole', 'The sign, whole again'), sorry, card,
      seeYou, tease && wait !== 'done' ? h('p', { class: 'teaser', id: 'teaser' }, tease) : null, h('div', { class: 'foot' }, album, back));
    body.scrollTop = 0;
    if (app.audio) setTimeout(() => { try { if (calm) app.audio.cash(); else (app.audio.missionComplete || app.audio.fanfare).call(app.audio); } catch (_) { /* ignore */ } }, 300);

  }
  return { show, hide() {} };
}
