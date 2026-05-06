-- Users
CREATE TABLE users (
  id        SERIAL PRIMARY KEY,
  username  VARCHAR(50)  UNIQUE NOT NULL,
  email     VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Games
CREATE TABLE games (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Game memberships — role is per-game (a user can be DM in one, player in another)
CREATE TABLE game_memberships (
  user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id   INTEGER REFERENCES games(id) ON DELETE CASCADE,
  role      VARCHAR(10) NOT NULL CHECK (role IN ('dm', 'player')),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

-- Skill tree nodes (per game, graph-style)
CREATE TABLE skill_nodes (
  id          SERIAL PRIMARY KEY,
  game_id     INTEGER REFERENCES games(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  tier        INTEGER DEFAULT 0,
  pos_x       FLOAT DEFAULT 0,
  pos_y       FLOAT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Skill tree edges (undirected; max 4 edges per node enforced by trigger)
CREATE TABLE skill_edges (
  id             SERIAL PRIMARY KEY,
  source_node_id INTEGER REFERENCES skill_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER REFERENCES skill_nodes(id) ON DELETE CASCADE,
  UNIQUE (source_node_id, target_node_id),
  CHECK (source_node_id <> target_node_id)
);

-- Trigger: reject insert if either endpoint already has 4 edges
CREATE OR REPLACE FUNCTION check_max_edges()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM skill_edges
      WHERE source_node_id = NEW.source_node_id
         OR target_node_id = NEW.source_node_id) >= 4 THEN
    RAISE EXCEPTION 'Skill node % already has 4 edges', NEW.source_node_id;
  END IF;
  IF (SELECT COUNT(*) FROM skill_edges
      WHERE source_node_id = NEW.target_node_id
         OR target_node_id = NEW.target_node_id) >= 4 THEN
    RAISE EXCEPTION 'Skill node % already has 4 edges', NEW.target_node_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_edges
BEFORE INSERT ON skill_edges
FOR EACH ROW EXECUTE FUNCTION check_max_edges();

-- Characters (belong to one user, tied to one game)
CREATE TABLE characters (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    INTEGER REFERENCES games(id) ON DELETE CASCADE,
  class      VARCHAR(50),
  level      INTEGER DEFAULT 1,
  notes      TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Skills unlocked per character
CREATE TABLE character_skills (
  character_id  INTEGER REFERENCES characters(id) ON DELETE CASCADE,
  skill_node_id INTEGER REFERENCES skill_nodes(id) ON DELETE CASCADE,
  unlocked_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (character_id, skill_node_id)
);
