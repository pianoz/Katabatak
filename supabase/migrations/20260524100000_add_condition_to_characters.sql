-- Add condition status to characters.
-- Tracks afflictions applied by the GM (Poisoned, Infirm, Unconscious, Exhausted, Insane).

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS condition text
  CHECK (condition IN ('Poisoned', 'Infirm', 'Unconscious', 'Exhausted', 'Insane'));
