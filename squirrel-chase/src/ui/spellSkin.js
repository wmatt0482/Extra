// Spell Jump's spell panel (spell-jump/src/spelling/spellPanel.js) is reused as is for the sealed notes (SPEC §3). A few of its lines belong to Spell
// Jump's car ("Back to the garage", "+$400 · full power", "Let's jump anyway", the LAUNCH key). This re-words them for the chase without touching the
// shared module: a MutationObserver on the panel swaps those exact texts as the panel writes them, before the frame is painted (the pattern of Wagon
// West's spellSkin.js).
const RULES = [
  [/^\+\$[\d,]+ · full power$/, 'Nice spelling!'],
  [/^Good power$/, 'Note unlocked'],
  [/^Let's jump anyway$/, 'On we go'],
  [/^Launch$/i, 'Check'],
  [/^Boost$/i, 'Check'],
];

export function skinSpellPanel(root) {
  let busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.nodeValue;
        for (const [re, to] of RULES) if (re.test(t) && t !== to) { n.nodeValue = to; break; }
      }
      for (const b of root.querySelectorAll('[aria-label="Back to the garage"]')) b.setAttribute('aria-label', 'Back to the case');
    } finally { busy = false; }
  }
  const mo = new MutationObserver(apply);
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  apply();
  return { apply, disconnect() { mo.disconnect(); } };
}
