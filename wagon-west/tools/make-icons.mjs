// Renders the Wagon West icon (inline SVG: a covered wagon with a canvas top and two big spoked wheels rolling on a
// prairie trail under a low sunset sun, warm palette: walnut, prairie gold, rust, parchment; flat colours) with
// Playwright/Chromium and writes icons/*.png, the same way as Fraction Fright's tools/make-icons.mjs (no node-canvas).
// Usage: node wagon-west/tools/make-icons.mjs
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

// a spoked wheel at (cx, cy)
const wheel = (cx, cy, r) => {
  const spokes = Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `M${cx} ${cy} L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3a2416" stroke-width="13"/><path d="${spokes}" stroke="#3a2416" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="11" fill="#3a2416"/>`;
};
// 512×512 artboard; everything important inside the central ~80 % so the 512 icon also works as a maskable icon
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a4a"/><stop offset=".45" stop-color="#b8584a"/><stop offset=".72" stop-color="#f2b36a"/><stop offset="1" stop-color="#f2b36a"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="256" cy="330" r="128" fill="#ffd08a"/>
  <path d="M0 360 L90 320 L170 345 L260 300 L350 340 L430 310 L512 335 V512 H0Z" fill="#8a5a33" opacity=".75"/>
  <rect x="0" y="392" width="512" height="120" fill="#5a3b1e"/>
  <path d="M0 430 Q256 405 512 430" stroke="#c8a46a" stroke-width="10" fill="none" opacity=".7"/>
  <!-- the wagon -->
  <g>
    <path d="M118 300 Q 118 150 256 140 Q 394 150 394 300 Z" fill="#fbf1dc" stroke="#3a2416" stroke-width="12" stroke-linejoin="round"/>
    <path d="M190 300 Q 192 172 226 146 M322 300 Q 320 172 286 146" stroke="#d9c4a0" stroke-width="10" fill="none"/>
    <rect x="102" y="294" width="308" height="56" rx="10" fill="#d9653b" stroke="#3a2416" stroke-width="12"/>
    <path d="M118 322 H394" stroke="#8a3a17" stroke-width="6"/>
    ${wheel(164, 372, 50)}
    ${wheel(348, 372, 50)}
  </g>
</svg>`;

const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#1f150d">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
