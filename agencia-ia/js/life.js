'use strict';
// ============================================================
//  "Vida propia": necesidades, tiempo libre y charlas
// ============================================================

const LINES = {
  consola: {
    nova: ['Estadísticamente debería haber saltado...', 'Vale, ahora entiendo el patrón del jefe.', '¡He encontrado un atajo!'],
    byte: ['¡Speedrun mundial!', '¡NOOO, ese salto era perfecto!', 'Modo difícil o nada.', '¡Combo x12!'],
    luma: ['¡Mira qué colores tiene este nivel!', '¿Por qué el champiñón me odia?', '¡Toma ya!'],
  },
  coop: ['¿Cooperativo? ¡Yo llevo el verde!', '¡Dame el segundo mando!', 'Vale, pero esta vez no me empujes al foso.'],
  tele: ['¿Otra vez este anuncio?', 'Este documental está genial.', 'Las noticias hablan de IA otra vez...', 'Uff, qué giro de guion.'],
  cheer: ['¡Vamos, vamos!', '¡Salta! ¡SALTA!', 'Uyyy, casi.', '¡Eso ha sido épico!'],
  leer: {
    nova: ['Fascinante: este capítulo cita 47 fuentes.', 'Apunto esto para luego...', 'Hmm, aquí el autor se contradice.', 'Ojalá todos los papers tuvieran gráficos así.'],
    byte: ['¿Este libro tiene ejemplos de código? ¿No?', 'Vale, el capítulo 3 sí mola.', 'Leer manuales es mi superpoder secreto.'],
    luma: ['Me encanta cómo está escrito.', 'Esto me da una idea para una campaña...', 'Qué ilustraciones tan bonitas.'],
  },
  ventana: {
    nova: ['¿Cuántas nubes caben en el cielo? Debería medirlo.', 'Hoy la luz entra preciosa.', 'Me pregunto qué estará investigando la gente ahí fuera.'],
    byte: ['Esa antena tiene pinta de 5G.', 'Necesito ver la luz del sol de vez en cuando, dicen.', 'Si los pájaros tuvieran wifi...'],
    luma: ['Qué ciudad tan bonita.', 'Me inspira mirar por la ventana.', 'Un día deberíamos hacer una reunión en la terraza.'],
  },
  cafe: ['Café: el combustible de la inteligencia.', 'Uno solito, que luego no duermo.', 'Mmm, recién hecho.', '¿Alguien más quiere café?'],
  snack: ['Picoteo estratégico.', '¿Quién se ha comido mi yogur?', 'Un sándwich para el cerebro.', 'Mmm, queda pizza de ayer.'],
  regar: ['Hola, plantita. ¿Tienes sed?', 'Crece, crece...', 'Esta hoja nueva es preciosa.'],
  arcade: ['¡Nuevo récord!', 'Una ficha más y lo dejo.', '¡Insert coin!', 'Esta máquina tiene más años que yo.'],
  musica: ['¡Temazo!', '¿Os gusta este disco?', 'Un poco de synthwave para trabajar mejor.', '♪ la la laaa ♪'],
  siesta: ['Cinco minutitos...', 'Recargando baterías...', 'Zzz... modo ahorro de energía.'],
  despertar: ['¡Como nueva!', '¡Batería al 100%!', '¿Cuánto he dormido?'],
  ordenador: ['Jajaja, este meme...', 'Leyendo foros de IA.', 'Actualizando drivers por placer.', 'Hmm, interesante hilo.'],
  pizarra: ['Un pequeño diagrama...', 'Y si conecto esto con esto...', 'Arte abstracto, se llama.'],
  gato: ['¿Quién es un gatito bueno?', 'Bit, eres el mejor compañero.', 'Hola, Bit.'],
  pasear: ['Hay que estirar las piernas.', 'Paseíto.', '*estira los brazos*'],
};

const CHATS = [
  [['a', '¿Has visto el nuevo modelo que han sacado?'], ['b', 'Sí, dicen que razona mejor que nosotros. Me siento amenazado.'], ['a', 'Tranquilo, nosotros tenemos sofá.']],
  [['a', 'El gato ha vuelto a dormir encima del teclado.'], ['b', 'Por eso hay un commit que pone "ggggggggg".']],
  [['a', '¿Pizza o sushi para la cena?'], ['b', 'Pizza. Siempre pizza.'], ['a', 'Lo apunto en el acta.']],
  [['a', '¿Qué estás leyendo últimamente?'], ['b', 'Un libro sobre cómo aprenden los humanos. Es fascinante.']],
  [['a', '¿Una partida a la consola luego?'], ['b', '¡Hecho! Pero esta vez sin trampas.'], ['a', 'Yo nunca hago trampas. Optimizo.']],
  [['a', '¿Te has fijado en lo bien que está la planta?'], ['b', 'Luma le habla todos los días. Funciona.']],
  [['a', 'A veces pienso que vivimos dentro de un videojuego.'], ['b', 'Bueno... técnicamente es así.'], ['a', '...'], ['b', 'Mejor no pensarlo.']],
  [['a', '¿Qué tal tu día?'], ['b', 'Productivo. Y con café, que es lo importante.']],
  [['a', 'Deberíamos poner más luces en la sala.'], ['b', '¡Sí! Y una máquina de palomitas.']],
  [['a', 'Me han dicho que mañana va a llover.'], ['b', 'Perfecto para quedarse leyendo.']],
];

const MEMORY_CHATS = [
  [['a', '¿Qué te pareció lo de «{task}»?'], ['b', 'Creo que nos quedó bastante bien. ¡Buen trabajo en equipo!']],
  [['a', 'Sigo dándole vueltas a lo de «{task}».'], ['b', 'Yo también. Quizá podríamos mejorarlo la próxima vez.']],
  [['a', 'Lo de «{task}» fue intenso, ¿eh?'], ['b', 'Un poco, pero me gustó. Hacemos buen equipo.']],
];

function shortTask(t, n = 40) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

// --- Estado compartido de la tele -------------------------------
G.tv.players = new Set();
G.tv.watchers = new Set();
G.tv.show = 'show';
function refreshTV() {
  G.tv.mode = G.tv.players.size ? 'game' : G.tv.watchers.size ? G.tv.show : 'off';
  G.tv.users = new Set([...G.tv.players, ...G.tv.watchers]);
}

async function loopFor(a, ms, every, fn) {
  const end = G.sim + ms;
  while (G.sim < end) {
    await a.wait(rand(every[0], every[1]));
    if (fn) fn();
  }
}

// ------------------------------------------------------------
//  Catálogo de actividades de tiempo libre
// ------------------------------------------------------------
const ACTIVITIES = [
  {
    id: 'consola', label: 'Jugando a la consola', gain: { fun: 3 },
    cond: () => freeSpot(SOFA_SEATS) && G.tv.watchers.size === 0,
    bonus: () => (G.tv.players.size ? 1.5 : 0),
    async run(a) {
      await a.goToSpot(freeSpot(SOFA_SEATS, a));
      a.held = 'controller';
      G.tv.players.add(a); refreshTV();
      a.effect = { fun: 3.2, energy: -0.1 };
      try {
        if (G.tv.players.size > 1) await a.say(pick(LINES.coop));
        await loopFor(a, rand(25000, 45000), [2500, 5000], () => {
          const r = Math.random();
          if (r < 0.3) a.emoteFor(pick(['!', 'star', 'anger', 'heart']));
          else if (r < 0.42) a.mutter(pick(LINES.consola[a.id]));
        });
      } finally {
        a.held = null; G.tv.players.delete(a); refreshTV();
      }
    },
  },
  {
    id: 'tele', label: 'Viendo la tele', gain: { fun: 1.6, energy: 0.5 },
    cond: () => freeSpot(SOFA_SEATS),
    bonus: () => (G.tv.players.size ? 0.8 : 0),
    async run(a) {
      await a.goToSpot(freeSpot(SOFA_SEATS, a));
      if (!G.tv.users.size) G.tv.show = pick(['show', 'news']);
      G.tv.watchers.add(a); refreshTV();
      a.effect = { fun: 1.8, energy: 0.5 };
      if (G.tv.players.size) a.activity = 'Animando la partida';
      try {
        await loopFor(a, rand(20000, 40000), [3000, 6000], () => {
          if (chance(0.3)) a.mutter(pick(G.tv.players.size ? LINES.cheer : LINES.tele));
          else if (chance(0.25)) a.emoteFor(pick(['?', '!', 'heart']));
        });
      } finally {
        G.tv.watchers.delete(a); refreshTV();
      }
    },
  },
  {
    id: 'leer', label: 'Leyendo un libro', gain: { fun: 2.2, energy: 0.3 },
    cond: () => freeSpot(['shelfA', 'shelfB']),
    async run(a) {
      const shelf = freeSpot(['shelfA', 'shelfB'], a);
      await a.goToSpot(shelf);
      a.activity = 'Eligiendo un libro';
      await a.wait(rand(1500, 3000));
      a.emoteFor('book', 1200);
      G.booksOut[shelf.id]++;
      a.held = 'book';
      try {
        const seat = SPOTS.armchair.occupant ? (freeSpot(TABLE_SEATS, a) || freeSpot(['beanbag'], a)) : SPOTS.armchair;
        if (seat) await a.goToSpot(seat);
        if (a.pose === 'lie') a.pose = 'sit';
        a.activity = 'Leyendo un libro';
        a.effect = { fun: 2.4, energy: 0.3 };
        await loopFor(a, rand(25000, 45000), [4000, 8000], () => {
          if (chance(0.35)) a.mutter(pick(LINES.leer[a.id]));
          else if (chance(0.3)) a.emoteFor(pick(['bulb', '?', 'heart']));
        });
        a.effect = null;
        a.activity = 'Devolviendo el libro';
        await a.goToSpot(shelf);
        await a.wait(1200);
      } finally {
        if (a.held === 'book') { a.held = null; G.booksOut[shelf.id] = Math.max(0, G.booksOut[shelf.id] - 1); }
      }
    },
  },
  {
    id: 'cafe', label: 'Tomando un café', gain: { energy: 4, fun: 0.5 },
    cond: () => !SPOTS.coffee.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.coffee);
      a.activity = 'Preparando café';
      G.coffeeBrewing = true;
      try {
        for (let i = 0; i < 6; i++) {
          spawnParticle(311 + rand(-1, 1), 194, 'steam', { vy: -10, vx: rand(-2, 2), life: 900 });
          await a.wait(500);
        }
      } finally { G.coffeeBrewing = false; }
      a.held = 'mug';
      a.emoteFor('cup', 1400);
      a.mutter(pick(LINES.cafe));
      try {
        const dest = chance(0.5) && !SPOTS.window.occupant ? SPOTS.window : null;
        if (dest) await a.goToSpot(dest);
        else { await a.leaveSpot(); await a.moveToTile(randi(14, 20), randi(9, 11)); a.face = 'down'; }
        a.activity = 'Tomando un café';
        a.effect = { energy: 5, fun: 0.6 };
        await loopFor(a, rand(10000, 18000), [3000, 5000], () => {
          spawnParticle(a.x + 4, a.y - 12, 'steam', { vy: -8, life: 800 });
        });
      } finally { a.held = null; }
    },
  },
  {
    id: 'snack', label: 'Picando algo', gain: { hunger: 8 },
    cond: () => !SPOTS.fridge.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.fridge);
      G.fridgeOpen = true;
      a.activity = 'Rebuscando en la nevera';
      try {
        await a.wait(2500);
        if (chance(0.3)) await a.say(pick(LINES.snack));
      } finally { G.fridgeOpen = false; }
      a.held = 'food';
      try {
        const seat = freeSpot(TABLE_SEATS, a);
        if (seat) await a.goToSpot(seat);
        a.activity = 'Comiendo algo';
        a.effect = { hunger: 9, fun: 0.6, energy: 0.6 };
        await loopFor(a, rand(9000, 15000), [2500, 4000], () => { if (chance(0.3)) a.emoteFor('heart'); });
      } finally { a.held = null; }
    },
  },
  {
    id: 'regar', label: 'Regando las plantas', gain: { fun: 1.2 },
    cond: () => true,
    async run(a) {
      a.held = 'can';
      a.effect = { fun: 1.4 };
      try {
        const plants = shuffle(['plant1', 'plant2', 'plant3']).slice(0, 2).filter((p) => !SPOTS[p].occupant);
        for (const p of plants) {
          await a.goToSpot(SPOTS[p]);
          for (let i = 0; i < 5; i++) {
            spawnParticle(a.x + (a.face === 'left' ? -8 : 0), a.y - 12, 'drop', { vy: 12, vx: a.face === 'left' ? -6 : 0, life: 700 });
            await a.wait(400);
          }
          spawnParticle(a.x + (a.face === 'left' ? -12 : 0), a.y - 26, 'heart', { life: 1400, color: '#3cb371' });
          if (chance(0.5)) a.mutter(pick(LINES.regar));
          await a.wait(1200);
        }
      } finally { a.held = null; }
    },
  },
  {
    id: 'arcade', label: 'Jugando a la recreativa', gain: { fun: 3.4 },
    cond: () => !SPOTS.arcade.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.arcade);
      G.arcade.on = true;
      a.effect = { fun: 3.6, energy: -0.15 };
      try {
        await loopFor(a, rand(18000, 32000), [2500, 4500], () => {
          if (chance(0.3)) a.emoteFor(pick(['!', 'star', 'anger']));
          else if (chance(0.2)) a.mutter(pick(LINES.arcade));
          for (let i = 0; i < 3; i++) spawnParticle(370, 112, 'spark', { color: pick(['#ffe066', '#e85d75', '#89b4fa']), vx: rand(-10, 2), life: 600 });
        });
      } finally { G.arcade.on = false; }
    },
  },
  {
    id: 'musica', label: 'Poniendo música', gain: { fun: 2.2, social: 0.6 },
    cond: () => !SPOTS.radio.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.radio);
      G.radio.on = true;
      G.radio.until = G.sim + rand(50000, 80000);
      a.mutter(pick(LINES.musica));
      await a.wait(1500);
      a.activity = 'Bailando';
      a.dancing = true;
      a.effect = { fun: 2.6, social: 0.6, energy: -0.2 };
      try {
        await loopFor(a, rand(12000, 22000), [1500, 3000], () => {
          a.face = pick(['down', 'left', 'right', 'down']);
        });
      } finally { a.dancing = false; }
    },
  },
  {
    id: 'ventana', label: 'Mirando por la ventana', gain: { energy: 0.8, fun: 0.8 },
    cond: () => !SPOTS.window.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.window);
      a.effect = { energy: 0.8, fun: 0.9 };
      await a.wait(rand(3000, 5000));
      a.mutter(pick(LINES.ventana[a.id]), 3500);
      await a.wait(rand(6000, 12000));
      if (chance(0.4)) a.emoteFor(pick(['heart', '?', 'bulb']));
      await a.wait(2000);
    },
  },
  {
    id: 'siesta', label: 'Echando una siesta', gain: { energy: 7 },
    cond: (a) => !SPOTS.beanbag.occupant && (a.needs.energy < 45 || hourNow() >= 23 || hourNow() < 6),
    bonus: (a) => (a.needs.energy < 25 ? 4 : 0),
    async run(a) {
      await a.goToSpot(SPOTS.beanbag);
      a.mutter(pick(LINES.siesta));
      a.effect = { energy: 7, hunger: 0.05 };
      const end = G.sim + rand(30000, 60000);
      while (G.sim < end && a.needs.energy < 96) await a.wait(1000);
      a.effect = null;
      a.pose = 'stand';
      a.emoteFor('star', 1400);
      a.mutter(pick(LINES.despertar));
      await a.wait(1500);
    },
  },
  {
    id: 'charlar', label: 'Charlando', gain: { social: 4.5, fun: 1 },
    cond: (a) => chatPartners(a).length > 0,
    async run(a) {
      const b = pick(chatPartners(a));
      await doChat(a, b);
    },
  },
  {
    id: 'gato', label: 'Jugando con Bit', gain: { fun: 1.6, social: 1.2 },
    cond: () => G.cat && !G.cat.busy,
    async run(a) {
      const cat = G.cat;
      cat.busy = true;
      try {
        await a.goNear(cat);
        a.faceTo(cat);
        cat.getPetted();
        a.effect = { fun: 2, social: 1.4 };
        a.emoteFor('heart', 2000);
        a.mutter(pick(LINES.gato));
        await a.wait(rand(4000, 7000));
      } finally { cat.busy = false; }
    },
  },
  {
    id: 'pizarra', label: 'Garabateando en la pizarra', gain: { fun: 1.6 },
    cond: () => !SPOTS.board.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.board);
      a.held = 'marker';
      a.effect = { fun: 1.8 };
      try {
        if (G.board.marks.length > 30) { a.activity = 'Borrando la pizarra'; await a.wait(1500); eraseBoard(); }
        a.mutter(pick(LINES.pizarra));
        await loopFor(a, rand(12000, 20000), [1200, 2000], () => addBoardMark(pick(['doodle', 'diagram', 'doodle'])));
      } finally { a.held = null; }
    },
  },
  {
    id: 'ordenador', label: 'Navegando por internet', gain: { fun: 1.4 },
    cond: () => !SPOTS.pc.occupant,
    async run(a) {
      await a.goToSpot(SPOTS.pc);
      G.pc.mode = 'browse'; G.pc.user = a;
      a.effect = { fun: 1.5 };
      try {
        await loopFor(a, rand(15000, 30000), [3000, 6000], () => {
          if (chance(0.35)) a.mutter(pick(LINES.ordenador));
        });
      } finally { if (G.pc.user === a) { G.pc.mode = 'idle'; G.pc.user = null; } }
    },
  },
  {
    id: 'pasear', label: 'Dando un paseo', gain: { energy: 0.3, fun: 0.4 },
    cond: () => true,
    async run(a) {
      if (a.spot) await a.leaveSpot();
      for (let i = 0; i < randi(1, 3); i++) {
        const t = nearestWalkable(randi(1, 22), randi(4, 12));
        await a.moveToTile(t.x, t.y);
        await a.wait(rand(800, 2000));
      }
      if (chance(0.4)) a.mutter(pick(LINES.pasear));
      a.face = 'down';
      await a.wait(rand(1500, 3000));
    },
  },
];
const ACT = Object.fromEntries(ACTIVITIES.map((x) => [x.id, x]));

function chatPartners(a) {
  return G.agents.filter((b) => b !== a && b.mode === 'free' && !b.chatWith && !a.chatWith
    && b.activityId !== 'siesta' && b.activityId !== 'charlar' && b.activityId !== 'charlando');
}

function chooseActivity(a) {
  let best = null, bestScore = -Infinity;
  for (const act of ACTIVITIES) {
    if (!act.cond(a)) continue;
    let s = (a.prefs[act.id] || 1);
    for (const [k, v] of Object.entries(act.gain)) {
      const deficit = 1 - a.needs[k] / 100;
      s += v * deficit * deficit * 2.2;
    }
    if (act.bonus) s += act.bonus(a);
    if (a.activityId === act.id) s *= 0.35;
    s += rand(0, 1.6);
    if (s > bestScore) { bestScore = s; best = act; }
  }
  return best || ACT.pasear;
}

function startFreeLife(a) {
  if (a.mode !== 'free' || a.running) return;
  const act = chooseActivity(a);
  const id = ++a.runSeq;
  a.activityId = act.id;
  a.activity = act.label;
  const p = (async () => {
    try { await act.run(a); }
    catch (e) { if (!e.cancelled) console.error(e); }
    finally {
      // solo limpia si nadie ha tomado el control del agente mientras tanto
      if (a.runSeq === id) {
        a.effect = null;
        a.dancing = false;
        if (a.held && a.mode === 'free') a.held = null;
      }
    }
  })();
  a.running = p;
  p.finally(() => { if (a.running === p) a.running = null; });
}

// ------------------------------------------------------------
//  Charlas espontáneas entre agentes
// ------------------------------------------------------------
async function doChat(a, b) {
  let finish;
  const done = new Promise((r) => { finish = r; });
  b.interrupt(false);
  b.runSeq++;
  b.chatWith = a; a.chatWith = b;
  b.activityId = 'charlando';
  b.activity = `Charlando con ${a.name}`;
  a.activity = `Charlando con ${b.name}`;
  b.emoteFor('?', 1200);
  const bid = b.runSeq;
  const bp = (async () => {
    try {
      b.effect = { social: 4.5, fun: 1 };
      await Promise.race([done, b.wait(120000)]);
    } catch (e) { /* cancelado */ }
    finally { if (b.runSeq === bid) b.effect = null; }
  })();
  b.running = bp;
  bp.finally(() => { if (b.running === bp) b.running = null; if (b.chatWith === a) b.chatWith = null; });

  try {
    if (b.spot) await b.leaveSpot();
    await a.goNear(b);
    b.faceTo(a); a.faceTo(b);
    a.effect = { social: 4.5, fun: 1 };
    const conv = await getChat(a, b);
    for (const [who, text] of conv) {
      if (b.chatWith !== a || b.mode !== 'free') break;
      const s = who === 'a' ? a : b, o = s === a ? b : a;
      s.faceTo(o); o.faceTo(s);
      await s.say(text);
      await a.wait(300);
    }
    if (chance(0.5)) { a.emoteFor('heart'); b.emoteFor(pick(['heart', 'note', 'star'])); }
    await a.wait(1200);
  } finally {
    a.chatWith = null;
    if (b.chatWith === a) b.chatWith = null;
    finish();
  }
}

async function getChat(a, b) {
  if (G.settings.aiIdle && Brain.hasAI()) {
    a.thinking = true;
    try {
      const lines = await Brain.chitchat(a, b);
      if (lines && lines.length) return lines;
    } catch (e) { console.warn(e); }
    finally { a.thinking = false; }
  }
  const mem = a.memory[0] || b.memory[0];
  let conv;
  if (mem && chance(0.35)) conv = pick(MEMORY_CHATS).map(([w, t]) => [w, t.replace('{task}', shortTask(mem, 34))]);
  else conv = pick(CHATS);
  return conv;
}

// Actualizaciones globales del ambiente
function updateAmbient(dt) {
  if (G.radio.on) {
    if (G.sim > G.radio.until) G.radio.on = false;
    else if (chance(dt / 700)) spawnParticle(232 + rand(-3, 3), 200, 'note', { color: pick(['#e85d75', '#7b4dd6', '#3b7be8', '#f2b134']), life: 2000 });
  }
}
