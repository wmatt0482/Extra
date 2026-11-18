import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'note', title: 'Festival Volunteer\'s Note', from: 'Maya Brooks, Lilac Festival volunteer', stretch: false }, [
  [
    'My name is Maya Brooks, and I volunteer at the Lilac Festival in Highland Park in Rochester, New York.',
    'This morning a new banner arrived that says "Welcome to the Flower City," and I hung it above the gate.',
    '@gus Mr. Gus Romano, who has lived in Rochester his whole life, took one look and said that the banner has a spelling mistake because our city is the Flour City, with a U.',
    'Several visitors stopped to argue, and one of them said that her grandmother always called Rochester the Flour City.',
  ],
  [
    'I do not want to take the banner down if it is right, and I do not want to keep it up if it is wrong.',
    '@plan So I will read the signs at High Falls and at Highland Park to find out where each name came from.',
    'A reporter from the neighborhood newspaper took our picture, and her editor wants to print the answer.',
    'I have also written to the city historian, and I hope to hear back soon.',
  ],
]);

const d2 = doc('d2', { kind: 'placard', title: 'Welcome to High Falls', from: 'High Falls, Rochester', stretch: false }, [
  [
    'Welcome to High Falls, where the Genesee River drops over a tall waterfall in the middle of the city.',
    '@wheat Every harvest, farmers in the Genesee Valley brought their wheat to the mills, and wheat is the grain that is ground into flour.',
    '@wheels Mills were built beside the falls, because the falling water turned big wheels that powered the millstones.',
    'The current of the river was strong enough to run many mills at once.',
    'The Erie Canal carried barrels of flour from Rochester to the Hudson River and the big ports beyond.',
    '@largest By 1838, Rochester made more flour than any other city in the nation.',
    '@flour Because of its busy flour mills, the city was called the Flour City.',
  ],
  [
    'Water power built this city, and the river still rushes over the falls today.',
    'Please stay behind the railing when you look down at the falls.',
  ],
]);

const d3 = doc('d3', { kind: 'placard', title: 'Welcome to Highland Park', from: 'Highland Park, Rochester', stretch: false }, [
  [
    'Welcome to Highland Park, a park that grew from a nursery.',
    '@nurserydef A nursery is a farm where young trees and flowers are grown from seeds and cuttings and then sold.',
    'Around 1840, two nurserymen named George Ellwanger and Patrick Barry started a famous nursery in Rochester, and many other nurseries ringed the city.',
    '@shift In the middle of the 1800s, the wheat business moved west with the farms and the people, and the nursery business grew in Rochester.',
    '@second That growth gave the city a second nickname, the Flower City.',
  ],
  [
    '@gift The two partners later gave twenty acres of their nursery land to the city, and it became Highland Park.',
    'Today the park holds more than 1,200 lilac bushes, and the Lilac Festival is held here each May.',
    'The festival celebrates the gardens and nurseries of the Flower City.',
    'Please enjoy the flowers with your eyes, and leave every blossom on its bush.',
  ],
]);

const d4 = doc('d4', { kind: 'letter', title: 'Letter from the City Historian', from: 'Dr. Helen Okafor, city historian', stretch: true }, [
  [
    'Dear Ms. Brooks, your question is one that Rochester has asked itself for many years, and the answer is wonderfully tidy.',
    'Both names are correct, but they belong to different chapters of our history.',
    'The Flour City belongs to the age when the current of the river turned the mill wheels, and wheat from the valley poured into the mills.',
    'Many mills stood along the river then, and the city grew rich on their work.',
  ],
  [
    'The Flower City followed later, when nurseries, rather than mills, became the pride of the city.',
    'Your banner, hung for a festival of lilacs, says exactly what it should.',
    'You might tell Mr. Romano that the visitor\'s grandmother was right as well, for she was remembering the older name.',
    'A nickname records what a city was known for in its own time, and Rochester has earned two.',
    'I will send a copy of this letter to the editor of your neighborhood newspaper, so every reader in the nation of lilac lovers can enjoy the story.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids, d4.ids);

export default {
  id: 'genesee-04', arc: 'genesee', order: 4, town: 'rochester',
  title: 'The Case of the Two Names',
  setting: 'Rochester, New York · today',
  objective: 'Find out why Rochester has two nicknames, and which one is older.',
  words: [
    { word: 'nursery', meaning: 'a farm where young trees and flowers are grown and then sold', sentenceId: S.nurserydef },
    { word: 'harvest', meaning: 'the gathering of crops when they are ripe', sentenceId: S.wheat },
    { word: 'nickname', meaning: 'a name people use for a place or person, instead of the real name', sentenceId: S.second },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, we are in Rochester during the Lilac Festival. A volunteer named Maya hung a banner, and now people are arguing about it.' },
    { who: 'chief', text: 'Some say Rochester is the Flower City. Others say it is the Flour City. Find out why there are two names, and which one came first.' },
    { who: 'partner', text: 'Two names that sound the same. Let me picture the city long ago, and then again later.' },
    { who: 'archivist', text: 'Today\'s words are nursery, harvest and nickname. Tap each one, and I will give you its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc, d4.doc],
  questions: [
    { id: 'q1', type: 'word', std: '4R4',
      prompt: 'Which sentence on the Highland Park sign helps you understand what a nursery is?',
      answer: [S.nurserydef],
      hint: 'Look for the sentence that uses the word nursery and then says what one is.',
      model: 'The sign says a nursery is a farm where young trees and flowers are grown and sold. The words after "is" give the meaning.',
      why: 'The sentence says a nursery is a farm where young plants are grown and then sold.' },
    { id: 'q2', type: 'inference', std: '4R1',
      prompt: 'Which sentence on the High Falls sign explains why mills were built beside the falls?',
      answer: [S.wheels],
      hint: 'Picture the river dropping over the falls. What could that falling water do for a mill?',
      model: 'The falling water turned big wheels that powered the millstones. That is why the mills stood right beside the falls.',
      why: 'The mills needed the power of falling water, so they were built beside the falls.' },
    { id: 'q3', type: 'evidence', std: '4R3',
      prompt: 'Which sentence on the High Falls sign tells how Rochester got the name Flour City?',
      answer: [S.flour],
      hint: 'Look for the sentence that gives the reason behind the name.',
      model: 'The sign says the city had busy flour mills, so people called it the Flour City. The word "because" gives me the reason.',
      why: 'The sentence names the cause, busy flour mills, and the result, the nickname Flour City.' },
    { id: 'q4', type: 'evidence', std: '4R3',
      prompt: 'Which sentence on the Highland Park sign tells where the wheat business went?',
      answer: [S.shift],
      hint: 'The Flour City was built on wheat. Where did the wheat business go later?',
      model: 'The sign says the wheat business moved west with the farms and the people. At the same time, the nurseries grew in Rochester.',
      why: 'This sentence says the wheat business moved west while the nursery business grew in Rochester.' },
    { id: 'q5', type: 'main', std: '4R2',
      prompt: 'Which sentence on the Highland Park sign sums up how Rochester got its second nickname?',
      answer: [S.second],
      hint: 'Sum it up: what gave the city its second nickname? Look for the words "second nickname."',
      model: 'The growth of the nurseries gave the city a second nickname. The Flower City came after the Flour City.',
      why: 'This sentence names the Flower City as the second nickname, which came from the growing nursery business.' },
    { id: 'q6', type: 'inference', std: '4R1',
      prompt: 'Which sentence in Maya\'s note shows that Mr. Romano thinks the banner is wrong?',
      answer: [S.gus],
      hint: 'Find the person who has lived in Rochester his whole life. What did he say about the banner?',
      model: 'Mr. Romano looked at the banner and said it had a spelling mistake. So he thinks it should say Flour City.',
      why: 'Mr. Romano said the banner has a spelling mistake, so he thinks it is wrong.' },
  ],
  timeline: {
    kind: 'cause', prompt: 'How did Rochester earn two nicknames? Put the history in order.',
    items: [
      { id: 't1', text: 'Farmers brought wheat to the mills each harvest.', proof: S.wheat },
      { id: 't2', text: 'The mills used the power of falling water.', proof: S.wheels },
      { id: 't3', text: 'Rochester made more flour than any other city.', proof: S.largest },
      { id: 't4', text: 'The wheat business moved west, and nurseries grew.', proof: S.shift },
      { id: 't5', text: 'The city earned a second nickname.', proof: S.second },
      { id: 't6', text: 'Two partners gave nursery land to the city.', proof: S.gift },
    ],
    given: [0, 4],
  },
  solution: { prompt: 'What was the older of Rochester\'s two nicknames?', answers: ['Flour City', 'the Flour City', 'Flour'], proof: [S.flour, S.second] },
  report: { lead: 'The older nickname was the ___ City', keywords: ['flour', 'flower', 'mills', 'nurseries', 'wheat', 'second'] },
  closing: { who: 'chief', text: 'Case closed! Both names are right, because Rochester was the Flour City first and the Flower City later. The banner stays up, thanks to your careful reading.' },
  knowledge: 'Rochester was first known as the Flour City for its water-powered mills, and later as the Flower City for its nurseries and the lilacs of Highland Park.',
  teaser: 'Tomorrow: a lighthouse on the shore of Lake Ontario, and a captain who sailed right past the river.',
  facts: [
    { claim: 'Rochester has been known as the "Flour City" and the "Flower City"; it was initially a boomtown because of the fertile Genesee River valley, which gave rise to flour mills, and by 1838 it was the largest flour-producing city in the United States.', source: 'https://en.wikipedia.org/wiki/Rochester,_New_York' },
    { claim: 'As wheat processing moved west with population and agriculture, Rochester became home to an expanding nursery business that gave it the second nickname, the Flower City; nurseries ringed the city, the most famous started in 1840 by George Ellwanger and Patrick Barry.', source: 'https://en.wikipedia.org/wiki/Rochester,_New_York' },
    { claim: 'Mills at High Falls used the falling water of the Genesee River for power; the Erie Canal (finished 1825) linked the mills to the Hudson River and New York City.', source: 'https://blogs.rochester.edu/thegreendandelion/2022/09/how-hydropower-turned-rochester-into-the-flour-city/' },
    { claim: 'Ellwanger and Barry gave 20 acres of their nursery to Rochester for a park, which became Highland Park (sources give 1883 or 1888, so the case gives no year).', source: 'https://tclf.org/highland-park-rochester-ny' },
    { claim: 'Highland Park has more than 1,200 lilac shrubs and hosts the annual Lilac Festival each May.', source: 'https://en.wikipedia.org/wiki/Highland_Park_(Rochester,_New_York)' },
  ],
};
