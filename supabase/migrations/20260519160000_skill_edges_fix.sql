-- Add unique constraint required by the ON CONFLICT clause in save_skill_edges_delta.
-- Without this, every INSERT attempt throws a PostgreSQL error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'skill_edges'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'skill_edges_parent_child_unique'
  ) THEN
    ALTER TABLE skill_edges
      ADD CONSTRAINT skill_edges_parent_child_unique
      UNIQUE (parent_skill_id, child_skill_id);
  END IF;
END
$$;

-- Recreate the function to also persist edge_type from the payload.
CREATE OR REPLACE FUNCTION save_skill_edges_delta(
  p_delete_ids   uuid[],
  p_upsert_edges jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF array_length(p_delete_ids, 1) > 0 THEN
    DELETE FROM skill_edges WHERE id = ANY(p_delete_ids);
  END IF;

  IF jsonb_array_length(p_upsert_edges) > 0 THEN
    INSERT INTO skill_edges (parent_skill_id, child_skill_id, edge_type)
    SELECT
      (elem->>'parent_skill_id')::uuid,
      (elem->>'child_skill_id')::uuid,
      elem->>'edge_type'
    FROM jsonb_array_elements(p_upsert_edges) AS elem
    ON CONFLICT (parent_skill_id, child_skill_id) DO NOTHING;
  END IF;
END;
$$;