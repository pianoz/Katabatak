export type ResourcePool = 'will' | 'essence' | 'power' | 'health';

export interface SkillEffect {
  type: 'stat_modifier' | 'pool_conversion' | 'resource_gain' | 'weight_reduction' | 'utility';
  target?: string;
  source?: ResourcePool;
  destination?: ResourcePool;
  add?: number;
  multiply?: number;
  condition?: {
    weapon_type?: string;
    armor_type?: string;
    item_type?: string;
    is_combat?: boolean;
  };
  limit?: {
    amount: number;
    period: 'day' | 'rest';
  };
  grant_spell?: string;
  grant_item?: string;
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

// Scale the additive bonus linearly with rank.
// Scale the multiplicative bonus by growing its delta: rank 1 = base, rank 2 = double delta, etc.
function scaleEffect(
  effect: SkillEffect,
  rank: number,
): { add: number; multiply: number } {
  const add = (effect.add ?? 0) * rank;
  const multiply = effect.multiply !== undefined ? 1 + (effect.multiply - 1) * rank : 1;
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
        case 'stat_modifier': {
          if (effect.target === 'damage') {
            result.modifiers.damage.add += add;
            result.modifiers.damage.multiply *= multiply;
          } else if (effect.target === 'defense') {
            result.modifiers.defense.add += add;
            result.modifiers.defense.multiply *= multiply;
          } else if (effect.target === 'carry_capacity') {
            result.modifiers.carryCapacity.add += add;
            result.modifiers.carryCapacity.multiply *= multiply;
          }
          break;
        }

        case 'weight_reduction': {
          // target names the item type reduced; omitting target means all items
          const key = effect.target ?? 'all';
          result.modifiers.weightReduction[key] = (result.modifiers.weightReduction[key] ?? 0) + add;
          break;
        }

        case 'pool_conversion': {
          if (effect.source && effect.destination) {
            // Map destination (required pool) -> source (pool actually spent)
            result.poolOverrides.substitutedPools[effect.destination] = effect.source;
            if (add !== 0 || multiply !== 1) {
              result.poolOverrides.conversionRates.push({
                from: effect.source,
                to: effect.destination,
                rate: multiply,
                flat: add,
              });
            }
          }
          break;
        }

        case 'resource_gain': {
          if (context.actionType === 'rest' && effect.destination) {
            result.poolOverrides.restGains[effect.destination] =
              (result.poolOverrides.restGains[effect.destination] ?? 0) + add;
          }
          break;
        }

        case 'utility': {
          if (effect.grant_spell) result.grantedMechanics.spells.push(effect.grant_spell);
          if (effect.grant_item) result.grantedMechanics.items.push(effect.grant_item);

          // Condition removal: target names the status condition (e.g. 'poison')
          // limit.amount encodes remaining uses for this rest/day period
          if (effect.target && context.conditionToRemove === effect.target) {
            const trackerKey = `s${si}_e${ei}`;
            const used = dailyTracker[trackerKey] ?? 0;
            const cap = effect.limit?.amount ?? 1;
            if (used < cap) {
              result.grantedMechanics.allowedRemovals.push({
                condition: effect.target,
                remainingUses: cap - used,
              });
            }
          }
          break;
        }
      }
    }
  }

  return result;
}
