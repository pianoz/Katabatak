-- prompt_versions is an append-only audit log of prompts.
-- Devs can insert. No one can update or delete. All authenticated users can read.

-- Drop the initial policies from add_prompt_versions migration
DROP POLICY IF EXISTS "prompt_versions_select" ON public.prompt_versions;
DROP POLICY IF EXISTS "prompt_versions_insert" ON public.prompt_versions;

-- All authenticated users can read all prompt versions
CREATE POLICY "select_prompt_versions" ON public.prompt_versions
  FOR SELECT TO authenticated
  USING (true);

-- Only devs can insert (no update or delete policies = those operations are blocked)
CREATE POLICY "dev_insert_prompt_versions" ON public.prompt_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_dev());

-- Grant table access to authenticated role (columns are readable, writable only via RLS)
GRANT SELECT, INSERT ON public.prompt_versions TO authenticated;
