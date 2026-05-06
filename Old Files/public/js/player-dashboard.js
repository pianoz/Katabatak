const token  = localStorage.getItem('token');
const gameId = sessionStorage.getItem('gameId');
if (!token || !gameId) window.location.href = '/landing';

async function api(path, opts = {}) {
  opts.headers = { ...opts.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await fetch(path, opts);
  if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
  return res;
}

window.logout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

// ── Tabs ──────────────────────────────────────────────────────────────────────
window.switchTab = (name) => {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const panels = ['characters', 'skills'];
    t.classList.toggle('active', panels[i] === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  if (name === 'skills') renderSkillTree();
};

// ── Game info ─────────────────────────────────────────────────────────────────
async function loadGame() {
  const res  = await api(`/api/games/${gameId}`);
  const game = await res.json();
  document.getElementById('game-name').textContent = game.name;
}

// ── Characters ────────────────────────────────────────────────────────────────
let myChars = [];
let activeCharId = null;

async function loadCharacters() {
  const res   = await api('/api/characters');
  const chars = await res.json();
  myChars     = chars.filter(c => c.game_id === parseInt(gameId));
  renderCharList();
  populateCharSelect();
}

function renderCharList() {
  const list = document.getElementById('characters-list');
  if (!myChars.length) {
    list.innerHTML = '<p class="muted">No characters yet.</p>';
    return;
  }
  list.innerHTML = myChars.map(c => `
    <div class="card" style="cursor:pointer" onclick="selectChar(${c.id})">
      <h3>${c.name}</h3>
      <p>${c.class || 'Unknown class'} · Lvl ${c.level}</p>
    </div>
  `).join('');
}

window.selectChar = async (id) => {
  activeCharId = id;
  const res  = await api(`/api/characters/${id}`);
  const char = await res.json();
  const panel = document.getElementById('char-detail');
  panel.style.display = 'block';
  document.getElementById('detail-name').textContent  = char.name;
  document.getElementById('detail-class').textContent = char.class || '—';
  document.getElementById('detail-level').textContent = char.level;
  document.getElementById('detail-notes').textContent = char.notes || '';
  document.getElementById('detail-skills').textContent =
    char.skills.length ? char.skills.map(s => s.name).join(', ') : 'none';
};

window.openCreateChar = () => {
  document.getElementById('create-char-form').style.display = 'block';
};

window.createCharacter = async () => {
  const name  = document.getElementById('char-name').value.trim();
  const cls   = document.getElementById('char-class').value.trim();
  const notes = document.getElementById('char-notes').value.trim();
  const errEl = document.getElementById('char-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Name required'; return; }
  const res = await api('/api/characters', {
    method: 'POST',
    body: JSON.stringify({ name, game_id: parseInt(gameId), class: cls, notes }),
  });
  if (!res.ok) { const d = await res.json(); errEl.textContent = d.error; return; }
  document.getElementById('create-char-form').style.display = 'none';
  loadCharacters();
};

window.deleteCharacter = async () => {
  if (!activeCharId || !confirm('Delete this character?')) return;
  await api(`/api/characters/${activeCharId}`, { method: 'DELETE' });
  activeCharId = null;
  document.getElementById('char-detail').style.display = 'none';
  loadCharacters();
};

function populateCharSelect() {
  const sel = document.getElementById('active-char');
  sel.innerHTML = '<option value="">— select —</option>' +
    myChars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.onchange = () => { activeCharId = parseInt(sel.value) || null; };
}

// ── Skill tree (read-only with unlock) ────────────────────────────────────────
let nodes = [], edges = [], unlockedIds = new Set();
const NODE_R = 28;

async function loadSkillTree() {
  const res  = await api(`/api/skills/game/${gameId}`);
  const data = await res.json();
  nodes = data.nodes;
  edges = data.edges;
}

async function loadUnlocked() {
  if (!activeCharId) return;
  const res  = await api(`/api/characters/${activeCharId}`);
  const char = await res.json();
  unlockedIds = new Set(char.skills.map(s => s.id));
}

function renderSkillTree() {
  Promise.all([loadSkillTree(), loadUnlocked()]).then(drawCanvas);
}

function drawCanvas() {
  const canvas = document.getElementById('skill-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#2e2d45';
  ctx.lineWidth   = 2;
  for (const e of edges) {
    const a = nodes.find(n => n.id === e.source_node_id);
    const b = nodes.find(n => n.id === e.target_node_id);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.pos_x, a.pos_y);
    ctx.lineTo(b.pos_x, b.pos_y);
    ctx.stroke();
  }

  for (const n of nodes) {
    const unlocked = unlockedIds.has(n.id);
    ctx.beginPath();
    ctx.arc(n.pos_x, n.pos_y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle   = unlocked ? '#27ae60' : '#1a1929';
    ctx.strokeStyle = unlocked ? '#27ae60' : '#7a7890';
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle    = unlocked ? '#fff' : '#e8e6d9';
    ctx.font         = '11px Georgia';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.name.length > 10 ? n.name.slice(0, 9) + '…' : n.name, n.pos_x, n.pos_y);
  }
}

function nodeAt(x, y) {
  return nodes.find(n => Math.hypot(n.pos_x - x, n.pos_y - y) <= NODE_R);
}

function initCanvas() {
  const canvas = document.getElementById('skill-canvas');
  if (!canvas) return;
  canvas.addEventListener('click', async (e) => {
    if (!activeCharId) { alert('Select a character first.'); return; }
    const rect = canvas.getBoundingClientRect();
    const hit  = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    if (unlockedIds.has(hit.id)) return;
    await api(`/api/characters/${activeCharId}/skills/${hit.id}`, { method: 'POST' });
    await loadUnlocked();
    drawCanvas();
    if (activeCharId) selectChar(activeCharId);
  });
}

loadGame();
loadCharacters();
initCanvas();
