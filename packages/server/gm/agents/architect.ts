import Anthropic from '@anthropic-ai/sdk'
import type { ContextBlock, ConversationTurn, LoreEngineOutput, CheckResolution } from '../types.js'
import { loadRandomArchitectPrompt } from '../../services/prompt-service.js'
import { synLog } from '../logger.js'

const client = new Anthropic()

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
  const { character: { character, inventory, skills, spells }, healthText, essenceText, powerText, willText, locationEntities, encounterData, npcs, inventoryWeight, syngemGame } = ctx

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

  const locationParts = [character.location_nation, character.location_region, character.location_place]
    .filter(Boolean)
  if (locationParts.length) lines.push(`Region: ${locationParts.join(' › ')}`)

  if (syngemGame?.in_combat) lines.push('Status: IN COMBAT')
  if (character.condition_text) lines.push(`Condition: ${character.condition_text}`)
  if (character.notes) lines.push(`Notes: ${character.notes}`)

  const equipped = inventory.filter((i) => i.is_equipped).map((i) => i.items?.name ?? '?')
  const carried = inventory.filter((i) => !i.is_equipped).map((i) => i.items?.name ?? '?')
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

  if (npcs.length) {
    lines.push('', '=== NEARBY NPCs ===')
    for (const npc of npcs) {
      lines.push(`${npc.name}`)
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
    lines.push(
      `Check resolved: ${resolution.choice === 'spend' ? `Player spent from ${resolution.pool} pool — SUCCESS` : `Player rolled ${resolution.roll_result ?? '?'} on d10 — resolve outcome accordingly`}`,
    )
  }
  return lines.join('\n')
}

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
}): AsyncGenerator<string> {
  const loadedPrompt = await loadRandomArchitectPrompt()
  const baseSystem = loadedPrompt ?? styleText
  synLog('ARCHITECT', `→ prompt:${loadedPrompt ? 'DB' : 'fallback(style)'} | turns:${lastFourTurns.length} | streaming...`)
  const systemParts = [baseSystem]
  if (scribeSummary) {
    systemParts.push(`=== STORY SO FAR ===\n${scribeSummary}`)
  }
  if (questObjectives) {
    systemParts.push(`=== QUESTS & OBJECTIVES ===\n${JSON.stringify(questObjectives, null, 2)}`)
  }
  const system = systemParts.join('\n\n')

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
    system,
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
}
