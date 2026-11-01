// The side quests (SPEC v1.4 §2.4): the missing locket and Sam's bottle note. One shape serves every quest (the machine is
// journey/quests.js): an item; how it is found (`find.via` 'nose' | 'fish' | 'fetch', on which legs, optionally at a stop);
// clue steps (a person at a stop with two lines; a step whose stop is already behind is skipped, "heard on the way"); an
// owner (a person at a stop); a reward (tokens, an optional food gift, and the card named by `card`); the mailed fallback; and a
// letter key (LETTER_LINES in letters.js). A new quest is one more entry here and nothing else.
//
// The people are invented story people (docs/SOURCES.md, "Side quests: story, not history"): nobody is a real person. Every
// line is spoken as written (no digits). "Lost" is a banned word, so the locket is "missing" and Molly "dropped" it.
// Kid rules (SPEC §1): nobody is hurt, sick or in trouble; a quest can always be finished or mailed ahead.
export const QUESTS = [
  { id: 'locket', name: 'The missing locket', card: 'locket', letter: 'quest-locket',
    item: { id: 'locket', name: 'A silver locket', emoji: '📿',
      text: 'Something shiny in the grass by the river: a little silver locket! Inside is a tiny painting of a smiling grandmother, and two letters: M and R.',
      say: 'Something shiny in the grass by the river: a little silver locket! Inside is a tiny painting of a smiling grandmother, and two letters: M and R.' },
    find: { via: 'nose', legs: ['kansas-river', 'fort-kearny', 'chimney-rock'], atStop: 'kansas-river' },
    steps: [
      { at: 'fort-kearny', person: { id: 'q-platt', name: 'Mrs. Platt', emoji: '👩', role: 'a traveler mending her wagon cover' },
        lines: ['A girl named Molly camped here with her family last week. She kept looking back down the trail, as if she missed something.',
                'They were bound for Fort Laramie. Maybe you will find them there.'] },
      { at: 'chimney-rock', person: { id: 'q-josh', name: 'Josh', emoji: '👦', role: 'a boy sketching the rock' },
        lines: ["Molly Rowe? She rode in the wagon with the blue cover. She told me she dropped her grandma's locket at the Kansas River.",
                'Her family is waiting at Fort Laramie for a new wagon wheel.'] },
    ],
    owner: { at: 'fort-laramie', person: { id: 'q-molly', name: 'Molly Rowe', emoji: '👧', role: 'a girl waiting for a wagon wheel' },
      lines: ['My locket! Grandma gave it to me the day we left home. I was sure it was gone for good.',
              'Thank you, and thank your dog too! Please take this bag of dried apples for the road.'] },
    reward: { tokens: 1, food: { what: 'dried apples', lb: 10 } },
    mailed: { text: 'The post office sends the locket ahead to Fort Laramie, with a note for Molly.' } },
  { id: 'bottle-note', name: 'The bottle note', card: 'marble', letter: 'quest-note',
    item: { id: 'bottle-note', name: 'A note in a bottle', emoji: '📜',
      text: 'The note says: Hello! My name is Sam. Our wagon is going all the way to The Dalles. If you find this, come and say hello!',
      say: 'The note says: Hello! My name is Sam. Our wagon is going all the way to The Dalles. If you find this, come and say hello!' },
    find: { via: 'fish', legs: ['fort-laramie', 'north-platte', 'independence-rock', 'ice-slough', 'south-pass', 'green-river', 'fort-bridger'] },
    steps: [
      { at: 'fort-bridger', person: { id: 'q-ruby', name: 'Ruby', emoji: '👧', role: 'a girl at the trading post' },
        lines: ['Sam? The boy who plays the harmonica? His family bought flour here and rolled on west.', 'He said he dropped a bottle in the river for luck!'] },
      { at: 'fort-hall', person: { id: 'q-pete', name: 'Mr. Pete', emoji: '🧔', role: 'a wagon driver resting his mules' },
        lines: ['A boy named Sam played his harmonica for us every night by the springs.', 'His family was headed down the Snake River toward The Dalles.'] },
    ],
    owner: { at: 'the-dalles', person: { id: 'q-sam', name: 'Sam', emoji: '👦', role: 'a boy with a harmonica' },
      lines: ['You found my bottle? It floated all that way? That is the best thing ever!', 'I promised a prize in my note. Here is my best marble, the blue one.'] },
    reward: { tokens: 1 },
    mailed: { text: 'The post office sends the note on to The Dalles, with a hello for Sam.' } },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
