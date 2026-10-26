// The wave HUD (SPEC §2, §0): the street and wave, the called fraction (big, read aloud; tap it to hear it again) and
// pause. No timer, no countdown, no progress bar and no counters during a wave: the horde itself is the progress.
import { $ } from '../../../spell-jump/src/ui/dom.js';

export function createHud() {
  const card = $('#btn-say'), n = $('#fc-n'), d = $('#fc-d'), say = $('#fc-say');
  const bannerEl = $('#banner'), bannerText = $('#banner-text'), help = $('#aim-help');
  let bannerTimer = 0, current = null;
  return {
    reset(streetName, number, { big = false, final = false } = {}) {
      $('#hud-street').textContent = streetName;
      $('#hud-wave').textContent = final ? `Wave ${number} · final wave` : big ? `Wave ${number} · big wave` : `Wave ${number}`;
      current = null;
      card.setAttribute('data-empty', '');
      help.hidden = false;
      this.clearBanner();
    },
    /** The called fraction (null: none on the road right now). */
    setTarget(item) {
      current = item || null;
      if (!item) { card.setAttribute('data-empty', ''); return; }
      card.removeAttribute('data-empty');
      const [a, b] = String(item.show).split('/');
      n.textContent = a; d.textContent = b || '';
      say.textContent = item.say;
      card.dataset.show = item.show;
      card.setAttribute('aria-label', `${item.say}. Tap to hear it again.`);
    },
    get target() { return current; },
    hideHelp() { help.hidden = true; },
    banner(text, cls = '', ms = 1600) {
      clearTimeout(bannerTimer);
      bannerEl.className = `banner ${cls}`.trim();
      bannerText.textContent = text;
      bannerEl.hidden = false;
      void bannerEl.offsetWidth;
      bannerEl.classList.add('show');
      bannerTimer = setTimeout(() => { bannerEl.hidden = true; }, ms);
    },
    clearBanner() { clearTimeout(bannerTimer); bannerEl.hidden = true; },
  };
}
