// The real fact read aloud at each stop (SPEC §3 "lookout"): one or two sentences a 4th grader can follow, true,
// and traceable to docs/SOURCES.md. `say` is the spoken form (numbers in words, no abbreviations). Content stream
// fills all 12 (one per leg id) plus 'independence' (the start).
export const LOOKOUTS = {
  'independence': { text: 'Most wagon parties left Independence, Missouri in late April or May, once the prairie grass was tall enough to feed the animals.',
    say: 'Most wagon parties left Independence, Missouri in late April or May, once the prairie grass was tall enough to feed the animals.', source: 'SOURCES.md#independence' },
  'kansas-river': { text: 'The Kansas River was one of the first big crossings. Ferries run by local families carried wagons across for a fee.',
    say: 'The Kansas River was one of the first big crossings. Ferries run by local families carried wagons across for a fee.', source: 'SOURCES.md#kansas-river' },
  'fort-kearny': { text: 'Fort Kearny was built in 1848 to help travelers. Soldiers there kept a post office and a blacksmith shop.',
    say: 'Fort Kearny was built in eighteen forty-eight to help travelers. Soldiers there kept a post office and a blacksmith shop.', source: 'SOURCES.md#fort-kearny' },
  'chimney-rock': { text: 'Chimney Rock rises about 300 feet above the North Platte River. Travelers could see it for days before they reached it.',
    say: 'Chimney Rock rises about three hundred feet above the North Platte River. Travelers could see it for days before they reached it.', source: 'SOURCES.md#chimney-rock' },
};
