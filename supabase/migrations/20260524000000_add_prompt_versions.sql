CREATE TABLE prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  prompt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_versions_select"
  ON prompt_versions FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "prompt_versions_insert"
  ON prompt_versions FOR INSERT
  WITH CHECK (created_by = auth.uid());
