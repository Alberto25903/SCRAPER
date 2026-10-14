'use strict';
// ============================================================
//  Cerebros: modo simulado (sin conexión) y Claude (IA real)
// ============================================================

const PLACES = {
  ordenador: 'el ordenador del escritorio (internet y programación)',
  estanteria: 'la estantería (libros y documentación)',
  pizarra: 'la pizarra (esquemas, ideas y diseño)',
  mesa: 'la mesa de reuniones (redactar y analizar)',
};
const TASK_TYPES = ['investigacion', 'debate', 'desarrollo', 'creativo', 'general'];
const TYPE_LABEL = {
  investigacion: '🔎 Investigación', debate: '💬 Debate', desarrollo: '💻 Desarrollo',
  creativo: '🎨 Creativo', general: '📋 General',
};

function classifyTask(text) {
  const t = text.toLowerCase();
  if (/debat|opin|discut|decid|elig|elegir|compar|mejor|versus|\bvs\b|pros y contras|ventajas|¿.+\bo\b.+\?/.test(t)) return 'debate';
  if (/program|código|codigo|script|\bapp\b|\bweb\b|funci[oó]n|\bbug|\bapi\b|python|javascript|automatiz|scraper|\bbot\b|algoritmo/.test(t)) return 'desarrollo';
  if (/investig|busca|encuentr|informaci|qu[eé] es|qui[eé]n|historia de|datos|estudi|analiz|resum|averigu|cu[aá]nt/.test(t)) return 'investigacion';
  if (/escrib|idea|diseñ|nombre|slogan|eslogan|logo|poema|cuento|campaña|marca|creativ|\bpost\b|tweet|guion/.test(t)) return 'creativo';
  return 'general';
}

function topicOf(text) {
  let t = text.trim().replace(/[.!]+$/, '');
  t = t.replace(/^(por favor,?\s*)?(equipo,?\s*)?(investiga[dr]?|busca[dr]?|debatid|debatir|debate|haz|haced|hacer|escribe|escribid|diseña[dr]?|crea[dr]?|programa[dr]?|analiza[dr]?|decidid|decide|compara[dr]?|pensad|piensa|dime|decidme|necesito( que)?|quiero( que)?)\b[:,]?\s*/i, '');
  t = t.replace(/^(sobre|acerca de)\s+/i, '');
  return shortTask(t || text, 60);
}

// ------------------------------------------------------------
//  Cerebro simulado: improvisa con plantillas
// ------------------------------------------------------------
const SimBrain = {
  plan(task, team) {
    const tipo = classifyTask(task);
    const topic = topicOf(task);
    const base = {
      investigacion: { nova: ['buscar bibliografía y conceptos clave', 'estanteria'], byte: ['buscar datos actualizados en la red', 'ordenador'], luma: ['organizar los hallazgos en un esquema', 'pizarra'] },
      desarrollo: { byte: ['escribir el prototipo de código', 'ordenador'], nova: ['revisar documentación y buenas prácticas', 'estanteria'], luma: ['diseñar el flujo y los casos de uso', 'pizarra'] },
      creativo: { luma: ['hacer una lluvia de ideas', 'pizarra'], nova: ['buscar referencias e inspiración', 'estanteria'], byte: ['montar un boceto rápido', 'ordenador'] },
      general: { luma: ['definir objetivos y pasos', 'pizarra'], nova: ['reunir información de contexto', 'estanteria'], byte: ['preparar las herramientas necesarias', 'ordenador'] },
      debate: { nova: ['aportar datos al debate', 'mesa'], byte: ['valorar la parte práctica', 'mesa'], luma: ['moderar y buscar consenso', 'mesa'] },
    }[tipo];
    let asignaciones = team.map((a) => ({ agente: a.id, subtarea: base[a.id][0], lugar: base[a.id][1] }));
    if (team.length === 1) {
      const solo = { investigacion: 'investigar a fondo el tema', desarrollo: 'resolverlo programando', creativo: 'proponer ideas creativas', general: 'resolver la tarea', debate: 'analizar los pros y contras' }[tipo];
      const lugar = { investigacion: team[0].id === 'nova' ? 'estanteria' : 'ordenador', desarrollo: 'ordenador', creativo: 'pizarra', general: 'mesa', debate: 'mesa' }[tipo];
      asignaciones = [{ agente: team[0].id, subtarea: solo, lugar }];
    }
    const names = asignaciones.map((x) => `${G.agents.find((a) => a.id === x.agente).name} se encarga de ${x.subtarea}`);
    const resumen = tipo === 'debate'
      ? `Toca debatir «${topic}». Quiero oír todas las posturas antes de decidir.`
      : `Objetivo: «${topic}». ${names.join('; ')}.`;
    return { tipo, resumen, asignaciones };
  },

  work(agent, task, sub, lugar, tipo) {
    const topic = topicOf(task);
    const R = {
      estanteria: [
        `He revisado tres libros sobre «${topic}». Coinciden en que hay que definir bien los conceptos antes de decidir nada.`,
        `En la estantería hay un manual que trata «${topic}»; he apuntado las ideas clave y dos advertencias.`,
      ],
      ordenador: tipo === 'desarrollo'
        ? [`Tengo un prototipo funcionando para «${topic}»: unas 40 líneas y un par de pruebas básicas.`]
        : [`En internet hay bastante sobre «${topic}». He sacado datos recientes y algún enlace útil.`, `He comparado varias fuentes online sobre «${topic}»; hay consenso en lo básico y debate en los detalles.`],
      pizarra: [
        `He agrupado todo en la pizarra en tres bloques: contexto, opciones y próximos pasos.`,
        `En la pizarra queda un esquema claro: problema, propuesta y riesgos de «${topic}».`,
      ],
      mesa: [`He redactado un borrador sobre «${topic}» con los puntos principales y una conclusión.`],
    };
    const resumen = pick(R[lugar] || R.mesa);
    let detalle = `**${agent.name}** (${sub}):\n- Punto de partida: qué sabemos de «${topic}».\n- Hallazgo principal: ${resumen.toLowerCase()}\n- Pendiente: validar con datos reales.`;
    if (tipo === 'desarrollo' && lugar === 'ordenador') {
      detalle += '\n\n```js\n// Prototipo: ' + topic.replace(/`/g, '') + '\nfunction resolver(entrada) {\n  // 1. validar la entrada\n  // 2. procesar los datos\n  // 3. devolver el resultado\n  return entrada;\n}\n```';
    }
    return { resumen, detalle };
  },

  turn(agent, task, transcript, kind) {
    const topic = topicOf(task);
    const L = {
      open: {
        nova: [`Antes de opinar sobre «${topic}», miremos los datos: la evidencia suele estar más repartida de lo que parece.`, `Mi postura: depende del contexto, pero las fuentes que conozco inclinan la balanza hacia la opción más prudente.`],
        byte: [`Desde lo técnico, lo que importa es qué funciona mejor en la práctica. Yo iría a lo simple y medible.`, `Yo lo tengo claro: probemos rápido, midamos y decidamos con resultados, no con teorías.`],
        luma: [`Pensemos en las personas: ¿qué opción les aporta más? Ese debería ser nuestro criterio.`, `Me gusta que haya opiniones distintas. Yo apostaría por la opción que genere más impacto.`],
      },
      reply: {
        nova: ['Entiendo tu punto, pero sin fuentes es solo una intuición.', 'Coincido a medias: los datos apoyan una parte de lo que decís.'],
        byte: ['Vale, pero eso en la práctica no escala. Hay que ser pragmáticos.', '¡Buen punto! Aunque yo lo haría más sencillo.'],
        luma: ['Creo que estamos más de acuerdo de lo que parece.', 'Ojo, no perdamos de vista para quién es todo esto.'],
      },
      react: {
        nova: ['Interesante. Lo apunto como hallazgo.', 'Encaja con lo que leí.'],
        byte: ['¡Me gusta! Se puede implementar.', 'Eso nos ahorra trabajo, genial.'],
        luma: ['¡Eso queda genial en el informe!', 'Perfecto, lo uno todo en la pizarra.'],
      },
      conclude: {
        nova: [`Conclusión: combinamos datos y prudencia en «${topic}».`],
        byte: [`Conclusión: prototipo rápido, medimos y ajustamos.`],
        luma: [`Consenso: nos quedamos con lo mejor de cada postura y lo probamos. ¿De acuerdo?`],
      },
      consult: {
        nova: [`Revisaría las fuentes primero, pero vas bien encaminado.`],
        byte: [`Hazlo simple primero y luego lo mejoras.`],
        luma: [`¡Me encanta! Piensa en quién lo va a usar.`],
      },
    };
    return pick((L[kind] || L.reply)[agent.id]);
  },

  synthesize(task, transcript, contributions, tipo, team) {
    const topic = topicOf(task);
    let md = `# ${topic.charAt(0).toUpperCase() + topic.slice(1)}\n\n`;
    md += `**Tipo de encargo:** ${TYPE_LABEL[tipo]} · **Equipo:** ${team.map((a) => a.name).join(', ')}\n\n`;
    md += `## Resumen\n`;
    md += tipo === 'debate'
      ? `El equipo ha debatido «${topic}». Tras escuchar las posturas de cada agente se ha llegado a un consenso: combinar la visión basada en datos con un enfoque práctico y centrado en las personas.\n\n`
      : `El equipo ha trabajado en «${topic}» repartiéndose investigación, ejecución y síntesis.\n\n`;
    if (contributions.length) {
      md += `## Aportaciones\n`;
      for (const c of contributions) md += `${c.detalle}\n\n`;
    }
    if (transcript.length) {
      md += `## Momentos clave de la conversación\n`;
      for (const l of transcript.slice(-6)) md += `- **${l.name}:** ${l.text}\n`;
      md += '\n';
    }
    md += `## Próximos pasos\n1. Validar las conclusiones con datos reales.\n2. Preparar una primera versión.\n3. Revisar resultados en la próxima reunión.\n\n`;
    md += `> ⚠️ **Modo simulado:** los agentes han improvisado con plantillas. Añade tu API key de Claude en ⚙ Ajustes para que trabajen de verdad.`;
    return md;
  },
};

// ------------------------------------------------------------
//  Cerebro Claude: llamadas reales a la API desde el navegador
// ------------------------------------------------------------
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm';
const TEAM_DESC = 'La Agencia Pixel es un pequeño equipo de tres agentes IA que viven y trabajan en una sala de estar retro: '
  + 'Nova (investigadora: curiosa, meticulosa, ama los libros y los datos), '
  + 'Byte (ingeniero: pragmático, bromista, fan de los videojuegos retro, piensa en prototipos) y '
  + 'Luma (estratega creativa: entusiasta, sociable, coordina al equipo y resume). '
  + 'El cliente, que es quien usa la aplicación, les encarga tareas.';

const ClaudeBrain = {
  _client: null, _key: null,

  async client() {
    if (!this._client || this._key !== G.settings.apiKey) {
      const mod = await import(SDK_URL);
      const Anthropic = mod.default || mod.Anthropic;
      this._client = new Anthropic({ apiKey: G.settings.apiKey, dangerouslyAllowBrowser: true });
      this._key = G.settings.apiKey;
    }
    return this._client;
  },

  persona(agent) {
    return `${TEAM_DESC}\n\nEres ${agent.name}, ${agent.role}. Tu personalidad: ${agent.personality}. `
      + `Hablas siempre en español, con tu propia voz y sin romper el personaje. No empieces nunca con tu nombre ni con prefijos como "${agent.name}:".`;
  },

  async call({ system, user, effort = 'low', schema = null, webSearch = false, maxTokens = 16000 }) {
    const c = await this.client();
    const model = G.settings.model;
    const params = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
    params.output_config = { effort };
    if (schema) params.output_config.format = { type: 'json_schema', schema };
    if (webSearch) params.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }];
    // Los modelos con clasificadores de seguridad pueden rechazar; activamos el
    // reintento automático en el servidor con otro modelo cuando lo admiten.
    const fallback = /^claude-(opus-5-5|sonnet-5-5|fable-5-1)$/.test(model);
    let texts = [];
    for (let round = 0; round < 3; round++) {
      const resp = fallback
        ? await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await c.messages.create(params);
      if (resp.stop_reason === 'refusal') throw new Error('El modelo ha rechazado la petición.');
      texts.push(resp.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
      if (resp.stop_reason !== 'pause_turn') break;
      // búsqueda web larga: el servidor pausa el turno y lo reanudamos
      params.messages = [...params.messages, { role: 'assistant', content: resp.content }];
    }
    return texts.join('').trim();
  },

  async plan(task, team) {
    const leader = team.find((a) => a.id === 'luma') || team[0];
    const schema = {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: TASK_TYPES },
        resumen: { type: 'string' },
        asignaciones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agente: { type: 'string', enum: team.map((a) => a.id) },
              subtarea: { type: 'string' },
              lugar: { type: 'string', enum: Object.keys(PLACES) },
            },
            required: ['agente', 'subtarea', 'lugar'],
            additionalProperties: false,
          },
        },
      },
      required: ['tipo', 'resumen', 'asignaciones'],
      additionalProperties: false,
    };
    const user = `Nueva tarea del cliente: """${task}"""\n`
      + `Participantes: ${team.map((a) => `${a.id} (${a.name}, ${a.role})`).join(', ')}.\n`
      + (team.length === 1 ? `Trabajas solo/a en esta tarea; ignora al resto del equipo.\n` : `Tú coordinas el reparto.\n`)
      + `Clasifica la tarea (tipo) y asigna a cada participante una subtarea concreta y un lugar de la sala: `
      + Object.entries(PLACES).map(([k, v]) => `"${k}" = ${v}`).join('; ')
      + `. Solo un agente puede usar el ordenador. Si la tarea consiste en debatir, opinar o decidir entre opciones, usa tipo "debate" y lugar "mesa" para todos. `
      + `"resumen" es lo que dirás en voz alta al equipo al empezar (máximo 30 palabras).`;
    const txt = await this.call({ system: this.persona(leader), user, schema, effort: 'low' });
    const plan = JSON.parse(txt);
    plan.asignaciones = plan.asignaciones.filter((x) => team.some((a) => a.id === x.agente));
    for (const a of team) if (!plan.asignaciones.some((x) => x.agente === a.id)) {
      plan.asignaciones.push({ agente: a.id, subtarea: 'apoyar al equipo', lugar: 'mesa' });
    }
    return plan;
  },

  async work(agent, task, sub, lugar) {
    const web = lugar === 'ordenador' && G.settings.webSearch && !/haiku/.test(G.settings.model);
    const user = `Tarea del cliente: """${task}"""\nTu parte del trabajo: ${sub}\nTrabajas desde ${PLACES[lugar] || lugar}.\n`
      + `Haz tu parte de verdad, con contenido útil y concreto${web ? ' (puedes buscar en la web si te ayuda)' : ''}. `
      + `Si te toca programar, incluye el código.\n`
      + `Responde con este formato exacto:\nRESUMEN: <una frase de máximo 25 palabras que dirás en voz alta al equipo>\n<tu aportación detallada en markdown, máximo 300 palabras>`;
    let txt;
    try {
      txt = await this.call({ system: this.persona(agent), user, effort: 'medium', webSearch: web });
    } catch (e) {
      if (!web) throw e;
      txt = await this.call({ system: this.persona(agent), user, effort: 'medium' });
    }
    const m = txt.match(/RESUMEN:\s*(.+)/i);
    const resumen = m ? m[1].trim() : txt.split('\n')[0].slice(0, 200);
    const detalle = `**${agent.name}** (${sub}):\n\n` + (m ? txt.replace(m[0], '').trim() : txt);
    return { resumen, detalle };
  },

  async turn(agent, task, transcript, kind) {
    const instr = {
      open: 'Da tu postura inicial sobre el tema.',
      reply: 'Responde a lo que han dicho tus compañeros: matiza, discrepa o apoya con argumentos.',
      react: 'Reacciona brevemente a lo que acaban de contar tus compañeros y aporta un matiz útil.',
      conclude: 'Como coordinadora, propone una conclusión de consenso concreta.',
      consult: 'Un compañero te pide opinión rápida sobre su trabajo. Dale un consejo concreto.',
    }[kind] || 'Participa en la conversación.';
    const conv = transcript.length ? transcript.map((l) => `${l.name}: ${l.text}`).join('\n') : '(todavía nadie ha hablado)';
    const user = `Tarea del cliente: """${task}"""\n\nConversación del equipo hasta ahora:\n${conv}\n\n${instr}\n`
      + `Responde solo con lo que dices en voz alta: 1 o 2 frases, máximo 35 palabras.`;
    let txt = await this.call({ system: this.persona(agent), user, effort: 'low', maxTokens: 4000 });
    txt = txt.replace(new RegExp(`^\\s*${agent.name}\\s*:\\s*`, 'i'), '').replace(/^["«“]|["»”]$/g, '').trim();
    return txt;
  },

  async synthesize(task, transcript, contributions, tipo, team) {
    const leader = team.find((a) => a.id === 'luma') || team[0];
    const user = `Tarea del cliente: """${task}"""\nTipo: ${tipo}. Equipo: ${team.map((a) => a.name).join(', ')}.\n\n`
      + `Aportaciones del equipo:\n${contributions.map((c) => c.detalle).join('\n\n') || '(ninguna)'}\n\n`
      + `Conversación:\n${transcript.map((l) => `${l.name}: ${l.text}`).join('\n') || '(ninguna)'}\n\n`
      + `Redacta el entregable final para el cliente en markdown: un título con #, un resumen breve y después el contenido completo que pidió `
      + `(si pidió código, inclúyelo en un bloque de código; si fue un debate, la decisión y sus razones). Máximo 500 palabras. `
      + `No describas la sala ni a los personajes: entrega el trabajo.`;
    return this.call({ system: this.persona(leader), user, effort: 'medium' });
  },

  async chitchat(a, b) {
    const schema = {
      type: 'object',
      properties: {
        lineas: {
          type: 'array',
          items: {
            type: 'object',
            properties: { quien: { type: 'string', enum: ['a', 'b'] }, texto: { type: 'string' } },
            required: ['quien', 'texto'], additionalProperties: false,
          },
        },
      },
      required: ['lineas'], additionalProperties: false,
    };
    const mem = a.memory[0] || b.memory[0];
    const user = `Es tiempo libre en la sala. Escribe una charla casual y divertida de 2 a 4 intervenciones alternas (máximo 18 palabras cada una) `
      + `entre "a" = ${a.name} (empieza) y "b" = ${b.name}. ${a.name} venía de: ${a.activity}. ${b.name} estaba: ${b.activity}. `
      + (mem ? `Pueden mencionar la última tarea que hicieron: "${mem}". ` : '')
      + `Hora del día: ${fmtClock(G.minutes)}.`;
    const txt = await this.call({ system: TEAM_DESC + ' Escribes siempre en español.', user, schema, effort: 'low', maxTokens: 4000 });
    return JSON.parse(txt).lineas.slice(0, 4).map((l) => [l.quien, l.texto]);
  },
};

// ------------------------------------------------------------
//  Fachada: usa Claude si hay API key y, si algo falla, improvisa
// ------------------------------------------------------------
const Brain = {
  hasAI() { return !!G.settings.apiKey; },
  async _try(name, args, agent) {
    if (this.hasAI()) {
      try {
        return await ClaudeBrain[name](...args);
      } catch (e) {
        console.warn(e);
        UI.log(`⚠️ Error de la API (${name}): ${e.message || e}. ${agent ? agent.name + ' improvisa.' : 'Se improvisa.'}`, 'error');
        if (e.status === 401) UI.toast('API key no válida. Revisa ⚙ Ajustes.');
      }
    }
    await new Promise((r) => setTimeout(r, rand(400, 1200)));
    return SimBrain[name](...args);
  },
  plan(task, team) { return this._try('plan', [task, team], team[0]); },
  work(agent, task, sub, lugar, tipo) { return this._try('work', [agent, task, sub, lugar, tipo], agent); },
  turn(agent, task, transcript, kind) { return this._try('turn', [agent, task, transcript, kind], agent); },
  synthesize(task, transcript, contributions, tipo, team) { return this._try('synthesize', [task, transcript, contributions, tipo, team]); },
  chitchat(a, b) { return ClaudeBrain.chitchat(a, b); },
};
