<!-- markdownlint-disable-file -->
# Item Effects Reference

> Complete JSON schema for the `effects` JSONB column on `items`, `skills`, `spells`, and `active_skills`.

---

## Overview

The `effects` column is a **JSONB array of `Effect` objects**. The effect engine (`packages/web/lib/effect-engine.ts`) evaluates this array at character-load time and applies the results (stat modifiers, grants, prompts) to the character sheet.

Items always pass `rank = 1` to the evaluator. Skills use the character's `current_rank` for per-rank scaling. Spells currently share the same schema.

For items specifically, the array can hold two effects:
- `effects[0]` — normal attack / activation effect
- `effects[1]` — strong attack / enhanced activation effect *(convention, not enforced)*

Use `'[]'` for items with no mechanical effect beyond their base stats (damage, defence).

---

## Top-Level Effect Object

```jsonc
{
  "effect_id": "unique-slug",       // snake_case; unique within the item's effects array
  "trait": "skeng",                 // see Trait Types below
  "trigger": "passive",             // activated | passive | reactive
  "roll_context": "attack",         // attack | defense | skill_check | any  (optional)
  "cost": null,                     // EffectCost or null — see below
  "display": null,                  // EffectDisplay or null — see below
  "actions": []                     // array of EffectAction — see below
}
```

---

## Trait Types

Trait determines how the engine processes the effect.

| trait | Behavior |
|---|---|
| `skeng` | Always-active. `actions` are applied immediately to the character. |
| `one_time` | Same as `skeng` — applied immediately. Semantic label for single-use mechanical grants. |
| `passive` | Reminder only. No mechanical application. Requires `display.reminder_text`. |
| `partial_narrative` | Shows a prompt to the player before applying. Requires `display`. `actions` contain the conditional modifiers. |
| `pure_narrative` | No mechanical effect. Text flavor only. |
| `none` | Same as `pure_narrative`. Ignored by the engine. |

Most mechanical items use `skeng`. Use `partial_narrative` when the effect is conditional on player choice (e.g. a cloak that grants +2 defence *if* the player declares they're dodging).

---

## Trigger Types

`trigger` is metadata for display and future combat automation — the engine doesn't gate on it yet.

| trigger | Meaning |
|---|---|
| `activated` | Player must explicitly activate (click a button, spend resource) |
| `passive` | Always active while equipped/owned |
| `reactive` | Fires in response to an event (taking damage, hitting a critical) |

---

## EffectCost

```jsonc
{
  "pool": "essence",   // essence | power | will | health
  "value": 2           // amount spent from the pool
}
```

Set `"cost": null` for free effects.

---

## EffectDisplay

Required for `partial_narrative` and `passive` traits.

```jsonc
{
  "prompt_text": "Declare you are using the Shield Rush before rolling defence.",
  "reminder_text": "Shield Rush: +3 defence on declare; costs 1 Power."
}
```

- `prompt_text` — shown before the player rolls; instructs them on declaring the effect
- `reminder_text` — shown on the character sheet as a persistent reminder

---

## EffectAction

Each `Effect.actions` entry is an `EffectAction`:

```jsonc
{
  "type": "stat_modifier",    // ActionType — see below
  "target": "defence",        // attribute or sub-ability name
  "math": "add",              // add | multiply
  "Value": 2,                 // base value
  "per_rank_add": null,       // additional value per rank above 1 (skills only)
  "per_rank_multiply": null,  // multiplier per rank above 1 (skills only)
  "target_value": null        // secondary target for specific action types
}
```

`per_rank_add` and `per_rank_multiply` are only meaningful on skills (items always rank 1). Set both to `null` for item effects.

---

## Action Types

### `stat_modifier`

Adds to or multiplies a character stat.

```jsonc
{
  "type": "stat_modifier",
  "target": "defence",   // stat name — see valid targets below
  "math": "add",         // add | multiply
  "Value": 2,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

Valid `target` values: `"health"`, `"power"`, `"will"`, `"essence"`, `"attack"`, `"defence"`, `"speed"`, `"carry_weight"`, `"damage"` — and any sub-ability the frontend recognizes.

### `weight_negation`

Negates the carry weight of all items of a given subtype.

```jsonc
{
  "type": "weight_negation",
  "target": "weight_negation",
  "math": "add",
  "Value": 1,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": "light"   // item subtype to negate (e.g. "light", "melee")
}
```

Useful for items like "Pack Frame" that reduce effective carry weight for a category.

### `grant_spell`

Adds a spell to the character's spell list.

```jsonc
{
  "type": "grant_spell",
  "target": "1",   // spell ID (integer as string — matches spells.id)
  "math": "add",
  "Value": 1,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

### `grant_item`

Grants another item to the character.

```jsonc
{
  "type": "grant_item",
  "target": "<item-uuid>",
  "math": "add",
  "Value": 1,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

### `grant_active_skill`

Grants an active skill (from `active_skills` table).

```jsonc
{
  "type": "grant_active_skill",
  "target": "<active-skill-uuid>",
  "math": "add",
  "Value": 1,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

### `rest_modifier`

Modifies how much of a pool is restored on rest.

```jsonc
{
  "type": "rest_modifier",
  "target": "health",   // pool to modify
  "math": "add",        // add = flat bonus; multiply = proportional
  "Value": 4,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

### `pool_recharge`

Restores a pool on trigger (e.g. vampiric drain on hit).

```jsonc
{
  "type": "pool_recharge",
  "target": "essence",
  "math": "add",
  "Value": 1,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

### `critical`

Enables a critical hit check on a given roll context.

```jsonc
{
  "type": "critical",
  "target": "attack",   // roll_context: attack | defense | skill_check | any
  "math": "add",
  "Value": 10,          // die_size (roll must equal this to trigger)
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

A `Value` of 10 means a roll of 10 on a d10 triggers a critical.

### `near_critical`

Rolls exactly 1 below the die maximum count as the maximum.

```jsonc
{
  "type": "near_critical",
  "target": "attack",
  "math": "add",
  "Value": 10,
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": null
}
```

### `discount`

Reduces the cost or weight of items matching `type`/`subtype`.

```jsonc
{
  "type": "discount",
  "target": "weapon",       // item type
  "math": "add",
  "Value": 2,               // amount of discount
  "per_rank_add": null,
  "per_rank_multiply": null,
  "target_value": "melee"   // item subtype; "all" to match any subtype
}
```

---

## Complete Examples

### Passive stat-boosting item (Ring of Fortitude)
Adds 4 health while equipped.

```json
[
  {
    "effect_id": "ring_of_fortitude_passive",
    "trait": "skeng",
    "trigger": "passive",
    "roll_context": null,
    "cost": null,
    "display": {
      "prompt_text": "",
      "reminder_text": "Ring of Fortitude: +4 max health while equipped."
    },
    "actions": [
      {
        "type": "stat_modifier",
        "target": "health",
        "math": "add",
        "Value": 4,
        "per_rank_add": null,
        "per_rank_multiply": null,
        "target_value": null
      }
    ]
  }
]
```

### Activated consumable (Health Potion)
Spend 0 resources; restores health on use. (The flat restoration is handled by the `modifier` column on the item row, not the effect engine — `effects` handles persistent passives, not one-shot triggered heals.)

```json
[]
```

For a consumable, the `modifier` column on the item row carries the restoration value. The `cost` and `cost_attribute_name` columns handle the activation cost. Effects are for *persistent* mechanical modifications.

### Weapon with critical threat (Keen Edge Sword)
Normal attack + critical on 9 or 10.

```json
[
  {
    "effect_id": "keen_normal_attack",
    "trait": "skeng",
    "trigger": "activated",
    "roll_context": "attack",
    "cost": { "pool": "power", "value": 1 },
    "display": null,
    "actions": [
      {
        "type": "critical",
        "target": "attack",
        "math": "add",
        "Value": 9,
        "per_rank_add": null,
        "per_rank_multiply": null,
        "target_value": null
      }
    ]
  }
]
```

### Spellbook (grants a spell)

```json
[
  {
    "effect_id": "old_grimoire_spell_grant",
    "trait": "one_time",
    "trigger": "passive",
    "roll_context": null,
    "cost": null,
    "display": {
      "prompt_text": "",
      "reminder_text": "The grimoire contains the Ember Bolt incantation."
    },
    "actions": [
      {
        "type": "grant_spell",
        "target": "1",
        "math": "add",
        "Value": 1,
        "per_rank_add": null,
        "per_rank_multiply": null,
        "target_value": null
      }
    ]
  }
]
```

---

## Notes for items vs skills

- Items: always `rank = 1`. `per_rank_add` and `per_rank_multiply` have no effect — leave them `null`.
- Skills: `rank` comes from `character_skills.current_rank`. Scale per-rank fields accordingly.
- The `effects[0]` / `effects[1]` normal/strong convention is established by the UI layer, not the engine. The engine evaluates *all* effects in the array.
