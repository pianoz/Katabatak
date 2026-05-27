import { Router, type Request, type Response, type NextFunction } from 'express'
import session from 'express-session'
import { getRecentRequests, getStats } from './request-logger.js'

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

function dashboardPage(uptimeSec: number): string {
  const { totalRequests, lastRequestAt } = getStats()
  const recentRequests = getRecentRequests().slice(0, 20)

  const uptimeStr = [
    Math.floor(uptimeSec / 3600) + 'h',
    Math.floor((uptimeSec % 3600) / 60) + 'm',
    (uptimeSec % 60) + 's',
  ].join(' ')

  const rows = recentRequests
    .map(
      (r) => `<tr>
      <td>${r.timestamp.replace('T', ' ').slice(0, 19)}</td>
      <td>${r.endpoint}</td>
      <td>${r.characterId ?? '—'}</td>
      <td>${r.toolCallCount}</td>
      <td>${r.durationMs}ms</td>
      <td class="${r.statusCode >= 400 ? 'err' : 'ok'}">${r.statusCode}</td>
    </tr>`,
    )
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
  td { padding: 0.5rem; border-bottom: 1px solid #18181b; }
  tr:hover td { background: #111; }
  .ok { color: #22c55e; }
  .err { color: #ef4444; }
  section { margin-bottom: 2rem; }
  h2 { font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; color: #71717a; margin-bottom: 1rem; }
  .env-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .env-row { display: flex; justify-content: space-between; font-size: 0.7rem; padding: 0.4rem; border: 1px solid #18181b; }
  .env-key { color: #71717a; }
  .env-val { color: #a1a1aa; }
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
      <div class="stat-value">${uptimeStr}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Requests</div>
      <div class="stat-value">${totalRequests}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Last Request</div>
      <div class="stat-value" style="font-size:0.85rem">${lastRequestAt?.slice(11, 19) ?? '—'}</div>
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
  </div>
</section>

<section>
  <h2>Recent Requests (last 20)</h2>
  <table>
    <thead><tr>
      <th>Time</th><th>Endpoint</th><th>Character</th><th>Tool Calls</th><th>Duration</th><th>Status</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="color:#3f3f46;padding:1rem">No requests yet</td></tr>'}</tbody>
  </table>
</section>
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
