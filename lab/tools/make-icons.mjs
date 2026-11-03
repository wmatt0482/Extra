// Renders the Lab icon (inline SVG: a lab flask with bubbling teal liquid, a gold coin and a spark on the house navy) with Playwright/Chromium and
// writes icons/*.png, the same way as the games' tools/make-icons.mjs (no node-canvas). Usage: node lab/tools/make-icons.mjs
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

// 512 x 512 artboard; everything important sits in the central ~80 % so the 512 icon also works as a maskable icon
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26348f"/><stop offset=".55" stop-color="#0d1230"/><stop offset="1" stop-color="#0e4a52"/></linearGradient>
    <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7bf0d6"/><stop offset="1" stop-color="#1fbfa4"/></linearGradient>
    <clipPath id="flask"><path d="M206 120h100v110l74 120c14 24-3 54-31 54H163c-28 0-45-30-31-54l74-120z"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g stroke="rgba(160,190,255,.12)" stroke-width="2">${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 48} 0V512M0 ${i * 48}H512"/>`).join('')}</g>
  <path d="M206 120h100v110l74 120c14 24-3 54-31 54H163c-28 0-45-30-31-54l74-120z" fill="rgba(255,255,255,.1)"/>
  <g clip-path="url(#flask)">
    <rect x="100" y="290" width="320" height="200" fill="url(#liq)"/>
    <path d="M100 290q40-16 80 0t80 0 80 0 80 0v-14H100z" fill="#aef7e6"/>
    <circle cx="214" cy="350" r="14" fill="#e6fff8" opacity=".85"/><circle cx="270" cy="324" r="9" fill="#e6fff8" opacity=".8"/><circle cx="300" cy="380" r="18" fill="#e6fff8" opacity=".75"/>
  </g>
  <path d="M206 120h100v110l74 120c14 24-3 54-31 54H163c-28 0-45-30-31-54l74-120z" fill="none" stroke="#f4f6ff" stroke-width="14" stroke-linejoin="round"/>
  <rect x="190" y="100" width="132" height="34" rx="12" fill="#f4f6ff"/>
  <path d="M232 166h48" stroke="#f4f6ff" stroke-width="10" stroke-linecap="round" opacity=".7"/>
  <g transform="translate(372 126)">
    <circle cx="0" cy="8" r="52" fill="#b98200"/><circle cx="0" cy="0" r="52" fill="#ffcf1a"/><circle cx="0" cy="0" r="36" fill="none" stroke="#e7a800" stroke-width="8"/>
    <path d="M0-24v48M12-14c-4-5-9-7-14-7-9 0-14 4-14 10 0 14 28 7 28 21 0 6-6 10-14 10-6 0-12-3-14-7" stroke="#8a5d00" stroke-width="9" fill="none" stroke-linecap="round"/>
  </g>
  <path d="M120 150l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="#fff7b0"/>
  <path d="M150 90l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="#7bf0d6"/>
</svg>`;

const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0d1230">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
