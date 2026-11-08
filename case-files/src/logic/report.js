// The case report sentence (SPEC §4 beat 5, §5 `report.lead`). Pure.
//   frame:  <lead with the answer filled in> because <why>. The clue that proves it is: “<clue>”
//   lead:   an optional per-case string with ONE "___" where the answer goes, e.g. "The waybill was with ___" or "___ moved the lunchbox".
//           No lead: the neutral "The answer is ___".
import { norm } from './answers.js';

export const DEFAULT_LEAD = 'The answer is ___';
export const CLUE_INTRO = 'The clue that proves it is:';

export const leadOf = (kase) => (kase && kase.report && typeof kase.report.lead === 'string' && kase.report.lead.includes('___') ? kase.report.lead.trim() : DEFAULT_LEAD);
/** "The waybill was with ___" -> ['The waybill was with ', ''] (what comes before and after the answer blank) */
export function splitLead(lead) {
  const i = lead.indexOf('___');
  return i < 0 ? [`${lead} `, ''] : [lead.slice(0, i), lead.slice(i + 3)];
}
/** the child's "because" text without the end punctuation (the frame adds its own period) */
export const cleanBecause = (t) => String(t || '').trim().replace(/[\s.!?,;:]+$/, '');
/** The whole sentence as plain text (the Archive file and the Parent Zone): lead + because + the clue */
export function reportText(kase, rec, clueText) {
  const [a, b] = splitLead(leadOf(kase));
  const who = (rec && rec.report && rec.report.who) || '?';
  const because = cleanBecause(rec && rec.report && rec.report.because) || '(nothing written)';
  return `${a}${who}${b} because ${because}. ${CLUE_INTRO} ${clueText ? `“${clueText}”` : '(none)'}`;
}

const STOP = new Set('the a an of to in on at is was were are be it its that this which what who how why when where and or for with as by from his her their he she they i my me we our you your not no do did does has have had so but if then than there here him them out up off into over under too very just said says one'.split(' '));
/** Word chips for the "because" blank: the words of the attached clue, then the case's report keywords (unique, a short list). */
export function wordChips(kase, clueText, max = 14) {
  const seen = new Set(), out = [];
  const add = (w) => {
    const word = String(w).replace(/[^A-Za-z'-]/g, '').replace(/^['-]+|['-]+$/g, '');
    const key = norm(word);
    if (word.length < 3 || !key || STOP.has(word.toLowerCase()) || seen.has(key)) return;
    seen.add(key); out.push(word);
  };
  String(clueText || '').split(/\s+/).forEach(add);
  for (const k of (kase.report && kase.report.keywords) || []) String(k).split(/\s+/).forEach(add);
  return out.slice(0, max);
}
