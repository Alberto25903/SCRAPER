'use strict';
// ============================================================
//  Motor base: constantes, estado global, rejilla, A*, utilidades
// ============================================================

const TILE = 16, COLS = 24, ROWS = 14;
const VW = COLS * TILE, VH = ROWS * TILE;

// Estado global del juego
const G = {
  sim: 0,              // tiempo de simulación (ms)
  speed: 1,            // multiplicador de velocidad
  paused: false,
  minutes: 9 * 60,     // reloj del juego (minutos desde medianoche)
  day: 1,
  agents: [],
  cat: null,
  particles: [],
  queue: [],           // tareas pendientes
  active: [],          // tareas en curso
  results: [],         // informes entregados
  selected: null,      // agente seleccionado
  tv: { mode: 'off', users: new Set(), t: 0 },
  pc: { mode: 'idle' },
  radio: { on: false, until: 0 },
  arcade: { on: false },
  fridgeOpen: false,
  coffeeBrewing: false,
  booksOut: { shelfA: 0, shelfB: 0 },
  board: { marks: [], title: '' },
  laptop: false,
  inArtifact: false,  // abierta como página publicada en claude.ai
  sampleFn: null,     // acceso a Claude con la cuenta de quien la ve
  downloads: null,
  settings: {
    apiKey: '', remember: false, model: 'claude-opus-5-5',
    webSearch: true, aiIdle: false, useAccount: false,
  },
};

// Un minuto de juego por cada segundo de simulación
const SIM_MS_PER_GAME_MIN = 1000;

class CancelError extends Error {
  constructor() { super('cancelado'); this.cancelled = true; }
}

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = (p) => Math.random() < p;
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Pseudo-aleatorio determinista (para que libros, tablas, etc. no parpadeen)
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function fmtClock(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function hourNow() { return (G.minutes / 60) % 24; }

// ------------------------------------------------------------
//  Rejilla de colisiones y búsqueda de caminos (A*)
// ------------------------------------------------------------
const blocked = new Uint8Array(COLS * ROWS);
function block(x, y, w = 1, h = 1) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) blocked[j * COLS + i] = 1;
}
function walkable(tx, ty) {
  return tx >= 0 && ty >= 3 && tx < COLS && ty < ROWS && !blocked[ty * COLS + tx];
}
const tileOf = (px) => Math.floor(px / TILE);
const center = (t) => t * TILE + TILE / 2;

function nearestWalkable(tx, ty) {
  if (walkable(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.abs(dx) === r || Math.abs(dy) === r)
          if (walkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
  return { x: 8, y: 6 };
}

function findPath(sx, sy, ex, ey) {
  const s = nearestWalkable(sx, sy), e = nearestWalkable(ex, ey);
  const key = (x, y) => y * COLS + x;
  const open = [{ x: s.x, y: s.y, g: 0, f: 0 }];
  const came = new Map(), gs = new Map([[key(s.x, s.y), 0]]);
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === e.x && cur.y === e.y) {
      const out = [];
      let k = ck;
      while (k !== undefined) {
        out.unshift({ x: k % COLS, y: Math.floor(k / COLS) });
        k = came.get(k);
      }
      return out;
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!walkable(nx, ny)) continue;
      const nk = key(nx, ny);
      const ng = cur.g + 1;
      if (ng < (gs.get(nk) ?? Infinity)) {
        gs.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, g: ng, f: ng + Math.abs(nx - e.x) + Math.abs(ny - e.y) });
      }
    }
  }
  return [e];
}

// ------------------------------------------------------------
//  Iconos pixelados (emociones) 5x5
// ------------------------------------------------------------
const ICONS = {
  '!':   { c: '#e83b3b', p: ['..#..', '..#..', '..#..', '.....', '..#..'] },
  '?':   { c: '#3b7be8', p: ['.###.', '#...#', '..##.', '.....', '..#..'] },
  heart: { c: '#e8476e', p: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
  note:  { c: '#7b4dd6', p: ['..###', '..#.#', '..#..', '###..', '##...'] },
  z:     { c: '#5a6fb0', p: ['####.', '...#.', '..#..', '.#...', '####.'] },
  dots:  { c: '#444455', p: ['.....', '.....', '.....', '.....', '#.#.#'] },
  bulb:  { c: '#e8b53b', p: ['.###.', '#####', '#####', '.###.', '..#..'] },
  anger: { c: '#e83b3b', p: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'] },
  star:  { c: '#e8b53b', p: ['..#..', '.###.', '#####', '.###.', '.#.#.'] },
  drop:  { c: '#3bb0e8', p: ['..#..', '.###.', '#####', '#####', '.###.'] },
  check: { c: '#2fbf71', p: ['....#', '...##', '#.##.', '###..', '.#...'] },
  book:  { c: '#b05a3b', p: ['#####', '#.#.#', '#.#.#', '#.#.#', '#####'] },
  cup:   { c: '#8a5a3b', p: ['.#.#.', '####.', '#####', '####.', '.##..'] },
};
function drawIcon(ctx, name, x, y, color) {
  const ic = ICONS[name];
  if (!ic) return;
  ctx.fillStyle = color || ic.c;
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 5; i++)
      if (ic.p[j][i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
}

// ------------------------------------------------------------
//  Partículas (notas, corazones, zzz, vapor, chispas)
// ------------------------------------------------------------
function spawnParticle(x, y, kind, opts = {}) {
  G.particles.push(Object.assign({
    x, y, kind, vx: rand(-4, 4), vy: rand(-14, -8), life: 1600, age: 0,
  }, opts));
}
function updateParticles(dt) {
  for (const p of G.particles) {
    p.age += dt;
    p.x += p.vx * dt / 1000;
    p.y += p.vy * dt / 1000;
  }
  G.particles = G.particles.filter((p) => p.age < p.life);
}
function drawParticles(ctx) {
  for (const p of G.particles) {
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = clamp(a * 1.5, 0, 1);
    if (p.kind === 'steam') {
      rect(ctx, p.x, p.y, 1, 2, '#ffffff');
    } else if (p.kind === 'spark') {
      rect(ctx, p.x, p.y, 1, 1, p.color || '#fff6a0');
    } else {
      drawIcon(ctx, p.kind, Math.round(p.x) - 2, Math.round(p.y) - 2, p.color);
    }
  }
  ctx.globalAlpha = 1;
}
