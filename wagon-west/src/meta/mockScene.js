// The mock scene (SPEC §11, §12): the same API as the Scene stream's src/scene/engine.js (createScene), drawn as a
// simple placeholder on the canvas, so the app runs and the UI smoke tests play whole legs without the real scene.
// Used with ?mock=1, or when src/scene/engine.js is missing or throws (main.js falls back to it).
//   setLeg / setParty / setTravel / setBackdrop: kept and drawn (a sky by biome and weather, rolling hills that scroll
//   with milesDone, the covered wagon in its paint with the flag, the three companions in their colours and hats, the
//   stop's name on the backdrops)
//   spotAnimal: 'animalSpotted' at once · celebrate: instant (a few frames of confetti)
//   startHunt({ shots: 5 }): scripted, 5 shots on a timer alternating hit / miss (rabbit, turkey, deer): a 'hunt'
//   { hit, animal, meatLb } per shot, then 'huntEnd' { meatLb, hits, shots }. A tap or Space looses the next arrow at
//   once (the pointer belongs to the scene while a hunt runs).
//   startFish({ casts: 4 }): 4 casts on a timer, the first 3 bite: 'fish' { size, lb } per bite, then 'fishEnd' { fishLb }
//   endMiniGame(): the app left early: the timer stops, no end event; it returns the summary so far
//   ({ meatLb, hits, shots } | { fishLb, caught, casts } | null) · setReducedMotion(on) · fishEnd { fishLb, caught, casts }
// Timing for tests: window.__mockScript = { shotMs } (default 650 ms between shots / casts). 'ready' fires once after the first frame.
const SKIES = {
  prairie: ['#8fc6e8', '#f6e3b4'], bluffs: ['#9cc3e0', '#f2d2a0'], highdesert: ['#a8cfe6', '#f4d9a8'],
  mountains: ['#7fb2dc', '#e4ecf2'], gorge: ['#8db8d4', '#d9e6e8'], valley: ['#92cbe6', '#eef2c8'],
};
const GROUNDS = { prairie: '#a9b85a', bluffs: '#c49a62', highdesert: '#c8ad78', mountains: '#7f9a6a', gorge: '#6f8f6a', valley: '#8fbf5f' };
const HUNT = [{ animal: 'rabbit', meatLb: 4 }, { animal: 'turkey', meatLb: 10 }, { animal: 'deer', meatLb: 30 }];
const FISH = [{ size: 'small', lb: 2 }, { size: 'medium', lb: 4 }, { size: 'big', lb: 7 }];

export function createScene(canvas, { onEvent = () => {}, reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const S = {
    leg: { id: '', biome: 'prairie', miles: 150, stop: { kind: 'river', name: '' } },
    party: { animal: 'oxen', companions: [], wagon: { paint: '#f3ead7', flag: 'none', name: '' } },
    travel: { milesDone: 0, pace: 'steady', rations: 'plenty', weather: 'clear', mood: 'happy', foodLow: false, moving: false },
    backdrop: 'trail', mini: null, playing: true, confetti: 0, spotted: null, destroyed: false,
  };
  let raf = 0, miniTimer = 0, w = 0, h = 0, dpr = 1;
  const emit = (type, data = {}) => { try { onEvent({ type, ...data }); } catch (e) { console.error('[mockScene] onEvent', e); } };
  const script = () => (typeof window !== 'undefined' && window.__mockScript) || {};
  const shotMs = () => Math.max(20, Number(script().shotMs) || 650);

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width || canvas.clientWidth || 300)); h = Math.max(1, Math.round(r.height || canvas.clientHeight || 150));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    draw();
  }
  function hill(y0, amp, period, off, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin((x + off) / period) * amp);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  function draw() {
    if (S.destroyed || !w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [top, low] = SKIES[S.leg.biome] || SKIES.prairie;
    const wx = S.travel.weather;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, wx === 'storm' || wx === 'rain' ? '#5c6878' : wx === 'dusk' ? '#5a3f6e' : top);
    g.addColorStop(1, wx === 'dusk' ? '#f0a35e' : low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const scroll = S.travel.milesDone * 40;
    hill(h * 0.55, 18, 90, scroll * 0.2, 'rgba(90,110,120,.35)');
    hill(h * 0.66, 12, 60, scroll * 0.5, (GROUNDS[S.leg.biome] || GROUNDS.prairie) + 'cc');
    ctx.fillStyle = GROUNDS[S.leg.biome] || GROUNDS.prairie; ctx.fillRect(0, h * 0.74, w, h);
    ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, h * 0.82); ctx.lineTo(w, h * 0.82); ctx.stroke();
    // the stop on its backdrop
    if (S.backdrop !== 'trail') {
      ctx.fillStyle = 'rgba(40,24,12,.55)';
      if (S.backdrop === 'fort' || S.backdrop === 'post') for (let i = 0; i < 12; i++) ctx.fillRect(w * 0.62 + i * 14, h * 0.5, 10, h * 0.26);
      if (S.backdrop === 'river') { ctx.fillStyle = '#4f9fc8'; ctx.fillRect(w * 0.55, h * 0.72, w * 0.45, h * 0.12); }
      if (S.backdrop === 'landmark') { ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.74); ctx.lineTo(w * 0.76, h * 0.3); ctx.lineTo(w * 0.82, h * 0.74); ctx.fill(); }
    }
    // the wagon: wheels, the bed, the canvas top in its paint; the flag; the team in front; the companions beside it
    const bx = w * 0.36, by = h * 0.8;
    const spin = scroll / 10;
    ctx.fillStyle = '#5a3b22'; ctx.fillRect(bx - 60, by - 30, 120, 22);
    ctx.fillStyle = S.party.wagon.paint || '#f3ead7'; ctx.beginPath(); ctx.moveTo(bx - 58, by - 30); ctx.quadraticCurveTo(bx, by - 100, bx + 58, by - 30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 2; ctx.stroke();
    for (const x of [bx - 40, bx + 40]) {
      ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, by - 4, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + Math.cos(spin) * 16, by - 4 + Math.sin(spin) * 16); ctx.lineTo(x - Math.cos(spin) * 16, by - 4 - Math.sin(spin) * 16); ctx.stroke();
    }
    if (S.party.wagon.flag && S.party.wagon.flag !== 'none') { ctx.fillStyle = '#3b2616'; ctx.fillRect(bx + 50, by - 96, 3, 66); ctx.fillStyle = '#d9653b'; ctx.fillRect(bx + 53, by - 96, 24, 15); }
    ctx.fillStyle = S.party.animal === 'mules' ? '#8a6a4a' : '#6b4a2e';
    ctx.fillRect(bx + 76, by - 30, 44, 20); ctx.fillRect(bx + 116, by - 38, 14, 14);
    S.party.companions.slice(0, 3).forEach((c, i) => {
      const cx = bx - 90 - i * 30, cy = by - 22;
      ctx.fillStyle = c.color || '#d9653b'; ctx.fillRect(cx - 7, cy - 6, 14, 22);
      ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(cx, cy - 12, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2c22'; ctx.fillRect(cx - 11, cy - 21, 22, 4);
    });
    if (S.travel.weather === 'rain' || S.travel.weather === 'storm') {
      ctx.strokeStyle = 'rgba(220,235,255,.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) { const x = (i * 53 + scroll * 3) % w, y = (i * 37 + scroll * 7) % h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke(); }
    }
    if (S.spotted) { ctx.fillStyle = 'rgba(60,40,20,.8)'; ctx.font = '700 14px system-ui, sans-serif'; ctx.fillText(`(${S.spotted})`, w * 0.75, h * 0.62); }
    if (S.mini) {
      ctx.fillStyle = 'rgba(30,20,10,.35)'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff6e0'; ctx.font = '700 18px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(S.mini.kind === 'hunt' ? `Bow: ${S.mini.left} arrows left · ${S.mini.hits} got` : `Line: ${S.mini.left} casts left · ${S.mini.hits} bites`, w / 2, h * 0.4);
      ctx.textAlign = 'start';
    }
    if (S.confetti > 0) {
      for (let i = 0; i < 30; i++) { ctx.fillStyle = ['#f2b33d', '#d9653b', '#5bb8d6', '#7fb85a'][i % 4]; ctx.fillRect((i * 97 + S.confetti * 13) % w, (i * 41 + S.confetti * 9) % (h * 0.7), 6, 6); }
      S.confetti -= 1;
    }
    ctx.fillStyle = 'rgba(40,24,12,.45)'; ctx.font = '700 10px system-ui, sans-serif'; ctx.fillText('mock scene', 8, h - 8);
  }
  function loop() {
    raf = 0;
    if (S.destroyed || !S.playing) return;
    draw();
    if (S.travel.moving || S.confetti > 0 || S.mini) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && S.playing && !S.destroyed) raf = requestAnimationFrame(loop); };

  // ---------- the mini-games (scripted) ----------
  function stopMini() { clearTimeout(miniTimer); miniTimer = 0; S.mini = null; }
  function huntShot() {
    const m = S.mini;
    if (!m || m.kind !== 'hunt' || !S.playing) return;
    clearTimeout(miniTimer);
    const i = m.shots - m.left;
    const hit = i % 2 === 0;
    const a = HUNT[(m.seed + i) % HUNT.length];
    m.left -= 1;
    if (hit) { m.hits += 1; m.meat += a.meatLb; }
    emit('hunt', { hit, animal: a.animal, meatLb: hit ? a.meatLb : 0 });
    if (m.left <= 0) { const out = { meatLb: m.meat, hits: m.hits, shots: m.shots }; stopMini(); draw(); emit('huntEnd', out); return; }
    draw();
    miniTimer = setTimeout(huntShot, shotMs());
  }
  function fishCast() {
    const m = S.mini;
    if (!m || m.kind !== 'fish' || !S.playing) return;
    clearTimeout(miniTimer);
    const i = m.shots - m.left;
    m.left -= 1;
    if (i < 3) { const f = FISH[(m.seed + i) % FISH.length]; m.hits += 1; m.meat += f.lb; emit('fish', { size: f.size, lb: f.lb }); }
    if (m.left <= 0) { const out = { fishLb: m.meat, caught: m.hits, casts: m.shots }; stopMini(); draw(); emit('fishEnd', out); return; }
    draw();
    miniTimer = setTimeout(fishCast, shotMs());
  }
  const onPointer = (e) => { if (S.mini && S.mini.kind === 'hunt') { e.preventDefault(); huntShot(); } else if (S.mini && S.mini.kind === 'fish') { e.preventDefault(); fishCast(); } };
  const onKey = (e) => { if (S.mini && e.code === 'Space') { e.preventDefault(); if (S.mini.kind === 'hunt') huntShot(); else fishCast(); } };
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(canvas);

  const scene = {
    setLeg(leg = {}) { S.leg = { ...S.leg, ...leg }; draw(); },
    setParty(p = {}) { S.party = { ...S.party, ...p, wagon: { ...S.party.wagon, ...(p.wagon || {}) } }; draw(); },
    setTravel(t = {}) { S.travel = { ...S.travel, ...t }; if (S.travel.moving) kick(); else draw(); },
    setBackdrop(name) { S.backdrop = ['trail', 'fort', 'river', 'landmark', 'camp', 'post', 'valley'].includes(name) ? name : 'trail'; draw(); },
    spotAnimal(kind) { S.spotted = kind; draw(); setTimeout(() => emit('animalSpotted', { animal: kind }), 0); },
    celebrate(kind) { S.confetti = reducedMotion ? 0 : 20; void kind; kick(); },
    startHunt({ seed = 0, shots = 5 } = {}) {
      stopMini();
      S.mini = { kind: 'hunt', seed: Math.abs(Number(seed) || 0), shots, left: shots, hits: 0, meat: 0 };
      kick();
      miniTimer = setTimeout(huntShot, shotMs());
    },
    startFish({ seed = 0, casts = 4 } = {}) {
      stopMini();
      S.mini = { kind: 'fish', seed: Math.abs(Number(seed) || 0), shots: casts, left: casts, hits: 0, meat: 0 };
      kick();
      miniTimer = setTimeout(fishCast, shotMs());
    },
    endMiniGame() {
      const m = S.mini;
      const out = !m ? null : m.kind === 'hunt' ? { meatLb: m.meat, hits: m.hits, shots: m.shots - m.left } : { fishLb: m.meat, caught: m.hits, casts: m.shots - m.left };
      stopMini(); draw();
      return out;
    },
    setReducedMotion(on) { reducedMotion = !!on; draw(); },
    play() {
      S.playing = true;
      if (S.mini && !miniTimer) miniTimer = setTimeout(S.mini.kind === 'hunt' ? huntShot : fishCast, shotMs());
      kick();
    },
    pause() { S.playing = false; clearTimeout(miniTimer); miniTimer = 0; cancelAnimationFrame(raf); raf = 0; },
    destroy() { S.destroyed = true; stopMini(); cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); },
    resize,
    getState() {
      return { backdrop: S.backdrop, milesDone: S.travel.milesDone, weather: S.travel.weather, moving: !!S.travel.moving,
        biome: S.leg.biome, legId: S.leg.id, pace: S.travel.pace, view: S.backdrop, playing: S.playing, reducedMotion: !!reducedMotion,
        mini: S.mini ? { kind: S.mini.kind, left: S.mini.left, hits: S.mini.hits, [S.mini.kind === 'hunt' ? 'meatLb' : 'fishLb']: S.mini.meat, phase: 'play' } : null, mock: true };
    },
  };
  resize();
  requestAnimationFrame(() => emit('ready'));      // once, after the first frame (the scene plays at once)
  return scene;
}
