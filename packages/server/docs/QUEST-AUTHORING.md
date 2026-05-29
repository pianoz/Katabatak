<!-- markdownlint-disable-file -->
# Quest Authoring Guide

> How to add a new quest to Katabatak — schema, grants, NPC companions, stage detection, and testing.

---

## Overview

A quest is a DB row in `quest_templates` plus any items and NPC templates it references. The Quest Engine (`services/quest-engine.ts`) reads the template and fires mechanical grants at the right moments. The Scribe reads the template's stage definitions and advances `current_stage` in `characters.quest_objectives` as the narrative progresses.

No code changes are required to add a new quest — it's data-only unless the quest needs custom trigger logic.

---

## Step 1 — Define your items (if needed)

If the quest grants items that don't already exist in the `items` table, seed them first. Items are referenced by UUID in the `start_grants` and `completion_grants` JSON.

**Convention:** Use fixed UUIDs in the migration so they're stable across environments. Format: `a1b2c3d4-00NN-0000-0000-000000000000` where `NN` is a sequential number.

```sql
INSERT INTO items (id, name, type, subtype, rarity, is_magical, consumable, weight, short_description, long_description, effects)
VALUES (
  'a1b2c3d4-00NN-0000-0000-000000000000',
  'Item Name',
  'gear',          -- gear | consumable | artifact | weapon | armor
  'container',     -- subtype — freeform, e.g. food, shelter, compass
  'common',        -- common | uncommon | rare | unique
  false,
  false,           -- consumable: true if it gets used up
  0.5,             -- weight in kg
  'One-sentence stranger-sees description.',
  'Two or three sentences. What it looks, smells, feels like. History if relevant.',
  '[]'             -- effects JSONB — empty array unless you need mechanical effects
);
```

---

## Step 2 — Write the quest template

Insert a row into `quest_templates`. All four JSON fields are required.

```sql
INSERT INTO quest_templates (id, title, description_gm, stages, start_grants, completion_grants)
VALUES (
  'your_quest_slug',       -- snake_case, matches characters.quest_objectives[n].id
  'Quest Display Title',
  '...',                   -- see description_gm guidance below
  '...',                   -- see stages guidance below
  '...',                   -- see start_grants guidance below
  '...'                    -- see completion_grants guidance below
);
```

---

## `description_gm` — GM backstory

This is injected into the Architect's system block every turn while the quest is active. **The player never sees it directly** — it shapes what the Architect knows but keeps hidden.

**Write this as a GM briefing:**
- What is actually going on beneath the surface (antagonist motivations, hidden truths)
- What NPCs know and what they're hiding
- What the quest is ultimately pointing toward
- Tone guidance and thematic constraints

**Do NOT include:**
- Specific stat numbers or mechanical values (that's the Ledger's job)
- Instructions about what the player should do (the Architect improvises from here)
- Spoilers framed as facts the player has already learned — describe them as things to be discovered

**Example (Waystone quest):**
```
The waystone points toward a buried staircase two days east of Karkill, in the Sundry Flats desert.
The staircase descends into a sealed chamber containing a clock-like mechanism that completes one
revolution every two thousand years — currently almost at the end of a cycle. An inscription reads:
"The Days of Rain are coming." Antagonists: the Greycoats, agents of an unnamed authority who know
the waystone exists and want to suppress what it points to. They believe they are preventing a panic.
Brin has seen the man with the grey coat before. She knows more than she lets on.
```

---

## `stages` — Quest stage definitions

An ordered JSON array of stage objects. The Scribe reads this array every time it runs and advances `characters.quest_objectives[n].current_stage` when narrative evidence matches a stage's `completion_hints`.

```jsonc
[
  {
    "id": "stage_slug",           // snake_case, unique within this quest
    "title": "Short Title",       // shown in quest log
    "description": "One sentence. Player-facing. Where the quest stands at this stage.",
    "completion_hints": [         // keywords the Scribe looks for in the narrative
      "keyword one",
      "phrase two",
      "alternate phrasing"
    ]
  }
]
```

### Stage ordering

Stages should progress from earliest to latest. The Scribe will not skip stages — it only advances forward. The first stage (`id` of the first array element) is the initial `current_stage` when the quest starts.

### Writing good `completion_hints`

The Scribe is a Haiku model. It matches hints against what it has read in the narrative — not exact string matching, but semantic matching guided by these keywords. Write 3–6 hints per stage.

| Good hints | Why |
|---|---|
| `"arrived in karkill"`, `"town gate"`, `"outer wall"` | Concrete nouns + verbs that would appear in any description of arriving |
| `"soldiers"`, `"grey coat"`, `"horsemen on the road"` | Multiple phrasings of the same event |
| `"staircase"`, `"steps going down"`, `"descend into the earth"` | The same object from different narrative angles |

| Bad hints | Why |
|---|---|
| `"quest advanced"` | Meta-language, never in a narrative |
| `"inn"` alone | Too generic — appears in many non-relevant scenes |
| `"the thing happened"` | Vague; the model can't match this confidently |

### The final stage

Always name your last stage `"completed"` (or `"failed"` for a failure branch). When the Scribe sets `status: "completed"`, the handler fires `applyQuestCompletionGrants()`.

```jsonc
{
  "id": "completed",
  "title": "Quest Complete",
  "description": "What the player achieved. One sentence.",
  "completion_hints": ["survived", "escaped", "defeated", "quest resolved"]
}
```

### Placeholder stages (combat not yet implemented)

If a stage requires combat, define it but leave `completion_grants` items empty. The stage will still detect and advance when the combat *outcome* is narrated. Fill in rewards when combat is implemented.

```jsonc
{
  "id": "the_battle",
  "title": "Something Wakes",
  "description": "Something in the chamber has come to life. A fight begins.",
  "completion_hints": ["attacks", "animated", "guardian", "battle", "fight begins"]
}
```

---

## `start_grants` — What the player receives when the quest starts

```jsonc
{
  "items": [
    {
      "item_id": "uuid-of-item-in-items-table",
      "quantity": 1,     // stackable items (rations, arrows) use quantity > 1
      "condition": 100   // 0–100; use < 100 for worn/damaged starting gear
    }
  ],
  "npcs": [
    {
      "name": "NPC Name",
      "title": "A brief role description",       // shown in Architect context
      "faction": null,                            // or "faction name"
      "disposition_to_players": 55,              // -100 (hostile) to 100 (devoted)
      "personality_profile": {
        "personality": "How they speak and act in 2–3 sentences. Voice, mannerisms, what they want.",
        "home_location_id": null,                // null for companions without a fixed home
        "routine": null,                         // null for companions (they follow the player)
        "memory": {
          "last_encounter_summary": "How you met. One sentence.",
          "known_facts": [                       // max 8, oldest drop off
            "Fact the NPC knows about the world",
            "Fact the NPC knows about the player"
          ],
          "relationship_arc": "Starting relationship in a phrase. e.g. 'Dependent and watchful.'"
        },
        "current_task": null
      }
    }
  ]
}
```

### Companion NPCs

Companions created via `start_grants.npcs` get:
- `game_id = null` — they are not tied to any multiplayer game session
- `following_character_id = characterId` — they appear in Architect context every turn regardless of location
- `current_location_id` set to the character's location at grant time (or `loc_karkill` as fallback)

The Ledger can later update their state (disposition, memory, `following_character_id`) exactly like any other NPC.

If the quest grants no companion NPCs, set `"npcs": []`.

---

## `completion_grants` — Rewards on quest completion

```jsonc
{
  "skill_points": 3,    // added to characters.unused_skill_points
  "denarius": 50,       // added to characters.denarius
  "items": [            // bonus items; same format as start_grants.items
    {
      "item_id": "uuid",
      "quantity": 1,
      "condition": 100
    }
  ]
}
```

All three fields are optional — omit or zero-out what isn't needed:
```jsonc
{ "skill_points": 0, "denarius": 0, "items": [] }
```

---

## Step 3 — Decide how the quest is triggered

### Starting quest (character creation)

The first quest is special-cased in `syngem-intro.tsx`: after `createSyngemGame()` resolves, it fires `POST /api/gm/quest/start` with `questId: "follow_the_waystone"`. The `quest_objectives` seed with `status: "active"` comes from the Character Creator agent.

To replace or add a starting quest, update:
1. The Character Creator agent's output instructions (`packages/server/gm/agents/character-creator.ts` — the `initial_quest` block in the prompt)
2. The `fetch("/api/gm/quest/start", ...)` call in `syngem-intro.tsx`

### Mid-game quest (gained during play)

There is no automatic mid-game trigger yet. The intended flow is:

1. The Ledger or some future game event marks the quest as gained
2. The frontend (or a server hook) calls `POST /api/gm/quest/start` with the new `questId`
3. The Quest Engine fires start grants

Until mid-game quest triggers are wired up, you can fire grants manually via the API or by calling `applyQuestStartGrants(characterId, questId)` directly on the server.

---

## Step 4 — Update `characters.quest_objectives`

When a quest starts, a record must be present in `characters.quest_objectives` with:

```jsonc
{
  "id": "your_quest_slug",
  "title": "Quest Display Title",
  "status": "active",
  "description": "One sentence. Where the quest stands right now.",
  "current_stage": "first_stage_id",
  "grants_applied": []
}
```

`grants_applied` starts empty. The Quest Engine appends `"start"` after firing start grants and `"completion"` after firing completion grants. **Never write to `grants_applied` yourself** — the Quest Engine is the only author of that field.

`current_stage` should be set to the `id` of the first stage in your `stages` array. The Scribe will advance it from there.

---

## Full example migration

```sql
-- New item
INSERT INTO items (id, name, type, subtype, rarity, is_magical, weight, short_description, long_description, effects)
VALUES (
  'a1b2c3d4-0010-0000-0000-000000000010',
  'Cracked Lantern',
  'gear', 'light', 'common', false, 0.4,
  'A tin lantern with a cracked glass pane. Still burns.',
  'The crack lets the wind in, so the flame gutters in a breeze. Works well enough in a still room.',
  '[]'
);

-- Quest template
INSERT INTO quest_templates (id, title, description_gm, stages, start_grants, completion_grants)
VALUES (
  'the_old_mill',
  'The Old Mill',
  'The mill burned three years ago. The owner, Voss, died in the fire — or so everyone says. He is alive, hiding in the cellar. He set the fire himself to escape debt. The creditors have hired a quiet man named Harke to find him. Harke is already in town.',
  '[
    {"id": "arrive_at_mill", "title": "The Mill Road", "description": "The mill stands at the edge of town. Something feels off.", "completion_hints": ["mill", "old mill", "wheel", "burned", "ruins"]},
    {"id": "find_voss", "title": "Someone is Here", "description": "Someone is living in the cellar.", "completion_hints": ["cellar", "hiding", "footprints", "alive", "survivor", "smell of smoke"]},
    {"id": "harke_arrives", "title": "Harke", "description": "The quiet man arrives. He knows Voss is here.", "completion_hints": ["harke", "creditor", "quiet man", "he is here", "he found"]},
    {"id": "completed", "title": "Resolved", "description": "The mill situation is resolved, one way or another.", "completion_hints": ["resolved", "left", "fled", "dead", "escaped", "paid", "deal"]}
  ]',
  '{"items": [{"item_id": "a1b2c3d4-0010-0000-0000-000000000010", "quantity": 1, "condition": 70}], "npcs": []}',
  '{"skill_points": 1, "denarius": 30, "items": []}'
);
```

---

## How the Scribe detects stage advancement

Every 4 turns, `runScribe()` is called. Before it makes a Claude call, it fetches `quest_templates.stages` for all active quests and appends them to the prompt as a `QUEST STAGE REFERENCE` block. The model receives:

```
QUEST STAGE REFERENCE:
Quest "the_old_mill" stages: [{"id":"arrive_at_mill","completion_hints":["mill","old mill",...]}, ...]
```

The model is instructed to:
1. Read the current `current_stage` from `PRIOR OBJECTIVES`
2. Scan the narrative for evidence that the next stage's `completion_hints` have been reached
3. Advance `current_stage` if the evidence is clear
4. Return the full updated `objectives` array

If the Scribe doesn't detect a stage transition, nothing changes. The stage will be detected on the next Scribe run (at most 4 turns later). **A missed detection is not catastrophic** — it just means grants fire slightly late.

---

## Idempotency guarantee

`applyQuestStartGrants` and `applyQuestCompletionGrants` check `grants_applied` before doing anything. If `"start"` is already in the array, start grants are skipped. If `"completion"` is there, completion grants are skipped.

This means:
- Calling `POST /gm/quest/start` twice is safe
- A Scribe run that marks a quest completed twice (shouldn't happen, but) won't double-grant
- If the server crashes mid-grant, a retry will only apply the missing parts

---

## Testing a new quest

### 1. Verify items exist
```sql
SELECT id, name, type, weight FROM items WHERE id IN ('your-item-uuid', ...);
```

### 2. Verify the template
```sql
SELECT id, title, jsonb_pretty(stages), jsonb_pretty(start_grants), jsonb_pretty(completion_grants)
FROM quest_templates WHERE id = 'your_quest_slug';
```

### 3. Fire start grants manually
```bash
curl -X POST http://localhost:3001/gm/quest/start \
  -H "Authorization: Bearer $GM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"characterId": "<char-uuid>", "questId": "your_quest_slug"}'
```

### 4. Check inventory and NPCs
```sql
SELECT i.name, ci.quantity, ci.condition
FROM character_inventory ci JOIN items i ON i.id = ci.item_id
WHERE ci.character_id = '<char-uuid>';

SELECT name, title, following_character_id, game_id
FROM npcs WHERE following_character_id = '<char-uuid>';
```

### 5. Verify grants_applied updated
```sql
SELECT quest_objectives FROM characters WHERE id = '<char-uuid>';
-- Look for grants_applied: ["start"]
```

### 6. Test stage detection
Trigger a manual Scribe run after some narrative:
```bash
curl -X POST http://localhost:3001/gm/scribe \
  -H "Authorization: Bearer $GM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"characterId": "<char-uuid>"}'
```
Then check `quest_objectives.current_stage` updated.

### 7. Test completion grants
Manually mark the quest completed in DB, then trigger Scribe:
```sql
UPDATE characters
SET quest_objectives = jsonb_set(
  quest_objectives,
  '{0, status}',
  '"completed"'
)
WHERE id = '<char-uuid>';
```
After Scribe runs, check `denarius` and `unused_skill_points` incremented.

---

## Common mistakes

| Mistake | Effect | Fix |
|---------|--------|-----|
| `completion_hints` too vague (single common word) | Scribe advances stage too early | Use 3+ word phrases that are specific to that event |
| `completion_hints` too specific (exact GM-knowledge phrase) | Scribe never advances | Use words that would naturally appear in the Architect's prose |
| `grants_applied` initialized to something other than `[]` | Grants silently skipped | Always initialize to `[]` |
| `current_stage` not set on the objective | Scribe has no starting point | Set to the `id` of your first stage |
| NPC with no `personality` field in `personality_profile` | NPC is tonally flat | Always provide a `personality` string |
| Duplicate item UUIDs with existing migration items | Migration fails | Check `items` table before picking UUIDs |
