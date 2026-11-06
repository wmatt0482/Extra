import { doc, handles } from './helpers.js';

const d1 = doc('d1', { kind: 'note', title: "Maya's Note", from: 'Maya Chen, Room 12', stretch: false }, [
  [
    'Hello, Detective!',
    'My name is Maya Chen, and I am in Ms. Park\'s fourth-grade class in Room 12.',
    'My lunchbox is missing!',
    'It is purple, with a green dinosaur sticker on the lid.',
    '@put I put it in my cubby at 8:15, right before the morning bell.',
    '@empty At lunchtime, my cubby was empty.',
  ],
  [
    'I looked under my desk, in the coat closet, and behind the bookshelf.',
    'I asked Dev, who sits next to me, but he was drawing a dragon all morning.',
    'My lunch has yogurt in it, and yogurt does not like warm days.',
    'Please help me find it before the yogurt turns into soup.',
  ],
]);

const d2 = doc('d2', { kind: 'note', title: "Ms. Park's Class Notes", from: 'Ms. Park, teacher', stretch: false }, [
  [
    'At 8:30, I told the class that the weather would be hot this week.',
    '@rule Any lunch with yogurt, cheese, or meat must go into the cafeteria cooler until noon.',
    '@theojob Our helper of the week checks the cubbies at morning recess and carries the cold lunches to the cooler.',
    'This week, the helper is Theo.',
  ],
  [
    'Theo left a note on my desk, but the breeze from the window blew it under the bookshelf.',
    'I found it at 12:10, when I was looking for my stapler.',
    '@notetext The note was signed by Theo, and it said that one purple lunchbox with a dinosaur sticker was safe in the cooler.',
    'So the lunchbox was never taken; it was only moved to a cooler place.',
  ],
]);

const S = handles(d1.ids, d2.ids);

export default {
  id: 'training', arc: 'training', order: 0,
  title: 'Detective Training: The Case of the Moved Lunchbox',
  setting: 'Maple Street School · a hot Tuesday',
  objective: "Find out who moved Maya's lunchbox, and why.",
  words: [
    { word: 'cubby', meaning: "a small space where a student keeps coats, bags and lunches", sentenceId: S.put },
    { word: 'cooler', meaning: 'a cold place that keeps food fresh', sentenceId: S.rule },
  ],
  briefing: [
    { who: 'chief', text: "Welcome to the agency, Detective. Before your first real case, we run a training case: who moved Maya's lunchbox, and why?" },
    { who: 'partner', text: "I'm Pip, your partner. Detectives use four moves. Move one: ask a question. Ours is, where did the lunchbox go?" },
    { who: 'partner', text: 'Move two: check it makes sense. If a clue does not fit, read it again. Move three: picture the scene, like a movie in your head.' },
    { who: 'chief', text: 'Move four: sum it up in one sentence. Now open the documents and start reading.' },
  ],
  docs: [d1.doc, d2.doc],
  questions: [
    { id: 'q1', type: 'evidence', std: '4R1',
      prompt: 'Which sentence tells when Maya put her lunchbox in the cubby?',
      answer: [S.put],
      hint: 'Move one, ask a question: what time of day was it? Look for a clock time in Maya\'s note.',
      model: 'I picture Maya arriving at school. She says she put it in her cubby right before the bell, and she gives the time: 8:15.',
      why: 'This sentence gives the exact time and place, so we know the lunchbox was safe in the cubby at 8:15.' },
    { id: 'q2', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows why a lunchbox with yogurt might be moved?',
      answer: [S.rule],
      hint: 'Move two, check it makes sense: Maya\'s lunch has yogurt. What rule does Ms. Park have about cold foods?',
      model: 'Maya has yogurt, and Ms. Park says lunches with yogurt must go to the cooler. That fits, so it makes sense that someone moved it.',
      why: 'The rule says lunches with yogurt go into the cooler, so moving Maya\'s lunchbox was following the rule.' },
    { id: 'q3', type: 'main', std: '4R2',
      prompt: "Which sentence best sums up Theo's job as helper of the week?",
      answer: [S.theojob],
      hint: 'Move four, sum it up: what does the helper do at morning recess?',
      model: 'The helper checks the cubbies and carries cold lunches to the cooler. That one sentence sums up the whole job.',
      why: "This sentence tells the whole job in one line, and it explains how Maya's lunchbox got to the cooler." },
  ],
  timeline: {
    kind: 'sequence', prompt: 'Put the morning in order.',
    items: [
      { id: 't1', text: 'Maya put her lunchbox in her cubby.', proof: S.put },
      { id: 't2', text: 'Ms. Park told the class that cold lunches go in the cooler.', proof: S.rule },
      { id: 't3', text: "Theo carried the cold lunches, including Maya's, to the cooler.", proof: S.notetext },
      { id: 't4', text: 'At lunchtime, Maya found her cubby empty.', proof: S.empty },
    ],
    given: [0, 3],
  },
  solution: { prompt: "Who moved Maya's lunchbox?", answers: ['Theo'], proof: [S.theojob, S.notetext] },
  report: { keywords: ['cooler', 'yogurt', 'cold', 'note', 'helper'] },
  closing: { who: 'chief', text: 'Case closed, Detective. The lunchbox was never missing, only moved. You asked, checked, pictured and summed it up like a real detective.' },
  knowledge: 'Good detectives use four moves: ask a question, check that it makes sense, picture the scene, and sum it up.',
  teaser: 'Tomorrow: your first real case, set along the Erie Canal.',
  facts: [],
};
