-- Consolidate dev-user access control:
--   1. is_dev() helper — used in all write RLS policies
--   2. set_user_dev_status() — the single authorized path for changing is_dev
--   3. Normalize skill_edges and skills write policies to use is_dev()
--   4. Update save_skill_edges_delta to use is_dev()
--
-- NOTE: The first dev must be bootstrapped manually via the Supabase dashboard:
--   UPDATE profiles SET is_dev = true WHERE id = '<your-user-id>';
-- After that, the /dev/users page handles promotions through set_user_dev_status().
--
-- SECURITY NOTE: The "Users can update own profile" RLS policy allows users to
-- set is_dev = true on themselves directly. This is acceptable for a private project.
-- For a public deployment, add a BEFORE UPDATE trigger to block direct is_dev changes.

-- ============================================================
-- 1. is_dev() helper — used in RLS policy expressions
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_dev()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_dev = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_dev() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_dev() TO authenticated;

-- ============================================================
-- 2. set_user_dev_status() — atomic service for granting/revoking dev access
--    Only callable by existing dev users (or service role).
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_dev_status(
  target_user_id uuid,
  dev_status boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Unauthorized: caller must have is_dev = true';
  END IF;

  UPDATE profiles SET is_dev = dev_status WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_dev_status(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_dev_status(uuid, boolean) TO authenticated;

-- ============================================================
-- 3a. Normalize skill_edges write policies
--     Drop everything (old app_metadata + interim OR checks) and replace cleanly.
-- ============================================================
DROP POLICY IF EXISTS "admin Edit" ON public.skill_edges;
DROP POLICY IF EXISTS "admin delete" ON public.skill_edges;
DROP POLICY IF EXISTS "admin update" ON public.skill_edges;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.skill_edges;
DROP POLICY IF EXISTS "authenticated users can delete skill edges" ON public.skill_edges;

CREATE POLICY "dev_insert_skill_edges" ON public.skill_edges
  FOR INSERT TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "dev_update_skill_edges" ON public.skill_edges
  FOR UPDATE TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

CREATE POLICY "dev_delete_skill_edges" ON public.skill_edges
  FOR DELETE TO authenticated
  USING (public.is_dev());

-- ============================================================
-- 3b. Normalize skills write policy
--     Drop the interim app_metadata OR is_dev check; use is_dev() directly.
-- ============================================================
DROP POLICY IF EXISTS "allow auth users to edit skill tree" ON public.skills;

CREATE POLICY "dev_all_skills" ON public.skills
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

-- ============================================================
-- 4. Update save_skill_edges_delta to use is_dev()
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_skill_edges_delta(
  p_delete_ids uuid[],
  p_upsert_edges jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF array_length(p_delete_ids, 1) > 0 THEN
    DELETE FROM skill_edges WHERE id = ANY(p_delete_ids);
  END IF;

  IF jsonb_array_length(p_upsert_edges) > 0 THEN
    INSERT INTO skill_edges (parent_skill_id, child_skill_id)
    SELECT
      (elem->>'parent_skill_id')::uuid,
      (elem->>'child_skill_id')::uuid
    FROM jsonb_array_elements(p_upsert_edges) AS elem
    ON CONFLICT (parent_skill_id, child_skill_id) DO NOTHING;
  END IF;
END;
$$;
