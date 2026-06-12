-- Add world_entity_id FK so npcs rows can reference their canonical world_entities base.
-- Add data JSONB column (mirrors world_entities.data) for short/long descriptions and knowledge.
-- Backfill data from existing small_summary + personality_profile columns.

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS world_entity_id VARCHAR(64)
    REFERENCES public.world_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_npcs_world_entity_id ON public.npcs(world_entity_id);

-- Backfill data for existing rows using small_summary and personality_profile.personality
UPDATE public.npcs
SET data = jsonb_build_object(
  'short_description', COALESCE(small_summary, ''),
  'long_description',  COALESCE((personality_profile->>'personality'), ''),
  'knowledge',         '[]'::jsonb
)
WHERE data = '{}'::jsonb;
