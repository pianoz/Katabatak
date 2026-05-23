import { z } from "zod"
import type { SkillEffect } from "@/lib/skill-engine"

const SkillEffectSchema = z.object({
  type: z.enum(["stat_modifier", "grant_spell", "grant_item", "grant_active_skill", "reminder", "combat_modifier", "mechanic_unlock"]),
  is_skeng: z.boolean().optional(),
  target: z.string().optional(),
  stat: z.string().optional(),
  add: z.number().optional(),
  per_rank_add: z.number().optional(),
  multiply: z.number().optional(),
  per_rank_multiply: z.number().optional(),
  condition: z.object({
    weapon_type: z.string().optional(),
    armor_type: z.string().optional(),
    item_type: z.string().optional(),
    is_combat: z.boolean().optional(),
    trigger_event: z.string().optional(),
  }).optional(),
  limit: z.object({
    amount: z.number(),
    period: z.string(),
  }).optional(),
  grant_spell: z.array(z.string()).optional(),
  grant_item: z.array(z.string()).optional(),
  grant_active_skill: z.array(z.string()).optional(),
  reminder_text: z.string().optional(),
  mechanic_flag: z.string().optional(),
})

export const SkillEffectsSchema = z.array(SkillEffectSchema)

export function parseSkillEffects(data: unknown): SkillEffect[] {
  if (!Array.isArray(data) || data.length === 0) return []
  const result = SkillEffectsSchema.safeParse(data)
  if (!result.success) return []
  return result.data as SkillEffect[]
}
