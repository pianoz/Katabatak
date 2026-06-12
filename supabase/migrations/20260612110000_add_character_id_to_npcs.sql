-- npcs rows are per-character instances; the canonical NPC lives in world_entities.
-- Add character_id FK so character deletion cascades to owned NPC instances.
-- game_id FK is preserved — game deletion still cascades to NPCs independently.

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS character_id uuid
    REFERENCES public.characters(id) ON DELETE CASCADE;

-- Backfill companion NPCs (following_character_id is the ownership link)
UPDATE public.npcs
SET character_id = following_character_id
WHERE following_character_id IS NOT NULL
  AND character_id IS NULL;

-- Backfill game-owned NPCs via game_members
UPDATE public.npcs n
SET character_id = gm.character_id
FROM public.game_members gm
WHERE n.game_id = gm.game_id
  AND gm.character_id IS NOT NULL
  AND n.character_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_npcs_character_id ON public.npcs(character_id);
