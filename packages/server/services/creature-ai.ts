type AttackType = 'normal' | 'strong'
type DefendType = 'normal' | 'strong'

export interface CreaturePools {
  creatureId: string
  currentPower: number
  currentWill: number
  /** Die sides for strong attack — null if the creature has no strong attack */
  strongAttackSides: number | null
  /** Power cost for the strong attack */
  strongAttackCost: number
}

export interface CreatureAction {
  attackChoice: AttackType
  defendChoice: DefendType
}

/**
 * Deterministic creature AI.
 *
 * Will > Power → will-dominant: strong defend, weak attack.
 * Power ≥ Will → power-dominant: strong attack (if affordable), weak defend.
 *
 * Strong attack is only chosen when the creature has both the stat and the pool to pay for it.
 */
export function resolveCreatureAction(pools: CreaturePools): CreatureAction {
  const willDominates = pools.currentWill > pools.currentPower
  const canStrongAttack =
    pools.strongAttackSides != null && pools.currentPower >= pools.strongAttackCost

  return {
    attackChoice: !willDominates && canStrongAttack ? 'strong' : 'normal',
    defendChoice: willDominates ? 'strong' : 'normal',
  }
}
