import type { SupabaseClient } from "@supabase/supabase-js"

export interface InventorySnapshot {
  inventory_id: string
  item_id: string
  condition: number
  quantity: number
  is_equipped: boolean
  custom_notes: string | null
  name: string
  type: string | null
  subtype: string | null
  damage: string | null
  defence: number
  cost_gold: number
  weight: number
  is_magical: boolean
  consumable: boolean
  rarity: string | null
  short_description: string | null
}

export interface SkillSnapshot {
  skill_id: string
  name: string
  current_rank: number
  max_rank: number | null
  is_passive: boolean
  effects: unknown[]
}

export interface SpellSnapshot {
  spell_id: number
  name: string | null
  type: string | null
  damage: number | null
  defence: number | null
  cost: number | null
  cast_time_min: number | null
  cooldown_min: number | null
  range_m: number | null
  aoe_m: number | null
}

export interface CharacterSnapshot {
  character_id: string
  taken_at: string
  // Identity
  name: string
  class_archetype: string | null
  level: number | null
  // Pools
  health_max: number | null
  current_health: number | null
  essence_max: number | null
  current_essence: number | null
  power_max: number | null
  current_power: number | null
  will_max: number | null
  current_will: number | null
  // Resources
  denarius: number | null
  unused_skill_points: number
  // Physical
  speed: number | null
  height: number | null
  weight_kgs: number | null
  carrying_capacity: number | null
  current_carry_weight: number | null
  // Location
  location_nation: string | null
  location_region: string | null
  location_place: string | null
  location_immediate: string | null
  // Narrative
  background_primary: string | null
  background_secondary: string | null
  physical_description: string | null
  backstory: string | null
  notes: string | null
  condition_text: string | null
  // Relations
  inventory: InventorySnapshot[]
  skills: SkillSnapshot[]
  spells: SpellSnapshot[]
}

/** Fetches all character state and returns a flat, serializable snapshot. */
export async function takeSnapshot(
  supabase: SupabaseClient,
  characterId: string
): Promise<CharacterSnapshot | null> {
  const [
    { data: character, error: characterError },
    { data: inventoryRows },
    { data: skillRows },
    { data: spellRows },
  ] = await Promise.all([
    supabase.from("characters").select("*").eq("id", characterId).single(),
    supabase
      .from("character_inventory")
      .select("*, items(*)")
      .eq("character_id", characterId),
    supabase
      .from("character_skills")
      .select("skill_id, current_rank, skills(name, max_rank, is_passive, effects)")
      .eq("character_id", characterId),
    supabase
      .from("character_spells")
      .select("spell_id")
      .eq("character_id", characterId),
  ])

  if (characterError || !character) return null

  const char = character as Record<string, unknown>

  const inventory: InventorySnapshot[] = (inventoryRows ?? []).flatMap((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items
    if (!item) return []
    return [
      {
        inventory_id: row.id as string,
        item_id: item.id as string,
        condition: (row.condition as number) ?? 100,
        quantity: (row.quantity as number) ?? 1,
        is_equipped: (row.is_equipped as boolean) ?? false,
        custom_notes: (row.custom_notes as string | null) ?? null,
        name: item.name as string,
        type: (item.type as string | null) ?? null,
        subtype: (item.subtype as string | null) ?? null,
        damage: (item.damage as string | null) ?? null,
        defence: (item.defence as number) ?? 0,
        cost_gold: (item.cost_gold as number) ?? 0,
        weight: (item.weight as number) ?? 0,
        is_magical: (item.is_magical as boolean) ?? false,
        consumable: (item.consumable as boolean) ?? false,
        rarity: (item.rarity as string | null) ?? null,
        short_description: (item.short_description as string | null) ?? null,
      },
    ]
  })

  const skills: SkillSnapshot[] = (skillRows ?? []).flatMap((row) => {
    const skill = Array.isArray(row.skills) ? row.skills[0] : row.skills
    if (!skill) return []
    return [
      {
        skill_id: row.skill_id as string,
        name: skill.name as string,
        current_rank: (row.current_rank as number) ?? 1,
        max_rank: (skill.max_rank as number | null) ?? null,
        is_passive: (skill.is_passive as boolean) ?? true,
        effects: (skill.effects as unknown[]) ?? [],
      },
    ]
  })

  const spellIds = (spellRows ?? [])
    .map((s) => s.spell_id)
    .filter((id): id is number => id !== null)

  const spellDetails =
    spellIds.length > 0
      ? ((await supabase.from("spells").select("*").in("id", spellIds)).data ?? [])
      : []

  const spells: SpellSnapshot[] = spellDetails.map((s) => ({
    spell_id: s.id as number,
    name: (s.name as string | null) ?? null,
    type: (s.type as string | null) ?? null,
    damage: (s.damage as number | null) ?? null,
    defence: (s.defence as number | null) ?? null,
    cost: (s.cost as number | null) ?? null,
    cast_time_min: (s.cast_time_min as number | null) ?? null,
    cooldown_min: (s.cooldown_min as number | null) ?? null,
    range_m: (s.range_m as number | null) ?? null,
    aoe_m: (s.aoe_m as number | null) ?? null,
  }))

  return {
    character_id: characterId,
    taken_at: new Date().toISOString(),
    name: char.name as string,
    class_archetype: (char.class_archetype as string | null) ?? null,
    level: (char.level as number | null) ?? null,
    health_max: (char.health_max as number | null) ?? null,
    current_health: (char.current_health as number | null) ?? null,
    essence_max: (char.essence_max as number | null) ?? null,
    current_essence: (char.current_essence as number | null) ?? null,
    power_max: (char.power_max as number | null) ?? null,
    current_power: (char.current_power as number | null) ?? null,
    will_max: (char.will_max as number | null) ?? null,
    current_will: (char.current_will as number | null) ?? null,
    denarius: (char.denarius as number | null) ?? null,
    unused_skill_points: (char.unused_skill_points as number) ?? 0,
    speed: (char.speed as number | null) ?? null,
    height: (char.height as number | null) ?? null,
    weight_kgs: (char.weight_kgs as number | null) ?? null,
    carrying_capacity: (char.carrying_capacity as number | null) ?? null,
    current_carry_weight: (char.current_carry_weight as number | null) ?? null,
    location_nation: (char.location_nation as string | null) ?? null,
    location_region: (char.location_region as string | null) ?? null,
    location_place: (char.location_place as string | null) ?? null,
    location_immediate: (char.location_immediate as string | null) ?? null,
    background_primary: (char.background_primary as string | null) ?? null,
    background_secondary: (char.background_secondary as string | null) ?? null,
    physical_description: (char.physical_description as string | null) ?? null,
    backstory: (char.backstory as string | null) ?? null,
    notes: (char.notes as string | null) ?? null,
    condition_text: (char.condition_text as string | null) ?? null,
    inventory,
    skills,
    spells,
  }
}

/** Persists a snapshot to the character_snapshots table as a point-in-time save. */
export async function commitSnapshot(
  supabase: SupabaseClient,
  snapshot: CharacterSnapshot,
  label?: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("character_snapshots")
    .insert({
      character_id: snapshot.character_id,
      snapshot,
      taken_at: snapshot.taken_at,
      label: label ?? null,
    })
    .select("id")
    .single()

  if (error) return null
  return data as { id: string }
}
