import Anthropic from '@anthropic-ai/sdk'
import { update_stat, restore_pools } from '../tools/character.js'
import type { ToolResult } from '../types.js'

const client = new Anthropic()

interface DifficultyResult {
  difficulty: number
  pool: string
  reason: string
}

const DIFFICULTY_SYSTEM = `You are a difficulty arbiter for Katabatak, a dark fantasy tabletop RPG.

Difficulty is measured 1–20:
1–4: Trivial | 5–8: Easy | 9–12: Moderate | 13–16: Hard | 17–19: Extreme | 20: Near-impossible

Pool choice should fit the action thematically:
- health: physical strain, endurance, pain tolerance
- power: brute force, raw martial effort
- essence: perception, focus, magical or mental tasks
- will: resisting fear, temptation, social pressure, holds under duress

Respond with only a JSON object — no explanation, no markdown:
{"difficulty":<1-20>,"pool":"<health|power|essence|will>","reason":"<one sentence>"}`

export async function resolveCheckDifficulty(input: Record<string, unknown>): Promise<DifficultyResult | ToolResult> {
  const { action, context } = input as { action: string; context: string }
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system: DIFFICULTY_SYSTEM,
    messages: [{ role: 'user', content: `Action: ${action}\nContext: ${context}` }],
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  try {
    return JSON.parse(text) as DifficultyResult
  } catch {
    return { error: 'Could not parse difficulty', raw: text }
  }
}

export async function updateStat(input: Record<string, unknown>): Promise<ToolResult> {
  return update_stat(input)
}

export async function restorePools(input: Record<string, unknown>): Promise<ToolResult> {
  return restore_pools(input)
}
