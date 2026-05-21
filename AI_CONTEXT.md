# Katabatak — AI Context Document

This file is written for AI assistant consumption. It documents the full project: what it is, how the data is structured, how pieces interrelate, the frontend layout, and the visual style system. Use this to understand intent before making any changes.

---

## 1. What This Project Is

Katabatak is a **digital companion for a custom tabletop RPG system**. It is not a generic TTRPG tool — it implements a specific, bespoke ruleset. The game system has:

- Four resource pools per combatant: **Health, Essence, Power, Will**
- A **skill tree** of passive/active abilities that modify these pools and combat math
- An **inventory system** with durability/condition tracking
- A **spell grimoire** for magic users
- A **social layer**: friends, game sessions, and async item offers between players
- A **GM console** for managing encounters, awarding items/spells, and tracking live combat

The application is multi-role: users can be a **GM** (game master) running a game or a **Player** controlling a character inside a game. One user can be both across different games.

---

## 2. Repository Layout

```
Katabatak/
├── packages/
│   ├── web/                        # Next.js 16 app (App Router) — the main UI
│   │   ├── app/
│   │   │   ├── page.tsx            # Public landing page
│   │   │   ├── login/              # Auth pages (Supabase OAuth)
│   │   │   ├── dashboard/          # Main authenticated view
│   │   │   ├── characters/         # Character creation + detail
│   │   │   ├── game/
│   │   │   │   ├── [id]/           # GM console for a specific game
│   │   │   │   └── new/            # New game creation form
│   │   │   ├── dev/                # Admin tools (skill tree editor, item editor)
│   │   │   └── api/                # Next.js API routes
│   │   ├── components/
│   │   │   ├── types/supabase.ts   # Auto-generated DB types (source of truth for all row shapes)
│   │   │   ├── ui/                 # Shadcn/Radix primitives — do not edit directly
│   │   │   └── *.tsx               # Feature components (see Section 5)
│   │   ├── lib/
│   │   │   ├── supabase/           # client.ts, server.ts, middleware.ts
│   │   │   ├── skill-engine.ts     # Pure function: evaluates skill effects for combat math
│   │   │   ├── pending-offers.ts   # stagePendingOffer / resolvePendingOffer
│   │   │   ├── friend-logic.ts     # sendFriendRequest / approveFriendRequest / fetchFriends
│   │   │   ├── invite-logic.ts     # acceptInvite / declineInvite
│   │   │   └── utils.ts            # cn(), getConditionStyle()
│   │   └── hooks/                  # Custom React hooks
│   └── server/                     # Optional AI GM Node server (separate process)
├── supabase/
│   └── migrations/                 # Ordered SQL migrations (source of truth for schema)
├── AI_CONTEXT.md                   # This file
├── package.json                    # Monorepo root — pnpm workspaces
├── pnpm-workspace.yaml
└── .claude/CLAUDE.md               # Coding instructions for AI assistants
```

**Runtime**: Next.js App Router. Server components fetch data via `lib/supabase/server.ts`; client components use `lib/supabase/client.ts`. Auth is handled by Supabase SSR via `middleware.ts`.

**Type generation**: `pnpm gen-types` re-runs `supabase gen types` and overwrites `packages/web/components/types/supabase.ts`. Never hand-edit that file. Use `Tables<'table_name'>` helpers throughout the codebase.

---

## 3. Database Schema

The database is Supabase (PostgreSQL). All tables live in the `public` schema.

### 3.1 Core Entities

#### `profiles`
One row per Supabase auth user. `id` = auth UID.
- `username`, `full_name`, `avatar_url` — display fields
- `is_dev: boolean` — gates access to `/dev` admin pages. Only set manually in the DB.

#### `characters`
One character sheet per row. Owned by `user_id → profiles.id`.
- **Resource pools** (all paired `current_X` / `X_max`): `health`, `essence`, `power`, `will`
- `denarius` — in-world currency
- `level` — character level; also used to calculate starting skill points when joining a game
- `unused_skill_points` — spendable points to unlock skills (NOT NULL, default 0)
- `carrying_capacity` — max carry weight (in kg). Modified by skills (see skill-engine).
- `current_carry_weight` — live weight sum; kept in sync by the app when inventory changes.
- `speed` — movement value
- `weight_kgs`, `height` — physical stats (cosmetic)
- `background_primary`, `background_secondary` — RPG background choices (affect starting skills/items)
- `class_archetype` — optional archetype label
- `condition_text` — free-text status (e.g. "Poisoned", "Exhausted")
- **Location** (four levels of hierarchy): `current_location_region` (NOT NULL), `current_location_polis`, `current_location_local`, `current_location_building`, `current_location_text` (freeform)
- `backstory`, `physical_description` — narrative fields
- `in_game: boolean` — whether the character is currently assigned to an active game
- `is_active: boolean` — soft-delete / archival flag

#### `games`
One GM-run game session.
- `gm_id` — auth UID of the GM (legacy; prefer `gm_profile_id`)
- `gm_profile_id → profiles.id`
- `name`, `join_code` (random short code for invites)
- `is_private: boolean`
- `starting_level: integer` — when a player joins, their character receives `starting_level` skill points
- `is_in_session: boolean` — session is live
- `is_in_combat: boolean` — combat mode active
- `current_turn_order: string[]` — ordered list of character IDs in combat
- `active_turn_index: integer` — index into `current_turn_order` for whose turn it is
- `combat_log: string[]` — append-only array of combat event strings
- `session_number: integer` — incremented by the GM each session
- `archived: boolean`

#### `game_members`
Join table: `profile → game`. One row per user per game.
- `profile_id → profiles.id`
- `game_id → games.id` (CASCADE DELETE — deleting a game removes all membership rows)
- `character_id → characters.id` — the character this player is using in the game (nullable; set when player picks a character)
- `role: 'gm' | 'player'`
- `member_status: 'active' | 'invited'` — `invited` = pending invite not yet accepted

**Invariant**: A profile will have `role='gm'` and `member_status='active'` for any game they created. Players start with `member_status='invited'` and transition to `'active'` on acceptance.

---

### 3.2 Items & Inventory

#### `items`
Global catalog of all items. Shared across all games.
- `name`, `short_description`, `long_description`
- `type` — broad category (e.g. `'weapon'`, `'armor'`, `'consumable'`, `'tool'`)
- `subtype` — narrower category (e.g. `'sword'`, `'bow'`, `'light_armor'`)
- `damage` — damage string (e.g. `"1d6"`); also `strong_damage`
- `defence`, `strong_defence` — defense values
- `cost` — resource cost to use (e.g. action points). `cost_attribute_name → attributes.name` names which pool.
- `strong_cost` — cost for the strong action variant
- `die_count`, `modifier`, `modifier_attribute_name → attributes.name`, `coefficient`, `coefficient_attribute_name → attributes.name` — formula fields for damage calculation
- `weight` — in kg, affects `current_carry_weight`
- `default_condition` — initial durability 0–100
- `cost_gold` — purchase price in denarius
- `rarity` — e.g. `'common'`, `'rare'`, `'legendary'`
- `is_magical: boolean`
- `consumable: boolean` — single-use; remove from inventory on use
- `required_skill → skills.id` — skill needed to equip/use this item
- `action_text` — label for the use button
- `hidden: boolean` — hidden from shop/lists if true; used for special/reward items

#### `character_inventory`
Instance of an item held by a specific character.
- `character_id → characters.id`
- `item_id → items.id`
- `quantity: integer` — stack count
- `condition: integer` — 0–100 durability; degrades on use (especially for armor/weapons)
- `is_equipped: boolean`
- `acquired_at: timestamp`
- `custom_notes` — player annotation

**Weight tracking**: When inventory changes, the app sums `items.weight * character_inventory.quantity` for all rows of a character and writes back to `characters.current_carry_weight`.

#### `game_items`
Per-game availability of items (for a shop/loot system).
- `game_id → games.id`
- `item_id → items.id`
- `is_available_in_shop: boolean`
- `stock_quantity: integer`
- `custom_price_override: integer` — overrides `items.cost_gold` in this game
- `discovery_status` — whether players have discovered this item exists

---

### 3.3 Skills & Skill Tree

#### `skills`
Global catalog of skills. These are game-system definitions, not per-character.
- `name`, `skill_text` — display name and description
- `max_rank: integer` — how many times this skill can be leveled up (1 = single-unlock)
- `is_passive: boolean` — passive skills always apply; active skills require explicit use
- `effects: Json` — array of `SkillEffect` objects (see Section 4)
- `unlock_hint`, `unlock_key` — discovery mechanic: `unlock_key` is a code phrase the player must find in-world before the skill appears

#### `skill_edges`
Directed acyclic graph of skill prerequisites.
- `parent_skill_id → skills.id` — prerequisite skill
- `child_skill_id → skills.id` — skill being gated
- `required_rank: integer` — minimum rank of the parent required to unlock the child
- `edge_type` — reserved for future use (currently unused in the engine)

**Invariant**: To unlock a child skill, the character must have `character_skills.current_rank >= skill_edges.required_rank` for every row where `child_skill_id` matches.

#### `character_skills`
Junction table: which skills a character has unlocked, at what rank.
- `character_id → characters.id`
- `skill_id → skills.id`
- `current_rank: integer` — 1..max_rank
- `unlocked_at: timestamp`

**Spending skill points**: Each unlock/rank-up costs 1 from `characters.unused_skill_points`. Decrement and insert/update `character_skills` in the same transaction.

---

### 3.4 Spells & Grimoire

#### `spells`
Global catalog. `id` is a serial integer (not UUID — unlike most other tables).
- `name`, `description`, `type`, `subtype`
- `active: boolean` — whether the spell is enabled
- `cost`, `cost_attribute_name → attributes.name` — resource cost to cast (usually essence)
- `cast_time_min`, `cooldown_min`, `remain_time_min` — timing in in-game minutes
- `range_m`, `aoe_m` — spatial fields in meters
- `damage`, `defence` — combat values
- `modifier`, `modifier_attribute_name`, `coefficient`, `coefficient_attribute_name` — scaling formula fields (same pattern as items)
- `req_item_1/2/3 → items.id` — focus items required to cast (condition degrades on cast)
- `req_skill_1/2 → skills.id` — skill prerequisites

#### `character_spells`
Junction: which spells a character knows.
- `character_id → characters.id`
- `spell_id → spells.id`

---

### 3.5 Creatures & Combat

#### `creatures`
Template library of enemies/NPCs. Created by users with `is_dev=true` (or GM tools in future).
- `created_by → profiles.id`
- Resource pools: `health_max`, `essence_max`, `power_max`, `will_max` and matching `current_*`
- `armor_class` — flat defense threshold
- `attack_damage`, `attack_cost` — normal attack values; `attribute_cost_name` names which pool
- `strong_attack`, `strong_defence`, `strong_cost` — stronger variant action values
- `defence`, `defence_cost` — defense action values
- `level`, `speed`, `description`, `image_url`

#### `encounter_creatures`
Live instances of creatures **copied from the template** when added to an encounter. Stats can differ from the template (GMs may adjust health etc. mid-combat).
- `creature_id → creatures.id` — back-reference to template (for display name fallback)
- `game_id → games.id`
- `name` — copied from template at creation
- `is_alive: boolean` — false when health drops to 0
- All combat stat fields copied from the template at encounter creation

**Design intent**: `encounter_creatures` is ephemeral per-session state. Deleting an encounter creature does not affect the template.

---

### 3.6 Social & Transfer Systems

#### `friends`
Bidirectional friendship with pending state.
- `friend_1`, `friend_2 → profiles.id` — `friend_1` is always the **requester**
- `status: 'pending' | 'friend'`

**Invariant**: Only one row exists for any pair (no reciprocal rows). To check if two users are friends, query for rows where `(friend_1=A AND friend_2=B) OR (friend_1=B AND friend_2=A)` and `status='friend'`. Incoming requests to user B are rows where `friend_2=B AND status='pending'`.

**Operations** (all in `lib/friend-logic.ts`):
- `sendFriendRequest` — insert with `friend_1=sender, friend_2=recipient, status='pending'`. Checks for a reverse-pending row first to prevent duplicates.
- `approveFriendRequest` — update `status='friend'` on the row where `friend_2=currentUser`
- `removeFriendRow` — delete by row id

#### `pending_offers`
Staging area for async transfers of items, currency, spells, or skill points.
- `game_id → games.id` — scoped to a game session
- `character_id → characters.id` — the **recipient** character
- `type: offer_type` — `'item' | 'denarius' | 'skill_point' | 'spell'`
- `source_id: string` — FK meaning depends on `type`:
  - `'item'` → `items.id`
  - `'spell'` → `spells.id` (as string)
  - `'denarius'` / `'skill_point'` → unused / null
- `quantity: integer` — amount of currency/points, or item stack count
- `condition: integer` — item condition to transfer (0–100), only relevant for `type='item'`
- `giver_inventory_id → character_inventory.id` (nullable) — if present, this is a peer transfer: on acceptance, this inventory row is deleted from the giver's inventory

**Resolution** (`lib/pending-offers.ts → resolvePendingOffer`):
- Accept: insert into recipient's inventory / increment currency / grant skill points / grant spell, delete the giver's inventory row if `giver_inventory_id` is set, then delete the offer row
- Decline: delete the offer row immediately (no side effects)

---

### 3.7 World & Campaign Data

#### `campaign_facts`
Per-game discovered facts (lore entries).
- `game_id → games.id`
- `fact_summary`, `subject_entity`, `visibility`, `discovered_at_tick`

#### `npcs`
Per-game NPCs (not combat creatures).
- `game_id → games.id`
- `name`, `title`, `faction`
- `disposition_to_players: integer` — attitude scale
- `personality_profile: Json` — freeform personality object
- `attribute_modifiers: Json` — stat adjustments
- `current_location_id`, `last_seen_tick`, `is_alive`

#### `world_lore`
Global searchable world knowledge (not per-game).
- `category: lore_type` — `'nation' | 'region' | 'polis' | 'location' | 'npc' | 'item' | 'faction'`
- `name`, `short_desc`, `long_desc`
- `attributes: Json` — category-specific extra fields
- `search_vector` — PostgreSQL tsvector; queried via `search_world_lore(query)` DB function

#### `character_history`
Append-only event log for a character.
- `character_id → characters.id`
- `summary: string`
- `sold_objects_affected: Json`

#### `attributes`
Lookup table. Maps attribute names to numeric IDs. Used as FK targets in `items`, `spells`, and `creatures` for fields like `cost_attribute_name`, `modifier_attribute_name`, `coefficient_attribute_name`.

---

## 4. Skill Engine (`lib/skill-engine.ts`)

The skill engine is a **pure function** that computes derived combat math from a character's active skills. It is stateless and has no DB calls.

### Types

```typescript
type ResourcePool = 'will' | 'essence' | 'power' | 'health'

interface SkillEffect {
  type: 'stat_modifier' | 'pool_conversion' | 'resource_gain' | 'weight_reduction' | 'utility'
  target?: string        // 'damage' | 'defense' | 'carry_capacity' | item_type name | condition name
  source?: ResourcePool  // pool_conversion: pool being spent
  destination?: ResourcePool  // pool_conversion: pool requirement being substituted
  add?: number           // flat additive bonus (scaled × rank)
  multiply?: number      // multiplicative factor (delta scaled × rank)
  condition?: { weapon_type?, armor_type?, item_type?, is_combat? }  // when effect applies
  limit?: { amount: number, period: 'day' | 'rest' }  // max uses per period
  grant_spell?: string   // spell ID (as string) to grant
  grant_item?: string    // item ID to grant
}
```

`skills.effects` is stored as `Json` in the DB. At runtime, cast it to `SkillEffect[]`.

### Rank Scaling

- `add` scales **linearly**: effective add = `effect.add * rank`
- `multiply` scales the **delta**: effective multiply = `1 + (effect.multiply - 1) * rank`

So a rank-2 skill with `multiply: 1.1` yields `1.2`, not `1.21`.

### Effect Types

| Type | What it does |
|------|-------------|
| `stat_modifier` | Adds to `damage`, `defense`, or `carry_capacity` modifiers |
| `weight_reduction` | Reduces effective weight of items matching `target` (or all items if target omitted) |
| `pool_conversion` | When `destination` pool would be spent, spend `source` instead. Rate/flat from add/multiply. |
| `resource_gain` | On `actionType='rest'`, add `add` to `destination` pool |
| `utility` | Grant spells/items; allow removal of a named condition (`target`) |

### Entry Point

```typescript
evaluateSkillEffects(
  activeSkills: Array<{ effects: SkillEffect[]; current_rank: number }>,
  context: ActionContext,
  dailyTracker: Record<string, number>  // key format: "s{skillIndex}_e{effectIndex}"
): CalculationResult
```

Pass only skills where the character's `current_rank > 0`. The `dailyTracker` persists usage counts for limited effects (not yet persisted to DB; managed in client state).

---

## 5. Key Frontend Components

### Pages

| Route | Component | What it renders |
|-------|-----------|----------------|
| `/dashboard` | `dashboard/page.tsx` + `dashboard-content.tsx` | Games list (GM + player), character list, pending invites, friend requests |
| `/game/[id]` | `game/[id]/page.tsx` | Full GM console: Characters tab, Items, Spells, Creatures, Combat, Logs, Settings |
| `/game/new` | `game/new/page.tsx` | Game creation form with rules toggles and friend invite picker |
| `/characters/[id]` | Character detail page | Full character sheet via `character-dashboard.tsx` |

### Major Components

**`character-dashboard.tsx`** — The player-facing character sheet. Shows:
- Pool counters with increment/decrement buttons (Health, Essence, Power, Will)
- Attributes, speed, carry weight
- Skill tree viewer (read-only, with unlock button if points available)
- Spell grimoire tab
- Inventory tab: items with condition bar, equip/consume/drop/give actions
- Pending offer notification bell (shows incoming offers with accept/decline)

**`dashboard-content.tsx`** — Dashboard layout. Two-column: games list on left, characters list on right. Contains the top-level invite notification and friends modal entry point.

**`skill-tree-viewer.tsx`** — Visual DAG of skills. Unlocked skills show their current rank. Locked skills show as dimmed with prerequisite info. Clicking an available skill spends one `unused_skill_points` and inserts a `character_skills` row.

**`skill-tree-editor.tsx`** — Dev-only tool (gated by `is_dev`). CRUD for `skills` and `skill_edges`. Effects are edited as JSON.

**`invite-notification.tsx`** — Bell icon in the header. Polling or realtime subscription for `game_members` (invited status) and `friends` (pending status). Renders count badge, opens modal on click.

**`grant-item-to-character-modal.tsx`** — GM tool. GM selects one or more party members to receive an item. Creates `pending_offers` rows (type=`'item'`).

**`give-to-ally-modal.tsx`** — Player tool. Lets a player give an item from their inventory to another party member. Fetches other active members in the same game, creates a `pending_offers` row with `giver_inventory_id` set.

**`inspect-item-modal.tsx`** — Full-screen item detail overlay. Shows image, all stats, lore text. Context-sensitive action buttons: if viewing a pending offer, shows Accept/Decline. If viewing own inventory item, shows Give to Ally.

**`friends-modal.tsx`** — Profile search, friend list, send/remove friend requests.

**`friend-request-modal.tsx`** — Accept/decline UI for incoming friend requests.

---

## 6. Visual Style System

**Design language**: Brutalist Dark Fantasy. Inspired by Darkest Dungeon / MÖRK BORG.

### Typography

| Use case | Classes |
|----------|---------|
| Names, titles, major data | `font-serif` (Playfair Display) |
| UI labels, metadata, category tags | `font-sans text-[0.65rem] tracking-widest uppercase` |
| Descriptions, lore, flavor text | `font-serif text-sm italic` |
| Monospace / mechanical data | `font-mono text-xs` |

### Color Semantics

| Color | Meaning |
|-------|---------|
| Cyan / `cyan-400` / `cyan-500` | Magic, spells, the Grimoire, essence pool |
| Muted gray / `text-muted-foreground` | Neutral metadata, inactive states |
| Crimson / `red-*` | Danger, health, combat warnings |
| Amber / `yellow-*` | Power pool, warnings |
| `text-foreground` on `bg-card` | Standard card content |

Health bar: red. Essence bar: cyan. Power bar: amber/orange. Will bar: purple.

`getConditionStyle(percent: number)` in `lib/utils.ts` returns a CSS color interpolated from red (0%) to green (100%) for item condition bars.

### Layout & Component Rules

- **Borders over shadows**: `border border-border` on all card-like containers. No `shadow-*` unless for specific glows.
- **Square corners**: `rounded-none` or `rounded-sm` at most. No `rounded-xl` or `rounded-full` (except avatars).
- **Dense information**: Components pack data tightly. Labels are tiny (`text-[0.6rem]`); values are larger (`text-sm` or `text-base`).
- **High letter-spacing on labels**: `tracking-widest` or `tracking-[0.3em]` on all uppercase category/metadata labels.
- **Interactive states**: `hover:border-foreground/30` or `hover:bg-accent` for hover. Avoid gradients.

---

## 7. DB Functions & RLS

### DB Functions

| Function | Description |
|----------|-------------|
| `is_game_gm(p_game_id)` | Returns true if the calling auth user is the GM of the game |
| `is_game_member(p_game_id)` | Returns true if the calling user has any `game_members` row for the game |
| `auth_user_is_game_member(p_game_id)` | Alias used in RLS policies |
| `save_skill_edges_delta(p_delete_ids, p_upsert_edges)` | Bulk update skill graph: deletes by IDs, upserts new edges atomically |
| `search_world_lore(search_query)` | Full-text search via tsvector, returns ranked results |

### Key RLS Rules (inferred from migrations)

- `characters` rows are visible only to `user_id = auth.uid()` and to GM of the game the character is in
- `games` rows are visible to the GM and all active members
- `game_members` rows follow game visibility
- `pending_offers` visible to the recipient character's owner and the GM
- `friends` visible to both `friend_1` and `friend_2`
- `skills`, `items`, `spells`, `creatures` are publicly readable (catalog data); write access gated to `is_dev` users via `profiles.is_dev`

---

## 8. Data Flow Patterns

### Character joins a game
1. GM invites by profile ID → insert `game_members` row with `member_status='invited'`
2. Player sees invite in `invite-notification.tsx`
3. Player accepts → `invite-logic.ts` updates `member_status='active'`
4. App grants `games.starting_level` skill points: `characters.unused_skill_points += starting_level`

### GM gives item to character
1. GM opens grant-item modal, selects item and characters
2. `pending-offers.ts → stagePendingOffer` inserts `pending_offers` rows (type=`'item'`, `giver_inventory_id=null`)
3. Player sees offer in notification bell on `character-dashboard.tsx`
4. Player accepts → `resolvePendingOffer(id, true)` inserts `character_inventory` row and deletes the offer

### Player-to-player item transfer
Same as above but `giver_inventory_id` is set. On acceptance, the giver's `character_inventory` row is deleted, transferring the item.

### Skill unlock
1. Character has `unused_skill_points > 0`
2. All prerequisite skills have sufficient rank in `character_skills`
3. App calls: decrement `characters.unused_skill_points`, insert/upsert `character_skills` with `current_rank=1` (or increment if already present)
4. `evaluateSkillEffects` now includes this skill in calculations

### Combat round
1. GM sets `games.is_in_combat=true`, populates `games.current_turn_order` (array of character IDs)
2. Each turn: `active_turn_index` advances, wraps around
3. Damage events: `encounter_creatures.current_health` and `characters.current_health` are updated directly
4. Events appended to `games.combat_log`
5. Creature dies: `encounter_creatures.is_alive=false`

---

## 9. Common Gotchas

- `spells.id` is a **serial integer**, not a UUID. `character_spells.spell_id` is `number | null`. Do not treat it as a string when doing DB joins, but it may be stringified in `pending_offers.source_id`.
- `games.gm_id` is the raw auth UID; `games.gm_profile_id` is the `profiles.id` FK. They should be the same value (profiles.id = auth.uid()), but prefer `gm_profile_id` for joins.
- `characters.current_carry_weight` is denormalized and must be kept in sync manually by the app whenever `character_inventory` changes.
- `skill_edges.required_rank` defaults to 1 if null — assume 1.
- `items.damage` is a **string** (dice notation like `"2d6"`), not a number. `items.strong_damage` is also a string. Parse with a dice roller, not `parseInt`.
- `pending_offers.condition` only applies for `type='item'`. It is the **item's current durability** to be transferred, not a game condition status.
- The `friends` table has no unique constraint on the pair — the app logic in `friend-logic.ts` checks for duplicates before inserting.
