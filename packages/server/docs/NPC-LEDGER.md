<!-- markdownlint-disable-file -->
# NPC Lifecycle and Ledger Mutations

> How the Ledger updates NPC state, what each mutation field does, and when to emit `update_npc`.

---

## Overview

The Ledger (`agents/ledger.ts`) runs after each Architect response and reads the narrative text to determine if any NPC state changed permanently. When it detects a meaningful shift, it emits an `update_npc` action. The State Executor (`gm/state-executor.ts`) applies that action to the database by calling `updateNpcMutations()` in `world-service.ts`.

The Ledger only emits `update_npc` for **semantically significant events** — not routine small talk. The full rule is documented in the Ledger's system prompt.

---

## The `update_npc` Action

```json
{
  "action": "update_npc",
  "npc_id": "<npcs.id>",
  "mutations": {
    // any subset of the fields below
  }
}
```

All mutation fields are optional. Emit only what changed.

---

## Mutation Fields

### `disposition_delta` — Integer

Adjusts `disposition_to_players` by this amount. Clamped to [-100, 100] after application.

```jsonc
"disposition_delta": 20   // player helped NPC; +20 goodwill
"disposition_delta": -35  // player insulted NPC; relationship damaged
```

Use positive values for goodwill gained, negative for trust lost. The Ledger estimates magnitude based on the narrative — a small favor is +5 to +15, a major betrayal is -30 to -60.

**Disposition labels (for Architect context):**

| Value | Label | Behavior |
|---|---|---|
| ≤ -50 | `hostile` | Actively works against the player |
| -49 to -1 | `wary` | Suspicious, withholds information |
| 0 to 49 | `neutral` | Professional, transactional |
| ≥ 50 | `friendly` | Cooperative, proactively helpful |

---

### `memory_append` — String

Overwrites `personality_profile.memory.last_encounter_summary`. One sentence from the NPC's perspective.

```jsonc
"memory_append": "Player bribed me with 50 denarius to look the other way at the gate."
```

This replaces the previous summary (it's not appended to a log — it's an overwrite). Write it as what the NPC would remember and potentially mention next time they meet.

**When to emit:** Any interaction the NPC would distinctly remember — a bribe, a threat, a kindness, a revelation.

**When not to emit:** Passing exchanges, requests for directions, casual small talk.

---

### `known_facts_append` — String[]

Adds new facts to `personality_profile.memory.known_facts`. The system caps this at 8 entries; oldest are dropped automatically.

```jsonc
"known_facts_append": [
  "The player is looking for the man in the grey coat.",
  "The player has a waystone compass they found in the ruins."
]
```

**When to emit:** When the player voluntarily discloses information the NPC would retain — their name, their mission, something they own, something they've seen.

**When not to emit:** Things the NPC was already told, general world knowledge, player's internal thoughts.

---

### `current_task` — Object or null

Assigns or clears a mission for the NPC.

**Assign:**
```jsonc
"current_task": {
  "description": "Watch the north gate for a man in a grey coat.",
  "target_location_id": "loc_karkill_gate",
  "assigned_tick": 0    // use 0; actual tick is set by the pipeline context
}
```

**Clear:**
```jsonc
"current_task": null
```

Tasks appear in the Architect's context block:
```
Current task: Watch the north gate for a man in a grey coat.
```

The Ledger emits this when a player explicitly assigns a mission to an NPC ("Vera, watch the north gate for me"). Clear it when the task is completed or explicitly cancelled.

---

### `current_location_id` — String

Moves the NPC to a new location. Should only be emitted when the narrative explicitly states the NPC is departing to a named place.

```jsonc
"current_location_id": "loc_karkill_harbour"
```

**Do not emit** for routine time-of-day movement — the lazy placement system handles that automatically. Only use this when the narrative says something like "Edric excused himself and headed toward the harbour."

---

### `is_alive` — false

Marks the NPC as dead. Only emit `false` — the Ledger never resurrects.

```jsonc
"is_alive": false
```

Dead NPCs are filtered out of the Architect's context. Emit this when the NPC dies in the scene.

---

### `following_character_id` — String or null

Sets or clears the NPC's companion status.

**Start following:**
```jsonc
"following_character_id": "<character-uuid>"
```

**Stop following:**
```jsonc
"following_character_id": null
```

When set, the NPC is treated as a companion — they appear in Architect context regardless of location. Emit this when the narrative establishes that an NPC has agreed to travel with the player, or when they explicitly part ways.

---

## What the Ledger Ignores

The Ledger's system prompt explicitly excludes:

- Routine movement (time-of-day location changes) — handled by lazy placement
- Information-only exchanges ("player asked for directions")
- Small talk with no meaningful outcome
- Temporary narrative states ("NPC looked nervous")

If in doubt, omit the action. A missed update is less harmful than spurious state changes.

---

## The `updateNpcMutations` Flow

When the State Executor calls `updateNpcMutations()` in `world-service.ts`:

1. Fetch the current NPC row
2. Apply `disposition_delta` with clamping
3. If `memory_append` or `known_facts_append` are present, merge into `personality_profile.memory`:
   - `memory_append` overwrites `last_encounter_summary`
   - `known_facts_append` appends to `known_facts`, then `.slice(-8)` to keep the most recent 8
4. If `current_task` is present (including `null`), write it to `personality_profile.current_task`
5. Apply `current_location_id`, `is_alive`, `following_character_id` as direct column updates
6. Write all changes in a single `UPDATE` call

---

## NPC Lifecycle Summary

```
Created                     → npcs row inserted (migration or Quest Engine grant)
Player encounters NPC       → Auto-Hydrator includes NPC in context block
Meaningful interaction       → Ledger emits update_npc; State Executor applies
NPC assigned a task         → current_task set in personality_profile
NPC follows player          → following_character_id set; game_id set to null (companion)
NPC departs                 → following_character_id cleared; current_location_id updated
NPC dies                    → is_alive = false; removed from future context blocks
```

---

## Ledger Prompt Examples

The Ledger's fallback system prompt includes worked examples. These illustrate the threshold for emitting `update_npc`:

```
Player bribes gate guard 50 gold to look away
→ update_npc {npc_id: "guard_karkill_gate", mutations: {disposition_delta: 20, memory_append: "Player bribed them with 50 gold."}}

Player asks guard for directions to the inn
→ [] (no state change — information only)

Player insults merchant in front of customers
→ update_npc {npc_id: "merchant_bazaar", mutations: {disposition_delta: -25, memory_append: "Player insulted them publicly."}}

Player asks NPC to patrol the docks
→ update_npc {npc_id: "marta_karkill", mutations: {current_task: {description: "Patrol the docks for suspicious activity", target_location_id: "loc_karkill_docks", assigned_tick: 0}}}
```

---

## Manual NPC mutation (admin)

To update an NPC directly without going through the pipeline:

```bash
# Via GM server API
curl -X POST http://localhost:3001/gm/npc/update \
  -H "Authorization: Bearer $GM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "<npc-uuid>",
    "mutations": {
      "disposition_delta": -50,
      "memory_append": "Player killed their brother."
    }
  }'
```

Or directly in SQL (dev only):

```sql
-- Manually update disposition
UPDATE npcs
SET disposition_to_players = GREATEST(-100, LEAST(100, disposition_to_players - 50))
WHERE id = '<npc-uuid>';

-- Manually clear a task
UPDATE npcs
SET personality_profile = jsonb_set(personality_profile, '{current_task}', 'null')
WHERE id = '<npc-uuid>';
```
