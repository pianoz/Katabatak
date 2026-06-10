-- =============================================================
-- seed.sql  —  Dev / test data for local Supabase (port 54322)
-- Run:  psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql
--
-- One dev user, one character, one SYNGEM game session.
-- Fixed UUIDs throughout so the file is idempotent.
-- =============================================================

BEGIN;

-- =============================================================
-- REFERENCE DATA  (world, items, skills, spells, creatures)
-- Safe to run many times — ON CONFLICT DO NOTHING throughout.
-- =============================================================

-- -------------------------------------------------------------
-- World Entities
-- Canonical hierarchy: nat_kataba → reg_karkill_vale → places
-- These IDs are referenced by character location FKs and NPCs.
-- 'loc_road_north' is the required default for characters.location_place.
-- -------------------------------------------------------------
INSERT INTO public.world_entities (id, name, type, parent_id, nation_context, region_context, place_context, data)
VALUES
  -- Nation
  ('nat_kataba', 'Kataba', 'nation', null, 'Kataba', null, null,
   '{"short_description": "A wild, ancient land of fractured kingdoms and older silences.",
     "long_description": "Kataba is not a unified nation so much as a shared misery — a landmass too large to conquer and too ungovernable to hold. Its people share a language, a calendar, and a deep suspicion of anyone who claims authority over more than their own hearth. The Compact of Ash, signed after the last civil war, nominally binds the eight vale-lords to a common peace.",
     "capital": "None recognized"}'::jsonb),

  -- Region
  ('reg_karkill_vale', 'Karkill Vale', 'region', 'nat_kataba', 'Kataba', 'Karkill Vale', null,
   '{"short_description": "A wind-scoured coastal vale hemmed by black basalt cliffs.",
     "long_description": "Karkill Vale runs north-to-south along the western coast of Kataba, a narrow corridor of cold sea-wind and grey stone. The Vale is sparsely populated and strategically unimportant except for the anchorage at Karkill Mouth, which every invading fleet in history has tried to take.",
     "terrain": "coastal cliffs, scrub moor"}'::jsonb),

  -- Places
  ('loc_karkill_settlements', 'Karkill Settlements', 'place', 'reg_karkill_vale', 'Kataba', 'Karkill Vale', 'Karkill Settlements',
   '{"short_description": "A scatter of fishing hamlets clinging to the Karkill coastline.",
     "long_description": "The Karkill Settlements are a loose chain of salt-bitten villages stretching along the rocky northern shore. Each hamlet maintains its own smokehouse, its own grudges, and its own interpretation of the old tide-laws. Strangers are noted but rarely welcomed.",
     "population": "sparse",
     "primary_trade": "fish, salted eel"}'::jsonb),

  ('loc_road_north', 'North Road', 'place', 'reg_karkill_vale', 'Kataba', 'Karkill Vale', 'North Road',
   '{"short_description": "A packed-dirt road running north along the vale edge.",
     "long_description": "The north road is little more than a worn track between grey stones, wide enough for a single cart. Reed-grass grows in the middle where wheels do not press it flat. It connects the Karkill settlements to the interior passes but sees light traffic — most people who know the vale travel by boat."}'::jsonb),

  ('loc_black_flounder_inn', 'The Black Flounder', 'place', 'loc_karkill_settlements', 'Kataba', 'Karkill Vale', 'Karkill Settlements',
   '{"short_description": "A low-ceilinged inn that smells of smoked fish and old ale.",
     "long_description": "The Black Flounder occupies a converted warehouse near the water. Its sign — a painted flounder on blackened wood — hangs at a permanent tilt. The common room is large enough for a dozen travelers but rarely holds more than four. Alberto and Aluette have run it for twenty years. The ale is unremarkable. The fish pie is not."}'::jsonb),

  ('loc_maryannes_house', 'Maryanne''s Cottage', 'place', 'loc_karkill_settlements', 'Kataba', 'Karkill Vale', 'Karkill Settlements',
   '{"short_description": "A weathered cottage at the dune line, nets hung from every beam.",
     "long_description": "The cottage is older than anyone in the settlement can remember. Nets in various states of repair hang from the eaves, the fence posts, and most of the interior beams. Maryanne has lived here alone since her husband did not return from the sea. She knows the tides better than anyone."}'::jsonb),

  ('loc_grevil_house', 'Grevil House', 'place', 'loc_karkill_settlements', 'Kataba', 'Karkill Vale', 'Karkill Settlements',
   '{"short_description": "A tightly shuttered house at the settlement''s edge. Faint chemical smell.",
     "long_description": "The shutters on every window have been nailed from the inside. A faint smell of sulfur drifts under the door. The neighbors maintain a polite distance. Silas Grevil rarely comes out and speaks to no one when he does."}'::jsonb),

  ('loc_desert_west', 'The Sundry Flats', 'place', 'reg_karkill_vale', 'Kataba', 'Karkill Vale', 'Sundry Flats',
   '{"short_description": "A vast salt desert west of the vale. Nothing survives here easily.",
     "long_description": "The Sundry Flats are a bleached expanse of salt-cracked earth and low dunes that extends west from the Karkill cliffs for two days on horseback. The sun here is different — flatter and more relentless. There is no shade. There is no water. There is, occasionally, a staircase going down."}'::jsonb)

ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- Attributes
-- -------------------------------------------------------------
INSERT INTO public.attributes (name) VALUES
  ('health'),
  ('power'),
  ('will'),
  ('essence')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------
-- Items
-- The two fixed IDs below are hardcoded in character-service.test.ts
-- as STARTING_ITEM_IDS — keep them stable.
-- -------------------------------------------------------------
INSERT INTO public.items (
  id, name, type, subtype,
  damage, rarity, short_description, long_description,
  cost_gold, weight, is_magical,
  die_count, modifier, defence,
  cost, cost_attribute_name, consumable
) VALUES
  -- starting items (referenced in tests)
  ('f761376b-f5aa-4834-abdb-1f7e0acc1c29',
   'Iron Dagger', 'weapon', 'melee',
   '1d4', 'common', 'A short iron dagger. Quick and quiet.',
   'Standard-issue camp knife adapted for close combat. Light enough to throw in a pinch.',
   5, 1, false, 1, 0, 0, 0, null, false),

  ('8200bd07-931c-433f-a92e-69472d213350',
   'Traveler''s Pack', 'gear', 'utility',
   null, 'common', 'A worn canvas pack stuffed with basic road supplies.',
   'Contains rope, flint, dried rations, and a folded oilskin. The kind of thing every caravan guard carries.',
   10, 5, false, 1, 0, 0, 0, null, false),

  -- weapons
  ('c1000000-0000-0000-0000-000000000001',
   'Iron Sword', 'weapon', 'melee',
   '1d6', 'common', 'A reliable single-handed sword.',
   'Standard military iron. Nothing elegant about it — just a tool that does its job. Carried by half the sell-swords in Tuur-Thalen.',
   15, 3, false, 1, 0, 0, 1, 'power', false),

  ('c1000000-0000-0000-0000-000000000002',
   'Longbow', 'weapon', 'ranged',
   '1d8', 'common', 'A yew longbow. Effective at range.',
   'Takes months to master. In the hands of someone who knows it, it is the most cost-efficient way to end a fight before it starts.',
   20, 2, false, 1, 0, 0, 1, 'power', false),

  ('c1000000-0000-0000-0000-000000000008',
   'Steel Sword', 'weapon', 'melee',
   '1d8', 'uncommon', 'Finely forged steel. Holds an edge.',
   'Noticeably heavier than iron but the balance is better. A craftsman''s weapon — the kind a successful mercenary upgrades to.',
   40, 3, false, 1, 1, 0, 1, 'power', false),

  -- armor
  ('c1000000-0000-0000-0000-000000000003',
   'Leather Armor', 'armor', 'light',
   null, 'common', 'Tanned hide that offers basic protection.',
   'Boiled leather plates stitched over a linen underlayer. Cheap, repairable, and quiet enough not to wake a sleeping camp.',
   12, 8, false, 1, 0, 2, 0, null, false),

  ('c1000000-0000-0000-0000-000000000004',
   'Iron Shield', 'armor', 'shield',
   null, 'common', 'A battered iron buckler.',
   'Dented from use, which means it has done its job at least once. The grip is worn smooth.',
   8, 6, false, 1, 0, 1, 0, null, false),

  ('c1000000-0000-0000-0000-000000000009',
   'Chain Mail', 'armor', 'medium',
   null, 'uncommon', 'Interlocked rings. Heavier but more protective.',
   'Clanks when you walk and rusts if you neglect it. Worth the inconvenience when blades start swinging.',
   50, 14, false, 1, 0, 3, 0, null, false),

  -- consumables
  ('c1000000-0000-0000-0000-000000000005',
   'Health Potion', 'consumable', 'potion',
   null, 'uncommon', 'Restores health when consumed.',
   'A bitter red draught in a clay vial. Smells like copper and pine resin. Works fast.',
   8, 0, false, 1, 6, 0, 0, null, true),

  -- gear
  ('c1000000-0000-0000-0000-000000000006',
   'Torch', 'gear', 'light',
   null, 'common', 'Burns for one hour. Keeps the dark at bay.',
   'Pitch-soaked cloth wound around a wooden handle. Every experienced traveler carries at least three.',
   1, 1, false, 1, 0, 0, 0, null, false),

  ('c1000000-0000-0000-0000-000000000007',
   'Old Grimoire', 'gear', 'magic',
   null, 'uncommon', 'Smells of iron and old smoke. Arcane writings inside.',
   'The cover is waterproofed with something organic and the pages resist fire. The text inside shifts meaning depending on the light. Probably cursed, probably useful.',
   30, 2, true, 1, 1, 0, 0, null, false)

ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- Skills
-- -------------------------------------------------------------
INSERT INTO public.skills (
  id, name, is_passive, max_rank, min_level, in_development, skill_text, effects
) VALUES
  ('d1000000-0000-0000-0000-000000000001',
   'Swordsmanship', true, 3, 0, false,
   'Training with bladed weapons. Each rank improves attack accuracy and damage.',
   '[{"type":"modifier","attribute":"attack","value":1}]'),

  ('d1000000-0000-0000-0000-000000000002',
   'Power Strike', false, 2, 1, false,
   'A devastating attack that costs power. Deals bonus damage when it lands.',
   '[{"type":"modifier","attribute":"attack","value":2}]'),

  ('d1000000-0000-0000-0000-000000000003',
   'Arcane Study', true, 3, 0, false,
   'Study of the arcane arts. Each rank expands your pool of known spells.',
   '[{"type":"modifier","attribute":"essence","value":2}]'),

  ('d1000000-0000-0000-0000-000000000004',
   'Fortitude', true, 3, 0, false,
   'Hardened constitution. Each rank adds maximum health.',
   '[{"type":"modifier","attribute":"health","value":2}]'),

  ('d1000000-0000-0000-0000-000000000005',
   'Dodge', true, 2, 0, false,
   'Light footwork that improves your chance to avoid incoming attacks.',
   '[{"type":"modifier","attribute":"defence","value":1}]'),

  ('d1000000-0000-0000-0000-000000000006',
   'Shield Mastery', true, 2, 1, false,
   'Proficiency with shields. Raises the effectiveness of blocking.',
   '[{"type":"modifier","attribute":"defence","value":2}]'),

  ('d1000000-0000-0000-0000-000000000007',
   'Shadow Step', false, 1, 2, false,
   'Teleport a short distance through shadow. Costs essence to activate.',
   '[{"type":"teleport","range":5}]'),

  ('d1000000-0000-0000-0000-000000000008',
   'Iron Will', true, 2, 0, false,
   'Mental resolve. Improves resistance to fear and mind-affecting effects.',
   '[{"type":"modifier","attribute":"will","value":2}]')

ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- Skill edges (prerequisites)
-- Swordsmanship → Power Strike
-- Dodge → Shield Mastery
-- Dodge + Arcane Study → Shadow Step
-- -------------------------------------------------------------
INSERT INTO public.skill_edges (parent_skill_id, child_skill_id) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002'),
  ('d1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000006'),
  ('d1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000007'),
  ('d1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000007')
ON CONFLICT (parent_skill_id, child_skill_id) DO NOTHING;

-- -------------------------------------------------------------
-- Spells
-- -------------------------------------------------------------
INSERT INTO public.spells (
  id, name, type, subtype,
  damage, defence, modifier, cost, cost_attribute_name,
  range_m, cast_time_min, aoe_m, active, description
) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Ember Bolt',   'offensive', 'fire',   4, 0, 0, 2, 'essence', 20, 0, 0, true,
   'A bolt of concentrated flame. Scorches on contact. One of the first combat spells taught in any tradition.'),
  (2, 'Stone Skin',   'defensive', 'earth',  0, 2, 0, 2, 'power',    0, 0, 0, true,
   'Hardens the skin briefly. Reduces incoming physical damage for one round.'),
  (3, 'Mend',         'healing',   'life',   0, 0, 4, 2, 'will',     0, 1, 0, true,
   'Accelerates the body''s own repair. Restores health. Cannot regrow lost limbs.'),
  (4, 'Shadow Veil',  'utility',   'shadow', 0, 0, 0, 3, 'essence', 10, 0, 3, true,
   'Drapes an area in unnatural shadow, obscuring vision for everything inside it.'),
  (5, 'Binding Root', 'control',   'nature', 0, 0, 0, 2, 'will',    15, 0, 0, true,
   'Spectral roots erupt from the ground to restrain a target. Lasts until broken.')
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.spells_id_seq', (SELECT MAX(id) FROM public.spells));

-- -------------------------------------------------------------
-- Creatures (bestiary)
-- -------------------------------------------------------------
INSERT INTO public.creatures (
  id, name, level,
  health_max, current_health,
  power_max, current_power,
  will_max, current_will,
  essence_max, current_essence,
  attack_damage, attack_cost, defence, strong_attack, defence_cost,
  description
) VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'Hollow Guard', 1,
   12, 12, 8, 8, 6, 6, 6, 6,
   3, 1, 1, null, 1,
   'An animated suit of corroded plate armor. Amber light pulses inside the visor. It moves with the jerky, purposeful motion of something that has forgotten what it is guarding.'),

  ('e1000000-0000-0000-0000-000000000002',
   'Bog Lurker', 2,
   18, 18, 10, 10, 6, 6, 8, 8,
   4, 1, 1, 6, 1,
   'A hunched shape caked in swamp mud and matted reed. Patient to a fault. It surfaces from below without sound and goes for the ankles first.'),

  ('e1000000-0000-0000-0000-000000000003',
   'Ashwalker', 3,
   24, 24, 12, 12, 8, 8, 8, 8,
   5, 1, 2, 8, 2,
   'Charred human remains that have not accepted death. The air around it smells of burning hair. It does not speak but it reacts to sound and firelight with obvious hatred.'),

  ('e1000000-0000-0000-0000-000000000004',
   'Veilwraith', 4,
   20, 20, 8, 8, 14, 14, 16, 16,
   3, 1, 1, 5, 1,
   'A spectral figure that flickers at the edge of vision. Cold radiates from it in waves. It moves through solid objects and ignores physical strikes unless they are delivered with iron or salt.'),

  ('e1000000-0000-0000-0000-000000000005',
   'Ironback Boar', 1,
   16, 16, 12, 12, 4, 4, 4, 4,
   5, 1, 2, null, 1,
   'A massive feral boar with a ridge of iron-hard bristles running spine to snout. Territorial and stupid. It charges and does not stop.')

ON CONFLICT (id) DO NOTHING;

UPDATE public.creatures SET ascii_art = E' [╬╬] \n ╬▓╬ \n╬╬╬╬╬\n ╬╬╬ \n ╬ ╬ \n░░ ░░' WHERE id = 'e1000000-0000-0000-0000-000000000001'; -- Hollow Guard
UPDATE public.creatures SET ascii_art = E'      \n ░▓░▓ \n▓░▓▓░▓\n ▒▓▒▒ \n░▒▒▒▒░\n──────' WHERE id = 'e1000000-0000-0000-0000-000000000002'; -- Bog Lurker
UPDATE public.creatures SET ascii_art = E' ░░░░ \n▓█▓█▓ \n▓████▓\n ████ \n █ █  \n░░  ░░' WHERE id = 'e1000000-0000-0000-0000-000000000003'; -- Ashwalker
UPDATE public.creatures SET ascii_art = E'╌╌╌╌╌╌\n╌╌▒░╌╌\n╌░▒▒░╌\n╌╌▒░╌╌\n╌╌╌╌╌╌\n      ' WHERE id = 'e1000000-0000-0000-0000-000000000004'; -- Veilwraith
UPDATE public.creatures SET ascii_art = E'  ▓▓  \n▓▓▓▓▓▓\n██████\n ████ \n▓█ █▓ \n  ‖‖  ' WHERE id = 'e1000000-0000-0000-0000-000000000005'; -- Ironback Boar

-- -------------------------------------------------------------
-- Test creatures (easy / medium / hard) for combat testing
-- -------------------------------------------------------------
INSERT INTO public.creatures (
  id, name, level,
  health_max, current_health,
  power_max, current_power,
  will_max, current_will,
  essence_max, current_essence,
  attack_damage, attack_cost, defence, strong_attack, strong_cost, defence_cost,
  description
) VALUES
  ('e3000000-0000-0000-0000-000000000001',
   'Scrapling', 1,
   8, 8, 6, 6, 4, 4, 4, 4,
   2, 1, 1, 4, 2, 1,
   'A scrawny, feral thing — half-starved and all teeth. Fast but fragile. It bites before it thinks.'),

  ('e3000000-0000-0000-0000-000000000002',
   'Dreg Soldier', 3,
   20, 20, 10, 10, 8, 8, 6, 6,
   5, 1, 2, 8, 2, 1,
   'A veteran of some forgotten war. Scarred, slow, and still dangerous. Knows which angle to attack from.'),

  ('e3000000-0000-0000-0000-000000000003',
   'Ironveil Reaver', 5,
   36, 36, 16, 16, 12, 12, 10, 10,
   7, 1, 3, 12, 3, 2,
   'An elite warrior wrapped in layered iron plate and old anger. Every strike lands like a siege weapon. It does not tire.')

ON CONFLICT (id) DO NOTHING;

UPDATE public.creatures SET ascii_art = E'  ◦◦  \n ░[x]░\n░░░░░░\n  ╵╵  \n      \n      ' WHERE id = 'e3000000-0000-0000-0000-000000000001'; -- Scrapling
UPDATE public.creatures SET ascii_art = E'  ▓▓  \n [◉▓] \n ████ \n▓ ║ ▓ \n  ║   \n ░░░  ' WHERE id = 'e3000000-0000-0000-0000-000000000002'; -- Dreg Soldier
UPDATE public.creatures SET ascii_art = E' ╔██╗ \n ╠▓▓╣ \n█╠██╣█\n█╠██╣█\n ╠══╣ \n ╚══╝ ' WHERE id = 'e3000000-0000-0000-0000-000000000003'; -- Ironveil Reaver

-- =============================================================
-- USER DATA  (deleted and re-inserted so the file is safe to re-run)
-- =============================================================

DELETE FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Auth user  (login: dev@katabatak.local / Test1234!)
INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'dev@katabatak.local',
  crypt('Test1234!', gen_salt('bf')),
  NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"devplayer"}',
  NOW(), NOW(),
  '', '', '', ''
);

-- Profile (handle_new_user trigger fires on auth insert, but runs in
-- a different transaction context in some local setups — insert explicitly)
INSERT INTO public.profiles (id, username, full_name, is_dev)
VALUES ('a0000000-0000-0000-0000-000000000001', 'devplayer', 'Dev Player', true)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, is_dev = EXCLUDED.is_dev;

-- Character
-- location_place is a FK to world_entities.id (added in migration 20260527000000).
-- syngem_game flag marks this as a SYNGEM AI GM character.
INSERT INTO public.characters (
  id, user_id, name, class_archetype,
  health_max, current_health,
  power_max, current_power,
  will_max, current_will,
  essence_max, current_essence,
  level, denarius, unused_skill_points,
  location_place,
  background_primary,
  physical_description, backstory, in_game,
  syngem_game
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Aldric Vane', 'Warrior',
  20, 20,
  14, 14,
  10, 10,
  8,  8,
  3, 85, 2,
  'loc_karkill_settlements',
  'Sell-sword',
  'Lean and weather-beaten. A scar bisects his left eyebrow. He wears a dull iron pauldron that has seen better days.',
  'Aldric spent seven years riding escort for Ashen Compact caravans before a contract gone wrong left him stranded and owed coin he will never see. He takes work where he finds it and trusts the road more than any employer.',
  false,
  true
);

-- SYNGEM game session for the dev character
-- game_date_days=81: Year 1, Month 3, Day 21 (default starting date)
-- game_time_minutes=1020: 17:00
INSERT INTO public.syngem_game (id, character_id, player_id, in_combat, game_date_days, game_time_minutes, summary)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  false, 81, 1020, null
)
ON CONFLICT (character_id) DO NOTHING;

-- Inventory
INSERT INTO public.character_inventory (id, character_id, item_id, quantity, is_equipped, condition) VALUES
  ('a0100000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'f761376b-f5aa-4834-abdb-1f7e0acc1c29', 1, true,  100),
  ('a0100000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '8200bd07-931c-433f-a92e-69472d213350', 1, false, 100),
  ('a0100000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, true,  80),
  ('a0100000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 1, true,  75),
  ('a0100000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 2, false, 100),
  ('a0100000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', 3, false, 100)
ON CONFLICT (id) DO NOTHING;

-- Skills (Swordsmanship rank 2, Fortitude rank 1, Dodge rank 1)
INSERT INTO public.character_skills (character_id, skill_id, current_rank) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 2),
  ('b0000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', 1),
  ('b0000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000005', 1)
ON CONFLICT (character_id, skill_id) DO NOTHING;

-- Game (multiplayer game record — separate from the SYNGEM solo session above)
INSERT INTO public.games (
  id, gm_id, gm_profile_id, name,
  session_number, is_private, is_in_session, archived, starting_level,
  join_code
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'The Shattered Vale',
  3, true, false, false, 1,
  'VALE01'
)
ON CONFLICT (id) DO NOTHING;

-- GM as active member
INSERT INTO public.game_members (game_id, profile_id, character_id, role, member_status) VALUES
  ('f0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'gm', 'active')
ON CONFLICT (game_id, profile_id) DO NOTHING;

-- Items available in the game's shop
INSERT INTO public.game_items (game_id, item_id, is_available_in_shop, stock_quantity, discovery_status) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', true,  -1, 'known'),
  ('f0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', true,  -1, 'known'),
  ('f0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', true,   5, 'known'),
  ('f0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', true,  -1, 'known'),
  ('f0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', false,  1, 'hidden')
ON CONFLICT (game_id, item_id) DO NOTHING;

-- -------------------------------------------------------------
-- Evaluator prompt_versions for the dev user
-- Mirrors the migration 20260610000000_seed_evaluator_prompts.sql
-- which targets pianoz4life@gmail.com (not available in local dev).
-- -------------------------------------------------------------
INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
SELECT
  'Lore-Engine Evaluator v1', 'lore-engine-evaluator', 1,
  jsonb_build_object(
    'model', 'claude-haiku-4-5-20251001',
    'maxTokens', 200,
    'temperature', 0,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content',
        'You are grading the Lore-Engine, the mechanical intent parser for the Katabatak RPG.

The Lore-Engine classifies player actions into one of three types (info, task, attack) and, for tasks and attacks, determines whether a skill check is required and which stat pool governs it.

The three stat pools are:
- Power: physical effort, strength, conviction
- Essence: magic, perception, lore
- Will: social manipulation, dexterity, mental endurance

Grade the response on:
1. Correct action_type classification (info / task / attack)
2. Accurate check requirement — checks trigger only when difficulty exceeds the character''s current pool value
3. Correct pool selection (Power / Essence / Will) for the nature of the action
4. Appropriate difficulty on the 0–50 scale: 0–10 trivial, 11–20 moderate, 21–35 hard, 36–50 extreme
5. Output schema compliance — single JSON object, no extra text

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.')
    )
  ),
  'Default evaluator prompt for the Lore-Engine agent.',
  'a0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'lore-engine-evaluator');

INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
SELECT
  'Architect Evaluator v1', 'architect1-evaluator', 1,
  jsonb_build_object(
    'model', 'claude-haiku-4-5-20251001',
    'maxTokens', 200,
    'temperature', 0,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content',
        'You are grading the Architect, the narrative GM for the Katabatak dark fantasy RPG.

The Architect produces atmospheric prose that responds to player actions, reflects current character state, and drives the story forward.

Grade the response on:
1. Narrative quality and tone — brutalist dark fantasy, no generic fantasy tropes
2. Responsiveness — the prose directly addresses what the player did
3. Factual grounding — respects the character''s pool values, location, inventory, and game state
4. No hallucination of items, abilities, or world facts absent from the provided context
5. Appropriate pacing and narrative consequence for the action type (info / task / attack)

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.')
    )
  ),
  'Default evaluator prompt for the Architect agent.',
  'a0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'architect1-evaluator');

INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
SELECT
  'Ledger Evaluator v1', 'ledger-evaluator', 1,
  jsonb_build_object(
    'model', 'claude-haiku-4-5-20251001',
    'maxTokens', 200,
    'temperature', 0,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content',
        'You are grading the Ledger, the state-change parser for the Katabatak RPG.

The Ledger reads completed GM narrative and outputs a JSON array of world-state change actions (move_character, grant_item, long_rest, update_npc, update_entity, create_entity, delete_entity).

Grade the response on:
1. All state changes implied by the narrative are captured — no missed moves, items, or rests
2. Valid action types only — no invented action names
3. Pool accuracy — long_rest deltas correctly target power, essence, and will as appropriate
4. Required fields are present for each action (e.g. characterId, location, item name)
5. No hallucinated changes not supported by the narrative text

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.')
    )
  ),
  'Default evaluator prompt for the Ledger agent.',
  'a0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'ledger-evaluator');

INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
SELECT
  'Scribe Evaluator v1', 'scribe-evaluator', 1,
  jsonb_build_object(
    'model', 'claude-haiku-4-5-20251001',
    'maxTokens', 200,
    'temperature', 0,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content',
        'You are grading the Scribe, the session summarizer for the Katabatak RPG.

The Scribe compresses conversation history into a running narrative summary and updates quest objective statuses.

Grade the response on:
1. Accuracy — key events from the provided turns are faithfully captured
2. Quest status updates — active objectives that resolved are marked completed
3. Conciseness — the summary compresses without losing critical facts or pool-affecting events
4. Pool events preserved — significant Power / Essence / Will expenditures or recoveries are noted
5. Valid JSON with required fields: has_summary, has_objectives_array, has_completed_ids_array

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.')
    )
  ),
  'Default evaluator prompt for the Scribe agent.',
  'a0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'scribe-evaluator');

INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
SELECT
  'Character Builder Evaluator v1', 'character-builder-evaluator', 1,
  jsonb_build_object(
    'model', 'claude-haiku-4-5-20251001',
    'maxTokens', 200,
    'temperature', 0,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content',
        'You are grading the Character Creator, the onboarding AI for the Katabatak dark fantasy RPG.

The Character Creator generates a character''s background, physical description, backstory, story hook, and initial quest from player Q&A responses.

Grade the response on:
1. Coherence — the generated character feels like a unified person, not a random assembly of traits
2. Thematic fit — tone is dark fantasy, grounded in a grim and oppressive world
3. Completeness — all required fields are present (name, description, backstory, hook, initial quest)
4. Pool identity — the character''s archetype naturally implies a primary pool strength
5. Valid JSON structure

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.')
    )
  ),
  'Default evaluator prompt for the Character Builder agent.',
  'a0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'character-builder-evaluator');

COMMIT;
