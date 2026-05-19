CREATE TABLE IF NOT EXISTS encounter_creatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  creature_id     uuid NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,
  name            text NOT NULL,
  level           integer,
  attack_damage   integer,
  attack_cost     integer,
  defence         integer,
  strong_attack   integer,
  health_max      integer,
  current_health  integer,
  power_max       integer,
  current_power   integer,
  will_max        integer,
  current_will    integer,
  essence_max     integer,
  current_essence integer,
  is_alive        boolean NOT NULL DEFAULT TRUE,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE encounter_creatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_manage_encounter_creatures"
  ON encounter_creatures
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = encounter_creatures.game_id
        AND games.gm_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = encounter_creatures.game_id
        AND games.gm_id = auth.uid()
    )
  );
