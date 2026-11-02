// Small shared helpers (kept apart so the HUD does not load the whole shell).
import { Audio } from '../../../spell-jump/src/audio.js';
export const reducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
/** Play one of Spell Jump's shared sounds by name (a name it does not have is ignored). */
export const sfx = (name) => { try { if (typeof Audio[name] === 'function') Audio[name](); } catch (_) { /* ignore */ } };
export const num = (n) => Math.round(n || 0).toLocaleString('en-US');
