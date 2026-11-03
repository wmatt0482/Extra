// How a ghost rider is dressed (v1.9, The Lab: lab/SPEC.md §4.2). The engine draws the ghost as a translucent copy of a run;
// a ghost look changes the copy's outline colour, its opacity and the short trail of dots behind it. Pure data, no imports:
// the engine (src/game/engine.js drawGhost) and the Lab looks module (src/meta/labLooks.js) both read it.
//   rim    the outline round the vehicle: a css colour, or 'rainbow' (cycles through `trail`)
//   alpha  the copy's opacity
//   tag    the colour of the name tag above the ghost
//   trail  colours of the dots left behind it (null = none)
export const GHOST_DEFAULT = Object.freeze({ id: 'default', rim: 'rgba(200,230,255,0.9)', alpha: 0.34, tag: '#dfe8ff', trail: null });
export const GHOST_STYLES = Object.freeze({
  ice: Object.freeze({ id: 'ice', rim: 'rgba(150,225,255,0.95)', alpha: 0.4, tag: '#bfeaff', trail: Object.freeze(['#e8f8ff', '#8fd8ff', '#ffffff']) }),
  flame: Object.freeze({ id: 'flame', rim: 'rgba(255,140,40,0.95)', alpha: 0.4, tag: '#ffc27a', trail: Object.freeze(['#ff6a1a', '#ffb02a', '#ffe14a']) }),
  gold: Object.freeze({ id: 'gold', rim: 'rgba(255,215,90,0.95)', alpha: 0.44, tag: '#ffe08a', trail: Object.freeze(['#f2c230', '#fff3a0', '#ffffff']) }),
  rainbow: Object.freeze({ id: 'rainbow', rim: 'rainbow', alpha: 0.42, tag: '#ffffff', trail: Object.freeze(['#ff5d5d', '#ff9f1a', '#ffe14a', '#3ddc84', '#22b8ff', '#8f6bff']) }),
});
export const GHOST_IDS = Object.freeze(Object.keys(GHOST_STYLES));

/** A ghost style from a Lab item id ('tb.ghost.ice'), a short id ('ice') or a style object; the plain ghost for anything else. */
export function ghostStyle(look) {
  if (look && typeof look === 'object') {
    const base = GHOST_STYLES[String(look.id || '')] || GHOST_DEFAULT;
    return { ...base, ...(typeof look.rim === 'string' ? { rim: look.rim } : {}), ...(Number.isFinite(look.alpha) ? { alpha: Math.max(0.1, Math.min(0.8, look.alpha)) } : {}) };
  }
  const id = typeof look === 'string' ? look.replace(/^tb\.ghost\./, '') : '';
  return GHOST_STYLES[id] || GHOST_DEFAULT;
}
