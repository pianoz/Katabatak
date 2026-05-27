import Anthropic from '@anthropic-ai/sdk'
import type { LedgerOutput } from '../types.js'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { synLog } from '../logger.js'

const client = new Anthropic()

const FALLBACK_SYSTEM = `You are the Ledger, a world-state auditor for the Katabatak RPG. You read completed GM narrative and determine whether permanent world state has changed.

You output a JSON array of state change actions. If nothing changed, output an empty array [].

Valid actions:
- move_character: the player character clearly moved to a different named location.
  {"action":"move_character","destination_entity_id":"<world_entity_id>"}

- update_entity: a world entity's state changed (door opened, NPC disposition changed, object moved).
  {"action":"update_entity","entity_id":"<id>","mutations":{"<field>":"<value>"}}

- create_entity: a new object, creature, or item was introduced into the world.
  {"action":"create_entity","entity":{"id":"<slug_id>","name":"<name>","type":"<nation|region|place|location|npc|item>","data":{"short_description":"<text>"}}}

- delete_entity: an entity was destroyed, consumed, or hidden from the player permanently.
  {"action":"delete_entity","entity_id":"<id>","replacement_description":"<what the player now sees instead>"}

Rules:
- Only record changes that are permanent and world-altering — not temporary narrative flourishes.
- If the narrative is ambiguous about whether movement occurred, omit move_character.
- Entity IDs must match the snake_case naming convention (e.g. "loc_karkill_flounder_inn").
- Respond with only a JSON array — no markdown, no explanation.`

/**
 * Audits the completed GM narrative and extracts permanent world-state changes.
 * Returns an empty array if nothing changed or if the model returns unparseable JSON.
 */
export async function runLedger({
  narrativeText,
  characterId,
}: {
  narrativeText: string
  characterId: string
}): Promise<LedgerOutput[]> {
  const loadedPrompt = await loadSystemPrompt('ledger')
  const system = loadedPrompt ?? FALLBACK_SYSTEM
  synLog('LEDGER', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'} | narrative:${narrativeText.length}chars`)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    temperature: 0,
    system,
    messages: [
      {
        role: 'user',
        content: `Character ID: ${characterId}\n\nGM Narrative:\n${narrativeText}`,
      },
    ],
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      synLog('LEDGER', '⚠ result not an array — returning []')
      return []
    }
    const outputs = parsed as LedgerOutput[]
    synLog('LEDGER', `✓ ${outputs.length} action(s)${outputs.length ? ': ' + outputs.map((o) => o.action).join(', ') : ''}`)
    return outputs
  } catch {
    synLog('LEDGER', `⚠ JSON parse failed | raw:"${text.slice(0, 80)}"`)
    console.error('[Ledger] Failed to parse JSON:', text)
    return []
  }
}
