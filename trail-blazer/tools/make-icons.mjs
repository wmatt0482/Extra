// Renders the Trail Blazer icon (inline SVG: the sage-green Ranger on a dirt trail, over a blaze-orange sky with
// pine hills; flat colors) with Playwright/Chromium and writes icons/*.png, the same way as Spell Jump's
// car-jump/tools/make-icons.mjs (no node-canvas). Usage: node trail-blazer/tools/make-icons.mjs
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
const pine = (x, y, s) => `<path d="M${x} ${y} l${22 * s} -${70 * s} l${22 * s} ${70 * s} z" fill="#1f4d2e"/>`;
const wheel = (cx) => `
  <circle cx="${cx}" cy="350" r="46" fill="#15181a"/>
  ${Array.from({ length: 12 }, (_, i) => `<rect x="${cx - 7}" y="300" width="14" height="12" rx="2" fill="#15181a" transform="rotate(${i * 30} ${cx} 350)"/>`).join('')}
  <circle cx="${cx}" cy="350" r="30" fill="#3a4045"/><circle cx="${cx}" cy="350" r="16" fill="#c9d1d6"/><circle cx="${cx}" cy="350" r="5" fill="#3a4045"/>`;
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35c"/><stop offset=".7" stop-color="#ff8a1f"/><stop offset="1" stop-color="#e86f00"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="370" cy="150" r="70" fill="#ffd7a3"/>
  <path d="M0 300 L80 240 L150 280 L240 210 L330 270 L410 230 L512 280 L512 512 L0 512 Z" fill="#c75a00" opacity=".55"/>
  ${pine(30, 330, 1.1)}${pine(400, 320, 1.2)}${pine(450, 336, 0.9)}
  <path d="M0 360 C 140 330, 360 350, 512 336 L512 512 L0 512 Z" fill="#1f4d2e"/>
  <path d="M0 400 C 160 382, 360 404, 512 388 L512 512 L0 512 Z" fill="#8a5a32"/>
  <path d="M0 440 C 160 424, 360 444, 512 430 L512 512 L0 512 Z" fill="#5b3a1f"/>
  <g transform="translate(0 30)">
    <!-- roll cage -->
    <g stroke="#111416" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M190 246 L196 130 L318 130 L352 246"/><path d="M194 168 L332 168"/>
    </g>
    <!-- body -->
    <path d="M86 330 L86 260 L180 260 L192 282 L330 282 L392 268 L428 296 L428 330 Z" fill="#7c9a63" stroke="#1d1b26" stroke-width="6" stroke-linejoin="round"/>
    <rect x="86" y="244" width="100" height="16" rx="4" fill="#4f6a40" stroke="#1d1b26" stroke-width="5"/>
    <rect x="86" y="296" width="342" height="14" fill="#ff8a1f"/>
    <rect x="206" y="226" width="96" height="56" fill="none" stroke="#111416" stroke-width="7"/>
    <path d="M216 226 l8 56 M234 226 l8 56 M252 226 l8 56 M270 226 l8 56 M288 226 l8 56 M206 244 h96 M206 262 h96" stroke="#111416" stroke-width="3"/>
    <circle cx="250" cy="200" r="24" fill="#ffd23a" stroke="#1d1b26" stroke-width="5"/><path d="M252 192 h20 v14 h-20 z" fill="#1d1b26"/>
    <path d="M136 330 a 54 54 0 0 1 108 0 Z M284 330 a 54 54 0 0 1 108 0 Z" fill="#111416"/>
    ${wheel(166)}${wheel(338)}
  </g>
</svg>`;

const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size] of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#ff8a1f">${SVG.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('icons', name), `${size}x${size}`);
}
await browser.close();
