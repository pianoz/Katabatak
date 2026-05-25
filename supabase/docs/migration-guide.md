# Database Migration Guide

> Last meaningful update: 2026-05-24 — initial doc

---

## Naming Convention

```
YYYYMMDDHHMMSS_description_in_snake_case.sql
```

Use the current UTC timestamp. The ordering is strict — Supabase applies migrations in lexicographic order. Don't backdate or reuse timestamps.

Examples:
```
20260524130000_add_notes_to_characters.sql   ✓
20260524_add_notes.sql                        ✗  (missing time)
add_notes_to_characters.sql                   ✗  (no timestamp)
```

---

## Checklist for a New Table

Every new table needs all of the following before pushing:

```sql
-- 1. CREATE TABLE with explicit owner
CREATE TABLE IF NOT EXISTS "public"."my_table" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  -- ...columns...
  PRIMARY KEY (id)
);
ALTER TABLE "public"."my_table" OWNER TO "postgres";

-- 2. Enable RLS (REQUIRED — tables without RLS are open to everyone)
ALTER TABLE "public"."my_table" ENABLE ROW LEVEL SECURITY;

-- 3. Add policies for each role that needs access
CREATE POLICY "Users can read their own rows"
  ON "public"."my_table" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rows"
  ON "public"."my_table" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Grant table access to authenticated role
GRANT ALL ON "public"."my_table" TO "authenticated";
GRANT ALL ON "public"."my_table" TO "service_role";

-- 5. Grant sequence access if using IDENTITY or serial columns
GRANT USAGE, SELECT ON SEQUENCE "public"."my_table_id_seq" TO "authenticated";
```

Missing RLS is a **security vulnerability**, not just a policy gap. Supabase Studio will warn about it; don't dismiss the warning.

---

## Checklist for Adding a Column

```sql
-- Safe to add with IF NOT EXISTS
ALTER TABLE "public"."characters"
  ADD COLUMN IF NOT EXISTS "notes" text;

-- Add a NOT NULL column? You need a DEFAULT or a backfill
ALTER TABLE "public"."characters"
  ADD COLUMN IF NOT EXISTS "ai_game" boolean NOT NULL DEFAULT false;
```

Avoid adding NOT NULL columns without a DEFAULT to tables with existing rows — the migration will fail.

---

## After Writing the Migration

1. **Regenerate types:**
   ```bash
   pnpm gen-types
   ```
   This rewrites `database.types.ts` at the repo root. Commit it with the migration. If you skip this, TypeScript will be out of sync with the DB.

2. **Check for RLS gaps:** If you added a table or changed access patterns, review existing policies. New foreign-key relations often need policies on both sides.

3. **Check the services:** If you added/renamed a column, update the relevant file in `packages/web/lib/services/`. The service layer types everything against `database.types.ts`, so TypeScript will surface the mismatch, but you still need to update the query.

---

## Testing Migrations Locally

Supabase has a local dev stack via the CLI, but this project is currently targeting the hosted Supabase project directly. To test migrations safely:

1. Create the migration SQL file locally.
2. Review it manually — check RLS, grants, NOT NULL safety.
3. Apply to the Supabase hosted project via the Dashboard SQL editor or `supabase db push`.
4. If something goes wrong, write a **rollback migration** with a new timestamp that reverts the change.

There is no automatic rollback — write a new file, don't edit the old one.

---

## Editing an Existing Migration

**Don't.** Supabase tracks which migrations have been applied. Editing an applied migration creates a checksum mismatch and will break `supabase db push`. Always write a new file.

---

## Current Migration Log

| File | Purpose |
|------|---------|
| `20260522150053_remote_schema.sql` | Initial schema — all core tables, enums, PL/pgSQL functions |
| `20260522175154_add_notes_to_characters.sql` | `notes` text column on `characters` |
| `20260522200000_fix_rls_policies.sql` | RLS corrections pass 1 |
| `20260522210000_fix_character_select_and_policies.sql` | Character select + policy fixes |
| `20260522220000_add_giver_inventory_delete_fn.sql` | PL/pgSQL helper for item trading flow |
| `20260522230000_add_character_snapshots.sql` | `character_snapshots` table |
| `20260522240000_add_roll_events.sql` | `roll_events` table |
| `20260522250000_add_effects_to_spells_items.sql` | `effects JSONB[]` on `spells` and `items` |
| `20260523000000_add_active_skills.sql` | `active_skills` table with `effects JSONB[]` |
| `20260523100000_fix_security_warnings.sql` | Security hardening (search_path, SECURITY DEFINER) |
| `20260523110000_add_missing_rls_policies.sql` | Fill RLS gaps on newer tables |
| `20260523120000_grant_active_skills_to_authenticated.sql` | RLS grants for `active_skills` |
| `20260523140000_add_is_dev_service_and_normalize_policies.sql` | `is_dev` profile flag + policy normalization |
| `20260523150000_add_ai_game_to_characters.sql` | `ai_game boolean` flag on characters |
| `20260524000000_add_prompt_versions.sql` | `prompt_versions` table for dev prompt tooling |
| `20260524100000_add_condition_to_characters.sql` | `condition` enum column on characters (distinct from `condition_text`) |
| `20260524200000_fix_prompt_versions_rls.sql` | RLS fix for prompt_versions |
