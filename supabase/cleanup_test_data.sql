-- Removes all test-run data. Safe to re-run (idempotent).
--
-- Auth user deletion cascades to:
--   profiles, characters, games, game_members, pending_offers,
--   character_inventory, character_spells, character_skills,
--   character_snapshots, character_active_skills, encounter_creatures
--
-- Run via: supabase db execute --file supabase/cleanup_test_data.sql
--      or: paste into the Supabase SQL editor
DELETE FROM auth.users WHERE email LIKE '%@test.local';

-- Catalog rows seeded by test helpers (no user FK, survive user cascade).
-- Matches the default naming used by seedItem / seedSpell / seedSkill /
-- seedCreature / seedActiveSkill in test-helpers.ts.
DELETE FROM public.items         WHERE name LIKE 'Test Item %';
DELETE FROM public.spells        WHERE name LIKE 'Test Spell %';
DELETE FROM public.skills        WHERE name LIKE 'Test Skill %';
DELETE FROM public.creatures     WHERE name LIKE 'Test Creature %';
DELETE FROM public.active_skills WHERE name LIKE 'Test Active Skill %';

-- NOTE: catalog rows seeded with custom names (e.g. "Offer Sword", "Snapshot Sword",
-- "Catalog Fireball") are NOT matched above. After the auth.users DELETE those rows
-- are orphaned (no character references them) but benign. Extend the patterns here
-- or delete by name if they accumulate.
