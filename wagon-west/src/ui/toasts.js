// Toasts and pops that never cover what the child has to read or press (playtest 1.2, W3-W5).
// The rule, in two parts:
//   1. HARD HOLD. While a panel, a card, a question, a person's speech, the pause sheet, the Wagon panel or a mini-game
//      (the hunt, a river, the raft, the stampede, Fort Derby) is open, nothing shows: toasts wait in a queue and pops
//      wait in theirs, and they come out when it closes. (`blocked()`, given by main.js.)
//   2. A PLACE THAT IS CLEAR. Otherwise a toast goes where its box touches no text and no button on the screen: the
//      strip near the top first, then (sliding down in small steps) the first height where nothing is under it; if no
//      height is clear it waits (and is re-tried four times a second). The same geometry test keeps a pop (a trail
//      card, a deed) off the toast, and the toast off the pop.
// So the answer to "is it safe to draw here?" is measured, not assumed: `readingBoxes()` is every visible control and
// every visible piece of text in the page, outside the scene, the backdrop and the layer asking.

const INTERACTIVE = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META']);
const HUD_SURFACES = '.hud-box, .hud-faces, .cpop-card, .dpop-card, .fpop-card';                 // the trail's HUD boxes count as reading surfaces even where they hold only pictures (the party's faces)
const MARGIN = 3;                                  // px of air around a box that counts as touching
const MAX_SHOWN = 3, MAX_PENDING = 10, TICK_MS = 250, MAX_WAIT_MS = 25000, PLAIN_WAIT_MS = 8000;
const STEP = 14, EDGE = 8;                         // px: how far each try slides down; air kept at the bottom edge

function visible(el) {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  return el.getClientRects().length > 0;
}
const hasOwnText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true; return false; };
const meet = (a, b) => a.left < b.right + MARGIN && a.right > b.left - MARGIN && a.top < b.bottom + MARGIN && a.bottom > b.top - MARGIN;

/** Is `rect` (a part of `el`) scrolled out of sight inside a clipping ancestor? Only asked when a box would touch. */
function clippedAway(el, rect) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const r = p.getBoundingClientRect();
    if (rect.bottom <= r.top || rect.top >= r.bottom || rect.right <= r.left || rect.left >= r.right) return true;
  }
  return false;
}

/** Every visible control and piece of text on the page, as { el, r } (r = its client rect): outside the scene, the
 *  backdrop, hidden things and `skip` (a layer asking about itself). */
export function readingBoxes(skip = null) {
  const out = [];
  const vw = window.innerWidth, vh = window.innerHeight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n === skip || SKIP_TAGS.has(n.tagName.toUpperCase()) || n.hidden || n.id === 'stage' || n.id === 'backdrop' || n.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
      if (!visible(n)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(INTERACTIVE.has(n.tagName) || hasOwnText(n) || n.matches(HUD_SURFACES))) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) continue;
    out.push({ el: n, r });
  }
  return out;
}
/** The elements of `boxes` that `box` ({ left, right, top, bottom }) would touch (empty = clear). */
export function hitsOf(box, boxes) {
  const out = [];
  for (const b of boxes) if (meet(box, b.r) && !clippedAway(b.el, b.r)) out.push(b.el);
  return out;
}
/** Every visible control and piece of text that `box` would touch. */
export const touching = (box, skip = null) => hitsOf(box, readingBoxes(skip));

/** The toast layer. root = #toasts; blocked() → true while a panel / card / mini-game is open. A toast may carry a line to say
 *  (`add(el, ms, { say })`): it is handed to say(text) when the toast is SHOWN (not when it is queued), and the next toast
 *  with a line is shown only when speaking() says the voice has finished the last one: held toasts come out one at a time
 *  and their speech queues behind whatever is playing, never cutting a dictation or a panel's reading (src/meta/speech.js). */
export function createToaster(root, { blocked = () => false, say = null, speaking = () => false } = {}) {
  const pending = [];                              // { el, ms, text }
  let timer = 0;
  const trace = [];                                // (tests) what happened to each toast, newest last
  const shownLog = [];                             // (tests) the full text of every toast that was shown, oldest first
  const note = (ev, it) => { trace.push(`${Math.round(performance.now() / 100) / 10} ${ev} ${(it.text || '').slice(0, 24)}`); if (trace.length > 40) trace.shift(); };

  const shown = () => [...root.children];
  const rectOf = () => { const r = root.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height }; };

  const home = () => { root.style.top = ''; root.style.left = ''; };          // back to the default strip
  function expire(it) {
    it.timer = setTimeout(() => { note('expired', it); it.el.remove(); it.timer = 0; if (!root.children.length) home(); arm(); pump(); }, it.ms);
  }
  /** Put a shown toast back at the head of the queue (a panel opened over it, or the screen changed under it). */
  function park(el) {
    const it = el._item;
    if (!it) { el.remove(); return; }
    clearTimeout(it.timer); it.timer = 0;
    note('parked', it);
    el.remove();
    pending.unshift(it);
  }
  /** Where the layer (with the toasts already in it) touches nothing: { x, y } as the CSS `left` / `top` the layer takes
   *  ('' = its default), tried in order: the default strip near the top, then sliding down in small steps, and at each
   *  height a little to the left and the right; null when nowhere is clear. */
  function clearSpot(boxes) {
    if (root.children.length > 1 && root.style.top) return hitsOf(rectOf(), boxes).length ? null : { x: root.style.left, y: root.style.top };   // (the new toast is in the layer already)
    root.style.top = ''; root.style.left = '';
    const r0 = rectOf();
    const vw = window.innerWidth, vh = window.innerHeight, w = r0.right - r0.left, cx0 = r0.left + w / 2;
    const dxs = [0, -0.16, 0.16, -0.3, 0.3].map((f) => f * vw).filter((dx) => cx0 + dx - w / 2 >= EDGE && cx0 + dx + w / 2 <= vw - EDGE);
    for (let y = r0.top; y + r0.height <= vh - EDGE; y += STEP) {
      for (const dx of dxs) {
        if (!hitsOf({ left: r0.left + dx, right: r0.right + dx, top: y, bottom: y + r0.height }, boxes).length) return { x: dx ? cx0 + dx + 'px' : '', y: y === r0.top ? '' : y + 'px' };
      }
    }
    return null;
  }
  function place(it) {
    it.el.style.visibility = 'hidden';
    root.append(it.el);
    const at = clearSpot(readingBoxes(root));
    if (!at) { it.el.remove(); return false; }
    root.style.left = at.x; root.style.top = at.y;
    note('shown', it);
    if (it.say && say && !it.said) { it.said = true; try { say(it.say); } catch (_) { /* ignore */ } }      // (once: a toast parked and shown again does not say its line again)
    shownLog.push(it.text); if (shownLog.length > 80) shownLog.shift();
    it.el.style.visibility = '';
    expire(it);
    return true;
  }
  function pump() {
    // what is up must still be clear (the screen may have changed under it); what is not, waits its turn again
    if (blocked()) { for (const el of shown().reverse()) park(el); }
    else if (root.children.length && hitsOf(rectOf(), readingBoxes(root)).length) { for (const el of shown().reverse()) park(el); }
    if (!root.children.length) home();
    // (a line nobody could be shown for a good while is stale: a plain toast after 8 s, an effect line after 25 s)
    for (let i = pending.length - 1; i >= 0; i--) if (Date.now() - pending[i].at > (pending[i].keep ? MAX_WAIT_MS : PLAIN_WAIT_MS)) { note('stale', pending[i]); pending.splice(i, 1); }
    let spokeThisPass = false;
    while (pending.length && !blocked() && root.children.length < MAX_SHOWN) {
      // a toast with a line waits while the voice is still on the last one (the plain toasts behind it do not wait)
      let i = 0;
      if (pending[0].say && say && (spokeThisPass || speaking())) { i = pending.findIndex((p) => !(p.say && say)); if (i < 0) break; }
      if (!place(pending[i])) break;
      if (pending[i].say && say) spokeThisPass = true;
      pending.splice(i, 1);
    }
    arm();
  }
  /** The re-try clock runs only while something waits or shows. */
  function arm() {
    const need = pending.length || root.children.length;
    if (need && !timer) timer = setInterval(pump, TICK_MS);
    else if (!need && timer) { clearInterval(timer); timer = 0; }
  }
  return {
    /** Queue a toast element for `ms` of life once it is shown. Returns the element. */
    add(el, ms = 2700, { say: line = '' } = {}) {
      const text = el.textContent;
      const dup = pending.find((p) => p.text === text);
      if (dup) return dup.el;
      const it = { el, ms, text, say: line, timer: 0, at: Date.now(), keep: el.classList.contains('fx') };   // (an effect line is information: it outlives a change of screen)
      el._item = it;
      pending.push(it);
      note('queued', it);
      while (pending.length > MAX_PENDING) note('dropped', pending.shift());
      pump();
      return el;
    },
    /** A new screen wants a clean top: what shows goes, and so do the plain toasts that waited (an effect line, which is
     *  information, stays in the queue unless `all`). */
    clear(all = false) {
      for (const el of shown().reverse()) { const it = el._item; if (it) clearTimeout(it.timer); el.remove(); if (it && it.keep && !all) { it.timer = 0; pending.unshift(it); } }
      for (let i = pending.length - 1; i >= 0; i--) if (all || !pending[i].keep) { note('cleared', pending[i]); pending.splice(i, 1); }
      home();
      arm();
    },
    /** A screen was left: the lines tagged with its name (el.dataset.scope, an effect line made while it was up, like camp's "Three throws!") go, shown or
     *  waiting (v1.5 playtest U1: they used to outlive the screen and sit on the trail). */
    clearScope(scope) {
      if (!scope) return;
      for (const el of shown().reverse()) if (el.dataset.scope === scope) { const it = el._item; if (it) clearTimeout(it.timer); el.remove(); }
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].el.dataset.scope === scope) { note('cleared', pending[i]); pending.splice(i, 1); }
      if (!root.children.length) home();
      arm();
    },
    pump,
    /** (tests) why a toast would wait right now: the hard hold, and what the layer touches at its default place. */
    diagnose() {
      const probe = document.createElement('div'); probe.className = 'toast'; probe.textContent = 'probe'; probe.style.visibility = 'hidden';
      const keep = root.style.top, keepX = root.style.left; home();
      root.append(probe);
      const hits = touching(root.getBoundingClientRect(), root).map((e) => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + ' "' + (e.textContent || '').trim().slice(0, 20) + '"');
      probe.remove(); root.style.top = keep; root.style.left = keepX;
      return { blocked: !!blocked(), shown: root.children.length, topHits: hits, y: keep || 'default' };
    },
    get trace() { return trace.slice(); },
    get log() { return shownLog.slice(); },
    get waiting() { return pending.map((p) => p.text); },
    get shown() { return shown().map((e) => e.textContent); },
  };
}

/** For a pop (a card, a deed, a find): held while a panel, card, question or mini-game is open, while `hold()` says so (the
 *  results screen's table is what the child reads there), while its box, as drawn now, touches a toast, and (v1.5 playtest U2) while it would sit on a
 *  control or a line the child reads on the screen (camp's cards, a store row, an instruction): it waits, unseen, and comes out where it is clear. */
export function popHeld(root, { blocked = () => false, hold = () => false } = {}) {
  if (blocked() || hold()) return true;
  const box = root.getBoundingClientRect();
  const toasts = [...document.querySelectorAll('#toasts .toast')].filter((t) => t.style.visibility !== 'hidden').map((el) => ({ el, r: el.getBoundingClientRect() }));
  if (hitsOf(box, toasts).length > 0) return true;
  const reading = readingBoxes(root).filter((b) => !b.el.closest('#cardpop, #deedpop, #findpop, #toasts'));
  return hitsOf(box, reading).length > 0;
}
