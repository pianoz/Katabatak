/**
 * skill-engine.test.ts
 *
 * Exhaustive unit tests for evaluateSkillEffects().
 * Run with:  npx vitest  or  npx jest  (both work without configuration changes).
 *
 * Import path assumes the test lives next to skill-engine.ts.
 * Adjust "../skill-engine" if your directory structure differs.
 */

import { describe, it, expect } from 'vitest';
import { evaluateSkillEffects } from './skill-engine';
import type { SkillEffect, ActionContext } from './skill-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal active-skill wrapper so test code stays readable. */
function makeSkill(rank: number, ...effects: SkillEffect[]) {
  return { current_rank: rank, effects };
}

/** Default "do nothing" context used when the action type doesn't matter. */
const BASE_ATTACK: ActionContext = { actionType: 'attack', isCombat: true };
const BASE_REST: ActionContext = { actionType: 'rest' };

// ---------------------------------------------------------------------------
// Fixture skill catalogue
// (These mirror what you'd store in the `effects` jsonb column in `public.skills`.)
// ---------------------------------------------------------------------------

/** Adds flat damage, no conditions. */
const RAW_DAMAGE_EFFECT: SkillEffect = {
  type: 'stat_modifier',
  target: 'damage',
  add: 3,
};

/** Multiplies damage, no conditions. */
const DAMAGE_MULTIPLY_EFFECT: SkillEffect = {
  type: 'stat_modifier',
  target: 'damage',
  multiply: 1.1,
};

/** Flat + multiply damage, sword-only. */
const SWORD_DAMAGE_EFFECT: SkillEffect = {
  type: 'stat_modifier',
  target: 'damage',
  add: 5,
  multiply: 1.2,
  condition: { weapon_type: 'sword' },
};

/** Defense modifier, heavy-armor only. */
const HEAVY_ARMOR_DEFENSE_EFFECT: SkillEffect = {
  type: 'stat_modifier',
  target: 'defense',
  add: 4,
  multiply: 1.15,
  condition: { armor_type: 'heavy' },
};

/** Carry capacity modifier. */
const CARRY_EFFECT: SkillEffect = {
  type: 'stat_modifier',
  target: 'carry_capacity',
  add: 10,
};

/** Reduces armor weight. */
const ARMOR_WEIGHT_EFFECT: SkillEffect = {
  type: 'weight_reduction',
  target: 'armor',
  add: 5,
};

/** Reduces all item weight. */
const ALL_WEIGHT_EFFECT: SkillEffect = {
  type: 'weight_reduction',
  add: 2,
};

/** Lets you spend will instead of essence. */
const WILL_FOR_ESSENCE_EFFECT: SkillEffect = {
  type: 'pool_conversion',
  source: 'will',
  destination: 'essence',
};

/** Pool conversion with a rate: spend half the will to cover power cost. */
const HALF_WILL_FOR_POWER_EFFECT: SkillEffect = {
  type: 'pool_conversion',
  source: 'will',
  destination: 'power',
  multiply: 0.5,
};

/** Grants power on rest. */
const POWER_ON_REST_EFFECT: SkillEffect = {
  type: 'resource_gain',
  destination: 'power',
  add: 4,
};

/** Grants health on rest. */
const HEALTH_ON_REST_EFFECT: SkillEffect = {
  type: 'resource_gain',
  destination: 'health',
  add: 6,
};

/** Grants a spell. */
const FIREBALL_GRANT: SkillEffect = {
  type: 'utility',
  grant_spell: 'fireball',
};

/** Grants an item. */
const ANTIDOTE_GRANT: SkillEffect = {
  type: 'utility',
  grant_item: 'antidote',
};

/** Removes poison, 2×/day. */
const POISON_REMOVAL_EFFECT: SkillEffect = {
  type: 'utility',
  target: 'poison',
  limit: { amount: 2, period: 'day' },
};

/** Damage bonus limited to 1×/rest. */
const LIMITED_DAMAGE_EFFECT: SkillEffect = {
  type: 'stat_modifier',
  target: 'damage',
  add: 10,
  limit: { amount: 1, period: 'rest' },
};

/** Damage only in combat. */
const COMBAT_ONLY_DAMAGE: SkillEffect = {
  type: 'stat_modifier',
  target: 'damage',
  add: 7,
  condition: { is_combat: true },
};

/** Damage only out of combat. */
const NON_COMBAT_DAMAGE: SkillEffect = {
  type: 'stat_modifier',
  target: 'damage',
  add: 3,
  condition: { is_combat: false },
};

// ---------------------------------------------------------------------------
// 1. Stat modifier – damage
// ---------------------------------------------------------------------------

describe('stat_modifier – damage', () => {
  it('adds flat damage at rank 1', () => {
    const result = evaluateSkillEffects([makeSkill(1, RAW_DAMAGE_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(3);
    expect(result.modifiers.damage.multiply).toBe(1);
  });

  it('scales flat damage linearly with rank', () => {
    const result = evaluateSkillEffects([makeSkill(3, RAW_DAMAGE_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(9); // 3 × 3
  });

  it('applies multiply at rank 1', () => {
    const result = evaluateSkillEffects([makeSkill(1, DAMAGE_MULTIPLY_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.multiply).toBeCloseTo(1.1);
  });

  it('scales multiply delta with rank (rank 2 → ×1.20)', () => {
    const result = evaluateSkillEffects([makeSkill(2, DAMAGE_MULTIPLY_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.multiply).toBeCloseTo(1.2);
  });

  it('scales multiply delta with rank (rank 3 → ×1.30)', () => {
    const result = evaluateSkillEffects([makeSkill(3, DAMAGE_MULTIPLY_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.multiply).toBeCloseTo(1.3);
  });

  it('stacks flat damage from two skills additively', () => {
    const result = evaluateSkillEffects(
      [makeSkill(1, RAW_DAMAGE_EFFECT), makeSkill(2, RAW_DAMAGE_EFFECT)],
      BASE_ATTACK,
    );
    expect(result.modifiers.damage.add).toBe(3 + 6); // rank1×3 + rank2×3
  });

  it('stacks multipliers from two skills multiplicatively', () => {
    const result = evaluateSkillEffects(
      [makeSkill(1, DAMAGE_MULTIPLY_EFFECT), makeSkill(1, DAMAGE_MULTIPLY_EFFECT)],
      BASE_ATTACK,
    );
    expect(result.modifiers.damage.multiply).toBeCloseTo(1.1 * 1.1);
  });

  it('combines flat and multiply in one effect', () => {
    const result = evaluateSkillEffects([makeSkill(2, SWORD_DAMAGE_EFFECT)], {
      ...BASE_ATTACK,
      weaponType: 'sword',
    });
    expect(result.modifiers.damage.add).toBe(10);      // 5 × rank 2
    expect(result.modifiers.damage.multiply).toBeCloseTo(1.4); // 1 + (0.2 × 2)
  });
});

// ---------------------------------------------------------------------------
// 2. Stat modifier – defense
// ---------------------------------------------------------------------------

describe('stat_modifier – defense', () => {
  it('applies defense modifier with matching armor type', () => {
    const result = evaluateSkillEffects([makeSkill(1, HEAVY_ARMOR_DEFENSE_EFFECT)], {
      actionType: 'defense',
      armorType: 'heavy',
    });
    expect(result.modifiers.defense.add).toBe(4);
    expect(result.modifiers.defense.multiply).toBeCloseTo(1.15);
  });

  it('does not apply defense modifier for wrong armor type', () => {
    const result = evaluateSkillEffects([makeSkill(1, HEAVY_ARMOR_DEFENSE_EFFECT)], {
      actionType: 'defense',
      armorType: 'light',
    });
    expect(result.modifiers.defense.add).toBe(0);
    expect(result.modifiers.defense.multiply).toBe(1);
  });

  it('applies defense at rank 3 with correct scaling', () => {
    const result = evaluateSkillEffects([makeSkill(3, HEAVY_ARMOR_DEFENSE_EFFECT)], {
      actionType: 'defense',
      armorType: 'heavy',
    });
    expect(result.modifiers.defense.add).toBe(12);       // 4 × 3
    expect(result.modifiers.defense.multiply).toBeCloseTo(1.45); // 1 + (0.15 × 3)
  });
});

// ---------------------------------------------------------------------------
// 3. Stat modifier – carry_capacity
// ---------------------------------------------------------------------------

describe('stat_modifier – carry_capacity', () => {
  it('adds carry capacity at rank 1', () => {
    const result = evaluateSkillEffects([makeSkill(1, CARRY_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.carryCapacity.add).toBe(10);
  });

  it('scales carry capacity with rank', () => {
    const result = evaluateSkillEffects([makeSkill(4, CARRY_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.carryCapacity.add).toBe(40);
  });

  it('does not affect damage or defense', () => {
    const result = evaluateSkillEffects([makeSkill(2, CARRY_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(0);
    expect(result.modifiers.defense.add).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Conditions – weapon_type, armor_type, is_combat
// ---------------------------------------------------------------------------

describe('conditions', () => {
  it('fires sword effect only when weaponType matches', () => {
    const noMatch = evaluateSkillEffects([makeSkill(1, SWORD_DAMAGE_EFFECT)], {
      ...BASE_ATTACK,
      weaponType: 'axe',
    });
    expect(noMatch.modifiers.damage.add).toBe(0);

    const match = evaluateSkillEffects([makeSkill(1, SWORD_DAMAGE_EFFECT)], {
      ...BASE_ATTACK,
      weaponType: 'sword',
    });
    expect(match.modifiers.damage.add).toBe(5);
  });

  it('fires combat-only effect when is_combat is true', () => {
    const inCombat = evaluateSkillEffects([makeSkill(1, COMBAT_ONLY_DAMAGE)], {
      actionType: 'attack',
      isCombat: true,
    });
    expect(inCombat.modifiers.damage.add).toBe(7);

    const outOfCombat = evaluateSkillEffects([makeSkill(1, COMBAT_ONLY_DAMAGE)], {
      actionType: 'attack',
      isCombat: false,
    });
    expect(outOfCombat.modifiers.damage.add).toBe(0);
  });

  it('fires non-combat effect only outside combat', () => {
    const out = evaluateSkillEffects([makeSkill(1, NON_COMBAT_DAMAGE)], {
      actionType: 'skill_check',
      isCombat: false,
    });
    expect(out.modifiers.damage.add).toBe(3);

    const inCombat = evaluateSkillEffects([makeSkill(1, NON_COMBAT_DAMAGE)], {
      actionType: 'attack',
      isCombat: true,
    });
    expect(inCombat.modifiers.damage.add).toBe(0);
  });

  it('multi-condition effect only fires when ALL fields match', () => {
    const swordCombatEffect: SkillEffect = {
      type: 'stat_modifier',
      target: 'damage',
      add: 8,
      condition: { weapon_type: 'sword', is_combat: true },
    };

    // sword but not combat
    const r1 = evaluateSkillEffects([makeSkill(1, swordCombatEffect)], {
      actionType: 'attack',
      weaponType: 'sword',
      isCombat: false,
    });
    expect(r1.modifiers.damage.add).toBe(0);

    // combat but not sword
    const r2 = evaluateSkillEffects([makeSkill(1, swordCombatEffect)], {
      actionType: 'attack',
      weaponType: 'axe',
      isCombat: true,
    });
    expect(r2.modifiers.damage.add).toBe(0);

    // both match
    const r3 = evaluateSkillEffects([makeSkill(1, swordCombatEffect)], {
      actionType: 'attack',
      weaponType: 'sword',
      isCombat: true,
    });
    expect(r3.modifiers.damage.add).toBe(8);
  });

  it('unspecified condition fields do not block the effect', () => {
    // RAW_DAMAGE_EFFECT has no condition → fires regardless of weaponType
    const result = evaluateSkillEffects([makeSkill(1, RAW_DAMAGE_EFFECT)], {
      ...BASE_ATTACK,
      weaponType: 'crossbow',
      armorType: 'light',
    });
    expect(result.modifiers.damage.add).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Weight reduction
// ---------------------------------------------------------------------------

describe('weight_reduction', () => {
  it('reduces armor weight at rank 1', () => {
    const result = evaluateSkillEffects([makeSkill(1, ARMOR_WEIGHT_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.weightReduction['armor']).toBe(5);
  });

  it('scales armor weight reduction with rank', () => {
    const result = evaluateSkillEffects([makeSkill(3, ARMOR_WEIGHT_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.weightReduction['armor']).toBe(15);
  });

  it('uses "all" key when target is omitted', () => {
    const result = evaluateSkillEffects([makeSkill(2, ALL_WEIGHT_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.weightReduction['all']).toBe(4); // 2 × 2
  });

  it('stacks weight reductions of the same type additively', () => {
    const result = evaluateSkillEffects(
      [makeSkill(1, ARMOR_WEIGHT_EFFECT), makeSkill(2, ARMOR_WEIGHT_EFFECT)],
      BASE_ATTACK,
    );
    expect(result.modifiers.weightReduction['armor']).toBe(5 + 10);
  });

  it('tracks different item types independently', () => {
    const potionEffect: SkillEffect = { type: 'weight_reduction', target: 'potion', add: 3 };
    const result = evaluateSkillEffects(
      [makeSkill(1, ARMOR_WEIGHT_EFFECT), makeSkill(1, potionEffect)],
      BASE_ATTACK,
    );
    expect(result.modifiers.weightReduction['armor']).toBe(5);
    expect(result.modifiers.weightReduction['potion']).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 6. Pool conversion
// ---------------------------------------------------------------------------

describe('pool_conversion', () => {
  it('registers a substitution: spend will instead of essence', () => {
    const result = evaluateSkillEffects([makeSkill(1, WILL_FOR_ESSENCE_EFFECT)], BASE_ATTACK);
    expect(result.poolOverrides.substitutedPools['essence']).toBe('will');
  });

  it('registers conversion rate when multiply is set', () => {
    const result = evaluateSkillEffects([makeSkill(1, HALF_WILL_FOR_POWER_EFFECT)], BASE_ATTACK);
    expect(result.poolOverrides.substitutedPools['power']).toBe('will');
    const rate = result.poolOverrides.conversionRates.find(
      (r) => r.from === 'will' && r.to === 'power',
    );
    expect(rate).toBeDefined();
    // At rank 1: 1 + (0.5 − 1) × 1 = 0.5
    expect(rate!.rate).toBeCloseTo(0.5);
  });

  it('scales conversion rate delta with rank', () => {
    const result = evaluateSkillEffects([makeSkill(2, HALF_WILL_FOR_POWER_EFFECT)], BASE_ATTACK);
    const rate = result.poolOverrides.conversionRates.find(
      (r) => r.from === 'will' && r.to === 'power',
    );
    // At rank 2: 1 + (0.5 − 1) × 2 = 0.0
    expect(rate!.rate).toBeCloseTo(0);
  });

  it('does not add a conversionRate entry when no multiply/add is set', () => {
    const result = evaluateSkillEffects([makeSkill(1, WILL_FOR_ESSENCE_EFFECT)], BASE_ATTACK);
    expect(result.poolOverrides.conversionRates).toHaveLength(0);
  });

  it('later conversion overwrites earlier substitution for the same destination', () => {
    // Both skills substitute for essence; last-write wins in the map
    const powerForEssence: SkillEffect = {
      type: 'pool_conversion',
      source: 'power',
      destination: 'essence',
    };
    const result = evaluateSkillEffects(
      [makeSkill(1, WILL_FOR_ESSENCE_EFFECT), makeSkill(1, powerForEssence)],
      BASE_ATTACK,
    );
    expect(result.poolOverrides.substitutedPools['essence']).toBe('power');
  });
});

// ---------------------------------------------------------------------------
// 7. Resource gain (rest)
// ---------------------------------------------------------------------------

describe('resource_gain', () => {
  it('grants power on rest at rank 1', () => {
    const result = evaluateSkillEffects([makeSkill(1, POWER_ON_REST_EFFECT)], BASE_REST);
    expect(result.poolOverrides.restGains['power']).toBe(4);
  });

  it('scales rest gain with rank', () => {
    const result = evaluateSkillEffects([makeSkill(3, POWER_ON_REST_EFFECT)], BASE_REST);
    expect(result.poolOverrides.restGains['power']).toBe(12);
  });

  it('does NOT grant resources outside of rest context', () => {
    const result = evaluateSkillEffects([makeSkill(2, POWER_ON_REST_EFFECT)], BASE_ATTACK);
    expect(result.poolOverrides.restGains['power']).toBeUndefined();
  });

  it('accumulates rest gains from multiple skills targeting the same pool', () => {
    const result = evaluateSkillEffects(
      [makeSkill(1, POWER_ON_REST_EFFECT), makeSkill(2, POWER_ON_REST_EFFECT)],
      BASE_REST,
    );
    expect(result.poolOverrides.restGains['power']).toBe(4 + 8);
  });

  it('tracks different pools independently during rest', () => {
    const result = evaluateSkillEffects(
      [makeSkill(1, POWER_ON_REST_EFFECT), makeSkill(1, HEALTH_ON_REST_EFFECT)],
      BASE_REST,
    );
    expect(result.poolOverrides.restGains['power']).toBe(4);
    expect(result.poolOverrides.restGains['health']).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 8. Utility – grant_spell and grant_item
// ---------------------------------------------------------------------------

describe('utility – grants', () => {
  it('grants a spell', () => {
    const result = evaluateSkillEffects([makeSkill(1, FIREBALL_GRANT)], BASE_ATTACK);
    expect(result.grantedMechanics.spells).toContain('fireball');
  });

  it('grants an item', () => {
    const result = evaluateSkillEffects([makeSkill(1, ANTIDOTE_GRANT)], BASE_ATTACK);
    expect(result.grantedMechanics.items).toContain('antidote');
  });

  it('accumulates grants from multiple skills', () => {
    const iceEffect: SkillEffect = { type: 'utility', grant_spell: 'ice_lance' };
    const result = evaluateSkillEffects(
      [makeSkill(1, FIREBALL_GRANT), makeSkill(1, iceEffect)],
      BASE_ATTACK,
    );
    expect(result.grantedMechanics.spells).toContain('fireball');
    expect(result.grantedMechanics.spells).toContain('ice_lance');
  });

  it('rank has no visible effect on grants (still granted once)', () => {
    const result = evaluateSkillEffects([makeSkill(5, FIREBALL_GRANT)], BASE_ATTACK);
    // Should appear exactly once regardless of rank
    expect(result.grantedMechanics.spells.filter((s) => s === 'fireball')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Utility – condition removal
// ---------------------------------------------------------------------------

describe('utility – condition removal', () => {
  const poisonContext: ActionContext = {
    actionType: 'skill_check',
    conditionToRemove: 'poison',
  };

  it('allows removal when tracker is empty', () => {
    const result = evaluateSkillEffects([makeSkill(1, POISON_REMOVAL_EFFECT)], poisonContext);
    expect(result.grantedMechanics.allowedRemovals).toHaveLength(1);
    expect(result.grantedMechanics.allowedRemovals[0].condition).toBe('poison');
    expect(result.grantedMechanics.allowedRemovals[0].remainingUses).toBe(2);
  });

  it('reflects one use already consumed', () => {
    const tracker = { 's0_e0': 1 };
    const result = evaluateSkillEffects(
      [makeSkill(1, POISON_REMOVAL_EFFECT)],
      poisonContext,
      tracker,
    );
    expect(result.grantedMechanics.allowedRemovals[0].remainingUses).toBe(1);
  });

  it('blocks removal when all uses are consumed', () => {
    const tracker = { 's0_e0': 2 };
    const result = evaluateSkillEffects(
      [makeSkill(1, POISON_REMOVAL_EFFECT)],
      poisonContext,
      tracker,
    );
    expect(result.grantedMechanics.allowedRemovals).toHaveLength(0);
  });

  it('does not allow removal when condition does not match', () => {
    const bleedContext: ActionContext = {
      actionType: 'skill_check',
      conditionToRemove: 'bleed',
    };
    const result = evaluateSkillEffects([makeSkill(1, POISON_REMOVAL_EFFECT)], bleedContext);
    expect(result.grantedMechanics.allowedRemovals).toHaveLength(0);
  });

  it('does not allow removal when conditionToRemove is absent', () => {
    const result = evaluateSkillEffects([makeSkill(1, POISON_REMOVAL_EFFECT)], BASE_ATTACK);
    expect(result.grantedMechanics.allowedRemovals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Usage limits (stat_modifier with limit)
// ---------------------------------------------------------------------------

describe('usage limits', () => {
  it('fires limited effect when tracker is empty', () => {
    const result = evaluateSkillEffects([makeSkill(1, LIMITED_DAMAGE_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(10);
  });

  it('suppresses limited effect when limit is exhausted', () => {
    const tracker = { 's0_e0': 1 };
    const result = evaluateSkillEffects(
      [makeSkill(1, LIMITED_DAMAGE_EFFECT)],
      BASE_ATTACK,
      tracker,
    );
    expect(result.modifiers.damage.add).toBe(0);
  });

  it('allows other effects on the same skill even when one is exhausted', () => {
    const mixedSkill = makeSkill(1, LIMITED_DAMAGE_EFFECT, RAW_DAMAGE_EFFECT);
    const tracker = { 's0_e0': 1 }; // first effect exhausted; second (e1) untouched
    const result = evaluateSkillEffects([mixedSkill], BASE_ATTACK, tracker);
    expect(result.modifiers.damage.add).toBe(3); // only the unlimited effect
  });

  it('tracks limits per skill-effect index (s{i}_e{j})', () => {
    const skill0 = makeSkill(1, LIMITED_DAMAGE_EFFECT); // key s0_e0
    const skill1 = makeSkill(1, LIMITED_DAMAGE_EFFECT); // key s1_e0
    const tracker = { 's0_e0': 1 };                     // only skill0's effect exhausted
    const result = evaluateSkillEffects([skill0, skill1], BASE_ATTACK, tracker);
    expect(result.modifiers.damage.add).toBe(10); // skill1 still fires
  });
});

// ---------------------------------------------------------------------------
// 11. Empty / edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns a blank result with no skills', () => {
    const result = evaluateSkillEffects([], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(0);
    expect(result.modifiers.damage.multiply).toBe(1);
    expect(result.modifiers.defense.add).toBe(0);
    expect(result.modifiers.defense.multiply).toBe(1);
    expect(result.modifiers.carryCapacity.add).toBe(0);
    expect(result.modifiers.carryCapacity.multiply).toBe(1);
    expect(result.modifiers.weightReduction).toEqual({});
    expect(result.poolOverrides.substitutedPools).toEqual({});
    expect(result.poolOverrides.conversionRates).toHaveLength(0);
    expect(result.poolOverrides.restGains).toEqual({});
    expect(result.grantedMechanics.spells).toHaveLength(0);
    expect(result.grantedMechanics.items).toHaveLength(0);
    expect(result.grantedMechanics.allowedRemovals).toHaveLength(0);
  });

  it('handles a skill with an empty effects array gracefully', () => {
    const result = evaluateSkillEffects([makeSkill(1)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(0);
  });

  it('handles rank 0 (zero scaling)', () => {
    const result = evaluateSkillEffects([makeSkill(0, RAW_DAMAGE_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(0);
    // multiply at rank 0: 1 + (1.0 − 1) × 0 = 1
    expect(result.modifiers.damage.multiply).toBe(1);
  });

  it('uses default dailyTracker of {} when not provided', () => {
    // Should not throw and limited effect should fire
    expect(() =>
      evaluateSkillEffects([makeSkill(1, LIMITED_DAMAGE_EFFECT)], BASE_ATTACK),
    ).not.toThrow();
    const result = evaluateSkillEffects([makeSkill(1, LIMITED_DAMAGE_EFFECT)], BASE_ATTACK);
    expect(result.modifiers.damage.add).toBe(10);
  });

  it('resource_gain during non-rest actions produces no restGains entry', () => {
    const contexts: ActionContext[] = [
      { actionType: 'attack' },
      { actionType: 'inventory_check' },
      { actionType: 'craft' },
      { actionType: 'brew' },
      { actionType: 'skill_check' },
    ];
    for (const ctx of contexts) {
      const result = evaluateSkillEffects([makeSkill(1, POWER_ON_REST_EFFECT)], ctx);
      expect(result.poolOverrides.restGains['power']).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Integration – multi-skill, multi-effect scenarios
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('warrior build: sword mastery + heavy armor + endurance rest', () => {
    const warriorSkills = [
      makeSkill(3, SWORD_DAMAGE_EFFECT, HEAVY_ARMOR_DEFENSE_EFFECT), // rank 3
      makeSkill(2, CARRY_EFFECT, POWER_ON_REST_EFFECT),              // rank 2
    ];

    // --- During a sword attack in heavy armor ---
    const attackCtx: ActionContext = {
      actionType: 'attack',
      weaponType: 'sword',
      armorType: 'heavy',
      isCombat: true,
    };
    const atk = evaluateSkillEffects(warriorSkills, attackCtx);
    expect(atk.modifiers.damage.add).toBe(15);          // 5 × 3
    expect(atk.modifiers.damage.multiply).toBeCloseTo(1.6); // 1 + 0.2 × 3
    expect(atk.modifiers.defense.add).toBe(12);         // 4 × 3
    expect(atk.modifiers.carryCapacity.add).toBe(20);   // 10 × 2

    // --- During rest ---
    const rest = evaluateSkillEffects(warriorSkills, BASE_REST);
    expect(rest.poolOverrides.restGains['power']).toBe(8); // 4 × 2
    // damage should NOT appear during rest (sword condition: weaponType = 'sword' not set)
    expect(rest.modifiers.damage.add).toBe(0);
  });

  it('mage build: essence→will conversion + fireball + poison cure', () => {
    const mageSkills = [
      makeSkill(1, WILL_FOR_ESSENCE_EFFECT, FIREBALL_GRANT),
      makeSkill(2, POISON_REMOVAL_EFFECT),
    ];

    const poisonCtx: ActionContext = {
      actionType: 'skill_check',
      conditionToRemove: 'poison',
    };
    const result = evaluateSkillEffects(mageSkills, poisonCtx);
    expect(result.poolOverrides.substitutedPools['essence']).toBe('will');
    expect(result.grantedMechanics.spells).toContain('fireball');
    expect(result.grantedMechanics.allowedRemovals[0].remainingUses).toBe(2);
  });

  it('rogue build: all-weight reduction + non-combat scout bonus', () => {
    const rogueSkills = [
      makeSkill(2, ALL_WEIGHT_EFFECT, ARMOR_WEIGHT_EFFECT),
      makeSkill(1, NON_COMBAT_DAMAGE),
    ];

    const scoutCtx: ActionContext = { actionType: 'skill_check', isCombat: false };
    const result = evaluateSkillEffects(rogueSkills, scoutCtx);
    expect(result.modifiers.weightReduction['all']).toBe(4);   // 2 × 2
    expect(result.modifiers.weightReduction['armor']).toBe(10); // 5 × 2
    expect(result.modifiers.damage.add).toBe(3);               // non-combat fires
  });

  it('rogue in combat: scout bonus does NOT fire', () => {
    const rogueSkills = [makeSkill(1, NON_COMBAT_DAMAGE)];
    const combatCtx: ActionContext = { actionType: 'attack', isCombat: true };
    const result = evaluateSkillEffects(rogueSkills, combatCtx);
    expect(result.modifiers.damage.add).toBe(0);
  });

  it('daily limit partially consumed across two evaluations', () => {
    const limitedSkill = [makeSkill(1, LIMITED_DAMAGE_EFFECT)];

    // First evaluation: limit not hit
    const first = evaluateSkillEffects(limitedSkill, BASE_ATTACK, {});
    expect(first.modifiers.damage.add).toBe(10);

    // Simulate game layer recording use, then second evaluation
    const tracker = { 's0_e0': 1 };
    const second = evaluateSkillEffects(limitedSkill, BASE_ATTACK, tracker);
    expect(second.modifiers.damage.add).toBe(0);
  });
});