export interface PlaceholderType {
  label: string
  fields: string[]
}

/** All data types and their injectable fields. */
export const PLACEHOLDER_REGISTRY: Record<string, PlaceholderType> = {
  character: {
    label: 'Character',
    fields: [
      'name',
      'level',
      'class_archetype',
      'health_max',
      'current_health',
      'essence_max',
      'current_essence',
      'power_max',
      'current_power',
      'will_max',
      'current_will',
      'speed',
      'background_primary',
      'backstory',
      'condition_text',
    ],
  },
  item: {
    label: 'Item',
    fields: ['name', 'type', 'subtype', 'damage', 'rarity', 'short_description', 'cost_gold', 'weight'],
  },
  spell: {
    label: 'Spell',
    fields: ['name', 'type', 'subtype', 'damage', 'cost', 'range_m', 'cast_time_min', 'description'],
  },
  skill: {
    label: 'Skill',
    fields: ['name', 'skill_text'],
  },
  game: {
    label: 'Game',
    fields: ['name', 'session_number', 'is_in_combat'],
  },
}

/**
 * Replaces all `{{type.field}}` tokens in template with values from data.
 * Unresolved tokens are left as-is.
 */
export function parsePlaceholders(
  template: string,
  data: Record<string, Record<string, unknown>>
): string {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, type, field) => {
    const obj = data[type]
    if (obj != null && field in obj) {
      const val = obj[field]
      return val != null ? String(val) : match
    }
    return match
  })
}

/**
 * Scans all block content strings and returns unique type names
 * that appear in at least one `{{type.field}}` placeholder.
 */
export function extractUsedTypes(
  blocks: Array<{ content: string }>
): string[] {
  const types = new Set<string>()
  const re = /\{\{(\w+)\.\w+\}\}/g
  for (const block of blocks) {
    let m: RegExpExecArray | null
    while ((m = re.exec(block.content)) !== null) {
      if (m[1] in PLACEHOLDER_REGISTRY) types.add(m[1])
    }
  }
  return Array.from(types)
}
