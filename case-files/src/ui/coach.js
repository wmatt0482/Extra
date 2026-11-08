// The step coach (v0.1.2): a card for each step of a case and one for the agency home. It opens by itself the first time a player
// reaches the step (any case; the "seen" state is in the player's synced save: save.seenHelp) and again whenever the "?" help button
// is tapped. Voiced by the Chief or the partner (the natural voice or silence), drawn by the shared modal.
import { COACH, coachLines } from '../logic/coach.js';
import { COACH_ART } from './coachArt.js';

export function createCoach(app, modal) {
  const spec = (key) => {
    const c = COACH[key];
    return { id: `coach-${key}`, kind: 'coach', who: c.who, tab: c.tab, title: c.title, art: COACH_ART[key], lines: coachLines(key, app.readModeNow ? app.readModeNow() : 'auto'), button: 'Got it' };
  };
  return {
    /** The help button: show this step's card (every time). */
    show(key) { if (COACH[key] && !modal.has(`coach-${key}`)) modal.show(spec(key)); },
    /** First time at this step? Show its card and remember it. true when it was shown. */
    auto(key) {
      const seen = app.save.seenHelp || (app.save.seenHelp = {});
      if (!COACH[key] || seen[key] || modal.has(`coach-${key}`)) return false;
      seen[key] = true; app.persist();
      modal.show(spec(key));
      return true;
    },
    seen: (key) => !!(app.save.seenHelp && app.save.seenHelp[key]),
  };
}
