import Anthropic from '@anthropic-ai/sdk'
import type { ContextBlock, ConversationTurn, LoreEngineOutput, CheckResolution } from '../types.js'
import { loadArchitectPrompt } from '../../services/prompt-service.js'
import { synLog } from '../logger.js'
import { createClaudeClient } from '../claude-client.js'
import { recordTokenUsage } from '../record-token-usage.js'

function formatGameTime(syngemGame: ContextBlock['syngemGame']): string | null {
  if (!syngemGame) return null
  const days = syngemGame.game_date_days
  const year = Math.floor(days / 360) + 1
  const month = Math.floor((days % 360) / 30) + 1
  const day = (days % 360) % 30 + 1
  const hour = Math.floor(syngemGame.game_time_minutes / 60)
  const minute = syngemGame.game_time_minutes % 60
  return `Year ${year}, Month ${month}, Day ${day} — ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function serializeContextBlock(ctx: ContextBlock): string {
  const {
    character: { character, skills, spells },
    healthText, essenceText, powerText, willText,
    locationEntities, improvisedEntities, entitiesAtLocation, connectedLocations,
    encounterData, npcs, trackedInventory, inventoryWeight, syngemGame,
  } = ctx

  const lines: string[] = [
    '=== CHARACTER STATE ===',
    `Name: ${character.name}  |  Level: ${character.level ?? '?'}  |  Class: ${character.class_archetype ?? 'Unknown'}`,
    `Health: ${character.current_health}/${character.health_max} — ${healthText}`,
    `Essence: ${character.current_essence}/${character.essence_max} — ${essenceText}`,
    `Power: ${character.current_power}/${character.power_max} — ${powerText}`,
    `Will: ${character.current_will}/${character.will_max} — ${willText}`,
    `Speed: ${character.speed ?? '?'}`,
    `Carry Weight: ${inventoryWeight.current}/${inventoryWeight.max}`,
  ]

  const gameTime = formatGameTime(syngemGame)
  if (gameTime) lines.push(`Time: ${gameTime}`)

  // locationEntities is ordered place→region→nation; reverse for breadcrumb display
  const locationParts = [...locationEntities].reverse().map((e) => e.name)
  if (locationParts.length) lines.push(`Region: ${locationParts.join(' › ')}`)

  if (syngemGame?.in_combat) lines.push('Status: IN COMBAT')
  if (character.condition_text) lines.push(`Condition: ${character.condition_text}`)
  if (character.notes) lines.push(`Notes: ${character.notes}`)

  const equipped = trackedInventory.filter((i) => i.is_equipped).map((i) => i.items?.name ?? '?')
  const carried = trackedInventory.filter((i) => !i.is_equipped).map((i) => i.items?.name ?? '?')
  if (equipped.length) lines.push(`Equipped: ${equipped.join(', ')}`)
  if (carried.length) lines.push(`Carrying: ${carried.join(', ')}`)
  if (skills.length) lines.push(`Skills: ${skills.map((s) => `${s.skills?.name ?? '?'} (rank ${s.current_rank})`).join(', ')}`)
  if (spells.length) lines.push(`Spells: ${spells.map((s) => s.spells?.name ?? '?').join(', ')}`)

  if (locationEntities.length) {
    lines.push('', '=== CURRENT LOCATION ===')
    for (const e of locationEntities) {
      if (e.short_description) lines.push(`${e.name}: ${e.short_description}`)
    }
  }

  if (entitiesAtLocation.length) {
    lines.push('', '=== LOCATION ENTITIES ===')
    for (const e of entitiesAtLocation) {
      lines.push(e.short_description ? `${e.name} [${e.type}]: ${e.short_description}` : `${e.name} [${e.type}]`)
    }
  }

  if (connectedLocations.length) {
    lines.push('', '=== CONNECTED LOCATIONS ===')
    for (const loc of connectedLocations) {
      lines.push(loc.short_description ? `${loc.name}: ${loc.short_description}` : loc.name)
    }
  }

  if (improvisedEntities.length) {
    lines.push('', '=== SCENE OBJECTS ===')
    for (const e of improvisedEntities) {
      lines.push(e.short_description ? `${e.name}: ${e.short_description}` : e.name)
    }
  }

  const partyMembers = npcs.filter((n) => n.isFollowing)
  const bystanders = npcs.filter((n) => !n.isFollowing)

  if (partyMembers.length) {
    lines.push('', '=== PARTY MEMBERS ===')
    for (const npc of partyMembers) {
      const nameTag = npc.title ? `${npc.name}, ${npc.title}` : npc.name
      lines.push(`${nameTag} [${npc.dispositionLabel}] (disposition: ${npc.disposition})`)
      if (npc.faction) lines.push(`  Faction: ${npc.faction}`)
      if (npc.personality) lines.push(`  Personality: ${npc.personality}`)
      if (npc.lastEncounterSummary) lines.push(`  Prior encounter: ${npc.lastEncounterSummary}`)
      if (npc.currentTask) lines.push(`  Current task: ${npc.currentTask.description}`)
    }
  }

  if (bystanders.length) {
    lines.push('', '=== NEARBY NPCs ===')
    for (const npc of bystanders) {
      const nameTag = npc.title ? `${npc.name}, ${npc.title}` : npc.name
      lines.push(`${nameTag} [${npc.dispositionLabel}]`)
      if (npc.smallSummary) lines.push(`  ${npc.smallSummary}`)
    }
  }

  if (encounterData?.isInCombat) {
    lines.push('', '=== COMBAT ENCOUNTER ===')
    lines.push(`IN COMBAT — Turn order position: ${(encounterData.activeTurnIndex ?? 0) + 1}`)
    for (const c of encounterData.creatures.filter((cr) => cr.is_alive)) {
      lines.push(`Enemy: ${c.creature_id} — HP ${c.current_health}/${c.health_max}`)
    }
  }

  return lines.join('\n')
}

function serializeLoreResult(lore: LoreEngineOutput, resolution?: CheckResolution): string {
  const lines = [`Action type: ${lore.action_type}`]
  if (lore.narrative_notes) lines.push(`Context: ${lore.narrative_notes}`)
  if (resolution) {
    if (resolution.choice === 'spend') {
      const contrib = resolution.pool_contributed ?? 0
      lines.push(`Check resolved: Player guaranteed success — contributed ${contrib} from ${resolution.pool} pool`)
    } else {
      const roll = resolution.roll_result ?? '?'
      const outcome = resolution.succeeded ? 'SUCCESS' : 'FAILURE'
      const contrib = resolution.pool_contributed ?? 0
      lines.push(`Check resolved: Player rolled ${roll} on d20 (contributed ${contrib} from ${resolution.pool} pool) — ${outcome}`)
    }
  }
  return lines.join('\n')
}

/**
 * Streams the GM narrative response chunk by chunk (claude-sonnet-4-6).
 * Loads the `architect1` prompt from the DB; falls back to the style text if none exists.
 */
export async function* streamArchitect({
  styleText,
  contextBlock,
  scribeSummary,
  questObjectives,
  loreResult,
  checkResolution,
  lastFourTurns,
  searchResults,
  playerInput,
  client: passedClient,
  userId,
  characterId,
  requestId,
}: {
  styleText: string
  contextBlock: ContextBlock
  scribeSummary: string | null
  questObjectives: unknown
  loreResult: LoreEngineOutput
  checkResolution?: CheckResolution
  lastFourTurns: ConversationTurn[]
  searchResults: string | null
  playerInput: string
  client?: Anthropic
  userId?: string
  characterId?: string
  requestId?: string
}): AsyncGenerator<string> {
  const client = passedClient ?? createClaudeClient()
  const loadedPrompt = await loadArchitectPrompt()
  const baseSystem = loadedPrompt ?? styleText
  synLog('ARCHITECT', `→ prompt:${loadedPrompt ? 'DB' : 'fallback(style)'} | turns:${lastFourTurns.length} | streaming...`, undefined, requestId)
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    { type: 'text', text: baseSystem, cache_control: { type: 'ephemeral' } },
  ]
  if (scribeSummary) {
    systemBlocks.push({ type: 'text', text: `=== STORY SO FAR ===\n${scribeSummary}` })
  }
  if (questObjectives) {
    systemBlocks.push({ type: 'text', text: `=== QUESTS & OBJECTIVES ===\n${JSON.stringify(questObjectives, null, 2)}` })
  }
  if (contextBlock.activeQuestNotes?.length) {
    const notes = contextBlock.activeQuestNotes
      .map((n) => `[${n.questId}]: ${n.gmNotes}`)
      .join('\n\n')
    systemBlocks.push({ type: 'text', text: `=== ACTIVE QUEST CONTEXT (GM ONLY — do not reveal to player) ===\n${notes}` })
  }

  // Build message history from last 4 turns
  const messages: Anthropic.Messages.MessageParam[] = lastFourTurns.map((t) => ({
    role: t.role === 'player' ? 'user' : 'assistant',
    content: t.content,
  }))

  // Build the final user message
  const finalUserParts: string[] = [
    serializeContextBlock(contextBlock),
    '',
    '=== MECHANICAL CONTEXT ===',
    serializeLoreResult(loreResult, checkResolution),
  ]
  if (searchResults) {
    finalUserParts.push('', '=== WORLD SEARCH RESULTS ===', searchResults)
  }
  finalUserParts.push('', '=== PLAYER INPUT ===', playerInput)

  messages.push({ role: 'user', content: finalUserParts.join('\n') })

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature: 0.5,
    system: systemBlocks,
    messages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }

  if (userId) {
    const finalMsg = await stream.finalMessage()
    recordTokenUsage({
      userId,
      characterId,
      agent: 'architect',
      model: 'claude-sonnet-4-6',
      inputTokens: finalMsg.usage.input_tokens,
      outputTokens: finalMsg.usage.output_tokens,
    })
  }
}
