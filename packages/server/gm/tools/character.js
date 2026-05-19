import supabase from './db.js'

const POOL_MAX_FIELD = {
  current_health:  'health_max',
  current_essence: 'essence_max',
  current_power:   'power_max',
  current_will:    'will_max',
}

const SIMPLE_FIELDS = new Set(['denarius', 'unused_skill_points', 'speed'])

async function adjustPool(character_id, currentField, maxField, delta) {
  const { data: char, error } = await supabase
    .from('characters')
    .select(`id, name, ${currentField}, ${maxField}`)
    .eq('id', character_id)
    .single()

  if (error || !char) return { error: error?.message ?? 'Character not found' }

  const newVal = Math.max(0, Math.min(char[maxField], char[currentField] + delta))
  const { error: upErr } = await supabase
    .from('characters')
    .update({ [currentField]: newVal })
    .eq('id', character_id)

  if (upErr) return { error: upErr.message }
  return { name: char.name, [currentField]: newVal, [maxField]: char[maxField] }
}

async function adjustField(character_id, field, delta) {
  const { data: char, error } = await supabase
    .from('characters')
    .select(`id, name, ${field}`)
    .eq('id', character_id)
    .single()

  if (error || !char) return { error: error?.message ?? 'Character not found' }

  const newVal = Math.max(0, char[field] + delta)
  const { error: upErr } = await supabase
    .from('characters')
    .update({ [field]: newVal })
    .eq('id', character_id)

  if (upErr) return { error: upErr.message }
  return { name: char.name, [field]: newVal }
}

export async function update_stat({ character_id, stat, delta }) {
  const maxField = POOL_MAX_FIELD[stat]
  if (maxField) return adjustPool(character_id, stat, maxField, delta)
  if (SIMPLE_FIELDS.has(stat)) return adjustField(character_id, stat, delta)
  return { error: `Unknown stat: "${stat}"` }
}

export async function update_level({ character_id, new_level, skill_points_to_award = 0 }) {
  const { data: char, error } = await supabase
    .from('characters')
    .select('id, name, unused_skill_points')
    .eq('id', character_id)
    .single()

  if (error || !char) return { error: error?.message ?? 'Character not found' }

  const newPoints = char.unused_skill_points + skill_points_to_award
  const { error: upErr } = await supabase
    .from('characters')
    .update({ level: new_level, unused_skill_points: newPoints })
    .eq('id', character_id)

  if (upErr) return { error: upErr.message }
  return { name: char.name, level: new_level, unused_skill_points: newPoints }
}

export async function restore_pools({ character_id }) {
  const { data: char, error } = await supabase
    .from('characters')
    .select('id, name, health_max, essence_max, power_max, will_max')
    .eq('id', character_id)
    .single()

  if (error || !char) return { error: error?.message ?? 'Character not found' }

  const { error: upErr } = await supabase
    .from('characters')
    .update({
      current_health:  char.health_max,
      current_essence: char.essence_max,
      current_power:   char.power_max,
      current_will:    char.will_max,
    })
    .eq('id', character_id)

  if (upErr) return { error: upErr.message }
  return {
    name:            char.name,
    current_health:  char.health_max,
    current_essence: char.essence_max,
    current_power:   char.power_max,
    current_will:    char.will_max,
  }
}
