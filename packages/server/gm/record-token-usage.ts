import supabase from './tools/db.js'
import { synLog } from './logger.js'

export interface TokenUsageRecord {
  userId: string
  characterId?: string
  agent: string
  model: string
  inputTokens: number
  outputTokens: number
}

/**
 * Fire-and-forget write to token_usage.
 * Errors are logged but never propagated — a failed token write must not break the GM pipeline.
 */
export function recordTokenUsage(record: TokenUsageRecord): void {
  supabase
    .from('token_usage')
    .insert({
      user_id: record.userId,
      character_id: record.characterId ?? null,
      agent: record.agent,
      model: record.model,
      input_tokens: record.inputTokens,
      output_tokens: record.outputTokens,
    })
    .then(({ error }) => {
      if (error) synLog('TOKEN', `✗ record failed: ${error.message}`)
    })
}
