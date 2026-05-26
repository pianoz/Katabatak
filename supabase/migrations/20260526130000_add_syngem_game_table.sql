-- syngem_game: dedicated AI GM session state (1 character : 1 player : 1 session)
-- Fantasy calendar: 30-day months, 12 months/year (360 days/year)
-- game_date_days: days elapsed since Year 1 Day 1
--   display: year = floor(days/360)+1, month = floor((days%360)/30)+1, day = (days%360)%30+1
-- game_time_minutes: minutes past midnight (1440 = rollover to next day)
-- Default start: Year 1, Month 3 (March), Day 21, 17:00
--   game_date_days = (3-1)*30 + 21 = 81
--   game_time_minutes = 17*60 = 1020

CREATE TABLE syngem_game (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id      uuid        NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
  player_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  in_combat         boolean     NOT NULL DEFAULT false,
  game_date_days    integer     NOT NULL DEFAULT 81,
  game_time_minutes integer     NOT NULL DEFAULT 1020,
  summary           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing ai_game characters; scribe_summary moves here
INSERT INTO syngem_game (character_id, player_id, summary)
SELECT id, user_id, scribe_summary
FROM characters
WHERE ai_game = true AND user_id IS NOT NULL
ON CONFLICT (character_id) DO NOTHING;

ALTER TABLE syngem_game ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_syngem_game"
  ON syngem_game FOR SELECT
  USING (player_id = auth.uid());

CREATE POLICY "owner_insert_syngem_game"
  ON syngem_game FOR INSERT
  WITH CHECK (player_id = auth.uid());

-- Service role handles all writes (bypasses RLS)
