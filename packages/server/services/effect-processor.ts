import type { Json } from '@db-types'

export interface EffectModifiers {
  attackBonus: number
  defenceBonus: number
}

interface SimpleModifierEffect {
  type: 'modifier'
  attribute: string
  value: number
}

function isSimpleModifier(v: unknown): v is SimpleModifierEffect {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>)['type'] === 'modifier' &&
    typeof (v as Record<string, unknown>)['attribute'] === 'string' &&
    typeof (v as Record<string, unknown>)['value'] === 'number'
  )
}

/**
 * Sums attack and defence bonuses from a character's passive skill effects.
 * Skills use the simple format: {"type":"modifier","attribute":"attack"|"defence","value":N}
 * rank multiplies the value (rank 2 Swordsmanship gives +2 attack, rank 3 gives +3).
 */
export function computeSkillModifiers(
  skills: Array<{ current_rank: number | null; effects: Json }>
): EffectModifiers {
  let attackBonus = 0
  let defenceBonus = 0

  for (const skill of skills) {
    const rank = skill.current_rank ?? 1
    const effects = Array.isArray(skill.effects) ? (skill.effects as Json[]) : []
    for (const effect of effects) {
      if (!isSimpleModifier(effect)) continue
      const scaled = effect.value * rank
      if (effect.attribute === 'attack') attackBonus += scaled
      else if (effect.attribute === 'defence') defenceBonus += scaled
    }
  }

  return { attackBonus, defenceBonus }
}
