-- Add RLS policies for tables that have RLS enabled but no policies.
-- Without policies, RLS blocks all access (secure but unusable).

-- ============================================================
-- campaign_facts: GM-managed facts with per-row visibility
-- ============================================================
CREATE POLICY "gm_all_campaign_facts" ON public.campaign_facts
  TO authenticated
  USING (public.is_game_gm(game_id))
  WITH CHECK (public.is_game_gm(game_id));

-- Members see facts that aren't marked gm_only
CREATE POLICY "members_select_visible_campaign_facts" ON public.campaign_facts
  FOR SELECT TO authenticated
  USING (
    visibility <> 'gm_only'
    AND public.auth_user_is_game_member(game_id)
  );

-- ============================================================
-- character_history: append-only log; owner and GM can read
-- ============================================================
CREATE POLICY "character_owner_select_history" ON public.character_history
  FOR SELECT TO authenticated
  USING (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "character_owner_insert_history" ON public.character_history
  FOR INSERT TO authenticated
  WITH CHECK (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gm_select_character_history" ON public.character_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_members gm
      JOIN public.games g ON g.id = gm.game_id
      WHERE gm.character_id = character_history.character_id
        AND g.gm_id = auth.uid()
    )
  );

-- ============================================================
-- npcs: game-scoped; GMs manage, members read
-- ============================================================
CREATE POLICY "gm_all_npcs" ON public.npcs
  TO authenticated
  USING (public.is_game_gm(game_id))
  WITH CHECK (public.is_game_gm(game_id));

CREATE POLICY "members_select_npcs" ON public.npcs
  FOR SELECT TO authenticated
  USING (public.auth_user_is_game_member(game_id));

-- ============================================================
-- world_lore: global catalog; all authenticated read, devs write
-- Consistent with the items and spells write-access pattern.
-- ============================================================
CREATE POLICY "authenticated_select_world_lore" ON public.world_lore
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dev_insert_world_lore" ON public.world_lore
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true
  ));

CREATE POLICY "dev_update_world_lore" ON public.world_lore
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true
  ));

CREATE POLICY "dev_delete_world_lore" ON public.world_lore
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true
  ));
