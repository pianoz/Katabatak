export type ResourcePool = 'will' | 'essence' | 'power' | 'health';

export interface SkillEffect {
  type: 'stat_modifier' | 'grant_spell' | 'grant_item' | 'grant_active_skill' | 'reminder' | 'combat_modifier' | 'mechanic_unlock';
  is_skeng?: boolean;
  target?: string;
  stat?: string;
  add?: number;
  per_rank_add?: number;
  multiply?: number;
  per_rank_multiply?: number;
  condition?: {
    weapon_type?: string;
    armor_type?: string;
    item_type?: string;
    is_combat?: boolean;
    trigger_event?: string;
  };
  limit?: {
    amount: number;
    period: string;
  };
  grant_spell?: string[];
  grant_item?: string[];
  grant_active_skill?: string[];
  reminder_text?: string;
  mechanic_flag?: string;
}

export interface ActionContext {
  actionType: 'attack' | 'defense' | 'rest' | 'inventory_check' | 'skill_check' | 'craft' | 'brew';
  weaponType?: string;
  armorType?: string;
  itemType?: string;
  isCombat?: boolean;
  conditionToRemove?: string;
}

export interface CalculationResult {
  modifiers: {
    damage: { add: number; multiply: number };
    defense: { add: number; multiply: number };
    carryCapacity: { add: number; multiply: number };
    weightReduction: Record<string, number>;
  };
  poolOverrides: {
    substitutedPools: Partial<Record<ResourcePool, ResourcePool>>;
    conversionRates: Array<{ from: ResourcePool; to: ResourcePool; rate: number; flat: number }>;
    restGains: Partial<Record<ResourcePool, number>>;
  };
  grantedMechanics: {
    spells: string[];
    items: string[];
    allowedRemovals: Array<{ condition: string; remainingUses: number }>;
  };
}

function blankResult(): CalculationResult {
  return {
    modifiers: {
      damage: { add: 0, multiply: 1 },
      defense: { add: 0, multiply: 1 },
      carryCapacity: { add: 0, multiply: 1 },
      weightReduction: {},
    },
    poolOverrides: {
      substitutedPools: {},
      conversionRates: [],
      restGains: {},
    },
    grantedMechanics: {
      spells: [],
      items: [],
      allowedRemovals: [],
    },
  };
}

function matchesCondition(effect: SkillEffect, context: ActionContext): boolean {
  const cond = effect.condition;
  if (!cond) return true;
  if (cond.weapon_type !== undefined && context.weaponType !== cond.weapon_type) return false;
  if (cond.armor_type !== undefined && context.armorType !== cond.armor_type) return false;
  if (cond.item_type !== undefined && context.itemType !== cond.item_type) return false;
  if (cond.is_combat !== undefined && context.isCombat !== cond.is_combat) return false;
  return true;
}

function scaleEffect(effect: SkillEffect, rank: number): { add: number; multiply: number } {
  const add = (effect.add ?? 0) + (effect.per_rank_add ?? 0) * rank;
  const multiply = effect.multiply !== undefined
    ? effect.multiply + (effect.per_rank_multiply ?? 0) * (rank - 1)
    : 1;
  return { add, multiply };
}

export function evaluateSkillEffects(
  activeSkills: Array<{ effects: SkillEffect[]; current_rank: number }>,
  context: ActionContext,
  dailyTracker: Record<string, number> = {},
): CalculationResult {
  const result = blankResult();

  for (let si = 0; si < activeSkills.length; si++) {
    const skill = activeSkills[si];

    for (let ei = 0; ei < skill.effects.length; ei++) {
      const effect = skill.effects[ei];

      if (!matchesCondition(effect, context)) continue;

      // Check usage limits against dailyTracker key "s{si}_e{ei}"
      if (effect.limit) {
        const key = `s${si}_e${ei}`;
        const used = dailyTracker[key] ?? 0;
        if (used >= effect.limit.amount) continue;
      }

      const { add, multiply } = scaleEffect(effect, skill.current_rank);

      switch (effect.type) {
        case 'stat_modifier':
        case 'combat_modifier': {
          switch (effect.stat) {
            case 'damage':
              result.modifiers.damage.add += add;
              result.modifiers.damage.multiply *= multiply;
              break;
            case 'defense':
              result.modifiers.defense.add += add;
              result.modifiers.defense.multiply *= multiply;
              break;
            case 'carrying_capacity':
              result.modifiers.carryCapacity.add += add;
              result.modifiers.carryCapacity.multiply *= multiply;
              break;
            case 'weight': {
              const wkey = effect.target ?? 'all';
              result.modifiers.weightReduction[wkey] = (result.modifiers.weightReduction[wkey] ?? 0) + add;
              break;
            }
          }
          break;
        }

        case 'grant_spell':
          if (Array.isArray(effect.grant_spell)) {
            result.grantedMechanics.spells.push(...effect.grant_spell);
          }
          break;

        case 'grant_item':
          if (Array.isArray(effect.grant_item)) {
            result.grantedMechanics.items.push(...effect.grant_item);
          }
          break;

        case 'grant_active_skill':
        case 'reminder':
        case 'mechanic_unlock':
          break;
      }
    }
  }

  return result;
}
