// A closed case re-read from the Archive: its documents (with the listen buttons), the child's own case report, the Chief's closing
// line and the fact learned. Always allowed; reading it changes nothing in the save.
import { $, h } from '../../../spell-jump/src/ui/dom.js';
import { icon } from '../../../spell-jump/src/ui/icons.js';
import { sentenceIndex } from '../logic/run.js';
import { createReader } from './reader.js';
import { EXTRA_ICONS } from './art.js';

export function createFile(app) {
  const body = $('#file-body');
  let reader = null, from = 'archive';
  const ctx = { speech: app.speech, voiceReady: () => app.voiceReady(), voiceHint: () => app.voiceHint(), toast: (t) => app.toast(t), noteListen: () => {} };
  const soundBtn = $('#file-sound');
  const drawSound = () => { soundBtn.innerHTML = app.settings.sound ? icon('sound') : EXTRA_ICONS.mute; soundBtn.setAttribute('aria-pressed', String(!!app.settings.sound)); soundBtn.setAttribute('aria-label', app.settings.sound ? 'Sound on' : 'Sound off'); };
  soundBtn.addEventListener('click', () => { app.setSetting('sound', !app.settings.sound); drawSound(); });
  $('#file-back').addEventListener('click', () => { if (reader) reader.stop(); app.go(from); });

  function show({ kase, from: f = 'archive' } = {}) {
    if (!kase) return;
    from = f; drawSound();
    $('#file-title').textContent = kase.title;
    const rec = app.save.closed[kase.id];
    const idx = sentenceIndex(kase);
    let tab = 'docs', cur = kase.docs[0];
    const tabs = h('div', { class: 'seg', style: { alignSelf: 'center', flex: 'none' } });
    const area = h('div', { style: { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
    function draw() {
      for (const b of tabs.children) { b.classList.toggle('on', b.dataset.tab === tab); }
      area.replaceChildren();
      if (reader) { reader.stop(); reader = null; }
      if (tab === 'docs') {
        const dt = h('div', { class: 'doc-tabs' });
        const holder = h('div', { style: { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' } });
        const open = (d) => { cur = d; for (const t of dt.children) t.classList.toggle('on', t.dataset.doc === d.id); if (reader) reader.stop(); reader = createReader(ctx, kase, d, { mode: 'read', readAloud: false }); holder.replaceChildren(reader.el); };
        for (const d of kase.docs) { const t = h('button', { class: 'doc-tab', type: 'button', 'data-doc': d.id }, d.title); t.addEventListener('click', () => open(d)); dt.append(t); }
        area.append(dt, holder); open(cur);
      } else {
        const col = h('div', { class: 'col' });
        const clue = rec && idx[rec.report.clueId];
        col.append(h('div', { class: 'file-row' }, h('b', {}, 'Your case report'), h('p', { id: 'file-report' }, rec ? `${rec.report.who || ''} did it because ${rec.report.because || ''}. The clue that proves it is ${clue ? `“${clue.text}”` : '(none)'}.` : '')));
        col.append(h('div', { class: 'file-row' }, h('b', {}, 'The Chief said'), h('p', {}, kase.closing ? kase.closing.text : '')));
        col.append(h('div', { class: 'file-row' }, h('b', {}, 'You learned'), h('p', {}, kase.knowledge)));
        col.append(h('div', { style: { display: 'flex', justifyContent: 'center' } }, h('span', { class: 'stamp brass' }, rec ? `Closed ${rec.day}` : 'Case closed')));
        area.append(h('div', { class: 'pane-scroll scroll' }, col));
      }
    }
    for (const [id, label] of [['docs', 'Documents'], ['report', 'My report']]) {
      const b = h('button', { class: 'seg-btn', type: 'button', 'data-tab': id, 'data-sfx': '' }, label);
      b.addEventListener('click', () => { tab = id; draw(); });
      tabs.append(b);
    }
    body.replaceChildren(tabs, area);
    draw();
  }
  return { show, hide() { if (reader) reader.stop(); app.speech.cancel(); } };
}
