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
| `/dev/users` | `app/dev/users/page.tsx` | User management |
| `/about` | `app/about/page.tsx` | About page |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error |

### API Routes (`app/api/`)

| Endpoint | File | Notes |
|----------|------|-------|
| `POST /api/gm` | `app/api/gm/route.ts` | Proxy to GM server at `GM_SERVER_URL` |
| `POST /api/gm/summarize` | `app/api/gm/summarize/route.ts` | Session history summarization |
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
| `grant-reward-modal.tsx` | Award XP, skill points, currency, items, spells |
| `grant-to-character-modal.tsx` | Grant items/spells to a specific character |
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
| `devtools-section.tsx` | Admin panel for testing, requires `is_dev` profile flag |

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
| `narrative-excerpts.tsx` | Lore/flavor text display |
| `theme-provider.tsx` | Dark/light theme via next-themes |

---

### Service Layer (`lib/services/`)

All database access goes through typed service functions. No raw Supabase calls in components.

| Service | Responsibilities |
|---------|----------------|
| `character-service.ts` | Character CRUD, stat updates, skill/spell/inventory operations |
| `skill-service.ts` | Skill tree queries, unlock operations, edge management |
| `item-service.ts` | Item CRUD, generation, trading between characters |
| `spell-service.ts` | Spell management, granting, removal |
| `game-service.ts` | Game session CRUD, combat turn order, player membership |
| `encounter-service.ts` | Combat encounter lifecycle, creature management |
| `invite-service.ts` | Game invite create/accept/decline/cleanup |
| `friend-service.ts` | Friend request → pending → accepted workflow |
| `profile-service.ts` | User profile reads and updates |
| `pending-offer-service.ts` | Track and apply pending item/spell/reward offers |
| `test-helpers.ts` | Shared mock utilities for all service tests |

All services have co-located `.test.ts` files. Tests use Vitest.

---

### Core Logic (`lib/`)

| File | Purpose |
|------|---------|
| `lib/skill-engine.ts` | Evaluates skill effects (stat modifiers, pool conversions, resource gains). Scales by rank. Context-aware (weapon type, combat status). |
| `lib/friend-logic.ts` | Friend request state machine |
| `lib/invite-logic.ts` | Game join code and member status transitions |
| `lib/pending-offers.ts` | Utilities for tracking/applying pending rewards |
| `lib/utils.ts` | `cn()` class merging, misc helpers |

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

## packages/server (AI Game Master)

Express server on port 3001. Proxied by `POST /api/gm` on the web app.

```
server/
├── index.js            # Express server entry point
├── chat.js             # Interactive REPL: node chat.js <character_id>
├── test-tools.js       # Debug tool definitions
└── gm/
    ├── handler.js      # Core message routing + Claude tool execution loop
    ├── agents/
    │   ├── summary.js  # Session history summarization agent
    │   ├── npc.js      # NPC interaction agent
    │   └── interaction.js  # General interaction handler
    └── tools/
        ├── index.js    # Exports all tools to Claude
        ├── db.js       # Supabase client setup
        └── character.js  # Character lookup + stat mutation tools
```

Claude tool use is the core pattern — the GM calls tools to read/modify game state, then responds to the player.

---

## Database Schema

**Platform:** Supabase (PostgreSQL 15+)  
**Generated types:** `database.types.ts` (root) — regenerate with `pnpm gen-types`

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts. `username`, `avatar_url`, `is_dev` flag |
| `characters` | Player characters. Stats, level, location, notes |
| `character_inventory` | Items owned by characters. `condition`, `equipped` |
| `character_skills` | Unlocked skills per character. `current_rank`, `unlocked_at` |
| `character_spells` | Spells known by character |
| `character_action_skills` | Contextual combat action skills |
| `skills` | Skill definitions. `max_rank`, `effects` (JSONB), `unlock_key`, `is_passive` |
| `skill_edges` | Skill tree prerequisite graph. `parent_id → child_id` |
| `items` | Item templates. Damage, defense, cost, weight, modifiers (JSONB) |
| `spells` | Spell definitions. Damage, AOE, range, cast_time, cooldown |
| `games` | Game sessions. `gm_id`, `join_code`, combat state |
| `game_members` | Player membership. `character_id`, `role`, `status` |
| `creatures` | Enemy/NPC templates |
| `encounter_creatures` | Creature instances in active encounters |
| `pending_offers` | Rewards awaiting player acceptance |
| `friends` | Friend relationships. `status`: pending → friend |
| `npcs` | Game NPCs. Faction, personality, disposition |
| `campaign_facts` | Session lore facts. `gm_only` flag |
| `world_lore` | World encyclopedia. `lore_type` enum |
| `action_skills` | Named contextual combat actions |

### Key Enums

```sql
lore_type:   nation | region | polis | location | npc | item | faction
offer_type:  item | denarius | skill_point | spell
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

---

## Environment Variables

### `packages/web` (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `GM_SERVER_URL` | No | GM server base URL (default: `http://localhost:3001`) |

### `packages/server` (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS) |
| `GM_PORT` | No | Server port (default: 3001) |

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

- Skill engine integration into game mechanics
- Body-part armor loadout system
- Scavenge module (timed item discovery)
- Crafting mechanic
- Finalize skill tree node design
- Revise item/creature/spell stat blocks
- Skill check system (player-facing dice rolls)
