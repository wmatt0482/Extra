// The wave HUD (SPEC §2, §0, §13.5): the street and wave, the card stack (the called fraction big, read aloud, tap it
// to hear it again; the other live zombies' fractions as small cards, tap one to call it instead), the COMBO chip
// (from ×2 only; it fades on a miss) and pause. No timer, no countdown, no progress bar and no counters during a wave:
// the horde itself is the progress. A boss card shows its name and its hits left as dots.
import { $, h } from '../../../spell-jump/src/ui/dom.js';

export function createHud({ onFocus = () => {} } = {}) {
  const card = $('#btn-say'), n = $('#fc-n'), d = $('#fc-d'), say = $('#fc-say'), big = $('#fc-big');
  const bossEl = $('#fc-boss'), bossName = $('#fc-boss-name'), bossDots = $('#fc-boss-dots');
  const stack = $('#hud-stack'), comboEl = $('#hud-combo'), comboN = $('#hud-combo-n');
  const bannerEl = $('#banner'), bannerText = $('#banner-text'), help = $('#aim-help');
  let bannerTimer = 0, comboTimer = 0, current = null, stackKey = '', combo = 0;
  stack.addEventListener('click', (e) => {
    const b = e.target.closest('[data-focus]');
    if (b) onFocus(b.dataset.focus);
  });
  function fill(item) {
    const show = String(item.show);
    const m = /^(\d{1,3})\/(\d{1,3})$/.exec(show);
    big.classList.toggle('fc-words', !m);
    if (m) { n.textContent = m[1]; d.textContent = m[2]; } else { n.textContent = show; d.textContent = ''; }
    say.textContent = item.say;
    card.dataset.show = show;
    card.dataset.kind = item.kind || 'locate';
    const boss = item.kind === 'boss';
    bossEl.hidden = !boss;
    if (boss) {
      bossName.textContent = item.name || 'The boss';
      const left = Math.max(0, Math.min(5, Number(item.hitsLeft ?? item.hits) || 0));
      bossDots.replaceChildren(...Array.from({ length: Math.max(left, Number(item.hits) || left) }, (_, i) => h('i', { class: i < left ? 'on' : '' })));
    }
    card.setAttribute('aria-label', `${boss ? item.name + ': ' : ''}${item.say}. Tap to hear it again.`);
  }
  return {
    reset(streetName, number, { big = false, final = false } = {}) {
      $('#hud-street').textContent = streetName;
      $('#hud-wave').textContent = final ? `Wave ${number} · final wave` : big ? `Wave ${number} · big wave` : `Wave ${number}`;
      current = null; stackKey = ''; combo = 0;
      card.setAttribute('data-empty', '');
      stack.replaceChildren();
      comboEl.hidden = true; comboEl.classList.remove('show', 'fade');
      help.hidden = false;
      this.clearBanner();
    },
    /** The called fraction (null: none on the road right now). */
    setTarget(item) {
      current = item || null;
      if (!item) { card.setAttribute('data-empty', ''); return; }
      card.removeAttribute('data-empty');
      fill(item);
    },
    /** The other live zombies (getState().live), as small cards; the focused one is the big card. */
    setLive(live, target) {
      const list = (live || []).filter((z) => z && !z.cured && z.state !== 'leave' && z.state !== 'gone' && !z.resolved && z.show && (!target || z.item !== target.id));
      const key = list.map((z) => `${z.item}:${z.show}:${z.boss ? 'b' : ''}`).join('|');
      if (key === stackKey) return;
      stackKey = key;
      stack.replaceChildren(...list.map((z) => h('button', { class: `mini-card${z.boss ? ' boss' : ''}`, 'data-focus': z.item, 'data-show': z.show, 'aria-label': `Call ${z.say || z.show} instead` },
        h('span', { class: 'mc-show' }, z.show), z.boss ? h('span', { class: 'mc-sub' }, z.name || 'Boss') : null)));
    },
    /** The combo (consecutive hits): the chip shows from ×2; a reset fades it. */
    setCombo(nv) {
      const v = Math.max(0, Math.floor(Number(nv) || 0));
      if (v === combo) return;
      const was = combo;
      combo = v;
      clearTimeout(comboTimer);
      if (v >= 2) {
        comboN.textContent = `×${v}`;
        comboEl.hidden = false;
        comboEl.classList.remove('fade');
        comboEl.classList.remove('show'); void comboEl.offsetWidth; comboEl.classList.add('show');
      } else if (was >= 2) {
        comboEl.classList.add('fade');
        comboTimer = setTimeout(() => { comboEl.hidden = true; comboEl.classList.remove('show', 'fade'); }, 700);
      }
    },
    get target() { return current; },
    get combo() { return combo; },
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
