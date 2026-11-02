// Trail Blazer's extra icons (24×24, stroke = currentColor), next to Spell Jump's set (../spell-jump/src/ui/icons.js).
import { icon as sjIcon } from '../../../spell-jump/src/ui/icons.js';

const S = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const TB_ICONS = {
  tire: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
  grid: S('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>'),
  flask: S('<path d="M9.5 3h5M10.5 3v6.2L5.2 18a2.2 2.2 0 0 0 1.9 3.3h9.8a2.2 2.2 0 0 0 1.9-3.3l-5.3-8.8V3"/><path d="M7.6 15.2h8.8"/>'),
  ghost: S('<path d="M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.4-1.9-2.3 1.9L12 18.6l-2.3 1.9-2.3-1.9z"/><circle cx="9.6" cy="11" r="1" fill="currentColor"/><circle cx="14.4" cy="11" r="1" fill="currentColor"/>'),
  trail: S('<path d="M4 20c4-3 2-6 6-8s7-1 9-6"/><path d="M5 9l2-5 2 5zM15 19l2-5 2 5z"/>'),
};
export const icon = (name) => TB_ICONS[name] || sjIcon(name);
export function hydrateAll(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
}
