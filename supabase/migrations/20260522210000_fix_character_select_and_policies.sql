-- Fix 1: Allow GMs to read characters in their games (needed for getGameAllyCharacters)
CREATE POLICY "GMs can read characters in their games"
  ON public.characters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_members gm
      JOIN public.games g ON g.id = gm.game_id
      WHERE gm.character_id = characters.id
        AND (g.gm_id)::text = (auth.uid())::text
    )
  );

-- Fix 2: Allow active game members to read allied characters (so players can see each other)
CREATE POLICY "Game members can read allied characters"
  ON public.characters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_members viewer_mem
      JOIN public.game_members char_mem ON char_mem.game_id = viewer_mem.game_id
      WHERE char_mem.character_id = characters.id
        AND viewer_mem.profile_id = auth.uid()
        AND viewer_mem.member_status = 'active'
    )
  );

-- Fix 3: Recreate GM character UPDATE policy with explicit text casts to avoid uuid/text mismatch
DROP POLICY IF EXISTS "GMs can update characters in their games" ON public.characters;
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
        AND (g.gm_id)::text = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.game_members gm
      JOIN public.games g ON g.id = gm.game_id
      WHERE gm.character_id = characters.id
        AND (g.gm_id)::text = (auth.uid())::text
    )
  );

-- Fix 4: Recreate allow_peer_transfer_deletion with EXISTS instead of IN for clearer evaluation
DROP POLICY IF EXISTS "allow_peer_transfer_deletion" ON public.character_inventory;
CREATE POLICY "allow_peer_transfer_deletion"
  ON public.character_inventory
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pending_offers po
      WHERE po.giver_inventory_id = character_inventory.id
        AND po.giver_inventory_id IS NOT NULL
        AND po.character_id IN (
          SELECT c.id FROM public.characters c WHERE c.user_id = auth.uid()
        )
    )
  );
