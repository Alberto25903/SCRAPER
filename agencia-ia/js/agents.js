'use strict';
// ============================================================
//  Personajes: movimiento, acciones asíncronas y sprites
// ============================================================

// Base para cualquier cosa que se mueve por la sala (agentes y gato)
class Mover {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.face = 'down';
    this.path = [];
    this.moveOp = null;
    this.timers = [];
    this.ops = new Set();
    this.anim = 0;
    this.walking = false;
    this.speedPx = 40;
  }
  _op(fn) {
    return new Promise((res, rej) => {
      const op = {
        res: (v) => { this.ops.delete(op); res(v); },
        rej: (e) => { this.ops.delete(op); rej(e); },
      };
      this.ops.add(op);
      fn(op);
    });
  }
  wait(ms) {
    return this._op((op) => { op.t = G.sim + ms; this.timers.push(op); });
  }
  walkPoints(points) {
    return this._op((op) => {
      this.path = points.slice();
      this.moveOp = op;
      if (!this.path.length) { this.moveOp = null; op.res(); }
    });
  }
  moveToTile(tx, ty) {
    const path = findPath(tileOf(this.x), tileOf(this.y), tx, ty);
    return this.walkPoints(path.map((p) => ({ x: center(p.x), y: p.y * TILE + 12 })));
  }
  cancelAll() {
    for (const op of [...this.ops]) op.rej(new CancelError());
    this.ops.clear();
    this.timers = [];
    this.path = [];
    this.moveOp = null;
  }
  updateMotion(dt) {
    // temporizadores
    if (this.timers.length) {
      const due = this.timers.filter((op) => G.sim >= op.t);
      if (due.length) {
        this.timers = this.timers.filter((op) => G.sim < op.t);
        for (const op of due) op.res();
      }
    }
    // desplazamiento
    if (this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speedPx * dt / 1000;
      if (Math.abs(dx) > Math.abs(dy)) this.face = dx > 0 ? 'right' : 'left';
      else if (dist > 0.5) this.face = dy > 0 ? 'down' : 'up';
      if (dist <= step) {
        this.x = p.x; this.y = p.y;
        this.path.shift();
        if (!this.path.length && this.moveOp) {
          const op = this.moveOp; this.moveOp = null; op.res();
        }
      } else {
        this.x += dx / dist * step;
        this.y += dy / dist * step;
      }
      this.anim += step;
      this.walking = true;
    } else {
      this.walking = false;
    }
  }
}

// ------------------------------------------------------------
//  Agentes IA
// ------------------------------------------------------------
const AGENT_DEFS = [
  {
    id: 'nova', name: 'Nova', role: 'Investigadora',
    color: '#9b6bff',
    personality: 'curiosa, meticulosa y amante de los libros y los datos; habla con calma y siempre pide fuentes',
    look: { skin: '#f1c7a3', hair: '#c9b6ff', hairD: '#9d86e0', shirt: '#7b4dd6', shirtD: '#5e36ad', pants: '#2b2b4a', acc: 'glasses' },
    prefs: { leer: 3, ventana: 1.6, cafe: 1.5, gato: 1.3, tele: 1, pizarra: 0.8, consola: 0.6, arcade: 0.5, musica: 0.9, regar: 1, ordenador: 1.1, charlar: 1.2, snack: 1, pasear: 0.8 },
    start: { x: 40, y: 92 },
  },
  {
    id: 'byte', name: 'Byte', role: 'Ingeniero',
    color: '#2fbf71',
    personality: 'pragmático, bromista y fan de los videojuegos retro; piensa en soluciones técnicas y prototipos',
    look: { skin: '#c68c5a', hair: '#2b1d14', hairD: '#1a110b', shirt: '#2a8f5a', shirtD: '#1e6b43', pants: '#33334d', acc: 'cap', cap: '#2fbf71', capD: '#1e8a50' },
    prefs: { consola: 3, arcade: 2.6, ordenador: 2, snack: 1.6, tele: 1.2, cafe: 1.2, charlar: 1, gato: 0.8, leer: 0.6, musica: 1, regar: 0.4, pizarra: 0.7, ventana: 0.5, pasear: 0.8 },
    start: { x: 200, y: 92 },
  },
  {
    id: 'luma', name: 'Luma', role: 'Estratega creativa',
    color: '#ff8a4c',
    personality: 'creativa, entusiasta y sociable; coordina al equipo, busca el ángulo humano y resume con claridad',
    look: { skin: '#9a6440', hair: '#ff7a3d', hairD: '#d85f28', shirt: '#e85d75', shirtD: '#c24259', pants: '#3b2f5c', acc: 'phones' },
    prefs: { musica: 2.6, charlar: 2.4, regar: 2, pizarra: 2, gato: 1.6, tele: 1.2, cafe: 1, ventana: 1.2, consola: 1, leer: 1, arcade: 0.8, snack: 1, ordenador: 0.7, pasear: 1 },
    start: { x: 330, y: 160 },
  },
];

class Agent extends Mover {
  constructor(def) {
    super(def.start.x, def.start.y);
    Object.assign(this, def);
    this.pose = 'stand';
    this.held = null;
    this.emote = null;
    this.thinking = false;
    this.talking = false;
    this.dancing = false;
    this.needs = { energy: rand(65, 90), fun: rand(40, 70), social: rand(45, 75), hunger: rand(55, 85) };
    this.effect = null;
    this.mode = 'free';        // free | task
    this.running = null;       // promesa de la actividad libre actual
    this.activity = 'Llegando a la oficina';
    this.activityId = null;
    this.task = null;
    this.spot = null;
    this.inSpot = false;
    this.memory = [];          // tareas recientes
    this.runSeq = 0;           // identifica quién controla al agente
    this.chatWith = null;
    this.blinkAt = G.sim + rand(1000, 4000);
    this.lastSaid = '';
  }

  // --- puntos de interacción ---
  async goToSpot(spot) {
    if (this.spot && this.spot !== spot) await this.leaveSpot();
    if (spot.occupant && spot.occupant !== this && spot.occupant.mode === 'free' && this.mode === 'task') {
      spot.occupant.interrupt(true);
    }
    this.spot = spot;
    spot.occupant = this;
    if (this.inSpot && Math.hypot(this.x - spot.x, this.y - spot.y) < 1) return;
    this.pose = 'stand';
    this.inSpot = false;
    await this.moveToTile(spot.tx, spot.ty);
    this.inSpot = true;
    await this.walkPoints([{ x: spot.x, y: spot.y }]);
    this.face = spot.face;
    this.pose = spot.pose || 'stand';
  }
  async leaveSpot() {
    const s = this.spot;
    if (!s) return;
    this.spot = null;
    if (s.occupant === this) s.occupant = null;
    this.pose = 'stand';
    this.dancing = false;
    if (this.inSpot) {
      this.inSpot = false;
      await this.walkPoints([{ x: center(s.tx), y: s.ty * TILE + 12 }]);
    }
  }
  releaseSpot() {
    if (this.spot && this.spot.occupant === this) this.spot.occupant = null;
  }

  // Acercarse a otro personaje y mirarle
  async goNear(other) {
    if (this.spot) await this.leaveSpot();
    const otx = tileOf(other.x), oty = tileOf(other.y);
    const cands = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [2, 0], [-2, 0]]
      .map(([dx, dy]) => ({ x: otx + dx, y: oty + dy }))
      .filter((c) => walkable(c.x, c.y) && !G.agents.some((a) => a !== this && tileOf(a.x) === c.x && tileOf(a.y) === c.y));
    const target = cands.length
      ? cands.sort((a, b) => Math.hypot(a.x - tileOf(this.x), a.y - tileOf(this.y)) - Math.hypot(b.x - tileOf(this.x), b.y - tileOf(this.y)))[0]
      : nearestWalkable(otx, oty + 1);
    await this.moveToTile(target.x, target.y);
    this.faceTo(other);
  }
  faceTo(other) {
    const dx = other.x - this.x, dy = other.y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.face = dx > 0 ? 'right' : 'left';
    else this.face = dy > 0 ? 'down' : 'up';
  }

  // --- expresión ---
  async say(text, ms) {
    text = String(text || '').trim();
    if (!text) return;
    const dur = ms || clamp(1800 + text.length * 50, 2400, 11000);
    this.talking = true;
    this.lastSaid = text;
    UI.bubble(this, text, dur);
    UI.logSay(this, text);
    try { await this.wait(dur); }
    finally { this.talking = false; UI.clearBubble(this); }
  }
  // Frase corta sin bloquear (pensamiento en voz alta)
  mutter(text, ms = 2600) {
    UI.bubble(this, text, ms, true);
  }
  emoteFor(icon, ms = 1600) {
    this.emote = { icon, until: G.sim + ms };
  }

  interrupt(polite) {
    this.cancelAll();
    this.thinking = false;
    this.talking = false;
    this.dancing = false;
    this.effect = null;
    UI.clearBubble(this);
    if (polite) this.emoteFor('!', 1200);
  }

  update(dt) {
    this.updateMotion(dt);
    // necesidades
    const s = dt / 1000;
    const night = hourNow() >= 22 || hourNow() < 6;
    const decay = { energy: night ? -0.35 : -0.12, fun: -0.28, social: -0.2, hunger: -0.14 };
    if (this.mode === 'task') { decay.energy -= 0.12; decay.fun -= 0.05; decay.social += 0.35; }
    for (const k in this.needs) {
      const gain = this.effect && this.effect[k] ? this.effect[k] : 0;
      this.needs[k] = clamp(this.needs[k] + (decay[k] + gain) * s, 0, 100);
    }
    if (this.pose === 'lie' && chance(dt / 1400)) spawnParticle(this.x - 6, this.y - 12, 'z', { vy: -8, vx: 3, life: 1800 });
    if (this.dancing && chance(dt / 900)) spawnParticle(this.x, this.y - 22, 'note', { color: this.color });
    if (this.emote && G.sim > this.emote.until) this.emote = null;
  }

  mood() {
    const n = this.needs;
    const avg = (n.energy + n.fun + n.social + n.hunger) / 4;
    if (n.energy < 20) return { icon: '😴', text: this.id === 'byte' ? 'Agotado' : 'Agotada' };
    if (n.hunger < 20) return { icon: '🍕', text: 'Hambre' };
    if (avg > 70) return { icon: '😄', text: 'Genial' };
    if (avg > 50) return { icon: '🙂', text: 'Bien' };
    if (avg > 30) return { icon: '😐', text: 'Regular' };
    return { icon: '😩', text: 'Necesita un descanso' };
  }
}

// ------------------------------------------------------------
//  Dibujo de los agentes
// ------------------------------------------------------------
function drawAgent(ctx, a, t) {
  const fx = Math.round(a.x), fy = Math.round(a.y);
  const L = a.look;
  if (a.pose === 'lie') { drawAgentLying(ctx, a, fx, fy, t); drawOverhead(ctx, a, fx, fy - 10, t); return; }
  const sit = a.pose === 'sit';
  const step = a.walking ? Math.floor(a.anim / 5) % 2 : 0;
  const hop = a.dancing ? Math.round(Math.abs(Math.sin(t / 160)) * 2) : 0;
  const top = fy - 20 + (sit ? 3 : 0) - hop;
  const f = a.face;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(fx - 4, fy - 1, 9, 2);

  // piernas
  if (!sit) {
    const ly = top + 15;
    const l1 = step ? 1 : 0, l2 = step ? 0 : (a.walking ? 1 : 0);
    rect(ctx, fx - 3, ly, 2, 4 - l1, L.pants); rect(ctx, fx - 3, ly + 4 - l1, 2, 1, '#1a1a24');
    rect(ctx, fx + 1, ly, 2, 4 - l2, L.pants); rect(ctx, fx + 1, ly + 4 - l2, 2, 1, '#1a1a24');
  } else if (f === 'down' || f === 'left' || f === 'right') {
    const ly = top + 15;
    const dx = f === 'left' ? -2 : f === 'right' ? 2 : 0;
    rect(ctx, fx - 3 + dx, ly, 6, 2, L.pants);
    rect(ctx, fx - 3 + dx + (f === 'right' ? 4 : 0), ly + 2, 2, 1, '#1a1a24');
  }
  // cuerpo
  rect(ctx, fx - 4, top + 8, 8, 7, L.shirt);
  rect(ctx, fx - 4, top + 14, 8, 1, L.shirtD);
  if (L.acc === 'cap' && f === 'down') rect(ctx, fx - 1, top + 9, 2, 3, L.shirtD); // cordones de la sudadera
  // brazos
  const swing = a.walking ? (step ? 1 : -1) : 0;
  if (f === 'down' || f === 'up') {
    rect(ctx, fx - 5, top + 9 + swing, 1, 5, L.shirtD); rect(ctx, fx - 5, top + 13 + swing, 1, 1, L.skin);
    rect(ctx, fx + 4, top + 9 - swing, 1, 5, L.shirtD); rect(ctx, fx + 4, top + 13 - swing, 1, 1, L.skin);
  } else {
    const ax = f === 'left' ? fx - 1 : fx;
    rect(ctx, ax, top + 9, 1, 5, L.shirtD); rect(ctx, ax + swing, top + 13, 1, 1, L.skin);
  }
  // brazo alzado (escribiendo en la pizarra)
  if (a.held === 'marker' && f === 'up') {
    const wob = Math.round(Math.sin(t / 90) * 1.5);
    rect(ctx, fx + 4 + wob, top + 1, 1, 8, L.shirtD); rect(ctx, fx + 4 + wob, top, 1, 1, L.skin);
  }
  // cabeza
  rect(ctx, fx - 4, top, 8, 8, L.skin);
  drawHair(ctx, a, fx, top, f);
  // cara
  if (f !== 'up') {
    const blink = G.sim > a.blinkAt && G.sim < a.blinkAt + 140;
    if (G.sim > a.blinkAt + 140) a.blinkAt = G.sim + rand(2000, 5000);
    const eh = blink ? 1 : 2;
    const ey = top + 4 + (blink ? 1 : 0);
    if (f === 'down') { rect(ctx, fx - 2, ey, 1, eh, '#1b1b2b'); rect(ctx, fx + 1, ey, 1, eh, '#1b1b2b'); }
    else if (f === 'left') rect(ctx, fx - 3, ey, 1, eh, '#1b1b2b');
    else rect(ctx, fx + 2, ey, 1, eh, '#1b1b2b');
    if (L.acc === 'glasses') {
      if (f === 'down') {
        ctx.strokeStyle = '#2b2b3b'; ctx.lineWidth = 1;
        ctx.strokeRect(fx - 3.5, top + 3.5, 3, 3); ctx.strokeRect(fx + 0.5, top + 3.5, 3, 3);
      } else {
        ctx.strokeStyle = '#2b2b3b'; ctx.lineWidth = 1;
        ctx.strokeRect((f === 'left' ? fx - 4.5 : fx + 1.5), top + 3.5, 3, 3);
      }
    }
    if (a.talking && Math.floor(t / 130) % 2) {
      if (f === 'down') rect(ctx, fx - 1, top + 7, 2, 1, '#7a2e2e');
      else rect(ctx, f === 'left' ? fx - 3 : fx + 2, top + 7, 1, 1, '#7a2e2e');
    }
    if (f === 'down' && a.needs.fun > 70 && !a.talking) rect(ctx, fx - 1, top + 7, 2, 1, '#00000030');
  }
  if (L.acc === 'phones') drawPhones(ctx, fx, top, f);
  // objetos en las manos
  if (a.held && f !== 'up') drawHeld(ctx, a.held, fx, top, f, t);
  drawOverhead(ctx, a, fx, top, t);
}

function drawHair(ctx, a, fx, top, f) {
  const L = a.look;
  if (L.acc === 'glasses') {           // Nova: melena larga
    rect(ctx, fx - 5, top - 1, 10, 3, L.hair);
    if (f === 'up') { rect(ctx, fx - 5, top - 1, 10, 12, L.hair); rect(ctx, fx - 4, top + 9, 8, 2, L.hairD); }
    else if (f === 'down') { rect(ctx, fx - 5, top + 1, 2, 10, L.hair); rect(ctx, fx + 3, top + 1, 2, 10, L.hair); rect(ctx, fx - 3, top + 2, 3, 1, L.hairD); }
    else if (f === 'left') { rect(ctx, fx + 1, top, 4, 11, L.hair); rect(ctx, fx - 5, top + 1, 3, 2, L.hair); }
    else { rect(ctx, fx - 5, top, 4, 11, L.hair); rect(ctx, fx + 2, top + 1, 3, 2, L.hair); }
  } else if (L.acc === 'cap') {        // Byte: gorra
    rect(ctx, fx - 4, top + 1, 8, 3, L.hair);
    if (f === 'up') rect(ctx, fx - 4, top + 1, 8, 6, L.hair);
    rect(ctx, fx - 5, top - 1, 10, 3, L.cap);
    rect(ctx, fx - 4, top - 2, 8, 1, L.cap);
    rect(ctx, fx - 1, top - 1, 2, 1, '#ffffff');
    if (f === 'down') rect(ctx, fx - 4, top + 2, 8, 1, L.capD);
    else if (f === 'left') rect(ctx, fx - 7, top + 1, 4, 1, L.capD);
    else if (f === 'right') rect(ctx, fx + 3, top + 1, 4, 1, L.capD);
  } else {                              // Luma: moño
    rect(ctx, fx - 4, top - 1, 8, 3, L.hair);
    rect(ctx, fx - 2, top - 4, 4, 3, L.hair); rect(ctx, fx - 1, top - 4, 2, 1, L.hairD);
    if (f === 'up') rect(ctx, fx - 4, top - 1, 8, 7, L.hair);
    else if (f === 'down') { rect(ctx, fx - 4, top + 1, 1, 4, L.hair); rect(ctx, fx + 3, top + 1, 1, 4, L.hair); rect(ctx, fx - 2, top + 2, 4, 1, L.hairD); }
    else if (f === 'left') rect(ctx, fx + 1, top, 3, 5, L.hair);
    else rect(ctx, fx - 4, top, 3, 5, L.hair);
  }
}

function drawPhones(ctx, fx, top, f) {
  rect(ctx, fx - 5, top - 2, 10, 1, '#2b2b3b');
  if (f === 'down' || f === 'up') {
    rect(ctx, fx - 6, top + 2, 2, 4, '#f2b134'); rect(ctx, fx + 4, top + 2, 2, 4, '#f2b134');
  } else {
    rect(ctx, f === 'left' ? fx : fx - 2, top + 2, 2, 4, '#f2b134');
  }
}

function drawHeld(ctx, item, fx, top, f, t) {
  const hx = f === 'left' ? fx - 4 : f === 'right' ? fx + 1 : fx - 3;
  const hy = top + 11;
  switch (item) {
    case 'book':
      rect(ctx, hx, hy - 1, 6, 4, '#b05a3b'); rect(ctx, hx + 1, hy, 4, 2, '#f4ecd8'); rect(ctx, hx + 3, hy - 1, 1, 4, '#7a3b26');
      break;
    case 'controller':
      rect(ctx, hx, hy + 1, 6, 2, '#d9dde2'); rect(ctx, hx + 1, hy + 1, 1, 1, '#2b2b3b');
      rect(ctx, hx + 4, hy + 1, 1, 1, Math.floor(t / 200) % 2 ? '#e83b3b' : '#3b7be8');
      break;
    case 'mug':
      rect(ctx, hx + 4, hy, 3, 3, '#eef2f5'); rect(ctx, hx + 7, hy + 1, 1, 1, '#eef2f5');
      if (Math.floor(t / 300) % 3 === 0) rect(ctx, hx + 5, hy - 2, 1, 1, '#ffffffaa');
      break;
    case 'can':
      rect(ctx, hx + 3, hy, 4, 3, '#3b9be8'); rect(ctx, hx + 7, hy - 1, 2, 1, '#3b9be8');
      break;
    case 'food':
      rect(ctx, hx + 3, hy, 4, 3, '#f2b134'); rect(ctx, hx + 3, hy + 1, 4, 1, '#3cb371');
      break;
    case 'laptop':
      rect(ctx, hx - 1, hy, 8, 3, '#2b2b36'); rect(ctx, hx, hy, 6, 1, '#89b4fa');
      break;
    case 'notes':
      rect(ctx, hx, hy, 5, 4, '#fff176'); rect(ctx, hx + 1, hy + 1, 3, 1, '#9aa3ad');
      break;
    case 'marker':
      rect(ctx, hx + 5, hy - 1, 1, 3, '#e83b3b');
      break;
  }
}

function drawAgentLying(ctx, a, fx, fy, t) {
  const L = a.look;
  const y = fy - 9;
  rect(ctx, fx - 3, y + 1, 9, 6, L.shirt);
  rect(ctx, fx + 6, y + 2, 5, 4, L.pants);
  rect(ctx, fx + 11, y + 2, 1, 4, '#1a1a24');
  rect(ctx, fx - 11, y, 8, 8, L.skin);
  rect(ctx, fx - 9, y + 4, 2, 1, '#1b1b2b'); rect(ctx, fx - 6, y + 4, 2, 1, '#1b1b2b');
  if (L.acc === 'cap') { rect(ctx, fx - 12, y - 1, 3, 9, L.cap); }
  else if (L.acc === 'glasses') { rect(ctx, fx - 13, y - 1, 4, 11, L.hair); }
  else { rect(ctx, fx - 13, y, 3, 8, L.hair); rect(ctx, fx - 15, y + 2, 2, 4, L.hair); }
  const breathe = Math.floor(t / 700) % 2;
  rect(ctx, fx - 3, y + 1 - breathe, 9, 1, L.shirtD);
}

function drawOverhead(ctx, a, fx, top, t) {
  // indicador de selección
  if (G.selected === a) {
    const b = Math.round(Math.sin(t / 180) * 1.5);
    const y = top - 12 + b - (a.emote || a.thinking ? 11 : 0);
    rect(ctx, fx - 2, y, 5, 1, a.color); rect(ctx, fx - 1, y + 1, 3, 1, a.color); rect(ctx, fx, y + 2, 1, 1, a.color);
  }
  // emoción o "pensando..."
  let icon = null, color;
  if (a.thinking) icon = 'think';
  else if (a.emote) icon = a.emote.icon;
  if (!icon) return;
  const bx = fx - 5, by = top - 12;
  rect(ctx, bx, by, 11, 10, '#ffffff');
  rect(ctx, bx - 1, by + 1, 1, 8, '#ffffff'); rect(ctx, bx + 11, by + 1, 1, 8, '#ffffff');
  rect(ctx, fx - 1, by + 10, 3, 1, '#ffffff'); rect(ctx, fx, by + 11, 1, 1, '#ffffff');
  if (icon === 'think') {
    const n = Math.floor(t / 300) % 4;
    for (let i = 0; i < 3; i++) rect(ctx, bx + 2 + i * 3, by + 5, 1, 1, i < n ? a.color : '#c8c8d0');
  } else {
    drawIcon(ctx, icon, bx + 3, by + 2, color);
  }
}

// ------------------------------------------------------------
//  El gato de la oficina: "Bit"
// ------------------------------------------------------------
class Cat extends Mover {
  constructor() {
    super(168, 214);
    this.speedPx = 30;
    this.state = 'sleep';
    this.running = null;
    this.petted = 0;
    this.name = 'Bit';
  }
  update(dt) {
    this.updateMotion(dt);
    if (this.state === 'sleep' && chance(dt / 2200)) spawnParticle(this.x + 3, this.y - 8, 'z', { vy: -6, life: 1500, color: '#8c8cb0' });
    if (!this.running) {
      this.running = this.life().catch(() => {}).finally(() => { this.running = null; });
    }
  }
  async life() {
    const r = Math.random();
    if (r < 0.35) {
      this.state = 'walk';
      await this.moveToTile(10, 12);
      await this.walkPoints([{ x: 168, y: 214 }]);
      this.state = 'sleep';
      await this.wait(rand(20000, 45000));
    } else if (r < 0.6) {
      // seguir a alguien
      const target = pick(G.agents);
      this.state = 'walk';
      await this.moveToTile(tileOf(target.x) + (chance(0.5) ? 1 : -1), tileOf(target.y) + 1);
      this.state = 'sit';
      if (chance(0.4)) UI.bubble(this, pick(['miau', 'miau~', 'mrrr', '¡MIAU!']), 1500, true);
      await this.wait(rand(4000, 9000));
    } else {
      this.state = 'walk';
      const tx = randi(1, 22), ty = randi(4, 12);
      await this.moveToTile(tx, ty);
      this.state = chance(0.5) ? 'sit' : 'groom';
      await this.wait(rand(3000, 8000));
    }
  }
  async getPetted() {
    this.cancelAll();
    this.state = 'sit';
    this.petted = G.sim + 4000;
    for (let i = 0; i < 4; i++) spawnParticle(this.x + rand(-4, 4), this.y - 8, 'heart', { life: 1400 });
    UI.bubble(this, pick(['prrrr', 'mrrr~', 'prrr prrr']), 2000, true);
  }
}

function drawCat(ctx, c, t) {
  const x = Math.round(c.x), y = Math.round(c.y);
  const body = '#8c8c9c', dark = '#5e5e70', light = '#c8c8d4';
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 5, y - 1, 11, 2);
  if (c.state === 'sleep') {
    rect(ctx, x - 5, y - 5, 10, 5, body);
    rect(ctx, x - 4, y - 6, 8, 1, body);
    rect(ctx, x - 3, y - 5, 1, 4, dark); rect(ctx, x, y - 5, 1, 4, dark);
    rect(ctx, x + 3, y - 6, 4, 4, body); rect(ctx, x + 3, y - 7, 1, 1, body); rect(ctx, x + 6, y - 7, 1, 1, body);
    rect(ctx, x + 4, y - 4, 2, 1, dark);
    rect(ctx, x - 6, y - 2, 6, 1, dark);
    return;
  }
  const faceL = c.face === 'left';
  const dir = faceL ? -1 : 1;
  const sitting = c.state === 'sit' || c.state === 'groom';
  if (sitting) {
    rect(ctx, x - 3, y - 7, 6, 7, body);
    rect(ctx, x - 2, y - 6, 1, 4, dark);
    rect(ctx, x - 3, y - 12, 6, 5, body);
    rect(ctx, x - 3, y - 13, 1, 1, body); rect(ctx, x + 2, y - 13, 1, 1, body);
    const blink = Math.floor(t / 1800) % 5 === 0;
    if (c.state === 'groom' && Math.floor(t / 300) % 2) rect(ctx, x - 1, y - 8, 2, 2, light);
    rect(ctx, x - 2, y - 10, 1, blink ? 0 : 1, '#2fbf71'); rect(ctx, x + 1, y - 10, 1, blink ? 0 : 1, '#2fbf71');
    rect(ctx, x, y - 9, 1, 1, '#e8a0a0');
    const tw = Math.round(Math.sin(t / 250) * 1);
    rect(ctx, x + 3, y - 2 + tw, 4, 1, dark);
  } else {
    const step = Math.floor(c.anim / 3) % 2;
    rect(ctx, x - 5, y - 6, 10, 4, body);
    rect(ctx, x - 2, y - 6, 1, 4, dark); rect(ctx, x + 1, y - 6, 1, 4, dark);
    rect(ctx, x - 4 + step, y - 2, 1, 2, dark); rect(ctx, x + 3 - step, y - 2, 1, 2, dark);
    const hx = faceL ? x - 9 : x + 4;
    rect(ctx, hx, y - 9, 5, 5, body);
    rect(ctx, hx, y - 10, 1, 1, body); rect(ctx, hx + 4, y - 10, 1, 1, body);
    rect(ctx, faceL ? hx + 1 : hx + 3, y - 8, 1, 1, '#2fbf71');
    const tx = faceL ? x + 5 : x - 8;
    rect(ctx, tx, y - 8 + (Math.floor(t / 200) % 2), 3, 1, dark); rect(ctx, faceL ? tx + 2 : tx, y - 7, 1, 2, dark);
  }
}
