// The trail HUD (SPEC §3 "A day on the trail", §12): over the scene, "Day 23 · Fort Laramie in 41 mi", the food in
// pounds (a calm "food is low: the next stop has more" note, never a countdown), the party's mood faces (happy / fine /
// tired, never a health bar), the two dials the real trail turned on as big segmented buttons (pace: steady / brisk;
// rations: full / plenty / lean) and pause. The dials call back into main.js (onPace / onRations), which asks the
// rations question the first time they change in a leg.
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { COMPANION_BY_ID } from '../content/companions.js';
import { moodFace } from './title.js';

export const PACES = [['steady', 'Steady'], ['brisk', 'Brisk']];
export const RATIONS = [['full', 'Full'], ['plenty', 'Plenty'], ['lean', 'Lean']];

export function createHud({ onPace = () => {}, onRations = () => {} } = {}) {
  const day = $('#hud-day'), where = $('#hud-where'), food = $('#hud-food'), foodNote = $('#hud-food-note'), faces = $('#hud-faces');
  const paceEl = $('#dial-pace'), rationsEl = $('#dial-rations');
  let lastKey = '';
  function seg(el, list, cur, onPick, name) {
    el.replaceChildren(...list.map(([id, text]) => {
      const on = id === cur;
      const b = h('button', { class: 'seg-btn dial-btn' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), [`data-${name}`]: id, 'data-sfx': '' }, text);
      b.addEventListener('click', () => { if (id !== cur) onPick(id); });
      return b;
    }));
  }
  return {
    /** J: the journey; leg: the current leg (content); milesDone: the miles shown (animated between days). */
    update(J, leg, { milesDone = J.milesDone, foodLow = false } = {}) {
      if (!J || !leg) return;
      const left = Math.max(0, Math.round((leg.miles || 0) - milesDone));
      day.textContent = `Day ${J.day || 0}`;
      where.textContent = left > 0 ? `${leg.stop ? leg.stop.name : leg.name} in ${money(left)} mi` : `${leg.stop ? leg.stop.name : leg.name}!`;
      food.textContent = `${money(J.food)} lb`;
      const low = !!foodLow || (J.food || 0) <= 0;
      food.parentElement.classList.toggle('low', low);
      foodNote.hidden = !low;
      foodNote.textContent = (J.food || 0) <= 0 ? 'Out of food: we go slowly to the next stop' : 'Food is low: the next stop has more';
      const party = Array.isArray(J.party) && J.party.length ? J.party : (J.companions || []).map((id) => ({ id, mood: J.mood }));
      // rebuilt only when something changed (this runs every frame while the wagon rolls: a button replaced between
      // a finger's press and its click would swallow the tap)
      const key = `${party.map((p) => `${p.id}:${p.mood || J.mood}`).join()}|${J.pace}|${J.rations}`;
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
      seg(paceEl, PACES, J.pace || 'steady', onPace, 'pace');
      seg(rationsEl, RATIONS, J.rations || 'plenty', onRations, 'rations');
    },
    /** Forget what was drawn (a new leg, a sync): the next update rebuilds everything. */
    reset() { lastKey = ''; },
  };
}
