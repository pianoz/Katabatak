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
    const panels = ['players', 'skills', 'settings'];
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
  document.getElementById('invite-code').textContent = game.invite_code;
  document.getElementById('game-id-display').textContent = `Game ID: ${game.id}`;
}

// ── Members ───────────────────────────────────────────────────────────────────
async function loadMembers() {
  const res     = await api(`/api/games/${gameId}/members`);
  const members = await res.json();
  document.getElementById('members-list').innerHTML = members.map(m => `
    <div class="card">
      <div class="flex">
        <strong>${m.username}</strong>
        <span class="badge badge-${m.role}">${m.role.toUpperCase()}</span>
      </div>
    </div>
  `).join('') || '<p class="muted">No members.</p>';
}

// ── Skill tree (canvas) ───────────────────────────────────────────────────────
let nodes = [], edges = [], selectedNode = null;
const NODE_R = 28;

async function loadSkillTree() {
  const res  = await api(`/api/skills/game/${gameId}`);
  const data = await res.json();
  nodes = data.nodes;
  edges = data.edges;
}

function renderSkillTree() {
  loadSkillTree().then(drawCanvas);
}

function drawCanvas() {
  const canvas = document.getElementById('skill-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Edges
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

  // Nodes
  for (const n of nodes) {
    const isSelected = selectedNode && selectedNode.id === n.id;
    ctx.beginPath();
    ctx.arc(n.pos_x, n.pos_y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle   = isSelected ? '#c9a84c' : '#1a1929';
    ctx.strokeStyle = isSelected ? '#c9a84c' : '#7a7890';
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle  = isSelected ? '#0f0e17' : '#e8e6d9';
    ctx.font       = '11px Georgia';
    ctx.textAlign  = 'center';
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
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = nodeAt(x, y);

    if (e.shiftKey && selectedNode && hit && hit.id !== selectedNode.id) {
      // Connect two nodes
      await api('/api/skills/edge', {
        method: 'POST',
        body: JSON.stringify({ source_node_id: selectedNode.id, target_node_id: hit.id }),
      });
      selectedNode = null;
      renderSkillTree();
      return;
    }

    selectedNode = hit || null;

    if (!hit) {
      // Place new node at click position (after opening add form, store coords)
      document.getElementById('add-node-form')._pendingX = x;
      document.getElementById('add-node-form')._pendingY = y;
    }
    drawCanvas();
  });

  canvas.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const hit  = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    if (!confirm(`Delete node "${hit.name}"?`)) return;
    await api(`/api/skills/${hit.id}`, { method: 'DELETE' });
    selectedNode = null;
    renderSkillTree();
  });
}

window.openAddNode = () => {
  document.getElementById('add-node-form').style.display = 'block';
};

window.addNode = async () => {
  const name  = document.getElementById('node-name').value.trim();
  const desc  = document.getElementById('node-desc').value.trim();
  const tier  = parseInt(document.getElementById('node-tier').value) || 0;
  const form  = document.getElementById('add-node-form');
  const errEl = document.getElementById('node-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Name required'; return; }

  const canvas = document.getElementById('skill-canvas');
  const pos_x  = form._pendingX ?? canvas.width  / 2;
  const pos_y  = form._pendingY ?? canvas.height / 2;

  const res = await api('/api/skills', {
    method: 'POST',
    body: JSON.stringify({ game_id: parseInt(gameId), name, description: desc, tier, pos_x, pos_y }),
  });
  if (!res.ok) { const d = await res.json(); errEl.textContent = d.error; return; }
  form.style.display = 'none';
  form._pendingX = undefined;
  form._pendingY = undefined;
  renderSkillTree();
};

window.copyInvite = () => {
  const code = document.getElementById('invite-code').textContent;
  navigator.clipboard.writeText(code).then(() => alert('Copied: ' + code));
};

loadGame();
loadMembers();
initCanvas();
