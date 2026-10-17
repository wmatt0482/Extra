// Race HUD: the position badge (1st-4th, bumps when it changes), the race time, speed, the boost gauge (also the BOOST
// button's fill), a thin track bar with a dot per rider (the player's ringed, the AI riders in their paints), and one
// banner at a time in the band under the top bar (FLIP!, BIG AIR, PERFECT, CRASH, "You're 2nd!" ...). Writes the DOM
// only when a shown value changes, so update() can run every frame.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { fmtTime, ordinal } from '../data/medals.js';
import { COLOR_BY_PAINT } from '../data/paints.js';

const BANNER_MS = 1550;
const sfx = (n) => ordinal(n).replace(/^\d+/, '');

export function createHud({ paintColor = (id) => COLOR_BY_PAINT[id] || '#c9d1d6' } = {}) {
  const el = {
    pos: $('#hud-pos'), place: $('#hud-place'), placeSfx: $('#hud-place-sfx'), of: $('#hud-of'), time: $('#hud-time'), speed: $('#hud-speed'),
    boost: $('#hud-boost'), boostFill: $('#ctl-boost-fill'), boostBtn: $('#ctl-boost'), dots: $('#race-dots'),
    banner: $('#banner'), bannerText: $('#banner-text'),
  };
  let last = {}, length = 600, dots = [], me = null, bannerQ = [], bannerTimer = 0, bannerOn = false;
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
    bannerTimer = setTimeout(nextBanner, b.ms || BANNER_MS);
  }
  function buildDots(riders, playerColor) {
    dots = (riders || []).map((r) => h('i', { class: 'rb-dot', title: r.name, 'data-rider': r.name, style: { '--c': paintColor(r.paint) } }));
    me = h('i', { class: 'rb-dot me', 'data-rider': 'me', style: { '--c': playerColor || '#ff8a1f' } });
    el.dots.replaceChildren(...dots, me);
  }
  const pct = (x) => `${Math.max(0, Math.min(100, (x / length) * 100)).toFixed(1)}%`;

  return {
    /** trail: the track; playerColor: the player's paint color */
    reset(trail, playerColor) {
      length = Math.max(1, (trail && trail.length) || 600);
      last = {};
      buildDots([], playerColor);
      this.clearBanners();
      el.pos.classList.remove('bump', 'p1');
      this.update({ distance: 0, speedKmh: 0, boost: 0.4, timeSec: 0, place: 4, riders: [] });
    },
    update(s) {
      if (!s) return;
      // getState().riders may list the player too ({ me: true }); x is the engine's world x, so the track position is
      // x minus the player's own offset (state.x - state.distance)
      const all = Array.isArray(s.riders) ? s.riders : [];
      const riders = all.filter((r) => !r.me);
      const offset = Number.isFinite(s.x) && Number.isFinite(s.distance) ? s.x - s.distance : 0;
      if (riders.length !== dots.length) buildDots(riders, me && me.style.getPropertyValue('--c'));
      set('n', riders.length + 1, (v) => { el.of.textContent = `/ ${v}`; });
      if (s.place >= 1) {
        set('p', s.place, (v) => {
          el.place.textContent = String(v); el.placeSfx.textContent = sfx(v);
          el.pos.classList.toggle('p1', v === 1);
          el.pos.dataset.place = String(v);
          el.pos.setAttribute('aria-label', `${ordinal(v)} place`);
        });
      }
      set('t', Math.floor((s.timeSec || 0) * 10), () => { el.time.textContent = fmtTime(s.timeSec || 0); });
      set('v', Math.round(s.speedKmh || 0), (v) => { el.speed.textContent = String(v); });
      const b = Math.max(0, Math.min(1, s.boost == null ? 0 : s.boost));
      set('b', Math.round(b * 100), (v) => { el.boost.style.transform = `scaleX(${v / 100})`; el.boostFill.style.transform = `scaleY(${v / 100})`; el.boostBtn.classList.toggle('empty', v < 2); });
      set('me', pct(s.distance || 0), (v) => { me.style.left = v; });
      riders.forEach((r, i) => set('r' + i, pct((r.x || 0) - offset), (v) => { dots[i].style.left = v; }));
    },
    /** the position badge pops (call when the place changes) */
    bumpPlace() { restart(el.pos, 'bump'); },
    /** opts.low: only when no other banner is up or waiting (position changes never push a stunt banner out) */
    banner(kind, text, ms, opts = {}) {
      if (opts.low && (bannerOn || bannerQ.length)) return false;
      if (bannerQ.length > 3) { const i = bannerQ.findIndex((b) => b.low); bannerQ.splice(i >= 0 ? i : 0, 1); }
      bannerQ.push({ kind, text, ms, low: !!opts.low });
      if (!bannerOn) nextBanner();
      return true;
    },
    clearBanners() { bannerQ = []; clearTimeout(bannerTimer); bannerOn = false; el.banner.hidden = true; },
  };
}
