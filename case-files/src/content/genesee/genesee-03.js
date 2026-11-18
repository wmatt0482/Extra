import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'logbook', title: 'Ranger\'s Log', from: 'Dana Whitfield, park ranger', stretch: false }, [
  [
    'I am Dana Whitfield, a park ranger at Letchworth State Park, where the Genesee River flows north through a deep gorge.',
    '@gorgedef A gorge is a deep, narrow valley with steep rock walls, and a river runs along the bottom.',
    'On a busy morning like this one, I answer questions from visitors all day long, and most of them are about the waterfalls.',
    '@claim Today a fourth grader named Sam showed me a photo and said, "This is the Middle Falls, the tallest waterfall in the park!"',
  ],
  [
    '@photo In his photo, the river tumbles over a low, wide ledge, and a railroad bridge crosses the gorge right above the falls.',
    'Sam is very proud of the picture, and he is sure of the name, because the Middle Falls is the one he came to see.',
    '@hiked But Sam also told me that he started his walk at the Middle Falls and then hiked upstream along the river before he took the picture.',
    '@signread A good ranger does not just say yes or no, so I asked Sam to look at the photo and the park sign with me.',
    'The sign tells which waterfall is which, and we must read it with care.',
    'Out in the gorge, the current of the river is strong and loud, and Sam had to shout to be heard over it.',
    'Sam is not worried, because a mix-up is only a puzzle that has not been solved yet.',
  ],
]);

const d2 = doc('d2', { kind: 'placard', title: 'Welcome to Letchworth State Park', from: 'Letchworth State Park', stretch: false }, [
  [
    '@grand Welcome to Letchworth State Park, where the Genesee River has cut a gorge so deep that people call it the Grand Canyon of the East.',
    'The gorge walls rise as high as 600 feet in some places, and forests grow along the top.',
    '@three The river rushes over three major waterfalls, which are called the Upper Falls, the Middle Falls and the Lower Falls.',
    '@order The river flows north, so if you stand at the Middle Falls and hike upstream, you will come to the Upper Falls, and the Lower Falls lies the other way, downstream.',
    '@middle The Middle Falls is the highest of the three.',
    'The current is swift here, so please keep well back from the edge.',
  ],
  [
    '@bridge A railroad bridge crosses the gorge just above the Upper Falls, so visitors at the Upper Falls can see a train bridge high over the river.',
    '@ice Long ago, a huge sheet of ice called a glacier blocked the old river valley, and the Genesee River had to cut a new path through the rock, which made this young gorge.',
    'In 1906, William Pryor Letchworth gave his land to New York State, and it became the heart of the park.',
    'Hikers will find many trails and lookouts, so please stay behind the railings and enjoy the view of the valley.',
    'The park is open all year, and each season gives the gorge a new look.',
  ],
]);

const d3 = doc('d3', { kind: 'letter', title: 'Letter from the Park Naturalist', from: 'Dr. Priya Nair, park naturalist', stretch: true }, [
  [
    'Dear Sam, rangers love a good question, and yours made me think about how this land was made.',
    'The Genesee River once ran through a different valley.',
    'Ice from the last glacier blocked the old route, so the river had to find another way north.',
    'The current pressed against the rock again and again, and it carved the gorge you see today.',
  ],
  [
    'A river does not cut through stone all at once, since the swift current wears away only a little rock at a time.',
    'That is why scientists call this gorge young.',
    'Wherever you stand along the rim, remember that the river is still at work, and that the valley is still slowly changing.',
    'Next time you take a photograph, check the signs before you name a waterfall, and keep thinking like a detective.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids);

export default {
  id: 'genesee-03', arc: 'genesee', order: 3, town: 'letchworth',
  title: 'The Case of the Mixed-Up Waterfall',
  setting: 'Letchworth State Park, New York · today',
  objective: 'Find out which waterfall is really in Sam\'s photo.',
  words: [
    { word: 'gorge', meaning: 'a deep, narrow valley with steep rock walls and a river along the bottom', sentenceId: S.gorgedef },
    { word: 'glacier', meaning: 'a huge sheet of ice that moves slowly over the land', sentenceId: S.ice },
    { word: 'upstream', meaning: 'toward the place where a river begins', sentenceId: S.hiked },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, today we are in Letchworth State Park, where the Genesee River runs through a deep gorge and over three waterfalls.' },
    { who: 'chief', text: 'A fourth grader named Sam took a photo and named the falls. A ranger thinks he may have the name wrong.' },
    { who: 'partner', text: 'I will check whether the photo makes sense with what the park sign says. Pictures can hold clues too.' },
    { who: 'archivist', text: 'Today\'s words are gorge, glacier and upstream. Tap each one, and I will give you its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc],
  questions: [
    { id: 'q1', type: 'word', std: '4R4',
      prompt: 'Which sentence in the log helps you understand what a gorge is?',
      answer: [S.gorgedef],
      hint: 'Look for the sentence that uses the word gorge and then tells what one is like.',
      model: 'The log says a gorge is a deep, narrow valley with steep rock walls. The words after "is" give the meaning.',
      why: 'The sentence says a gorge is a deep, narrow valley with steep walls and a river at the bottom.' },
    { id: 'q2', type: 'evidence', std: '4R1',
      prompt: 'Which sentence on the sign tells which of the three waterfalls is the highest?',
      answer: [S.middle],
      hint: 'The sign names three waterfalls. Which one does it say is highest?',
      model: 'The sign says the Middle Falls is the highest of the three. That is the one Sam named.',
      why: 'This sentence says the Middle Falls is the highest, so a photo of a tall waterfall would be the Middle Falls.' },
    { id: 'q3', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the log shows that Sam\'s waterfall does not look tall?',
      answer: [S.photo],
      hint: 'Picture Sam\'s photo. How does the water drop in it?',
      model: 'In the photo the river tumbles over a low, wide ledge. A low ledge does not sound like the highest waterfall.',
      why: 'A low ledge does not match the highest waterfall, so the photo is probably not the Middle Falls.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence on the sign shows that hiking upstream from the Middle Falls leads to the Upper Falls?',
      answer: [S.order],
      hint: 'Sam went upstream from the Middle Falls. What does the sign say you reach if you go that way?',
      model: 'The sign says that upstream from the Middle Falls is the Upper Falls, and that the Lower Falls is the other way. So Sam went toward the Upper Falls.',
      why: 'Upstream from the Middle Falls is the Upper Falls, so Sam could not have been at the Lower Falls.' },
    { id: 'q5', type: 'inference', std: '4R1',
      prompt: 'Which sentence on the sign tells where a railroad bridge can be seen?',
      answer: [S.bridge],
      hint: 'Sam\'s photo has a railroad bridge in it. Which falls does the sign say is close to a railroad bridge?',
      model: 'The sign says a railroad bridge crosses the gorge just above the Upper Falls. Sam\'s photo has a bridge above the falls, so it matches.',
      why: 'The railroad bridge stands just above the Upper Falls, which matches the bridge in Sam\'s photo.' },
    { id: 'q6', type: 'main', std: '4R2',
      prompt: 'Which sentence on the sign best sums up how the gorge was made?',
      answer: [S.ice],
      hint: 'Sum it up: what happened long ago to the old river valley? Look in the second paragraph of the sign.',
      model: 'A glacier blocked the old valley, so the river cut a new path through rock. That path is the young gorge.',
      why: 'This sentence explains that a glacier blocked the old valley and the river carved a new gorge.' },
  ],
  timeline: {
    kind: 'sequence', prompt: 'How did the ranger and Sam solve the mix-up? Put the morning in order.',
    items: [
      { id: 't1', text: 'Sam showed the ranger his photo.', proof: S.claim },
      { id: 't2', text: 'Sam said it was the Middle Falls.', proof: S.claim },
      { id: 't3', text: 'The ranger noticed the low ledge and the bridge in the photo.', proof: S.photo },
      { id: 't4', text: 'Sam said he had hiked upstream before taking the picture.', proof: S.hiked },
      { id: 't5', text: 'They read the park sign carefully.', proof: S.signread },
      { id: 't6', text: 'They matched the photo to the sign.', proof: S.bridge },
    ],
    given: [0, 5],
  },
  solution: { prompt: 'Which waterfall is in Sam\'s photo?', answers: ['Upper Falls', 'the Upper Falls', 'upper'], proof: [S.photo, S.bridge] },
  report: { lead: 'The photo shows the ___', keywords: ['upper', 'bridge', 'railroad', 'ledge', 'upstream', 'middle'] },
  closing: { who: 'chief', text: 'Case closed! Sam\'s photo shows the Upper Falls, with the railroad bridge standing above it and the current rushing below. Great work matching a picture to a sign, Detective.' },
  knowledge: 'Letchworth State Park, known as the Grand Canyon of the East, is cut by the Genesee River and has three major waterfalls: the Upper, Middle and Lower Falls.',
  teaser: 'Tomorrow: two names for one city, and a banner that someone says is spelled wrong.',
  facts: [
    { claim: 'Letchworth State Park is known as the "Grand Canyon of the East"; the Genesee River goes through the gorge over three major waterfalls, between cliffs as high as 600 feet in places.', source: 'https://parks.ny.gov/parks/letchworth' },
    { claim: 'The three major falls are called the Upper, Middle and Lower Falls; the Middle Falls is the highest.', source: 'https://en.wikipedia.org/wiki/Letchworth_State_Park' },
    { claim: 'A railroad bridge (the Portage Viaduct until 2017, now an arch bridge) crosses immediately above the Upper Falls.', source: 'https://en.wikipedia.org/wiki/Letchworth_State_Park' },
    { claim: 'The Genesee River flows north through the park, which is roughly 17 miles long.', source: 'https://en.wikipedia.org/wiki/Letchworth_State_Park' },
    { claim: 'The gorge is geologically young, formed when the last continental glacier diverted the river from its old valley and forced it to cut a new one.', source: 'https://en.wikipedia.org/wiki/Letchworth_State_Park' },
    { claim: 'William Pryor Letchworth began buying land near the Middle Falls in 1859 and gave his 1,000-acre estate to New York in 1906, which became the core of the park.', source: 'https://en.wikipedia.org/wiki/Letchworth_State_Park' },
  ],
};
