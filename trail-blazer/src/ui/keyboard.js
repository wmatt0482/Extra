// On-screen keyboard for the new-player name (never the native one): the same keyboard as Spell Jump's
// car-jump/src/spelling/keyboard.js (QWERTY, apostrophe, hyphen, space, backspace, a wide DONE key; every row is 10
// key units; pointer events with pointerId tracking; desktop typing works while it is active).

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '-', ['back', 2]],
  [['space', 4], ['enter', 6]],
];

const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>';

export function createKeyboard({ onKey = () => {}, onBackspace = () => {}, onEnter = () => {}, enterLabel = 'Launch', upper = false, id = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'kb';
  if (id) el.id = id;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Keyboard');
  const keys = new Map();          // char / 'back' / 'enter' / 'space' -> button
  let enabled = true, enterEnabled = false, active = false;
  const held = new Map();          // pointerId -> button
  let lastPointer = 0;             // a tap fires on pointerdown; ignore the click that follows it

  for (const row of ROWS) {
    const r = document.createElement('div');
    r.className = 'kb-row';
    for (const k of row) {
      const [name, span] = Array.isArray(k) ? k : [k, 1];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kb-key';
      b.dataset.key = name;
      if (span > 1) b.style.gridColumn = `span ${span}`;
      if (name === 'back') { b.classList.add('kb-back'); b.innerHTML = BACK_SVG; b.setAttribute('aria-label', 'Delete'); }
      else if (name === 'enter') { b.classList.add('kb-enter'); b.textContent = enterLabel; }
      else if (name === 'space') { b.classList.add('kb-space'); b.textContent = 'space'; b.setAttribute('aria-label', 'Space'); }
      else { b.classList.add('kb-char'); b.textContent = name; if (name === "'") b.setAttribute('aria-label', 'Apostrophe'); if (name === '-') b.setAttribute('aria-label', 'Hyphen'); }
      keys.set(name, b);
      r.append(b);
    }
    el.append(r);
  }

  function fire(name) {
    if (!enabled) return;
    if (name === 'back') onBackspace();
    else if (name === 'enter') { if (enterEnabled) onEnter(); }
    else if (name === 'space') onKey(' ');
    else onKey(name);
  }
  function press(b) {
    b.classList.remove('is-down'); void b.offsetWidth; b.classList.add('is-down');
  }
  function releaseKey(b) {
    if ([...held.values()].includes(b)) return;
    b.classList.remove('is-down');
  }

  el.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.kb-key');
    if (!b || !el.contains(b)) return;
    e.preventDefault();
    lastPointer = performance.now();
    if (!enabled || b.disabled) return;
    held.set(e.pointerId, b);
    try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    press(b);
    fire(b.dataset.key);
  });
  const up = (e) => {
    const b = held.get(e.pointerId);
    if (!b) return;
    held.delete(e.pointerId);
    releaseKey(b);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  // a click with no pointerdown before it (assistive tech, keyboard focus + Enter) still types
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.kb-key');
    if (!b || performance.now() - lastPointer < 1000) return;
    if (!b.disabled) { press(b); setTimeout(() => releaseKey(b), 120); fire(b.dataset.key); }
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  function onKeyDown(e) {
    if (!active || !enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    let name = null;
    if (/^[a-zA-Z]$/.test(e.key)) name = e.key.toLowerCase();
    else if (e.key === "'" || e.key === '’') name = "'";
    else if (e.key === '-') name = '-';
    else if (e.key === ' ' || e.code === 'Space') name = 'space';
    else if (e.key === 'Backspace') name = 'back';
    else if (e.key === 'Enter') name = 'enter';
    if (!name) return;
    e.preventDefault();
    e.stopPropagation();
    const b = keys.get(name);
    if (b) { press(b); setTimeout(() => releaseKey(b), 120); }
    fire(name);
  }

  const api = {
    el,
    setEnabled(on) {
      enabled = !!on;
      el.classList.toggle('is-disabled', !enabled);
      for (const b of keys.values()) b.disabled = !enabled || (b.dataset.key === 'enter' && !enterEnabled);
    },
    setEnterEnabled(on) {
      enterEnabled = !!on;
      const b = keys.get('enter');
      b.disabled = !enabled || !enterEnabled;
      b.classList.toggle('ready', enterEnabled);
    },
    setEnterLabel(t) { keys.get('enter').textContent = t; },
    setUpper(on) {
      for (const [name, b] of keys) if (/^[a-z]$/.test(name)) b.textContent = on ? name.toUpperCase() : name;
    },
    // window key listener only while this keyboard is the one on screen
    setActive(on) {
      if (on === active) return;
      active = !!on;
      if (active) window.addEventListener('keydown', onKeyDown, true);
      else window.removeEventListener('keydown', onKeyDown, true);
    },
    flash(name) { const b = keys.get(name); if (b) press(b); setTimeout(() => b && releaseKey(b), 160); },
    key: (name) => keys.get(name),
    destroy() { api.setActive(false); el.remove(); },
  };
  api.setUpper(upper);
  api.setEnterEnabled(false);
  return api;
}
