import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ToolResult } from '../types.js'
import { createClaudeClient } from '../claude-client.js'

const NpcOutputSchema = z.object({
  dialogue: z.string(),
  mood: z.string(),
})

const npcTool: Anthropic.Tool = {
  name: 'output',
  description: 'NPC dialogue and mood',
  input_schema: zodToJsonSchema(NpcOutputSchema) as Anthropic.Tool['input_schema'],
}

const SYSTEM = `You are a dialogue engine for Katabatak, a fantasy tabletop RPG. Your only job is to voice NPCs.

Write the NPC's response as they would actually say it. Stay true to the personality given. Do not editorialize or describe actions — dialogue only.

Respond with only a JSON object — no explanation, no markdown:
{"dialogue":"<what the NPC says>","mood":"<one word: e.g. suspicious|warm|fearful|cold|evasive|hostile|amused>"}`

/**
 * Generates in-character NPC dialogue for the given situation.
 * @param input Accepts `Record<string, unknown>` because it arrives directly from the tool dispatcher.
 */
export async function getNpcResponse(input: Record<string, unknown>, passedClient?: Anthropic): Promise<ToolResult> {
  const client = passedClient ?? createClaudeClient()
  const { npc_name, personality, situation, player_input } = input as {
    npc_name: string
    personality: string
    situation: string
    player_input: string
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `NPC: ${npc_name}\nPersonality: ${personality}\nSituation: ${situation}\nPlayer said or did: ${player_input}`,
      },
    ],
    tools: [npcTool],
    tool_choice: { type: 'tool' as const, name: 'output' },
  })

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const parsed = NpcOutputSchema.safeParse(toolBlock?.input ?? {})
  return parsed.success ? parsed.data : { error: 'Could not parse NPC response' }
}
