import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { LedgerOutput, LocationContext } from '../types.js'
import { LedgerOutputSchema } from '../types.js'
import { normalizeLedgerAction } from '../bumper-lanes.js'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { synLog, synLogVerbose } from '../logger.js'
import { createClaudeClient } from '../claude-client.js'
import { recordTokenUsage } from '../record-token-usage.js'

const WrappedLedgerSchema = z.object({ actions: LedgerOutputSchema.array() })

const ledgerTool: Anthropic.Tool = {
  name: 'output',
  description: 'Array of permanent world-state changes extracted from the GM narrative',
  input_schema: zodToJsonSchema(WrappedLedgerSchema) as Anthropic.Tool['input_schema'],
}

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

- create_entity: a new object, NPC, creature, or environmental feature was introduced into the world scene.
  Use when the GM describes something new as existing in the environment — not yet in the player's possession.
  The entity will be automatically anchored to the player's current location. Duplicates are handled server-side, so emit even if unsure.
  {"action":"create_entity","entity":{"id":"<slug_id>","name":"<name>","type":"<nation|region|place|location|npc|item>","data":{"short_description":"<text>"}}}

- grant_item: an item was directly given to or picked up by the player and is now in their possession.
  Use ONLY when the player explicitly receives the item (NPC hands it over, player picks it up, quest reward granted).
  Do NOT use for items merely described as existing in the environment — use create_entity for those.
  {"action":"grant_item","item_name":"<name>","item_type":"<weapon|armor|consumable|misc>","description":"<one sentence>","quantity":1}

- delete_entity: an entity was destroyed, consumed, or hidden from the player permanently.
  {"action":"delete_entity","entity_id":"<id>","replacement_description":"<what the player now sees instead>"}

- long_rest: the player character completed a full long rest (slept at an inn, camped overnight, rested until morning).
  {"action":"long_rest"}

Rules:
- Only record changes that are permanent and world-altering — not temporary narrative flourishes.
- Do NOT emit update_npc for routine small talk or information-only exchanges — only meaningful shifts.
- Do NOT emit update_npc for NPC routine movement — that is handled automatically by the system.
- If the narrative is ambiguous about whether movement occurred, omit move_character.
- Entity IDs must match the snake_case naming convention (e.g. "loc_karkill_flounder_inn", "item_obsidian_vial").
- Emit long_rest only when the narrative confirms a full overnight rest occurred. Do NOT emit for short breaks, sitting down, or meditation.
- Respond with only a JSON array — no markdown, no explanation.

Examples:
- Player moves north -> move_character to connected location
- Player opens a door -> update_entity door_id {is_open: true}
- Player reads a wall inscription -> [] (info action, no state change)
- Player bribes the gate guard successfully -> update_npc {npc_id:"guard_karkill_gate", mutations:{disposition_delta:20, memory_append:"Player bribed them with 50 gold to look the other way."}}
- Player asks Marta to patrol the docks -> update_npc {npc_id:"marta_karkill", mutations:{current_task:{description:"Patrol the docks for suspicious activity",target_location_id:"loc_karkill_docks",assigned_tick:0}}}
- Player asks the innkeeper for directions -> [] (no state change)
- Player insults the merchant -> update_npc {npc_id:"merchant_bazaar", mutations:{disposition_delta:-25, memory_append:"Player insulted them in front of customers."}}
- Player rests at the inn overnight, GM narrates waking refreshed -> long_rest
- Player sits to catch their breath -> [] (short rest, no action)
- GM describes a rusted iron chest in the corner of the room -> create_entity {id:"item_rusted_iron_chest", name:"Rusted Iron Chest", type:"item", data:{short_description:"A weathered chest, its lock long since corroded open."}}
- NPC hands the player a carved bone whistle as payment -> grant_item {item_name:"Carved Bone Whistle", item_type:"misc", description:"A small whistle carved from yellowed bone.", quantity:1}
- Player picks up a sword from a fallen enemy -> grant_item {item_name:"Soldier's Shortsword", item_type:"weapon", description:"A standard-issue shortsword, notched from heavy use."}
`

/**
 * Audits the completed GM narrative and extracts permanent world-state changes.
 * Uses Anthropic tool forcing for structured output; returns an empty array if nothing changed or schema validation fails.
 */
export async function runLedger({
  narrativeText,
  characterId,
  locationContext,
  client: passedClient,
  userId,
  requestId,
}: {
  narrativeText: string
  characterId: string
  locationContext?: LocationContext
  client?: Anthropic
  userId?: string
  requestId?: string
}): Promise<LedgerOutput[]> {
  const client = passedClient ?? createClaudeClient()
  const loadedPrompt = await loadSystemPrompt('ledger')
  const system = loadedPrompt ?? FALLBACK_SYSTEM

  const locationLine = locationContext?.locationPlaceId
    ? `Current Location: ${locationContext.locationPlaceId}${locationContext.placeContext ? ` (${[locationContext.placeContext, locationContext.regionContext, locationContext.nationContext].filter(Boolean).join(' > ')})` : ''}`
    : ''

  const userContent = [
    `Character ID: ${characterId}`,
    locationLine,
    '',
    'GM Narrative:',
    narrativeText,
  ]
    .filter((l, i) => i !== 1 || l !== '')
    .join('\n')

  synLog('LEDGER', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'} | narrative:${narrativeText.length}chars${locationContext?.locationPlaceId ? ` | loc:${locationContext.locationPlaceId}` : ''}`, undefined, requestId)
  synLogVerbose('LEDGER', '→ system prompt:', system, requestId)
  synLogVerbose('LEDGER', '→ user content:', userContent, requestId)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    temperature: 0,
    system: [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user', content: userContent }],
    tools: [ledgerTool],
    tool_choice: { type: 'tool' as const, name: 'output' },
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

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const rawInput: unknown = toolBlock?.input ?? {}
  synLogVerbose('LEDGER', '← raw response:', rawInput, requestId)
  const looseWrapped = z.object({ actions: z.array(z.record(z.unknown())) }).safeParse(rawInput)
  const normalizedActions = (looseWrapped.success ? looseWrapped.data.actions : []).map(normalizeLedgerAction)
  const result = LedgerOutputSchema.array().safeParse(normalizedActions)
  if (!result.success) {
    synLog('LEDGER', '⚠ schema validation failed — returning []', result.error.issues, requestId)
    return []
  }
  const outputs: LedgerOutput[] = result.data
  synLog('LEDGER', `✓ ${outputs.length} action(s)${outputs.length ? ': ' + outputs.map((o) => o.action).join(', ') : ''}`, outputs.length ? outputs : undefined, requestId)
  return outputs
}
