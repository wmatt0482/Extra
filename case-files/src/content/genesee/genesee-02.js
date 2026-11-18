import { doc, handles } from '../helpers.js';

const d1 = doc('d1', { kind: 'logbook', title: 'Notebook of an Apprentice Printer', from: 'Hattie Moore, apprentice printer', stretch: false }, [
  [
    '@intro I am Hattie Moore, and I am an apprentice in the Rochester print shop where Mr. Frederick Douglass is the editor of a brand-new newspaper called The North Star.',
    'Rochester sits beside the Genesee River, in a valley full of farms and flour mills, and tonight our shop is quiet except for the clink of metal.',
    '@bysand In 1847, printing meant setting every letter by hand: I pick tiny metal letters from a case, line them up in a stick, and lock them into a frame.',
    '@proofdef Tonight I pulled the first proof, which is a test copy printed to check the type for mistakes.',
    'The first issue must be ready for readers on December 3, so tonight we must be careful and sure.',
  ],
  [
    '@mottodef Under the name at the top of page one, there should be a motto, which is a short saying that tells what the newspaper stands for.',
    '@proofsees On my proof I can see the line about Right and the line about God, but the space between them is empty.',
    '@searched I have looked in the type case, in my apron pockets and under the press, and I cannot find the missing line.',
    '@joe My friend Joe thinks he must have dropped it, but Joe has been sweeping the front room all evening, and I could hear his broom the entire time.',
    '@asked The editor is away at a meeting, so I asked the shop foreman, Mr. Walsh, what the motto is supposed to say.',
    'He wrote me a note, and now I must read it carefully.',
    'The editor trusts every one of us to get the words right, and I do not want to let him down.',
    'Mr. Walsh says that a good printer reads each line twice, once with the eyes and once with the fingers.',
    'I sat down at the long table, took a deep breath, and began to think the problem through.',
  ],
]);

const d2 = doc('d2', { kind: 'note', title: 'Note from the Shop Foreman', from: 'Mr. Walsh, shop foreman', stretch: false }, [
  [
    'Hattie, here is what I know about the motto of The North Star.',
    '@three The motto has three lines, one right after the other, and the paper must print all three.',
    '@lines The lines read: "Right is of no Sex," then "Truth is of no Color," and then "God is the Father of us all, and we are all Brethren."',
    'The editor wants these words printed exactly, because they tell readers what his newspaper is for.',
  ],
  [
    'Each line is set in its own row of type, so one row can slip out of the frame without the others moving.',
    '@pull When you pull a proof, check every row against these three lines, one by one.',
    'Once you find the missing row, set it again and lock it in the frame.',
    'Then pull one more proof, and show it to the editor when he returns.',
    'A page with a hole in it cannot go out to readers, however fine the rest may look.',
    'The mills along the river can wait for their handbills until the morning.',
  ],
]);

const d3 = doc('d3', { kind: 'newspaper', title: 'Notice to Our Readers', from: 'The office of The North Star, Rochester', stretch: true }, [
  [
    'Friends and readers, this paper, The North Star, appears in Rochester on December 3, 1847.',
    'It is edited by Frederick Douglass, and the editor means to reach readers in every part of the Genesee Valley and across the nation.',
    'It will be printed every week, and each issue will fill four pages.',
    'The editor will speak plainly against slavery, and he will work for the freedom of Black Americans.',
  ],
  [
    'The motto under our name tells our purpose.',
    'Its first line, "Right is of no Sex," shows that the paper stands with those who ask that women, as well as men, be heard.',
    'We ask every reader in the nation to judge this paper by what it prints, week after week.',
    'The editor thanks you for reading, and he invites readers across the nation to write to the paper.',
    'Letters from readers will help this newspaper grow in the weeks to come.',
  ],
]);

const S = handles(d1.ids, d2.ids, d3.ids);

export default {
  id: 'genesee-02', arc: 'genesee', order: 2, town: 'rochester',
  title: 'The Case of the Short Motto',
  setting: 'Rochester, New York · December 1847',
  objective: 'Find out which line of the newspaper\'s motto went missing from the first proof.',
  words: [
    { word: 'proof', meaning: 'a test copy printed to check the type for mistakes', sentenceId: S.proofdef },
    { word: 'motto', meaning: 'a short saying that tells what a group or newspaper stands for', sentenceId: S.mottodef },
    { word: 'editor', meaning: 'the person who chooses and shapes what a newspaper prints', sentenceId: S.intro },
  ],
  briefing: [
    { who: 'chief', text: 'Detective, it is the night before the very first issue of The North Star, a newspaper edited by Frederick Douglass in Rochester.' },
    { who: 'chief', text: 'An apprentice printer named Hattie has a test copy with something missing. Find out what.' },
    { who: 'partner', text: 'I will picture the print shop, with its rows of tiny metal letters. A missing row should be easy to spot, if we know what belongs there.' },
    { who: 'archivist', text: 'Today\'s words are proof, motto and editor. Tap each one, and I will give you its meaning.' },
  ],
  docs: [d1.doc, d2.doc, d3.doc],
  questions: [
    { id: 'q1', type: 'word', std: '4R4',
      prompt: 'Which sentence in the notebook helps you understand what a proof is?',
      answer: [S.proofdef],
      hint: 'Look for the sentence that uses the word proof and then says what it is.',
      model: 'Hattie says a proof is a test copy printed to check the type for mistakes. The words after "which is" give the meaning.',
      why: 'The sentence says a proof is a test copy used to find mistakes, so Hattie pulled one to check the type.' },
    { id: 'q2', type: 'evidence', std: '4R1',
      prompt: 'Which sentence in the notebook tells what Hattie could see on her proof?',
      answer: [S.proofsees],
      hint: 'Hattie looked at the test copy. What did she find near the top of the page?',
      model: 'On the proof, Hattie saw two lines, and an empty space between them. That is where the problem is.',
      why: 'The sentence names the two lines that printed and shows that something is missing between them.' },
    { id: 'q3', type: 'evidence', std: '4R3',
      prompt: 'Which sentence in the foreman\'s note tells how many lines the motto should have?',
      answer: [S.three],
      hint: 'Mr. Walsh wrote about the motto in his first few lines. How many lines does it have?',
      model: 'Hattie saw only two lines, but the foreman says the motto has three. So one line is gone.',
      why: 'The motto has three lines, and the proof showed only two, so a line is missing.' },
    { id: 'q4', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the notebook shows that Joe did not take the line?',
      answer: [S.joe],
      hint: 'Joe could not have taken the line if he was somewhere else. What was he doing all evening?',
      model: 'Joe was sweeping the front room, and Hattie heard his broom the whole time. He was not near the type, so he is cleared.',
      why: 'Hattie heard Joe sweeping the entire time, so he could not have been at the type case.' },
    { id: 'q5', type: 'main', std: '4R2',
      prompt: 'Which sentence in the notebook best sums up how a printer in 1847 made a page?',
      answer: [S.bysand],
      hint: 'Sum it up: how did the printers get letters onto a page? Look near the beginning of the notebook.',
      model: 'Printers set every letter by hand, picking them from a case and locking them into a frame. That is how a page was made.',
      why: 'This sentence sums up the whole job: every letter was picked and set by hand.' },
    { id: 'q6', type: 'inference', std: '4R1',
      prompt: 'Which sentence in the foreman\'s note tells Hattie what to do when she pulls a proof?',
      answer: [S.pull],
      hint: 'Look for the sentence that begins with the words when you pull a proof.',
      model: 'The foreman says to check every row against the three lines, one by one. That is how a missing row will show up.',
      why: 'Checking each row against the three lines is the way to spot which one is not on the proof.' },
  ],
  timeline: {
    kind: 'sequence', prompt: 'What did Hattie do on the night before the first issue? Put her evening in order.',
    items: [
      { id: 't1', text: 'Hattie set the letters in a frame, one by one.', proof: S.bysand },
      { id: 't2', text: 'She pulled the first proof to check the type.', proof: S.proofdef },
      { id: 't3', text: 'She saw an empty space between two lines.', proof: S.proofsees },
      { id: 't4', text: 'She searched the type case, her apron and the press.', proof: S.searched },
      { id: 't5', text: 'She asked the foreman what the motto should say.', proof: S.asked },
      { id: 't6', text: 'The foreman wrote her a note about the motto.', proof: S.three },
    ],
    given: [1, 5],
  },
  solution: { prompt: 'Which line of the motto was missing from the proof?', answers: ['Truth is of no Color', 'truth', 'the truth line', 'Truth is of no Colour'], proof: [S.proofsees, S.lines] },
  report: { lead: 'The missing line was the one about ___', keywords: ['truth', 'color', 'motto', 'proof', 'line', 'three'] },
  closing: { who: 'chief', text: 'Case closed! Hattie sets the Truth line back in its row, and the first issue of The North Star will carry its whole motto for the editor to see. Fine work comparing the proof with the note.' },
  knowledge: 'Frederick Douglass published The North Star, a weekly newspaper, in Rochester starting on December 3, 1847.',
  teaser: 'Tomorrow: a gorge, three waterfalls and a photo that might show the wrong one.',
  facts: [
    { claim: 'The North Star was an anti-slavery newspaper edited by Frederick Douglass, first published December 3, 1847, in Rochester, New York.', source: 'https://en.wikipedia.org/wiki/The_North_Star_(anti-slavery_newspaper)' },
    { claim: 'The North Star published weekly and was four pages long.', source: 'https://en.wikipedia.org/wiki/The_North_Star_(anti-slavery_newspaper)' },
    { claim: 'The North Star\'s motto: "Right is of no Sex—Truth is of no Color—God is the Father of us all, and we are all Brethren."', source: 'https://en.wikipedia.org/wiki/The_North_Star_(anti-slavery_newspaper)' },
    { claim: 'In the first issue Douglass said the paper would work against slavery and for the improvement of African Americans; "Right is of no Sex" also signaled support for women\'s rights.', source: 'https://en.wikipedia.org/wiki/The_North_Star_(anti-slavery_newspaper)' },
    { claim: 'Frederick Douglass\'s newspapers (1847 to 1874) are held online by the Library of Congress.', source: 'https://www.loc.gov/collections/frederick-douglass-newspapers/about-this-collection' },
  ],
};
