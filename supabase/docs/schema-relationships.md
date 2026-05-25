# Database Schema — Relationships & Data Model

> Last meaningful update: 2026-05-24 — initial doc  
> Authoritative column list: `database.types.ts` (root) — regenerate with `pnpm gen-types`

This doc explains *how tables relate* and *why things are structured the way they are*. For exact column types and nullability, read `database.types.ts`.

---

## Entity Map

```
auth.users (Supabase Auth)
  └─ profiles (1:1, created by trigger handle_new_user)
       └─ characters (1:many, user_id → profiles.id)
            ├─ character_inventory (many:many via item_id → items)
            ├─ character_skills    (many:many via skill_id → skills)
            ├─ character_spells    (many:many via spell_id → spells)
            ├─ character_action_skills (many:many via action_skill_id → action_skills)
            ├─ character_history   (1:many, narrative session summaries)
            ├─ character_snapshots (1:many, point-in-time full-state JSON)
            └─ roll_events         (1:many, dice roll audit log)

skills
  └─ skill_edges (self-referential: parent_skill_id → child_skill_id)

games
  ├─ game_members (many:many: profile_id, character_id, role, status)
  ├─ encounter_creatures (active combat instances, stamped from creatures template)
  ├─ npcs (per-game NPC roster)
  ├─ game_items (per-game item availability / shop)
  ├─ campaign_facts (session lore, gm_only flag)
  └─ pending_offers (unaccepted rewards: items, denarius, spells, skill_points)

profiles ←→ friends (bidirectional: friend_1, friend_2 with status pending|friend)

world_lore (standalone, full-text search via search_world_lore())
attributes (lookup table for moddable stat names)
prompt_versions (versioned GM system prompts)
```

---

## The Character → Skills → Effects Chain

This is the most important data chain in the system.

```
characters
  └─ character_skills (character_id, skill_id, current_rank)
       └─ skills (id, name, effects JSONB[], max_rank, is_passive, unlock_key)
            └─ skill_edges (parent_skill_id → child_skill_id)
```

`skills.effects` is a `JSONB` array. Each element is an effect object validated by Zod client-side (`lib/schemas/skill-effect.ts`). The DB stores it as opaque JSON — **there is no DB-level constraint on the effect structure**. If you bypass the frontend service layer, you can write invalid effects that silently break the effect engine.

The **effect engine** (`lib/effect-engine.ts`) evaluates the effects array at read time, scaling by `current_rank`. It is a client-only operation — the GM server does not run the effect engine.

The same JSONB pattern applies to:
- `spells.effects` (added in `20260522250000`)
- `items.effects` (added in `20260522250000`)
- `active_skills.effects` (added in `20260523000000`)

---

## The `action_skills.effect` vs `effects` Gotcha

`action_skills` has **two** effect columns:

| Column | Type | Status |
|--------|------|--------|
| `effect` | `JSONB` (singular) | **Legacy** — original single-effect field |
| `effects` | `JSONB` (array) | **Current** — multi-effect array, same pattern as skills/spells/items |

When reading active skills, prefer `effects[]`. The `effect` (singular) column was the pre-refactor pattern and may still be populated on older records. The effect editor writes to `effects[]` only.

---

## Game Session Relationships

```
games
  ├─ gm_id (uuid → auth.users) — the GM profile
  ├─ current_turn_order uuid[]  — ordered array of game_members.id values
  └─ active_turn_index integer  — pointer into current_turn_order

game_members
  ├─ game_id → games
  ├─ profile_id → profiles
  ├─ character_id → characters (null until player selects a character)
  ├─ role: 'player' | 'gm'
  └─ member_status: 'none' | 'invited' | 'active'
```

**Combat turn order** is stored as an array of `game_members.id` UUIDs directly on `games`. `active_turn_index` increments through it. The front-end advances this; there is no server-side turn guard.

**Encounter creatures** are *snapshots*, not references:

```
encounter_creatures
  ├─ game_id → games
  ├─ creature_id → creatures (template reference, mostly informational)
  └─ all combat stats copied at spawn time (health_max, current_health, etc.)
```

When a creature is added to an encounter, its stats are copied from the `creatures` template. Subsequent template edits do not affect active encounter rows. Kill by setting `is_alive = false`.

---

## Pending Offers (Reward Flow)

```
pending_offers
  ├─ game_id → games
  ├─ character_id → characters (recipient)
  ├─ type: offer_type enum (item | denarius | skill_point | spell)
  ├─ source_id uuid (item or spell id, null for denarius/skill_point)
  └─ quantity integer
```

The GM creates a pending offer via the Grant Reward modal. The player's character sheet polls `pending_offers` via `use-pending-offers.ts` and shows an accept/decline overlay. Accepting calls `pending-offer-service.ts` which applies the reward and deletes the row.

---

## Auth & RLS Summary

**Two Supabase clients:**
- `anon key` — browser client, all requests pass through RLS policies
- `service role key` — server-side only (GM server + Next.js API routes that need to bypass RLS). Never expose in the browser.

**Common RLS functions used in policies:**
- `is_game_gm(game_id)` — true if `auth.uid() = games.gm_id`
- `is_game_member(game_id)` — true if profile is an active member
- `auth_user_is_game_member(game_id)` — includes `invited` status

**`profiles.is_dev`** — when true, the user sees dev-only routes (`/dev/*`) and bypasses some RLS policies that lock skill/item editing to service role only. Set this manually in Supabase Studio.

**New tables always need RLS.** See `supabase/docs/migration-guide.md` for the checklist.

---

## Character Snapshots & Roll Events

```
character_snapshots
  ├─ character_id → characters
  ├─ snapshot jsonb  — full character row at point in time
  ├─ taken_at timestamp
  └─ label text (optional — e.g., "before level up")

roll_events
  ├─ character_id → characters
  ├─ type: 'attack' | 'defence' | 'check'
  ├─ base_roll, modifier, total
  └─ context jsonb (free-form metadata about what the roll was for)
```

Snapshots are used for undo/rollback via `snapshot-service.ts`. Roll events are an audit log; the GM server could query them to contextualize AI responses (not yet wired up).

---

## Lore & World Data

```
world_lore
  ├─ category: lore_type enum (nation|region|polis|location|npc|item|faction)
  ├─ short_desc, long_desc
  ├─ attributes jsonb (free-form extra data)
  └─ search_vector tsvector (full-text search index)
```

Search via `search_world_lore(query text)` PL/pgSQL function — returns rows ranked by relevance. The GM server could call this as a tool to answer lore questions (not yet a tool).

---

## Prompt Versions

```
prompt_versions
  ├─ name, slug (human identifier)
  ├─ version integer (auto-incremented per slug)
  ├─ prompt jsonb (full prompt structure)
  └─ created_by → auth.users
```

Added in `20260524000000`. Used by the dev prompt builder to version and compare system prompts. Not yet wired to the live GM — the GM server reads its system prompt from code, not this table.
