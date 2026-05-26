import { update_level, update_stat, restore_pools } from './character.js'
import { getNpcResponse } from '../agents/npc.js'
import { searchWorldEntities, getCampaignFacts, getNpcsForGame, type EntityType } from '../../services/world-service.js'
import { getGameAllyCharacters, getActiveEncounter } from '../../services/game-service.js'
import type { ToolResult } from '../types.js'

export const tools = [
  {
    name: 'update_stat',
    description:
      'Adjust any character stat by a signed integer delta. stat is a plain name like "health", "will", "power", "essence", "denarius", "speed", or "skill_points". Negative delta = damage/spend/cost. Positive delta = heal/restore/gain. Pools auto-clamp to [0, max].',
    input_schema: {
      type: 'object' as const,
      properties: {
        stat: {
          type: 'string',
          description:
            'Which stat to change: health | essence | power | will | denarius | speed | skill_points',
        },
        delta: { type: 'integer', description: 'Signed amount. Negative reduces, positive increases.' },
      },
      required: ['stat', 'delta'],
    },
  },
  {
    name: 'update_level',
    description: 'Set character level. Optionally award bonus skill points.',
    input_schema: {
      type: 'object' as const,
      properties: {
        new_level: { type: 'integer', minimum: 1 },
        skill_points_to_award: { type: 'integer', minimum: 0 },
      },
      required: ['new_level'],
    },
  },
  {
    name: 'restore_pools',
    description:
      'Set all vital pools (health, essence, power, will) to their max values. Use after full rest or major healing.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_npc_response',
    description: 'Call for significant NPC dialogue or reactions. Returns dialogue and mood.',
    input_schema: {
      type: 'object' as const,
      properties: {
        npc_name: { type: 'string' },
        personality: { type: 'string', description: 'Brief personality traits' },
        situation: { type: 'string', description: 'What is happening around this NPC right now' },
        player_input: { type: 'string', description: 'What the player said or did toward the NPC' },
      },
      required: ['npc_name', 'personality', 'situation', 'player_input'],
    },
  },
  {
    name: 'search_world_entities',
    description:
      'Full-text search of the world entity catalog. Use to look up nations, regions, places, locations, NPCs, or items. Optionally filter by type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search terms' },
        filter_type: {
          type: 'string',
          enum: ['nation', 'region', 'place', 'location', 'npc', 'item'],
          description: 'Optional: narrow results to a specific entity type',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_campaign_facts',
    description: 'Retrieve player-visible facts recorded for the current game session.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_ally_characters',
    description: 'List other active player characters in the same game session.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_active_encounter',
    description: 'Get current combat state: alive creatures, turn order, active turn index.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

function normalizeStatName(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[\s-]+/g, '_')
  const core = s
    .replace(/^current_/, '')
    .replace(/_current$/, '')
    .replace(/_pool$/, '')

  const aliases: Record<string, string> = {
    health: 'current_health',
    hp: 'current_health',
    hit_points: 'current_health',
    hitpoints: 'current_health',
    essence: 'current_essence',
    mp: 'current_essence',
    mana: 'current_essence',
    magic: 'current_essence',
    focus: 'current_essence',
    power: 'current_power',
    strength: 'current_power',
    will: 'current_will',
    willpower: 'current_will',
    resolve: 'current_will',
    endurance: 'current_will',
    denarius: 'denarius',
    gold: 'denarius',
    money: 'denarius',
    dollars: 'denarius',
    coin: 'denarius',
    coins: 'denarius',
    currency: 'denarius',
    skill_points: 'unused_skill_points',
    skillpoints: 'unused_skill_points',
    skills: 'unused_skill_points',
    speed: 'speed',
    movement: 'speed',
    mov: 'speed',
  }

  return aliases[core] ?? null
}

type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  characterId?: string,
  gameId?: string,
): Promise<ToolResult> {
  try {
    // World/game query tools (game-scoped, no character_id needed)
    if (name === 'search_world_entities') {
      const { query, filter_type } = input as { query: string; filter_type?: EntityType }
      const results = await searchWorldEntities(query, filter_type)
      return { results }
    }

    if (name === 'get_campaign_facts') {
      if (!gameId) return { error: 'No active game session' }
      const facts = await getCampaignFacts(gameId, false)
      return { facts }
    }

    if (name === 'get_ally_characters') {
      if (!gameId || !characterId) return { error: 'No active game session' }
      const allies = await getGameAllyCharacters(gameId, characterId)
      return {
        allies: allies.map((c) => ({
          name: c.name,
          level: c.level,
          class_archetype: c.class_archetype,
          current_health: c.current_health,
          health_max: c.health_max,
        })),
      }
    }

    if (name === 'get_active_encounter') {
      if (!gameId) return { error: 'No active game session' }
      const encounter = await getActiveEncounter(gameId)
      if (!encounter) return { isInCombat: false }
      return {
        isInCombat: true,
        creatures: encounter.creatures.map((c) => ({
          name: c.name,
          current_health: c.current_health,
          health_max: c.health_max,
          is_alive: c.is_alive,
        })),
        turnOrder: encounter.turnOrder,
        activeTurnIndex: encounter.activeTurnIndex,
      }
    }

    // Character-scoped tools
    const characterHandlers: Record<string, ToolHandler> = {
      update_stat,
      update_level,
      restore_pools,
      get_npc_response: getNpcResponse,
    }

    const handler = characterHandlers[name]
    if (!handler) return { error: `Unknown tool: ${name}` }

    let resolvedInput = characterId ? { character_id: characterId, ...input } : input

    if (name === 'update_stat' && resolvedInput.stat) {
      const normalized = normalizeStatName(resolvedInput.stat as string)
      if (!normalized)
        return {
          error: `Unknown stat: "${resolvedInput.stat}". Valid: health, essence, power, will, denarius, speed, skill_points`,
        }
      resolvedInput = { ...resolvedInput, stat: normalized }
    }

    return await handler(resolvedInput)
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
