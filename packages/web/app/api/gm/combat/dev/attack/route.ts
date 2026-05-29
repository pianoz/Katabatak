import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DevCreature, DevCharacter, DevWeapon } from '../_types'
import { rollDie, rollDiceStr } from '../_types'

interface AttackBody {
  character: DevCharacter
  creatures: DevCreature[]
  weapon: DevWeapon
  attackType: 'normal' | 'strong'
  targetCreatureId: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { character, creatures, weapon, attackType, targetCreatureId } = await req.json() as AttackBody

  const target = creatures.find(c => c.id === targetCreatureId && c.is_alive)
  if (!target) return NextResponse.json({ error: 'Target not found or dead' }, { status: 400 })

  const cost = attackType === 'strong' ? weapon.strongCost : weapon.cost
  const poolKey = `current_${weapon.costAttribute}` as keyof DevCharacter
  const currentPool = character[poolKey] as number
  if (currentPool < cost) return NextResponse.json({ error: `Not enough ${weapon.costAttribute}` }, { status: 400 })

  const rawRoll = attackType === 'strong' && weapon.strongDamage != null
    ? rollDie(weapon.strongDamage)
    : rollDiceStr(weapon.damage ?? '1d6')

  // Creature picks defence heuristically (no AI in test mode)
  const strongAC = target.strong_defence ?? target.defence
  const canStrong = strongAC > target.defence && target.current_power >= target.attack_cost * 2
  const defChoice: 'normal' | 'strong' = canStrong && Math.random() > 0.5 ? 'strong' : 'normal'
  const defValue = defChoice === 'strong' ? strongAC : target.defence
  const defCost = defChoice === 'strong' ? target.attack_cost * 2 : target.attack_cost
  const net = Math.max(0, rawRoll - defValue)

  const newCreatures = creatures.map(c => {
    if (c.id !== targetCreatureId) return c
    const newHp = Math.max(0, c.current_health - net)
    return { ...c, current_health: newHp, current_will: Math.max(0, c.current_will - defCost), is_alive: newHp > 0 }
  })

  const log: string[] = [
    `YOU → ${target.name}: ${attackType === 'strong' ? 'Strong Attack' : 'Attack'} | roll=${rawRoll} def=${defValue} net=${net}`,
  ]
  if (!newCreatures.find(c => c.id === targetCreatureId)?.is_alive) log.push(`[${target.name}] defeated.`)

  const anyAlive = newCreatures.some(c => c.is_alive)
  const combatPhase = anyAlive ? 'player_defend' : null
  const outcome = anyAlive ? undefined : 'victory'
  if (!anyAlive) log.push('VICTORY — all enemies defeated.')

  return NextResponse.json({
    ok: true,
    character: { ...character, [poolKey]: currentPool - cost },
    creatures: newCreatures,
    log,
    combatPhase,
    outcome,
  })
}
