<!-- markdownlint-disable-file -->
# NPC Personality Profile Reference

> Complete schema for the `npcs.personality_profile` JSONB column — voice, routine, memory, and tasks.

---

## TypeScript Interface

```ts
interface NpcPersonalityProfile {
  personality?: string            // voice and mannerisms
  home_location_id?: string       // fallback location when no routine slot matches
  routine?: NpcRoutine | null     // time-of-day location schedule
  memory?: NpcMemory              // compressed interaction history
  current_task?: NpcCurrentTask | null  // active mission
}

interface NpcRoutine {
  morning?: string    // 06:00–12:00 (360–720 min)
  afternoon?: string  // 12:00–18:00 (720–1080 min)
  evening?: string    // 18:00–24:00 (1080–1440 min)
  night?: string      // 00:00–06:00 (0–360 min)
}

interface NpcMemory {
  last_encounter_summary?: string   // one sentence — what the NPC remembers about the last interaction
  known_facts?: string[]            // things the player has told this NPC; capped at 8
  last_encounter_tick?: number      // turn number of last interaction
  relationship_arc?: string         // current relationship status in a phrase
}

interface NpcCurrentTask {
  description: string              // one sentence: what the NPC is doing
  target_location_id: string       // where the task takes them
  assigned_tick: number            // turn number when assigned
}
```

---

## `personality`

The single most important field. This is what the Architect reads to give the NPC a distinct voice.

Write it as a **GM stage direction** — 2–4 sentences describing voice, mannerisms, and motivation. The Architect uses this as the NPC's voice anchor every time it appears.

**Good:**
```
Terse and suspicious. Answers questions with questions. Keeps a ledger open at all times.
Marks entries mid-conversation as a subtle power move. Smells of pipe tobacco and salt water.
```

**Too thin:**
```
Friendly merchant.
```

**Too long:** Don't write backstory here. Put backstory in `known_facts` or `world_lore`. The Architect needs a voice, not a biography.

**Avoid:**
- Mechanical language ("grants +5 disposition when bribed")
- Player-facing spoilers ("secretly the assassin")
- Instructions to the player ("tell the player to …")

---

## `home_location_id`

The location this NPC returns to when:
1. No routine slot exists for the current time of day
2. `routine` is `null`

Must be a `world_entities.id` with `type = 'place'`. This is also where the NPC will be at game start unless their routine says otherwise.

```jsonc
"home_location_id": "loc_karkill_harbour"
```

Companions (following a character) can set this to `null` — they don't have a fixed home.

---

## `routine`

A time-of-day location schedule. The Auto-Hydrator maps `syngem_game.game_time_minutes` (0–1439) to a slot:

| Slot | Game time | Real-world analogue |
|---|---|---|
| `night` | 00:00–06:00 (0–360 min) | Sleeping, off-duty |
| `morning` | 06:00–12:00 (360–720 min) | Opening, working |
| `afternoon` | 12:00–18:00 (720–1080 min) | Peak activity |
| `evening` | 18:00–24:00 (1080–1440 min) | Winding down, social |

All slot values are `world_entities.id` strings. Missing slots fall back to `home_location_id`.

**Full routine example:**
```jsonc
"routine": {
  "morning":   "loc_karkill_harbour",
  "afternoon": "loc_karkill_harbour",
  "evening":   "loc_karkill_guild_hall",
  "night":     "loc_karkill_workers_district"
}
```

**Partial routine (NPC only moves in the evening):**
```jsonc
"routine": {
  "evening": "loc_karkill_tavern"
}
```
Morning, afternoon, and night will fall back to `home_location_id`.

**No routine:**
```jsonc
"routine": null
```
NPC stays at `home_location_id` all day. Simple option for stationary NPCs (shopkeepers, guards at a single post).

### Lazy placement

Routine placement is **lazy** — the NPC's `current_location_id` is only updated in the DB when the player is at the same location and the expected/stored locations differ. The DB update is fire-and-forget (non-blocking). This means:

- An NPC may have a stale `current_location_id` in the DB between encounters
- The Architect always sees the *expected* location, computed fresh each turn
- Checking `current_location_id` directly in SQL will show the last-synced value, not the real-time position

---

## `memory`

The Ledger writes to `memory` when meaningful interactions occur. Keep this bounded — the system caps `known_facts` at 8 entries (oldest drop off).

### `last_encounter_summary`

One sentence describing the most recent significant encounter. Overwritten each time the Ledger emits `memory_append`.

```jsonc
"last_encounter_summary": "Player asked about the missing ships and mentioned a grey coat."
```

Write it from the NPC's subjective perspective. Not a plot summary — what the NPC would remember.

### `known_facts`

Things the **player revealed to this NPC**. The Ledger appends to this when the player shares information. Max 8 entries; oldest are dropped.

Initial seeding: put facts the NPC already knows about the world here.

```jsonc
"known_facts": [
  "Three ships have gone missing in the strait this month.",
  "The Compact has ordered a halt to night sailings.",
  "A man in a grey coat was asking about cargo manifests last week."
]
```

**Do not put:** secrets the NPC is hiding, things the NPC knows but the player hasn't told them. Those go in `personality` or `world_lore`.

### `last_encounter_tick`

Set by the Ledger to the current turn number. Used for display purposes. Seed as `null`.

### `relationship_arc`

A short phrase describing the current state of the relationship. Updated by the Ledger as the arc changes.

```jsonc
"relationship_arc": "Stranger. Treats all newcomers with polite suspicion."
```

Seed examples:
- `"Stranger."` — default
- `"Wary acquaintance. Has helped once but doesn't fully trust."` 
- `"Loyal companion. Fought beside the player at the bridge."` 
- `"Known enemy. Remembers the insult at the market."`

---

## `current_task`

An active mission the Ledger assigned to this NPC. Appears in the Architect's context block:

```
Current task: Patrol the docks for suspicious activity.
```

The Ledger sets this via `update_npc` with the `current_task` mutation. To clear a task, the Ledger sends `"current_task": null`.

```jsonc
"current_task": {
  "description": "Deliver a sealed letter to the harbour master before nightfall.",
  "target_location_id": "loc_karkill_harbour",
  "assigned_tick": 14
}
```

- `description` — one sentence, player-visible
- `target_location_id` — where the NPC is headed; the lazy placement system uses this if the task preempts the routine (future enhancement — currently informational only)
- `assigned_tick` — turn number when the task was assigned; useful for detecting stale tasks

Seed `current_task` as `null` unless the NPC starts mid-task.

---

## Minimum viable profile examples

### Stationary shopkeeper
```json
{
  "personality": "Cheerful and loud. Haggles enthusiastically. Gives small discounts to people who compliment his stock.",
  "home_location_id": "loc_karkill_market_north_stall",
  "routine": null,
  "memory": {
    "last_encounter_summary": null,
    "known_facts": [],
    "relationship_arc": "Stranger."
  },
  "current_task": null
}
```

### NPC with a daily routine
```json
{
  "personality": "Quiet and watchful. Speaks in short declarative sentences. Never asks why — only what and where.",
  "home_location_id": "loc_karkill_barracks",
  "routine": {
    "morning": "loc_karkill_gate",
    "afternoon": "loc_karkill_gate",
    "evening": "loc_karkill_barracks",
    "night": "loc_karkill_barracks"
  },
  "memory": {
    "last_encounter_summary": null,
    "known_facts": [
      "The gate has been on high alert since the merchant caravan went missing."
    ],
    "relationship_arc": "Stranger. Professionally suspicious."
  },
  "current_task": null
}
```

### Quest companion
```json
{
  "personality": "Nervous but determined. Overexplains. Keeps her hands busy — fiddles with the strap of her bag when anxious. She has done this before and it went badly.",
  "home_location_id": null,
  "routine": null,
  "memory": {
    "last_encounter_summary": "Met outside Karkill's east gate. She was alone and needed protection.",
    "known_facts": [],
    "relationship_arc": "Dependent and watchful. Has placed her trust in the player because she has no other options."
  },
  "current_task": null
}
```
