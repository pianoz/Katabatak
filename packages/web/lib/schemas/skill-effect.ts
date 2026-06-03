import { z } from "zod"
import type { Effect } from "@/lib/effect-engine"

const EffectActionSchema = z.object({
  type: z.enum(["stat_modifier", "weight_negation", "grant_spell", "grant_item", "grant_active_skill", "rest_modifier", "pool_recharge", "critical", "near_critical", "discount"]),
  target: z.string(),
  math: z.enum(["add", "multiply"]),
  Value: z.number(),
  per_rank_add: z.number().nullable(),
  per_rank_multiply: z.number().nullable(),
  target_value: z.string().nullable().optional(),
})

const EffectSchema = z.object({
  effect_id: z.string(),
  trait: z.enum(["none", "pure_narrative", "partial_narrative", "passive", "skeng", "one_time"]),
  trigger: z.enum(["activated", "passive", "reactive"]),
  roll_context: z.enum(["attack", "defense", "pool_check", "any"]).optional(),
  cost: z.object({
    pool: z.enum(["essence", "power", "will", "health"]),
    value: z.number(),
  }).nullable(),
  display: z.object({
    prompt_text: z.string(),
    reminder_text: z.string(),
  }).nullable(),
  actions: z.array(EffectActionSchema),
})

export const EffectsSchema = z.array(EffectSchema)

export function parseEffects(data: unknown): Effect[] {
  if (!Array.isArray(data) || data.length === 0) return []
  const result = EffectsSchema.safeParse(data)
  if (!result.success) return []
  return result.data as Effect[]
}
