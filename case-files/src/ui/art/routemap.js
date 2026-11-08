// The Erie Canal route on the agency home: a parchment map pinned to the cork board. The canal winds from Albany through
// Rochester and Lockport to Buffalo; each case of the arc is a numbered stop, the four Rochester cases fan out around the town and
// the Lockport case sits at the locks. A closed case is a gold medallion with a red CLOSED seal, the next case glows, a sealed case is
// dim with a lock (no titles, no countdown, SPEC section 1). Red string joins the stops in order. The map redraws to the width it is
// given, so the labels stay readable on a phone and the stops never overlap; every stop is a real button (44px tap target).
//
// createRouteMap({ stops: [{ id, no, state: 'closed' | 'now' | 'open' | 'sealed', title }], onOpen(id), reduced }) -> element

const INK = '#5a4220', INK2 = '#3a2a0c';

// which town each case belongs to, by its setting line ("Rochester, New York · June 1826")
const townOf = (setting = '') => (/lockport/i.test(setting) ? 'lockport' : /buffalo/i.test(setting) ? 'buffalo' : /albany/i.test(setting) ? 'albany' : 'rochester');

const ICON = {
  albany: `<g fill="${INK}"><rect x="-13" y="-8" width="8" height="16"/><rect x="-3" y="-14" width="7" height="22"/><path d="M-2 -14l1.5 -8 1.5 8z"/><rect x="6" y="-6" width="8" height="14"/><path d="M-13 -8l4 -5 4 5z"/><path d="M6 -6l4 -5 4 5z"/></g><g fill="#f1e1b4"><rect x="-11" y="-4" width="2" height="3"/><rect x="-1" y="-9" width="2" height="3"/><rect x="-1" y="-2" width="2" height="3"/><rect x="8.5" y="-2" width="2" height="3"/></g>`,
  rochester: `<g fill="${INK}"><rect x="-16" y="-9" width="32" height="7" rx="1"/><path d="M-15 -2v9h6v-3a3 3 0 0 1 6 0v3h6v-3a3 3 0 0 1 6 0v3h6v-9z"/></g><g fill="#f1e1b4"><rect x="-13" y="-7" width="26" height="1.6"/></g>`,
  lockport: `<g fill="${INK}"><rect x="-16" y="2" width="8" height="8"/><rect x="-8" y="-3" width="8" height="13"/><rect x="0" y="-8" width="8" height="18"/><rect x="8" y="-13" width="8" height="23"/></g><g fill="#4aa3c8"><rect x="-15" y="4" width="6" height="2"/><rect x="-7" y="-1" width="6" height="2"/><rect x="1" y="-6" width="6" height="2"/><rect x="9" y="-11" width="6" height="2"/></g>`,
  buffalo: `<g fill="${INK}"><path d="M-4 10l2 -26h4l2 26z"/><rect x="-5" y="-21" width="10" height="5"/><path d="M-6 -21l6 -6 6 6z"/></g><g fill="#f1e1b4"><rect x="-1.5" y="-9" width="3" height="4"/></g><g fill="#ffe27a"><path d="M6 -19l12 -5v4zM-6 -19l-12 -5v4z" opacity=".9"/></g>`,
};
const NAME = { albany: 'Albany', rochester: 'Rochester', lockport: 'Lockport', buffalo: 'Buffalo' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createRouteMap({ stops = [], onOpen = () => {}, reduced = false } = {}) {
  const el = document.createElement('div');
  el.className = 'routemap';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'The Erie Canal route, Buffalo in the west to Albany in the east. Each stop is a case.');
  let lastW = 0;

  function draw(W) {
    const narrow = W < 560;
    const H = narrow ? 216 : 210;
    const mid = narrow ? 100 : 98;
    const amp = narrow ? 11 : 13;
    // true geography, west on the left: Buffalo, Lockport, Rochester, then the long run east to Albany (order right, not to scale)
    const fx = narrow ? { buffalo: 0.09, lockport: 0.27, rochester: 0.53, albany: 0.92 } : { buffalo: 0.07, lockport: 0.24, rochester: 0.5, albany: 0.93 };
    const X = (t) => fx[t] * W;
    const Y = (x) => mid + amp * Math.sin((x / W) * Math.PI * 2 * 1.5 + 0.7);
    // the canal
    let d = '';
    for (let x = -8; x <= W + 8; x += 8) d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${Y(x).toFixed(1)}`;
    // case stops: Rochester cases fan out above and below the town; the others sit above their town
    const by = {};
    stops.forEach((s) => { s.town = s.town || townOf(s.setting); (by[s.town] = by[s.town] || []).push(s); });
    const spread = narrow ? 33 : 40;
    const up = narrow ? 50 : 50;
    const pos = [];
    for (const t of Object.keys(by)) {
      const list = by[t], n = list.length;
      list.forEach((s, i) => {
        const dx = (i - (n - 1) / 2) * spread;
        const above = n === 1 ? true : i % 2 === 0;
        const x = X(t) + dx;
        pos.push({ ...s, x, y: Y(x) + (above ? -up : up) });
      });
    }
    pos.sort((a, b) => a.no - b.no);
    // red string through the stops in order: solid between closed ones, dashed after
    let str = '';
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1], b = pos[i], done = a.state === 'closed' && (b.state === 'closed' || b.state === 'now' || b.state === 'open');
      const my = Math.max(a.y, b.y) + 12;
      str += `<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${((a.x + b.x) / 2).toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" fill="none" stroke="${done ? '#d8423b' : '#b9876f'}" stroke-width="${done ? 2.6 : 2}" stroke-linecap="round" ${done ? '' : 'stroke-dasharray="2 6"'} opacity="${done ? 0.95 : 0.55}"/>`;
    }
    // towns
    let towns = '';
    for (const t of ['albany', 'rochester', 'lockport', 'buffalo']) {
      const x = X(t), y = Y(x);
      const anchor = t === 'buffalo' ? 'start' : t === 'albany' ? 'end' : 'middle';
      const tx = t === 'buffalo' ? Math.max(8, x - 18) : t === 'albany' ? Math.min(W - 8, x + 18) : x;
      towns += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${t === 'rochester' ? 22 : 19}" fill="#f6ebc6" stroke="${INK}" stroke-width="2" opacity=".96"/><g transform="scale(.74)">${ICON[t]}</g></g>`;
      towns += `<text x="${tx.toFixed(1)}" y="${H - 11}" text-anchor="${anchor}" font-family="Special Elite, Courier New, monospace" font-size="${narrow ? 11 : 13}" letter-spacing="${narrow ? 0.5 : 1.2}" fill="${INK2}">${NAME[t].toUpperCase()}</text>`;
      towns += `<path d="M${x.toFixed(1)} ${(y + 22).toFixed(1)}V${H - 26}" stroke="${INK}" stroke-width="1.4" stroke-dasharray="2 4" opacity=".55"/>`;
    }
    // the medallions (drawn in svg; the hit areas are real buttons below)
    let meds = '';
    for (const p of pos) {
      const r = 17;
      const cx = p.x.toFixed(1), cy = p.y.toFixed(1);
      if (p.state === 'closed') {
        meds += `<g transform="translate(${cx} ${cy})"><circle r="${r + 2}" fill="rgba(60,35,8,.25)" transform="translate(0 3)"/><circle r="${r}" fill="#f2c64f" stroke="#8a6418" stroke-width="2.6"/><circle r="${r - 5}" fill="none" stroke="#8a6418" stroke-width="1.2" opacity=".6"/><text y="6.5" text-anchor="middle" font-family="Alfa Slab One, Georgia, serif" font-size="17" fill="#5a3c06">${p.no}</text>
          <g transform="translate(11 11) rotate(-12)"><circle r="9" fill="#fbf3dc" stroke="#d8423b" stroke-width="2.2"/><circle r="6.4" fill="none" stroke="#d8423b" stroke-width="1"/><path d="M-3.4 .4l2.4 2.6 4.6-5.6" fill="none" stroke="#d8423b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
      } else if (p.state === 'now') {
        meds += `<g transform="translate(${cx} ${cy})"><circle class="rm-pulse" r="${r + 5}" fill="none" stroke="#2fd1c0" stroke-width="3"/><circle r="${r + 3}" fill="rgba(47,209,192,.28)"/><circle r="${r}" fill="#2fd1c0" stroke="#12766c" stroke-width="2.8"/><text y="6.5" text-anchor="middle" font-family="Alfa Slab One, Georgia, serif" font-size="17" fill="#032a27">${p.no}</text></g>`;
      } else if (p.state === 'open') {
        meds += `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#fbf3dc" stroke="#12766c" stroke-width="2.8"/><text y="6.5" text-anchor="middle" font-family="Alfa Slab One, Georgia, serif" font-size="17" fill="#12766c">${p.no}</text></g>`;
      } else {
        meds += `<g transform="translate(${cx} ${cy})" opacity=".62"><circle r="${r}" fill="rgba(236,214,162,.6)" stroke="#a9935a" stroke-width="2.2" stroke-dasharray="4 4"/><g transform="translate(0 1)" fill="#8a7740"><rect x="-5" y="-1" width="10" height="8" rx="1.6"/><path d="M-3 -1v-3a3 3 0 0 1 6 0v3" fill="none" stroke="#8a7740" stroke-width="2"/></g></g>`;
      }
    }
    // the little packet boat (not under calm motion)
    const boat = reduced ? '' : `<g><path d="M-14 0h28l-3 6h-22z" fill="${INK2}"/><rect x="-8" y="-6" width="16" height="6" rx="1" fill="${INK}"/><rect x="-5" y="-4.5" width="3" height="3" fill="#ffe27a"/><rect x="1" y="-4.5" width="3" height="3" fill="#ffe27a"/><animateMotion dur="38s" repeatCount="indefinite" rotate="0" path="${d.replace(/L/g, ' L')}"/></g>`;
    el.innerHTML = `<svg class="rm-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="#f1e1b4" stroke="${INK}" stroke-width="2.4"/>
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="7" fill="none" stroke="#c8a964" stroke-width="1.4" stroke-dasharray="3 5"/>
      <text x="16" y="25" font-family="Special Elite, Courier New, monospace" font-size="${narrow ? 11.5 : 12.5}" letter-spacing="1.6" fill="${INK}">THE ERIE CANAL</text>
      <text x="${W - 16}" y="25" text-anchor="end" font-family="Special Elite, Courier New, monospace" font-size="${narrow ? 11 : 12}" letter-spacing="1.2" fill="#7a6330">${narrow ? '5 CASES' : 'ALBANY TO BUFFALO · 5 CASES'}</text>
      <path d="${d}" fill="none" stroke="#2a6f93" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#4aa3c8" stroke-width="12.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#a9dcee" stroke-width="2.4" stroke-dasharray="1 11" stroke-linecap="round" opacity=".85"/>
      <path d="${d}" fill="none" stroke="#8a6a3a" stroke-width="2" stroke-dasharray="7 6" transform="translate(0 13)" opacity=".7"/>
      ${boat}${str}${towns}${meds}
    </svg>`;
    // the hit areas: real buttons, 44px at least
    for (const p of pos) {
      const closed = p.state === 'closed', sealed = p.state === 'sealed';
      const label = sealed ? `Case ${p.no}, arrives later` : closed ? `Case ${p.no}, ${p.title}, case closed` : p.state === 'now' ? `Case ${p.no}, ${p.title}, your next case` : `Case ${p.no}, ${p.title}`;
      const b = document.createElement(sealed ? 'span' : 'button');
      b.className = `rm-stop ${p.state}`;
      b.dataset.stop = p.id; b.dataset.state = p.state;
      b.style.left = `${(p.x - 24).toFixed(1)}px`; b.style.top = `${(p.y - 24).toFixed(1)}px`;
      b.setAttribute('aria-label', label);
      if (!sealed) { b.type = 'button'; b.dataset.sfx = ''; b.addEventListener('click', () => onOpen(p.id)); }
      el.append(b);
    }
    el.style.height = `${H}px`;
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const w = Math.round(el.getBoundingClientRect().width);
    if (w >= 200 && Math.abs(w - lastW) > 3) { lastW = w; draw(w); }
  }) : null;
  if (ro) ro.observe(el); else draw(340);
  el.destroy = () => { if (ro) ro.disconnect(); };
  return el;
}
