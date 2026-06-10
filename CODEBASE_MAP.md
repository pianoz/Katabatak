/* eslint-<!-- markdownlint-disable-file --> */

# Katabatak — Codebase Map

---

## Project Overview

Katabatak is a tabletop RPG web application with a brutalist dark fantasy aesthetic (Darkest Dungeon / MÖRK BORG). It consists of:

- **`packages/web`** — Next.js 15 + React 19 frontend (App Router)
- **`packages/server`** — Node.js AI Game Master backend (Claude + tool use)
- **`supabase/`** — PostgreSQL migrations, RLS policies, seed data

Tech stack: TypeScript strict, Tailwind v4, shadcn/ui, Supabase (auth + DB), Vitest, Zod (runtime schema validation — web forms + server AI output), pnpm workspaces.

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
| `/syngem/intro` | `app/syngem/intro/page.tsx` | Atmospheric character creation intro — typewriter Q&A flow, calls `/api/character-creator`, creates SYNGEM character |
| `/dev/prompt-builder` | `app/dev/prompt-builder/page.tsx` | Drag-and-drop prompt block editor — save/load/test agent prompts against live GM server. Auto-Hydrator block fetches context by `characterId` only (no multiplayer game picker); `syngem_game` table included in hydration output |
| `/dev/prompt-eval` | `app/dev/prompt-eval/page.tsx` | **Agent Grader** — 3-column dev harness for evaluating SYNGEM agent prompts. Col 1: agent slug + version selector; character dropdown (SYNGEM characters only, `ai_game = true`); drag-resizable column; live block sequence viewer with LOADED/EMPTY/PLACEHOLDER badges — clicking a LOADED block opens a full-content modal. Col 2: test cases with per-agent expected output editors. Col 3: run log with code grade `x/y` + model grade `score/100` from a versioned Haiku evaluator prompt (slug: `<agent>-evaluator`; falls back to hardcoded). Character blocks hydrated via `/api/gm/hydrate`: `system` blocks from `prompt_versions`, `recent_history` from `conversation_turns` (last 4 turns), `summary` from `syngem_game.summary`, `quest_objectives` from `characters.quest_objectives`, `quest_notes` from `activeQuestNotes`. All model calls locked to production config |
| `/dev/combat` | `app/dev/combat/page.tsx` | Combat system test harness — pick any character + up to 5 creatures (duplicates of the same type allowed) + game session, start/abort combat without SYNGEM |
| `/about` | `app/about/page.tsx` | About page |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error |

### API Routes (`app/api/`)

| Endpoint | File | Notes |
| -------- | ---- | ----- |
| `POST /api/gm` | `app/api/gm/route.ts` | SSE proxy to GM server — streams Architect chunks or returns `{type:'check_required'}`. Gate: `is_dev` OR `X-Anthropic-Key` header present. Forwards key as `X-Anthropic-Key` to GM server |
| `POST /api/validate-key` | `app/api/validate-key/route.ts` | BYOK: validates an Anthropic API key via a minimal Haiku call. Returns `{ valid, error? }`. Key never stored |
| `GET /api/token-usage` | `app/api/token-usage/route.ts` | BYOK: returns last 500 token usage rows for the authenticated user (RLS-scoped) |
| `PUT /api/token-budget` | `app/api/token-budget/route.ts` | BYOK: sets or clears `profiles.token_budget` for the authenticated user. Min 1,000 or null |
| `POST /api/gm/eval` | `app/api/gm/eval/route.ts` | Single-shot Claude eval proxy (used by prompt builder and agent grader) |
| `POST /api/gm/hydrate` | `app/api/gm/hydrate/route.ts` | Context block hydration proxy — accepts `{ characterId, tables[] }`, forwards to GM server `POST /gm/hydrate`, returns `{ text }`. Supported table keys: `character`, `inventory`, `location`, `npcs`, `encounter`, `syngem_game`, `summary`, `quest_objectives`, `quest_notes`, `recent_history` (last 4 turns from `conversation_turns`). Used by grader to populate blocks before a test run |
| `GET /api/gm/health` | `app/api/gm/health/route.ts` | GM server liveness check |
| `POST /api/gm/save` | `app/api/gm/save/route.ts` | Persist game save state |
| `POST /api/gm/summarize` | `app/api/gm/summarize/route.ts` | Legacy session history summarization |
| `POST /api/character-creator` | `app/api/character-creator/route.ts` | Proxies Q&A payload to GM server `POST /character-creator` — fits character into Waystone story scaffold, returns background/description/backstory/story_hook/initial_quest. Auth-gated (no `is_dev` required) |
| `POST /api/gm/quest/start` | `app/api/gm/quest/start/route.ts` | Proxies to GM server `POST /gm/quest/start` — fires quest start grants (items + companion NPCs) for a given `characterId` + `questId`. Called by `syngem-intro.tsx` after character creation |
| `POST /api/gm/combat/start` | `app/api/gm/combat/start/route.ts` | Proxies to GM server — initializes combat for a game session (sets `is_in_combat`, `combat_phase`, turn order) |
| `POST /api/gm/combat/player-attack` | `app/api/gm/combat/player-attack/route.ts` | Proxies Phase A resolution — player picks weapon + attack type + target; deterministic creature AI picks defence; damage resolved |
| `POST /api/gm/combat/player-defend` | `app/api/gm/combat/player-defend/route.ts` | Proxies Phase B resolution — all alive creatures attack; player picks one defend type applied against all |
| `POST /api/gm/combat/end` | `app/api/gm/combat/end/route.ts` | Proxies combat teardown — resets `is_in_combat`, `combat_phase`, clears log |
| `GET /api/dev/users` | `app/api/dev/users/route.ts` | Admin user list (dev flag required) |
| `POST /api/dev/log-level` | `app/api/dev/log-level/route.ts` | Proxies to GM server `POST /dev/log-level`. Sets pipeline log level at runtime (dev only) |
| `DELETE /api/dev/conversation-history` | `app/api/dev/conversation-history/route.ts` | Validates `is_dev`, proxies to GM server `DELETE /gm/conversation/:characterId` — wipes all `conversation_turns` for a character |
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
| `components/character-creation.tsx` | Full multi-step character creation flow (IRL characters) |
| `components/character-dashboard.tsx` | Character sheet hub (stats, pools, inventory). Accepts `variant` prop: `"irl"` (default — flat pool grid, SYNGEM as overlay) or `"syngem"` (3-column layout: ES+PW pools \| SYNGEM window \| WP+HP pools, tabs below). Subscribes to `game_members` realtime to detect when the linked game enters combat; mounts `<CombatOverlay>` when `is_in_combat = true`. Action card dropdowns (Attack / Defend) include synthetic unarmed fallbacks (`__unarmed__` / `__unarmed_def__`) and call `equipItem` / `unequipAll` when the selection changes. On mount, syncs selected item to the currently equipped weapon/armor |
| `components/inventory/item-table.tsx` | Sortable, filterable item table used in the Items tab. Optional `onEquip` prop renders an "E" button (blue = equipped, grey = not) on weapon/armor rows in both mobile and desktop views. `Item` interface includes `is_equipped?: boolean` |
| `components/character-card.tsx` | Summary card with inventory, pools, stats |
| `components/character-display-card.tsx` | Read-only character view |
| `components/character-select-modal.tsx` | Pick character for a game |
| `components/attribute-increase-popup.tsx` | Level-up attribute dialog |
| `components/inventory/` | `add-item-modal`, `edit-item-modal`, `inspect-item-modal`, `item-table`, `give-to-ally-modal` |
| `components/spells/` | `add-spell-modal`, `spell-section` |
| `components/actions/` | `action-card`, `action-skill-modal`, `pool-check-panel` |
| `components/pools/` | `pool-counter` (essence, power, will, health) |
| `components/offers/` | `notification-overlay` — pending item/spell/reward offers |
| `hooks/use-pending-offers.ts` | Track and refresh pending game rewards |
| `hooks/use-character-store.ts` | Character state management (optimistic updates). Actions: `updatePool`, `modifyStat`, `toggleEquip`, `equipItem` (exclusive per-category), `unequipAll` |
| `hooks/use-character-sync.ts` | Real-time character sync with DB — debounced 1.5 s write covers all dirty `is_equipped` changes. Note: `tracked` is set by the server (`state-executor`) at grant time; equipped items are always included in hydration via the `OR is_equipped=true` filter regardless of `tracked` |

#### `features/combat/`

Player-facing combat overlay. Shown when `games.is_in_combat = true`. Full-screen terminal-aesthetic overlay over the character dashboard. All resolution is server-authoritative via the GM server combat routes.

**Round structure:** Phase A — player attacks one target (deterministic creature AI picks defence, damage resolved). Phase B — all alive creatures attack simultaneously; player picks one defend type that applies against every incoming roll.

| File | Purpose |
|------|---------|
| `components/combat-overlay.tsx` | Root overlay — subscribes to `games`, `characters`, `encounter_creatures` realtime. Manages phase state, loads weapons/defence values, dispatches Phase A and B actions. Includes `UNARMED_SYNTHETIC` fallback weapon (`__unarmed__`, 1d2, free) used when no real weapons are in inventory. Uses API-returned `net`/`defValue`/`totalDamage`/`totalBlocked` for damage popups (not health-diff). Shows inline error strip when GM server call fails. `loadCreatures` reads `selectedTargetRef` (a `useRef` kept in sync with `selectedTargetId`) instead of the state value directly — prevents the subscription `useEffect` from tearing down and recreating all 3 Supabase channels on every target click. Animation `setTimeout` calls go through a `safeTimeout` helper that accumulates IDs in a `useRef` and clears them on unmount |
| `components/creature-display.tsx` | One of 5 fixed-height columns — ASCII sprite, HP + pool bars (700ms width transition). Red border + glow when targeted (Phase A only); clickable to retarget. Amber border when all enemies are active attackers (Phase B). Floating red damage number (`-N` or `0`) + cyan block number (`[N AC]`) overlay on hit (2s fade-up). "TARGETED" label with red text-glow below the active target card |
| `components/combat-log-panel.tsx` | Scrolling terminal log — flavor lines (italic), mechanical lines (mono `roll=N def=N net=N`), outcome banners |
| `components/phase-controls.tsx` | `PhaseAControls` (weapon selector, large prominent Attack button + smaller Strong Attack; click any enemy card to retarget — no button picker) and `PhaseBControls` (Defend / Strong Defend buttons with AC values and Will cost) |

#### `features/games/`

Game session view with combat, encounters, and GM tools.

| File | Purpose |
|------|---------|
| `combat-panel.tsx` | GM-side debug tool — manually adjust creature HP/pools, trigger attacks, log to localStorage. Not the player-facing system (see `features/combat/`) |
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
| `components/dev/grader/AgentSelector.tsx` | Slug + version dropdowns; shows agent display name + locked model/token config |
| `components/dev/grader/CharacterSelector.tsx` | Character dropdown; triggers context block hydration on select |
| `components/dev/grader/BlockSequenceViewer.tsx` | Numbered block cards in pipeline order; LOADED (green) / EMPTY (red) / OPTIONAL / PLACEHOLDER badges; shows content preview for each block. Clicking any LOADED block opens a fixed modal with full content (`<pre>` scroll, ESC/backdrop to close) |
| `components/dev/grader/ExpectedOutputEditor.tsx` | Agent-aware expected output fields: action_type+pool dropdowns (Lore-Engine), action list with item_type (Ledger), checkboxes (Scribe), read-only field list (Character Creator), hidden for Architect |
| `components/dev/grader/GradeResultCard.tsx` | Code grade `x/y` with per-field pass/fail rows + model grade `score/100` with review text |
| `components/dev/grader/TestCaseEditor.tsx` | Add/remove test cases; each case has user input textarea, `ExpectedOutputEditor`, and inline `GradeResultCard` after run |
| `header.tsx` | Top nav bar |
| `login-form.tsx` | Magic-link email auth |
| `dashboard-content.tsx` | Main dashboard layout. Top-level **IRL** / **SYNGEM** tabs. IRL tab shows games + characters where `syngem_game = false`. SYNGEM tab shows a "New Game" CTA (→ `/syngem/intro`) and a "Chronicles" list of `syngem_game = true` characters. Dev mode toggle shows `DevToolsSection` and **Log Level** radio group |
| `syngem-intro.tsx` | Client component for the SYNGEM character creation intro — phases: `intro` (typewriter world lore) → `questions` (10 hardcoded Q&A) → `loading` → `reveal` (two-column: character identity left, typewritten story hook center, "Enter the World" CTA) → redirect to character page. Calls `/api/character-creator`, creates character via `createCharacterWithItems` (seeding `quest_objectives` from `initial_quest`) + `createSyngemGame`, then fires `POST /api/gm/quest/start` (non-blocking) to apply Waystone quest start grants (Brin NPC + starter items) |
| `virtual-gm-component.tsx` | AI GM chat interface. Accepts `isDev` prop — when true, shows a **Dump History** button. Reads API key from `useApiKey` hook and attaches it as `X-Anthropic-Key` header on every `/api/gm` fetch |
| `settings-modal.tsx` | User settings dialog — includes `ApiKeySettings` and `TokenSpendDashboard` sections. Accepts optional `tokenBudget` prop passed from the dashboard page |
| `api-key-settings.tsx` | BYOK: API key management section — masked display, visibility toggle, clear button, validate-then-save flow via `/api/validate-key`. Shows "browser-only" disclaimer |
| `token-spend-dashboard.tsx` | BYOK: token spend display — total tokens used, by-agent bar chart (recharts), budget cap input that calls `/api/token-budget`. Shows red warning above 90% cap |
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
| `encounter-service.ts` | Combat encounter lifecycle, creature management. `addCreaturesToEncounter` copies the full creature stat block including `strong_cost` and `strong_defence` |
| `invite-service.ts` | Game invite create/accept/decline/cleanup |
| `friend-service.ts` | Friend request → pending → accepted workflow |
| `profile-service.ts` | User profile reads and updates |
| `pending-offer-service.ts` | Track and apply pending item/spell/reward offers |
| `snapshot-service.ts` | Character state snapshots for undo/history |
| `roll-service.ts` | Dice roll events — record and replay |
| `save-game-service.ts` | Persist and load game save state |
| `admin-service.ts` | Admin-only user and game management operations |
| `prompt-service.ts` | CRUD for `prompt_versions` — `getLatestPrompt`, `savePrompt`, `getPromptVersions`, `getPromptSlugs`, `getLatestEvaluatorPrompt(supabase, agentSlug)` (fetches `<slug>-evaluator` system block content, returns null if none) |
| `grader-service.ts` | Agent grader API wrappers — `hydrateBlock` (calls `/api/gm/hydrate`), `runAgentEval` (calls `/api/gm/eval` with agent-locked config), `runModelGrader(agentSlug, userInput, response, evaluatorPrompt?)` (Haiku 4.5, 200 tokens — uses DB evaluator prompt when provided, falls back to `GRADER_PROMPTS` hardcoded constants). Fallbacks describe all three stat pools: Power (strength/conviction), Essence (magic/perception), Will (social/dex/endurance) |
| `test-helpers.ts` | Shared mock utilities for all service tests |

All services have co-located `.test.ts` files. Tests use Vitest.

---

### Agent Grader (`lib/graders/`)

Logic layer for the `/dev/prompt-eval` agent grader. No React; pure TS.

| File | Purpose |
|------|---------|
| `agent-config.ts` | Static config for all 5 SYNGEM agents: ordered `BlockDef[]` (system/context/history/user-input), production model/tokens/temp locked, `ExpectedOutputKind`. Each `BlockDef` may carry `hydrateTables: string[]` specifying which context keys to fetch from `/api/gm/hydrate`. Table keys: `character`, `inventory`, `location`, `npcs`, `encounter`, `syngem_game`, `summary` (syngem_game.summary), `quest_objectives` (characters.quest_objectives), `quest_notes` (activeQuestNotes), `recent_history` (last 4 conversation_turns). System blocks without `hydrateTables` are populated from the loaded `prompt_versions` row |
| `code-grader.ts` | `gradeOutput(rawResponse, expected, agentSlug)` — parses JSON (strips markdown fences), applies bumper-lane normalization, checks expected fields. Returns `{ passed, total, details[] }`. Agent-specific logic for: Lore-Engine (action_type, requires_check, pool), Ledger (action array, item_type), Scribe (summary + arrays present + objective statuses), Character Creator (5 required fields) |
| `bumper-lanes.ts` | Client-side copy of the 5 normalization maps from `packages/server/gm/bumper-lanes.ts` (LEDGER_ACTIONS, LORE_ACTION_TYPES, LORE_POOLS, QUEST_STATUSES, ITEM_TYPES). Keep in sync with server when adding new aliases |

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
| `use-api-key.ts` | BYOK: reads/writes `localStorage['katabatak_anthropic_key']`. SSR-safe. Returns `{ apiKey, hasKey, setApiKey, clearApiKey }` |

---

## packages/server (AI Game Master — SYNGEM Pipeline)

Express server on port 3001. Proxied by `POST /api/gm` on the web app.

> Deep-dive: [`packages/server/docs/SYNGEM-architecture.md`](packages/server/docs/SYNGEM-architecture.md)

**Auth:** All `/gm/*` and `/character-creator` routes require `Authorization: Bearer <GM_API_KEY>`. Admin UI at `/admin` uses session-based auth (separate credentials). Standalone deploy: see `packages/server/docker-compose.yml`.

**BYOK:** The GM server accepts an optional `X-Anthropic-Key` header on `POST /gm`. When present, a per-request `Anthropic` client is constructed with that key via `gm/claude-client.ts`. When absent, the server falls back to `ANTHROPIC_API_KEY` env var. The key is never logged or stored. Token counts are written to `token_usage` after each agent call via `gm/record-token-usage.ts`. Budget enforcement runs at the top of each pipeline invocation via `gm/budget-guard.ts`. See [`packages/server/docs/BYOK.md`](packages/server/docs/BYOK.md).

The server implements the **SYNGEM** pipeline — each player message passes through five deterministic and AI layers before a streamed narrative response is returned:

```
Player message → Auto-Hydrator → Lore-Engine → Style-Modulator
             → Architect (streamed) → [async] Ledger → State-Executor
             → [async, every 4 turns] Scribe
```

```
server/
├── index.ts                       # Express entry — CORS, rate limiting, route wiring. Assigns a UUID `req.requestId` to every request via middleware; threads it into handleGMMessage and logRequest for cross-layer tracing. SSE stream for POST /gm sets a clientGone flag via req.on('close') and breaks the generator loop early on client disconnect — stops Claude API burn for departed users
├── chat.ts                        # Interactive REPL: tsx chat.ts <character_id>
├── Dockerfile / docker-compose.yml
├── middleware/
│   └── auth.ts                    # requireGmKey — Bearer token validation
├── admin/
│   ├── routes.ts                  # Admin UI: login, dashboard (H/L/A per-stage timing column + Trace ID column), logout, /health. Filter bar (endpoint/character/status) for client-side row filtering. Slide-in trace drawer: clicking a Trace ID calls GET /admin/api/trace/:requestId and renders all pipeline log lines for that request
│   └── request-logger.ts          # In-memory ring buffer of last 100 GM requests. RequestLogEntry includes optional requestId. TraceEntry store (Map<requestId, TraceEntry[]>) accumulates synLog lines per request; entries are evicted with their parent ring-buffer row. Exports: addTraceEntry, getTrace
├── services/
│   ├── character-service.ts       # getCharacter, getFullCharacter, updateCharacter
│   ├── conversation-service.ts    # saveTurn, getRecentTurns, getTurnCount, clearConversationHistory
│   ├── game-service.ts            # getGameWithMembers, getGameAllyCharacters, getActiveEncounter
│   ├── prompt-service.ts          # loadSystemPrompt (60s cache), invalidatePromptCache
│   ├── syngem-game-service.ts     # getSyngemGame, createSyngemGame, updateSyngemSummary, advanceGameTime
│   ├── world-service.ts           # searchWorldEntities, getCampaignFacts, getNpcsForGame, getNpcsForCharacter
│   ├── quest-engine.ts            # applyQuestStartGrants, applyQuestCompletionGrants — idempotent grant engine for the Quest system
│   ├── effect-processor.ts        # computeSkillModifiers — sums {"type":"modifier","attribute":"attack"|"defence","value":N} effects from passive skills with rank scaling
│   ├── creature-ai.ts             # Deterministic creature AI — resolveCreatureAction(pools) → { attackChoice, defendChoice }. Will > Power → strong defend + weak attack; Power ≥ Will → strong attack (if affordable) + weak defend
│   └── combat-engine.ts           # initCombat, resolvePlayerAttack, resolvePlayerDefend, endCombat — full round/phase logic. Phase A: player attacks, creature-ai picks defence deterministically, damage resolved. Phase B: creature-ai picks each creature's attack, player's single defend choice applied against all, total damage summed
└── gm/
    ├── handler.ts                 # Pipeline orchestrator — per-stage wall-clock timing (hydrator/lore/architect) populated into _timingOut ref after architect stream closes. Threads requestId (from GMMessageInput) into all synLog calls and every stage invocation
    ├── logger.ts                  # synLog(tag, msg, detail?, requestId?) dev file logger. When requestId is provided, also pushes the entry to addTraceEntry() for admin dashboard tracing. synLogVerbose follows the same signature. + LogLevel / setLogLevel()
    ├── types.ts                   # GMMessageInput (incl. anthropicApiKey?, requestId?, _timingOut? output ref), ContextBlock, CheckRequired, etc. Exports LedgerOutputSchema (discriminated union, 7 actions) and LoreEngineOutputSchema — Zod runtime schemas used by Ledger and Lore-Engine agents to validate LLM JSON before it reaches the DB. ContextBlock now includes: `trackedInventory` (filtered inventory), `entitiesAtLocation` (LocationEntityFull[] — world_entities children of current place), `connectedLocations` (sibling places in same region). `LocationEntityFull` extends `LocationEntity` with `type` and `data` fields
    ├── claude-client.ts           # BYOK: createClaudeClient(apiKey?) — per-request Anthropic factory
    ├── record-token-usage.ts      # BYOK: fire-and-forget token count writes to token_usage
    ├── budget-guard.ts            # BYOK: checkBudget(userId) — reads cap + aggregate, returns allowed bool
    ├── auto-hydrator.ts           # Layer 1: builds ContextBlock by composing 5 exported module functions. Exported modules: `hydrateCharacter` (stats, pool texts, quest notes), `hydrateInventory` (tracked+equipped items only, carry weight), `hydrateGame` (syngemGame, multiplayer game, encounter), `hydrateNpcs` (enriched+filtered NPC list), `hydrateLocation` (chain walk-up + entities physically at current place + connected sibling locations + improvised entities). `autoHydrate` composes all 5 in two parallel batches. `contextBlock()` and `resolveLocationEntities()` remain exported for lore-engine
    ├── style-modulator.ts         # Layer 3: picks a random style file from gm/content/
    ├── state-executor.ts          # Layer 5b: validates and applies Ledger output to DB. create_entity deduplicates against world_entities then improvised_entities; grant_item writes to character_inventory and sets `tracked=true` for quest-type or special/rare/epic/legendary rarity items. All internal helpers accept requestId for trace logging
    ├── content/
    │   ├── style_1.txt            # Restrained / observational
    │   ├── style_2.txt            # Lyrical / elegiac
    │   └── style_3.txt            # Terse / consequential
    ├── agents/
    │   ├── lore-engine.ts         # Layer 2: intent + mechanics (Haiku, slug: lore-engine). Validates LLM JSON against LoreEngineOutputSchema (safeParse); logs Zod issues on failure and returns no-check task fallback. Accepts requestId for trace logging
    │   ├── architect.ts           # Layer 4: narrator (Sonnet, streamed, slug: architect). `serializeContextBlock` uses `trackedInventory` (not full inventory) for Equipped/Carrying sections; adds `=== LOCATION ENTITIES ===` (world_entities at current place) and `=== CONNECTED LOCATIONS ===` (sibling places) blocks. Accepts requestId for trace logging
    │   ├── ledger.ts              # Layer 5a: world-state audit (Sonnet, async, slug: ledger). Validates parsed array against LedgerOutputSchema (safeParse); logs Zod issues on failure and returns [] — prevents malformed actions from reaching state-executor. Accepts requestId for trace logging
    │   ├── summary.ts             # Layer 6: Scribe summarizer (Haiku, async, slug: scribe). Defines ScribeOutputSchema locally; validates LLM JSON (safeParse) and logs Zod issues on failure before returning empty fallback. Accepts requestId for trace logging
    │   ├── character-creator.ts   # One-shot: builds character profile from Q&A using the Waystone story scaffold (Sonnet, temp 0.9, max 2000 tokens). Returns background_primary/secondary, physical_description, backstory, story_hook, initial_quest. Called by POST /character-creator
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
| `profiles` | User accounts. `username`, `avatar_url`, `is_dev` flag, `token_budget` (nullable int — BYOK spend cap) |
| `characters` | Player characters. Stats, level, `location_place` (FK to `world_entities`), notes. AI fields: `quest_objectives` (JSONB array of `{id, title, status, description, current_stage?, grants_applied?}`), `key_entity_ids`, `ai_game`, `syngem_game`. `syngem_game = true` marks a dedicated SYNGEM AI character (created via intro flow); `ai_game = true` marks the AI pipeline active |
| `character_inventory` | Items owned by characters. `condition`, `is_equipped` (bool — exclusive per type category via store), `tracked` (bool, default false — marks items the AI should always be aware of: quest/special/rare items set at grant time via `state-executor`; equipped items always included in hydration via `OR is_equipped=true` query) |
| `character_skills` | Unlocked skills per character. `current_rank`, `unlocked_at` |
| `character_spells` | Spells known by character |
| `character_action_skills` | Contextual combat action skills |
| `skills` | Skill definitions. `max_rank`, `effects` (JSONB), `unlock_key`, `is_passive` |
| `skill_edges` | Skill tree prerequisite graph. `parent_id → child_id` |
| `items` | Item templates. Damage, defense, cost, weight, `effects` (JSONB) |
| `spells` | Spell definitions. Damage, AOE, range, cast_time, cooldown, `effects` (JSONB) |
| `active_skills` | Named contextual combat actions with `effects` (JSONB) |
| `games` | Game sessions. `gm_id`, `join_code`, `is_in_combat` (bool), `combat_phase` (`player_attack`\|`player_defend`\|null), `current_turn_order` (alive creature IDs for Phase B), `active_turn_index`, `combat_log` (string[]) |
| `game_members` | Player membership. `character_id`, `role`, `status` |
| `creatures` | Enemy/NPC templates. `ascii_art` (6-line monospace string for terminal sprite display) |
| `encounter_creatures` | Creature instances in active encounters. Copies full stat block including `strong_cost` and `strong_defence` from the creature template |
| `pending_offers` | Rewards awaiting player acceptance |
| `friends` | Friend relationships. `status`: pending → friend |
| `npcs` | Game NPCs. Faction, personality, disposition. `game_id` nullable — companion NPCs (e.g. Brin) have `game_id = null` and are linked via `following_character_id` |
| `quest_templates` | Quest definitions. `stages` JSONB (id, title, description, completion_hints), `start_grants` JSONB (items, NPCs), `completion_grants` JSONB (skill_points, denarius, items). `description_gm` is injected into Architect context but never shown to the player |
| `campaign_facts` | Session lore facts. `gm_only` flag |
| `world_entities` | World encyclopedia. Replaced `world_lore`. `type` enum, `data` JSONB, full-text `search_vector` |
| `player_entity_mutations` | Per-player overrides on `world_entities` (e.g. hidden doors, altered descriptions) |
| `improvised_entities` | Character-scoped entities created by the Architect's improvisations. Composite PK `(character_id, id)` keeps hallucinations per-character without polluting the canonical world. `parent_id` anchors to a `world_entities` location. Auto-Hydrator loads these for the current location and exposes them to the Architect as `=== SCENE OBJECTS ===` |
| `conversation_turns` | Persisted GM conversation history. `role` (`player`\|`assistant`), `turn_number` |
| `syngem_game` | Solo AI GM session state. One row per character. `game_date_days`, `game_time_minutes`, `in_combat`, `summary`. Keyed by `character_id` (unique). Fantasy calendar: 30-day months, 12 months/year |
| `prompt_versions` | Versioned agent system prompts. `slug`, `version`, `prompt` JSONB, `description` |
| `character_snapshots` | Point-in-time character state for undo/history |
| `roll_events` | Dice roll log per game session |
| `token_usage` | BYOK token spend log — append-only. `user_id`, `character_id`, `agent`, `model`, `input_tokens`, `output_tokens`. RLS: users SELECT own rows; GM server inserts via service role |

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
| `20260526130000_add_syngem_game_table.sql` | `syngem_game` table — solo AI GM session state; migrates `scribe_summary` from `characters` |
| `20260526140000_refactor_character_locations.sql` | Four-level location hierarchy: nation › region › place › immediate (FK to `world_entities`) |
| `20260527000000_simplify_character_location.sql` | Simplifies location to single `location_place` FK; parent chain derived at query time via `parent_id` |
| `20260527100000_add_syngem_game_to_characters.sql` | `syngem_game boolean NOT NULL DEFAULT false` on `characters` — distinguishes dedicated SYNGEM AI characters from IRL characters |
| `20260528000000_add_following_to_npcs.sql` | `following_character_id` FK on `npcs` — tracks which character an NPC is following |
| `20260529000000_add_byok_token_tracking.sql` | `token_budget` column on `profiles` + new `token_usage` table with RLS (BYOK spend tracking) |
| `20260529100000_drop_background_secondary.sql` | Drops unused `background_secondary` column from `characters` |
| `20260529200000_add_quest_engine.sql` | Makes `npcs.game_id` nullable; creates `quest_templates` table (RLS: service_role write, authenticated read); seeds 4 items (waystone, backpack, rations, tarp); seeds the `follow_the_waystone` quest template with Brin's NPC template, 7 stages, start grants, and completion grants |
| `20260529230000_add_combat_fields.sql` | Adds `ascii_art text` to `creatures`; adds `combat_phase text` (CHECK: player_attack\|player_defend) to `games`; adds `strong_cost integer` and `strong_defence integer` to `encounter_creatures` |
| `20260601000000_add_improvised_entities.sql` | `improvised_entities` table — character-scoped entities from Architect improvisations. Composite PK `(character_id, id)`. `parent_id → world_entities`. Index on `(character_id, parent_id)`. Authenticated SELECT policy |
| `20260606000000_add_tracked_to_character_inventory.sql` | `tracked BOOLEAN NOT NULL DEFAULT FALSE` on `character_inventory` — marks items the SYNGEM AI should always load (quest/special items, set at grant time) |
| `20260610000000_seed_evaluator_prompts.sql` | Seeds v1 evaluator prompts into `prompt_versions` for all 5 agents (slugs: `lore-engine-evaluator`, `architect1-evaluator`, `ledger-evaluator`, `scribe-evaluator`, `character-builder-evaluator`). DO block looks up dev user by email; skips gracefully if not found |

---

## Environment Variables

### `packages/web` (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Yes | Supabase secret key (bypasses RLS, server-side only) |
| `GM_API_KEY` | Yes | Shared secret sent as `Authorization: Bearer` on all GM proxy calls |

### `packages/server` (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Dev/server only | Claude API key. Optional when all users supply BYOK keys via `X-Anthropic-Key` header |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Supabase secret key (bypasses RLS) |
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
- **Forms** — React Hook Form + Zod validation (web); Zod `safeParse` for all LLM JSON output (server)
- **Comments** — only when the why is non-obvious

---

## In Progress / Planned

- **Combat system Phase 2:** status effects / conditions, consumable items in combat, flee mechanic, XP/loot grants on victory, ally turns (infrastructure present — `ally_` prefix in turn order)
- **Equip system (done):** "E" button on weapon/armor rows (IRL + SYNGEM dashboards), exclusive per-category equip via `equipItem` / `unequipAll` in store, debounced DB sync. Unarmed synthetic items auto-selected when no real weapon/armor is equipped; action card dropdown selection drives equip state.
- Body-part armor loadout system
- Scavenge module (timed item discovery)
- Crafting mechanic
- Finalize skill tree node design
- Revise item/creature/spell stat blocks
