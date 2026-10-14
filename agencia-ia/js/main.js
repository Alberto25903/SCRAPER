'use strict';
// ============================================================
//  Arranque y bucle principal
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

G.agents = AGENT_DEFS.map((d) => new Agent(d));
G.cat = new Cat();
// cada uno empieza a una hora distinta del día
G.agents.forEach((a, i) => { a.idleUntil = 600 + i * 900; });

UI.init();
UI.log('🏢 La Agencia Pixel abre sus puertas. Nova, Byte y Luma están listos para trabajar (o para jugar a la consola).', 'done');
if (!Brain.hasAI()) UI.log('🟡 Modo simulado. Añade tu API key de Claude en ⚙ Ajustes para que los agentes piensen de verdad.', 'task');

// Ajusta el tamaño del lienzo al espacio disponible
function resize() {
  const frame = document.querySelector('.stage-frame');
  const avail = frame.clientWidth - 16;
  const maxH = Math.max(260, window.innerHeight - 300);
  let s = Math.min(avail / VW, maxH / VH);
  if (s >= 2) s = Math.floor(s * 2) / 2;
  s = Math.max(0.6, s);
  UI.scale = s;
  const stage = document.getElementById('stage');
  stage.style.width = `${VW * s}px`;
  canvas.style.width = `${VW * s}px`;
  canvas.style.height = `${VH * s}px`;
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(document.querySelector('.stage-frame'));
resize();

function render() {
  const t = G.sim;
  ctx.clearRect(0, 0, VW, VH);
  drawBackground(ctx, t);
  const items = [];
  for (const f of FURNITURE) items.push({ y: f.y, flat: f.flat, draw: () => f.draw(ctx, t) });
  for (const a of G.agents) items.push({ y: a.y, draw: () => drawAgent(ctx, a, t) });
  if (G.cat) items.push({ y: G.cat.y, draw: () => drawCat(ctx, G.cat, t) });
  items.sort((p, q) => (q.flat ? 1 : 0) - (p.flat ? 1 : 0) || p.y - q.y);
  for (const it of items) it.draw();
  drawLighting(ctx, t);
  drawParticles(ctx);
}

let last = performance.now();
let uiTimer = 0;
function frame(now) {
  const realDt = Math.min(100, now - last);
  last = now;
  const dt = G.paused ? 0 : realDt * G.speed;
  if (dt > 0) {
    G.sim += dt;
    G.minutes += dt / SIM_MS_PER_GAME_MIN;
    if (G.minutes >= 24 * 60) { G.minutes -= 24 * 60; G.day++; }
    for (const a of G.agents) a.update(dt);
    G.cat.update(dt);
    updateParticles(dt);
    updateAmbient(dt);
    processQueue();
    for (const a of G.agents) if (G.sim > a.idleUntil) startFreeLife(a);
  }
  render();
  UI.frame();
  uiTimer += realDt;
  if (uiTimer > 250) {
    uiTimer = 0;
    UI.renderTeam();
    UI.els.clock.textContent = `Día ${G.day} · ${fmtClock(G.minutes)}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
