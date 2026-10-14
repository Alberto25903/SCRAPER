'use strict';
// ============================================================
//  Encargos: cola, reuniones, debates, trabajo y entrega
// ============================================================

let taskSeq = 0;

function submitTask(text, assignee) {
  text = text.trim();
  if (!text) return;
  const task = { id: ++taskSeq, text, assignee, status: 'en cola', tipo: null, phase: 'En cola' };
  G.queue.push(task);
  const who = assignee === 'equipo' ? 'todo el equipo' : G.agents.find((a) => a.id === assignee).name;
  UI.log(`📥 Encargo #${task.id} para ${who}: «${text}»`, 'task');
  UI.renderTasks();
}

function participantsOf(task) {
  return task.assignee === 'equipo' ? G.agents.slice() : [G.agents.find((a) => a.id === task.assignee)];
}

function processQueue() {
  for (const task of [...G.queue]) {
    const team = participantsOf(task);
    if (team.every((a) => a.mode === 'free')) {
      G.queue.splice(G.queue.indexOf(task), 1);
      runTask(task, team);
    } else if (task.assignee === 'equipo') {
      break; // respeta el orden: los encargos de equipo esperan su turno
    }
  }
}

function setPhase(task, phase) {
  task.phase = phase;
  for (const a of G.agents) if (a.task === task) a.activity = phase;
  UI.renderTasks();
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Retener a un agente libre mientras otro le habla (consultas rápidas)
function holdAgent(b, a, label) {
  let release;
  const done = new Promise((r) => { release = r; });
  b.interrupt(true);
  b.runSeq++;
  const id = b.runSeq;
  b.chatWith = a;
  b.activityId = 'charlando';
  b.activity = label;
  const p = (async () => {
    try { await Promise.race([done, b.wait(120000)]); } catch (e) { /* cancelado */ }
  })();
  b.running = p;
  p.finally(() => { if (b.running === p) b.running = null; if (b.runSeq === id) b.chatWith = null; });
  return release;
}

// Elige el sitio de la sala para cada tipo de trabajo
function placeSpot(lugar, a) {
  const takenByTask = (s) => s.occupant && s.occupant !== a && s.occupant.mode === 'task';
  if (lugar === 'ordenador' && !takenByTask(SPOTS.pc)) return { spot: SPOTS.pc, lugar };
  if (lugar === 'estanteria') {
    const s = ['shelfA', 'shelfB'].map((i) => SPOTS[i]).find((x) => !takenByTask(x));
    if (s) return { spot: s, lugar };
  }
  if (lugar === 'pizarra') {
    const s = ['board', 'board2', 'board3'].map((i) => SPOTS[i]).find((x) => !takenByTask(x));
    if (s) return { spot: s, lugar };
  }
  const seats = TABLE_SEATS.map((i) => SPOTS[i]).filter((x) => !takenByTask(x));
  return { spot: seats.find((x) => !x.occupant) || seats[0] || SPOTS.tableB, lugar: 'mesa' };
}

const WORK_MUTTERS = {
  nova: ['Interesante...', 'Esto lo contrasto.', 'Hmm, otra fuente dice lo contrario.', 'Apuntado.'],
  byte: ['Compilando...', '¡Ajá! Ya lo tengo.', 'Un momento, un bug...', 'Esto se puede optimizar.'],
  luma: ['Esto encaja con aquello...', '¡Idea!', 'Lo pongo bonito.', 'Hmm, ¿y si...?'],
};

// ------------------------------------------------------------
//  Trabajo individual en un puesto de la sala
// ------------------------------------------------------------
async function workAt(a, task, asg, tipo, contributions) {
  const { spot, lugar } = placeSpot(asg.lugar, a);
  a.activity = capitalize(asg.subtarea);
  UI.log(`🛠️ ${a.name} → ${asg.subtarea} (${{ ordenador: 'ordenador', estanteria: 'estantería', pizarra: 'pizarra', mesa: 'mesa' }[lugar]})`, 'task');
  await a.goToSpot(spot);

  let shelfId = null;
  if (lugar === 'estanteria') {
    await a.wait(1500);
    shelfId = spot.id;
    G.booksOut[shelfId]++;
    a.held = 'book';
    a.emoteFor('book', 1200);
    if (!SPOTS.armchair.occupant || SPOTS.armchair.occupant.mode === 'free') await a.goToSpot(SPOTS.armchair);
    else a.face = 'down';
  }

  let done = false, result = null;
  const p = Brain.work(a, task.text, asg.subtarea, lugar, tipo).then((r) => { done = true; result = r; });
  a.thinking = false;
  const minEnd = G.sim + rand(8000, 12000);
  try {
    if (lugar === 'ordenador') { G.pc.mode = tipo === 'desarrollo' ? 'code' : 'search'; G.pc.user = a; }
    if (lugar === 'pizarra') a.held = 'marker';
    if (lugar === 'mesa') { G.laptop = true; a.held = 'notes'; }
    while (!done || G.sim < minEnd) {
      await a.wait(rand(1400, 2600));
      if (lugar === 'pizarra') addBoardMark(pick(['diagram', 'text', 'text']));
      if (lugar === 'ordenador') {
        for (let i = 0; i < 2; i++) spawnParticle(rand(320, 336), 66, 'spark', { vy: -6, life: 500, color: '#89b4fa' });
        if (tipo !== 'desarrollo' && chance(0.3)) G.pc.mode = pick(['search', 'doc']);
      }
      if (chance(0.22)) a.mutter(pick(WORK_MUTTERS[a.id]));
      else if (chance(0.15)) a.emoteFor(pick(['?', 'bulb', '!']));
      if (G.sim > minEnd + 4000 && !done) a.thinking = true;
    }
    await p;
  } finally {
    a.thinking = false;
    if (G.pc.user === a) { G.pc.mode = 'idle'; G.pc.user = null; }
    if (lugar === 'mesa') G.laptop = false;
    if (shelfId) G.booksOut[shelfId] = Math.max(0, G.booksOut[shelfId] - 1);
    a.held = null;
  }
  a.emoteFor('bulb', 1500);
  contributions.push({ agent: a, resumen: result.resumen, detalle: result.detalle });
  return result;
}

// ------------------------------------------------------------
//  Encargo completo
// ------------------------------------------------------------
async function runTask(task, team) {
  task.status = 'en curso';
  G.active.push(task);
  UI.renderTasks();
  for (const a of team) {
    a.interrupt(true);
    a.runSeq++;
    a.mode = 'task';
    a.task = task;
    a.chatWith = null;
    a.held = null;
    a.activityId = 'tarea';
    a.activity = '¡Nuevo encargo!';
  }
  const transcript = [];
  const contributions = [];
  const say = async (a, text) => { transcript.push({ name: a.name, text }); await a.say(text); };
  try {
    await Promise.all(team.map((a) => a.wait(rand(400, 900))));
    if (team.length > 1) await teamTask(task, team, transcript, contributions, say);
    else await soloTask(task, team[0], transcript, contributions, say);
  } catch (e) {
    console.error(e);
    UI.log(`❌ El encargo #${task.id} se ha torcido: ${e.message || e}`, 'error');
  } finally {
    for (const a of team) {
      a.mode = 'free';
      a.task = null;
      a.thinking = false;
      a.held = null;
      a.memory.unshift(shortTask(task.text, 50));
      a.memory.length = Math.min(a.memory.length, 3);
    }
    G.active.splice(G.active.indexOf(task), 1);
    UI.renderTasks();
  }
}

async function teamTask(task, team, transcript, contributions, say) {
  const leader = team.find((a) => a.id === 'luma') || team[0];
  const others = team.filter((a) => a !== leader);
  const seatOf = new Map([[leader, 'tableT'], [others[0], 'tableL'], [others[1], 'tableR']]);

  // 1) Reunión de arranque en la mesa
  setPhase(task, 'Reunión de arranque');
  for (const a of others) a.mutter(pick(['¡Voy!', '¿Reunión? ¡Voy!', '¡Encargo nuevo!']), 1800);
  await Promise.all(team.map((a) => a.goToSpot(SPOTS[seatOf.get(a)])));
  await leader.say(`¡Equipo! Nos ha llegado un encargo: «${shortTask(task.text, 90)}»`);
  leader.thinking = true;
  const plan = await Brain.plan(task.text, team);
  leader.thinking = false;
  task.tipo = plan.tipo;
  UI.renderTasks();
  await say(leader, plan.resumen);
  for (const a of others) {
    const asg = plan.asignaciones.find((x) => x.agente === a.id);
    a.emoteFor('!', 1000);
    await say(a, plan.tipo === 'debate'
      ? pick(['¡Tengo mucho que decir!', 'Vale, preparo mis argumentos.', '¡Me encanta un buen debate!'])
      : `¡Hecho! Me encargo de ${asg ? asg.subtarea : 'ayudar'}.`);
  }

  if (plan.tipo === 'debate') {
    await debatePhase(task, team, leader, transcript, say);
  } else {
    // 2) Cada uno a su puesto
    setPhase(task, 'Trabajando');
    await Promise.all(team.map((a) => {
      const asg = plan.asignaciones.find((x) => x.agente === a.id) || { subtarea: 'apoyar al equipo', lugar: 'mesa' };
      return workAt(a, task, asg, plan.tipo, contributions);
    }));
    // 3) Puesta en común
    setPhase(task, 'Puesta en común');
    UI.log('🗣️ El equipo se reúne para poner en común lo que ha encontrado', 'task');
    await Promise.all(team.map((a) => a.goToSpot(SPOTS[seatOf.get(a)])));
    const order = [...others, leader];
    for (const a of order) {
      const c = contributions.find((x) => x.agent === a);
      if (!c) continue;
      for (const o of team) if (o !== a && o.pose !== 'sit') o.faceTo(a);
      await say(a, c.resumen);
      const listener = pick(team.filter((o) => o !== a));
      listener.emoteFor(pick(['bulb', 'heart', '!', 'star']));
    }
    for (const a of shuffle(team).slice(0, 2)) {
      a.thinking = true;
      const txt = await Brain.turn(a, task.text, transcript, 'react');
      a.thinking = false;
      await say(a, txt);
    }
  }

  // 4) Redacción del informe en la pizarra
  setPhase(task, 'Redactando el informe');
  await Promise.all([
    leader.goToSpot(SPOTS.board),
    others[0].goToSpot(SPOTS.board2),
    others[1].goToSpot(SPOTS.board3),
  ]);
  leader.held = 'marker';
  let md = null;
  const p = Brain.synthesize(task.text, transcript, contributions, task.tipo, team).then((r) => { md = r; });
  const minEnd = G.sim + 6000;
  while (md === null || G.sim < minEnd) {
    await leader.wait(1300);
    addBoardMark('text');
    if (chance(0.25)) pick(others).mutter(pick(['¡Eso, eso!', 'Añade lo de antes.', 'Queda genial.', 'Ponlo en negrita.']));
    if (G.sim > minEnd + 3000 && md === null) leader.thinking = true;
  }
  await p;
  leader.thinking = false;
  leader.held = null;
  deliver(task, md, team);
  leader.face = 'down';
  await leader.say('¡Informe listo! Lo tenéis en la pestaña «Resultados».');
  await celebrate(team);
}

async function debatePhase(task, team, leader, transcript, say) {
  setPhase(task, 'Debate');
  UI.log('💬 Debate: los agentes se levantan y se acercan para discutir', 'task');
  const order = [...team.filter((a) => a !== leader), leader];
  await Promise.all(order.map((a, i) => a.goToSpot(SPOTS[DEBATE_SPOTS[i]])));
  const cx = 137, cy = 156;
  const lean = async (a, inward) => {
    const dx = cx - a.spot.x, dy = cy - a.spot.y, d = Math.hypot(dx, dy) || 1;
    const k = inward ? 5 : 0;
    await a.walkPoints([{ x: a.spot.x + dx / d * k, y: a.spot.y + dy / d * k }]);
    a.face = a.spot.face;
  };
  for (const round of ['open', 'reply']) {
    for (const a of order) {
      a.thinking = true;
      const txt = await Brain.turn(a, task.text, transcript, round);
      a.thinking = false;
      for (const o of order) if (o !== a) o.faceTo(a);
      await lean(a, true);
      await say(a, txt);
      const other = pick(order.filter((o) => o !== a));
      other.emoteFor(pick(round === 'reply' ? ['anger', '?', '!', 'heart'] : ['?', 'bulb', '!']));
      await lean(a, false);
    }
  }
  setPhase(task, 'Buscando consenso');
  leader.thinking = true;
  const concl = await Brain.turn(leader, task.text, transcript, 'conclude');
  leader.thinking = false;
  for (const o of order) if (o !== leader) o.faceTo(leader);
  await lean(leader, true);
  await say(leader, concl);
  for (const o of order) if (o !== leader) {
    o.emoteFor('check', 1800);
    o.mutter(pick(['¡De acuerdo!', 'Me convence.', 'Vale, trato hecho.', 'Bien visto.']), 1800);
  }
  await leader.wait(1800);
}

async function soloTask(task, a, transcript, contributions, say) {
  setPhase(task, 'Planificando');
  a.emoteFor('!', 1000);
  await a.say(pick(['¡Entendido! Me pongo con ello.', '¡Marchando!', 'Vale, déjamelo a mí.', '¡A trabajar!']));
  a.thinking = true;
  const plan = await Brain.plan(task.text, [a]);
  a.thinking = false;
  task.tipo = plan.tipo;
  UI.renderTasks();
  const asg = plan.asignaciones[0] || { subtarea: 'resolver la tarea', lugar: 'mesa' };
  a.mutter(plan.resumen, 3500);

  setPhase(task, 'Trabajando');
  const res = await workAt(a, task, asg, plan.tipo, contributions);

  // consulta rápida a un compañero libre (si hay alguno despierto)
  const mates = G.agents.filter((b) => b !== a && b.mode === 'free' && b.activityId !== 'siesta' && !b.chatWith);
  if (mates.length && chance(0.75)) {
    const mate = pick(mates);
    setPhase(task, `Consultando a ${mate.name}`);
    const release = holdAgent(mate, a, `Ayudando a ${a.name}`);
    try {
      if (mate.spot) await mate.leaveSpot();
      await a.goNear(mate);
      mate.faceTo(a); a.faceTo(mate);
      await say(a, `Oye, ${mate.name}, ¿qué te parece esto? ${res.resumen}`);
      mate.thinking = true;
      const reply = await Brain.turn(mate, task.text, transcript, 'consult');
      mate.thinking = false;
      await say(mate, reply);
      a.emoteFor('heart', 1400);
      await a.say(pick(['¡Gracias!', 'Buen consejo, lo añado.', '¡Te debo un café!']));
    } finally {
      mate.thinking = false;
      release();
    }
  }

  setPhase(task, 'Redactando el informe');
  const desk = !SPOTS.pc.occupant || SPOTS.pc.occupant === a || SPOTS.pc.occupant.mode === 'free' ? SPOTS.pc : placeSpot('mesa', a).spot;
  await a.goToSpot(desk);
  if (desk === SPOTS.pc) { G.pc.mode = 'doc'; G.pc.user = a; }
  let md = null;
  const p = Brain.synthesize(task.text, transcript, contributions, plan.tipo, [a]).then((r) => { md = r; });
  const minEnd = G.sim + 5000;
  try {
    while (md === null || G.sim < minEnd) {
      await a.wait(1500);
      if (G.sim > minEnd + 2000 && md === null) a.thinking = true;
    }
    await p;
  } finally {
    a.thinking = false;
    if (G.pc.user === a) { G.pc.mode = 'idle'; G.pc.user = null; }
  }
  deliver(task, md, [a]);
  await a.leaveSpot();
  a.face = 'down';
  await a.say('¡Listo! Os dejo el informe en «Resultados».');
  await celebrate([a]);
}

function deliver(task, md, team) {
  const r = {
    id: task.id, text: task.text, md, tipo: task.tipo || 'general',
    team: team.map((a) => a.name), time: `Día ${G.day} · ${fmtClock(G.minutes)}`,
    ai: Brain.hasAI(),
  };
  G.results.unshift(r);
  UI.addResult(r);
  UI.log(`📄 Informe del encargo #${task.id} entregado`, 'done');
  UI.toast(`📄 Informe listo: «${shortTask(task.text, 40)}»`);
}

async function celebrate(team) {
  setPhaseAll(team, 'Celebrando');
  for (const a of team) {
    a.emoteFor(pick(['star', 'heart', 'note']), 2000);
    a.dancing = true;
  }
  if (team.length > 1) team[1].mutter(pick(['¡Choca esos cinco!', '¡Equipazo!', '¡Otro encargo superado!']), 2000);
  await team[0].wait(2600);
  for (const a of team) a.dancing = false;
}
function setPhaseAll(team, label) { for (const a of team) a.activity = label; }
