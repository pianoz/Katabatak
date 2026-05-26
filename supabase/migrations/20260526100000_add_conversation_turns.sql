CREATE TABLE conversation_turns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  game_id      uuid REFERENCES games(id) ON DELETE SET NULL,
  role         text NOT NULL CHECK (role IN ('player', 'assistant')),
  content      text NOT NULL,
  turn_number  integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversation_turns_character_id_idx ON conversation_turns (character_id, turn_number DESC);

ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;

-- Character owner can read their own turns
CREATE POLICY "character_owner_select_turns"
  ON conversation_turns FOR SELECT
  USING (
    character_id IN (
      SELECT id FROM characters WHERE user_id = auth.uid()
    )
  );

-- Service role handles all writes (bypasses RLS)
