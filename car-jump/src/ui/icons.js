// Inline SVG icon set (24×24, stroke = currentColor). No image files.
const S = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const F = (body) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  left: F('<path d="M16.5 4.5v15L5 12z"/>'),
  right: F('<path d="M7.5 4.5v15L19 12z"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  pause: F('<rect x="5.5" y="4.5" width="4.5" height="15" rx="1.3"/><rect x="14" y="4.5" width="4.5" height="15" rx="1.3"/>'),
  play: F('<path d="M7 4.5v15L19.5 12z"/>'),
  calendar: S('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 14.5l2 2 4-4" stroke-width="2.2"/>'),
  target: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  trophy: S('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8 20h8M9.5 17h5"/>'),
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>'),
  engine: S('<path d="M4 9h3l2-2h5l2 2h2v2h2v4h-2v2h-3l-2 2H8l-2-2H4z"/><path d="M11.5 10l-2 3h3l-2 3" stroke-width="2"/>'),
  nitro: S('<path d="M12 2.5c3 4 5.5 6.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2 1-3.5 2-4.5.5 1.5 1.5 2.5 2.5 2.5C10 8 11 5 12 2.5z"/>'),
  flame: F('<path d="M12 2c3.4 4.3 6.2 7 6.2 11.2A6.2 6.2 0 0 1 5.8 13.2c0-2.3 1.1-4 2.3-5.1.5 1.8 1.6 2.8 2.8 2.8C10.2 7.6 11 4.8 12 2z"/>'),
  spring: S('<path d="M5 3h14M5 21h14M7 6l10 2.5L7 11l10 2.5L7 16l10 2.5"/>'),
  coin: S('<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.5 0-2.5.8-2.5 1.9 0 2.8 5.4 1.4 5.4 4.2 0 1.1-1.1 1.9-2.7 1.9-1.2 0-2.2-.5-2.8-1.3M12 6.5V8M12 16v1.5" stroke-width="2"/>'),
  flag: S('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  speed: S('<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4.5-4.5"/><circle cx="12" cy="13" r="1.3" fill="currentColor"/>'),
  flip: S('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>'),
  air: S('<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>'),
  smash: S('<path d="M12 2.5l1.8 5.2 5.2-2.2-2.6 5 5.1 2.1-5.4 1.4 1.6 5.5-4.7-3.4-3 4.8-.6-5.6-5.6.5 4-4L3.5 8l5.4.5z"/>'),
  land: S('<path d="M12 3v11M7.5 9.5L12 14l4.5-4.5M3 20h18"/>'),
  cash: S('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  wrench: S('<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L12 17.8a2.4 2.4 0 1 1-3.4-3.4L16 7a4 4 0 0 0-1.5-1.5zM20 4l-3 3"/>'),
  retry: S('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>'),
  check: S('<path d="M4.5 12.5l5 5 10-11"/>'),
  star: F('<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>'),
  sound: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  boom: F('<path d="M12 1.8l2 5.4 4.6-3.2-1.4 5.5 5.6.3-4.4 3.6 4.1 3.9-5.6-.3.6 5.6L13 19l-3 4-.7-5.6-5.5 1.6 3-4.8L1.6 12l5.4-1.6L4.6 5.4l5.2 2.2z"/>'),
  ring: S('<ellipse cx="12" cy="12" rx="6" ry="9"/><ellipse cx="12" cy="12" rx="2.6" ry="5.4" stroke-width="2"/>'),
  rocket: S('<path d="M12 2.5c3.5 2.5 5 6.5 4 11.5H8c-1-5 .5-9 4-11.5z"/><circle cx="12" cy="9" r="1.6"/><path d="M8 14l-3 3.5 3.2.3M16 14l3 3.5-3.2.3M10.5 17.5L12 21.5l1.5-4"/>'),
  medal: S('<path d="M8 2.5l4 6 4-6M5.5 2.5h5M13.5 2.5h5"/><circle cx="12" cy="15" r="6"/><path d="M12 12l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke-width="1"/>'),
  music: S('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>'),
};

export const COIN = `<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12.8" r="10" fill="#b98200"/><circle cx="12" cy="11.2" r="10" fill="#ffcf1a"/><circle cx="12" cy="11.2" r="7" fill="none" stroke="#e7a800" stroke-width="2"/><path d="M12 6.8v8.8M14.3 8.6c-.5-.6-1.3-.9-2.3-.9-1.3 0-2.2.7-2.2 1.6 0 2.3 4.6 1.2 4.6 3.5 0 .9-1 1.6-2.4 1.6-1 0-1.9-.4-2.4-1" stroke="#8a5d00" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;

export function icon(name) {
  return ICONS[name] || '';
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.firstChild) el.innerHTML = icon(el.dataset.icon);
  });
}
