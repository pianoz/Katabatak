-- Full reset of games RLS policies.
-- Drops ALL existing policies on games (regardless of name) then recreates correct ones.
-- Uses SECURITY DEFINER helper for game_members lookup to bypass any game_members RLS.
-- Casts gm_id and auth.uid() to text to be safe regardless of column type.

-- Drop every existing policy on the games table
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'games'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.games', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Helper: check if current auth user is a member of a game.
-- SECURITY DEFINER bypasses game_members RLS so the subquery always works.
CREATE OR REPLACE FUNCTION public.auth_user_is_game_member(p_game_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_members
    WHERE game_id = p_game_id
      AND profile_id = auth.uid()
      AND member_status IN ('active', 'invited')
  );
$$;

-- SELECT: game owner or member
CREATE POLICY "games_select" ON public.games
  FOR SELECT TO authenticated
  USING (
    gm_id::text = (auth.uid())::text
    OR auth_user_is_game_member(id)
  );

-- INSERT: authenticated users only, must set gm_id to themselves
CREATE POLICY "games_insert" ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (gm_id::text = (auth.uid())::text);

-- UPDATE: game owner only
CREATE POLICY "games_update" ON public.games
  FOR UPDATE TO authenticated
  USING (gm_id::text = (auth.uid())::text)
  WITH CHECK (gm_id::text = (auth.uid())::text);

-- DELETE: game owner only
CREATE POLICY "games_delete" ON public.games
  FOR DELETE TO authenticated
  USING (gm_id::text = (auth.uid())::text);
