// The Friday Test as a boss event (lab/SPEC.md §4.1). A friendly cartoon "Test Titan" (a stack of giant spelling blocks with a face) towers
// over the test screen: each right word makes it wobble and shed a block, a miss makes it shrug (never a sad or angry face, never a "lost").
// When the test is done, every score gets a ceremony (src/ui/ceremony.js): the Titan tumbles and a trophy (or the Brave Speller ribbon) lands
// on the shelf. The test itself is NOT changed: src/spelling/testMode.js is untouched and this module only watches the screen's data-mode
// ('right' / 'compare') from the outside. No hint, no combo, no coins popup, no timer, one attempt; the blocks carry no letters, so nothing
// on screen can spell the word being tested (R1).
import { createFireworks } from './fireworks.js';
import { CEREMONY_LINES, IMPROVED_TEXT, TIER_TEXT, ceremonyNode } from './ceremony.js';

export { CEREMONY_LINES };
const COLORS = ['#ff8a1f', '#22d3ff', '#8f6bff', '#2fd36b', '#ff3b5c', '#ffcf1a'];
const FACE = '<svg viewBox="0 0 64 56" aria-hidden="true"><rect x="3" y="3" width="58" height="50" rx="12" fill="#ffcf1a" stroke="#2a1a00" stroke-width="4"/>'
  + '<g class="ttn-brows" fill="none" stroke="#2a1a00" stroke-width="3.5" stroke-linecap="round"><path d="M16 17q6-4 12 0"/><path d="M36 17q6-4 12 0"/></g>'
  + '<g class="ttn-eyes"><circle cx="22" cy="26" r="7.5" fill="#fff" stroke="#2a1a00" stroke-width="2.5"/><circle cx="42" cy="26" r="7.5" fill="#fff" stroke="#2a1a00" stroke-width="2.5"/>'
  + '<circle class="ttn-pupil" cx="23" cy="27" r="3.4" fill="#2a1a00"/><circle class="ttn-pupil" cx="43" cy="27" r="3.4" fill="#2a1a00"/></g>'
  + '<path d="M20 40q12 9 24 0" fill="none" stroke="#2a1a00" stroke-width="4" stroke-linecap="round"/></svg>';
const sleepless = (fn, ms, timers) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/**
 * root: the #screen-test element (createTestScreen has already filled it). deps: { audio, say(text) → Promise|void, reduced() → bool }.
 * start(total) when a Friday Test begins, stop() when it is left; ceremony({...}) returns the card block for the end card.
 */
export function createTestBoss(root, { audio = null, say = null, reduced = () => false } = {}) {
  const wrap = el('div', 'tm-titan');
  wrap.id = 'tm-titan';
  wrap.hidden = true;
  wrap.setAttribute('aria-hidden', 'true');
  const head = el('div', 'ttn-head', FACE);
  const stack = el('div', 'ttn-stack');
  wrap.append(head, stack);
  const fxCanvas = el('canvas', 'tm-fx');
  fxCanvas.hidden = true;
  fxCanvas.setAttribute('aria-hidden', 'true');
  root.append(wrap, fxCanvas);
  const fx = createFireworks(fxCanvas);
  let timers = [], active = false, total = 0, rights = 0, blocks = [], shedAt = 0;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function build(n) {
    stack.replaceChildren();
    const count = Math.max(3, Math.min(5, n - 1));
    blocks = [];
    for (let i = 0; i < count; i++) {
      const b = el('div', 'ttn-blk', '<i></i>');
      b.firstChild.style.background = COLORS[i % COLORS.length];
      b.style.setProperty('--tilt', `${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg`);
      b.style.setProperty('--dir', i % 2 ? '1' : '-1');
      stack.append(b);
      blocks.push(b);
    }
    stack.style.setProperty('--n', String(count));
    shedAt = 0;
  }
  const flash = (cls, ms) => { wrap.classList.remove(cls); void wrap.offsetWidth; wrap.classList.add(cls); sleepless(() => wrap.classList.remove(cls), ms, timers); };
  function hit() {
    rights += 1;
    const want = total > 0 ? Math.floor((rights / total) * blocks.length) : 0;      // all right: every block shed, only the head stands
    while (shedAt < want && shedAt < blocks.length) {
      const b = blocks[blocks.length - 1 - shedAt++];
      b.classList.add('shed');
      sleepless(() => b.classList.add('gone'), 360, timers);
    }
    flash('wobble', 650);
  }
  function miss() { flash('shrug', 900); }

  const obs = typeof MutationObserver === 'function' ? new MutationObserver((recs) => {
    if (!active) return;
    for (const r of recs) {
      const now = root.dataset.mode, was = r.oldValue;
      if (now === was) continue;
      if (now === 'right') hit();
      else if (now === 'compare') miss();
      else if (now === 'done') wrap.classList.add('away');
    }
  }) : null;
  if (obs) obs.observe(root, { attributes: true, attributeFilter: ['data-mode'], attributeOldValue: true });

  const speak = (text) => { try { if (say) return Promise.resolve(say(text)).catch(() => {}); } catch (_) { /* ignore */ } return Promise.resolve(); };

  return {
    get active() { return active; },
    start(n) {
      stop();
      active = true; total = Math.max(1, n | 0); rights = 0;
      build(total);
      wrap.className = 'tm-titan';
      wrap.hidden = false;
    },
    stop,
    /**
     * The end card's ceremony block. Starts the confetti, the trophy sound and the voice line a moment after the card is on screen.
     * opts: { tier, improved, points, shelf (the shelf's label), sound (bool) }
     */
    ceremony({ tier = 'brave', improved = false, points = null, shelf = 'Your shelf', sound = true } = {}) {
      const node = ceremonyNode({ tier, improved, points, shelf });
      const rm = reduced();
      const ms = { gold: 3200, silver: 2400, bronze: 1700, brave: 1300 }[tier] || 1500;
      sleepless(() => {
        if (!root.isConnected) return;
        if (!rm) { try { fx.start(ms); } catch (_) { /* ignore */ } }
        if (sound && audio) {
          try { if (audio.fireworks && tier !== 'brave') audio.fireworks(); } catch (_) { /* ignore */ }
          sleepless(() => { try { audio.trophy && audio.trophy(); } catch (_) { /* ignore */ } }, rm ? 100 : 1050, timers);
        }
        speak(TIER_TEXT[tier].say).then(() => (improved ? speak(IMPROVED_TEXT.say) : null));
      }, 120, timers);
      return node;
    },
  };

  function stop() {
    active = false;
    clearTimers();
    try { fx.stop(); } catch (_) { /* ignore */ }
    wrap.hidden = true;
    wrap.className = 'tm-titan';
    stack.replaceChildren();
  }
}
