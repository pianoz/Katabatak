# SYNGEM — Architecture Reference

> Last meaningful update: 2026-05-26 — SYNGEM pipeline implementation

---

## Overview

The GM server is an Express app (port 3001) that implements the **SYNGEM** (Synthetic Game Master) pipeline — a 5-layer system that processes each player message through deterministic context building, mechanical intent parsing, streamed narrative generation, async world-state writeback, and periodic summarization.

The web app never calls Claude directly — it proxies all GM traffic through `POST /api/gm` → `POST /gm` on this server. The server holds the Anthropic API key and the Supabase service role key.

Conversation turns are **persisted server-side** in the `conversation_turns` table. The client no longer maintains or sends `conversationHistory`.

---

## Pipeline Overview

```
Player message (POST /gm)
  │
  ├─ [1] conversation-service.saveTurn()         // persist player turn to DB
  │
  ├─ [2] auto-hydrator.autoHydrate()             // build ContextBlock
  │       ├ getFullCharacter()
  │       ├ getGameWithMembers() + getActiveEncounter()
  │       ├ getNpcsForGame()
  │       ├ world_entities + player_entity_mutations (delta resolution)
  │       └ semantic pool text tags (Full/Moderate/Low/Critical)
  │
  ├─ [3] lore-engine.runLoreEngine()             // Haiku, Temp 0.0, JSON
  │       ├ action_type: 'info' | 'task' | 'attack'
  │       ├ requires_check → HALT, return {type:'check_required'} to client
  │       └ search_objects → execute world entity searches
  │
  ├─ [4] style-modulator.pickStyleText()         // random style file
  │
  ├─ [5] architect.streamArchitect()             // Sonnet, Temp 0.5, STREAMED
  │       Context assembled in order:
  │         1. Style-modulator text
  │         2. ContextBlock (character state + location entities + combat)
  │         3. Scribe summary (characters.scribe_summary)
  │         4. Quest objectives (characters.quest_objectives)
  │         5. Lore-Engine result + check resolution
  │         6. Last 4 conversation turns (from DB)
  │         7. New player input
  │       → Chunks streamed as SSE to client
  │
  ├─ conversation-service.saveTurn()             // persist assistant turn to DB
  │
  ├─ [async] ledger.runLedger()                  // Sonnet, Temp 0.0, JSON
  │             → state-executor.executeStateChanges()
  │               ├ move_character
  │               ├ update_entity
  │               ├ create_entity
  │               └ delete_entity → player_entity_mutations
  │
  └─ [async, every 4 turns] summary.runScribe()  // Haiku, Temp 0.5
          ├ Task 1: compressed narrative → characters.scribe_summary
          ├ Task 2: quest objectives → characters.quest_objectives
          └ Task 3: key entity IDs → characters.key_entity_ids
```

---

## Check Interruption Flow

When the Lore-Engine determines an action requires a skill check, execution halts **before the Architect runs**. The server returns JSON instead of SSE:

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
| Generic eval | `claude-sonnet-4-6` | — | configurable | sync |

---

## Layer 1: Auto-Hydrator (`gm/auto-hydrator.ts`)

Deterministic function. Builds a `ContextBlock` from multiple parallel DB reads.

**Fetches:**
- `getFullCharacter()` — character + inventory + skills + spells
- `getGameWithMembers()` — game state
- `getActiveEncounter()` — if `game.is_in_combat === true`
- `getNpcsForGame()` — active NPCs
- `world_entities` — location entities matching character's current location hierarchy
- `player_entity_mutations` — per-player overrides; mutations override base entity descriptions

**Produces semantic pool tags** (on top of raw numbers):
| Ratio | Tag |
|-------|-----|
| > 75% | `Full` |
| 50–75% | `Moderate` |
| 25–50% | `Low` |
| ≤ 25% | `Critical` |

**Location entity resolution:** Queries `world_entities` using `current_location_building` → siblings at same parent → fallback to `place_context` → fallback to `region_context`. Applies `player_entity_mutations` overrides on `short_description`.

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
}
```

If `requires_check: true` and no `checkResolution` present → pipeline halts, returns `CheckRequired` to client.

If `search_objects` present → handler calls `searchWorldEntities()` for each and assembles results into a `searchResults` string for the Architect.

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

**Slugs:** `architect1` – `architect5` — one is selected at random per request via `loadRandomArchitectPrompt()` in `services/prompt-service.ts`. Each call fetches the latest version of whichever slug was chosen (cached 60 s per slug independently). Falls back to the random style file from `style-modulator.ts` if the chosen slug has no DB entry.

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
  | { action: 'create_entity'; entity: Record<string, unknown> }
  | { action: 'delete_entity'; entity_id: string; replacement_description: string }
```

Only records **permanent, world-altering changes** — not narrative flourishes.

### State Executor (`gm/state-executor.ts`)
Deterministic. Validates and executes Ledger output against the DB.

| Action | DB Operation |
|--------|-------------|
| `move_character` | Validates entity is a location type, calls `updateCharacter()` with new location fields |
| `update_entity` | Merges `mutations` into existing `world_entities.data` JSON |
| `create_entity` | Upserts new row into `world_entities` |
| `delete_entity` | Upserts into `player_entity_mutations` with `{hidden: true, short_description: ...}` |

Errors are logged and swallowed — a Ledger failure never crashes a player turn.

---

## Layer 6: Scribe (`gm/agents/summary.ts` → `runScribe`)

Haiku. Async. Triggered server-side every 4 player turns. **Slug:** `"scribe"` — loaded via `services/prompt-service.ts`. Falls back to `FALLBACK_SYSTEM` if no DB version found. (based on `conversation_turns.turn_number % 4 === 0`).

**Outputs three things in a single JSON response:**
1. `summary` → written to `characters.scribe_summary` — exponentially compressed narrative prose. Fed back to Architect as "Story So Far."
2. `quest_objectives` → written to `characters.quest_objectives` — structured array of active/completed/failed objectives. Fed back to Architect.
3. `key_entity_ids` → written to `characters.key_entity_ids` — entity IDs the player interacted with, used by Auto-Hydrator to prioritize what to fetch.

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
- The Lore-Engine always gets the true last 2 turns; the Architect gets the true last 4

**Prompt service (`services/prompt-service.ts`):** Fetches the latest version of any sub-agent's system prompt from `prompt_versions` by slug. Results are cached in memory for 60 seconds. If no DB version exists, the agent falls back to a hardcoded `FALLBACK_SYSTEM` constant. All four sub-agents (Lore-Engine, Architect, Ledger, Scribe) load their prompts through this service.

---

## Server Endpoints

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| `POST` | `/gm` | `handleGMMessage()` | Main pipeline. Returns SSE stream or `{type:'check_required'}` JSON |
| `POST` | `/gm/summarize` | `summarizeHistory()` | Legacy endpoint. Returns `{summary}` text only (no DB write) |
| `POST` | `/gm/scribe` | `runScribe()` | Manual Scribe trigger. Writes summary + quest + entities to DB |
| `POST` | `/eval` | Claude eval service | Single-shot, no tools — used by dev prompt tools |
| `GET` | `/health` | — | `{ status: 'ok' }` |

---

## Database Tables (New)

### `prompt_versions` (updated)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Human-readable label |
| `slug` | text | Agent identifier (`lore-engine`, `architect`, `ledger`, `scribe`) |
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

## Failure Modes

- **Lore-Engine returns bad JSON** — `runLoreEngine()` catches parse errors and falls back to `{ action_type: 'task', requires_check: false }`. Pipeline continues.
- **Architect stream fails mid-way** — partial text is already sent to the client. The handler catches and sends `{"error": "GM handler failed"}` as the final SSE event.
- **Ledger returns bad JSON or empty** — `runLedger()` returns `[]`. State Executor is never called. Silent failure, narrative is unaffected.
- **State Executor action fails** — each action is wrapped in try/catch. One failing action (e.g., entity not found) doesn't block others.
- **Scribe fails** — async fire-and-forget. Error is console-logged. Characters retain their previous scribe data until the next successful Scribe run.
- **`prompt_versions` has no entry for a slug** — agents fall back to their hardcoded `FALLBACK_SYSTEM` (Architect falls back to the style-modulator text). Add the slug via the prompt builder to override. For the Architect, all five `architect1`–`architect5` slugs should have at least one version to avoid style-text fallbacks.

---

## Extending the Pipeline

### Adding a new style file
Drop a new `style_N.txt` in `gm/content/`. Update `STYLE_COUNT` in `gm/style-modulator.ts`.

### Updating an agent's system prompt
Use the prompt builder at `/dev/prompt-builder`. Save with the agent's slug:

| Agent | Slug(s) |
| ----- | ------- |
| Lore-Engine | `lore-engine` |
| Architect | `architect1` – `architect5` (one picked at random per request) |
| Ledger | `ledger` |
| Scribe | `scribe` |

The server loads the highest version for that slug, cached for 60 seconds. To force an immediate reload (e.g. during testing), call `invalidatePromptCache(slug)` from `services/prompt-service.ts`.

### Adding a new State Executor action
1. Add to the `LedgerOutput` union type in `gm/types.ts`.
2. Update the Ledger's system prompt in `prompt_versions` (slug: `"ledger"`) to know about the new action.
3. Add the handler function and a new `case` in `executeStateChanges()` in `gm/state-executor.ts`.

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
├── gm/
│   ├── handler.ts                    # Pipeline orchestrator
│   ├── types.ts                      # All shared types
│   ├── auto-hydrator.ts              # Layer 1: ContextBlock builder
│   ├── style-modulator.ts            # Layer 3: Style file picker
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
│   └── world-service.ts              # searchWorldEntities / getNpcsForGame
├── middleware/
│   └── auth.ts                       # requireGmKey() Bearer token check
└── admin/
    ├── routes.ts                     # Admin dashboard (session auth)
    └── request-logger.ts             # In-memory request ring buffer
```
