import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { handleGMMessage, runScribe, getRecentTurns, setLedgerNeutered } from './gm/handler.js'
import { clearConversationHistory } from './services/conversation-service.js'
import { summarizeHistory } from './gm/agents/summary.js'
import { runCharacterCreator } from './gm/agents/character-creator.js'
import { runEval } from './gm/services/claude-service.js'
import { autoHydrate } from './gm/auto-hydrator.js'
import { requireGmKey } from './middleware/auth.js'
import { adminRouter, sessionMiddleware } from './admin/routes.js'
import { logRequest } from './admin/request-logger.js'
import { setLogLevel, synLog } from './gm/logger.js'
import type { LogLevel } from './gm/logger.js'
import type { CheckResolution, ContextBlock } from './gm/types.js'

console.log('====================================================')
console.log('⚔️  KATABATAK GAME SERVER INITIALIZATION ACTIVE  ⚔️')
console.log('====================================================')
console.log('🤖 Standby: SYNGEM pipeline online.')
console.log('📂 Tools directory mapped successfully.')
console.log('----------------------------------------------------')

const app = express()

// CORS — restrict to configured web app origin
const WEB_APP_ORIGIN = process.env.WEB_APP_ORIGIN
if (!WEB_APP_ORIGIN) throw new Error('WEB_APP_ORIGIN must be set')
app.use(cors({ origin: WEB_APP_ORIGIN, credentials: true }))

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

// Dev-only: suppress ledger DB writes at runtime
app.post('/dev/neuter-ledger', requireGmKey, (req, res) => {
  const { enabled } = req.body as { enabled?: boolean }
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled (boolean) is required' })
    return
  }
  setLedgerNeutered(enabled)
  res.json({ ok: true, neutered: enabled })
})

// Dev-only: set pipeline log level at runtime
const VALID_LOG_LEVELS: LogLevel[] = ['verbose', 'errors+', 'errors', 'silent']
app.post('/dev/log-level', requireGmKey, (req, res) => {
  const { level } = req.body as { level?: string }
  if (!level || !(VALID_LOG_LEVELS as string[]).includes(level)) {
    res.status(400).json({ error: `level must be one of: ${VALID_LOG_LEVELS.join(', ')}` })
    return
  }
  setLogLevel(level as LogLevel)
  res.json({ ok: true, level })
})

// All /gm routes require the shared API key
app.use('/gm', requireGmKey)
app.use('/gm', gmLimiter)

app.post('/gm', async (req, res) => {
  const { message, characterId, userId, gameId, checkResolution } = req.body as {
    message?: string
    characterId?: string
    userId?: string
    gameId?: string
    checkResolution?: CheckResolution
  }
  if (!message) {
    res.status(400).json({ error: 'message is required' })
    return
  }
  if (!characterId) {
    res.status(400).json({ error: 'characterId is required' })
    return
  }
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const start = Date.now()
  let statusCode = 200
  let errorMessage: string | undefined

  try {
    const generator = handleGMMessage({ message, characterId, userId, gameId, checkResolution })
    const first = await generator.next()

    // If the first yield is a check_required object, return it as JSON immediately
    if (!first.done && typeof first.value === 'object' && 'type' in first.value) {
      res.json(first.value)
      return
    }

    // Otherwise stream as SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const sendChunk = (chunk: string) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }

    // Write the first chunk if there was one
    if (!first.done && typeof first.value === 'string') {
      sendChunk(first.value)
    }

    for await (const value of generator) {
      if (typeof value === 'string') {
        sendChunk(value)
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? errMsg) : errMsg
    console.error('[GM] Error:', stack)
    synLog('HANDLER', `✗ pipeline error: ${errMsg}`)
    statusCode = 500
    errorMessage = stack
    if (!res.headersSent) {
      res.status(500).json({ error: 'GM handler failed' })
    } else {
      res.write(`data: ${JSON.stringify({ error: 'GM handler failed' })}\n\n`)
      res.end()
    }
  } finally {
    logRequest({
      timestamp: new Date().toISOString(),
      endpoint: '/gm',
      characterId,
      toolCallCount: 0,
      durationMs: Date.now() - start,
      statusCode,
      errorMessage,
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
  let errorMessage: string | undefined

  try {
    const summary = await summarizeHistory({
      history: history as Array<{ role: 'player' | 'assistant'; content: string }>,
      existingSummary: existingSummary ?? null,
    })
    res.json({ summary })
  } catch (err) {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[SUMMARY] Error:', stack)
    statusCode = 500
    errorMessage = stack
    res.status(500).json({ error: 'Summary agent failed' })
  } finally {
    logRequest({
      timestamp: new Date().toISOString(),
      endpoint: '/gm/summarize',
      toolCallCount: 0,
      durationMs: Date.now() - start,
      statusCode,
      errorMessage,
    })
  }
})

// Manual Scribe trigger for a character (forces summary + quest/entity update)
app.post('/gm/scribe', async (req, res) => {
  const { characterId } = req.body as { characterId?: string }
  if (!characterId) {
    res.status(400).json({ error: 'characterId is required' })
    return
  }
  try {
    const recentTurns = await getRecentTurns(characterId, 20)
    await runScribe(characterId, recentTurns)
    res.json({ ok: true })
  } catch (err) {
    console.error('[SCRIBE] Error:', err instanceof Error ? err.message : String(err))
    res.status(500).json({ error: 'Scribe failed' })
  }
})

function formatHydration(ctx: ContextBlock, tables: string[]): string {
  const { character: { character, inventory, skills, spells }, healthText, essenceText, powerText, willText, locationEntities, encounterData, npcs, inventoryWeight, syngemGame } = ctx
  const sections: string[] = []

  if (tables.includes('character')) {
    const lines = [
      '=== CHARACTER STATE ===',
      `Name: ${character.name}  |  Level: ${character.level ?? '?'}  |  Class: ${character.class_archetype ?? 'Unknown'}`,
      `Health: ${character.current_health}/${character.health_max} — ${healthText}`,
      `Essence: ${character.current_essence}/${character.essence_max} — ${essenceText}`,
      `Power: ${character.current_power}/${character.power_max} — ${powerText}`,
      `Will: ${character.current_will}/${character.will_max} — ${willText}`,
      `Speed: ${character.speed ?? '?'}  |  Carry: ${inventoryWeight.current}/${inventoryWeight.max}`,
    ]
    if (character.location_place) lines.push(`Location: ${character.location_place}`)
    if (character.condition_text) lines.push(`Condition: ${character.condition_text}`)
    if (character.notes) lines.push(`Notes: ${character.notes}`)
    sections.push(lines.join('\n'))
  }

  if (tables.includes('inventory')) {
    const equipped = inventory.filter((i) => i.is_equipped).map((i) => i.items?.name ?? '?')
    const carried = inventory.filter((i) => !i.is_equipped).map((i) => i.items?.name ?? '?')
    const lines: string[] = ['=== INVENTORY ===']
    if (equipped.length) lines.push(`Equipped: ${equipped.join(', ')}`)
    if (carried.length) lines.push(`Carrying: ${carried.join(', ')}`)
    if (skills.length) lines.push(`Skills: ${skills.map((s) => `${s.skills?.name ?? '?'} (rank ${s.current_rank})`).join(', ')}`)
    if (spells.length) lines.push(`Spells: ${spells.map((s) => s.spells?.name ?? '?').join(', ')}`)
    if (lines.length > 1) sections.push(lines.join('\n'))
  }

  if (tables.includes('syngem_game') && syngemGame) {
    const day = syngemGame.game_date_days + 1
    const hh = String(Math.floor(syngemGame.game_time_minutes / 60)).padStart(2, '0')
    const mm = String(syngemGame.game_time_minutes % 60).padStart(2, '0')
    const lines = [
      '=== AI GAME SESSION ===',
      `Day: ${day}  |  Time: ${hh}:${mm}  |  Combat: ${syngemGame.in_combat ? 'yes' : 'no'}`,
    ]
    if (syngemGame.summary) lines.push(`Summary: ${syngemGame.summary}`)
    sections.push(lines.join('\n'))
  }

  if (tables.includes('location') && locationEntities.length > 0) {
    const lines = ['=== CURRENT LOCATION ===']
    for (const e of locationEntities) {
      lines.push(e.short_description ? `${e.name}: ${e.short_description}` : e.name)
    }
    sections.push(lines.join('\n'))
  }

  if (tables.includes('npcs') && npcs.length > 0) {
    const lines = ['=== NEARBY NPCs ===']
    for (const npc of npcs) {
      const detail = [npc.title, npc.faction].filter(Boolean).join(', ')
      lines.push(detail ? `${npc.name} (${detail})` : npc.name)
    }
    sections.push(lines.join('\n'))
  }

  if (tables.includes('encounter') && encounterData?.isInCombat) {
    const lines = [
      '=== COMBAT ENCOUNTER ===',
      `IN COMBAT — Turn position: ${(encounterData.activeTurnIndex ?? 0) + 1}`,
    ]
    for (const c of encounterData.creatures.filter((cr) => cr.is_alive)) {
      lines.push(`Enemy: ${c.creature_id} — HP ${c.current_health}/${c.health_max}`)
    }
    sections.push(lines.join('\n'))
  }

  return sections.join('\n\n')
}

app.post('/gm/hydrate', async (req, res) => {
  const { characterId, gameId, tables } = req.body as {
    characterId?: string
    gameId?: string
    tables?: string[]
  }
  if (!characterId) {
    res.status(400).json({ error: 'characterId is required' })
    return
  }
  try {
    const ctx = await autoHydrate(characterId, gameId)
    if (!ctx) {
      res.status(404).json({ error: 'Character not found' })
      return
    }
    const selectedTables = tables ?? ['character', 'inventory', 'location', 'npcs', 'encounter', 'game']
    res.json({ text: formatHydration(ctx, selectedTables) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Dev-only: wipe conversation history for a character
app.delete('/gm/conversation/:characterId', async (req, res) => {
  const { characterId } = req.params
  if (!characterId) {
    res.status(400).json({ error: 'characterId is required' })
    return
  }
  try {
    await clearConversationHistory(characterId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[DEV] clearConversationHistory error:', err instanceof Error ? err.message : String(err))
    res.status(500).json({ error: 'Failed to clear conversation history' })
  }
})

// Character creator — one-shot call from the SYNGEM intro flow
app.post('/character-creator', requireGmKey, async (req, res) => {
  const { questions, answers } = req.body as { questions?: unknown; answers?: unknown }
  if (!Array.isArray(questions) || !Array.isArray(answers)) {
    res.status(400).json({ error: 'questions and answers arrays are required' })
    return
  }
  try {
    const result = await runCharacterCreator({
      questions: questions as string[],
      answers: answers as string[],
    })
    res.json(result)
  } catch (err) {
    console.error('[CHARACTER-CREATOR] Error:', err instanceof Error ? err.message : String(err))
    res.status(500).json({ error: 'Character creator failed' })
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

const PORT = Number(process.env.PORT ?? process.env.GM_PORT ?? 3001);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎲 GM Server listening on http://0.0.0.0:${PORT}`)
  console.log(`🔧 Admin UI: http://0.0.0.0:${PORT}/admin`)
}).on('error', (err: NodeJS.ErrnoException) => {
  console.error(`[FATAL] Failed to bind port ${PORT}:`, err.message)
  process.exit(1)
})

setInterval(() => {}, 1000)
