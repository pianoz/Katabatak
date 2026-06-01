import supabase from '../gm/tools/db.js'
import { runEval } from '../gm/services/claude-service.js'
import { computeSkillModifiers } from './effect-processor.js'
import { synLog } from '../gm/logger.js'
import type { Json } from '@db-types'

const HAIKU = 'claude-haiku-4-5-20251001'

type AttackType = 'normal' | 'strong'
type DefendType = 'normal' | 'strong'

interface WeaponItem {
  name: string
  damage: string | null
  strong_damage: number | null
  cost: number | null
  strong_cost: number | null
  cost_attribute_name: string | null
  modifier: number | null
  coefficient: number | null
  subtype: string | null
  condition: number | null
  effects: Json
}

const UNARMED: WeaponItem = {
  name: 'Unarmed Strike',
  damage: '1d2',
  strong_damage: null,
  cost: 0,
  strong_cost: null,
  cost_attribute_name: 'power',
  modifier: 0,
  coefficient: 1,
  subtype: 'melee',
  condition: null,
  effects: null,
}

export interface CombatActionResult {
  ok: true
  log: string[]
  isInCombat: boolean
  combatPhase: string | null
  outcome?: 'victory' | 'defeat'
}

// Extend the DB types for new columns added by migration (not yet regenerated)
interface GameRow {
  is_in_combat: boolean | null
  combat_phase: string | null
  current_turn_order: string[] | null
  combat_log: string[] | null
}

interface EncounterCreatureRow {
  id: string
  name: string
  level: number | null
  creature_id: string
  is_alive: boolean
  current_health: number | null
  health_max: number | null
  current_power: number | null
  power_max: number | null
  current_will: number | null
  will_max: number | null
  attack_damage: number | null
  attack_cost: number | null
  defence: number | null
  strong_attack: number | null
  strong_cost: number | null     // added by migration
  strong_defence: number | null  // added by migration
}

// ─── Dice helpers ────────────────────────────────────────────────────────────

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function rollDiceStr(diceStr: string): number {
  const match = diceStr.match(/^(\d+)d(\d+)$/)
  if (!match) return rollDie(6)
  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  let total = 0
  for (let i = 0; i < count; i++) total += rollDie(sides)
  return total
}

// ─── Haiku helpers ───────────────────────────────────────────────────────────

async function haikuCreatureDefend(
  name: string,
  normalAC: number,
  strongAC: number,
  powerLeft: number,
  willLeft: number,
): Promise<{ choice: DefendType; flavor: string }> {
  const prompt =
    `You are ${name}. Power: ${powerLeft}, Will: ${willLeft}. ` +
    `Player attacks. Choose: normal defend (blocks ${normalAC}) or strong defend (blocks ${strongAC}). ` +
    `Return JSON only: {"choice":"normal"|"strong","flavor":"[≤12 evocative words]"}`
  try {
    const { text } = await runEval({ prompt, model: HAIKU, maxTokens: 80, temperature: 0.8 })
    const m = text.match(/\{[\s\S]*?\}/)
    if (m) {
      const parsed = JSON.parse(m[0]) as { choice?: string; flavor?: string }
      return { choice: parsed.choice === 'strong' ? 'strong' : 'normal', flavor: parsed.flavor ?? '' }
    }
  } catch { /* fall through */ }
  return { choice: 'normal', flavor: '' }
}

async function haikuCreatureAttack(
  name: string,
  attackSides: number,
  strongSides: number | null,
  powerLeft: number,
  strongCost: number,
): Promise<{ choice: AttackType; flavor: string }> {
  if (!strongSides || powerLeft < strongCost) return { choice: 'normal', flavor: '' }
  const prompt =
    `You are ${name}. Power: ${powerLeft}. ` +
    `Attack options: normal (1d${attackSides}) or strong (1d${strongSides}, costs ${strongCost} power). ` +
    `Return JSON only: {"choice":"normal"|"strong","flavor":"[≤12 evocative words]"}`
  try {
    const { text } = await runEval({ prompt, model: HAIKU, maxTokens: 80, temperature: 0.8 })
    const m = text.match(/\{[\s\S]*?\}/)
    if (m) {
      const parsed = JSON.parse(m[0]) as { choice?: string; flavor?: string }
      return { choice: parsed.choice === 'strong' ? 'strong' : 'normal', flavor: parsed.flavor ?? '' }
    }
  } catch { /* fall through */ }
  return { choice: 'normal', flavor: '' }
}

// ─── Character defence helper ─────────────────────────────────────────────────

async function getCharacterDefence(characterId: string): Promise<{ normal: number; strong: number }> {
  const [{ data: equipped }, { data: charSkills }] = await Promise.all([
    supabase
      .from('character_inventory')
      .select('items!inner(defence, strong_defence, subtype)')
      .eq('character_id', characterId)
      .eq('is_equipped', true),
    supabase
      .from('character_skills')
      .select('current_rank, skills!inner(effects)')
      .eq('character_id', characterId),
  ])

  type ArmorItem = { defence: number | null; strong_defence: number | null; subtype: string | null }
  const armor = (equipped ?? []).map(row => row.items as unknown as ArmorItem)
  const baseDefence = armor.reduce((s, a) => s + (a.defence ?? 0), 0)
  const shieldBonus = armor
    .filter(a => a.subtype === 'shield')
    .reduce((s, a) => s + ((a.strong_defence ?? a.defence) ?? 0), 0)

  type SkillWithEffects = { current_rank: number | null; skills: { effects: Json } }
  const skillRows = (charSkills ?? []).map(row => {
    const typed = row as unknown as SkillWithEffects
    return { current_rank: typed.current_rank, effects: typed.skills.effects }
  })
  const mods = computeSkillModifiers(skillRows)

  return {
    normal: baseDefence + mods.defenceBonus,
    strong: baseDefence + shieldBonus + mods.defenceBonus,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initCombat(gameId: string): Promise<{ ok: true } | { error: string }> {
  const { data: creatures } = await supabase
    .from('encounter_creatures')
    .select('id')
    .eq('game_id', gameId)
    .eq('is_alive', true)

  if (!creatures?.length) return { error: 'No alive creatures in encounter' }

  // Cast update payload — combat_phase is a new column not yet in generated types
  const { error } = await supabase
    .from('games')
    .update({
      is_in_combat: true,
      combat_phase: 'player_attack',
      current_turn_order: creatures.map(c => c.id),
      active_turn_index: 0,
      combat_log: [],
    } as any)
    .eq('id', gameId)

  if (error) return { error: error.message }
  synLog('COMBAT', `✓ init | game:${gameId} | creatures:${creatures.length}`)
  return { ok: true }
}

export async function resolvePlayerAttack(
  gameId: string,
  characterId: string,
  params: {
    weaponInventoryId: string
    attackType: AttackType
    targetCreatureId: string
  },
): Promise<CombatActionResult | { error: string }> {
  // ── Validate phase ──────────────────────────────────────────────────────────
  const { data: gameRaw } = await supabase
    .from('games')
    .select('combat_phase, combat_log, is_in_combat')
    .eq('id', gameId)
    .single()
  const game = gameRaw as unknown as GameRow | null

  if (!game?.is_in_combat || game.combat_phase !== 'player_attack') {
    return { error: 'Not player attack phase' }
  }

  // ── Load character & weapon ─────────────────────────────────────────────────
  const [{ data: character }, { data: invRow }] = await Promise.all([
    supabase
      .from('characters')
      .select('current_power, current_will, current_essence, name')
      .eq('id', characterId)
      .single(),
    params.weaponInventoryId !== '__unarmed__'
      ? supabase
          .from('character_inventory')
          .select('items!inner(name, damage, strong_damage, cost, strong_cost, cost_attribute_name, modifier, coefficient, subtype, condition, effects)')
          .eq('id', params.weaponInventoryId)
          .eq('character_id', characterId)
          .single()
      : Promise.resolve({ data: null }),
  ])

  if (!character) return { error: 'Character not found' }

  const weapon: WeaponItem = invRow
    ? (invRow.items as unknown as WeaponItem)
    : UNARMED

  // ── Pool cost ───────────────────────────────────────────────────────────────
  const cost = params.attackType === 'strong'
    ? (weapon.strong_cost ?? (weapon.cost ?? 1) * 2)
    : (weapon.cost ?? 1)
  const poolAttr = weapon.cost_attribute_name ?? 'power'
  const charPools = character as Record<string, unknown>
  const poolKey = `current_${poolAttr}`
  const currentPool = (charPools[poolKey] as number | null) ?? 0
  if (currentPool < cost) return { error: `Not enough ${poolAttr}` }

  // ── Load target + skill mods ────────────────────────────────────────────────
  const [{ data: creatureRaw }, { data: charSkills }] = await Promise.all([
    supabase.from('encounter_creatures').select('*').eq('id', params.targetCreatureId).eq('game_id', gameId).single(),
    supabase.from('character_skills').select('current_rank, skills!inner(effects)').eq('character_id', characterId),
  ])
  const creature = creatureRaw as unknown as EncounterCreatureRow | null
  if (!creature?.is_alive) return { error: 'Target not found or already dead' }

  type SkillWithEffects = { current_rank: number | null; skills: { effects: Json } }
  const skillRows = (charSkills ?? []).map(row => {
    const typed = row as unknown as SkillWithEffects
    return { current_rank: typed.current_rank, effects: typed.skills.effects }
  })
  const mods = computeSkillModifiers(skillRows)

  // ── Roll damage ─────────────────────────────────────────────────────────────
  const rawRoll = params.attackType === 'strong' && weapon.strong_damage != null
    ? rollDie(weapon.strong_damage)
    : rollDiceStr(weapon.damage ?? '1d6')
  const attackRoll = rawRoll + mods.attackBonus

  // ── Haiku: creature picks defence ───────────────────────────────────────────
  const strongAC = creature.strong_defence ?? creature.defence ?? 0
  const { choice: defChoice, flavor } = await haikuCreatureDefend(
    creature.name,
    creature.defence ?? 0,
    strongAC,
    creature.current_power ?? 0,
    creature.current_will ?? 0,
  )
  const defValue = defChoice === 'strong' ? strongAC : (creature.defence ?? 0)
  const defCost = defChoice === 'strong' ? (creature.attack_cost ?? 1) * 2 : (creature.attack_cost ?? 1)
  const net = Math.max(0, attackRoll - defValue)

  // ── Apply ───────────────────────────────────────────────────────────────────
  const newCreatureHp = Math.max(0, (creature.current_health ?? 0) - net)
  const creatureAlive = newCreatureHp > 0

  const dbUpdates: Promise<unknown>[] = [
    supabase.from('characters').update({ [poolKey]: currentPool - cost } as any).eq('id', characterId),
    supabase.from('encounter_creatures').update({
      current_health: newCreatureHp,
      is_alive: creatureAlive,
      current_will: Math.max(0, (creature.current_will ?? 0) - defCost),
    }).eq('id', params.targetCreatureId),
  ]

  // Degrade non-melee weapon condition (same rule as IRL dashboard)
  if (params.weaponInventoryId !== '__unarmed__' && weapon.subtype !== 'melee') {
    const conditionLoss = attackRoll + (weapon.modifier ?? 0)
    const currentCondition = weapon.condition ?? 100
    const newCondition = Math.max(0, currentCondition - conditionLoss)
    if (newCondition <= 0) {
      dbUpdates.push(supabase.from('character_inventory').delete().eq('id', params.weaponInventoryId))
    } else {
      dbUpdates.push(supabase.from('character_inventory').update({ condition: newCondition }).eq('id', params.weaponInventoryId))
    }
  }

  await Promise.all(dbUpdates)

  // ── Build log ───────────────────────────────────────────────────────────────
  const newLines: string[] = []
  if (flavor) newLines.push(`[${creature.name}] ${flavor}`)
  const bonusStr = mods.attackBonus !== 0 ? ` (${mods.attackBonus > 0 ? '+' : ''}${mods.attackBonus})` : ''
  newLines.push(
    `YOU → ${creature.name}: ${params.attackType === 'strong' ? 'Strong Attack' : 'Attack'}` +
    ` | roll=${attackRoll}${bonusStr} def=${defValue} net=${net}`
  )
  if (!creatureAlive) newLines.push(`[${creature.name}] defeated.`)

  // ── Win condition ─────────────────────────────────────────────────────────────
  const { data: stillAlive } = await supabase
    .from('encounter_creatures').select('id').eq('game_id', gameId).eq('is_alive', true)
  const anyAlive = stillAlive?.some(c => c.id !== params.targetCreatureId || creatureAlive)

  let newPhase: string | null = 'player_defend'
  let isInCombat = true
  let outcome: 'victory' | undefined
  if (!anyAlive) {
    newPhase = null; isInCombat = false; outcome = 'victory'
    newLines.push('VICTORY — all enemies defeated.')
    synLog('COMBAT', `✓ victory | game:${gameId}`)
  }

  const updatedLog = [...((game.combat_log ?? []) as string[]), ...newLines]
  await supabase.from('games').update({
    combat_log: updatedLog, combat_phase: newPhase, is_in_combat: isInCombat,
  } as any).eq('id', gameId)

  return { ok: true, log: newLines, isInCombat, combatPhase: newPhase, outcome }
}

export async function resolvePlayerDefend(
  gameId: string,
  characterId: string,
  defendType: DefendType,
): Promise<CombatActionResult | { error: string }> {
  // ── Validate phase ──────────────────────────────────────────────────────────
  const { data: gameRaw } = await supabase
    .from('games').select('combat_phase, current_turn_order, combat_log, is_in_combat').eq('id', gameId).single()
  const game = gameRaw as unknown as GameRow | null
  if (!game?.is_in_combat || game.combat_phase !== 'player_defend') return { error: 'Not player defend phase' }

  // ── Character + defence ─────────────────────────────────────────────────────
  const { data: character } = await supabase
    .from('characters').select('current_will, current_health, name').eq('id', characterId).single()
  if (!character) return { error: 'Character not found' }

  const { normal: normalDef, strong: strongDef } = await getCharacterDefence(characterId)
  const defValue = defendType === 'strong' ? strongDef : normalDef
  const defCost = defendType === 'strong' ? 2 : 1

  // ── Load alive creatures ─────────────────────────────────────────────────────
  const creatureIds = (game.current_turn_order ?? []) as string[]
  const { data: creaturesRaw } = await supabase
    .from('encounter_creatures').select('*').in('id', creatureIds).eq('is_alive', true)
  const creatures = (creaturesRaw ?? []) as unknown as EncounterCreatureRow[]

  const newLines: string[] = []
  let totalDamage = 0

  if (creatures.length) {
    const attackDecisions = await Promise.all(
      creatures.map(c =>
        haikuCreatureAttack(
          c.name,
          c.attack_damage ?? 6,
          c.strong_attack ?? null,
          c.current_power ?? 0,
          c.strong_cost ?? (c.attack_cost ?? 1) * 2,
        )
      )
    )

    const creatureUpdates: Promise<unknown>[] = []
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]
      const { choice: atkChoice, flavor } = attackDecisions[i]
      const atkCost = atkChoice === 'strong'
        ? (c.strong_cost ?? (c.attack_cost ?? 1) * 2)
        : (c.attack_cost ?? 1)
      if ((c.current_power ?? 0) < atkCost) {
        newLines.push(`[${c.name}] too exhausted to attack.`); continue
      }
      const roll = atkChoice === 'strong'
        ? rollDie(c.strong_attack ?? c.attack_damage ?? 6)
        : rollDie(c.attack_damage ?? 6)
      const net = Math.max(0, roll - defValue)
      totalDamage += net
      creatureUpdates.push(
        supabase.from('encounter_creatures')
          .update({ current_power: Math.max(0, (c.current_power ?? 0) - atkCost) })
          .eq('id', c.id) as unknown as Promise<unknown>
      )
      if (flavor) newLines.push(`[${c.name}] ${flavor}`)
      newLines.push(
        `${c.name} → YOU: ${atkChoice === 'strong' ? 'Strong Attack' : 'Attack'}` +
        ` | roll=${roll} def=${defValue} net=${net}`
      )
    }
    await Promise.all(creatureUpdates)
  }

  // ── Apply damage ─────────────────────────────────────────────────────────────
  const newWill = Math.max(0, (character.current_will ?? 0) - defCost)
  const newHp = Math.max(0, (character.current_health ?? 0) - totalDamage)
  await supabase.from('characters').update({ current_will: newWill, current_health: newHp }).eq('id', characterId)

  newLines.push(
    `YOU defended (${defendType}) — total incoming: ${totalDamage}` +
    (defValue > 0 ? ` (blocked ${defValue})` : '')
  )

  let newPhase: string | null = 'player_attack'
  let isInCombat = true
  let outcome: 'defeat' | undefined
  if (newHp <= 0) {
    newPhase = null; isInCombat = false; outcome = 'defeat'
    newLines.push('DEFEAT — you have fallen.')
    synLog('COMBAT', `✗ defeat | game:${gameId}`)
  }

  const updatedLog = [...((game.combat_log ?? []) as string[]), ...newLines]
  await supabase.from('games').update({
    combat_log: updatedLog, combat_phase: newPhase, is_in_combat: isInCombat,
  } as any).eq('id', gameId)

  return { ok: true, log: newLines, isInCombat, combatPhase: newPhase, outcome }
}

export async function resolvePlayerEquip(
  gameId: string,
  characterId: string,
  inventoryId: string,
): Promise<CombatActionResult | { error: string }> {
  const { data: gameRaw } = await supabase
    .from('games')
    .select('combat_phase, combat_log, is_in_combat')
    .eq('id', gameId)
    .single()
  const game = gameRaw as unknown as GameRow | null
  if (!game?.is_in_combat || game.combat_phase !== 'player_attack') {
    return { error: 'Not player attack phase' }
  }

  // Load the new weapon's name for the log
  const { data: invRow } = await supabase
    .from('character_inventory')
    .select('items!inner(name, type, hidden)')
    .eq('id', inventoryId)
    .eq('character_id', characterId)
    .single()
  if (!invRow) return { error: 'Item not found in inventory' }

  type NamedItem = { name: string; type: string | null; hidden: boolean | null }
  const item = invRow.items as unknown as NamedItem
  if (item.type !== 'weapon') return { error: 'Item is not a weapon' }
  if (item.hidden) return { error: 'Cannot equip hidden items' }

  // Unequip all non-hidden weapons for this character, then equip the chosen one
  const { data: weaponRows } = await supabase
    .from('character_inventory')
    .select('id, items!inner(type, hidden)')
    .eq('character_id', characterId)
    .eq('items.type', 'weapon' as any)
  type WeaponRow = { id: string; items: { type: string | null; hidden: boolean | null } }
  const weaponIds = ((weaponRows ?? []) as unknown as WeaponRow[])
    .filter(r => !r.items.hidden)
    .map(r => r.id)
  if (weaponIds.length) {
    await supabase.from('character_inventory').update({ is_equipped: false }).in('id', weaponIds)
  }
  await supabase.from('character_inventory').update({ is_equipped: true }).eq('id', inventoryId)

  const newLine = `YOU re-equipped: ${item.name}`
  const updatedLog = [...((game.combat_log ?? []) as string[]), newLine]
  await supabase.from('games').update({
    combat_log: updatedLog, combat_phase: 'player_defend',
  } as any).eq('id', gameId)

  synLog('COMBAT', `✓ equip | game:${gameId} | weapon:${item.name}`)
  return { ok: true, log: [newLine], isInCombat: true, combatPhase: 'player_defend' }
}

export async function endCombat(gameId: string): Promise<{ ok: true }> {
  await supabase.from('games').update({
    is_in_combat: false,
    combat_phase: null,
    current_turn_order: [],
    combat_log: [],
  } as any).eq('id', gameId)
  synLog('COMBAT', `✓ end | game:${gameId}`)
  return { ok: true }
}
