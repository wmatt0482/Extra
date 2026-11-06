import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'logbook', title: "Lock Tender's Log, Lockport", from: 'Lock tender Marta Brandt', stretch: false }, [
  [
    '@flightdef I tend the Flight of Five at Lockport, which is a line of five locks, one right after another, built into the side of a steep hill.',
    'The channel above the top lock is wide and calm.',
    'The channel below the bottom lock is busy with boats waiting their turn.',
    '@sixty Together, the five locks lift a boat about sixty feet.',
    '@direction A boat heading west must climb up all five steps, and a boat heading east must come down all five.',
  ],
  [
    'This is the week of the great celebration, and the canal is busy with packets, cargo boats and hoggees leading tired mules.',
    '@kingfisher Morning: The Kingfisher came down all five locks and went on toward the east.',
    '@heronswallow Afternoon: The Heron and the Swallow both tied up at the foot of my locks, having come along the canal from the east, and neither entered a lock.',
    'Every captain wants to tell me about the celebration, but I have a flight of locks to run.',
    'The Kingfisher is a packet with a bright red door.',
    'The Heron is a packet with a blue one, and the Swallow carries cargo for the merchants of Buffalo.',
    'A fast packet must still wait its turn in my locks, and I tell every captain that the hill does not care how fast a boat wants to go.',
  ],
]);

const d2 = doc('d2', { kind: 'note', title: 'Note from the Schoolteacher', from: 'Miss Eliza Odell, teacher', stretch: false }, [
  [
    '@ask My students wanted to join the celebration of the new canal, so we asked three captains to carry a small keg of water to our school.',
    'One keg was filled from Lake Erie, one from the Hudson River, and one from the Genesee River.',
    'The Genesee River is near my old home in Rochester, where the canal crosses it on a great aqueduct.',
    'My students have drawn pictures of the canal, and one of them drew a mule wearing a very large hat.',
    'Each captain tied a ribbon on his keg: red for the Kingfisher, blue for the Heron, and yellow for the Swallow.',
    '@blue When I asked the mate of the Heron why he chose blue, he told me that blue is his favorite color.',
  ],
  [
    'The kegs waited on the school porch while the class practiced a song for the celebration.',
    '@rain Then the rain came and washed the paper labels off all three kegs.',
    '@problem Now the kegs sit in a row, and we cannot tell which one holds the water from Lake Erie.',
    'The students have tasted nothing and smelled nothing, because water from every river smells like water.',
    'I told them that a good detective does not need to taste the water, only to read the evidence.',
    '@climb I remind my students that the canal climbs from the Hudson River in the east up to Lake Erie in the west, so Lake Erie sits at the very top.',
  ],
]);

const d3 = doc('d3', { kind: 'newspaper', title: 'Notice of the Celebration', from: 'The Lockport Gazette', stretch: true }, [
  [
    'On the twenty-sixth of October, the governor of this state, Mr. DeWitt Clinton, will set out from the city of Buffalo aboard the canal boat Seneca Chief, in company with many of the principal gentlemen of the country.',
    '@keg The boat will carry, among her cargo, a keg of the waters of Lake Erie, which the governor will pour into the ocean at New York.',
    'The canal crosses many rivers and valleys on aqueducts, which are bridges for water, and it passes through dozens of locks, so a boat may travel from the Hudson River all the way to the lake.',
    '@meaning Thus the keg shall stand as a sign that the new canal, three hundred and sixty-three miles in length, has joined Lake Erie to the Atlantic Ocean by way of the Hudson River.',
  ],
  [
    'Even those who once jeered at the canal and called it "Clinton\'s Ditch" are invited to come and cheer the boat as she passes.',
    'The people of every village along the way, from the smallest hamlet to the busiest port, are likewise invited to join the celebration, and the merchants of this village will keep their shops closed for the afternoon.',
    'Every packet that passes shall be greeted with cheers and with music, and the hoggee who leads her mules shall receive a cheer as well.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids);

export default {
  id: 'erie-05', arc: 'erie', order: 5,
  title: 'The Case of the Three Kegs',
  setting: 'Lockport, New York · October 1825',
  objective: 'Find out which boat carried the keg of water from Lake Erie.',
  words: [
    { word: 'flight', meaning: 'a line of locks, one right after another, like steps on a staircase', sentenceId: S.flightdef },
    { word: 'keg', meaning: 'a small barrel', sentenceId: S.ask },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, this is the oldest file in the cabinet. It comes from the very week the Erie Canal opened.' },
    { who: 'chief', text: 'Three kegs of water sit in a school, and the labels have washed off. Find out which boat carried the water from Lake Erie.' },
    { who: 'partner', text: 'Water is water! How can we tell? Let me picture the canal as a giant staircase and check which way each boat went.' },
    { who: 'archivist', text: 'Two words today: flight and keg. Tap each one, and I will give you its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc],
  questions: [
    { id: 'q1', type: 'word', std: '4R4',
      prompt: 'Which sentence helps you understand what a flight of locks is?',
      answer: [S.flightdef],
      hint: 'Marta tells us what she runs. Look for the words "which is."',
      model: 'Marta says the Flight of Five "is a line of five locks, one right after another." That tells me what a flight is.',
      why: 'The sentence explains that a flight of locks is a line of locks, one right after another, like stairs.' },
    { id: 'q2', type: 'evidence', std: '4R3',
      prompt: 'Which sentence tells what a boat heading east must do at the Lockport locks?',
      answer: [S.direction],
      hint: 'Picture the staircase. A boat going west goes up. What about a boat going east?',
      model: 'The log says a boat heading west climbs all five steps, and one heading east comes down all five.',
      why: 'This sentence is the key rule: going east means coming down the steps, and going west means climbing them.' },
    { id: 'q3', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows which boat travelled down all five locks?',
      answer: [S.kingfisher],
      hint: 'The lock tender wrote down what each boat did. Which boat came down the locks?',
      model: 'Only one entry says a boat came down all five locks. That boat is the one that came from the west.',
      why: 'The Kingfisher came down all five locks, so she was heading east, which means she came from the west.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows that the Heron and the Swallow did not come from Lake Erie?',
      answer: [S.heronswallow],
      hint: 'Check which direction the Heron and the Swallow came from. East or west?',
      model: 'Lake Erie is in the west, but these two boats came along the canal from the east.',
      why: 'The Heron and the Swallow came from the east and never entered a lock, so they could not have carried water from the west.' },
    { id: 'q5', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the teacher\'s note shows that Lake Erie is the high end of the canal?',
      answer: [S.climb],
      hint: 'Which way does the canal climb? Look in the teacher\'s note.',
      model: 'The teacher says the canal climbs from the Hudson in the east up to Lake Erie in the west, so the lake is at the top.',
      why: 'If the canal climbs up to Lake Erie, then Lake Erie is the high end, and boats from there must come down.' },
    { id: 'q6', type: 'main', std: '4R2',
      prompt: 'Which sentence in the newspaper notice tells what the governor\'s keg of water stands for?',
      answer: [S.meaning],
      hint: 'Sum up the notice: the governor carries the keg as a sign of what?',
      model: 'The notice says the keg is a sign that the new canal has joined Lake Erie to the Atlantic Ocean.',
      why: 'This sentence sums up the big idea of the ceremony: the canal joined the lake to the sea.' },
  ],
  timeline: {
    kind: 'sequence', prompt: 'Put the week of the three kegs in order.',
    items: [
      { id: 't1', text: 'Miss Odell\'s class asked three captains to carry kegs of water to school.', proof: S.ask },
      { id: 't2', text: 'In the morning, the Kingfisher came down all five locks.', proof: S.kingfisher },
      { id: 't3', text: 'In the afternoon, the Heron and the Swallow tied up at the foot of the locks.', proof: S.heronswallow },
      { id: 't4', text: 'The rain washed the labels off the kegs.', proof: S.rain },
      { id: 't5', text: 'Miss Odell could not tell which keg held water from Lake Erie.', proof: S.problem },
    ],
    given: [0, 4],
  },
  solution: { prompt: 'Which boat carried the water from Lake Erie?', answers: ['Kingfisher', 'the Kingfisher', 'red', 'red ribbon', 'red keg'], proof: [S.direction, S.kingfisher, S.climb] },
  report: { keywords: ['Kingfisher', 'down', 'locks', 'west', 'east', 'Lake Erie', 'red'] },
  closing: { who: 'chief', text: 'Case closed! The keg with the red ribbon comes from Lake Erie. You solved it by reading the staircase, not by guessing, and that is real detective work.' },
  knowledge: 'The Erie Canal climbs from the Hudson River up to Lake Erie. On its opening trip in 1825, the Seneca Chief carried a keg of Lake Erie water to New York Harbor, a ceremony called the Wedding of the Waters.',
  teaser: 'Tomorrow, a new set of files opens, with a new puzzle waiting for sharp eyes.',
  facts: [
    { claim: 'The Lockport locks were a flight of five locks (five double locks) that lifted or lowered boats over the Niagara Escarpment, about 60 feet in all.', source: 'https://www.discoverniagara.org/lockport-s-flight-of-five' },
    { claim: 'The Flight of Five opened with the Erie Canal in 1825.', source: 'https://en.wikipedia.org/wiki/Flight_of_Five_Locks' },
    { claim: 'The Erie Canal opened on October 26, 1825, when Governor DeWitt Clinton left Buffalo aboard the Seneca Chief; the canal was 363 miles long, 40 feet wide and 4 feet deep.', source: 'https://www.lockportjournal.com/opinion/columns/erie-canal-discovery-oct-26-1825-the-opening-of-the-erie-canal/article_ac5f22ca-91c7-5dcc-a4aa-474f08384358.html' },
    { claim: 'The Seneca Chief carried a keg of Lake Erie water, which Clinton poured into the Atlantic at New York Harbor on November 4, 1825, in the ceremony known as the Wedding of the Waters.', source: 'https://spectrumlocalnews.com/nys/buffalo/news/2025/10/24/floating-time-capsule--replica-boat-retraces-historic-erie-canal-journey-200-years-later' },
    { claim: 'The original canal crossed rivers and valleys on aqueducts and passed through 83 locks.', source: 'https://eriecanal.org/Rochester-1.html' },
    { claim: 'Opponents of the canal called it "Clinton\'s Ditch".', source: 'https://todayinhistory.app/events/77984' },
    { claim: 'The canal rises from the Hudson River up to Lake Erie, so boats heading west climb and boats heading east descend.', source: 'https://en.wikipedia.org/wiki/Flight_of_Five_Locks' },
  ],
};
