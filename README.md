# Katabatak

A tabletop RPG platform with a structured AI Game Master. Live at **[katabatak.com](https://katabatak.com)**.

The core technical challenge: an AI that handles narrative generation, intent parsing, and world-state persistence across thousands of game turns — without hallucinating into the canonical world, blocking a player's response while persisting state, or burning unbounded API budget.

---

## SYNGEM AI Pipeline

Every player message passes through five layers before the narrative response is streamed back:

```text
POST /gm
  │
  ├─ [1] Auto-Hydrator      deterministic — builds ContextBlock from DB
  │       character stats, inventory (tracked/equipped items only), encounter state
  │       NPCs, world entities at current location (with per-player mutation overrides)
  │       improvised entities the Architect created in prior turns
  │       semantic pool tags: Full / Moderate / Low / Critical
  │
  ├─ [2] Lore-Engine         Claude Haiku · temp 0.0 · JSON · Zod validated
  │       classifies action intent: info | task | attack
  │       if requires_check → HALT, return {type:'check_required'} to client
  │
  ├─ [3] Architect           Claude Sonnet · temp 0.5 · SSE streamed
  │       system prompt loaded from DB (versioned, live-editable)
  │       pure narrative — no tools, no JSON, no DB access
  │
  ├─ conversation-service    persists player + assistant turns to DB
  │
  ├─ [4a] Ledger             Claude Sonnet · temp 0.0 · async · JSON · Zod validated
  │        reads completed narrative, emits world-state change actions:
  │        move_character | update_entity | update_npc | create_entity
  │        delete_entity | long_rest | grant_item
  │
  ├─ [4b] State Executor     deterministic — validates and writes Ledger actions to DB
  │        create_entity deduplicates against canonical world_entities first,
  │        falls back to character-scoped improvised_entities
  │
  └─ [5] Scribe              Claude Haiku · async · every 4 turns
          compresses narrative → session summary
          updates quest objectives and key entity IDs on character record
```

Ledger and Scribe are fire-and-forget. The player's SSE stream closes before either runs.

---

## Notable Engineering Decisions

**Zod on all LLM JSON output.** Every agent that outputs JSON (Lore-Engine, Ledger, Scribe) validates it through a `safeParse` schema before touching the DB. Parse failures log a warning and return safe defaults — the pipeline never crashes on a malformed LLM response.

**`improvised_entities` table.** The Architect is a narrative LLM — it invents scene objects. Those land in a character-scoped `improvised_entities` table with a `parent_id` anchoring them to the canonical `world_entities` location. Hallucinations stay per-character; the shared world stays clean. The Auto-Hydrator loads them back on the next turn so the Architect remembers what it created.

**Async Ledger, async Scribe.** World-state persistence and session summarization run after the SSE stream closes. The player sees narrative immediately; the DB catches up in the background. A failing Ledger action never blocks others.

**Model and temperature by purpose.** Intent classification is deterministic (Haiku, temp 0.0). Narrative is creative (Sonnet, temp 0.5). World-state output must be accurate JSON (Sonnet, temp 0.0). Periodic summarization is cheap (Haiku, async, every 4 turns).

**BYOK with per-user budget enforcement.** Players can supply their own Anthropic key. A per-request `Anthropic` client is constructed from the validated header. Token counts are written to `token_usage` after each agent call. A budget guard checks the aggregate against the user's cap before the pipeline runs. The key is never logged or persisted.

**Request ID tracing across all layers.** Every request gets a UUID at the Express entry point, threaded through every log call across all five layers. The admin dashboard aggregates these into a per-request trace drawer showing per-stage wall-clock timing.

**SSE client-disconnect guard.** `req.on('close')` sets a flag the Architect's generator loop checks. If the player navigates away mid-stream, the Claude API call stops rather than running to completion unread.

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui |
| AI Server | Express 5, TypeScript, Anthropic SDK |
| Database | Supabase (PostgreSQL 15 + Auth + RLS) |
| AI Models | Claude Haiku, Claude Sonnet |
| Schema Validation | Zod (forms + all LLM JSON output) |
| Testing | Vitest, Supertest |
| Deploy | Vercel (web), Google Cloud Run (server) |

---

## Repository Layout

```text
packages/
├── web/        # Next.js app — character sheets, game rooms, SYNGEM chat, dev tools
└── server/     # Express GM server — SYNGEM pipeline, Bearer auth, admin dashboard
supabase/
└── migrations/ # 30+ ordered PostgreSQL migrations
database.types.ts  # auto-generated from Supabase schema (pnpm gen-types)
```

---

## Running Locally

```bash
pnpm install
```

`packages/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
GM_API_KEY=
```

`packages/server/.env.local`:

```env
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
GM_API_KEY=
ADMIN_USERNAME=
ADMIN_PASSWORD=
SESSION_SECRET=
```

```bash
pnpm dev   # starts web (3000) + GM server (3001) concurrently
```

---

## Testing

```bash
pnpm test          # run all tests once
pnpm test:watch    # watch mode
```

24 test files across auth middleware, service layer, pipeline agent logic, and combat engine resolution. Tests run against a real Supabase project — no DB mocks.

---

## Dev Tools

With an `is_dev` profile flag set, the app exposes:

- **Prompt builder** — drag-and-drop prompt block editor with live eval against real game data
- **Prompt eval** — run saved prompt versions against stored test inputs, compare outputs with code + model grading. Load and save default test cases per agent
- **Test Suite** — stale-detection dashboard for static test snapshots; one-click refresh re-hydrates context blocks using the test character. Chain test API runs full agent chains (auto-hydrator → lore-engine → architect/ledger) live
- **Combat harness** — test combat resolution against any character + creature combination
- **Log level control** — toggle pipeline verbosity at runtime without a server restart
