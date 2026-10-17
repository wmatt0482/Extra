// Trail Blazer's extra icons (24×24, stroke = currentColor), next to Spell Jump's set (../spell-jump/src/ui/icons.js).
import { icon as sjIcon } from '../../../spell-jump/src/ui/icons.js';

const S = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const TB_ICONS = {
  tire: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
  trail: S('<path d="M4 20c4-3 2-6 6-8s7-1 9-6"/><path d="M5 9l2-5 2 5zM15 19l2-5 2 5z"/>'),
};
export const icon = (name) => TB_ICONS[name] || sjIcon(name);
export function hydrateAll(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
}
