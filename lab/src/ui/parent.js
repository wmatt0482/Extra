// Grown-ups (lab/SPEC.md §5.3): behind the family PIN (the same PIN as the games; skipped when the game's own Parent Zone just unlocked it).
// The crate odds, the switches for this child (quests and crate, the family board, the family goal), gentle wording, the coin purse and its
// history, what the Lab stores, Reset this child's Lab (a confirm), the sync status line and a short "How the Lab works".
// This file is the ONE place in the Lab with native inputs (the switches); kids never reach it without the PIN.
import { h } from '../../../spell-jump/src/ui/dom.js';
import { checkPin, hasPin, loadFamily, setPin } from '../../../spell-jump/src/spelling/profiles.js';
import { SYNC_KEY } from '../../../spell-jump/src/sync/client.js';
import { crateOddsTable } from '../core/crate.js';
import { wallet, mondayOfWeek } from '../core/model.js';
import { DAILY_COIN_CAP } from '../core/events.js';
import { ITEM_BY_ID } from '../data/catalog.js';
import { glyph } from './glyph.js';
import { gameCards } from './gamecards.js';

const GENTLE_KEY = 'learningLab.gentle';
export const gentleSaved = () => { try { return localStorage.getItem(GENTLE_KEY) === '1'; } catch (_) { return false; } };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekLabel = (wk) => { const d = mondayOfWeek(wk); return `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`; };

export function mountParent(ctx) {
  const { store } = ctx;
  let unlocked = !!ctx.unlocked, mode = 'enter', entry = '', first = '', err = '', confirmReset = false, dead = false, resetDone = false;
  const body = h('div', { class: 'lab-parent' });
  const el = h('div', { class: 'lab-parent-wrap' }, body);

  // ---------- the PIN ----------
  function pad(onDigit, onBack) {
    const g = h('div', { class: 'lab-pinpad' });
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) { const b = h('button', { class: 'lab-btn lab-pin-key', type: 'button', 'data-digit': d }, d); b.addEventListener('click', () => onDigit(d)); g.append(b); }
    const back = h('button', { class: 'lab-btn lab-pin-key', type: 'button', 'aria-label': 'Delete', id: 'pin-back', html: glyph('back') }); back.addEventListener('click', onBack);
    const z = h('button', { class: 'lab-btn lab-pin-key', type: 'button', 'data-digit': '0' }, '0'); z.addEventListener('click', () => onDigit('0'));
    g.append(back, z, h('span'));
    return g;
  }
  function pinView() {
    const f = loadFamily();
    if (mode === 'enter' && !hasPin(f)) mode = 'set';
    const titles = { enter: 'Enter the parent PIN', set: 'Choose a 4-digit PIN', confirm: 'Type the PIN again' };
    const onDigit = (d) => {
      if (entry.length >= 4) return;
      entry += d;
      if (entry.length === 4) { setTimeout(submit, 120); }
      pinView();
    };
    body.replaceChildren(h('div', { class: 'lab-pin-wrap', 'data-pin-mode': mode },
      h('div', { class: 'lab-lock-ic', html: glyph('grownups') }),
      h('h3', { class: 'lab-pin-title', id: 'pin-title' }, titles[mode]),
      mode === 'set' ? h('p', { class: 'lab-small' }, 'Grown-ups only: this is the same PIN as in the games.') : null,
      h('div', { class: 'lab-pin-dots', 'aria-label': `${entry.length} of 4 digits` }, ...[0, 1, 2, 3].map((i) => h('i', { class: i < entry.length ? 'on' : '' }))),
      err ? h('div', { class: 'lab-pin-err', id: 'pin-err', role: 'status' }, err) : null,
      pad(onDigit, () => { entry = entry.slice(0, -1); pinView(); }),
      mode === 'enter' ? h('p', { class: 'lab-small' }, 'Forgot it? Open Parents in Spell Jump to set a new one.') : null));
  }
  function submit() {
    const pin = entry; entry = ''; err = '';
    const f = loadFamily();
    if (mode === 'enter') { if (checkPin(f, pin)) { unlocked = true; render(); return; } err = 'That PIN is not right.'; pinView(); return; }
    if (mode === 'set') { first = pin; mode = 'confirm'; pinView(); return; }
    if (pin !== first) { mode = 'set'; err = 'The two PINs did not match. Try again.'; pinView(); return; }
    setPin(f, pin); mode = 'enter'; unlocked = true; render();
  }

  // ---------- the panel ----------
  function sw(label, hint, checked, onChange, id) {
    const input = h('input', { type: 'checkbox', role: 'switch', class: 'lab-switch-in', id, checked: checked ? true : null, 'aria-checked': String(!!checked) });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'lab-switch', for: id }, h('span', { class: 'lab-switch-tx' }, h('b', {}, label), hint ? h('small', {}, hint) : null), input, h('span', { class: 'lab-switch-ui', 'aria-hidden': 'true' }));
  }
  function syncLine() {
    const s = ctx.sync && ctx.sync.status ? ctx.sync.status() : null;
    if (s) return s.synced ? `Family sync is on (code ${s.code}).${s.lastError ? ' It will try again soon.' : ''}` : 'Family sync is off on this device.';
    try { const raw = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); return raw && raw.code ? `Family sync is on (code ${raw.code}).` : 'Family sync is off on this device.'; } catch (_) { return 'Family sync is off on this device.'; }
  }
  function render() {
    if (dead) return;
    if (!unlocked) { pinView(); return; }
    const v = store.view(), doc = store.doc();
    if (!v || !doc) { body.replaceChildren(h('p', { class: 'lab-empty' }, 'Pick a player first.')); return; }
    const odds = crateOddsTable(), w = wallet(doc);
    const weeks = Object.keys(doc.weeks).sort().reverse().slice(0, 6).map((wk) => ({ wk, coins: Object.values(doc.weeks[wk]).reduce((a, d) => a + (d.coins || 0), 0) }));
    const bought = Object.entries(doc.paid).filter(([, p]) => p > 0).sort((a, b) => (doc.owned[b[0]] || 0) - (doc.owned[a[0]] || 0)).slice(0, 12);
    const refunds = Object.entries(doc.crates.opened).filter(([, c]) => c.coins > 0);
    const sec = (title, ...kids) => h('section', { class: 'lab-card lab-psec' }, h('h3', { class: 'lab-h' }, title), ...kids);

    const resetBox = h('div', { class: 'lab-reset' });
    if (resetDone) resetBox.append(h('p', { class: 'lab-note-ok', role: 'status' }, h('span', { html: glyph('check') }), `${v.player.name}'s Lab is fresh.`));
    else if (!confirmReset) {
      const b = h('button', { class: 'lab-btn lab-btn-hot', type: 'button', id: 'reset-start' }, `Reset ${v.player.name}'s Lab`);
      b.addEventListener('click', () => { confirmReset = true; render(); });
      resetBox.append(h('p', { class: 'lab-small' }, 'Starts this child\'s Lab again: Lab coins, level, items, quests and builds. The games are not touched.'), b);
    } else {
      const yes = h('button', { class: 'lab-btn lab-btn-hot', type: 'button', id: 'reset-yes' }, `Yes, reset ${v.player.name}'s Lab`);
      const no = h('button', { class: 'lab-btn', type: 'button', id: 'reset-no' }, 'Keep it');
      yes.addEventListener('click', () => { store.resetMe(); confirmReset = false; resetDone = true; render(); });
      no.addEventListener('click', () => { confirmReset = false; render(); });
      resetBox.append(h('p', { class: 'lab-small' }, 'This starts over for everyone on the family code. Are you sure?'), h('div', { class: 'lab-btn-row' }, yes, no));
    }

    body.replaceChildren(
      h('div', { class: 'lab-parent-head' }, h('span', { html: glyph('grownups') }), h('div', {}, h('h2', {}, 'Grown-ups'), h('p', { class: 'lab-small' }, `Settings for ${v.player.name}. Same family code and PIN as the games.`))),
      sec('Progress at a glance',
        h('p', { class: 'lab-p' }, `What ${v.player.name} has done in each game. Each game sends its own progress here when it is played.`),
        gameCards(v.games || []),
        h('p', { class: 'lab-p lab-familycode', id: 'family-code-line' }, 'Family code: open Parents in any game → Family code')),
      sec('Crate odds',
        h('table', { class: 'lab-odds', id: 'odds-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Rarity'), h('th', {}, 'Chance'))),
          h('tbody', {}, ...odds.rows.map((r) => h('tr', { 'data-rarity': r.id }, h('td', {}, r.name), h('td', {}, `${r.percent} in 100`))))),
        h('p', { class: 'lab-p' }, odds.pity), h('p', { class: 'lab-p' }, odds.duplicates), h('p', { class: 'lab-p' }, odds.note)),
      sec(`Switches for ${v.player.name}`,
        sw('Daily quests and the crate', 'Three quests a day across the games.', v.opts.quests !== false, (on) => store.setOpt('quests', on), 'opt-quests'),
        sw('Family board', 'A crown for the most XP, a star for the biggest step up.', v.opts.board !== false, (on) => store.setOpt('board', on), 'opt-board'),
        sw('Family goal', 'One shared goal a week.', v.opts.goal !== false, (on) => store.setOpt('goal', on), 'opt-goal'),
        sw('Gentle wording', 'Fraction Fright says "Help neighbors home" instead of zapping.', gentleSaved(), (on) => { try { localStorage.setItem(GENTLE_KEY, on ? '1' : '0'); } catch (_) { /* ignore */ } store.gentle(on); }, 'opt-gentle')),
      sec('Lab coins',
        h('div', { class: 'lab-stats' },
          h('div', {}, h('b', { id: 'coins-earned' }, ctx.num(w.earned)), h('span', {}, 'Lab coins earned in all')),
          h('div', {}, h('b', { id: 'coins-spent' }, ctx.num(w.paid)), h('span', {}, 'Lab coins spent in the shop')),
          h('div', {}, h('b', { id: 'coins-now' }, ctx.num(w.coins)), h('span', {}, 'Lab coins in the purse'))),
        h('p', { class: 'lab-p' }, `Lab coins stop at ${ctx.num(DAILY_COIN_CAP)} a day, about three hours of play (today: ${ctx.num(v.cap.n)}). XP, quests and crates carry on. Lab coins are only for the Lab shop and Build Crew blueprints and never change how a game plays. Each game keeps its own money too, with its own name and icon.`),
        h('h4', { class: 'lab-slot-h' }, 'Lab coin history'),
        weeks.length ? h('ul', { class: 'lab-history', id: 'coin-history' }, ...weeks.map((x) => h('li', {}, h('span', {}, `Week of ${weekLabel(x.wk)}`), h('b', {}, `+${ctx.num(x.coins)}`)))) : h('p', { class: 'lab-small' }, 'No Lab coins yet.'),
        bought.length || refunds.length ? h('ul', { class: 'lab-history' }, ...bought.map(([id, p]) => h('li', {}, h('span', {}, `Bought ${(ITEM_BY_ID[id] || { name: id }).name}`), h('b', {}, `-${ctx.num(p)}`))), ...refunds.map(([k, c]) => h('li', {}, h('span', {}, `Crate Lab coins (${k.replace('quest:', 'quests ')})`), h('b', {}, `+${ctx.num(c.coins)}`)))) : null),
      sec('What the Lab keeps',
        h('p', { class: 'lab-p' }, 'Per child: Lab coins and XP, items, quests, the streak, a one-line progress for each game, the family week and finished Build Crew builds (as plain shapes, never pictures). It syncs on the family code like the games and sends nothing else anywhere.')),
      sec('Family sync', h('p', { class: 'lab-p', id: 'sync-line' }, syncLine())),
      sec('How the Lab works',
        h('p', { class: 'lab-p' }, 'Whatever your child plays fills one purse of Lab coins and one level bar. Lab coins show on the results screens, not on every answer. Everything in the shop is a look, never a way past a question, and no game is easier or harder because of it.'),
        h('p', { class: 'lab-p' }, 'Quests that are not finished simply go away the next day. Nothing runs out, and stopping is always fine.')),
      sec('Reset', resetBox));
  }
  render();
  return { el, update() { if (unlocked && !confirmReset) { /* keep inputs steady while the grown-up is on the page */ } }, destroy() { dead = true; } };
}
