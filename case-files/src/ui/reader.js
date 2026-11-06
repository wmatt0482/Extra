// A document on screen. Read mode: documents read silently; each paragraph has a listen button that plays the paragraph's
// sentences one by one with the current sentence highlighted; "Read it to me" reads the whole document (switched on by default
// at some ranks and for the stretch document). Pick mode (pinning evidence): every sentence is a big tap target, a tap selects it
// (the screen decides what "Pin it" means). Passage text >= 18px, line-height >= 1.5, about 65 characters a line.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { KIND_LABEL } from '../logic/lines.js';

/**
 * app: { speech, voiceReady(), toast, noteListen(docId) } ; opts: { mode: 'read' | 'pick', onSelect(id), readAloud: bool, autoRead: bool, onReadAloud(on) }
 */
export function createReader(app, kase, doc, opts = {}) {
  const mode = opts.mode || 'read';
  const el = h('div', { class: 'doc' + (mode === 'pick' ? ' pick' : ''), 'data-doc': doc.id });
  const text = h('div', { class: 'doc-text scroll' });
  const toggle = h('button', { class: 'toggle-btn', type: 'button', 'aria-pressed': String(!!opts.readAloud), 'data-act': 'read-all' }, h('span', { class: 'knob' }), 'Read it to me');
  el.append(h('div', { class: 'doc-head' }, h('h4', {}, `${KIND_LABEL[doc.kind] ? KIND_LABEL[doc.kind] + ': ' : ''}${doc.title}`), toggle, h('div', { class: 'from' }, doc.from)), text);
  const paras = [];
  doc.paragraphs.forEach((p, pi) => {
    const sp = p.map((s) => h('span', { class: 's', 'data-id': s.id, role: mode === 'pick' ? 'button' : null, tabindex: mode === 'pick' ? '0' : null }, s.text));
    const body = h('p', {});
    sp.forEach((x, i) => { body.append(x); if (i < sp.length - 1) body.append(' '); });
    const say = h('button', { class: 'say-btn', type: 'button', 'aria-label': `Listen to paragraph ${pi + 1}`, 'data-act': 'listen', 'data-para': String(pi), html: icon('sound') });
    const para = h('div', { class: 'para', 'data-para': String(pi) }, body, say);
    text.append(para);
    paras.push({ el: para, say, sp, sentences: p.map((s) => s.text) });
  });

  let token = 0, reading = false;       // token identifies the running read (a newer one, or stop(), ends the older)
  const clearSpeaking = () => { for (const s of el.querySelectorAll('.s.speaking')) s.classList.remove('speaking'); for (const p of paras) p.say.classList.remove('on'); };
  function mark(pi, si) {
    clearSpeaking();
    if (si == null) return;
    const p = paras[pi]; if (!p) return;
    p.say.classList.add('on');
    const s = p.sp[si]; if (s) { s.classList.add('speaking'); keepVisible(s); }
  }
  function keepVisible(node) {
    const a = text.getBoundingClientRect(), b = node.getBoundingClientRect();
    if (b.top < a.top + 6 || b.bottom > a.bottom - 6) text.scrollTop += b.top - a.top - a.height / 3;
  }
  async function playParas(from, to, noteMode) {
    if (!app.voiceReady()) return false;
    const my = ++token; reading = true;
    app.noteListen(doc.id);
    let spoken = 0;
    for (let pi = from; pi <= to && my === token; pi++) {
      const r = await app.speech.readEach(paras[pi].sentences, (i) => { if (my === token) mark(pi, i); });
      spoken += r.spoken;
      if (r.cut) break;
    }
    if (my === token) { reading = false; clearSpeaking(); if (noteMode === 'all') setToggle(false, true); }
    return spoken > 0;
  }
  function stop() { token++; reading = false; app.speech.cancel(); clearSpeaking(); }
  function setToggle(on, silent) { toggle.setAttribute('aria-pressed', String(!!on)); if (!silent && opts.onReadAloud) opts.onReadAloud(!!on); }

  el.addEventListener('click', (e) => {
    const say = e.target.closest('[data-act="listen"]');
    if (say) {
      const pi = Number(say.dataset.para);
      if (say.classList.contains('on')) { stop(); return; }
      if (!app.voiceReady()) { app.voiceHint(); return; }
      setToggle(false, true);
      playParas(pi, pi, 'para');
      return;
    }
    const t = e.target.closest('[data-act="read-all"]');
    if (t) {
      const on = t.getAttribute('aria-pressed') !== 'true';
      setToggle(on);
      if (!on) { stop(); return; }
      if (!app.voiceReady()) { app.voiceHint(); return; }
      playParas(0, paras.length - 1, 'all');
      return;
    }
    const s = e.target.closest('.s');
    if (s && mode === 'pick' && !s.closest('.para.dim') && opts.onSelect) opts.onSelect(s.dataset.id);
  });
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && mode === 'pick') { const s = e.target.closest && e.target.closest('.s'); if (s && opts.onSelect && !s.closest('.para.dim')) { e.preventDefault(); opts.onSelect(s.dataset.id); } }
  });

  const api = {
    el, doc, text, get reading() { return reading; },
    setSelected(id) { for (const s of el.querySelectorAll('.s.sel')) s.classList.remove('sel'); const s = id && el.querySelector(`.s[data-id="${id}"]`); if (s) s.classList.add('sel'); },
    glow(id) { for (const s of el.querySelectorAll('.s.glow')) s.classList.remove('glow'); const s = id && el.querySelector(`.s[data-id="${id}"]`); if (s) { s.classList.add('glow'); keepVisible(s); } },
    /** red-bordered paragraph (the second hint tier); dim = dim every other paragraph (the third tier) */
    highlightPara(pi, dim = false) {
      paras.forEach((p, i) => { p.el.classList.toggle('hl', pi === i); p.el.classList.toggle('dim', dim && pi != null && pi !== i); });
      if (pi != null && paras[pi]) keepVisible(paras[pi].el);
    },
    markPinned(ids) { for (const s of el.querySelectorAll('.s')) s.classList.toggle('pinned', ids.includes(s.dataset.id)); },
    stop,
    startAll() { if (app.voiceReady()) { setToggle(true, true); playParas(0, paras.length - 1, 'all'); } },
    hasSentence: (id) => !!el.querySelector(`.s[data-id="${id}"]`),
    paraOf: (id) => paras.findIndex((p) => p.sp.some((s) => s.dataset.id === id)),
  };
  return api;
}
