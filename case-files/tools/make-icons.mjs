// Renders the Case Files icon (inline SVG: a brass magnifying glass over a manila folder and a red pin, on a navy dusk) with
// Playwright/Chromium and writes icons/*.png, the same way as Fraction Fright's tools/make-icons.mjs (no node-canvas).
// Usage: node case-files/tools/make-icons.mjs
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
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060e22"/><stop offset=".6" stop-color="#12306a"/><stop offset="1" stop-color="#1f4476"/></linearGradient>
    <linearGradient id="man" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dfae"/><stop offset="1" stop-color="#dcc084"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <g fill="#f4efe2" opacity=".85"><circle cx="86" cy="84" r="3"/><circle cx="150" cy="52" r="2.4"/><circle cx="420" cy="70" r="3"/><circle cx="460" cy="130" r="2.2"/><circle cx="60" cy="150" r="2"/></g>
  <circle cx="404" cy="104" r="34" fill="#f2e8c4"/><circle cx="416" cy="96" r="30" fill="#12306a" opacity=".6"/>
  <!-- the folder -->
  <g transform="translate(256 292) rotate(-4)">
    <path d="M-150 -92 h92 l22 -28 h126 a14 14 0 0 1 14 14 v28 z" fill="#c9ad6c" stroke="#a98d4c" stroke-width="6" stroke-linejoin="round"/>
    <rect x="-150" y="-96" width="300" height="196" rx="14" fill="url(#man)" stroke="#a98d4c" stroke-width="6"/>
    <rect x="-118" y="-58" width="150" height="14" rx="5" fill="#a98d4c" opacity=".55"/>
    <rect x="-118" y="-30" width="196" height="12" rx="5" fill="#a98d4c" opacity=".4"/>
    <rect x="-118" y="-6" width="120" height="12" rx="5" fill="#a98d4c" opacity=".4"/>
    <!-- red string -->
    <path d="M-96 -20 Q -40 40 30 6 T 96 52" fill="none" stroke="#e0463f" stroke-width="7" stroke-linecap="round"/>
    <circle cx="-96" cy="-20" r="13" fill="#e0463f" stroke="#8f1f1a" stroke-width="4"/><circle cx="96" cy="52" r="13" fill="#e0463f" stroke="#8f1f1a" stroke-width="4"/>
  </g>
  <!-- the magnifier -->
  <g transform="translate(300 240) rotate(18)">
    <circle cx="0" cy="0" r="86" fill="#a8d8ff" opacity=".28"/>
    <circle cx="0" cy="0" r="86" fill="none" stroke="#dcab4a" stroke-width="22"/>
    <circle cx="0" cy="0" r="97" fill="none" stroke="#8a6418" stroke-width="3" opacity=".7"/>
    <path d="M-52 -34 A64 64 0 0 1 8 -62" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".7"/>
    <rect x="-17" y="96" width="34" height="112" rx="15" fill="#2a3a58" stroke="#0a1630" stroke-width="5"/>
    <rect x="-22" y="92" width="44" height="22" rx="8" fill="#dcab4a"/>
  </g>
</svg>`;

const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a1630">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
