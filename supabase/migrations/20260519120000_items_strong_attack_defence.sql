ALTER TABLE items
  ADD COLUMN IF NOT EXISTS strong_damage  integer,
  ADD COLUMN IF NOT EXISTS strong_defence integer,
  ADD COLUMN IF NOT EXISTS strong_cost    integer;
