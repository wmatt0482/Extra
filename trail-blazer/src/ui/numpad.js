// The on-screen numpad for the Gate panel (never the native keyboard): 1-9, ⌫, 0, GO. Big keys (≥ 44 px, the CSS
// sizes them to the screen), keys fire on press (pointerdown, one finger per key), a click without a press (assistive
// tech, keyboard focus) still works. Desktop typing: digits (also the number pad), Backspace, Enter, while active.

const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>';

export function createNumpad({ onDigit = () => {}, onBack = () => {}, onGo = () => {} } = {}) {
  const el = document.createElement('div');
  el.className = 'np';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Number pad');
  const keys = new Map();
  let enabled = true, goEnabled = false, active = false, lastPointer = 0;
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'go']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'np-key' + (k === 'back' ? ' np-back' : k === 'go' ? ' np-go' : '');
    b.dataset.key = k;
    if (k === 'back') { b.innerHTML = BACK_SVG; b.setAttribute('aria-label', 'Delete'); } else b.textContent = k === 'go' ? 'GO' : k;
    keys.set(k, b);
    el.append(b);
  }
  const fire = (k) => {
    if (!enabled) return;
    if (k === 'back') onBack(); else if (k === 'go') { if (goEnabled) onGo(); } else onDigit(k);
  };
  const flash = (b) => { b.classList.remove('is-down'); void b.offsetWidth; b.classList.add('is-down'); setTimeout(() => b.classList.remove('is-down'), 120); };
  el.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.np-key');
    if (!b) return;
    e.preventDefault();
    lastPointer = performance.now();
    if (!enabled || b.disabled) return;
    flash(b);
    fire(b.dataset.key);
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.np-key');
    if (!b || performance.now() - lastPointer < 1000 || b.disabled) return;
    flash(b); fire(b.dataset.key);
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  function onKeyDown(e) {
    if (!active || !enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === 'Backspace' || e.key === 'Delete') k = 'back';
    else if (e.key === 'Enter') k = 'go';
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    const b = keys.get(k);
    if (b && !b.disabled) flash(b);
    fire(k);
  }
  const api = {
    el,
    setEnabled(on) { enabled = !!on; el.classList.toggle('is-disabled', !enabled); for (const [k, b] of keys) b.disabled = !enabled || (k === 'go' && !goEnabled); },
    setGoEnabled(on) { goEnabled = !!on; const b = keys.get('go'); b.disabled = !enabled || !goEnabled; b.classList.toggle('ready', goEnabled); },
    setActive(on) {
      if (!!on === active) return;
      active = !!on;
      if (active) window.addEventListener('keydown', onKeyDown, true); else window.removeEventListener('keydown', onKeyDown, true);
    },
    key: (k) => keys.get(k),
  };
  api.setGoEnabled(false);
  return api;
}
