p='src/game/engine.js'
s=open(p).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (s.count(a), a[:80])
    s=s.replace(a,b)

rep("""    } else if (a.kind === 'coin') {
      raw = T.coinCash; r.coins++;""","""    } else if (a.kind === 'boost') {
      // v4.0 boost ring: a speed kick along the velocity, a nitro refill, cash
      raw = T.boostRingCash; refill = T.boostRingNitro; r.rings++; r.boostRings++;
      refillNitro(r, T.boostRingNitro);
      const sp = r.speed || 1, dx = sp > 1 ? r.com.vx / sp : 1, dy = sp > 1 ? r.com.vy / sp : 0;
      addVelAll(r, dx * T.boostKick, dy * T.boostKick);
      for (let k = 0; k < 20; k++) {
        const ang = (k / 20) * TAU;
        particle(r, 'spark', a.x + Math.cos(ang) * a.r * 0.8, a.y + Math.sin(ang) * a.r, Math.cos(ang) * 6 + r.com.vx * 0.3, Math.sin(ang) * 7, 0.1, k % 2 ? '#e0fbff' : '#22d3ff', 0.6);
      }
      particle(r, 'ring', a.x, a.y, 0, 0, 0.5, '#9ff3ff', 0.5, 0.9, 7);
      popup(r, 'BOOST!', a.x, a.y + a.r + 1.4, '#7cf2ff', 0.8, true, 1.1);
    } else if (a.kind === 'coin') {
      raw = T.coinCash; r.coins++;""")
rep("""    emit({ type: 'airTarget', kind: a.kind, cash, nitroRefill: refill });""","""    if (a.kind === 'boost') emit({ type: 'boostRing', cash, nitroRefill: refill, kickKmh: Math.round(T.boostKick * 3.6), x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10 });
    else emit({ type: 'airTarget', kind: a.kind, cash, nitroRefill: refill });""")

# ---- letters generalised to a second (boost) word
rep("""  function layoutLetters(r, from) {
    const N = r.letters.length;
    if (!N) return;""","""  function layoutLetters(r, from, bw = false) {
    const lets = bw ? r.bw.letters : r.letters;
    const N = lets.length;
    if (!N) return;""")
rep("""    const old = r.air.filter((a) => a.li != null);
    const keep = r.air.filter((a) => a.li == null);
    const rings = [];
    for (let i = 0; i < N; i++) {
      const p = at(sA + d * i);
      const o = old[i];
      const a = o || { id: 10000 + i, kind: 'ring', li: i, letter: r.letters[i], r: R,""","""    const mine = (a) => a.li != null && !!a.bw === bw;
    const old = r.air.filter(mine);
    const keep = r.air.filter((a) => !mine(a));
    const rings = [];
    for (let i = 0; i < N; i++) {
      const p = at(sA + d * i);
      const o = old[i];
      const a = o || { id: (bw ? 20000 : 10000) + i, kind: 'ring', li: i, bw, letter: lets[i], r: R,""")
rep("""      if (a.kind === 'blimp' || a.hit) continue;
      a.gone = rings.some""","""      if (a.kind === 'blimp' || a.hit || a.li != null) continue;
      a.gone = rings.some""")
rep("""  function hitLetter(r, a) {
    a.hit = true;
    a.hitT = r.realT;
    const m = r.stats.coinMult, N = r.letters.length, i = a.li;
    let inOrder = true;
    for (let j = 0; j < i; j++) if (!r.letterHit[j]) inOrder = false;
    r.letterHit[i] = true;
    r.lettersCollected++;
    r.airRaw += T.letterCash;
    refillNitro(r, T.letterNitro);
    const cash = Math.round(T.letterCash * m);
    emit({ type: 'letterRing', letter: a.letter, index: i, inOrder, cash, nitroRefill: T.letterNitro });""","""  function hitLetter(r, a) {
    a.hit = true;
    a.hitT = r.realT;
    const B = a.bw ? r.bw : null; // v4.0: the Spell Boost word has its own bookkeeping; its events carry boost: true
    const hits = B ? B.hit : r.letterHit;
    const m = r.stats.coinMult, N = B ? B.letters.length : r.letters.length, i = a.li;
    let inOrder = true;
    for (let j = 0; j < i; j++) if (!hits[j]) inOrder = false;
    hits[i] = true;
    if (B) B.n++; else r.lettersCollected++;
    r.airRaw += T.letterCash;
    refillNitro(r, T.letterNitro);
    const cash = Math.round(T.letterCash * m);
    emit(B ? { type: 'letterRing', letter: a.letter, index: i, inOrder, cash, nitroRefill: T.letterNitro, boost: true }
      : { type: 'letterRing', letter: a.letter, index: i, inOrder, cash, nitroRefill: T.letterNitro });""")
rep("""    if (i === N - 1 && inOrder) {
      r.wordDone = true;
      r.airRaw += T.wordCash;
      const wc = Math.round(T.wordCash * m);
      emit({ type: 'wordComplete', cash: wc });""","""    if (i === N - 1 && inOrder) {
      if (B) B.done = true; else r.wordDone = true;
      r.airRaw += T.wordCash;
      const wc = Math.round(T.wordCash * m);
      emit(B ? { type: 'wordComplete', cash: wc, boost: true } : { type: 'wordComplete', cash: wc });""")
rep("""  function nextLetter(r) {
    for (let i = 0; i < r.letters.length; i++) if (!r.letterHit[i]) return i;
    return -1;
  }""","""  function nextLetter(r, bw = false) {
    const lets = bw ? r.bw.letters : r.letters, hit = bw ? r.bw.hit : r.letterHit;
    for (let i = 0; i < lets.length; i++) if (!hit[i]) return i;
    return -1;
  }""")
rep("""R.drawLetterRing(ctx, letterPos(a, t), t, 'back', lw, k, a.li === nextLetter(r), r.lettersRevealed) && !r.lettersRevealed) r.glyphLeaks++;""","""R.drawLetterRing(ctx, letterPos(a, t), t, 'back', lw, k, a.li === nextLetter(r, !!a.bw), r.lettersRevealed || !!a.bw) && !r.lettersRevealed && !a.bw) r.glyphLeaks++;""")
rep("""          if (k < 1) R.drawLetterRing(ctx, letterPos(a, t), t, 'front', lw, k, a.li === nextLetter(r), r.lettersRevealed);""","""          if (k < 1) R.drawLetterRing(ctx, letterPos(a, t), t, 'front', lw, k, a.li === nextLetter(r, !!a.bw), r.lettersRevealed || !!a.bw);""")
open(p,'w').write(s)
