import Anthropic from '@anthropic-ai/sdk'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { contextBlock } from '../auto-hydrator.js'
import { synLog, synLogVerbose } from '../logger.js'
import type { ContextBlock, ConversationTurn, LoreEngineOutput } from '../types.js'

const client = new Anthropic()

const FALLBACK_SYSTEM = `You are the Lore-Engine, the mechanical gatekeeper for the Katabatak RPG. Your sole job is to parse player intent and translate it into structured game mechanics.

Respond with a single JSON object — no markdown, no explanation. No other text. action_type must be
one of the threen given. All others will be discarded.

Schema:
{
  "action_type": "info" | "task" | "attack",
  "requires_check": boolean,
  "difficulty": number (0–50, only if requires_check),
  "pool": "Power" | "Essence" | "Will" (only if requires_check),
  "check_description": string (brief label, only if requires_check),
  "search_objects": [{"action": string, "target": string, "container": string}] (only if action_type is "info" and a search would help),
  "narrative_notes": string (optional hint for the Architect, e.g. "player is attempting stealth")
}

Rules:
- action_type "info": player is asking about the world, seeking information, or exploring passively.
- action_type "task": player is attempting something physical, social, or magical that could fail.
- action_type "attack": player is initiating direct combat against a target.
- requires_check is true only for "task" or "attack" when there is meaningful risk of failure.
- For purely conversational or low-stakes actions, requires_check is false.
- Difficulty 0–10: trivial. 11–20: moderate. 21–35: hard. 36–50: extreme or near-impossible.
- Pool choice: Power for physical effort, Essence for magic/perception/lore, Will for social/mental/endurance.`

/**
 * Classifies player intent and determines whether a skill check is required.
 * Falls back to a no-check task action if the model returns unparseable JSON.
 */
export async function runLoreEngine({
  lastTwoTurns,
  contextBlock: ctx,
  playerInput,
}: {
  lastTwoTurns: ConversationTurn[]
  contextBlock: ContextBlock
  playerInput: string
}): Promise<LoreEngineOutput> {
  const loadedPrompt = await loadSystemPrompt('lore-engine')
  const system = loadedPrompt ?? FALLBACK_SYSTEM
  synLog('LORE-ENGINE', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'} | input:"${playerInput.slice(0, 60)}${playerInput.length > 60 ? '...' : ''}"`)
  synLogVerbose('LORE-ENGINE', '→ system prompt:', system)

  const historyBlock = lastTwoTurns.length
    ? lastTwoTurns
        .map((t) => `[${t.role === 'player' ? 'PLAYER' : 'GM'}]: ${t.content}`)
        .join('\n\n')
    : '(no prior turns)'

  const userContent = [
    '=== GAME STATE ===',
    contextBlock(ctx),
    '',
    '=== RECENT HISTORY ===',
    historyBlock,
    '',
    '=== PLAYER INPUT ===',
    playerInput,
  ].join('\n')

  synLogVerbose('LORE-ENGINE', '→ user content:', userContent)

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: userContent }],
    })
  } catch (apiErr) {
    synLog('LORE-ENGINE', `✗ API error: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`)
    return { action_type: 'task', requires_check: false }
  }

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  synLogVerbose('LORE-ENGINE', '← raw response:', text)
  try {
    const cleaned = text.replace(/^```(?:json)?[ \t]*\n?/, '').replace(/\n?```[ \t]*$/, '').trim()
    const result = JSON.parse(cleaned) as LoreEngineOutput
    synLog('LORE-ENGINE', `✓ action:${result.action_type} requires_check:${result.requires_check}${result.search_objects?.length ? ` searches:${result.search_objects.length}` : ''}${result.narrative_notes ? ` notes:"${result.narrative_notes.slice(0, 50)}"` : ''}`, result)
    return result
  } catch {
    synLog('LORE-ENGINE', '⚠ JSON parse failed — using fallback. Full raw response:', text)
    return { action_type: 'task', requires_check: false }
  }
}
