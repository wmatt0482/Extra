// Letters home (SPEC §3): three narrative lines picked from what happened on the leg, then the P.S. with the week's
// three spelling words (each dictated and typed on the spell panel). {stop}, {river}, {width}, {animal}, {name}
// (a companion's name), {food} are filled by src/journey/letters.js. Content stream adds more lines per key.
export const LETTER_OPEN = ['Dear Grandma,', 'Dear Uncle Theo,', 'Dear Miss Carter,', 'Dear everyone back home,'];
export const LETTER_LINES = {
  arrived: ['We made it to {stop} today.', 'Today we reached {stop}. Everyone cheered.'],
  river: ['The {river} was {width}, but we crossed it just fine.'],
  hunt: ['{name} and I went hunting with the bow and brought back supper.'],
  fish: ['We caught fish in a still pool by the trail.'],
  storm: ['A thunderstorm made us stop for a day. We played cards under the wagon cover.'],
  berries: ['We found wild plums and picked {food} pounds of them.'],
  bison: ['A whole herd of bison crossed the trail in front of us.'],
  trade: ['We traded with the {nation} people at a trading post.'],
  tired: ['The trail was hard this week and we are all a little tired.'],
  happy: ['The whole party is in good spirits.'],
  wheel: ['A wheel came off, but {name} fixed it in no time.'],
  mud: ['We got stuck in the mud and everyone had to push.'],
};
export const LETTER_PS = 'P.S. My spelling words this week: {w1}, {w2} and {w3}.';
export const LETTER_CLOSE = ['Love,', 'Your friend,', 'See you in Oregon,'];
