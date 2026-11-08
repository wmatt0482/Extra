import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'witness', title: 'Statement of a Hoggee', from: 'Nora Quinn, hoggee', stretch: false }, [
  [
    'My name is Nora Quinn, and I am eleven years old.',
    '@walk I am a hoggee on the Rosalie, and I walk beside my mule, Duke, along the towpath every day.',
    'The Rosalie is the fastest boat on this part of the canal, and everyone knows her by her bell.',
    '@claim Duke is the best mule on the canal, and he can read.',
    'I cannot read a word myself, but I never need to, because Duke does it for me.',
  ],
  [
    'I got Duke when he was a young mule, and the other hoggees laughed because he was so stubborn.',
    'A good hoggee learns her mule\'s habits, and I have learned every one of Duke\'s.',
    'He likes oats, he dislikes puddles, and he hates it when the towpath is muddy.',
  ],
  [
    '@sign Every lock has a white sign on a post that says LOCK AHEAD.',
    '@stops Every time we come to one, Duke looks at the sign, snorts, and stops.',
    'No matter how fast the Rosalie is moving, he stops in exactly the same spot.',
    'Captain Vance says a mule cannot read, but I have never been wrong about Duke.',
    'I asked Duke to read a sign out loud for the captain, but he is shy.',
  ],
]);

const d2 = doc('d2', { kind: 'logbook', title: 'Trial Book of the Great Mule Test', from: 'Lock tender Joseph Cole', stretch: false }, [
  [
    '@asked Captain Vance asked me to watch Duke on four trips past my lock and to write down exactly what I saw.',
    'Before the trials, the Rosalie crossed the aqueduct over the Genesee River, and Duke walked across without a pause, even though the river was loud.',
    '@t1 Trial one: With the sign in its usual place, the steersman blew his horn beside it, and Duke stopped.',
    '@t2 Trial two: We hung a feed sack over the sign so nobody could read it, but Duke stopped anyway when the steersman blew his horn.',
  ],
  [
    '@t3n Trial three: The sign stood in plain sight, but the steersman was busy reading a newspaper and did not blow his horn.',
    '@t3 Duke walked right past the sign and kept going.',
    'I had to wave my arms to stop him at the lock gate.',
    '@t4 Trial four: With the sign gone and the boat far from any lock, the steersman blew his horn in the middle of a cornfield, and Duke stopped at once.',
    'He stood there with corn leaves hanging out of his mouth.',
    'Captain Vance scratched his chin and said nothing for a long time.',
    'Some passengers on the roof of the packet had watched every trial, and one of them clapped.',
    'Nora, the young hoggee, only folded her arms and smiled, as if she had expected a surprise.',
  ],
]);

const d3 = doc('d3', { kind: 'letter', title: 'Letter to the Editor', from: 'Captain Lucas Vance, packet boat Rosalie', stretch: true }, [
  [
    'Sir, my young hoggee, Nora Quinn, says her mule Duke can read the signs beside our locks, and I confess that I laughed.',
    '@packet My packet, the Rosalie, is a swift boat for passengers, and she travels about four miles in an hour, a pace any thoughtful mule can keep.',
    'A hoggee on a packet must keep the mules moving at a steady pace along the towpath, for passengers dislike delay.',
    '@whyhorn It is the custom of every boatman to blow a horn before a lock, so that the lock tender may hear it and ready the gates.',
  ],
  [
    '@wish I wish, therefore, to learn whether a mule may truly read, or whether there is some simpler reason for his behavior.',
    'I have asked the lock tender to record four trials, and I shall abide by what they show.',
    'Should the mule prove to be a scholar, I will give him a double portion of oats.',
    'Should he prove to be only a mule, I shall give him the oats anyway, for the channel of this canal has seen no finer walker.',
    'In either case, I shall ask the hoggee to forgive an old captain for laughing.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids);

export default {
  id: 'erie-03', arc: 'erie', order: 3,
  title: 'The Case of the Mule Who Could Read',
  setting: 'Rochester, New York · autumn 1832',
  objective: 'Find out what really makes a mule stop at every lock.',
  words: [
    { word: 'towpath', meaning: 'the path beside a canal where mules walk and pull the boats', sentenceId: S.walk },
    { word: 'packet', meaning: 'a fast canal boat that carries passengers', sentenceId: S.packet },
    { word: 'steersman', meaning: 'the person who steers a boat with the tiller', sentenceId: S.t1 },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, a young hoggee says her mule can read. Her captain says that is nonsense. We need the truth.' },
    { who: 'chief', text: 'Find out what really makes the mule stop at every lock.' },
    { who: 'partner', text: 'A reading mule! I want to believe it. But first, I will check that it makes sense, and I will picture the towpath, step by step.' },
    { who: 'archivist', text: 'New words today: towpath, packet and steersman. Tap each one in its sentence for its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc],
  questions: [
    { id: 'q1', type: 'evidence', std: '4R1',
      prompt: 'Which sentence tells what Duke does every time he comes to a sign?',
      answer: [S.stops],
      hint: 'Ask a question: what exactly does Nora say Duke does when he comes to a sign?',
      model: 'Nora says Duke looks at the sign, snorts, and stops. That is what she believes shows he can read.',
      why: 'This sentence tells what Nora sees Duke do every time, and that is the thing we need to explain.' },
    { id: 'q2', type: 'evidence', std: '4R1',
      prompt: 'Which sentence tells what happened when the sign was covered with a feed sack?',
      answer: [S.t2],
      hint: 'Check each trial. In which one was the sign hidden?',
      model: 'In trial two the sign was covered with a feed sack. Nobody could read it, but Duke stopped anyway.',
      why: 'Duke stopped even with the sign covered, so reading the sign cannot be why he stops.' },
    { id: 'q3', type: 'word', std: '4R4',
      prompt: 'Which sentence tells you what kind of boat a packet is?',
      answer: [S.packet],
      hint: 'Look in Captain Vance\'s letter, where he describes his boat and who rides on it.',
      model: 'The captain calls the Rosalie "a swift boat for passengers." So a packet is a fast boat that carries people.',
      why: 'The captain tells us his packet is a swift boat for passengers, so that is what the word means.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows that Duke stops even when there is no sign and no lock close by?',
      answer: [S.t4],
      hint: 'Picture the cornfield. Which trial happened far from any lock?',
      model: 'In trial four there was no sign and no lock. Duke still stopped, so something else must be telling him.',
      why: 'Duke stopped in the middle of a cornfield, so neither the sign nor the lock made him stop.' },
    { id: 'q5', type: 'evidence', std: '4R3',
      prompt: 'Which sentence explains why boatmen blow a horn before a lock?',
      answer: [S.whyhorn],
      hint: 'The captain explains a boatman\'s custom in his letter. Who needs to hear the horn?',
      model: 'The captain says the horn lets the lock tender hear the boat coming, so the gates will be ready.',
      why: 'This sentence tells why a horn is blown near every lock: it warns the lock tender that a boat is coming.' },
    { id: 'q6', type: 'main', std: '4R2',
      prompt: 'Which sentence in the captain\'s letter tells what he wishes to learn?',
      answer: [S.wish],
      hint: 'Sum up the letter: what question is the captain trying to answer?',
      model: 'The captain wishes to learn whether a mule may truly read, or whether there is a simpler explanation.',
      why: 'This sentence names the question behind the four trials, so it sums up the captain\'s purpose.' },
  ],
  timeline: {
    kind: 'sequence', prompt: 'Put the day of the great mule test in order.',
    items: [
      { id: 't1', text: 'Nora told everyone that Duke could read.', proof: S.claim },
      { id: 't2', text: 'The captain asked the lock tender to watch four trials.', proof: S.asked },
      { id: 't3', text: 'Trial one: the sign was in its place, and Duke stopped.', proof: S.t1 },
      { id: 't4', text: 'Trial two: the sign was covered, and Duke stopped anyway.', proof: S.t2 },
      { id: 't5', text: 'Trial three: Duke walked right past the sign.', proof: S.t3 },
      { id: 't6', text: 'Trial four: the sign was gone, and Duke stopped in a cornfield.', proof: S.t4 },
    ],
    given: [0, 3],
  },
  solution: { prompt: 'What really makes Duke stop?', answers: ['horn', 'the horn', 'a horn', 'the steersman\'s horn', 'steersman\'s horn', 'sound of the horn', 'the sound of the horn', 'the sound of horn'], proof: [S.t3n, S.t3, S.t4] },
  report: { lead: 'Duke stopped at the sound of the ___', keywords: ['horn', 'sound', 'sign', 'steersman', 'stopped', 'heard'] },
  closing: { who: 'chief', text: 'Case closed! Duke cannot read, but he is a very good listener. Nora trained him well, and you read the evidence even better.' },
  knowledge: 'Boatmen on canals blew horns to warn lock tenders that a boat was coming, and a packet boat carried passengers at about four miles an hour.',
  teaser: 'Tomorrow: a merchant is charged for five tons of flour he never shipped. Who made the mistake?',
  facts: [
    { claim: 'Mules (or horses) pulled boats from the towpath, led by a young driver called a hoggee; a towpath ran beside the canal.', source: 'https://scdemocratonline.com/stories/hoggees-on-the-towpath,57342' },
    { claim: 'Packet boats carried passengers and moved at about four miles an hour.', source: 'https://stagecoachdays.blogspot.com/2012/12/the-packet-and-stagecoach.html' },
    { claim: 'Boatmen on eastern canals used horns to alert lock tenders that a boat was approaching.', source: 'https://lewis-clark.org/boats/the-sounding-horn/' },
    { claim: 'Girls and women also worked as hoggees on the canal.', source: 'https://www.canalmuseum.org/the-snubbing-post/in-her-words' },
  ],
};
