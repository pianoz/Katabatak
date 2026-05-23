import { getCharacter, updateCharacter } from '../../services/character-service.js'
import type { ToolResult } from '../types.js'

const POOL_MAX_FIELD: Record<string, string> = {
  current_health: 'health_max',
  current_essence: 'essence_max',
  current_power: 'power_max',
  current_will: 'will_max',
}

const SIMPLE_FIELDS = new Set(['denarius', 'unused_skill_points', 'speed'])

type NumericFields = Record<string, number | null>

async function adjustPool(
  character_id: string,
  currentField: string,
  maxField: string,
  delta: number,
): Promise<ToolResult> {
  const char = await getCharacter(character_id)
  if (!char) return { error: 'Character not found' }

  const fields = char as unknown as NumericFields
  const current = fields[currentField] ?? 0
  const max = fields[maxField] ?? 0
  const newVal = Math.max(0, Math.min(max, current + delta))

  const { error } = await updateCharacter(character_id, { [currentField]: newVal })
  if (error) return { error }
  return { name: char.name, [currentField]: newVal, [maxField]: max }
}

async function adjustField(character_id: string, field: string, delta: number): Promise<ToolResult> {
  const char = await getCharacter(character_id)
  if (!char) return { error: 'Character not found' }

  const fields = char as unknown as NumericFields
  const newVal = Math.max(0, (fields[field] ?? 0) + delta)

  const { error } = await updateCharacter(character_id, { [field]: newVal })
  if (error) return { error }
  return { name: char.name, [field]: newVal }
}

export async function update_stat(input: Record<string, unknown>): Promise<ToolResult> {
  const { character_id, stat, delta } = input as { character_id: string; stat: string; delta: number }
  const maxField = POOL_MAX_FIELD[stat]
  if (maxField) return adjustPool(character_id, stat, maxField, delta)
  if (SIMPLE_FIELDS.has(stat)) return adjustField(character_id, stat, delta)
  return { error: `Unknown stat: "${stat}"` }
}

export async function update_level(input: Record<string, unknown>): Promise<ToolResult> {
  const { character_id, new_level, skill_points_to_award = 0 } = input as {
    character_id: string
    new_level: number
    skill_points_to_award?: number
  }

  const char = await getCharacter(character_id)
  if (!char) return { error: 'Character not found' }

  const newPoints = char.unused_skill_points + (skill_points_to_award as number)
  const { error } = await updateCharacter(character_id, {
    level: new_level,
    unused_skill_points: newPoints,
  })
  if (error) return { error }
  return { name: char.name, level: new_level, unused_skill_points: newPoints }
}

export async function restore_pools(input: Record<string, unknown>): Promise<ToolResult> {
  const { character_id } = input as { character_id: string }

  const char = await getCharacter(character_id)
  if (!char) return { error: 'Character not found' }

  const updates = {
    current_health: char.health_max,
    current_essence: char.essence_max,
    current_power: char.power_max,
    current_will: char.will_max,
  }

  const { error } = await updateCharacter(character_id, updates)
  if (error) return { error }
  return {
    name: char.name,
    current_health: char.health_max,
    current_essence: char.essence_max,
    current_power: char.power_max,
    current_will: char.will_max,
  }
}
