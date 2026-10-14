// Fireworks overlay for the results screen (NEW RECORD): rockets rise, burst into sparks with
// gravity, drag, and fade. Canvas 2D, DPR-capped, stops (and clears) itself when done.
const COLORS = ['#ffcf1a', '#ff3b5c', '#22d3ff', '#2fd36b', '#8f6bff', '#ffffff', '#ff9a3d'];

export function createFireworks(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0, parts = [], rockets = [], until = 0, lastT = 0, nextLaunch = 0, W = 0, H = 0, dpr = 1;

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function launch() {
    const x = W * (0.15 + Math.random() * 0.7);
    rockets.push({ x, y: H + 10, vx: (Math.random() - 0.5) * 60, vy: -(H * 1.05 + Math.random() * H * 0.35), fuse: 0.7 + Math.random() * 0.25, color: COLORS[(Math.random() * COLORS.length) | 0] });
  }
  function burst(x, y, color) {
    const n = 46 + ((Math.random() * 20) | 0);
    const sp = Math.min(W, H) * (0.5 + Math.random() * 0.25);
    const alt = COLORS[(Math.random() * COLORS.length) | 0];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const v = sp * (0.55 + Math.random() * 0.45);
      parts.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.7 + Math.random() * 0.5, color: i % 3 ? color : alt, size: 2 + Math.random() * 1.8 });
    }
  }
  function frame(now) {
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    if (now < until && now >= nextLaunch) { launch(); nextLaunch = now + 260 + Math.random() * 320; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const g = H * 0.9;
    rockets = rockets.filter((r) => {
      r.fuse -= dt; r.vy += g * dt; r.x += r.vx * dt; r.y += r.vy * dt;
      ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,160,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.vx * 0.05, r.y - r.vy * 0.05); ctx.stroke();
      if (r.fuse <= 0) { burst(r.x, r.y, r.color); return false; }
      return true;
    });
    parts = parts.filter((p) => {
      p.px = p.x; p.py = p.y;
      p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + g * 0.35 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, p.life * 1.4);
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      return true;
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (now < until || rockets.length || parts.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, W, H); canvas.hidden = true; }
  }
  return {
    start(ms = 2800) {
      canvas.hidden = false;
      size();
      until = performance.now() + ms; nextLaunch = 0; lastT = 0;
      launch(); launch();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf); raf = 0; parts = []; rockets = [];
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.hidden = true;
    },
    get running() { return !!raf; },
  };
}
