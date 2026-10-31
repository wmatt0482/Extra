// Companion skills (SPEC v1.2 §2): every companion in src/content/companions.js has one skill { id, name, text }; the sim
// acts on it (repairs, rivers, camp, food, the forecast, the marker hint, cards) and announces it with
// `skill: { id, name, text, who }` on the result of the call that fired it, so the app can show the companion's card.
// Pure: reads J.companions and the content, changes nothing.
import { COMPANION_BY_ID } from '../content/companions.js';

/** The skill ids (one per companion): the keys the sim and the tests use. */
export const SKILL = {
  forge: 'forge',               // Ada the blacksmith: one breakdown a leg mended without a spare part
  tips: 'tips',                 // Nora the teacher: the strategy hint before the answer, once a leg
  fiddle: 'fiddle',             // Jasper the fiddler: +4 spirit a night at camp, Quick Draw runs slower
  scouting: 'scouting',         // Eli the scout: one more animal spotted a leg, the forecast two days ahead
  cooking: 'good-cooking',      // Rosa the cook: food lasts a tenth longer, berries twice as often
  peppermints: 'peppermints',   // Mabel the doctor: a tired party is rested again in one day
  carpentry: 'carpentry',       // Tomas the carpenter: the float is safe without rope, every second repair needs no part
  tales: 'tales',               // Ines the storyteller: a campfire tale always drops a card, a lookout drops two
};

const companionIds = (J) => (Array.isArray(J && J.companions) ? J.companions : (Array.isArray(J && J.party) ? J.party.map((p) => p.id) : []));

/** The companion in the party who has this skill (a skill id like 'forge', or a companion id like 'blacksmith'), or null. */
export function skillOf(J, id) {
  for (const cid of companionIds(J)) {
    const c = COMPANION_BY_ID[cid];
    if (c && c.skill && (c.skill.id === id || c.id === id)) return cid;
  }
  return null;
}

/** { id, name, text, who } for a skill the party has (who = the companion's id), else null. This is the `skill` the sim
 *  puts on a result when the skill fires. */
export function skillInfo(J, id) {
  const who = skillOf(J, id);
  if (!who) return null;
  const s = COMPANION_BY_ID[who].skill;
  return { id: s.id, name: s.name, text: s.text, who };
}

/** The party's skills as a list of { id, name, text, who } (for the Wagon panel and the Outfit screen). */
export function partySkills(J) {
  return companionIds(J).map((cid) => COMPANION_BY_ID[cid]).filter((c) => c && c.skill).map((c) => ({ id: c.skill.id, name: c.skill.name, text: c.skill.text, who: c.id }));
}
