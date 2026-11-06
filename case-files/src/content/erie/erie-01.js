import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'witness', title: 'Statement of Captain Pratt', from: 'Captain Amos Pratt, line boat Mary Jane', stretch: false }, [
  [
    'My name is Amos Pratt, and I am the captain of the line boat Mary Jane.',
    'Every captain must show a waybill at the toll office before his boat may go on.',
    '@define A waybill is a paper that lists the cargo a boat carries and where it is going.',
    'The Mary Jane is a line boat, which carries cargo, while a packet boat carries passengers.',
    '@written Mine was written at nine o\'clock this morning by the merchant, Mrs. Delia Hartwell, who sent fifty barrels of flour on my boat.',
    'Mrs. Hartwell is a careful merchant, and she has never made a mistake on a waybill.',
  ],
  [
    '@hatband I folded the waybill small and tucked it into the band of my hat, where it is always safe.',
    '@cross Then the Mary Jane glided out onto the aqueduct that carries the canal over the Genesee River.',
    '@gust Halfway across, a gust of wind swept up from the river and snatched the hat right off my head.',
    'The boat could not stop, because our mule was pulling us along the towpath at a steady walk.',
    'I watched the hat flutter away like a big brown bird.',
    'Down below, the channel of the canal was calm, and the river rushed under the aqueduct.',
  ],
  [
    '@empty At the toll office, the collector asked for my waybill, and I had nothing to show him but a bare head.',
    'Some people whisper that my cook, Mrs. Bell, took the waybill.',
    '@cook That is nonsense, because Mrs. Bell was below deck the whole morning, and her soup pot lid clanked so loudly that I always knew where she was.',
    'I looked back along the towpath for my hat, but I never saw it again.',
  ],
]);

const d2 = doc('d2', { kind: 'witness', title: 'Statement of a Young Hoggee', from: 'Eli Washington, hoggee', stretch: false }, [
  [
    'I am Eli Washington, and I am twelve years old.',
    '@hoggee I am a hoggee, which means I walk beside the mules on the towpath and keep the boat moving.',
    'Today my mule Biscuit was pulling the Mary Jane.',
    'Biscuit is the smartest mule on the canal, but she does not like the hot sun.',
    'A good hoggee keeps one eye on the mule and one eye on the channel, so the boat stays in the middle.',
  ],
  [
    'The sun was blazing when we reached the aqueduct, and Biscuit was sweating.',
    '@landed Then a hat came spinning down the towpath and landed in the dust right in front of me.',
    'A hoggee must never stop his mule, so I could not run back to the boat.',
    '@onbiscuit I picked up the hat and set it on Biscuit\'s head, between her ears, to shade her eyes.',
    '@nolook I did not look inside it, because it was not my hat.',
  ],
  [
    'I planned to give it back at the next lock.',
    'At the toll office, everyone was looking back along the towpath for something small and flat.',
    'Nobody looked at Biscuit\'s ears.',
  ],
]);

const d3 = doc('d3', { kind: 'notice', title: 'Notice from the Toll Office', from: 'Silas Whitcomb, Collector of Tolls at Rochester', stretch: true }, [
  [
    '@rule It is the settled rule of this office that no cargo belonging to any merchant may pass eastward without a waybill, for upon that paper we reckon the toll that is due.',
    'Whereas the line boat Mary Jane, under Captain Amos Pratt, cannot be permitted to proceed until her waybill is produced, the said boat is hereby detained at the toll office.',
    '@time Captain Pratt declares that his waybill was carried off by a gust of wind upon the aqueduct at about half past ten of the clock, along with the captain\'s own hat.',
    '@clerk The collector wishes it known that Mr. Peck, his clerk, has not stirred from his desk since eight o\'clock this morning, as every person in the office is prepared to swear.',
  ],
  [
    'Any person who has seen a hat upon the towpath, or in the water below the aqueduct, is respectfully requested to inform this office at once.',
    'Meanwhile, the merchant, Mrs. Hartwell, must be patient, for fifty barrels of flour cannot be hurried by anyone but a mule.',
    'A waybill, as every honest merchant knows, is the first paper a captain shows and the last paper he puts away.',
    'The collector notes with some regret that this is the third paper this month to be carried away by the wind, a circumstance he attributes to the exceeding breeziness of the Genesee valley.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids);

export default {
  id: 'erie-01', arc: 'erie', order: 1,
  title: 'The Case of the Missing Waybill',
  setting: 'Rochester, New York · June 1826',
  objective: 'Find out who has the missing waybill, and when it went missing.',
  words: [
    { word: 'waybill', meaning: 'a paper that lists the cargo a boat carries and where it is going', sentenceId: S.define },
    { word: 'hoggee', meaning: 'a young person who walks beside the mules on the towpath and keeps the boat moving', sentenceId: S.hoggee },
    { word: 'aqueduct', meaning: 'a bridge that carries a canal over a river or valley', sentenceId: S.cross },
  ],
  briefing: [
    { who: 'chief', text: 'Welcome to the Erie Canal, Detective. A cargo boat is stuck at the Rochester toll office, because its captain cannot find his waybill.' },
    { who: 'chief', text: 'Your job: find out who has the missing waybill, and when it went missing.' },
    { who: 'partner', text: 'A waybill lists what a boat carries. No waybill, no toll, and no toll, no trip! Let me ask a question first: where did that paper go?' },
    { who: 'archivist', text: 'Three words for this file: waybill, hoggee and aqueduct. Tap each one in its sentence, and I will tell you what it means.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc],
  questions: [
    { id: 'q1', type: 'evidence', std: '4R1',
      prompt: 'Which sentence shows where Captain Pratt kept his waybill?',
      answer: [S.hatband],
      hint: 'Where does a captain keep a small paper so it will not blow around? Read the captain\'s statement.',
      model: 'I picture the captain folding the paper small. He says he tucked it into the band of his hat, so that is where the waybill was kept.',
      why: 'This sentence tells exactly where the waybill was, so whoever has the hat has the waybill.' },
    { id: 'q2', type: 'evidence', std: '4R3',
      prompt: 'Which sentence tells about what time the wind carried the hat away?',
      answer: [S.time],
      hint: 'Look for a time of day. The collector\'s notice was written to explain what happened and when.',
      model: 'A time is something like "half past ten." I read the toll office notice slowly and find the sentence about the gust of wind and the clock.',
      why: 'The notice says the wind took the hat at about half past ten, so that is when the waybill went missing.' },
    { id: 'q3', type: 'word', std: '4R4',
      prompt: 'Which sentence helps you understand what a hoggee is?',
      answer: [S.hoggee],
      hint: 'A good writer sometimes explains a new word right after using it. Who is telling you about their own job?',
      model: 'Eli says "I am a hoggee, which means..." and then explains the job. The words after "which means" are the meaning.',
      why: 'The words "which means" tell us a hoggee walks beside the mules on the towpath and keeps the boat moving.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows that Eli did not know the waybill was inside the hat?',
      answer: [S.nolook],
      hint: 'Ask: if Eli had looked inside the hat, what would he have found? Did he look?',
      model: 'If Eli had looked inside, he would have seen a folded paper. But he says he did not look, so he had no idea.',
      why: 'Eli says he did not look inside, so he could not have known about the waybill.' },
    { id: 'q5', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows that the toll clerk could not have taken the hat?',
      answer: [S.clerk],
      hint: 'Check each person near the toll office. Which sentence says where Mr. Peck was all morning?',
      model: 'The hat blew off out on the aqueduct. Mr. Peck was at his desk in the office the whole time, so he was too far away.',
      why: 'Mr. Peck never left his desk, so he was nowhere near the aqueduct when the hat blew away.' },
    { id: 'q6', type: 'main', std: '4R2',
      prompt: 'Which sentence in the notice tells the main rule about waybills?',
      answer: [S.rule],
      hint: 'Sum it up: what rule is the whole notice built on? It is the first sentence of the notice.',
      model: 'The notice starts with the settled rule: no cargo may pass without a waybill. Everything else in the notice depends on that.',
      why: 'This is the rule that explains why the boat is stuck: the toll is figured from the waybill, so no waybill means no passing.' },
  ],
  timeline: {
    kind: 'sequence', prompt: 'Put the morning in order.',
    items: [
      { id: 't1', text: 'Mrs. Hartwell wrote the waybill at nine o\'clock.', proof: S.written },
      { id: 't2', text: 'Captain Pratt tucked the waybill into his hatband.', proof: S.hatband },
      { id: 't3', text: 'The Mary Jane glided out onto the aqueduct.', proof: S.cross },
      { id: 't4', text: 'A gust of wind snatched the hat from the captain\'s head.', proof: S.gust },
      { id: 't5', text: 'A hat landed on the towpath in front of Eli.', proof: S.landed },
      { id: 't6', text: 'At the toll office, the captain had no waybill to show.', proof: S.empty },
    ],
    given: [0, 4],
  },
  solution: { prompt: 'Who has the missing waybill?', answers: ['Biscuit', 'the mule', 'mule', 'Biscuit the mule'], proof: [S.hatband, S.onbiscuit] },
  report: { keywords: ['hat', 'hatband', 'mule', 'Biscuit', 'wind', 'waybill'] },
  closing: { who: 'chief', text: 'Case closed! One mule, one captain\'s hat, and one waybill, safe and dry. Everyone looked behind them, but the answer was right out in front.' },
  knowledge: 'The Erie Canal crossed the Genesee River at Rochester on a stone aqueduct, and mules walking on the towpath pulled the boats.',
  teaser: 'Tomorrow: the canal water is draining away overnight. Where is it going?',
  facts: [
    { claim: 'The Erie Canal crossed the Genesee River at Rochester on an aqueduct finished in 1823, about 800 feet long and built of stone.', source: 'https://eriecanal.org/Rochester-1.html' },
    { claim: 'The Rochester aqueduct was later replaced by a second aqueduct, which is now the Broad Street Bridge.', source: 'https://structurae.net/structures/broad-street-bridge-1842' },
    { claim: 'Mules or horses pulled canal boats from a towpath beside the canal; a young driver, often a boy, led them and was called a hoggee.', source: 'https://scdemocratonline.com/stories/hoggees-on-the-towpath,57342' },
    { claim: 'Boats had to be cleared at a collector\'s office; toll records list the boat, its master, the articles shipped, where bound, and the weight, so a paper listing the cargo was part of paying tolls.', source: 'https://snaccooperative.org/vocab_administrator/resources/8210835' },
    { claim: 'A line boat carried cargo and a packet boat carried passengers.', source: 'https://stagecoachdays.blogspot.com/2012/12/the-packet-and-stagecoach.html' },
    { claim: 'Toll collectors worked at Rochester (a cash book of a Rochester toll collector survives from 1826).', source: 'https://snaccooperative.org/vocab_administrator/resources/8316569' },
  ],
};
