// Run HUD: distance (+ progress to the finish flag), run cash, speed, nitro. Writes the DOM only when
// a displayed value actually changes, so calling update() every frame is cheap.
import { $, money } from './dom.js';

export function createHud() {
  const el = {
    distance: $('#hud-distance'), finish: $('#hud-finish'), cash: $('#hud-cash'), speed: $('#hud-speed'),
    nitro: $('#hud-nitro'), nitroFill: $('#ctl-nitro-fill'), nitroBtn: $('#ctl-nitro'), toasts: $('#toasts'),
  };
  let last = {}, finishM = 400;

  function set(key, value, fn) {
    if (last[key] === value) return;
    last[key] = value;
    fn(value);
  }

  return {
    reset(track) {
      last = {};
      finishM = track ? track.finish : 400;
      el.toasts.textContent = '';
      this.update({ distance: 0, cash: 0, speedKmh: 0, nitro: 1 });
    },
    update(s) {
      if (!s) return;
      const d = Math.floor(s.distance || 0);
      set('d', d, (v) => { el.distance.textContent = v; });
      set('f', Math.min(100, Math.round((d / finishM) * 100)), (v) => { el.finish.style.width = v + '%'; });
      set('c', Math.round(s.cash || 0), (v) => { el.cash.textContent = money(v); });
      set('s', Math.round(s.speedKmh || 0), (v) => { el.speed.textContent = v; });
      const n = Math.max(0, Math.min(1, s.nitro == null ? 1 : s.nitro));
      set('n', Math.round(n * 100), (v) => {
        el.nitro.style.transform = `scaleX(${v / 100})`;
        el.nitroFill.style.transform = `scaleY(${v / 100})`;
        el.nitroBtn.classList.toggle('empty', v <= 0);
      });
    },
    toast(text) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = text;
      el.toasts.append(t);
      while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
      setTimeout(() => t.remove(), 2700);
    },
  };
}
