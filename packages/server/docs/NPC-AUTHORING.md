<!-- markdownlint-disable-file -->
# NPC Authoring Guide

> How to create NPCs — the two creation paths, the full schema, location and faction setup, and how NPCs surface to the Architect.

---

## Overview

NPCs live in the `npcs` table. Every NPC has:

- A **location** it belongs to (or follows a character)
- A **disposition** toward the player
- A **personality profile** (voice, routine, memory)

There are three NPC types:

| Type | `game_id` | `following_character_id` | Visibility |
|---|---|---|---|
| **Global NPC** | `null` | `null` | Any game — shown when character is at NPC's location |
| **Game NPC** | `<game-uuid>` | `null` | That game only — shown when character is at NPC's location |
| **Companion NPC** | `null` | `<character-uuid>` | Always shown; follows the character everywhere |

Global NPCs are world characters seeded via migration (no game affiliation). Game NPCs are seeded per-game. Companion NPCs are created via Quest Engine grants.

---

## The `npcs` Table — Column Reference

```sql
id                      UUID PRIMARY KEY
name                    TEXT NOT NULL          -- display name
title                   TEXT                   -- short role label, e.g. "Gate Warden"
faction                 TEXT                   -- faction affiliation; freeform or null
game_id                 UUID → games.id        -- which game this NPC belongs to; null for global/companions
following_character_id  UUID → characters.id   -- set to follow a specific character; null otherwise
current_location_id     VARCHAR(64) → world_entities.id  -- where the NPC is right now
disposition_to_players  INTEGER                -- -100 (hostile) to 100 (devoted); default 0
is_alive                BOOLEAN                -- false once the NPC dies
last_seen_tick          INTEGER                -- turn number of last interaction (for logging)
small_summary           TEXT                   -- one-liner for bystanders shown in Architect context
personality_profile     JSONB                  -- see NPC-PERSONALITY.md
attribute_modifiers     JSONB                  -- reserved; use '{}' unless you need stat overrides
```

`small_summary` is a single sentence describing who this NPC is at a glance — shown to the Architect for bystanders (NPCs not in the party). Party members get their full `personality_profile.personality` instead.

`attribute_modifiers` is unused in the current pipeline — seed it as `'{}'::jsonb`.

---

## Step 1 — Choose a location

Every NPC needs a starting location. `current_location_id` must be a valid `world_entities.id`. Use a `place`-level entity (type `'place'`), not a `region` or `nation`.

```sql
-- Find place-level entities in your area
SELECT id, name FROM world_entities WHERE type = 'place' AND region_context = 'Karkill';
```

---

## Step 2 — Write the personality profile

The `personality_profile` JSONB column is the heart of every NPC. See [NPC-PERSONALITY.md](./NPC-PERSONALITY.md) for the full schema.

Minimum viable profile:
```jsonc
{
  "personality": "Terse and suspicious. Answers questions with questions. Smells of fish.",
  "home_location_id": "loc_karkill_market",
  "routine": null,
  "memory": {
    "last_encounter_summary": null,
    "known_facts": [],
    "relationship_arc": "Stranger."
  },
  "current_task": null
}
```

---

## Step 3a — Seed via migration (Global or Game NPC)

Use `game_id = null` for NPCs that should appear in every game (world characters). Use a specific `game_id` for NPCs tied to one game session. Both types appear at their location when the player visits.

```sql
INSERT INTO public.npcs (
  id, name, title, faction,
  game_id, current_location_id,
  disposition_to_players, is_alive,
  small_summary,
  personality_profile, attribute_modifiers
) VALUES (
  gen_random_uuid(),
  'Edric Mourne',
  'Harbour Master',
  'Ashen Compact',
  null,                                       -- null = global NPC (appears in all games)
  'loc_karkill_harbour',                      -- current_location_id
  10,                                         -- slightly friendly
  true,
  'An overworked harbour master with ink-stained fingers and a ledger always open.',
  '{
    "personality": "Methodical and overworked. Speaks in clipped sentences. Keeps a ledger open at all times and marks entries between sentences.",
    "home_location_id": "loc_karkill_harbour",
    "routine": {
      "morning": "loc_karkill_harbour",
      "afternoon": "loc_karkill_harbour",
      "evening": "loc_karkill_guild_hall",
      "night": "loc_karkill_workers_district"
    },
    "memory": {
      "last_encounter_summary": null,
      "known_facts": [
        "Three ships have gone missing in the strait in the past month.",
        "The Compact has placed a moratorium on night sailings."
      ],
      "relationship_arc": "Stranger. Treats all newcomers with polite suspicion."
    },
    "current_task": null
  }'::jsonb,
  '{}'::jsonb
);
```

---

## Step 3b — Create via Quest Engine grant (Companion NPC)

Companion NPCs are created when a quest starts, not as migrations. They use `following_character_id` instead of `game_id`. See [QUEST-AUTHORING.md](./QUEST-AUTHORING.md) for the full `start_grants.npcs` schema.

The Quest Engine handles:
- Setting `following_character_id = characterId`
- Setting `game_id = null`
- Setting `current_location_id` to the character's location at grant time

---

## How NPCs surface to the Architect

The Auto-Hydrator (`auto-hydrator.ts`) runs every turn and builds the NPC list passed to the Architect.

**Visibility logic:**
1. Fetch game NPCs + global NPCs (by `game_id` or `game_id IS NULL`) and companion NPCs (by `following_character_id`) in parallel.
2. For each NPC, compute its expected location from its `routine` and `home_location_id` using the current game time.
3. Show the NPC if it's at the character's current `location_place`, OR if it has `following_character_id` set.
4. Fire-and-forget DB updates sync `current_location_id` when routine placement differs from the stored value.

**Architect context — two sections based on NPC class:**

Party members (`following_character_id = characterId`) get the full profile:
```
=== PARTY MEMBERS ===
Brin [friendly] (disposition: 60)
  Faction: Waystone Order
  Personality: Earnest and talkative. Refers to the player as "boss" even when asked not to. ...
  Prior encounter: Helped the player escape the ambush at the river crossing.
```

Bystanders (same location, not following) get a lightweight entry:
```
=== NEARBY NPCs ===
Aluette [friendly]
  A kind older woman who co-runs the inn.
Silas Grevil [hostile]
  A gaunt, paranoid man with dark circles under his eyes.
```

**NPC class summary:**

| Class | Condition | Architect section | Data sent |
|---|---|---|---|
| **Party member** | `following_character_id = characterId` | `=== PARTY MEMBERS ===` | Full personality, disposition number, faction, last encounter, current task |
| **Bystander** | At same location, not following | `=== NEARBY NPCs ===` | Name, title, disposition label, `small_summary` |

**Disposition labels:**

| Range | Label |
|---|---|
| ≤ -50 | `hostile` |
| -49 to -1 | `wary` |
| 0 to 49 | `neutral` |
| 50 to 100 | `friendly` |

---

## Faction conventions

`faction` is a freeform string — there's no faction table. Use the canonical world name as it appears in `world_lore` or your world documentation:

- `"Ashen Compact"` — the merchant consortium
- `"Iron Wardens"` — private security guild in Vael'kast
- `null` — independent or unknown

The Architect receives the faction string and uses it for narrative context. Consistent naming matters — the Architect will characterize NPCs differently based on faction.

---

## Seeding multiple NPCs for a location

When seeding a whole area, group insertions by location for readability:

```sql
-- Karkill Gate
INSERT INTO public.npcs (name, title, game_id, current_location_id, disposition_to_players, personality_profile, attribute_modifiers)
VALUES
  ('Vera', 'Gate Warden', 'f0000000-...', 'loc_karkill_gate', 5,
   '{"personality":"...", "home_location_id":"loc_karkill_gate", "routine": {"morning":"loc_karkill_gate","afternoon":"loc_karkill_gate","evening":"loc_karkill_barracks","night":"loc_karkill_barracks"}, "memory":{"known_facts":[], "relationship_arc":"Stranger."}, "current_task":null}'::jsonb,
   '{}'::jsonb),

  ('Doran Ashveil', 'Customs Officer', 'f0000000-...', 'loc_karkill_gate', -5,
   '{"personality":"...", "home_location_id":"loc_karkill_gate", "routine":null, "memory":{"known_facts":[], "relationship_arc":"Stranger. Views all travellers as potential smugglers."}, "current_task":null}'::jsonb,
   '{}'::jsonb);
```

---

## Testing a new NPC

```sql
-- Verify the NPC exists
SELECT id, name, title, current_location_id, disposition_to_players
FROM npcs WHERE game_id = '<game-uuid>';

-- Verify personality profile is valid JSON
SELECT id, name, personality_profile->'personality' AS voice
FROM npcs WHERE game_id = '<game-uuid>';

-- Check which NPCs are at a specific location
SELECT name, title, disposition_to_players
FROM npcs
WHERE current_location_id = 'loc_karkill_harbour'
  AND game_id = '<game-uuid>';

-- Check companion NPCs for a character
SELECT name, title, following_character_id
FROM npcs WHERE following_character_id = '<char-uuid>';
```

---

## Common mistakes

| Mistake | Effect | Fix |
|---|---|---|
| `current_location_id` points to a `region` or `nation` entity | NPC never visible — visibility requires `place` match | Use a `place`-type entity ID |
| `personality_profile` missing `personality` field | NPC is tonally flat; Architect has no voice to draw from | Always include `personality` string |
| `game_id` and `following_character_id` both set | NPC appears in both game NPC pool and companion pool; deduplication handles it but it's confusing | Pick one — use `game_id` OR `following_character_id`, not both |
| Routine location IDs that don't exist | Lazy placement silently fails | Verify all location IDs with `SELECT id FROM world_entities WHERE type = 'place'` |
| `disposition_to_players` out of range | No enforcement — but disposition labels max out at ±100 | Clamp to [-100, 100] |
