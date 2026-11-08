// The step coach (v0.1.2): one short card per step of a case, plus one for the agency home. Each is voiced by the Chief or the
// partner, shown the first time a player reaches the step (any case) and again from the "?" help button. Pure data + pure
// functions, so the screens and the voice preparation (src/meta/voiceTexts.js) can never disagree about the words.
// Kid language (grade 3-4), encouraging, detective-flavored, 2-3 short sentences. Kid rules (SPEC §1) hold: nothing here says "wrong".
export const COACH_KEYS = Object.freeze(['home', 'brief', 'read', 'pin', 'order', 'close']);

export const COACH = Object.freeze({
  home: { tab: 'The Agency', title: 'Welcome to the Agency', who: 'chief',
    lines: ['This is your case board, Detective.', 'Tap a case file to open it. A new case arrives each day, and finished cases are kept in the Archive.'] },
  brief: { tab: 'Step 1 · Brief', title: 'Meet the Chief', who: 'chief',
    lines: ['Listen while I tell you about the case.', 'Then learn the case words. Tap each word in its sentence to see what it means.'] },
  read: { tab: 'Step 2 · Read', title: 'Read every document', who: 'partner',
    lines: ['Open the documents on the desk, one at a time.', 'Read slowly and hunt for clues.', 'Tap the speaker to hear a paragraph, or switch on Read it to me.'] },
  pin: { tab: 'Step 3 · Pin', title: 'Pin the proof', who: 'partner',
    lines: ['Read the question in my notebook.', 'Tap the sentence that proves the answer, then tap Pin it.', 'Stuck? The Hint button is always here to help.'] },
  order: { tab: 'Step 4 · Order', title: 'Put the story in order', who: 'partner',
    lines: ['Tap a card, then tap the spot where it belongs.', 'Not sure what came first? Tap Check the documents.'] },
  close: { tab: 'Step 5 · Close', title: 'Close the case', who: 'chief',
    lines: ['Type who or what did it on the keyboard.', 'Attach a pinned clue that proves it.', 'Then finish the case report sentence.'] },
});

/** The spoken / shown lines of a coach card. With "Read it to me" Off (the parent's setting) the speaker sentence is left out. */
export function coachLines(key, readMode = 'auto') {
  const c = COACH[key];
  if (!c) return [];
  return key === 'read' && readMode === 'off' ? c.lines.slice(0, 2) : c.lines.slice();
}
/** Every coach line the voice may say (the Parent Zone's read mode decides the read card). */
export const allCoachLines = (readMode = 'auto') => COACH_KEYS.flatMap((k) => coachLines(k, readMode));
/** The coach card for a case beat ('brief' | 'investigate' | 'pin' | 'rebuild' | 'solve' | 'report'), '' for none. */
export const coachKeyForBeat = (beat) => ({ brief: 'brief', investigate: 'read', pin: 'pin', rebuild: 'order', solve: 'close', report: 'close' }[beat] || '');
