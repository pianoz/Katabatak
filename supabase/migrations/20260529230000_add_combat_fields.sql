-- ASCII sprite art for creatures (newline-delimited monospace block, ~6 lines)
ALTER TABLE creatures ADD COLUMN IF NOT EXISTS ascii_art text;

-- Round phase tracking on game sessions
ALTER TABLE games ADD COLUMN IF NOT EXISTS combat_phase text
  CHECK (combat_phase IN ('player_attack', 'player_defend'));

-- Copy strong combat stats to encounter_creatures so the engine doesn't need a join
ALTER TABLE encounter_creatures ADD COLUMN IF NOT EXISTS strong_cost integer;
ALTER TABLE encounter_creatures ADD COLUMN IF NOT EXISTS strong_defence integer;
