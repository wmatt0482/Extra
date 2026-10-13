// Renders the Ramp Rage icon (inline SVG: a bold car mid-jump over a ramp, flat colors) with
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

// 512×512 artboard. Everything important stays inside the central ~80% so the 512 icon also
// works as a maskable (Android) icon; iOS rounds the corners itself.
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><clipPath id="sun"><circle cx="340" cy="250" r="128"/></clipPath></defs>
  <rect width="512" height="512" fill="#2a1d78"/>
  <g clip-path="url(#sun)">
    <rect x="200" y="100" width="300" height="300" fill="#ffb13d"/>
    <rect x="200" y="100" width="300" height="110" fill="#ffcf1a"/>
    <rect x="200" y="268" width="300" height="12" fill="#ff4f6d"/>
    <rect x="200" y="298" width="300" height="18" fill="#ff4f6d"/>
    <rect x="200" y="334" width="300" height="26" fill="#ff4f6d"/>
  </g>
  <path d="M0 372 L90 330 L170 356 L260 318 L350 350 L440 322 L512 340 L512 512 L0 512 Z" fill="#7b2a8c"/>
  <!-- ramp: quarter pipe ending in a lip -->
  <path d="M-10 150 C 60 150 120 300 196 392 L 222 378 L 222 512 L -10 512 Z" fill="#0d1230"/>
  <path d="M-10 150 C 60 150 120 300 196 392 L 222 378" fill="none" stroke="#ffcf1a" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- landing ground -->
  <path d="M250 512 L250 452 C 330 432 420 440 512 424 L512 512 Z" fill="#0d1230"/>
  <!-- speed lines -->
  <g stroke="#ffffff" stroke-width="14" stroke-linecap="round">
    <line x1="176" y1="236" x2="112" y2="262"/>
    <line x1="196" y1="282" x2="146" y2="302"/>
    <line x1="222" y1="324" x2="186" y2="338"/>
  </g>
  <!-- car, nose-up mid-jump -->
  <g transform="translate(318 236) rotate(-20) scale(1.08)">
    <path d="M-100 16 L-150 26 L-100 32 Z" fill="#22d3ff"/>
    <path d="M-114 32 L114 32 L118 2 L72 -8 L42 -54 L-52 -56 L-94 -22 L-116 -10 Z" fill="#0d1230"/>
    <path d="M-104 23 L105 23 L107 6 L65 -1 L37 -45 L-47 -47 L-86 -17 L-105 -5 Z" fill="#ff3b5c"/>
    <path d="M28 -6 L14 -37 L-40 -39 L-66 -8 Z" fill="#9fe3ff"/>
    <rect x="-5" y="-40" width="8" height="34" fill="#ff3b5c"/>
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
