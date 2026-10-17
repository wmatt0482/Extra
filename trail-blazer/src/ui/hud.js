// Ride HUD: distance (+ progress to the finish flag), ride cash (eased ticker, bumps on a payout), speed, the boost
// gauge (also the BOOST button's fill), and one banner at a time in the band under the top bar. Writes the DOM only
// when a shown value changes, so update() can run every frame.
import { $, money } from '../../../spell-jump/src/ui/dom.js';

const BANNER_MS = 1550;

export function createHud() {
  const el = {
    distance: $('#hud-distance'), finish: $('#hud-finish'), cash: $('#hud-cash'), cashBox: $('#hud-cash-box'), speed: $('#hud-speed'),
    boost: $('#hud-boost'), boostFill: $('#ctl-boost-fill'), boostBtn: $('#ctl-boost'), banner: $('#banner'), bannerText: $('#banner-text'),
  };
  let last = {}, length = 600, cashShown = 0, cashTarget = 0, lastT = 0, bannerQ = [], bannerTimer = 0, bannerOn = false;
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  function nextBanner() {
    clearTimeout(bannerTimer);
    const b = bannerQ.shift();
    if (!b) { el.banner.hidden = true; bannerOn = false; return; }
    bannerOn = true;
    el.banner.className = 'banner b-' + b.kind;
    el.banner.dataset.kind = b.kind;
    el.bannerText.textContent = b.text;
    el.banner.hidden = false;
    restart(el.banner, 'show');
    bannerTimer = setTimeout(nextBanner, BANNER_MS);
  }

  return {
    reset(trail) {
      length = Math.max(1, (trail && trail.length) || 600);
      last = {}; cashShown = 0; cashTarget = 0; lastT = performance.now();
      el.cash.textContent = '0';
      this.clearBanners();
      this.update({ distance: 0, speedKmh: 0, boost: 0.5, cash: 0 });
    },
    update(s) {
      if (!s) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      set('d', Math.floor(s.distance || 0), (v) => { el.distance.textContent = money(v); });
      set('f', Math.round(Math.min(1, (s.distance || 0) / length) * 1000) / 10, (v) => { el.finish.style.width = v + '%'; });
      set('v', Math.round(s.speedKmh || 0), (v) => { el.speed.textContent = String(v); });
      const b = Math.max(0, Math.min(1, s.boost == null ? 0 : s.boost));
      set('b', Math.round(b * 100), (v) => { el.boost.style.transform = `scaleX(${v / 100})`; el.boostFill.style.transform = `scaleY(${v / 100})`; el.boostBtn.classList.toggle('empty', v < 2); });
      const target = Math.round(s.cash || 0);
      if (target > cashTarget + 0.5) restart(el.cashBox, 'bump');
      cashTarget = target;
      cashShown = cashShown + (cashTarget - cashShown) * Math.min(1, dt * 8);
      if (Math.abs(cashTarget - cashShown) < 1) cashShown = cashTarget;
      set('c', Math.round(cashShown), (v) => { el.cash.textContent = money(v); });
    },
    banner(kind, text) {
      if (bannerQ.length > 2) bannerQ.shift();
      bannerQ.push({ kind, text });
      if (!bannerOn) nextBanner();
    },
    clearBanners() { bannerQ = []; clearTimeout(bannerTimer); bannerOn = false; el.banner.hidden = true; },
  };
}
