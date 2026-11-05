// A small seeded fishing session for dev.html, the scene smoke test and the mock scene, shaped like the Journey stream's
// `fishingSession(J, …)` (SPEC v1.4 §3.3: casts with species, junk, lengths, bites and fights) so the scene can run
// without the journey. The app passes the REAL session's `casts` to startFishing; this is only the fallback when
// `casts` is a number or missing. The fish table mirrors SPEC §2.2 (data copied, not imported: the scene stays
// self-contained).
import { mulberry32 } from './util.js';

const FISH = {
  'channel-catfish': { waters: { kansas: 1, platte: 1 }, in: [12, 24], lb: [3, 6], fight: { reelS: 2.6, pull: 0.10, every: [1.4, 2.2], wob: 0.7 }, help: false },
  'hornyhead-chub': { waters: { sweetwater: 1 }, in: [4, 8], lb: [2, 4], fight: { reelS: 1.4, pull: 0.08, every: [1.6, 2.4], wob: 0.6 }, help: false },
  'cutthroat-trout': { waters: { creek: 1, bear: 1, snake: 0.6 }, in: [8, 16], lb: [3, 5], fight: { reelS: 2.0, pull: 0.12, every: [1.0, 1.6], wob: 0.6 }, help: false },
  'white-sturgeon': { waters: { snake: 0.25, columbia: 0.05 }, in: [48, 84], lb: [12, 16], fight: { reelS: 6.0, pull: 0.06, every: [1.6, 2.4], wob: 0.8 }, help: true },
  'redband-trout': { waters: { blue: 1 }, in: [8, 16], lb: [3, 5], fight: { reelS: 2.0, pull: 0.12, every: [1.0, 1.6], wob: 0.6 }, help: false },
  'chinook-salmon': { waters: { columbia: 1 }, in: [24, 40], lb: [5, 8], fight: { reelS: 3.2, pull: 0.12, every: [1.2, 1.8], wob: 0.7 }, help: false },
  // v1.7 (`extra`: only drawn when forced with forceSpecies, so the older seeds of the smoke test keep their casts)
  'mountain-whitefish': { extra: true, waters: { bear: 0.7, snake: 0.7, columbia: 0.5 }, in: [10, 20], lb: [4, 5], fight: { reelS: 1.8, pull: 0.10, every: [1.2, 1.9], wob: 0.6 }, help: false },
  'northern-pikeminnow': { extra: true, waters: { columbia: 0.6 }, in: [10, 24], lb: [5, 6], fight: { reelS: 2.4, pull: 0.11, every: [1.3, 2.0], wob: 0.7 }, help: false },
  'largescale-sucker': { extra: true, waters: { columbia: 0.5 }, in: [12, 24], lb: [4, 5], fight: { reelS: 2.2, pull: 0.10, every: [1.5, 2.2], wob: 0.7 }, help: false },
  'green-sunfish': { extra: true, waters: { kansas: 0.3, platte: 0.25 }, in: [3, 8], lb: [3, 4], fight: { reelS: 1.2, pull: 0.08, every: [1.6, 2.4], wob: 0.6 }, help: false },
  'sacramento-perch': { extra: true, waters: { sacramento: 0.8 }, in: [6, 12], lb: [4, 5], fight: { reelS: 1.6, pull: 0.09, every: [1.4, 2.1], wob: 0.6 }, help: false },
};
export const WATER_IDS = ['kansas', 'platte', 'sweetwater', 'creek', 'bear', 'snake', 'blue', 'columbia', 'sacramento'];

export function devFight(species, rand, junk = false) {
  const F = FISH[species] || FISH['channel-catfish'];
  const f = junk ? { reelS: 1.6, pull: 0.08, every: [9, 9], wob: 0 } : F.fight;
  const wobbles = [];
  if (!junk) {
    let t = 900 + rand() * 600;
    while (t < 60000) { const len = f.wob * 1000; wobbles.push([Math.round(t), Math.round(t + len)]); t += len + (f.every[0] + rand() * (f.every[1] - f.every[0])) * 1000; }
  }
  return { reelMs: f.reelS * 1000, pullPerMs: f.pull / 1000, wobbles, strainMaxMs: 500, warnMs: 250, help: !junk && F.help, helpAt: 0.5 };
}

// session = { water, casts: [{ i, kind, species?, junk?, lengthIn?, lb?, biteS, fight, retries: 0 }], cameo }
export function devSession({ seed = 1, water = 'kansas', bait = 'worms', casts = 4, forceSpecies = null, junkAt = -1 } = {}) {
  const rand = mulberry32((seed ^ 0x51ed) >>> 0 || 1);
  const pool = Object.entries(FISH).filter(([, F]) => !F.extra).map(([id, F]) => [id, (F.waters[water] || 0) * (bait === 'spoon' && id === 'chinook-salmon' ? 1.3 : 1)]).filter(([, w]) => w > 0);
  const total = pool.reduce((a, [, w]) => a + w, 0);
  const list = [];
  let sturgeon = false;
  for (let i = 0; i < casts; i++) {
    let junk = i === junkAt ? 'boot' : null;
    let species = forceSpecies;
    if (!species && !junk) {
      let p = rand() * total, pick = pool[0][0];
      for (const [id, w] of pool) { if ((p -= w) < 0) { pick = id; break; } }
      species = pick;
      if (species === 'white-sturgeon') { if (sturgeon) species = pool.find(([id]) => id !== 'white-sturgeon')[0]; sturgeon = true; }
    }
    const F = species ? FISH[species] : null;
    const u = rand();
    list.push({
      i, kind: junk ? 'junk' : 'fish', species: junk ? undefined : species, junk: junk || undefined,
      lengthIn: F ? Math.round(F.in[0] + (F.in[1] - F.in[0]) * Math.min(1, u + (bait === 'spoon' ? 0.15 : 0))) : undefined,
      lb: F ? Math.round(F.lb[0] + (F.lb[1] - F.lb[0]) * u) : 0,
      biteS: (bait === 'hoppers' ? 1.0 : 1.3) + rand() * 2.2, fight: devFight(species, rand, !!junk), retries: 0,
    });
  }
  return { water, bait, casts: list, cameo: null };
}
