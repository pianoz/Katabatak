-- Allow character owners to read their own pending offers (fixes client-side SELECT and Realtime events)
CREATE POLICY "character owners can view their pending offers"
ON pending_offers
FOR SELECT
USING (
  character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  )
);
