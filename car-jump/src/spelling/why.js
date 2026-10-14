// "Why this works" (Parent Zone): a plain-text copy of the table in docs/LEARNING-DESIGN.md, so the page works
// offline and has no external links. Keep the two in sync when the design changes.

export const WHY_INTRO = 'Every part of Spell Jump exists because a learning technique has evidence for it. Where the evidence is thin or comes from a different age group, that is noted.';

export const WHY_ROWS = [
  {
    "technique": "Retrieval practice (spell from memory, from audio, never from a visible word)",
    "evidence": "Rated highest-utility learning technique in Dunlosky et al. 2013; a 2018 classroom study found retrieval practice beat rainbow writing for spelling, including 5 weeks later",
    "where": "Every jump starts with a word spoken aloud and spelled from memory. No word is ever on screen while the child spells it."
  },
  {
    "technique": "Spaced (distributed) practice",
    "evidence": "Rated highest-utility in Dunlosky et al. 2013; spaced retrieval helps children's word learning",
    "where": "Leitner boxes with expanding intervals (same session → next day → 2 days → 4 days). A word is \"Mastered\" only after 3 first-try successes on at least 2 different days. Past lists come back 2 and 4 weeks later."
  },
  {
    "technique": "Test-Study-Test (pretest, study only what you missed, retest)",
    "evidence": "About twice as many studies favor test-study-test over study-test (Horn-era and later); Gentry's recommended weekly cycle",
    "where": "New list → a quick Qualifier (pretest). Known words skip ahead; missed words become Focus Words and get most of the practice. Friday Test at the end. Parent report shows pretest vs test."
  },
  {
    "technique": "Immediate self-correction (correct right after each word, child does the fixing)",
    "evidence": "Horn's corrected-test research; later single-case studies found correcting after each word beat correcting after the list",
    "where": "A miss is checked immediately. The child sees which letter positions differ, then fixes it themselves."
  },
  {
    "technique": "Cover-Copy-Compare",
    "evidence": "Established, evidence-based self-management procedure (Joseph et al. 2012 review)",
    "where": "After a miss: Compare (differences marked) → Copy (type it from the model) → Cover (model hidden, type it once more from memory)."
  },
  {
    "technique": "Avoid exposure to misspellings",
    "evidence": "Reading misspellings reduces later spelling accuracy for good and poor spellers, lasting at least a week (Dixon 1997; Brown 1988)",
    "where": "The child's wrong attempt is shown for at most 3 s with differences marked, then cleared. The game never offers wrong spellings as choices (\"pick the right one\" is deliberately absent)."
  },
  {
    "technique": "Simultaneous Oral Spelling (say letter names while writing)",
    "evidence": "Gillingham-Stillman multisensory routine with reported benefits for young and struggling spellers",
    "where": "Each typed letter is spoken by name. After a miss the correct word is spelled aloud letter by letter with the tiles lighting in sync. Letter rings in the air say their letter."
  },
  {
    "technique": "Look-Say-Cover-Write-Check for new words",
    "evidence": "RCT (Year 3) found it as effective as a phonological program on taught words, weaker on transfer",
    "where": "First encounter only: Look (word shown with the pattern chunk highlighted and syllables) → Say → Cover → Write → Check."
  },
  {
    "technique": "Pattern / morphology focus",
    "evidence": "Explicit pattern instruction transfers better to new words than rote routines",
    "where": "Optional \"pattern of the week\" (e.g. ough, -tion) and per-word syllables from the parent; highlighted during Look and Fix steps."
  },
  {
    "technique": "Interleaving",
    "evidence": "Third graders made fewer errors after interleaved vs blocked practice (Klimovich & Richter 2025)",
    "where": "The scheduler mixes patterns and mixes in 20% past-list words; never the same word twice in a row."
  },
  {
    "technique": "Immediate feedback, limited new items per session",
    "evidence": "Feedback beats none; practitioner guidance to introduce only a few new words per session",
    "where": "Instant check on LAUNCH; at most 5 new words per day; a daily mission of about 8 retrievals (8 to 10 minutes of play)."
  },
  {
    "technique": "Intrinsic integration (the learning action is the game action)",
    "evidence": "Children learned more and chose to play 7× longer with intrinsically integrated versions (Habgood & Ainsworth 2011)",
    "where": "Spelling sets the launch power and nitro; letters are the rings; the Friday score sets the Mega Run power. No \"do homework, then play\"."
  }
];

export const WHY_SOURCES = "Dunlosky et al. 2013 (APS); The Learning Scientists 2018 spelling study; Horn 1947 corrected test (via 1978 Iowa guide and later single-case studies); Joseph et al. 2012 CCC review; Dixon 1997 thesis and Brown 1988 (JEP) on misspelling exposure; Gillingham & Stillman SOS (Bradford/Swindon help sheets); Waikato RCT on LSCWC vs phonological strategy; Klimovich & Richter 2025 interleaving; Habgood & Ainsworth 2011 intrinsic integration; Gentry on test-study-test.";
