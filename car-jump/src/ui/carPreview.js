// Procedural car drawing for the garage / daily preview. Uses car.body (+y up) and car.wheels only.

export function drawCar(canvas, car, { spin = 0, bob = 0, floor = true, dx = 0, alpha = 1 } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!car) return;

  // bounds of body + wheels in car space
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of car.body) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (const w of car.wheels) { minX = Math.min(minX, w.x - w.r); maxX = Math.max(maxX, w.x + w.r); minY = Math.min(minY, w.y - w.r); maxY = Math.max(maxY, w.y + w.r); }
  const bw = maxX - minX, bh = maxY - minY;
  // fixed world scale so bigger cars look bigger: fit the widest car (5.4 m) into ~78% of the width
  const s = Math.min((W * 0.8) / Math.max(bw, 5.4), (H * 0.62) / Math.max(bh, 2.0));
  const groundY = H * 0.8;
  const cx = W / 2 - ((minX + maxX) / 2) * s + dx;

  if (floor) {
    const g = ctx.createRadialGradient(W / 2, groundY, 4, W / 2, groundY, W * 0.48);
    g.addColorStop(0, 'rgba(120,140,255,.35)'); g.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, groundY - H * 0.3, W, H * 0.5);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(W / 2, groundY + 2, (bw * s) / 2, Math.max(4, s * 0.18), 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, groundY - (-minY) * s - bob);
  ctx.scale(s, -s);
  const lw = 2.4 / s;

  paintCar(ctx, car, lw, spin);
  ctx.restore();
}

// Paint a car in car space (meters, +y up) on an already-transformed context. lw = 1 px in car units.
export function paintCar(ctx, car, lw, spin = 0) {
  let maxY = -Infinity;
  for (const [, y] of car.body) maxY = Math.max(maxY, y);
  for (const w of car.wheels) maxY = Math.max(maxY, w.y + w.r);
  const minY = Math.min(...car.body.map((p) => p[1]), ...car.wheels.map((w) => w.y - w.r));
  // body
  const body = new Path2D();
  car.body.forEach(([x, y], i) => (i ? body.lineTo(x, y) : body.moveTo(x, y)));
  body.closePath();
  const grad = ctx.createLinearGradient(0, maxY, 0, minY);
  grad.addColorStop(0, shade(car.color, 0.28)); grad.addColorStop(0.55, car.color); grad.addColorStop(1, shade(car.color, -0.35));
  ctx.fillStyle = grad; ctx.fill(body);

  // windows: clip to body, fill the cabin band above the beltline
  ctx.save();
  ctx.clip(body);
  const belt = minYBody(car) + (maxYBody(car) - minYBody(car)) * 0.5;
  ctx.fillStyle = 'rgba(160,215,255,.9)';
  const front = maxXBody(car), rear = minXBody(car);
  ctx.beginPath();
  ctx.moveTo(rear + (front - rear) * 0.16, belt);
  ctx.lineTo(front - (front - rear) * 0.2, belt);
  ctx.lineTo(front - (front - rear) * 0.2, maxY + 1);
  ctx.lineTo(rear + (front - rear) * 0.16, maxY + 1);
  ctx.fill();
  ctx.fillStyle = shade(car.color, -0.2);
  const pillar = (front - rear) * 0.04;
  ctx.fillRect((front + rear) / 2 + (front - rear) * 0.05, belt, pillar, maxY);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.moveTo(rear + (front - rear) * 0.3, maxY + 1); ctx.lineTo(rear + (front - rear) * 0.38, belt); ctx.lineTo(rear + (front - rear) * 0.43, belt); ctx.lineTo(rear + (front - rear) * 0.35, maxY + 1);
  ctx.fill();
  // accent stripe
  ctx.fillStyle = car.accent;
  ctx.fillRect(rear - 1, belt - 0.22, front - rear + 2, 0.13);
  // headlight / taillight
  ctx.fillStyle = '#fff6b0'; ctx.fillRect(front - 0.18, minYBody(car) + 0.2, 0.25, 0.16);
  ctx.fillStyle = '#ff3b3b'; ctx.fillRect(rear - 0.05, minYBody(car) + 0.22, 0.22, 0.14);
  ctx.restore();

  ctx.lineWidth = lw * 1.4; ctx.strokeStyle = '#05071a'; ctx.lineJoin = 'round';
  ctx.stroke(body);
  // rim light so dark cars still read on navy
  ctx.save(); ctx.clip(body);
  ctx.lineWidth = lw * 2; ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.translate(0, -lw * 1.2); ctx.stroke(body);
  ctx.restore();

  // wheels
  for (const w of car.wheels) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.fillStyle = '#14151c'; ctx.beginPath(); ctx.arc(0, 0, w.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#05071a'; ctx.stroke();
    ctx.fillStyle = car.accent === '#f2f2f2' || car.accent === '#e8c547' ? car.accent : '#c9cfdc';
    ctx.beginPath(); ctx.arc(0, 0, w.r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(-spin);
    ctx.strokeStyle = '#14151c'; ctx.lineWidth = w.r * 0.12;
    for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.moveTo(0, w.r * 0.12); ctx.lineTo(0, w.r * 0.5); ctx.stroke(); }
    ctx.fillStyle = '#14151c'; ctx.beginPath(); ctx.arc(0, 0, w.r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

const minYBody = (c) => Math.min(...c.body.map((p) => p[1]));
const maxYBody = (c) => Math.max(...c.body.map((p) => p[1]));
const minXBody = (c) => Math.min(...c.body.map((p) => p[0]));
const maxXBody = (c) => Math.max(...c.body.map((p) => p[0]));

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
