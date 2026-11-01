// What the dog brings back (SPEC v1.4 §1.1-§1.2, §5.5): the find pop and the journal's "Finds" page.
//   createFindPop(root, { sfx, hold, waitFor })  a find / a wish pops near the top like a trail card (the card pop's look):
//                                                the picture, the name, its line (and a "New!" ribbon on a first find). Several
//                                                queue up. A pop waits, unseen, while a panel, card or question is open (hold),
//                                                and while a card or deed pop is on screen (waitFor); `live: true` (the wishes
//                                                made during the falling stars) shows at once.
//   findsPage(app)                               the journal page: the dog's sketchbook (nine drawings, faint until found,
//                                                "found 3 times"; the arrowhead is drawn and "left where it lay"), the treat jar,
//                                                the wishes, and the quests of the trail (one line each).
// This module only draws; the journey (J.finds, J.dog.treats, J.wishes, J.quests) keeps the data.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { FINDS, WISH_BY_ID } from '../content/finds.js';
import { QUEST_BY_ID } from '../content/quests.js';
import { LEG_BY_ID } from '../content/legs.js';

export const FIND_POP_MS = 3200;
export const WISH_POP_MS = 1700;
/** The words a find is read in. */
export const findLine = (f) => (f ? f.say || f.text || f.name || '' : '');
const stopName = (id) => { const l = LEG_BY_ID[id]; return l ? (l.stop && l.stop.name) || l.name : ''; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The pop: items { emoji, name, text, say, first, live, id } queue up and show one at a time (pointer-events none). */
export function createFindPop(root, { sfx = null, hold = () => false, waitFor = () => false, say = null } = {}) {
  const queue = [];
  const log = [];
  let showing = false, visible = false, timer = 0, current = null;       // showing: something is queued or up; visible: a pop is drawn this moment
  function next() {
    timer = 0;
    visible = false;
    const it = queue[0];
    if (!it) { showing = false; root.hidden = true; root.replaceChildren(); return; }
    showing = true;
    if (!it.live && waitFor()) { root.hidden = true; root.replaceChildren(); timer = setTimeout(next, 300); return; }          // a card or a deed is popping in the same place: it goes first (the find before this one is gone from the screen meanwhile)
    root.hidden = false;
    root.replaceChildren(h('div', { class: 'fpop-card' + (it.first ? ' new' : '') + (it.live ? ' live' : ''), 'data-find': it.id || '' },
      h('span', { class: 'fpop-emoji', 'aria-hidden': 'true' }, it.emoji || '🐾'),
      h('span', { class: 'fpop-text' },
        it.first ? h('span', { class: 'fpop-label' }, 'New!') : null,
        h('span', { class: 'fpop-name' }, it.name),
        it.text ? h('span', { class: 'fpop-line' }, it.text) : null)));
    if (!it.live) {
      // a panel, card or question is open, or the pop would sit on text or a button: it waits, unseen, and comes out when clear
      root.style.visibility = 'hidden';
      const held = hold(root);
      root.style.visibility = '';
      if (held) { root.hidden = true; root.replaceChildren(); timer = setTimeout(next, 300); return; }
    }
    queue.shift();
    visible = true; current = it;
    if (sfx && sfx.chime && !it.quiet) { try { sfx.chime(); } catch (_) { /* ignore */ } }
    if (it.say && say) { try { say(it.say); } catch (_) { /* ignore */ } }              // (its line is read when the pop is SHOWN, behind whatever is playing)
    timer = setTimeout(next, it.ms || (it.live ? WISH_POP_MS : FIND_POP_MS));
  }
  return {
    /** { emoji, name, text, say, first, live, quiet, id, ms } */
    pop(item) {
      if (!item || !item.name) return;
      log.push(item.id || item.name);
      queue.push(item);
      if (!showing) next();
    },
    /** A card, a bar or a bait row has just opened over the place this pop is drawn: it steps aside (back to the front of the queue, unseen) and comes out again when clear. */
    suspend() {
      if (!visible || !current || current.live) return;
      if (timer) clearTimeout(timer);
      queue.unshift({ ...current, quiet: true, say: '' });
      visible = false; current = null; root.hidden = true; root.replaceChildren();
      timer = setTimeout(next, 300);
    },
    clear() { queue.length = 0; if (timer) clearTimeout(timer); timer = 0; showing = false; visible = false; root.hidden = true; root.replaceChildren(); },
    get showing() { return showing; },
    /** A pop is on screen right now (what a card's pop and a deed's pop step aside for: never a pop that is only waiting its turn). */
    get visible() { return visible; },
    get log() { return log.slice(); },
  };
}

/** The quest lines of the journal: one per quest, "The missing locket: given back to Molly at Fort Laramie". */
export function questLines(app) {
  const J = app.save.journey;
  const JA = (app.v2 && app.v2.JA) || {};
  if (!J) return [];
  const done = new Set(Array.isArray(J.questsDone) ? J.questsDone : []);
  let rows = [];
  try { if (typeof JA.questStatus === 'function') rows = JA.questStatus(J) || []; } catch (_) { rows = []; }
  const seen = new Set();
  const out = [];
  const owner = (q) => (q ? `${q.owner.person.name} at ${stopName(q.owner.at)}` : '');
  for (const r of rows) {
    const q = QUEST_BY_ID[r.questId];
    if (!q) continue;
    seen.add(q.id);
    if (r.state === 'returned' || (r.state === 'none' && done.has(q.id))) out.push({ id: q.id, state: 'returned', text: `${q.name}: given back to ${owner(q)}` });
    else if (r.state === 'mailed') out.push({ id: q.id, state: 'mailed', text: `${q.name}: sent ahead to ${owner(q)}` });
    else if (r.state === 'carried') {
      const step = q.steps[Math.min(Math.max(0, Number(r.step) || 0), q.steps.length - 1)];
      const heard = Number(r.step) >= q.steps.length;
      out.push({ id: q.id, state: 'carried', text: `${q.name}: carried, ${heard ? `take it to ${owner(q)}` : `a clue at ${stopName(step ? step.at : q.owner.at)}`}` });
    }
  }
  for (const id of done) {
    const q = QUEST_BY_ID[id];
    if (q && !seen.has(id)) out.push({ id, state: 'returned', text: `${q.name}: given back to ${owner(q)}` });
  }
  return out;
}

/** The Journal's "Finds" page. app: { save, say, v2 } */
export function findsPage(app) {
  const J = app.save.journey;
  const finds = (J && J.finds) || {};
  const dog = J && J.dog;
  const got = FINDS.filter((f) => Number(finds[f.id]) > 0).length;
  const out = [h('p', { class: 'jr-note', id: 'finds-total' }, dog || got
    ? `${got} of ${FINDS.length} finds in ${dog ? `${dog.name}'s` : 'the'} sketchbook · the dog sniffs out something new on the trail, and at camp when you play fetch`
    : 'Keep a dog and it will sniff out things on the trail for this sketchbook.')];
  out.push(h('div', { class: 'find-grid', id: 'find-grid' }, ...FINDS.map((f) => {
    const n = Number(finds[f.id]) || 0;
    const have = n > 0;
    const sub = !have ? 'not found yet' : f.keep === 'sketch' ? `sketched ${plural(n, 'time', 'times')} · left where it lay` : `found ${plural(n, 'time', 'times')}`;
    const b = h('button', { class: 'find-tile' + (have ? ' got' : ''), 'data-find': f.id, 'data-n': String(n), 'data-sfx': '', 'aria-label': have ? `${f.name}: ${sub}. Tap to hear it.` : `${f.name}: not found yet` },
      h('span', { class: 'find-emoji', 'aria-hidden': 'true' }, have ? f.emoji : '?'),
      h('span', { class: 'find-name' }, have ? f.name : 'Not found yet'),
      h('span', { class: 'find-sub' }, sub));
    b.addEventListener('click', () => { if (have) app.say(findLine(f)); });
    return b;
  })));
  // the treat jar
  const treats = Math.max(0, Number(dog && dog.treats) || 0);
  const best = Math.max(0, Math.min(1, Number(J && J.treatsBest) || 0));
  out.push(h('section', { class: 'card find-jar', id: 'find-jar', 'data-treats': String(treats) },
    h('span', { class: 'find-jar-emoji', 'aria-hidden': 'true' }, '🫙'),
    h('span', { class: 'find-jar-text' }, h('b', {}, 'The treat jar'),
      h('span', {}, dog ? `${plural(treats, 'treat', 'treats')} earned at fetch${best ? ` · longest throw: ${Math.round(best * 100)} in 100` : ''}` : 'Fetch at camp earns treats. A dog comes first.'))));
  // the wishes
  const wishes = (Array.isArray(J && J.wishes) ? J.wishes : []).map((id) => WISH_BY_ID[id]).filter(Boolean);
  out.push(h('section', { class: 'card find-wishes', id: 'find-wishes', 'data-n': String(wishes.length) },
    h('b', {}, `Wishes on falling stars · ${wishes.length}`),
    wishes.length ? h('div', { class: 'find-wish-list' }, ...wishes.map((w) => h('span', { class: 'find-wish', 'data-wish': w.id }, `🌠 ${w.text}`)))
      : h('p', { class: 'jr-note' }, 'On a clear night at camp, tap a falling star to make a wish.')));
  // the quests
  const lines = questLines(app);
  out.push(h('section', { class: 'card find-quests', id: 'find-quests', 'data-n': String(lines.length) },
    h('b', {}, 'Quests of the trail'),
    lines.length ? h('ul', { class: 'find-quest-list' }, ...lines.map((l) => h('li', { 'data-quest': l.id, 'data-state': l.state }, l.text)))
      : h('p', { class: 'jr-note' }, 'Something shiny may turn up on the trail. Ask the people at the forts.')));
  return out;
}
