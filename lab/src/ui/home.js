// Home (lab/SPEC.md §5.2): the room with the child's avatar and pet, today's quests in a small card, the crate, the family goal, and the
// welcome strip the first time. It reads in the present tense: what you have, what is new today, never what you missed.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { LAB_LINES } from '../core/view.js';
import { glyph, gameBadge } from './glyph.js';
import { HOT, ROOM_H, ROOM_W, paintRoom } from './scene.js';
import { gameCards } from './gamecards.js';

const pct = (a, b) => `${(a / b) * 100}%`;
const day = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');

/** The freeze that covered a day recently, once: "Your freeze kept your streak!" */
function freezeNote(store, v) {
  try {
    const doc = store.doc();
    const used = [...(doc.streak.shieldUsedDays || []), ...(doc.streak.bonusUsedDays || [])].map(day).filter(Boolean).sort();
    const last = used[used.length - 1];
    if (!last) return false;
    const key = `learningLab.${v.player.id}.freezeSeen`;
    let seen = ''; try { seen = localStorage.getItem(key) || ''; } catch (_) { /* ignore */ }
    if (seen >= last) return false;
    const age = (store.now() - new Date(`${last}T12:00:00`).getTime()) / 86400000;
    if (age > 4) { try { localStorage.setItem(key, last); } catch (_) { /* ignore */ } return false; }
    try { localStorage.setItem(key, last); } catch (_) { /* ignore */ }
    return true;
  } catch (_) { return false; }
}

export function mountHome(ctx) {
  const { store } = ctx;
  let t0 = performance.now(), hop = 0, hopAt = 0, cheerUntil = 0, raf = 0, dead = false, freezeShown = false, welcomeShown = false;
  const cv = h('canvas', { class: 'lab-room-cv', width: ROOM_W * Math.min(2, window.devicePixelRatio || 1), height: ROOM_H * Math.min(2, window.devicePixelRatio || 1), 'aria-hidden': 'true' });
  const spot = (id, label, onClick) => {
    const [x, y, w, hh] = HOT[id];
    const b = h('button', { class: `lab-hot lab-hot-${id}`, type: 'button', 'aria-label': label, style: { left: pct(x, ROOM_W), top: pct(y, ROOM_H), width: pct(w, ROOM_W), height: pct(hh, ROOM_H) } });
    b.addEventListener('click', onClick); return b;
  };
  const petBtn = spot('pet', 'Pet your pet', () => { hopAt = performance.now(); ctx.sfx('correct'); const v = store.view(); if (v) ctx.later(v.pet.name); });
  const room = h('div', { class: 'lab-room' }, cv, spot('gallery', 'Open the gallery', () => ctx.go('gallery')), spot('avatar', 'Change how I look', () => ctx.go('me')), petBtn);
  const notes = h('div', { class: 'lab-notes' });
  const today = h('section', { class: 'lab-card lab-today', 'aria-label': 'Today' });
  const gamesSec = h('section', { class: 'lab-games-sec', 'aria-label': 'Your games' });
  const wrap = h('div', { class: 'lab-home' }, notes, room, today, gamesSec);

  function note(text, kind) {
    const n = h('div', { class: `lab-note ${kind || ''}`, role: 'status' }, h('span', { class: 'lab-note-ic', html: glyph(kind === 'freeze' ? 'shield' : 'sparkle') }), h('span', {}, text));
    notes.append(n);
  }
  function renderToday(v) {
    const kids = [h('h3', { class: 'lab-h' }, 'Today')];
    if (v.opts.quests !== false && v.quests.length) {
      const list = h('ul', { class: 'lab-mini-quests' });
      for (const q of v.quests) {
        const li = h('li', { class: 'lab-mq' + (q.done ? ' done' : '') },
          h('span', { html: gameBadge(q.game, 24) }), h('span', { class: 'lab-mq-tx' }, q.text),
          q.done ? h('span', { class: 'lab-check', html: glyph('check'), 'aria-label': 'Done' }) : h('span', { class: 'lab-mq-n' }, `${q.progress}/${q.target}`));
        list.append(li);
      }
      const go = h('button', { class: 'lab-btn lab-btn-sm', type: 'button', id: 'home-quests' }, 'See quests');
      go.addEventListener('click', () => ctx.go('quests'));
      kids.push(list);
      if (v.crates.waiting > 0) {
        const cb = h('button', { class: 'lab-btn lab-btn-gold', type: 'button', id: 'home-crate' }, h('span', { html: glyph('crate') }), `${LAB_LINES.crate} Open it`);
        cb.addEventListener('click', () => ctx.go('crate'));
        kids.push(cb);
      } else kids.push(h('div', { class: 'lab-pips', 'aria-label': `${v.questsDone} of ${v.quests.length} quests done` }, ...v.quests.map((q) => h('i', { class: q.done ? 'on' : '' })), h('span', {}, `${v.questsDone} of ${v.quests.length} for a crate`)), go);
    }
    if (v.streak.count === 0 && v.streak.best > 0) kids.push(h('div', { class: 'lab-small' }, `Best streak ${v.streak.best} · ${LAB_LINES.dayOne}`));
    if (v.opts.goal !== false) {
      const fam = store.family();
      if (fam && fam.goal) {
        const g = fam.goal, p = g.target ? Math.min(100, Math.round((100 * g.progress) / g.target)) : 0;
        const gb = h('button', { class: 'lab-goalmini', type: 'button', id: 'home-goal' }, h('span', { class: 'lab-goal-tx' }, g.text), h('span', { class: 'lab-bar' }, h('i', { style: { width: `${p}%` } })), h('span', { class: 'lab-goal-n' }, `${ctx.num(g.progress)} / ${ctx.num(g.target)}`));
        gb.addEventListener('click', () => ctx.go('family'));
        kids.push(gb);
      }
    }
    today.replaceChildren(...kids);
  }
  // six progress cards: one per game, what the child has done there and what is waiting; a game not played yet says "Try it"
  function renderGames(v) {
    gamesSec.replaceChildren(h('h3', { class: 'lab-h' }, 'Your games'), gameCards(v.games || [], { link: true }));
  }

  function frame(now) {
    raf = 0; if (dead) return;
    const v = store.view(); if (!v) return;
    const t = (now - t0) / 1000;
    const hp = hopAt ? (now - hopAt) / 520 : 1;
    if (hopAt && hp >= 1) hopAt = 0;
    const c = cv.getContext('2d');
    const d = cv.width / ROOM_W;
    c.setTransform(d, 0, 0, d, 0, 0);
    paintRoom(c, { view: v, t: ctx.reduced ? 0 : t, hop: hopAt ? hp : 0, hour: new Date(store.now()).getHours(), cheer: now < cheerUntil });
    if (!ctx.reduced && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };

  const off = store.subscribe((e) => {
    if (e.type === 'report' && e.receipt && ((e.receipt.quests || []).some((q) => q.justDone) || (e.receipt.level && e.receipt.level.up))) cheerUntil = performance.now() + 2600;
    kick();
  });
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  function update() {
    const v = store.view(); if (!v) return;
    if (v.welcome && !welcomeShown) {
      welcomeShown = true;
      note(LAB_LINES.welcome, 'welcome');
      ctx.later(LAB_LINES.welcome);
      store.markWelcome();
    }
    if (!freezeShown && freezeNote(store, v)) { freezeShown = true; note(LAB_LINES.freeze, 'freeze'); ctx.later(LAB_LINES.freeze); }
    renderToday(v);
    renderGames(v);
    kick();
  }
  update();
  return { el: wrap, update, destroy() { dead = true; cancelAnimationFrame(raf); off(); document.removeEventListener('visibilitychange', onVis); } };
}
