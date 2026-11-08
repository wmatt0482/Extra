// Instant feedback on every checked tap (v0.1.3): the tapped element gets `fb-right` (a gold flash) or `fb-wrong` (a gentle shake, no red X)
// and a soft synthesized sound (a chime / a low "boop", never a buzzer; the sound setting rules because it goes through the game's Audio).
// The classes are styled by style/gameplay.css (and may be restyled by the visuals); they clear themselves after the animation.
export const FB_MS = 700;

/** Flash `el` right or wrong and play the sound. Returns the delay (ms) a popup that follows should wait so the flash is seen. */
export function flash(app, el, ok) {
  try { if (ok) app.audio.correct(true); else app.audio.oops(); } catch (_) { /* sound never breaks a tap */ }
  if (el && el.classList) {
    el.classList.remove('fb-right', 'fb-wrong');
    void el.offsetWidth;                                   // restart the animation on a quick second tap
    el.classList.add(ok ? 'fb-right' : 'fb-wrong');
    setTimeout(() => { if (el) el.classList.remove('fb-right', 'fb-wrong'); }, FB_MS);
  }
  return ok ? 0 : (app.settings && app.settings.reducedMotion ? 250 : 450);
}
