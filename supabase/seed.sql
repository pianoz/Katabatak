-- =============================================================
-- seed.sql  —  Dev / test data for local Supabase (port 54322)
-- Run:  psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql
--
-- One dev user, one character, one game.
-- Fixed UUIDs throughout so the file is idempotent.
--
-- NOTE: `characters` has no `notes` column in the current migration.
-- The updateCharacterNotes tests will fail until a migration adds it.
-- =============================================================

BEGIN;

-- =============================================================
-- REFERENCE DATA  (items, skills, spells, creatures, lore)
-- Safe to run many times — ON CONFLICT DO NOTHING throughout.
-- =============================================================

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

-- ASCII sprite art for seeded creatures (6 lines × ~8 chars)
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

-- -------------------------------------------------------------
-- World lore
-- -------------------------------------------------------------
INSERT INTO public.world_lore (name, category, short_desc, long_desc) VALUES
  ('Tuur-Thalen', 'region',
   'A fractured region of ash-grey plains and ruined towers.',
   'Once a prosperous heartland, Tuur-Thalen was devastated two centuries ago during the Ashfall — a catastrophic magical event that scorched the sky for forty days straight. The plains are now grey with volcanic dust and the ruins of old cities dot the horizon at regular intervals. Survivors formed scattered polis-states, each clinging to old customs and trading in secrets more than goods.'),

  ('Vael''kast', 'polis',
   'A fortified polis built inside a dead colossus.',
   'Vael''kast is a city carved into the bones of an enormous creature that died on the plain long before recorded history. Its inhabitants are pragmatic and grim, with a strong tradition of bone-carving that outsiders find unsettling. The city trades iron tools, rendered fat, and information about the wastes to the west. It is governed by the Ossuary Council — five families who claim descent from the original survivors.'),

  ('The Bone Market', 'location',
   'A sprawling open market in the lower district of Vael''kast.',
   'The Bone Market occupies the ribcage of the great dead colossus. Stalls sell everything from dried meats and lamp oil to questionable spell components and indentured contracts. It operates day and night under the watch of the Iron Wardens — a private security guild paid to keep order and ask no questions. The smell is considerable.'),

  ('The Ashen Compact', 'faction',
   'A merchant consortium that controls the major trade routes across Tuur-Thalen.',
   'The Compact was founded by three surviving merchant families in the years after the Ashfall. Over two centuries they have grown into the dominant economic force in the region, controlling waypoints, river crossings, and storage vaults along all major roads. They prefer contracts over violence but maintain a substantial armed escort company called the Grey Hands for situations where preference does not matter.'),

  ('Maren Solveig', 'npc',
   'Trade-factor of the Ashen Compact in Vael''kast.',
   'Maren is a measured woman in her late forties with close-cropped grey hair and a permanently ink-stained right hand. She serves as the Compact''s factor in Vael''kast and is known to be fair, meticulous, and utterly ruthless about contracts. She collects pre-Ashfall maps as a private obsession and is quietly convinced she has triangulated the location of the Vault of Embers — a treasury rumored to lie beneath the western plain.')

ON CONFLICT (name) DO NOTHING;

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
INSERT INTO public.characters (
  id, user_id, name, class_archetype,
  health_max, current_health,
  power_max, current_power,
  will_max, current_will,
  essence_max, current_essence,
  level, denarius, unused_skill_points,
  current_location_region, current_location_polis,
  background_primary,
  physical_description, backstory, in_game
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Aldric Vane', 'Warrior',
  20, 20,
  14, 14,
  10, 10,
  8,  8,
  3, 85, 2,
  'Tuur-Thalen', 'Vael''kast',
  'Sell-sword',
  'Lean and weather-beaten. A scar bisects his left eyebrow. He wears a dull iron pauldron that has seen better days.',
  'Aldric spent seven years riding escort for Ashen Compact caravans before a contract gone wrong left him stranded and owed coin he will never see. He takes work where he finds it and trusts the road more than any employer.',
  false
);

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

-- Game
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

COMMIT;
