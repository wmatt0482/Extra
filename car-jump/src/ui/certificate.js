// The printable Friday Test certificate (lab/SPEC.md §4.1). certificate.html?p=<playerId>&t=<testAt> is opened from Parent Zone → Report →
// "Print certificate". It reads only this device's local data (the family record and the player's spelling data), draws a print-styled page with
// system fonts only, and prints with window.print(). No network, no external link, no image off this origin; the buttons are hidden by the print CSS.
// Tone (the owner's question, lab/SPEC.md §8 Q8): every score gets a ribbon. For a low result the page shows the ribbon instead of the number by
// default (the grown-up can switch the score on with one button); Bronze and up show "spelled k of n words".
import { loadFamily, playerById, loadWords } from '../spelling/profiles.js';
import { listById } from '../spelling/wordStore.js';
import { TIER_TEXT, IMPROVED_TEXT, improvement, isMostImproved, qualifierFor, tierFor, trophySvg } from './ceremony.js';

const dateText = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** Everything the page says, from the local data. Pure (no DOM). Returns null when the player or the test cannot be found.
 *  opts.showScore: true / false, or undefined for the default (the number is shown for Bronze and up; a ribbon replaces it below that). */
export function certificateModel(family, words, playerId, testAt, { showScore } = {}) {
  const p = family && playerById(family, playerId);
  const tests = words && Array.isArray(words.tests) ? words.tests : [];
  const t = tests.find((x) => x && x.kind === 'friday' && x.at === testAt);
  if (!p || !t || !(t.total > 0) || !Number.isFinite(t.correct)) return null;
  const tier = tierFor(t.correct, t.total);
  const q = qualifierFor(tests, t);
  const gain = improvement(t, q);
  const list = listById(words, t.listId);
  const defaultScore = tier !== 'brave';
  const score = typeof showScore === 'boolean' ? showScore : defaultScore;
  return {
    name: p.name, correct: t.correct, total: t.total, tier, tierName: TIER_TEXT[tier].ribbon, date: dateText(t.at), listName: list ? list.name : 'this week\'s list',
    showScore: score, defaultScore, improvedMost: isMostImproved(t, q),
    pre: q ? { correct: q.correct, total: q.total } : null, gain,
    practice: (t.missed || []).slice(0, 8),
  };
}

/** The sentences, in order (the page and the tests read the same list). */
export function certificateLines(m) {
  const lines = [];
  if (m.showScore) lines.push(`${m.name} spelled ${m.correct} of ${m.total} words on the Friday Test`);
  else lines.push(`${m.name} took the Friday Test and kept going on all ${m.total} words`);
  if (m.pre && m.gain != null && m.gain > 0) {
    lines.push(m.showScore ? `Up from ${m.pre.correct} of ${m.pre.total} on the Qualifier to ${m.correct} of ${m.total} on the Friday Test`
      : `${m.name} has improved since the Qualifier`);
  }
  return lines;
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function renderCertificate(root, m, { onToggle, backHref = './' } = {}) {
  root.replaceChildren();
  root.dataset.tier = m.tier;
  const sheet = el('section', `cert tier-${m.tier}`);
  sheet.id = 'cert';
  sheet.append(el('div', 'cert-brand', 'Spell Jump'));
  sheet.append(el('h1', 'cert-title', 'Certificate of Achievement'));
  sheet.append(el('p', 'cert-sub', 'This certificate is proudly presented to'));
  const name = el('div', 'cert-name', m.name); name.id = 'cert-name';
  sheet.append(name);
  const art = el('div', 'cert-art'); art.innerHTML = trophySvg(m.tier); art.setAttribute('aria-hidden', 'true');
  sheet.append(art);
  const ribbon = el('div', 'cert-ribbon', m.tierName); ribbon.id = 'cert-ribbon';
  sheet.append(ribbon);
  if (m.improvedMost) { const r = el('div', 'cert-ribbon cert-improved', IMPROVED_TEXT.title.replace('!', '') + ' ribbon'); r.id = 'cert-improved'; sheet.append(r); }
  for (const [i, line] of certificateLines(m).entries()) { const p = el('p', i ? 'cert-line cert-line2' : 'cert-line', line); p.dataset.line = String(i); sheet.append(p); }
  sheet.append(el('p', 'cert-meta', `${m.listName} · Friday Test of ${m.date}`));
  if (m.practice.length) sheet.append(el('p', 'cert-practice', `Words to practice this week: ${m.practice.join(', ')}`));
  sheet.append(el('div', 'cert-foot', 'Every word you practice makes the next test easier.'));
  root.append(sheet);

  const bar = el('div', 'cert-bar'); bar.id = 'cert-bar';
  const print = el('button', 'cert-btn cert-print', 'Print certificate'); print.id = 'cert-print'; print.type = 'button';
  print.addEventListener('click', () => { try { window.print(); } catch (_) { /* no print here */ } });
  const tog = el('button', 'cert-btn', m.showScore ? 'Show the ribbon only' : 'Show the score'); tog.id = 'cert-toggle'; tog.type = 'button';
  tog.addEventListener('click', () => onToggle && onToggle(!m.showScore));
  const back = el('a', 'cert-btn cert-back', 'Back to Spell Jump'); back.id = 'cert-back'; back.href = backHref;
  bar.append(print, tog, back);
  root.append(bar);
}

function boot() {
  const root = document.getElementById('cert-root');
  if (!root) return;
  const q = new URLSearchParams(location.search);
  const pid = q.get('p') || '', at = Number(q.get('t'));
  let showScore;
  if (q.get('s') === '1') showScore = true; else if (q.get('s') === '0') showScore = false;
  const draw = () => {
    let m = null;
    if (/^[A-Za-z0-9]{2,24}$/.test(pid) && Number.isFinite(at) && at > 0) {
      try { m = certificateModel(loadFamily(), loadWords(pid), pid, at, { showScore }); } catch (_) { m = null; }
    }
    if (!m) {
      root.replaceChildren();
      const box = el('section', 'cert-missing');
      box.id = 'cert-missing';
      box.append(el('h1', '', 'That certificate could not be found'), el('p', '', 'Open Spell Jump, tap Parents, then Report, and choose Print certificate next to a Friday Test.'));
      const back = el('a', 'cert-btn cert-back', 'Back to Spell Jump'); back.id = 'cert-back'; back.href = './'; box.append(back);
      root.append(box);
      return;
    }
    renderCertificate(root, m, {
      onToggle: (v) => { showScore = v; try { const u = new URL(location.href); u.searchParams.set('s', v ? '1' : '0'); history.replaceState(null, '', u.pathname + u.search); } catch (_) { /* ignore */ } draw(); },
    });
    document.title = `Friday Test certificate: ${m.name}`;
  };
  draw();
  window.__certificate = { draw };
}
if (typeof document !== 'undefined') boot();
