-- RLS policies alone don't grant table access; explicit GRANTs are required
GRANT SELECT, INSERT, UPDATE, DELETE ON active_skills TO authenticated;
GRANT SELECT, INSERT, DELETE ON character_active_skills TO authenticated;
