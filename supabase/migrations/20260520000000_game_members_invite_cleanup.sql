-- Allow GMs to re-invite players who declined or were kicked.
--
-- 1. Remove duplicate (game_id, profile_id) rows — keep the highest-priority status.
-- 2. Add UNIQUE constraint on (game_id, profile_id) so invitePlayer can safely upsert.
-- 3. Enable RLS on game_members and add policies so GMs and players can manage rows.
--    (Required for the upsert and delete operations used by the new invite/kick/decline flow.)

-- ─── Step 1: Deduplicate ────────────────────────────────────────────────────
-- If multiple rows exist for the same (game_id, profile_id), keep the one with
-- the highest-priority status (active > invited > other), breaking ties by id.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY game_id, profile_id
      ORDER BY
        CASE member_status
          WHEN 'active'  THEN 1
          WHEN 'invited' THEN 2
          ELSE 3
        END,
        id
    ) AS rn
  FROM game_members
)
DELETE FROM game_members
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── Step 2: Unique constraint ──────────────────────────────────────────────
-- Enables: INSERT ... ON CONFLICT (game_id, profile_id) DO UPDATE ...
-- This is what allows re-inviting without creating a second row.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_members_game_profile_unique'
  ) THEN
    ALTER TABLE public.game_members
      ADD CONSTRAINT game_members_game_profile_unique UNIQUE (game_id, profile_id);
  END IF;
END $$;

-- ─── Step 3: RLS ────────────────────────────────────────────────────────────
-- If game_members already has RLS disabled and operations work, this is still
-- needed: the new invite flow calls upsert and delete, which require explicit
-- policies once RLS is enabled.

ALTER TABLE public.game_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gm_manage_members" ON public.game_members;
DROP POLICY IF EXISTS "member_select_game_members" ON public.game_members;
DROP POLICY IF EXISTS "player_update_own_membership" ON public.game_members;
DROP POLICY IF EXISTS "player_delete_own_membership" ON public.game_members;

-- GMs can fully manage membership for games they own.
CREATE POLICY "gm_manage_members"
  ON public.game_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_members.game_id
        AND games.gm_id::text = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_members.game_id
        AND games.gm_id::text = (auth.uid())::text
    )
  );

-- Game members can SELECT all rows for games they belong to.
-- auth_user_is_game_member is SECURITY DEFINER so it bypasses this RLS — no recursion.
CREATE POLICY "member_select_game_members"
  ON public.game_members FOR SELECT TO authenticated
  USING (auth_user_is_game_member(game_id));

-- Players can update their own row (accept an invite).
CREATE POLICY "player_update_own_membership"
  ON public.game_members FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Players can delete their own row (decline an invite removes the row entirely).
CREATE POLICY "player_delete_own_membership"
  ON public.game_members FOR DELETE TO authenticated
  USING (profile_id = auth.uid());
