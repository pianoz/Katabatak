-- Add condition to track item durability through peer-to-peer transfers.
-- Add giver_inventory_id so the giver's inventory entry can be removed on acceptance.

ALTER TABLE pending_offers
  ADD COLUMN IF NOT EXISTS condition integer,
  ADD COLUMN IF NOT EXISTS giver_inventory_id uuid REFERENCES character_inventory(id) ON DELETE SET NULL;

-- Allow active game members to create pending offers for characters in the same game.
-- Required for player-to-player item giving (previously only GMs needed to insert).
DROP POLICY IF EXISTS "character owners can insert peer offers" ON pending_offers;
CREATE POLICY "character owners can insert peer offers"
  ON pending_offers FOR INSERT TO authenticated
  WITH CHECK (
    game_id IN (
      SELECT gm.game_id
      FROM game_members gm
      JOIN characters c ON c.id = gm.character_id
      WHERE c.user_id = auth.uid()
        AND gm.member_status = 'active'
    )
  );

-- Allow the recipient's client to delete the giver's inventory entry on acceptance.
-- This policy is a no-op when RLS is disabled on character_inventory.
DROP POLICY IF EXISTS "allow_peer_transfer_deletion" ON character_inventory;
CREATE POLICY "allow_peer_transfer_deletion"
  ON character_inventory FOR DELETE TO authenticated
  USING (
    id IN (
      SELECT giver_inventory_id
      FROM pending_offers
      WHERE giver_inventory_id IS NOT NULL
        AND character_id IN (
          SELECT id FROM characters WHERE user_id = auth.uid()
        )
    )
  );
