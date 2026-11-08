// What a job pays in Lab coins and Lab XP, for the job board's cards, the job's first moments and the finished sheet. The
// numbers are the Build Crew rows of the Lab's exchange table (lab/src/data/events.js: `job`, `piece`, `blueprint`,
// `challenge`). The game never imports the Lab (it must run with /lab/ missing), so they are copied here, and
// tools/physics-tests.mjs compares every one with the Lab's own table so the cards can never promise a stale amount.
// No imports of the DOM or the renderer: this module loads in Node.
import { TOYS } from './content.mjs';

/** The Build Crew rows of the Lab's exchange table, as { coins, xp } (and `replay`, the share a repeated job pays). */
export const LAB_PAY = {
  job: { coins: 40, xp: 55, replay: 0.25 },
  piece: { coins: 4, xp: 3 },
  challenge: { coins: 40, xp: 45 },
  blueprint: { coins: 30, xp: 30 },
};

/** How many pieces the Lab counts for a job (what the finished job reports as `n`): one per outline, or one per toy. */
export const pieceCount = (round) => Math.max(1, round.ghosts?.length ?? round.toys?.length ?? 1);

/** { coins, xp } for finishing `round`: the job itself (a replay pays a quarter of that part), a little for each piece it
 *  counted, and a blueprint's own bonus. The "neat build" challenge pays extra and is not in this number: it is a bonus
 *  the child can only know about after the fact. */
export function jobPayout(round, { replay = false } = {}) {
  const n = pieceCount(round);
  let coins = LAB_PAY.job.coins,
    xp = LAB_PAY.job.xp;
  if (replay) {
    coins = Math.round(coins * LAB_PAY.job.replay);
    xp = Math.round(xp * LAB_PAY.job.replay);
  }
  coins += LAB_PAY.piece.coins * n;
  xp += LAB_PAY.piece.xp * n;
  if (round.blueprint) {
    coins += LAB_PAY.blueprint.coins;
    xp += LAB_PAY.blueprint.xp;
  }
  return { coins, xp };
}

/** "52 coins · 64 XP" (the short form on a card). */
export const payoutText = (p) => `${p.coins} coins · ${p.xp} XP`;

/** "Pays 52 Lab coins and 64 XP." */
export const payoutLine = (p) => `Pays ${p.coins} Lab coins and ${p.xp} XP.`;

/** What the blueprint measures, in metres, from its outlines: how tall it stands, and how long it runs along its longer
 *  side. Returns null for a job with no outlines (a delivery has no shape to measure). */
export function measure(round) {
  if (!round.ghosts?.length) return null;
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity,
    top = 0,
    base = Infinity;
  for (const g of round.ghosts) {
    const [w, h, d] = TOYS[g.type].size;
    x0 = Math.min(x0, g.x - w / 2);
    x1 = Math.max(x1, g.x + w / 2);
    z0 = Math.min(z0, g.z - d / 2);
    z1 = Math.max(z1, g.z + d / 2);
    top = Math.max(top, g.y + h / 2);
    base = Math.min(base, g.y - h / 2);
  }
  return { tall: +(top - Math.max(0, base)).toFixed(1), long: +Math.max(x1 - x0, z1 - z0).toFixed(1) };
}

/** The blueprint card's line, with the numbers a builder can steer by: "Windmill: 3.9 m tall", or for a low, wide build
 *  "Foundation grid: 6.2 m long, 1.2 m tall". ("" for a delivery job.) */
export function measureLine(round) {
  const m = measure(round);
  if (!m) return '';
  const name = round.title;
  return m.long > m.tall * 1.3 ? `${name}: ${m.long} m long, ${m.tall} m tall` : `${name}: ${m.tall} m tall`;
}
