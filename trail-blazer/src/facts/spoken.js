// Spoken forms for the facts (SPEC §4): numbers as words ("fifty-six", "one hundred eight", "one thousand two
// hundred"), the operators as words. The voice reads plain sentences ("seven times eight.", "fifty-six."), which are
// also the natural voice's clip texts (Spell Jump's /api/tts/prepare).

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0..999999 as words: 56 → "fifty-six", 108 → "one hundred eight", 1200 → "one thousand two hundred". */
export function numberWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  if (n < 1000000) return numberWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberWords(n % 1000) : '');
  return String(n);
}

export const OP_WORDS = { x: 'times', '/': 'divided by', '+': 'plus', '-': 'minus' };

/** Text with symbols ("10 × 7 is 70, take away 7") as the voice should say it: numbers and operators as words. */
export function spokenText(text) {
  return String(text || '')
    .replace(/(\d+)\s*×\s*\?/g, (m, a) => `${numberWords(a)} times what`)
    .replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/[−–]/g, ' minus ').replace(/\+/g, ' plus ').replace(/=/g, ' equals ')
    .replace(/\d+/g, (d) => numberWords(d))
    .replace(/\s+/g, ' ').replace(/\s+([,.:!?])/g, '$1').trim();
}
