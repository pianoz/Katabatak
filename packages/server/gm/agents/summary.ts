import Anthropic from '@anthropic-ai/sdk'
import type { ConversationTurn } from '../types.js'

const client = new Anthropic()

const SYSTEM = `You are a story recorder for an ongoing RPG campaign set in Kataba, a quiet medieval world.

You receive the conversation history for a session (player actions and GM narration) and produce a single cohesive narrative summary. If a prior summary is provided, merge it with the new events into one unified record.

Rules:
- Write past tense prose, not bullet points
- Preserve: major story beats, quests begun or resolved, important NPCs met, meaningful choices, notable items gained or lost, significant combat outcomes, consequential stat changes
- Compress: failed mundane attempts, small talk, scenic description, anything trivial
- Older events lose detail naturally — you remember a battle from weeks ago, not what you had for breakfast
- Never include meta-game details (dice rolls, difficulty numbers, tool calls) — describe outcomes only
- Do not speculate about what comes next — only record what has happened`

export async function summarizeHistory({
  history,
  existingSummary,
}: {
  history: ConversationTurn[]
  existingSummary: string | null
}): Promise<string> {
  const priorBlock = existingSummary
    ? `PRIOR SUMMARY:\n${existingSummary}\n\nNEW TURNS TO INCORPORATE:\n`
    : `TURNS TO SUMMARIZE:\n`

  const turns = history
    .map((msg) => `[${msg.role === 'player' ? 'PLAYER' : 'GM'}]: ${msg.content}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{ role: 'user', content: priorBlock + turns }],
  })

  return response.content.find((b) => b.type === 'text')?.text ?? ''
}
