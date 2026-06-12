<!-- markdownlint-disable-file -->
# SYNGEM — Architecture Reference

> Last meaningful update: 2026-06-13 — NPC Knowledge Hydration Tier (Ticket 6): three-tier NPC context model complete. `buffer_count` column on `npcs` gates knowledge injection. Lore engine emits `participant_buffers` (NL referents) when the player speaks to an NPC; world-service resolves, find-or-spawns, and sets `buffer_count = 5`. Buffers bleed 1/turn; knowledge evicts silently when buffer reaches 0. Location change zeroes all buffers immediately. See [NPC System](#npc-system) for the full three-tier model.

---

## Overview

The GM server is an Express app (port 3001) that implements the **SYNGEM** (Synthetic Game Master) pipeline — a 5-layer system that processes each player message through deterministic context building, mechanical intent parsing, streamed narrative generation, async world-state writeback, and periodic summarization.

The web app never calls Claude directly — it proxies all GM traffic through `POST /api/gm` → `POST /gm` on this server. The server holds the Supabase service role key. The Anthropic API key can be either the server-side `ANTHROPIC_API_KEY` env var (dev/server flow) or a per-user BYOK key supplied via the `X-Anthropic-Key` request header (player flow). See [BYOK.md](./BYOK.md) for the full key lifecycle.

Conversation turns are **persisted server-side** in the `conversation_turns` table. The client no longer maintains or sends `conversationHistory`.

---

## Pipeline Overview

```
Player message (POST /gm)
  │
  ├─ createClaudeClient(anthropicApiKey?)         // per-request client; BYOK key or env var fallback
  ├─ checkBudget(userId)                          // block if token_budget exceeded
  │
  ├─ [1] conversation-service.saveTurn()         // persist player turn to DB
  │
  ├─ [1b] decrementNpcBuffers(gameId, characterId) // bleed all NPC buffer_counts by 1 before hydration
  │
  ├─ [2] auto-hydrator.autoHydrate()             // build ContextBlock
  │       ├ getFullCharacter()
  │       ├ getGameWithMembers() + getActiveEncounter()
  │       ├ getNpcsForGame() + getNpcsForCharacter() → merged, deduped
  │       │   world_entities[type='npc', parent_id=location] → deduped via world_entity_id
  │       │   enrichAndFilterNpcs()
  │       │   ├ lazy routine placement (fire-and-forget DB update)
  │       │   ├ desc from npc.data.long_description / short_description (fallback: personality_profile / small_summary)
  │       │   ├ knowledge: npc.data.knowledge[] — only if buffer_count > 0 (else [])
  │       │   └ filter to player's location + following NPCs → EnrichedNpc[]
  │       ├ quest_templates.description_gm for active quests → activeQuestNotes[]
  │       ├ world_entities + character_entity_mutations (delta resolution)
  │       ├ improvised_entities for current location (character-scoped scene objects)
  │       └ semantic pool text tags (Full/Moderate/Low/Critical)
  │
  ├─ [3] lore-engine.runLoreEngine()             // Haiku, Temp 0.0, JSON
  │       ├ action_type: 'info' | 'task' | 'attack'
  │       ├ requires_check → HALT, return {type:'check_required'} to client
  │       ├ search_objects → execute world entity searches
  │       ├ participant_buffers?: string[] — NL referents of NPCs being spoken to this turn
  │       └ recordTokenUsage() (fire-and-forget if userId present)
  │
  ├─ [3b] applyParticipantBuffers()              // resolve referents → find/spawn → buffer_count = 5
  │       ├ tokenize each referent; score candidates (name/title/smallSummary match)
  │       ├ fail-closed: zero matches → no-op; top scorer wins; ≤2 ties → buffer all
  │       ├ find existing npcs instance (UUID lookup → world_entity_id → spawn fresh)
  │       ├ set buffer_count = 5 on matched instances
  │       └ if any buffered → re-run hydrateNpcs() to inject knowledge into contextBlock
  │
  ├─ [4] style-modulator.pickStyleText()         // random style file
  │
  ├─ [5] architect.streamArchitect()             // Sonnet, Temp 0.5, STREAMED
  │       Context assembled in order:
  │         1. Style-modulator text (cached ephemeral)
  │         2. ContextBlock (character state + location entities + improvised scene objects + combat)
  │         3. Scribe summary (syngem_game.summary)
  │         4. Quest objectives (characters.quest_objectives)
  │         5. Active quest GM notes (quest_templates.description_gm) — GM only, never revealed
  │         6. Lore-Engine result + check resolution
  │         7. Last 4 conversation turns (from DB)
  │         8. New player input
  │       → Chunks streamed as SSE to client
  │       → recordTokenUsage() via stream.finalMessage().usage (after stream closes)
  │
  ├─ conversation-service.saveTurn()             // persist assistant turn to DB
  │
  ├─ [async] ledger.runLedger()                  // Sonnet, Temp 0.0, JSON
  │             → recordTokenUsage() (fire-and-forget)
  │             → state-executor.executeStateChanges()
  │               ├ move_character → updateCharacter() + clearNpcBuffers() (evict knowledge on scene change)
  │               ├ update_entity
  │               ├ update_npc → updateNpcMutations()
  │               ├ create_entity → dedup check: world_entities → improvised_entities → insert
  │               ├ delete_entity → character_entity_mutations
  │               └ grant_item → items (upsert template) + character_inventory
  │
  └─ [async, every 4 turns] summary.runScribe()  // Haiku, Temp 0.5
          ├ Fetches quest_templates.stages for active quests (stage hints)
          ├ Section 1: compressed narrative → syngem_game.summary
          ├ Section 2: quest_updates → characters.quest_objectives
          │   ├ advances current_stage based on narrative + stage completion_hints
          │   ├ preserves grants_applied (Quest Engine owns that field)
          │   └ returns completed_quest_ids for handler
          ├ Section 3: key entity IDs → characters.key_entity_ids
          ├ recordTokenUsage() (fire-and-forget)
          └ returns { completedQuestIds } to handler

  └─ [async, post-Scribe] quest-engine.applyQuestCompletionGrants()
          └ fires for each newly completed quest: +skill_points, +denarius, +items
```

---

## Check Interruption Flow

When the Lore-Engine determines an action requires a pool check, execution halts **before the Architect runs**. The server returns JSON instead of SSE:

```json
{ "type": "check_required", "difficulty": 20, "pool": "Power", "check_description": "Forcing the iron gate" }
```

The client renders an inline panel with two options:
- **Spend from pool** → auto-succeed (no RNG)
- **Roll dice** → client rolls d10, sends result back

The player's resolution is sent in the next request as `checkResolution`:
```typescript
{ choice: 'spend' | 'roll', pool: 'Power' | 'Essence' | 'Will', roll_result?: number }
```

The Architect then incorporates the outcome into its narrative.

---

## Models Used

| Component | Model | Temp | max_tokens | Mode |
|-----------|-------|------|-----------|------|
| Lore-Engine | `claude-haiku-4-5-20251001` | 0.0 | 300 | sync, JSON |
| Architect | `claude-sonnet-4-6` | 0.5 | 1024 | streamed |
| Ledger | `claude-sonnet-4-6` | 0.0 | 500 | async, JSON |
| Scribe | `claude-haiku-4-5-20251001` | 0.5 | 1500 | async, JSON |
| Character Creator | `claude-sonnet-4-6` | 0.9 | 2000 | sync, JSON (pre-game, POST /character-creator) |
| Generic eval | `claude-sonnet-4-6` | — | configurable | sync |

---

## Layer 1: Auto-Hydrator (`gm/auto-hydrator.ts`)

Deterministic function. Builds a `ContextBlock` from multiple parallel DB reads.

**Fetches (all in parallel):**
- `getFullCharacter()` — character + inventory + skills + spells
- `getGameWithMembers()` — game state (multiplayer only; skipped for solo SYNGEM)
- `getActiveEncounter()` — if `game.is_in_combat === true`
- `getNpcsForGame()` — game-scoped NPCs (multiplayer path; empty for solo SYNGEM)
- `getNpcsForCharacter()` — companion NPCs (`following_character_id = characterId`); always fetched regardless of gameId. Deduped and merged with game NPCs before enrichment.
- `quest_templates` — `description_gm` for each active quest → `activeQuestNotes[]`
- `world_entities` — location entities matching character's current location hierarchy
- `character_entity_mutations` — per-character overrides; mutations override base entity descriptions
- `improvised_entities` — character-scoped scene objects at the current location (`parent_id = location_place`). Surfaced to the Architect as `=== SCENE OBJECTS ===`. See [Improvised Entities](#improvised-entities-improvised_entities-table).

**NPC enrichment (`enrichAndFilterNpcs`):**
For each NPC, the Auto-Hydrator computes a routine-based placement using `computeNpcRoutineLocation()` (reads `personality_profile.routine` + current `game_time_minutes` → time slot → location_id). If the NPC's computed location matches the player's location, it appears in context. If the NPC's DB `current_location_id` differs from the computed location, a fire-and-forget update is issued. NPCs with `following_character_id = characterId` appear regardless of location (including companion NPCs with `game_id = null`). The result is `EnrichedNpc[]` — NPCs stripped down to what the Architect needs: name, title, faction, disposition label, last encounter summary, current task, and following status.

**Produces semantic pool tags** (on top of raw numbers):
| Ratio | Tag |
|-------|-----|
| > 75% | `Full` |
| 50–75% | `Moderate` |
| 25–50% | `Low` |
| ≤ 25% | `Critical` |

**Location entity resolution:** Queries `world_entities` using `current_location_building` → siblings at same parent → fallback to `place_context` → fallback to `region_context`. Applies `character_entity_mutations` overrides on `short_description`.

---

## Layer 2: Lore-Engine (`gm/agents/lore-engine.ts`)

Haiku sub-agent. Receives the last 2 turns + serialized `ContextBlock` + player input. Returns strict JSON.

**Slug:** `"lore-engine"` — loaded via `services/prompt-service.ts`. Falls back to `FALLBACK_SYSTEM` if no DB version found.

**Output schema:**
```typescript
{
  action_type: 'info' | 'task' | 'attack'
  requires_check: boolean
  difficulty?: number          // 0–50
  pool?: 'Power' | 'Essence' | 'Will'
  check_description?: string
  search_objects?: Array<{ action: string; target: string; container: string }>
  narrative_notes?: string     // hints passed to Architect
  participant_buffers?: string[] // NL referents of NPCs being directly spoken to this turn
}
```

If `requires_check: true` and no `checkResolution` present → pipeline halts, returns `CheckRequired` to client.

`participant_buffers` is processed immediately after the lore engine returns: each referent is resolved against the candidate NPC set (co-located + following) via token matching on name/title/smallSummary. Matched instances have their `buffer_count` set to 5; the NPC list in `contextBlock` is then re-hydrated so knowledge appears in this turn's Architect context.

**Search behavior differs by action type:**

- `action_type: 'info'` → handler calls `searchLoreInHierarchy(keyword, locationId)` for each search object. This performs a **two-phase hierarchical search**:
  1. **Global entities** (`parent_id IS NULL`) — general lore, history, mechanics. First match returned.
  2. **Location hierarchy** — searches within the player's current `location_place`, escalating to region then nation if nothing found. Up to 3 results (randomly sampled if more). Returns `long_description`.
  - If nothing found at any level: returns `"What the player asked about is unknown"`.
  - All results (global + local) are combined and passed to the Architect as `searchResults`.

- `action_type: 'task'` or `'attack'` with `search_objects` → flat `searchWorldEntities()` RPC call, `short_description`, up to 3 results.

---

## Layer 3: Style Modulator (`gm/style-modulator.ts`)

Deterministic. Reads one of `N` style files at random from `gm/content/`:
- `style_1.txt` — Restrained, observational
- `style_2.txt` — Lyrical, elegiac
- `style_3.txt` — Terse, consequential

Each file contains the same factual payload (Kataba rules, magic, history) written in a different prose register. Adding a `style_4.txt` will automatically be picked up.

To update style content, edit the `.txt` files directly or use the prompt builder to draft, then paste.

---

## Layer 4: Architect (`gm/agents/architect.ts`)

Sonnet. Streamed. **No tools.** Pure narrative generation.

**Slug:** `architect` — loaded via `loadArchitectPrompt()` in `services/prompt-service.ts`. Fetches the latest version of that slug (cached 60 s). Falls back to the style file from `style-modulator.ts` if no DB entry exists for `architect`.

**GM quest notes:** If `contextBlock.activeQuestNotes` is non-empty, the auto-hydrator has fetched `quest_templates.description_gm` for each active quest. These are injected as a system block labeled `=== ACTIVE QUEST CONTEXT (GM ONLY — do not reveal to player) ===`. This gives the Architect the full narrative scope of a quest (what the waystone actually points to, antagonist motivations, hidden truths) without those facts appearing in player-visible quest text.

**Scene objects:** If `contextBlock.improvisedEntities` is non-empty, a `=== SCENE OBJECTS ===` section is added to the character state block listing objects and NPCs that the Architect previously introduced for this character at the current location. This ensures continuity — an object improvised in a prior session will still be referenced as present on subsequent visits.

Returns an `AsyncGenerator<string>` of text chunks. The `handler.ts` yields each chunk to the Express route, which forwards them as SSE events:

```
data: {"chunk": "The gate groaned"}\n\n
data: {"chunk": " under your hands."}\n\n
data: {"done": true}\n\n
```

The Architect receives no tool definitions — all mechanical work happens in the Lore-Engine (pre) and Ledger (post). Its only job is to write.

---

## Layer 5: Ledger + State Executor

### Ledger (`gm/agents/ledger.ts`)
Sonnet. Async (fire-and-forget). Reads the completed Architect narrative and determines if permanent world state changed.

**Slug:** `"ledger"` — loaded via `services/prompt-service.ts`. Falls back to `FALLBACK_SYSTEM` if no DB version found.

Returns a `LedgerOutput[]` array:
```typescript
type LedgerOutput =
  | { action: 'move_character'; destination_entity_id: string }
  | { action: 'update_entity'; entity_id: string; mutations: Record<string, unknown> }
  | { action: 'update_npc'; npc_id: string; mutations: NpcMutations }
  | { action: 'create_entity'; entity: Record<string, unknown> }
  | { action: 'delete_entity'; entity_id: string; replacement_description: string }
  | { action: 'grant_item'; item_name: string; item_type: string; description?: string; quantity?: number }
```

Only records **permanent, world-altering changes** — not narrative flourishes.

**`create_entity` vs `grant_item`:** The Ledger is instructed to distinguish between objects that exist in the world environment (`create_entity`) and items that enter the player's possession (`grant_item`). An improvised chest in a corner → `create_entity`. An NPC handing the player a dagger → `grant_item`.

The Ledger receives the character's current `locationContext` (place, region, nation names) in the user message so it can write more precise entity IDs and descriptions.

`update_npc` is only emitted for semantically significant NPC events: disposition shifts (player bribed/angered/charmed an NPC), revealed information, task assignments, death, or explicit departure. Routine NPC movement is handled deterministically by the Auto-Hydrator and is never a Ledger concern.

### State Executor (`gm/state-executor.ts`)
Deterministic. Validates and executes Ledger output against the DB.

| Action | DB Operation |
|--------|-------------|
| `move_character` | Validates entity is a location type, calls `updateCharacter()` with new location fields; then calls `clearNpcBuffers()` to zero all NPC buffer counts — knowledge evicts immediately on scene transition |
| `update_entity` | Merges `mutations` into existing `world_entities.data` JSON |
| `update_npc` | Calls `updateNpcMutations()` in `world-service.ts` — merges disposition delta (clamped to [-100,100]), overwrites `personality_profile.memory.last_encounter_summary`, appends to `known_facts` (cap 8), updates task/location/alive/following |
| `create_entity` | Three-step dedup: (1) if ID exists in `world_entities` → merge new data only; (2) if ID exists in `improvised_entities` for this character → merge data; (3) otherwise → insert into `improvised_entities` with location context backfilled from character's current position |
| `delete_entity` | Upserts into `character_entity_mutations` with `{hidden: true, short_description: ...}` |
| `grant_item` | Finds or creates an `items` template row by name (case-insensitive); inserts into `character_inventory` with `quantity`, `condition: 100`, `is_equipped: false` |

Errors are logged and swallowed — a Ledger failure never crashes a player turn.

---

## Layer 6: Scribe (`gm/agents/summary.ts` → `runScribe`)

Haiku. Async. Triggered server-side every 4 player turns. **Slug:** `"scribe"` — loaded via `services/prompt-service.ts`. Falls back to `FALLBACK_SYSTEM` if no DB version found. (based on `conversation_turns.turn_number % 4 === 0`).

**Before calling the model**, the Scribe fetches `quest_templates.stages` for all active quests. These stage definitions (with `completion_hints`) are injected into the prompt so the model can accurately detect when a stage has been reached.

**Outputs four things in a single JSON response (`quest_updates` replaces the old flat `quest_objectives`):**
1. `summary` → written to `syngem_game.summary` — exponentially compressed narrative prose. Fed back to Architect as "Story So Far."
2. `quest_updates.objectives` → written to `characters.quest_objectives` — updated array including `current_stage` advancement. The model preserves `grants_applied` (owned by the Quest Engine) and updates `description` (player-facing) and `current_stage` (internal stage tracker).
3. `quest_updates.completed_quest_ids` → returned to `handler.ts` to trigger `applyQuestCompletionGrants()` for any newly completed quests.
4. `key_entity_ids` → written to `characters.key_entity_ids` — entity IDs the player interacted with.

**Return value:** `{ completedQuestIds: string[] }` — handler uses this to fire completion grants post-Scribe.

Can be triggered manually via `POST /gm/scribe` with `{ characterId }`.

---

## Conversation State

Turns are **persisted server-side** in the `conversation_turns` table:

```sql
id, character_id, game_id, role ('player'|'assistant'), content, turn_number, created_at
```

The handler fetches turns directly from DB — the client sends no conversation history. This means:
- History survives page refreshes
- Multiple browser tabs don't diverge
- The Lore-Engine always gets the true last 2 turns; the Architect gets the true last 4. The Agent Grader hydrates a `recent_history` block (last 4 turns) via `POST /gm/hydrate` for display and test runs

**Prompt service (`services/prompt-service.ts`):** Fetches the latest version of any sub-agent's system prompt from `prompt_versions` by slug. Results are cached in memory for 60 seconds. If no DB version exists, the agent falls back to a hardcoded `FALLBACK_SYSTEM` constant. All four sub-agents (Lore-Engine, Architect, Ledger, Scribe) load their prompts through this service.

---

## Server Endpoints

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| `POST` | `/gm` | `handleGMMessage()` | Main pipeline. Returns SSE stream or `{type:'check_required'}` JSON |
| `POST` | `/gm/quest/start` | `applyQuestStartGrants()` | Fires quest start grants (items + companion NPCs). Body: `{ characterId, questId }`. Called by frontend after character creation |
| `POST` | `/gm/summarize` | `summarizeHistory()` | Legacy endpoint. Returns `{summary}` text only (no DB write) |
| `POST` | `/gm/scribe` | `runScribe()` | Manual Scribe trigger. Writes summary + quest + entities to DB |
| `POST` | `/eval` | Claude eval service | Single-shot, no tools — used by dev prompt tools |
| `GET` | `/health` | — | `{ status: 'ok' }` |
| `POST` | `/dev/log-level` | `setLogLevel()` | Dev only. Sets in-memory log level. Body: `{ level: 'verbose' \| 'errors+' \| 'errors' \| 'silent' }` |

---

## BYOK Architecture

Players supply their own Anthropic API key. The key is stored in the browser's `localStorage` only and is never written to the database.

### Request flow

```
Browser localStorage
  → X-Anthropic-Key HTTP header (HTTPS)
    → Next.js /api/gm (in-memory, not logged)
      → GM server index.ts (in-memory, not logged)
        → createClaudeClient(anthropicApiKey?)
          → one Anthropic instance per request
            → discarded after request completes
```

If no `X-Anthropic-Key` header is present, `createClaudeClient()` falls back to `process.env.ANTHROPIC_API_KEY` — the original dev/server-side flow.

### Client instantiation

Previously each agent module held a **module-level singleton** (`const client = new Anthropic()`). This has been replaced with a **per-request client** created once in `handler.ts` and passed as an optional `client?` parameter to every agent function. The agent falls back to `createClaudeClient()` with no argument if no client is passed (supports isolated unit tests and CLI usage).

### Token tracking

After each agent call, `recordTokenUsage()` is called fire-and-forget with the `response.usage` counts. For the streaming Architect, usage is captured via `stream.finalMessage().usage` after the generator is fully consumed. The write goes to `token_usage` (user_id, character_id, agent name, model, input/output counts). **The API key is never a parameter to this function.**

### Budget enforcement

`checkBudget(userId)` runs at the top of the handler (after ownership check, before everything else). It:
1. Reads `profiles.token_budget` — `null` means unlimited.
2. Aggregates `SUM(input_tokens + output_tokens)` from `token_usage` for the user.
3. If `currentUsage >= budgetCap`, yields a budget error message and halts the pipeline.

### Audit files

| File | Purpose |
|------|---------|
| `gm/claude-client.ts` | `createClaudeClient(apiKey?)` — the only place an `Anthropic` instance is constructed |
| `gm/record-token-usage.ts` | `recordTokenUsage()` — writes token counts only, never the key |
| `gm/budget-guard.ts` | `checkBudget(userId)` — reads cap + aggregate, returns `allowed` bool |

See [BYOK.md](./BYOK.md) for the full security narrative and what NOT to log.

---

## Database Tables (New)

### `token_usage` (new — BYOK)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users (ON DELETE CASCADE) |
| `character_id` | uuid? | FK → characters (ON DELETE SET NULL) |
| `agent` | text | `'lore-engine'` \| `'architect'` \| `'ledger'` \| `'scribe'` \| … |
| `model` | text | Anthropic model ID |
| `input_tokens` | integer | |
| `output_tokens` | integer | |
| `created_at` | timestamptz | |

RLS: authenticated users can SELECT their own rows. All inserts are performed by the GM server via the service role (bypasses RLS). No UPDATE/DELETE policies — append-only.

### New column on `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `token_budget` | integer? | `null` = unlimited. Min 1,000 enforced at the API route level. |

---

---

## Improvised Entities (`improvised_entities` table)

Architect hallucinations that introduce new objects, NPCs, or environmental features are embraced as world-building — but they must not pollute the shared `world_entities` table with per-character noise. The `improvised_entities` table stores character-scoped creations.

### Design

- **Composite PK `(character_id, id)`** — the same entity slug (e.g. `item_obsidian_vial`) can exist independently for different characters without collision.
- **`parent_id → world_entities.id`** — improvised entities are always anchored to a canonical location. The State Executor backfills `parent_id` from the character's `location_place` when the Ledger doesn't include it.
- **`world_entities` stays canonical** — only seeded / admin-created content lives there. `create_entity` checks it first; if the ID already exists there it merges data instead of creating a duplicate.
- **Read path** — the Auto-Hydrator queries `improvised_entities` filtered to the current location and character, surfacing them as `ContextBlock.improvisedEntities`.
- **Write path** — `state-executor.createEntity()` only writes to `improvised_entities`. If the Architect references an object that was previously created, the existing row is updated (merge semantics).

### Schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(64) | Part of composite PK; snake_case slug |
| `character_id` | uuid | Part of composite PK; FK → `characters.id` ON DELETE CASCADE |
| `name` | varchar(255) | |
| `type` | entity_type | Reuses `world_entities` enum: `nation\|region\|place\|location\|npc\|item` |
| `parent_id` | varchar(64)? | FK → `world_entities.id` ON DELETE SET NULL; anchors to canonical location |
| `nation_context` | varchar(255)? | Denormalized from character's location |
| `region_context` | varchar(255)? | Denormalized from character's location |
| `place_context` | varchar(255)? | Denormalized from character's location |
| `data` | jsonb | Descriptions, flags, etc. |
| `created_at` | timestamptz | |

Migration: `20260601000000_add_improvised_entities.sql`

RLS: authenticated users SELECT (all rows; filtered by character_id in application code). GM server writes via service role (bypasses RLS).

---

### `prompt_versions` (updated)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Human-readable label |
| `slug` | text | Agent identifier. System prompt slugs: `lore-engine`, `architect`, `ledger`, `scribe`, `character-builder`. Evaluator slugs: `lore-engine-evaluator`, `architect-evaluator`, `ledger-evaluator`, `scribe-evaluator`, `character-builder-evaluator` |
| `version` | integer | Auto-incremented per slug per user |
| `prompt` | jsonb | `{ blocks: [{kind, label, content}], model, maxTokens, temperature }` |
| `description` | text? | Optional description of what this version does |
| `created_at` | timestamptz | |
| `created_by` | uuid | FK → auth.users |

---

### `conversation_turns`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `character_id` | uuid | FK → characters |
| `game_id` | uuid? | FK → games |
| `role` | text | `'player'` or `'assistant'` |
| `content` | text | Full message content |
| `turn_number` | integer | Monotonically increasing per character |
| `created_at` | timestamptz | |

### New columns on `characters`
| Column | Type | Written by |
|--------|------|-----------|
| `scribe_summary` | text | Scribe (every 4 turns) |
| `quest_objectives` | jsonb | Scribe |
| `key_entity_ids` | text[] | Scribe |
| `ai_game` | boolean | Feature flag |
| `gm_history` | jsonb | Legacy — superseded by `conversation_turns` |

---

## Dev Logging (`gm/logger.ts`)

All pipeline diagnostic output goes through `synLog(tag, msg, detail?)`. In production (`NODE_ENV=production`) the function is a no-op. In dev, it appends to a daily rotating log file:

```
packages/server/logs/syngem-YYYY-MM-DD.log
```

The directory is created automatically on first write. Log files are gitignored.

**Log entry format:**
```
2026-05-27T14:23:01.456Z [LORE-ENGINE] ✓ action:task requires_check:false notes:"player moves north"
              {
                "action_type": "task",
                "requires_check": false,
                "narrative_notes": "player moves north"
              }
```
A blank line is inserted before each new pipeline request (`[HANDLER] → request`) for visual separation.

**Log levels** — controlled at runtime via `setLogLevel()`:

| Level | What is written |
| ------- | --------------- |
| `verbose` | Everything — all `synLog` calls including `detail` blocks |
| `errors+` | Lines starting with `⚠`/`✗`, plus any call with a `detail` block (the parsed JSON outputs) |
| `errors` | Only lines starting with `⚠` or `✗` |
| `silent` | Nothing |

Default level: `verbose`.

**Changing the level at runtime:**

- Dashboard: the **Log Level** radio group in the dev section (visible when dev mode is toggled on, `isDev` flag required)
- Direct call: `POST /dev/log-level` with `{ "level": "errors+" }`
- The setting is stored in localStorage and synced to the server on page load, so it survives refreshes

The chosen level is stored in the express process's memory — restarting the server resets it to `verbose`.

---

## Failure Modes

- **Lore-Engine returns bad JSON** — `runLoreEngine()` catches parse errors and falls back to `{ action_type: 'task', requires_check: false }`. The full raw model response is written to the log file. Pipeline continues.
- **Architect stream fails mid-way** — partial text is already sent to the client. The handler catches and sends `{"error": "GM handler failed"}` as the final SSE event.
- **Ledger returns bad JSON or empty** — `runLedger()` returns `[]`. State Executor is never called. The full raw model response is written to the log file. Narrative is unaffected.
- **State Executor action fails** — each action is wrapped in try/catch. Failures are written to the log file. One failing action (e.g., entity not found) doesn't block others.
- **Scribe / GameTime / Ledger async errors** — all `.catch` handlers write to the log file via `synLog`. Characters retain their previous scribe data until the next successful Scribe run.
- **`prompt_versions` has no entry for a slug** — agents fall back to their hardcoded `FALLBACK_SYSTEM` (Architect falls back to the style-modulator text). Add the slug via the prompt builder to override. For the Architect, the `architect` slug must have at least one version to avoid style-text fallback.

---

## NPC System

NPCs use a **two-tier data model** with a **three-tier context model**. Canonical base state lives in `world_entities` (type `npc`); per-character interaction state lives in `npcs` instances linked by `world_entity_id`. Context injected into the GM changes based on relationship tier:

### Context tiers

| Tier | Field injected | Condition | Lifetime |
|------|---------------|-----------|----------|
| In scene | `short_description` | Shares character's current location | While co-located |
| Part of scene | `long_description` + memory | `following_character_id = characterId` | While following |
| Integral to scene | `knowledge[]` | `buffer_count > 0` on npcs instance | Active conversation + decay window |

Knowledge is never stored in rolling context — it is re-hydrated from DB each turn based on `buffer_count`. When the counter reaches 0, knowledge silently stops loading. No end-of-conversation signal is needed.

### Data layers

- **`world_entities` (base):** Canonical NPC definition shared across all characters. `parent_id` sets the NPC's home location. `data` JSONB holds `short_description`, `long_description`, and (optional) `knowledge[]`. Never modified by game events.
- **`npcs` (instance):** Created lazily on first character interaction. Holds game-scoped state: `disposition_to_players`, `personality_profile` (memory, routine, tasks), `following_character_id`, `data.knowledge[]` (per-character things learned), and `buffer_count` (conversation proximity counter). `world_entity_id` FK links back to the base entity.

### Data model

NPC display descriptions live in `data: Json` (`NpcData` interface), present on both `world_entities` and `npcs`:

```json
{
  "short_description": "A weathered roadwarden with a crossbow slung over one shoulder.",
  "long_description": "Tomas is gruff and suspicious of outsiders, but loyal to those who prove themselves...",
  "knowledge": [
    "Gave the player directions to the Needle in exchange for coin",
    "Suspects the player is hiding something"
  ]
}
```

`knowledge` is per-character — things a specific character has learned about this NPC through interaction. Appended by Ledger `update_npc` mutations (`knowledge_append`). There is no cap currently.

Routine, memory, and tasks still live in `personality_profile: Json` on the `npcs` instance:

```json
{
  "personality": "Gruff and suspicious of outsiders.",
  "home_location_id": "loc_karkill_barracks",
  "routine": {
    "morning":   "loc_karkill_mess_hall",
    "afternoon": "loc_karkill_training_grounds",
    "evening":   "loc_karkill_flounder_inn"
  },
  "memory": {
    "last_encounter_summary": "Player asked about the stolen crown. Guard was unhelpful.",
    "known_facts": ["Player is hunting the crown", "Player has 200 gold"],
    "last_encounter_tick": 42,
    "relationship_arc": "indifferent → suspicious"
  },
  "current_task": {
    "description": "Patrol the docks for suspicious activity",
    "target_location_id": "loc_karkill_docks",
    "assigned_tick": 120
  }
}
```

`memory` is bounded — `last_encounter_summary` overwrites on each significant interaction; `known_facts` caps at 8 entries (oldest drop off). No verbatim history is stored.

### Lazy simulation (Anti-Skyrim)

NPCs are not simulated in real time. The Auto-Hydrator computes a plausible location on demand:

1. `game_time_minutes` maps to a time slot: `night` (0–359), `morning` (360–719), `afternoon` (720–1079), `evening` (1080–1439).
2. The NPC's `routine[slot]` gives the expected location. Falls back to `home_location_id`, then to `current_location_id`.
3. If the expected location matches the player's location, the NPC appears in context. A fire-and-forget DB update keeps `current_location_id` current.
4. NPCs whose `following_character_id = characterId` appear in every location context regardless of routine.
5. NPCs in `world_entities` with `type='npc'` and `parent_id = locationPlace` are also surfaced — as virtual display objects if no `npcs` instance exists, or as the real instance if one does (looked up via `world_entity_id`). Real instances win in deduplication.

NPCs out of the player's view cease to exist in the simulation until the player encounters them again.

### Lazy instance spawning

`npcs` instances are **never created at hydration time**. When the Ledger emits `update_npc` with a `npc_id` that is a `world_entities` string ID (not a UUID), `updateNpcMutations()` in `world-service.ts`:

1. Tries to find an existing instance via `getNpcByWorldEntityId(npcId, gameId)`.
2. If none found, calls `spawnNpcInstanceFromWorldEntity(npcId, gameId)` — copies `name`, `data`, and location from the base entity, inserts into `npcs`, returns the new UUID.
3. Continues applying mutations to the real instance.

The base `world_entities` row is never mutated by this process.

### NPC columns

**`world_entities` (base, type = `npc`)**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | snake_case slug, e.g. `roadwarden_tomas` |
| `name` | text | |
| `type` | enum | `npc` |
| `parent_id` | text? | Home location ID |
| `data` | jsonb | `NpcData`: `short_description`, `long_description`, `knowledge[]` |

**`npcs` (instance, per-character)**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Auto-generated on spawn |
| `world_entity_id` | text? | FK → `world_entities.id`; null for NPCs that were never in `world_entities` |
| `game_id` | uuid? | FK → games. **Nullable** — companion NPCs (e.g. Brin) have `game_id = null` |
| `name` | text | Copied from base entity at spawn |
| `title` | text? | |
| `faction` | text? | |
| `current_location_id` | text | Updated lazily by Auto-Hydrator |
| `following_character_id` | uuid? | FK → characters; null = not following |
| `disposition_to_players` | int? | [-100, 100]; updated by Ledger `update_npc` |
| `is_alive` | bool? | |
| `last_seen_tick` | int? | Reserved for future narrative use |
| `data` | jsonb | `NpcData`: `short_description`, `long_description`, `knowledge[]` (per-character) |
| `personality_profile` | jsonb | Routine, memory, tasks — see structure above |
| `buffer_count` | int | Conversation proximity counter. Set to 5 when lore engine detects player addressing this NPC; decremented 1/turn; knowledge injected only while > 0. Zeroed on character location change |
| `attribute_modifiers` | jsonb | Stat overrides for combat |

### Description resolution in enriched context

`enrichAndFilterNpcs()` resolves display descriptions in this order:

- **Long description** (following NPCs): `data.long_description` → `personality_profile.personality` → `null`
- **Short description** (location-sharing NPCs): `data.short_description` → `small_summary` → `null`
- **Knowledge:** `data.knowledge ?? []` — **only if `buffer_count > 0`**; otherwise always `[]`

### Knowledge buffer lifecycle

1. Player's turn starts → `decrementNpcBuffers()` bleeds all instances in game/character scope by 1.
2. `autoHydrate()` builds `contextBlock.npcs` — knowledge present only where `buffer_count > 0`.
3. Lore engine runs → may emit `participant_buffers: ["the blacksmith", "Garrett"]`.
4. `applyParticipantBuffers()` resolves each referent against the current NPC candidate set:
   - Tokenizes referent (drops stop words ≤ 3 chars); scores candidates by token overlap against name/title/smallSummary.
   - Fail-closed: zero score → no-op. Top scorer wins; up to 2 tied scores all buffered.
   - Find-or-spawns the `npcs` instance; sets `buffer_count = 5`.
5. If any buffers were applied → `hydrateNpcs()` re-runs and updates `contextBlock.npcs` so knowledge appears for the Architect this turn.
6. On `move_character` (async, post-stream) → `clearNpcBuffers()` zeroes all buffers; knowledge evicts immediately on scene change.

Decay window: 5 turns. Tune this constant in `applyParticipantBuffers()` if knowledge lingers too long (try 3) or evicts too quickly.

### Assigning tasks and following

- **Task:** Ledger emits `update_npc` with `current_task`. The Architect narrates progress when the player asks; no real simulation occurs.
- **Following:** Ledger emits `update_npc` with `following_character_id = characterId`. Auto-Hydrator includes the NPC in every subsequent turn until cleared.
- **Knowledge:** Ledger emits `update_npc` with `knowledge_append: string[]`. Appended to `data.knowledge` on the `npcs` instance (spawning one first if needed). Knowledge is re-hydrated each turn but only injected into context when `buffer_count > 0`.

---

## Quest Engine (`services/quest-engine.ts`)

The Quest Engine handles mechanical grants triggered by quest events. It runs outside the main pipeline — never blocking a player turn.

### Quest templates (`quest_templates` table)

Each quest is defined as a DB row:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | text | Slug, e.g. `follow_the_waystone` |
| `title` | text | Display name |
| `description_gm` | text | Full GM backstory — injected into Architect context, never shown to player |
| `stages` | jsonb | Array of `{id, title, description, completion_hints[]}` — used by Scribe to detect progression |
| `start_grants` | jsonb | `{items: [{item_id, quantity, condition}], npcs: [{name, title, ...}]}` |
| `completion_grants` | jsonb | `{skill_points, denarius, items: [...]}` |

### `characters.quest_objectives` extended schema

The Scribe writes — and the Quest Engine reads — an extended objective shape:

```typescript
{
  id: string            // quest template slug
  title: string
  status: "active" | "completed" | "failed"
  description: string   // player-facing, updated each Scribe run
  current_stage?: string  // current stage id — advanced by Scribe
  grants_applied?: string[] // ["start", "completion"] — owned by Quest Engine, Scribe never modifies
}
```

### Grant lifecycle

```
syngem-intro.tsx  →  POST /api/gm/quest/start  →  applyQuestStartGrants()
                       ├ fetch quest_templates.start_grants
                       ├ insert items into character_inventory
                       ├ insert NPC with game_id=null, following_character_id=characterId
                       └ mark grants_applied: ["start"] in quest_objectives

handler.ts (post-Scribe)  →  applyQuestCompletionGrants()
                              ├ fetch quest_templates.completion_grants
                              ├ insert bonus items into character_inventory
                              ├ increment characters.unused_skill_points
                              ├ increment characters.denarius
                              └ mark grants_applied: ["start", "completion"]
```

Both functions are **idempotent** — they check `grants_applied` before acting. Safe to call multiple times.

### The Waystone Quest (`follow_the_waystone`)

The first and currently only quest. Seeded by migration `20260529200000_add_quest_engine.sql`.

- **Start grants:** The Waystone item, a worn backpack, travel rations ×3, oilskin tarp, Brin NPC (companion)
- **Stages:** `arrive_in_karkill` → `night_in_town` → `meet_the_greycoats` → `follow_the_needle` → `the_clock_chamber` → `the_battle` → `completed`
- **Completion grants:** 3 skill points, 50 denarius (combat items TBD when combat is implemented)
- **`the_battle` stage:** Placeholder — completion_hints defined but no combat system yet

---

## Extending the Pipeline

### Adding a new style file
Drop a new `style_N.txt` in `gm/content/`. Update `STYLE_COUNT` in `gm/style-modulator.ts`.

### Updating an agent's system prompt
Use the prompt builder at `/dev/prompt-builder`. Save with the agent's slug:

| Agent | System prompt slug | Evaluator prompt slug |
| ----- | ------------------ | --------------------- |
| Lore-Engine | `lore-engine` | `lore-engine-evaluator` |
| Architect | `architect` | `architect-evaluator` |
| Ledger | `ledger` | `ledger-evaluator` |
| Scribe | `scribe` | `scribe-evaluator` |
| Character Creator | `character-builder` | `character-builder-evaluator` |

Evaluator prompts are versioned the same way — edit them in `/dev/prompt-builder` using the evaluator slug. The Agent Grader auto-loads the latest version when you select an agent.

The server loads the highest version for that slug, cached for 60 seconds. To force an immediate reload (e.g. during testing), call `invalidatePromptCache(slug)` from `services/prompt-service.ts`.

### Grading an agent's prompt
Use the **Agent Grader** at `/dev/prompt-eval`.

**How it works:**
1. Select an agent slug + version. The grader shows each agent's block sequence in pipeline order in Column 1 (system / context / history / user-input). Click any LOADED block to inspect its full hydrated content in a modal.
2. Select a SYNGEM character (`ai_game = true`). Each block with `hydrateTables` is fetched via `POST /api/gm/hydrate`:
   - `system` blocks: content from the loaded `prompt_versions` row
   - `recent_history`: last 4 turns from `conversation_turns`
   - `summary`: `syngem_game.summary`
   - `quest_objectives`: active entries from `characters.quest_objectives`
   - `quest_notes`: `activeQuestNotes` (from `quest_templates.description_gm`)
   - Standard context tables: `character`, `inventory`, `location`, `npcs`, `encounter`, `syngem_game`
   - Blocks that return empty are flagged red; optional blocks are flagged as placeholder.
3. Add test cases in Column 2. For agents that produce JSON, set expected output fields:
   - **Lore-Engine:** expected `action_type`, `requires_check`, `pool`
   - **Ledger:** list of expected actions (e.g. `long_rest`, `grant_item + weapon`)
   - **Scribe:** checkboxes for `summary`, `objectives` array, `completed_quest_ids` array
   - **Character Creator:** all 5 required fields checked automatically
   - **Architect:** no code grade (prose output)
4. Click **Run All Tests**. Each test case runs through:
   - **Agent eval** — prompt sent to `POST /api/gm/eval` with the agent's production model/tokens/temp locked
   - **Code grade** — `x/y` fields correct. Bumper-lane aliases count as passing (e.g. `rest` → `long_rest` = pass)
   - **Model grade** — Haiku 4.5 grader (max 200 tokens, temp 0) uses the versioned evaluator prompt for that agent (slug: `<agent>-evaluator`, latest version auto-loaded). Falls back to hardcoded `GRADER_PROMPTS` if no DB version exists. Returns `score/100` + one-line review.

The Run Log in Column 3 appends each run's results with the prompt version used, character name, and per-test grades.

**Grader model configs (locked to production values):**

| Agent | Graded model | Tokens | Temp |
|-------|-------------|--------|------|
| Lore-Engine | `claude-haiku-4-5-20251001` | 300 | 0.0 |
| Architect | `claude-sonnet-4-6` | 1024 | 0.5 |
| Ledger | `claude-sonnet-4-6` | 500 | 0.0 |
| Scribe | `claude-haiku-4-5-20251001` | 1500 | 0.5 |
| Character Creator | `claude-sonnet-4-6` | 2000 | 0.9 |
| Grader (all agents) | `claude-haiku-4-5-20251001` | 200 | 0.0 |

**Client-side bumper lanes** (`packages/web/lib/graders/bumper-lanes.ts`) — a copy of the server-side normalization maps used by the code grader. When the agent output uses an alias that the server would normalize (e.g. `moveto` instead of `move_character`), the code grader still marks it as a pass. Keep this file in sync with `packages/server/gm/bumper-lanes.ts` when adding new aliases.

### Adding a new State Executor action
1. Add to the `LedgerOutput` union type in `gm/types.ts`.
2. Update the Ledger's system prompt in `prompt_versions` (slug: `"ledger"`) to know about the new action.
3. Add the handler function and a new `case` in `executeStateChanges()` in `gm/state-executor.ts`.

### Teaching the bumper lanes (`gm/bumper-lanes.ts`)
Bumper lanes are pre-Zod normalization tables that catch slightly misaligned LLM output and redirect it to the canonical value. `collapse()` strips whitespace and lowercases before lookup, so `"GOLD"`, `"Gold"`, and `" gold "` all match the same entry.

| Table | Used by | Maps to |
| ----- | ------- | ------- |
| `LEDGER_ACTIONS` | `normalizeLedgerAction` | Canonical Ledger action names (e.g. `moveto` → `move_character`) |
| `ITEM_TYPES` | `normalizeLedgerAction` (on `grant_item`) | Canonical item types: `weapon`, `armor`, `consumable`, `misc`, `currency` |
| `NPC_MUTATION_FIELDS` | `normalizeLedgerAction` (on `update_npc`) | Canonical mutation key names (e.g. `addknowledge` → `knowledge_append`) — server-side only |
| `LORE_ACTION_TYPES` | `normalizeLoreEngineRaw` | `info`, `task`, `attack` |
| `LORE_POOLS` | `normalizeLoreEngineRaw` | `Power`, `Essence`, `Will` |
| `QUEST_STATUSES` | `normalizeScribeRaw` | `active`, `completed`, `failed` |

**Currency aliases** — the game uses `denarius` as its currency unit. Both normalizers cover common LLM drift:

- `ITEM_TYPES` maps `gold`, `silver`, `money`, `dollars`, `coin`, `coins`, `denarius`, `denarii`, `currency` → `currency` (used when the LLM emits `grant_item` with a currency-type item)
- `normalizeStatName` in `gm/tools/index.ts` maps the same set → `denarius` column (used when the LLM calls `update_stat` with a currency stat)

To add a new alias: add a lowercase entry to the relevant table and its canonical target. No other changes needed.

### Extending NPC state
- **Display fields** (`short_description`, `long_description`, new player-facing text): add to `NpcData` in `gm/types.ts`. These live in `data` JSONB on both `world_entities` and `npcs`.
- **Interaction/memory fields** (routine, tasks, per-NPC memory): add to `NpcPersonalityProfile` in `gm/types.ts`. These live in `personality_profile` on `npcs` instances only.
- **Ledger-writable fields**: extend `NpcMutations` + `NpcMutationsSchema` Zod + handle in `updateNpcMutations()` in `world-service.ts`. Add bumper-lane aliases to `NPC_MUTATION_FIELDS` in `bumper-lanes.ts` for any new mutation key the LLM might spell differently.
- **New typed columns** (e.g. `buffer_count`): require a migration + `database.types.ts` update.
- **Tuning knowledge decay**: the decay window (5 turns) is the integer passed to `buffer_count = 5` in `applyParticipantBuffers()` in `world-service.ts`. Lower it to 3 for tighter eviction; raise it if knowledge drops out mid-conversation during extended tangents.

### Testing via CLI REPL
```bash
node --env-file=.env.local packages/server/chat.ts <character_id>
```
The REPL streams Architect output to stdout. Check interruptions are printed inline. Commands: `/stats`, `/quit`.

---

## File Map

```
packages/server/
├── index.ts                          # Express app, routes, SSE handling
├── chat.ts                           # CLI REPL for testing
├── logs/                             # Dev log files (gitignored). Created on first synLog call.
│   └── syngem-YYYY-MM-DD.log         # Daily rotating log file
├── gm/
│   ├── handler.ts                    # Pipeline orchestrator
│   ├── logger.ts                     # synLog() + setLogLevel() — dev file logger
│   ├── types.ts                      # All shared types (incl. GMMessageInput.anthropicApiKey)
│   ├── claude-client.ts              # BYOK: createClaudeClient(apiKey?) factory
│   ├── record-token-usage.ts         # BYOK: fire-and-forget token count writes
│   ├── budget-guard.ts               # BYOK: checkBudget(userId) — reads cap + aggregate
│   ├── auto-hydrator.ts              # Layer 1: ContextBlock builder
│   ├── style-modulator.ts            # Layer 3: Style file picker
│   ├── bumper-lanes.ts               # Pre-Zod normalization tables for LLM output (action names, item types, pools, quest statuses, currency aliases)
│   ├── state-executor.ts             # Layer 5b: DB write executor
│   ├── content/
│   │   ├── style_1.txt               # Restrained / observational
│   │   ├── style_2.txt               # Lyrical / elegiac
│   │   └── style_3.txt               # Terse / consequential
│   ├── agents/
│   │   ├── lore-engine.ts            # Layer 2: Intent + mechanics (Haiku)
│   │   ├── architect.ts              # Layer 4: Narrator (Sonnet, streamed)
│   │   ├── ledger.ts                 # Layer 5a: World-state audit (Sonnet, async)
│   │   ├── summary.ts                # Layer 6: Scribe + legacy summarize
│   │   └── npc.ts                    # Legacy NPC dialogue (kept for ref)
│   ├── tools/
│   │   ├── index.ts                  # Tool definitions + executeTool()
│   │   ├── character.ts              # update_stat / restore_pools / update_level
│   │   ├── world.ts                  # search_world_entities / campaign_facts
│   │   └── db.ts                     # Supabase client singleton
│   └── services/
│       └── claude-service.ts         # runEval() for /eval endpoint
├── services/
│   ├── character-service.ts          # getFullCharacter / updateCharacter
│   ├── conversation-service.ts       # saveTurn / getRecentTurns / getTurnCount
│   ├── game-service.ts               # getGameWithMembers / getActiveEncounter
│   ├── prompt-service.ts             # loadSystemPrompt (cached) / invalidatePromptCache
│   ├── world-service.ts              # searchWorldEntities / searchLoreInHierarchy / getNpcsForGame / getNpcsForCharacter
│   ├── quest-engine.ts               # applyQuestStartGrants / applyQuestCompletionGrants (idempotent, DB-backed)
│   ├── effect-processor.ts           # computeSkillModifiers — sums modifier effects from passive skills
│   ├── creature-ai.ts                # Deterministic creature AI — resolveCreatureAction(pools) → { attackChoice, defendChoice }. Will > Power → strong defend + weak attack; Power ≥ Will → strong attack (if affordable) + weak defend. No LLM calls.
│   └── combat-engine.ts              # initCombat / resolvePlayerAttack / resolvePlayerDefend / resolvePlayerEquip / endCombat. CombatActionResult includes net, defValue, totalDamage, totalBlocked for UI feedback
├── middleware/
│   └── auth.ts                       # requireGmKey() Bearer token check
└── admin/
    ├── routes.ts                     # Admin dashboard (session auth)
    └── request-logger.ts             # In-memory request ring buffer
```
