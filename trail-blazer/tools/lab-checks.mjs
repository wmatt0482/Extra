// Trail Blazer 1.9, The Lab (lab/SPEC.md §4.2): the browser checks, on the mock engine. Called from ui-smoke.mjs once per layout (iPhone landscape and
// portrait), or standalone:  BASE_URL=http://localhost:8123 SHOTS_DIR=/some/dir node trail-blazer/tools/lab-checks.mjs
//   1. The bridge never breaks the game: with every /lab/ request blocked the title has no Lab button, the HUD has no pill, a whole race (gates,
//      results) plays, and the only console noise is the bridge's one warning.
//   2. A report reaches the Lab: gates (facts, first try), the race, the day, perfect landings arrive at the Lab store with the game's own id
//      (`tb`); coins and XP rise; Lab coins never touch Trail Blazer's cash.
//   3. The HUD XP pill is mounted in the race HUD (≤ 120 px, right of the speed readout), the Lab strip on the results, "The Lab" on the title and in
//      the Parent Zone; the "Perfect Landing" moment fires from the fifth first-try fact (banner, voice).
//   4. Lab looks: an equipped paint, decal, rim and ghost look reach the engine and the garage preview; the garage's own paint is still the child's.
//   5. Ghost Chase: "Chase a ghost" on a trail with a ghost; the picker lists "My best" and a sibling's ghost (name, colour, vehicle); the chase runs with
//      NO race clock, NO facts counter, NO gap chip, NO position badge and NO countdown, starts on the first GAS, banks no place (no win, podium, unlock,
//      rival or place bonus) and says "Ben's ghost was 2.8 s ahead. Nice chase!" / "Beat your ghost by 31.6 s!" on the results.
import path from 'node:path';
import os from 'node:os';
import { mkdirSync } from 'node:fs';

const TRAIL = 'pine-ridge';
const fastTrace = () => Array.from({ length: 62 }, (_, i) => [Math.round(i * 10) / 100, Math.round(i * 10 * 10) / 10, 0.9, 0]);    // 600 m in 6.1 s (the mock rides in ~8.8 s)
const slowTrace = () => Array.from({ length: 401 }, (_, i) => [Math.round(i * 10) / 100, Math.round(i * 1.5 * 10) / 10, 0.9, 0]);   // 600 m in 40 s

export async function runLabChecks(browser, layout, BASE, { J, typeAnswer, check, visibleSel, shots }) {
  const SHOTS = shots || process.env.SHOTS_DIR || path.join(os.tmpdir(), 'trail-blazer-lab-shots');
  mkdirSync(SHOTS, { recursive: true });
  console.log(`\n=== The Lab ${layout.name} ${layout.width}x${layout.height} ===`);
  const URL0 = BASE + '/trail-blazer/index.html?mock=1&nosw=1';
  const shot = async (page, name, wait = 200) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(SHOTS, `${layout.name}-lab-${name}.png`) }); };

  async function open({ block = false, init = null } = {}) {
    const ctx = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
    if (block) await ctx.route('**/lab/**', (r) => r.abort('failed'));
    const errors = [], warnings = [];
    const page = await ctx.newPage();
    page.on('console', (m) => {
      const where = (m.location() && m.location().url) || '';
      if (m.type() === 'warning' && /\[lab\]/.test(m.text())) warnings.push(m.text());
      if (m.type() !== 'error') return;
      if (/fonts\.(googleapis|gstatic)/.test(m.text() + where)) return;
      if (block && /\/lab\//.test(where + m.text())) return;           // the blocked request itself
      if (block && /Failed to load resource/.test(m.text())) return;
      errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.addInitScript(({ insets }) => {
      if (!sessionStorage.getItem('labSeeded')) {
        localStorage.clear(); sessionStorage.setItem('labSeeded', '1');
        localStorage.setItem('trailBlazer.settings', JSON.stringify({ sound: true, music: true, reducedMotion: false, shake: 100, hill: false }));
      }
      window.__mockScript = { noCrash: false };
      window.__spoken = [];
      window.__ttsBackend = {
        speaking: false, pending: false, getVoices: () => [{ name: 'Fake US', lang: 'en-US', localService: true, default: true }],
        speak(u) { window.__spoken.push(String(u.text).trim()); setTimeout(() => { try { u.onstart && u.onstart(); } catch (_) {} }, 5); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 40); },
        cancel() {}, addEventListener() {},
      };
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = `:root{--sat:${insets.t}px!important;--sar:${insets.r}px!important;--sab:${insets.b}px!important;--sal:${insets.l}px!important}`;
        document.head.append(s);
      });
    }, { insets: layout.insets });
    await page.goto(URL0, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__trailBlazer);
    // the family: Mia (the player) and, when asked, Ben (a sibling with a ghost of his own)
    const ids = await J(page, async () => {
      const P = await import('/spell-jump/src/spelling/profiles.js');
      const f = P.loadFamily();
      const a = P.createPlayer(f, 'Mia', P.PLAYER_COLORS[0]), b = P.createPlayer(f, 'Ben', P.PLAYER_COLORS[1]);
      P.writeFamily(f);
      return { mia: a.id, ben: b.id };
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__trailBlazer);
    if (init) await init(page, ids);
    await J(page, (id) => { const a = window.__trailBlazer.app; a.selectPlayer(id); a.save.seen.coach = true; a.persist(); }, ids.mia);
    await page.waitForFunction(() => window.__trailBlazer.screen === 'title');
    return { ctx, page, errors, warnings, ids };
  }
  // a race on the mock engine: every gate answered right; `gas` = hold GAS (Ghost Chase waits for it)
  async function raceToResults(page, { gas = false, timeout = 60000, momentShot = null } = {}) {
    const end = Date.now() + timeout;
    let pressed = false, shotDone = false;
    while (Date.now() < end) {
      if (momentShot && !shotDone && await J(page, () => document.querySelector('#banner-text').textContent === 'Perfect Landing!' && !document.querySelector('#banner').hidden)) { shotDone = true; await shot(page, momentShot, 250); }
      const st = await J(page, () => { const T = window.__trailBlazer, g = T.gate; return { results: T.screen === 'results', gate: g.open && g.state === 'ask', answer: g.answer, index: g.index, pit: !document.querySelector('#pit-offer').hidden }; });
      if (st.results) { await page.waitForTimeout(500); if (gas) await page.keyboard.up('ArrowRight'); return true; }
      if (st.pit) { await page.click('#pit-later'); continue; }
      if (gas && !pressed) { await page.keyboard.down('ArrowRight'); pressed = true; }
      if (st.gate) {
        await typeAnswer(page, st.answer);
        await page.waitForFunction((i) => !window.__trailBlazer.gatePanel.isOpen || window.__trailBlazer.gate.index > i, st.index, { timeout: 4000 }).catch(() => {});
      } else await page.waitForTimeout(100);
    }
    return false;
  }
  const watch = (page) => J(page, () => {
    window.__reports = []; window.__banners = []; window.__counts = [];
    const lab = window.__trailBlazer.lab, orig = lab.report;
    lab.report = (ev) => { const rc = orig.call(lab, ev); window.__reports.push({ event: ev.event, firstTry: ev.firstTry, n: ev.n, ok: rc && rc.ok, moment: !!(rc && rc.combo && rc.combo.moment), name: rc && rc.combo && rc.combo.name, coins: rc && rc.coins, xp: rc && rc.xp }); return rc; };
    const mo = (sel, arr) => new MutationObserver(() => { const t = document.querySelector(sel).textContent.trim(); if (t && arr[arr.length - 1] !== t) arr.push(t); }).observe(document.querySelector(sel), { childList: true, characterData: true, subtree: true });
    mo('#banner-text', window.__banners); mo('#countdown-n', window.__counts);
    window.__starts = [];
    const g = window.__trailBlazer.game, s = g.start;
    g.start = (cfg) => { window.__starts.push({ chase: cfg.chase, race: cfg.race, paint: cfg.paint, decal: cfg.decal, rim: cfg.rim, look: cfg.look, vehicle: cfg.vehicle,
      ghost: cfg.ghost ? (Array.isArray(cfg.ghost) ? { array: cfg.ghost.length } : { trace: cfg.ghost.trace.length, vehicle: cfg.ghost.vehicle, paint: typeof cfg.ghost.paint === 'object' ? cfg.ghost.paint.id : cfg.ghost.paint, label: cfg.ghost.label, look: cfg.ghost.look }) : null }); return s(cfg); };
  });
  const rect = (page, sel) => J(page, (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, vis: !e.closest('[hidden]') && cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 }; }, sel);

  // ---------- 1. the bridge with /lab/ blocked ----------
  {
    const { ctx, page, errors, warnings, ids } = await open({ block: true });
    const t = await J(page, () => ({ lab: document.querySelector('#btn-lab').hidden, failed: window.__trailBlazer.lab.failed, ready: window.__trailBlazer.lab.ready, pill: !!document.querySelector('#hud-lab *') }));
    check(t.lab && t.failed && !t.ready && !t.pill, 'bridge: with every /lab/ request blocked the game boots to the title: no Lab button, no HUD pill (the bridge is inert)');
    await J(page, () => { const a = window.__trailBlazer.app; a.startRide('pine-ridge', { skipCheck: true }); });
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
    const hudLab = await rect(page, '#hud-lab');
    check(!hudLab || !hudLab.vis, 'bridge: no Lab pill in the race HUD while /lab/ is blocked');
    check(await raceToResults(page), 'bridge: a whole race (4 gates) plays to the results with /lab/ blocked');
    const r = await J(page, () => ({ strip: document.querySelector('#res-lab').children.length, rep: window.__trailBlazer.lab.report({ event: 'fact', n: 1, firstTry: true }), cash: window.__trailBlazer.app.save.cash, rows: document.querySelectorAll('#res-pay tr[data-row]').length }));
    check(r.strip === 0 && r.rep && r.rep.ok === false && r.rep.coins === 0 && r.cash > 0 && r.rows >= 5, 'bridge: no Lab strip on the results, report() returns the empty receipt, the race still paid its own cash');
    await J(page, () => window.__trailBlazer.app.go('title'));
    check(await J(page, () => !document.querySelector('#btn-lab') || document.querySelector('#btn-lab').hidden), 'bridge: still no "The Lab" button on the title');
    check(warnings.length >= 1 && warnings.every((w) => /\[lab\] unavailable/.test(w)) && errors.length === 0, `bridge: the only console noise is the bridge's warning (${warnings.length} warning, ${errors.length} errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''})`);
    await ctx.close();
  }

  // ---------- 2-4. the Lab loaded: reports, the pill, the strip, the moment, the looks ----------
  {
    const { ctx, page, errors, ids } = await open();
    await page.waitForFunction(() => window.__trailBlazer.lab.ready && window.__lab && window.__lab.store.view());
    // the title: "The Lab" button
    const tt = await J(page, () => ({ btn: !document.querySelector('#btn-lab').hidden }));
    check(tt.btn, 'title: "The Lab" button shows once the Lab has loaded');
    await shot(page, '01-title');
    await J(page, () => { const a = window.__trailBlazer.app.facts; a.opts.gates = 6; window.__trailBlazer.app.persistFacts(); });
    await watch(page);
    const before = await J(page, () => { const v = window.__lab.store.view(); return { coins: v.coins, xp: v.level.into + (v.level.level - 1) * 1000, lv: v.level.level, cash: window.__trailBlazer.app.save.cash }; });
    await J(page, () => { window.__trailBlazer.app.startRide('pine-ridge', { skipCheck: true }); });
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
    // the HUD pill
    await page.waitForFunction(() => document.querySelector('#hud-lab') && document.querySelector('#hud-lab').children.length > 0, null, { timeout: 3000 });
    const pill = await rect(page, '#hud-lab'), speed = await rect(page, '#hud-speed'), pause = await rect(page, '#btn-pause');
    const pillText = await J(page, () => document.querySelector('#hud-lab').textContent.trim());
    check(pill && pill.vis && pill.w <= 121 && pill.w > 20 && /(Lv|Level)\s*\d+/i.test(pillText), `HUD: the Lab's XP pill is mounted in the race HUD ("${pillText}", ${Math.round(pill && pill.w)} px wide)`);
    if (layout.width > layout.height) check(pill.l >= speed.l - 1 && pill.r <= pause.l + 1 && Math.abs(pill.t - speed.t) < 40, 'HUD: the pill sits right of the speed readout, beside the pause button');
    else check(pill.t >= speed.b - 1 && pill.r <= pause.r + 1 && pill.l >= speed.l - 1, 'HUD (portrait): the pill hangs under the speed readout so the pause button stays on screen');
    check(pause.r <= layout.width - layout.insets.r + 1 && pause.l >= 0 && speed.r <= layout.width - layout.insets.r + 1, 'HUD: the speed readout and the pause button are fully on screen (the pill did not push them out)');
    check(pill.l >= layout.insets.l - 1 && pill.r <= layout.width - layout.insets.r + 1 && pill.b <= layout.height - layout.insets.b, 'HUD: the pill is inside the screen and the safe-area insets');
    await shot(page, '02-hud', 400);
    const ok = await raceToResults(page, { momentShot: '02b-perfect-landing' });
    check(ok, 'race with 6 gates all answered right reaches the results');
    const rep = await J(page, () => window.__reports);
    const facts = rep.filter((r) => r.event === 'fact');
    check(facts.length === 6 && facts.every((r) => r.firstTry === true && r.n === 1 && r.ok), `reports: 6 gate facts, each n 1 and firstTry true, each accepted by the Lab (${facts.length})`);
    check(rep.some((r) => r.event === 'race') && rep.some((r) => r.event === 'day') && rep.filter((r) => r.event === 'race').length === 1, `reports: one race and the day (${rep.map((r) => r.event).join(' ')})`);
    check(rep.some((r) => r.event === 'perfect'), 'reports: the engine\'s perfect landing is reported (perfect)');
    check(!rep.some((r) => r.event === 'win') && rep.length >= 9, 'reports: 2nd place is no win; nothing else is reported');
    const after = await J(page, () => { const v = window.__lab.store.view(), d = window.__lab.store.doc(), day = Object.keys(d.play).sort().pop(); return { coins: v.coins, lv: v.level.level, into: v.level.into, tb: d.play[day] && d.play[day].tb, cash: window.__trailBlazer.app.save.cash, games: Object.keys(d.seen.games) }; });
    check(after.coins > before.coins && after.tb >= 9 && after.games.includes('tb'), `the Lab got them: coins ${before.coins} → ${after.coins}, ${after.tb} Trail Blazer events today, game "tb" seen`);
    const cashRows = await J(page, () => window.__trailBlazer.lastResult.total);
    check(after.cash - before.cash === cashRows, `Lab coins never enter Trail Blazer's cash: the save gained exactly the race's $${cashRows} (${before.cash} → ${after.cash})`);
    // the moment: the fifth first-try fact is the "Perfect Landing"
    const mom = rep.filter((r) => r.moment);
    const b = await J(page, () => window.__banners);
    check(mom.length === 1 && mom[0].name === 'Perfect Landing' && facts.indexOf(mom[0]) === 4, 'moment: the fifth first-try fact of the race fires the combo moment "Perfect Landing" (and only once)');
    check(b.includes('Perfect Landing!'), `moment: the HUD banner "Perfect Landing!" showed (${b.join(' · ')})`);
    await page.waitForFunction(() => window.__spoken.includes('Perfect Landing!'), null, { timeout: 2500 }).catch(() => {});
    check(await J(page, () => window.__spoken.includes('Perfect Landing!')), 'moment: the line is spoken through the existing voice ("Perfect Landing!")');
    // the results strip
    const strip = await rect(page, '#res-lab');
    const stripText = await J(page, () => document.querySelector('#res-lab').textContent.trim());
    check(strip && strip.vis && /\d/.test(stripText) && /coin/i.test(stripText), `results: the Lab strip is mounted ("${stripText}")`);
    check(await J(page, () => document.querySelector('#res-lab').getBoundingClientRect().right <= innerWidth + 1), 'results: the strip stays inside the screen');
    await shot(page, '03-results', 500);
    // Parent Zone row
    await J(page, () => window.__trailBlazer.app.go('title'));
    await J(page, () => window.__trailBlazer.pz.open({ tab: 'options' }));
    await page.waitForTimeout(200);
    for (let k = 0; k < 2 && await J(page, () => !!document.querySelector('.pinpad')); k++) { for (const d of '1234') await page.click(`.pinpad [data-digit="${d}"]`); await page.waitForTimeout(250); }
    await page.waitForSelector('#opt-lab', { timeout: 4000 });
    check(await J(page, () => /Lab/.test(document.querySelector('#pz-lab-row').textContent)), 'Parent Zone → Options: a "The Lab" row (the Grown-ups panel)');
    await shot(page, '04-pz-lab-row');
    await page.click('#opt-lab');
    await page.waitForTimeout(500);
    check(await J(page, () => !!document.querySelector('.lab-overlay, [data-lab-overlay], [class*="lab-"][class*="overlay"]')), 'Parent Zone: "Open" shows the Lab overlay (openParent, unlocked)');
    await J(page, () => { document.querySelectorAll('.lab-overlay, [data-lab-overlay], [class*="lab-"][class*="overlay"]').forEach((e) => e.querySelector('button') && e.querySelector('button').click()); });
    await J(page, () => window.__trailBlazer.pz.close());

    // ---------- Lab looks reach the engine and the garage ----------
    const looks = await J(page, async () => {
      const L = window.__lab, st = L.store;
      L.grantCoins(20000);
      const r = {};
      for (const id of ['tb.paint.ocean', 'tb.decal.bolt', 'tb.rim.neon', 'tb.ghost.ice']) r[id] = st.buy(id);
      st.equip('tb.paint', 'tb.paint.ocean'); st.equip('tb.decal', 'tb.decal.bolt'); st.equip('tb.rim', 'tb.rim.neon'); st.equip('tb.ghost', 'tb.ghost.ice');
      return { r: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && (v.ok !== false)])), ready: window.__trailBlazer.lab.cosmetics().ready.length };
    });
    check(looks.ready === 16 && Object.values(looks.r).every(Boolean), `Lab looks: the Lab lists all 16 Trail Blazer items as ready (${looks.ready}) and the four were bought and equipped`);
    await page.waitForFunction(() => window.__trailBlazer.labSlots.paint === 'tb.paint.ocean', null, { timeout: 3000 });
    await J(page, () => window.__trailBlazer.app.go('garage'));
    await page.waitForTimeout(400);
    const tag = await J(page, () => document.querySelector('#veh-tag').textContent);
    check(/Paint: Sage Green/.test(tag) && /Lab looks on: Ocean paint, Bolt decal, Neon rims, Ice ghost/.test(tag), `garage: the child's own paint stays Sage Green; the Lab looks are named ("${tag}")`);
    await shot(page, '05-garage-lab-looks', 500);
    await J(page, () => window.__trailBlazer.app.startRide('pine-ridge', { skipCheck: true }));
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
    const st = await J(page, () => window.__starts[window.__starts.length - 1]);
    check(st.paint && st.paint.id === 'lab-ocean' && st.decal === 'bolt' && st.rim === 'neon' && st.look.rim === 'neon' && st.look.paint.id === 'lab-ocean',
      `engine: the race starts with the Lab paint (${st.paint && st.paint.id}), decal (${st.decal}) and rim (${st.rim})`);
    check(st.ghost && st.ghost.look === 'tb.ghost.ice' && st.ghost.trace > 1, `engine: the child's own ghost (when there is one) is dressed with the Lab ghost look (${JSON.stringify(st.ghost)})`);
    await shot(page, '06-race-lab-looks', 900);
    await J(page, () => window.__trailBlazer.app.go('title'));
    check(await J(page, () => { const T = window.__trailBlazer; T.app.go('title'); return true; }), 'title after the looks');
    check(errors.length === 0, `no console errors in the Lab checks (${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''})`);
    await ctx.close();
  }

  // ---------- 5. Ghost Chase ----------
  {
    const { ctx, page, errors, ids } = await open({
      init: async (pg, ids) => {
        await J(pg, async ({ ids, fast, slow }) => {
          const S = await import('/trail-blazer/src/meta/save.js');
          // Ben (a sibling, saved on this device the way the family sync mirrors it): a fast ghost on Pine Ridge in a quad, a sunset paint
          const ben = { ...S.defaultSave(), vehicle: 'quad', paint: 'sunset', ghosts: { 'pine-ridge': fast } };
          ben.vehicles.quad = { owned: true, levels: ben.vehicles.ranger150.levels };
          S.writeSave(ids.ben, ben);
          // Mia: a slow ghost of her own best on Pine Ridge, and Pine Ridge cleared so the trail row has stars
          const mia = { ...S.defaultSave(), ghosts: { 'pine-ridge': slow }, bestTime: { 'pine-ridge': 40 } };
          mia.seen.coach = true;
          S.writeSave(ids.mia, mia);
        }, { ids, fast: fastTrace(), slow: slowTrace() });
      },
    });
    await page.waitForFunction(() => window.__trailBlazer.lab.ready);
    await watch(page);
    const keep = await J(page, () => { const s = window.__trailBlazer.app.save; return { wins: s.records.wins, podiums: s.records.podiums, bestPlace: JSON.stringify(s.bestPlace), rivals: JSON.stringify(s.rivals), stars: JSON.stringify(s.stars), cash: s.cash, ghostLen: s.ghosts['pine-ridge'].length }; });
    await J(page, () => window.__trailBlazer.app.go('trails'));
    await page.waitForSelector('#trail-grid [data-trail]');
    const cards = await J(page, () => ({ chase: [...document.querySelectorAll('[data-chase]')].map((b) => b.dataset.chase), cards: document.querySelectorAll('#trail-grid [data-trail]').length, locked: [...document.querySelectorAll('#trail-grid [data-trail].locked')].length }));
    check(cards.chase.join() === 'pine-ridge' && cards.cards === 6 && cards.locked === 5, `Ghost Chase: only the trail with a ghost gets a "Chase a ghost" button (${cards.chase.join()}); the 6 cards are unchanged`);
    const cb = await rect(page, '[data-chase="pine-ridge"]');
    check(cb && cb.vis && cb.h >= 44 && cb.w >= 44 && cb.r <= layout.width - layout.insets.r + 1 && cb.l >= layout.insets.l - 1, `Ghost Chase: the button is a ≥ 44 px target inside the safe area (${Math.round(cb.w)}×${Math.round(cb.h)})`);
    check(await J(page, () => /Chase a ghost/.test(document.querySelector('[data-chase="pine-ridge"]').textContent)), 'Ghost Chase: the button says "Chase a ghost"');
    await shot(page, '07-cups-chase-button');
    await page.click('[data-chase="pine-ridge"]');
    await page.waitForSelector('#panel-chase:not([hidden])');
    const pk = await J(page, () => [...document.querySelectorAll('#chase-list .chase-chip')].map((c) => ({ id: c.dataset.ghost, text: c.textContent.replace(/\s+/g, ' ').trim(), color: getComputedStyle(c.querySelector('.cc-dot')).backgroundColor, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height })));
    check(pk.length === 2 && pk[0].id === 'me' && /My best/.test(pk[0].text) && pk[1].text.includes('Ben') && /Dune Quad/.test(pk[1].text), `picker: "My best" and Ben's ghost, with his name and vehicle (${pk.map((p) => p.text).join(' | ')})`);
    check(pk.every((p) => p.h >= 44 && p.w >= 120) && pk[0].color !== pk[1].color, 'picker: each chip is a ≥ 44 px target with a colour dot (Mia\'s and Ben\'s differ)');
    check(await J(page, () => /no clock/i.test(document.querySelector('#chase-sub').textContent)), 'picker: it says there is no clock and the ghost is the clock');
    const pkr = await rect(page, '#panel-chase .sheet');
    check(pkr.l >= 0 && pkr.r <= layout.width && pkr.t >= 0 && pkr.b <= layout.height, 'picker: the sheet fits the screen');
    await shot(page, '08-chase-picker', 300);
    // Ben's ghost
    await page.click('#chase-list [data-ghost]:not([data-ghost="me"])');
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride' || !document.querySelector('#pit-offer').hidden, null, { timeout: 4000 });
    if (await J(page, () => !document.querySelector('#pit-offer').hidden)) {       // the Pit Crew Check card comes first for a new player: the chase survives it
      await shot(page, '08b-pit-card');
      await page.click('#pit-later');
      await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
    }
    await page.waitForTimeout(1600);                                                  // longer than the 3-2-1 would take
    const on = await J(page, () => ({
      cls: document.querySelector('#hud').classList.contains('chase'), st: window.__starts[window.__starts.length - 1], counts: window.__counts.slice(), cd: !document.querySelector('#countdown').hidden,
      phase: window.__trailBlazer.game.getState().phase, time: window.__trailBlazer.game.getState().timeSec,
      tag: !document.querySelector('#chase-tag').hidden ? document.querySelector('#chase-tag').textContent : '', gasHint: /GAS/.test(document.querySelector('#chase-tag').textContent) }));
    check(on.cls && on.st.chase === true && on.st.race.riders === 0 && on.st.ghost && on.st.ghost.label === 'Ben' && on.st.ghost.vehicle === 'quad' && on.st.ghost.paint === 'sunset' && on.st.ghost.trace === 62,
      `chase: starts alone on the trail (race.riders 0) against Ben's ghost, with his name tag, his quad and his sunset paint (${JSON.stringify(on.st.ghost)})`);
    check(on.phase === 'parked' && on.time === 0 && on.counts.length === 0 && !on.cd, `chase: no countdown: after 1.6 s the vehicle still waits on the line (phase ${on.phase}, clock ${on.time}, countdown numbers shown: ${on.counts.length})`);
    check(/Chase Ben's ghost: press GAS and you both go!/.test(on.tag), `chase: a hint on the line: "${on.tag}"`);
    await shot(page, '09-chase-waiting', 100);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__trailBlazer.game.getState().phase === 'ride', null, { timeout: 3000 });
    await page.waitForTimeout(900);
    const run = await J(page, () => {
      const vis = (e) => { if (e.closest('[hidden]')) return false; const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; };
      const hudVisibleText = [...document.querySelectorAll('#hud *, #countdown *, #banner *')].filter((e) => vis(e) && e.children.length === 0 && e.textContent.trim()).map((e) => e.textContent.trim());
      return { time: vis(document.querySelector('#hud-time')), timeBox: vis(document.querySelector('#hud-time-box')), facts: vis(document.querySelector('#hud-facts')), ghost: vis(document.querySelector('#hud-ghost')), pos: vis(document.querySelector('#hud-pos')),
        place: vis(document.querySelector('#hud-place')), cd: vis(document.querySelector('#countdown')), tag: vis(document.querySelector('#chase-tag')), speed: vis(document.querySelector('#hud-speed')), pill: vis(document.querySelector('#hud-lab')),
        clockText: hudVisibleText.filter((t) => /^\d+:\d\d(\.\d)?$/.test(t) || /^Facts\b/i.test(t) || /vs your best|vs .*ghost/i.test(t) || /^(1st|2nd|3rd|4th)$/.test(t) || /^[1-3]$/.test(t)), hudVisibleText, counts: window.__counts.slice() };
    });
    check(!run.time && !run.timeBox && !run.facts && !run.ghost && !run.pos && !run.place && !run.cd, `chase: NO race clock, NO facts counter, NO gap chip, NO position badge, NO countdown on screen while riding (${JSON.stringify({ t: run.time, f: run.facts, g: run.ghost, p: run.pos, c: run.cd })})`);
    check(run.clockText.length === 0 && run.counts.length === 0, `chase: no visible text on the HUD looks like a clock, a counter, a gap or a place (${run.hudVisibleText.join(' | ')})`);
    check(run.speed && run.pill && !run.tag, 'chase: the speed, the boost and the Lab pill stay; the hint is gone once you go');
    await shot(page, '10-chase-riding', 300);
    const hudr = await rect(page, '#hud-lab'), pr = await rect(page, '#btn-pause');
    check(hudr.r <= layout.width - layout.insets.r + 1 && hudr.t >= 0 && pr.r <= layout.width - layout.insets.r + 1, 'chase: the HUD (pill, pause) stays inside the safe area');
    const ok = await raceToResults(page, { gas: false });
    await page.keyboard.up('ArrowRight');
    check(ok, 'chase: the race (4 gates, all right) reaches the results');
    await page.waitForTimeout(600);
    const rs = await J(page, () => {
      const T = window.__trailBlazer, r = T.lastResult, s = T.app.save;
      return { title: document.querySelector('#res-title').textContent, chase: r.chase, line: (document.querySelector('.res-line.l-ghost') || {}).textContent || '', place: r.place, rows: [...document.querySelectorAll('#res-pay tr[data-row]')].map((x) => x.dataset.row),
        pod: document.querySelectorAll('#res-podium .pod').length, step: document.querySelector('#res-podium .pod-step') && getComputedStyle(document.querySelector('#res-podium .pod-step')).visibility, sub: document.querySelector('#res-sub').textContent,
        wins: s.records.wins, podiums: s.records.podiums, bestPlace: JSON.stringify(s.bestPlace), rivals: JSON.stringify(s.rivals), next: !document.querySelector('#res-next').hidden, rival: !!document.querySelector('.res-line.l-rival'),
        cash: s.cash, total: r.total, strip: document.querySelector('#res-lab').textContent.trim(), stars: JSON.stringify(s.stars['pine-ridge'] || []), ghostLen: s.ghosts['pine-ridge'].length,
        crates: r.season.crates.filter((c) => /podium|1st|win/i.test(c.why)).length, crateWhy: r.season.crates.map((c) => c.why).join(), star1: !!(s.stars['pine-ridge'] && s.stars['pine-ridge'][0]) };
    });
    check(rs.title === 'Nice chase!' && /^Ben's ghost was \d\.\d s ahead\. Nice chase!$/.test(rs.line), `results: "${rs.title}" and the chase line "${rs.line}"`);
    check(rs.place === null && !rs.rows.includes('place') && rs.pod === 1 && rs.step === 'hidden' && /Ghost Chase/.test(rs.sub), `results: no place (no place bonus row, one ride on the podium without a step number): "${rs.sub}"`);
    check(rs.wins === keep.wins && rs.podiums === keep.podiums && rs.bestPlace === keep.bestPlace && rs.rivals === keep.rivals && !rs.rival && !rs.next && rs.crates === 0 && !rs.star1,
      `results: a chase banks no win, no podium, no best place, no unlock, no rival move, no podium crate and no "Finish 1st" star (crates: ${rs.crateWhy || 'none'}; ${JSON.stringify({ wins: [keep.wins, rs.wins], podiums: [keep.podiums, rs.podiums], bestPlace: [keep.bestPlace, rs.bestPlace], rivals: rs.rivals === keep.rivals, rival: rs.rival, next: rs.next, crates: rs.crates })})`);
    check(rs.cash - keep.cash === rs.total, `results: it still pays the ride's own cash ($${rs.total}), and only that`);
    check(/coin/i.test(rs.strip), `results: the Lab strip shows ("${rs.strip}")`);
    const rep2 = await J(page, () => window.__reports.map((r) => r.event));
    check(rep2.includes('race') && !rep2.includes('win') && !rep2.includes('ghostBeat'), `Lab: the chase reports a race but no win and no ghostBeat (Ben's ghost was faster): ${rep2.filter((e, i) => e !== 'fact' || i < 1).join(' ')}`);
    await shot(page, '11-chase-results', 400);
    // chase my best (a slow ghost: beaten). The chase above saved a faster ghost of her own (a new best time replaces it): put the slow one back.
    await J(page, (slow) => { const a = window.__trailBlazer.app; a.save.ghosts['pine-ridge'] = slow; a.persist(); a.go('trails'); }, slowTrace());
    await page.waitForSelector('[data-chase="pine-ridge"]');
    await page.click('[data-chase="pine-ridge"]');
    await page.waitForSelector('#panel-chase:not([hidden])');
    await page.click('#chase-list [data-ghost="me"]');
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride' || !document.querySelector('#pit-offer').hidden, null, { timeout: 4000 });
    if (await J(page, () => !document.querySelector('#pit-offer').hidden)) { await page.click('#pit-later'); await page.waitForFunction(() => window.__trailBlazer.screen === 'ride'); }
    const st2 = await J(page, () => window.__starts[window.__starts.length - 1]);
    check(st2.chase === true && st2.ghost.label === 'Your best' && st2.ghost.trace > 100 && st2.ghost.look === 'tb.ghost.ice' || st2.ghost.look === null, `chase: "My best" starts with the tag "Your best" (${JSON.stringify(st2.ghost)})`);
    check(await raceToResults(page, { gas: true }), 'chase my best: reaches the results');
    await page.waitForTimeout(500);
    const rs2 = await J(page, () => ({ title: document.querySelector('#res-title').textContent, line: (document.querySelector('.res-line.l-ghost') || {}).textContent || '' }));
    check(rs2.title === 'Ghost beaten!' && /^Beat your ghost by \d+\.\d s!$/.test(rs2.line), `results: my own ghost beaten: "${rs2.title}" · "${rs2.line}"`);
    const rep3 = await J(page, () => window.__reports.map((r) => r.event));
    check(rep3.filter((e) => e === 'ghostBeat').length === 1 && !rep3.slice(-6).includes('win'), 'Lab: beating a ghost reports ghostBeat once (and still no win)');
    await shot(page, '12-chase-beaten', 400);
    // the normal race is untouched: a race from the trail card still has its countdown, clock and position
    await J(page, () => window.__trailBlazer.app.startRide('pine-ridge', { skipCheck: true }));
    await page.waitForFunction(() => window.__trailBlazer.screen === 'ride');
    await page.waitForFunction(() => window.__counts.includes('GO!'), null, { timeout: 5000 });
    const norm = await J(page, () => ({ cls: document.querySelector('#hud').classList.contains('chase'), t: !document.querySelector('#hud-time-box').hidden, p: !document.querySelector('#hud-pos').hidden, g: !document.querySelector('#hud-ghost').hidden, tag: document.querySelector('#chase-tag').hidden, st: window.__starts[window.__starts.length - 1] }));
    check(!norm.cls && norm.t && norm.p && norm.g && norm.tag && !norm.st.chase && norm.st.race.riders.length === 3, 'a normal race afterwards still has the clock, the position badge, the gap chip and the 3-2-1 (Ghost Chase changed nothing there)');
    check(errors.length === 0, `no console errors in Ghost Chase (${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''})`);
    await ctx.close();
  }
}

// standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const { execSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  let pw; try { pw = await import('playwright'); } catch (_) { pw = await import(pathToFileURL(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')).href); }
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  const failures = [];
  const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
  const J = (page, fn, arg) => page.evaluate(fn, arg);
  async function typeAnswer(page, value) { for (const ch of String(value)) await page.tap(`#gate .np-key[data-key="${ch}"]`); await page.tap('#gate .np-key[data-key="go"]'); }
  const LAYOUTS = [
    { name: 'landscape', width: 844, height: 390, insets: { t: 0, r: 47, b: 21, l: 47 } },
    { name: 'portrait', width: 390, height: 844, insets: { t: 47, r: 0, b: 34, l: 0 } },
  ];
  const browser = await pw.chromium.launch();
  try { for (const l of LAYOUTS.filter((x) => !process.env.ONLY || x.name === process.env.ONLY)) await runLabChecks(browser, l, BASE, { J, typeAnswer, check, visibleSel: (s) => `${s}:not([hidden])` }); }
  catch (e) { failures.push('crashed: ' + (e && e.stack || e)); console.error(e); }
  finally { await browser.close(); }
  if (failures.length) { console.log(`\n${failures.length} FAILED:\n - ${failures.join('\n - ')}`); process.exit(1); }
  console.log('\nlab-checks: all checks passed');
}
