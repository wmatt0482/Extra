// Spell Jump's spell panel (car-jump/src/spelling/spellPanel.js) is reused as is for the river words and the letter
// (SPEC §2, §12); a few of its lines belong to Spell Jump's car ("Back to the garage", "LAUNCH", "+$400 · full power",
// "Let's jump anyway"). This re-words them for the trail without touching the shared module: a MutationObserver on the
// panel swaps those exact texts (and the exit button's label) as the panel writes them, before the frame is painted.
// setContext('river' | 'post') picks the line under "Perfect spell!".
const LINES = {
  river: { perfect: 'Across the water!', fixed: 'Good as new', enter: 'Done' },
  post: { perfect: 'Into the letter!', fixed: 'Good as new', enter: 'Done' },
};

export function skinSpellPanel(root) {
  let ctx = 'river';
  const rules = () => [
    [/^\+\$[\d,]+ · full power$/, LINES[ctx].perfect],
    [/^Good power$/, LINES[ctx].fixed],
    [/^Let's jump anyway$/, 'On we go'],
    [/^Launch$/i, LINES[ctx].enter],
  ];
  let busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const rs = rules();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.nodeValue;
        for (const [re, to] of rs) if (re.test(t) && t !== to) { n.nodeValue = to; break; }
      }
      for (const b of root.querySelectorAll('[aria-label="Back to the garage"]')) b.setAttribute('aria-label', 'Back');
    } finally { busy = false; }
  }
  const mo = new MutationObserver(apply);
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  apply();
  return {
    setContext(c) { ctx = LINES[c] ? c : 'river'; apply(); },
    apply,
    disconnect() { mo.disconnect(); },
  };
}
