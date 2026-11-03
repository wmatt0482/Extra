// The Lab pill for a game's HUD (lab/SPEC.md §1.3, §3.3): "Lv 7" and a bar of the level's XP, and the combo flame (small at 2, "x2" from 3, it fades
// on its own after a miss: no message, nothing counting down). Coins are NOT shown here (D7). A level-up, a crate or a finished quest raises one calm
// banner with the shared sound. Tapping the pill opens the Lab.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { lab } from '../index.js';
import { LAB_LINES } from '../core/view.js';
import { glyph } from './glyph.js';
import { sfx } from './util.js';
import { sharedVoice, voiceFor } from './voice.js';

let bannerEl = null, bannerTimer = 0;
/** One banner at a time, centred at the top of the page; it takes itself away (no countdown shown). */
export function showBanner(lines, { say = '', kind = '', store = null } = {}) {
  try {
    if (!bannerEl) {
      bannerEl = h('div', { class: 'lab-root lab-banner', role: 'status', 'aria-live': 'polite' });
      bannerEl.addEventListener('click', () => { bannerEl.classList.remove('in'); lab.openHome(); });
      document.body.append(bannerEl);
    }
    bannerEl.className = `lab-root lab-banner ${kind}`;
    bannerEl.replaceChildren(...lines.map((l, i) => h('div', { class: i ? 'lab-banner-sub' : 'lab-banner-main' }, l)));
    void bannerEl.offsetWidth; bannerEl.classList.add('in');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { if (bannerEl) bannerEl.classList.remove('in'); }, 3400);
    if (say) (store ? voiceFor(store) : sharedVoice()).later(say);
  } catch (_) { /* a banner never matters */ }
}

export function mountHud(host, store, { game = 'sj', compact = false } = {}) {
  if (typeof document === 'undefined') return { el: null, update() {}, destroy() {} };
  const lv = h('span', { class: 'lab-hud-lv' }), fill = h('i');
  const bar = h('span', { class: 'lab-bar lab-hud-bar' }, fill);
  const flame = h('span', { class: 'lab-hud-flame', 'aria-hidden': 'true' }, h('span', { html: glyph('flame') }), h('b', {}));
  const inner = h('span', { class: 'lab-hud-in' }, h('span', { class: 'lab-hud-lab', 'aria-hidden': 'true', html: glyph('quests') }), lv, bar, flame);
  const root = h('button', { class: 'lab-root lab-hud' + (compact ? ' compact' : ''), type: 'button', 'aria-label': 'The Lab' }, inner);
  root.addEventListener('click', (e) => { e.stopPropagation(); lab.openHome(); });
  let last = 0;
  const update = () => {
    const v = store.view(game); if (!v) return;
    const L = v.level;
    lv.textContent = compact ? `Lv ${L.level}` : `Lab Lv ${L.level}`;
    fill.style.width = `${L.max ? 100 : L.need ? Math.round((100 * L.into) / L.need) : 0}%`;
    const n = v.combo.count;
    if (n >= 2) last = n;
    flame.classList.toggle('on', n >= 2);
    root.classList.toggle('flaming', n >= 2);
    flame.classList.toggle('big', n >= 3);
    flame.querySelector('b').textContent = n >= 3 ? '×2' : '';
    root.setAttribute('aria-label', `The Lab. Level ${L.level}.${L.max ? '' : ` ${L.toNext} XP to level ${L.next}.`}`);
  };
  const off = store.subscribe((e) => {
    update();
    if (e.type !== 'report' || !e.receipt || !e.receipt.ok) return;
    const r = e.receipt, lines = [];
    let say = '';
    const names = (r.unlocks || []).map((u) => `New: ${u.name}`);
    if (r.level && r.level.up) {
      lines.push(`Level ${r.level.after} · ${r.level.title}`, ...names);
      say = LAB_LINES.levelUp(r.level.after, r.level.title);
      sfx('levelUp');
    } else if (r.crate) { lines.push(LAB_LINES.crate, ...names); say = LAB_LINES.crate; sfx('crateOpen'); }
    else if ((r.quests || []).some((q) => q.justDone)) { lines.push('Quest done!', ...names); sfx('missionComplete'); }
    else if (names.length) { lines.push(...names); say = (r.unlocks[0] || {}).name ? LAB_LINES.gotItem(r.unlocks[0].name) : ''; sfx('trophy'); }
    if (lines.length) showBanner(lines, { say, kind: r.level && r.level.up ? 'level' : r.crate ? 'crate' : 'quest', store });
  });
  if (host) host.appendChild(root);
  update();
  void last;
  return { el: root, update, destroy() { off(); root.remove(); } };
}
