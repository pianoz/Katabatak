ALTER TABLE characters ADD COLUMN IF NOT EXISTS scribe_summary    text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS quest_objectives  jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS key_entity_ids    text[];
