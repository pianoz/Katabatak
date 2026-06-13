-- player_entity_mutations.player_id already stores character IDs (not auth user IDs).
-- Rename table and column to reflect actual semantics, add proper FK + cascade,
-- and fix the RLS policy that was silently broken.
-- Idempotent: safe to run even if some steps were already applied manually.

-- 1. Table rename
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'player_entity_mutations') THEN
    ALTER TABLE public.player_entity_mutations RENAME TO character_entity_mutations;
  END IF;
END $$;

-- 2. Column rename
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'character_entity_mutations'
      AND column_name  = 'player_id'
  ) THEN
    ALTER TABLE public.character_entity_mutations RENAME COLUMN player_id TO character_id;
  END IF;
END $$;

-- 3. FK constraint (drop-and-recreate is idempotent)
ALTER TABLE public.character_entity_mutations
  DROP CONSTRAINT IF EXISTS character_entity_mutations_character_id_fkey;
ALTER TABLE public.character_entity_mutations
  ADD CONSTRAINT character_entity_mutations_character_id_fkey
    FOREIGN KEY (character_id)
    REFERENCES public.characters(id)
    ON DELETE CASCADE;

-- 4. Index rename
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_player_mutations_lookup') THEN
    ALTER INDEX public.idx_player_mutations_lookup RENAME TO idx_character_entity_mutations_lookup;
  END IF;
END $$;

-- 5. Sequence rename (BIGSERIAL sequence doesn't auto-rename with the table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'player_entity_mutations_id_seq') THEN
    ALTER SEQUENCE public.player_entity_mutations_id_seq RENAME TO character_entity_mutations_id_seq;
  END IF;
END $$;

-- 6. RLS: drop old policies, create new ones
DROP POLICY IF EXISTS "player_select_own_mutations" ON public.character_entity_mutations;
DROP POLICY IF EXISTS "dev_all_player_mutations"    ON public.character_entity_mutations;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'character_entity_mutations'
      AND policyname = 'owner_select_character_entity_mutations'
  ) THEN
    CREATE POLICY "owner_select_character_entity_mutations"
      ON public.character_entity_mutations
      FOR SELECT TO authenticated
      USING (character_id IN (
        SELECT id FROM public.characters WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'character_entity_mutations'
      AND policyname = 'dev_all_character_entity_mutations'
  ) THEN
    CREATE POLICY "dev_all_character_entity_mutations"
      ON public.character_entity_mutations
      TO authenticated
      USING (public.is_dev())
      WITH CHECK (public.is_dev());
  END IF;
END $$;

-- 7. Grant on sequence
GRANT USAGE, SELECT ON SEQUENCE public.character_entity_mutations_id_seq TO service_role;
