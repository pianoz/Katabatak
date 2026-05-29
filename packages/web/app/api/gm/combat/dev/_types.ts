export interface DevCreature {
  id: string
  name: string
  level: number | null
  ascii_art?: string | null
  current_health: number
  health_max: number
  current_power: number
  power_max: number
  current_will: number
  will_max: number
  attack_damage: number
  attack_cost: number
  defence: number
  strong_attack: number | null
  strong_cost: number
  strong_defence: number | null
  is_alive: boolean
}

export interface DevCharacter {
  name: string
  current_health: number
  health_max: number
  current_power: number
  power_max: number
  current_will: number
  will_max: number
  current_essence: number
  essence_max: number
}

export interface DevWeapon {
  inventoryId: string
  name: string
  damage: string | null
  strongDamage: number | null
  cost: number
  strongCost: number
  costAttribute: string
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

export function rollDiceStr(diceStr: string): number {
  const match = diceStr.match(/^(\d+)d(\d+)$/)
  if (!match) return rollDie(6)
  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  let total = 0
  for (let i = 0; i < count; i++) total += rollDie(sides)
  return total
}
