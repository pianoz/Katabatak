-- Add new four-level location hierarchy
-- nation > region > place > immediate
-- immediate: building/structure/dungeon level (stores world_entity ID)
-- place: distinct town, neighborhood, dungeon complex
-- region: biome/geographic area
-- nation: political/cultural nation

ALTER TABLE characters ADD COLUMN IF NOT EXISTS location_nation    text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS location_region    text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS location_place     text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS location_immediate text;

-- Migrate data from old fields
UPDATE characters SET
  location_region    = current_location_region,
  location_place     = current_location_polis,
  location_immediate = current_location_building;

-- Drop old fields
ALTER TABLE characters
  DROP COLUMN IF EXISTS current_location_region,
  DROP COLUMN IF EXISTS current_location_polis,
  DROP COLUMN IF EXISTS current_location_building,
  DROP COLUMN IF EXISTS current_location_local,
  DROP COLUMN IF EXISTS current_location_text;

-- Remove scribe_summary from characters — moved to syngem_game.summary
ALTER TABLE characters DROP COLUMN IF EXISTS scribe_summary;
