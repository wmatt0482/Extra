// Camp (SPEC v1.1 §3 "Make camp is a real place, not a way out"): the scene's camp backdrop with the party's evening
// choices as big cards: Fishing (the scene's fishing, any time: food), Hunting (the bow, when hunting is on: food and
// a pelt), Quick Draw (a card game of facts with a companion: first to 7), Campfire tales (a lookout or nation story
// read aloud, then a riddle that is a fact in disguise), Rest (a quiet day: the mood goes up). Each one is a day at
// camp (the Journey stream's camp(J, kind)); main.js runs them (app.campActivity). The way out: "Back to the trail"
// (or "On to the results" on an arrival evening) and "Stop for today" (the title; the journey waits). No timers, no
// lives: camp is where a child goes to play a bit more, and the trail never needs it.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { COMPANION_BY_ID } from '../content/companions.js';

export const CAMP_ACTS = Object.freeze([
  { id: 'fish', emoji: '🎣', name: 'Fishing', line: 'Cast a line in the creek: food for the wagon.' },
  { id: 'hunt', emoji: '🏹', name: 'Hunting', line: 'The bow and fresh tracks: food and a pelt.' },
  { id: 'cards', emoji: '🃏', name: 'Quick Draw', line: 'Facts against {who}. First to 7 wins a token.' },
  { id: 'tales', emoji: '🔥', name: 'Campfire tales', line: 'A story by the fire, then a riddle: a token.' },
  { id: 'rest', emoji: '🛌', name: 'Rest', line: 'A quiet day. Everyone feels better.' },
]);

export function createCamp(app) {
  const acts = $('#camp-acts');
  const back = $('#camp-back');
  const stop = $('#camp-stop');
  let ctx = null;      // { context: 'trail' | 'arrival', resolve }
  let busy = false;
  function paint() {
    if (!ctx) return;
    const J = app.save.journey;
    const who = app.campCompanion();
    const name = (COMPANION_BY_ID[who] || { name: 'a friend' }).name;
    $('#camp-title').textContent = ctx.context === 'arrival' ? 'Camp for the night' : 'Camp';
    $('#camp-day').textContent = `Day ${(J && J.day) || 0}`;
    $('#camp-food').textContent = `${Math.round((J && J.food) || 0)} lb food · ${(J && J.tokens) || 0} tokens`;
    const list = CAMP_ACTS.filter((a) => a.id !== 'hunt' || app.settings.hunting !== false);
    acts.replaceChildren(...list.map((a) => {
      const b = h('button', { class: 'card camp-act', 'data-act': a.id, 'data-sfx': '', disabled: busy },
        h('span', { class: 'camp-emoji', 'aria-hidden': 'true' }, a.emoji),
        h('span', { class: 'camp-name' }, a.name),
        h('span', { class: 'camp-line' }, a.line.replace('{who}', name)));
      b.addEventListener('click', async () => {
        if (busy || !ctx) return;
        busy = true; paint();
        try { await app.campActivity(a.id); } finally { busy = false; if (ctx && app.screen === 'camp') paint(); }
      });
      return b;
    }));
    back.querySelector('.bt-label').textContent = ctx.context === 'arrival' ? 'On to the results' : 'Back to the trail';
    back.disabled = busy;
    stop.hidden = ctx.context === 'arrival';
    stop.disabled = busy;
  }
  const leave = (how) => { if (!ctx || busy) return; const c = ctx; ctx = null; c.resolve(how); };
  back.addEventListener('click', () => leave(ctx && ctx.context === 'arrival' ? 'results' : 'trail'));
  stop.addEventListener('click', () => leave('stop'));
  return {
    /** Open camp; resolves 'trail' | 'results' | 'stop' (or null when the app left camp another way). */
    open({ context = 'trail' } = {}) {
      if (ctx) ctx.resolve(null);
      return new Promise((resolve) => { ctx = { context, resolve }; busy = false; app.go('camp'); });
    },
    show() { paint(); },
    hide() {},
    refresh: paint,
    leave() { if (ctx) { const c = ctx; ctx = null; c.resolve(null); } },
    get isOpen() { return !!ctx; },
    get busy() { return busy; },
    get context() { return ctx ? ctx.context : null; },
  };
}
