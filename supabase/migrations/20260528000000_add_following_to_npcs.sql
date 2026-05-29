-- Add following_character_id to npcs for escort/companion NPC behavior.
-- When set, the NPC travels with the specified character and appears in all location contexts.
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS following_character_id uuid
    REFERENCES public.characters(id) ON DELETE SET NULL;
