import express from 'express'
import { handleGMMessage } from './gm/handler.js'
import { summarizeHistory } from './gm/agents/summary.js'
import { runEval } from './gm/services/claude-service.js'
import type { CharacterContext, ConversationTurn } from './gm/types.js'

console.log('====================================================')
console.log('⚔️  KATABATAK GAME SERVER INITIALIZATION ACTIVE  ⚔️')
console.log('====================================================')
console.log('🤖 Standby: Claude GM engine online.')
console.log('📂 Tools directory mapped successfully.')
console.log('----------------------------------------------------')

const app = express()
app.use(express.json())

app.post('/gm', async (req, res) => {
  const { message, conversationHistory, characterContext } = req.body as {
    message?: string
    conversationHistory?: ConversationTurn[]
    characterContext?: CharacterContext
  }
  if (!message) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  try {
    const response = await handleGMMessage({ message, conversationHistory, characterContext })
    res.json({ response })
  } catch (err) {
    console.error('[GM] Error:', err instanceof Error ? err.message : String(err))
    res.status(500).json({ error: 'GM handler failed' })
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
  try {
    const summary = await summarizeHistory({
      history: history as ConversationTurn[],
      existingSummary: existingSummary ?? null,
    })
    res.json({ summary })
  } catch (err) {
    console.error('[SUMMARY] Error:', err instanceof Error ? err.message : String(err))
    res.status(500).json({ error: 'Summary agent failed' })
  }
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
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

const PORT = process.env.GM_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`🎲 GM Server listening on http://localhost:${PORT}`)
})

setInterval(() => {}, 1000)
