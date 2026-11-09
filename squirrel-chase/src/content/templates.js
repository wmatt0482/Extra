// Fallback hideout password sentences, for when the child's list words have no sentences of their own (SPEC §4).
// Each `{w}` slot takes one list word, in order. `slots[i]` says what slot i needs:
//   'noun' – the slot sits after "the", so it reads right only with a noun (dog, planet, kitchen);
//   'any'  – the slot is inside quotation marks, so any word works (because, quickly, beautiful).
// The app fills noun slots only with words it knows are nouns (for example words whose own list sentence uses them
// after a/an/the); otherwise it picks a template whose slots are all 'any'. Capitals and punctuation are forgiven when
// the child types it, so the quotation marks cost nothing.
export const HIDEOUT_TEMPLATES = [
  { id: 't01', text: 'Glint hid the {w} next to the {w}.', slots: ['noun', 'noun'] },
  { id: 't02', text: 'Scrabble wrote "{w}" and "{w}" on a leaf.', slots: ['any', 'any'] },
  { id: 't03', text: 'The goat looked at the {w} and the {w} and smiled.', slots: ['noun', 'noun'] },
  { id: 't04', text: 'Our secret words are "{w}," "{w}," and "{w}."', slots: ['any', 'any', 'any'] },
  { id: 't05', text: 'Snoozy took a nap on the {w} near the {w}.', slots: ['noun', 'noun'] },
  { id: 't06', text: 'Sudsy washed the {w}, the {w}, and the {w}.', slots: ['noun', 'noun', 'noun'] },
  { id: 't07', text: 'Pip found a note that said "{w}" under the {w}.', slots: ['any', 'noun'] },
  { id: 't08', text: 'The map shows the {w} beside the {w}.', slots: ['noun', 'noun'] },
  { id: 't09', text: 'Mr. Wen spelled "{w}" and then "{w}" for us.', slots: ['any', 'any'] },
  { id: 't10', text: 'Under the {w}, the gang left a sign that said "{w}."', slots: ['noun', 'any'] },
];
