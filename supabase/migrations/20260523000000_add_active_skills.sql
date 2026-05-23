-- active_skills: catalog of activatable skills with effects
CREATE TABLE IF NOT EXISTS active_skills (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  cooldown    integer,
  effects     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- character_active_skills: which active skills a character has learned
CREATE TABLE IF NOT EXISTS character_active_skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id    uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  active_skill_id uuid NOT NULL REFERENCES active_skills(id) ON DELETE CASCADE,
  UNIQUE (character_id, active_skill_id)
);

ALTER TABLE active_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_active_skills ENABLE ROW LEVEL SECURITY;

-- active_skills is a catalog — all authenticated users can read; devs can write
CREATE POLICY "active_skills_select" ON active_skills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "active_skills_insert" ON active_skills
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "active_skills_update" ON active_skills
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "active_skills_delete" ON active_skills
  FOR DELETE TO authenticated USING (true);

-- character_active_skills: users may only access their own character's data
CREATE POLICY "character_active_skills_select" ON character_active_skills
  FOR SELECT TO authenticated
  USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_active_skills_insert" ON character_active_skills
  FOR INSERT TO authenticated
  WITH CHECK (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_active_skills_delete" ON character_active_skills
  FOR DELETE TO authenticated
  USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));
