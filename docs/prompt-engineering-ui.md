# Prompt Engineering UI

> **Purpose:** Reference for developers building, testing, and iterating on prompts for the AI Game Master. Covers the two dev-only tools, the server-side service, and the API layer that connects them.

---

## Overview

Two dev tools live under `/dev/` and are gated behind the `is_dev` profile flag. Both proxy through the same server-side Claude service.

```
/dev/prompt-eval      → Quick one-off prompt tester (form-based)
/dev/prompt-builder   → Visual versioned prompt constructor with placeholder injection
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
getPromptSlugs(supabase)              // string[] — distinct slugs for current user
getLatestPrompt(supabase, slug)       // highest-version row for slug, or null
savePrompt(supabase, { name, slug, prompt })  // inserts new version, returns row
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

A single-page form for quick one-off Claude calls. Best for testing system prompts and spot-checking GM responses.

### Features

| Feature | Notes |
|---------|-------|
| Character dropdown | Loads current user's characters from `characters` table |
| Items multi-select | Loads all items from `items` table |
| Spells multi-select | Loads all spells from `spells` table |
| Auto system prompt | Selecting context items builds a formatted system prompt automatically |
| Dirty tracking | Manually editing the system prompt marks it "dirty" — auto-update pauses until Reset |
| Model picker | Sonnet 4.6 / Opus 4.7 / Haiku 4.5 |
| Max tokens | Clamped to [64, 8192] |
| Server badge | Pings `/api/gm/health` on mount |
| Error display | Shows server-offline banner, auth errors, and API errors inline |

### Context assembly

When the user selects a character/items/spells, the page calls `buildContextPrompt()` which produces a Markdown string injected into the system prompt:

```
## Character: Aldric
- Level: 3
- Health: 25/30
...

## Items
- **Thornwhisper Dagger** (weapon, dagger, uncommon, magical) — dmg 4 · 1kg
  A blade carved from petrified thorn.

## Spells
- **Firebolt** (fire, projectile) — dmg 12 · range 30m · cast 1min
```

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
| Model picker | Sonnet 4.6 / Opus 4.7 / Haiku 4.5 |
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

## Dev Access

Both pages are gated: on mount they check `profiles.is_dev` for the current user. Non-dev users are redirected to `/dashboard`.

The devtools section on the dashboard links to both pages:

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
