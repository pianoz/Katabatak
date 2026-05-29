-- Quest Engine: quest_templates table, item seeds, and Waystone quest seed.
-- Also makes npcs.game_id nullable so companion NPCs can exist without a multiplayer game record.

-- 1. Make npcs.game_id nullable (solo SYNGEM has no games record)
ALTER TABLE npcs ALTER COLUMN game_id DROP NOT NULL;

-- 2. Quest templates table
CREATE TABLE quest_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description_gm TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',
  start_grants JSONB NOT NULL DEFAULT '{}',
  completion_grants JSONB NOT NULL DEFAULT '{}'
);

-- RLS: service_role writes; authenticated reads
ALTER TABLE quest_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON quest_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read" ON quest_templates FOR SELECT TO authenticated USING (true);

-- 3. Seed items
-- Waystone
INSERT INTO items (id, name, type, subtype, rarity, is_magical, weight, short_description, long_description, effects)
VALUES (
  'a1b2c3d4-0001-0000-0000-000000000001',
  'The Waystone',
  'artifact',
  'compass',
  'unique',
  true,
  0.3,
  'A small crystal disc with a needle suspended inside beneath glass. It does not point north.',
  'A palm-sized disc of pale crystal, smooth on both faces. Inside, beneath flawless glass, a slender needle hangs in some fluid that has never clouded. It does not point north. It points toward something only it knows. The needle has not wavered since you first held it.',
  '[]'
);

-- Worn Backpack
INSERT INTO items (id, name, type, subtype, rarity, is_magical, weight, short_description, long_description, effects)
VALUES (
  'a1b2c3d4-0002-0000-0000-000000000002',
  'Worn Backpack',
  'gear',
  'container',
  'common',
  false,
  0.6,
  'A travel-worn leather backpack. Heavy use has softened the straps.',
  'A leather pack, dark with age and use. The straps have been re-stitched at least once. There are three buckled pockets and a main compartment large enough to swallow most of what you need to carry.',
  '[]'
);

-- Travel Rations
INSERT INTO items (id, name, type, subtype, rarity, is_magical, consumable, weight, short_description, long_description, effects)
VALUES (
  'a1b2c3d4-0003-0000-0000-000000000003',
  'Travel Rations',
  'consumable',
  'food',
  'common',
  false,
  true,
  0.4,
  'A cloth-wrapped bundle of dried meat, hard bread, and a small block of salted cheese.',
  'Road food. Not good, but enough. The dried meat is chewy and tastes of smoke. The bread is dense and will last a week if kept dry. The cheese is wrapped separately and still has some give to it. You have eaten worse.',
  '[]'
);

-- Oilskin Tarp
INSERT INTO items (id, name, type, subtype, rarity, is_magical, weight, short_description, long_description, effects)
VALUES (
  'a1b2c3d4-0004-0000-0000-000000000004',
  'Oilskin Tarp',
  'gear',
  'shelter',
  'common',
  false,
  0.9,
  'A heavy oilskin sheet, large enough to shelter two people from rain.',
  'Stiff canvas, treated with oil until it is nearly waterproof. It smells of the treatment and faintly of smoke from previous nights. Four grommeted corners for tying. It has kept the rain off before and will again.',
  '[]'
);

-- 4. Seed the Waystone quest template
INSERT INTO quest_templates (id, title, description_gm, stages, start_grants, completion_grants)
VALUES (
  'follow_the_waystone',
  'The Waystone',
  'The waystone points toward a buried staircase two days east of Karkill, in the Sundry Flats desert. The staircase descends into a sealed chamber containing a clock-like mechanism that completes one revolution every two thousand years — currently almost at the end of a cycle. An inscription reads: "The Days of Rain are coming." An entity dormant inside the mechanism will animate when the clock completes its revolution (or when the chamber is disturbed). Antagonists: the Greycoats, agents of an unnamed authority who know the waystone exists and want to suppress what it points to. They are disciplined, not cruel — they believe they are preventing a panic. Brin is the only witness to the fire at the inn. She knows more than she lets on. She has seen the man with the grey coat before.',
  '[
    {
      "id": "arrive_in_karkill",
      "title": "Reach Karkill",
      "description": "You and Brin have reached the walls of Karkill as the waystone needle swings east for the first time.",
      "completion_hints": ["karkill", "town gate", "outer wall", "inn", "tavern", "arrive"]
    },
    {
      "id": "night_in_town",
      "title": "A Quiet Night",
      "description": "Find somewhere to sleep and eat in Karkill. The waystone still points east.",
      "completion_hints": ["supper", "sleep", "bed", "morning", "woke", "dawn", "rested"]
    },
    {
      "id": "meet_the_greycoats",
      "title": "The South Road",
      "description": "Soldiers or officials are coming. The grey coats. Time to decide: hide, run, or face them.",
      "completion_hints": ["soldiers", "greycoat", "grey coat", "official", "road", "south road", "horsemen"]
    },
    {
      "id": "follow_the_needle",
      "title": "East Into the Desert",
      "description": "The waystone leads east into the Sundry Flats. Two days walk from anywhere.",
      "completion_hints": ["desert", "flats", "sundry", "east", "two days", "needle points", "staircase"]
    },
    {
      "id": "the_clock_chamber",
      "title": "The Staircase",
      "description": "A staircase in the desert, going down. Below, a vast clock. Its inscription: the Days of Rain are coming.",
      "completion_hints": ["staircase", "stairs", "underground", "clock", "chamber", "mechanism", "two thousand", "days of rain"]
    },
    {
      "id": "the_battle",
      "title": "Something Wakes",
      "description": "Something in the clock has come to life. Combat begins.",
      "completion_hints": ["attacks", "animated", "wakes", "comes alive", "guardian", "battle begins", "fight"]
    },
    {
      "id": "completed",
      "title": "Survived",
      "description": "You got out. Whatever was in that chamber has been dealt with, or left behind.",
      "completion_hints": ["survived", "escaped", "fled", "defeated", "quest complete", "out of the chamber", "back to the surface"]
    }
  ]',
  '{
    "items": [
      {"item_id": "a1b2c3d4-0001-0000-0000-000000000001", "quantity": 1, "condition": 100},
      {"item_id": "a1b2c3d4-0002-0000-0000-000000000002", "quantity": 1, "condition": 85},
      {"item_id": "a1b2c3d4-0003-0000-0000-000000000003", "quantity": 3, "condition": 100},
      {"item_id": "a1b2c3d4-0004-0000-0000-000000000004", "quantity": 1, "condition": 90}
    ],
    "npcs": [
      {
        "name": "Brin",
        "title": "A girl on the road",
        "faction": null,
        "disposition_to_players": 55,
        "personality_profile": {
          "personality": "Quiet, watchful, nine or ten years old. She collects feathers. She has not cried since the fire. She speaks rarely but when she does it is exact. She notices things adults miss. She is frightened but will not show it. She has seen the man with the grey coat before — somewhere she cannot quite place.",
          "home_location_id": null,
          "routine": null,
          "memory": {
            "last_encounter_summary": "Met after the fire at the inn. Father Ollen did not get out. She was found in the yard, staring at where the building had been.",
            "known_facts": ["Her father was a farmer named Ollen", "She collects feathers", "She was travelling home from a market town"],
            "relationship_arc": "Survivor of the same fire. Dependent on the character for safety. Has not cried yet."
          },
          "current_task": null
        }
      }
    ]
  }',
  '{
    "skill_points": 3,
    "denarius": 50,
    "items": []
  }'
);
