-- player_entity_mutations.player_id already stores character IDs (not auth user IDs).
-- Rename table and column to reflect actual semantics, add proper FK + cascade,
-- and fix the RLS policy that was silently broken.

ALTER TABLE public.player_entity_mutations
  RENAME TO character_entity_mutations;

ALTER TABLE public.character_entity_mutations
  RENAME COLUMN player_id TO character_id;

-- Add FK so character deletion cascades (player_id had no FK previously)
ALTER TABLE public.character_entity_mutations
  ADD CONSTRAINT character_entity_mutations_character_id_fkey
    FOREIGN KEY (character_id)
    REFERENCES public.characters(id)
    ON DELETE CASCADE;

ALTER INDEX idx_player_mutations_lookup
  RENAME TO idx_character_entity_mutations_lookup;

-- Fix RLS: old policy compared character UUIDs against auth.uid() (broken).
DROP POLICY IF EXISTS "player_select_own_mutations" ON public.character_entity_mutations;
DROP POLICY IF EXISTS "dev_all_player_mutations"    ON public.character_entity_mutations;

CREATE POLICY "owner_select_character_entity_mutations"
  ON public.character_entity_mutations
  FOR SELECT TO authenticated
  USING (character_id IN (
    SELECT id FROM public.characters WHERE user_id = auth.uid()
  ));

CREATE POLICY "dev_all_character_entity_mutations"
  ON public.character_entity_mutations
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

GRANT USAGE, SELECT ON SEQUENCE public.character_entity_mutations_id_seq TO service_role;
