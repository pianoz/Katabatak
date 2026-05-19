CREATE OR REPLACE FUNCTION save_skill_edges_delta(
  p_delete_ids  uuid[],
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
    INSERT INTO skill_edges (parent_skill_id, child_skill_id)
    SELECT
      (elem->>'parent_skill_id')::uuid,
      (elem->>'child_skill_id')::uuid
    FROM jsonb_array_elements(p_upsert_edges) AS elem
    ON CONFLICT (parent_skill_id, child_skill_id) DO NOTHING;
  END IF;
END;
$$;
