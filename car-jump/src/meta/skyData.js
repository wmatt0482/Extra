// The Sky Era's data (v4.0): sky tracks (src/data/skyTracks.js) and sky rides (src/data/skyRides.js) are written by the engine side and
// loaded here at boot with a dynamic import, so Era 1 never breaks when a file is missing, blocked or old in the cache: a missing file
// is simply an empty list (the Sky Era then stays closed: nothing is promised that is not there). Everything else in the app asks this
// registry (carById / trackById / allTracks / allCars) instead of the Earth-only CARS / TRACKS, so a ride or track id from the sky is
// known to the save, the economy, the garage, the track screen and the results.
// Tests and screenshots can seed it by hand (setSkyData) or load the stand-in files in tools/fixtures/sky/ (loadSkyData({ fixtures: true })).
import { CARS, CAR_BY_ID } from '../data/cars.js';
import { TRACKS, TRACK_BY_ID } from '../data/tracks.js';

const reg = { tracks: [], rides: [], trackById: {}, rideById: {}, source: 'none' };

/** Replace what the Sky Era has: { tracks: [...], rides: [...] } (the same shapes as TRACKS / CARS plus era: 'sky'). Bad entries are dropped. */
export function setSkyData({ tracks = [], rides = [], source = 'manual' } = {}) {
  const okTrack = (t) => t && typeof t.id === 'string' && !TRACK_BY_ID[t.id] && t.theme && typeof t.finish === 'number';
  const okRide = (c) => c && typeof c.id === 'string' && !CAR_BY_ID[c.id] && Array.isArray(c.body) && Array.isArray(c.wheels) && c.base;
  reg.tracks = (Array.isArray(tracks) ? tracks : []).filter(okTrack);
  reg.rides = (Array.isArray(rides) ? rides : []).filter(okRide);
  reg.trackById = Object.fromEntries(reg.tracks.map((t) => [t.id, t]));
  reg.rideById = Object.fromEntries(reg.rides.map((c) => [c.id, c]));
  reg.source = source;
}
export const skyTracks = () => reg.tracks;
export const skyRides = () => reg.rides;
export const skySource = () => reg.source;
/** The Sky Era has something to open: at least one track (rides alone are not an era). */
export const skyAvailable = () => reg.tracks.length > 0;

export const carById = (id) => CAR_BY_ID[id] || reg.rideById[id] || null;
export const trackById = (id) => TRACK_BY_ID[id] || reg.trackById[id] || null;
export const isSkyTrack = (id) => !!reg.trackById[id];
export const isSkyRide = (id) => !!reg.rideById[id];
/** Earth tracks first, then the sky's, each in its own order (the unlock chains are separate). */
export const allTracks = () => (reg.tracks.length ? [...TRACKS, ...reg.tracks] : TRACKS);
export const allCars = () => (reg.rides.length ? [...CARS, ...reg.rides] : CARS);
/** The first sky track has no unlockedBy: it is open as soon as the era is. */
export const skyFirstTrackIds = () => reg.tracks.filter((t) => !t.unlockedBy).map((t) => t.id);

// the three rides' names when the data is not there (the ceremony's silhouettes still get names): Hover Bike / Rocket Car / Mech Walker
export const FALLBACK_RIDES = [
  { id: 'hover', name: 'Hover Bike', color: '#22d3ff' },
  { id: 'rocket-car', name: 'Rocket Car', color: '#ff7a3d' },
  { id: 'mech', name: 'Mech Walker', color: '#ffcf1a' },
];
/** [{ name, color }] x3 for the ceremony: from the rides when there are three or more, else the fallback names. */
export function ceremonyRides() {
  const r = reg.rides.slice(0, 3);
  return FALLBACK_RIDES.map((f, i) => (r[i] ? { name: String(r[i].name || f.name), color: r[i].color || f.color } : { name: f.name, color: f.color }));
}

/**
 * Load the data files. Each is a dynamic import that may fail on its own; with { fixtures: true } (?mock=1&skyfixture=1 only) the stand-ins in
 * tools/fixtures/sky/ replace whatever the real files gave. Resolves to what the registry holds now.
 */
export async function loadSkyData({ fixtures = false } = {}) {
  let tracks = [], rides = [], source = 'none';
  if (fixtures) {
    try {
      // the path is built at run time on purpose: test-only files must never look like a dependency to the offline-list scanners
      // (build-crew/tools/prepare-offline.mjs and friends), because tools/ is not deployed and a missing precache file breaks install
      const dir = ['..', '..', 'tools', 'fixtures', 'sky', ''].join('/');
      const [t, r] = await Promise.all([import(dir + 'skyTracks.js'), import(dir + 'skyRides.js')]);
      tracks = t.SKY_TRACKS || []; rides = r.SKY_RIDES || []; source = 'fixture';
    } catch (e) { console.warn('[sky] fixtures unavailable', e && e.message ? e.message : e); }
  } else {
    try { const m = await import('../data/skyTracks.js'); tracks = m.SKY_TRACKS || []; source = 'data'; } catch (_) { /* not built yet: Era 1 only */ }
    try { const m = await import('../data/skyRides.js'); rides = m.SKY_RIDES || []; source = 'data'; } catch (_) { /* ditto */ }
  }
  setSkyData({ tracks, rides, source });
  return { tracks: reg.tracks, rides: reg.rides, source };
}
