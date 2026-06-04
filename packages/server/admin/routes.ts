import { Router, type Request, type Response, type NextFunction } from 'express'
import session from 'express-session'
import { getRecentRequests, getStats, getTrace } from './request-logger.js'

// Augment express-session types
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean
  }
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const SESSION_SECRET = process.env.SESSION_SECRET

if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
  throw new Error(
    'Admin env vars required: ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET',
  )
}

export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 2 * 60 * 60 * 1000 }, // 2h
})

const serverStart = Date.now()

function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) return next()
  res.redirect('/admin/login')
}

function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GM Server — Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #d4d4d4; font-family: 'Courier New', monospace; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { border: 1px solid #27272a; padding: 2rem; width: 360px; }
  h1 { font-size: 0.65rem; letter-spacing: 0.4em; text-transform: uppercase; color: #22d3ee; margin-bottom: 2rem; }
  label { display: block; font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; color: #71717a; margin-bottom: 0.4rem; }
  input { width: 100%; background: #000; border: 1px solid #3f3f46; color: #e4e4e7; padding: 0.6rem 0.75rem; font-family: inherit; font-size: 0.85rem; margin-bottom: 1.25rem; outline: none; }
  input:focus { border-color: #22d3ee; }
  button { width: 100%; background: #000; border: 1px solid #22d3ee; color: #22d3ee; font-family: inherit; font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; padding: 0.75rem; cursor: pointer; }
  button:hover { background: #22d3ee; color: #000; }
  .error { font-size: 0.7rem; color: #ef4444; margin-bottom: 1rem; letter-spacing: 0.1em; }
</style>
</head>
<body>
<div class="card">
  <h1>⚔ GM Server // Admin</h1>
  ${error ? `<p class="error">${error}</p>` : ''}
  <form method="POST" action="/admin/login">
    <label>Username</label>
    <input type="text" name="username" autocomplete="username" required>
    <label>Password</label>
    <input type="password" name="password" autocomplete="current-password" required>
    <button type="submit">Enter</button>
  </form>
</div>
</body>
</html>`
}

function formatUptime(sec: number): string {
  return [
    Math.floor(sec / 3600) + 'h',
    Math.floor((sec % 3600) / 60) + 'm',
    (sec % 60) + 's',
  ].join(' ')
}

function dashboardPage(uptimeSec: number): string {
  const { totalRequests, lastRequestAt } = getStats()
  const recentRequests = getRecentRequests().slice(0, 50)
  const uptimeStr = formatUptime(uptimeSec)

  const rows = recentRequests
    .map((r) => {
      const statusClass = r.statusCode >= 400 ? 'err' : 'ok'
      const errEscaped = r.errorMessage
        ? r.errorMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        : ''
      const statusCell = r.errorMessage
        ? `<details><summary class="${statusClass} err-summary">${r.statusCode}</summary><pre class="err-detail">${errEscaped}</pre></details>`
        : `<span class="${statusClass}">${r.statusCode}</span>`
      const stageCell = r.stageTiming
        ? `H:${r.stageTiming.hydratorMs}ms L:${r.stageTiming.loreMs}ms A:${r.stageTiming.architectMs}ms`
        : '—'
      const ridShort = r.requestId ? r.requestId.slice(0, 8) : '—'
      const traceCell = r.requestId
        ? `<span class="rid" data-rid="${r.requestId}" title="${r.requestId}">${ridShort}</span>`
        : '<span style="color:#3f3f46">—</span>'
      const ep = r.endpoint ?? ''
      const char = r.characterId ?? ''
      return `<tr data-ep="${ep}" data-char="${char}" data-status="${r.statusCode >= 400 ? 'error' : 'ok'}">
      <td>${r.timestamp.replace('T', ' ').slice(0, 19)}</td>
      <td>${ep}</td>
      <td>${char || '—'}</td>
      <td>${r.toolCallCount}</td>
      <td>${r.durationMs}ms</td>
      <td>${stageCell}</td>
      <td>${statusCell}</td>
      <td>${traceCell}</td>
    </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GM Server — Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #d4d4d4; font-family: 'Courier New', monospace; padding: 2rem; }
  header { display: flex; align-items: baseline; gap: 2rem; margin-bottom: 2rem; border-bottom: 1px solid #27272a; padding-bottom: 1rem; }
  h1 { font-size: 0.65rem; letter-spacing: 0.4em; text-transform: uppercase; color: #22d3ee; }
  nav a { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; text-decoration: none; }
  nav a:hover { color: #22d3ee; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .stat { border: 1px solid #27272a; padding: 1rem; }
  .stat-label { font-size: 0.55rem; letter-spacing: 0.3em; text-transform: uppercase; color: #71717a; margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.25rem; color: #22d3ee; }
  table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  th { font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: #71717a; text-align: left; padding: 0.5rem; border-bottom: 1px solid #27272a; }
  td { padding: 0.5rem; border-bottom: 1px solid #18181b; vertical-align: top; }
  tr:hover td { background: #111; }
  .ok { color: #22c55e; }
  .err { color: #ef4444; }
  section { margin-bottom: 2rem; }
  h2 { font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; color: #71717a; margin-bottom: 1rem; }
  .env-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .env-row { display: flex; justify-content: space-between; font-size: 0.7rem; padding: 0.4rem; border: 1px solid #18181b; }
  .env-key { color: #71717a; }
  .env-val { color: #a1a1aa; }
  .live-bar { display: flex; align-items: center; gap: 0.75rem; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #3f3f46; margin-bottom: 0.75rem; }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .err-summary { cursor: pointer; list-style: none; }
  .err-summary::-webkit-details-marker { display: none; }
  .err-summary::after { content: ' ▸'; font-size: 0.6em; opacity: 0.6; }
  details[open] .err-summary::after { content: ' ▾'; }
  .err-detail { margin-top: 0.5rem; padding: 0.75rem; background: #0f0606; border: 1px solid #3f1010; color: #fca5a5; font-size: 0.65rem; white-space: pre-wrap; word-break: break-all; max-width: 600px; max-height: 200px; overflow-y: auto; }
  /* Correlation ID */
  .rid { color: #22d3ee; cursor: pointer; font-size: 0.7rem; letter-spacing: 0.05em; border-bottom: 1px dashed #22d3ee44; }
  .rid:hover { color: #fff; border-color: #fff; }
  /* Filter bar */
  .filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .filter-bar input, .filter-bar select { background: #000; border: 1px solid #3f3f46; color: #e4e4e7; padding: 0.4rem 0.6rem; font-family: inherit; font-size: 0.65rem; outline: none; min-width: 140px; }
  .filter-bar input:focus, .filter-bar select:focus { border-color: #22d3ee; }
  .filter-bar label { font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; display: flex; flex-direction: column; gap: 0.3rem; }
  /* Trace drawer */
  #trace-drawer { position: fixed; top: 0; right: -700px; width: 680px; height: 100vh; background: #0d0d0d; border-left: 1px solid #27272a; overflow-y: auto; padding: 1.5rem; transition: right 0.2s ease; z-index: 100; }
  #trace-drawer.open { right: 0; }
  #trace-close { position: absolute; top: 1rem; right: 1rem; background: none; border: 1px solid #3f3f46; color: #71717a; font-family: inherit; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.3rem 0.6rem; cursor: pointer; }
  #trace-close:hover { border-color: #22d3ee; color: #22d3ee; }
  #trace-rid { font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; margin-bottom: 1rem; }
  #trace-rid span { color: #22d3ee; }
  .trace-table { width: 100%; border-collapse: collapse; font-size: 0.7rem; }
  .trace-table th { font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: #3f3f46; padding: 0.4rem; border-bottom: 1px solid #18181b; text-align: left; }
  .trace-table td { padding: 0.4rem; border-bottom: 1px solid #111; vertical-align: top; white-space: pre-wrap; word-break: break-all; }
  .trace-table td:first-child { color: #52525b; white-space: nowrap; min-width: 80px; }
  .trace-table td:nth-child(2) { color: #22d3ee; white-space: nowrap; min-width: 110px; }
  .trace-table td:nth-child(3) { color: #d4d4d4; }
  .trace-empty { color: #3f3f46; font-size: 0.7rem; padding: 1rem 0; }
  .trace-detail { margin-top: 0.3rem; padding: 0.4rem; background: #111; border: 1px solid #1c1c1c; color: #a1a1aa; font-size: 0.6rem; max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body>
<header>
  <h1>⚔ GM Server // Dashboard</h1>
  <nav>
    <form method="POST" action="/admin/logout" style="display:inline">
      <button style="background:none;border:none;cursor:pointer;font-family:inherit;" type="submit">
        <a style="color:#71717a;font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;">Logout</a>
      </button>
    </form>
  </nav>
</header>

<section>
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Uptime</div>
      <div class="stat-value" id="stat-uptime">${uptimeStr}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Requests</div>
      <div class="stat-value" id="stat-requests">${totalRequests}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Last Request</div>
      <div class="stat-value" id="stat-last" style="font-size:0.85rem">${lastRequestAt?.slice(11, 19) ?? '—'}</div>
    </div>
  </div>
</section>

<section>
  <h2>Configuration</h2>
  <div class="env-grid">
    <div class="env-row"><span class="env-key">GM_PORT</span><span class="env-val">${process.env.GM_PORT ?? '3001'}</span></div>
    <div class="env-row"><span class="env-key">WEB_APP_ORIGIN</span><span class="env-val">${process.env.WEB_APP_ORIGIN ?? '(any)'}</span></div>
    <div class="env-row"><span class="env-key">SUPABASE_URL</span><span class="env-val">${process.env.SUPABASE_URL ? '✓ set' : '✗ missing'}</span></div>
    <div class="env-row"><span class="env-key">ANTHROPIC_API_KEY</span><span class="env-val">${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ missing'}</span></div>
    <div class="env-row"><span class="env-key">SUPABASE_SECRET_KEY</span><span class="env-val">${process.env.SUPABASE_SECRET_KEY ? '✓ set' : '✗ missing'}</span></div>
    <div class="env-row"><span class="env-key">GM_API_KEY</span><span class="env-val">${process.env.GM_API_KEY ? '✓ set' : '✗ missing'}</span></div>
  </div>
</section>

<section>
  <div class="live-bar">
    <div class="live-dot"></div>
    <span>Live — refreshing every 5s</span>
    <span id="last-refreshed"></span>
  </div>
  <h2>Recent Requests (last 50)</h2>
  <div class="filter-bar">
    <label>Endpoint <input id="f-ep" type="text" placeholder="e.g. /gm"></label>
    <label>Character ID <input id="f-char" type="text" placeholder="UUID fragment"></label>
    <label>Status <select id="f-status"><option value="">All</option><option value="ok">OK</option><option value="error">Error</option></select></label>
  </div>
  <table>
    <thead><tr>
      <th>Time</th><th>Endpoint</th><th>Character</th><th>Tool Calls</th><th>Duration</th><th>Stages</th><th>Status</th><th>Trace ID</th>
    </tr></thead>
    <tbody id="req-tbody">${rows || '<tr><td colspan="8" style="color:#3f3f46;padding:1rem">No requests yet</td></tr>'}</tbody>
  </table>
</section>

<!-- Trace drawer -->
<div id="trace-drawer">
  <button id="trace-close">✕ Close</button>
  <div id="trace-rid">Trace ID: <span id="trace-rid-val">—</span></div>
  <div id="trace-content"><p class="trace-empty">Select a trace ID to view pipeline logs.</p></div>
</div>

<script>
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function buildRow(r) {
  const cls = r.statusCode >= 400 ? 'err' : 'ok';
  const statusCell = r.errorMessage
    ? '<details><summary class="' + cls + ' err-summary">' + r.statusCode + '</summary><pre class="err-detail">' + esc(r.errorMessage) + '</pre></details>'
    : '<span class="' + cls + '">' + r.statusCode + '</span>';
  const stageCell = r.stageTiming
    ? 'H:' + r.stageTiming.hydratorMs + 'ms L:' + r.stageTiming.loreMs + 'ms A:' + r.stageTiming.architectMs + 'ms'
    : '—';
  const ridShort = r.requestId ? r.requestId.slice(0, 8) : '—';
  const traceCell = r.requestId
    ? '<span class="rid" data-rid="' + r.requestId + '" title="' + r.requestId + '">' + ridShort + '</span>'
    : '<span style="color:#3f3f46">—</span>';
  const ep = r.endpoint || '';
  const char = r.characterId || '';
  return '<tr data-ep="' + ep + '" data-char="' + char + '" data-status="' + (r.statusCode >= 400 ? 'error' : 'ok') + '">'
    + '<td>' + r.timestamp.replace('T',' ').slice(0,19) + '</td>'
    + '<td>' + ep + '</td>'
    + '<td>' + (char || '—') + '</td>'
    + '<td>' + r.toolCallCount + '</td>'
    + '<td>' + r.durationMs + 'ms</td>'
    + '<td>' + stageCell + '</td>'
    + '<td>' + statusCell + '</td>'
    + '<td>' + traceCell + '</td>'
    + '</tr>';
}
async function refresh() {
  try {
    const res = await fetch('/admin/api/data');
    if (!res.ok) return;
    const d = await res.json();
    document.getElementById('stat-uptime').textContent = d.uptimeStr;
    document.getElementById('stat-requests').textContent = d.totalRequests;
    document.getElementById('stat-last').textContent = d.lastRequestAt ? d.lastRequestAt.slice(11,19) : '—';
    const tbody = document.getElementById('req-tbody');
    tbody.innerHTML = d.requests.length
      ? d.requests.map(buildRow).join('')
      : '<tr><td colspan="8" style="color:#3f3f46;padding:1rem">No requests yet</td></tr>';
    attachRidListeners();
    applyFilters();
    document.getElementById('last-refreshed').textContent = new Date().toLocaleTimeString();
  } catch (_) {}
}

// ── Filter logic ──────────────────────────────────────────────────────────────
function applyFilters() {
  const ep = document.getElementById('f-ep').value.toLowerCase();
  const char = document.getElementById('f-char').value.toLowerCase();
  const status = document.getElementById('f-status').value;
  document.querySelectorAll('#req-tbody tr[data-ep]').forEach(function(row) {
    const matchEp = !ep || row.dataset.ep.toLowerCase().includes(ep);
    const matchChar = !char || row.dataset.char.toLowerCase().includes(char);
    const matchStatus = !status || row.dataset.status === status;
    row.style.display = (matchEp && matchChar && matchStatus) ? '' : 'none';
  });
}
['f-ep','f-char','f-status'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', applyFilters);
});

// ── Trace drawer ──────────────────────────────────────────────────────────────
var drawer = document.getElementById('trace-drawer');
document.getElementById('trace-close').addEventListener('click', function() {
  drawer.classList.remove('open');
});

function attachRidListeners() {
  document.querySelectorAll('.rid[data-rid]').forEach(function(el) {
    el.addEventListener('click', function() { openTrace(el.dataset.rid); });
  });
}

async function openTrace(requestId) {
  document.getElementById('trace-rid-val').textContent = requestId;
  document.getElementById('trace-content').innerHTML = '<p class="trace-empty">Loading...</p>';
  drawer.classList.add('open');
  try {
    const res = await fetch('/admin/api/trace/' + requestId);
    if (!res.ok) throw new Error('fetch failed');
    const d = await res.json();
    if (!d.entries.length) {
      document.getElementById('trace-content').innerHTML = '<p class="trace-empty">No trace entries recorded for this request.</p>';
      return;
    }
    var html = '<table class="trace-table"><thead><tr><th>Time</th><th>Tag</th><th>Message</th></tr></thead><tbody>';
    d.entries.forEach(function(e) {
      var detailHtml = '';
      if (e.detail !== undefined && e.detail !== null) {
        var detailStr = typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail, null, 2);
        detailHtml = '<div class="trace-detail">' + esc(detailStr) + '</div>';
      }
      html += '<tr>'
        + '<td>' + e.ts.slice(11,23) + '</td>'
        + '<td>' + esc(e.tag) + '</td>'
        + '<td>' + esc(e.msg) + detailHtml + '</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('trace-content').innerHTML = html;
  } catch (_) {
    document.getElementById('trace-content').innerHTML = '<p class="trace-empty">Failed to load trace.</p>';
  }
}

attachRidListeners();
setInterval(refresh, 5000);
refresh();
</script>
</body>
</html>`
}

export const adminRouter = Router()

adminRouter.use(sessionMiddleware)

adminRouter.get('/', (req, res) => {
  res.redirect(req.session.authenticated ? '/admin/dashboard' : '/admin/login')
})

adminRouter.get('/login', (_req, res) => {
  res.send(loginPage())
})

adminRouter.post('/login', (req: Request, res: Response) => {
  const body = req.body as { username?: string; password?: string }
  if (body.username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD) {
    req.session.authenticated = true
    res.redirect('/admin/dashboard')
  } else {
    res.status(401).send(loginPage('Invalid credentials'))
  }
})

adminRouter.get('/dashboard', requireAdminSession, (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - serverStart) / 1000)
  res.send(dashboardPage(uptimeSec))
})

adminRouter.get('/api/data', requireAdminSession, (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - serverStart) / 1000)
  const { totalRequests, lastRequestAt } = getStats()
  res.json({
    uptimeStr: formatUptime(uptimeSec),
    totalRequests,
    lastRequestAt,
    requests: getRecentRequests().slice(0, 50),
  })
})

adminRouter.get('/api/trace/:requestId', requireAdminSession, (req, res) => {
  const requestId = req.params['requestId'] as string
  res.json({ entries: getTrace(requestId) })
})

adminRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'))
})

adminRouter.get('/health', (_req, res) => {
  const { totalRequests, lastRequestAt } = getStats()
  res.json({
    status: 'ok',
    uptimeSec: Math.floor((Date.now() - serverStart) / 1000),
    totalRequests,
    lastRequestAt,
  })
})
