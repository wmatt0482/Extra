// The player's badge for the picker and the chips: a round face in a road-trip cap in the player's color (canvas, no image files).
export function drawAvatar(canvas, color = '#ff8a1f') {
  if (!canvas || !canvas.getContext) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(24, Math.round(r.width || 64)), hh = Math.max(24, Math.round(r.height || 64));
  canvas.width = w * dpr; canvas.height = hh * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, hh);
  const s = Math.min(w, hh) / 64;
  c.translate(w / 2, hh / 2); c.scale(s, s);
  c.fillStyle = '#ffe9b8'; c.beginPath(); c.arc(0, 0, 31, 0, Math.PI * 2); c.fill();                       // the sky behind
  c.fillStyle = '#2a4a7a'; c.beginPath(); c.moveTo(-26, 32); c.quadraticCurveTo(-26, 12, -12, 9); c.lineTo(12, 9); c.quadraticCurveTo(26, 12, 26, 32); c.closePath(); c.fill();   // jacket
  c.fillStyle = '#e0a67a'; c.beginPath(); c.ellipse(0, -2, 14, 15, 0, 0, Math.PI * 2); c.fill();           // face
  c.fillStyle = '#1b1f2a'; c.beginPath(); c.arc(-5, -1, 2, 0, Math.PI * 2); c.arc(5, -1, 2, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#7a3b1d'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, 7); c.quadraticCurveTo(0, 10, 4, 7); c.stroke();
  c.fillStyle = color; c.beginPath(); c.moveTo(-15, -8); c.quadraticCurveTo(-14, -26, 0, -26); c.quadraticCurveTo(14, -26, 15, -8); c.closePath(); c.fill();   // cap
  c.fillRect(-16, -10, 38, 5);                                                                                // the brim
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-6, -21, 4, 2, -0.5, 0, Math.PI * 2); c.fill();
  c.setTransform(1, 0, 0, 1, 0, 0);
}
