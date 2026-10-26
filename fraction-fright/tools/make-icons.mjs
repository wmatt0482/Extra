// Renders the Fraction Fright icon (inline SVG: a lanky green zombie in a beanie over the number-line road, 0 · ½ · 1,
// with a slime splat right on ½; a rust-orange dusk; flat colors) with Playwright/Chromium and writes icons/*.png, the same way
// as Trail Blazer's tools/make-icons.mjs (no node-canvas). Usage: node fraction-fright/tools/make-icons.mjs
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

// 512×512 artboard; everything important inside the central ~80 % so the 512 icon also works as a maskable icon
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0b14"/><stop offset=".6" stop-color="#3a2430"/><stop offset="1" stop-color="#b8501a"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="398" cy="120" r="50" fill="#d9d8b0"/>
  <!-- the zombie -->
  <g transform="translate(256 236)">
    <rect x="-70" y="40" width="140" height="120" rx="26" fill="#2a2830"/>
    <rect x="-128" y="62" width="70" height="30" rx="14" fill="#7f9a6a"/><rect x="58" y="62" width="70" height="30" rx="14" fill="#7f9a6a"/>
    <circle cx="0" cy="-10" r="86" fill="#7f9a6a"/>
    <circle cx="-32" cy="-18" r="17" fill="#e8e2c8"/><circle cx="34" cy="-14" r="21" fill="#e8e2c8"/>
    <circle cx="-30" cy="-15" r="7" fill="#0e0d10"/><circle cx="38" cy="-10" r="8" fill="#0e0d10"/>
    <path d="M-56 -40 L-10 -30 M14 -36 L58 -46" stroke="#1d241a" stroke-width="12" stroke-linecap="round"/>
    <path d="M-40 34 L-20 28 L0 36 L20 26 L42 32" stroke="#0e0d10" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M-30 24 v12 M-8 26 v14 M12 24 v12 M32 22 v12" stroke="#0e0d10" stroke-width="4"/>
    <path d="M44 -66 l18 10 M48 -56 l14 -14" stroke="#4a5a3a" stroke-width="5"/>
    <path d="M-70 -54 Q -66 -112 0 -112 Q 66 -112 70 -54 Z" fill="#3a2a22"/><rect x="-74" y="-60" width="148" height="16" fill="#2a1d18"/>
  </g>
  <!-- the road: the number line -->
  <rect x="0" y="376" width="512" height="136" fill="#16151a"/>
  <rect x="40" y="380" width="432" height="44" rx="12" fill="#2c2b31"/>
  <line x1="66" y1="402" x2="446" y2="402" stroke="#fff3d6" stroke-width="8"/>
  <line x1="66" y1="384" x2="66" y2="420" stroke="#fff3d6" stroke-width="8"/><line x1="446" y1="384" x2="446" y2="420" stroke="#fff3d6" stroke-width="8"/>
  <ellipse cx="256" cy="404" rx="62" ry="22" fill="#a6ff2e"/><circle cx="200" cy="384" r="9" fill="#a6ff2e"/><circle cx="318" cy="388" r="7" fill="#a6ff2e"/>
  <line x1="256" y1="380" x2="256" y2="424" stroke="#fff3d6" stroke-width="8"/>
  <text x="66" y="474" font-family="Impact, Arial Black, sans-serif" font-weight="900" fill-opacity="1" font-size="44" fill="#fff" text-anchor="middle">0</text>
  <text x="256" y="474" font-family="Impact, Arial Black, sans-serif" font-weight="900" fill-opacity="1" font-size="44" fill="#fff" text-anchor="middle">½</text>
  <text x="446" y="474" font-family="Impact, Arial Black, sans-serif" font-weight="900" fill-opacity="1" font-size="44" fill="#fff" text-anchor="middle">1</text>
</svg>`;

const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0e0d10">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
