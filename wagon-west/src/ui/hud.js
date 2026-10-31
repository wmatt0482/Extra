// The trail HUD (SPEC §3 "A day on the trail", §12): over the scene, "Day 23 · Fort Laramie in 41 mi", the food in
// pounds (a calm "food is low: the next stop has more" note, never a countdown), the party's mood faces (happy / fine /
// tired, never a health bar), the two dials the real trail turned on as big segmented buttons (pace: steady / brisk;
// rations: full / plenty / lean) and pause. The dials call back into main.js (onPace / onRations).
// v1.2 (SPEC "v1.2" §1, §4, §5): the food box is a button that opens the Wagon panel (onWagon); a small forecast chip
// beside it (a sun or cloud and "rain soon" / "storm soon" / "snow soon" / "clear skies") from forecast(J); when the
// animals are tired the pace dial shows steady and Brisk is greyed ("the oxen need a rest"); "Ask Eli: how many days?"
// sits between the dials while Eli has a question left this leg (onEli).
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { moodFace } from './title.js';

export const PACES = [['steady', 'Steady'], ['brisk', 'Brisk']];
export const RATIONS = [['full', 'Full'], ['plenty', 'Plenty'], ['lean', 'Lean']];

const SKY = {
  clear: '<circle cx="12" cy="12" r="4.5" fill="#f2b33d"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="#f2b33d" stroke-width="2" stroke-linecap="round"/>',
  rain: '<path d="M7 15a4.2 4.2 0 0 1 .5-8.4A5.2 5.2 0 0 1 17.4 8 3.6 3.6 0 0 1 17 15z" fill="#cfe3ee"/><path d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3" stroke="#5bb8d6" stroke-width="2" stroke-linecap="round"/>',
  storm: '<path d="M7 14a4.2 4.2 0 0 1 .5-8.4A5.2 5.2 0 0 1 17.4 7 3.6 3.6 0 0 1 17 14z" fill="#9aa7b3"/><path d="M12.5 13l-3 5h3l-1.5 4.5 5-6.5h-3l1.5-3z" fill="#f2b33d"/>',
  snow: '<path d="M7 14a4.2 4.2 0 0 1 .5-8.4A5.2 5.2 0 0 1 17.4 7 3.6 3.6 0 0 1 17 14z" fill="#e4ecf2"/><g fill="#fff" stroke="#8fb4cf" stroke-width="1"><circle cx="8" cy="18" r="1.6"/><circle cx="12" cy="20.5" r="1.6"/><circle cx="16" cy="18" r="1.6"/></g>',
};
/** The forecast chip's little picture (inline SVG; a cloud for anything but clear skies). */
export const skyIcon = (kind) => h('span', { class: 'sky', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${SKY[kind] || SKY.clear}</svg>` });

export function createHud({ onPace = () => {}, onRations = () => {}, onWagon = () => {}, onEli = () => {} } = {}) {
  const day = $('#hud-day'), where = $('#hud-where'), food = $('#hud-food'), foodNote = $('#hud-food-note'), faces = $('#hud-faces');
  const paceEl = $('#dial-pace'), rationsEl = $('#dial-rations');
  const foodBox = $('#hud-food-box'), fc = $('#hud-forecast'), eli = $('#btn-eli');
  let lastKey = '', lastFc = '';
  foodBox.addEventListener('click', () => onWagon());
  eli.addEventListener('click', () => onEli());
  function seg(el, list, cur, onPick, name, tiredBrisk = false) {
    el.replaceChildren(...list.map(([id, text]) => {
      const on = id === cur;
      const rest = tiredBrisk && id === 'brisk';
      const b = h('button', { class: 'seg-btn dial-btn' + (on ? ' on' : '') + (rest ? ' rest' : ''), role: 'radio', 'aria-checked': String(on), [`data-${name}`]: id, 'data-sfx': '' }, text);
      if (rest) b.setAttribute('title', 'The animals need a rest');
      b.addEventListener('click', () => { if (id !== cur) onPick(id); });
      return b;
    }));
  }
  return {
    /** J: the journey; leg: the current leg (content); milesDone: the miles shown (animated between days).
     *  forecast: { next, inDays, words } | null · animalsTired: the pace dial shows steady · eli: Ask Eli is offered. */
    update(J, leg, { milesDone = J.milesDone, foodLow = false, forecast = null, animalsTired = false, eli: eliOn = false } = {}) {
      if (!J || !leg) return;
      const left = Math.max(0, Math.round((leg.miles || 0) - milesDone));
      day.textContent = `Day ${J.day || 0}`;
      where.textContent = left > 0 ? `${leg.stop ? leg.stop.name : leg.name} in ${money(left)} mi` : `${leg.stop ? leg.stop.name : leg.name}!`;
      food.textContent = `${money(J.food)} lb`;
      const low = !!foodLow || (J.food || 0) <= 0;
      food.closest('.hud-food').classList.toggle('low', low);
      foodNote.hidden = !low;
      foodNote.textContent = (J.food || 0) <= 0 ? 'Out of food: we go slowly to the next stop' : 'Food is low: the next stop has more';
      foodBox.setAttribute('aria-label', `Food: ${money(J.food)} pounds. Open the wagon.`);
      eli.hidden = !eliOn;
      // the forecast chip (rebuilt only when the sky changes)
      const fkey = forecast ? forecast.next : '';
      if (fkey !== lastFc) {
        lastFc = fkey;
        fc.hidden = !forecast;
        fc.dataset.sky = fkey;
        fc.replaceChildren(...(forecast ? [skyIcon(forecast.next), h('span', { class: 'fc-words', id: 'hud-forecast-words' }, forecast.words)] : []));
        fc.setAttribute('aria-label', forecast ? `The weather ahead: ${forecast.words}` : 'The weather ahead');
      }
      const party = Array.isArray(J.party) && J.party.length ? J.party : (J.companions || []).map((id) => ({ id, mood: J.mood }));
      // rebuilt only when something changed (this runs every frame while the wagon rolls: a button replaced between
      // a finger's press and its click would swallow the tap)
      const pace = animalsTired ? 'steady' : (J.pace || 'steady');
      const key = `${party.map((p) => `${p.id}:${p.mood || J.mood}`).join()}|${pace}|${animalsTired}|${J.rations}`;
      if (key === lastKey) return;
      lastKey = key;
      faces.replaceChildren(...party.map((p) => {
        const c = COMPANION_BY_ID[p.id] || { name: p.id, color: '#d9653b' };
        const f = moodFace(p.mood || J.mood || 'happy', c.color);
        f.setAttribute('title', `${c.name}: ${p.mood || J.mood}`);
        f.dataset.mood = p.mood || J.mood || 'happy';
        return f;
      }));
      faces.setAttribute('aria-label', `The party: ${party.map((p) => `${(COMPANION_BY_ID[p.id] || { name: p.id }).name} ${p.mood || J.mood}`).join(', ')}`);
      seg(paceEl, PACES, pace, onPace, 'pace', animalsTired);
      paceEl.dataset.tired = String(!!animalsTired);
      seg(rationsEl, RATIONS, J.rations || 'plenty', onRations, 'rations');
    },
    /** Forget what was drawn (a new leg, a sync): the next update rebuilds everything. */
    reset() { lastKey = ''; lastFc = '\u0000'; },
  };
}
