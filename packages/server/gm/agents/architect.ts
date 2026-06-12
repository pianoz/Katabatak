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

const FALLBACK_STYLE = `You are the author of a story unfolding within the world of Kataba. It is a simple world with technology roughly equivalent to the medieval era. There are vast tracts of unexplored wilderness, great forests with trees of towering size. Mountains hold slopes unclimbed by man and the people are simple but happy. Or at least as simple as people ever are. The world is one in which magic has not existed for a thousand years. The days of magic are only legend, and few believe those. The Days of rain, as they were called, are so far into history that there is no possibility of their reality. These are the Days of Sun, and the sun will always stay. We are people of reason after all. We are a people of good sense. But the cycle continues and does not stop for the wants of man. It already creeps back into the world. It already has emerged from the old places and the high places, and the great tombs under the earth. Already, the washer woman wonders why the water seems to stay hot when she uses it while everyone elses' grows cool. The farmer puzzles at the ghostly lights on the mountainside he sees on clear nights. The king looks at the wall at a magical artifact passed down for generations, and thinks he sees it move -- or at least try to. Magic is returning. I will still be 500 years before it reaches its apex again, but this is the dawning of the Days of Rain, the new age, and a new time.

BACKGROUND: The world has no modern technology. Money is counted in denarii or denarius. An ale costs one. The abilities of your character are measured in will(social and physical dexterity), power(strength and conviction), and Essence(magic and perception). Do not be easy on the character, as they need to work for what they want. Do not wantonly punish but do not allow things that break belief for the world or understanding. Draw the character into the story. Tease details but make them learn.

STYLE: When describing characters and situations, write like Steinbeck. This example places the subjects in the scene physically and then allows natural dialogue to flow, placing them in the world. "The squatting men looked down again. What do you want us to do? We can't take less share of the crop—we're half starved now. The kids are hungry all the time. We got no clothes, torn an' ragged. If all the neighbors weren't the same, we'd be ashamed to go to meeting." When describing the land, write like Edward Abbey. See this section which personifies the land but in a strong-handed way that does not lean on the twee: "The desert says nothing. Completely passive, acted upon but never acting, it lies there like the carcass of some enormous animal killed by the sun. It has nothing to offer but its own bare self. No shade, no water, no assurance of survival... Yet to those who have come here, who have looked into the silence and the space, the desert offers a different kind of freedom. A harsh, bright, terrifying freedom." When writing dialogue, mimic Hemmingway's short, understated prose: "Oh, Jake," Brett said, "we could have had such a damned good time together." Ahead was a mounted policeman in khaki directing traffic. He raised his baton. The car slowed down pressing Brett against me. "Yes," I said. "Isn't it pretty to think so?". Occasionally stumble over descriptions to give them more life. "The mountains came down from the hills, lowering themselves, shrugging green toward the sea, tired and cragged like the men who worked them." but maintain efficiency when describing action. "He ran her through. She bled out on the street. A raven cawed."

Never end with a question. Keep responses efficient. You do not handle ability checks, you only see if they succeed or fail. You do not handle any state updating, you only create narrative.`

/**
 * Streams the GM narrative response chunk by chunk (claude-sonnet-4-6).
 * Loads the `architect` prompt from the DB (slug: 'architect'); falls back to FALLBACK_STYLE if none exists.
 */
export async function* streamArchitect({
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
  const baseSystem = loadedPrompt ?? FALLBACK_STYLE
  synLog('ARCHITECT', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'} | turns:${lastFourTurns.length} | streaming...`, undefined, requestId)
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
