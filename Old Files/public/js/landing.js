const token = localStorage.getItem('token');
if (!token) window.location.href = '/login';

async function api(path, opts = {}) {
  opts.headers = { ...opts.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await fetch(path, opts);
  if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
  return res;
}

window.logout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

async function loadUser() {
  const res  = await api('/api/auth/me');
  const user = await res.json();
  document.getElementById('nav-username').textContent = user.username;
}

async function loadGames() {
  const res   = await api('/api/games');
  const games = await res.json();
  const list  = document.getElementById('games-list');
  if (!games.length) {
    list.innerHTML = '<p class="muted">No games yet — create one or join with an invite code.</p>';
    return;
  }
  list.innerHTML = games.map(g => `
    <div class="card" style="cursor:pointer" onclick="enterGame(${g.id},'${g.role}')">
      <div class="flex">
        <h3>${g.name}</h3>
        <span class="badge badge-${g.role}">${g.role.toUpperCase()}</span>
      </div>
      <p>${g.description || 'No description'}</p>
    </div>
  `).join('');
}

window.enterGame = (id, role) => {
  sessionStorage.setItem('gameId', id);
  window.location.href = role === 'dm' ? '/dm' : '/player';
};

window.openCreateModal = () => {
  document.getElementById('create-modal').style.display = 'flex';
};
window.openJoinModal = () => {
  document.getElementById('join-modal').style.display = 'flex';
};
window.closeModals = () => {
  document.getElementById('create-modal').style.display = 'none';
  document.getElementById('join-modal').style.display   = 'none';
};

window.createGame = async () => {
  const name = document.getElementById('create-name').value.trim();
  const desc = document.getElementById('create-desc').value.trim();
  const errEl = document.getElementById('create-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Name required'; return; }
  const res  = await api('/api/games', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error; return; }
  closeModals();
  loadGames();
};

window.joinGame = async () => {
  const code  = document.getElementById('join-code').value.trim().toUpperCase();
  const errEl = document.getElementById('join-error');
  errEl.textContent = '';
  if (!code) { errEl.textContent = 'Code required'; return; }
  const res  = await api('/api/games/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) });
  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error; return; }
  closeModals();
  loadGames();
};

loadUser();
loadGames();
