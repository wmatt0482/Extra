// The view model (lab/SPEC.md §3.4 LabView): everything a screen needs, derived from the doc. PURE.
import { ITEMS } from '../data/catalog.js';
import { QUESTS } from '../data/quests.js';
import { DAILY_COIN_CAP } from './events.js';
import { owns, totalXp, wallet } from './model.js';
import { frameFor, levelProgress, petStage, slotOpen, SLOT_LEVEL, titleFor, TITLES } from './xp.js';
import { unopened } from './crate.js';
import { questText, questView } from './quests.js';
import { freezeView, labStreakNow } from './streak.js';
import { equippedIds } from './shop.js';
import { gameCards } from './summary.js';

const AVATAR_SLOTS = ['hat', 'shirt', 'back', 'face', 'aura'];
const PET_SLOTS = ['neck', 'toy', 'hat'];
const worn = (lab, key) => { const e = lab.equipped[key]; return e && e[0] ? e[0] : null; };

/** LabView: { player, coins, level, streak, quests, questsDone, crates, equipped, owned, avatar, pet, home, trophies, gallery, crowns, opts, capped, cap, combo, welcome }. */
export function buildView(lab, ctx, { ready } = {}) {
  const lp = levelProgress(totalXp(lab));
  const level = lp.level;
  const qs = questView(lab, ctx);
  const open = unopened(lab);
  const played = lab.play[ctx.day] && Object.values(lab.play[ctx.day]).some((n) => n > 0);
  const slotsOf = (owner, names) => Object.fromEntries(names.map((s) => [s, { open: slotOpen(level, `${owner}.${s}`), opensAt: SLOT_LEVEL[`${owner}.${s}`] || 1, id: worn(lab, `${owner}.${s}`) }]));
  const equipped = Object.fromEntries(Object.keys(lab.equipped).filter((k) => lab.equipped[k][0]).map((k) => [k, lab.equipped[k][0]]));
  const ownedIds = ITEMS.filter((i) => owns(lab, i.id)).map((i) => i.id).sort();
  const f = freezeView(lab, ctx.now);
  return {
    player: { id: ctx.playerId, name: ctx.name || '', color: ctx.color || '' },
    coins: wallet(lab).coins,
    level: lp,
    streak: { count: labStreakNow(lab, ctx.now), best: lab.streak.best, weeklyReady: f.weeklyReady, bonus: f.bonus },
    quests: qs, questsDone: qs.filter((q) => q.done).length,
    crates: { waiting: open.length, nextKey: open[0] || '' },
    equipped, owned: ownedIds,
    avatar: { frame: frameFor(level), title: titleFor(level), slots: slotsOf('av', AVATAR_SLOTS) },
    pet: { species: lab.pet.species, name: lab.pet.name, stage: petStage(level), mood: played ? 'happy' : 'content', slots: slotsOf('pet', PET_SLOTS) },
    home: {
      wall: worn(lab, 'home.wall'), floor: worn(lab, 'home.floor') || 'home.floor.wood',
      posters: ['home.poster', 'home.poster2'].map((k) => worn(lab, k)).filter(Boolean),
      banners: ownedIds.filter((id) => id.startsWith('home.banner.')), shelf: ownedIds.filter((id) => id.startsWith('home.shelf.')),
    },
    trophies: lab.trophies.slice(), gallery: lab.gallery.slice(), crowns: lab.crowns.slice(), opts: { ...lab.opts },
    capped: lab.coinDay.day === ctx.day && lab.coinDay.n >= DAILY_COIN_CAP,
    cap: { n: lab.coinDay.day === ctx.day ? lab.coinDay.n : 0, max: DAILY_COIN_CAP },
    combo: { count: ctx.session ? ctx.session.combo.count : 0 },
    welcome: lab.seen.welcome === 0 && Object.keys(lab.seen.games).length > 0,
    equippedIds: equippedIds(lab),
    games: gameCards(lab, ctx.now),
  };
}

/** The fixed lines the Lab says (SPEC §1.3, §5.3), here so the natural voice can prepare them with the quests. */
export const LAB_LINES = Object.freeze({
  welcome: 'Welcome to the Lab', crate: 'Lab crate!', newItem: 'New!', cappedToday: "Plenty of coins today. They're all safe; more tomorrow.",
  freeze: 'Your freeze kept your streak!', dayOne: 'Day 1 today', tryDifferent: 'Try something different', nextWeek: 'Next week',
  alreadyHad: (coins) => `You already had it: plus ${coins} coins`, levelUp: (level, title) => `Lab level ${level}, ${title}`,
  gotItem: (name) => `You got the ${name}`, needMore: (n) => `Need ${n} more`,
});

/** Every line the Lab can say that is known before it is said, as the games' voiceTexts modules do (pure, no clock): the quests at every tier
 *  (gentle wording too), the item names, the level titles and the fixed lines. Numbers that depend on play (a goal's target, "Need 120 more",
 *  the coins of a refund) are said just in time, never ahead; their fixed shapes for the common values are included. */
export function collectVoiceTexts() {
  const out = new Set();
  for (const q of QUESTS) for (const n of new Set([q.easy, q.mid, q.hard])) { out.add(questText(q, false, n)); out.add(questText(q, true, n)); }
  for (const i of ITEMS) { out.add(i.name); out.add(LAB_LINES.gotItem(i.name)); }
  for (const [, t] of TITLES) out.add(t);
  for (const v of Object.values(LAB_LINES)) if (typeof v === 'string') out.add(v);
  for (const c of [150, 600, 1500]) out.add(LAB_LINES.alreadyHad(c));
  return [...out];
}
export const voiceTexts = collectVoiceTexts;
