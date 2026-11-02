// STUB: the Lab's UI entry (lab/SPEC.md §6.1). The UI stream replaces this file with the real one; until then this keeps the facade
// working end to end with a minimal pill, results strip and overlay, so the games can be built and tested against the real core.
// Exports (the contract): installStyles(), mountHud(host, store, { game, compact }), mountResults(host, store, { game }),
// openOverlay(store, { view, game, unlocked, onClose }), renderPage(root, store, { sync }).
let styled = false;
export function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = '.lab-pill,.lab-strip{font:600 13px system-ui,sans-serif;color:#fff;background:rgba(20,24,40,.82);border-radius:10px;padding:4px 10px;display:inline-flex;gap:8px;align-items:center}'
    + '.lab-bar{width:64px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);overflow:hidden}.lab-bar i{display:block;height:100%;background:#5fd38d}'
    + '.lab-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:99999}'
    + '.lab-card{background:#161a2b;color:#fff;border-radius:14px;padding:18px;min-width:260px;max-width:90vw;font:15px system-ui,sans-serif}';
  document.head.appendChild(st);
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

export function mountHud(host, store, { compact = false } = {}) {
  if (typeof document === 'undefined') return { el: null, update() {}, destroy() {} };
  const root = el('div', 'lab-pill'), lv = el('span'), bar = el('span', 'lab-bar'), fill = el('i'), flame = el('span');
  bar.appendChild(fill); root.append(lv, bar, flame);
  const update = () => {
    const v = store.view();
    if (!v) return;
    lv.textContent = compact ? `Lv ${v.level.level}` : `Lab Lv ${v.level.level}`;
    fill.style.width = `${v.level.need ? Math.round((100 * v.level.into) / v.level.need) : 100}%`;
    flame.textContent = v.combo.count >= 2 ? `x${v.combo.count >= 3 ? 2 : 1}` : '';
  };
  const off = store.subscribe(update);
  if (host) host.appendChild(root);
  update();
  return { el: root, update, destroy() { off(); root.remove(); } };
}
export function mountResults(host, store, { game } = {}) {
  if (typeof document === 'undefined') return { el: null, update() {}, destroy() {} };
  const root = el('div', 'lab-strip');
  const update = () => {
    const s = store.roundSummary(game);
    if (!s) return;
    const bits = [`+${s.coins} Lab coins`];
    if (s.next) bits.push(`${s.toNext} XP to level ${s.next}`);
    if (s.quests.length) bits.push(`${s.questsDone} of ${s.quests.length} quests`);
    if (s.crateWaiting) bits.push('Lab crate!');
    root.textContent = bits.join(' · ');
  };
  const off = store.subscribe(update);
  if (host) host.appendChild(root);
  update();
  return { el: root, update, destroy() { off(); root.remove(); } };
}
export function openOverlay(store, { view = 'home', onClose } = {}) {
  if (typeof document === 'undefined') return null;
  const wrap = el('div', 'lab-overlay'), card = el('div', 'lab-card');
  const v = store.view();
  card.appendChild(el('div', '', v ? `The Lab · ${view} · Lv ${v.level.level} · ${v.coins} coins` : 'The Lab'));
  const close = el('button', '', 'Close');
  close.onclick = () => { wrap.remove(); if (onClose) onClose(); };
  card.appendChild(close); wrap.appendChild(card); document.body.appendChild(wrap);
  return { close: close.onclick };
}
export function renderPage(root) { if (root) root.textContent = 'The Lab'; }
