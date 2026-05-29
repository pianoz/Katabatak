import Anthropic from '@anthropic-ai/sdk'
import type { LedgerOutput } from '../types.js'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { synLog, synLogVerbose } from '../logger.js'
import { createClaudeClient } from '../claude-client.js'
import { recordTokenUsage } from '../record-token-usage.js'

const FALLBACK_SYSTEM = `You are the Ledger, a world-state auditor for the Katabatak RPG. You read completed GM narrative and determine whether permanent world state has changed.

You output a JSON array of state change actions. If nothing changed, output an empty array [].

Valid actions:
- move_character: the player character clearly moved to a different named location.
  {"action":"move_character","destination_entity_id":"<world_entity_id>"}

- update_entity: a world entity's state changed (door opened, object moved).
  {"action":"update_entity","entity_id":"<id>","mutations":{"<field>":"<value>"}}

- update_npc: an NPC's persistent state changed in a meaningful way. Only emit for: disposition shift, revealed information, assigned/completed task, death, or explicit departure.
  {"action":"update_npc","npc_id":"<id>","mutations":{...}}
  Available mutation fields (all optional):
    "disposition_delta": number — positive improves relation, negative worsens (e.g. +20 or -30)
    "memory_append": string — one sentence the NPC would remember about this encounter
    "known_facts_append": string[] — new facts the player revealed to this NPC
    "current_task": {"description":"<task>","target_location_id":"<loc_id>","assigned_tick":0} — assign a task; null to clear
    "current_location_id": string — only when NPC explicitly departs to a named location
    "is_alive": false — only when NPC died this scene
    "following_character_id": string | null — character ID when NPC agrees to follow; null to stop

- create_entity: a new object, creature, or item was introduced into the world.
  {"action":"create_entity","entity":{"id":"<slug_id>","name":"<name>","type":"<nation|region|place|location|npc|item>","data":{"short_description":"<text>"}}}

- delete_entity: an entity was destroyed, consumed, or hidden from the player permanently.
  {"action":"delete_entity","entity_id":"<id>","replacement_description":"<what the player now sees instead>"}

Rules:
- Only record changes that are permanent and world-altering — not temporary narrative flourishes.
- Do NOT emit update_npc for routine small talk or information-only exchanges — only meaningful shifts.
- Do NOT emit update_npc for NPC routine movement — that is handled automatically by the system.
- If the narrative is ambiguous about whether movement occurred, omit move_character.
- Entity IDs must match the snake_case naming convention (e.g. "loc_karkill_flounder_inn").
- Respond with only a JSON array — no markdown, no explanation.

Examples:
- Player moves north -> move_character to connected location
- Player opens a door -> update_entity door_id {is_open: true}
- Player reads a wall inscription -> [] (info action, no state change)
- Player bribes the gate guard successfully -> update_npc {npc_id:"guard_karkill_gate", mutations:{disposition_delta:20, memory_append:"Player bribed them with 50 gold to look the other way."}}
- Player asks Marta to patrol the docks -> update_npc {npc_id:"marta_karkill", mutations:{current_task:{description:"Patrol the docks for suspicious activity",target_location_id:"loc_karkill_docks",assigned_tick:0}}}
- Player asks the innkeeper for directions -> [] (no state change)
- Player insults the merchant -> update_npc {npc_id:"merchant_bazaar", mutations:{disposition_delta:-25, memory_append:"Player insulted them in front of customers."}}
`

/**
 * Audits the completed GM narrative and extracts permanent world-state changes.
 * Returns an empty array if nothing changed or if the model returns unparseable JSON.
 */
export async function runLedger({
  narrativeText,
  characterId,
  client: passedClient,
  userId,
}: {
  narrativeText: string
  characterId: string
  client?: Anthropic
  userId?: string
}): Promise<LedgerOutput[]> {
  const client = passedClient ?? createClaudeClient()
  const loadedPrompt = await loadSystemPrompt('ledger')
  const system = loadedPrompt ?? FALLBACK_SYSTEM
  const userContent = `Character ID: ${characterId}\n\nGM Narrative:\n${narrativeText}`
  synLog('LEDGER', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'} | narrative:${narrativeText.length}chars`)
  synLogVerbose('LEDGER', '→ system prompt:', system)
  synLogVerbose('LEDGER', '→ user content:', userContent)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    temperature: 0,
    system: [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user', content: userContent }],
  })

  if (userId) {
    recordTokenUsage({
      userId,
      characterId,
      agent: 'ledger',
      model: 'claude-sonnet-4-6',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    })
  }

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
  synLogVerbose('LEDGER', '← raw response:', text)
  try {
    const cleaned = text.replace(/^```(?:json)?[ \t]*\n?/, '').replace(/\n?```[ \t]*$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) {
      synLog('LEDGER', '⚠ result not an array — returning []')
      return []
    }
    const outputs = parsed as LedgerOutput[]
    synLog('LEDGER', `✓ ${outputs.length} action(s)${outputs.length ? ': ' + outputs.map((o) => o.action).join(', ') : ''}`, outputs.length ? outputs : undefined)
    return outputs
  } catch {
    synLog('LEDGER', '⚠ JSON parse failed — full raw response:', text)
    return []
  }
}
