-- Add ai_game flag to characters.
-- When true, AI GM features (burndown timers, automated event triggers, etc.) are enabled.
-- Defaults to false — must be explicitly enabled per character.

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS ai_game boolean NOT NULL DEFAULT false;
