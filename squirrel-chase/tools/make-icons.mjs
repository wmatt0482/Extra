// Renders the Pip's Squirrel Chase icon (inline SVG: a cheeky squirrel running off with a sign letter on a sunny sky, a dashed road trip line below) with
// Playwright/Chromium and writes icons/*.png, the same way as Case Files' tools/make-icons.mjs (no node-canvas).
// Usage: node squirrel-chase/tools/make-icons.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch (_) {
    const g = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href);
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'icons');
mkdirSync(out, { recursive: true });

// 512x512 artboard; everything important inside the central ~80 % so the 512 icon also works as a maskable icon
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cb8ea"/><stop offset=".62" stop-color="#bfe6f7"/><stop offset="1" stop-color="#ffd993"/></linearGradient>
    <linearGradient id="fur" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f08a2e"/><stop offset="1" stop-color="#c9601a"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="420" cy="96" r="44" fill="#fff0a8"/><circle cx="420" cy="96" r="62" fill="#fff0a8" opacity=".35"/>
  <ellipse cx="110" cy="92" rx="62" ry="20" fill="#fff" opacity=".85"/><ellipse cx="170" cy="76" rx="44" ry="16" fill="#fff" opacity=".85"/>
  <path d="M0 400 Q130 340 260 392 T512 372 V512 H0z" fill="#5aa05f"/><path d="M0 438 Q150 396 300 436 T512 420 V512 H0z" fill="#3e8248"/>
  <path d="M40 478 H472" stroke="#fff4c8" stroke-width="10" stroke-dasharray="34 24" stroke-linecap="round" opacity=".9"/>
  <!-- the sign, one letter short -->
  <g transform="translate(256 120)"><rect x="-176" y="-44" width="352" height="88" rx="16" fill="#2b6f4e" stroke="#fff3c4" stroke-width="8"/>
    <g font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="56" fill="#fff" text-anchor="middle"><text x="-120" y="20">S</text><text x="-64" y="20">Q</text><text x="-8" y="20">U</text><text x="48" y="20">I</text><text x="104" y="20">R</text></g>
    <rect x="132" y="-28" width="30" height="56" rx="6" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="9 7" opacity=".7"/></g>
  <!-- the squirrel -->
  <g transform="translate(250 330)">
    <path d="M70 60 C170 40 190 -80 110 -150 C70 -186 20 -150 40 -108 C60 -70 100 -70 98 -20 C96 20 40 20 40 20z" fill="url(#fur)" stroke="#8a420d" stroke-width="7" stroke-linejoin="round"/>
    <path d="M118 -118 C140 -88 142 -48 108 -30" fill="none" stroke="#ffc07a" stroke-width="10" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="-10" cy="30" rx="78" ry="72" fill="url(#fur)" stroke="#8a420d" stroke-width="7"/>
    <ellipse cx="-14" cy="52" rx="44" ry="44" fill="#ffe3b8"/>
    <circle cx="-60" cy="-48" r="58" fill="url(#fur)" stroke="#8a420d" stroke-width="7"/>
    <path d="M-100 -92 L-112 -140 L-70 -108z" fill="#d9731f" stroke="#8a420d" stroke-width="6" stroke-linejoin="round"/><path d="M-34 -104 L-18 -150 L-6 -96z" fill="#d9731f" stroke="#8a420d" stroke-width="6" stroke-linejoin="round"/>
    <ellipse cx="-82" cy="-34" rx="26" ry="20" fill="#ffe3b8"/>
    <circle cx="-78" cy="-62" r="11" fill="#2a1a0a"/><circle cx="-74" cy="-66" r="4" fill="#fff"/><circle cx="-34" cy="-62" r="11" fill="#2a1a0a"/><circle cx="-30" cy="-66" r="4" fill="#fff"/>
    <ellipse cx="-92" cy="-34" rx="9" ry="7" fill="#3a1d08"/>
    <path d="M-80 -20 Q-66 -8 -50 -20" fill="none" stroke="#6a2f0a" stroke-width="5" stroke-linecap="round"/>
    <!-- the swiped letter -->
    <g transform="translate(-118 36) rotate(-12)"><rect x="-30" y="-34" width="60" height="68" rx="9" fill="#ffd34d" stroke="#fff" stroke-width="6"/><text x="0" y="22" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="54" fill="#3a2200" text-anchor="middle">R</text></g>
  </g>
</svg>`;

const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#5cb8ea">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
