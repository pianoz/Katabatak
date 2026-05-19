import { update_level } from './character.js'
import { resolveCheckDifficulty, updateStat, restorePools } from '../agents/interaction.js'
import { getNpcResponse } from '../agents/npc.js'

export const tools = [
  {
    name: 'update_stat',
    description: 'Adjust any character stat by a signed integer delta. stat is a plain name like "health", "will", "power", "essence", "denarius", "speed", or "skill_points". Negative delta = damage/spend/cost. Positive delta = heal/restore/gain. Pools auto-clamp to [0, max].',
    input_schema: {
      type: 'object',
      properties: {
        stat:  { type: 'string',  description: 'Which stat to change: health | essence | power | will | denarius | speed | skill_points' },
        delta: { type: 'integer', description: 'Signed amount. Negative reduces, positive increases.' },
      },
      required: ['stat', 'delta'],
    },
  },
  {
    name: 'update_level',
    description: 'Set character level. Optionally award bonus skill points.',
    input_schema: {
      type: 'object',
      properties: {
        new_level:             { type: 'integer', minimum: 1 },
        skill_points_to_award: { type: 'integer', minimum: 0 },
      },
      required: ['new_level'],
    },
  },
  {
    name: 'restore_pools',
    description: 'Set all vital pools (health, essence, power, will) to their max values. Use after full rest or major healing.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'resolve_difficulty',
    description: 'Call when a player attempts something that might fail. Returns difficulty (1-20) and the pool they sacrifice from.',
    input_schema: {
      type: 'object',
      properties: {
        action:  { type: 'string', description: 'What the player is attempting' },
        context: { type: 'string', description: 'Brief situational or location context' },
      },
      required: ['action', 'context'],
    },
  },
  {
    name: 'get_npc_response',
    description: 'Call for significant NPC dialogue or reactions. Returns dialogue and mood.',
    input_schema: {
      type: 'object',
      properties: {
        npc_name:    { type: 'string' },
        personality: { type: 'string', description: 'Brief personality traits' },
        situation:   { type: 'string', description: 'What is happening around this NPC right now' },
        player_input:{ type: 'string', description: 'What the player said or did toward the NPC' },
      },
      required: ['npc_name', 'personality', 'situation', 'player_input'],
    },
  },
]

// Normalize any reasonable stat name Claude might produce → canonical DB field name
function normalizeStatName(raw) {
  const s = raw.toLowerCase().replace(/[\s-]+/g, '_')
  const core = s
    .replace(/^current_/, '')
    .replace(/_current$/, '')
    .replace(/_pool$/, '')

  const aliases = {
    health:         'current_health',
    hp:             'current_health',
    hit_points:     'current_health',
    hitpoints:      'current_health',
    essence:        'current_essence',
    mp:             'current_essence',
    mana:           'current_essence',
    magic:          'current_essence',
    focus:          'current_essence',
    power:          'current_power',
    strength:       'current_power',
    will:           'current_will',
    willpower:      'current_will',
    resolve:        'current_will',
    endurance:      'current_will',
    denarius:       'denarius',
    gold:           'denarius',
    money:          'denarius',
    dollars:        'denarius',
    coin:           'denarius',
    coins:          'denarius',
    currency:       'denarius',
    skill_points:   'unused_skill_points',
    skillpoints:    'unused_skill_points',
    skills:         'unused_skill_points',
    speed:          'speed',
    movement:       'speed',
    mov:            'speed',
  }

  return aliases[core] ?? null
}

const handlers = {
  update_stat:        updateStat,
  update_level,
  restore_pools:      restorePools,
  resolve_difficulty: resolveCheckDifficulty,
  get_npc_response:   getNpcResponse,
}

export async function executeTool(name, input, characterId) {
  const handler = handlers[name]
  if (!handler) return { error: `Unknown tool: ${name}` }

  try {
    let resolvedInput = characterId ? { character_id: characterId, ...input } : input

    if (name === 'update_stat' && resolvedInput.stat) {
      const normalized = normalizeStatName(resolvedInput.stat)
      if (!normalized) return { error: `Unknown stat: "${resolvedInput.stat}". Valid: health, essence, power, will, denarius, speed, skill_points` }
      resolvedInput = { ...resolvedInput, stat: normalized }
    }

    return await handler(resolvedInput)
  } catch (err) {
    return { error: err.message }
  }
}
