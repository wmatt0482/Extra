// Run HUD: distance (+ progress to the finish flag), run cash (eased ticker), speed, nitro, plus the
// v2 pieces: combo badge (drains with getState().combo.timer01), altitude chip while airborne,
// big centered banners (one at a time, queued), and the in-run message queue (achievement toasts and
// notes such as "Goal done"): one message at a time, only while no banner is up. Banners and messages share
// the band under the top bar, so a banner that arrives cuts the current message (it comes back afterwards
// if it was cut early). The engine draws its own big texts (flips, landings, finish) in a lower band.
// Writes the DOM only when a displayed value changes, so calling update() every frame is cheap.
import { $, h, money } from './dom.js';
import { icon } from './icons.js';

const BANNER_MS = 1550;      // in (~.25 s) + hold (~1.2 s) + out
const BANNER_MIN_MS = 650;   // a newer banner may cut the current one short after this long (stay timely)
const ACH_MS = 2900;
const NOTE_MS = 2600;
const COMBO_WINDOW = 1.5;    // fallback drain when an engine doesn't report combo.timer01

export function createHud() {
  const el = {
    distance: $('#hud-distance'), finish: $('#hud-finish'), cash: $('#hud-cash'), cashBox: $('#hud-cash-box'), speed: $('#hud-speed'),
    nitro: $('#hud-nitro'), nitroFill: $('#ctl-nitro-fill'), nitroBtn: $('#ctl-nitro'), toasts: $('#toasts'),
    alt: $('#hud-alt'), altV: $('#hud-alt-v'),
    combo: $('#hud-combo'), comboRing: $('#hud-combo-ring'), comboMult: $('#hud-combo-mult'), comboCount: $('#hud-combo-count'), comboLabel: $('#hud-combo-label'),
    banner: $('#banner'), bannerText: $('#banner-text'), word: $('#hud-word'),
  };
  let last = {}, finishM = 400;
  let cashShown = 0, cashTarget = 0, lastT = 0;
  let evCombo = null;          // {count, mult, at} from events (fallback / instant pulse)
  let comboEndUntil = 0;
  let bannerQ = [], bannerCur = null, bannerTimer = 0, bannerAt = 0, bannerCut = 0;
  let achQ = [], achBusy = null, achTimer = 0;   // achBusy = {item, node, at} while a message shows

  function set(key, value, fn) {
    if (last[key] === value) return;
    last[key] = value;
    fn(value);
  }
  function restartAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;          // reflow so the animation restarts
    node.classList.add(cls);
  }
  const fmtMult = (m) => '×' + (Math.round(m * 100) / 100).toString();

  // ---------- banners ----------
  function nextBanner() {
    clearTimeout(bannerTimer); clearTimeout(bannerCut);
    bannerCur = bannerQ.shift() || null;
    bannerAt = performance.now();
    if (!bannerCur) { el.banner.hidden = true; pumpAch(); return; }
    cutMessage();
    el.banner.className = 'banner b-' + bannerCur.kind;
    el.bannerText.textContent = bannerCur.text;
    el.banner.dataset.kind = bannerCur.kind;
    el.banner.hidden = false;
    restartAnim(el.banner, 'show');
    bannerTimer = setTimeout(nextBanner, BANNER_MS);
  }

  // ---------- achievement toasts (one at a time, after any banner) ----------
  function pumpAch() {
    if (achBusy || !achQ.length || bannerCur || bannerQ.length) return;
    const item = achQ.shift();
    let t;
    if (item.ach) {
      const a = item.ach;
      t = h('div', { class: `toast ach tone-${a.tone || 'gold'}`, 'data-ach': a.id, role: 'status' },
        h('span', { class: 'ach-medal', html: icon(a.icon) }),
        h('span', { class: 'ach-text' }, h('small', {}, 'Achievement unlocked'), h('b', {}, a.name)));
    } else {
      t = h('div', { class: 'toast note', role: 'status' }, item.text);
    }
    el.toasts.prepend(t);
    achBusy = { item, node: t, at: performance.now() };
    achTimer = setTimeout(() => { t.remove(); achBusy = null; pumpAch(); }, item.ach ? ACH_MS : NOTE_MS);
  }
  // a banner is starting: take the current message down; if it had little screen time, show it again later
  function cutMessage() {
    if (!achBusy) return;
    clearTimeout(achTimer);
    achBusy.node.remove();
    if (performance.now() - achBusy.at < 1400) achQ.unshift(achBusy.item);
    achBusy = null;
  }

  function showCombo(count, mult, timer01) {
    const on = count >= 2 && timer01 > 0;
    set('co', on, (v) => { el.combo.hidden = !v; if (!v) el.combo.classList.remove('rampage'); });
    if (!on) return;
    set('cc', count, (v) => { el.comboCount.textContent = v; el.comboLabel.textContent = v >= 13 ? 'Super combo!' : 'Hit combo'; });
    set('cm', mult, (v) => { el.comboMult.textContent = fmtMult(v); el.combo.classList.toggle('rampage', v >= 4); });
    set('ct', Math.round(timer01 * 100), (v) => { el.comboRing.style.strokeDashoffset = String(100 - v); });
  }

  return {
    reset(track) {
      last = {};
      finishM = track ? track.finish : 400;
      cashShown = cashTarget = 0; lastT = 0;
      evCombo = null; comboEndUntil = 0;
      el.toasts.querySelectorAll('.toast:not(.ach):not(.note)').forEach((t) => t.remove());
      this.clearBanners();
      el.alt.hidden = true; el.combo.hidden = true; el.combo.classList.remove('rampage', 'ended');
      this.update({ distance: 0, cash: 0, speedKmh: 0, nitro: 1 });
    },
    update(s) {
      if (!s) return;
      const now = performance.now();
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
      lastT = now;
      const d = Math.floor(s.distance || 0);
      set('d', d, (v) => { el.distance.textContent = money(v); });
      set('f', Math.min(100, Math.round((d / finishM) * 100)), (v) => { el.finish.style.width = v + '%'; });
      // cash ticker: ease toward the engine's total (fast for big jumps, never overshoots)
      cashTarget = Math.round(s.cash || 0);
      if (cashTarget < cashShown) cashShown = cashTarget;
      else if (cashTarget > cashShown) {
        const gap = cashTarget - cashShown;
        cashShown = Math.min(cashTarget, cashShown + Math.max(1, gap * Math.min(1, dt * 7), 60 * dt));
        if (gap > 40 && !el.cashBox.classList.contains('bump')) restartAnim(el.cashBox, 'bump');
      }
      set('c', Math.floor(cashShown), (v) => { el.cash.textContent = money(v); });
      set('s', Math.round(s.speedKmh || 0), (v) => { el.speed.textContent = v; });
      const n = Math.max(0, Math.min(1, s.nitro == null ? 1 : s.nitro));
      set('n', Math.round(n * 100), (v) => {
        el.nitro.style.transform = `scaleX(${v / 100})`;
        el.nitroFill.style.transform = `scaleY(${v / 100})`;
        el.nitroBtn.classList.toggle('empty', v <= 0);
      });
      // altitude: only while airborne (engines without altitude never show it)
      const alt = s.phase === 'air' && typeof s.altitude === 'number' && s.altitude >= 1 ? Math.round(s.altitude) : null;
      set('ah', alt === null, (v) => { el.alt.hidden = v; });
      if (alt !== null) {
        set('a', alt, (v) => { el.altV.textContent = v; });
        set('ao', alt >= 45, (v) => el.alt.classList.toggle('orbit', v));
      }
      // combo: prefer engine state; fall back to the last combo event + a 1.5 s drain
      if (now < comboEndUntil) return;
      if (s.combo && typeof s.combo.timer01 === 'number') showCombo(s.combo.count || 0, s.combo.mult || 1, s.phase === 'done' ? 0 : s.combo.timer01);
      else if (evCombo) showCombo(evCombo.count, evCombo.mult, Math.max(0, 1 - (now - evCombo.at) / 1000 / COMBO_WINDOW));
      else showCombo(0, 1, 0);
    },
    combo(evt) {
      evCombo = { count: evt.count || 2, mult: evt.mult || 1, at: performance.now() };
      comboEndUntil = 0;
      el.combo.classList.remove('ended');
      showCombo(evCombo.count, evCombo.mult, 1);
      restartAnim(el.combo, 'pulse');
    },
    comboEnd(evt) {
      evCombo = null;
      if (!(evt && evt.cash > 0)) return;
      // flash the bonus on the badge for a moment before it hides
      comboEndUntil = performance.now() + 1100;
      el.combo.hidden = false;
      el.comboCount.textContent = String(evt.count);
      el.comboMult.textContent = '+$' + money(evt.cash);
      el.comboLabel.textContent = 'Combo bonus';
      el.comboRing.style.strokeDashoffset = '0';
      restartAnim(el.combo, 'ended');
      last.co = undefined; last.cc = undefined; last.cm = undefined; last.ct = undefined;
    },
    // kind: bigair | orbit | rampage | rejump | record. One on screen at a time: a newer banner
    // waits at most BANNER_MIN_MS, then replaces the current one; only the latest waiting one is kept.
    banner(kind, text) {
      if ((bannerCur && bannerCur.kind === kind) || bannerQ.some((b) => b.kind === kind)) return;
      bannerQ = [{ kind, text }];
      if (!bannerCur) { nextBanner(); return; }
      clearTimeout(bannerCut);
      bannerCut = setTimeout(nextBanner, Math.max(0, BANNER_MIN_MS - (performance.now() - bannerAt)));
    },
    get bannerBusy() { return !!bannerCur || bannerQ.length > 0; },
    clearBanners() {
      clearTimeout(bannerTimer); clearTimeout(bannerCut);
      bannerQ = []; bannerCur = null;
      el.banner.hidden = true;
      pumpAch();
    },
    achievement(a) { achQ.push({ ach: a }); pumpAch(); },
    // v3: the spelled word's letters (shown only after the spell panel closes, R1); each lights as its ring is hit
    word(letters) {
      el.word.classList.remove('complete');
      if (!letters || !letters.length) { el.word.hidden = true; el.word.replaceChildren(); return; }
      const upper = document.documentElement.classList.contains('tiles-upper');
      el.word.replaceChildren(...letters.map((l) => h('i', {}, upper ? l.toUpperCase() : l)));
      el.word.hidden = false;
    },
    letterHit(i) { const t = el.word.children[i]; if (t) t.classList.add('on'); },
    wordComplete() { el.word.classList.add('complete'); },
    // in-run note ("Goal done: …"): same one-at-a-time lane as the achievement toasts, never over a banner
    note(text) {
      if (achQ.some((m) => m.text === text) || (achBusy && achBusy.item.text === text)) return;
      achQ.push({ text }); pumpAch();
    },
    // drop queued / showing messages (the results screen lists the run's badges and goals itself)
    flushAchievements() {
      clearTimeout(achTimer);
      achQ = []; achBusy = null;
      el.toasts.querySelectorAll('.toast.ach, .toast.note').forEach((t) => t.remove());
    },
    toast(text) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = text;
      el.toasts.append(t);
      const plain = el.toasts.querySelectorAll('.toast:not(.ach):not(.note)');
      if (plain.length > 3) plain[0].remove();
      setTimeout(() => t.remove(), 2700);
    },
  };
}
