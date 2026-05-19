ALTER TABLE creatures
  ADD COLUMN IF NOT EXISTS attack_damage       integer,
  ADD COLUMN IF NOT EXISTS attack_cost         integer,
  ADD COLUMN IF NOT EXISTS defence             integer,
  ADD COLUMN IF NOT EXISTS defence_cost        integer,
  ADD COLUMN IF NOT EXISTS strong_attack       integer,
  ADD COLUMN IF NOT EXISTS strong_defence      integer,
  ADD COLUMN IF NOT EXISTS strong_cost         integer,
  ADD COLUMN IF NOT EXISTS attribute_cost_name text,
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES profiles(id);
