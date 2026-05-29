-- Add per-user token budget cap to profiles (null = unlimited)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_budget integer DEFAULT NULL;

-- Append-only log of token usage per agent call
CREATE TABLE public.token_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id  uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  agent         text NOT NULL,
  model         text NOT NULL,
  input_tokens  integer NOT NULL,
  output_tokens integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX token_usage_user_id_idx ON public.token_usage (user_id, created_at DESC);
CREATE INDEX token_usage_character_id_idx ON public.token_usage (character_id, created_at DESC);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage; service role handles inserts (bypasses RLS)
CREATE POLICY "user_select_own_token_usage"
  ON public.token_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
