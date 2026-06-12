<!-- markdownlint-disable-file -->
# Items in the World — `world_entities` type `'item'`

> When to use `world_entities` for items, what the `data` payload looks like, and how the Ledger manages world-level item state.

---

## Two Item Systems

There are two distinct ways an item exists in Katabatak:

| System | Table | Purpose |
|---|---|---|
| **Mechanical item** | `items` | Blueprint with stats, effects, descriptions. Referenced by `character_inventory`. |
| **World object** | `world_entities` (type `'item'`) | A specific physical object the Architect has introduced into the world. Can be interacted with, moved, destroyed. |

These two systems are **not linked by a foreign key**. They serve different concerns:

- The `items` table answers: *"What does an Iron Sword do mechanically?"*
- A `world_entities` item answers: *"Is there a sword on the table in the Flounder Inn right now?"*

---

## When does a world entity item exist?

A `world_entities` record with `type = 'item'` should exist when:

1. The Architect introduces a specific named object into the scene and the player might interact with it, pick it up, or reference it later.
2. You want the object to be discoverable via the Lore-Engine's world search.
3. The object's state (e.g. "broken", "hidden") should persist across turns.

It does **not** need to exist for:
- Items already in a character's inventory (those are tracked via `character_inventory`)
- Generic flavor objects that will never be mechanically significant
- Shop stock (that's `game_items`)

---

## The `data` JSONB Payload for Item Entities

There is no enforced schema for `data` — it's flexible JSONB. By convention, use these fields:

```jsonc
{
  "short_description": "One sentence. What a stranger sees at a glance.",
  "long_description": "2–3 sentences. Sensory detail, material, condition.",

  // Optional: mechanical link (no FK enforcement)
  "item_id": "<uuid from items table>",   // if this maps to a mechanical item

  // Optional: state flags
  "is_hidden": false,         // true = not visible until discovered
  "is_locked": false,         // for containers
  "owner_name": null,         // narrative ownership (not enforced)
  "condition": 100,           // 0–100 durability; can be mutated by the Ledger

  // Optional: location context (redundant with the entity hierarchy but useful for search)
  "location_name": "The Flounder Inn, common room"
}
```

The `search_vector` on `world_entities` is generated from `name + nation_context + region_context + place_context` — **not from `data`**. Put searchable text in `name` and the context fields, not buried in `data`.

---

## Creating a World Entity Item

### Via migration (design-time)

For items that are part of the world from the start:

```sql
INSERT INTO public.world_entities (id, name, type, parent_id, place_context, data)
VALUES (
  'item_flounder_inn_sword',           -- slug ID: item_<location>_<name>
  'Notched Iron Sword',
  'item',
  'loc_karkill_flounder_inn',          -- parent: the place where it lives
  'Karkill',
  '{
    "short_description": "A sword propped against the wall near the hearth. Someone left in a hurry.",
    "long_description": "The blade is notched near the guard — caught something hard and never got repaired. Still serviceable. The grip wrap has unraveled at one end.",
    "item_id": "c1000000-0000-0000-0000-000000000001",
    "condition": 60
  }'::jsonb
);
```

**ID convention:** `item_<location_slug>_<descriptive_name>` in snake_case.

### Via the Ledger (runtime)

When the Architect narrates introducing a new physical object, the Ledger emits a `create_entity` action:

```json
{
  "action": "create_entity",
  "entity": {
    "id": "item_crossroads_fallen_lantern",
    "name": "Fallen Lantern",
    "type": "item",
    "data": {
      "short_description": "A tin lantern lying face-down in the mud. Still warm.",
      "long_description": "The glass is cracked but not shattered. Oil has spilled around it. Whoever dropped it was in a hurry."
    }
  }
}
```

The Ledger sets `parent_id` only if it can infer the current location's entity ID. If not, the entity is created as a root-level orphan — still searchable by name but not discoverable through location hierarchy traversal.

---

## Mutating World Entity Item State

The Ledger emits `update_entity` when the narrative changes an object's state permanently:

```json
{
  "action": "update_entity",
  "entity_id": "item_flounder_inn_sword",
  "mutations": {
    "condition": 0,
    "short_description": "A shattered iron blade. Not worth taking."
  }
}
```

`update_entity` merges the `mutations` object into the existing `data` JSONB — fields not mentioned are preserved.

For player-specific state (e.g. a door the player opened that other players haven't), use `delete_entity` with a `replacement_description` — this writes to `character_entity_mutations` rather than the canonical entity:

```json
{
  "action": "delete_entity",
  "entity_id": "item_flounder_inn_sword",
  "replacement_description": "A bare patch of wall where a sword once hung."
}
```

---

## `character_entity_mutations` — Per-Character Overrides

`character_entity_mutations` stores per-character deltas on top of `world_entities`. The Auto-Hydrator merges these when building location context for the Architect. `character_id` FK → `characters(id) ON DELETE CASCADE` — rows are automatically deleted when a character is deleted.

Fields:
- `character_id` — the character whose view of the world differs from the canonical entity
- `mutations` — JSONB patch applied on top of `data`; override any field
- `travel_progress` — 0.0–1.0 position along a linear path (e.g. an item dropped on a road)
- `spatial_relation` — text description of precise position ("in the ditch on the left")

The GM server writes to this table via `delete_entity` actions; players never write directly.

---

## The Inventory Gap

**There is no automatic bridge between world entity items and character inventory.**

When the Architect narrates "you pick up the sword," the Ledger emits:
1. `delete_entity` for the world entity (removes it from the scene for this player)
2. *No* automatic `character_inventory` insert

The mechanical item grant must happen separately — either through:
- A Quest Engine grant (if the item pickup is part of a quest)
- A manual inventory insert by a game admin
- A future GM server tool (not yet implemented)

This is an architectural gap worth being aware of. The two systems are designed to evolve toward a formal hand-off, but for now they operate independently.

---

## Architecture Assessment

The split between `items` (mechanical blueprints) and `world_entities type='item'` (world-state objects) is sound for the current scale. The main reasons it works:

1. **Most world objects don't need mechanical stats.** A locked chest, a torn map, a blood-stained cloak — these exist narratively without needing weapon damage fields.
2. **The Ledger is stateless.** It reads narrative text and emits JSON. Linking world objects to inventory items would require the Ledger to know item UUIDs, which it currently doesn't.
3. **Quest grants are the happy path.** Items with mechanical function that the player is supposed to obtain are granted through the Quest Engine, not through Ledger-driven world entity → inventory flow.

The gap to watch: if you want a specific world entity item to become a mechanical inventory item when picked up, you need either a Quest Engine grant or a custom server-side handler. Don't rely on the Ledger to bridge this automatically.
