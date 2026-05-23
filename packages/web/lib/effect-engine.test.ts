/**
 * effect-engine.test.ts
 *
 * Exhaustive unit tests for evaluateEffects().
 * Run with: npx vitest
 */

import { describe, it, expect } from 'vitest';
import { evaluateEffects, evaluateEffect } from './effect-engine';
import type { Effect } from './effect-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(rank: number, ...effects: Effect[]) {
  return { current_rank: rank, effects };
}

// ---------------------------------------------------------------------------
// Fixture catalogue
// ---------------------------------------------------------------------------

const MIGHT_ADD: Effect = {
  effect_id: 'might_add_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    { type: 'stat_modifier', target: 'might', math: 'add', Value: 3, per_rank_add: 3, per_rank_multiply: null },
  ],
};

const SORCERY_MULTIPLY: Effect = {
  effect_id: 'sorcery_mult_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    { type: 'stat_modifier', target: 'sorcery', math: 'multiply', Value: 1.1, per_rank_add: null, per_rank_multiply: 0.1 },
  ],
};

const CARRY_WEIGHT_BONUS: Effect = {
  effect_id: 'carry_bonus_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    { type: 'stat_modifier', target: 'carry_weight', math: 'add', Value: 10, per_rank_add: 5, per_rank_multiply: null },
  ],
};

const SWORD_NEGATE: Effect = {
  effect_id: 'sword_negate_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    {
      type: 'weight_negation',
      target: 'item_sub-type',
      math: 'add',
      Value: 1,
      per_rank_add: null,
      per_rank_multiply: null,
      target_value: 'sword',
    },
  ],
};

const BOW_NEGATE: Effect = {
  effect_id: 'bow_negate_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    {
      type: 'weight_negation',
      target: 'item_sub-type',
      math: 'add',
      Value: 1,
      per_rank_add: null,
      per_rank_multiply: null,
      target_value: 'bow',
    },
  ],
};

const FIREBALL_GRANT: Effect = {
  effect_id: 'fireball_01',
  trait: 'one_time',
  trigger: 'activated',
  cost: null,
  display: null,
  actions: [
    { type: 'grant_spell', target: 'fireball', math: 'add', Value: 1, per_rank_add: null, per_rank_multiply: null },
  ],
};

const ICE_LANCE_GRANT: Effect = {
  effect_id: 'ice_lance_01',
  trait: 'one_time',
  trigger: 'activated',
  cost: null,
  display: null,
  actions: [
    { type: 'grant_spell', target: 'ice_lance', math: 'add', Value: 1, per_rank_add: null, per_rank_multiply: null },
  ],
};

const ANTIDOTE_GRANT: Effect = {
  effect_id: 'antidote_01',
  trait: 'one_time',
  trigger: 'activated',
  cost: null,
  display: null,
  actions: [
    { type: 'grant_item', target: 'antidote', math: 'add', Value: 1, per_rank_add: null, per_rank_multiply: null },
  ],
};

const HEALTH_REST: Effect = {
  effect_id: 'health_rest_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    { type: 'rest_modifier', target: 'health', math: 'add', Value: 4, per_rank_add: 2, per_rank_multiply: null },
  ],
};

const POWER_REST: Effect = {
  effect_id: 'power_rest_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    { type: 'rest_modifier', target: 'power', math: 'add', Value: 3, per_rank_add: 3, per_rank_multiply: null },
  ],
};

const HEALTH_REST_MULTIPLY: Effect = {
  effect_id: 'health_rest_mult_01',
  trait: 'skeng',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [
    { type: 'rest_modifier', target: 'health', math: 'multiply', Value: 1.5, per_rank_add: null, per_rank_multiply: 0.25 },
  ],
};

const BEAST_TRACKING: Effect = {
  effect_id: 'beast_track_01',
  trait: 'partial_narrative',
  trigger: 'activated',
  cost: { pool: 'will', value: 1 },
  display: {
    prompt_text: 'Are you tracking a magical creature?',
    reminder_text: 'Grants bonus to perception when tracking magical creatures.',
  },
  actions: [
    { type: 'stat_modifier', target: 'perception', math: 'add', Value: 2, per_rank_add: 1, per_rank_multiply: null },
  ],
};

const PASSIVE_AURA: Effect = {
  effect_id: 'passive_aura_01',
  trait: 'passive',
  trigger: 'passive',
  cost: null,
  display: { prompt_text: '', reminder_text: 'Exudes an aura of menace.' },
  actions: [],
};

const PURE_NARRATIVE_BUFF: Effect = {
  effect_id: 'narrative_buff_01',
  trait: 'pure_narrative',
  trigger: 'activated',
  cost: { pool: 'essence', value: 2 },
  display: { prompt_text: '', reminder_text: 'Inspires allies with a battle cry.' },
  actions: [],
};

const NONE_EFFECT: Effect = {
  effect_id: 'none_01',
  trait: 'none',
  trigger: 'passive',
  cost: null,
  display: null,
  actions: [],
};

// ---------------------------------------------------------------------------
// 1. stat_modifier – add
// ---------------------------------------------------------------------------

describe('stat_modifier – add', () => {
  it('applies base Value at rank 1', () => {
    const result = evaluateEffects([makeSkill(1, MIGHT_ADD)]);
    expect(result.statModifiers['might'].add).toBe(3);
    expect(result.statModifiers['might'].multiply).toBe(1);
  });

  it('scales with per_rank_add at rank 3', () => {
    const result = evaluateEffects([makeSkill(3, MIGHT_ADD)]);
    expect(result.statModifiers['might'].add).toBe(9); // 3 + 3*(3-1)
  });

  it('applies no per_rank_add bonus at rank 1 (rank-1 = 0)', () => {
    const result = evaluateEffects([makeSkill(1, MIGHT_ADD)]);
    expect(result.statModifiers['might'].add).toBe(3);
  });

  it('stacks additively from two independent skills', () => {
    const result = evaluateEffects([makeSkill(1, MIGHT_ADD), makeSkill(2, MIGHT_ADD)]);
    expect(result.statModifiers['might'].add).toBe(3 + 6); // rank1: 3, rank2: 3+3=6
  });

  it('handles rank 0 (negative delta yields Value - per_rank_add)', () => {
    const result = evaluateEffects([makeSkill(0, MIGHT_ADD)]);
    expect(result.statModifiers['might'].add).toBe(0); // 3 + 3*(0-1) = 0
  });
});

// ---------------------------------------------------------------------------
// 2. stat_modifier – multiply
// ---------------------------------------------------------------------------

describe('stat_modifier – multiply', () => {
  it('applies base Value as multiplier at rank 1', () => {
    const result = evaluateEffects([makeSkill(1, SORCERY_MULTIPLY)]);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.1);
    expect(result.statModifiers['sorcery'].add).toBe(0);
  });

  it('scales with per_rank_multiply at rank 2', () => {
    const result = evaluateEffects([makeSkill(2, SORCERY_MULTIPLY)]);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.2); // 1.1 + 0.1*(2-1)
  });

  it('scales with per_rank_multiply at rank 3', () => {
    const result = evaluateEffects([makeSkill(3, SORCERY_MULTIPLY)]);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.3); // 1.1 + 0.1*(3-1)
  });

  it('stacks multiplicatively from two skills', () => {
    const result = evaluateEffects([makeSkill(1, SORCERY_MULTIPLY), makeSkill(1, SORCERY_MULTIPLY)]);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.1 * 1.1);
  });
});

// ---------------------------------------------------------------------------
// 3. carry_weight
// ---------------------------------------------------------------------------

describe('carry_weight stat_modifier', () => {
  it('adds bonus at rank 1', () => {
    const result = evaluateEffects([makeSkill(1, CARRY_WEIGHT_BONUS)]);
    expect(result.statModifiers['carry_weight'].add).toBe(10);
  });

  it('scales with rank', () => {
    const result = evaluateEffects([makeSkill(3, CARRY_WEIGHT_BONUS)]);
    expect(result.statModifiers['carry_weight'].add).toBe(20); // 10 + 5*(3-1)
  });

  it('does not affect other sub-abilities', () => {
    const result = evaluateEffects([makeSkill(2, CARRY_WEIGHT_BONUS)]);
    expect(result.statModifiers['might']).toBeUndefined();
    expect(result.statModifiers['sorcery']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. weight_negation
// ---------------------------------------------------------------------------

describe('weight_negation', () => {
  it('adds item sub-type to weightNegations', () => {
    const result = evaluateEffects([makeSkill(1, SWORD_NEGATE)]);
    expect(result.weightNegations).toContain('sword');
  });

  it('does not duplicate the same sub-type', () => {
    const result = evaluateEffects([makeSkill(1, SWORD_NEGATE), makeSkill(2, SWORD_NEGATE)]);
    expect(result.weightNegations.filter(w => w === 'sword')).toHaveLength(1);
  });

  it('tracks different sub-types independently', () => {
    const result = evaluateEffects([makeSkill(1, SWORD_NEGATE), makeSkill(1, BOW_NEGATE)]);
    expect(result.weightNegations).toContain('sword');
    expect(result.weightNegations).toContain('bow');
  });

  it('rank has no effect on weight negation', () => {
    const r1 = evaluateEffects([makeSkill(1, SWORD_NEGATE)]);
    const r5 = evaluateEffects([makeSkill(5, SWORD_NEGATE)]);
    expect(r1.weightNegations).toEqual(r5.weightNegations);
  });
});

// ---------------------------------------------------------------------------
// 5. Grants (one_time)
// ---------------------------------------------------------------------------

describe('grants', () => {
  it('grants a spell', () => {
    const result = evaluateEffects([makeSkill(1, FIREBALL_GRANT)]);
    expect(result.grantedSpells).toContain('fireball');
  });

  it('grants an item', () => {
    const result = evaluateEffects([makeSkill(1, ANTIDOTE_GRANT)]);
    expect(result.grantedItems).toContain('antidote');
  });

  it('accumulates grants from multiple skills', () => {
    const result = evaluateEffects([makeSkill(1, FIREBALL_GRANT), makeSkill(1, ICE_LANCE_GRANT)]);
    expect(result.grantedSpells).toContain('fireball');
    expect(result.grantedSpells).toContain('ice_lance');
  });

  it('rank does not affect grant (still granted once)', () => {
    const result = evaluateEffects([makeSkill(5, FIREBALL_GRANT)]);
    expect(result.grantedSpells.filter(s => s === 'fireball')).toHaveLength(1);
  });

  it('spell grants go into grantedSpells, not grantedItems', () => {
    const result = evaluateEffects([makeSkill(1, FIREBALL_GRANT)]);
    expect(result.grantedItems).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. partial_narrative
// ---------------------------------------------------------------------------

describe('partial_narrative', () => {
  it('does NOT apply actions to statModifiers', () => {
    const result = evaluateEffects([makeSkill(1, BEAST_TRACKING)]);
    expect(result.statModifiers['perception']).toBeUndefined();
  });

  it('pushes a prompt into prompts array', () => {
    const result = evaluateEffects([makeSkill(1, BEAST_TRACKING)]);
    expect(result.prompts).toHaveLength(1);
  });

  it('prompt contains effect_id and prompt_text', () => {
    const result = evaluateEffects([makeSkill(1, BEAST_TRACKING)]);
    const prompt = result.prompts[0];
    expect(prompt.effect_id).toBe('beast_track_01');
    expect(prompt.prompt_text).toBe('Are you tracking a magical creature?');
  });

  it('prompt includes cost', () => {
    const result = evaluateEffects([makeSkill(1, BEAST_TRACKING)]);
    expect(result.prompts[0].cost?.pool).toBe('will');
    expect(result.prompts[0].cost?.value).toBe(1);
  });

  it('conditional modifiers scale by rank', () => {
    const result = evaluateEffects([makeSkill(3, BEAST_TRACKING)]);
    const mod = result.prompts[0].conditionalModifiers.find(m => m.target === 'perception');
    expect(mod?.add).toBe(4); // 2 + 1*(3-1)
  });

  it('conditional modifiers at rank 1 match base Value', () => {
    const result = evaluateEffects([makeSkill(1, BEAST_TRACKING)]);
    const mod = result.prompts[0].conditionalModifiers.find(m => m.target === 'perception');
    expect(mod?.add).toBe(2);
  });

  it('skips prompt when display is null', () => {
    const noDisplay: Effect = { ...BEAST_TRACKING, display: null };
    const result = evaluateEffects([makeSkill(1, noDisplay)]);
    expect(result.prompts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. passive
// ---------------------------------------------------------------------------

describe('passive', () => {
  it('adds reminder_text to passives array', () => {
    const result = evaluateEffects([makeSkill(1, PASSIVE_AURA)]);
    expect(result.passives).toHaveLength(1);
    expect(result.passives[0].reminder_text).toBe('Exudes an aura of menace.');
  });

  it('records effect_id', () => {
    const result = evaluateEffects([makeSkill(1, PASSIVE_AURA)]);
    expect(result.passives[0].effect_id).toBe('passive_aura_01');
  });

  it('does not apply any stat modifiers', () => {
    const result = evaluateEffects([makeSkill(1, PASSIVE_AURA)]);
    expect(Object.keys(result.statModifiers)).toHaveLength(0);
  });

  it('skips passive with no display', () => {
    const noDisplay: Effect = { ...PASSIVE_AURA, display: null };
    const result = evaluateEffects([makeSkill(1, noDisplay)]);
    expect(result.passives).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. pure_narrative and none
// ---------------------------------------------------------------------------

describe('pure_narrative and none', () => {
  it('pure_narrative produces no stat modifiers, grants, or prompts', () => {
    const result = evaluateEffects([makeSkill(1, PURE_NARRATIVE_BUFF)]);
    expect(Object.keys(result.statModifiers)).toHaveLength(0);
    expect(result.grantedSpells).toHaveLength(0);
    expect(result.grantedItems).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
  });

  it('none trait produces no output', () => {
    const result = evaluateEffects([makeSkill(1, NONE_EFFECT)]);
    expect(Object.keys(result.statModifiers)).toHaveLength(0);
    expect(result.passives).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. rest_modifier
// ---------------------------------------------------------------------------

describe('rest_modifier', () => {
  it('adds flat bonus to health at rank 1', () => {
    const result = evaluateEffects([makeSkill(1, HEALTH_REST)]);
    expect(result.restModifiers['health'].add).toBe(4);
    expect(result.restModifiers['health'].multiply).toBe(1);
  });

  it('scales with per_rank_add at rank 3', () => {
    const result = evaluateEffects([makeSkill(3, HEALTH_REST)]);
    expect(result.restModifiers['health'].add).toBe(8); // 4 + 2*(3-1)
  });

  it('applies multiply at rank 1', () => {
    const result = evaluateEffects([makeSkill(1, HEALTH_REST_MULTIPLY)]);
    expect(result.restModifiers['health'].multiply).toBeCloseTo(1.5);
    expect(result.restModifiers['health'].add).toBe(0);
  });

  it('scales multiply with per_rank_multiply at rank 3', () => {
    const result = evaluateEffects([makeSkill(3, HEALTH_REST_MULTIPLY)]);
    expect(result.restModifiers['health'].multiply).toBeCloseTo(2.0); // 1.5 + 0.25*(3-1)
  });

  it('stacks add bonuses from two skills targeting the same pool', () => {
    const result = evaluateEffects([makeSkill(1, HEALTH_REST), makeSkill(2, HEALTH_REST)]);
    expect(result.restModifiers['health'].add).toBe(4 + 6); // rank1: 4, rank2: 4+2=6
  });

  it('stacks multipliers from two skills multiplicatively', () => {
    const result = evaluateEffects([makeSkill(1, HEALTH_REST_MULTIPLY), makeSkill(1, HEALTH_REST_MULTIPLY)]);
    expect(result.restModifiers['health'].multiply).toBeCloseTo(1.5 * 1.5);
  });

  it('tracks different pools independently', () => {
    const result = evaluateEffects([makeSkill(1, HEALTH_REST), makeSkill(1, POWER_REST)]);
    expect(result.restModifiers['health'].add).toBe(4);
    expect(result.restModifiers['power'].add).toBe(3);
    expect(result.restModifiers['will']).toBeUndefined();
  });

  it('does not pollute statModifiers', () => {
    const result = evaluateEffects([makeSkill(2, HEALTH_REST)]);
    expect(result.statModifiers['health']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 10. Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns empty result for no skills', () => {
    const result = evaluateEffects([]);
    expect(result.statModifiers).toEqual({});
    expect(result.weightNegations).toHaveLength(0);
    expect(result.restModifiers).toEqual({});
    expect(result.grantedSpells).toHaveLength(0);
    expect(result.grantedItems).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
    expect(result.passives).toHaveLength(0);
  });

  it('handles a skill with an empty effects array', () => {
    const result = evaluateEffects([makeSkill(1)]);
    expect(result.statModifiers).toEqual({});
  });

  it('accumulates passives from multiple skills', () => {
    const second: Effect = { ...PASSIVE_AURA, effect_id: 'passive_aura_02', display: { prompt_text: '', reminder_text: 'Second aura.' } };
    const result = evaluateEffects([makeSkill(1, PASSIVE_AURA), makeSkill(1, second)]);
    expect(result.passives).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 10. Integration – multi-skill, multi-effect scenarios
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 11. evaluateEffect – single-block evaluation
// ---------------------------------------------------------------------------

const SWORD_NORMAL: Effect = {
  effect_id: 'sword_normal',
  trait: 'skeng',
  trigger: 'activated',
  cost: { pool: 'power', value: 2 },
  display: { prompt_text: '', reminder_text: 'Standard slash.' },
  actions: [
    { type: 'stat_modifier', target: 'might', math: 'add', Value: 2, per_rank_add: null, per_rank_multiply: null },
  ],
};

const SWORD_STRONG: Effect = {
  effect_id: 'sword_strong',
  trait: 'skeng',
  trigger: 'activated',
  cost: { pool: 'power', value: 4 },
  display: { prompt_text: '', reminder_text: 'Cleaving blow.' },
  actions: [
    { type: 'stat_modifier', target: 'might', math: 'add', Value: 5, per_rank_add: null, per_rank_multiply: null },
  ],
};

const ESSENCE_BOLT: Effect = {
  effect_id: 'essence_bolt',
  trait: 'skeng',
  trigger: 'activated',
  cost: { pool: 'essence', value: 3 },
  display: { prompt_text: '', reminder_text: 'Fires a bolt of raw essence.' },
  actions: [
    { type: 'stat_modifier', target: 'sorcery', math: 'add', Value: 5, per_rank_add: null, per_rank_multiply: null },
    { type: 'stat_modifier', target: 'sorcery', math: 'multiply', Value: 1.5, per_rank_add: null, per_rank_multiply: null },
  ],
};

describe('evaluateEffect – single block', () => {
  it('returns correct stat modifier for a normal weapon attack', () => {
    const result = evaluateEffect(SWORD_NORMAL);
    expect(result.statModifiers['might'].add).toBe(2);
    expect(result.statModifiers['might'].multiply).toBe(1);
  });

  it('returns correct stat modifier for a strong weapon attack', () => {
    const result = evaluateEffect(SWORD_STRONG);
    expect(result.statModifiers['might'].add).toBe(5);
  });

  it('normal and strong blocks are independent — strong does not affect normal result', () => {
    const normal = evaluateEffect(SWORD_NORMAL);
    const strong = evaluateEffect(SWORD_STRONG);
    expect(normal.statModifiers['might'].add).toBe(2);
    expect(strong.statModifiers['might'].add).toBe(5);
  });

  it('handles multiple actions in one block', () => {
    const result = evaluateEffect(ESSENCE_BOLT);
    expect(result.statModifiers['sorcery'].add).toBe(5);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.5);
  });

  it('matches evaluateEffects called with a single-element array at rank 1', () => {
    const single = evaluateEffect(MIGHT_ADD, 1);
    const wrapped = evaluateEffects([makeSkill(1, MIGHT_ADD)]);
    expect(single.statModifiers['might']).toEqual(wrapped.statModifiers['might']);
  });

  it('returns empty result for a pure_narrative effect', () => {
    const result = evaluateEffect(PURE_NARRATIVE_BUFF);
    expect(Object.keys(result.statModifiers)).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
    expect(result.passives).toHaveLength(0);
  });

  it('returns prompt for partial_narrative effect', () => {
    const result = evaluateEffect(BEAST_TRACKING);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].effect_id).toBe('beast_track_01');
  });

  it('default rank is 1', () => {
    const withDefault = evaluateEffect(SWORD_NORMAL);
    const withExplicit = evaluateEffect(SWORD_NORMAL, 1);
    expect(withDefault).toEqual(withExplicit);
  });
});

// ---------------------------------------------------------------------------
// 12. Item and spell effect patterns
// ---------------------------------------------------------------------------

describe('item normal/strong pattern', () => {
  it('cost on normal block is distinct from cost on strong block', () => {
    expect(SWORD_NORMAL.cost?.value).toBe(2);
    expect(SWORD_STRONG.cost?.value).toBe(4);
    expect(SWORD_NORMAL.cost?.pool).toBe(SWORD_STRONG.cost?.pool);
  });

  it('selecting effects[0] and effects[1] by index yields independent results', () => {
    const itemEffects: Effect[] = [SWORD_NORMAL, SWORD_STRONG];
    const normalResult = evaluateEffect(itemEffects[0]);
    const strongResult = evaluateEffect(itemEffects[1]);
    expect(normalResult.statModifiers['might'].add).toBe(2);
    expect(strongResult.statModifiers['might'].add).toBe(5);
  });

  it('empty effects array yields empty result for evaluateEffect guard', () => {
    const itemEffects: Effect[] = [];
    const result = itemEffects[0] ? evaluateEffect(itemEffects[0]) : null;
    expect(result).toBeNull();
  });
});

describe('spell effect pattern', () => {
  it('essence bolt drains essence pool and adds to sorcery', () => {
    const result = evaluateEffect(ESSENCE_BOLT);
    expect(ESSENCE_BOLT.cost?.pool).toBe('essence');
    expect(result.statModifiers['sorcery'].add).toBe(5);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.5);
  });

  it('spell with will cost uses will pool', () => {
    const willSpell: Effect = { ...ESSENCE_BOLT, effect_id: 'will_bolt', cost: { pool: 'will', value: 2 } };
    expect(willSpell.cost?.pool).toBe('will');
    const result = evaluateEffect(willSpell);
    expect(result.statModifiers['sorcery'].add).toBe(5);
  });
});

describe('integration', () => {
  it('warrior build: might bonus + carry weight + sword negation', () => {
    const result = evaluateEffects([
      makeSkill(3, MIGHT_ADD, CARRY_WEIGHT_BONUS),
      makeSkill(2, SWORD_NEGATE),
    ]);
    expect(result.statModifiers['might'].add).toBe(9);          // 3 + 3*2
    expect(result.statModifiers['carry_weight'].add).toBe(20);  // 10 + 5*2
    expect(result.weightNegations).toContain('sword');
  });

  it('mage build: sorcery multiply + fireball grant + beast tracking prompt', () => {
    const result = evaluateEffects([
      makeSkill(2, SORCERY_MULTIPLY, FIREBALL_GRANT),
      makeSkill(1, BEAST_TRACKING),
    ]);
    expect(result.statModifiers['sorcery'].multiply).toBeCloseTo(1.2);
    expect(result.grantedSpells).toContain('fireball');
    expect(result.prompts).toHaveLength(1);
    // partial_narrative does NOT bleed into statModifiers
    expect(result.statModifiers['perception']).toBeUndefined();
  });

  it('mixed build: passive + pure_narrative + skeng all coexist', () => {
    const result = evaluateEffects([
      makeSkill(1, PASSIVE_AURA),
      makeSkill(1, PURE_NARRATIVE_BUFF),
      makeSkill(2, MIGHT_ADD),
    ]);
    expect(result.passives).toHaveLength(1);
    expect(result.statModifiers['might'].add).toBe(6); // 3 + 3*(2-1)
    expect(Object.keys(result.statModifiers)).toHaveLength(1);
  });
});
