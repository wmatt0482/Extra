// What Squirrel Chase tells the Lab when a case closes (SPEC §7): ONE flat event per closed case, the same whatever the accuracy (so this takes no
// accuracy at all), nothing per word. The spelling words bank in Spell Jump's own store and its 8-word mission, not in the Lab. 'day' is the
// Lab's once-a-day mark across all games; the Lab pays it only once a local day.
export function closeReports({ firstCaseToday = true } = {}) {
  const out = [{ event: 'case' }];
  if (firstCaseToday) out.push({ event: 'day' });
  return out;
}
