// The fixed lines the partner and the Chief say (the authored ones live in each case). One module so the screens and the
// voice preparation (src/meta/voiceTexts.js) can never disagree about the words. Pure. Kid rules (SPEC §1): never "wrong".
export const LINES = Object.freeze({
  checkAgain: 'Good detectives check again.',
  tier2: 'Look in the highlighted part of the document.',
  tier3Tap: 'Now you tap the sentence that proves it.',
  tier3Again: 'Here it is. Tap the glowing sentence, Detective.',
  oneMore: 'That is one. Find the other one.',
  addMore: 'Can you add what the clue shows?',
  moreWords: 'Add a few more words about why.',
  pickClue: 'Pick the clue that proves it.',
  solveTier1: 'Read your pinned clues again. Who do they point to?',
  solveTier2: 'The clues that matter most are glowing on the board.',
  solveTier3: 'Read the glowing clues out loud in your head, then type the name.',
  notThatClue: 'Good detectives check again. Which clue proves it?',
  attach: 'That is the name. Now attach the clue that proves it.',
  writeReport: 'Now write your case report.',
  openDocs: 'Open every document. Read first, then we will pin the proof.',
  seeYou: 'Case closed. See you tomorrow, Detective.',
  allSet: 'Every clue is on the board. Now put the story in order.',
  timelineDone: 'The story is in order. Now close the case.',
  // the feedback popups (v0.1.2): the partner's first line when something does not fit yet. Kind, story-like, never "wrong".
  pinMiss1: "Hmm, that sentence doesn't prove it yet.",
  pinMiss2: "Not that one yet. Let's look closer.",
  pinMiss3: "Let's work this one out together.",
  cardMiss: "Hmm, that card doesn't go there yet.",
  nameMiss: "Hmm, that is not the name yet.",
  noVoice: 'No voice on this device yet. A grown-up can turn on a natural voice.',
  soundOff: 'Sound is off. A grown-up can turn it on in Parents.',
});

const KIND_NAMES = { logbook: 'logbook', letter: 'letter', statement: 'statement', placard: 'placard', newspaper: 'newspaper notice', notice: 'notice', ledger: 'ledger', map: 'map', diary: 'diary', receipt: 'receipt' };
/** "Check the logbook." for a misplaced card (the document its proof sentence lives in). */
export const checkDoc = (kind) => `Check the ${KIND_NAMES[kind] || 'document'}.`;
/** "Toll. Money paid to use a road." (what a pre-taught word says) */
export const wordSpeech = (w) => `${w.word}. ${w.meaning}.`;

/** The DOCUMENT label for a doc kind (the shelf and the tab). */
export const KIND_LABEL = Object.freeze({ logbook: 'Logbook', letter: 'Letter', statement: 'Statement', placard: 'Museum placard', newspaper: 'Newspaper', notice: 'Notice', ledger: 'Ledger', map: 'Map', diary: 'Diary', receipt: 'Receipt' });
