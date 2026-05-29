import Anthropic from '@anthropic-ai/sdk'

/**
 * Returns an Anthropic client for a single request.
 * If `apiKey` is provided (BYOK), it is used directly.
 * Otherwise falls back to the ANTHROPIC_API_KEY env var (dev/server flow).
 */
export function createClaudeClient(apiKey?: string): Anthropic {
  return apiKey ? new Anthropic({ apiKey }) : new Anthropic()
}
