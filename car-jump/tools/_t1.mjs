import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
{
  const src = fs.readFileSync(path.join(ROOT, 'vendor/matter.min.js'), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'window', src)(mod, mod.exports, globalThis);
  globalThis.Matter = mod.exports.Matter || mod.exports;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
}
const noop = () => {};
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (t[k] = typeof k === 'string' && /^(create|measure)/.test(k) ? () => ({ addColorStop: noop, width: 0 }) : noop)), set: () => true });
const canvas = { getContext: () => ctx2d, style: {}, width: 1, height: 1, parentElement: null, getBoundingClientRect: () => ({ width: 844, height: 390 }) };
const { createGame } = await import('../src/game/engine.js');
const { CAR_BY_ID } = await import('../src/data/cars.js');
const { SKY_RIDE_BY_ID } = await import('../src/data/skyRides.js');
const { SKY_TRACK_BY_ID } = await import('../src/data/skyTracks.js');
const { TRACK_BY_ID } = await import('../src/data/tracks.js');
const { resolveStats } = await import('../src/data/upgrades.js');

const [carId = 'tank', trackId = 'sky-1', lvl = '10', boostP = '1', word = 'friend'] = process.argv.slice(2);
const car = CAR_BY_ID[carId] || SKY_RIDE_BY_ID[carId];
const track = SKY_TRACK_BY_ID[trackId] || TRACK_BY_ID[trackId];
const L = Number(lvl);
const stats = resolveStats(car, { engine: L, nitro: L, suspension: L, bonus: L });
const events = [];
let summary = null;
const game = createGame(canvas, { onEvent: (e) => { events.push(e); if (e.type === 'finish') summary = e.summary; } });
game.start({ car, stats, track, seed: 42, letters: [...'word'], spellBoost: boostP !== 'off' });
let boosted = false;
for (let n = 0; !summary && n < 60 * 200; n++) {
  const s = game.getState(), info = game.debugInfo();
  if (s.frozen) {
    if (!boosted && boostP !== 'off' && boostP !== 'none') { boosted = true; console.log('FROZEN at gate', JSON.stringify(info && { x: info.x, y: info.y }), 'stepping frozen'); const a = game.getState().distance; game.debugStep(30); console.log('  frozen moved?', game.getState().distance - a); game.boost({ power: Number(boostP), word }); game.freeze(false); }
    else if (!boosted) { boosted = true; game.freeze(false); }
  }
  const inp = { gas: s.phase !== 'air', brake: false, nitro: s.phase === 'ground' || (s.phase === 'air' && s.altitude < 40 && info.vy < 0 && car.glide > 0) || (s.phase === 'air' && n % 600 > 300 && !car.glide) };
  game.setInput(inp);
  game.debugStep(1);
  if (n % 600 === 0) console.log(n / 60 | 0, 's', s.phase, 'x', Math.round(info.x), 'y', Math.round(info.y), 'v', s.speedKmh, 'nitro', s.nitro.toFixed(2));
}
const counts = {};
for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
console.log(JSON.stringify(counts));
console.log(JSON.stringify(summary));
