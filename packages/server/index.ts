import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { handleGMMessage } from './gm/handler.js'
import { summarizeHistory } from './gm/agents/summary.js'
import { runEval } from './gm/services/claude-service.js'
import { requireGmKey } from './middleware/auth.js'
import { adminRouter, sessionMiddleware } from './admin/routes.js'
import { logRequest } from './admin/request-logger.js'
import type { ConversationTurn } from './gm/types.js'

console.log('====================================================')
console.log('⚔️  KATABATAK GAME SERVER INITIALIZATION ACTIVE  ⚔️')
console.log('====================================================')
console.log('🤖 Standby: Claude GM engine online.')
console.log('📂 Tools directory mapped successfully.')
console.log('----------------------------------------------------')

const app = express()

// CORS — restrict to configured web app origin
app.use(cors({ origin: process.env.WEB_APP_ORIGIN ?? '*', credentials: true }))

// Body parsers
app.use(express.json())
app.use(express.urlencoded({ extended: false })) // for admin form POSTs

// Session middleware (needed by admin router; must be before /admin mount)
app.use(sessionMiddleware)

// Rate limiter on GM endpoints
const gmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GM_RATE_LIMIT ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
})

// Admin UI — no GM key required, has its own session auth
app.use('/admin', adminRouter)

// Health check — public
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// All /gm routes require the shared API key
app.use('/gm', requireGmKey)
app.use('/gm', gmLimiter)

app.post('/gm', async (req, res) => {
  const { message, conversationHistory, characterId, gameId } = req.body as {
    message?: string
    conversationHistory?: ConversationTurn[]
    characterId?: string
    gameId?: string
  }
  if (!message) {
    res.status(400).json({ error: 'message is required' })
    return
  }
  if (!characterId) {
    res.status(400).json({ error: 'characterId is required' })
    return
  }

  const start = Date.now()
  let toolCallCount = 0
  let statusCode = 200

  try {
    const response = await handleGMMessage({
      message,
      conversationHistory,
      characterId,
      gameId,
      onToolCall: () => { toolCallCount++ },
    })
    res.json({ response })
  } catch (err) {
    console.error('[GM] Error:', err instanceof Error ? err.message : String(err))
    statusCode = 500
    res.status(500).json({ error: 'GM handler failed' })
  } finally {
    logRequest({
      timestamp: new Date().toISOString(),
      endpoint: '/gm',
      characterId,
      toolCallCount,
      durationMs: Date.now() - start,
      statusCode,
    })
  }
})

app.post('/gm/summarize', async (req, res) => {
  const { history, existingSummary } = req.body as {
    history?: unknown
    existingSummary?: string
  }
  if (!history || !Array.isArray(history)) {
    res.status(400).json({ error: 'history array is required' })
    return
  }

  const start = Date.now()
  let statusCode = 200

  try {
    const summary = await summarizeHistory({
      history: history as ConversationTurn[],
      existingSummary: existingSummary ?? null,
    })
    res.json({ summary })
  } catch (err) {
    console.error('[SUMMARY] Error:', err instanceof Error ? err.message : String(err))
    statusCode = 500
    res.status(500).json({ error: 'Summary agent failed' })
  } finally {
    logRequest({
      timestamp: new Date().toISOString(),
      endpoint: '/gm/summarize',
      toolCallCount: 0,
      durationMs: Date.now() - start,
      statusCode,
    })
  }
})

app.post('/eval', async (req, res) => {
  const { prompt, messages, system, model, maxTokens } = req.body as {
    prompt?: string
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>
    system?: string
    model?: string
    maxTokens?: number
  }
  const hasInput = prompt || (Array.isArray(messages) && messages.length > 0)
  if (!hasInput) {
    res.status(400).json({ error: 'prompt or messages is required' })
    return
  }
  try {
    const result = await runEval({ prompt, messages, system, model, maxTokens })
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isAuthError = message.toLowerCase().includes('api_key') || message.toLowerCase().includes('authentication')
    res.status(isAuthError ? 401 : 500).json({ error: message })
  }
})

const PORT = process.env.PORT ?? process.env.GM_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`🎲 GM Server listening on http://localhost:${PORT}`)
  console.log(`🔧 Admin UI: http://localhost:${PORT}/admin`)
})

setInterval(() => {}, 1000)
