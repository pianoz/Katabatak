<!-- markdownlint-disable-file -->
# Item Authoring Guide

> When to use the `items` table, how to fill each column, and how items flow through the system.

---

## Overview

An item belongs in the `items` table when it has **mechanical function** — it deals damage, alters stats, costs a resource to use, or has tracked condition. Purely narrative objects (a locked chest, a tattered banner, a notice board) live in `world_entities` as type `'item'` instead; see [ITEM-WORLD-ENTITIES.md](./ITEM-WORLD-ENTITIES.md).

When a mechanical item is created it flows through three additional tables:

| Table | Purpose |
|---|---|
| `items` | Blueprint — stats, descriptions, effects |
| `game_items` | Makes an item available in a game's shop, with stock and price overrides |
| `character_inventory` | Tracks ownership — quantity, equipped state, condition per character |

Quest grants write directly to `character_inventory` (bypassing the shop). Items can also be added to inventory by the GM server manually or through the Quest Engine.

---

## The `items` Table — Column Reference

```sql
id                    UUID PRIMARY KEY        -- stable UUID; use the c1000000-... convention for seeds
name                  TEXT NOT NULL           -- display name
type                  TEXT                    -- weapon | armor | gear | consumable | artifact
subtype               TEXT                    -- freeform (see conventions below)
rarity                TEXT                    -- common | uncommon | rare | unique
is_magical            BOOLEAN                 -- affects how the Architect describes the item
consumable            BOOLEAN                 -- true: item is used up (potions, rations)
weight                NUMERIC                 -- kg, used for carry weight checks
short_description     TEXT                    -- one sentence; stranger-sees POV
long_description      TEXT                    -- 2–4 sentences; sensory detail + history
cost_gold             INTEGER                 -- base shop price in denarius
hidden                BOOLEAN                 -- true: item doesn't appear in shop UI
image_url             TEXT                    -- optional

-- Combat fields (weapons)
damage                TEXT                    -- e.g. '1d6', '2d4'
die_count             INTEGER                 -- number of dice
modifier              INTEGER                 -- flat bonus to damage/roll
modifier_attribute_name TEXT                  -- FK → attributes.name (scale modifier by attribute)
coefficient           NUMERIC                 -- multiplier applied after the roll
coefficient_attribute_name TEXT               -- FK → attributes.name
defence               INTEGER                 -- flat defence bonus (armor/shields)

-- Strong attack fields (two-handed weapons, special attacks)
strong_damage         INTEGER                 -- flat strong-attack damage
strong_cost           INTEGER                 -- resource cost for strong attack
strong_defence        INTEGER                 -- defence bonus on strong attack/block

-- Use cost (activated items/consumables)
cost                  INTEGER                 -- resource cost to activate
cost_attribute_name   TEXT                    -- FK → attributes.name ('power' | 'essence' | 'will' | 'health')
action_text           TEXT                    -- tooltip shown on use button

-- Condition
default_condition     INTEGER                 -- 0–100; starting durability when issued

-- Skill gate
required_skill        TEXT                    -- FK → skills.id; null = no requirement

-- Effects
effects               JSONB NOT NULL DEFAULT '[]'  -- see ITEM-EFFECTS.md
```

### Type and subtype conventions

| type | common subtypes | Notes |
|---|---|---|
| `weapon` | `melee`, `ranged`, `thrown` | Damage fields required |
| `armor` | `light`, `medium`, `heavy`, `shield` | `defence` required |
| `gear` | `utility`, `light`, `magic`, `container`, `food`, `shelter` | General carry items |
| `consumable` | `potion`, `food`, `reagent` | `consumable = true`, `cost` if activated |
| `artifact` | freeform | Rare unique items; usually `is_magical = true` |

Subtypes are freeform — the frontend uses them for grouping and display only. Pick something sensible and consistent with existing entries.

---

## Writing Good Descriptions

Items surface to the Architect in inventory context. Good descriptions matter because the Architect reads `short_description` when listing what the player carries and `long_description` when the player examines an item.

**short_description** — what a stranger sees at a glance. One sentence. Sensory.
```
A short iron dagger. Quick and quiet.
```

**long_description** — examination text. 2–4 sentences. Material, history, quirks.
```
Standard-issue camp knife adapted for close combat. Light enough to throw in a pinch.
```

Avoid:
- Mechanical stat readouts ("deals 1d4 damage") — those come from the stats, not the prose
- Meta-language ("this item can be used to…")
- Long lore paragraphs — save those for `world_lore` or `world_entities`

---

## Step 1 — Insert the item

Use a fixed UUID in migrations so the ID is stable across environments.

```sql
INSERT INTO public.items (
  id, name, type, subtype,
  rarity, is_magical, consumable, weight,
  short_description, long_description,
  cost_gold, default_condition,
  damage, die_count, modifier,
  defence, effects
) VALUES (
  'c1000000-0000-0000-0000-000000000010',   -- next sequential ID
  'Ashwood Cudgel',
  'weapon', 'melee',
  'common', false, false, 2.5,
  'A dense length of ashwood. Unglamorous and effective.',
  'Carved from a single branch rather than turned on a lathe. The grip is wrapped in cured hide. '
  'It has the weight of something that has been used.',
  8, 100,
  '1d6', 1, 0,
  0, '[]'
);
```

---

## Step 2 — Add to a game's shop (optional)

`game_items` controls shop availability for a specific game instance.

```sql
INSERT INTO public.game_items (game_id, item_id, is_available_in_shop, stock_quantity, discovery_status)
VALUES (
  '<game-uuid>',
  'c1000000-0000-0000-0000-000000000010',
  true,      -- show in shop
  -1,        -- -1 = unlimited stock; positive integer = finite
  'known'    -- 'known' | 'hidden' | 'rumored'
);
```

`discovery_status`:
- `known` — appears in shop immediately
- `hidden` — seeded but not shown; reveal programmatically
- `rumored` — future use

---

## Step 3 — Grant directly to a character (bypassing shop)

For quest grants, starting items, or GM awards:

```sql
INSERT INTO public.character_inventory
  (id, character_id, item_id, quantity, is_equipped, condition)
VALUES (
  gen_random_uuid(),
  '<character-uuid>',
  'c1000000-0000-0000-0000-000000000010',
  1,      -- quantity (stackable items use > 1)
  false,  -- equipped?
  100     -- condition 0–100
);
```

For quest-based grants, use the Quest Engine's `start_grants` or `completion_grants` fields instead of writing inventory directly — the Quest Engine is idempotent. See [QUEST-AUTHORING.md](./QUEST-AUTHORING.md).

---

## How items reach the Architect

The Architect receives a serialized context block each turn (built by `auto-hydrator.ts`). Items appear as:

```
Equipped: Iron Sword, Leather Armor
Carrying: Traveler's Pack, Health Potion ×2, Torch ×3
```

Only `name` is exposed at this level. When the player examines an item, the Lore-Engine triggers a world search that may surface the `long_description` from the item's `world_entities` entry (if one exists) or from the items table via a future lookup.

The Architect does **not** receive mechanical stat values — it narrates outcomes, not numbers.

---

## Condition system

`character_inventory.condition` is an integer from 0–100. It represents item durability. The Architect can reference it narratively ("your sword is notched and dull") but condition changes are not currently applied mechanically — no automatic degradation logic exists yet. `default_condition` on the item seeds the initial value when the item is granted.

---

## Testing a new item

```sql
-- Verify the item exists
SELECT id, name, type, subtype, weight, cost_gold
FROM items WHERE id = 'your-item-uuid';

-- Verify shop availability
SELECT gi.*, i.name
FROM game_items gi JOIN items i ON i.id = gi.item_id
WHERE gi.game_id = '<game-uuid>' AND gi.item_id = 'your-item-uuid';

-- Verify character inventory after grant
SELECT i.name, ci.quantity, ci.condition, ci.is_equipped
FROM character_inventory ci JOIN items i ON i.id = ci.item_id
WHERE ci.character_id = '<char-uuid>';
```

---

## Common mistakes

| Mistake | Effect | Fix |
|---|---|---|
| Leaving `effects` out entirely | Migration error — column is NOT NULL | Use `'[]'` as default |
| `cost_attribute_name` without a matching `attributes` row | FK violation | Check `SELECT name FROM attributes` first |
| Non-unique UUID | Insert conflict | Check existing IDs with `SELECT id FROM items` |
| `required_skill` pointing to a non-existent skill | FK violation | Use `SELECT id FROM skills` to verify |
| Consumable item with `consumable = false` | Item never gets removed from inventory on use | Set `consumable = true` |
