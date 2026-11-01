// The diggings (SPEC v1.5 §5.3, §3.4, §4.3): at a leg with gold (Clear Creek, the Feather River, Coloma; the Sacramento claim from 1848) the stop
// has the creek. After the stop's people, a panel offers "Pan for gold" (the scene's pan, scene.startPan({ seed, pans, rich }): scoop, swirl, tip),
// at Coloma also "Rock the cradle" (the rocker: scene.startRocker({ seed, rounds }), three rounds), and "On we go". The scene reports each swirl
// ('panSwirled' { n, quality }); the journey decides what the pan holds (gold.panOutcome: every pan gives at least a flake, a good swirl more, now
// and then a nugget), the app tells the scene (scene.panReveal({ flakes, nugget })) and says it ("Five flakes!"). Gold is counted in flakes and ten
// flakes make a nugget; the gold pouch in the corner shows both ("3 nuggets · 7 flakes"). Gold never buys store goods: it goes home. Nobody can fail:
// a poor pan is still a flake. The child can leave the creek and come back while still at the stop (the pans and rounds done are kept on the trip).
// When Parents → Options turns panning off, the gold is given as a find with one card instead. The module drives; the journey owns the numbers.
import { $, h } from '../../../spell-jump/src/ui/dom.js';

export const DIG_CUES = Object.freeze({ scoop: 'Scoop!', swirl: 'Swirl, swirl!', tip: 'Tip it now!', look: 'Look at that gold!', nugget: 'A nugget!', rock: 'Rock it!' });
export const DIG_TEXT = Object.freeze({
  title: 'The creek',
  intro: 'Gold glints in the creek gravel. Scoop some up and swirl it in the pan!',
  introRocker: 'Gold glints in the creek gravel. Pan for it, or rock the cradle the way the forty-niners did!',
  pan: 'Pan for gold', rock: 'Rock the cradle', leave: 'On we go', done: 'All the gold you found is yours to take home.',
  find: 'The gold you found at the creek is yours to take home.',
  panBar: 'Scoop, swirl, then tip it when the rim glows', rockBar: 'Rock left and right on the beat', barDone: 'Back to the bank',
});
/** "5 flakes!" → the line said when a pan is shown: "Five flakes!" ("A nugget!" after it when the pan held one). */
export const flakeLine = (words, flakes) => `${words(flakes)} flake${flakes === 1 ? '' : 's'}!`.replace(/^./, (c) => c.toUpperCase());
/** The pouch: "3 nuggets · 7 flakes" (a nugget is ten flakes, shown both ways: place value). */
export function pouchText(nuggetsOf, flakes) {
  const n = nuggetsOf(flakes);
  return `${n.nuggets} nugget${n.nuggets === 1 ? '' : 's'} · ${n.flakes} flake${n.flakes === 1 ? '' : 's'}`;
}
/** Every fixed line the creek says, for the natural voice to prepare. */
export const diggingTexts = () => [...Object.values(DIG_CUES), DIG_TEXT.intro, DIG_TEXT.introRocker, DIG_TEXT.done, DIG_TEXT.find];

export function createDiggings(app) {
  const wrap = $('#dg');
  const pouch = $('#dg-pouch');
  const lineEl = $('#dg-line');
  const btns = $('#dg-btns');
  let V = null;               // { leg, dig, resolve, busy }
  const JA = () => app.v2.JA;

  function paintPouch() {
    const J = app.save.journey;
    pouch.hidden = !V;
    if (!V || !J) return;
    pouch.textContent = pouchText(JA().nuggetsOf, J.gold | 0);
    pouch.dataset.flakes = String(J.gold | 0);
  }
  /** The pans and rounds done at this stop so far (kept on the trip, so leaving the creek and coming back loses nothing). */
  function done() {
    const tr = app.save.trip;
    if (!tr) return { pans: 0, rocker: 0 };
    if (!tr.dig) tr.dig = { pans: 0, rocker: 0 };
    return tr.dig;
  }
  function paint() {
    paintPouch();
    if (!V) { wrap.hidden = true; return; }
    const d = done();
    const panLeft = Math.max(0, V.dig.pans - d.pans), rockLeft = Math.max(0, (V.dig.rocker | 0) - d.rocker);
    wrap.hidden = false;
    lineEl.textContent = panLeft || rockLeft ? (V.dig.rocker ? DIG_TEXT.introRocker : DIG_TEXT.intro) : DIG_TEXT.done;
    const mk = (id, text, cls, fn, sub = '') => { const b = h('button', { class: `btn ${cls}`, 'data-dig': id, 'data-sfx': '', disabled: V.busy }, text, sub ? h('small', {}, sub) : null); b.addEventListener('click', fn); return b; };
    const list = [];
    if (panLeft) list.push(mk('pan', DIG_TEXT.pan, 'btn-gold', () => go('pan'), `${panLeft} pan${panLeft === 1 ? '' : 's'}`));
    if (rockLeft) list.push(mk('rocker', DIG_TEXT.rock, 'btn-cyan', () => go('rocker'), `${rockLeft} round${rockLeft === 1 ? '' : 's'}`));
    list.push(mk('leave', DIG_TEXT.leave, 'btn-go', () => go('leave')));
    btns.replaceChildren(...list);
  }
  let pickFn = null;
  function go(what) { if (V && !V.busy && pickFn) { const p = pickFn; pickFn = null; p(what); } }

  /** One pan session: the pans left, each shown when the scene reports its swirl. */
  async function panRun() {
    const J = app.save.journey;
    const rich = (V.dig.rich || []);
    const startAt = done().pans;
    const left = V.dig.pans - startAt;
    if (left <= 0) return null;
    const richShift = rich.filter((i) => i >= startAt).map((i) => i - startAt);
    V.busy = true; paint(); wrap.hidden = true;        // (the creek's card steps off the scene while the pan is played: it covered the lower half of the pan and the touch)
    app.v2.showBar(DIG_TEXT.panBar, DIG_TEXT.barDone, () => app.v2.endPlay(true));
    app.sayAll(startAt === 0 ? [DIG_CUES.scoop, DIG_CUES.swirl, DIG_CUES.tip] : [DIG_CUES.scoop]);
    const prospector = !!(typeof JA().skillOf === 'function' && JA().skillOf(J, 'prospecting'));
    const end = await app.v2.playMini('startPan', { seed: app.v2.seed('pan'), pans: left, rich: richShift }, {
      end: 'panEnd', types: ['panSwirled', 'pan'],
      onEvent: (e) => {
        if (e.type === 'panSwirled') {
          const idx = done().pans;                                   // this pan's number (0-based) on the whole creek
          const out = JA().panOutcome({ quality: Number.isFinite(e.quality) ? e.quality : 0.5, rich: rich.includes(idx), tier: J.tier || J.season, prospector, rand: app.v2.rng(`pan${idx}`) });
          const r = JA().applyGold(J, { flakes: out.flakes, nugget: out.nugget });
          done().pans += 1;
          app.sceneCall('panReveal', { flakes: out.flakes, nugget: out.nugget });
          const said = flakeLine(JA().numberWords, out.flakes) + (out.nugget ? ` ${DIG_CUES.nugget}` : '');
          app.voiceFor([flakeLine(JA().numberWords, out.flakes)], 1500);
          app.sayAll([out.nugget ? DIG_CUES.nugget : DIG_CUES.look, flakeLine(JA().numberWords, out.flakes)]);
          app.toast(said);
          rewards({ first: idx === 0, nugget: out.nugget, flakes: r.flakes });
          paintPouch();
          app.persist(); app.sfx.chime && app.sfx.chime();
        }
      },
    });
    app.v2.hideBar();
    V.busy = false; if (V) wrap.hidden = false;
    return end;
  }
  /** The cradle: rounds on the beat; each round shown when the scene reports it. */
  async function rockerRun() {
    const J = app.save.journey;
    const startAt = done().rocker;
    const left = (V.dig.rocker | 0) - startAt;
    if (left <= 0) return null;
    V.busy = true; paint(); wrap.hidden = true;
    app.v2.showBar(DIG_TEXT.rockBar, DIG_TEXT.barDone, () => app.v2.endPlay(true));
    app.sayAll([DIG_CUES.rock]);
    const end = await app.v2.playMini('startRocker', { seed: app.v2.seed('rocker'), rounds: left }, {
      end: 'rockerEnd', types: ['rockerRound'],
      onEvent: (e) => {
        if (e.type !== 'rockerRound') return;
        const out = JA().rockerOutcome({ beats: Number.isFinite(e.beats) ? e.beats : 0.5, tier: J.tier || J.season });
        const r = JA().applyGold(J, { flakes: out.flakes, nugget: false, rocker: Number.isFinite(e.beats) ? e.beats : 0.5 });
        done().rocker += 1;
        app.sceneCall('rockerReveal', { flakes: out.flakes });
        app.sayAll([flakeLine(JA().numberWords, out.flakes)]);
        app.toast(flakeLine(JA().numberWords, out.flakes));
        rewards({ first: false, nugget: false, flakes: r.flakes, rocker: true });
        paintPouch();
        app.persist();
      },
    });
    app.v2.hideBar();
    V.busy = false; if (V) wrap.hidden = false;
    return end;
  }
  /** The trail cards the gold brings: the gold pan, the first flake, the first nugget, the rocker (never twice: a duplicate would be a token). */
  function rewards({ first, nugget, flakes, rocker = false }) {
    const have = new Set(app.save.journey.cards || []);
    const give = (id) => { if (!have.has(id)) { have.add(id); app.v2.dropCard(id); } };
    if (first || !rocker) give('gold-pan');
    if (flakes > 0 && !rocker) give('gold-flake');
    if (nugget) give('gold-nugget');
    if (rocker) give('gold-rocker');
    app.v2.checkDeeds();
  }

  return {
    show() { paintPouch(); },
    hide() { if (V) { const v = V; V = null; wrap.hidden = true; pouch.hidden = true; pickFn = null; try { app.v2.endPlay(); } catch (_) { /* ignore */ } app.v2.hideBar(); v.resolve(null); } },
    get isOpen() { return !!V; },
    get busy() { return !!(V && V.busy); },
    paintPouch,
    /** The gold given as a find when panning is off (Parents → Options): every pan and round at a middling swirl, one card. */
    giveAsFind(dig) {
      const J = app.save.journey, tr = app.save.trip;
      const d = done();
      let flakes = 0, nuggets = 0;
      for (let i = d.pans; i < dig.pans; i++) {
        const out = JA().panOutcome({ quality: 0.5, rich: (dig.rich || []).includes(i), tier: J.tier || J.season, prospector: !!(typeof JA().skillOf === 'function' && JA().skillOf(J, 'prospecting')), rand: app.v2.rng(`find${i}`) });
        JA().applyGold(J, { flakes: out.flakes, nugget: out.nugget }); flakes += out.flakes; if (out.nugget) nuggets += 1;
      }
      for (let i = d.rocker; i < (dig.rocker | 0); i++) { const out = JA().rockerOutcome({ beats: 0.5, tier: J.tier || J.season }); JA().applyGold(J, { flakes: out.flakes, nugget: false, rocker: 0.5 }); flakes += out.flakes; }
      if (tr) tr.dig = { pans: dig.pans, rocker: dig.rocker | 0 };
      app.v2.dropCard('gold-flake');
      app.v2.checkDeeds();
      app.persist();
      return { flakes, nuggets };
    },
    /** The creek at this stop: resolves 'leave' when the child goes on, or null when the screen was left. */
    run({ leg, dig }) {
      if (V) this.hide();
      return new Promise((resolve) => {
        V = { leg, dig, resolve, busy: false };
        const loop = async () => {
          for (;;) {
            if (!V || V.leg !== leg) return;
            paint();
            const what = await new Promise((r) => { pickFn = r; });
            if (!V) return;
            if (what === 'leave') { const v = V; V = null; wrap.hidden = true; pouch.hidden = true; v.resolve('leave'); return; }
            if (what === 'pan') await panRun(); else if (what === 'rocker') await rockerRun();
            if (app.screen !== 'stop') { if (V) this.hide(); return; }
          }
        };
        loop().catch((e) => console.error('[WagonWest] diggings', e));
      });
    },
  };
}
