// The Lab's UI entry (lab/SPEC.md §6.1), lazy-loaded by the facade (lab/src/index.js) and by the /lab/ page. Exports the contract:
// installStyles(), mountHud(host, store, { game, compact }), mountResults(host, store, { game }),
// mountChip(host, store, opts), mountPickerButton(host, store, opts), openGames(store, opts),
// openOverlay(store, { view, game, unlocked, onClose }), renderPage(root, store, { sync }).
import { CSS } from './styles.js';

let styled = false;
/** Put the Lab's stylesheet on the page once (a <style> element, so it works offline and needs no extra request). */
export function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'lab-styles';
  st.textContent = CSS;
  document.head.appendChild(st);
}

export { mountHud } from './hud.js';
export { mountChip, mountPickerButton } from './chip.js';
export { openGames } from './games.js';
export { mountResults } from './results.js';
export { openOverlay } from './overlay.js';
export { renderPage } from './page.js';
