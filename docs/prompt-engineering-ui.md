# Prompt Engineering UI

> **Purpose:** Reference for developers building, testing, and iterating on prompts for the AI Game Master. Covers the dev-only tools, the server-side service, and the API layer that connects them.

---

## Overview

Three dev tools live under `/dev/` and are gated behind the `is_dev` profile flag. All proxy through the same server-side Claude service.

```
/dev/prompt-eval      → Agent grader: iterative testing with code + model grading; load/save default test cases
/dev/prompt-builder   → Visual versioned prompt constructor with placeholder injection
/dev/test-manager     → Test Suite dashboard: stale-detection, static snapshot refresh, chain test runner
```

Both tools fail gracefully when the GM server is down or has no API key — they show a red banner or error message rather than crashing.

---

## Architecture

```
Browser (dev page)
    ↓ POST /api/gm/eval      (Next.js proxy route)
    ↓ POST /eval             (GM server endpoint)
    ↓ runEval()              → packages/server/gm/services/claude-service.ts
    ↓ Anthropic.messages.create()
```

Health check flow:
```
Browser → GET /api/gm/health → GET /health (GM server) → { status: 'ok' }
```

---

## Server-Side Service

**File:** [packages/server/gm/services/claude-service.ts](../packages/server/gm/services/claude-service.ts)

A thin wrapper around the Anthropic SDK for one-off and multi-turn eval calls. Intentionally separate from `handler.ts` (which runs the full GM loop with tool use).

```typescript
interface EvalRequest {
  prompt?: string           // Single-turn shorthand — wraps as [{ role: 'user', content }]
  messages?: MessageParam[] // Multi-turn conversation array
  system?: string           // System prompt (optional)
  model?: string            // Defaults to 'claude-sonnet-4-6'
  maxTokens?: number        // Defaults to 1024
  temperature?: number      // 0.0–1.0 (optional, passed directly to Anthropic API)
}

interface EvalResult {
  text: string
  usage: { input_tokens: number; output_tokens: number }
}
```

**Rule:** Always provide either `prompt` (single-turn) or `messages` (multi-turn). If both are omitted the server returns 400.

---

## Server Endpoints

**File:** [packages/server/index.ts](../packages/server/index.ts)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Returns `{ status: 'ok' }` — used by health check route |
| `POST` | `/eval` | Run a one-off or multi-turn Claude call |

### `POST /eval`

**Request body:**
```json
{
  "prompt": "string (single-turn)",
  "messages": [{ "role": "user|assistant", "content": "string" }],
  "system": "optional system prompt string",
  "model": "claude-sonnet-4-6",
  "maxTokens": 1024,
  "temperature": 0.7
}
```

**Response (success):**
```json
{
  "text": "Claude's response text",
  "usage": { "input_tokens": 42, "output_tokens": 120 }
}
```

**Error responses:**
- `400` — no prompt or messages provided
- `401` — Anthropic API key missing or invalid
- `500` — other Claude API error (message included)
- `503` — emitted by the Next.js proxy when the GM server is unreachable

---

## Web Proxy Routes

**Files:** `packages/web/app/api/gm/eval/route.ts`, `packages/web/app/api/gm/health/route.ts`

These routes forward browser requests to the GM server. They exist so the browser never needs to know the server's URL or port.

- If the GM server is unreachable (connection refused, timeout), `eval/route.ts` returns `503` with a human-readable message.
- `health/route.ts` uses a 2-second `AbortSignal.timeout` to avoid hanging the status badge on slow responses.

---

## Prompt Version Storage

**Table:** `prompt_versions`

Prompts are persisted to Supabase. Each save creates a new version row — old versions are never overwritten.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid | Primary key |
| `name` | text | Human-readable label |
| `slug` | text | Agent/sub-agent identifier (e.g. `gm-main`, `npc-narrator`) |
| `version` | integer | Auto-incremented per slug per user |
| `prompt` | jsonb | `SavedPrompt` object (see schema below) |
| `created_at` | timestamptz | |
| `created_by` | uuid | FK to `auth.users` — RLS enforced |

**RLS:** Users can only read and insert their own rows.

### SavedPrompt JSON schema

```typescript
interface SavedPromptBlock {
  kind: 'system' | 'user' | 'assistant'
  label: string
  content: string  // may contain {{type.field}} placeholders
}

interface SavedPrompt {
  blocks: SavedPromptBlock[]
  model: string
  maxTokens: number
  temperature: number
}
```

### Service

**File:** [packages/web/lib/services/prompt-service.ts](../packages/web/lib/services/prompt-service.ts)

```typescript
getPromptSlugs(supabase)                       // string[] — distinct slugs for current user
getLatestPrompt(supabase, slug)                // highest-version row for slug, or null
getPromptVersions(supabase, slug)              // VersionMetaRow[] — all versions newest-first
getPromptByVersion(supabase, slug, version)    // full row for a specific slug+version, or null
savePrompt(supabase, { name, slug, prompt })   // inserts new version, returns row
```

---

## Placeholder System

**File:** [packages/web/lib/prompt-placeholders.ts](../packages/web/lib/prompt-placeholders.ts)

Prompts support runtime data injection using `{{type.field}}` tokens. Tokens are replaced with actual data values at test time (and at runtime in the GM service).

### Syntax

```
You are a GM hosting a game for {{character.name}}.
They are level {{character.level}} and currently {{character.condition_text}}.
They carry a {{item.name}} ({{item.rarity}}).
```

### Available types and fields

| Type | Fields |
| ---- | ------ |
| `character` | `name`, `level`, `class_archetype`, `health_max`, `current_health`, `essence_max`, `current_essence`, `power_max`, `current_power`, `will_max`, `current_will`, `speed`, `background_primary`, `backstory`, `condition_text`, `current_location_region` |
| `item` | `name`, `type`, `subtype`, `damage`, `rarity`, `short_description`, `cost_gold`, `weight` |
| `spell` | `name`, `type`, `subtype`, `damage`, `cost`, `range_m`, `cast_time_min`, `description` |
| `skill` | `name`, `skill_text` |
| `game` | `name`, `session_number`, `is_in_combat` |

### API

```typescript
// Replace all {{type.field}} tokens using data[type][field]
parsePlaceholders(template: string, data: Record<string, Record<string, unknown>>): string

// Return unique type names found across all block content strings
extractUsedTypes(blocks: Array<{ content: string }>): string[]

// Full registry of available types and their field lists
PLACEHOLDER_REGISTRY: Record<string, { label: string; fields: string[] }>
```

Unresolved tokens (type or field not found in `data`) are left as-is.

---

## Prompt Evaluator (`/dev/prompt-eval`)

**File:** [packages/web/app/dev/prompt-eval/page.tsx](../packages/web/app/dev/prompt-eval/page.tsx)

A four-column model grader for iterative prompt testing. Loads a versioned prompt from `prompt_versions`, runs it against one or more user inputs, then grades each output with a second Claude call.

### Layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Header: back link · "Prompt Evaluator" · server status badge                  │
├────────────────┬───────────────────────────┬──────────────────┬───────────────┤
│ COL 1 (224px)  │ COL 2 (flex-1)            │ COL 3 (256px)    │ COL 4 (288px) │
│                │                           │                  │               │
│ Slug picker    │ [+ Add Block]             │ Grader Prompt    │ Config        │
│ Version picker │                           │                  │ · Model       │
│                │ ┌─ Input 1 ─────────────┐ │ Textarea fills   │ · Max tokens  │
│ ── Test Data ─ │ │ textarea              │ │ full column.     │ · Temperature │
│ per type used  │ │ ── model response ──  │ │ System prompt    │               │
│ in the prompt  │ └───────────────────────┘ │ for the grader   │ [Run Eval]    │
│                │ ┌─ Input 2 ─────────────┐ │ model. Receives  │               │
│                │ │ textarea              │ │ <user_input> +   │ ── Output ──  │
│                │ │ ── model response ──  │ │ <model_response> │ Input 1 grade │
│                │ └───────────────────────┘ │ as context.      │ Input 2 grade │
│                │ …                         │                  │ …             │
└────────────────┴───────────────────────────┴──────────────────┴───────────────┘
```

### Col 1 — Prompt loader

1. **Slug dropdown** — lists all slugs from `prompt_versions` for the current user
2. **Version dropdown** — appears after a slug is selected; auto-selects the latest version
3. **Loaded summary** — shows prompt name and block count
4. **Test data pickers** — one dropdown per placeholder type detected in the loaded blocks (e.g. `{{character.name}}` → Character dropdown). Only shown when the prompt actually uses that type.

### Col 2 — User input blocks

Each block is one test case. The user types a freeform input; after a run, the model's response appears as a collapsed preview under the block.

- **Add Block** button adds another test case
- Blocks show status badges during a run: `Model` → `Grading` → `Done` / `Error`
- Minimum one block always present

### Col 3 — Grader prompt

A single textarea for the grader model's system prompt (the rubric). At run time the grader receives:

```
<user_input>
{the block's text}
</user_input>

<model_response>
{Claude's response to that input}
</model_response>
```

If left blank, the run skips the grading step and only shows model responses.

### Col 4 — Config and grader output

| Control | Notes |
|---------|-------|
| Model picker | Sonnet 4.6 / Opus 4.8 / Haiku 4.5 — applies to both main model and grader |
| Max tokens | Number input, clamped to [64, 8192] |
| Temperature | Range slider 0.00–1.00 |
| Run Eval | Disabled until a slug is loaded and at least one block has content |
| Grader output | One result card per input block, rendered as Markdown; shows token usage for both calls |

### Run flow

For each non-empty input block, sequentially:

1. Build `system` by joining all `system`-kind blocks from the loaded prompt (with placeholders resolved)
2. Build `messages` from the non-system blocks + the user input as a final `user` message
3. POST to `/api/gm/eval` → model response
4. If a grader prompt is set: POST to `/api/gm/eval` with grader system + `<user_input>/<model_response>` message → grade
5. Result (or error) shown in col 4 under the matching input number

---

## Prompt Builder (`/dev/prompt-builder`)

**File:** [packages/web/app/dev/prompt-builder/page.tsx](../packages/web/app/dev/prompt-builder/page.tsx)

A visual, three-column editor for constructing multi-turn prompts as composable blocks, with version storage and placeholder-based runtime injection.

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Header: back link · "Prompt Builder" · server status badge                 │
├──────────────────┬────────────────────────────────────┬────────────────────┤
│ LEFT INJECTOR    │ MIDDLE CANVAS                      │ RIGHT PANEL        │
│ (fixed 208px)    │ (flex-1, scrollable)               │ (fixed 384px)      │
│                  │                                    │                    │
│ Inject Field     │ [+ System] [+ User] [+ Assistant]  │ Save / Load        │
│                  │ ── sticky add-block bar ──         │ · New button       │
│ ▼ Character      │                                    │ · Slug dropdown    │
│   .name          │ Sorted, drag-and-drop blocks       │ · Name input       │
│   .level         │ Each block: drag handle,           │ · Slug input       │
│   .class_…       │ delete button, editable textarea   │ · Save button      │
│   …              │                                    │                    │
│ ▶ Item           │ Empty state: dashed border         │ Config             │
│ ▶ Spell          │ with instructions                  │ · Model picker     │
│ ▶ Skill          │                                    │ · Max tokens       │
│ ▶ Game           │                                    │ · Temperature      │
│                  │                                    │                    │
│ (scrollable)     │                                    │ Tester             │
│                  │                                    │ · System preview   │
│                  │                                    │ · Messages preview │
│                  │                                    │ · Test data pickers│
│                  │                                    │ · Run button       │
│                  │                                    │ · Response panel   │
└──────────────────┴────────────────────────────────────┴────────────────────┘
```

### Block types

| Kind | Color | Role in assembled prompt |
| ---- | ----- | ------------------------ |
| `system` | amber | Joined with `\n\n` → `system` param |
| `user` | default/foreground | `messages[n].role = 'user'` |
| `assistant` | cyan | `messages[n].role = 'assistant'` (prefill) |

All block kinds use editable textareas. Content may contain `{{type.field}}` placeholders.

### Block data model

All canvas state is local. Blocks live in `useState<Block[]>`.

```typescript
interface Block {
  id: string        // crypto.randomUUID()
  kind: BlockKind   // 'system' | 'user' | 'assistant'
  label: string     // Display label, e.g. "System" or "User"
  content: string   // Editable text, may contain {{type.field}} tokens
}
```

### Drag and drop

Uses `@dnd-kit/sortable` with `verticalListSortingStrategy`. Drag handle is the `GripVertical` icon on each block header. The `PointerSensor` has an activation distance of 6px to prevent accidental drags when clicking into text areas.

`DragOverlay` renders a `BlockOverlay` component (not `SortableBlock`) to avoid calling `useSortable` outside a `SortableContext`.

### Left column — Field injector

Accordion-style list of data types from `PLACEHOLDER_REGISTRY`. Clicking a type header expands it to show its injectable fields as clickable pills.

- Each pill appends `{{type.field}}` to the content of the currently focused block
- Pills are disabled (dimmed) when no block has been focused yet
- Focus is tracked via `focusedBlockId` state — it persists after the textarea loses focus so the user can click a pill without losing their target block

### Right column — Save / Load

- **New** button: clears the canvas and resets name/slug inputs
- **Load dropdown**: lists all distinct slugs saved by the current user; selecting one loads the most recent version (`getLatestPrompt`) and populates all fields
- **Name** / **Slug** inputs: name is a human label; slug is auto-lowercased and hyphenated
- **Save New Version**: calls `savePrompt()` which inserts a new row with `version = MAX(existing) + 1`; shows a brief "Saved v{n}" confirmation

### Right column — Config

| Control | Notes |
| ------- | ----- |
| Model picker | Sonnet 4.6 / Opus 4.8 / Haiku 4.5 |
| Max tokens | Number input, clamped to [64, 8192] |
| Temperature | Range slider 0.00–1.00, displayed with 2 decimal places |

All three values are stored in `SavedPrompt` when saving.

### Right column — Tester

On every render, `extractUsedTypes(blocks)` scans all block content for `{{type.field}}` tokens and returns the unique type names found.

| Element | Behavior |
| ------- | -------- |
| System preview | Collapsed by default; click to expand raw system block content |
| Messages preview | Collapsed by default; click to expand raw message block content |
| Test data pickers | One dropdown per detected type — loads real DB instances (characters/items/spells/skills) |
| Run button | Enabled when: server online, at least one message block, last message is `user` kind and non-empty |
| Response panel | Rendered as Markdown; shows token usage |

**Run flow:**

1. `parsePlaceholders()` replaces all `{{type.field}}` tokens in every block using the selected test instances
2. System blocks are joined with `\n\n` → `system` param
3. Remaining blocks become `messages` array
4. POST to `/api/gm/eval` with `{ messages, system, model, maxTokens, temperature }`

---

## Prompt Test Suite

### Overview

The Test Suite adds a persistent, versioned test library for all five SYNGEM agent prompts. Two categories of tests are supported:

- **Static tests** — a fully rendered snapshot of every context block (system prompt + hydrated character/world context) frozen at a point in time. Stored in the `prompt_test_cases` table tagged with the `slug_version` that produced them. Cheap to run (no LLM calls), but must be refreshed when prompts change.
- **Chain tests** — test definitions that run the full upstream agent chain live at test time (e.g. architect re-runs lore-engine first, then passes its output to the architect). Chain test results are not stored.

---

### DB Table: `prompt_test_cases`

**Migration:** `supabase/migrations/20260611000000_add_prompt_test_cases.sql`

**RLS:** All operations (SELECT/INSERT/UPDATE/DELETE) require `profiles.is_dev = true` for the calling user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `slug` | text | Agent slug (`lore-engine`, `architect`, `ledger`, `scribe`, `character-builder`) |
| `slug_version` | integer | `prompt_versions.version` at the time of generation |
| `test_type` | text | `static` or `chain` |
| `label` | text | Human-readable test name |
| `blocks` | jsonb | `HydratedBlock[]` — full rendered snapshot for static; empty for chain |
| `player_input` | text | The player input string for this test case |
| `expected_output` | jsonb | Per-agent expected fields (action_type/pool for Lore-Engine, actions array for Ledger, etc.). Null for Architect |
| `is_default` | boolean | Whether this is a pinned default test case (shown in the grader's "Load Defaults" button) |
| `generated_at` | timestamptz | When the snapshot was generated |
| `generated_by` | uuid | FK to `auth.users` |

`HydratedBlock` shape:
```typescript
{ blockId: string; status: 'loading' | 'loaded' | 'empty' | 'placeholder' | 'idle'; content: string | null }
```

---

### Test Manager Page (`/dev/test-manager`)

**File:** [packages/web/app/dev/test-manager/page.tsx](../packages/web/app/dev/test-manager/page.tsx)

Auth pattern: same as `/dev/users` — checks `profiles.is_dev` on mount, redirects to `/dashboard` if false.

**UI — grid of 5 agent cards** (one per slug):

```
┌────────────────────────────────────────────────┐
│ AGENT SLUG              v12 (current)           │
│ Last snapshot: lore-engine v11 · 3h ago        │
│ ┌────────┐                                      │
│ │ STALE  │  [Refresh]                           │
│ └────────┘                                      │
└────────────────────────────────────────────────┘
```

- **Green "CURRENT" badge** — `last_test_slug_version == current_prompt_version`
- **Red "STALE" badge** — mismatch, or no defaults defined yet
- **Refresh button** — opens a confirmation modal ("This will call the GM server and incur LLM costs. Continue?"), then calls `POST /api/dev/test-cases/refresh`
- Timestamps rendered as relative time ("3h ago", "2d ago")

---

### API Routes

#### `GET /api/dev/test-cases?slug=<slug>&default=<bool>`

**File:** [packages/web/app/api/dev/test-cases/route.ts](../packages/web/app/api/dev/test-cases/route.ts)

Returns test cases for a slug. Pass `default=true` to filter to `is_default = true` records only. Response is `PromptTestCase[]` ordered by `generated_at DESC`.

**Auth:** `is_dev = true` required.

#### `POST /api/dev/test-cases`

**File:** [packages/web/app/api/dev/test-cases/route.ts](../packages/web/app/api/dev/test-cases/route.ts)

Replaces all `is_default = true` records for a slug with a new set.

**Request body:**
```json
{
  "slug": "lore-engine",
  "slugVersion": 12,
  "blocks": [{ "blockId": "...", "status": "loaded", "content": "..." }],
  "testCases": [
    { "label": "Test 1", "playerInput": "I attack the bandit", "testType": "static", "expectedOutput": { "action_type": "attack" } }
  ]
}
```

Deletes existing defaults first, then inserts the new ones. Returns the inserted rows.

#### `POST /api/dev/test-cases/refresh`

**File:** [packages/web/app/api/dev/test-cases/refresh/route.ts](../packages/web/app/api/dev/test-cases/refresh/route.ts)

Re-hydrates context blocks for all `is_default = true` records for a slug using the `TEST_CHARACTER_ID` env var. Updates `blocks`, `slug_version`, and `generated_at` on all matching rows.

**Request body:** `{ "slug": "architect" }`

**Requirements:**
- `TEST_CHARACTER_ID` must be set in `packages/web/.env.local`
- At least one default test case must already exist (create them in the grader first, then save as default)
- GM server must be reachable (`GM_SERVER_URL` + `GM_API_KEY`)

**Error responses:**
- `400` — unknown slug
- `422` — no default test cases defined for this slug
- `500` — `TEST_CHARACTER_ID` not set, or DB error

**Response:**
```json
{ "slug": "architect", "slug_version": 12, "blocks_count": 4 }
```

#### `POST /api/dev/chain-test-run`

**File:** [packages/web/app/api/dev/chain-test-run/route.ts](../packages/web/app/api/dev/chain-test-run/route.ts)

Runs the full agent chain up to (and including) the target slug and returns the final output live. Results are not stored.

**Chain dependency order:**
- `lore-engine` — runs alone
- `architect` — runs lore-engine first, passes its JSON as mechanical context
- `ledger` — runs lore-engine then architect, passes architect narrative as its input
- `scribe`, `character-builder` — run alone

**Request body:**
```json
{ "slug": "ledger", "playerInput": "I attack the bandit", "characterId": "optional-uuid" }
```

`characterId` falls back to `TEST_CHARACTER_ID` if not provided.

**Response:**
```json
{
  "output": "...final agent text...",
  "blocks": [{ "blockId": "...", "status": "loaded", "content": "..." }],
  "chainOutputs": { "lore-engine": "...", "architect": "..." },
  "usage": { "input_tokens": 1200, "output_tokens": 340 }
}
```

---

### Load / Save Defaults in the Agent Grader

Two icon buttons appear in the Col 2 toolbar of the Prompt Evaluator when a slug is selected:

| Button | Action |
|--------|--------|
| **Load Defaults** (database icon) | Fetches `GET /api/dev/test-cases?slug=X&default=true`, overwrites the active `hydratedBlocks` and test cases with the stored snapshot. Also loads the correct prompt version for the snapshot's `slug_version`. |
| **Save as Default** (save icon) | POSTs the current blocks and all test cases to `POST /api/dev/test-cases`, replacing the stored defaults for that slug. |

A feedback message ("Defaults loaded" / "Saved as default") appears inline next to the buttons for 3 seconds after each action.

---

## Dev Access

All three pages are gated: on mount they check `profiles.is_dev` for the current user. Non-dev users are redirected to `/dashboard`.

The devtools section on the dashboard links to all three pages:

**File:** [packages/web/features/devtools/components/devtools-section.tsx](../packages/web/features/devtools/components/devtools-section.tsx)

---

## Adding New Placeholder Types

1. Add an entry to `PLACEHOLDER_REGISTRY` in `packages/web/lib/prompt-placeholders.ts`
2. Add a corresponding case to `instanceOptions()` in `prompt-builder/page.tsx` that returns `{ id, label }` pairs
3. Add a case to `setTestInstance()` that looks up the matching row from loaded state
4. Load the data in the `init()` effect if not already fetched
5. Update this doc

## Adding New Block Types

1. Add the new kind to `BlockKind` union in `prompt-builder/page.tsx`
2. Add an entry to `BLOCK_CONFIG` (icon, colors)
3. Add the kind to the add-block bar render loop (`["system", "user", "assistant"]`)
4. Update prompt assembly in `handleRun()` if it should contribute to `system` or `messages` differently
5. Update the `SavedPromptBlock` interface in `prompt-service.ts`
6. Update this doc

---

## Environment Requirements

The eval tools require the GM server to be running with a valid `ANTHROPIC_API_KEY`:

```bash
# Start both web + server
pnpm dev

# Or server only
node --env-file=.env.local packages/server/index.ts
```

If `ANTHROPIC_API_KEY` is missing, the server starts fine but `/eval` calls return `401` with an error message shown inline in the UI.
