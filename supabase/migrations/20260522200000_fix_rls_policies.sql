-- Fix 1: pending_offers.source_id — change from uuid to text so spell IDs (integers) can be stored
ALTER TABLE public.pending_offers ALTER COLUMN source_id TYPE text;

-- Fix 2: pending_offers — add DELETE policy so character owners can resolve (accept/decline) their own offers
CREATE POLICY "character owners can delete their pending offers"
  ON public.pending_offers
  FOR DELETE
  USING (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

-- Fix 3: skill_edges — replace admin-only DELETE with authenticated-user DELETE
-- (INSERT already allows any authenticated user; DELETE should match)
DROP POLICY IF EXISTS "admin delete" ON public.skill_edges;
CREATE POLICY "authenticated users can delete skill edges"
  ON public.skill_edges
  FOR DELETE
  TO authenticated
  USING (true);

-- Fix 4a: character_spells — drop overly-permissive INSERT policy (allows any user to write to any character)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.character_spells;

-- Fix 4b: character_spells — re-add INSERT restricted to the character's owner
CREATE POLICY "character owners can insert character spells"
  ON public.character_spells
  FOR INSERT
  TO authenticated
  WITH CHECK (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

-- Fix 4c: character_spells — add DELETE policy so character owners can remove their own spells
CREATE POLICY "character owners can delete character spells"
  ON public.character_spells
  FOR DELETE
  TO authenticated
  USING (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

-- Fix 4d: character_spells — add unique constraint so duplicate (character, spell) inserts error correctly
ALTER TABLE public.character_spells
  ADD CONSTRAINT character_spells_character_spell_unique UNIQUE (character_id, spell_id);

-- Fix 5: items — add INSERT / UPDATE / DELETE policies (only SELECT existed; catalog managed by authenticated users)
CREATE POLICY "authenticated users can insert items"
  ON public.items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update items"
  ON public.items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete items"
  ON public.items
  FOR DELETE
  TO authenticated
  USING (true);

-- Fix 6: characters — allow GMs to update in_game (and other fields) for characters in their games.
-- Required so kickPlayer can set in_game = false for a player's character.
CREATE POLICY "GMs can update characters in their games"
  ON public.characters
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_members gm
      JOIN public.games g ON g.id = gm.game_id
      WHERE gm.character_id = characters.id
        AND g.gm_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.game_members gm
      JOIN public.games g ON g.id = gm.game_id
      WHERE gm.character_id = characters.id
        AND g.gm_id = auth.uid()
    )
  );
