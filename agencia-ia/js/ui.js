'use strict';
// ============================================================
//  Interfaz: bocadillos, panel del equipo, registro, informes
// ============================================================

const SETTINGS_KEY = 'agenciaPixel.settings';

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Markdown mínimo y seguro (se escapa todo antes de formatear)
function md2html(md) {
  const blocks = [];
  let src = String(md || '').replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre><code>${escapeHTML(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  const inline = (s) => escapeHTML(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const out = [];
  let list = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (/^\u0000\d+\u0000$/.test(line.trim())) { flushPara(); flushList(); out.push(blocks[+line.trim().slice(1, -1)]); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flushPara(); flushList(); const n = Math.min(m[1].length, 3); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)/))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)/))) { flushPara(); flushList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join('\n');
}

const UI = {
  els: {},
  bubbles: new Map(),
  scale: 3,
  unreadLog: 0,
  unreadRes: 0,
  tab: 'team',

  init() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      stage: $('stage'), canvas: $('game'), overlay: $('overlay'), clock: $('clock'),
      team: $('team'), log: $('log'), results: $('results'), tasks: $('tasks'),
      logBadge: $('logBadge'), resBadge: $('resBadge'), toasts: $('toasts'),
      input: $('taskInput'), assignee: $('assignee'), modeBtn: $('modeBtn'),
    };
    this.loadSettings();
    this.buildTeam();
    this.buildChips();

    $('taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.els.input.value.trim();
      if (!text) { this.els.input.focus(); return; }
      submitTask(text, this.els.assignee.value);
      this.els.input.value = '';
    });

    document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => {
      const s = +b.dataset.speed;
      G.paused = s === 0;
      if (s) G.speed = s;
      document.querySelectorAll('.speed button').forEach((x) => x.classList.toggle('on', x === b));
    }));

    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => this.showTab(b.dataset.tab)));

    // ajustes
    const dlg = $('settings');
    const open = () => {
      $('apiKey').value = G.settings.apiKey;
      $('remember').checked = G.settings.remember;
      $('model').value = G.settings.model;
      $('webSearch').checked = G.settings.webSearch;
      $('aiIdle').checked = G.settings.aiIdle;
      dlg.showModal();
    };
    $('settingsBtn').addEventListener('click', open);
    this.els.modeBtn.addEventListener('click', open);
    $('clearKey').addEventListener('click', () => { $('apiKey').value = ''; });
    $('settingsForm').addEventListener('submit', () => {
      Object.assign(G.settings, {
        apiKey: $('apiKey').value.trim(),
        remember: $('remember').checked,
        model: $('model').value,
        webSearch: $('webSearch').checked,
        aiIdle: $('aiIdle').checked,
      });
      this.saveSettings();
      this.updateMode();
      this.toast(Brain.hasAI() ? '🟢 IA real activada: los agentes ya piensan con Claude' : '🟡 Modo simulado');
    });

    // informes
    const rd = $('reportDlg');
    $('closeReport').addEventListener('click', () => rd.close());
    $('copyReport').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(this.current.md); this.toast('Copiado al portapapeles'); }
      catch (e) { this.toast('No se ha podido copiar'); }
    });
    $('downloadReport').addEventListener('click', () => {
      const blob = new Blob([this.current.md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `informe-${this.current.id}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    // clic en la sala
    this.els.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    this.updateMode();
    this.renderTasks();
  },

  // ---------- ajustes ----------
  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s) Object.assign(G.settings, s);
    } catch (e) { /* almacenamiento no disponible */ }
  },
  saveSettings() {
    const s = { ...G.settings };
    if (!s.remember) delete s.apiKey;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* sin almacenamiento */ }
  },
  updateMode() {
    const ai = Brain.hasAI();
    const names = { 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5' };
    this.els.modeBtn.textContent = ai ? `🟢 IA real · ${names[G.settings.model] || G.settings.model}` : '🟡 Modo simulado';
    this.els.modeBtn.classList.toggle('ai', ai);
  },

  showTab(tab) {
    this.tab = tab;
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
    document.querySelectorAll('.tab-body').forEach((x) => x.classList.toggle('on', x.dataset.body === tab));
    if (tab === 'log') { this.unreadLog = 0; this.els.logBadge.textContent = ''; }
    if (tab === 'results') { this.unreadRes = 0; this.els.resBadge.textContent = ''; }
  },

  buildChips() {
    const ideas = [
      ['🔎', 'Investigad la historia de los videojuegos'],
      ['💬', 'Debatid: ¿es mejor trabajar desde casa o en la oficina?'],
      ['💻', 'Escribid un script en Python que ordene una lista de nombres'],
      ['🎨', 'Proponed 5 nombres para una cafetería retro'],
      ['📋', 'Organizad un plan para aprender a programar en un mes'],
    ];
    const box = document.getElementById('chips');
    for (const [ic, text] of ideas) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      b.textContent = `${ic} ${text}`;
      b.addEventListener('click', () => { this.els.input.value = text; this.els.input.focus(); });
      box.appendChild(b);
    }
  },

  // ---------- panel del equipo ----------
  buildTeam() {
    const box = this.els.team;
    box.innerHTML = '';
    this.cards = new Map();
    for (const a of G.agents) {
      const card = document.createElement('div');
      card.className = 'agent-card';
      card.style.setProperty('--c', a.color);
      card.innerHTML = `
        <canvas width="24" height="24"></canvas>
        <div>
          <div class="nm">${escapeHTML(a.name.toUpperCase())}</div>
          <div class="rl">${escapeHTML(a.role)} · <span class="md-mood"></span></div>
          <div class="act"></div>
          <div class="said"></div>
        </div>
        <div class="bars">
          <span>Energía</span><div class="bar"><i data-k="energy"></i></div>
          <span>Diversión</span><div class="bar"><i data-k="fun"></i></div>
          <span>Social</span><div class="bar"><i data-k="social"></i></div>
          <span>Hambre</span><div class="bar"><i data-k="hunger"></i></div>
        </div>`;
      card.addEventListener('click', () => this.select(G.selected === a ? null : a));
      box.appendChild(card);
      this.cards.set(a, {
        card, cv: card.querySelector('canvas'), act: card.querySelector('.act'),
        said: card.querySelector('.said'), mood: card.querySelector('.md-mood'),
        bars: [...card.querySelectorAll('.bar i')],
      });
    }
    const note = document.createElement('p');
    note.className = 'team-note';
    note.textContent = 'Toca a un agente (aquí o en la sala) para encargarle algo solo a él/ella. Cuando no tienen trabajo, viven su vida: juegan, leen, charlan, duermen la siesta…';
    box.appendChild(note);
    const cat = document.createElement('div');
    cat.className = 'cat-card';
    cat.innerHTML = '🐈 <b>Bit</b>, el gato de la oficina. No trabaja, pero supervisa.';
    box.appendChild(cat);
  },

  select(a) {
    G.selected = a;
    this.els.assignee.value = a ? a.id : 'equipo';
    for (const [ag, c] of this.cards) c.card.classList.toggle('sel', ag === a);
    if (a && a.mode === 'free' && !a.talking) {
      a.emoteFor('?', 1200);
      a.mutter(pick(['¿Sí?', '¡Hola!', '¿Necesitas algo?', '¡Dime!', 'Estoy libre, ¿qué hacemos?']), 2000);
    }
  },

  renderTeam() {
    for (const [a, c] of this.cards) {
      const ctx = c.cv.getContext('2d');
      ctx.clearRect(0, 0, 24, 24);
      const clone = Object.create(a);
      Object.assign(clone, { x: 12, y: 23, face: 'down', pose: 'stand', walking: false, held: null, emote: null, thinking: false, dancing: false });
      drawAgent(ctx, clone, G.sim);
      const busy = a.mode === 'task';
      c.act.textContent = (busy ? '🛠 ' : '☕ ') + a.activity;
      c.act.classList.toggle('task', busy);
      c.said.textContent = a.lastSaid ? `«${a.lastSaid}»` : '';
      const m = a.mood();
      c.mood.textContent = `${m.icon} ${m.text}`;
      for (const i of c.bars) {
        const v = a.needs[i.dataset.k];
        i.style.width = `${v}%`;
        i.className = v < 25 ? 'low' : v < 55 ? 'mid' : '';
      }
    }
  },

  // ---------- encargos ----------
  renderTasks() {
    const box = this.els.tasks;
    if (!box) return;
    box.innerHTML = '';
    const row = (t, queued) => {
      const d = document.createElement('div');
      d.className = 'taskcard' + (queued ? ' queued' : '');
      const who = t.assignee === 'equipo' ? '👥' : G.agents.find((a) => a.id === t.assignee).name;
      d.innerHTML = `${queued ? '⏳' : '<span class="spinner"></span>'}
        <span class="t">#${t.id} ${escapeHTML(t.text)}</span>
        <span class="tp">${t.tipo ? TYPE_LABEL[t.tipo] : ''} ${escapeHTML(who)}</span>
        <span class="ph">${escapeHTML(t.phase)}</span>`;
      box.appendChild(d);
    };
    G.active.forEach((t) => row(t, false));
    G.queue.forEach((t) => row(t, true));
  },

  // ---------- registro ----------
  log(msg, type = '') {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ts">${fmtClock(G.minutes)}</span>`;
    const s = document.createElement('span');
    s.className = type;
    s.textContent = msg;
    li.appendChild(s);
    this._pushLog(li);
  },
  logSay(agent, text) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ts">${fmtClock(G.minutes)}</span><b style="color:${agent.color}">${escapeHTML(agent.name)}:</b> `;
    li.appendChild(document.createTextNode(text));
    this._pushLog(li);
  },
  _pushLog(li) {
    const log = this.els.log;
    const atBottom = log.parentElement.scrollTop + log.parentElement.clientHeight >= log.parentElement.scrollHeight - 30;
    log.appendChild(li);
    while (log.children.length > 250) log.removeChild(log.firstChild);
    if (atBottom) log.parentElement.scrollTop = log.parentElement.scrollHeight;
    if (this.tab !== 'log') { this.unreadLog++; this.els.logBadge.textContent = this.unreadLog > 99 ? '99+' : this.unreadLog; }
  },

  // ---------- resultados ----------
  addResult(r) {
    const box = this.els.results;
    const empty = box.querySelector('.empty');
    if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = 'result';
    const title = (r.md.match(/^#\s+(.+)/m) || [null, r.text])[1];
    d.innerHTML = `<h3>${escapeHTML(shortTask(title, 70))}</h3>
      <p>#${r.id} · ${TYPE_LABEL[r.tipo] || ''} · ${escapeHTML(r.team.join(', '))} · ${escapeHTML(r.time)} ${r.ai ? '· 🟢 IA' : '· 🟡 simulado'}</p>`;
    d.addEventListener('click', () => this.openReport(r));
    box.prepend(d);
    if (this.tab !== 'results') { this.unreadRes++; this.els.resBadge.textContent = this.unreadRes; }
  },
  openReport(r) {
    this.current = r;
    document.getElementById('reportMeta').textContent = `Encargo #${r.id}: «${r.text}» — ${r.team.join(', ')} · ${r.time}`;
    document.getElementById('reportBody').innerHTML = md2html(r.md);
    document.getElementById('reportDlg').showModal();
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.els.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  },

  // ---------- bocadillos ----------
  bubble(ent, text, ms, small) {
    this.clearBubble(ent);
    const el = document.createElement('div');
    el.className = 'bubble' + (small ? ' small' : '') + (ent instanceof Cat ? ' cat' : '');
    if (!small && ent.name && ent.color) {
      const who = document.createElement('span');
      who.className = 'who';
      who.style.color = ent.color;
      who.textContent = ent.name.toUpperCase();
      el.appendChild(who);
    }
    const txt = document.createElement('span');
    el.appendChild(txt);
    this.els.overlay.appendChild(el);
    this.bubbles.set(ent, { el, txt, text, start: G.sim, until: G.sim + ms, small });
  },
  clearBubble(ent) {
    const b = this.bubbles.get(ent);
    if (b) { b.el.remove(); this.bubbles.delete(ent); }
  },
  frame() {
    const W = this.els.overlay.clientWidth;
    for (const [ent, b] of this.bubbles) {
      if (G.sim > b.until) { this.clearBubble(ent); continue; }
      const n = Math.min(b.text.length, Math.floor((G.sim - b.start) / 22) + 1);
      if (b.shown !== n) { b.txt.textContent = b.text.slice(0, n); b.shown = n; }
      let head = 28;
      if (ent instanceof Cat) head = 14;
      else if (ent.pose === 'sit') head = 25;
      else if (ent.pose === 'lie') head = 16;
      if (ent.emote || ent.thinking) head += 11;
      const w = b.el.offsetWidth, h = b.el.offsetHeight;
      const x = ent.x * this.scale;
      const left = clamp(x, w / 2 + 2, W - w / 2 - 2);
      const top = Math.max((ent.y - head) * this.scale - 6, h + 2);
      b.el.style.left = `${left}px`;
      b.el.style.top = `${top}px`;
      b.el.style.setProperty('--tail', `${clamp(x - left + w / 2, 10, w - 10)}px`);
    }
  },

  onCanvasClick(e) {
    const r = this.els.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * VW;
    const y = (e.clientY - r.top) / r.height * VH;
    let best = null, bd = 14;
    for (const a of G.agents) {
      const d = Math.hypot(a.x - x, (a.y - 10) - y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { this.select(best); return; }
    if (G.cat && Math.hypot(G.cat.x - x, G.cat.y - 5 - y) < 12) {
      if (!G.cat.busy) G.cat.getPetted();
      return;
    }
    this.select(null);
  },
};
