import Anthropic from '@anthropic-ai/sdk'
import type { ToolResult } from '../types.js'
import { createClaudeClient } from '../claude-client.js'

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
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  try {
    const cleaned = text.replace(/^```(?:json)?[ \t]*\n?/, '').replace(/\n?```[ \t]*$/, '').trim()
    return JSON.parse(cleaned) as ToolResult
  } catch {
    return { error: 'Could not parse NPC response', raw: text }
  }
}
