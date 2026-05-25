# Effects Engine Reference

> **Purpose:** This document exists for developers adding or refactoring effects. It maps every layer an effect touches — from DB to UI — so you know exactly which files to change and in what order.

---

## Architecture Overview

Effects travel through five distinct layers. Changing an effect type means touching each one.

```
DB JSONB column (spells/items/skills/active_skills)
    ↓ parseEffects()          → packages/web/lib/schemas/skill-effect.ts
    ↓ withEffects<T>()        → each *-service.ts
    ↓ getFullCharacter()      → packages/web/lib/services/character-service.ts
    ↓ evaluateEffect(s)()     → packages/web/lib/effect-engine.ts
    ↓ UI rendering            → components listed below
```

---

## Core Type Definitions

**File:** [packages/web/lib/effect-engine.ts](packages/web/lib/effect-engine.ts)

```typescript
type ResourcePool = 'essence' | 'power' | 'will' | 'health'

type EffectTrait =
  | 'none'               // disabled/placeholder
  | 'pure_narrative'     // flavor only, no mechanics
  | 'partial_narrative'  // GM/player approval required; optional bonus
  | 'passive'            // always-on reminder text, no stat change
  | 'skeng'              // automatically applied mechanical bonus
  | 'one_time'           // one-time grant (spell/item/skill)

type EffectTrigger = 'activated' | 'passive' | 'reactive'

type EffectRollContext = 'attack' | 'defense' | 'skill_check' | 'any'

type ActionType =
  | 'stat_modifier'       // modify ability or stat value
  | 'weight_negation'     // zero out weight for an item subtype
  | 'grant_spell'         // unlock a spell for the character
  | 'grant_item'          // grant an item to the character
  | 'grant_active_skill'  // unlock an active skill
  | 'rest_modifier'       // modify resource pool recovery on rest
  | 'pool_recharge'       // in-combat pool recovery (e.g. vampiric drain)
  | 'critical'            // mark a roll context as crit-capable at a given die size
  | 'near_critical'      // promote rolls that are exactly 1 below max to the maximum
  | 'discount'            // reduce cost/weight for a category of spells, attacks, or defenses

type MathOp = 'add' | 'multiply'
```

### Effect Shape

```typescript
interface Effect {
  effect_id: string
  trait: EffectTrait
  trigger: EffectTrigger
  roll_context?: EffectRollContext  // omit or set to 'any' for always-visible
  cost: EffectCost | null
  display: EffectDisplay | null
  actions: EffectAction[]
}

interface EffectCost {
  pool: ResourcePool
  value: number
}

interface EffectDisplay {
  prompt_text: string    // shown to player for partial_narrative
  reminder_text: string  // shown as passive reminder
}

interface EffectAction {
  type: ActionType
  target: string                   // stat name, pool name, or entity ID
  math: MathOp
  Value: number                    // base value at rank 1
  per_rank_add: number | null      // linear add per rank above 1
  per_rank_multiply: number | null // linear multiply per rank above 1
  target_value?: string | null     // item subtype for weight_negation
}
```

---

## Trait Behaviors

What the engine does with an effect depends entirely on its `trait`. This is the gate before any `actions` are processed.

| Trait | Actions Processed? | Output |
|---|---|---|
| `skeng` | Yes | `statModifiers`, `restModifiers`, `poolRecharges`, `criticalChecks`, `nearCriticalChecks`, `discounts` |
| `one_time` | Yes (grants only) | `grantedSpells`, `grantedItems`, `grantedActiveSkills` |
| `partial_narrative` | Deferred to prompts | `prompts[]` — GM/player decides |
| `passive` | No | `passives[]` — reminder text only |
| `pure_narrative` | No | nothing |
| `none` | No | nothing |

**Key rule:** Only `skeng` produces direct stat changes. Everything else is either deferred, granted once, or purely informational.

---

## Action Types

### `stat_modifier`

Modifies a character ability or derived stat.

- **target:** `might` | `sorcery` | `perception` | `agility` | `acumen` | `attunement` | `eloquence` | `fortitude` | `intimidation` | `carry_weight`
- **math:** `add` → stacks additively. `multiply` → stacks multiplicatively.
- **scaling formula:**
  - add: `Value + per_rank_add * (rank - 1)`
  - multiply: `Value + per_rank_multiply * (rank - 1)`
- **output key:** `statModifiers[target] = { add: number, multiply: number }`

### `rest_modifier`

Modifies how much of a resource pool is recovered on rest. Same math as `stat_modifier` but outputs to `restModifiers` — never pollutes `statModifiers`.

- **target:** `essence` | `power` | `will` | `health`
- **output key:** `restModifiers[pool] = { add: number, multiply: number }`

### `weight_negation`

Sets the effective weight of all items of a given subtype to 0 for this character.

- **target:** hardcoded `"item_sub-type"` (ignored in practice)
- **target_value:** the item subtype string (e.g. `"sword"`, `"bow"`)
- **rank-independent:** granted once regardless of rank
- **output:** `weightNegations: string[]` (deduplicated)

### `grant_spell` / `grant_item` / `grant_active_skill`

Grants the character access to an entity.

- **target:** the entity's ID string
- **rank-independent:** granted once regardless of rank
- **output:** `grantedSpells[]`, `grantedItems[]`, `grantedActiveSkills[]` (deduplicated)
- **used with:** `one_time` trait

### `pool_recharge`

In-combat pool recovery triggered by an action (e.g. vampiric drain — deal damage, gain health back).

- **target:** `essence` | `power` | `will` | `health`
- **math:** `add` → stacks additively. `multiply` → stacks multiplicatively.
- **scaling:** same formula as `stat_modifier` / `rest_modifier`
- **output key:** `poolRecharges[pool] = { add: number, multiply: number }`
- **note:** The engine records the recharge amount. Applying it to the character's current pool is the responsibility of the GM tool or combat layer.

### `critical`

Marks a roll context as crit-capable at a given die size. A roll is a critical if it equals `Value` (e.g. `Value=6` on a d6, `Value=10` on a d10). No extra modifier is applied — the standard result stands.

- **target:** `attack` | `defense` | `skill_check`
- **Value:** the die's maximum face (die size)
- **math / per_rank:** unused — die size is fixed
- **output key:** `criticalChecks[]` — one entry per (target, die_size) pair
- **note:** Duplicate entries (same target/die_size from multiple effects) are kept; the consumer deduplicates or takes the max as appropriate.

### `near_critical`

Promotes a die roll that is exactly 1 below the maximum to the maximum, making it a critical. The promotion happens at roll time, before the modifier and coefficient are applied — all subsequent math runs on the promoted value unchanged.

- **target:** `attack` | `defense` | `skill_check`
- **Value:** the die's maximum face (must match the weapon/item die size — e.g. `6` for a d6, `10` for a d10)
- **math / per_rank:** unused — the promotion threshold is always exactly 1 below max
- **output key:** `nearCriticalChecks[]` — one entry per (target, die_size) pair
- **applies to:** attack rolls only (defense is a flat value with no die, so the check is a no-op for defense targets)
- **multi-die behavior:** the maximum is `die_count × die_size`; the threshold is `die_count × die_size − 1`
- **example:** a character with near_critical (attack, d10) who rolls a 9 on their d10 weapon has the roll promoted to 10 before the modifier and coefficient are applied
- **note:** this effect must use the `skeng` trait to fire automatically on every roll. `Value` must exactly match the weapon's die size or the check silently has no effect.

### `discount`

Reduces the cost or weight for a category of spells, attacks, or defenses. Applied by the consumer only when the character actually has matching properties — the engine never throws on missing properties.

- **target:** `spell` | `attack` | `defense`
- **target_value:** the subtype string (e.g. `"fire"`, `"sword"`, `"heavy"`, or `"all"` to cover everything in the category)
- **Value:** integer discount amount (positive = reduction)
- **math / per_rank:** unused for basic discount; `per_rank_add` can be used for scaling discounts if desired
- **output key:** `discounts[]` — each entry is `{ type, subtype, amount }`
- **note:** `"all"` in `subtype` means the discount applies to every spell of that trigger type, every attack, or every defense — the consumer must handle the `"all"` case.

---

## Roll-Context Filtering (Reminders That Fire on Roll)

`Effect.roll_context` controls **when** a `partial_narrative` prompt surfaces to the player. The engine always collects every `partial_narrative` effect into `skillFx.prompts[]` — but the dashboard gates display to the moment of an actual roll.

### How it works

In **[character-dashboard.tsx](packages/web/features/characters/components/character-dashboard.tsx)**, the `handleAction()` function (called when the player fires an Attack or Defend roll) does:

```typescript
const rollCtx = actionType === "Attack" ? "attack" : actionType === "Defend" ? "defense" : null
setActivePrompts(
  rollCtx
    ? skillFx.prompts.filter((p) => p.roll_context === rollCtx || p.roll_context === "any")
    : []
)
```

`activePrompts` then renders as cyan "Active Effect" banners directly below the roll result — only for that roll type. Before any roll (or after Cast), no prompts are shown.

### roll_context values and when they fire

| `roll_context` | Fires when |
|---|---|
| `'attack'` | Player fires an Attack roll |
| `'defense'` | Player fires a Defend roll |
| `'skill_check'` | **Reserved** — SkillCheckPanel does not currently call back to surface prompts; this context is defined but inactive |
| `'any'` | Every Attack or Defend roll |

### The `passive` trait is NOT the roll-triggered path

The `passive` trait's `reminder_text` goes into `skillFx.passives[]` — a separate output array. **`passives[]` does not carry `roll_context`** (the engine strips it) and is not rendered anywhere in the character dashboard. It exists as an output for future consumers (e.g. a persistent sidebar or GM view).

**Rule:** If you want a reminder that only appears when a player makes a specific roll, use **`partial_narrative`** with the desired `roll_context`, not `passive`.

```text
partial_narrative + roll_context: 'attack'   → shows only on Attack rolls
partial_narrative + roll_context: 'any'      → shows on all Attack/Defend rolls
passive                                       → collected in passives[], not shown at roll time
```

---

## Evaluation Engine

**File:** [packages/web/lib/effect-engine.ts](packages/web/lib/effect-engine.ts)

### `evaluateEffect(effect, rank = 1): EffectCalculationResult`

Evaluates a **single** effect block. Use for items and spells (no rank progression → always pass `rank=1`).

### `evaluateEffects(skills): EffectCalculationResult`

Evaluates **all active skills** for a character and aggregates results.

```typescript
evaluateEffects(activeSkills: Array<{ current_rank: number; effects: Effect[] }>)
```

### Output Shape

```typescript
interface EffectCalculationResult {
  statModifiers: Record<string, { add: number; multiply: number }>
  weightNegations: string[]
  restModifiers: Record<string, { add: number; multiply: number }>
  poolRecharges: Record<string, { add: number; multiply: number }>
  criticalChecks: Array<{ target: string; die_size: number }>
  nearCriticalChecks: Array<{ target: string; die_size: number }>
  discounts: Array<{ type: string; subtype: string; amount: number }>
  grantedSpells: string[]
  grantedItems: string[]
  grantedActiveSkills: string[]
  prompts: Array<{
    effect_id: string
    prompt_text: string
    reminder_text: string | null
    cost: EffectCost | null
    conditionalModifiers: ConditionalModifier[]
    roll_context: EffectRollContext  // inherited from the effect; default 'any'
  }>
  passives: Array<{ effect_id: string; reminder_text: string }>
}
```

---

## Validation / Parsing

**File:** [packages/web/lib/schemas/skill-effect.ts](packages/web/lib/schemas/skill-effect.ts)

- Zod schema: `EffectsSchema = z.array(EffectSchema)`
- `parseEffects(data: unknown): Effect[]` — returns `[]` on failure (never throws)
- **Called by:** every service that fetches effect-bearing entities

---

## Database Storage

Effects are stored as `JSONB` columns with a default of `'[]'::jsonb`.

| Table | Column | Migration |
|---|---|---|
| `spells` | `effects: Json` | `20260522250000_add_effects_to_spells_items.sql` |
| `items` | `effects: Json` | `20260522250000_add_effects_to_spells_items.sql` |
| `skills` | `effects: Json \| null` | earlier migration |
| `active_skills` | `effects: Json` | `20260523000000_add_active_skills.sql` |
| `action_skills` | `effect: Json \| null` | `20260522150053_remote_schema.sql` (singular, legacy) |

> **Note:** `action_skills.effect` (singular) is a legacy field with a different shape. Don't confuse it with the `effects[]` array on the other tables.

---

## Service Layer

All services follow the same pattern:

```typescript
// Generic wrapper that applies parseEffects to the DB row
function withEffects<T>(row: T & { effects: Json }): T & { effects: Effect[] }
```

| File | Function | Returns |
|---|---|---|
| [spell-service.ts](packages/web/lib/services/spell-service.ts) | `getAllSpells()`, `getSpellById()` | `SpellWithEffects[]` |
| [item-service.ts](packages/web/lib/services/item-service.ts) | `getAllItems()`, `getItemById()`, `getCatalogItems()` | `ItemWithEffects[]` |
| [skill-service.ts](packages/web/lib/services/skill-service.ts) | `fetchSkillTree()` | `{ skills: Skill[], edges: SkillEdge[] }` |
| [active-skill-service.ts](packages/web/lib/services/active-skill-service.ts) | `getAllActiveSkills()`, `getCharacterActiveSkills()` | `ActiveSkill[]` |
| [character-service.ts](packages/web/lib/services/character-service.ts) | `getFullCharacter()` | Aggregated character with all parsed effects |

`character-service.ts` is the orchestrator — it calls all the above and assembles the full character object that the dashboard uses.

---

## UI Components

### Effect Editor (shared across all entity types)

**[packages/web/components/effect-editor-modal.tsx](packages/web/components/effect-editor-modal.tsx)**

Full CRUD editor. Shared by spells, skills, items, and active skills. Handles:
- Trait/trigger/cost selection
- Display text (prompt_text / reminder_text)
- Dynamic action builder — each `ActionType` gets its own target input
- `effectToEditing()` / `editingToEffect()` for UI ↔ data model conversion

### Effect Display (read-only, per-entity)

| Component | File | What it reads |
|---|---|---|
| **SpellTable** | [spell-section.tsx](packages/web/features/characters/components/spells/spell-section.tsx) | `effect.cost`, `effect.actions` (stat_modifier for damage) |
| **ActionCard** | [action-card.tsx](packages/web/features/characters/components/actions/action-card.tsx) | `effects[0]` (weak) / `effects[1]` (strong), `actions` for add/multiply |
| **InspectItemModal** | [inspect-item-modal.tsx](packages/web/features/characters/components/inventory/inspect-item-modal.tsx) | `effects[0].display.reminder_text` only |
| **SkillTreeViewer** | [skill-tree-viewer.tsx](packages/web/features/skills/components/skill-tree-viewer.tsx) | `actions`, `trait`, `display.reminder_text` via `formatEffect()` |
| **CharacterDashboard** | [character-dashboard.tsx](packages/web/features/characters/components/character-dashboard.tsx) | Calls `evaluateEffects(activeSkills)` for carry weight and stat bonuses |

### Effect Editor Hosts (entity-specific editors that open EffectEditorModal)

| Component | File |
|---|---|
| EditSpellModal | [edit-spell-modal.tsx](packages/web/features/devtools/components/edit-spell-modal.tsx) |
| SkillTreeEditor | [skill-tree-editor.tsx](packages/web/features/skills/components/skill-tree-editor.tsx) |
| EditActiveSkillModal | [edit-active-skill-modal.tsx](packages/web/features/devtools/components/edit-active-skill-modal.tsx) |

---

## Formatting Helpers (in-component, not centralized)

These live inside their components — if you add a new action type you'll need to update each one:

| Function | Location | Purpose |
|---|---|---|
| `formatCost()` | spell-section.tsx | Pool + value → `"5P"` / `"3E"` |
| `formatDamage()` | spell-section.tsx | `stat_modifier` actions → `"2d8+5 x1.5"` |
| `resolveEffectStats()` | action-card.tsx | Effect → `{ addMod, multCoeff, cost, costLabel }` |
| `formatEffect()` | skill-tree-viewer.tsx | Effect → `"[trait] action_summary"` for tree nodes |

---

## Adding a New Effect Type: Checklist

When adding a new `ActionType` (e.g. `"grant_language"`) or a new `EffectTrait`:

### 1. Schema — [skill-effect.ts](packages/web/lib/schemas/skill-effect.ts)
Add the new value to the relevant `z.enum([...])`. Zod will reject unknown values at parse time.

### 2. Types — [effect-engine.ts](packages/web/lib/effect-engine.ts)
- Add the new value to the `ActionType` or `EffectTrait` union type
- Add handling in `evaluateEffect()` / `evaluateEffects()` — what does it produce?
- Add the output field to `EffectCalculationResult` if needed

### 3. Editor UI — [effect-editor-modal.tsx](packages/web/components/effect-editor-modal.tsx)
- Add to the `ActionType` dropdown options
- Add a branch in `ActionTargetInput` for the new type's target selector
- Update `effectToEditing()` / `editingToEffect()` if the shape differs

### 4. Display components (only the ones that render this action type)
- **ActionCard** → `resolveEffectStats()` if it affects combat display
- **SpellTable** → `formatDamage()` / `formatCost()` if it affects spell display
- **SkillTreeViewer** → `formatEffect()` for tree node summaries
- **InspectItemModal** → only if item effects need new display

### 5. Database — `supabase/migrations/`
New migration only if adding a new column or table. If the effect is stored in existing `effects: jsonb` columns, no migration is needed — the JSONB is schemaless.

### 6. Tests — (currently deleted, previously at `packages/web/lib/skill-engine.test.ts`)
Add unit tests for the new trait/action in the evaluation engine before shipping.

---

## What the AI GM Does NOT Handle

The server-side GM (`packages/server/gm/`) uses tools (`update_stat`, `restore_pools`, `update_level`) to directly modify character pool values. It does **not** evaluate the effects engine — effects influence character state through the UI layer only. If an effect should influence GM behavior, that logic must be added explicitly to the GM tool handlers or the prompts passed to the AI.
