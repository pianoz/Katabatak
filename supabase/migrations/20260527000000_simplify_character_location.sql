-- Simplify character location to a single place-level FK.
-- Characters now store only location_place (a world_entities id of type 'place').
-- Parent chain (region, nation) is derived at query time via parent_id traversal.
--
-- IMPORTANT: 'loc_road_north' must exist in world_entities before running this migration.
-- It is the hardcoded fallback used when a place entity is deleted.

-- Replace any location_place that is NULL or does not exist in world_entities with the fallback.
-- This catches literal garbage values like 'none' as well as true NULLs.
UPDATE characters
SET location_place = 'loc_road_north'
WHERE location_place IS NULL
   OR location_place NOT IN (SELECT id FROM world_entities);

-- Set default so ON DELETE SET DEFAULT has a value to fall back to
ALTER TABLE characters ALTER COLUMN location_place SET DEFAULT 'loc_road_north';

-- Add FK with cascade rule: if a place is deleted, character is moved to the road
ALTER TABLE characters
  ADD CONSTRAINT characters_location_place_fkey
  FOREIGN KEY (location_place)
  REFERENCES world_entities(id)
  ON DELETE SET DEFAULT;

-- Drop the redundant location columns
ALTER TABLE characters
  DROP COLUMN IF EXISTS location_nation,
  DROP COLUMN IF EXISTS location_region,
  DROP COLUMN IF EXISTS location_immediate;
