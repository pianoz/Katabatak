CREATE TABLE prompt_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  slug_version integer NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('static', 'chain')),
  label text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]',
  player_input text NOT NULL DEFAULT '',
  expected_output jsonb,
  is_default boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE prompt_test_cases ENABLE ROW LEVEL SECURITY;

GRANT ALL ON prompt_test_cases TO authenticated;

CREATE POLICY "devs_select_test_cases"
  ON prompt_test_cases FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "devs_insert_test_cases"
  ON prompt_test_cases FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "devs_update_test_cases"
  ON prompt_test_cases FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_dev = true));

CREATE POLICY "devs_delete_test_cases"
  ON prompt_test_cases FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_dev = true));
