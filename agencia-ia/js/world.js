'use strict';
// ============================================================
//  La sala de estar: mobiliario, puntos de interacción y dibujo
// ============================================================

// --- Colisiones del mobiliario -------------------------------
block(1, 3, 5, 1);    // estanterías
block(6, 3);          // planta junto a la pizarra
block(11, 3, 3, 1);   // mueble de la tele
block(19, 3, 3, 1);   // escritorio
block(20, 4);         // silla del escritorio
block(22, 3);         // planta grande
block(10, 7, 5, 1);   // sofá
block(16, 7);         // butaca
block(17, 7);         // lámpara de pie
block(3, 9, 3, 2);    // mesa de reuniones
block(18, 13, 4, 1);  // encimera de la cocina
block(22, 12, 2, 2);  // nevera
block(23, 7, 1, 2);   // máquina recreativa
block(14, 13);        // tocadiscos
block(7, 12, 2, 1);   // puf
block(0, 13);         // planta de la esquina

// --- Puntos de interacción ------------------------------------
// tx,ty: casilla de acceso · x,y: posición final (pies) · face · pose
const SPOTS = {
  shelfA:  { tx: 2,  ty: 4,  x: 40,  y: 76,  face: 'up' },
  shelfB:  { tx: 5,  ty: 4,  x: 88,  y: 76,  face: 'up' },
  board:   { tx: 8,  ty: 3,  x: 136, y: 61,  face: 'up' },
  board2:  { tx: 7,  ty: 4,  x: 118, y: 78,  face: 'up' },
  board3:  { tx: 9,  ty: 4,  x: 154, y: 78,  face: 'up' },
  plant2:  { tx: 7,  ty: 3,  x: 118, y: 60,  face: 'left' },
  plant1:  { tx: 22, ty: 4,  x: 360, y: 77,  face: 'up' },
  plant3:  { tx: 1,  ty: 13, x: 22,  y: 216, face: 'left' },
  window:  { tx: 16, ty: 3,  x: 264, y: 60,  face: 'up' },
  sofa1:   { tx: 11, ty: 6,  x: 184, y: 122, face: 'up', pose: 'sit' },
  sofa2:   { tx: 12, ty: 6,  x: 200, y: 122, face: 'up', pose: 'sit' },
  sofa3:   { tx: 13, ty: 6,  x: 216, y: 122, face: 'up', pose: 'sit' },
  armchair:{ tx: 16, ty: 6,  x: 264, y: 122, face: 'up', pose: 'sit' },
  pc:      { tx: 20, ty: 5,  x: 328, y: 75,  face: 'up', pose: 'sit' },
  pcL:     { tx: 19, ty: 5,  x: 310, y: 90,  face: 'up' },
  pcR:     { tx: 21, ty: 5,  x: 346, y: 90,  face: 'up' },
  tableT:  { tx: 4,  ty: 8,  x: 72,  y: 143, face: 'down', pose: 'sit' },
  tableL:  { tx: 2,  ty: 10, x: 39,  y: 166, face: 'right', pose: 'sit' },
  tableR:  { tx: 6,  ty: 10, x: 105, y: 166, face: 'left', pose: 'sit' },
  tableB:  { tx: 4,  ty: 11, x: 72,  y: 186, face: 'up', pose: 'sit' },
  coffee:  { tx: 19, ty: 12, x: 312, y: 203, face: 'down' },
  fridge:  { tx: 21, ty: 12, x: 342, y: 202, face: 'right' },
  radio:   { tx: 14, ty: 12, x: 232, y: 203, face: 'down' },
  arcade:  { tx: 22, ty: 8,  x: 360, y: 138, face: 'right' },
  beanbag: { tx: 9,  ty: 12, x: 128, y: 203, face: 'down', pose: 'lie' },
  catpet:  { tx: 10, ty: 12, x: 168, y: 202, face: 'down' },
  // círculo de debate (de pie, cerca unos de otros)
  debA:    { tx: 7,  ty: 9,  x: 122, y: 152, face: 'right' },
  debB:    { tx: 9,  ty: 9,  x: 152, y: 152, face: 'left' },
  debC:    { tx: 8,  ty: 10, x: 137, y: 168, face: 'up' },
};
for (const [id, s] of Object.entries(SPOTS)) { s.id = id; s.occupant = null; }

const TABLE_SEATS = ['tableT', 'tableL', 'tableR', 'tableB'];
const SOFA_SEATS = ['sofa1', 'sofa2', 'sofa3'];
const DEBATE_SPOTS = ['debA', 'debB', 'debC'];

function freeSpot(ids, agent) {
  const free = ids.filter((id) => !SPOTS[id].occupant || SPOTS[id].occupant === agent);
  return free.length ? SPOTS[pick(free)] : null;
}

// --- Paleta -----------------------------------------------------
const C = {
  wall: '#4b3f72', wallStripe: '#54477f', molding: '#2d2547', base: '#2a1f3d',
  floorA: '#9a6a45', floorB: '#8f6140', seam: '#6e4a30',
  wood: '#6b4226', woodD: '#3d2414', woodL: '#8a5a36',
  sofa: '#b0413e', sofaL: '#c95a52', sofaD: '#8e312f',
  teal: '#2f7f7a', tealL: '#3fa39c', tealD: '#215b57',
  metal: '#9aa3ad', white: '#eef2f5', dark: '#1a1a24',
};

// ------------------------------------------------------------
//  Fondo: pared, suelo, alfombras y objetos colgados
// ------------------------------------------------------------
function skyColor(h) {
  if (h < 5 || h >= 21) return ['#0b1030', '#1a2050'];
  if (h < 7) return ['#f08a5d', '#6b5b95'];
  if (h < 18) return ['#7ec8f0', '#bfe6ff'];
  if (h < 21) return ['#f2994a', '#a4508b'];
  return ['#0b1030', '#1a2050'];
}

function drawBackground(ctx, t) {
  // pared
  rect(ctx, 0, 0, VW, 48, C.wall);
  for (let x = 0; x < VW; x += 8) rect(ctx, x, 4, 2, 40, C.wallStripe);
  rect(ctx, 0, 0, VW, 4, C.molding);
  rect(ctx, 0, 43, VW, 5, C.base);
  rect(ctx, 0, 43, VW, 1, '#3b2d55');

  // suelo de tablones
  for (let y = 48, row = 0; y < VH; y += 8, row++) {
    rect(ctx, 0, y, VW, 8, row % 2 ? C.floorA : C.floorB);
    rect(ctx, 0, y + 7, VW, 1, C.seam);
    let x = Math.floor(hash(row * 7 + 3) * 40);
    while (x < VW) {
      rect(ctx, x, y, 1, 7, C.seam);
      x += 40 + Math.floor(hash(row * 13 + x) * 30);
    }
  }

  // alfombra de la zona de la tele
  rect(ctx, 150, 70, 116, 66, '#5e2440');
  rect(ctx, 152, 72, 112, 62, '#7a2f4f');
  for (let x = 156; x < 260; x += 8) {
    rect(ctx, x, 75, 4, 2, '#b8476e');
    rect(ctx, x + 2, 129, 4, 2, '#b8476e');
  }
  rect(ctx, 160, 82, 96, 44, '#86385a');
  for (let i = 0; i < 5; i++) rect(ctx, 176 + i * 16, 100, 8, 8, '#a14670');

  // alfombra redonda bajo la mesa
  ctx.fillStyle = '#2f5d7a';
  ctx.beginPath(); ctx.ellipse(72, 162, 46, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b7396';
  ctx.beginPath(); ctx.ellipse(72, 162, 40, 25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a9cc0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(72, 162, 33, 20, 0, 0, Math.PI * 2); ctx.stroke();

  // alfombra pequeña de la cocina
  rect(ctx, 290, 186, 52, 12, '#3d6b4f');
  for (let x = 292; x < 340; x += 4) rect(ctx, x, 188, 2, 8, '#4f8a66');

  drawWindow(ctx, t);
  drawWhiteboard(ctx, t);
  drawClock(ctx);
  drawCorkboard(ctx);
  drawPoster(ctx);
  drawStringLights(ctx, t);
}

function drawWindow(ctx, t) {
  const x = 242, y = 8, w = 44, h = 32;
  const h24 = hourNow();
  const [top, bot] = skyColor(h24);
  rect(ctx, x - 2, y - 2, w + 4, h + 4, '#d9c6a5');
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const night = h24 < 6 || h24 >= 20.5;
  if (night) {
    for (let i = 0; i < 14; i++) {
      const sx = x + Math.floor(hash(i * 31) * w), sy = y + Math.floor(hash(i * 17) * (h - 8));
      if ((Math.floor(t / 400) + i) % 7) rect(ctx, sx, sy, 1, 1, '#ffffff');
    }
    rect(ctx, x + 30, y + 5, 6, 6, '#f4f1c9'); rect(ctx, x + 32, y + 5, 4, 4, top);
  } else {
    // sol que se desplaza por el cielo
    const p = clamp((h24 - 6) / 14, 0, 1);
    const sx = x + 4 + p * (w - 12), sy = y + 14 - Math.sin(p * Math.PI) * 10;
    rect(ctx, sx, sy, 6, 6, '#ffe066'); rect(ctx, sx + 1, sy - 1, 4, 8, '#ffe066'); rect(ctx, sx - 1, sy + 1, 8, 4, '#ffe066');
    // nubes
    for (let i = 0; i < 2; i++) {
      const cx = x + ((t / (90 + i * 50) + i * 25) % (w + 20)) - 10;
      const cy = y + 6 + i * 9;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      rect(ctx, cx, cy, 12, 3, '#ffffff'); rect(ctx, cx + 3, cy - 2, 6, 2, '#ffffff');
      ctx.restore();
    }
  }
  // edificios a lo lejos
  const bc = night ? '#141a3a' : '#5d6d8f';
  rect(ctx, x, y + 22, 8, 10, bc); rect(ctx, x + 9, y + 18, 7, 14, bc);
  rect(ctx, x + 18, y + 25, 10, 7, bc); rect(ctx, x + 30, y + 20, 6, 12, bc); rect(ctx, x + 37, y + 24, 7, 8, bc);
  if (night) for (let i = 0; i < 10; i++) {
    const wx = x + 1 + Math.floor(hash(i * 5 + 1) * 42), wy = y + 24 + Math.floor(hash(i * 9 + 2) * 7);
    rect(ctx, wx, wy, 1, 1, '#ffd966');
  }
  // marco y cortinas
  rect(ctx, x + w / 2 - 1, y, 2, h, '#d9c6a5');
  rect(ctx, x, y + h / 2 - 1, w, 2, '#d9c6a5');
  rect(ctx, x - 6, y - 4, 7, h + 8, '#c0504d'); rect(ctx, x - 6, y - 4, 2, h + 8, '#a03e3b');
  rect(ctx, x + w - 1, y - 4, 7, h + 8, '#c0504d'); rect(ctx, x + w + 4, y - 4, 2, h + 8, '#a03e3b');
  rect(ctx, x - 8, y - 6, w + 16, 2, '#6b4226');
  rect(ctx, x - 3, y + h + 2, w + 6, 3, '#e8dcc4');
}

function drawWhiteboard(ctx, t) {
  const x = 112, y = 8, w = 48, h = 30;
  rect(ctx, x - 1, y - 1, w + 2, h + 2, '#7d8792');
  rect(ctx, x, y, w, h, C.white);
  rect(ctx, x + 2, y + h + 1, w - 4, 2, '#7d8792');
  rect(ctx, x + 6, y + h, 4, 1, '#e83b3b'); rect(ctx, x + 12, y + h, 4, 1, '#3b7be8');
  // contenido dibujado por los agentes
  ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  for (const m of G.board.marks) {
    if (m.type === 'line') rect(ctx, x + m.x, y + m.y, m.w, 1, m.c);
    else if (m.type === 'box') {
      ctx.strokeStyle = m.c; ctx.lineWidth = 1;
      ctx.strokeRect(x + m.x + 0.5, y + m.y + 0.5, m.w, m.h);
    } else if (m.type === 'dot') rect(ctx, x + m.x, y + m.y, 2, 2, m.c);
    else if (m.type === 'arrow') {
      rect(ctx, x + m.x, y + m.y, m.w, 1, m.c);
      rect(ctx, x + m.x + m.w - 2, y + m.y - 1, 1, 3, m.c);
    } else if (m.type === 'smile') {
      rect(ctx, x + m.x, y + m.y, 1, 1, m.c); rect(ctx, x + m.x + 3, y + m.y, 1, 1, m.c);
      rect(ctx, x + m.x, y + m.y + 3, 4, 1, m.c);
    }
  }
  ctx.restore();
}

function addBoardMark(kind) {
  const cols = ['#2b2b3b', '#e83b3b', '#3b7be8', '#2fbf71'];
  const c = pick(cols);
  const marks = G.board.marks;
  if (marks.length > 40) marks.splice(0, 8);
  if (kind === 'diagram') {
    const bx = randi(3, 30), by = randi(3, 18);
    marks.push({ type: 'box', x: bx, y: by, w: randi(8, 12), h: randi(5, 7), c });
    marks.push({ type: 'arrow', x: bx + 13, y: by + 3, w: randi(4, 7), c: '#2b2b3b' });
  } else if (kind === 'text') {
    const row = marks.filter((m) => m.type === 'line').length % 9;
    marks.push({ type: 'line', x: 3, y: 3 + row * 3, w: randi(10, 40), c });
  } else if (kind === 'doodle') {
    marks.push(chance(0.5)
      ? { type: 'smile', x: randi(4, 40), y: randi(4, 22), c }
      : { type: 'dot', x: randi(4, 42), y: randi(4, 24), c });
  }
}
function eraseBoard() { G.board.marks = []; }

function drawClock(ctx) {
  const cx = 200, cy = 11;
  ctx.fillStyle = '#2d2547'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  const h = (G.minutes / 60) % 12, m = G.minutes % 60;
  ctx.strokeStyle = '#2b2b3b'; ctx.lineWidth = 1;
  const ah = h / 12 * Math.PI * 2 - Math.PI / 2, am = m / 60 * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ah) * 3, cy + Math.sin(ah) * 3); ctx.stroke();
  ctx.strokeStyle = '#e83b3b';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(am) * 5, cy + Math.sin(am) * 5); ctx.stroke();
}

function drawCorkboard(ctx) {
  const x = 306, y = 6, w = 44, h = 18;
  rect(ctx, x - 1, y - 1, w + 2, h + 2, '#6b4226');
  rect(ctx, x, y, w, h, '#c99a5e');
  const notes = ['#fff176', '#80deea', '#f48fb1', '#a5d6a7', '#ffcc80'];
  for (let i = 0; i < 6; i++) {
    const nx = x + 2 + i * 7, ny = y + 2 + (i % 2) * 6;
    rect(ctx, nx, ny, 6, 6, notes[i % notes.length]);
    rect(ctx, nx + 1, ny + 2, 4, 1, '#00000033');
    rect(ctx, nx + 2, ny, 2, 1, '#e83b3b');
  }
}

function drawPoster(ctx) {
  // póster retro "AI" sobre el sofá a la izquierda de la tele
  const x = 166, y = 8;
  rect(ctx, x - 1, y - 1, 12, 18, '#1a1a24');
  rect(ctx, x, y, 10, 16, '#2b1d4f');
  rect(ctx, x + 1, y + 9, 8, 6, '#e85d75'); rect(ctx, x + 2, y + 2, 6, 6, '#f2b134');
  rect(ctx, x + 3, y + 3, 4, 4, '#ffe066');
  // póster del mando
  const px = 226;
  rect(ctx, px - 1, y + 1, 14, 12, '#1a1a24');
  rect(ctx, px, y + 2, 12, 10, '#2f7f7a');
  rect(ctx, px + 2, y + 5, 8, 4, '#eef2f5'); rect(ctx, px + 3, y + 6, 1, 2, '#1a1a24');
  rect(ctx, px + 8, y + 6, 1, 1, '#e83b3b'); rect(ctx, px + 7, y + 7, 1, 1, '#3b7be8');
}

function drawStringLights(ctx, t) {
  const cols = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff'];
  for (let i = 0; i < 24; i++) {
    const x = 4 + i * 16, y = 3 + Math.round(Math.sin(i * 1.7) * 1.2) + 1;
    rect(ctx, x, y - 1, 16, 1, '#1d1530');
    const on = (Math.floor(t / 600) + i) % 3 !== 0;
    rect(ctx, x + 6, y, 2, 2, on ? cols[i % cols.length] : '#3a3050');
  }
}

// ------------------------------------------------------------
//  Objetos ordenables por profundidad (y de la base)
// ------------------------------------------------------------
function drawShelf(ctx, x, w, booksOut, seed) {
  const y = 6, h = 58;
  rect(ctx, x, y, w, h, C.wood);
  rect(ctx, x + 2, y + 2, w - 4, h - 6, C.woodD);
  rect(ctx, x, y, w, 2, C.woodL);
  const shelves = 4, sh = Math.floor((h - 6) / shelves);
  const bookCols = ['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085', '#ecf0f1', '#d35400'];
  for (let s = 0; s < shelves; s++) {
    const sy = y + 2 + s * sh;
    rect(ctx, x + 2, sy + sh - 2, w - 4, 2, C.woodL);
    let bx = x + 3, i = 0;
    while (bx < x + w - 5) {
      const r = hash(seed * 100 + s * 17 + i);
      const bw = 2 + Math.floor(r * 3), bh = sh - 5 - Math.floor(hash(seed + s * 3 + i * 7) * 4);
      const missing = s === 1 && i < booksOut;
      if (s === 3 && i === 2 && seed === 2) {
        // trofeo
        rect(ctx, bx, sy + sh - 8, 5, 4, '#f1c40f'); rect(ctx, bx + 2, sy + sh - 4, 1, 2, '#f1c40f');
        bx += 7; i++; continue;
      }
      if (!missing) {
        rect(ctx, bx, sy + sh - 2 - bh, bw, bh, bookCols[Math.floor(r * bookCols.length)]);
        rect(ctx, bx, sy + sh - bh + 1, bw, 1, '#00000040');
      }
      bx += bw + (hash(i + s) > 0.8 ? 2 : 0);
      i++;
    }
  }
  rect(ctx, x, y + h - 3, w, 3, C.woodD);
}

function drawTV(ctx, t) {
  // mueble
  rect(ctx, 176, 46, 48, 18, C.wood);
  rect(ctx, 176, 46, 48, 2, C.woodL);
  rect(ctx, 179, 51, 20, 10, C.woodD); rect(ctx, 201, 51, 20, 10, C.woodD);
  rect(ctx, 188, 55, 2, 2, C.woodL); rect(ctx, 210, 55, 2, 2, C.woodL);
  // consola
  rect(ctx, 202, 52, 14, 6, '#d9dde2'); rect(ctx, 202, 57, 14, 1, '#9aa3ad');
  rect(ctx, 204, 54, 4, 1, '#55606b');
  rect(ctx, 213, 53, 1, 1, G.tv.mode === 'game' ? (Math.floor(t / 300) % 2 ? '#2fbf71' : '#1a7a46') : '#e83b3b');
  // tele
  rect(ctx, 178, 18, 44, 29, '#22222c');
  rect(ctx, 196, 44, 8, 4, '#22222c');
  rect(ctx, 180, 20, 40, 24, C.dark);
  drawTVScreen(ctx, 181, 21, 38, 22, t);
  rect(ctx, 218, 45, 2, 1, G.tv.mode !== 'off' ? '#2fbf71' : '#e83b3b');
}

function drawTVScreen(ctx, x, y, w, h, t) {
  const mode = G.tv.mode;
  if (mode === 'off') {
    rect(ctx, x, y, w, h, '#15151d');
    rect(ctx, x + 3, y + 2, 6, 1, '#2a2a38'); rect(ctx, x + 2, y + 3, 1, 4, '#2a2a38');
    return;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (mode === 'game') {
    rect(ctx, x, y, w, h, '#5c94fc');
    const scroll = Math.floor(t / 60) % 16;
    for (let i = -1; i < 4; i++) {
      rect(ctx, x + i * 16 - scroll + 4, y + 4, 8, 3, '#ffffff');
    }
    rect(ctx, x, y + h - 5, w, 5, '#c84c0c');
    for (let i = 0; i < 6; i++) rect(ctx, x + i * 8 - (scroll % 8), y + h - 5, 1, 5, '#7a2e06');
    for (let i = 0; i < 3; i++) {
      const bx = x + ((i * 22 - Math.floor(t / 60)) % 60 + 60) % 60 - 10;
      rect(ctx, bx, y + 8, 5, 5, '#f8b800'); rect(ctx, bx + 2, y + 9, 1, 2, '#c84c0c');
    }
    const jump = Math.abs(Math.sin(t / 300)) * 7;
    rect(ctx, x + 10, y + h - 10 - jump, 4, 5, '#e83b3b');
    rect(ctx, x + 10, y + h - 11 - jump, 4, 1, '#c84c0c');
    if (G.tv.users.size > 1) {
      rect(ctx, x + 18, y + h - 10 - Math.abs(Math.cos(t / 260)) * 6, 4, 5, '#2fbf71');
    }
    const enemyX = x + w - ((Math.floor(t / 40)) % (w + 6));
    rect(ctx, enemyX, y + h - 8, 4, 3, '#8b4513');
  } else if (mode === 'show') {
    const hue = (t / 40) % 360;
    rect(ctx, x, y, w, h, `hsl(${hue},45%,35%)`);
    rect(ctx, x, y + h - 6, w, 6, '#2b2b3b');
    const bob = Math.sin(t / 200) * 1.5;
    rect(ctx, x + 8, y + 6 + bob, 6, 6, '#f1c7a3'); rect(ctx, x + 7, y + 12 + bob, 8, 6, '#e85d75');
    rect(ctx, x + 22, y + 7 - bob, 6, 6, '#c68c5a'); rect(ctx, x + 21, y + 13 - bob, 8, 6, '#3b7be8');
    if (Math.floor(t / 500) % 2) rect(ctx, x + 16, y + 3, 4, 3, '#ffffff');
  } else if (mode === 'news') {
    rect(ctx, x, y, w, h, '#1e3a6e');
    rect(ctx, x, y + h - 5, w, 5, '#e83b3b');
    const tick = Math.floor(t / 30) % 80;
    for (let i = 0; i < 6; i++) rect(ctx, x + i * 9 - tick % 9, y + h - 3, 6, 1, '#ffffff');
    rect(ctx, x + 14, y + 4, 10, 10, '#f1c7a3'); rect(ctx, x + 12, y + 14, 14, 3, '#2b2b3b');
  }
  // scanlines
  ctx.globalAlpha = 0.18;
  for (let j = 0; j < h; j += 2) rect(ctx, x, y + j, w, 1, '#000000');
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDesk(ctx, t) {
  rect(ctx, 304, 40, 48, 24, '#7d5535');
  rect(ctx, 304, 40, 48, 8, '#a8774e');
  rect(ctx, 304, 47, 48, 1, '#6a4229');
  rect(ctx, 306, 50, 18, 12, '#6a4229'); rect(ctx, 314, 55, 2, 2, '#a8774e');
  // monitor
  rect(ctx, 316, 22, 26, 18, '#2b2b36');
  rect(ctx, 327, 40, 4, 3, '#2b2b36'); rect(ctx, 323, 42, 12, 2, '#2b2b36');
  drawPCScreen(ctx, 318, 24, 22, 14, t);
  // teclado, ratón, taza, lámpara
  rect(ctx, 320, 44, 16, 3, '#d9dde2'); rect(ctx, 321, 45, 14, 1, '#9aa3ad');
  rect(ctx, 338, 44, 3, 3, '#d9dde2');
  rect(ctx, 344, 41, 4, 5, '#e85d75'); rect(ctx, 348, 42, 1, 2, '#e85d75');
  rect(ctx, 306, 30, 2, 12, '#55606b'); rect(ctx, 304, 27, 8, 4, '#f2b134');
  // torre del PC
  rect(ctx, 336, 50, 12, 14, '#2b2b36'); rect(ctx, 338, 52, 8, 1, '#55606b');
  rect(ctx, 341, 58, 2, 2, G.pc.mode !== 'idle' ? '#2fbf71' : '#3b7be8');
}

function drawPCScreen(ctx, x, y, w, h, t) {
  const m = G.pc.mode;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (m === 'idle') {
    rect(ctx, x, y, w, h, '#101828');
    const bx = x + Math.abs(((t / 80) % (2 * (w - 4))) - (w - 4));
    const by = y + Math.abs(((t / 110) % (2 * (h - 3))) - (h - 3));
    rect(ctx, bx, by, 4, 3, '#c77dff');
  } else if (m === 'code') {
    rect(ctx, x, y, w, h, '#1e1e2e');
    const off = Math.floor(t / 250);
    const cols = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cdd6f4'];
    for (let i = 0; i < 7; i++) {
      const r = hash(i + off);
      rect(ctx, x + 1 + (i % 3) * 2, y + 1 + i * 2, 3 + Math.floor(r * 14), 1, cols[(i + off) % cols.length]);
    }
  } else if (m === 'search') {
    rect(ctx, x, y, w, h, '#f5f5f5');
    rect(ctx, x + 2, y + 2, w - 4, 3, '#ffffff'); rect(ctx, x + 2, y + 2, w - 4, 1, '#9aa3ad');
    rect(ctx, x + 3, y + 3, Math.floor(t / 120) % (w - 6), 1, '#3b7be8');
    for (let i = 0; i < 3; i++) {
      rect(ctx, x + 2, y + 7 + i * 2, 8 + Math.floor(hash(i + Math.floor(t / 1500)) * 10), 1, i ? '#55606b' : '#1a0dab');
    }
  } else if (m === 'browse') {
    rect(ctx, x, y, w, h, '#ffffff');
    rect(ctx, x, y, w, 2, '#e85d75');
    rect(ctx, x + 2, y + 4, 9, 7, '#f2b134');
    rect(ctx, x + 4, y + 6, 2, 2, '#1a1a24'); rect(ctx, x + 7, y + 6, 2, 2, '#1a1a24');
    rect(ctx, x + 12, y + 4, 8, 1, '#55606b'); rect(ctx, x + 12, y + 7, 6, 1, '#9aa3ad');
  } else if (m === 'doc') {
    rect(ctx, x, y, w, h, '#ffffff');
    rect(ctx, x + 2, y + 2, 10, 1, '#1a1a24');
    const n = 3 + Math.floor(t / 400) % 4;
    for (let i = 0; i < n; i++) rect(ctx, x + 2, y + 5 + i * 2, 12 + Math.floor(hash(i) * 6), 1, '#55606b');
  }
  ctx.restore();
}

function drawChair(ctx) {
  rect(ctx, 321, 66, 14, 4, '#3b3b4a');
  rect(ctx, 320, 69, 16, 6, '#4b4b5e');
  rect(ctx, 320, 69, 16, 1, '#5e5e75');
  rect(ctx, 327, 75, 2, 3, '#2b2b36'); rect(ctx, 323, 78, 10, 1, '#2b2b36');
}

function drawPlant(ctx, x, y, big) {
  // x,y: centro de la base de la maceta
  const pw = big ? 10 : 8;
  rect(ctx, x - pw / 2, y - 7, pw, 7, '#c0623b');
  rect(ctx, x - pw / 2 - 1, y - 8, pw + 2, 2, '#d9774f');
  const leaves = big ? 9 : 6;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI - Math.PI;
    const len = (big ? 12 : 8) + hash(i * 3 + x) * 5;
    const lx = x + Math.cos(a) * len * 0.6, ly = y - 9 + Math.sin(a) * len;
    rect(ctx, lx - 2, ly - 2, 4, 4, i % 2 ? '#2e8b57' : '#3cb371');
    rect(ctx, (lx + x) / 2 - 1, (ly + y - 8) / 2, 2, 2, '#2e8b57');
  }
  rect(ctx, x - 1, y - 14, 2, 6, '#2e8b57');
}

function drawSofa(ctx) {
  const x = 160, y = 110, w = 80;
  rect(ctx, x + 4, y + 2, w - 8, 6, C.sofaL);
  rect(ctx, x + 4, y + 2, w - 8, 1, '#de7b72');
  rect(ctx, x + 2, y + 7, w - 4, 11, C.sofa);
  rect(ctx, x + 2, y + 17, w - 4, 2, C.sofaD);
  for (let i = 1; i < 3; i++) rect(ctx, x + 2 + i * 25, y + 8, 1, 9, C.sofaD);
  // reposabrazos
  rect(ctx, x, y - 2, 6, 20, C.sofaD); rect(ctx, x, y - 2, 6, 2, C.sofaL);
  rect(ctx, x + w - 6, y - 2, 6, 20, C.sofaD); rect(ctx, x + w - 6, y - 2, 6, 2, C.sofaL);
  rect(ctx, x + 3, y + 19, 3, 1, '#2b1a14'); rect(ctx, x + w - 6, y + 19, 3, 1, '#2b1a14');
}

function drawArmchair(ctx) {
  const x = 255, y = 110;
  rect(ctx, x + 2, y + 2, 14, 6, C.tealL);
  rect(ctx, x + 1, y + 7, 16, 11, C.teal);
  rect(ctx, x + 1, y + 17, 16, 2, C.tealD);
  rect(ctx, x - 1, y, 4, 18, C.tealD); rect(ctx, x + 15, y, 4, 18, C.tealD);
  // lámpara de pie
  rect(ctx, 279, 84, 2, 44, '#55606b');
  rect(ctx, 275, 126, 10, 2, '#55606b');
  rect(ctx, 273, 78, 14, 8, '#f2d16b'); rect(ctx, 274, 77, 12, 1, '#f7e3a0');
  rect(ctx, 273, 85, 14, 1, '#c9a845');
}

function drawTable(ctx) {
  ctx.fillStyle = '#7d5535';
  ctx.beginPath(); ctx.ellipse(72, 162, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c89b6d';
  ctx.beginPath(); ctx.ellipse(72, 159, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8ad80';
  ctx.beginPath(); ctx.ellipse(70, 157, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
  // papeles y planta
  rect(ctx, 58, 154, 8, 6, '#eef2f5'); rect(ctx, 59, 156, 5, 1, '#9aa3ad'); rect(ctx, 59, 158, 4, 1, '#9aa3ad');
  if (G.laptop) {
    rect(ctx, 74, 151, 12, 7, '#2b2b36'); rect(ctx, 75, 152, 10, 5, '#89b4fa');
    rect(ctx, 73, 158, 14, 2, '#9aa3ad');
  } else {
    rect(ctx, 78, 154, 6, 4, '#e85d75'); rect(ctx, 79, 152, 4, 2, '#3cb371');
  }
}
function drawStools(ctx) {
  for (const id of TABLE_SEATS) {
    const s = SPOTS[id];
    rect(ctx, s.x - 4, s.y - 3, 8, 4, '#55606b');
    rect(ctx, s.x - 4, s.y - 3, 8, 1, '#7d8792');
  }
}

function drawKitchen(ctx, t) {
  // encimera
  rect(ctx, 288, 206, 64, 18, '#6f7f8f');
  rect(ctx, 288, 204, 64, 4, '#d8d2c4');
  rect(ctx, 288, 204, 64, 1, '#ece7db');
  for (let i = 0; i < 4; i++) {
    rect(ctx, 290 + i * 16, 210, 14, 12, '#7f909f');
    rect(ctx, 296 + i * 16, 214, 2, 2, '#c0c8d0');
  }
  // cafetera
  rect(ctx, 304, 192, 14, 14, '#2b2b36');
  rect(ctx, 306, 194, 10, 4, '#55606b');
  rect(ctx, 309, 200, 4, 4, G.coffeeBrewing ? '#6b3b1d' : '#1a1a24');
  rect(ctx, 314, 195, 1, 1, G.coffeeBrewing ? '#2fbf71' : '#e83b3b');
  // fregadero y frutero
  rect(ctx, 324, 202, 14, 4, '#9aa3ad'); rect(ctx, 326, 203, 10, 2, '#7d8792');
  rect(ctx, 330, 197, 1, 5, '#c0c8d0');
  rect(ctx, 292, 200, 8, 4, '#c89b6d'); rect(ctx, 293, 198, 3, 3, '#e83b3b'); rect(ctx, 296, 198, 3, 3, '#f1c40f');
  // nevera
  rect(ctx, 352, 178, 32, 46, '#c8d2db');
  rect(ctx, 353, 179, 30, 44, '#dfe7ee');
  rect(ctx, 353, 196, 30, 1, '#9aa3ad');
  if (G.fridgeOpen) {
    rect(ctx, 354, 198, 26, 24, '#f8fbff');
    rect(ctx, 356, 204, 8, 4, '#e85d75'); rect(ctx, 366, 203, 5, 6, '#2fbf71'); rect(ctx, 373, 205, 6, 3, '#f2b134');
    rect(ctx, 354, 210, 26, 1, '#c8d2db'); rect(ctx, 357, 213, 6, 6, '#ffffff'); rect(ctx, 366, 214, 10, 4, '#f1c40f');
    rect(ctx, 340, 197, 12, 26, '#c8d2db');
  } else {
    rect(ctx, 356, 200, 2, 10, '#9aa3ad'); rect(ctx, 356, 186, 2, 6, '#9aa3ad');
    rect(ctx, 366, 184, 4, 4, '#f48fb1'); rect(ctx, 372, 186, 4, 4, '#80deea');
  }
}

function drawArcade(ctx, t) {
  const x = 368, y = 100;
  rect(ctx, x, y, 16, 44, '#3b2a7a');
  rect(ctx, x, y, 16, 6, '#e85d75');
  rect(ctx, x + 2, y + 1, 12, 3, Math.floor(t / 400) % 2 ? '#ffe066' : '#f2b134');
  rect(ctx, x + 2, y + 9, 12, 12, '#0b0b14');
  const on = G.arcade.on;
  if (on) {
    rect(ctx, x + 3, y + 10, 10, 10, '#101040');
    const p = Math.floor(t / 120) % 8;
    rect(ctx, x + 4 + p, y + 17, 2, 2, '#ffe066');
    for (let i = 0; i < 3; i++) rect(ctx, x + 4 + i * 3, y + 11 + ((p + i) % 4), 2, 1, '#e83b3b');
  } else {
    if (Math.floor(t / 700) % 2) rect(ctx, x + 4, y + 14, 8, 2, '#c77dff');
  }
  rect(ctx, x, y + 22, 16, 6, '#2b1d5a');
  rect(ctx, x + 3, y + 23, 2, 2, '#e83b3b'); rect(ctx, x + 8, y + 24, 2, 2, '#3b7be8'); rect(ctx, x + 11, y + 23, 2, 2, '#2fbf71');
  rect(ctx, x + 2, y + 30, 12, 2, '#e85d75');
  rect(ctx, x, y + 42, 16, 2, '#1d1540');
}

function drawRadio(ctx, t) {
  const x = 224, y = 204;
  rect(ctx, x + 1, y + 6, 14, 14, '#6b4226');
  rect(ctx, x + 1, y + 6, 14, 2, '#8a5a36');
  rect(ctx, x, y, 16, 7, '#2b2b36');
  ctx.fillStyle = '#1a1a24';
  ctx.beginPath(); ctx.ellipse(x + 7, y + 3, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  if (G.radio.on) {
    const a = t / 150;
    rect(ctx, x + 7 + Math.round(Math.cos(a) * 3), y + 3 + Math.round(Math.sin(a) * 1), 1, 1, '#e85d75');
  }
  rect(ctx, x + 13, y + 1, 1, 4, '#9aa3ad');
}

function drawBeanbag(ctx) {
  ctx.fillStyle = '#b97d22';
  ctx.beginPath(); ctx.ellipse(128, 202, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0a33a';
  ctx.beginPath(); ctx.ellipse(127, 200, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
  rect(ctx, 120, 198, 4, 1, '#f2c062');
}

function drawCatBed(ctx) {
  ctx.fillStyle = '#4b3f72';
  ctx.beginPath(); ctx.ellipse(168, 216, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a6bb0';
  ctx.beginPath(); ctx.ellipse(168, 216, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  rect(ctx, 176, 218, 4, 3, '#e8e8e8'); rect(ctx, 177, 219, 2, 1, '#c0623b');
}

// Lista de objetos con su "y de base" para ordenar con los personajes
const FURNITURE = [
  { y: 64, draw: (c) => drawShelf(c, 16, 48, G.booksOut.shelfA, 1) },
  { y: 64, draw: (c) => drawShelf(c, 64, 32, G.booksOut.shelfB, 2) },
  { y: 63, draw: (c) => drawPlant(c, 104, 62, false) },
  { y: 64, draw: (c, t) => drawTV(c, t) },
  { y: 64, draw: (c, t) => drawDesk(c, t) },
  { y: 79, draw: (c) => drawChair(c) },
  { y: 63, draw: (c) => drawPlant(c, 360, 62, true) },
  { y: 129, draw: (c) => drawSofa(c) },
  { y: 129, draw: (c) => drawArmchair(c) },
  { y: 150, draw: (c) => drawStools(c), flat: true },
  { y: 172, draw: (c) => drawTable(c) },
  { y: 224, draw: (c, t) => drawKitchen(c, t) },
  { y: 144, draw: (c, t) => drawArcade(c, t) },
  { y: 224, draw: (c, t) => drawRadio(c, t) },
  { y: 205, draw: (c) => drawBeanbag(c), flat: true },
  { y: 205, draw: (c) => drawCatBed(c), flat: true },
  { y: 222, draw: (c) => drawPlant(c, 8, 222, true) },
];

// ------------------------------------------------------------
//  Iluminación día/noche
// ------------------------------------------------------------
function darkness() {
  const h = hourNow();
  if (h >= 7.5 && h < 18.5) return 0;
  if (h >= 18.5 && h < 21) return (h - 18.5) / 2.5 * 0.55;
  if (h >= 21 || h < 5.5) return 0.55;
  return (7.5 - h) / 2 * 0.55;
}

function drawLighting(ctx, t) {
  const d = darkness();
  if (d <= 0.01) return;
  ctx.fillStyle = `rgba(12,10,45,${d})`;
  ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace('A', String(a * d * 1.6)));
    g.addColorStop(1, col.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(280, 84, 46, 'rgba(255,200,110,A)', 0.55);
  glow(308, 30, 26, 'rgba(255,200,110,A)', 0.4);
  if (G.tv.mode !== 'off') glow(200, 34, 50, 'rgba(120,160,255,A)', 0.5);
  if (G.pc.mode !== 'idle') glow(329, 32, 26, 'rgba(140,180,255,A)', 0.4);
  glow(376, 112, 22, 'rgba(200,120,255,A)', 0.35);
  for (let i = 0; i < 24; i += 2) glow(10 + i * 16, 5, 10, 'rgba(255,180,120,A)', 0.25);
  if (G.fridgeOpen) glow(366, 206, 24, 'rgba(220,240,255,A)', 0.5);
  ctx.globalCompositeOperation = 'source-over';
}
