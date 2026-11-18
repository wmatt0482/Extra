import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'logbook', title: 'Lighthouse Keeper\'s Log', from: 'Keeper Nora Haskell', stretch: false }, [
  [
    'I am Nora Haskell, keeper of the stone lighthouse at Charlotte, where the Genesee River meets Lake Ontario.',
    '@purpose The tower stands at the mouth of the river to help ships find the safe way in.',
    '@sand Sand bars lie under the water near the mouth of the river, and a ship that wanders off course can run aground in the sand.',
    'Schooners from all over the lake come here to carry flour from the valley mills, so I keep a careful watch.',
    '@lamps At the top of the tower are ten oil lamps, and each one has a shiny reflector that sends its light out across the lake.',
    '@steady My light is a steady light, which means that it shines without any blinking or turning.',
  ],
  [
    '@lit Last evening, I lit all ten lamps at sunset, and I checked them again at midnight.',
    'Each lamp burned bright and clean all night long.',
    'Oil must be poured, wicks must be trimmed, and the glass must be wiped, so a keeper is busy from dusk to dawn.',
    '@clear The sky was clear and the stars were out, so no fog or rain hid the light.',
    'The current of the river pushes sand toward the mouth, and I watched the water with a lantern until dawn.',
    '@door This morning, Captain Silas Bright came to my door and said that my light was never lit.',
    'I told him that he was mistaken, so he sat down and wrote out his story.',
    'I read his words slowly, because I want to be fair to him, and I want to be fair to my lamps.',
  ],
]);

const d2 = doc('d2', { kind: 'witness', title: 'Statement of a Ship\'s Captain', from: 'Captain Silas Bright', stretch: false }, [
  [
    '@schooner I am Silas Bright, and I sail a schooner that carries grain across Lake Ontario to the mills of the valley.',
    '@home At my home harbor, the lighthouse flashes on and off, so I have always looked for a blinking light.',
    '@looked Last night, I looked all along the shore for a blinking light that would show me the mouth of the river.',
    '@glow I saw only a steady yellow glow, and I took it for a lantern in a window on shore.',
  ],
  [
    '@past So I sailed on past the river, and at dawn I found my ship many miles down the shore.',
    'A strong current along the shore had also pushed us farther from the river.',
    'My crew and I are tired and cross, and our cargo will arrive late at the mill.',
    'The current in the lake was strong all night, and it made the whole trip harder.',
    'We had a long, cold sail, and we had hoped for a safe harbor and a hot supper.',
    'I say that the lighthouse failed me, and I want the keeper to hear it.',
    'Still, I am an honest man, and I will gladly say what I saw if anyone asks.',
  ],
]);

const d3 = doc('d3', { kind: 'letter', title: 'Letter to Captain Bright', from: 'Mr. Thomas Lyle, harbor master', stretch: true }, [
  [
    'Captain, I have read the keeper\'s log and your statement, and the two agree more closely than you think.',
    'The keeper lit her lamps at the proper hour, and you saw her light, but you did not know it for what it was.',
    'The current of the lake can fool even an able sailor, so a good light matters a great deal.',
    'Harbors on the lake do not all show their lights the same way, so a captain in a new port must learn its signal.',
  ],
  [
    'The current of the river carries sand to the mouth, which is why sailors depend on the tower to find the channel at night.',
    'You will find a steady glow at Charlotte, and I advise you to look for it the next time you carry grain to the mills of the valley.',
    'No one doubts your skill, and I hope you will remember this lesson whenever you reach a harbor you do not know.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids);

export default {
  id: 'genesee-05', arc: 'genesee', order: 5, town: 'charlotte',
  title: 'The Case of the Light Nobody Saw',
  setting: 'Charlotte, New York · autumn 1825',
  objective: 'Find out why a ship\'s captain sailed right past the river mouth, even though the lighthouse was lit.',
  words: [
    { word: 'reflector', meaning: 'a shiny surface that bounces light in one direction', sentenceId: S.lamps },
    { word: 'schooner', meaning: 'a sailing ship with two or more masts', sentenceId: S.schooner },
    { word: 'aground', meaning: 'stuck on the bottom of a river or lake, unable to move', sentenceId: S.sand },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, we are at the old stone lighthouse in Charlotte, where the Genesee River meets Lake Ontario.' },
    { who: 'chief', text: 'A captain says the light was never lit, and he sailed right past the river. The keeper says she lit every lamp.' },
    { who: 'partner', text: 'Both of them sound sure. Let me check whether the two stories can both be true.' },
    { who: 'archivist', text: 'Today\'s words are reflector, schooner and aground. Tap each one, and I will give you its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc],
  questions: [
    { id: 'q1', type: 'word', std: '4R4',
      prompt: 'Which sentence in the log helps you understand what a steady light is?',
      answer: [S.steady],
      hint: 'Look for the words "which means" after the new term.',
      model: 'The log says a steady light shines without any blinking or turning. The words "which means" give me the meaning.',
      why: 'The sentence says a steady light shines without blinking or turning.' },
    { id: 'q2', type: 'evidence', std: '4R1',
      prompt: 'Which sentence in the log tells when Nora lit the lamps?',
      answer: [S.lit],
      hint: 'Look for the time of day when the keeper lit the lamps.',
      model: 'Nora lit all ten lamps at sunset and checked them again at midnight. So the light was working all evening.',
      why: 'The log says she lit all ten lamps at sunset, so the light was lit when the captain sailed by.' },
    { id: 'q3', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the log shows that the weather did not hide the light?',
      answer: [S.clear],
      hint: 'If it had been foggy or rainy, the light might be hard to see. What was the sky like?',
      model: 'The sky was clear and the stars were out, with no fog or rain. So the weather cannot explain why the captain missed the light.',
      why: 'A clear sky with no fog or rain means nothing hid the light, so the weather is ruled out.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the captain\'s statement shows what he thought the steady glow was?',
      answer: [S.glow],
      hint: 'The captain did see something. What did he decide that it was?',
      model: 'He saw a steady yellow glow, and he took it for a lantern in a window on shore. So he did see the lighthouse, but he did not know it.',
      why: 'The captain saw the light but mistook it for a lantern on shore.' },
    { id: 'q5', type: 'main', std: '4R2',
      prompt: 'Which sentence in the log best sums up why the lighthouse stands at the mouth of the river?',
      answer: [S.purpose],
      hint: 'Sum it up: what is the tower for? Look near the start of the log.',
      model: 'The tower stands at the mouth of the river to help ships find the safe way in. That is the lighthouse\'s whole job.',
      why: 'This sentence says what the tower is for: helping ships find the safe way into the river.' },
    { id: 'q6', type: 'evidence', std: '4R3',
      prompt: 'Which sentence in the captain\'s statement tells what he searched the shore for last night?',
      answer: [S.looked],
      hint: 'Find the sentence that begins with last night. What was he looking for?',
      model: 'Last night he looked along the shore for a blinking light. He expected a blink, but he did not get one.',
      why: 'This sentence tells that he was searching for a blinking light, which is not the kind of light the keeper showed.' },
  ],
  timeline: {
    kind: 'cause', prompt: 'What happened, and what made it happen? Put the chain in order.',
    items: [
      { id: 't1', text: 'The keeper lit all ten lamps at sunset.', proof: S.lit },
      { id: 't2', text: 'The sky was clear, so nothing hid the light.', proof: S.clear },
      { id: 't3', text: 'The captain searched the shore for a certain kind of light.', proof: S.looked },
      { id: 't4', text: 'He saw a steady yellow glow and thought it was a lantern.', proof: S.glow },
      { id: 't5', text: 'He sailed past the river, and at dawn he was far down the shore.', proof: S.past },
      { id: 't6', text: 'The captain went to the keeper and said her light was never lit.', proof: S.door },
    ],
    given: [0, 5],
  },
  solution: { prompt: 'What kind of light was the captain watching for?', answers: ['blinking', 'a blinking light', 'blinking light', 'flashing', 'a flashing light', 'flashing light'], proof: [S.looked, S.steady] },
  report: { lead: 'The captain was watching for a ___ light', keywords: ['blinking', 'steady', 'lantern', 'glow', 'lighthouse', 'shore'] },
  closing: { who: 'chief', text: 'Case closed! The light was lit all night, but it was steady, and the captain was watching for blinks. That wraps up every file in the Genesee Valley. You read like a true detective.' },
  knowledge: 'The Charlotte-Genesee Lighthouse, built of stone in 1822 where the Genesee River meets Lake Ontario, is the oldest surviving lighthouse on the American side of Lake Ontario.',
  teaser: 'Every file in the Genesee Valley is closed. The Chief is already hunting for new cases, so keep those sharp eyes ready.',
  facts: [
    { claim: 'The Charlotte-Genesee Lighthouse is an 1822 octagonal stone lighthouse, about 40 feet tall, on Lake Ontario at the mouth of the Genesee River in Rochester\'s Charlotte neighborhood.', source: 'https://en.wikipedia.org/wiki/Charlotte%E2%80%93Genesee_Lighthouse' },
    { claim: 'It originally had ten whale-oil lamps with reflectors (Winslow Lewis lamps), replaced by a Fresnel lens later. Lt. Charles T. Platt\'s 1838 inspection report describes the Genesee light as 10 lamps and the same number of bright reflectors, fixed (quoted on us-lighthouses.com); most US lights of the period were fixed, with a few revolving (USLHS Keeper\'s Log, Winter 1989).', source: 'https://www.us-lighthouses.com/displaypage.php?LightID=98' },
    { claim: 'A sand bar at the mouth of the Genesee River troubled mariners; from 1829 the federal government built a pair of piers.', source: 'https://www.us-lighthouses.com/displaypage.php?LightID=98' },
    { claim: 'The Charlotte-Genesee Lighthouse is described by its historical society as the oldest surviving lighthouse on the American side of Lake Ontario, and it is a museum today.', source: 'https://geneseelighthouse.org/' },
  ],
};
