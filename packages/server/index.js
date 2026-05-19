import express from 'express'
import { handleGMMessage } from './gm/handler.js'
import { summarizeHistory } from './gm/agents/summary.js'

console.log("====================================================");
console.log("⚔️  KATABATAK GAME SERVER INITIALIZATION ACTIVE  ⚔️");
console.log("====================================================");
console.log("🤖 Standby: Claude GM engine online.");
console.log("📂 Tools directory mapped successfully.");
console.log("----------------------------------------------------");

const app = express()
app.use(express.json())

app.post('/gm', async (req, res) => {
  const { message, conversationHistory, characterContext } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  try {
    const response = await handleGMMessage({ message, conversationHistory, characterContext })
    res.json({ response })
  } catch (err) {
    console.error('[GM] Error:', err.message)
    res.status(500).json({ error: 'GM handler failed' })
  }
})

app.post('/gm/summarize', async (req, res) => {
  const { history, existingSummary } = req.body
  if (!history || !Array.isArray(history)) {
    return res.status(400).json({ error: 'history array is required' })
  }
  try {
    const summary = await summarizeHistory({ history, existingSummary: existingSummary ?? null })
    res.json({ summary })
  } catch (err) {
    console.error('[SUMMARY] Error:', err.message)
    res.status(500).json({ error: 'Summary agent failed' })
  }
})

const PORT = process.env.GM_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`🎲 GM Server listening on http://localhost:${PORT}`)
})

// Heartbeat — keeps the process alive alongside the Next.js dev server
setInterval(() => {}, 1000)
