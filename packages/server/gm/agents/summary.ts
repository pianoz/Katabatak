import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Json } from '@db-types'
import supabase from '../tools/db.js'
import { getSyngemGame, updateSyngemSummary } from '../../services/syngem-game-service.js'
import type { ConversationTurn } from '../types.js'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { synLog } from '../logger.js'
import { createClaudeClient } from '../claude-client.js'
import { recordTokenUsage } from '../record-token-usage.js'

const FALLBACK_SYSTEM = `You are the Scribe, historian of the Katabatak RPG campaign. Given a conversation history between a player and the GM, you produce four outputs in a single JSON response.

Respond with only a JSON object — no markdown, no explanation:
{
  "summary": "<compressed narrative prose, past tense>",
  "quest_updates": {
    "objectives": [
      {"id": "<slug>", "title": "<short title>", "status": "active|completed|failed", "description": "<one sentence, player-facing>", "current_stage": "<stage_id or null>", "grants_applied": ["start"]}
    ],
    "completed_quest_ids": ["<slug>", ...]
  },
  "key_entity_ids": ["<world_entity_id>", ...]
}

Rules for summary:
- Past tense prose, not bullet points.
- Preserve: major story beats, quests begun or resolved, important NPCs met, meaningful choices, notable items gained or lost, significant combat outcomes.
- Compress: failed mundane attempts, small talk, scenic description, trivial actions.
- Older events lose detail — remember a battle from last week, not what was for breakfast.
- Never include meta-game details (dice rolls, difficulty numbers). Describe outcomes only.
- If a prior summary is provided, merge it with the new events into one unified record.

Rules for quest_updates.objectives:
- Return the full updated array of quest objectives.
- Advance current_stage to the next stage ID when the narrative clearly shows that stage has been reached.
- Keep the same grants_applied array from the prior objectives — never modify it (the Quest Engine owns that field).
- Update description to a fresh one-sentence player-facing summary of where the quest stands now.
- Mark status "completed" or "failed" only when the narrative makes it unambiguous.

Rules for quest_updates.completed_quest_ids:
- List the IDs of any quests newly marked completed in this pass (not ones already completed before).

Rules for key_entity_ids:
- List the WorldEntity IDs (format: "loc_karkill_flounder_inn") of locations, NPCs, or items the player directly interacted with in this batch.
- Only include entities that were named or described — not vague references.`

export interface QuestObjectiveScribe {
  id: string
  title: string
  status: string
  description: string
  current_stage?: string | null
  grants_applied?: string[]
}

/** Structured output produced by the Scribe agent. */
export interface ScribeOutput {
  summary: string
  quest_updates: {
    objectives: QuestObjectiveScribe[]
    completed_quest_ids: string[]
  }
  key_entity_ids: string[]
}

const QuestObjectiveScribeSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  description: z.string(),
  current_stage: z.string().nullable().optional(),
  grants_applied: z.array(z.string()).optional(),
})

const ScribeOutputSchema = z.object({
  summary: z.string(),
  quest_updates: z.object({
    objectives: z.array(QuestObjectiveScribeSchema),
    completed_quest_ids: z.array(z.string()),
  }),
  key_entity_ids: z.array(z.string()),
})

const scribeTool: Anthropic.Tool = {
  name: 'output',
  description: 'Compressed narrative summary, quest objective updates, and key entity IDs',
  input_schema: zodToJsonSchema(ScribeOutputSchema) as Anthropic.Tool['input_schema'],
}

/**
 * Compresses recent conversation turns into a narrative summary, quest objectives, and key entity IDs.
 * Uses Anthropic tool forcing for structured output; merges with the existing summary on the syngem_game row.
 * Returns IDs of any quests newly marked completed so the handler can fire completion grants.
 */
export async function runScribe(
  characterId: string,
  history: ConversationTurn[],
  passedClient?: Anthropic,
  userId?: string,
  requestId?: string,
): Promise<{ completedQuestIds: string[] }> {
  const client = passedClient ?? createClaudeClient()
  synLog('SCRIBE', `→ running | char:${characterId} turns:${history.length}`, undefined, requestId)

  const [syngemGame, { data: character }] = await Promise.all([
    getSyngemGame(characterId),
    supabase.from('characters').select('quest_objectives').eq('id', characterId).single(),
  ])

  const existingSummary = syngemGame?.summary ?? null
  const existingObjectives = (character?.quest_objectives as ScribeOutput['quest_updates']['objectives'] | null) ?? []
  synLog('SCRIBE', `  prior summary:${existingSummary ? 'yes' : 'none'} | prior objectives:${existingObjectives.length}`, undefined, requestId)

  // Fetch quest template stage hints for active quests so the Scribe can advance stages accurately
  const activeQuestIds = existingObjectives.filter((q) => q.status === 'active').map((q) => q.id)
  let stageHints = ''
  if (activeQuestIds.length) {
    const { data: templates } = await supabase
      .from('quest_templates')
      .select('id, stages')
      .in('id', activeQuestIds)
    if (templates?.length) {
      stageHints = `\nQUEST STAGE REFERENCE:\n${templates.map((t) => `Quest "${t.id}" stages: ${JSON.stringify(t.stages)}`).join('\n')}\n`
    }
  }

  const priorBlock = existingSummary
    ? `PRIOR SUMMARY:\n${existingSummary}\n\nPRIOR OBJECTIVES:\n${JSON.stringify(existingObjectives, null, 2)}${stageHints}\nNEW TURNS TO INCORPORATE:\n`
    : `${stageHints}TURNS TO SUMMARIZE:\n`

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
    tools: [scribeTool],
    tool_choice: { type: 'tool' as const, name: 'output' },
  })

  if (userId) {
    recordTokenUsage({
      userId,
      characterId,
      agent: 'scribe',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    })
  }

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const result = ScribeOutputSchema.safeParse(toolBlock?.input ?? {})
  if (!result.success) {
    synLog('SCRIBE', '⚠ schema validation failed', result.error.issues, requestId)
    return { completedQuestIds: [] }
  }
  const parsed: ScribeOutput = result.data

  const updatedObjectives = parsed.quest_updates?.objectives ?? []
  const completedQuestIds = parsed.quest_updates?.completed_quest_ids ?? []

  await Promise.all([
    updateSyngemSummary(characterId, parsed.summary),
    supabase
      .from('characters')
      .update({
        quest_objectives: updatedObjectives as unknown as Json,
        key_entity_ids: parsed.key_entity_ids,
      })
      .eq('id', characterId),
  ])
  synLog('SCRIBE', `✓ complete | summary:${parsed.summary.length}chars objectives:${updatedObjectives.length} completed:${completedQuestIds.length} entities:${parsed.key_entity_ids.length}`, undefined, requestId)
  return { completedQuestIds }
}

/** Legacy export — kept for the /gm/summarize endpoint if still needed. */
export async function summarizeHistory({
  history,
  existingSummary,
}: {
  history: ConversationTurn[]
  existingSummary: string | null
}): Promise<string> {
  const client = createClaudeClient()
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
    tools: [scribeTool],
    tool_choice: { type: 'tool' as const, name: 'output' },
  })

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const parsed = ScribeOutputSchema.safeParse(toolBlock?.input ?? {})
  return parsed.success ? parsed.data.summary : ''
}
