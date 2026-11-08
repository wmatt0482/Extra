import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'notice', title: 'Weigh Lock Slip', from: 'Weighmaster, Rochester weigh lock', stretch: false }, [
  [
    'Boat weighed today: the line boat Lively Nell, Captain Joseph Marsh.',
    'She crossed the aqueduct at nine o\'clock and floated into the weigh lock at ten.',
    '@gross Weight of the boat and her cargo together: 55 tons.',
    '@slipempty Empty weight of the boat, taken from the register: 20 tons.',
    '@slipcargo Weight of the cargo: 35 tons.',
    'Toll to be paid on 35 tons of flour, shipped by the merchant Rafael Ortega.',
  ],
  [
    'A packet boat waited behind her with the passengers fanning themselves in the heat.',
    'The hoggee, a boy named Sam, walked the mules to the water trough while the weighing was done.',
    'Weighed and entered by the weighmaster on duty.',
    'Remark: The boat behind the Lively Nell will be weighed next.',
  ],
]);

const d2 = doc('d2', { kind: 'letter', title: 'Letter from a Merchant', from: 'Rafael Ortega, merchant', stretch: false }, [
  [
    'To the Collector of Tolls, Rochester.',
    '@merchant I am Rafael Ortega, a merchant, which means I buy goods and sell them again for a living.',
    'I sent 300 barrels of flour east on the Lively Nell, as my waybill shows.',
    'My waybill lists the cargo as 300 barrels of flour, bound east for the merchants of Albany.',
    '@counted My clerk, Mr. Dunn, counted the barrels as they rolled aboard, and he counted 300 twice.',
    '@thirty My 300 barrels of flour, at ten barrels to the ton, weigh about thirty tons.',
  ],
  [
    '@cargodef Cargo is everything a boat carries.',
    '@noextra Nothing besides my flour was aboard, for Captain Marsh\'s mate wrote down every item that came on board.',
    '@toomany Yet your slip charges me a toll on thirty-five tons, which is five tons too many.',
    'I do not believe my flour grew heavier on the canal.',
    'The Lively Nell has carried my cargo down the channel of the canal many times, and the toll was never so high.',
    'I ask that you look at your figures again, as I believe there has been an honest mistake.',
    'My clerk, Mr. Dunn, has also made mistakes, I admit, but never one that added five tons.',
    'I am a patient merchant, but I cannot pay a toll on flour that never existed.',
  ],
]);

const d3 = doc('d3', { kind: 'logbook', title: 'Register of Canal Boats', from: "Collector's Office, Rochester", stretch: false }, [
  [
    'Register of canal boats, as kept at the collector\'s office.',
    'Every boat that carries cargo upon the canal is listed here, together with its owner and its empty weight.',
    'The weighmaster must open this book each time a boat floats onto the scale.',
    '@regnell The line boat Lively Nell: registered empty weight, 25 tons.',
    '@regnancy The line boat Lively Nancy: registered empty weight, 20 tons.',
    'Both boats belong to the same owner, and both carry cargo for merchants between Rochester and Albany.',
    '@twins The two boats were built in the same boatyard, so they look almost alike, and both are painted green.',
  ],
]);

const d4 = doc('d4', { kind: 'notice', title: 'Notice to Boatmen', from: 'The Collector of Tolls', stretch: true }, [
  [
    '@howtoll Be it known to all boatmen that the toll upon cargo shall be reckoned by weight, in the manner here described.',
    '@howweigh The boat shall be floated upon the great scale of the weigh lock, and her whole weight, together with her cargo, shall be set down.',
    '@subtract From this sum there shall be subtracted the weight of the boat when empty, as set down in the register of boats, and what is left is the weight of the cargo.',
  ],
  [
    'The merchant who ships the goods will pay his share of the toll, and so he has a good reason to care about the figures.',
    'The rate of the toll changes with the kind of goods carried, and the collector sets it for each.',
    'The weighmaster, who must be careful and exact, is answerable to the collector for every figure that he records.',
    'Every boatman is asked to read the figures on his slip before he leaves the weigh lock.',
    'The toll collector keeps a ledger of every boat and every ton, so that no merchant is charged twice for the same cargo.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids, d4.ids);

export default {
  id: 'erie-04', arc: 'erie', order: 4,
  title: 'The Case of the Heavy Flour',
  setting: 'Rochester, New York · the 1840s',
  objective: 'Find out why Mr. Ortega was charged for five tons of flour he never shipped, and whose boat weight was used by mistake.',
  words: [
    { word: 'merchant', meaning: 'a person who buys goods and sells them again', sentenceId: S.merchant },
    { word: 'cargo', meaning: 'everything a boat carries', sentenceId: S.cargodef },
    { word: 'toll', meaning: 'money a boat pays to use the canal', sentenceId: S.toomany },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, a merchant in Rochester is furious. The toll office says his flour weighed five tons more than it really did.' },
    { who: 'chief', text: 'Find out whose boat weight was used by mistake.' },
    { who: 'partner', text: 'This one has numbers! Let me picture the scale first, then check that every number makes sense.' },
    { who: 'archivist', text: 'Words today: merchant, cargo and toll. Tap each one, and I will give you its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc, d4.doc],
  questions: [
    { id: 'q1', type: 'evidence', std: '4R3',
      prompt: 'Which sentence explains what is subtracted to find the weight of the cargo?',
      answer: [S.subtract],
      hint: 'Read the notice to boatmen. Which step takes something away from the whole weight?',
      model: 'The notice says to take the empty weight of the boat away from the whole weight. What is left is the cargo.',
      why: 'This sentence gives the rule: whole weight minus the boat\'s empty weight equals the weight of the cargo.' },
    { id: 'q2', type: 'main', std: '4R2',
      prompt: 'Which sentence in the notice best sums up what the toll is based on?',
      answer: [S.howtoll],
      hint: 'Sum it up: the very first sentence of the notice tells the big idea. What is the toll based on?',
      model: 'The notice begins by saying the toll upon cargo is reckoned by weight. Every other sentence explains how.',
      why: 'This opening sentence gives the main idea: the toll depends on the weight of the cargo, which is why a wrong weight means a wrong toll.' },
    { id: 'q3', type: 'inference', std: '4R1',
      prompt: 'Which sentence shows how many tons Mr. Ortega\'s 300 barrels should weigh?',
      answer: [S.thirty],
      hint: 'Mr. Ortega did the math in his letter. How many barrels make a ton?',
      model: 'He sent 300 barrels, and ten barrels make a ton. That is 300 divided by 10, which is 30 tons.',
      why: 'The letter gives the number of barrels and how many make a ton, so his flour should weigh about thirty tons.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence on the weigh lock slip shows the empty weight the weighmaster wrote down for the boat?',
      answer: [S.slipempty],
      hint: 'Look at the weigh lock slip. What did the weighmaster write down for the empty boat?',
      model: 'The slip says the empty weight of the boat was 20 tons, taken from the register. Keep that number in mind and compare it with the register.',
      why: 'The slip used 20 tons for the empty boat. The register gives the Lively Nell 25 tons, so the weighmaster used a number that belongs to a different boat.' },
    { id: 'q5', type: 'word', std: '4R4',
      prompt: 'Which sentence helps you understand what cargo means?',
      answer: [S.cargodef],
      hint: 'Mr. Ortega uses the word and then says what it is in a very short sentence.',
      model: 'The sentence says "Cargo is everything a boat carries." It explains the word right away.',
      why: 'This short sentence tells us cargo means everything a boat carries.' },
    { id: 'q6', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the register gives the empty weight of the Lively Nell?',
      answer: [S.regnell],
      hint: 'Boats are listed in the register. Find the line for the Lively Nell.',
      model: 'The register lists each boat by name. The line for the Lively Nell says 25 tons.',
      why: 'The register is the official list, and it gives the Lively Nell an empty weight of 25 tons.' },
  ],
  timeline: {
    kind: 'cause', prompt: 'How did the mistake happen? Put the chain in order.',
    items: [
      { id: 't1', text: 'Mr. Ortega\'s 300 barrels of flour were loaded onto the Lively Nell.', proof: S.counted },
      { id: 't2', text: 'The boat floated onto the great scale of the weigh lock.', proof: S.howweigh },
      { id: 't3', text: 'The scale showed the boat and cargo together weighed 55 tons.', proof: S.gross },
      { id: 't4', text: 'The weighmaster wrote down an empty weight of 20 tons from the register.', proof: S.slipempty },
      { id: 't5', text: 'He wrote that the cargo weighed 35 tons.', proof: S.slipcargo },
      { id: 't6', text: 'Mr. Ortega wrote to complain of five tons too many.', proof: S.toomany },
    ],
    given: [0, 2],
  },
  solution: { prompt: 'Whose empty weight did the weighmaster use by mistake? Name the boat.', answers: ['Lively Nancy', 'Nancy', 'the Nancy', 'the Lively Nancy'], proof: [S.slipempty, S.regnancy] },
  report: { lead: 'The weighmaster used the empty weight of the ___', keywords: ['Nancy', 'empty', 'weight', 'twenty', '20', 'register', 'boat'] },
  closing: { who: 'chief', text: 'Case closed! Two green boats with almost the same name caused one very grumpy merchant. The weighmaster will fix the slip, and you checked every number like a pro.' },
  knowledge: 'On the Erie Canal, the toll was figured by weighing the boat on a weigh lock scale and subtracting the boat\'s registered empty weight to find the weight of the cargo.',
  teaser: 'Tomorrow: the oldest file in the cabinet, from the very week the canal opened. Three kegs, and no labels.',
  facts: [
    { claim: 'Canal tolls were based on cargo weight: a boat was weighed on a weigh lock scale, and its registered empty weight was subtracted from the total to find the weight of the cargo.', source: 'https://eriecanalmuseum.org/weighlock-building-home/' },
    { claim: 'The toll rate per ton differed with the kind of cargo.', source: 'https://bookwormhistory.com/2015/11/24/how-did-they-levy-tolls-on-the-erie-canal/' },
    { claim: 'Rochester was one of the five places on the Erie Canal with a weigh lock (with Albany, West Troy, Utica and Syracuse).', source: 'https://genealogy.bio/reference/New_York/new_york054.html' },
    { claim: 'Toll records list the boat, its master, the articles shipped, where bound and the weight; weighmasters worked for the toll collector.', source: 'https://snaccooperative.org/vocab_administrator/resources/8210835' },
    { claim: 'The Erie Canal was a toll canal until 1883.', source: 'https://bookwormhistory.com/2015/11/24/how-did-they-levy-tolls-on-the-erie-canal/' },
  ],
};
