// v3.3 mystery crate opening: a full-screen overlay (#crate-fx). The crate shakes for a moment (Audio.crateOpen),
// bursts, and a reveal card shows what was inside: cash, a jackpot, a new sticker or a new skin (painted on the
// player's selected car). v3.6: a new skin / sticker goes straight onto the selected car when that slot is still
// stock, and the card says so ("Now on Rusty"), else where to put it on (Garage → Paint / Stickers). Tap anywhere to
// dismiss once the card is up. Used by the title's "n crates" button and
// the crate that drops on the results screen. The roll itself lives in src/meta/engagement.js (openCrate).
import { CAR_BY_ID } from '../data/cars.js';
import { SKIN_BY_ID, STICKER_BY_ID } from '../data/cosmetics.js';
import { equip, equippedFor, lookFor, openCrate } from '../meta/engagement.js';
import { drawCar } from './carPreview.js';
import { $, h, money } from './dom.js';
import { COIN, icon } from './icons.js';

export const CRATE_SVG = `<svg viewBox="0 0 64 56" aria-hidden="true"><path d="M6 20h52v30a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#b5651d"/><path d="M6 20h52v6H6z" fill="#8a4a12"/>
<path d="M3 12h58v10H3z" fill="#d9822b" stroke="#8a4a12" stroke-width="2"/><path d="M27 12h10v42H27z" fill="#ffcf1a"/><path d="M27 12h10v10H27z" fill="#ffe066"/>
<path d="M32 12c-4-9-14-9-12-2 1 3 7 2 12 2zM32 12c4-9 14-9 12-2-1 3-7 2-12 2z" fill="#ffcf1a" stroke="#b98200" stroke-width="2"/>
<path d="M10 30h14M10 38h14M40 30h14M40 38h14" stroke="#8a4a12" stroke-width="2.4" stroke-linecap="round" opacity=".55"/></svg>`;

export function createCrateOpener(app) {
  const root = $('#crate-fx'), box = $('#crate-box'), card = $('#crate-card');
  const kindEl = $('#crate-kind'), nameEl = $('#crate-name'), art = $('#crate-art'), hintEl = $('#crate-hint');
  box.innerHTML = CRATE_SVG;
  let busy = false, ready = false, onDone = null, timer = 0, last = null;

  function close() {
    if (!busy || !ready) return;
    busy = false; ready = false;
    root.hidden = true;
    clearTimeout(timer);
    const cb = onDone; onDone = null;
    if (cb) cb();
  }
  root.addEventListener('click', close);

  function reveal(out) {
    const car = CAR_BY_ID[app.save.selectedCar] || CAR_BY_ID.beater;
    card.className = 'card reveal-card r-' + out.kind;
    art.replaceChildren();
    if (out.kind === 'skin' || out.kind === 'sticker') {
      const cv = h('canvas', { class: 'reveal-car', 'aria-hidden': 'true' });
      art.append(cv);
      // put it on the selected car right away when that slot is still stock (the kids never found the Style row)
      const slot = equippedFor(app.save, car.id)[out.kind];
      let wornNow = false;
      if (slot === (out.kind === 'skin' ? 'stock' : 'none') && app.save.owned.includes(car.id)) {
        wornNow = equip(app.save, car.id, out.kind, out.id);
        if (wornNow) { app.persist(); try { app.onLookChanged && app.onLookChanged(); } catch (_) { /* no hero yet */ } }
      }
      const look = lookFor(app.save, car.id);
      if (out.kind === 'skin') look.skin = SKIN_BY_ID[out.id]; else look.sticker = STICKER_BY_ID[out.id];
      requestAnimationFrame(() => drawCar(cv, car, { skin: look.skin, sticker: look.sticker, floor: true }));
      if (out.kind === 'sticker') art.append(h('span', { class: 'reveal-glyph', style: { color: STICKER_BY_ID[out.id].color } }, STICKER_BY_ID[out.id].glyph));
      kindEl.textContent = out.kind === 'skin' ? 'New paint!' : 'New sticker!';
      nameEl.textContent = out.name;
      if (hintEl) { hintEl.textContent = wornNow ? `Now on ${car.name}` : `Put it on in the Garage → ${out.kind === 'skin' ? 'Paint' : 'Stickers'}`; hintEl.hidden = false; }
    } else {
      art.append(h('span', { class: 'reveal-coin', html: COIN }));
      kindEl.textContent = out.kind === 'jackpot' ? 'Jackpot!' : 'Cash!';
      nameEl.textContent = '+$' + money(out.cash);
      if (hintEl) hintEl.hidden = true;
    }
    card.dataset.kind = out.kind;
    card.hidden = false;
    box.classList.add('burst');
    if (out.kind === 'jackpot' || out.kind === 'skin') app.audio.fanfare(); else app.audio.cash();
    // the card can be dismissed a beat after it lands (an excited double tap does not skip it)
    timer = setTimeout(() => { ready = true; root.classList.add('ready'); }, 450);
  }

  return {
    get busy() { return busy; },
    get last() { return last; },
    /** Open one waiting crate. Resolves (via onDone) after the child taps the reveal card away. */
    open(done) {
      if (busy) return null;
      const car = CAR_BY_ID[app.save.selectedCar] || CAR_BY_ID.beater;
      const out = openCrate(app.save, { tier: car.tier });
      if (!out) return null;
      last = out;
      app.persist();
      app.refreshCash();
      busy = true; ready = false; onDone = done || null;
      root.classList.remove('ready');
      box.classList.remove('burst', 'shake');
      card.hidden = true;
      root.hidden = false;
      root.dataset.result = out.kind;
      void box.offsetWidth;
      box.classList.add('shake');
      app.audio.crateOpen();
      timer = setTimeout(() => reveal(out), app.save.settings.reducedMotion ? 150 : 720);
      return out;
    },
    close,
    icon: () => icon('crate'),
  };
}
