-- Add effects JSONB column to spells and items.
-- Existing rows default to an empty array; old flat columns are left in place
-- for a graceful transition. Drop them once all rows are migrated to effects.

ALTER TABLE spells ADD COLUMN IF NOT EXISTS effects jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE items  ADD COLUMN IF NOT EXISTS effects jsonb NOT NULL DEFAULT '[]'::jsonb;
