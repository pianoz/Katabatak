-- Fix Supabase security linter warnings:
-- 1. function_search_path_mutable on save_skill_edges_delta and search_world_lore
-- 2. rls_policy_always_true on active_skills, items, skill_edges, skills, spells
-- 3. anon_security_definer_function_executable (revoke anon EXECUTE)
-- 4. handle_new_user is a trigger-only function; revoke direct-call access

-- ============================================================
-- Fix 1: Add search_path and authorization guard to save_skill_edges_delta
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
  IF NOT (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_dev = true)
  ) THEN
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

-- Fix search_path on search_world_lore (no SECURITY DEFINER needed here)
CREATE OR REPLACE FUNCTION public.search_world_lore(search_query text)
RETURNS TABLE(
  id integer,
  name character varying,
  category public.lore_type,
  short_desc character varying,
  long_desc text,
  attributes jsonb,
  rank real
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    world_lore.id,
    world_lore.name,
    world_lore.category,
    world_lore.short_desc,
    world_lore.long_desc,
    world_lore.attributes,
    ts_rank(world_lore.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM world_lore
  WHERE world_lore.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC;
END;
$$;

-- ============================================================
-- Fix 2: Revoke anon EXECUTE on SECURITY DEFINER functions
--        These are not intended for unauthenticated API calls.
--        Note: authenticated EXECUTE is intentionally kept on
--        auth_user_is_game_member, is_game_gm, is_game_member
--        because they are used inside RLS policy expressions.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.auth_user_is_game_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_game_gm(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_game_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_skill_edges_delta(uuid[], jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_giver_inventory_for_offer(uuid, uuid) FROM anon;

-- handle_new_user is a trigger function; no role should call it directly via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ============================================================
-- Fix 3: Replace permissive RLS policies on catalog tables
-- ============================================================

-- active_skills: restrict writes to devs
DROP POLICY IF EXISTS "active_skills_delete" ON public.active_skills;
DROP POLICY IF EXISTS "active_skills_insert" ON public.active_skills;
DROP POLICY IF EXISTS "active_skills_update" ON public.active_skills;

CREATE POLICY "active_skills_insert" ON public.active_skills
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "active_skills_update" ON public.active_skills
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "active_skills_delete" ON public.active_skills
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));

-- items: restrict writes to devs
DROP POLICY IF EXISTS "authenticated users can delete items" ON public.items;
DROP POLICY IF EXISTS "authenticated users can insert items" ON public.items;
DROP POLICY IF EXISTS "authenticated users can update items" ON public.items;

CREATE POLICY "authenticated users can insert items" ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "authenticated users can update items" ON public.items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "authenticated users can delete items" ON public.items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));

-- skill_edges: replace permissive INSERT/DELETE (keep existing admin Edit/update policies)
-- "Enable insert for authenticated users only" WITH CHECK(true) → admin-only
-- "authenticated users can delete skill edges" USING(true) → admin-only
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.skill_edges;
DROP POLICY IF EXISTS "authenticated users can delete skill edges" ON public.skill_edges;

CREATE POLICY "Enable insert for authenticated users only" ON public.skill_edges
  FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

CREATE POLICY "authenticated users can delete skill edges" ON public.skill_edges
  FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

-- skills: replace permissive ALL and INSERT policies with admin-only
-- (consistent with existing "admin Edit/delete/update" pattern on skill_edges)
DROP POLICY IF EXISTS "allow auth users to edit skill tree" ON public.skills;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.skills;

CREATE POLICY "allow auth users to edit skill tree" ON public.skills
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

-- spells: restrict INSERT to devs
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.spells;

CREATE POLICY "Enable insert for authenticated users only" ON public.spells
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true));
