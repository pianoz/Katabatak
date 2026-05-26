# Katabatak — Codebase Map

---

## Project Overview

Katabatak is a tabletop RPG web application with a brutalist dark fantasy aesthetic (Darkest Dungeon / MÖRK BORG). It consists of:

- **`packages/web`** — Next.js 16 + React 19 frontend (App Router)
- **`packages/server`** — Node.js AI Game Master backend (Claude + tool use)
- **`supabase/`** — PostgreSQL migrations, RLS policies, seed data

Tech stack: TypeScript strict, Tailwind v4, shadcn/ui, Supabase (auth + DB), Vitest, pnpm workspaces.

---

## Repository Layout

```
katabatak/
├── packages/
│   ├── web/                     # Next.js frontend
│   └── server/                  # GM AI backend
├── supabase/
│   ├── migrations/              # Ordered PostgreSQL migration files
│   └── seed.sql
├── database.types.ts            # Auto-generated Supabase types (pnpm gen-types)
├── vitest.config.ts
├── pnpm-workspace.yaml
└── package.json                 # Root scripts
```

---

## packages/web

### App Router Pages (`app/`)

| Route | File | Notes |
|-------|------|-------|
| `/` | `app/page.tsx` | Public landing + magic-link login |
| `/dashboard` | `app/dashboard/page.tsx` | User dashboard |
| `/characters/new` | `app/characters/new/page.tsx` | Character creation |
| `/characters/[id]` | `app/characters/[id]/page.tsx` | Character sheet |
| `/game/new` | `app/game/new/page.tsx` | Create game session |
| `/game/[id]` | `app/game/[id]/page.tsx` | Active game session (combat, encounters, players) |
| `/dev/skill-tree` | `app/dev/skill-tree/page.tsx` | Skill tree editor (dev flag required) |
| `/dev/items` | `app/dev/items/page.tsx` | Item editor |
| `/dev/spells` | `app/dev/spells/page.tsx` | Spell editor (dev flag required) |
| `/dev/active-skills` | `app/dev/active-skills/page.tsx` | Active skill editor (dev flag required) |
| `/dev/users` | `app/dev/users/page.tsx` | User management |
| `/dev/prompt-builder` | `app/dev/prompt-builder/page.tsx` | Drag-and-drop prompt block editor — save/load/test agent prompts against live GM server |
| `/dev/prompt-eval` | `app/dev/prompt-eval/page.tsx` | Evaluate saved prompt versions against real data |
| `/about` | `app/about/page.tsx` | About page |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error |

### API Routes (`app/api/`)

| Endpoint | File | Notes |
| -------- | ---- | ----- |
| `POST /api/gm` | `app/api/gm/route.ts` | SSE proxy to GM server — streams Architect chunks or returns `{type:'check_required'}` |
| `POST /api/gm/eval` | `app/api/gm/eval/route.ts` | Single-shot Claude eval proxy (used by prompt builder) |
| `GET /api/gm/health` | `app/api/gm/health/route.ts` | GM server liveness check |
| `POST /api/gm/save` | `app/api/gm/save/route.ts` | Persist game save state |
| `POST /api/gm/summarize` | `app/api/gm/summarize/route.ts` | Legacy session history summarization |
| `GET /api/dev/users` | `app/api/dev/users/route.ts` | Admin user list (dev flag required) |
| `DELETE /api/auth/delete-account` | `app/api/auth/delete-account/route.ts` | Delete account |
| `GET /api/auth/callback` | `app/api/auth/callback/route.ts` | Supabase magic-link callback |

Auth middleware: `lib/supabase/middleware.ts` — protects all routes except `/`, `/about`, `/auth/*`.

---

### Feature Modules (`features/`)

Each feature is self-contained: components + hooks, co-located.

#### `features/characters/`

Character sheet, creation, and management.

| File | Purpose |
|------|---------|
| `components/character-creation.tsx` | Full multi-step character creation flow |
| `components/character-dashboard.tsx` | Character sheet hub (stats, pools, inventory) |
| `components/character-card.tsx` | Summary card with inventory, pools, stats |
| `components/character-display-card.tsx` | Read-only character view |
| `components/character-select-modal.tsx` | Pick character for a game |
| `components/attribute-increase-popup.tsx` | Level-up attribute dialog |
| `components/inventory/` | `add-item-modal`, `edit-item-modal`, `inspect-item-modal`, `item-table`, `give-to-ally-modal` |
| `components/spells/` | `add-spell-modal`, `spell-section` |
| `components/actions/` | `action-card`, `action-skill-modal`, `skill-check-panel` |
| `components/pools/` | `pool-counter` (essence, power, will, health) |
| `components/offers/` | `notification-overlay` — pending item/spell/reward offers |
| `hooks/use-pending-offers.ts` | Track and refresh pending game rewards |
| `hooks/use-character-store.ts` | Character state management (optimistic updates) |
| `hooks/use-character-sync.ts` | Real-time character sync with DB |

#### `features/games/`

Game session view with combat, encounters, and GM tools.

| File | Purpose |
|------|---------|
| `combat-panel.tsx` | Combat UI — turn order, initiative |
| `encounter-panel.tsx` | Encounter management |
| `creature-section.tsx` | NPC/creature display |
| `invite-panel.tsx` | Invite players via join code |
| `dice-panel.tsx` | Dice rolling interface |
| `kick-player-modal.tsx` | Remove player from session |
| `create-creature-modal.tsx`, `inspect-creature-modal.tsx` | Creature management |
| `modals/grant-reward-modal.tsx` | Award XP, skill points, currency, items, spells |
| `modals/grant-to-character-modal.tsx` | Grant items/spells to a specific character |
| `modals/grant-item-to-character-modal.tsx` | Grant a specific item to a character |
| `modals/grant-spell-to-character-modal.tsx` | Grant a specific spell to a character |
| `panels/logs-panel.tsx` | Combat log viewer |
| `panels/settings-panel.tsx` | Game settings |
| `panels/creatures-panel.tsx` | Active creatures/NPCs |
| `panels/characters-panel.tsx` | Player characters in session |
| `panels/items-panel.tsx` | Loot/rewards |
| `panels/spells-panel.tsx` | Active spell list |
| `panels/combat-tab-panel.tsx` | Combat turn management |

#### `features/skills/`

| File | Purpose |
|------|---------|
| `components/skill-tree-viewer.tsx` | Read-only skill tree visualization |
| `components/skill-tree-editor.tsx` | Drag-and-drop node editor (dev only, uses dnd-kit) |
| `hooks/use-skill-tree.ts` | Skill tree state, unlock logic |

#### `features/devtools/`

| File | Purpose |
|------|---------|
| `components/devtools-section.tsx` | Admin panel for testing, requires `is_dev` profile flag |
| `components/edit-active-skill-modal.tsx` | Edit active skill definitions (dev only) |
| `components/edit-spell-modal.tsx` | Edit spell definitions (dev only) |

---

### Shared Components (`components/`)

| File | Purpose |
|------|---------|
| `components/ui/` | shadcn/ui component wrappers (button, card, dialog, form, table, etc.) |
| `header.tsx` | Top nav bar |
| `login-form.tsx` | Magic-link email auth |
| `dashboard-content.tsx` | Main dashboard layout |
| `virtual-gm-component.tsx` | AI GM chat interface |
| `settings-modal.tsx` | User settings dialog |
| `friends-modal.tsx` | Friend management |
| `invite-notification.tsx` | In-app game invite toast |
| `create-item-modal.tsx` | Item creation (dev/GM) |
| `create-spell-modal.tsx` | Spell creation (dev/GM) |
| `active-skill-viewer.tsx` | View active skill details and effects |
| `effect-editor-modal.tsx` | Edit effect arrays on skills, spells, and items |
| `narrative-excerpts.tsx` | Lore/flavor text display |
| `theme-provider.tsx` | Dark/light theme via next-themes |

---

### Service Layer (`lib/services/`)

All database access goes through typed service functions. No raw Supabase calls in components.

| Service | Responsibilities |
|---------|----------------|
| `character-service.ts` | Character CRUD, stat updates, skill/spell/inventory operations |
| `skill-service.ts` | Skill tree queries, unlock operations, edge management |
| `active-skill-service.ts` | Active skill definitions — CRUD for contextual combat actions |
| `item-service.ts` | Item CRUD, generation, trading between characters |
| `spell-service.ts` | Spell management, granting, removal |
| `game-service.ts` | Game session CRUD, combat turn order, player membership |
| `encounter-service.ts` | Combat encounter lifecycle, creature management |
| `invite-service.ts` | Game invite create/accept/decline/cleanup |
| `friend-service.ts` | Friend request → pending → accepted workflow |
| `profile-service.ts` | User profile reads and updates |
| `pending-offer-service.ts` | Track and apply pending item/spell/reward offers |
| `snapshot-service.ts` | Character state snapshots for undo/history |
| `roll-service.ts` | Dice roll events — record and replay |
| `save-game-service.ts` | Persist and load game save state |
| `admin-service.ts` | Admin-only user and game management operations |
| `prompt-service.ts` | CRUD for `prompt_versions` — `getLatestPrompt`, `savePrompt`, `getPromptVersions`, `getPromptSlugs` |
| `test-helpers.ts` | Shared mock utilities for all service tests |

All services have co-located `.test.ts` files. Tests use Vitest.

---

### Core Logic (`lib/`)

| File | Purpose |
|------|---------|
| `lib/effect-engine.ts` | Evaluates effect arrays on skills, spells, and items. Replaces the old `skill-engine.ts`. Scales by rank, context-aware (weapon type, combat status). See [`docs/effects-engine.md`](docs/effects-engine.md) |
| `lib/friend-logic.ts` | Friend request state machine |
| `lib/invite-logic.ts` | Game join code and member status transitions |
| `lib/pending-offers.ts` | Utilities for tracking/applying pending rewards |
| `lib/utils.ts` | `cn()` class merging, misc helpers |
| `lib/schemas/skill-effect.ts` | Zod schemas for the effect JSONB structure |

---

### Supabase Clients (`lib/supabase/`)

| File | Usage |
|------|-------|
| `client.ts` | Browser-side client (components, hooks) |
| `server.ts` | Server-side client (Server Components, API routes) |
| `middleware.ts` | Next.js middleware — session refresh + route protection |

---

### Hooks (`hooks/`)

| File | Purpose |
|------|---------|
| `use-mobile.ts` | Detect mobile viewport (breakpoint: 768px) |
| `use-toast.ts` | Toast notification hook (sonner-based) |

---

## packages/server (AI Game Master — SYNGEM Pipeline)

Express server on port 3001. Proxied by `POST /api/gm` on the web app.

> Deep-dive: [`packages/server/docs/SYNGEM-architecture.md`](packages/server/docs/SYNGEM-architecture.md)

**Auth:** All `/gm/*` routes require `Authorization: Bearer <GM_API_KEY>`. Admin UI at `/admin` uses session-based auth (separate credentials). Standalone deploy: see `packages/server/docker-compose.yml`.

The server implements the **SYNGEM** pipeline — each player message passes through five deterministic and AI layers before a streamed narrative response is returned:

```
Player message → Auto-Hydrator → Lore-Engine → Style-Modulator
             → Architect (streamed) → [async] Ledger → State-Executor
             → [async, every 4 turns] Scribe
```

```
server/
├── index.ts                       # Express entry — CORS, rate limiting, route wiring
├── chat.ts                        # Interactive REPL: tsx chat.ts <character_id>
├── Dockerfile / docker-compose.yml
├── middleware/
│   └── auth.ts                    # requireGmKey — Bearer token validation
├── admin/
│   ├── routes.ts                  # Admin UI: login, dashboard, logout, /health
│   └── request-logger.ts          # In-memory ring buffer of last 100 GM requests
├── services/
│   ├── character-service.ts       # getCharacter, getFullCharacter, updateCharacter
│   ├── conversation-service.ts    # saveTurn, getRecentTurns, getTurnCount
│   ├── game-service.ts            # getGameWithMembers, getGameAllyCharacters, getActiveEncounter
│   ├── prompt-service.ts          # loadSystemPrompt (60s cache), invalidatePromptCache
│   └── world-service.ts           # searchWorldEntities, getCampaignFacts, getNpcsForGame
└── gm/
    ├── handler.ts                 # Pipeline orchestrator
    ├── types.ts                   # GMMessageInput, ContextBlock, CheckRequired, etc.
    ├── auto-hydrator.ts           # Layer 1: builds ContextBlock from parallel DB reads
    ├── style-modulator.ts         # Layer 3: picks a random style file from gm/content/
    ├── state-executor.ts          # Layer 5b: validates and applies Ledger output to DB
    ├── content/
    │   ├── style_1.txt            # Restrained / observational
    │   ├── style_2.txt            # Lyrical / elegiac
    │   └── style_3.txt            # Terse / consequential
    ├── agents/
    │   ├── lore-engine.ts         # Layer 2: intent + mechanics (Haiku, slug: lore-engine)
    │   ├── architect.ts           # Layer 4: narrator (Sonnet, streamed, slug: architect)
    │   ├── ledger.ts              # Layer 5a: world-state audit (Sonnet, async, slug: ledger)
    │   ├── summary.ts             # Layer 6: Scribe summarizer (Haiku, async, slug: scribe)
    │   └── npc.ts                 # Legacy NPC dialogue (Haiku)
    ├── services/
    │   └── claude-service.ts      # Generic eval wrapper (/eval endpoint)
    └── tools/
        ├── index.ts               # Tool definitions + executeTool dispatcher
        ├── db.ts                  # Supabase service-role singleton
        └── character.ts           # update_stat, update_level, restore_pools
```

All four sub-agents (Lore-Engine, Architect, Ledger, Scribe) load their system prompts from `prompt_versions` via `services/prompt-service.ts` at request time (cached 60s), falling back to hardcoded constants. Edit prompts live at `/dev/prompt-builder` using the agent's slug.

---

## Database Schema

**Platform:** Supabase (PostgreSQL 15+)  
**Generated types:** `database.types.ts` (root) — regenerate with `pnpm gen-types`

> Relationships & gotchas: [`supabase/docs/schema-relationships.md`](supabase/docs/schema-relationships.md)  
> How to add migrations: [`supabase/docs/migration-guide.md`](supabase/docs/migration-guide.md)

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts. `username`, `avatar_url`, `is_dev` flag |
| `characters` | Player characters. Stats, level, location, notes. AI fields: `scribe_summary`, `quest_objectives`, `key_entity_ids`, `ai_game` |
| `character_inventory` | Items owned by characters. `condition`, `equipped` |
| `character_skills` | Unlocked skills per character. `current_rank`, `unlocked_at` |
| `character_spells` | Spells known by character |
| `character_action_skills` | Contextual combat action skills |
| `skills` | Skill definitions. `max_rank`, `effects` (JSONB), `unlock_key`, `is_passive` |
| `skill_edges` | Skill tree prerequisite graph. `parent_id → child_id` |
| `items` | Item templates. Damage, defense, cost, weight, `effects` (JSONB) |
| `spells` | Spell definitions. Damage, AOE, range, cast_time, cooldown, `effects` (JSONB) |
| `active_skills` | Named contextual combat actions with `effects` (JSONB) |
| `games` | Game sessions. `gm_id`, `join_code`, combat state |
| `game_members` | Player membership. `character_id`, `role`, `status` |
| `creatures` | Enemy/NPC templates |
| `encounter_creatures` | Creature instances in active encounters |
| `pending_offers` | Rewards awaiting player acceptance |
| `friends` | Friend relationships. `status`: pending → friend |
| `npcs` | Game NPCs. Faction, personality, disposition |
| `campaign_facts` | Session lore facts. `gm_only` flag |
| `world_entities` | World encyclopedia. Replaced `world_lore`. `type` enum, `data` JSONB, full-text `search_vector` |
| `player_entity_mutations` | Per-player overrides on `world_entities` (e.g. hidden doors, altered descriptions) |
| `conversation_turns` | Persisted GM conversation history. `role` (`player`\|`assistant`), `turn_number` |
| `prompt_versions` | Versioned agent system prompts. `slug`, `version`, `prompt` JSONB, `description` |
| `character_snapshots` | Point-in-time character state for undo/history |
| `roll_events` | Dice roll log per game session |

### Key Enums

```sql
entity_type:  nation | region | place | location | npc | item
offer_type:   item | denarius | skill_point | spell
```

### Key PL/pgSQL Functions

| Function | Purpose |
|----------|---------|
| `handle_new_user()` | Trigger on `auth.users` insert → create profile row |
| `is_game_gm(game_id)` | Returns true if current user is GM of game |
| `is_game_member(game_id)` | Returns true if current user is a member |
| `auth_user_is_game_member(game_id)` | Includes invited status |
| `save_skill_edges_delta(removed[], added jsonb)` | Batch skill tree edge update |
| `search_world_lore(query text)` | Full-text lore search |

### Migrations

| File | Purpose |
|------|---------|
| `20260522150053_remote_schema.sql` | Initial schema |
| `20260522175154_add_notes_to_characters.sql` | Notes field on characters |
| `20260522200000_fix_rls_policies.sql` | RLS policy corrections |
| `20260522210000_fix_character_select_and_policies.sql` | Character select + policy fixes |
| `20260522220000_add_giver_inventory_delete_fn.sql` | Helper for item trading |
| `20260522230000_add_character_snapshots.sql` | `character_snapshots` table |
| `20260522240000_add_roll_events.sql` | `roll_events` table |
| `20260522250000_add_effects_to_spells_items.sql` | `effects` JSONB column on `spells` and `items` |
| `20260523000000_add_active_skills.sql` | `active_skills` table with effects |
| `20260523100000_fix_security_warnings.sql` | Security hardening |
| `20260523110000_add_missing_rls_policies.sql` | Fill RLS gaps |
| `20260523120000_grant_active_skills_to_authenticated.sql` | RLS grants for `active_skills` |
| `20260523130000_fix_skills_rls_for_devs.sql` | Dev-role RLS bypass for skill editing |
| `20260523140000_add_is_dev_service_and_normalize_policies.sql` | `is_dev` service role + policy normalization |
| `20260523150000_add_ai_game_to_characters.sql` | `ai_game` boolean flag on `characters` |
| `20260524000000_add_prompt_versions.sql` | `prompt_versions` table + RLS |
| `20260524100000_add_condition_to_characters.sql` | `condition_text` field on `characters` |
| `20260524200000_fix_prompt_versions_rls.sql` | RLS policy fixes for `prompt_versions` |
| `20260524210000_add_gm_history_to_characters.sql` | `gm_history` JSONB on `characters` (legacy, superseded by `conversation_turns`) |
| `20260524220000_replace_world_lore_with_entities.sql` | Replaces `world_lore` with `world_entities` + `player_entity_mutations` |
| `20260526100000_add_conversation_turns.sql` | `conversation_turns` table — server-side GM conversation history |
| `20260526110000_add_scribe_fields_to_characters.sql` | `scribe_summary`, `quest_objectives`, `key_entity_ids` on `characters` |
| `20260526120000_add_description_to_prompt_versions.sql` | `description` text column on `prompt_versions` |

---

## Environment Variables

### `packages/web` (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `GM_SERVER_URL` | No | GM server base URL (default: `http://localhost:3001`) |
| `GM_API_KEY` | Yes | Shared secret sent as `Authorization: Bearer` on all GM proxy calls |

### `packages/server` (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS) |
| `GM_API_KEY` | Yes | Shared secret validated on all `/gm/*` requests |
| `WEB_APP_ORIGIN` | No | CORS allowed origin (default: `*`) |
| `GM_PORT` | No | Server port (default: 3001) |
| `GM_RATE_LIMIT` | No | Max requests/min per IP on `/gm` (default: 30) |
| `ADMIN_USERNAME` | Yes | Admin UI login username |
| `ADMIN_PASSWORD` | Yes | Admin UI login password |
| `SESSION_SECRET` | Yes | Signs admin session cookies |

---

## Scripts

```bash
# Root
pnpm dev              # Run web + server concurrently
pnpm build            # Next.js production build
pnpm test             # Vitest (run once)
pnpm test:watch       # Vitest watch mode
pnpm gen-types        # Regenerate database.types.ts from Supabase

# Server only
node --env-file=.env.local packages/server/index.js   # Start GM server
node --env-file=.env.local packages/server/chat.js    # Interactive GM REPL
```

---

## Design System

- **Style:** Brutalist dark fantasy — sharp borders, flat UI, no soft shadows
- **Typography:**
  - `Playfair Display` — serif, titles and data values
  - `Josefin Sans` — all-caps, high letter-spacing (`tracking-widest`, `tracking-[0.3em]`) for labels/metadata
- **Colors:** OKLch CSS variables. Cyan/neon blue = magic. Muted gray/crimson = gear/danger.
- **Components:** shadcn/ui (New York style) + Radix UI primitives
- **Animations:** Framer Motion for transitions

---

## Key Conventions

- **No `any`** — use `unknown` + type narrowing
- **Named exports** everywhere — no default exports except Next.js pages
- **Service layer** — all DB access via `lib/services/*`, never raw in components
- **Feature modules** — `features/<domain>/components/` + `features/<domain>/hooks/`
- **Tests** — service-level Vitest tests, no component tests currently
- **Forms** — React Hook Form + Zod validation
- **Comments** — only when the why is non-obvious

---

## In Progress / Planned

- Body-part armor loadout system
- Scavenge module (timed item discovery)
- Crafting mechanic
- Finalize skill tree node design
- Revise item/creature/spell stat blocks
