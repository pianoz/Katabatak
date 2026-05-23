export type ResourcePool = 'essence' | 'power' | 'will' | 'health';
export type EffectTrait = 'none' | 'pure_narrative' | 'partial_narrative' | 'passive' | 'skeng' | 'one_time';
export type EffectTrigger = 'activated' | 'passive' | 'reactive';
export type ActionType = 'stat_modifier' | 'weight_negation' | 'grant_spell' | 'grant_item' | 'grant_active_skill' | 'rest_modifier';
export type MathOp = 'add' | 'multiply';

export interface EffectAction {
  type: ActionType;
  target: string;
  math: MathOp;
  Value: number;
  per_rank_add: number | null;
  per_rank_multiply: number | null;
  target_value?: string | null;
}

export interface EffectCost {
  pool: ResourcePool;
  value: number;
}

export interface EffectDisplay {
  prompt_text: string;
  reminder_text: string;
}

export interface Effect {
  effect_id: string;
  trait: EffectTrait;
  trigger: EffectTrigger;
  cost: EffectCost | null;
  display: EffectDisplay | null;
  actions: EffectAction[];
}

export interface ConditionalModifier {
  target: string;
  add: number;
  multiply: number;
}

export interface EffectPrompt {
  effect_id: string;
  prompt_text: string;
  reminder_text: string | null;
  cost: EffectCost | null;
  conditionalModifiers: ConditionalModifier[];
}

export interface EffectCalculationResult {
  /** Aggregated stat modifiers from skeng effects. Keyed by sub-ability or 'carry_weight'. */
  statModifiers: Record<string, { add: number; multiply: number }>;
  /** Item sub-types whose carry weight is negated to 0. */
  weightNegations: string[];
  /** Bonus pool restoration applied on top of base rest. Keyed by pool name. */
  restModifiers: Record<string, { add: number; multiply: number }>;
  grantedSpells: string[];
  grantedItems: string[];
  grantedActiveSkills: string[];
  /** Partial narrative prompts requiring GM/player validation before applying modifiers. */
  prompts: EffectPrompt[];
  passives: Array<{ effect_id: string; reminder_text: string }>;
}

function getOrInit(
  map: Record<string, { add: number; multiply: number }>,
  key: string,
): { add: number; multiply: number } {
  if (!map[key]) map[key] = { add: 0, multiply: 1 };
  return map[key];
}

function scaleAdd(action: EffectAction, rank: number): number {
  return action.Value + (action.per_rank_add ?? 0) * (rank - 1);
}

function scaleMultiply(action: EffectAction, rank: number): number {
  return action.Value + (action.per_rank_multiply ?? 0) * (rank - 1);
}

function applyActions(
  actions: EffectAction[],
  rank: number,
  result: EffectCalculationResult,
): void {
  for (const action of actions) {
    switch (action.type) {
      case 'stat_modifier': {
        const mod = getOrInit(result.statModifiers, action.target);
        if (action.math === 'add') {
          mod.add += scaleAdd(action, rank);
        } else {
          mod.multiply *= scaleMultiply(action, rank);
        }
        break;
      }
      case 'weight_negation': {
        const subType = action.target_value;
        if (subType && !result.weightNegations.includes(subType)) {
          result.weightNegations.push(subType);
        }
        break;
      }
      case 'grant_spell':
        result.grantedSpells.push(action.target);
        break;
      case 'grant_item':
        result.grantedItems.push(action.target);
        break;
      case 'grant_active_skill':
        result.grantedActiveSkills.push(action.target);
        break;
      case 'rest_modifier': {
        const mod = getOrInit(result.restModifiers, action.target);
        if (action.math === 'add') {
          mod.add += scaleAdd(action, rank);
        } else {
          mod.multiply *= scaleMultiply(action, rank);
        }
        break;
      }
    }
  }
}

function computeConditionalModifiers(
  actions: EffectAction[],
  rank: number,
): ConditionalModifier[] {
  const modMap: Record<string, { add: number; multiply: number }> = {};
  for (const action of actions) {
    if (action.type !== 'stat_modifier') continue;
    const mod = getOrInit(modMap, action.target);
    if (action.math === 'add') {
      mod.add += scaleAdd(action, rank);
    } else {
      mod.multiply *= scaleMultiply(action, rank);
    }
  }
  return Object.entries(modMap).map(([target, { add, multiply }]) => ({ target, add, multiply }));
}

function emptyResult(): EffectCalculationResult {
  return {
    statModifiers: {},
    weightNegations: [],
    restModifiers: {},
    grantedSpells: [],
    grantedItems: [],
    grantedActiveSkills: [],
    prompts: [],
    passives: [],
  };
}

/**
 * Evaluate a single Effect block in isolation.
 * Use this for items (normal = effects[0], strong = effects[1]) and individual spell effects.
 * Items have no rank progression — always pass rank=1 (default).
 */
export function evaluateEffect(effect: Effect, rank: number = 1): EffectCalculationResult {
  const result = emptyResult();
  switch (effect.trait) {
    case 'skeng':
    case 'one_time':
      applyActions(effect.actions, rank, result);
      break;
    case 'partial_narrative':
      if (effect.display) {
        result.prompts.push({
          effect_id: effect.effect_id,
          prompt_text: effect.display.prompt_text,
          reminder_text: effect.display.reminder_text ?? null,
          cost: effect.cost,
          conditionalModifiers: computeConditionalModifiers(effect.actions, rank),
        });
      }
      break;
    case 'passive':
      if (effect.display?.reminder_text) {
        result.passives.push({
          effect_id: effect.effect_id,
          reminder_text: effect.display.reminder_text,
        });
      }
      break;
    case 'pure_narrative':
    case 'none':
      break;
  }
  return result;
}

export function evaluateEffects(
  skills: Array<{ current_rank: number; effects: Effect[] }>,
): EffectCalculationResult {
  const result = emptyResult();

  for (const skill of skills) {
    const rank = skill.current_rank;

    for (const effect of skill.effects) {
      switch (effect.trait) {
        case 'skeng':
        case 'one_time':
          applyActions(effect.actions, rank, result);
          break;

        case 'partial_narrative': {
          if (!effect.display) break;
          result.prompts.push({
            effect_id: effect.effect_id,
            prompt_text: effect.display.prompt_text,
            reminder_text: effect.display.reminder_text ?? null,
            cost: effect.cost,
            conditionalModifiers: computeConditionalModifiers(effect.actions, rank),
          });
          break;
        }

        case 'passive':
          if (effect.display?.reminder_text) {
            result.passives.push({
              effect_id: effect.effect_id,
              reminder_text: effect.display.reminder_text,
            });
          }
          break;

        case 'pure_narrative':
        case 'none':
          break;
      }
    }
  }

  return result;
}
