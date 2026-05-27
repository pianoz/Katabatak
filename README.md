# Katabatak

A tabletop RPG companion platform — [katabatak.com](https://katabatak.com)

Players create characters, join game rooms, and play through sessions managed by a human GM or the **SYNGEM** AI Game Master. The GM server runs as an independent service and handles all AI pipeline work, keeping the Anthropic and Supabase service-role keys off the client entirely.

---

## Stack

| Layer | Tech |
| ----- | ---- |
| Frontend | Next.js 19, TypeScript, Tailwind CSS v4, Radix UI |
| Backend | Express 5, TypeScript, Node.js |
| Database | Supabase (PostgreSQL + Auth) |
| AI | Anthropic SDK — Claude Haiku + Sonnet |
| Testing | Vitest, Supertest |
| Infrastructure | Docker, Google Cloud Run |

---

## Monorepo Structure

```text
packages/
├── web/          # Next.js app — player UI, auth, character sheets, game rooms
└── server/       # Express GM server — SYNGEM pipeline, Bearer auth, admin dashboard
```

Run both together:

```bash
pnpm dev
```

The web app proxies all GM traffic to `localhost:3001`. Set `NEXT_PUBLIC_GM_SERVER_URL` to point elsewhere for staging/prod.

---

## Features

### Player-facing

- Auth via Supabase (email/password)
- Character creation — stats, inventory, skills, spells, conditions
- Dashboard — active games, characters, friend requests, game invites
- Game rooms — join by code, see party members, track session state

### GM-facing (in-game dashboard)

- Characters panel — drag-reorder initiative, grant items/rewards/conditions, kick players
- Items & Spells catalog — create and grant to characters
- Creatures panel — build encounter rosters
- Combat tracker — turn order, active turn management
- Request log — in-memory ring buffer of recent GM server calls

### SYNGEM AI Game Master

- Full 5-layer pipeline (see below)
- Streamed narrative via SSE
- Skill check interruption — pipeline halts, player spends or rolls, pipeline resumes
- Versioned system prompts managed via in-app prompt builder
- Async world-state persistence after every turn

---

## SYNGEM Pipeline

The AI GM runs every player message through five layers:

```text
POST /gm
  │
  ├─ [1] Auto-Hydrator      deterministic — builds ContextBlock from DB
  │       character + inventory + active encounter + NPCs
  │       world entities for current location (with per-player mutation overrides)
  │       semantic pool tags: Full / Moderate / Low / Critical
  │
  ├─ [2] Lore-Engine         Haiku, temp 0.0, JSON
  │       classifies action: info | task | attack
  │       if requires_check → HALT, return {type:'check_required'} to client
  │       if search_objects → execute world entity lookups
  │
  ├─ [3] Style Modulator     deterministic — picks one of 3 prose register files at random
  │
  ├─ [4] Architect           Sonnet, temp 0.5, STREAMED SSE
  │       receives: style + ContextBlock + scribe summary + quests
  │                + lore-engine output + last 4 turns + player input
  │       pure narrative — no tools
  │
  ├─ conversation-service    persists assistant turn to DB
  │
  ├─ [5a] Ledger             Sonnet, temp 0.0, async JSON
  │        reads completed narrative, outputs permanent world-state changes
  │
  ├─ [5b] State Executor     deterministic — validates + writes Ledger output to DB
  │        move_character / update_entity / create_entity / delete_entity
  │
  └─ [6] Scribe              Haiku, async, every 4 turns
          compressed narrative → characters.scribe_summary
          quest objectives → characters.quest_objectives
          key entity IDs → characters.key_entity_ids
```

Each async layer (Ledger, Scribe) is fire-and-forget. Parse errors fall back to safe defaults. A failing state-executor action never blocks others. The player's turn is unaffected.

---

## GM Server Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/gm` | Main pipeline — returns SSE stream or `{type:'check_required'}` |
| `POST` | `/gm/scribe` | Manual Scribe trigger |
| `POST` | `/gm/summarize` | Legacy summarize (no DB write) |
| `POST` | `/eval` | Single-shot Claude eval for dev tools |
| `GET` | `/health` | `{status:'ok'}` |

All routes require a `Bearer <GM_SECRET>` header. Admin routes use session auth.

---

## Environment Variables

### `packages/web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GM_SERVER_URL=http://localhost:3001
GM_SERVER_SECRET=
```

### `packages/server/.env.local`

```env
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GM_SECRET=
SESSION_SECRET=
PORT=3001
```

---

## Testing

```bash
# All tests
pnpm test

# Server tests only (watch mode)
cd packages/server && pnpm test:watch

# CLI REPL against a real character
cd packages/server && pnpm chat <character_id>
```

Tests cover auth middleware, admin routes, character/game/world services, and GM tool execution.

---

## Screenshots

![GM combat page](packages/web/public/GM%20combat%20page.JPG)

![Character sheet](packages/web/public/Character%20sheet.JPG)
