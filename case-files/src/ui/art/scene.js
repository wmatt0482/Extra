// The living detective-office backdrop behind every screen: a big office window onto an Erie-canal town at dusk, a desk lamp
// on the sill, lit windows, a packet boat on the canal, rain on the glass, drifting dust in the lamplight. Every layer is its own
// SVG or div, animated with CSS transform and opacity only (no canvas loop, nothing repaints), so the GPU just moves a few
// cached layers. The mood (home / case / archive / closed) comes from <html data-screen="..."> and is pure CSS (style/scene.css);
// reduced motion (the Parent Zone switch or the OS setting) stops every animation and hides the rain.
// drawBackdrop(svg) is called once by main.js with #backdrop-svg; the static layers are already in index.html.

// a small seeded generator, so the town is the same every launch
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const WATER_Y = 770;

/** Hazy far skyline: blocks, a church spire, tiny lit windows. */
function farCity() {
  const r = rng(11);
  let s = '', x = -40;
  const lights = [];
  while (x < 1700) {
    const w = 60 + r() * 90, h = 150 + r() * 250;
    const y = WATER_Y - h;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h + 4}" fill="#1c2e5c"/>`;
    if (r() < 0.45) s += `<path d="M${x} ${y}l${w / 2} -${14 + r() * 22}l${w / 2} ${14}z" fill="#1c2e5c"/>`;
    for (let wy = y + 16; wy < WATER_Y - 14; wy += 24) for (let wx = x + 8; wx < x + w - 12; wx += 18) if (r() < 0.2) lights.push(`<rect x="${wx.toFixed(1)}" y="${wy}" width="7" height="10" rx="1.5" fill="#f4cf72"/>`);
    x += w - 4;
  }
  // a church spire and a clock tower
  s += `<g fill="#1a2a56"><rect x="470" y="${WATER_Y - 470}" width="46" height="480"/><path d="M462 ${WATER_Y - 470}l31 -110l31 110z"/><rect x="489" y="${WATER_Y - 600}" width="8" height="26"/></g>`;
  s += `<g fill="#1a2a56"><rect x="1160" y="${WATER_Y - 390}" width="70" height="400"/><path d="M1152 ${WATER_Y - 390}h86l-43 -52z"/></g><circle cx="1195" cy="${WATER_Y - 340}" r="17" fill="#f4e2a4" opacity=".92"/><path d="M1195 ${WATER_Y - 351}v11h8" stroke="#1a2a56" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return { solid: s, lights: lights.join('') };
}

/** Nearer canal-side warehouses with stepped Dutch gables, chimneys and big warm windows, and gas lamps on the towpath. */
function nearCity() {
  const r = rng(29);
  let s = '', x = -20;
  const lights = [], glow = [];
  while (x < 1640) {
    const w = 96 + r() * 80, h = 110 + r() * 150;
    const y = WATER_Y - h;
    const gable = r();
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h + 6}" fill="#0c1a3a"/>`;
    if (gable < 0.55) {
      // stepped gable
      const steps = 3, sw = w / (steps * 2 + 1);
      for (let i = 0; i < steps; i++) s += `<rect x="${x + sw * (i + 0.5)}" y="${y - 14 * (i + 1)}" width="${w - sw * (i + 0.5) * 2}" height="15" fill="#0c1a3a"/>`;
    } else if (gable < 0.8) s += `<path d="M${x - 4} ${y}L${x + w / 2} ${y - 46}L${x + w + 4} ${y}z" fill="#0a1634"/>`;
    if (r() < 0.45) s += `<rect x="${x + w * 0.7}" y="${y - 36}" width="12" height="38" fill="#0a1634"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="5" fill="#16305c"/>`;
    for (let wy = y + 22; wy < WATER_Y - 20; wy += 38) for (let wx = x + 14; wx < x + w - 24; wx += 30) {
      const lit = r() < 0.34;
      s += `<rect x="${wx.toFixed(1)}" y="${wy}" width="17" height="23" rx="2" fill="#0e2146"/>`;
      if (lit) { lights.push(`<rect x="${wx.toFixed(1)}" y="${wy}" width="17" height="23" rx="2" fill="#f7d98a"/><rect x="${wx.toFixed(1)}" y="${wy + 11}" width="17" height="2" fill="#c98f3a" opacity=".7"/>`); if (r() < 0.4) glow.push(`<rect x="${(wx + 3).toFixed(1)}" y="${WATER_Y + 6}" width="6" height="${16 + r() * 34}" rx="3" fill="#f7d98a" opacity=".3"/>`); }
    }
    x += w + 2 + r() * 8;
  }
  // towpath + gas lamps
  s += `<rect x="-20" y="${WATER_Y - 6}" width="1660" height="14" fill="#091430"/>`;
  const lamps = [140, 520, 905, 1290, 1560];
  let lampSvg = '';
  for (const lx of lamps) {
    s += `<rect x="${lx}" y="${WATER_Y - 74}" width="5" height="76" fill="#14264d"/><path d="M${lx - 8} ${WATER_Y - 74}h21l-5 -13h-11z" fill="#14264d"/>`;
    lampSvg += `<circle cx="${lx + 2.5}" cy="${WATER_Y - 82}" r="30" fill="url(#lg)"/><circle cx="${lx + 2.5}" cy="${WATER_Y - 80}" r="7.5" fill="#ffe7a6"/>`;
    glow.push(`<rect x="${lx - 1}" y="${WATER_Y + 8}" width="4" height="46" rx="2" fill="#ffd77a" opacity=".4"/>`);
  }
  return { solid: s, lights: '<defs><radialGradient id="lg"><stop offset="0" stop-color="#ffd77a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd77a" stop-opacity="0"/></radialGradient></defs>' + lights.join('') + lampSvg, glints: glow.join('') };
}

function starsSvg(seed, n) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(r() * 1600).toFixed(0)}" cy="${(14 + r() * 380).toFixed(0)}" r="${(0.9 + r() * 1.5).toFixed(1)}" fill="#fff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  return s;
}

const LAYER = (cls, inner, vb = '0 0 1600 900', par = 'xMidYMax slice') =>
  `<svg class="sc-layer ${cls}" viewBox="${vb}" preserveAspectRatio="${par}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;

/** The desk props that stand on the sill at the sides of a wide screen: books, a plant, a brass lamp, a mug. */
function propsLeft() {
  return `<svg class="sc-prop sc-prop-left" viewBox="0 0 240 200" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false">
    <rect x="0" y="176" width="260" height="24" fill="#2a1d14"/><rect x="0" y="176" width="260" height="4" fill="#4a3322"/>
    <g><rect x="22" y="146" width="104" height="30" rx="3" fill="#8f2b2b"/><rect x="22" y="146" width="104" height="5" fill="#b44444"/><rect x="30" y="158" width="88" height="3" fill="#dcab4a"/>
    <rect x="34" y="118" width="92" height="28" rx="3" fill="#1f5a78"/><rect x="34" y="118" width="92" height="5" fill="#3b86a8"/><rect x="42" y="130" width="76" height="3" fill="#dcab4a"/>
    <rect x="28" y="92" width="86" height="26" rx="3" fill="#d6b56a"/><rect x="28" y="92" width="86" height="5" fill="#f0d490"/><rect x="36" y="103" width="70" height="3" fill="#8a6418"/></g>
    <g class="sc-plant"><path d="M156 176h46l-6 -40h-34z" fill="#c4683c"/><rect x="152" y="130" width="54" height="10" rx="3" fill="#a9532c"/>
    <path d="M179 130C150 112 144 84 160 58 168 88 180 104 179 130z" fill="#3f9b6e"/><path d="M181 130C206 108 214 80 200 54 190 84 180 104 181 130z" fill="#2f8159"/><path d="M180 130C176 100 182 78 180 46 190 76 192 106 180 130z" fill="#52b985"/></g>
  </svg>`;
}
function propsRight() {
  return `<svg class="sc-prop sc-prop-right" viewBox="0 0 260 220" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <rect x="-10" y="196" width="280" height="24" fill="#2a1d14"/><rect x="-10" y="196" width="280" height="4" fill="#4a3322"/>
    <g><ellipse cx="148" cy="196" rx="52" ry="7" fill="#141008"/><path d="M104 196c0 -14 12 -22 44 -22s44 8 44 22z" fill="#8a6418"/><path d="M108 192c0 -10 10 -16 40 -16s40 6 40 16z" fill="#dcab4a"/>
    <path d="M148 176L118 112 150 60" fill="none" stroke="#8a6418" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M148 176L118 112 150 60" fill="none" stroke="#dcab4a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="118" cy="112" r="6" fill="#dcab4a" stroke="#8a6418" stroke-width="2"/><circle cx="148" cy="176" r="6" fill="#dcab4a" stroke="#8a6418" stroke-width="2"/>
    <path d="M122 56C128 36 168 28 184 42L176 70C166 78 138 78 122 56z" fill="#1a8a7e" stroke="#0f5a52" stroke-width="3" stroke-linejoin="round"/><path d="M134 44C146 38 164 38 176 46" stroke="#5ee0d0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M140 74L128 98" stroke="#ffe7a6" stroke-width="0" /></g>
    <g><rect x="206" y="166" width="32" height="30" rx="4" fill="#f4efe2"/><path d="M238 174h8a8 8 0 0 1 0 16h-8" fill="none" stroke="#f4efe2" stroke-width="5"/><rect x="206" y="166" width="32" height="7" rx="3" fill="#3a2a1c"/>
    <path class="sc-steam" d="M216 158c-5-8 5-12 0-20M228 158c-5-8 5-12 0-20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".4"/></g>
    <g><rect x="12" y="150" width="60" height="46" rx="3" fill="#ecd6a2" stroke="#a98d4c" stroke-width="2"/><rect x="12" y="144" width="26" height="9" rx="3" fill="#dcc084" stroke="#a98d4c" stroke-width="2"/><rect x="22" y="164" width="40" height="3" fill="#8a7440"/><rect x="22" y="174" width="32" height="3" fill="#8a7440"/></g>
  </svg>`;
}

function moon() {
  return `<svg class="sc-layer sc-moon" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><circle cx="905" cy="170" r="120" fill="#f2e8c4" opacity=".08"/><circle cx="905" cy="170" r="84" fill="#f2e8c4" opacity=".1"/><circle cx="905" cy="170" r="52" fill="#f6edc9"/><circle cx="923" cy="156" r="46" fill="#0d1f45" opacity=".34"/><circle cx="892" cy="178" r="8" fill="#d9ceaa" opacity=".6"/><circle cx="918" cy="190" r="5" fill="#d9ceaa" opacity=".5"/></svg>`;
}

function boat() {
  return `<svg class="sc-layer sc-boat" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><g transform="translate(0 ${WATER_Y + 22})"><path d="M0 0h180l-14 18h-150z" fill="#06102a"/><rect x="34" y="-26" width="96" height="26" rx="3" fill="#0a1634"/><rect x="42" y="-18" width="14" height="12" fill="#f7d98a"/><rect x="66" y="-18" width="14" height="12" fill="#f7d98a"/><rect x="90" y="-18" width="14" height="12" fill="#f7d98a"/><rect x="122" y="-44" width="3" height="44" fill="#06102a"/><circle cx="123.5" cy="-46" r="5" fill="#ffd77a"/><circle cx="123.5" cy="-46" r="20" fill="#ffd77a" opacity=".16"/></g></svg>`;
}

/** Fill the layers of #backdrop. The static sky, rain, lamp and vignette layers live in index.html. */
export function drawBackdrop(svg) {
  const root = svg && svg.closest ? svg.closest('#backdrop') : document.getElementById('backdrop');
  if (!root || root.dataset.drawn) return;
  root.dataset.drawn = '1';
  const far = farCity(), near = nearCity();
  const water = `<rect x="-40" y="${WATER_Y}" width="1680" height="140" fill="#07142e"/><rect x="-40" y="${WATER_Y}" width="1680" height="5" fill="#16305c"/>`
    + Array.from({ length: 9 }, (_, i) => `<rect x="${-40 + ((i * 211) % 1500)}" y="${WATER_Y + 18 + i * 13}" width="${120 + (i % 3) * 70}" height="2.5" rx="1.2" fill="#2c4e86" opacity=".5"/>`).join('');
  const html = [
    LAYER('sc-stars sc-stars-a', starsSvg(3, 46)),
    LAYER('sc-stars sc-stars-b', starsSvg(8, 38)),
    moon(),
    LAYER('sc-far', far.solid),
    LAYER('sc-far-lights', far.lights),
    LAYER('sc-near', near.solid),
    LAYER('sc-near-lights', near.lights),
    LAYER('sc-water', water),
    LAYER('sc-glints', near.glints),
    boat(),
    propsLeft(), propsRight(),
  ].join('');
  // everything goes between the sky layers and the rain
  const rain = root.querySelector('.sc-rain');
  rain.insertAdjacentHTML('beforebegin', html);
  svg.remove();
  // a few drifting dust motes in the lamplight (CSS-animated, positioned by custom properties)
  const dust = root.querySelector('.sc-dust');
  if (dust && !dust.children.length) {
    const r = rng(5);
    dust.innerHTML = Array.from({ length: 16 }, () => `<i style="--x:${(r() * 100).toFixed(1)}%;--y:${(30 + r() * 70).toFixed(1)}%;--s:${(2 + r() * 3.4).toFixed(1)}px;--d:${(9 + r() * 12).toFixed(1)}s;--dl:${(-r() * 20).toFixed(1)}s;--dx:${((r() - 0.5) * 80).toFixed(0)}px"></i>`).join('');
  }
}
