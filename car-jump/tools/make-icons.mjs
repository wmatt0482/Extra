// Renders the Spell Jump icon (inline SVG: a car mid-jump over letter tiles, flat colors) with
// Playwright/Chromium and writes icons/*.png. Usage: node tools/make-icons.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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

// 512×512 artboard: a car jumping over a row of letter tiles (Spell Jump). Everything important stays inside
// the central ~80% so the 512 icon also works as a maskable (Android) icon; iOS rounds the corners itself.
const tile = (x, y, ch, rot) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="-40" y="-36" width="80" height="84" rx="14" fill="#8d97cf"/>
    <rect x="-40" y="-44" width="80" height="84" rx="14" fill="#f4f6ff"/>
    <text x="0" y="22" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" fill="#0d1230">${ch}</text>
  </g>`;
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><clipPath id="sun"><circle cx="372" cy="178" r="104"/></clipPath>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d78"/><stop offset=".62" stop-color="#7b2a8c"/><stop offset="1" stop-color="#ff4f6d"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <g clip-path="url(#sun)">
    <rect x="260" y="60" width="240" height="240" fill="#ffb13d"/>
    <rect x="260" y="60" width="240" height="90" fill="#ffcf1a"/>
    <rect x="260" y="196" width="240" height="10" fill="#ff4f6d"/>
    <rect x="260" y="220" width="240" height="16" fill="#ff4f6d"/>
    <rect x="260" y="250" width="240" height="22" fill="#ff4f6d"/>
  </g>
  <path d="M0 420 L512 420 L512 512 L0 512 Z" fill="#0d1230"/>
  <!-- the jump arc -->
  <path d="M62 360 C 130 150, 300 110, 430 250" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-dasharray="4 26" opacity=".85"/>
  ${tile(150, 378, 'A', -6)}${tile(256, 372, 'B', 3)}${tile(362, 380, 'C', -3)}
  <!-- car mid-jump over the tiles -->
  <g transform="translate(262 176) rotate(-12) scale(.95)">
    <path d="M-100 16 L-150 26 L-100 32 Z" fill="#22d3ff"/>
    <path d="M-114 32 L114 32 L118 2 L72 -8 L42 -54 L-52 -56 L-94 -22 L-116 -10 Z" fill="#0d1230"/>
    <path d="M-104 23 L105 23 L107 6 L65 -1 L37 -45 L-47 -47 L-86 -17 L-105 -5 Z" fill="#2fd36b"/>
    <path d="M28 -6 L14 -37 L-40 -39 L-66 -8 Z" fill="#9fe3ff"/>
    <rect x="-5" y="-40" width="8" height="34" fill="#2fd36b"/>
    <rect x="-104" y="2" width="210" height="9" fill="#ffcf1a"/>
    <circle cx="-66" cy="34" r="28" fill="#0d1230"/><circle cx="-66" cy="34" r="12" fill="#ffcf1a"/>
    <circle cx="68" cy="34" r="28" fill="#0d1230"/><circle cx="68" cy="34" r="12" fill="#ffcf1a"/>
  </g>
</svg>`;

const SIZES = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon.png', 64],
];

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#2a1d78">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
