/**
 * DATABASE TYPES
 * Based on public schema tables.
 */

export interface Spell {
  id: number;
  name: string | null;
  type?: string | null;
  subtype?: string | null;
  damage?: number | null;
  defence?: number | null;
  modifier?: number | null;
  coefficient?: number | null;
  cost?: number | null;
  cast_time_min?: number | null;
  remain_time_min?: number | null;
  aoe_m?: number | null;
  range_m?: number | null;
  active?: boolean | null;
  cooldown_min?: number | null;
  req_item_1?: string | null; // uuid
  req_item_2?: string | null; // uuid
  req_item_3?: string | null; // uuid
  req_skill_1?: string | null; // uuid
  req_skill_2?: string | null; // uuid
  cost_attribute_name?: string | null;
  modifier_attribute_name?: string | null;
  coefficient_attribute_name?: string | null;
  description?: string | null;
}

export interface Item {
  id: string; // uuid
  name: string;
  subtype?: string | null;
  damage?: string | null;
  rarity?: string | null;
  short_description?: string | null;
  cost_gold?: number | null;
  weight?: number | null;
  is_magical?: boolean | null;
  required_skill?: string | null; // uuid
  type?: string | null;
  defence?: number | null;
  default_condition?: number | null;
  coefficient?: number | null;
  modifier?: number | null;
  die_count?: number | null;
  cost?: number | null;
  cost_attribute_name?: string | null;
  modifier_attribute_name?: string | null;
  coefficient_attribute_name?: string | null;
  consumable?: boolean | null;
  action_text?: string | null;
  image_url?: string | null;
  long_description?: string | null;
}

export interface Skill {
  id: string; // uuid
  name: string;
  unlock_hint?: string | null;
  unlock_key?: string | null;
  modified_id?: string | null; // uuid
  coefficient?: number | null;
  carryover?: number | null;
  damage_type?: string | null;
  lingering?: boolean | null;
  lingering_coefficient?: number | null;
  modified2_id?: string | null; // uuid
  coefficient2?: number | null;
  modified3_id?: string | null; // uuid
  coefficient3?: number | null;
  is_passive?: boolean | null;
  max_rank?: number | null;
  created_at?: string | Date | null; // Timestamptz usually parses to string in JSON
  skill_text?: string | null;
}

export interface CharacterInventory {
  id: string; // uuid
  character_id?: string | null; // uuid
  item_id?: string | null; // uuid
  quantity?: number | null;
  is_equipped?: boolean | null;
  custom_notes?: string | null;
  acquired_at?: string | Date | null;
  condition?: number | null; // smallint
}

export interface Character {
  id: string                      // uuid
  user_id: string | null

  // Identity
  name: string
  level: number
  class_archetype: string | null
  is_active: boolean

  // Vital pools
  health_max: number
  current_health: number
  essence_max: number
  current_essence: number
  power_max: number
  current_power: number
  will_max: number
  current_will: number

  // Physical stats
  speed: number
  height: number                  // cm
  weight_kgs: number
  carrying_capacity: number
  current_carry_weight: number

  // Currency
  denarius: number

  // Background / lore
  background_primary: string | null
  background_secondary: string | null
  physical_description: string | null
  backstory: string | null

  // Metadata
  created_at: string              // ISO timestamp string from Supabase
}