-- SECURITY DEFINER function for deleting a giver's inventory entry during peer transfer.
-- RLS on character_inventory blocks the recipient (Bob) from directly deleting the
-- giver's (Alice's) row even when the allow_peer_transfer_deletion policy should allow it.
-- This function bypasses RLS while still verifying authorization explicitly via auth.uid().
CREATE OR REPLACE FUNCTION delete_giver_inventory_for_offer(
  p_offer_id uuid,
  p_giver_inventory_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the pending offer exists, the giver inventory matches, and the
  -- offer's recipient character is owned by the calling authenticated user.
  IF NOT EXISTS (
    SELECT 1
    FROM pending_offers po
    WHERE po.id = p_offer_id
      AND po.giver_inventory_id = p_giver_inventory_id
      AND po.character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: no matching pending offer for current user';
  END IF;

  DELETE FROM character_inventory WHERE id = p_giver_inventory_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_giver_inventory_for_offer(uuid, uuid) TO authenticated;
