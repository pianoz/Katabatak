import Anthropic from '@anthropic-ai/sdk'
import supabase from '../tools/db.js'
import { getSyngemGame, updateSyngemSummary } from '../../services/syngem-game-service.js'
import type { ConversationTurn } from '../types.js'
import { loadSystemPrompt } from '../../services/prompt-service.js'

const client = new Anthropic()

const FALLBACK_SYSTEM = `You are the Scribe, historian of the Katabatak RPG campaign. Given a conversation history between a player and the GM, you produce three outputs in a single JSON response.

Respond with only a JSON object — no markdown, no explanation:
{
  "summary": "<compressed narrative prose, past tense>",
  "quest_objectives": [
    {"id": "<slug>", "title": "<short title>", "status": "active|completed|failed", "description": "<one sentence>"}
  ],
  "key_entity_ids": ["<world_entity_id>", ...]
}

Rules for summary:
- Past tense prose, not bullet points.
- Preserve: major story beats, quests begun or resolved, important NPCs met, meaningful choices, notable items gained or lost, significant combat outcomes.
- Compress: failed mundane attempts, small talk, scenic description, trivial actions.
- Older events lose detail — remember a battle from last week, not what was for breakfast.
- Never include meta-game details (dice rolls, difficulty numbers). Describe outcomes only.
- If a prior summary is provided, merge it with the new events into one unified record.

Rules for quest_objectives:
- Extract or update any active, completed, or failed quests visible in the conversation.
- Use consistent IDs (snake_case slugs). Keep prior objectives unless clearly resolved.

Rules for key_entity_ids:
- List the WorldEntity IDs (format: "loc_karkill_flounder_inn") of locations, NPCs, or items the player directly interacted with in this batch.
- Only include entities that were named or described — not vague references.`

interface ScribeOutput {
  summary: string
  quest_objectives: Array<{ id: string; title: string; status: string; description: string }>
  key_entity_ids: string[]
}

export async function runScribe(characterId: string, history: ConversationTurn[]): Promise<void> {
  const [syngemGame, { data: character }] = await Promise.all([
    getSyngemGame(characterId),
    supabase.from('characters').select('quest_objectives').eq('id', characterId).single(),
  ])

  const existingSummary = syngemGame?.summary ?? null
  const existingObjectives = (character?.quest_objectives as ScribeOutput['quest_objectives'] | null) ?? []

  const priorBlock = existingSummary
    ? `PRIOR SUMMARY:\n${existingSummary}\n\nPRIOR OBJECTIVES:\n${JSON.stringify(existingObjectives, null, 2)}\n\nNEW TURNS TO INCORPORATE:\n`
    : `TURNS TO SUMMARIZE:\n`

  const turns = history
    .map((t) => `[${t.role === 'player' ? 'PLAYER' : 'GM'}]: ${t.content}`)
    .join('\n\n')

  const system = (await loadSystemPrompt('scribe')) ?? FALLBACK_SYSTEM

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    temperature: 0.5,
    system,
    messages: [{ role: 'user', content: priorBlock + turns }],
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  let parsed: ScribeOutput
  try {
    parsed = JSON.parse(text) as ScribeOutput
  } catch {
    console.error('[Scribe] Failed to parse JSON output:', text)
    return
  }

  await Promise.all([
    updateSyngemSummary(characterId, parsed.summary),
    supabase
      .from('characters')
      .update({
        quest_objectives: parsed.quest_objectives,
        key_entity_ids: parsed.key_entity_ids,
      })
      .eq('id', characterId),
  ])
}

/** Legacy export — kept for the /gm/summarize endpoint if still needed. */
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
    .map((t) => `[${t.role === 'player' ? 'PLAYER' : 'GM'}]: ${t.content}`)
    .join('\n\n')

  const system = (await loadSystemPrompt('scribe')) ?? FALLBACK_SYSTEM

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0.5,
    system,
    messages: [{ role: 'user', content: priorBlock + turns }],
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  try {
    const parsed = JSON.parse(text) as ScribeOutput
    return parsed.summary
  } catch {
    return text
  }
}
